import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles, Camera, Users, Film, KeyRound, ArrowRight,
  ShieldCheck, CheckCircle2, Circle, ChevronRight, Lock,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { cn } from "@/lib/cn";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { PromoBanner } from "@/components/PromoBanner";

interface Props {
  onLogin: () => void;
  onSettings: () => void;
}

// ─── Feature card config — Projekt-style cards, FINAL's six modes ────────────

type Feature = {
  to: string;
  title: string;
  description: string;
  Icon: LucideIcon;
  /** Farbton + Sättigung des Akzents, z. B. "263 70%". Die HELLIGKEIT kommt aus
   *  --accent-l-text und dreht mit dem Theme mit: ein fest heller Ton war auf
   *  der weißen Fläche nicht mehr lesbar. */
  hue: string;
  bg: string;              // icon plate background
  tier?: "Premium";
  isPrimary?: boolean;     // primary modes render as larger cards
  planKey?: "chatCreator" | "characterViews" | "poseGrid" | "storyReel";
};

/** Akzentfarbe in Textstärke — Helligkeit aus dem Theme. */
const accent = (hue: string, alpha?: number) =>
  `hsl(${hue} var(--accent-l-text)${alpha != null ? ` / ${alpha}` : ""})`;

const FEATURES: Feature[] = [
  {
    to: "/character",
    title: "Character Creator",
    description: "Quick, Chat, Views, Posen & Smart Remix — alle Wege zum Charakter unter einem Dach.",
    Icon: Users,
    hue: "263 70%",
    bg: "linear-gradient(135deg, hsl(263 70% 55% / 0.22), hsl(263 70% 55% / 0.05))",
    isPrimary: true,
  },
  {
    to: "/studio",
    title: "Avatar Studio",
    description: "Referenzbild rein, perfekter Shot raus. Format, Hintergrund, Look frei wählbar.",
    Icon: Camera,
    hue: "28 95%",
    bg: "linear-gradient(135deg, hsl(28 95% 55% / 0.22), hsl(28 95% 55% / 0.05))",
    isPrimary: true,
  },
  {
    to: "/story",
    title: "Reel / Story",
    description: "Szenen-basierte Storyboards mit KI-generierten Bildern und Veo-Videos.",
    Icon: Film,
    hue: "38 92%",
    bg: "linear-gradient(135deg, hsl(38 92% 55% / 0.22), hsl(38 92% 55% / 0.05))",
    tier: "Premium",
    planKey: "storyReel",
    isPrimary: true,
  },
];

// ─── Plan badge — pill style adapted from Projekt ────────────────────────────

function planBadgeStyle(tier: "basic" | "premium" | "full" | "studio"): React.CSSProperties {
  // Farbschema entspricht Projekt: Pro = amber, Premium = lila.
  // Full (Einmalkauf) = türkis/glacier zum Abgrenzen von den Abos.
  const map = {
    studio:  { bg: "hsl(188 94% 45% / 0.18)", border: "hsl(188 94% 50% / 0.4)", color: accent("188 94%") },
    full:    { bg: "hsl(263 70% 55% / 0.18)", border: "hsl(263 70% 55% / 0.4)", color: accent("263 70%") },
    premium: { bg: "hsl(38 92% 55% / 0.18)",  border: "hsl(38 92% 55% / 0.4)",  color: accent("38 92%")   },
    basic:   {
      bg:     "linear-gradient(135deg, hsl(28 95% 55% / 0.20), hsl(263 70% 55% / 0.15))",
      border: "hsl(28 95% 60% / 0.55)",
      color:  accent("28 95%"),
    },
  } as const;
  const s = map[tier];
  return {
    display: "inline-block",
    padding: "5px 14px",
    borderRadius: 20,
    fontSize: "clamp(11px, 1.1vw, 13px)",
    fontWeight: 700,
    letterSpacing: "0.07em",
    background: s.bg,
    border: `1.5px solid ${s.border}`,
    color: s.color,
    boxShadow: tier === "basic" ? "0 0 10px hsl(28 95% 55% / 0.2)" : undefined,
  };
}

// ─── HomePage ────────────────────────────────────────────────────────────────

