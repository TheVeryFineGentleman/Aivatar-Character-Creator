/**
 * Projekt-Profil — pro Projekt gespeichert (in state.values.profile via
 * useProjectValue). Sagt der KI, worum es im Projekt geht; der Kontext wird
 * zentral in JEDEN KI-Vorschlags-Prompt injiziert (buildProfilePreamble) und
 * legt sinnvolle Voreinstellungen fest (profileToDefaults / applyProfileDefaults).
 */
import { loadProject, saveProjectState } from "@/lib/projectStorage";

export type ProfileContentType = "reel" | "portrait" | "product" | "story" | "other";

/**
 * v2 unterscheidet ein BEWUSSTES „Später" von einem versehentlichen Wegklicken.
 * In v1 führten beide zum selben `skipped: true` — und weil `completed: true`
 * den Setup-Dialog dauerhaft unterdrückt, blieb das Profil danach für immer
 * inaktiv, ohne dass irgendwo sichtbar war warum. v1-Profile ohne Zweck werden
 * deshalb als „nie beantwortet" behandelt und einmal erneut gefragt.
 */
export const PROFILE_VERSION = 2;

export interface ProjectProfile {
  version: number;
  completed: boolean;      // true = Setup abgeschlossen ODER bewusst übersprungen
  skipped?: boolean;       // true = „Später" → kein Profil-Kontext, generisch
  purpose: string;         // „Was willst du machen?" — der Kern-Freitext
  contentType?: ProfileContentType;
  language: string;        // „Deutsch" | „English" … steuert die Ausgabesprache
  createdAt: number;
}

/**
 * Soll der Profil-Setup-Dialog gezeigt werden?
 * Kein Profil → ja. Ein v1-Profil, das als übersprungen markiert ist und keinen
 * Zweck trägt, kann ein Fehlklick gewesen sein → einmalig erneut fragen; wer
 * dann wieder „Später" wählt, bekommt ein v2-Profil und wird nie wieder gefragt.
 */
export function shouldAskForProfile(p: ProjectProfile | null | undefined): boolean {
  if (!p) return true;
  return (p.version ?? 1) < PROFILE_VERSION && !!p.skipped && !p.purpose?.trim();
}

export const CONTENT_TYPES: { value: ProfileContentType; label: string }[] = [
  { value: "reel",     label: "Reel / Kurzvideo" },
  { value: "portrait", label: "Portrait / Charakter" },
  { value: "product",  label: "Produkt / Werbung" },
  { value: "story",    label: "Story mit Handlung" },
  { value: "other",    label: "Sonstiges" },
];

/**
 * Kontextblock, der jedem KI-Vorschlags-Prompt vorangestellt wird, damit
 * Vorschläge überall zum Projekt passen. Leerer String, wenn kein (echtes)
 * Profil vorliegt → dann verhält sich alles wie bisher (generisch).
 */
export function buildProfilePreamble(
  p: ProjectProfile | null | undefined,
  opts: { includeLanguage?: boolean } = {},
): string {
  if (!p || !p.completed || p.skipped) return "";
  const ct = CONTENT_TYPES.find((c) => c.value === p.contentType)?.label;
  // `includeLanguage: false` für Prompts, die ihre Ausgabesprache bereits selbst
  // festlegen (Storyboard: `outputLanguage`). Zwei Sprachangaben im selben
  // Prompt wären ein Widerspruch, den das Modell irgendwie auflösen müsste.
  const withLanguage = opts.includeLanguage !== false;
  const lines = [
    "KONTEXT (Projekt-Profil — richte deinen Vorschlag genau daran aus):",
    p.purpose ? `- Ziel des Projekts: ${p.purpose}` : "",
    ct ? `- Content-Typ: ${ct}` : "",
    withLanguage && p.language ? `- Sprache der Ausgabe: ${p.language}` : "",
  ].filter(Boolean);
  // Sauberer Abstand zur nachfolgenden Aufgabe (sonst klebt "…Deutsch" am Prompt).
  return lines.join("\n") + "\n\n";
}

/** Mappt das Profil auf Pro-Seite-Voreinstellungen (Format je Content-Typ, Sprache). */
export function profileToDefaults(p: ProjectProfile | null | undefined): Record<string, unknown> {
  if (!p || !p.completed || p.skipped) return {};
  const out: Record<string, unknown> = {};
  const aspectByType: Record<ProfileContentType, string | undefined> = {
    reel: "9:16", story: "9:16", portrait: "4:5", product: "1:1", other: undefined,
  };
  const aspect = p.contentType ? aspectByType[p.contentType] : undefined;
  if (aspect) {
    for (const k of ["quick:aspectRatio", "studio:aspect", "story:aspect", "poses:aspectRatio", "views:aspectRatio", "chat:aspect", "remix:aspectRatio"]) {
      out[k] = aspect;
    }
  }
  if (p.language) out["story:language"] = p.language;
  return out;
}

/**
 * Seedet die Voreinstellungs-Keys EINMAL — überschreibt nie eine spätere
 * Nutzer-Änderung (nur undefined-Keys werden gesetzt).
 */
export function applyProfileDefaults(projectId: string, p: ProjectProfile): void {
  const st = (loadProject(projectId)?.state ?? {}) as { values?: Record<string, unknown> };
  const values = { ...(st.values ?? {}) };
  for (const [k, v] of Object.entries(profileToDefaults(p))) {
    if (values[k] === undefined) values[k] = v;
  }
  saveProjectState(projectId, { ...st, values });
}
