import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Trash2, Grid3X3, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface PoseGridGeneratorProps {
  allImages: string[];
  apiKey: string;
}

const GRID_SIZES = [
  { id: "2x2", label: "2×2 (4 Posen)", count: 4 },
  { id: "3x3", label: "3×3 (9 Posen)", count: 9 },
  { id: "4x4", label: "4×4 (16 Posen)", count: 16 },
  { id: "5x5", label: "5×5 (25 Posen)", count: 25 },
];

const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1 (Quadrat)" },
  { id: "3:4", label: "3:4 (Portrait)" },
  { id: "9:16", label: "9:16 (Hochformat)" },
  { id: "16:9", label: "16:9 (Querformat)" },
];

const BG_OPTIONS = [
  { id: "white", label: "Weiß" },
  { id: "location", label: "Ort-basiert" },
];

export const PoseGridGenerator: React.FC<PoseGridGeneratorProps> = ({ allImages, apiKey }) => {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [gridSize, setGridSize] = useState("3x3");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [outfit, setOutfit] = useState("");
  const [location, setLocation] = useState("");
  const [background, setBackground] = useState("white");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPose, setCurrentPose] = useState(0);
  const [poseResults, setPoseResults] = useState<(string | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const gridConfig = GRID_SIZES.find(g => g.id === gridSize) || GRID_SIZES[1];
  const cols = parseInt(gridSize.split("x")[0]);

  const handleGenerate = useCallback(async () => {
    if (selectedImage === null) return;
    setIsGenerating(true);
    setError(null);
    setPoseResults([]);

    const referenceImage = allImages[selectedImage];
    const newResults: (string | null)[] = [];

    for (let i = 0; i < gridConfig.count; i++) {
      setCurrentPose(i);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/character-poses`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              referenceImage,
              poseIndex: i,
              outfit: outfit.trim() || undefined,
              location: location.trim() || undefined,
              background,
              apiKey,
            }),
          }
        );

        const data = await response.json();
        if (data.success && data.imageBase64) {
          newResults.push(`data:${data.mimeType || "image/png"};base64,${data.imageBase64}`);
        } else {
          newResults.push(null);
        }
      } catch {
        newResults.push(null);
      }

      setPoseResults([...newResults]);

      if (i < gridConfig.count - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setIsGenerating(false);
  }, [selectedImage, allImages, gridConfig, outfit, location, background, apiKey]);

  const handleDownloadSingle = (index: number) => {
    const img = poseResults[index];
    if (!img) return;
    const link = document.createElement("a");
    link.href = img;
    link.download = `pose-${index + 1}-${Date.now()}.png`;
    link.click();
  };

  const handleDownloadAll = useCallback(async () => {
    const canvas = canvasRef.current;
    const validImages = poseResults.filter(Boolean) as string[];
    if (!canvas || validImages.length === 0) return;

    const imgSize = 512, padding = 8;
    const rows = Math.ceil(gridConfig.count / cols);
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

    for (let i = 0; i < poseResults.length; i++) {
      if (!poseResults[i]) continue;
      const col = i % cols, row = Math.floor(i / cols);
      const x = padding + col * (imgSize + padding), y = padding + row * (imgSize + padding);
      try {
        const img = await loadImage(poseResults[i]!);
        const scale = Math.max(imgSize / img.width, imgSize / img.height);
        const sw = imgSize / scale, sh = imgSize / scale;
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, imgSize, imgSize);
      } catch { /* skip */ }
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `pose-grid-${gridSize}-${Date.now()}.png`;
    link.click();
  }, [poseResults, gridConfig, cols, gridSize]);

  const progress = isGenerating ? ((currentPose + 1) / gridConfig.count) * 100 : poseResults.length > 0 ? 100 : 0;

  if (allImages.length === 0) return null;

  return (
    <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="pt-6">
        <canvas ref={canvasRef} className="hidden" />

        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <Grid3X3 className="w-4 h-4 text-primary" />
          Posen-Grid Generator
        </h3>

        {/* Reference image selection */}
        <div className="space-y-2 mb-4">
          <Label>Referenzbild auswählen</Label>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {allImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(i)}
                className={cn(
                  "shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                  selectedImage === i ? "border-primary ring-2 ring-primary/30" : "border-border/50 hover:border-primary/30"
                )}
              >
                <img src={img} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Grid-Größe</Label>
            <Select value={gridSize} onValueChange={setGridSize}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GRID_SIZES.map(g => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Hintergrund</Label>
            <Select value={background} onValueChange={setBackground}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BG_OPTIONS.map(b => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Outfit (optional)</Label>
            <Input value={outfit} onChange={e => setOutfit(e.target.value)} placeholder="z.B. Business Anzug" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ort (optional)</Label>
            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="z.B. Büro, Park" className="h-9 text-sm" disabled={background !== "location"} />
          </div>
        </div>

        {/* Generate button */}
        <Button onClick={handleGenerate} disabled={selectedImage === null || isGenerating || !apiKey} className="w-full mb-4">
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Pose {currentPose + 1} von {gridConfig.count}...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />{gridConfig.count} Posen generieren</>
          )}
        </Button>

        {/* Progress */}
        {isGenerating && (
          <div className="mb-4">
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Results grid */}
        {poseResults.length > 0 && (
          <div className="space-y-3">
            <div className={cn("grid gap-1.5", `grid-cols-${cols}`)} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              {Array.from({ length: gridConfig.count }).map((_, i) => (
                <div key={i} className="relative rounded-md overflow-hidden border border-border/30 bg-muted/10 aspect-square group">
                  {poseResults[i] ? (
                    <>
                      <img src={poseResults[i]!} alt={`Pose ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleDownloadSingle(i)}
                        className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </>
                  ) : i < poseResults.length ? (
                    <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">Fehler</div>
                  ) : isGenerating && i === currentPose ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">
                      {isGenerating ? "Wartend" : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {!isGenerating && poseResults.some(Boolean) && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadAll} className="flex-1">
                  <Download className="w-3.5 h-3.5 mr-1" />Alle herunterladen
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setPoseResults([]); setError(null); }}>
                  <Trash2 className="w-3.5 h-3.5 mr-1" />Zurücksetzen
                </Button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm mt-3">{error}</div>
        )}
      </CardContent>
    </Card>
  );
};
