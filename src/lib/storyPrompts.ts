import { sanitizeText, SAFE_PORTRAIT_CLAUSE } from "./contentSafety";

export type StoryMode = "general" | "reel";

export const REEL_DEFAULT_HOOK_DIRECTIVE =
  "Open with the boldest spoken claim of the whole reel, delivered in the first second, while a dramatic visual literally acts it out on screen.";

/** Default-Hook für Reels OHNE Sprechtext — rein visuell statt "spoken claim". */
export const REEL_DEFAULT_VISUAL_HOOK_DIRECTIVE =
  "Open with the boldest, most dramatic visual beat of the whole reel in the first second — an action that makes the message obvious without sound.";

export function getEffectiveStoryHook(mode: StoryMode, hook: string, hasSpeech: boolean = true): string {
  const trimmed = hook.trim();
  if (trimmed) return trimmed;
  if (mode !== "reel") return "";
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

export function getStoryPacingInstruction(pacing: string, mode: StoryMode): string {
  switch (pacing) {
    case "instant-action":
      return mode === "reel"
        ? "Immediate disruption in the first 0.5-1 second, no warm-up, no empty lead-in"
        : "Action within first 2 seconds";
    case "slow-build":
      return mode === "reel"
        ? "Only a micro build is allowed: the tension is visible instantly and pays off before the clip ends"
        : "Slow build-up over 3-5 seconds";
    case "fast-cuts":
      return mode === "reel"
        ? "Hard visible cut from clip to clip with strong contrast, but each clip still needs one clean focal action"
        : "Fast rapid cuts throughout";
    case "tension-arc":
    default:
      return mode === "reel"
        ? "Spoken hook first, every cut delivers the next punchy statement plus its visual, punchline or call-to-action at the end"
        : "Tension arc with dramatic payoff";
  }
}

export function getStoryMoodInstruction(mood: string): string {
  switch (mood) {
    case "action":      return "Dynamic and urgent, with kinetic energy and high momentum";
    case "calm":        return "Controlled and serene, but still visually intentional";
    case "emotional":   return "Intimate and emotionally exposed, with expressive reactions";
    case "mysterious":  return "Shadowy, tense, and curiosity-driven";
    case "cheerful":    return "Bright, upbeat, and highly watchable";
    case "dramatic":
    default:            return "High-stakes, suspenseful, and emotionally charged";
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
  voiceMode: "sprecher" | "dialog";
  enableSpeaker: boolean;
  /** „Nahtlose Übergänge" aktiv → fließender Szenenanschluss statt Hard Cuts. */
  continuity?: boolean;
}): string {
  const { effectiveHook, voiceMode, enableSpeaker, continuity } = opts;

  // Wie das Skript vorgetragen wird: Off-Sprecher über handelnder Person vs.
  // Person, die ihre Zeile direkt in die Kamera spricht.
  const deliveryLine = !enableSpeaker
    ? "- Ohne Sprechtext: Jede Szene ist ein rein visueller Beat — die keyAction allein muss die Aussage der Szene tragen."
    : voiceMode === "dialog"
      ? '- Vortrag: Die sichtbare Person spricht ihre Zeile DIREKT IN DIE KAMERA (Creator-Style, Blick in die Linse), während die dramatische Aktion im selben Bild passiert — von ihr selbst ausgeführt oder deutlich sichtbar im Hintergrund.\n' +
        '- Kamera für Sprech-Szenen: Wähle nur Werte, die Blick in die Linse erlauben — cameraAngle "eye-level" oder "low-angle", shotType zwischen "close-up" und "medium-shot". KEIN over-shoulder, bird-eye oder worm-eye für die sprechende Person.'
      : "- Vortrag: Ein Off-Sprecher trägt das Skript, während die sichtbare Person die Aussage HANDELND umsetzt. Die Person spricht nicht selbst.";

  const scriptBlock = enableSpeaker
    ? `
DAS GESPROCHENE SKRIPT IST DAS RÜCKGRAT:
- Alle dialogText-Zeilen hintereinander ergeben EIN durchgehendes gesprochenes Skript: Szene 1 = gesprochener HOOK-Satz, jede weitere Szene = genau EINE Kernaussage, letzte Szene = Punchline, Fazit oder Call-to-Action.
- Gesprochene Creator-Sprache: kurz, direkt, aktiv, keine Schachtelsätze. Direkte Ansprache („du") ist ausdrücklich erwünscht.
- Jeder Clip ist EXAKT 8 Sekunden lang. Schreibe ca. 15–22 Wörter dialogText pro Szene: Die Zeile soll die vollen ~7–8 Sekunden Sprechzeit füllen (deutlich kürzere Zeilen erzeugen Stille im Clip), muss aber vollständig in die 8 Sekunden passen.
- Auch im smart-Dialogmodus braucht praktisch JEDE Szene ihre Zeile — ein 8-Sekunden-Clip ohne Sprechtext bedeutet Stille. Lasse dialogText höchstens in EINER Szene bewusst leer, wenn deren Aktion allein stärker wirkt.
${deliveryLine}
`
    : `
OHNE SPRECHTEXT:
${deliveryLine}
`;

  return `
REEL-MODUS — ERKLÄR-/ERZÄHL-FORMAT (höchste Priorität):
Du erstellst KEINE Kurzgeschichte und KEIN Mini-Drama, sondern ein Erklär-/Erzähl-Reel im Creator-Stil (TikTok, Instagram Reels, YouTube Shorts):
Eine Botschaft wird GESPROCHEN vermittelt, während übertriebene, dramatische Bilder das Gesagte wörtlich sichtbar machen.
Jede Szene wird zu einem Videoclip von EXAKT 8 Sekunden — die Gesamtdauer des Reels ist also Szenenanzahl × 8 Sekunden.
${scriptBlock}
DRAMATISCHE VISUALISIERUNG (Pflicht für JEDE Szene):
- keyAction = eine übertriebene, physische, WÖRTLICHE Umsetzung der Aussage dieser Szene — ein visueller Gag oder Stunt, der die Zeile unterstreicht.
- Beispiel: Zeile „KI ist kaputt" → eine Person lässt eine schwere Kugel auf einen Laptop krachen, Display zersplittert.
- Die Aktion passiert WÄHREND die Zeile gesprochen wird und ihr Höhepunkt sitzt auf dem stärksten Wort.
- Keine abstrakten, subtilen oder rein symbolischen Bilder: Die Umsetzung muss ohne Ton sofort verständlich sein und darf absurd überzogen wirken — aber physisch machbar, keine Magie, keine Fantasy.

${continuity
    ? `FLIESSENDE ÜBERGÄNGE (Nutzer-Einstellung „Nahtlose Übergänge"):
- Die Clips werden nahtlos aneinandergefügt: Jede Szene schließt räumlich, zeitlich und kameratechnisch direkt an die vorige an.
- Setups dürfen sich von Szene zu Szene ENTWICKELN (Kamera wandert, Person bewegt sich weiter), aber nie hart springen — kein abrupter Wechsel von Winkel, Distanz oder Position.
- EIN Look über das ganze Reel: gleicher Hauptort, gleiche Personen, gleiches Outfit, gleiche Lichtstimmung.`
    : `HARTE SCHNITTE STATT ÜBERGÄNGEN:
- Jede Szene ist ein NEUES, deutlich anderes Kamera-Setup: anderer Winkel, andere Einstellungsgröße oder andere Position im Hauptort als die Szene davor.
- Kein fließender Szenenübergang, kein Morph, keine Anschlussbewegung — die Schnitte sind bewusst sichtbar und geben dem Reel Tempo (Pattern Interrupt bei jedem Cut).
- Trotzdem EIN Look über das ganze Reel: gleicher Hauptort, gleiche Personen, gleiches Outfit, gleiche Lichtstimmung.`}

VERWENDE DIESEN HOOK ALS LEITPLANKE:
- "${effectiveHook}"
- Szene 1 muss in der ersten Sekunde sitzen: stärkste Aussage + stärkstes Bild zuerst. Kein Aufbau, kein Intro, keine Begrüßung wie „Hallo Leute".

REEL-VISUELLE REGELN:
- Genau EIN dominanter Fokus pro Szene: eine Person, eine Aktion, eine Aussage. Keine geteilte Aufmerksamkeit.
- Handy-lesbar: Die Szene muss auch auf einem kleinen Smartphone-Screen sofort klar sein.
- Keine Filler-Shots, keine neutralen Establishing Shots, keine Szene ohne Aussage.
- 9:16-Komposition: Gesichter, Hände und Kernaktion müssen in der vertikalen Safe Zone klar sichtbar bleiben.
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
  dialogText: string;
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
  // Video pipeline (optional, FULL plan only)
  videoStatus?: "idle" | "loading" | "done" | "error";
  videoUrl?: string;
  videoJobId?: string;
  videoProgressPct?: number;
  videoError?: string;
  videoPrompt?: string;
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
  language: string;
  customDetails: string;
}

interface StoryboardPromptOpts extends StoryConfig {
  characters: StoryCharacter[];
  /** „Nahtlose Übergänge" aktiv — Reel-Szenen fließen statt hart zu schneiden. */
  continuity?: boolean;
}

export function buildStoryboardPrompt(opts: StoryboardPromptOpts): string {
  const {
    mode, idea, pointCount, voiceMode, dialogMode, generationDirection, enableSpeaker,
    enableSceneDescription, speakerGender, artStyle, pacing, videoMood, colorMood,
    hook, language, customDetails, characters, continuity,
  } = opts;

  const effectiveHook = getEffectiveStoryHook(mode, hook, enableSpeaker);
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
    ? getReelStoryboardDirective({ effectiveHook, voiceMode, enableSpeaker, continuity })
    : "";

  return `Du bist ein professioneller Drehbuchautor für visuelle Storyboards.

AUFGABE:
Erstelle ein einziges valides JSON-Objekt basierend auf diesen Eingaben.
KRITISCH: Das "scenes" Array MUSS EXAKT ${pointCount} Einträge enthalten. Nicht mehr, nicht weniger.

EINGABEN:
- storyIdea: "${idea}"
- visualStyle: "${artStyle}"
- customDetails: "${customDetails.trim()}"
- sceneCount: ${pointCount}
- enableSceneDescription: ${enableSceneDescription}
- enableSpeaker: ${enableSpeaker}
- voiceMode: "${voiceMode}"
${voiceMode === "dialog" && enableSpeaker ? `- dialogMode: "${dialogMode}" (${dialogMode === "smart" ? "SMART: KI entscheidet pro Szene ob Dialog passt - manche Szenen können bewusst OHNE Dialog/dialogText sein wenn die Szene visuell stärker wirkt (dann dialogText leer lassen)" : "FORCED: JEDE Szene MUSS einen dialogText enthalten - kein leerer Dialog erlaubt"})` : ""}
- generationDirection: "${generationDirection}"
- numberOfCharacters: ${characters.length}
- videoMood: "${videoMood}" — ${getStoryMoodInstruction(videoMood)}
- colorMood: "${colorMood}" — ${getStoryColorInstruction(colorMood, mode)}
- pacing: "${pacing}" — ${getStoryPacingInstruction(pacing, mode)}
- outputLanguage: "${language}" — ${getLanguageName(language)} (ALLE Texte wie summary, detailedDescription, dialogText MÜSSEN in dieser Sprache geschrieben werden)
${effectiveHook ? `- hook: "${effectiveHook}"` : ""}
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
- Nur der konkrete Bereich innerhalb des Hauptorts wechselt.
- Alle Szenen müssen realistisch sein. Keine Fantasy, keine Magie.
- Jede Szene hat genau eine klare zentrale Aktion oder Gestik.
- Die Szenen bauen logisch aufeinander auf.
- Emotionen müssen visuell erkennbar sein.
- Wenn Referenzcharaktere vorhanden sind, bleibt jeder Name fest an genau sein Referenzbild gebunden.
- Frisur, Gesicht, Kleidung, Accessoires und markante Merkmale der benannten Charaktere bleiben über alle Szenen konsistent, sofern die Geschichte keine explizite Änderung verlangt.
- Verwende in participants und dialogText nur die exakten Charakternamen aus den Referenzcharakteren.
- Erfinde niemals neue Sprecher, Platzhalternamen oder Rollenbezeichnungen wie "Mann", "Frau" oder "Person", wenn Referenzcharaktere vorhanden sind.
- Die letzte Szene soll den stärksten Payoff, Twist oder Ausblick liefern.

ERLAUBTE WERTE:
- cameraAngle: ${STORY_CAMERA_ANGLES.map((c) => `"${c.value}"`).join(" | ")}
- shotType: ${STORY_SHOT_TYPES.map((c) => `"${c.value}"`).join(" | ")}
- audienceEffect: ${STORY_AUDIENCE_EFFECTS.map((c) => `"${c.value}"`).join(" | ")}
- composition: ${STORY_COMPOSITIONS.map((c) => `"${c.value}"`).join(" | ")}
- movement: ${STORY_MOVEMENTS.map((c) => `"${c.value}"`).join(" | ")}

JSON-SCHEMA:
{
  "mainLocation": "string",
  "scenes": [
    {
      "summary": "string, max 15 Wörter",
      "participants": "string, exakte sichtbare Charakternamen kommasepariert",
      "specificArea": "string",
      "keyAction": "string",
      "emotion": "string",
      "detailedDescription": "string",
      "dialogText": "string",
      "audienceEffect": "one of allowed values",
      "composition": "one of allowed values",
      "movement": "one of allowed values",
      "continuityNotes": "string",
      "cameraAngle": "one of allowed values",
      "shotType": "one of allowed values"
    }
  ]
}

FELDREGELN:
- "summary": 1 Satz, maximal 15 Wörter
- "specificArea": konkreter Bereich innerhalb des Hauptorts
- "keyAction": genau eine zentrale sichtbare Aktion oder Gestik
- "emotion": klar sichtbar und visuell darstellbar
- "detailedDescription":
  - falls enableSceneDescription = true: ausführliche visuelle Beschreibung, 3-4 Sätze
  - falls enableSceneDescription = false: "(wird vom Nutzer manuell erstellt)"
- "dialogText":
  - nur ausgeben, falls enableSpeaker = true
  - falls voiceMode = "sprecher": ${mode === "reel"
    ? 'Schreibe die Off-Sprecher-Zeile des Reels: gesprochene Creator-Sprache, direkt und aktivierend (2. Person „du" erlaubt), ca. 15–22 Wörter (soll ~7–8 Sekunden Sprechzeit füllen). KEIN Dialog zwischen Personen.'
    : "Schreibe einen Erzähler-/Voiceover-Text in der 3. Person oder als Off-Stimme. KEIN Dialog zwischen Personen."}
  - falls voiceMode = "dialog":
${dialogueRule}
- "continuityNotes": kurze Notiz zu Kleidung, Haaren, Accessoires, Requisiten oder Sprecherzuordnung

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
  /** „Nahtlose Übergänge" aktiv → Frames fließen statt hart zu schneiden. */
  continuity?: boolean;
  /**
   * Retry index (0 = first try). Each background retry varies and softens the
   * prompt: scene text is run through the content-safety filter and a reword /
   * re-frame nudge plus the positive safe-portrait guarantee are appended, so a
   * prompt that tripped a safety / recitation false-positive has a fresh shot.
   */
  attempt?: number;
}): string {
  const { scene, mode, mainLocation, artStyle, colorMood, videoMood, characters, hasReferences, hasPrevImage, aspect } = opts;
  const attempt = opts.attempt ?? 0;
  const style = STORY_ART_STYLES.find((a) => a.value === artStyle);
  const styleLine = style?.english || artStyle;
  const stylized = isStylizedArtStyle(artStyle);
  // Erklär-Reel mit sprechender Person: der Frame zeigt die Person MITTEN im
  // Sprechen in die Linse — sonst kann Veo daraus keinen Talking-Head animieren.
  const talkingHead = mode === "reel" && opts.voiceMode === "dialog" && !!scene.dialogText?.trim();
  // Bei mehreren Personen im Bild: WER spricht, kommt aus dem "Name: …"-Prefix
  // der Dialogzeile — sonst rendert das Modell die falsche Person frontal.
  const speakerName = talkingHead
    ? (scene.dialogText?.match(/^\s*([^:]{1,40}):/)?.[1]?.trim() ?? "")
    : "";

  // On retries, strip anything that could trip a content-safety false-positive
  // out of the free-text scene fields before they go into the prompt.
  const soften = (s: string) => (attempt > 0 ? sanitizeText(s).clean : s);

  const charBlock = characters.length > 0
    ? `Characters present in this scene (lock each identity strictly to their IDENTITY ANCHOR image, listed below): ${characters.map((c) => c.name).join(", ")}.`
    : "";

  // Explicit, ordered map of the inline reference images so the model never
  // mistakes the (possibly already-drifted) previous frame for the real avatar.
  // The LABELS — not the order — are what stop the drift: the previous frame is
  // marked "continuity only, never a face". Order MUST match how StoryPage pushes
  // the images: one identity anchor per character first, previous frame last.
  const refLines: string[] = [];
  let refIdx = 1;
  characters.forEach((c) => {
    refLines.push(
      `Image ${refIdx}: the IDENTITY ANCHOR for ${c.name} — bind ${c.name}'s face, head shape, hairline, hair & eye colour and distinctive features strictly and only to THIS image.`,
    );
    refIdx++;
  });
  if (hasPrevImage) {
    refLines.push(
      `Image ${refIdx}: the PREVIOUS scene's frame — use ONLY for environment, location, lighting, colour grade and outfit/prop continuity. It is NOT a face reference and may already be imperfect; never copy a face from it.`,
    );
    refIdx++;
  }
  const referenceMap = refLines.length > 0
    ? `REFERENCE IMAGES (provided in this exact order):\n${refLines.join("\n")}`
    : "";

  // The single most important line: capture the DECISIVE MOMENT of the scene.
  // Not the setup, not the aftermath — the visual beat that tells the audience
  // what is happening right now.
  const action = soften(scene.keyAction || scene.summary || "");
  const emotion = soften(scene.emotion || "");
  const detailed = soften(scene.detailedDescription || "");

  return [
    ...(talkingHead
      ? [
          // ── Talking-Head-Frame: Creator spricht in die Linse, Gag im selben Bild ──
          "A single cinematic film still — one frame of a creator-style talking-to-camera reel, frozen mid-word.",
          `DIRECT ADDRESS: ${speakerName ? `${speakerName} is the person speaking — ${speakerName}` : "the subject"} is speaking straight INTO the camera lens at this exact moment — ` +
            "direct eye contact with the viewer, face fully visible and near-frontal, mouth open mid-speech, " +
            "eyebrows and hands actively mid-gesture. It must feel like a paused video of someone talking, full of energy." +
            (speakerName ? " Every other person in the frame stays in the background action and does NOT look at the camera." : ""),
          "If the camera angle or shot type listed below conflicts with direct address, DIRECT ADDRESS WINS — " +
            "keep the speaking face frontal, large and clearly readable.",
          "STRICT: NOT a calm posed portrait, NOT a neutral smile at the lens, NOT a closed mouth — " +
            "the subject is visibly mid-sentence, expressive and engaged.",
          "THE DRAMATIC ACTION IS STAGED IN THE SAME FRAME: while the subject speaks, the key action below is " +
            "clearly visible — either performed by the speaker themself with a prop, or unfolding dramatically " +
            "behind them in the background. Both the speaking face AND the action must read instantly.",
        ]
      : [
          "A single cinematic film still — the DECISIVE moment of the scene, frozen mid-action.",
          "This is the key visual beat: the camera catches the subject IN the action, " +
            "not before and not after. Think of it as the one frame a director would pick to " +
            "summarise this scene at a glance.",

          // ── Forbid the static failure modes the model defaults to ──
          "STRICT: do NOT render a static posed portrait. Do NOT show the subject standing still, " +
            "arms at the sides, facing camera, smiling at the lens. No line-up shots, no headshots, " +
            "no relaxed standing poses unless the script explicitly requires stillness.",
          "The subject is mid-gesture, mid-step, mid-reaction — body language, hands and face all " +
            "clearly engaged in the action. Limbs are in motion; weight is shifted; the moment is alive.",
        ]),
    // Erklär-Reel: die keyAction ist eine bewusst überzogene, wörtliche
    // Visualisierung der gesprochenen Aussage — kein subtiles Symbolbild.
    mode === "reel"
      ? "REEL ACTION STYLE: the key action is a deliberately exaggerated, physical, literal visual statement — " +
        "a stunt-like gag that makes the scene's message obvious without sound. Bold, absurdly overstated, instantly readable."
      : "",

    // ── What's actually happening ──
    action ? `KEY ACTION (this MUST be clearly visible and unmistakable): ${action}.` : "",
    emotion ? `Emotion in the face AND body language: ${emotion}.` : "",
    detailed ? `Scene context: ${detailed}` : "",

    // ── Cinematic frame ──
    `Camera: ${scene.shotType.replace(/-/g, " ")}, ${scene.cameraAngle.replace(/-/g, " ")}.`,
    scene.composition ? `Composition: ${scene.composition.replace(/-/g, " ")}.` : "",
    scene.movement && scene.movement !== "keine"
      ? `Camera/subject motion: ${scene.movement.replace(/-/g, " ")} — implied motion blur on the moving parts where it reads natural.`
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
    `Overall mood: ${getStoryMoodInstruction(videoMood)}.`,

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
    mode === "reel"
      ? "Optimised for mobile viewing — the key action is large, central, and instantly readable in the first half-second."
      : "",

    // ── Retry variation ──
    // On a background retry, nudge the model to re-interpret and re-frame the
    // scene (keeping characters, location and the key action) so a previous
    // safety / recitation false-positive isn't reproduced verbatim, and restate
    // the positive policy guarantee explicitly.
    attempt > 0
      ? (talkingHead
          // Talking-Head: die Kamera darf beim Retry NICHT wegdrehen — der Frame
          // muss frontal bleiben, sonst kann Veo keinen Direct-Address animieren.
          ? `RENDER VARIATION #${attempt}: keep the same characters, location, key action AND the direct-to-camera address, but freely re-interpret lighting, background staging, framing distance and gesture compared to any earlier attempt. The speaker KEEPS talking straight into the lens. Describe everything in neutral, tasteful, policy-safe terms.`
          : `RENDER VARIATION #${attempt}: keep the same characters, location and key action, but freely re-interpret and re-frame the moment — change camera angle, distance, composition and lighting compared to any earlier attempt. Describe everything in neutral, tasteful, policy-safe terms.`)
      : "",
    attempt > 0 ? SAFE_PORTRAIT_CLAUSE : "",

    // ── Safety / policy-friendly language ──
    "Content policy: depict clothed adults only. No nudity, no sexually suggestive content, no graphic violence, no minors. Tasteful cinematic storytelling.",
    "ABSOLUTELY NO TEXT, LETTERS, WORDS, NUMBERS, WATERMARKS, CAPTIONS or LOGOS anywhere in the image.",
    "Sharp focus on the action, plausible anatomy, realistic hands, true-to-style rendering. It must read as one frame of a larger, continuous scene.",
    // Continuity across scenes: every still belongs to ONE shoot. In reel mode
    // WITHOUT „Nahtlose Übergänge" the cuts are deliberate hard cuts, so each
    // scene is a visibly NEW setup inside that one production look; with the
    // toggle ON (and in general mode) the frame should flow into the next.
    mode === "reel" && !opts.continuity
      ? "Cinematography: ONE consistent production look across the whole reel — same lens character, exposure, " +
        "white balance and colour grade in every scene. But THIS frame is a deliberately NEW camera setup: " +
        "clearly different angle, shot size or position than the previous scene. The edit will HARD CUT between scenes."
      : "Cinematography continuity: same lens character, exposure, white balance and colour grade as a single continuous production — this frame is one moment inside an ongoing take, captured mid-motion (never a posed end-of-shot freeze), ready to flow straight into the next frame.",
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
  /** Position of this scene in the reel (0-based) + total — drives the
   *  continuous-take in/out directives so segments flow into each other. */
  sceneIndex?: number;
  sceneCount?: number;
  /** When true („Nahtlose Übergänge"), this clip is one segment of a single
   *  continuous video: it must start/end mid-motion so cuts read as seamless.
   *  When false in reel mode, the clip uses hard-cut grammar instead (start
   *  instantly, end abrupt — the visible cut is deliberate). */
  continuity?: boolean;
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
  const continuity = !!opts.continuity;
  const isReel = mode === "reel";
  const idx = opts.sceneIndex ?? 0;
  const isFirst = idx === 0;
  const isLast = opts.sceneCount ? idx === opts.sceneCount - 1 : false;

  // ── Hard-cut reel grammar ──────────────────────────────────────────────────
  // Erklär-/Erzähl-Reels werden mit BEWUSST sichtbaren harten Schnitten
  // montiert: jeder Clip ist ein in sich stehender Beat (eine Aussage + eine
  // Aktion), startet sofort auf voller Energie und endet abrupt ohne Ausklang —
  // der Schnitt selbst ist der Pattern Interrupt. Nur wenn der Nutzer
  // „Nahtlose Übergänge" (continuity) explizit einschaltet, gilt weiterhin die
  // Continuous-Take-Grammatik darunter.
  const hardCuts = isReel && !continuity;

  const continuousTakeLine = hardCuts
    ? "HARD-CUT REEL EDITING — this clip is ONE self-contained beat of a fast-paced vertical explainer reel. " +
      "The reel is assembled with deliberate, visible hard cuts: every clip is a clearly different camera setup, " +
      "and the cut itself is the pattern interrupt. One statement, one action, one emotional read — " +
      "this clip never starts telling the next beat."
    : continuity
      ? "CONTINUOUS TAKE — this clip is ONE segment of a single, unbroken longer video, not a standalone clip. " +
        "Keep camera energy, lens, lighting, colour grade and motion rhythm seamlessly continuous with the neighbouring segments."
      : "";
  const startMotionLine = hardCuts
    ? "Start INSTANTLY at full energy on the very first frame — the beat is already happening. " +
      "NO fade-in, NO dip from black, NO camera settle, NO wind-up, NO greeting pause."
    : continuity && !isFirst
      ? "Start ALREADY IN MOTION on the very first frame: the supplied opening frame is a live, moving moment — " +
        "continue its movement instantly. NO fade-in, NO dip from black, NO settling, NO static hold, NO re-establishing pause at the start."
      : "";
  const endHandling = hardCuts
    ? (isLast
        ? "Land the final beat cleanly — punchline, conclusion or call-to-action — and hold full energy to the very last frame. NO fade-out."
        : "End clean and ABRUPT at full energy: finish the spoken line and the action's impact, then stop. " +
          "NO fade-out, NO slow-down, NO freeze-frame, NO concluding pose — the edit hard-cuts straight to the next, visibly different setup.")
    : continuity
      ? (isLast
          ? "End on a clear payoff frame."
          : "End WHILE STILL IN MOTION: the action is mid-movement as the clip ends and flows directly into the next segment. " +
            "NO slow-down, NO fade-out, NO freeze-frame, NO final held pose, NO concluding beat — the motion continues past the cut.")
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
  let speechLine = "";
  if (scene.dialogText) {
    // Storyboard dialog lines are prefixed with the speaker name ("Isla: …").
    // Only dialog mode uses that convention — narrator text must stay verbatim
    // (a line like "Achtung: das wird teuer" would otherwise lose its opening).
    const m = scene.dialogText.match(/^\s*([^:]{1,40}):\s*(.+)$/s);
    const speaker = voiceMode === "dialog" && m ? m[1].trim() : "";
    const line = (voiceMode === "dialog" && m ? m[2] : scene.dialogText).trim();
    if (voiceMode === "dialog") {
      speechLine = isReel
        // Erklär-Reel: Creator spricht die Zeile DIREKT in die Linse, während
        // die Key Action im selben Bild passiert (selbst oder im Hintergrund).
        ? `Direct-to-camera speech in ${langName}${speaker ? ` — ${speaker} speaks` : ""}: "${line}". ` +
          "The speaker talks straight INTO the camera lens — creator-style direct address, confident eye contact " +
          "with the viewer, face fully visible and near-frontal (if the shot/angle listed above conflicts with this, " +
          "direct address wins). Animate accurate lip-sync with natural mouth, jaw " +
          "and facial movement precisely matching these words, synced to the audio. Do NOT keep the mouth closed or " +
          "static while the line is spoken.\n" +
          "ACTION SYNC: the key action above happens WHILE the line is spoken — performed by the speaker themself or " +
          "unfolding clearly in the frame behind them — timed so its impact lands exactly on the strongest word of the line."
        : `On-camera spoken dialogue in ${langName}${speaker ? ` — ${speaker} says` : ""}: "${line}". ` +
          "The speaking character is clearly visible and faces the camera enough to read the mouth; " +
          "animate accurate lip-sync with natural mouth, jaw and facial movement precisely matching these words, " +
          "synced to the audio. Do NOT keep the mouth closed or static while the line is spoken.";
    } else {
      speechLine = isReel
        // Erklär-Reel mit Off-Sprecher: die Person spricht NICHT, sie FÜHRT die
        // Aussage aus — der Impact der Aktion sitzt auf dem stärksten Wort.
        ? `Off-screen narrator voiceover in ${langName}: "${line}". ` +
          "Narration only — the on-screen person does NOT mouth or lip-sync these words. Instead they PERFORM: " +
          "the key action unfolds during the narration, its impact timed to land exactly on the strongest word of the line."
        : `Off-screen narrator voiceover in ${langName}: "${line}". ` +
          "This is narration only — the on-screen subject does NOT mouth or lip-sync these words.";
    }
  }

  // Konsistente Stimme über ALLE Clips: identischer Deskriptor pro Reel, damit Veo
  // (das jeden Clip separat generiert) möglichst dieselbe Sprecherstimme trifft.
  const productionWord = isReel ? "reel" : "video";
  const voiceLine = scene.dialogText
    ? (voiceMode === "sprecher"
        ? `Narrator voice — KEEP IT IDENTICAL ACROSS EVERY CLIP OF THIS ${productionWord.toUpperCase()}: ${voiceDescriptor(speakerGender)}. One and the same narrator in every segment — same timbre, pitch, pace and accent; never change the voice between clips.`
        : `Character voices stay CONSISTENT across the whole ${productionWord}: each named character keeps the exact same voice (timbre, pitch, accent) in every clip — never re-cast a character's voice between segments.`)
    : "";

  // Speech-Fencing: Veo darf NUR die zitierte Zeile sprechen lassen — und sie
  // soll den 8s-Clip füllen. Ohne Zeile (Reel): gar keine Sprache erfinden,
  // sonst improvisiert Veo Fülltext, der nicht zum Skript gehört.
  const speechFence = scene.dialogText
    ? "SPEECH TIMING: the quoted line is the ONLY spoken language in this clip — speak it exactly as written and " +
      "pace the delivery naturally so it fills almost the entire clip. Never invent, add or improvise any other " +
      "dialogue, filler phrases, greetings or background chatter."
    : (isReel
        ? "NO SPOKEN WORDS in this clip — ambient and action sound only; do not invent any speech, voiceover or chatter."
        : "");

  const lines = [
    `${scene.shotType.replace(/-/g, " ")}, ${scene.cameraAngle.replace(/-/g, " ")}.`,
    `Action: ${scene.keyAction || scene.summary}.`,
    scene.emotion ? `Emotional read: ${scene.emotion}.` : "",
    scene.movement && scene.movement !== "keine"
      ? `Camera movement: ${scene.movement.replace(/-/g, " ")} — clean, deliberate.`
      : "Camera: subtle, contained motion that supports the action.",
    `Pacing: ${getStoryPacingInstruction(pacing, mode)}.`,
    `Mood: ${getStoryMoodInstruction(mood)}.`,
    `Color & lighting: ${getStoryColorInstruction(colorMood, mode)}.`,
    // Real selected aspect — fill the frame, never letterbox.
    `${getAspectFramingDirective(aspect)} Subject large, central and clearly readable within the frame.`,
    "Strict subject clarity — one focal subject, one focal action, one emotional read.",
    continuousTakeLine,
    startMotionLine,
    endHandling,
    openingLine,
    voiceLine,
    speechLine,
    speechFence,
    "ABSOLUTELY NO on-screen text, captions, watermarks, or logos.",
  ];

  return lines.filter(Boolean).join("\n");
}
