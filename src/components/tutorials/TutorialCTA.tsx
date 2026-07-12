/**
 * "← Video-Tutorial ansehen" — dezenter, akzentfarbener Chip unter der
 * Tool-Beschreibung. Öffnet das Tutorial-Panel und spielt das passende Video ab.
 *
 * Rendert nichts, wenn das zugehörige Tool im aktuellen Plan gesperrt ist —
 * so kann der Link bedenkenlos auf jeder Seite platziert werden.
 */
import { ArrowLeft } from "lucide-react";
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
        "group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl",
        "text-[13px] font-medium transition-all hover:brightness-110 active:scale-[0.98]",
        className,
      )}
      style={{ color: t.color, background: tint(t.color, 0.1) }}
    >
      <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
      Video-Tutorial ansehen
    </button>
  );
}
