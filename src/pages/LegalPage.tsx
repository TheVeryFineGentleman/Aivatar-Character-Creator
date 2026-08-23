import { Scale, ShieldCheck, FileText, Cookie } from "lucide-react";
import { PageHeader } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function LegalPage() {
  return (
    <div>
      <PageHeader
        title="Rechtliches"
        subtitle="Impressum, Datenschutz und AGB — auf einer Seite."
        badge={<Badge><Scale className="w-3 h-3" /> Legal</Badge>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <SmallCard icon={<FileText className="w-4 h-4" />} title="Impressum" body="Verantwortlich gemäß §5 TMG: Aivatar GbR, Musterstraße 1, 10115 Berlin." />
        <SmallCard icon={<ShieldCheck className="w-4 h-4" />} title="Datenschutz" body="Wir speichern deinen API-Key niemals serverseitig. Lizenz-Daten ausschließlich für Zugriffskontrolle." />
        <SmallCard icon={<Cookie className="w-4 h-4" />} title="Cookies" body="Nur funktionale Cookies, keine Tracker. Du kannst Cookies jederzeit löschen." />
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-3">Nutzungsbedingungen (Kurzfassung)</h2>
        <ul className="space-y-2.5 text-sm text-ink-50/75">
          <li>1. Du nutzt das Tool mit deinem eigenen Gemini- bzw. fal.ai-Key. Verbrauch und Abrechnung erfolgen direkt mit Google / fal.ai.</li>
          <li>2. Erzeugte Inhalte gehören dir, im Rahmen der jeweiligen KI-Anbieter-Lizenzen.</li>
          <li>3. Es ist untersagt, mit dem Tool Inhalte zu erstellen, die gegen geltendes Recht verstoßen oder Persönlichkeitsrechte Dritter verletzen.</li>
          <li>4. Kein Anspruch auf Verfügbarkeit der externen KI-Dienste. Wir können Rate-Limits, Ausfälle oder Modell-Änderungen nicht beeinflussen.</li>
          <li>5. Lizenzschlüssel sind nicht übertragbar. Missbrauch führt zur Sperrung ohne Erstattung.</li>
        </ul>
      </Card>

      <Card className="mt-4">
        <h2 className="text-lg font-semibold mb-3">Datenschutz im Detail</h2>
        <div className="space-y-3 text-sm text-ink-50/75">
          <p>API-Keys werden ausschließlich im <code className="font-mono text-flare-300 bg-white/5 px-1 rounded">localStorage</code> deines Browsers gespeichert. Die App sendet sie direkt von deinem Gerät an Google bzw. fal.ai — niemals an unsere Server.</p>
          <p>Lizenz-Verifikation läuft über unseren Server (E-Mail + Schlüssel). Es werden keine generierten Bilder oder Texte gespeichert.</p>
          <p>Projekt-Daten kannst du optional in unserem DigitalOcean-Spaces-Storage ablegen — nur dann werden Dateien serverseitig gespeichert (verschlüsselt at-rest).</p>
        </div>
      </Card>
    </div>
  );
}

function SmallCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-flare-500/15 border border-flare-400/25 flex items-center justify-center text-flare-300 flex-shrink-0">
          {icon}
        </div>
        <div>
          <div className="text-sm font-semibold mb-0.5">{title}</div>
          <div className="text-xs text-ink-50/55 leading-relaxed">{body}</div>
        </div>
      </div>
    </Card>
  );
}
