/**
 * Stimmen des eigenen ElevenLabs-Accounts.
 *
 * Ohne eigenen Key läuft TTS über fals ElevenLabs-Wrapper, und der akzeptiert
 * ausschließlich NAMEN aus einer festen Liste englischer Premade-Stimmen
 * (`ELEVEN_VOICES`). Mit eigenem Key spricht der Server ElevenLabs direkt an —
 * dann ist `voice` eine `voice_id`, und damit sind die eigenen (geklonten,
 * deutschen) Stimmen des Accounts erreichbar.
 *
 * Diese Datei kapselt genau diesen Unterschied: wer eine Auswahlliste braucht,
 * fragt `voiceOptions`, und wer einen gespeicherten Wert benutzen will, schickt
 * ihn durch `resolveVoiceValue` — beides funktioniert in beiden Welten.
 */

import { useEffect, useState } from "react";
import { listElevenVoices, type ElevenVoice } from "@/lib/serverAI";
import { ELEVEN_VOICES, defaultVoiceFor, falPremadeVoiceName } from "@/lib/storyPrompts";

export type { ElevenVoice };

/** Eine Option für `<Select>` — `value` ist exakt das, was als `voice` in die
 *  TTS-Anfrage gehört (Name ODER voice_id, je nach Weg). */
export interface VoiceOption {
  value: string;
  label: string;
  group: string;
}

// Ein Account ändert seine Stimmen nicht im Sekundentakt, und die Liste wird an
// mehreren Stellen gleichzeitig gebraucht (Picker UND Story-Seite). Ohne Cache
// liefe pro Mount eine eigene Anfrage — und beim Tippen im Key-Feld eine pro
// Tastendruck. Key als Cache-Schlüssel: ein anderer Account ist eine andere Liste.
const cache = new Map<string, Promise<ElevenVoice[]>>();

function load(elevenKey: string): Promise<ElevenVoice[]> {
  const hit = cache.get(elevenKey);
  if (hit) return hit;
  const p = listElevenVoices(elevenKey).catch((e) => {
    // Fehlschläge NICHT dauerhaft cachen: sonst bleibt die Liste nach einem
    // einzelnen Netzaussetzer bis zum Reload leer.
    cache.delete(elevenKey);
    throw e;
  });
  cache.set(elevenKey, p);
  return p;
}

/**
 * Die Kontoliste als PROMISE — für Abläufe, die nicht auf einen Render warten
 * können.
 *
 * Der Grund ist ein echter Tonverlust: Die Vertonung entscheidet am Inhalt
 * dieser Liste, ob der ElevenLabs-Direktweg gilt (`voice` = voice_id) oder der
 * fal-Weg (`voice` = Premade-Name). Startet ein Lauf, während der Hook noch
 * lädt, ist die Liste leer — die Entscheidung fällt dann auf „fal", obwohl die
 * gewählte Stimme eine Konto-ID ist. Ohne fal-Key gibt es dort gar keinen Weg,
 * die Szene bleibt ohne Tonspur, und beim Stapellauf trifft es genau die ersten
 * Szenen: „einige Clips ohne Ton". Wer hier `await`et, entscheidet auf der
 * fertigen Liste. Nutzt denselben Modul-Cache — kein zusätzlicher Request.
 */
export function ensureElevenVoices(elevenKey: string): Promise<ElevenVoice[]> {
  if (!elevenKey) return Promise.resolve([]);
  return load(elevenKey);
}

export function useElevenVoices(elevenKey: string) {
  const [voices, setVoices] = useState<ElevenVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!elevenKey) { setVoices([]); setError(null); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    setError(null);
    load(elevenKey)
      .then((v) => { if (alive) { setVoices(v); setLoading(false); } })
      .catch((e) => {
        if (!alive) return;
        setVoices([]);
        setError(e?.message || "Stimmen konnten nicht geladen werden.");
        setLoading(false);
      });
    return () => { alive = false; };
  }, [elevenKey]);

  return { voices, loading, error };
}

/** Eigene Stimme (geklont/generiert/professional) statt Katalogstimme? */
function isOwn(v: ElevenVoice): boolean {
  return !!v.category && v.category !== "premade";
}

/**
 * Kennt fals TTS-Enum diesen Wert? NUR diese Namen funktionieren auf dem
 * fal-Weg — alles andere quittiert fal mit 422 „Voice not found".
 *
 * Hier stand vorher eine Formerkennung („18–24 alphanumerische Zeichen UND
 * mindestens eine Ziffer"), um voice_ids abzufangen. Sie hat an einer echten ID
 * versagt: `ntGEEyBzNzbhPXyRGiMu` enthält zufällig keine einzige Ziffer, galt
 * damit als Name und ging ungeprüft an fal — 422, Szene ohne Ton. Etwa jede
 * 35. ElevenLabs-ID trifft das.
 *
 * Die exakte Liste liegt jetzt bei `ELEVEN_VOICES` selbst, damit die Vertonung
 * (lib/voice.ts) dieselbe Prüfung nutzen kann, ohne aus einem Hook zu importieren.
 */
