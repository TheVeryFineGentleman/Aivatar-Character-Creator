import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Upload, Image as ImageIcon } from "lucide-react";

const BACKGROUND_OPTIONS = [
  { id: "white", label: "White Background" },
  { id: "greenscreen", label: "Green Screen" },
  { id: "scenery", label: "Custom Scenery" },
];

const Index = () => {
  const [apiKey, setApiKey] = useState("");
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [selectedBackground, setSelectedBackground] = useState("white");
  const [imageCount, setImageCount] = useState([20]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (referenceImages.length + files.length > 3) {
      toast({
        title: "Too many images",
        description: "You can only upload up to 3 reference images",
        variant: "destructive",
      });
      return;
    }
    setReferenceImages([...referenceImages, ...files].slice(0, 3));
  };

  const removeImage = (index: number) => {
    setReferenceImages(referenceImages.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      toast({
        title: "API Key required",
        description: "Please enter your Google Gemini API key",
        variant: "destructive",
      });
      return;
    }

    if (referenceImages.length === 0) {
      toast({
        title: "Reference images required",
        description: "Please upload at least one reference image",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Convert images to base64
      const imagePromises = referenceImages.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });

      const base64Images = await Promise.all(imagePromises);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-character-images`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            apiKey,
            referenceImages: base64Images,
            background: selectedBackground,
            count: imageCount[0],
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate images");
      }

      const data = await response.json();
      setGeneratedImages(data.images);
      
      toast({
        title: "Success!",
        description: `Generated ${data.images.length} images`,
      });
    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomPrompt = async () => {
    if (!apiKey || !customPrompt) {
      toast({
        title: "Missing information",
        description: "Please enter both API key and prompt",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const imagePromises = referenceImages.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });

      const base64Images = await Promise.all(imagePromises);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-character-images`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            apiKey,
            referenceImages: base64Images,
            customPrompt,
            count: 1,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();
      setGeneratedImages([...generatedImages, ...data.images]);
      setCustomPrompt("");
      
      toast({
        title: "Success!",
        description: "Generated custom image",
      });
    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">AI Character Generator</span>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-accent to-primary-glow bg-clip-text text-transparent">
            Character Image Studio
          </h1>
          <p className="text-muted-foreground text-lg">
            Generate diverse character poses with AI
          </p>
        </div>

        {/* Main Controls */}
        <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6 space-y-6">
            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="api-key">Google Gemini API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Enter your API key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono"
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Reference Images (up to 3)</Label>
              <div className="flex flex-wrap gap-4">
                {referenceImages.map((file, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={`Reference ${index + 1}`}
                      className="w-24 h-24 object-cover rounded-lg border-2 border-border"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {referenceImages.length < 3 && (
                  <label className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  </label>
                )}
              </div>
            </div>

            {/* Background Selection */}
            <div className="space-y-2">
              <Label>Background Type</Label>
              <div className="grid grid-cols-3 gap-3">
                {BACKGROUND_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setSelectedBackground(option.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedBackground === option.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Count Slider */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Number of Images</Label>
                <span className="text-sm text-muted-foreground">{imageCount[0]}</span>
              </div>
              <Slider
                value={imageCount}
                onValueChange={setImageCount}
                min={1}
                max={40}
                step={1}
                className="w-full"
              />
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-12 text-lg"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin mr-2 h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2" />
                  Generate Images
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Custom Prompt Chat */}
        <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="pt-6 space-y-4">
            <Label>Custom Prompt (Optional)</Label>
            <div className="flex gap-2">
              <Textarea
                placeholder="Describe a specific pose or scene..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="flex-1"
                rows={3}
              />
              <Button
                onClick={handleCustomPrompt}
                disabled={isGenerating || !customPrompt}
                size="lg"
              >
                <ImageIcon className="w-5 h-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Generated Images Gallery */}
        {generatedImages.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Generated Images</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {generatedImages.map((image, index) => (
                <Card key={index} className="overflow-hidden border-border/50">
                  <CardContent className="p-0">
                    <img
                      src={image}
                      alt={`Generated ${index + 1}`}
                      className="w-full h-64 object-cover"
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
