import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Cookie, ChevronDown, ChevronUp, Shield, Settings2 } from "lucide-react";

const CONSENT_KEY = "cookie_consent";
const OPTIONAL_LOCAL_STORAGE_KEYS = [
  "reference_images",
  "storyReferenceImages",
  "storyReferenceLabels",
  "storyReferenceDescriptions",
];

const deleteCookieByName = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
};

export const getCookieConsent = (): string | null => {
  try {
    return sessionStorage.getItem(CONSENT_KEY) || localStorage.getItem(CONSENT_KEY);
  } catch (error) {
    console.warn("Cookie consent read failed:", error);
    return null;
  }
};

export const isCookiesAccepted = (): boolean => {
  return getCookieConsent() === "accepted";
};

export const CookieConsent: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const consent = getCookieConsent();
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "accepted");
    } catch (error) {
      console.warn("Cookie consent write failed:", error);
    }
    setVisible(false);
  };

  const handleNecessaryOnly = () => {
    try {
      sessionStorage.setItem(CONSENT_KEY, "declined");
    } catch (error) {
      console.warn("Session consent write failed:", error);
    }

    try {
      for (const key of OPTIONAL_LOCAL_STORAGE_KEYS) {
        localStorage.removeItem(key);
      }
      localStorage.removeItem(CONSENT_KEY);
    } catch (error) {
      console.warn("Optional storage cleanup failed:", error);
    }

    try {
      deleteCookieByName("gemini_api_key");
    } catch (error) {
      console.warn("Optional cookie cleanup failed:", error);
    }

    setVisible(false);
  };

  if (!visible) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border/50 rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-lg w-full sm:w-[90vw] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Cookie className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Cookie-Einstellungen</h2>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          Wir verwenden Cookies und aehnliche Technologien, um die Funktionalitaet unserer Website zu gewaehrleisten und
          dein Nutzererlebnis zu verbessern. Mit "Nur notwendige" bleiben nur technisch notwendige Daten aktiv.
        </p>

        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Weniger anzeigen" : "Mehr anzeigen"}
        </button>

        {expanded && (
          <div className="space-y-3 text-sm animate-fade-in">
            <div className="rounded-lg border border-border p-3 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-medium text-foreground">Notwendige Cookies</span>
                </div>
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  immer aktiv
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Diese Cookies sind fuer die Grundfunktionen der Website erforderlich (Authentifizierung, Sicherheit,
                Session-Management).
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">Funktionale Cookies</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ermoeglichen erweiterte Funktionalitaet und Personalisierung (Spracheinstellungen, Praeferenzen).
              </p>
            </div>

            <div className="pt-1">
              <p className="text-xs text-muted-foreground">
                Datenschutzeinstellungen:{" "}
                <a
                  href="https://aivataracademy.online/datenschutz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://aivataracademy.online/datenschutz
                </a>
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={handleNecessaryOnly} className="flex-1">
            Nur notwendige
          </Button>
          <Button onClick={handleAcceptAll} className="flex-1">
            Alle akzeptieren
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
