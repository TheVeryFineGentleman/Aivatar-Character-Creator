/**
 * Image utilities: file → base64, resize, blob URLs with tracking.
 */

export async function fileToBase64(file: File | Blob): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result);
      const [meta, b64] = result.split(",");
      const mt = /data:(.*?);/.exec(meta)?.[1] || "image/png";
      resolve({ base64: b64, mimeType: mt });
    };
    reader.readAsDataURL(file);
  });
}

export async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith("data:")) {
    const [meta, b64] = url.split(",");
    const mt = /data:(.*?);/.exec(meta)?.[1] || "image/png";
    return { base64: b64, mimeType: mt };
  }
  const res = await fetch(url);
  const blob = await res.blob();
  return fileToBase64(blob);
}

const blobUrls = new Set<string>();
export function trackBlobUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob);
  blobUrls.add(url);
  return url;
}
export function releaseBlobUrl(url: string) {
  if (blobUrls.has(url)) {
    URL.revokeObjectURL(url);
    blobUrls.delete(url);
  }
}
export function releaseAllBlobUrls() {
  for (const u of blobUrls) URL.revokeObjectURL(u);
  blobUrls.clear();
}

export async function compressImageToFitSize(file: File, maxBytes = 4 * 1024 * 1024): Promise<File> {
  if (file.size <= maxBytes) return file;
  const img = await loadImage(URL.createObjectURL(file));
  let q = 0.92;
  let result = file;
  for (let i = 0; i < 6 && result.size > maxBytes; i++) {
    result = await canvasEncode(img, q);
    q -= 0.12;
  }
  return result;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function canvasEncode(img: HTMLImageElement, quality: number): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve) => {
    canvas.toBlob((b) => {
      const blob = b ?? new Blob();
      resolve(new File([blob], "image.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", quality);
  });
}

/**
 * Trigger a real download. For data: URLs the simple anchor trick works. For
 * cross-origin http(s) URLs the browser ignores the `download` attribute and
 * just navigates to the image — so we fetch → Blob → object URL instead.
 */
export async function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  let href = dataUrl;
  let revokeAfter: string | null = null;
  if (!dataUrl.startsWith("data:") && !dataUrl.startsWith("blob:")) {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      href = URL.createObjectURL(blob);
      revokeAfter = href;
    } catch {
      // Fall through and let the browser do what it can with the raw URL.
    }
  }
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (revokeAfter) setTimeout(() => URL.revokeObjectURL(revokeAfter!), 1000);
}

/**
 * Download resolution presets. `maxWidth: 0` means "original size, no resize".
 * Resizing only ever DOWNSCALES (never upscales), so picking a size larger than
 * the source simply returns the original — keeping images crisp.
 */
export const DOWNLOAD_RESOLUTIONS: { label: string; suffix: string; maxWidth: number }[] = [
  { label: "512 px",        suffix: "512",  maxWidth: 512 },
  { label: "1K (1024 px)",  suffix: "1k",   maxWidth: 1024 },
  { label: "2K (2048 px)",  suffix: "2k",   maxWidth: 2048 },
  { label: "4K / Original", suffix: "4k",   maxWidth: 0 },
];

/**
 * Compress a data URL for upstream use (e.g. Veo start/end frame).
 * Veo accepts modest resolutions just fine; sending a 4 MB PNG per frame blows
 * up the request to several MB and the server gets unhappy. JPEG ~q0.85 at
 * 1280px keeps quality high while shrinking by ~10x.
 */
