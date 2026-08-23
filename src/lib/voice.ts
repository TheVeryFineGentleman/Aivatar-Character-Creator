/**
 * Voice-Lock — die Sprecherstimme wird vom Video ENTKOPPELT.
 *
 * Veo generiert jeden Clip einzeln und würfelt dabei die Stimme jedes Mal neu;
 * ein echtes Voice-Locking bietet das Modell nicht. Über Prompt-Deskriptoren
 * ("dieselbe warme männliche Stimme") lässt sich das nur annähern — im fertigen
 * Reel hört man den Sprecherwechsel trotzdem an jedem Schnitt.
 *
 * Deshalb hier: Veo liefert nur noch das BILD, die Stimme kommt aus TTS mit
 * einer festen ElevenLabs-Stimme und wird danach untergelegt — im Sprecher-Modus
 * per ffmpeg (`/api/ai/dub`), im Dialog-Modus zusätzlich durch das
 * Lipsync-Modell, damit die sichtbare Person die neue Stimme auch wirklich
 * spricht.
 */

import { AIError } from "@/lib/ai";
import { ttsSpeak, dubVideo, runLipsyncJob, type TtsResult } from "@/lib/serverAI";
import { deliveryForScene, VOICE_DELIVERIES, splitDialogLine, falPremadeVoiceName, matchCharacterName, nameKey, type StoryConfig, type StoryScene } from "@/lib/storyPrompts";

/** ElevenLabs akzeptiert `speed` nur im Band 0.7..1.2. Nach der Multiplikation
 *  mit dem Delivery-Faktor kann der Projektwert da rausfallen — hier klemmen,
 *  sonst lehnt fal den Request ab. Fehlt der Projektwert (alte Projekte ohne
 *  gespeicherte voiceSpeed), fällt es auf Normaltempo zurück statt auf NaN. */
function clampSpeed(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(1.2, Math.max(0.7, v));
}

/**
 * Welche Stimme spricht diese Szene?
 *
 * Der Sprecher kommt aus dem validierten `scene.speaker`; das `"Name: Satz"`-
 * Präfix ist nur noch der Rückfall für Storyboards, die vor diesem Feld
 * entstanden sind. Vorher galt beides NUR im Dialog-Modus — im Reel-Standard
 * („sprecher") sprach deshalb auch bei zwei Figuren immer die Projektstimme,
 * obwohl im Bild sichtbar die andere Person redete.
 *
 * Der Zugriff auf die Zuordnung läuft über einen normalisierten Vergleich:
 * ein direkter Key-Zugriff verfehlte „anna" gegen „Anna" und fiel dann
 * kommentarlos auf die Projektstimme zurück.
 */
/** Alle bekannten Figurennamen — Zuordnungstabelle plus die Namensliste des
 *  Projekts, damit der Schutz auch für Figuren ohne eigene Stimme greift. */
function knownNamesOf(config: StoryConfig): string[] {
  return [...new Set([...(config.characterNames ?? []), ...Object.keys(config.characterVoices ?? {})])]
    .map((n) => n.trim())
    .filter(Boolean);
}

export function voiceForScene(scene: StoryScene, config: StoryConfig): string {
  const names = knownNamesOf(config);
  const speaker =
    matchCharacterName(scene.speaker || "", names) ||
    matchCharacterName(splitDialogLine(scene.dialogText || "", names).speaker, names);
  if (!speaker) return config.voiceName;
  // Normalisierter Zugriff: ein direkter Key-Zugriff verfehlte „anna" gegen
  // „Anna" und fiel dann stumm auf die Projektstimme zurück — beide Figuren
  // klangen gleich, ohne dass irgendwo etwas schiefging.
  const entry = Object.entries(config.characterVoices ?? {})
    .find(([name]) => nameKey(name) === nameKey(speaker));
  return entry?.[1] || config.voiceName;
}

/**
 * Was diese Szene tatsächlich SPRICHT.
 *
 * Das Storyboard liefert zu Zeilen mit englischen Firmennamen eine
 * Aussprache-Fassung („Guhgel Ähds" statt „Google Ads"). Sie existiert nur für
 * die Stimme: die TTS-Modelle kennen kein Aussprache-Feld, der Text ist die
 * einzige Steuerung. Angezeigt wird weiterhin ausschließlich `dialogText`.
 *
 * Diese eine Funktion ist die Weiche dafür — jeder Ort, der Text an die Stimme
 * gibt, muss durch sie hindurch, sonst spricht die Nachbarzeile anders als die
 * Zeile selbst.
 */
