/**
 * Slim legal footer for pages where the regular Shell footer isn't enough.
 * Renders compliance links inline.
 */
import { Link } from "react-router-dom";

export function DisclaimerFooter() {
  return (
    <div className="text-[10px] text-ink-50/45 leading-relaxed text-center space-y-1">
      <p>
        Alle generierten Inhalte stammen von künstlicher Intelligenz. Du bist verantwortlich für deren Nutzung
        und stellst sicher, dass keine Rechte Dritter verletzt werden.
      </p>
      <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <Link to="/legal" className="hover:text-flare-300">Datenschutz</Link>
        <span aria-hidden>·</span>
        <Link to="/legal" className="hover:text-flare-300">Nutzungsbedingungen</Link>
        <span aria-hidden>·</span>
        <Link to="/legal" className="hover:text-flare-300">Impressum</Link>
      </p>
    </div>
  );
}
