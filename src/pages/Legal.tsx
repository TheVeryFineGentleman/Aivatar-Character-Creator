import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function Legal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "impressum";

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

        <Tabs defaultValue={defaultTab} className="w-full">
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
                  <h2 className="text-2xl font-bold text-primary">Impressum</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Angaben gemäß § 5 TMG</h3>
                      <p className="text-muted-foreground">Torsten Jaeger</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Kontakt</h3>
                      <p className="text-muted-foreground">E-Mail: info@torstenjaeger.com</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h3>
                      <p className="text-muted-foreground">
                        Torsten Jaeger<br />
                        Trevionis LLC<br />
                        2201 MENAUL BLVD NE STE A<br />
                        87107 Albuquerque<br />
                        NM USA
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Haftung für Inhalte</h3>
                      <p className="text-muted-foreground">
                        Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
                      </p>
                      <p className="text-muted-foreground mt-2">
                        Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Haftung für Links</h3>
                      <p className="text-muted-foreground">
                        Unsere Website enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Urheberrecht</h3>
                      <p className="text-muted-foreground">
                        Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Online-Streitbeilegung (OS-Plattform)</h3>
                      <p className="text-muted-foreground">
                        Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
                        <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          https://ec.europa.eu/consumers/odr/
                        </a>
                      </p>
                      <p className="text-muted-foreground mt-2">Unsere E-Mail-Adresse findest du oben im Impressum.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Verbraucherstreitbeilegung</h3>
                      <p className="text-muted-foreground">
                        Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="datenschutz" className="mt-0">
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-6 text-sm">
                  <h2 className="text-2xl font-bold text-primary">🔒 Datenschutzerklärung</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Verantwortlicher</h3>
                      <p className="text-muted-foreground">
                        Trevionis LLC<br />
                        2201 MENAUL BLVD NE STE A<br />
                        87107 Albuquerque<br />
                        NM USA
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Allgemeine Hinweise zur Datenverarbeitung</h3>
                      <p className="text-muted-foreground">
                        Der Schutz deiner personenbezogenen Daten ist uns wichtig. Die Verarbeitung erfolgt ausschließlich im Rahmen der gesetzlichen Bestimmungen, insbesondere der Datenschutz-Grundverordnung (DSGVO).
                      </p>
                      <p className="text-muted-foreground mt-2">
                        Personenbezogene Daten sind alle Daten, mit denen du persönlich identifiziert werden kannst.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Datenerfassung beim Besuch der Website</h3>
                      <p className="text-muted-foreground">Beim Aufruf dieser Website werden automatisch folgende Daten erfasst:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>IP-Adresse</li>
                        <li>Browsertyp und Version</li>
                        <li>Betriebssystem</li>
                        <li>Datum und Uhrzeit des Zugriffs</li>
                        <li>Referrer-URL</li>
                        <li>aufgerufene Seiten</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Diese Daten dienen der technischen Bereitstellung und Sicherheit der Website.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Datenerfassung durch Eingaben</h3>
                      <p className="text-muted-foreground">Wenn du Daten aktiv eingibst (z. B. Formular oder Webinar-Anmeldung), werden folgende Daten verarbeitet:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Name</li>
                        <li>E-Mail-Adresse</li>
                        <li>Telefonnummer (optional)</li>
                        <li>Inhalte aus Formularen</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Zweck der Verarbeitung</h3>
                      <p className="text-muted-foreground">Die Verarbeitung erfolgt zu folgenden Zwecken:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Bereitstellung der Website</li>
                        <li>Kommunikation</li>
                        <li>Versand von E-Mails und Informationen</li>
                        <li>Durchführung von Marketingmaßnahmen</li>
                        <li>Analyse und Optimierung</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Rechtsgrundlagen</h3>
                      <p className="text-muted-foreground">Die Verarbeitung erfolgt gemäß:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)</li>
                        <li>Art. 6 Abs. 1 lit. b DSGVO (Vertrag / vorvertragliche Maßnahmen)</li>
                        <li>Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Cookies und Consent Management</h3>
                      <p className="text-muted-foreground">Unsere Website verwendet Cookies und ähnliche Technologien. Beim ersten Besuch wirst du über ein Cookie-Consent-Tool gefragt, ob du der Nutzung zustimmst.</p>
                      <p className="text-muted-foreground mt-2">Du kannst auswählen:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>notwendige Cookies</li>
                        <li>Analyse-Cookies</li>
                        <li>Marketing-Cookies</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Deine Einstellungen kannst du jederzeit ändern.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Facebook Ads und Meta Pixel</h3>
                      <p className="text-muted-foreground">
                        Wir nutzen Dienste der Meta Platforms Ireland Ltd., 4 Grand Canal Square, Dublin 2, Irland.
                      </p>
                      <p className="text-muted-foreground mt-2">Der Meta Pixel ermöglicht:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Tracking des Nutzerverhaltens</li>
                        <li>Messung von Conversions</li>
                        <li>Ausspielung personalisierter Werbung</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">
                        Weitere Informationen:{" "}
                        <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://www.facebook.com/privacy/policy/</a>
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Google Dienste (Analytics und Ads)</h3>
                      <p className="text-muted-foreground">
                        Wir nutzen Dienste der Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.
                      </p>
                      <p className="text-muted-foreground mt-2">Eingesetzte Dienste:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Google Analytics</li>
                        <li>Google Ads</li>
                        <li>Google Conversion Tracking</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Diese erfassen:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Nutzerverhalten</li>
                        <li>Klicks</li>
                        <li>Verweildauer</li>
                        <li>Herkunft</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">
                        Weitere Informationen:{" "}
                        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://policies.google.com/privacy</a>
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Einsatz von KI-Tools</h3>
                      <p className="text-muted-foreground">Zur Erstellung und Verarbeitung von Inhalten nutzen wir:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>OpenAI (ChatGPT)</li>
                        <li>Google KI-Modelle</li>
                        <li>HeyGen</li>
                        <li>ElevenLabs</li>
                        <li>OpenArt</li>
                        <li>Flux</li>
                        <li>Sora</li>
                        <li>Veo</li>
                        <li>Kling</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Dabei können verarbeitet werden:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Texte</li>
                        <li>Bilder</li>
                        <li>Videos</li>
                        <li>Sprache</li>
                        <li>Nutzungsdaten</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Die Verarbeitung kann auch außerhalb der EU erfolgen.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">E-Mail-Marketing</h3>
                      <p className="text-muted-foreground">Wir nutzen folgende Anbieter:</p>
                      <p className="text-muted-foreground mt-2">
                        Quentn.com GmbH<br />
                        Friedrich-Ebert-Straße 51<br />
                        14469 Potsdam, Deutschland
                      </p>
                      <p className="text-muted-foreground mt-2">
                        4leads GmbH<br />
                        Werkstraße 4a<br />
                        07426 Königsee, Deutschland
                      </p>
                      <p className="text-muted-foreground mt-2">Dabei werden verarbeitet:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Name</li>
                        <li>E-Mail-Adresse</li>
                        <li>Öffnungs- und Klickverhalten</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Die Anmeldung erfolgt im Double-Opt-in-Verfahren. Abmeldung ist jederzeit möglich.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Funnel- und Landingpage-System</h3>
                      <p className="text-muted-foreground">Wir nutzen: Funnelcockpit (Just Viral GmbH)</p>
                      <p className="text-muted-foreground mt-2">Dabei werden verarbeitet:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Kontaktdaten</li>
                        <li>Formularinhalte</li>
                        <li>Interaktionsdaten</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Messenger-Tools</h3>
                      <p className="text-muted-foreground">Wir nutzen: ManyChat Inc.</p>
                      <p className="text-muted-foreground mt-2">Dabei werden verarbeitet:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Name</li>
                        <li>Nachrichteninhalte</li>
                        <li>Interaktionen</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Zahlungsanbieter</h3>
                      <p className="text-muted-foreground">
                        Wir nutzen: Digistore24 GmbH<br />
                        St.-Godehard-Straße 32<br />
                        31139 Hildesheim, Deutschland
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Weitergabe von Daten</h3>
                      <p className="text-muted-foreground">Eine Weitergabe erfolgt nur:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>an technische Dienstleister</li>
                        <li>an Marketingplattformen</li>
                        <li>an Zahlungsanbieter</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Speicherdauer</h3>
                      <p className="text-muted-foreground">
                        Daten werden nur so lange gespeichert, wie es für den jeweiligen Zweck erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen.
                      </p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Deine Rechte</h3>
                      <p className="text-muted-foreground">Du hast das Recht auf:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Auskunft</li>
                        <li>Berichtigung</li>
                        <li>Löschung</li>
                        <li>Einschränkung</li>
                        <li>Datenübertragbarkeit</li>
                        <li>Widerspruch</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Du kannst dich bei einer Aufsichtsbehörde beschweren.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Datensicherheit</h3>
                      <p className="text-muted-foreground">Wir setzen folgende Maßnahmen ein:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>SSL-Verschlüsselung</li>
                        <li>Zugriffsbeschränkungen</li>
                        <li>sichere Server</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Änderungen</h3>
                      <p className="text-muted-foreground">Diese Datenschutzerklärung kann jederzeit angepasst werden.</p>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="agb" className="mt-0">
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-6 text-sm">
                  <h2 className="text-2xl font-bold text-primary">Allgemeine Geschäftsbedingungen (AGB)</h2>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">1. Geltungsbereich</h3>
                      <p className="text-muted-foreground">Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge zwischen</p>
                      <p className="text-muted-foreground mt-2">
                        Torsten Jaeger<br />
                        Trevionis LLC<br />
                        2201 MENAUL BLVD NE STE A<br />
                        87107 Albuquerque<br />
                        NM USA
                      </p>
                      <p className="text-muted-foreground mt-2">und den Nutzern der angebotenen digitalen Produkte, Softwarelösungen und Dienstleistungen.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">2. Vertragsgegenstand</h3>
                      <p className="text-muted-foreground">Gegenstand des Vertrages ist der Zugang zu digitalen Inhalten, Software, Schulungen sowie ggf. Community-Bereichen.</p>
                      <p className="text-muted-foreground mt-2">Die Leistungen erfolgen ausschließlich digital.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">3. Vertragsschluss</h3>
                      <p className="text-muted-foreground">Der Vertrag kommt zustande, sobald der Nutzer den Bestellprozess abschließt und eine Bestätigung erhält.</p>
                      <p className="text-muted-foreground mt-2">Die Abwicklung erfolgt in der Regel über Digistore24, Stripe oder vergleichbare Zahlungsanbieter.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">4. Nutzung der Software und Inhalte</h3>
                      <p className="text-muted-foreground">Der Nutzer erhält ein einfaches, nicht übertragbares Nutzungsrecht.</p>
                      <p className="text-muted-foreground mt-2">Es ist nicht erlaubt:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Inhalte weiterzugeben oder zu verkaufen</li>
                        <li>Zugänge zu teilen</li>
                        <li>Inhalte zu kopieren oder öffentlich zugänglich zu machen</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">5. Nutzung von API-Schnittstellen</h3>
                      <p className="text-muted-foreground">Für bestimmte Funktionen (z. B. KI-Generierung, Video- oder Content-Erstellung) ist die Nutzung externer API-Dienste erforderlich.</p>
                      <p className="text-muted-foreground mt-2">Der Nutzer ist selbst verantwortlich für:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>die Einrichtung eigener API-Zugänge</li>
                        <li>die Abrechnung dieser Dienste</li>
                        <li>die Einhaltung der jeweiligen Nutzungsbedingungen der Anbieter</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Es erfolgt keine Abrechnung über ein internes Credit-System. Kosten für externe Dienste trägt ausschließlich der Nutzer.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">6. Verfügbarkeit</h3>
                      <p className="text-muted-foreground">Wir bemühen uns um eine möglichst unterbrechungsfreie Verfügbarkeit. Es besteht jedoch kein Anspruch auf permanente Erreichbarkeit. Insbesondere bei externen Diensten (z. B. KI-Anbieter) kann es zu Einschränkungen kommen.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">7. Haftung</h3>
                      <p className="text-muted-foreground">Wir haften nur für Vorsatz und grobe Fahrlässigkeit. Für Ergebnisse, die durch die Nutzung der Software entstehen (z. B. Einnahmen, Reichweite), wird keine Garantie übernommen. Die Nutzung erfolgt auf eigene Verantwortung.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">8. Updates und Änderungen</h3>
                      <p className="text-muted-foreground">Wir behalten uns vor:</p>
                      <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                        <li>Inhalte zu aktualisieren</li>
                        <li>Funktionen anzupassen</li>
                        <li>Angebote weiterzuentwickeln</li>
                      </ul>
                      <p className="text-muted-foreground mt-2">Dies dient der Verbesserung der Leistung.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">9. Kündigung und Laufzeit</h3>
                      <p className="text-muted-foreground">Sofern nicht anders angegeben, handelt es sich um einmalige Produkte ohne Laufzeit. Bei Abonnements gelten die jeweils angegebenen Bedingungen.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">10. Widerrufsrecht</h3>
                      <p className="text-muted-foreground">Es gelten die gesetzlichen Regelungen. Bei digitalen Produkten kann das Widerrufsrecht erlöschen, sobald mit der Ausführung begonnen wurde und der Nutzer zugestimmt hat.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">11. Urheberrecht</h3>
                      <p className="text-muted-foreground">Alle Inhalte, Systeme und Materialien sind urheberrechtlich geschützt. Jegliche unerlaubte Nutzung wird rechtlich verfolgt.</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">12. Schlussbestimmungen</h3>
                      <p className="text-muted-foreground">Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit zulässig, der Sitz des Anbieters. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen unberührt.</p>
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