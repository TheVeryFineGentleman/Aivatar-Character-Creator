import React, { useState } from "react";
import { Sparkles, ChevronDown, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useStoryboard } from "@/contexts/StoryboardContext";

const STORY_SUGGESTIONS = [
  "Ein Influencer entdeckt ein magisches Café, in dem jeder Kaffee eine Erinnerung aus der Zukunft zeigt.",
  "Zwei Fremde treffen sich jeden Tag im selben Zug, ohne zu wissen, dass sie im Traum des anderen vorkommen.",
  "Ein verlorener Brief aus den 1940ern führt eine junge Fotografin zu einem Geheimnis ihrer Großmutter.",
  "Eine KI-Assistentin entwickelt plötzlich echte Gefühle und muss sich entscheiden: Wahrheit oder Löschung.",
  "Ein Straßenmusiker spielt eine Melodie, die bei jedem Zuhörer eine andere vergessene Erinnerung weckt.",
  "Nachts erwacht eine verlassene Bibliothek zum Leben – die Figuren aus den Büchern treten heraus.",
];

export const StoryIdeaGenerateCard: React.FC = () => {
  const { generateFromIdea, isGeneratingStoryboard, generationProgress } = useStoryboard();
  const [idea, setIdea] = useState("");
  const [sceneCount, setSceneCount] = useState(6);
  const [format, setFormat] = useState<"16:9" | "9:16">("16:9");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [generateDialogues, setGenerateDialogues] = useState(true);
  const [generateTransitions, setGenerateTransitions] = useState(true);
  const [genre, setGenre] = useState("");
  const [suggestions, setSuggestions] = useState(() =>
    STORY_SUGGESTIONS.sort(() => Math.random() - 0.5).slice(0, 3)
  );

  const refreshSuggestions = () => {
    setSuggestions(STORY_SUGGESTIONS.sort(() => Math.random() - 0.5).slice(0, 3));
  };

  const handleGenerate = () => {
    if (!idea.trim()) return;
    generateFromIdea({ idea, sceneCount, format, genre, generateDialogues, generateTransitions });
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">Story-Idee eingeben</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Beschreibe deine Idee oder wähle einen Vorschlag – die KI erstellt daraus ein vollständiges Storyboard.
        </p>
      </div>

      {/* Body */}
      <div className="px-5 pb-5 space-y-4">
        {/* Suggestions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Vorschläge</span>
            <button
              onClick={refreshSuggestions}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
              title="Neue Vorschläge"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-1.5">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => setIdea(s)}
                className={cn(
                  "w-full text-left rounded-lg border px-3 py-2 text-xs transition-all",
                  idea === s
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border/40 bg-muted/20 text-muted-foreground hover:border-border/60 hover:bg-muted/30"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Eigene Story-Idee
          </label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Beschreibe deine Story-Idee in ein paar Sätzen..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm resize-y min-h-[80px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            disabled={isGeneratingStoryboard}
          />
        </div>

        {/* Scene count + Format */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Szenen: {sceneCount}
            </label>
            <Slider
              value={[sceneCount]}
              onValueChange={([v]) => setSceneCount(v)}
              min={2}
              max={12}
              step={1}
              disabled={isGeneratingStoryboard}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as "16:9" | "9:16")}
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              disabled={isGeneratingStoryboard}
            >
              <option value="16:9">16:9 (Widescreen)</option>
              <option value="9:16">9:16 (Vertikal)</option>
            </select>
          </div>
        </div>

        {/* Advanced options */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showAdvanced && "rotate-180")} />
            Erweiterte Optionen
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-3 pl-1">
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateDialogues}
                  onChange={(e) => setGenerateDialogues(e.target.checked)}
                  className="rounded border-input"
                  disabled={isGeneratingStoryboard}
                />
                Dialoge automatisch erzeugen
              </label>
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateTransitions}
                  onChange={(e) => setGenerateTransitions(e.target.checked)}
                  className="rounded border-input"
                  disabled={isGeneratingStoryboard}
                />
                Übergänge automatisch erzeugen
              </label>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Genre / Stil (optional)
                </label>
                <input
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  placeholder="z.B. Film Noir, Romantische Komödie, Sci-Fi..."
                  disabled={isGeneratingStoryboard}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border/30 bg-muted/10">
        {isGeneratingStoryboard ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>
                Storyboard wird erstellt...
                {generationProgress && ` Szene ${generationProgress.current}/${generationProgress.total}`}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 animate-pulse"
                style={{
                  width: generationProgress
                    ? `${(generationProgress.current / generationProgress.total) * 100}%`
                    : "30%",
                }}
              />
            </div>
          </div>
        ) : (
          <Button onClick={handleGenerate} disabled={!idea.trim()} className="w-full gap-2">
            <Sparkles className="w-4 h-4" />
            Storyboard generieren
          </Button>
        )}
      </div>
    </div>
  );
};
