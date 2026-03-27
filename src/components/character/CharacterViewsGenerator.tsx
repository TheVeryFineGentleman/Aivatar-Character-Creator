import React, { useState, useCallback, useRef } from "react";
import { CharacterLightbox } from "@/components/character/CharacterLightbox";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Trash2, ScanLine, Sparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface CharacterViewsGeneratorProps {
  allImages: string[];
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

const STYLE_OPTIONS = [
  { id: "realistic", label: "Realistisch" },
  { id: "anime", label: "Anime" },
  { id: "comic", label: "Comic" },
  { id: "pixar", label: "Pixar / 3D" },
];

export const CharacterViewsGenerator: React.FC<CharacterViewsGeneratorProps> = ({ allImages, apiKey }) => {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [style, setStyle] = useState("realistic");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [results, setResults] = useState<(string | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleGenerate = useCallback(async () => {
    if (selectedImage === null) return;
    setIsGenerating(true);
    setError(null);
    setResults([]);

    const referenceImage = allImages[selectedImage];
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
              style,
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

      setResults([...newResults]);

      if (i < ANGLES.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setIsGenerating(false);
  }, [selectedImage, allImages, aspectRatio, style, apiKey]);

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

  if (allImages.length === 0) return null;

  return (
    <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="pt-6">
        <canvas ref={canvasRef} className="hidden" />

        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <ScanLine className="w-4 h-4 text-primary" />
          6 Ansichten Generator
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

        {/* Format selection */}
        <div className="space-y-1.5 mb-4">
          <Label className="text-xs">Format</Label>
          <Select value={aspectRatio} onValueChange={setAspectRatio}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map(ar => (
                <SelectItem key={ar.id} value={ar.id}>{ar.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Style selection */}
        <div className="space-y-1.5 mb-4">
          <Label className="text-xs">Stil</Label>
          <div className="grid grid-cols-4 gap-2">
            {STYLE_OPTIONS.map(opt => (
              <button key={opt.id} onClick={() => setStyle(opt.id)}
                className={cn("px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200",
                  style === opt.id ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/30"
                )}>{opt.label}</button>
            ))}
          </div>
        </div>

        {/* Generate button */}
        <Button onClick={handleGenerate} disabled={selectedImage === null || isGenerating || !apiKey} className="w-full mb-4">
          {isGenerating ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" />Ansicht {currentAngle + 1} von {ANGLES.length}...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />6 Ansichten generieren</>
          )}
        </Button>

        {/* Progress */}
        {isGenerating && (
          <div className="mb-4">
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Results grid */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {ANGLES.map((angle, i) => (
                <div key={angle.id} className="relative rounded-md overflow-hidden border border-border/30 bg-muted/10 aspect-square group cursor-pointer" onClick={() => results[i] && setLightboxIndex(i)}>
                  {results[i] ? (
                    <>
                      <img src={results[i]!} alt={angle.label} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs py-1 text-center font-medium">
                        {angle.label}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownloadSingle(i); }}
                        className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </>
                  ) : i < results.length ? (
                    <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground">Fehler</div>
                  ) : isGenerating && i === currentAngle ? (
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

            {!isGenerating && results.some(Boolean) && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadAll} className="flex-1">
                  <Download className="w-3.5 h-3.5 mr-1" />Alle herunterladen
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setResults([]); setError(null); }}>
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

      {lightboxIndex !== null && results[lightboxIndex] && (
        <CharacterLightbox
          images={results.filter((r): r is string => r !== null)}
          initialIndex={results.slice(0, lightboxIndex).filter(r => r !== null).length}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </Card>
  );
};
