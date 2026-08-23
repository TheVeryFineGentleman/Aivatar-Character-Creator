/**
 * Der Prompt-Bau für „gib mir 3 Vorschläge" — EINE Stelle für die ganze App.
 *
 * Vorher baute jede Aufrufstelle ihren Vorschlags-Prompt selbst; die Qualität
 * hing davon ab, wie sorgfältig der jeweilige Satz formuliert war. Hier steht
 * das Regelwerk (kurz, unterschiedlich, direkt einsetzbar, kein Meta-Gerede)
 * genau einmal — die Aufrufstellen sagen nur noch, WOFÜR die Vorschläge sind.
 *
 * Der Projekt-Profil-Kontext kommt weiterhin zentral aus useAiSuggestions davor,
 * damit jeder Vorschlag zum Thema des Projekts passt.
 */

export const DEFAULT_SUGGEST_COUNT = 3;

export interface SuggestSpec {
  /**
   * "value"       → Vorschläge FÜR den Feldwert (Outfit, Ort, Idee …).
   * "instruction" → Vorschläge, was der KI-Assistent tun könnte („Mach den
   *                 Einstieg schärfer") — der Nutzer gibt dort einen Auftrag ein,
   *                 keinen Inhalt. Ein Wert-Vorschlag wäre hier unbrauchbar.
   */
  kind?: "value" | "instruction";
  /** Wofür — in natürlicher Sprache, z. B. „ein Outfit für die Posen-Reihe". */
  what: string;
  /** Form/Länge der Vorschläge, z. B. „wenige Worte" oder „1–2 Sätze". */
  shape?: string;
  /** Aktueller Feldwert — wird ausgeschlossen, damit Vorschläge etwas Neues bringen. */
  current?: string;
  /**
   * Was eben schon vorgeschlagen wurde und nicht wiederkommen soll.
   *
   * Ohne diese Liste bekommt das Modell beim Nachfordern buchstäblich denselben
   * Prompt wie beim ersten Mal — und antwortet dann auch oft gleich. „Neue
   * Vorschläge" wäre ein Knopf, der Geld kostet und nichts ändert.
   */
  avoid?: string[];
  /** Weiterer Kontext der Seite (Modus, Stil, bereits gewählte Werte …). */
  context?: string;
  count?: number;
}

