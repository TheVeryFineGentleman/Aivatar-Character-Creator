import { Fragment, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getSyncSnapshot, setSyncSession, subscribeSync } from "@/lib/projectSync";

/**
 * Verbindet den Konto-Abgleich (lib/projectSync) mit der Anmeldung.
 *
 * Hat der Abgleich Projekte ausgetauscht, steigt `reloadVersion`: Seiten lesen
 * ihren Stand nur beim Einhängen aus dem Speicher, der neue Schlüssel am
 * Fragment hängt sie mit dem frischen Stand neu ein. Die Anmeldung darüber
 * (AuthProvider) bleibt davon unberührt.
 */
export function ProjectSyncRoot({ children }: { children: ReactNode }) {
  const { license } = useAuth();
  // Nur `vite dev`: Test-Token, um den Abgleich ohne echte Lizenz zu prüfen.
  const devToken = import.meta.env.DEV ? readDevToken() : undefined;
  const token = (license?.valid ? license.sessionToken : undefined) ?? devToken;

  useEffect(() => { setSyncSession(token); }, [token]);

  const { reloadVersion } = useSyncExternalStore(subscribeSync, getSyncSnapshot);
  return <Fragment key={reloadVersion}>{children}</Fragment>;
}

function readDevToken(): string | undefined {
  try { return localStorage.getItem("aivatar:dev.sessionToken") || undefined; } catch { return undefined; }
}
