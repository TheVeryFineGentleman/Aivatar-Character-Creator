import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  X,
  Video,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  ThumbsUp,
  Undo2,
  Loader2,
  Camera,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";

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
  generationError?: string;
  sceneTitle?: string;
  sceneDescription?: string;
  veo3CameraMovement?: string;
  veo3StartState?: string;
  veo3Motion?: string;
  veo3EndState?: string;
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
  onNavigateVersion: (index: number, direction: 'prev' | 'next') => void;
  onRegenerateImage: (index: number) => void;
  regeneratingIndex: number | null;
  veo3CameraMovements: Veo3CameraMovement[];
  sceneAssistantInput: string;
  setSceneAssistantInput: (value: string) => void;
  isGeneratingAssistant: boolean;
  onAssistantSubmit: () => void;
  sceneAiMode: "text" | "camera" | "image" | "both";
  setSceneAiMode: (mode: "text" | "camera" | "image" | "both") => void;
  onCopyVideoPrompt: () => void;
}

// Mood options
const MOOD_OPTIONS = ["Ruhig", "Dynamisch", "Intim", "Beobachtend"];

// Emotion options for dropdown
const EMOTION_OPTIONS = [
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
];

// Camera angle options
const CAMERA_ANGLE_OPTIONS = [
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
  { value: "extreme-close-up", label: "Extreme Close-Up" },
  { value: "close-up", label: "Close-Up" },
  { value: "medium-close-up", label: "Medium Close-Up" },
  { value: "medium-shot", label: "Medium Shot" },
  { value: "medium-long-shot", label: "Medium Long Shot" },
  { value: "full-shot", label: "Full Shot" },
  { value: "long-shot", label: "Long Shot" },
  { value: "extreme-long-shot", label: "Extreme Long Shot" },
];

