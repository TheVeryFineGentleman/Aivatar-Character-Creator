import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Download, RotateCcw, User } from "lucide-react";
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

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ apiKey }) => {
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [style, setStyle] = useState("realistic");
  const [personality, setPersonality] = useState("");
  const [description, setDescription] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = apiKey && gender && age && style;

  const buildPrompt = () => {
    const genderLabel = GENDER_OPTIONS.find(g => g.id === gender)?.label || gender;
    const ageLabel = AGE_OPTIONS.find(a => a.id === age)?.label || age;
    const stylePrompt = STYLE_PROMPT_MAP[style] || "detailed illustration";
    const personalityVisual = personality ? (PERSONALITY_VISUAL_MAP[personality] || "") : "";

    let prompt = `Create a full character portrait of a ${genderLabel.toLowerCase()} character, ${ageLabel.toLowerCase()}.`;
    if (name) prompt += ` The character's name is ${name}.`;
    if (description) prompt += ` ${description}`;
    if (personalityVisual) prompt += ` ${personalityVisual}.`;
    prompt += ` Style: ${stylePrompt}. High quality, detailed, professional character design, full body view, neutral background.`;

    return prompt;
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    setError(null);

    try {
      const prompt = buildPrompt();
      const model = "gemini-3.1-flash-image-preview";

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseModalities: ["IMAGE", "TEXT"],
            },
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
        throw new Error(`Bild blockiert (${candidates[0]?.finishReason}). Versuche eine andere Beschreibung.`);
      }

      const parts = candidates[0]?.content?.parts ?? [];
      const imagePart = parts.find((p: any) => p.inlineData?.data && p.inlineData.mimeType?.startsWith("image/"));

      if (imagePart?.inlineData) {
        const base64 = imagePart.inlineData.data;
        const mimeType = imagePart.inlineData.mimeType || "image/png";
        setGeneratedImage(`data:${mimeType};base64,${base64}`);
      } else {
        throw new Error("Kein Bild generiert. Versuche es mit einer anderen Beschreibung.");
      }
    } catch (err: any) {
      console.error("Character generation error:", err);
      setError(err.message || "Ein Fehler ist aufgetreten");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `character-${name || "unnamed"}-${Date.now()}.png`;
    link.click();
  };

  const handleReset = () => {
    setName("");
    setGender("");
    setAge("");
    setStyle("realistic");
    setPersonality("");
    setDescription("");
    setGeneratedImage(null);
    setError(null);
  };

  return (
    <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in"
      style={{ animationDelay: '150ms', animationDuration: '600ms', animationFillMode: 'both' }}>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Form */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-5 h-5 text-violet-500" />
              <h3 className="text-lg font-semibold">Character Fragebogen</h3>
            </div>

            <div className="space-y-2">
              <Label htmlFor="char-name">Name (optional)</Label>
              <Input
                id="char-name"
                placeholder="z.B. Luna, Kai, Shadow..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
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
                        ? "border-violet-500 bg-violet-500/10 text-violet-500"
                        : "border-border/50 bg-muted/30 text-muted-foreground hover:border-violet-500/30"
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
                    Generiere...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Character generieren
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

          {/* Right: Result */}
          <div className="flex flex-col items-center justify-center">
            {error && (
              <div className="w-full p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-4">
                {error}
              </div>
            )}

            {generatedImage ? (
              <div className="space-y-4 w-full">
                <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-muted/20">
                  <img
                    src={generatedImage}
                    alt={`Character: ${name || "Generiert"}`}
                    className="w-full h-auto max-h-[500px] object-contain"
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleDownload} variant="outline" className="flex-1">
                    <Download className="w-4 h-4" />
                    Herunterladen
                  </Button>
                  <Button onClick={handleGenerate} variant="outline" className="flex-1" disabled={isGenerating}>
                    <RotateCcw className="w-4 h-4" />
                    Neu generieren
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-muted-foreground">
                <div className="w-24 h-24 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                  <User className="w-12 h-12 text-muted-foreground/50" />
                </div>
                <p className="text-sm">
                  {isGenerating ? "Dein Character wird erstellt..." : "Fülle den Fragebogen aus und generiere deinen Character"}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
