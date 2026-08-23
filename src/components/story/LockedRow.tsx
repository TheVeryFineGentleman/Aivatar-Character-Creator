import { Lock } from "lucide-react";

/**
 * Eine Option, die gerade nicht wirkt — sichtbar, gesperrt, mit Grund.
 *
 * Der Grundsatz dahinter: nichts löschen, nichts still lügen lassen. Bisher
 * verschwanden solche Optionen einfach aus dem Layout (oder blieben schlimmer:
 * sichtbar angehakt, obwohl die Wirkbedingung nicht erfüllt war). Beides lässt
 * den Nutzer im Unklaren darüber, ob er etwas falsch macht oder die App.
 */
export function LockedRow({ title, reason }: { title: string; reason: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl border border-white/8 bg-ink-950/40 opacity-70">
      <Lock className="w-3.5 h-3.5 text-ink-50/40 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <div className="text-xs font-medium text-ink-50/70">{title}</div>
        <div className="text-[11px] text-ink-50/45 mt-0.5 leading-tight">{reason}</div>
      </div>
    </div>
  );
}
