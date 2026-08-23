/**
 * Type-safe localStorage helper with namespaced keys.
 */

const PREFIX = "aivatar:";

export const ls = {
  get<T = string>(key: string, fallback: T | null = null): T | null {
    try {
      const v = localStorage.getItem(PREFIX + key);
      if (v === null) return fallback;
      try { return JSON.parse(v) as T; } catch { return v as unknown as T; }
    } catch {
      return fallback;
    }
  },
  /** `false` = nicht gespeichert (Quota voll oder localStorage aus). Der
   *  Rueckgabewert ist wichtig: ein still verworfener Save sieht fuer den
   *  Nutzer exakt wie Datenverlust aus, ohne dass irgendwo etwas steht. */
  set(key: string, value: unknown): boolean {
    try {
      const v = typeof value === "string" ? value : JSON.stringify(value);
      localStorage.setItem(PREFIX + key, v);
      return true;
    } catch { return false; /* quota or disabled */ }
  },
  remove(key: string): void {
    try { localStorage.removeItem(PREFIX + key); } catch { /* noop */ }
  },
  clear(prefix?: string): void {
    try {
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.startsWith(PREFIX) && (!prefix || k.startsWith(PREFIX + prefix))) {
          localStorage.removeItem(k);
        }
      }
    } catch { /* noop */ }
  },
  /** Sum of all stored bytes under the namespace — rough estimate. */
  usedBytes(): number {
    try {
      let total = 0;
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(PREFIX)) {
          total += k.length + (localStorage.getItem(k)?.length || 0);
        }
      }
      // localStorage is UTF-16 internally
      return total * 2;
    } catch { return 0; }
  },
};

export const KEYS = {
  API_GOOGLE: "api.google",
  API_FAL: "api.fal",
  API_ELEVEN: "api.eleven",
  PROVIDER: "api.provider",
  CREDENTIALS: "credentials",
  // v2: mit dem Wechsel auf das helle Erscheinungsbild hochgezählt. Sonst
  // gewönne bei jedem bestehenden Nutzer das automatisch gespeicherte "dark"
  // gegen den neuen Standard — genauso wie bei color-theme-v2.
  THEME: "theme-v2",
  COOKIE_CONSENT: "cookie.consent",
  DISCLAIMER_SEEN: "disclaimer.seen",
  CURRENT_PROJECT: "project.current",
  PROJECTS_INDEX: "projects.index",
  PROJECT_PREFIX: "project.data:",
  STORAGE_ADDON: "storage.addon",
} as const;
