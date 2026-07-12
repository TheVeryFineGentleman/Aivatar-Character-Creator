import { Check, Sparkles, Crown, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PLANS, PREMIUM_UPGRADE_FROM_PRO_EUR, type PlanTier } from "@/lib/plans";
import { BACKEND } from "@/lib/backend";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/cn";

/**
 * Pricing page — Layout / Inhalte 1:1 aus Projekt übernommen.
 *
 * Es werden nur die 3 Abos gezeigt (basic / premium / full). Die
 * Vollverkaufsvariante `studio` ("Full"-Einmalkauf) ist absichtlich nicht
 * sichtbar — Käufer sollen den Einmalkauf nicht parallel zum Abo abschließen.
 */

// Reihenfolge wie in Projekt: BASIC → "Pro" → "Premium"
const VISIBLE_TIERS: PlanTier[] = ["basic", "premium", "full"];

// Feature-Listen verbatim aus Projekt/Pricing.tsx
const FEATURES: Record<PlanTier, { text: string; bold?: boolean }[]> = {
  basic: [
    { text: "Erstellung hochwertiger Avatar-Posen und Bilder" },
    { text: "Flexible Aufnahme-Typen (Ganzkörper, Oberkörper, Nahaufnahme)" },
    { text: "Individuelle Hintergründe (weiß, Greenscreen, frei wählbar)" },
    { text: "Alle gängigen Bildformate (1:1, 9:16, 16:9, 21:9)" },
    { text: "Schneller, einfacher Workflow ohne Technikstress" },
    { text: "Geeignet für Social Media, Branding, Ads und Content" },
    { text: "Schritt-für-Schritt Videoanleitung" },
    { text: "Konsistente Darstellung deines KI-Avatars" },
  ],
  premium: [
    { text: "Alle Basic Features enthalten", bold: true },
    { text: "Bis zu 40 Bilder pro Durchgang (vollwertiges KI-Fotoshooting)" },
    { text: "Eigene Szenerien und Umgebungen frei definierbar" },
    { text: "Freie Szenenbeschreibung oder KI-generierte Vorschläge" },
    { text: "Mehrere Referenzbilder für bessere Charakter-Konsistenz" },
    { text: "Custom Prompt Funktion für maximale Kontrolle", bold: true },
    { text: "Custom Image Prompt für exakte Steuerung von Pose, Outfit, Szene" },
    { text: "Erweiterte Hintergrund-Optionen inkl. individueller Settings" },
    { text: "Mehr kreative Freiheit für Content, Ads und Branding" },
  ],
  full: [
    { text: "Alle Basic Features enthalten", bold: true },
    { text: "Alle Pro Features enthalten", bold: true },
    { text: "Automatische Story- und Szenen-Erstellung aus einer Idee" },
    { text: "KI-generierte Dialoge und Sprechertexte pro Szene" },
    { text: "KI-Assistent zur Erstellung von Storys und Prompts" },
    { text: "Detaillierte Szenensteuerung (Pose, Emotion, Wirkung)" },
    { text: "Individuelle Kamera- und Bildsprache pro Szene" },
    { text: "Emotion und Stimmung gezielt steuerbar" },
    { text: "Produktions-Feintuning (Artstyle, Übergänge, Details)" },
    { text: "Automatische Bildgenerierung pro Szene", bold: true },
    { text: "Automatische Video-Erstellung aus mehreren Szenen", bold: true },
    { text: "Einzelne Clips oder fertiges Gesamtvideo exportierbar" },
    { text: "Multi-Character Szenen (Dialoge zwischen Avataren)" },
  ],
  // `studio` taucht hier nicht auf — Vollverkauf läuft separat.
  studio: [],
};

// Icons & Akzentfarben pro Stufe — Projekt-Vorlage
const ICONS: Record<PlanTier, React.ReactNode> = {
  basic:   <Star    className="w-5 h-5" />,
  premium: <Crown   className="w-5 h-5" />,
  full:    <Sparkles className="w-5 h-5" />,
  studio:  <Sparkles className="w-5 h-5" />,
};

const ACCENT_CLASSES: Record<PlanTier, { plate: string; check: string; gradient: string }> = {
  basic:   { plate: "bg-white/5 text-ink-50/70 border border-white/10",          check: "text-blue-400",   gradient: "from-blue-400 to-blue-600" },
  premium: { plate: "bg-amber-500/15 text-amber-300 border border-amber-400/30", check: "text-amber-400",  gradient: "from-amber-400 to-yellow-500" },
  full:    { plate: "bg-purple-500/15 text-purple-300 border border-purple-400/30", check: "text-purple-400", gradient: "from-purple-400 to-violet-600" },
  studio:  { plate: "bg-glacier-500/15 text-glacier-300 border border-glacier-400/25", check: "text-glacier-400", gradient: "from-glacier-400 to-glacier-600" },
};

