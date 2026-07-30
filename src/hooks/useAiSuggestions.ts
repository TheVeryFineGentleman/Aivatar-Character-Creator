/**
 * Ein einziger, wiederverwendbarer KI-Vorschlags-Mechanismus — kapselt das
 * bisher 5× duplizierte Muster aus Story/Studio (hasGenKey-Guard →
 * generateText(genChain) → parse/trim → toast.error(AIError)).
 *
 * Der Projekt-Profil-Kontext wird ZENTRAL vor jeden Prompt gehängt, sodass jeder
 * Vorschlag automatisch zum Profil passt — ohne dass die Aufrufstellen es wissen.
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useSettings } from "@/hooks/useSettings";
import { useProjectProfile } from "@/hooks/useProjectProfile";
import { buildProfilePreamble } from "@/lib/projectProfile";
import { generateText } from "@/lib/generate";
import { AIError, extractJson } from "@/lib/ai";

interface RunOpts<T> {
  prompt: string;
  /** JSON erzwingen (auch implizit, wenn `parse` gesetzt ist). */
  json?: boolean;
  parse?: (v: unknown) => T;
  /** false = Profil-Kontext NICHT voranstellen (z. B. beim Profil-Setup selbst). */
  useProfile?: boolean;
  temperature?: number;
}

export function useAiSuggestions() {
  const { genChain, hasGenKey } = useSettings();
  const [profile] = useProjectProfile();
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async function run<T = string>(opts: RunOpts<T>): Promise<T | null> {
      if (!hasGenKey) {
        toast.error("Bitte hinterlege zuerst deinen API-Key (Einstellungen).");
        return null;
      }
      setLoading(true);
      try {
        const preamble = opts.useProfile === false ? "" : buildProfilePreamble(profile);
        const json = !!opts.json || !!opts.parse;
        const raw = await generateText(genChain, {
          prompt: preamble + opts.prompt,
          json,
          temperature: opts.temperature,
        });
        if (json) {
          const parsed = extractJson(raw);
          return (opts.parse ? opts.parse(parsed) : parsed) as T;
        }
        return raw.trim() as T;
      } catch (e: any) {
        const err = e instanceof AIError ? e : new AIError("UNKNOWN", e?.message || "Vorschlag fehlgeschlagen.");
        toast.error(err.message);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [genChain, hasGenKey, profile],
  );

  return { run, loading, hasGenKey };
}
