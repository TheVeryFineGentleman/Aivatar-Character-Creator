import React from "react";
import { cn } from "@/lib/utils";
import { Film, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SceneCardV2 } from "./SceneCardV2";
import type { Scene } from "@/types/storyboard";

interface ScenesTabProps {
  scenes: Scene[];
  onOpenEditor: (index: number) => void;
  onRegenerateScene?: (index: number) => void;
  onRegenerateImage?: (index: number) => void;
  onDownloadImage?: (index: number) => void;
  onNavigateVersion?: (index: number, direction: 'prev' | 'next') => void;
  onUpdateSummary?: (index: number, summary: string) => void;
  onAddScene?: () => void;
  regeneratingIndex?: number | null;
  generatingImageIndex?: number | null;
  aspectRatio?: string;
  className?: string;
}

export const ScenesTab: React.FC<ScenesTabProps> = ({
  scenes,
  onOpenEditor,
  onRegenerateScene,
  onRegenerateImage,
  onDownloadImage,
  onNavigateVersion,
  onUpdateSummary,
  onAddScene,
  regeneratingIndex = null,
  generatingImageIndex = null,
  aspectRatio = "16:9",
  className,
}) => {
  if (scenes.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/50 rounded-xl bg-muted/10", className)}>
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Film className="w-7 h-7 text-primary/60" />
        </div>
        <h3 className="text-base font-semibold text-foreground/80 mb-1">Noch keine Szenen</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          Generiere zuerst ein Storyboard im Projekt-Tab, dann kannst du hier jede Szene im Detail bearbeiten.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Szenen</h2>
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {scenes.length}
          </span>
        </div>
        {onAddScene && (
          <Button onClick={onAddScene} size="sm" variant="outline" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Szene hinzufügen
          </Button>
        )}
      </div>

      {/* Scene Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {scenes.map((scene, index) => (
          <SceneCardV2
            key={scene.id}
            scene={scene}
            index={index}
            totalScenes={scenes.length}
            onOpenEditor={onOpenEditor}
            onRegenerateScene={onRegenerateScene}
            onRegenerateImage={onRegenerateImage}
            onDownloadImage={onDownloadImage}
            onNavigateVersion={onNavigateVersion}
            onUpdateSummary={onUpdateSummary}
            isRegenerating={regeneratingIndex === index}
            isGeneratingImage={generatingImageIndex === index}
            aspectRatio={aspectRatio}
          />
        ))}
      </div>
    </div>
  );
};
