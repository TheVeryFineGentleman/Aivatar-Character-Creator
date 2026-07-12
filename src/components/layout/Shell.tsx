import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import { DisclaimerPopup } from "@/components/DisclaimerPopup";
import { CookieConsent } from "@/components/CookieConsent";
import { AivatarAcademyPromo } from "@/components/AivatarAcademyPromo";

const PROMO_HIDDEN_PREFIXES = ["/legal", "/admin", "/pricing"];

export function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const showAcademyPromo = !PROMO_HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));
  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="flex-1 relative">
        <div key={location.pathname} className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 animate-fade-in">
          {children}
        </div>
        {showAcademyPromo && (
          <div className="max-w-[1400px] mx-auto">
            <AivatarAcademyPromo />
          </div>
        )}
      </div>
      <Footer />
      <DisclaimerPopup />
      <CookieConsent />
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/5 mt-12 py-8 bg-ink-950/60">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-ink-50/45">
          <div className="flex items-center gap-4">
            <span>© {new Date().getFullYear()} Aivatar</span>
            <Link to="/pricing" className="hover:text-ink-50">Preise</Link>
            <Link to="/legal" className="hover:text-ink-50">Rechtliches</Link>
          </div>
          <div className="text-[10px] uppercase tracking-widest text-ink-50/35">
            Powered by Gemini · Eigene API-Keys
          </div>
        </div>
        <DisclaimerFooter />
      </div>
    </footer>
  );
}

export function PageHeader({ title, subtitle, badge, action, cta }: { title: string; subtitle?: string; badge?: ReactNode; action?: ReactNode; cta?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-slide-down">
      <div>
        <div className="flex items-center gap-2 mb-2">{badge}</div>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight grad-text">{title}</h1>
        {subtitle && <p className="text-ink-50/55 mt-2 max-w-2xl">{subtitle}</p>}
        {cta && <div className="mt-3.5">{cta}</div>}
      </div>
      {action && <div className="animate-slide-in-right">{action}</div>}
    </div>
  );
}
