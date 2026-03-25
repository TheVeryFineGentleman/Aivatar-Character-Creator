import React, { useState, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface CharacterViewsDialogProps {
  open: boolean;
  onClose: () => void;
  referenceImage: string;
  apiKey: string;
}

const ANGLES = [
  { id: "front", label: "Front" },
  { id: "back", label: "Rücken" },
  { id: "right", label: "Rechts" },
  { id: "left", label: "Links" },
  { id: "front-above", label: "Schräg oben (vorne)" },
  { id: "back-above", label: "Schräg oben (hinten)" },
] as const;

const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1 (Quadrat)" },
  { id: "3:4", label: "3:4 (Portrait)" },
  { id: "9:16", label: "9:16 (Hochformat)" },
  { id: "16:9", label: "16:9 (Querformat)" },
];

export const CharacterViewsDialog: React.FC<CharacterViewsDialogProps> = ({ open, onClose, referenceImage, apiKey }) => {
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [results, setResults] = useState<(string | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setResults([]);

    const newResults: (string | null)[] = [];

    for (let i = 0; i < ANGLES.length; i++) {
      setCurrentAngle(i);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/character-views`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              referenceImage,
              angle: ANGLES[i].id,
              aspectRatio,
              apiKey,
            }),
          }
        );

        const data = await response.json();
        if (data.success && data.imageBase64) {
          const src = `data:${data.mimeType || "image/png"};base64,${data.imageBase64}`;
          newResults.push(src);
        } else {
          newResults.push(null);
        }
      } catch {
        newResults.push(null);
      }

      setResults([...newResults]);

      if (i < ANGLES.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setIsGenerating(false);
  }, [referenceImage, aspectRatio, apiKey]);

  const handleDownloadSingle = (index: number) => {
    const img = results[index];
    if (!img) return;
    const link = document.createElement("a");
    link.href = img;
    link.download = `character-${ANGLES[index].id}-${Date.now()}.png`;
    link.click();
  };

  const handleDownloadAll = useCallback(async () => {
    const canvas = canvasRef.current;
    const validImages = results.filter(Boolean) as string[];
    if (!canvas || validImages.length === 0) return;

    const cols = 3, rows = 2, imgSize = 512, padding = 8;
    canvas.width = cols * imgSize + (cols + 1) * padding;
    canvas.height = rows * imgSize + (rows + 1) * padding;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    for (let i = 0; i < results.length; i++) {
      if (!results[i]) continue;
      const col = i % cols, row = Math.floor(i / cols);
      const x = padding + col * (imgSize + padding), y = padding + row * (imgSize + padding);
      try {
        const img = await loadImage(results[i]!);
        const scale = Math.max(imgSize / img.width, imgSize / img.height);
        const sw = imgSize / scale, sh = imgSize / scale;
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, imgSize, imgSize);

        // Label
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(x, y + imgSize - 28, imgSize, 28);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(ANGLES[i].label, x + imgSize / 2, y + imgSize - 9);
      } catch { /* skip */ }
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `character-views-${Date.now()}.png`;
    link.click();
  }, [results]);

  const progress = isGenerating ? ((currentAngle + 1) / ANGLES.length) * 100 : results.length > 0 ? 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📐 6 Ansichten generieren
          </DialogTitle>
        </DialogHeader>

        <canvas ref={canvasRef} className="hidden" />

        {results.length === 0 && !isGenerating && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img src={referenceImage} alt="Referenz" className="w-20 h-20 rounded-lg object-cover border border-border/50" />
              <p className="text-sm text-muted-foreground">
                Aus diesem Charakter werden 6 verschiedene Ansichten generiert.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map(ar => (
                    <SelectItem key={ar.id} value={ar.id}>{ar.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleGenerate} className="w-full" disabled={!apiKey}>
              <Sparkles className="w-4 h-4 mr-2" />
              6 Ansichten generieren
            </Button>
          </div>
        )}

        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Generiere: {ANGLES[currentAngle]?.label} ({currentAngle + 1}/{ANGLES.length})
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {ANGLES.map((angle, i) => (
                <div key={angle.id} className="relative rounded-lg overflow-hidden border border-border/50 bg-muted/10 aspect-square group">
                  {results[i] ? (
                    <>
                      <img src={results[i]!} alt={angle.label} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs py-1 text-center font-medium">
                        {angle.label}
                      </div>
                      <button
                        onClick={() => handleDownloadSingle(i)}
                        className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </>
                  ) : i <= currentAngle || !isGenerating ? (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                      {isGenerating && i === currentAngle ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      ) : (
                        "Fehlgeschlagen"
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                      Wartend
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!isGenerating && results.some(Boolean) && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadAll} className="flex-1">
                  <Download className="w-3.5 h-3.5 mr-1" />Alle herunterladen
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setResults([]); setError(null); }}>
                  Neu generieren
                </Button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>
        )}
      </DialogContent>
    </Dialog>
  );
};
