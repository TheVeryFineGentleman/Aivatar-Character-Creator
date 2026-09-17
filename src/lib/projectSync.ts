/**
 * Projekte im Konto — derselbe Stand in jedem Browser.
 *
 * Bisher lagen Projekte nur im localStorage: pro Browser, pro Profil, und eine
 * Browser-Einstellung („Forget me when I close this site") reichte, um alles zu
 * verlieren (Kundenfall 2026-09). Jetzt ist das Konto auf dem key-manager der
 * Speicherort; der localStorage bleibt die schnelle Kopie, mit der die App
 * arbeitet wie bisher.
 *
 * Ablauf:
 * - Jede Projekt-Änderung meldet `projectStorage` (onProjectWrite). Sie wird als
 *   „ungespeichert" markiert und 2 s nach der letzten Änderung hochgeladen.
 * - Sobald ein Sitzungs-Token da ist (Start/Login), holt `pullNow` das Konto:
 *   neuere Stände übernehmen, fehlende laden, im Konto gelöschte entfernen,
 *   lokale ohne Gegenstück hochladen.
 * - Konflikte über `revision`: gespeichert wird nur auf dem Stand, den dieser
 *   Browser zuletzt vom Konto kannte. Hat ein anderes Gerät dazwischen
 *   gespeichert, fragt die App (SyncConflictDialog) — nie still überschreiben.
 * - Beim Schließen des Tabs gehen letzte Änderungen per `keepalive` raus. Kam
 *   die Antwort nicht mehr an, erkennt der nächste Abgleich den gleichen Stand
 *   und meldet keinen Scheinkonflikt.
 *
 * Lokal wird nie etwas gelöscht, das nicht sicher im Konto liegt — Ausnahme ist
 * das automatisch angelegte, leere „Mein erstes Projekt", sobald das Konto echte
 * Projekte liefert.
 */
import { API } from "@/lib/backend";
import { canWrite } from "@/lib/tabLock";
import { ls } from "@/lib/storage";
import { isProjectEmpty } from "@/lib/projectTransfer";
import {
  DEFAULT_PROJECT_NAME,
  deleteProject,
  ensureProject,
  getCurrentProjectId,
  listProjects,
  loadProject,
  onProjectWrite,
  putProject,
} from "@/lib/projectStorage";

// ── Zustand, den die Oberfläche sieht ───────────────────────────────────────

export type SyncPhase = "off" | "syncing" | "pending" | "saved" | "offline" | "limit" | "error";
export interface SyncConflict { id: string; name: string; kind: "changed" | "deleted" }
export interface SyncSnapshot {
  phase: SyncPhase;
  message?: string;
  conflicts: SyncConflict[];
  /** Steigt, wenn der Abgleich Projekte ausgetauscht hat → App neu einhängen. */
  reloadVersion: number;
}

let snap: SyncSnapshot = { phase: "off", conflicts: [], reloadVersion: 0 };
const snapListeners = new Set<() => void>();

function setSnap(patch: Partial<SyncSnapshot>) {
  snap = { ...snap, ...patch };
  for (const l of snapListeners) l();
}

export function subscribeSync(listener: () => void): () => void {
  snapListeners.add(listener);
  return () => { snapListeners.delete(listener); };
}

export function getSyncSnapshot(): SyncSnapshot {
  return snap;
}

// ── Gemerkter Abgleich-Stand pro Projekt (im localStorage) ──────────────────

interface Entry {
  /** Letzte Konto-Revision, die dieser Browser kennt (0 = nie im Konto). */
  rev: number;
  /** Fingerabdruck des Inhalts, der bei `rev` im Konto liegt (siehe contentHash). */
  hash?: string;
  /** Lokale Änderungen, die noch nicht im Konto sind. */
  dirty: boolean;
  /** Lokal gelöscht, Löschen noch nicht im Konto. */
  deleted?: boolean;
  /** Hochladen ausgesetzt, bis sich etwas ändert oder der Konflikt gelöst ist. */
  blocked?: "limit" | "conflict" | "size";
}
interface Meta { account: string | null; projects: Record<string, Entry> }

const META_KEY = "sync.state";

function readMeta(): Meta {
  const m = ls.get<Meta>(META_KEY);
  return m && typeof m === "object" && m.projects && typeof m.projects === "object"
    ? m
    : { account: null, projects: {} };
}

