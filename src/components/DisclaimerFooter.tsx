import { AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const DisclaimerFooter = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full py-6 px-4 mt-8 border-t border-border/30">
      <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto flex items-center justify-center gap-2">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>
          Wichtig: Verwende ausschließlich Bilder, deren Nutzung dir rechtlich erlaubt ist. Für alle generierten Inhalte trägt der Nutzer selbst die volle Verantwortung.
        </span>
      </p>
      <div className="flex items-center justify-center gap-3 mt-3">
        <button
          onClick={() => navigate("/rechtliches?tab=impressum")}
          className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Impressum
        </button>
        <span className="text-[10px] text-muted-foreground/40">|</span>
        <button
          onClick={() => navigate("/rechtliches?tab=agb")}
          className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          AGB
        </button>
        <span className="text-[10px] text-muted-foreground/40">|</span>
        <a
          href="https://aivataracademy.online/datenschutz"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          Datenschutz
        </a>
      </div>
    </div>
  );
};