const falPremadeName = falPremadeVoiceName;

/**
 * Stammt dieser Wert wirklich aus der geladenen Kontoliste?
 *
 * DAS ist die Bedingung für den ElevenLabs-Direktweg — nicht das blosse
 * Vorhandensein eines Keys. Genau daran lag der Hauptfehler: der Server
 * entscheidet den Weg allein am Key, der Wert kam aber aus der Kontoliste. War
 * die Liste leer (Key ohne `voices_read`, Netzfehler, Liste noch am Laden),
 * lieferte `resolveVoiceValue` einen Premade-NAMEN — der ging als voice_id an
 * ElevenLabs, kam als 404 zurück, die Szene bekam gar keine Tonspur und behielt
 * die zufällige Stimme des Videomodells.
 */
export function isAccountVoice(value: string, voices: ElevenVoice[]): boolean {
  return !!value && voices.some((v) => v.voiceId === value);
}

function describe(v: ElevenVoice): string {
  const parts = [v.language && v.language.toUpperCase(), v.gender, v.description].filter(Boolean);
  return parts.length ? ` — ${parts.join(", ")}` : "";
}

/**
 * Die Auswahlliste für das Stimmen-Dropdown.
 * Mit Account-Stimmen stehen die EIGENEN oben — das ist der Grund, warum jemand
 * einen eigenen Key hinterlegt.
 */
export function voiceOptions(voices: ElevenVoice[]): VoiceOption[] {
  if (voices.length > 0) {
    const own = voices.filter(isOwn);
    const premade = voices.filter((v) => !isOwn(v));
    return [
      ...own.map((v) => ({ value: v.voiceId, label: `${v.name}${describe(v)}`, group: "Deine Stimmen" })),
      ...premade.map((v) => ({ value: v.voiceId, label: `${v.name}${describe(v)}`, group: "ElevenLabs-Katalog" })),
    ];
  }

  return ELEVEN_VOICES.map((v) => ({
    value: v.name,
    label: `${v.name} — ${v.hint}`,
    group: v.gender === "female" ? "Weiblich" : "Männlich",
  }));
}

/**
 * Einen gespeicherten Stimmwert für den AKTIVEN Weg brauchbar machen.
 *
 * Der Wert wandert unverändert ins Projekt, überlebt also das Hinterlegen eines
 * ElevenLabs-Keys — und ein gespeicherter Name ("Sarah") ist danach als
 * `voice_id` wertlos (ElevenLabs antwortet mit 404, die Szene bliebe stumm).
 * Deshalb hier prüfen und notfalls auf eine echte Stimme des Accounts fallen,
 * statt den toten Wert weiterzureichen.
 */
export function resolveVoiceValue(
  stored: string,
  voices: ElevenVoice[],
  gender: "male" | "female" | "neutral" = "neutral",
  /**
   * Liegt ein eigener ElevenLabs-Key vor? Dann bleibt eine gespeicherte voice_id
   * auch dann stehen, wenn die Kontoliste (noch) leer ist — sonst würde eine
   * bloß langsame oder fehlgeschlagene Liste die GEWÄHLTE Stimme still durch
   * eine fremde Premade-Stimme ersetzen. Die Weiche in `renderSceneVoice` kommt
   * mit der ID zurecht: sie entscheidet am Wert, nicht an dieser Liste.
   */
  hasElevenKey = false,
): string {
  // Keine Account-Liste (kein Key oder noch am Laden) → es gilt der fal-Weg, und
  // dort zählen NAMEN. Eine gespeicherte voice_id (Key war mal gesetzt, ist es
  // jetzt nicht mehr) wäre dort wertlos — fal lehnt sie mit 422 ab.
  //
  // Bewusst umgedreht: durchgelassen wird nur noch, was fal NACHWEISLICH kennt.
  // Vorher wurde alles durchgelassen, was nicht wie eine ID AUSSAH — eine ID
  // ohne Ziffern rutschte damit durch und kostete die Szene ihre Tonspur.
  if (voices.length === 0) {
    if (hasElevenKey && stored) return stored;
    return (stored ? falPremadeName(stored) : null) ?? defaultVoiceFor(gender);
  }
  if (stored && voices.some((v) => v.voiceId === stored)) return stored;

  // Fallback-Reihenfolge: gleichnamige Stimme (der Nutzer hatte „Sarah" gewählt
  // und hat vielleicht genau die auch im Account) → eigene Stimme → erste.
  const byName = stored ? voices.find((v) => v.name.toLowerCase() === stored.toLowerCase()) : undefined;
  const own = voices.find(isOwn);
  return (byName || own || voices[0]).voiceId;
}