function writeMeta(m: Meta) {
  ls.set(META_KEY, m);
}

// ── Sitzung ──────────────────────────────────────────────────────────────────

let token: string | undefined;
let account: string | null = null;
let applyingRemote = false;
let unloading = false;
let pushing = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let retryDelay = 0;
/** Änderungszähler pro Projekt — eine Antwort darf nur „gespeichert" setzen, wenn
 *  sich währenddessen nichts mehr geändert hat. */
const changeGen = new Map<string, number>();

function applyRemote<T>(fn: () => T): T {
  applyingRemote = true;
  try { return fn(); } finally { applyingRemote = false; }
}

/**
 * Fingerabdruck von Name + Stand.
 *
 * Viele Seiten schreiben beim Öffnen ihren Stand UNVERÄNDERT zurück (Formular-
 * werte, Galerie, Szenen). Ohne diesen Vergleich wäre jedes Öffnen ein Upload,
 * die Revision stiege ständig, und zwei offene Geräte hielten sich gegenseitig
 * für „anderswo geändert" — im Test genau so passiert, bis hin zu einer still
 * überschriebenen Änderung. Zwei unabhängige 32-bit-Hashes plus Länge.
 */
function contentHash(name: string, state: unknown): string {
  const s = JSON.stringify([name, state]);
  let a = 0x811c9dc5;
  let b = 5381;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = (Math.imul(b, 33) ^ c) | 0;
  }
  return `${s.length}.${(a >>> 0).toString(36)}.${(b >>> 0).toString(36)}`;
}

function projectHash(id: string): string | undefined {
  const data = loadProject(id);
  return data ? contentHash(data.meta.name, data.state) : undefined;
}

function tokenEmail(t: string): string | null {
  try {
    const payload = t.split(".")[0].replace(/-/g, "+").replace(/_/g, "/");
    const data = JSON.parse(atob(payload));
    return typeof data?.e === "string" ? data.e.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Von `ProjectSyncRoot` bei jeder Änderung der Anmeldung aufgerufen. */
export function setSyncSession(nextToken: string | undefined): void {
  if (nextToken === token) return;
  token = nextToken;
  const email = token ? tokenEmail(token) : null;
  if (!token || !email) {
    token = undefined;
    account = null;
    setSnap({ phase: "off", message: undefined });
    return;
  }
  account = email;
  void pullNow();
}

// ── Server-Aufrufe ───────────────────────────────────────────────────────────

interface ServerItem { id: string; name: string; revision: number; createdAt: number; updatedAt: string; deleted: boolean }
interface ServerProject extends ServerItem { state: Record<string, unknown> }

async function api(method: "GET" | "POST", path: string, body?: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(API(path), {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* noop */ }
  return { status: res.status, data };
}

async function fetchProject(id: string): Promise<ServerProject | null> {
  const r = await api("GET", `/api/account/projects/${encodeURIComponent(id)}`);
  return r.status === 200 ? (r.data as ServerProject) : null;
}

function writeRemoteProject(p: ServerProject) {
  applyRemote(() => putProject(
    { id: p.id, name: p.name, createdAt: p.createdAt || Date.now(), modifiedAt: Date.parse(p.updatedAt) || Date.now(), sizeBytes: 0 },
    p.state,
  ));
}

const isEmptyDefault = (id: string) => {
  const data = loadProject(id);
  return !!data && data.meta.name === DEFAULT_PROJECT_NAME && isProjectEmpty(data.state);
};

// ── Änderungen mitschreiben ──────────────────────────────────────────────────

onProjectWrite((e) => {
  if (applyingRemote) return;
  const m = readMeta();
  const entry = m.projects[e.id] ?? { rev: 0, dirty: false };
  // Auch bei unverändertem Inhalt zählen: läuft gerade ein Upload mit einem
  // anderen Stand, darf er sich danach nicht als „gespeichert" melden.
  changeGen.set(e.id, (changeGen.get(e.id) ?? 0) + 1);
  if (e.type === "deleted") {
    if (entry.rev === 0) delete m.projects[e.id];
    else m.projects[e.id] = { rev: entry.rev, hash: entry.hash, dirty: true, deleted: true };
  } else {
    if (entry.rev > 0 && entry.hash && entry.hash === projectHash(e.id)) {
      // Unverändert zurückgeschrieben (typisch beim Öffnen einer Seite).
      m.projects[e.id] = { ...entry, dirty: false, deleted: undefined };
      writeMeta(m);
      return;
    }
    m.projects[e.id] = {
      rev: entry.rev,
      hash: entry.hash,
      dirty: true,
      ...(entry.blocked === "conflict" ? { blocked: "conflict" as const } : {}),
    };
  }
  writeMeta(m);
  if (unloading) sendKeepalive(e.id);
  else schedulePush(2000);
});

function schedulePush(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; void flushPushes(); }, ms);
  if (token && snap.phase !== "offline" && snap.phase !== "off") setSnap({ phase: "pending" });
}

function scheduleRetry() {
  retryDelay = Math.min(retryDelay ? retryDelay * 2 : 10_000, 120_000);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = undefined; void pullNow(); }, retryDelay);
}

