/**
 * First-visit disclaimer: KI-Bilder, eigene API-Keys, kein Tracking.
 * Acceptance is stored locally, so it never reappears for that browser.
 */
import { useEffect, useState } from "react";
import { ShieldAlert, KeyRound, Lock } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { KEYS, ls } from "@/lib/storage";

export function DisclaimerPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ls.get<boolean>(KEYS.DISCLAIMER_SEEN)) {
      setOpen(true);
    }
  }, []);

  const accept = () => {
    ls.set(KEYS.DISCLAIMER_SEEN, true);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={accept}
      title="Willkommen im Avatar Creator Studio"
      subtitle="Drei kurze Dinge, bevor du loslegst."
      size="md"
      closeOnBackdrop={false}
      footer={
        <div className="flex justify-end">
          <Button onClick={accept}>Verstanden — loslegen</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Row
          icon={<ShieldAlert className="w-5 h-5" />}
          title="KI-generierte Inhalte"
          text="Alle Bilder werden von einer KI erzeugt. Es können Fehler, künstliche Artefakte oder unrealistische Details entstehen. Du bist verantwortlich für die Nutzung der erzeugten Inhalte."
        />
        <Row
          icon={<KeyRound className="w-5 h-5" />}
          title="Eigene API-Keys"
          text="Du nutzt deinen eigenen Google-Gemini-Key (und optional fal.ai). Wir leiten nichts an unsere Server weiter — alle KI-Calls gehen direkt von deinem Browser an Google."
        />
        <Row
          icon={<Lock className="w-5 h-5" />}
          title="Keine Tracker"
          text="Wir nutzen keine Analytics, kein Tracking, keine Drittanbieter-Cookies. Login-Daten und Projekte liegen nur in deinem Browser-Storage."
        />
      </div>
    </Dialog>
  );
}

function Row({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-2xl bg-flare-500/12 border border-flare-400/25 flex items-center justify-center text-flare-300 flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold mb-0.5">{title}</div>
        <div className="text-xs text-ink-50/65 leading-relaxed">{text}</div>
      </div>
    </div>
  );
}
