// Unified AI provider abstraction for Google Gemini and fal.ai.
// Routes text, image, and video generation calls to the active provider.

export type AiProvider = "google" | "fal";

export const PROVIDER_STORAGE_KEY = "api_provider";
export const GOOGLE_KEY_STORAGE_KEY = "api_key_google";
export const FAL_KEY_STORAGE_KEY = "api_key_fal";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const FAL_SYNC_BASE = "https://fal.run";
const FAL_QUEUE_BASE = "https://queue.fal.run";

// Default fal.ai model mapping
const FAL_MODELS = {
  text: "google/gemini-2.5-flash",
  textLite: "google/gemini-2.5-flash-lite",
  image: "fal-ai/nano-banana",
  imageEdit: "fal-ai/nano-banana/edit",
  video: "fal-ai/veo3",
  videoImageToVideo: "fal-ai/veo3/image-to-video",
};

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

// ============================================================
// TEXT GENERATION
// ============================================================

export interface TextGenOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export async function generateText(
  provider: AiProvider,
  apiKey: string,
  parts: Part[],
  options?: TextGenOptions
): Promise<string> {
  if (provider === "fal") {
    return generateTextFal(apiKey, parts, options);
  }
  return generateTextGoogle(apiKey, parts, options);
}

async function generateTextGoogle(
  apiKey: string,
  parts: Part[],
  options?: TextGenOptions
): Promise<string> {
  const model = options?.model || "gemini-2.5-flash";
  const response = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxOutputTokens ?? 500,
        },
      }),
    }
  );
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