if (typeof window !== "undefined") {
  // capture: läuft VOR den pagehide-Handlern der Seiten, die dort ihren letzten
  // Stand sichern — deren Schreibzugriffe gehen dann direkt per keepalive raus.
  window.addEventListener("pagehide", () => { unloading = true; sendAllKeepalive(); }, { capture: true });
  window.addEventListener("pageshow", () => { unloading = false; });
  window.addEventListener("online", () => { void pullNow(); });
}

function sendKeepalive(id: string) {
  if (!token || !canWrite()) return;
  const entry = readMeta().projects[id];
  const data = loadProject(id);
  if (!entry || !entry.dirty || entry.deleted || entry.blocked || !data) return;
  if (entry.rev === 0 && isEmptyDefault(id)) return;
  const body = JSON.stringify({ name: data.meta.name, state: data.state, baseRevision: entry.rev, createdAt: data.meta.createdAt });
  if (body.length > 60_000) return; // keepalive-Grenze der Browser (~64 KB) — dann beim nächsten Start
  try {
    void fetch(API(`/api/account/projects/${encodeURIComponent(id)}`), {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body,
    }).catch(() => { /* nächster Start holt es nach */ });
  } catch { /* noop */ }
}

function sendAllKeepalive() {
  for (const [id, e] of Object.entries(readMeta().projects)) if (e.dirty) sendKeepalive(id);
}

// ── Hochladen ────────────────────────────────────────────────────────────────

type PushResult = "ok" | "skip" | "conflict" | "limit" | "offline" | "auth";

async function pushOne(id: string): Promise<PushResult> {
  const entry = readMeta().projects[id];
  if (!entry || !entry.dirty || entry.blocked) return "skip";
  const gen = changeGen.get(id) ?? 0;
  const settle = (patch: Partial<Entry> | null) => {
    const m = readMeta();
    if (patch === null) delete m.projects[id];
    else m.projects[id] = { ...(m.projects[id] ?? entry), ...patch };
    writeMeta(m);
  };

  try {
    if (entry.deleted) {
      const r = await api("POST", `/api/account/projects/${encodeURIComponent(id)}/delete`, {});
      if (r.status === 401) return "auth";
      if (r.status >= 500) return "offline";
      if ((changeGen.get(id) ?? 0) === gen) settle(null);
      return "ok";
    }

    const data = loadProject(id);
    if (!data) { settle(null); return "skip"; }
    if (entry.rev === 0 && isEmptyDefault(id)) { settle({ dirty: false }); return "skip"; }

    const sentHash = contentHash(data.meta.name, data.state);
    const r = await api("POST", `/api/account/projects/${encodeURIComponent(id)}`, {
      name: data.meta.name, state: data.state, baseRevision: entry.rev, createdAt: data.meta.createdAt,
    });
    if (r.status === 200) {
      settle({ rev: r.data.revision, hash: sentHash, dirty: (changeGen.get(id) ?? 0) !== gen, blocked: undefined });
      return "ok";
    }
    if (r.status === 401) return "auth";
    if (r.status === 409) {
      settle({ blocked: "conflict" });
      addConflict({ id, name: data.meta.name, kind: r.data?.deleted ? "deleted" : "changed" });
      return "conflict";
    }
    if (r.status === 403 && r.data?.error === "PROJECT_LIMIT") { settle({ blocked: "limit" }); return "limit"; }
    if (r.status === 413) { settle({ blocked: "size" }); return "limit"; }
    return r.status >= 500 ? "offline" : "skip";
  } catch {
    return "offline";
  }
}

