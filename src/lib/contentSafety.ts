/**
 * Silent content-safety layer for the character creators.
 *
 * Design goal (per product spec): the chat NEVER refuses a wish out loud — the
 * UI happily accepts whatever the user types and answers "okay". Compliance
 * happens *quietly in the background*: right before a wish is turned into an
 * image-generation prompt, we normalise it so the actual output always stays
 * within content policy.
 *
 * What this does NOT do: it never produces disallowed content. It only strips /
 * neutralises the small set of requests that would push a portrait outside
 * policy — explicit or suggestive sexual content, any sexualisation of minors,
 * hateful / extremist symbols, gore, and real-person impersonation / deepfakes.
 * Everything creative and benign (blue skin, elf ears, robots, scars, tattoos,
 * piercings, horns, wild hair colours …) passes through untouched.
 *
 * It is deliberately a denylist + an always-on positive guarantee
 * (`SAFE_PORTRAIT_CLAUSE`). Neither is perfect alone; together with the clothed
 * wardrobe, white background and head-and-shoulders framing already baked into
 * the prompt builder, the generated portrait stays clean even when the input
 * does not.
 */

export interface SafetyResult {
  /** The cleaned text. May be an empty string if the whole input was disallowed. */
  clean: string;
  /** True when anything was removed / changed. */
  changed: boolean;
  /** Which categories were triggered (for optional logging / metrics). */
  categories: string[];
}

interface Rule {
  category: string;
  re: RegExp;
}

// Each rule matches a disallowed phrase; matches are removed from the text.
// `\b` boundaries guard the short/ambiguous words; clearly-sexual roots are
// matched as substrings (so German compounds like "sexszene" / "nacktfoto"
// are caught too) because their false-positive risk is essentially zero.
const RULES: Rule[] = [
  // ── Explicit / suggestive sexual content ────────────────────────────────
  { category: "sexual", re: /\bnudes?\b/gi },
  { category: "sexual", re: /\bnaked\b/gi },
  { category: "sexual", re: /nudity/gi },
  { category: "sexual", re: /nackt\w*/gi },
  { category: "sexual", re: /unbekleidet|entkleidet|entblö(ß|ss)t/gi },
  { category: "sexual", re: /topless|oben\s*ohne/gi },
  { category: "sexual", re: /\bsex\b/gi },
  { category: "sexual", re: /sexual|sexuell\w*|sexy/gi },
  { category: "sexual", re: /erotic|erotik|erotisch\w*/gi },
  { category: "sexual", re: /sensual|sinnlich\w*/gi },
  { category: "sexual", re: /porno?\w*|pornograf\w*|pornograph\w*/gi },
  { category: "sexual", re: /\bnsfw\b|x-?rated|18\s*\+/gi },
  { category: "sexual", re: /hentai|ecchi|lewd|lasciv\w*|obscene|obsz(ö|oe)n\w*/gi },
  { category: "sexual", re: /fetish|fetisch\w*|bdsm|bondage|\bdomina(?:trix)?\b/gi },
  { category: "sexual", re: /lingerie|dessous|neglig(e|é|ee)\w*|nightie|night\s*dress|nachthemd/gi },
  { category: "sexual", re: /\bthong\b|g-?string|string-?tanga/gi },
  { category: "sexual", re: /cleavage|d(é|e)kollet(é|e)\w*|d(é|e)collet\w*/gi },
  { category: "sexual", re: /low[-\s]?cut|low\s*neckline|deep\s*neckline|tiefer?\s*ausschnitt/gi },
  { category: "sexual", re: /busty|big\s*breasts?|huge\s*breasts?|\bboobs?\b|\btits?\b|\bnipples?\b/gi },
  { category: "sexual", re: /\bbreasts?\b|brüste|busen/gi },
  { category: "sexual", re: /genital\w*|\bpenis\b|\bvagina\b|vulva|\banus\b|buttocks|\bbutt\b|crotch|\bschritt\b|\bpo\b/gi },
  { category: "sexual", re: /seductive|verf(ü|ue)hrerisch|alluring|provoc\w*|provokant|suggestive|anz(ü|ue)glich/gi },
  { category: "sexual", re: /masturbat\w*|orgasm\w*|\bcum\b|ejacul\w*/gi },
  { category: "sexual", re: /escort|prostitu\w*|hooker|stripper|stripteas\w*|camgirl/gi },
  { category: "sexual", re: /scantily|skimpy|barely\s*dressed|revealing\s*(outfit|clothing|dress)|see-?through|sheer\s*(top|outfit|fabric)|durchsichtig/gi },
  { category: "sexual", re: /upskirt|downblouse/gi },
  { category: "sexual", re: /\bbikini\b/gi },

  // ── Hateful / extremist symbols ─────────────────────────────────────────
  { category: "hate", re: /\bnazis?\b|neonazis?|hitler|swastika|hakenkreuz|sieg\s*heil|ss-?rune|white\s*power/gi },
  { category: "hate", re: /\bkkk\b|ku\s*klux\s*klan/gi },
  { category: "hate", re: /\bisis\b|\bdaesh\b/gi },
  { category: "hate", re: /hate\s*symbol|hass\s*symbol/gi },

  // ── Gore / graphic violence ─────────────────────────────────────────────
  { category: "gore", re: /\bgore\b|\bgory\b|bloody|blut(ü|ue)berstr(ö|oe)mt|decapitat\w*|beheaded|enthauptet/gi },
  { category: "gore", re: /dismember\w*|mutilat\w*|disembowel\w*|entrails|guts|leiche\w*|corpse|severed\s*head/gi },

  // ── Real-person impersonation / deepfakes ───────────────────────────────
  { category: "impersonation", re: /deep\s*-?fake\w*/gi },
  // Note: the adjective "prominent" (prominent cheekbones/nose) is benign and
  // common in portraits, so we only catch the celebrity senses here.
  { category: "impersonation", re: /celebrity|celebrities|\bpromi\b|\bpromis\b|prominenter?\s+(person|mensch|star)/gi },
  { category: "impersonation", re: /(looks?\s*exactly\s*like|exact\s*likeness\s*of|identical\s*to)\b[^.,;\n]*/gi },
  { category: "impersonation", re: /(sieht\s*genau\s*aus\s*wie|exakt\s*wie)\b[^.,;\n]*/gi },
];

