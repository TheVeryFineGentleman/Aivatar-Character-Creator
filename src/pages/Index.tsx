import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Upload, Image as ImageIcon, Download, ChevronLeft, ChevronRight, ChevronDown, X, Settings, RotateCcw, Plus, LogOut, Lock, Scale, Video, Loader2, Send, Undo2, Clock, Move, Zap, BookOpen, RefreshCw, Maximize2, MessageSquare, Check, Mountain, AlertCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageGallery, ImageSlotData } from "@/components/ImageGallery";
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
import { LegalDialog } from "@/components/LegalDialog";
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
  const [selectedCameraAngle, setSelectedCameraAngle] = useState("random");
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
  
  // AI Background Suggestion state
  const [aiBackgroundSuggestion, setAiBackgroundSuggestion] = useState("");
  const [isGeneratingBackgroundSuggestion, setIsGeneratingBackgroundSuggestion] = useState(false);
  
  // AI Assistant Target (unified control for prompt/background)
  const [aiAssistantTarget, setAiAssistantTarget] = useState<"prompt" | "background" | "both">("prompt");

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
    generationError?: string;
    sceneTitle?: string;
    sceneDescription?: string;
    // Veo3-optimierte Felder
    veo3CameraMovement?: string;  // z.B. "dolly-in", "pan-left"
    veo3StartState?: string;      // Beschreibung des Startframes
    veo3Motion?: string;          // Bewegung/Aktion
    veo3EndState?: string;        // Beschreibung des Endframes für Übergang
  }>>([]);
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
  
  // AI Scene Assistant state
  const [sceneAssistantInput, setSceneAssistantInput] = useState("");
  const [isGeneratingSceneAssistant, setIsGeneratingSceneAssistant] = useState(false);
  
  // Story Idea AI Assistant state
  const [storyAiAssistantInput, setStoryAiAssistantInput] = useState("");
  const [isGeneratingStoryAiIdea, setIsGeneratingStoryAiIdea] = useState(false);
  
  // Scene Edit Popup - Tab-based UI state
  const [sceneEditTab, setSceneEditTab] = useState<"content" | "image" | "video">("content");
  
  // AI Assistant update mode: "text" = nur Text & Kamera, "image" = nur Bild neu, "both" = beides
  const [sceneAiMode, setSceneAiMode] = useState<"text" | "image" | "both">("text");
  
  // Derived values for backward compatibility
  const sceneAiUpdateText = sceneAiMode === "text" || sceneAiMode === "both";
  const sceneAiRegenerateImage = sceneAiMode === "image" || sceneAiMode === "both";

  // Browser compatibility check on mount
  useEffect(() => {
    const { compatible, issues } = checkBrowserCompatibility();
    if (!compatible) {
      console.warn("⚠️ Browser compatibility issues:", issues);
      toast({
        title: "Browser-Hinweis",
        description: `Mögliche Probleme: ${issues.join(", ")}. Bitte Chrome oder Firefox verwenden.`,
        variant: "destructive",
      });
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
    if (!apiKey || expandedStoryPointIndex === null || isGeneratingSceneAssistant) return;
    
    const currentPoint = storyPoints[expandedStoryPointIndex];
    const currentStory = currentPoint.versions[currentPoint.currentVersion];
    
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
"${currentStory}"

NUTZERANWEISUNG:
"${sceneAssistantInput.trim() || 'Optimiere die Szene für maximale visuelle Wirkung'}"

VERFÜGBARE KAMERAWINKEL (wähle genau einen value, Beschreibung hilft dir bei der Wahl):
${CAMERA_ANGLE_OPTIONS.map(o => `- "${o.value}": ${o.label} - ${o.description}`).join('\n')}

VERFÜGBARE SHOT-TYPEN (wähle genau einen value, Beschreibung hilft dir bei der Wahl):
${SHOT_TYPE_OPTIONS.map(o => `- "${o.value}": ${o.label} - ${o.description}`).join('\n')}

Antworte NUR mit einem validen JSON-Objekt in diesem Format:
{
  "story": "Die optimierte Szenen-Beschreibung (1-2 Sätze, auf Deutsch)",
  "cameraAngle": "einer der verfügbaren Kamerawinkel-values",
  "shotType": "einer der verfügbaren Shot-Typ-values"
}

Wähle Kamerawinkel und Shot-Typ passend zur Stimmung und Nutzeranweisung. Keine zusätzlichen Erklärungen, nur das JSON.`
              }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500
            }
          })
        }
      );

      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Update the story point with all fields
        const idx = expandedStoryPointIndex;
        setStoryPoints(prev => prev.map((p, i) => {
          if (i !== idx) return p;
          
          // Add new version for story
          const newVersions = [...p.versions, parsed.story];
          return {
            ...p,
            versions: newVersions,
            currentVersion: newVersions.length - 1,
            cameraAngle: parsed.cameraAngle,
            shotType: parsed.shotType
          };
        }));
        
        setSceneAssistantInput("");
        toast({
          title: "Szene optimiert",
          description: "Story, Kamerawinkel und Shot-Typ wurden aktualisiert."
        });
      }
    } catch (error) {
      console.error("Scene assistant error:", error);
      toast({
        title: "Fehler",
        description: "Die Szene konnte nicht optimiert werden.",
        variant: "destructive"
      });
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

  // Story Idea AI Assistant handler
  const handleGenerateStoryIdea = async () => {
    if (!apiKey || isGeneratingStoryAiIdea) return;
    
    setIsGeneratingStoryAiIdea(true);
    try {
      const existingIdeaContext = storyIdea.trim() 
        ? `\n\nAktuelle Story-Idee zur Referenz:\n"${storyIdea}"\n\nVerbessere oder ergänze diese basierend auf der Nutzer-Anfrage.`
        : "";
      
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Du bist ein Story-Autor für REALISTISCHE, lebensnahe Geschichten. Basierend auf der Nutzeranfrage, erstelle eine fesselnde Story-Idee.

NUTZERANFRAGE:
"${storyAiAssistantInput.trim() || 'Erstelle eine realistische Story-Idee'}"
${existingIdeaContext}

WICHTIGE REGELN:
- Erstelle eine klare, prägnante Story-Idee (1-3 Sätze)
- NUR realistische, alltägliche Szenarien! KEINE Fantasy, Magie, übernatürliche Elemente, Sci-Fi
- Fokussiere auf echte menschliche Emotionen, Beziehungen, Konflikte, Entscheidungen
- Die Idee sollte visuell umsetzbar sein für ein Storyboard
- Schreibe auf Deutsch
- Antworte NUR mit der Story-Idee selbst, keine Einleitungen oder Erklärungen`
              }]
            }],
            generationConfig: {
              temperature: 0.9,
              maxOutputTokens: 500
            }
          })
        }
      );

      if (!response.ok) throw new Error("API request failed");

      const data = await response.json();
      const generatedIdea = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      
      if (generatedIdea) {
        setStoryIdea(generatedIdea);
        setStoryAiAssistantInput("");
        
        toast({
          title: "Story-Idee generiert!",
          description: "Die KI hat eine neue Story-Idee erstellt."
        });
      }
    } catch (error) {
      toast({
        title: "Fehler",
        description: "Die Story-Idee konnte nicht generiert werden.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingStoryAiIdea(false);
    }
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
          toast({
            title: "Fehler beim Verarbeiten",
            description: `${file.name} konnte nicht verarbeitet werden.`,
            variant: "destructive",
          });
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
    if (!apiKey || !storyIdea.trim() || isGeneratingStoryboard) return;
    
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

STORY-IDEE: "${storyIdea}"

WICHTIGSTE REGEL - RÄUMLICHE EINHEIT:
Definiere ZUERST einen HAUPTORT für die gesamte Geschichte. 
ALLE ${storyPointCount} Szenen spielen an diesem EINEN Ort.
Variiere nur den BEREICH innerhalb des Ortes.

Beispiel: Hauptort = "eine alte Villa am See"
- Szene 1: Im Eingangsbereich der Villa
- Szene 2: Im Wohnzimmer mit Blick auf den See  
- Szene 3: Auf der Terrasse der Villa

WICHTIG: Antworte NUR mit diesem validen JSON-Format:
{
  "mainLocation": "Der Hauptort der gesamten Geschichte (z.B. 'eine moderne Stadtwohnung', 'ein altes Landhaus')",
  "scenes": [
    {
      "summary": "1-Satz Zusammenfassung (max. 15 Wörter)",
      "specificArea": "Welcher Bereich des Hauptorts (z.B. 'im Flur', 'auf dem Balkon', 'in der Küche')",
      "keyAction": "Die EINE zentrale Aktion/Gestik der Person (z.B. 'lehnt nachdenklich am Fenster', 'sitzt zusammengesunken auf der Couch', 'steht mit verschränkten Armen')",
      "emotion": "Die sichtbare Emotion (z.B. 'melancholisch', 'hoffnungsvoll', 'nachdenklich', 'entschlossen')",
      "detailedDescription": "Ausführliche visuelle Beschreibung (3-4 Sätze): Atmosphäre, Beleuchtung, was die Person tut, wichtige Details",
      "cameraAngle": "eye-level|low-angle|high-angle|dutch-angle|over-shoulder|bird-eye|worm-eye",
      "shotType": "extreme-close-up|close-up|medium-close-up|medium-shot|medium-full-shot|full-shot|long-shot|extreme-long-shot"
    }
  ]
}

REGELN:
- Jede Szene hat EINE klare Aktion/Gestik
- Die Szenen bauen logisch aufeinander auf
- Der Hauptort bleibt IMMER gleich, nur der Bereich wechselt
- NUR realistische Szenarien, keine Fantasy oder Magie
- Emotionen müssen visuell darstellbar sein
- Antworte NUR mit dem JSON, keine zusätzlichen Erklärungen`
              }]
            }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 4000
            }
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          // Extract JSON object from response (new format with mainLocation)
          const jsonObjectMatch = text.match(/\{[\s\S]*\}/);
          if (jsonObjectMatch) {
            try {
              const parsed = JSON.parse(jsonObjectMatch[0]);
              const mainLocation = parsed.mainLocation || "";
              const scenes = parsed.scenes || [];
              
              if (Array.isArray(scenes) && scenes.length > 0) {
                // Store main location globally for image generation
                setStoryboardMainLocation(mainLocation);
                
                setStoryPoints(scenes.slice(0, storyPointCount).map((scene: any) => ({
                  versions: [scene.detailedDescription || scene.summary || ""],
                  currentVersion: 0,
                  summary: scene.summary || "",
                  detailedDescription: scene.detailedDescription || "",
                  specificArea: scene.specificArea || "",
                  keyAction: scene.keyAction || "",
                  emotion: scene.emotion || "",
                  cameraAngle: scene.cameraAngle || "",
                  shotType: scene.shotType || ""
                })));
                setStoryboardAnimationKey(prev => prev + 1);
              }
            } catch (parseError) {
              console.error("JSON parse error, falling back to line-based parsing:", parseError);
              // Fallback to line-based parsing
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
          } else {
            // Fallback to line-based parsing if no JSON found
            const points = text.split('\n')
              .map((line: string) => line.trim())
              .filter((line: string) => line.length > 5)
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
      toast({
        title: "Fehler",
        description: "Das Storyboard konnte nicht generiert werden.",
        variant: "destructive"
      });
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
    toast({
      title: "Storyboard gelöscht",
      description: "Alle Szenen und Bilder wurden entfernt."
    });
  };

  // Export Storyboard für Veo3 als ZIP-Datei
  const exportForVeo3 = async () => {
    if (storyPoints.length === 0 || isExportingVeo3) return;
    
    const hasImages = storyPoints.some(p => p.generatedImage);
    if (!hasImages) {
      toast({
        title: "Keine Bilder vorhanden",
        description: "Generiere zuerst Bilder für dein Storyboard.",
        variant: "destructive"
      });
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
      
      toast({
        title: "Export erfolgreich!",
        description: `${storyPoints.length} Szenen als ZIP-Datei exportiert.`
      });
      
    } catch (error) {
      console.error("Veo3 export error:", error);
      toast({
        title: "Export fehlgeschlagen",
        description: "Die ZIP-Datei konnte nicht erstellt werden.",
        variant: "destructive"
      });
    } finally {
      setIsExportingVeo3(false);
    }
  };

  const regenerateStoryPoint = async (index: number) => {
    if (!apiKey || regeneratingPointIndex !== null) return;
    
    const point = storyPoints[index];
    
    // Check if this scene already has a generated image
    if (point.generatedImage) {
      // Image exists → regenerate image using regenerateSingleStoryScene
      await regenerateSingleStoryScene(index);
      return;
    }
    
    // No image yet → only regenerate text
    setRegeneratingPointIndex(index);
    setRegeneratingCardIndex(index); // Start flip-away animation
    try {
      const currentPoint = point.versions[point.currentVersion];
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
          setStoryPoints(prev => prev.map((p, i) => {
            if (i === index) {
              return {
                ...p,
                versions: [...p.versions, text],
                currentVersion: p.versions.length
              };
            }
            return p;
          }));
          // Trigger flip-back animation for this card
          setRegeneratingCardIndex(null);
          setJustFinishedIndex(index);
          setFlippedCards(prev => new Set(prev).add(index));
          setTimeout(() => setJustFinishedIndex(null), 700);
        }
      }
    } catch (error) {
      console.error("Failed to regenerate story point:", error);
    } finally {
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
        const imagePromptText = `
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
- Ultra high resolution photography
- Match lighting and atmosphere to the scene description
- 16:9 aspect ratio
`.trim();
        
        console.log(`Scene ${sceneIndex + 1} attempt ${attempt}: Structured prompt with keyAction="${sceneKeyAction}", emotion="${sceneEmotion}", location="${globalMainLocation}/${sceneSpecificArea}"`);

        // === EXACT SAME PAYLOAD AS POSE GENERATOR ===
        // Clean base64 images (remove data URL prefix if present)
        const cleanBase64Images = characterBase64Images.map(img => img.replace(/^data:image\/[a-z]+;base64,/, ''));
        
        // Build parts array: text FIRST, then reference images
        const parts = [
          { text: imagePromptText },
          ...cleanBase64Images.map(base64Data => ({
            inlineData: {
              mimeType: "image/png",
              data: base64Data,
            },
          })),
        ];

        // === NO safetySettings - exactly like pose generator ===
        const imageResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              generationConfig: {
                responseModalities: ["IMAGE", "TEXT"],
                imageConfig: {
                  aspectRatio: "16:9",
                },
              },
              // NO safetySettings - pose generator doesn't use them and works fine
            }),
          }
        );

        if (!imageResponse.ok) {
          throw new Error(getErrorMessageFromStatus(imageResponse.status, `Szene ${sceneIndex + 1}`));
        }

        let generatedImageUrl = "";
        const imageData = await imageResponse.json();
        const candidates = imageData.candidates ?? [];
        
        if (candidates.length > 0) {
          // Check for IMAGE_OTHER error
          if (candidates[0]?.finishReason === "IMAGE_OTHER" || candidates[0]?.finishReason === "SAFETY") {
            console.warn(`Scene ${sceneIndex + 1} attempt ${attempt}: ${candidates[0]?.finishReason}`);
            throw new Error(`Bild blockiert (${candidates[0]?.finishReason})`);
          }
          
          const partsOut = candidates[0]?.content?.parts ?? [];
          const imagePart = partsOut.find(
            (p: any) => p.inlineData && typeof p.inlineData.data === "string" && p.inlineData.mimeType?.startsWith("image/")
          );
          if (imagePart) {
            const base64 = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType || "image/png";
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let j = 0; j < binary.length; j++) {
              bytes[j] = binary.charCodeAt(j);
            }
            const blob = new Blob([bytes], { type: mimeType });
            generatedImageUrl = URL.createObjectURL(blob);
          }
        }
        
        if (!generatedImageUrl) {
          throw new Error(`Kein Bild generiert`);
        }

        // Generate Veo3 video prompt after successful image generation
        let videoPrompt = "";
        let veo3CameraMovement = "";
        let veo3StartState = "";
        let veo3Motion = "";
        let veo3EndState = "";
        
        try {
          const previousEndState = sceneIndex > 0 ? storyPoints[sceneIndex - 1]?.veo3EndState : null;
          const usedMovements = storyPoints.slice(0, sceneIndex).map(p => p.veo3CameraMovement).filter(Boolean);
          const availableMovements = VEO3_CAMERA_MOVEMENTS.filter(m => !usedMovements.includes(m.id)).map(m => `- "${m.id}": ${m.label}`);
          
          const videoPromptResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `Erstelle einen VEO3-Video-Prompt für Szene ${sceneIndex + 1}: "${storyText}"
${previousEndState ? `Vorherige Szene endete: "${previousEndState}"` : 'Erste Szene.'}
Verfügbare Kamerabewegungen: ${availableMovements.length > 0 ? availableMovements.join(', ') : VEO3_CAMERA_MOVEMENTS.map(m => m.id).join(', ')}
Antworte NUR mit JSON: {"cameraMovement":"id","startState":"...","motion":"...","endState":"...","fullPrompt":"..."}`
                  }]
                }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
              })
            }
          );
          
          if (videoPromptResponse.ok) {
            const vpData = await videoPromptResponse.json();
            const vpText = vpData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            try {
              const jsonMatch = vpText.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                veo3CameraMovement = parsed.cameraMovement || "";
                veo3StartState = parsed.startState || "";
                veo3Motion = parsed.motion || "";
                veo3EndState = parsed.endState || "";
                videoPrompt = parsed.fullPrompt || "";
              }
            } catch (e) {
              videoPrompt = vpText;
            }
          }
        } catch (e) {
          console.warn("Video prompt generation failed:", e);
        }

        clearTimeout(timeoutId);
        return {
          success: true,
          generatedImageUrl,
          detailedImagePrompt: imagePromptText,
          videoPrompt,
          sceneTitle: storyText.split(/[.!?]/)[0].substring(0, 50).trim(),
          sceneDescription: storyText,
          veo3CameraMovement,
          veo3StartState,
          veo3Motion,
          veo3EndState
        };

      } catch (error) {
        clearTimeout(timeoutId);
        console.error(`Attempt ${attempt}/${maxRetries} failed for scene ${sceneIndex + 1}:`, error);
        
        if (attempt < maxRetries) {
          const delayMs = attempt <= 2 ? 2000 : 3000;
          console.log(`🔄 Scene ${sceneIndex + 1}: Attempt ${attempt} failed, trying ${attempt + 1} in ${delayMs/1000}s...`);
          
          toast({
            title: `Szene ${sceneIndex + 1} - Versuch ${attempt}/${maxRetries}`,
            description: `Wechsle zu einfacherem Prompt...`,
          });
          
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
      toast({
        title: "Fehler: Keine Referenzbilder",
        description: "Die hochgeladenen Referenzbilder konnten nicht geladen werden. Bitte lade sie erneut hoch.",
        variant: "destructive"
      });
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
          toast({
            title: `Szene ${sceneIndex + 1} - Neuer Versuch ${cycleNumber}`,
            description: `Warte ${waitTime} Sekunden und starte neue Versuchsreihe...`,
          });
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
          return {
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
            generationError: undefined
          };
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
      
      toast({
        title: `Szene ${sceneIndex + 1} ✓`,
        description: `${successCount}/${storyPoints.length} - Starte nächste Szene...`
      });
    }
    
    setGeneratingStoryImageIndex(null);
    setIsGeneratingStoryImages(false);
    
    // Show summary toast
    const failedCount = storyPoints.filter((_, i) => !storyPoints[i]?.generatedImage && i < storyPoints.length).length;
    if (failedCount === 0) {
      toast({
        title: "Fertig!",
        description: `Alle ${storyPoints.length} Bilder und Video-Prompts wurden generiert.`
      });
    } else if (successCount > 0) {
      toast({
        title: "Teilweise fertig",
        description: `${successCount} von ${storyPoints.length} Bilder generiert.`,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Generierung fehlgeschlagen",
        description: "Keine Bilder konnten generiert werden. Bitte überprüfe deinen API-Key.",
        variant: "destructive"
      });
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

  // Regenerate a single failed story scene - NO AUTO RETRY, use SIMPLIFIED prompt immediately
  const regenerateSingleStoryScene = async (sceneIndex: number) => {
    if (!apiKey || regeneratingPointIndex !== null) return;
    
    setRegeneratingPointIndex(sceneIndex);
    setRegeneratingCardIndex(sceneIndex); // Start flip-away animation
    
    // Clear previous error
    setStoryPoints(prev => prev.map((p, idx) => {
      if (idx === sceneIndex) {
        return { ...p, generationError: undefined };
      }
      return p;
    }));
    
    const point = storyPoints[sceneIndex];
    const storyText = point.versions[point.currentVersion];
    
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
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    try {
      // ALWAYS use ultra-simplified prompt on manual retry - maximum 30 words
      const cameraLabel = point.cameraAngle && point.cameraAngle !== 'random'
        ? CAMERA_ANGLE_OPTIONS.find(o => o.value === point.cameraAngle)?.label || ''
        : '';
      const shotLabel = point.shotType
        ? SHOT_TYPE_OPTIONS.find(o => o.value === point.shotType)?.label || ''
        : '';
      const cameraShot = [cameraLabel, shotLabel].filter(Boolean).join(', ');
      
      // Ultra-minimal prompt - just the essentials (max ~30 words)
      const shortScene = storyText.substring(0, 60);
      const imagePromptText = sceneIndex === 0
        ? `Reference person. ${shortScene}. ${cameraShot}. 16:9.`
        : `Same person. ${shortScene}. ${cameraShot}. 16:9.`;
      
      console.log(`Regenerating scene ${sceneIndex + 1} with ultra-compact prompt:`, imagePromptText);
      
      // Build image parts - reference images FIRST
      const parts: any[] = [];
      for (const base64Data of characterBase64Images) {
        parts.push({ inlineData: { mimeType: "image/png", data: base64Data } });
      }
      
      // Add CURRENT scene's existing image as reference (for regeneration continuity)
      if (currentSceneImage) {
        try {
          const response = await fetch(currentSceneImage);
          const blob = await response.blob();
          const currentBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
          parts.push({ inlineData: { mimeType: "image/jpeg", data: currentBase64 } });
          console.log(`Added current scene image as reference for regeneration`);
        } catch (e) {
          console.warn("Could not add current scene as reference:", e);
        }
      }
      
      // Add previous scene image if available (for additional continuity)
      if (previousSceneImage && previousSceneImage !== currentSceneImage) {
        try {
          const response = await fetch(previousSceneImage);
          const blob = await response.blob();
          const prevBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
          parts.push({ inlineData: { mimeType: "image/jpeg", data: prevBase64 } });
        } catch (e) {
          console.warn("Could not add previous scene as reference:", e);
        }
      }
      
      // Text prompt LAST
      parts.push({ text: imagePromptText });
      
      const imageResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: { 
              responseModalities: ["IMAGE", "TEXT"],
              imageConfig: { aspectRatio: "16:9" }
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
            ]
          })
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!imageResponse.ok) {
        throw new Error(getErrorMessageFromStatus(imageResponse.status, "Bild"));
      }
      
      const imageData = await imageResponse.json();
      const candidates = imageData.candidates ?? [];
      let generatedImageUrl = "";
      
      // Check for safety/content blocks
      const finishReason = candidates[0]?.finishReason;
      if (finishReason === 'IMAGE_OTHER' || finishReason === 'SAFETY') {
        throw new Error(`Bild blockiert (${finishReason})`);
      }
      
      if (candidates.length > 0) {
        const partsOut = candidates[0]?.content?.parts ?? [];
        const imagePart = partsOut.find((p: any) => p.inlineData?.data && p.inlineData.mimeType?.startsWith("image/"));
        if (imagePart) {
          const base64 = imagePart.inlineData.data;
          const mimeType = imagePart.inlineData.mimeType || "image/png";
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
          const blob = new Blob([bytes], { type: mimeType });
          generatedImageUrl = URL.createObjectURL(blob);
        }
      }
      
      if (!generatedImageUrl) {
        throw new Error("Kein Bild generiert");
      }
      
      // Success! Update story point
      setStoryPoints(prev => prev.map((p, idx) => {
        if (idx === sceneIndex) {
          return {
            ...p,
            generatedImage: generatedImageUrl,
            detailedImagePrompt: imagePromptText,
            generationError: undefined
          };
        }
        return p;
      }));
      
      // Trigger flip-back animation
      setRegeneratingCardIndex(null);
      setJustFinishedIndex(sceneIndex);
      setFlippedCards(prev => new Set(prev).add(sceneIndex));
      setTimeout(() => setJustFinishedIndex(null), 700);
      
      toast({ title: `Szene ${sceneIndex + 1} generiert!` });
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      let errorMessage = "Unbekannter Fehler";
      if (error instanceof Error) {
        errorMessage = error.name === 'AbortError' ? "Zeitüberschreitung (2 Min.)" : error.message;
      }
      
      console.error(`Szene ${sceneIndex + 1} fehlgeschlagen:`, errorMessage);
      
      setStoryPoints(prev => prev.map((p, idx) => {
        if (idx === sceneIndex) {
          return { ...p, generationError: errorMessage };
        }
        return p;
      }));
      
      toast({ 
        title: `Szene ${sceneIndex + 1} fehlgeschlagen`, 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      // Always reset animation state on error too
      if (regeneratingCardIndex === sceneIndex) {
        setRegeneratingCardIndex(null);
      }
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
    const storyText = point.versions[point.currentVersion];
    
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
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    try {
      // Use same ultra-simplified prompt style as regenerateSingleStoryScene
      const cameraLabel = point.cameraAngle && point.cameraAngle !== 'random'
        ? point.cameraAngle.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : '';
      const shotLabel = point.shotType
        ? point.shotType.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        : '';
      const cameraShot = [cameraLabel, shotLabel].filter(Boolean).join(', ');
      
      // Ultra-minimal prompt - just the essentials
      const shortScene = storyText.substring(0, 60);
      const imagePromptText = sceneIndex === 0
        ? `Reference person. ${shortScene}. ${cameraShot}. 16:9.`
        : `Same person. ${shortScene}. ${cameraShot}. 16:9.`;

      // Build multimodal content array
      const contentParts: Array<{ type: string; text?: string; inlineData?: { mimeType: string; data: string } }> = [];
      
      // Text prompt first
      contentParts.push({ type: "text", text: imagePromptText });
      
      // Add character references
      for (const base64 of characterBase64Images) {
        contentParts.push({
          type: "inline_data",
          inlineData: { mimeType: "image/jpeg", data: base64 }
        });
      }
      
      // Add previous scene image for continuity
      if (previousSceneImage) {
        try {
          const response = await fetch(previousSceneImage);
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
          contentParts.push({
            type: "inline_data",
            inlineData: { mimeType: "image/jpeg", data: base64 }
          });
        } catch (error) {
          console.error('Error converting previous scene image:', error);
        }
      }
      
      // Add current scene image for style reference
      if (currentSceneImage) {
        try {
          const response = await fetch(currentSceneImage);
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
          contentParts.push({
            type: "inline_data",
            inlineData: { mimeType: "image/jpeg", data: base64 }
          });
        } catch (error) {
          console.error('Error converting current scene image:', error);
        }
      }

      const requestBody = {
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: contentParts }],
        modalities: ["image", "text"],
        temperature: 0.75
      };

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      const data = await response.json();
      const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (!imageData) {
        throw new Error("Kein Bild in der Antwort");
      }

      const generatedImageUrl = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
      
      // Update storypoint with new image
      setStoryPoints(prev => prev.map((p, idx) => {
        if (idx === sceneIndex) {
          return {
            ...p,
            generatedImage: generatedImageUrl,
            detailedImagePrompt: imagePromptText,
            generationError: undefined
          };
        }
        return p;
      }));
      
      // Trigger image flip-back animation (not card)
      setRegeneratingImageOnlyIndex(null);
      setJustFinishedImageOnlyIndex(sceneIndex);
      setTimeout(() => setJustFinishedImageOnlyIndex(null), 700);
      
      toast({ title: `Szene ${sceneIndex + 1} Bild regeneriert!` });
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      let errorMessage = "Unbekannter Fehler";
      if (error instanceof Error) {
        errorMessage = error.name === 'AbortError' ? "Zeitüberschreitung (2 Min.)" : error.message;
      }
      
      console.error(`Szene ${sceneIndex + 1} fehlgeschlagen:`, errorMessage);
      
      setStoryPoints(prev => prev.map((p, idx) => {
        if (idx === sceneIndex) {
          return { ...p, generationError: errorMessage };
        }
        return p;
      }));
      
      toast({ 
        title: `Szene ${sceneIndex + 1} fehlgeschlagen`, 
        description: errorMessage, 
        variant: "destructive" 
      });
    } finally {
      setRegeneratingImageOnlyIndex(null);
      setRegeneratingPointIndex(null);
    }
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
                text: `Generiere genau 3 REALISTISCHE, alltägliche Story-Ideen für Bilder. Jede Idee soll EIN SATZ sein, interessant und visuell umsetzbar.

WICHTIG: NUR realistische, lebensnahe Geschichten! KEINE Fantasy, Magie, übernatürlichen Elemente, Sci-Fi oder unrealistische Szenarien.

Gute Beispiele (realistisch, alltäglich):
- "Eine Frau trifft nach 10 Jahren ihren Jugendfreund zufällig im Supermarkt."
- "Ein Student muss sich zwischen seinem Traumjob und seiner Beziehung entscheiden."
- "Eine ältere Dame findet einen verlorenen Brief, der ihr Leben verändert."

SCHLECHTE Beispiele (NICHT verwenden):
- Magische Cafés, Zeitreisen, Superhelden, Zauberer, sprechende Tiere, Portale

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (referenceImages.length + files.length > 3) {
      toast({
        title: "Zu viele Bilder",
        description: "Du kannst maximal 3 Referenzbilder hochladen",
        variant: "destructive",
      });
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
        toast({
          title: "Fehler beim Verarbeiten",
          description: `${file.name} konnte nicht verarbeitet werden.`,
          variant: "destructive",
        });
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
    useSimplifiedPrompt: boolean = false
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
      
      // ===== Gemini 2.5 Flash Image Generation =====
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000); // 2 Minuten

      let response: Response;
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`,
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
          throw new Error("Gemini request timed out");
        }
        throw err;
      } finally {
        clearTimeout(timeoutId);
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

      // ===== IMAGE EXTRACTION =====
      const candidates = data.candidates ?? [];
      if (candidates.length === 0) {
        throw new Error("No candidates returned by Gemini");
      }

      // Check for IMAGE_OTHER error (model couldn't generate from reference)
      if (candidates[0]?.finishReason === "IMAGE_OTHER") {
        console.warn("⚠️ IMAGE_OTHER detected - Model couldn't generate with reference image");
        // NO AUTO RETRY - return null immediately
        return null;
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
      console.error("❌ Response structure did not match expected format");
      
      // NO AUTO RETRY - return null immediately
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
      
      // NO AUTO RETRY - return null immediately
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
          }, 1000);

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

            // Animate progress quickly from current value to 100%
            const animateTo100 = () => new Promise<void>(resolve => {
              let currentProgress = 90;
              const animationInterval = setInterval(() => {
                currentProgress += 5;
                if (currentProgress >= 100) {
                  currentProgress = 100;
                  clearInterval(animationInterval);
                  setImageSlots((prev) => {
                    const updated = [...prev];
                    if (index < updated.length) {
                      updated[index] = { ...updated[index], progress: 100 };
                    }
                    return updated;
                  });
                  setTimeout(resolve, 150); // Short pause at 100%
                } else {
                  setImageSlots((prev) => {
                    const updated = [...prev];
                    if (index < updated.length) {
                      updated[index] = { ...updated[index], progress: currentProgress };
                    }
                    return updated;
                  });
                }
              }, 50); // Fast animation: 50ms per step
            });

            await animateTo100();

            // Now update with the actual result
            setImageSlots((prev) => {
              const updated = [...prev];
              if (index >= updated.length) {
                console.warn(`Index ${index} out of bounds after generation, current length: ${updated.length}`);
                return prev;
              }
              if (imageUrl) {
                updated[index] = { status: "completed", imageUrl, progress: 100 };
              } else {
                updated[index] = { status: "error", progress: 0, errorMessage: "Kein Bild generiert - bitte erneut versuchen" };
              }
              return updated;
            });
          } catch (error) {
            console.error(`❌ Error in processQueue for index ${index}:`, error);
            // Use centralized error message helper for consistent, detailed messages
            const errorMessage = getDetailedErrorMessage(error);
            setImageSlots((prev) => {
              const updated = [...prev];
              if (index < updated.length) {
                updated[index] = { status: "error", progress: 0, errorMessage };
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
      }, 1000);

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
          
          // Animate progress quickly from current to 100%
          for (let p = 90; p <= 100; p += 5) {
            updateSlotSafe(newIndex, { progress: p });
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          // Short pause at 100%
          await new Promise(resolve => setTimeout(resolve, 150));
          
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

  // Custom Prompt AI Generation (handles prompt, background, or both based on aiAssistantTarget)
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
        description: aiAssistantTarget === "background" 
          ? "Bitte beschreibe den gewünschten Hintergrund"
          : "Bitte beschreibe, was du generieren möchtest",
        variant: "destructive",
      });
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
        toast({
          title: "Prompt & Hintergrund generiert!",
          description: `Version ${customPromptVersions.length + 1} mit Szenerie erstellt`,
        });
      } else if (aiAssistantTarget === "prompt") {
        // For "prompt" mode: only update the prompt, ignore scene suggestions
        setAiBackgroundSuggestion("");
        toast({
          title: "Prompt generiert!",
          description: `Version ${customPromptVersions.length + 1} erstellt`,
        });
      } else {
        // Legacy behavior for other cases
        if (selectedBackground === "scenery" && suggestedScene && suggestedScene !== sceneDescription) {
          setAiBackgroundSuggestion(suggestedScene);
        } else if (suggestedBackground === "scenery" && suggestedScene && selectedBackground !== "scenery") {
          setAiBackgroundSuggestion(suggestedScene);
        } else {
          setAiBackgroundSuggestion("");
        }
        toast({
          title: "Prompt generiert!",
          description: `Version ${customPromptVersions.length + 1} erstellt`,
        });
      }
      
      // Keep the input text for further iterations
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

  // Generate AI background suggestion for scenery when prompt exists (legacy)
  const handleGenerateBackgroundSuggestion = async () => {
    if (!apiKey || !customPrompt.trim() || isGeneratingBackgroundSuggestion) return;
    
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
        toast({
          title: "Hintergrund-Vorschlag generiert",
          description: "Klicke auf 'Übernehmen' um den Vorschlag zu verwenden."
        });
      }
    } catch (error) {
      console.error("Background suggestion error:", error);
      toast({
        title: "Fehler",
        description: "Hintergrund-Vorschlag konnte nicht generiert werden.",
        variant: "destructive"
      });
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
        
        toast({
          title: "Hintergrund generiert!",
          description: suggestion.substring(0, 50) + "..."
        });
      }
    } catch (error) {
      console.error("Background generation error:", error);
      toast({
        title: "Fehler",
        description: "Hintergrund konnte nicht generiert werden.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingBackgroundSuggestion(false);
    }
  };

  // Apply AI background suggestion
  const handleApplyBackgroundSuggestion = () => {
    if (aiBackgroundSuggestion) {
      setSceneDescription(aiBackgroundSuggestion);
      setAiBackgroundSuggestion("");
      toast({
        title: "Hintergrund übernommen",
        description: aiBackgroundSuggestion
      });
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

    // Show progress for large downloads
    const isLargeDownload = completedImages.length > 10;
    if (isLargeDownload) {
      toast({
        title: "Download wird vorbereitet...",
        description: `${completedImages.length} Bilder werden verarbeitet`,
      });
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
            
            if (isBasic) {
              // Basic users get lower resolution
              try {
                const resizedUrl = await resizeImageForBasic(slot.imageUrl, 512);
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
      
      toast({
        title: "Erfolg!",
        description: `${completedImages.length} Bilder wurden heruntergeladen`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download fehlgeschlagen",
        description: error instanceof Error && error.message.includes("memory") 
          ? "Zu wenig Speicher - versuche weniger Bilder"
          : "ZIP-Datei konnte nicht erstellt werden",
        variant: "destructive",
      });
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
        <div className="absolute top-4 left-4 text-[10px] text-muted-foreground/50 font-mono select-none">
          v1.4.4
        </div>
        <PromoBanner planCode={authData.planCode} />
        {/* Settings & Tutorial Buttons */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
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

            {/* Format, Shot Type, Skin Type, and Camera Angle Selection */}
            <div className={`grid gap-4 ${isPro ? "grid-cols-4" : "grid-cols-3"}`}>
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

              {/* Camera Angle Dropdown - FULL Only */}
              {authData.planCode === 'FULL' && (
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
              )}

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
                  <div className="flex gap-3 items-start w-fit">
                    <Textarea
                      placeholder="Beschreibe die Szene... (z.B. 'Strand bei Sonnenuntergang', 'Urbaner Park im Herbst')"
                      value={sceneDescription}
                      onChange={(e) => setSceneDescription(e.target.value)}
                      className="min-h-[80px] w-[calc(3*120px+2*4px)] resize-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
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
                          className="min-h-[124px] h-[124px] focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
                        />
                      </div>
                      
                      {/* Center: Generate Buttons - For PREMIUM and FULL plans */}
                      {(authData.planCode === "FULL" || authData.planCode === "PREMIUM") && (
                        <div className="flex flex-col gap-2 pt-9">
                          {/* Main button - transfers prompt to left */}
                          <Button
                            onClick={handleGenerateCustomPromptWithAI}
                            disabled={!apiKey || !customPromptChatInput.trim() || isGeneratingCustomPrompt || isGeneratingBackgroundSuggestion}
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
                              className="h-full min-h-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 resize-none bg-transparent border-0 p-0"
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
              {/* Story Idea and AI Assistant side by side */}
              <div className="flex gap-4">
                {/* Left: Story Idea Field */}
                <div className="flex-1 space-y-2">
                  <Label htmlFor="story-idea">Deine Story-Idee</Label>
                  <div className="relative">
                    <Textarea
                      id="story-idea"
                      placeholder=""
                      value={storyIdea}
                      onChange={(e) => setStoryIdea(e.target.value)}
                      className="min-h-[160px] resize-none"
                    />
                    
                    {/* Suggestions overlay - only when empty and not animating */}
                    {(!storyIdea || isAnimatingSuggestion) && (
                      <div className="absolute inset-0 p-3 pointer-events-none overflow-hidden">
                        <p className={`text-sm text-muted-foreground mb-4 transition-opacity duration-300 ${isAnimatingSuggestion ? 'opacity-0' : 'opacity-100'}`}>
                          Wähle eine Idee oder schreibe deine eigene...
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
                              
                              // Calculate how far up this item needs to move to reach position 0
                              // Each item is ~24px tall (text-sm + py-0.5), plus the header (~40px)
                              const moveUpDistance = isSelected ? (index * 24 + 40) : 0;
                              
                              return (
                                <p
                                  key={index}
                                  onClick={() => !isAnimatingSuggestion && handleSuggestionClick(suggestion, index)}
                                  className={`text-sm cursor-pointer py-0.5 transition-all ease-out line-clamp-1 ${
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

                {/* Generate Button (like poses generator) - aligned with textareas */}
                <div className="flex items-end pb-[2px]">
                  <Button
                    onClick={handleGenerateStoryIdea}
                    disabled={isGeneratingStoryAiIdea || !storyAiAssistantInput.trim()}
                    className="w-10 h-[160px] rounded-lg"
                    title="Story-Idee generieren"
                  >
                    {isGeneratingStoryAiIdea ? (
                      <Sparkles className="w-5 h-5 animate-spin" />
                    ) : (
                      <ChevronLeft className="w-6 h-6" />
                    )}
                  </Button>
                </div>

                {/* Right: AI Assistant for Story Ideas */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-4 h-4 text-muted-foreground" />
                    <Label className="text-muted-foreground">KI-Assistent</Label>
                  </div>
                  <div className="flex-1 p-3 rounded-lg border border-border/50 bg-muted/30">
                    <Textarea
                      placeholder="Beschreibe was für eine Story du möchtest, z.B. 'Eine romantische Geschichte in Paris'..."
                      value={storyAiAssistantInput}
                      onChange={(e) => setStoryAiAssistantInput(e.target.value)}
                      className="h-full min-h-[140px] text-sm focus-visible:ring-0 focus-visible:ring-offset-0 resize-none bg-transparent border-0 p-0"
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
                    <div className="flex gap-2">
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            disabled={isGeneratingStoryboard || isGeneratingStoryImages}
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
                        disabled={isExportingVeo3 || isGeneratingStoryImages}
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
                                      {/* Front - the actual image */}
                                      <div 
                                        className="absolute inset-0 flex items-center justify-center"
                                        style={{ backfaceVisibility: 'hidden' }}
                                      >
                                        <img 
                                          src={point.generatedImage} 
                                          alt={`Szene ${index + 1}`}
                                          className="max-w-full max-h-full object-contain"
                                        />
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
                                    {/* Shot type label */}
                                    {point.shotType && generatingStoryImageIndex !== index && !regeneratingImageOnlyIndex && (
                                      <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded pointer-events-none z-10">
                                        {point.shotType.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                      </div>
                                    )}
                                    {/* Quick Action Overlay on hover - hidden during regeneration */}
                                    {regeneratingImageOnlyIndex !== index && (
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center gap-3 z-20">
                                        <Button 
                                          size="icon" 
                                          variant="secondary" 
                                          className="h-9 w-9 rounded-full shadow-lg"
                                          onClick={(e) => { e.stopPropagation(); setExpandedStoryPointIndex(index); setSceneEditTab("image"); }}
                                        >
                                          <Maximize2 className="w-4 h-4" />
                                        </Button>
                                        <Button 
                                          size="icon" 
                                          variant="secondary" 
                                          className="h-9 w-9 rounded-full shadow-lg"
                                          onClick={(e) => { e.stopPropagation(); regenerateImageOnly(index); }}
                                          disabled={regeneratingPointIndex !== null}
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

                  {/* Expanded Card Popup Modal - Tab-based UI */}
                  {expandedStoryPointIndex !== null && storyPoints[expandedStoryPointIndex] && createPortal(
                      <>
                        {/* Backdrop with blur */}
                        <div 
                          className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] ${isClosingPopup ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
                          onClick={handleCloseExpandedCard}
                        />
                        
                        {/* Top-anchored popup card - grows downward only */}
                        <div className="fixed inset-x-0 top-0 bottom-0 z-[110] flex items-start justify-center pt-8 pb-6 px-6 pointer-events-none overflow-y-auto">
                          <div 
                            className={`bg-background rounded-xl border border-border/40 shadow-2xl w-full max-w-4xl flex flex-col pointer-events-auto mx-auto ${isClosingPopup ? 'animate-popup-out' : 'animate-popup-in'}`}
                          >
                            {/* Header */}
                            <div className="bg-muted/40 border-b border-border/30 flex items-center justify-between px-5 py-3 flex-shrink-0">
                              <span className="font-semibold text-foreground/80 text-base">Szene {expandedStoryPointIndex + 1} von {storyPoints.length}</span>
                              
                              <div className="flex items-center gap-2">
                                <div className="flex items-center bg-background/50 rounded-full px-2 py-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full hover:bg-muted h-6 w-6"
                                    onClick={() => navigateStoryPointVersion(expandedStoryPointIndex, 'prev')}
                                    disabled={storyPoints[expandedStoryPointIndex].currentVersion === 0}
                                  >
                                    <ChevronLeft className="w-4 h-4" />
                                  </Button>
                                  <span className="font-semibold min-w-[40px] text-center text-sm">
                                    {storyPoints[expandedStoryPointIndex].currentVersion + 1}/{storyPoints[expandedStoryPointIndex].versions.length}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full hover:bg-muted h-6 w-6"
                                    onClick={() => navigateStoryPointVersion(expandedStoryPointIndex, 'next')}
                                    disabled={storyPoints[expandedStoryPointIndex].currentVersion === storyPoints[expandedStoryPointIndex].versions.length - 1}
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </Button>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-full hover:bg-primary/10 hover:text-primary h-7 w-7"
                                  onClick={() => regenerateStoryPoint(expandedStoryPointIndex)}
                                  disabled={regeneratingPointIndex !== null}
                                >
                                  {regeneratingPointIndex === expandedStoryPointIndex ? (
                                    <Loader2 className="animate-spin w-4 h-4" />
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
                            
                            {/* Tab Navigation */}
                            <div className="border-b border-border/30 px-4 flex-shrink-0">
                              <Tabs value={sceneEditTab} onValueChange={(v) => setSceneEditTab(v as "content" | "image" | "video")}>
                                <TabsList className="bg-transparent h-10">
                                  <TabsTrigger value="content" className="gap-1.5 data-[state=active]:bg-muted">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    Inhalt
                                  </TabsTrigger>
                                  <TabsTrigger value="image" className="gap-1.5 data-[state=active]:bg-muted">
                                    <ImageIcon className="w-3.5 h-3.5" />
                                    Bild
                                  </TabsTrigger>
                                  <TabsTrigger value="video" className="gap-1.5 data-[state=active]:bg-muted">
                                    <Video className="w-3.5 h-3.5" />
                                    Video
                                  </TabsTrigger>
                                </TabsList>
                              </Tabs>
                            </div>
                            
                            {/* Tab Content - grows downward, no scrolling */}
                            <div className="p-4 space-y-4">
                              {/* CONTENT TAB */}
                              {sceneEditTab === "content" && (
                                <>
                                  {/* Summary (short version for quick reference) */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                      <BookOpen className="w-3.5 h-3.5" />
                                      Zusammenfassung
                                    </label>
                                    <div className="bg-muted/30 rounded-lg p-3">
                                      <Textarea
                                        value={storyPoints[expandedStoryPointIndex].summary || ""}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          const idx = expandedStoryPointIndex;
                                          setStoryPoints(prev => prev.map((p, i) => 
                                            i === idx ? { ...p, summary: newText } : p
                                          ));
                                        }}
                                        className="leading-relaxed bg-transparent border-none resize-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base min-h-[60px]"
                                        placeholder="Kurze Zusammenfassung..."
                                      />
                                    </div>
                                  </div>

                                  {/* Detailed Description (full scene description) */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                      <BookOpen className="w-3.5 h-3.5" />
                                      Detaillierte Szenen-Beschreibung
                                    </label>
                                    <div className="bg-muted/30 rounded-lg p-3">
                                      <Textarea
                                        value={storyPoints[expandedStoryPointIndex].detailedDescription || storyPoints[expandedStoryPointIndex].versions[storyPoints[expandedStoryPointIndex].currentVersion]}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          const idx = expandedStoryPointIndex;
                                          setStoryPoints(prev => prev.map((p, i) => {
                                            if (i === idx) {
                                              const updatedVersions = [...p.versions];
                                              updatedVersions[p.currentVersion] = newText;
                                              return { ...p, detailedDescription: newText, versions: updatedVersions };
                                            }
                                            return p;
                                          }));
                                        }}
                                        className="leading-relaxed bg-transparent border-none resize-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base min-h-[100px]"
                                        placeholder="Ausführliche Szenen-Beschreibung..."
                                      />
                                    </div>
                                  </div>

                                  {/* Camera & Shot Settings - side by side */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-muted-foreground">Kamerawinkel</label>
                                      <Select
                                        value={storyPoints[expandedStoryPointIndex].cameraAngle || ""}
                                        onValueChange={(value) => {
                                          const idx = expandedStoryPointIndex;
                                          setStoryPoints(prev => prev.map((p, i) => 
                                            i === idx ? { ...p, cameraAngle: value } : p
                                          ));
                                        }}
                                      >
                                        <SelectTrigger className="w-full bg-background/50">
                                          <SelectValue placeholder="Von KI wählen lassen..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="frontal">Frontal</SelectItem>
                                          <SelectItem value="seitlich">Seitlich</SelectItem>
                                          <SelectItem value="von-oben">Von oben</SelectItem>
                                          <SelectItem value="von-unten">Von unten</SelectItem>
                                          <SelectItem value="ueber-schulter">Über die Schulter</SelectItem>
                                          <SelectItem value="dutch-angle">Dutch Angle</SelectItem>
                                          <SelectItem value="vogelperspektive">Vogelperspektive</SelectItem>
                                          <SelectItem value="froschperspektive">Froschperspektive</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-muted-foreground">Shot-Typ</label>
                                      <Select
                                        value={storyPoints[expandedStoryPointIndex].shotType || ""}
                                        onValueChange={(value) => {
                                          const idx = expandedStoryPointIndex;
                                          setStoryPoints(prev => prev.map((p, i) => 
                                            i === idx ? { ...p, shotType: value } : p
                                          ));
                                        }}
                                      >
                                        <SelectTrigger className="w-full bg-background/50">
                                          <SelectValue placeholder="Von KI wählen lassen..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="extreme-close-up">Extreme Close-Up</SelectItem>
                                          <SelectItem value="close-up">Close-Up</SelectItem>
                                          <SelectItem value="medium-close-up">Medium Close-Up</SelectItem>
                                          <SelectItem value="medium-shot">Medium Shot</SelectItem>
                                          <SelectItem value="medium-long-shot">Medium Long Shot</SelectItem>
                                          <SelectItem value="full-shot">Full Shot</SelectItem>
                                          <SelectItem value="long-shot">Long Shot</SelectItem>
                                          <SelectItem value="extreme-long-shot">Extreme Long Shot</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  {/* Key Action, Emotion, Specific Area - compact */}
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        🎯 Schlüsselaktion
                                      </label>
                                      <Input
                                        value={storyPoints[expandedStoryPointIndex].keyAction || ""}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          const idx = expandedStoryPointIndex;
                                          setStoryPoints(prev => prev.map((p, i) => 
                                            i === idx ? { ...p, keyAction: newText } : p
                                          ));
                                        }}
                                        className="bg-background/50 text-sm"
                                        placeholder="z.B. lehnt am Fenster"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        😊 Emotion
                                      </label>
                                      <Input
                                        value={storyPoints[expandedStoryPointIndex].emotion || ""}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          const idx = expandedStoryPointIndex;
                                          setStoryPoints(prev => prev.map((p, i) => 
                                            i === idx ? { ...p, emotion: newText } : p
                                          ));
                                        }}
                                        className="bg-background/50 text-sm"
                                        placeholder="z.B. melancholisch"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        📍 Bereich
                                      </label>
                                      <Input
                                        value={storyPoints[expandedStoryPointIndex].specificArea || ""}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          const idx = expandedStoryPointIndex;
                                          setStoryPoints(prev => prev.map((p, i) => 
                                            i === idx ? { ...p, specificArea: newText } : p
                                          ));
                                        }}
                                        className="bg-background/50 text-sm"
                                        placeholder="z.B. Wohnzimmer"
                                      />
                                    </div>
                                  </div>
                                </>
                              )}

                              {/* IMAGE TAB */}
                              {sceneEditTab === "image" && (
                                <>
                                  {/* Generated Image */}
                                  {storyPoints[expandedStoryPointIndex].generatedImage ? (
                                    <div className="space-y-3">
                                      <div className="relative rounded-lg overflow-hidden bg-muted/20">
                                        <div className="aspect-video flex items-center justify-center relative">
                                          <img 
                                            src={storyPoints[expandedStoryPointIndex].generatedImage} 
                                            alt={`Szene ${expandedStoryPointIndex + 1}`}
                                            className="max-w-full max-h-full object-contain"
                                          />
                                          {storyPoints[expandedStoryPointIndex].shotType && (
                                            <div className="absolute bottom-3 right-3 bg-black/85 text-white text-sm font-bold px-3 py-1.5 rounded-md pointer-events-none">
                                              {storyPoints[expandedStoryPointIndex].shotType.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                            </div>
                                          )}
                                          {regeneratingPointIndex === expandedStoryPointIndex && (
                                            <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                              <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <Button
                                        className="w-full gap-2"
                                        variant="outline"
                                        onClick={() => regenerateSingleStoryScene(expandedStoryPointIndex)}
                                        disabled={regeneratingPointIndex !== null}
                                      >
                                        {regeneratingPointIndex === expandedStoryPointIndex ? (
                                          <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Generiere neu...
                                          </>
                                        ) : (
                                          <>
                                            <RefreshCw className="w-4 h-4" />
                                            Bild neu generieren
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                      <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
                                      <p className="text-sm">Noch kein Bild generiert</p>
                                      <Button
                                        className="mt-4 gap-2"
                                        onClick={() => regenerateSingleStoryScene(expandedStoryPointIndex)}
                                        disabled={regeneratingPointIndex !== null}
                                      >
                                        <ImageIcon className="w-4 h-4" />
                                        Bild generieren
                                      </Button>
                                    </div>
                                  )}

                                  {/* Detailed Image Prompt (if exists) */}
                                  {storyPoints[expandedStoryPointIndex].detailedImagePrompt && (
                                    <div className="space-y-2">
                                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5" />
                                        Bild-Prompt (bearbeitbar)
                                      </label>
                                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                                        <Textarea
                                          value={storyPoints[expandedStoryPointIndex].detailedImagePrompt || ""}
                                          onChange={(e) => {
                                            const newText = e.target.value;
                                            const idx = expandedStoryPointIndex;
                                            setStoryPoints(prev => prev.map((p, i) => 
                                              i === idx ? { ...p, detailedImagePrompt: newText } : p
                                            ));
                                          }}
                                          className="leading-relaxed bg-transparent border-none resize-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[150px]"
                                          placeholder="Detaillierter Bild-Prompt..."
                                        />
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}

                              {/* VIDEO TAB */}
                              {sceneEditTab === "video" && (
                                <>
                                  {/* Main Video Prompt */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                      <Video className="w-3.5 h-3.5" />
                                      Video-Prompt
                                    </label>
                                    <div className="bg-muted/30 rounded-lg p-3">
                                      <Textarea
                                        value={storyPoints[expandedStoryPointIndex].videoPrompt || ""}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          const idx = expandedStoryPointIndex;
                                          setStoryPoints(prev => prev.map((p, i) => 
                                            i === idx ? { ...p, videoPrompt: newText } : p
                                          ));
                                        }}
                                        className="leading-relaxed bg-transparent border-none resize-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[100px]"
                                        placeholder="Video-Animations-Prompt..."
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Veo3 Camera Movement */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Kamerabewegung (Veo3)</label>
                                    <Select
                                      value={storyPoints[expandedStoryPointIndex].veo3CameraMovement || ""}
                                      onValueChange={(value) => {
                                        const idx = expandedStoryPointIndex;
                                        setStoryPoints(prev => prev.map((p, i) => 
                                          i === idx ? { ...p, veo3CameraMovement: value } : p
                                        ));
                                      }}
                                    >
                                      <SelectTrigger className="w-full bg-background/50">
                                        <SelectValue placeholder="Kamerabewegung wählen..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {VEO3_CAMERA_MOVEMENTS.map(movement => (
                                          <SelectItem key={movement.id} value={movement.id}>
                                            {movement.label} - {movement.description}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  
                                  {/* Structured Veo3 Details - 3 columns */}
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium text-muted-foreground">Start-Frame</label>
                                      <Textarea
                                        value={storyPoints[expandedStoryPointIndex].veo3StartState || ""}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          const idx = expandedStoryPointIndex;
                                          setStoryPoints(prev => prev.map((p, i) => 
                                            i === idx ? { ...p, veo3StartState: newText } : p
                                          ));
                                        }}
                                        className="text-xs bg-background/50 min-h-[80px] resize-none"
                                        placeholder="Startframe..."
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium text-muted-foreground">Bewegung</label>
                                      <Textarea
                                        value={storyPoints[expandedStoryPointIndex].veo3Motion || ""}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          const idx = expandedStoryPointIndex;
                                          setStoryPoints(prev => prev.map((p, i) => 
                                            i === idx ? { ...p, veo3Motion: newText } : p
                                          ));
                                        }}
                                        className="text-xs bg-background/50 min-h-[80px] resize-none"
                                        placeholder="Bewegung..."
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium text-muted-foreground">End-Frame</label>
                                      <Textarea
                                        value={storyPoints[expandedStoryPointIndex].veo3EndState || ""}
                                        onChange={(e) => {
                                          const newText = e.target.value;
                                          const idx = expandedStoryPointIndex;
                                          setStoryPoints(prev => prev.map((p, i) => 
                                            i === idx ? { ...p, veo3EndState: newText } : p
                                          ));
                                        }}
                                        className="text-xs bg-background/50 min-h-[80px] resize-none"
                                        placeholder="Endframe..."
                                      />
                                    </div>
                                  </div>
                                  
                                  {/* Copy Video Prompt Button */}
                                  <Button
                                    variant="outline"
                                    className="w-full gap-2"
                                    onClick={() => {
                                      const point = storyPoints[expandedStoryPointIndex];
                                      const cameraInfo = VEO3_CAMERA_MOVEMENTS.find(m => m.id === point.veo3CameraMovement);
                                      const copyText = `${point.videoPrompt || ''}

--- STRUKTURIERTE DETAILS ---
Kamerabewegung: ${cameraInfo?.label || 'Nicht definiert'}
Start: ${point.veo3StartState || 'Nicht definiert'}
Bewegung: ${point.veo3Motion || 'Nicht definiert'}
Ende: ${point.veo3EndState || 'Nicht definiert'}`;
                                      navigator.clipboard.writeText(copyText);
                                      toast({ title: "Kopiert!", description: "Video-Prompt in Zwischenablage kopiert." });
                                    }}
                                  >
                                    <Download className="w-4 h-4" />
                                    Video-Prompt kopieren
                                  </Button>
                                </>
                              )}
                            </div>
                            
                            {/* Persistent AI Assistant at bottom - styled like pose generator */}
                            <div className="border-t border-border/30 p-4 bg-muted/10 flex-shrink-0">
                              {/* Header with label left and options centered */}
                              <div className="flex items-center mb-2 h-7">
                                <div className="flex items-center gap-1.5 w-24">
                                  <Sparkles className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">KI-Assistent</span>
                                </div>
                                <div className="flex-1 flex justify-center">
                                  <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
                                    <Button
                                      variant={sceneAiMode === "text" ? "default" : "ghost"}
                                      size="sm"
                                      className={`h-6 px-2 text-xs ${sceneAiMode === "text" ? "" : "text-muted-foreground hover:text-foreground"}`}
                                      onClick={() => setSceneAiMode("text")}
                                      title="Optimiert den Szenentext, Kamerawinkel und Shot-Typ basierend auf deiner Anweisung"
                                    >
                                      Text optimieren
                                    </Button>
                                    <Button
                                      variant={sceneAiMode === "image" ? "default" : "ghost"}
                                      size="sm"
                                      className={`h-6 px-2 text-xs ${sceneAiMode === "image" ? "" : "text-muted-foreground hover:text-foreground"}`}
                                      onClick={() => setSceneAiMode("image")}
                                      title="Generiert das Bild zur Szene neu"
                                    >
                                      Bild regenerieren
                                    </Button>
                                    <Button
                                      variant={sceneAiMode === "both" ? "default" : "ghost"}
                                      size="sm"
                                      className={`h-6 px-2 text-xs ${sceneAiMode === "both" ? "" : "text-muted-foreground hover:text-foreground"}`}
                                      onClick={() => setSceneAiMode("both")}
                                      title="Optimiert erst den Text, dann regeneriert das Bild"
                                    >
                                      Text + Bild
                                    </Button>
                                  </div>
                                </div>
                                {/* Spacer to balance + loading indicator */}
                                <div className="w-24 flex justify-end">
                                  {isGeneratingSceneAssistant && (
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  )}
                                </div>
                              </div>
                              
                              {/* Textarea box + button side by side */}
                              <div className="flex gap-3 items-stretch">
                                <div className="flex-1 p-3 rounded-lg border border-border/50 bg-muted/30 h-[100px]">
                                  <Textarea
                                    value={sceneAssistantInput}
                                    onChange={(e) => setSceneAssistantInput(e.target.value)}
                                    placeholder="z.B. 'Mache es dramatischer' oder 'Ändere zu Nahaufnahme'..."
                                    className="h-full min-h-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 resize-none bg-transparent border-0 p-0"
                                    disabled={isGeneratingSceneAssistant}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleUnifiedSceneAssistant();
                                      }
                                    }}
                                  />
                                </div>
                                <Button 
                                  className="h-[100px] w-12 rounded-lg"
                                  onClick={handleUnifiedSceneAssistant}
                                  disabled={isGeneratingSceneAssistant || regeneratingPointIndex !== null || !sceneAssistantInput.trim()}
                                >
                                  {isGeneratingSceneAssistant ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                  ) : (
                                    <Sparkles className="w-5 h-5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>,
                    document.body
                    )}
                </div>
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
