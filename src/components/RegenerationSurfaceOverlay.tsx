/**
 * Hover overlay for story scenes: "Nur Bild neu" / "Nur Video neu" / "Szene komplett neu".
 * Renders only the actions that have a handler — avoids fake-disabled UI.
 */
import { type ReactNode } from "react";
import { RefreshCw, Image as ImageIcon, Film, Wand2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  show: boolean;
  onImage?: () => void;
  onVideo?: () => void;
  onScene?: () => void;
  busyLabel?: string | null;
  className?: string;
  children?: ReactNode;
}

export function RegenerationSurfaceOverlay({ show, onImage, onVideo, onScene, busyLabel, className, children }: Props) {
  // Outer + decorative layers stay pointer-events-none ALWAYS so a click on
  // the image bubbles through to its own onClick (open scene editor). Only the
  // actual buttons / busy chip opt back in to pointer-events-auto.
  return (
    <div className={cn("absolute inset-0 pointer-events-none", className)}>
      {/* gradient hover surface — purely decorative, never clickable */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/35 to-transparent",
        "opacity-0 transition-opacity duration-300 pointer-events-none",
        show && "opacity-100",
      )} />

      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-end p-4 gap-2 pointer-events-none",
        "opacity-0 transition-opacity duration-200",
        show && "opacity-100",
      )}>
        {busyLabel && (
          <div className="pointer-events-auto text-[11px] text-ink-50/85 px-3 py-1 rounded-full bg-flare-500/15 border border-flare-400/30 inline-flex items-center gap-1.5 mb-2">
            <RefreshCw className="w-3 h-3 animate-spin" /> {busyLabel}
          </div>
        )}

        {/* Row stays pointer-events-none so gaps don't swallow clicks; each
            PillButton turns auto back on while the overlay is visible. */}
        <div className="flex items-center gap-2 w-full justify-center pointer-events-none">
          {onImage && (
            <PillButton onClick={onImage} icon={<ImageIcon className="w-3.5 h-3.5" />} interactive={show}>Bild neu</PillButton>
          )}
          {onVideo && (
            <PillButton onClick={onVideo} icon={<Film className="w-3.5 h-3.5" />} interactive={show}>Video neu</PillButton>
          )}
          {onScene && (
            <PillButton onClick={onScene} icon={<Wand2 className="w-3.5 h-3.5" />} primary interactive={show}>Szene neu</PillButton>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function PillButton({
  icon, children, onClick, primary, interactive = true,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  interactive?: boolean;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:scale-105",
        interactive ? "pointer-events-auto" : "pointer-events-none",
        primary
          ? "bg-flare-grad text-white shadow-glow"
          : "bg-white/10 border border-white/15 backdrop-blur text-ink-50 hover:bg-white/20",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
