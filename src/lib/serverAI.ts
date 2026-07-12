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

async function postJson<T = any>(path: string, body: unknown, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      body: JSON.stringify(body),
      ...init,
    });
  } catch (e) {
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
    let payload: any = null;
    try { payload = await res.json(); } catch { /* noop */ }
    const text = payload?.error || payload?.message || `Server-Fehler (${res.status}).`;
    throw new AIError(res.status, text);
  }
  return res.json() as Promise<T>;
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
  return postJson<PollVideoResult>("/api/ai/poll-video", opts);
}

export interface RunVideoProgress {
  status: "processing" | "completed" | "failed";
  handle: string;
  ticks: number;
  videoUrl?: string;
  error?: string;
}

/**
 * Start a video and poll until done. Reports each tick to `onProgress`.
 * Provider + apiKey are forwarded to the server so it knows which backend to call.
 */
export async function runVideoJob(
  opts: StartVideoOpts,
  onProgress?: (p: RunVideoProgress) => void,
  signal?: AbortSignal,
  pollMs = 5000,
  timeoutMs = 6 * 60 * 1000,
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

  const start = await startVideo(opts);
  onProgress?.({ status: "processing", handle: start.handle, ticks: 0 });

  const deadline = Date.now() + timeoutMs;
  let ticks = 0;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new AIError("ABORTED", "Video-Generierung abgebrochen.");
    await new Promise((r) => setTimeout(r, pollMs));
    ticks++;
    const tick = await pollVideo({ handle: start.handle, provider: opts.provider, apiKey: opts.apiKey });
    onProgress?.({ ...tick, handle: start.handle, ticks });
    if (tick.status === "completed" && tick.videoUrl) return tick.videoUrl;
    if (tick.status === "failed") throw new AIError("VIDEO_FAIL", tick.error || "Video-Generierung fehlgeschlagen.");
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

export interface ServerGenerateTextOpts {
  prompt: string;
  model?: string;
  json?: boolean;
  apiKey?: string;
  provider?: VideoProvider;
  temperature?: number;
}

export function serverGenerateText(opts: ServerGenerateTextOpts): Promise<{ text: string }> {
  return postJson("/api/ai/generate-text", opts);
}

export interface ServerGenerateImageOpts {
  prompt: string;
  references?: { mimeType: string; base64: string }[];
  apiKey?: string;
  provider?: VideoProvider;
  aspectRatio?: string;
}

export function serverGenerateImage(opts: ServerGenerateImageOpts): Promise<{ dataUrl: string }> {
  return postJson("/api/ai/generate-image", opts);
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
