import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Download, Image as ImageIcon, Loader2, Trash2, Lock } from "lucide-react";

export type ImageSlotStatus = "pending" | "loading" | "completed" | "error";

interface ImageSlotProps {
  status: ImageSlotStatus;
  imageUrl?: string;
  progress?: number;
  index: number;
  onDownload?: () => void;
  onImageClick?: () => void;
  onDelete?: () => void;
  retrying?: boolean;
  isWaitingForPro?: boolean;
}

export const ImageSlot = ({ status, imageUrl, progress = 0, index, onDownload, onImageClick, onDelete, retrying = false, isWaitingForPro = false }: ImageSlotProps) => {
  return (
    <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-0 relative aspect-square">
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
                <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 mt-1">
                  <p className="text-sm font-bold text-primary">
                    ⚡ Pro: 2x schneller
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    2 Bilder gleichzeitig generieren
                  </p>
                </div>
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
          </div>
        )}
        
        {status === "completed" && imageUrl && (
          <div className="relative group w-full h-full cursor-pointer" onClick={onImageClick}>
            <img
              src={imageUrl}
              alt={`Generiert ${index + 1}`}
              className="w-full h-full object-cover"
              onLoad={() => console.log(`✅ Image ${index + 1} loaded successfully`)}
              onError={(e) => {
                console.error(`❌ Image ${index + 1} failed to load`);
                console.error("Image URL:", imageUrl.substring(0, 100));
                console.error("Error:", e);
              }}
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload?.();
                }}
                variant="secondary"
                size="icon"
                className="rounded-full"
              >
                <Download className="w-5 h-5" />
              </Button>
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
          <div className="w-full h-full flex items-center justify-center bg-destructive/10">
            <p className="text-sm text-destructive">Fehler</p>
          </div>
        )}
        
        <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
          #{index + 1}
        </div>
      </CardContent>
    </Card>
  );
};