async function flushPushes(): Promise<void> {
  if (pushing || !token || !canWrite()) return;
  pushing = true;
  try {
    const ids = Object.entries(readMeta().projects).filter(([, e]) => e.dirty && !e.blocked).map(([id]) => id);
    if (ids.length) setSnap({ phase: "syncing" });
    for (const id of ids) {
      const r = await pushOne(id);
      if (r === "offline") { setSnap({ phase: "offline" }); scheduleRetry(); return; }
      if (r === "auth") { setSnap({ phase: "error", message: "Anmeldung abgelaufen — bitte neu einloggen." }); return; }
    }
    retryDelay = 0;
    const m = readMeta();
    const entries = Object.values(m.projects);
    const stillDirty = entries.some((e) => e.dirty && !e.blocked);
    if (entries.some((e) => e.blocked === "size")) setSnap({ phase: "error", message: "Ein Projekt ist zu groß für das Konto." });
    else if (entries.some((e) => e.blocked === "limit")) setSnap({ phase: "limit", message: undefined });
    else setSnap({ phase: stillDirty ? "pending" : "saved", message: undefined });
    if (stillDirty) schedulePush(2000);
  } finally {
    pushing = false;
  }
}

// ── Abgleich mit dem Konto ───────────────────────────────────────────────────

let pulling: Promise<void> | null = null;

/** Konto holen und mit den lokalen Projekten abgleichen, danach hochladen. */
export function pullNow(): Promise<void> {
  if (!pulling) pulling = doPull().finally(() => { pulling = null; });
  return pulling;
}

async function doPull(): Promise<void> {
  if (!token || !account || !canWrite()) return;
  setSnap({ phase: "syncing", message: undefined });

  let list: ServerItem[];
  try {
    const r = await api("GET", "/api/account/projects");
    if (r.status === 401) { setSnap({ phase: "error", message: "Anmeldung abgelaufen — bitte neu einloggen." }); return; }
    if (r.status === 404) { setSnap({ phase: "off" }); return; } // Server ohne Konto-Speicher
    if (r.status !== 200 || !Array.isArray(r.data?.items)) throw new Error(`HTTP ${r.status}`);
    list = r.data.items as ServerItem[];
  } catch {
    setSnap({ phase: "offline" });
    scheduleRetry();
    return;
  }

  const currentBefore = getCurrentProjectId();
  const idsBefore = listProjects().map((p) => p.id).sort().join(",");
  let currentReplaced = false;
  let m = readMeta();

  // Anderes Konto als zuletzt in diesem Browser: was sicher im alten Konto liegt,
  // verschwindet hier; nie Gespeichertes bleibt und geht ins neue Konto.
  if (m.account && m.account !== account) {
    for (const p of listProjects()) {
      const e = m.projects[p.id];
      if (e && e.rev > 0 && !e.dirty) applyRemote(() => deleteProject(p.id));
    }
    m = { account, projects: {} };
  }
  m.account = account;

  const conflicts: SyncConflict[] = snap.conflicts.filter((c) => list.some((s) => s.id === c.id));
  const addLocalConflict = (c: SyncConflict) => {
    if (!conflicts.some((x) => x.id === c.id)) conflicts.push(c);
    m.projects[c.id] = { ...(m.projects[c.id] ?? { rev: 0, dirty: true }), blocked: "conflict" };
  };

  for (const s of list) {
    const entry = m.projects[s.id];
    const local = loadProject(s.id);

    if (s.deleted) {
      if (local && entry?.dirty && !entry.deleted) {
        addLocalConflict({ id: s.id, name: local.meta.name, kind: "deleted" });
      } else {
        if (local) {
          applyRemote(() => deleteProject(s.id));
          if (s.id === currentBefore) currentReplaced = true;
        }
        delete m.projects[s.id];
      }
      continue;
    }
    if (entry?.deleted) continue; // hier gelöscht — das Löschen wird gleich hochgeladen
    if (local && entry && s.revision === entry.rev) continue; // gleicher Stand

    let full: ServerProject | null;
    try { full = await fetchProject(s.id); } catch { full = null; }
    if (!full) continue;

    const fullHash = contentHash(full.name, full.state);
    if (local) {
      if (projectHash(s.id) === fullHash) { m.projects[s.id] = { rev: full.revision, hash: fullHash, dirty: false }; continue; }
      const localHasWork = entry ? entry.dirty : !isProjectEmpty(local.state);
      if (localHasWork) {
        addLocalConflict({ id: s.id, name: local.meta.name, kind: "changed" });
        continue;
      }
    }
    writeRemoteProject(full);
    m.projects[s.id] = { rev: full.revision, hash: fullHash, dirty: false };
    if (s.id === currentBefore) currentReplaced = true;
  }

  // Lokale Projekte, die das Konto nicht kennt.
  const accountHasProjects = list.some((s) => !s.deleted);
  const serverIds = new Set(list.map((s) => s.id));
  for (const p of listProjects()) {
    if (serverIds.has(p.id)) continue;
    const entry = m.projects[p.id];
    if (isEmptyDefault(p.id) && (entry?.rev ?? 0) === 0) {
      // Automatisch angelegt und leer: gehört nicht ins Konto und macht Platz,
      // sobald das Konto echte Projekte liefert.
      if (accountHasProjects) {
        applyRemote(() => deleteProject(p.id));
        if (p.id === currentBefore) currentReplaced = true;
      }
      delete m.projects[p.id];
      continue;
    }
    // Neu in diesem Browser, aus der Zeit vor dem Konto-Speicher oder im Konto
    // verschwunden: hochladen.
    m.projects[p.id] = { rev: 0, dirty: true };
  }

  writeMeta(m);
  applyRemote(() => ensureProject());
  if (getCurrentProjectId() !== currentBefore) currentReplaced = true;
  const idsAfter = listProjects().map((p) => p.id).sort().join(",");

  setSnap({
    conflicts,
    ...(currentReplaced || idsAfter !== idsBefore ? { reloadVersion: snap.reloadVersion + 1 } : {}),
  });
  await flushPushes();
  if (!Object.values(readMeta().projects).some((e) => e.dirty)) {
    if (snap.phase === "syncing" || snap.phase === "pending") setSnap({ phase: "saved" });
  }
}

