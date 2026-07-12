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
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Dialog({ open, onClose, title, subtitle, children, footer, size = "md", closeOnBackdrop = true, flush = false }: Props) {
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
      <div
        className={cn(
          "relative w-full bg-ink-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl animate-slide-up overflow-hidden",
          sizeMap[size],
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
    </div>,
    document.body,
  );
}
