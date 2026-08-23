/**
 * DER EINSTELLUNGS-ABGLEICH.
 *
 * Wozu: Die Reel-Einstellungen hängen voneinander ab, aber die UI behandelt sie
 * als unabhängige Schalter. Wer den Aktions-Level auf „Ruhig reden" stellt, hat
 * danach immer noch den Hook im Feld stehen, den er im lauten Modus schreiben
 * ließ — „Deine Schulterschmerzen sind KEIN Zufall, sondern DEINE Schuld!". Das
 * Storyboard nimmt ihn wortgleich als erste Zeile, und die Umstellung wirkt
 * halb. Genau das war der Befund (Nutzer, 2026-08-16).
 *
 * Statt jede Abhängigkeit von Hand zu verdrahten (sechs Schalter × zehn Felder),
 * fragt der Abgleich EINMAL das Modell: „Das wurde umgestellt, hier sind ALLE
 * aktuellen Optionen und alle Feldwerte — was passt jetzt nicht mehr?"
 *
 * WAS ER NICHT DARF: die STORY anfassen. Weder die Idee noch die erzeugten
 * Szenen. Das ist an vier voneinander unabhängigen Stellen gesichert:
 *   1. `SyncFieldKey` ist eine geschlossene Union ohne `idea`/`scenes` — der
 *      Setter-Tisch in StoryPage ist ein `Record<SyncFieldKey, …>`, ein Eintrag
 *      dafür wäre ein Compile-Fehler.
 *   2. `parseSettingsSync` läuft über den erlaubten `scope`, NICHT über die
 *      Antwort des Modells. Ein zurückgeliefertes „idea" existiert nach dem
 *      Parsen nicht mehr.
 *   3. `SyncSnapshot` enthält die Szenen gar nicht — nur ihre ANZAHL. Das
 *      Modell kann nicht umschreiben, was es nie gesehen hat.
 *   4. Übernommen wird nur, was der Nutzer im Dialog angehakt hat.
 */
import type { ReelSituation, ReelStyle, ActionLevel, DuoStaging, StoryMode } from "./storyPrompts";
import { STORY_MOOD_OPTIONS, STORY_PACING_OPTIONS, getLanguageName } from "./storyPrompts";

/** Die Felder, die der Abgleich überhaupt schreiben darf. */
export type SyncFieldKey =
  | "hook"
  | "cta"
  | "customDetails"
  | "mainLocation"
  | "videoMood"
  | "pacing"
  | "situation.activity"
  | "situation.setting"
  | "situation.outfit"
  | "situation.cameraSetup";

/** Die Umschaltungen, die einen Abgleich anbieten. */
export type SyncTriggerKey =
  | "actionLevel"
  | "reelStyle"
  | "duoStaging"
  | "voiceMode"
  | "enableSpeaker"
  | "language";

export interface SyncTrigger {
  key: SyncTriggerKey;
  /** Deutsches Label des Schalters, z. B. „Wie tritt die Person auf?". */
  title: string;
  /** Der alte und der neue Wert als deutsches Label — beide stehen im Dialog. */
  fromLabel: string;
  toLabel: string;
}

/**
 * WELCHER Auslöser WELCHE Felder anfassen darf.
 *
 * Bewusst eng: Ein Wechsel der Erzählform ist kein Grund, die Stimmung
 * umzuschreiben. Je größer der Scope, desto mehr Zeilen muss der Nutzer prüfen —
 * und desto wahrscheinlicher hakt er sie ungelesen ab.
 */
export const SYNC_SCOPE: Record<SyncTriggerKey, SyncFieldKey[]> = {
  // Der Aktions-Level steuert Ton UND Gestik: Hook/CTA/Details tragen den Ton,
  // Stimmung und Tempo die Inszenierung, die Tätigkeit die Hände.
  actionLevel: ["hook", "cta", "customDetails", "videoMood", "pacing", "situation.activity"],
  // Vlog ↔ Erzähler: Der Vlog braucht EINE durchgehende Situation, der Erzähler
  // wechselt pro Szene das Setting. Der Ort und die Situation sind betroffen.
  reelStyle: ["hook", "cta", "customDetails", "mainLocation", "situation.activity", "situation.setting", "situation.cameraSetup"],
  // Miteinander ↔ Zum Zuschauer ändert, WEN die Zeilen ansprechen.
  duoStaging: ["hook", "cta", "customDetails"],
  voiceMode: ["hook", "cta", "customDetails"],
  enableSpeaker: ["hook", "cta"],
  // Sprachwechsel: alle sichtbaren Freitexte werden in der neuen Sprache neu
  // formuliert. `language` selbst ist nie ein Zielfeld.
  language: ["hook", "cta", "customDetails", "mainLocation", "situation.activity", "situation.setting", "situation.outfit", "situation.cameraSetup"],
};

