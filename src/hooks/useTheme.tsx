/**
 * Theme hook — persists preference and toggles `dark` / `light` on <html>.
 * Also manages a separate `colorTheme` (accent palette variant) via `data-color-theme`.
 * Default: dark mode + sunset accents.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { KEYS, ls } from "@/lib/storage";

export type Theme = "dark" | "light" | "system";
export type ColorTheme = "neon" | "sunset" | "ocean" | "frost" | "sand";

// Colors mirror the original Projekt palette. Neon (purple/cyan) is the default.
export const COLOR_THEMES: { id: ColorTheme; label: string; description: string; swatch: [string, string] }[] = [
  { id: "neon",   label: "Neon",   description: "Lila / Cyan — Standard",  swatch: ["#a855f7", "#06b6d4"] },
  { id: "sunset", label: "Sunset", description: "Warm orange",             swatch: ["#f97316", "#f5b50a"] },
  { id: "ocean",  label: "Ocean",  description: "Blau / Teal",             swatch: ["#1f8fff", "#14b8a6"] },
  { id: "frost",  label: "Frost",  description: "Hellblau / Cyan",         swatch: ["#5b8def", "#22b8d4"] },
  { id: "sand",   label: "Sand",   description: "Bernstein / Smaragd",     swatch: ["#ed7d18", "#10b981"] },
];

export const DEFAULT_COLOR_THEME: ColorTheme = "neon";

interface ThemeValue {
  theme: Theme;
  resolved: "dark" | "light";
  setTheme: (t: Theme) => void;
  toggle: () => void;
  colorTheme: ColorTheme;
  setColorTheme: (c: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

// Bumped key so the new Projekt-matching default (neon) applies even for users
// whose browser previously auto-persisted the old "sunset" default.
const COLOR_THEME_KEY = "color-theme-v2";

function systemPref(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(t: "dark" | "light") {
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.classList.toggle("light", t === "light");
  root.setAttribute("data-theme", t);
}

function applyColorTheme(c: ColorTheme) {
  document.documentElement.setAttribute("data-color-theme", c);
}

function loadColorTheme(): ColorTheme {
  try {
    const v = localStorage.getItem(COLOR_THEME_KEY);
    if (v && COLOR_THEMES.some((t) => t.id === v)) return v as ColorTheme;
  } catch { /* ignore */ }
  return DEFAULT_COLOR_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => ls.get<Theme>(KEYS.THEME) || "dark");
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => loadColorTheme());

  const resolved: "dark" | "light" = theme === "system" ? systemPref() : theme;

  useEffect(() => {
    applyTheme(resolved);
    ls.set(KEYS.THEME, theme);
  }, [theme, resolved]);

  useEffect(() => {
    applyColorTheme(colorTheme);
    try { localStorage.setItem(COLOR_THEME_KEY, colorTheme); } catch { /* ignore */ }
  }, [colorTheme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => applyTheme(systemPref());
    mql.addEventListener?.("change", listener);
    return () => mql.removeEventListener?.("change", listener);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === "dark" ? "light" : "dark")), []);
  const setColorTheme = useCallback((c: ColorTheme) => setColorThemeState(c), []);

  const value = useMemo<ThemeValue>(
    () => ({ theme, resolved, setTheme, toggle, colorTheme, setColorTheme }),
    [theme, resolved, setTheme, toggle, colorTheme, setColorTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
