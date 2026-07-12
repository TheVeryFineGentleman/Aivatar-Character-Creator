/**
 * Contextual upgrade nudge — picks the most relevant CTA for the user's current plan.
 * Dismissible (per-session) so it never feels naggy.
 */
import { useState } from "react";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/cn";

interface Props {
  variant?: "inline" | "hero";
  className?: string;
}

const STORAGE_KEY = "aivatar:promo.dismissed";

function dismissedKeys(): string[] {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function markDismissed(key: string) {
  try {
    const next = Array.from(new Set([...dismissedKeys(), key]));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}

export function PromoBanner({ variant = "inline", className }: Props) {
  const { plan, credentials } = useAuth();

  // Pick a CTA tailored to the user's situation.
  const promo = (() => {
    if (!credentials) {
      return { id: "login", title: "Lizenzschlüssel einlösen", body: "Bereits gekauft? Logge dich ein, um Premium-Features freizuschalten.", cta: "Anmelden", to: "/" };
    }
    if (plan.tier === "basic") {
      return { id: "pro", title: "Mehr aus Aivatar holen", body: "Mit Pro schaltest du Character Chat, Character Views, Pose-Grid und 40 Bilder pro Durchgang frei.", cta: "Pro ansehen", to: "/pricing" };
    }
    if (plan.tier === "premium") {
      return { id: "premium-up", title: "Story & Reels brauchen Premium", body: "Multi-Szenen-Storyboards, KI-Dialoge und Veo3-Videos gibt's nur im Premium-Paket.", cta: "Premium ansehen", to: "/pricing" };
    }
    // Premium- und Full-Käufer haben bereits alles freigeschaltet.
    return null;
  })();

  const [dismissed, setDismissed] = useState(() => (promo ? dismissedKeys().includes(promo.id) : true));

  if (!promo || dismissed) return null;

  const hide = () => {
    markDismissed(promo.id);
    setDismissed(true);
  };

  if (variant === "hero") {
    return (
      <div className={cn("relative rounded-3xl bg-flare-grad text-white p-6 sm:p-8 shadow-glow overflow-hidden", className)}>
        <button onClick={hide} className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center">
          <X className="w-3.5 h-3.5" />
        </button>
        <div className="flex items-start gap-3 mb-3">
          <Sparkles className="w-5 h-5" />
          <div className="text-xs uppercase tracking-widest opacity-90">Empfehlung</div>
        </div>
        <h3 className="text-xl sm:text-2xl font-semibold tracking-tight mb-1.5">{promo.title}</h3>
        <p className="text-sm opacity-90 max-w-md mb-4">{promo.body}</p>
        <Link
          to={promo.to}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white text-flare-600 text-sm font-semibold hover:bg-white/90 transition-colors"
        >
          {promo.cta} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-flare-500/10 border border-flare-400/30",
      className,
    )}>
      <Sparkles className="w-4 h-4 text-flare-300 flex-shrink-0" />
      <div className="text-xs text-ink-50/85 flex-1 min-w-0">
        <span className="font-medium text-ink-50">{promo.title}</span>
        <span className="text-ink-50/65"> · {promo.body}</span>
      </div>
      <Link
        to={promo.to}
        className="text-xs font-medium text-flare-300 hover:text-flare-200 inline-flex items-center gap-1 flex-shrink-0"
      >
        {promo.cta} <ArrowRight className="w-3 h-3" />
      </Link>
      <button onClick={hide} className="p-1 rounded hover:bg-white/5 text-ink-50/55 hover:text-ink-50">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
