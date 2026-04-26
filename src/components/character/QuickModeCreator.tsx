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

const NATIONALITY_OPTIONS = [
  { id: "german", label: "Deutsch 🇩🇪", prompt: "German, Northern European features, light skin, often blonde or brown hair" },
  { id: "italian", label: "Italienisch 🇮🇹", prompt: "Italian, Southern European features, olive skin, dark brown or black hair" },
  { id: "french", label: "Französisch 🇫🇷", prompt: "French, Western European features, fair to light olive skin, chestnut or dark hair" },
  { id: "spanish", label: "Spanisch 🇪🇸", prompt: "Spanish, Iberian features, olive to tan skin, dark hair and eyes" },
  { id: "british", label: "Britisch 🇬🇧", prompt: "British, Northern European features, fair skin, often red, blonde or brown hair" },
  { id: "japanese", label: "Japanisch 🇯🇵", prompt: "Japanese, East Asian features, fair to light skin, straight dark hair, almond-shaped eyes" },
  { id: "korean", label: "Koreanisch 🇰🇷", prompt: "Korean, East Asian features, fair skin, dark straight hair, soft facial features" },
  { id: "chinese", label: "Chinesisch 🇨🇳", prompt: "Chinese, East Asian features, medium to fair skin, dark hair, prominent cheekbones" },
  { id: "indian", label: "Indisch 🇮🇳", prompt: "Indian, South Asian features, medium brown to golden skin, dark hair, expressive dark eyes" },
  { id: "brazilian", label: "Brasilianisch 🇧🇷", prompt: "Brazilian, mixed Latin American features, warm tan to brown skin, curly or wavy dark hair" },
  { id: "mexican", label: "Mexikanisch 🇲🇽", prompt: "Mexican, Latin American features, warm tan skin, dark hair, strong facial structure" },
  { id: "nigerian", label: "Nigerianisch 🇳🇬", prompt: "Nigerian, West African features, deep rich dark skin, dark hair, strong broad facial features" },
  { id: "egyptian", label: "Ägyptisch 🇪🇬", prompt: "Egyptian, North African features, olive to medium brown skin, dark hair and eyes, prominent nose" },
  { id: "russian", label: "Russisch 🇷🇺", prompt: "Russian, Eastern European features, very fair to light skin, often blonde or light brown hair, blue or grey eyes" },
  { id: "american", label: "Amerikanisch 🇺🇸", prompt: "American, mixed diverse features, varied skin tones and hair colors reflecting the melting pot" },
  { id: "turkish", label: "Türkisch 🇹🇷", prompt: "Turkish, Anatolian features, olive to medium skin, dark hair, strong eyebrows, expressive eyes" },
  { id: "swedish", label: "Schwedisch 🇸🇪", prompt: "Swedish, Scandinavian features, very fair skin, blonde to light brown hair, blue or green eyes" },
  { id: "greek", label: "Griechisch 🇬🇷", prompt: "Greek, Mediterranean features, olive skin, dark wavy hair, strong nose and jaw" },
  { id: "polish", label: "Polnisch 🇵🇱", prompt: "Polish, Eastern European features, fair skin, light brown to dark blonde hair, blue or green eyes" },
  { id: "random", label: "Zufällig 🎲", prompt: "" },
];

const STYLE_OPTIONS = [
  { id: "realistic", label: "Realistisch" },
  { id: "anime", label: "Anime" },
  { id: "comic", label: "Comic" },
  { id: "pixar", label: "Pixar / 3D" },
];

const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1 (Quadrat)" },
  { id: "3:4", label: "3:4 (Portrait)" },
  { id: "9:16", label: "9:16 (Hochformat)" },
  { id: "16:9", label: "16:9 (Querformat)" },
];

const STYLE_PROMPT_MAP: Record<string, string> = {
  realistic: "photorealistic, natural lighting, detailed skin texture, 85mm f/1.4 lens, professional photography",
  anime: "anime style, cel-shaded, vibrant colors, Japanese animation aesthetic",
  comic: "comic book style, bold outlines, dynamic composition",
  pixar: "3D rendered, Pixar-quality, stylized, volumetric lighting",
};

