import { cn } from "@/lib/utils";

interface RegenerationSurfaceOverlayProps {
  label: string;
  className?: string;
  chipClassName?: string;
}

export function RegenerationSurfaceOverlay({
  label,
  className,
  chipClassName,
}: RegenerationSurfaceOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 z-30 overflow-hidden", className)}
    >
      <div className="regeneration-surface-overlay absolute inset-0" />
      <div
        className={cn(
          "absolute left-2 top-2 rounded-full border border-white/10 bg-red-600/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white shadow-lg shadow-red-950/30 backdrop-blur-sm",
          chipClassName,
        )}
      >
        {label}
      </div>
    </div>
  );
}
