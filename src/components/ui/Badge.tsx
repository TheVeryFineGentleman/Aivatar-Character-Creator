import { cn } from "@/lib/cn";

type Tone = "neutral" | "accent" | "cool" | "success" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-white/5 border-white/10 text-ink-50/80",
  accent: "bg-flare-500/15 border-flare-400/30 text-flare-200",
  cool: "bg-glacier-500/15 border-glacier-400/30 text-glacier-200",
  success: "bg-success/15 border-success/30 text-success",
  warn: "bg-warn/15 border-warn/30 text-warn",
  danger: "bg-danger/15 border-danger/30 text-danger",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border",
      tones[tone],
      className,
    )}>
      {children}
    </span>
  );
}
