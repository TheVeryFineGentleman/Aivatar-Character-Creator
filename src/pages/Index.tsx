import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Upload, Image as ImageIcon, Download } from "lucide-react";
import { ImageGallery, ImageSlotData } from "@/components/ImageGallery";
import JSZip from "jszip";
import { setCookie, getCookie, saveToLocalStorage, getFromLocalStorage } from "@/lib/storage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BACKGROUND_OPTIONS = [
  { id: "white", label: "White Background" },
  { id: "greenscreen", label: "Green Screen" },
  { id: "scenery", label: "Custom Scenery" },
];

const FORMAT_OPTIONS = [
  { id: "square", label: "Square (1:1)", ratio: "1:1" },
  { id: "portrait", label: "Portrait (9:16)", ratio: "9:16" },
  { id: "landscape", label: "Landscape (16:9)", ratio: "16:9" },
  { id: "wide", label: "Wide (21:9)", ratio: "21:9" },
];

const SHOT_OPTIONS = [
  { id: "fullbody", label: "Full Body", description: "full body shot" },
  { id: "upperbody", label: "Upper Body", description: "upper body shot from waist up" },
  { id: "closeup", label: "Close-up Face", description: "close-up face shot" },
];

const CASUAL_POSES = [
  "standing casually", "standing relaxed", "sitting casually", "leaning slightly",
  "hands in pockets", "one hand on hip", "arms crossed relaxed", "hands behind back",
  "looking to the side", "gentle wave", "slight smile", "resting pose",
  "natural standing pose", "comfortable sitting", "casual lean", "relaxed stance",
  "hands clasped", "one leg slightly bent", "weight on one leg", "natural posture"
];

const COOL_POSES = [
  "dynamic fashion pose", "confident power stance", "stylish walking pose",
  "energetic jump", "fashion runway walk", "cool leaning pose",
  "dynamic movement", "striking pose", "confident standing", "model pose",
  "stylish turn", "powerful stance", "dramatic pose", "fashion editorial pose"
];

const CLOTHING = [
  "casual t-shirt and jeans", "formal suit", "dress", "sportswear",
  "hoodie and pants", "jacket and shirt", "uniform", "traditional outfit",
  "winter coat", "summer clothes"
];

const EXPRESSIONS = [
  "happy smile", "serious", "friendly", "excited", "calm", "determined",
  "gentle", "energetic"
];

