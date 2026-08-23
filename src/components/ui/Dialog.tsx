import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
  /** Remove the default body padding + max-height so the child owns its own layout & scroll (e.g. sidebar panels). */
  flush?: boolean;
  /**
   * Ein Panel, das RECHTS NEBEN dem Dialog steht — nicht darin.
   *
   * Bewusst als Flex-Geschwister und nicht absolut positioniert: Dialog und
   * Panel bleiben so zusammen mittig, und der Dialog rückt beim Erscheinen
   * einfach nach links, statt vom Panel überdeckt zu werden. Absolut positioniert
   * müsste stattdessen jede Bildschirmbreite von Hand ausgerechnet werden, und
   * am Rand stünde das Panel halb außerhalb des Fensters.
   *
   * Der Dialog selbst schrumpft dafür (`min-w-0` unten, `max-w` bleibt die
   * Obergrenze) — deshalb funktioniert das ohne jede Breitenrechnung hier.
   * Für schmale Fenster gehört ins Panel eine `hidden lg:block`-Hülle; dort ist
   * kein Platz daneben, und der Inhalt gehört dann in den Dialog selbst.
   */
  aside?: ReactNode;
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Dialog({ open, onClose, title, subtitle, children, footer, size = "md", closeOnBackdrop = true, flush = false, aside }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  // Render through a portal to <body> so the fixed overlay is positioned
  // relative to the viewport — not to any ancestor that creates a containing
  // block (e.g. the TopBar's `backdrop-blur`/transform), which would otherwise
  // pin the dialog to the top of the screen instead of centering it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-ink-950/75 backdrop-blur-sm"
        onClick={() => closeOnBackdrop && onClose()}
      />
      {/* DIALOG UND ERWEITERUNG SIND EINE GRUPPE.
          `items-stretch` ist der Kern: die Erweiterung hat keine eigene Höhe und
          bekommt dadurch die des Dialogs — nicht die des Fensters, wie es bei
          einem `self-stretch` gegen den bildschirmfüllenden Container draußen
          herauskäme. `justify-center` hält das Paar mittig, der Dialog rückt
          also nach links, sobald rechts etwas andockt. */}
      <div className="relative flex w-full items-stretch justify-center">
        <div
          className={cn(
            // `min-w-0`: Steht eine Erweiterung daneben, muss der Dialog
            // schrumpfen dürfen. Ohne das hielte ihn seine Mindest-Inhaltsbreite
            // auf voller Größe und schöbe das Panel aus dem Fenster.
            "relative w-full min-w-0 bg-ink-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl animate-slide-up overflow-hidden",
            sizeMap[size],
            // Angedockt heißt: an dieser Kante endet der Dialog nicht mehr. Die
            // Rundung fällt weg, die Erweiterung setzt bündig an. Nur ab `lg` —
            // darunter ist sie ausgeblendet und der Dialog wieder für sich.
            aside && "lg:rounded-r-none",
          )}
        >
          {(title || subtitle) && (
            <div className="px-6 pt-6 pb-4 border-b border-white/5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {title && <h2 className="text-lg font-semibold text-ink-50">{title}</h2>}
                  {subtitle && <p className="text-sm text-ink-50/55 mt-1">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-ink-50/60 hover:text-ink-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          <div className={flush ? "overflow-hidden" : "px-6 py-6 max-h-[70vh] overflow-y-auto"}>{children}</div>
          {footer && <div className="px-6 py-4 border-t border-white/5 bg-ink-950/40">{footer}</div>}
        </div>
        {aside}
      </div>
    </div>,
    document.body,
  );
}
