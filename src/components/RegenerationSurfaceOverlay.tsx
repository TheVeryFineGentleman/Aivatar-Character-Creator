/**
 * Hover overlay for story scenes: "Bild neu" / "Clip neu".
 * Renders only the actions that have a handler — avoids fake-disabled UI.
 *
 * Es gibt bewusst nur EINEN Bild-Knopf: der Endframe gehoert zum selben Bild und
 * wird im Hintergrund mitgezogen. Ein zweiter Knopf ("Beide Bilder neu") machte
 * eine interne Zweiteilung sichtbar, die den Nutzer nichts angeht.
 */
import { type ReactNode } from "react";
import { RefreshCw, Image as ImageIcon, Film } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  show: boolean;
  /** Erzeugt das Bild der Szene neu — inklusive des unsichtbaren Endframes. */
  onImage?: () => void;
  onVideo?: () => void;
  busyLabel?: string | null;
  /**
   * Aktionen sperren, weil an dieser Szene schon etwas läuft (oder ein globaler
   * Durchgang). Ohne das ist „Bild neu" während des Video-Renderns klickbar —
   * und wirft einen bereits bezahlten Clip weg.
   */
  busy?: boolean;
  /** Tooltip, der erklärt WARUM gerade nichts geht. */
  busyTitle?: string;
  /**
   * Unten liegt eine Fortschrittsleiste (`SceneBusyBar`) — dann Platz für sie
   * lassen. Ohne diesen Abstand schob sich die Leiste über die Knopfreihe:
   * beide beanspruchten dieselbe untere Kante, und der Knopf war nicht mehr
   * klickbar, obwohl er noch zu sehen war.
   */
  reserveBottom?: boolean;
  className?: string;
  children?: ReactNode;
}

export function RegenerationSurfaceOverlay({ show, onImage, onVideo, busyLabel, busy = false, busyTitle, reserveBottom = false, className, children }: Props) {
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
        reserveBottom && "pb-14",
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
            <PillButton onClick={onImage} icon={<ImageIcon className="w-3.5 h-3.5" />} primary interactive={show}
              disabled={busy} title={busyTitle}>Bild neu</PillButton>
          )}
          {onVideo && (
            <PillButton onClick={onVideo} icon={<Film className="w-3.5 h-3.5" />} interactive={show}
              disabled={busy} title={busyTitle}>Clip neu</PillButton>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function PillButton({
  icon, children, onClick, primary, interactive = true, disabled = false, title,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  interactive?: boolean;
  /** Aktion gerade nicht erlaubt (läuft schon etwas an dieser Szene). */
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick(); }}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
        !disabled && "hover:scale-105",
        // Auch gesperrt pointer-events-auto lassen: sonst fällt der Klick durch
        // auf das Bild und öffnet den Szenen-Editor — das sähe aus, als hätte
        // der Knopf etwas ganz anderes getan.
        interactive ? "pointer-events-auto" : "pointer-events-none",
        disabled && "opacity-40 cursor-not-allowed",
        primary
          ? "bg-flare-grad text-pure shadow-glow"
          : "bg-white/10 border border-white/15 backdrop-blur text-ink-50",
        !disabled && !primary && "hover:bg-white/20",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
