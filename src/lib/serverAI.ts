/**
 * Server-AI proxy — talks to the self-hosted Express endpoints on `apiUrl`.
 * Used for things that don't fit pure client-side: video generation, FFmpeg merging,
 * YouTube transcripts.
 *
 * Body / response shapes mirror Server/server.js verbatim — do NOT invent new fields.
 */

import { API } from "@/lib/backend";
import { AIError } from "@/lib/ai";

function looksLikeConnectionRefused(err: unknown): boolean {
  // The browser surfaces a network-level failure as TypeError("Failed to fetch")
  // — Firefox also calls it "NetworkError". CORS-was-blocked-because-no-response
  // arrives the same way. Catch them all here so callers get a useful hint.
  if (err instanceof TypeError) return true;
  const msg = String((err as any)?.message || "");
  return /fail|network|cors|fetch/i.test(msg);
}

async function postJson<T = any>(path: string, body: unknown, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  // Optional per-request timeout. The timer stays armed across the BODY read too,
  // because the finishing poll-video response streams the whole finished MP4 as
  // base64 — a stall lives in that body stream, not the headers. A timeout maps to
  // a transient NETWORK error so runVideoJob re-polls instead of hanging at 95%.
  let timedOut = false;
  const ctrl = timeoutMs ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs) : null;
  try {
    let res: Response;
    try {
      res = await fetch(API(path), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(init.headers || {}) },
        body: JSON.stringify(body),
        ...init,
        ...(ctrl ? { signal: ctrl.signal } : {}),
      });
    } catch (e) {
      if (timedOut) throw new AIError("NETWORK", "Zeitüberschreitung beim Server-Aufruf.");
      if (looksLikeConnectionRefused(e)) {
        throw new AIError(
          "SERVER_UNREACHABLE",
          "Backend-Server nicht erreichbar.",
          `Läuft der Express-Server unter ${API("")}? (npm run dev im /Server-Ordner)`,
        );
      }
      throw new AIError("NETWORK", "Netzwerkfehler beim Server-Aufruf.");
    }
    if (!res.ok) {
      // Read the body ONCE as text, then try JSON — a reverse-proxy/gateway error
      // (nginx 502/504, Cloudflare, PM2 restart page, Express 413 PayloadTooLarge)
      // isn't JSON, and res.json() would otherwise swallow the real cause.
      let raw = "";
      try { raw = await res.text(); } catch { /* noop */ }
      let payload: any = null;
      try { payload = raw ? JSON.parse(raw) : null; } catch { /* noop */ }
      const text = payload?.error || payload?.message || (raw ? raw.slice(0, 300) : `Server-Fehler (${res.status}).`);
      throw new AIError(res.status, text);
    }
    try {
      return (await res.json()) as T;
    } catch (e) {
      if (timedOut) throw new AIError("NETWORK", "Zeitüberschreitung beim Server-Aufruf.");
      throw new AIError("NETWORK", "Ungültige Server-Antwort.");
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getJson<T = any>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API(path));
  } catch (e) {
    if (looksLikeConnectionRefused(e)) {
      throw new AIError("SERVER_UNREACHABLE", "Backend-Server nicht erreichbar.");
    }
    throw new AIError("NETWORK", "Netzwerkfehler beim Server-Aufruf.");
  }
  if (!res.ok) {
    let raw = ""; try { raw = await res.text(); } catch { /* noop */ }
    throw new AIError(res.status, raw || `Server-Fehler (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

/* ============================================================
 * Video pipeline (Google Veo / fal.ai via server)
 * ============================================================ */

export type VideoProvider = "google" | "fal";

/** Mirrors the `params` object the server expects on start-video. */
export interface StartVideoParams {
  prompt: string;
  startImageDataUrl?: string;  // base64 data: URL — REQUIRED for Google Veo
  endImageDataUrl?: string;
  aspectRatio?: string;        // "9:16" | "16:9" | "1:1"
  durationSeconds?: number;
}

export interface StartVideoOpts {
  params: StartVideoParams;
  provider: VideoProvider;
  apiKey: string;
  modelCandidates?: string[];
}

export interface StartVideoResult {
  handle: string;             // "google:<operation>" or "fal:<model>|<id>"
  modelUsed: string;
}

export interface PollVideoOpts {
  handle: string;
  provider: VideoProvider;
  apiKey: string;
}

export interface PollVideoResult {
  status: "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
}

export function startVideo(opts: StartVideoOpts): Promise<StartVideoResult> {
  return postJson<StartVideoResult>("/api/ai/start-video", opts);
}

export function pollVideo(opts: PollVideoOpts): Promise<PollVideoResult> {
  // 120s ceiling: the completing poll makes the server download+base64-inline the
  // whole finished MP4. If that body stalls, time out → transient → runVideoJob
  // re-polls (the server re-fetches on the next poll) instead of hanging forever.
  return postJson<PollVideoResult>("/api/ai/poll-video", opts, {}, 120_000);
}

export interface RunVideoProgress {
  status: "processing" | "completed" | "failed";
  handle: string;
  ticks: number;
  videoUrl?: string;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Terminal (non-retryable) video failures — surface these immediately.
 * Everything else (network blips, transient 5xx, "Status-Abfrage/Video-Download
 * fehlgeschlagen", rate limits) is treated as transient and retried, so a single
 * hiccup does not kill a scene mid-reel.
 *
 * NOTE: lastFrame/"not supported" MUST stay terminal so the caller's
 * retry-without-end-frame path still triggers.
 */
const TERMINAL_VIDEO_ERR =
  /Inhaltsrichtlinie|raiMedia|Veo-Zugriff|ohne Veo|Allowlist|API-Key ung(ü|ue)ltig|Ung(ü|ue)ltiges oder fehlendes Startbild|lastFrame|not supported|isn'?t supported by this model|Kein Video in der Antwort|Alle Veo-Modelle fehlgeschlagen|Kein API-Key/i;

function isTransientVideoError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  return !TERMINAL_VIDEO_ERR.test(msg);
}

/**
 * Start a video and poll until done. Reports each tick to `onProgress`.
 * Provider + apiKey are forwarded to the server so it knows which backend to call.
 *
 * Resilient by design: `startVideo` is retried on transient errors, and a
 * transient poll failure (network drop, transient server 5xx, or a server
 * "failed" whose message is a transient download/status blip) does NOT abort the
 * job — the server re-fetches the finished video on the next poll, so we keep
 * polling until the overall deadline. Genuinely terminal failures still throw
 * right away.
 */
export async function runVideoJob(
  opts: StartVideoOpts,
  onProgress?: (p: RunVideoProgress) => void,
  signal?: AbortSignal,
  pollMs = 5000,
  timeoutMs = 8 * 60 * 1000,
): Promise<string> {
  if (!opts.apiKey) {
    throw new AIError("NO_KEY", "Kein API-Key gesetzt.", "Trag den Key in den Einstellungen ein.");
  }
  if (opts.provider === "google" && !opts.params.startImageDataUrl) {
    throw new AIError(
      "NO_REFERENCE",
      "Google Veo benötigt ein Start-Bild.",
      "Erst Bild für die Szene generieren, dann erneut starten.",
    );
  }

  const deadline = Date.now() + timeoutMs;
  const MAX_START_ATTEMPTS = 3;
  const MAX_CONSECUTIVE_POLL_FAILS = 6;

  // Start with retry/backoff on transient errors.
  let start: StartVideoResult | undefined;
  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) throw new AIError("ABORTED", "Video-Generierung abgebrochen.");
    try {
      start = await startVideo(opts);
      break;
    } catch (e) {
      if (!isTransientVideoError(e) || attempt >= MAX_START_ATTEMPTS || Date.now() > deadline) throw e;
      await sleep(Math.min(15000, 2000 * attempt));
    }
  }
  onProgress?.({ status: "processing", handle: start.handle, ticks: 0 });

  let ticks = 0;
  let consecutiveFails = 0;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new AIError("ABORTED", "Video-Generierung abgebrochen.");
    await sleep(pollMs);
    ticks++;

    let tick: PollVideoResult;
    try {
      tick = await pollVideo({ handle: start.handle, provider: opts.provider, apiKey: opts.apiKey });
    } catch (e) {
      // Transient error just talking to the server — keep the job alive.
      if (!isTransientVideoError(e) || ++consecutiveFails >= MAX_CONSECUTIVE_POLL_FAILS) throw e;
      onProgress?.({ status: "processing", handle: start.handle, ticks });
      continue;
    }

    onProgress?.({ ...tick, handle: start.handle, ticks });
    if (tick.status === "completed" && tick.videoUrl) return tick.videoUrl;
    if (tick.status === "failed") {
      const err = new AIError("VIDEO_FAIL", tick.error || "Video-Generierung fehlgeschlagen.");
      // Terminal → surface now (content filter, Veo access, lastFrame, …).
      if (!isTransientVideoError({ message: tick.error }) || ++consecutiveFails >= MAX_CONSECUTIVE_POLL_FAILS) throw err;
      // Transient server-side blip (download/status). The server re-fetches the
      // finished video on the next poll, so keep going.
      continue;
    }
    consecutiveFails = 0; // a clean "processing" tick clears the transient streak
  }
  throw new AIError("VIDEO_TIMEOUT", "Video-Generierung dauert zu lange.", "Versuche es erneut oder mit kürzerer Dauer.");
}

/* ============================================================
 * Video merge (FFmpeg concat via server)
 * ============================================================ */

export interface MergeVideosOpts {
  /** Base64-encoded MP4s — matches the server's `{ videos: string[] }` body. */
  videos: string[];
}

export interface MergeVideosServerResult {
  success: boolean;
  video: string;       // base64 mp4 — server's actual response field
  mimeType: string;
}

export interface MergeVideosResult {
  dataUrl: string;
}

/** Fetches a video at `src` (data:, blob:, http(s):) and returns the raw base64 payload. */
async function videoSrcToBase64(src: string): Promise<string> {
  if (src.startsWith("data:")) return src.split(",")[1] || "";
  const res = await fetch(src);
  if (!res.ok) throw new AIError(res.status, `Konnte Video nicht laden: ${src}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function mergeVideos(opts: { sources: string[]; aspectRatio?: string; seamless?: boolean }): Promise<MergeVideosResult> {
  if (!opts.sources?.length) throw new AIError("NO_INPUT", "Keine Videos zum Mergen.");
  const videos = await Promise.all(opts.sources.map(videoSrcToBase64));
  const result = await postJson<MergeVideosServerResult>("/api/merge-videos", {
    videos,
    aspectRatio: opts.aspectRatio,
    seamless: opts.seamless,
  });
  return { dataUrl: `data:${result.mimeType || "video/mp4"};base64,${result.video}` };
}

/* ============================================================
 * Misc proxies (text, image, transcript)
 * ============================================================ */

export interface TranscriptResult {
  text: string;
  source?: "youtube" | "fallback";
  language?: string;
}

export function fetchTranscript(youtubeUrl: string): Promise<TranscriptResult> {
  return postJson<TranscriptResult>("/api/ai/transcript", { url: youtubeUrl });
}

export interface ImageRef { mimeType: string; base64: string; }

/**
 * fal.ai image generation via the server proxy (nano-banana / nano-banana/edit).
 * Returns a data: URL. Throws AIError on block/empty so the caller can fall back.
 * The server route expects { prompt, provider, apiKey, options:{ referenceImages,
 * aspectRatio } } where referenceImages are data-URL strings.
 */
export async function serverGenerateImageFal(opts: {
  prompt: string; apiKey: string; references?: ImageRef[]; aspectRatio?: string;
}): Promise<string> {
  const referenceImages = (opts.references ?? []).map((r) => `data:${r.mimeType};base64,${r.base64}`);
  const res = await postJson<{ dataUrl: string | null; blocked?: boolean }>("/api/ai/generate-image", {
    prompt: opts.prompt,
    provider: "fal",
    apiKey: opts.apiKey,
    options: { referenceImages, aspectRatio: opts.aspectRatio },
  });
  if (res?.blocked) throw new AIError("BLOCKED", "fal.ai hat den Inhalt blockiert (Moderation).");
  if (!res?.dataUrl) throw new AIError("NO_IMAGE", "fal.ai lieferte kein Bild.");
  return res.dataUrl;
}

/**
 * fal.ai text generation via the server proxy (fal-ai/any-llm). Returns the text.
 * Server route expects { parts:[{text}|{inlineData}], options:{model}, provider,
 * apiKey } — NOT { prompt } (that was the old broken shape).
 */
export async function serverGenerateTextFal(opts: {
  prompt: string; apiKey: string; model?: string; references?: ImageRef[];
}): Promise<string> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  for (const r of opts.references ?? []) parts.push({ inlineData: { mimeType: r.mimeType, data: r.base64 } });
  parts.push({ text: opts.prompt });
  const res = await postJson<{ text: string }>("/api/ai/generate-text", {
    provider: "fal",
    apiKey: opts.apiKey,
    parts,
    options: { model: opts.model },
  });
  return (res?.text ?? "").toString();
}

/* ============================================================
 * Storage quota
 * ============================================================ */

export interface ServerQuota {
  usedBytes: number;
  limitBytes: number;
  projectLimit: number;
  isOverLimit: boolean;
  percentUsed: number;
  hasAddon: boolean;
}

export function fetchStorageQuota(email: string): Promise<ServerQuota> {
  return getJson<ServerQuota>(`/api/storage/quota?email=${encodeURIComponent(email)}`);
}

export interface StorageCheckoutOpts {
  email: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface StorageCheckoutResult {
  url: string;
}

export function startStorageCheckout(opts: StorageCheckoutOpts): Promise<StorageCheckoutResult> {
  return postJson<StorageCheckoutResult>("/api/storage/checkout", opts);
}

/* ============================================================
 * Durable asset storage (DigitalOcean Spaces, via server)
 * ============================================================ */

export interface UploadAssetOpts {
  projectId: string;
  id: string;
  kind: "image" | "video";
  email?: string;
  /** A base64 `data:` URL — used for generated images. */
  dataUrl?: string;
  /** A remote URL the server fetches itself — used for fal/Veo videos (avoids CORS). */
  sourceUrl?: string;
  contentType?: string;
}

export interface UploadAssetResult {
  url: string;   // durable public/CDN URL
  bytes?: number;
}

/**
 * Upload a generated image/video to the bucket and get back a durable URL.
 * Throws AIError (e.g. 503) when Spaces isn't configured — callers should catch
 * and fall back to the ephemeral source.
 */
export function uploadAsset(opts: UploadAssetOpts): Promise<UploadAssetResult> {
  return postJson<UploadAssetResult>("/api/storage/upload", opts);
}
