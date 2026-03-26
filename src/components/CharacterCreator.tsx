import React, { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Zap, MessageSquare, Download, Trash2, Image as ImageIcon, Loader2, ArrowLeft, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DownloadButton } from "@/components/DownloadButton";
import { QuickModeCreator } from "@/components/character/QuickModeCreator";
import { ChatModeCreator } from "@/components/character/ChatModeCreator";
import { CharacterLightbox } from "@/components/character/CharacterLightbox";
import { CharacterViewsGenerator } from "@/components/character/CharacterViewsGenerator";
import { PoseGridGenerator } from "@/components/character/PoseGridGenerator";

interface CharacterCreatorProps {
  apiKey: string;
  allImages: string[];
  setAllImages: React.Dispatch<React.SetStateAction<string[]>>;
  onUseAsReference?: (imageUrl: string) => void;
  refImageSourceLabel?: string;
  planCode: string;
}

const MODES = [
  { id: "quick", label: "Schnell-Modus", icon: Zap, desc: "Einfach auswählen & generieren" },
  { id: "chat", label: "KI-Chat Modus", icon: MessageSquare, desc: "Im Gespräch mit der KI erstellen" },
] as const;

type Mode = typeof MODES[number]["id"];

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ apiKey, allImages, setAllImages, onUseAsReference, refImageSourceLabel, planCode }) => {
  const [mode, setMode] = useState<Mode>("quick");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState(-1);
  const [totalGenerating, setTotalGenerating] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [characterImageCount, setCharacterImageCount] = useState([2]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isBasic = planCode !== "PREMIUM" && planCode !== "FULL";
  const maxImages = isBasic ? 2 : 10;

  const handleImagesGenerated = useCallback((newImages: string[]) => {
    setAllImages(prev => [...prev, ...newImages]);
  }, [setAllImages]);

  const handleGenerationStart = useCallback((total: number) => {
    setIsGenerating(true);
    setTotalGenerating(total);
    setGeneratingIndex(0);
  }, []);

  const handleGenerationProgress = useCallback((index: number) => {
    setGeneratingIndex(index);
  }, []);

  const handleGenerationEnd = useCallback(() => {
    setIsGenerating(false);
    setGeneratingIndex(-1);
    setTotalGenerating(0);
  }, []);

  const handleDeleteImage = (index: number) => {
    setAllImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => setAllImages([]);


  const handleDownloadAll = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || allImages.length === 0) return;
    const cols = Math.min(allImages.length, 4);
    const rows = Math.ceil(allImages.length / cols);
    const imgSize = 512, padding = 12;
    canvas.width = cols * imgSize + (cols + 1) * padding;
    canvas.height = rows * imgSize + (rows + 1) * padding;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => { const img = new window.Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });

    for (let i = 0; i < allImages.length; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = padding + col * (imgSize + padding), y = padding + row * (imgSize + padding);
      try {
        const img = await loadImage(allImages[i]);
        const radius = 16;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, y, imgSize, imgSize, radius);
        ctx.clip();
        const scale = Math.max(imgSize / img.width, imgSize / img.height);
        const sw = imgSize / scale, sh = imgSize / scale;
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, imgSize, imgSize);
        ctx.restore();
      } catch {
        ctx.fillStyle = "#2a2a3e";
        ctx.fillRect(x, y, imgSize, imgSize);
      }
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `characters-${Date.now()}.png`;
    link.click();
  }, [allImages]);

  const pendingCount = isGenerating ? Math.max(0, totalGenerating - (generatingIndex + 1)) : 0;
  const currentlyGenerating = isGenerating ? 1 : 0;
  const isRefMode = !!onUseAsReference;

  return (
    <div className="max-w-2xl mx-auto">
      {isRefMode && refImageSourceLabel && (
        <div className="mb-4 p-3 rounded-xl border border-primary/30 bg-primary/5 flex items-center gap-3 animate-fade-in">
          <ArrowLeft className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm text-primary">
            Erstelle ein Bild und klicke <strong>"Als Referenzbild"</strong>, um es im <strong>{refImageSourceLabel}</strong> zu verwenden.
          </p>
        </div>
      )}

      <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in"
        style={{ animationDelay: '150ms', animationDuration: '600ms', animationFillMode: 'both' }}>
        <CardContent className="pt-6">
          <canvas ref={canvasRef} className="hidden" />

          <div className="flex gap-2 mb-6">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200",
                  mode === m.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/30"
                )}
              >
                <m.icon className="w-4 h-4" />
                <div className="text-left">
                  <div>{m.label}</div>
                  <div className="text-xs font-normal opacity-70">{m.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Image Count Slider */}
          <div className="space-y-2 mb-6">
            <div className="flex justify-between">
              <Label className="flex items-center gap-2">
                Anzahl Bilder
                {isBasic && (
                  <span className="text-xs text-muted-foreground">(max 2 für Basic)</span>
                )}
              </Label>
              <span className="text-sm text-muted-foreground">{Math.floor(characterImageCount[0])} / {maxImages}</span>
            </div>
            <Slider
              value={characterImageCount}
              onValueChange={(value) => setCharacterImageCount([Math.min(value[0], maxImages)])}
              min={1}
              max={10}
              step={1}
              className="w-full"
              lockedStart={isBasic ? 2 : undefined}
            />
          </div>

          {mode === "quick" ? (
            <QuickModeCreator
              apiKey={apiKey}
              imageCount={Math.floor(characterImageCount[0])}
              onImagesGenerated={handleImagesGenerated}
              onGenerationStart={handleGenerationStart}
              onGenerationProgress={handleGenerationProgress}
              onGenerationEnd={handleGenerationEnd}
            />
          ) : (
            <ChatModeCreator
              apiKey={apiKey}
              imageCount={Math.floor(characterImageCount[0])}
              onImagesGenerated={handleImagesGenerated}
              onGenerationStart={handleGenerationStart}
              onGenerationProgress={handleGenerationProgress}
              onGenerationEnd={handleGenerationEnd}
            />
          )}
        </CardContent>
      </Card>

      {(allImages.length > 0 || isGenerating) && (
        <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                Generierte Bilder ({allImages.length}{isGenerating ? ` + ${currentlyGenerating + pendingCount} ausstehend` : ""})
              </h3>
              {allImages.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                    <Download className="w-3.5 h-3.5" />Alle herunterladen
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearAll}>
                    <Trash2 className="w-3.5 h-3.5" />Alle löschen
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {allImages.map((img, i) => (
                <div key={`img-${i}`} className="relative rounded-lg overflow-hidden border border-border/50 bg-muted/20 aspect-square group cursor-pointer" onClick={() => setLightboxIndex(i)}>
                  <img src={img} alt={`Charakter ${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    {isRefMode && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); onUseAsReference?.(img); }} 
                        className="px-2 py-1 rounded-md bg-primary/90 text-primary-foreground hover:bg-primary text-[10px] font-medium flex items-center gap-1"
                        title="Als Referenzbild verwenden"
                      >
                        <Check className="w-3 h-3" />
                        Als Referenzbild
                      </button>
                    )}
                    <div className="flex gap-1">
                      <div onClick={(e) => e.stopPropagation()}>
                        <DownloadButton
                          imageUrl={img}
                          fileName={`character-${i + 1}-${Date.now()}.png`}
                          variant="gallery"
                          isBasicPlan={isBasic}
                          className="p-1.5 h-auto w-auto rounded-md bg-black/60 text-white hover:bg-black/80"
                        />
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteImage(i); }} className="p-1.5 rounded-md bg-black/60 text-white hover:bg-destructive/80">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {currentlyGenerating > 0 && (
                <div className="relative rounded-lg overflow-hidden border border-primary/30 bg-primary/5 aspect-square flex flex-col items-center justify-center gap-1">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-[10px] text-primary font-medium">Generiere...</span>
                </div>
              )}
              {Array.from({ length: pendingCount }).map((_, i) => (
                <div key={`pending-${i}`} className="relative rounded-lg overflow-hidden border border-border/30 bg-muted/10 aspect-square flex items-center justify-center">
                  <span className="text-[10px] text-muted-foreground">Wartend</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6 Views Generator */}
      {allImages.length > 0 && (
        <CharacterViewsGenerator allImages={allImages} apiKey={apiKey} />
      )}

      {/* Pose Grid Generator */}
      {allImages.length > 0 && (
        <PoseGridGenerator allImages={allImages} apiKey={apiKey} />
      )}

      {lightboxIndex !== null && allImages[lightboxIndex] && (
        <CharacterLightbox
          images={allImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

    </div>
  );
};