import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Upload, Image as ImageIcon, Download, ChevronLeft, ChevronRight, X, Settings, RotateCcw, Plus, LogOut, Lock } from "lucide-react";
import { ImageGallery, ImageSlotData } from "@/components/ImageGallery";
import sceneryBg from "@/assets/scenery-background.jpg";
import aivatarPromoImg from "@/assets/aivatar-academy-promo.jpg";
import JSZip from "jszip";
import { setCookie, getCookie, saveToLocalStorage, getFromLocalStorage } from "@/lib/storage";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, THEME_OPTIONS, ThemeVariant } from "@/hooks/useTheme";
import { LoginDialog } from "@/components/LoginDialog";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { DisclaimerPopup } from "@/components/DisclaimerPopup";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import PromoBanner from "@/components/PromoBanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const BACKGROUND_OPTIONS = [
  { id: "white", label: "Weißer Hintergrund" },
  { id: "greenscreen", label: "Green Screen" },
  { id: "scenery", label: "Eigene Szenerie" },
];

const FORMAT_OPTIONS = [
  { id: "square", label: "Quadratisch (1:1)", ratio: "1:1" },
  { id: "portrait-mobile", label: "Mobile (9:16)", ratio: "9:16" },
  { id: "portrait-insta", label: "Instagram (4:5)", ratio: "4:5" },
  { id: "portrait-photo", label: "Foto Hochformat (3:4)", ratio: "3:4" },
  { id: "landscape-photo", label: "Foto Querformat (4:3)", ratio: "4:3" },
  { id: "landscape-wide", label: "Widescreen (16:9)", ratio: "16:9" },
  { id: "ultrawide", label: "Ultra-Breit (21:9)", ratio: "21:9" },
];

