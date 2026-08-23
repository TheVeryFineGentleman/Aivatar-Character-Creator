import { Lock } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  /** Ein Satz, was diese Wahl bewirkt — steht unter dem Label in der Kachel. */
  hint?: string;
  /** Gesetzt = Option sichtbar, aber gesperrt; der Text nennt den Grund.
   *  Bewusst sichtbar-gesperrt statt ausgeblendet: eine Option, die spurlos
   *  verschwindet, sieht aus wie ein Fehler der App. */
  lockedReason?: string;
}

/**
 * Die eine Kachel-Auswahl für die ganze Seite.
 *
 * Ersetzt fünf handgebaute Chip-Gruppen mit praktisch identischem Tailwind
 * (Modus, Erzählform, Wer redet, Dialog-Modus, Reihenfolge). Jede hatte ihre
 * eigene Optik und ihre eigene Art, den Untertext unterzubringen — dieselbe
 * Entscheidung sah dadurch an fünf Stellen verschieden aus.
 */
export function SegmentedChoice<T extends string>({
  label, hint, value, options, onChange, columns = 2,
}: {
  label?: string;
  hint?: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (v: T) => void;
  columns?: 2 | 3;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="text-xs font-medium text-ink-50">{label}</div>
      )}
      {hint && <div className="text-[11px] text-ink-50/55 leading-tight">{hint}</div>}
      <div className={cn("grid gap-1.5", columns === 3 ? "grid-cols-3" : "grid-cols-2")}>
        {options.map((o) => {
          const locked = !!o.lockedReason;
          const active = value === o.value && !locked;
          return (
            <button
              key={o.value}
              type="button"
              disabled={locked}
              onClick={() => onChange(o.value)}
              title={o.lockedReason || o.hint}
              className={cn(
                "text-left rounded-xl border px-3 py-2 transition-all",
                locked
                  ? "border-white/8 bg-ink-950/40 cursor-not-allowed opacity-60"
                  : "active:scale-[0.98]",
                active
                  ? "border-flare-400/70 bg-flare-500/15"
                  : !locked && "border-white/10 bg-ink-900/40 hover:border-flare-400/30",
              )}
            >
              <div className={cn(
                "text-xs font-medium flex items-center gap-1.5",
                active ? "text-flare-200" : "text-ink-50/80",
              )}>
                {locked && <Lock className="w-3 h-3 flex-shrink-0" />}
                {o.label}
              </div>
              {(o.lockedReason || o.hint) && (
                <div className="text-[10px] text-ink-50/50 mt-0.5 leading-tight">
                  {o.lockedReason || o.hint}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