export default function HomePage({ onLogin, onSettings }: Props) {
  const { credentials, plan, license } = useAuth();
  // `hasGenKey` statt des alten `hasActiveKey`: einsatzbereit ist die App erst
  // mit BEIDEN Pflicht-Keys (Google und fal.ai). Der Onboarding-Streifen hakte
  // den Schritt sonst nach dem ersten Key ab und schickte den Nutzer los, obwohl
  // die Hälfte der Kette noch fehlt.
  const { hasGenKey, missingKeys } = useSettings();
  const navigate = useNavigate();

  const ready = !!credentials && hasGenKey;
  const planTier = (plan.tier ?? "basic") as "basic" | "premium" | "full" | "studio";

  return (
    <div
      className="flex flex-col items-center px-2"
      style={{ paddingTop: 16, paddingBottom: 40 }}
    >
      {/* ── Hero block, centered ── */}
      <div className="text-center mb-10 max-w-3xl">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Badge tone="accent"><Sparkles className="w-3 h-3" /> Version 2.0</Badge>
          {license?.isAdmin && (
            <Badge tone="warn"><ShieldCheck className="w-3 h-3" /> Admin-Modus</Badge>
          )}
        </div>

        <p className="text-sm text-ink-50/55 mb-3.5 tracking-wide">
          Zentrale Steuerung für deinen KI-Avatar.
        </p>

        <h1
          className="font-extrabold tracking-[-0.04em] leading-tight mb-4 flex flex-col items-center gap-2.5"
          style={{ fontSize: "clamp(30px, 4.5vw, 54px)" }}
        >
          <AnimatedTitle text="Avatar Creator Studio" highlightFrom={2} />
          <span style={planBadgeStyle(planTier)}>{plan.label}</span>
        </h1>

        <p className="text-[14.5px] text-ink-50/65 leading-relaxed max-w-[560px] mx-auto">
          KI-Avatare, Reels und Storyboards aus einer Quelle —<br className="hidden sm:block" />
          dein eigener API-Key, keine Token-Wirtschaft, keine versteckten Limits.
        </p>
      </div>

      {/* ── Onboarding strip (only if not ready) ── */}
      {!ready && (
        <Card className="!p-4 mb-10 flex flex-wrap items-center justify-center gap-3 w-full max-w-3xl">
          <OnboardingStep done={!!credentials} label="Anmelden" />
          <ChevronRight className="w-4 h-4 text-ink-50/25" />
          <OnboardingStep
            done={hasGenKey}
            label={hasGenKey || missingKeys.length === 2
              ? "Google- & fal.ai-Key hinterlegen"
              : missingKeys[0] === "google" ? "Google-Key fehlt noch" : "fal.ai-Key fehlt noch"}
          />
          <ChevronRight className="w-4 h-4 text-ink-50/25" />
          <OnboardingStep done={false} label="Loslegen" />
          <div className="flex-1 min-w-[8px]" />
          {!credentials ? (
            <Button onClick={onLogin} size="sm" iconRight={<ArrowRight className="w-4 h-4" />}>Anmelden</Button>
          ) : !hasGenKey ? (
            <Button onClick={onSettings} size="sm" iconLeft={<KeyRound className="w-4 h-4" />}>Keys eintragen</Button>
          ) : null}
        </Card>
      )}

      {/* ── Section heading ── */}
      <div className="text-center mb-6">
        <h2 className="text-[25px] font-bold tracking-[-0.025em] mb-1.5">
          Was möchtest du erstellen?
        </h2>
        <p className="text-[13.5px] text-ink-50/55">Wähle ein Tool, um loszulegen</p>
      </div>

      {/* ── Feature cards — 3 main tools, Projekt-style ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px] w-full max-w-[900px]">
        {FEATURES.map((feature, i) => {
          const locked = feature.planKey ? !plan[feature.planKey] : false;
          return (
            <FeatureCard
              key={feature.to}
              feature={feature}
              locked={locked}
              index={i}
              onClick={() => {
                if (locked) { navigate("/pricing"); return; }
                navigate(feature.to);
              }}
            />
          );
        })}
      </div>

      {/* ── Promo banner ── */}
      {credentials && plan.tier === "basic" && (
        <div className="w-full max-w-[900px] mt-10">
          <PromoBanner variant="hero" />
        </div>
      )}

    </div>
  );
}

// ─── Individual feature card ──────────────────────────────────────────────────

interface FeatureCardProps {
  feature: Feature;
  locked: boolean;
  index: number;
  onClick: () => void;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ feature, locked, index, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const { Icon } = feature;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "group relative flex flex-col items-center text-center",
        "rounded-2xl border transition-all duration-[250ms] backdrop-blur-sm",
        locked ? "cursor-pointer opacity-80" : "cursor-pointer",
      )}
      style={{
        padding: "30px 22px 26px",
        animationDelay: `${160 + index * 90}ms`,
        // Über die Flächen-Variablen statt fester Dunkelwerte: als harte rgba
        // blieben diese Kacheln im hellen Theme schwarz — mit dunklem Text
        // darauf, also unlesbar.
        background: hovered ? "rgb(var(--c-ink-800) / 0.95)" : "rgb(var(--c-ink-900) / 0.75)",
        borderColor: hovered ? accent(feature.hue, 0.45) : "rgb(var(--c-white) / 0.10)",
        boxShadow: hovered
          ? `0 18px 48px ${accent(feature.hue, 0.18)}, 0 4px 16px var(--shadow-strong)`
          : "0 2px 12px var(--shadow-strong)",
        transform: hovered ? "translateY(-5px)" : "none",
      }}
    >
      {locked && (
        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{
            background: "hsl(263 70% 55% / 0.18)",
            color:      accent("263 70%"),
          }}
        >
          <Lock size={9} />
          {feature.tier ?? "Pro"}
        </div>
      )}

      {/* Icon plate */}
      <div
        className="flex items-center justify-center mb-5 rounded-[20px] transition-transform duration-[280ms]"
        style={{
          width: 66, height: 66,
          background: feature.bg,
          color: accent(feature.hue),
          transform: hovered ? "scale(1.1)" : "scale(1)",
          transitionTimingFunction: "cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        <Icon size={29} />
      </div>

      <h3
        className="text-[15.5px] font-semibold mb-2.5 transition-colors duration-200"
        style={{ color: hovered ? accent(feature.hue) : "rgb(var(--c-ink-50))" }}
      >
        {feature.title}
      </h3>

      <p className="text-[13px] text-ink-50/60 leading-relaxed mb-5 flex-1">
        {feature.description}
      </p>

      <div
        className="flex items-center text-[13px] font-medium transition-all duration-[220ms]"
        style={{
          gap: hovered ? 9 : 5,
          color: locked ? "rgb(var(--c-ink-300))" : accent(feature.hue),
        }}
      >
        {locked ? "Plan ansehen" : "Starten"}
        <ArrowRight size={14} />
      </div>
    </button>
  );
};

function OnboardingStep({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs", done ? "text-success" : "text-ink-50/55")}>
      {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
      <span className={cn(done && "line-through opacity-60")}>{label}</span>
    </div>
  );
}
