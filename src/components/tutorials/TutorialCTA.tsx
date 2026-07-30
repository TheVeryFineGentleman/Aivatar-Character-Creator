/**
 * "▶ Video-Tutorial ansehen" — Chip mit klar erkennbarem Play-Badge, damit
 * sofort ersichtlich ist, dass hier ein Erklär-VIDEO startet (nicht irgendeine
 * andere Aktion). Öffnet das Tutorial-Panel und spielt das passende Video ab.
 *
 * Rendert nichts, wenn das zugehörige Tool im aktuellen Plan gesperrt ist —
 * so kann der Link bedenkenlos auf jeder Seite platziert werden.
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
        "group inline-flex items-center gap-2 py-1.5 pl-1.5 pr-3.5 rounded-full border",
        "text-[13px] font-semibold transition-all hover:brightness-110 active:scale-[0.98]",
        className,
      )}
      style={{ color: t.color, background: tint(t.color, 0.12), borderColor: tint(t.color, 0.35) }}
    >
      {/* Gefülltes Play-Badge — universelles „Video abspielen"-Signal. */}
      <span
        className="flex items-center justify-center w-5 h-5 rounded-full flex-none shadow-sm transition-transform group-hover:scale-105"
        style={{ background: t.color }}
      >
        <Play className="w-2.5 h-2.5 text-ink-950 fill-current translate-x-[1px]" />
      </span>
      Video-Tutorial ansehen
    </button>
  );
}
