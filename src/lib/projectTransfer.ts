/**
 * Projekte sichern und wiederherstellen — als Datei (Export/Import im
 * Projektmenü) und für die Support-Wiederherstellung beim Login (siehe
 * `RecoveryPrompt`).
 *
 * Warum es das braucht: Projekte liegen nur im localStorage DIESES Browsers,
 * getrennt pro Adresse und pro Profil. Ein anderes Profil oder gelöschte
 * Websitedaten, und alles scheint weg (Kundenfall 2026-09). Bilder und Videos
 * liegen zwar im Bucket — ohne den Projektstand findet die App sie aber nicht.
 *
 * Die Datei enthält den Projektstand 1:1, Medien als ihre Bucket-Links statt
 * als Daten. Sie bleibt dadurch klein, setzt aber voraus, dass die Links noch
 * gelten (das tun sie, solange die Dateien im Bucket nicht gelöscht werden).
 *
 * Import überschreibt NIE: ein Projekt, dessen ID schon da ist, wird
 * übersprungen. Wer eine ältere Fassung zurückwill, löscht erst die jetzige.
 */
import { deleteProject, listProjects, loadProject, putProject, type ProjectMeta } from "@/lib/projectStorage";

export const BUNDLE_FORMAT = "aivatar-projects";
const MAX_BUNDLE_CHARS = 20 * 1024 * 1024;

export interface BundleProject { meta: ProjectMeta; state: Record<string, unknown> }
export interface ProjectBundle {
  format: typeof BUNDLE_FORMAT;
  version: 1;
  exportedAt: string;
  projects: BundleProject[];
}

export function exportAllProjects(): ProjectBundle {
  const projects: BundleProject[] = [];
  for (const meta of listProjects()) {
    const data = loadProject(meta.id);
    if (!data) continue;
    projects.push({ meta: data.meta, state: (data.state ?? {}) as Record<string, unknown> });
  }
  return { format: BUNDLE_FORMAT, version: 1, exportedAt: new Date().toISOString(), projects };
}

export function downloadBundle(bundle: ProjectBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aivatar-sicherung-${(bundle.exportedAt || new Date().toISOString()).slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Prüft ein schon geparstes Objekt — die Server-Wiederherstellung liefert JSON, keinen Text. */
export function validateBundle(raw: unknown): ProjectBundle {
  const b = raw as Partial<ProjectBundle> | null;
  if (!b || b.format !== BUNDLE_FORMAT || !Array.isArray(b.projects)) {
    throw new Error("Das ist keine Aivatar-Projektsicherung.");
  }
  const projects = b.projects
    .filter((p): p is BundleProject =>
      !!p && typeof p.meta?.id === "string" && !!p.meta.id && typeof p.meta?.name === "string"
      && !!p.state && typeof p.state === "object" && !Array.isArray(p.state))
    .map((p) => ({
      meta: {
        id: p.meta.id,
        name: p.meta.name.trim() || "Importiertes Projekt",
        createdAt: Number(p.meta.createdAt) || Date.now(),
        modifiedAt: Number(p.meta.modifiedAt) || Date.now(),
        sizeBytes: 0,
      },
      state: p.state,
    }));
  if (!projects.length) throw new Error("Die Sicherung enthält keine lesbaren Projekte.");
  return { format: BUNDLE_FORMAT, version: 1, exportedAt: String(b.exportedAt || ""), projects };
}

export function parseBundle(text: string): ProjectBundle {
  if (text.length > MAX_BUNDLE_CHARS) throw new Error("Die Datei ist zu groß für eine Projektsicherung.");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("Die Datei ist kein gültiges JSON."); }
  return validateBundle(raw);
}

const hasItems = (v: unknown) =>
  Array.isArray(v) ? v.length > 0 : !!v && typeof v === "object" && Object.keys(v).length > 0;
const hasListItems = (v: unknown) =>
  !!v && typeof v === "object" && Object.values(v as Record<string, unknown>).some((x) => Array.isArray(x) && x.length > 0);

/**
 * Enthält ein Projekt nichts, was verloren gehen könnte? Nur solche Projekte
 * darf der Import verdrängen, wenn das Projekt-Limit erreicht ist — typisch
 * das automatisch angelegte „Mein erstes Projekt". Getippter Text zählt als
 * Inhalt; reine Einstellungen und das Profil nicht.
 */
export function isProjectEmpty(state: unknown): boolean {
  const s = (state ?? {}) as Record<string, unknown>;
  const values = (s.values ?? {}) as Record<string, unknown>;
  const typed = Object.entries(values).some(([k, v]) => k !== "profile" && typeof v === "string" && v.trim().length > 0);
  return !typed && !hasItems(s.story) && !hasItems(s.storyboardSlots)
    && !hasListItems(s.galleries) && !hasListItems(s.refs) && !hasListItems(s.results);
}

export type SkipReason = "exists" | "limit" | "storage";
export interface ImportResult {
  imported: ProjectMeta[];
  skipped: { name: string; reason: SkipReason }[];
}

export function importBundle(bundle: ProjectBundle, projectLimit: number): ImportResult {
  const result: ImportResult = { imported: [], skipped: [] };
  const importedIds = new Set<string>();
  for (const p of bundle.projects) {
    const existing = listProjects();
    if (existing.some((e) => e.id === p.meta.id)) {
      result.skipped.push({ name: p.meta.name, reason: "exists" });
      continue;
    }
    if (existing.length >= projectLimit) {
      const spare = existing.find((e) => !importedIds.has(e.id) && isProjectEmpty(loadProject(e.id)?.state));
      if (!spare) {
        result.skipped.push({ name: p.meta.name, reason: "limit" });
        continue;
      }
      deleteProject(spare.id);
    }
    // Frisch importiert steht oben in der Liste.
    const meta: ProjectMeta = { ...p.meta, modifiedAt: Date.now() };
    if (!putProject(meta, p.state)) {
      result.skipped.push({ name: p.meta.name, reason: "storage" });
      continue;
    }
    importedIds.add(meta.id);
    result.imported.push(meta);
  }
  return result;
}

const REASON: Record<SkipReason, string> = {
  exists: "ist schon vorhanden",
  limit: "Projekt-Limit erreicht, erst ein Projekt löschen",
  storage: "konnte nicht gespeichert werden (Browser-Speicher voll?)",
};

export function summarizeImport(r: ImportResult): { title: string; description?: string } {
  const n = r.imported.length;
  return {
    title: n ? `${n} Projekt${n === 1 ? "" : "e"} übernommen.` : "Kein Projekt übernommen.",
    description: r.skipped.length
      ? r.skipped.map((s) => `„${s.name}": ${REASON[s.reason]}`).join(" · ")
      : undefined,
  };
}

/** Kurzbeschreibung für die Wiederherstellungs-Anzeige. */
export function describeProject(state: Record<string, unknown>): { scenes: number; videos: number; images: number } {
  const story = Array.isArray(state.story) ? (state.story as { videoUrl?: string; dubbedVideoUrl?: string }[]) : [];
  const countUrls = (m: unknown) =>
    !m || typeof m !== "object" ? 0
      : Object.values(m as Record<string, unknown>)
        .reduce<number>((n, list) => n + (Array.isArray(list) ? list.filter((x) => (x as { url?: string })?.url).length : 0), 0);
  return {
    scenes: story.length,
    videos: story.filter((s) => s.videoUrl || s.dubbedVideoUrl).length,
    images: countUrls(state.galleries) + countUrls(state.refs) + countUrls(state.results),
  };
}