/**
 * Satzzeichen, die die Stimme als PAUSE liest, obwohl das Skript sie gar nicht
 * enthalten dürfte.
 *
 * Die Skriptregeln verbieten Auslassungspunkte, Gedankenstriche, Semikola und
 * Doppelpunkte in der gesprochenen Zeile längst (siehe buildSpokenScriptBlock) —
 * aber sie gelten nur für NEU erzeugte Storyboards. Bereits geschriebene Zeilen
 * tragen sie weiter, und jedes dieser Zeichen kostet im Clip einen hörbaren
 * Moment. Deshalb hier, unmittelbar vor der Stimme.
 *
 * BEWUSST NUR ZWEI ZEICHEN — die, deren Entfernen nichts bedeuten kann:
 *   • Kommas bleiben. Ein Komma ist im Deutschen meist grammatisch nötig, und
 *     es wegzunehmen ergäbe eine gehetzte Lesung ohne Atempunkt — das Gegenteil
 *     dessen, was gewollt ist. Zu viele Kommas löst der Prompt, nicht dieser
 *     Filter.
 *   • Doppelpunkte bleiben. „Merk dir: nie am Ende kaufen." wird ohne
 *     Doppelpunkt zu „Merk dir nie am Ende kaufen." — das ist die GEGENTEILIGE
 *     Aussage. Eine Pause wegzunehmen ist keinen Bedeutungswechsel wert.
 *   • Semikola bleiben. Sie sind hier ohnehin selten, und jede Ersetzung hat
 *     einen Haken: als Punkt folgt ein kleingeschriebenes Wort, als Komma
 *     bleibt die Pause.
 *
 * Der ANGEZEIGTE Text ändert sich nicht: das hier läuft ausschliesslich auf dem
 * Weg zur Sprachausgabe, genauso wie die Aussprache-Fassung.
 *
 * ACHTUNG, REIHENFOLGE: Das hier läuft IMMER NACH `splitDialogLine`, nie davor.
 * Auch wenn kein Doppelpunkt mehr angefasst wird, bleibt die Regel richtig — der
 * Sprechername wird über genau dieses Zeichen erkannt, und ein späterer Griff
 * danach würde ihn mitsprechen lassen.
 */
