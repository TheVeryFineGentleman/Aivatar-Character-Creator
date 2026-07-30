/**
 * „KI-Vorschlag"-Button zum Dranhängen an JEDES Eingabefeld. Nutzt den zentralen
 * useAiSuggestions-Hook (profil-konditioniert). Ersetzt den Feldwert per onApply.
 * Rendert nichts, wenn kein API-Key gesetzt ist.
 */
import { Sparkles, Loader2 } from "lucide-react";
import { useAiSuggestions } from "@/hooks/useAiSuggestions";
import { cn } from "@/lib/cn";

interface Props {
  /** Baut den Prompt (Feldzweck + aktueller Wert). Der Profil-Kontext kommt automatisch davor. */
  buildPrompt: () => string;
  onApply: (value: string) => void;
  label?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
}

export function AiSuggestButton({ buildPrompt, onApply, label = "KI-Vorschlag", title, className, disabled }: Props) {
  const { run, loading, hasGenKey } = useAiSuggestions();
  if (!hasGenKey) return null;

  return (
    <button
      type="button"
      title={title || "Von der KI vorschlagen lassen — passend zu deinem Projekt-Profil"}
      disabled={disabled || loading}
      onClick={async () => {
        const out = await run({ prompt: buildPrompt() });
        if (out) onApply(out);
      }}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium flex-none",
        "bg-flare-500/12 text-flare-300 border border-flare-400/25 hover:bg-flare-500/20 transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}
