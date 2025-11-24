import { useState, useEffect } from "react";
import { saveToLocalStorage, getFromLocalStorage } from "@/lib/storage";

const AUTH_STORAGE_KEY = "aivatar_auth";
const TOOL_API_KEY = "1234";

interface AuthData {
  isAuthenticated: boolean;
  email: string;
  planCode: string;
  planName: string;
  status: string;
  expiresAt: string | null;
}

interface ValidationResponse {
  valid: boolean;
  email?: string;
  planCode?: string;
  planName?: string;
  status?: string;
  expiresAt?: string | null;
}

export const useAuth = () => {
  const [authData, setAuthData] = useState<AuthData>({
    isAuthenticated: false,
    email: "",
    planCode: "",
    planName: "",
    status: "",
    expiresAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const savedAuth = getFromLocalStorage(AUTH_STORAGE_KEY);
    if (savedAuth && savedAuth.isAuthenticated) {
      setAuthData(savedAuth);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, licenseKey: string): Promise<{ success: boolean; message?: string }> => {
    console.log("🔐 Login attempt started");
    console.log("📧 Email:", email);
    console.log("🔑 License Key length:", licenseKey.length);
    
    try {
      const requestBody = {
        email: email,
        licenseKey: licenseKey,
      };
      
      // Use Edge Function as proxy to avoid CORS issues
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/license-check`;
      
      console.log("📤 Sending request to edge function:", apiUrl);
      console.log("📦 Request body:", requestBody);
      
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("📥 Response status:", response.status);
      console.log("📥 Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Response not OK. Status:", response.status, "Error:", errorText);
        return { success: false, message: `Netzwerkfehler (${response.status}). Bitte versuchen Sie es erneut.` };
      }

      const data: ValidationResponse = await response.json();
      console.log("📋 Response data:", data);

      if (data.valid) {
        console.log("✅ Login successful!");
        const newAuthData: AuthData = {
          isAuthenticated: true,
          email: data.email || email,
          planCode: data.planCode || "",
          planName: data.planName || "",
          status: data.status || "",
          expiresAt: data.expiresAt || null,
        };
        
        setAuthData(newAuthData);
        saveToLocalStorage(AUTH_STORAGE_KEY, newAuthData);
        
        return { success: true };
      } else {
        console.log("❌ Invalid credentials");
        return { success: false, message: "Ungültige E-Mail oder License Key." };
      }
    } catch (error) {
      console.error("💥 Login error caught:", error);
      console.error("Error type:", typeof error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      
      return { success: false, message: "Verbindungsfehler. Bitte versuchen Sie es später erneut." };
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
    };
    setAuthData(emptyAuth);
    saveToLocalStorage(AUTH_STORAGE_KEY, emptyAuth);
  };

  return {
    authData,
    isLoading,
    login,
    logout,
  };
};
