import React, { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, MessageSquare, Download, Trash2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickModeCreator } from "@/components/character/QuickModeCreator";
import { ChatModeCreator } from "@/components/character/ChatModeCreator";

interface CharacterCreatorProps {
  apiKey: string;
  allImages: string[];
  setAllImages: React.Dispatch<React.SetStateAction<string[]>>;
}

const MODES = [
  { id: "quick", label: "Schnell-Modus", icon: Zap, desc: "Einfach auswählen & generieren" },
  { id: "chat", label: "KI-Chat Modus", icon: MessageSquare, desc: "Im Gespräch mit der KI erstellen" },
] as const;

type Mode = typeof MODES[number]["id"];

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ apiKey, allImages, setAllImages }) => {
  const [mode, setMode] = useState<Mode>("quick");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImagesGenerated = useCallback((newImages: string[]) => {
    setAllImages(prev => [...prev, ...newImages]);
  }, [setAllImages]);

  const handleDeleteImage = (index: number) => {
    setAllImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearAll = () => setAllImages([]);

  const handleDownloadSingle = (index: number) => {
    const img = allImages[index];
    if (!img) return;
    const link = document.createElement("a");
    link.href = img;
    link.download = `character-${index + 1}-${Date.now()}.png`;
    link.click();
  };

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

  return (
    <>
      <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in"
        style={{ animationDelay: '150ms', animationDuration: '600ms', animationFillMode: 'both' }}>
        <CardContent className="pt-6">
          <canvas ref={canvasRef} className="hidden" />

          {/* Mode Switcher */}
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

          {mode === "quick" ? (
            <QuickModeCreator apiKey={apiKey} onImagesGenerated={handleImagesGenerated} />
          ) : (
            <ChatModeCreator apiKey={apiKey} onImagesGenerated={handleImagesGenerated} />
          )}
        </CardContent>
      </Card>

      {/* Separate Image Gallery Card */}
      {allImages.length > 0 && (
        <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-primary" />
                Generierte Bilder ({allImages.length})
              </h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                  <Download className="w-3.5 h-3.5" />Alle herunterladen
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearAll}>
                  <Trash2 className="w-3.5 h-3.5" />Alle löschen
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {allImages.map((img, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden border border-border/50 bg-muted/20 aspect-square group">
                  <img src={img} alt={`Charakter ${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                    <button onClick={() => handleDownloadSingle(i)} className="p-1.5 rounded-md bg-black/60 text-white hover:bg-black/80">
                      <Download className="w-3 h-3" />
                    </button>
                    <button onClick={() => handleDeleteImage(i)} className="p-1.5 rounded-md bg-black/60 text-white hover:bg-destructive/80">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};
