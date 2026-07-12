/**
 * Character portrait prompt builder for the Quick & Chat creators.
 *
 * Goal: every generation looks clearly different — both within a single batch
 * and across repeated runs — while still honouring the traits the user picked.
 * The "feeling" (front-facing studio portrait, pure-white background, rich
 * style-specific photography language, distinct-person directive) is ported
 * from the original Projekt assistant prompt.
 */

import {
  sanitizeText,
  sanitizeOr,
  looksLikeMinor,
  SAFE_PORTRAIT_CLAUSE,
  MINOR_SAFE_CLAUSE,
} from "./contentSafety";

// ─── Randomisation helpers ────────────────────────────────────────────────────

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A short random identity token. Injecting a unique seed per image nudges the
 * model out of "mode collapse" (returning near-identical faces for similar
 * prompts) so each portrait reads as a genuinely different individual.
 */
export function identitySeed(): string {
  const n = Math.floor(Math.random() * 1e9).toString(36).toUpperCase();
  return `ID-${n}`;
}

// ─── Trait pools (drive the per-image variation) ──────────────────────────────

export const ETHNICITIES = [
  "European / Caucasian", "East Asian", "South Asian", "West African / Black",
  "Latin American / Hispanic", "Middle Eastern", "Southeast Asian",
  "Mixed / biracial", "Nordic / Scandinavian", "Mediterranean",
];

export const SKIN_TONES = [
  "very fair porcelain", "light with warm undertone", "light olive", "warm tan",
  "golden bronze", "medium brown", "deep brown", "rich dark mahogany", "cool beige",
];

export const HAIR_STYLES = [
  "short straight hair", "long flowing wavy hair", "natural curly afro", "a clean buzz cut",
  "shoulder-length layered hair", "intricate braids", "slicked-back hair", "a messy textured crop",
  "a pixie cut", "long dreadlocks", "a tousled side-swept fringe", "a neat top knot",
  "a soft wavy bob", "tight ringlet curls", "a high ponytail", "an undercut with volume on top",
];

export const HAIR_COLORS = [
  "jet black", "platinum blonde", "auburn red", "dark chocolate brown", "honey blonde",
  "silver-grey", "chestnut brown", "strawberry blonde", "warm copper", "deep burgundy",
  "ash brown", "caramel with subtle highlights",
];

// Styling is independent of length/colour/texture, so it can vary per image
// even when the user has pinned those — adds visible variety to the hair.
export const HAIR_STYLING = [
  "worn loose and natural", "neatly styled", "tied back", "tousled and a little messy",
  "swept to one side", "with a clean centre parting", "with a deep side parting",
  "pulled up into an updo", "tucked behind the ears", "with loose strands framing the face",
];

export const BODY_TYPES = [
  "slim and lean", "athletic and toned", "an average everyday build", "broad and sturdy",
  "tall and slender", "petite and compact", "soft and curvy", "strong and muscular",
];

export const FACE_SHAPES = [
  "a sharp angular jawline with high cheekbones", "a round soft face with full cheeks",
  "an oval face with a refined nose", "a square jaw with deep-set eyes",
  "a heart-shaped face with a wide forehead", "a diamond-shaped face with a narrow chin",
  "a long face with a strong brow ridge", "delicate features with a small nose",
];

export const EYE_COLORS = [
  "warm brown", "deep hazel", "striking blue", "clear green", "cool grey", "amber", "dark near-black",
];

// NOTE: every expression keeps the gaze ON the camera — no "looking away" or
// "gazing into the distance" cues, so portraits stay strictly front-facing.
export const EXPRESSIONS = [
  "a confident subtle smile", "a calm neutral expression", "a warm friendly look",
  "a thoughtful calm expression", "a bright genuine smile", "a quietly determined look",
];

export const LIGHTING = [
  "soft even studio softbox lighting", "gentle Rembrandt lighting from one side",
  "bright high-key beauty lighting", "clean wrap-around light with subtle catchlights in the eyes",
];

