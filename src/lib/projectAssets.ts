/**
 * Media persistence on DigitalOcean Spaces — ported from the Projekt build.
 *
 * Images & videos go to the Space; text / inputs / project structure stay in
 * localStorage. Objects live under:
 *   aivatar-projects/<sha1(email)>/projects/<projectId>/<kind>/<id>.<ext>
 *
 * Upload returns a public URL that we then store in the (localStorage) project
 * state. Everything degrades gracefully when Spaces isn't configured.
 */

import {
  putObject,
  deleteObject,
  deletePrefix,
  keyFromPublicUrl,
  isConfigured,
  SPACES_PUBLIC_BASE,
} from "@/lib/doSpaces";

export const PROJECT_PREFIX = "aivatar-projects";

export function isStorageReady(): boolean {
  return isConfigured();
}

// ── User namespace (sha1(email)) ─────────────────────────────────────────────

// Pure-JS SHA1 fallback for non-secure contexts (http://192.168.x.x) where
// crypto.subtle is unavailable. Same hex output as crypto.subtle.digest.
function sha1Sync(str: string): string {
  const utf8 = new TextEncoder().encode(str);
  const w = new Uint32Array(80);
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const len = utf8.length;
  const msg = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  msg.set(utf8);
  msg[len] = 0x80;
  const view = new DataView(msg.buffer);
  view.setUint32(msg.length - 4, (len * 8) >>> 0, false);
  for (let chunk = 0; chunk < msg.length; chunk += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(chunk + i * 4, false);
    for (let i = 16; i < 80; i++) {
      const x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
      w[i] = (x << 1) | (x >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number, k: number;
      if (i < 20) { f = (b & c) | (~b & d); k = 0x5a827999; }
      else if (i < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) | 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = temp;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
  }
  return [h0, h1, h2, h3, h4].map((n) => (n >>> 0).toString(16).padStart(8, "0")).join("");
}

export async function userPrefix(email: string): Promise<string> {
  if (!email) return "anon";
  const normalized = email.trim().toLowerCase();
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(normalized));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
    } catch { /* fall through */ }
  }
  return sha1Sync(normalized).slice(0, 12);
}

// ── Asset upload / delete ─────────────────────────────────────────────────────

export type AssetKind = "refs" | "generated" | "videos";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};

/** Upload a Blob / data-URL / remote URL and return its public Spaces URL. */
export async function uploadAsset(
  email: string,
  projectId: string,
  kind: AssetKind,
  source: Blob | string,
): Promise<string> {
  if (!isConfigured()) throw new Error("DO Spaces nicht konfiguriert.");
  const prefix = await userPrefix(email);
  let blob: Blob;
  if (typeof source === "string") {
    if (source.startsWith("data:")) {
      const match = source.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error("Ungültige data URL");
      const mime = match[1];
      const bin = atob(match[2]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      blob = new Blob([bytes], { type: mime });
    } else {
      const resp = await fetch(source);
      if (!resp.ok) throw new Error(`Download fehlgeschlagen: ${resp.status}`);
      blob = await resp.blob();
    }
  } else {
    blob = source;
  }
  // Normalize the content type. Veo/fal sometimes return an mp4 body without a
  // proper Content-Type header — uploading that as "application/octet-stream"
  // makes the browser refuse to play it back. Force the correct type per kind.
  let contentType = blob.type;
  if (kind === "videos" && !/^video\//.test(contentType)) contentType = "video/mp4";
  if ((kind === "generated" || kind === "refs") && !/^image\//.test(contentType)) contentType = "image/png";
  if (contentType !== blob.type) blob = new Blob([blob], { type: contentType });
  const ext = EXT_BY_MIME[contentType] || (kind === "videos" ? "mp4" : "png");
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const key = `${PROJECT_PREFIX}/${prefix}/${projectId}/${kind}/${id}.${ext}`;
  return putObject(key, blob, contentType, /* public */ true);
}

export async function deleteAssetByUrl(url: string): Promise<void> {
  if (!isConfigured() || !url.startsWith(SPACES_PUBLIC_BASE)) return;
  const key = keyFromPublicUrl(url);
  if (!key) return;
  try { await deleteObject(key); } catch (err: any) {
    console.warn("[projectAssets] deleteAssetByUrl failed:", err?.message);
  }
}

/** Remove every asset of a project (used when a project is deleted). */
export async function deleteProjectAssets(email: string, projectId: string): Promise<void> {
  if (!isConfigured()) return;
  const prefix = await userPrefix(email);
  try { await deletePrefix(`${PROJECT_PREFIX}/${prefix}/${projectId}/`); } catch (err: any) {
    console.warn("[projectAssets] deleteProjectAssets failed:", err?.message);
  }
}

export { isConfigured as spacesConfigured };
