import { AlertTriangle } from "lucide-react";

export const DisclaimerFooter = () => {
  return (
    <div className="w-full py-6 px-4 mt-8 border-t border-border/30">
      <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto flex items-center justify-center gap-2">
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span>
          Wichtig: Verwende ausschließlich Bilder, deren Nutzung dir rechtlich erlaubt ist. Für alle generierten Inhalte trägt der Nutzer selbst die volle Verantwortung.
        </span>
      </p>
    </div>
  );
};