export const WARDROBE = [
  "a simple crew-neck t-shirt", "a casual knit sweater", "a tailored blazer over a shirt",
  "a denim jacket", "a plain hoodie", "a smart casual button-up shirt", "a turtleneck",
];

export const REALISM_EXTRAS = [
  "light freckles across the nose", "a few subtle laugh lines", "a small natural beauty mark",
  "clear healthy skin with visible pores", "faint natural under-eye softness",
];

// Fine facial-feature pools — these are what actually make two faces read as
// different *people*, so we vary them hard per image.
export const NOSE_SHAPES = [
  "a straight narrow nose", "a wide rounded nose", "a small upturned button nose",
  "a prominent aquiline nose", "a broad flat nose bridge", "a delicate refined nose",
  "a slightly crooked characterful nose", "a long slender nose",
];

export const LIP_SHAPES = [
  "full rounded lips", "thin defined lips", "a wide expressive mouth",
  "a small delicate mouth", "asymmetric lips with a fuller lower lip",
  "neat balanced lips", "a cupid's-bow upper lip",
];

export const EYEBROWS = [
  "thick straight eyebrows", "softly arched brows", "thin sparse eyebrows",
  "bold expressive brows", "naturally uneven brows", "low-set heavy brows",
];

export const EYE_SHAPES = [
  "wide round eyes", "narrow almond eyes", "deep-set hooded eyes",
  "slightly downturned eyes", "bright upturned eyes", "monolid eyes", "close-set eyes",
];

// Subtle age nudges so a batch never looks like the same age stamped out N times.
export const AGE_NUDGES = [
  "looking young for their age", "looking about their stated age",
  "looking a touch older than their years", "with a mature, lived-in look",
  "with a fresh youthful appearance",
];

// ─── Style → photography/illustration language ────────────────────────────────

export type StyleKey =
  | "realistic" | "anime" | "comic" | "pixar" | "cartoon" | "watercolor" | "sketch";

export const STYLE_TECH: Record<StyleKey, string> = {
  realistic:
    "highly detailed professional photography, shot on an 85mm f/1.4 lens with shallow depth of field, " +
    "soft even studio lighting, visible natural skin texture with pores and fine detail, slight natural asymmetry, ultra-high-definition photorealism",
  // The stylised styles are written aggressively: the model otherwise drifts back
  // to a semi-realistic look (especially with a photo reference). Each one ends
  // with an explicit "NOT a photograph" so the transformation is unmistakable.
  anime:
    "FULLY drawn 2D anime / manga illustration — clean bold cel ink linework, flat cel-shaded colour blocks " +
    "with hard-edged shadows, large expressive stylised anime eyes with bright highlights, simplified " +
    "non-photographic skin with no real pores, distinct stylised hair strands, vibrant saturated palette, " +
    "authentic Japanese animation look. This is hand-drawn anime art, NOT a photograph — remove all photorealism",
  comic:
    "FULLY drawn Western comic-book illustration — thick black ink outlines, bold flat cel shading, " +
    "halftone / Ben-Day dot texture, high-contrast dramatic colours, dynamic graphic-novel rendering. " +
    "This is inked comic artwork, NOT a photograph — remove all photorealism",
  pixar:
    "FULLY re-rendered stylised 3D CGI character in modern Pixar / 3D-animation style — smooth " +
    "subsurface-scattering skin, soft rounded slightly-exaggerated features, large expressive eyes, glossy " +
    "stylised hair, cinematic volumetric studio lighting, polished animated-movie render. " +
    "This is a 3D render, NOT a photograph — remove all photorealism",
  cartoon:
    "FULLY drawn bold 2D cartoon — thick clean outlines, flat vibrant colours, exaggerated simplified " +
    "features, crisp vector-like rendering. This is a cartoon drawing, NOT a photograph — remove all photorealism",
  watercolor:
    "watercolor painting style, soft color bleeds, delicate translucent brushstrokes, visible paper texture, artistic and ethereal",
  sketch:
    "detailed pencil sketch, fine line art with cross-hatching, graphite-on-paper texture, expressive hand-drawn shading",
};

