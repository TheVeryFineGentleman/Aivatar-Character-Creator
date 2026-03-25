import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

import { Sparkles, Upload, Image as ImageIcon, Download, ChevronLeft, ChevronRight, ChevronDown, X, Settings, RotateCcw, Plus, LogOut, Lock, Scale, Video, Loader2, Send, Undo2, Clock, Move, Zap, BookOpen, RefreshCw, Maximize2, MessageSquare, Check, Mountain, AlertCircle, Camera, ArrowRightLeft, ArrowLeft, User } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageGallery, ImageSlotData } from "@/components/ImageGallery";
import { DownloadButton } from "@/components/DownloadButton";
import sceneryBg from "@/assets/scenery-background.jpg";
import aivatarPromoImg from "@/assets/aivatar-academy-promo.jpg";
import JSZip from "jszip";
import { setCookie, getCookie, saveToLocalStorage, getFromLocalStorage, createManagedBlobUrl, revokeManagedBlobUrl, cleanupAllBlobUrls, getDetailedErrorMessage, checkBrowserCompatibility, getDeviceInfo, compressImageToFitSize } from "@/lib/storage";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, THEME_OPTIONS, ThemeVariant } from "@/hooks/useTheme";
import { LoginDialog } from "@/components/LoginDialog";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { DisclaimerPopup } from "@/components/DisclaimerPopup";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import PromoBanner from "@/components/PromoBanner";
import { ReferenceImagePreview } from "@/components/ReferenceImagePreview";
import { ImageDropZone } from "@/components/ImageDropZone";
import { LegalDialog } from "@/components/LegalDialog";
import { HomeScreen } from "@/components/HomeScreen";
import { CharacterCreator } from "@/components/CharacterCreator";
import { StoryDetailPopup } from "@/components/StoryDetailPopup";
import { VideoMerger } from "@/components/VideoMerger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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

// Robust JSON extraction from AI responses
function extractJsonFromAiResponse(text: string): any {
  let cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  const jsonStart = cleaned.search(/[\{\[]/);
  const isArray = jsonStart !== -1 && cleaned[jsonStart] === '[';
  const jsonEnd = cleaned.lastIndexOf(isArray ? ']' : '}');

  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    throw new Error("No JSON found in AI response");
  }

  cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/[\x00-\x1F\x7F]/g, '');
    return JSON.parse(cleaned);
  }
}

// Story Builder Setup Constants
const STORY_VIDEO_MODELS = [
  { id: "veo3", label: "Veo 3 (Standard)" },
  { id: "veo2", label: "Veo 2 (Schneller)" },
  { id: "kling", label: "Kling 1.6" },
];

const STORY_ART_STYLES = [
  { id: "realistic", label: "Realistisch" },
  { id: "cinematic", label: "Cinematic" },
  { id: "anime", label: "Anime" },
  { id: "comic", label: "Comic" },
  { id: "illustration", label: "Illustration" },
  { id: "watercolor", label: "Aquarell" },
  { id: "3d-render", label: "3D Render" },
  { id: "noir", label: "Film Noir" },
];

const STORY_TRANSITION_TYPES = [
  { id: "hard-cut", label: "Harter Cut" },
  { id: "smooth", label: "Smooth Transition" },
  { id: "fade", label: "Fade" },
  { id: "dissolve", label: "Dissolve" },
  { id: "swipe-left", label: "Swipe Links" },
  { id: "swipe-right", label: "Swipe Rechts" },
  { id: "zoom", label: "Zoom Übergang" },
];

const ART_STYLE_ENGLISH: Record<string, string> = {
  "realistic": "photorealistic, natural lighting, true-to-life",
  "cinematic": "cinematic film look, dramatic lighting, shallow depth of field, anamorphic lens flare",
  "anime": "anime style, cel-shaded, vibrant colors, Japanese animation aesthetic",
  "comic": "comic book style, bold outlines, halftone dots, dynamic composition",
  "illustration": "digital illustration, painterly, artistic, stylized",
  "watercolor": "watercolor painting, soft washes, bleeding colors, paper texture",
  "3d-render": "3D rendered, CGI, Pixar-quality, volumetric lighting",
  "noir": "film noir, high contrast black and white, dramatic shadows, moody atmosphere",
};

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

// Veo3-optimierte Kamerabewegungen für Video-Prompts
const VEO3_CAMERA_MOVEMENTS = [
  { id: "dolly-in", label: "Dolly-In", description: "Langsame Fahrt nach vorn auf das Subjekt zu" },
  { id: "dolly-out", label: "Dolly-Out", description: "Langsame Fahrt nach hinten, vom Subjekt weg" },
  { id: "truck-left", label: "Truck Links", description: "Seitliche Fahrt nach links" },
  { id: "truck-right", label: "Truck Rechts", description: "Seitliche Fahrt nach rechts" },
  { id: "tilt-up", label: "Tilt-Up", description: "Kamera neigt sich nach oben" },
  { id: "tilt-down", label: "Tilt-Down", description: "Kamera neigt sich nach unten" },
  { id: "pan-left", label: "Pan Links", description: "Horizontales Schwenken nach links" },
  { id: "pan-right", label: "Pan Rechts", description: "Horizontales Schwenken nach rechts" },
  { id: "crane-up", label: "Crane-Up", description: "Vertikale Aufwärtsfahrt mit Kran" },
  { id: "crane-down", label: "Crane-Down", description: "Vertikale Abwärtsfahrt mit Kran" },
  { id: "arc-left", label: "Arc Links", description: "Bogenfahrt um das Subjekt nach links" },
  { id: "arc-right", label: "Arc Rechts", description: "Bogenfahrt um das Subjekt nach rechts" },
  { id: "steadicam-follow", label: "Steadicam-Follow", description: "Flüssige Verfolgung des Subjekts" },
  { id: "push-in", label: "Push-In", description: "Schnelle Fahrt nach vorn mit Zoom" },
  { id: "pull-back", label: "Pull-Back", description: "Schnelle Fahrt nach hinten mit Zoom" },
];

// Veo3 Format-Optionen für Storyboard-Bildgenerierung
const VEO3_FORMAT_OPTIONS = [
  { id: "16:9", label: "16:9 (Widescreen)" },
  { id: "9:16", label: "9:16 (Vertikal)" },
];

