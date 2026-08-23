/**
 * Vorschläge für eine ganze Feldgruppe — ein Call für alle Felder eines Panels.
 *
 * Gedacht für Bereiche, in denen mehrere Felder zusammen EINE Sache beschreiben
 * (Reel-Situation: Tätigkeit/Ort/Outfit/Kamera). Getrennte Anfragen wären teurer
 * und inhaltlich blind füreinander; hier sieht das Modell alle Felder auf einmal
 * und liefert Vorschläge, die zueinander passen.
 *
 * Das gilt für den ERSTEN Lauf. Danach gehört jeder Stern nur noch seinem Feld:
 * `reroll("outfit")` holt Vorschläge für genau dieses Feld nach und lässt die
 * Nachbarn stehen. Vorher zog jeder Stern die ganze Gruppe neu — man wollte
 * einen anderen Hook und bekam dazu ungefragt neue Details und einen neuen CTA,
 * inklusive „Lädt…" in Feldern, die man gar nicht angefasst hatte. Damit das
 * einzelne Feld trotzdem nicht aus der Reihe tanzt, bekommt es die bereits
 * gefüllten Nachbarfelder als Kontext mit (`siblingContext`).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAiSuggestions } from "@/hooks/useAiSuggestions";
import {
  buildGroupSuggestPrompt,
  parseGroupSuggestions,
  groupSuggestionCache,
  DEFAULT_SUGGEST_COUNT,
  type SuggestField,
} from "@/lib/aiSuggest";

interface Opts {
  context?: string;
  count?: number;
  /** false = erst laden, wenn `reroll()` gerufen wird. */
  auto?: boolean;
}

/** Eine gemeinsame leere Referenz — ein frisches `{}` pro Lauf würde den
 *  Effekt unten bei jedem Render neu auslösen. */
const EMPTY: Record<string, string[]> = {};

/** Was in den Nachbarfeldern schon steht — sonst schlüge das einzeln
 *  nachgeladene Feld einen Abendkleid-Look fürs Fitnessstudio vor. */
function siblingContext(fields: SuggestField[], key: string): string {
  const filled = fields.filter((f) => f.key !== key && f.current?.trim());
  if (!filled.length) return "";
  return [
    "Bereits festgelegt — der Vorschlag muss dazu passen:",
    ...filled.map((f) => `- ${f.what}: ${f.current!.trim().slice(0, 200)}`),
  ].join("\n");
}

export function useFieldSuggestions(cacheKey: string, fields: SuggestField[], opts: Opts = {}) {
  const { run, runMany, hasGenKey } = useAiSuggestions();
  const [groups, setGroups] = useState<Record<string, string[]>>(
    () => groupSuggestionCache.get(cacheKey) ?? EMPTY,
  );
  const [loading, setLoading] = useState(false);
  /** Welche Felder gerade einzeln nachladen — nur die zeigen „Lädt…". */
  const [busyKeys, setBusyKeys] = useState<Record<string, boolean>>({});
  // Feldliste und Kontext ändern sich bei jedem Tastendruck (sie tragen den
  // aktuellen Wert) — als Effekt-Deps würden sie eine Endlosschleife auslösen.
  const latest = useRef({ fields, opts });
  latest.current = { fields, opts };
  /** Die zuletzt gezeigten Vorschläge — als Ref, damit `loadOne` sie lesen kann,
   *  ohne bei jeder neuen Liste eine neue Funktion zu werden. */
  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const load = useCallback(
    async (force = false) => {
      if (!hasGenKey) return;
      if (force) groupSuggestionCache.clear(cacheKey);
      else if (groupSuggestionCache.get(cacheKey)) return;
      const { fields: f, opts: o } = latest.current;
      const count = o.count ?? DEFAULT_SUGGEST_COUNT;
      setLoading(true);
      try {
        const values = await groupSuggestionCache.load(cacheKey, async () => {
          const raw = await run<unknown>({
            prompt: buildGroupSuggestPrompt(f, { count, context: o.context }),
            json: true,
            temperature: 1,
          });
          return raw == null ? {} : parseGroupSuggestions(raw, f, count);
        });
        if (Object.keys(values).length) setGroups(values);
      } finally {
        setLoading(false);
      }
    },
    [cacheKey, hasGenKey, run],
  );

  /** Ein einzelnes Feld nachladen — der Weg jedes Sterns. */
  const loadOne = useCallback(
    async (key: string) => {
      if (!hasGenKey) return;
      const { fields: f, opts: o } = latest.current;
      const field = f.find((x) => x.key === key);
      if (!field) return;
      setBusyKeys((b) => ({ ...b, [key]: true }));
      try {
        const values = await runMany({
          what: field.what,
          shape: field.shape,
          current: field.current,
          // Der Stern heißt „neue Vorschläge", nicht „dieselben nochmal".
          avoid: groupsRef.current[key],
          count: o.count ?? DEFAULT_SUGGEST_COUNT,
          context: [o.context?.trim(), siblingContext(f, key)].filter(Boolean).join("\n"),
        });
        if (!values.length) return;
        setGroups((prev) => ({ ...prev, [key]: values }));
        // Nur in den Cache schreiben, wenn die Gruppe dort schon steht: sonst
        // hielte ein einzelnes Feld den Erstlauf für erledigt und die übrigen
        // Felder blieben für den Rest der Sitzung leer.
        const cached = groupSuggestionCache.get(cacheKey);
        if (cached) groupSuggestionCache.set(cacheKey, { ...cached, [key]: values });
      } finally {
        setBusyKeys((b) => {
          const next = { ...b };
          delete next[key];
          return next;
        });
      }
    },
    [cacheKey, hasGenKey, runMany],
  );

  // `load` bewusst NICHT in den Deps, sondern über eine Ref: hinge der Effekt an
  // der Funktion, würde jede unbemerkte Instabilität weiter oben (genChain,
  // Profil) hier zu einem Effekt-Lauf pro Render — und damit zu bezahlten Calls
  // im Sekundentakt. Der Effekt soll genau zwei Auslöser haben: anderes Feld
  // (cacheKey) oder Umschalten von auto.
  const loadRef = useRef(load);
  loadRef.current = load;

  const auto = opts.auto !== false;
  useEffect(() => {
    const cached = groupSuggestionCache.get(cacheKey);
    if (cached) { setGroups(cached); return; }
    setGroups(EMPTY);
    if (auto) void loadRef.current();
    // `hasGenKey` gehört dazu, damit ein nachträglich eingetragener API-Key die
    // Vorschläge sofort nachlädt, statt erst beim nächsten Seitenwechsel.
  }, [cacheKey, auto, hasGenKey]);

  return {
    get: (key: string) => groups[key] ?? [],
    /** Lädt gerade für DIESES Feld? Der Erstlauf zählt für alle, danach nur noch
     *  das Feld, dessen Stern gedrückt wurde. */
    busy: (key: string) => loading || !!busyKeys[key],
    loading,
    hasGenKey,
    /** Mit Key: nur dieses Feld. Ohne Key: die ganze Gruppe (Erstlauf). */
    reroll: (key?: string) => void (key ? loadOne(key) : load(true)),
  };
}
