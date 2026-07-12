/**
 * Nationality presets — drives prompt nuance for the Quick & Chat character creators.
 * Each entry maps to a brief phrase that nudges Gemini towards plausible facial features,
 * skin tone, and hair palette. Not a stereotype dictionary — a starting hint.
 */

export interface Nationality {
  code: string;
  flag: string;
  label: string;
  promptHint: string;
}

export const NATIONALITIES: Nationality[] = [
  { code: "DE", flag: "🇩🇪", label: "Deutsch",       promptHint: "Northern European features, fair skin, often straight nose, rectangular jaw, blonde to brown hair" },
  { code: "FR", flag: "🇫🇷", label: "Französisch",    promptHint: "Western European features, light olive skin, refined facial bone structure, dark blonde to brown hair" },
  { code: "IT", flag: "🇮🇹", label: "Italienisch",    promptHint: "Southern European features, warm olive skin, dark Mediterranean bone structure, dark hair" },
  { code: "ES", flag: "🇪🇸", label: "Spanisch",       promptHint: "Iberian features, warm olive complexion, expressive brown eyes, dark hair" },
  { code: "GB", flag: "🇬🇧", label: "Britisch",       promptHint: "British Isles features, fair skin with slight pink undertone, varied hair colours including auburn" },
  { code: "IE", flag: "🇮🇪", label: "Irisch",         promptHint: "Celtic features, very fair skin, freckles common, red or dark hair, blue or green eyes" },
  { code: "NL", flag: "🇳🇱", label: "Niederländisch", promptHint: "North-Western European features, fair skin, often blonde hair, tall facial structure" },
  { code: "PL", flag: "🇵🇱", label: "Polnisch",       promptHint: "Central European Slavic features, fair skin, light hair, often blue or grey eyes" },
  { code: "RU", flag: "🇷🇺", label: "Russisch",       promptHint: "Eastern European Slavic features, fair skin, strong cheekbones, blonde or brown hair" },
  { code: "TR", flag: "🇹🇷", label: "Türkisch",       promptHint: "Anatolian features, warm olive skin, expressive dark eyes, dark hair, defined brows" },
  { code: "GR", flag: "🇬🇷", label: "Griechisch",     promptHint: "Mediterranean features, olive skin, classical face proportions, dark hair" },
  { code: "JP", flag: "🇯🇵", label: "Japanisch",      promptHint: "East Asian features, smooth fair skin, almond-shaped eyes, small nose, jet-black hair" },
  { code: "KR", flag: "🇰🇷", label: "Koreanisch",     promptHint: "East Asian features, clear fair skin, almond eyes, defined cheekbones, black hair" },
  { code: "CN", flag: "🇨🇳", label: "Chinesisch",     promptHint: "East Asian features, fair to warm complexion, almond eyes, straight black hair" },
  { code: "IN", flag: "🇮🇳", label: "Indisch",        promptHint: "South Asian features, brown skin tones (light to deep), dark eyes, dark wavy black hair" },
  { code: "BR", flag: "🇧🇷", label: "Brasilianisch",  promptHint: "Mixed Latin American features, varied skin tones, dark hair, expressive features" },
  { code: "MX", flag: "🇲🇽", label: "Mexikanisch",    promptHint: "Latin American features, warm tan skin, dark eyes, dark hair, defined features" },
  { code: "US", flag: "🇺🇸", label: "US-Amerikanisch",promptHint: "Diverse American features, varied skin tones and ethnicities — interpret naturally" },
  { code: "NG", flag: "🇳🇬", label: "Nigerianisch",   promptHint: "West African features, deep dark skin tone, broad facial structure, full lips, dark eyes" },
  { code: "EG", flag: "🇪🇬", label: "Ägyptisch",      promptHint: "North African / Arab features, warm tan skin, expressive dark eyes, dark hair" },
];

export function pickRandomNationality(): Nationality {
  return NATIONALITIES[Math.floor(Math.random() * NATIONALITIES.length)];
}

export function findNationality(code: string): Nationality | undefined {
  return NATIONALITIES.find((n) => n.code === code);
}