const Index = () => {
  const { authData, isLoading: authLoading, login, logout } = useAuth();
  
  // Helper: Check if user has Pro-level access (PREMIUM or FULL)
  const isPro = authData.planCode === "PREMIUM" || authData.planCode === "FULL";
  const isFullPlan = authData.planCode === "FULL";
  const { theme, setTheme } = useTheme();
  const [apiKey, setApiKey] = useState("");
  const canGenerate = !!apiKey;
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [selectedBackground, setSelectedBackground] = useState("white");
  const [sceneDescription, setSceneDescription] = useState("");
  const [imageCount, setImageCount] = useState([2]);
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
  const [selectedCameraAngle, setSelectedCameraAngle] = useState("random");
  const isGeneratingRef = useRef(false);
  const referenceImagesRef = useRef<File[]>([]);
  
  const generationQueueRef = useRef<number[]>([]);
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());
  
  // Video prompt generation state
  const [allVideoPrompts, setAllVideoPrompts] = useState<string[]>([]);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [isGeneratingVideoPrompt, setIsGeneratingVideoPrompt] = useState(false);
  const [isGeneratingVideoPrompts, setIsGeneratingVideoPrompts] = useState(false);
  const [generatingVideoPromptIndex, setGeneratingVideoPromptIndex] = useState<number | null>(null);
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
  
  // AI Background Suggestion state
  const [aiBackgroundSuggestion, setAiBackgroundSuggestion] = useState("");
  const [isGeneratingBackgroundSuggestion, setIsGeneratingBackgroundSuggestion] = useState(false);
  
  // AI Assistant Target (unified control for prompt/background)
  const [aiAssistantTarget, setAiAssistantTarget] = useState<"prompt" | "background" | "both">("prompt");

  // View state: home screen vs tools
  const [activeView, setActiveView] = useState<"home" | "tools">("home");
  
  // Main Tab state
  const [activeMainTab, setActiveMainTab] = useState<"poses" | "story" | "character">("poses");
  const [refImageSource, setRefImageSource] = useState<"poses" | "story" | null>(null);

  const [characterImages, setCharacterImages] = useState<string[]>([]);
  // Story Builder state
  const [storyIdea, setStoryIdea] = useState("");
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(null);
  const [isAnimatingSuggestion, setIsAnimatingSuggestion] = useState(false);
  const [storySuggestions, setStorySuggestions] = useState<string[]>([
    "Zufälliges Wiedersehen im Supermarkt",
    "Stilles Treffen ohne Worte",
    "Verlorener Brief verändert alles"
  ]);
  const [lastSuggestionMode, setLastSuggestionMode] = useState<string | null>(null);
  const [isLoadingStorySuggestions, setIsLoadingStorySuggestions] = useState(false);
  const [storyReferenceImages, setStoryReferenceImages] = useState<string[]>(() => {
    const saved = getFromLocalStorage('storyReferenceImages');
    return saved || [];
  });
  
  // Storyboard state
  const [storyPointCount, setStoryPointCount] = useState(2);
  // Global main location for unified storyboard setting
  const [storyboardMainLocation, setStoryboardMainLocation] = useState<string>("");
  
  const [storyPoints, setStoryPoints] = useState<Array<{
    versions: string[];
    currentVersion: number;
    summary?: string;           // Short 1-sentence summary for card preview
    detailedDescription?: string; // Full detailed scene description
    cameraAngle?: string;
    shotType?: string;
    // NEW: Structured scene data for improved image generation
    specificArea?: string;      // Specific area within mainLocation (e.g. "living room" in a "house")
    keyAction?: string;         // The ONE key action/gesture (e.g. "leans pensively at window")
    emotion?: string;           // Visible emotion (e.g. "melancholic", "hopeful")
    generatedImage?: string;
    detailedImagePrompt?: string;
    videoPrompt?: string;
    generatedVideo?: string;
    generationError?: string;
    sceneTitle?: string;
    sceneDescription?: string;
    // Veo3-optimierte Felder
    veo3CameraMovement?: string;  // z.B. "dolly-in", "pan-left"
    veo3StartState?: string;      // Beschreibung des Startframes
    veo3Motion?: string;          // Bewegung/Aktion
    veo3EndState?: string;        // Beschreibung des Endframes für Übergang
    // NEW: Additional structured fields
    participants?: string;
    audienceEffect?: string;
    composition?: string;
    movement?: string;
    negativePrompts?: string;
    styleNotes?: string;
    continuityNotes?: string;
    dialogText?: string;          // Dialog/speech text for characters in this scene
    // Final/Draft State management
    finalSnapshot?: any;        // Snapshot of scene when finalized
    finalizedAt?: number;       // Timestamp when finalized
    // Generation tracking
    generationSnapshot?: Record<string, any>;
    // Version history
    sceneVersions?: Array<Record<string, any>>;
    currentSceneVersion?: number;
  }>>([]);
  const storyPointsRef = useRef(storyPoints);
  useEffect(() => { storyPointsRef.current = storyPoints; }, [storyPoints]);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [regeneratingPointIndex, setRegeneratingPointIndex] = useState<number | null>(null);
  const [expandedStoryPointIndex, setExpandedStoryPointIndex] = useState<number | null>(null);
  const [isClosingPopup, setIsClosingPopup] = useState(false);
  const [storyboardAnimationKey, setStoryboardAnimationKey] = useState(0);
  const [regeneratingCardIndex, setRegeneratingCardIndex] = useState<number | null>(null);
  const [regeneratingImageOnlyIndex, setRegeneratingImageOnlyIndex] = useState<number | null>(null); // Only image flips, not card
  const [justFinishedIndex, setJustFinishedIndex] = useState<number | null>(null);
  const [justFinishedImageOnlyIndex, setJustFinishedImageOnlyIndex] = useState<number | null>(null); // For image-only flip back
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [isGeneratingStoryImages, setIsGeneratingStoryImages] = useState(false);
  const [generatingStoryImageIndex, setGeneratingStoryImageIndex] = useState<number | null>(null);
  
  // Veo3 Export und Kamerabewegung-Tracking
  const [usedCameraMovements, setUsedCameraMovements] = useState<string[]>([]);
  const [isExportingVeo3, setIsExportingVeo3] = useState(false);
  const [storyboardFormat, setStoryboardFormat] = useState<string>("16:9");
  
  // Video generation state (Gemini Veo)
  const [isGeneratingVideos, setIsGeneratingVideos] = useState(false);
  const [generatingVideoIndex, setGeneratingVideoIndex] = useState<number | null>(null);
  const [videoTaskIds, setVideoTaskIds] = useState<Map<number, string>>(new Map());
  const [videoResults, setVideoResults] = useState<Map<number, string>>(new Map());
  const [videoErrors, setVideoErrors] = useState<Map<number, string>>(new Map());
  const [videoGenerationPhase, setVideoGenerationPhase] = useState<"idle" | "uploading" | "generating" | "polling">("idle");
  
  // AI Scene Assistant state
  const [sceneAssistantInput, setSceneAssistantInput] = useState("");
  const [isGeneratingSceneAssistant, setIsGeneratingSceneAssistant] = useState(false);
  
  // Story Idea AI Assistant state
  const [storyAiAssistantInput, setStoryAiAssistantInput] = useState("");
  const [isGeneratingStoryAiIdea, setIsGeneratingStoryAiIdea] = useState(false);
  const [isExpandingSuggestion, setIsExpandingSuggestion] = useState(false);
  
  // Multi-idea generation state
  const [generatedIdeas, setGeneratedIdeas] = useState<string[]>([]);
  const [currentIdeaIndex, setCurrentIdeaIndex] = useState(0);
  const [ideaCount, setIdeaCount] = useState("1");
  
  // Story Builder Setup Options
  const [storyEnableSpeaker, setStoryEnableSpeaker] = useState(true);
  const [storyEnableSceneDescription, setStoryEnableSceneDescription] = useState(true);
  // "speaker-from-description" = KI generiert Sprechertext aus Szenenbeschreibung
  // "description-from-speaker" = KI generiert Szenenbeschreibung aus Sprechertext
  const [storyGenerationDirection, setStoryGenerationDirection] = useState<"speaker-from-description" | "description-from-speaker">("speaker-from-description");
  const [storyVideoModel, setStoryVideoModel] = useState("veo3");
  const [storyArtStyle, setStoryArtStyle] = useState("realistic");
  const [storyTransitionType, setStoryTransitionType] = useState("hard-cut");
  const [storyCustomDetails, setStoryCustomDetails] = useState("");
  const [storySetupCollapsed, setStorySetupCollapsed] = useState(false);
  
  // Scene Edit Popup - Tab-based UI state
  const [sceneEditTab, setSceneEditTab] = useState<"content" | "image" | "video">("content");
  
  // AI Assistant update mode: "text" = nur Text, "camera" = nur Kamera, "image" = nur Bild neu, "both" = beides
  const [sceneAiMode, setSceneAiMode] = useState<"text" | "camera" | "image" | "both">("text");
  
  // Derived values for backward compatibility
  const sceneAiUpdateText = sceneAiMode === "text" || sceneAiMode === "both";
  const sceneAiUpdateCamera = sceneAiMode === "camera" || sceneAiMode === "both";
  const sceneAiRegenerateImage = sceneAiMode === "image" || sceneAiMode === "both";

  // Helper: Call text AI - direct Gemini for all plans
  const callGeminiOrFull = async (
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
    options?: { model?: string; temperature?: number; maxOutputTokens?: number }
  ): Promise<string> => {
      const model = options?.model || "gemini-2.5-flash";
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: options?.temperature ?? 0.7,
              maxOutputTokens: options?.maxOutputTokens ?? 500,
            },
          }),
        }
      );
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  };

  // Browser compatibility check on mount
  useEffect(() => {
    const { compatible, issues } = checkBrowserCompatibility();
    if (!compatible) {
      console.warn("⚠️ Browser compatibility issues:", issues);
    }
    
    // Cleanup Blob URLs on page unload
    const handleBeforeUnload = () => {
      cleanupAllBlobUrls();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      cleanupAllBlobUrls();
    };
  }, []);
  const CAMERA_ANGLE_OPTIONS = [
    { value: "random", label: "Zufällig", description: "Die KI wählt einen passenden Kamerawinkel zur Szene" },
    { value: "frontal", label: "Frontal", description: "Kamera direkt vor der Person auf Augenhöhe, Blick geht direkt in die Kamera. Zeigt das Gesicht vollständig von vorne, symmetrische Komposition." },
    { value: "seitlich", label: "Seitlich", description: "Kamera im 90-Grad-Winkel zur Person (Profilansicht). Zeigt das Profil des Gesichts, Nase und Kinn sind im Fokus, dramatische Silhouette möglich." },
    { value: "von-oben", label: "Von oben", description: "Kamera oberhalb der Person, schräg nach unten gerichtet (High Angle). Die Person erscheint kleiner, verletzlicher oder unterlegen. Boden/Umgebung um die Person herum sichtbar." },
    { value: "von-unten", label: "Von unten", description: "Kamera unterhalb der Person, schräg nach oben gerichtet (Low Angle). Die Person wirkt mächtig, dominant oder heroisch. Decke/Himmel im Hintergrund sichtbar." },
    { value: "ueber-schulter", label: "Über die Schulter", description: "Kamera hinter einer Person, blickt über deren Schulter auf das Geschehen. Typisch für Dialogszenen, zeigt Schulter/Kopfhintergrund im Vordergrund unscharf." },
    { value: "dutch-angle", label: "Dutch Angle", description: "Kamera ist seitlich geneigt (10-45 Grad), Horizont ist schräg. Erzeugt Unruhe, Spannung, Desorientierung oder psychologische Instabilität." },
    { value: "vogelperspektive", label: "Vogelperspektive", description: "Kamera direkt von oben (Bird's Eye View), fast senkrecht nach unten. Zeigt die Person von oben, Kopf/Schultern dominant, Umgebungslayout erkennbar." },
    { value: "froschperspektive", label: "Froschperspektive", description: "Kamera auf Bodenhöhe oder tiefer (Worm's Eye View), extrem nach oben gerichtet. Starke Verzerrung, Person ragt empor, sehr dramatisch und imposant." }
  ];

  const SHOT_TYPE_OPTIONS = [
    { value: "extreme-close-up", label: "Extreme Close-Up", description: "Zeigt nur ein Detail: Augen, Mund, oder Hand. Füllt den gesamten Bildschirm mit diesem Detail. Extrem intim, zeigt feinste Emotionen oder wichtige Objekte." },
    { value: "close-up", label: "Close-Up", description: "Zeigt das Gesicht von Kinn bis Stirn. Schultern können angedeutet sein. Fokus auf Gesichtsausdruck und Emotionen, Hintergrund minimal oder unscharf." },
    { value: "medium-close-up", label: "Medium Close-Up", description: "Zeigt Kopf und Schultern bis zur Brust. Mehr Kontext als Close-Up, aber immer noch Fokus auf Gesicht. Typisch für Interviews oder Dialoge." },
    { value: "medium-shot", label: "Medium Shot", description: "Zeigt Person von Hüfte aufwärts (Cowboy Shot). Oberkörper, Arme und Hände sichtbar. Balance zwischen Gesicht und Körpersprache, Umgebung angedeutet." },
    { value: "medium-long-shot", label: "Medium Long Shot", description: "Zeigt Person von Knien aufwärts. Mehr Körpersprache sichtbar, Beine teilweise im Bild. Interaktion mit unmittelbarer Umgebung erkennbar." },
    { value: "full-shot", label: "Full Shot", description: "Zeigt die komplette Person von Kopf bis Fuß mit etwas Raum drumherum. Volle Körperhaltung und Position im Raum erkennbar, Umgebung bietet Kontext." },
    { value: "long-shot", label: "Long Shot", description: "Person im ganzen Körper, mit viel Umgebung drumherum (Wide Shot). Person ist kleiner im Bild, Landschaft/Raum dominiert. Zeigt Location und Atmosphäre." },
    { value: "extreme-long-shot", label: "Extreme Long Shot", description: "Sehr weite Ansicht, Person ist klein in einer großen Landschaft/Umgebung. Establishing Shot, zeigt den gesamten Schauplatz. Person oft nur als Silhouette erkennbar." }
  ];

  const handleSceneAssistant = async () => {
    if (!canGenerate || expandedStoryPointIndex === null || isGeneratingSceneAssistant) return;
    
    const currentPoint = storyPoints[expandedStoryPointIndex];
    const currentStory = currentPoint.detailedDescription || currentPoint.versions[currentPoint.currentVersion];
    
    setIsGeneratingSceneAssistant(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Du bist ein Experte für Film und Storyboard-Erstellung. Basierend auf der Nutzeranweisung, optimiere die folgende Szene.

AKTUELLE SZENE:
Zusammenfassung: "${currentPoint.summary || ''}"
Detaillierte Beschreibung: "${currentStory}"
Dialog: "${currentPoint.dialogText || ''}"
Video/Szenen-Kontext: "${currentPoint.videoPrompt || ''}"

AKTUELLE EINSTELLUNGEN:
- Kamerawinkel: ${currentPoint.cameraAngle || 'nicht gesetzt'}
- Shot-Typ: ${currentPoint.shotType || 'nicht gesetzt'}
- Pose/Aktion: ${currentPoint.keyAction || 'nicht gesetzt'}
- Bereich: ${currentPoint.specificArea || 'nicht gesetzt'}
- Emotion: ${currentPoint.emotion || 'nicht gesetzt'}
- Publikumswirkung: ${currentPoint.audienceEffect || 'nicht gesetzt'}
- Bildaufbau: ${currentPoint.composition || 'nicht gesetzt'}
- Bewegung: ${currentPoint.movement || 'nicht gesetzt'}
- Negative Prompts: ${currentPoint.negativePrompts || 'nicht gesetzt'}
- Stil-Hinweise: ${currentPoint.styleNotes || 'nicht gesetzt'}

NUTZERANWEISUNG:
"${sceneAssistantInput.trim() || 'Optimiere die Szene für maximale visuelle Wirkung'}"

VERFÜGBARE KAMERAWINKEL (values):
${CAMERA_ANGLE_OPTIONS.map(o => `- "${o.value}": ${o.label}`).join('\n')}

VERFÜGBARE SHOT-TYPEN (values):
${SHOT_TYPE_OPTIONS.map(o => `- "${o.value}": ${o.label}`).join('\n')}

VERFÜGBARE POSEN (values): steht, geht, sitzt, lehnt, schaut, spricht, rennt, wartet, greift, haelt, zeigt, wendet-sich

VERFÜGBARE BEREICHE (values): innenraum, aussenbereich, strasse, natur, arbeitsplatz, zuhause, fahrzeug, oeffentlicher-ort

VERFÜGBARE EMOTIONEN (values): gluecklich, traurig, nachdenklich, aufgeregt, aengstlich, wuetend, ueberrascht, verliebt, verzweifelt, hoffnungsvoll, melancholisch, entspannt, neutral

VERFÜGBARE PUBLIKUMSWIRKUNG (values): spannung, empathie, freude, unbehagen, neugier, erleichterung, trauer, hoffnung

VERFÜGBARE BILDAUFBAU (values): zentriert, drittel-regel, symmetrisch, diagonal, rahmen-im-rahmen

VERFÜGBARE BEWEGUNG (values): keine, dolly-in, dolly-out, truck, tilt, pan, crane, arc

WICHTIGE REGELN:
1. Analysiere die Nutzeranweisung und ändere NUR die Felder, die sich aus der Anweisung ergeben
2. Wenn der Nutzer z.B. "mach es dramatischer" sagt, ändere Emotion, Kamerawinkel, Beschreibung etc. passend
3. Wenn der Nutzer nur den Dialog ändern will, ändere NUR den Dialog
4. Wenn der Nutzer die Kamera ändern will, ändere NUR Kamera-relevante Felder
5. Felder die NICHT geändert werden sollen, setze auf null im JSON
6. Summary und detailedDescription sind auf Deutsch, dialogText ist der gesprochene Text
7. videoPrompt ist auf Englisch (beschreibt die Szene für Videogenerierung)

Antworte NUR mit einem validen JSON-Objekt:
{
  "summary": "Neue Zusammenfassung oder null wenn unverändert",
  "detailedDescription": "Neue Beschreibung oder null wenn unverändert",
  "dialogText": "Neuer Dialog oder null wenn unverändert",
  "videoPrompt": "New video prompt in English or null if unchanged",
  "cameraAngle": "value oder null",
  "shotType": "value oder null",
  "keyAction": "value oder null",
  "specificArea": "value oder null",
  "emotion": "value oder null",
  "audienceEffect": "value oder null",
  "composition": "value oder null",
  "movement": "value oder null",
  "negativePrompts": "text oder null",
  "styleNotes": "text oder null"
}

Keine zusätzlichen Erklärungen, nur das JSON.`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000,
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      const parsed = extractJsonFromAiResponse(text);
      
      // Update the story point — only apply non-null fields
      const idx = expandedStoryPointIndex;
      setStoryPoints(prev => prev.map((p, i) => {
        if (i !== idx) return p;
        
        const updates: Record<string, any> = {};
        
        // Text fields — create new version if description changed
        if (parsed.summary !== null && parsed.summary !== undefined) {
          updates.summary = parsed.summary;
        }
        if (parsed.detailedDescription !== null && parsed.detailedDescription !== undefined) {
          const newVersions = [...p.versions, parsed.detailedDescription];
          updates.versions = newVersions;
          updates.currentVersion = newVersions.length - 1;
          updates.detailedDescription = parsed.detailedDescription;
        }
        if (parsed.dialogText !== null && parsed.dialogText !== undefined) {
          updates.dialogText = parsed.dialogText;
        }
        if (parsed.videoPrompt !== null && parsed.videoPrompt !== undefined) {
          updates.videoPrompt = parsed.videoPrompt;
        }
        
        // Dropdown fields — only apply non-null
        const dropdownFields = ['cameraAngle', 'shotType', 'keyAction', 'specificArea', 'emotion', 'audienceEffect', 'composition', 'movement'] as const;
        for (const field of dropdownFields) {
          if (parsed[field] !== null && parsed[field] !== undefined) {
            (updates as any)[field] = parsed[field];
          }
        }
        
        // Freetext fields
        if (parsed.negativePrompts !== null && parsed.negativePrompts !== undefined) {
          updates.negativePrompts = parsed.negativePrompts;
        }
        if (parsed.styleNotes !== null && parsed.styleNotes !== undefined) {
          updates.styleNotes = parsed.styleNotes;
        }
        
        return { ...p, ...updates };
      }));
      
      setSceneAssistantInput("");
    } catch (error) {
      console.error("Scene assistant error:", error);
    } finally {
      setIsGeneratingSceneAssistant(false);
    }
  };

  // Video Prompt AI Assistant - optimizes existing video prompt based on user input
  const handleVideoPromptAssistant = async () => {
    if (!canGenerate || expandedStoryPointIndex === null || isGeneratingSceneAssistant) return;
    
    const currentPoint = storyPoints[expandedStoryPointIndex];
    if (!currentPoint.videoPrompt && !sceneAssistantInput.trim()) return;
    
    setIsGeneratingSceneAssistant(true);
    try {
      const sceneText = currentPoint.detailedDescription || currentPoint.versions[currentPoint.currentVersion] || "";
      
      const promptRequest = `Du bist ein professioneller Video-Prompt-Autor für KI-Video-Generatoren.

AKTUELLER VIDEO PROMPT:
"${currentPoint.videoPrompt || 'Noch kein Video-Prompt vorhanden.'}"

SZENEN-KONTEXT:
"${sceneText}"
${currentPoint.emotion ? `Emotion: ${currentPoint.emotion}` : ''}
${currentPoint.keyAction ? `Aktion: ${currentPoint.keyAction}` : ''}
${currentPoint.cameraAngle ? `Kamerawinkel: ${currentPoint.cameraAngle}` : ''}
${currentPoint.shotType ? `Shot-Typ: ${currentPoint.shotType}` : ''}

NUTZERANWEISUNG:
"${sceneAssistantInput.trim() || 'Optimiere den Video-Prompt für maximale visuelle Wirkung und Detailgrad.'}"

Erstelle einen VERBESSERTEN Video-Prompt (ca. 200 Wörter, auf Englisch) basierend auf der Nutzeranweisung.
Der Prompt soll präzise Kamerabewegungen, Charakter-Aktionen, Licht und Atmosphäre beschreiben.

Antworte NUR mit dem reinen Video-Prompt-Text, keine JSON-Struktur, keine Erklärungen.`;

      const resultText = await callGeminiOrFull(
        [{ text: promptRequest }],
        { model: "gemini-2.0-flash", temperature: 0.7, maxOutputTokens: 500 }
      );

      if (resultText) {
        const idx = expandedStoryPointIndex;
        setStoryPoints(prev => prev.map((p, i) => {
          if (i !== idx) return p;
          return { ...p, videoPrompt: resultText };
        }));
        setSceneAssistantInput("");
      }
    } catch (error) {
      console.error("Video prompt assistant error:", error);
    } finally {
      setIsGeneratingSceneAssistant(false);
    }
  };
  
  // Unified Scene Assistant - combines text/camera updates with optional image regeneration
  const handleUnifiedSceneAssistant = async () => {
    if (!apiKey || expandedStoryPointIndex === null) return;
    
    // 1. Text & Kamera optimieren (wenn ausgewählt)
    if (sceneAiUpdateText) {
      await handleSceneAssistant();
    }
    
    // 2. Bild neu generieren (wenn ausgewählt)
    if (sceneAiRegenerateImage && expandedStoryPointIndex !== null) {
      await regenerateSingleStoryScene(expandedStoryPointIndex);
    }
  };

  // Story Idea AI Assistant handler - generates multiple ideas
  const handleGenerateStoryIdea = async () => {
    if (!canGenerate || isGeneratingStoryAiIdea) return;
    
    const count = parseInt(ideaCount);
    const hasExistingIdea = storyIdea.trim().length > 0;
    const isModifyMode = hasExistingIdea;
    
    setIsGeneratingStoryAiIdea(true);
    try {
      const currentIdea = generatedIdeas[currentIdeaIndex] || storyIdea;
      
      const prompt = isModifyMode
        ? `Du bist ein Story-Autor für REALISTISCHE, lebensnahe Geschichten.

AKTUELLE STORY-IDEE:
"${currentIdea}"

${storyAiAssistantInput.trim() ? `ÄNDERUNGSWUNSCH:\n"${storyAiAssistantInput.trim()}"` : 'Verbessere und erweitere diese Story-Idee. Mache sie detaillierter, fesselnder und emotional packender.'}

Erstelle genau ${count} verschiedene Variante${count > 1 ? 'n' : ''} der angepassten Story-Idee. Behalte den Kern der Geschichte bei, aber integriere die gewünschten Änderungen.${count > 1 ? ' Jede Variante soll einen anderen Ansatz oder Fokus haben.' : ''}

WICHTIGE REGELN:
- Erstelle ${count > 1 ? `genau ${count} Varianten, jeweils` : 'eine'} ausführliche, detaillierte Story-Idee (4-8 Sätze)
- NUR realistische, alltägliche Szenarien! KEINE Fantasy, Magie, übernatürliche Elemente, Sci-Fi
- Fokussiere auf echte menschliche Emotionen, Beziehungen, Konflikte, Entscheidungen
- Schreibe auf Deutsch
${count > 1 ? '- Trenne die Varianten mit "---" auf einer eigenen Zeile\n' : ''}- Antworte NUR mit der angepassten Story-Idee, keine Einleitungen oder Erklärungen`
        : `Du bist ein Story-Autor für REALISTISCHE, lebensnahe Geschichten. Erstelle genau ${count} verschiedene, fesselnde Story-Idee${count > 1 ? 'n' : ''}.

NUTZERANFRAGE:
"${storyAiAssistantInput.trim() || 'Erstelle realistische, detaillierte Story-Ideen'}"

WICHTIGE REGELN:
- Erstelle genau ${count} ${count > 1 ? 'verschiedene Story-Ideen (jeweils' : 'ausführliche Story-Idee ('} 6-10 Sätze)
- NUR realistische, alltägliche Szenarien! KEINE Fantasy, Magie, übernatürliche Elemente, Sci-Fi
- Fokussiere auf echte menschliche Emotionen, Beziehungen, Konflikte, Entscheidungen
- Die Idee${count > 1 ? 'n' : ''} sollte${count > 1 ? 'n' : ''} visuell umsetzbar sein für ein Storyboard
- Schreibe auf Deutsch
${count > 1 ? '- Trenne die Ideen mit "---" auf einer eigenen Zeile\n' : ''}- Antworte NUR mit den Story-Ideen, keine Nummerierungen, Einleitungen oder Erklärungen`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.9,
              maxOutputTokens: Math.max(count * 800, 2000)
            }
          })
        }
      );

      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (generatedText) {
        // Parse ideas (split by --- if multiple)
        const ideas = count > 1
          ? generatedText.split(/\n\s*-{3,}\s*\n|\n\s*_{3,}\s*\n/).map((s: string) => s.trim()).filter((s: string) => s.length > 15)
          : [generatedText];
        
        // Fallback: if splitting didn't produce enough ideas, keep as single
        const finalIdeas = ideas.length > 0 ? ideas : [generatedText];

        if (isModifyMode) {
          setGeneratedIdeas(prev => {
            const base = prev.length === 0 && storyIdea.trim() ? [storyIdea.trim()] : [...prev];
            const insertIndex = prev.length === 0 ? 1 : currentIdeaIndex + 1;
            base.splice(insertIndex, 0, ...finalIdeas);
            return base;
          });
          setCurrentIdeaIndex(prev => {
            const wasEmpty = generatedIdeas.length === 0;
            return wasEmpty ? 1 : prev + 1;
          });
          setStoryIdea(finalIdeas[0]);
          setStoryAiAssistantInput("");
        } else {
          setGeneratedIdeas(finalIdeas);
          setCurrentIdeaIndex(0);
          setStoryIdea(finalIdeas[0]);
          setStoryAiAssistantInput("");
          setStorySuggestions([]);
        }
      }
    } catch (error) {
      console.error("Story AI assistant error:", error);
    } finally {
      setIsGeneratingStoryAiIdea(false);
    }
  };

  // Navigate between generated ideas
  const navigateIdea = (direction: "prev" | "next") => {
    if (generatedIdeas.length === 0) return;
    const newIndex = direction === "prev" 
      ? Math.max(0, currentIdeaIndex - 1)
      : Math.min(generatedIdeas.length - 1, currentIdeaIndex + 1);
    setCurrentIdeaIndex(newIndex);
    setStoryIdea(generatedIdeas[newIndex]);
  };

  const handleCloseExpandedCard = () => {
    if (isClosingPopup) return;
    setIsClosingPopup(true);
    setTimeout(() => {
      setExpandedStoryPointIndex(null);
      setIsClosingPopup(false);
    }, 250);
  };

  const handleStoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const maxImages = 2; // Max 2 manuelle Uploads, 3. Bild kommt von letzter Szene
      const allFiles = Array.from(files);
      const filesToProcess = allFiles.slice(0, maxImages - storyReferenceImages.length);
      
      if (filesToProcess.length === 0) {
        e.target.value = "";
        return;
      }
      
      const newImages: string[] = [];
      for (const file of filesToProcess) {
        try {
          // Compress image to fit within 1MB
          const base64 = await compressImageToFitSize(file);
          newImages.push(base64);
        } catch (error) {
          console.error('Error compressing image:', error);
        }
      }
      
      if (newImages.length > 0) {
        setStoryReferenceImages(prev => {
          const updated = [...prev, ...newImages].slice(0, 2); // Max 2 manuelle Uploads
          saveToLocalStorage('storyReferenceImages', updated);
          return updated;
        });
      }
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
    if (!canGenerate || !storyIdea.trim() || isGeneratingStoryboard) return;
    
    setIsGeneratingStoryboard(true);
    // Clear existing storypoints when regenerating
    setStoryPoints([]);
    setFlippedCards(new Set());
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Du bist ein professioneller Drehbuchautor für visuelle Storyboards.

AUFGABE:
Erstelle ein einziges valides JSON-Objekt basierend auf diesen Eingaben.

EINGABEN:
- storyIdea: "${storyIdea}"
- visualStyle: "${storyArtStyle}"
- customDetails: "${storyCustomDetails.trim()}"
- sceneCount: ${storyPointCount}
- enableSceneDescription: ${storyEnableSceneDescription}
- enableSpeaker: ${storyEnableSpeaker}
- generationDirection: "${storyGenerationDirection}"

HARTE AUSGABEREGELN:
- Antworte ausschließlich mit einem einzigen validen JSON-Objekt.
- Das erste Zeichen deiner Antwort muss { sein.
- Das letzte Zeichen deiner Antwort muss } sein.
- Kein Markdown.
- Keine Codeblöcke.
- Keine Einleitung.
- Keine Erklärung.
- Keine Kommentare.
- Keine zusätzlichen Zeichen vor oder nach dem JSON.
- Keine umschließenden Anführungszeichen um das gesamte JSON.
- Die Antwort muss mit JSON.parse() direkt parsebar sein.

INHALTSREGELN:
- Definiere zuerst einen einzigen Hauptort für die gesamte Geschichte.
- Alle Szenen spielen nur an diesem Hauptort.
- Nur der konkrete Bereich innerhalb des Hauptorts wechselt.
- Alle Szenen müssen realistisch sein. Keine Fantasy, keine Magie.
- Jede Szene hat genau eine klare zentrale Aktion oder Gestik.
- Die Szenen bauen logisch aufeinander auf.
- Emotionen müssen visuell erkennbar sein.

ERLAUBTE WERTE:
- cameraAngle: "eye-level" | "low-angle" | "high-angle" | "dutch-angle" | "over-shoulder" | "bird-eye" | "worm-eye"
- shotType: "extreme-close-up" | "close-up" | "medium-close-up" | "medium-shot" | "medium-full-shot" | "full-shot" | "long-shot" | "extreme-long-shot"

JSON-SCHEMA:
{
  "mainLocation": "string",
  "scenes": [
    {
      "summary": "string, max 15 Wörter",
      "specificArea": "string",
      "keyAction": "string",
      "emotion": "string",
      "detailedDescription": "string",
      "dialogText": "string",
      "cameraAngle": "one of allowed values",
      "shotType": "one of allowed values"
    }
  ]
}

FELDREGELN:
- "mainLocation": der eine Hauptort der gesamten Geschichte
- "summary": 1 Satz, maximal 15 Wörter
- "specificArea": konkreter Bereich innerhalb des Hauptorts
- "keyAction": genau eine zentrale sichtbare Aktion oder Gestik
- "emotion": klar sichtbar und visuell darstellbar
- "detailedDescription":
  - falls enableSceneDescription = true:
    - falls enableSpeaker = true und generationDirection = "description-from-speaker":
      visuelle Beschreibung basierend auf dialogText, 3-4 Sätze
    - sonst:
      ausführliche visuelle Beschreibung, 3-4 Sätze
  - falls enableSceneDescription = false:
      "(wird vom Nutzer manuell erstellt)"
- "dialogText":
  - nur ausgeben, falls enableSpeaker = true
  - falls generationDirection = "speaker-from-description":
      gesprochener Dialog passend zur Szene, 1-3 Sätze
  - falls generationDirection = "description-from-speaker":
      Dialog zuerst inhaltlich erzeugen, damit die visuelle Beschreibung darauf basiert
- "cameraAngle": nur erlaubter Enum-Wert
- "shotType": nur erlaubter Enum-Wert

WICHTIG:
- Wenn enableSpeaker = false, darf "dialogText" nicht im JSON vorkommen.
- Die Anzahl der Szenen muss exakt sceneCount entsprechen.
- Verwende nur Strings, Arrays und Objekte, die in validem JSON erlaubt sind.
- Gib jetzt nur das JSON zurück.`
              }]
            }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 4000,
              responseMimeType: "application/json"
            }
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          try {
            const parsed = extractJsonFromAiResponse(text);
            const mainLocation = parsed.mainLocation || "";
            const scenes = parsed.scenes || [];
            
            if (Array.isArray(scenes) && scenes.length > 0) {
              setStoryboardMainLocation(mainLocation);
              
              setStoryPoints(scenes.slice(0, storyPointCount).map((scene: any) => ({
                versions: [scene.detailedDescription || scene.summary || ""],
                currentVersion: 0,
                summary: scene.summary || "",
                detailedDescription: scene.detailedDescription || "",
                dialogText: scene.dialogText || "",
                specificArea: "",
                keyAction: "",
                emotion: "",
                cameraAngle: "",
                shotType: ""
              })));
              setStoryboardAnimationKey(prev => prev + 1);
            }
          } catch (parseError) {
            console.error("JSON parse error, falling back to line-based parsing:", parseError);
            const points = text.split('\n')
              .map((line: string) => line.trim())
              .filter((line: string) => line.length > 5 && !line.startsWith('[') && !line.startsWith('{'))
              .slice(0, storyPointCount);
            
            setStoryPoints(points.map((point: string) => ({
              versions: [point],
              currentVersion: 0,
              summary: point.length > 80 ? point.substring(0, 80) + "..." : point,
              detailedDescription: point
            })));
            setStoryboardAnimationKey(prev => prev + 1);
          }
        }
      }
    } catch (error) {
      console.error("Failed to generate storyboard:", error);
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };
  
  // Helper function to add shot label to generated image
  // Shot type labels are now CSS overlays only - no longer baked into images
  
  // Clear all storyboard content
  const clearAllStoryboard = () => {
    setStoryPoints([]);
    setFlippedCards(new Set());
    setStoryboardAnimationKey(0);
    setUsedCameraMovements([]);
    setVideoErrors(new Map());
    setVideoResults(new Map());
    setVideoTaskIds(new Map());
  };

  // Export Storyboard für Veo3 als ZIP-Datei
  const exportForVeo3 = async () => {
    if (storyPoints.length === 0 || isExportingVeo3) return;
    
    const hasImages = storyPoints.some(p => p.generatedImage);
    if (!hasImages) {
      console.warn("Keine Bilder vorhanden für Veo3 Export");
      return;
    }
    
    setIsExportingVeo3(true);
    
    try {
      const zip = new JSZip();
      const scenesFolder = zip.folder("veo3_scenes");
      
      // Übersichtsdatei erstellen
      let overviewContent = `# Veo3 Storyboard Export
# Erstellt am: ${new Date().toLocaleString('de-DE')}
# Story: ${storyIdea}
# Anzahl Szenen: ${storyPoints.length}

========================================
ÜBERSICHT ALLER SZENEN
========================================

`;

      for (let i = 0; i < storyPoints.length; i++) {
        const point = storyPoints[i];
        const sceneNum = String(i + 1).padStart(2, '0');
        
        // Bild als PNG speichern
        if (point.generatedImage) {
          try {
            const response = await fetch(point.generatedImage);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            scenesFolder?.file(`scene_${sceneNum}.png`, arrayBuffer);
          } catch (e) {
            console.warn(`Could not export image for scene ${i + 1}:`, e);
          }
        }
        
        // Veo3-optimierter Prompt-Datei erstellen
        const cameraMovementInfo = point.veo3CameraMovement 
          ? VEO3_CAMERA_MOVEMENTS.find(m => m.id === point.veo3CameraMovement)
          : null;
        
        const promptContent = `=== SZENE ${sceneNum} ===
BILD: scene_${sceneNum}.png

────────────────────────────────────────
VEO3 VIDEO-PROMPT (Kopieren für Veo3)
────────────────────────────────────────
${point.videoPrompt || 'Kein Video-Prompt generiert'}

────────────────────────────────────────
STRUKTURIERTE DETAILS
────────────────────────────────────────
KAMERABEWEGUNG: ${cameraMovementInfo ? `${cameraMovementInfo.label} (${cameraMovementInfo.description})` : 'Nicht definiert'}

START-FRAME:
${point.veo3StartState || point.sceneDescription || 'Nicht definiert'}

BEWEGUNG/AKTION:
${point.veo3Motion || 'Nicht definiert'}

END-FRAME (für Übergang zu nächster Szene):
${point.veo3EndState || 'Nicht definiert'}

────────────────────────────────────────
SZENEN-DETAILS
────────────────────────────────────────
TITEL: ${point.sceneTitle || 'Ohne Titel'}
BESCHREIBUNG: ${point.sceneDescription || point.versions[point.currentVersion]}
KAMERAWINKEL: ${point.cameraAngle || 'Automatisch'}
SHOT-TYP: ${point.shotType || 'Automatisch'}

────────────────────────────────────────
BILD-PROMPT (Referenz)
────────────────────────────────────────
${point.detailedImagePrompt || 'Nicht verfügbar'}

────────────────────────────────────────
ÜBERGANG
────────────────────────────────────────
DAUER: 5 Sekunden empfohlen
SCHNITT: ${i < storyPoints.length - 1 ? 'Cut oder Fade zu Szene ' + (i + 2) : 'Letzte Szene'}
`;
        
        scenesFolder?.file(`scene_${sceneNum}_prompt.txt`, promptContent);
        
        // Zur Übersicht hinzufügen
        overviewContent += `
SZENE ${sceneNum}: ${point.sceneTitle || 'Ohne Titel'}
────────────────────────────────────────
${point.videoPrompt || 'Kein Video-Prompt'}
Kamerabewegung: ${cameraMovementInfo?.label || 'Nicht definiert'}
Übergang: ${point.veo3EndState?.substring(0, 100) || '-'}...

`;
      }
      
      // Übersichtsdatei speichern
      zip.file("STORYBOARD_OVERVIEW.txt", overviewContent);
      
      // Anleitung für Veo3 hinzufügen
      const instructionsContent = `# Anleitung für Google Veo3

## So verwendest du diese Dateien:

1. Öffne Google AI Studio oder Veo3 Interface
2. Für JEDE Szene:
   a) Lade das Bild (scene_XX.png) als Startframe hoch
   b) Kopiere den VEO3 VIDEO-PROMPT aus der entsprechenden .txt Datei
   c) Generiere das Video (empfohlen: 5 Sekunden)

## Tipps für beste Ergebnisse:

- Verwende die Bilder als "First Frame" / Startbild
- Halte die Prompts so wie sie sind - sie sind auf Veo3 optimiert
- Die Szenen sind für nahtlose Übergänge konzipiert
- Empfohlene Auflösung: 16:9 (Widescreen)
- Empfohlene Qualität: Höchste verfügbare

## Szenen-Reihenfolge:

${storyPoints.map((p, i) => `Szene ${String(i + 1).padStart(2, '0')}: ${p.sceneTitle || p.versions[p.currentVersion].substring(0, 50)}...`).join('\n')}

Viel Spaß beim Erstellen deines Videos!
`;
      
      zip.file("VEO3_ANLEITUNG.txt", instructionsContent);
      
      // ZIP generieren und herunterladen
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `veo3_storyboard_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error("Veo3 export error:", error);
    } finally {
      setIsExportingVeo3(false);
    }
  };

  const regenerateStoryPoint = async (index: number) => {
    if (!apiKey || regeneratingPointIndex !== null) return;
    
    setRegeneratingPointIndex(index);
    setRegeneratingCardIndex(index); // Start flip-away animation
    
    // Clear previous error
    setStoryPoints(prev => prev.map((p, idx) => {
      if (idx === index) {
        return { ...p, generationError: undefined };
      }
      return p;
    }));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000); // 40s timeout for text
    
    try {
      const point = storyPoints[index];
      const prevPoint = index > 0 ? storyPoints[index - 1] : null;
      const nextPoint = index < storyPoints.length - 1 ? storyPoints[index + 1] : null;
      
      // Step 1: Regenerate ALL metadata via AI (structured JSON)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Du bist ein professioneller Drehbuchautor für visuelle Storyboards.

STORY-IDEE: "${storyIdea}"
HAUPTORT: "${storyboardMainLocation}"

Generiere eine KOMPLETT NEUE Alternative für Szene ${index + 1} von ${storyPoints.length}.

Bisherige Szene: "${point.versions[point.currentVersion]}"
${prevPoint ? `Vorherige Szene: "${prevPoint.versions[prevPoint.currentVersion]}"` : "Dies ist die erste Szene."}
${nextPoint ? `Nächste Szene: "${nextPoint.versions[nextPoint.currentVersion]}"` : "Dies ist die letzte Szene."}

WICHTIG: Antworte NUR mit diesem validen JSON-Format:
{
  "summary": "1-Satz Zusammenfassung (max. 15 Wörter)",
  "specificArea": "Welcher Bereich des Hauptorts (z.B. 'im Flur', 'auf dem Balkon')",
  "keyAction": "Die EINE zentrale Aktion/Gestik der Person",
  "emotion": "Die sichtbare Emotion (z.B. 'melancholisch', 'hoffnungsvoll')",
  "detailedDescription": "Ausführliche visuelle Beschreibung (3-4 Sätze): Atmosphäre, Beleuchtung, was die Person tut",
  "dialogText": "Was der Charakter in dieser Szene sagt (1-3 Sätze gesprochener Dialog, in Anführungszeichen). Leer lassen wenn keine Rede.",
  "cameraAngle": "eye-level|low-angle|high-angle|dutch-angle|over-shoulder|bird-eye|worm-eye",
  "shotType": "extreme-close-up|close-up|medium-close-up|medium-shot|medium-full-shot|full-shot|long-shot|extreme-long-shot"
}

REGELN:
- Die neue Szene MUSS sich deutlich von der bisherigen unterscheiden
- Der Hauptort bleibt gleich, nur der Bereich wechselt
- Die Szene muss logisch in die Geschichte passen
- NUR realistische Szenarien
- Antworte NUR mit dem JSON, keine zusätzlichen Erklärungen`
              }]
            }],
            generationConfig: {
              temperature: 0.9,
              maxOutputTokens: 4000,
              responseMimeType: "application/json"
            }
          }),
        }
      );
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(getErrorMessageFromStatus(response.status, "Text"));
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (!text) {
        throw new Error("Keine Antwort von der KI");
      }
      
      // Parse the structured JSON response
      const parsed = extractJsonFromAiResponse(text);
      
      // Step 2: Update the story point with ALL new AI-chosen metadata
      const updatedPoint = {
        ...point,
        versions: [...point.versions, parsed.detailedDescription || parsed.summary || ""],
        currentVersion: point.versions.length,
        summary: parsed.summary || "",
        detailedDescription: parsed.detailedDescription || "",
        specificArea: parsed.specificArea || "",
        keyAction: parsed.keyAction || "",
        emotion: parsed.emotion || "",
        cameraAngle: parsed.cameraAngle || "",
        shotType: parsed.shotType || "",
        dialogText: parsed.dialogText || "",
      };
      
      setStoryPoints(prev => prev.map((p, i) => {
        if (i === index) {
          return updatedPoint;
        }
        return p;
      }));
      
      // Step 3: Now regenerate the image with the new metadata
      // Card stays flipped (regeneratingCardIndex remains set) - no intermediate flip-back
      setRegeneratingPointIndex(null);
      await regenerateSingleStoryScene(index, updatedPoint, true); // skipGuard: bypass stale closure check
      
    } catch (error) {
      clearTimeout(timeoutId);
      let errorMessage = "Unbekannter Fehler";
      if (error instanceof Error) {
        errorMessage = error.name === 'AbortError' ? "Zeitüberschreitung – keine Antwort nach 20s" : error.message;
      }
      console.error("Failed to regenerate story point:", errorMessage);
      
      setStoryPoints(prev => prev.map((p, idx) => {
        if (idx === index) {
          return { ...p, generationError: errorMessage };
        }
        return p;
      }));
      
      // Reset animation on error
      setRegeneratingCardIndex(null);
      setRegeneratingPointIndex(null);
    }
  };

  // Helper function to get specific error message from HTTP status
  const getErrorMessageFromStatus = (status: number, step: string): string => {
    switch (status) {
      case 400:
        return `${step}: Ungültige Anfrage`;
      case 401:
        return `${step}: API-Key ungültig oder abgelaufen`;
      case 403:
        return `${step}: Zugriff verweigert`;
      case 429:
        return `${step}: Zu viele Anfragen - bitte warte kurz`;
      case 500:
        return `${step}: Server-Fehler bei Google`;
      case 503:
        return `${step}: API überlastet - bitte später versuchen`;
      default:
        return `${step}: Fehler (${status})`;
    }
  };

  // Helper function to generate a single story scene - ALIGNED WITH POSE GENERATOR
  // Uses the SAME payload structure that works in pose generation: TEXT FIRST, then images
  const generateSingleStoryScene = async (
    sceneIndex: number,
    point: {
      versions: string[];
      currentVersion: number;
      cameraAngle?: string;
      shotType?: string;
      generatedImage?: string;
      detailedImagePrompt?: string;
      videoPrompt?: string;
      generatedVideo?: string;
      generationError?: string;
      sceneTitle?: string;
      sceneDescription?: string;
    },
    characterBase64Images: string[],
    previousScenePrompt: string | null,
    maxRetries: number = 3
  ): Promise<{ success: boolean; generatedImageUrl?: string; detailedImagePrompt?: string; videoPrompt?: string; sceneTitle?: string; sceneDescription?: string; errorMessage?: string; veo3CameraMovement?: string; veo3StartState?: string; veo3Motion?: string; veo3EndState?: string }> => {
    const storyText = point.versions[point.currentVersion];
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      
      try {
        // === ULTRA-COMPACT PROMPTS - EXACTLY LIKE POSE GENERATOR ===
        // The pose generator works reliably because it uses SHORT prompts (under 50 words)
        
        // Get shot type text
        const shotOption = SHOT_OPTIONS.find(s => s.id === point.shotType);
        const shotText = shotOption?.label || "full body shot";
        
        // Camera angle
        const cameraAngleInfo = point.cameraAngle && point.cameraAngle !== 'random'
          ? CAMERA_ANGLE_OPTIONS.find(o => o.value === point.cameraAngle)
          : null;
        const cameraText = cameraAngleInfo?.label || "cinematic angle";
        
        // === GERMAN TO ENGLISH TRANSLATION MAP ===
        const germanToEnglish: Record<string, string> = {
          // Locations
          "ballsaal": "ballroom", "villa": "villa", "wald": "forest", "strand": "beach",
          "garten": "garden", "zimmer": "room", "haus": "house", "schloss": "castle",
          "straße": "street", "stadt": "city", "dorf": "village", "büro": "office",
          "küche": "kitchen", "wohnzimmer": "living room", "schlafzimmer": "bedroom",
          "keller": "basement", "dachboden": "attic", "terrasse": "terrace", "balkon": "balcony",
          "park": "park", "see": "lake", "meer": "ocean", "berg": "mountain", "tal": "valley",
          "fluss": "river", "brücke": "bridge", "turm": "tower", "kirche": "church",
          "restaurant": "restaurant", "café": "cafe", "bar": "bar", "hotel": "hotel",
          "bahnhof": "train station", "flughafen": "airport", "hafen": "harbor",
          // Atmosphere
          "gedämpft": "dim lighting", "dunkel": "dark", "hell": "bright", "warm": "warm",
          "kalt": "cold", "neblig": "foggy", "sonnig": "sunny", "regnerisch": "rainy",
          "abend": "evening", "nacht": "night", "morgen": "morning", "mittag": "noon",
          "dämmung": "dusk", "stimmungsvoll": "atmospheric", "romantisch": "romantic",
          "geheimnisvoll": "mysterious", "elegant": "elegant", "rustikal": "rustic",
          "modern": "modern", "alt": "old", "antik": "antique", "luxuriös": "luxurious",
          // Common words
          "und": "and", "mit": "with", "in": "in", "auf": "on", "unter": "under",
          "neben": "beside", "vor": "before", "hinter": "behind", "über": "above",
          "ist": "", "sind": "", "war": "", "waren": "", "wird": "", "werden": "",
          "der": "", "die": "", "das": "", "ein": "", "eine": "", "einem": "", "einer": "",
        };
        
        // Extract ONLY 5 safe ENGLISH keywords from story text
        const extractSceneKeywords = (text: string): string => {
          // 1. Remove ALL problematic words (German)
          let cleaned = text
            .replace(/\b(tot|sterben|stirbt|blut|waffe|gewalt|nackt|sex|kind|mord|krieg|schießen|erschießen|töten|leiche|tod|opfer|kampf|angriff|verletzt|schmerz|angst|panik|terror|gefahr)\b/gi, '')
            .toLowerCase()
            .replace(/[.,!?;:'"()[\]{}]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          // 2. Translate German words to English
          for (const [de, en] of Object.entries(germanToEnglish)) {
            cleaned = cleaned.replace(new RegExp(`\\b${de}\\b`, 'gi'), en);
          }
          
          // 3. Remove any remaining German articles/filler and empty strings
          cleaned = cleaned
            .split(/\s+/)
            .filter(word => word.length > 2 && !/^(der|die|das|ein|eine|und|oder|aber|von|zu|bei|nach|für|mit|aus|über|unter|durch|gegen|ohne|um|an|auf|in|als|wie|so|wenn|weil|dass|ob|doch|noch|schon|auch|nur|sehr|ganz|immer|wieder|hier|dort|jetzt|dann|da)$/i.test(word))
            .join(' ');
          
          // 4. Keep only first 5 words
          const words = cleaned.split(/\s+/).filter(w => w.length > 0).slice(0, 5).join(' ');
          
          // 5. Fallback if nothing left
          return words.trim() || "indoor scene";
        };
        
        const sceneKeywords = extractSceneKeywords(storyText);
        
        // ===== DETAILED CAMERA/SHOT DESCRIPTIONS =====
        const shotTypeDescriptions: Record<string, string> = {
          "extreme-close-up": "EXTREME CLOSE-UP SHOT: Frame shows only a tiny detail - one eye, lips, or fingernail fills 95% of the frame. Hyper-detailed skin texture, pores, and microscopic details visible. Ultra-macro photography style.",
          "close-up": "CLOSE-UP SHOT: Face fills 80% of the frame. Focus on facial features - eyes, nose, mouth clearly visible with fine details. Skin texture, eyelashes, and subtle expressions are prominent. Head and upper shoulders only.",
          "medium-close-up": "MEDIUM CLOSE-UP: Head and chest visible, frame cuts at mid-chest. Face takes up 50-60% of frame. Clear facial expression with some body language context. Professional portrait framing.",
          "medium-shot": "MEDIUM SHOT: Person visible from waist up. Full torso, arms, and head in frame. Balance between facial expression and body language. Standard conversational framing.",
          "medium-full-shot": "MEDIUM FULL SHOT: Person visible from knees up. Most of the body in frame, showing posture and gesture while keeping face readable. Also called 'American shot'.",
          "full-shot": "FULL SHOT: Entire body from head to feet fills the frame. Complete body language visible. Person takes up 70-80% of frame height. Clear view of clothing and stance.",
          "long-shot": "LONG SHOT: Full body with significant environment around them. Person takes up 40-50% of frame height. Context and setting become important. Wide environmental framing.",
          "extreme-long-shot": "EXTREME LONG SHOT: Vast landscape or environment dominates. Person is small in frame (10-20% height), establishing location and scale. Epic, cinematic wide view."
        };
        
        const cameraAngleDescriptions: Record<string, string> = {
          "eye-level": "EYE LEVEL ANGLE: Camera at same height as subject's eyes. Neutral, natural perspective. No dramatic distortion.",
          "low-angle": "LOW ANGLE: Camera positioned below subject looking upward. Makes subject appear powerful, dominant, larger. Slight upward tilt.",
          "high-angle": "HIGH ANGLE: Camera positioned above subject looking down. Makes subject appear smaller, vulnerable, or submissive. Downward perspective.",
          "bird-eye": "BIRD'S EYE VIEW: Camera directly above looking straight down. 90-degree top-down perspective. Subject seen from directly overhead.",
          "worm-eye": "WORM'S EYE VIEW: Camera at ground level looking straight up. Extreme low angle, sky or ceiling visible. Very dramatic and imposing.",
          "dutch-angle": "DUTCH ANGLE: Camera tilted 15-45 degrees on its axis. Creates unease, tension, or dynamic energy. Diagonal horizon line.",
          "over-shoulder": "OVER-THE-SHOULDER: Camera behind one person's shoulder, looking at the subject. Creates intimacy and connection. Partial shoulder/head in foreground."
        };
        
        // Get the scene's camera settings
        const scenePoint = storyPoints[sceneIndex];
        const selectedShotType = scenePoint?.shotType || "";
        const selectedCameraAngle = scenePoint?.cameraAngle || "";
        
        // Build camera instruction
        let cameraInstruction = "";
        if (selectedShotType && shotTypeDescriptions[selectedShotType]) {
          cameraInstruction += shotTypeDescriptions[selectedShotType] + " ";
        }
        if (selectedCameraAngle && cameraAngleDescriptions[selectedCameraAngle]) {
          cameraInstruction += cameraAngleDescriptions[selectedCameraAngle];
        }
        
        // ===== EXTRACT MAIN LOCATION FROM STORY =====
        // The main location/setting stays consistent across all scenes
        const extractMainLocation = (fullStory: string): string => {
          const locationKeywords = [
            // Outdoor locations
            "forest", "wald", "beach", "strand", "mountain", "berg", "city", "stadt", "village", "dorf",
            "desert", "wüste", "jungle", "dschungel", "ocean", "meer", "lake", "see", "river", "fluss",
            "garden", "garten", "park", "meadow", "wiese", "field", "feld", "valley", "tal",
            // Indoor locations
            "castle", "schloss", "burg", "cave", "höhle", "temple", "tempel", "palace", "palast",
            "house", "haus", "mansion", "villa", "church", "kirche", "library", "bibliothek",
            "hospital", "krankenhaus", "school", "schule", "office", "büro", "factory", "fabrik",
            "museum", "theater", "restaurant", "hotel", "bar", "club", "arena", "stadium", "station",
            // Fantasy/Sci-Fi
            "spaceship", "raumschiff", "space station", "raumstation", "planet", "moon", "mond",
            "dungeon", "kerker", "tower", "turm", "fortress", "festung", "ruins", "ruinen"
          ];
          
          const storyLower = fullStory.toLowerCase();
          for (const loc of locationKeywords) {
            if (storyLower.includes(loc)) {
              // Return English version
              const translations: Record<string, string> = {
                "wald": "forest", "strand": "beach", "berg": "mountain", "stadt": "city", "dorf": "village",
                "wüste": "desert", "dschungel": "jungle", "meer": "ocean", "see": "lake", "fluss": "river",
                "garten": "garden", "wiese": "meadow", "feld": "field", "tal": "valley",
                "schloss": "castle", "burg": "castle", "höhle": "cave", "tempel": "temple", "palast": "palace",
                "haus": "house", "kirche": "church", "bibliothek": "library", "krankenhaus": "hospital",
                "schule": "school", "büro": "office", "fabrik": "factory",
                "raumschiff": "spaceship", "raumstation": "space station", "mond": "moon",
                "kerker": "dungeon", "turm": "tower", "festung": "fortress", "ruinen": "ruins"
              };
              return translations[loc] || loc;
            }
          }
          return "indoor location";
        };
        
        // Sub-locations within the main location for variety
        const getSubLocationVariants = (mainLoc: string): string[] => {
          const subLocations: Record<string, string[]> = {
            "city": ["on a busy street corner", "in a quiet alley", "at the city square", "on a rooftop", "near a fountain", "under street lights", "by the old buildings", "at a cafe terrace"],
            "forest": ["near a large oak tree", "by a small stream", "in a sunlit clearing", "among tall pines", "on a mossy rock", "at the forest edge", "under dense canopy", "near fallen logs"],
            "cave": ["near the entrance", "in a crystal chamber", "by underground water", "in a narrow passage", "at a large cavern", "near glowing minerals", "in the deep darkness", "at a rock formation"],
            "castle": ["in the great hall", "on the battlements", "in the courtyard", "by the throne", "in the dungeon", "on the tower stairs", "in the chapel", "at the gates"],
            "beach": ["at the water's edge", "on the sandy dunes", "near palm trees", "by the rocks", "at sunset shore", "on the pier", "near the cliffs", "in shallow waves"],
            "mountain": ["on a rocky ledge", "at the summit", "in a mountain pass", "by a waterfall", "near snow line", "on a grassy slope", "at base camp", "in a mountain cave"],
            "house": ["in the living room", "by the window", "in the kitchen", "on the stairs", "in the garden", "at the front door", "in the bedroom", "on the balcony"],
            "temple": ["at the altar", "in the main hall", "by stone pillars", "in the meditation room", "at the entrance", "near sacred statues", "in the inner sanctum", "at the courtyard"],
            "spaceship": ["on the bridge", "in the cargo bay", "at the viewport", "in the corridor", "at the control panel", "in the engine room", "at the airlock", "in the crew quarters"],
            "default": ["in a different area", "at another spot", "in a new section", "at a different angle", "in another corner", "at a new position", "from another view", "at a fresh location"]
          };
          return subLocations[mainLoc] || subLocations["default"];
        };
        
        const mainLocation = extractMainLocation(storyText);
        const subLocationVariants = getSubLocationVariants(mainLocation);
        const subLocation = subLocationVariants[(sceneIndex + attempt) % subLocationVariants.length];
        
        // ===== NEW STRUCTURED PROMPT - CHARACTER IDENTITY + SCENE-SPECIFIC POSE =====
        // Use the structured scene data (keyAction, emotion, specificArea) from storyboard generation
        // scenePoint already defined above for camera settings
        const sceneKeyAction = scenePoint?.keyAction || sceneKeywords;
        const sceneEmotion = scenePoint?.emotion || "neutral";
        const sceneSpecificArea = scenePoint?.specificArea || subLocation;
        const globalMainLocation = storyboardMainLocation || mainLocation;
        
        // Build the new structured image prompt
        const selectedArtStyle = ART_STYLE_ENGLISH[storyArtStyle] || storyArtStyle || "comic illustration";
        const enforceNonPhotoreal = !/photoreal|realistic|cinematic/i.test(selectedArtStyle);

        const imagePromptText = `
MANDATORY ART STYLE OVERRIDE (follow exactly):
Render the ENTIRE image in this visual style: ${selectedArtStyle}.
${enforceNonPhotoreal ? "DO NOT make this photorealistic. DO NOT make it look like a photograph." : ""}

MANDATORY CAMERA FRAMING (follow exactly):
${cameraInstruction || "Standard eye-level, medium shot framing."}

SCENE SETTING:
Location: ${globalMainLocation}, specifically ${sceneSpecificArea}.
${storyText}

CHARACTER IDENTITY (MUST copy ALL of these from reference image):
- Face: exact facial features, face shape, skin tone, freckles, scars
- Hair: exact color, style, length, texture
- Body: same body type and proportions
- Age: same approximate age
- Clothing & Accessories: COPY the outfit, helmet, glasses, hat, jewelry, uniform, armor - everything the person is wearing
- Distinguishing features: tattoos, piercings, makeup, any unique physical traits

CHARACTER POSE (create a NEW pose for this scene - do NOT copy the body position from reference):
Action: ${sceneKeyAction}
Expression: ${sceneEmotion}
The person must wear the SAME clothing/accessories as in the reference, but in a NEW body position fitting this scene.

TECHNICAL REQUIREMENTS:
- Exactly ONE person in the image
- Single cohesive image, NO collage or split screen
- Ultra high resolution final render in the selected art style (not photographic unless style requires it)
- Match lighting and atmosphere to the scene description
- 16:9 aspect ratio

CONTENT COMPLIANCE:
- All content is purely fictional and artistic. The reference images are hand-drawn/digitally created artwork, not photographs of real people.
- All generated content must comply with content guidelines and be appropriate for general audiences.
- Characters must appear clearly as adults (18+).
`.trim();
        
        console.log(`Scene ${sceneIndex + 1} attempt ${attempt}: Structured prompt with keyAction="${sceneKeyAction}", emotion="${sceneEmotion}", location="${globalMainLocation}/${sceneSpecificArea}"`);

        // === PARALLEL: Image + Video Prompt generation simultaneously ===
        const cleanBase64Images = characterBase64Images.map(img => img.replace(/^data:image\/[a-z]+;base64,/, ''));
        
        // 1) Start image generation (don't await yet)
        const imagePromise = fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
          {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
            },
            signal: controller.signal,
            body: JSON.stringify({
              prompt: imagePromptText,
              referenceImages: cleanBase64Images,
              aspectRatio: storyboardFormat,
              mode: "image",
              apiKey: apiKey
            }),
          }
        );

        // 2) Start video prompt generation simultaneously
        const videoPromptPromise = (async () => {
          try {
            const previousEndState = sceneIndex > 0 ? storyPoints[sceneIndex - 1]?.veo3EndState : null;
            
            // Build story synopsis for full narrative context
            const storySynopsis = storyPoints.map((sp, idx) => {
              const spText = (sp.detailedDescription || sp.versions[sp.currentVersion] || "").slice(0, 120);
              const marker = idx === sceneIndex ? " ← YOU ARE HERE" : "";
              return `${idx + 1}. "${spText}"${marker}`;
            }).join('\n');
            
            const prevScene = sceneIndex > 0 ? storyPoints[sceneIndex - 1] : null;
            const prevText = prevScene ? (prevScene.detailedDescription || prevScene.versions[prevScene.currentVersion] || "").slice(0, 80) : "";
            const nextScene = sceneIndex < storyPoints.length - 1 ? storyPoints[sceneIndex + 1] : null;
            const nextText = nextScene ? (nextScene.detailedDescription || nextScene.versions[nextScene.currentVersion] || "").slice(0, 80) : "";
            
            const dialogInfo = storyPoints[sceneIndex]?.dialogText ? `\nDIALOG: The character must visibly speak these EXACT words (original language, do NOT translate): "${storyPoints[sceneIndex].dialogText}"` : '';
            
            const videoPromptText = `You are a short-form video prompt writer for AI video generators (Veo3/Kling).

FULL STORY ARC (${storyPoints.length} scenes):
${storySynopsis}

CURRENT SCENE (${sceneIndex + 1}/${storyPoints.length}): "${storyText}"${dialogInfo}

NARRATIVE CONTEXT:
- Previous: ${prevText ? `"${prevText}" — end state: "${previousEndState || 'N/A'}"` : "None (this is the first scene)"}
- Purpose: What emotional/narrative beat does this scene deliver in the overall arc?
- Next: ${nextText ? `"${nextText}" — this scene must set up a logical visual transition` : "None (this is the final scene — end with impact)"}

Write a punchy video prompt (80-120 words, English):
- HOOK: Opening frame must grab attention instantly
- ACTION: Core movement and emotion that drives the story forward
- CONTINUITY: Visual elements must logically connect to previous/next scene
- PACING: Fast, dynamic, social-media energy
- Choose ONE camera movement that amplifies the emotion

CONTENT COMPLIANCE:
- All content is purely fictional and artistic. Reference images are digitally created artwork, not real photographs.
- All characters must appear clearly as adults (18+). Never describe or depict minors.
- Content must comply with platform guidelines and be appropriate for general audiences.

Respond ONLY with JSON: {"cameraMovement":"descriptive_id","startState":"...","motion":"...","endState":"...","fullPrompt":"..."}`;

            const vpText = await callGeminiOrFull(
              [{ text: videoPromptText }],
              { model: "gemini-2.0-flash", temperature: 0.7, maxOutputTokens: 500 }
            );
            
            if (vpText) {
              try {
                const parsed = extractJsonFromAiResponse(vpText);
                return {
                  videoPrompt: parsed.fullPrompt || "",
                  veo3CameraMovement: parsed.cameraMovement || "",
                  veo3StartState: parsed.startState || "",
                  veo3Motion: parsed.motion || "",
                  veo3EndState: parsed.endState || "",
                };
              } catch (e) {
                return { videoPrompt: vpText, veo3CameraMovement: "", veo3StartState: "", veo3Motion: "", veo3EndState: "" };
              }
            }
          } catch (e) {
            console.warn("Video prompt generation failed:", e);
          }
          return { videoPrompt: "", veo3CameraMovement: "", veo3StartState: "", veo3Motion: "", veo3EndState: "" };
        })();

        // 3) Await BOTH in parallel
        const [imageResponse, vpResult] = await Promise.all([imagePromise, videoPromptPromise]);

        if (!imageResponse.ok) {
          const errorData = await imageResponse.json().catch(() => ({}));
          throw new Error(errorData.error || getErrorMessageFromStatus(imageResponse.status, `Szene ${sceneIndex + 1}`));
        }

        const imageResult = await imageResponse.json();
        
        if (!imageResult.success) {
          console.warn(`Scene ${sceneIndex + 1} attempt ${attempt}: ${imageResult.error}`);
          throw new Error(imageResult.error || `Kein Bild generiert`);
        }

        let generatedImageUrl = "";
        if (imageResult.imageBase64) {
          const binary = atob(imageResult.imageBase64);
          const bytes = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) {
            bytes[j] = binary.charCodeAt(j);
          }
          const blob = new Blob([bytes], { type: imageResult.mimeType || "image/png" });
          generatedImageUrl = URL.createObjectURL(blob);
        }
        
        if (!generatedImageUrl) {
          throw new Error(`Kein Bild generiert`);
        }

        clearTimeout(timeoutId);
        return {
          success: true,
          generatedImageUrl,
          detailedImagePrompt: imagePromptText,
          videoPrompt: vpResult.videoPrompt,
          sceneTitle: storyText.split(/[.!?]/)[0].substring(0, 50).trim(),
          sceneDescription: storyText,
          veo3CameraMovement: vpResult.veo3CameraMovement,
          veo3StartState: vpResult.veo3StartState,
          veo3Motion: vpResult.veo3Motion,
          veo3EndState: vpResult.veo3EndState
        };

      } catch (error) {
        clearTimeout(timeoutId);
        console.error(`Attempt ${attempt}/${maxRetries} failed for scene ${sceneIndex + 1}:`, error);
        
        if (attempt < maxRetries) {
          const delayMs = attempt <= 2 ? 2000 : 3000;
          console.log(`🔄 Scene ${sceneIndex + 1}: Attempt ${attempt} failed, trying ${attempt + 1} in ${delayMs/1000}s...`);

          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        
        let errorMessage = "Unbekannter Fehler";
        if (error instanceof Error) {
          errorMessage = error.name === 'AbortError' ? `Zeitüberschreitung (2 Min.)` : error.message;
        }
        
        return { success: false, errorMessage };
      }
    }
    
    return { success: false, errorMessage: "Alle Versuche fehlgeschlagen" };
  };

  // Generate images and video prompts for all story points (2 parallel)
  const generateStoryImagesAndPrompts = async () => {
    if (!apiKey || storyPoints.length === 0 || isGeneratingStoryImages) return;
    
    setIsGeneratingStoryImages(true);
    setStorySetupCollapsed(true); // Auto-collapse setup panel
    
    // Get character reference images from STORY reference images (URLs) as base64
    const characterBase64Images: string[] = [];
    console.log(`📸 Loading ${storyReferenceImages.length} story reference images...`);
    
    for (const imageUrl of storyReferenceImages) {
      try {
        console.log(`  Fetching: ${imageUrl.substring(0, 50)}...`);
        // Fetch the image URL and convert to base64
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.error(`  ❌ Failed to fetch image: ${response.status}`);
          continue;
        }
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            if (base64Data) {
              console.log(`  ✅ Loaded ${Math.round(base64Data.length / 1024)}KB`);
              resolve(base64Data);
            } else {
              reject(new Error('No base64 data'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        characterBase64Images.push(base64);
      } catch (error) {
        console.error('Error converting story reference image to base64:', error);
      }
    }
    
    console.log(`📸 Successfully loaded ${characterBase64Images.length}/${storyReferenceImages.length} reference images`);
    
    // CRITICAL: If no reference images loaded, show error and stop
    if (characterBase64Images.length === 0 && storyReferenceImages.length > 0) {
      console.error("Fehler: Keine Referenzbilder - Die hochgeladenen Referenzbilder konnten nicht geladen werden.");
      setIsGeneratingStoryImages(false);
      return;
    }
    
    let successCount = 0;
    // FULLY AUTOMATIC - retries INDEFINITELY until success (no max limit)
    const RETRIES_PER_CYCLE = 3; // 3 retries per cycle
    
    // Track the last successfully generated image for use as reference for next scenes
    let lastGeneratedImageBase64: string | null = null;
    
    // Process scenes SEQUENTIALLY - each scene MUST succeed before moving to next
    for (let sceneIndex = 0; sceneIndex < storyPoints.length; sceneIndex++) {
      const point = storyPoints[sceneIndex];
      const previousScenePrompt = sceneIndex > 0 ? storyPoints[sceneIndex - 1]?.detailedImagePrompt : null;
      
      // Update UI to show which scene is being generated
      setGeneratingStoryImageIndex(sceneIndex);
      
      // VEREINFACHTE REFERENZBILD-LOGIK:
      // Jede Szene verwendet NUR die ursprünglichen Referenzbilder von oben
      // Keine vorherige Szene mehr als Referenz
      const sceneReferenceImages = [...characterBase64Images];
      console.log(`Szene ${sceneIndex + 1}: Verwende ${sceneReferenceImages.length} Original-Referenzbilder`);
      
      // INFINITE RETRY LOOP - keeps trying until success (no max cycles)
      let result: any = null;
      let totalAttempts = 0;
      let cycleNumber = 0;
      
      while (!result?.success) {
        cycleNumber++;
        console.log(`Szene ${sceneIndex + 1}: Zyklus ${cycleNumber} mit ${RETRIES_PER_CYCLE} Taktiken...`);
        
        if (cycleNumber > 1) {
          // Longer pause between cycles - increases with each failed cycle
          const waitTime = Math.min(5 + (cycleNumber - 1) * 2, 15); // 5s, 7s, 9s, ... max 15s
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        }
        
        result = await generateSingleStoryScene(
          sceneIndex,
          point,
          sceneReferenceImages,
          previousScenePrompt,
          RETRIES_PER_CYCLE
        );
        
        totalAttempts += RETRIES_PER_CYCLE;
        
        if (result.success) {
          console.log(`✅ Szene ${sceneIndex + 1} erfolgreich nach ${totalAttempts} Gesamtversuchen (Zyklus ${cycleNumber})`);
          break;
        }
        
        console.log(`❌ Szene ${sceneIndex + 1} Zyklus ${cycleNumber} fehlgeschlagen, starte automatisch nächsten Zyklus...`);
      }
      
      // Success guaranteed at this point (loop only exits on success)
      // Store the original image URL without any labels baked in
      const finalImageUrl = result.generatedImageUrl;
      
      setStoryPoints(prev => prev.map((p, idx) => {
        if (idx === sceneIndex) {
          // Create a snapshot of current settings to track changes
          const generationSnapshot = {
            summary: p.summary,
            detailedDescription: p.detailedDescription,
            keyAction: p.keyAction,
            specificArea: p.specificArea,
            emotion: p.emotion,
            audienceEffect: p.audienceEffect,
            cameraAngle: p.cameraAngle,
            shotType: p.shotType,
            composition: p.composition,
            movement: p.movement,
            participants: p.participants,
            negativePrompts: p.negativePrompts,
            styleNotes: p.styleNotes,
            continuityNotes: p.continuityNotes,
          };
          const updatedPoint = {
            ...p,
            generatedImage: finalImageUrl,
            detailedImagePrompt: result.detailedImagePrompt,
            videoPrompt: result.videoPrompt,
            sceneTitle: result.sceneTitle,
            sceneDescription: result.sceneDescription,
            veo3CameraMovement: result.veo3CameraMovement,
            veo3StartState: result.veo3StartState,
            veo3Motion: result.veo3Motion,
            veo3EndState: result.veo3EndState,
            generationError: undefined,
            generationSnapshot,
          };
          // Auto-save as version 1 on initial generation
          const SNAPSHOT_FIELDS = ['summary', 'detailedDescription', 'dialogText', 'videoPrompt', 'cameraAngle', 'shotType', 'keyAction', 'specificArea', 'emotion', 'audienceEffect', 'composition', 'movement', 'negativePrompts', 'styleNotes', 'continuityNotes', 'generatedImage', 'generatedVideo', 'detailedImagePrompt'] as const;
          const versionSnapshot: Record<string, any> = {};
          for (const f of SNAPSHOT_FIELDS) {
            versionSnapshot[f] = updatedPoint[f];
          }
          const versions = [...(updatedPoint.sceneVersions || []), versionSnapshot];
          return { ...updatedPoint, sceneVersions: versions, currentSceneVersion: versions.length - 1 };
        }
        return p;
      }));
      successCount++;
      
      // Convert this image to base64 for the next scene
      if (result.generatedImageUrl) {
        try {
          const response = await fetch(result.generatedImageUrl);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              const base64Data = dataUrl.split(',')[1];
              if (base64Data) resolve(base64Data);
              else reject(new Error('No base64 data'));
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          lastGeneratedImageBase64 = base64;
        } catch (error) {
          console.warn('Could not convert generated image to base64 for reference:', error);
        }
      }
      
    }
    
    setGeneratingStoryImageIndex(null);
    setIsGeneratingStoryImages(false);
  };

  // Generate detailed ~200-word video prompts for all scenes
  const generateVideoPrompts = async () => {
    if (!apiKey || storyPoints.length === 0 || isGeneratingVideoPrompts) return;
    
    setIsGeneratingVideoPrompts(true);
    
    for (let i = 0; i < storyPoints.length; i++) {
      const point = storyPoints[i];
      if (!point.generatedImage) continue;
      
      setGeneratingVideoPromptIndex(i);
      
      // Gather all scene metadata
      const sceneText = point.detailedDescription || point.versions[point.currentVersion] || "";
      const previousEndState = i > 0 ? storyPoints[i - 1]?.veo3EndState : null;
      const usedMovements = storyPoints.slice(0, i).map(p => p.veo3CameraMovement).filter(Boolean);
      const availableMovements = VEO3_CAMERA_MOVEMENTS.filter(m => !usedMovements.includes(m.id));
      
      // Build metadata context
      const metadataLines: string[] = [];
      if (point.emotion) metadataLines.push(`Emotion: ${emotionToEnglish[point.emotion] || point.emotion}`);
      if (point.keyAction) metadataLines.push(`Pose/Aktion: ${actionToEnglish[point.keyAction] || point.keyAction}`);
      if (point.specificArea) metadataLines.push(`Bereich: ${areaToEnglish[point.specificArea] || point.specificArea}`);
      if (point.cameraAngle) metadataLines.push(`Kamerawinkel: ${cameraAngleToEnglish[point.cameraAngle] || point.cameraAngle}`);
      if (point.shotType) metadataLines.push(`Shot-Typ: ${shotTypeToEnglish[point.shotType] || point.shotType}`);
      if (point.composition) metadataLines.push(`Komposition: ${compositionToEnglish[point.composition] || point.composition}`);
      if (point.movement) metadataLines.push(`Kamerabewegung: ${movementToEnglish[point.movement] || point.movement}`);
      if (point.audienceEffect) metadataLines.push(`Wirkung: ${effectToEnglish[point.audienceEffect] || point.audienceEffect}`);
      if (storyboardMainLocation) metadataLines.push(`Hauptort: ${storyboardMainLocation}`);
      if (point.styleNotes) metadataLines.push(`Stil-Hinweise: ${point.styleNotes}`);
      if (point.continuityNotes) metadataLines.push(`Kontinuitäts-Hinweise: ${point.continuityNotes}`);
      if (point.dialogText) metadataLines.push(`Dialog/Sprache: "${point.dialogText}" - Integriere diesen gesprochenen Dialog WÖRTLICH in der Originalsprache in den Video-Prompt, sodass der Charakter genau diese Worte sichtbar spricht. Der Dialog darf NICHT ins Englische übersetzt werden.`);
      
      const isLastScene = i === storyPoints.length - 1;
      const nextScene = !isLastScene ? storyPoints[i + 1] : null;
      const nextSceneText = nextScene ? (nextScene.detailedDescription || nextScene.versions[nextScene.currentVersion] || "") : "";
      
      // Build story synopsis for full narrative context
      const storySynopsis = storyPoints.map((sp, idx) => {
        const spText = (sp.detailedDescription || sp.versions[sp.currentVersion] || "").slice(0, 120);
        const marker = idx === i ? " ← YOU ARE HERE" : "";
        return `${idx + 1}. "${spText}"${marker}`;
      }).join('\n');
      
      const prevScene = i > 0 ? storyPoints[i - 1] : null;
      const prevText = prevScene ? (prevScene.detailedDescription || prevScene.versions[prevScene.currentVersion] || "").slice(0, 80) : "";
      
      const dialogLine = point.dialogText ? `\nDIALOG: The character must visibly speak these EXACT words (original language, do NOT translate): "${point.dialogText}"` : '';

      const videoPromptRequest = `You are a short-form video prompt writer for AI video generators (Veo3/Kling).

FULL STORY ARC (${storyPoints.length} scenes):
${storySynopsis}

CURRENT SCENE (${i + 1}/${storyPoints.length}): "${sceneText}"${dialogLine}

SCENE METADATA:
${metadataLines.length > 0 ? metadataLines.join('\n') : 'No specific settings'}

NARRATIVE CONTEXT:
- Previous: ${prevText ? `"${prevText}" — end state: "${previousEndState || 'N/A'}"` : "None (this is the first scene — open with a strong hook)"}
- Purpose: What emotional/narrative beat does this scene deliver in the overall arc?
- Next: ${nextSceneText ? `"${nextSceneText}" — this scene must set up a logical visual transition to the next` : "None (this is the final scene — end with maximum impact)"}

Write a punchy video prompt (80-120 words, English):
- HOOK: Opening frame must grab attention instantly
- ACTION: Core movement and emotion that drives the story forward
- CONTINUITY: Visual elements must logically connect to previous/next scene
- PACING: Fast, dynamic, social-media energy
- Choose ONE camera movement that amplifies the emotion

Respond ONLY with JSON:
{
  "videoPrompt": "The complete English video prompt (80-120 words)",
  "cameraMovement": "descriptive camera movement id",
  "startState": "Start frame description (1 sentence)",
  "motion": "Motion description (1 sentence)",
  "endState": "End frame description (1 sentence)"
}`;

      // Collect reference images for visual context
      const videoReferenceImages: string[] = [];
      
      // Add global story reference images
      for (const imageUrl of storyReferenceImages) {
        try {
          const imgResponse = await fetch(imageUrl);
          const blob = await imgResponse.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          videoReferenceImages.push(base64);
        } catch (e) {
          console.warn("Could not load story reference image for video prompt:", e);
        }
      }
      
      // Add previous scene's generated image as reference (i-1)
      if (i > 0 && storyPoints[i - 1]?.generatedImage) {
        try {
          const prevImgResponse = await fetch(storyPoints[i - 1].generatedImage!);
          const prevBlob = await prevImgResponse.blob();
          const prevBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(prevBlob);
          });
          videoReferenceImages.push(prevBase64);
        } catch (e) {
          console.warn("Could not load previous scene image for video prompt:", e);
        }
      }
      
      // Add current scene's generated image as START-FRAME reference (i)
      if (point.generatedImage) {
        try {
          const currentImgResponse = await fetch(point.generatedImage);
          const currentBlob = await currentImgResponse.blob();
          const currentBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(currentBlob);
          });
          videoReferenceImages.push(currentBase64);
        } catch (e) {
          console.warn("Could not load current scene image for video prompt:", e);
        }
      }
      
      // Add next scene's generated image as END-FRAME reference (i+1)
      if (storyPoints[i + 1]?.generatedImage) {
        try {
          const nextImgResponse = await fetch(storyPoints[i + 1].generatedImage!);
          const nextBlob = await nextImgResponse.blob();
          const nextBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(nextBlob);
          });
          videoReferenceImages.push(nextBase64);
        } catch (e) {
          console.warn("Could not load next scene image for video prompt:", e);
        }
      }
      
      const prevCount = (i > 0 && storyPoints[i - 1]?.generatedImage) ? 1 : 0;
      const currentCount = point.generatedImage ? 1 : 0;
      const nextCount = storyPoints[i + 1]?.generatedImage ? 1 : 0;
      console.log(`🎬 Szene ${i + 1}: ${videoReferenceImages.length} Referenzbilder für Video-Prompt (${storyReferenceImages.length} global + ${prevCount} vorherige + ${currentCount} aktuelle + ${nextCount} nächste Szene)`);

      try {
        // Build parts: text + optional reference images
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: videoPromptRequest }];
        if (videoReferenceImages.length > 0) {
          for (const img of videoReferenceImages) {
            const cleanB64 = img.replace(/^data:image\/[a-z]+;base64,/, '');
            parts.push({ inlineData: { mimeType: "image/png", data: cleanB64 } });
          }
        }
        
        const text = await callGeminiOrFull(parts, { model: "gemini-2.0-flash", temperature: 0.7, maxOutputTokens: 500 });
        
        if (text) {
          try {
            const parsed = extractJsonFromAiResponse(text);
            setStoryPoints(prev => prev.map((p, idx) => {
              if (idx !== i) return p;
              return {
                ...p,
                videoPrompt: parsed.videoPrompt || parsed.fullPrompt || text,
                veo3CameraMovement: parsed.cameraMovement || p.veo3CameraMovement || "",
                veo3StartState: parsed.startState || p.veo3StartState || "",
                veo3Motion: parsed.motion || p.veo3Motion || "",
                veo3EndState: parsed.endState || p.veo3EndState || "",
              };
            }));
          } catch (e) {
            setStoryPoints(prev => prev.map((p, idx) => {
              if (idx !== i) return p;
              return { ...p, videoPrompt: text };
            }));
          }
        }
      } catch (error) {
        console.warn(`Video prompt generation failed for scene ${i + 1}:`, error);
      }
      
      // Small delay between requests to avoid rate limiting
      if (i < storyPoints.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    setGeneratingVideoPromptIndex(null);
    setIsGeneratingVideoPrompts(false);
  };

  // Session-level cache for working Veo payload format and model
  const veoWorkingConfigRef = React.useRef<{ payloadFormat: 'inlineData' | 'bytesBase64Encoded' | null; model: string | null }>({ payloadFormat: null, model: null });

  // Helper: Build Veo request body (bytesBase64Encoded only)
  const buildVeoRequestBody = (prompt: string, startImageBase64: string, endImageBase64?: string) => {
    const cleanStartBase64 = startImageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
    const complianceNote = "CONTENT COMPLIANCE: This is purely fictional artistic content. All reference images are digitally created artwork. All depicted characters are adults (18+). ";
    const instance: any = { prompt: complianceNote + prompt };

    instance.image = { bytesBase64Encoded: cleanStartBase64, mimeType: "image/png" };
    if (endImageBase64) {
      const cleanEnd = endImageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      instance.lastFrame = { bytesBase64Encoded: cleanEnd, mimeType: "image/png" };
    }

    return {
      instances: [instance],
      parameters: {
        aspectRatio: "16:9",
        durationSeconds: 8,
        personGeneration: "allow_adult",
      },
    };
  };

  // Helper: Start Gemini Veo video generation (bytesBase64Encoded, model fallback only)
  const startGeminiVideoGeneration = async (prompt: string, startImageBase64: string, endImageBase64?: string): Promise<string> => {
    const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
    const models = ["veo-3.1-generate-preview", "veo-3.1-fast-generate-preview"];

    // Try cached model first
    const cached = veoWorkingConfigRef.current;
    const orderedModels = cached.model 
      ? [cached.model, ...models.filter(m => m !== cached.model)]
      : models;

    const requestBody = buildVeoRequestBody(prompt, startImageBase64, endImageBase64);
    let lastError = "";

    for (const model of orderedModels) {
      console.log(`🎬 Veo attempt: model=${model}`);

      const response = await fetch(
        `${GEMINI_BASE}/models/${model}:predictLongRunning?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const operationName = data.name;
        if (!operationName) throw new Error("Keine Operation-ID erhalten");
        veoWorkingConfigRef.current = { payloadFormat: 'bytesBase64Encoded', model };
        console.log(`✅ Veo OK: model=${model}, op=${operationName}`);
        return operationName;
      }

      const errText = await response.text();
      console.warn(`⚠️ Veo ${model} → ${response.status}: ${errText.substring(0, 300)}`);

      if (response.status === 429) throw new Error("Rate limit erreicht. Bitte warte einen Moment.");
      if (response.status === 401 || response.status === 403) throw new Error("API-Key ungültig oder keine Berechtigung für Video-Generierung");

      if (response.status === 400) {
        lastError = errText.substring(0, 200);
        continue;
      }

      throw new Error(`Video-Generierung fehlgeschlagen: ${response.status} – ${errText.substring(0, 200)}`);
    }

    throw new Error(`Alle Veo-Modelle fehlgeschlagen. Letzter Fehler: ${lastError}`);
  };

  // Helper: Poll Gemini Veo video operation status with multi-path extraction
  const pollGeminiVideoOperation = async (operationName: string): Promise<{ status: string; videoUrl?: string; error?: string }> => {
    const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
    
    const response = await fetch(
      `${GEMINI_BASE}/${operationName}?key=${apiKey}`,
      { method: "GET" }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.warn("Status-Abfrage fehlgeschlagen:", response.status, errText);
      return { status: "processing" };
    }

    const data = await response.json();
    
    if (data.done) {
      // Check for error
      if (data.error) {
        const errMsg = data.error.message || JSON.stringify(data.error);
        console.error("❌ Veo operation error:", errMsg);
        // Safety filter detection
        if (errMsg.toLowerCase().includes('safety') || errMsg.toLowerCase().includes('blocked') || errMsg.toLowerCase().includes('filter')) {
          return { status: "failed", error: `Video durch Sicherheitsfilter blockiert: ${errMsg}` };
        }
        return { status: "failed", error: errMsg };
      }
      
      const resp = data.response || {};
      console.log("📦 Veo done – response keys:", Object.keys(resp).join(", "));
      
      // Multi-path video URI extraction
      const videoUri = 
        resp.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ||
        resp.generatedVideos?.[0]?.video?.uri ||
        resp.video?.uri ||
        resp.generateVideoResponse?.generatedSamples?.[0]?.uri ||
        null;

      if (videoUri) {
        const remoteUrl = videoUri.startsWith("http") 
          ? `${videoUri}${videoUri.includes('?') ? '&' : '?'}key=${apiKey}`
          : `${GEMINI_BASE}/${videoUri}?key=${apiKey}`;
        console.log("✅ Video URL extrahiert, konvertiere zu Blob...");
        try {
          const videoResp = await fetch(remoteUrl);
          if (!videoResp.ok) throw new Error(`Video download failed: ${videoResp.status}`);
          const videoBlob = await videoResp.blob();
          const blobUrl = URL.createObjectURL(videoBlob);
          console.log("✅ Video als Blob-URL gespeichert");
          return { status: "completed", videoUrl: blobUrl };
        } catch (dlErr) {
          console.warn("⚠️ Blob-Konvertierung fehlgeschlagen, nutze direkte URL:", dlErr);
          return { status: "completed", videoUrl: remoteUrl };
        }
      }
      
      // Fallback: direct base64 video in predictions
      const prediction = resp.predictions?.[0];
      if (prediction?.bytesBase64Encoded) {
        console.log("✅ Video als Base64 in predictions erhalten");
        const mimeType = prediction.mimeType || "video/mp4";
        const videoUrl = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;
        return { status: "completed", videoUrl };
      }

      // Check for raiMediaFilteredReasons (content policy)
      const filteredReasons = resp.generateVideoResponse?.raiMediaFilteredReasons;
      if (filteredReasons && Array.isArray(filteredReasons) && filteredReasons.length > 0) {
        console.error("❌ Video durch Inhaltsrichtlinie blockiert:", filteredReasons);
        // Translate common Veo content policy messages to German
        const translatedReasons = filteredReasons.map((reason: string) => {
          if (reason.includes("photorealistic children")) return "Das Bild enthält Personen, die als minderjährig eingestuft wurden. Bitte ändere das Referenzbild oder den Prompt, sodass die Figur eindeutig erwachsen wirkt.";
          if (reason.includes("violence")) return "Der Inhalt wurde wegen Gewaltdarstellung blockiert.";
          if (reason.includes("sexual")) return "Der Inhalt wurde wegen sexueller Darstellung blockiert.";
          if (reason.includes("dangerous")) return "Der Inhalt wurde als gefährlich eingestuft.";
          if (reason.includes("hate")) return "Der Inhalt wurde wegen Hassrede blockiert.";
          if (reason.includes("harassment")) return "Der Inhalt wurde wegen Belästigung blockiert.";
          if (reason.includes("deceptive")) return "Der Inhalt wurde als irreführend eingestuft.";
          return `Inhaltsrichtlinie: ${reason}`;
        });
        return { status: "failed", error: translatedReasons.join(" | ") };
      }

      // Structured diagnostics on failure
      const diagKeys = JSON.stringify(Object.keys(resp));
      const deepKeys = resp.generateVideoResponse ? JSON.stringify(Object.keys(resp.generateVideoResponse)) : "n/a";
      console.error(`❌ Kein Video gefunden. Response keys: ${diagKeys}, generateVideoResponse keys: ${deepKeys}`);
      console.error("📋 Response preview:", JSON.stringify(resp).substring(0, 800));
      return { status: "failed", error: "Video-Generierung fehlgeschlagen. Bitte den Prompt oder das Bild anpassen und erneut versuchen." };
    }
    
    // Log progress metadata if available
    if (data.metadata) {
      console.log("⏳ Veo progress:", JSON.stringify(data.metadata).substring(0, 200));
    }
    
    return { status: "processing" };
  };

  // Helper: Convert image URL/blob to base64
  const imageToBase64 = async (imageUrl: string): Promise<string> => {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  // Helper: Start one video, poll until done, auto-retry on internal server errors
  const generateAndPollSingleVideo = async (
    sceneIndex: number, 
    point: typeof storyPoints[0], 
    nextImage?: string
  ): Promise<void> => {
    const MAX_RETRIES = 2;
    
    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      try {
        if (retry > 0) {
          console.log(`🔄 Szene ${sceneIndex + 1}: Erneuter Versuch ${retry}/${MAX_RETRIES}...`);
          setVideoErrors(prev => {
            const n = new Map(prev);
            n.set(sceneIndex, `Server-Fehler – erneuter Versuch ${retry}/${MAX_RETRIES}...`);
            return n;
          });
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 15000));
        }

        setGeneratingVideoIndex(sceneIndex);
        setVideoGenerationPhase("generating");
        // Clear previous error for this scene on new attempt
        setVideoErrors(prev => { const n = new Map(prev); n.delete(sceneIndex); return n; });

        const startBase64 = await imageToBase64(point.generatedImage!);
        const endBase64 = nextImage ? await imageToBase64(nextImage) : undefined;

        const operationName = await startGeminiVideoGeneration(point.videoPrompt!, startBase64, endBase64);
        console.log(`✅ Szene ${sceneIndex + 1}: Video-Operation gestartet: ${operationName}`);
        setVideoTaskIds(prev => new Map(prev).set(sceneIndex, operationName));

        // Poll for result
        setVideoGenerationPhase("polling");
        const maxPolls = 90;
        let pollCount = 0;

        while (pollCount < maxPolls) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          pollCount++;

          try {
            const result = await pollGeminiVideoOperation(operationName);
            console.log(`📊 Szene ${sceneIndex + 1} Status: ${result.status}`);

            if (result.status === "completed" && result.videoUrl) {
              setVideoResults(prev => new Map(prev).set(sceneIndex, result.videoUrl!));
              setStoryPoints(prev => prev.map((p, i) =>
                i === sceneIndex ? { ...p, generatedVideo: result.videoUrl } : p
              ));
              return; // Success – exit retry loop
            } else if (result.status === "failed") {
              const isInternalError = result.error?.toLowerCase().includes('internal') || 
                                      result.error?.toLowerCase().includes('server');
              if (isInternalError && retry < MAX_RETRIES) {
                console.warn(`⚠️ Szene ${sceneIndex + 1}: Interner Server-Fehler, wird erneut versucht...`);
                break; // Break poll loop to retry
              }
              setVideoErrors(prev => new Map(prev).set(sceneIndex, result.error || "Video-Generierung fehlgeschlagen"));
              return; // Non-retryable failure
            }
          } catch (error) {
            console.warn(`⚠️ Status-Abfrage Szene ${sceneIndex + 1} fehlgeschlagen:`, error);
          }
        }

        if (pollCount >= maxPolls) {
          setVideoErrors(prev => new Map(prev).set(sceneIndex, "Zeitüberschreitung"));
          return;
        }
        // If we broke out of poll loop due to internal error, continue retry loop
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Netzwerkfehler";
        // Don't retry rate limits or auth errors
        if (errMsg.includes('Rate limit') || errMsg.includes('API-Key')) {
          setVideoErrors(prev => new Map(prev).set(sceneIndex, errMsg));
          return;
        }
        if (retry >= MAX_RETRIES) {
          console.error(`❌ Szene ${sceneIndex + 1} endgültig fehlgeschlagen:`, error);
          setVideoErrors(prev => new Map(prev).set(sceneIndex, errMsg));
          return;
        }
      }
    }
  };

  // Generate videos via Gemini Veo API – sequential, one at a time
  const generateVideos = async () => {
    if (storyPoints.length === 0 || isGeneratingVideos || !apiKey) return;
    
    setIsGeneratingVideos(true);
    setVideoErrors(new Map());
    setVideoResults(new Map());
    setVideoTaskIds(new Map());
    
    for (let i = 0; i < storyPoints.length; i++) {
      const point = storyPoints[i];
      if (!point.generatedImage || !point.videoPrompt) continue;
      
      const nextImage = storyPoints[i + 1]?.generatedImage;
      await generateAndPollSingleVideo(i, point, nextImage);
    }
    
    setVideoGenerationPhase("idle");
    setIsGeneratingVideos(false);
    setGeneratingVideoIndex(null);
  };

  // Check if image-affecting fields changed since last generation
  const hasImageFieldsChanged = (point: typeof storyPoints[number]): boolean => {
    if (!point.generationSnapshot) return false;
    const imageFields = ['summary', 'detailedDescription', 'keyAction', 'specificArea', 'emotion', 'audienceEffect', 'cameraAngle', 'shotType', 'composition', 'movement', 'participants', 'negativePrompts', 'styleNotes', 'continuityNotes'];
    for (const field of imageFields) {
      if ((point as any)[field] !== point.generationSnapshot[field]) {
        return true;
      }
    }
    return false;
  };

  // Regenerate a single video for a specific scene (uses shared helper with retry)
  // If image-affecting fields changed, regenerates image first, then video
  // If only dialogText/videoPrompt changed, goes straight to video
  const regenerateSingleVideo = async (sceneIndex: number) => {
    let point = storyPointsRef.current[sceneIndex];
    if (!point.videoPrompt || isGeneratingVideos || !apiKey) return;
    if (!point.generatedImage && !hasImageFieldsChanged(point)) return;
    
    setVideoErrors(prev => { const n = new Map(prev); n.delete(sceneIndex); return n; });
    setVideoResults(prev => { const n = new Map(prev); n.delete(sceneIndex); return n; });
    setStoryPoints(prev => prev.map((p, i) => i === sceneIndex ? { ...p, generatedVideo: undefined } : p));
    
    // If image-affecting fields changed, regenerate image first
    if (hasImageFieldsChanged(point)) {
      setRegeneratingPointIndex(sceneIndex);
      setRegeneratingImageOnlyIndex(sceneIndex);
      
      setStoryPoints(prev => prev.map((p, idx) => idx === sceneIndex ? { ...p, generationError: undefined } : p));
      
      // Get character reference images
      const characterBase64Images: string[] = [];
      for (const imageUrl of storyReferenceImages) {
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              const base64Data = result.split(',')[1];
              if (base64Data) resolve(base64Data);
              else reject(new Error('No base64 data'));
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          characterBase64Images.push(base64);
        } catch (error) {
          console.error('Error converting story reference image to base64:', error);
        }
      }
      
      const previousSceneImage = sceneIndex > 0 ? storyPointsRef.current[sceneIndex - 1]?.generatedImage : null;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 40000);
      
      try {
        const imagePromptText = await generateImagePromptViaAI(point, sceneIndex);
        const allReferenceImages: string[] = [...characterBase64Images];
        
        if (previousSceneImage) {
          try {
            const response = await fetch(previousSceneImage);
            const blob = await response.blob();
            const prevBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
              reader.readAsDataURL(blob);
            });
            allReferenceImages.push(prevBase64);
          } catch (error) {
            console.error('Error converting previous scene image:', error);
          }
        }
        
        const imageResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
          {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
            },
            signal: controller.signal,
            body: JSON.stringify({
              prompt: imagePromptText,
              referenceImages: allReferenceImages,
              aspectRatio: storyboardFormat,
              mode: "image",
              apiKey: apiKey
            }),
          }
        );
        
        clearTimeout(timeoutId);
        
        if (!imageResponse.ok) {
          const errorData = await imageResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `API Error: ${imageResponse.status}`);
        }
        
        const imageResult = await imageResponse.json();
        if (!imageResult.success) throw new Error(imageResult.error || "Kein Bild generiert");
        
        let generatedImageUrl = "";
        if (imageResult.imageBase64) {
          const binary = atob(imageResult.imageBase64);
          const bytes = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
          const blob = new Blob([bytes], { type: imageResult.mimeType || "image/png" });
          generatedImageUrl = URL.createObjectURL(blob);
        }
        
        if (!generatedImageUrl) throw new Error("Kein Bild generiert");
        
        const currentPointForSnapshot = storyPointsRef.current[sceneIndex];
        const generationSnapshot = {
          summary: currentPointForSnapshot.summary, detailedDescription: currentPointForSnapshot.detailedDescription,
          keyAction: currentPointForSnapshot.keyAction, specificArea: currentPointForSnapshot.specificArea,
          emotion: currentPointForSnapshot.emotion, audienceEffect: currentPointForSnapshot.audienceEffect,
          cameraAngle: currentPointForSnapshot.cameraAngle, shotType: currentPointForSnapshot.shotType,
          composition: currentPointForSnapshot.composition, movement: currentPointForSnapshot.movement,
          participants: currentPointForSnapshot.participants, negativePrompts: currentPointForSnapshot.negativePrompts,
          styleNotes: currentPointForSnapshot.styleNotes, continuityNotes: currentPointForSnapshot.continuityNotes,
        };
        
        setStoryPoints(prev => prev.map((p, idx) => {
          if (idx === sceneIndex) {
            return { ...p, generatedImage: generatedImageUrl, detailedImagePrompt: imagePromptText, generationError: undefined, generationSnapshot };
          }
          return p;
        }));
        
        setRegeneratingImageOnlyIndex(null);
        setJustFinishedImageOnlyIndex(sceneIndex);
        setTimeout(() => setJustFinishedImageOnlyIndex(null), 700);
        
      } catch (error) {
        clearTimeout(timeoutId);
        let errorMessage = "Unbekannter Fehler";
        if (error instanceof Error) {
          errorMessage = error.name === 'AbortError' ? "Zeitüberschreitung – keine Antwort nach 40s" : error.message;
        }
        console.error(`Bild-Regeneration Szene ${sceneIndex + 1} fehlgeschlagen:`, errorMessage);
        setStoryPoints(prev => prev.map((p, idx) => idx === sceneIndex ? { ...p, generationError: errorMessage } : p));
        setRegeneratingImageOnlyIndex(null);
        setRegeneratingPointIndex(null);
        return; // Don't continue to video if image failed
      } finally {
        setRegeneratingImageOnlyIndex(null);
        setRegeneratingPointIndex(null);
      }
    }
    
    // Now generate video — read fresh state from ref
    setIsGeneratingVideos(true);
    
    let freshPoint = storyPointsRef.current[sceneIndex];
    
    // Regenerate video prompt with latest dialogText and scene data
    try {
      const currentStoryPoints = storyPointsRef.current;
      const previousEndState = sceneIndex > 0 ? currentStoryPoints[sceneIndex - 1]?.veo3EndState : null;
      
      const storySynopsis = currentStoryPoints.map((sp, idx) => {
        const spText = (sp.detailedDescription || sp.versions[sp.currentVersion] || "").slice(0, 120);
        const marker = idx === sceneIndex ? " ← YOU ARE HERE" : "";
        return `${idx + 1}. "${spText}"${marker}`;
      }).join('\n');
      
      const storyText = freshPoint.detailedDescription || freshPoint.versions[freshPoint.currentVersion] || "";
      const prevScene = sceneIndex > 0 ? currentStoryPoints[sceneIndex - 1] : null;
      const prevText = prevScene ? (prevScene.detailedDescription || prevScene.versions[prevScene.currentVersion] || "").slice(0, 80) : "";
      const nextScene = sceneIndex < currentStoryPoints.length - 1 ? currentStoryPoints[sceneIndex + 1] : null;
      const nextText = nextScene ? (nextScene.detailedDescription || nextScene.versions[nextScene.currentVersion] || "").slice(0, 80) : "";
      
      const dialogInfo = freshPoint.dialogText ? `\nDIALOG: The character must visibly speak these EXACT words (original language, do NOT translate): "${freshPoint.dialogText}"` : '';
      
      const videoPromptText = `You are a short-form video prompt writer for AI video generators (Veo3/Kling).

FULL STORY ARC (${currentStoryPoints.length} scenes):
${storySynopsis}

CURRENT SCENE (${sceneIndex + 1}/${currentStoryPoints.length}): "${storyText}"${dialogInfo}

NARRATIVE CONTEXT:
- Previous: ${prevText ? `"${prevText}" — end state: "${previousEndState || 'N/A'}"` : "None (this is the first scene)"}
- Purpose: What emotional/narrative beat does this scene deliver in the overall arc?
- Next: ${nextText ? `"${nextText}" — this scene must set up a logical visual transition` : "None (this is the final scene — end with impact)"}

Write a punchy video prompt (80-120 words, English):
- HOOK: Opening frame must grab attention instantly
- ACTION: Core movement and emotion that drives the story forward
- CONTINUITY: Visual elements must logically connect to previous/next scene
- PACING: Fast, dynamic, social-media energy
- Choose ONE camera movement that amplifies the emotion

CONTENT COMPLIANCE:
- All content is purely fictional and artistic. Reference images are digitally created artwork, not real photographs.
- All characters must appear clearly as adults (18+). Never describe or depict minors.
- Content must comply with platform guidelines and be appropriate for general audiences.

Respond ONLY with JSON: {"cameraMovement":"descriptive_id","startState":"...","motion":"...","endState":"...","fullPrompt":"..."}`;

      const vpText = await callGeminiOrFull(
        [{ text: videoPromptText }],
        { model: "gemini-2.0-flash", temperature: 0.7, maxOutputTokens: 500 }
      );
      
      if (vpText) {
        try {
          const parsed = extractJsonFromAiResponse(vpText);
          const vpUpdates = {
            videoPrompt: parsed.fullPrompt || freshPoint.videoPrompt,
            veo3CameraMovement: parsed.cameraMovement || "",
            veo3StartState: parsed.startState || "",
            veo3Motion: parsed.motion || "",
            veo3EndState: parsed.endState || "",
          };
          
          setStoryPoints(prev => prev.map((p, idx) => idx === sceneIndex ? { ...p, ...vpUpdates } : p));
          // Update ref immediately so generateAndPollSingleVideo uses fresh prompt
          storyPointsRef.current = storyPointsRef.current.map((p, idx) => idx === sceneIndex ? { ...p, ...vpUpdates } : p);
          freshPoint = storyPointsRef.current[sceneIndex];
          
          console.log(`Video prompt regenerated for scene ${sceneIndex + 1}:`, vpUpdates.videoPrompt?.slice(0, 80));
        } catch (e) {
          console.warn("Failed to parse regenerated video prompt, using raw text:", e);
          const vpUpdates = { videoPrompt: vpText };
          setStoryPoints(prev => prev.map((p, idx) => idx === sceneIndex ? { ...p, ...vpUpdates } : p));
          storyPointsRef.current = storyPointsRef.current.map((p, idx) => idx === sceneIndex ? { ...p, ...vpUpdates } : p);
          freshPoint = storyPointsRef.current[sceneIndex];
        }
      }
    } catch (e) {
      console.warn("Video prompt regeneration failed, using existing prompt:", e);
    }
    
    const nextImage = storyPointsRef.current[sceneIndex + 1]?.generatedImage;
    await generateAndPollSingleVideo(sceneIndex, freshPoint, nextImage);
    
    setVideoGenerationPhase("idle");
    setIsGeneratingVideos(false);
    setGeneratingVideoIndex(null);
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

  // ===== TRANSLATION MAPS for German dropdown values → English =====
  const emotionToEnglish: Record<string, string> = {
    "gluecklich": "happy, joyful expression",
    "traurig": "sad, melancholic expression",
    "nachdenklich": "thoughtful, pensive expression",
    "aufgeregt": "excited, energetic expression",
    "aengstlich": "fearful, anxious expression",
    "wuetend": "angry, furious expression",
    "ueberrascht": "surprised, astonished expression",
    "verliebt": "lovestruck, romantic expression",
    "verzweifelt": "desperate, distressed expression",
    "hoffnungsvoll": "hopeful, optimistic expression",
    "melancholisch": "melancholic, wistful expression",
    "entspannt": "relaxed, calm expression",
    "neutral": "neutral expression",
  };

  const actionToEnglish: Record<string, string> = {
    "steht": "standing",
    "geht": "walking",
    "sitzt": "sitting",
    "lehnt": "leaning",
    "schaut": "looking, gazing",
    "spricht": "speaking, talking",
    "rennt": "running",
    "wartet": "waiting",
    "greift": "reaching, grabbing",
    "haelt": "holding",
    "zeigt": "pointing, showing",
    "wendet-sich": "turning around",
  };

  const areaToEnglish: Record<string, string> = {
    "innenraum": "indoor setting",
    "aussenbereich": "outdoor setting",
    "strasse": "street, urban environment",
    "natur": "natural environment",
    "arbeitsplatz": "workplace, office",
    "zuhause": "home interior",
    "fahrzeug": "inside vehicle",
    "oeffentlicher-ort": "public place",
  };

  const effectToEnglish: Record<string, string> = {
    "spannung": "tense, suspenseful",
    "empathie": "empathetic, emotional",
    "freude": "joyful, uplifting",
    "unbehagen": "uneasy, uncomfortable",
    "neugier": "intriguing, curious",
    "erleichterung": "relieving, calming",
    "trauer": "sorrowful, mournful",
    "hoffnung": "hopeful, inspiring",
  };

  const compositionToEnglish: Record<string, string> = {
    "zentriert": "centered composition",
    "drittel-regel": "rule of thirds",
    "symmetrisch": "symmetrical composition",
    "diagonal": "diagonal composition",
    "rahmen-im-rahmen": "frame within frame",
  };

  const movementToEnglish: Record<string, string> = {
    "keine": "",
    "dolly-in": "dolly-in camera movement",
    "dolly-out": "dolly-out camera movement",
    "truck": "truck camera movement",
    "tilt": "tilt camera movement",
    "pan": "pan camera movement",
    "crane": "crane camera movement",
    "arc": "arc camera movement",
  };

  const cameraAngleToEnglish: Record<string, string> = {
    "frontal": "frontal shot, eye level",
    "seitlich": "side profile shot",
    "von-oben": "high angle shot, looking down",
    "von-unten": "low angle shot, looking up",
    "ueber-schulter": "over-the-shoulder shot",
    "dutch-angle": "dutch angle, tilted frame",
    "vogelperspektive": "bird's eye view",
    "froschperspektive": "worm's eye view, extreme low angle",
  };

  const shotTypeToEnglish: Record<string, string> = {
    "extreme-close-up": "extreme close-up showing only a detail (eyes, hands)",
    "close-up": "close-up of face from chin to forehead",
    "medium-close-up": "medium close-up from chest up",
    "medium-shot": "medium shot from waist up",
    "medium-long-shot": "medium long shot from knees up",
    "full-shot": "full body shot showing entire person",
    "long-shot": "long shot with character and environment",
    "extreme-long-shot": "extreme long shot, wide establishing shot",
  };

  // ===== BUILD SCENE CONTEXT (structured data for AI prompt generation) =====
  const buildSceneContext = (
    point: typeof storyPoints[0],
    sceneIndex: number
  ): string => {
    const lines: string[] = [];
    
    lines.push(`Scene ${sceneIndex + 1} of ${storyPoints.length}`);
    
    const styleDesc = ART_STYLE_ENGLISH[storyArtStyle] || storyArtStyle || "";
    if (styleDesc) lines.push(`Art Style: ${styleDesc}`);
    
    const shotType = point.shotType ? (shotTypeToEnglish[point.shotType] || point.shotType) : "medium shot";
    lines.push(`Shot Type: ${shotType}`);
    if (point.cameraAngle && point.cameraAngle !== 'random') {
      lines.push(`Camera Angle: ${cameraAngleToEnglish[point.cameraAngle] || point.cameraAngle}`);
    }
    if (point.composition) {
      lines.push(`Composition: ${compositionToEnglish[point.composition] || point.composition}`);
    }
    
    const locationParts: string[] = [];
    if (storyboardMainLocation) locationParts.push(storyboardMainLocation);
    if (point.specificArea) locationParts.push(areaToEnglish[point.specificArea] || point.specificArea);
    if (locationParts.length > 0) lines.push(`Location: ${locationParts.join(", ")}`);
    
    const sceneText = point.detailedDescription || point.versions[point.currentVersion] || "";
    if (sceneText) lines.push(`Scene Description: ${sceneText}`);
    
    if (point.keyAction) lines.push(`Action: ${actionToEnglish[point.keyAction] || point.keyAction}`);
    if (point.emotion) lines.push(`Expression: ${emotionToEnglish[point.emotion] || point.emotion}`);
    if (point.participants && point.participants.trim()) lines.push(`Participants: ${point.participants}`);
    
    if (point.audienceEffect) {
      lines.push(`Mood: ${effectToEnglish[point.audienceEffect] || point.audienceEffect}`);
    }
    
    if (point.movement && point.movement !== 'keine') {
      const movementEnglish = movementToEnglish[point.movement] || point.movement;
      if (movementEnglish) lines.push(`Camera Movement: ${movementEnglish}`);
    }
    
    if (point.styleNotes && point.styleNotes.trim()) lines.push(`Style Notes: ${point.styleNotes}`);
    if (point.continuityNotes && point.continuityNotes.trim()) lines.push(`Continuity Notes: ${point.continuityNotes}`);
    if (point.negativePrompts && point.negativePrompts.trim()) lines.push(`Avoid: ${point.negativePrompts}`);
    if ((point as any).videoPrompt && (point as any).videoPrompt.trim()) lines.push(`Video/Scene Context: ${(point as any).videoPrompt}`);
    if (storyCustomDetails && storyCustomDetails.trim()) lines.push(`Global Details: ${storyCustomDetails.trim()}`);
    
    return lines.join("\n");
  };

  // ===== GENERATE IMAGE PROMPT VIA TEXT-AI (Step 1: AI writes the prompt) =====
  const generateImagePromptViaAI = async (
    point: typeof storyPoints[0],
    sceneIndex: number
  ): Promise<string> => {
    const sceneContext = buildSceneContext(point, sceneIndex);
    
    const styleDesc = ART_STYLE_ENGLISH[storyArtStyle] || storyArtStyle || "";
    const styleBlock = styleDesc
      ? `\n\n!!! MANDATORY ART STYLE: "${styleDesc}" !!!\nThe ENTIRE image MUST be rendered in this style. Every element — characters, background, lighting, textures — must look like a ${styleDesc}. Do NOT render anything photorealistically unless the style explicitly says so. Describe the visual medium, textures, colors, and rendering technique of "${styleDesc}" in your prompt.\n`
      : "";
    
    const systemInstruction = `You are an expert image prompt writer. You MUST faithfully include ALL scene details below. Do NOT omit, simplify, or generalize any of them.
${styleBlock}
PRIORITY HIERARCHY (strictly follow this order):
1. User-defined scene settings (HIGHEST — always override defaults)
2. Scene uniqueness (each scene must look distinct)
3. Visual consistency with other scenes (LOWEST — only for character identity)

REQUIRED FIELDS — you MUST explicitly include EACH of these in your prompt:
- Art Style/Medium: ${styleDesc ? `"${styleDesc}" (MANDATORY — describe the visual medium, textures, rendering technique)` : "describe the visual style"}
- Shot Type: Use the EXACT shot type specified (e.g. close-up, full-shot). Do NOT change it.
- Camera Angle: Use the EXACT camera angle specified. Do NOT default to eye-level.
- Location + Specific Area: Describe the exact environment and sub-location.
- Character Action: Describe the EXACT action specified — not a generic standing/posing.
- Character Expression/Emotion: Show the SPECIFIC emotion on the character's face and body language.
- Composition: Follow any composition notes precisely.
- Camera Movement: Reflect any specified camera movement in the framing.
- Style Notes: Incorporate all additional style instructions.
- Avoid: Respect all negative prompts / things to avoid.

Rules:
- Write a single descriptive paragraph (max 250 words).${styleDesc ? `\n- START the prompt by describing the art style/medium (e.g. "A ${styleDesc} depicting..."). This is critical.` : ""}
- Reference images are ONLY for character identity (face, body, clothing) — do NOT copy pose, style, or scene from them.
- The character must have a NEW pose matching the scene action.
- Do NOT copy the visual style or medium of reference images.${styleDesc ? `\n- The visual style MUST be "${styleDesc}", NOT photorealistic, NOT a photograph.` : ""}
- Each scene must reflect its UNIQUE settings. Do NOT default to generic descriptions.
- CONTENT COMPLIANCE: All content is purely fictional and artistic. Reference images are digitally created artwork. All characters are clearly adults (18+).
- Output ONLY the image prompt text, nothing else. No explanations, no markdown, no quotes.

Scene Details:
${sceneContext}`;

    console.log(`🤖 Step 1: Asking Text-AI to write image prompt for scene ${sceneIndex + 1}...`);
    
    try {
      const aiPrompt = await callGeminiOrFull(
        [{ text: systemInstruction }],
        { model: "gemini-2.0-flash", temperature: 0.7, maxOutputTokens: 500 }
      );
      
      if (!aiPrompt) {
        console.warn("⚠️ Empty AI prompt, falling back to scene context");
        return sceneContext;
      }
      
      console.log(`✅ AI-generated image prompt for scene ${sceneIndex + 1}:`, aiPrompt.substring(0, 200) + '...');
      return aiPrompt;
    } catch (error) {
      console.warn("⚠️ AI prompt generation error, falling back to scene context:", error);
      return sceneContext;
    }
  };

  // Regenerate a single failed story scene - uses FULL PROMPT with all metadata
  // Can receive an optional updatedPoint with the latest edits from popup
  const regenerateSingleStoryScene = async (sceneIndex: number, updatedPoint?: typeof storyPoints[0], skipGuard?: boolean) => {
    if (!apiKey) return;
    if (!skipGuard && regeneratingPointIndex !== null) return;
    
    setRegeneratingPointIndex(sceneIndex);
    if (!skipGuard) {
      setRegeneratingCardIndex(sceneIndex); // Start flip-away animation (skip if already flipped from regenerateStoryPoint)
    }
    
    // Clear previous error AND old image so UI shows loading state
    setStoryPoints(prev => prev.map((p, idx) => {
      if (idx === sceneIndex) {
        return { ...p, generationError: undefined, generatedImage: undefined };
      }
      return p;
    }));
    
    // Use updatedPoint if provided (contains latest edits from popup), otherwise use latest ref state
    const point = updatedPoint || storyPointsRef.current[sceneIndex];
    console.log("🔍 Regenerating with point data:", {
      detailedDescription: point.detailedDescription,
      emotion: point.emotion,
      keyAction: point.keyAction,
      cameraAngle: point.cameraAngle,
      shotType: point.shotType,
      videoPrompt: (point as any).videoPrompt,
    });
    
    // Get character reference images from STORY reference images (URLs) as base64
    const characterBase64Images: string[] = [];
    for (const imageUrl of storyReferenceImages) {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            if (base64Data) resolve(base64Data);
            else reject(new Error('No base64 data'));
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        characterBase64Images.push(base64);
      } catch (error) {
        console.error('Error converting story reference image to base64:', error);
      }
    }
    
    // Get previous scene's image for continuity (NOT the current scene's old image)
    const previousSceneImage = sceneIndex > 0 ? storyPointsRef.current[sceneIndex - 1]?.generatedImage : null;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout
    
    try {
      // Step 1: Let Text-AI write the image prompt
      const imagePromptText = await generateImagePromptViaAI(point, sceneIndex);
      
      console.log(`🎨 Step 2: Sending AI-generated prompt to image AI for scene ${sceneIndex + 1}:`, imagePromptText.substring(0, 200) + '...');
      
      // Build image parts - collect all reference images as base64
      const allReferenceImages: string[] = [...characterBase64Images];
      
      // Add previous scene's image for visual continuity (NOT the current scene's old image)
      if (previousSceneImage) {
        try {
          const response = await fetch(previousSceneImage);
          const blob = await response.blob();
          const prevBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
          allReferenceImages.push(prevBase64);
        } catch (e) {
          console.warn("Could not add previous scene as reference:", e);
        }
      }
      
      // Call edge function for image generation
      const imageResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: imagePromptText,
            referenceImages: allReferenceImages,
            aspectRatio: storyboardFormat,
            mode: "image",
            apiKey: apiKey
          }),
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!imageResponse.ok) {
        const errorData = await imageResponse.json().catch(() => ({}));
        throw new Error(errorData.error || getErrorMessageFromStatus(imageResponse.status, "Bild"));
      }
      
      const imageResult = await imageResponse.json();
      
      if (!imageResult.success) {
        throw new Error(imageResult.error || "Kein Bild generiert");
      }
      
      let generatedImageUrl = "";
      
      // The edge function returns base64 and mimeType, convert to blob URL
      if (imageResult.imageBase64) {
        const binary = atob(imageResult.imageBase64);
        const bytes = new Uint8Array(binary.length);
        for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
        const blob = new Blob([bytes], { type: imageResult.mimeType || "image/png" });
        generatedImageUrl = URL.createObjectURL(blob);
      }
      
      if (!generatedImageUrl) {
        throw new Error("Kein Bild generiert");
      }
      
      // Success! Create snapshot from 'point' (the actual values used for generation)
      const generationSnapshot = {
        summary: point.summary,
        detailedDescription: point.detailedDescription,
        keyAction: point.keyAction,
        specificArea: point.specificArea,
        emotion: point.emotion,
        audienceEffect: point.audienceEffect,
        cameraAngle: point.cameraAngle,
        shotType: point.shotType,
        composition: point.composition,
        movement: point.movement,
        participants: point.participants,
        negativePrompts: point.negativePrompts,
        styleNotes: point.styleNotes,
        continuityNotes: point.continuityNotes,
      };
      
      // Clear stale video when image is regenerated (video no longer matches)
      const hadVideo = !!storyPointsRef.current[sceneIndex]?.generatedVideo;
      
      setStoryPoints(prev => prev.map((p, idx) => {
        if (idx === sceneIndex) {
          return {
            ...p,
            ...point, // Merge current point values to ensure state is in sync
            generatedImage: generatedImageUrl,
            detailedImagePrompt: imagePromptText,
            generationError: undefined,
            generationSnapshot,
            // Clear video if it existed — it's now stale since the image changed
            ...(hadVideo ? { generatedVideo: undefined } : {}),
          };
        }
        return p;
      }));
      
      // Trigger flip-back animation
      setRegeneratingCardIndex(null);
      setJustFinishedIndex(sceneIndex);
      setFlippedCards(prev => new Set(prev).add(sceneIndex));
      setTimeout(() => setJustFinishedIndex(null), 700);
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      let errorMessage = "Unbekannter Fehler";
      if (error instanceof Error) {
        errorMessage = error.name === 'AbortError' ? "Zeitüberschreitung – keine Antwort nach 20s" : error.message;
      }
      
      console.error(`Szene ${sceneIndex + 1} fehlgeschlagen:`, errorMessage);
      
      setStoryPoints(prev => prev.map((p, idx) => {
        if (idx === sceneIndex) {
          return { ...p, generationError: errorMessage };
        }
        return p;
      }));
    } finally {
      // Always unconditionally reset animation state
      setRegeneratingCardIndex(null);
      setRegeneratingPointIndex(null);
    }
  };

  // Regenerate image only (image flips, not the card) - used by hover overlay button
  const regenerateImageOnly = async (sceneIndex: number) => {
    if (!apiKey || regeneratingPointIndex !== null) return;
    
    setRegeneratingPointIndex(sceneIndex);
    setRegeneratingImageOnlyIndex(sceneIndex); // Only image flips
    
    // Clear previous error
    setStoryPoints(prev => prev.map((p, idx) => {
      if (idx === sceneIndex) {
        return { ...p, generationError: undefined };
      }
      return p;
    }));
    
    const point = storyPoints[sceneIndex];
    
    // Get character reference images from STORY reference images (URLs) as base64
    const characterBase64Images: string[] = [];
    for (const imageUrl of storyReferenceImages) {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            if (base64Data) resolve(base64Data);
            else reject(new Error('No base64 data'));
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        characterBase64Images.push(base64);
      } catch (error) {
        console.error('Error converting story reference image to base64:', error);
      }
    }
    
    // Get current scene's existing image for style/continuity reference (if regenerating)
    const currentSceneImage = point.generatedImage || null;
    // Also get previous scene's image for additional context
    const previousSceneImage = sceneIndex > 0 ? storyPoints[sceneIndex - 1]?.generatedImage : null;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 40000); // 40s timeout
    
    try {
      // Step 1: Let Text-AI write the image prompt
      const imagePromptText = await generateImagePromptViaAI(point, sceneIndex);

      // Build reference images array
      const allReferenceImages: string[] = [...characterBase64Images];
      
      // Add previous scene image for continuity
      if (previousSceneImage) {
        try {
          const response = await fetch(previousSceneImage);
          const blob = await response.blob();
          const prevBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
          allReferenceImages.push(prevBase64);
        } catch (error) {
          console.error('Error converting previous scene image:', error);
        }
      }
      
      // NOTE: Current scene's own image is intentionally NOT added as reference
      // to ensure a fresh generation without self-referencing

      // Call edge function for image generation (same as regenerateSingleStoryScene)
      const imageResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: imagePromptText,
            referenceImages: allReferenceImages,
            aspectRatio: storyboardFormat,
            mode: "image",
            apiKey: apiKey
          }),
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!imageResponse.ok) {
        const errorData = await imageResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error: ${imageResponse.status}`);
      }

      const imageResult = await imageResponse.json();
      
      if (!imageResult.success) {
        throw new Error(imageResult.error || "Kein Bild generiert");
      }

      let generatedImageUrl = "";
      
      // The edge function returns base64 and mimeType, convert to blob URL
      if (imageResult.imageBase64) {
        const binary = atob(imageResult.imageBase64);
        const bytes = new Uint8Array(binary.length);
        for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
        const blob = new Blob([bytes], { type: imageResult.mimeType || "image/png" });
        generatedImageUrl = URL.createObjectURL(blob);
      }
      
      if (!generatedImageUrl) {
        throw new Error("Kein Bild generiert");
      }
      
      // Create snapshot from 'point' (the actual values used for generation)
      const generationSnapshot = {
        summary: point.summary,
        detailedDescription: point.detailedDescription,
        keyAction: point.keyAction,
        specificArea: point.specificArea,
        emotion: point.emotion,
        audienceEffect: point.audienceEffect,
        cameraAngle: point.cameraAngle,
        shotType: point.shotType,
        composition: point.composition,
        movement: point.movement,
        participants: point.participants,
        negativePrompts: point.negativePrompts,
        styleNotes: point.styleNotes,
        continuityNotes: point.continuityNotes,
      };
      
      setStoryPoints(prev => prev.map((p, idx) => {
        if (idx === sceneIndex) {
          return {
            ...p,
            ...point, // Merge current point values to ensure state is in sync
            generatedImage: generatedImageUrl,
            detailedImagePrompt: imagePromptText,
            generationError: undefined,
            generationSnapshot,
          };
        }
        return p;
      }));
      
      // Trigger image flip-back animation (not card)
      setRegeneratingImageOnlyIndex(null);
      setJustFinishedImageOnlyIndex(sceneIndex);
      setTimeout(() => setJustFinishedImageOnlyIndex(null), 700);
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      let errorMessage = "Unbekannter Fehler";
      if (error instanceof Error) {
        errorMessage = error.name === 'AbortError' ? "Zeitüberschreitung – keine Antwort nach 20s" : error.message;
      }
      
      console.error(`Szene ${sceneIndex + 1} fehlgeschlagen:`, errorMessage);
      
      setStoryPoints(prev => prev.map((p, idx) => {
        if (idx === sceneIndex) {
          return { ...p, generationError: errorMessage };
        }
        return p;
      }));
    } finally {
      setRegeneratingImageOnlyIndex(null);
      setRegeneratingPointIndex(null);
    }
  };

  const handleSuggestionClick = async (suggestion: string, index: number) => {
    setSelectedSuggestionIndex(index);
    setIsAnimatingSuggestion(true);
    
    // After animation completes, expand the short summary into full text
    setTimeout(async () => {
      setIsAnimatingSuggestion(false);
      setSelectedSuggestionIndex(null);
      
      // Clear suggestions and text, show overlay
      setStoryIdea("");
      setStorySuggestions([]);
      setIsExpandingSuggestion(true);
      
      try {
        const isDialogMode = storyEnableSpeaker && storyGenerationDirection === "description-from-speaker";
        const expandPrompt = isDialogMode
          ? `Erweitere diese Dialog-Zusammenfassung zu einem packenden, emotionalen Dialog — optimiert für ein kurzes Social-Media-Video (TikTok/Reels/Shorts, 15-60 Sekunden).

REGELN:
- 4-8 Sätze gesprochener Dialog, filmisch und emotional
- Hook-First: Der ERSTE Satz muss sofort fesseln (provokant, überraschend, emotional)
- Natürlich klingende Sprache, keine steifen Formulierungen
- Emotionale Intensität: Jeder Satz muss eine Reaktion auslösen
- Denke an Pacing: Kurze, punchy Sätze wechseln sich mit emotionalen Momenten ab

Zusammenfassung: "${suggestion}"

Antworte NUR mit dem fertigen Dialog-Text, ohne Erklärungen oder Anführungszeichen drumherum. Auf Deutsch.`
          : `Erweitere diese kurze Story-Zusammenfassung zu einer visuell packenden Szenenbeschreibung — optimiert für kurze Social-Media-Videos (TikTok/Reels/Shorts, 15-60 Sekunden).

REGELN:
- 3-6 Sätze, visuell und atmosphärisch
- Hook-First: Die Beschreibung muss mit dem visuell stärksten Moment starten
- Dynamisch: Beschreibe Bewegung, Aktion, Emotionen — keine statischen Bilder
- Emotional: Jede Szene braucht einen klaren emotionalen Beat
- Denke in Szenen die man FILMEN kann: Kamerabewegungen, Licht, Mimik

Zusammenfassung: "${suggestion}"

Antworte NUR mit der fertigen Beschreibung, ohne Erklärungen. Auf Deutsch.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: expandPrompt }] }]
            }),
          }
        );

        let finalText = suggestion;
        if (response.ok) {
          const data = await response.json();
          const expandedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (expandedText) finalText = expandedText;
        }
        
        // Fast word-by-word animation
        setIsExpandingSuggestion(false);
        const words = finalText.split(/\s+/);
        let accumulated = "";
        for (let w = 0; w < words.length; w++) {
          accumulated += (w > 0 ? " " : "") + words[w];
          setStoryIdea(accumulated);
          await new Promise(r => setTimeout(r, 12));
        }
      } catch (error) {
        console.error("Failed to expand suggestion:", error);
        setIsExpandingSuggestion(false);
        setStoryIdea(suggestion);
      }
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
                text: storyEnableSpeaker && storyGenerationDirection === "description-from-speaker"
                  ? `Generiere genau 3 sehr kurze DIALOG-ZUSAMMENFASSUNGEN (maximal 4-6 Wörter pro Zusammenfassung). Jede beschreibt knapp das Thema eines möglichen Dialogs — optimiert für kurze, packende Social-Media-Videos (TikTok, Reels, Shorts).

Die Dialoge sollen emotional, direkt und sofort fesselnd sein. Denke an Hook-First: Der erste Satz muss Aufmerksamkeit grabben.

Gute Beispiele:
- Konfrontation nach dem Betrug
- Liebesgeständnis im Regen
- Letzte Nachricht vor dem Abflug

Antworte NUR mit den 3 kurzen Zusammenfassungen, eine pro Zeile, ohne Nummerierung oder Aufzählungszeichen. Auf Deutsch.`
                  : `Generiere genau 3 sehr kurze STORY-ZUSAMMENFASSUNGEN (maximal 4-6 Wörter pro Zusammenfassung). Jede beschreibt knapp das Thema einer möglichen Geschichte — optimiert für kurze, packende Social-Media-Videos (TikTok, Reels, Shorts).

WICHTIG: Die Geschichten müssen sofort fesseln (Hook-First), emotional intensiv sein und sich für schnelle, dynamische Video-Szenen eignen. Realistische UND dramatische Themen.

Gute Beispiele:
- Fremder rettet Kind im Park
- Traumjob-Absage verändert alles
- Zufälliges Wiedersehen nach Jahren

Antworte NUR mit den 3 kurzen Zusammenfassungen, eine pro Zeile, ohne Nummerierung oder Aufzählungszeichen. Auf Deutsch.`
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
  const currentSuggestionMode = storyEnableSpeaker && storyGenerationDirection === "description-from-speaker" ? "dialog" : "story";
  
  useEffect(() => {
    let cancelled = false;
    
    if (apiKey && authData.planCode === "FULL") {
      const shouldGenerate =
        lastSuggestionMode === null || lastSuggestionMode !== currentSuggestionMode;
      
      if (shouldGenerate && !cancelled) {
        generateStorySuggestions(apiKey);
        setLastSuggestionMode(currentSuggestionMode);
      }
    }
    
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, authData.planCode, currentSuggestionMode]);

  // Regenerate suggestions when text field is cleared
  useEffect(() => {
    if (storyIdea === "" && storySuggestions.length === 0 && apiKey && authData.planCode === "FULL" && !isExpandingSuggestion && !isLoadingStorySuggestions) {
      generateStorySuggestions(apiKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyIdea, storySuggestions.length, isExpandingSuggestion]);

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (referenceImages.length + files.length > 3) {
      console.warn("Zu viele Bilder - maximal 3 Referenzbilder erlaubt");
      return;
    }
    
    // Process and compress each file
    const processedFiles: File[] = [];
    for (const file of files) {
      try {
        // Compress to fit within 1MB, then convert back to File for consistency
        const base64 = await compressImageToFitSize(file);
        const response = await fetch(base64);
        const blob = await response.blob();
        const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
        processedFiles.push(compressedFile);
      } catch (error) {
        console.error('Error compressing image:', error);
      }
    }
    
    if (processedFiles.length > 0) {
      setReferenceImages([...referenceImages, ...processedFiles].slice(0, 3));
    }
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
    useSimplifiedPrompt: boolean = false,
    externalSignal?: AbortSignal
  ): Promise<string | null> => {
    // NO AUTO RETRY - fail immediately on error
    
    try {
      // Determine camera angle - use selected angle or cycle through angles if random
      let viewAngle = "";
      if (selectedCameraAngle === "random") {
        const angles = ["front view", "right side view", "back view", "left side view"];
        viewAngle = angles[index % angles.length];
      } else {
        // Map selected camera angle to English for the prompt
        const angleMap: Record<string, string> = {
          "frontal": "front view",
          "seitlich": "side view",
          "von-oben": "high angle view from above",
          "von-unten": "low angle view from below",
          "ueber-schulter": "over the shoulder view",
          "dutch-angle": "dutch angle tilted view",
          "vogelperspektive": "bird's eye view from above",
          "froschperspektive": "worm's eye view from below"
        };
        viewAngle = angleMap[selectedCameraAngle] || "front view";
      }
      
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
        prompt = `${customPromptText}. Ultra high resolution. 🚫 ABSOLUTELY NO BLACK BORDERS - the image must fill 100% of the frame!`;
      } else {
        // Simplified prompt - only view angle and shot type
        prompt = `Professional photoshoot with EXACTLY ONE person only, ${viewAngle}, ${bgText}, ${shotText}. Match the exact style, realism level, art style, lighting quality, and visual aesthetic from the reference images. Ultra high resolution. 🚫 ABSOLUTELY NO BLACK BORDERS - the image must fill 100% of the frame!`;
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
        
        // Determine camera angle instruction
        const cameraAngleInstruction = selectedCameraAngle === "random" 
          ? "- Shoot from various random angles" 
          : `- IMPORTANT: Camera angle MUST be: ${viewAngle}. Do NOT use any other angle.`;
        
        basePrompt = `CRITICAL CONSTRAINTS: 
- Generate EXACTLY ONE single person in the image. NEVER create multiple people or characters.
- Generate ONE SINGLE COMPLETE IMAGE only. NEVER create collages, grids, or multiple images in one frame.
- NO photo strips, NO side-by-side comparisons, NO split screens.
- 🚫 ABSOLUTELY NO BLACK BORDERS - the image must fill 100% of the frame!
- 🚫 NO letterboxing, NO black bars on any side (top, bottom, left, right)!

Create a professional photoshoot of the person from the reference image(s). 
- ONLY ONE PERSON must appear in the entire image
- ONLY ONE COMPLETE IMAGE - not a collage or collection of images
- Use the selected background: ${bgText}
- Dress them in random clothing
- Use random, varied poses (standing, sitting, leaning, walking, etc.)
${cameraAngleInstruction}
- ${shotText}
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
      
      // ===== Gemini Image Generation =====
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 40_000); // 40 Sekunden Timeout

      // If external signal is already aborted, abort immediately
      if (externalSignal?.aborted) {
        throw new Error("Generierung abgebrochen");
      }
      // Link external signal to this controller
      const onExternalAbort = () => controller.abort();
      externalSignal?.addEventListener('abort', onExternalAbort);

      let response: Response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              generationConfig: {
                responseModalities: ["IMAGE", "TEXT"],
                imageConfig: {
                  aspectRatio: formatOption?.ratio || "1:1",
                },
              },
            }),
          }
        );
      } catch (err: any) {
        if (err?.name === "AbortError") {
          throw new Error(externalSignal?.aborted ? "Generierung abgebrochen" : "Zeitüberschreitung - keine Antwort nach 20s");
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', onExternalAbort);
      }

      console.log("🔍 API Request sent, Response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Gemini API error ${response.status}:`, errorText);
        // Create user-friendly error message based on status
        let userFriendlyError = "";
        switch (response.status) {
          case 400:
            userFriendlyError = "Ungültige Anfrage - Prompt prüfen";
            break;
          case 401:
            userFriendlyError = "API-Key ungültig oder abgelaufen";
            break;
          case 403:
            userFriendlyError = "Zugriff verweigert";
            break;
          case 429:
            userFriendlyError = "API überlastet - bitte warte kurz";
            break;
          case 500:
            userFriendlyError = "Server-Fehler bei Google";
            break;
          case 503:
            userFriendlyError = "API überlastet - später versuchen";
            break;
          default:
            userFriendlyError = `API-Fehler (${response.status})`;
        }
        throw new Error(userFriendlyError);
      }

      const data = await response.json();
      console.log("📦 Full API Response for image", index + 1);

      // Check promptFeedback for block reasons
      if (data.promptFeedback?.blockReason) {
        const blockReason = data.promptFeedback.blockReason;
        console.error("❌ Prompt blocked:", blockReason);
      const blockMessages: Record<string, string> = {
          "SAFETY": "⚠️ Dein Prompt oder Referenzbild wurde durch den Sicherheitsfilter blockiert. Bitte ändere deinen Prompt oder verwende ein anderes Referenzbild.",
          "OTHER": "⚠️ Die Generierung wurde blockiert. Bitte ändere dein Referenzbild oder passe deinen Prompt an.",
          "BLOCKLIST": "⚠️ Dein Prompt enthält blockierte Begriffe. Bitte formuliere deinen Prompt um.",
          "PROHIBITED_CONTENT": "⚠️ Verbotener Inhalt erkannt. Bitte ändere deinen Prompt oder dein Referenzbild.",
        };
        throw new Error(blockMessages[blockReason] || `Prompt blockiert (${blockReason})`);
      }

      // ===== IMAGE EXTRACTION =====
      const candidates = data.candidates ?? [];
      if (candidates.length === 0) {
        throw new Error("⚠️ Keine Antwort von der API. Bitte versuche es erneut oder ändere dein Referenzbild.");
      }

      // Check finishReason for specific error causes
      const finishReason = candidates[0]?.finishReason;
      if (finishReason === "IMAGE_OTHER") {
        console.warn("⚠️ IMAGE_OTHER detected - Model couldn't generate with reference image");
        throw new Error("⚠️ Das Modell konnte kein Bild aus deinem Referenzbild generieren. Bitte verwende ein anderes, klareres Referenzbild.");
      }
      if (finishReason === "SAFETY") {
        console.warn("⚠️ SAFETY filter triggered");
        throw new Error("⚠️ Sicherheitsfilter ausgelöst. Bitte passe deinen Prompt an oder verwende ein anderes Referenzbild.");
      }
      if (finishReason === "MAX_TOKENS") {
        console.warn("⚠️ MAX_TOKENS reached");
        throw new Error("⚠️ Token-Limit erreicht. Bitte verwende einen kürzeren Prompt.");
      }
      if (finishReason === "RECITATION") {
        console.warn("⚠️ RECITATION detected");
        throw new Error("⚠️ Urheberrechtsfilter ausgelöst. Bitte ändere deinen Prompt.");
      }

      const partsOut = candidates[0]?.content?.parts ?? [];
      const imagePart = partsOut.find(
        (p: any) =>
          p.inlineData &&
          typeof p.inlineData.data === "string" &&
          p.inlineData.mimeType?.startsWith("image/")
      );

      if (imagePart) {
        // ===== BASE64 → BLOB (Browser) =====
        const base64 = imagePart.inlineData.data;
        const mimeType = imagePart.inlineData.mimeType || "image/png";

        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });

        // Use managed Blob URL to prevent memory leaks on older devices
        const objectUrl = createManagedBlobUrl(blob);
        console.log(`✅ Image ${index + 1} generated successfully:`, objectUrl);
        return objectUrl;
      }

      // No image found - log text response for debugging
      const textFallback = partsOut
        .map((p: any) => p.text)
        .filter(Boolean)
        .join("\n");
      console.error("❌ Gemini did not return an image. Text response:", textFallback);
      
      console.error("❌ No image in response for image", index + 1);
      throw new Error("⚠️ Kein Bild in der Antwort. Bitte versuche es erneut oder ändere deinen Prompt.");
    } catch (error) {
      console.error(`❌ Error generating image ${index}:`, error);
      // Re-throw with user-friendly message so processQueue catches it
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        throw new Error("Netzwerkfehler – prüfe deine Internetverbindung");
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error("Zeitüberschreitung – keine Antwort nach 20s");
      }
      // Re-throw original error if it already has a message
      throw error;
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

    console.log("🔄 Starte worker-pool...");
    
    const processSlot = async (index: number) => {
      console.log(`🎨 Starte Generierung für Index ${index}`);
      
      const slotController = new AbortController();
      abortControllersRef.current.set(index, slotController);
      
      setImageSlots((prev) => {
        const updated = [...prev];
        if (index >= updated.length) return prev;
        updated[index] = { status: "loading", progress: 0 };
        return updated;
      });

      const progressInterval = setInterval(() => {
        setImageSlots((prev) => {
          const updated = [...prev];
          if (index >= updated.length || updated[index]?.status !== "loading") return prev;
          const current = updated[index].progress || 0;
          if (current >= 95) return prev;
          const step = Math.min(0.7 + (current / 100) * 1.5, 4);
          updated[index] = { ...updated[index], progress: Math.min(current + step, 100) };
          return updated;
        });
      }, 250);

      try {
        const imageUrl = await generateSingleImage(
          index, apiKey, base64Images, background, totalCount,
          selectedFormat, selectedShot, customPromptText,
          undefined, 0, false, slotController.signal
        );

        setImageSlots((prev) => {
          const updated = [...prev];
          if (index < updated.length) updated[index] = { ...updated[index], progress: 100 };
          return updated;
        });
        await new Promise(resolve => setTimeout(resolve, 300));

        if (imageUrl) {
          let thumbUrl: string | undefined;
          if (isPro) {
            try { thumbUrl = await createThumbnailFromBlob(imageUrl, 1024); } catch (e) { console.warn("Thumbnail creation failed:", e); }
          }
          setImageSlots((prev) => {
            const updated = [...prev];
            if (index >= updated.length) return prev;
            const prevVersions = updated[index]?.imageVersions || [];
            const prevThumbs = updated[index]?.thumbnailVersions || [];
            updated[index] = {
              status: "completed", imageUrl, thumbnailUrl: thumbUrl || imageUrl, progress: 100,
              imageVersions: [...prevVersions, imageUrl],
              thumbnailVersions: [...prevThumbs, thumbUrl || imageUrl],
              currentVersionIndex: prevVersions.length,
            };
            return updated;
          });
        } else {
          setImageSlots((prev) => {
            const updated = [...prev];
            if (index >= updated.length) return prev;
            updated[index] = { status: "error", progress: 0, errorMessage: "⚠️ Kein Bild generiert. Bitte ändere dein Referenzbild oder deinen Prompt und versuche es erneut." };
            return updated;
          });
        }
      } catch (error) {
        console.error(`❌ Error in processQueue for index ${index}:`, error);
        const errorMessage = getDetailedErrorMessage(error);
        setImageSlots((prev) => {
          const updated = [...prev];
          if (index < updated.length) updated[index] = { status: "error", progress: 0, errorMessage };
          return updated;
        });
      } finally {
        clearInterval(progressInterval);
        abortControllersRef.current.delete(index);
      }
    };

    // Worker-pool: always keep CONCURRENT_REQUESTS running
    let activeCount = 0;
    await new Promise<void>((resolveAll) => {
      const tryStartNext = () => {
        while (activeCount < CONCURRENT_REQUESTS && generationQueueRef.current.length > 0 && isGeneratingRef.current) {
          const nextIndex = generationQueueRef.current.shift()!;
          activeCount++;
          processSlot(nextIndex).finally(() => {
            activeCount--;
            if (generationQueueRef.current.length > 0 && isGeneratingRef.current) {
              tryStartNext();
            } else if (activeCount === 0) {
              resolveAll();
            }
          });
        }
        if (activeCount === 0 && generationQueueRef.current.length === 0) {
          resolveAll();
        }
      };
      tryStartNext();
    });
  };

  const handleGenerate = async () => {
    console.log("🚀 handleGenerate aufgerufen!");
    console.log("🔑 API Key vorhanden?", !!apiKey);
    console.log("🔑 API Key Länge:", apiKey?.length || 0);
    console.log("🖼️ Anzahl Reference Images:", referenceImages.length);
    console.log("🎯 Hintergrund:", selectedBackground);
    console.log("🔢 Anzahl zu generierende Bilder:", imageCount[0]);
    
    if (!canGenerate) {
      console.log("❌ Fehler: Keine Generierung möglich");
      return;
    }
    

    if (referenceImages.length === 0) {
      console.log("❌ Fehler: Keine Reference Images");
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
      
    } catch (error) {
      console.error("Generation error:", error);
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
      generationQueueRef.current = [];
    }
  };

  const handleGenerateMore = async () => {
    if (!canGenerate) {
      return;
    }
    

    if (referenceImages.length === 0) {
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
    } catch (error) {
      console.error("Generation error:", error);
    } finally {
      setIsGenerating(false);
      isGeneratingRef.current = false;
      generationQueueRef.current = [];
    }
  };

  const handleCustomPrompt = async () => {
    if (!apiKey || !customPrompt) {
      return;
    }

    if (referenceImages.length === 0) {
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
          if (newIndex >= prev.length) return prev;
          const updated = [...prev];
          if (updated[newIndex]?.status === "loading") {
            const current = updated[newIndex].progress || 0;
            if (current >= 100) return prev;
            const step = Math.min(0.7 + (current / 100) * 1.5, 4);
            updated[newIndex].progress = Math.min(current + step, 100);
          }
          return updated;
        });
      }, 250);

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
      const basePrompt = `Professional photoshoot, ${randomPose}, ${randomExpression}, ${bgText}, ${shotText}, studio lighting, high-end fashion photography, professional camera quality. Ultra high resolution. 🚫 ABSOLUTELY NO BLACK BORDERS - the image must fill 100% of the frame! 🚫 NO letterboxing, NO black bars on any side!`;
      
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
      const timeoutId = setTimeout(() => controller.abort(), 40000); // 40 Sekunden Timeout

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
          
          // Animate progress quickly from current to 100%
          for (let p = 90; p <= 100; p += 5) {
            updateSlotSafe(newIndex, { progress: p });
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          // Short pause at 100%
          await new Promise(resolve => setTimeout(resolve, 150));
          
          updateSlotSafe(newIndex, (slot) => {
            const prevVersions = slot.imageVersions || [];
            return { ...slot, status: "completed" as const, imageUrl, progress: 100, imageVersions: [...prevVersions, imageUrl], currentVersionIndex: prevVersions.length };
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

  // Create a thumbnail blob URL from a full-res blob URL (for gallery preview)
  const createThumbnailFromBlob = async (fullResUrl: string, maxWidth: number = 512): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(fullResUrl); return; } // fallback to full-res
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (!blob) { resolve(fullResUrl); return; }
            const thumbUrl = createManagedBlobUrl(blob);
            console.log(`🖼️ Thumbnail created: ${canvas.width}x${canvas.height}`);
            resolve(thumbUrl);
          }, "image/jpeg", 0.85);
        } catch (e) {
          console.warn("Thumbnail creation failed, using full-res:", e);
          resolve(fullResUrl);
        }
      };
      img.onerror = () => resolve(fullResUrl); // fallback
      img.src = fullResUrl;
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

  // Cancel an active generation
  const handleCancelGeneration = (index: number) => {
    const controller = abortControllersRef.current.get(index);
    if (controller) {
      controller.abort();
      // The error handling in processQueue will take care of updating the slot
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
  };

  // Handle version change for a specific slot
  const handleVersionChange = (slotIndex: number, versionIndex: number) => {
    setImageSlots(prev => {
      const updated = [...prev];
      const slot = updated[slotIndex];
      if (!slot?.imageVersions || versionIndex < 0 || versionIndex >= slot.imageVersions.length) return prev;
      const thumbUrl = slot.thumbnailVersions?.[versionIndex] || slot.imageVersions[versionIndex];
      updated[slotIndex] = { ...slot, imageUrl: slot.imageVersions[versionIndex], thumbnailUrl: thumbUrl, currentVersionIndex: versionIndex };
      return updated;
    });
  };

  // Regenerate a single image slot (creates a new version)
  const handleRegenerateSlot = async (index: number) => {
    if (!canGenerate || referenceImages.length === 0) return;
    
    // Set slot to loading state, keep versions
    setImageSlots(prev => {
      const updated = [...prev];
      const slot = updated[index];
      updated[index] = { ...slot, status: "loading" as const, progress: 0 };
      return updated;
    });

    try {
      const currentImages = referenceImagesRef.current;
      const imagePromises = currentImages.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });
      const base64Images = await Promise.all(imagePromises);

      // Build prompt (reuse existing logic)
      const formatOption = FORMAT_OPTIONS.find(f => f.id === selectedFormat);
      const aspectRatio = formatOption?.ratio || "1:1";
      const shotOption = SHOT_OPTIONS.find(s => s.id === selectedShot);
      const skinOption = SKIN_OPTIONS.find(s => s.id === selectedSkinType);

      let prompt = "";
      if (useCustomPrompt && customPrompt) {
        prompt = customPrompt;
      } else {
        const bg = selectedBackground === "white" ? "plain white background" 
          : selectedBackground === "greenscreen" ? "green screen background"
          : `background scene: ${sceneDescription || "natural outdoor setting"}`;
        
        const pose = CASUAL_POSES[Math.floor(Math.random() * CASUAL_POSES.length)];
        prompt = `Generate a photorealistic full body image of the person shown in the reference photo. ${shotOption?.description || "full body shot"}. Pose: ${pose}. Skin: ${skinOption?.description || "realistic natural skin"}. ${bg}. Aspect ratio: ${aspectRatio}. High quality, photorealistic.`;
      }

      // Progress animation
      const progressInterval = setInterval(() => {
        updateSlotSafe(index, (slot) => {
          const current = slot.progress || 0;
          if (current >= 100) return slot;
          const step = Math.min(0.7 + (current / 100) * 1.5, 4);
          return { ...slot, progress: Math.min(current + step, 100) };
        });
      }, 250);

      // Build request parts
      const parts: any[] = [];
      for (const b64 of base64Images) {
        const [meta, data] = b64.split(",");
        const mimeType = meta.match(/:(.*?);/)?.[1] || "image/png";
        parts.push({ inline_data: { mime_type: mimeType, data } });
      }
      parts.push({ text: prompt });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        }
      );

      clearInterval(progressInterval);

      if (!response.ok) {
        const statusMessages: Record<number, string> = {
          400: "⚠️ Ungültige Anfrage. Bitte passe deinen Prompt oder dein Referenzbild an.",
          429: "⚠️ Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.",
          403: "⚠️ API-Key ungültig oder gesperrt.",
          500: "⚠️ Server-Fehler bei Google. Bitte versuche es erneut.",
        };
        throw new Error(statusMessages[response.status] || `API-Fehler (${response.status})`);
      }

      const result = await response.json();

      // Check promptFeedback for block reasons
      if (result.promptFeedback?.blockReason) {
        const blockReason = result.promptFeedback.blockReason;
        const blockMessages: Record<string, string> = {
          "SAFETY": "⚠️ Dein Prompt oder Referenzbild wurde durch den Sicherheitsfilter blockiert. Bitte ändere deinen Prompt oder verwende ein anderes Referenzbild.",
          "OTHER": "⚠️ Die Generierung wurde blockiert. Bitte ändere dein Referenzbild oder passe deinen Prompt an.",
          "BLOCKLIST": "⚠️ Dein Prompt enthält blockierte Begriffe. Bitte formuliere deinen Prompt um.",
          "PROHIBITED_CONTENT": "⚠️ Verbotener Inhalt erkannt. Bitte ändere deinen Prompt oder dein Referenzbild.",
        };
        throw new Error(blockMessages[blockReason] || `Prompt blockiert (${blockReason})`);
      }

      const candidates = result.candidates ?? [];
      if (candidates.length === 0) {
        throw new Error("⚠️ Keine Antwort von der API. Bitte versuche es erneut oder ändere dein Referenzbild.");
      }

      const finishReason = candidates[0]?.finishReason;
      if (finishReason === "IMAGE_OTHER") {
        throw new Error("⚠️ Das Modell konnte kein Bild aus deinem Referenzbild generieren. Bitte verwende ein anderes, klareres Referenzbild.");
      }
      if (finishReason === "SAFETY") {
        throw new Error("⚠️ Sicherheitsfilter ausgelöst. Bitte passe deinen Prompt an oder verwende ein anderes Referenzbild.");
      }

      const partsOut = candidates[0]?.content?.parts ?? [];
      let imageUrl = "";
      for (const part of partsOut) {
        if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("image/")) {
          const blob = new Blob(
            [Uint8Array.from(atob(part.inlineData.data), c => c.charCodeAt(0))],
            { type: part.inlineData.mimeType || "image/png" }
          );
          imageUrl = createManagedBlobUrl(blob);
          break;
        }
      }

      if (!imageUrl) throw new Error("⚠️ Kein Bild in der Antwort. Bitte versuche es erneut oder ändere deinen Prompt.");

      // Animate to 100%
      for (let p = 85; p <= 100; p += 5) {
        updateSlotSafe(index, { progress: p });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      await new Promise(resolve => setTimeout(resolve, 150));

      // Create thumbnail for gallery
      let thumbUrl: string | undefined;
      if (isPro) {
        try {
          thumbUrl = await createThumbnailFromBlob(imageUrl, 1024);
        } catch (e) {
          console.warn("Thumbnail creation failed:", e);
        }
      }

      // Add as new version
      updateSlotSafe(index, (slot) => {
        const prevVersions = slot.imageVersions || [];
        const prevThumbs = slot.thumbnailVersions || [];
        return {
          ...slot,
          status: "completed" as const,
          imageUrl,
          thumbnailUrl: thumbUrl || imageUrl,
          progress: 100,
          imageVersions: [...prevVersions, imageUrl],
          thumbnailVersions: [...prevThumbs, thumbUrl || imageUrl],
          currentVersionIndex: prevVersions.length,
        };
      });

    } catch (error) {
      console.error("❌ Regeneration error:", error);
      const errorMsg = error instanceof Error ? error.message : "Unbekannter Fehler";
      // Show error state with message so user can see reason and retry
      updateSlotSafe(index, (slot) => ({
        ...slot,
        status: "error" as const,
        progress: 0,
        errorMessage: errorMsg,
      }));
    }
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
    if (!canGenerate) {
      return;
    }

    if (selectedImageIndex === null || !imageSlots[selectedImageIndex]?.imageUrl) {
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
        console.error("Image fetch error:", fetchError);
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
      
    } catch (error) {
      console.error("Video prompt generation error:", error);
    } finally {
      setIsGeneratingVideoPrompt(false);
    }
  };

  const generateNewAiSuggestions = async (contextPrompt: string) => {
    if (!canGenerate) return;
    
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
    if (!canGenerate || !promptChatInput.trim() || !currentVideoPrompt) return;

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
      
    } catch (error) {
      console.error("Edit prompt error:", error);
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

  // Custom Prompt AI Generation (handles prompt, background, or both based on aiAssistantTarget)
  const handleGenerateCustomPromptWithAI = async () => {
    if (!canGenerate) {
      return;
    }

    if (!customPromptChatInput.trim()) {
      return;
    }

    // If targeting background only, use the simpler background generation
    if (aiAssistantTarget === "background") {
      await handleGenerateBackgroundOnly();
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

      // Build parts array with text and reference images
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
      
      // Add reference images for context
      const currentRefImages = referenceImagesRef.current;
      for (const img of currentRefImages) {
        try {
          // Convert File to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1] || '');
            };
            reader.onerror = reject;
            reader.readAsDataURL(img);
          });
          
          if (base64) {
            parts.push({
              inlineData: {
                mimeType: img.type || "image/jpeg",
                data: base64
              }
            });
          }
        } catch (e) {
          console.warn("Could not convert reference image for AI context:", e);
        }
      }
      
      // Add the text prompt
      parts.push({
        text: `Du bist ein Experte für Bild-Generierungs-Prompts.

${currentRefImages.length > 0 ? "Die beigefügten Bilder zeigen die Person/den Charakter, für die/den der Prompt erstellt werden soll. Nutze diese als Referenz für Beschreibungen von Aussehen, Stil und Merkmalen." : ""}

Erstelle einen Prompt basierend auf dieser Nutzer-Anfrage:
"${customPromptChatInput}"
${settingsContext}${existingPromptContext}

Antworte im folgenden strukturierten Format:
PROMPT: [Dein generierter Prompt]
BACKGROUND: [white, greenscreen, oder scenery]
SCENE: [Nur wenn BACKGROUND=scenery: Detaillierte Szenenbeschreibung, sonst leer]

WICHTIGE REGELN FÜR DEN PROMPT:
- Beschreibe NUR die Person: Pose, Körperhaltung, Gesichtsausdruck, Blickrichtung, Kleidung
- Nutze die Referenzbilder um Merkmale der Person korrekt zu beschreiben
- KEINE Kameraeinstellungen erwähnen (kein "Close-Up", "Ganzkörper", etc.)
- KEINE Hintergrundbeschreibungen im Prompt
- 2-4 Sätze auf Deutsch

REGELN FÜR SCENE (nur wenn scenery):
- Beschreibe den Ort detailliert (z.B. "Ein verlassener Industriehof mit rostigen Metallstrukturen")
- Lichtstimmung (goldene Stunde, weiches Morgenlicht, dramatische Schatten)
- Atmosphärische Details (Nebel, Regen, Sonnenstrahlen)`
      });

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
                parts: parts
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
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (!responseText) {
        throw new Error("Keine Antwort erhalten");
      }

      // Parse structured response
      let newPrompt = responseText;
      let suggestedBackground = "";
      let suggestedScene = "";
      
      const promptMatch = responseText.match(/PROMPT:\s*(.+?)(?=\nBACKGROUND:|$)/s);
      const backgroundMatch = responseText.match(/BACKGROUND:\s*(\w+)/);
      const sceneMatch = responseText.match(/SCENE:\s*(.+?)(?=\n|$)/);
      
      if (promptMatch) {
        newPrompt = promptMatch[1].trim();
      }
      if (backgroundMatch) {
        suggestedBackground = backgroundMatch[1].trim().toLowerCase();
      }
      if (sceneMatch && sceneMatch[1].trim()) {
        suggestedScene = sceneMatch[1].trim();
      }

      // Add as new version and navigate to it
      setCustomPromptVersions(prev => [...prev, newPrompt]);
      setCurrentCustomPromptIndex(customPromptVersions.length);
      setCustomPrompt(newPrompt);
      
      // Handle background based on aiAssistantTarget
      if (aiAssistantTarget === "both" && suggestedScene) {
        // For "both" mode: directly apply the scene
        setSceneDescription(suggestedScene);
        if (selectedBackground !== "scenery") {
          setSelectedBackground("scenery");
        }
        setAiBackgroundSuggestion("");
      } else if (aiAssistantTarget === "prompt") {
        // For "prompt" mode: only update the prompt, ignore scene suggestions
        setAiBackgroundSuggestion("");
      } else {
        // Legacy behavior for other cases
        if (selectedBackground === "scenery" && suggestedScene && suggestedScene !== sceneDescription) {
          setAiBackgroundSuggestion(suggestedScene);
        } else if (suggestedBackground === "scenery" && suggestedScene && selectedBackground !== "scenery") {
          setAiBackgroundSuggestion(suggestedScene);
        } else {
          setAiBackgroundSuggestion("");
        }
      }
      
      // Keep the input text for further iterations
    } catch (error) {
      console.error("Custom prompt generation error:", error);
    } finally {
      setIsGeneratingCustomPrompt(false);
    }
  };

  // Generate AI background suggestion for scenery when prompt exists (legacy)
  const handleGenerateBackgroundSuggestion = async () => {
    if (!canGenerate || !customPrompt.trim() || isGeneratingBackgroundSuggestion) return;
    
    setIsGeneratingBackgroundSuggestion(true);
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Der Nutzer hat folgenden Bild-Prompt erstellt:
"${customPrompt}"

Beschreibe einen passenden Hintergrund/Szenerie für dieses Bild.

STRENGE REGELN:
- Antworte NUR mit der reinen Hintergrundbeschreibung
- KEINE Einleitungen wie "Passend wäre..." oder "Statt..."
- KEINE Erklärungen oder Kommentare
- KEINE Details über Personen, Menschen, Charaktere oder deren Erscheinung
- NUR der Ort, die Umgebung, Lichtstimmung und atmosphärische Details
- Beschreibe ausschließlich die Kulisse/Szenerie selbst
- 2-3 Sätze auf Deutsch

Beispiel einer korrekten Antwort:
"Ein verlassener Industriehof bei Sonnenuntergang mit rostigen Metallstrukturen und warmem, goldenem Licht das durch zerbrochene Fenster fällt. Efeu rankt an den alten Backsteinwänden empor, während Staub in den Lichtstrahlen tanzt."`
              }]
            }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 200
            }
          })
        }
      );

      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      const suggestion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (suggestion) {
        setAiBackgroundSuggestion(suggestion);
      }
    } catch (error) {
      console.error("Background suggestion error:", error);
    } finally {
      setIsGeneratingBackgroundSuggestion(false);
    }
  };

  // Generate background only from AI Assistant input (unified control)
  const handleGenerateBackgroundOnly = async () => {
    setIsGeneratingBackgroundSuggestion(true);
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Der Nutzer wünscht folgenden Hintergrund für sein Bild:
"${customPromptChatInput}"

Erstelle eine detaillierte Hintergrundbeschreibung basierend auf dieser Anfrage.

STRENGE REGELN:
- Antworte NUR mit der reinen Hintergrundbeschreibung
- KEINE Einleitungen wie "Passend wäre..." oder "Statt..."
- KEINE Erklärungen oder Kommentare
- KEINE Details über Personen, Menschen, Charaktere oder deren Erscheinung
- NUR der Ort, die Umgebung, Lichtstimmung und atmosphärische Details
- Beschreibe ausschließlich die Kulisse/Szenerie selbst
- 2-3 Sätze auf Deutsch

Beispiel einer korrekten Antwort:
"Ein verlassener Industriehof bei Sonnenuntergang mit rostigen Metallstrukturen und warmem, goldenem Licht das durch zerbrochene Fenster fällt. Efeu rankt an den alten Backsteinwänden empor, während Staub in den Lichtstrahlen tanzt."`
              }]
            }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 200
            }
          })
        }
      );

      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      const suggestion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (suggestion) {
        // Directly apply to scene description
        setSceneDescription(suggestion);
        // Keep the input text for further iterations
        
        // Ensure scenery is selected
        if (selectedBackground !== "scenery") {
          setSelectedBackground("scenery");
        }
        
      }
    } catch (error) {
      console.error("Background generation error:", error);
    } finally {
      setIsGeneratingBackgroundSuggestion(false);
    }
  };

  // Apply AI background suggestion
  const handleApplyBackgroundSuggestion = () => {
    if (aiBackgroundSuggestion) {
      setSceneDescription(aiBackgroundSuggestion);
      setAiBackgroundSuggestion("");
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
    setSceneDescription(""); // Also clear the background/scenery prompt
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

  const handleDownloadAll = async (maxWidth: number = 0) => {
    const completedImages = imageSlots.filter((slot) => slot.status === "completed" && slot.imageUrl);
    
    if (completedImages.length === 0) {
      return;
    }

    const createdUrls: string[] = []; // Track URLs for cleanup
    
    try {
      const zip = new JSZip();
      const isBasic = !isPro;
      const BATCH_SIZE = 5; // Process in smaller batches to prevent memory overflow
      
      // Get indices of completed images
      const completedIndices: number[] = [];
      for (let i = 0; i < imageSlots.length; i++) {
        if (imageSlots[i].status === "completed" && imageSlots[i].imageUrl) {
          completedIndices.push(i);
        }
      }
      
      // Process in batches
      for (let batchStart = 0; batchStart < completedIndices.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, completedIndices.length);
        const batchIndices = completedIndices.slice(batchStart, batchEnd);
        
        // Process batch in parallel
        await Promise.all(batchIndices.map(async (i) => {
          const slot = imageSlots[i];
          if (!slot.imageUrl) return;
          
            try {
              let imageData: Blob;
              
              if (maxWidth > 0) {
                // Resize to selected resolution
                try {
                  const resizedUrl = await resizeImageForBasic(slot.imageUrl, maxWidth);
                  createdUrls.push(resizedUrl); // Track for cleanup
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
          } catch (err) {
            console.error(`Failed to process image ${i + 1}:`, err);
          }
        }));
        
        // Force garbage collection opportunity between batches
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Generate ZIP with compression to reduce memory
      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });
      
      const downloadUrl = URL.createObjectURL(zipBlob);
      createdUrls.push(downloadUrl); // Track for cleanup
      
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "character-images.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      // CRITICAL: Clean up all created blob URLs to prevent memory leaks
      setTimeout(() => {
        createdUrls.forEach(url => {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            // Ignore cleanup errors
          }
        });
        console.log(`🧹 Cleaned up ${createdUrls.length} blob URLs after download`);
      }, 1000); // Delay cleanup to ensure download starts
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
        {/* Version Indicator */}
        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex flex-col gap-1 z-20">
          <div className="text-[10px] text-muted-foreground/50 font-mono select-none">
            v1.4.6
          </div>
        </div>
        <PromoBanner planCode={authData.planCode} />
        {/* Settings & Tutorial Buttons */}
        <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex flex-col gap-2 z-20">
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
          className="text-center mb-12 animate-fade-in"
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

        {/* HOME SCREEN */}
        {activeView === "home" && (
          <HomeScreen
            planCode={authData.planCode}
            onSelectFeature={(feature) => {
              setActiveMainTab(feature);
              setActiveView("tools");
            }}
            onShowUpgrade={() => setShowUpgradePopup(true)}
          />
        )}

        {/* TOOLS VIEW */}
        {activeView === "tools" && (
          <>
        {/* Back to Home Button */}
        <div className="mb-4 animate-fade-in">
          <Button
            variant="ghost"
            onClick={() => setActiveView("home")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Übersicht
          </Button>
        </div>

        {/* Main Tab Navigation */}
        <div className="mb-6 animate-fade-in" style={{ animationDelay: '100ms', animationDuration: '600ms', animationFillMode: 'both' }}>
          <Tabs value={activeMainTab} onValueChange={(v) => {
            const tab = v as "poses" | "story" | "character";
            if (tab === "story" && authData.planCode !== "FULL") {
              setShowUpgradePopup(true);
              return;
            }
            setActiveMainTab(tab);
          }} className="w-full">
            <TabsList className="w-fit bg-muted/50 backdrop-blur-sm">
              <TabsTrigger value="poses" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Avatar Shooting Studio
              </TabsTrigger>
              <TabsTrigger value="story" className="flex items-center gap-2">
                {authData.planCode !== "FULL" && <Lock className="w-3 h-3" />}
                <BookOpen className="w-4 h-4" />
                Reel/Story Videocreator
              </TabsTrigger>
              <TabsTrigger value="character" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Character Creator
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Poses Tab Content */}
        {activeMainTab === "poses" && (
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
                      <ImageDropZone
                        onFiles={(files) => {
                          const limited = isPro ? files : (() => { const dt = new DataTransfer(); dt.items.add(files[0]); return dt.files; })();
                          const fakeEvent = { target: { files: limited } } as React.ChangeEvent<HTMLInputElement>;
                          handleImageUpload(fakeEvent);
                        }}
                      />
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
                <button
                  onClick={() => {
                    setRefImageSource("poses");
                    setActiveMainTab("character");
                  }}
                  className="w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-200 border-border hover:border-primary hover:bg-primary/5 gap-1"
                  title="Character Creator öffnen"
                >
                  <User className="w-5 h-5 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground leading-tight text-center">Character<br/>erstellen</span>
                </button>
              </div>
            </div>

            {/* Format, Shot Type, Skin Type, and Camera Angle Selection */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {/* Image Format Dropdown - Pro Only */}
              {isPro ? (
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
              ) : (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">Bildformat <Lock className="w-3 h-3 text-muted-foreground/70" /></Label>
                  <Button 
                    variant="outline" 
                    className={`w-full justify-between opacity-60 ${shakingElement === "format" ? "animate-shake border-red-500 bg-red-500/20" : ""}`}
                    onClick={() => { setShakingElement("format"); setTimeout(() => setShakingElement(null), 500); setShowUpgradePopup(true); }}
                  >
                    Quadratisch <Lock className={`w-4 h-4 ${shakingElement === "format" ? "text-red-500" : "text-muted-foreground/70"}`} />
                  </Button>
                </div>
              )}

              {/* Shot Type Dropdown - Pro Only */}
              {isPro ? (
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
              ) : (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">Aufnahme-Typ <Lock className="w-3 h-3 text-muted-foreground/70" /></Label>
                  <Button 
                    variant="outline" 
                    className={`w-full justify-between opacity-60 ${shakingElement === "shot" ? "animate-shake border-red-500 bg-red-500/20" : ""}`}
                    onClick={() => { setShakingElement("shot"); setTimeout(() => setShakingElement(null), 500); setShowUpgradePopup(true); }}
                  >
                    Ganzkörper <Lock className={`w-4 h-4 ${shakingElement === "shot" ? "text-red-500" : "text-muted-foreground/70"}`} />
                  </Button>
                </div>
              )}

              {/* Camera Angle Dropdown - Pro Only */}
              {isPro ? (
                <div className="space-y-2">
                  <Label>Kamerawinkel</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {CAMERA_ANGLE_OPTIONS.find(c => c.value === selectedCameraAngle)?.label || "Winkel wählen"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-full bg-popover">
                      {CAMERA_ANGLE_OPTIONS.map((angle) => (
                        <DropdownMenuItem
                          key={angle.value}
                          onClick={() => setSelectedCameraAngle(angle.value)}
                          className={selectedCameraAngle === angle.value ? "bg-accent" : ""}
                        >
                          {angle.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">Kamerawinkel <Lock className="w-3 h-3 text-muted-foreground/70" /></Label>
                  <Button 
                    variant="outline" 
                    className={`w-full justify-between opacity-60 ${shakingElement === "camera" ? "animate-shake border-red-500 bg-red-500/20" : ""}`}
                    onClick={() => { setShakingElement("camera"); setTimeout(() => setShakingElement(null), 500); setShowUpgradePopup(true); }}
                  >
                    Zufällig <Lock className={`w-4 h-4 ${shakingElement === "camera" ? "text-red-500" : "text-muted-foreground/70"}`} />
                  </Button>
                </div>
              )}

              {/* Skin Type Dropdown - Pro Only */}
              {isPro ? (
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
              ) : (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">Hauttyp <Lock className="w-3 h-3 text-muted-foreground/70" /></Label>
                  <Button 
                    variant="outline" 
                    className={`w-full justify-between opacity-60 ${shakingElement === "skin" ? "animate-shake border-red-500 bg-red-500/20" : ""}`}
                    onClick={() => { setShakingElement("skin"); setTimeout(() => setShakingElement(null), 500); setShowUpgradePopup(true); }}
                  >
                    Realistisch <Lock className={`w-4 h-4 ${shakingElement === "skin" ? "text-red-500" : "text-muted-foreground/70"}`} />
                  </Button>
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

            {/* Background Selection - Horizontal Layout */}
            <div className="flex flex-col gap-2 items-start">
              <Label className="text-xs text-muted-foreground">Hintergrund</Label>
              <div className="inline-flex rounded-lg bg-muted/50 p-1 gap-1 w-fit">
                {BACKGROUND_OPTIONS.map((option) => {
                  const isSelected = selectedBackground === option.id;
                  const isPremiumFeature = option.id === "greenscreen" || option.id === "scenery";
                  const isLocked = isPremiumFeature && !isPro;
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        if (isLocked) {
                          setShakingElement(option.id);
                          setTimeout(() => setShakingElement(null), 500);
                          setShowUpgradePopup(true);
                        } else {
                          setSelectedBackground(option.id);
                        }
                      }}
                      className={`relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 group ${
                        isLocked && shakingElement === option.id
                          ? "animate-shake bg-red-500/20"
                          : ""
                      } ${
                        isLocked
                          ? "text-muted-foreground/50 cursor-pointer hover:text-muted-foreground/70"
                          : isSelected 
                            ? "bg-background text-foreground shadow-sm" 
                            : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      }`}
                    >
                      {/* Icon/Indicator */}
                      {option.id === "white" && (
                        <div 
                          className={`w-4 h-4 rounded-full border bg-white transition-all ${
                            isSelected ? "border-primary" : "border-muted-foreground/30"
                          }`}
                        />
                      )}
                      {option.id === "greenscreen" && (
                        <div 
                          className={`w-4 h-4 rounded-full border bg-green-500 transition-all ${
                            isSelected ? "border-primary" : "border-muted-foreground/30"
                          }`}
                        />
                      )}
                      {option.id === "scenery" && (
                        <Mountain className={`w-4 h-4 transition-all ${
                          isSelected ? "text-primary" : "text-muted-foreground"
                        }`} />
                      )}
                      
                      {/* Label */}
                      <span>
                        {option.id === "white" && "Weiß"}
                        {option.id === "greenscreen" && "Green Screen"}
                        {option.id === "scenery" && "Custom"}
                      </span>
                      
                      {/* Lock Icon */}
                      {isLocked && (
                        <Lock className={`w-3.5 h-3.5 transition-all ${
                          shakingElement === option.id 
                            ? "text-red-400" 
                            : "text-muted-foreground/50 group-hover:text-muted-foreground"
                        }`} />
                      )}
                    </button>
                  );
                })}
              </div>
              
              {/* Scene Description Input - Shows when "Eigene Szenerie" is selected */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                selectedBackground === "scenery" 
                  ? "max-h-96 opacity-100 mt-3" 
                  : "max-h-0 opacity-0 mt-0"
              }`}>
                <div className="space-y-3">
                  {/* Textarea with AI button next to it */}
                  <div className="flex gap-3 items-start w-full sm:w-fit">
                    <Textarea
                      placeholder="Beschreibe die Szene... (z.B. 'Strand bei Sonnenuntergang', 'Urbaner Park im Herbst')"
                      value={sceneDescription}
                      onChange={(e) => setSceneDescription(e.target.value)}
                      className="min-h-[80px] w-full sm:w-[calc(3*120px+2*4px)] resize-y focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      maxLength={300}
                    />
                  </div>
                  
                  {/* AI Background Suggestion - cleaner card design */}
                  {aiBackgroundSuggestion && selectedBackground === "scenery" && (
                    <div className="animate-fade-in rounded-lg border border-primary/30 bg-primary/5 p-3 max-w-2xl">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground leading-relaxed">
                            {aiBackgroundSuggestion}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={handleApplyBackgroundSuggestion}
                          size="sm"
                          className="flex-1"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Übernehmen
                        </Button>
                        <Button
                          onClick={handleGenerateBackgroundSuggestion}
                          disabled={isGeneratingBackgroundSuggestion}
                          variant="outline"
                          size="sm"
                        >
                          {isGeneratingBackgroundSuggestion ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          onClick={() => setAiBackgroundSuggestion("")}
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
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
                    {/* Layout: PREMIUM and FULL plans get AI Chat, others get simple prompt */}
                    <div className={`flex gap-3 items-stretch ${authData.planCode !== "FULL" && authData.planCode !== "PREMIUM" ? "flex-col" : ""}`}>
                      {/* Left: Prompt Output */}
                      <div className="flex-1 flex flex-col">
                        {/* Header with Version Navigation */}
                        <div className="flex items-center justify-between mb-2 h-7">
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
                          className="min-h-[124px] focus-visible:ring-0 focus-visible:ring-offset-0 resize-y"
                        />
                      </div>
                      
                      {/* Center: Generate Buttons - For PREMIUM and FULL plans */}
                      {(authData.planCode === "FULL" || authData.planCode === "PREMIUM") && (
                        <div className="flex flex-col gap-2 pt-9">
                          {/* Main button - transfers prompt to left */}
                          <Button
                            onClick={handleGenerateCustomPromptWithAI}
                            disabled={!canGenerate || !customPromptChatInput.trim() || isGeneratingCustomPrompt || isGeneratingBackgroundSuggestion}
                            className="w-10 flex-1 rounded-lg"
                            title={aiAssistantTarget === "background" ? "Hintergrund generieren" : aiAssistantTarget === "both" ? "Prompt & Hintergrund generieren" : "Prompt generieren und links einfügen"}
                          >
                            {(isGeneratingCustomPrompt || isGeneratingBackgroundSuggestion) ? (
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
                      
                      {/* Right: AI Chat Input - For PREMIUM and FULL plans */}
                      {(authData.planCode === "FULL" || authData.planCode === "PREMIUM") && (
                        <div className="flex-1 flex flex-col">
                          {/* Header with label left and segmented control centered */}
                          <div className="flex items-center mb-2 h-7">
                            <div className="flex items-center gap-1.5 w-24">
                              <Sparkles className="w-4 h-4 text-muted-foreground" />
                              <Label className="text-muted-foreground">KI-Assistent</Label>
                            </div>
                            <div className="flex-1 flex justify-center">
                              <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
                                <Button
                                  variant={aiAssistantTarget === "prompt" ? "default" : "ghost"}
                                  size="sm"
                                  className={`h-6 px-2 text-xs ${aiAssistantTarget === "prompt" ? "" : "text-muted-foreground hover:text-foreground"}`}
                                  onClick={() => setAiAssistantTarget("prompt")}
                                >
                                  Prompt
                                </Button>
                                <Button
                                  variant={aiAssistantTarget === "background" ? "default" : "ghost"}
                                  size="sm"
                                  className={`h-6 px-2 text-xs ${aiAssistantTarget === "background" ? "" : "text-muted-foreground hover:text-foreground"} ${selectedBackground !== "scenery" ? "opacity-50 cursor-not-allowed" : ""}`}
                                  onClick={() => selectedBackground === "scenery" && setAiAssistantTarget("background")}
                                  disabled={selectedBackground !== "scenery"}
                                  title={selectedBackground !== "scenery" ? "Nur bei 'Eigene Szenerie' verfügbar" : ""}
                                >
                                  Hintergrund
                                </Button>
                                <Button
                                  variant={aiAssistantTarget === "both" ? "default" : "ghost"}
                                  size="sm"
                                  className={`h-6 px-2 text-xs ${aiAssistantTarget === "both" ? "" : "text-muted-foreground hover:text-foreground"} ${selectedBackground !== "scenery" ? "opacity-50 cursor-not-allowed" : ""}`}
                                  onClick={() => selectedBackground === "scenery" && setAiAssistantTarget("both")}
                                  disabled={selectedBackground !== "scenery"}
                                  title={selectedBackground !== "scenery" ? "Nur bei 'Eigene Szenerie' verfügbar" : ""}
                                >
                                  Beides
                                </Button>
                              </div>
                            </div>
                            {/* Spacer to balance the label */}
                            <div className="w-24" />
                          </div>
                          <div className="p-3 rounded-lg border border-border/50 bg-muted/30 h-[124px]">
                            <Textarea
                              placeholder={
                                aiAssistantTarget === "prompt" 
                                  ? "Beschreibe was du möchtest, z.B. 'Person sitzt auf einem Stuhl und lächelt'..."
                                  : aiAssistantTarget === "background"
                                  ? "Beschreibe den gewünschten Hintergrund, z.B. 'Strand bei Sonnenuntergang'..."
                                  : "Beschreibe Person und Hintergrund, z.B. 'Person liest ein Buch im gemütlichen Café'..."
                              }
                              value={customPromptChatInput}
                              onChange={(e) => setCustomPromptChatInput(e.target.value)}
                              className="h-full min-h-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 resize-y bg-transparent border-0 p-0"
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
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              {imageSlots.length === 0 ? (
                <Button
                  onClick={handleGenerate}
                  disabled={!canGenerate || referenceImages.length === 0}
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
                    disabled={!canGenerate || referenceImages.length === 0}
                    className="flex-[2] bg-primary hover:bg-primary/90 animate-in slide-in-from-left-5"
                    size="lg"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    <span className="hidden sm:inline">{isGenerating ? 'Bilder hinzufügen' : 'Bilder dazu generieren'}</span>
                    <span className="sm:hidden">{isGenerating ? 'Hinzufügen' : 'Mehr generieren'}</span>
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        disabled={!canGenerate || referenceImages.length === 0}
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
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        disabled={isGenerating || imageSlots.filter(s => s.status === "completed").length === 0}
                        variant="secondary"
                        className="h-12"
                        size="lg"
                      >
                        <Download className="mr-2" />
                        Alle herunterladen
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[140px]">
                      {[
                        { label: "512px", maxWidth: 512, minPlan: "basic" as const },
                        { label: "1K", maxWidth: 1024, minPlan: "basic" as const },
                        { label: "2K", maxWidth: 2048, minPlan: "pro" as const },
                        { label: "4K (Original)", maxWidth: 0, minPlan: "pro" as const },
                      ].map((opt) => {
                        const isLocked = !isPro && opt.minPlan === "pro";
                        return (
                          <DropdownMenuItem
                            key={opt.label}
                            onClick={() => {
                              if (isLocked) {
                                setShowUpgradePopup(true);
                              } else {
                                handleDownloadAll(opt.maxWidth);
                              }
                            }}
                            className={cn(isLocked && "opacity-50")}
                          >
                            {isLocked ? (
                              <Lock className="w-4 h-4 mr-2 text-muted-foreground" />
                            ) : (
                              <Download className="w-4 h-4 mr-2" />
                            )}
                            {opt.label}
                            {isLocked && <span className="ml-auto text-[10px] text-muted-foreground">Pro</span>}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
            onCancelGeneration={handleCancelGeneration}
            onRegenerate={handleRegenerateSlot}
            onVersionChange={handleVersionChange}
            isBasicPlan={!isPro}
            isGenerating={isGenerating}
            format={FORMAT_OPTIONS.find(f => f.id === selectedFormat)?.ratio || "1:1"}
            onLockedClick={() => setShowUpgradePopup(true)}
          />
        </div>
          </>
        )}

        {/* Story Tab Content */}
        {activeMainTab === "story" && (
          <Card 
            className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in"
            style={{ animationDelay: '150ms', animationDuration: '600ms', animationFillMode: 'both' }}
          >
            <CardContent className="pt-6 space-y-6">
              {/* Speaker Toggle + Direction - above story idea */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20 max-w-sm">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Sprechertext / Dialog</Label>
                    <p className="text-xs text-muted-foreground">KI generiert Dialog pro Szene</p>
                  </div>
                  <Switch checked={storyEnableSpeaker} onCheckedChange={setStoryEnableSpeaker} />
                </div>

                {storyEnableSpeaker && (
                  <div className="flex items-center gap-3 px-1">
                    <button
                      type="button"
                      onClick={() => setStoryGenerationDirection(prev => prev === "speaker-from-description" ? "description-from-speaker" : "speaker-from-description")}
                      className="relative inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-border/50 bg-muted/30 text-xs font-medium text-foreground hover:border-primary/50 transition-all duration-300 active:scale-95 overflow-hidden group"
                    >
                      <span className="absolute inset-0 bg-primary/10 opacity-0 group-active:opacity-100 transition-opacity duration-150 rounded-full" />
                      <span
                        key={storyGenerationDirection}
                        className="relative animate-[slideIn_0.3s_ease-out]"
                        style={{ display: 'inline-block' }}
                      >
                        {storyGenerationDirection === "speaker-from-description" ? "Details → Dialog" : "Dialog → Details"}
                      </span>
                    </button>
                    <span
                      key={storyGenerationDirection + "-desc"}
                      className="text-xs text-muted-foreground animate-[fadeIn_0.3s_ease-out]"
                    >
                      {storyGenerationDirection === "speaker-from-description"
                        ? "KI schreibt den Dialog passend zur Szenenbeschreibung"
                        : "KI schreibt die Szene passend zum Dialog"}
                    </span>
                  </div>
                )}
              </div>

              {/* Story Idea and AI Assistant side by side */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Left: Generated Story Idea Display */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="story-idea">{storyEnableSpeaker ? (storyGenerationDirection === "description-from-speaker" ? "Dein Dialog" : "Deine Story-Idee") : "Deine Story-Idee"}</Label>
                    <div className="flex items-center gap-0 rounded-md border border-border/50 bg-muted/20 px-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={generatedIdeas.length === 0 || currentIdeaIndex === 0}
                        onClick={() => navigateIdea("prev")}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <span className="text-xs text-muted-foreground font-medium tabular-nums min-w-[2.5rem] text-center">
                        {generatedIdeas.length > 0 ? `${currentIdeaIndex + 1}/${generatedIdeas.length}` : "1/1"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={generatedIdeas.length === 0 || currentIdeaIndex === generatedIdeas.length - 1}
                        onClick={() => navigateIdea("next")}
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="relative flex-1">
                    <Textarea
                      id="story-idea"
                      placeholder=""
                      value={storyIdea}
                      onChange={(e) => {
                        setStoryIdea(e.target.value);
                        if (generatedIdeas.length > 0) {
                          setGeneratedIdeas(prev => {
                            const updated = [...prev];
                            updated[currentIdeaIndex] = e.target.value;
                            return updated;
                          });
                        }
                      }}
                      className="min-h-[160px] resize-y"
                    />
                    
                    {/* Generating overlay */}
                    {(isExpandingSuggestion || isGeneratingStoryAiIdea) && (
                      <div className="absolute inset-0 rounded-md bg-background/80 backdrop-blur-sm flex items-center justify-center gap-2 z-10 border border-primary/20">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-sm font-medium text-primary">
                          {isGeneratingStoryAiIdea ? "Ideen werden generiert..." : "Text wird generiert..."}
                        </span>
                      </div>
                    )}
                    
                    {/* Suggestions overlay - only when empty and not animating */}
                    {(!storyIdea || isAnimatingSuggestion) && !isGeneratingStoryAiIdea && (
                      <div className="absolute inset-0 p-3 pointer-events-none overflow-hidden">
                        <p className={`text-sm text-muted-foreground mb-4 transition-opacity duration-300 ${isAnimatingSuggestion ? 'opacity-0' : 'opacity-100'}`}>
                          {storyEnableSpeaker && storyGenerationDirection === "description-from-speaker"
                            ? "Wähle einen Dialog oder schreibe deinen eigenen..."
                            : "Wähle eine Idee oder schreibe deine eigene..."
                          }
                        </p>
                        <div className="relative pointer-events-auto pb-6">
                          {isLoadingStorySuggestions ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Generiere Ideen...</span>
                            </div>
                          ) : (
                            storySuggestions.map((suggestion, index) => {
                              const isSelected = selectedSuggestionIndex === index;
                              const isOther = selectedSuggestionIndex !== null && !isSelected;
                              
                              return (
                                <p
                                  key={index}
                                  onClick={() => !isAnimatingSuggestion && handleSuggestionClick(suggestion, index)}
                                  className={`text-sm cursor-pointer py-0.5 transition-all ease-out line-clamp-1 ${
                                    isSelected 
                                      ? 'text-foreground font-medium opacity-0 scale-95' 
                                      : isOther
                                        ? 'opacity-0'
                                        : 'text-foreground/70 hover:text-primary'
                                  }`}
                                  style={{
                                    transitionDuration: '300ms',
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

                {/* Generate Button + Count Dropdown */}
                <div className="flex flex-col items-center md:items-end gap-3 pb-[2px]">
                  <Button
                    onClick={handleGenerateStoryIdea}
                    disabled={isGeneratingStoryAiIdea || !storyAiAssistantInput.trim()}
                    className="w-full md:w-10 h-10 md:h-[155px] rounded-lg"
                    title={storyIdea.trim() ? "Idee anpassen" : "Ideen generieren"}
                  >
                    {isGeneratingStoryAiIdea ? (
                      <Sparkles className="w-5 h-5 animate-spin" />
                    ) : (
                      <ChevronLeft className="w-6 h-6" />
                    )}
                  </Button>
                  <select
                    value={ideaCount}
                    onChange={(e) => setIdeaCount(e.target.value)}
                    className="w-10 h-7 text-xs text-center rounded border border-border bg-background text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                    title="Anzahl Ideen"
                  >
                    {[1,2,3,4,5].map(n => (
                      <option key={n} value={String(n)}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* Right: AI Assistant - Idea Input + Count Dropdown */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-muted-foreground">KI-Assistent</Label>
                    </div>
                  </div>
                  <div className="flex-1 p-3 rounded-lg border border-border/50 bg-muted/30">
                    <Textarea
                      placeholder={generatedIdeas.length > 0 
                        ? "Beschreibe die gewünschte Änderung, z.B. 'Mach es dramatischer' oder 'Verlege es ans Meer'..."
                        : "Beschreibe was für eine Story du möchtest, z.B. 'Eine romantische Geschichte in Paris'..."
                      }
                      value={storyAiAssistantInput}
                      onChange={(e) => setStoryAiAssistantInput(e.target.value)}
                      className="h-full min-h-[140px] text-sm focus-visible:ring-0 focus-visible:ring-offset-0 resize-y bg-transparent border-0 p-0"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleGenerateStoryIdea();
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Character Reference Image Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Charakter Referenzbild
                  <span className="flex items-center gap-2 ml-1">
                    {[1, 2].map((num) => {
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
                  {storyReferenceImages.length < 2 && (
                    <ImageDropZone
                      onFiles={(files) => {
                        const fakeEvent = { target: { files } } as React.ChangeEvent<HTMLInputElement>;
                        handleStoryImageUpload(fakeEvent);
                      }}
                    >
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </ImageDropZone>
                  )}
                  {storyReferenceImages.length < 2 && (
                    <button
                      onClick={() => {
                        setRefImageSource("story");
                        setActiveMainTab("character");
                      }}
                      className="w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-200 border-border hover:border-primary hover:bg-primary/5 gap-1"
                      title="Character Creator öffnen"
                    >
                      <User className="w-5 h-5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground leading-tight text-center">Character<br/>erstellen</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Setup Options Panel */}
              <Collapsible 
                open={!storySetupCollapsed} 
                onOpenChange={(open) => setStorySetupCollapsed(!open)}
                className="pt-4 border-t border-border/50"
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full group cursor-pointer">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    Produktions-Einstellungen
                  </Label>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${!storySetupCollapsed ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4 space-y-4">
                  {/* Row 1: Dropdowns */}
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Artstyle</Label>
                      <Select value={storyArtStyle} onValueChange={setStoryArtStyle}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STORY_ART_STYLES.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Standard-Übergang</Label>
                      <Select value={storyTransitionType} onValueChange={setStoryTransitionType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STORY_TRANSITION_TYPES.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Row 4: Custom Details */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Besondere Details / Anweisungen</Label>
                    <Textarea
                      placeholder="z.B. 'Immer warmes Abendlicht', 'Film-Noir Stil', 'Keine Nahaufnahmen'..."
                      value={storyCustomDetails}
                      onChange={(e) => setStoryCustomDetails(e.target.value)}
                      className="min-h-[60px] resize-y text-sm"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

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
                {storyPoints.length === 0 ? (
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
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2 items-center">
                      {/* If images exist: small "Bilder neu generieren" + format dropdown + big "Video Prompt generieren" */}
                      {storyPoints.some(p => p.generatedImage) ? (
                        <>
                          <Button
                            onClick={generateStoryImagesAndPrompts}
                            disabled={isGeneratingStoryImages || isGeneratingStoryboard || isGeneratingVideoPrompts}
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                          >
                            {isGeneratingStoryImages ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                Szene {(generatingStoryImageIndex ?? 0) + 1}/{storyPoints.length}
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                Bilder neu generieren
                              </>
                            )}
                          </Button>
                          {/* Veo3 Format Dropdown */}
                          <Select value={storyboardFormat} onValueChange={setStoryboardFormat}>
                            <SelectTrigger className="w-[130px] shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VEO3_FORMAT_OPTIONS.map(opt => (
                                <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {/* Show "Video generieren" if all scenes with images have video prompts, otherwise "Video Prompt generieren" */}
                          {storyPoints.filter(p => p.generatedImage).every(p => p.videoPrompt) ? (
                            <Button
                              onClick={generateVideos}
                              disabled={isGeneratingVideos || isGeneratingStoryImages || isGeneratingStoryboard || isGeneratingVideoPrompts}
                              className="flex-1"
                            >
                              {isGeneratingVideos ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  {videoGenerationPhase === "uploading" && `Upload Szene ${(generatingVideoIndex ?? 0) + 1}/${storyPoints.length}...`}
                                  {videoGenerationPhase === "generating" && `Starte Szene ${(generatingVideoIndex ?? 0) + 1}/${storyPoints.length}...`}
                                  {videoGenerationPhase === "polling" && `Videos werden generiert...`}
                                  {videoGenerationPhase === "idle" && `Video generieren...`}
                                </>
                              ) : (
                                <>
                                  <Video className="w-4 h-4 mr-2" />
                                  Videos generieren
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={generateVideoPrompts}
                              disabled={isGeneratingVideoPrompts || isGeneratingStoryImages || isGeneratingStoryboard}
                              className="flex-1"
                            >
                              {isGeneratingVideoPrompts ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Video Prompt {(generatingVideoPromptIndex ?? 0) + 1}/{storyPoints.length}...
                                </>
                              ) : (
                                <>
                                  <Video className="w-4 h-4 mr-2" />
                                  Video Prompt generieren
                                </>
                              )}
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          {/* No images yet: big "Bilder generieren" button + format dropdown */}
                          <Button
                            onClick={generateStoryImagesAndPrompts}
                            disabled={isGeneratingStoryImages || isGeneratingStoryboard}
                            className="flex-1"
                          >
                            {isGeneratingStoryImages ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generiere Szene {(generatingStoryImageIndex ?? 0) + 1}/{storyPoints.length}...
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-4 h-4 mr-2" />
                                Bilder generieren
                              </>
                            )}
                          </Button>
                          {/* Veo3 Format Dropdown */}
                          <Select value={storyboardFormat} onValueChange={setStoryboardFormat}>
                            <SelectTrigger className="w-[130px] shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {VEO3_FORMAT_OPTIONS.map(opt => (
                                <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            disabled={isGeneratingStoryboard || isGeneratingStoryImages || isGeneratingVideoPrompts || isGeneratingVideos}
                            className="shrink-0"
                          >
                            <X className="w-4 h-4 mr-2" />
                            Alles löschen
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Storyboard komplett löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Alle generierten Szenen und Bilder werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={clearAllStoryboard}>
                              Alles löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                    {/* Veo3 Export Button - nur anzeigen wenn Bilder vorhanden */}
                    {storyPoints.some(p => p.generatedImage) && (
                      <Button
                        onClick={exportForVeo3}
                        disabled={isExportingVeo3 || isGeneratingStoryImages || isGeneratingVideoPrompts}
                        variant="secondary"
                        className="w-full"
                      >
                        {isExportingVeo3 ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Exportiere...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Für Veo3 exportieren
                          </>
                        )}
                      </Button>
                    )}
                    {/* Video Generation Results */}
                    {videoErrors.size > 0 && (
                      <div className="space-y-1">
                        {Array.from(videoErrors.entries()).map(([idx, err]) => (
                          <p key={idx} className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Szene {idx + 1}: {err}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

{/* Story Points Display - Always visible container */}
                <div className="bg-gradient-to-br from-muted/40 to-muted/20 rounded-xl p-4 min-h-[160px] border border-border/40 shadow-inner">
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
                        className="flex gap-4 overflow-x-auto pb-3 px-2 scrollbar-thin scroll-smooth"
                        onWheel={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const container = e.currentTarget;
                          container.scrollBy({ left: e.deltaY * 2, behavior: 'smooth' });
                        }}
                        style={{ overscrollBehavior: 'contain', perspective: '1000px' }}
                      >
                        {storyPoints.map((point, index) => (
                          <div 
                            key={regeneratingCardIndex === index ? `regen-${index}` : justFinishedIndex === index ? `flip-${index}` : `${storyboardAnimationKey}-${index}`}
                            className={cn(
                              "min-w-[260px] max-w-[300px] flex-shrink-0 relative h-[295px]",
                              regeneratingCardIndex === index 
                                ? "animate-storyboard-flip-away" 
                                : justFinishedIndex === index 
                                  ? "animate-storyboard-flip-back" 
                                  : (storyboardAnimationKey > 0 && !flippedCards.has(index)) ? "animate-storyboard-appear opacity-0" : ""
                            )}
                            style={{ 
                              animationDelay: (regeneratingCardIndex === index || justFinishedIndex === index) ? '0ms' : `${index * 120}ms`, 
                              animationFillMode: 'both',
                              transformStyle: 'preserve-3d'
                            }}
                          >
                            {/* Card Back - decorative (shown during card flip) */}
                            <div 
                              className="absolute inset-0 bg-background rounded-xl border border-border/40 shadow-lg overflow-hidden"
                              style={{ 
                                backfaceVisibility: 'hidden',
                                WebkitBackfaceVisibility: 'hidden',
                                transform: 'rotateX(180deg)'
                              }}
                            >
                              {/* Decorative pattern */}
                              <div className="absolute inset-0 opacity-[0.07]">
                                <div className="absolute top-4 left-4 w-16 h-16 border-2 border-foreground rounded-full" />
                                <div className="absolute top-8 left-8 w-12 h-12 border-2 border-foreground rounded-full" />
                                <div className="absolute bottom-4 right-4 w-20 h-20 border-2 border-foreground rounded-full" />
                                <div className="absolute bottom-10 right-10 w-10 h-10 border-2 border-foreground rounded-full" />
                              </div>
                              {/* Center icon */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center border border-border/50">
                                  {justFinishedIndex === index ? (
                                    <Check className="w-8 h-8 text-primary animate-scale-in" />
                                  ) : regeneratingCardIndex === index ? (
                                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                                  ) : (
                                    <Sparkles className="w-8 h-8 text-muted-foreground/50" />
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Card Front */}
                            <div 
                              className="absolute inset-0 group bg-gradient-to-b from-background to-background/90 rounded-xl border border-border/40 overflow-hidden shadow-lg hover:shadow-xl hover:border-primary/30"
                              style={{ 
                                backfaceVisibility: 'hidden',
                                WebkitBackfaceVisibility: 'hidden',
                                transform: 'rotateX(0deg)',
                                transition: 'box-shadow 0.3s ease, border-color 0.3s ease'
                              }}
                            >
                            {/* Scene number header bar with controls */}
                            <div className="bg-muted/40 border-b border-border/30 flex items-center justify-between px-4 py-2.5">
                              <span className="font-semibold text-foreground/80 text-sm">Szene {index + 1}</span>
                              
                              <div className="flex items-center gap-1.5">
                                <div className="flex items-center bg-background/50 rounded-full px-2 py-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full hover:bg-muted h-5 w-5"
                                    onClick={() => navigateStoryPointVersion(index, 'prev')}
                                    disabled={point.currentVersion === 0}
                                  >
                                    <ChevronLeft className="w-3 h-3" />
                                  </Button>
                                  <span className="font-semibold min-w-[32px] text-center text-xs">
                                    {point.currentVersion + 1}/{point.versions.length}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full hover:bg-muted h-5 w-5"
                                    onClick={() => navigateStoryPointVersion(index, 'next')}
                                    disabled={point.currentVersion === point.versions.length - 1}
                                  >
                                    <ChevronRight className="w-3 h-3" />
                                  </Button>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-full hover:bg-primary/10 hover:text-primary h-6 w-6"
                                  onClick={() => regenerateStoryPoint(index)}
                                  disabled={regeneratingPointIndex !== null}
                                >
                                  {regeneratingPointIndex === index ? (
                                    <Loader2 className="animate-spin w-3.5 h-3.5" />
                                  ) : (
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary"
                                  onClick={() => setExpandedStoryPointIndex(index)}
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Scene content - clean card layout */}
                            <div className="p-3 flex-1 flex flex-col">
                              {point.generatedImage ? (
                                <>
                                  {/* Generated Image with flip animation for regeneration */}
                                  <div 
                                    className="relative rounded-lg overflow-hidden bg-muted/10 h-[160px] w-full group/image"
                                    style={{ perspective: '600px' }}
                                  >
                                    {/* Image flip container - only image flips during regeneration */}
                                    <div 
                                      className={cn(
                                        "w-full h-full transition-transform duration-500",
                                        regeneratingImageOnlyIndex === index && "animate-image-flip-out",
                                        justFinishedImageOnlyIndex === index && "animate-image-flip-in"
                                      )}
                                      style={{ 
                                        transformStyle: 'preserve-3d',
                                      }}
                                    >
                                      {/* Front - video player if available, otherwise image */}
                                      <div 
                                        className="absolute inset-0 flex items-center justify-center"
                                        style={{ backfaceVisibility: 'hidden' }}
                                      >
                                        {point.generatedVideo ? (
                                          <video 
                                            src={point.generatedVideo} 
                                            className="max-w-full max-h-full object-contain"
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                          />
                                        ) : (
                                          <img 
                                            src={point.generatedImage} 
                                            alt={`Szene ${index + 1}`}
                                            className="max-w-full max-h-full object-contain"
                                          />
                                        )}
                                        
                                        {/* Video generation status overlay */}
                                        {(() => {
                                          const hasTask = videoTaskIds.has(index);
                                          const hasResult = videoResults.has(index) || point.generatedVideo;
                                          const hasError = videoErrors.has(index);
                                          const isProcessing = hasTask && isGeneratingVideos && !hasResult && !hasError;
                                          const isWaiting = isGeneratingVideos && !hasTask && !hasResult && !hasError && generatingVideoIndex !== null && index > generatingVideoIndex;
                                          const isCompleted = hasResult && !hasError && isGeneratingVideos;
                                          const showOverlay = isProcessing || isWaiting || isCompleted || hasError;
                                          
                                          return (
                                            <div 
                                              className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg overflow-hidden"
                                              style={{
                                                backgroundColor: showOverlay ? (isWaiting ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.4)') : 'rgba(0,0,0,0)',
                                                backdropFilter: showOverlay ? 'blur(1px)' : 'blur(0px)',
                                                opacity: isCompleted ? 0 : (showOverlay ? 1 : 0),
                                                transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.5s ease, backdrop-filter 0.5s ease',
                                                transitionDelay: isCompleted ? '1.8s' : '0s',
                                              }}
                                            >
                                              {/* Completed state */}
                                              <div 
                                                className="absolute flex flex-col items-center gap-1"
                                                style={{
                                                  opacity: isCompleted ? 1 : 0,
                                                  transform: isCompleted ? 'translateY(-4px) scale(1)' : 'translateY(12px) scale(0.8)',
                                                  transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                                                }}
                                              >
                                                <div className="w-8 h-8 rounded-full bg-green-500/90 flex items-center justify-center shadow-lg shadow-green-500/30">
                                                  <Check className="w-5 h-5 text-white" />
                                                </div>
                                                <span className="text-[10px] font-medium text-white/90">Fertig</span>
                                              </div>
                                              
                                              {/* Error state */}
                                              <div 
                                                className="absolute flex flex-col items-center gap-1 max-w-[90%]"
                                                style={{
                                                  opacity: hasError ? 1 : 0,
                                                  transform: hasError ? 'scale(1)' : 'scale(0.8)',
                                                  transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                                                }}
                                              >
                                                <div className="w-8 h-8 rounded-full bg-destructive/90 flex items-center justify-center">
                                                  <AlertCircle className="w-5 h-5 text-white" />
                                                </div>
                                                <span className="text-[10px] font-medium text-white/90 text-center line-clamp-3 px-1">
                                                  {videoErrors.get(index) || 'Fehler'}
                                                </span>
                                              </div>
                                              
                                              {/* Processing state */}
                                              <div 
                                                className="absolute flex flex-col items-center gap-1"
                                                style={{
                                                  opacity: isProcessing ? 1 : 0,
                                                  transform: isProcessing ? 'scale(1)' : 'scale(0.85)',
                                                  transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                                                }}
                                              >
                                                <Loader2 className="w-7 h-7 text-white animate-spin" />
                                                <span className="text-[10px] font-medium text-white/90">Video wird erstellt...</span>
                                              </div>
                                              
                                              {/* Waiting state */}
                                              <div 
                                                className="absolute flex flex-col items-center gap-1"
                                                style={{
                                                  opacity: isWaiting ? 1 : 0,
                                                  transform: isWaiting ? 'scale(1)' : 'scale(0.85)',
                                                  transition: 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                                                }}
                                              >
                                                <Clock className="w-6 h-6 text-white/70" />
                                                <span className="text-[10px] font-medium text-white/70">Wartend...</span>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                      {/* Back - decorative pattern like card back */}
                                      <div 
                                        className="absolute inset-0 bg-background rounded-lg overflow-hidden"
                                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                      >
                                        {/* Decorative pattern */}
                                        <div className="absolute inset-0 opacity-[0.07]">
                                          <div className="absolute top-2 left-2 w-10 h-10 border-2 border-foreground rounded-full" />
                                          <div className="absolute top-4 left-4 w-6 h-6 border-2 border-foreground rounded-full" />
                                          <div className="absolute bottom-2 right-2 w-12 h-12 border-2 border-foreground rounded-full" />
                                          <div className="absolute bottom-5 right-5 w-6 h-6 border-2 border-foreground rounded-full" />
                                        </div>
                                        {/* Center loader */}
                                        <div className="absolute inset-0 flex items-center justify-center">
                                          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center border border-border/50">
                                            {justFinishedImageOnlyIndex === index ? (
                                              <Check className="w-6 h-6 text-primary animate-scale-in" />
                                            ) : (
                                              <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    {/* Format label */}
                                    {point.generatedImage && generatingStoryImageIndex !== index && !regeneratingImageOnlyIndex && (
                                      <div className="absolute bottom-1.5 left-1.5 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded pointer-events-none z-10">
                                        {storyboardFormat}
                                      </div>
                                    )}
                                    {/* Shot type label */}
                                    {point.shotType && generatingStoryImageIndex !== index && !regeneratingImageOnlyIndex && (
                                      <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded pointer-events-none z-10">
                                        {point.shotType.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                      </div>
                                    )}
                                    {/* Quick Action Overlay on hover - hidden during regeneration */}
                                    {regeneratingImageOnlyIndex !== index && (
                                      <div 
                                        className="absolute inset-0 bg-black/50 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center gap-3 z-20 cursor-pointer"
                                        onClick={() => setExpandedStoryPointIndex(index)}
                                      >
                                        <Button 
                                          size="icon" 
                                          variant="secondary" 
                                          className="h-9 w-9 rounded-full shadow-lg"
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            // Download single image
                                            const link = document.createElement('a');
                                            link.href = point.generatedImage!;
                                            link.download = `szene-${index + 1}-${storyboardFormat.replace(':', 'x')}.png`;
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                          }}
                                        >
                                          <Download className="w-4 h-4" />
                                        </Button>
                                        <Button 
                                          size="icon" 
                                          variant="secondary" 
                                          className="h-9 w-9 rounded-full shadow-lg"
                                          onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if (point.generatedVideo || point.videoPrompt) {
                                              regenerateSingleVideo(index);
                                            } else {
                                              regenerateImageOnly(index);
                                            }
                                          }}
                                          disabled={regeneratingPointIndex !== null || isGeneratingVideos}
                                        >
                                          <RefreshCw className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Scene summary - compact */}
                                  <div className="mt-2 bg-muted/30 rounded-lg p-2 border border-border/20">
                                    <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2">
                                      {point.summary || point.sceneDescription || point.versions[point.currentVersion]}
                                    </p>
                                  </div>
                                </>
                              ) : point.generationError ? (
                                <div className={cn(
                                  "rounded-lg p-3 flex-1 flex flex-col items-center justify-center gap-3 border-2 transition-colors",
                                  regeneratingPointIndex === index 
                                    ? "bg-primary/10 border-primary/30" 
                                    : point.generationError.includes("Versuch") 
                                      ? "bg-muted/30 border-border/30"
                                      : "bg-destructive/15 border-destructive/40"
                                )}>
                                  <div className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center",
                                    regeneratingPointIndex === index 
                                      ? "bg-primary/20" 
                                      : point.generationError.includes("Versuch")
                                        ? "bg-muted/50"
                                        : "bg-destructive/20"
                                  )}>
                                    {regeneratingPointIndex === index || point.generationError.includes("Versuch") ? (
                                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                    ) : (
                                      <AlertCircle className="w-6 h-6 text-destructive" />
                                    )}
                                  </div>
                                  <div className="text-center">
                                    <p className={cn(
                                      "text-xs font-medium",
                                      regeneratingPointIndex === index || point.generationError.includes("Versuch")
                                        ? "text-primary"
                                        : "text-destructive"
                                    )}>
                                      {regeneratingPointIndex === index 
                                        ? "Generiere neu..."
                                        : point.generationError.includes("Fehlgeschlagen") 
                                          ? "Generierung fehlgeschlagen"
                                          : point.generationError
                                      }
                                    </p>
                                    {point.generationError.includes("Fehlgeschlagen") && (
                                      <p className="text-xs text-muted-foreground mt-1 max-w-[180px]">
                                        {point.generationError.replace(/^Fehlgeschlagen nach \d+ Versuchen: /, '')}
                                      </p>
                                    )}
                                  </div>
                                  {!regeneratingPointIndex && !point.generationError.includes("Versuch") && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="text-xs h-8 px-4"
                                      onClick={() => regenerateSingleStoryScene(index)}
                                      disabled={regeneratingPointIndex !== null}
                                    >
                                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                      Neu generieren (5 Versuche)
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <div className="flex-1 flex flex-col p-2">
                                  {generatingStoryImageIndex === index ? (
                                    <>
                                      {/* Image placeholder sliding from top */}
                                      <div className="relative rounded-lg overflow-hidden bg-muted/10 flex items-center justify-center animate-image-from-top aspect-video mb-3">
                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5" />
                                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                      </div>
                                      {/* Text field tweening to bottom position */}
                                      <div className="bg-muted/30 rounded-lg p-2.5 border border-border/20 animate-text-to-bottom overflow-hidden">
                                        <p className="text-xs text-foreground/60 leading-relaxed line-clamp-3">
                                          {point.summary || point.versions[point.currentVersion]}
                                        </p>
                                      </div>
                                    </>
                                  ) : (
                                    /* Show summary in card, editing happens in popup */
                                    <div className="flex-1 flex flex-col">
                                      <div className="bg-muted/30 rounded-lg p-3 border border-border/20 flex-1">
                                        <p className="text-sm text-foreground/80 leading-relaxed">
                                          {point.summary || point.versions[point.currentVersion]}
                                        </p>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-2 text-center">
                                        Klicke auf <Maximize2 className="w-3 h-3 inline mx-0.5" /> für Details
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            </div>
                          </div>
                        ))}

                      </div>
                    </div>
                  )}

                  {/* Expanded Card Popup Modal - New Design */}
                  {expandedStoryPointIndex !== null && storyPoints[expandedStoryPointIndex] && (
                    <StoryDetailPopup
                      expandedIndex={expandedStoryPointIndex}
                      storyPoints={storyPoints}
                      isClosing={isClosingPopup}
                      onClose={handleCloseExpandedCard}
                      onUpdateStoryPoint={(index, updates) => {
                        setStoryPoints(prev => prev.map((p, i) => 
                          i === index ? { ...p, ...updates } : p
                        ));
                      }}
                      onNavigateScene={(direction) => {
                        if (expandedStoryPointIndex === null) return;
                        const newIndex = direction === 'prev' 
                          ? expandedStoryPointIndex - 1 
                          : expandedStoryPointIndex + 1;
                        if (newIndex >= 0 && newIndex < storyPoints.length) {
                          setExpandedStoryPointIndex(newIndex);
                        }
                      }}
                      onRegenerateImage={regenerateSingleStoryScene}
                      onFinalizeScene={(index) => {
                        setStoryPoints(prev => prev.map((p, i) => 
                          i === index ? { 
                            ...p, 
                            finalSnapshot: { ...p },
                            finalizedAt: Date.now()
                          } : p
                        ));
                      }}
                      onDiscardChanges={(index) => {
                        setStoryPoints(prev => prev.map((p, i) => {
                          if (i !== index || !p.finalSnapshot) return p;
                          return { ...p.finalSnapshot, finalSnapshot: p.finalSnapshot, finalizedAt: p.finalizedAt };
                        }));
                      }}
                      regeneratingIndex={regeneratingPointIndex}
                      veo3CameraMovements={VEO3_CAMERA_MOVEMENTS}
                      sceneAssistantInput={sceneAssistantInput}
                      setSceneAssistantInput={setSceneAssistantInput}
                      isGeneratingAssistant={isGeneratingSceneAssistant}
                      onAssistantSubmit={() => {
                        handleSceneAssistant();
                      }}
                      onCopyVideoPrompt={() => {
                        const point = storyPoints[expandedStoryPointIndex];
                        const copyText = point.videoPrompt || '';
                        navigator.clipboard.writeText(copyText);
                      }}
                      onUpdateVideoPrompt={(index, videoPrompt) => {
                        setStoryPoints(prev => prev.map((p, i) => 
                          i === index ? { ...p, videoPrompt } : p
                        ));
                      }}
                      onRegenerateVideo={(index) => regenerateSingleVideo(index)}
                      isGeneratingVideo={isGeneratingVideos}
                      generatingVideoIndex={generatingVideoIndex}
                      videoErrors={videoErrors}
                      totalScenes={storyPoints.length}
                      finalizedCount={storyPoints.filter(p => p.finalSnapshot).length}
                      aspectRatio={storyboardFormat}
                      onSaveVersion={(index) => {
                        const SNAPSHOT_FIELDS = ['summary', 'detailedDescription', 'dialogText', 'videoPrompt', 'cameraAngle', 'shotType', 'keyAction', 'specificArea', 'emotion', 'audienceEffect', 'composition', 'movement', 'negativePrompts', 'styleNotes', 'continuityNotes', 'generatedImage', 'generatedVideo', 'detailedImagePrompt'] as const;
                        setStoryPoints(prev => prev.map((p, i) => {
                          if (i !== index) return p;
                          const snapshot: Record<string, any> = {};
                          for (const f of SNAPSHOT_FIELDS) {
                            snapshot[f] = p[f];
                          }
                          const versions = [...(p.sceneVersions || []), snapshot];
                          return { ...p, sceneVersions: versions, currentSceneVersion: versions.length - 1 };
                        }));
                      }}
                      onSwitchVersion={(index, versionIndex) => {
                        setStoryPoints(prev => prev.map((p, i) => {
                          if (i !== index) return p;
                          const versions = p.sceneVersions || [];
                          if (versionIndex < 0 || versionIndex >= versions.length) return p;
                          const snapshot = versions[versionIndex];
                          return { ...p, ...snapshot, currentSceneVersion: versionIndex };
                        }));
                      }}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Merged Video Result */}
        {storyPoints.some(p => p.generatedVideo) && (
          <VideoMerger
            videos={storyPoints
              .map((p, i) => p.generatedVideo ? { index: i, url: p.generatedVideo } : null)
              .filter((v): v is { index: number; url: string } => v !== null)}
            className="mt-4"
          />
        )}

        {/* Image Viewer Dialog */}
        <Dialog open={selectedImageIndex !== null} onOpenChange={() => { setSelectedImageIndex(null); setImageZoom(1); setImagePosition({ x: 0, y: 0 }); }}>
          <DialogContent className="max-w-6xl w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[80vw] h-[90vh] max-h-[90vh] p-0 bg-background/95 backdrop-blur-sm border-border/50 flex flex-col overflow-hidden">
            {selectedImageIndex !== null && imageSlots[selectedImageIndex] && (
              <>
                {/* Header with counter, version nav, and download */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    {imageSlots[selectedImageIndex].status === "completed" && imageSlots[selectedImageIndex].imageUrl && (
                      <DownloadButton
                        imageUrl={imageSlots[selectedImageIndex].imageUrl!}
                        fileName={`character-${selectedImageIndex + 1}.png`}
                        variant="gallery"
                        isBasicPlan={!isPro}
                        onLockedClick={() => setShowUpgradePopup(true)}
                      />
                    )}
                    {/* Regenerate button in viewer */}
                    {imageSlots[selectedImageIndex].status === "completed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegenerateSlot(selectedImageIndex)}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Neu generieren
                      </Button>
                    )}
                  </div>
                  {/* Version navigation (if multiple versions) */}
                  {(() => {
                    const slot = imageSlots[selectedImageIndex];
                    const versions = slot?.imageVersions || [];
                    const vIdx = slot?.currentVersionIndex ?? 0;
                    if (versions.length <= 1) return (
                      <div className="bg-muted px-3 py-1 rounded-full">
                        <span className="text-sm font-medium">
                          {selectedImageIndex + 1} / {imageSlots.length}
                        </span>
                      </div>
                    );
                    return (
                      <div className="flex items-center gap-2">
                        <div className="bg-muted px-3 py-1 rounded-full">
                          <span className="text-sm font-medium">
                            Bild {selectedImageIndex + 1} / {imageSlots.length}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 bg-primary/10 border border-primary/30 px-2 py-1 rounded-full">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full"
                            onClick={() => handleVersionChange(selectedImageIndex, vIdx - 1)}
                            disabled={vIdx === 0}
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </Button>
                          <span className="text-xs font-medium text-primary min-w-[40px] text-center">
                            Version {vIdx + 1}/{versions.length}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full"
                            onClick={() => handleVersionChange(selectedImageIndex, vIdx + 1)}
                            disabled={vIdx === versions.length - 1}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="w-[100px]" /> {/* Spacer for balance */}
                </div>

                {/* Main Image Area with Navigation and Side Panel */}
                <div className="flex-1 relative flex min-h-0 overflow-hidden">
                  {/* Image Area */}
                  <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden transition-all duration-300">
                    {/* Navigation Controls - centered at bottom */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="rounded-full bg-background/90 hover:bg-background shadow-lg backdrop-blur-sm h-10 w-10"
                        onClick={() => navigateImage('prev')}
                        disabled={selectedImageIndex === 0}
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </Button>
                      
                      <span className="text-sm font-medium bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
                        {selectedImageIndex + 1} / {imageSlots.length}
                      </span>
                      
                      <Button
                        variant="secondary"
                        size="icon"
                        className="rounded-full bg-background/90 hover:bg-background shadow-lg backdrop-blur-sm h-10 w-10"
                        onClick={() => navigateImage('next')}
                        disabled={selectedImageIndex === imageSlots.length - 1}
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Button>
                    </div>

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
                    <div className="flex-shrink-0 flex items-stretch">
                      {/* Toggle Button - moves with panel */}
                      <button
                        onClick={() => setVideoPromptOpen(!videoPromptOpen)}
                        className="flex-shrink-0 w-8 h-14 self-center bg-zinc-800 hover:bg-zinc-700 text-white flex flex-col items-center justify-center gap-1 transition-all rounded-l-md shadow-lg"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <ChevronRight 
                          className={`w-3.5 h-3.5 transition-transform duration-300 ${videoPromptOpen ? 'rotate-0' : 'rotate-180'}`} 
                        />
                      </button>
                      
                      {/* Panel Content */}
                      <div 
                        className={`border-l border-border/50 bg-gradient-to-b from-card to-card/80 flex flex-col overflow-hidden transition-all duration-300 ease-out ${
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
                                  className="min-h-[180px] text-xs resize-y flex-1"
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
                                        className="flex-1 text-xs min-h-[80px] resize-y"
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
                    </div>
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

          {/* Character Creator Tab Content */}
          {activeMainTab === "character" && (
            <CharacterCreator 
              apiKey={apiKey} 
              allImages={characterImages} 
              setAllImages={setCharacterImages}
              planCode={authData.planCode}
              onUseAsReference={refImageSource ? async (imageUrl: string) => {
                if (refImageSource === "poses") {
                  // Convert URL to File for poses reference images
                  try {
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `character-ref-${Date.now()}.png`, { type: 'image/png' });
                    const maxImages = isPro ? 3 : 1;
                    setReferenceImages(prev => {
                      if (prev.length >= maxImages) return prev;
                      const updated = [...prev, file];
                      referenceImagesRef.current = updated;
                      return updated;
                    });
                  } catch (err) {
                    console.error("Failed to convert character image to File:", err);
                  }
                } else if (refImageSource === "story") {
                  setStoryReferenceImages(prev => {
                    if (prev.length >= 2) return prev;
                    const updated = [...prev, imageUrl];
                    saveToLocalStorage('storyReferenceImages', updated);
                    return updated;
                  });
                }
                setActiveMainTab(refImageSource);
                setRefImageSource(null);
              } : undefined}
              refImageSourceLabel={refImageSource === "poses" ? "Avatar Shooting Studio" : refImageSource === "story" ? "Story Generator" : undefined}
            />
          )}

          </>
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
