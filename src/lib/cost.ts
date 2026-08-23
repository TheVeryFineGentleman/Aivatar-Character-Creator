/**
 * Was ein Durchgang ungefähr kostet — die Zahl, die VOR dem Klick fehlt.
 *
 * Die Nutzer zahlen mit ihrem eigenen fal-Key; ein Reel mit acht Sprechszenen
 * ist keine Kleinigkeit, und bisher stand nirgends, worauf man sich einlässt.
 * Deshalb hier eine ehrliche Spanne statt einer Scheingenauigkeit: Die Cliplänge
 * steht vorher nicht fest (beim sprechenden Avatar bestimmt sie das Audio), also
 * wird von–bis gerechnet.
 *
 * PREISE — Stand 2026-08-06, von den fal-Modellseiten abgelesen. fal rechnet
 * sekundengenau ab, die Modellpfade sind exakt die, die `Server/server.js`
 * anspricht. Ändert fal die Preise, gehört dieser Block angefasst — sonst zeigt
 * die Oberfläche eine Zahl, die niemand mehr prüfen kann.
 */

export const FAL_PRICES = {
  /** fal-ai/kling-video/v1/pro/ai-avatar — Sprechszenen (Bild + Ton → lippensynchroner Clip). */
  avatarPerSecond: 0.115,
  /** fal-ai/bytedance/omnihuman/v1.5 — Duo-Sprechszenen (beide im Bild, Maske wählt den Sprecher). */
  omnihumanPerSecond: 0.14,
  /** fal-ai/kling-video/v2.6/pro/image-to-video, ohne native Tonspur. */
  klingPerSecond: 0.07,
  /** fal-ai/nano-banana (und /edit) — ein Szenenbild. */
  imagePerImage: 0.039,
  /** fal-ai/elevenlabs/tts/multilingual-v2 — pro 1000 Zeichen. */
  ttsPer1000Chars: 0.1,
} as const;

/** Sekunden pro Szene, wie sie die Oberfläche auch für die Laufzeit ansetzt. */
export const SECONDS_PER_SCENE = { min: 6, max: 8 } as const;

/** Grob: so viele Zeichen spricht eine Szene in dieser Zeit (~14 Zeichen/Sekunde). */
const CHARS_PER_SECOND = 14;

export interface CostEstimate {
  min: number;
  max: number;
  /** Aufschlüsselung für den Tooltip — jeweils die Obergrenze. */
  parts: { label: string; max: number }[];
}

export interface CostArgs {
  scenes: number;
  /** Sprechende Person im Bild → ai-avatar statt Bild-zu-Video. */
  talkingAvatar: boolean;
  /** Entsteht überhaupt eine TTS-Spur? */
  withVoice: boolean;
  /** Bilder über fal? Mit Google-Key laufen sie über Gemini und zählen hier nicht. */
  imagesViaFal: boolean;
  /** TTS über fal? Mit eigenem ElevenLabs-Key läuft es über dessen Kontingent. */
  ttsViaFal: boolean;
  /** Wie viele der Szenen als DUO-Szene laufen (OmniHuman statt Kling —
   *  teurer pro Video-Sekunde). 0/undefined = keine. */
  duoScenes?: number;
}

/**
 * Schätzt die fal-Kosten eines vollständigen Durchgangs (Bilder + Clips + Stimme).
 * Nicht enthalten, weil sie nicht über fal laufen: Gemini-Bilder, ein eigener
 * ElevenLabs-Vertrag, und Wiederholungen einzelner Szenen.
 */
export function estimateRunCost(args: CostArgs): CostEstimate {
  const { scenes, talkingAvatar, withVoice, imagesViaFal, ttsViaFal } = args;
  // Duo-Szenen zählen nur im Avatar-Modus — ohne Sprechszenen gibt es keinen
  // OmniHuman-Lauf, dann bleibt die Schätzung die bisherige.
  const duo = talkingAvatar ? Math.min(args.duoScenes ?? 0, scenes) : 0;
  const mono = scenes - duo;
  const perSecond = talkingAvatar ? FAL_PRICES.avatarPerSecond : FAL_PRICES.klingPerSecond;

  const parts: { label: string; max: number }[] = [];

  const videoMin = mono * SECONDS_PER_SCENE.min * perSecond + duo * SECONDS_PER_SCENE.min * FAL_PRICES.omnihumanPerSecond;
  const videoMax = mono * SECONDS_PER_SCENE.max * perSecond + duo * SECONDS_PER_SCENE.max * FAL_PRICES.omnihumanPerSecond;
  if (mono > 0) parts.push({ label: `${mono} Clips (${talkingAvatar ? "sprechender Avatar" : "Bild-zu-Video"})`, max: mono * SECONDS_PER_SCENE.max * perSecond });
  if (duo > 0) parts.push({ label: `${duo} Duo-Clips (OmniHuman, beide im Bild)`, max: duo * SECONDS_PER_SCENE.max * FAL_PRICES.omnihumanPerSecond });

  const secMin = scenes * SECONDS_PER_SCENE.min;
  const secMax = scenes * SECONDS_PER_SCENE.max;

  // Duo-Bilder entstehen seit dem Ein-Pass-Umbau wie normale Szenenbilder in
  // EINEM Lauf (beide Charakterfotos im selben Request).
  const imagesCost = imagesViaFal ? scenes * FAL_PRICES.imagePerImage : 0;
  if (imagesCost) parts.push({ label: `${scenes} Szenenbilder`, max: imagesCost });

  const ttsMin = withVoice && ttsViaFal ? (secMin * CHARS_PER_SECOND / 1000) * FAL_PRICES.ttsPer1000Chars : 0;
  const ttsMax = withVoice && ttsViaFal ? (secMax * CHARS_PER_SECOND / 1000) * FAL_PRICES.ttsPer1000Chars : 0;
  if (ttsMax) parts.push({ label: "Sprachaufnahme", max: ttsMax });

  return {
    min: videoMin + imagesCost + ttsMin,
    max: videoMax + imagesCost + ttsMax,
    parts,
  };
}

/** „1,20" — zwei Nachkommastellen, deutsches Komma. */
export function formatUsd(v: number): string {
  return v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
