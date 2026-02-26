import { useState, useEffect, useCallback } from "react";
import { getFromLocalStorage } from "@/lib/storage";

const CREDENTIALS_STORAGE_KEY = "aivatar_credentials";

interface CreditsState {
  balance: number | null;
  isLoading: boolean;
  error: string | null;
}

// Dev accounts bypass credits entirely
const DEV_EMAILS = ["1", "2", "3"];

export const useCredits = (planCode: string, isAuthenticated: boolean) => {
  const [credits, setCredits] = useState<CreditsState>({
    balance: null,
    isLoading: false,
    error: null,
  });

  const isFullPlan = planCode === "FULL";

  const isDevAccount = (): boolean => {
    const savedCredentials = getFromLocalStorage(CREDENTIALS_STORAGE_KEY);
    return DEV_EMAILS.includes(savedCredentials?.email);
  };

  const fetchBalance = useCallback(async () => {
    if (!isFullPlan || !isAuthenticated) return;
    if (isDevAccount()) {
      setCredits({ balance: 999, isLoading: false, error: null });
      return;
    }

    const savedCredentials = getFromLocalStorage(CREDENTIALS_STORAGE_KEY);
    if (!savedCredentials?.email || !savedCredentials?.licenseKey) return;

    setCredits(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/credits-balance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: savedCredentials.email,
            licenseKey: savedCredentials.licenseKey,
          }),
        }
      );

      const data = await response.json();

      if (data.valid) {
        setCredits({ balance: data.balance, isLoading: false, error: null });
      } else {
        setCredits({ balance: null, isLoading: false, error: data.reason || "Credits nicht verfügbar" });
      }
    } catch (error) {
      console.error("Credits fetch error:", error);
      setCredits({ balance: null, isLoading: false, error: "Verbindungsfehler" });
    }
  }, [isFullPlan, isAuthenticated]);

  const consumeCredit = useCallback(async (amount: number = 1): Promise<{ success: boolean; newBalance?: number; error?: string }> => {
    if (!isFullPlan) return { success: true }; // Non-FULL plans don't use credits

    const savedCredentials = getFromLocalStorage(CREDENTIALS_STORAGE_KEY);
    if (!savedCredentials?.email || !savedCredentials?.licenseKey) {
      return { success: false, error: "Keine Credentials gespeichert" };
    }

    // Check balance first
    if (credits.balance !== null && credits.balance < amount) {
      return { success: false, error: "Nicht genügend Credits" };
    }

    try {
      const idempotencyKey = `consume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/credits-consume`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: savedCredentials.email,
            licenseKey: savedCredentials.licenseKey,
            amount,
            idempotencyKey,
          }),
        }
      );

      const data = await response.json();

      if (data.valid) {
        setCredits(prev => ({ ...prev, balance: data.balance }));
        return { success: true, newBalance: data.balance };
      } else {
        const errorMsg = data.reason === "INSUFFICIENT_CREDITS"
          ? "Nicht genügend Credits"
          : data.reason || "Credits-Fehler";
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      console.error("Credits consume error:", error);
      return { success: false, error: "Verbindungsfehler" };
    }
  }, [isFullPlan, credits.balance]);

  // Fetch on mount and when plan changes
  useEffect(() => {
    if (isFullPlan && isAuthenticated) {
      fetchBalance();
    }
  }, [isFullPlan, isAuthenticated, fetchBalance]);

  return {
    balance: credits.balance,
    isLoading: credits.isLoading,
    error: credits.error,
    isFullPlan,
    consumeCredit,
    refreshBalance: fetchBalance,
  };
};
