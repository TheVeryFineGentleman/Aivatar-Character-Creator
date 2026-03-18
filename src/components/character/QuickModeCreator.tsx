import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Download, RotateCcw, User, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickModeCreatorProps {
  apiKey: string;
}

const GENDER_OPTIONS = [
  { id: "male", label: "Männlich" },
  { id: "female", label: "Weiblich" },
  { id: "nonbinary", label: "Divers" },
];

const AGE_OPTIONS = [
  { id: "child", label: "Kind (6-12)" },
  { id: "teen", label: "Teenager (13-19)" },
  { id: "young-adult", label: "Jung (20-30)" },
  { id: "adult", label: "Erwachsen (30-50)" },
  { id: "senior", label: "Senior (50+)" },
];

const STYLE_OPTIONS = [
  { id: "realistic", label: "Realistisch" },
  { id: "anime", label: "Anime" },
  { id: "comic", label: "Comic" },
  { id: "pixar", label: "Pixar / 3D" },
];

const STYLE_PROMPT_MAP: Record<string, string> = {
  realistic: "photorealistic, natural lighting, detailed skin texture, 85mm f/1.4 lens, professional photography",
  anime: "anime style, cel-shaded, vibrant colors, Japanese animation aesthetic",
  comic: "comic book style, bold outlines, dynamic composition",
  pixar: "3D rendered, Pixar-quality, stylized, volumetric lighting",
};

const COLLAGE_LABELS = ["Charakter 1", "Charakter 2", "Charakter 3", "Charakter 4"];