/** Baut den Vorschlags-Prompt. Antwortformat ist immer ein JSON-String-Array. */
export function buildSuggestPrompt(spec: SuggestSpec): string {
  const n = spec.count ?? DEFAULT_SUGGEST_COUNT;
  const instruction = spec.kind === "instruction";

  const task = instruction
    ? `Der Nutzer schreibt in ein Eingabefeld einen AUFTRAG an dich als KI-Assistent. Das Feld dient dazu: ${spec.what}
Schlage genau ${n} Aufträge vor, die er dort eingeben könnte.`
    : `Schlage genau ${n} Möglichkeiten für ${spec.what} vor.`;

  const rules = [
    instruction
      ? "Jeder Vorschlag ist eine direkte Anweisung an die KI (Imperativ), sofort abschickbar"
      : "Jeder Vorschlag ist direkt in das Feld übernehmbar — fertiger Inhalt, keine Anweisung",
    spec.shape ?? (instruction ? "höchstens 8 Wörter" : "kurz und konkret"),
    "Deutlich unterschiedlich voneinander — keine Varianten desselben Gedankens",
    "Passend zum Projekt-Profil oben; wenn dort nichts steht, allgemein sinnvoll",
    "Keine Nummerierung, keine Anführungszeichen, keine Erklärungen, kein Meta-Kommentar",
    spec.current?.trim()
      ? `Nicht wiederholen, das steht schon im Feld: "${spec.current.trim().slice(0, 300)}"`
      : "",
    spec.avoid?.length
      ? `Diese Vorschläge kamen gerade schon — bring andere Ideen, keine Umformulierungen davon: ${spec.avoid
          .slice(0, 12)
          .map((s) => `"${s.trim().slice(0, 160)}"`)
          .join(", ")}`
      : "",
  ].filter(Boolean);

  return [
    task,
    "",
    "REGELN:",
    ...rules.map((r) => `- ${r}`),
    spec.context?.trim() ? `\nKONTEXT DER SEITE:\n${spec.context.trim()}` : "",
    "",
    `Antworte NUR mit einem JSON-Array aus genau ${n} Strings, sonst nichts.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** Model-Antwort → saubere Vorschlagsliste (leere/doppelte raus, auf n gekürzt). */
export function parseSuggestions(raw: unknown, count = DEFAULT_SUGGEST_COUNT): string[] {
  const arr = Array.isArray(raw)
    ? raw
    // Manche Modelle verpacken das Array trotz Anweisung in ein Objekt
    // ({ vorschlaege: [...] }) — das erste Array-Feld ist dann gemeint.
    : raw && typeof raw === "object"
      ? (Object.values(raw as Record<string, unknown>).find(Array.isArray) as unknown[] | undefined) ?? []
      : [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    // Trotz „Array aus Strings" liefern Modelle gelegentlich Objekte
    // ({ text: "…" }). Ohne diesen Griff stünde „[object Object]" im Feld.
    const value = item && typeof item === "object"
      ? Object.values(item as Record<string, unknown>).find((v) => typeof v === "string")
      : item;
    const s = String(value ?? "").trim().replace(/^["'\s•\-–]+|["'\s]+$/g, "");
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= count) break;
  }
  return out;
}

/**
 * Vorschläge werden pro Feld gecacht, weil sie sonst bei jedem Re-Mount (Tab-
 * Wechsel, aufklappendes Panel) neu generiert würden — jedes Mal ein bezahlter
 * API-Call für dasselbe Feld. Modul-Ebene, absichtlich nicht persistiert: über
 * eine Sitzung hinaus sollen Vorschläge ruhig wieder frisch sein.
 */
function makeCache<T>(isEmpty: (v: T) => boolean) {
  const cache = new Map<string, T>();
  /**
   * Laufende Anfragen pro Key. React läuft unter StrictMode, Effekte feuern im
   * Dev also doppelt — ohne diesen Riegel kostete jedes Feld beim Aufbau zwei
   * Calls.
   */
  const inflight = new Map<string, Promise<T>>();
  return {
    get: (key: string) => cache.get(key),
    set: (key: string, value: T) => void cache.set(key, value),
    clear: (key: string) => void cache.delete(key),
    /** Holt genau einmal pro Key; parallele Aufrufer teilen sich dasselbe Ergebnis. */
    load(key: string, fetcher: () => Promise<T>): Promise<T> {
      const running = inflight.get(key);
      if (running) return running;
      const p = fetcher()
        .then((value) => {
          // Leeres Ergebnis nicht cachen — sonst bliebe ein einmaliger Fehler
          // (Netz, Rate-Limit) für den Rest der Sitzung als „keine Vorschläge" stehen.
          if (!isEmpty(value)) cache.set(key, value);
          return value;
        })
        .finally(() => void inflight.delete(key));
      inflight.set(key, p);
      return p;
    },
  };
}

export const suggestionCache = makeCache<string[]>((v) => v.length === 0);
export const groupSuggestionCache = makeCache<Record<string, string[]>>(
  (v) => Object.keys(v).length === 0,
);

/** Ein Feld innerhalb einer Gruppen-Anfrage. */
export interface SuggestField {
  /** Schlüssel im Antwort-JSON — auch der Schlüssel, unter dem abgefragt wird. */
  key: string;
  what: string;
  shape?: string;
  current?: string;
}

/**
 * Vorschläge für MEHRERE Felder in einem einzigen Call.
 *
 * Panels wie die Reel-Situation haben vier Felder, die zusammen EINE Szene
 * beschreiben. Vier Einzelanfragen wären nicht nur vier Mal so teuer, sie
 * wüssten auch nichts voneinander — Outfit und Ort passten dann rein zufällig
 * zusammen. Ein Call sieht alle Felder gleichzeitig.
 */
export function buildGroupSuggestPrompt(
  fields: SuggestField[],
  opts: { count?: number; context?: string } = {},
): string {
  const n = opts.count ?? DEFAULT_SUGGEST_COUNT;
  const shape = (f: SuggestField) => f.shape ?? "kurz und konkret";
  return [
    `Schlage für jedes der folgenden Felder genau ${n} Möglichkeiten vor.`,
    "",
    "FELDER:",
    ...fields.map((f) => {
      const current = f.current?.trim()
        ? ` — steht schon drin und darf nicht wiederholt werden: "${f.current.trim().slice(0, 200)}"`
        : "";
      return `- "${f.key}": ${f.what} (${shape(f)})${current}`;
    }),
    "",
    "REGELN:",
    "- Jeder Vorschlag ist direkt in das Feld übernehmbar — fertiger Inhalt, keine Anweisung",
    "- Innerhalb eines Felds deutlich unterschiedlich voneinander",
    "- Über die Felder hinweg stimmig: Vorschlag 1 aller Felder passt zusammen, ebenso 2 und 3",
    "- Passend zum Projekt-Profil oben; wenn dort nichts steht, allgemein sinnvoll",
    "- Keine Nummerierung, keine Anführungszeichen, keine Erklärungen",
    opts.context?.trim() ? `\nKONTEXT DER SEITE:\n${opts.context.trim()}` : "",
    "",
    `Antworte NUR mit einem JSON-Objekt: {${fields
      .map((f) => `"${f.key}": [${n} Strings]`)
      .join(", ")}}`,
  ].join("\n");
}

export function parseGroupSuggestions(
  raw: unknown,
  fields: SuggestField[],
  count = DEFAULT_SUGGEST_COUNT,
): Record<string, string[]> {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: Record<string, string[]> = {};
  for (const f of fields) {
    const list = parseSuggestions(obj[f.key], count);
    if (list.length) out[f.key] = list;
  }
  return out;
}
