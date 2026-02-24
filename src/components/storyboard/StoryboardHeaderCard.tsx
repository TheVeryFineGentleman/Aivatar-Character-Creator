import React, { useState } from "react";
import { ChevronDown, Sparkles, Download, MoreHorizontal, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useStoryboard } from "@/contexts/StoryboardContext";
import { OverflowActionMenu, type OverflowAction } from "./OverflowActionMenu";

export const StoryboardHeaderCard: React.FC = () => {
  const { project, updateProjectField, addScene } = useStoryboard();
  const [isExpanded, setIsExpanded] = useState(false);

  const scenesCount = project.scenes.length;
  const imagesOk = project.scenes.filter(s => s.generatedImage).length;
  const videosOk = project.scenes.filter(s => s.generatedVideo).length;
  const finalCount = project.scenes.filter(s => s.status === "final").length;

  const overflowActions: OverflowAction[] = [
    { label: "Storyboard neu generieren", icon: <Sparkles className="w-3.5 h-3.5" />, onClick: () => {} },
    { label: "Veo3-Export", icon: <Download className="w-3.5 h-3.5" />, onClick: () => {} },
    { label: "Alles löschen", onClick: () => {}, destructive: true, separator: true },
  ];

  return (
    <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm">
      {/* Always visible */}
      <div className="flex items-center gap-3 px-5 py-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <input
            value={project.title}
            onChange={(e) => updateProjectField("title", e.target.value)}
            placeholder="Story-Titel eingeben..."
            className="text-lg font-bold bg-transparent border-0 outline-none w-full text-foreground placeholder:text-muted-foreground/50"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" className="gap-1.5" onClick={() => {}}>
            <Zap className="w-3.5 h-3.5" />
            Schnell generieren
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {}}>
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
          <OverflowActionMenu actions={overflowActions} />
        </div>
      </div>

      {/* Progress chips */}
      <div className="flex items-center gap-2 px-5 pb-3 flex-wrap">
        <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {scenesCount} Szenen
        </span>
        <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 text-[10px] font-medium text-primary">
          {project.format}
        </span>
        {scenesCount > 0 && (
          <>
            <span className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
              imagesOk === scenesCount && scenesCount > 0
                ? "border-blue-500/30 text-blue-400 bg-blue-500/10"
                : "border-border text-muted-foreground"
            )}>
              {imagesOk}/{scenesCount} Bilder
            </span>
            <span className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
              videosOk === scenesCount && scenesCount > 0
                ? "border-green-500/30 text-green-400 bg-green-500/10"
                : "border-border text-muted-foreground"
            )}>
              {videosOk}/{scenesCount} Videos
            </span>
          </>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} />
        </button>
      </div>

      {/* Expandable details */}
      {isExpanded && (
        <div className="px-5 pb-4 space-y-4 border-t border-border/30 pt-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Story-Zusammenfassung</label>
            <textarea
              value={project.summary}
              onChange={(e) => updateProjectField("summary", e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[80px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Fasse deine Story kurz zusammen..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Hauptort</label>
              <input
                value={project.mainLocation}
                onChange={(e) => updateProjectField("mainLocation", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="z.B. Verlassenes Fabrikgebäude"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Format</label>
              <select
                value={project.format}
                onChange={(e) => updateProjectField("format", e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="16:9">16:9 (Widescreen)</option>
                <option value="9:16">9:16 (Vertikal)</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
