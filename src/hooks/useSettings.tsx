import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { KEYS, ls } from "@/lib/storage";

export type Provider = "google" | "fal";

/**
 * Video kennt einen Wert mehr als Text/Bild: "kling". Er ist kein eigener
 * Anbieter, sondern ein anderes Modell hinter dem fal-Zugang — deshalb ein
 * eigener Typ statt einer Erweiterung von `Provider` (Text und Bild können
 * nichts mit Kling anfangen).
 */
export type VideoProvider = Provider | "kling";

/**
 * Video-Provider-Auswahl: zwei API-Keys können parallel hinterlegt sein
 * (Google Gemini & fal.ai).
 *
 * Der `provider`-Toggle gilt nur für **Text & Bild** (`genChain`) — dort bleibt
 * der Fallback auf den jeweils anderen Anbieter bewusst erhalten.
 *
 * VIDEO NICHT. Video läuft ausschließlich über **Kling (fal.ai)**, ohne jeden
 * Rückfall: kein Veo, kein Google, keine zweite Kling-Variante. Grund ist nicht
 * Verfügbarkeit, sondern das Ergebnis — ein Rückfall liefert einen Clip, der
 * sichtbar anders aussieht als die Szenen daneben, und ein Reel aus zwei
 * Bildsprachen ist unbrauchbar. Scheitert Kling, scheitert die Szene, mit
 * Begründung. Deshalb braucht Video zwingend einen fal-Key; ein reiner
 * Google-Key erzeugt keine Clips mehr.
 */
interface SettingsValue {
  provider: Provider;       // Priorität für Text & Bild — siehe Modul-Kommentar
  googleKey: string;
  falKey: string;
  /**
   * Eigener ElevenLabs-Key. Optional — ist er gesetzt, läuft die Sprachausgabe
   * DIREKT über ElevenLabs statt über fals Wrapper. Nur so sind die Stimmen des
   * eigenen Accounts (geklonte, deutsche) erreichbar; über fal ist ausschließlich
   * die Liste der englischen Premade-Stimmen auflösbar.
   * Video, Lipsync und Dub brauchen weiterhin den fal-Key.
   */
  elevenKey: string;
  setProvider: (p: Provider) => void;
  setGoogleKey: (k: string) => void;
  setFalKey: (k: string) => void;
  setElevenKey: (k: string) => void;
  clearAll: () => void;

  /** @deprecated Key für Text-/Bild-Generierung (früher immer Google). Nutze genChain. */
  activeKey: string;
  /** @deprecated True wenn ein Google-Key gesetzt ist. Nutze hasGenKey. */
  hasActiveKey: boolean;

  /**
   * Geordnete Provider-Kette für ALLE Generierung (Bild/Text/Video):
   * [gewählter Provider, anderer Provider] — jeweils nur wenn dessen Key gesetzt
   * ist. Der erste wird zuerst genutzt, bei Fehler/fehlendem Key der nächste.
   */
  genChain: { provider: Provider; key: string }[];
  /**
   * Ist die App einsatzbereit? Dafür müssen BEIDE Keys hinterlegt sein.
   *
   * Früher genügte einer von beiden. Das ließ die App scheinbar laufen und
   * scheitern erst dort, wo der fehlende Key gebraucht wird: mit reinem
   * Google-Key entstehen Bilder und Storyboards, aber kein einziger Clip, keine
   * Lippensynchronität und keine feste Stimme — der Nutzer merkt das erst nach
   * dem halben Reel. Mit reinem fal-Key fehlt umgekehrt die Textstrecke.
   * Beide Keys sind Pflicht, und die Prüfung sagt das von Anfang an.
   */
  hasGenKey: boolean;
  /** Welche Pflicht-Keys fehlen — Grundlage der Meldungen. Leer = alles da. */
  missingKeys: Provider[];
  /** Fertiger Satz für Meldungen („Es fehlt der fal.ai-Key."), oder null. */
  missingKeyMessage: string | null;

  /** Praktische Booleans für UI-Logik (z. B. Provider-Tiles disabled). */
  hasGoogleKey: boolean;
  hasFalKey: boolean;
  /** True = Sprachausgabe läuft über den eigenen ElevenLabs-Account. */
  hasElevenKey: boolean;

  /**
   * Video-Kette — enthält NUR Kling (fal.ai), und zwar höchstens einen Eintrag.
   * Sie heißt weiter „Kette", weil die Aufrufer sie als Liste lesen; zu holen
   * gibt es dort aber nichts mehr. Siehe Modul-Kommentar oben, warum es keinen
   * Rückfall mehr gibt.
   */
  videoChain: { provider: VideoProvider; key: string }[];