export function resolveStyleKey(raw: string | undefined): StyleKey {
  const s = (raw || "").toLowerCase();
  if (/anime|manga/.test(s)) return "anime";
  if (/comic|graphic/.test(s)) return "comic";
  if (/pixar|3d|render|cgi/.test(s)) return "pixar";
  if (/cartoon|toon/.test(s)) return "cartoon";
  if (/aquarell|watercolor|watercolour/.test(s)) return "watercolor";
  if (/sketch|pencil|zeichnung|skizze/.test(s)) return "sketch";
  return "realistic";
}

// ─── Color palette / mood → lighting language ─────────────────────────────────

export function resolveColorMood(raw: string | undefined): string | null {
  const s = (raw || "").toLowerCase();
  if (/warm|golden/.test(s)) return "warm golden-hour tones, soft amber highlights";
  if (/kalt|cold|cool|blau|blue/.test(s)) return "cool blue tones, crisp silver highlights";
  if (/neon|cyber/.test(s)) return "neon pink and cyan rim lighting, high-contrast glowing accents";
  if (/pastell|pastel/.test(s)) return "soft pastel palette, gentle diffused dreamy light";
  if (/dunkel|dark|noir/.test(s)) return "dark moody low-key lighting, deep shadows, dramatic contrast";
  if (/natür|natural|neutral/.test(s)) return "natural balanced lighting, true-to-life colors";
  return null;
}

// ─── Shared building blocks ───────────────────────────────────────────────────

const NEGATIVE =
  "Avoid: blurry, deformed, distorted, extra limbs, fused fingers, bad anatomy, " +
  "asymmetric eyes, overexposed, underexposed, duplicate faces, collage, grid, watermark, text, " +
  "profile view, side view, three-quarter face angle, head turned or tilted, looking away, " +
  "gaze off-camera, eyes closed, back of the head.";

const NO_TEXT =
  "Absolutely NO text, letters, numbers, words, captions, watermarks, logos or signatures anywhere in the image.";

const SINGLE_FORWARD =
  "Show exactly ONE single person, alone, in a strictly straight-on FRONTAL view: " +
  "face and shoulders squared to the camera, head upright — not tilted, not turned — and " +
  "looking DIRECTLY into the lens with BOTH eyes on the camera. " +
  "Absolutely no profile, no side view, no three-quarter angle, no over-the-shoulder pose, no looking away. " +
  "No collage, no grid, no second person.";

const WHITE_BG =
  "MANDATORY background: pure white seamless studio backdrop (#FFFFFF) — no gradients, textures, patterns, props or environment, only clean solid white behind the subject.";

/**
 * The single most important line for variety: an emphatic, seeded directive
 * telling the model this is a wholly unrelated individual. The random seed
 * keeps the latent face from collapsing back to the same "default" person.
 */
function distinctDirective(seed: string): string {
  return (
    `Unique individual ${seed}. This is a COMPLETELY DIFFERENT, unrelated real person — ` +
    "not a sibling, twin or variation of anyone else. Give them their own distinct bone structure, " +
    "facial proportions, skin texture and overall vibe. Do NOT reuse a generic or idealised face; " +
    "make the features specific, varied and unmistakably individual."
  );
}

interface TraitSet {
  hair: string;
  hairColor: string;
  hairStyling: string;
  body: string;
  face: string;
  eyes: string;        // eye colour
  eyeShape: string;    // eye shape
  nose: string;
  lips: string;
  brows: string;
  ageNudge: string;
  expression: string;
  lighting: string;
  wardrobe: string;
  ethnicity: string;
  skin: string;
  extra: string;
  seed: string;        // unique per-image identity token
}