export const QuickModeCreator: React.FC<QuickModeCreatorProps> = ({ apiKey }) => {
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [style, setStyle] = useState("realistic");
  const [collageImages, setCollageImages] = useState<(string | null)[]>([null, null, null, null]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const canGenerate = apiKey && gender && age && style;

  const buildPrompt = (index: number) => {
    const genderLabel = GENDER_OPTIONS.find(g => g.id === gender)?.label || gender;
    const ageLabel = AGE_OPTIONS.find(a => a.id === age)?.label || age;
    const stylePrompt = STYLE_PROMPT_MAP[style] || "detailed illustration";

    const uniqueVariations = [
      "unique character design, distinctive features, memorable look",
      "completely different unique character, distinct facial features and body type",
      "another entirely unique character, different ethnicity and build",
      "yet another completely unique character, contrasting appearance from all others",
    ];

    let prompt = `Create a single image of exactly one ${genderLabel.toLowerCase()} character, ${ageLabel.toLowerCase()}. ${uniqueVariations[index]}.`;
    prompt += ` Style: ${stylePrompt}. High quality, detailed, professional character design, white seamless background, soft even lighting.`;
    prompt += ` IMPORTANT: Show only ONE single character. Do NOT show multiple people. Do NOT create a collage or grid. This character must be COMPLETELY UNIQUE.`;
    return prompt;
  };

  const generateSingleImage = async (index: number): Promise<string | null> => {
    const prompt = buildPrompt(index);
    const model = "gemini-3.1-flash-image-preview";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) throw new Error("rate_limit");
      if (response.status === 403) throw new Error("API-Key ungültig oder gesperrt.");
      throw new Error(`API Fehler: ${response.status}`);
    }

    const data = await response.json();
    const candidates = data?.candidates ?? [];
    if (candidates[0]?.finishReason === "IMAGE_OTHER" || candidates[0]?.finishReason === "SAFETY") return null;

    const imgParts = candidates[0]?.content?.parts ?? [];
    const imagePart = imgParts.find((p: any) => p.inlineData?.data && p.inlineData.mimeType?.startsWith("image/"));
    if (imagePart?.inlineData) {
      return `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`;
    }
    return null;
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setError(null);
    setCollageImages([null, null, null, null]);

    try {
      for (let i = 0; i < 4; i++) {
        setGeneratingIndex(i);
        try {
          const img = await generateSingleImage(i);
          if (img) {
            setCollageImages(prev => { const next = [...prev]; next[i] = img; return next; });
          }
        } catch (err: any) {
          if (err.message === "rate_limit") {
            await new Promise(r => setTimeout(r, 5000));
            i--;
            continue;
          }
        }
        if (i < 3) await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err: any) {
      setError(err.message || "Ein Fehler ist aufgetreten");
    } finally {
      setIsGenerating(false);
      setGeneratingIndex(-1);
    }
  };

  const handleDownloadCollage = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imgSize = 512, padding = 12, cols = 2, rows = 2;
    canvas.width = cols * imgSize + (cols + 1) * padding;
    canvas.height = rows * imgSize + (rows + 1) * padding;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => { const img = new window.Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });

    for (let i = 0; i < 4; i++) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = padding + col * (imgSize + padding), y = padding + row * (imgSize + padding);
      if (collageImages[i]) {
        try {
          const img = await loadImage(collageImages[i]!);
          const radius = 16;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x, y, imgSize, imgSize, radius);
          ctx.clip();
          const scale = Math.max(imgSize / img.width, imgSize / img.height);
          const sw = imgSize / scale, sh = imgSize / scale;
          ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, imgSize, imgSize);
          ctx.restore();
        } catch { ctx.fillStyle = "#2a2a3e"; ctx.fillRect(x, y, imgSize, imgSize); }
      } else {
        ctx.fillStyle = "#2a2a3e"; ctx.fillRect(x, y, imgSize, imgSize);
      }
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y + imgSize - 36, imgSize, 36);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(COLLAGE_LABELS[i], x + imgSize / 2, y + imgSize - 12);
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `character-collage-${Date.now()}.png`;
    link.click();
  }, [collageImages]);

  const handleDownloadSingle = (index: number) => {
    const img = collageImages[index];
    if (!img) return;
    const link = document.createElement("a");
    link.href = img;
    link.download = `character-${index + 1}-${Date.now()}.png`;
    link.click();
  };

  const handleReset = () => {
    setGender(""); setAge(""); setStyle("realistic");
    setCollageImages([null, null, null, null]); setError(null);
  };

  const hasAnyImage = collageImages.some(img => img !== null);

  return (
    <>
      <canvas ref={canvasRef} className="hidden" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Geschlecht *</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Alter *</Label>
              <Select value={age} onValueChange={setAge}>
                <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                <SelectContent>
                  {AGE_OPTIONS.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Stil *</Label>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setStyle(opt.id)}
                  className={cn("px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200",
                    style === opt.id ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/30"
                  )}>{opt.label}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleGenerate} disabled={!canGenerate || isGenerating} className="flex-1">
              {isGenerating ? (<><Loader2 className="w-4 h-4 animate-spin" />Bild {generatingIndex + 1} von 4...</>) : (<><Sparkles className="w-4 h-4" />Collage generieren</>)}
            </Button>
            <Button variant="outline" onClick={handleReset} size="icon"><RotateCcw className="w-4 h-4" /></Button>
          </div>

          {!apiKey && <p className="text-sm text-amber-500">⚠️ Bitte gib zuerst deinen Gemini API Key in den Einstellungen ein.</p>}
        </div>

        {/* Collage Result */}
        <div className="flex flex-col">
          {error && <div className="w-full p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-4">{error}</div>}
          {hasAnyImage || isGenerating ? (
            <div className="space-y-4 w-full">
              <div className="grid grid-cols-2 gap-3">
                {COLLAGE_LABELS.map((label, i) => (
                  <div key={i} className="relative rounded-xl overflow-hidden border border-border/50 bg-muted/20 aspect-square group">
                    {collageImages[i] ? (
                      <>
                        <img src={collageImages[i]!} alt={label} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                          <p className="text-xs text-white font-medium text-center">{label}</p>
                        </div>
                        <button onClick={() => handleDownloadSingle(i)} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        {isGenerating && generatingIndex === i ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : <ImageIcon className="w-8 h-8 text-muted-foreground/30" />}
                        <p className="text-xs mt-2">{label}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {hasAnyImage && !isGenerating && (
                <div className="flex gap-3">
                  <Button onClick={handleDownloadCollage} variant="outline" className="flex-1"><Download className="w-4 h-4" />Collage herunterladen</Button>
                  <Button onClick={handleGenerate} variant="outline" className="flex-1" disabled={isGenerating}><RotateCcw className="w-4 h-4" />Neu generieren</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-muted-foreground">
              <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center mb-4"><User className="w-12 h-12 text-muted-foreground/50" /></div>
              <p className="text-sm">Wähle Geschlecht, Alter & Stil und generiere 4 einzigartige Charaktere</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
