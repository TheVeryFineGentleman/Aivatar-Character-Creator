export interface AspectOption {
  value: string;
  label: string;
  tailwindClass: string;
}

export const ASPECT_RATIOS: AspectOption[] = [
  { value: "1:1",   label: "1:1 — Quadratisch", tailwindClass: "aspect-square" },
  { value: "9:16",  label: "9:16 — Reel/Story", tailwindClass: "aspect-[9/16]" },
  { value: "4:5",   label: "4:5 — Portrait",    tailwindClass: "aspect-[4/5]" },
  { value: "3:4",   label: "3:4 — Hochkant",    tailwindClass: "aspect-[3/4]" },
  { value: "4:3",   label: "4:3 — Classic",     tailwindClass: "aspect-[4/3]" },
  { value: "16:9",  label: "16:9 — Widescreen", tailwindClass: "aspect-video" },
  { value: "21:9",  label: "21:9 — Cinematic",  tailwindClass: "aspect-[21/9]" },
];

/**
 * The only ratios the video pipeline renders cleanly — used by the Story/Reel
 * format dropdown so users can't pick a ratio that would get snapped anyway.
 * Images elsewhere still use the full ASPECT_RATIOS list.
 *
 * EIGENE Beschriftungen statt der aus ASPECT_RATIOS: hier wählt man nicht bloß
 * ein Seitenverhältnis, sondern die Gattung. Hochkant IST das Reel, quer IST das
 * Video — „Widescreen" sagt das nicht, und in einem Schritt, der nach dem Reel
 * fragt, las sich 16:9 wie eine Variante davon. Die Bild-Auswahl auf anderen
 * Seiten bleibt bei „Widescreen", dort geht es wirklich nur um das Format.
 */
export const VIDEO_ASPECT_RATIOS: AspectOption[] = [
  { value: "9:16", label: "9:16 — Reel (hochkant)",  tailwindClass: "aspect-[9/16]" },
  { value: "16:9", label: "16:9 — Video (quer)",     tailwindClass: "aspect-video" },
];

export function aspectClass(value: string): string {
  return ASPECT_RATIOS.find((a) => a.value === value)?.tailwindClass || "aspect-square";
}

/**
 * Video providers (Google Veo / fal.ai Veo3) only render a small set of fixed
 * ratios. Snap whatever the user picked in the Format dropdown to the nearest
 * supported one so the clip never falls back to the provider default (16:9).
 * Both the video request AND the final FFmpeg merge use this, so start image,
 * clip and merged output all agree → no letterboxing.
 */
export function videoAspect(value: string): "9:16" | "16:9" | "1:1" {
  const [w, h] = value.split(":").map(Number);
  if (!w || !h) return "16:9";
  const r = w / h;
  if (r < 0.95) return "9:16"; // portrait
  if (r > 1.05) return "16:9"; // landscape
  return "1:1";                // ~square
}

/**
 * Even-numbered pixel dimensions for a "W:H" ratio with the long edge at `long`.
 * h264 requires even width/height, hence the `-= n % 2`.
 */
export function aspectDimensions(value: string, long = 1280): { width: number; height: number } {
  const [rw, rh] = value.split(":").map(Number);
  const w = rw || 16, h = rh || 9;
  let width: number, height: number;
  if (w >= h) { width = long; height = Math.round((long * h) / w); }
  else { height = long; width = Math.round((long * w) / h); }
  width -= width % 2;
  height -= height % 2;
  return { width, height };
}
