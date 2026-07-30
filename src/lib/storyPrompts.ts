import { sanitizeText, SAFE_PORTRAIT_CLAUSE } from "./contentSafety";

export type StoryMode = "general" | "reel";

export const REEL_DEFAULT_HOOK_DIRECTIVE =
  "Open with the most surprising, emotionally intense, or highest-stakes visual beat in the first second.";

export function getEffectiveStoryHook(mode: StoryMode, hook: string): string {
  const trimmed = hook.trim();
  if (trimmed) return trimmed;
  return mode === "reel" ? REEL_DEFAULT_HOOK_DIRECTIVE : "";
}

export function getVideoPromptWordTarget(mode: StoryMode): string {
  return mode === "reel" ? "75-95" : "80-120";
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
        ? "Rapid contrast from clip to clip, but each clip still needs one clean focal action"
        : "Fast rapid cuts throughout";
    case "tension-arc":
    default:
      return mode === "reel"
        ? "Immediate hook, rising tension every beat, then a payoff or cliffhanger before the clip ends"
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

export function getReelStoryboardDirective(effectiveHook: string): string {
  return `
REEL-MODUS - KRITISCHE ANWEISUNGEN (höchste Priorität):
Du erstellst ein Storyboard für ein vertikales Social-Media-Reel (TikTok, Instagram Reels, YouTube Shorts).
Jede Szene wird zu einem kurzen Videoclip. Die exakte Gesamtdauer kommt aus dem Nutzerbriefing.

VERWENDE DIESEN HOOK ALS LEITPLANKE:
- "${effectiveHook}"

REEL-DRAMATURGIE:
- Szene 1 = DER HOOK: Muss innerhalb von 1 Sekunde visuell Aufmerksamkeit binden. Kein langsamer Aufbau.
- Jede weitere Szene = ESKALATION ODER KLARER WECHSEL: Jede Szene zeigt einen neuen Beat, neue Information oder einen sichtbaren Spannungsanstieg.
- Letzte Szene = PAYOFF ODER OFFENE FRAGE: Das Ende soll klar wirken und zum Weiterschauen motivieren.

REEL-VISUELLE REGELN:
- Genau EIN dominanter Fokus pro Szene: eine Person, eine Aktion, ein Konflikt. Keine geteilte Aufmerksamkeit.
- Handy-lesbar: Die Szene muss auch auf einem kleinen Smartphone-Screen sofort klar sein.
- Keine Filler-Shots, keine neutralen Establishing Shots, keine statischen Übergänge ohne Konflikt.
- Starker Szenenkontrast: Winkel, Entfernung, Komposition oder Machtdynamik sollen sich deutlich von der vorherigen Szene unterscheiden.
- Bewegung ist Pflicht: Kamera, Körperhaltung, Blick oder Umwelt müssen spüren lassen, dass etwas passiert.
- 9:16-Komposition: Gesichter, Hände und Kernaktion müssen in der vertikalen Safe Zone klar sichtbar bleiben.

REEL-INHALTLICHE REGELN:
- Denke in aufmerksamkeitsstarken Momenten, nicht in langsamer Exposition.
- Bevorzuge klare Emotionen und klare Bildsignale statt subtiler Andeutungen.
- Jede Szene muss ohne Ton verständlich sein.
- Jede Szene soll visuell die Frage beantworten: Warum schaut man weiter?
`;
}

export function getReelVideoPromptDirective(effectiveHook: string): string {
  return `
REEL MODE - CRITICAL PRIORITY:
This video is for a vertical 9:16 social media reel (TikTok/Instagram Reels/YouTube Shorts).
Each scene is a short beat-sized clip. The exact total runtime is defined by the user brief.
Use this hook directive as the north star: "${effectiveHook}"

RULES FOR REEL PROMPTS:
- The first 0.5-1 second must land on the strongest visual beat, not an intro
- One focal subject, one focal action, one emotional read per clip
- No slow establishing shots, no idle camera settle, no filler gestures
- Movement must begin immediately but remain clean and readable
- Vertical composition: keep the core action large, obvious, and mobile-readable
- Protect subject clarity: background and props are secondary to the main beat
- Build a pattern interrupt from the previous clip through scale, angle, motion, or power shift
- End on a payoff frame or an unanswered question that pulls into the next clip
- Strong contrast, strong silhouettes, strong facial readability, strong emotional intent
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
}

export function buildStoryboardPrompt(opts: StoryboardPromptOpts): string {
  const {
    mode, idea, pointCount, voiceMode, dialogMode, generationDirection, enableSpeaker,
    enableSceneDescription, speakerGender, artStyle, pacing, videoMood, colorMood,
    hook, language, customDetails, characters,
  } = opts;

  const effectiveHook = getEffectiveStoryHook(mode, hook);
  const characterNames = characters.map((c) => c.name);
  const dialogueRule = characterNames.length > 0
    ? `  - falls voiceMode = "dialog": JEDER gesprochene Satz MUSS mit einem exakten Charakternamen aus dieser Liste beginnen: ${characterNames.map((n) => `"${n}"`).join(", ")}`
    : '  - falls voiceMode = "dialog": Verteile die Dialoge logisch auf die sichtbaren Figuren der Szene';

  const characterBlock = characters.length > 0
    ? characters.map((c, i) =>
        `- Charakter ${i + 1} (id: char_${i}): Name "${c.name}", Geschlecht ${c.gender}${c.description ? `, Beschreibung: ${c.description}` : ""}`
      ).join("\n")
    : "";

  const reelDirective = mode === "reel" ? getReelStoryboardDirective(effectiveHook) : "";

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
  - falls voiceMode = "sprecher": Schreibe einen Erzähler-/Voiceover-Text in der 3. Person oder als Off-Stimme. KEIN Dialog zwischen Personen.
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
      ? `RENDER VARIATION #${attempt}: keep the same characters, location and key action, but freely re-interpret and re-frame the moment — change camera angle, distance, composition and lighting compared to any earlier attempt. Describe everything in neutral, tasteful, policy-safe terms.`
      : "",
    attempt > 0 ? SAFE_PORTRAIT_CLAUSE : "",

    // ── Safety / policy-friendly language ──
    "Content policy: depict clothed adults only. No nudity, no sexually suggestive content, no graphic violence, no minors. Tasteful cinematic storytelling.",
    "ABSOLUTELY NO TEXT, LETTERS, WORDS, NUMBERS, WATERMARKS, CAPTIONS or LOGOS anywhere in the image.",
    "Sharp focus on the action, plausible anatomy, realistic hands, true-to-style rendering. It must read as one frame of a larger, continuous scene.",
    // Continuity across scenes: every still belongs to ONE shoot, so it cuts
    // cleanly to the next frame in the reel and gives the video model a coherent
    // start frame to continue from.
    "Cinematography continuity: same lens character, exposure, white balance and colour grade as a single continuous production — this frame is one moment inside an ongoing take, captured mid-motion (never a posed end-of-shot freeze), ready to flow straight into the next frame.",
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
  /** When true, this clip is one segment of a single continuous video: it must
   *  start/end mid-motion (no fade/settle/freeze) so hard cuts read as seamless. */
  continuity?: boolean;
}): string {
  const { scene, mode, pacing, mood, colorMood, effectiveHook, language, aspect, voiceMode } = opts;
  const speakerGender = opts.speakerGender ?? "neutral";
  const langName = getLanguageName(language);

  // ── Continuous-take handling ────────────────────────────────────────────────
  // The reel is assembled from per-scene clips. To make the hard cuts invisible,
  // every clip must behave like a slice cut out of ONE longer take: enter already
  // moving, leave still moving — never the self-contained "intro → beat → outro"
  // shape Veo defaults to (that wind-down is exactly what produces the freeze /
  // jitter at each join). The first clip still opens on the hook; the last clip
  // still lands a payoff.
  const continuity = !!opts.continuity;
  const idx = opts.sceneIndex ?? 0;
  const isFirst = idx === 0;
  const isLast = opts.sceneCount ? idx === opts.sceneCount - 1 : false;

  const continuousTakeLine = continuity
    ? "CONTINUOUS TAKE — this clip is ONE segment of a single, unbroken longer video, not a standalone clip. " +
      "Keep camera energy, lens, lighting, colour grade and motion rhythm seamlessly continuous with the neighbouring segments."
    : "";
  const startMotionLine = continuity && !isFirst
    ? "Start ALREADY IN MOTION on the very first frame: the supplied opening frame is a live, moving moment — " +
      "continue its movement instantly. NO fade-in, NO dip from black, NO settling, NO static hold, NO re-establishing pause at the start."
    : "";
  const endHandling = continuity
    ? (isLast
        ? "End on a clear payoff frame."
        : "End WHILE STILL IN MOTION: the action is mid-movement as the clip ends and flows directly into the next segment. " +
          "NO slow-down, NO fade-out, NO freeze-frame, NO final held pose, NO concluding beat — the motion continues past the cut.")
    : "End on a payoff frame or an unanswered question.";
  // Hook only matters on the opening clip; with continuity off, keep prior behaviour.
  const openingLine = (!continuity || isFirst) && effectiveHook
    ? `Opening directive: ${effectiveHook}`
    : "";

  // Speech handling. The previous build always tagged dialogue as "Optional
  // voiceover", which tells the model the words are OFF-screen narration → the
  // character's mouth never moves. Only narrator mode wants that. In dialog mode
  // the visible character must actually SAY the line on camera with lip-sync.
  let speechLine = "";
  if (scene.dialogText) {
    // Storyboard dialog lines are prefixed with the speaker name ("Isla: …").
    const m = scene.dialogText.match(/^\s*([^:]{1,40}):\s*(.+)$/s);
    const speaker = voiceMode === "dialog" && m ? m[1].trim() : "";
    const line = (m ? m[2] : scene.dialogText).trim();
    speechLine = voiceMode === "dialog"
      ? `On-camera spoken dialogue in ${langName}${speaker ? ` — ${speaker} says` : ""}: "${line}". ` +
        "The speaking character is clearly visible and faces the camera enough to read the mouth; " +
        "animate accurate lip-sync with natural mouth, jaw and facial movement precisely matching these words, " +
        "synced to the audio. Do NOT keep the mouth closed or static while the line is spoken."
      : `Off-screen narrator voiceover in ${langName}: "${line}". ` +
        "This is narration only — the on-screen subject does NOT mouth or lip-sync these words.";
  }

  // Konsistente Stimme über ALLE Clips: identischer Deskriptor pro Reel, damit Veo
  // (das jeden Clip separat generiert) möglichst dieselbe Sprecherstimme trifft.
  const voiceLine = scene.dialogText
    ? (voiceMode === "sprecher"
        ? `Narrator voice — KEEP IT IDENTICAL ACROSS EVERY CLIP OF THIS REEL: ${voiceDescriptor(speakerGender)}. One and the same narrator in every segment — same timbre, pitch, pace and accent; never change the voice between clips.`
        : "Character voices stay CONSISTENT across the whole reel: each named character keeps the exact same voice (timbre, pitch, accent) in every clip — never re-cast a character's voice between segments.")
    : "";

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
    "ABSOLUTELY NO on-screen text, captions, watermarks, or logos.",
  ];

  return lines.filter(Boolean).join("\n");
}
