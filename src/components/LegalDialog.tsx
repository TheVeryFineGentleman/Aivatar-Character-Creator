import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LegalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LegalDialog({ open, onOpenChange }: LegalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[90vw] max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-bold">Rechtliches</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="impressum" className="flex flex-col h-full">
          <TabsList className="mx-6 mb-4 grid grid-cols-3 bg-muted/50 p-1 rounded-lg">
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

          <div className="flex-1 overflow-hidden px-6 pb-6">
            <TabsContent value="impressum" className="mt-0 h-full">
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6 text-sm">
                  <h2 className="text-2xl font-bold text-primary">IMPRESSUM</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Angaben gemäß § 5 TMG:</h3>
                      <p className="text-muted-foreground">
                        Digital Rocket Ltd<br />
                        Torsten Jaeger<br />
                        Keryneias Mansion, App. 102, Keryneias Street 16<br />
                        7040 Oroclini<br />
                        Zypern
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Kontakt:</h3>
                      <p className="text-muted-foreground">
                        Email: info(at)torstenjaeger.com<br />
                        Tel: +4953084864497
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:</h3>
                      <p className="text-muted-foreground">
                        Digital Rocket Ltd<br />
                        Torsten Jaeger<br />
                        Keryneias Mansion, App. 102, Keryneias Street 16<br />
                        7040 Oroclini<br />
                        Zypern
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Streitschlichtung</h3>
                      <p className="text-muted-foreground">
                        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: 
                        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                          https://ec.europa.eu/consumers/odr
                        </a>
                      </p>
                      <p className="text-muted-foreground mt-2">
                        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Haftung für Inhalte</h3>
                      <p className="text-muted-foreground">
                        Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
                      </p>
                      <p className="text-muted-foreground mt-2">
                        Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Haftung für Links</h3>
                      <p className="text-muted-foreground">
                        Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar.
                      </p>
                      <p className="text-muted-foreground mt-2">
                        Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Urheberrecht</h3>
                      <p className="text-muted-foreground">
                        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.
                      </p>
                      <p className="text-muted-foreground mt-2">
                        Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="datenschutz" className="mt-0 h-full">
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6 text-sm">
                  <h2 className="text-2xl font-bold text-primary">DATENSCHUTZERKLÄRUNG</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">1. Datenschutz auf einen Blick</h3>
                      <h4 className="font-medium text-foreground mt-3 mb-1">Allgemeine Hinweise</h4>
                      <p className="text-muted-foreground">
                        Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können. Ausführliche Informationen zum Thema Datenschutz entnehmen Sie unserer unter diesem Text aufgeführten Datenschutzerklärung.
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
                        Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen. Hierbei kann es sich z.B. um Daten handeln, die Sie in ein Kontaktformular eingeben. Andere Daten werden automatisch oder nach Ihrer Einwilligung beim Besuch der Website durch unsere IT-Systeme erfasst. Das sind vor allem technische Daten (z.B. Internetbrowser, Betriebssystem oder Uhrzeit des Seitenaufrufs). Die Erfassung dieser Daten erfolgt automatisch, sobald Sie diese Website betreten.
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
                        Sie haben jederzeit das Recht, unentgeltlich Auskunft über Herkunft, Empfänger und Zweck Ihrer gespeicherten personenbezogenen Daten zu erhalten. Sie haben außerdem ein Recht, die Berichtigung oder Löschung dieser Daten zu verlangen. Wenn Sie eine Einwilligung zur Datenverarbeitung erteilt haben, können Sie diese Einwilligung jederzeit für die Zukunft widerrufen. Außerdem haben Sie das Recht, unter bestimmten Umständen die Einschränkung der Verarbeitung Ihrer personenbezogenen Daten zu verlangen. Des Weiteren steht Ihnen ein Beschwerderecht bei der zuständigen Aufsichtsbehörde zu.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">2. Hosting</h3>
                      <p className="text-muted-foreground">
                        Wir hosten die Inhalte unserer Website bei folgendem Anbieter: Die Website wird auf Servern von spezialisierten Hosting-Anbietern gehostet. Personenbezogene Daten, die auf dieser Website erfasst werden, werden auf den Servern des Hosters gespeichert.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">3. Allgemeine Hinweise und Pflichtinformationen</h3>
                      <h4 className="font-medium text-foreground mt-3 mb-1">Datenschutz</h4>
                      <p className="text-muted-foreground">
                        Die Betreiber dieser Seiten nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften sowie dieser Datenschutzerklärung.
                      </p>
                      <p className="text-muted-foreground mt-2">
                        Wenn Sie diese Website benutzen, werden verschiedene personenbezogene Daten erhoben. Personenbezogene Daten sind Daten, mit denen Sie persönlich identifiziert werden können. Die vorliegende Datenschutzerklärung erläutert, welche Daten wir erheben und wofür wir sie nutzen. Sie erläutert auch, wie und zu welchem Zweck das geschieht.
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
                        Soweit innerhalb dieser Datenschutzerklärung keine speziellere Speicherdauer genannt wurde, verbleiben Ihre personenbezogenen Daten bei uns, bis der Zweck für die Datenverarbeitung entfällt. Wenn Sie ein berechtigtes Löschersuchen geltend machen oder eine Einwilligung zur Datenverarbeitung widerrufen, werden Ihre Daten gelöscht, sofern wir keine anderen rechtlich zulässigen Gründe für die Speicherung Ihrer personenbezogenen Daten haben.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">4. Datenerfassung auf dieser Website</h3>
                      <h4 className="font-medium text-foreground mt-3 mb-1">Cookies</h4>
                      <p className="text-muted-foreground">
                        Unsere Internetseiten verwenden so genannte "Cookies". Cookies sind kleine Textdateien und richten auf Ihrem Endgerät keinen Schaden an. Sie werden entweder vorübergehend für die Dauer einer Sitzung (Session-Cookies) oder dauerhaft (permanente Cookies) auf Ihrem Endgerät gespeichert. Session-Cookies werden nach Ende Ihres Besuchs automatisch gelöscht. Permanente Cookies bleiben auf Ihrem Endgerät gespeichert, bis Sie diese selbst löschen oder eine automatische Löschung durch Ihren Webbrowser erfolgt.
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium text-foreground mb-1">Server-Log-Dateien</h4>
                      <p className="text-muted-foreground">
                        Der Provider der Seiten erhebt und speichert automatisch Informationen in so genannten Server-Log-Dateien, die Ihr Browser automatisch an uns übermittelt. Dies sind: Browsertyp und Browserversion, verwendetes Betriebssystem, Referrer URL, Hostname des zugreifenden Rechners, Uhrzeit der Serveranfrage und IP-Adresse.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">5. Newsletter</h3>
                      <p className="text-muted-foreground">
                        Wenn Sie den auf der Website angebotenen Newsletter beziehen möchten, benötigen wir von Ihnen eine E-Mail-Adresse sowie Informationen, welche uns die Überprüfung gestatten, dass Sie der Inhaber der angegebenen E-Mail-Adresse sind und mit dem Empfang des Newsletters einverstanden sind. Weitere Daten werden nicht bzw. nur auf freiwilliger Basis erhoben. Diese Daten verwenden wir ausschließlich für den Versand der angeforderten Informationen und geben diese nicht an Dritte weiter.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">6. Plugins und Tools</h3>
                      <p className="text-muted-foreground">
                        Diese Website nutzt verschiedene Plugins und Tools zur Verbesserung der Nutzererfahrung. Dabei können personenbezogene Daten an die jeweiligen Anbieter übertragen werden. Details zu den einzelnen Diensten finden Sie in den entsprechenden Abschnitten dieser Datenschutzerklärung.
                      </p>
                    </div>

                    <div>
                      <p className="text-muted-foreground text-xs mt-6">
                        Die vollständige Datenschutzerklärung finden Sie unter:{" "}
                        <a href="https://torstenjaeger.com/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          https://torstenjaeger.com/datenschutz
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="agb" className="mt-0 h-full">
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-6 text-sm">
                  <h2 className="text-2xl font-bold text-primary">ALLGEMEINE GESCHÄFTSBEDINGUNGEN (AGB)</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">1. Geltungsbereich</h3>
                      <p className="text-muted-foreground">
                        Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen:
                      </p>
                      <p className="text-muted-foreground mt-2">
                        Trevionis LLC<br />
                        2201 MENAUL BLVD NE STE A<br />
                        87107 Albuquerque<br />
                        NM USA
                      </p>
                      <p className="text-muted-foreground mt-2">
                        – nachfolgend „Anbieter" –
                      </p>
                      <p className="text-muted-foreground mt-2">
                        und den Nutzern der angebotenen digitalen Inhalte, Produkte und Dienstleistungen.
                      </p>
                      <p className="text-muted-foreground mt-2">
                        Abweichende Bedingungen des Nutzers werden nicht anerkannt.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">2. Vertragsgegenstand</h3>
                      <p className="text-muted-foreground">
                        Der Anbieter bietet digitale Produkte und Dienstleistungen an, insbesondere:
                      </p>
                      <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-1">
                        <li>Onlinekurse und Schulungen</li>
                        <li>Softwarelösungen und Tools (inkl. KI-basierter Anwendungen)</li>
                        <li>digitale Inhalte (z. B. Videos, Texte, Vorlagen)</li>
                        <li>Affiliate-Angebote und Empfehlungen</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">
                        Die konkreten Inhalte ergeben sich aus der jeweiligen Produktbeschreibung.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">3. Vertragsschluss</h3>
                      <p className="text-muted-foreground">
                        Der Vertrag kommt zustande, sobald der Nutzer:
                      </p>
                      <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-1">
                        <li>ein Produkt auswählt</li>
                        <li>den Bestellprozess durchläuft</li>
                        <li>und die Zahlung erfolgreich abschließt</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">
                        Die Abwicklung erfolgt in der Regel über externe Zahlungsanbieter (z. B. Digistore24 oder vergleichbare Plattformen).
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">4. Preise und Zahlung</h3>
                      <ul className="list-disc list-inside text-muted-foreground ml-2 space-y-1">
                        <li>Alle Preise sind Endpreise, sofern nicht anders angegeben.</li>
                        <li>Die Zahlung erfolgt über die im Bestellprozess angebotenen Zahlungsmethoden.</li>
                        <li>Der Zugriff auf digitale Produkte erfolgt erst nach vollständigem Zahlungseingang.</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">5. Zugang zu digitalen Produkten</h3>
                      <ul className="list-disc list-inside text-muted-foreground ml-2 space-y-1">
                        <li>Nach dem Kauf erhält der Nutzer Zugriff auf die gebuchten Inhalte.</li>
                        <li>Der Zugriff kann zeitlich begrenzt oder unbegrenzt sein, abhängig vom jeweiligen Angebot.</li>
                        <li>Der Anbieter behält sich vor, Inhalte zu aktualisieren, anzupassen oder weiterzuentwickeln.</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">6. Nutzungsrechte</h3>
                      <p className="text-muted-foreground">
                        Alle Inhalte sind urheberrechtlich geschützt. Der Nutzer erhält ein einfaches, nicht übertragbares Nutzungsrecht.
                      </p>
                      <p className="text-muted-foreground mt-2">Nicht erlaubt sind insbesondere:</p>
                      <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-1">
                        <li>Weitergabe an Dritte</li>
                        <li>Vervielfältigung oder Verkauf</li>
                        <li>öffentliche Zugänglichmachung</li>
                        <li>Nutzung für eigene kommerzielle Weiterverkäufe</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">
                        Verstöße können rechtlich verfolgt werden.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">7. Nutzung von KI-Tools und API</h3>
                      <p className="text-muted-foreground">
                        Im Rahmen der angebotenen Leistungen können KI-Tools und externe Schnittstellen (APIs) genutzt werden.
                      </p>
                      <p className="text-muted-foreground mt-2 font-medium">Wichtig:</p>
                      <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-1">
                        <li>Der Nutzer ist selbst dafür verantwortlich, eigene API-Zugänge einzurichten und zu bezahlen</li>
                        <li>Der Anbieter stellt keine Garantie für Verfügbarkeit oder Funktionsfähigkeit externer Dienste</li>
                        <li>Ergebnisse von KI-Systemen können variieren und sind nicht garantiert</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">
                        Der Anbieter haftet nicht für Inhalte, die durch KI generiert werden.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">8. Haftung</h3>
                      <p className="text-muted-foreground">
                        Der Anbieter haftet nur für Vorsatz und grobe Fahrlässigkeit. Für einfache Fahrlässigkeit haftet der Anbieter nur bei Verletzung wesentlicher Vertragspflichten.
                      </p>
                      <p className="text-muted-foreground mt-2">Keine Haftung besteht für:</p>
                      <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-1">
                        <li>entgangene Gewinne</li>
                        <li>indirekte Schäden</li>
                        <li>Ergebnisse aus der Nutzung der Produkte</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">
                        Die Nutzung erfolgt auf eigene Verantwortung.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">9. Keine Erfolgsgarantie</h3>
                      <p className="text-muted-foreground">
                        Die angebotenen Inhalte stellen keine Garantie für bestimmte Ergebnisse dar. Insbesondere wird kein Einkommen oder wirtschaftlicher Erfolg zugesichert. Ergebnisse hängen immer von der individuellen Umsetzung des Nutzers ab.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">10. Widerrufsrecht</h3>
                      <p className="text-muted-foreground">
                        Bei digitalen Produkten kann das Widerrufsrecht erlöschen, sobald:
                      </p>
                      <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-1">
                        <li>der Nutzer ausdrücklich zustimmt, dass der Zugriff sofort beginnt</li>
                        <li>und bestätigt, dass er auf sein Widerrufsrecht verzichtet</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">
                        Details werden im Bestellprozess geregelt.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">11. Affiliate-Links und Empfehlungen</h3>
                      <p className="text-muted-foreground">
                        Der Anbieter kann Produkte und Dienstleistungen Dritter empfehlen. Dabei kann eine Provision entstehen. Für Inhalte, Leistungen und Ergebnisse dieser Drittanbieter übernimmt der Anbieter keine Haftung.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">12. Verfügbarkeit der Plattform</h3>
                      <p className="text-muted-foreground">
                        Der Anbieter bemüht sich um eine möglichst unterbrechungsfreie Verfügbarkeit. Es kann jedoch zu Ausfällen oder Wartungen kommen. Ein Anspruch auf permanente Verfügbarkeit besteht nicht.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">13. Änderungen der AGB</h3>
                      <p className="text-muted-foreground">
                        Der Anbieter kann diese AGB jederzeit anpassen. Es gelten jeweils die zum Zeitpunkt des Kaufs gültigen Bedingungen.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">14. Anwendbares Recht</h3>
                      <p className="text-muted-foreground">
                        Es gilt das Recht des Landes, in dem der Anbieter seinen Sitz hat. Für Verbraucher können zusätzlich zwingende gesetzliche Regelungen ihres Wohnsitzlandes gelten.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">15. Schlussbestimmungen</h3>
                      <p className="text-muted-foreground">
                        Sollte eine Bestimmung dieser AGB unwirksam sein, bleibt der Rest unberührt.
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
