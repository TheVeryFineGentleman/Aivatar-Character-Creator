import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * EIN Ladezustand pro Szenenkachel — mehr gibt es nicht.
 *
 * Vorher lagen vier Anzeigen auf derselben unteren Kante: der Video-Balken, der
 * Stimm-Balken, der Bild-Fortschritt (`SlotProgress`) und die Busy-Plakette des
 * Hover-Overlays. Bei einer Szene, die rendert UND vertont wird, stapelten sie
 * sich übereinander und deckten zusätzlich die Knöpfe darunter zu: Was gerade
 * lief, war nicht ablesbar, und der Knopf war nicht mehr erreichbar.
 *
 * Diese Leiste ist die einzige Stelle, die „es tut sich was" sagt. Sie liegt
 * über allem (z-40) und ist `pointer-events-none` — sie darf nichts wegklicken,
 * was unter ihr liegt.
 */
export function SceneBusyBar({
  label,
  pct,
  from,
  to,
  expectedMs = 25000,
  className,
}: {
  /** Was gerade läuft — in Nutzersprache, nicht als Statusname. */
  label: string;
  /**
   * Echter Fortschritt, wenn ihn jemand KENNT.
   * Sonst `null`/undefined → die Leiste kriecht asymptotisch, statt eine Zahl
   * zu behaupten, die niemand gemessen hat.
   */
  pct?: number | null;
  /** Erwartete Dauer für den Kriech-Verlauf. Nur ohne echtes `pct` benutzt. */
  expectedMs?: number;
  /**
   * ABSCHNITT, in dem dieser Schritt kriechen darf — z. B. [28, 88] fürs
   * Rendern. Damit setzt sich der Gesamtfortschritt aus den TATSÄCHLICHEN
   * Schritten zusammen: jeder beginnt dort, wo der vorige aufgehört hat.
   *
   * Warum das die alte Lösung ersetzt: die kam aus einem Tick-Zähler des Polls
   * (`5 + ticks*6`, gedeckelt bei 95). Der sprang nur, wenn eine Antwort kam,
   * und stand danach still — bei langen Renders minutenlang auf 95 %. Hier
   * läuft die Uhr, nicht der Zähler: die Leiste bewegt sich durchgehend.
   */
  from?: number;
  to?: number;
  className?: string;
}) {
  const determinate = typeof pct === "number" && Number.isFinite(pct);
  const ranged = !determinate && typeof from === "number" && typeof to === "number";
  const [crawl, setCrawl] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (determinate) return;
    startRef.current = Date.now();
    const lo = ranged ? (from as number) : 0;
    const hi = ranged ? (to as number) : 92;
    setCrawl(lo);
    const id = window.setInterval(() => {
      const elapsed = Date.now() - (startRef.current ?? Date.now());
      const span = Math.max(1, hi - lo);
      // Zwei Anteile, und die Gewichtung ist der Punkt:
      //  • die KURVE trägt den erwarteten Verlauf (schnell am Anfang, langsamer
      //    zum Ende). Sie bekommt aber nur 60 % des Abschnitts — bekäme sie
      //    alles, sättigte sie nach kurzer Zeit und die Leiste stünde still.
      //    Genau das war der alte Zustand: 95 % und dann minutenlang nichts.
      //  • der GLEICHMÄSSIGE Anteil (1 Prozentpunkt je 45 s) trägt den Rest und
      //    hält die Anzeige dauerhaft in Bewegung.
      // Nachgerechnet über 15 Minuten: die angezeigte Zahl steht nie länger als
      // 40 s still, und erst nach ~17 min läuft der Abschnitt voll. Ein Render,
      // der so lange braucht, ist ohnehin ein Fall für die Fehlermeldung.
      // Das Abschnittsende wird nie erreicht — fertig ist erst fertig.
      const eased = 1 - Math.exp(-2 * (elapsed / Math.max(1000, expectedMs)));
      const creep = elapsed / 45000;              // ~1 Prozentpunkt je 45 s
      setCrawl(lo + Math.min(span - 0.5, span * 0.6 * eased + creep));
    }, 120);
    return () => window.clearInterval(id);
  }, [determinate, ranged, from, to, expectedMs]);

  const value = determinate ? Math.max(0, Math.min(100, pct as number)) : crawl;

  return (
    <div className={cn("absolute inset-x-0 bottom-0 z-40 px-2 pb-2 pointer-events-none", className)}>
      <div className="rounded-lg bg-ink-950/90 backdrop-blur border border-white/10 px-2 py-1.5 shadow-lg">
        <div className="flex items-center justify-between gap-2 mb-1 text-[10px] text-ink-50/85">
          <span className="inline-flex items-center gap-1 min-w-0">
            <Loader2 className="w-3 h-3 shrink-0 animate-spin text-flare-300" />
            <span className="truncate">{label}</span>
          </span>
          {/* Die Zahl gibt es bei echtem Fortschritt UND bei einem Schritt mit
              bekanntem Abschnitt: dort ist sie zwar geschätzt, aber sie beruht
              auf dem tatsächlich laufenden Schritt und nicht auf einem
              Tick-Zähler. Nur der reine Kriech-Verlauf ohne Abschnitt bleibt
              ohne Zahl — dort wäre sie frei erfunden. */}
          {(determinate || ranged) && <span className="shrink-0 tabular-nums">{Math.round(value)}%</span>}
        </div>
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="relative h-full rounded-full bg-flare-grad transition-[width] duration-300 ease-out"
            style={{ width: `${value}%` }}
          >
            {value > 0 && (
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)] bg-[length:200%_100%] animate-shimmer" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
