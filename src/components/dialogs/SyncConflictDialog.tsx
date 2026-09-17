import { useState, useSyncExternalStore } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { getSyncSnapshot, resolveConflict, subscribeSync } from "@/lib/projectSync";

/**
 * Ein Projekt wurde auf einem anderen Gerät gespeichert oder gelöscht, während
 * es hier noch Änderungen gab, die nicht im Konto waren. Nie still
 * überschreiben — der Kunde entscheidet.
 */
export function SyncConflictDialog() {
  const s = useSyncExternalStore(subscribeSync, getSyncSnapshot);
  const [busy, setBusy] = useState(false);
  const conflict = s.conflicts[0];
  if (!conflict) return null;

  const deleted = conflict.kind === "deleted";
  const choose = async (choice: "server" | "local") => {
    setBusy(true);
    try { await resolveConflict(conflict.id, choice); } finally { setBusy(false); }
  };

  return (
    <Dialog
      open
      onClose={() => { /* muss entschieden werden */ }}
      closeOnBackdrop={false}
      title={deleted ? "Projekt wurde anderswo gelöscht" : "Projekt wurde anderswo geändert"}
      subtitle={`„${conflict.name}“`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => choose("local")} disabled={busy}>
            {deleted ? "Hier behalten" : "Meinen Stand behalten"}
          </Button>
          <Button onClick={() => choose("server")} loading={busy}>
            {deleted ? "Auch hier löschen" : "Stand aus dem Konto laden"}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink-50/70 leading-relaxed">
        {deleted
          ? "Dieses Projekt wurde auf einem anderen Gerät oder in einem anderen Browser gelöscht. Hier gibt es aber noch Änderungen, die nicht im Konto sind."
          : "Dieses Projekt wurde auf einem anderen Gerät oder in einem anderen Browser gespeichert, während es hier noch Änderungen gab, die nicht im Konto sind."}
      </p>
      <p className="text-xs text-ink-50/55 mt-3 leading-relaxed">
        {deleted
          ? "„Hier behalten“ legt es wieder ins Konto. „Auch hier löschen“ entfernt die Änderungen hier."
          : "„Stand aus dem Konto laden“ verwirft die Änderungen hier. „Meinen Stand behalten“ schreibt deinen Stand ins Konto — der andere bleibt dort als ältere Fassung erhalten."}
      </p>
    </Dialog>
  );
}
