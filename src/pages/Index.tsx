import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Upload, Image as ImageIcon, Download, ChevronLeft, ChevronRight, ChevronDown, X, Settings, RotateCcw, Plus, LogOut, Lock, Scale, Video, Loader2, Send, Undo2, Clock, Move, Zap, BookOpen, RefreshCw } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { ReferenceImagePreview } from "@/components/ReferenceImagePreview";
import { LegalDialog } from "@/components/LegalDialog";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

const SKIN_OPTIONS = [
  { id: "soft", label: "Weiche Haut", description: "soft, smooth, flawless skin with subtle glow" },
  { id: "realistic", label: "Realistische Haut", description: "realistic natural skin with visible pores and natural texture" },
  { id: "imperfect", label: "Unvollkommene Haut", description: "imperfect skin with visible blemishes, freckles, wrinkles, and natural imperfections" },
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

// Video Prompt Templates
const VIDEO_STYLE_TEMPLATES = [
  { id: "cinematic", label: "Cinematic", prefix: "Cinematic slow motion shot, " },
  { id: "slowmo", label: "Slow Motion", prefix: "Ultra slow motion capture, " },
  { id: "zoomin", label: "Zoom-In", prefix: "Dramatic zoom-in shot, " },
  { id: "orbit", label: "Orbit", prefix: "Smooth orbiting camera movement around subject, " },
  { id: "dolly", label: "Dolly", prefix: "Cinematic dolly shot moving forward, " },
  { id: "static", label: "Statisch", prefix: "Static camera shot, subtle movements, " },
];

const VIDEO_DURATION_OPTIONS = [
  { id: "5s", label: "5 Sek", value: 5 },
  { id: "10s", label: "10 Sek", value: 10 },
];

const VIDEO_SPEED_OPTIONS = [
  { id: "slow", label: "Langsam", description: "slow, smooth movements" },
  { id: "normal", label: "Normal", description: "natural speed" },
  { id: "fast", label: "Schnell", description: "dynamic, fast-paced" },
];

const Index = () => {
  const { authData, isLoading: authLoading, login, logout } = useAuth();
  
  // Helper: Check if user has Pro-level access (PREMIUM or FULL)
  const isPro = authData.planCode === "PREMIUM" || authData.planCode === "FULL";
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
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [shakingElement, setShakingElement] = useState<string | null>(null);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [switchSnapping, setSwitchSnapping] = useState(false);
  const [legalDialogOpen, setLegalDialogOpen] = useState(false);
  const [tutorialDialogOpen, setTutorialDialogOpen] = useState(false);
  const [selectedSkinType, setSelectedSkinType] = useState("realistic");
  const isGeneratingRef = useRef(false);
  const referenceImagesRef = useRef<File[]>([]);
  const { toast } = useToast();
  const generationQueueRef = useRef<number[]>([]);
  
  // Video prompt generation state
  const [allVideoPrompts, setAllVideoPrompts] = useState<string[]>([]);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [isGeneratingVideoPrompt, setIsGeneratingVideoPrompt] = useState(false);
  const [promptChatInput, setPromptChatInput] = useState("");
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [videoPromptOpen, setVideoPromptOpen] = useState(false);
  const [selectedVideoStyle, setSelectedVideoStyle] = useState<string | null>(null);
  const [selectedVideoDuration, setSelectedVideoDuration] = useState("5s");
  const [selectedVideoSpeed, setSelectedVideoSpeed] = useState("normal");
  
  // Dynamic AI suggestions state
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([
    "Langsam lächeln und in die Kamera schauen",
    "Sprechen und dabei gestikulieren",
    "Zur Seite drehen und zurückblicken",
    "Langsam näher kommen",
    "Winken und grüßen"
  ]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  // Custom Prompt AI Chat state
  const [customPromptVersions, setCustomPromptVersions] = useState<string[]>([]);
  const [currentCustomPromptIndex, setCurrentCustomPromptIndex] = useState(0);
  const [customPromptChatInput, setCustomPromptChatInput] = useState("");
  const [isGeneratingCustomPrompt, setIsGeneratingCustomPrompt] = useState(false);

  // Main Tab state - only for FULL users
  const [activeMainTab, setActiveMainTab] = useState<"poses" | "story">("poses");

  // Story Builder state
  const [storyIdea, setStoryIdea] = useState("");
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(null);
  const [isAnimatingSuggestion, setIsAnimatingSuggestion] = useState(false);
  const [storySuggestions, setStorySuggestions] = useState<string[]>([
    "Ein Influencer entdeckt ein magisches Café, das Wünsche erfüllt.",
    "Zwei Fremde treffen sich jeden Tag am selben Ort, ohne ein Wort zu wechseln.",
    "Ein verlorener Brief führt zu einer unerwarteten Freundschaft."
  ]);
  const [isLoadingStorySuggestions, setIsLoadingStorySuggestions] = useState(false);
  const [storyReferenceImages, setStoryReferenceImages] = useState<string[]>(() => {
    const saved = getFromLocalStorage('storyReferenceImages');
    return saved || [];
  });
  
  // Storyboard state
  const [storyPointCount, setStoryPointCount] = useState(4);
  const [storyPoints, setStoryPoints] = useState<Array<{
    versions: string[];
    currentVersion: number;
  }>>([]);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [regeneratingPointIndex, setRegeneratingPointIndex] = useState<number | null>(null);
  const [expandedStoryPointIndex, setExpandedStoryPointIndex] = useState<number | null>(null);
  const [expandedCardRect, setExpandedCardRect] = useState<DOMRect | null>(null);
  const [isAnimatingExpand, setIsAnimatingExpand] = useState(false);
  const [isAnimatingClose, setIsAnimatingClose] = useState(false);
  const storyCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleCloseExpandedCard = () => {
    if (isAnimatingClose || expandedStoryPointIndex === null) return;
    
    // Get the current position of the original card (in case user scrolled)
    const currentRect = storyCardRefs.current[expandedStoryPointIndex]?.getBoundingClientRect();
    if (currentRect) {
      setExpandedCardRect(currentRect);
    }
    
    setIsAnimatingClose(true);
    setTimeout(() => {
      setExpandedStoryPointIndex(null);
      setExpandedCardRect(null);
      setIsAnimatingClose(false);
    }, 500);
  };

  const handleStoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const maxImages = 3;
      const filesToProcess = Array.from(files).slice(0, maxImages - storyReferenceImages.length);
      
      const newImages: string[] = [];
      for (const file of filesToProcess) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        newImages.push(base64);
      }
      
      setStoryReferenceImages(prev => {
        const updated = [...prev, ...newImages].slice(0, maxImages);
        saveToLocalStorage('storyReferenceImages', updated);
        return updated;
      });
    }
    e.target.value = "";
  };

  const removeStoryImage = (index: number) => {
    setStoryReferenceImages(prev => {
      const updated = prev.filter((_, i) => i !== index);
      saveToLocalStorage('storyReferenceImages', updated);
      return updated;
    });
  };

  const generateStoryboard = async () => {
    if (!apiKey || !storyIdea.trim() || isGeneratingStoryboard) return;
    
    setIsGeneratingStoryboard(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Basierend auf dieser Story-Idee: "${storyIdea}"

Generiere genau ${storyPointCount} aufeinanderfolgende Story-Punkte für ein Storyboard. Jeder Punkt soll eine Szene beschreiben, die als Bild umgesetzt werden kann.

Jeder Story-Punkt soll:
- 1-2 Sätze lang sein
- Eine klare visuelle Szene beschreiben
- Logisch auf den vorherigen Punkt aufbauen

Antworte NUR mit den ${storyPointCount} Story-Punkten, einer pro Zeile, ohne Nummerierung. Auf Deutsch.`
              }]
            }]
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const points = text.split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 5)
            .slice(0, storyPointCount);
          
          setStoryPoints(points.map((point: string) => ({
            versions: [point],
            currentVersion: 0
          })));
        }
      }
    } catch (error) {
      console.error("Failed to generate storyboard:", error);
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  const regenerateStoryPoint = async (index: number) => {
    if (!apiKey || regeneratingPointIndex !== null) return;
    
    setRegeneratingPointIndex(index);
    try {
      const currentPoint = storyPoints[index].versions[storyPoints[index].currentVersion];
      const prevPoint = index > 0 ? storyPoints[index - 1].versions[storyPoints[index - 1].currentVersion] : null;
      const nextPoint = index < storyPoints.length - 1 ? storyPoints[index + 1].versions[storyPoints[index + 1].currentVersion] : null;
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Story-Idee: "${storyIdea}"

Generiere eine NEUE Alternative für diesen Story-Punkt (Punkt ${index + 1} von ${storyPoints.length}):
"${currentPoint}"

${prevPoint ? `Vorheriger Punkt: "${prevPoint}"` : "Dies ist der erste Punkt."}
${nextPoint ? `Nächster Punkt: "${nextPoint}"` : "Dies ist der letzte Punkt."}

Die neue Version soll:
- 1-2 Sätze lang sein
- Eine andere Perspektive oder Variation der Szene zeigen
- Trotzdem logisch in die Geschichte passen

Antworte NUR mit dem neuen Story-Punkt, ohne Erklärung. Auf Deutsch.`
              }]
            }]
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          setStoryPoints(prev => prev.map((point, i) => {
            if (i === index) {
              return {
                versions: [...point.versions, text],
                currentVersion: point.versions.length
              };
            }
            return point;
          }));
        }
      }
    } catch (error) {
      console.error("Failed to regenerate story point:", error);
    } finally {
      setRegeneratingPointIndex(null);
    }
  };

  const navigateStoryPointVersion = (pointIndex: number, direction: 'prev' | 'next') => {
    setStoryPoints(prev => prev.map((point, i) => {
      if (i === pointIndex) {
        const newVersion = direction === 'prev' 
          ? Math.max(0, point.currentVersion - 1)
          : Math.min(point.versions.length - 1, point.currentVersion + 1);
        return { ...point, currentVersion: newVersion };
      }
      return point;
    }));
  };

  const handleSuggestionClick = (suggestion: string, index: number) => {
    setSelectedSuggestionIndex(index);
    setIsAnimatingSuggestion(true);
    
    // After animation completes, set the actual value
    setTimeout(() => {
      setStoryIdea(suggestion);
      setSelectedSuggestionIndex(null);
      setIsAnimatingSuggestion(false);
    }, 400);
  };

  // Generate AI story suggestions on mount
  const generateStorySuggestions = async (key: string) => {
    if (!key || isLoadingStorySuggestions) return;
    
    setIsLoadingStorySuggestions(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Generiere genau 3 kreative, kurze Story-Ideen für Bilder. Jede Idee soll EIN SATZ sein, interessant und visuell umsetzbar.

Beispiele für gute Ideen:
- "Ein Influencer entdeckt ein magisches Café, das Wünsche erfüllt."
- "Zwei Fremde treffen sich jeden Tag am selben Ort, ohne ein Wort zu wechseln."

Antworte NUR mit den 3 Ideen, eine pro Zeile, ohne Nummerierung oder Aufzählungszeichen. Auf Deutsch.`
              }]
            }]
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const ideas = text.split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 10)
            .slice(0, 3);
          
          if (ideas.length === 3) {
            setStorySuggestions(ideas);
          }
        }
      }
    } catch (error) {
      console.error("Failed to generate story suggestions:", error);
    } finally {
      setIsLoadingStorySuggestions(false);
    }
  };

  // Generate suggestions when API key becomes available (preload for story tab)
  useEffect(() => {
    if (apiKey && authData.planCode === "FULL") {
      generateStorySuggestions(apiKey);
    }
  }, [apiKey, authData.planCode]);

  // Keep ref in sync with state to avoid stale closures
  useEffect(() => {
    referenceImagesRef.current = referenceImages;
  }, [referenceImages]);

  // Helper function to safely update image slots
  const updateSlotSafe = (index: number, update: Partial<ImageSlotData> | ((slot: ImageSlotData) => ImageSlotData)) => {
    setImageSlots((prev) => {
      if (index >= prev.length) {
        console.warn(`updateSlotSafe: Index ${index} out of bounds, length: ${prev.length}`);
        return prev;
      }
      const updated = [...prev];
      if (typeof update === 'function') {
        updated[index] = update(updated[index]);
      } else {
        updated[index] = { ...updated[index], ...update };
      }
      return updated;
    });
  };

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

  // Cleanup blob URLs when component unmounts or slots change
  useEffect(() => {
    return () => {
      // Revoke all blob URLs on unmount to prevent memory leaks
      imageSlots.forEach(slot => {
        if (slot?.imageUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(slot.imageUrl);
        }
      });
    };
  }, []);

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
        // Get skin type description for Pro users
        const skinOption = isPro ? SKIN_OPTIONS.find(s => s.id === selectedSkinType) : null;
        const skinText = skinOption ? `- Skin appearance: ${skinOption.description}` : "";
        
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
${skinText}
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
      
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
      
      // Call Google Gemini API directly with ALL reference images
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
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

      clearTimeout(timeoutId);

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
          
          updateSlotSafe(index, { 
            status: "loading", 
            progress: 30,
            retrying: true 
          });
          
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          return generateSingleImage(index, apiKey, base64Images, background, numberOfImages, selectedFormat, selectedShot, customPromptText, angle, retryCount + 1);
        } else if (retryCount === MAX_RETRIES && !useSimplifiedPrompt) {
          // Final attempt with simplified prompt
          console.log(`🔄 Final attempt for image ${index + 1} with simplified prompt...`);
          
          updateSlotSafe(index, { 
            status: "loading", 
            progress: 40,
            retrying: true 
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
        updateSlotSafe(index, { 
          status: "loading", 
          progress: 30,
          retrying: true 
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return generateSingleImage(index, apiKey, base64Images, background, numberOfImages, selectedFormat, selectedShot, customPromptText, angle, retryCount + 1);
      } else if (retryCount === MAX_RETRIES && !useSimplifiedPrompt) {
        // Final attempt with simplified prompt
        console.log(`🔄 Final attempt for image ${index + 1} with simplified prompt...`);
        
        updateSlotSafe(index, { 
          status: "loading", 
          progress: 40,
          retrying: true 
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
        updateSlotSafe(index, { 
          status: "loading", 
          progress: 30,
          retrying: true 
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return generateSingleImage(index, apiKey, base64Images, background, numberOfImages, selectedFormat, selectedShot, customPromptText, angle, retryCount + 1);
      } else if (retryCount === MAX_RETRIES && !useSimplifiedPrompt) {
        // Final attempt with simplified prompt
        console.log(`🔄 Final attempt for image ${index + 1} with simplified prompt after error...`);
        
        updateSlotSafe(index, { 
          status: "loading", 
          progress: 40,
          retrying: true 
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
    
    const CONCURRENT_REQUESTS = isPro ? 2 : 1;
    const angles = ["front", "front-right", "right", "back-right", "back", "back-left", "left", "front-left"];

    console.log("🔄 Starte while-Schleife...");
    while (generationQueueRef.current.length > 0 && isGeneratingRef.current) {
      console.log("🔄 While-Iteration startet, Queue:", generationQueueRef.current.length);
      const batch = generationQueueRef.current.splice(0, CONCURRENT_REQUESTS);
      console.log("🔄 Batch erstellt:", batch);
      
      await Promise.all(
        batch.map(async (index) => {
          console.log(`🎨 Starte Generierung für Index ${index}`);
          // Update to loading - ensure index exists
          setImageSlots((prev) => {
            const updated = [...prev];
            // Safety check: ensure index is valid
            if (index >= updated.length) {
              console.warn(`Index ${index} out of bounds, current length: ${updated.length}`);
              return prev;
            }
            updated[index] = { status: "loading", progress: 0 };
            return updated;
          });

          // Simulate progress - declare outside try for cleanup in finally
          const progressInterval = setInterval(() => {
            setImageSlots((prev) => {
              const updated = [...prev];
              // Safety check: ensure index is valid
              if (index >= updated.length || updated[index]?.status !== "loading") {
                return prev;
              }
              updated[index] = { 
                ...updated[index],
                progress: Math.min((updated[index].progress || 0) + 10, 90) 
              };
              return updated;
            });
          }, 500);

          try {
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

            // Update with result - ensure index exists
            setImageSlots((prev) => {
              const updated = [...prev];
              // Safety check: ensure index is valid
              if (index >= updated.length) {
                console.warn(`Index ${index} out of bounds after generation, current length: ${updated.length}`);
                return prev;
              }
              if (imageUrl) {
                updated[index] = { status: "completed", imageUrl, progress: 100 };
              } else {
                updated[index] = { status: "error", progress: 0 };
              }
              return updated;
            });
          } catch (error) {
            console.error(`❌ Error in processQueue for index ${index}:`, error);
            setImageSlots((prev) => {
              const updated = [...prev];
              if (index < updated.length) {
                updated[index] = { status: "error", progress: 0 };
              }
              return updated;
            });
          } finally {
            // CRITICAL: Always clear interval to prevent memory leaks and crashes
            clearInterval(progressInterval);
          }
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
      // Use ref to get current images (avoids stale closure issues)
      const currentImages = referenceImagesRef.current;
      
      // Convert images to base64
      const imagePromises = currentImages.map((file) => {
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

    const currentLength = imageSlots.length;
    const newCount = imageCount[0];
    
    // Add new pending slots to existing ones FIRST and wait for state update
    const newSlots: ImageSlotData[] = Array(newCount).fill(null).map(() => ({
      status: "pending" as const,
      progress: 0,
    }));
    
    // Use a promise to ensure state is updated before continuing
    await new Promise<void>((resolve) => {
      setImageSlots(prev => {
        const updated = [...prev, ...newSlots];
        // Schedule resolve after state update
        setTimeout(resolve, 0);
        return updated;
      });
    });
    
    // Add new indices to the queue
    const newIndices = Array.from({ length: newCount }, (_, i) => currentLength + i);
    generationQueueRef.current = [...generationQueueRef.current, ...newIndices];
    
    // If already generating, the existing processQueue loop will pick up new items
    if (isGenerating) {
      toast({
        title: "Zur Warteschlange hinzugefügt",
        description: `${newCount} ${newCount === 1 ? 'Bild wird' : 'Bilder werden'} generiert`,
      });
      return;
    }
    
    setIsGenerating(true);
    isGeneratingRef.current = true;

    try {
      // Use ref to get current images (avoids stale closure issues)
      const currentImages = referenceImagesRef.current;
      
      // Convert images to base64
      const imagePromises = currentImages.map((file) => {
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

    // Capture the index before state update and use ref to track it
    let capturedIndex = -1;
    
    // Use promise to ensure we get the correct index
    await new Promise<void>((resolve) => {
      setImageSlots((prev) => {
        capturedIndex = prev.length;
        return [...prev, { status: "loading", progress: 0 }];
      });
      // Give React time to process the state update
      setTimeout(resolve, 0);
    });
    
    const newIndex = capturedIndex;
    if (newIndex < 0) {
      console.error("Failed to get valid index for custom prompt");
      return;
    }

    // Declare progressInterval outside try so we can clean it up in finally
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    
    try {
      progressInterval = setInterval(() => {
        setImageSlots((prev) => {
          // Safety check: ensure index is valid
          if (newIndex >= prev.length) return prev;
          const updated = [...prev];
          if (updated[newIndex]?.status === "loading") {
            updated[newIndex].progress = Math.min((updated[newIndex].progress || 0) + 10, 90);
          }
          return updated;
        });
      }, 500);

      // Use ref to get current images (avoids stale closure issues)
      const currentImages = referenceImagesRef.current;
      
      // Convert reference images to base64
      const imagePromises = currentImages.map((file) => {
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

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

      // Call Google Gemini API with ALL reference images
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
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

      clearTimeout(timeoutId);

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
          
          updateSlotSafe(newIndex, { status: "completed", imageUrl, progress: 100 });
          
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
      
      // Check if it was a timeout/abort error
      const errorMessage = error instanceof Error 
        ? (error.name === 'AbortError' ? 'Zeitüberschreitung - bitte versuche es erneut' : error.message)
        : "Ein Fehler ist aufgetreten";
      
      updateSlotSafe(newIndex, { status: "error", progress: 0 });
      toast({
        title: "Generierung fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      // CRITICAL: Always clear the progress interval to prevent memory leaks and crashes
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    }
  };

  const handleImageClick = (index: number) => {
    const slot = imageSlots[index];
    if (slot.status === "completed" && slot.imageUrl) {
      setSelectedImageIndex(index);
    }
  };

  const resizeImageForBasic = async (imageUrl: string, maxWidth: number = 512): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not available"));
          return;
        }

        // Calculate new dimensions maintaining aspect ratio
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = imageUrl;
    });
  };

  const handleDownloadSingle = async (index: number) => {
    const slot = imageSlots[index];
    if (slot.status === "completed" && slot.imageUrl) {
      const link = document.createElement("a");
      
      // Basic users get lower resolution (512px width)
      if (!isPro) {
        try {
          const resizedUrl = await resizeImageForBasic(slot.imageUrl, 512);
          link.href = resizedUrl;
        } catch (error) {
          console.error("Resize failed, using original:", error);
          link.href = slot.imageUrl;
        }
      } else {
        link.href = slot.imageUrl;
      }
      
      link.download = `character-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDeleteImage = (index: number) => {
    // Close dialog if deleted image was selected
    if (selectedImageIndex === index) {
      setSelectedImageIndex(null);
    } else if (selectedImageIndex !== null && selectedImageIndex > index) {
      // Adjust selected index if it comes after deleted image
      setSelectedImageIndex(selectedImageIndex - 1);
    }
    
    // Revoke blob URL to prevent memory leak
    const slot = imageSlots[index];
    if (slot?.imageUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(slot.imageUrl);
    }
    
    setImageSlots((prev) => prev.filter((_, i) => i !== index));
    toast({
      title: "Bild gelöscht",
      description: `Bild #${index + 1} wurde erfolgreich gelöscht`,
    });
  };

  // Remove image from queue (for pending images only)
  const handleRemoveFromQueue = (index: number) => {
    const slot = imageSlots[index];
    if (slot?.status !== "pending") return;
    
    // Remove from generation queue
    const queueIndex = generationQueueRef.current.indexOf(index);
    if (queueIndex > -1) {
      generationQueueRef.current.splice(queueIndex, 1);
    }
    
    // Update queue indices after removal
    generationQueueRef.current = generationQueueRef.current.map(i => i > index ? i - 1 : i);
    
    // Close viewer if viewing this image
    if (selectedImageIndex === index) {
      setSelectedImageIndex(null);
    } else if (selectedImageIndex !== null && selectedImageIndex > index) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
    
    setImageSlots((prev) => prev.filter((_, i) => i !== index));
    toast({
      title: "Aus Warteschlange entfernt",
      description: `Bild #${index + 1} wurde aus der Warteschlange entfernt`,
    });
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (selectedImageIndex === null) return;
    
    // Find next/previous completed image
    const findNextCompleted = (startIdx: number, dir: 1 | -1): number | null => {
      let idx = startIdx + dir;
      while (idx >= 0 && idx < imageSlots.length) {
        if (imageSlots[idx]?.status === "completed" && imageSlots[idx]?.imageUrl) {
          return idx;
        }
        idx += dir;
      }
      return null;
    };
    
    if (direction === 'prev') {
      const prevIdx = findNextCompleted(selectedImageIndex, -1);
      if (prevIdx !== null) setSelectedImageIndex(prevIdx);
    } else {
      const nextIdx = findNextCompleted(selectedImageIndex, 1);
      if (nextIdx !== null) setSelectedImageIndex(nextIdx);
    }
  };

  // Reset zoom when changing images
  const handleSelectImage = (index: number) => {
    setSelectedImageIndex(index);
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const handleImageWheel = (e: React.WheelEvent<HTMLImageElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    // Mouse position relative to image center in pixels
    const mouseXPx = e.clientX - (rect.left + rect.width / 2);
    const mouseYPx = e.clientY - (rect.top + rect.height / 2);
    
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    const newZoom = Math.min(Math.max(imageZoom + delta, 1), 4);
    
    if (newZoom === 1) {
      setImagePosition({ x: 0, y: 0 });
    } else {
      // To keep the point under cursor fixed:
      // newPos = oldPos + mousePos * (1/newZoom - 1/oldZoom) * zoom
      // Simplified: scale the difference based on zoom change
      const zoomRatio = newZoom / imageZoom;
      
      setImagePosition(prev => ({
        x: prev.x * zoomRatio + (mouseXPx / rect.width * 100) * (1 - zoomRatio),
        y: prev.y * zoomRatio + (mouseYPx / rect.height * 100) * (1 - zoomRatio)
      }));
    }
    
    setImageZoom(newZoom);
  };

  const handleImageMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (imageZoom <= 1) return;
    e.preventDefault();
    setIsDraggingImage(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (imageZoom <= 1 || !isDraggingImage) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    // Scale drag speed with zoom level so it feels consistent
    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100 * imageZoom;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100 * imageZoom;
    
    const maxOffset = (imageZoom - 1) * 50;
    setImagePosition(prev => ({
      x: Math.max(-maxOffset, Math.min(maxOffset, prev.x + deltaX)),
      y: Math.max(-maxOffset, Math.min(maxOffset, prev.y + deltaY))
    }));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleImageMouseUp = () => {
    setIsDraggingImage(false);
  };

  const handleImageMouseLeave = () => {
    setIsDraggingImage(false);
  };

  // Reset video prompt when changing images
  useEffect(() => {
    setAllVideoPrompts([]);
    setCurrentPromptIndex(0);
    setPromptChatInput("");
  }, [selectedImageIndex]);

  // Get current prompt from array
  const currentVideoPrompt = allVideoPrompts[currentPromptIndex] || "";

  const updateCurrentPrompt = (newPrompt: string) => {
    setAllVideoPrompts(prev => {
      const updated = [...prev];
      updated[currentPromptIndex] = newPrompt;
      return updated;
    });
  };

  const handleGenerateVideoPrompt = async () => {
    if (!apiKey) {
      toast({
        title: "API Key erforderlich",
        description: "Bitte gib deinen Google Gemini API Key ein",
        variant: "destructive",
      });
      return;
    }

    if (selectedImageIndex === null || !imageSlots[selectedImageIndex]?.imageUrl) {
      toast({
        title: "Kein Bild ausgewählt",
        description: "Bitte wähle ein Bild aus",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingVideoPrompt(true);

    try {
      // Get the image as base64
      const imageUrl = imageSlots[selectedImageIndex].imageUrl;
      
      let blob: Blob;
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error("Bild nicht mehr verfügbar");
        }
        blob = await response.blob();
      } catch (fetchError) {
        toast({
          title: "Bild nicht verfügbar",
          description: "Das Bild ist nicht mehr verfügbar. Bitte generiere es erneut oder wähle ein anderes Bild.",
          variant: "destructive",
        });
        setIsGeneratingVideoPrompt(false);
        return;
      }
      
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result);
        };
        reader.readAsDataURL(blob);
      });

      // Call Gemini to analyze the image and generate a video prompt
      const generateResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
                    text: `Analysiere dieses Bild sehr genau und erstelle einen DETAILLIERTEN, kreativen Prompt für eine Video-Animation. 

Beschreibe AUSFÜHRLICH:
1. Die genaue Bewegung der Person (Kopf, Arme, Körper, Mimik)
2. Die Geschwindigkeit und Art der Bewegung (langsam, fließend, dynamisch)
3. Details wie Haarbewegung, Kleidungsbewegung, Lichtveränderungen
4. Die Stimmung und Atmosphäre der Animation
5. Kamerabewegung oder -perspektive wenn passend

Beispiele für gute, detaillierte Prompts:
- "Die Person dreht langsam und elegant den Kopf nach links, während ein sanftes Lächeln über ihr Gesicht gleitet. Die Haare bewegen sich weich im Wind, einzelne Strähnen fallen natürlich ins Gesicht. Die Augen blinzeln langsam und verträumt, während das warme Licht über die Haut wandert."
- "Sanfte, fließende Bewegung: Die Person hebt langsam die Hand zur Begrüßung, die Finger spreizen sich elegant. Der Kopf neigt sich leicht zur Seite mit einem warmen, einladenden Lächeln. Die Kleidung bewegt sich subtil, als würde ein leichter Wind wehen."

Antworte NUR mit dem Prompt, ohne zusätzliche Erklärungen. Der Prompt sollte auf Deutsch sein und 3-5 Sätze lang sein mit vielen Details.`
                  },
                  {
                    inlineData: {
                      mimeType: blob.type || "image/png",
                      data: base64.split(",")[1]
                    }
                  }
                ]
              }
            ]
          }),
        }
      );

      if (!generateResponse.ok) {
        const errorData = await generateResponse.json();
        throw new Error(errorData.error?.message || "Prompt-Generierung fehlgeschlagen");
      }

      const generateData = await generateResponse.json();
      const generatedPrompt = generateData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!generatedPrompt) {
        throw new Error("Kein Prompt generiert");
      }

      const newPrompt = generatedPrompt.trim();
      // Add to array and navigate to it
      setAllVideoPrompts(prev => [...prev, newPrompt]);
      setCurrentPromptIndex(allVideoPrompts.length); // Will be the new last index
      setSelectedSuggestions(new Set());
      
      // Generate new AI suggestions based on the generated prompt
      generateNewAiSuggestions(newPrompt);
      
      toast({
        title: "Video-Prompt generiert!",
        description: `Prompt ${allVideoPrompts.length + 1} erstellt`,
      });
    } catch (error) {
      console.error("Video prompt generation error:", error);
      toast({
        title: "Prompt-Generierung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingVideoPrompt(false);
    }
  };

  const generateNewAiSuggestions = async (contextPrompt: string) => {
    if (!apiKey) return;
    
    setIsGeneratingSuggestions(true);
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
                    text: `Basierend auf diesem Video-Prompt:
"${contextPrompt}"

Generiere 5 kurze, kreative Vorschläge für Variationen oder Erweiterungen dieses Video-Prompts.
Jeder Vorschlag sollte eine andere Bewegung, Emotion oder Kamera-Aktion beschreiben.
Die Vorschläge sollten kurz sein (max 6-8 Wörter) und auf Deutsch.

Antworte NUR mit den 5 Vorschlägen, einer pro Zeile, ohne Nummerierung oder zusätzliche Erklärungen.`
                  }
                ]
              }
            ]
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const suggestionsText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        
        if (suggestionsText) {
          const newSuggestions = suggestionsText
            .split('\n')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0 && s.length < 50)
            .slice(0, 5);
          
          if (newSuggestions.length > 0) {
            setAiSuggestions(newSuggestions);
            setSelectedSuggestions(new Set());
          }
        }
      }
    } catch (error) {
      console.error("Failed to generate suggestions:", error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const toggleSuggestion = (suggestion: string) => {
    setSelectedSuggestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(suggestion)) {
        newSet.delete(suggestion);
      } else {
        newSet.add(suggestion);
      }
      
      // Update promptChatInput based on selected suggestions
      const allSelected = Array.from(newSet);
      setPromptChatInput(allSelected.join(", "));
      
      return newSet;
    });
  };

  const handleEditPromptWithAI = async () => {
    if (!apiKey || !promptChatInput.trim() || !currentVideoPrompt) return;

    setIsEditingPrompt(true);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
                    text: `Du bist ein Experte für detaillierte Video-Animation-Prompts.

Aktueller Video-Prompt:
"${currentVideoPrompt}"

Der Nutzer möchte folgende Änderung/Ergänzung:
"${promptChatInput}"

Bearbeite den Video-Prompt entsprechend und mache ihn SEHR DETAILLIERT. Der neue Prompt soll:
- Die gewünschten Änderungen vollständig integrieren
- DETAILLIERT beschreiben: Bewegungen, Geschwindigkeit, Mimik, Atmosphäre
- Spezifische Details zu Körperbewegung, Haaren, Kleidung, Licht enthalten
- Als professioneller Video-Animation-Prompt geeignet sein
- 3-5 Sätze lang sein mit vielen konkreten Details
- Auf Deutsch sein

Antworte NUR mit dem neuen, detaillierten Prompt, ohne zusätzliche Erklärungen.`
                  }
                ]
              }
            ]
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Bearbeitung fehlgeschlagen");
      }

      const data = await response.json();
      const newPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!newPrompt) {
        throw new Error("Keine Antwort erhalten");
      }

      // Add as new prompt and navigate to it
      setAllVideoPrompts(prev => [...prev, newPrompt]);
      setCurrentPromptIndex(allVideoPrompts.length);
      setPromptChatInput("");
      setSelectedSuggestions(new Set());
      
      // Generate new AI suggestions based on the new prompt
      generateNewAiSuggestions(newPrompt);
      
      toast({
        title: "Neuer Prompt erstellt!",
        description: `Prompt ${allVideoPrompts.length + 1}`,
      });
    } catch (error) {
      console.error("Edit prompt error:", error);
      toast({
        title: "Bearbeitung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setIsEditingPrompt(false);
    }
  };

  const navigatePrompt = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentPromptIndex > 0) {
      setCurrentPromptIndex(prev => prev - 1);
    } else if (direction === 'next' && currentPromptIndex < allVideoPrompts.length - 1) {
      setCurrentPromptIndex(prev => prev + 1);
    }
  };

  // Custom Prompt AI Generation
  const handleGenerateCustomPromptWithAI = async () => {
    if (!apiKey) {
      toast({
        title: "API Key erforderlich",
        description: "Bitte gib deinen Google Gemini API Key ein",
        variant: "destructive",
      });
      return;
    }

    if (!customPromptChatInput.trim()) {
      toast({
        title: "Eingabe erforderlich",
        description: "Bitte beschreibe, was du generieren möchtest",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingCustomPrompt(true);

    try {
      // Build context from selected options
      const backgroundLabel = BACKGROUND_OPTIONS.find(b => b.id === selectedBackground)?.label || "Weißer Hintergrund";
      const shotLabel = SHOT_OPTIONS.find(s => s.id === selectedShot)?.label || "Ganzkörper";
      const formatLabel = FORMAT_OPTIONS.find(f => f.id === selectedFormat)?.label || "Quadratisch";
      const skinLabel = isPro ? (SKIN_OPTIONS.find(s => s.id === selectedSkinType)?.label || "") : "";
      
      let backgroundContext = "";
      if (selectedBackground === "white") {
        backgroundContext = "WICHTIG: Der Hintergrund ist WEISS/neutral - erwähne KEINE Umgebung, Stadt, Natur oder Szenerien. Fokussiere nur auf die Person, Pose und Ausdruck.";
      } else if (selectedBackground === "greenscreen") {
        backgroundContext = "WICHTIG: Der Hintergrund ist ein GREEN SCREEN - erwähne KEINE spezifische Umgebung. Fokussiere nur auf die Person, Pose und Ausdruck.";
      } else if (selectedBackground === "scenery") {
        backgroundContext = sceneDescription 
          ? `Der Hintergrund soll "${sceneDescription}" sein. Integriere diese Umgebung passend in den Prompt.`
          : "Der Hintergrund kann eine passende Szene sein, die die KI wählt.";
      }

      const settingsContext = `
AKTUELLE EINSTELLUNGEN (berücksichtige diese!):
- Hintergrund: ${backgroundLabel}
- Aufnahme-Typ: ${shotLabel}
- Bildformat: ${formatLabel}
${skinLabel ? `- Hauttyp: ${skinLabel}` : ""}

${backgroundContext}`;

      const existingPromptContext = customPromptVersions.length > 0 
        ? `\n\nAktueller Prompt zur Referenz:\n"${customPromptVersions[currentCustomPromptIndex]}"\n\nVerbessere oder ergänze diesen basierend auf der Nutzer-Anfrage.`
        : "";

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
                    text: `Du bist ein Experte für Bild-Generierungs-Prompts.

WICHTIG: Erstelle einen Prompt basierend auf dieser Nutzer-Anfrage:
"${customPromptChatInput}"
${settingsContext}${existingPromptContext}

Regeln für den Prompt:
- Fokussiere dich GENAU auf das, was der Nutzer beschrieben hat
- Berücksichtige die oben genannten Einstellungen
- Beschreibe Pose, Ausdruck, Kleidung passend zur Anfrage und zum Aufnahme-Typ
- 2-4 Sätze auf Deutsch
- Nur der Prompt, keine Erklärungen`
                  }
                ]
              }
            ]
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Generierung fehlgeschlagen");
      }

      const data = await response.json();
      const newPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!newPrompt) {
        throw new Error("Keine Antwort erhalten");
      }

      // Add as new version and navigate to it
      setCustomPromptVersions(prev => [...prev, newPrompt]);
      setCurrentCustomPromptIndex(customPromptVersions.length);
      setCustomPrompt(newPrompt);
      // Don't clear the chat input so user can iterate
      
      toast({
        title: "Prompt generiert!",
        description: `Version ${customPromptVersions.length + 1} erstellt`,
      });
    } catch (error) {
      console.error("Custom prompt generation error:", error);
      toast({
        title: "Generierung fehlgeschlagen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingCustomPrompt(false);
    }
  };

  const navigateCustomPrompt = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentCustomPromptIndex > 0) {
      const newIndex = currentCustomPromptIndex - 1;
      setCurrentCustomPromptIndex(newIndex);
      setCustomPrompt(customPromptVersions[newIndex] || "");
    } else if (direction === 'next' && currentCustomPromptIndex < customPromptVersions.length - 1) {
      const newIndex = currentCustomPromptIndex + 1;
      setCurrentCustomPromptIndex(newIndex);
      setCustomPrompt(customPromptVersions[newIndex] || "");
    }
  };

  // Add a new empty prompt version
  const handleNewEmptyPrompt = () => {
    setCustomPromptVersions(prev => [...prev, ""]);
    setCurrentCustomPromptIndex(customPromptVersions.length);
    setCustomPrompt("");
  };

  // Sync customPrompt changes to versions array
  const handleCustomPromptChange = (value: string) => {
    setCustomPrompt(value);
    if (customPromptVersions.length > 0) {
      setCustomPromptVersions(prev => {
        const updated = [...prev];
        updated[currentCustomPromptIndex] = value;
        return updated;
      });
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
      const isBasic = !isPro;
      
      for (let i = 0; i < imageSlots.length; i++) {
        const slot = imageSlots[i];
        if (slot.status === "completed" && slot.imageUrl) {
          let imageData: Blob;
          
          if (isBasic) {
            // Basic users get lower resolution
            try {
              const resizedUrl = await resizeImageForBasic(slot.imageUrl, 512);
              const response = await fetch(resizedUrl);
              imageData = await response.blob();
            } catch (error) {
              console.error("Resize failed, using original:", error);
              const response = await fetch(slot.imageUrl);
              imageData = await response.blob();
            }
          } else {
            const response = await fetch(slot.imageUrl);
            imageData = await response.blob();
          }
          
          zip.file(`character-${i + 1}.png`, imageData);
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
        {/* Settings & Tutorial Buttons */}
        <div className="absolute top-6 right-6 flex flex-col gap-2">
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
                      {!isPro && (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {THEME_OPTIONS.map((option) => {
                        const isLocked = !isPro && option.id !== "neon";
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
                    {!isPro && (
                      <p className="text-xs text-muted-foreground">
                        Weitere Themes sind nur mit Pro verfügbar.
                      </p>
                    )}
                  </div>
                </div>

                {/* Rechtliches */}
                <div className="pt-6 border-t border-border">
                  <div className="space-y-3">
                    <Label>Rechtliches</Label>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      onClick={() => setLegalDialogOpen(true)}
                    >
                      <Scale className="w-4 h-4 mr-2" />
                      Impressum, Datenschutz & AGB
                    </Button>
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

              <LegalDialog 
                open={legalDialogOpen} 
                onOpenChange={setLegalDialogOpen} 
              />
            </SheetContent>
          </Sheet>
          
          {/* Tutorial Button - Only for FULL users */}
          {authData.planCode === "FULL" && (
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-full"
              onClick={() => setTutorialDialogOpen(true)}
            >
              <Video className="w-5 h-5" />
            </Button>
          )}
        </div>
        
        {/* Tutorial Videos Dialog */}
        <Dialog open={tutorialDialogOpen} onOpenChange={setTutorialDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-8">
            <div className="space-y-8 px-4">
              <div className="w-[85%] mx-auto">
                <h2 className="text-lg font-bold mb-3">Übersicht</h2>
                <div style={{ padding: "56.25% 0 0 0", position: "relative" }}>
                  <iframe 
                    src="https://player.vimeo.com/video/1152205989?badge=0&autopause=0&player_id=0&app_id=58479" 
                    frameBorder="0" 
                    allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" 
                    referrerPolicy="strict-origin-when-cross-origin" 
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} 
                    title="ACS Uebersicht Kaufversion"
                  />
                </div>
              </div>
              
              <div className="w-[85%] mx-auto">
                <h2 className="text-lg font-bold mb-3">Avatar Creator Studio - Alle Funktionen auf einen Blick</h2>
                <div style={{ padding: "56.25% 0 0 0", position: "relative" }}>
                  <iframe 
                    src="https://player.vimeo.com/video/1152205825?badge=0&autopause=0&player_id=0&app_id=58479" 
                    frameBorder="0" 
                    allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" 
                    referrerPolicy="strict-origin-when-cross-origin" 
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }} 
                    title="ACS komplette Anleitung Kaufversion"
                  />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
            {authData.planCode !== "FULL" && (
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
            )}
          </div>
          <p className="text-muted-foreground text-lg">
            Generiere vielfältige Character-Posen mit KI
          </p>
        </div>

        {/* Main Tab Navigation - Only for FULL users */}
        {authData.planCode === "FULL" && (
          <div className="mb-6 animate-fade-in" style={{ animationDelay: '100ms', animationDuration: '600ms', animationFillMode: 'both' }}>
            <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as "poses" | "story")} className="w-full">
              <TabsList className="w-fit bg-muted/50 backdrop-blur-sm">
                <TabsTrigger value="poses" className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Posen
                </TabsTrigger>
                <TabsTrigger value="story" className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Story Bilder
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Poses Tab Content - Shows for non-FULL users or when poses tab is active */}
        {(authData.planCode !== "FULL" || activeMainTab === "poses") && (
          <>
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
                    const maxAllowed = isPro ? 3 : 1;
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
                  <ReferenceImagePreview 
                    key={`ref-${file.name}-${index}`}
                    file={file}
                    index={index}
                    onRemove={removeImage}
                  />
                ))}
                {/* Show upload button based on plan limits */}
                {(() => {
                  const maxImages = isPro ? 3 : 1;
                  const canUpload = referenceImages.length < maxImages;
                  const isLockedSlot = referenceImages.length >= maxImages && referenceImages.length < 3 && !isPro;
                  
                  if (canUpload) {
                    return (
                      <label className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (!isPro && e.target.files && e.target.files.length > 1) {
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
                  const isLocked = isPremiumFeature && !isPro;
                  
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

            {/* Format, Shot Type, and Skin Type Selection */}
            <div className={`grid gap-4 ${isPro ? "grid-cols-3" : "grid-cols-2"}`}>
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

              {/* Skin Type Dropdown - Pro Only */}
              {isPro && (
                <div className="space-y-2">
                  <Label>Hauttyp</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {SKIN_OPTIONS.find(s => s.id === selectedSkinType)?.label || "Hauttyp wählen"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full bg-popover">
                      {SKIN_OPTIONS.map((skin) => (
                        <DropdownMenuItem
                          key={skin.id}
                          onClick={() => setSelectedSkinType(skin.id)}
                          className={selectedSkinType === skin.id ? "bg-accent" : ""}
                        >
                          {skin.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            {/* Image Count Slider */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="flex items-center gap-2">
                  Anzahl Bilder
                  {!isPro && (
                    <span className="text-xs text-muted-foreground">(max 6 für Basic)</span>
                  )}
                </Label>
                <span className="text-sm text-muted-foreground">{Math.floor(imageCount[0])} / 40</span>
              </div>
              <div className="relative">
                <Slider
                  value={imageCount}
                  onValueChange={(value) => {
                    const maxValue = !isPro ? 6 : 40;
                    setImageCount([Math.min(value[0], maxValue)]);
                  }}
                  min={1}
                  max={40}
                  step={1}
                  className="w-full relative z-10"
                  lockedStart={!isPro ? 6 : undefined}
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
                    className={`text-sm font-medium leading-none ${!isPro ? "text-muted-foreground" : "cursor-pointer"}`}
                  >
                    Custom Prompt verwenden
                  </Label>
                  {!isPro && (
                    <Lock className={`w-5 h-5 ${shakingElement === "customPrompt" ? "text-red-500" : "text-muted-foreground"} transition-colors`} />
                  )}
                </div>
                <div 
                  className="relative w-12 h-6 cursor-pointer"
                  onClick={() => {
                    if (!isPro) {
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
                  {isPro ? (
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

              {/* Custom Prompt Input with AI Chat - Smooth Collapsible */}
              <div 
                className={`grid transition-all duration-300 ease-in-out ${
                  useCustomPrompt ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="pt-2">
                    {/* Layout: Full plan gets AI Chat, others get simple prompt */}
                    <div className={`flex gap-3 items-stretch ${authData.planCode !== "FULL" ? "flex-col" : ""}`}>
                      {/* Left: Prompt Output */}
                      <div className="flex-1 flex flex-col">
                        {/* Header with Version Navigation */}
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="custom-prompt-input">Custom Image Prompt</Label>
                          {customPromptVersions.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => navigateCustomPrompt('prev')}
                                disabled={currentCustomPromptIndex === 0}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <span className="text-sm text-muted-foreground font-medium min-w-[40px] text-center">
                                {currentCustomPromptIndex + 1}/{customPromptVersions.length}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => navigateCustomPrompt('next')}
                                disabled={currentCustomPromptIndex === customPromptVersions.length - 1}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <Textarea
                          id="custom-prompt-input"
                          placeholder="Beschreibe eine bestimmte Pose oder Szene..."
                          value={customPrompt}
                          onChange={(e) => handleCustomPromptChange(e.target.value)}
                          className="flex-1 min-h-[120px] focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
                        />
                      </div>
                      
                      {/* Center: Generate Buttons - Only for FULL plan */}
                      {authData.planCode === "FULL" && (
                        <div className="flex flex-col gap-2 pt-7">
                          {/* Main button - transfers prompt to left */}
                          <Button
                            onClick={handleGenerateCustomPromptWithAI}
                            disabled={!apiKey || !customPromptChatInput.trim() || isGeneratingCustomPrompt}
                            className="w-10 flex-1 rounded-lg"
                            title="Prompt generieren und links einfügen"
                          >
                            {isGeneratingCustomPrompt ? (
                              <Sparkles className="w-5 h-5 animate-spin" />
                            ) : (
                              <ChevronLeft className="w-6 h-6" />
                            )}
                          </Button>
                          {/* Secondary button - new empty version */}
                          <Button
                            onClick={handleNewEmptyPrompt}
                            variant="secondary"
                            className="w-10 h-10 rounded-lg flex-shrink-0"
                            title="Neuen leeren Prompt erstellen"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                      
                      {/* Right: AI Chat Input - Only for FULL plan */}
                      {authData.planCode === "FULL" && (
                        <div className="flex-1 flex flex-col">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-muted-foreground" />
                            <Label className="text-muted-foreground">KI-Assistent</Label>
                          </div>
                          <div className="flex-1 p-3 rounded-lg border border-border/50 bg-muted/30">
                            <Textarea
                              placeholder="Beschreibe was du möchtest, z.B. 'Person sitzt auf einem Stuhl und lächelt'..."
                              value={customPromptChatInput}
                              onChange={(e) => setCustomPromptChatInput(e.target.value)}
                              className="h-full min-h-[100px] text-sm focus-visible:ring-0 focus-visible:ring-offset-0 resize-none bg-transparent border-0 p-0"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleGenerateCustomPromptWithAI();
                                }
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Generate Buttons */}
            <div className="flex gap-3 justify-between">
              {imageSlots.length === 0 ? (
                <Button
                  onClick={handleGenerate}
                  disabled={!apiKey || referenceImages.length === 0}
                  className="w-full bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Bilder generieren
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleGenerateMore}
                    disabled={!apiKey || referenceImages.length === 0}
                    className="flex-[2] bg-primary hover:bg-primary/90 animate-in slide-in-from-left-5"
                    size="lg"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    {isGenerating ? 'Bilder hinzufügen' : 'Bilder dazu generieren'}
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        disabled={!apiKey || referenceImages.length === 0}
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
            onRemoveFromQueue={handleRemoveFromQueue}
            isBasicPlan={!isPro}
            isGenerating={isGenerating}
            format={FORMAT_OPTIONS.find(f => f.id === selectedFormat)?.ratio || "1:1"}
          />
        </div>
          </>
        )}

        {/* Story Tab Content - Only for FULL users when story tab is active */}
        {authData.planCode === "FULL" && activeMainTab === "story" && (
          <Card 
            className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in"
            style={{ animationDelay: '150ms', animationDuration: '600ms', animationFillMode: 'both' }}
          >
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="story-idea">Deine Story-Idee</Label>
                <div className="relative">
                  <Textarea
                    id="story-idea"
                    placeholder=""
                    value={storyIdea}
                    onChange={(e) => setStoryIdea(e.target.value)}
                    className="min-h-[200px] resize-none"
                  />
                  
                  {/* Suggestions overlay - only when empty and not animating */}
                  {(!storyIdea || isAnimatingSuggestion) && (
                    <div className="absolute inset-0 p-3 pointer-events-none overflow-hidden">
                      <p className={`text-sm text-muted-foreground mb-4 transition-opacity duration-300 ${isAnimatingSuggestion ? 'opacity-0' : 'opacity-100'}`}>
                        Wähle eine Idee oder schreibe deine eigene...
                      </p>
                      <div className="relative pointer-events-auto">
                        {isLoadingStorySuggestions ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Generiere Ideen...</span>
                          </div>
                        ) : (
                          storySuggestions.map((suggestion, index) => {
                            const isSelected = selectedSuggestionIndex === index;
                            const isOther = selectedSuggestionIndex !== null && !isSelected;
                            
                            // Calculate how far up this item needs to move to reach position 0
                            // Each item is ~24px tall (text-sm + py-0.5), plus the header (~40px)
                            const moveUpDistance = isSelected ? (index * 24 + 40) : 0;
                            
                            return (
                              <p
                                key={index}
                                onClick={() => !isAnimatingSuggestion && handleSuggestionClick(suggestion, index)}
                                className={`text-sm cursor-pointer py-0.5 transition-all ease-out ${
                                  isSelected 
                                    ? 'text-foreground font-medium' 
                                    : isOther
                                      ? 'opacity-0'
                                      : 'text-foreground/70 hover:text-primary'
                                }`}
                                style={{
                                  transitionDuration: isSelected ? '350ms' : '200ms',
                                  transform: isSelected ? `translateY(-${moveUpDistance}px)` : 'translateY(0)',
                                }}
                              >
                                {isSelected ? suggestion : `• ${suggestion}`}
                              </p>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Character Reference Image Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Charakter Referenzbild
                  <span className="flex items-center gap-2 ml-1">
                    {[1, 2, 3].map((num) => {
                      const isFilled = num <= storyReferenceImages.length;
                      
                      return (
                        <span
                          key={num}
                          className="relative flex items-center justify-center w-4 h-4"
                        >
                          <span
                            className={`block w-3 h-3 rounded-full transition-all ${
                              isFilled
                                ? "bg-primary"
                                : "bg-muted-foreground/20 border border-muted-foreground/40"
                            }`}
                          />
                        </span>
                      );
                    })}
                  </span>
                </Label>
                <div className="flex flex-wrap gap-4">
                  {storyReferenceImages.map((imageUrl, index) => (
                    <div key={`story-ref-${index}`} className="relative w-24 h-24">
                      <img 
                        src={imageUrl} 
                        alt={`Referenz ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeStoryImage(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {storyReferenceImages.length < 3 && (
                    <label className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleStoryImageUpload}
                        className="hidden"
                      />
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </label>
                  )}
                </div>
              </div>

              {/* Storyboard Generator */}
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <Label>Storyboard generieren</Label>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{storyPointCount} Szenen</span>
                    <Slider
                      value={[storyPointCount]}
                      onValueChange={(value) => setStoryPointCount(Math.round(value[0]))}
                      min={2}
                      max={8}
                      step={1}
                      className="w-32"
                    />
                  </div>
                </div>
                <Button
                  onClick={generateStoryboard}
                  disabled={!storyIdea.trim() || isGeneratingStoryboard}
                  className="w-full"
                >
                  {isGeneratingStoryboard ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generiere Storyboard...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Storyboard generieren
                    </>
                  )}
                </Button>

{/* Story Points Display - Always visible container */}
                <div className="bg-gradient-to-br from-muted/40 to-muted/20 rounded-xl p-5 min-h-[160px] border border-border/40 shadow-inner">
                  {storyPoints.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[130px] text-muted-foreground gap-2">
                      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 opacity-50" />
                      </div>
                      <span className="text-sm">Generierte Szenen erscheinen hier...</span>
                    </div>
                  ) : (
                    <div className="relative">
                      <div 
                        id="story-points-scroll" 
                        className="flex gap-4 overflow-x-auto pb-3 px-6 scrollbar-thin scroll-smooth"
                        onWheel={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const container = e.currentTarget;
                          container.scrollBy({ left: e.deltaY * 2, behavior: 'smooth' });
                        }}
                        style={{ overscrollBehavior: 'contain' }}
                      >
                        {storyPoints.map((point, index) => (
                          <div 
                            key={index}
                            ref={(el) => { storyCardRefs.current[index] = el; }}
                            className="group bg-gradient-to-b from-background to-background/90 rounded-xl border border-border/40 shadow-lg overflow-hidden relative min-w-[300px] max-w-[340px] flex-shrink-0 hover:shadow-xl hover:border-primary/30 transition-all duration-300 animate-scale-in"
                            style={{ 
                              animationDelay: `${index * 100}ms`, 
                              animationFillMode: 'both',
                              visibility: (expandedStoryPointIndex === index && !isAnimatingClose) ? 'hidden' : 'visible'
                            }}
                          >
                            {/* Scene number header bar with controls */}
                            <div className="bg-muted/40 border-b border-border/30 px-4 py-2.5 flex items-center justify-between">
                              <span className="text-sm font-semibold text-foreground/80">Szene {index + 1}</span>
                              
                              <div className="flex items-center gap-1.5">
                                <div className="flex items-center bg-background/50 rounded-full px-2 py-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 rounded-full hover:bg-muted"
                                    onClick={() => navigateStoryPointVersion(index, 'prev')}
                                    disabled={point.currentVersion === 0}
                                  >
                                    <ChevronLeft className="w-3 h-3" />
                                  </Button>
                                  <span className="text-xs font-semibold min-w-[32px] text-center">
                                    {point.currentVersion + 1}/{point.versions.length}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 rounded-full hover:bg-muted"
                                    onClick={() => navigateStoryPointVersion(index, 'next')}
                                    disabled={point.currentVersion === point.versions.length - 1}
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                  </Button>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary"
                                  onClick={() => regenerateStoryPoint(index)}
                                  disabled={regeneratingPointIndex !== null}
                                >
                                  {regeneratingPointIndex === index ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary"
                                  onClick={() => {
                                    const rect = storyCardRefs.current[index]?.getBoundingClientRect();
                                    if (rect) {
                                      setExpandedCardRect(rect);
                                      setIsAnimatingExpand(true);
                                      setExpandedStoryPointIndex(index);
                                      // Trigger animation to center after a frame
                                      requestAnimationFrame(() => {
                                        requestAnimationFrame(() => {
                                          setIsAnimatingExpand(false);
                                        });
                                      });
                                    }
                                  }}
                                >
                                  <Scale className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Scene content - editable */}
                            <div className="p-2">
                              <div className="bg-muted/30 rounded-lg p-2 min-h-[200px]">
                                <Textarea
                                  value={point.versions[point.currentVersion]}
                                  onChange={(e) => {
                                    const newText = e.target.value;
                                    setStoryPoints(prev => prev.map((p, i) => {
                                      if (i === index) {
                                        const updatedVersions = [...p.versions];
                                        updatedVersions[p.currentVersion] = newText;
                                        return { ...p, versions: updatedVersions };
                                      }
                                      return p;
                                    }));
                                  }}
                                  className="text-[13px] leading-relaxed bg-transparent border-none resize-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[180px] overflow-hidden"
                                  placeholder="Szene beschreiben..."
                                  style={{ overflow: 'hidden' }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded Card Overlay - OUTSIDE the scroll container */}
                {expandedStoryPointIndex !== null && expandedCardRect && storyPoints[expandedStoryPointIndex] && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 ${isAnimatingClose ? 'animate-fade-out' : 'animate-fade-in'}`}
                      onClick={handleCloseExpandedCard}
                    />
                    
                    {/* Animated Card Clone */}
                    <div
                      className="fixed z-50 bg-gradient-to-b from-background to-background/90 rounded-xl border border-border/40 shadow-2xl overflow-hidden"
                      style={{
                        top: (isAnimatingExpand || isAnimatingClose) ? `${expandedCardRect.top}px` : '50%',
                        left: (isAnimatingExpand || isAnimatingClose) ? `${expandedCardRect.left}px` : '50%',
                        width: (isAnimatingExpand || isAnimatingClose) ? `${expandedCardRect.width}px` : '90%',
                        maxWidth: (isAnimatingExpand || isAnimatingClose) ? 'none' : '42rem',
                        height: (isAnimatingExpand || isAnimatingClose) ? `${expandedCardRect.height}px` : 'auto',
                        maxHeight: (isAnimatingExpand || isAnimatingClose) ? 'none' : '80vh',
                        transformOrigin: 'top left',
                        transform: (isAnimatingExpand || isAnimatingClose) ? 'translate(0, 0)' : 'translate(-50%, -50%)',
                        transition: 'top 0.5s cubic-bezier(0.4, 0, 0.2, 1), left 0.5s cubic-bezier(0.4, 0, 0.2, 1), width 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.5s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {/* Header */}
                      <div className="bg-muted/40 border-b border-border/30 px-5 py-3 flex items-center justify-between">
                        <span className="text-base font-semibold text-foreground/80">Szene {expandedStoryPointIndex + 1}</span>
                        
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center bg-background/50 rounded-full px-2 py-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full hover:bg-muted"
                              onClick={() => navigateStoryPointVersion(expandedStoryPointIndex, 'prev')}
                              disabled={storyPoints[expandedStoryPointIndex].currentVersion === 0}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm font-semibold min-w-[32px] text-center">
                              {storyPoints[expandedStoryPointIndex].currentVersion + 1}/{storyPoints[expandedStoryPointIndex].versions.length}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full hover:bg-muted"
                              onClick={() => navigateStoryPointVersion(expandedStoryPointIndex, 'next')}
                              disabled={storyPoints[expandedStoryPointIndex].currentVersion === storyPoints[expandedStoryPointIndex].versions.length - 1}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary"
                            onClick={() => regenerateStoryPoint(expandedStoryPointIndex)}
                            disabled={regeneratingPointIndex !== null}
                          >
                            {regeneratingPointIndex === expandedStoryPointIndex ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive"
                            onClick={handleCloseExpandedCard}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-4">
                        <div className="bg-muted/30 rounded-lg p-3 min-h-[300px]">
                          <Textarea
                            value={storyPoints[expandedStoryPointIndex].versions[storyPoints[expandedStoryPointIndex].currentVersion]}
                            onChange={(e) => {
                              const newText = e.target.value;
                              setStoryPoints(prev => prev.map((p, i) => {
                                if (i === expandedStoryPointIndex) {
                                  const updatedVersions = [...p.versions];
                                  updatedVersions[p.currentVersion] = newText;
                                  return { ...p, versions: updatedVersions };
                                }
                                return p;
                              }));
                            }}
                            className="text-base leading-relaxed bg-transparent border-none resize-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[280px]"
                            placeholder="Szene beschreiben..."
                          />
                        </div>
                        
                        {/* Expanded options */}
                        {!isAnimatingExpand && (
                          <div className="mt-4 p-4 border border-dashed border-border rounded-lg bg-muted/20 animate-fade-in">
                            <p className="text-sm text-muted-foreground text-center">
                              Weitere Optionen werden hier hinzugefügt...
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Image Viewer Dialog */}
        <Dialog open={selectedImageIndex !== null} onOpenChange={() => { setSelectedImageIndex(null); setImageZoom(1); setImagePosition({ x: 0, y: 0 }); }}>
          <DialogContent className="max-w-6xl w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] h-[90vh] max-h-[90vh] p-0 bg-background/95 backdrop-blur-sm border-border/50 flex flex-col overflow-hidden">
            {selectedImageIndex !== null && imageSlots[selectedImageIndex] && (
              <>
                {/* Header with counter and download */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    {imageSlots[selectedImageIndex].status === "completed" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDownloadSingle(selectedImageIndex)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    )}
                  </div>
                  <div className="bg-muted px-3 py-1 rounded-full">
                    <span className="text-sm font-medium">
                      {selectedImageIndex + 1} / {imageSlots.length}
                    </span>
                  </div>
                  <div className="w-[100px]" /> {/* Spacer for balance */}
                </div>

                {/* Main Image Area with Navigation and Side Panel */}
                <div className="flex-1 relative flex min-h-0 overflow-hidden">
                  {/* Image Area */}
                  <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden transition-all duration-300">
                    {/* Left Navigation */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/80 hover:bg-background shadow-md"
                      onClick={() => navigateImage('prev')}
                      disabled={selectedImageIndex === 0}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>

                    {/* Right Navigation */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/80 hover:bg-background shadow-md"
                      onClick={() => navigateImage('next')}
                      disabled={selectedImageIndex === imageSlots.length - 1}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>

                    {/* Image Display */}
                    <div className="w-full h-full flex items-center justify-center px-12 overflow-hidden">
                      {imageSlots[selectedImageIndex].status === "completed" && imageSlots[selectedImageIndex].imageUrl ? (
                        <img
                          src={imageSlots[selectedImageIndex].imageUrl}
                          alt={`Bild ${selectedImageIndex + 1}`}
                          className="max-w-full max-h-full object-contain rounded-lg shadow-lg select-none"
                          style={{
                            transform: `translate(${imagePosition.x}%, ${imagePosition.y}%) scale(${imageZoom})`,
                            cursor: imageZoom > 1 ? (isDraggingImage ? 'grabbing' : 'grab') : 'ns-resize',
                          }}
                          draggable={false}
                          onWheel={handleImageWheel}
                          onMouseDown={handleImageMouseDown}
                          onMouseMove={handleImageMouseMove}
                          onMouseUp={handleImageMouseUp}
                          onMouseLeave={handleImageMouseLeave}
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
                  </div>

                  {/* Video Prompt Side Panel - Only for Pro users */}
                  {isPro && imageSlots[selectedImageIndex]?.status === "completed" && imageSlots[selectedImageIndex]?.imageUrl && (
                    <div 
                      className={`flex-shrink-0 border-l border-border/50 bg-gradient-to-b from-card to-card/80 flex flex-col overflow-hidden transition-all duration-300 ease-out ${
                        videoPromptOpen ? 'w-64' : 'w-0 border-l-0'
                      }`}
                    >
                      <div className={`w-64 h-full flex flex-col ${videoPromptOpen ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}>
                        <div className="p-3 border-b border-border/30 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Video className="w-3.5 h-3.5" />
                            <span>Video-Prompt</span>
                            {allVideoPrompts.length > 0 && (
                              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                                {allVideoPrompts.length}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setVideoPromptOpen(false)}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-3">
                          <div className="flex flex-col gap-3">
                            {/* Navigation */}
                            {allVideoPrompts.length > 0 && (
                              <div className="flex items-center justify-center">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => navigatePrompt('prev')}
                                    disabled={currentPromptIndex === 0}
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </Button>
                                  <span className="text-xs font-medium text-muted-foreground min-w-[40px] text-center">
                                    {currentPromptIndex + 1}/{allVideoPrompts.length}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => navigatePrompt('next')}
                                    disabled={currentPromptIndex === allVideoPrompts.length - 1}
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {/* Content */}
                            {allVideoPrompts.length > 0 ? (
                              <>
                                {/* Editable Prompt Field */}
                                <Textarea
                                  value={currentVideoPrompt}
                                  onChange={(e) => updateCurrentPrompt(e.target.value)}
                                  className="min-h-[180px] text-xs resize-none flex-1"
                                  placeholder="Video-Prompt..."
                                />
                                
                                {/* Action Buttons */}
                                <div className="flex gap-2 justify-center">
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="text-xs h-8 px-4"
                                    onClick={() => {
                                      navigator.clipboard.writeText(currentVideoPrompt);
                                      toast({
                                        title: "Kopiert!",
                                      });
                                    }}
                                  >
                                    Kopieren
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-xs h-8 px-4"
                                    onClick={handleGenerateVideoPrompt}
                                    disabled={isGeneratingVideoPrompt}
                                  >
                                    {isGeneratingVideoPrompt ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      "+ Neu"
                                    )}
                                  </Button>
                                </div>
                                
                                {/* AI Edit Chat */}
                                <div className="flex flex-col gap-2">
                                  {isEditingPrompt && (
                                    <div className="flex items-center justify-center gap-1.5 text-xs text-primary animate-pulse">
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      <span>KI schreibt...</span>
                                    </div>
                                  )}
                                  {!isEditingPrompt && (
                                    <div className="flex flex-col gap-1.5">
                                      <Textarea
                                        placeholder="Beschreibe was im Video passieren soll, z.B. 'Die Person lächelt und winkt in die Kamera'"
                                        value={promptChatInput}
                                        onChange={(e) => setPromptChatInput(e.target.value)}
                                        className="flex-1 text-xs min-h-[80px] resize-none"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey && promptChatInput.trim()) {
                                            e.preventDefault();
                                            handleEditPromptWithAI();
                                          }
                                        }}
                                      />
                                      <Button
                                        className="h-8 w-full"
                                        onClick={handleEditPromptWithAI}
                                        disabled={!promptChatInput.trim()}
                                      >
                                        <Send className="w-3.5 h-3.5 mr-2" />
                                        Prompt generieren
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                {/* Dynamic AI Suggestion Buttons */}
                                <div className="space-y-1.5 pt-2 border-t border-border/30">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                      Vorschläge {isGeneratingSuggestions && <Loader2 className="w-2.5 h-2.5 animate-spin inline ml-1" />}
                                    </Label>
                                    {selectedSuggestions.size > 0 && (
                                      <span className="text-[9px] text-primary">{selectedSuggestions.size} ausgewählt</span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {aiSuggestions.map((suggestion) => {
                                      const isSelected = selectedSuggestions.has(suggestion);
                                      return (
                                        <button
                                          key={suggestion}
                                          onClick={() => toggleSuggestion(suggestion)}
                                          className={`px-2 py-1 text-[10px] rounded-full border transition-all ${
                                            isSelected 
                                              ? 'bg-primary text-primary-foreground border-primary' 
                                              : 'bg-muted/50 border-border hover:bg-muted hover:border-primary/50'
                                          }`}
                                        >
                                          {suggestion}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Camera Style Suggestions */}
                                <div className="space-y-1.5 pt-2 border-t border-border/30">
                                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Kamera-Stil</Label>
                                  <div className="flex flex-wrap gap-1">
                                    {[
                                      { label: "Cinematic", prompt: "Cinematische Aufnahme mit langsamer Kamerabewegung" },
                                      { label: "Slow Motion", prompt: "Ultra Zeitlupe mit dramatischem Effekt" },
                                      { label: "Zoom-In", prompt: "Langsamer Zoom auf das Gesicht" },
                                      { label: "Orbit", prompt: "Kamera umkreist die Person langsam" },
                                      { label: "Dolly", prompt: "Kamera fährt langsam nach vorne" },
                                      { label: "Statisch", prompt: "Statische Kamera, nur Person bewegt sich" }
                                    ].map((style) => {
                                      const isSelected = selectedSuggestions.has(style.prompt);
                                      return (
                                        <button
                                          key={style.label}
                                          onClick={() => toggleSuggestion(style.prompt)}
                                          className={`px-2 py-1 text-[10px] rounded-full border transition-all ${
                                            isSelected 
                                              ? 'bg-primary text-primary-foreground border-primary' 
                                              : 'bg-secondary/50 border-border hover:bg-secondary hover:border-primary/50'
                                          }`}
                                        >
                                          {style.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Film Effect Suggestions */}
                                <div className="space-y-1.5 pt-2 border-t border-border/30">
                                  <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Film-Effekte</Label>
                                  <div className="flex flex-wrap gap-1">
                                    {[
                                      { label: "Dramatisch", prompt: "Dramatische Beleuchtung mit Schatten" },
                                      { label: "Weich", prompt: "Weiches, schmeichelhaftes Licht" },
                                      { label: "Golden Hour", prompt: "Warmes goldenes Sonnenlicht" },
                                      { label: "Noir", prompt: "Film Noir Stil mit hartem Kontrast" },
                                      { label: "Verträumt", prompt: "Verträumte, leicht unscharfe Atmosphäre" }
                                    ].map((effect) => {
                                      const isSelected = selectedSuggestions.has(effect.prompt);
                                      return (
                                        <button
                                          key={effect.label}
                                          onClick={() => toggleSuggestion(effect.prompt)}
                                          className={`px-2 py-1 text-[10px] rounded-full border transition-all ${
                                            isSelected 
                                              ? 'bg-primary text-primary-foreground border-primary' 
                                              : 'bg-accent/50 border-border hover:bg-accent hover:border-primary/50'
                                          }`}
                                        >
                                          {effect.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <Button
                                onClick={handleGenerateVideoPrompt}
                                disabled={isGeneratingVideoPrompt}
                                className="h-10 w-full"
                                variant="secondary"
                              >
                                {isGeneratingVideoPrompt ? (
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="animate-pulse text-xs">KI analysiert...</span>
                                  </div>
                                ) : (
                                  <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Prompt erstellen
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Video Prompt Toggle Tab - Only for Pro users */}
                  {isPro && imageSlots[selectedImageIndex]?.status === "completed" && imageSlots[selectedImageIndex]?.imageUrl && !videoPromptOpen && (
                    <button
                      onClick={() => setVideoPromptOpen(true)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-primary/90 hover:bg-primary text-primary-foreground px-1.5 py-4 rounded-l-lg shadow-lg transition-all hover:px-2 flex items-center gap-1"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <Video className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Thumbnail Strip */}
                <div className="border-t border-border/50 bg-muted/30 px-4 py-3">
                  <div className="flex gap-2 overflow-x-auto pb-1 justify-center">
                    {imageSlots.map((slot, index) => (
                      <button
                        key={index}
                        onClick={() => handleSelectImage(index)}
                        className={`relative flex-shrink-0 w-16 h-16 rounded-lg border-2 transition-all overflow-hidden ${
                          selectedImageIndex === index
                            ? "border-primary ring-2 ring-primary/30"
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
                            <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
                          </div>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-destructive/10">
                            <X className="w-4 h-4 text-destructive" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-background/90 text-center py-0.5">
                          <span className="text-[10px] font-medium">#{index + 1}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

              </>
            )}
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
