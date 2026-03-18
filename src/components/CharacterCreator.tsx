import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Download, RotateCcw, User, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CharacterCreatorProps {
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
  { id: "young-adult", label: "Junger Erwachsener (20-30)" },
  { id: "adult", label: "Erwachsener (30-50)" },
  { id: "senior", label: "Senior (50+)" },
];

const STYLE_OPTIONS = [
  { id: "realistic", label: "Realistisch" },
  { id: "anime", label: "Anime" },
  { id: "comic", label: "Comic" },
  { id: "pixar", label: "Pixar / 3D" },
  { id: "fantasy", label: "Fantasy" },
  { id: "scifi", label: "Sci-Fi" },
];

const PERSONALITY_OPTIONS = [
  { id: "heroic", label: "Heldenhaft" },
  { id: "mysterious", label: "Geheimnisvoll" },
  { id: "cheerful", label: "Fröhlich" },
  { id: "dark", label: "Düster" },
  { id: "wise", label: "Weise" },
  { id: "rebellious", label: "Rebellisch" },
];

const STYLE_PROMPT_MAP: Record<string, string> = {
  realistic: "photorealistic, natural lighting, detailed skin texture",
  anime: "anime style, cel-shaded, vibrant colors, Japanese animation aesthetic",
  comic: "comic book style, bold outlines, dynamic composition",
  pixar: "3D rendered, Pixar-quality, stylized, volumetric lighting",
  fantasy: "fantasy art style, magical atmosphere, detailed armor/clothing",
  scifi: "sci-fi concept art, futuristic, neon accents, high-tech",
};

const PERSONALITY_VISUAL_MAP: Record<string, string> = {
  heroic: "confident stance, determined expression, strong posture",
  mysterious: "enigmatic expression, partially in shadow, subtle smirk",
  cheerful: "bright smile, open posture, warm and inviting expression",
  dark: "brooding expression, intense gaze, dramatic shadows",
  wise: "calm expression, thoughtful gaze, serene posture",
  rebellious: "defiant pose, edgy expression, bold attitude",
};

