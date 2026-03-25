import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const CONSENT_KEY = "cookie_consent"; // "accepted" | "declined"

export const getCookieConsent = (): string | null => {
  try {
    return sessionStorage.getItem(CONSENT_KEY) || localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
};

export const isCookiesAccepted = (): boolean => {
  return getCookieConsent() === "accepted";
};

export const CookieConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getCookieConsent();
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "accepted");
    } catch {}
    setVisible(false);
  };

  const handleDecline = () => {
    // Only store in sessionStorage so it doesn't persist
    try {
      sessionStorage.setItem(CONSENT_KEY, "declined");
    } catch {}
    // Clear all existing localStorage & cookies
    try {
      localStorage.clear();
      document.cookie.split(";").forEach((c) => {
        const name = c.split("=")[0].trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
      });
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border/50 rounded-2xl shadow-2xl max-w-md w-[90vw] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Cookie className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Cookie-Hinweis</h2>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Diese Webseite verwendet Cookies und lokalen Speicher, um deine Einstellungen (z.B. API-Key, Theme, letzte Projekte) zwischen Sitzungen zu speichern und den Service zu verbessern.
        </p>

        <p className="text-xs text-muted-foreground/70">
          Wenn du ablehnst, werden keine Daten zwischen Sitzungen gespeichert. Deine Einstellungen gehen beim Schließen des Browsers verloren.
        </p>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={handleDecline} className="flex-1">
            Ablehnen
          </Button>
          <Button onClick={handleAccept} className="flex-1">
            Akzeptieren
          </Button>
        </div>
      </div>
    </div>
  );
};
