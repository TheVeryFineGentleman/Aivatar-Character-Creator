/**
 * UUID helper with safe fallback.
 *
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS or `localhost`).
 * Accessing it over a plain LAN IP (e.g. `http://192.168.1.42:5173`) throws
 * `TypeError: crypto.randomUUID is not a function`. We don't need cryptographic
 * IDs — just stable, collision-resistant strings — so a Math.random fallback
 * is fine here.
 */

export function uid(): string {
  try {
    // Modern browsers in secure contexts.
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // crypto.getRandomValues exists more broadly than randomUUID — use it when present.
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      // RFC 4122 v4
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch { /* fall through */ }

  // Last-resort: timestamp + Math.random (not cryptographically secure, but fine for client IDs).
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}-${rand()}-${rand()}`;
}