export default function PricingPage() {
  const { license } = useAuth();

  return (
    <div>
      <PageHeader
        title="Pläne"
        subtitle="Wähle dein Paket — Basic, Pro oder Premium. Einmalkauf, lebenslanger Zugriff, keine versteckten Limits."
        badge={<Badge tone="accent"><Sparkles className="w-3 h-3" /> Faire Preise</Badge>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {VISIBLE_TIERS.map((tier) => {
          const p = PLANS[tier];
          const isCurrent = license?.tier === tier;
          const featured = tier === "premium"; // mittlere Karte als "Beliebt" hervorheben
          const accent = ACCENT_CLASSES[tier];

          // Upgrade-Sonderpreis: wer schon Pro hat und auf Premium ("full")
          // upgradet, zahlt nur die Differenz. Linkt auf separate Digistore-URL,
          // fällt auf den vollen Premium-Link zurück solange die noch nicht
          // konfiguriert ist.
          const isProUser = license?.tier === "premium";
          const isUpgradeFromPro = tier === "full" && isProUser;
          const link =
            tier === "premium"   ? BACKEND.digistorePremiumUrl :
            isUpgradeFromPro     ? (BACKEND.digistoreFullUpgradeUrl || BACKEND.digistoreFullUrl) :
            tier === "full"      ? BACKEND.digistoreFullUrl    : undefined;

          const features = FEATURES[tier];

          return (
            <Card
              key={tier}
              padded={false}
              glowing={featured}
              className={cn("relative overflow-hidden flex flex-col", isCurrent && "ring-2 ring-success/40")}
            >
              {featured && (
                <div className="absolute top-3 right-3">
                  <Badge tone="accent">Beliebt</Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-3 left-3">
                  <Badge tone="success">Dein Paket</Badge>
                </div>
              )}

              <div className="p-6 pt-12 flex-1 flex flex-col">
                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4", accent.plate)}>
                  {ICONS[tier]}
                </div>
                <div className={cn("text-2xl font-extrabold bg-gradient-to-r bg-clip-text text-transparent", accent.gradient)}>
                  {p.label}
                </div>
                <div className="text-sm text-ink-50/55 mt-1">{p.tagline}</div>

                <div className="mt-4">
                  {isUpgradeFromPro ? (
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-semibold">{PREMIUM_UPGRADE_FROM_PRO_EUR} €</span>
                        <span className="text-sm text-ink-50/45 line-through">{p.priceEur} €</span>
                      </div>
                      <div className="text-xs text-amber-300">
                        Upgrade von Pro — du zahlst nur die Differenz
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-semibold">
                        {typeof p.priceEur === "number" ? `${p.priceEur} €` : p.priceEur}
                      </span>
                      {p.billing === "subscription" && <span className="text-xs text-ink-50/55">/ Monat</span>}
                      {p.billing === "oneTime" && typeof p.priceEur === "number" && (
                        <span className="text-xs text-ink-50/55">einmalig</span>
                      )}
                    </div>
                  )}
                </div>

                <ul className="mt-5 space-y-2.5 flex-1">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm leading-snug">
                      <Check className={cn("w-4 h-4 flex-shrink-0 mt-0.5", accent.check)} />
                      <span className={cn(f.bold ? "font-semibold text-ink-50" : "text-ink-50/75")}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {tier === "basic" ? (
                    <Button variant="secondary" fullWidth disabled={isCurrent}>
                      {isCurrent ? "Aktiv" : "Inklusive"}
                    </Button>
                  ) : isCurrent ? (
                    <Button variant="secondary" fullWidth disabled>
                      <Check className="w-4 h-4 mr-2" /> Aktiv
                    </Button>
                  ) : (
                    <a href={link} target="_blank" rel="noreferrer">
                      <Button variant={featured ? "primary" : "secondary"} fullWidth>
                        {isUpgradeFromPro
                          ? `Upgrade buchen (${PREMIUM_UPGRADE_FROM_PRO_EUR} €)`
                          : `${p.label} buchen`}
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8">
        <div className="text-sm text-ink-50/55 space-y-2">
          <p><strong className="text-ink-50">Du nutzt deinen eigenen API-Key.</strong> Heißt: keine Generation-Limits durch uns. Was deine Gemini-Quota erlaubt, läuft.</p>
          <p>Pro und Premium sind Einmalkäufe — du behältst den Zugriff dauerhaft. Bezahlung läuft sicher über Digistore24.</p>
          <p>Wer schon Pro hat und auf Premium upgradet, zahlt nur die Differenz von {PREMIUM_UPGRADE_FROM_PRO_EUR} €.</p>
          <p>Storage-Upgrades (zusätzlich +25 GB) sind direkt aus der App buchbar.</p>
        </div>
      </Card>
    </div>
  );
}