function composePrompt(opts: {
  genderLabel: string;       // english, e.g. "male", "female", "non-binary"
  ageText: string;           // e.g. "around 25 years old" or "in their 30s"
  styleKey: StyleKey;
  nationalityHint?: string;  // overrides ethnicity/skin when provided
  colorMood?: string | null;
  traits: TraitSet;
}): string {
  const { genderLabel, ageText, styleKey, nationalityHint, colorMood, traits } = opts;
  const realistic = styleKey === "realistic";

  // Silently normalise the only free-text field here so the output stays within
  // policy regardless of what was typed.
  const safeNationality = nationalityHint ? sanitizeText(nationalityHint).clean : "";
  const ethnicLine = safeNationality
    ? `Heritage / features: ${safeNationality}.`
    : `Ethnicity: ${traits.ethnicity}, ${traits.skin} skin tone.`;

  const lines = [
    `A studio portrait of one ${genderLabel} character, ${ageText}, ${traits.ageNudge}.`,
    ethnicLine,
    `Hair: ${traits.hair} in ${traits.hairColor}.`,
    `Eyes: ${traits.eyes}, ${traits.eyeShape}. Eyebrows: ${traits.brows}.`,
    `Nose: ${traits.nose}. Mouth: ${traits.lips}.`,
    `Build: ${traits.body}. Face shape: ${traits.face}.`,
    `Wearing ${traits.wardrobe}. Expression: ${traits.expression}.`,
    `Lighting: ${traits.lighting}${colorMood ? `, ${colorMood}` : ""}.`,
    realistic ? `Realism detail: ${traits.extra}.` : "",
    `Style: ${STYLE_TECH[styleKey]}.`,
    "Framing: front-facing head-and-shoulders portrait from the chest up, head squared to the camera, " +
      "both eyes looking straight into the lens, sharp focus on the face, centered symmetrical composition.",
    SINGLE_FORWARD,
    WHITE_BG,
    distinctDirective(traits.seed),
    NO_TEXT,
    SAFE_PORTRAIT_CLAUSE,
    NEGATIVE,
  ];
  return lines.filter(Boolean).join("\n");
}

function rollTraits(count: number): TraitSet[] {
  const hair = shuffle(HAIR_STYLES);
  const hairC = shuffle(HAIR_COLORS);
  const hairS = shuffle(HAIR_STYLING);
  const body = shuffle(BODY_TYPES);
  const face = shuffle(FACE_SHAPES);
  const eyes = shuffle(EYE_COLORS);
  const eyeShape = shuffle(EYE_SHAPES);
  const nose = shuffle(NOSE_SHAPES);
  const lips = shuffle(LIP_SHAPES);
  const brows = shuffle(EYEBROWS);
  const ageN = shuffle(AGE_NUDGES);
  const expr = shuffle(EXPRESSIONS);
  const light = shuffle(LIGHTING);
  const ward = shuffle(WARDROBE);
  const eth = shuffle(ETHNICITIES);
  const skin = shuffle(SKIN_TONES);
  const extra = shuffle(REALISM_EXTRAS);
  const out: TraitSet[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      hair: hair[i % hair.length],
      hairColor: hairC[i % hairC.length],
      hairStyling: hairS[i % hairS.length],
      body: body[i % body.length],
      face: face[i % face.length],
      eyes: eyes[i % eyes.length],
      eyeShape: eyeShape[i % eyeShape.length],
      nose: nose[i % nose.length],
      lips: lips[i % lips.length],
      brows: brows[i % brows.length],
      ageNudge: ageN[i % ageN.length],
      expression: expr[i % expr.length],
      lighting: light[i % light.length],
      wardrobe: ward[i % ward.length],
      ethnicity: eth[i % eth.length],
      skin: skin[i % skin.length],
      extra: extra[i % extra.length],
      seed: identitySeed(),
    });
  }
  return out;
}

