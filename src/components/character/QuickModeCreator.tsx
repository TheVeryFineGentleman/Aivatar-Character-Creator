import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickModeCreatorProps {
  apiKey: string;
  imageCount: number;
  onImagesGenerated: (images: string[]) => void;
  onGenerationStart?: (total: number) => void;
  onGenerationProgress?: (index: number) => void;
  onGenerationEnd?: () => void;
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

export const QuickModeCreator: React.FC<QuickModeCreatorProps> = ({ apiKey, onImagesGenerated, onGenerationStart, onGenerationProgress, onGenerationEnd }) => {
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [style, setStyle] = useState("realistic");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

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
    onGenerationStart?.(4);

    try {
      for (let i = 0; i < 4; i++) {
        setGeneratingIndex(i);
        onGenerationProgress?.(i);
        try {
          const img = await generateSingleImage(i);
          if (img) onImagesGenerated([img]); // Emit each image immediately
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
      onGenerationEnd?.();
    }
  };

  const handleReset = () => {
    setGender(""); setAge(""); setStyle("realistic"); setError(null);
  };

  return (
    <div className="space-y-4">
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
        <div className="grid grid-cols-4 gap-2">
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
          {isGenerating ? (<><Loader2 className="w-4 h-4 animate-spin" />Bild {generatingIndex + 1} von 4...</>) : (<><Sparkles className="w-4 h-4" />4 Charaktere generieren</>)}
        </Button>
        <Button variant="outline" onClick={handleReset} size="icon"><RotateCcw className="w-4 h-4" /></Button>
      </div>

      {error && <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>}
      {!apiKey && <p className="text-sm text-amber-500">⚠️ Bitte gib zuerst deinen Gemini API Key in den Einstellungen ein.</p>}
    </div>
  );
};
