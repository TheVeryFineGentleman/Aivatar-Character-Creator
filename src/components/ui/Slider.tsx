import { type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  valueLabel?: string;
}

export function Slider({ label, valueLabel, className, value, min = 0, max = 100, ...rest }: Props) {
  // Compute fill percentage so the track can show orange to the left of the thumb.
  const v = Number(value ?? 0);
  const mn = Number(min);
  const mx = Number(max);
  const pct = mx === mn ? 0 : Math.max(0, Math.min(100, ((v - mn) / (mx - mn)) * 100));

  return (
    <div className="w-full">
      {(label || valueLabel) && (
        <div className="flex items-baseline justify-between mb-2">
          {label && <label className="field-label mb-0">{label}</label>}
          {valueLabel && <span className="text-sm font-medium text-flare-300 tabular-nums">{valueLabel}</span>}
        </div>
      )}
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        className={cn(
          // Track + general look
          "w-full h-2 rounded-full appearance-none cursor-pointer",
          // Thumb (WebKit)
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5",
          "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
          "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-flare-400",
          "[&::-webkit-slider-thumb]:shadow-glow",
          "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110",
          "[&::-webkit-slider-thumb]:active:scale-95",
          // Thumb (Firefox)
          "[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-flare-400",
          // Track (Firefox needs a separate selector; the inline-style track also matters)
          "[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/10",
          "[&::-moz-range-progress]:h-2 [&::-moz-range-progress]:rounded-full",
          className,
        )}
        style={{
          // Gradient fill: brand colors on the left (theme-aware), neutral track on the right
          background: `linear-gradient(to right,
            var(--brand-1, #ff8a1f) 0%,
            var(--brand-2, #f86b0a) ${pct}%,
            rgba(255,255,255,0.10) ${pct}%,
            rgba(255,255,255,0.10) 100%)`,
        }}
        {...rest}
      />
    </div>
  );
}
