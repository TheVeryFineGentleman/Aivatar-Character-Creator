/**
 * Großer, unübersehbarer "Video-Tutorial ansehen"-Button. Gefüllter Akzent-
 * Verlauf, weißes Play-Badge, kräftiger Glow + sanfter Puls-Ring — bewusst
 * auffälliger als alle umliegenden (sekundären/ghost) Buttons, damit niemand
 * das Erklärvideo übersieht. Öffnet das Tutorial-Panel und spielt das Video.
 *
 * Rendert nichts, wenn das zugehörige Tool im aktuellen Plan gesperrt ist.
 */
import { Play } from "lucide-react";
import { useTutorials } from "@/hooks/useTutorials";
import { useAuth } from "@/hooks/useAuth";
import { getTutorial, isUnlocked, tint } from "@/lib/tutorials";
import { cn } from "@/lib/cn";

export function TutorialCTA({ tutorialId, className }: { tutorialId: string; className?: string }) {
  const { openPanel } = useTutorials();
  const { plan } = useAuth();
  const t = getTutorial(tutorialId);
  if (!t || !isUnlocked(t, plan)) return null;

  return (
    <button
      type="button"
      onClick={() => openPanel(t.id)}
      title="Video-Tutorial ansehen"
      className={cn(
        "group relative inline-flex items-center gap-3 pl-2.5 pr-5 py-2.5 rounded-full",
        "font-bold text-sm text-white transition-all",
        "hover:scale-[1.04] active:scale-[0.98]",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${t.color}, ${tint(t.color, 0.72)})`,
        boxShadow: `0 0 0 1.5px ${tint(t.color, 0.55)}, 0 8px 26px ${tint(t.color, 0.45)}`,
        textShadow: "0 1px 2px rgba(0,0,0,0.28)",
      }}
    >
      {/* Sanft pulsierender Glow-Ring — fängt den Blick, ohne zu nerven. */}
      <span
        className="pointer-events-none absolute -inset-1 rounded-full animate-pulse opacity-40 blur-md -z-10"
        style={{ background: t.color }}
        aria-hidden
      />
      {/* Weißes Play-Badge — universelles „Video abspielen"-Signal. */}
      <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white flex-none shadow-md transition-transform group-hover:scale-110">
        <Play className="w-4 h-4 translate-x-[1px]" style={{ color: t.color, fill: "currentColor" }} />
      </span>
      <span className="relative whitespace-nowrap tracking-tight">Video-Tutorial ansehen</span>
    </button>
  );
}
