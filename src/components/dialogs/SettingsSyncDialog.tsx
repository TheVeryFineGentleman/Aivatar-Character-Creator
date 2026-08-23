import { useEffect, useState } from "react";
import { Loader2, Wand2, ArrowRight } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { SYNC_FIELDS, type SyncFieldKey, type SyncProposal, type SyncTrigger } from "@/lib/settingsSync";

export type SyncPhase = "ask" | "loading" | "review";

interface Props {
  open: boolean;
  trigger: SyncTrigger | null;
  phase: SyncPhase;
  /** Die Felder, die dieser Auslöser überhaupt betrifft — für die Frage-Ansicht. */
  scope: SyncFieldKey[];
  proposals: SyncProposal[];
  /** „Ja, anpassen" — erst hier läuft der (kostenpflichtige) KI-Aufruf los. */
  onConfirmAsk: () => void;
  onApply: (picked: SyncProposal[]) => void;
  /** „Nein" / „Verwerfen" / Escape / Klick daneben. */
  onClose: () => void;
}

/**
 * DER ABGLEICH-DIALOG.
 *
 * Er erscheint, NACHDEM eine große Einstellung umgestellt wurde — die
 * Umschaltung selbst blockiert er nie. Sie ist bereits passiert und wäre auch
 * für sich genommen gültig; hier geht es nur um die Felder drumherum.
 *
 * DREI SCHRITTE, UND DER ERSTE KOSTET NICHTS:
 *   ask     — die Frage, rein lokal. Wer die Kacheln nur durchprobiert, zahlt
 *             dafür keinen einzigen KI-Aufruf.
 *   loading — ein Aufruf für ALLE Felder (nicht einer pro Feld).
 *   review  — die Vorschläge mit Vorher/Nachher, zeilenweise abwählbar.
 *
 * WARUM NICHT DIREKT ANWENDEN, wie ursprünglich gewünscht: An den Feldern steht
 * nicht, woher ihr Inhalt stammt. Ein selbst getippter Hook sieht für den Code
 * genauso aus wie ein generierter — ohne sichtbares Vorher/Nachher könnte der
 * Abgleich also stillschweigend eigene Arbeit überschreiben. Die Liste ist
 * komplett vorgehakt, „Übernehmen" ist damit weiterhin EIN Klick.
 */
export function SettingsSyncDialog({
  open, trigger, phase, scope, proposals, onConfirmAsk, onApply, onClose,
}: Props) {
  // Welche Zeilen sind angehakt? Schlüssel statt Index, damit ein neuer Lauf mit
  // anderer Länge die Auswahl nicht verschiebt.
  const [picked, setPicked] = useState<Set<SyncFieldKey>>(new Set());

  // Jede neue Vorschlagsliste startet vollständig angehakt.
  useEffect(() => {
    setPicked(new Set(proposals.map((p) => p.key)));
  }, [proposals]);

  if (!trigger) return null;

  const toggle = (key: SyncFieldKey) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const chosen = proposals.filter((p) => picked.has(p.key));

  const title = phase === "review"
    ? "Das würde die KI anpassen"
    : `„${trigger.toLabel}" ist jetzt eingestellt`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={title}
      subtitle={phase === "review"
        ? `Ausgelöst durch: ${trigger.title} — „${trigger.fromLabel}" → „${trigger.toLabel}"`
        : undefined}
      footer={
        phase === "review" ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setPicked(chosen.length ? new Set() : new Set(proposals.map((p) => p.key)))}
              className="text-xs text-ink-50/55 hover:text-ink-50 transition-colors"
            >
              {chosen.length ? "Alle abwählen" : "Alle auswählen"}
            </button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose}>Verwerfen</Button>
              <Button
                variant="primary"
                disabled={chosen.length === 0}
                onClick={() => onApply(chosen)}
              >
                Übernehmen{chosen.length ? ` (${chosen.length})` : ""}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Nein, so lassen</Button>
            <Button
              variant="primary"
              loading={phase === "loading"}
              onClick={onConfirmAsk}
              iconLeft={phase === "loading" ? undefined : <Wand2 className="w-4 h-4" />}
            >
              {phase === "loading" ? "Die KI liest deine Einstellungen…" : "Ja, anpassen"}
            </Button>
          </div>
        )
      }
    >
      {phase === "review" ? (
        <div className="space-y-3">
          {proposals.map((p) => {
            const on = picked.has(p.key);
            return (
              <label
                key={p.key}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                  on ? "border-flare-400/50 bg-flare-500/8" : "border-white/8 bg-ink-950/40 hover:border-white/15",
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(p.key)}
                  className="rounded mt-0.5 flex-shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="text-xs font-medium text-ink-50">{p.label}</div>
                  {/* Der alte Wert steht ungekürzt da — ohne ihn kann niemand
                      beurteilen, ob er gerade eigene Arbeit wegwirft. */}
                  <div className="text-[11px] leading-snug">
                    <div className="text-ink-50/45">
                      {p.before.trim() ? p.before : <span className="italic">war leer</span>}
                    </div>
                    <div className="flex items-start gap-1.5 mt-1 text-flare-200">
                      <ArrowRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <span>{p.after}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-ink-50/40 leading-tight">{p.reason}</div>
                </div>
              </label>
            );
          })}
          <p className="text-[11px] text-ink-50/45 leading-relaxed">
            Deine Idee und die bereits erzeugten Szenen bleiben unverändert.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-50/80 leading-relaxed">
            Diese Felder hängen an der Einstellung, die du gerade geändert hast, und passen
            vielleicht nicht mehr dazu:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {scope.map((key) => (
              <span
                key={key}
                className="text-[11px] px-2 py-1 rounded-lg bg-ink-950/60 border border-white/8 text-ink-50/70"
              >
                {SYNC_FIELDS[key].label}
              </span>
            ))}
          </div>
          <p className="text-sm text-ink-50/80 leading-relaxed">
            Soll die KI sie an deine aktuellen Optionen anpassen? Du siehst danach jede
            Änderung einzeln und entscheidest, was übernommen wird.
          </p>
          <p className="text-[11px] text-ink-50/45 leading-relaxed">
            Deine Idee und die bereits erzeugten Szenen bleiben unverändert.
          </p>
          {phase === "loading" && (
            <div className="flex items-center gap-2 text-xs text-ink-50/55">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Einen Moment — das ist ein einzelner Lauf für alle Felder.
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