const COLLAGE_VARIATIONS = [
  { label: "Charakter 1", prompt: "unique character design, distinctive features, memorable look, portrait view" },
  { label: "Charakter 2", prompt: "completely different unique character, distinct facial features and body type, portrait view" },
  { label: "Charakter 3", prompt: "another entirely unique character, different ethnicity and build, portrait view" },
  { label: "Charakter 4", prompt: "yet another completely unique character, contrasting appearance from all others, portrait view" },
];

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ apiKey }) => {
  
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [style, setStyle] = useState("realistic");
  const [personality, setPersonality] = useState("");
  const [description, setDescription] = useState("");
  const [collageImages, setCollageImages] = useState<(string | null)[]>([null, null, null, null]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const canGenerate = apiKey && gender && age && style;

  const buildPrompt = (variationPrompt: string) => {
    const genderLabel = GENDER_OPTIONS.find(g => g.id === gender)?.label || gender;
    const ageLabel = AGE_OPTIONS.find(a => a.id === age)?.label || age;
    const stylePrompt = STYLE_PROMPT_MAP[style] || "detailed illustration";
    const personalityVisual = personality ? (PERSONALITY_VISUAL_MAP[personality] || "") : "";

    let prompt = `Create a single image of exactly one ${genderLabel.toLowerCase()} character, ${ageLabel.toLowerCase()}. ${variationPrompt}.`;
    
    if (description) prompt += ` ${description}`;
    if (personalityVisual) prompt += ` ${personalityVisual}.`;
    prompt += ` Style: ${stylePrompt}. High quality, detailed, professional character design, neutral background.`;
    prompt += ` IMPORTANT: Show only ONE single character. Do NOT show multiple people. Do NOT create a collage or grid. This character must be COMPLETELY UNIQUE and look NOTHING like any other character.`;

    return prompt;
  };

  const generateSingleImage = async (variationIndex: number): Promise<string | null> => {
    const variation = COLLAGE_VARIATIONS[variationIndex];
    const prompt = buildPrompt(variation.prompt);
    const model = "gemini-3.1-flash-image-preview";

    const parts: any[] = [{ text: prompt }];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Character generation API error:", response.status, errorText);
      if (response.status === 429) throw new Error("Rate limit erreicht. Bitte warte einen Moment.");
      if (response.status === 403) throw new Error("API-Key ungültig oder gesperrt.");
      throw new Error(`API Fehler: ${response.status}`);
    }

    const data = await response.json();
    const candidates = data?.candidates ?? [];

    if (candidates[0]?.finishReason === "IMAGE_OTHER" || candidates[0]?.finishReason === "SAFETY") {
      console.warn(`Image ${variationIndex} blocked: ${candidates[0]?.finishReason}`);
      return null;
    }

    const imgParts = candidates[0]?.content?.parts ?? [];
    const imagePart = imgParts.find((p: any) => p.inlineData?.data && p.inlineData.mimeType?.startsWith("image/"));

    if (imagePart?.inlineData) {
      const base64 = imagePart.inlineData.data;
      const mimeType = imagePart.inlineData.mimeType || "image/png";
      return `data:${mimeType};base64,${base64}`;
    }

    return null;
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setError(null);
    setCollageImages([null, null, null, null]);

    try {
      let referenceImage: string | null = null;

      for (let i = 0; i < COLLAGE_VARIATIONS.length; i++) {
        setGeneratingIndex(i);
        
        try {
          const img = await generateSingleImage(i, referenceImage || undefined);
          if (img) {
            // Use first successful image as reference for consistency
            if (!referenceImage) referenceImage = img;
            setCollageImages(prev => {
              const next = [...prev];
              next[i] = img;
              return next;
            });
          }
        } catch (err: any) {
          console.error(`Error generating image ${i}:`, err);
          // If rate limited, wait and continue
          if (err.message?.includes("Rate limit")) {
            await new Promise(r => setTimeout(r, 5000));
            i--; // retry
            continue;
          }
        }

        // Small delay between generations to avoid rate limiting
        if (i < COLLAGE_VARIATIONS.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      const hasAny = collageImages.some(img => img !== null);
      if (!hasAny) {
        // Check state after loop - use a ref approach
        setCollageImages(prev => {
          if (!prev.some(img => img !== null)) {
            setError("Keine Bilder konnten generiert werden. Versuche eine andere Beschreibung.");
          }
          return prev;
        });
      }
    } catch (err: any) {
      console.error("Character generation error:", err);
      setError(err.message || "Ein Fehler ist aufgetreten");
    } finally {
      setIsGenerating(false);
      setGeneratingIndex(-1);
    }
  };

  const handleDownloadCollage = useCallback(async () => {
    const validImages = collageImages.filter((img): img is string => img !== null);
    if (validImages.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const imgSize = 512;
    const padding = 12;
    const cols = 2;
    const rows = 2;
    canvas.width = cols * imgSize + (cols + 1) * padding;
    canvas.height = rows * imgSize + (rows + 1) * padding;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load and draw images
    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };

    for (let i = 0; i < 4; i++) {
      const imgSrc = collageImages[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padding + col * (imgSize + padding);
      const y = padding + row * (imgSize + padding);

      if (imgSrc) {
        try {
          const img = await loadImage(imgSrc);
          // Draw rounded rectangle clip
          const radius = 16;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + imgSize - radius, y);
          ctx.quadraticCurveTo(x + imgSize, y, x + imgSize, y + radius);
          ctx.lineTo(x + imgSize, y + imgSize - radius);
          ctx.quadraticCurveTo(x + imgSize, y + imgSize, x + imgSize - radius, y + imgSize);
          ctx.lineTo(x + radius, y + imgSize);
          ctx.quadraticCurveTo(x, y + imgSize, x, y + imgSize - radius);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.closePath();
          ctx.clip();
          
          // Cover-fit the image
          const scale = Math.max(imgSize / img.width, imgSize / img.height);
          const sw = imgSize / scale;
          const sh = imgSize / scale;
          const sx = (img.width - sw) / 2;
          const sy = (img.height - sh) / 2;
          ctx.drawImage(img, sx, sy, sw, sh, x, y, imgSize, imgSize);
          ctx.restore();
        } catch {
          ctx.fillStyle = "#2a2a3e";
          ctx.fillRect(x, y, imgSize, imgSize);
        }
      } else {
        // Empty slot
        ctx.fillStyle = "#2a2a3e";
        ctx.fillRect(x, y, imgSize, imgSize);
      }

      // Label
      const label = COLLAGE_VARIATIONS[i]?.label || "";
      if (label) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(x, y + imgSize - 36, imgSize, 36);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, x + imgSize / 2, y + imgSize - 12);
      }
    }

    // Download
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `character-collage-${Date.now()}.png`;
    link.click();
  }, [collageImages, name]);

  const handleDownloadSingle = (index: number) => {
    const img = collageImages[index];
    if (!img) return;
    const link = document.createElement("a");
    link.href = img;
    link.download = `character-${COLLAGE_VARIATIONS[index]?.label || index}-${Date.now()}.png`;
    link.click();
  };

  const handleReset = () => {
    setGender("");
    setAge("");
    setStyle("realistic");
    setPersonality("");
    setDescription("");
    setCollageImages([null, null, null, null]);
    setError(null);
  };

  const hasAnyImage = collageImages.some(img => img !== null);
  const allImagesGenerated = collageImages.every(img => img !== null);

  return (
    <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in"
      style={{ animationDelay: '150ms', animationDuration: '600ms', animationFillMode: 'both' }}>
      <CardContent className="pt-6">
        <canvas ref={canvasRef} className="hidden" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Form */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Character Fragebogen</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Geschlecht *</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Alter *</Label>
                <Select value={age} onValueChange={setAge}>
                  <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
                  <SelectContent>
                    {AGE_OPTIONS.map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Stil *</Label>
              <div className="grid grid-cols-3 gap-2">
                {STYLE_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setStyle(opt.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200",
                      style === opt.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/50 bg-muted/30 text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Persönlichkeit (optional)</Label>
              <div className="grid grid-cols-3 gap-2">
                {PERSONALITY_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setPersonality(personality === opt.id ? "" : opt.id)}
                    className={cn(
                      "px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200",
                      personality === opt.id
                        ? "border-accent bg-accent/10 text-accent-foreground"
                        : "border-border/50 bg-muted/30 text-muted-foreground hover:border-accent/30"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Visuelle Beschreibung (optional)</Label>
              <Textarea
                placeholder="Beschreibe Aussehen, Kleidung, besondere Merkmale... z.B. 'Rote Haare, grüne Augen, trägt eine Lederjacke mit Nieten'"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate || isGenerating}
                className="flex-1"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Bild {generatingIndex + 1} von {COLLAGE_VARIATIONS.length}...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Collage generieren
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleReset} size="icon">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>

            {!apiKey && (
              <p className="text-sm text-amber-500">
                ⚠️ Bitte gib zuerst deinen Gemini API Key in den Einstellungen ein.
              </p>
            )}
          </div>

          {/* Right: Collage Result */}
          <div className="flex flex-col">
            {error && (
              <div className="w-full p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-4">
                {error}
              </div>
            )}

            {hasAnyImage || isGenerating ? (
              <div className="space-y-4 w-full">
                <div className="grid grid-cols-2 gap-3">
                  {COLLAGE_VARIATIONS.map((variation, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden border border-border/50 bg-muted/20 aspect-square group">
                      {collageImages[i] ? (
                        <>
                          <img
                            src={collageImages[i]!}
                            alt={`Character - ${variation.label}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <p className="text-xs text-white font-medium text-center">{variation.label}</p>
                          </div>
                          <button
                            onClick={() => handleDownloadSingle(i)}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                          {isGenerating && generatingIndex === i ? (
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          ) : isGenerating && generatingIndex < i ? (
                            <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                          ) : (
                            <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                          )}
                          <p className="text-xs mt-2">{variation.label}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {hasAnyImage && !isGenerating && (
                  <div className="flex gap-3">
                    <Button onClick={handleDownloadCollage} variant="outline" className="flex-1">
                      <Download className="w-4 h-4" />
                      Collage herunterladen
                    </Button>
                    <Button onClick={handleGenerate} variant="outline" className="flex-1" disabled={isGenerating}>
                      <RotateCcw className="w-4 h-4" />
                      Neu generieren
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-muted-foreground">
                <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  <User className="w-12 h-12 text-muted-foreground/50" />
                </div>
                <p className="text-sm">
                  Fülle den Fragebogen aus und generiere eine Character-Collage mit 4 verschiedenen Ansichten
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