  /**
   * Video-Zugang: Kling mit dem fal-Key, oder `null` ohne fal-Key.
   * `null` heißt jetzt „kein Video möglich" — auch mit gesetztem Google-Key.
   */
  videoApi: { provider: VideoProvider; key: string } | null;
  /** True wenn ein fal-Key gesetzt ist (= Video möglich). */
  hasVideoKey: boolean;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [provider, setProviderState] = useState<Provider>(() => (ls.get<Provider>(KEYS.PROVIDER) as Provider) || "google");
  const [googleKey, setGoogleKeyState] = useState<string>(() => ls.get<string>(KEYS.API_GOOGLE) || "");
  const [falKey, setFalKeyState] = useState<string>(() => ls.get<string>(KEYS.API_FAL) || "");
  const [elevenKey, setElevenKeyState] = useState<string>(() => ls.get<string>(KEYS.API_ELEVEN) || "");

  useEffect(() => { ls.set(KEYS.PROVIDER, provider); }, [provider]);
  useEffect(() => { ls.set(KEYS.API_GOOGLE, googleKey); }, [googleKey]);
  useEffect(() => { ls.set(KEYS.API_FAL, falKey); }, [falKey]);
  useEffect(() => { ls.set(KEYS.API_ELEVEN, elevenKey); }, [elevenKey]);

  const setProvider = useCallback((p: Provider) => setProviderState(p), []);
  const setGoogleKey = useCallback((k: string) => setGoogleKeyState(k.trim()), []);
  const setFalKey = useCallback((k: string) => setFalKeyState(k.trim()), []);
  const setElevenKey = useCallback((k: string) => setElevenKeyState(k.trim()), []);

  const clearAll = useCallback(() => {
    setGoogleKeyState("");
    setFalKeyState("");
    setElevenKeyState("");
    ls.remove(KEYS.API_GOOGLE);
    ls.remove(KEYS.API_FAL);
    ls.remove(KEYS.API_ELEVEN);
  }, []);

  // Video läuft AUSSCHLIESSLICH über Kling (fal.ai) — siehe `videoChain` oben.
  // Es bleibt eine Liste, weil die Aufrufer sie so lesen; sie hat jetzt aber nie
  // mehr als einen Eintrag, und damit gibt es kein Ausweichen mehr.
  const videoChain = useMemo<{ provider: VideoProvider; key: string }[]>(() => {
    return [{ provider: "kling" as VideoProvider, key: falKey }].filter((x) => !!x.key);
  }, [falKey]);

  // Abwärtskompatibel: `videoApi` ist jetzt schlicht der Kopf der Kette.
  const videoApi = useMemo<SettingsValue["videoApi"]>(
    () => videoChain[0] ?? null,
    [videoChain],
  );

  // Symmetrische Kette für ALLE Generierung: gewählter Provider zuerst, der
  // andere als Fallback — jeweils nur mit gesetztem Key.
  const genChain = useMemo<{ provider: Provider; key: string }[]>(() => {
    const g = { provider: "google" as Provider, key: googleKey };
    const f = { provider: "fal" as Provider, key: falKey };
    const ordered = provider === "fal" ? [f, g] : [g, f];
    return ordered.filter((x) => !!x.key);
  }, [provider, googleKey, falKey]);

  // Beide Keys sind Pflicht (siehe `hasGenKey`). Die Liste steht hier EINMAL,
  // damit jede Meldung in der App denselben Wortlaut benutzt.
  const missingKeys = useMemo<Provider[]>(() => {
    const m: Provider[] = [];
    if (!googleKey) m.push("google");
    if (!falKey) m.push("fal");
    return m;
  }, [googleKey, falKey]);

  const missingKeyMessage = useMemo(() => {
    if (missingKeys.length === 0) return null;
    if (missingKeys.length === 2) return "Es fehlen der Google- und der fal.ai-Key.";
    return missingKeys[0] === "google" ? "Es fehlt der Google-Key." : "Es fehlt der fal.ai-Key.";
  }, [missingKeys]);

  return (
    <SettingsContext.Provider value={{
      provider, googleKey, falKey, elevenKey,
      setProvider, setGoogleKey, setFalKey, setElevenKey,
      clearAll,
      activeKey: googleKey,
      hasActiveKey: !!googleKey,
      genChain,
      hasGenKey: missingKeys.length === 0,
      missingKeys,
      missingKeyMessage,
      hasGoogleKey: !!googleKey,
      hasFalKey: !!falKey,
      hasElevenKey: !!elevenKey,
      videoChain,
      videoApi,
      hasVideoKey: !!videoApi,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
