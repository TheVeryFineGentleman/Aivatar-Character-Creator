import { useEffect, useRef, useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

type SlotStatus = "pending" | "loading" | "done" | "error" | "idle";

interface Props {
  /** Status des Slots (oder generischer Stati: idle/loading/done/error) */
  status: SlotStatus;
  /** Erwartete Dauer der Generierung in ms — bestimmt, wie schnell die Fake-Progress
   *  asymptotisch auf ~92% kriecht. Default: 25 s. */
  expectedMs?: number;
  /** Optional zusätzliche Klassen für den Container */
  className?: string;
  /** Bar-Höhe in tailwind units. Default: medium. */
  barSize?: "thin" | "medium" | "thick";
}

const sizeClass = { thin: "h-1", medium: "h-1.5", thick: "h-2" } as const;

/**
 * Two-part progress UI:
 *  - A bottom progress bar (asymptotic crawl while loading, smooths to 100% on
 *    done, then fades out).
 *  - On the loading → done transition, a large success checkmark pops up from
 *    the centre of the slot, bounces once, and slides out upward.
 *
 * No small corner-badge anymore; the centre flash is the only success cue.
 */
export function SlotProgress({
  status,
  expectedMs = 25000,
  className,
  barSize = "medium",
}: Props) {
  const [progress, setProgress] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  const [barVisible, setBarVisible] = useState(false);
  const startRef = useRef<number | null>(null);
  const prevStatusRef = useRef<SlotStatus>(status);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status === "loading") {
      setProgress(0);
      setShowFlash(false);
      setBarVisible(true);
      startRef.current = Date.now();
      const id = window.setInterval(() => {
        const elapsed = Date.now() - (startRef.current ?? Date.now());
        // Asymptotic curve approaching 92%. The final 8% are the "done" jump.
        const p = (1 - Math.exp(-elapsed / (expectedMs / 3))) * 92;
        setProgress(Math.min(92, p));
      }, 120);
      return () => window.clearInterval(id);
    }

    if (status === "done") {
      // Smooth the bar to 100%, then fade it out via CSS animation.
      setBarVisible(true);
      setProgress(100);
      // Trigger the centre flash only on the loading → done transition.
      if (prev === "loading") {
        setShowFlash(true);
        const flashEnd = window.setTimeout(() => setShowFlash(false), 1500);
        const barEnd = window.setTimeout(() => setBarVisible(false), 800);
        return () => { window.clearTimeout(flashEnd); window.clearTimeout(barEnd); };
      }
      // Already in "done" (e.g. mount on a finished slot) — no flash, no bar.
      setBarVisible(false);
      return;
    }

    if (status === "error") {
      setBarVisible(true);
      // freeze the bar wherever it was
      return;
    }

    // pending / idle
    setProgress(0);
    setShowFlash(false);
    setBarVisible(false);
  }, [status, expectedMs]);

  const isLoading = status === "loading";
  const isError = status === "error";
  const isDone = status === "done";

  return (
    <>
      {/* ── Centre success flash ──────────────────────────────────────────── */}
      {showFlash && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="animate-success-flash w-20 h-20 rounded-full bg-success/95 shadow-[0_8px_40px_-4px_rgba(16,185,129,0.55)] flex items-center justify-center backdrop-blur">
            <Check className="w-10 h-10 text-white" strokeWidth={3} />
          </div>
        </div>
      )}

      {/* ── Bottom progress bar ───────────────────────────────────────────── */}
      {barVisible && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 px-2.5 pb-2 z-20",
            className,
            // When we transition into "done" we fade the bar out after a short hold.
            isDone && "animate-progress-fadeout",
          )}
        >
          <div className={cn("rounded-full bg-ink-950/75 backdrop-blur overflow-hidden border border-white/8", sizeClass[barSize])}>
            <div
              className={cn(
                "h-full rounded-full relative",
                isError ? "bg-danger" : isDone ? "bg-success" : "bg-gradient-to-r from-flare-400 to-flare-600",
                // Smooth the width changes — slow during loading crawl, snappy on done.
                isDone
                  ? "transition-[width] duration-500 ease-out"
                  : "transition-[width] duration-300 ease-out",
              )}
              style={{ width: isError ? "100%" : `${progress}%` }}
            >
              {isLoading && progress > 0 && (
                <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)] bg-[length:200%_100%] animate-shimmer" />
              )}
            </div>
          </div>
          {isError && (
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-danger">
              <AlertTriangle className="w-3 h-3" /> Fehler
            </div>
          )}
        </div>
      )}
    </>
  );
}
