import { type ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useProjectValue } from "@/hooks/useProjectGallery";
import { cn } from "@/lib/cn";

/**
 * Ein Schritt im geführten Reel-Aufbau.
 *
 * Der Nutzer geht von oben nach unten: Nummer, eine Frage als Überschrift, ein
 * Satz Erklärung, dann die Bedienelemente. Alles, was man selten braucht, liegt
 * im Ausklapper „Mehr einstellen" — die Optionen sind also weiterhin ALLE da,
 * nur nicht alle gleichzeitig sichtbar.
 *
 * Der Ausklapp-Zustand wird PRO PROJEKT gespeichert (`advKey`). Vorher gab es
 * genau einen globalen, nicht persistierten „Erweitert"-Schalter für die halbe
 * Seite: wer eine Feineinstellung suchte, klappte damit vier fremde Bereiche
 * mit auf und fand sie nach dem nächsten Laden wieder zu.
 */
export function StepCard({
  step, title, intro, status, advKey, advanced, children, id,
}: {
  step: number;
  title: string;
  intro: string;
  /** Kurzer Zustand rechts oben, z. B. „2 Personen" — `null` = „noch offen". */
  status?: string | null;
  advKey: string;
  advanced?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const [open, setOpen] = useProjectValue<boolean>(advKey, false);

  return (
    <Card id={id} className="scroll-mt-24">
      <div className="flex items-start gap-3 mb-5">
        <div
          className={cn(
            "flex-shrink-0 w-9 h-9 rounded-2xl border flex items-center justify-center text-sm font-semibold",
            status
              ? "bg-flare-500/20 border-flare-400/40 text-flare-200"
              : "bg-white/5 border-white/10 text-ink-50/60",
          )}
          aria-hidden="true"
        >
          {status ? <Check className="w-4 h-4" /> : step}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-ink-50 leading-tight">
            <span className="text-ink-50/40 mr-1.5">{step}.</span>
            {title}
          </h3>
          <p className="text-sm text-ink-50/55 mt-0.5">{intro}</p>
        </div>
        {status && (
          <span className="flex-shrink-0 text-[11px] px-2 py-1 rounded-lg bg-flare-500/12 border border-flare-400/25 text-flare-200">
            {status}
          </span>
        )}
      </div>

      <div className="space-y-4">{children}</div>

      {advanced && (
        <div className="mt-5 pt-4 border-t border-white/8">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="flex items-center gap-1.5 text-xs font-medium text-ink-50/60 hover:text-flare-200 transition-colors"
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
            {open ? "Weniger anzeigen" : "Mehr einstellen"}
          </button>
          {/* Bewusst echtes bedingtes Rendern statt max-h-0: eine nur optisch
              versteckte Option bleibt sonst für Tastatur und Screenreader
              erreichbar und die Tab-Reihenfolge springt ins Unsichtbare. */}
          {open && <div className="mt-4 space-y-4">{advanced}</div>}
        </div>
      )}
    </Card>
  );
}
