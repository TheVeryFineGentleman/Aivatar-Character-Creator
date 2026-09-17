import { useEffect, useRef, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import {
  fetchAccountKeys,
  getAccountKeysSnapshot,
  saveAccountKeys,
  setAccountKeysSession,
  subscribeAccountKeys,
} from "@/lib/accountKeys";

/**
 * Hält die API-Keys mit dem Konto im Einklang — aber nur, wenn der Kunde das
 * Häkchen gesetzt hat (siehe `AccountKeysConsent`).
 *
 * Beim Login gilt das Konto: hinterlegte Keys werden übernommen, damit in jedem
 * Browser derselbe Key steht. Was nur lokal existiert, wird ins Konto nachgetragen.
 * Danach geht jede Änderung mit kurzer Verzögerung ins Konto.
 */
export function AccountKeysSync() {
  const { license } = useAuth();
  const token = license?.valid ? license.sessionToken : undefined;
  const { googleKey, falKey, elevenKey, setGoogleKey, setFalKey, setElevenKey } = useSettings();
  const state = useSyncExternalStore(subscribeAccountKeys, getAccountKeysSnapshot);
  const loadedFor = useRef<string | null>(null);

  useEffect(() => { setAccountKeysSession(token); }, [token]);

  useEffect(() => {
    if (!token || loadedFor.current === token) return;
    loadedFor.current = token;
    void (async () => {
      const res = await fetchAccountKeys();
      if (!res?.consent) return;
      // Konto gewinnt — sonst bliebe in einem Browser ein alter Key stehen.
      if (res.keys.google && res.keys.google !== googleKey) setGoogleKey(res.keys.google);
      if (res.keys.fal && res.keys.fal !== falKey) setFalKey(res.keys.fal);
      if (res.keys.eleven && res.keys.eleven !== elevenKey) setElevenKey(res.keys.eleven);
      // Nur lokal vorhandene Keys ins Konto nachtragen.
      const merged = {
        google: res.keys.google || googleKey,
        fal: res.keys.fal || falKey,
        eleven: res.keys.eleven || elevenKey,
      };
      await saveAccountKeys(merged);
    })();
    // Absicht: nur am Token hängen — die Keys von jetzt sind im Effekt gelesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (state.status !== "on" || !token || loadedFor.current !== token) return;
    const h = setTimeout(() => { void saveAccountKeys({ google: googleKey, fal: falKey, eleven: elevenKey }); }, 1500);
    return () => clearTimeout(h);
  }, [googleKey, falKey, elevenKey, state.status, token]);

  return null;
}
