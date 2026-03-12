import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Loader2, Trash2, Lock, Clock, X, AlertCircle, Ban, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { DownloadButton } from "@/components/DownloadButton";

export type ImageSlotStatus = "pending" | "loading" | "completed" | "error";

interface ImageSlotProps {
  status: ImageSlotStatus;
  imageUrl?: string;
  thumbnailUrl?: string;
  progress?: number;
  index: number;
  onDownload?: () => void;
  onImageClick?: () => void;
  onDelete?: () => void;
  onRemoveFromQueue?: () => void;
  onCancel?: () => void;
  onRegenerate?: () => void;
  imageVersions?: string[];
  currentVersionIndex?: number;
  onVersionChange?: (versionIndex: number) => void;
  retrying?: boolean;
  isWaitingForPro?: boolean;
  isInQueue?: boolean;
  format?: string;
  errorMessage?: string;
  isBasicPlan?: boolean;
  onLockedClick?: () => void;
}

const getAspectClass = (format: string) => {
  switch (format) {
    case "9:16": return "aspect-[9/16]";
    case "16:9": return "aspect-[16/9]";
    case "4:3": return "aspect-[4/3]";
    case "3:4": return "aspect-[3/4]";
    case "4:5": return "aspect-[4/5]";
    case "5:4": return "aspect-[5/4]";
    case "21:9": return "aspect-[21/9]";
    default: return "aspect-square"; // 1:1
  }
};

