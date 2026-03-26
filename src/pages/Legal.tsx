import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Legal() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-6">Rechtliches</h1>

        <Tabs defaultValue="impressum" className="w-full">
          <TabsList className="grid grid-cols-3 bg-muted/50 p-1 rounded-lg mb-6">
            <TabsTrigger
              value="impressum"
              className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
            >
              Impressum
            </TabsTrigger>
            <TabsTrigger
              value="datenschutz"
              className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
            >
              Datenschutz
            </TabsTrigger>
            <TabsTrigger
              value="agb"
              className="rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
            >
              AGB
            </TabsTrigger>
          </TabsList>

          <div className="bg-card border border-border rounded-xl p-6">
            <TabsContent value="impressum" className="mt-0">
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-6 text-sm">
                  <h2 className="text-2xl font-bold text-primary">IMPRESSUM</h2>
                  <div className="space-y-4">
                    <div>
                      <p className="text-muted-foreground">
                        Trevionis LLC<br />
                        2201 MENAUL BLVD NE STE A<br />
                        87107 Albuquerque<br />
                        NM USA
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:</h3>
                      <p className="text-muted-foreground">
                        Torsten Jaeger
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="datenschutz" className="mt-0">
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-6 text-sm">
                  <h2 className="text-2xl font-bold text-primary">DATENSCHUTZERKLÄRUNG</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">1. Datenschutz auf einen Blick</h3>
                      <h4 className="font-medium text-foreground mt-3 mb-1">Allgemeine Hinweise</h4>
                      <p className="text-muted-foreground">
                        Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Datenerfassung auf dieser Website</h4>
                      <p className="text-muted-foreground">
                        <strong>Wer ist verantwortlich für die Datenerfassung auf dieser Website?</strong><br />
                        Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.
                      </p>
                      <p className="text-muted-foreground mt-2">
                        <strong>Wie erfassen wir Ihre Daten?</strong><br />
                        Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere IT-Systeme erfasst.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Wofür nutzen wir Ihre Daten?</h4>
                      <p className="text-muted-foreground">
                        Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website zu gewährleisten. Andere Daten können zur Analyse Ihres Nutzerverhaltens verwendet werden.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Welche Rechte haben Sie bezüglich Ihrer Daten?</h4>
                      <p className="text-muted-foreground">
                        Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">2. Hosting</h3>
                      <p className="text-muted-foreground">
                        Die Website wird auf Servern von spezialisierten Hosting-Anbietern gehostet. Personenbezogene Daten, die auf dieser Website erfasst werden, werden auf den Servern des Hosters gespeichert.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">3. Allgemeine Hinweise und Pflichtinformationen</h3>
                      <h4 className="font-medium text-foreground mt-3 mb-1">Datenschutz</h4>
                      <p className="text-muted-foreground">
                        Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Hinweis zur verantwortlichen Stelle</h4>
                      <p className="text-muted-foreground">
                        Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:<br /><br />
                        Digital Rocket Ltd<br />
                        Torsten Jaeger<br />
                        Keryneias Mansion, App. 102, Keryneias Street 16<br />
                        7040 Oroclini<br />
                        Zypern<br /><br />
                        Email: info(at)torstenjaeger.com
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Speicherdauer</h4>
                      <p className="text-muted-foreground">
                        Soweit innerhalb dieser Datenschutzerklärung keine speziellere Speicherdauer genannt wurde, verbleiben Ihre personenbezogenen Daten bei uns, bis der Zweck für die Datenverarbeitung entfällt.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">4. Datenerfassung auf dieser Website</h3>
                      <h4 className="font-medium text-foreground mt-3 mb-1">Cookies</h4>
                      <p className="text-muted-foreground">
                        Unsere Internetseiten verwenden so genannte "Cookies". Cookies sind kleine Textdateien und richten auf Ihrem Endgerät keinen Schaden an.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Server-Log-Dateien</h4>
                      <p className="text-muted-foreground">
                        Der Provider der Seiten erhebt und speichert automatisch Informationen in so genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">5. Newsletter</h3>
                      <p className="text-muted-foreground">
                        Wenn Sie den auf der Website angebotenen Newsletter beziehen möchten, benötigen wir von Ihnen eine E-Mail-Adresse sowie Informationen, welche uns die Überprüfung gestatten, dass Sie der Inhaber der angegebenen E-Mail-Adresse sind.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">6. Plugins und Tools</h3>
                      <p className="text-muted-foreground">
                        Diese Website nutzt verschiedene Plugins und Tools zur Verbesserung der Nutzererfahrung.
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mt-6">
                        Die vollständige Datenschutzerklärung finden Sie unter:{" "}
                        <a href="https://aivatarsacademy.online/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          https://aivatarsacademy.online/datenschutz
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="agb" className="mt-0">
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-6 text-sm">
                  <h2 className="text-2xl font-bold text-primary">ALLGEMEINE GESCHÄFTSBEDINGUNGEN (AGB)</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">1. Geltungsbereich</h3>
                      <p className="text-muted-foreground">Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen:</p>
                      <p className="text-muted-foreground mt-2">
                        Trevionis LLC<br />2201 MENAUL BLVD NE STE A<br />87107 Albuquerque<br />NM USA
                      </p>
                      <p className="text-muted-foreground mt-2">– nachfolgend „Anbieter" –</p>
                      <p className="text-muted-foreground mt-2">und den Nutzern der angebotenen digitalen Inhalte, Produkte und Dienstleistungen.</p>
                      <p className="text-muted-foreground mt-2">Abweichende Bedingungen des Nutzers werden nicht anerkannt.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">2. Vertragsgegenstand</h3>
                      <p className="text-muted-foreground">Der Anbieter bietet digitale Produkte und Dienstleistungen an, insbesondere:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Onlinekurse und Schulungen</li>
                        <li>Softwarelösungen und Tools (inkl. KI-basierter Anwendungen)</li>
                        <li>digitale Inhalte (z. B. Videos, Texte, Vorlagen)</li>
                        <li>Affiliate-Angebote und Empfehlungen</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Die konkreten Inhalte ergeben sich aus der jeweiligen Produktbeschreibung.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">3. Vertragsschluss</h3>
                      <p className="text-muted-foreground">Der Vertrag kommt zustande, sobald der Nutzer:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>ein Produkt auswählt</li>
                        <li>den Bestellprozess durchläuft</li>
                        <li>und die Zahlung erfolgreich abschließt</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Die Abwicklung erfolgt in der Regel über externe Zahlungsanbieter (z. B. Digistore24 oder vergleichbare Plattformen).</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">4. Preise und Zahlung</h3>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        <li>Alle Preise sind Endpreise, sofern nicht anders angegeben.</li>
                        <li>Die Zahlung erfolgt über die im Bestellprozess angebotenen Zahlungsmethoden.</li>
                        <li>Der Zugriff auf digitale Produkte erfolgt erst nach vollständigem Zahlungseingang.</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">5. Zugang zu digitalen Produkten</h3>
                      <ul className="list-disc list-inside text-muted-foreground space-y-1">
                        <li>Nach dem Kauf erhält der Nutzer Zugriff auf die gebuchten Inhalte.</li>
                        <li>Der Zugriff kann zeitlich begrenzt oder unbegrenzt sein, abhängig vom jeweiligen Angebot.</li>
                        <li>Der Anbieter behält sich vor, Inhalte zu aktualisieren, anzupassen oder weiterzuentwickeln.</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">6. Nutzungsrechte</h3>
                      <p className="text-muted-foreground">Alle Inhalte sind urheberrechtlich geschützt. Der Nutzer erhält ein einfaches, nicht übertragbares Nutzungsrecht.</p>
                      <p className="text-muted-foreground mt-2">Nicht erlaubt sind insbesondere:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Weitergabe an Dritte</li>
                        <li>Vervielfältigung oder Verkauf</li>
                        <li>öffentliche Zugänglichmachung</li>
                        <li>Nutzung für eigene kommerzielle Weiterverkäufe</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Verstöße können rechtlich verfolgt werden.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">7. Nutzung von KI-Tools und API</h3>
                      <p className="text-muted-foreground">Im Rahmen der angebotenen Leistungen können KI-Tools und externe Schnittstellen (APIs) genutzt werden.</p>
                      <p className="text-muted-foreground mt-2 font-medium">Wichtig:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Der Nutzer ist selbst dafür verantwortlich, eigene API-Zugänge einzurichten und zu bezahlen</li>
                        <li>Der Anbieter stellt keine Garantie für Verfügbarkeit oder Funktionsfähigkeit externer Dienste</li>
                        <li>Ergebnisse von KI-Systemen können variieren und sind nicht garantiert</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Der Anbieter haftet nicht für Inhalte, die durch KI generiert werden.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">8. Haftung</h3>
                      <p className="text-muted-foreground">Der Anbieter haftet nur für Vorsatz und grobe Fahrlässigkeit. Für einfache Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten.</p>
                      <p className="text-muted-foreground mt-2">Keine Haftung besteht für:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>entgangene Gewinne</li>
                        <li>indirekte Schäden</li>
                        <li>Ergebnisse aus der Nutzung der Produkte</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Die Nutzung erfolgt auf eigene Verantwortung.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">9. Keine Erfolgsgarantie</h3>
                      <p className="text-muted-foreground">Die angebotenen Inhalte stellen keine Garantie für bestimmte Ergebnisse dar. Insbesondere wird kein Einkommen oder wirtschaftlicher Erfolg zugesichert. Ergebnisse hängen immer von der individuellen Umsetzung des Nutzers ab.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">10. Widerrufsrecht</h3>
                      <p className="text-muted-foreground">Bei digitalen Produkten kann das Widerrufsrecht erlöschen, sobald:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>der Nutzer ausdrücklich zustimmt, dass der Zugriff sofort beginnt</li>
                        <li>und bestätigt, dass er auf sein Widerrufsrecht verzichtet</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Details werden im Bestellprozess geregelt.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">11. Affiliate-Links und Empfehlungen</h3>
                      <p className="text-muted-foreground">Der Anbieter kann Produkte und Dienstleistungen Dritter empfehlen. Dabei kann eine Provision entstehen. Für Inhalte, Leistungen und Ergebnisse dieser Drittanbieter übernimmt der Anbieter keine Haftung.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">12. Verfügbarkeit der Plattform</h3>
                      <p className="text-muted-foreground">Der Anbieter bemüht sich um eine möglichst unterbrechungsfreie Verfügbarkeit. Es kann jedoch zu Ausfällen oder Wartungen kommen. Ein Anspruch auf permanente Verfügbarkeit besteht nicht.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">13. Änderungen der AGB</h3>
                      <p className="text-muted-foreground">Der Anbieter kann diese AGB jederzeit anpassen. Es gelten jeweils die zum Zeitpunkt des Kaufs gültigen Bedingungen.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">14. Anwendbares Recht</h3>
                      <p className="text-muted-foreground">Es gilt das Recht des Landes, in dem der Anbieter seinen Sitz hat. Für Verbraucher können zusätzlich zwingende gesetzliche Regelungen ihres Wohnsitzlandes gelten.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">15. Schlussbestimmungen</h3>
                      <p className="text-muted-foreground">Sollte eine Bestimmung dieser AGB unwirksam sein, bleibt der Rest unberührt.</p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
