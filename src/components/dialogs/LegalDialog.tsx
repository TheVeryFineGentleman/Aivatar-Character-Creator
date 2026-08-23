/**
 * Inline legal dialog — used by pages that want to surface Datenschutz / Impressum
 * without forcing a navigation away from the current flow.
 */
import { Scale, ShieldCheck, FileText, ExternalLink } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Link } from "react-router-dom";

type Section = "privacy" | "terms" | "imprint";

interface Props {
  open: boolean;
  section?: Section;
  onClose: () => void;
}

export function LegalDialog({ open, section = "privacy", onClose }: Props) {
  const body = (() => {
    switch (section) {
      case "terms": return <Terms />;
      case "imprint": return <Imprint />;
      default: return <Privacy />;
    }
  })();

  const title = section === "terms" ? "Nutzungsbedingungen" : section === "imprint" ? "Impressum" : "Datenschutz";
  const Icon = section === "terms" ? FileText : section === "imprint" ? Scale : ShieldCheck;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Kurze Zusammenfassung — volle Version unter /legal."
      size="lg"
      footer={
        <div className="flex justify-between gap-3 items-center">
          <Link to="/legal" className="text-xs text-ink-50/55 hover:text-flare-300 inline-flex items-center gap-1">
            Volle Version öffnen <ExternalLink className="w-3 h-3" />
          </Link>
          <Button onClick={onClose}>Schließen</Button>
        </div>
      }
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-flare-500/12 border border-flare-400/25 flex items-center justify-center text-flare-300 flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="text-sm text-ink-50/65 leading-relaxed">{body}</div>
      </div>
    </Dialog>
  );
}

function Privacy() {
  return (
    <div className="space-y-3">
      <p>Aivatar verarbeitet keine personenbezogenen Daten auf eigenen Servern, die über den Lizenzschlüssel hinausgehen.</p>
      <ul className="list-disc list-inside space-y-1 text-ink-50/55">
        <li>API-Keys und Login bleiben im LocalStorage deines Browsers.</li>
        <li>KI-Anfragen gehen direkt an Google Gemini bzw. fal.ai.</li>
        <li>Kein Drittanbieter-Tracking, keine Analytics, keine Cookies außer Session-Speicher.</li>
        <li>Lizenz-Server speichert E-Mail + Lizenzstatus (Stripe / Digistore24).</li>
      </ul>
    </div>
  );
}

function Terms() {
  return (
    <div className="space-y-3">
      <p>Mit Nutzung von Aivatar bestätigst du:</p>
      <ul className="list-disc list-inside space-y-1 text-ink-50/55">
        <li>Du nutzt deinen eigenen Google / fal.ai API-Key und übernimmst die anfallenden Kosten.</li>
        <li>Du bist für die generierten Inhalte verantwortlich und stellst sicher, dass keine Rechte Dritter verletzt werden.</li>
        <li>Lizenzschlüssel sind personengebunden und nicht übertragbar.</li>
        <li>Refunds werden gemäß den Bedingungen von Digistore24 bzw. Stripe abgewickelt.</li>
      </ul>
    </div>
  );
}

function Imprint() {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-ink-50/85">Anbieter: Aivatar Studio</p>
      <p>Kontakt: support@aivatar.app</p>
      <p className="text-xs text-ink-50/55">Verantwortlich gemäß § 18 Abs. 2 MStV: Aivatar Team.</p>
    </div>
  );
}
