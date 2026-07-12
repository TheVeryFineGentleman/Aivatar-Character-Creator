import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

interface MenuProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  triggerClassName?: string;
  /** Optional class names appended to the popover (z.B. eigenes `min-w-[…]`). */
  popoverClassName?: string;
}

// Lets MenuItem close the popover after its click handler runs, without forcing
// the whole panel to close on every internal click (which broke inputs and
// inline rename/create flows inside MenuSection).
const MenuCloseContext = createContext<() => void>(() => {});

// Popover wird via React-Portal an `document.body` gerendert und mit
// `position: fixed` relativ zum Trigger-Button verankert. Vorher saß das
// Dropdown als `absolute`-Kind im nächsten positionierten Vorfahren und
// wurde dort von `overflow-hidden` weggeschnitten (z.B. Storyboard-Slot-
// Karte) bzw. von Geschwister-Karten überlagert. Portal + fixed löst beide
// Probleme auf einen Schlag — die Component-API bleibt identisch.
export function Menu({ trigger, children, align = "right", className, triggerClassName, popoverClassName }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const recomputeRect = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  };

  const handleTriggerClick = () => {
    if (open) {
      setOpen(false);
      return;
    }
    // Rect synchron vor dem Open setzen, damit der Popover beim ersten
    // Render schon mit korrekten Koordinaten erscheint (kein Flash an 0,0).
    recomputeRect();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      // Klicks auf den Trigger ODER ins offene Popover dürfen das Menü
      // nicht schließen — sonst feuern MenuItems gar nicht.
      if (containerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // Scroll/Resize triggert Reposition, damit das Dropdown am Trigger
    // klebt. `capture: true` fängt auch Scrolls auf Vorfahren-Containern ab.
    const onReflow = () => recomputeRect();
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open]);

  const close = () => setOpen(false);

  const popover = open && rect && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top: rect.bottom + 8,
            ...(align === "right"
              ? { right: Math.max(8, window.innerWidth - rect.right) }
              : { left: Math.max(8, rect.left) }),
          }}
          className={cn(
            "min-w-[220px] z-50 animate-slide-down origin-top",
            "bg-ink-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden",
            popoverClassName,
          )}
        >
          <MenuCloseContext.Provider value={close}>
            {children}
          </MenuCloseContext.Provider>
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        ref={triggerRef}
        onClick={handleTriggerClick}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {popover}
    </div>
  );
}

export function MenuItem({
  icon, children, onClick, danger, disabled, kbd, badge,
}: {
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  kbd?: string;
  badge?: ReactNode;
}) {
  const close = useContext(MenuCloseContext);
  return (
    <button
      type="button"
      onClick={() => { onClick?.(); close(); }}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-left transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        danger
          ? "text-danger hover:bg-danger/10"
          : "text-ink-50/85 hover:bg-white/5 hover:text-ink-50",
      )}
    >
      {icon && <span className="w-4 h-4 flex-shrink-0">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {badge}
      {kbd && (
        <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/8 text-ink-50/55">
          {kbd}
        </kbd>
      )}
    </button>
  );
}

export function MenuSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="py-1.5">
      {label && (
        <div className="px-3.5 pb-1 pt-1 text-[10px] uppercase tracking-widest text-ink-50/40 font-medium">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

export function MenuDivider() {
  return <div className="h-px bg-white/8 mx-2 my-1" />;
}
