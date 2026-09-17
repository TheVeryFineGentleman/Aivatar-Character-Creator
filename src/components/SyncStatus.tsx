import { useSyncExternalStore } from "react";
import { AlertTriangle, Cloud, CloudOff, Loader2 } from "lucide-react";
import { getSyncSnapshot, subscribeSync } from "@/lib/projectSync";
import { cn } from "@/lib/cn";

/** Kleine Anzeige in der Kopfleiste: sind die Projekte im Konto gespeichert? */
export function SyncStatus() {
  const s = useSyncExternalStore(subscribeSync, getSyncSnapshot);
  if (s.phase === "off") return null;

  const spinner = <Loader2 className="w-3.5 h-3.5 animate-spin" />;
  const warn = <AlertTriangle className="w-3.5 h-3.5" />;
  const view = {
    syncing: { icon: spinner, label: "Speichert …", tone: "text-ink-50/55" },
    pending: { icon: spinner, label: "Speichert …", tone: "text-ink-50/55" },
    saved:   { icon: <Cloud className="w-3.5 h-3.5" />, label: "Im Konto gespeichert", tone: "text-ink-50/55" },
    offline: { icon: <CloudOff className="w-3.5 h-3.5" />, label: "Offline – wird nachgeholt", tone: "text-warn" },
    limit:   { icon: warn, label: "Projekt-Limit im Konto erreicht", tone: "text-warn" },
    error:   { icon: warn, label: s.message || "Speichern im Konto fehlgeschlagen", tone: "text-warn" },
  }[s.phase];

  return (
    <span title={view.label} className={cn("hidden lg:flex items-center gap-1.5 text-[11px] whitespace-nowrap", view.tone)}>
      {view.icon}
      {view.label}
    </span>
  );
}
