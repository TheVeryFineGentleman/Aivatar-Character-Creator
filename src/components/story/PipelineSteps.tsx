import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export type PipelineState = "todo" | "running" | "done";

/**
 * Die Landkarte über der ganzen Seite: wo stehe ich, was kommt noch?
 *
 * Vorher musste man aus der wechselnden Beschriftung EINES Knopfes erraten,
 * wie viele Etappen es überhaupt gibt und wie teuer die nächste wird.
 */
export function PipelineSteps({ steps }: { steps: { label: string; state: PipelineState }[] }) {
  return (
    <ol className="flex items-center gap-1.5 flex-wrap">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium",
              s.state === "done"   && "border-flare-400/40 bg-flare-500/12 text-flare-200",
              s.state === "running"&& "border-flare-400/60 bg-flare-500/20 text-flare-100",
              s.state === "todo"   && "border-white/8 bg-ink-950/50 text-ink-50/45",
            )}
          >
            {s.state === "done"    && <Check className="w-3 h-3" />}
            {s.state === "running" && <Loader2 className="w-3 h-3 animate-spin" />}
            {s.state === "todo"    && <span className="w-3 text-center">{i + 1}</span>}
            {s.label}
          </div>
          {i < steps.length - 1 && <span className="text-ink-50/20 text-xs">→</span>}
        </li>
      ))}
    </ol>
  );
}