export const ImageSlot = ({ status, imageUrl, thumbnailUrl, progress = 0, index, onDownload, onImageClick, onDelete, onRemoveFromQueue, onCancel, onRegenerate, imageVersions, currentVersionIndex = 0, onVersionChange, retrying = false, isWaitingForPro = false, isInQueue = false, format = "1:1", errorMessage, isBasicPlan = false, onLockedClick }: ImageSlotProps) => {
  const totalVersions = imageVersions?.length || 0;
  const hasMultipleVersions = totalVersions > 1;
  const aspectClass = getAspectClass(format);
  
  // Track transition from loading → completed
  const [showReveal, setShowReveal] = useState(false);
  const prevStatusRef = useRef(status);
  
  useEffect(() => {
    if (prevStatusRef.current === "loading" && status === "completed") {
      setShowReveal(true);
      const timer = setTimeout(() => setShowReveal(false), 600);
      return () => clearTimeout(timer);
    }
    prevStatusRef.current = status;
  }, [status]);

  return (
    <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className={`p-0 relative ${aspectClass}`}>
        {status === "pending" && (
          <div className="w-full h-full flex items-center justify-center bg-muted/20">
            {isWaitingForPro ? (
              <div className="flex flex-col items-center justify-center gap-3 p-4 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <Lock className="w-10 h-10 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground/80">
                  Wartet...
                </p>
                <a 
                  href="https://www.digistore24.com/product/644591?voucher=avatarcreatorstudio-deal" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 mt-1 hover:bg-primary/20 hover:border-primary/50 transition-all cursor-pointer block"
                >
                  <p className="text-sm font-bold text-primary">
                    ⚡ Pro: 2x schneller
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    2 Bilder gleichzeitig generieren
                  </p>
                </a>
                {/* Remove from queue button */}
                {onRemoveFromQueue && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromQueue();
                    }}
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Entfernen
                  </Button>
                )}
              </div>
            ) : isInQueue ? (
              <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-muted/30 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-muted-foreground/60" />
                </div>
                <p className="text-xs text-muted-foreground">
                  In Warteschlange
                </p>
                {/* Remove from queue button */}
                {onRemoveFromQueue && (
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromQueue();
                    }}
                    variant="ghost"
                    size="sm"
                    className="mt-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Entfernen
                  </Button>
                )}
              </div>
            ) : (
              <ImageIcon className="w-12 h-12 text-muted-foreground/40" />
            )}
          </div>
        )}
        
        {status === "loading" && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-4 bg-muted/20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <div className="w-full space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                {retrying ? "Wiederhole..." : `${Math.round(progress)}%`}
              </p>
            </div>
            {onCancel && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Ban className="w-3 h-3 mr-1" />
                Abbrechen
              </Button>
            )}
          </div>
        )}
        
        {status === "completed" && imageUrl && (
          <div className="relative group w-full h-full cursor-pointer" onClick={onImageClick}>
            {/* Fade-up-out overlay when transitioning from loading */}
            {showReveal && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-4 bg-muted/20 animate-[fade-up-out_500ms_ease-out_forwards]">
                <Loader2 className="w-8 h-8 text-primary" />
                <div className="w-full space-y-2">
                  <Progress value={100} className="h-2" />
                  <p className="text-xs text-center text-muted-foreground">100%</p>
                </div>
              </div>
            )}
            <img
              src={thumbnailUrl || imageUrl}
              alt={`Generiert ${index + 1}`}
              className={`w-full h-full object-cover ${showReveal ? 'animate-[fade-in_500ms_ease-out_150ms_both]' : ''}`}
              style={{ imageRendering: 'auto' }}
              loading="lazy"
              decoding="async"
              sizes="(max-width: 768px) 50vw, 25vw"
              onLoad={() => console.log(`✅ Image ${index + 1} loaded successfully`)}
              onError={(e) => {
                console.error(`❌ Image ${index + 1} failed to load`);
                console.error("Image URL:", imageUrl.substring(0, 100));
                console.error("Error:", e);
              }}
            />
            {/* Version navigation overlay - bottom */}
            {hasMultipleVersions && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-background/80 backdrop-blur-sm rounded-full px-1.5 py-0.5 shadow-md">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full"
                  onClick={(e) => { e.stopPropagation(); onVersionChange?.(currentVersionIndex - 1); }}
                  disabled={currentVersionIndex === 0}
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <span className="text-[10px] font-medium min-w-[28px] text-center">
                  {currentVersionIndex + 1}/{totalVersions}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-full"
                  onClick={(e) => { e.stopPropagation(); onVersionChange?.(currentVersionIndex + 1); }}
                  disabled={currentVersionIndex === totalVersions - 1}
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <DownloadButton
                imageUrl={imageUrl}
                fileName={`character-${index + 1}.png`}
                variant="gallery"
                isBasicPlan={isBasicPlan}
                onLockedClick={onLockedClick}
              />
              {onRegenerate && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRegenerate();
                  }}
                  variant="secondary"
                  size="icon"
                  className="rounded-full"
                >
                  <RefreshCw className="w-5 h-5" />
                </Button>
              )}
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
                variant="destructive"
                size="icon"
                className="rounded-full"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
        
        {status === "error" && (
          <div className="w-full h-full absolute inset-0 flex flex-col bg-destructive/10">
            <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col items-center justify-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-destructive" />
              </div>
              <p className={`text-destructive text-center w-full leading-tight font-medium break-words overflow-wrap-anywhere ${
                (errorMessage?.length || 0) > 200 ? 'text-[8px]' :
                (errorMessage?.length || 0) > 100 ? 'text-[9px]' :
                (errorMessage?.length || 0) > 50 ? 'text-[10px]' : 'text-xs'
              }`} style={{ whiteSpace: 'normal', overflowWrap: 'break-word' }}>
                {errorMessage || "Generierung fehlgeschlagen"}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 p-1.5 shrink-0">
              {onRegenerate && (
                <Button
                  onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
                  variant="secondary"
                  size="sm"
                  className="text-[10px] h-6 px-2"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              )}
              {onDelete && (
                <Button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  variant="destructive"
                  size="sm"
                  className="text-[10px] h-6 px-2"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Löschen
                </Button>
              )}
            </div>
          </div>
        )}
        
        <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
          #{index + 1}
        </div>
      </CardContent>
    </Card>
  );
};
