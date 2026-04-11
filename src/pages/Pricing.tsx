import React from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowLeft, Crown, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PricingPageProps {
  currentPlanCode: string;
}

const PLANS = [
  {
    id: "BASIC",
    name: "Basic",
    subtitle: "Ideal für Einsteiger",
    price: "Gratis",
    priceNote: null,
    badgeClass: "text-muted-foreground",
    borderClass: "border-blue-500/30 hover:border-blue-500/60",
    glowClass: "from-blue-500/10 via-transparent to-transparent",
    headerGradient: "from-blue-400 to-blue-600",
    icon: Star,
    buttonLabel: "Inklusive",
    buttonVariant: "included" as const,
    link: null,
    features: [
      { text: "Erstellung hochwertiger Avatar-Posen und Bilder", bold: false },
      { text: "Flexible Aufnahme-Typen (Ganzkörper, Oberkörper, Nahaufnahme)", bold: false },
      { text: "Individuelle Hintergründe (weiß, Greenscreen, frei wählbar)", bold: false },
      { text: "Alle gängigen Bildformate (1:1, 9:16, 16:9, 21:9)", bold: false },
      { text: "Schneller, einfacher Workflow ohne Technikstress", bold: false },
      { text: "Geeignet für Social Media, Branding, Ads und Content", bold: false },
      { text: "Schritt-für-Schritt Videoanleitung", bold: false },
      { text: "Konsistente Darstellung deines KI-Avatars", bold: false },
    ],
  },
  {
    id: "PREMIUM",
    name: "Pro",
    subtitle: "Perfekt für Creator",
    price: "Nur 9 € mtl.",
    priceNote: null,
    badgeClass: "text-amber-400",
    borderClass: "border-amber-500/30 hover:border-amber-500/60",
    glowClass: "from-amber-500/10 via-transparent to-transparent",
    headerGradient: "from-amber-400 to-yellow-500",
    icon: Crown,
    buttonLabel: "Upgrade erforderlich",
    buttonVariant: "upgrade" as const,
    link: "https://www.digistore24.com/product/644591",
    features: [
      { text: "Alle Basic Features enthalten", bold: true },
      { text: "Bis zu 40 Bilder pro Durchgang (vollwertiges KI-Fotoshooting)", bold: false },
      { text: "Eigene Szenerien und Umgebungen frei definierbar", bold: false },
      { text: "Freie Szenenbeschreibung oder KI-generierte Vorschläge", bold: false },
      { text: "Mehrere Referenzbilder für bessere Charakter-Konsistenz", bold: false },
      { text: "Custom Prompt Funktion für maximale Kontrolle", bold: true },
      { text: "Custom Image Prompt für exakte Steuerung von Pose, Outfit, Szene", bold: false },
      { text: "Erweiterte Hintergrund-Optionen inkl. individueller Settings", bold: false },
      { text: "Mehr kreative Freiheit für Content, Ads und Branding", bold: false },
    ],
  },
  {
    id: "FULL",
    name: "Premium",
    subtitle: "Maximaler Content-Boost",
    price: "Nur 29 € mtl.",
    priceNote: "+Bildgen.",
    badgeClass: "text-purple-400",
    borderClass: "border-purple-500/30 hover:border-purple-500/60",
    glowClass: "from-purple-500/10 via-transparent to-transparent",
    headerGradient: "from-purple-400 to-violet-600",
    icon: Sparkles,
    buttonLabel: "Upgrade erforderlich",
    buttonVariant: "upgrade" as const,
    link: "https://www.digistore24.com/product/653613",
    comingSoon: true,
    features: [
      { text: "Alle Basic Features enthalten", bold: true },
      { text: "Alle Pro Features enthalten", bold: true },
      { text: "Automatische Story- und Szenen-Erstellung aus einer Idee", bold: false },
      { text: "KI-generierte Dialoge und Sprechertexte pro Szene", bold: false },
      { text: "KI-Assistent zur Erstellung von Storys und Prompts", bold: false },
      { text: "Detaillierte Szenensteuerung (Pose, Emotion, Wirkung)", bold: false },
      { text: "Individuelle Kamera- und Bildsprache pro Szene", bold: false },
      { text: "Emotion und Stimmung gezielt steuerbar", bold: false },
      { text: "Produktions-Feintuning (Artstyle, Übergänge, Details)", bold: false },
      { text: "Automatische Bildgenerierung pro Szene", bold: true },
      { text: "Automatische Video-Erstellung aus mehreren Szenen", bold: true },
      { text: "Einzelne Clips oder fertiges Gesamtvideo exportierbar", bold: false },
      { text: "Multi-Character Szenen (Dialoge zwischen Avataren)", bold: false },
    ],
  },
];

