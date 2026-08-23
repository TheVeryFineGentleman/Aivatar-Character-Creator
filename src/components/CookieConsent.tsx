/**
 * GDPR-style cookie banner — appears once until the user accepts or declines.
 * Stores the choice (`accepted` | `declined`) in localStorage.
 */
import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { KEYS, ls } from "@/lib/storage";
import { Link } from "react-router-dom";

type Consent = "accepted" | "declined";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = ls.get<Consent>(KEYS.COOKIE_CONSENT);
    if (!stored) setVisible(true);
  }, []);

  if (!visible) return null;

  const decide = (c: Consent) => {
    ls.set(KEYS.COOKIE_CONSENT, c);
    setVisible(false);
  };

  return (
    <div className="fixed bottom-4 inset-x-4 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-md z-40 animate-slide-up">
      <div className="rounded-3xl bg-ink-900/95 backdrop-blur-xl border border-white/10 shadow-2xl p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-2xl bg-flare-500/15 border border-flare-400/25 flex items-center justify-center text-flare-300 flex-shrink-0">
            <Cookie className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold mb-0.5">Wir nutzen LocalStorage</div>
            <div className="text-xs text-ink-50/65 leading-relaxed">
              Aivatar speichert API-Keys, Login und Projekte nur in deinem Browser — keine Tracker, keine Drittanbieter-Cookies.
              Details in den{" "}
              <Link to="/legal" className="text-flare-300 hover:text-flare-200 underline">Hinweisen zum Datenschutz</Link>.
            </div>
          </div>
          <button
            onClick={() => decide("declined")}
            className="flex-shrink-0 w-7 h-7 rounded-lg hover:bg-white/5 flex items-center justify-center text-ink-50/55 hover:text-ink-50 transition-colors"
            aria-label="Banner schließen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => decide("declined")}>Nur notwendige</Button>
          <Button size="sm" onClick={() => decide("accepted")}>Verstanden</Button>
        </div>
      </div>
    </div>
  );
}