// ─── Quick creator ────────────────────────────────────────────────────────────

const GENDER_EN: Record<string, string> = {
  male: "male", female: "female", nonbinary: "androgynous non-binary", neutral: "androgynous",
};

export interface QuickPromptInput {
  gender: string;        // id: male | female | nonbinary
  age: number;           // approx years
  styleId: string;       // realistic | anime | comic | pixar
  nationalityHint?: string;
  count: number;
}

/** Build `count` distinct portrait prompts. Re-rolls randomly on every call. */
export function buildQuickPrompts(input: QuickPromptInput): string[] {
  const styleKey = resolveStyleKey(input.styleId);
  const genderLabel = GENDER_EN[input.gender] || "person";
  const traits = rollTraits(input.count);
  return traits.map((t) => {
    // Jitter the age a few years per image so a batch never reads as the same
    // age stamped out N times (clamped so children stay children).
    const age = Math.max(3, input.age + pick([-5, -3, -2, 0, 2, 3, 5]));
    const ageText = `around ${age} years old`;
    return composePrompt({ genderLabel, ageText, styleKey, nationalityHint: input.nationalityHint, traits: t });
  });
}

// ─── Chat creator ─────────────────────────────────────────────────────────────
//
// answers keyed by question id (see ChatPage QUESTIONS):
// 1 gender, 2 nationality, 3 age, 4 hair length, 5 hair color, 6 hair texture,
// 7 skin, 8 eyes, 9 body, 10 expression, 11 extras, 12 style, 13 color palette.

export function buildChatPrompts(answers: Record<number, string>, count: number): string[] {
  const styleKey = resolveStyleKey(answers[12]);
  const colorMood = resolveColorMood(answers[13]);
  const genderRaw = (answers[1] || "").toLowerCase();
  const genderLabel =
    /m(ä|ae)nn|male|mann|boy|herr/.test(genderRaw) ? "male" :
    /weib|female|frau|girl|woman/.test(genderRaw) ? "female" :
    genderRaw ? sanitizeText(genderRaw).clean || "person" : "person";
  const ageText = answers[3] ? `aged ${sanitizeText(answers[3]).clean || "unspecified"}` : "of unspecified age";
  // Free-text origin is sanitised; benign nationalities pass through untouched.
  const nationality = sanitizeText(answers[2]).clean;
  // When the subject is a minor we add an explicit innocence guarantee and stop
  // honouring any adult-coded body description.
  const minor = looksLikeMinor(answers[3]);

  const rolled = rollTraits(count);

  return rolled.map((t) => {
    // Keep what the user specified; vary (randomise) what they left blank.
    // Every free-text field is run through the silent safety filter first, so a
    // disallowed wish falls back to a neutral trait instead of leaking through.
    const hairLen = sanitizeText(answers[4]).clean;
    const hairTex = sanitizeText(answers[6]).clean;
    const hairColor = sanitizeOr(answers[5], t.hairColor);
    const isBald = /glatze|bald|kahl|rasiert|shav/i.test(hairLen);
    const hairBase = (hairLen || hairTex)
      ? `${[hairLen, hairTex].filter(Boolean).join(", ")} hair in ${hairColor}`
      : `${t.hair} in ${hairColor}`;
    // Vary the styling per image (parting / updo / loose …) so the hair differs
    // across the batch even when length, colour and texture are pinned.
    const hairDesc = isBald
      ? "a shaved / bald head, little to no hair"
      : `${hairBase}, ${t.hairStyling}`;
    const skin = sanitizeOr(answers[7], t.skin);
    const eyes = sanitizeOr(answers[8], t.eyes);
    // For minors, ignore any user body description and use a neutral one.
    const body = minor ? "a natural, age-appropriate build" : sanitizeOr(answers[9], t.body);
    const expression = sanitizeOr(answers[10], t.expression);
    const extras = sanitizeText(answers[11]).clean;
    const realistic = styleKey === "realistic";

    const lines = [
      `A portrait of one ${genderLabel} character, ${ageText}, ${t.ageNudge}.`,
      nationality
        ? `Nationality / heritage: ${nationality} — render the typical facial features and skin tone for this origin.`
        : `Ethnicity: ${t.ethnicity}.`,
      `Skin tone: ${skin}. Hair: ${hairDesc}.`,
      `Eyes: ${eyes}, ${t.eyeShape}. Eyebrows: ${t.brows}. Nose: ${t.nose}. Mouth: ${t.lips}.`,
      `Build: ${body}. Face shape: ${t.face}. Expression: ${expression}.`,
      extras && !/^(nein|keine|none|no)$/i.test(extras) ? `Distinctive features: ${extras}.` : "",
      `Lighting: ${t.lighting}${colorMood ? `, ${colorMood}` : ""}.`,
      realistic ? `Realism detail: ${t.extra}.` : "",
      `Style: ${STYLE_TECH[styleKey]}.`,
      "Framing: front-facing head-and-shoulders portrait from the chest up, head squared to the camera, " +
      "both eyes looking straight into the lens, sharp focus on the face, centered symmetrical composition.",
      SINGLE_FORWARD,
      WHITE_BG,
      "Although these characters share the briefed traits (gender, origin, age, hair & eye colour), " +
        "they are SEPARATE individuals — give each a clearly distinct face shape, features, hair styling " +
        "and apparent age so no two look like the same person or relatives.",
      distinctDirective(t.seed),
      NO_TEXT,
      SAFE_PORTRAIT_CLAUSE,
      minor ? MINOR_SAFE_CLAUSE : "",
      NEGATIVE,
    ];
    return lines.filter(Boolean).join("\n");
  });
}