// ── Konflikte ────────────────────────────────────────────────────────────────

function addConflict(c: SyncConflict) {
  if (snap.conflicts.some((x) => x.id === c.id)) return;
  setSnap({ conflicts: [...snap.conflicts, c] });
}

function removeConflict(id: string) {
  setSnap({ conflicts: snap.conflicts.filter((c) => c.id !== id) });
}

/**
 * „server": Stand aus dem Konto übernehmen (lokale ungespeicherte Änderungen
 * gehen verloren). „local": den Stand hier ins Konto schreiben — der dortige
 * bleibt als ältere Fassung erhalten.
 */
export async function resolveConflict(id: string, choice: "server" | "local"): Promise<void> {
  const conflict = snap.conflicts.find((c) => c.id === id);
  if (!conflict || !token) return;
  const m = readMeta();

  if (choice === "server") {
    if (conflict.kind === "deleted") {
      applyRemote(() => deleteProject(id));
      delete m.projects[id];
    } else {
      const full = await fetchProject(id);
      if (!full) return;
      writeRemoteProject(full);
      m.projects[id] = { rev: full.revision, hash: contentHash(full.name, full.state), dirty: false };
    }
    writeMeta(m);
    applyRemote(() => ensureProject());
    removeConflict(id);
    setSnap({ reloadVersion: snap.reloadVersion + 1 });
  } else {
    const data = loadProject(id);
    if (!data) { removeConflict(id); return; }
    const r = await api("POST", `/api/account/projects/${encodeURIComponent(id)}`, {
      name: data.meta.name, state: data.state, baseRevision: m.projects[id]?.rev ?? 0, createdAt: data.meta.createdAt, force: true,
    });
    if (r.status === 200) {
      m.projects[id] = { rev: r.data.revision, hash: contentHash(data.meta.name, data.state), dirty: false };
      writeMeta(m);
      removeConflict(id);
    } else if (r.status === 403) {
      m.projects[id] = { ...(m.projects[id] ?? { rev: 0, dirty: true }), blocked: "limit" };
      writeMeta(m);
      removeConflict(id);
      setSnap({ phase: "limit" });
    } else {
      return; // später erneut versuchen — der Dialog bleibt offen
    }
  }
  void flushPushes();
}
