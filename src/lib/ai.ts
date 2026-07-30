/**
 * Thin client for Google Gemini (and fal.ai pass-through).
 * Wraps API errors with German user-facing messages that point at the right fix.
 */

import { BACKEND, SUPA_FUNC } from "@/lib/backend";
import type { Provider } from "@/hooks/useSettings";

export class AIError extends Error {
  constructor(public code: number | string, message: string, public hint?: string) {
    super(message);
  }
}

/** Pull the human-readable message out of Google's JSON error envelope. */
function extractApiMessage(raw?: string): string {
  if (!raw) return "";
  try {
    const j = JSON.parse(raw);
    return (j?.error?.message || j?.message || raw).toString().trim();
  } catch {
    return raw.trim();
  }
}

export function explainGeminiError(status: number, raw?: string): AIError {
  if (status === 429) {
    return new AIError(429,
      "Rate limit erreicht – dein API-Key hat das Kontingent ausgeschöpft.",
      "Warte 1–2 Minuten oder aktiviere Billing unter aistudio.google.com.");
  }
  if (status === 401) {
    return new AIError(401,
      "API-Key ungültig oder abgelaufen.",
      "Prüfe deinen Key in den Einstellungen — neu erstellen auf aistudio.google.com.");
  }
  if (status === 403) {
    return new AIError(403,
      "Zugriff verweigert – Billing nicht aktiviert.",
      "Aktiviere Billing in deinem Google-Konto (aistudio.google.com).");
  }
  if (status >= 500) {
    return new AIError(status, "Google Gemini ist gerade nicht erreichbar.", "Bitte später nochmal versuchen.");
  }
  // Other 4xx — surface Google's own (English) message. Callers may run it
  // through translateErrorToGerman() before showing it to the user.
  return new AIError(status, extractApiMessage(raw) || `Unerwarteter Fehler (${status}).`);
}

// ── German fallbacks for the most common Google API error phrases ──────────
// Used when a live translation isn't possible (e.g. the key itself is the
// problem, so we can't call the model to translate the message).
const ERROR_PHRASES: Array<[RegExp, string]> = [
  [/api key not valid|invalid api key|api_key_invalid/i, "API-Key ungültig."],
  [/quota|exceeded your current quota|resource has been exhausted|rate limit/i, "Kontingent erschöpft – Rate-Limit erreicht."],
  [/permission denied|not authorized|unauthorized|forbidden/i, "Zugriff verweigert."],
  [/billing/i, "Abrechnung (Billing) ist nicht aktiviert."],
  [/internal error|internal server error/i, "Interner Serverfehler bei Google."],
  [/(service )?unavailable|overloaded|model is overloaded|try again later/i, "Dienst momentan überlastet – bitte später erneut versuchen."],
  [/deadline exceeded|timed? ?out|timeout/i, "Zeitüberschreitung bei der Anfrage."],
  [/safety|blocked|prohibited content|policy/i, "Aus Sicherheitsgründen blockiert."],
  [/recitation/i, "Wegen möglicher Urheberrechts-Überschneidung blockiert."],
  [/not found|404|was not found/i, "Ressource oder Modell nicht gefunden."],
  [/invalid argument|bad request/i, "Ungültige Anfrage."],
];

function germanFallback(text: string): string {
  for (const [re, de] of ERROR_PHRASES) if (re.test(text)) return de;
  return text; // last resort: return the original (still better than nothing)
}

/**
 * Translate a (usually English) API error message into German.
 *
 * Tries a precise live translation with the cheap lite model first; if that
 * isn't possible — e.g. the error IS an auth/quota problem so the key can't be
 * used — it falls back to a static phrase dictionary, then to the raw text.
 * Messages that already look German are returned untouched.
 */
export async function translateErrorToGerman(text: string, apiKey: string): Promise<string> {
  const src = (text || "").trim();
  if (!src) return "Unbekannter Fehler bei der Bild-Generierung.";

  // Already German? (umlauts / ß, or a clearly-German keyword) → leave as-is.
  if (/[äöüß]/i.test(src) ||
      /\b(der|die|das|nicht|kein|hat|wird|Fehler|Kontingent|ungültig|Zugriff|blockiert|erreicht|geliefert|verfügbar|versucht)\b/i.test(src)) {
    return src;
  }

  try {
    const out = await geminiText({
      prompt: `Übersetze diese technische Fehlermeldung knapp und natürlich ins Deutsche. Gib NUR die Übersetzung zurück, ohne Anführungszeichen, ohne Zusätze:\n\n${src}`,
      apiKey,
      model: MODELS.textLite,
      temperature: 0,
    });
    const t = out.trim();
    if (t) return t;
  } catch { /* fall through to the static dictionary */ }

  return germanFallback(src);
}

const GEMINI_URL = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Gemini 3 GA-Modelle. Die 2.5-Familie wird von Google abgeschaltet und ist für
// neue Nutzer bereits gesperrt ("no longer available to new users") — daher der
// Wechsel. image = Nano Banana 2 (direkter Nachfolger von gemini-2.5-flash-image).
const MODELS = {
  text:  "gemini-3.6-flash",
  textLite: "gemini-3.5-flash-lite",
  image: "gemini-3.1-flash-image",
} as const;

interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GenerateImageOpts {
  prompt: string;
  references?: { mimeType: string; base64: string }[];
  apiKey: string;
  aspectRatio?: string;
}

