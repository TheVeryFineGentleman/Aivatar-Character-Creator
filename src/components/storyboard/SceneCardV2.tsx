import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { SceneStatusBadge } from "./SceneStatusBadge";
import type { Scene, SceneStatus } from "@/types/storyboard";
import { 
  ChevronLeft, ChevronRight, RefreshCw, Maximize2, Download, 
  Loader2, Check, AlertCircle, Video, Image as ImageIcon 
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SceneCardV2Props {
  scene: Scene;
  index: number;
  totalScenes: number;
  onOpenEditor: (index: number) => void;
  onRegenerateScene?: (index: number) => void;
  onRegenerateImage?: (index: number) => void;
  onDownloadImage?: (index: number) => void;
  onNavigateVersion?: (index: number, direction: 'prev' | 'next') => void;
  onUpdateSummary?: (index: number, summary: string) => void;
  isRegenerating?: boolean;
  isGeneratingImage?: boolean;
  aspectRatio?: string;
  className?: string;
}

export const SceneCardV2: React.FC<SceneCardV2Props> = ({
  scene,
  index,
  totalScenes,
  onOpenEditor,
  onRegenerateScene,
  onRegenerateImage,
  onDownloadImage,
  onNavigateVersion,
  onUpdateSummary,
  isRegenerating = false,
  isGeneratingImage = false,
  aspectRatio = "16:9",
  className,
}) => {
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editValue, setEditValue] = useState(scene.summary);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditingSummary && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingSummary]);

  const handleSaveSummary = () => {
    if (editValue.trim() && onUpdateSummary) {
      onUpdateSummary(index, editValue.trim());
    }
    setIsEditingSummary(false);
  };

  const hasImage = !!scene.generatedImage;
  const hasVideo = !!scene.generatedVideo;
  const hasError = !!scene.generationError;

  return (
    <div
      className={cn(
        "group relative bg-card rounded-xl border border-border/40 overflow-hidden shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200",
        className
      )}
    >
      {/* Header: Scene number + Status + Controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/20">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground/80">
            Szene {index + 1}
          </span>
          <SceneStatusBadge status={scene.status} />
        </div>

        <div className="flex items-center gap-1">
          {/* Version navigation */}
          {scene.versions.length > 1 && (
            <div className="flex items-center bg-background/50 rounded-full px-1.5 py-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 rounded-full"
                onClick={() => onNavigateVersion?.(index, 'prev')}
                disabled={scene.currentVersion === 0}
              >
                <ChevronLeft className="w-3 h-3" />
              </Button>
              <span className="text-[10px] font-medium min-w-[28px] text-center">
                {scene.currentVersion + 1}/{scene.versions.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 rounded-full"
                onClick={() => onNavigateVersion?.(index, 'next')}
                disabled={scene.currentVersion === scene.versions.length - 1}
              >
                <ChevronRight className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* Regenerate */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary"
            onClick={() => onRegenerateScene?.(index)}
            disabled={isRegenerating}
          >
            {isRegenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </Button>

          {/* Open editor */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary"
            onClick={() => onOpenEditor(index)}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="p-3 flex flex-col gap-2">
        {/* Image/Video preview */}
        {hasImage ? (
          <div className="relative rounded-lg overflow-hidden bg-muted/10 aspect-video group/image">
            {hasVideo ? (
              <video
                src={scene.generatedVideo}
                className="w-full h-full object-cover"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={scene.generatedImage}
                alt={`Szene ${index + 1}`}
                className="w-full h-full object-cover"
              />
            )}

            {/* Format + shot labels */}
            <div className="absolute bottom-1.5 left-1.5 flex gap-1 z-10">
              <span className="bg-black/70 text-white text-[9px] font-medium px-1.5 py-0.5 rounded">
                {aspectRatio}
              </span>
              {scene.shotType && (
                <span className="bg-black/70 text-white text-[9px] font-medium px-1.5 py-0.5 rounded">
                  {scene.shotType}
                </span>
              )}
            </div>

            {/* Media indicator */}
            <div className="absolute top-1.5 right-1.5 z-10">
              {hasVideo ? (
                <span className="bg-primary/80 text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Video className="w-2.5 h-2.5" /> Video
                </span>
              ) : (
                <span className="bg-muted/80 backdrop-blur-sm text-foreground/70 text-[9px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
                  <ImageIcon className="w-2.5 h-2.5" /> Bild
                </span>
              )}
            </div>

            {/* Hover overlay with actions */}
            <div
              className="absolute inset-0 bg-black/50 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
              onClick={() => onOpenEditor(index)}
            >
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadImage?.(index);
                }}
              >
                <Download className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerateImage?.(index);
                }}
                disabled={isRegenerating}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ) : hasError ? (
          <div className="rounded-lg p-4 flex flex-col items-center justify-center gap-2 bg-destructive/10 border border-destructive/20 aspect-video">
            <AlertCircle className="w-6 h-6 text-destructive" />
            <p className="text-xs text-destructive font-medium text-center line-clamp-2">
              {scene.generationError}
            </p>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs h-7 px-3"
              onClick={() => onRegenerateImage?.(index)}
              disabled={isRegenerating}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Neu versuchen
            </Button>
          </div>
        ) : isGeneratingImage ? (
          <div className="rounded-lg flex items-center justify-center bg-muted/20 border border-border/20 aspect-video">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Generiere Bild...</span>
            </div>
          </div>
        ) : (
          <div
            className="rounded-lg flex items-center justify-center bg-muted/10 border border-dashed border-border/30 aspect-video cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors"
            onClick={() => onOpenEditor(index)}
          >
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageIcon className="w-5 h-5 opacity-50" />
              <span className="text-[10px]">Kein Bild</span>
            </div>
          </div>
        )}

        {/* Summary - inline editable */}
        <div
          className="rounded-lg p-2 bg-muted/20 border border-border/10 min-h-[40px] cursor-text hover:border-primary/20 transition-colors"
          onClick={() => {
            if (!isEditingSummary) {
              setEditValue(scene.summary);
              setIsEditingSummary(true);
            }
          }}
        >
          {isEditingSummary ? (
            <textarea
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSaveSummary}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveSummary();
                }
                if (e.key === 'Escape') {
                  setIsEditingSummary(false);
                }
              }}
              className="w-full text-xs text-foreground/80 leading-relaxed bg-transparent border-none outline-none resize-none"
              rows={2}
            />
          ) : (
            <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2">
              {scene.summary || scene.detailedDescription || "Zusammenfassung hinzufügen..."}
            </p>
          )}
        </div>

        {/* Emotion + Camera tags */}
        {(scene.emotion || scene.cameraAngle) && (
          <div className="flex flex-wrap gap-1">
            {scene.emotion && (
              <span className="text-[9px] bg-accent/30 text-accent-foreground px-1.5 py-0.5 rounded-full">
                {scene.emotion}
              </span>
            )}
            {scene.cameraAngle && (
              <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                {scene.cameraAngle}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
