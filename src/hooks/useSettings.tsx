import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { KEYS, ls } from "@/lib/storage";

export type Provider = "google" | "fal";

/**
 * Video-Provider-Auswahl: zwei API-Keys können parallel hinterlegt sein
 * (Google Gemini & fal.ai). Für Text- und Bild-Generierung wird IMMER Google
 * verwendet — fal.ai kann nur Video.
 *
 * Der `provider`-Toggle dient als **Priorität für Video-Generierung**: der
 * ausgewählte Provider wird zuerst genutzt, wenn dessen Key vorhanden ist;
 * sonst fällt die App auf den anderen zurück. `videoApi` kapselt diese Logik.
 */
interface SettingsValue {
  provider: Provider;       // Video-Priorität — siehe Modul-Kommentar
  googleKey: string;
  falKey: string;
  setProvider: (p: Provider) => void;
  setGoogleKey: (k: string) => void;
  setFalKey: (k: string) => void;
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
  /** True wenn mindestens ein Key (Google ODER fal) gesetzt ist. */
  hasGenKey: boolean;

  /** Praktische Booleans für UI-Logik (z. B. Provider-Tiles disabled). */
  hasGoogleKey: boolean;
  hasFalKey: boolean;

  /**
   * Smart-Pick für Video: priorisiert `provider`, fällt auf den anderen
   * zurück wenn dessen Key gesetzt ist. `null` heißt: gar kein Video-Key.
   */
  videoApi: { provider: Provider; key: string } | null;
  /** True wenn mindestens ein Video-Key verfügbar ist. */
  hasVideoKey: boolean;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [provider, setProviderState] = useState<Provider>(() => (ls.get<Provider>(KEYS.PROVIDER) as Provider) || "google");
  const [googleKey, setGoogleKeyState] = useState<string>(() => ls.get<string>(KEYS.API_GOOGLE) || "");
  const [falKey, setFalKeyState] = useState<string>(() => ls.get<string>(KEYS.API_FAL) || "");

  useEffect(() => { ls.set(KEYS.PROVIDER, provider); }, [provider]);
  useEffect(() => { ls.set(KEYS.API_GOOGLE, googleKey); }, [googleKey]);
  useEffect(() => { ls.set(KEYS.API_FAL, falKey); }, [falKey]);

  const setProvider = useCallback((p: Provider) => setProviderState(p), []);
  const setGoogleKey = useCallback((k: string) => setGoogleKeyState(k.trim()), []);
  const setFalKey = useCallback((k: string) => setFalKeyState(k.trim()), []);

  const clearAll = useCallback(() => {
    setGoogleKeyState("");
    setFalKeyState("");
    ls.remove(KEYS.API_GOOGLE);
    ls.remove(KEYS.API_FAL);
  }, []);

  const videoApi = useMemo<SettingsValue["videoApi"]>(() => {
    const preferred: { provider: Provider; key: string } | null =
      provider === "fal"
        ? (falKey ? { provider: "fal", key: falKey } : null)
        : (googleKey ? { provider: "google", key: googleKey } : null);
    if (preferred) return preferred;
    // Fallback: der nicht-priorisierte Provider, falls dessen Key gesetzt ist
    if (provider === "fal" && googleKey) return { provider: "google", key: googleKey };
    if (provider === "google" && falKey)  return { provider: "fal",    key: falKey    };
    return null;
  }, [provider, googleKey, falKey]);

  // Symmetrische Kette für ALLE Generierung: gewählter Provider zuerst, der
  // andere als Fallback — jeweils nur mit gesetztem Key.
  const genChain = useMemo<{ provider: Provider; key: string }[]>(() => {
    const g = { provider: "google" as Provider, key: googleKey };
    const f = { provider: "fal" as Provider, key: falKey };
    const ordered = provider === "fal" ? [f, g] : [g, f];
    return ordered.filter((x) => !!x.key);
  }, [provider, googleKey, falKey]);

  return (
    <SettingsContext.Provider value={{
      provider, googleKey, falKey,
      setProvider, setGoogleKey, setFalKey,
      clearAll,
      activeKey: googleKey,
      hasActiveKey: !!googleKey,
      genChain,
      hasGenKey: genChain.length > 0,
      hasGoogleKey: !!googleKey,
      hasFalKey: !!falKey,
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
