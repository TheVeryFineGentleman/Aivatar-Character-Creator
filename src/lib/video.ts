/**
 * Video utilities — client-side frame extraction for Story continuity.
 *
 * Used by the story creator to grab the last frame of scene N's video and use
 * it as the start frame of scene N+1, so consecutive Veo clips visually flow
 * into each other (last frame of clip A == first frame of clip B).
 */

export interface ExtractFrameOpts {
  /** How far before the absolute end to sample, in milliseconds.
   *  Some encoders emit black tail frames at exactly `duration`, so we sample
   *  slightly before by default. */
  offsetMs?: number;
  /** PNG vs JPEG — PNG is lossless and what Veo prefers as a reference. */
  mimeType?: "image/png" | "image/jpeg";
  /** Only used for jpeg. */
  quality?: number;
}

/**
 * Returns the last frame of `videoUrl` as a base64 `data:` URL.
 *
 * Requires the video host to allow CORS reads (DO Spaces returns
 * `Access-Control-Allow-Origin: *` for public objects, and `data:` URLs always
 * work). On a cross-origin video without CORS the canvas turns "tainted" and
 * the export throws — the caller should treat that as soft-failure.
 */
export async function extractLastFrame(
  videoUrl: string,
  opts: ExtractFrameOpts = {},
): Promise<string> {
  const { offsetMs = 80, mimeType = "image/png", quality = 0.95 } = opts;

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    const onMeta = () => { cleanup(); resolve(); };
    const onErr = () => { cleanup(); reject(new Error("Video konnte nicht geladen werden.")); };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("error", onErr);
    };
    video.addEventListener("loadedmetadata", onMeta, { once: true });
    video.addEventListener("error", onErr, { once: true });
  });

  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    throw new Error("Video-Dauer unbekannt.");
  }

  const target = Math.max(0, video.duration - offsetMs / 1000);
  await new Promise<void>((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve(); };
    const onErr = () => { cleanup(); reject(new Error("Seek zum letzten Frame fehlgeschlagen.")); };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onErr);
    };
    video.addEventListener("seeked", onSeeked, { once: true });
    video.addEventListener("error", onErr, { once: true });
    video.currentTime = target;
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar.");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  try {
    return canvas.toDataURL(mimeType, quality);
  } catch {
    throw new Error("Frame nicht lesbar (CORS oder geschützter Inhalt).");
  }
}