export async function compressDataUrlForApi(
  dataUrl: string,
  maxWidth = 1280,
  quality = 0.85,
): Promise<string> {
  if (!dataUrl?.startsWith("data:")) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = Math.min(maxWidth, img.naturalWidth);
      const scale = w / img.naturalWidth;
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      try { resolve(canvas.toDataURL("image/jpeg", quality)); }
      catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Center-crop a data URL to an exact "W:H" aspect ratio and downscale so the
 * long edge is at most `maxLong`, returning a JPEG data URL.
 *
 * Why: Veo image-to-video derives the clip's aspect ratio from its start frame.
 * If the frame is even slightly off-ratio, Veo pads it → black bars baked into
 * the video. Forcing the frame to the exact target ratio here guarantees the
 * rendered clip fills the frame. Falls back to the input on any failure.
 */
export async function cropDataUrlToAspect(
  dataUrl: string,
  aspect: string,
  maxLong = 1280,
  quality = 0.85,
): Promise<string> {
  if (!dataUrl?.startsWith("data:")) return dataUrl;
  const [rw, rh] = aspect.split(":").map(Number);
  const targetRatio = rw && rh ? rw / rh : null;
  if (!targetRatio) return compressDataUrlForApi(dataUrl, maxLong, quality);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const sw = img.naturalWidth, sh = img.naturalHeight;
      if (!sw || !sh) { resolve(dataUrl); return; }
      const srcRatio = sw / sh;
      // Pick the largest centered crop of the source matching the target ratio.
      let cw = sw, ch = sh;
      if (srcRatio > targetRatio) cw = Math.round(sh * targetRatio); // too wide → trim sides
      else ch = Math.round(sw / targetRatio);                        // too tall → trim top/bottom
      const cx = Math.round((sw - cw) / 2);
      const cy = Math.round((sh - ch) / 2);

      // Output dimensions: keep the crop's long edge at maxLong, even numbers.
      let ow = cw, oh = ch;
      if (Math.max(ow, oh) > maxLong) {
        const s = maxLong / Math.max(ow, oh);
        ow = Math.round(ow * s); oh = Math.round(oh * s);
      }
      ow -= ow % 2; oh -= oh % 2;

      const canvas = document.createElement("canvas");
      canvas.width = ow; canvas.height = oh;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, cx, cy, cw, ch, 0, 0, ow, oh);
      try { resolve(canvas.toDataURL("image/jpeg", quality)); }
      catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Resize an image (data:, blob:, http:, https:) to a max width via canvas and
 * return a data URL. `maxWidth: 0` keeps the original size.
 *
 * For cross-origin URLs we set `crossOrigin = "anonymous"` so the canvas isn't
 * tainted and `toDataURL` works. DO Spaces public objects send CORS headers
 * already, so this is fine.
 */
export function resizeDataUrl(dataUrl: string, maxWidth: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const isCross = !dataUrl.startsWith("data:") && !dataUrl.startsWith("blob:");
    if (isCross) img.crossOrigin = "anonymous";
    img.onload = () => {
      const targetW = maxWidth > 0 ? Math.min(maxWidth, img.naturalWidth) : img.naturalWidth;
      // If the source is already a data URL AND no downscale is needed, just return it.
      if (!isCross && (maxWidth === 0 || img.naturalWidth <= maxWidth)) {
        resolve(dataUrl);
        return;
      }
      const scale = targetW / img.naturalWidth;
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try { resolve(canvas.toDataURL("image/png")); }
      catch { resolve(dataUrl); /* canvas tainted — fall back */ }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function withSuffix(filename: string, suffix: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return `${filename}-${suffix}`;
  return `${filename.slice(0, dot)}-${suffix}${filename.slice(dot)}`;
}

/** Resize (if needed) then download. Adds a resolution suffix to the filename. */
export async function downloadAtResolution(dataUrl: string, filename: string, maxWidth: number) {
  // For "Original / 4K" we just hand the source through — downloadDataUrl handles
  // cross-origin via fetch+Blob so the file actually saves instead of opening.
  const out = maxWidth === 0 ? dataUrl : await resizeDataUrl(dataUrl, maxWidth);
  const preset = DOWNLOAD_RESOLUTIONS.find((r) => r.maxWidth === maxWidth);
  await downloadDataUrl(out, withSuffix(filename, preset?.suffix ?? String(maxWidth || "orig")));
}

/**
 * Build a ZIP archive of multiple images, each resized to `maxWidth` (0 = original).
 * Filename gets the resolution suffix; the ZIP is also tagged.
 */
export async function downloadAllAsZip(
  images: { dataUrl: string; filename: string }[],
  zipName: string,
  maxWidth: number,
): Promise<void> {
  if (!images.length) return;
  // JSZip robust auflösen: der CJS/ESM-Interop unterscheidet sich zwischen dev
  // (esbuild) und prod (rollup) — der Konstruktor kann auf mod, mod.default oder
  // mod.default.default liegen. Die aufrufbare Ebene finden, statt blind `.default`
  // zu nehmen (das war je nach Build undefined → stiller Einzeldownload-Fallback).
  const mod: any = await import("jszip").catch(() => null);
  const JSZip =
    typeof mod === "function" ? mod :
    typeof mod?.default === "function" ? mod.default :
    typeof mod?.default?.default === "function" ? mod.default.default :
    null;
  const preset = DOWNLOAD_RESOLUTIONS.find((r) => r.maxWidth === maxWidth);
  const suffix = preset?.suffix ?? String(maxWidth || "orig");

  if (!JSZip) {
    console.warn("[downloadAllAsZip] JSZip konnte nicht geladen werden — Fallback auf Einzeldownloads.");
    // Fallback: trigger sequential downloads.
    for (const img of images) {
      const out = await resizeDataUrl(img.dataUrl, maxWidth);
      downloadDataUrl(out, withSuffix(img.filename, suffix));
      await new Promise((r) => setTimeout(r, 200));
    }
    return;
  }
  const zip = new JSZip();
  for (const img of images) {
    const resized = await resizeDataUrl(img.dataUrl, maxWidth);
    const base64 = resized.split(",")[1] || "";
    zip.file(withSuffix(img.filename, suffix), base64, { base64: true });
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = withSuffix(zipName, suffix);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