const SHOT_OPTIONS = [
  { id: "fullbody", label: "Ganzkörper", description: "full body shot" },
  { id: "upperbody", label: "Oberkörper", description: "upper body shot from waist up" },
  { id: "closeup", label: "Nahaufnahme Gesicht", description: "close-up face shot" },
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
  const { authData, isLoading: authLoading, login, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [apiKey, setApiKey] = useState("");
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [selectedBackground, setSelectedBackground] = useState("white");
  const [sceneDescription, setSceneDescription] = useState("");
  const [imageCount, setImageCount] = useState([3]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [imageSlots, setImageSlots] = useState<ImageSlotData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState("square");
  const [selectedShot, setSelectedShot] = useState("fullbody");
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [shakingElement, setShakingElement] = useState<string | null>(null);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [switchSnapping, setSwitchSnapping] = useState(false);
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
        title: "Zu viele Bilder",
        description: "Du kannst maximal 3 Referenzbilder hochladen",
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
    customPromptText?: string,
    angle?: string,
    retryCount: number = 0,
    useSimplifiedPrompt: boolean = false
  ): Promise<string | null> => {
    const MAX_RETRIES = 3;
    
    try {
      // For first 20%: exactly 4 angles to show all sides (front, back, left, right)
      const angles = ["front view", "right side view", "back view", "left side view"];
      const viewAngle = angles[index % angles.length];
      
      // Get shot type text
      const shotOption = SHOT_OPTIONS.find(s => s.id === selectedShot);
      const shotText = shotOption?.label || "full body shot";
      
      // Get background text
      let bgText = "";
      if (background === "white") {
        bgText = "clean white studio background";
      } else if (background === "greenscreen") {
        bgText = "green screen studio setup";
      } else {
        if (sceneDescription.trim()) {
          bgText = sceneDescription.trim();
        } else {
          bgText = "professional outdoor location with natural scenery, creative and varied settings";
        }
      }
      
      let prompt = "";
      
      // Get format and shot descriptions
      const formatOption = FORMAT_OPTIONS.find(f => f.id === selectedFormat);
      const formatText = formatOption ? `${formatOption.ratio} aspect ratio` : "1:1 aspect ratio";
      
      // Use custom prompt if provided
      if (customPromptText && customPromptText.trim()) {
        prompt = `${customPromptText}. ${formatText}. Ultra high resolution.`;
      } else {
        // Simplified prompt - only view angle and shot type
        prompt = `Professional photoshoot with EXACTLY ONE person only, ${viewAngle}, ${bgText}, ${shotText}, ${formatText}. Match the exact style, realism level, art style, lighting quality, and visual aesthetic from the reference images. Ultra high resolution.`;
      }
      
      console.log(`Generating image ${index + 1} with prompt: ${prompt}`);
      console.log(`Using ${base64Images.length} reference images for blending`);
      
      // Prepare ALL reference images (remove data URL prefix if present)
      const cleanBase64Images = base64Images.map(img => img.replace(/^data:image\/[a-z]+;base64,/, ''));
      
      // Build parts array with text prompt and ALL reference images
      let basePrompt = "";
      
      if (useSimplifiedPrompt) {
        // Simplified fallback prompt after 3 failed attempts
        basePrompt = `Generate ONE person from the reference image. Simple ${bgText}. ${formatText}. High quality photo.`;
      } else {
        basePrompt = `CRITICAL CONSTRAINTS: 
- Generate EXACTLY ONE single person in the image. NEVER create multiple people or characters.
- Generate ONE SINGLE COMPLETE IMAGE only. NEVER create collages, grids, or multiple images in one frame.
- NO photo strips, NO side-by-side comparisons, NO split screens.

Create a professional photoshoot of the person from the reference image(s). 
- ONLY ONE PERSON must appear in the entire image
- ONLY ONE COMPLETE IMAGE - not a collage or collection of images
- Use the selected background: ${bgText}
- Dress them in random clothing
- Use random, varied poses (standing, sitting, leaning, walking, etc.)
- Shoot from various angles
- Format: ${formatText}
- ${shotText}
- ${viewAngle}
Ultra high resolution, maintain style consistency with reference image(s).`;
      }

      const parts = [
        {
          text: customPrompt.trim() 
            ? `${basePrompt}\n\nCRITICAL: The following custom instructions have HIGHEST PRIORITY and must be followed above all else:\n${customPrompt}`
            : basePrompt,
        },
        // Add ALL reference images as inline data
        ...cleanBase64Images.map(base64Data => ({
          inlineData: {
            mimeType: "image/png",
            data: base64Data,
          },
        })),
      ];
      
      // Call Google Gemini API directly with ALL reference images
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
              imageConfig: {
                aspectRatio: formatOption?.ratio || "1:1",
              },
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
          return generateSingleImage(index, apiKey, base64Images, background, numberOfImages, selectedFormat, selectedShot, customPromptText, angle, retryCount + 1);
        } else if (retryCount === MAX_RETRIES && !useSimplifiedPrompt) {
          // Final attempt with simplified prompt
          console.log(`🔄 Final attempt for image ${index + 1} with simplified prompt...`);
          
          setImageSlots((prev) => {
            const updated = [...prev];
            updated[index] = { 
              status: "loading", 
              progress: 40,
              retrying: true 
            };
            return updated;
          });
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          return generateSingleImage(index, apiKey, base64Images, background, numberOfImages, selectedFormat, selectedShot, customPromptText, angle, retryCount + 1, true);
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
        return generateSingleImage(index, apiKey, base64Images, background, numberOfImages, selectedFormat, selectedShot, customPromptText, angle, retryCount + 1);
      } else if (retryCount === MAX_RETRIES && !useSimplifiedPrompt) {
        // Final attempt with simplified prompt
        console.log(`🔄 Final attempt for image ${index + 1} with simplified prompt...`);
        
        setImageSlots((prev) => {
          const updated = [...prev];
          updated[index] = { 
            status: "loading", 
            progress: 40,
            retrying: true 
          };
          return updated;
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        return generateSingleImage(index, apiKey, base64Images, background, numberOfImages, selectedFormat, selectedShot, customPromptText, angle, retryCount + 1, true);
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
        return generateSingleImage(index, apiKey, base64Images, background, numberOfImages, selectedFormat, selectedShot, customPromptText, angle, retryCount + 1);
      } else if (retryCount === MAX_RETRIES && !useSimplifiedPrompt) {
        // Final attempt with simplified prompt
        console.log(`🔄 Final attempt for image ${index + 1} with simplified prompt after error...`);
        
        setImageSlots((prev) => {
          const updated = [...prev];
          updated[index] = { 
            status: "loading", 
            progress: 40,
            retrying: true 
          };
          return updated;
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        return generateSingleImage(index, apiKey, base64Images, background, numberOfImages, selectedFormat, selectedShot, customPromptText, angle, retryCount + 1, true);
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
    totalCount: number,
    customPromptText?: string
  ) => {
    console.log("🔄 processQueue gestartet!");
    console.log("🔄 Queue Länge:", generationQueueRef.current.length);
    console.log("🔄 isGenerating:", isGenerating);
    console.log("🔄 totalCount:", totalCount);
    console.log("🔄 base64Images Länge:", base64Images.length);
    
    const CONCURRENT_REQUESTS = authData.planCode === "PREMIUM" ? 2 : 1;
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
            selectedShot,
            customPromptText
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
        title: "API Key erforderlich",
        description: "Bitte gib deinen Google Gemini API Key ein",
        variant: "destructive",
      });
      return;
    }

    if (referenceImages.length === 0) {
      console.log("❌ Fehler: Keine Reference Images");
      toast({
        title: "Referenzbilder erforderlich",
        description: "Bitte lade mindestens ein Referenzbild hoch",
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

      await processQueue(apiKey, base64Images, selectedBackground, selectedFormat, selectedShot, imageCount[0], useCustomPrompt ? customPrompt : undefined);
      
      toast({
        title: "Erfolg!",
        description: `${imageCount[0]} Bilder wurden generiert`,
      });
    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: "Generierung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
      generationQueueRef.current = [];
    }
  };

  const handleGenerateMore = async () => {
    if (!apiKey) {
      toast({
        title: "API Key erforderlich",
        description: "Bitte gib deinen Google Gemini API Key ein",
        variant: "destructive",
      });
      return;
    }

    if (referenceImages.length === 0) {
      toast({
        title: "Referenzbilder erforderlich",
        description: "Bitte lade mindestens ein Referenzbild hoch",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    isGeneratingRef.current = true;
    
    const currentLength = imageSlots.length;
    const newCount = imageCount[0];
    
    // Add new pending slots to existing ones
    const newSlots: ImageSlotData[] = Array(newCount).fill(null).map(() => ({
      status: "pending" as const,
      progress: 0,
    }));
    setImageSlots(prev => [...prev, ...newSlots]);
    
    // Fill queue with indices starting after existing images
    generationQueueRef.current = Array.from({ length: newCount }, (_, i) => currentLength + i);

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

      await processQueue(apiKey, base64Images, selectedBackground, selectedFormat, selectedShot, currentLength + newCount, useCustomPrompt ? customPrompt : undefined);
      
      toast({
        title: "Erfolg!",
        description: `${newCount} weitere Bilder wurden generiert`,
      });
    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: "Generierung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten",
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
        title: "Fehlende Informationen",
        description: "Bitte gib sowohl API Key als auch Custom Prompt ein",
        variant: "destructive",
      });
      return;
    }

    if (referenceImages.length === 0) {
      toast({
        title: "Referenzbilder erforderlich",
        description: "Bitte lade mindestens ein Referenzbild hoch",
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
              imageConfig: {
                aspectRatio: format?.ratio || "1:1",
              },
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
          
          toast({
            title: "Erfolg!",
            description: "Benutzerdefiniertes Bild wurde mit deinen Anforderungen generiert",
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
        title: "Generierung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Ein Fehler ist aufgetreten",
        variant: "destructive",
      });
    }
  };

  const handleImageClick = (index: number) => {
    const slot = imageSlots[index];
    if (slot.status === "completed" && slot.imageUrl) {
      setSelectedImageIndex(index);
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

  const handleDeleteImage = (index: number) => {
    setImageSlots((prev) => prev.filter((_, i) => i !== index));
    toast({
      title: "Bild gelöscht",
      description: `Bild #${index + 1} wurde erfolgreich gelöscht`,
    });
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (selectedImageIndex === null) return;
    
    if (direction === 'prev' && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    } else if (direction === 'next' && selectedImageIndex < imageSlots.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  const handleDownloadAll = async () => {
    const completedImages = imageSlots.filter((slot) => slot.status === "completed" && slot.imageUrl);
    
    if (completedImages.length === 0) {
      toast({
        title: "Keine Bilder zum Herunterladen",
        description: "Generiere zuerst einige Bilder",
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
        title: "Erfolg!",
        description: `${completedImages.length} Bilder wurden heruntergeladen`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download fehlgeschlagen",
        description: "ZIP-Datei konnte nicht erstellt werden",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen">
      {authLoading ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !authData.isAuthenticated ? (
        <LoginDialog onLogin={login} />
      ) : (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
        <PromoBanner planCode={authData.planCode} />
        {/* Settings Button */}
        <div className="absolute top-6 right-6">
          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="rounded-full">
                <Settings className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Einstellungen</SheetTitle>
                <SheetDescription>
                  Konfiguriere deinen API Key und andere Einstellungen
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="settings-api-key">Google Gemini API Key</Label>
                  <Input
                    id="settings-api-key"
                    type="password"
                    placeholder="Gib deinen API Key ein..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-sm text-muted-foreground">
                    Dein API Key wird sicher gespeichert und nur lokal verwendet.
                  </p>
                </div>
                
                {/* Theme Selector - Pro Only */}
                <div className="pt-6 border-t border-border">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Farbschema</Label>
                      {authData.planCode !== "PREMIUM" && (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {THEME_OPTIONS.map((option) => {
                        const isLocked = authData.planCode !== "PREMIUM" && option.id !== "neon";
                        const isSelected = theme === option.id;
                        
                        return (
                          <button
                            key={option.id}
                            onClick={() => {
                              if (isLocked) {
                                setShakingElement(`theme-${option.id}`);
                                setTimeout(() => setShakingElement(null), 500);
                                setShowUpgradePopup(true);
                              } else {
                                setTheme(option.id);
                              }
                            }}
                            className={`
                              relative p-2 rounded-lg border text-center transition-all
                              ${isSelected 
                                ? "border-primary bg-primary/10 shadow-md" 
                                : isLocked
                                  ? "border-border/50 bg-muted/30 opacity-60"
                                  : "border-border bg-card hover:border-primary/50 hover:bg-primary/5"
                              }
                              ${shakingElement === `theme-${option.id}` ? "animate-shake" : ""}
                            `}
                          >
                            {isLocked && (
                              <Lock 
                                className={`absolute top-1 right-1 w-3 h-3 text-muted-foreground transition-all
                                  ${shakingElement === `theme-${option.id}` ? "text-destructive scale-125" : ""}
                                `} 
                              />
                            )}
                            <div 
                              className={`w-5 h-5 mx-auto rounded-full mb-1 bg-gradient-to-br ${option.gradient}`}
                            />
                            <span className="text-[10px] font-medium block">{option.label}</span>
                            <span className="text-[8px] text-muted-foreground block">{option.description}</span>
                          </button>
                        );
                      })}
                    </div>
                    {authData.planCode !== "PREMIUM" && (
                      <p className="text-xs text-muted-foreground">
                        Weitere Themes sind nur mit Pro verfügbar.
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-border">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label>Account</Label>
                      <p className="text-sm text-muted-foreground">
                        Angemeldet als: {authData.email}
                      </p>
                      {authData.planName && (
                        <p className="text-sm text-muted-foreground">
                          Plan: {authData.planName}
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      onClick={() => {
                        logout();
                        setSettingsOpen(false);
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Abmelden
                    </Button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Header */}
        <div 
          className="text-center mb-12 pr-12 animate-fade-in"
          style={{ animationDelay: '0ms', animationDuration: '600ms', animationFillMode: 'both' }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">KI Character Generator</span>
          </div>
          <div className="flex items-center justify-center gap-3 mb-4 flex-wrap overflow-visible">
            <h1 className="text-4xl sm:text-5xl font-bold">
              <AnimatedTitle text="AvatarCreatorStudio" />
            </h1>
            <span 
              className={`px-3 py-1 text-sm font-semibold rounded-full shrink-0 transition-all duration-500 ${
                authData.planCode === "PREMIUM" 
                  ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black" 
                  : "bg-muted text-muted-foreground"
              }`}
              style={{
                opacity: 1,
                transform: "translateY(0) scale(1)",
                animation: "badge-appear 0.5s ease-out 0.8s both"
              }}
            >
              {authData.planCode === "PREMIUM" ? "Pro" : "Basic"}
            </span>
          </div>
          <p className="text-muted-foreground text-lg">
            Generiere vielfältige Character-Posen mit KI
          </p>
        </div>

        {/* Main Controls */}
        <Card 
          className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in"
          style={{ animationDelay: '150ms', animationDuration: '600ms', animationFillMode: 'both' }}
        >
          <CardContent className="pt-6 space-y-6">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Referenzbilder
                <span className="flex items-center gap-2 ml-1">
                  {[1, 2, 3].map((num) => {
                    const maxAllowed = authData.planCode === "PREMIUM" ? 3 : 1;
                    const isLocked = num > maxAllowed;
                    const isFilled = num <= referenceImages.length;
                    
                    return (
                      <span
                        key={num}
                        className="relative flex items-center justify-center w-4 h-4"
                      >
                        {isLocked ? (
                          <Lock className="w-4 h-4 text-muted-foreground/70" />
                        ) : (
                          <span
                            className={`block w-3 h-3 rounded-full transition-all ${
                              isFilled
                                ? "bg-primary"
                                : "bg-muted-foreground/20 border border-muted-foreground/40"
                            }`}
                          />
                        )}
                      </span>
                    );
                  })}
                </span>
              </Label>
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
                {/* Show upload button based on plan limits */}
                {(() => {
                  const maxImages = authData.planCode === "PREMIUM" ? 3 : 1;
                  const canUpload = referenceImages.length < maxImages;
                  const isLockedSlot = referenceImages.length >= maxImages && referenceImages.length < 3 && authData.planCode !== "PREMIUM";
                  
                  if (canUpload) {
                    return (
                      <label className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (authData.planCode !== "PREMIUM" && e.target.files && e.target.files.length > 1) {
                              // Basic users can only upload 1 file
                              const dt = new DataTransfer();
                              dt.items.add(e.target.files[0]);
                              e.target.files = dt.files;
                            }
                            handleImageUpload(e);
                          }}
                          className="hidden"
                        />
                        <Upload className="w-8 h-8 text-muted-foreground" />
                      </label>
                    );
                  } else if (isLockedSlot) {
                    return (
                      <div 
                        onClick={() => {
                          setShakingElement("upload");
                          setTimeout(() => setShakingElement(null), 500);
                          setShowUpgradePopup(true);
                        }}
                        className={`relative w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 group ${
                          shakingElement === "upload" 
                            ? "animate-shake border-red-500 bg-red-500/20" 
                            : "border-border/50 hover:border-border/70 hover:bg-muted/30"
                        }`}
                      >
                        <Lock className={`w-10 h-10 transition-all duration-200 ${
                          shakingElement === "upload" 
                            ? "text-red-500" 
                            : "text-muted-foreground/70 group-hover:text-muted-foreground group-hover:scale-110"
                        }`} />
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Background Selection - Horizontal Layout */}
            <div className="space-y-2">
              <Label>Hintergrund</Label>
              <div className="flex gap-3">
                {BACKGROUND_OPTIONS.map((option) => {
                  const isSelected = selectedBackground === option.id;
                  const isPremiumFeature = option.id === "greenscreen" || option.id === "scenery";
                  const isLocked = isPremiumFeature && authData.planCode !== "PREMIUM";
                  
                  let bgClass = "bg-background border-border";
                  let bgStyle: React.CSSProperties = {};
                  
                  if (option.id === "white") {
                    bgClass = isSelected 
                      ? "bg-white text-black border-gray-400 shadow-md" 
                      : "bg-white/70 text-black/70 border-gray-300 hover:bg-white hover:text-black hover:border-gray-400 hover:shadow-sm";
                  } else if (option.id === "greenscreen") {
                    bgClass = isLocked
                      ? "bg-green-500/40 text-white/50 border-green-600/50"
                      : isSelected 
                        ? "bg-green-500 text-white border-green-700 shadow-md" 
                        : "bg-green-500/70 text-white/70 border-green-600 hover:bg-green-500 hover:text-white hover:border-green-700 hover:shadow-sm";
                  } else if (option.id === "scenery") {
                    bgClass = isLocked
                      ? "text-white/50 border-gray-300/50"
                      : isSelected 
                        ? "text-white border-gray-400 shadow-md" 
                        : "text-white/90 border-gray-300 hover:text-white hover:border-gray-400 hover:shadow-sm";
                    bgStyle = {
                      backgroundImage: `url(${sceneryBg})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundColor: isLocked ? 'rgba(0,0,0,0.7)' : isSelected ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.5)',
                      backgroundBlendMode: 'darken'
                    };
                  }
                  
                  return (
                    <Button
                      key={option.id}
                      variant="outline"
                      onClick={() => {
                        if (isLocked) {
                          setShakingElement(option.id);
                          setTimeout(() => setShakingElement(null), 500);
                          setShowUpgradePopup(true);
                        } else {
                          setSelectedBackground(option.id);
                        }
                      }}
                      className={`relative min-w-[120px] px-4 py-2 transition-all duration-200 border-2 font-semibold group hover:bg-transparent ${
                        isLocked && shakingElement === option.id
                          ? "animate-shake border-red-500 bg-red-500/30"
                          : bgClass
                      } ${
                        isLocked
                          ? "cursor-pointer opacity-60 hover:opacity-70"
                          : isSelected 
                            ? "scale-105" 
                            : "hover:scale-[1.02]"
                      }`}
                      style={{ transformOrigin: 'center', ...(isLocked && shakingElement === option.id ? {} : bgStyle) }}
                    >
                      {isLocked && (
                        <div className={`absolute inset-0 flex items-center justify-center rounded-md transition-all duration-200 ${
                          shakingElement === option.id 
                            ? "bg-red-500/30" 
                            : "bg-black/40 group-hover:bg-black/50"
                        }`}>
                          <Lock className={`w-8 h-8 transition-all duration-200 ${
                            shakingElement === option.id 
                              ? "text-red-500" 
                              : "text-white/80 group-hover:text-white group-hover:scale-110"
                          }`} />
                        </div>
                      )}
                      {option.label}
                    </Button>
                  );
                })}
              </div>
              
              {/* Scene Description Input - Shows when "Eigene Szenerie" is selected */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                selectedBackground === "scenery" 
                  ? "max-h-32 opacity-100 mt-3" 
                  : "max-h-0 opacity-0 mt-0"
              }`}>
                <div className="space-y-1">
                  <Input
                    type="text"
                    placeholder="Beschreibe die Szene (z.B. 'Strand bei Sonnenuntergang', 'Urbaner Park im Herbst')"
                    value={sceneDescription}
                    onChange={(e) => setSceneDescription(e.target.value)}
                    className="w-full"
                    maxLength={200}
                  />
                  <p className="text-xs text-muted-foreground">
                    Hinweis: Wenn leer gelassen, wird die KI sich selbst eine passende Szene ausdenken
                  </p>
                </div>
              </div>
            </div>

            {/* Format and Shot Type Selection */}
            <div className="grid grid-cols-2 gap-4">
              {/* Image Format Dropdown */}
              <div className="space-y-2">
                <Label>Bildformat</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {FORMAT_OPTIONS.find(f => f.id === selectedFormat)?.label || "Format wählen"}
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
                <Label>Aufnahme-Typ</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {SHOT_OPTIONS.find(s => s.id === selectedShot)?.label || "Aufnahme wählen"}
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
                <Label className="flex items-center gap-2">
                  Anzahl Bilder
                  {authData.planCode !== "PREMIUM" && (
                    <span className="text-xs text-muted-foreground">(max 6 für Basic)</span>
                  )}
                </Label>
                <span className="text-sm text-muted-foreground">{Math.floor(imageCount[0])} / 40</span>
              </div>
              <div className="relative">
                <Slider
                  value={imageCount}
                  onValueChange={(value) => {
                    const maxValue = authData.planCode !== "PREMIUM" ? 6 : 40;
                    setImageCount([Math.min(value[0], maxValue)]);
                  }}
                  min={1}
                  max={40}
                  step={1}
                  className="w-full relative z-10"
                  lockedStart={authData.planCode !== "PREMIUM" ? 6 : undefined}
                />
              </div>
            </div>

            {/* Custom Prompt Toggle */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div 
                  className={`flex items-center gap-2 ${shakingElement === "customPrompt" ? "animate-shake" : ""}`}
                >
                  <Label 
                    htmlFor="custom-prompt-toggle" 
                    className={`text-sm font-medium leading-none ${authData.planCode !== "PREMIUM" ? "text-muted-foreground" : "cursor-pointer"}`}
                  >
                    Custom Prompt verwenden
                  </Label>
                  {authData.planCode !== "PREMIUM" && (
                    <Lock className={`w-5 h-5 ${shakingElement === "customPrompt" ? "text-red-500" : "text-muted-foreground"} transition-colors`} />
                  )}
                </div>
                <div 
                  className="relative w-12 h-6 cursor-pointer"
                  onClick={() => {
                    if (authData.planCode !== "PREMIUM") {
                      setSwitchSnapping(true);
                      setShakingElement("customPrompt");
                      setTimeout(() => {
                        setSwitchSnapping(false);
                        setShakingElement(null);
                        setShowUpgradePopup(true);
                      }, 400);
                    }
                  }}
                >
                  {authData.planCode === "PREMIUM" ? (
                    <Switch 
                      id="custom-prompt-toggle" 
                      checked={useCustomPrompt}
                      onCheckedChange={setUseCustomPrompt}
                      className="w-12 h-6 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted [&>span]:h-5 [&>span]:w-5 [&>span]:data-[state=checked]:translate-x-6"
                    />
                  ) : (
                    <div className="w-12 h-6 bg-muted rounded-full relative opacity-50">
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm ${switchSnapping ? "animate-switch-snap-back" : ""}`} />
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Prompt Input - Smooth Collapsible */}
              <div 
                className={`grid transition-all duration-300 ease-in-out ${
                  useCustomPrompt ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="custom-prompt-input">Custom Image Prompt</Label>
                    <Textarea
                      id="custom-prompt-input"
                      placeholder="Beschreibe eine bestimmte Pose oder Szene..."
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="min-h-[100px] focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Generate Buttons */}
            <div className="flex gap-3 justify-between">
              {imageSlots.length === 0 ? (
                <Button
                  onClick={handleGenerate}
                  disabled={!apiKey || referenceImages.length === 0 || isGenerating}
                  className="w-full bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                      Generiere...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Bilder generieren
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleGenerateMore}
                    disabled={!apiKey || referenceImages.length === 0 || isGenerating}
                    className="flex-[2] bg-primary hover:bg-primary/90 animate-in slide-in-from-left-5"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Sparkles className="w-5 h-5 mr-2 animate-spin" />
                        Generiere...
                      </>
                    ) : (
                      <>
                        <Plus className="w-5 h-5 mr-2" />
                        Bilder dazu generieren
                      </>
                    )}
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        disabled={!apiKey || referenceImages.length === 0 || isGenerating}
                        className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-in slide-in-from-right-5"
                        size="lg"
                        variant="destructive"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Neu generieren
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Alle Bilder löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Dies wird alle aktuell generierten Bilder löschen und neue generieren. Diese Aktion kann nicht rückgängig gemacht werden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleGenerate}>
                          Ja, neu generieren
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  
                  <Button
                    onClick={handleDownloadAll}
                    disabled={isGenerating || imageSlots.filter(s => s.status === "completed").length === 0}
                    variant="secondary"
                    className="h-12"
                    size="lg"
                  >
                    <Download className="mr-2" />
                    Alle herunterladen
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Generated Images Gallery */}
        <div 
          className="animate-fade-in"
          style={{ animationDelay: '300ms', animationDuration: '600ms', animationFillMode: 'both' }}
        >
          <ImageGallery 
            slots={imageSlots} 
            onDownload={handleDownloadSingle}
            onImageClick={handleImageClick}
            onDelete={handleDeleteImage}
            isBasicPlan={authData.planCode !== "PREMIUM"}
            isGenerating={isGenerating}
            format={FORMAT_OPTIONS.find(f => f.id === selectedFormat)?.ratio || "1:1"}
          />
        </div>

        {/* Image Viewer Dialog */}
        <Dialog open={selectedImageIndex !== null} onOpenChange={() => setSelectedImageIndex(null)}>
          <DialogContent className="max-w-3xl w-[50vw] h-[calc(50vh+310px)] p-0 bg-background/95 backdrop-blur-sm border-border/50 top-[50px] translate-y-0">
            <div className="relative w-full h-full flex flex-col">
              {selectedImageIndex !== null && imageSlots[selectedImageIndex] && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-6 top-1/2 -translate-y-1/2 z-50 rounded-full bg-background/80 hover:bg-background"
                    onClick={() => navigateImage('prev')}
                    disabled={selectedImageIndex === 0}
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-6 top-1/2 -translate-y-1/2 z-50 rounded-full bg-background/80 hover:bg-background"
                    onClick={() => navigateImage('next')}
                    disabled={selectedImageIndex === imageSlots.length - 1}
                  >
                    <ChevronRight className="w-6 h-6" />
                  </Button>

                  {/* Main Image Display */}
                  <div className="flex-1 flex items-center justify-center overflow-hidden p-4 pb-0">
                    {imageSlots[selectedImageIndex].status === "completed" && imageSlots[selectedImageIndex].imageUrl ? (
                      <img
                        src={imageSlots[selectedImageIndex].imageUrl}
                        alt={`Bild ${selectedImageIndex + 1}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : imageSlots[selectedImageIndex].status === "loading" ? (
                      <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
                        <p className="text-sm text-muted-foreground">Wird generiert...</p>
                      </div>
                    ) : imageSlots[selectedImageIndex].status === "pending" ? (
                      <div className="flex flex-col items-center gap-4">
                        <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">Wartet auf Generierung...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-sm text-destructive">Fehler beim Generieren</p>
                      </div>
                    )}
                  </div>

                  {/* Image Counter */}
                  <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full">
                    <span className="text-xs font-medium">
                      #{selectedImageIndex + 1} / {imageSlots.length}
                    </span>
                  </div>

                  {/* Download Button */}
                  {imageSlots[selectedImageIndex].status === "completed" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-6 left-6 z-50"
                      onClick={() => handleDownloadSingle(selectedImageIndex)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}

                  {/* Thumbnail Strip */}
                  <div className="w-full bg-background/80 backdrop-blur-sm px-4 py-2 rounded-b-lg">
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-primary scrollbar-track-muted">
                      {imageSlots.map((slot, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`relative flex-shrink-0 w-14 h-14 rounded-md border-2 transition-all overflow-hidden ${
                            selectedImageIndex === index
                              ? "border-primary scale-105"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          {slot.status === "completed" && slot.imageUrl ? (
                            <img
                              src={slot.imageUrl}
                              alt={`Thumbnail ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          ) : slot.status === "loading" ? (
                            <div className="w-full h-full flex items-center justify-center bg-muted">
                              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                            </div>
                          ) : slot.status === "pending" ? (
                            <div className="w-full h-full flex items-center justify-center bg-muted/50">
                              <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-destructive/10">
                              <X className="w-4 h-4 text-destructive" />
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm text-center h-[18px] flex items-center justify-center">
                            <span className="text-[10px] font-medium leading-none">#{index + 1}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

          {/* Upgrade to Pro Popup */}
          {showUpgradePopup && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-card border-2 border-red-500 rounded-lg p-6 max-w-md mx-4 relative shadow-2xl">
                <button
                  onClick={() => setShowUpgradePopup(false)}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                    <Lock className="w-8 h-8 text-red-500" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Pro Version erforderlich</h3>
                  <p className="text-muted-foreground">
                    Um dieses Feature zu nutzen, benötigst du die Pro Version von AvatarCreatorStudio.
                  </p>
                  <Button
                    onClick={() => {
                      window.open("https://www.digistore24.com/product/644591?voucher=avatarcreatorstudio-deal", "_blank");
                      setShowUpgradePopup(false);
                    }}
                    className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-semibold hover:from-amber-600 hover:to-yellow-500"
                  >
                    Jetzt Pro Version kaufen
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Aivatar Academy Promotion Section */}
          <div className="w-full mt-16 mb-8 px-4">
            <a
              href="https://aivataracademy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block max-w-3xl mx-auto group cursor-pointer"
            >
              <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card/80 via-card/60 to-primary/10 backdrop-blur-md shadow-xl hover:shadow-2xl hover:shadow-primary/20 transition-all duration-500 hover:scale-[1.02] hover:border-primary/50">
                {/* Glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500 -z-10" />
                
                <div className="flex flex-col items-center gap-6 p-6 md:p-8">
                  {/* Image - centered on top */}
                  <div className="relative w-full max-w-lg overflow-hidden rounded-xl">
                    <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent z-10" />
                    <img 
                      src={aivatarPromoImg} 
                      alt="Aivatar Academy" 
                      className="w-full h-56 object-cover transform group-hover:scale-105 transition-transform duration-700"
                    />
                  </div>
                  
                  {/* Content */}
                  <div className="text-center space-y-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/20 rounded-full text-xs font-semibold text-primary uppercase tracking-wide">
                      <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      Aivatar Academy
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-foreground group-hover:text-primary transition-colors duration-300">
                      Willst du deinen Avatar richtig groß rausbringen?
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
                      Mehr Reichweite, mehr Style, mehr Möglichkeiten – entdecke unser exklusives Webinar und hebe dein KI-Game aufs nächste Level.
                    </p>
                    <div className="inline-flex items-center gap-2 text-primary font-bold group-hover:gap-3 transition-all duration-300 pt-2">
                      Jetzt entdecken
                      <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </a>
          </div>

          <DisclaimerFooter />
          <DisclaimerPopup />
        </div>
      )}
    </div>
  );
};

export default Index;
