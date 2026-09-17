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
        <SmallCard icon={<ShieldCheck className="w-4 h-4" />} title="Datenschutz" body="Deine API-Keys bleiben im Browser — nur wenn du es ausdrücklich einschaltest, liegen sie verschlüsselt in deinem Konto. Lizenz-Daten dienen der Zugriffskontrolle." />
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
          <li>6. Deine Projekte werden in deinem Konto gespeichert, damit sie nach dem Login in jedem Browser verfügbar sind. Deine API-Keys speichern wir nur, wenn du das in den Einstellungen ausdrücklich einschaltest — siehe „API-Keys im Konto“.</li>
        </ul>
      </Card>

      <Card className="mt-4">
        <h2 className="text-lg font-semibold mb-3">API-Keys im Konto (freiwillig)</h2>
        <div className="space-y-3 text-sm text-ink-50/75">
          <p><strong className="text-ink-50">Standard ist aus.</strong> Ohne dein Zutun bleiben deine API-Keys (Google Gemini, fal.ai, ElevenLabs) ausschließlich im Speicher deines Browsers.</p>
          <p>In den Einstellungen kannst du „Keys in meinem Konto speichern“ ankreuzen. Erst nach deiner Bestätigung im darauf folgenden Hinweis werden die Keys übertragen. Zustimmung, Zeitpunkt und Fassung dieses Hinweises halten wir fest.</p>
          <p><strong className="text-ink-50">Zweck:</strong> ausschließlich, um dir deine Keys nach dem Login in jedem Browser und auf jedem Gerät wieder bereitzustellen. Wir nutzen sie für nichts anderes und geben sie nicht an Dritte weiter.</p>
          <p><strong className="text-ink-50">Schutz:</strong> Die Keys werden verschlüsselt gespeichert (AES-256-GCM). Der Schlüssel liegt getrennt von der Datenbank in der Server-Umgebung. Herausgegeben werden sie nur an deinen angemeldeten Zugang.</p>
          <p><strong className="text-ink-50">Widerruf:</strong> Entfernst du das Häkchen, löschen wir die Keys sofort aus deinem Konto. In dem Browser, in dem du gerade arbeitest, bleiben sie eingetragen. Unabhängig davon kannst du deine Keys jederzeit bei Google bzw. fal.ai zurückziehen.</p>
          <p><strong className="text-ink-50">Verbrauch:</strong> Die Nutzung deiner Keys rechnest du weiterhin direkt mit Google bzw. fal.ai ab. Für Kosten, die durch deine Keys entstehen, bist du verantwortlich.</p>
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="text-lg font-semibold mb-3">Datenschutz im Detail</h2>
        <div className="space-y-3 text-sm text-ink-50/75">
          <p>API-Keys liegen im <code className="font-mono text-flare-300 bg-white/5 px-1 rounded">localStorage</code> deines Browsers. Den Google-Key sendet die App direkt von deinem Gerät an Google. Der fal.ai- und der ElevenLabs-Key laufen für Bilder, Clips und Stimmen über unseren Server, der sie an den jeweiligen Anbieter durchreicht und nicht aufbewahrt. Dauerhaft gespeichert wird ein Key nur, wenn du „Keys in meinem Konto speichern“ einschaltest (siehe oben) — dann verschlüsselt.</p>
          <p>Lizenz-Verifikation läuft über unseren Server (E-Mail + Schlüssel). Es werden keine generierten Bilder oder Texte zur Auswertung gespeichert.</p>
          <p>Deine Projekte (Namen, Szenen, Texte, Einstellungen und die Verweise auf deine Dateien) speichern wir in deinem Konto, damit sie nach dem Login überall verfügbar sind. Die erzeugten Bilder, Videos und Sprachspuren liegen in unserem DigitalOcean-Spaces-Speicher. Löschst du ein Projekt, entfernen wir es samt seiner Dateien; ältere Fassungen halten wir kurzzeitig vor, damit versehentlich Überschriebenes zurückgeholt werden kann.</p>
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