/** Deutsches Label + Erwartung je Feld — für den Prompt UND die Dialogzeile. */
export const SYNC_FIELDS: Record<SyncFieldKey, { label: string; what: string }> = {
  hook: { label: "Hook", what: "der erste gesprochene Satz des Reels" },
  cta: { label: "Call-to-Action", what: "der letzte gesprochene Satz — genau EINE Handlung" },
  customDetails: { label: "Custom Details", what: "Zusatzinfos für die KI: Branche, Zielgruppe, Besonderheiten, Tabu-Themen" },
  mainLocation: { label: "Hauptort", what: "der Ort, an dem alle Szenen spielen — wenige Worte" },
  videoMood: { label: "Stimmung", what: "die Grundstimmung des Videos" },
  pacing: { label: "Tempo", what: "der Erzählrhythmus" },
  "situation.activity": { label: "Tätigkeit", what: "was die Person durchgehend tut, während sie spricht" },
  "situation.setting": { label: "Ort der Situation", what: "EIN konkreter Ort, an dem das ganze Reel spielt" },
  "situation.outfit": { label: "Outfit", what: "was die Person trägt, über alle Szenen identisch" },
  "situation.cameraSetup": { label: "Kameraaufbau", what: "wie die Kamera steht — ohne Winkel- oder Ausschnittsangabe" },
};

/**
 * Auswahlfelder mit ihren erlaubten Werten. Vorbild ist `ASSIST_ENUM_FIELDS` im
 * Szenen-Assistenten: Das Modell darf hier nur treffen, nicht erfinden — ein
 * unbekannter Wert wird verworfen statt geraten.
 */
export const SYNC_ENUM_FIELDS: Partial<Record<SyncFieldKey, readonly { value: string; label: string }[]>> = {
  videoMood: STORY_MOOD_OPTIONS,
  pacing: STORY_PACING_OPTIONS,
};

/**
 * Der Lesekontext: alle aktuell gewählten Optionen.
 *
 * `idea` ist bewusst dabei — ein Hook, der nicht zur Story passt, wäre wertlos.
 * Sie steht aber NICHT in `SyncFieldKey` und ist damit nur lesbar, nie
 * schreibbar. Die Szenen selbst fehlen ganz; nur ihre Anzahl geht mit.
 */
export interface SyncSnapshot {
  idea: string;
  language: string;
  mode: StoryMode;
  reelStyle: ReelStyle;
  actionLevel: ActionLevel;
  duoStaging: DuoStaging;
  voiceMode: "sprecher" | "dialog";
  enableSpeaker: boolean;
  reelOutro: boolean;
  artStyle: string;
  videoMood: string;
  colorMood: string;
  pacing: string;
  hook: string;
  cta: string;
  customDetails: string;
  mainLocation: string;
  situation: ReelSituation | null;
  characterNames: string[];
  /** NUR die Zahl — nie die Szenen selbst. Siehe Sperre 3 im Dateikopf. */
  sceneCount: number;
}

/** Ein einzelner Vorschlag, wie ihn der Dialog anzeigt. */
export interface SyncProposal {
  key: SyncFieldKey;
  label: string;
  /** Der aktuelle Wert. Leerstring = das Feld war leer. */
  before: string;
  after: string;
  /** EIN Satz, warum das jetzt nicht mehr passt — der Nutzer liest ihn vor dem Zustimmen. */
  reason: string;
}

