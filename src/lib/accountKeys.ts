/**
 * API-Keys im Konto — freiwillig, mit ausdrücklicher Zustimmung.
 *
 * Standard bleibt: die Keys liegen nur im Browser. Setzt der Kunde das Häkchen
 * unter den Key-Feldern (Bestätigungsdialog in `AccountKeysConsent`), liegen sie
 * zusätzlich verschlüsselt im Konto und sind nach dem Login in jedem Browser da.
 * Abhaken löscht sie im Konto wieder; lokal bleiben sie erhalten.
 */
import { API } from "@/lib/backend";

/** Fassung der Zustimmung — steht so auch in den Rechtstexten. */
export const KEYS_CONSENT_VERSION = "2026-09-17";

export interface AccountKeys { google?: string; fal?: string; eleven?: string }

export interface AccountKeysSnapshot {
  /** "unknown" bis das Konto einmal gefragt wurde. */
  status: "unknown" | "off" | "on";
  /** Konto-Login vorhanden? Ohne Token gibt es die Wahl gar nicht. */
  available: boolean;
  busy: boolean;
  error?: string;
  updatedAt?: string;
}

let snap: AccountKeysSnapshot = { status: "unknown", available: false, busy: false };
const listeners = new Set<() => void>();
let token: string | undefined;
let lastPushed: string | undefined;

function setSnap(patch: Partial<AccountKeysSnapshot>) {
  snap = { ...snap, ...patch };
  for (const l of listeners) l();
}

export function subscribeAccountKeys(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getAccountKeysSnapshot(): AccountKeysSnapshot {
  return snap;
}

export function setAccountKeysSession(next: string | undefined): void {
  if (next === token) return;
  token = next;
  lastPushed = undefined;
  setSnap({ available: !!token, status: "unknown", error: undefined });
}

async function call(method: "GET" | "POST", path: string, body?: unknown) {
  if (!token) throw new Error("Nicht angemeldet.");
  const res = await fetch(API(path), {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}` },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* noop */ }
  return { status: res.status, data };
}

const onlyFilled = (keys: AccountKeys): AccountKeys => ({
  ...(keys.google ? { google: keys.google } : {}),
  ...(keys.fal ? { fal: keys.fal } : {}),
  ...(keys.eleven ? { eleven: keys.eleven } : {}),
});

/** Konto fragen: liegt eine Zustimmung vor, und welche Keys sind hinterlegt? */
export async function fetchAccountKeys(): Promise<{ consent: boolean; keys: AccountKeys } | null> {
  if (!token) return null;
  try {
    const r = await call("GET", "/api/account/keys");
    // Älterer Server ohne diese Route: dann gibt es die Wahl eben nicht.
    if (r.status === 404) { setSnap({ status: "off", available: false }); return null; }
    if (r.status !== 200) throw new Error(String(r.status));
    const consent = r.data?.consent === true;
    setSnap({ status: consent ? "on" : "off", updatedAt: r.data?.updatedAt, error: r.data?.unreadable ? "Die im Konto gespeicherten Keys sind nicht mehr lesbar — bitte neu speichern." : undefined });
    if (consent) lastPushed = JSON.stringify(onlyFilled(r.data?.keys || {}));
    return { consent, keys: (r.data?.keys || {}) as AccountKeys };
  } catch (err: any) {
    setSnap({ error: "Konto nicht erreichbar." });
    return null;
  }
}

/**
 * Keys ins Konto schreiben. `consent` ist Pflicht — der Server speichert ohne
 * ausdrückliche Zustimmung nichts.
 */
export async function saveAccountKeys(keys: AccountKeys): Promise<boolean> {
  if (!token) return false;
  const payload = onlyFilled(keys);
  const fingerprint = JSON.stringify(payload);
  if (fingerprint === lastPushed && snap.status === "on") return true;
  setSnap({ busy: true, error: undefined });
  try {
    const r = await call("POST", "/api/account/keys", { consent: true, consentVersion: KEYS_CONSENT_VERSION, keys: payload });
    if (r.status !== 200) throw new Error(r.data?.error || String(r.status));
    lastPushed = fingerprint;
    setSnap({ status: "on", busy: false, updatedAt: new Date().toISOString() });
    return true;
  } catch (err: any) {
    setSnap({ busy: false, error: `Speichern im Konto fehlgeschlagen (${err?.message || "unbekannt"}).` });
    return false;
  }
}

/** Widerruf: Keys aus dem Konto löschen (lokal bleiben sie). */
export async function disableAccountKeys(): Promise<boolean> {
  if (!token) return false;
  setSnap({ busy: true, error: undefined });
  try {
    const r = await call("POST", "/api/account/keys/delete", {});
    if (r.status !== 200) throw new Error(String(r.status));
    lastPushed = undefined;
    setSnap({ status: "off", busy: false, updatedAt: undefined });
    return true;
  } catch (err: any) {
    setSnap({ busy: false, error: `Löschen im Konto fehlgeschlagen (${err?.message || "unbekannt"}).` });
    return false;
  }
}