export const StoryDetailPopup: React.FC<StoryDetailPopupProps> = ({
  expandedIndex,
  storyPoints,
  isClosing,
  onClose,
  onUpdateStoryPoint,
  onNavigateVersion,
  onRegenerateImage,
  regeneratingIndex,
  veo3CameraMovements,
  sceneAssistantInput,
  setSceneAssistantInput,
  isGeneratingAssistant,
  onAssistantSubmit,
  sceneAiMode,
  setSceneAiMode,
  onCopyVideoPrompt,
}) => {
  const [activeTab, setActiveTab] = useState<"content" | "image" | "video">("content");
  const [selectedMood, setSelectedMood] = useState<string>("");
  
  const point = storyPoints[expandedIndex];
  if (!point) return null;

  const handleFieldUpdate = (field: keyof StoryPoint, value: string) => {
    onUpdateStoryPoint(expandedIndex, { [field]: value });
  };

  // Section Header Component
  const SectionHeader = ({ 
    number, 
    title, 
    color 
  }: { 
    number: number; 
    title: string; 
    color: string;
  }) => (
    <div className="flex items-center gap-2 mb-3">
      <div className={`w-6 h-6 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold`}>
        {number}
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
    </div>
  );

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] ${isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
        onClick={onClose}
      />
      
      {/* Popup Container */}
      <div className="fixed inset-x-0 top-0 bottom-0 z-[110] flex items-start justify-center pt-8 pb-6 px-6 pointer-events-none overflow-y-auto">
        <div 
          className={`bg-background rounded-xl border border-border/40 shadow-2xl w-full max-w-5xl flex flex-col pointer-events-auto mx-auto ${isClosing ? 'animate-popup-out' : 'animate-popup-in'}`}
        >
          {/* Header with Tabs */}
          <div className="bg-muted/40 border-b border-border/30 flex items-center justify-between px-5 py-3 flex-shrink-0">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "content" | "image" | "video")}>
              <TabsList className="bg-transparent h-9">
                <TabsTrigger value="content" className="gap-1.5 data-[state=active]:bg-background">
                  <BookOpen className="w-3.5 h-3.5" />
                  Inhalt
                </TabsTrigger>
                <TabsTrigger value="image" className="gap-1.5 data-[state=active]:bg-background">
                  <ImageIcon className="w-3.5 h-3.5" />
                  Bild
                </TabsTrigger>
                <TabsTrigger value="video" className="gap-1.5 data-[state=active]:bg-background">
                  <Video className="w-3.5 h-3.5" />
                  Video
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Content Tab - Two Column Layout */}
          {activeTab === "content" && (
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Editing */}
              <div className="space-y-5">
                {/* Section 1: Was passiert in dieser Szene? */}
                <div>
                  <SectionHeader number={1} title="Was passiert in dieser Szene?" color="bg-purple-600" />
                  
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Zusammenfassung:</label>
                      <div className="bg-muted/30 rounded-lg p-3 border border-border/20">
                        <Textarea
                          value={point.summary || ""}
                          onChange={(e) => handleFieldUpdate('summary', e.target.value)}
                          className="leading-relaxed bg-transparent border-none resize-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[50px]"
                          placeholder="Kurze Zusammenfassung der Szene..."
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        Detaillierte Szenen-Beschreibung
                      </label>
                      <div className="bg-muted/30 rounded-lg p-3 border border-border/20">
                        <Textarea
                          value={point.detailedDescription || point.versions[point.currentVersion]}
                          onChange={(e) => handleFieldUpdate('detailedDescription', e.target.value)}
                          className="leading-relaxed bg-transparent border-none resize-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[80px]"
                          placeholder="Ausführliche Beschreibung..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Handlung & Beteiligte */}
                <div>
                  <SectionHeader number={2} title="Handlung & Beteiligte" color="bg-orange-500" />
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Schlüsselaktion</label>
                      <Select
                        value={point.keyAction || ""}
                        onValueChange={(value) => handleFieldUpdate('keyAction', value)}
                      >
                        <SelectTrigger className="bg-background/50 text-sm">
                          <SelectValue placeholder="Aktion wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="steht">Steht</SelectItem>
                          <SelectItem value="geht">Geht</SelectItem>
                          <SelectItem value="sitzt">Sitzt</SelectItem>
                          <SelectItem value="lehnt">Lehnt</SelectItem>
                          <SelectItem value="schaut">Schaut</SelectItem>
                          <SelectItem value="spricht">Spricht</SelectItem>
                          <SelectItem value="rennt">Rennt</SelectItem>
                          <SelectItem value="wartet">Wartet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Bereich</label>
                      <Select
                        value={point.specificArea || ""}
                        onValueChange={(value) => handleFieldUpdate('specificArea', value)}
                      >
                        <SelectTrigger className="bg-background/50 text-sm">
                          <SelectValue placeholder="Bereich wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="innenraum">Innenraum</SelectItem>
                          <SelectItem value="aussenbereich">Außenbereich</SelectItem>
                          <SelectItem value="strasse">Straße</SelectItem>
                          <SelectItem value="natur">Natur</SelectItem>
                          <SelectItem value="arbeitsplatz">Arbeitsplatz</SelectItem>
                          <SelectItem value="zuhause">Zuhause</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Emotion & Wirkung */}
                <div>
                  <SectionHeader number={3} title="Emotion & Wirkung" color="bg-green-500" />
                  
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Emotion</label>
                    <Select
                      value={point.emotion || ""}
                      onValueChange={(value) => handleFieldUpdate('emotion', value)}
                    >
                      <SelectTrigger className="bg-background/50 text-sm w-full">
                        <SelectValue placeholder="Emotion wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EMOTION_OPTIONS.map(emotion => (
                          <SelectItem key={emotion.value} value={emotion.value}>
                            {emotion.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Section 4: Kamera & Bildsprache */}
                <div>
                  <SectionHeader number={4} title="Kamera & Bildsprache" color="bg-blue-500" />
                  
                  {/* Mood Tags */}
                  <div className="flex gap-2 flex-wrap mb-3">
                    {MOOD_OPTIONS.map(mood => (
                      <Button
                        key={mood}
                        variant={selectedMood === mood ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedMood(selectedMood === mood ? "" : mood)}
                      >
                        {mood}
                      </Button>
                    ))}
                  </div>
                  
                  {/* Camera Dropdowns */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Kamerawinkel</label>
                      <Select
                        value={point.cameraAngle || ""}
                        onValueChange={(value) => handleFieldUpdate('cameraAngle', value)}
                      >
                        <SelectTrigger className="bg-background/50 text-sm">
                          <SelectValue placeholder="Von KI wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CAMERA_ANGLE_OPTIONS.map(angle => (
                            <SelectItem key={angle.value} value={angle.value}>
                              {angle.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Shot-Typ</label>
                      <Select
                        value={point.shotType || ""}
                        onValueChange={(value) => handleFieldUpdate('shotType', value)}
                      >
                        <SelectTrigger className="bg-background/50 text-sm">
                          <SelectValue placeholder="Von KI wählen..." />
                        </SelectTrigger>
                        <SelectContent>
                          {SHOT_TYPE_OPTIONS.map(shot => (
                            <SelectItem key={shot.value} value={shot.value}>
                              {shot.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Result */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary text-xs">⬤</span>
                  </div>
                  <h3 className="font-semibold">Ergebnis dieser Szene</h3>
                </div>
                
                {/* Image Preview */}
                <div className="relative rounded-lg overflow-hidden bg-muted/30 aspect-video">
                  {point.generatedImage ? (
                    <>
                      <img 
                        src={point.generatedImage} 
                        alt="Generiertes Bild" 
                        className="w-full h-full object-cover"
                      />
                      {regeneratingIndex === expandedIndex && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <ImageIcon className="w-12 h-12 mb-2 opacity-30" />
                      <p className="text-sm">Noch kein Bild generiert</p>
                    </div>
                  )}
                </div>
                
                {/* Tags */}
                <div className="flex gap-2 flex-wrap">
                  {point.emotion && (
                    <Badge className="bg-primary text-primary-foreground">
                      {EMOTION_OPTIONS.find(e => e.value === point.emotion)?.label || point.emotion}
                    </Badge>
                  )}
                  {point.shotType && (
                    <Badge variant="outline">
                      {SHOT_TYPE_OPTIONS.find(s => s.value === point.shotType)?.label || point.shotType}
                    </Badge>
                  )}
                  {point.cameraAngle && (
                    <Badge variant="outline">
                      {CAMERA_ANGLE_OPTIONS.find(a => a.value === point.cameraAngle)?.label || point.cameraAngle}
                    </Badge>
                  )}
                  {selectedMood && (
                    <Badge variant="secondary">{selectedMood}</Badge>
                  )}
                </div>
                
                {/* Status */}
                {point.generatedImage && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    Aktualisiert nach letzter Änderung
                  </p>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 gap-2"
                    onClick={() => onRegenerateImage(expandedIndex)}
                    disabled={regeneratingIndex !== null}
                  >
                    {regeneratingIndex === expandedIndex ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Vorschau neu
                  </Button>
                  <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white">
                    <ThumbsUp className="w-4 h-4" />
                    Als final
                  </Button>
                </div>
                <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
                  <Undo2 className="w-4 h-4" />
                  Änderungen verwerfen
                </Button>

                {/* Scene Navigation */}
                <div className="pt-3 border-t border-border/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Szene {expandedIndex + 1} von {storyPoints.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onNavigateVersion(expandedIndex, 'prev')}
                        disabled={point.currentVersion === 0}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm min-w-[40px] text-center">
                        {point.currentVersion + 1}/{point.versions.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onNavigateVersion(expandedIndex, 'next')}
                        disabled={point.currentVersion === point.versions.length - 1}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Image Tab */}
          {activeTab === "image" && (
            <div className="p-5 space-y-4">
              {/* Large Image Display */}
              <div className="relative rounded-lg overflow-hidden bg-muted/30 aspect-video max-h-[400px]">
                {point.generatedImage ? (
                  <>
                    <img 
                      src={point.generatedImage} 
                      alt="Generiertes Bild" 
                      className="w-full h-full object-contain"
                    />
                    {regeneratingIndex === expandedIndex && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
                    <ImageIcon className="w-16 h-16 mb-3 opacity-30" />
                    <p className="text-sm">Noch kein Bild generiert</p>
                    <Button
                      className="mt-4 gap-2"
                      onClick={() => onRegenerateImage(expandedIndex)}
                      disabled={regeneratingIndex !== null}
                    >
                      <ImageIcon className="w-4 h-4" />
                      Bild generieren
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Image regenerate button if exists */}
              {point.generatedImage && (
                <Button
                  className="w-full gap-2"
                  variant="outline"
                  onClick={() => onRegenerateImage(expandedIndex)}
                  disabled={regeneratingIndex !== null}
                >
                  {regeneratingIndex === expandedIndex ? (
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
              )}

              {/* Image Prompt */}
              {point.detailedImagePrompt && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Bild-Prompt (bearbeitbar)
                  </label>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <Textarea
                      value={point.detailedImagePrompt}
                      onChange={(e) => handleFieldUpdate('detailedImagePrompt', e.target.value)}
                      className="leading-relaxed bg-transparent border-none resize-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[120px]"
                      placeholder="Detaillierter Bild-Prompt..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Video Tab */}
          {activeTab === "video" && (
            <div className="p-5 space-y-4">
              {/* Video Prompt */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5" />
                  Video-Prompt
                </label>
                <div className="bg-muted/30 rounded-lg p-3">
                  <Textarea
                    value={point.videoPrompt || ""}
                    onChange={(e) => handleFieldUpdate('videoPrompt', e.target.value)}
                    className="leading-relaxed bg-transparent border-none resize-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm min-h-[80px]"
                    placeholder="Video-Animations-Prompt..."
                  />
                </div>
              </div>
              
              {/* Camera Movement */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Kamerabewegung (Veo3)</label>
                <Select
                  value={point.veo3CameraMovement || ""}
                  onValueChange={(value) => handleFieldUpdate('veo3CameraMovement', value)}
                >
                  <SelectTrigger className="w-full bg-background/50">
                    <SelectValue placeholder="Kamerabewegung wählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {veo3CameraMovements.map(movement => (
                      <SelectItem key={movement.id} value={movement.id}>
                        {movement.label} - {movement.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Structured Veo3 Details */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Start-Frame</label>
                  <Textarea
                    value={point.veo3StartState || ""}
                    onChange={(e) => handleFieldUpdate('veo3StartState', e.target.value)}
                    className="text-xs bg-background/50 min-h-[70px] resize-none"
                    placeholder="Startframe..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Bewegung</label>
                  <Textarea
                    value={point.veo3Motion || ""}
                    onChange={(e) => handleFieldUpdate('veo3Motion', e.target.value)}
                    className="text-xs bg-background/50 min-h-[70px] resize-none"
                    placeholder="Bewegung..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">End-Frame</label>
                  <Textarea
                    value={point.veo3EndState || ""}
                    onChange={(e) => handleFieldUpdate('veo3EndState', e.target.value)}
                    className="text-xs bg-background/50 min-h-[70px] resize-none"
                    placeholder="Endframe..."
                  />
                </div>
              </div>
              
              {/* Copy Button */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={onCopyVideoPrompt}
              >
                <Download className="w-4 h-4" />
                Video-Prompt kopieren
              </Button>
            </div>
          )}
          
          {/* AI Assistant Footer */}
          <div className="border-t border-border/30 p-4 bg-muted/10 flex-shrink-0">
            {/* Header with label and mode selector */}
            <div className="flex items-center mb-2 h-7">
              <div className="flex items-center gap-1.5 w-28">
                <Sparkles className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">KI-Assistent</span>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="flex items-center gap-0.5 bg-muted/50 rounded-md p-0.5">
                  <Button
                    variant={sceneAiMode === "text" ? "default" : "ghost"}
                    size="sm"
                    className={`h-6 px-2 text-xs gap-1 ${sceneAiMode === "text" ? "" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setSceneAiMode("text")}
                    title="Optimiert den Szenentext, Kamerawinkel und Shot-Typ"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Text
                  </Button>
                  <Button
                    variant={sceneAiMode === "camera" ? "default" : "ghost"}
                    size="sm"
                    className={`h-6 px-2 text-xs gap-1 ${sceneAiMode === "camera" ? "" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setSceneAiMode("camera")}
                    title="Optimiert nur die Kamera-Einstellungen"
                  >
                    <Camera className="w-3 h-3" />
                    Kamera
                  </Button>
                  <Button
                    variant={sceneAiMode === "image" ? "default" : "ghost"}
                    size="sm"
                    className={`h-6 px-2 text-xs gap-1 ${sceneAiMode === "image" ? "" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setSceneAiMode("image")}
                    title="Generiert das Bild zur Szene neu"
                  >
                    <ImageIcon className="w-3 h-3" />
                    Bild neu
                  </Button>
                  <Button
                    variant={sceneAiMode === "both" ? "default" : "ghost"}
                    size="sm"
                    className={`h-6 px-2 text-xs gap-1 ${sceneAiMode === "both" ? "" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setSceneAiMode("both")}
                    title="Optimiert Text + Kamera, dann regeneriert das Bild"
                  >
                    <Sparkles className="w-3 h-3" />
                    Beides
                  </Button>
                </div>
              </div>
              <div className="w-28 flex justify-end">
                {isGeneratingAssistant && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                )}
              </div>
            </div>
            
            {/* Input area */}
            <div className="flex gap-3 items-stretch">
              <div className="flex-1 p-3 rounded-lg border border-border/50 bg-muted/30 h-[90px]">
                <Textarea
                  value={sceneAssistantInput}
                  onChange={(e) => setSceneAssistantInput(e.target.value)}
                  placeholder="z.B. 'Mache es dramatischer' oder 'Ändere zu Nahaufnahme'..."
                  className="h-full min-h-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 resize-none bg-transparent border-0 p-0"
                  disabled={isGeneratingAssistant}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onAssistantSubmit();
                    }
                  }}
                />
              </div>
              <Button 
                className="h-[90px] w-12 rounded-lg"
                onClick={onAssistantSubmit}
                disabled={isGeneratingAssistant || regeneratingIndex !== null || !sceneAssistantInput.trim()}
              >
                {isGeneratingAssistant ? (
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
  );
};