/** Liest ein Feld aus dem Schnappschuss. Eine Quelle für Prompt und Vergleich. */
export function readSyncField(snapshot: SyncSnapshot, key: SyncFieldKey): string {
  switch (key) {
    case "hook": return snapshot.hook;
    case "cta": return snapshot.cta;
    case "customDetails": return snapshot.customDetails;
    case "mainLocation": return snapshot.mainLocation;
    case "videoMood": return snapshot.videoMood;
    case "pacing": return snapshot.pacing;
    case "situation.activity": return snapshot.situation?.activity ?? "";
    case "situation.setting": return snapshot.situation?.setting ?? "";
    case "situation.outfit": return snapshot.situation?.outfit ?? "";
    case "situation.cameraSetup": return snapshot.situation?.cameraSetup ?? "";
  }
}

const labelOf = (list: readonly { value: string; label: string }[], v: string) =>
  list.find((o) => o.value === v)?.label ?? v;

/**
 * Alle aktuell gewählten Optionen als Klartextliste.
 *
 * Das ist die Antwort auf „passend zu ALLEN aktuell gewählten Optionen": Das
 * Modell soll nicht nur den umgestellten Schalter sehen, sondern das ganze
 * Bild — sonst schreibt es einen ruhigen Hook, der zum Duo-Gespräch nicht passt.
 */
function optionLines(s: SyncSnapshot): string {
  return [
    `- Format: ${s.reelStyle === "vlog" ? "Vlog „Vor der Kamera\" (eine durchgehende Situation, harte Jump Cuts)" : "Erzähler (jede Szene ein neues Setting)"}`,
    `- Auftreten: ${s.actionLevel === "active"
      ? "VIEL AKTION — die Hände arbeiten sichtbar, der Vortrag ist laut und zugespitzt"
      : "RUHIG — die Person redet wie in einem normalen Gespräch, Gesten sind die Ausnahme, kein Rufen, keine Großbuchstaben, keine Ausrufezeichen"}`,
    s.characterNames.length > 1
      ? `- Zwei Personen: ${s.duoStaging === "conversation" ? "reden MITEINANDER, der Zuschauer sieht zu" : "reden ZUM ZUSCHAUER"}`
      : "",
    `- Sprechtext: ${s.enableSpeaker ? (s.voiceMode === "dialog" ? "an, als Dialog mit Sprechernamen" : "an, als durchgehender Vortrag") : "AUS — es wird gar nicht gesprochen"}`,
    `- Sprache aller Texte: ${getLanguageName(s.language)}`,
    `- Stimmung: ${labelOf(STORY_MOOD_OPTIONS, s.videoMood)} · Tempo: ${labelOf(STORY_PACING_OPTIONS, s.pacing)}`,
    s.characterNames.length ? `- Personen: ${s.characterNames.join(", ")}` : "",
    `- Szenenanzahl: ${s.sceneCount || "noch kein Storyboard"}`,
  ].filter(Boolean).join("\n");
}

/**
 * Der Prompt. Aufbau wie beim Szenen-Assistenten: Profil-Vorspann, dann der
 * volle Optionsstand, dann die eine Umstellung, dann die Felder mit ihren
 * aktuellen Werten — und erst zum Schluss die Ausgabevorschrift.
 */
