import { useState, useEffect, useCallback } from "react";
import { saveToLocalStorage, getFromLocalStorage } from "@/lib/storage";

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

// Developer test accounts (hardcoded)
const DEV_ACCOUNTS: Record<string, { password: string; planCode: string; planName: string }> = {
  "1": { password: "1", planCode: "BASIC", planName: "Basic" },
  "2": { password: "2", planCode: "PREMIUM", planName: "Pro" },
  "3": { password: "3", planCode: "FULL", planName: "Full" },
};

export const useAuth = () => {
  const [authData, setAuthData] = useState<AuthData>({
    isAuthenticated: false,
    email: "",
    planCode: "",
    planName: "",
    status: "",
    expiresAt: null,
    productId: undefined,
  });
  const [isLoading, setIsLoading] = useState(true);

  const validateLicense = useCallback(async (email: string, licenseKey: string): Promise<{ success: boolean; data?: ValidationResponse; message?: string }> => {
    // Check for dev accounts first
    const devAccount = DEV_ACCOUNTS[email];
    if (devAccount && devAccount.password === licenseKey) {
      console.log("🔧 Dev account login:", email);
      return {
        success: true,
        data: {
          valid: true,
          email: email,
          planCode: devAccount.planCode,
          planName: devAccount.planName,
          status: "active",
          expiresAt: null,
          productId: "dev",
        },
      };
    }

    try {
      const requestBody = {
        email: email,
        licenseKey: licenseKey,
      };
      
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/license-check`;
      
      console.log("🔄 Validating license...");
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Validation failed. Status:", response.status, "Error:", errorText);
        return { success: false, message: `Netzwerkfehler (${response.status})` };
      }

      const data: ValidationResponse = await response.json();
      return { success: data.valid, data, message: data.valid ? undefined : "Lizenz ungültig" };
    } catch (error) {
      console.error("💥 Validation error:", error);
      return { success: false, message: "Verbindungsfehler" };
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    console.log("🔄 Checking stored credentials on refresh...");
    const savedCredentials: CredentialsData | null = getFromLocalStorage(CREDENTIALS_STORAGE_KEY);
    const savedAuth = getFromLocalStorage(AUTH_STORAGE_KEY);
    
    if (savedCredentials && savedCredentials.email && savedCredentials.licenseKey) {
      console.log("📧 Found stored credentials, validating...");
      
      const result = await validateLicense(savedCredentials.email, savedCredentials.licenseKey);
      
      if (result.success && result.data) {
        console.log("✅ License still valid, plan:", result.data.planCode);
        const newAuthData: AuthData = {
          isAuthenticated: true,
          email: result.data.email || savedCredentials.email,
          planCode: result.data.planCode || "",
          planName: result.data.planName || "",
          status: result.data.status || "",
          expiresAt: result.data.expiresAt || null,
          productId: result.data.productId,
        };
        
        // Check if plan was upgraded
        if (savedAuth && savedAuth.planCode !== newAuthData.planCode) {
          console.log("🎉 Plan upgraded from", savedAuth.planCode, "to", newAuthData.planCode);
        }
        
        setAuthData(newAuthData);
        saveToLocalStorage(AUTH_STORAGE_KEY, newAuthData);
      } else {
        console.log("❌ License no longer valid, logging out");
        // License is no longer valid, clear auth
        const emptyAuth: AuthData = {
          isAuthenticated: false,
          email: "",
          planCode: "",
          planName: "",
          status: "",
          expiresAt: null,
          productId: undefined,
        };
        setAuthData(emptyAuth);
        saveToLocalStorage(AUTH_STORAGE_KEY, emptyAuth);
        saveToLocalStorage(CREDENTIALS_STORAGE_KEY, null);
      }
    } else if (savedAuth && savedAuth.isAuthenticated) {
      // Fallback: use saved auth if no credentials stored (legacy)
      setAuthData(savedAuth);
    }
    
    setIsLoading(false);
  }, [validateLicense]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const login = async (email: string, licenseKey: string): Promise<{ success: boolean; message?: string }> => {
    console.log("🔐 Login attempt started");
    console.log("📧 Email:", email);
    console.log("🔑 License Key length:", licenseKey.length);
    
    const result = await validateLicense(email, licenseKey);

    if (result.success && result.data) {
      console.log("✅ Login successful!");
      const newAuthData: AuthData = {
        isAuthenticated: true,
        email: result.data.email || email,
        planCode: result.data.planCode || "",
        planName: result.data.planName || "",
        status: result.data.status || "",
        expiresAt: result.data.expiresAt || null,
        productId: result.data.productId,
      };
      
      // Save credentials for future validation
      const credentials: CredentialsData = {
        email: email,
        licenseKey: licenseKey,
      };
      
      setAuthData(newAuthData);
      saveToLocalStorage(AUTH_STORAGE_KEY, newAuthData);
      saveToLocalStorage(CREDENTIALS_STORAGE_KEY, credentials);
      
      return { success: true };
    } else {
      console.log("❌ Invalid credentials");
      return { success: false, message: result.message || "Ungültige E-Mail oder License Key." };
    }
  };

  const logout = () => {
    const emptyAuth: AuthData = {
      isAuthenticated: false,
      email: "",
      planCode: "",
      planName: "",
      status: "",
      expiresAt: null,
      productId: undefined,
    };
    setAuthData(emptyAuth);
    saveToLocalStorage(AUTH_STORAGE_KEY, emptyAuth);
    saveToLocalStorage(CREDENTIALS_STORAGE_KEY, null);
  };

  return {
    authData,
    isLoading,
    login,
    logout,
    refreshAuth,
  };
};