// ─── Lightweight creators (Snap) ──────────────────────────────────────────────
//
// For generators that already assemble their own base prompt but still need
// every image to be a clearly different individual. Returns `count` blocks —
// each a fresh roll of fine facial features plus a seeded distinct-person
// directive — to append to the base prompt, one per image.

export function buildVariationBlocks(count: number): string[] {
  return rollTraits(count).map((t) =>
    [
      `Distinct appearance — ${t.hair} in ${t.hairColor}; ${t.eyes} eyes, ${t.eyeShape}; ` +
        `${t.brows}; ${t.nose}; ${t.lips}; ${t.body} build; ${t.face}; ${t.ageNudge}; ` +
        `expression: ${t.expression}.`,
      distinctDirective(t.seed),
    ].join("\n"),
  );
}

// ─── Smart Remix ──────────────────────────────────────────────────────────────
//
// "Find an image somewhere, upload it (and/or type an idea) → get N character
// suggestions." Unlike the Studio (which identity-LOCKS to the reference so it
// stays the same person), Remix treats the upload purely as creative
// inspiration and invents N brand-NEW, clearly distinct individuals in that
// spirit. Each gets a fresh trait roll + a seeded, MEDIUM-NEUTRAL distinct
// directive so no two suggestions read as the same character — and, in "auto"
// style, the source medium is mirrored 1:1 (a cartoon reference yields a
// cartoon, a photo of a person yields a real person), never silently
// photo-realised.

export interface RemixPromptInput {
  /** Free-text idea / brief. Optional — a reference image alone is enough. */
  idea?: string;
  /** "auto" | realistic | anime | comic | pixar … — "auto" mirrors the reference's medium 1:1. */
  styleId?: string;
  /** Whether a reference image is attached to the generation call. */
  hasReference: boolean;
  count: number;
}

/**
 * Build `count` distinct "remix" portrait prompts inspired by an uploaded image
 * and/or a free-text idea. Re-rolls randomly on every call so repeated runs
 * keep producing fresh suggestions.
 */
