import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Download, Image as ImageIcon, Loader2 } from "lucide-react";

export type ImageSlotStatus = "pending" | "loading" | "completed" | "error";

interface ImageSlotProps {
  status: ImageSlotStatus;
  imageUrl?: string;
  progress?: number;
  index: number;
  onDownload?: () => void;
}

export const ImageSlot = ({ status, imageUrl, progress = 0, index, onDownload }: ImageSlotProps) => {
  return (
    <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-0 relative aspect-square">
        {status === "pending" && (
          <div className="w-full h-full flex items-center justify-center bg-muted/20">
            <ImageIcon className="w-12 h-12 text-muted-foreground/40" />
          </div>
        )}
        
        {status === "loading" && (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-4 bg-muted/20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <div className="w-full space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">{Math.round(progress)}%</p>
            </div>
          </div>
        )}
        
        {status === "completed" && imageUrl && (
          <div className="relative group">
            <img
              src={imageUrl}
              alt={`Generated ${index + 1}`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                onClick={onDownload}
                variant="secondary"
                size="icon"
                className="rounded-full"
              >
                <Download className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
        
        {status === "error" && (
          <div className="w-full h-full flex items-center justify-center bg-destructive/10">
            <p className="text-sm text-destructive">Error</p>
          </div>
        )}
        
        <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
          #{index + 1}
        </div>
      </CardContent>
    </Card>
  );
};
