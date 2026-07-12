import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      opacity: {
        "3":  "0.03",
        "8":  "0.08",
        "12": "0.12",
        "14": "0.14",
        "18": "0.18",
        "55": "0.55",
        "65": "0.65",
        "85": "0.85",
      },
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        display: ["Geist", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        // Surface / Background (deep) + Foreground (50–200)
        ink: {
          50:  "#f4f5f8",
          100: "#e6e8ee",
          200: "#cdd1dc",
          300: "#a1a8bb",
          400: "#737b94",
          500: "#3a4054",
          600: "#262b3a",
          700: "#1a1e2b",
          800: "#11141d",
          900: "#0b0d14",
          950: "#06070b",
        },
        // Accent palette — hue/saturation come from CSS vars so the whole scale
        // swaps when the user changes the color theme (see index.css).
        flare: {
          50:  "hsl(var(--flare-h) var(--flare-s) 96% / <alpha-value>)",
          100: "hsl(var(--flare-h) var(--flare-s) 90% / <alpha-value>)",
          200: "hsl(var(--flare-h) var(--flare-s) 78% / <alpha-value>)",
          300: "hsl(var(--flare-h) var(--flare-s) 66% / <alpha-value>)",
          400: "hsl(var(--flare-h) var(--flare-s) 56% / <alpha-value>)",
          500: "hsl(var(--flare-h) var(--flare-s) 51% / <alpha-value>)",
          600: "hsl(var(--flare-h) var(--flare-s) 42% / <alpha-value>)",
          700: "hsl(var(--flare-h) var(--flare-s) 33% / <alpha-value>)",
          800: "hsl(var(--flare-h) var(--flare-s) 25% / <alpha-value>)",
          900: "hsl(var(--flare-h) var(--flare-s) 17% / <alpha-value>)",
        },
        // Secondary accent: cool teal — for plan tiers / data
        glacier: {
          50:  "#ecf9fb",
          100: "#cdf0f5",
          200: "#9be0e9",
          300: "#5ec9d8",
          400: "#2bb0c4",
          500: "#1294a8",
          600: "#0c7689",
          700: "#0a5d6c",
          800: "#08434f",
          900: "#063138",
        },
        // Status
        success: "#10b981",
        warn:    "#f59e0b",
        danger:  "#ef4444",
      },
      boxShadow: {
        // Brand glow tracks the active color theme (var defined in index.css).
        glow: "0 0 0 1px var(--brand-glow), 0 8px 40px -8px var(--brand-glow)",
        soft: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 28px -12px rgba(0,0,0,0.6)",
        ring: "0 0 0 1px rgba(255,255,255,0.06)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        "fade-in":      { from: { opacity: "0" }, to: { opacity: "1" } },
        "fade-out":     { from: { opacity: "1" }, to: { opacity: "0" } },
        "slide-up":     { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-down":   { from: { opacity: "0", transform: "translateY(-8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in-left":  { from: { opacity: "0", transform: "translateX(-12px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        "slide-in-right": { from: { opacity: "0", transform: "translateX(12px)" }, to: { opacity: "1", transform: "translateX(0)" } },
        "scale-in":     { from: { opacity: "0", transform: "scale(0.94)" }, to: { opacity: "1", transform: "scale(1)" } },
        "pop-in":       { "0%": { opacity: "0", transform: "scale(0.85)" }, "60%": { opacity: "1", transform: "scale(1.04)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        "expand":       { from: { gridTemplateRows: "0fr", opacity: "0" }, to: { gridTemplateRows: "1fr", opacity: "1" } },
        "shimmer":      { "0%": { backgroundPosition: "200% 0" }, "100%": { backgroundPosition: "-200% 0" } },
        "pulse-ring":   { "0%": { boxShadow: "0 0 0 0 rgba(248,107,10,0.6)" }, "70%": { boxShadow: "0 0 0 10px rgba(248,107,10,0)" }, "100%": { boxShadow: "0 0 0 0 rgba(248,107,10,0)" } },
        "shake":        { "0%,100%": { transform: "translateX(0)" }, "20%,60%": { transform: "translateX(-4px)" }, "40%,80%": { transform: "translateX(4px)" } },
        "spin-slow":    { from: { transform: "rotate(0)" }, to: { transform: "rotate(360deg)" } },
        "wiggle":       { "0%,100%": { transform: "rotate(-2deg)" }, "50%": { transform: "rotate(2deg)" } },
        "indeterminate":{ "0%": { left: "-33%" }, "100%": { left: "100%" } },
        "word-in":      { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "fade-in":        "fade-in 240ms ease-out",
        "fade-out":       "fade-out 180ms ease-in",
        "slide-up":       "slide-up 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-down":     "slide-down 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-in-left":  "slide-in-left 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        "slide-in-right": "slide-in-right 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        "scale-in":       "scale-in 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        "pop-in":         "pop-in 380ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        "expand":         "expand 320ms ease-out",
        "shimmer":        "shimmer 2.4s linear infinite",
        "pulse-ring":     "pulse-ring 1.8s ease-out infinite",
        "shake":          "shake 420ms ease-in-out",
        "spin-slow":      "spin-slow 3s linear infinite",
        "wiggle":         "wiggle 600ms ease-in-out",
        "word-in":        "word-in 480ms cubic-bezier(0.22, 1, 0.36, 1) forwards",
      },
      backgroundImage: {
        // CSS-variable based so color themes can swap the brand gradient at runtime.
        "flare-grad":   "linear-gradient(135deg, var(--brand-1, #ff8a1f) 0%, var(--brand-2, #f86b0a) 50%, var(--brand-3, #d54f00) 100%)",
        "ink-grad":     "radial-gradient(1200px 600px at 0% -10%, rgba(255,138,31,0.10), transparent 60%), radial-gradient(900px 500px at 100% 110%, rgba(18,148,168,0.10), transparent 60%), #06070b",
        "grid-faint":   "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