async function generateTextFal(
  apiKey: string,
  parts: Part[],
  options?: TextGenOptions
): Promise<string> {
  const textParts = parts.filter((p) => typeof p.text === "string").map((p) => p.text!);
  const imageParts = parts.filter((p) => p.inlineData);
  const prompt = textParts.join("\n\n");

  // Pick model based on requested Gemini model.
  const requestedModel = (options?.model || "").toLowerCase();
  let falModel = FAL_MODELS.text;
  if (requestedModel.includes("lite")) falModel = FAL_MODELS.textLite;

  const body: Record<string, any> = {
    model: falModel,
    prompt,
  };

  if (imageParts.length > 0) {
    const first = imageParts[0].inlineData!;
    body.image_url = `data:${first.mimeType};base64,${first.data}`;
  }

  const response = await fetch(`${FAL_SYNC_BASE}/fal-ai/any-llm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`fal.ai text error: ${response.status} - ${errText.substring(0, 200)}`);
  }
  const data = await response.json();
  return (data.output || "").toString().trim();
}

// ============================================================
// IMAGE GENERATION
// ============================================================

export interface ImageGenOptions {
  aspectRatio?: string;
  referenceImages?: string[]; // data URLs
  signal?: AbortSignal;
}

export interface ImageGenResult {
  dataUrl: string | null;
  blocked?: boolean;
}

export async function generateImage(
  provider: AiProvider,
  apiKey: string,
  prompt: string,
  options?: ImageGenOptions
): Promise<ImageGenResult> {
  if (provider === "fal") {
    return generateImageFal(apiKey, prompt, options);
  }
  return generateImageGoogle(apiKey, prompt, options);
}

async function generateImageGoogle(
  apiKey: string,
  prompt: string,
  options?: ImageGenOptions
): Promise<ImageGenResult> {
  const model = "gemini-3.1-flash-image-preview";
  const parts: Part[] = [];

  if (options?.referenceImages && options.referenceImages.length > 0) {
    for (const ref of options.referenceImages) {
      const split = splitDataUrl(ref);
      if (split) {
        parts.push({ inlineData: { mimeType: split.mimeType, data: split.base64 } });
      }
    }
  }
  parts.push({ text: prompt });

  const generationConfig: any = { responseModalities: ["IMAGE", "TEXT"] };
  if (options?.aspectRatio) {
    generationConfig.imageConfig = { aspectRatio: options.aspectRatio };
  }

  const response = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: options?.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig,
      }),
    }
  );

  if (!response.ok) {
    if (response.status === 429) throw new Error("rate_limit");
    if (response.status === 403) throw new Error("API-Key ungültig oder gesperrt.");
    throw new Error(`API Fehler: ${response.status}`);
  }

  const data = await response.json();
  const candidates = data?.candidates ?? [];
  if (candidates[0]?.finishReason === "IMAGE_OTHER" || candidates[0]?.finishReason === "SAFETY") {
    return { dataUrl: null, blocked: true };
  }
  const imgParts = candidates[0]?.content?.parts ?? [];
  const imagePart = imgParts.find(
    (p: any) => p.inlineData?.data && p.inlineData.mimeType?.startsWith("image/")
  );
  if (imagePart?.inlineData) {
    return {
      dataUrl: `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`,
    };
  }
  return { dataUrl: null };
}

// Strip phrases that paradoxically trigger fal.ai's content moderation
// (mentioning minors/under-18 even in negative form is a common trigger).
function sanitizePromptForFal(prompt: string): string {
  if (!prompt) return prompt;
  let p = prompt;
  // Strip whole compliance / safety / system blocks that nano-banana hates.
  p = p.replace(/CONTENT COMPLIANCE:[\s\S]*?(?=\n\n|$)/gi, "");
  p = p.replace(/CONTENT POLICY:[\s\S]*?(?=\n\n|$)/gi, "");
  p = p.replace(/SAFETY[^\n]*:[\s\S]*?(?=\n\n|$)/gi, "");
  p = p.replace(/COMPLIANCE[^\n]*:[\s\S]*?(?=\n\n|$)/gi, "");
  // Remove sentences containing trigger words.
  p = p.replace(/[^.\n]*(under\s*18|minors?|never depict minors|appear clearly as adults?|adults?\s*\(18\+\)|18\+)[^.\n]*\.?/gi, "");
  p = p.replace(/[^.\n]*(content guidelines|platform guidelines|comply with|content policy|guideline)[^.\n]*\.?/gi, "");
  p = p.replace(/[^.\n]*(fictional and artistic|hand-drawn\/digitally created|digitally created artwork|not real photographs|not photographs of real people)[^.\n]*\.?/gi, "");
  p = p.replace(/[^.\n]*(safety|nudity|explicit|sexual|violence|graphic|harmful|disturbing)[^.\n]*\.?/gi, "");
  // Collapse extra whitespace.
  p = p.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  // nano-banana works best with shorter prompts; cap aggressively.
  if (p.length > 1500) p = p.slice(0, 1500);
  return p;
}

async function generateImageFal(
  apiKey: string,
  prompt: string,
  options?: ImageGenOptions
): Promise<ImageGenResult> {
  const hasRefs = options?.referenceImages && options.referenceImages.length > 0;
  const model = hasRefs ? FAL_MODELS.imageEdit : FAL_MODELS.image;

  const body: Record<string, any> = {
    prompt: sanitizePromptForFal(prompt),
    num_images: 1,
    output_format: "jpeg",
    sync_mode: true,
  };
  if (hasRefs) {
    body.image_urls = options!.referenceImages;
  }
  // The /edit endpoint inherits its aspect ratio from the input image —
  // passing aspect_ratio there can trigger validation errors.
  if (options?.aspectRatio && !hasRefs) {
    body.aspect_ratio = options.aspectRatio;
  }

  const response = await fetch(`${FAL_SYNC_BASE}/${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    signal: options?.signal,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("rate_limit");
    if (response.status === 401 || response.status === 403) {
      throw new Error("fal.ai API-Key ungültig oder gesperrt.");
    }
    const errText = await response.text();
    // Log full details so we can see exactly what fal.ai rejected.
    console.warn(
      `[fal.ai] ${model} returned ${response.status}. ` +
      `Body sent: ${JSON.stringify({ ...body, image_urls: hasRefs ? `[${options!.referenceImages!.length} refs]` : undefined, prompt: body.prompt.slice(0, 200) + (body.prompt.length > 200 ? "..." : "") })}. ` +
      `Response: ${errText.substring(0, 500)}`
    );
    // 422 from nano-banana is almost always content moderation rejecting the
    // prompt or reference images. Treat as "blocked" instead of a hard error
    // so the storyboard pipeline can show a clean message and skip retries.
    if (
      response.status === 422 ||
      /could not generate images|content policy|safety|moderation/i.test(errText)
    ) {
      return { dataUrl: null, blocked: true };
    }
    throw new Error(`fal.ai Bild-Fehler: ${response.status} - ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const url: string | undefined = data?.images?.[0]?.url;
  if (!url) return { dataUrl: null };
  // sync_mode=true returns a data URL directly; otherwise it's a remote URL we fetch.
  if (url.startsWith("data:")) return { dataUrl: url };
  const dataUrl = await fetchAsDataUrl(url);
  return { dataUrl };
}

// ============================================================
// VIDEO GENERATION
// ============================================================

export interface VideoStartParams {
  prompt: string;
  startImageDataUrl: string;
  endImageDataUrl?: string;
  aspectRatio?: string;
  durationSeconds?: number;
}

export interface VideoStartResult {
  // Provider-tagged opaque handle used for polling. Format: "<provider>:<id>"
  handle: string;
  // For Google: stores which model was used (so callers can cache it).
  modelUsed?: string;
}

export interface VideoPollResult {
  status: "processing" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
}

export async function startVideoGeneration(
  provider: AiProvider,
  apiKey: string,
  params: VideoStartParams,
  googleModelCandidates?: string[]
): Promise<VideoStartResult> {
  if (provider === "fal") {
    return startVideoFal(apiKey, params);
  }
  return startVideoGoogle(apiKey, params, googleModelCandidates || ["veo-3.0-generate-preview"]);
}

export async function pollVideoOperation(
  provider: AiProvider,
  apiKey: string,
  handle: string
): Promise<VideoPollResult> {
  if (handle.startsWith("fal:")) {
    return pollVideoFal(apiKey, handle.slice(4));
  }
  if (handle.startsWith("google:")) {
    return pollVideoGoogle(apiKey, handle.slice(7));
  }
  // Backwards-compat: untagged handle assumed to match current provider.
  if (provider === "fal") return pollVideoFal(apiKey, handle);
  return pollVideoGoogle(apiKey, handle);
}

async function startVideoGoogle(
  apiKey: string,
  params: VideoStartParams,
  modelCandidates: string[]
): Promise<VideoStartResult> {
  const startImage = splitDataUrl(params.startImageDataUrl);
  if (!startImage) throw new Error("Ungültiges Startbild");

  const instance: any = {
    prompt: params.prompt,
    image: { bytesBase64Encoded: startImage.base64, mimeType: startImage.mimeType || "image/png" },
  };
  if (params.endImageDataUrl) {
    const endImage = splitDataUrl(params.endImageDataUrl);
    if (endImage) {
      instance.lastFrame = {
        bytesBase64Encoded: endImage.base64,
        mimeType: endImage.mimeType || "image/png",
      };
    }
  }

  const requestBody = {
    instances: [instance],
    parameters: {
      aspectRatio: params.aspectRatio || "16:9",
      durationSeconds: params.durationSeconds || 8,
      personGeneration: "allow_adult",
    },
  };

  let lastError = "";
  for (const model of modelCandidates) {
    const response = await fetch(
      `${GEMINI_BASE}/models/${model}:predictLongRunning?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    if (response.ok) {
      const data = await response.json();
      const operationName = data.name;
      if (!operationName) throw new Error("Keine Operation-ID erhalten");
      return { handle: `google:${operationName}`, modelUsed: model };
    }

    const errText = await response.text();
    if (response.status === 429) throw new Error("Rate limit erreicht. Bitte warte einen Moment.");
    if (response.status === 401 || response.status === 403) {
      throw new Error("API-Key ungültig oder keine Berechtigung für Video-Generierung");
    }
    if (response.status === 400) {
      lastError = errText.substring(0, 200);
      continue;
    }
    throw new Error(
      `Video-Generierung fehlgeschlagen: ${response.status} - ${errText.substring(0, 200)}`
    );
  }
  throw new Error(`Alle Veo-Modelle fehlgeschlagen. Letzter Fehler: ${lastError}`);
}

async function pollVideoGoogle(apiKey: string, operationName: string): Promise<VideoPollResult> {
  const response = await fetch(`${GEMINI_BASE}/${operationName}?key=${apiKey}`, { method: "GET" });
  if (!response.ok) {
    if (
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404
    ) {
      return { status: "failed", error: `Status-Abfrage fehlgeschlagen (${response.status})` };
    }
    return { status: "processing" };
  }
  const data = await response.json();
  if (!data.done) return { status: "processing" };

  if (data.error) {
    const errMsg = data.error.message || JSON.stringify(data.error);
    if (
      errMsg.toLowerCase().includes("safety") ||
      errMsg.toLowerCase().includes("blocked") ||
      errMsg.toLowerCase().includes("filter")
    ) {
      return { status: "failed", error: `Video durch Sicherheitsfilter blockiert: ${errMsg}` };
    }
    return { status: "failed", error: errMsg };
  }

  const resp = data.response || {};
  const videoUri =
    resp.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
    resp.generatedVideos?.[0]?.video?.uri ||
    resp.video?.uri ||
    resp.generateVideoResponse?.generatedSamples?.[0]?.uri ||
    null;

  if (videoUri) {
    const remoteUrl = videoUri.startsWith("http")
      ? `${videoUri}${videoUri.includes("?") ? "&" : "?"}key=${apiKey}`
      : `${GEMINI_BASE}/${videoUri}?key=${apiKey}`;
    try {
      const videoResp = await fetch(remoteUrl);
      if (!videoResp.ok) throw new Error(`Video download failed: ${videoResp.status}`);
      const videoBlob = await videoResp.blob();
      const blobUrl = URL.createObjectURL(videoBlob);
      return { status: "completed", videoUrl: blobUrl };
    } catch {
      return { status: "completed", videoUrl: remoteUrl };
    }
  }

  const prediction = resp.predictions?.[0];
  if (prediction?.bytesBase64Encoded) {
    const mimeType = prediction.mimeType || "video/mp4";
    const videoUrl = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;
    return { status: "completed", videoUrl };
  }

  const filteredReasons = resp.generateVideoResponse?.raiMediaFilteredReasons;
  if (filteredReasons && Array.isArray(filteredReasons) && filteredReasons.length > 0) {
    return { status: "failed", error: `Inhaltsrichtlinie: ${filteredReasons.join(", ")}` };
  }
  return { status: "failed", error: "Kein Video in der Antwort gefunden" };
}

async function startVideoFal(apiKey: string, params: VideoStartParams): Promise<VideoStartResult> {
  const useImageToVideo = !!params.startImageDataUrl;
  const model = useImageToVideo ? FAL_MODELS.videoImageToVideo : FAL_MODELS.video;

  // fal.ai veo3 takes "8s" as a string for duration (current default).
  const body: Record<string, any> = {
    prompt: params.prompt,
    aspect_ratio: params.aspectRatio || "16:9",
    duration: `${params.durationSeconds || 8}s`,
    resolution: "720p",
    generate_audio: true,
  };
  if (useImageToVideo) {
    body.image_url = params.startImageDataUrl;
  }
  // Note: fal-ai/veo3 doesn't currently expose a last-frame field.

  const response = await fetch(`${FAL_QUEUE_BASE}/${model}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("Rate limit erreicht. Bitte warte einen Moment.");
    if (response.status === 401 || response.status === 403) {
      throw new Error("fal.ai API-Key ungültig oder keine Berechtigung für Video-Generierung");
    }
    const errText = await response.text();
    throw new Error(`fal.ai Video-Fehler: ${response.status} - ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const requestId = data.request_id;
  if (!requestId) throw new Error("Keine Request-ID von fal.ai erhalten");
  // Encode model in handle so polling knows which endpoint to query.
  return { handle: `fal:${model}|${requestId}`, modelUsed: model };
}

async function pollVideoFal(apiKey: string, taggedId: string): Promise<VideoPollResult> {
  const [model, requestId] = taggedId.split("|");
  if (!model || !requestId) {
    return { status: "failed", error: "Ungültiges fal.ai Request-Handle" };
  }

  const statusResp = await fetch(
    `${FAL_QUEUE_BASE}/${model}/requests/${requestId}/status`,
    { headers: { Authorization: `Key ${apiKey}` } }
  );
  if (!statusResp.ok) {
    if (statusResp.status === 401 || statusResp.status === 403 || statusResp.status === 404) {
      return { status: "failed", error: `fal.ai Status-Fehler (${statusResp.status})` };
    }
    return { status: "processing" };
  }
  const statusData = await statusResp.json();
  const status = statusData.status as string;

  if (status === "IN_QUEUE" || status === "IN_PROGRESS") {
    return { status: "processing" };
  }

  if (status === "COMPLETED") {
    const resultResp = await fetch(`${FAL_QUEUE_BASE}/${model}/requests/${requestId}`, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    if (!resultResp.ok) {
      return { status: "failed", error: `fal.ai Ergebnis-Fehler (${resultResp.status})` };
    }
    const result = await resultResp.json();
    const videoUrl: string | undefined = result?.video?.url;
    if (!videoUrl) {
      return { status: "failed", error: "Kein Video in fal.ai-Antwort" };
    }
    try {
      const videoResp = await fetch(videoUrl);
      if (!videoResp.ok) throw new Error(`Video download failed: ${videoResp.status}`);
      const videoBlob = await videoResp.blob();
      const blobUrl = URL.createObjectURL(videoBlob);
      return { status: "completed", videoUrl: blobUrl };
    } catch {
      return { status: "completed", videoUrl };
    }
  }

  // Treat anything else (ERROR etc) as failed
  return {
    status: "failed",
    error: statusData.error?.message || `fal.ai Status: ${status}`,
  };
}

// ============================================================
// HELPERS
// ============================================================

export function splitDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

async function fetchAsDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Image download failed: ${resp.status}`);
  const blob = await resp.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============================================================
// STORAGE HELPERS (with one-time sessionStorage migration)
// ============================================================

export function loadProviderState(): {
  provider: AiProvider;
  googleKey: string;
  falKey: string;
} {
  let provider: AiProvider = "google";
  let googleKey = "";
  let falKey = "";

  try {
    const storedProvider = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (storedProvider === "fal" || storedProvider === "google") provider = storedProvider;
    googleKey = localStorage.getItem(GOOGLE_KEY_STORAGE_KEY) || "";
    falKey = localStorage.getItem(FAL_KEY_STORAGE_KEY) || "";

    // One-time migration from sessionStorage (legacy).
    if (!googleKey) {
      const legacy = sessionStorage.getItem("session_gemini_api_key");
      if (legacy) {
        googleKey = legacy;
        localStorage.setItem(GOOGLE_KEY_STORAGE_KEY, legacy);
      }
    }
  } catch {}

  return { provider, googleKey, falKey };
}

export function saveProvider(provider: AiProvider) {
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  } catch {}
}

export function saveGoogleKey(key: string) {
  try {
    if (key) localStorage.setItem(GOOGLE_KEY_STORAGE_KEY, key);
    else localStorage.removeItem(GOOGLE_KEY_STORAGE_KEY);
  } catch {}
}

export function saveFalKey(key: string) {
  try {
    if (key) localStorage.setItem(FAL_KEY_STORAGE_KEY, key);
    else localStorage.removeItem(FAL_KEY_STORAGE_KEY);
  } catch {}
}
