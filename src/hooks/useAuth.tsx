import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { API } from "@/lib/backend";
import { ls, KEYS } from "@/lib/storage";
import { planFromServer, PLANS, type PlanCapabilities, type PlanTier } from "@/lib/plans";

export interface Credentials {
  email: string;
  licenseKey: string;
}

interface LicenseInfo {
  valid: boolean;
  tier: PlanTier;
  productCode?: string;
  expiresAt?: string;
  isAdmin?: boolean;
}

interface AuthValue {
  credentials: Credentials | null;
  license: LicenseInfo | null;
  loading: boolean;
  error: string | null;
  signIn: (c: Credentials) => Promise<boolean>;
  signOut: () => void;
  refresh: () => Promise<void>;
  plan: PlanCapabilities;
}

const AuthContext = createContext<AuthValue | null>(null);

const ADMIN_EMAILS = new Set<string>([
  // Add admin emails — kept in client only for UI gating
  "admin@aivatar.app",
]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<Credentials | null>(() => ls.get<Credentials>(KEYS.CREDENTIALS));
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkLicense = useCallback(async (c: Credentials): Promise<LicenseInfo> => {
    // Local dev-account bypass — mirrors the Projekt build so testing each tier
    // is one keystroke away. Login with:
    //   "1"/"1" = Basic
    //   "2"/"2" = Pro     (Anzeige) / premium (intern)
    //   "3"/"3" = Premium (Anzeige) / full    (intern) + admin
    //   "4"/"4" = Full    (Anzeige) / studio  (intern) — Vollverkaufsvariante
    // Never hits the server.
    const email = c.email.trim();
    const key = c.licenseKey.trim();
    const DEV: Record<string, { tier: PlanTier; productCode: string; isAdmin?: boolean }> = {
      "1": { tier: "basic",   productCode: "DEV-BASIC" },
      "2": { tier: "premium", productCode: "DEV-PREMIUM" },
      "3": { tier: "full",    productCode: "DEV-FULL", isAdmin: true },
      "4": { tier: "studio",  productCode: "DEV-STUDIO" },
    };
    if (DEV[email] && key === email) {
      return {
        valid: true,
        tier: DEV[email].tier,
        productCode: DEV[email].productCode,
        expiresAt: undefined,
        isAdmin: !!DEV[email].isAdmin,
      };
    }

    const res = await fetch(API("/api/license/check"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: c.email, licenseKey: c.licenseKey }),
    });
    let data: any = null;
    try { data = await res.json(); } catch { /* noop */ }
    if (!res.ok || !data?.valid) {
      const code = data?.code || `HTTP_${res.status}`;
      const messages: Record<string, string> = {
        LICENSE_NOT_FOUND: "Lizenzschlüssel nicht gefunden – prüfe deine Eingabe.",
        LICENSE_EXPIRED: "Lizenz abgelaufen – bitte erneuere deine Lizenz.",
        LICENSE_NOT_ACTIVE: "Lizenz ist nicht aktiv.",
        EMAIL_MISMATCH: "E-Mail stimmt nicht mit der Lizenz überein.",
      };
      throw new Error(messages[code] || data?.error || "Lizenzprüfung fehlgeschlagen.");
    }
    return {
      valid: true,
      tier: planFromServer(data.productCode || data.product?.code),
      productCode: data.productCode || data.product?.code,
      expiresAt: data.expiresAt,
      isAdmin: ADMIN_EMAILS.has(c.email.toLowerCase()),
    };
  }, []);

  const signIn = useCallback(async (c: Credentials) => {
    setLoading(true); setError(null);
    try {
      const info = await checkLicense(c);
      setCredentials(c);
      setLicense(info);
      ls.set(KEYS.CREDENTIALS, c);
      return true;
    } catch (e: any) {
      setError(e.message || "Unbekannter Fehler");
      return false;
    } finally {
      setLoading(false);
    }
  }, [checkLicense]);

  const signOut = useCallback(() => {
    setCredentials(null);
    setLicense(null);
    ls.remove(KEYS.CREDENTIALS);
  }, []);

  const refresh = useCallback(async () => {
    if (!credentials) return;
    try {
      const info = await checkLicense(credentials);
      setLicense(info);
    } catch (e: any) {
      // license invalidated server-side
      setLicense({ valid: false, tier: "basic" });
      setError(e.message);
    }
  }, [checkLicense, credentials]);

  useEffect(() => {
    if (credentials && !license) {
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plan = useMemo(() => PLANS[license?.tier ?? "basic"], [license]);

  return (
    <AuthContext.Provider value={{ credentials, license, loading, error, signIn, signOut, refresh, plan }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
