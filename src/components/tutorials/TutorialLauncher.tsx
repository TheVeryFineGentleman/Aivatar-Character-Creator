/**
 * Freischwebender Launcher oben links — sitzt separat unter dem Aivatar-Logo
 * und öffnet das Tutorial-Panel (ohne ein bestimmtes Video vorzuwählen).
 */
import { GraduationCap } from "lucide-react";
import { useTutorials } from "@/hooks/useTutorials";
import { cn } from "@/lib/cn";

export function TutorialLauncher() {
  const { openPanel } = useTutorials();
  return (
    <button
      type="button"
      onClick={() => openPanel()}
      title="Video-Tutorials"
      className={cn(
        "fixed left-3 top-[64px] z-40",
        "flex items-center gap-1.5 h-8 px-2.5 rounded-xl",
        "bg-ink-900/85 backdrop-blur-md border border-white/10 shadow-lg",
        "text-ink-50/75 hover:text-ink-50 hover:bg-ink-800/90 hover:border-white/20",
        "hover:-translate-y-0.5 transition-all",
      )}
    >
      <GraduationCap className="w-4 h-4 text-flare-300" />
      <span className="hidden sm:inline text-[12.5px] font-medium">Tutorials</span>
    </button>
  );
}