export function buildSettingsSyncPrompt(opts: {
  trigger: SyncTrigger;
  snapshot: SyncSnapshot;
  scope: SyncFieldKey[];
  profileContext?: string;
}): string {
  const { trigger, snapshot, scope } = opts;
  const profileBlock = opts.profileContext?.trim() ? `${opts.profileContext.trim()}\n\n` : "";

  const fieldLines = scope.map((key) => {
    const meta = SYNC_FIELDS[key];
    const current = readSyncField(snapshot, key).trim();
    const enumList = SYNC_ENUM_FIELDS[key];
    const allowed = enumList
      ? `\n    Erlaubte Werte (gib GENAU einen davon zurück): ${enumList.map((o) => `"${o.value}" (${o.label})`).join(" | ")}`
      : "";
    return `- ${key} — ${meta.label}: ${meta.what}\n    Aktuell: ${current ? `"${current}"` : "(leer)"}${allowed}`;
  }).join("\n");

  return `${profileBlock}Du prüfst die Einstellungen eines kurzen, vertikalen Social-Media-Videos, nachdem der Nutzer EINE Einstellung umgestellt hat. Deine Aufgabe ist NICHT, das Video neu zu erfinden — sondern die Felder nachzuziehen, die zur neuen Einstellung nicht mehr passen.

WAS GERADE UMGESTELLT WURDE:
- ${trigger.title}: „${trigger.fromLabel}" → „${trigger.toLabel}"

ALLE AKTUELL GEWÄHLTEN OPTIONEN (danach musst du dich richten — nicht nur nach der Umstellung oben):
${optionLines(snapshot)}

DIE STORY (nur zum Verständnis, sie ist TABU):
- Idee: "${snapshot.idea.trim() || "(noch keine)"}"

DIESE FELDER DARFST DU ÄNDERN:
${fieldLines}

REGELN:
- Gib NUR die Felder zurück, die durch DIESE Umstellung wirklich nicht mehr passen. Ein Feld, das weiterhin stimmt, lässt du weg — auch wenn du es „schöner" formulieren könntest.
- Ein leeres Feld füllst du nur, wenn es durch die Umstellung nötig wird. Leer ist eine gültige Einstellung.
- Die IDEE und die bereits erzeugten Szenen sind TABU. Du änderst weder die Geschichte noch ihren Ablauf, weder Personen noch Namen — nur die Einstellungsfelder oben.
- Schreibe die Werte in derselben Sprache, in der sie jetzt dastehen (bzw. in ${getLanguageName(snapshot.language)}, wenn gerade die Sprache umgestellt wurde). Nur reiner Text, keine Anführungszeichen im Wert, keine Emojis, keine Regieanweisung.
- Zu jedem geänderten Feld gehört ein "reason": EIN kurzer deutscher Satz, warum es jetzt nicht mehr passt. Der Nutzer liest ihn, bevor er zustimmt — schreibe ihn für ihn, nicht für dich.

HARTE AUSGABEREGELN:
- Antworte ausschließlich mit einem einzigen validen JSON-Objekt:
  {"changes": {"<feldname>": {"value": "<neuer wert>", "reason": "<ein satz>"}}}
- Als <feldname> sind AUSSCHLIESSLICH diese erlaubt: ${scope.map((k) => `"${k}"`).join(", ")}
- Ist nichts anzupassen, gib {"changes": {}} zurück.
- Kein Markdown, keine Codeblöcke, keine Erklärung davor oder danach.`;
}

/**
 * Wandelt die Modellantwort in geprüfte Vorschläge.
 *
 * Läuft über den ERLAUBTEN Scope, nicht über die Antwort: Was das Modell
 * zusätzlich zurückschickt, wird nie auch nur angesehen. Verworfen wird
 * außerdem alles, was leer ist, sich nicht vom aktuellen Wert unterscheidet
 * oder (bei Auswahlfeldern) keinen gültigen Wert trifft.
 */
export function parseSettingsSync(
  raw: unknown,
  snapshot: SyncSnapshot,
  scope: SyncFieldKey[],
): SyncProposal[] {
  const changes = (raw as { changes?: unknown } | null)?.changes;
  if (!changes || typeof changes !== "object") return [];
  const map = changes as Record<string, unknown>;

  const out: SyncProposal[] = [];
  for (const key of scope) {
    const entry = map[key];
    if (!entry || typeof entry !== "object") continue;
    const rawValue = (entry as { value?: unknown }).value;
    const rawReason = (entry as { reason?: unknown }).reason;
    if (typeof rawValue !== "string") continue;

    let value = rawValue.trim();
    if (!value) continue;

    // Auswahlfelder: Treffer auf `value` ODER auf das deutsche `label` — das
    // Modell antwortet erfahrungsgemäß mal so, mal so. Kein Treffer heißt
    // verwerfen, nicht raten.
    const enumList = SYNC_ENUM_FIELDS[key];
    if (enumList) {
      const needle = value.toLowerCase();
      const hit = enumList.find(
        (o) => o.value.toLowerCase() === needle || o.label.toLowerCase() === needle,
      );
      if (!hit) continue;
      value = hit.value;
    }

    const before = readSyncField(snapshot, key);
    if (value === before.trim()) continue;

    const reason = typeof rawReason === "string" && rawReason.trim()
      ? rawReason.trim()
      : "Passt nicht mehr zur neuen Einstellung.";

    out.push({ key, label: SYNC_FIELDS[key].label, before, after: value, reason });
  }
  // Reihenfolge wie im Scope — dieselbe wie im Prompt, damit die Liste im Dialog
  // nicht bei jedem Lauf anders sortiert erscheint.
  return out;
}
