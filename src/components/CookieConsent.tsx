import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Cookie, ChevronDown, ChevronUp, Shield, Settings2 } from "lucide-react";

const CONSENT_KEY = "cookie_consent";

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
    } catch {}
    setVisible(false);
  };

  const handleNecessaryOnly = () => {
    try {
      sessionStorage.setItem(CONSENT_KEY, "declined");
    } catch {}
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
          Wir verwenden Cookies und ähnliche Technologien, um die Funktionalität unserer Website zu gewährleisten und Ihr Nutzererlebnis zu verbessern. Durch Klicken auf „Alle akzeptieren" stimmen Sie der Verwendung aller Cookies zu. Mit „Nur notwendige" werden nur technisch notwendige Cookies gesetzt.
        </p>

        {/* Expandable details */}
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
                  <Shield className="w-4 h-4 text-green-500" />
                  <span className="font-medium text-foreground">Notwendige Cookies</span>
                </div>
                <span className="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full font-medium">immer aktiv</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Diese Cookies sind für die Grundfunktionen der Website erforderlich (Authentifizierung, Sicherheit, Session-Management).
              </p>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">Funktionale Cookies</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ermöglichen erweiterte Funktionalität und Personalisierung (Spracheinstellungen, Präferenzen).
              </p>
            </div>

            <div className="pt-1">
              <p className="text-xs text-muted-foreground">
                Datenschutzeinstellungen:{" "}
                <a
                  href="https://aivatarsacademy.online/datenschutz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  https://aivatarsacademy.online/datenschutz
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
