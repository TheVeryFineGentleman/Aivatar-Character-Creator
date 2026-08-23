import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface Props extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  padded?: boolean;
  glowing?: boolean;
}

export function Card({ className, elevated, padded = true, glowing, children, ...rest }: Props) {
  return (
    <div
      className={cn(
        "relative bg-ink-900/70 backdrop-blur-xl border border-white/5 rounded-3xl shadow-soft",
        elevated && "bg-ink-900/85 border-white/10",
        padded && "p-6",
        glowing && "shadow-glow border-flare-400/30",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }: { title: string; subtitle?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-flare-500/15 border border-flare-400/25 flex items-center justify-center text-flare-300">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink-50 leading-tight">{title}</h3>
          {subtitle && <p className="text-sm text-ink-50/55 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
