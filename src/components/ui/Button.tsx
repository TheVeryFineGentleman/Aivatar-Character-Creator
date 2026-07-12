import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon" | "iconSm";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

// Variant feel ported from Projekt: hover shadow per-tone + active scale/brightness feedback
const variantClass: Record<Variant, string> = {
  primary:
    "bg-flare-grad text-white shadow-glow hover:brightness-110 hover:shadow-lg hover:shadow-flare-500/30 active:brightness-95",
  secondary:
    "bg-white/5 text-ink-50 border border-white/10 hover:bg-white/10 hover:border-white/15 hover:shadow-md",
  ghost:
    "text-ink-50/80 hover:bg-white/5 hover:text-ink-50",
  danger:
    "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 hover:shadow-lg hover:shadow-danger/20",
  outline:
    "border border-flare-400/40 text-flare-200 hover:bg-flare-500/10 hover:border-flare-400/60",
};

const sizeClass: Record<Size, string> = {
  sm:     "h-9 px-3 text-xs rounded-md",
  md:     "h-10 px-4 text-sm rounded-md",
  lg:     "h-11 px-8 text-base rounded-md",
  icon:   "h-10 w-10 rounded-md",
  iconSm: "h-8 w-8 rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = "primary", size = "md", loading, iconLeft, iconRight, fullWidth, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flare-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950",
        "active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        variantClass[variant],
        sizeClass[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
});
