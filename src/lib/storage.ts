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
  set(key: string, value: unknown): void {
    try {
      const v = typeof value === "string" ? value : JSON.stringify(value);
      localStorage.setItem(PREFIX + key, v);
    } catch { /* quota or disabled */ }
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
  PROVIDER: "api.provider",
  CREDENTIALS: "credentials",
  THEME: "theme",
  COOKIE_CONSENT: "cookie.consent",
  DISCLAIMER_SEEN: "disclaimer.seen",
  CURRENT_PROJECT: "project.current",
  PROJECTS_INDEX: "projects.index",
  PROJECT_PREFIX: "project.data:",
  STORAGE_ADDON: "storage.addon",
} as const;
