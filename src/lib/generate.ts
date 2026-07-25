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

import { AIError, geminiGenerateImage, geminiText } from "@/lib/ai";
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

export interface GenerateImageArgs {
  prompt: string;
  references?: ImageRef[];
  aspectRatio?: string;
}

export async function generateImage(chain: GenLink[], args: GenerateImageArgs): Promise<string> {
  if (!chain.length) throw noKey();
  let lastErr: unknown;
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
      lastErr = e;
      // nächster Provider (Fallback)
    }
  }
  throw lastErr ?? noKey();
}

export interface GenerateTextArgs {
  prompt: string;
  model?: string;
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export async function generateText(chain: GenLink[], args: GenerateTextArgs): Promise<string> {
  if (!chain.length) throw noKey();
  let lastErr: unknown;
  for (const link of chain) {
    if (!link.key) continue;
    try {
      if (link.provider === "fal") {
        return await serverGenerateTextFal({ prompt: args.prompt, apiKey: link.key, model: args.model });
      }
      return await geminiText({
        prompt: args.prompt, apiKey: link.key, model: args.model,
        temperature: args.temperature, maxOutputTokens: args.maxOutputTokens, json: args.json,
      });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? noKey();
}
