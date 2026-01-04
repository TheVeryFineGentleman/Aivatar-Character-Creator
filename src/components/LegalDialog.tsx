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
                  <p className="text-muted-foreground">für die Nutzung von Avatar Creator Studio</p>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">1. Anbieter</h3>
                      <p className="text-muted-foreground">
                        Anbieter der Software Avatar Creator Studio ist:<br /><br />
                        Torsten Jaeger<br /><br />
                        Weitere Angaben gemäß § 5 TMG findest du im Impressum unter<br />
                        👉{" "}
                        <a href="https://torstenjaeger.com/impressum" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          https://torstenjaeger.com/impressum
                        </a>
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">2. Geltungsbereich</h3>
                      <p className="text-muted-foreground">
                        Diese Allgemeinen Geschäftsbedingungen regeln die Nutzung der web-basierten Software Avatar Creator Studio.<br /><br />
                        Abweichende oder entgegenstehende Bedingungen des Nutzers finden keine Anwendung, es sei denn, ihrer Geltung wurde ausdrücklich schriftlich zugestimmt.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">3. Leistungsbeschreibung</h3>
                      <p className="text-muted-foreground">
                        Avatar Creator Studio ist eine Software zur KI-gestützten Generierung von Avatar-Bildern und Charakter-Posen auf Basis von vom Nutzer bereitgestellten Inhalten (z. B. Referenzbilder).<br /><br />
                        Der Anbieter schuldet keinen bestimmten Erfolg, keine bestimmte Bildqualität und keine bestimmte wirtschaftliche Verwertbarkeit der generierten Inhalte.<br /><br />
                        Die Software stellt ein technisches Werkzeug dar, kein fertiges Produkt oder Beratungsergebnis.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">4. Registrierung und Zugang</h3>
                      <p className="text-muted-foreground">
                        Für die Nutzung der Software ist eine Registrierung erforderlich.<br /><br />
                        Die Zugangsdaten sind vertraulich zu behandeln und dürfen nicht an Dritte weitergegeben werden.<br /><br />
                        Der Nutzer ist für alle Aktivitäten verantwortlich, die über seinen Account erfolgen.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">5. Nutzungsrechte an generierten Inhalten</h3>
                      <p className="text-muted-foreground">
                        Der Nutzer erhält ein einfaches, nicht exklusives Nutzungsrecht an den durch die Software generierten Inhalten.<br /><br />
                        Dieses Nutzungsrecht berechtigt zur privaten und geschäftlichen Nutzung, soweit keine Rechte Dritter verletzt werden.<br /><br />
                        Eine Weitergabe, Unterlizenzierung oder der Weiterverkauf der Software selbst ist nicht gestattet.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">6. Verantwortung des Nutzers</h3>
                      <p className="text-muted-foreground">
                        Der Nutzer versichert, dass er über alle erforderlichen Rechte an den hochgeladenen Bildern, Daten und Inhalten verfügt.<br /><br />
                        Insbesondere stellt der Nutzer sicher, dass:
                      </p>
                      <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-1">
                        <li>keine Persönlichkeitsrechte Dritter verletzt werden</li>
                        <li>keine Urheber- oder Markenrechte verletzt werden</li>
                        <li>keine rechtswidrigen, diskriminierenden oder sittenwidrigen Inhalte hochgeladen werden</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">
                        Der Anbieter übernimmt keine Haftung für Inhalte, die vom Nutzer bereitgestellt oder erzeugt werden.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">7. KI-Spezifischer Haftungsausschluss</h3>
                      <p className="text-muted-foreground">
                        Die durch Avatar Creator Studio generierten Inhalte entstehen durch automatisierte KI-Prozesse.<br /><br />
                        Der Anbieter übernimmt keine Gewähr für:
                      </p>
                      <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-1">
                        <li>rechtliche Zulässigkeit der generierten Inhalte</li>
                        <li>Originalität oder Einzigartigkeit</li>
                        <li>Übereinstimmung mit Plattform- oder Werberichtlinien</li>
                        <li>Freiheit von Rechten Dritter</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">
                        Die rechtliche Prüfung und Verwendung der Inhalte obliegt ausschließlich dem Nutzer.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">8. Verfügbarkeit der Software</h3>
                      <p className="text-muted-foreground">
                        Ein Anspruch auf eine jederzeitige, ununterbrochene Verfügbarkeit der Software besteht nicht.<br /><br />
                        Der Anbieter ist berechtigt, die Software aus technischen Gründen, zur Wartung, Weiterentwicklung oder Sicherheit vorübergehend einzuschränken.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">9. Änderungen und Weiterentwicklung</h3>
                      <p className="text-muted-foreground">
                        Der Anbieter behält sich vor, Funktionen der Software zu ändern, zu erweitern oder einzustellen, sofern dies für den Nutzer zumutbar ist.<br /><br />
                        Ein Anspruch auf den Fortbestand bestimmter Funktionen besteht nicht.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">10. Haftung</h3>
                      <p className="text-muted-foreground">
                        Der Anbieter haftet ausschließlich für Schäden, die auf Vorsatz oder grober Fahrlässigkeit beruhen.<br /><br />
                        Eine Haftung für:
                      </p>
                      <ul className="list-disc list-inside text-muted-foreground ml-2 mt-2 space-y-1">
                        <li>entgangenen Gewinn</li>
                        <li>ausgebliebene Umsätze</li>
                        <li>Datenverlust</li>
                        <li>mittelbare oder Folgeschäden</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">
                        ist ausgeschlossen, soweit gesetzlich zulässig.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">11. Vertragslaufzeit und Beendigung</h3>
                      <p className="text-muted-foreground">
                        Die Nutzung der Software kann vom Nutzer jederzeit beendet werden.<br /><br />
                        Ein Anspruch auf Rückerstattung besteht nur, sofern gesetzlich zwingend vorgesehen oder ausdrücklich vereinbart.
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">12. Datenschutz</h3>
                      <p className="text-muted-foreground">
                        Die Verarbeitung personenbezogener Daten erfolgt gemäß der Datenschutzerklärung unter<br />
                        👉{" "}
                        <a href="https://torstenjaeger.com/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          https://torstenjaeger.com/datenschutz
                        </a>
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">13. Schlussbestimmungen</h3>
                      <p className="text-muted-foreground">
                        Es gilt das Recht der Bundesrepublik Deutschland.<br /><br />
                        Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.<br /><br />
                        Gerichtsstand ist – soweit gesetzlich zulässig – der Sitz des Anbieters.
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
