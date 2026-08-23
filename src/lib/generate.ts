/**
 * Provider-agnostische Generierung mit Fallback.
 *
 * `chain` ist eine geordnete Liste [bevorzugt, andere] von { provider, key }
 * (aus useSettings.genChain). Der erste Provider wird versucht; schlägt er fehl
 * (Fehler) ODER ist kein Key gesetzt, wird der nächste versucht. So gilt:
 *   Settings-Provider = primär, der andere = Fallback (bei Fehler/fehlendem Key).
 *
 * Google-Bild/Text laufen client-seitig direkt über Gemini; fal-Bild/Text über
 * den Server-Proxy (nano-banana / any-llm).
 */

import { AIError, extractJson, geminiGenerateImage, geminiText } from "@/lib/ai";
import { serverGenerateImageFal, serverGenerateTextFal, type ImageRef } from "@/lib/serverAI";

export type GenProvider = "google" | "fal";
export interface GenLink { provider: GenProvider; key: string; }

function noKey(): AIError {
  return new AIError(
    "NO_KEY",
    "Kein API-Key hinterlegt.",
    "Öffne die Einstellungen und füge einen Google- oder fal.ai-Key ein.",
  );
}

/** Anzeigename eines Anbieters — so, wie er in den Einstellungen heißt. */
function providerLabel(p: GenLink["provider"]): string {
  return p === "fal" ? "fal.ai" : "Google";
}

/**
 * Der Fehler, der übrig bleibt, wenn die GANZE Kette gescheitert ist.
 *
 * Vorher überschrieb jeder Versuch den vorigen (`lastErr = e`), und übrig blieb
 * allein der Fehler des ZULETZT probierten Anbieters. Bei zwei hinterlegten Keys
 * ist das aktiv irreführend: scheitert Google an einem Inhaltsfilter und danach
 * fal an seinem Key, liest der Nutzer „API-Key ungültig" — und prüft einen Key,
 * der nie das Problem war. Genau diese Meldung kam als „sagt ungültig, obwohl
 * sie gültig sind" zurück.
 *
 * Jetzt steht bei jedem Fehler dabei, WER ihn geliefert hat. Bei nur einem
 * Anbieter bleibt der Originalfehler unverändert — samt Code und Hinweis, an
 * denen andere Stellen der App hängen.
 */
function chainError(fails: { provider: GenLink["provider"]; err: unknown }[]): unknown {
  if (fails.length === 0) return noKey();
  if (fails.length === 1) return fails[0].err;
  const parts = fails.map((f) => `${providerLabel(f.provider)}: ${(f.err as any)?.message || String(f.err)}`);
  return new AIError(
    (fails[fails.length - 1].err as any)?.code ?? "UNKNOWN",
    `Beide Anbieter haben abgelehnt — ${parts.join(" · ")}`,
    "Die Meldung nennt jetzt den Anbieter. Prüfe in den Einstellungen den Key, der dort davorsteht.",
  );
}

export interface GenerateImageArgs {
  prompt: string;
  references?: ImageRef[];
  aspectRatio?: string;
}

export async function generateImage(chain: GenLink[], args: GenerateImageArgs): Promise<string> {
  if (!chain.length) throw noKey();
  const fails: { provider: GenLink["provider"]; err: unknown }[] = [];
  for (const link of chain) {
    if (!link.key) continue;
    try {
      if (link.provider === "fal") {
        return await serverGenerateImageFal({
          prompt: args.prompt, apiKey: link.key, references: args.references, aspectRatio: args.aspectRatio,
        });
      }
      return await geminiGenerateImage({
        prompt: args.prompt, references: args.references, apiKey: link.key, aspectRatio: args.aspectRatio,
      });
    } catch (e) {
      fails.push({ provider: link.provider, err: e });
      // nächster Provider (Fallback)
    }
  }
  throw chainError(fails);
}

export interface GenerateTextArgs {
  prompt: string;
  model?: string;
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  /** Bilder, die das Modell ansehen soll. Siehe `geminiText`. */
  images?: { mimeType: string; base64: string }[];
}

export async function generateText(chain: GenLink[], args: GenerateTextArgs): Promise<string> {
  if (!chain.length) throw noKey();
  // Mit Bildern kommt nur der Google-Weg in Frage: der fal-Text-Proxy nimmt
  // ausschliesslich einen Prompt entgegen. Liesse man ihn in der Kette, würde er
  // die Bilder stillschweigend verwerfen und eine erfundene Antwort liefern —
  // schlimmer als ein Fehler, weil sie plausibel aussieht.
  const usable = args.images?.length ? chain.filter((l) => l.provider !== "fal") : chain;
  if (!usable.length) {
    throw new AIError(
      "NO_KEY",
      "Für das Auslesen eines Bildes wird der Google-Key gebraucht.",
      "Trage ihn in den Einstellungen ein — der fal-Zugang kann keine Bilder ansehen.",
    );
  }
  const fails: { provider: GenLink["provider"]; err: unknown }[] = [];
  for (const link of usable) {
    if (!link.key) continue;
    try {
      const text = link.provider === "fal"
        ? await serverGenerateTextFal({ prompt: args.prompt, apiKey: link.key, model: args.model })
        : await geminiText({
            prompt: args.prompt, apiKey: link.key, model: args.model,
            temperature: args.temperature, maxOutputTokens: args.maxOutputTokens, json: args.json,
            images: args.images,
          });
      // Bei json-Modus sicherstellen, dass die Antwort parsebar ist — sonst wirft
      // extractJson und wir fallen auf den nächsten Provider zurück (z. B. fal
      // liefert kaputtes JSON-Storyboard → Google übernimmt).
      if (args.json) extractJson(text);
      return text;
    } catch (e) {
      fails.push({ provider: link.provider, err: e });
    }
  }
  throw chainError(fails);
}
