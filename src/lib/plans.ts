/**
 * Plan definitions — was jeder Tier kann.
 *
 * Vier Pakete (Mapping: intern → Anzeigename — wie in Projekt):
 *   - basic   → "Basic"   (Gratis, Reinschnupper-Funktionen)
 *   - premium → "Pro"     (247 € einmalig, voller Avatar-Creator inkl. Chat/Views/Poses)
 *   - full    → "Premium" (297 € einmalig, alles inkl. Story/Reel + Veo-Videos)
 *   - studio  → "Full"    (Einmalkauf — alles drin, kein Abo) — Placeholder
 *
 * Achtung: Die internen Codes basic/premium/full sind Projekt-kompatibel
 * (Projekt-License-Server liefert genau diese Codes) — die Labels weichen aber
 * ab. `studio` ist FINAL-only und repräsentiert die Vollverkaufsvariante.
 *
 * Upgrade-Logik: Wer Pro hat und auf Premium upgradet, zahlt nur die Differenz
 * (`PREMIUM_UPGRADE_FROM_PRO_EUR`). Die PricingPage zeigt diesen Preis dann
 * statt der vollen 297 € — und linkt auf `BACKEND.digistoreFullUpgradeUrl`.
 *
 * `studio` taucht NICHT in der PricingPage als Upgrade-Option auf — Käufer
 * sollen den Einmalkauf nicht parallel zu einem laufenden Abo machen.
 */

export type PlanTier = "basic" | "premium" | "full" | "studio";
export type BillingMode = "free" | "subscription" | "oneTime";

export interface PlanCapabilities {
  tier: PlanTier;
  label: string;
  tagline: string;
  priceEur: number | "Gratis";
  monthlyChip: string;
  billing: BillingMode;
  // Feature flags
  avatarStudio: boolean;
  quickCreator: boolean;
  chatCreator: boolean;
  characterViews: boolean;
  poseGrid: boolean;
  smartRemix: boolean;
  storyReel: boolean;
  videoGen: boolean;
  // Limits
  maxImagesPerRun: number;       // -1 = unlimited
  maxProjects: number;
  storageBytes: number;
}

const GB = 1024 ** 3;

export const PLANS: Record<PlanTier, PlanCapabilities> = {
  basic: {
    tier: "basic",
    label: "Basic",
    tagline: "Ideal für Einsteiger",
    priceEur: "Gratis",
    monthlyChip: "0 €",
    billing: "free",
    avatarStudio: true,
    quickCreator: true,
    chatCreator: false,
    characterViews: false,
    poseGrid: false,
    smartRemix: false,
    storyReel: false,
    videoGen: false,
    maxImagesPerRun: 1,
    maxProjects: 3,
    storageBytes: 3 * GB,
  },
  premium: {
    tier: "premium",
    label: "Pro",
    tagline: "Perfekt für Creator",
    priceEur: 247,
    monthlyChip: "247 € einmalig",
    billing: "oneTime",
    avatarStudio: true,
    quickCreator: true,
    chatCreator: true,
    characterViews: true,
    poseGrid: true,
    smartRemix: true,
    storyReel: false,
    videoGen: false,
    maxImagesPerRun: 40,
    maxProjects: 3,
    storageBytes: 3 * GB,
  },
  full: {
    tier: "full",
    label: "Premium",
    tagline: "Maximaler Content-Boost",
    priceEur: 297,
    monthlyChip: "297 € einmalig",
    billing: "oneTime",
    avatarStudio: true,
    quickCreator: true,
    chatCreator: true,
    characterViews: true,
    poseGrid: true,
    smartRemix: true,
    storyReel: true,
    videoGen: true,
    maxImagesPerRun: -1,
    maxProjects: 3,
    storageBytes: 3 * GB,
  },
  studio: {
    tier: "studio",
    label: "Full",
    tagline: "Einmalkauf — alles drin, lebenslang",
    priceEur: 99, // Placeholder — finalen Preis vom User setzen lassen
    monthlyChip: "99 € einmalig",
    billing: "oneTime",
    avatarStudio: true,
    quickCreator: true,
    chatCreator: true,
    characterViews: true,
    poseGrid: true,
    smartRemix: true,
    storyReel: true,
    videoGen: true,
    maxImagesPerRun: -1,
    maxProjects: 3,
    storageBytes: 3 * GB,
  },
};

export const PLAN_RANK: Record<PlanTier, number> = { basic: 0, premium: 1, full: 2, studio: 3 };

/**
 * Upgrade-Preis Pro → Premium: nur die Differenz zwischen den beiden Paketen.
 * Wird in der PricingPage angezeigt, wenn der User schon Pro hat.
 */
export const PREMIUM_UPGRADE_FROM_PRO_EUR: number =
  (typeof PLANS.full.priceEur === "number" ? PLANS.full.priceEur : 0) -
  (typeof PLANS.premium.priceEur === "number" ? PLANS.premium.priceEur : 0);

export function meetsTier(current: PlanTier, required: PlanTier): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

export function planFromServer(code?: string | null): PlanTier {
  if (!code) return "basic";
  const lc = code.toLowerCase();
  // Vollverkaufsvariante — neue Codes, falls Server sie liefert
  if (lc.includes("studio") || lc.includes("voll") || lc.includes("lifetime")) return "studio";
  // Projekt-Mapping: FULL = "Premium" (29 € Abo)
  if (lc.includes("full")) return "full";
  // Projekt-Mapping: PREMIUM = "Pro" (9 € Abo). "pro" wird auch akzeptiert.
  if (lc.includes("premium") || lc.includes("pro")) return "premium";
  return "basic";
}
