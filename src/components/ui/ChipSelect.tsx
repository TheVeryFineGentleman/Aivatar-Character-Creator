/**
 * Grid of border-highlighted choice chips — Projekt's signature selector pattern.
 * Used in the Quick / Studio / Views / Poses pages for short option lists.
 */
import { cn } from "@/lib/cn";

interface Option {
  value: string;
  label: string;
  emoji?: string;
}

interface Props {
  label?: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  cols?: 2 | 3 | 4;
  size?: "sm" | "md";
  className?: string;
}

export function ChipSelect({
  label, hint, value, onChange, options, cols = 3, size = "md", className,
}: Props) {
  const gridClass =
    cols === 2 ? "grid-cols-2" :
    cols === 3 ? "grid-cols-3" :
    "grid-cols-2 sm:grid-cols-4";

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="text-xs font-medium uppercase tracking-wider text-ink-50/55">{label}</div>
      )}
      <div className={cn("grid gap-2", gridClass)}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-lg border text-sm font-medium transition-all duration-150 active:scale-[0.97]",
                size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2.5",
                opt.emoji && "flex flex-col items-center gap-1",
                active
                  ? "border-flare-400/70 bg-flare-500/12 text-flare-200 shadow-sm shadow-flare-500/15"
                  : "border-white/8 bg-white/[0.02] text-ink-50/70 hover:border-flare-400/30 hover:text-ink-50 hover:bg-white/[0.04]",
              )}
            >
              {opt.emoji && <span className="text-lg leading-none">{opt.emoji}</span>}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
      {hint && <div className="text-[11px] text-ink-50/45">{hint}</div>}
    </div>
  );
}

/**
 * Segmented pill toggle — Projekt's background-type style.
 * Single horizontal row of options with rounded inner bg.
 */
interface SegOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  locked?: boolean;
}

export function SegmentedToggle({
  label, value, onChange, options, onLockedClick,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: SegOption[];
  onLockedClick?: () => void;
}) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="text-xs font-medium uppercase tracking-wider text-ink-50/55">{label}</div>
      )}
      <div className="inline-flex rounded-lg bg-ink-800/40 border border-white/8 p-1 gap-1 w-fit">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                if (opt.locked) { onLockedClick?.(); return; }
                onChange(opt.value);
              }}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                opt.locked
                  ? "text-ink-50/35 cursor-not-allowed"
                  : active
                    ? "bg-ink-900 text-ink-50 shadow-sm"
                    : "text-ink-50/55 hover:text-ink-50 hover:bg-ink-900/50",
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