const PLAN_ORDER = ["BASIC", "PREMIUM", "FULL"];

const PricingPage: React.FC<PricingPageProps> = ({ currentPlanCode }) => {
  const navigate = useNavigate();
  const currentIndex = PLAN_ORDER.indexOf(currentPlanCode);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold">Paket wählen</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-2 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Wähle dein Paket
          </h2>
          <p className="text-muted-foreground">
            Basic, Pro oder Premium – das bekommst du:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlanCode;
            const planIndex = PLAN_ORDER.indexOf(plan.id);
            const isDowngrade = planIndex < currentIndex;
            const isUpgrade = planIndex > currentIndex;
            const Icon = plan.icon;

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-2xl border p-6 flex flex-col transition-all duration-300",
                  plan.borderClass,
                  isCurrent && "ring-2 ring-primary shadow-lg shadow-primary/10"
                )}
                style={{
                  background: "linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)",
                }}
              >
                {/* Glow overlay */}
                <div className={cn("absolute inset-0 rounded-2xl bg-gradient-to-b opacity-30 pointer-events-none", plan.glowClass)} />

                {/* Current badge */}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full shadow-md">
                    Dein Paket
                  </div>
                )}

                {/* Header */}
                <div className="relative text-center mb-6 pt-2">
                  <h3 className={cn("text-2xl font-extrabold bg-gradient-to-r bg-clip-text text-transparent", plan.headerGradient)}>
                    {plan.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{plan.subtitle}</p>
                </div>

                {/* Features */}
                <div className="relative flex-1 space-y-3 mb-6">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <Check className={cn("w-4 h-4 mt-0.5 shrink-0", plan.badgeClass === "text-muted-foreground" ? "text-blue-400" : plan.badgeClass)} />
                      <span className={cn("text-sm leading-snug", f.bold ? "font-semibold text-foreground" : "text-muted-foreground")}>
                        {f.text}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Button */}
                <div className="relative mt-auto space-y-2">
                  {isCurrent ? (
                    <Button disabled className="w-full bg-primary/20 text-primary border border-primary/30 cursor-default">
                      <Check className="w-4 h-4 mr-2" />
                      Aktiv
                    </Button>
                  ) : isDowngrade ? (
                    <Button disabled variant="outline" className="w-full opacity-50 cursor-default">
                      Inklusiv
                    </Button>
                  ) : plan.comingSoon ? (
                    <Button
                      className="w-full font-semibold bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:from-purple-600 hover:to-violet-700"
                      onClick={() => window.open("https://www.aivataracademy.com/acspremium_warteliste/", "_blank")}
                    >
                      Auf die Warteliste
                    </Button>
                  ) : (
                    <Button
                      className={cn(
                        "w-full font-semibold",
                        plan.id === "PREMIUM" && "bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:from-amber-600 hover:to-yellow-500",
                        plan.id === "FULL" && "bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:from-purple-600 hover:to-violet-700"
                      )}
                      onClick={() => {
                        if (plan.link) window.open(plan.link, "_blank");
                      }}
                    >
                      {plan.buttonLabel}
                    </Button>
                  )}


                </div>
              </div>
            );
          })}
        </div>

        {/* Current plan details */}
        <div className="mt-12 rounded-2xl border border-border p-6 bg-card">
          <h3 className="text-lg font-bold mb-4">Dein aktueller Plan: {PLANS.find(p => p.id === currentPlanCode)?.name || "Unbekannt"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(() => {
              // Collect all features up to and including current plan
              const unlockedFeatures: string[] = [];
              for (const plan of PLANS) {
                for (const f of plan.features) {
                  if (!f.text.endsWith(":")) unlockedFeatures.push(f.text);
                }
                if (plan.id === currentPlanCode) break;
              }
              return unlockedFeatures.map((feat, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-foreground">{feat}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
