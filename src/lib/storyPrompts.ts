// SAFE_PORTRAIT_CLAUSE ist hier bewusst NICHT mehr importiert: in Szenen-Prompts
// arbeitet das Wort „portrait" gegen den Lipsync-Anker („not a portrait").
// Für die Charakter-Generatoren bleibt es unverändert in contentSafety.ts.
import { sanitizeText, SAFE_SCENE_CLAUSE } from "./contentSafety";

export type StoryMode = "general" | "reel";

/** Die zwei Reel-Stile. "vlog" ist der Standard für neue Projekte, "explainer"
 *  ist das bisherige Verhalten (jede Szene ein neuer, überzogener Bild-Gag). */
export type ReelStyle = "vlog" | "explainer";

/**
 * Wie zwei Personen in EINER Sprech-Szene zueinander stehen.
 *
 * "camera"       — beide nebeneinander, der Sprecher redet in die Linse. Das ist
 *                  die Reel-Form: Der Zuschauer wird angesprochen, nicht belauscht.
 * "conversation" — die beiden reden miteinander und sehen sich dabei an; der
 *                  Zuschauer schaut einem Gespräch zu.
 *
 * Die Wahl wirkt an DREI Stellen, die zusammenpassen müssen, sonst zieht eine
 * die andere zurück: im Duo-Standbild (buildDuoFramePrompt), im Laufzeit-Prompt
 * an OmniHuman (StoryPage) und im Storyboard-Prompt, weil der Sprechtext
 * unterschiedlich klingt — „Deine Schulterschmerzen sind kein Zufall" ist
 * Direktansprache, „Und was machst du dann?" ist ein Dialog.
 */
export type DuoStaging = "camera" | "conversation";

export const DUO_STAGINGS: { value: DuoStaging; label: string; hint: string }[] = [
  { value: "camera",       label: "Zum Zuschauer", hint: "Beide stehen nebeneinander und sprechen in die Kamera — Creator-Duo." },
  { value: "conversation", label: "Miteinander",   hint: "Die beiden reden miteinander und sehen sich an — der Zuschauer sieht zu." },
];

export const REEL_STYLES: { value: ReelStyle; label: string; hint: string }[] = [
  { value: "vlog",      label: "Vor der Kamera",
    hint: "Eine Person erzählt durchgehend in einer Situation — harte Jump Cuts wie im echten Schnitt." },
  // ERZÄHL-FOKUS (2026-08-02): war „Visuelle Gags / überzogenes Bild zur
  // Aussage" — der Stil erzählt jetzt ruhig, mit Szenenwechseln statt Gags.
  { value: "explainer", label: "Erzähler",
    hint: "Jede Szene ein neues Setting — die Person erzählt ruhig, das Bild begleitet." },
];

/**
 * WIE VIEL TUN DIE PERSONEN, WÄHREND SIE REDEN?
 *
 * "calm"   — sie reden einfach: miteinander oder in die Kamera, Hände locker,
 *            die Aussage sitzt im Gesicht. Eine Geste ist die Ausnahme. Das ist
 *            das bisherige Verhalten der ganzen Datei und deshalb der Default.
 * "active" — sie machen sichtbar etwas: zeigen, greifen, halten hoch, hantieren
 *            mit dem, was der Ort hergibt (Hantel, Werkzeug, Kochlöffel). In
 *            jeder Szene eine Handlung, die die Hände ausführen.
 *
 * Der Schalter wirkt an FÜNF Stellen, die zusammenpassen müssen, sonst zieht
 * eine die andere zurück:
 *   1. STORYBOARD — dort entsteht die `keyAction` überhaupt erst
 *      (`getSpeechGestureRules` + die beiden Reel-Direktiven). Ohne diesen
 *      Eingriff bleibt der Schalter WIRKUNGSLOS: Bild- und Video-Prompt
 *      rendern nur, was in `keyAction` steht, und erfinden nie eine Geste dazu.
 *   2. SZENEN-BILD (§2/§3 in `buildSceneImagePrompt`),
 *   3. DUO-STANDBILD (`buildDuoFramePrompt`),
 *   4. KLING-CLIP (`buildKlingVideoPrompt`),
 *   5. OmniHuman-Laufzeit-Prompt in StoryPage.
 *
 * WAS ER NICHT KANN: Sprech-Clips entstehen aus EINEM erzeugten Standbild
 * (`ai-avatar` bzw. OmniHuman animieren im Wesentlichen den Mund). Es bleibt
 * deshalb bei GENAU EINER Handlung pro Szene — "active" erhöht, wie viele
 * Szenen eine bekommen und wie weit sie ausgeführt wird, nicht ihre Zahl
 * innerhalb einer Szene.
 *
 * UNANGETASTET in beiden Modi: der Mund bleibt frei (darauf wird
 * lippensynchronisiert), das Gesicht bleibt zur Kamera, im Duo überquert
 * niemand die Bildmitte (die OmniHuman-Maske schneidet dort starr), und die
 * Schlussszene kommt zur Ruhe.
 */
export type ActionLevel = "calm" | "active";

export const ACTION_LEVELS: { value: ActionLevel; label: string; hint: string }[] = [
  { value: "calm",   label: "Ruhig reden",
    hint: "Wie eine normale Unterhaltung: Hände locker, keine Großbuchstaben, kein Rufen, kein Vorwurf." },
  { value: "active", label: "Viel Aktion",
    hint: "Hände arbeiten sichtbar — zeigen, hochhalten, hantieren — und der Vortrag ist laut und zugespitzt." },
];

/** Die durchgehende Situation eines Vlog-Reels. Wird vom Storyboard-Modell
 *  EINMAL festgelegt und danach in JEDEN Szenen-Prompt wortgleich wiederholt —
 *  das ist der Anker, der den Ort über alle Clips identisch hält. */
export interface ReelSituation {
  activity: string;     // was die Person durchgehend tut
  setting: string;      // wo genau (ein Ort, keine Aufzählung)
  outfit: string;       // was sie trägt
  // Wie die Kamera steht — OHNE Winkel-/Ausschnittsangaben (z. B. "fixed
  // tripod, 1.5 m away"). Der Winkel gehört zur einzelnen Szene (cameraAngle):
  // stünde er hier, widerspräche er in JEDEM Frame dem pro Szene wechselnden
  // "This frame:"-Winkel der Jump Cuts.
  cameraSetup: string;
}

/** Die leere Situation — EINE Quelle für alle, die eines der vier Felder
 *  einzeln setzen müssen, ohne die anderen drei zu verlieren. */
export const EMPTY_REEL_SITUATION: ReelSituation = {
  activity: "", setting: "", outfit: "", cameraSetup: "",
};

/**
 * Entfernt Winkel-/Höhenangaben aus einem (persistierten) cameraSetup.
 * Alt-Storyboards enthalten dort oft „at eye level" o. ä. — zusammen mit dem
 * pro Szene wechselnden „This frame: …, high angle" wäre das ein unerfüllbarer
 * Widerspruch (ein High-Angle-Frame von einem Eye-Level-Stativ), den das
 * Bildmodell auflöst, indem es den Winkelwechsel ignoriert. Der Winkel dieser
 * Szene kommt ausschließlich aus der This-frame-Zeile.
 */
function stripCameraAngleWords(setup: string): string {
  const stripped = setup
    .replace(/\b(?:at\s+)?(?:eye|chest|waist|hip|knee|shoulder|head)[\s-]?level\b/gi, " ")
    .replace(/\b(?:high|low|dutch|overhead|top[\s-]?down)[\s-]?angle\b/gi, " ")
    .replace(/\bbird'?s?[\s-]?eye(?:\s+view)?\b/gi, " ")
    .replace(/\bworm'?s?[\s-]?eye(?:\s+view)?\b/gi, " ")
    .replace(/\bauf\s+augenh(?:ö|oe)he\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/^[\s,;.]+|[\s,;.]+$/g, "");
  // Bestand das Setup NUR aus einer Winkelangabe, bleibt lieber der Originaltext
  // stehen als eine leere „Camera:"-Zeile zu emittieren.
  return stripped || setup.trim();
}

/**
 * Wortbudget pro 8s-Clip — EINE Konstante statt vier Duplikate.
 * Kalibrierung nach REALEN Messwerten (Server-Logs, [dub]-Zeilen): ElevenLabs
 * spricht Deutsch mit ~2,3–2,9 Wörtern/s; die frühere Vorgabe „15–22 Wörter"
 * ergab real 3,7–6,4s Audio auf 8s-Clips — also mehrere Sekunden Stille am
 * Clipende, in denen die Person stumm weiter lippenbewegt.
 */
export const DIALOG_WORD_BUDGET =
  "12–26 Wörter pro Zeile — AUSSER der Hook-Zeile in Szene 1, die höchstens 12 Wörter hat und " +
  "damit die kürzeste des Reels ist. Keine zwei aufeinanderfolgenden Zeilen ungefähr gleich lang " +
  "(z. B. 9 / 24 / 15 / 20) — gleich lange Zeilen ergeben gleich lange Clips, und ein " +
  "gleichmäßiges Schnittraster hört man als Raster. 26 Wörter sind die harte Obergrenze";
/**
 * DIE GESTE KOMMT AUS DEM GESAGTEN — Katalog für die `keyAction`.
 *
 * Vorher leitete das Storyboard die keyAction aus der TÄTIGKEIT ab („der nächste
 * Handgriff") oder erfand irgendetwas Alltägliches. Was gesagt wurde, spielte
 * dabei keine Rolle: Jemand sagt „es ist DEINE Schuld" und greift im Bild zur
 * Wasserflasche. Der stärkste Moment eines Erklär-Reels — die Person zeigt beim
 * Vorwurf in die Kamera — kam nur zufällig zustande.
 *
 * Die Kette dafür stand längst: Der Bild-Prompt sagt ausdrücklich „What their
 * hands and their body do comes from the ACTION ABOVE, not from the speaking"
 * und rendert sie als `caught in progress`. Es fehlte allein die Anweisung eine
 * Ebene höher, die keyAction aus der ZEILE dieser Szene zu bilden.
 *
 * WARUM VERBEN UND KEINE ANATOMIE: Die Formulierungen bleiben kurz und
 * handlungsförmig („zeigt mit ausgestrecktem Zeigefinger in die Linse"). Der
 * Bild-Prompt friert sie selbst ein — eine ausformulierte Gelenkbeschreibung
 * würde nur die übrigen Bild-Anweisungen verdrängen, ohne etwas hinzuzufügen.
 *
 * WARUM EINE GESTE UND NICHT ZWEI: Der Clip entsteht aus EINEM Standbild
 * (ai-avatar bzw. OmniHuman animieren im Wesentlichen den Mund). Zwei Gesten
 * hintereinander wären in einem Frame nicht darstellbar — die zweite fiele weg,
 * und übrig bliebe eine halbe Bewegung ohne Aussage.
 */
/**
 * Der KATALOG selbst — in BEIDEN Aktions-Leveln wortgleich derselbe.
 *
 * Er beantwortet nur, WIE eine Geste aussieht. WIE OFT eine kommt, entscheidet
 * allein die Rahmung darum herum: im ruhigen Modus ist sie die Ausnahme, im
 * aktiven der Regelfall. Deshalb ist er herausgezogen und nicht zweimal
 * gepflegt — eine zweite Kopie liefe unweigerlich auseinander.
 */
const SPEECH_GESTURE_CATALOG = `
ANSPRACHE: „DEINE Schuld", „du machst das falsch" → zeigt mit ausgestrecktem Zeigefinger direkt in die Linse | „hör mir zu", „stopp mal kurz" → hält die offene Handfläche zur Kamera, Arm fast gestreckt | „denk mal nach", „das ist doch logisch" → tippt sich mit dem Zeigefinger an die Schläfe
ZAHLEN: „nur eins", „eine einzige Regel" → hält einen einzelnen Zeigefinger neben der Schulter hoch | „drei Dinge", „drei Sekunden" → hält drei gespreizte Finger neben die Wange | „fast nichts", „nur drei Prozent" → hält Daumen und Zeigefinger einen Spalt auseinander
GEGENSATZ: „nicht das, sondern das" → stellt die eine Hand hochkant ab und öffnet die andere daneben nach oben | „das wiegt schwerer" → hält beide Handflächen wie Waagschalen auf verschiedener Höhe | „mal so, mal so", „kommt drauf an" → kippt die flache Hand vor der Brust zur Seite
ABLEHNUNG: „hör auf damit", „so nicht" → hält beide offenen Handflächen abwehrend zur Kamera | „nein", „auf keinen Fall" → hebt den Zeigefinger neben das Gesicht und kippt ihn nach außen | „vergiss es" → wischt mit dem Handrücken auf Hüfthöhe zur Seite
ENTHÜLLUNG: „unter uns", „das sagt dir keiner" → hält die flache Hand hochkant neben den Mundwinkel, ohne ihn zu verdecken | „das ist der Trick" → hebt den Zeigefinger auf Augenhöhe neben den Kopf | „ehrlich gesagt", „das habe ich selbst falsch gemacht" → legt die flache Hand aufs eigene Brustbein
GRÖSSE: „riesig", „so groß war das" → öffnet beide Arme auf Brusthöhe weit zur Seite | „geht steil nach oben" → führt die flache Hand schräg nach oben über Kopfhöhe | „bricht ein", „geht bergab" → führt die flache Hand schräg nach vorn-unten
ZEIT: „früher", „das ist lange her" → zeigt mit dem Daumen über die eigene Schulter nach hinten | „von da an bis heute" → hält beide Zeigefinger auf Brusthöhe weit auseinander | „jeden Tag", „immer wieder" → tippt mit dem Zeigefinger in die eigene offene Handfläche
KÖRPER: „meine Schulter", „hier tut es weh" → fasst sich mit der Gegenhand an genau diese Körperstelle | „im Nacken", „im Rücken" → legt die Hand in den eigenen Nacken
AUFFORDERUNG: „schreib es in die Kommentare" → zeigt mit gesenktem Zeigefinger schräg nach unten aus dem Bild | „folg mir", „abonnier das" → zeigt mit dem Zeigefinger senkrecht nach oben neben den Kopf | „speicher dir das" → schließt die Hand vor der Brust zur Faust
`;

/**
 * Aktions-Level "calm" — der bisherige Text, Wort für Wort unverändert.
 * Er ist der Default: jedes bestehende Projekt rendert damit weiter wie zuvor.
 */
const SPEECH_GESTURE_RULES_CALM = `
SO ENTSTEHT DIE "keyAction" EINER SPRECH-SZENE — RUHE IST DER REGELFALL:
- DIE MEISTEN SZENEN BEKOMMEN GAR KEINE GESTE. Die Grundhaltung ist ruhig: Hände locker vor dem Körper oder seitlich, Schultern zur Kamera, Blick in die Linse — und die ganze Aussage im GESICHT. Wer jeden Satz mit den Händen unterstreicht, wirkt vorgeführt statt überzeugt; genau daran erkennt man einen Clip als gemacht.
- HÖCHSTENS JEDE DRITTE SZENE trägt eine Handgeste, und NIE zwei Szenen hintereinander. Bei vier Szenen ist das eine, höchstens zwei — die übrigen stehen ruhig da und reden.
- Eine Geste bekommt nur der Satz, der sie WIRKLICH verlangt: eine direkte Ansprache, eine Zahl, ein harter Gegensatz, die Aufforderung am Schluss. Alles andere bleibt ruhig. Im Zweifel KEINE Geste — sie ist die Ausnahme, nicht die Begleitmusik.
- Das ist KEINE Absenkung der Energie: Tempo, Druck und Gefühl bleiben voll da, sie sitzen nur im Gesicht und in der Stimme statt in den Armen.
Wenn eine Szene eine Geste bekommt, gilt für sie:
- Leite sie aus dem dialogText GENAU DIESER Szene ab: gesucht ist die eine Geste, die diesen Satz zeigt. Nicht irgendeine Alltagshandlung, nicht die Handlung der Nachbarszene.
- GENAU EINE Geste, in EINEM Standbild lesbar. Der Clip wird aus einem einzigen erzeugten Foto gerendert — eine Abfolge („erst …, dann …") kommt im Bild nie an.
- Das Gesicht bleibt frei: Hände stehen seitlich neben der Gesichtskontur oder unterhalb des Kinns, nie davor, nie über Mund oder Augen.
- Arme bleiben im eigenen Bildbereich und im Ausschnitt: Ellbogen körpernah, höchstens doppelte Schulterbreite Ausschlag, kein Schritt und keine Drehung aus dem Bild.
- Nur der eigene Körper und was am Ort ohnehin steht. Keine erfundene Requisite, kein Schild, kein Zettel.

KATALOG — „Auslöser im Satz" → Geste (nur für die WENIGEN Szenen, die eine bekommen):${SPEECH_GESTURE_CATALOG}
UMGANG MIT DEM KATALOG:
- Er ist ein MUSTER, keine Auswahl- und erst recht keine Aufgabenliste: er sagt, WIE eine Geste aussieht, wenn eine kommt — nicht, DASS in jeder Szene eine kommt. Eigene Gesten im selben Geist sind erwünscht, solange sie aus dem Satz dieser Szene stammen.
- Nie zweimal hintereinander dieselbe Geste, und über die Szenenfolge hinweg die Kategorie wechseln — sonst sieht jedes Bild aus wie das vorige.
- Trägt ein Satz keine solche Aussage, dann die ruhige Grundhaltung (Hände locker vor dem Körper, Blick in die Linse) statt einer erfundenen Handlung. Das ist der NORMALFALL und keine Notlösung: lieber keine Geste als eine beliebige.
- Die Beispielsätze im Katalog („DEINE Schuld", „du machst das falsch") zeigen nur, WELCHE BEDEUTUNG eine Geste auslöst — sie sind KEINE Vorlage für den Wortlaut. Übernimm weder ihre Großbuchstaben noch ihren Vorwurfs-Ton in den dialogText.
`;

/**
 * Aktions-Level "active" — das Gegenstück, Punkt für Punkt an derselben Stelle.
 *
 * Gekippt wird ausschliesslich die HÄUFIGKEIT und die WEITE der Handlung. Alles,
 * was technisch nicht verhandelbar ist, steht hier wortgleich wie im ruhigen
 * Modus: genau EINE Handlung pro Szene (der Clip entsteht aus einem einzigen
 * Standbild), das Gesicht bleibt frei (darauf wird lippensynchronisiert), die
 * Handlung endet mit dem Blick in die Kamera, und Requisiten fallen nicht vom
 * Himmel (sonst reisst die Anschluss-Logik der Vlog-Direktive).
 */
const SPEECH_GESTURE_RULES_ACTIVE = `
SO ENTSTEHT DIE "keyAction" EINER SPRECH-SZENE — HANDELN IST DER REGELFALL:
- JEDE SZENE BEKOMMT EINE SICHTBARE HANDLUNG DER HÄNDE. Die Grundhaltung ist nicht Dastehen und Reden, sondern MACHEN und dabei Reden: zeigt auf etwas, hebt einen Gegenstand hoch, dreht ihn in der Hand, legt ihn weg, greift zum nächsten, drückt die Hantel hoch, tippt auf das Gerät. Wer nur dasteht und spricht, ist auf einem Handy-Display ein Standbild.
- DIE HANDLUNG IST GROSS UND SOFORT LESBAR: ganzer Arm statt Fingerspitze, Ellbogen weg vom Körper, der Gegenstand wirklich in der Hand und nicht angedeutet. Eine Bewegung, die man auf einem kleinen Screen übersieht, zählt in diesem Modus als keine.
- NIE ZWEI SZENEN HINTEREINANDER MIT DERSELBEN HANDLUNG. Die Art wechselt über das Reel: einmal ein Gegenstand in der Hand, einmal eine Zeige- oder Zählgeste, einmal ein Handgriff am Gerät, einmal die Hand am eigenen Körper. Dieselbe Bewegung zweimal liest sich als derselbe Clip.
- Das ist KEINE Zappelei: GENAU EINE klare Bewegung pro Szene, vollständig ausgeführt und in EINEM Standbild lesbar. Der Clip wird aus einem einzigen erzeugten Foto gerendert — eine Abfolge („erst …, dann …") kommt im Bild nie an.
- Die Energie liegt trotzdem auch im Gesicht: Tempo, Druck und Gefühl bleiben voll da. Die Hände kommen dazu, sie ersetzen den Ausdruck nicht.
Für JEDE Szene gilt außerdem:
- Leite die Handlung aus dem dialogText DIESER Szene oder aus der laufenden Tätigkeit ab — nie aus dem Nichts. „Drei Dinge" heißt drei hochgehaltene Finger; „diese Hantel hier" heißt, dass die Hantel wirklich in der Hand ist und angehoben wird; „schau dir das an" heißt, dass etwas in die Kamera gehalten wird.
- Schreibe sie so konkret, dass ein Bildmodell sie ohne die Szenenbeschreibung umsetzen könnte: WER, WAS in welcher Hand, auf welcher Höhe.
- Das Gesicht bleibt frei: Hände stehen seitlich neben der Gesichtskontur oder unterhalb des Kinns, nie davor, nie über Mund oder Augen. Ein verdeckter Mund macht den Clip unbrauchbar — darauf wird lippensynchronisiert.
- Die Arme bleiben im Ausschnitt: der Ausschlag darf weit sein, aber was die Hände tun, muss im Bild sichtbar bleiben. Braucht die Handlung mehr Raum, verlangt die Szene die größere Einstellung ("medium-shot" oder "medium-full-shot").
- Nur der eigene Körper und was am Ort ohnehin steht oder in einer früheren Szene schon dalag. Keine erfundene Requisite, kein Schild, kein Zettel, nichts Beschriftetes.
- Hat die Szene einen dialogText, ENDET die Handlung mit dem Blick in die Kamera (Muster: „drückt die Hantel auf Schulterhöhe hoch und schaut dabei wieder in die Linse") — die Handlung bleibt trotzdem vollständig, auch wenn sie den ganzen Körper braucht.

KATALOG — „Auslöser im Satz" → Geste (die Vorlage für die Szenen, in denen die Hand nichts hält):${SPEECH_GESTURE_CATALOG}
UMGANG MIT DEM KATALOG:
- Er ist ein MUSTER, keine Auswahlliste: er sagt, WIE eine Geste aussieht. Eigene Handlungen im selben Geist sind ausdrücklich erwünscht — vor allem solche, die einen Gegenstand einbeziehen, den der Ort ohnehin hergibt.
- Nie zweimal hintereinander dieselbe Geste, und über die Szenenfolge hinweg die Kategorie wechseln — sonst sieht jedes Bild aus wie das vorige.
- Trägt ein Satz keinen dieser Auslöser, dann nimm den nächsten Handgriff der laufenden Tätigkeit. Eine Szene ganz ohne sichtbare Handlung der Hände ist in diesem Modus ein Fehler.
`;

/**
 * Die EINE Auswahlstelle. Ohne Angabe „calm" — dieselbe Ausgabe wie vor der
 * Einführung des Schalters, damit ältere Aufrufer sich nicht ändern.
 */
export function getSpeechGestureRules(level: ActionLevel = "calm"): string {
  return level === "active" ? SPEECH_GESTURE_RULES_ACTIVE : SPEECH_GESTURE_RULES_CALM;
}

// Die Untergrenze ist von 14 auf 12 gerutscht (und für den Hook auf „so kurz wie
// möglich"): Die Cliplänge folgt dem gesprochenen Text, kurze Zeilen sind also
// unmittelbar schnellere Schnitte. Genau das trägt das Tempo eines Reels.
// Die frühere Untergrenze „niemals unter 20" ist gefallen: sie stammt aus der Zeit
// starrer 8s-Clips und erzwang ein Metronom. Bei ai-avatar folgt die Cliplänge dem
// Text, kurze Zeilen erzeugen also KEINE Stille mehr. Die Obergrenze 26 bleibt —
// sie schützt den Veo/Dub-Rückfall, der bei 6/8s hart kappt.

/**
 * Der gesprochene Teil der Storyboard-Anweisung — für Erzähler- UND Vlog-Reel
 * dieselbe Quelle.
 *
 * KERNGEDANKE: Eine Zeile gehört genau EINEM Clip. Sie beginnt in ihm und sie
 * endet in ihm. Vorher stand hier das Gegenteil (ein durchlaufender Satzbogen,
 * bei dem nur die letzte Zeile ein Satzzeichen bekam) — das schob die
 * Schlusskadenz jeder Zeile über den Bildschnitt in den nächsten Clip.
 *
 * Warum das technisch zählt: pro Szene läuft ein EIGENER TTS-Lauf, und dieses
 * Audio bestimmt die Cliplänge (Kling `ai-avatar`). Das Zeilenende ist damit
 * unmittelbar die Anweisung, wie die Stimme den Clip ausklingen lässt — ein
 * Punkt ergibt eine fallende, fertige Kadenz, ein Komma eine schwebende, die
 * hörbar ankündigt, dass es weitergeht. Endet eine Zeile dagegen auf einer
 * blanken Konjunktion („und", „weil"), hat der TTS-Lauf gar kein Signal: er
 * hängt eine willkürliche Nachlaufpause an einen abgerissenen Halbsatz.
 *
 * Deshalb sind hier exakt zwei Zeilenenden erlaubt: Satzende oder Komma.
 */
function buildSpokenScriptBlock(opts: {
  sceneCount: number;
  deliveryLine: string;
  everySceneRule: string;
  /** Der Aktions-Level steuert auch den TON des Gesprochenen. Ohne Angabe „calm". */
  actionLevel?: ActionLevel;
}): string {
  const { sceneCount, deliveryLine, everySceneRule } = opts;
  const actionActive = opts.actionLevel === "active";

  // ── LAUTSTÄRKE ───────────────────────────────────────────────────────────
  // Alles, was hier umschaltet, betrifft nur den REGISTER. Die Regeln zu
  // Zeilenenden, Kommas und Wortbudget stehen darunter unverändert für beide
  // Fassungen: sie sind keine Stilfrage, sondern die Bedingung dafür, dass die
  // Sprachausgabe saubere Clips liefert.
  // Bewusst Backticks statt Anführungszeichen: In diesen Sätzen stehen deutsche
  // Zitatzeichen, und das schließende ist im Bestand teils ein einfaches ASCII-
  // Anführungszeichen. In einem "…"-String bricht es den String auf.
  const loudnessRule = actionActive
    ? `- DAS AUSRUFEZEICHEN IST DEIN LAUTSTÄRKEREGLER. Die Sprachausgabe liest die Emotion AUS DEM TEXT: Ein Satz mit Ausrufezeichen wird hörbar energischer gesprochen als derselbe Satz mit Punkt. Trägt eine Zeile ein starkes Gefühl (Empörung, Begeisterung, Triumph, Dringlichkeit, Entsetzen), endet sie deshalb auf „!" — nicht auf Punkt. Die Hook-Zeile in Szene 1 endet fast immer auf „!". Setze es dort, wo die Person es wirklich lauter sagen würde; nicht in jede Zeile, sonst schreit das ganze Reel und nichts sticht mehr heraus.`
    // Der gemeldete Fehler war nicht „zu viel Energie", sondern SCHRIFTBILD-
    // Betonung: „KEIN Zufall, sondern DEINE Schuld!". Beides muss ausdrücklich
    // verboten werden — die Sprachausgabe liest Großbuchstaben als Schreien, und
    // ein Modell, dem man „ruhig" nur sagt, betont trotzdem weiter typografisch.
    : `- KEIN GESCHRIEBENES GESCHREI. Die Sprachausgabe liest die Betonung AUS DEM TEXT, deshalb gilt hier: KEIN einziges Wort in Großbuchstaben (nicht „KEIN", nicht „DEINE", nicht „NIE") und höchstens EIN Ausrufezeichen im ganzen Reel — im Zweifel gar keins. Punkt und Fragezeichen tragen diese Zeilen. Betone über die WORTWAHL und die Satzstellung, nie über Typografie.`;

  const hookRule = actionActive
    ? `- DIE HOOK-ZEILE (Szene 1) ENTSCHEIDET ALLES. Sie ist ein vollständiger, kurzer Satz mit der STEILSTEN Aussage des ganzen Reels — in die Kamera gerufen, nicht angesagt:
${getHookStyleRules("active").split("\n").map((l) => `  ${l}`).join("\n")}
- Danach fällt das Tempo NICHT ab: jede weitere Zeile bringt eine neue Information, eine Zuspitzung oder eine Wendung. Keine Zeile wiederholt die vorige mit anderen Worten, keine Zeile ist reine Überleitung.`
    : `- DIE ERSTE ZEILE (Szene 1) ENTSCHEIDET, OB WEITERGEHÖRT WIRD — im ruhigen Modus über den INHALT, nicht über die Lautstärke. Sie ist ein vollständiger, kurzer Satz, der sofort konkret wird:
${getHookStyleRules("calm").split("\n").map((l) => `  ${l}`).join("\n")}
- Danach wird es nicht zäh: jede weitere Zeile bringt eine neue Information oder einen neuen Gedanken. Keine Zeile wiederholt die vorige mit anderen Worten, keine Zeile ist reine Überleitung.`;

  const registerRule = actionActive
    ? `- Gesprochene Creator-Sprache: kurz, direkt, aktiv, keine Schachtelsätze. Direkte Ansprache („du") ist ausdrücklich erwünscht.`
    : `- SO REDET JEMAND MIT EINEM BEKANNTEN: kurz, direkt, normal — als würde die Person einem Gegenüber etwas erzählen, das sie selbst interessiert. Direkte Ansprache („du") ist erwünscht, aber als Zuwendung, nicht als Vorwurf: keine Schuldzuweisung („du machst das falsch", „DEINE Schuld"), keine Drohung, kein Verkaufston, keine Superlative, keine rhetorischen Verstärker („absolut", „komplett", „das Wichtigste überhaupt").`;

  // Das Beispiel trägt in der Praxis mehr als jede Regel — ein lautes Muster
  // unter einer leisen Anweisung gewinnt. Deshalb hat der ruhige Modus sein
  // eigenes, und es zeigt DIESELBEN technischen Eigenschaften (Zeilenenden,
  // kein Komma im Zeileninneren, ungleiche Längen).
  const exampleBlock = actionActive
    ? `BEISPIEL (4 Szenen, so und nicht anders):
1: "Dein Thema ist nicht das Problem. Deine erste Sekunde ist es!"
2: "Du fängst mit einer Erklärung an. In den ersten drei Sekunden zählt aber nur eine steile Behauptung,"
3: "Dein Zuschauer hat heute schon zwanzig andere Videos mit genau diesem braven Anfang weggewischt."
4: "Dreh dein letztes Video neu und knall die steilste Aussage in die erste Sekunde. Dann schreib mir dein Ergebnis!"

WAS DAS BEISPIEL ZEIGT: Zeile 1 ist der Hook — kurz, steil, ein Widerspruch, kein Anlauf, und mit Ausrufezeichen, damit die Stimme ihn auch wirklich rausdrückt. In KEINER der vier Zeilen steht ein Komma im Zeileninneren: Zeile 2 und 4 zerlegen ihre Aussage in zwei kurze Hauptsätze, statt sie mit „obwohl" oder „die" zu einem Satz zu verketten — genau das hält das Gesprochene in Fahrt. Zeile 2 endet auf Komma (die Stimme bleibt oben, die Aussage ist trotzdem fertig), Zeile 3 auf Punkt — die ruhige Feststellung dazwischen braucht keinen Druck. Die letzte Zeile trägt den Call-to-Action und wieder ein Ausrufezeichen. Keine Zeile setzt die vorige grammatisch fort. Zeilenlängen: 11 / 17 / 14 / 19 Wörter — der Hook ist die kürzeste, der Rest bewusst ungleich.`
    : `BEISPIEL (4 Szenen, so und nicht anders):
1: "Die meisten Videos verliere ich in der ersten Sekunde."
2: "Ich habe früher immer mit einer Erklärung angefangen. Dabei wartet darauf niemand,"
3: "Ein Zuschauer hat vor meinem Video heute schon zwanzig andere weggewischt."
4: "Fang dein nächstes Video mit deiner konkretesten Aussage an. Schreib mir gern, wie es lief."

WAS DAS BEISPIEL ZEIGT: Zeile 1 ist eine ruhige, konkrete Feststellung aus eigener Erfahrung — kein Anlauf, kein Vorwurf, kein Ausrufezeichen und kein Wort in Großbuchstaben. Trotzdem ist sofort klar, worum es geht. In KEINER der vier Zeilen steht ein Komma im Zeileninneren: Zeile 2 zerlegt ihre Aussage in zwei kurze Hauptsätze, statt sie mit „obwohl" oder „die" zu verketten. Zeile 2 endet auf Komma (die Stimme bleibt oben, die Aussage ist trotzdem fertig), Zeile 3 auf Punkt. Die letzte Zeile trägt den Call-to-Action und lädt ein, statt aufzufordern. Keine Zeile setzt die vorige grammatisch fort. Zeilenlängen: 9 / 16 / 13 / 16 Wörter — bewusst ungleich.`;

  return `
DAS GESPROCHENE SKRIPT IST DAS RÜCKGRAT — SCHREIBE ES ZUERST AM STÜCK:
- Formuliere zuerst EINEN durchgehenden Vortrag und zerlege ihn DANN in die ${sceneCount} dialogText-Zeilen. Setze die Schnitte auf die Satzgrenzen, nicht in die Sätze hinein.
- Genau EINE dialogText-Zeile pro Szene. Nie zwei Szenen zusammenziehen, nie eine Zeile auf zwei Szenen aufteilen, keine Szene ohne Zeile.
- JEDE Zeile endet an einem echten Satzzeichen — nur zwei sind erlaubt: Satzende (Punkt, Fragezeichen, Ausrufezeichen) ODER Komma. Nichts anderes.
- Eine Zeile endet NIEMALS auf einem blanken Bindewort: nicht auf „und", „aber", „weil", „dass", „wenn", „damit", „also", „dann", „obwohl", „sondern", „die", „der", „das". Ebenso wenig auf Doppelpunkt, Gedankenstrich, Auslassungspunkten oder ganz ohne Satzzeichen.
- Kein Satz läuft über den Schnitt. Was in einer Szene gesagt wird, ist am Ende dieser Szene gesagt — die gesprochene Zeile geht NICHT in den nächsten Clip über.
- Jede Zeile muss auch für sich allein vorgelesen verständlich sein. Die Folgezeile beginnt einen NEUEN Hauptgedanken und hängt grammatisch nicht an der vorigen: sie ergänzt keinen angefangenen Satz, führt keinen Nebensatz zu Ende und greift kein offenes Bindewort auf.
- Komma am Zeilenende ist erlaubt, aber es ist eine HÖRANWEISUNG, keine Fortsetzung: der Gedanke ist an dieser Stelle an einer natürlichen Atemstelle zu Ende, das Komma sagt der Stimme nur, dass sie am Schluss nicht ganz nach unten geht. Setze es genau dann, wenn die nächste Szene inhaltlich direkt nachlegt.
- Höchstens jede zweite Zeile endet auf Komma, im Zweifel Punkt. Die LETZTE Zeile endet IMMER auf Punkt, Frage- oder Ausrufezeichen — nie auf Komma.
- JEDES KOMMA IM ZEILENINNEREN IST EINE HÖRBARE PAUSE. Die Sprachausgabe setzt dort ab, jedes Mal. Deshalb: HÖCHSTENS EIN Komma innerhalb einer Zeile, und nur an einer Stelle, an der man beim Sprechen wirklich Luft holt. Kein Einschub zwischen zwei Kommas, keine dreigliedrige Aufzählung, kein vorangestellter Nebensatz („Wenn du das machst, dann …"). Semikolon, Doppelpunkt und Gedankenstrich kommen im Zeileninneren gar nicht vor — sie erzeugen dieselbe Pause, ohne dass sie jemand gewollt hätte.
- LIEBER ZWEI KURZE HAUPTSÄTZE ALS EINER MIT NEBENSATZ. „Du fängst mit einer Erklärung an. Dafür bleibt heute niemand." läuft gesprochen flüssig; dieselbe Aussage mit „obwohl" oder „die" hängt an ihrem Komma und zieht sich. Relativsätze („…, die …", „…, das …") und Konjunktionalsätze („…, weil …", „…, obwohl …") sind in gesprochenen Zeilen die häufigste Ursache für zerhackte Sätze — vermeide sie.
${loudnessRule}
${hookRule}
- Vermeide am Zeilenanfang leere Anlauf-Floskeln, die Zeit fressen, bevor die Aussage kommt: „Und deshalb", „Kurz gesagt", „Das heißt", „Aber hey", rhetorische Einstiegsfragen. Ein schlichtes Bindewort als Anschluss an den vorigen SATZ ist dagegen erlaubt.
${registerRule}
- Ein Clip ist HÖCHSTENS 8 Sekunden lang; die Cliplänge folgt dem gesprochenen Text und darf pro Szene verschieden sein. Wortmenge: ${DIALOG_WORD_BUDGET}.
${everySceneRule}
${deliveryLine}

${exampleBlock}
`;
}

/**
 * Wie eine Szenenzeile vorgetragen wird. Das Storyboard-Modell wählt pro Szene
 * genau EINEN `value` aus diesem Enum — dadurch kann es keine vom Modell
 * erfundenen, von ElevenLabs nicht unterstützten Audio-Tags geben.
 *
 * `tag` ist ein Inline-Audio-Tag für eleven-v3 (wird dort NICHT vorgelesen,
 * sondern als Regieanweisung interpretiert). Bei multilingual-v2 würde derselbe
 * Tag laut vorgelesen — dort wirken nur die Zahlenwerte.
 */
export interface VoiceDelivery {
  value: string;
  label: string;        // deutsch, für die UI
  tag: string;          // v3-Audio-Tag, "" = keiner
  stability: number;    // 0..1  — absoluter Wert für dieses Delivery
  style: number;        // 0..1  — nur v2
  speedMul: number;     // Multiplikator auf voiceSpeed, danach auf 0.7..1.2 clampen
}

/**
 * DIE SPANNE MUSS MAN HÖREN (Nutzerbefund 2026-08-13: „von der Stimme her nicht
 * passend zur ausgewählten Stimmung").
 *
 * KORRIGIERTE FASSUNG (an der Doku geprüft, nachdem die erste Spreizung zu weit
 * ging): Die Zahlen sind NICHT der Enthusiasmus-Hebel, für den sie kurzzeitig
 * gehalten wurden.
 *   • stability — steuert VARIANZ, nicht Energie: „Lower values introduce
 *     broader emotional range … Higher values can result in a monotonous
 *     voice". ElevenLabs nennt 0.50 als Startwert und warnt: „setting the
 *     slider too low may result in odd performances that are overly random".
 *   • style — verstärkt nur die REFERENZaufnahme („attempts to amplify the
 *     style of the original speaker"); ElevenLabs rät sogar ausdrücklich ab
 *     („we recommend keeping this setting at 0 at all times", es mache das
 *     Modell „slightly less stable"). Ist die gewählte Stimme ein ruhiger
 *     Erzähler, verstärkt ein hoher Wert ruhiges Erzählen — nicht Begeisterung.
 *   • speedMul — Tempo, multipliziert mit dem Projektwert, danach 0.7..1.2.
 * Die Werte hier bleiben deshalb in dem Band, das die Doku deckt: hörbar
 * unterschiedlich, aber ohne zwei Instabilitätsquellen übereinanderzustapeln.
 * Der eigentliche Emotionshebel ist bei multilingual-v2 der TEXT (Satzzeichen,
 * Ausrufezeichen) — siehe buildSpokenScriptBlock und die dialogSpeech-Regel.
 *
 * TAGS: `tag` wirkt AUSSCHLIESSLICH bei eleven-v3. Vier der bisherigen acht
 * Tags ([breathless], [calm], [serious], [urgent]) stehen in KEINER offiziellen
 * ElevenLabs-Liste — nicht erkannte Tags werden vorgelesen, „[urgent]" wäre also
 * als Wort im Clip gelandet. Hier stehen deshalb nur noch belegte Tags
 * (https://elevenlabs.io/docs/best-practices/prompting/eleven-v3); wo es keinen
 * passenden gibt, bleibt das Feld leer und die Zahlen tragen die Stimmung.
 */
/**
 * NACHGEZOGEN (Nutzerbefund: „manchmal zu viele Pausen im Gesprochenen, und
 * insgesamt zu gedehnt"). Zwei Stellschrauben, beide an derselben Ursache:
 *
 *   • stability ANGEHOBEN, wo sie unter 0.45 lag (0.35–0.42 → 0.44–0.48).
 *     Die Doku warnt genau davor: „setting the slider too low may result in
 *     odd performances that are overly random" — und dieses Zufällige äußert
 *     sich hörbar als Absetzen mitten im Satz. Weil der Reel-Prompt neutrale
 *     Emotionen VERBIETET, traf das fast jede Szene; „manchmal" war also in
 *     Wahrheit „immer dann, wenn die Emotion energisch, dringlich oder außer
 *     Atem war".
 *   • style GESENKT (0.25–0.35 → 0.20–0.25). Auch das ist laut Doku eine
 *     Instabilitätsquelle („makes the model slightly less stable"), und zwei
 *     davon übereinander waren eine zu viel.
 *   • speedMul um ~0.06 ANGEHOBEN, quer über alle Werte. Das ist die Antwort
 *     auf „insgesamt zu gedehnt" und wirkt sofort auf bestehende Projekte —
 *     anders als der Projektwert `voiceSpeed`, der einmal gespeichert liegen
 *     bleibt.
 *
 * Der ABSTAND zwischen den Stimmungen bleibt dabei erhalten (stability 0.44 bis
 * 0.68, speed 0.96 bis 1.18): Das Einebnen war schon einmal der Fehler — siehe
 * die Komma-Dämpfung in voice.ts, die 2026-08-13 rausflog, weil die Stimme
 * nicht mehr zur gewählten Stimmung passte.
 */
export const VOICE_DELIVERIES: VoiceDelivery[] = [
  { value: "neutral",      label: "Neutral",           tag: "",                stability: 0.50, style: 0.05, speedMul: 1.06 },
  { value: "energetic",    label: "Energisch",         tag: "[excited]",       stability: 0.46, style: 0.22, speedMul: 1.14 },
  { value: "breathless",   label: "Außer Atem",        tag: "[exhales]",       stability: 0.44, style: 0.22, speedMul: 1.10 },
  { value: "calm",         label: "Ruhig",             tag: "",                stability: 0.68, style: 0.00, speedMul: 1.00 },
  { value: "confidential", label: "Vertraulich",       tag: "[whispers]",      stability: 0.62, style: 0.10, speedMul: 0.96 },
  { value: "amused",       label: "Amüsiert",          tag: "[mischievously]", stability: 0.48, style: 0.20, speedMul: 1.08 },
  { value: "serious",      label: "Ernst",             tag: "",                stability: 0.65, style: 0.05, speedMul: 0.99 },
  { value: "urgent",       label: "Dringlich",         tag: "",                stability: 0.45, style: 0.25, speedMul: 1.18 },
];

/** Delivery-Lookup mit hartem Fallback auf "neutral" — Szenen aus alten
 *  Projekten (und Modell-Ausreißer) haben kein bzw. ein unbekanntes Delivery. */
export function getVoiceDelivery(value?: string): VoiceDelivery {
  return VOICE_DELIVERIES.find((d) => d.value === value) || VOICE_DELIVERIES[0];
}

/**
 * Delivery einer Szene — mit Rückfall auf ihre `emotion`.
 *
 * `voiceDelivery` gibt es erst seit dem Vlog-Umbau. Storyboards, die vorher
 * entstanden sind (oder bei denen das Modell das Feld ausgelassen hat), hätten
 * sonst AUSNAHMSLOS "neutral" — also bewusst ausdruckslos, obwohl in jeder
 * Szene längst eine `emotion` steht. Die wird hier ausgewertet, damit auch
 * alte Storyboards eine passende Färbung bekommen.
 */
// Sprachabdeckung: das `emotion`-Feld wird laut Storyboard-Prompt in der
// outputLanguage geschrieben, die App bietet aber de/en/es/fr/it/pt/nl/pl/tr
// an. Nur deutsche+englische Stämme hießen: ein spanisches Storyboard ohne
// voiceDelivery fiele IMMER auf "neutral" zurück („agotado" traf nie). Deshalb
// hier Wortstämme aller neun angebotenen Sprachen.
// STARKE GEFÜHLE MÜSSEN HIER STEHEN, sonst hört man sie nicht: Der
// Storyboard-Prompt verlangt im Reel ausdrücklich Überraschung, Ungläubigkeit,
// Empörung, Triumph, Entsetzen und Erleichterung — genau diese Wörter trafen
// keinen einzigen Stamm und fielen deshalb auf "neutral" zurück. Das Reel sah
// dann emotional aus und klang trotzdem flach.
const EMOTION_TO_DELIVERY: { re: RegExp; value: string }[] = [
  { re: /außer atem|ausser atem|breathless|erschöpf|erschoepf|angestrengt|keuch|agotad|sin aliento|jadeante|essouffl|senza fiato|affannat|ofegante|sem f(ô|o)lego|buiten adem|hijgend|zadysz|bez tchu|nefes nefese|yorgun/i, value: "breathless" },
  { re: /begeister|euphor|aufgereg|excited|energie|energisch|freud|fröhlich|froehlich|stolz|emocionad|entusiasm|energic|en(é|e)rgiqu|eufori|animad|enthousiast|energiek|podekscytow|entuzjazm|heyecan|coşku|cosku/i, value: "energetic" },
  // Überraschung, Staunen, Ungläubigkeit, Triumph — hohe Erregung, aber nicht
  // dringlich: dieselbe Färbung wie Begeisterung.
  { re: /überrasch|ueberrasch|verblüfft|verbluefft|erstaunt|staun|sprachlos|ungläubig|unglaeubig|unglaub|triumph|jubel|surprise|astonish|amazed|stunned|speechless|disbelief|incredul|triumphant|jubilant|sorprend|asombrad|at(ó|o)nit|incr(é|e)dul|triunf|jubilos|surpris|(é|e)tonn|stup(é|e)fait|incr(é|e)dul|triomph|sorpres|stupit|stupefatt|sbalordit|increduli|trionf|espantad|at(ô|o)nit|verrast|verbaasd|ongelovig|triomf|zaskocz|zdumion|niedowierz|szok(?!uj)|(ş|s)a(ş|s)k|hayret|zafer/i, value: "energetic" },
  // „dringlich" fehlte — und das ist ausgerechnet das LABEL dieses Deliveries in
  // der UI („Dringlich"). Schrieb das Modell es als `emotion`, fiel die Szene auf
  // "neutral" zurück: sichtbar als Dringlich markiert, gesprochen wie ein
  // Wetterbericht. Dieselbe Falle gilt für jedes andere Label, deshalb sind sie
  // hier jetzt alle abgedeckt (energisch, ruhig, ernst, amüsiert, vertraulich,
  // außer atem stehen bereits in ihren Zeilen).
  { re: /dringend|dringlich|panik|alarm|warn|urgent|hektisch|eilig|urgenz|urgencia|urg(ê|e)ncia|pressant|pilne|nagl(ą|a)c|acil|spoed/i, value: "urgent" },
  // Empörung und Entsetzen: presst nach vorn, schnellstes Tempo — deshalb
  // "urgent" und nicht "energetic".
  { re: /empör|empoer|entrüst|entruest|entsetz|schockiert|geschockt|fassungslos|wütend|wuetend|aufgebracht|verärgert|veraergert|outrage|indignant|furious|appalled|horrified|shocked|indignad|furios|horrorizad|conmocionad|indign(é|e)|furieux|horrifi(é|e)|choqu(é|e)|indignat|arrabbiat|inorridit|scioccat|zangad|chocad|verontwaardigd|woedend|geschokt|ontzet|oburz|w(ś|s)ciek|wstrz(ą|a)(ś|s)|przera(ż|z)on|(ö|o)fke|k(ı|i)zg(ı|i)n|deh(ş|s)et/i, value: "urgent" },
  { re: /amüsi|amuesi|belustig|schmunzel|ironisch|witzig|lach|grins|amused|amus(é|e)e?\b|divertid|divertent|rozbawi|zabawn|e(ğ|g)len|geamuseerd|grappig/i, value: "amused" },
  { re: /vertraul|flüster|fluester|heimlich|leise|intim|geheim|confidencial|confidentiel|confidenzial|vertrouwelijk|poufn|gizli|susurr|chuchot|sussurr|fluister|f(ı|i)s(ı|i)lt/i, value: "confidential" },
  // „nachdruck/entschloss/bestimmt/unmissverst" kamen dazu, als die letzte Szene
  // ausdrücklich auf diese Wörter verpflichtet wurde (siehe den Abschluss-Block
  // im Storyboard-Prompt). Ohne sie fiele genau die Schlusszeile auf "neutral"
  // zurück — sichtbar als ernst markiert, gesprochen wie eine Zwischenszene.
  //
  // BEWUSST NICHT „eindringlich": das Wort enthält „dringlich" und trifft damit
  // die urgent-Zeile weiter oben zuerst (`find` nimmt den ersten Treffer). Für
  // einen Abschluss ist urgent falsch — es hetzt, statt zu setzen.
  { re: /ernst|besorgt|nachdenk|traurig|betroffen|streng|nachdr(ü|u)ck|entschloss|bestimmt|unmissverst|serious|s(é|e)rieux|s(é|e)ri[oa]\b|serieus|powa(ż|z)n|ciddi|preocupad|inquiet|preoccupat|bezorgd/i, value: "serious" },
  // DAS RUHIGE, ABER ZUGEWANDTE REGISTER (Aktions-Level "calm", 2026-08-16).
  //
  // Diese Wörter trafen bisher KEINEN einzigen Stamm und fielen damit auf
  // "neutral" zurück — also auf die ausdruckloseste Einstellung des ganzen
  // Systems: sichtbar als „interessiert" markiert, gesprochen wie ein
  // Wetterbericht. Genau das ist im ruhigen Modus der wahrscheinliche Fall, weil
  // sein Wortvorrat aus eben diesen leisen Gefühlen besteht.
  //
  // WARUM DAS HIER ZÄHLT UND NICHT NUR IM VLOG: Der Erzähler-Pfad hat gar kein
  // `voiceDelivery`-Feld (das Schema führt es nur bei vlogActive) — dort ist
  // diese Ableitung die EINZIGE Steuerung der Stimme.
  //
  // "amused" (0.48/0.20/1.08) statt "calm" (0.68/0.00/1.00): lebendig, aber
  // nicht laut. Die höchste Stability des Katalogs wäre hier falsch — die
  // ElevenLabs-Doku warnt bei hohen Werten ausdrücklich vor „a monotonous
  // voice", und ein teilnahmsloser Clip ist auch im ruhigen Modus ein Fehler.
  // Wortstämme, nicht Vollformen: Das Modell schreibt in dieses Feld mal ein
  // Adjektiv („interessiert"), mal ein Substantiv („Interesse"). `interessiert`
  // allein hätte die Substantivform verfehlt — und damit wieder „neutral"
  // ergeben. Dasselbe gilt für Wärme/warmherzig und Neugier/neugierig.
  { re: /überzeug|ueberzeug|zugewandt|interess|neugier|gespannt|freundlich|warmherzig|w(ä|ae)rme|aufmerksam|zuversicht|wohlwollend|convinced|interest|curious|friendly|attentive|confident|warmth/i, value: "amused" },
  // Erleichterung gehört hierher, nicht zu "energetic": sie ist ein Lösen, kein
  // Ausbruch — und ohne Stamm fiele sie sonst auf "neutral".
  { re: /ruhig|gelassen|entspann|sanft|calm|zufrieden|erleichter|relief|relieved|sereno|serein|rustig|spokojn|sakin|relajad|aliviad|alivio|soulag(é|e)|sollievo|sollevat|d(é|e)tendu|rilassat|relaxad|ontspannen|opgelucht|ulga|rahatlam|tranquil/i, value: "calm" },
];

export function deliveryForScene(scene: Pick<StoryScene, "voiceDelivery" | "emotion">): VoiceDelivery {
  const explicit = VOICE_DELIVERIES.find((d) => d.value === scene.voiceDelivery);
  if (explicit) return explicit;
  const emotion = (scene.emotion || "").trim();
  if (emotion) {
    const hit = EMOTION_TO_DELIVERY.find((m) => m.re.test(emotion));
    if (hit) return getVoiceDelivery(hit.value);
  }
  return VOICE_DELIVERIES[0];
}

// DER HOOK MUSS KNALLEN. Der Hook lebt weiter in der STIMME — der Bild-Gag von
// früher („while a dramatic visual literally acts it out") kommt NICHT zurück.
// Was zurückkommt, ist die WUCHT: die frühere Fassung dieser Defaults verlangte
// eine „calm, present person" in Sekunde 1 und erzeugte damit genau den
// höflichen, wegscrollbaren Anfang, den ein Reel nicht überlebt. Jetzt: steile
// Behauptung, volle Energie, Emotion im Gesicht — ruhig bleibt nur die
// Inszenierung (keine Stunts), nicht der Vortrag.
export const REEL_DEFAULT_HOOK_DIRECTIVE =
  "Open on the single boldest, most provocative spoken claim of the whole reel, fired straight into the lens in the first second — " +
  "loud, certain, almost confrontational, the kind of sentence that makes a thumb stop. The voice carries the hook, and the face " +
  "carries the emotion: eyes wide open on the lens, brows up, the feeling of the sentence unmistakably visible from the first frame.";

/** Default-Hook für Reels OHNE Sprechtext — dann trägt das Gesicht allein. */
export const REEL_DEFAULT_VISUAL_HOOK_DIRECTIVE =
  "Open in the very first second on a person at peak expression — surprise, delight or disbelief already all over their face, " +
  "aimed straight at the lens. No build-up, no setup shot, no warm-up: the emotional peak IS the first frame.";

/** Default-Hook für das VLOG-Reel. Die Gag-/Stunt-Sprache des Erklär-Formats
 *  („a dramatic visual literally acts it out on screen") würde hier gegen den
 *  gesamten Vlog-Block arbeiten: im Vlog trägt die STIMME den Hook, das Bild
 *  bleibt ein gewöhnlicher Moment der laufenden Tätigkeit — aber mit voller
 *  Energie im Vortrag und deutlich sichtbarer Emotion im Gesicht. */
export const REEL_DEFAULT_VLOG_HOOK_DIRECTIVE =
  "Open on the strongest, steepest spoken claim of the whole reel in the very first second — the first word already out, the activity " +
  "already running, said with real force straight into the lens. The picture stays an ordinary moment of the ongoing activity, but the " +
  "delivery does not: big energy, wide eyes on the lens, the emotion of the sentence plainly readable on the face.";

/** Vlog-Default-Hook OHNE Sprechtext — dann trägt die Tätigkeit allein. */
export const REEL_DEFAULT_VLOG_VISUAL_HOOK_DIRECTIVE =
  "Open in the very first second already in the middle of the ongoing everyday activity, caught on a strong, clearly readable reaction — " +
  "surprise, delight or disbelief on the face. No intro, no build-up, no setup shot, just the situation already running at full energy.";

/**
 * WAS EIN GUTER HOOK IST — eine Definition, zwei Verwendungsstellen.
 *
 * Der Hook-Generator (`buildHookCtaPrompt`) schreibt danach, und der
 * Storyboard-Prompt hält sich beim Formulieren der ersten Zeile daran. Stünde
 * die Regel nur beim Generator, verwässerte das Storyboard-Modell einen
 * scharfen Hook wieder zu einer braven Einleitung; stünde sie nur im
 * Storyboard, schriebe der Generator Vorschläge, die dort gar nicht gebraucht
 * werden. Deshalb EINE Quelle.
 */
const HOOK_STYLE_RULES_ACTIVE = [
  "Der Hook ist EIN gesprochener Satz, höchstens 12 Wörter, und er ist das Steilste, was im ganzen Reel gesagt wird.",
  "Er ist eine BEHAUPTUNG, kein Anmoderieren: eine steile These, ein Widerspruch zu etwas allgemein Geglaubtem, ein Vorwurf, eine verbotene Wahrheit, eine schockierende Zahl oder ein Fehler, den fast alle machen.",
  "Ton: laut, direkt, in die Kamera gerufen — so, wie „Albert Einstein hat gelogen.\" in die Linse gerufen wird. Er darf provozieren, überraschen, empören oder begeistern; er darf NIE höflich, brav oder erklärend anfangen.",
  "Kein Gruß, keine Vorstellung, kein „In diesem Video\", kein „Heute zeige ich dir\", keine Anlauf-Floskel, kein Meta-Satz über das Reel selbst.",
  "Keine leere Clickbait-Behauptung: Der Hook muss zu genau dieser Story gehören und im Reel eingelöst werden. Er übertreibt die Zuspitzung, nicht die Tatsachen.",
  "Er endet auf Punkt oder Ausrufezeichen. Eine Frage ist nur erlaubt, wenn sie selbst schon die steile Behauptung enthält.",
].join("\n");

/**
 * Derselbe Hook im RUHIGEN Modus (`actionLevel === "calm"`).
 *
 * WARUM ER GEBRAUCHT WIRD (Nutzerbefund 2026-08-16 am erzeugten Storyboard):
 * Die Fassung darüber erzeugt Zeilen wie „Deine Schulterschmerzen sind KEIN
 * Zufall, sondern DEINE Schuld!" — Großbuchstaben als Betonung, Ausrufezeichen,
 * Vorwurf. Genau das wollte der Nutzer im ruhigen Modus nicht: „es soll eher wie
 * eine normale Unterhaltung sein".
 *
 * RUHIG IST NICHT LANGWEILIG. Was bleibt, ist die Aufgabe des ersten Satzes: Er
 * muss sofort konkret sein und einen Grund zum Zuhören geben. Was wegfällt, ist
 * die Lautstärke — nicht der Inhalt. Ein braves „In diesem Video zeige ich dir"
 * bleibt in BEIDEN Fassungen verboten.
 */
const HOOK_STYLE_RULES_CALM = [
  "Der Hook ist EIN gesprochener Satz, höchstens 12 Wörter, und er ist der Grund, warum jemand weiterhört.",
  "Er ist eine konkrete FESTSTELLUNG oder Beobachtung, wie man sie einem Bekannten gegenüber machen würde: etwas Überraschendes, das man selbst erlebt hat, ein verbreiteter Irrtum, eine konkrete Zahl, eine Frage, die den anderen wirklich betrifft.",
  "Ton: ruhig, normal gesprochen, wie am Anfang eines Gesprächs. Nicht gerufen, nicht angeklagt, nicht verkauft. Der Satz überzeugt, weil er konkret ist — nicht, weil er laut ist.",
  "KEINE Wörter in Großbuchstaben, keine Ausrufezeichen, keine reißerische Zuspitzung, kein Vorwurf an den Zuschauer (etwa „DEINE Schuld\"), keine Werbesprache, keine Übertreibung.",
  "Kein Gruß, keine Vorstellung, kein „In diesem Video\", kein „Heute zeige ich dir\", keine Anlauf-Floskel, kein Meta-Satz über das Reel selbst. Ruhig heißt direkt anfangen, nicht sich warmlaufen.",
  "Er muss zu genau dieser Story gehören und im Reel eingelöst werden.",
  "Er endet auf einem Punkt — oder auf einem Fragezeichen, wenn es eine echte Frage ist.",
].join("\n");

/** Die eine Auswahlstelle für den Hook-Stil. Ohne Angabe „calm" (Default). */
export function getHookStyleRules(level: ActionLevel = "calm"): string {
  return level === "active" ? HOOK_STYLE_RULES_ACTIVE : HOOK_STYLE_RULES_CALM;
}

/** Was ein CTA ist — dieselbe Ein-Quellen-Logik wie beim Hook. */
const CTA_STYLE_RULES_ACTIVE = [
  "Der Call-to-Action ist EIN kurzer gesprochener Satz, höchstens 12 Wörter, den die Person am Ende sagt.",
  "Genau EINE Handlung, und zwar eine, die direkt in der App möglich ist, in der das Reel läuft: kommentieren, speichern, folgen, teilen, ein Stichwort schreiben.",
  "Er passt zum Ziel des Projekts aus dem Profil und zum Inhalt der Story — nie ein beliebiger Allzweck-Aufruf.",
  "Gesprochene Sprache, direkte Ansprache („du\"), mit Energie und Vorfreude gesagt — keine Werbefloskel, kein „Jetzt sofort klicken!\", keine Aufzählung mehrerer Wünsche.",
].join("\n");

/** CTA im ruhigen Modus: dieselbe EINE Handlung, nur beiläufig gesagt statt
 *  angepriesen. Ein aufgedrehter Schlusssatz wäre nach vier ruhigen Szenen der
 *  einzige Bruch im ganzen Reel. */
const CTA_STYLE_RULES_CALM = [
  "Der Call-to-Action ist EIN kurzer gesprochener Satz, höchstens 12 Wörter, den die Person am Ende sagt.",
  "Genau EINE Handlung, und zwar eine, die direkt in der App möglich ist, in der das Reel läuft: kommentieren, speichern, folgen, teilen, ein Stichwort schreiben.",
  "Er passt zum Ziel des Projekts aus dem Profil und zum Inhalt der Story — nie ein beliebiger Allzweck-Aufruf.",
  "Gesprochene Sprache, direkte Ansprache („du\"), aber beiläufig gesagt — wie eine Einladung am Ende eines Gesprächs, nicht wie ein Aufruf. Keine Großbuchstaben, kein Ausrufezeichen, keine Werbefloskel, kein Drängen.",
].join("\n");

export function getCtaStyleRules(level: ActionLevel = "calm"): string {
  return level === "active" ? CTA_STYLE_RULES_ACTIVE : CTA_STYLE_RULES_CALM;
}

/**
 * Prompt für den automatischen Hook + CTA.
 *
 * WARUM ES DEN GIBT: Beide Felder waren optional und blieben deshalb im
 * Normalfall leer. Leerer Hook hieß „generische Standard-Direktive", leerer CTA
 * hieß „gar kein CTA" — das Reel begann also brav und endete ohne Aufforderung,
 * obwohl beides das ist, worüber ein Reel gewinnt. Jetzt schreibt das Modell
 * vor dem Storyboard beides passend zu Profil, Idee und Story.
 *
 * Das Ergebnis wird in die sichtbaren Felder zurückgeschrieben (StoryPage) —
 * der Nutzer sieht also, womit sein Reel anfängt und aufhört, und kann es
 * überschreiben. Ein unsichtbar wirkender Automatismus wäre hier das Falsche.
 */
export function buildHookCtaPrompt(opts: {
  mode: StoryMode;
  idea: string;
  language: string;
  reelStyle?: ReelStyle;
  customDetails?: string;
  characterNames?: string[];
  /** Profil-Vorspann (buildProfilePreamble) — steht bewusst ganz oben. */
  profileContext?: string;
  /** Welche Felder überhaupt gebraucht werden — ein gefülltes Feld bleibt stehen. */
  needHook: boolean;
  needCta: boolean;
  /** Steuert den TON der beiden Sätze. Ohne Angabe „calm" (Default). */
  actionLevel?: ActionLevel;
}): string {
  const { mode, idea, language, needHook, needCta } = opts;
  const langName = getLanguageName(language);
  const profileBlock = opts.profileContext?.trim() ? `${opts.profileContext.trim()}\n\n` : "";
  const names = (opts.characterNames ?? []).filter(Boolean);
  const details = (opts.customDetails ?? "").trim();

  const wanted = [needHook ? '"hook"' : "", needCta ? '"cta"' : ""].filter(Boolean).join(" und ");
  const schema = [needHook ? '"hook": "string"' : "", needCta ? '"cta": "string"' : ""].filter(Boolean).join(", ");

  return `${profileBlock}Du schreibst ${wanted} für ein kurzes, vertikales Social-Media-Video (${
    mode === "reel" ? "Reel im Creator-Stil — TikTok, Instagram Reels, YouTube Shorts" : "Story-Video mit Handlung"
  }).

STORY:
${[
  `- Idee: "${idea.trim()}"`,
  details ? `- Zusatzinfos: "${details}"` : "",
  names.length ? `- Sprechende Personen: ${names.join(", ")}` : "",
  `- Sprache: ${langName} — schreibe ${wanted} AUSSCHLIESSLICH in dieser Sprache.`,
].filter(Boolean).join("\n")}

${needHook ? `HOOK — der erste gesprochene Satz des Videos:\n${getHookStyleRules(opts.actionLevel)}\n` : ""}
${needCta ? `CALL-TO-ACTION — der letzte gesprochene Satz des Videos:\n${getCtaStyleRules(opts.actionLevel)}\n` : ""}
HARTE AUSGABEREGELN:
- Antworte ausschließlich mit einem einzigen validen JSON-Objekt: {${schema}}
- Nur der reine Sprechtext in den Feldern — keine Regieanweisung, keine Anführungszeichen im Wert, keine Emojis, keine Hashtags, kein Sprechername.`;
}

/**
 * Default-Hook im RUHIGEN Modus. Greift nur, wenn das Hook-Feld leer ist (also
 * wenn `ensureHookAndCta` nichts geschrieben hat, z. B. nach einem Fehlschlag) —
 * dann darf hier aber nicht die laute Fassung stehen, sonst kippt genau dieser
 * Rückfall das ganze Reel zurück in den Ruf-Ton.
 */
const REEL_DEFAULT_CALM_HOOK_DIRECTIVE =
  "Open on the most concrete, most specific spoken sentence the story has — said plainly into the lens in the first second, the way " +
  "someone opens a conversation with a friend. No greeting, no build-up, but no shouting either: no words in capitals, no exclamation, " +
  "no accusation. The face is calm and present, the eyes are on the lens, and what it shows is genuine interest in what is being said.";

/** Ruhiger Default-Hook OHNE Sprechtext — dann trägt das Gesicht allein, aber leise. */
const REEL_DEFAULT_CALM_VISUAL_HOOK_DIRECTIVE =
  "Open in the very first second on a person already in the middle of the moment, with a quiet but clearly readable reaction on their " +
  "face — interest, mild surprise, recognition. No build-up and no setup shot, but no wide-eyed peak expression either.";

export function getEffectiveStoryHook(
  mode: StoryMode,
  hook: string,
  hasSpeech: boolean = true,
  reelStyle?: ReelStyle,
  actionLevel: ActionLevel = "calm",
): string {
  const trimmed = hook.trim();
  if (trimmed) return trimmed;
  if (mode !== "reel") return "";
  // Der ruhige Modus hat EINEN Default für beide Reel-Stile: Der Unterschied
  // zwischen Vlog und Erzähler liegt im BILD (durchgehende Tätigkeit vs. neues
  // Setting), und den trägt der jeweilige Direktiven-Block ohnehin. Ihn hier zu
  // wiederholen hieße nur, den Ton an zwei Stellen pflegen zu müssen.
  if (actionLevel === "calm") {
    return hasSpeech ? REEL_DEFAULT_CALM_HOOK_DIRECTIVE : REEL_DEFAULT_CALM_VISUAL_HOOK_DIRECTIVE;
  }
  // Vlog-Reel: eigener Default-Hook. Der Erklär-Hook fordert einen dramatischen
  // Bild-Gag und würde als „LEITPLANKE" im Storyboard und als „Opening
  // directive" im ersten Clip direkt gegen „KEIN Gag, KEIN Stunt" stehen.
  if (reelStyle === "vlog") {
    return hasSpeech ? REEL_DEFAULT_VLOG_HOOK_DIRECTIVE : REEL_DEFAULT_VLOG_VISUAL_HOOK_DIRECTIVE;
  }
  return hasSpeech ? REEL_DEFAULT_HOOK_DIRECTIVE : REEL_DEFAULT_VISUAL_HOOK_DIRECTIVE;
}

export const LANGUAGE_NAMES: Record<string, string> = {
  de: "German", en: "English", es: "Spanish", fr: "French", it: "Italian",
  pt: "Portuguese", nl: "Dutch", pl: "Polish", tr: "Turkish", ru: "Russian",
  ja: "Japanese", zh: "Chinese",
};

export function getLanguageName(code: string): string {
  return LANGUAGE_NAMES[code] || code;
}

/**
 * Pacing-Instruktion. Im VLOG-Reel gilt eine eigene Fassung — aus demselben
 * Grund wie bei `getStoryMoodInstruction`.
 *
 * KONFLIKTAUFLÖSUNG: Die Erklär-Reel-Formeln fordern pro Clip ein
 * aussagetragendes, disruptives BILD („every cut delivers the next punchy
 * statement plus its visual"). Im Vlog-Prompt steht zwei Zeilen später das
 * genaue Gegenteil (die Stimme trägt, das Bild bleibt ein gewöhnlicher
 * Moment). Das Modell löste diesen Widerspruch bisher auf, indem es ein
 * plakativeres, allgemeineres Bild rendert statt der in der Szene
 * beschriebenen Handlung. Die Vlog-Fassung nimmt das Tempo aus dem SPRECHEN
 * und aus den Jump Cuts — und verlangt trotzdem pro Cut einen sichtbaren
 * Fortschritt, damit die Szenen sich unterscheiden.
 */
export function getStoryPacingInstruction(pacing: string, mode: StoryMode, reelStyle?: ReelStyle): string {
  if (mode === "reel" && reelStyle === "vlog") {
    switch (pacing) {
      case "instant-action":
        return "Already speaking and already in the middle of the action in the first 0.5-1 second, at full energy — the first word lands immediately, no warm-up, no empty lead-in";
      case "slow-build":
        return "The point builds across the cuts, but every single clip already shows the person visibly doing something and visibly feeling something";
      case "fast-cuts":
        return "Short jump cuts in quick succession — every cut lands on a visibly different moment of the same session, and the delivery keeps driving forward";
      case "tension-arc":
      default:
        return "Spoken hook first, then one clear statement per cut — the pace comes from the speaking and from the jump cuts, and each cut shows the person a visible step further along; nothing ever idles";
    }
  }
  // TEMPO IM REEL: Es kommt aus dem SPRECHEN, dem AUSDRUCK und dem SCHNITT —
  // nicht aus körperlicher Action (keine Stunts, das bleibt). Die vorherigen
  // Fassungen hängten an jede Reel-Zeile ein „the person stays calm" bzw. „the
  // picture stays calm" und machten damit aus „ruhige Inszenierung" ein „ruhiger
  // Mensch": das Ergebnis war zwar sauber, aber langsam und langweilig. Ruhig
  // bleibt die KAMERA und die Handlung, nie der Vortrag.
  switch (pacing) {
    case "instant-action":
      return mode === "reel"
        ? "Already speaking in the first 0.5-1 second — the first word lands immediately, no warm-up, no empty lead-in; the voice starts instantly and at full energy, the emotion is on the face from frame one"
        : "The telling starts within the first 2 seconds — no empty lead-in, but no staged action either";
    case "slow-build":
      return mode === "reel"
        ? "The point builds across the cuts through what is SAID — each clip pushes the telling one step further and one step higher in energy, never repeating a beat"
        : "The story unfolds gradually over 3-5 seconds, carried by the telling";
    case "fast-cuts":
      return mode === "reel"
        ? "Hard visible cut from clip to clip with strong contrast in framing — each clip a punch, no dead air, no winding down before a cut"
        : "Fast rapid cuts throughout — the variety comes from framing and angle, not from action";
    case "tension-arc":
    default:
      return mode === "reel"
        ? "Spoken hook first, every cut delivers the next spoken statement, punchline or call-to-action at the end — the words carry the arc and the energy rises with it"
        : "A narrative arc carried by the telling — tension lives in the words and the atmosphere, not in physical action";
  }
}

/**
 * Stimmungs-Instruktion. Im VLOG-Reel gilt eine eigene Fassung: dort lebt die
 * Stimmung im VORTRAG, nicht in der Inszenierung. Die normalen Texte
 * („High-stakes, suspenseful", „kinetic energy and high momentum") fordern
 * dramatische Inszenierung bzw. Kamerabewegung und stehen damit in JEDEM Bild-
 * und Video-Prompt direkt gegen den festen Kameraaufbau und die bewusst
 * gewöhnliche Situation des Vlogs.
 */
export function getStoryMoodInstruction(mood: string, mode: StoryMode = "general", reelStyle?: ReelStyle): string {
  // IM REEL IST DIE EMOTION SICHTBAR. Die vorherigen Fassungen legten die
  // Stimmung fast ausschließlich in die STIMME und dämpften das Gesicht mit
  // („never staged for effect", „the staging stays calm"). Für ein Reel ist das
  // zu wenig: Was der Zuschauer im Vorbeiscrollen sieht, ist ein Gesicht. Also
  // liegt die Stimmung jetzt in Vortrag UND Gesicht — und ist dort groß genug,
  // um auf einem Handy-Display in einer halben Sekunde gelesen zu werden.
  // Unangetastet bleibt die Inszenierung: keine Stunts, keine Gags, keine
  // aufgedrehte Kamera. Groß ist der AUSDRUCK, nicht die Handlung.
  if (mode === "reel" && reelStyle === "vlog") {
    switch (mood) {
      case "action":      return "Brisk, upbeat delivery with high verbal energy and a visibly fired-up face — while the camera stays put and the activity stays ordinary";
      case "calm":        return "Relaxed, unhurried delivery — the person talks as if they have all the time in the world, but stays warm and visibly engaged, never blank";
      case "emotional":   return "Open and personal in the delivery, with big honest facial reactions that are unmistakable on a phone screen — felt, not posed";
      case "mysterious":  return "Lowered, confidential delivery with a knowing look straight into the lens, as if letting the viewer in on something";
      case "cheerful":    return "Warm, upbeat, easy-going delivery with a wide genuine smile and bright, lively eyes";
      // KONFLIKTAUFLÖSUNG: „not in the staging" war die vierte Stelle im selben
      // Bild-Prompt, die dem Modell sagt, die Bildhandlung sei zweitrangig
      // (neben „the spoken words carry the message", „the activity is just what
      // the person happens to be doing", „never becomes the main event"). Die
      // Häufung las sich als Anweisung, JEDE deutliche Handlung zu dämpfen —
      // aus „steht abrupt auf" wurde eine Gewichtsverlagerung im Sitzen. Der
      // Nachsatz kappt die Kette, ohne den gedämpften Vlog-Ton anzutasten.
      case "dramatic":
      default:            return "Fired up and completely convinced of what they are saying — the energy lives in the delivery and in the face; the staging stays ordinary, but whatever the action is, it happens fully";
    }
  }
  // ERKLÄR-/ERZÄHL-REEL: dieselbe Trennung wie im Vlog — Ausdruck groß,
  // Inszenierung ruhig. Bis hierher teilte sich dieser Zweig seine Texte mit dem
  // Story-Modus; die dämpfenden Nachsätze („the body and the staging stay calm",
  // „never staged for effect") gehören aber zum Film, nicht zum Reel.
  if (mode === "reel") {
    switch (mood) {
      case "action":      return "Brisk, energetic delivery and a visibly fired-up face — the energy lives in the voice and the expression, while the body and the staging stay believable";
      case "calm":        return "Controlled and grounded — unhurried telling, soft light, but always visibly engaged and looking right at the viewer, never blank";
      case "emotional":   return "Emotionally wide open — big honest facial reactions that read instantly on a phone screen, and a personal, moved tone";
      case "mysterious":  return "Lowered, confidential tone and moody light, a knowing look straight into the lens, as if letting the viewer in on something";
      case "cheerful":    return "Bright and infectious — a wide genuine smile, lively eyes and an upbeat, delighted telling";
      case "dramatic":
      default:            return "Intense and gripping — the weight lives in the words and shows fully in the face; the staging stays ordinary, the expression does not";
    }
  }
  // STORY-MODUS (unverändert): Stimmung lebt in Vortrag, Gesicht, Licht und
  // Atmosphäre — nie in körperlicher Action oder Inszenierung. Die früheren
  // Fassungen („kinetic energy and high momentum", „High-stakes") forderten
  // genau die Dramatik, die das Format nicht mehr will; die Vlog-Fassungen oben
  // waren die Vorlage.
  switch (mood) {
    case "action":      return "Brisk, energetic delivery and lively facial engagement — the energy lives in the voice and the face, while the body and the staging stay calm";
    case "calm":        return "Controlled and serene — unhurried telling, soft light, a person at ease";
    case "emotional":   return "Intimate and emotionally open — honest facial reactions and a personal tone, never staged for effect";
    case "mysterious":  return "Lowered, confidential tone and moody light, as if letting the viewer in on something — tension in the voice, not in the staging";
    case "cheerful":    return "Bright, warm and easy-going — a natural smile and an upbeat telling";
    case "dramatic":
    default:            return "Quietly intense — the weight lives in the words, the face and the atmosphere; the staging stays calm and ordinary";
  }
}

/**
 * Strong, model-agnostic framing directive for a given aspect ratio. Names the
 * ratio and orientation and forbids the failure mode the user hit: the model
 * rendering a different-ratio frame and padding it with black bars.
 */
export function getAspectFramingDirective(aspect: string): string {
  const [w, h] = aspect.split(":").map(Number);
  const orientation = !w || !h || w === h ? "square" : w < h ? "vertical (portrait)" : "horizontal (landscape)";
  return (
    `Compose strictly for a ${aspect} ${orientation} frame. ` +
    "Fill the ENTIRE frame edge to edge — absolutely no black bars, no letterboxing, " +
    "no pillarboxing, no padding and no borders of any kind. The image content itself must be " +
    `natively ${aspect}.`
  );
}

export function getStoryColorInstruction(color: string, mode: StoryMode): string {
  switch (color) {
    case "warm":   return "Warm golden-hour tones";
    case "cold":   return "Cool blue tones";
    case "dark":   return "Dark noir contrast";
    case "bright": return "Bright, high-clarity lighting with strong subject separation";
    case "neon":   return "Bold, saturated neon contrast";
    case "natural":
    default:
      return mode === "reel"
        ? "High-contrast, mobile-readable colors with clear subject separation"
        : "Natural realistic colors";
  }
}

export function getReelStoryboardDirective(opts: {
  effectiveHook: string;
  /** Bleibt in der Signatur, obwohl die Bildvorgabe ihn nicht mehr unterscheidet:
   *  die Aufrufer übergeben ihn, und er beschreibt weiterhin den Textmodus. */
  voiceMode: "sprecher" | "dialog";
  enableSpeaker: boolean;
  /** Für den Skript-Block: er muss sagen können, in wie viele abgeschlossene
   *  dialogText-Zeilen der Vortrag aufgeteilt wird. */
  sceneCount: number;
  /** Mehr als eine Referenzfigur? Dann ist `over-shoulder` bei Sprech-Szenen
   *  nicht mehr verboten, sondern die vorgeschriebene Auflösung — siehe die
   *  Ein-Gesicht-Regel im Storyboard-Prompt. */
  multiCharacter?: boolean;
  /** Wie viel machen die Personen mit den Händen? Ohne Angabe „calm" = bisher. */
  actionLevel?: ActionLevel;
}): string {
  const { effectiveHook, enableSpeaker, sceneCount } = opts;
  const multiCharacter = !!opts.multiCharacter;
  const actionActive = opts.actionLevel === "active";

  // Wie das Skript vorgetragen wird. Der Unterschied Sprecher/Dialog steckt im
  // TEXT, nicht mehr im Bild — siehe Kommentar am Zweig unten.
  const deliveryLine = !enableSpeaker
    ? "- Ohne Sprechtext: Jede Szene ist ein rein visueller Beat — die keyAction allein muss die Aussage der Szene tragen."
    : // Beide Sprech-Modi bekommen dieselbe Vorgabe. Grund: Reel-Szenen mit
      // Sprechtext laufen ausnahmslos über Kling `ai-avatar` — die sichtbare
      // Person spricht dort IMMER selbst und lippensynchron, auch im
      // Sprecher-Modus. Die frühere Off-Sprecher-Fassung („Die Person spricht
      // nicht selbst") plante dafür eine zuhörende, wegblickende Person und war
      // damit die Hauptursache für Clips ohne Blick in die Linse.
      // Unangetastet bleibt, WIE der Text geschrieben wird (dialogText-Regeln) —
      // geändert ist nur, was das Bild zeigen soll.
      (actionActive
        ? '- Vortrag: Die sichtbare Person spricht den Text SELBST und DIREKT IN DIE KAMERA (Creator-Style, Blick in die Linse) und MACHT DABEI ETWAS — in jeder Szene eine sichtbare Handlung der Hände, die zum Gesagten passt. KEINE Slapstick-Einlage und keine dramatische Umsetzung des Gesagten, aber auch kein reines Dastehen.\n'
        : '- Vortrag: Die sichtbare Person spricht den Text SELBST und DIREKT IN DIE KAMERA (Creator-Style, Blick in die Linse) und ERZÄHLT ruhig — höchstens eine kleine alltägliche Geste begleitet sie, nichts Inszeniertes. KEINE dramatische Umsetzung des Gesagten.\n') +
      // Bei EINER Person bleibt der Satz Zeichen für Zeichen der alte. Bei
      // mehreren wäre „KEIN over-shoulder" das direkte Gegenteil der
      // Ein-Gesicht-Regel weiter unten — zwei Anweisungen, die sich in
      // demselben Prompt widersprechen, und das Modell entscheidet dann selbst,
      // welche gilt. Deshalb hier umschalten statt danebenstellen.
      (multiCharacter
        ? '- Kamera für Sprech-Szenen: shotType zwischen "close-up" und "medium-shot". cameraAngle "eye-level" oder "low-angle"; ist die zweite Person mit im Bild, steht zusätzlich "over-shoulder" zur Wahl. NIE bird-eye, worm-eye, long-shot oder extreme-long-shot.'
        : '- Kamera für Sprech-Szenen: Wähle nur Werte, die Blick in die Linse erlauben — cameraAngle "eye-level" oder "low-angle", shotType zwischen "close-up" und "medium-full-shot". KEIN over-shoulder, bird-eye, worm-eye, long-shot oder extreme-long-shot für die sprechende Person.\n' +
          // DER SCHNITT IST DER ZOOM. Sprech-Clips entstehen aus EINEM Standbild,
          // eine echte Kamerafahrt gibt es dort nicht. Der einzige Zoom, den das
          // Format hat, ist der Größensprung zwischen zwei Clips — und der wirkt
          // nur, wenn er groß ist. Das frühere Beispiel („extreme-close-up" →
          // „full-shot") lag AUSSERHALB des hier erlaubten Bandes und war damit
          // unbefolgbar; das Modell landete auf Nachbargrößen, die sich im Schnitt
          // wie dasselbe Bild lesen.
          '- SPRINGE ZWISCHEN DEN ENDEN DES ERLAUBTEN BANDES: Wechsle von Szene zu Szene möglichst zwischen "close-up" und "medium-shot"/"medium-full-shot" — dieser Größensprung IST der Zoom des Reels, weil ein Sprech-Clip keine Kamerafahrt kennt. Nachbargrößen hintereinander (z. B. "close-up" → "medium-close-up") sind zu wenig: Der Schnitt liest sich dann nicht als Schnitt.');

  const scriptBlock = enableSpeaker
    ? buildSpokenScriptBlock({
        sceneCount,
        deliveryLine,
        // Die frühere Erlaubnis „höchstens EINE Szene ohne Zeile" bleibt
        // gestrichen — aus einem anderen Grund als bisher: Bei ai-avatar bestimmt
        // das Audio die Cliplänge. Eine Szene ohne Zeile hat keine Tonspur, also
        // auch keine eigene Dauer, und fällt aus dem Vortrag heraus.
        everySceneRule: "- JEDE Szene braucht ihre Zeile — die Cliplänge folgt dem gesprochenen Text; eine stumme Szene hat keine Dauer und reißt ein Loch in den Vortrag.",
        actionLevel: opts.actionLevel,
      })
    : `
OHNE SPRECHTEXT:
${deliveryLine}
`;

  // Der Handlungs-Block. Er ist die Stelle, an der der Aktions-Level im
  // Erzähler-Stil wirklich entscheidet — hier steht, WIE VIEL in einer Szene
  // überhaupt passieren darf. Beide Fassungen behalten dieselben zwei
  // Emotions-Zeilen und dasselbe Stunt-Verbot; verschieden ist allein, ob die
  // Hände arbeiten oder ruhen.
  const actionBlock = actionActive
    ? `HANDFESTE HANDLUNG, GROSSE EMOTION (Pflicht für JEDE Szene):
- keyAction = eine sichtbare Handlung, die die HÄNDE ausführen — etwas hochheben, zeigen, ein Gerät bedienen, ein Werkzeug ansetzen, eine Zahl mit den Fingern zeigen. Alltäglich und glaubwürdig, aber nie „steht da und redet".
- Beispiel: Aussage „KI ist kaputt" → die Person klappt den Laptop auf, dreht ihn mit beiden Händen zur Kamera und zeigt mit dem Zeigefinger auf den Bildschirmrand.
- "emotion" ist NIE „neutral", „ruhig", „sachlich" oder „konzentriert". In JEDER Szene steht dort ein starkes, im Gesicht sofort ablesbares Gefühl: Überraschung, Ungläubigkeit, Empörung, Begeisterung, Freude, Schadenfreude, Triumph, Entsetzen, Erleichterung.
- Die Emotion wechselt über das Reel hinweg spürbar — nie dreimal hintereinander dasselbe Gefühl. Der Wechsel ist Teil des Tempos.
${enableSpeaker
  ? "- Die Handlung läuft WÄHREND die Zeile gesprochen wird und unterstreicht sie — Erzählen und Machen gleichzeitig, wie jemand, der vorführt, was er wirklich kann."
  : "- Ohne Sprechtext trägt die Handlung die Szene allein — dann muss sie umso deutlicher sichtbar sein, und das Gesicht zeigt unmissverständlich, was gerade gefühlt wird."}
- Keine Stunts, nichts Absurdes, nichts Gefährliches: die Handlung bleibt etwas, das man beim Reden tatsächlich tut. GROSS ist sie in der Sichtbarkeit, nicht in der Übertreibung.`
    : `RUHIGE HANDLUNG, GROSSE EMOTION (Pflicht für JEDE Szene):
- keyAction = eine kleine, alltägliche Handlung — KEIN Gag, KEIN Stunt, KEINE Slapstick-Aktion. Die Person sitzt, steht oder geht einer einfachen Tätigkeit nach.
- Beispiel: Aussage „KI ist kaputt" → die Person lehnt sich vor, tippt zweimal auf den zugeklappten Laptop und schaut mit hochgezogenen Augenbrauen wieder in die Kamera.
- "emotion" ist NIE „neutral", „ruhig", „sachlich" oder „konzentriert". In JEDER Szene steht dort ein starkes, im Gesicht sofort ablesbares Gefühl: Überraschung, Ungläubigkeit, Empörung, Begeisterung, Freude, Schadenfreude, Triumph, Entsetzen, Erleichterung.
- Die Emotion wechselt über das Reel hinweg spürbar — nie dreimal hintereinander dasselbe Gefühl. Der Wechsel ist Teil des Tempos.
${enableSpeaker
  ? "- Die Handlung passiert beiläufig WÄHREND die Zeile gesprochen wird — sie unterstreicht das Gesagte, ohne davon abzulenken. Das Erzählen trägt die Szene, das Gesicht trägt das Gefühl."
  : "- Ohne Sprechtext trägt die Handlung die Szene allein — sie bleibt alltäglich, aber das Gesicht zeigt in jeder Szene unmissverständlich, was gerade gefühlt wird."}
- Keine krassen Aktionen, keine Stunts, nichts Absurdes oder Überzogenes. Alltäglich und glaubwürdig bleibt die HANDLUNG — der AUSDRUCK darf und soll groß sein.`;

  return `
REEL-MODUS — ERZÄHL-FORMAT (höchste Priorität):
Du erstellst KEINE Kurzgeschichte und KEIN Mini-Drama, sondern ein Erzähl-Reel im Creator-Stil (TikTok, Instagram Reels, YouTube Shorts):
${enableSpeaker
  ? (actionActive
      ? "Eine Botschaft wird GESPROCHEN vermittelt — die ERZÄHLUNG trägt das Reel. Das Bild zeigt dazu jemanden, der SICHTBAR ETWAS TUT: eine präsente, mitfühlende Person, die in jeder Szene mit den Händen hantiert, zeigt oder etwas hochhält, KEINE Inszenierung und keine Stunts."
      : "Eine Botschaft wird GESPROCHEN vermittelt — die ERZÄHLUNG trägt das Reel. Das Bild begleitet: eine PRÄSENTE, sichtbar mitfühlende Person, kleine alltägliche Handlungen, KEINE Inszenierung.")
  : (actionActive
      ? "Eine Botschaft wird über alltägliche Bilder vermittelt — eine präsente Person, die in jeder Szene sichtbar mit den Händen etwas tut, mit klar ablesbarer Emotion, KEINE Inszenierung."
      : "Eine Botschaft wird über alltägliche Bilder vermittelt — eine präsente Person in einfachen, verständlichen Handlungen mit klar ablesbarer Emotion, KEINE Inszenierung.")}
Jede Szene wird zu einem Videoclip von HÖCHSTENS 8 Sekunden — die Cliplänge folgt dem gesprochenen Text und darf pro Szene verschieden sein. Die Gesamtdauer des Reels ist also bis zu Szenenanzahl × 8 Sekunden.
${scriptBlock}
${actionBlock}

HARTE SCHNITTE — PFLICHT, KEINE ÜBERGÄNGE:
- Das Reel wird AUSSCHLIESSLICH mit harten Schnitten montiert. Kein Morph, kein Fade, kein Dissolve, keine Anschlussbewegung, kein fließender Übergang — nie.
- Jeder Schnitt muss DEUTLICH SICHTBAR sein: Der Sprung von Szene zu Szene ist gewollt und gibt dem Reel Tempo (Pattern Interrupt bei jedem Cut).
${multiCharacter
  // Bei mehreren Personen kollidiert die Winkel-Pflicht mit der Ein-Gesicht-Regel:
  // „nie zweimal derselbe Winkel" gegen „over-shoulder bleibt". Beide in
  // MUSS-Sprache, beide im selben Prompt — das Modell löst das am billigsten
  // durch Alternieren, und jede eingeschobene eye-level-Sprechszene ist genau
  // der Frame mit zwei Gesichtern, den die Regel verhindern soll. Deshalb wird
  // die Zeile hier ersetzt, nicht ergänzt: der Schnitt trägt dann über die
  // Einstellungsgröße und den Seitenwechsel.
  ? '- Aufeinanderfolgende Szenen MÜSSEN sich drastisch im shotType unterscheiden (bei Sprech-Szenen innerhalb des erlaubten Bandes, also "close-up" → "medium-shot" oder "medium-full-shot"). Der cameraAngle darf über mehrere Sprech-Szenen hinweg "over-shoulder" BLEIBEN — bei zwei Anwesenden ist das keine Wiederholung, sondern Schuss und Gegenschuss: den Schnitt trägt dort der Seitenwechsel (die Kamera springt hinter die andere Schulter) zusammen mit der neuen Einstellungsgröße. Nur solange ausschließlich der Sprecher im Bild ist, gilt zusätzlich: nie zweimal hintereinander derselbe Winkel.'
  : '- Aufeinanderfolgende Szenen MÜSSEN sich in shotType UND cameraAngle unterscheiden — und zwar drastisch (bei Sprech-Szenen innerhalb des erlaubten Bandes, also "close-up" → "medium-shot" oder "medium-full-shot"; beim Winkel "eye-level" → "low-angle"). Nie zweimal hintereinander dieselbe Einstellungsgröße oder denselben Winkel.'}
- Auch specificArea, Körperposition und Haltung der Person sollen sich pro Szene klar ändern, damit der Schnitt sofort als Schnitt gelesen wird. (NICHT die Blickrichtung — die bleibt bei Sprech-Szenen in der Kamera.)
- Trotzdem EIN Look über das ganze Reel: gleicher Hauptort, gleiche Personen, gleiches Outfit, gleiche Lichtstimmung.

DER HOOK — SZENE 1 ENTSCHEIDET, OB DAS REEL ÜBERHAUPT GESEHEN WIRD:
- "${effectiveHook}"
${actionActive
  ? `- Szene 1 muss in der ersten Sekunde sitzen: die steilste AUSSAGE zuerst. Kein Aufbau, kein Intro, keine Begrüßung wie „Hallo Leute".
- Ist der Hook oben ein fertiger SATZ, ist er wortgleich (höchstens minimal angepasst) der dialogText von Szene 1. Ist er eine Regieanweisung, formuliere danach den steilsten Satz, den diese Story hergibt.
- Szene 1 wird mit voller Energie in die Kamera gesagt: "emotion" ist dort ein starkes Gefühl (Empörung, Ungläubigkeit, Begeisterung, Triumph), niemals „neutral" oder „ruhig", und "audienceEffect" ist "spannung", "neugier" oder "freude".`
  : `- Szene 1 muss in der ersten Sekunde KONKRET sein — nicht laut. Kein Aufbau, kein Intro, keine Begrüßung wie „Hallo Leute", aber auch kein Ausruf und kein Vorwurf.
- Ist der Hook oben ein fertiger SATZ, ist er wortgleich (höchstens minimal angepasst) der dialogText von Szene 1. Ist er eine Regieanweisung, formuliere danach den konkretesten Satz, den diese Story hergibt.
- SOLLTE DER HOOK OBEN LAUT FORMULIERT SEIN (Wörter in Großbuchstaben, Ausrufezeichen, Vorwurf wie „DEINE Schuld"), dann nimm ihn NICHT wörtlich: Er stammt aus dem lauten Modus. Übernimm seine AUSSAGE und schreibe sie ruhig und normal aus — das ist die einzige Stelle, an der du den Hook umformulieren darfst.
- Szene 1 wird ruhig gesagt: "emotion" ist ein leises, aber lesbares Gefühl (Interesse, Nachdenklichkeit, leichte Überraschung, Zuversicht), niemals „neutral" oder „ausdruckslos", und "audienceEffect" ist "neugier" oder "spannung".`}

REEL-VISUELLE REGELN:
- Genau EIN dominanter Fokus pro Szene: eine Person, eine Aktion, ein sichtbarer Moment. Keine geteilte Aufmerksamkeit. Die ZEILE dieser Szene trägt genau diesen einen Gedanken zu Ende: Sie endet an einem echten Satzzeichen — Punkt, Frage- oder Ausrufezeichen, oder Komma, wenn der nächste Clip den Gedanken weiterführt. Nie mitten in einem angefangenen Wortverbund.
- Handy-lesbar: Die Szene muss auch auf einem kleinen Smartphone-Screen sofort klar sein.
- Keine Filler-Shots, keine neutralen Establishing Shots, keine Szene ohne Aussage.
- 9:16-Komposition: Gesichter, Hände und Kernaktion müssen in der vertikalen Safe Zone klar sichtbar bleiben.
`;
}

/**
 * Storyboard-Direktive für das VLOG-Reel — das Gegenstück zu
 * `getReelStoryboardDirective`. Statt „jede Szene ein neuer, überzogener
 * Bild-Gag" gilt hier: EINE Person, EINE Tätigkeit, EIN Ort, EIN Kameraaufbau
 * über das ganze Reel; die Schnitte entfernen nur ZEIT (Jump Cuts).
 *
 * Wichtig für die Formulierung: reine Verbotslisten („kein Fade") haben in der
 * Praxis nicht gereicht — das Modell hat trotzdem Übergänge gebaut. Deshalb ist
 * der Block POSITIV formuliert: er beschreibt zuerst, WAS zu sehen ist
 * (derselbe Raum, dieselbe Kameraposition, die Person steht nur woanders, weil
 * Zeit herausgeschnitten wurde) und nennt das Konzept beim Namen („Jump Cut",
 * „der Cutter hat die langweiligen Teile herausgeschnitten"). Die Verbote
 * stehen danach — als Absicherung, nicht als Hauptbotschaft.
 */
export function getVlogReelDirective(opts: {
  effectiveHook: string;
  voiceMode: "sprecher" | "dialog";
  enableSpeaker: boolean;
  reelOutro: boolean;
  sceneCount: number;
  /** Wie viel machen die Personen mit den Händen? Ohne Angabe „calm" = bisher. */
  actionLevel?: ActionLevel;
}): string {
  const { effectiveHook, voiceMode, enableSpeaker, reelOutro, sceneCount } = opts;
  const actionActive = opts.actionLevel === "active";

  // Das Outro ist erst ab 3 Szenen sinnvoll — bei 2 Szenen wäre die Hälfte des
  // Reels der „Ausbruch" und die durchgehende Situation gäbe es nicht mehr.
  const outroActive = reelOutro && sceneCount >= 3;

  // Im Vlog spricht IMMER die sichtbare Person selbst in die Linse — auch im
  // Sprecher-Modus, denn genau das ist das Format. voiceMode steuert nur noch,
  // ob die Zeile ein Sprecher-Präfix ("Name: …") bekommt.
  const deliveryLine = !enableSpeaker
    ? "- Ohne Sprechtext: Jede Szene zeigt nur die laufende Tätigkeit weiter — keyAction trägt die Szene allein. Trotzdem gilt: gleiche Situation, gleicher Kameraaufbau, nur Zeitsprünge."
    : voiceMode === "dialog"
      ? "- Vortrag: Die sichtbare Person spricht ihre Zeile DIREKT IN DIE LINSE, während sie ihre Tätigkeit weiter ausführt. Sie redet nebenher — locker, wie jemand, der beim Machen erzählt, aber mit Energie und sichtbarem Gefühl im Gesicht, nie heruntergeleiert." +
        (actionActive ? " Sie hört dabei NICHT auf zu arbeiten: in jeder Szene sind die Hände sichtbar an der Tätigkeit." : "")
      : "- Vortrag: Die sichtbare Person spricht den Text SELBST und DIREKT IN DIE LINSE, während sie ihre Tätigkeit weiter ausführt. Es gibt keinen Off-Sprecher — im Vlog-Format ist die Person im Bild die Stimme. Sie erzählt mit Energie und sichtbarem Gefühl, nie monoton." +
        (actionActive ? " Sie hört dabei NICHT auf zu arbeiten: in jeder Szene sind die Hände sichtbar an der Tätigkeit." : "");

  // BUGFIX: Dieser Block wurde gebaut und dann NIE in den Prompt eingesetzt —
  // im Vlog-Stil (dem Standard für neue Projekte) fehlten dem Modell damit die
  // gesamte Skript-Anweisung samt Hook-Zeile, Zeilenende-Regeln, Wortbudget und
  // Beispiel, und auch `deliveryLine` (WIE vorgetragen wird) erreichte es nicht.
  // Der Explainer-Pfad setzt denselben Block seit jeher ein; nur hier fehlte das
  // `${"$"}{scriptBlock}` in der Vorlage.
  const scriptBlock = enableSpeaker
    ? buildSpokenScriptBlock({
        sceneCount,
        deliveryLine,
        everySceneRule: "- JEDE Szene braucht ihre Zeile — im Vlog redet die Person durchgehend; eine stumme Szene lässt sie mitten im Vortrag ohne Grund verstummen.",
        actionLevel: opts.actionLevel,
      })
    : `
OHNE SPRECHTEXT:
${deliveryLine}
`;

  const deliveryEnum = VOICE_DELIVERIES.map((d) => `"${d.value}"`).join(" | ");

  return `
REEL-MODUS — VLOG-FORMAT „VOR DER KAMERA" (höchste Priorität):
Du erstellst KEINE Kurzgeschichte, KEIN Mini-Drama und KEINE Kette von Bild-Gags, sondern ein Vlog-Reel im Creator-Stil (TikTok, Instagram Reels, YouTube Shorts):
EINE Person erzählt durchgehend in die Kamera, WÄHREND sie EINE gewöhnliche Tätigkeit ausführt. Das ganze Reel ist EINE einzige Aufnahme, aus der der Cutter die langweiligen Teile herausgeschnitten hat.
Jede Szene wird zu einem Videoclip von HÖCHSTENS 8 Sekunden — die Cliplänge folgt dem gesprochenen Text und darf pro Szene verschieden sein. Die Gesamtdauer des Reels ist also bis zu Szenenanzahl × 8 Sekunden.
${scriptBlock}
LEGE ZUERST DIE SITUATION FEST (Top-Level-Feld "situation"):
${actionActive
  ? `- "activity": eine gewöhnliche Tätigkeit, die DIE HÄNDE BESCHÄFTIGT und die man 40+ Sekunden am Stück machen kann, während man redet — Hanteltraining, Kochen, Werkzeug sortieren, ein Regal aufbauen, Kaffee zubereiten, Pflanzen umtopfen, Wäsche falten.
  Sie muss Gegenstände hergeben, die man greifen, hochhalten, zeigen und weglegen kann. KEINE Stunts, KEINE Gags, nichts Gefährliches — aber auch nichts, wobei man nur dasitzt oder dasteht.`
  : `- "activity": eine gewöhnliche, alltägliche Tätigkeit, die man 40+ Sekunden am Stück machen kann und bei der man nebenher reden kann — Hanteltraining, Spazieren, Kochen, am Schreibtisch sitzen, als Beifahrer im Auto, Wäsche falten, Pflanzen gießen.
  KEINE Stunts, KEINE Gags, KEINE übertriebenen oder spektakulären Aktionen.`}
- "setting": EIN konkreter Ort, der über das ganze Reel exakt gleich bleibt (keine Aufzählung, keine Alternativen).
- "outfit": was die Person trägt — über das ganze Reel identisch.
- "cameraSetup": wie die Kamera steht, konkret und unveränderlich (z. B. „fixed tripod, 1.5 m away").
  KEINE Angabe zur Bildmitte, zum Ausschnitt ODER zum Kamerawinkel („subject centered", „close framing", „at eye level", „high angle") — Ausschnitt und Winkel gehören zur einzelnen Szene (Felder shotType/cameraAngle), nicht zum Aufbau. Stünden sie hier, wiederholten sie sich in JEDEM Frame und frören Crop bzw. Winkel ein: eine Handlung, die die Person aus der Mitte trägt (aufstehen, weggehen), wäre nur durch Weglassen erfüllbar, und der pro Szene wechselnde Blickwinkel (die Jump Cuts!) stünde in jedem Prompt gegen einen festen Winkel aus dem Aufbau.

JEDE SZENE IST DERSELBE DREH — NUR EIN PAAR SEKUNDEN SPÄTER:
- Szene N+1 spielt in DERSELBEN Situation wie Szene N, nur etwas später. Es wirkt, als hätte der Cutter die langweiligen Sekunden dazwischen herausgeschnitten. Genau das ist ein JUMP CUT.
- "specificArea" ist in JEDER Szene WORTGLEICH IDENTISCH${outroActive ? " (einzige Ausnahme: die Outro-Szene, siehe unten)" : ""}.
- Ort, Outfit, Licht, Tageszeit und Kameraaufbau ändern sich NIE.
- Der ORT bleibt identisch — der Blickwinkel NICHT. Zwischen zwei Szenen darf die Kamera im selben Raum eine andere Position einnehmen: "cameraAngle" aus "eye-level" | "low-angle" | "high-angle", "shotType" aus "close-up" | "medium-close-up" | "medium-shot" | "medium-full-shot" | "full-shot". Wähle die Einstellungsgröße so, dass die keyAction dieser Szene komplett hineinpasst — steht die Person auf oder geht sie ein paar Schritte, braucht es "medium-full-shot" oder "full-shot".
- Zwei aufeinanderfolgende Szenen dürfen NICHT denselben Winkel UND dieselbe Einstellungsgröße haben — sonst liest sich der Schnitt nicht als Schnitt, sondern als dasselbe Bild. Mindestens eines von beiden wechselt.

DER ZUSTAND SCHREITET FORT — JEDE SZENE ZEIGT DAS ERGEBNIS DER VORIGEN:
- Szene N+1 zeigt die Lage, NACHDEM die Aktion aus Szene N passiert ist. Steht in Szene N „er steht auf", dann STEHT er in Szene N+1 bereits — er steht nicht noch einmal auf und sitzt auch nicht wieder.
- Genauso bei Gegenständen: „schält die Orange" in Szene N heißt in Szene N+1, dass sie geschält ist. „Nimmt das Handy" heißt, dass er es danach in der Hand hat.
- Jede Szene braucht deshalb einen erkennbar ANDEREN Moment: andere Körperhaltung, anderer Stand der Tätigkeit, andere Position im Raum. Zwei Szenen, die denselben Moment zeigen, sind ein Fehler.
- Die "keyAction" beschreibt, was in DIESER Szene sichtbar passiert — nicht die Dauer-Tätigkeit aus "situation". Die Situation ist nur der Rahmen.
- "keyAction" = was die Person in DIESER Szene sichtbar tut. Meist ist das der nächste Handgriff der laufenden Tätigkeit — es darf aber ausdrücklich etwas anderes sein (zum Handy greifen, aufstehen, zum Kühlschrank gehen), solange es im selben Raum bleibt und alltäglich ist. KEIN Gag, KEIN Stunt. Schreibe die keyAction so konkret, dass ein Bildmodell sie ohne die Szenenbeschreibung umsetzen könnte: wer, was mit den Händen.${actionActive
  ? `
- IN JEDER SZENE ARBEITEN DIE HÄNDE SICHTBAR. Eine Szene, in der die Person nur dasteht bzw. dasitzt und redet, ist ein Fehler: Sie greift, hebt, hält hoch, dreht, legt weg, zeigt darauf. Der Gegenstand ist dabei wirklich in der Hand und im Bild zu sehen, der Ellbogen weg vom Körper — angedeutete Bewegungen kommen im Standbild nicht an. Nie zwei Szenen hintereinander mit demselben Handgriff.`
  : ""}
- BLICK: Hat die Szene einen dialogText, ENDET die keyAction immer mit dem Blick in die Kamera. Die Handlung darf den Blick unterwegs wegführen — beschrieben wird der Zustand DANACH. Muster: „greift zum Handy, tippt einmal und schaut wieder in die Kamera", „steht auf, macht zwei Schritte zum Kühlschrank und dreht sich dabei wieder zur Kamera". Ganzkörper-Handlungen (aufstehen, gehen, sich bücken, etwas holen) bleiben ausdrücklich erwünscht — sie werden nur so formuliert, dass das Gesicht am Ende wieder zur Kamera zeigt.
- Solange die Szene einen dialogText hat, blickt die Person im Regelfall in die Kamera; die keyAction dreht das Gesicht höchstens ins Halbprofil — es muss ein Mundbild geben, auf das der Lipsync gelegt werden kann. Vollständiges Abwenden nur in Szenen ohne dialogText.
- "continuityNotes" nennt für JEDE Szene: das Outfit (wortgleich), den Kameraaufbau und den ZUSTAND der Requisiten am Ende dieser Szene (z. B. „Orange halb geschält, Schalen auf der Serviette"). Der nächste Frame baut genau darauf auf. continuityNotes beschreibt NUR Zustände (Kleidung, Requisiten, wo etwas liegt) — nie eine Handlung und nie eine Tätigkeit in der Verlaufsform.

REQUISITEN MÜSSEN LOGISCH ENTSTEHEN:
- Ein Gegenstand darf NIE aus dem Nichts auftauchen. Was in Szene N in der Hand ist, muss in Szene N−1 bereits sichtbar dagelegen haben oder in Szene N−1 gegriffen worden sein.
- Lege deshalb schon in Szene 1 fest, welche Gegenstände zur Tätigkeit gehören, und lasse sie über die Szenen nur ihren ZUSTAND ändern — nie ihre Existenz. Eine ganze Orange wird halb geschält, dann geschält, dann gegessen; sie erscheint nicht plötzlich.
- Ein Zustand geht immer VORWÄRTS: Was benutzt, geöffnet, geschnitten oder verbraucht ist, wird in einer späteren Szene nie wieder unberührt.

ES GIBT KEINE ÜBERGÄNGE — NUR HARTE ZEITSPRÜNGE:
- Zwischen zwei Szenen liegt ein harter Schnitt, der ZEIT entfernt, nicht Ort. Der Raum, das Outfit und das Licht sind davor und danach identisch — nur die Person steht anders da, und der Blickwinkel darf pro Szene wechseln (siehe oben: cameraAngle/shotType).
- Kein Fade, kein Dissolve, kein Morph, kein Whip-Pan, kein Wisch, keine Anschlussbewegung, keine „fließende" Verbindung zweier Szenen.
- Eine Szene endet NIE mit einer Geste, die in die nächste hineinführt.
- Eine Szene beginnt NIE damit, eine Bewegung der vorigen fortzusetzen.
- Der BILDschnitt ist hart und steht für sich: sofort mitten in der Tätigkeit anfangen, mitten in der Tätigkeit aufhören. Der gesprochene Satz macht das NICHT mit — er ist am Ende des Clips fertig gesprochen. Die Zeile endet an einem echten Satzzeichen: mit Punkt, Frage- oder Ausrufezeichen, oder mit Komma, wenn der Gedanke in der nächsten Szene weiterläuft. Das Bild bricht ab, die Stimme nicht.

STIMMLAGE PRO SZENE (Feld "voiceDelivery"):
- Wähle pro Szene GENAU EINEN dieser Werte — nichts anderes, keine eigenen Erfindungen: ${deliveryEnum}
${actionActive
  ? `- Der Wert muss zur gezeigten Tätigkeit UND zum Inhalt der Zeile passen: Krafttraining → "breathless" oder "energetic", Pointe → "amused", Warnung oder Dringlichkeit → "urgent", eine Enthüllung → "energetic", eine nüchterne Feststellung → "serious".
- SZENE 1 (Hook) ist IMMER "energetic" oder "urgent" — nie "neutral" und nie "calm". Der Hook wird mit voller Stimme in die Linse gesagt, sonst hört ihn niemand zu Ende.
- MEHRHEITSREGEL: Mindestens die HÄLFTE aller Szenen trägt einen energiereichen Wert ("energetic", "urgent", "amused" oder "breathless"). Die leisen Werte ("neutral", "calm", "serious") sind zusammen auf höchstens ein Drittel der Szenen begrenzt und stehen nie zweimal hintereinander — sie sind der Kontrast, nicht die Grundstimmung. Ein Reel, das durchgehend gleich klingt, wird weggescrollt.`
  // RUHIGER MODUS: dieselbe Auswahl, andere Mitte. „urgent" ist hier gar keine
  // Option mehr — es ist die Stimmlage, die den gemeldeten Vorwurfs-Ton hörbar
  // macht. Die Spanne bleibt trotzdem gefordert: eine durchgehend gleiche
  // Stimmlage klingt abgelesen, und genau das war 2026-08-13 die Beschwerde.
  : `- Der Wert muss zum Inhalt der Zeile passen — so, wie jemand im Gespräch die Stimme führt: eine ruhige Feststellung → "calm", etwas Wichtiges oder Nachdenkliches → "serious", etwas Anvertrautes → "confidential", eine kleine Pointe oder Selbstironie → "amused", Anstrengung bei körperlicher Tätigkeit → "breathless".
- "urgent" ist in diesem Modus VERBOTEN — es ist das schnellste und unruhigste Profil des Katalogs und klingt nach Alarm und Vorwurf. Genau das soll ein normales Gespräch nicht.
- SZENE 1 ist "serious" — ersatzweise "confidential" oder "amused". NIE "urgent", NIE "energetic", NIE "neutral". Der erste Satz wird ruhig und sicher gesagt; er zieht durch das, WAS gesagt wird, nicht durch Druck in der Stimme.
- MEHRHEITSREGEL (ruhig): Mindestens die HÄLFTE aller Szenen trägt einen ruhigen Wert ("serious", "calm", "confidential"). "energetic", "amused" und "breathless" zusammen kommen in höchstens EINER Szene des ganzen Reels vor — sie sind der Kontrast, nicht die Grundstimmung.
- SPANNE TROTZDEM: Nie zweimal hintereinander dieselbe Stimmlage. Ruhig heißt nicht gleichförmig — auch ein normales Gespräch hat Hoch- und Tiefpunkte, sie sind nur kleiner.`}
${actionActive
  ? `- "neutral" ist die AUSDRUCKSLOSESTE Einstellung des ganzen Systems. Wähle sie nur, wenn eine Zeile bewusst nüchtern stehen soll — nie aus Verlegenheit.`
  // Im ruhigen Modus ist "neutral" ganz raus: Es ist keine Ruhe, sondern
  // Abwesenheit — und es ist zugleich der Rückfallwert von `deliveryForScene`.
  // Erlaubte man es, wäre es die bequemste Antwort und das ganze Reel klänge
  // wie abgelesen. Genau das war der Befund vom 2026-08-13.
  : `- "neutral" ist die AUSDRUCKSLOSESTE Einstellung des ganzen Systems und in diesem Reel AUSGESCHLOSSEN. Auch ruhig gesprochen braucht jede Szene eine hörbare Färbung — nimm "serious", "calm", "confidential" oder "amused".`}

GEFÜHL IN JEDER SZENE (Feld "emotion"):
${actionActive
  ? `- Dort steht IMMER ein starkes, im Gesicht sofort ablesbares Gefühl: Überraschung, Ungläubigkeit, Empörung, Begeisterung, Freude, Triumph, Entsetzen, Erleichterung. NIE „neutral", „ruhig", „konzentriert" oder „sachlich".`
  // Auch hier bleibt „neutral" verboten: ein leeres Gesicht war der Befund vom
  // 2026-08-13 und ist in KEINEM Modus gewollt. Erlaubt sind jetzt die leiseren
  // Gefühle — lesbar, aber nicht aufgerissen.
  : `- Dort steht IMMER ein echtes, im Gesicht lesbares Gefühl — aber ein LEISES: Interesse, Nachdenklichkeit, Zuversicht, Wärme, Neugier, leichte Überraschung, Amüsiertheit, Ernst, Erleichterung. NIE „neutral", „ausdruckslos" oder „sachlich": ein leeres Gesicht ist auch im ruhigen Modus ein Fehler.
- Keine aufgerissenen Augen, kein Entsetzen, keine Empörung, kein Triumph — das ist der laute Modus. Hier reicht das, was man einem Gegenüber im Gespräch ansieht.`}
- Das Gefühl wechselt über das Reel hinweg spürbar und passt zu dem, was in dieser Zeile gesagt wird — die Emotion ist das, was der Zuschauer auf dem kleinen Display in einer halben Sekunde erkennt.
${outroActive ? `
OUTRO — NUR DIE LETZTE SZENE (Szene ${sceneCount}):
- Nur diese eine Szene darf hart in einen ANDEREN Kontext schneiden — typisch nach draußen oder auf das Ergebnis der Tätigkeit. Sie bekommt ein eigenes "specificArea".
- Gleiche Person, gleiches Outfit, gleicher Look — nur die Umgebung ist neu.
- Sie trägt die Punchline, das Fazit oder den Call-to-Action.
- Auch dieser Cut ist hart: kein Fade, kein Dissolve, kein Übergang.
` : `
KEIN OUTRO:
- Auch die letzte Szene bleibt in derselben Situation, am selben Ort, im selben Kameraaufbau. Sie trägt die Punchline, das Fazit oder den Call-to-Action allein über die Stimme.
`}
DER HOOK — SZENE 1 ENTSCHEIDET, OB DAS REEL ÜBERHAUPT GESEHEN WIRD:
- "${effectiveHook}"
- Szene 1 muss in der ersten Sekunde sitzen: steilste Aussage zuerst, das erste Wort sofort und mitten in der laufenden Tätigkeit. Kein Aufbau, kein Intro, keine Begrüßung wie „Hallo Leute".
- Ist der Hook oben ein fertiger SATZ, ist er wortgleich (höchstens minimal angepasst) der dialogText von Szene 1. Ist er eine Regieanweisung, formuliere danach den steilsten Satz, den diese Story hergibt.
- Die Tätigkeit läuft dabei ganz normal weiter — die Wucht steckt im SATZ, in der Stimme und im Gesicht, nicht in einer Aktion.

VLOG-VISUELLE REGELN:
- Genau EIN dominanter Fokus pro Szene: die sprechende Person und das, was sie in dieser Szene tut. Keine zweite Handlung im Hintergrund.
- Handy-lesbar: Gesicht groß, mittig und klar erkennbar, auch auf einem kleinen Smartphone-Screen.
- Keine Filler-Shots, keine Establishing Shots, keine Detailaufnahmen ohne Person, keine B-Roll.
- 9:16-Komposition: Gesicht, Hände und die Tätigkeit müssen in der vertikalen Safe Zone klar sichtbar bleiben.
`;
}

// === UI-OPTIONS ===

export const STORY_ART_STYLES = [
  { value: "realistic",    label: "Realistisch",    english: "photorealistic, natural lighting, true-to-life" },
  { value: "cinematic",    label: "Cinematic",      english: "cinematic film look, dramatic lighting, shallow depth of field, anamorphic lens flare" },
  { value: "anime",        label: "Anime",          english: "FULLY drawn 2D anime / manga illustration — clean bold cel ink linework, flat cel-shaded colour blocks with hard-edged shadows, large expressive stylised anime eyes, simplified non-photographic skin, distinct stylised hair, vibrant saturated palette, authentic Japanese animation look. Hand-drawn anime art, NOT a photograph" },
  { value: "comic",        label: "Comic",          english: "FULLY drawn Western comic-book illustration — thick black ink outlines, bold flat cel shading, halftone / Ben-Day dot texture, high-contrast dramatic colours, dynamic graphic-novel rendering. Inked comic artwork, NOT a photograph" },
  { value: "illustration", label: "Illustration",   english: "FULLY drawn digital illustration — painterly stylised rendering, visible brushwork, artistic non-photographic look. A drawing, NOT a photograph" },
  { value: "watercolor",   label: "Aquarell",       english: "watercolor painting, soft washes, bleeding colors, paper texture, hand-painted look, NOT a photograph" },
  { value: "3d-render",    label: "3D Render",      english: "FULLY re-rendered stylised 3D CGI character in modern Pixar / 3D-animation style — smooth subsurface-scattering skin, soft rounded slightly-exaggerated features, large expressive eyes, glossy stylised hair, cinematic volumetric lighting, polished animated-movie render. A 3D render, NOT a photograph" },
  { value: "noir",         label: "Film Noir",      english: "film noir, high contrast black and white, dramatic shadows, moody atmosphere" },
];

/** Styles that must override a photo reference's realism (vs. photographic styles). */
const STYLIZED_ART_STYLES = new Set(["anime", "comic", "illustration", "watercolor", "3d-render"]);

export function isStylizedArtStyle(artStyle: string): boolean {
  return STYLIZED_ART_STYLES.has(artStyle);
}

export const STORY_PACING_OPTIONS = [
  { value: "tension-arc",    label: "Spannungsbogen — Hook, Anstieg, Cliffhanger" },
  { value: "instant-action", label: "Instant Action — Hook in 0.5–1s" },
  { value: "slow-build",     label: "Slow Build → Payoff" },
  { value: "fast-cuts",      label: "Fast Cuts — Hohe Pattern-Interrupt-Frequenz" },
];

export const STORY_MOOD_OPTIONS = [
  { value: "dramatic",   label: "Dramatisch" },
  { value: "action",     label: "Action" },
  { value: "emotional",  label: "Emotional" },
  { value: "calm",       label: "Ruhig" },
  { value: "mysterious", label: "Mysteriös" },
  { value: "cheerful",   label: "Fröhlich" },
];

export const STORY_COLOR_OPTIONS = [
  { value: "natural", label: "Natürlich" },
  { value: "warm",    label: "Warm / Golden Hour" },
  { value: "cold",    label: "Kalt / Blau" },
  { value: "dark",    label: "Dunkel / Noir" },
  { value: "bright",  label: "Hell / Clean" },
  { value: "neon",    label: "Neon / Saturiert" },
];

export const STORY_LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
  { value: "nl", label: "Nederlands" },
  { value: "pl", label: "Polski" },
  { value: "tr", label: "Türkçe" },
];

export const STORY_CAMERA_ANGLES = [
  { value: "eye-level",     label: "Auf Augenhöhe" },
  { value: "low-angle",     label: "Froschperspektive (low angle)" },
  { value: "high-angle",    label: "Vogelperspektive (high angle)" },
  { value: "dutch-angle",   label: "Dutch Angle (geneigt)" },
  { value: "over-shoulder", label: "Über die Schulter" },
  { value: "bird-eye",      label: "Bird's Eye (von oben)" },
  { value: "worm-eye",      label: "Worm's Eye (von unten)" },
];

export const STORY_SHOT_TYPES = [
  { value: "extreme-close-up", label: "Extreme Close-Up" },
  { value: "close-up",         label: "Close-Up" },
  { value: "medium-close-up",  label: "Medium Close-Up" },
  { value: "medium-shot",      label: "Medium Shot" },
  { value: "medium-full-shot", label: "Medium Full Shot" },
  { value: "full-shot",        label: "Full Shot" },
  { value: "long-shot",        label: "Long Shot" },
  { value: "extreme-long-shot",label: "Extreme Long Shot" },
];

export const STORY_COMPOSITIONS = [
  { value: "zentriert",        label: "Zentriert" },
  { value: "drittel-regel",    label: "Drittel-Regel" },
  { value: "symmetrisch",      label: "Symmetrisch" },
  { value: "diagonal",         label: "Diagonal" },
  { value: "rahmen-im-rahmen", label: "Rahmen-im-Rahmen" },
];

export const STORY_MOVEMENTS = [
  { value: "keine",     label: "Keine" },
  { value: "dolly-in",  label: "Dolly-In (Kamera fährt rein)" },
  { value: "dolly-out", label: "Dolly-Out (Kamera fährt raus)" },
  { value: "truck",     label: "Truck (seitliches Fahren)" },
  { value: "tilt",      label: "Tilt (Kamera kippt)" },
  { value: "pan",       label: "Pan (Kamera schwenkt)" },
  { value: "crane",     label: "Crane (Kran-Fahrt)" },
  { value: "arc",       label: "Arc (Bogen-Fahrt)" },
];

export const STORY_AUDIENCE_EFFECTS = [
  { value: "spannung",       label: "Spannung" },
  { value: "empathie",       label: "Empathie" },
  { value: "freude",         label: "Freude" },
  { value: "unbehagen",      label: "Unbehagen" },
  { value: "neugier",        label: "Neugier" },
  { value: "erleichterung",  label: "Erleichterung" },
  { value: "trauer",         label: "Trauer" },
  { value: "hoffnung",       label: "Hoffnung" },
];

/**
 * Englische Entsprechung der `audienceEffect`-Werte.
 * `audienceEffect` ist das einzige Szenenfeld, das als deutscher Enum-Wert
 * gespeichert wird — der Bild-Prompt ist aber durchgehend englisch. Ohne diese
 * Karte stünde „INTENDED EFFECT ON THE VIEWER: unbehagen" im Prompt, und das
 * Modell rät. Unbekannte Werte (Altprojekte, freier Text) gehen unverändert
 * durch.
 */
const AUDIENCE_EFFECT_EN: Record<string, string> = {
  spannung: "tension",
  empathie: "empathy",
  freude: "joy",
  unbehagen: "unease",
  neugier: "curiosity",
  erleichterung: "relief",
  trauer: "sadness",
  hoffnung: "hope",
};

export const STORY_TRANSITIONS = [
  { value: "hard-cut",    label: "Harter Cut" },
  { value: "smooth",      label: "Smooth Transition" },
  { value: "fade",        label: "Fade" },
  { value: "dissolve",    label: "Dissolve" },
  { value: "swipe-left",  label: "Swipe Links" },
  { value: "swipe-right", label: "Swipe Rechts" },
  { value: "zoom",        label: "Zoom Übergang" },
];

/**
 * Replace placeholder tokens like "Char 1" / "Person 2" / "Figur 1" in generated
 * text with the real character name, so scene participants / dialog show
 * "Torsten" instead of "Char 1". No-op when the matching character has no real
 * name yet (still a placeholder itself).
 */
export function resolveCharacterNames(text: string, characters: { name: string }[]): string {
  if (!text) return text;
  return text.replace(/\b(?:char|person|figur|character)[\s_]?(\d+)\b/gi, (match, num) => {
    const real = characters[parseInt(num, 10) - 1]?.name?.trim();
    if (!real) return match;
    if (/^(?:char|person|figur|character)\s*\d*$/i.test(real)) return match; // still a placeholder
    return real;
  });
}

export interface StoryCharacter {
  id: string;
  name: string;
  description: string;
  gender: "male" | "female" | "neutral";
  /**
   * Was diese Person im Reel TRÄGT — vom Nutzer gewählt, nicht aus dem Foto
   * gelesen.
   *
   * Das Referenzfoto ist ein PORTRÄT: es beantwortet, wie jemand aussieht, und
   * sonst nichts. Was die Person darauf anhat, ist Zufall der Aufnahme — ein
   * Bademantel aus einem Urlaubsbild hat in einem Home-Office-Reel nichts zu
   * suchen. Vorher band der Prompt die Kleidung ans Foto; das war zwar über die
   * Szenen konsistent, aber konsistent falsch, und der Nutzer hatte keinen
   * Hebel.
   *
   * Leer = keine Vorgabe: dann wählt das Bildmodell etwas zum Ort Passendes und
   * die Szenenkette hält es über die Clips zusammen (Vorgängerbild als
   * Referenz). Gefüllt = bindend, in JEDER Szene.
   */
  outfit?: string;
  mimeType: string;
  base64: string;
}

export interface StoryScene {
  id: string;
  summary: string;
  detailedDescription: string;
  participants: string;
  specificArea: string;
  keyAction: string;
  emotion: string;
  /** Sichtbarer Zustand am ENDE der Szene, als Standbild beschrieben. Vorlage
   *  für den generierten Endframe — siehe `endImageDataUrl`. */
  endState?: string;
  /** Wie diese Szene in die nächste übergeht. "flow" = der Endframe dieser
   *  Szene IST das Startbild der nächsten (unsichtbarer Übergang), "cut" =
   *  harter Schnitt mit eigenem Startbild. Reels sind immer "cut". */
  transitionToNext?: "flow" | "cut";
  dialogText: string;
  /**
   * DIESELBE Zeile, aber so geschrieben, wie sie KLINGEN soll — die Fassung, die
   * an die Stimme geht. Angezeigt wird immer `dialogText`.
   *
   * Wozu: Die TTS-Modelle kennen kein Aussprache-Feld; der Text ist die einzige
   * Steuerung. Eine deutsche Stimme liest „Google Ads" deutsch, und amerikanische
   * Firmennamen klingen dann falsch. Lautschriftlich umgeschrieben („Guhgel
   * Ähds") trifft dieselbe Stimme die amerikanische Aussprache — nur darf genau
   * diese Schreibweise niemals auf der Szenenkarte landen.
   *
   * Leer heißt: nichts umzuschreiben, die Stimme bekommt `dialogText`. Das ist
   * auch der Zustand aller Storyboards, die vor diesem Feld entstanden sind.
   */
  dialogSpeech?: string;
  /**
   * WER in dieser Szene spricht — ein exakter Charaktername, oder leer.
   *
   * Vorher wurde der Sprecher aus dem `"Name: Satz"`-Präfix des `dialogText`
   * rekonstruiert, und das auch nur im Dialog-Modus. Im Reel-Standard
   * (voiceMode „sprecher") war damit an KEINER Stelle festgehalten, wer von
   * mehreren Personen redet — obwohl dort jede Sprechszene über `ai-avatar`
   * läuft, wo allein das Bild entscheidet, welches Gesicht die Lippen bewegt.
   * Als eigenes, EINMAL validiertes Feld gilt dieselbe Zuordnung überall:
   * Bild-Prompt, Video-Prompt und Stimmenwahl.
   */
  speaker?: string;
  /** Wie die Zeile vorgetragen wird — passend zur gezeigten Tätigkeit.
   *  Ein `value` aus VOICE_DELIVERIES. */
  voiceDelivery?: string;
  cameraAngle: string;
  shotType: string;
  composition: string;
  movement: string;
  audienceEffect: string;
  continuityNotes: string;
  imageStatus: "idle" | "loading" | "done" | "error";
  imageDataUrl?: string;     // in-session base64 (Veo start frame + immediate display)
  imageUrl?: string;         // durable bucket URL (persisted; survives reload)
  imageError?: string;
  imageHint?: string;
  detailedImagePrompt?: string;
  // ── Duo-Frame (OmniHuman) ─────────────────────────────────────────────────
  /** Diese Sprech-Szene zeigt BEIDE Personen im Bild. Der Clip läuft dann über
   *  fal `bytedance/omnihuman/v1.5` statt Kling `ai-avatar`: OmniHuman nimmt
   *  eine Sprecher-MASKE („Only the person in the white area of the mask will
   *  speak") — der einzige fal-Weg, bei zwei sichtbaren Gesichtern nur eines
   *  animieren zu lassen. Kling bleibt für Ein-Gesicht-Szenen.
   *
   *  ACHTUNG, invertierte Default-Semantik (seit 2026-08-08 ist Duo der
   *  STANDARD): `undefined` heißt AN, nur explizites `false` ist das Opt-out
   *  pro Szene. Deshalb NIE dieses Feld direkt lesen — immer über
   *  `sceneIsDuo` in StoryPage, das auch Charakterzahl und Sprechweg prüft. */
  duoFrame?: boolean;
  /** Auf welcher Bildseite der SPRECHER im generierten Duo-Bild steht. Wird beim
   *  Bildlauf festgeschrieben (nicht neu berechnet!): die Maske muss zu GENAU
   *  diesem Bild passen — ändert sich später die Charakter-Reihenfolge, wäre
   *  eine Neuberechnung ein stiller Seitentausch und die falsche Person
   *  spräche. Fehlt der Wert, ist das Bild kein Duo-Bild → Fehler statt raten. */
  duoSpeakerSide?: "left" | "right";
  // ── Zustandsanschluss (Vlog-Reel) ─────────────────────────────────────────
  // Der LETZTE Frame des fertigen Clips dieser Szene. Er belegt den Zustand
  // NACH der Handlung (Haltung, Position, Requisiten) und geht als
  // Kontinuitäts-REFERENZ in die Bildgenerierung der Folgeszene — nicht als
  // deren Startframe (das wäre der Seamless-Modus und würde den Schnitt
  // auflösen). Gehört IMMER zum aktuell existierenden Clip: wird der Clip neu
  // gerendert oder verworfen, muss der Frame mit weg.
  endFrameDataUrl?: string;  // in-session base64 (wird NIE persistiert — Quota)
  endFrameUrl?: string;      // durable Bucket-URL (überlebt den Reload)
  // ── Frame-Kette (generierter Start- + Endframe) ───────────────────────────
  // Anders als `endFrameDataUrl` oben wird dieser Frame GENERIERT, nicht aus
  // einem fertigen Clip extrahiert — er existiert also, BEVOR das Video läuft.
  // Genau das macht die Vorschau vollständig und erlaubt es, alle Clips
  // parallel zu rendern: Veo bekommt Start (`imageDataUrl`) und Ende
  // (`endImageDataUrl`) vorgegeben und muss auf nichts warten.
  endImageStatus?: "idle" | "loading" | "done" | "error";
  endImageDataUrl?: string;  // in-session base64
  endImageUrl?: string;      // durable Bucket-URL
  endImageError?: string;
  // Video pipeline (optional, FULL plan only)
  videoStatus?: "idle" | "loading" | "done" | "error";
  videoUrl?: string;
  /** Auftrags-Handle beim Anbieter. Selbsttragend (`fal:modell|id` bzw.
   *  `google:operation`) — damit laesst sich ein Lauf nach einem Reload
   *  weiterverfolgen, statt ihn neu (und noch einmal bezahlt) zu starten. */
  videoJobId?: string;
  /** Wann DIESER Versuch gestartet wurde. Grenze fuer die automatische
   *  Wiederaufnahme: uralte Handles nicht ungefragt abholen. */
  videoJobStartedAt?: number;
  /** Nacharbeit-Flags, die der Poll braucht — sie stecken sonst nur in der
   *  Closure des Laufs und waeren nach einem Reload verloren. */
  videoJobNormalize916?: boolean;
  videoJobTrimTail?: boolean;
  /** Welche Strecke lief: der sprechende Avatar traegt die Stimme im Clip,
   *  die klassische Kette wird danach vertont. Entscheidet die Nacharbeit. */
  videoJobKind?: "veo" | "avatar";
  videoProgressPct?: number;
  /**
   * WELCHER Schritt der Video-Erzeugung gerade läuft.
   *
   * Vorher stand auf der Karte pauschal „Clip wird abgeholt", egal ob gerade die
   * Stimme entsteht, hochgeladen wird oder Kling rendert — und der Balken kam
   * aus einem Tick-Zähler, der bei 95 % einfror. Beides sagte nichts.
   *
   * Die Phase kennt nur der Ablauf in StoryPage, also setzt er sie dort, wo der
   * Schritt tatsächlich beginnt. Rein anzeigend: geht sie verloren (Reload),
   * fällt die Leiste auf ihren Kriech-Verlauf zurück.
   */
  videoPhase?: "voice" | "upload" | "queue" | "render" | "fetch" | "post" | "store";
  videoError?: string;
  /**
   * Der umsetzbare RAT zum Videofehler — „Startbild anpassen", „fal.ai-Key
   * prüfen", „Ergebnis erneut abholen".
   *
   * Das Feld fehlte in diesem Typ, obwohl StoryPage es seit jeher schreibt
   * (deshalb das `as any` an der Fehlerstelle) — und weil es hier nicht stand,
   * kam auch nie jemand auf die Idee, es anzuzeigen. Das Gegenstück beim Bild
   * heißt `imageHint` und steht seit jeher auf der Karte.
   */
  videoHint?: string;
  videoPrompt?: string;
  /** Gerenderte Cliplänge in Sekunden (6 oder 8) — kurze Sprechzeilen bekommen
   *  einen 6s-Clip statt 8s, damit am Ende keine Stille steht. Die Vertonung
   *  braucht den Wert für die Truncation-Prüfung. */
  videoDurationSec?: number;
  // Voice-Lock (feste Sprecherstimme über alle Clips). `videoUrl` bleibt bewusst
  // der ROHE Veo-Clip — damit lässt sich neu vertonen, ohne neu zu rendern.
  audioStatus?: "idle" | "loading" | "done" | "error";
  audioUrl?: string;            // durable TTS-Spur
  audioDurationSec?: number;
  dubbedVideoUrl?: string;      // finaler Clip mit fester Stimme
  /**
   * Die Stimme steckt IM `videoUrl` (sprechender Avatar, Kling `ai-avatar`) —
   * es gibt dann bewusst KEIN `dubbedVideoUrl`, weil nichts nachträglich
   * daraufgelegt wurde.
   *
   * Muss aufgezeichnet und nicht abgeleitet werden: ob ein Clip seine Stimme
   * eingebacken hat, entscheidet der Lauf, der ihn erzeugt hat — nicht die
   * Einstellungen von jetzt. Sonst gälte nach einem Moduswechsel ein alter,
   * klassisch gerenderter Clip plötzlich als vertont (oder umgekehrt).
   */
  voiceBakedIn?: boolean;
  voiceError?: string;
}

/**
 * Wie viele Zeilen enden NICHT an einem echten Satzzeichen?
 *
 * Messgröße hinter der Regel „eine Voiceline geht nicht in den nächsten Clip
 * über": Pro Szene läuft ein eigener TTS-Lauf, und das Zeilenende ist das
 * einzige Signal, aus dem die Stimme ihre Schlusskadenz ableitet. Punkt/Frage-/
 * Ausrufezeichen → fallendes Ausklingen, der Gedanke ist fertig. Komma →
 * schwebende Intonation, der Gedanke läuft im nächsten Clip weiter. Endet die
 * Zeile auf gar nichts (blankes „und", „weil", ein Artikel), rät das Modell —
 * genau das findet dieser Report.
 *
 * Auslassungspunkte zählen bewusst NICHT als Abschluss: sie erzeugen das
 * Verhallen in den nächsten Clip hinein, das hier gerade abgeschafft wird.
 *
 * Bewusst NUR Interpunktion: eine Großschreibungsprüfung wäre für Deutsch falsch
 * (Substantive) und für andere Sprachen bedeutungslos.
 */
const TERMINAL_END = /[.!?。！？]+["'»”』)]*\s*$/;
const COMMA_END = /[,،、，]["'»”』)]*\s*$/;
const TRAILING_OFF = /(\.\.\.|…)["'»”』)]*\s*$/;

export function scriptSeamReport(scenes: StoryScene[]): {
  lines: number;
  dangling: number;
  commas: number;
  commaLast: boolean;
  offenders: number[];
} {
  const lines = scenes.map((s) => splitDialogLine(s.dialogText || "").line.trim());
  const offenders: number[] = [];
  let commas = 0;
  // Über ALLE Zeilen: die letzte hat keine Sonderrolle mehr — auch sie endet
  // ganz normal an einem Satzzeichen (und zwar terminal, siehe commaLast).
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    if (TRAILING_OFF.test(l)) { offenders.push(i); continue; }
    if (COMMA_END.test(l)) { commas++; continue; }
    if (!TERMINAL_END.test(l)) offenders.push(i);
  }
  // Letzte NICHT-LEERE Zeile: eine stumme Schlussszene darf die Prüfung nicht verdecken.
  const last = [...lines].reverse().find(Boolean) || "";
  return {
    lines: lines.filter(Boolean).length,
    dangling: offenders.length,
    // Der 50-%-Deckel aus dem Prompt ist sonst unprüfbar: baut das Modell den
    // alten Satzbogen mit lauter Kommas nach, ist `dangling` sauber 0 und die
    // Regel trotzdem umgangen.
    commas,
    commaLast: !!last && COMMA_END.test(last),
    offenders,
  };
}

/** Der Clip, der wirklich ausgespielt wird: der vertonte, sonst der rohe.
 *  Beim sprechenden Avatar ist der rohe Clip bereits der vertonte — siehe
 *  `voiceBakedIn`. */
export function sceneFinalVideo(scene: StoryScene): string | undefined {
  return scene.dubbedVideoUrl || scene.videoUrl;
}

/**
 * Erzwingt sichtbar harte Schnitte im Reel: Zwei aufeinanderfolgende Szenen
 * dürfen weder dieselbe Einstellungsgröße noch denselben Kamerawinkel haben —
 * sonst liest sich der Schnitt als Jump Cut statt als bewusster Wechsel.
 *
 * Das Storyboard-Modell bekommt die Regel bereits im Prompt; das hier ist die
 * deterministische Absicherung, wenn es sie ignoriert. Bei Sprech-Szenen bleibt
 * die Auswahl in den Werten, die Blick in die Linse zulassen (sonst würde eine
 * erzwungene Variation den Talking-Head kaputt machen).
 */
/**
 * Kamerawerte, in denen ein Blick in die Linse im Standbild nicht darstellbar
 * (over-shoulder / bird-eye / worm-eye) oder das Gesicht nicht mehr lesbar ist
 * (long-shot / extreme-long-shot), bzw. die die Kamera von der Achse nehmen.
 *
 * BEWUSST eine Blacklist, keine Whitelist: `dutch-angle`, `high-angle`,
 * `medium-full-shot` und `full-shot` bleiben erlaubt. Eine Whitelist ließe nur
 * eine Handvoll Frames übrig — genau die Überklemmung, die weiter unten bei
 * `JUMP_CUT_SHOTS` schon einmal dazu geführt hat, dass Ganzkörper-Handlungen
 * nicht mehr darstellbar waren und das Modell sie weggelassen hat.
 */
const GAZE_BLOCKING_ANGLES = ["over-shoulder", "bird-eye", "worm-eye"];
const GAZE_BLOCKING_SHOTS  = ["long-shot", "extreme-long-shot"];
/** Fahrten, die im STANDBILD als seitliche/abgewandte Perspektive gelesen
 *  werden. `movement` fasst sonst kein einziger Guard an. */
const GAZE_BLOCKING_MOVES  = ["truck", "pan", "crane", "arc"];

/**
 * Zieht eine Sprech-Szene auf blicktaugliche Kamerawerte.
 *
 * Wird beim BAUEN des Prompts angewendet, nicht nur einmal nach der
 * Storyboard-Generierung: `voiceMode`, `voiceLock`, `enableSpeaker` und
 * `reelStyle` sind danach noch umschaltbar, und der Detail-Dialog bietet
 * weiterhin alle Werte zur Auswahl an. Die Storyboard-Guards sind damit nur die
 * Vorabkorrektur — das hier ist die eigentliche Verteidigung.
 */
export function gazeSafeCamera(
  scene: StoryScene,
  opts: { peopleInFrame?: number; nearOnly?: boolean; actionLevel?: ActionLevel } = {},
): Pick<StoryScene, "cameraAngle" | "shotType" | "movement"> {
  // `over-shoulder` ist nur bei EINER Person blickfeindlich — dann gibt es keine
  // Schulter, über die die Kamera schaut, und das Modell dreht die Person weg.
  // Sobald jemand zweites im Bild ist, kehrt sich das um: Der Blick über die
  // Schulter des Zuhörers ist genau die Einstellung, in der ein Gesicht lesbar
  // bleibt und das andere zum Rücken wird. Sie hier wegzuklemmen hieße, das
  // beste Mittel gegen zwei sichtbare Gesichter selbst zu verbieten.
  const multi = (opts.peopleInFrame ?? 1) > 1;
  const blockedAngles = multi
    ? GAZE_BLOCKING_ANGLES.filter((a) => a !== "over-shoulder")
    : GAZE_BLOCKING_ANGLES;
  // `nearOnly` (Erzähl-Reel): auch medium-full/full klemmen. Am Bild belegt —
  // ein full-shot schob den Sprecher ans Raumende, und weil `ai-avatar` den
  // Clip aus genau diesem Standbild rendert, war das Gesicht im ganzen Clip
  // briefmarkengroß. Der Vlog-Pfad bleibt unangetastet (eigenes Band).
  // AKTIONS-LEVEL „active": `medium-full-shot` bleibt erlaubt. Sonst kollidiert
  // die Nähe-Klemmung mit der bestellten Handlung — eine Hantel, ein Werkzeug
  // oder ein ausgestreckter Arm passt in einen medium-shot oft nicht hinein,
  // und das Bildmodell löst den Widerspruch, indem es die HANDLUNG weglässt.
  // `full-shot` bleibt in beiden Fällen draußen: dort wird das Gesicht
  // briefmarkengroß, und `ai-avatar` rendert den Clip aus genau diesem Bild.
  const blockedShots = opts.nearOnly
    ? opts.actionLevel === "active"
      ? [...GAZE_BLOCKING_SHOTS, "full-shot"]
      : [...GAZE_BLOCKING_SHOTS, "medium-full-shot", "full-shot"]
    : GAZE_BLOCKING_SHOTS;
  return {
    cameraAngle: blockedAngles.includes(scene.cameraAngle) ? "eye-level" : scene.cameraAngle,
    shotType:    blockedShots.includes(scene.shotType)     ? "medium-shot" : scene.shotType,
    movement:    GAZE_BLOCKING_MOVES.includes(scene.movement ?? "") ? "keine" : scene.movement,
  };
}

export function enforceHardCutVariation(
  scenes: StoryScene[],
  opts: {
    voiceMode: "sprecher" | "dialog";
    enableSpeaker: boolean;
    /** Beide NEU und Pflicht: ohne sie hielt `isTalking` den halben
     *  Reel-Normalfall (Sprecher-Modus) für eine stumme Szene. */
    voiceLock: boolean;
    mode: StoryMode;
    /** Namen der Referenzfiguren — nötig, um zu erkennen, ob in einer Szene
     *  mehr als eine Person steht. Fehlt die Liste, gilt „eine Person". */
    characterNames?: string[];
    /** Wie viel machen die Personen mit den Händen? Ohne Angabe „calm" = bisher. */
    actionLevel?: ActionLevel;
  },
): StoryScene[] {
  const ALL_SHOTS = STORY_SHOT_TYPES.map((s) => s.value);
  const ALL_ANGLES = STORY_CAMERA_ANGLES.map((a) => a.value);
  // Talking-Head: Gesicht muss lesbar und frontal bleiben.
  // `medium-full-shot` und `full-shot` sind RAUS — am erzeugten Bild belegt:
  // die Variation schob den Sprecher damit ans andere Ende des Raums, das
  // Gesicht war handybreit nur noch Millimeter groß, und weil `ai-avatar` den
  // Clip allein aus diesem Standbild rendert, war auch der Clip so. Der
  // Erzähl-Fokus braucht keine Ganzkörper-Action mehr (die keyAction ist eine
  // kleine, ruhige Geste) — Nähe schlägt hier Abwechslung. `extreme-close-up`
  // fällt weiter heraus: dort fehlt der Kontext für ein brauchbares Mundbild.
  // AKTIONS-LEVEL „active": `medium-full-shot` kommt zurück ins Band. Die
  // Begründung darüber („Nähe schlägt Abwechslung") galt für die kleine, ruhige
  // Geste — eine Handlung mit einem Gegenstand braucht dagegen Bildraum, sonst
  // lässt das Modell sie weg. `full-shot` und `extreme-close-up` bleiben in
  // beiden Fällen draußen.
  const TALK_SHOTS = opts.actionLevel === "active"
    ? ["close-up", "medium-close-up", "medium-shot", "medium-full-shot"]
    : ["close-up", "medium-close-up", "medium-shot"];
  const TALK_ANGLES = ["eye-level", "low-angle"];
  /** Nur für die Schlussszene — Begründung an der Verwendungsstelle unten. */
  const CLOSING_SHOTS = ["close-up", "medium-close-up"];

  // Wähle aus dem Pool den Wert, der am weitesten vom Vorgänger entfernt ist —
  // bei Einstellungsgrößen (nach Nähe sortiert) ist das automatisch der
  // deutlichste Größensprung.
  //
  // KORREKTUR: Die frühere Halbdrehung `(i + ceil(n/2)) % n` löste genau dieses
  // Versprechen nicht ein. Bei drei Einstellungsgrößen sprang sie nur aus dem
  // ersten Element ans Ende; aus der MITTE und vom Ende ging es je einen
  // einzigen Schritt weiter (medium-close-up → close-up). Ein Schnitt zwischen
  // zwei benachbarten Größen liest sich aber nicht als Sprung, sondern als
  // dasselbe Bild — und weil Sprech-Clips keine echte Kamerafahrt können, ist
  // dieser Größensprung der einzige Zoom, den das Format hat.
  // Jetzt wird immer ein RAND des Pools gewählt: der Schnitt wechselt dadurch
  // zwischen den beiden Extremen (close-up ↔ medium-shot) und wirkt wie ein
  // Zoom. Bei zwei Werten (Winkel) ergibt dieselbe Formel sauberes Alternieren.
  const pickContrast = (pool: string[], prev: string): string => {
    const i = pool.indexOf(prev);
    if (i < 0) return pool[0];
    const last = pool.length - 1;
    return i >= last - i ? pool[0] : pool[last];
  };

  // Sequenziell gegen die BEREITS korrigierte Vorgängerszene prüfen — würde man
  // gegen das Original vergleichen, könnte eine Korrektur in Szene N zufällig auf
  // den Wert von Szene N+1 fallen und das Duplikat bliebe stehen.
  const out: StoryScene[] = [];
  // Aufeinanderfolgende Schulter-Sprechszenen — steuert den Solo-Deckel unten.
  let shoulderRun = 0;
  scenes.forEach((rawScene, i) => {
    let scene = rawScene;
    // Deckungsgleich mit `sceneUsesTalkingAvatar` in StoryPage: im Reel spricht
    // die sichtbare Person in JEDEM Sprech-Modus selbst. Die alte Fassung
    // verlangte `voiceMode === "dialog"` und ließ damit ausgerechnet den
    // Standardfall (Reel + Sprecher) ungeschützt — `pickContrast` durfte dort
    // ungebremst auf `over-shoulder` oder `extreme-long-shot` ausweichen.
    const isTalking = opts.voiceLock && opts.enableSpeaker && !!scene.dialogText?.trim()
      && (opts.voiceMode === "dialog" || opts.mode === "reel");
    // Erst klemmen, dann auf Kollision prüfen — und ausdrücklich auch bei i===0:
    // die erste Szene trägt im Reel immer den gesprochenen Hook, ist also fast nie
    // stumm. Vorher blieb genau sie ungeprüft stehen.
    // Wie viele Personen stehen in dieser Szene? Entscheidet, ob
    // `over-shoulder` ein gültiger Sprech-Winkel ist — bei zwei Personen ist er
    // sogar der gewünschte, weil er genau ein Gesicht übrig lässt.
    const nameObjs = (opts.characterNames ?? []).map((name) => ({ name }));
    let people = nameObjs.length
      ? resolveSceneCast(scene, nameObjs).framePeople.length
      : 1;
    // ZWEI-PERSONEN-DECKEL: nie mehr als zwei Zweier-Sprechszenen in Folge.
    //
    // Der Nutzerwunsch ist ein lebendiger Dialogschnitt — zweimal beide im
    // Bild, dann mal der Sprecher allein. Das Storyboard bekommt die Regel
    // bereits im Prompt; das hier ist die deterministische Absicherung, wenn es
    // sie ignoriert und beide Personen in jede Szene schreibt. Die Umsetzung
    // läuft über `participants`: nur der Sprecher bleibt drin, die andere
    // Person ist schlicht ausserhalb des Ausschnitts — die ganze Kette dahinter
    // (Anker-Auswahl, Ein-Gesicht-Block) liest dieselbe Quelle und wird
    // automatisch zur Solo-Einstellung. Eine Kamera-ERZWINGUNG gibt es nicht
    // mehr (zurückgebaut): das Modell komponiert die Zweierszene frei, nur die
    // Ein-Gesicht-Regel im Prompt bleibt.
    if (isTalking && people > 1) {
      shoulderRun += 1;
      if (shoulderRun >= 3) {
        const speaker = resolveSceneCast(scene, nameObjs).speaker;
        if (speaker) {
          scene = { ...scene, participants: speaker };
          people = 1;
          shoulderRun = 0;
        }
      }
    } else {
      shoulderRun = 0;
    }
    // `nearOnly`: dieser Guard läuft ausschliesslich für den Erzähler-Pfad
    // (der Vlog geht über `enforceVlogJumpCuts`) — Sprechszenen bleiben nah.
    let base = isTalking ? { ...scene, ...gazeSafeCamera(scene, { peopleInFrame: people, nearOnly: true, actionLevel: opts.actionLevel }) } : scene;

    /**
     * DIE SCHLUSSSZENE BLEIBT NAH.
     *
     * Der Prompt verlangt für sie „close-up" oder „medium-close-up" — das Ende
     * gehört ins Gesicht. Diese Schleife hätte das genau dann wieder aufgezogen,
     * wenn die vorletzte Szene dieselbe Größe trägt: `pickContrast` sucht den
     * WEITESTEN Wert im Pool, aus „close-up" wurde also „medium-shot". Ein Reel,
     * das im Weiten endet, sieht aus, als käme noch etwas.
     *
     * Deshalb hier ein eigener, zweielementiger Pool — Kontrast bleibt möglich
     * (close-up ↔ medium-close-up), nur eben innerhalb der Nähe. Und wie überall
     * in dieser Datei ist die Prompt-Regel die Vorabkorrektur, das hier die
     * eigentliche Verteidigung: ein vom Modell geschriebenes „medium-shot" wird
     * für die Schlussszene ebenfalls hereingeholt.
     */
    const isClosing = isTalking && opts.mode === "reel" && scenes.length > 1 && i === scenes.length - 1;
    if (isClosing && !CLOSING_SHOTS.includes(base.shotType)) {
      base = { ...base, shotType: "medium-close-up" };
    }

    if (i === 0) { out.push(base); return; }
    const prev = out[i - 1];
    const shotPool = isClosing ? CLOSING_SHOTS : isTalking ? TALK_SHOTS : ALL_SHOTS;
    const anglePool = isTalking ? TALK_ANGLES : ALL_ANGLES;

    const patch: Partial<StoryScene> = {};
    if (base.shotType === prev.shotType) patch.shotType = pickContrast(shotPool, prev.shotType);
    if (base.cameraAngle === prev.cameraAngle) {
      patch.cameraAngle = pickContrast(anglePool, prev.cameraAngle);
    }
    out.push(Object.keys(patch).length ? { ...base, ...patch } : base);
  });
  return out;
}

/** Das Talking-Head-Band des Vlog-Formats, von nah nach weit sortiert. */
// Bewusst breiter als das reine Talking-Head-Minimum: die Szenen sollen sich
// voneinander unterscheiden. `medium-full-shot` ist dabei, damit eine Szene,
// in der die Person aufsteht, auch als solche gezeigt werden kann.
//
// `full-shot` kam dazu, weil das Band sonst KEINE Einstellungsgröße enthielt,
// die eine Ganzkörperhandlung fasst (aufstehen und zwei Schritte gehen, sich
// wegdrehen und den Kühlschrank öffnen). Das Framing-Problem war damit hart in
// Daten kodiert — keine Prompt-Formulierung konnte es lösen, das Modell hat die
// Handlung stattdessen weggelassen. Blick in die Linse und ein handy-lesbares
// Gesicht sind im full-shot weiterhin möglich.
const JUMP_CUT_SHOTS = ["close-up", "medium-close-up", "medium-shot", "medium-full-shot", "full-shot"];
/** Winkel, die Blick in die Linse zulassen — high-angle inklusive, damit sich
 *  aufeinanderfolgende Szenen sichtbar unterscheiden dürfen. */
const JUMP_CUT_ANGLES = ["eye-level", "low-angle", "high-angle"];

/**
 * Das Gegenstück zu `enforceHardCutVariation` für den Vlog-Stil: dort MUSS sich
 * jede Szene vom Vorgänger unterscheiden, hier muss sie IDENTISCH bleiben. Die
 * Kamera steht fest auf ihrem Stativ, der Ort ändert sich nicht — nur die
 * Person bewegt sich, weil zwischen den Clips Zeit herausgeschnitten wurde.
 *
 * Das Storyboard-Modell bekommt die Regel bereits im Prompt; das hier ist die
 * deterministische Absicherung, wenn es sie ignoriert. Basis ist immer Szene 1
 * (auf das Talking-Head-Band geklemmt), alle weiteren Szenen werden darauf
 * gezogen. Die optionale Outro-Szene bleibt bewusst unangetastet — sie DARF in
 * einen anderen Kontext schneiden.
 */
export function enforceVlogJumpCuts(
  scenes: StoryScene[],
  opts: { reelOutro: boolean },
): StoryScene[] {
  if (scenes.length === 0) return scenes;

  const first = scenes[0];
  const baseArea = first.specificArea;

  // Outro erst ab 3 Szenen — bei 1–2 Szenen gäbe es sonst gar keine bzw. nur
  // eine Szene in der eigentlichen Situation.
  const outroIdx = opts.reelOutro && scenes.length >= 3 ? scenes.length - 1 : -1;

  // Gesperrt wird nur der ORT. Der Blickwinkel darf sich ändern — genau das
  // macht den Schnitt lesbar. Eine frühere Fassung zwang jede Szene auf den
  // Winkel von Szene 1 und die Einstellungsgröße auf ±1 Stufe: das Ergebnis
  // waren Szenen, die sich praktisch nicht unterschieden.
  const out: StoryScene[] = [];
  scenes.forEach((scene, i) => {
    // Der Outro darf den KONTEXT wechseln — das ist seine ganze Pointe — aber
    // nicht die Kamera hinter die Person stellen: auch er ist eine Sprech-Szene
    // und läuft über ai-avatar. Deshalb ausgenommen von der Orts-/Winkel-Sperre,
    // NICHT von der Blick-Klemmung. `specificArea` bleibt dabei unangetastet.
    // Die Schlussszene bleibt nah — dieselbe Begründung wie im Erzähler-Pfad
    // (`enforceHardCutVariation`): das Ende gehört ins Gesicht, eine weite
    // Einstellung liest sich wie eine Szene, die noch etwas vorhat. Gilt auch
    // für den Outro, der sonst gleich hier oben aussteigen würde.
    const isClosing = scenes.length > 1 && i === scenes.length - 1;
    const closeBand = ["close-up", "medium-close-up"];
    if (i === outroIdx) {
      const cam = gazeSafeCamera(scene);
      out.push({
        ...scene,
        ...cam,
        shotType: closeBand.includes(cam.shotType) ? cam.shotType : "medium-close-up",
      });
      return;
    }

    // Winkel und Größe müssen im Talking-Head-Band bleiben (das Gesicht muss
    // lesbar und der Blick in die Linse möglich sein), sind darin aber frei.
    const angle = JUMP_CUT_ANGLES.includes(scene.cameraAngle) ? scene.cameraAngle : "eye-level";
    const band = isClosing ? closeBand : JUMP_CUT_SHOTS;
    let shotType = band.includes(scene.shotType) ? scene.shotType : (isClosing ? "medium-close-up" : "medium-shot");

    // Zwei aufeinanderfolgende Szenen mit identischem Winkel UND identischer
    // Größe lesen sich nicht als Schnitt, sondern als Fortsetzung desselben
    // Bildes. In dem Fall die Größe um eine Stufe versetzen — bei der
    // Schlussszene innerhalb der Nähe, sonst über das ganze Band.
    const prev = out[i - 1];
    if (prev && prev.cameraAngle === angle && prev.shotType === shotType) {
      const idx = band.indexOf(shotType);
      shotType = band[(idx + 1) % band.length];
    }

    if (scene.cameraAngle === angle && scene.shotType === shotType && scene.specificArea === baseArea) {
      out.push(scene);
      return;
    }
    out.push({ ...scene, cameraAngle: angle, shotType, specificArea: baseArea });
  });
  return out;
}

export interface StoryConfig {
  mode: StoryMode;
  idea: string;
  pointCount: number;
  voiceMode: "sprecher" | "dialog";
  dialogMode: "smart" | "forced";
  generationDirection: "speaker-from-description" | "description-from-speaker";
  enableSpeaker: boolean;
  enableSceneDescription: boolean;
  speakerGender: "male" | "female" | "neutral";
  artStyle: string;
  pacing: string;
  videoMood: string;
  colorMood: string;
  hook: string;
  /**
   * Optionaler Call-to-Action. Leer = das Reel endet wie bisher mit Payoff oder
   * Fazit. Steht hier etwas, trägt ihn die LETZTE Szene als gesprochenen Satz —
   * bewusst nicht als eingeblendeter Text: im Erzähl-Reel trägt die Stimme, und
   * ein Overlay wäre das einzige Element, das die Bildsprache durchbricht.
   */
  cta: string;
  language: string;
  customDetails: string;
  // Reel-Stil. Neue Projekte starten auf "vlog"; bestehende Projekte (erkennbar
  // am bereits gespeicherten Storyboard — dasselbe Muster wie `voiceLock`)
  // bleiben auf "explainer", damit sich ihr Verhalten nicht hinter dem Rücken
  // des Nutzers ändert. Nur wirksam bei mode === "reel".
  reelStyle: ReelStyle;
  reelOutro: boolean;                        // letzte Szene darf hart in einen anderen Kontext schneiden
  /** Zwei Personen in einer Szene: reden sie zum Zuschauer oder miteinander? */
  duoStaging: DuoStaging;
  /**
   * Wie viel machen die Personen mit den Händen? "calm" (Default) ist das
   * Verhalten vor Einführung des Schalters — siehe `ActionLevel`. Der Wert
   * entscheidet SCHON HIER, im Storyboard: Bild- und Video-Prompt rendern
   * später nur, was in der `keyAction` steht.
   */
  actionLevel: ActionLevel;
  voiceLock: boolean;                        // feste Stimme statt Veo-Stimme
  voiceName: string;                         // ELEVEN_VOICES[].name
  voiceModel: "multilingual-v2" | "eleven-v3";  // v3 kann Audio-Tags, v2 kann speed/style
  voiceStability: number;                    // 0..1, default 0.5
  voiceSpeed: number;                        // 0.7..1.2, default 1
  characterVoices: Record<string, string>;   // Charaktername → Voice-Name (Dialog)
  /**
   * Die echten Namen der Referenzfiguren. Damit erkennt `splitDialogLine`, ob
   * ein `"Wort:"` am Zeilenanfang ein Sprechername ist oder Teil des Satzes —
   * ohne die Liste verlor „Merk dir: nie am Ende kaufen." seinen Anfang und
   * wurde als Figur „Merk dir" gelesen. Optional, damit ältere Aufrufer
   * unverändert weiterlaufen.
   */
  characterNames?: string[];
}

/**
 * Die auswählbaren ElevenLabs-Stimmen. Das sind EXAKT die 20 Enum-Werte, die
 * `fal-ai/elevenlabs/tts/multilingual-v2` im Feld `voice` akzeptiert — hier
 * steht ein NAME, keine voice_id. Erst weiblich, dann männlich, innerhalb der
 * Gruppe alphabetisch. (River führt ElevenLabs als neutral; wir sortieren sie
 * unter "female" ein, der Hinweis sagt es.)
 */
export const ELEVEN_VOICES: { name: string; gender: "male" | "female"; hint: string }[] = [
  { name: "Alice",     gender: "female", hint: "klar, sachlich" },
  { name: "Aria",      gender: "female", hint: "weich, erzählend" },
  { name: "Charlotte", gender: "female", hint: "warm, freundlich" },
  { name: "Jessica",   gender: "female", hint: "jung, energetisch" },
  { name: "Laura",     gender: "female", hint: "locker, nah" },
  { name: "Lily",      gender: "female", hint: "hell, lebendig" },
  { name: "Matilda",   gender: "female", hint: "ruhig, warm" },
  { name: "River",     gender: "female", hint: "neutral, ruhig" },
  { name: "Sarah",     gender: "female", hint: "ruhig, vertrauenswürdig" },
  { name: "Bill",      gender: "male",   hint: "tief, gelassen" },
  { name: "Brian",     gender: "male",   hint: "warm, souverän" },
  { name: "Callum",    gender: "male",   hint: "rau, intensiv" },
  { name: "Charlie",   gender: "male",   hint: "locker, jung" },
  { name: "Chris",     gender: "male",   hint: "natürlich, unaufgeregt" },
  { name: "Daniel",    gender: "male",   hint: "seriös, nachrichtenhaft" },
  { name: "Eric",      gender: "male",   hint: "freundlich, klar" },
  { name: "George",    gender: "male",   hint: "erzählend, ruhig" },
  { name: "Liam",      gender: "male",   hint: "jung, energetisch" },
  { name: "Roger",     gender: "male",   hint: "kräftig, präsent" },
  { name: "Will",      gender: "male",   hint: "entspannt, freundlich" },
];

/**
 * Kennt fals TTS-Enum diesen Wert? Gibt den Namen in KANONISCHER Schreibweise
 * zurück ("sarah" → "Sarah"), sonst null.
 *
 * Das ist die einzige verlässliche Unterscheidung zwischen den beiden Welten:
 * über fal ist `voice` ein Premade-NAME aus dieser Liste, über den eigenen
 * ElevenLabs-Key eine `voice_id`. Alles, was hier kein Treffer ist, ist eine ID
 * und darf niemals an fal gehen — fal quittiert das mit 422 „Voice not found",
 * und die Szene bleibt ohne Ton.
 */
/**
 * Namen vergleichbar machen — Groß-/Kleinschreibung und Unicode-Normalform raus.
 * „Anna" aus dem Modell und „anna" aus dem Eingabefeld sind dieselbe Person, und
 * ein zerlegtes „ä" (NFD) darf nicht an einem vorkomponierten scheitern.
 */
export function nameKey(s: string): string {
  return String(s || "").trim().normalize("NFC").toLowerCase();
}

/** Der Wert als KANONISCHER Charaktername des Nutzers — oder "", wenn unbekannt. */
export function matchCharacterName(value: string, names: string[]): string {
  const k = nameKey(value);
  if (!k) return "";
  return names.find((n) => nameKey(n) === k) ?? "";
}

/**
 * Wer ist in dieser Szene im Bild, und wer spricht?
 *
 * DIE zentrale Stelle für „welche Person ist gemeint" — vorher rechnete das
 * jeder Verbraucher für sich aus (Bild-Prompt aus `participants`, Stimme aus dem
 * `dialogText`-Präfix, Video gar nicht), mit jeweils eigenen Randfällen. Kommen
 * die drei zu verschiedenen Ergebnissen, zeigt das Bild eine andere Person als
 * die, deren Stimme man hört.
 *
 * Regeln, in dieser Reihenfolge:
 *  1. `participants` gegen die bekannten Namen prüfen — Wortgrenzen, damit
 *     „Ben (im Hintergrund)" nicht lautlos aus dem Bild fällt.
 *  2. Sprecher aus `scene.speaker`, sonst aus dem `"Name: Satz"`-Präfix.
 *  3. Wer spricht, IST im Bild: ein Sprecher, der nicht in `participants` steht,
 *     wird ergänzt statt verworfen. Sonst behauptete der Prompt gleichzeitig
 *     „nur Anna ist zu sehen" und „Ben spricht".
 *  4. Bleibt die Besetzung leer (Tippfehler, Altstoryboards), gelten alle
 *     Charaktere — ein einzelner Vertipper darf nicht die ganze Szene entvölkern.
 */
export function resolveSceneCast(
  scene: Pick<StoryScene, "participants" | "dialogText" | "speaker">,
  characters: { name: string }[],
): { framePeople: string[]; speaker: string; participants: string } {
  const names = characters.map((c) => c.name.trim()).filter(Boolean);
  const raw = String(scene.participants || "");

  // Wortgrenzen-Treffer im Rohtext: robust gegen Klammerzusätze und
  // Aufzählungszeichen, ohne bei „Ben" in „Benjamin" anzuschlagen.
  const inFrame = names.filter((n) => {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${esc}([^\\p{L}\\p{N}]|$)`, "iu").test(raw);
  });

  const fromField = matchCharacterName(scene.speaker || "", names);
  const fromPrefix = fromField ? "" : matchCharacterName(splitDialogLine(scene.dialogText || "", names).speaker, names);
  const speaker = fromField || fromPrefix;

  const framePeople = inFrame.length > 0 ? [...inFrame] : [...names];
  if (speaker && !framePeople.some((n) => nameKey(n) === nameKey(speaker))) framePeople.push(speaker);

  return { framePeople, speaker, participants: framePeople.join(", ") };
}

/**
 * WELCHES Gesicht geht als Referenzbild mit — und wer wird nur beschrieben?
 *
 * Bildmodelle mischen Gesichter, wenn zwei davon im selben Request liegen: die
 * Haarfarbe des einen landet am Kopf des anderen, und über mehrere Szenen driftet
 * das weiter. Genau das war hier zu sehen. Da im Bild ohnehin nur EIN Gesicht
 * vorkommt (die anderen zeigen den Rücken), braucht der Request auch nur dieses
 * eine Anker-Bild.
 *
 * Die Abgewandten fallen deshalb nicht weg — sie wechseln nur das Medium: statt
 * eines Anker-Bildes bekommt das Modell eine WORTBESCHREIBUNG (Haare, Statur,
 * Kleidung). Für einen Hinterkopf reicht das aus, und ihr Gesicht kann so gar
 * nicht erst ins Bild gelangen.
 *
 * Dieselbe Funktion bestimmt in StoryPage, welche Bilder tatsächlich mitgeschickt
 * werden, und im Prompt, wie die Referenzkarten beschriftet sind — sonst zeigt
 * „Image 2" auf ein Bild, das gar nicht mitgeschickt wurde.
 */
/**
 * Die beiden BÜHNEN-AUFNAHMEN eines Dialog-Reels: derselbe Raum, zweimal
 * fotografiert — einmal aus jeder Richtung des Gesprächs, und beide Male OHNE
 * Menschen.
 *
 * Wozu: Bisher diente das vorherige Szenenbild als Anschluss-Referenz. Es zeigt
 * aber immer auch eine Person, und das Modell übernahm von dort Gesichtszüge und
 * die Anordnung — die Hauptquelle für vermischte Charaktere und für „immer
 * dieselbe Person vorne". Eine menschenleere Platte kann beides nicht: sie legt
 * Raum, Licht und Kameraposition fest und sonst nichts.
 *
 * Zwei Platten, weil ein Dialog zwei Kamerapositionen hat. Platte A schaut auf
 * den Platz der ersten Person, Platte B aus der Gegenrichtung auf den der
 * zweiten. Damit ist der Gegenschnitt bereits im Bildmaterial angelegt und muss
 * nicht in jedem Szenen-Prompt neu erfunden werden.
 */
export function buildStagePlatePrompt(opts: {
  side: "A" | "B";
  mainLocation: string;
  specificArea?: string;
  artStyle: string;
  colorMood: string;
  aspect: string;
  /** Die durchgehende Situation des Reels — liefert Ort und Kameraaufbau. */
  situation?: ReelSituation | null;
  /** Namen der beiden Positionen, rein zur Beschreibung („Leos Platz"). */
  facingName?: string;
  otherName?: string;
}): string {
  const { side, mainLocation, specificArea, artStyle, colorMood, aspect } = opts;
  const place = [mainLocation, specificArea].filter(Boolean).join(" — ");
  const setting = opts.situation?.setting?.trim();
  const camera = opts.situation?.cameraSetup?.trim();

  return [
    `An EMPTY room photograph — a clean plate for a two-person conversation scene. ABSOLUTELY NO PEOPLE in this ` +
      `image: no person, no figure, no silhouette, no reflection of a person, no hands, no body part, not even ` +
      `blurred in the background. The room is empty and waiting.`,
    `Location: ${place || setting || "the room of this reel"}.${setting && place ? ` Specifically: ${setting}.` : ""}`,
    side === "A"
      ? `CAMERA POSITION A: the camera stands where ${opts.otherName || "the listener"} will be, looking across at the ` +
        `spot where ${opts.facingName || "the speaker"} will stand. Frame it so that a person standing on that spot ` +
        `would be centred in the upper two thirds, with room in the bottom-right corner for a shoulder in the foreground.`
      : `CAMERA POSITION B: the exact REVERSE of position A — the camera now stands where ${opts.facingName || "the speaker"} ` +
        `was, looking back at the spot where ${opts.otherName || "the listener"} will stand. Same room, same light, same ` +
        `lens, turned around by 180 degrees. Frame it so that a person standing on that spot would be centred in the ` +
        `upper two thirds, with room in the bottom-right corner for a shoulder in the foreground.`,
    camera ? `Camera setup: ${camera} — the same rig for both plates.` : "",
    `Both plates belong to ONE shoot: identical lighting, identical lens character, identical exposure, white balance ` +
      `and colour grade. Only the direction of view differs.`,
    `Visual style: ${artStyle}. ${getStoryColorInstruction(colorMood, "reel")}`,
    getAspectFramingDirective(aspect),
    "No text, letters, numbers, logos or watermarks anywhere in the image.",
  ].filter(Boolean).join("\n");
}

/**
 * Die RÜCKEN-REFERENZ eines Charakters: dieselbe Person wie im Charakterfoto,
 * einmal von hinten aufgenommen — Haare, Statur, Kleidung, aber KEIN Gesicht.
 *
 * Wozu: Der Abgewandte bekommt sein Gesichts-Foto nicht mehr mit in den Request
 * (Bild schlägt Text — genau daran vermischten sich die Charaktere). Nur mit
 * einer WORTbeschreibung erfindet das Modell aber Haarfarbe und Outfit neu.
 * Diese Aufnahme schließt die Lücke: sie trägt das Aussehen von hinten und kann
 * prinzipiell kein Gesicht einschleppen. Einmal pro Charakter, dann wiederver-
 * wendet wie die Bühnen-Platten.
 *
 * Der Prompt bekommt GENAU EIN Referenzbild: das Charakterfoto dieser Person.
 */
export function buildBackRefPrompt(opts: {
  name: string;
  gender?: string;
  description?: string;
  artStyle: string;
  aspect: string;
}): string {
  const traits = [opts.gender, (opts.description || "").trim()].filter(Boolean).join(", ");
  return [
    `A full back view of the EXACT SAME person as in the reference image — ${opts.name}${traits ? ` (${traits})` : ""}, ` +
      `photographed from directly behind.`,
    `Visible: the back of the head, the hair (same colour, same length, same style as in the reference), the neck, ` +
      `both shoulders, the upper back and the clothing from behind — the SAME clothing as in the reference image. ` +
      `Build, height impression and posture match the reference.`,
    `NOT visible: the face. No profile, no half-profile, no cheek, no nose, no eye, no turning of the head. ` +
      `This image is deliberately a faceless back view.`,
    `Plain, even, neutral light grey studio background — no room, no props, no scenery: this is a wardrobe/turnaround ` +
      `reference, not a scene.`,
    `Visual style: ${opts.artStyle}. No text, letters, numbers, logos or watermarks anywhere in the image.`,
    getAspectFramingDirective(opts.aspect),
  ].join("\n");
}

// HINWEIS: Der frühere Modell-Edit-Prompt für die Schulter
// (`buildShoulderOverlayPrompt`) ist ERSATZLOS entfernt. „Ändere sonst nichts"
// ist für ein generatives Modell keine erfüllbare Anweisung — es hat den
// Sprecher zur eingesetzten Schulter umkomponiert und aus der Kamera gedreht.
// Die Schulter wird jetzt deterministisch per Canvas eingesetzt:
// `lib/shoulderComposite.ts`.

export function sceneAnchorPlan(
  scene: Pick<StoryScene, "participants" | "dialogText" | "speaker">,
  characters: { name: string }[],
  /** `participants` ist optional: für die Sprecher-Erkennung der Vorszene
   *  genügen `speaker` bzw. das Dialogpräfix. */
  prevScene?: Partial<Pick<StoryScene, "participants" | "dialogText" | "speaker">> | null,
): { focus: string; anchorNames: string[]; describedNames: string[] } {
  const cast = resolveSceneCast(scene, characters);
  const prevSpeaker = prevScene
    ? resolveSceneCast({ participants: "", dialogText: "", speaker: "", ...prevScene }, characters).speaker
    : "";
  const focus = cast.speaker
    || (cast.framePeople.length === 2 && prevSpeaker
        ? cast.framePeople.find((n) => nameKey(n) !== nameKey(prevSpeaker)) ?? cast.framePeople[0]
        : cast.framePeople[0])
    || "";
  /**
   * STUMME Szene mit mehreren Personen — die Ausnahme von der Ein-Anker-Regel.
   *
   * Die Regel selbst begründet sich damit, dass im Bild ohnehin nur EIN Gesicht
   * vorkommt (Sprech-Szene: alle anderen zeigen den Rücken). Für die stumme
   * Establishing-/Schluss-Szene gilt das Gegenteil, und zwar auf Ansage: die
   * Storyboard-Direktive verlangt dort ausdrücklich beide Gesichter in EINEM
   * Bild („Beide Gesichter zusammen in einem Bild gibt es nur in einer Szene
   * OHNE dialogText"). Ging dann trotzdem nur ein Anker mit, hatte das zweite
   * Gesicht im Request gar keine Quelle — das Modell erfand es. Genau das war
   * der gemeldete Fehler: die Schluss-Szene zeigte einen fremden Mann, und auch
   * das vierte Neugenerieren konnte daran nichts ändern, weil die fehlende
   * Referenz kein Zufall war.
   *
   * Bedingung ist die STUMMHEIT, nicht bloß der fehlende Sprechername: eine
   * Zeile ohne erkennbaren Sprecher (Off-Text bei zwei Figuren) läuft weiter
   * über den Avatar-Weg, und dort animiert das Video jedes Gesicht, das es im
   * Standbild findet. Zwei Gesichter hiessen dort zwei bewegte Münder auf einer
   * Tonspur — deshalb bleibt es dafür beim einen Anker.
   */
  const silentScene = !cast.speaker && !String(scene.dialogText || "").trim();
  // Nur EIN Anker: der der Fokus-Person. Ist keine ermittelbar (Einzelperson
  // ohne Namen, Altprojekt), bleibt es beim bisherigen Verhalten und alle
  // Anwesenden gehen mit — dort gibt es kein Vermischungsrisiko.
  const anchorNames = silentScene && cast.framePeople.length > 1
    ? [...cast.framePeople]
    : focus ? [focus] : cast.framePeople;
  const describedNames = cast.framePeople.filter((n) => !anchorNames.some((a) => nameKey(a) === nameKey(n)));
  return { focus, anchorNames, describedNames };
}

/**
 * Besetzung + Seitenverteilung eines DUO-Frames (beide Personen im Bild).
 *
 * Sprecher aus `resolveSceneCast` (dieselbe Wahrheit wie Bild-Prompt und
 * Stimme); der Zuhörer ist die andere Person der Szene — steht wegen der
 * Ein-Gesicht-Regel des Storyboards oft nur der Sprecher in `participants`,
 * fällt die Wahl auf den anderen Projekt-Charakter.
 *
 * Die Seiten hängen an der CHARAKTER-REIHENFOLGE, nicht am Sprecher: wer früher
 * in der Liste steht, steht links — in jeder Szene desselben Paars identisch.
 * Hinge die Seite am Sprecher, würde jeder Sprecherwechsel die Anordnung
 * spiegeln und der Schnitt zwischen den Clips sähe aus wie ein Platztausch.
 */
export function duoFramePlan(
  scene: Pick<StoryScene, "participants" | "dialogText" | "speaker">,
  characters: { name: string }[],
): { speaker: string; listener: string; speakerSide: "left" | "right" } | null {
  const names = characters.map((c) => c.name.trim()).filter(Boolean);
  if (names.length < 2) return null;
  const cast = resolveSceneCast(scene, characters);
  const speaker = cast.speaker;
  if (!speaker) return null;
  const listener = cast.framePeople.find((n) => nameKey(n) !== nameKey(speaker))
    ?? names.find((n) => nameKey(n) !== nameKey(speaker));
  if (!listener) return null;
  const idx = (n: string) => names.findIndex((x) => nameKey(x) === nameKey(n));
  const speakerSide: "left" | "right" = idx(speaker) <= idx(listener) ? "left" : "right";
  return { speaker, listener, speakerSide };
}

/**
 * Das DUO-Frame in EINEM Durchgang: beide Personen, beide Charakterfotos als
 * Referenz, ein Prompt — der Weg vom Anfang des Projekts, bevor Rücken-
 * Referenzen und Bühnen-Platten kamen. Nutzerentscheid 2026-08-08: „so wie wir
 * es ganz am Anfang mit Kling hatten … da war es gut, was für Videos generiert
 * wurden" — das damals einzige Problem (beide bewegten die Lippen) löst jetzt
 * die OmniHuman-Sprecher-Maske, nicht mehr das Bild.
 *
 * WARUM EIN Durchgang statt der Zwei-Pass-Kette (beide Varianten am
 * 2026-08-08 an echten Renders gescheitert):
 *  • Pass 2 mit nur dem Zuhörer-Anker legte dessen Gesicht auf BEIDE Personen
 *    (Zuhörer Leo ⇒ 2x dunkelhaarig, Zuhörer Tim ⇒ 2x rothaarig).
 *  • Der Einfüge-Edit an sich ist das Risiko: „ändere sonst nichts" ist für
 *    ein generatives Modell keine erfüllbare Anweisung (dieselbe Lehre, an der
 *    schon das Schulter-Overlay ersatzlos starb).
 * Ein einzelner Text-zu-Bild-Lauf mit zwei klar beschrifteten Ankern hat
 * keinen Einfüge-Schritt, den das Modell missverstehen kann.
 *
 * Referenz-Reihenfolge ist Vertrag mit dem Aufrufer:
 *   Image 1 = Charakterfoto des SPRECHERS, Image 2 = das des ZUHÖRERS.
 *
 * Der Sprecher steht auf seiner festen Seite (die Halbbild-Maske für OmniHuman
 * hängt daran) und ist mitten im Satz; der Zuhörer hört mit GESCHLOSSENEM Mund
 * zu — ein offener Zuhörer-Mund bliebe im fertigen Clip als eingefrorenes
 * Sprechgesicht stehen, die Maske animiert ihn ja gerade nicht.
 */
export function buildDuoFramePrompt(opts: {
  scene: StoryScene;
  speaker: { name: string; gender?: string; description?: string; outfit?: string };
  listener: { name: string; gender?: string; description?: string; outfit?: string };
  speakerSide: "left" | "right";
  mainLocation: string;
  artStyle: string;
  colorMood: string;
  aspect: string;
  situation?: ReelSituation | null;
  /** Reden die beiden MITEINANDER oder mit dem ZUSCHAUER? Ohne Angabe: mit dem
   *  Zuschauer — das ist die Form, die ein Reel trägt. Siehe DUO_STAGINGS. */
  staging?: DuoStaging;
  /**
   * Wie viel machen die beiden mit den Händen? Ohne Angabe „calm" = bisher.
   *
   * Die HARTE Grenze bleibt in beiden Fassungen dieselbe und ist kein Stilmittel:
   * Die OmniHuman-Maske schneidet starr bei w/2. Wer mit dem Arm über die
   * Bildmitte greift, landet teilweise in der falschen Hälfte — dann animiert
   * das Modell den falschen Mund. Der aktive Text sagt das deshalb selbst noch
   * einmal, statt sich auf die FRAME-HALVES-Zeile weiter oben zu verlassen.
   */
  actionLevel?: ActionLevel;
  /**
   * Liegt als DRITTES Referenzbild ein Nachbar-Frame dieses Reels bei — und aus
   * welcher Richtung?
   *
   * Bis dahin bekam der Duo-Pfad ausschliesslich die beiden Charakterfotos —
   * und damit keinerlei Bindung an die Szenen daneben. Das Ergebnis war am
   * Storyboard ablesbar: dieselben zwei Personen in drei Clips mit drei
   * verschiedenen Oberteilen, drei Lichtstimmungen und einmal sogar einem
   * anderen Raum. Kleidung und Licht sind Bild-Eigenschaften; gegen ein
   * Referenzbild kommt keine Textzeile an, also braucht es hier auch eines.
   *
   * "next" ist der Fall „Szene 1 einzeln neu erzeugen": sie hat keinen
   * Vorgänger, aber die Szene danach existiert schon. Für Raum, Licht und
   * Kleidung ist die genauso bindend — für Haltung und Fortschritt aber das
   * GEGENTEIL, denn sie zeigt einen späteren Moment. Deshalb die Richtung.
   */
  neighbourFrame?: "prev" | "next" | null;
}): string {
  const { scene, speaker, listener, speakerSide } = opts;
  const listenerSide = speakerSide === "left" ? "right" : "left";
  const place = [opts.mainLocation, scene.specificArea].filter(Boolean).join(" — ");
  const setting = opts.situation?.setting?.trim();
  const outfit = opts.situation?.outfit?.trim();
  const cameraSetup = opts.situation?.cameraSetup?.trim();
  // Die vom Nutzer gewählte Garderobe der beiden — leer, wenn nichts gesetzt ist.
  const chosenOutfits = [opts.speaker, opts.listener]
    .filter((c) => (c.outfit || "").trim())
    .map((c) => `${c.name} wears ${(c.outfit || "").trim()}`)
    .join("; ");
  const traitsOf = (c: { gender?: string; description?: string }) =>
    [c.gender, (c.description || "").trim()].filter(Boolean).join(", ");
  const speakerTraits = traitsOf(speaker);
  const listenerTraits = traitsOf(listener);
  // Roher Szenentext, kein Retry-Softening (`soften` ist eine LOKALE Helferin
  // in buildSceneImagePrompt) — der Duo-Pfad hat seine eigene kleine Schleife.
  const action = (scene.keyAction || scene.summary || "").trim();
  const emotion = (scene.emotion || "").trim();
  const toCamera = (opts.staging ?? "camera") === "camera";

  // ── AKTIONS-LEVEL ────────────────────────────────────────────────────────
  // Der einzige Unterschied zwischen den beiden Fassungen ist die Gestik. Die
  // Mittellinien-Klausel steht in der aktiven Fassung ausdrücklich mit drin:
  // ein ausholender Arm über die Bildmitte bricht die OmniHuman-Maske, und das
  // kostet den bezahlten Clip (siehe FRAME HALVES oben).
  const handsLine = opts.actionLevel === "active"
    ? `HANDS ACTIVE — mid-gesture at chest height: an open palm turned up, a pointing finger, or something held up ` +
      `in the hand. Elbows away from the body, hands clearly visible and NEVER in front of their own face. Their ` +
      `arms stay entirely within their own half of the frame and never cross the vertical centre line. `
    : `HANDS AT REST — relaxed at their sides or loosely in front of the body. No pointing, no raised palm, no ` +
      `counting fingers, no arm spread wide: this person is telling something, not performing it. `;
  // Der Zuhörer bleibt in BEIDEN Fassungen zurückhaltend: Er hat keine Tonspur,
  // und eine ausholende Geste ohne Worte liest sich im Clip als jemand, der
  // stumm mitredet.
  const listenerHands = opts.actionLevel === "active"
    ? "relaxed and low, entirely on their own side of the frame"
    : "relaxed";

  return [
    // ══ ZWEI INSZENIERUNGEN, EINE WAHL ═══════════════════════════════════════
    // "camera"       — beide stehen nebeneinander, der Sprecher redet in die
    //                  Linse (Creator-Duo, Direktansprache).
    // "conversation" — die beiden reden MITEINANDER, der Zuschauer sieht zu.
    //
    // Bis 2026-08-13 gab es nur die zweite Fassung, und zwar unausgesprochen:
    // Sie stand an vier Stellen im Prompt („talking to EACH OTHER", „FACING EACH
    // OTHER", „Nobody looks into the camera", „they keep standing face to face")
    // und erzeugte damit zwangsläufig zwei Profile — auch dann, wenn der Text
    // den Zuschauer direkt ansprach. Das Standbild ist bei OmniHuman die EINZIGE
    // Steuerung; der Blick hängt an nichts außer diesen Zeilen.
    //
    // Was in BEIDEN Fassungen gleich bleibt (mit Grund): Zwei-Schuss, statische
    // Kamera, Halbtotale, beide ganz im Bild, kein Sofa, kein Rücken, kein
    // Over-the-shoulder — die Klemmen vom 2026-08-08 gegen posierte bzw.
    // weggedrehte Figuren.
    toCamera
      ? `A creator-style presenting TWO-SHOT: exactly TWO people STANDING SIDE BY SIDE and talking TO THE VIEWER, ` +
        `both fully visible in ONE frame, photographed by one static camera at eye level in a MEDIUM shot (waist up).`
      : `A natural conversation TWO-SHOT: exactly TWO people STANDING and talking to EACH OTHER, both fully visible ` +
        `in ONE frame, photographed by one static camera at eye level in a MEDIUM shot (waist up).`,
    toCamera
      ? `STAGING (fixed): Both people STAND UPRIGHT side by side, about one metre apart, SQUARELY FACING THE CAMERA ` +
        `with their shoulders open to the lens. A body may be angled at most 20 degrees inwards — never turned into ` +
        `a profile, never turned towards each other. This is creator-style DIRECT ADDRESS to the viewer, not a ` +
        `conversation between the two of them. Nobody poses stiffly for a photo. Nobody sits, kneels, leans on ` +
        `furniture or crosses their arms stiffly. Nobody is seen from behind — no back of a head, no ` +
        `over-the-shoulder framing, and no profile view of either face.`
      : `STAGING (fixed): Both people STAND UPRIGHT at a natural conversational distance — about one metre apart — ` +
        `FACING EACH OTHER. Each body is angled roughly 45 degrees towards the camera, so BOTH faces are clearly ` +
        `visible in three-quarter view — never a flat profile, and never with a face hidden. Neither of them looks ` +
        `into the camera; they are absorbed in each other. Nobody poses for a photo. Nobody sits, kneels, leans on ` +
        `furniture or crosses their arms stiffly. Nobody is seen from behind — no back of a head, no ` +
        `over-the-shoulder framing. This is a candid moment inside an ongoing conversation, not a posed picture.`,
    // ══ BILDHÄLFTEN ══════════════════════════════════════════════════════════
    // Fehlte bisher komplett. OmniHuman wählt den Sprecher AUSSCHLIESSLICH über
    // eine stumpfe Halbbild-Maske, die hart bei w/2 schneidet (lib/image.ts).
    // Ragt ein Kopf über die Mitte, liegt er teils in der falschen Hälfte — dann
    // animiert das Modell den falschen bzw. einen halben Mund.
    `FRAME HALVES (hard requirement): ${speaker.name} stands entirely in the ${speakerSide.toUpperCase()} half of ` +
      `the frame, ${listener.name} entirely in the ${listenerSide.toUpperCase()} half. Neither person — and above ` +
      `all neither head — crosses the vertical centre line of the image. Keep a clear gap between them at the centre.`,
    `Image 1 is the IDENTITY ANCHOR for ${speaker.name}${speakerTraits ? ` (${speakerTraits})` : ""} — this is the ` +
      `person on the ${speakerSide.toUpperCase()} side of the frame. Bind their face, head shape, hairline, hair & ` +
      `eye colour and build strictly to Image 1 and to nobody else.`,
    `Image 2 is the IDENTITY ANCHOR for ${listener.name}${listenerTraits ? ` (${listenerTraits})` : ""} — this is ` +
      `the person on the ${listenerSide.toUpperCase()} side of the frame. Bind their face, head shape, hairline, ` +
      `hair & eye colour and build strictly to Image 2 and to nobody else.`,
    // Die Anker sind PORTRÄTS — irgendwo aufgenommen, oft an einem Ort, der mit
    // diesem Reel nichts zu tun hat. „Binde dich streng an dieses Bild" liest ein
    // Bildmodell als Einladung, den ganzen Frame zu übernehmen: am erzeugten
    // Storyboard belegt, wo hinter den beiden plötzlich eine Schnee-Landschaft
    // stand, obwohl der Hauptort ein dunkles Home-Office ist. Der Satz trennt,
    // was aus den Ankern kommt (die Person) und was nicht (alles dahinter).
    `From Image 1 and Image 2 take ONLY THE PERSON — face, hair, build. They are PORTRAITS, not costume or location ` +
      `references: NEVER take what they are wearing in them, and never their background, their room, their ` +
      `furniture, their weather, their time of day or their lighting. What they wear comes from the WARDROBE line ` +
      `below, where this picture happens from the Location line.`,
    // Mund auf / Mund zu ist in BEIDEN Fassungen identisch und nicht verhandelbar:
    // der offene Mund ist der Lipsync-Anker, der geschlossene verhindert, dass im
    // Clip zwei Münder auf einer einzigen Tonspur mitreden. Verschieden ist
    // ausschließlich die Blickrichtung.
    // HÄNDE RUHIG — die Geste war hier eine PFLICHT in jedem einzelnen Standbild
    // („one natural hand gesture at chest height"). Bei einem Reel aus fünf
    // Duo-Szenen hiess das fünfmal dieselbe unterstreichende Handbewegung, in
    // jedem Clip aufs Neue: der Eindruck von jemandem, der jeden Satz vorführt,
    // statt ihn zu meinen. Der Ausdruck gehoert ins Gesicht (siehe EXPRESSION
    // weiter unten) — der bleibt unangetastet und ausdruecklich gross.
    toCamera
      ? `${speaker.name} (${speakerSide}) is MID-SENTENCE, speaking TO THE VIEWER: face and eyes straight INTO THE ` +
        `CAMERA LENS, mouth naturally open on a word. ${handsLine}` +
        `${listener.name} (${listenerSide}) is silent, with the mouth fully CLOSED — lips together, no visible ` +
        `teeth — standing alongside and also turned towards the camera (at most a slight turn towards ` +
        `${speaker.name}, never a profile), reacting with the eyes and the face only, hands ${listenerHands}.`
      : `${speaker.name} (${speakerSide}) is MID-SENTENCE, speaking to ${listener.name}: mouth naturally open on a ` +
        `word, eyes on ${listener.name}. ${handsLine}` +
        `${listener.name} (${listenerSide}) LISTENS attentively with the mouth fully CLOSED — lips together, no ` +
        `visible teeth — eyes on ${speaker.name}, hands ${listenerHands}.`,
    // Der Duo-Pfad hat `emotion` bisher gar nicht gelesen — die Szene brachte ein
    // Gefühl mit, das Bild zeigte keins. Genau das war der zweite Teil der
    // Rückmeldung („starke Emotionen sollen deutlich sichtbar sein").
    emotion
      ? `EXPRESSION: ${speaker.name} visibly feels ${emotion} while saying this — big and unmistakable in the ` +
        `brows, the eyes and the mouth, readable at a glance on a small phone screen. Never a blank, neutral or ` +
        `merely polite face. ${listener.name} reacts to it silently, with a clearly readable expression of their own.`
      : "",
    `${speaker.name} and ${listener.name} are two clearly DIFFERENT people: different face, different hair, ` +
      `different clothing. NEVER render the same face twice — no twins, no siblings, no lookalikes. If they start ` +
      `to look similar, exaggerate their differences from their anchor images instead.`,
    // Die Handlung färbt nur Stimmung und Gestik — sie darf die Inszenierung
    // nicht umbauen, sonst gewinnt „probiert die Übung aus" gegen das Gespräch.
    // „mood and small gestures ONLY" hat die Geste durch die Hintertuer wieder
    // hereingelassen, nachdem die Zeile darueber sie gerade abbestellt hat.
    // Die Handlung faerbt jetzt Stimmung und Gesicht — die Haende nicht.
    // AKTIONS-LEVEL: Im aktiven Modus MUSS die Handlung auch die Hände steuern
    // dürfen — bliebe hier „never adds a hand gesture" stehen, nähme diese Zeile
    // die HANDS-ACTIVE-Anweisung von oben sofort wieder zurück.
    action
      ? (opts.actionLevel === "active"
        ? `Context (it sets the mood, the facial expression AND what the hands are doing; it never changes the ` +
          `staging above — they keep standing ${toCamera ? "side by side, facing the camera" : "face to face"}, ` +
          `each entirely within their own half of the frame): ${action}`
        : `Context (mood and facial expression ONLY — it never changes the staging above and never adds a hand ` +
      `gesture; they keep standing ${toCamera ? "side by side, facing the camera" : "face to face"}): ${action}`)
      : "",
    // ── Was über ALLE Clips gleich bleiben muss ────────────────────────────
    // Der Duo-Pfad hatte davon bisher nichts: kein Vorgängerbild, keine
    // Garderobe-Zeile, keine Licht-Konstanz. Jede Szene entstand für sich, und
    // genau so sah das Reel dann auch aus.
    opts.neighbourFrame
      ? `Image 3 is ${opts.neighbourFrame === "next" ? "the NEXT scene" : "the PREVIOUS scene"} of this same reel, ` +
        `already rendered. It is BINDING for everything that must not change between clips: the room and its ` +
        `furniture, the light and its direction, the exposure and colour grade, and above all WHAT EACH PERSON IS ` +
        `WEARING — same garment, same colour, same cut, same hair. These two shots are cut together and must look ` +
        `like the same afternoon in the same room. It is NOT a face reference: the faces come from Image 1 and ` +
        `Image 2 alone, and it is not a reference for posture or gesture — those come from the staging above.` +
        (opts.neighbourFrame === "next"
          ? ` It shows a LATER moment than this one: this frame happens BEFORE it, so never copy where objects have ` +
            `ended up or how far the action has progressed.`
          : "")
      : "",
    // Die Garderobe kommt aus der WAHL des Nutzers, niemals aus dem Porträt —
    // dort ist die Kleidung Zufall der Aufnahme (Nutzerentscheid 2026-08-10).
    outfit
      ? `WARDROBE (fixed for the whole reel): ${outfit}. Both people wear exactly this in every single scene — ` +
        `never a different garment, never a different colour, and the two of them never wear the same thing.`
      : chosenOutfits
      ? `WARDROBE — PER PERSON, as chosen: ${chosenOutfits}. Dress them exactly like that, unchanged from clip to ` +
        `clip. NEVER copy what they wear in their portrait references.`
      : `WARDROBE — PER PERSON: ordinary clothing that suits this location, chosen once and then identical in EVERY ` +
        `scene of this reel. NEVER copy what they wear in their portrait references — those are portraits, not ` +
        `costume references. The two wear clearly different clothes; never dress them alike, never swap a garment.`,
    `Location: ${place || setting || "the scene of this story"}.${setting && place ? ` Specifically: ${setting}.` : ""} ` +
      `This is the SAME place in every scene of this reel — same room, same furniture, same view out of any window. ` +
      `Never relocate the scene, never invent a different landscape or a different building.`,
    cameraSetup ? `Camera setup: ${stripCameraAngleWords(cameraSetup)} — unchanged in every scene.` : "",
    `Exactly TWO people in the image, nobody else — no third person, no bystander, no reflection of anyone.`,
    `Visual style: ${opts.artStyle}. ${getStoryColorInstruction(opts.colorMood, "reel")}`,
    `Same lens character, exposure, white balance and colour grade as the rest of this reel — these clips are cut ` +
      `together, so a shift in look reads as a different shoot.`,
    getAspectFramingDirective(opts.aspect),
    "No text, letters, numbers, logos or watermarks anywhere in the image.",
  ].filter(Boolean).join("\n");
}

export function falPremadeVoiceName(value: string): string | null {
  const needle = (value || "").trim().toLowerCase();
  if (!needle) return null;
  return ELEVEN_VOICES.find((x) => x.name.toLowerCase() === needle)?.name ?? null;
}

/** Vorbelegung der Stimme nach Geschlecht — bewusst konservativ gewählt. */
export function defaultVoiceFor(gender: "male" | "female" | "neutral"): string {
  if (gender === "male") return "Brian";
  if (gender === "female") return "Sarah";
  return "River";
}

/**
 * Storyboard-Dialogzeilen sind als "Name: Gesprochener Satz" formatiert.
 * Kein Match → der ganze Text ist die Zeile (Narrator-Text muss wortwörtlich
 * bleiben: "Achtung: das wird teuer" würde sonst seinen Anfang verlieren).
 *
 * `knownNames` (optional): Liste der echten Sprechernamen. Ist sie gesetzt,
 * zählt ein Präfix NUR dann als Sprecher, wenn es einem der Namen entspricht —
 * ohne diese Prüfung fraß die Regex im Dialog-Modus JEDEN Zeilenanfang vor
 * einem Doppelpunkt („Merk dir: nie am Ende kaufen" verlor „Merk dir", und der
 * Bild-Prompt behauptete eine Person namens „Merk dir" als Sprecher). Ohne
 * Liste bleibt das bisherige Verhalten (Abwärtskompatibilität).
 */
export function splitDialogLine(text: string, knownNames?: string[]): { speaker: string; line: string } {
  const full = String(text ?? "");
  // Der Sprecher steht — wenn überhaupt — am Anfang der ERSTEN Zeile.
  //
  // Vorher lief die Regex mit `s`-Flag über den ganzen Text und `[^:]` schluckte
  // dabei Zeilenumbrüche. Zwei belegte Folgen: `"Anna: Wirklich?\nMark: Ja."`
  // ergab eine „Zeile", die Marks Präfix mitsprach; und bei
  // `"Ich zeig dir was\nMark: Wirklich?"` galt alles vor dem Doppelpunkt als
  // Name — der erste Satz verschwand ersatzlos aus der Vertonung.
  const first = full.split(/\r?\n/, 1)[0] ?? "";
  const m = first.match(/^\s*([^:\n]{1,40}):\s*(.+)$/);
  if (!m) return { speaker: "", line: full.trim() };
  const speaker = m[1].trim();
  if (knownNames && knownNames.length > 0) {
    if (!matchCharacterName(speaker, knownNames)) return { speaker: "", line: full.trim() };
  }
  // Nur das Präfix der ersten Zeile fällt weg — der Rest des Textes bleibt
  // vollständig erhalten, inklusive weiterer Zeilen.
  const rest = full.slice(full.indexOf(first) + first.length);
  return { speaker, line: (m[2] + rest).trim() };
}

interface StoryboardPromptOpts extends StoryConfig {
  characters: StoryCharacter[];
  /**
   * Projekt-Profil als Kontextblock (aus `buildProfilePreamble`).
   * Bis dahin floss das Profil NUR in die Ideen-Vorschläge ein — das eigentliche
   * Storyboard, also der Inhalt des ganzen Reels, entstand ohne jeden Projekt-
   * Bezug. Leerstring = kein (bzw. übersprungenes) Profil → Prompt wie vorher.
   */
  profileContext?: string;
}

export function buildStoryboardPrompt(opts: StoryboardPromptOpts): string {
  const {
    mode, idea, pointCount, voiceMode, dialogMode, generationDirection, enableSpeaker,
    enableSceneDescription, speakerGender, artStyle, pacing, videoMood, colorMood,
    hook, cta, language, customDetails, characters, reelStyle, reelOutro,
  } = opts;
  const ctaLine = (cta ?? "").trim();

  // Der Profil-Kontext steht VOR den Eingaben, damit das Modell erst weiß,
  // worum es im Projekt geht, und die Idee dann in diesem Rahmen ausarbeitet.
  // Die Sprache bleibt bewusst außen vor — dafür gibt es `outputLanguage`, und
  // zwei konkurrierende Sprachangaben im selben Prompt wären ein Widerspruch.
  const profileBlock = opts.profileContext?.trim() ? `${opts.profileContext.trim()}\n\n` : "";

  // Vlog vs. Explainer. Der Explainer-Pfad muss WORTGLEICH bleiben wie bisher —
  // alle Vlog-Zusätze unten sind deshalb leere Strings, sobald das hier false ist.
  const vlogActive = mode === "reel" && reelStyle === "vlog";

  // reelStyle mitgeben: der Vlog braucht seinen eigenen Default-Hook, sonst
  // trüge die „LEITPLANKE" die Bild-Gag-Sprache des Erklär-Formats in den
  // Vlog-Block. Bei "explainer" bleibt der Hook Zeichen für Zeichen der alte.
  const effectiveHook = getEffectiveStoryHook(mode, hook, enableSpeaker, reelStyle, opts.actionLevel);
  const characterNames = characters.map((c) => c.name);
  // Der Video-Prompt parst dialogText als "Name: Gesprochener Satz" — das Format
  // muss dem Storyboard-Modell deshalb EXPLIZIT vorgegeben werden.
  const dialogueRule = characterNames.length > 0
    ? `  - falls voiceMode = "dialog": JEDE dialogText-Zeile MUSS exakt das Format "Name: Gesprochener Satz" haben — der Name vor dem Doppelpunkt ist ein exakter Charaktername aus dieser Liste: ${characterNames.map((n) => `"${n}"`).join(", ")}`
    : '  - falls voiceMode = "dialog": JEDE dialogText-Zeile MUSS exakt das Format "Name: Gesprochener Satz" haben (Sprechername, Doppelpunkt, Text). Verteile die Dialoge logisch auf die sichtbaren Figuren der Szene';

  const characterBlock = characters.length > 0
    ? characters.map((c, i) =>
        `- Charakter ${i + 1} (id: char_${i}): Name "${c.name}", Geschlecht ${c.gender}${c.description ? `, Beschreibung: ${c.description}` : ""}`
      ).join("\n")
    : "";

  const reelDirective = mode === "reel"
    ? (vlogActive
        ? getVlogReelDirective({ effectiveHook, voiceMode, enableSpeaker, reelOutro, sceneCount: pointCount, actionLevel: opts.actionLevel })
        : getReelStoryboardDirective({ effectiveHook, voiceMode, enableSpeaker, sceneCount: pointCount, multiCharacter: characters.length > 1, actionLevel: opts.actionLevel }))
    : "";

  // Nur im Vlog-Pfad dokumentiert: das Top-Level-Objekt `situation` und das
  // Szenenfeld `voiceDelivery`. Im Explainer-Pfad bleiben die drei Strings leer,
  // dann ist das ausgegebene JSON-Schema Zeichen für Zeichen das alte.
  const situationSchemaLine = vlogActive
    ? '\n  "situation": { "activity": "string", "setting": "string", "outfit": "string", "cameraSetup": "string" },'
    : "";
  const deliverySchemaLine = vlogActive
    ? ',\n      "voiceDelivery": "one of the voiceDelivery values"'
    : "";
  // WER spricht — nur nötig, wenn es überhaupt mehr als eine Person gibt.
  // Bei einer einzigen Figur ist die Frage beantwortet, und ein zusätzliches
  // Pflichtfeld wäre nur eine weitere Gelegenheit für das Modell, etwas
  // Unerwartetes zu liefern. Bewusst UNABHÄNGIG vom voiceMode: auch im
  // Sprecher-Modus muss feststehen, wer von zweien redet — dort läuft die
  // Szene über `ai-avatar`, und das Bild ist die einzige Steuerung.
  const needsSpeakerField = characters.length > 1;
  const speakerSchemaLine = needsSpeakerField
    ? '\n      "speaker": "string, genau EIN exakter Charaktername — wer diese Zeile spricht; leer bei Szenen ohne dialogText",'
    : "";
  const speakerFieldRule = needsSpeakerField
    ? '\n- "speaker": der EINE Charakter, der in dieser Szene spricht — exakt einer der oben genannten Namen. Er MUSS auch in "participants" derselben Szene stehen. Niemals zwei Namen, niemals eine Rolle („der Mann"), niemals ein Name, der nicht in der Referenzliste steht. Hat die Szene keinen dialogText, bleibt das Feld leer.'
    : "";

  /**
   * AUSSPRACHE-FASSUNG des Sprechtexts.
   *
   * Die Sprachausgabe kennt kein Aussprache-Feld — der Text IST die einzige
   * Steuerung. Eine deutsch eingestellte Stimme liest „Google Ads" deutsch, und
   * amerikanische Firmennamen klingen dann falsch. Lautschriftlich umgeschrieben
   * („Guhgel Ähds") trifft dieselbe Stimme die amerikanische Aussprache.
   *
   * Warum ein ZWEITES Feld und nicht direkt im dialogText: Die Szenenkarte, der
   * Detail-Dialog und die Untertitel zeigen `dialogText`. Stünde dort „Guhgel
   * Ähds", wäre das Storyboard unlesbar — die Umschrift ist nur für die Stimme
   * gedacht und darf nirgends sonst auftauchen.
   *
   * Nur verlangt, wenn überhaupt gesprochen wird; sonst wäre es ein Pflichtfeld
   * über einen leeren Text.
   */
  const speechSchemaLine = enableSpeaker
    ? '\n      "dialogSpeech": "string",'
    : "";
  const speechFieldRule = enableSpeaker
    ? `\n- "dialogSpeech": derselbe Sprechtext wie in "dialogText", aber so geschrieben, wie er KLINGEN soll. Diese Fassung wird niemals angezeigt, sie geht nur an die Sprachausgabe.
  - Die Stimme liest den Text in der Sprache ${getLanguageName(language)} vor und spricht englische EIGENNAMEN deshalb mit dem Akzent dieser Sprache aus. Genau das soll nicht passieren.
  - NUR EIGENNAMEN: amerikanische bzw. englische FIRMEN-, MARKEN-, PRODUKT- und PLATTFORMNAMEN. Beispiele für Deutsch: „Google" → „Guhgel", „Google Ads" → „Guhgel Ähds", „YouTube" → „Juh-Tjuub", „ChatGPT" → „Tschätt-Tschih-Pih-Tih", „Shopify" → „Schoppifei", „PayPal" → „Pehpäl", „Amazon" → „Ämmäsonn", „Nike" → „Neiki". Bei einer anderen Ausgabesprache gilt dasselbe nach deren Schreibregeln.
  - NIEMALS gewöhnliche englische Wörter, auch wenn sie englisch aussehen: „Autoplay", „Autopilot", „Marketing", „Online", „Content", „Business", „Update", „Feature", „Team", „Newsletter", „Website", „Shop", „Reel", „Post" und alles Vergleichbare bleiben BUCHSTABENGLEICH stehen. Sie sind längst Teil der Alltagssprache, die Stimme spricht sie ohnehin verständlich aus — und eine Umschrift macht sie unkenntlich. Im Zweifel NICHT umschreiben.
  - PRÜFE JEDE UMSCHRIFT, bevor du sie ausgibst: Lies sie dir laut in ${getLanguageName(language)} vor. Ergibt sie hörbar denselben Namen? Wenn nicht — oder wenn dabei ein anderes, existierendes Wort entsteht — lass das Original stehen. Eine unverfälschte, leicht akzentuierte Aussprache ist IMMER besser als ein Wort, das der Zuhörer nicht wiedererkennt.
  - Trenne mehrsilbige Namen mit Bindestrichen, wo es der Stimme hilft. Verwende nur Buchstaben der Ausgabesprache — keine IPA-Zeichen, keine Klammern, keine Aussprachehinweise.
  - ALLES ANDERE bleibt WORTGLEICH wie in "dialogText": gleiche Wörter, gleiche Reihenfolge, gleiche Satzzeichen${needsSpeakerField ? ', und derselbe Sprechername mit Doppelpunkt am Anfang' : ''}. Du übersetzt nicht, du kürzt nicht, du formulierst nicht um — du schreibst ausschließlich die Eigennamen anders.
  - Kommt in der Zeile KEIN solcher Eigenname vor, gib einen leeren String aus. Das ist der Normalfall — die meisten Zeilen brauchen keine Umschrift.`
    : "";

  /**
   * EIN GESICHT PRO SPRECH-SZENE.
   *
   * Jeder Clip trägt genau eine Stimme, und das Videomodell animiert jedes
   * Gesicht, das es im Startbild findet. Zwei frontale Personen in einer
   * Sprech-Szene ergeben deshalb zwangsläufig einen Clip, in dem jemand stumm
   * mitredet. Statt Personen zu verbieten, wird die Kamera geführt: Die zweite
   * Person bleibt in der Szene, aber als Rücken oder Schulter — Schuss und
   * Gegenschuss, wie in jedem Dialogfilm. Gemeinsame Bilder mit zwei Gesichtern
   * bleiben ausdrücklich erlaubt, nur eben in Szenen ohne gesprochene Zeile.
   */
  // „Im Reel hat JEDE Szene eine gesprochene Zeile" gilt nur, wenn überhaupt
  // gesprochen wird. Ohne Sprechertext gibt es gar keinen dialogText — dann
  // behauptete der Satz das Gegenteil dessen, was zwei Zeilen weiter steht, und
  // verbot zwei Gesichter selbst dort, wo sie erlaubt sein sollen. Im
  // Dialog-Modus „smart" darf das Modell außerdem bewusst stumme Szenen bauen.
  const everySceneSpeaks =
    mode === "reel" && enableSpeaker && !(voiceMode === "dialog" && dialogMode === "smart");
  const oneFaceRule = characters.length > 1
    ? `
EIN GESICHT PRO SPRECH-SZENE (gilt, weil mehrere Charaktere vorhanden sind):
- In JEDER Szene mit dialogText ist genau EIN Gesicht zu sehen: das des Sprechers, der Kamera zugewandt. Alle anderen Anwesenden sind von hinten oder abgewandt zu sehen — nie ihr Gesicht, auch nicht im Profil oder im Hintergrund. WIE die Szene das löst (über die Schulter, abgewandt, im Anschnitt), bleibt dir überlassen — komponiere natürlich.
- Nicht jede Sprech-Szene braucht beide Personen im Bild: regelmässig darf NUR der Sprecher zu sehen sein, die andere Person ist schlicht ausserhalb des Ausschnitts (sie bleibt im Raum und im Gespräch). Dann steht in "participants" AUSSCHLIESSLICH der Sprecher. Wechsle ab — nie dieselbe Aufteilung dreimal hintereinander.
- "detailedDescription" benennt bei Zweierszenen klar, dass nur das Gesicht des Sprechers zu sehen ist und die andere Person von hinten bzw. abgewandt. Niemals „beide schauen in die Kamera", niemals „beide sind gut zu sehen".
- WECHSELT der Sprecher von einer Szene zur nächsten, wechselt auch das Bild die Seite: der neue Sprecher zeigt jetzt das Gesicht, der vorherige ist von hinten zu sehen oder verlässt den Ausschnitt.
- Beide Gesichter zusammen in einem Bild gibt es nur in einer Szene OHNE dialogText.${everySceneSpeaks
      ? ' Im Reel-Format hat aber JEDE Szene eine gesprochene Zeile — dort ist ein Bild mit zwei Gesichtern also durchgehend ausgeschlossen.'
      : ' Nutze dafür eine stumme Establishing-Szene: sie zeigt einmal die Konstellation (z. B. zwei Personen am Tisch), danach übernimmt der Schnitt. Aber NIEMALS als Szene 1: die erste Szene trägt den Hook und hat IMMER eine gesprochene Zeile — ein stummer Anfang verschenkt die einzigen Sekunden, in denen der Zuschauer noch wegscrollt. Stumme Szenen frühestens ab Szene 2.'}`
    : "";
  /**
   * WER WIRD ANGESPROCHEN? Das entscheidet über den Sprechtext, nicht nur über
   * das Bild. Steht die Inszenierung auf „zum Zuschauer", sind Zeilen wie „Und
   * was meinst du dazu?" falsch — sie fordern eine Antwort, die es nicht gibt.
   * Steht sie auf „miteinander", ist umgekehrt jede Du-Ansprache an den
   * Zuschauer ein Bruch. Bild und Text müssen dasselbe Format meinen.
   */
  /**
   * DIE LETZTE ZEILE IST DIE AUSNAHME — und sie stand vorher im Widerspruch.
   *
   * Der CTA geht laut seiner eigenen Beschreibung an den Zuschauer und wird von
   * der LETZTEN Szene gesprochen. Gleichzeitig verbot die Gesprächs-Regel jede
   * Anrede ans Publikum, für das ganze Reel. Das Modell bekam damit zwei
   * einander ausschliessende Anweisungen und löste sie irgendwie auf: entweder
   * verschwand der CTA, oder er lag als Du-Ansprache in einer Szene, in der die
   * beiden einander ansahen. Das Bild dazu (`buildDuoFramePrompt`) und der Clip
   * drehen sich für diese eine Szene jetzt zur Kamera — der Text muss dasselbe
   * meinen, sonst spricht jemand ins Publikum und schaut dabei den Partner an.
   */
  const ctaTurnRule = ctaLine
    ? `\n- AUSNAHME, LETZTE SZENE: Sie trägt den Call-to-Action, und der geht an den ZUSCHAUER — dort ist die Du-Ansprache ans Publikum ausdrücklich richtig ("Schau dir den Link in der Beschreibung an"). Die beiden lösen sich in dieser einen Szene aus dem Gespräch und wenden sich gemeinsam dem Publikum zu; gesprochen wird die Zeile trotzdem nur von EINER Person. Die Szene davor darf den Übergang vorbereiten, muss es aber nicht.`
    : "";
  const duoAddressRule = characters.length > 1 && enableSpeaker
    ? (opts.duoStaging === "conversation"
        ? `\n- ZWEI PERSONEN, GESPRÄCH: Die Figuren sprechen MITEINANDER, nicht zum Zuschauer. Die Zeilen reagieren aufeinander — eine Frage bekommt eine Antwort, ein Einwand einen Konter. Keine Anrede an den Zuschauer ("du", "ihr"), keine Aufforderung ans Publikum. Der Zuschauer hört einem Gespräch zu und versteht die Botschaft daraus.${ctaTurnRule}`
        : `\n- ZWEI PERSONEN, DIREKTANSPRACHE: Beide sprechen zum ZUSCHAUER, nicht miteinander. Sie wechseln sich ab wie zwei Moderatoren: Jede Zeile richtet sich an das Publikum ("du"), keine Zeile fragt die andere Figur etwas, keine Zeile antwortet der anderen Figur. Sie übernehmen den Faden voneinander, statt einen Dialog zu führen.`)
    : "";

  const vlogFieldRules = vlogActive
    ? '\n- "situation": EINMAL für das ganze Reel — activity (gewöhnliche, 40+ Sekunden durchhaltbare Tätigkeit), setting (EIN konkreter Ort), outfit, cameraSetup (feste Kameraposition). Alle vier gelten unverändert für JEDE Szene.' +
      `\n- "voiceDelivery": genau einer dieser Werte: ${VOICE_DELIVERIES.map((d) => `"${d.value}"`).join(" | ")} — passend zur Tätigkeit und zum Inhalt der Zeile`
    : "";

  // Schnittart pro Übergang — aber NUR im General-Modus zur Wahl gestellt.
  // Reels werden ausnahmslos hart montiert (beide Reel-Stile), da wäre ein
  // Modell-Vorschlag „flow" ein direkter Widerspruch zur Stilvorgabe. Dort
  // entfällt das Feld komplett und der Aufrufer setzt „cut" für alle.
  const askTransition = mode !== "reel";
  const transitionSchemaLine = askTransition
    ? '\n      "transitionToNext": "flow" | "cut",'
    : "";
  const transitionFieldRule = askTransition
    ? '\n- "transitionToNext": wie diese Szene in die NÄCHSTE übergeht. "flow" = ununterbrochene Fortsetzung: gleicher Ort, gleicher Moment, die Handlung läuft direkt weiter — dann wird der Endframe dieser Szene ZUGLEICH das Startbild der nächsten, der Übergang ist unsichtbar. "cut" = harter Schnitt: Ortswechsel, Zeitsprung oder neues Kamera-Setup. Wähle "flow" nur, wenn Ort UND Moment wirklich durchlaufen — im Zweifel "cut". Bei der LETZTEN Szene ist der Wert egal.'
    : "";

  return `Du bist ein professioneller Drehbuchautor für visuelle Storyboards.

AUFGABE:
Erstelle ein einziges valides JSON-Objekt basierend auf diesen Eingaben.
KRITISCH: Das "scenes" Array MUSS EXAKT ${pointCount} Einträge enthalten. Nicht mehr, nicht weniger.

${profileBlock}EINGABEN:
- storyIdea: "${idea}"
- visualStyle: "${artStyle}"
- customDetails: "${customDetails.trim()}"
- sceneCount: ${pointCount}
- enableSceneDescription: ${enableSceneDescription}
- enableSpeaker: ${enableSpeaker}
- voiceMode: "${voiceMode}"
${voiceMode === "dialog" && enableSpeaker ? `- dialogMode: "${dialogMode}" (${dialogMode === "smart" ? "SMART: KI entscheidet pro Szene ob Dialog passt - manche Szenen können bewusst OHNE Dialog/dialogText sein wenn die Szene visuell stärker wirkt (dann dialogText leer lassen). AUSNAHME: Szene 1 hat IMMER eine gesprochene Zeile - stumme Szenen frühestens ab Szene 2" : "FORCED: JEDE Szene MUSS einen dialogText enthalten - kein leerer Dialog erlaubt"})` : ""}
- generationDirection: "${generationDirection}"
- numberOfCharacters: ${characters.length}
- videoMood: "${videoMood}" — ${getStoryMoodInstruction(videoMood, mode, reelStyle)}
- colorMood: "${colorMood}" — ${getStoryColorInstruction(colorMood, mode)}
- pacing: "${pacing}" — ${getStoryPacingInstruction(pacing, mode, reelStyle)}
- outputLanguage: "${language}" — ${getLanguageName(language)} (ALLE Texte wie summary, detailedDescription, dialogText MÜSSEN in dieser Sprache geschrieben werden)
${effectiveHook ? `- hook: "${effectiveHook}"` : ""}
${ctaLine ? `- cta: "${ctaLine}"` : ""}
${enableSpeaker ? `- speakerGender: "${speakerGender}"` : ""}
${characterBlock ? `\nCHARAKTER-REFERENZEN:\n${characterBlock}` : ""}
${reelDirective}
HARTE AUSGABEREGELN:
- Antworte ausschließlich mit einem einzigen validen JSON-Objekt.
- Das erste Zeichen deiner Antwort muss { sein.
- Das letzte Zeichen deiner Antwort muss } sein.
- Kein Markdown, keine Codeblöcke, keine Einleitung, keine Erklärung, keine Kommentare.
- Die Antwort muss mit JSON.parse() direkt parsebar sein.

INHALTSREGELN:
- Definiere zuerst einen einzigen Hauptort für die gesamte Geschichte.
- Alle Szenen spielen nur an diesem Hauptort.
${vlogActive
  ? `- Auch der konkrete Bereich innerhalb des Hauptorts bleibt in allen Szenen identisch${reelOutro && pointCount >= 3 ? " — nur die letzte Szene (Outro) darf einen anderen Bereich bzw. Kontext zeigen" : ""}.`
  : "- Nur der konkrete Bereich innerhalb des Hauptorts wechselt."}
- Alle Szenen müssen realistisch sein. Keine Fantasy, keine Magie.
${opts.actionLevel === "active"
  ? "- Jede Szene hat genau eine klare zentrale Aktion oder Gestik — und die HÄNDE führen sie sichtbar aus."
  : "- Jede Szene hat genau eine klare zentrale Aktion oder Gestik."}
- Die Szenen bauen logisch aufeinander auf.
${mode === "reel"
  ? (opts.actionLevel === "active"
      ? "- Emotionen müssen GROSS und auf einem Handy-Display sofort erkennbar sein: Augenbrauen, Augen, Mund, Kopfhaltung. Ein ausdrucksloses oder nur leicht angedeutetes Gesicht ist in jeder Szene ein Fehler."
      : "- Emotionen müssen auf einem Handy-Display erkennbar sein — über Augen, Augenbrauen und Mundwinkel, so wie man einem Gegenüber im Gespräch ansieht, was es gerade denkt. Ein ausdrucksloses Gesicht ist ein Fehler; ein aufgerissenes wäre in diesem Modus aber genauso falsch.")
  : "- Emotionen müssen visuell erkennbar sein."}
- Wenn Referenzcharaktere vorhanden sind, bleibt jeder Name fest an genau sein Referenzbild gebunden.
- Frisur, Gesicht, Kleidung, Accessoires und markante Merkmale der benannten Charaktere bleiben über alle Szenen konsistent, sofern die Geschichte keine explizite Änderung verlangt.
- Verwende in participants und dialogText nur die exakten Charakternamen aus den Referenzcharakteren.
- Erfinde niemals neue Sprecher, Platzhalternamen oder Rollenbezeichnungen wie "Mann", "Frau" oder "Person", wenn Referenzcharaktere vorhanden sind.
- Die letzte Szene soll den stärksten Payoff, Twist oder Ausblick liefern.${duoAddressRule}${oneFaceRule}
${mode === "reel" && enableSpeaker ? `
DIE LETZTE SZENE IST DER ABSCHLUSS — SIE DARF NICHT KLINGEN UND AUSSEHEN, ALS KÄME NOCH EINE:
- Szene ${pointCount} ist das Ende. Hier zählt das letzte Wort. Sie wird deshalb ERNST und mit NACHDRUCK gesprochen, nicht im Tempo und in der Aufregung der Szenen davor. Das Gewicht kommt aus der Ruhe, nicht aus der Lautstärke.
- "emotion" der letzten Szene: „Ernst", „Nachdruck" oder „Entschlossenheit". Das ist die AUSDRÜCKLICHE AUSNAHME von der Regel oben, die „ruhig" und „ernst" sonst verbietet — hier sind sie gefordert. Kein „Begeisterung", kein „Triumph", kein „Empörung".
- "keyAction" der letzten Szene: Die Geste ist ABGESCHLOSSEN und kommt zur Ruhe. Verboten ist alles, was eine Fortsetzung verspricht — kein Griff zu etwas Neuem, kein Schritt irgendwohin, kein Wegdrehen, kein Blick zur Seite, keine begonnene Handlung. Die Hände kommen ruhig zum Körper oder halten eine letzte, feste Geste; die Schultern stehen frontal zur Kamera; der Blick ist in der Linse und bleibt dort.
- Ebenfalls verboten: Winken, Daumen hoch, Abschiedsgesten, Nicken zum Abschied. Das ist Schluss, nicht Verabschiedung.
- "movement" der letzten Szene: immer "keine".
- "shotType" der letzten Szene: "close-up" oder "medium-close-up". Das Ende gehört ins Gesicht — eine weite Einstellung liest sich wie eine Szene, die noch etwas vorhat.
- "endState" der letzten Szene: ein RUHENDES Schlussbild. Die Person steht still, die Geste ist zu Ende geführt, der Blick in der Kamera. Nichts ist in Bewegung, nichts wartet auf einen nächsten Handgriff.
- "audienceEffect" der letzten Szene: die Wirkung eines Schlusspunktes — Nachhall, Klarheit, Entschlossenheit. Nicht „Neugier" und nicht „Spannung": beides kündigt an, dass es weitergeht.` : ""}
${ctaLine ? `- Die LETZTE Szene endet mit diesem Call-to-Action, gesprochen: "${ctaLine}". Formuliere ihn natürlich in den Schlusssatz des dialogText hinein — nicht als angehängte Werbezeile, nicht als eingeblendeter Text, und in KEINER anderen Szene.` : ""}

ERLAUBTE WERTE:
- cameraAngle: ${STORY_CAMERA_ANGLES.map((c) => `"${c.value}"`).join(" | ")}
- shotType: ${STORY_SHOT_TYPES.map((c) => `"${c.value}"`).join(" | ")}
- audienceEffect: ${STORY_AUDIENCE_EFFECTS.map((c) => `"${c.value}"`).join(" | ")}
- composition: ${STORY_COMPOSITIONS.map((c) => `"${c.value}"`).join(" | ")}
- movement: ${STORY_MOVEMENTS.map((c) => `"${c.value}"`).join(" | ")}

JSON-SCHEMA:
{
  "mainLocation": "string",${situationSchemaLine}
  "scenes": [
    {
      "summary": "string, max 15 Wörter",
      "participants": "string, exakte sichtbare Charakternamen kommasepariert",
      "specificArea": "string",
      "keyAction": "string",
      "emotion": "string",
      "detailedDescription": "string",
      "dialogText": "string",${speechSchemaLine}${speakerSchemaLine}
      "audienceEffect": "one of allowed values",
      "composition": "one of allowed values",
      "movement": "one of allowed values",
      "continuityNotes": "string",
      "endState": "string",${transitionSchemaLine}
      "cameraAngle": "one of allowed values",
      "shotType": "one of allowed values"${deliverySchemaLine}
    }
  ]
}

FELDREGELN:
- "summary": 1 Satz, maximal 15 Wörter
${vlogActive
  ? '- "specificArea": konkreter Bereich innerhalb des Hauptorts — in JEDER Szene wortgleich derselbe'
  : '- "specificArea": konkreter Bereich innerhalb des Hauptorts'}
${vlogActive
  ? (opts.actionLevel === "active"
      ? '- "keyAction": der nächste Handgriff der laufenden Tätigkeit, SICHTBAR MIT DEN HÄNDEN ausgeführt — konkret genug, dass ein Bildmodell ihn ohne die Szenenbeschreibung malen könnte (WAS in welcher Hand, auf welcher Höhe). Hat die Szene einen dialogText, ENDET die keyAction immer mit dem Blick in die Kamera (Muster: „drückt die Hantel hoch und schaut wieder in die Linse") — die Handlung selbst bleibt vollständig, auch wenn sie den ganzen Körper braucht. Eine Szene ohne sichtbare Handlung der Hände ist ein Fehler.'
      : '- "keyAction": der nächste natürliche Handgriff der laufenden Tätigkeit — beiläufig und alltäglich, KEIN Gag, KEIN Stunt, nichts Übertriebenes. Hat die Szene einen dialogText, ENDET die keyAction immer mit dem Blick in die Kamera (Muster: „tippt zweimal auf den Laptop und schaut wieder in die Kamera") — die Handlung selbst bleibt vollständig, auch wenn sie den ganzen Körper braucht. SIND DIE HÄNDE GERADE FREI, bleibt es trotzdem beim nächsten Handgriff der Tätigkeit — die Sprech-Geste aus dem Katalog unten ist die AUSNAHME für die wenigen Sätze, die sie wirklich verlangen (siehe dort), nicht die Regel.')
  : (opts.actionLevel === "active"
      ? '- "keyAction": genau eine zentrale sichtbare Aktion, die die HÄNDE ausführen — zeigen, hochheben, hantieren, bedienen. Hat die Szene einen dialogText, ENDET die keyAction immer mit dem Blick in die Kamera (Muster: „hält das Buch in die Linse und schaut wieder in die Kamera") — die Handlung selbst bleibt vollständig, auch wenn sie den ganzen Körper braucht.'
      : '- "keyAction": genau eine zentrale sichtbare Aktion oder Gestik. Hat die Szene einen dialogText, ENDET die keyAction immer mit dem Blick in die Kamera (Muster: „tippt zweimal auf den Laptop und schaut wieder in die Kamera") — die Handlung selbst bleibt vollständig, auch wenn sie den ganzen Körper braucht.')}
${enableSpeaker ? getSpeechGestureRules(opts.actionLevel) : ""}
- "emotion": ${mode === "reel"
  // Im Reel ist das Feld der einzige Weg, wie Gefühl ins Bild und (über
  // `deliveryForScene`) in die Stimme kommt. „klar sichtbar" allein hat das
  // Modell regelmäßig mit „konzentriert" oder „ruhig" beantwortet — beides
  // rendert als ausdrucksloses Gesicht und klingt als flache Tonspur.
  ? (opts.actionLevel === "active"
      ? 'ein STARKES, im Gesicht sofort ablesbares Gefühl — Überraschung, Ungläubigkeit, Empörung, Begeisterung, Freude, Triumph, Entsetzen, Erleichterung. NIE „neutral", „ruhig", „konzentriert" oder „sachlich", und nicht dreimal hintereinander dasselbe Gefühl'
      : 'ein LEISES, aber im Gesicht lesbares Gefühl — Interesse, Nachdenklichkeit, Zuversicht, Wärme, Neugier, leichte Überraschung, Amüsiertheit, Ernst, Erleichterung. NIE „neutral", „ausdruckslos" oder „sachlich" (ein leeres Gesicht ist auch hier ein Fehler), aber auch nichts Aufgerissenes wie Entsetzen, Empörung oder Triumph. Nicht dreimal hintereinander dasselbe Gefühl')
  : "klar sichtbar und visuell darstellbar"}
${mode === "reel" ? `- "movement": in Sprech-Szenen fast immer "keine". HÖCHSTENS jede dritte Szene bekommt "dolly-in" (langsamer Zoom zur Bildmitte) als Akzent — nie zwei hintereinander, und nie in Szene 1. ALLE anderen Werte (pan, tilt, truck, crane, arc, dolly-out) sind in Sprech-Szenen verboten: Die Sprecher-Maske des Videomodells ist starr und wandert bei einer Seitwärts- oder Schwenkbewegung nicht mit — dann bewegt der Falsche den Mund.
` : ""}- "detailedDescription":
  - falls enableSceneDescription = true: ausführliche visuelle Beschreibung, 3-4 Sätze — Umgebung, Licht, Requisiten und Handlung. Bei Szenen mit dialogText legt sie KEINE vom Kamerablick abweichende Blickrichtung fest („schaut aus dem Fenster", „von der Seite gesehen" sind dort verboten).
  - KEINE SCHRIFT IM BILD: Schlage keine Requisiten oder Ausstattung vor, deren Zweck das Lesen ist — kein Schild, kein Poster, kein Plakat, kein Buchtitel, keine beschriftete Verpackung, kein Whiteboard, keine Notiz, keine Leuchtreklame. Bildmodelle schreiben Text ohnehin fehlerhaft, und im Video flackert er zwischen den Frames. Geräte als Requisite (Handy, Laptop) bleiben ausdrücklich erlaubt — nur ihr Inhalt wird nicht als lesbarer Text beschrieben.
  - falls enableSceneDescription = false: "(wird vom Nutzer manuell erstellt)"
- "dialogText":
  - nur ausgeben, falls enableSpeaker = true
  - falls voiceMode = "sprecher": ${vlogActive
    ? `Schreibe die Zeile, die die sichtbare Person SELBST in die Kamera sagt: gesprochene Creator-Sprache, direkt und aktivierend (2. Person „du" erlaubt), ${DIALOG_WORD_BUDGET}. Die Zeile ist in DIESEM Clip fertig gesprochen und endet an einem echten Satzzeichen: mit Punkt, Frage- oder Ausrufezeichen, oder mit Komma, wenn der Gedanke in der nächsten Szene weitergeht — im Zweifel Punkt, höchstens jede zweite Zeile endet auf Komma. NIE auf einem blanken „und", „aber", „weil", „damit", „dass", nie auf einem Artikel oder Relativpronomen, nie auf Doppelpunkt, Gedankenstrich oder Auslassungspunkten. Die letzte Szene endet immer mit Punkt, Frage- oder Ausrufezeichen — nie mit Komma. KEIN Dialog zwischen Personen, KEIN Sprechername vor der Zeile.`
    : mode === "reel"
    ? `Schreibe die Off-Sprecher-Zeile des Reels: gesprochene Creator-Sprache, direkt und aktivierend (2. Person „du" erlaubt), ${DIALOG_WORD_BUDGET}. Die Zeile ist in DIESEM Clip fertig gesprochen und endet an einem echten Satzzeichen: mit Punkt, Frage- oder Ausrufezeichen, oder mit Komma, wenn der Gedanke in der nächsten Szene weitergeht — im Zweifel Punkt, höchstens jede zweite Zeile endet auf Komma. NIE auf einem blanken „und", „aber", „weil", „damit", „dass", nie auf einem Artikel oder Relativpronomen, nie auf Doppelpunkt, Gedankenstrich oder Auslassungspunkten. Die letzte Szene endet immer mit Punkt, Frage- oder Ausrufezeichen — nie mit Komma. KEIN Dialog zwischen Personen.`
    : "Schreibe einen Erzähler-/Voiceover-Text in der 3. Person oder als Off-Stimme. KEIN Dialog zwischen Personen."}
  - falls voiceMode = "dialog":
${dialogueRule}${speechFieldRule}
- "continuityNotes": kurze Notiz zu Kleidung, Haaren, Accessoires, Requisiten oder Sprecherzuordnung${speakerFieldRule}${vlogFieldRules}
- HANDLUNGSFORTSCHRITT (gilt für ALLE Szenen, wichtigste Regel dieser Liste): Jede Szene beginnt in dem Zustand, in dem die vorige laut ihrem "endState" geendet hat. Was eine Szene erreicht hat, ist erreicht und wird nie zurückgedreht. Setzt eine Szene einen Vorgang in Gang, zeigt die nächste dessen FORTSETZUNG oder ERGEBNIS — nie wieder den Ausgangspunkt.
  Beispiel: Szene 1 „geht eine Treppe hinauf" → Szene 2 zeigt sie WEITER OBEN auf der Treppe oder bereits angekommen. Szene 2 darf sie NICHT wieder unten an der Treppe stehen und reden lassen.
  Das gilt auch über einen harten Schnitt hinweg: der Schnitt darf den Blickwinkel, den Ort oder die Zeit wechseln, aber niemals den erreichten Fortschritt zurücknehmen. Wechselt eine Szene bewusst den Ort, muss die Person dort plausibel angekommen sein — nicht an einen früheren Punkt zurückversetzt.
- "endState": der sichtbare Zustand am ENDE dieser Szene, nachdem die keyAction ausgeführt wurde — als STANDBILD beschrieben, nie als Handlung. Wo steht/sitzt die Person jetzt, wie ist ihre Haltung, wohin schaut sie, wo liegen die Requisiten. Bei Szenen mit dialogText ist der Blick am Ende immer in der Kamera. Beispiel: keyAction „greift zur Tasse" → endState „Tasse in der rechten Hand auf Brusthöhe, Blick zur Kamera, Untersetzer leer". Aus diesem Feld wird der ENDFRAME des Clips gerendert: er muss zur keyAction passen und aus demselben Kamerawinkel wie das Startbild gesehen sein.${transitionFieldRule}

WICHTIG:
- Wenn enableSpeaker = false, lass "dialogText" als leeren String.
- Die Anzahl der Szenen muss exakt ${pointCount} entsprechen.
- Gib jetzt nur das JSON zurück.`;
}

export function buildSceneImagePrompt(opts: {
  scene: StoryScene;
  mode: StoryMode;
  mainLocation: string;
  artStyle: string;
  colorMood: string;
  videoMood: string;
  characters: StoryCharacter[];
  hasReferences: boolean;
  hasPrevImage: boolean;
  aspect: string;
  /** Reel-Format: "dialog" = Person spricht in die Kamera (Talking-Head-Frame),
   *  "sprecher" = Off-Stimme, Person handelt nur. Default "sprecher". */
  voiceMode?: "sprecher" | "dialog";
  /**
   * Wird diese Szene über Kling `ai-avatar` gerendert? Kommt als EINE Quelle aus
   * StoryPage (`sceneUsesTalkingAvatar`).
   *
   * Warum durchgereicht und nicht hier hergeleitet: die Bedingung hängt an
   * `voiceLock` und `enableSpeaker`, und beide kommen hier gar nicht an —
   * `enableSpeaker: false` wird am Aufrufer bereits zu `voiceMode: "sprecher"`
   * verschliffen. Nachbauen ginge also nur raten.
   *
   * Ohne Angabe bleibt die alte Formel gültig, damit Altaufrufe sich nicht ändern.
   */
  talkingAvatar?: boolean;
  /** Reel-Stil. Ohne Angabe (bzw. "explainer") ist die Ausgabe exakt wie bisher. */
  reelStyle?: ReelStyle;
  /**
   * Aktions-Level. Ohne Angabe (bzw. "calm") ist die Ausgabe exakt wie bisher.
   *
   * Er modifiziert AUSSCHLIESSLICH §2 (Darstellung) und §3 (Ton) — niemals §1.2:
   * Es gibt genau EINEN Vorranganspruch im Prompt, und ein zweiter würde beide
   * neutralisieren (siehe die Begründung am Kopf des Reel-Zweigs).
   */
  actionLevel?: ActionLevel;
  /** Die durchgehende Situation des Vlog-Reels — wortgleich in jedem Frame. */
  situation?: ReelSituation | null;
  /** Vlog-Outro: DIESER Frame darf bewusst in einen anderen Kontext schneiden. */
  isOutro?: boolean;
  /**
   * DIES IST DER HOOK-FRAME (Szene 1 eines Reels).
   *
   * Warum er eine eigene Behandlung braucht: Bei Sprech-Szenen rendert Kling
   * `ai-avatar`, und das kennt überhaupt keinen Prompt — dieses Standbild ist
   * die EINZIGE Steuerung dafür, wie die Person im Clip aussieht. Der erste Clip
   * entscheidet, ob weitergeschaut wird; ein höflich lächelndes Gesicht in
   * Frame 1 ist dort teurer als überall sonst.
   *
   * Bewusst KEIN zweiter Vorranganspruch (§1.2 bleibt der einzige): die Zeile
   * verstärkt nur den Ausdruck, sie überschreibt keine Handlung.
   */
  isHookScene?: boolean;
  /**
   * Die LETZTE Szene des Reels — das Schlussbild.
   *
   * Gegenstück zu `isHookScene`, und aus demselben Grund unverzichtbar: Bei
   * Sprech-Szenen rendert `ai-avatar` den Clip allein aus diesem Standbild. Der
   * Video-Prompt, der für die letzte Szene längst „Land the final beat cleanly"
   * sagt, wird auf dieser Strecke gar nicht gelesen — steht die Haltung nicht
   * IM BILD, gibt es sie im Clip nicht.
   *
   * Ohne die Zeile sah die Schlussszene aus wie jede andere: Person mitten in
   * einer Geste, Körper halb weggedreht, als käme gleich die nächste. Ein Reel
   * hört so nicht auf, es bricht ab.
   */
  isLastScene?: boolean;
  /**
   * Die vorige Szene — als TEXT, nicht nur als Referenzbild.
   * Ohne sie weiß das Modell nicht, was gerade geschehen ist, und lässt
   * Requisiten aus dem Nichts auftauchen. Nur im Reel-Modus wirksam.
   */
  /** `speaker`/`dialogText` gehören dazu, damit der Gegenschuss erkennbar ist:
   *  wechselt der Sprecher, muss die Kamera auf die andere Seite springen. */
  prevScene?: Pick<StoryScene, "keyAction" | "summary" | "continuityNotes" | "endState" | "speaker" | "dialogText"> | null;
  /**
   * WOHER das Kontinuitäts-Referenzbild stammt.
   * • "sceneStill"   (Default) — das generierte STARTBILD der Vorszene. Das ist
   *   der Zustand VOR deren Handlung: steht die Person in Clip N auf, zeigt
   *   dieses Bild sie noch sitzend. Bisheriges Verhalten, byte-identisch.
   * • "clipEndFrame" — der LETZTE Frame des fertigen Clips der Vorszene, also
   *   der Zustand NACH der Handlung. Nur damit kann Szene N+1 dort anfangen,
   *   wo Clip N aufgehört hat.
   * • "ownStartFrame" — das GENERIERTE STARTBILD DIESER Szene. Nur für den
   *   Endframe-Lauf (`frameKind: "end"`): dort ist das Referenzbild dieselbe
   *   Einstellung, Sekunden früher, und muss deshalb für Gesicht, Crop, Licht
   *   und Outfit BINDEND sein — genau umgekehrt zu den beiden Fällen oben.
   * Ändert AUSSCHLIESSLICH den Wortlaut der Referenzkarte und des
   * Anschlussblocks — nie die Reihenfolge der Bilder.
   */
  /** `stagePlate` = die menschenleere Bühnen-Aufnahme dieser Kameraposition.
   *  Sie ersetzt bei zwei Personen das Vorgängerbild als Anschluss-Referenz.
   *
   *  `nextSceneStill` = das Bild der NÄCHSTEN Szene. Kommt vor, wenn eine Szene
   *  einzeln neu erzeugt wird und keinen Vorgänger hat (typisch: Szene 1). Es
   *  ist für Raum, Licht und Kleidung genauso bindend wie ein Vorgängerbild —
   *  für den Handlungsstand aber das Gegenteil: es zeigt einen SPÄTEREN Moment,
   *  aus dem nichts übernommen werden darf, sonst nimmt der Frame die Handlung
   *  seiner eigenen Szene vorweg. */
  prevImageKind?: "sceneStill" | "clipEndFrame" | "ownStartFrame" | "stagePlate" | "nextSceneStill";
  /**
   * Welchen Frame der Szene dieser Prompt beschreibt.
   * • "start" (Default) — das Startbild: der Moment, BEVOR die keyAction
   *   ausgeführt ist. Exakt das bisherige Verhalten.
   * • "end" — der Endframe derselben Einstellung: gleiche Kamera, gleicher Ort,
   *   gleiche Person, nur nach der Handlung (`scene.endState`). Veo bekommt
   *   beide Frames und rendert die Bewegung dazwischen.
   */
  frameKind?: "start" | "end";
  /**
   * Für welche der Abgewandten eine RÜCKEN-REFERENZ als Bild mitgeht — in
   * genau dieser Reihenfolge hängt StoryPage die Bilder hinter die Gesichts-
   * Anker. Wer hier fehlt, wird weiterhin nur in Worten beschrieben.
   */
  backRefNames?: string[];
  /**
   * Retry index (0 = first try). Each background retry varies and softens the
   * prompt: scene text is run through the content-safety filter and a reword /
   * re-frame nudge plus the positive safe-portrait guarantee are appended, so a
   * prompt that tripped a safety / recitation false-positive has a fresh shot.
   */
  attempt?: number;
}): string {
  const { scene, mode, mainLocation, artStyle, colorMood, videoMood, characters, hasReferences, hasPrevImage, aspect } = opts;
  const prevScene = opts.prevScene ?? null;
  /**
   * Wo die Vorszene GEENDET hat — als Zustand, nicht als Handlung.
   *
   * `keyAction` beantwortet „was hat die Person getan", `endState` beantwortet
   * „wo steht sie jetzt und wie". Für den Anschluss zählt nur das zweite: nach
   * „geht die Treppe hinauf" ist die relevante Information nicht das Gehen,
   * sondern dass sie oben ist. Ohne diese Zeile setzt die Folgeszene wieder am
   * Ausgangspunkt an und die Person steht plötzlich wieder unten.
   */
  const prevEndState = prevScene?.endState?.trim() || "";
  const attempt = opts.attempt ?? 0;
  // Nur wirksam, wenn auch wirklich ein Vorgängerbild mitgeschickt wird —
  // sonst behauptete die Karte einen Frame, der gar nicht im Request steckt.
  const prevIsEndFrame = opts.prevImageKind === "clipEndFrame" && hasPrevImage;
  // Endframe-Lauf: das Referenzbild ist das eigene Startbild dieser Einstellung.
  // Muss vor beiden Modus-Zweigen stehen — die Referenzkarte gibt es zweimal.
  const prevIsOwnStartFrame = opts.prevImageKind === "ownStartFrame" && hasPrevImage;
  const style = STORY_ART_STYLES.find((a) => a.value === artStyle);
  const styleLine = style?.english || artStyle;
  const stylized = isStylizedArtStyle(artStyle);
  // Vlog-Reel: EINE durchgehende Aufnahme, aus der nur Zeit herausgeschnitten
  // wurde. Ohne dieses Flag bleibt jede Zeile unten exakt wie bisher.
  const vlogActive = mode === "reel" && opts.reelStyle === "vlog";
  const situation = vlogActive ? (opts.situation ?? null) : null;
  const isOutro = vlogActive && !!opts.isOutro;
  // Erklär-Reel (reelStyle "explainer" ODER gar nicht gesetzt — der Default).
  // Braucht seinen EIGENEN Zweig, weil die Vorrang-Hierarchie jetzt für beide
  // Reel-Stile gilt, `mode === "general"` aber Zeichen für Zeichen unverändert
  // bleiben muss: die alten Zeilen dürfen nur noch der Story-Modus sehen.
  const explainerActive = mode === "reel" && !vlogActive;
  // Aktions-Level (siehe `ActionLevel`). Wirkt NUR in §2 und §3 und immer als
  // QUALIFIZIERER der ACTION-Zeile, nie als eigener Vorranganspruch. Der
  // Story-Modus (`mode === "general"`) sieht ihn gar nicht — dort bleibt jede
  // Zeile Zeichen für Zeichen die alte.
  const actionActive = mode === "reel" && opts.actionLevel === "active";
  // Erklär-Reel mit sprechender Person: der Frame zeigt die Person MITTEN im
  // Sprechen in die Linse — sonst kann das Video-Modell daraus keinen
  // Talking-Head animieren.
  //
  // SEIT DER AI-AVATAR-UMSTELLUNG ist das die wichtigste Weiche der Datei: sie
  // schaltet Mundbild UND Blickvorgabe im Standbild ein, und genau dieses
  // Standbild ist bei `ai-avatar` die EINZIGE Bildquelle des Clips.
  //
  // Die alte Formel deckte den Normalfall nicht ab: Reel + Erzähler-Stil +
  // voiceMode "sprecher" (die Defaults!) ergab `false`, obwohl die Szene über
  // ai-avatar läuft und die Person darin sichtbar spricht. Das Bild wurde also
  // ohne Sprech- und ohne Blickzeile erzeugt und danach lippensynchronisiert —
  // die Ursache für „die Person schaut nicht in die Kamera".
  // Deshalb entscheidet jetzt der durchgereichte Wert; die alte Formel bleibt
  // nur als Rückfall für Aufrufer ohne das Feld.
  const talkingHead = opts.talkingAvatar
    ?? (mode === "reel" && !!scene.dialogText?.trim()
      && (vlogActive || opts.voiceMode === "dialog"));

  // Kamerawerte dieser Szene, bei Sprech-Szenen auf blicktaugliche geklemmt.
  // MUSS hier passieren und nicht nur in den Storyboard-Guards: die laufen genau
  // einmal direkt nach der Generierung, während `voiceMode`, `voiceLock` und
  // `reelStyle` danach umschaltbar bleiben und der Detail-Dialog weiterhin JEDEN
  // Winkel zur Auswahl anbietet. Ein nachträglich auf "over-shoulder" gestellter
  // Wert ginge sonst ungefiltert in das Bild, aus dem ai-avatar den Clip macht.
  // WER ist im Bild und WER spricht — beides aus einer Quelle (`resolveSceneCast`),
  // damit Bild, Video und Stimme nicht zu verschiedenen Antworten kommen.
  //
  // Vorher stand hier eine eigene Rechnung, die den Sprecher NUR im Dialog-Modus
  // aus dem `"Name: …"`-Präfix zog. Im Reel-Standard (voiceMode „sprecher") war
  // sie damit immer leer, und der Prompt sagte bei zwei Personen bloß „the main
  // subject facing the camera" — welche der beiden, blieb dem Modell überlassen.
  // Jetzt trägt das Storyboard ein validiertes `scene.speaker`, und das Präfix
  // ist nur noch der Rückfall für Altprojekte.
  //
  // Muss VOR den Kamerawerten stehen: ob `over-shoulder` erlaubt ist, hängt
  // davon ab, ob überhaupt jemand zweites im Bild ist.
  const cast = resolveSceneCast(scene, characters);
  // Wessen Gesicht als BILD mitgeht und wer nur in Worten beschrieben wird —
  // dieselbe Quelle wie in StoryPage, sonst zeigen die „Image N"-Karten auf
  // Bilder, die gar nicht mitgeschickt wurden.
  const plan = sceneAnchorPlan(scene, characters, opts.prevScene ?? null);
  /**
   * GRUPPENBILD: mehr als ein Anker-Foto liegt im Request — jede Person im Bild
   * hat ihr eigenes. `sceneAnchorPlan` gibt das ausschliesslich für STUMME
   * Mehr-Personen-Szenen zurück (Begründung dort).
   *
   * Diese eine Variable schaltet alle Stellen um, die sonst „genau ein Gesicht,
   * genau ein Referenzfoto" behaupten würden. Sie müssen zusammen kippen: ein
   * Prompt mit zwei Ankern und der Zeile „ONE FACE ONLY" widerspricht sich
   * selbst, und das Modell löst den Widerspruch dann selbst auf — schlimmsten-
   * falls, indem es ein Gesicht aus beiden Ankern mischt.
   */
  const multiAnchor = plan.anchorNames.length > 1;
  /**
   * WOHER DIE KLEIDUNG KOMMT — genau eine Quelle pro Prompt.
   *
   * Zwei Kleidungsangaben nebeneinander sind ein Widerspruch, und den löst das
   * Modell selbst auf. Deshalb steht die Entscheidung hier oben und schaltet
   * ALLE drei Stellen gemeinsam: die Anker-Karte, den Gruppenbild-Block und die
   * WARDROBE-Zeile.
   *
   * • Vlog mit `situation.outfit` → das reelweite Outfit aus THE SHOOT.
   * • Sonst → das Anker-Foto der jeweiligen Person.
   *
   * Die Anker-Karte nannte Kleidung bisher gar nicht: sie zählt auf, was aus dem
   * Bild zu übernehmen ist (Gesicht, Kopfform, Haaransatz, Haar-/Augenfarbe,
   * Merkmale) — und eine Aufzählung, die Kleidung auslässt, liest ein Modell als
   * „die ist hier nicht gebunden". Am Storyboard belegt: die Duo-Szenen, deren
   * Karte „build and clothing" ausdrücklich nennt, trafen die Referenzfotos; das
   * stumme Gruppenbild daneben zog denselben Personen andere Oberteile an.
   */
  const outfitFromSituation = !!situation?.outfit?.trim();
  /**
   * Die vom NUTZER gewählte Garderobe der Anwesenden, als ein Satz.
   *
   * Nur die Personen, die in dieser Szene vorkommen, und nur die mit gesetztem
   * Wert — wer nichts hinterlegt hat, bekommt keine erfundene Vorgabe, sondern
   * fällt unten auf „passend zum Ort, einmal gewählt" zurück.
   */
  const chosenOutfits = characters
    .filter((c) => (c.outfit || "").trim() && cast.framePeople.some((n) => nameKey(n) === nameKey(c.name)))
    .map((c) => `${c.name} wears ${(c.outfit || "").trim()}`)
    .join("; ");
  const speakerName = talkingHead ? cast.speaker : "";
  /**
   * Sprach in der VORIGEN Szene jemand anderes? Dann ist dieses Bild der
   * Gegenschuss.
   *
   * Ohne diese Information plante jede Szene ihre Einstellung für sich, und bei
   * einem Wortwechsel blieb dieselbe Person vorne stehen — im Bild sah man
   * Leo reden, obwohl laut Zeile Tim dran war. Genau das ist der fehlende
   * Kameraschnitt: Wer spricht, kommt nach vorn; wer eben noch sprach, wird zur
   * Schulter.
   */
  const prevSpeaker = (() => {
    const p = opts.prevScene;
    if (!p) return "";
    const names = characters.map((c) => c.name.trim()).filter(Boolean);
    return matchCharacterName(p.speaker || "", names)
      || matchCharacterName(splitDialogLine(p.dialogText || "", names).speaker, names);
  })();
  /**
   * WESSEN Gesicht zeigt dieses Bild? Es muss IMMER ein Name sein, sobald mehr
   * als eine Person im Frame steht.
   *
   * Vorher stand ohne ermittelbaren Sprecher nur „the speaker" im Prompt — und
   * das Modell wählte dann selbst, und zwar durchgehend dieselbe Person (die mit
   * dem ersten Anker-Bild). Genau so entstanden drei Bilder hintereinander mit
   * Leo vorne, obwohl in der mittleren Szene Tim die Zeile hatte.
   *
   * Reihenfolge: das validierte Feld, sonst das Dialogpräfix (beides über
   * `resolveSceneCast`), sonst — bei zwei Personen — die Person, die zuletzt
   * NICHT gesprochen hat (ein Wortwechsel alterniert), sonst die erste im Bild.
   */
  const focusPerson = plan.focus;
  const isReverseAngle = !!(focusPerson && prevSpeaker && nameKey(prevSpeaker) !== nameKey(focusPerson));
  /** Alle Anwesenden ausser der Person, deren Gesicht das Bild zeigt. */
  const backsToCamera = cast.framePeople.filter((n) => nameKey(n) !== nameKey(focusPerson));

  // Zurückgebaut (Nutzerentscheid): kein Solo-zuerst, keine Off-Screen-
  // Erklärung, kein Canvas-Komposit mehr. Die Szene wird wieder in EINEM Wurf
  // generiert, so wie ursprünglich — die Ein-Gesicht-Regel bleibt als knappe
  // Vorgabe im Prompt, die Komposition entscheidet das Modell.
  const effFramePeople = cast.framePeople;

  /**
   * EIN GESICHT — die eine Regel, die bleibt.
   *
   * Bewusst KURZ und ohne Layout-Vorschriften (Nutzerentscheid nach mehreren
   * Fehlversuchen): Die detaillierten Fassungen — Achsen-Geometrie, „unten
   * rechts angeschnitten", erzwungene over-shoulder-Kamera, Off-Screen-
   * Erklärungen — haben die Komposition zerlegt, statt sie zu retten
   * (Ganzfiguren vor der Wand, schwebende Arme, Sprecher am Bildrand). Die
   * Szene wird wieder normal komponiert wie ursprünglich; das Modell
   * entscheidet WIE — nur das Ergebnis ist festgelegt: genau ein Gesicht.
   *
   * AUSNAHME (siehe `multiAnchor`): die STUMME Mehr-Personen-Szene. Dort sind
   * beide Gesichter gewollt, beide Anker gehen mit, und derselbe Block sagt
   * stattdessen, welches Gesicht aus welchem Anker kommt. Stumme Szenen mit nur
   * EINEM Anker (Sprech-Szenen ohne erkannten Sprecher, Altprojekte) bleiben
   * beim Ein-Gesicht-Text.
   */
  const oneFaceBlock = effFramePeople.length <= 1
    ? ""
    // STUMMES GRUPPENBILD: hier ist die Ein-Gesicht-Regel nicht bloss unnötig,
    // sie war der Fehler. Beide Gesichter sind gewollt (so verlangt es die
    // Storyboard-Direktive für Szenen ohne dialogText), beide Anker liegen im
    // Request — es fehlt nur der Satz, der jedes Gesicht an SEINEN Anker bindet.
    // Ohne ihn mischt das Modell die beiden Vorlagen zu einer Person.
    : multiAnchor
    ? `EVERY FACE HAS ITS OWN ANCHOR: nobody speaks in this frame, so ${effFramePeople.join(" and ")} ` +
      `may ${effFramePeople.length === 2 ? "both" : "all"} be seen face-on in the same picture — that is what this ` +
      // Beim reelweiten Vlog-Outfit darf hier KEINE zweite Kleidungsquelle
      // stehen — sonst behauptet derselbe Prompt an drei Stellen etwas anderes.
      `scene is for. Each face, hair, build${outfitFromSituation ? "" : " and outfit"} ` +
      `comes from THAT person's own identity anchor image and from nowhere else: never blend two anchors, ` +
      `never put one person's face, hairline or hair colour on the other, never render the same face twice — no ` +
      `twins, no lookalikes. They are clearly different people and must stay recognisable side by side. Nobody is ` +
      `mid-sentence: no open speaking mouth shape (a natural closed-mouth smile is fine).`
    : `ONE FACE ONLY: exactly ONE face is visible in this picture — ${focusPerson || "the main subject"}'s, turned ` +
      `towards the camera, sharp and clearly readable. ${backsToCamera.join(" and ")} ` +
      `${backsToCamera.length === 1 ? "is" : "are"} in the scene too, but seen from behind or turned away — back of ` +
      `the head, a shoulder, a back. Never their face: no profile, no half-profile, no reflection. Compose the scene ` +
      `naturally; how you stage this is up to you, but two visible faces in one frame is wrong.` +
      (isReverseAngle
        ? ` In the previous shot ${prevSpeaker} was the one facing the camera — now ${focusPerson} is: the camera has ` +
          `cut to the other side of the conversation.`
        : "");
  // Kamera nur noch KLEMMEN (blickfeindliche Werte), nichts mehr erzwingen —
  // die frühere over-shoulder-Pflicht samt Kompositions-Umbau gehörte zu den
  // zurückgebauten Layout-Vorschriften.
  const cam = talkingHead
    ? { ...scene, ...gazeSafeCamera(scene, { peopleInFrame: effFramePeople.length, nearOnly: !vlogActive, actionLevel: opts.actionLevel }) }
    : scene;

  // On retries, strip anything that could trip a content-safety false-positive
  // out of the free-text scene fields before they go into the prompt.
  // scope "scene": die für Portrait-Wünsche gebauten deutschen Homonym-Regeln
  // (\bschritt\b, \bpo\b) würden hier alltägliche Storyboard-Wörter ersatzlos
  // löschen („macht einen Schritt zur Kamera" → „macht einen zur Kamera") und
  // damit die ACTION verstümmeln, die der Prompt gerade rendern soll.
  const soften = (s: string) => (attempt > 0 ? sanitizeText(s, { scope: "scene" }).clean : s);

  // NUR die Anwesenden — vorher zählte diese Zeile ausnahmslos alle Charakter-
  // karten des Projekts auf, auch in einer Szene mit einer einzigen Person.
  // „Characters present in this scene: Anna, Ben" neben „In this frame: Anna"
  // sind zwei Aussagen über dasselbe, und das Modell folgte mal der einen, mal
  // der anderen — Ben tauchte dann als zweites Gesicht auf.
  const charBlock = effFramePeople.length > 0
    ? `Characters present in this scene (lock each identity strictly to their IDENTITY ANCHOR image, listed below): ${effFramePeople.join(", ")}.`
    : "";

  // Explicit, ordered map of the inline reference images so the model never
  // mistakes the (possibly already-drifted) previous frame for the real avatar.
  // The LABELS — not the order — are what stop the drift: the previous frame is
  // marked "continuity only, never a face". Order MUST match how StoryPage pushes
  // the images: one identity anchor per character first, previous frame last.
  //
  // Die Anker-Karten sind in JEDEM Modus wortgleich. Im Reel-Pfad sind sie nach
  // dem Umbau die EINZIGE Stelle, an der die Merkmalskette („face, head shape,
  // hairline, hair & eye colour and distinctive features") noch steht — der
  // IDENTITY LOCK weiter unten nennt sie nicht mehr. Sie entstehen unabhängig
  // von `hasReferences`, also genau dann, wenn es überhaupt Charaktere gibt:
  // damit kann die Kette nicht versehentlich ganz aus dem Prompt fallen.
  //
  // Zwei Ergänzungen gegen Gesichts-Vermischung bei mehreren Personen:
  //  • Geschlecht und Kurzbeschreibung stehen mit in der Karte. Sie sind eine
  //    ZWEITE, vom Bild unabhängige Zuordnungsspur — bei zwei ähnlich
  //    aussehenden Figuren oft der einzige Unterschied, den das Modell in Worten
  //    fassen kann. (Die Oberfläche verspricht das ohnehin, siehe Hinweistext an
  //    den Charakterkarten.)
  //  • Wer in dieser Szene NICHT vorkommt, wird ausdrücklich als abwesend
  //    markiert. Ein unkommentiertes Anker-Bild einer abwesenden Person liest
  //    sich sonst wie eine Aufforderung, sie mitzumalen.
  //  • NUR das Gesicht der Fokus-Person geht als BILD mit (siehe
  //    `sceneAnchorPlan`). Zwei Gesichter im selben Request vermischt das Modell
  //    — Haarfarbe des einen am Kopf des anderen, und über die Szenen driftet es
  //    weiter. Wer nur den Rücken zeigt, wird stattdessen in WORTEN beschrieben:
  //    für einen Hinterkopf genügt das, und sein Gesicht kann gar nicht erst ins
  //    Bild geraten.
  const anchorChars = characters.filter((c) => plan.anchorNames.some((n) => nameKey(n) === nameKey(c.name)));
  const traitsOf = (c: StoryCharacter) => [c.gender, (c.description || "").trim()].filter(Boolean).join(", ");
  /**
   * DAS PORTRÄT KLEIDET NIEMANDEN EIN.
   *
   * Kurzzeitig band diese Karte auch die Kleidung ans Anker-Foto. Das war über
   * die Szenen zwar konsistent, aber konsistent falsch: das Referenzfoto ist ein
   * Porträt, und was jemand darauf trägt, ist Zufall der Aufnahme — ein
   * Bademantel aus einem Urlaubsbild landete so in einem Home-Office-Reel, und
   * der Nutzer hatte keinen Hebel dagegen (Nutzerentscheid 2026-08-10: „das ist
   * ja nur das Portraitbild und das muss egal sein, was sie anhat").
   *
   * Aus dem Foto kommt die IDENTITÄT. Die Kleidung kommt aus der Garderoben-
   * Zeile weiter unten — und die speist sich aus dem, was der Nutzer gewählt hat.
   */
  // Der Schlusssatz der Karte hängt daran, ob ein ZWEITES Gesichtsfoto im
  // Request liegt. „It is the ONLY face reference in this request" wäre beim
  // Gruppenbild schlicht gelogen — und eine falsche Aussage über den Inhalt des
  // Requests ist genau die Einladung, die beiden Vorlagen zu verrechnen.
  const anchorLines: string[] = anchorChars.map((c, i) =>
    `Image ${i + 1}: the IDENTITY ANCHOR for ${c.name}${traitsOf(c) ? ` (${traitsOf(c)})` : ""} — bind ${c.name}'s face, head shape, hairline, hair & eye colour, distinctive features and build strictly and only to THIS image. ` +
    // Der eine Satz, der das Porträt auf seine Aufgabe begrenzt.
    `It is a PORTRAIT, not a costume reference: whatever ${c.name} happens to be wearing in it is irrelevant here and must NOT be reproduced — the clothing comes from the WARDROBE line below. ` +
    (multiAnchor
      ? `It is the only face reference for ${c.name}; never take ${c.name}'s features from any other image in this request, and never give ${c.name}'s features to anybody else. `
      : "It is the ONLY face reference in this request. ") +
    // Anker sind Porträts, oft an einem ganz anderen Ort aufgenommen. Ohne
    // diesen Satz wandert deren Umgebung mit ins Bild — im Duo-Pfad genau so
    // belegt (Schnee-Panorama im Home-Office).
    `Take only the person from it — never its background, its room or its lighting.`,
  );
  // Die Abgewandten: kein GESICHTS-Foto, aber — wenn vorhanden — ihre
  // RÜCKEN-REFERENZ (einmal pro Charakter erzeugt, zeigt Haare/Statur/Kleidung
  // von hinten, enthält konstruktionsbedingt kein Gesicht). Nur mit einer
  // Wortbeschreibung erfand das Modell Haarfarbe und Outfit neu — genau der
  // gemeldete Fehler. Ohne Rücken-Referenz (noch nicht erzeugt, Altprojekt)
  // bleibt die Wortbeschreibung der Rückfall.
  const describedChars = characters.filter((c) => plan.describedNames.some((n) => nameKey(n) === nameKey(c.name)));
  const backRefNames = (opts.backRefNames ?? []).map((n) => nameKey(n));
  const backRefChars = describedChars.filter((c) => backRefNames.includes(nameKey(c.name)));
  const wordOnlyChars = describedChars.filter((c) => !backRefNames.includes(nameKey(c.name)));
  // Bildkarten der Rücken-Referenzen — sie stehen DIREKT hinter den Gesichts-
  // Ankern, in genau der Reihenfolge, in der StoryPage die Bilder anhängt.
  const backRefLines: string[] = backRefChars.map((c, i) => {
    const traits = traitsOf(c);
    return `Image ${anchorChars.length + i + 1}: the BACK-VIEW reference for ${c.name}${traits ? ` (${traits})` : ""} — ` +
      `binding for ${c.name}'s hair colour, hair length, build and clothing as seen from behind. It deliberately ` +
      `contains NO face; never invent one for it. In this scene ${c.name} appears exactly like this: from behind.`;
  });
  const describedLines: string[] = wordOnlyChars.map((c) => {
    const traits = traitsOf(c);
    return `${c.name} is in this scene but seen ONLY from behind — there is deliberately no reference image for ` +
      `${c.name}, and none is needed: render them from the back${traits ? ` as ${traits}` : ""}. Match hair colour, ` +
      `hair length and clothing to that description; the back of the head, the shoulders and the build are what has ` +
      `to be right. Never show their face, and never take their features from the anchor image above — that face ` +
      `belongs to ${plan.focus || "the other person"} alone.`;
  });
  const prevRefIdx = anchorChars.length + backRefChars.length + 1;

  // The single most important line: capture the DECISIVE MOMENT of the scene.
  // Not the setup, not the aftermath — the visual beat that tells the audience
  // what is happening right now.
  const action = soften(scene.keyAction || scene.summary || "");
  const emotion = soften(scene.emotion || "");
  const detailed = soften(scene.detailedDescription || "");

  // ══════════════════════════════════════════════════════════════════════════
  // REEL-PFAD (vlog UND explainer) — eigenes Skelett, PRIMACY statt RECENCY.
  //
  // WARUM EIN EIGENER ZWEIG: `mode === "general"` muss Zeichen für Zeichen
  // unverändert bleiben (die letzte verbliebene Byte-Identitäts-Zusage). Der
  // Story-Modus stand mit seinem Vorrangsatz auf Zeile 5 von 28 ohnehin schon
  // im Ziel — jede Umstellung dort wäre reines Risiko ohne Ertrag. Der neue
  // Bauplan lebt deshalb hier, der General-Zweig behält seine Emit-Reihenfolge
  // unten unverändert.
  //
  // WARUM DER UMBAU (gemessen, nicht vermutet): Der zusammengebaute Vlog-Prompt
  // war 10.055 Zeichen lang; die Handlung („WHAT THIS FRAME SHOWS" mit ACTION /
  // SCENE / EMOTION) stand auf Zeile 33 von 39, also nach 88 % des Prompts.
  // Davor lagen ~8.800 Zeichen Rahmenbedingungen. Ein Bildmodell gewichtet
  // frühe, konkrete Bildbeschreibungen stark und verwässert eine einzelne
  // Anweisung, die nach 9.000 Zeichen Regelwerk kommt — genau der gemeldete
  // Fehler („Szene sagt Handy, Bild zeigt etwas anderes").
  //
  // WARUM DIE ALTE BEGRÜNDUNG ERLOSCHEN IST (ersetzt die frühere
  // RECENCY-Begründung, die hier stand): Der Szenen-Block stand am ENDE, weil
  // die stärkste GEGENanweisung („do NOT re-frame … do NOT change the
  // background") damals die allerletzte Zeile war und über Recency gewann —
  // gegen sie half nur, den Vorrangsatz noch später zu setzen. Diese
  // Gegenanweisung existiert seit dem Umbau des Jump-Cut-Blocks nicht mehr.
  // Damit ist die Endposition nur noch der Nachteil ohne den Vorteil, und der
  // Fix ist ein reiner Positionstausch: derselbe Text, ganz nach vorn.
  //
  // ES GIBT WEITERHIN GENAU EINEN VORRANGSATZ (§1.2). Wenn hier jemals ein
  // zweiter „wins" / „overrides" / „source of truth"-Satz an einer anderen
  // Stelle landet (der Reflex bei jedem neuen Bildfehler), kippt das System
  // sofort zurück: konkurrierende Ansprüche neutralisieren sich, das Modell
  // entscheidet dann nach Position und Wiederholungsdichte — und die gewinnt
  // die Dauer-Tätigkeit aus `situation`.
  //
  // Die Hierarchie, die dieser Prompt umsetzt:
  //   §1 DAS MOTIV      — was passiert (einziger Vorrang, Position 1)
  //   §2 DIE DARSTELLUNG— was der Körper tut, dem Motiv untergeordnet
  //   §3 TON            — wie es gespielt wird
  //   §4 DER DREH       — alles Unveränderliche, EINMAL gesagt
  //   §5 IDENTITÄT      — WER zu sehen ist, nie WAS passiert
  //   §6 ANSCHLUSS      — Zustand aus der Vorszene, nie deren Handlung
  //   §7 FORMAT/POLICY  — kurzer Schwanz
  //   §8 ZEIGER         — Erinnerung ohne eigenen Anspruch
  // ══════════════════════════════════════════════════════════════════════════

  // ── ENDFRAME-UMSCHALTUNG (gilt für BEIDE Modi) ───────────────────────────
  // Muss VOR der Modus-Verzweigung stehen: Reel und Story haben je ein eigenes
  // `return`, und ein Block, der nur in einem der beiden Arrays steht, ist im
  // anderen Modus schlicht wirkungslos — beim Reel wäre das der Normalfall.
  //
  // Inhaltlich kippt er genau einen Aspekt: alles davor beschreibt den Moment
  // am ANFANG der Einstellung, dies hier verlangt denselben Moment am ENDE.
  // Deshalb steht er in beiden Arrays als LETZTES Element — er muss die
  // ACTION-Zeile überstimmen können, ohne den ganzen Prompt zu duplizieren.
  const closingFrameBlock = opts.frameKind === "end"
    ? [
        "",
        "=== THIS IS THE CLOSING FRAME OF THE SHOT ===",
        "Everything above describes how this shot BEGINS. Render the moment where it ENDS instead — the same take, a few seconds later, after the action above has been carried out.",
        opts.scene.endState?.trim()
          ? `State at the end of the shot: ${opts.scene.endState.trim()}`
          : "The action described above is now complete: show its result, not its start.",
        "UNCHANGED from the opening frame: the same person with the same face and hair, the same outfit, the same location and set dressing, the same camera position, lens, framing and lighting. The camera has not moved and nothing has been re-staged.",
        "CHANGED: only what the action itself changed — body posture, hands, gaze direction, and where objects now are.",
        "This frame is the last moment of the same continuous take, so it must cut together with the opening frame without any visible jump in style, exposure or colour.",
      ].join("\n")
    : "";

  if (mode === "reel") {
    // ── §1.1 WER im Bild ist ────────────────────────────────────────────────
    // Ersetzt den alten `charBlock`, der auf `characters` (ALLE Projektfiguren)
    // baute und damit Personen als „present in this scene" behauptete, die in
    // dieser Szene gar nicht vorkommen. Quelle ist jetzt `scene.participants` —
    // das Feld existierte, wurde aber nie gelesen.
    // ROBUSTHEIT: `participants` ist Freitext („exakte sichtbare Charakternamen
    // kommasepariert"). Bei Tippfehlern, leerem Feld (Altstoryboards) oder
    // Nicht-Namen ist die Schnittmenge leer — dann fällt es auf `characters`
    // zurück. Ohne diesen Fallback machte ein einziger Tippfehler aus der
    // anwesenden Figur ein „nobody else is in this frame" gegen sie selbst.
    const charNames = characters.map((c) => c.name.trim()).filter(Boolean);
    // Aus derselben Quelle wie der Sprecher oben — inklusive der Regel, dass wer
    // spricht auch im Bild ist. Vorher konnte der Prompt „Nobody else is in this
    // frame" behaupten und zugleich einen Sprecher nennen, der laut derselben
    // Zeile gar nicht anwesend war.
    const framePeople = effFramePeople;
    const peopleClause = framePeople.length > 0
      ? ` In this frame: ${framePeople.join(", ")}.` +
        (charNames.length > framePeople.length ? " Nobody else is in this frame." : "")
      : "";

    // KONFLIKTAUFLÖSUNG (conflicts.txt #4, Nebenbefund): Auch eine STUMME
    // Vlog-Szene braucht die Vlog-Rahmung („ongoing recording") — der frühere
    // Fallback auf die generische Fassung ließ die einzige Szene ohne
    // Sprechtext aus dem Vlog-Kontext fallen.
    // ERZÄHL-FOKUS: „mid-word" bleibt (Lipsync braucht ein offenes Mundbild),
    // „mid-action" ist raus — es forderte eine sichtbare Handlung, die es beim
    // ruhigen Erzählen nicht gibt.
    // AUSDRUCK GEHÖRT AUF POSITION 1. Die frühere Fassung beschrieb den Reel-
    // Frame als „calm, present person in an ordinary moment" — an der stärksten
    // Stelle des Prompts stand also die Anweisung, nichts zu zeigen. Der Rahmen
    // (unposed, echter Moment, keine Inszenierung) bleibt; ergänzt ist, dass das
    // Gesicht dabei etwas FÜHLT und man es sieht.
    const openerBase = talkingHead
      ? (vlogActive
        // Position 1 ist die stärkste Stelle des Prompts und hatte im
        // Default-Stil bisher keinen Kamerabezug. Die Tätigkeit steht bewusst im
        // SELBEN Satz, damit die Direktansprache sie nicht per Primacy verdrängt.
        ? "A single cinematic film still from a creator-style vlog reel — one real, unposed moment out of an ongoing recording, caught mid-word with a live, expressive face, talking to the camera while carrying on with what they are doing."
        : "A single cinematic film still — one frame of a creator-style talking-to-camera reel, frozen mid-word on a strong, clearly readable expression.")
      : vlogActive
      ? "A single cinematic film still from a creator-style vlog reel — one real, unposed moment out of an ongoing recording, caught on a clearly readable reaction."
      // Beim Gruppenbild stünde die Einzahl direkt vor „In this frame: A, B" —
      // Position 1 des Prompts widerspräche der Zeile dahinter, und die
      // Personenzahl ist genau das, was hier stimmen muss.
      : multiAnchor
      ? "A single cinematic film still — the people in it present and visibly feeling something in an ordinary moment of the scene."
      : "A single cinematic film still — a present person in an ordinary moment of the scene, caught on a clearly readable emotion.";

    // ── §1.3 MOMENT ─────────────────────────────────────────────────────────
    // `summary` ist laut Direktive die kompakteste Fassung der Szene (max. 15
    // Wörter) und landete bisher NIE im Bild-Prompt. Sie bekommt die stärkste
    // Position — aber nur, wenn sie etwas anderes sagt als die keyAction.
    // Sonst stünde dieselbe Aussage zweimal untereinander, und zwei fast
    // gleiche Zeilen liest ein Bildmodell im Zweifel als ZWEI Momente.
    // Greift der Fallback `keyAction || summary` (Altstoryboard ohne
    // keyAction), entfällt die MOMENT-Zeile ebenfalls — dann IST die ACTION
    // bereits die summary.
    const summaryText = soften(scene.summary || "");
    const normalise = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const showMoment = !!summaryText && !!scene.keyAction?.trim()
      && normalise(summaryText) !== normalise(action);

    // Der Nachsatz „caught in progress" hängt am Feldwert, deshalb erst den
    // Schlusspunkt der freien Texteingabe abschneiden.
    const actionClean = action.replace(/\s*[.!?]+\s*$/, "");

    // ── §1.7 audienceEffect ─────────────────────────────────────────────────
    // Zweites Feld, das es bisher nie in den Bild-Prompt geschafft hat.
    // ACHTUNG: Das ist eine WIRKUNGS-, keine Bildangabe. „Unbehagen" oder
    // „Spannung" lädt das Modell ein, symbolische Requisiten zu erfinden oder
    // die Lichtstimmung des Raums zu drehen — also genau die Abweichung von
    // der Szene, die dieser Umbau bekämpft. Der Nachsatz ist der Schutz; er
    // steht im selben Block wie der Vorrangsatz und wirkt damit stark.
    // Zeigt die Messung ein verwässertes Motiv, ist DIESE Zeile der erste
    // Kandidat zum Wiederentfernen.
    const effectRaw = (scene.audienceEffect || "").trim();
    const effect = effectRaw
      ? (AUDIENCE_EFFECT_EN[effectRaw.toLowerCase()] || effectRaw.replace(/-/g, " "))
      : "";

    // ── §5.3 Der Negativsatz für den Vorgängerframe ─────────────────────────
    // DIE inhaltliche Kernänderung neben der Verschiebung. Bild-zu-Bild-Modelle
    // folgen Referenzbildern STÄRKER als Text: zeigt der Vorgängerframe eine
    // sitzende, frontal sprechende Person, schlug das bisher jede Textzeile.
    // Es gab in der sceneStill-Fassung — dem Praxisfall, den der Nutzer sieht —
    // keinen einzigen Satz, der die Haltung des Referenzbilds untersagt.
    // Gebaut nach dem Muster des nachweislich wirksamen Gesichts-Verbots
    // („It is NOT a face reference"), das seit jeher funktioniert.
    // LOAD-BEARING: der Satz trennt GELTUNGSBEREICHE und beansprucht bewusst
    // KEINEN Vorrang — kein „wins", kein „overrides". Der einzige Anspruch im
    // Prompt bleibt §1.2.
    const prevRefNegative =
      " It is NOT a reference for the posture, for what the person is doing, for where they are looking, or for the " +
      "crop — those four come only from the ACTION and the camera line above. It is NOT a face reference; never copy a face from it." +
      // Die Lücke, durch die dreimal dieselbe Anordnung kam: „posture" und
      // „crop" verbieten nicht, WER vorne steht. Das Vorgängerbild zeigte Leo
      // frontal — also stellte das Modell Leo wieder nach vorn, obwohl im Text
      // Tim die Zeile hatte. Bei mehreren Personen muss die Anordnung
      // ausdrücklich freigegeben werden, sonst schreibt sich der erste Frame
      // durch das ganze Reel fort.
      (effFramePeople.length > 1
        ? " It is also NOT a reference for WHICH person stands in front: who faces the camera and who is the shoulder " +
          "in the foreground is decided ONLY by the framing block above. If that block names someone else than the " +
          "previous frame showed, the two have swapped — do not carry the old arrangement over."
        : "");

    // ── §5.3 Die drei Fassungen der Vorgänger-Karte ─────────────────────────
    // ZUSTANDSANSCHLUSS: Ist das mitgeschickte Bild der letzte Frame des
    // fertigen Vorgänger-CLIPS (statt dessen Startbild), belegt es den Zustand
    // NACH der Handlung der Vorszene. Genau das ist der Grund, warum Szene N+1
    // bisher wieder saß, obwohl die Person in Clip N aufgestanden ist.
    // NEU GETRENNT: Die alte Fassung sprach dem Bild ausdrücklich die Autorität
    // über „their posture", „whether they are standing or sitting" und „what is
    // in their hands" zu — also über genau das, was aus der ACTION kommen soll.
    // Jetzt: ZUSTAND (wo die Dinge gelandet sind) ist bindend, HALTUNG (was die
    // Person von dort aus tut) kommt aus der ACTION.
    //
    // ACHTUNG, WORTWAHL: NIE „the camera has been repositioned/moved". Der
    // ganze Vlog-Aufbau steht auf dem GEGENTEIL (§4.1, §4.3, §6). Freigegeben
    // wird der AUSSCHNITT, nicht der Standort — und die Freigabe steht nur noch
    // an einer Stelle, in §4.3.
    const prevRefLine = !hasPrevImage
      ? ""
      // BÜHNEN-PLATTE: der leere Raum aus GENAU dieser Kameraposition. Sie ist
      // die stärkste Anschluss-Referenz, die es hier geben kann, weil sie Raum,
      // Licht und Standort festlegt und trotzdem kein Gesicht mitbringt — das
      // Vorgängerbild konnte beides nie trennen.
      // NÄCHSTE Szene statt voriger: bindend für Aussehen und Ort, ausdrücklich
      // NICHT für den Handlungsstand. Ohne den zweiten Satz nimmt dieser Frame
      // die Handlung seiner eigenen Szene vorweg — er sähe dann aus wie das
      // Ergebnis dessen, was er eigentlich erst zeigen soll.
      : opts.prevImageKind === "nextSceneStill"
      ? `Image ${prevRefIdx}: the NEXT scene of this same reel — the shot that comes AFTER this one, already ` +
        `rendered. It is binding for the room, the furniture, the lighting, the colour grade and WHAT EACH PERSON ` +
        `IS WEARING: these two shots are cut together and must look like the same afternoon in the same room. ` +
        `It shows a LATER moment: this frame happens BEFORE it, so never copy its posture, its gestures or where ` +
        `objects have ended up — those come from the ACTION above.` + prevRefNegative
      : opts.prevImageKind === "stagePlate"
      ? `Image ${prevRefIdx}: the EMPTY STAGE PLATE for this exact camera position — the same room, same lens, same ` +
        `light, photographed with nobody in it. It is binding for the room, the background, the lighting, the colour ` +
        `grade and WHERE THE CAMERA STANDS: build this frame on that plate and place the people into it. It contains ` +
        `no person by design — never read a face, a body or a pose out of it.`
      // EIGENES STARTBILD (Endframe-Lauf): die exakte Umkehrung aller anderen
      // Fassungen. Sonst ist das mitgeschickte Bild eine fremde Einstellung, aus
      // der NICHTS übernommen werden darf — hier ist es dieselbe Einstellung,
      // Sekunden früher, und alles außer der Bewegung MUSS übernommen werden.
      // Mit `prevRefNegative` (verbietet Gesicht, Crop, Haltung) wäre der
      // Endframe unbrauchbar: genau diese Bindung macht ihn anschlussfähig.
      : prevIsOwnStartFrame
      ? `Image ${prevRefIdx}: the OPENING FRAME OF THIS VERY SHOT — same take, same camera, a few seconds earlier. ` +
        `It is binding for the face, the hair, the outfit, the room, the set dressing, the lens, the crop, the ` +
        `lighting and the colour grade: reproduce all of them exactly. The ONLY thing that differs is what the ` +
        `action changed — posture, hands and where objects now are, as stated in the closing-frame block below.`
      : prevIsEndFrame && vlogActive && !isOutro
      ? `Image ${prevRefIdx}: the LAST FRAME OF THE PREVIOUS CLIP — the previous recording literally stopped at this ` +
        `instant. It is binding for where things ENDED UP: which part of the room the person is in, whether they were ` +
        `left standing or sitting, what is within reach, where every object came to rest — and that is never rewound. ` +
        `What they DO from there — the posture, the hands — comes from the ACTION above. It is a video ` +
        `frame — softer, grainier, possibly motion-blurred; re-render at full still quality.` + prevRefNegative
      : prevIsEndFrame
      ? `Image ${prevRefIdx}: the LAST FRAME OF THE PREVIOUS CLIP — it is binding for where things ENDED UP when the ` +
        `previous recording stopped: which part of the room the person is in, what is within reach, where every object ` +
        `came to rest, plus environment, lighting, colour grade and outfit. What they DO from there comes from the ` +
        `ACTION above. It is a video frame and may be soft or motion-blurred; re-render at full still quality.` + prevRefNegative
      : vlogActive && !isOutro
      ? `Image ${prevRefIdx}: the PREVIOUS frame of THIS SAME continuous take — binding for the room, the outfit, the ` +
        `lighting and the colour, and for how the objects already in play look. Objects the ACTION needs may be new in ` +
        `this frame and are simply there.` + prevRefNegative
      : `Image ${prevRefIdx}: the PREVIOUS scene's frame — use ONLY for environment, location, lighting, colour grade ` +
        `and outfit/prop continuity.` + prevRefNegative;

    const reelRefLines = [...anchorLines, ...backRefLines, prevRefLine].filter(Boolean);

    // ── §6 Zustandsquelle ───────────────────────────────────────────────────
    // KONFLIKTAUFLÖSUNG (conflicts.txt #5): Der frühere Join BEIDER Notizquellen
    // („prev; own") behauptete zwei WIDERSPRÜCHLICHE Zustände gleichzeitig für
    // JETZT — dieselbe Tasse „halb voll" UND „halb leer" im selben Satz, und
    // „Handy liegt neben der Tastatur", während die ACTION verlangt, dass die
    // Person darauf scrollt. Bindend ist allein die Notiz DIESER Szene; die der
    // Vorszene dient nur noch als Fallback für Alt-Storyboards ohne eigene
    // Notiz. Was vorher geschah, steht bereits in der „Previously:"-Zeile, und
    // den sichtbaren Ausgangszustand belegt das Referenzbild ohnehin stärker
    // als jeder Text.
    const prevNotes = prevScene?.continuityNotes ? soften(prevScene.continuityNotes) : "";
    const ownNotes = scene.continuityNotes ? soften(scene.continuityNotes) : "";
    const mergedNotes = ownNotes || prevNotes;

    const envSentence = "The environment is clearly visible and part of the story — surfaces, props, background life, " +
      "atmosphere all reinforce what is happening.";

    return [
      // ══ §1 DAS MOTIV — Position 1 ════════════════════════════════════════
      // Nach zwei Sätzen weiß das Modell, welches Bild es malt. VOR §1 DARF
      // NICHTS EINGEFÜGT WERDEN — das ist dieselbe Schutzregel wie früher
      // („hier NICHTS mehr anhängen"), nur in die andere Richtung gedreht.
      openerBase + peopleClause,
      // §1.2 DER EINE VORRANGSATZ — wortgleich, nur verschoben.
      (action || detailed || emotion)
        ? "WHAT THIS FRAME SHOWS — this is the single source of truth for the picture. Wherever any other line in " +
          "this prompt says something different, this is the one to render."
        : "",
      showMoment ? `  MOMENT: ${summaryText}` : "",
      action ? `  ACTION: ${actionClean} — caught in progress, not before and not after it.` : "",
      detailed ? `  SCENE: ${detailed}` : "",
      // Löst die Frontal-Sperre auf: „Emotion in the FACE" war bei einer
      // Handlung, die die Person wegdreht, schlicht unerfüllbar. Die Auflösung
      // hängt als Suffix an genau dem Feld, für das sie gilt.
      // GROSS, NICHT ANGEDEUTET. Der Zusatz war früher nur die Ausweichklausel
      // für abgewandte Gesichter; ein Bildmodell rendert „Überraschung" ohne
      // Größenangabe als minimale Regung, und im 9:16-Clip auf einem Handy ist
      // die dann schlicht nicht zu sehen.
      emotion
        ? `  EMOTION: ${emotion} — big and unmistakable, readable at a glance on a phone screen: brows, eyes, mouth and head all committed to it. ` +
          "Shown in the face if the face is turned towards us, otherwise in posture, shoulders and hands. Never a blank, neutral or merely polite expression."
        : "",
      effect
        ? `  INTENDED EFFECT ON THE VIEWER: ${effect} — achieve this through the action, the expression and the light, ` +
          "never through added symbols, extra objects or a changed mood of the room."
        : "",
      // ── Die EINZIGE Ausnahme vom Vorrangsatz oben ──────────────────────────
      //
      // Der Block darüber ist als „single source of truth" ausgewiesen: was dort
      // steht, schlägt jede spätere Zeile. Genau daran scheiterte die
      // Ein-Gesicht-Regel in der Praxis — steht in der Szenenbeschreibung
      // „Tim steht neben ihm und schaut ihn an, beide sind gut zu sehen", dann
      // gewinnt dieser Satz gegen jede Regel weiter unten, und das Bild zeigt
      // zwei Gesichter. Die Beschreibung stammt oft aus einem Storyboard, das
      // vor dieser Regel entstanden ist; sie nachträglich umzuschreiben wäre
      // Textraten in freiem Deutsch. Deshalb steht die Ausnahme HIER, im selben
      // Block, vor allen Feldern, auf die sie sich bezieht.
      // Knapp gehalten (Nutzerentscheid): kein Layout-Diktat mehr, nur das
      // Ergebnis — ein Gesicht. Wie die Szene das erreicht, bleibt dem Modell
      // überlassen.
      //
      // BEIM GRUPPENBILD ENTFÄLLT DIESE AUSNAHME ERSATZLOS: dort sagt die
      // Szenenbeschreibung „beide sind gut zu sehen" — und das ist richtig so.
      // Es gibt nichts zu überstimmen, und ein zweiter Vorrangsatz ohne Anlass
      // würde nur den einen echten (§1.2) entwerten.
      effFramePeople.length > 1 && !multiAnchor
        ? `  FRAMING OVERRIDE — this one line outranks MOMENT, ACTION and SCENE above: only ${focusPerson || "the main subject"}'s ` +
          `face is visible in this picture. Wherever the lines above say or imply that someone else is facing us, ` +
          `looking into the camera or that "both can be seen", render that person from behind or turned away instead — ` +
          `they stay in the scene; their face does not.`
        : "",
      // §1.8 DER EINE TIEBREAKER für alle drei Textquellen.
      // WICHTIG: EIN Satz. Zerfiele er in zwei (einer für MOMENT-vs-ACTION,
      // einer für ACTION-vs-SCENE), wäre die alte Pattsituation wiederhergestellt
      // — nur an prominenterer Stelle und damit schlimmer.
      action && (detailed || showMoment)
        ? (showMoment && detailed
            ? "The MOMENT line is the short version, the ACTION is what must be visible in the picture, the SCENE line " +
              "supplies the surrounding detail. Where they differ, render the ACTION."
            : showMoment
            ? "The MOMENT line is the short version, the ACTION is what must be visible in the picture. Where they " +
              "differ, render the ACTION."
            : "The ACTION is what must be visible in the picture, the SCENE line supplies the surrounding detail. " +
              "Where they differ, render the ACTION.")
        : "",
      // §1.9 Erfüllbarkeits-Freigabe — load-bearing. Ohne sie befolgt das
      // Modell die Rahmenbedingungen und lässt lieber die Handlung weg, weil
      // Requisite, Haltung oder Ausschnitt „nicht vorgesehen" wirken.
      // „the look away from the lens" stand hier früher als dritte Freigabe —
      // gestrichen: der Blick gehört zur Kamera (Lipsync braucht das Mundbild),
      // und ruhige Alltagsgesten brauchen keinen abgewandten Blick.
      action
        ? "Whatever the action needs in order to be visible is in this frame: the prop in hand, the small change of " +
          "posture, and a crop wide enough to contain all of it."
        : "",

      // Steht bewusst DIREKT hinter dem Motiv-Block und vor allem Übrigen: die
      // Besetzung des Bildes ist keine Stilfrage, sondern entscheidet, welcher
      // Clip daraus entstehen kann. Gilt unabhängig davon, ob in dieser Szene
      // gesprochen wird.
      oneFaceBlock,

      // ══ §2 DIE DARSTELLUNG — was der Körper tut ═══════════════════════════
      // Steht direkt hinter dem Motiv, weil es das Motiv modifiziert und ihm
      // ausdrücklich untergeordnet ist. Alle Verweise auf die ACTION sind ab
      // hier RÜCKverweise („above") — die acht Vorwärtsverweise des alten
      // Prompts („the ACTION at the end of this prompt") lösen sich damit auf,
      // ohne dass eine Formulierung neu erfunden werden muss.
      ...(talkingHead
        ? [
          // KONFLIKTAUFLÖSUNG (Vlog UND Explainer, gemeinsames Skelett): Die
          // alte Fassung verschmolz DREI Dinge in einem Satz — den MUND
          // (Format-Pflicht, damit Veo überhaupt lippensynchronisieren kann),
          // die BLICKRICHTUNG und die HÄNDE. Blick und Hände sind aber
          // Ableitungen aus der Handlung: man kann sich nicht tief über ein
          // Handy beugen UND Blickkontakt zur Linse halten, und „hands actively
          // mid-gesture" fordert freie Hände, obwohl die Szene sie an eine
          // Requisite bindet. Das Modell folgte der Formatzeile und verwarf die
          // Handlung — genau der gemeldete Bug.
          // Neu: Mund/Lipsync bleibt Pflicht, Blick und Hände kommen aus der
          // ACTION, Linsenkontakt ist nur noch der DEFAULT für den Fall, dass
          // die Handlung dazu nichts sagt. Derselbe Trennschnitt steht im
          // Video-Prompt (speechLine, vlogTakeLine) — nur zusammen wirkt er.
          `SPEAKING: ${speakerName ? `${speakerName} is the person talking` : "the person on screen is the one talking"}, and they are mid-sentence at this exact moment — ` +
            "mouth open on a word, jaw and cheeks in a real speaking shape, face alive. This is a paused video of " +
            "someone talking, not a portrait." +
            // GENAU EINER spricht. Das Standbild ist bei `ai-avatar` die einzige
            // Bildquelle des Clips — es gibt dort keinen Prompt, mit dem sich
            // später noch steuern ließe, WESSEN Lippen animiert werden. Zeigt das
            // Bild zwei offene Münder, bewegen im Clip auch zwei Personen den
            // Mund, und im fertigen Reel reden zwei gleichzeitig auf einer
            // einzigen Tonspur. Deshalb steht die Mundstellung der Zuhörenden
            // hier genauso hart wie der Lipsync-Anker des Sprechers darüber.
            // EIN GESICHT, WENN GESPROCHEN WIRD.
            //
            // Zwei lesbare Gesichter in einem Sprech-Clip gehen nicht auf: unter
            // dem Clip liegt eine Stimme, `ai-avatar` animiert aber, was es an
            // Gesichtern findet. Die Lösung ist die filmische Standardlösung —
            // die zweite Person bleibt im Bild, aber als Rücken, Schulter oder
            // Anschnitt. Damit ist die Szene weiterhin zu zweit besetzt, ohne
            // dass ein zweiter Mund animierbar wäre.
            // Die Ein-Gesicht-Regel selbst steht NICHT mehr hier, sondern als
            // eigener Block weiter unten (`oneFaceBlock`) — sie gilt auch für
            // Szenen ohne gesprochene Zeile, und in diesem Zweig wäre sie daran
            // gebunden, dass überhaupt jemand spricht.
            "",
          // Verschmelzung der beiden alten Zeilen (Blick/Hände aus der ACTION +
          // Profil-Ausweg). Beide Konfliktauflösungen bleiben wörtlich
          // enthalten: der Mund ist Pflicht, Blick und Hände kommen aus der
          // ACTION, und wenn die Handlung das Gesicht wegdreht, gibt es einen
          // erfüllbaren Weg (Profil) statt eines unerfüllbaren Widerspruchs.
          // ERZÄHL-FOKUS: „never a calm posed portrait" ist raus — eine ruhig
          // erzählende Person IST fast ein ruhiges Porträt, nur eben mitten im
          // Wort. Was bleibt, ist die Lipsync-Grenze: nie ein stiller,
          // geschlossener Mund.
          // WICHTIG: Blick und Hände kommen weiterhin aus der ACTION — ein
          // Deckel („glanced at briefly at most, the face comes back to the
          // lens") wäre ein zweiter Anspruch gegen §1.2 und würde bei einer
          // blickbindenden keyAction die Handlung wegdrücken. Ruhig wird das
          // Bild über die ruhige keyAction aus dem Storyboard, nicht hier.
          // BLICK IST FORMAT, NICHT HANDLUNG. Vorher stand hier, dass auch der
          // Blick aus der ACTION kommt und Linsenkontakt nur der Rückfall ist —
          // damit widersprach §2 dem §7-Anker („eyes towards the lens"), und das
          // Modell löste den Widerspruch mal so, mal so.
          // Aufgelöst wird er NICHT durch einen härteren Lock hier (das wäre ein
          // zweiter Vorranganspruch gegen §1.2 und würde bei blickbindenden
          // keyActions wieder die Handlung wegdrücken), sondern eine Ebene höher:
          // die keyAction wird im Storyboard so geschrieben, dass sie mit dem
          // Blick zur Kamera ENDET. Hier bleibt deshalb nur noch die Trennung der
          // Dimensionen — Hände und Körper aus der Handlung, Blick aus dem Format.
          // Die Ausnahme ist bewusst PHYSISCH begründet, nicht zeitlich: ein
          // Deckel wie „nur kurz, dann zurück zur Linse" wäre genau der früher
          // entfernte zweite Anspruch.
          // AKTIONS-LEVEL: nur der Vordersatz wechselt. Alles ab „The mouth is
          // open on a word" ist der Lipsync-Anker und bleibt in beiden Fassungen
          // wortgleich stehen.
          (actionActive
            ? "What their hands and their body do comes from the ACTION ABOVE, not from the speaking — and in this " +
              "reel the hands are busy: they are visibly doing that thing right now, gripping it, lifting it, " +
              "pointing at it, working it, elbows away from the torso and the object plainly visible in frame. They " +
              "carry the action out fully and keep talking at the same time — never a still closed mouth, never a " +
              "held frozen smile. "
            : "What their hands and their body do comes from the ACTION ABOVE, not from the speaking. People talk " +
              "while doing things: they carry the action out fully and keep talking — never a still closed mouth, " +
              "never a held frozen smile. ") +
            "The mouth is open on a word and the face is fully alive with the telling: " +
            "the EMOTION named above is right there in the brows, the eyes and the shape of the mouth, at full " +
            "strength — this is someone who really means what they are saying, not a neutral presenter. " +
            "Their eyes are on the lens: this is someone talking TO the viewer while doing that thing, so the " +
            "face is turned to the camera in this frame. Only where the action physically prevents eye contact — " +
            "the person is behind the object, or has genuinely turned their body around — does the face leave the " +
            "lens, and even then never a back view" +
            // Der Explainer-Look (Gesicht groß und frontal) war bisher an diese
            // Default-Zeile geknüpft. Er bleibt erhalten — als Qualifizierer des
            // DEFAULTS, nicht als zweiter Anspruch gegen die Handlung.
            (vlogActive ? ", creator-style — face near-frontal and clearly readable." : ", face near-frontal, large and clearly readable."),
        ]
        : [
          // Variante B — Reel ohne Sprechtext. ERZÄHL-FOKUS: früher stand hier
          // die Action-Pflicht („mid-gesture, mid-step … Limbs are in motion").
          // Der Anti-Statik-Zweck bleibt — nur lebt das Bild jetzt im Gesicht
          // und einer kleinen Geste, nicht im Körper in Bewegung.
          "The camera catches the subject in an ordinary moment of the scene, in the middle of a real reaction — " +
            "not staged, not posing for the camera, but visibly feeling the EMOTION above.",
          // Kein Deckel auf die Handlung („at most … a slight lean") — der stünde
          // gegen §1.2 und gegen keyActions wie „steht auf und geht zum
          // Kühlschrank", die der Vlog ausdrücklich erzeugt. Formuliert wird nur
          // der TON: die ACTION wird ruhig ausgeführt, nicht gedämpft.
          actionActive
            ? "The frame must feel alive and physically busy, never like a stiff posed portrait: the hands are " +
              "mid-action on the ACTION above — holding, lifting, pointing at or working something — elbows away " +
              "from the torso and the object clearly readable. The face carries the emotion openly and the eyes " +
              "carry intent. It is played at an everyday pace and fully carried out, never a stunt."
            : "The frame must feel alive, never like a stiff posed portrait: the face carries the emotion openly and " +
              "the eyes carry intent. Whatever the ACTION above is, it is played at an everyday pace and stays " +
              "believable — fully carried out, never a stunt. Believable is right; blank and lifeless is wrong.",
        ]),

      // ══ §3 TON ═══════════════════════════════════════════════════════════
      // KONFLIKTAUFLÖSUNG: Die alte Vlog-Zeile hat die keyAction umDEFINIERT
      // („the next natural movement of what they are already doing") und damit
      // die Dauer-Tätigkeit aus `situation` zur Quelle der Handlung gemacht —
      // daraus entsteht „Szene sagt Handy, Bild zeigt Orange". Getrennt: TON
      // bleibt gedämpft, AUSFÜHRUNG wird vollständig.
      vlogActive
        ? (actionActive
          // AKTIONS-LEVEL „active": ERSETZT die ruhige Fassung, steht nicht
          // daneben. Zwei gegenläufige Sätze im selben Block heben sich auf, und
          // das Modell entscheidet dann nach Position statt nach Absicht.
          ? "VLOG TONE: whatever the ACTION says is played straight and at an everyday pace — a real person going " +
            "about their day, not the timing of a comedy sketch. But it is played FULLY, WITH THE HANDS, and it is " +
            "the most visible thing in the frame: an action that lifts something really lifts it, an action that " +
            "points really points, an action that holds something up holds it right up into the shot. Ordinary in " +
            "style, big and unmistakable in execution — and the FACE is never ordinary: the emotion of this moment " +
            "is plainly on it."
          : "VLOG TONE: whatever the ACTION says, it is played straight and at an everyday pace — a real person going " +
          "about their day, not the timing of a comedy sketch. But it is played FULLY and it is " +
          "clearly visible: an action described as abrupt happens abruptly, an action that holds something up " +
          "really holds it up. Ordinary in style, complete in execution — and the FACE is never ordinary: the " +
          "emotion of this moment is plainly on it.")
        // ERZÄHL-FOKUS: hier stand „REEL ACTION STYLE … a stunt-like gag …
        // absurdly overstated". Der Erklär-Stil erzählt jetzt genauso ruhig wie
        // der Vlog — die frühere Gag-Direktive war die Bild-Hälfte des alten
        // Formats und fällt mit dessen Storyboard-Definition zusammen weg.
        // „the key action IS a small gesture" hat auch dort eine Handbewegung
        // bestellt, wo die Szene ausdrücklich eine ruhige Haltung vorgibt — der
        // Bild-Prompt erfand sie dann selbst. Jetzt folgt er der ACTION: steht
        // dort Ruhe, bleiben die Hände unten.
        : (actionActive
          ? "REEL TELLING STYLE: whatever the key action says is played straight, at an everyday pace, never a stunt, " +
            "never staged. HANDS: they are working. This person is not standing still and talking — they are pointing " +
            "at the thing, holding it up, turning it, counting on their fingers, reaching for the next item, gripping " +
            "the equipment. Hands and forearms are inside the frame and clearly readable, elbows away from the body, " +
            "the object in a real grip and not floating. The message lives in what is said AND in what the hands are " +
            "doing while it is said; the expression is wide awake and fully committed to the emotion."
          : "REEL TELLING STYLE: whatever the key action says is played straight, at an everyday pace, never a stunt, " +
          "never staged. HANDS: only what the ACTION above actually describes — if it describes a calm stance, the " +
          "hands stay at rest (relaxed at the sides or loosely in front of the body) and NO gesture is invented for " +
          "them. The message lives in what is said and in the " +
          "face saying it: the body stays believable, the expression is wide awake and fully committed to the emotion."),
      explainerActive && talkingHead
        ? (actionActive
          ? "THE ACTION SHARES THE FRAME: the ACTION above is carried out by the speaker themself while they talk, and " +
            "it is fully visible — hands, object and the working part of the movement all inside the frame. The " +
            "speaking face stays the centre of the frame and clearly readable; the action sits beside it, never in " +
            "front of it and never across the mouth or the eyes."
          : "THE GESTURE SHARES THE FRAME: the small ACTION above happens casually while the subject speaks — " +
          "performed by the speaker themself, incidental and unforced. The speaking face stays the centre of the " +
          "frame, large and clearly readable; the gesture never competes with it.")
        : "",
      // §3.2 DER HOOK-FRAME. Kein Vorranganspruch — er verstärkt nur den
      // AUSDRUCK der ACTION/EMOTION oben, er ersetzt sie nicht.
      opts.isHookScene
        ? (actionActive
          ? "THIS IS THE FIRST FRAME OF THE REEL — THE HOOK: it is the one image that has to stop a thumb mid-scroll. " +
            "The expression is at its peak right here: eyes wide and locked on the lens, brows fully engaged, the " +
            "emotion above at maximum intensity and instantly readable at thumbnail size. Nothing about this frame is " +
            "a warm-up, a settling-in or a polite opening — the person is already at full energy. The staging still " +
            "stays ordinary and believable; it is the FACE that is turned all the way up."
          // Ruhiger Modus: Die AUFGABE des ersten Frames bleibt (er muss das
          // Scrollen stoppen) — der Weg dorthin ändert sich. Nicht das
          // aufgerissene Gesicht hält hier, sondern der Blick: jemand, der
          // einen direkt ansieht und offensichtlich gerade etwas sagt. Ein
          // Höflichkeitslächeln bleibt in BEIDEN Fassungen verboten.
          : "THIS IS THE FIRST FRAME OF THE REEL — THE HOOK: it is the one image that has to stop a thumb mid-scroll, " +
            "and here it does that quietly. The person is looking straight into the lens and is clearly already " +
            "mid-sentence, present and switched on, the emotion above plainly readable at thumbnail size — but not " +
            "cranked up: no wide-open eyes, no raised brows, nothing performed. Nothing about this frame is a warm-up, " +
            "a settling-in or a polite opening either — no greeting face, no posed smile.")
        : "",
      // §3.3 DER SCHLUSS-FRAME — das Gegenstück zum Hook. Ebenfalls kein
      // Vorranganspruch: er beschreibt die HALTUNG, nicht die Handlung.
      opts.isLastScene
        ? "THIS IS THE CLOSING FRAME OF THE REEL: it must read as an ending, not as a scene with something still to " +
          "come. The gesture is completed and at rest, the body is squared to the camera, the shoulders are settled " +
          "and the gaze is locked into the lens. Nothing is mid-swing, nothing is half-turned away, nobody is " +
          "reaching for anything or stepping anywhere. The expression is SERIOUS and weighted — the gravity of a " +
          "final word, not the excitement of the scenes before it: steady eyes, jaw set, no smile held for the " +
          "camera. And no sign-off: no wave, no thumbs-up, no goodbye nod. " +
          // DER MUND AUF DER LETZTEN SILBE (Nutzerbefund 2026-08-16: „er macht
          // sogar den Mund auf, als wollte er noch was sagen").
          //
          // WARUM DAS HIER STEHEN MUSS: Bei `ai-avatar` ist dieses Standbild die
          // EINZIGE Vorlage des Clips — die API nimmt weder Prompt noch Dauer.
          // Sobald die Tonspur zu Ende ist, läuft das Modell aus dem letzten
          // Visem in die Pose des Standbilds zurück. Steht dort ein weit
          // geöffneter Mund, sieht der letzte Moment des Reels aus wie ein
          // neuer Ansatz zum Sprechen.
          //
          // ADDITIV, NICHT GEGEN DEN ANKER: Der Lipsync-Anker („never a still
          // closed mouth") bleibt Wort für Wort stehen und gilt weiter — ein
          // geschlossener Mund im Standbild verschlechtert die Lippensynchronität
          // des GANZEN Clips, nicht nur seines Endes. Verlangt wird deshalb kein
          // geschlossener Mund, sondern ein anderer Punkt im Sprechen: das ENDE
          // des Wortes statt seiner Mitte. Der Mund ist offen, aber im Schließen.
          "The mouth is on the LAST syllable of the sentence — still speaking, but at the END of the word: the jaw " +
          "is already coming back up and the lips are close to meeting, not stretched wide open on a vowel. This is " +
          "the final moment of the sentence, not the middle of one."
        : "",

      // ══ §4 DER DREH — alles Unveränderliche, EINMAL gesagt ════════════════
      // §4.1 Ein Setup-Satz statt fünf verstreuter Zeilen (Raum, Ort,
      // specificArea, Outfit, Kameraaufbau, Dauer-Tätigkeit).
      // KONFLIKTAUFLÖSUNG, drei Reparaturen, die alle erhalten bleiben:
      // (1) Kein Vorrangsatz („the KEY ACTION WINS" ist weg) — es gibt genau
      //     einen, und der steht in §1.2.
      // (2) Fix ist die KAMERAPOSITION, nicht der Crop. Der Crop wird
      //     ausschließlich in §4.3 geregelt; hier steht kein Wort dazu.
      // (3) `activity` ist eine BEGRÜNDUNG („deshalb ist er hier"), keine
      //     Bildanweisung. Der Schlusssatz hält das wortgleich fest.
      // KONFLIKTAUFLÖSUNG (specificArea): `enforceVlogJumpCuts` überschreibt
      //     `specificArea` deterministisch mit dem Wert aus Szene 1. Der ORT
      //     bleibt damit fest, der gezeigte AUSSCHNITT ist frei (§4.3) — sonst
      //     läuft eine Handlung, die die Person an eine andere Stelle desselben
      //     Raums bringt, gegen eine Ortszeile, die den verlassenen Platz
      //     behauptet.
      isOutro && situation
        ? `SAME PERSON, NEW CONTEXT: this is the same person from the rest of the reel, still wearing ${situation.outfit} — ` +
          "same outfit, same hair, same styling, same overall look. Only the surroundings are new."
        : "",
      // Winkelangaben aus dem persistierten cameraSetup strippen: der Winkel
      // DIESES Frames kommt ausschließlich aus der This-frame-Zeile (§4.2) —
      // ein „at eye level" aus dem Setup stünde sonst in jedem Prompt gegen
      // den pro Szene wechselnden Jump-Cut-Winkel.
      situation && !isOutro
        ? `THE SHOOT (identical in every scene of this reel): Room: ${situation.setting} — ${mainLocation}` +
          `${scene.specificArea ? `, set up at ${scene.specificArea}` : ""}. ` +
          `Outfit: ${situation.outfit}. Camera: ${stripCameraAngleWords(situation.cameraSetup)} — the angle and shot size of this scene come from the This-frame line below. ` +
          "Same room, same light, same time of day in every scene. " + envSentence + " " +
          `The session started while the person was busy with ${situation.activity}; that is the reason they are in ` +
          "this room, nothing more — it is never a source of what the person is doing."
        : vlogActive && !isOutro
        ? `Location: ${mainLocation}. ` +
          (scene.specificArea
            ? `The shoot is set up at ${scene.specificArea} — same room, same light, same time of day in every scene. `
            : "") +
          envSentence
        // KONFLIKTAUFLÖSUNG (conflicts.txt #3): Das Outro spielt in einem NEUEN
        // Kontext — die Fallback-Ortszeile behauptete direkt nach „Only the
        // surroundings are new." den alten Reel-Hauptort. Das Outro bekommt den
        // eigenen Bereich aus seiner Szene (enforceVlogJumpCuts lässt ihn
        // bewusst unangetastet), nie den mainLocation.
        : isOutro
        ? `Location — deliberately NEW for this final scene, NOT the room from the rest of the reel: ` +
          `${scene.specificArea || "a different place, typically outside or wherever the result of the activity is"}. ` +
          envSentence
        : `Location: ${mainLocation}${scene.specificArea ? ` — ${scene.specificArea}` : ""}. ` + envSentence,
      // §4.2 Einstellungsgröße, Winkel und Komposition dieser Szene.
      // Alle drei Werte aus `cam`, nicht gemischt aus `cam` und `scene`: die
      // Komposition wird bei Schulter-Einstellungen mitkorrigiert, und ein
      // „zentriert" aus der Rohszene neben „over shoulder" wäre genau der
      // Widerspruch, den die Korrektur auflösen soll.
      `This frame: ${cam.shotType.replace(/-/g, " ")}, ${cam.cameraAngle.replace(/-/g, " ")}` +
        `${cam.composition ? `, ${cam.composition.replace(/-/g, " ")}` : ""}.`,
      // ── §4.3 DIE EINE KAMERA- UND CROP-ZEILE ────────────────────────────
      // Der größte Einzelposten des Umbaus: ~410 Zeichen ersetzen ~1.100, die
      // vorher über sieben Blöcke verteilt dasselbe sagten (Locked-off,
      // Mobile/Centre, THE SHOOT, Anschluss, Referenzkarte, IDENTITY LOCK,
      // Jump-Cut-Block, Erfüllbarkeits-Zeile).
      // KONFLIKTAUFLÖSUNG: Der alte zweite Halbsatz begrenzte die zugelassene
      // Bewegung auf „a hand, the prop or the clothing" UND band sie über „in
      // their activity" ein weiteres Mal an die Dauer-Tätigkeit —
      // Ganzkörperbewegung kam gar nicht vor. Sauber getrennt: die KAMERA ist
      // fixiert, die PERSON ist frei. Das ist die tatsächliche Definition eines
      // Locked-off-Shots.
      // KONFLIKTAUFLÖSUNG (Zentrierung): „central" stand als harte
      // Format-Vorgabe, gleichzeitig mit „Composition: zentriert" und mit
      // `situation.cameraSetup` („subject centered"). Bei jeder Handlung, die
      // die Person aus der Mitte trägt, war das unerfüllbar, und die einzige
      // widerspruchsfreie Lösung für das Modell war, die Handlung wegzulassen.
      // Die Mitte ist jetzt DEFAULT, nicht Zwang. Die Ursache ist zusätzlich in
      // der Storyboard-Direktive beseitigt — das wirkt aber nur für NEU
      // erzeugte Storyboards (`situation` ist persistiert), deshalb muss die
      // Freigabe hier stehen bleiben.
      vlogActive
        ? "The camera never moves from that spot: no dolly, no pan, no tilt, no zoom, and it follows nobody. But the " +
          "CROP from that spot is free — this frame is framed as tight or as wide, and shows as much of that same " +
          "room, as the ACTION needs. The person is the only thing moving and they move as much as the ACTION " +
          "requires: a hand, a prop, standing up, stepping to another part of the room, turning to another part of " +
          "the room. The camera " +
          "simply lets them, exactly as a propped-up phone would. Centre framing is the default, never a requirement — " +
          "where the action carries the person out of the middle, the action decides."
        : cam.movement && cam.movement !== "keine"
        ? `Camera/subject motion: ${cam.movement.replace(/-/g, " ")} — implied motion blur on the moving parts where it reads natural.`
        : "Subtle implied motion — hair, clothing or a hand caught mid-movement.",
      // Für den Explainer trägt die Kamerazeile die Centre-Freigabe nicht mit —
      // sie steht deshalb hier als eigene kurze Zeile.
      explainerActive
        ? "Centre framing is the default, never a requirement: where the ACTION carries the person across or out of " +
          "the middle of the frame, the action decides. The composition and camera lines describe the setup, never " +
          "what the person does."
        : "",
      // ── §4.4 Garderobe ───────────────────────────────────────────────────
      // Ein Outfit-Wechsel liest sich nie als Zeitsprung, sondern als anderer
      // Drehtag. Die Bedingung hängt bewusst an `mode === "reel" && !isOutro`
      // und NICHT an `situation`: fehlte das Objekt (Altprojekt), gab es früher
      // gar keine Sperre. Der Print-Zusatz kommt daher, dass Veo sonst
      // erfundene, halb lesbare Marken-Prints auf die Kleidung rendert.
      // Bei MEHREREN Personen muss die Sperre pro Person gelten. Die alte
      // Ein-Outfit-Formulierung („same garment in every scene") las das Modell
      // als EIN Outfit für das ganze Reel — und steckte beide Personen in
      // dasselbe Shirt. Am erzeugten Bild belegt: Leo und Tim identisch grau.
      // ZWEI Kleidungsquellen im selben Prompt sind ein Widerspruch, und das
      // Modell löst ihn selbst auf. Steht ein reelweites `situation.outfit` in
      // THE SHOOT, verweist diese Zeile deshalb DORTHIN statt aufs Anker-Foto —
      // dieselbe Regel, nach der die Anker-Karte oben ihre Kleidungs-Bindung
      // weglässt (`outfitFromSituation`).
      !isOutro
        ? (effFramePeople.length > 1
          ? "WARDROBE — PER PERSON: every person keeps THEIR OWN clothing, colour, cut, fit, accessories and " +
            "hairstyle in every scene of this reel — " +
            (outfitFromSituation
              ? "exactly the outfit named in THE SHOOT above. "
              : chosenOutfits
              ? `${chosenOutfits}. Dress them exactly like that. `
              : "ordinary clothing that suits this location, chosen once and then never changed. ") +
            "NEVER copy what anybody wears in their portrait reference — that photo shows the person, not the outfit. " +
            "The two people wear DIFFERENT clothes; never dress them alike, never swap or copy a garment from one " +
            "person to the other, never average their outfits. Nothing changes between scenes. NO text, letters, " +
            "numbers, logos or graphic prints on any clothing — plain fabric."
          // „same garment in every scene" allein reichte nicht: in einer
          // Solo-Szene erfand das Modell trotzdem ein anderes Shirt (blau statt
          // beige, am Bild belegt). Die Quelle steht jetzt EXPLIZIT dabei — das
          // Anker-Bild ist im selben Request, der Verweis kostet nichts.
          : "WARDROBE: same garment, colour, cut, fit, accessories and hairstyle in every scene of this reel — " +
            (outfitFromSituation
              ? "exactly the outfit named in THE SHOOT above; never invent a different garment or colour. "
              : chosenOutfits
              ? `${chosenOutfits}. Dress them exactly like that; never invent a different garment or colour. `
              : "ordinary clothing that suits this location, chosen once and then never changed. ") +
            (anchorChars.length > 0
              ? "NEVER copy what the person wears in their portrait reference — that photo shows the person, not the outfit. "
              : "") +
            "Clothing never changes. It carries NO text, letters, numbers, logos or graphic prints of any kind — plain fabric.")
        : "",
      `Visual style: ${styleLine}.`,
      // For stylised looks, force the whole frame into the art style — otherwise
      // the model leans on a semi-realistic render (especially with a photo ref).
      stylized
        ? "STYLE STRENGTH: apply this art style at 100% to EVERY part of the frame — characters, skin, hair, eyes, clothing, environment and lighting must all be rendered in this style. The result must be unmistakably this style and must NOT look like a photograph or a realistic 3D-vs-photo hybrid."
        : "",
      // Der Zusatz zur Look-Konstanz ist der Rest des alten Cinematography-
      // Blocks: der Block selbst entfällt, aber „same lens character, exposure,
      // white balance and colour grade" ist die einzige Aussage darin, die
      // nirgends sonst steht — und sie trägt die Szenen-zu-Szenen-Konsistenz.
      `Color & lighting: ${getStoryColorInstruction(colorMood, mode)}. Cinematic depth of field — subject in crisp focus, the environment softly rendered behind for real spatial depth. Same lens character, exposure, white balance and colour grade in every scene of this reel.`,
      `Overall mood: ${getStoryMoodInstruction(videoMood, mode, opts.reelStyle)}.`,

      // ══ §5 IDENTITÄT & REFERENZBILDER ════════════════════════════════════
      // Die Wortbeschreibungen stehen IM Referenzblock, direkt hinter den
      // Bildkarten: dort sucht das Modell, wenn es wissen will, wie jemand
      // aussieht. Weiter unten gingen sie zwischen den Format- und
      // Policy-Zeilen unter.
      describedLines.length > 0
        ? `PEOPLE WITHOUT A REFERENCE IMAGE (described in words on purpose):\n${describedLines.join("\n")}`
        : "",
      reelRefLines.length > 0
        ? `REFERENCE IMAGES (provided in this exact order):\n${reelRefLines.join("\n")}`
        : "",
      // ── §5.4 IDENTITY LOCK, gekürzt ──────────────────────────────────────
      // Gestrichen ist nur, was doppelt war: die Merkmalskette (steht wortgleich
      // in der Anker-Karte oben) und das zweite Gesichtsverbot (steht in der
      // Vorgänger-Karte). Die Geltungsaussage bleibt vollständig.
      // KONFLIKTAUFLÖSUNG: Der frühere Klammerzusatz („the framing stays exactly
      // as it is") war die zweite von drei Stellen, die den AUSSCHNITT einfroren
      // — „Aktion frei, Framing fix" heißt bei einer Handlung wie Aufstehen
      // konkret: die Person darf aufstehen, aber das Bild darf ihr nicht folgen.
      // Die Crop-Aussage steht jetzt ausschließlich in §4.3; der Konflikt kann
      // hier gar nicht mehr entstehen.
      characters.length > 0
        ? (multiAnchor
            ? "IDENTITY LOCK: each face stays bound to its OWN anchor image above and identical in every scene of this reel. "
            : "IDENTITY LOCK: the face bound to the anchor image above stays identical in every scene of this reel. ") +
          "Pose, expression, action and crop follow THIS frame." +
          (stylized ? " Keep the exact same recognisable person, then fully RE-DRAW them in the art style above." : "")
        : (hasReferences
          ? "Use the previous-scene frame to keep the overall look and lighting consistent across scenes."
          : ""),

      // ══ §6 ANSCHLUSS ═════════════════════════════════════════════════════
      // EINE Zeile statt dreier (Anschlussblock, Continuity-Zeile,
      // Jump-Cut-Erzählung).
      // KONFLIKTAUFLÖSUNG, vier Stellen:
      // (a) Die generischen Beispiele („standing up → now standing") übertrugen
      //     sich auf die AKTUELLE keyAction und trainierten das Modell darauf,
      //     den Zustand NACH der Handlung zu zeigen. Jetzt ist explizit gesagt,
      //     dass nur die VORIGE Handlung abgeschlossen ist — die aktuelle ist
      //     IN VOLLZUG (§1.4, „caught in progress").
      // (b) „Never introduce an object that was not already present" war der
      //     schärfste einzelne Grund dafür, dass die Requisite der Szene (Handy,
      //     Tasse) gar nicht erst im Bild auftaucht. Erlaubt ist jetzt genau
      //     das, was jede echte Vlog-Aufnahme erlaubt: nach etwas greifen, das
      //     daneben lag. ACHTUNG: Falls Requisiten wieder springen, gehört die
      //     Verschärfung in die Storyboard-Direktive („REQUISITEN MÜSSEN LOGISCH
      //     ENTSTEHEN") — NICHT zurück hierher, sonst verschwindet das Handy
      //     wieder.
      // (c) continuityNotes beschreiben ZUSTAND, nie Handlung. Der Qualifizierer
      //     wird wortgleich mitgeführt.
      // (d) Unikat aus dem entfallenen Jump-Cut-Block: „the editor cut the
      //     boring seconds in between". Der Rest jenes Blocks steht in §4.1,
      //     §4.3, §4.4 und §7.7.
      prevScene && !isOutro
        ? (vlogActive
          ? "CONTINUES FROM THE PREVIOUS MOMENT — same recording, a few seconds later; the editor cut the boring " +
            "seconds in between, and that jump is the edit. " +
            `Previously: ${soften(prevScene.keyAction || prevScene.summary || "")}. ` +
            "That is finished: never rewound, never undone, never repeated. " +
            (prevEndState
              ? `The previous shot ended with: ${soften(prevEndState)}. This frame starts from exactly that ` +
                "state — whatever was reached is still reached; the person is never put back to where they were " +
                "before it. "
              : "") +
            (mergedNotes
              ? "State right now (objects and wardrobe only — this never describes what the person is doing): " +
                `${mergedNotes}. `
              : "") +
            "Nothing resets to an earlier state; whatever they were holding before is set down or resting where they " +
            "left it. Anything the ACTION needs is there too — it was lying just outside the frame or in a pocket, and " +
            "the person has it now. Show it clearly."
          // KONFLIKTAUFLÖSUNG (Explainer): Hier stand „Never introduce an object
          // that was not already present or picked up from within this same
          // scene." Wörtlich verbietet das jede Requisite, die die SZENE
          // verlangt, sobald sie im Vorgängerframe nicht zu sehen war. Dazu die
          // Beispielkette „if they were standing up, they are now standing…",
          // die die Handlung dieses Frames vorschreibt. Beides gilt jetzt
          // ausdrücklich nur für die WELT, nicht für die Handlung.
          : "CONTINUES FROM THE PREVIOUS MOMENT — a few seconds of footage were cut out between then and now. " +
            `Previously: ${soften(prevScene.keyAction || prevScene.summary || "")}. ` +
            (prevEndState
              ? `The previous shot ended with: ${soften(prevEndState)}. Whatever progress that reached still holds ` +
                "here — the person is never rewound to an earlier point of it. "
              : "") +
            "That action is over; this frame shows the world after it, never a repeat of it. Carry the WORLD over from " +
            "that moment: objects that were already there are still there, in the state they had reached, and nothing " +
            "resets to an earlier state. Do not invent extra background objects that serve no purpose. Anything the " +
            "ACTION above needs in order to be visible IS present here — a prop the scene calls for is simply there, or " +
            "in the person's hands, even if the previous frame did not show it. What the person is DOING now is NOT " +
            "carried over — that is the ACTION above. " +
            (mergedNotes
              ? `State right now (objects and wardrobe only, never the action): ${mergedNotes}.`
              : ""))
        // Szene 1 (oder Outro): kein Anschluss, aber der Zustand dieser Szene
        // steht trotzdem im Storyboard und wird gebraucht.
        : ownNotes
        ? (vlogActive && !isOutro
          ? `Continuity of wardrobe and objects (state only — this never describes what the person is doing): ${ownNotes}`
          : `Continuity: ${ownNotes}`)
        : "",

      // ══ §7 FORMAT, POLICY, VERBOTE ═══════════════════════════════════════
      getAspectFramingDirective(aspect),
      // Der Zusatz über den Körper ist kein Stil, sondern eine Reparatur: „face
      // large and instantly readable" plus 9:16 hat wiederholt einen Kopf ohne
      // Körper erzeugt, der frei vor dem Raum schwebt. Für `ai-avatar` ist das
      // besonders teuer — aus diesem Standbild entsteht der ganze Clip.
      "Optimised for mobile viewing — the person and their face are large and instantly readable in the first half-second, and " +
        "the face stays readable on a phone screen. The head is always attached to a body: shoulders and at least the " +
        "upper chest are in frame, connected to the head, standing in the room. Never a floating, cropped-out or " +
        "disembodied head, never a head pasted over the background.",
      // Das reine Text-Verbot reichte nicht: Veo bekam Startbilder mit
      // eingebrannter Untertitel-Box UND einer Player-Leiste samt Zeitstempel
      // geliefert. Eine Fortschrittsleiste ist eben weder „text" noch „caption"
      // noch „logo" — die Lücke muss explizit zu sein.
      "Nothing is laid on top of this picture: no captions, no subtitles, no watermark, no logo, no player controls, " +
        "no progress bar, no timestamp, no play button, no like/share icons, and no mock-up phone frame drawn around " +
        "the image. This is the raw camera image itself, not a screenshot of an app.",
      // KONFLIKTAUFLÖSUNG — der Handy-Fix. Die Zeile sieht wie eine
      // Wiederholung der Zeile darüber aus, ist aber deren GEGENSTÜCK:
      // „no app chrome, no phone frame" plus „ABSOLUTELY NO TEXT … anywhere in
      // the image" liest sich wörtlich als MOTIV-Verbot — ein Handy, auf dem
      // gescrollt wird, IST ein Phone-Frame mit App-Chrome und Text. Für jede
      // Szene, deren Handlung ein Smartphone ist, hob das die keyAction auf.
      // Sauber getrennt: OVERLAY verboten, REQUISITE erlaubt.
      // EIN „Aufräumen" hier bringt exakt den gemeldeten Bug zurück.
      "Inside the scene, real objects are fine and expected: a phone, a laptop or a screen that is physically in the " +
        "room is part of the room and can be held, looked at and used. Any text on such a surface reads as light and " +
        "shapes only — never as legible words.",
      // DRITTE Kategorie, neben Overlay (verboten) und Requisite (erlaubt): Text
      // in der AUSSTATTUNG. Bewusst als Regel über Oberflächen formuliert, nicht
      // über Gegenstände — ein pauschales „kein Text im Bild" wäre wieder das
      // Motivverbot, das den Handy-Bug ausgelöst hat. Verboten ist LESBARE
      // Schrift, nicht der Gegenstand, der sie normalerweise trägt.
      "Keep written words out of the set dressing: no posters, signs, banners, framed quotes, wall lettering, " +
        "whiteboards, packaging labels or book titles with readable writing. Where a surface in this location would " +
        "normally carry writing, it stays pure texture — shapes, tone and colour, never readable words in any language.",
      "Content policy: depict clothed adults only. No nudity, no sexually suggestive content, no graphic violence, no minors. Tasteful cinematic storytelling.",
      "Sharp focus on the action, plausible anatomy, realistic hands, true-to-style rendering. It must read as one frame of a larger, continuous scene.",
    // Gilt für JEDEN Frame, auch den Endframe: das Gesicht muss zur Kamera zeigen.
    // Sonst entsteht ein Frame-Paar, bei dem die Person am Clipende weggedreht ist
    // — und der Lipsync findet danach keinen Mund mehr.
    "The person who is talking (the main subject of this frame) has their face turned towards the camera and clearly visible: eyes towards the lens, face unobstructed. Never a back view, never a full profile, never turned away from the camera.",
      // ── §7.7 Übergangs-Sperre ────────────────────────────────────────────
      // Der Vlog schneidet hart: jeder Frame ist derselbe Aufbau, nur die Person
      // hat sich bewegt. Der Explainer schneidet ebenfalls hart, aber in einen
      // sichtbar NEUEN Aufbau — deshalb behält er seine eigene Fassung.
      isOutro
        ? "This FINAL frame is a deliberate hard cut into a different context: the surroundings are new, but it is the " +
          "same person, the same outfit, the same hair and the same camera and grade. The cut into it is hard — never " +
          "compose it as a fade, dissolve, morph or any kind of transition out of the previous frame."
        : vlogActive
        ? "This frame is a straight photograph of one moment. It is never a fade, a dissolve, a morph, a blend, a " +
          "double exposure or any kind of transition between two scenes."
        // Sprech-Szenen bekommen eine eigene Fassung: „AND position" ist kein
        // Storyboard-Feld und lässt sich deshalb von keinem Guard klemmen — das
        // Bildmodell erfindet die Kameraposition frei und stellt sie gern seitlich
        // oder hinter die Person. Bei ai-avatar ist genau dieses Bild der Clip.
        // Der harte Schnitt bleibt gefordert, er läuft nur über Winkel und
        // Einstellungsgröße statt über eine Position abseits der Achse.
        : talkingHead
        ? "THIS frame is a deliberately NEW camera setup: clearly different angle and shot size than the previous " +
          "scene — the difference must be obvious at a glance, while the camera stays in front of the person and " +
          "the face stays on the lens. The edit HARD CUTS between scenes; never compose this frame as a " +
          "continuation of the previous one, and never as a fade, a dissolve, a morph, a blend or any other " +
          "transition."
        : "THIS frame is a deliberately NEW camera setup: clearly different angle, shot size AND position than the " +
          "previous scene — the difference must be obvious at a glance. The edit HARD CUTS between scenes; never " +
          "compose this frame as a continuation of the previous one, and never as a fade, a dissolve, a morph, a blend " +
          "or any other transition.",
      // ── §7.8 Retry ───────────────────────────────────────────────────────
      // KONFLIKTAUFLÖSUNG: Der Retry-Pfad machte es bisher systematisch
      // SCHLIMMER. Als einziger der drei Zweige ließ er die key action aus der
      // Keep-Liste weg und ersetzte sie durch „where they are in their activity"
      // — also durch die Dauer-Tätigkeit. Da Retries im Hintergrund automatisch
      // laufen, war der zweite Versuch stärker auf die Dauer-Tätigkeit
      // festgenagelt als der erste; ein einmal verlorener Frame konnte gar nicht
      // mehr korrigiert werden.
      attempt > 0
        ? (vlogActive && !isOutro
          ? `RENDER VARIATION #${attempt}: keep the SAME room, the SAME camera spot, the SAME outfit, the SAME lighting AND the SAME ACTION as stated at the top of this prompt — vary only the exact instant within that action, the posture and the gesture compared to any earlier attempt. The person keeps talking to the camera throughout, eyes on the lens. Describe everything in neutral, tasteful, policy-safe terms.`
          : talkingHead
          ? `RENDER VARIATION #${attempt}: keep the same characters, location, the ACTION stated at the top of this prompt AND the direct-to-camera address, but freely re-interpret lighting, background staging, framing distance and gesture compared to any earlier attempt. The speaker KEEPS talking straight into the lens. Describe everything in neutral, tasteful, policy-safe terms.`
          : `RENDER VARIATION #${attempt}: keep the same characters, location and the ACTION stated at the top of this prompt, but freely re-interpret and re-frame the moment — change camera angle, distance, composition and lighting compared to any earlier attempt. Describe everything in neutral, tasteful, policy-safe terms.`)
        : "",
      // Siehe Begründung an der zweiten Fundstelle weiter unten: „portrait"
      // widerspricht an dieser Stelle dem Lipsync-Anker.
      attempt > 0 ? SAFE_SCENE_CLAUSE : "",

      // ══ §8 SCHLUSS-ERINNERUNG ════════════════════════════════════════════
      // Ein ZEIGER, kein zweiter Vorranganspruch: kein „wins", kein „overrides",
      // kein „source of truth". Er besetzt die Recency-Position, ohne den
      // Ein-Anspruch-Grundsatz zu brechen. Das ist eine WETTE — liest das Modell
      // ihn doch als Konkurrenzanspruch, ist er der erste Kandidat zum
      // ersatzlosen Streichen. Der Prompt funktioniert ohne ihn.
      action
        ? "Render the ACTION at the top of this prompt: that posture, those hands. Everything after it " +
          "describes the shoot, not this moment."
        : "",

      // Ganz zuletzt, damit er den ZEIGER darüber überstimmt: der bezieht sich
      // auf den Anfangsmoment, dieser Block verschiebt ihn ans Ende der Einstellung.
      closingFrameBlock,
    ].filter(Boolean).join("\n");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STORY-MODUS (`mode === "general"`).
  // Die frühere Byte-Identitäts-Zusage dieses Zweigs ist AUFGEHOBEN (2026-08-02):
  // der Nutzer hat den Erzähl-Fokus als Verhaltensänderung angeordnet — ruhiges
  // Erzählen statt Action-Höhepunkten. Vier Zeilen sind dafür gezielt geändert
  // (Opener, STRICT-Block, Bewegungspflicht, mid-motion-Schluss); die
  // Emit-Reihenfolge und alles Übrige sind weiterhin unangetastet.
  // ══════════════════════════════════════════════════════════════════════════
  const refLines: string[] = [...anchorLines];
  if (hasPrevImage) {
    refLines.push(
      prevIsOwnStartFrame
        ? `Image ${prevRefIdx}: the OPENING FRAME OF THIS VERY SHOT — same take, same camera, a few seconds earlier. It is binding for the face, the hair, the outfit, the room, the set dressing, the lens, the crop, the lighting and the colour grade: reproduce all of them exactly. The ONLY thing that differs is what the action changed — posture, hands and where objects now are, as stated in the closing-frame block below.`
        : opts.prevImageKind === "nextSceneStill"
        ? `Image ${prevRefIdx}: the NEXT scene of this story — the shot that comes AFTER this one, already rendered. Use it for environment, location, lighting, colour grade and outfit continuity, so the two cut together. It shows a LATER moment: this frame happens BEFORE it, so never copy its posture or where objects have ended up. It is NOT a face reference; never copy a face from it.`
        : prevIsEndFrame
        ? `Image ${prevRefIdx}: the LAST FRAME OF THE PREVIOUS CLIP — the state the person and the room were left in when the previous recording stopped: posture, position, what is in their hands, where objects ended up. Use it for that state and for environment, lighting, colour grade and outfit continuity — not for the framing, which comes from the Camera line. It is a video frame and may be soft or motion-blurred; re-render at full still quality. It is NOT a face reference; never copy a face from it.`
        : `Image ${prevRefIdx}: the PREVIOUS scene's frame — use ONLY for environment, location, lighting, colour grade and outfit/prop continuity. It is NOT a face reference and may already be imperfect; never copy a face from it.`,
    );
  }
  const referenceMap = refLines.length > 0
    ? `REFERENCE IMAGES (provided in this exact order):\n${refLines.join("\n")}`
    : "";

  return [
    // ERZÄHL-FOKUS: früher „the DECISIVE moment … frozen mid-action" plus
    // Action-Pflicht („Limbs are in motion; weight is shifted"). Die Geschichte
    // wird ERZÄHLT — das Bild zeigt eine ruhig präsente Person, keine
    // Action-Höhepunkte. Der Anti-Statik-Zweck der alten Blöcke (keine toten
    // Posed-Portraits) bleibt über die „alive"-Zeile erhalten.
    "A single cinematic film still — a quiet, present moment of the scene, told rather than performed.",
    "The camera finds the subject calmly in the middle of the scene's moment — " +
      "not staged, not posing, simply present. Think of it as the one frame that lets " +
      "the story being told breathe.",

    // ── Forbid the static failure modes the model defaults to ──
    "The frame must feel alive without action: the face is engaged, the eyes carry the story, " +
      "and at most one small everyday gesture accompanies the moment. No stiff line-up shots, " +
      "no lifeless posed portraits — calm is right, dead is wrong.",
    "No dramatic action, no stunts, no exaggerated movement: body language stays natural and " +
      "unhurried, the way a real person sits, stands or gestures while telling or listening to a story.",

    // ── What's actually happening ──
    // KONFLIKTAUFLÖSUNG (Story-Modus): Hier standen zwei Sätze, die BEIDE
    // Vorrang beanspruchten — „KEY ACTION … overrides … IGNORE that line" und,
    // eine Zeile darunter, „SCENE DESCRIPTION (binding … outranks …)". Zwei
    // Sieger sind kein Vorrang, sondern eine Pattsituation, die das Modell
    // selbst auflöst. Beide Sätze waren als Notfix für die Reels gedacht und
    // sind versehentlich auch im Story-Modus gelandet. Jetzt: EIN Anspruch,
    // danach die Felder, dann der interne Tiebreaker.
    action || detailed
      ? "WHAT THIS FRAME SHOWS — this is the single source of truth for the picture. Wherever any other line in this " +
        "prompt says something different, this is the one to render."
      : "",
    action ? `  KEY ACTION: ${action}. It must be clearly visible and unmistakable.` : "",
    detailed ? `  SCENE: ${detailed}` : "",
    emotion ? `  EMOTION: ${emotion} — in the face where the face is turned towards us, otherwise in posture, shoulders and hands.` : "",
    action && detailed
      ? "If the KEY ACTION and the SCENE line differ, render the KEY ACTION; the SCENE line supplies the surrounding detail."
      : "",

    // ── Cinematic frame ──
    `Camera: ${cam.shotType.replace(/-/g, " ")}, ${cam.cameraAngle.replace(/-/g, " ")}.`,
    scene.composition ? `Composition: ${scene.composition.replace(/-/g, " ")}.` : "",
    cam.movement && cam.movement !== "keine"
      ? `Camera/subject motion: ${cam.movement.replace(/-/g, " ")} — implied motion blur on the moving parts where it reads natural.`
      : "Subtle implied motion — hair, clothing or a hand caught mid-movement.",
    `Visual style: ${styleLine}.`,
    // For stylised looks, force the whole frame into the art style — otherwise the
    // model leans on a semi-realistic render (especially with a photo reference).
    stylized
      ? "STYLE STRENGTH: apply this art style at 100% to EVERY part of the frame — characters, skin, hair, eyes, clothing, environment and lighting must all be rendered in this style. The result must be unmistakably this style and must NOT look like a photograph or a realistic 3D-vs-photo hybrid."
      : "",

    // ── World ──
    `Location: ${mainLocation}${scene.specificArea ? ` — ${scene.specificArea}` : ""}. ` +
      "The environment is clearly visible and part of the story — surfaces, props, background life, " +
      "atmosphere all reinforce what is happening.",
    `Color & lighting: ${getStoryColorInstruction(colorMood, mode)}. Cinematic depth of field — subject in crisp focus, the environment softly rendered behind for real spatial depth.`,
    `Overall mood: ${getStoryMoodInstruction(videoMood, mode, opts.reelStyle)}.`,

    // ── Identity / characters ──
    charBlock,
    referenceMap,
    characters.length > 0
      ? (stylized
          // Keep WHO it is, change HOW it's drawn.
          ? `IDENTITY LOCK: bind each character's face, head shape, hairline, hair & eye colour and distinctive features strictly to their IDENTITY ANCHOR image — then fully RE-DRAW them in the art style above. Keep the exact same recognisable person in EVERY scene, but freely change pose, expression, framing and action to fit this scene.${hasPrevImage ? " Do NOT let the face drift toward the previous-scene frame." : ""}`
          : `IDENTITY LOCK: each character's face, head shape, hairline, hair & eye colour and distinctive features must match their IDENTITY ANCHOR image and stay identical across every scene — while pose, expression, framing and action change freely to fit this scene.${hasPrevImage ? " The previous-scene frame is for environment and lighting continuity ONLY — never source a face from it." : ""}`)
      : (hasReferences
          ? "Use the previous-scene frame to keep the overall look and lighting consistent across scenes."
          : ""),
    scene.continuityNotes ? `Continuity: ${scene.continuityNotes}` : "",

    // ── Format ── (always emit — the real selected aspect, not a mode guess)
    getAspectFramingDirective(aspect),

    // ── Retry variation ──
    // On a background retry, nudge the model to re-interpret and re-frame the
    // scene (keeping characters, location and the key action) so a previous
    // safety / recitation false-positive isn't reproduced verbatim, and restate
    // the positive policy guarantee explicitly.
    // Bei einer Sprech-Szene darf der Retry NICHT den Kamerawinkel wegdrehen —
    // sonst repariert der zweite Versuch den Inhaltsfilter und zerstört dabei den
    // Blick in die Linse. Distanz, Komposition und Licht bleiben als
    // Variationsquellen erhalten, damit der Retry nicht identisch scheitert.
    attempt > 0
      ? (talkingHead
        ? `RENDER VARIATION #${attempt}: keep the same characters, location and key action, but freely re-interpret the moment — change distance, composition and lighting compared to any earlier attempt; the camera stays in front of the person and the face stays on the lens. Describe everything in neutral, tasteful, policy-safe terms.`
        : `RENDER VARIATION #${attempt}: keep the same characters, location and key action, but freely re-interpret and re-frame the moment — change camera angle, distance, composition and lighting compared to any earlier attempt. Describe everything in neutral, tasteful, policy-safe terms.`)
      : "",
    // SAFE_SCENE_CLAUSE statt SAFE_PORTRAIT_CLAUSE: das Wort „portrait" steht an
    // Recency-Position und arbeitet gegen den Lipsync-Anker weiter oben („This is
    // a paused video of someone talking, NOT a portrait"). Die Klausel existiert
    // genau dafür und war bisher importiert, aber ungenutzt.
    attempt > 0 ? SAFE_SCENE_CLAUSE : "",

    // ── Safety / policy-friendly language ──
    "Content policy: depict clothed adults only. No nudity, no sexually suggestive content, no graphic violence, no minors. Tasteful cinematic storytelling.",
    // Das reine Text-Verbot reichte nicht: Veo bekam Startbilder mit
    // eingebrannter Untertitel-Box UND einer Player-Leiste samt Zeitstempel
    // geliefert. Eine Fortschrittsleiste ist eben weder „text" noch „caption"
    // noch „logo" — die Lücke muss explizit zu sein.
    "Nothing is laid on top of this picture: no captions, no subtitles, no watermark, no logo, no player controls, " +
      "no progress bar, no timestamp, no play button, no like/share icons, and no mock-up phone frame drawn around " +
      "the image. This is the raw camera image itself, not a screenshot of an app.",
    // Ein Motiv-Verbot war nie gemeint: ein Handy als Requisite muss in JEDEM
    // Modus erlaubt bleiben — sonst hebt der Block die Handlung der Szene auf.
    "Inside the scene, real objects are fine and expected: a phone, a laptop or a screen that is physically in the " +
      "room is part of the room and can be held, looked at and used. Any text on such a surface reads as light and " +
      "shapes only — never as legible words.",
    // Dieselbe dritte Kategorie wie im Reel-Zweig: Text in der AUSSTATTUNG.
    // Über Oberflächen formuliert, nicht über Gegenstände — sonst wäre es wieder
    // das Motivverbot, das den Handy-Bug ausgelöst hat.
    "Keep written words out of the set dressing: no posters, signs, banners, framed quotes, wall lettering, " +
      "whiteboards, packaging labels or book titles with readable writing. Where a surface in this location would " +
      "normally carry writing, it stays pure texture — shapes, tone and colour, never readable words in any language.",
    "Sharp focus on the action, plausible anatomy, realistic hands, true-to-style rendering. It must read as one frame of a larger, continuous scene.",
    // Gilt für JEDEN Frame, auch den Endframe: das Gesicht muss zur Kamera zeigen.
    // Sonst entsteht ein Frame-Paar, bei dem die Person am Clipende weggedreht ist
    // — und der Lipsync findet danach keinen Mund mehr.
    "The person who is talking (the main subject of this frame) has their face turned towards the camera and clearly visible: eyes towards the lens, face unobstructed. Never a back view, never a full profile, never turned away from the camera.",
    // „captured mid-motion (never a posed end-of-shot freeze)" ist raus: es
    // erzwang Bewegung im Bild UND widersprach dem Endframe-Lauf, der genau den
    // End-of-Shot-Zustand rendern soll. Die Kontinuitäts-Aussage bleibt.
    "Cinematography continuity: same lens character, exposure, white balance and colour grade as a single continuous production — this frame is one lived-in moment inside an ongoing take, ready to sit naturally next to the frames around it.",

    // ── ANSCHLUSS AN DIE VORSZENE (Story-Modus) ────────────────────────────
    // Den Block gab es hier bisher nicht: der Story-Modus verließ sich allein
    // auf das Referenzbild. Ein Bild zeigt aber einen Zustand, keinen
    // FORTSCHRITT — „geht die Treppe hinauf" und „steht wieder unten" sehen als
    // Einzelbilder beide plausibel aus. Ohne diese Zeilen fällt die Handlung
    // deshalb regelmäßig auf ihren Ausgangspunkt zurück.
    prevScene && prevEndState
      ? `CONTINUES FROM THE PREVIOUS SCENE. That scene ended with: ${soften(prevEndState)}. ` +
        "This frame starts from exactly that state. Whatever progress was made is kept: if the person had moved " +
        "somewhere, they are there or further along — never back at the earlier point. The previous action is " +
        "finished and is never rewound, undone or replayed. What they are DOING now comes from the ACTION above."
      : "",

    // Bewusst als letzter Block — siehe Definition von `closingFrameBlock`.
    closingFrameBlock,
  ].filter(Boolean).join("\n");
}

/**
 * Build the prompt for the video-generation API (Veo3 / fal.ai).
 * Targets short clips with the pacing/mood/hook directives the user picked.
 */
/** Fester Stimm-Deskriptor — WORTGLEICH über alle Clips, damit Veo möglichst
 *  dieselbe Sprecherstimme trifft (Veo bietet kein echtes Voice-Locking). */
function voiceDescriptor(g: "male" | "female" | "neutral"): string {
  if (g === "male") return "a warm, medium-deep, steady male voice, natural and clear, at a moderate, even pace";
  if (g === "female") return "a warm, clear, steady female voice, natural and clear, at a moderate, even pace";
  return "a calm, neutral, steady voice, natural and clear, at a moderate, even pace";
}

/**
 * Was Kling NICHT zeigen soll. Eigenes Feld (`negative_prompt`), zählt deshalb
 * nicht gegen das 2500-Zeichen-Limit des Haupt-Prompts — der Platz dort ist zu
 * knapp, um Verbote unterzubringen.
 */
/**
 * Spec §4a (Torsten Jaeger, Aug 2026): erzeugt den Sprechtext für ein
 * Talking-Avatar-Video aus einer Themen-Vorgabe. Wortlaut 1:1 aus der Spec —
 * der Output geht unverändert als `text` an /api/ai/talking-avatar.
 */
export function buildTalkScriptPrompt(userInput: string): string {
  return `Du schreibst den gesprochenen Text für ein kurzes, vertikales Social-Media-Video,
in dem eine Person direkt in die Kamera spricht.

Regeln:
- Sprache: Deutsch, natürlich gesprochen, KEIN Marketing-Sprech, kein KI-Sound.
- Länge: 2–4 Sätze (ca. 8–15 Sekunden Sprechzeit). Kurz und wirkungsvoll.
- Erster Satz = starker Hook (Frage oder überraschende Aussage), stoppt das Scrollen.
- Letzter Satz = klare Aufforderung oder Punchline.
- Nur der reine Sprechtext. KEINE Regieanweisungen, KEINE Emojis, KEINE Hashtags,
  keine Anführungszeichen.

Thema/Vorgabe des Nutzers: ${userInput}`;
}

export const KLING_NEGATIVE_PROMPT =
  "subtitles, captions, text overlay, watermark, logo, timestamp, progress bar, player controls, " +
  "readable text, printed words, lettering, signage, poster with text, label with text, handwriting, " +
  "morphing face, changing identity, extra fingers, deformed hands, warped anatomy, " +
  "camera cut, scene change, teleporting objects, flickering, blur, low quality";

/** Kling erlaubt 2500 Zeichen; etwas Luft lassen, statt am Limit zu kratzen. */
const KLING_PROMPT_BUDGET = 2200;

/**
 * Video-Prompt für Kling — bewusst KEINE gekürzte Fassung von
 * `buildSceneVideoPrompt`, sondern ein anderer Prompt.
 *
 * WARUM anders statt kürzer: Der lange Prompt gibt den Großteil seiner Zeichen
 * dafür aus, Aussehen, Ort, Outfit, Licht, Stil und Format festzunageln — bei
 * Veo nötig, weil dort nur EIN Startbild mitgeht. Kling bekommt Start- UND
 * Endframe als Bilder; all das ist damit bereits entschieden und nochmal in
 * Worten zu beschreiben verbraucht nur Platz und lädt zum Abweichen ein.
 *
 * Übrig bleibt genau das, was ein Bild NICHT sagen kann: die Bewegung dazwischen,
 * ihr Tempo und was die Kamera dabei tut. Deshalb ist diese Fassung nicht
 * schlechter als die lange — sie ist für ein Modell mit zwei Frames die
 * passendere.
 *
 * Das harte Kappen am Ende ist nur eine Rückversicherung: der Text bleibt
 * normalerweise weit darunter.
 *
 * ═══ DIESER PROMPT SIEHT KEINE SPRECH-SZENEN ═══
 * Szenen mit gesprochener Zeile laufen ausnahmslos über Kling `ai-avatar`;
 * `generateSceneVideo` in StoryPage kehrt für sie vorher zurück
 * (`if (sceneUsesTalkingAvatar(scene))`). `opts.speaksOnCamera` kann am einzigen
 * Aufrufer deshalb nie `true` werden — der Sprech-Zweig unten ist ein
 * Bereitschaftsteil für den Fall, dass wieder klassisch gerendert wird, und
 * ändert HEUTE nichts am Ergebnis.
 *
 * Wer also eine Mund-, Sprecher- oder Ein-Gesicht-Regel für Sprech-Szenen
 * einbauen will, muss das im BILD-Prompt tun (`buildSceneImagePrompt`, Block
 * „ONE FACE ONLY"): `ai-avatar` kennt überhaupt keinen Prompt, das Standbild ist
 * dort die einzige Steuerung.
 */
export function buildKlingVideoPrompt(opts: {
  scene: StoryScene;
  mode: StoryMode;
  pacing: string;
  mood: string;
  voiceMode?: "sprecher" | "dialog";
  /** Spricht die Person in dieser Szene sichtbar? Dann braucht es ein Mundbild. */
  speaksOnCamera?: boolean;
  /** Wie viel machen die Personen mit den Händen? Ohne Angabe „calm" = bisher. */
  actionLevel?: ActionLevel;
}): string {
  const { scene, mode, pacing, mood } = opts;

  const action = (scene.keyAction || scene.summary || "").trim();
  const endState = (scene.endState || "").trim();

  // Kamerafahrt in Klartext. „keine" heißt bei Kling ausdrücklich: Kamera steht —
  // ohne diesen Satz erfindet das Modell gern eine langsame Fahrt dazu.
  const moveMap: Record<string, string> = {
    "keine":     "The camera stays locked off — no push, no pan, no drift.",
    "dolly-in":  "The camera pushes slowly in towards the subject.",
    "dolly-out": "The camera pulls slowly back away from the subject.",
    "truck":     "The camera tracks sideways, keeping the subject in frame.",
    "tilt":      "The camera tilts smoothly.",
    "pan":       "The camera pans smoothly across the scene.",
    "crane":     "The camera cranes through the scene in one continuous move.",
    "arc":       "The camera arcs around the subject.",
  };
  const cameraLine = moveMap[scene.movement] || moveMap["keine"];

  // ERZÄHL-FOKUS: auch bei „instant-action" heißt sofort loslegen SPRECHEN,
  // nicht körperliche Action — die BEWEGUNG bleibt natürlich. Nicht mehr „calm":
  // das dämpfte im Reel auch den Ausdruck, und die Clips wirkten teilnahmslos.
  // AKTIONS-LEVEL: „at full energy" ist die LAUTSTÄRKE, „no settling-in" ist das
  // TEMPO. Nur das erste kippt — ein Clip, der sich erst sammelt, ist in beiden
  // Modi verschenkt, weil er von acht Sekunden zwei ohne Aussage verbraucht.
  const paceLine = pacing === "instant-action"
    ? (opts.speaksOnCamera
        ? (opts.actionLevel === "active"
            ? "The telling starts on the very first frame at full energy — no settling-in; the body movement stays natural, the face does not hold back."
            : "The telling is already under way on the very first frame — no settling-in and no warm-up, but spoken calmly: an even, conversational delivery, the face alive and present rather than turned up.")
        : "The moment is already under way on the very first frame — no settling-in; movement stays natural while the reaction on the face is fully alive.")
    : "Measured, natural motion at an even pace.";

  // AKTIONS-LEVEL im BEWEGTBILD. Steht direkt hinter `paceLine`: die Menge an
  // Bewegung gehört zum Tempo, nicht zur Schnitt-Regel. Bewusst FRÜH im Array —
  // der Prompt wird am Ende bei KLING_PROMPT_BUDGET hart abgeschnitten, und was
  // hinten steht, kann bei langen Szenen wortlos wegfallen.
  //
  // KEIN WIDERSPRUCH zur `endState`-Zeile darunter („do not invent extra
  // movement"): die verbietet ERFUNDENE Zusatzbewegung, diese hier verlangt die
  // BESCHRIEBENE.
  const handsLine = opts.actionLevel === "active"
    ? "The hands stay busy for the whole clip: the action above is carried out visibly and completely — gripping, " +
      "lifting, pointing, turning, setting down — with the arms away from the torso and the object readable in " +
      "frame throughout. Broad, purposeful hand and arm movement; one continuous action, never fidgeting, never a " +
      "second unrelated one. The face and the mouth stay uncovered at all times."
    : "The hands stay calm: only what the action above actually describes — no invented gesture, no pointing and no " +
      "wide arm movement beyond it.";

  // Mimik ist im Reel das, was der Zuschauer zuerst sieht — und Kling animiert
  // ein Gesicht sonst gern nur minimal um das Standbild herum.
  const expressionLine = mode === "reel"
    ? "The face stays expressive throughout: the emotion of the scene is clearly visible and alive — brows, eyes and mouth move with it. Never a blank, frozen or merely polite face."
    : "";

  // Storyboard-Felder sind DEUTSCH, der Rahmen ist englisch. Sie in einen
  // englischen Satz einzubauen („The subject steigt die Treppe hinauf") erzeugt
  // einen grammatisch kaputten Mischsatz. Als beschriftetes Feld davorgestellt
  // bleiben beide Sprachen intakt und das Modell liest es als Angabe, nicht als
  // Satzfragment.
  const dot = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);

  // Wer ist überhaupt im Bild? Aus den Storyboard-Beteiligten („Anna, Mark").
  const people = String(scene.participants || "")
    .split(/[,;/&]|\bund\b|\band\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
  // `scene.speaker` zuerst — im Reel-Standard („sprecher") gibt es kein
  // Namenspräfix, und ohne das Feld hieße der Sprecher hier immer nur
  // „the person facing the camera", obwohl der Name längst feststeht.
  const speakerName = (scene.speaker || "").trim()
    || (opts.voiceMode === "dialog" ? splitDialogLine(scene.dialogText || "", people).speaker : "");
  const soloSpeakerLine = opts.speaksOnCamera && people.length > 1
    ? `SOLO SPEAKER: exactly ONE person speaks in this clip — ${speakerName || "the person facing the camera"}. ` +
      "Only their lips move with the words. EVERY other person in the shot keeps their lips CLOSED and still for " +
      "the whole clip: no lip movement, no mouthing along, no talking, no silent background conversation. They " +
      "listen and react with their eyes and body at most. One voice on the soundtrack means exactly one moving mouth.\n" +
      // Das Standbild zeigt nur ein Gesicht — der Clip muss es dabei belassen.
      // Ohne diese Zeile dreht das Modell die abgewandte Person gern im Verlauf
      // zur Kamera herum, und ab dieser Sekunde stehen wieder zwei Gesichter im
      // Bild, von denen eines stumm mitzureden scheint.
      "ONE FACE ONLY: the framing keeps exactly one readable face for the entire clip. Whoever is turned away in the " +
      "opening frame STAYS turned away — they never rotate towards the lens, never lift their face into view, and the " +
      "camera never travels around them. No second face appears at any point."
    : !opts.speaksOnCamera && people.length > 1
      ? "NOBODY speaks in this clip: every person in the shot keeps their lips closed and still — no talking, no mouthing words."
      : "";

  const lines = [
    // 1. Die Bewegung — das Einzige, was die beiden Frames nicht schon sagen.
    action ? `Action: ${dot(action)}` : "Action: the subject continues the action already underway.",
    // 2. Wohin sie führt. Der Endframe zeigt es, aber ein Bild sagt nicht „arbeite
    //    darauf hin" — ohne diese Zeile ist die Bewegung nach zwei Sekunden fertig
    //    und der Rest des Clips steht still.
    // Halte-Klausel wie im Veo-Prompt: bei Erzähl-Szenen ist der Endzustand oft
    // fast der Startzustand — eine Dauerbewegungs-Pflicht ließe das Modell
    // Bewegung erfinden, nur um die Vorgabe zu erfüllen.
    // „keeps talking" nur, wenn die Person auch sichtbar spricht — sonst
    // erzeugte die Halte-Klausel stumme Lippenbewegung ohne Ton.
    endState
      ? `Ends exactly here: ${dot(endState)} The scene settles naturally into that state on the last frame — not earlier, no overshoot. If it is close to the start state, ${opts.speaksOnCamera ? "the person simply keeps talking" : "the moment simply continues calmly"}; do not invent extra movement.`
      : "The scene stays alive and settles naturally on the final frame — no invented wandering.",
    cameraLine,
    paceLine,
    handsLine,
    // 3. Ein Schnitt mitten im Clip ist der häufigste Ausfall bei Image-to-Video —
    //    das Modell „löst" eine zu große Differenz zwischen den Frames sonst gern
    //    mit einem harten Cut statt mit Bewegung.
    "One single continuous take: no cut, no jump, no scene change, no dissolve. Lighting, wardrobe and surroundings stay exactly as in the frames.",
    // Der Blick zur Kamera ist keine Stil-Frage, sondern eine harte Anforderung:
    // ein abgewandtes Gesicht hat kein brauchbares Mundbild, und der
    // Lipsync-Schritt danach hat dann nichts, worauf er aufsetzen kann.
    // „unobstructed" meint das GESICHT des Sprechers, nicht den ganzen Frame:
    // bei einer Schulter-Einstellung steht die zuhörende Person angeschnitten im
    // Vordergrund, und das ist gewollt. Ohne diese Unterscheidung stünde die
    // Zeile gegen die Ein-Gesicht-Regel darunter, und das Modell räumte die
    // Schulter weg — womit beide Personen wieder frontal im Bild stünden.
    opts.speaksOnCamera
      ? "The speaker stays FACING THE CAMERA the entire time and speaks directly into the lens: eyes on the lens, their face clearly readable and never covered, mouth moving naturally. They never turn away, never look off-screen, and never show their back or profile." +
        (people.length > 1 ? " A listener's shoulder or back of head may sit in the foreground — that is part of the framing and stays where it is." : "")
      : "The subject keeps their face turned towards the camera and stays clearly visible throughout — never turning their back to the lens.",
    // NUR EIN MUND BEWEGT SICH.
    //
    // Unter dem Clip liegt genau EINE Tonspur. Sind zwei Personen im Bild und
    // das Modell animiert beide Münder, redet sichtbar jemand mit, den niemand
    // hört — das fällt erst im fertigen Schnitt auf und macht den bezahlten Clip
    // wertlos. Ein geschlossener Mund im Startbild reicht dagegen nicht: das
    // Videomodell darf ihn öffnen, wenn nichts es davon abhält. Deshalb hier,
    // und im Bild-Prompt zusätzlich für den Frame selbst (dort ist es die einzige
    // Handhabe, weil `ai-avatar` gar keinen Prompt kennt).
    soloSpeakerLine,
    expressionLine,
    // Mood NICHT roh durchreichen: „dramatic" als nacktes Wort schiebt Kling
    // Richtung inszenierter Dramatik — die gemappte Fassung legt die Stimmung in
    // Gesicht und Vortrag, wie überall sonst im Erzähl-Fokus.
    mood && mood !== "natural" ? `Overall mood: ${mood} — carried by the face and the delivery, never by staged action.` : "",
    mode === "reel" ? "Social-video pacing, shot handheld-steady — energetic, never sluggish." : "",
  ].filter(Boolean);

  return lines.join(" ").slice(0, KLING_PROMPT_BUDGET);
}

/**
 * NICHT MEHR IM EINSATZ (Stand 2026-08-06): der lange Veo-Prompt. Veo ist raus,
 * die Clips laufen ausschliesslich ueber `buildKlingVideoPrompt` — diese
 * Funktion wird von keiner Stelle mehr aufgerufen. Wer hier etwas aendert (etwa
 * eine Sprech- oder Mundregel), aendert nichts am Ergebnis; der wirksame Ort ist
 * der Kling-Prompt oben und der Bild-Prompt.
 */
export function buildSceneVideoPrompt(opts: {
  scene: StoryScene;
  mode: StoryMode;
  pacing: string;
  mood: string;
  colorMood: string;
  effectiveHook?: string;
  language: string;
  aspect: string;
  voiceMode: "sprecher" | "dialog";
  /** Für eine über alle Clips konstante Sprecherstimme. */
  speakerGender?: "male" | "female" | "neutral";
  /** Voice-Lock: die Stimme kommt NICHT mehr von Veo, sondern aus TTS und wird
   *  danach untergelegt (Sprecher) bzw. per Lipsync aufgesetzt (Dialog).
   *  Aus/undefiniert → Prompt exakt wie bisher. */
  voiceLock?: boolean;
  /** Position of this scene in the reel (0-based) + total — drives the
   *  continuous-take in/out directives so segments flow into each other. */
  sceneIndex?: number;
  sceneCount?: number;
  /** When true („Nahtlose Übergänge"), this clip is one segment of a single
   *  continuous video: it must start/end mid-motion so cuts read as seamless.
   *  When false in reel mode, the clip uses hard-cut grammar instead (start
   *  instantly, end abrupt — the visible cut is deliberate). */
  continuity?: boolean;
  /** Reel-Stil. Ohne Angabe (bzw. "explainer") ist die Ausgabe exakt wie bisher. */
  reelStyle?: ReelStyle;
  /** Die durchgehende Situation des Vlog-Reels — wortgleich in jedem Clip. */
  situation?: ReelSituation | null;
  /** Vlog-Outro: DIESER Clip schneidet bewusst in einen anderen Kontext. */
  isOutro?: boolean;
  /**
   * Zustandsanschluss aktiv: das Startbild dieses Clips wurde aus dem Zustand
   * gebaut, in dem der VORIGE Clip geendet hat. Veo animiert sonst gelegentlich
   * einen „Reset" — die Person setzt sich am Clipanfang noch einmal hin, weil
   * das Modell den Anfang der bereits geschehenen Handlung nachspielt.
   * Hinter dem Flag, damit die Ausgabe bei ausgeschalteter Funktion
   * byte-identisch bleibt.
   */
  stateCarryOver?: boolean;
}): string {
  const { scene, mode, pacing, mood, colorMood, effectiveHook, language, aspect, voiceMode } = opts;
  const speakerGender = opts.speakerGender ?? "neutral";
  const langName = getLanguageName(language);

  // ── Clip-Grammatik ─────────────────────────────────────────────────────────
  // Das Reel wird aus Einzelclips montiert. Zwei Betriebsarten:
  // • Hard Cuts (Reel-Standard): jeder Clip ist ein in sich stehender Beat, der
  //   sofort auf voller Energie startet und abrupt endet — der sichtbare Schnitt
  //   ist gewollt (Pattern Interrupt).
  // • Continuity („Nahtlose Übergänge"): jeder Clip verhält sich wie ein Stück
  //   aus EINEM längeren Take — enter already moving, leave still moving — damit
  //   die Schnitte unsichtbar werden (Veos Intro→Beat→Outro-Ausklang erzeugt
  //   sonst Freeze/Jitter an jedem Join).
  const isReel = mode === "reel";
  // Reels werden IMMER hart geschnitten — die Continuous-Take-Grammatik gilt nur
  // noch im General-Modus mit aktivierten „Nahtlosen Übergängen".
  const continuity = !!opts.continuity && !isReel;
  const idx = opts.sceneIndex ?? 0;
  const isFirst = idx === 0;
  const isLast = opts.sceneCount ? idx === opts.sceneCount - 1 : false;

  // ── Hard-cut reel grammar ──────────────────────────────────────────────────
  // Erklär-/Erzähl-Reels werden mit BEWUSST sichtbaren harten Schnitten
  // montiert: jeder Clip ist ein in sich stehender Beat (eine Aussage + eine
  // Aktion), startet sofort auf voller Energie und endet abrupt ohne Ausklang —
  // der Schnitt selbst ist der Pattern Interrupt.
  const hardCuts = isReel;

  // ── Vlog-Reel-Grammatik ────────────────────────────────────────────────────
  // Genau umgekehrt zum Erklär-Reel: NICHT „jeder Clip ein neuer Aufbau",
  // sondern „alle Clips derselbe Aufbau, nur zu verschiedenen Zeitpunkten".
  // Der Nutzer sah trotz „no fade, no dissolve" immer wieder Übergänge — reine
  // Verbote reichen nicht. Deshalb steht hier zuerst das positive, konkrete
  // Bild der Situation (derselbe Raum, dieselbe Kamera, nur Zeit entfernt) und
  // das Konzept beim Namen („jump cut", „the editor removed the boring parts").
  // Die Verbotsliste folgt erst danach.
  const vlogActive = isReel && opts.reelStyle === "vlog";
  const situation = vlogActive ? (opts.situation ?? null) : null;
  const isOutro = vlogActive && !!opts.isOutro;
  /** Hat DIESE Szene überhaupt Sprechtext? Steuert alles, was einen Mund bzw.
   *  einen Blick in die Linse voraussetzt — ohne Zeile darf der Clip die Person
   *  nicht zur Kamera zurückdrehen. */
  const vlogHasSpeech = !!scene.dialogText?.trim();
  /** Wie `vlogHasSpeech`, aber für ALLE Reel-Stile: Hat dieser Clip sichtbar
   *  gesprochene Sprache? Der Voice-Lock im Sprecher-Modus rendert den Clip
   *  bewusst STUMM (die Stimme kommt später per TTS/Lipsync drauf) — dort darf
   *  keine Zeile „already speaking" oder „finish the spoken line" behaupten,
   *  sonst steht sie direkt neben dem eigenen SILENT-CLIP-Verbot. */
  //  ÜBER `opts.`, nicht über die lokalen Konstanten: `voiceLock` wird erst
  //  weiter unten deklariert (const, kein Hoisting) — hier stünde sonst ein
  //  TDZ-Fehler zur Laufzeit.
  //  Muss exakt zur SILENT-CLIP-Bedingung weiter unten passen: dort ist der
  //  Clip nur noch im STORY-Modus mit Off-Sprecher stumm — im Reel spricht die
  //  sichtbare Person immer selbst.
  const clipHasVisibleSpeech =
    !!scene.dialogText?.trim() &&
    !(!!opts.voiceLock && opts.voiceMode === "sprecher" && !isReel);

  // ── Trennschnitt: „sprechen" ist NICHT dasselbe wie „in die Linse schauen" ──
  // KONFLIKTAUFLÖSUNG: Die alte Fassung („face fully visible and near-frontal —
  // if the shot/angle listed above conflicts with this, direct address wins")
  // war die zweite, unabhängige Instanz der „direct address wins"-Regel — hier
  // sogar über die volle Clipdauer und durch den Lipsync-Zwang abgesichert.
  // Selbst ein vollständig reparierter BILD-Prompt hätte nichts genützt: Veo
  // dreht die Person an dieser Stelle wieder zur Linse zurück und lässt die
  // Requisite weg. Mund/Lipsync bleibt Pflicht, die Blickrichtung wird zur
  // Ableitung aus der ACTION mit Linsenkontakt als Default — wortgleich zum
  // Bild-Prompt, damit Standbild und Clip nicht auseinanderlaufen.
  // Beide Konstanten gelten für BEIDE Vlog-Codepfade (Dialog- und Sprecher-
  // Modus) — sonst greift der Fix nur in einem davon.
  const VLOG_SPEECH_DIRECTION =
    "The mouth is always moving with the words: animate accurate lip-sync with natural mouth, jaw and facial " +
    "movement precisely matching these words, synced to the audio; never keep the mouth closed or static while the " +
    "line is spoken. Where the eyes and the face point is set by the ACTION, not by the speaking — creator-style eye " +
    "contact straight into the lens as the default, but if the ACTION has them looking at an object, down, or away, " +
    "they do that and keep talking. Keep enough of the face readable for the speech to land wherever the action allows.";
  // KONFLIKTAUFLÖSUNG: „never becomes the main event" war die exakte Negation von
  // „THIS is what happens in this clip" — und stand im Prompt DANACH. Zusammen
  // mit „one focal action" bekam das Modell die Wahl zwischen Sprechen und
  // keyAction und hier gesagt, welche verlieren soll. „hands busy with it" band
  // die Hände wieder an die Dauer-Tätigkeit, „eyes still on the lens" verbot den
  // Blick auf eine Requisite.
  const VLOG_ACTIVITY_SYNC =
    // ERZÄHL-FOKUS: der frühere Schluss („that is what this clip is about, and
    // their hands and eyes go with it") erklärte die ACTION zum Star des Clips.
    // Die Entkonflikt-Funktion bleibt (Sprechen zählt nicht als zweite Action),
    // aber der Träger ist das Erzählen — die Geste läuft nebenher.
    // Gleichgerichtet mit VLOG_SPEECH_DIRECTION und der ACTION-Vorrangregel: das
    // Sprechen läuft DURCH, die ACTION bestimmt Hände und Blick. Eine Fassung,
    // die das Erzählen zum Träger erklärt und die ACTION deckelt („briefly",
    // „eyes come back"), stünde gegen beide Nachbarzeilen — ruhig wird der Clip
    // über die ruhige keyAction, nicht über eine Gegenregel hier.
    "ACTIVITY SYNC: the person keeps talking the whole time, whatever else they are doing. If the ACTION is a step " +
    "in what they were already busy with, we watch that continue at its own casual pace. If the ACTION is something " +
    "else, they set the earlier thing aside and do the ACTION — calmly and at an everyday pace, with their hands and " +
    "eyes going with it.";

  const vlogTakeLine = isOutro
    ? "FINAL CLIP — DELIBERATE CONTEXT CUT: the reel has been one continuous recording until now; this last clip " +
      "hard-cuts out of it into a different context — typically outside, or onto the result of the activity. " +
      "It is the SAME person, the SAME outfit, the SAME hair and the SAME production look, lens character and colour " +
      "grade; only the surroundings are new. The cut into this clip is hard: no fade, no dissolve, no cross-fade, " +
      "no morph, no wipe, no transition effect of any kind at the start or the end. The person keeps talking straight " +
      "into the lens and lands the punchline or call-to-action here."
    : "VLOG JUMP CUT — this clip is a piece cut out of ONE long, continuous recording. The cut before it and the cut " +
      "after it remove TIME, never place: the neighbouring clips show the SAME room, the SAME camera position, height " +
      "and distance, the SAME background, the SAME outfit and the SAME light. Between the clips the person has simply " +
      "carried on with what they were doing, because the editor removed the boring seconds in between. That jump — " +
      "identical setup, person suddenly in a different posture — IS the edit, and it is exactly what a jump cut looks like.\n" +
      // KONFLIKTAUFLÖSUNG, vier Probleme in zwei Sätzen:
      // (1) „talks straight into the lens FOR THE WHOLE CLIP" war ein Blick-Lock
      //     über die vollen 8 Sekunden — es gab kein Zeitfenster, in dem die
      //     Person auf ein Objekt oder von der Kamera weg hätte schauen dürfen.
      // (2) „the spoken words carry the message, NOT THE PICTURE" erklärte die
      //     Bildhandlung ausdrücklich für entbehrlich — genau die Ebene, auf der
      //     die Szenenbeschreibung lebt.
      // (3) Die Zeile hing NICHT an `scene.dialogText`: ohne Sprechtext war das
      //     Standbild sauber (kein Talking-Head-Block), der Video-Prompt erzwang
      //     aber trotzdem „talks straight into the lens" und widersprach dabei
      //     seinem eigenen NO-SPOKEN-WORDS-Satz — Veo drehte die Person zurück
      //     und zerstörte die im Standbild korrekt umgesetzte Handlung. Deshalb
      //     ist der Absatz jetzt an vorhandenen Sprechtext gekoppelt.
      // (4) „their ordinary activity" band den Clip erneut an die Dauer-Tätigkeit
      //     aus `situation` statt an die Action dieses Clips.
      (vlogHasSpeech
        ? "One person talks continuously for the whole clip while carrying on in the same room. Their eyes are on " +
          "the lens whenever the ACTION does not send them somewhere else — down at their hands, at an object, or " +
          "away from the camera. The delivery is unremarkable and everyday; what they DO is what the ACTION line says.\n"
        : "") +
      "NO TRANSITION OF ANY KIND: never fade in or out, never dissolve, never cross-fade, never morph, never whip-pan, " +
      "never wipe, never blur into or out of the neighbouring clips, never dip to black or white. " +
      // Vorher: „Do not begin or end with a movement that could be read as leading
      // into another shot." Eine Handlung wie „geht zwei Schritte" oder „dreht
      // sich weg" IST wörtlich eine solche Anschlussbewegung — zusammen mit dem
      // vorgeschriebenen Endzustand blieb kein Zeitfenster, in dem die Handlung
      // hätte stattfinden dürfen. Gemeint war immer nur die Schnittgrammatik.
      "The clip never hands a movement over to the next clip and never picks one up from the previous one — " +
      "whatever the ACTION is, it plays out inside this clip. The clip simply exists, and then it stops.";

  // ── Zustandsanschluss ──────────────────────────────────────────────────────
  // Das Startbild dieses Clips zeigt den Zustand, in dem der VORIGE Clip
  // aufgehört hat (Person steht, Gegenstand liegt woanders). Veo plant den Clip
  // aber gern von der Handlung her, die es aus dem Prompt-Kontext ableitet, und
  // spielt dann deren ANFANG nach — die Person setzt sich am Clipanfang wieder
  // hin, um danach aufzustehen. Genau das verbietet diese Zeile.
  // Kein Vorranganspruch: es ist eine Aussage über den ERSTEN FRAME und die
  // Richtung der Zeit, nicht darüber, was passiert (das bleibt die ACTION-Zeile).
  const stateCarryLine = opts.stateCarryOver && vlogActive && !isOutro
    ? "The clip begins exactly in the state of its start frame and moves forward from there. Do NOT rewind the person " +
      "into an earlier posture, do NOT re-stage the beginning of what already happened in the previous clip, and do NOT " +
      "reset objects to where they were before."
    : "";

  const continuousTakeLine = vlogActive
    ? vlogTakeLine
    : hardCuts
    ? "HARD-CUT REEL EDITING — this clip is ONE self-contained beat of a vertical telling-style reel. " +
      "The reel is assembled with deliberate, clearly VISIBLE hard cuts: every clip is an obviously different camera " +
      "setup, and the cut itself is the pattern interrupt. Never blend, morph, fade or dissolve into the neighbouring " +
      "clips. One spoken statement, one calm moment, one emotional read — this clip never starts telling the next beat."
    : continuity
      ? "CONTINUOUS TAKE — this clip is ONE segment of a single, unbroken longer video, not a standalone clip. " +
        "Keep camera energy, lens, lighting, colour grade and motion rhythm seamlessly continuous with the neighbouring segments."
      : "";
  // Die durchgehende Situation wortgleich in JEDEN Clip — derselbe Anker wie im
  // Bild-Prompt. Beim Outro bleibt nur der personenbezogene Teil gültig.
  const vlogSituationLine = situation
    ? (isOutro
        ? `SAME PERSON, NEW CONTEXT: the person from the rest of the reel, still wearing ${situation.outfit} — same outfit, same hair, same styling.`
        // Wie im Bild-Prompt: Ort, Outfit und KAMERAPOSITION sind fix, die
        // `activity` ist nur der Rahmen.
        //
        // KONFLIKTAUFLÖSUNG: Der Selbstwiderruf zeigte ins Leere — „the Action
        // line below" steht in Wahrheit rund neun Zeilen DARÜBER (unterhalb
        // folgen nur noch Wardrobe, Start/Stop und Speech). Der
        // Vorrangmechanismus war hier strukturell tot, die Dauer-Tätigkeit stand
        // also unwidersprochen im Prompt. Statt den Verweis zu reparieren, fällt
        // der zweite konkurrierende „WINS"-Anspruch ganz weg (es gibt genau
        // einen, in der ACTION-Zeile) und die Tätigkeit wird von einer
        // Zustandsbeschreibung zu einer reinen Begründung.
        : `THE SHOOT (same in every clip of this reel): Room: ${situation.setting}. ` +
          `Outfit: ${situation.outfit}. Camera: ${situation.cameraSetup} — the camera stays on that exact spot in ` +
          `every clip.\n` +
          `The session started while the person was busy with ${situation.activity}. That is the reason they are in ` +
          `this room, nothing more — it is never a source of what happens in this clip.`)
    : "";
  // Garderobe auch INNERHALB des Clips festnageln — und zwar unabhängig davon,
  // ob eine `situation` vorliegt. Veo wechselt sonst mitten im Clip das
  // Kleidungsstück oder rendert erfundene Marken-Prints darauf.
  const wardrobeLine = isReel && !isOutro
    ? "WARDROBE LOCK: the clothing seen in the opening frame stays EXACTLY the same for the whole clip and matches " +
      "every other clip of this reel — same garment, same colour, same cut, same accessories, same hairstyle. " +
      "It never changes, not even slightly. NO text, letters, numbers, logos or graphic prints on the clothing."
    : "";
  // KONFLIKTAUFLÖSUNG: „already mid-activity" fixierte schon den ERSTEN Frame auf
  // die Dauer-Tätigkeit. „NO wind-up" und „NO getting into position" verboten
  // wörtlich die Bewegungsphasen, aus denen manche Handlungen bestehen —
  // Aufstehen und ein Positionswechsel lesen sich für das Modell als „getting
  // into position", also blieb der Clip im sitzenden Ausgangszustand. Die drei
  // gestrichenen Teilverbote sind redundant: „NO fade-in, NO camera settle, NO
  // pause before the first word" decken die eigentliche Absicht vollständig ab.
  // Der Sprech-Teil hängt an `vlogHasSpeech` — aus demselben Grund wie der
  // zweite Absatz von `vlogTakeLine`: ohne Zeile setzt der Prompt sonst
  // „already speaking" direkt neben sein eigenes NO-SPOKEN-WORDS.
  const startMotionLine = vlogActive
    ? "Start INSTANTLY on the very first frame — " +
      (vlogHasSpeech ? "the person is already speaking — the first word is already out — and the ACTION already under way. " : "the ACTION is already under way. ") +
      "The recording has been running for a while and we simply join it here. NO fade-in, NO dip from black, " +
      "NO camera settle, NO greeting, NO hello" + (vlogHasSpeech ? ", NO pause before the first word." : ".")
    : hardCuts
    // ERZÄHL-FOKUS: „at full energy" forderte körperliche Energie ab Frame 1 —
    // der Sofort-Start (Schnitt-Grammatik) bleibt, die Energie liegt im Sprechen.
    // Der Sprech-Teil hängt an `clipHasVisibleSpeech`, aus demselben Grund wie im
    // Vlog-Zweig darüber: in einem stumm gerenderten Clip stünde „already
    // speaking" direkt neben dem eigenen SILENT-CLIP-Verbot.
    ? "Start INSTANTLY on the very first frame — " +
      (clipHasVisibleSpeech ? "the person is already speaking on the very first frame, the telling already under way. " : "the moment is already under way. ") +
      "NO fade-in, NO dip from black, NO camera settle, NO wind-up, NO greeting pause."
    : continuity && !isFirst
      // Die Unsichtbarkeit der Joins braucht ein LAUFENDES Geschehen, und bei
      // ruhigem Erzählen ist das laufende Geschehen das Sprechen selbst.
      // Gegenstück zum Clip-ENDE weiter unten: „mid-sentence" ist gestrichen,
      // weil das TTS in JEDEM Modus pro Szene einzeln läuft — jede Zeile
      // eröffnet ihren eigenen Satz, ein angefangener kommt nie an.
      ? "Start already speaking or mid-gesture on the very first frame: the supplied opening frame is a live moment of " +
        "an ongoing take — continue it instantly. NO fade-in, NO dip from black, NO settling, NO static hold, NO re-establishing pause at the start."
      : "";
  /**
   * Wohin der Clip LÄUFT — als Textfassung des vorgegebenen Endframes.
   *
   * Veo bekommt den Endframe zwar als Bild, aber das Bild sagt nur „so sieht es
   * am Schluss aus", nicht „arbeite darauf hin". Ohne diese Zeile verbraucht das
   * Modell die Bewegung gern in der ersten Sekunde und steht dann still, oder es
   * erfindet eine Bewegung, die am vorgegebenen Endbild vorbeiläuft.
   */
  const targetStateLine = opts.scene.endState?.trim()
    // Halte-Klausel für ruhige Szenen: bei einer erzählenden Person ist der
    // Endzustand oft fast der Startzustand. „motion runs steadily" allein würde
    // das Modell dann Bewegung ERFINDEN lassen, um die Vorgabe zu erfüllen.
    ? `WHERE THIS CLIP ENDS: ${opts.scene.endState.trim()} — the scene settles naturally into exactly that state ` +
      "on the last frame, without reaching it early and freezing and without overshooting. If the end state is " +
      "close to the start, the person simply keeps telling naturally — do NOT invent extra movement or wandering to fill the clip."
    : "";

  const endHandling = vlogActive
    ? (isLast
        ? (vlogHasSpeech
            ? "Land the final line cleanly — punchline, conclusion or call-to-action — and stay fully present to the very " +
              "last frame. NO fade-out, NO wave, NO goodbye, NO sign-off gesture."
            : "Land the final beat cleanly and stay fully present to the very last frame. NO fade-out, NO wave, " +
              "NO goodbye, NO sign-off gesture.")
        // KONFLIKTAUFLÖSUNG: Der vorgeschriebene Endzustand („still busy with the
        // activity") ist bei jeder Handlung unerfüllbar, die von der Dauer-
        // Tätigkeit wegführt — am Clipende ist die Person definitionsgemäß nicht
        // mehr bei ihr. Da Veo den Clip vom Endzustand her plant, wurde die
        // Handlung gar nicht erst begonnen. Zusätzlich widersprach „NO final look
        // into the lens" dem „eyes still on the lens" aus ACTIVITY SYNC —
        // ersatzlos gestrichen, „NO goodbye" trägt die eigentliche Absicht.
        : "Stop ABRUPTLY mid-flow: " + (vlogHasSpeech ? "the spoken line is finished — the last word fully out — but " : "") +
          "the ACTION is not yet fully resolved when the clip ends. NO winding down, NO fade-out, NO slow-down, " +
          "NO freeze-frame, NO closing gesture, NO goodbye, NO pause after the last word — the editor simply cuts here, " +
          "in the middle of the activity.")
    : hardCuts
    ? (isLast
        ? "Land the final beat cleanly — punchline, conclusion or call-to-action — and stay fully present to the very last frame. NO fade-out."
        // ERZÄHL-FOKUS: „the action's impact" setzte einen Gag mit Impact-Moment
        // voraus. Der abrupte Schnitt selbst ist gewollte Schnitt-Grammatik.
        // „finish the spoken line" nur, wenn dieser Clip überhaupt sichtbar
        // spricht — sonst gäbe es keine Zeile zu beenden.
        : "End clean and ABRUPT: " +
          (clipHasVisibleSpeech ? "finish the spoken line, then stop. " : "let the moment land, then stop. ") +
          "NO fade-out, NO slow-down, NO freeze-frame, NO concluding pose — the edit hard-cuts straight to the next, visibly different setup.")
    : continuity
      ? (isLast
          ? "End on a clear payoff frame."
          // Spiegelbild des Continuity-Starts: „mid-movement" wird zu
          // NUR noch für die Geste: das TTS läuft in JEDEM Modus pro Szene
          // einzeln, ein über den Schnitt weiterlaufender Satz ist technisch
          // nirgends herstellbar — die Anweisung war nie einlösbar.
          : "End mid-gesture: the ongoing moment is still alive as the clip ends and flows directly into the next segment. " +
            "NO slow-down, NO fade-out, NO freeze-frame, NO final held pose, NO concluding beat — the take continues past the cut.")
      : "End on a payoff frame or an unanswered question.";
  // Hook: im Reel gehört der Hook NUR in den ersten Clip (jeder weitere Clip hat
  // seine eigene Aussage). Sonst: mit continuity off, wie bisher auf jedem Clip.
  const openingLine = (isReel ? isFirst : (!continuity || isFirst)) && effectiveHook
    ? `Opening directive: ${effectiveHook}`
    : "";

  // Speech handling. The previous build always tagged dialogue as "Optional
  // voiceover", which tells the model the words are OFF-screen narration → the
  // character's mouth never moves. Only narrator mode wants that. In dialog mode
  // the visible character must actually SAY the line on camera with lip-sync.
  const voiceLock = !!opts.voiceLock;
  let speechLine = "";
  if (scene.dialogText) {
    // Storyboard dialog lines are prefixed with the speaker name ("Isla: …").
    // Only dialog mode uses that convention — narrator text must stay verbatim
    // (a line like "Achtung: das wird teuer" would otherwise lose its opening).
    const split = splitDialogLine(scene.dialogText);
    const speaker = voiceMode === "dialog" ? split.speaker : "";
    // BUGFIX (kein Prompt-Konflikt): Der Vlog fällt im Sprecher-Modus in den
    // Direct-to-camera-Zweig weiter unten, bekam dort aber den UNGETRENNTEN
    // `scene.dialogText`. Liefert das Storyboard-Modell trotz Anweisung ein
    // „Name: "-Präfix, lippensynchronisiert Veo den Namen mit — und da im Vlog
    // danach die TTS-Spur per Lipsync aufgelegt wird, sind Mundbild und Ton um
    // ein Wort versetzt. Im Vlog spricht immer die sichtbare Person, also gilt
    // hier dieselbe Präfix-Trennung wie im Dialog-Modus.
    // `isReel` statt `vlogActive`: im ganzen Reel-Modus spricht die sichtbare
    // Person selbst, also gilt überall dieselbe Präfix-Trennung.
    const line = voiceMode === "dialog" || isReel ? split.line : scene.dialogText.trim();
    // Ebenfalls `!isReel`: ein stumm gerenderter Clip, auf den danach per
    // Lipsync eine Stimme gelegt wird, ergibt genau das falsche Mundbild.
    // Stumm bleibt nur noch der Story-Modus mit Off-Sprecher.
    if (voiceLock && voiceMode === "sprecher" && !isReel) {
      // Voice-Lock im Sprecher-Modus: die Stimme kommt später aus TTS und wird
      // per ffmpeg untergelegt. Veo bekommt die Skriptzeile deshalb GAR NICHT zu
      // sehen — es soll nur die Performance und das Timing liefern, damit das
      // Voiceover sauber darauf landet.
      //
      // NICHT im Vlog: dort ist die sichtbare Person die Stimme, und der
      // Bild-Prompt liefert bereits einen Talking-Head-Frame („mouth open
      // mid-speech"). Ein stummer Clip mit geschlossenem Mund wäre exakt das
      // Gegenteil des Formats — deshalb fällt der Vlog in den Direct-to-camera-
      // Zweig unten und wird danach per Lipsync mit der TTS-Spur belegt
      // (StoryPage: needsLipsync gilt im Vlog auch im Sprecher-Modus).
      speechLine =
        "SILENT CLIP — PERFORMANCE ONLY: no speech is generated for this clip. The visible person does NOT " +
        "talk and does NOT move their mouth as if speaking; keep the lips closed or naturally relaxed throughout. " +
        // ERZÄHL-FOKUS: früher trug „the key action … strongest moment" den
        // stummen Clip. Jetzt trägt ruhige Präsenz — die kleine Geste läuft
        // gleichmäßig nebenher, ohne Höhepunkt-Timing.
        "The person stays calmly present for the ENTIRE clip length, whatever small everyday movement the action " +
        "above describes — if any — running gently and evenly alongside. No dead air, no waiting, no staged peak, " +
        "no dramatic moment, and no gesture invented on top of what the action says. " +
        "A voiceover added later will carry the meaning; the picture simply accompanies it.";
    } else if (voiceMode === "dialog") {
      speechLine = isReel
        // Erklär-Reel: Creator spricht die Zeile DIREKT in die Linse, während
        // die Key Action im selben Bild passiert (selbst oder im Hintergrund).
        // Im Vlog gibt es keinen Gag, dessen Impact auf dem stärksten Wort
        // sitzen müsste — dort trägt die ACTION den Clip.
        ? (vlogActive
          ? `Direct-to-camera speech in ${langName}${speaker ? ` — ${speaker} speaks` : ""}: "${line}". ` +
            VLOG_SPEECH_DIRECTION + "\n" + VLOG_ACTIVITY_SYNC
          // KONFLIKTAUFLÖSUNG (Explainer): „(if the shot/angle listed above
          // conflicts with this, direct address wins)" war der zweite
          // handlungsbezogene Vorranganspruch im Video-Prompt — und durch seine
          // späte Position der wirksamere. Über die volle Clipdauer, zusätzlich
          // abgesichert durch den Lipsync-Zwang, drehte Veo die Person zur Linse
          // zurück und ließ die Requisite der ACTION weg; ein allein reparierter
          // Bild-Prompt hätte davon nichts gerettet.
          // Trennschnitt wie im Vlog und wortgleich zum Bild-Prompt: MUND/Lipsync
          // bleibt Pflicht (ohne ihn gibt es kein Lipsync), die BLICKRICHTUNG wird
          // zur Ableitung aus der ACTION mit Linsenkontakt als Default.
          // ACTION SYNC bleibt unverändert bestehen: es regelt das TIMING des
          // Gags, nicht WAS passiert — also kein zweiter Vorranganspruch.
          : `Direct-to-camera speech in ${langName}${speaker ? ` — ${speaker} speaks` : ""}: "${line}". ` +
            "The person on screen says this line themself. Animate accurate lip-sync with natural mouth, jaw " +
            "and facial movement precisely matching these words, synced to the audio. Do NOT keep the mouth closed or " +
            "static while the line is spoken.\n" +
            "Where the eyes and the face point is set by the ACTION, not by the speaking — creator-style direct " +
            "address straight into the lens, face near-frontal and clearly readable, is the DEFAULT; but if the ACTION " +
            "has them looking at a prop, down, or away, they do that and keep talking. Keep enough of the face " +
            "readable for the speech to land wherever the action allows.\n" +
            // ERZÄHL-FOKUS: kein Impact-Timing mehr („lands exactly on the
            // strongest word") — die Geste ist beiläufig, das Wort trägt.
            "GESTURE ALONGSIDE: the small everyday ACTION above happens casually while the line is spoken — " +
            "performed by the speaker themself, incidental and unforced. The telling stays the centre; the gesture never competes with it.")
        : `On-camera spoken dialogue in ${langName}${speaker ? ` — ${speaker} says` : ""}: "${line}". ` +
          "The speaking character is clearly visible and faces the camera enough to read the mouth; " +
          "animate accurate lip-sync with natural mouth, jaw and facial movement precisely matching these words, " +
          "synced to the audio. Do NOT keep the mouth closed or static while the line is spoken.";
    } else {
      speechLine = vlogActive
        // Vlog: die sichtbare Person IST die Stimme — auch im Sprecher-Modus.
        // Ein Off-Sprecher über einem stummen Talking-Head wäre genau das
        // Gegenteil des Formats.
        // Derselbe Blick-Lock stand hier ein zweites Mal — zweiter Codepfad,
        // gleiche Wirkung. Muss mit derselben Formulierung laufen, sonst gilt der
        // Fix nur im Dialog-Modus.
        ? `Direct-to-camera speech in ${langName}: "${line}". The person on screen says this line themself. ` +
          VLOG_SPEECH_DIRECTION + "\n" + VLOG_ACTIVITY_SYNC
        : isReel
        // ERZÄHL-FOKUS: Im Reel spricht die sichtbare Person IMMER selbst — auch
        // im Sprecher-Modus, genau wie im Vlog. Vorher stand hier „does NOT
        // mouth or lip-sync": der Clip wurde mit geschlossenem Mund gerendert,
        // während die TTS-Spur später per Lipsync daraufgelegt wurde. Ergebnis
        // war ein sichtbar falsches Mundbild. Ein Erzähl-Reel MIT stummer Person
        // ergibt in diesem Format ohnehin keinen Sinn.
        ? `Direct-to-camera speech in ${langName}: "${line}". The person on screen says this line themself. ` +
          "Animate accurate lip-sync with natural mouth, jaw and facial movement precisely matching these words, " +
          "synced to the audio. Do NOT keep the mouth closed or static while the line is spoken.\n" +
          "They stay calmly present, going about the small everyday action above at an unhurried pace — no " +
          "performance, no staged moment. Creator-style eye contact into the lens is the default; only where the " +
          "ACTION points the eyes elsewhere do they follow it, and they keep talking."
        : `Off-screen narrator voiceover in ${langName}: "${line}". ` +
          "This is narration only — the on-screen subject does NOT mouth or lip-sync these words.";
    }
  }

  // Konsistente Stimme über ALLE Clips: identischer Deskriptor pro Reel, damit Veo
  // (das jeden Clip separat generiert) möglichst dieselbe Sprecherstimme trifft.
  // Mit Voice-Lock entfällt das komplett — welche Stimme Veo trifft, ist dann egal,
  // sie wird ohnehin durch die TTS-Spur ersetzt.
  const productionWord = isReel ? "reel" : "video";
  const voiceLine = scene.dialogText && !voiceLock
    ? (voiceMode === "sprecher"
        ? `Narrator voice — KEEP IT IDENTICAL ACROSS EVERY CLIP OF THIS ${productionWord.toUpperCase()}: ${voiceDescriptor(speakerGender)}. One and the same narrator in every segment — same timbre, pitch, pace and accent; never change the voice between clips.`
        : `Character voices stay CONSISTENT across the whole ${productionWord}: each named character keeps the exact same voice (timbre, pitch, accent) in every clip — never re-cast a character's voice between segments.`)
    : "";

  // Speech-Fencing: Veo darf NUR die zitierte Zeile sprechen lassen — und sie
  // soll den 8s-Clip füllen. Ohne Zeile (Reel): gar keine Sprache erfinden,
  // sonst improvisiert Veo Fülltext, der nicht zum Skript gehört.
  // Voice-Lock + Sprecher: der Clip MUSS stumm bleiben (auch im General-Modus),
  // sonst liegt unter der TTS-Spur noch Veos eigene Stimme.
  // Ausnahme Vlog: dort spricht die sichtbare Person die Zeile wirklich, und der
  // Clip geht danach durch das Lipsync-Modell — dessen Ausgabe trägt ohnehin nur
  // die TTS-Spur. Ein NO_SPOKEN_WORDS neben der zitierten Zeile wäre hier ein
  // direkter Widerspruch im selben Prompt.
  const NO_SPEECH_FENCE =
    "NO SPOKEN WORDS in this clip — ambient and action sound only; do not invent any speech, voiceover or chatter.";
  const speechFence = voiceLock && voiceMode === "sprecher" && !vlogActive
    ? NO_SPEECH_FENCE
    : scene.dialogText
      ? "SPEECH TIMING: the quoted line is the ONLY spoken language in this clip — speak it exactly as written and " +
        "pace the delivery naturally so it fills almost the entire clip. Never invent, add or improvise any other " +
        "dialogue, filler phrases, greetings or background chatter."
      : (isReel ? NO_SPEECH_FENCE : "");

  const lines = [
    `${scene.shotType.replace(/-/g, " ")}, ${scene.cameraAngle.replace(/-/g, " ")}.`,
    // Maßgeblich für den Inhalt des Clips — schlägt jeden allgemeineren Kontext
    // weiter oben (Situation, Reel-Stil). Ohne diesen Vorrang setzte sich die
    // Dauer-Tätigkeit der Situation gegen die Handlung der Szene durch.
    //
    // KONFLIKTAUFLÖSUNG (nur Vlog): „overriding any more general activity
    // mentioned ABOVE" beanspruchte Vorrang über etwas, das gar nicht darüber
    // stand — über dieser Zeile liegt nur die Kamerazeile. Der Vorrang war
    // strukturell tot, während die Dauer-Tätigkeit weiter unten unwidersprochen
    // im Prompt stand. Der neue Wortlaut ist WORTGLEICH zum Szenen-Block des
    // Bild-Prompts, damit Standbild und Clip nicht auseinanderlaufen — und es
    // ist der EINZIGE Vorranganspruch im Video-Prompt. Kommt ein zweiter dazu,
    // neutralisieren sie sich wieder gegenseitig.
    vlogActive
      ? `ACTION — this is what happens in this clip, and it is the single source of truth for the picture; ` +
        `wherever any other line in this prompt says something different, this is the one to render: ` +
        `${scene.keyAction || scene.summary}. Whatever the action needs in order to be visible is in the clip — ` +
        `the prop, the movement, the direction the person looks.`
      // KONFLIKTAUFLÖSUNG (Explainer): Derselbe strukturelle Fehler wie im Vlog.
      // „overriding any more general activity mentioned ABOVE" beanspruchte
      // Vorrang über etwas, das gar nicht darüber steht — oberhalb dieser Zeile
      // liegt nur die Kamerazeile. Der Anspruch lief also ins Leere, während der
      // gegenläufige („direct address wins", in der Speech-Zeile weit unten)
      // durch seine späte Position tatsächlich wirkte: Veo drehte die Person zur
      // Linse und ließ die Requisite weg. Neuer Wortlaut: EIN Vorrang, der nach
      // vorn wie nach hinten gilt — wortgleich zum Szenen-Block des Bild-Prompts
      // und zur Vlog-Zeile darüber, damit Standbild und Clip nicht auseinander-
      // laufen. `mode === "general"` behält seine Zeile unverändert.
      : isReel
      ? `ACTION — this is what happens in this clip, and it is the single source of truth for the picture; ` +
        `wherever any other line in this prompt says something different, this is the one to render: ` +
        `${scene.keyAction || scene.summary}. Whatever the action needs in order to be visible is in the clip — ` +
        `the prop, the movement, the direction the person looks.`
      // Story-Modus: derselbe EINE Anspruch. Der frühere Wortlaut („overriding any
      // more general activity mentioned above") beanspruchte Vorrang nur nach OBEN
      // und ließ die weiter unten stehenden Sprech-/Kamerazeilen gewinnen.
      : `Action — this is what happens in this clip, and it is the single source of truth for the picture; ` +
        `wherever any other line in this prompt says something different, this is the one to render: ` +
        `${scene.keyAction || scene.summary}.`,
    scene.emotion ? `Emotional read: ${scene.emotion}.` : "",
    // Vlog: die Kamera steht fest. Eine Fahrt würde die Kameraposition zwischen
    // den Clips verändern und den Jump Cut als neuen Aufbau lesbar machen —
    // deshalb überschreibt der Vlog-Stil die vom Modell gewählte Bewegung.
    // KONFLIKTAUFLÖSUNG: „no reframing" plus „Subject large, CENTRAL" ergab für
    // jede Handlung, die die Person durchs Bild trägt, genau eine widerspruchs-
    // freie Lösung: sie bewegt sich nicht. Der Zusatz löst das, ohne eine
    // einzige Kamerabewegung zu erlauben — der Vlog-Look bleibt exakt erhalten.
    vlogActive
      ? "Camera: LOCKED OFF — the camera sits exactly where it is for the whole clip and in every other clip of this " +
        "reel. No dolly, no push-in, no pull-out, no pan, no tilt, no crane, no zoom, and it never follows anybody. " +
        "At most the barely perceptible micro-drift of a tripod or a propped-up phone. The PERSON is free to move: " +
        "they may stand up, step through the room, turn away or come close, and the camera simply lets them move " +
        "within the frame or out towards its edge — that is what a phone on a tripod looks like."
      : scene.movement && scene.movement !== "keine"
      ? `Camera movement: ${scene.movement.replace(/-/g, " ")} — clean, deliberate.`
      : "Camera: subtle, contained motion that supports the action.",
    `Pacing: ${getStoryPacingInstruction(pacing, mode, opts.reelStyle)}.`,
    `Mood: ${getStoryMoodInstruction(mood, mode, opts.reelStyle)}.`,
    `Color & lighting: ${getStoryColorInstruction(colorMood, mode)}.`,
    // Real selected aspect — fill the frame, never letterbox.
    // KONFLIKTAUFLÖSUNG (nur Vlog): „central" war zusammen mit „no reframing" die
    // zweite Hälfte derselben Falle — eine Person, die durch den Raum geht, kann
    // nicht mittig bleiben, ohne dass die Kamera mitgeht.
    // Die Entlastung gilt jetzt für BEIDE Reel-Stile: auch im Explainer trägt eine
    // Handlung die Person aus der Mitte („steht auf und geht zwei Schritte"), und
    // „central" als Pflicht ließe dem Modell nur die Lösung, sie stehen zu lassen.
    isReel
      ? `${getAspectFramingDirective(aspect)} The person and the ACTION stay large and clearly readable in the frame; they need not stay dead centre if the action carries them across it.`
      : `${getAspectFramingDirective(aspect)} Subject large, central and clearly readable within the frame.`,
    // KONFLIKTAUFLÖSUNG (nur Vlog): Der Clip bekam per Format ZWEI gleichzeitige
    // Handlungen vorgeschrieben (in die Linse sprechen + keyAction), sollte aber
    // genau EINE haben. Da direct address anderswo als Sieger markiert war,
    // entschied das Modell konsistent fürs Sprechen. Der Zusatz beantwortet die
    // Frage, ohne einen zweiten Vorranganspruch zu erzeugen.
    // Ebenfalls für beide Reel-Stile: sobald die Person spricht, konkurrieren
    // sonst formal zwei „focal actions" um denselben Platz, und das Modell
    // streicht die Handlung zugunsten des Sprechens.
    isReel
      ? "Strict subject clarity — one focal subject, one focal action, one emotional read. The one focal action is " +
        "the ACTION line; talking is not a second action, it runs alongside everything the person does."
      : "Strict subject clarity — one focal subject, one focal action, one emotional read.",
    continuousTakeLine,
    // Direkt hinter der Take-Grammatik: dort steht bereits, dass zwischen den
    // Clips nur ZEIT entfernt wurde — der Zustandsanschluss ist die konkrete
    // Folge daraus und gehört an dieselbe Stelle.
    stateCarryLine,
    vlogSituationLine,
    wardrobeLine,
    startMotionLine,
    targetStateLine,
    endHandling,
    openingLine,
    voiceLine,
    speechLine,
    speechFence,
    // Siehe Bild-Prompt: Player-UI und Untertitel-Boxen fielen durch das reine
    // Text-Verbot durch und landeten im ersten Frame des Clips.
    // KONFLIKTAUFLÖSUNG (nur Vlog): Dieselben zwei Sätze standen wortgleich im
    // Bild-Prompt und hoben dort dieselbe keyAction auf („no phone frame" liest
    // sich als Motivverbot für ein Handy in der Hand). Ein Fix nur im Bild-Prompt
    // hätte Veo das Gerät im Clip wieder verschwinden lassen.
    ...(vlogActive
      ? [
        "Nothing is laid on top of this footage: no on-screen text, no captions, no subtitles, no watermark, no logo, " +
          "no player controls, no progress or scrubber bar, no timestamp, no play button, no social-media icons, and " +
          "no mock-up phone frame drawn around the picture. The footage IS the raw camera recording, never a screen " +
          "recording of a video player or a social-media app.",
        "Real devices inside the scene are fine: a phone, a laptop or a screen physically present in the room is part " +
          "of the room and can be held, looked at and used; any text on it reads as light and shapes only.",
        // Gegenstück zur Ausstattungs-Regel im Bild-Prompt — beide Ebenen müssen
        // dasselbe sagen, sonst blendet der Clip Schrift ein, die das Startbild
        // nicht hatte.
        "Keep written words out of the set dressing: no posters, signs, banners, framed quotes, wall lettering, " +
          "whiteboards, packaging labels or book titles with readable writing. Where a surface in this location would " +
          "normally carry writing, it stays pure texture — never readable words in any language.",
      ]
      // Wie im Bild-Prompt: OVERLAY verboten, REQUISITE erlaubt. „no phone frame"
      // allein las sich als Verbot, überhaupt ein Handy zu zeigen, und hob damit
      // jede Szene auf, deren Handlung an einem Gerät stattfindet.
      : [
        "Nothing is laid on top of this footage: no on-screen text, no captions, no subtitles, no watermark, no logo, " +
          "no player controls, no progress or scrubber bar, no timestamp, no play button, no social-media icons, and " +
          "no mock-up phone frame drawn around the picture. The footage IS the raw camera recording, never a screen " +
          "recording of a video player or a social-media app.",
        "Real devices inside the scene are fine: a phone, a laptop or a screen physically present in the room is part " +
          "of the room and can be held, looked at and used; any text on it reads as light and shapes only.",
        // Gegenstück zur Ausstattungs-Regel im Bild-Prompt — beide Ebenen müssen
        // dasselbe sagen, sonst blendet der Clip Schrift ein, die das Startbild
        // nicht hatte.
        "Keep written words out of the set dressing: no posters, signs, banners, framed quotes, wall lettering, " +
          "whiteboards, packaging labels or book titles with readable writing. Where a surface in this location would " +
          "normally carry writing, it stays pure texture — never readable words in any language.",
      ]),
  ];

  return lines.filter(Boolean).join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// SZENEN-ASSISTENT — „mach ein Frame von den Schultern"
// ═══════════════════════════════════════════════════════════════════════════
//
// Bis hierher konnte die KI im Detail-Dialog nur ERSETZEN: jedes Feld bot drei
// fertige Vorschläge an, und wer eine konkrete Änderung im Kopf hatte, musste
// selbst herausfinden, welche der fünfzehn Eingaben sie betrifft — und sie dann
// von Hand so umschreiben, dass Beschreibung, Kamera und Dialog danach noch
// zusammenpassen. Für „ich will ein Frame von den Schultern" heisst das:
// Shot-Typ UND Beschreibung UND meist die Komposition, sonst beschreibt der
// Bild-Prompt weiter eine Aufnahme, die es nicht mehr gibt.
//
// Der Assistent macht daraus einen Satz Umgangssprache. Er bekommt denselben
// Kontext, aus dem das Storyboard entstanden ist — Profil, Idee, Stil, Ort,
// Besetzung UND alle Nachbarszenen —, damit seine Änderung sich in den Rest
// einfügt, statt ihn zu brechen.

/** Textfelder, die der Assistent schreiben darf. Alles andere an einer Szene
 *  ist Zustand (Bild, Clip, Auftrags-Handles) und geht ihn nichts an. */
const ASSIST_TEXT_FIELDS = {
  summary: "Titel",
  detailedDescription: "Detail-Beschreibung",
  participants: "Beteiligte Charaktere",
  specificArea: "Bereich / Sub-Ort",
  keyAction: "Schlüssel-Aktion",
  emotion: "Emotion",
  dialogText: "Dialog / Sprechertext",
  continuityNotes: "Continuity-Notizen",
} as const;

/** Auswahlfelder — der Wert MUSS aus der jeweiligen Liste kommen. Ein
 *  erfundener Wert („schulterhoch") stünde sonst als Zeichenkette in der Szene,
 *  das Select zeigte nichts an, und der Bild-Prompt bekäme eine Kameraangabe,
 *  die keine Regel der Prompt-Bauer kennt. */
const ASSIST_ENUM_FIELDS: Record<string, { label: string; options: readonly { value: string; label: string }[] }> = {
  cameraAngle:    { label: "Kamerawinkel",              options: STORY_CAMERA_ANGLES },
  shotType:       { label: "Shot-Typ",                  options: STORY_SHOT_TYPES },
  composition:    { label: "Komposition",               options: STORY_COMPOSITIONS },
  movement:       { label: "Kamerabewegung",            options: STORY_MOVEMENTS },
  audienceEffect: { label: "Wirkung auf den Zuschauer", options: STORY_AUDIENCE_EFFECTS },
  voiceDelivery:  { label: "Stimmlage",                 options: VOICE_DELIVERIES },
};

export interface SceneAssistContext {
  mode: StoryMode;
  reelStyle?: ReelStyle;
  idea: string;
  hook?: string;
  cta?: string;
  language: string;
  artStyle: string;
  videoMood: string;
  colorMood: string;
  pacing: string;
  mainLocation?: string;
  aspect: string;
  /** Namen der hochgeladenen Personen — der Assistent darf keine erfinden. */
  characterNames: string[];
  /** Die durchgehende Vlog-Situation, falls es eine gibt. */
  situation?: ReelSituation | null;
  /**
   * Der Aktions-Level des Projekts. Muss mit, sonst schreibt der Assistent bei
   * jeder Änderung wieder eine ruhige `keyAction` — er kennt die Einstellung
   * nicht und fällt auf seinen eigenen Geschmack zurück.
   */
  actionLevel?: ActionLevel;
  /** Profil-Vorspann (buildProfilePreamble) — steht bewusst ganz oben. */
  profileContext?: string;
  /**
   * Läuft diese Szene gerade als DUO-BILD (`sceneIsDuo`)?
   *
   * Das ist die wichtigste Einzelangabe für den Assistenten, und sie fehlte:
   * Der Duo-Pfad baut sein Bild über `buildDuoFramePrompt` und schreibt den
   * Ausschnitt darin FEST — halbnah, beide Personen, jede auf ihrer Bildhälfte.
   * `shotType`, `cameraAngle` und `detailedDescription` liest dieser Pfad für
   * die Kadrierung überhaupt nicht. Wer eine Nahaufnahme ins Textfeld schreibt,
   * bekommt trotzdem die feste Zweier-Einstellung — Text und Bild laufen
   * auseinander, ohne dass irgendwo etwas widerspricht.
   */
  isDuo: boolean;
  /** Wäre Duo hier überhaupt möglich (≥2 Personen und eine Sprech-Szene)? */
  duoPossible: boolean;
}

/** Eine Nachricht im Gespräch mit dem Szenen-Assistenten. */
export interface SceneChatTurn {
  role: "user" | "ai";
  text: string;
}

/**
 * Der Auftrag an das Modell: EIN GESPRÄCH über eine Szene führen — und selbst
 * entscheiden, wann daraus eine Änderung wird.
 *
 * Zwei Ausgänge pro Zug, mehr nicht: eine RÜCKFRAGE oder die ÄNDERUNG. Das ist
 * bewusst so eng gefasst, weil ein Modell, das beides zugleich darf, regelmäßig
 * beides halb tut — es fragt nach und ändert trotzdem schon mal, und der Nutzer
 * bezahlt ein Bild für eine Fassung, über die noch verhandelt wurde.
 *
 * Alle Szenen gehen als Kurzfassung mit — nicht aus Höflichkeit, sondern weil
 * fast jede Änderung eine Anschlussfrage aufwirft: Wird Szene 3 plötzlich eine
 * Nahaufnahme, darf sie nicht dieselbe Einstellung wie Szene 2 sein, und ihre
 * Zeile muss weiter zwischen die Nachbarn passen.
 */
export function buildSceneAssistPrompt(opts: {
  scene: StoryScene;
  sceneIndex: number;
  allScenes: StoryScene[];
  /** Das bisherige Gespräch, älteste Nachricht zuerst. */
  history: SceneChatTurn[];
  /**
   * Der Nutzer hat „Jetzt ändern" gedrückt. Dann wird nicht mehr gefragt,
   * sondern umgesetzt — mit der besten Annahme, die das Gespräch hergibt.
   */
  force?: boolean;
  ctx: SceneAssistContext;
}): string {
  const { scene, sceneIndex, allScenes, history, force, ctx } = opts;
  const langName = getLanguageName(ctx.language);
  const profileBlock = ctx.profileContext?.trim() ? `${ctx.profileContext.trim()}\n\n` : "";
  const cur = scene as unknown as Record<string, unknown>;

  const optionList = (options: readonly { value: string; label: string }[]) =>
    options.map((o) => `${o.value} (${o.label})`).join(" | ");
  const styleName = (list: readonly { value: string; label: string }[], v: string) =>
    list.find((o) => o.value === v)?.label ?? v;

  const projectLines = [
    ctx.hook?.trim() ? `- Hook (erster gesprochener Satz des Videos): "${ctx.hook.trim()}"` : "",
    ctx.cta?.trim() ? `- Call-to-Action (letzter gesprochener Satz): "${ctx.cta.trim()}"` : "",
    ctx.mainLocation?.trim() ? `- Hauptort aller Szenen: ${ctx.mainLocation.trim()}` : "",
    ctx.characterNames.length
      ? `- Personen (NUR diese existieren, erfinde keine weiteren): ${ctx.characterNames.join(", ")}`
      : "",
    ctx.situation
      ? `- Durchgehende Situation: ${[ctx.situation.activity, ctx.situation.setting, ctx.situation.outfit, ctx.situation.cameraSetup].filter(Boolean).join(" · ")}`
      : "",
    `- Look: ${styleName(STORY_ART_STYLES, ctx.artStyle)}, Stimmung ${styleName(STORY_MOOD_OPTIONS, ctx.videoMood)}, Farben ${styleName(STORY_COLOR_OPTIONS, ctx.colorMood)}, Tempo ${styleName(STORY_PACING_OPTIONS, ctx.pacing)}`,
    `- Aktions-Level des ganzen Reels: ${ctx.actionLevel === "active"
      ? "VIEL AKTION — jede Szene zeigt eine sichtbare Handlung der Hände (zeigen, hochhalten, hantieren). Eine „keyAction\", in der jemand nur dasteht und redet, ist hier falsch."
      : "RUHIG — die Person redet, Gesten sind die Ausnahme. Erfinde keine Handbewegung dazu."}`,
    `- Sprache aller Texte: ${langName}`,
  ].filter(Boolean).join("\n");

  const sceneList = allScenes.map((s, i) => {
    const mark = i === sceneIndex ? "   ◀ DIESE SZENE" : "";
    const line = s.dialogText?.trim() ? ` — spricht: "${s.dialogText.trim()}"` : " — stumm";
    const shot = s.shotType ? ` [${styleName(STORY_SHOT_TYPES, s.shotType)}]` : "";
    return `${i + 1}. ${s.summary || "(ohne Titel)"}${line}${shot}${mark}`;
  }).join("\n");

  const currentText = Object.entries(ASSIST_TEXT_FIELDS)
    .map(([key, label]) => `- ${key} (${label}): ${String(cur[key] ?? "").trim() || "(leer)"}`)
    .join("\n");
  const currentEnum = Object.entries(ASSIST_ENUM_FIELDS)
    .map(([key, def]) => `- ${key} (${def.label}): ${String(cur[key] ?? "").trim() || "(nicht gesetzt)"}`)
    .join("\n");
  const allowed = Object.entries(ASSIST_ENUM_FIELDS)
    .map(([key, def]) => `- ${key}: ${optionList(def.options)}`)
    .join("\n");

  const format = ctx.mode === "reel"
    ? `vertikales Erklär-/Erzähl-Reel${ctx.reelStyle === "vlog"
        ? " im Vlog-Stil (durchgehend derselbe Ort und Kameraaufbau, harte Zeitsprünge)"
        : " (jede Szene ein neues Kamera-Setup, harte Schnitte)"}`
    : "Storyboard mit durchgehender Handlung";

  const chat = history.length
    ? history.map((m) => `${m.role === "user" ? "NUTZER" : "DU"}: ${m.text.trim()}`).join("\n")
    : "(noch nichts gesagt)";

  return `${profileBlock}Du bist der Szenen-Assistent eines Storyboard-Werkzeugs und führst ein kurzes Gespräch mit dem Nutzer über EINE Szene. Am Ende setzt du seinen Wunsch um, indem du die betroffenen Felder dieser Szene neu schreibst.

=== DAS PROJEKT ===
- Format: ${format}
- Bildformat: ${ctx.aspect}
- Idee: "${ctx.idea.trim()}"
${projectLines}

=== ALLE SZENEN (fuer den Anschluss) ===
${sceneList}

=== DIE ZU AENDERNDE SZENE ${sceneIndex + 1} — AKTUELLER STAND ===
${currentText}
${currentEnum}

=== ERLAUBTE WERTE DER AUSWAHLFELDER ===
${allowed}
${ctx.duoPossible ? `- duoFrame: "beide" (beide Personen im Bild) | "nur-sprecher" (nur die sprechende Person)` : ""}

=== SO ENTSTEHT DAS BILD DIESER SZENE — LIES DAS, BEVOR DU DEN AUSSCHNITT ÄNDERST ===
${ctx.isDuo
  ? `Diese Szene läuft als DUO-BILD. Der Bildaufbau ist dabei FEST vorgegeben und
lässt sich nicht beschreiben: beide Personen STEHEND nebeneinander, jede
vollständig auf ihrer eigenen Bildhälfte, halbnah (etwa ab der Hüfte), niemand
angeschnitten. Das muss so sein, weil der Clip daraus mit einer Halbbild-Maske
erzeugt wird — sie schneidet starr in der Bildmitte, und nur die Hälfte des
Sprechers wird animiert.
DESHALB gilt für den AUSSCHNITT: Solange "duoFrame" auf "beide" steht, ändern
"shotType", "cameraAngle" und die "detailedDescription" daran NICHTS. Eine
Beschreibung wie "Nahaufnahme der Schulterpartie" stünde dann im Feld, und das
Bild zeigte weiterhin beide Personen in voller Größe.
UND DASSELBE GILT FÜR DIE KÖRPERHALTUNG — das ist die häufigste Enttäuschung:
Im Duo-Bild STEHEN beide, nebeneinander, in derselben Höhe, jede in ihrer Hälfte.
NICHT möglich sind: liegen, sitzen, knien, sich bücken, auf dem Boden sein, eine
Person über der anderen, hintereinander, einer im Vordergrund angeschnitten, über
die Schulter aufgenommen, unterschiedliche Bildhöhen, Umarmungen oder Berührungen
über die Bildmitte hinweg. Die "keyAction" färbt im Duo-Bild NUR Stimmung und
Gesicht — sie stellt niemanden um. Auch die "detailedDescription" wird für dieses
Bild gar nicht gelesen.
WENN DER NUTZER SO ETWAS VERLANGT (jemand liegt, sitzt, kniet, ist im Vordergrund,
enger Ausschnitt, nur EINE Person), hast du genau zwei richtige Antworten:
  (1) "duoFrame" auf "nur-sprecher" setzen — dann greifen Beschreibung, Haltung
      und shotType wirklich. Die zweite Person ist dann nur noch von hinten, als
      Schulter oder angeschnitten im Bild, nie mit dem Gesicht. Sage das in
      "message" dazu, damit der Nutzer weiß, was er dafür eintauscht.
  (2) Oder in "message" klar sagen, dass es im Duo-Bild nicht geht — und was
      stattdessen möglich ist.
VERBOTEN ist die dritte, bequeme Antwort: die "detailedDescription" so
umzuschreiben, als wäre der Wunsch erfüllt, und "duoFrame" stehen zu lassen. Dann
meldet die Oberfläche eine Änderung, und das Bild sieht danach exakt aus wie
vorher. Genau das darf nicht passieren.`
  : ctx.duoPossible
    ? `Diese Szene zeigt nur die sprechende Person. Hier bestimmen "shotType" und die
"detailedDescription" den Ausschnitt — sie wirken also.
Sollen ausdrücklich BEIDE Personen ins Bild, setze "duoFrame" auf "beide". Dann
ist der Aufbau allerdings fest (nebeneinander, halbnah, je eine Bildhälfte) und
shotType wirkt nicht mehr — sag das dem Nutzer in "message" dazu.`
    : `Diese Szene zeigt eine Person. "shotType" und die "detailedDescription"
bestimmen den Ausschnitt.`}

=== DAS BISHERIGE GESPRÄCH ===
${chat}

=== DEINE ZWEI MÖGLICHKEITEN ===
Du entscheidest selbst, welche dran ist.

A) "ask" — EINE Rückfrage stellen.
   Nur wenn eine Angabe fehlt, die das Ergebnis WIRKLICH verändert und die du
   nicht sinnvoll annehmen kannst. GENAU EINE Frage pro Nachricht, nie zwei, nie
   eine Liste, nie eine Frage mit angehängter zweiter. Kurz und konkret, gern mit
   zwei, drei Möglichkeiten zur Auswahl.
   Höchstens ZWEI Rückfragen im ganzen Gespräch — danach wird umgesetzt. Wer
   ausgefragt wird statt bedient, klickt weg.
   Frage NIE nach etwas, das oben schon dasteht (Ort, Besetzung, Look, Sprache).

B) "apply" — die Änderung ausführen.
   Nimm diese Möglichkeit, sobald du genug weisst. Im Zweifel lieber umsetzen als
   fragen: eine Fassung, die man sieht, ist besser als eine Frage, die man
   beantworten muss — und ändern lässt sie sich danach immer noch.
   Setze IMMER sofort um, wenn der Nutzer sinngemäss „mach es", „passt so",
   „fertig", „egal" oder „such du aus" sagt.${force ? `

   ⚠ FÜR DIESEN ZUG GILT: Der Nutzer hat „Jetzt ändern" gedrückt. Du MUSST
   "apply" antworten — keine Rückfrage mehr, unter keinen Umständen. Fehlt dir
   etwas, triff die naheliegendste Annahme und nenne sie in einem Nebensatz in
   "message".` : ""}

=== REGELN FÜR DIE ÄNDERUNG (action "apply") ===
- Gib NUR die Felder zurück, die sich wirklich ändern. Ein Feld, das der Wunsch nicht berührt, lässt du weg — es bleibt dann unverändert stehen.
- ÄNDERE ABER ALLES MIT, WAS SONST NICHT MEHR PASST. Das ist die eigentliche Aufgabe. Beispiel: Verlangt der Nutzer eine engere Einstellung ("Frame von den Schultern"), reicht der neue "shotType" nicht — die "detailedDescription" beschreibt sonst weiter eine Aufnahme, die es nicht mehr gibt. Sie muss denselben Moment in der NEUEN Einstellung beschreiben. Umgekehrt gilt dasselbe: Ändert sich die Handlung, folgen "keyAction" und "emotion" mit.
- DEN AUSSCHNITT STEUERT "shotType", NICHT DIE BESCHREIBUNG. Verlangt der Nutzer eine engere oder weitere Einstellung, MUSST du "shotType" setzen (und bei einem Duo-Bild zusätzlich "duoFrame", siehe oben). Nur die Beschreibung umzuschreiben ändert am Bild nichts — dann steht dort ein Satz über eine Aufnahme, die niemand erzeugt.
- KEINE ÄNDERUNG, DIE DAS BILD NICHT ERREICHT. Bevor du "apply" antwortest, prüfe an dem Abschnitt „SO ENTSTEHT DAS BILD DIESER SZENE", ob die Felder, die du schreiben willst, für DIESE Szene überhaupt gelesen werden. Wenn nicht, ist die Änderung wertlos: Sie meldet Erfolg und ändert nichts. Dann setzt du entweder das Feld, das wirklich wirkt (z. B. "duoFrame"), oder du antwortest "ask" bzw. sagst es in "message" — aber du tust nicht so, als wäre es erledigt.
- Bei enger Einstellung (Close-Up, Medium Close-Up) beschreibt die "detailedDescription" nur noch, was im Ausschnitt SICHTBAR ist. Personen, die dabei aus dem Bild fallen, gehören dann auch nicht mehr in "participants" — und wenn nur noch die sprechende Person übrig bleibt, gehört "duoFrame" auf "nur-sprecher".
- Auswahlfelder: ausschliesslich einer der oben gelisteten Werte, exakt geschrieben. Nie ein eigener Begriff.
- "dialogText" bleibt in ${langName} und behält Länge und Sinn, solange der Nutzer nichts anderes verlangt — die Zeile ist auf die Cliplänge abgestimmt und steht zwischen den Zeilen der Nachbarszenen.
- Verwende nur die oben genannten Personennamen. Keine neuen Figuren, keine Umbenennungen.
- Halte den Anschluss an die Nachbarszenen: derselbe Ort, dieselbe Kleidung, dieselbe Tageszeit — sofern der Wunsch nicht ausdrücklich etwas anderes sagt.

=== "message" — DEINE NACHRICHT IM CHAT ===
- Immer Deutsch, höchstens zwei Sätze, direkte Ansprache.
- Bei "ask": die eine Frage. Sonst nichts.
- Bei "apply": was du geändert hast, in einem Satz. Keine Aufzählung von Feldnamen (die zeigt die Oberfläche selbst), keine Entschuldigung, keine angehängte Rückfrage.

Antworte ausschliesslich mit einem einzigen validen JSON-Objekt:
{"action": "ask" | "apply", "message": "string", "changes": { "<feldname>": "<neuer wert>" }}
Bei "ask" lässt du "changes" weg oder gibst ein leeres Objekt.`;
}

export interface SceneAssistResult {
  /** Rückfrage oder Änderung — die Entscheidung trifft das Modell. */
  action: "ask" | "apply";
  /** Die Chat-Nachricht: die Frage bzw. was geändert wurde. */
  message: string;
  /** Direkt auf die Szene anwendbar. Bei "ask" immer leer. */
  patch: Partial<StoryScene>;
  /** Deutsche Feld-Beschriftungen der tatsächlich übernommenen Änderungen. */
  changedLabels: string[];
}

/**
 * Modell-Antwort → geprüfter Patch.
 *
 * Streng und wortkarg, aus zwei Gründen: Ein erfundener Auswahlwert würde still
 * in die Szene wandern und dort einen Bild-Prompt erzeugen, den niemand
 * angefordert hat. Und ein Feld, das unverändert zurückkommt, würde als
 * „geändert" gemeldet — der Nutzer bezahlte dann ein neues Bild, das genauso
 * aussieht wie das alte.
 */
export function parseSceneAssist(raw: unknown, current: StoryScene): SceneAssistResult {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const message = typeof obj.message === "string" ? obj.message.trim() : "";
  // Nur "apply" führt zu einer Änderung. Alles andere — auch ein fehlendes oder
  // erfundenes Feld — gilt als Rückfrage: im Zweifel wird nichts an der Szene
  // verstellt und kein Bild bezahlt.
  const action: "ask" | "apply" = obj.action === "apply" ? "apply" : "ask";
  if (action === "ask") return { action, message, patch: {}, changedLabels: [] };

  // Manche Modelle liefern die Felder trotz Anweisung flach statt in "changes".
  const changes = (obj.changes && typeof obj.changes === "object" ? obj.changes : obj) as Record<string, unknown>;

  const patch: Partial<StoryScene> = {};
  const changedLabels: string[] = [];
  const cur = current as unknown as Record<string, unknown>;
  const put = (key: string, value: string) => { (patch as Record<string, unknown>)[key] = value; };

  for (const [key, label] of Object.entries(ASSIST_TEXT_FIELDS)) {
    const v = changes[key];
    if (typeof v !== "string") continue;
    const next = v.trim();
    // Leer ist erlaubt (eine Szene darf stumm werden), unverändert nicht.
    if (next === String(cur[key] ?? "").trim()) continue;
    put(key, next);
    changedLabels.push(label);
  }

  for (const [key, def] of Object.entries(ASSIST_ENUM_FIELDS)) {
    const v = changes[key];
    if (typeof v !== "string") continue;
    const wanted = v.trim();
    // Wert ODER Label akzeptieren — das Modell greift trotz Anweisung
    // gelegentlich zum lesbaren Namen. Alles andere wird verworfen, nicht
    // geraten.
    const hit = def.options.find(
      (o) => o.value === wanted || o.label.toLowerCase() === wanted.toLowerCase(),
    );
    if (!hit || hit.value === String(cur[key] ?? "").trim()) continue;
    put(key, hit.value);
    changedLabels.push(def.label);
  }

  /**
   * DER BILDAUFBAU — der einzige Schalter, der den Ausschnitt wirklich freigibt.
   *
   * Eigener Zweig statt in ASSIST_ENUM_FIELDS: `duoFrame` ist kein Auswahlfeld
   * mit Textwert, sondern ein Boolean mit INVERTIERTER Vorgabe (`undefined`
   * heisst AN, nur ein ausdrückliches `false` schaltet ab — siehe `sceneIsDuo`).
   * Deshalb wird hier explizit `true` geschrieben und nicht `undefined`: der
   * gespeicherte Wert soll die Absicht tragen, nicht den Zufall der Vorgabe.
   */
  const duoRaw = typeof changes.duoFrame === "string" ? changes.duoFrame.trim().toLowerCase() : "";
  if (duoRaw) {
    const wantsSolo = /^(nur-sprecher|nur sprecher|solo|false|aus)$/.test(duoRaw);
    const wantsDuo = /^(beide|duo|true|an)$/.test(duoRaw);
    // Der bisherige Stand — `undefined` zählt als AN.
    const isDuoNow = current.duoFrame !== false;
    if (wantsSolo && isDuoNow) {
      patch.duoFrame = false;
      changedLabels.push("Bildaufbau (nur der Sprecher)");
    } else if (wantsDuo && !isDuoNow) {
      patch.duoFrame = true;
      changedLabels.push("Bildaufbau (beide im Bild)");
    }
  }

  // Die Aussprache-Fassung gehört zu GENAU dem alten Wortlaut. Bliebe sie nach
  // einer Textänderung stehen, spräche die Stimme weiter den alten Satz,
  // während im Dialog der neue steht — dieselbe Regel wie beim Tippen von Hand.
  if (patch.dialogText !== undefined && current.dialogSpeech) {
    patch.dialogSpeech = undefined;
  }

  // Der Bildaufbau wechselt → die im ALTEN Duo-Bild festgeschriebene
  // Sprecherseite gehört nicht mehr dazu. Bliebe sie stehen, schnitte die
  // Halbbild-Maske des nächsten Clips auf der falschen Seite.
  if (patch.duoFrame !== undefined) {
    patch.duoSpeakerSide = undefined;
  }

  return { action, message, patch, changedLabels };
}
