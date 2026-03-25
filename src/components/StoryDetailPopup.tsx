import React, { useState, useEffect, useId, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { BookOpen, X, Video, Image as ImageIcon, Sparkles, RefreshCw, Check, Undo2, Loader2, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon, Download, MessageSquare, AlertTriangle, Users, Heart, Camera, Wand2, Eye, ZoomIn, Maximize2, Minimize2, Copy, Play, Save } from "lucide-react";
import { FullscreenLightbox } from "@/components/FullscreenLightbox";

// Types
interface StoryPoint {
  versions: string[];
  currentVersion: number;
  summary?: string;
  detailedDescription?: string;
  cameraAngle?: string;
  shotType?: string;
  specificArea?: string;
  keyAction?: string;
  emotion?: string;
  generatedImage?: string;
  detailedImagePrompt?: string;
  videoPrompt?: string;
  generatedVideo?: string;
  generationError?: string;
  sceneTitle?: string;
  sceneDescription?: string;
  veo3CameraMovement?: string;
  veo3StartState?: string;
  veo3Motion?: string;
  veo3EndState?: string;
  participants?: string;
  audienceEffect?: string;
  composition?: string;
  movement?: string;
  negativePrompts?: string;
  styleNotes?: string;
  continuityNotes?: string;
  dialogText?: string;
  // Final/Draft State
  finalSnapshot?: StoryPoint;
  finalizedAt?: number;
  // Generation Snapshot - tracks settings when image was last generated
  generationSnapshot?: Partial<StoryPoint>;
}
interface Veo3CameraMovement {
  id: string;
  label: string;
  description: string;
}
interface StoryDetailPopupProps {
  expandedIndex: number;
  storyPoints: StoryPoint[];
  isClosing: boolean;
  onClose: () => void;
  onUpdateStoryPoint: (index: number, updates: Partial<StoryPoint>) => void;
  onNavigateScene: (direction: 'prev' | 'next') => void;
  onRegenerateImage: (index: number, updatedPoint?: StoryPoint) => void;
  onRegenerateVideo?: (index: number) => void;
  isGeneratingVideo?: boolean;
  generatingVideoIndex?: number | null;
  videoErrors?: Map<number, string>;
  onFinalizeScene: (index: number) => void;
  onDiscardChanges: (index: number) => void;
  regeneratingIndex: number | null;
  veo3CameraMovements: Veo3CameraMovement[];
  sceneAssistantInput: string;
  setSceneAssistantInput: (value: string) => void;
  isGeneratingAssistant: boolean;
  onAssistantSubmit: (mode: "text" | "image" | "video") => void;
  onCopyVideoPrompt: () => void;
  onUpdateVideoPrompt: (index: number, videoPrompt: string) => void;
  totalScenes: number;
  finalizedCount: number;
  aspectRatio?: string;
}

// Auto option for all dropdowns
const AUTO_OPTION = { value: "_auto_", label: "Von KI wählen lassen..." };

// Emotion options for dropdown
const EMOTION_OPTIONS = [
  AUTO_OPTION,
  { value: "gluecklich", label: "Glücklich" },
  { value: "traurig", label: "Traurig" },
  { value: "nachdenklich", label: "Nachdenklich" },
  { value: "aufgeregt", label: "Aufgeregt" },
  { value: "aengstlich", label: "Ängstlich" },
  { value: "wuetend", label: "Wütend" },
  { value: "ueberrascht", label: "Überrascht" },
  { value: "verliebt", label: "Verliebt" },
  { value: "verzweifelt", label: "Verzweifelt" },
  { value: "hoffnungsvoll", label: "Hoffnungsvoll" },
  { value: "melancholisch", label: "Melancholisch" },
  { value: "entspannt", label: "Entspannt" },
  { value: "neutral", label: "Neutral" },
];

// Audience effect options
const AUDIENCE_EFFECT_OPTIONS = [
  AUTO_OPTION,
  { value: "spannung", label: "Spannung" },
  { value: "empathie", label: "Empathie" },
  { value: "freude", label: "Freude" },
  { value: "unbehagen", label: "Unbehagen" },
  { value: "neugier", label: "Neugier" },
  { value: "erleichterung", label: "Erleichterung" },
  { value: "trauer", label: "Trauer" },
  { value: "hoffnung", label: "Hoffnung" },
];

// Camera angle options
const CAMERA_ANGLE_OPTIONS = [
  AUTO_OPTION,
  { value: "frontal", label: "Frontal" },
  { value: "seitlich", label: "Seitlich" },
  { value: "von-oben", label: "Von oben" },
  { value: "von-unten", label: "Von unten" },
  { value: "ueber-schulter", label: "Über die Schulter" },
  { value: "dutch-angle", label: "Dutch Angle" },
  { value: "vogelperspektive", label: "Vogelperspektive" },
  { value: "froschperspektive", label: "Froschperspektive" },
];

// Shot type options
const SHOT_TYPE_OPTIONS = [
  AUTO_OPTION,
  { value: "extreme-close-up", label: "Extreme Close-Up" },
  { value: "close-up", label: "Close-Up" },
  { value: "medium-close-up", label: "Medium Close-Up" },
  { value: "medium-shot", label: "Medium Shot" },
  { value: "medium-long-shot", label: "Medium Long Shot" },
  { value: "full-shot", label: "Full Shot" },
  { value: "long-shot", label: "Long Shot" },
  { value: "extreme-long-shot", label: "Extreme Long Shot" },
];

// Composition options
const COMPOSITION_OPTIONS = [
  AUTO_OPTION,
  { value: "zentriert", label: "Zentriert" },
  { value: "drittel-regel", label: "Regel der Drittel" },
  { value: "symmetrisch", label: "Symmetrisch" },
  { value: "diagonal", label: "Diagonal" },
  { value: "rahmen-im-rahmen", label: "Rahmen im Rahmen" },
];

// Movement options
const MOVEMENT_OPTIONS = [
  AUTO_OPTION,
  { value: "keine", label: "Keine" },
  { value: "dolly-in", label: "Dolly-In" },
  { value: "dolly-out", label: "Dolly-Out" },
  { value: "truck", label: "Truck" },
  { value: "tilt", label: "Tilt" },
  { value: "pan", label: "Pan" },
  { value: "crane", label: "Crane" },
  { value: "arc", label: "Arc" },
];

// Key action options
const KEY_ACTION_OPTIONS = [
  AUTO_OPTION,
  { value: "steht", label: "Steht" },
  { value: "geht", label: "Geht" },
  { value: "sitzt", label: "Sitzt" },
  { value: "lehnt", label: "Lehnt" },
  { value: "schaut", label: "Schaut" },
  { value: "spricht", label: "Spricht" },
  { value: "rennt", label: "Rennt" },
  { value: "wartet", label: "Wartet" },
  { value: "greift", label: "Greift" },
  { value: "haelt", label: "Hält" },
  { value: "zeigt", label: "Zeigt" },
  { value: "wendet-sich", label: "Wendet sich" },
];

// Area options
const AREA_OPTIONS = [
  AUTO_OPTION,
  { value: "innenraum", label: "Innenraum" },
  { value: "aussenbereich", label: "Außenbereich" },
  { value: "strasse", label: "Straße" },
  { value: "natur", label: "Natur" },
  { value: "arbeitsplatz", label: "Arbeitsplatz" },
  { value: "zuhause", label: "Zuhause" },
  { value: "fahrzeug", label: "Fahrzeug" },
  { value: "oeffentlicher-ort", label: "Öffentlicher Ort" },
];

// Helper to check if scene is dirty (has changes since last finalization OR since image generation)
const isSceneDirty = (point: StoryPoint): boolean => {
  // If never finalized AND no generated image, it's not dirty yet (user hasn't made changes)
  if (!point.finalSnapshot && !point.generatedImage) return false;
  const fieldsToCompare = ['summary', 'detailedDescription', 'keyAction', 'specificArea', 'emotion', 'audienceEffect', 'cameraAngle', 'shotType', 'composition', 'movement', 'negativePrompts', 'styleNotes', 'continuityNotes'];

  // If we have a finalized snapshot, compare against it (highest priority)
  if (point.finalSnapshot) {
    for (const field of fieldsToCompare) {
      if (point[field as keyof StoryPoint] !== point.finalSnapshot[field as keyof StoryPoint]) {
        return true;
      }
    }
    return false;
  }

  // If we have a generation snapshot (image was generated), compare against it
  if (point.generationSnapshot) {
    for (const field of fieldsToCompare) {
      if (point[field as keyof StoryPoint] !== point.generationSnapshot[field as keyof StoryPoint]) {
        return true;
      }
    }
    return false;
  }

  // No snapshot to compare against - not dirty
  return false;
};

// Get status info for a scene
const getSceneStatus = (point: StoryPoint): {
  label: string;
  variant: 'draft' | 'final' | 'dirty';
} => {
  if (!point.finalSnapshot) {
    return {
      label: "Entwurf",
      variant: "draft"
    };
  }
  if (isSceneDirty(point)) {
    return {
      label: "Nicht übernommen",
      variant: "dirty"
    };
  }
  return {
    label: "Final ✓",
    variant: "final"
  };
};
export const StoryDetailPopup: React.FC<StoryDetailPopupProps> = ({
  expandedIndex,
  storyPoints,
  isClosing,
  onClose,
  onUpdateStoryPoint,
  onNavigateScene,
  onRegenerateImage,
  onRegenerateVideo,
  isGeneratingVideo = false,
  generatingVideoIndex = null,
  videoErrors,
  onFinalizeScene,
  onDiscardChanges,
  regeneratingIndex,
  veo3CameraMovements,
  sceneAssistantInput,
  setSceneAssistantInput,
  isGeneratingAssistant,
  onAssistantSubmit,
  onCopyVideoPrompt,
  onUpdateVideoPrompt,
  totalScenes,
  finalizedCount,
  aspectRatio = "16:9"
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    handlung: true,
    emotion: true,
    kamera: false,
    feintuning: false
  });
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [aiMode, setAiMode] = useState<"text" | "image" | "video">("text");
  
  // Fullscreen image lightbox state
  const [showFullscreenImage, setShowFullscreenImage] = useState(false);
  
  // Preview tab state: "video" default when video exists, otherwise "image"
  const [previewTab, setPreviewTab] = useState<"image" | "video">("image");
  
  // Zoom state for image preview
  const [imageZoom, setImageZoom] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const point = storyPoints[expandedIndex];
  const uniqueId = useId();
  
  // Track initial values to detect text-only changes (dialogText, videoPrompt)
  const savedSnapshotRef = useRef<{ dialogText: string; videoPrompt: string } | null>(null);
  
  // Initialize snapshot when scene changes or on first render
  useEffect(() => {
    const currentPoint = storyPoints[expandedIndex];
    if (currentPoint) {
      savedSnapshotRef.current = {
        dialogText: currentPoint.dialogText || "",
        videoPrompt: currentPoint.videoPrompt || "",
      };
    }
  }, [expandedIndex]);
  
  // Compute whether text-only fields have changed
  const hasTextChanges = useMemo(() => {
    if (!point || !savedSnapshotRef.current) return false;
    return (
      (point.dialogText || "") !== savedSnapshotRef.current.dialogText ||
      (point.videoPrompt || "") !== savedSnapshotRef.current.videoPrompt
    );
  }, [point?.dialogText, point?.videoPrompt]);
  
  // Check if only dialogText changed (not videoPrompt or image-relevant fields)
  const onlyDialogTextChanged = useMemo(() => {
    if (!point || !savedSnapshotRef.current) return false;
    const dialogChanged = (point.dialogText || "") !== savedSnapshotRef.current.dialogText;
    const promptChanged = (point.videoPrompt || "") !== savedSnapshotRef.current.videoPrompt;
    return dialogChanged && !promptChanged;
  }, [point?.dialogText, point?.videoPrompt]);
  
  // Check if videoPrompt (description) changed — this is image-relevant
  const videoPromptChanged = useMemo(() => {
    if (!point || !savedSnapshotRef.current) return false;
    return (point.videoPrompt || "") !== savedSnapshotRef.current.videoPrompt;
  }, [point?.videoPrompt]);
  
  // Block background scrolling when popup is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);
  
  // Reset zoom, fullscreen, and preview tab when scene changes
  useEffect(() => {
    setImageZoom(1);
    setImagePosition({ x: 0, y: 0 });
    setShowFullscreenImage(false);
    // Default to video tab if video exists for this scene
    const currentPoint = storyPoints[expandedIndex];
    setPreviewTab(currentPoint?.generatedVideo ? "video" : "image");
  }, [expandedIndex, storyPoints]);
  
  // Auto-switch to video tab when video becomes available
  useEffect(() => {
    if (point?.generatedVideo) {
      setPreviewTab("video");
    }
  }, [point?.generatedVideo]);
  
  if (!point) return null;
  const status = getSceneStatus(point);
  const isDirty = isSceneDirty(point);
  const hasFinalized = !!point.finalSnapshot;
  
  const hasVideo = !!point.generatedVideo;
  
  // isDirty covers snapshot fields (camera, emotion etc), videoPromptChanged covers description
  const needsImageRegeneration = isDirty || videoPromptChanged;
  
  // Only dialog/text changed, no image-relevant fields
  const onlyDialogChanged = hasTextChanges && !needsImageRegeneration;
  
  const handleSaveTextOnly = () => {
    // Only text changes, no video — just save the snapshot
    savedSnapshotRef.current = {
      dialogText: point.dialogText || "",
      videoPrompt: point.videoPrompt || "",
    };
  };

  const handleSaveAndRegenerateImage = () => {
    // Image-affecting fields changed, no video → regenerate image
    onRegenerateImage(expandedIndex, storyPoints[expandedIndex]);
    savedSnapshotRef.current = {
      dialogText: point.dialogText || "",
      videoPrompt: point.videoPrompt || "",
    };
  };

  const handleRegenerateVideo = () => {
    // Any change + video exists → regenerate video (handles image regen internally if needed)
    if (onRegenerateVideo) {
      onRegenerateVideo(expandedIndex);
    }
    savedSnapshotRef.current = {
      dialogText: point.dialogText || "",
      videoPrompt: point.videoPrompt || "",
    };
  };
  const handleFieldUpdate = (field: keyof StoryPoint, value: string) => {
    onUpdateStoryPoint(expandedIndex, {
      [field]: value
    });
  };
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  const handleFinalize = () => {
    if (hasFinalized && isDirty) {
      setShowFinalizeConfirm(true);
    } else {
      onFinalizeScene(expandedIndex);
    }
  };
  const confirmFinalize = () => {
    setShowFinalizeConfirm(false);
    onFinalizeScene(expandedIndex);
  };

  // Zoom handlers for image preview
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
      // To keep the point under cursor fixed
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
    // Scale drag speed with zoom level
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

  // Get display labels for camera settings (for collapsed state)
  const cameraTagsDisplay = [point.shotType && SHOT_TYPE_OPTIONS.find(s => s.value === point.shotType)?.label, point.cameraAngle && CAMERA_ANGLE_OPTIONS.find(a => a.value === point.cameraAngle)?.label].filter(Boolean);

  // Collapsible Section Header Component
  const SectionHeader = ({
    number,
    title,
    icon: Icon,
    color,
    sectionKey,
    tags = [],
    badge
  }: {
    number: number;
    title: string;
    icon: React.ElementType;
    color: string;
    sectionKey: string;
    tags?: string[];
    badge?: string;
  }) => {
    const isExpanded = expandedSections[sectionKey];
    const panelId = `${uniqueId}-panel-${sectionKey}`;
    return <CollapsibleTrigger className="flex items-center gap-2 w-full py-3 hover:bg-muted/10 rounded-lg transition-colors group" aria-expanded={isExpanded} aria-controls={panelId}>
        <div className={`w-6 h-6 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
          {number}
        </div>
        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
        <h3 className="font-medium text-foreground text-sm">{title}</h3>
        {badge && <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-muted-foreground/30 text-muted-foreground">
            {badge}
          </Badge>}
        {!isExpanded && tags.length > 0 && <div className="flex gap-1.5 ml-auto mr-2">
            {tags.map((tag, i) => <Badge key={i} variant="secondary" className="text-[10px] h-5 px-1.5 bg-muted/50">
                {tag}
              </Badge>)}
          </div>}
        <div className="ml-auto">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />}
        </div>
      </CollapsibleTrigger>;
  };

  // Preview Column Component (used for both desktop and mobile overlay)
  const PreviewColumn = ({
    inMobileOverlay = false
  }: {
    inMobileOverlay?: boolean;
  }) => <div className={`space-y-4 ${inMobileOverlay ? '' : 'lg:sticky lg:top-4'}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <Eye className="w-3 h-3 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">Ergebnis dieser Szene</h3>
        </div>
        {/* Aspect Ratio Badge */}
        <Badge variant="outline" className="text-[10px] h-5 px-2 border-primary/50 text-primary bg-primary/10">
          <span className="mr-1">📐</span> {aspectRatio}
        </Badge>
      </div>
      
      {/* Image/Video Tabs - only show when video exists */}
      {point.generatedVideo && (point.generatedImage || point.generatedVideo) && (
        <div className="flex rounded-lg bg-muted/30 p-1 gap-1">
          <button
            onClick={() => setPreviewTab("video")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              previewTab === "video" 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Play className="w-3 h-3" />
            Video
          </button>
          <button
            onClick={() => setPreviewTab("image")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              previewTab === "image" 
                ? "bg-background text-foreground shadow-sm" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ImageIcon className="w-3 h-3" />
            Bild
          </button>
        </div>
      )}
      
      {/* Media Preview */}
      <div 
        className="relative rounded-lg overflow-hidden bg-muted/30 border border-border/30 flex items-center justify-center min-h-[200px] cursor-pointer group/preview"
        onClick={() => {
          if (previewTab === "image" && point.generatedImage && !isDraggingImage && imageZoom === 1) {
            setShowFullscreenImage(true);
          }
        }}
      >
        {/* Video view */}
        {previewTab === "video" && point.generatedVideo ? (
          <video 
            src={point.generatedVideo} 
            controls
            autoPlay
            loop
            className="max-w-full max-h-[400px] object-contain rounded-lg"
          />
        ) : point.generatedImage ? <>
            <img 
              src={point.generatedImage} 
              alt="Generiertes Bild" 
              className="max-w-full max-h-[400px] object-contain select-none rounded-lg transition-transform group-hover/preview:scale-[1.02]"
              style={{
                transform: `translate(${imagePosition.x}%, ${imagePosition.y}%) scale(${imageZoom})`,
                cursor: imageZoom > 1 ? (isDraggingImage ? 'grabbing' : 'grab') : 'pointer',
              }}
              draggable={false}
              onWheel={handleImageWheel}
              onMouseDown={handleImageMouseDown}
              onMouseMove={handleImageMouseMove}
              onMouseUp={handleImageMouseUp}
              onMouseLeave={handleImageMouseLeave}
            />
            {/* Click hint overlay */}
            {imageZoom === 1 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/preview:bg-black/20 transition-colors pointer-events-none">
                <div className="opacity-0 group-hover/preview:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5" />
                  Klicken zum Vergrößern
                </div>
              </div>
            )}
            {/* Zoom indicator */}
            {imageZoom > 1 && (
              <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 z-10">
                <ZoomIn className="w-3 h-3" />
                {Math.round(imageZoom * 100)}%
              </div>
            )}
            {regeneratingIndex === expandedIndex && <div className="absolute inset-0 bg-background/80 flex items-center justify-center backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Wird generiert...</span>
                </div>
              </div>}
          </> : <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-8">
            <ImageIcon className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm">Noch kein Bild generiert</p>
          </div>}
      </div>
      
      {/* Zoom hint - only for image tab */}
      {previewTab === "image" && point.generatedImage && (
        <p className="text-[10px] text-muted-foreground text-center">
          Klicken zum Vergrößern • Mausrad zum Zoomen
        </p>
      )}
      
      {/* Status Tags */}
      <div className="flex gap-2 flex-wrap">
        {/* Status Badge */}
        <Badge className={status.variant === 'final' ? 'bg-green-600 text-white border-transparent' : status.variant === 'dirty' ? 'bg-transparent border-destructive text-destructive' : 'bg-transparent border-orange-500 text-orange-500'} variant={status.variant === 'final' ? 'default' : 'outline'}>
          {status.label}
        </Badge>
        {point.emotion && <Badge variant="secondary" className="bg-primary/10 text-primary border-transparent">
            {EMOTION_OPTIONS.find(e => e.value === point.emotion)?.label || point.emotion}
          </Badge>}
        {point.shotType && <Badge variant="outline" className="text-muted-foreground">
            {SHOT_TYPE_OPTIONS.find(s => s.value === point.shotType)?.label || point.shotType}
          </Badge>}
        {point.cameraAngle && <Badge variant="outline" className="text-muted-foreground">
            {CAMERA_ANGLE_OPTIONS.find(a => a.value === point.cameraAngle)?.label || point.cameraAngle}
          </Badge>}
      </div>
      
      {/* Dirty State Warning - More prominent when changes need regeneration */}
      {isDirty && point.generatedImage && <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-orange-500">Vorschau ist veraltet</p>
              <p className="text-xs text-orange-500/80">
                Du hast Änderungen vorgenommen. Generiere die Vorschau neu, um sie zu aktualisieren.
              </p>
            </div>
          </div>
        </div>}
      
      {/* Success State */}
      {!isDirty && point.generatedImage && <div className="flex items-center gap-1.5 text-green-500">
          <Sparkles className="w-3.5 h-3.5" />
          <p className="text-xs">Vorschau ist aktuell</p>
        </div>}
      
      {/* Contextual Action Button — always exactly 1, disabled when no changes */}
      <div className="space-y-3">
        {(() => {
          const isRegenerating = regeneratingIndex === expandedIndex;
          const isVideoGenerating = isGeneratingVideo && generatingVideoIndex === expandedIndex;
          const isBusy = isRegenerating || isVideoGenerating;
          const hasChanges = needsImageRegeneration || hasTextChanges;
          
          if (!hasVideo) {
            // No video exists
            if (needsImageRegeneration) {
              // Image-relevant change → orange regenerate button
              return (
                <Button variant="default" className="w-full gap-2 h-11 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25 animate-pulse" onClick={handleSaveAndRegenerateImage} disabled={isBusy}>
                  {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {isRegenerating ? 'Bild wird generiert...' : 'Speichern + Bild neu generieren'}
                </Button>
              );
            }
            // No image-relevant change → save button, disabled until something changes
            return (
              <Button variant="default" className="w-full gap-2 h-11 text-sm font-medium" onClick={handleSaveTextOnly} disabled={isBusy || !hasChanges}>
                <Save className="w-4 h-4" />
                Änderungen speichern
              </Button>
            );
          } else {
            // Video exists
            if (needsImageRegeneration) {
              // Image-relevant change → regenerate image + video
              return (
                <Button variant="default" className="w-full gap-2 h-11 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/25 animate-pulse" onClick={handleRegenerateVideo} disabled={isBusy}>
                  {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {isRegenerating ? 'Bild wird generiert...' : isVideoGenerating ? 'Video wird generiert...' : 'Bild + Video neu generieren'}
                </Button>
              );
            }
            // Only text/dialog changed or nothing → save button, disabled until something changes
            return (
              <Button variant="default" className="w-full gap-2 h-11 text-sm font-medium" onClick={handleSaveTextOnly} disabled={isBusy || !hasChanges}>
                <Save className="w-4 h-4" />
                Änderungen speichern
              </Button>
            );
          }
        })()}
      </div>
      
      {/* Video Prompt Display */}
      {point.videoPrompt && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-foreground">Video Prompt</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => {
                navigator.clipboard.writeText(point.videoPrompt || '');
              }}
            >
              <Copy className="w-3 h-3" />
              Kopieren
            </Button>
          </div>
          <Textarea
            value={point.videoPrompt}
            onChange={(e) => onUpdateVideoPrompt(expandedIndex, e.target.value)}
            className="text-xs min-h-[100px] resize-y bg-muted/30 border-border/30"
            placeholder="Video Prompt wird hier angezeigt..."
          />
          {/* Video Error Display */}
          {videoErrors?.has(expandedIndex) && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{videoErrors.get(expandedIndex)}</p>
            </div>
          )}
        </div>
      )}
      
      {inMobileOverlay && <Button variant="outline" className="w-full mt-4" onClick={() => setShowMobilePreview(false)}>
          Schließen
        </Button>}
    </div>;
  return createPortal(<>
      {/* Backdrop */}
      <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] ${isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`} onClick={onClose} />
      
      {/* Main Container - NOT fullscreen, centered with solid background */}
      <div className={`fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto py-2 px-2 sm:py-8 sm:px-4`}>
        <div className={`bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] flex flex-col ${isClosing ? 'animate-popup-out' : 'animate-popup-in'}`}>
          {/* Sticky Header */}
          <div className="bg-card border-b border-border/30 flex items-center justify-between px-4 py-3 shrink-0 rounded-t-xl">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground" onClick={() => onNavigateScene('prev')} disabled={expandedIndex === 0}>
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Zurück</span>
              </Button>
              <div className="text-sm font-medium">
                Szene {expandedIndex + 1} von {totalScenes}
              </div>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground" onClick={() => onNavigateScene('next')} disabled={expandedIndex === totalScenes - 1}>
                <span className="hidden sm:inline">Weiter</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Status Badge in Header */}
              <Badge className={status.variant === 'final' ? 'bg-green-600/20 text-green-500 border-green-600/30' : status.variant === 'dirty' ? 'bg-destructive/10 text-destructive border-destructive/30' : 'bg-orange-500/10 text-orange-500 border-orange-500/30'} variant="outline">
                {status.label}
              </Badge>
              
              {/* Mobile Preview Button */}
              <Button variant="outline" size="sm" className="lg:hidden gap-1.5" onClick={() => setShowMobilePreview(true)}>
                <Eye className="w-4 h-4" />
                Vorschau
              </Button>
              
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Two Column Layout - Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,340px] gap-6">
              {/* Left Column - Editing */}
              <div className="space-y-1">
                {/* Section 1: Story-Kern (ALWAYS VISIBLE, NOT COLLAPSIBLE) */}
                <div className="pb-4 border-b border-border/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold">
                      1
                    </div>
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-medium text-foreground text-sm">Was passiert in dieser Szene?</h3>
                  </div>
                  
                  <div className="space-y-3 pl-8">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Zusammenfassung:</label>
                      <div className="bg-muted/30 rounded-lg p-3 border border-border/20">
                        <Textarea value={point.summary || ""} onChange={e => handleFieldUpdate('summary', e.target.value)} className={`leading-relaxed bg-transparent border-none resize-y p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[40px] ${isDirty ? 'border-l-2 border-l-orange-500 pl-2 -ml-2' : ''}`} placeholder="Beschreibe kurz, was in dieser Szene passiert (1-2 Sätze)" maxLength={200} />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />
                          Detaillierte Szenen-Beschreibung
                        </label>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3 border border-border/20">
                        <Textarea value={point.detailedDescription || point.versions[point.currentVersion]} onChange={e => handleFieldUpdate('detailedDescription', e.target.value)} className="leading-relaxed bg-transparent border-none resize-y p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[80px]" placeholder="Die detaillierte Szenen-Beschreibung wird hier angezeigt. Du kannst sie jederzeit bearbeiten." />
                      </div>
                    </div>
                    
                    {/* Dialog Text */}
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5" />
                        Dialog / Gesprochener Text
                      </label>
                      <div className="bg-muted/30 rounded-lg p-3 border border-border/20">
                        <Textarea value={point.dialogText || ""} onChange={e => handleFieldUpdate('dialogText', e.target.value)} className="leading-relaxed bg-transparent border-none resize-y p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[50px] italic" placeholder={'Was sagt der Charakter? z.B. "Ich hätte nie gedacht, dass es so enden würde."'} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Handlung (Collapsible, default OPEN) */}
                <Collapsible open={expandedSections.handlung} onOpenChange={() => toggleSection('handlung')}>
                  <div className="border-b border-border/30">
                    <SectionHeader number={2} title="Handlung" icon={Users} color="bg-orange-500" sectionKey="handlung" />
                    <CollapsibleContent id={`${uniqueId}-panel-handlung`} className="pl-8 pb-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">Pose</label>
                          <Select value={point.keyAction || "_auto_"} onValueChange={value => handleFieldUpdate('keyAction', value === "_auto_" ? "" : value)}>
                            <SelectTrigger className="bg-background/50 text-sm h-9">
                              <SelectValue placeholder="Von KI wählen lassen..." />
                            </SelectTrigger>
                            <SelectContent>
                              {KEY_ACTION_OPTIONS.map(action => <SelectItem key={action.value} value={action.value}>
                                  {action.label}
                                </SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">Bereich</label>
                          <Select value={point.specificArea || "_auto_"} onValueChange={value => handleFieldUpdate('specificArea', value === "_auto_" ? "" : value)}>
                            <SelectTrigger className="bg-background/50 text-sm h-9">
                              <SelectValue placeholder="Von KI wählen lassen..." />
                            </SelectTrigger>
                            <SelectContent>
                              {AREA_OPTIONS.map(area => <SelectItem key={area.value} value={area.value}>
                                  {area.label}
                                </SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* Section 3: Emotion & Wirkung (Collapsible, default OPEN) */}
                <Collapsible open={expandedSections.emotion} onOpenChange={() => toggleSection('emotion')}>
                  <div className="border-b border-border/30">
                    <SectionHeader number={3} title="Emotion & Wirkung" icon={Heart} color="bg-green-500" sectionKey="emotion" />
                    <CollapsibleContent id={`${uniqueId}-panel-emotion`} className="pl-8 pb-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">Emotion Charakter</label>
                          <Select value={point.emotion || "_auto_"} onValueChange={value => handleFieldUpdate('emotion', value === "_auto_" ? "" : value)}>
                            <SelectTrigger className="bg-background/50 text-sm h-9">
                              <SelectValue placeholder="Von KI wählen lassen..." />
                            </SelectTrigger>
                            <SelectContent>
                              {EMOTION_OPTIONS.map(emotion => <SelectItem key={emotion.value} value={emotion.value}>
                                  {emotion.label}
                                </SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">Wirkung beim Zuschauer</label>
                          <Select value={point.audienceEffect || "_auto_"} onValueChange={value => handleFieldUpdate('audienceEffect', value === "_auto_" ? "" : value)}>
                            <SelectTrigger className="bg-background/50 text-sm h-9">
                              <SelectValue placeholder="Von KI wählen lassen..." />
                            </SelectTrigger>
                            <SelectContent>
                              {AUDIENCE_EFFECT_OPTIONS.map(effect => <SelectItem key={effect.value} value={effect.value}>
                                  {effect.label}
                                </SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* Section 4: Kamera & Bildsprache (Collapsible, default COLLAPSED) */}
                <Collapsible open={expandedSections.kamera} onOpenChange={() => toggleSection('kamera')}>
                  <div className="border-b border-border/30">
                    <SectionHeader number={4} title="Kamera & Bildsprache" icon={Camera} color="bg-blue-500" sectionKey="kamera" tags={cameraTagsDisplay} />
                    <CollapsibleContent id={`${uniqueId}-panel-kamera`} className="pl-8 pb-4">
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Shot-Typ und Winkel werden automatisch von der KI gewählt, wenn du sie nicht selbst festlegst.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground">Shot-Typ</label>
                            <Select value={point.shotType || "_auto_"} onValueChange={value => handleFieldUpdate('shotType', value === "_auto_" ? "" : value)}>
                              <SelectTrigger className="bg-background/50 text-sm h-9">
                                <SelectValue placeholder="Von KI wählen lassen..." />
                              </SelectTrigger>
                              <SelectContent>
                                {SHOT_TYPE_OPTIONS.map(shot => <SelectItem key={shot.value} value={shot.value}>
                                    {shot.label}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground">Kamerawinkel</label>
                            <Select value={point.cameraAngle || "_auto_"} onValueChange={value => handleFieldUpdate('cameraAngle', value === "_auto_" ? "" : value)}>
                              <SelectTrigger className="bg-background/50 text-sm h-9">
                                <SelectValue placeholder="Von KI wählen lassen..." />
                              </SelectTrigger>
                              <SelectContent>
                                {CAMERA_ANGLE_OPTIONS.map(angle => <SelectItem key={angle.value} value={angle.value}>
                                    {angle.label}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground">Bildaufbau</label>
                            <Select value={point.composition || "_auto_"} onValueChange={value => handleFieldUpdate('composition', value === "_auto_" ? "" : value)}>
                              <SelectTrigger className="bg-background/50 text-sm h-9">
                                <SelectValue placeholder="Von KI wählen lassen..." />
                              </SelectTrigger>
                              <SelectContent>
                                {COMPOSITION_OPTIONS.map(comp => <SelectItem key={comp.value} value={comp.value}>
                                    {comp.label}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground">Bewegung</label>
                            <Select value={point.movement || "_auto_"} onValueChange={value => handleFieldUpdate('movement', value === "_auto_" ? "" : value)}>
                              <SelectTrigger className="bg-background/50 text-sm h-9">
                                <SelectValue placeholder="Von KI wählen lassen..." />
                              </SelectTrigger>
                              <SelectContent>
                                {MOVEMENT_OPTIONS.map(mov => <SelectItem key={mov.value} value={mov.value}>
                                    {mov.label}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* Section 5: KI-Feintuning (Collapsible, default COLLAPSED) */}
                <Collapsible open={expandedSections.feintuning} onOpenChange={() => toggleSection('feintuning')}>
                  <div className="border-b border-border/30">
                    <SectionHeader number={5} title="KI-Feintuning" icon={Wand2} color="bg-violet-500" sectionKey="feintuning" badge="Erweitert" />
                    <CollapsibleContent id={`${uniqueId}-panel-feintuning`} className="pl-8 pb-4">
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground">
                          Erweiterte Einstellungen für erfahrene Nutzer. Die meisten Szenen brauchen das nicht.
                        </p>
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">Negative Prompts</label>
                          <Textarea value={point.negativePrompts || ""} onChange={e => handleFieldUpdate('negativePrompts', e.target.value)} className="bg-background/50 text-sm min-h-[60px] resize-y" placeholder="Was soll NICHT im Bild erscheinen? z.B. 'keine Brille, keine Tattoos'" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">Stil-Feintuning</label>
                          <Textarea value={point.styleNotes || ""} onChange={e => handleFieldUpdate('styleNotes', e.target.value)} className="bg-background/50 text-sm min-h-[60px] resize-y" placeholder="Spezielle Stil-Anweisungen, z.B. 'im Stil von Studio Ghibli'" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">Konsistenz-Hinweise</label>
                          <Textarea value={point.continuityNotes || ""} onChange={e => handleFieldUpdate('continuityNotes', e.target.value)} className="bg-background/50 text-sm min-h-[60px] resize-y" placeholder="Hinweise zur Kontinuität, z.B. 'Charakter trägt selbe Kleidung wie Szene 1'" />
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

              </div>

              {/* Right Column - Preview (Desktop only) */}
              <div className="hidden lg:block">
                <PreviewColumn />
              </div>
            </div>
          </div>
          
          {/* AI Assistant Section - Inside the card */}
          <div className="border-t border-border/30 p-4 mt-4">
            {/* Header with label and mode selector */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">KI-Assistent</span>
              </div>
              <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
                <Button variant={aiMode === "text" ? "default" : "ghost"} size="sm" className={`h-7 px-3 text-xs gap-1.5 ${aiMode === "text" ? "" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setAiMode("text")}>
                  <MessageSquare className="w-3.5 h-3.5" />
                  Text optimieren
                </Button>
                <Button variant={aiMode === "image" ? "default" : "ghost"} size="sm" className={`h-7 px-3 text-xs gap-1.5 ${aiMode === "image" ? "" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setAiMode("image")}>
                  <ImageIcon className="w-3.5 h-3.5" />
                  Bild regenerieren
                </Button>
                <Button variant={aiMode === "video" ? "default" : "ghost"} size="sm" className={`h-7 px-3 text-xs gap-1.5 ${aiMode === "video" ? "" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setAiMode("video")}>
                  <Video className="w-3.5 h-3.5" />
                  Video Prompt
                </Button>
              </div>
            </div>
            
            {/* Input area */}
            <div className="flex gap-3 items-stretch">
              <div className="flex-1 p-3 rounded-lg border border-border/50 bg-muted/30 h-[80px]">
                <Textarea value={sceneAssistantInput} onChange={e => setSceneAssistantInput(e.target.value)} placeholder={aiMode === "text" ? 'Beschreibe was du ändern möchtest, z.B. "Mache es dramatischer" oder "Ändere zu Nahaufnahme"...' : aiMode === "video" ? 'Beschreibe wie der Video-Prompt angepasst werden soll, z.B. "Mehr Kamerabewegung" oder "Langsamer und dramatischer"...' : 'Beschreibe spezielle Bild-Anweisungen oder lasse leer für Standard-Regenerierung...'} className="h-full min-h-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 resize-y bg-transparent border-0 p-0" disabled={isGeneratingAssistant || regeneratingIndex !== null} onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onAssistantSubmit(aiMode);
                }
              }} />
              </div>
              <Button className="h-[80px] w-12 rounded-lg" onClick={() => onAssistantSubmit(aiMode)} disabled={isGeneratingAssistant || regeneratingIndex !== null || (aiMode === "text" && !sceneAssistantInput.trim()) || (aiMode === "video" && !sceneAssistantInput.trim() && !point.videoPrompt)}>
                {isGeneratingAssistant ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Preview Overlay */}
      {showMobilePreview && <div className="fixed inset-0 z-[120] lg:hidden">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowMobilePreview(false)} />
          <div className="absolute inset-x-4 top-16 bottom-4 bg-background rounded-xl border border-border/40 p-4 overflow-y-auto">
            <PreviewColumn inMobileOverlay />
          </div>
        </div>}
      
      {/* Finalize Confirmation Dialog */}
      <AlertDialog open={showFinalizeConfirm} onOpenChange={setShowFinalizeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finale Version überschreiben?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Szene hat bereits eine finale Version. Möchtest du sie mit der aktuellen Vorschau überschreiben?
              <br /><br />
              Die vorherige Version kann nicht wiederhergestellt werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmFinalize} className="bg-green-600 hover:bg-green-700">
              Ja, überschreiben
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fullscreen Image Lightbox with Zoom */}
      {showFullscreenImage && point.generatedImage && (
        <FullscreenLightbox
          src={point.generatedImage}
          aspectRatio={aspectRatio}
          expandedIndex={expandedIndex}
          onClose={() => setShowFullscreenImage(false)}
        />
      )}
    </>, document.body);
};