/** Tidy up the artefacts left behind after phrases are removed. */
function tidy(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")          // collapse runs of spaces
    .replace(/\s+([,.;:!?])/g, "$1")  // no space before punctuation
    .replace(/([,;:])\s*(?=[,;:])/g, "") // collapse doubled separators
    .replace(/^[\s,.;:!?-]+/, "")     // strip leading punctuation/space
    .replace(/[\s,;:-]+$/, "")        // strip trailing separators/space
    .trim();
}

/**
 * Strip disallowed phrases from a single free-text wish. The result is what
 * gets baked into the image prompt; the original text the user typed is left
 * alone elsewhere (the chat still shows / stores exactly what they wrote).
 */
export function sanitizeText(raw: string | undefined | null): SafetyResult {
  const input = (raw ?? "").toString();
  if (!input.trim()) return { clean: "", changed: false, categories: [] };

  let out = input;
  const categories = new Set<string>();
  for (const rule of RULES) {
    if (rule.re.test(out)) {
      categories.add(rule.category);
      out = out.replace(rule.re, " ");
    }
  }

  const clean = tidy(out);
  return {
    clean,
    changed: clean !== input.trim(),
    categories: [...categories],
  };
}

/**
 * Convenience: sanitise and fall back to a neutral default when the wish was
 * entirely disallowed (so a stripped field becomes a normal randomised trait
 * rather than an empty hole in the prompt).
 */
export function sanitizeOr(raw: string | undefined | null, fallback: string): string {
  const { clean } = sanitizeText(raw);
  return clean || fallback;
}

// ── Minor protection ──────────────────────────────────────────────────────

const MINOR_WORDS =
  /\b(kid|kids|child|children|toddler|baby|infant|minor|teen|teenager|preteen|loli|shota|schoolgirl|schoolboy)\b|kind\b|kinder\b|kleinkind|s(ä|ae)ugling|minderj(ä|ae)hrig\w*|sch(ü|ue)ler\w*|jugendlich\w*|teenager/i;

/**
 * Best-effort check whether an age description refers to a minor. Used to apply
 * an extra wholesome guarantee (no body emphasis, no adult cues) on top of the
 * always-on sexual-content stripping.
 */
export function looksLikeMinor(ageText: string | undefined | null): boolean {
  const s = (ageText ?? "").toString().toLowerCase();
  if (!s) return false;
  if (MINOR_WORDS.test(s)) return true;
  // Any explicit number below 18 → minor (e.g. "16", "14 Jahre", "ab 12").
  const nums = s.match(/\d{1,3}/g);
  if (nums && nums.some((n) => Number(n) > 0 && Number(n) < 18)) return true;
  return false;
}

/**
 * Always appended to every generated prompt: the positive guarantee that the
 * output is policy-compliant regardless of what the input asked for.
 */
export const SAFE_PORTRAIT_CLAUSE =
  "Keep this a wholesome, tasteful, fully-clothed, strictly non-sexual and age-appropriate portrait. " +
  "No nudity, no revealing, sheer or suggestive clothing, no sexual, fetish or provocative elements, " +
  "no hateful or extremist symbols, no gore or graphic violence, and not a real or identifiable public person.";

/**
 * Extra clause added when the subject is a minor — an explicit, unambiguous
 * instruction that the depiction must stay innocent.
 */
export const MINOR_SAFE_CLAUSE =
  "The subject is a minor: depict them in a strictly innocent, wholesome and age-appropriate way — " +
  "no sexualisation, no adult or revealing clothing, no makeup emphasis, no suggestive poses and no body emphasis of any kind.";