export function buildRemixPrompts(input: RemixPromptInput): string[] {
  // Silently normalise the free-text idea so the output stays within policy
  // regardless of what was typed (mirrors the Chat/Quick creators).
  const ideaClean = sanitizeText(input.idea).clean;
  const minor = looksLikeMinor(input.idea);

  // "auto" → faithfully mirror the reference's medium (cartoon → cartoon,
  // photo → photo). A concrete style pick (anime/comic/pixar/realistic) always
  // wins and overrides whatever the reference looks like. With no reference,
  // "auto" falls back to photorealistic.
  const auto = !input.styleId || input.styleId === "auto";
  const styleKey = auto ? "realistic" : resolveStyleKey(input.styleId);
  // Only when we're in auto mode WITH a reference do we replicate its medium
  // 1:1 — otherwise the explicit STYLE_TECH (or the realistic fallback) drives.
  const matchReference = auto && input.hasReference;

  const traits = rollTraits(input.count);

  return traits.map((t) => {
    const mediumLine = matchReference
      ? "CRITICAL — replicate the reference image's EXACT visual medium and degree of realism. " +
        "First read whether the reference is a real photograph or a piece of artwork (2D cartoon, " +
        "anime, comic, illustration, painting, 3D / CGI render, etc.), then render the output in that " +
        "very same medium and art style — matching linework, shading, colour treatment, proportions " +
        "and rendering technique. If the reference is NON-photographic (a drawn or rendered character), " +
        "the result MUST also be a drawn / rendered character in the SAME style — absolutely NOT a real " +
        "human and NOT a photograph. If the reference is a photograph of a real human, the result MUST " +
        "be an equally photorealistic real human."
      : `Style: ${STYLE_TECH[styleKey]}.`;

    const sourceLine = input.hasReference
      ? "Use the supplied reference image as the creative source for genre, vibe, aesthetic and " +
        "styling. Do NOT copy the reference subject's face, identity or exact features — invent a " +
        "fresh, different character that simply belongs in the same world."
      : "";

    const ideaLine = ideaClean ? `Creative brief / idea: ${ideaClean}.` : "";

    const lines = [
      "A single portrait of ONE original character — a fresh remix inspired by the source below, never a copy of it.",
      sourceLine,
      ideaLine,
      mediumLine,
      `Distinct appearance — ${t.hair} in ${t.hairColor}, ${t.hairStyling}; ${t.eyes} eyes, ` +
        `${t.eyeShape}; ${t.brows}; ${t.nose}; ${t.lips}; ${t.body} build; ${t.face}; ` +
        `${t.ageNudge}; expression: ${t.expression}.`,
      // Photo-skin realism cues only when we KNOW the output is photoreal — never
      // for a matched cartoon/illustrated reference, where pores make no sense.
      styleKey === "realistic" && !matchReference ? `Realism detail: ${t.extra}.` : "",
      "Framing: front-facing head-and-shoulders portrait from the chest up, head squared to the frame, " +
        "both eyes looking toward the viewer, sharp focus on the face, centered symmetrical composition.",
      SINGLE_FORWARD,
      WHITE_BG,
      // Medium-neutral distinct-individual directive: unlike the other creators
      // this must NOT force a "real person", or it would override a cartoon /
      // illustrated reference and drag the result back to a photograph.
      `Unique character ${t.seed}. A COMPLETELY DIFFERENT, unrelated individual — not the reference's ` +
        "character and not a twin, sibling or variation of anyone else. Give them their own distinct " +
        "features, proportions and overall vibe, while keeping them rendered in exactly the same medium " +
        "and art style established above.",
      NO_TEXT,
      SAFE_PORTRAIT_CLAUSE,
      minor ? MINOR_SAFE_CLAUSE : "",
      NEGATIVE,
    ];
    return lines.filter(Boolean).join("\n");
  });
}