const Index = () => {
  const [apiKey, setApiKey] = useState("");
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [selectedBackground, setSelectedBackground] = useState("white");
  const [imageCount, setImageCount] = useState([20]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [imageSlots, setImageSlots] = useState<ImageSlotData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState("square");
  const [selectedShot, setSelectedShot] = useState("fullbody");
  const isGeneratingRef = useRef(false);
  const { toast } = useToast();
  const generationQueueRef = useRef<number[]>([]);

  // Load saved data on mount
  useEffect(() => {
    const savedApiKey = getCookie("gemini_api_key");
    if (savedApiKey) {
      setApiKey(savedApiKey);
    }

    const savedImages = getFromLocalStorage("reference_images");
    if (savedImages && Array.isArray(savedImages)) {
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

  // Save API key when it changes
  useEffect(() => {
    if (apiKey) {
      setCookie("gemini_api_key", apiKey, 30);
    }
  }, [apiKey]);

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
    apiKey: string,
    base64Images: string[],
    background: string,
    numberOfImages: number,
    selectedFormat: string,
    selectedShot: string,
    angle?: string,
    retryCount: number = 0
  ): Promise<string | null> => {
    const MAX_RETRIES = 3;
    
    try {
      // For first 20%: exactly 4 angles to show all sides (front, back, left, right)
      const angles = ["front view", "right side view", "back view", "left side view"];
      let prompt = "";
      
      // Get format and shot descriptions
      const formatOption = FORMAT_OPTIONS.find(f => f.id === selectedFormat);
      const shotOption = SHOT_OPTIONS.find(s => s.id === selectedShot);
      const formatText = formatOption ? `${formatOption.ratio} aspect ratio` : "1:1 aspect ratio";
      
      // First 20%: Upper body shots from all angles
      // After 20%: Full body shots with cool poses and different outfit
      const twentyPercent = Math.ceil(numberOfImages * 0.2);
      const isCoolPhase = index >= twentyPercent;
      
      const shotText = isCoolPhase ? "full body shot" : "upper body shot from waist up";
      const poses = isCoolPhase ? COOL_POSES : CASUAL_POSES;
      const pose = poses[Math.floor(Math.random() * poses.length)];
      
      // For first 20%, cycle through all angles to show all sides
      const viewAngle = isCoolPhase 
        ? angles[Math.floor(Math.random() * angles.length)]
        : angles[index % angles.length];
      
      // For first 20%, character should look in the direction they're facing, not at camera
      const gazeDirection = isCoolPhase 
        ? "" 
        : ", character looking in the direction they are facing, not looking at camera, natural gaze";
      
      const outfitText = isCoolPhase ? ", wearing different stylish outfit" : "";
      
      let bgText = "";
      if (background === "white") {
        bgText = "clean white studio background";
      } else if (background === "greenscreen") {
        bgText = "green screen studio setup";
      } else {
        bgText = "professional outdoor location";
      }
      
      prompt = `Professional photoshoot, ${viewAngle}, ${pose}${outfitText}${gazeDirection}, ${bgText}, ${shotText}, studio lighting, high-end fashion photography, professional camera quality, ${formatText}. Ultra high resolution.`;
      
      console.log(`Generating image ${index + 1} with prompt: ${prompt}`);
      
      // Prepare reference image data (remove data URL prefix if present)
      const cleanBase64 = base64Images[0].replace(/^data:image\/[a-z]+;base64,/, '');
      
      // Call Google Gemini API directly with reference image
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Create an image matching the reference character. Keep EXACT same appearance and art style. ${prompt}`,
                  },
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        }
      );

      console.log("🔍 API Request sent to:", response.url);
      console.log("🔍 Response status:", response.status);
      console.log("🔍 Response headers:", Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Google API error: ${response.status}`, errorText);
        console.error("❌ Full response:", response);
        throw new Error(`Image generation failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("📦 Full API Response for image", index + 1, ":");
      console.log(JSON.stringify(data, null, 2));
      
      // Check for IMAGE_OTHER error (model couldn't generate from reference)
      if (data.candidates?.[0]?.finishReason === "IMAGE_OTHER") {
        console.warn("⚠️ IMAGE_OTHER detected - Model couldn't generate with reference image");
        
        // Retry with fresh API call (not just recursive call)
        if (retryCount < MAX_RETRIES) {
          console.log(`🔄 Retrying image ${index + 1} with new API call (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
          
          setImageSlots((prev) => {
            const updated = [...prev];
            updated[index] = { 
              status: "loading", 
              progress: 30,
              retrying: true 
            };
            return updated;
          });
          
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          return generateSingleImage(index, apiKey, base64Images, background, numberOfImages, selectedFormat, selectedShot, angle, retryCount + 1);
        }
        
        return null;
      }
      
      console.log("🔍 Checking response structure:");
      console.log("  - data.candidates exists?", !!data.candidates);
      console.log("  - candidates length:", data.candidates?.length);
      console.log("  - candidates[0]:", data.candidates?.[0]);
      console.log("  - candidates[0].content:", data.candidates?.[0]?.content);
      console.log("  - candidates[0].content.parts:", data.candidates?.[0]?.content?.parts);
      
      // Extract the generated image from the response
      if (data.candidates && data.candidates[0]?.content?.parts) {
        const imagePart = data.candidates[0].content.parts.find(
          (part: any) => part.inlineData
        );
        console.log("🔍 Found imagePart:", imagePart);
        
        if (imagePart?.inlineData?.data) {
          const imageData = imagePart.inlineData.data;
          const mimeType = imagePart.inlineData.mimeType || "image/jpeg";
          
          console.log(`✅ Image ${index + 1} generated successfully`);
          console.log("🔍 MIME Type:", mimeType);
          console.log("🔍 Base64 data length:", imageData.length);
          
          // Convert Base64 to Blob for better memory management
          const byteCharacters = atob(imageData);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          
          // Create Blob URL instead of Data URL to save memory
          const blobUrl = URL.createObjectURL(blob);
          
          console.log("✅ Blob URL created:", blobUrl);
          
          return blobUrl;
        }
      }
      
      console.error("❌ No image in response for image", index + 1);
      console.error("❌ Response structure did not match expected format");
      
      // Retry if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        console.log(`🔄 Retrying image ${index + 1} (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
        
        // Update slot to show retry status
        setImageSlots((prev) => {
          const updated = [...prev];
          updated[index] = { 
            status: "loading", 
            progress: 30,
            retrying: true 
          };
          return updated;
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return generateSingleImage(index, apiKey, base64Images, background, numberOfImages, selectedFormat, selectedShot, angle, retryCount + 1);
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error generating image ${index}:`, error);
      console.error("❌ Error type:", error instanceof Error ? error.constructor.name : typeof error);
      console.error("❌ Error message:", error instanceof Error ? error.message : String(error));
      console.error("❌ Full error object:", error);
      
      // Check for CORS errors
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        console.error("⚠️ POSSIBLE CORS ERROR - Direct API call from browser may be blocked!");
      }
      
      // Retry if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        console.log(`🔄 Retrying image ${index + 1} after error (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
        
        // Update slot to show retry status
        setImageSlots((prev) => {
          const updated = [...prev];
          updated[index] = { 
            status: "loading", 
            progress: 30,
            retrying: true 
          };
          return updated;
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return generateSingleImage(index, apiKey, base64Images, background, numberOfImages, selectedFormat, selectedShot, angle, retryCount + 1);
      }
      
      return null;
    }
  };

  const processQueue = async (
    apiKey: string,
    base64Images: string[],
    background: string,
    selectedFormat: string,
    selectedShot: string,
    totalCount: number
  ) => {
    console.log("🔄 processQueue gestartet!");
    console.log("🔄 Queue Länge:", generationQueueRef.current.length);
    console.log("🔄 isGenerating:", isGenerating);
    console.log("🔄 totalCount:", totalCount);
    console.log("🔄 base64Images Länge:", base64Images.length);
    
    const CONCURRENT_REQUESTS = 2;
    const angles = ["front", "front-right", "right", "back-right", "back", "back-left", "left", "front-left"];

    console.log("🔄 Starte while-Schleife...");
    while (generationQueueRef.current.length > 0 && isGeneratingRef.current) {
      console.log("🔄 While-Iteration startet, Queue:", generationQueueRef.current.length);
      const batch = generationQueueRef.current.splice(0, CONCURRENT_REQUESTS);
      console.log("🔄 Batch erstellt:", batch);
      
      await Promise.all(
        batch.map(async (index) => {
          console.log(`🎨 Starte Generierung für Index ${index}`);
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

          const imageUrl = await generateSingleImage(
            index,
            apiKey,
            base64Images,
            background,
            totalCount,
            selectedFormat,
            selectedShot
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
    console.log("🚀 handleGenerate aufgerufen!");
    console.log("🔑 API Key vorhanden?", !!apiKey);
    console.log("🔑 API Key Länge:", apiKey?.length || 0);
    console.log("🖼️ Anzahl Reference Images:", referenceImages.length);
    console.log("🎯 Hintergrund:", selectedBackground);
    console.log("🔢 Anzahl zu generierende Bilder:", imageCount[0]);
    
    if (!apiKey) {
      console.log("❌ Fehler: Kein API Key");
      toast({
        title: "API Key required",
        description: "Please enter your Google Gemini API key",
        variant: "destructive",
      });
      return;
    }

    if (referenceImages.length === 0) {
      console.log("❌ Fehler: Keine Reference Images");
      toast({
        title: "Reference images required",
        description: "Please upload at least one reference image",
        variant: "destructive",
      });
      return;
    }

    console.log("✅ Validierung erfolgreich, starte Generierung...");
    setIsGenerating(true);
    isGeneratingRef.current = true;
    
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

      await processQueue(apiKey, base64Images, selectedBackground, selectedFormat, selectedShot, imageCount[0]);
      
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
      isGeneratingRef.current = false;
      generationQueueRef.current = [];
    }
  };

  const handleCustomPrompt = async () => {
    if (!apiKey || !customPrompt) {
      toast({
        title: "Missing information",
        description: "Please enter both API key and custom prompt",
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

    console.log("🎨 Starting custom prompt generation with reference images");
    console.log("🎨 Custom Prompt:", customPrompt);
    console.log("🎨 Reference Images:", referenceImages.length);

    const newIndex = imageSlots.length;
    setImageSlots((prev) => [...prev, { status: "loading", progress: 0 }]);

    try {
      const progressInterval = setInterval(() => {
        setImageSlots((prev) => {
          const updated = [...prev];
          if (updated[newIndex]?.status === "loading") {
            updated[newIndex].progress = Math.min((updated[newIndex].progress || 0) + 10, 90);
          }
          return updated;
        });
      }, 500);

      // Convert reference images to base64
      const imagePromises = referenceImages.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });

      const base64Images = await Promise.all(imagePromises);
      // Clean all base64 images
      const cleanBase64Images = base64Images.map(img => img.replace(/^data:image\/[a-z]+;base64,/, ''));

      // Build base prompt with all settings
      const format = FORMAT_OPTIONS.find((f) => f.id === selectedFormat);
      const formatText = format ? `aspect ratio ${format.ratio}` : "";
      
      const shot = SHOT_OPTIONS.find((s) => s.id === selectedShot);
      const shotText = shot ? shot.description : "full body shot";

      let bgText = "";
      if (selectedBackground === "white") {
        bgText = "plain white background";
      } else if (selectedBackground === "greenscreen") {
        bgText = "green screen background for easy removal";
      } else {
        bgText = "photorealistic background scenery";
      }

      // Generate random pose and attributes
      const randomPose = CASUAL_POSES[Math.floor(Math.random() * CASUAL_POSES.length)];
      const randomExpression = EXPRESSIONS[Math.floor(Math.random() * EXPRESSIONS.length)];
      
      // Build the main prompt
      const basePrompt = `Professional photoshoot, ${randomPose}, ${randomExpression}, ${bgText}, ${shotText}, studio lighting, high-end fashion photography, professional camera quality, ${formatText}. Ultra high resolution.`;
      
      // Combine base prompt with custom prompt
      const fullPrompt = `${basePrompt}\n\nADDITIONAL REQUIREMENTS: ${customPrompt}`;

      console.log("🎨 Full combined prompt:", fullPrompt);
      console.log("🎨 Using", cleanBase64Images.length, "reference images for blending");

      // Build parts array with text prompt and ALL reference images
      const parts = [
        {
          text: `Create a character image by BLENDING AND MIXING features from ALL ${cleanBase64Images.length} reference images provided. Combine facial features, style, and characteristics from each image harmoniously. ${fullPrompt}`,
        },
        // Add ALL reference images
        ...cleanBase64Images.map(base64Data => ({
          inlineData: {
            mimeType: "image/png",
            data: base64Data,
          },
        })),
      ];

      // Call Google Gemini API with ALL reference images
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: parts,
              },
            ],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        }
      );

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Google API error: ${response.status}`, errorText);
        throw new Error(`Image generation failed: ${response.status}`);
      }

      const data = await response.json();
      console.log("📦 Custom prompt API response received");
      
      // Extract the generated image from the response
      if (data.candidates && data.candidates[0]?.content?.parts) {
        const imagePart = data.candidates[0].content.parts.find(
          (part: any) => part.inlineData
        );
        
        if (imagePart?.inlineData?.data) {
          const imageData = imagePart.inlineData.data;
          const mimeType = imagePart.inlineData.mimeType || "image/jpeg";
          console.log("✅ Custom prompt image generated successfully");
          
          // Convert Base64 to Blob
          const byteCharacters = atob(imageData);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: mimeType });
          const imageUrl = URL.createObjectURL(blob);
          
          setImageSlots((prev) => {
            const updated = [...prev];
            updated[newIndex] = { status: "completed", imageUrl, progress: 100 };
            return updated;
          });
          setCustomPrompt("");
          
          toast({
            title: "Success!",
            description: "Generated custom image with your requirements",
          });
          return;
        }
      }

      throw new Error("No image in response");
    } catch (error) {
      console.error("❌ Error with custom prompt:", error);
      
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
            Aivatar Academy Character Creator
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

            {/* Format and Shot Type Selection */}
            <div className="grid grid-cols-2 gap-4">
              {/* Image Format Dropdown */}
              <div className="space-y-2">
                <Label>Image Format</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {FORMAT_OPTIONS.find(f => f.id === selectedFormat)?.label || "Select Format"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full bg-popover">
                    {FORMAT_OPTIONS.map((format) => (
                      <DropdownMenuItem
                        key={format.id}
                        onClick={() => setSelectedFormat(format.id)}
                        className={selectedFormat === format.id ? "bg-accent" : ""}
                      >
                        {format.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Shot Type Dropdown */}
              <div className="space-y-2">
                <Label>Shot Type</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {SHOT_OPTIONS.find(s => s.id === selectedShot)?.label || "Select Shot"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-full bg-popover">
                    {SHOT_OPTIONS.map((shot) => (
                      <DropdownMenuItem
                        key={shot.id}
                        onClick={() => setSelectedShot(shot.id)}
                        className={selectedShot === shot.id ? "bg-accent" : ""}
                      >
                        {shot.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
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
