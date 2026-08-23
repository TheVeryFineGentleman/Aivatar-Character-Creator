import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type ProgressStatus = "idle" | "loading" | "done" | "error";

export function deriveSlotProgress<T extends { status: "pending" | "loading" | "done" | "error" }>(
  slots: T[],
  running: boolean,
): { status: ProgressStatus; current: number; total: number; errored: number } {
  const total = slots.length;
  const current = slots.filter((s) => s.status === "done").length;
  const errored = slots.filter((s) => s.status === "error").length;
  const settled = total > 0 && slots.every((s) => s.status === "done" || s.status === "error");
  const status: ProgressStatus =
    running ? "loading" :
    total === 0 ? "idle" :
    settled && errored === total ? "error" :
    settled ? "done" :
    "idle";
  return { status, current, total, errored };
}

interface Props {
  status: ProgressStatus;
  current?: number;
  total?: number;
  label?: string;
  doneLabel?: string;
  errorLabel?: string;
  hint?: string;
  indeterminate?: boolean;
  autoDismissMs?: number;
  className?: string;
}

export function ProgressBanner({
  status,
  current = 0,
  total = 0,
  label = "Wird generiert…",
  doneLabel = "Fertig",
  errorLabel = "Fehler bei der Generierung",
  hint,
  indeterminate,
  autoDismissMs = 1800,
  className,
}: Props) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(false);
    if (status === "done" && autoDismissMs > 0) {
      const t = setTimeout(() => setHidden(true), autoDismissMs);
      return () => clearTimeout(t);
    }
  }, [status, autoDismissMs]);

  if (status === "idle" || hidden) return null;

  const isDone = status === "done";
  const isErr = status === "error";
  const isLoading = status === "loading";
  const knownTotal = total > 0 && !indeterminate;
  const pct = knownTotal ? Math.min(100, Math.max(0, Math.round((current / total) * 100))) : 0;

  return (
    <div
      className={cn(
        "relative rounded-2xl border p-3.5 flex items-center gap-3 animate-slide-down",
        isDone && "border-success/30 bg-success/10",
        isErr && "border-danger/30 bg-danger/10",
        isLoading && "border-flare-400/30 bg-flare-500/10",
        className,
      )}
    >
      <div className="shrink-0">
        {isDone ? (
          <CheckCircle2 className="w-6 h-6 text-success animate-pop-in" />
        ) : isErr ? (
          <AlertCircle className="w-6 h-6 text-danger animate-shake" />
        ) : (
          <Loader2 className="w-6 h-6 text-flare-300 animate-spin" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <div
            className={cn(
              "text-sm font-medium truncate",
              isDone && "text-success",
              isErr && "text-danger",
              isLoading && "text-ink-50",
            )}
          >
            {isDone ? doneLabel : isErr ? errorLabel : label}
          </div>
          {isLoading && knownTotal && (
            <div className="text-xs text-ink-50/55 tabular-nums shrink-0">{current}/{total}</div>
          )}
          {isDone && knownTotal && (
            <div className="text-xs text-success/80 tabular-nums shrink-0">{current}/{total}</div>
          )}
        </div>

        <div className="h-1.5 rounded-full bg-ink-950/60 overflow-hidden relative">
          {isLoading && !knownTotal && (
            // Indeterminate sliding bar
            <div className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-flare-400 to-transparent animate-[indeterminate_1.6s_ease-in-out_infinite]" />
          )}
          {isLoading && knownTotal && (
            <>
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-flare-400 to-flare-600 transition-[width] duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full opacity-60 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] bg-[length:200%_100%] animate-shimmer"
                style={{ width: `${pct}%` }}
              />
            </>
          )}
          {isDone && (
            <div className="absolute inset-0 rounded-full bg-success" />
          )}
          {isErr && (
            <div className="absolute inset-0 rounded-full bg-danger" />
          )}
        </div>

        {hint && (
          <div className="text-[11px] text-ink-50/45 mt-1.5 truncate">{hint}</div>
        )}
      </div>
    </div>
  );
}
