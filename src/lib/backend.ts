/**
 * Backend configuration — points at the Express server (license, webhooks, video merge)
 * and the Supabase Edge Functions (KI proxies).
 *
 * Endpoints stay identical to the original project so the server contract is preserved.
 */

export const BACKEND = {
  // Self-hosted Express (license + storage + ai-proxy + ffmpeg merge)
  apiUrl: (import.meta.env.VITE_AI_SERVER_URL as string | undefined) || "http://localhost:3001",

  // Supabase (Edge Functions + auth)
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "https://wpewsxohwwvdrinowxjb.supabase.co",
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || "",

  // Storefronts
  // Hinweis zum Naming: die URL-Namen folgen den INTERNEN Tier-Codes
  // (premium / full / studio), nicht den Anzeigenamen (Pro / Premium / Full).
  // Wer das ändert, muss die Property-Namen überall in der App nachziehen.
  digistorePremiumUrl:        "https://www.digistore24.com/product/644591", // = "Pro" (247 € einmalig)
  digistoreFullUrl:           "https://www.digistore24.com/product/653613", // = "Premium" (297 € einmalig)
  digistoreFullUpgradeUrl:    "https://www.digistore24.com/product/653613?voucher=acs127", // = "Premium"-Upgrade aus Pro (Differenz jetzt 50 € — Digistore-Voucher acs127 muss entsprechend angepasst sein)
  digistoreStudioUrl:         "",                                            // = "Full"-Einmalkauf — Placeholder, vom User zu setzen

  // External help links
  geminiKeyUrl: "https://aistudio.google.com/app/apikey",
  falKeyUrl:    "https://fal.ai/dashboard/keys",
};

export const SUPA_FUNC = (name: string) => `${BACKEND.supabaseUrl}/functions/v1/${name}`;
export const API = (path: string) => `${BACKEND.apiUrl}${path.startsWith("/") ? path : "/" + path}`;