function stripPausePunctuation(s: string): string {
  return s
    // Auslassungspunkte sind bei ElevenLabs die längste Pause von allen. Sie
    // ersatzlos zu entfernen ist sicherer, als sie zu einem Punkt zu machen:
    // mitten im Satz stünde danach ein kleingeschriebenes Wort hinter einem
    // Satzende, und die Stimme setzte erst recht ab.
    .replace(/\s*(\.\.\.|…)/g, "")
    // Gedankenstrich MIT Leerzeichen ringsum — nur diese Form ist ein
    // Einschubzeichen. Der Bindestrich in zusammengesetzten Wörtern
    // („Sechs-Wochen-Plan") hat keine Leerzeichen und bleibt unangetastet.
    .replace(/\s+[—–]\s+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function spokenTextOf(scene: Pick<StoryScene, "dialogText" | "dialogSpeech">): string {
  return (scene.dialogSpeech || "").trim() || (scene.dialogText || "").trim();
}

/** Nachbartexte für ElevenLabs' previous_text/next_text — lässt die Vertonung
 *  wie EINE durchgehende Lesung klingen statt wie N Einzelaufnahmen. */
export function neighbourTexts(
  scenes: StoryScene[],
  index: number,
  knownNames?: string[],
): { previousText?: string; nextText?: string } {
  const textOf = (s?: StoryScene) => {
    const raw = s ? spokenTextOf(s) : "";
    if (!raw) return undefined;
    // Erst den Namen abtrennen, DANN die Pausenzeichen — siehe die Warnung an
    // `stripPausePunctuation`. Die Nachbartexte müssen dieselbe Fassung tragen
    // wie die Zeile selbst, sonst rechnet das Modell mit einer Lesung, die es
    // gar nicht zu hören bekommt.
    const line = splitDialogLine(raw, knownNames).line;
    return stripPausePunctuation(line) || undefined;
  };
  return {
    previousText: textOf(scenes[index - 1]),
    nextText: textOf(scenes[index + 1]),
  };
}

/** TTS für eine Szene. Liefert data-URL + Dauer.
 *
 * Die Szene bringt optional ein `voiceDelivery` mit (wie die Zeile vorgetragen
 * wird — außer Atem beim Training, vertraulich bei der Pointe …). Die beiden
 * Modelle setzen das grundverschieden um:
 *
 * - eleven-v3 versteht Inline-Audio-Tags im Text ("[breathless] Und deshalb …"),
 *   liest sie NICHT vor, sondern spielt sie als Regieanweisung. Dafür kennt v3
 *   kein `speed`, kein `style`, kein `previousText`/`nextText` — diese Felder
 *   dürfen im v3-Request nicht auftauchen.
 * - multilingual-v2 kennt umgekehrt KEINE Tags: "[breathless]" würde WÖRTLICH
 *   vorgelesen. Im v2-Zweig geht der Tag deshalb NIEMALS in den Text; die
 *   Färbung kommt dort ausschließlich über stability/style/speed.
 */
export async function renderSceneVoice(args: {
  scene: StoryScene;
  scenes: StoryScene[];
  index: number;
  config: StoryConfig;
  falKey: string;
  /** Eigener ElevenLabs-Key: ist er gesetzt, spricht der Server ElevenLabs
   *  direkt an und die Stimme ist eine voice_id statt eines Namens. */
  elevenKey?: string;
  /** Die voice_ids des Kontos. NUR wenn die gewählte Stimme darin vorkommt, darf
   *  der Direktweg genommen werden — siehe `elevenKeyFor` unten. */
  elevenVoiceIds?: string[];
}): Promise<TtsResult> {
  const { scene, scenes, index, config, falKey, elevenKey, elevenVoiceIds } = args;
  // Gesprochen wird die Aussprache-Fassung, sofern es eine gibt (siehe
  // `spokenTextOf`). Die Prüfung darunter hängt bewusst an DIESEM Wert: eine
  // Szene ohne Sprechtext hat auch keine Aussprache-Fassung, und umgekehrt darf
  // eine leere Fassung die vorhandene Zeile nicht verschlucken.
  const raw = spokenTextOf(scene);
  if (!raw) throw new AIError("NO_INPUT", "Kein Sprechtext für diese Szene.");
  const known = knownNamesOf(config);
  // Ein Sprechername darf NICHT mitgesprochen werden — aber nur, wenn es
  // wirklich einer ist. Ohne die Namensliste schnitt diese Zeile im
  // Dialog-Modus jedes „Wort:" am Anfang weg, auch aus „Merk dir: nie am Ende
  // kaufen." Und im Sprecher-Modus blieb umgekehrt ein echtes „Anna:" stehen
  // und wurde vorgelesen. Jetzt entscheidet der Name, nicht der Modus.
  // Erst der Sprechername weg (er wird über den Doppelpunkt erkannt), dann die
  // Pausenzeichen — die Reihenfolge ist zwingend, siehe `stripPausePunctuation`.
  const text = stripPausePunctuation(splitDialogLine(raw, known).line);

  // `deliveryForScene` wertet zusätzlich die `emotion` der Szene aus. Ohne das
  // klingt jedes Storyboard, das vor dem Delivery-Feld entstanden ist, komplett
  // ausdruckslos — es gäbe dort ausnahmslos "neutral" ohne Tag.
  const delivery = deliveryForScene(scene);
  // Ein aus der Emotion abgeleitetes Delivery zählt wie ein gesetztes: sein
  // `stability` ÜBERSCHREIBT die projektweite `config.voiceStability` (die Szene
  // weiß besser, wie ihre Zeile klingen soll). Nur wenn gar nichts passt, bleibt
  // es bei "neutral" und damit beim Projektwert.
  const hasDelivery = delivery.value !== VOICE_DELIVERIES[0].value;
  // Läuft der Gedanke aus der VORIGEN Szene noch weiter? Genau dann, wenn deren
  // Zeile auf einem Komma endet — die Regel lässt nur Punkt oder Komma zu.
  const prevLine = index > 0 ? splitDialogLine((scenes[index - 1]?.dialogText || "").trim(), known).line.trim() : "";
  const carriesOver = /[,،、，]["'»”』)]*$/.test(prevLine);
  // DIE KOMMA-DÄMPFUNG IST WEG (Nutzerbefund 2026-08-13: „Stimme passt nicht zur
  // ausgewählten Stimmung"). Sie zog das Szenen-Delivery auf den Projektwert ±0.1
  // zurück, sobald die Vorzeile auf Komma endete — aus 0.25 wurde 0.40, aus 0.75
  // wurde 0.60, und weil höchstens jede zweite Zeile terminal endet, traf das
  // regelmässig die halbe Vertonung. Ihre Prämisse widerspricht ausserdem der
  // eigenen Skriptregel: das Komma ist dort ausdrücklich eine HÖRANWEISUNG und
  // keine grammatische Fortsetzung (siehe buildSpokenScriptBlock) — jede Zeile
  // ist ein eigener Clip mit eigener Stimmung. `carriesOver` bleibt erhalten, es
  // steuert unten noch die Position des v3-Audio-Tags.
  const stability = hasDelivery ? delivery.stability : config.voiceStability;
  const voice = voiceForScene(scene, config);

  // ── Welcher Weg? Das entscheidet der WERT, nicht der Key ─────────────────
  //
  // `voice` bedeutet je nach Weg etwas anderes: über fal ein Premade-NAME aus
  // ELEVEN_VOICES, über den eigenen Key eine `voice_id`. Die Weiche hing vorher
  // daran, ob die Stimme in der geladenen Kontoliste steht — und die ist leer,
  // solange sie lädt, wenn dem Key `voices_read` fehlt oder das Netz klemmt.
  // Dann fiel die Entscheidung auf „fal", und eine voice_id ging an fal:
  //   422 — Voice not found: ntGEEyBzNzbhPXyRGiMu
  // Die Szene blieb ohne Tonspur, obwohl Key und Stimme beide in Ordnung waren.
  //
  // Jetzt gilt: Ein Premade-Name gehört zu fal, alles andere IST eine voice_id
  // und darf ausschließlich direkt zu ElevenLabs. Die Kontoliste bestätigt das
  // nur noch — sie widerlegt es nicht mehr.
  const premadeName = falPremadeVoiceName(voice);
  const isAccountId = !!elevenVoiceIds?.includes(voice);
  const needsElevenDirect = isAccountId || !premadeName;
  const elevenKeyFor = needsElevenDirect && elevenKey ? elevenKey : undefined;

  if (!elevenKeyFor) {
    // Kein Direktweg möglich — dann muss es über fal gehen, und dafür braucht es
    // beides: einen fal-Key UND einen Namen, den fal kennt. Fehlt eines davon,
    // ist hier Schluss, mit Begründung. Vorher ging die Anfrage trotzdem raus
    // und die Szene endete stumm; bei jeder Szene gleich, also ein tonloses Reel.
    if (!premadeName) {
      throw new AIError(
        "NO_KEY",
        `Die Stimme „${voice}" ist eine ElevenLabs-Stimme und braucht deinen ElevenLabs-Key.`,
        elevenKey
          ? "Der Key ist zwar hinterlegt, konnte hier aber nicht verwendet werden. Prüfe ihn in den Einstellungen."
          : "Hinterlege den ElevenLabs-Key in den Einstellungen — oder wähle im Stimmen-Auswahlfeld eine der fal-Stimmen.",
      );
    }
    if (!falKey) {
      throw new AIError(
        "NO_KEY",
        "Kein Schlüssel für die Vertonung hinterlegt.",
        "Öffne die Einstellungen und hinterlege einen fal.ai- oder ElevenLabs-Key.",
      );
    }
  }
  // Auf dem fal-Weg zählt die kanonische Schreibweise („sarah" → „Sarah").
  const voiceValue = elevenKeyFor ? voice : premadeName ?? voice;

  if (config.voiceModel === "eleven-v3") {
    // Der Tag steht wieder vorn. Die Verschiebung hinter das erste Wort sollte
    // den performten Neuansatz vermeiden — das war richtig, solange jede Zeile
    // ein Fortsetzungs-Schnipsel war. Jetzt eröffnet jede Zeile ihren eigenen
    // Satz: die Regieanweisung gehört VOR das betonte Eröffnungswort, sonst
    // kommt sie zu spät. Nur wenn der Gedanke per Komma aus der vorigen Szene
    // weiterläuft, bleibt sie hinter dem ersten Wort.
    // Die /^\S+\s/-Prüfung ist zwingend: eine Einwortzeile („Stopp!") hat kein
    // Leerzeichen, der replace fände dann nichts und der Tag verschwände.
    const tagged = !delivery.tag
      ? text
      : carriesOver && /^\S+\s/.test(text)
        ? text.replace(/^(\S+)(\s)/, `$1 ${delivery.tag}$2`)
        : `${delivery.tag} ${text}`;
    return ttsSpeak({
      model: "eleven-v3",
      text: tagged,
      voice: voiceValue,
      languageCode: config.language,
      stability,
      apiKey: falKey,
      elevenKey: elevenKeyFor,
    });
  }

  // v2 — Text bleibt tagfrei, dafür die volle Parametrisierung inkl. der
  // Nachbartexte, die die Vertonung wie EINE durchgehende Lesung klingen lassen.
  const { previousText, nextText } = neighbourTexts(scenes, index, known);

  return ttsSpeak({
    model: "multilingual-v2",
    text,
    voice: voiceValue,
    languageCode: config.language,
    speed: clampSpeed(config.voiceSpeed * delivery.speedMul),
    stability,
    // `style` geht jetzt IMMER mit — auch die 0.00 von "Neutral".
    //
    // Vorher blieb das Feld ohne Delivery weg, „damit der Server-Default gilt".
    // Dieser Default ist 0.55 (Server: ttsElevenDirect) und damit HÖHER als der
    // von JEDEM echten Delivery: eine Szene ohne erkannte Stimmung klang
    // ausdrucksstärker als eine ausdrücklich als „Energisch" markierte. Genau
    // diese Verkehrung hat der Nutzer gehört.
    style: delivery.style,
    // Weniger Ähnlichkeitszwang, sobald eine Stimmung gespielt werden soll:
    // similarity_boost zieht die Ausgabe zur Referenzaufnahme zurück, und der
    // Server-Default 0.85 ist dafür hoch. Ohne Delivery bleibt es beim
    // bisherigen Verhalten (Feld weg → Server-Default).
    similarityBoost: hasDelivery ? 0.75 : undefined,
    previousText,
    nextText,
    apiKey: falKey,
    elevenKey: elevenKeyFor,
  });
}

/** Legt die TTS-Spur auf den Clip. `needsLipsync` (Dialog-Modus) schickt Video +
 *  Audio zusätzlich durch das Lipsync-Modell, sonst nur ffmpeg-Dub. */
export async function dubSceneVideo(args: {
  videoUrl: string;
  audioDataUrl: string;
  needsLipsync: boolean;
  falKey: string;
  onProgress?: (pct: number) => void;
  /** Dauern für die Truncation-Erkennung im Lipsync-Zweig (siehe unten). */
  audioDurationSec?: number;
  clipDurationSec?: number;
}): Promise<{ videoDataUrl?: string; videoUrl?: string; truncated: boolean }> {
  const { videoUrl, audioDataUrl, needsLipsync, falKey, onProgress, audioDurationSec, clipDurationSec } = args;

  if (!needsLipsync) {
    onProgress?.(20);
    const result = await dubVideo({
      video: videoUrl.startsWith("data:") ? { dataUrl: videoUrl } : { url: videoUrl },
      audio: { dataUrl: audioDataUrl },
    });
    onProgress?.(100);
    return { videoDataUrl: result.dataUrl, truncated: result.truncated };
  }

  // Lipsync: die durable http(s)-URL bevorzugt durchreichen — der Clip liegt
  // nach dem Spaces-Upload ohnehin dort und muss dann nicht als Riesen-Body
  // durch den Proxy. Nur wenn es (noch) eine data:-URL ist, geht sie mit.
  const isDataUrl = videoUrl.startsWith("data:");
  // KEIN Rückfall auf den reinen Ton-Ersatz mehr.
  //
  // Hier fing ein `catch` den Lipsync-Ausfall ab und legte die Stimme per
  // ffmpeg auf den Clip — Ton richtig, Lippen falsch. Das rettete die Szene in
  // der Übersicht und zerstörte sie im Schnitt: zwischen lippensynchronen Clips
  // fällt genau dieser eine auf, und zwar erst im fertigen Reel. Ein Fehler ist
  // hier das kleinere Übel, weil er gezielt wiederholbar ist.
  const finalUrl = await runLipsyncJob(
    {
      videoUrl: isDataUrl ? undefined : videoUrl,
      videoDataUrl: isDataUrl ? videoUrl : undefined,
      audioDataUrl,
      apiKey: falKey,
    },
    (p) => onProgress?.(Math.min(95, 5 + p.ticks * 6)),
  );
  onProgress?.(100);
  // sync_mode "silence" behält die VIDEOlänge — zu langes TTS-Audio wird also
  // hinten abgeschnitten, und das Modell meldet das nicht. Deshalb selbst aus den
  // bekannten Dauern ableiten, damit die UI im Dialog-Modus genauso warnt wie im
  // Sprecher-Modus (dort rechnet `/api/ai/dub` `truncated` aus, mit derselben
  // 0.15s-Toleranz). Fehlt eine der Dauern, bleibt es beim alten `false`.
  const truncated =
    audioDurationSec != null && clipDurationSec != null
      ? audioDurationSec > clipDurationSec + 0.15
      : false;
  return { videoUrl: finalUrl, truncated };
}
