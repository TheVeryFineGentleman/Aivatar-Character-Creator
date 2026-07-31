/**
 * Helfer für das Admin-Panel.
 *
 * Leitidee: Der Admin soll sich NICHTS merken müssen. Alles, was sonst im Kopf
 * (oder auf einem Zettel) landen würde, merkt sich das Panel:
 *   - den Admin-Schlüssel (einmal eingeben, danach nie wieder)
 *   - die zuletzt gesuchten E-Mails
 *   - die Zuordnung Anzeigename → Produkt-Nummer der Datenbank
 *
 * Ausserdem übersetzt dieses Modul alles Technische in Klartext: Plan-Labels
 * ("Pro"/"Premium") statt DB-Codes (PREMIUM/FULL), Status auf Deutsch und eine
 * Vorher/Nachher-Liste, damit vor einem Wechsel klar ist, was sich ändert.
 */

import { ls } from "@/lib/storage";
import {
  DEFAULT_PLAN_PRODUCT_IDS,
  PLANS,
  planFromServer,
  type PlanCapabilities,
  type PlanTier,
} from "@/lib/plans";

const K = {
  adminKey: "admin.apiKey",
  recentEmails: "admin.recentEmails",
  planIds: "admin.planProductIds",
} as const;

/* ============================================================
 * Admin-Schlüssel — einmal eingeben, dann gemerkt
 * ============================================================ */

export const adminKeyStore = {
  get(): string {
    // `ls.get` JSON-parst gespeicherte Werte — ein rein numerischer Schlüssel
    // ("9876") käme sonst als Zahl zurück. Darum immer nach String zwingen.
    const raw = ls.get<unknown>(K.adminKey, "");
    return raw == null ? "" : String(raw).trim();
  },
  set(value: string): void {
    ls.set(K.adminKey, value.trim());
  },
  clear(): void {
    ls.remove(K.adminKey);
  },
};

/* ============================================================
 * Zuletzt gesuchte Kunden
 * ============================================================ */

const MAX_RECENT = 6;

export const recentEmails = {
  list(): string[] {
    const raw = ls.get<unknown>(K.recentEmails, []);
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  },
  add(email: string): string[] {
    const e = email.trim();
    if (!e) return recentEmails.list();
    const next = [e, ...recentEmails.list().filter((x) => x.toLowerCase() !== e.toLowerCase())].slice(0, MAX_RECENT);
    ls.set(K.recentEmails, next);
    return next;
  },
  clear(): string[] {
    ls.remove(K.recentEmails);
    return [];
  },
};

/* ============================================================
 * Anzeigename → Produkt-Nummer (products.id)
 * ============================================================ */

export function planProductIds(): Record<PlanTier, number | null> {
  const saved = ls.get<Partial<Record<PlanTier, number>>>(K.planIds, {}) ?? {};
  return { ...DEFAULT_PLAN_PRODUCT_IDS, ...saved };
}

export function planProductId(tier: PlanTier): number | null {
  return planProductIds()[tier] ?? null;
}

export function setPlanProductId(tier: PlanTier, id: number): Record<PlanTier, number | null> {
  const saved = ls.get<Partial<Record<PlanTier, number>>>(K.planIds, {}) ?? {};
  ls.set(K.planIds, { ...saved, [tier]: id });
  return planProductIds();
}

/**
 * Nummer aus einer echten Server-Antwort übernehmen. Der Server ist die
 * Wahrheit — liefert ein Lookup Produkt-Code + Produkt-ID, wird die Zuordnung
 * still korrigiert. So richtet sich das Panel selbst ein.
 */
export function learnPlanProductId(tier: PlanTier, id: unknown): void {
  const n = typeof id === "string" ? Number(id) : id;
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) return;
  if (planProductId(tier) === n) return;
  setPlanProductId(tier, n);
}

/* ============================================================
 * Klartext: Status, Funktionen, Unterschiede
 * ============================================================ */

export type StatusTone = "success" | "warn" | "danger" | "neutral";

export function statusInfo(status?: string | null): { label: string; tone: StatusTone } {
  const s = (status || "").toLowerCase();
  if (!s) return { label: "Unbekannt", tone: "neutral" };
  if (s.includes("active") || s.includes("aktiv")) return { label: "Aktiv", tone: "success" };
  if (s.includes("expired") || s.includes("abgelaufen")) return { label: "Abgelaufen", tone: "danger" };
  if (s.includes("refund") || s.includes("erstatt")) return { label: "Erstattet", tone: "danger" };
  if (s.includes("cancel") || s.includes("kündig") || s.includes("kuendig")) return { label: "Gekündigt", tone: "warn" };
  if (s.includes("pending") || s.includes("offen")) return { label: "Offen", tone: "warn" };
  if (s.includes("blocked") || s.includes("gesperrt")) return { label: "Gesperrt", tone: "danger" };
  return { label: status as string, tone: "neutral" };
}