export const QuickModeCreator: React.FC<QuickModeCreatorProps> = ({ apiKey, imageCount, onImagesGenerated, onGenerationStart, onGenerationProgress, onGenerationEnd }) => {
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [nationality, setNationality] = useState("");
  const [style, setStyle] = useState("realistic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingIndex, setGeneratingIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = apiKey && gender && age && nationality && style;

  const buildPrompt = (index: number) => {
    const genderLabel = GENDER_OPTIONS.find(g => g.id === gender)?.label || gender;
    const ageLabel = AGE_OPTIONS.find(a => a.id === age)?.label || age;
    const stylePrompt = STYLE_PROMPT_MAP[style] || "detailed illustration";

    const nationalityOption = NATIONALITY_OPTIONS.find(n => n.id === nationality);
    let nationalityPrompt = nationalityOption?.prompt || "";

    // If "random", pick a random nationality (excluding the "random" entry itself)
    if (nationality === "random") {
      const pool = NATIONALITY_OPTIONS.filter(n => n.id !== "random");
      nationalityPrompt = pool[(index * 7 + 3) % pool.length].prompt;
    }

    const hairStyles = ["short straight hair", "long wavy hair", "curly hair", "buzz cut", "shoulder-length layered hair", "braided hair", "slicked back hair", "messy textured hair", "pixie cut", "long dreadlocks"];
    const bodyTypes = ["slim and lean", "athletic and muscular", "average build", "stocky and broad", "tall and slender", "petite and compact", "curvy", "strong and sturdy"];
    const facialFeatures = ["sharp angular jawline with high cheekbones", "round soft face with full cheeks", "oval face with prominent nose", "square jaw with deep-set eyes", "heart-shaped face with wide forehead", "diamond-shaped face with narrow chin", "long face with strong brow ridge", "delicate features with small nose"];

    const hair = hairStyles[(index * 3 + 1) % hairStyles.length];
    const body = bodyTypes[(index * 5 + 2) % bodyTypes.length];
    const face = facialFeatures[(index * 4 + 1) % facialFeatures.length];

    let prompt = `Create a single portrait of exactly one ${genderLabel.toLowerCase()} character, ${ageLabel.toLowerCase()}.`;
    prompt += ` NATIONALITY: ${nationalityOption?.label.replace(/\s[\u{1F1E0}-\u{1F1FF}]{2}/u, "") || ""} — ${nationalityPrompt}.`;
    prompt += ` UNIQUE TRAITS: ${hair}, ${body} body type, ${face}.`;
    prompt += ` Style: ${stylePrompt}. Professional character design, soft even studio lighting.`;
    prompt += ` MANDATORY BACKGROUND: Pure white seamless studio background (#FFFFFF). No gradients, no textures, no patterns, no environment, no props — ONLY a clean solid white background behind the character.`;
    prompt += ` CRITICAL: This character must look COMPLETELY DIFFERENT from any other generated character. Only vary the character's appearance (face, body, hair, skin) — the background must ALWAYS remain pure white. Show only ONE person. No collage, no grid.`;
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
    onGenerationStart?.(imageCount);

    try {
      for (let i = 0; i < imageCount; i++) {
        setGeneratingIndex(i);
        onGenerationProgress?.(i);
        try {
          const img = await generateSingleImage(i);
          if (img) onImagesGenerated([img]);
        } catch (err: any) {
          if (err.message === "rate_limit") {
            await new Promise(r => setTimeout(r, 5000));
            i--;
            continue;
          }
        }
        if (i < imageCount - 1) await new Promise(r => setTimeout(r, 2000));
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
    setGender(""); setAge(""); setNationality(""); setStyle("realistic"); setError(null);
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
        <Label>Nationalität *</Label>
        <Select value={nationality} onValueChange={setNationality}>
          <SelectTrigger><SelectValue placeholder="Wählen..." /></SelectTrigger>
          <SelectContent>
            {NATIONALITY_OPTIONS.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
        <div className="space-y-2">
          <Label>Format *</Label>
          <Select value={aspectRatio} onValueChange={setAspectRatio}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ASPECT_RATIOS.map(ar => <SelectItem key={ar.id} value={ar.id}>{ar.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleGenerate} disabled={!canGenerate || isGenerating} className="flex-1">
          {isGenerating ? (<><Loader2 className="w-4 h-4 animate-spin" />Bild {generatingIndex + 1} von {imageCount}...</>) : (<><Sparkles className="w-4 h-4" />{imageCount} Charaktere generieren</>)}
        </Button>
        <Button variant="outline" onClick={handleReset} size="icon"><RotateCcw className="w-4 h-4" /></Button>
      </div>

      {error && <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">{error}</div>}
      {!apiKey && <p className="text-sm text-amber-500">⚠️ Bitte gib zuerst deinen Gemini API Key in den Einstellungen ein.</p>}
    </div>
  );
};
