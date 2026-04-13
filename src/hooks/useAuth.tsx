import { useState, useEffect, useCallback } from "react";
import { saveToLocalStorage, getFromLocalStorage, removeFromLocalStorage } from "@/lib/storage";
import { getFunctionHeaders, getFunctionUrl, hasBackendConfig } from "@/lib/backend";
import { getDisplayPlanName } from "@/lib/plans";

const AUTH_STORAGE_KEY = "aivatar_auth";
const CREDENTIALS_STORAGE_KEY = "aivatar_credentials";

interface AuthData {
  isAuthenticated: boolean;
  email: string;
  planCode: string;
  planName: string;
  status: string;
  expiresAt: string | null;
  productId?: string;
}

interface CredentialsData {
  email: string;
  licenseKey: string;
}

interface ValidationResponse {
  valid: boolean;
  email?: string;
  planCode?: string;
  planName?: string;
  status?: string;
  expiresAt?: string | null;
  productId?: string;
}

const DEV_ACCOUNTS: Record<string, { password: string; planCode: string; planName: string }> = {
  "1": { password: "1", planCode: "BASIC", planName: "Basic" },
  "2": { password: "2", planCode: "PREMIUM", planName: "Pro" },
  "3": { password: "3", planCode: "FULL", planName: "Premium" },
};

const EMPTY_AUTH: AuthData = {
  isAuthenticated: false,
  email: "",
  planCode: "",
  planName: "",
  status: "",
  expiresAt: null,
  productId: undefined,
};

export const useAuth = () => {
  const [authData, setAuthData] = useState<AuthData>(EMPTY_AUTH);
  const [isLoading, setIsLoading] = useState(true);

  const validateLicense = useCallback(
    async (email: string, licenseKey: string): Promise<{ success: boolean; data?: ValidationResponse; message?: string }> => {
      const devAccount = DEV_ACCOUNTS[email];
      if (devAccount && devAccount.password === licenseKey) {
        return {
          success: true,
          data: {
            valid: true,
            email,
            planCode: devAccount.planCode,
            planName: devAccount.planName,
            status: "active",
            expiresAt: null,
            productId: "dev",
          },
        };
      }

      if (!hasBackendConfig()) {
        return { success: false, message: "Backend-Konfiguration fehlt" };
      }

      try {
        const response = await fetch(getFunctionUrl("license-check"), {
          method: "POST",
          headers: getFunctionHeaders(),
          body: JSON.stringify({ email, licenseKey }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Validation failed:", response.status, errorText);
          return { success: false, message: `Netzwerkfehler (${response.status})` };
        }

        const data: ValidationResponse = await response.json();
        return { success: data.valid, data, message: data.valid ? undefined : "Lizenz ungueltig" };
      } catch (error) {
        console.error("Validation error:", error);
        return { success: false, message: "Verbindungsfehler" };
      }
    },
    []
  );

  const clearAuth = useCallback(() => {
    setAuthData(EMPTY_AUTH);
    removeFromLocalStorage(AUTH_STORAGE_KEY);
    removeFromLocalStorage(CREDENTIALS_STORAGE_KEY);
  }, []);

  const refreshAuth = useCallback(async () => {
    const savedCredentials: CredentialsData | null = getFromLocalStorage(CREDENTIALS_STORAGE_KEY);

    if (!savedCredentials?.email || !savedCredentials?.licenseKey) {
      clearAuth();
      setIsLoading(false);
      return;
    }

    const result = await validateLicense(savedCredentials.email, savedCredentials.licenseKey);

    if (result.success && result.data) {
      const newAuthData: AuthData = {
        isAuthenticated: true,
        email: result.data.email || savedCredentials.email,
        planCode: result.data.planCode || "",
        planName: getDisplayPlanName(result.data.planCode, result.data.planName),
        status: result.data.status || "",
        expiresAt: result.data.expiresAt || null,
        productId: result.data.productId,
      };
      setAuthData(newAuthData);
      saveToLocalStorage(AUTH_STORAGE_KEY, newAuthData);
    } else {
      clearAuth();
    }

    setIsLoading(false);
  }, [clearAuth, validateLicense]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = async (email: string, licenseKey: string): Promise<{ success: boolean; message?: string }> => {
    const result = await validateLicense(email, licenseKey);

    if (result.success && result.data) {
      const newAuthData: AuthData = {
        isAuthenticated: true,
        email: result.data.email || email,
        planCode: result.data.planCode || "",
        planName: getDisplayPlanName(result.data.planCode, result.data.planName),
        status: result.data.status || "",
        expiresAt: result.data.expiresAt || null,
        productId: result.data.productId,
      };

      const credentials: CredentialsData = { email, licenseKey };
      setAuthData(newAuthData);
      saveToLocalStorage(AUTH_STORAGE_KEY, newAuthData);
      saveToLocalStorage(CREDENTIALS_STORAGE_KEY, credentials);
      return { success: true };
    }

    return { success: false, message: result.message || "Ungueltige E-Mail oder License Key." };
  };

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  return {
    authData,
    isLoading,
    login,
    logout,
    refreshAuth,
  };
};
