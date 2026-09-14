import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AppWindow } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getTabLockState, subscribeTabLock, takeOverTab } from "@/lib/tabLock";

/**
 * Lässt die App nur im speichernden Tab laufen — siehe `lib/tabLock`.
 *
 * Ein von Anfang an gesperrter Tab lädt die App gar nicht: ohne geladenen Stand
 * gibt es nichts Altes, das er irgendwohin schreiben könnte. Ein Tab, der die
 * Sperre VERLIERT, behält die App darunter (sie ist ja schon geladen), speichert
 * aber nichts mehr — das erzwingt `ls` selbst, dieser Hinweis erklärt es nur.
 */
export function TabLockGate({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribeTabLock, getTabLockState);

  // Ein, zwei Ticks bis zur Entscheidung: nichts zeigen, statt die App anlaufen
  // zu lassen — die würde sonst schon beim Start speichern wollen.
  if (state === "checking") return null;
  if (state === "blocked") return <TabLockNotice lost={false} />;
  return (
    <>
      {children}
      {state === "lost" && <TabLockNotice lost />}
    </>
  );
}

function TabLockNotice({ lost }: { lost: boolean }) {
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-ink-950/75 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-ink-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-6">
        <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-flare-300 mb-4">
          <AppWindow className="w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-ink-50">
          {lost ? "Du arbeitest jetzt in einem anderen Tab" : "Die App ist schon in einem anderen Tab offen"}
        </h2>
        <p className="text-sm text-ink-50/65 mt-2 leading-relaxed">
          {lost
            ? "Dieser Tab speichert nichts mehr, damit er deine Arbeit dort nicht mit einem alten Stand überschreibt."
            : "Damit sich zwei Tabs nicht gegenseitig deine Projekte überschreiben, arbeitet immer nur einer. Wechsle zum anderen Tab — oder arbeite hier weiter, dann wird der andere gesperrt."}
        </p>
        <p className="text-xs text-ink-50/45 mt-3">
          {lost
            ? "Weiterarbeiten lädt diesen Tab neu, mit dem aktuellen Stand."
            : "Schließt du den anderen Tab, geht es hier von selbst weiter."}
        </p>
        <div className="mt-6 flex justify-end">
          <Button onClick={takeOverTab} autoFocus>Hier weiterarbeiten</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