export async function geminiGenerateImage({ prompt, references = [], apiKey, aspectRatio }: GenerateImageOpts): Promise<string> {
  if (!apiKey) throw new AIError("NO_KEY", "Kein API-Key hinterlegt.", "Öffne die Einstellungen und füge deinen Gemini-Key ein.");

  const parts: Part[] = [];
  for (const ref of references) {
    parts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
  }
  const aspectLine = aspectRatio ? `\n\nAspect ratio: ${aspectRatio}.` : "";
  parts.push({ text: prompt + aspectLine });

  const res = await fetch(GEMINI_URL(MODELS.image) + `?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });

  if (!res.ok) {
    let raw = "";
    try { raw = await res.text(); } catch { /* noop */ }
    throw explainGeminiError(res.status, raw);
  }

  const data = await res.json();
  const candidates = data.candidates || [];
  for (const c of candidates) {
    const ps: Part[] = c.content?.parts || [];
    for (const p of ps) {
      if (p.inlineData?.data) {
        return `data:${p.inlineData.mimeType || "image/png"};base64,${p.inlineData.data}`;
      }
    }
  }

  // No image part came back. Work out WHY so the retry layer can vary the prompt
  // intelligently and the final message (if all retries fail) is meaningful.
  const blockReason: string | undefined = data.promptFeedback?.blockReason;
  const finishReason: string | undefined = candidates[0]?.finishReason;
  // The model sometimes answers with a text refusal instead of an image.
  const textRefusal = candidates
    .flatMap((c: any) => c.content?.parts || [])
    .map((p: Part) => p.text)
    .filter(Boolean)
    .join(" ")
    .trim();

  const SAFETY = new Set(["SAFETY", "IMAGE_SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"]);
  if (blockReason || (finishReason && SAFETY.has(finishReason))) {
    throw new AIError("SAFETY_BLOCK",
      `Gemini hat das Bild aus Sicherheitsgründen blockiert${blockReason ? ` (${blockReason})` : ""}.`,
      "Wird automatisch mit angepasstem Prompt erneut versucht.");
  }
  if (finishReason === "RECITATION") {
    throw new AIError("RECITATION",
      "Gemini hat die Anfrage wegen möglicher Urheberrechts-Überschneidung blockiert.",
      "Wird automatisch mit angepasstem Prompt erneut versucht.");
  }
  throw new AIError("NO_IMAGE", textRefusal || "Gemini hat kein Bild geliefert.",
    "Versuche den Prompt zu konkretisieren oder lade ein anderes Referenzbild.");
}

interface GeminiTextOpts {
  prompt: string;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  json?: boolean;
}

export async function geminiText({ prompt, apiKey, model = MODELS.text, temperature, maxOutputTokens, json }: GeminiTextOpts): Promise<string> {
  if (!apiKey) throw new AIError("NO_KEY", "Kein API-Key hinterlegt.", "Öffne die Einstellungen und füge deinen Gemini-Key ein.");
  const generationConfig: Record<string, any> = {};
  if (typeof temperature === "number") generationConfig.temperature = temperature;
  if (typeof maxOutputTokens === "number") generationConfig.maxOutputTokens = maxOutputTokens;
  if (json) generationConfig.responseMimeType = "application/json";

  const res = await fetch(GEMINI_URL(model) + `?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
    }),
  });
  if (!res.ok) {
    let raw = ""; try { raw = await res.text(); } catch { /* noop */ }
    throw explainGeminiError(res.status, raw);
  }
  const data = await res.json();
  const out = data.candidates?.[0]?.content?.parts?.map((p: Part) => p.text).filter(Boolean).join("\n") || "";
  return out;
}

export function extractJson<T = any>(text: string): T {
  const raw = (text || "").trim();
  if (!raw) {
    throw new AIError("BAD_JSON", "KI hat eine leere Antwort geliefert.", "Versuche es erneut oder formuliere die Idee konkreter.");
  }

  const attempts: string[] = [];
  attempts.push(raw);

  const fence = raw.match(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/);
  if (fence?.[1]) attempts.push(fence[1].trim());

  const firstObj = raw.indexOf("{");
  const lastObj = raw.lastIndexOf("}");
  if (firstObj >= 0 && lastObj > firstObj) attempts.push(raw.slice(firstObj, lastObj + 1));

  const firstArr = raw.indexOf("[");
  const lastArr = raw.lastIndexOf("]");
  if (firstArr >= 0 && lastArr > firstArr) attempts.push(raw.slice(firstArr, lastArr + 1));

  const repaired = (s: string) => s.replace(/,(\s*[}\]])/g, "$1");

  for (const candidate of attempts) {
    try { return JSON.parse(candidate) as T; } catch { /* try next */ }
    try { return JSON.parse(repaired(candidate)) as T; } catch { /* try next */ }
  }

  console.error("[extractJson] could not parse model response:\n", raw);
  const preview = raw.slice(0, 240).replace(/\s+/g, " ");
  throw new AIError(
    "BAD_JSON",
    "KI-Antwort enthält kein gültiges JSON.",
    `Antwort-Anfang: ${preview}${raw.length > 240 ? "…" : ""}`,
  );
}

/**
 * Use a Supabase Edge Function (server-side proxy) — useful for character-views, pose-grid etc.
 * Endpoints match the original project.
 */
export async function supaFunction<T = any>(name: string, body: any, opts: { anonKey?: string } = {}): Promise<T> {
  const res = await fetch(SUPA_FUNC(name), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.anonKey ? { "Authorization": `Bearer ${opts.anonKey}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let raw = ""; try { raw = await res.text(); } catch { /* noop */ }
    throw explainGeminiError(res.status, raw);
  }
  return res.json();
}

export const AI_MODELS = MODELS;
export type { Provider };
