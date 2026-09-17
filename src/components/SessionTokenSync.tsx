import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { setSessionToken } from "@/lib/session";

/** Reicht das Sitzungs-Token an Nicht-React-Module weiter (siehe `lib/session`). */
export function SessionTokenSync() {
  const { license } = useAuth();
  useEffect(() => {
    setSessionToken(license?.valid ? license.sessionToken : undefined);
  }, [license]);
  return null;
}