type FeatureKey =
  | "avatarStudio"
  | "quickCreator"
  | "chatCreator"
  | "characterViews"
  | "poseGrid"
  | "smartRemix"
  | "storyReel"
  | "videoGen";

export const FEATURE_LABELS: { key: FeatureKey; label: string }[] = [
  { key: "avatarStudio", label: "Avatar-Studio" },
  { key: "quickCreator", label: "Schnell-Creator" },
  { key: "chatCreator", label: "Chat-Creator" },
  { key: "characterViews", label: "Charakter-Ansichten" },
  { key: "poseGrid", label: "Posen-Raster" },
  { key: "smartRemix", label: "Smart Remix" },
  { key: "storyReel", label: "Story & Reel" },
  { key: "videoGen", label: "Videos (Veo)" },
];

export function planFeatures(tier: PlanTier): string[] {
  const p = PLANS[tier];
  return FEATURE_LABELS.filter((f) => p[f.key]).map((f) => f.label);
}

export function imageLimitLabel(max: number): string {
  return max < 0 ? "unbegrenzt viele Bilder pro Lauf" : `max. ${max} Bild${max === 1 ? "" : "er"} pro Lauf`;
}

/** Ein-Zeilen-Kurzbeschreibung für die Plan-Knöpfe. */
export function planHighlight(tier: PlanTier): string {
  const p = PLANS[tier];
  if (p.storyReel && p.videoGen) return "Alles inkl. Story, Reel & Videos";
  if (p.chatCreator) return "Voller Avatar-Creator, ohne Story/Reel & Videos";
  return "Nur die Grundfunktionen";
}

export interface PlanDiff {
  gained: string[];
  lost: string[];
  imageLimitChanged: boolean;
  imagesBefore: string;
  imagesAfter: string;
  isUpgrade: boolean;
}

/** Was bekommt / verliert der Kunde beim Wechsel von `from` nach `to`? */
export function planDiff(from: PlanTier, to: PlanTier): PlanDiff {
  const a: PlanCapabilities = PLANS[from];
  const b: PlanCapabilities = PLANS[to];
  const gained = FEATURE_LABELS.filter((f) => !a[f.key] && b[f.key]).map((f) => f.label);
  const lost = FEATURE_LABELS.filter((f) => a[f.key] && !b[f.key]).map((f) => f.label);
  return {
    gained,
    lost,
    imageLimitChanged: a.maxImagesPerRun !== b.maxImagesPerRun,
    imagesBefore: imageLimitLabel(a.maxImagesPerRun),
    imagesAfter: imageLimitLabel(b.maxImagesPerRun),
    isUpgrade: gained.length >= lost.length,
  };
}

/* ============================================================
 * Server-Antwort → Anzeige
 * ============================================================ */

export interface LicenseView {
  email: string;
  licenseKey: string;
  tier: PlanTier;
  /** Roh-Werte aus der Datenbank — nur für „Technische Details“, nie prominent. */
  rawCode?: string;
  rawProductId?: number;
  status?: string;
  expiresAt?: string;
}

/**
 * Normalisiert die Lookup-Antwort des Key-Managers. Je nach Endpunkt kommen die
 * Felder flach oder unter `license` und mal als `productCode`, mal als `planCode`.
 */
export function toLicenseView(data: any, fallbackEmail: string): LicenseView | null {
  if (!data) return null;
  const rec = data.license && typeof data.license === "object" ? { ...data, ...data.license } : data;
  const licenseKey: string = rec.licenseKey || rec.license_key || "";
  if (data.found === false || !licenseKey) return null;

  const rawCode: string | undefined = rec.productCode || rec.planCode || rec.product?.code || rec.productName || rec.planName;
  const rawProductId = Number(rec.productId ?? rec.product_id ?? rec.product?.id);
  const tier = planFromServer(rawCode);

  if (Number.isInteger(rawProductId) && rawProductId > 0) learnPlanProductId(tier, rawProductId);

  return {
    email: rec.email || fallbackEmail,
    licenseKey,
    tier,
    rawCode,
    rawProductId: Number.isInteger(rawProductId) && rawProductId > 0 ? rawProductId : undefined,
    status: rec.status,
    expiresAt: rec.expiresAt || rec.expires_at,
  };
}
