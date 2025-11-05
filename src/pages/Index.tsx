import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Upload, Image as ImageIcon, Download } from "lucide-react";
import { ImageGallery, ImageSlotData } from "@/components/ImageGallery";
import JSZip from "jszip";
import { saveToLocalStorage, getFromLocalStorage } from "@/lib/storage";

const BACKGROUND_OPTIONS = [
  { id: "white", label: "White Background" },
  { id: "greenscreen", label: "Green Screen" },
  { id: "scenery", label: "Custom Scenery" },
];

const Index = () => {
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [selectedBackground, setSelectedBackground] = useState("white");
  const [imageCount, setImageCount] = useState([20]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [imageSlots, setImageSlots] = useState<ImageSlotData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const generationQueueRef = useRef<number[]>([]);

  // Load saved reference images on mount
  useEffect(() => {
    const savedImages = getFromLocalStorage("reference_images");
    if (savedImages && Array.isArray(savedImages)) {
      // Convert base64 back to File objects
      Promise.all(
        savedImages.map(async (imageData: { name: string; type: string; data: string }) => {
          const response = await fetch(imageData.data);
          const blob = await response.blob();
          return new File([blob], imageData.name, { type: imageData.type });
        })
      ).then((files) => {
        setReferenceImages(files);
      });
    }
  }, []);

  // Save reference images when they change
  useEffect(() => {
    if (referenceImages.length > 0) {
      Promise.all(
        referenceImages.map((file) => {
          return new Promise<{ name: string; type: string; data: string }>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                name: file.name,
                type: file.type,
                data: reader.result as string,
              });
            };
            reader.readAsDataURL(file);
          });
        })
      ).then((imageData) => {
        saveToLocalStorage("reference_images", imageData);
      });
    }
  }, [referenceImages]);

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

  const generateSingleImage = async (
    index: number,
    base64Images: string[],
    background: string,
    isFirstEight: boolean,
    angle?: string
  ): Promise<string | null> => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-character-images`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            referenceImages: base64Images,
            background,
            count: 1,
            isFirstEight,
            angle,
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();
      return data.images[0] || null;
    } catch (error) {
      console.error(`Error generating image ${index}:`, error);
      return null;
    }
  };

  const processQueue = async (
    base64Images: string[],
    background: string,
    totalCount: number
  ) => {
    const CONCURRENT_REQUESTS = 2;
    const angles = ["front", "front-right", "right", "back-right", "back", "back-left", "left", "front-left"];

    while (generationQueueRef.current.length > 0 && isGenerating) {
      const batch = generationQueueRef.current.splice(0, CONCURRENT_REQUESTS);
      
      await Promise.all(
        batch.map(async (index) => {
          // Update to loading
          setImageSlots((prev) => {
            const updated = [...prev];
            updated[index] = { status: "loading", progress: 0 };
            return updated;
          });

          // Simulate progress
          const progressInterval = setInterval(() => {
            setImageSlots((prev) => {
              const updated = [...prev];
              if (updated[index].status === "loading") {
                updated[index].progress = Math.min((updated[index].progress || 0) + 10, 90);
              }
              return updated;
            });
          }, 500);

          const isFirstEight = index < 8;
          const angle = isFirstEight ? angles[index] : undefined;
          
          const imageUrl = await generateSingleImage(
            index,
            base64Images,
            background,
            isFirstEight,
            angle
          );

          clearInterval(progressInterval);

          // Update with result
          setImageSlots((prev) => {
            const updated = [...prev];
            if (imageUrl) {
              updated[index] = { status: "completed", imageUrl, progress: 100 };
            } else {
              updated[index] = { status: "error", progress: 0 };
            }
            return updated;
          });
        })
      );
    }
  };

  const handleGenerate = async () => {
    if (referenceImages.length === 0) {
      toast({
        title: "Reference images required",
        description: "Please upload at least one reference image",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    // Initialize slots
    const slots: ImageSlotData[] = Array(imageCount[0]).fill(null).map(() => ({
      status: "pending" as const,
      progress: 0,
    }));
    setImageSlots(slots);
    
    // Fill queue
    generationQueueRef.current = Array.from({ length: imageCount[0] }, (_, i) => i);

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

      await processQueue(base64Images, selectedBackground, imageCount[0]);
      
      toast({
        title: "Success!",
        description: `Generated ${imageCount[0]} images`,
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
      generationQueueRef.current = [];
    }
  };

  const handleCustomPrompt = async () => {
    if (!customPrompt) {
      toast({
        title: "Missing information",
        description: "Please enter a prompt",
        variant: "destructive",
      });
      return;
    }

    const newIndex = imageSlots.length;
    setImageSlots((prev) => [...prev, { status: "loading", progress: 0 }]);

    try {
      const imagePromises = referenceImages.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });

      const base64Images = await Promise.all(imagePromises);

      const progressInterval = setInterval(() => {
        setImageSlots((prev) => {
          const updated = [...prev];
          if (updated[newIndex]?.status === "loading") {
            updated[newIndex].progress = Math.min((updated[newIndex].progress || 0) + 10, 90);
          }
          return updated;
        });
      }, 500);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-character-images`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            referenceImages: base64Images,
            customPrompt,
            count: 1,
          }),
        }
      );

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();
      setImageSlots((prev) => {
        const updated = [...prev];
        updated[newIndex] = { status: "completed", imageUrl: data.images[0], progress: 100 };
        return updated;
      });
      setCustomPrompt("");
      
      toast({
        title: "Success!",
        description: "Generated custom image",
      });
    } catch (error) {
      console.error("Generation error:", error);
      setImageSlots((prev) => {
        const updated = [...prev];
        updated[newIndex] = { status: "error", progress: 0 };
        return updated;
      });
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    }
  };

  const handleDownloadSingle = (index: number) => {
    const slot = imageSlots[index];
    if (slot.status === "completed" && slot.imageUrl) {
      const link = document.createElement("a");
      link.href = slot.imageUrl;
      link.download = `character-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDownloadAll = async () => {
    const completedImages = imageSlots.filter((slot) => slot.status === "completed" && slot.imageUrl);
    
    if (completedImages.length === 0) {
      toast({
        title: "No images to download",
        description: "Generate some images first",
        variant: "destructive",
      });
      return;
    }

    try {
      const zip = new JSZip();
      
      for (let i = 0; i < imageSlots.length; i++) {
        const slot = imageSlots[i];
        if (slot.status === "completed" && slot.imageUrl) {
          const response = await fetch(slot.imageUrl);
          const blob = await response.blob();
          zip.file(`character-${i + 1}.png`, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = "character-images.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Success!",
        description: `Downloaded ${completedImages.length} images`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "Failed to create ZIP file",
        variant: "destructive",
      });
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

            {/* Generate Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 h-12 text-lg"
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
              <Button
                onClick={handleDownloadAll}
                disabled={isGenerating || imageSlots.filter(s => s.status === "completed").length === 0}
                variant="secondary"
                className="h-12"
                size="lg"
              >
                <Download className="mr-2" />
                Download All
              </Button>
            </div>
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
        <ImageGallery slots={imageSlots} onDownload={handleDownloadSingle} />
      </div>
    </div>
  );
};

export default Index;
