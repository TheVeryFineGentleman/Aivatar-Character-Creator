import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

import { Sparkles, Upload, Image as ImageIcon, Download, ChevronLeft, ChevronRight, ChevronDown, X, Settings, RotateCcw, Plus, LogOut, Lock, Scale, Video, Loader2, Send, Undo2, Clock, Move, Zap, BookOpen, RefreshCw, Maximize2, MessageSquare, Check, Mountain, AlertCircle, Camera, ArrowRightLeft, ArrowLeft, User, Smartphone, Clapperboard } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ImageGallery, ImageSlotData } from "@/components/ImageGallery";
import { DownloadButton } from "@/components/DownloadButton";
import sceneryBg from "@/assets/scenery-background.jpg";
import aivatarPromoImg from "@/assets/aivatar-academy-promo.jpg";
import JSZip from "jszip";
import { getCookie, saveToLocalStorage, getFromLocalStorage, createManagedBlobUrl, revokeManagedBlobUrl, cleanupAllBlobUrls, getDetailedErrorMessage, checkBrowserCompatibility, getDeviceInfo, compressImageToFitSize } from "@/lib/storage";
import { getFunctionUrl, getFunctionHeaders } from "@/lib/backend";
import { getDisplayPlanName } from "@/lib/plans";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, THEME_OPTIONS, ThemeVariant } from "@/hooks/useTheme";
import { LoginDialog } from "@/components/LoginDialog";
import { AnimatedTitle } from "@/components/AnimatedTitle";
import { DisclaimerPopup } from "@/components/DisclaimerPopup";
import { DisclaimerFooter } from "@/components/DisclaimerFooter";
import PromoBanner from "@/components/PromoBanner";
import { ReferenceImagePreview } from "@/components/ReferenceImagePreview";
import { ImageDropZone } from "@/components/ImageDropZone";
import { LegalDialog } from "@/components/LegalDialog"; // kept for backward compat if needed
import { HomeScreen } from "@/components/HomeScreen";
import { CharacterCreator } from "@/components/CharacterCreator";
import { RegenerationSurfaceOverlay } from "@/components/RegenerationSurfaceOverlay";
import { StoryDetailPopup } from "@/components/StoryDetailPopup";
import { VideoMerger } from "@/components/VideoMerger";
import { useGenerationLimiter, incrementGeneration, decrementGeneration } from "@/hooks/useGenerationLimiter";
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
function looksLikeJsonFragment(s: string): boolean {
  if (!s) return false;
  const trimmed = s.trim();
  return /^[\{\[\]\}],?$/.test(trimmed);
}

function sanitizeSceneField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const asString = String(value).trim();
  if (!asString) return "";
  if (looksLikeJsonFragment(asString)) return "";
  return asString.replace(/^["']+|["']+$/g, '').trim();
}

function extractJsonFromAiResponse(text: string): any {
  // Step 1: Try extracting from markdown code block first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = codeBlockMatch ? codeBlockMatch[1].trim() : text;

  let cleaned = raw
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

  const tryParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      // Repair: trailing commas, control chars, unbalanced brackets
      let repaired = s
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/[\x00-\x1F\x7F]/g, '');
      
      // Balance brackets
      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/]/g) || []).length;
      repaired += '}'.repeat(Math.max(0, openBraces - closeBraces));
      repaired += ']'.repeat(Math.max(0, openBrackets - closeBrackets));
      
      return JSON.parse(repaired);
    }
  };

  return tryParse(cleaned);
}

const IMAGE_DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i;

function splitImageDataUrl(input: string): { mimeType: string; base64: string } {
  const match = input.match(IMAGE_DATA_URL_RE);
  if (match) {
    return {
      mimeType: match[1],
      base64: match[2],
    };
  }

  return {
    mimeType: "image/png",
    base64: input.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/i, ""),
  };
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (!result) {
        reject(new Error("No data URL generated"));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

const CAMERA_ANGLE_TO_INTERNAL: Record<string, string> = {
  "frontal": "frontal",
  "eye-level": "frontal",
  "seitlich": "seitlich",
  "side": "seitlich",
  "von-oben": "von-oben",
  "high-angle": "von-oben",
  "von-unten": "von-unten",
  "low-angle": "von-unten",
  "ueber-schulter": "ueber-schulter",
  "over-shoulder": "ueber-schulter",
  "dutch-angle": "dutch-angle",
  "vogelperspektive": "vogelperspektive",
  "bird-eye": "vogelperspektive",
  "froschperspektive": "froschperspektive",
  "worm-eye": "froschperspektive",
};

const SHOT_TYPE_TO_INTERNAL: Record<string, string> = {
  "extreme-close-up": "extreme-close-up",
  "close-up": "close-up",
  "medium-close-up": "medium-close-up",
  "medium-shot": "medium-shot",
  "medium-long-shot": "medium-long-shot",
  "medium-full-shot": "medium-long-shot",
  "full-shot": "full-shot",
  "long-shot": "long-shot",
  "extreme-long-shot": "extreme-long-shot",
};

function normalizeSceneCameraAngle(value: unknown): string {
  const normalized = sanitizeSceneField(value).toLowerCase();
  return CAMERA_ANGLE_TO_INTERNAL[normalized] || "";
}

function normalizeSceneShotType(value: unknown): string {
  const normalized = sanitizeSceneField(value).toLowerCase();
  return SHOT_TYPE_TO_INTERNAL[normalized] || "";
}

type StoryCharacterProfile = {
  index: number;
  imageUrl?: string;
  name: string;
  description: string;
};

type SmartReelChatMessage = {
  role: "assistant" | "user";
  text: string;
};

type SmartReelChatStep = "speech" | "platform" | "topic" | "goal" | "duration" | "done";

const VEO_REFERENCE_IMAGE_LIMIT = 3;

function normalizeCharacterIdentityToken(value: unknown): string {
  return sanitizeSceneField(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function dedupeCharacterNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    const trimmed = sanitizeSceneField(name);
    if (!trimmed) continue;
    const key = normalizeCharacterIdentityToken(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function splitParticipantNames(value: unknown): string[] {
  const raw = sanitizeSceneField(value);
  if (!raw) return [];

  return dedupeCharacterNames(
    raw
      .split(/\r?\n|,|;|\/|&|\bund\b|\band\b/gi)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function extractSpeakerNamesFromDialogText(value: unknown): string[] {
  const raw = sanitizeSceneField(value);
  if (!raw) return [];

  const speakerNames = raw
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:]{1,60}):/);
      return match ? match[1].trim() : "";
    })
    .filter(Boolean);

  return dedupeCharacterNames(speakerNames);
}

function buildStoryPointFromScene(scene: Record<string, unknown>) {
  const summary = sanitizeSceneField(scene.summary);
  const detailedDescription = sanitizeSceneField(scene.detailedDescription);
  const dialogText = sanitizeSceneField(scene.dialogText);
  const specificArea = sanitizeSceneField(scene.specificArea);
  const keyAction = sanitizeSceneField(scene.keyAction);
  const emotion = sanitizeSceneField(scene.emotion);
  const cameraAngle = normalizeSceneCameraAngle(scene.cameraAngle);
  const shotType = normalizeSceneShotType(scene.shotType);
  const participants = sanitizeSceneField(scene.participants);
  const audienceEffect = sanitizeSceneField(scene.audienceEffect);
  const composition = sanitizeSceneField(scene.composition);
  const movement = sanitizeSceneField(scene.movement);
  const negativePrompts = sanitizeSceneField(scene.negativePrompts);
  const styleNotes = sanitizeSceneField(scene.styleNotes);
  const continuityNotes = sanitizeSceneField(scene.continuityNotes);

  return {
    versions: [detailedDescription || summary || ""],
    currentVersion: 0,
    summary,
    detailedDescription,
    dialogText,
    specificArea,
    keyAction,
    emotion,
    cameraAngle,
    shotType,
    participants,
    audienceEffect,
    composition,
    movement,
    negativePrompts,
    styleNotes,
    continuityNotes,
  };
}

const REEL_DEFAULT_HOOK_DIRECTIVE = "Open with the most surprising, emotionally intense, or highest-stakes visual beat in the first second.";

function getEffectiveStoryHook(mode: "general" | "reel", hook: string): string {
  const trimmed = hook.trim();
  if (trimmed) return trimmed;
  return mode === "reel" ? REEL_DEFAULT_HOOK_DIRECTIVE : "";
}

function getVideoPromptWordTarget(mode: "general" | "reel"): string {
  return mode === "reel" ? "75-95" : "80-120";
}

function getStoryPacingInstruction(pacing: string, mode: "general" | "reel"): string {
  switch (pacing) {
    case "instant-action":
      return mode === "reel"
        ? "Immediate disruption in the first 0.5-1 second, no warm-up, no empty lead-in"
        : "Action within first 2 seconds";
    case "slow-build":
      return mode === "reel"
        ? "Only a micro build is allowed: the tension is visible instantly and pays off before the clip ends"
        : "Slow build-up over 3-5 seconds";
    case "fast-cuts":
      return mode === "reel"
        ? "Rapid contrast from clip to clip, but each clip still needs one clean focal action"
        : "Fast rapid cuts throughout";
    case "tension-arc":
    default:
      return mode === "reel"
        ? "Immediate hook, rising tension every beat, then a payoff or cliffhanger before the clip ends"
        : "Tension arc with dramatic payoff";
  }
}

function getStoryMoodInstruction(mood: string): string {
  switch (mood) {
    case "action":
      return "Dynamic and urgent, with kinetic energy and high momentum";
    case "calm":
      return "Controlled and serene, but still visually intentional";
    case "emotional":
      return "Intimate and emotionally exposed, with expressive reactions";
    case "mysterious":
      return "Shadowy, tense, and curiosity-driven";
    case "cheerful":
      return "Bright, upbeat, and highly watchable";
    case "dramatic":
    default:
      return "High-stakes, suspenseful, and emotionally charged";
  }
}

function getStoryColorInstruction(color: string, mode: "general" | "reel"): string {
  switch (color) {
    case "warm":
      return "Warm golden-hour tones";
    case "cold":
      return "Cool blue tones";
    case "dark":
      return "Dark noir contrast";
    case "bright":
      return "Bright, high-clarity lighting with strong subject separation";
    case "neon":
      return "Bold, saturated neon contrast";
    case "natural":
    default:
      return mode === "reel"
        ? "High-contrast, mobile-readable colors with clear subject separation"
        : "Natural realistic colors";
  }
}

function getReelStoryboardDirective(effectiveHook: string): string {
  return `
REEL-MODUS - KRITISCHE ANWEISUNGEN (höchste Priorität):
Du erstellst ein Storyboard für ein vertikales Social-Media-Reel (TikTok, Instagram Reels, YouTube Shorts).
Jede Szene wird zu einem kurzen Videoclip. Die exakte Gesamtdauer kommt aus dem Nutzerbriefing.

VERWENDE DIESEN HOOK ALS LEITPLANKE:
- "${effectiveHook}"

REEL-DRAMATURGIE:
- Szene 1 = DER HOOK: Muss innerhalb von 1 Sekunde visuell Aufmerksamkeit binden. Kein langsamer Aufbau.
- Jede weitere Szene = ESKALATION ODER KLARER WECHSEL: Jede Szene zeigt einen neuen Beat, neue Information oder einen sichtbaren Spannungsanstieg.
- Letzte Szene = PAYOFF ODER OFFENE FRAGE: Das Ende soll klar wirken und zum Weiterschauen motivieren.

REEL-VISUELLE REGELN:
- Genau EIN dominanter Fokus pro Szene: eine Person, eine Aktion, ein Konflikt. Keine geteilte Aufmerksamkeit.
- Handy-lesbar: Die Szene muss auch auf einem kleinen Smartphone-Screen sofort klar sein.
- Keine Filler-Shots, keine neutralen Establishing Shots, keine statischen Übergänge ohne Konflikt.
- Starker Szenenkontrast: Winkel, Entfernung, Komposition oder Machtdynamik sollen sich deutlich von der vorherigen Szene unterscheiden.
- Bewegung ist Pflicht: Kamera, Körperhaltung, Blick oder Umwelt müssen spüren lassen, dass etwas passiert.
- 9:16-Komposition: Gesichter, Hände und Kernaktion müssen in der vertikalen Safe Zone klar sichtbar bleiben.

REEL-INHALTLICHE REGELN:
- Denke in aufmerksamkeitsstarken Momenten, nicht in langsamer Exposition.
- Bevorzuge klare Emotionen und klare Bildsignale statt subtiler Andeutungen.
- Jede Szene muss ohne Ton verstaendlich sein.
- Jede Szene soll visuell die Frage beantworten: Warum schaut man weiter?
`;
}

function getReelVideoPromptDirective(effectiveHook: string): string {
  return `
REEL MODE - CRITICAL PRIORITY:
This video is for a vertical 9:16 social media reel (TikTok/Instagram Reels/YouTube Shorts).
Each scene is a short beat-sized clip. The exact total runtime is defined by the user brief.
Use this hook directive as the north star: "${effectiveHook}"

RULES FOR REEL PROMPTS:
- The first 0.5-1 second must land on the strongest visual beat, not an intro
- One focal subject, one focal action, one emotional read per clip
- No slow establishing shots, no idle camera settle, no filler gestures
- Movement must begin immediately but remain clean and readable
- Vertical composition: keep the core action large, obvious, and mobile-readable
- Protect subject clarity: background and props are secondary to the main beat
- Build a pattern interrupt from the previous clip through scale, angle, motion, or power shift
- End on a payoff frame or an unanswered question that pulls into the next clip
- Strong contrast, strong silhouettes, strong facial readability, strong emotional intent
`;
}

function sanitizeStoryPointsForSession(points: any[]): any[] {
  return points.map((point) => {
    const safePoint = { ...point };

    if (typeof safePoint.generatedImage === "string" && /^blob:|^data:/i.test(safePoint.generatedImage)) {
      delete safePoint.generatedImage;
    }
    if (typeof safePoint.generatedVideo === "string" && /^blob:|^data:/i.test(safePoint.generatedVideo)) {
      delete safePoint.generatedVideo;
    }

    if (Array.isArray(safePoint.sceneVersions)) {
      safePoint.sceneVersions = safePoint.sceneVersions.map((snapshot: Record<string, unknown>) => {
        const cleanSnapshot = { ...snapshot };
        if (typeof cleanSnapshot.generatedImage === "string" && /^blob:|^data:/i.test(cleanSnapshot.generatedImage)) {
          delete cleanSnapshot.generatedImage;
        }
        if (typeof cleanSnapshot.generatedVideo === "string" && /^blob:|^data:/i.test(cleanSnapshot.generatedVideo)) {
          delete cleanSnapshot.generatedVideo;
        }
        return cleanSnapshot;
      });
    }

    return safePoint;
  });
}

function parseStoryPointsFromSession(raw: string): any[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return sanitizeStoryPointsForSession(parsed);
}

function classifyRetryableSceneError(errorMessage: string): "retryable" | "non_retryable" {
  const lower = errorMessage.toLowerCase();
  if (
    lower.includes("api-key") ||
    lower.includes("ungültige anfrage") ||
    lower.includes("ungueltige anfrage") ||
    lower.includes("zugriff verweigert") ||
    lower.includes("sicherheitsfilter") ||
    lower.includes("safety")
  ) {
    return "non_retryable";
  }
  return "retryable";
}

function getVideoModelCandidates(selected: string): string[] {
  const map: Record<string, string[]> = {
    veo3: ["veo-3.1-generate-preview", "veo-3.1-fast-generate-preview"],
    veo2: ["veo-2.0-generate-preview", "veo-2.0-fast-generate-preview", "veo-3.1-fast-generate-preview"],
    kling: ["veo-3.1-fast-generate-preview", "veo-3.1-generate-preview"],
  };
  return map[selected] || map.veo3;
}

function mapStoryModelLabel(selected: string): string {
  if (selected === "veo2") return "veo2";
  if (selected === "kling") return "kling-kompatibel";
  return "veo3";
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
  const navigate = useNavigate();
  const { authData, isLoading: authLoading, login, logout } = useAuth();
  
  // Helper: Check if user has Pro-level access (PREMIUM or FULL)
  const isPro = authData.planCode === "PREMIUM" || authData.planCode === "FULL";
  const isFullPlan = authData.planCode === "FULL";
  const displayPlanName = getDisplayPlanName(authData.planCode, authData.planName);
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
  const [upgradePopupType, setUpgradePopupType] = useState<"pro" | "premium">("pro");
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
    "Winken und grüÜen"
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
  const [storyReferenceLabels, setStoryReferenceLabels] = useState<string[]>(() => {
    const saved = getFromLocalStorage('storyReferenceLabels');
    return saved || [];
  });
  const [storyReferenceDescriptions, setStoryReferenceDescriptions] = useState<string[]>(() => {
    const saved = getFromLocalStorage('storyReferenceDescriptions');
    return saved || [];
  });
  const storyCharacterProfiles: StoryCharacterProfile[] = storyReferenceImages.map((imageUrl, index) => {
    const fallbackName = `Person ${index + 1}`;
    const name = sanitizeSceneField(storyReferenceLabels[index]) || fallbackName;
    const description = sanitizeSceneField(storyReferenceDescriptions[index]);
    return {
      index,
      imageUrl,
      name,
      description,
    };
  });
  const storyCharacterProfilesGermanBlock = storyCharacterProfiles.length > 0
    ? storyCharacterProfiles
        .map((profile) => `- ${profile.name} (Referenzbild ${profile.index + 1})${profile.description ? `: ${profile.description}` : ""}`)
        .join('\n')
    : "- Keine Referenzcharaktere vorhanden";
  const [smartReelModeEnabled, setSmartReelModeEnabled] = useState(false);
  const [smartReelTranscript, setSmartReelTranscript] = useState("");
  const [smartReelStyleImages, setSmartReelStyleImages] = useState<string[]>(() => {
    const saved = getFromLocalStorage('smartReelStyleImages');
    return saved || [];
  });
  const [smartReelStyleDescriptions, setSmartReelStyleDescriptions] = useState<string[]>(() => {
    const saved = getFromLocalStorage('smartReelStyleDescriptions');
    return saved || [];
  });
  const [smartReelReferenceSummary, setSmartReelReferenceSummary] = useState("");
  const [smartReelPlatform, setSmartReelPlatform] = useState<"" | "instagram" | "youtube" | "tiktok">("");
  const [smartReelTopic, setSmartReelTopic] = useState("");
  const [smartReelGoal, setSmartReelGoal] = useState("");
  const [smartReelDuration, setSmartReelDuration] = useState<"" | "15-30" | "30-60" | "60+">("");
  const [smartReelSpeechMode, setSmartReelSpeechMode] = useState<"" | "speaker" | "avatars">("");
  const [smartReelChatMessages, setSmartReelChatMessages] = useState<SmartReelChatMessage[]>([]);
  const [smartReelChatStep, setSmartReelChatStep] = useState<SmartReelChatStep>("speech");
  const [smartReelChatInput, setSmartReelChatInput] = useState("");
  const [isAnalyzingSmartReelReferences, setIsAnalyzingSmartReelReferences] = useState(false);
  const smartReelStyleDescriptionsRef = useRef<string[]>(smartReelStyleDescriptions);
  const smartReelReferenceSummaryRef = useRef(smartReelReferenceSummary);
  const maxStoryReferenceImages = smartReelModeEnabled ? VEO_REFERENCE_IMAGE_LIMIT : 2;
  const maxSmartReelStyleImages = 3;
  const smartReelPlatformLabel = smartReelPlatform === "instagram"
    ? "Instagram Reels"
    : smartReelPlatform === "youtube"
      ? "YouTube Shorts"
      : smartReelPlatform === "tiktok"
        ? "TikTok"
        : "";
  const smartReelDurationLabel = smartReelDuration === "15-30"
    ? "15 bis 30 Sekunden"
    : smartReelDuration === "30-60"
      ? "30 bis 60 Sekunden"
      : smartReelDuration === "60+"
        ? "60+ Sekunden"
        : "";
  const smartReelSpeechLabel = smartReelSpeechMode === "speaker"
    ? "Separater Sprecher"
    : smartReelSpeechMode === "avatars"
      ? "Avatare sprechen selbst"
      : "";
  const smartReelStyleBlockGerman = smartReelStyleDescriptions
    .map((description, index) => sanitizeSceneField(description) ? `- Stilbild ${index + 1}: ${sanitizeSceneField(description)}` : "")
    .filter(Boolean)
    .join('\n');
  const smartReelStyleBlockEnglish = smartReelStyleDescriptions
    .map((description, index) => sanitizeSceneField(description) ? `- Style reference ${index + 1}: ${sanitizeSceneField(description)}` : "")
    .filter(Boolean)
    .join('\n');
  const smartReelBriefSummary = [
    smartReelPlatformLabel ? `Plattform: ${smartReelPlatformLabel}` : null,
    smartReelSpeechLabel ? `Sprechmodus: ${smartReelSpeechLabel}` : null,
    smartReelTopic.trim() ? `Thema: ${smartReelTopic.trim()}` : null,
    smartReelGoal.trim() ? `Ziel: ${smartReelGoal.trim()}` : null,
    smartReelDurationLabel ? `Länge: ${smartReelDurationLabel}` : null,
  ].filter(Boolean).join(' | ');
  const smartReelIdeaSeed = [
    smartReelTopic.trim() ? `Thema: ${smartReelTopic.trim()}` : null,
    smartReelGoal.trim() ? `Fokus: ${smartReelGoal.trim()}` : null,
    smartReelPlatformLabel ? `Plattform: ${smartReelPlatformLabel}` : null,
    smartReelSpeechLabel ? `Sprechmodus: ${smartReelSpeechLabel}` : null,
    smartReelDurationLabel ? `Ziellänge: ${smartReelDurationLabel}` : null,
    smartReelTranscript.trim() ? "Nutze das Referenz-Transcript nur als Vorbild für Hook, Rhythmus und Dramaturgie, nicht für 1:1-Kopie." : null,
  ].filter(Boolean).join('\n');
  const smartReelContextBlock = smartReelModeEnabled
    ? [
        "SMART-REEL-KONTEXT:",
        smartReelPlatformLabel ? `- Zielplattform: ${smartReelPlatformLabel}` : null,
        smartReelSpeechLabel ? `- Sprechmodus: ${smartReelSpeechLabel}` : null,
        smartReelTopic.trim() ? `- Zielthema: ${smartReelTopic.trim()}` : null,
        smartReelGoal.trim() ? `- Gewünschter Fokus / Outcome: ${smartReelGoal.trim()}` : null,
        smartReelDurationLabel ? `- Gewünschte Länge: ${smartReelDurationLabel}` : null,
        smartReelTranscript.trim() ? `- Referenz-Transcript:\n${smartReelTranscript.trim()}` : null,
        storyCharacterProfiles.length > 0 ? `- Charakter-Referenzen:\n${storyCharacterProfilesGermanBlock}` : null,
        smartReelStyleBlockGerman ? `- Stil-Referenzen:\n${smartReelStyleBlockGerman}` : null,
        smartReelReferenceSummary.trim() ? `- Visuelle Gesamtanalyse: ${smartReelReferenceSummary.trim()}` : null,
        "- Wichtig: Nutze das Referenzmaterial nur als Qualitäts-, Hook- und Stilvorbild. Nie Handlung, Formulierungen oder Aufbau 1:1 kopieren.",
      ].filter(Boolean).join('\n')
    : "";
  const smartReelVisualLockEnglish = smartReelModeEnabled
    ? [
        smartReelReferenceSummary.trim() ? `OVERALL REFERENCE DIRECTION: ${smartReelReferenceSummary.trim()}` : null,
        smartReelStyleBlockEnglish ? `STYLE REFERENCE LOCK:\n${smartReelStyleBlockEnglish}` : null,
        smartReelPlatformLabel ? `TARGET PLATFORM: ${smartReelPlatformLabel}` : null,
        smartReelTranscript.trim() ? "REFERENCE TRANSCRIPT: use only for pacing, hook mechanics, and clarity. Never copy wording or plot 1:1." : null,
      ].filter(Boolean).join('\n')
    : "";
  const buildSmartReelStyleBlockGermanFromValues = (descriptions: string[]) =>
    descriptions
      .map((description, index) => sanitizeSceneField(description) ? `- Stilbild ${index + 1}: ${sanitizeSceneField(description)}` : "")
      .filter(Boolean)
      .join('\n');
  const buildSmartReelStyleBlockEnglishFromValues = (descriptions: string[]) =>
    descriptions
      .map((description, index) => sanitizeSceneField(description) ? `- Style reference ${index + 1}: ${sanitizeSceneField(description)}` : "")
      .filter(Boolean)
      .join('\n');
  const buildSmartReelVisualLockEnglishFromValues = (
    descriptions: string[] = smartReelStyleDescriptionsRef.current,
    overallDirection: string = smartReelReferenceSummaryRef.current
  ) => {
    if (!smartReelModeEnabled) return "";
    const styleBlock = buildSmartReelStyleBlockEnglishFromValues(descriptions);
    return [
      sanitizeSceneField(overallDirection) ? `OVERALL REFERENCE DIRECTION: ${sanitizeSceneField(overallDirection)}` : null,
      styleBlock ? `STYLE REFERENCE LOCK:\n${styleBlock}` : null,
      smartReelPlatformLabel ? `TARGET PLATFORM: ${smartReelPlatformLabel}` : null,
      smartReelTranscript.trim() ? "REFERENCE TRANSCRIPT: use only for pacing, hook mechanics, and clarity. Never copy wording or plot 1:1." : null,
    ].filter(Boolean).join('\n');
  };
  const findStoryCharacterProfile = (value: unknown): StoryCharacterProfile | null => {
    const normalized = normalizeCharacterIdentityToken(value);
    if (!normalized) return null;
    return storyCharacterProfiles.find((profile) => normalizeCharacterIdentityToken(profile.name) === normalized) || null;
  };
  const resolveSceneCharacterProfiles = (point?: { participants?: string; dialogText?: string; continuityNotes?: string } | null): StoryCharacterProfile[] => {
    if (storyCharacterProfiles.length === 0) return [];

    const matchedProfiles: StoryCharacterProfile[] = [];
    const matchedIndexes = new Set<number>();
    const addProfileByName = (name: string) => {
      const profile = findStoryCharacterProfile(name);
      if (!profile || matchedIndexes.has(profile.index)) return;
      matchedIndexes.add(profile.index);
      matchedProfiles.push(profile);
    };

    if (point) {
      splitParticipantNames(point.participants).forEach(addProfileByName);
      extractSpeakerNamesFromDialogText(point.dialogText).forEach(addProfileByName);
    }

    if (matchedProfiles.length > 0) return matchedProfiles;
    if (storyCharacterProfiles.length === 1) return [storyCharacterProfiles[0]];
    return storyCharacterProfiles;
  };
  const buildEnglishCharacterIdentityBlock = (point?: { participants?: string; dialogText?: string; continuityNotes?: string } | null) => {
    const profiles = resolveSceneCharacterProfiles(point);
    if (profiles.length === 0) return "";

    const lines = [
      "CHARACTER REFERENCE LOCK:",
      ...profiles.map((profile) => `- Reference image ${profile.index + 1} = "${profile.name}"${profile.description ? ` (${profile.description})` : ""}`),
      point?.participants
        ? `- Scene participants: ${point.participants}. Only these named characters should appear in this scene.`
        : `- Scene participants: ${profiles.map((profile) => `"${profile.name}"`).join(", ")}.`,
      "- Never swap identities, faces, outfits, or accessories between names or reference images.",
      "- Keep each named character's face, hair, body type, clothing, accessories, and distinctive traits tied to the same reference image in every scene.",
      point?.continuityNotes ? `- Continuity notes: ${point.continuityNotes}` : null,
    ].filter(Boolean);

    return lines.join('\n');
  };
  const buildDialogIdentityInstruction = (dialogText?: string) => {
    const cleanDialog = sanitizeSceneField(dialogText);
    if (!cleanDialog) {
      return storyEnableSpeaker
        ? ""
        : '\nIMPORTANT: NO dialogue or speech ? the character does NOT speak in this scene. No lip movement, no voiceover. The scene is completely silent with no spoken words.';
    }

    const speakerNames = extractSpeakerNamesFromDialogText(cleanDialog);
    if (speakerNames.length > 0) {
      return `\nDIALOG: Preserve the exact speaker labels and spoken words in the original language. The matching named character must speak each labeled line exactly as written. Speakers in this scene: ${speakerNames.map((name) => `"${name}"`).join(", ")}. Do NOT translate or rewrite: "${cleanDialog}"`;
    }

    return `\nDIALOG: The character must visibly speak these EXACT words (original language, do NOT translate): "${cleanDialog}"`;
  };
  
  // Storyboard state
  const [storyPointCount, setStoryPointCount] = useState(2);
  const [storyCreatorMode, setStoryCreatorMode] = useState<"general" | "reel">("general");
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
  const activeRegenerationController = useRef<AbortController | null>(null);
  const [showRegenerationCloseWarning, setShowRegenerationCloseWarning] = useState(false);
  const [justFinishedIndex, setJustFinishedIndex] = useState<number | null>(null);
  const [justFinishedImageOnlyIndex, setJustFinishedImageOnlyIndex] = useState<number | null>(null); // For image-only flip back
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const [isGeneratingStoryImages, setIsGeneratingStoryImages] = useState(false);
  const [generatingStoryImageIndex, setGeneratingStoryImageIndex] = useState<number | null>(null);
  type StoryboardHoverHighlight =
    | { scope: "card" | "media" | "all-cards" | "all-media"; label: string; index?: number }
    | null;
  const [storyboardHoverHighlight, setStoryboardHoverHighlight] = useState<StoryboardHoverHighlight>(null);
  const getStoryboardCardHoverLabel = (index: number) => {
    if (!storyboardHoverHighlight) return null;
    if (storyboardHoverHighlight.scope === "all-cards") return storyboardHoverHighlight.label;
    if (storyboardHoverHighlight.scope === "card" && storyboardHoverHighlight.index === index) {
      return storyboardHoverHighlight.label;
    }
    return null;
  };
  const getStoryboardMediaHoverLabel = (index: number) => {
    if (!storyboardHoverHighlight) return null;
    if (storyboardHoverHighlight.scope === "all-media") return storyboardHoverHighlight.label;
    if (storyboardHoverHighlight.scope === "media" && storyboardHoverHighlight.index === index) {
      return storyboardHoverHighlight.label;
    }
    return null;
  };
  
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
  // "sprecher" = Erzähler/Voiceover, "dialog" = Gespräch zwischen Charakteren
  const [storyVoiceMode, setStoryVoiceMode] = useState<"sprecher" | "dialog">("sprecher");
  // "speaker-from-description" = KI generiert Sprechertext aus Szenenbeschreibung
  // "description-from-speaker" = KI generiert Szenenbeschreibung aus Sprechertext
  const [storyGenerationDirection, setStoryGenerationDirection] = useState<"speaker-from-description" | "description-from-speaker">("speaker-from-description");
  const [storyVideoModel, setStoryVideoModel] = useState("veo3");
  const [storyArtStyle, setStoryArtStyle] = useState("realistic");
  const [storyTransitionType, setStoryTransitionType] = useState("hard-cut");
  const [storyCustomDetails, setStoryCustomDetails] = useState("");
  const [storySetupCollapsed, setStorySetupCollapsed] = useState(false);
  
  // Extended story controls
  const [storySpeakerGender, setStorySpeakerGender] = useState<"male" | "female" | "neutral">("neutral");
  const [storyVideoMood, setStoryVideoMood] = useState<string>("dramatic");
  const [storyColorMood, setStoryColorMood] = useState<string>("natural");
  const [storyHook, setStoryHook] = useState("");
  const [storyPacing, setStoryPacing] = useState<string>("tension-arc");
  
  // Scene Edit Popup - Tab-based UI state
  const [sceneEditTab, setSceneEditTab] = useState<"content" | "image" | "video">("content");
  
  // AI Assistant update mode: "text" = nur Text, "camera" = nur Kamera, "image" = nur Bild neu, "both" = beides
  const [sceneAiMode, setSceneAiMode] = useState<"text" | "camera" | "image" | "both">("text");
  
  // Global generation limiter
  const { limitReached: generationLimitReached } = useGenerationLimiter();

  // Derived values for backward compatibility
  const sceneAiUpdateText = sceneAiMode === "text" || sceneAiMode === "both";
  const sceneAiUpdateCamera = sceneAiMode === "camera" || sceneAiMode === "both";
  const sceneAiRegenerateImage = sceneAiMode === "image" || sceneAiMode === "both";
  const effectiveStoryHook = getEffectiveStoryHook(storyCreatorMode, storyHook);

  // ============= SESSION PERSISTENCE =============
  // Save key state to sessionStorage so users can return to their work
  useEffect(() => {
    try {
      sessionStorage.setItem('session_storyIdea', storyIdea);
    } catch {}
  }, [storyIdea]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_storyCustomDetails', storyCustomDetails);
    } catch {}
  }, [storyCustomDetails]);

  useEffect(() => { try { sessionStorage.setItem('session_storySpeakerGender', storySpeakerGender); } catch {} }, [storySpeakerGender]);
  useEffect(() => { try { sessionStorage.setItem('session_storyVideoMood', storyVideoMood); } catch {} }, [storyVideoMood]);
  useEffect(() => { try { sessionStorage.setItem('session_storyColorMood', storyColorMood); } catch {} }, [storyColorMood]);
  useEffect(() => { try { sessionStorage.setItem('session_storyHook', storyHook); } catch {} }, [storyHook]);
  useEffect(() => { try { sessionStorage.setItem('session_storyPacing', storyPacing); } catch {} }, [storyPacing]);
  useEffect(() => { try { sessionStorage.setItem('session_storyCreatorMode', storyCreatorMode); } catch {} }, [storyCreatorMode]);
  useEffect(() => { smartReelStyleDescriptionsRef.current = smartReelStyleDescriptions; }, [smartReelStyleDescriptions]);
  useEffect(() => { smartReelReferenceSummaryRef.current = smartReelReferenceSummary; }, [smartReelReferenceSummary]);
  useEffect(() => { try { sessionStorage.setItem('session_smartReelModeEnabled', String(smartReelModeEnabled)); } catch {} }, [smartReelModeEnabled]);
  useEffect(() => { try { sessionStorage.setItem('session_smartReelTranscript', smartReelTranscript); } catch {} }, [smartReelTranscript]);
  useEffect(() => { try { sessionStorage.setItem('session_smartReelReferenceSummary', smartReelReferenceSummary); } catch {} }, [smartReelReferenceSummary]);
  useEffect(() => { try { sessionStorage.setItem('session_smartReelPlatform', smartReelPlatform); } catch {} }, [smartReelPlatform]);
  useEffect(() => { try { sessionStorage.setItem('session_smartReelTopic', smartReelTopic); } catch {} }, [smartReelTopic]);
  useEffect(() => { try { sessionStorage.setItem('session_smartReelGoal', smartReelGoal); } catch {} }, [smartReelGoal]);
  useEffect(() => { try { sessionStorage.setItem('session_smartReelDuration', smartReelDuration); } catch {} }, [smartReelDuration]);
  useEffect(() => { try { sessionStorage.setItem('session_smartReelSpeechMode', smartReelSpeechMode); } catch {} }, [smartReelSpeechMode]);
  useEffect(() => {
    try {
      sessionStorage.setItem('session_smartReelChatMessages', JSON.stringify(smartReelChatMessages));
    } catch {}
  }, [smartReelChatMessages]);
  useEffect(() => { try { sessionStorage.setItem('session_smartReelChatStep', smartReelChatStep); } catch {} }, [smartReelChatStep]);

  const handleStoryCreatorModeChange = (mode: "general" | "reel") => {
    setStoryCreatorMode(mode);
    if (mode === "reel") {
      setStoryboardFormat("9:16");
      setStoryPacing("instant-action");
      setStoryVideoMood("dramatic");
      setStoryColorMood("bright");
      setStoryTransitionType("hard-cut");
      if (storyPointCount < 3) setStoryPointCount(3);
      if (storyPointCount > 6) setStoryPointCount(6);
    } else {
      setSmartReelModeEnabled(false);
    }
  };

  useEffect(() => {
    if (storyCreatorMode === "reel" && smartReelModeEnabled && smartReelChatMessages.length === 0) {
      startSmartReelChat();
    }
  }, [storyCreatorMode, smartReelModeEnabled, smartReelChatMessages.length]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_storyArtStyle', storyArtStyle);
    } catch {}
  }, [storyArtStyle]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_storyPointCount', String(storyPointCount));
    } catch {}
  }, [storyPointCount]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_sceneDescription', sceneDescription);
    } catch {}
  }, [sceneDescription]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_customPrompt', customPrompt);
    } catch {}
  }, [customPrompt]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_selectedBackground', selectedBackground);
    } catch {}
  }, [selectedBackground]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_activeView', activeView);
    } catch {}
  }, [activeView]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_activeMainTab', activeMainTab);
    } catch {}
  }, [activeMainTab]);

  useEffect(() => {
    try {
      if (storyPoints.length > 0) {
        const safeStoryPoints = sanitizeStoryPointsForSession(storyPoints);
        sessionStorage.setItem('session_storyPoints', JSON.stringify(safeStoryPoints));
      } else {
        sessionStorage.removeItem('session_storyPoints');
      }
    } catch {}
  }, [storyPoints]);

  useEffect(() => {
    try {
      if (characterImages.length > 0) {
        sessionStorage.setItem('session_characterImages', JSON.stringify(characterImages));
      }
    } catch {}
  }, [characterImages]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_storyboardMainLocation', storyboardMainLocation);
    } catch {}
  }, [storyboardMainLocation]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_storyEnableSpeaker', String(storyEnableSpeaker));
    } catch {}
  }, [storyEnableSpeaker]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_storyVoiceMode', storyVoiceMode);
    } catch {}
  }, [storyVoiceMode]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_storyGenerationDirection', storyGenerationDirection);
    } catch {}
  }, [storyGenerationDirection]);

  useEffect(() => {
    try {
      sessionStorage.setItem('session_storyboardFormat', storyboardFormat);
    } catch {}
  }, [storyboardFormat]);

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

  const SCENE_ASSISTANT_ENUM_OPTIONS = {
    cameraAngle: [
      { value: "frontal", label: "Frontal" },
      { value: "seitlich", label: "Seitlich", aliases: ["profil"] },
      { value: "von-oben", label: "Von oben", aliases: ["high-angle"] },
      { value: "von-unten", label: "Von unten", aliases: ["low-angle"] },
      { value: "ueber-schulter", label: "Über die Schulter", aliases: ["over-the-shoulder", "shoulder"] },
      { value: "dutch-angle", label: "Dutch Angle", aliases: ["dutch", "canted-angle"] },
      { value: "vogelperspektive", label: "Vogelperspektive", aliases: ["birds-eye-view", "birds-eye", "bird-eye-view"] },
      { value: "froschperspektive", label: "Froschperspektive", aliases: ["worms-eye-view", "worms-eye", "worm-eye-view"] },
    ],
    shotType: [
      { value: "extreme-close-up", label: "Extreme Close-Up", aliases: ["ecu"] },
      { value: "close-up", label: "Close-Up" },
      { value: "medium-close-up", label: "Medium Close-Up" },
      { value: "medium-shot", label: "Medium Shot" },
      { value: "medium-long-shot", label: "Medium Long Shot" },
      { value: "full-shot", label: "Full Shot" },
      { value: "long-shot", label: "Long Shot", aliases: ["wide-shot"] },
      { value: "extreme-long-shot", label: "Extreme Long Shot", aliases: ["establishing-shot"] },
    ],
    keyAction: [
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
      { value: "wendet-sich", label: "Wendet sich", aliases: ["dreht-sich-um"] },
    ],
    specificArea: [
      { value: "innenraum", label: "Innenraum" },
      { value: "aussenbereich", label: "Außenbereich" },
      { value: "strasse", label: "Straße" },
      { value: "natur", label: "Natur" },
      { value: "arbeitsplatz", label: "Arbeitsplatz" },
      { value: "zuhause", label: "Zuhause" },
      { value: "fahrzeug", label: "Fahrzeug" },
      { value: "oeffentlicher-ort", label: "Öffentlicher Ort", aliases: ["oeffentlicher-platz", "public-place"] },
    ],
    emotion: [
      { value: "gluecklich", label: "Glücklich" },
      { value: "traurig", label: "Traurig" },
      { value: "nachdenklich", label: "Nachdenklich" },
      { value: "aufgeregt", label: "Aufgeregt" },
      { value: "aengstlich", label: "Ängstlich" },
      { value: "wuetend", label: "Wütend", aliases: ["zornig"] },
      { value: "ueberrascht", label: "Überrascht" },
      { value: "verliebt", label: "Verliebt" },
      { value: "verzweifelt", label: "Verzweifelt" },
      { value: "hoffnungsvoll", label: "Hoffnungsvoll" },
      { value: "melancholisch", label: "Melancholisch" },
      { value: "entspannt", label: "Entspannt" },
      { value: "neutral", label: "Neutral" },
    ],
    audienceEffect: [
      { value: "spannung", label: "Spannung" },
      { value: "empathie", label: "Empathie" },
      { value: "freude", label: "Freude" },
      { value: "unbehagen", label: "Unbehagen" },
      { value: "neugier", label: "Neugier" },
      { value: "erleichterung", label: "Erleichterung" },
      { value: "trauer", label: "Trauer" },
      { value: "hoffnung", label: "Hoffnung" },
    ],
    composition: [
      { value: "zentriert", label: "Zentriert" },
      { value: "drittel-regel", label: "Drittel-Regel", aliases: ["regel-der-drittel", "rule-of-thirds"] },
      { value: "symmetrisch", label: "Symmetrisch" },
      { value: "diagonal", label: "Diagonal" },
      { value: "rahmen-im-rahmen", label: "Rahmen im Rahmen", aliases: ["frame-within-frame"] },
    ],
    movement: [
      { value: "keine", label: "Keine", aliases: ["still"] },
      { value: "dolly-in", label: "Dolly-In" },
      { value: "dolly-out", label: "Dolly-Out" },
      { value: "truck", label: "Truck" },
      { value: "tilt", label: "Tilt" },
      { value: "pan", label: "Pan" },
      { value: "crane", label: "Crane" },
      { value: "arc", label: "Arc" },
    ],
  } as const;

  type SceneAssistantEnumField = keyof typeof SCENE_ASSISTANT_ENUM_OPTIONS;

  const normalizeSceneAssistantToken = (value: unknown) => String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const sanitizeSceneAssistantText = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    const normalized = normalizeSceneAssistantToken(text);
    if (!text || !normalized) return null;
    if (["null", "undefined", "unveraendert", "unchanged", "same", "keine-aenderung"].includes(normalized)) {
      return null;
    }
    return text;
  };

  const normalizeSceneAssistantEnumValue = (
    field: SceneAssistantEnumField,
    value: unknown
  ): string | "" | undefined => {
    const text = sanitizeSceneAssistantText(value);
    if (text === null) return undefined;

    const normalized = normalizeSceneAssistantToken(text);
    if (["_auto_", "auto", "random", "zufällig", "zufallig", "zufaellig", "von-ki-wählen-lassen", "ki-wählen-lassen", "von-ki-waehlen-lassen", "ki-waehlen-lassen"].includes(normalized)) {
      return "";
    }

    for (const option of SCENE_ASSISTANT_ENUM_OPTIONS[field]) {
      const candidates = [option.value, option.label, ...('aliases' in option ? option.aliases : [])].map(normalizeSceneAssistantToken);
      if (candidates.includes(normalized)) {
        return option.value;
      }
    }

    return undefined;
  };

  const formatSceneAssistantEnumOptions = (field: SceneAssistantEnumField) =>
    SCENE_ASSISTANT_ENUM_OPTIONS[field]
      .map((option) => `- "${option.value}": ${option.label}`)
      .join('\n');

  const handleSceneAssistant = async () => {
    const userInstruction = sceneAssistantInput.trim();
    if (!canGenerate || expandedStoryPointIndex === null || isGeneratingSceneAssistant || !userInstruction) return;

    const idx = expandedStoryPointIndex;
    const currentPoint = storyPoints[idx];
    const previousPoint = idx > 0 ? storyPoints[idx - 1] : null;
    const nextPoint = idx < storyPoints.length - 1 ? storyPoints[idx + 1] : null;

    const formatSceneContext = (
      label: string,
      point: typeof storyPoints[number] | null,
      pointIndex?: number
    ) => {
      if (!point) {
        return `${label}: keine Szene vorhanden`;
      }

      const description = point.detailedDescription || point.versions[point.currentVersion] || "";
      const lines = [
        `${label}${typeof pointIndex === "number" ? ` (Szene ${pointIndex + 1})` : ""}:`,
        `- Summary: ${point.summary || "nicht gesetzt"}`,
        `- Beschreibung: ${description || "nicht gesetzt"}`,
        storyEnableSpeaker ? `- Dialog: ${point.dialogText || "nicht gesetzt"}` : null,
        `- Aktion: ${point.keyAction || "nicht gesetzt"}`,
        `- Bereich: ${point.specificArea || "nicht gesetzt"}`,
        `- Emotion: ${point.emotion || "nicht gesetzt"}`,
        `- Publikumswirkung: ${point.audienceEffect || "nicht gesetzt"}`,
        `- Kamerawinkel: ${point.cameraAngle || "nicht gesetzt"}`,
        `- Shot-Typ: ${point.shotType || "nicht gesetzt"}`,
        `- Bildaufbau: ${point.composition || "nicht gesetzt"}`,
        `- Bewegung: ${point.movement || "nicht gesetzt"}`,
        `- Kontinuität: ${point.continuityNotes || "nicht gesetzt"}`,
      ].filter(Boolean);

      return lines.join("\n");
    };

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
                text: `Du bist ein Storyboard-Regieassistent für genau eine Szene.

Du bekommst die aktuelle Szene eines Storyboards und eine freie Nutzeranweisung wie:
- "Mach die Geschichte cooler"
- "Mach die Szene filmischer"
- "Mehr Spannung"
- "Mach den Moment emotionaler"

Deine Aufgabe:
- Interpretiere breite kreative Anweisungen ganzheitlich.
- Wenn die Anweisung allgemein ist, passe mehrere zusammenhängende Felder dieser Szene an.
- Wenn die Anweisung gezielt ist, ändere nur die betroffenen Felder.
- Halte die Szene konsistent zur Story-Idee, zum Hauptort und zu den Nachbarszenen.
- Du bearbeitest nur diese eine Szene, nicht das ganze Storyboard.
${storyCreatorMode === "reel" ? `

REEL-MODUS:
- Optimiere auf Hook in Sekunde 1, sofortige Lesbarkeit auf dem Handy und genau einen dominanten Fokus.
- Vermeide Filler, statische Einleitungen, unklare Mehrfachaktionen und visuelle Unentschlossenheit.
- Wenn du summary, detailedDescription, composition, movement oder videoPrompt anfasst, priorisiere scroll-stopping Klarheit.
- Jede Änderung soll das Weiterschauen wahrscheinlicher machen.` : ""}

STORY-KONTEXT:
- Story-Idee: ${storyIdea || "nicht gesetzt"}
- Hauptort: ${storyboardMainLocation || "nicht gesetzt"}
- Dialog aktiviert: ${storyEnableSpeaker ? "ja" : "nein"}
${storyCharacterProfiles.length > 0 ? `- Referenzcharaktere:\n${storyCharacterProfilesGermanBlock}` : ""}

${formatSceneContext("Vorherige Szene", previousPoint, idx - 1)}

${formatSceneContext("Aktuelle Szene", currentPoint, idx)}
- Video-Prompt: ${currentPoint.videoPrompt || "nicht gesetzt"}
- Negative Prompts: ${currentPoint.negativePrompts || "nicht gesetzt"}
- Stil-Hinweise: ${currentPoint.styleNotes || "nicht gesetzt"}

${formatSceneContext("Nächste Szene", nextPoint, idx + 1)}

NUTZERANWEISUNG:
"${userInstruction}"

FELDER, DIE DU FÜR DIESE SZENE ANPASSEN DARFST:
- summary
- detailedDescription
- dialogText
- videoPrompt
- cameraAngle
- shotType
- keyAction
- specificArea
- emotion
- audienceEffect
- composition
- movement
- negativePrompts
- styleNotes
- continuityNotes

ENUM-REGELN:
- Verwende für Enum-Felder nur die unten aufgeführten values.
- Wenn du das Feld absichtlich wieder auf "von KI wählen lassen" setzen willst, verwende "_auto_".
- Wenn ein Feld unverändert bleiben soll, setze es auf null.

GÜLTIGE VALUES:
cameraAngle:
${formatSceneAssistantEnumOptions("cameraAngle")}

shotType:
${formatSceneAssistantEnumOptions("shotType")}

keyAction:
${formatSceneAssistantEnumOptions("keyAction")}

specificArea:
${formatSceneAssistantEnumOptions("specificArea")}

emotion:
${formatSceneAssistantEnumOptions("emotion")}

audienceEffect:
${formatSceneAssistantEnumOptions("audienceEffect")}

composition:
${formatSceneAssistantEnumOptions("composition")}

movement:
${formatSceneAssistantEnumOptions("movement")}

WICHTIGE REGELN:
1. summary und detailedDescription sind auf Deutsch.
2. dialogText ist nur gesprochener Text der Szene und ebenfalls auf Deutsch.
3. Wenn Dialog deaktiviert ist, muss dialogText null sein.
4. videoPrompt ist auf Englisch.
5. continuityNotes beschreibt nur Kontinuität zu anderen Szenen, Requisiten, Kleidung, Blickrichtung, Pose oder Raumlogik.
6. Wenn die Nutzeranweisung breit ist, denke wie eine Regie-Notiz und aktualisiere mehrere passende Felder gemeinsam.
7. Ändere nichts außerhalb dieser Szene.
8. Gib keine leeren Strings aus. Nur sinnvoller Text oder null.
9. Wenn Referenzcharaktere vorhanden sind, erfinde keine neuen Namen und ändere keine feste Zuordnung zwischen Name und Referenzfigur.

Antworte NUR mit einem validen JSON-Objekt in genau dieser Form:
{
  "summary": string | null,
  "detailedDescription": string | null,
  "dialogText": string | null,
  "videoPrompt": string | null,
  "cameraAngle": string | null,
  "shotType": string | null,
  "keyAction": string | null,
  "specificArea": string | null,
  "emotion": string | null,
  "audienceEffect": string | null,
  "composition": string | null,
  "movement": string | null,
  "negativePrompts": string | null,
  "styleNotes": string | null,
  "continuityNotes": string | null
}`
              }]
            }],
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 1400,
              responseMimeType: "application/json"
            }
          })
        }
      );

      if (!response.ok) throw new Error(`API request failed: ${response.status}`);

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsed = extractJsonFromAiResponse(text);

      let appliedSceneChanges = false;

      setStoryPoints(prev => prev.map((p, i) => {
        if (i !== idx) return p;

        const currentDescription = p.detailedDescription || p.versions[p.currentVersion] || "";
        const updates: Record<string, any> = {};

        const summary = sanitizeSceneAssistantText(parsed.summary);
        if (summary !== null && summary !== (p.summary || "")) {
          updates.summary = summary;
        }

        const detailedDescription = sanitizeSceneAssistantText(parsed.detailedDescription);
        if (detailedDescription !== null && detailedDescription !== currentDescription) {
          const newVersions = [...p.versions, detailedDescription];
          updates.versions = newVersions;
          updates.currentVersion = newVersions.length - 1;
          updates.detailedDescription = detailedDescription;
        }

        if (storyEnableSpeaker) {
          const dialogText = sanitizeSceneAssistantText(parsed.dialogText);
          if (dialogText !== null && dialogText !== (p.dialogText || "")) {
            updates.dialogText = dialogText;
          }
        }

        const videoPrompt = sanitizeSceneAssistantText(parsed.videoPrompt);
        if (videoPrompt !== null && videoPrompt !== (p.videoPrompt || "")) {
          updates.videoPrompt = videoPrompt;
        }

        const enumFields = [
          "cameraAngle",
          "shotType",
          "keyAction",
          "specificArea",
          "emotion",
          "audienceEffect",
          "composition",
          "movement",
        ] as const;

        for (const field of enumFields) {
          const normalizedValue = normalizeSceneAssistantEnumValue(field, parsed[field]);
          if (normalizedValue !== undefined && normalizedValue !== (p[field] || "")) {
            updates[field] = normalizedValue;
          }
        }

        const freeTextFields = ["negativePrompts", "styleNotes", "continuityNotes"] as const;
        for (const field of freeTextFields) {
          const value = sanitizeSceneAssistantText(parsed[field]);
          if (value !== null && value !== (p[field] || "")) {
            updates[field] = value;
          }
        }

        if (Object.keys(updates).length === 0) {
          return p;
        }

        appliedSceneChanges = true;
        return { ...p, ...updates };
      }));

      if (appliedSceneChanges) {
        setSceneAssistantInput("");
      }
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
${storyCreatorMode === "reel" ? `

REEL-MODUS:
- Halte den Prompt kurz, hart und visuell eindeutig.
- Hook im ersten Beat, genau ein dominanter Fokus, keine langsame Einleitung.
- Das Ergebnis muss auf einem Handy sofort lesbar und scroll-stopping sein.` : ""}

NUTZERANWEISUNG:
"${sceneAssistantInput.trim() || 'Optimiere den Video-Prompt für maximale visuelle Wirkung und Detailgrad.'}"

Erstelle einen VERBESSERTEN Video-Prompt (${getVideoPromptWordTarget(storyCreatorMode)} Wörter, auf Englisch) basierend auf der Nutzeranweisung.
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
  const getSmartReelSceneCount = (duration: "" | "15-30" | "30-60" | "60+") => {
    if (duration === "15-30") return 3;
    if (duration === "30-60") return 5;
    if (duration === "60+") return 6;
    return 4;
  };

  const startSmartReelChat = (reset = false) => {
    if (!reset && smartReelChatMessages.length > 0) return;
    setSmartReelChatMessages([
      {
        role: "assistant",
        text: "Ich stelle dir jetzt die wichtigsten Fragen für dein Reel. Danach kannst du wie gewohnt Ideen, Storyboard, Bilder und Videos generieren."
      },
      {
        role: "assistant",
        text: "Willst du einen separaten Sprecher oder sollen die Avatare selbst sprechen?"
      }
    ]);
    setSmartReelChatStep("speech");
    setSmartReelChatInput("");
  };

  const appendSmartReelAssistantQuestion = (step: SmartReelChatStep) => {
    const question = step === "platform"
      ? "Für welches Portal soll das Reel erstellt werden?"
      : step === "topic"
        ? "Worum geht es in deinem eigenen Video?"
        : step === "goal"
          ? "Was soll beim Zuschauer hängen bleiben oder passieren?"
          : step === "duration"
            ? "Wie lang soll das Reel ungefähr sein?"
            : "Perfekt. Dein Smart Reel Briefing steht. Du kannst jetzt direkt Ideen generieren.";
    setSmartReelChatMessages(prev => [...prev, { role: "assistant", text: question }]);
    setSmartReelChatStep(step);
  };

  const handleSmartReelOptionAnswer = (value: string, label: string) => {
    if (!smartReelModeEnabled) return;
    setSmartReelChatMessages(prev => [...prev, { role: "user", text: label }]);

    if (smartReelChatStep === "speech") {
      const mode = value as "speaker" | "avatars";
      setSmartReelSpeechMode(mode);
      setStoryEnableSpeaker(true);
      setStoryVoiceMode(mode === "avatars" ? "dialog" : "sprecher");
      setStoryGenerationDirection("speaker-from-description");
      appendSmartReelAssistantQuestion("platform");
      return;
    }

    if (smartReelChatStep === "platform") {
      const platform = value as "instagram" | "youtube" | "tiktok";
      setSmartReelPlatform(platform);
      setStoryCreatorMode("reel");
      setStoryboardFormat("9:16");
      setStoryPacing("instant-action");
      appendSmartReelAssistantQuestion("topic");
      return;
    }

    if (smartReelChatStep === "duration") {
      const duration = value as "15-30" | "30-60" | "60+";
      setSmartReelDuration(duration);
      setStoryPointCount(getSmartReelSceneCount(duration));
      setSmartReelChatStep("done");
      setSmartReelChatMessages(prev => [
        ...prev,
        {
          role: "assistant",
          text: "Perfekt. Dein Briefing ist jetzt im Reel Creator hinterlegt. Wenn du Referenzbilder und Transcript ergänzt hast, kannst du direkt Ideen generieren."
        }
      ]);
    }
  };

  const handleSmartReelTextSubmit = () => {
    const text = smartReelChatInput.trim();
    if (!text || !smartReelModeEnabled) return;

    setSmartReelChatMessages(prev => [...prev, { role: "user", text }]);
    setSmartReelChatInput("");

    if (smartReelChatStep === "topic") {
      setSmartReelTopic(text);
      appendSmartReelAssistantQuestion("goal");
      return;
    }

    if (smartReelChatStep === "goal") {
      setSmartReelGoal(text);
      appendSmartReelAssistantQuestion("duration");
    }
  };

  const handleSmartReelStyleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const filesToProcess = Array.from(files).slice(0, maxSmartReelStyleImages - smartReelStyleImages.length);
    if (filesToProcess.length === 0) {
      e.target.value = "";
      return;
    }

    const newImages: string[] = [];
    for (const file of filesToProcess) {
      try {
        const base64 = await compressImageToFitSize(file);
        newImages.push(base64);
      } catch (error) {
        console.error('Error compressing smart reel style image:', error);
      }
    }

    if (newImages.length > 0) {
      setSmartReelStyleImages(prev => {
        const updated = [...prev, ...newImages].slice(0, maxSmartReelStyleImages);
        saveToLocalStorage('smartReelStyleImages', updated);
        return updated;
      });
      setSmartReelStyleDescriptions(prev => {
        const updated = [...prev, ...newImages.map(() => "")].slice(0, maxSmartReelStyleImages);
        saveToLocalStorage('smartReelStyleDescriptions', updated);
        return updated;
      });
    }

    e.target.value = "";
  };

  const removeSmartReelStyleImage = (index: number) => {
    setSmartReelStyleImages(prev => {
      const updated = prev.filter((_, i) => i !== index);
      saveToLocalStorage('smartReelStyleImages', updated);
      return updated;
    });
    setSmartReelStyleDescriptions(prev => {
      const updated = prev.filter((_, i) => i !== index);
      saveToLocalStorage('smartReelStyleDescriptions', updated);
      return updated;
    });
  };

  const ensureSmartReelTextReferencesReady = async () => {
    const existingStyleDescriptions = smartReelStyleDescriptionsRef.current.map((value) => sanitizeSceneField(value)).filter(Boolean);
    const existingOverallDirection = sanitizeSceneField(smartReelReferenceSummaryRef.current);
    const needsStyleAnalysis = smartReelModeEnabled
      && smartReelStyleImages.length > 0
      && (existingStyleDescriptions.length < smartReelStyleImages.length || !existingOverallDirection);

    if (needsStyleAnalysis) {
      await analyzeSmartReelReferences();
    }

    const styleDescriptions = smartReelStyleDescriptionsRef.current.map((value) => sanitizeSceneField(value)).filter(Boolean);
    const overallDirection = sanitizeSceneField(smartReelReferenceSummaryRef.current);

    return {
      styleDescriptions,
      overallDirection,
      styleBlockGerman: buildSmartReelStyleBlockGermanFromValues(styleDescriptions),
      visualLockEnglish: buildSmartReelVisualLockEnglishFromValues(styleDescriptions, overallDirection),
    };
  };

  const analyzeSmartReelReferences = async () => {
    if (!apiKey || isAnalyzingSmartReelReferences) return;
    if (!smartReelTranscript.trim() && storyReferenceImages.length === 0 && smartReelStyleImages.length === 0) return;

    setIsAnalyzingSmartReelReferences(true);
    try {
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{
        text: `Du analysierst Referenzmaterial für einen Smart-Reel-Workflow.

AUFGABE:
- Beschreibe jede hochgeladene Charakter-Referenz so konkret, dass eine Video-KI Gesicht, Haare, Kleidung, Accessoires und Alterseindruck möglichst konsistent nachbauen kann.
- Beschreibe jede Stil-Referenz so konkret, dass Bildlook, Licht, Farbe, Kamera, Kontrast und Oberflächen möglichst genau nachgebaut werden können.
- Nutze das Transcript nur für Hook, Rhythmus und Dramaturgie. Nicht für 1:1-Kopie.

REFERENZ-TRANSCRIPT:
${smartReelTranscript.trim() || "Kein Transcript vorhanden"}

Gib NUR valides JSON zurück:
{
  "characterDescriptions": [
    { "index": 1, "name": "string", "description": "string" }
  ],
  "styleDescriptions": [
    { "index": 1, "description": "string" }
  ],
  "overallDirection": "string"
}`
      }];

      storyReferenceImages.forEach((imageUrl, index) => {
        const { mimeType, base64 } = splitImageDataUrl(imageUrl);
        parts.push({
          text: `Charakterbild ${index + 1}${storyReferenceLabels[index]?.trim() ? ` mit Namenshinweis "${storyReferenceLabels[index].trim()}"` : ""}`
        });
        parts.push({ inlineData: { mimeType, data: base64 } });
      });

      smartReelStyleImages.forEach((imageUrl, index) => {
        const { mimeType, base64 } = splitImageDataUrl(imageUrl);
        parts.push({ text: `Stilbild ${index + 1}` });
        parts.push({ inlineData: { mimeType, data: base64 } });
      });

      const resultText = await callGeminiOrFull(parts, {
        model: "gemini-2.0-flash",
        temperature: 0.3,
        maxOutputTokens: 1600
      });

      if (!resultText) return;
      const parsed = extractJsonFromAiResponse(resultText);
      const normalizedStyleDescriptions = Array.isArray(parsed?.styleDescriptions)
        ? parsed.styleDescriptions
            .map((item: any) => sanitizeSceneField(item?.description))
            .filter(Boolean)
        : [];
      const normalizedOverallDirection = sanitizeSceneField(parsed?.overallDirection);

      if (Array.isArray(parsed?.characterDescriptions) && parsed.characterDescriptions.length > 0) {
        setStoryReferenceLabels(prev => {
          const updated = [...prev];
          parsed.characterDescriptions.forEach((item: any) => {
            const idx = Math.max(0, Number(item?.index || 1) - 1);
            if (idx < maxStoryReferenceImages && sanitizeSceneField(item?.name) && !sanitizeSceneField(updated[idx])) {
              updated[idx] = sanitizeSceneField(item.name);
            }
          });
          saveToLocalStorage('storyReferenceLabels', updated);
          return updated;
        });
        setStoryReferenceDescriptions(prev => {
          const updated = [...prev];
          parsed.characterDescriptions.forEach((item: any) => {
            const idx = Math.max(0, Number(item?.index || 1) - 1);
            if (idx < maxStoryReferenceImages && sanitizeSceneField(item?.description)) {
              updated[idx] = sanitizeSceneField(item.description);
            }
          });
          saveToLocalStorage('storyReferenceDescriptions', updated);
          return updated;
        });
      }

      if (Array.isArray(parsed?.styleDescriptions) && parsed.styleDescriptions.length > 0) {
        setSmartReelStyleDescriptions(prev => {
          const updated = [...prev];
          parsed.styleDescriptions.forEach((item: any) => {
            const idx = Math.max(0, Number(item?.index || 1) - 1);
            if (idx < maxSmartReelStyleImages && sanitizeSceneField(item?.description)) {
              updated[idx] = sanitizeSceneField(item.description);
            }
          });
          saveToLocalStorage('smartReelStyleDescriptions', updated);
          smartReelStyleDescriptionsRef.current = updated;
          return updated;
        });
      }

      setSmartReelReferenceSummary(normalizedOverallDirection);
      smartReelReferenceSummaryRef.current = normalizedOverallDirection;

      return {
        styleDescriptions: normalizedStyleDescriptions,
        overallDirection: normalizedOverallDirection,
      };
    } catch (error) {
      console.error("Smart reel reference analysis error:", error);
    } finally {
      setIsAnalyzingSmartReelReferences(false);
    }
  };

  // Story Idea AI Assistant handler - generates multiple ideas
  const handleGenerateStoryIdea = async () => {
    if (!canGenerate || isGeneratingStoryAiIdea) return;
    
    const count = parseInt(ideaCount);
    const hasExistingIdea = storyIdea.trim().length > 0;
    const isModifyMode = hasExistingIdea;
    const workflowInstruction = storyAiAssistantInput.trim();
    const effectiveNewIdeaInstruction = workflowInstruction || (!isModifyMode ? smartReelIdeaSeed : "");
    const plannerContextBlock = smartReelContextBlock ? `\n\n${smartReelContextBlock}` : "";
    if (!effectiveNewIdeaInstruction && !isModifyMode) return;
    
    setIsGeneratingStoryAiIdea(true);
    try {
      const currentIdea = generatedIdeas[currentIdeaIndex] || storyIdea;
      
      const prompt = isModifyMode
        ? `Du bist ein Story-Autor für REALISTISCHE, lebensnahe Geschichten.

AKTUELLE STORY-IDEE:
"${currentIdea}"

${workflowInstruction ? `AENDERUNGSWUNSCH:\n"${workflowInstruction}"` : 'Verbessere und erweitere diese Story-Idee. Mache sie detaillierter, fesselnder und emotional packender.'}
${plannerContextBlock}

Erstelle genau ${count} verschiedene Variante${count > 1 ? 'n' : ''} der angepassten Story-Idee. Behalte den Kern der Geschichte bei, aber integriere die gewünschten Änderungen.${count > 1 ? ' Jede Variante soll einen anderen Ansatz oder Fokus haben.' : ''}

WICHTIGE REGELN:
- Erstelle ${count > 1 ? `genau ${count} Varianten, jeweils` : 'eine'} ausfuehrliche, detaillierte Story-Idee (4-8 Saetze)
- NUR realistische, alltägliche Szenarien! KEINE Fantasy, Magie, übernatürliche Elemente, Sci-Fi
- Fokussiere auf echte menschliche Emotionen, Beziehungen, Konflikte, Entscheidungen
- Wenn eine Referenz vorhanden ist, adaptiere Hook, Figurenwirkung und Dramaturgie auf ein neues eigenes Video
- Schreibe auf Deutsch
${count > 1 ? '- Trenne die Varianten mit "---" auf einer eigenen Zeile\n' : ''}- Antworte NUR mit der angepassten Story-Idee, keine Einleitungen oder Erklaerungen`
        : `Du bist ein Story-Autor für REALISTISCHE, lebensnahe Geschichten. Erstelle genau ${count} verschiedene, fesselnde Story-Idee${count > 1 ? 'n' : ''}.

NUTZERANFRAGE:
"${effectiveNewIdeaInstruction || 'Erstelle realistische, detaillierte Story-Ideen'}"
${plannerContextBlock}

WICHTIGE REGELN:
- Erstelle genau ${count} ${count > 1 ? 'verschiedene Story-Ideen (jeweils' : 'ausfuehrliche Story-Idee ('} 6-10 Saetze)
- NUR realistische, alltägliche Szenarien! KEINE Fantasy, Magie, übernatürliche Elemente, Sci-Fi
- Fokussiere auf echte menschliche Emotionen, Beziehungen, Konflikte, Entscheidungen
- Die Idee${count > 1 ? 'n' : ''} sollte${count > 1 ? 'n' : ''} visuell umsetzbar sein für ein Storyboard
- Wenn eine Referenz vorhanden ist, übernimm Struktur und Hook-Mechanik, aber nie den Inhalt oder Wortlaut 1:1
- Schreibe auf Deutsch
${count > 1 ? '- Trenne die Ideen mit "---" auf einer eigenen Zeile\n' : ''}- Antworte NUR mit den Story-Ideen, keine Nummerierungen, Einleitungen oder Erklaerungen`;

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

  const cancelActiveRegeneration = () => {
    if (activeRegenerationController.current) {
      activeRegenerationController.current.abort();
      activeRegenerationController.current = null;
    }
    setRegeneratingCardIndex(null);
    setRegeneratingPointIndex(null);
    setRegeneratingImageOnlyIndex(null);
  };

  const handleCloseExpandedCard = () => {
    if (isClosingPopup) return;
    // If regeneration is running, show warning first
    if (regeneratingPointIndex !== null) {
      setShowRegenerationCloseWarning(true);
      return;
    }
    setIsClosingPopup(true);
    setTimeout(() => {
      setExpandedStoryPointIndex(null);
      setIsClosingPopup(false);
    }, 250);
  };

  const handleForceCloseExpandedCard = () => {
    setShowRegenerationCloseWarning(false);
    cancelActiveRegeneration();
    setIsClosingPopup(true);
    setTimeout(() => {
      setExpandedStoryPointIndex(null);
      setIsClosingPopup(false);
    }, 250);
  };

  const handleStoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const maxImages = maxStoryReferenceImages;
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
          const updated = [...prev, ...newImages].slice(0, maxImages);
          saveToLocalStorage('storyReferenceImages', updated);
          return updated;
        });
        setStoryReferenceLabels(prev => {
          const updated = [...prev, ...newImages.map(() => "")].slice(0, maxImages);
          saveToLocalStorage('storyReferenceLabels', updated);
          return updated;
        });
        setStoryReferenceDescriptions(prev => {
          const updated = [...prev, ...newImages.map(() => "")].slice(0, maxImages);
          saveToLocalStorage('storyReferenceDescriptions', updated);
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
    setStoryReferenceLabels(prev => {
      const updated = prev.filter((_, i) => i !== index);
      saveToLocalStorage('storyReferenceLabels', updated);
      return updated;
    });
    setStoryReferenceDescriptions(prev => {
      const updated = prev.filter((_, i) => i !== index);
      saveToLocalStorage('storyReferenceDescriptions', updated);
      return updated;
    });
  };

  const generateStoryboard = async () => {
    if (!canGenerate || !storyIdea.trim() || isGeneratingStoryboard || generationLimitReached) return;
    
    incrementGeneration();
    setIsGeneratingStoryboard(true);
    
    try {
      const storyboardGenerationConfig = {
        temperature: storyCreatorMode === "reel" ? 0.55 : 0.8,
        maxOutputTokens: storyCreatorMode === "reel" ? 3200 : 4000,
        responseMimeType: "application/json" as const,
      };
      const storyCharacterNames = storyCharacterProfiles.map((profile) => profile.name);
      const storyCharacterDialogueRule = storyCharacterNames.length > 0
        ? `  - falls voiceMode = "dialog": JEDER gesprochene Satz MUSS mit einem exakten Charakternamen aus dieser Liste beginnen: ${storyCharacterNames.map((name) => `"${name}"`).join(', ')}`
        : '  - falls voiceMode = "dialog": Verteile die Dialoge logisch auf die sichtbaren Figuren der Szene';
      const storyPromptText = `Du bist ein professioneller Drehbuchautor für visuelle Storyboards.

AUFGABE:
Erstelle ein einziges valides JSON-Objekt basierend auf diesen Eingaben.
KRITISCH: Das "scenes" Array MUSS EXAKT ${storyPointCount} Einträge enthalten. Nicht mehr, nicht weniger.

EINGABEN:
- storyIdea: "${storyIdea}"
- visualStyle: "${storyArtStyle}"
- customDetails: "${storyCustomDetails.trim()}"
- sceneCount: ${storyPointCount}
- enableSceneDescription: ${storyEnableSceneDescription}
- enableSpeaker: ${storyEnableSpeaker}
- voiceMode: "${storyVoiceMode}"
- generationDirection: "${storyGenerationDirection}"
- numberOfCharacters: ${storyReferenceImages.length}
- videoMood: "${storyVideoMood}"
- colorMood: "${storyColorMood}"
- pacing: "${storyPacing}"
${effectiveStoryHook ? `- hook: "${effectiveStoryHook}"` : ''}
${storyEnableSpeaker ? `- speakerGender: "${storySpeakerGender}"` : ''}
${storyCharacterProfiles.length > 0 ? `CHARAKTER-REFERENZEN:\n${storyCharacterProfilesGermanBlock}` : ''}
${smartReelStyleBlockGerman ? `STIL-REFERENZEN:\n${smartReelStyleBlockGerman}` : ''}
${smartReelContextBlock ? `${smartReelContextBlock}\n` : ''}
${storyCreatorMode === "reel" ? getReelStoryboardDirective(effectiveStoryHook) : ''}
HARTE AUSGABEREGELN:
- Antworte ausschlieÜlich mit einem einzigen validen JSON-Objekt.
- Das erste Zeichen deiner Antwort muss { sein.
- Das letzte Zeichen deiner Antwort muss } sein.
- Kein Markdown.
- Keine Codeblöcke.
- Keine Einleitung.
- Keine Erklärung.
- Keine Kommentare.
- Keine zusätzlichen Zeichen vor oder nach dem JSON.
- Keine umschlieÜenden Anführungszeichen um das gesamte JSON.
- Die Antwort muss mit JSON.parse() direkt parsebar sein.

INHALTSREGELN:
- Definiere zuerst einen einzigen Hauptort für die gesamte Geschichte.
- Alle Szenen spielen nur an diesem Hauptort.
- Nur der konkrete Bereich innerhalb des Hauptorts wechselt.
- Alle Szenen müssen realistisch sein. Keine Fantasy, keine Magie.
- Jede Szene hat genau eine klare zentrale Aktion oder Gestik.
- Die Szenen bauen logisch aufeinander auf.
- Emotionen müssen visuell erkennbar sein.
- Wenn Referenzcharaktere vorhanden sind, bleibt jeder Name fest an genau sein Referenzbild gebunden.
- Frisur, Gesicht, Kleidung, Accessoires und markante Merkmale der benannten Charaktere bleiben über alle Szenen konsistent, sofern die Geschichte keine explizite Ünderung verlangt.
- Verwende in participants und dialogText nur die exakten Charakternamen aus den Referenzcharakteren.
- Die letzte Szene soll den staerksten Payoff, Twist oder Ausblick des neuen Videos liefern.

ERLAUBTE WERTE:
- cameraAngle: "eye-level" | "low-angle" | "high-angle" | "dutch-angle" | "over-shoulder" | "bird-eye" | "worm-eye"
- shotType: "extreme-close-up" | "close-up" | "medium-close-up" | "medium-shot" | "medium-full-shot" | "full-shot" | "long-shot" | "extreme-long-shot"
- audienceEffect: "spannung" | "empathie" | "freude" | "unbehagen" | "neugier" | "erleichterung" | "trauer" | "hoffnung"
- composition: "zentriert" | "drittel-regel" | "symmetrisch" | "diagonal" | "rahmen-im-rahmen"
- movement: "keine" | "dolly-in" | "dolly-out" | "truck" | "tilt" | "pan" | "crane" | "arc"

JSON-SCHEMA:
{
  "mainLocation": "string",
  "scenes": [
    {
      "summary": "string, max 15 Wörter",
      "participants": "string, exakte sichtbare Charakternamen kommasepariert",
      "specificArea": "string",
      "keyAction": "string",
      "emotion": "string",
      "detailedDescription": "string",
      "dialogText": "string",
      "audienceEffect": "one of allowed values",
      "composition": "one of allowed values",
      "movement": "one of allowed values",
      "continuityNotes": "string",
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
- "audienceEffect": welche Zuschauerreaktion oder Stimmung die Szene ausloesen soll
- "composition": die Bildlogik für Fokus und Lesbarkeit
- "movement": die dominante Kamerabewegung oder "keine"
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
  - falls voiceMode = "sprecher": Schreibe einen Erzähler-/Voiceover-Text in der 3. Person oder als Off-Stimme. KEIN Dialog zwischen Personen. Der Text beschreibt/kommentiert die Szene wie ein Sprecher.
  - falls voiceMode = "dialog":
${storyCharacterDialogueRule}
    - Verwende niemals erfundene neue Namen.
    - Verteile die Dialoge logisch auf die Charaktere basierend auf der Szene
  - falls generationDirection = "speaker-from-description":
      Text passend zur Szenenbeschreibung, 1-3 Sätze
  - falls generationDirection = "description-from-speaker":
      Text zuerst inhaltlich erzeugen, damit die visuelle Beschreibung darauf basiert
- "participants":
  - nur die exakten Namen der in dieser Szene sichtbaren Referenzcharaktere, kommasepariert
  - wenn nur ein Referenzcharakter sichtbar ist, nenne nur diesen einen Namen
  - wenn kein Referenzcharakter vorhanden ist, kann das Feld leer bleiben
- "continuityNotes":
  - kurze Kontinuitätsnotiz zu Kleidung, Haaren, Accessoires, Requisiten oder Sprecherzuordnung
  - falls Referenzcharaktere vorhanden sind, erinnere an deren feste Identität
- "cameraAngle": nur erlaubter Enum-Wert
- "shotType": nur erlaubter Enum-Wert
- "audienceEffect": nur erlaubter Enum-Wert
- "composition": nur erlaubter Enum-Wert
- "movement": nur erlaubter Enum-Wert

WICHTIG:
- Wenn enableSpeaker = false, darf "dialogText" nicht im JSON vorkommen.
- Die Anzahl der Szenen muss exakt sceneCount entsprechen.
- Verwende nur Strings, Arrays und Objekte, die in validem JSON erlaubt sind.
- Gib jetzt nur das JSON zurück.`;

      let primaryText: string | null = null;
      let storyboardApplied = false;
      const applyParsedStoryboard = (parsed: any, minimumCount = 1) => {
        const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes.filter(Boolean) : [];
        if (scenes.length < minimumCount) return false;

        setStoryboardMainLocation(parsed?.mainLocation || "");
        setFlippedCards(new Set());
        setStoryPoints(scenes.slice(0, storyPointCount).map((scene: any) => buildStoryPointFromScene(scene)));
        setStoryboardAnimationKey(prev => prev + 1);
        storyboardApplied = true;
        return true;
      };

      const requestStoryboardText = async (promptText: string) => {
        const storyboardResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: promptText }]
              }],
              generationConfig: storyboardGenerationConfig
            }),
          }
        );

        if (!storyboardResponse.ok) return null;
        const storyboardData = await storyboardResponse.json();
        return storyboardData.candidates?.[0]?.content?.parts?.[0]?.text || null;
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: storyPromptText }]
            }],
            generationConfig: storyboardGenerationConfig
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        primaryText = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
        const text = primaryText;
        if (text) {
          try {
            const parsed = extractJsonFromAiResponse(text);
            const mainLocation = parsed.mainLocation || "";
            const scenes = parsed.scenes || [];
            
            if (Array.isArray(scenes) && scenes.length >= storyPointCount) {
              setStoryboardMainLocation(mainLocation);
              setFlippedCards(new Set());
              setStoryPoints(scenes.slice(0, storyPointCount).map((scene: any) => buildStoryPointFromScene(scene)));
              setStoryboardAnimationKey(prev => prev + 1);
              storyboardApplied = true;
            } else {
              // AI returned fewer scenes than requested - retry once
              console.warn(`⚠️ AI returned ${scenes.length} scenes instead of ${storyPointCount}, retrying...`);
              // Recursive retry (single attempt)
              const retryResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [{
                      role: "user",
                      parts: [{
                        text: `${storyPromptText}\n\nKRITISCH: Du MUSST EXAKT ${storyPointCount} Szenen generieren. Nicht mehr, nicht weniger. Genau ${storyPointCount} Einträge im "scenes" Array.`
                      }]
                    }],
                    generationConfig: storyboardGenerationConfig
                  }),
                }
              );
              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                const retryText = retryData.candidates?.[0]?.content?.parts?.[0]?.text;
                if (retryText) {
                  const retryParsed = extractJsonFromAiResponse(retryText);
                  const retryScenes = retryParsed.scenes || [];
                  if (Array.isArray(retryScenes) && retryScenes.length > 0) {
                    setStoryboardMainLocation(retryParsed.mainLocation || "");
                    setFlippedCards(new Set());
                    setStoryPoints(retryScenes.slice(0, storyPointCount).map((scene: any) => buildStoryPointFromScene(scene)));
                    setStoryboardAnimationKey(prev => prev + 1);
                    storyboardApplied = true;
                  }
                }
              }
            }
          } catch (parseError) {
            console.error("JSON parse error, falling back to line-based parsing:", parseError);
            const points = text.split('\n')
              .map((line: string) => line.trim())
              .filter((line: string) => {
                if (line.length <= 5) return false;
                if (/^[\{\}\[\],]$/.test(line)) return false;
                if (/^["']?\w+["']?\s*:\s*/.test(line)) return false;
                if (line.startsWith('{') || line.startsWith('[') || line.startsWith('}') || line.startsWith(']')) return false;
                // Must contain at least 2 spaces (real sentence, not a key-value pair)
                const spaceCount = (line.match(/ /g) || []).length;
                return spaceCount >= 2;
              })
              .slice(0, storyPointCount);
            
            setFlippedCards(new Set());
            setStoryPoints(points.map((point: string) => ({
              versions: [point],
              currentVersion: 0,
              summary: point.length > 80 ? point.substring(0, 80) + "..." : point,
              detailedDescription: point
            })));
            setStoryboardAnimationKey(prev => prev + 1);
            storyboardApplied = points.length > 0;
          }
        }
      }

      if (!storyboardApplied && storyCreatorMode === "reel") {
        console.warn("Reel storyboard primary prompt returned no usable scenes, trying simplified fallback...");

        const simplifiedReelPrompt = `Du bist ein Storyboard-Autor für kurze vertikale Reels.

AUFGABE:
Antworte nur mit validem JSON.
Erstelle genau ${storyPointCount} kurze Szenen für ein 9:16 Reel.

EINGABEN:
- Story-Idee: "${storyIdea}"
- Hook: "${effectiveStoryHook}"
- Stil: "${storyArtStyle}"

REGELN:
- Szene 1 startet direkt mit dem staerksten Moment
- Jede Szene zeigt genau einen klaren Fokus und eine klare Aktion
- Keine Filler-Shots
- Jede Szene muss auf dem Handy sofort lesbar sein
- Die Geschichte bleibt realistisch

ERLAUBTE cameraAngle Werte:
"eye-level", "low-angle", "high-angle", "dutch-angle", "over-shoulder", "bird-eye", "worm-eye"

ERLAUBTE shotType Werte:
"extreme-close-up", "close-up", "medium-close-up", "medium-shot", "medium-full-shot", "full-shot", "long-shot", "extreme-long-shot"

JSON:
{
  "mainLocation": "string",
  "scenes": [
    {
      "summary": "string",
      "specificArea": "string",
      "keyAction": "string",
      "emotion": "string",
      "detailedDescription": "string",
      "cameraAngle": "allowed value",
      "shotType": "allowed value"
    }
  ]
}`;

        const fallbackText = await requestStoryboardText(simplifiedReelPrompt);
        if (fallbackText) {
          try {
            const fallbackParsed = extractJsonFromAiResponse(fallbackText);
            applyParsedStoryboard(fallbackParsed, 1);
          } catch (fallbackError) {
            console.error("Reel fallback storyboard parse failed:", fallbackError);
          }
        }
      }
    } catch (error) {
      console.error("Failed to generate storyboard:", error);
    } finally {
      setIsGeneratingStoryboard(false);
      decrementGeneration();
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

----------------------------------------
VEO3 VIDEO-PROMPT (Kopieren für Veo3)
----------------------------------------
${point.videoPrompt || 'Kein Video-Prompt generiert'}

----------------------------------------
STRUKTURIERTE DETAILS
----------------------------------------
KAMERABEWEGUNG: ${cameraMovementInfo ? `${cameraMovementInfo.label} (${cameraMovementInfo.description})` : 'Nicht definiert'}

START-FRAME:
${point.veo3StartState || point.sceneDescription || 'Nicht definiert'}

BEWEGUNG/AKTION:
${point.veo3Motion || 'Nicht definiert'}

END-FRAME (für Übergang zu nächster Szene):
${point.veo3EndState || 'Nicht definiert'}

----------------------------------------
SZENEN-DETAILS
----------------------------------------
TITEL: ${point.sceneTitle || 'Ohne Titel'}
BESCHREIBUNG: ${point.sceneDescription || point.versions[point.currentVersion]}
KAMERAWINKEL: ${point.cameraAngle || 'Automatisch'}
SHOT-TYP: ${point.shotType || 'Automatisch'}

----------------------------------------
BILD-PROMPT (Referenz)
----------------------------------------
${point.detailedImagePrompt || 'Nicht verfügbar'}

----------------------------------------
ÜBERGANG
----------------------------------------
DAUER: 5 Sekunden empfohlen
SCHNITT: ${i < storyPoints.length - 1 ? 'Cut oder Fade zu Szene ' + (i + 2) : 'Letzte Szene'}
`;
        
        scenesFolder?.file(`scene_${sceneNum}_prompt.txt`, promptContent);
        
        // Zur Übersicht hinzufügen
        overviewContent += `
SZENE ${sceneNum}: ${point.sceneTitle || 'Ohne Titel'}
----------------------------------------
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

1. Üffne Google AI Studio oder Veo3 Interface
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
      const sceneCharacterNames = storyCharacterProfiles.map((profile) => profile.name);
      
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
${storyCharacterProfiles.length > 0 ? `\nCHARAKTER-REFERENZEN:\n${storyCharacterProfilesGermanBlock}\n- Die Namen bleiben fest an ihr Referenzbild gebunden.\n- Kleidung, Haare und markante Merkmale bleiben gleich.` : ''}

Generiere eine KOMPLETT NEUE Alternative für Szene ${index + 1} von ${storyPoints.length}.

Bisherige Szene: "${point.versions[point.currentVersion]}"
${prevPoint ? `Vorherige Szene: "${prevPoint.versions[prevPoint.currentVersion]}"` : "Dies ist die erste Szene."}
${nextPoint ? `Nächste Szene: "${nextPoint.versions[nextPoint.currentVersion]}"` : "Dies ist die letzte Szene."}

WICHTIG: Antworte NUR mit diesem validen JSON-Format:
{
  "summary": "1-Satz Zusammenfassung (max. 15 Wörter)",
  "participants": "Exakte sichtbare Charakternamen kommasepariert",
  "specificArea": "Welcher Bereich des Hauptorts (z.B. 'im Flur', 'auf dem Balkon')",
  "keyAction": "Die EINE zentrale Aktion/Gestik der Person",
  "emotion": "Die sichtbare Emotion (z.B. 'melancholisch', 'hoffnungsvoll')",
  "detailedDescription": "Ausführliche visuelle Beschreibung (3-4 Sätze): Atmosphäre, Beleuchtung, was die Person tut",
  "dialogText": "Was der Charakter in dieser Szene sagt (1-3 Sätze gesprochener Dialog, in Anführungszeichen). Leer lassen wenn keine Rede.",
  "continuityNotes": "Kurze Kontinuitätsnotiz zu Outfit, Haaren, Accessoires, Sprecherzuordnung",
  "cameraAngle": "eye-level|low-angle|high-angle|dutch-angle|over-shoulder|bird-eye|worm-eye",
  "shotType": "extreme-close-up|close-up|medium-close-up|medium-shot|medium-full-shot|full-shot|long-shot|extreme-long-shot"
}

REGELN:
- Die neue Szene MUSS sich deutlich von der bisherigen unterscheiden
- Der Hauptort bleibt gleich, nur der Bereich wechselt
- Die Szene muss logisch in die Geschichte passen
- NUR realistische Szenarien
- Wenn Referenzcharaktere vorhanden sind, verwende nur deren exakte Namen: ${sceneCharacterNames.length > 0 ? sceneCharacterNames.map((name) => `"${name}"`).join(', ') : 'keine'}
- Wenn Dialog verwendet wird und Referenzcharaktere vorhanden sind, muss jede Dialogzeile mit dem exakten Sprechernamen beginnen
- participants darf nur Charaktere enthalten, die in dieser Szene wirklich sichtbar sind
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
        versions: [...point.versions, sanitizeSceneField(parsed.detailedDescription) || sanitizeSceneField(parsed.summary) || ""],
        currentVersion: point.versions.length,
        summary: sanitizeSceneField(parsed.summary),
        participants: sanitizeSceneField(parsed.participants),
        detailedDescription: sanitizeSceneField(parsed.detailedDescription),
        specificArea: sanitizeSceneField(parsed.specificArea),
        keyAction: sanitizeSceneField(parsed.keyAction),
        emotion: sanitizeSceneField(parsed.emotion),
        continuityNotes: sanitizeSceneField(parsed.continuityNotes),
        cameraAngle: normalizeSceneCameraAngle(parsed.cameraAngle),
        shotType: normalizeSceneShotType(parsed.shotType),
        dialogText: sanitizeSceneField(parsed.dialogText),
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
        errorMessage = error.name === 'AbortError' ? "Zeitüberschreitung - keine Antwort nach 20s" : error.message;
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
      participants?: string;
      dialogText?: string;
      continuityNotes?: string;
    },
    characterBase64Images: string[],
    maxRetries: number = 3
  ): Promise<{ success: boolean; generatedImageUrl?: string; detailedImagePrompt?: string; videoPrompt?: string; sceneTitle?: string; sceneDescription?: string; errorMessage?: string; veo3CameraMovement?: string; veo3StartState?: string; veo3Motion?: string; veo3EndState?: string }> => {
    const storyText = point.versions[point.currentVersion];
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      
      try {
        const currentStoryPoints = storyPointsRef.current;
        const scenePoint = currentStoryPoints[sceneIndex] || point;
        
        // === GERMAN TO ENGLISH TRANSLATION MAP ===
        const germanToEnglish: Record<string, string> = {
          // Locations
          "ballsaal": "ballroom", "villa": "villa", "wald": "forest", "strand": "beach",
          "garten": "garden", "zimmer": "room", "haus": "house", "schloss": "castle",
          "straÜe": "street", "stadt": "city", "dorf": "village", "büro": "office",
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
            .replace(/\b(tot|sterben|stirbt|blut|waffe|gewalt|nackt|sex|kind|mord|krieg|schieÜen|erschieÜen|töten|leiche|tod|opfer|kampf|angriff|verletzt|schmerz|angst|panik|terror|gefahr)\b/gi, '')
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
          "medium-long-shot": "MEDIUM FULL SHOT: Person visible from knees up. Most of the body in frame, showing posture and gesture while keeping face readable. Also called 'American shot'.",
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
        const sceneCharacterProfiles = resolveSceneCharacterProfiles(scenePoint);
        const sceneCharacterCount = sceneCharacterProfiles.length;
        const sceneCharacterNamesText = sceneCharacterProfiles.map((profile) => `"${profile.name}"`).join(", ");
        const sceneParticipantsText = scenePoint?.participants || sceneCharacterProfiles.map((profile) => profile.name).join(", ");
        const imageCharacterIdentityBlock = sceneCharacterProfiles.length > 0
          ? `${buildEnglishCharacterIdentityBlock(scenePoint)}
- Face: exact facial features, face shape, skin tone, freckles, scars
- Hair: exact color, style, length, texture
- Body: same body type and proportions
- Age: same approximate adult age
- Clothing & Accessories: COPY the outfit, glasses, hat, jewelry, uniform, armor - everything the named character is wearing
- Distinguishing features: tattoos, piercings, makeup, any unique physical traits`
          : `CHARACTER IDENTITY (MUST copy ALL of these from reference image):
- Face: exact facial features, face shape, skin tone, freckles, scars
- Hair: exact color, style, length, texture
- Body: same body type and proportions
- Age: same approximate adult age
- Clothing & Accessories: COPY the outfit, helmet, glasses, hat, jewelry, uniform, armor - everything the person is wearing
- Distinguishing features: tattoos, piercings, makeup, any unique physical traits`;
        const exactCharacterRequirement = sceneCharacterCount > 0
          ? sceneCharacterCount === 1
            ? `Exactly ONE person in the image: ${sceneCharacterNamesText}`
            : `Exactly ${sceneCharacterCount} people in the image: ${sceneCharacterNamesText}`
          : storyReferenceImages.length >= 2
            ? `Exactly TWO people in the image ("${storyReferenceLabels[0] || 'Person 1'}" and "${storyReferenceLabels[1] || 'Person 2'}")`
            : 'Exactly ONE person in the image';
        
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
${buildSmartReelVisualLockEnglishFromValues() ? `\n${buildSmartReelVisualLockEnglishFromValues()}\n` : ""}

${imageCharacterIdentityBlock}

CHARACTER POSE (create a NEW pose for this scene - do NOT copy the body position from reference):
Action: ${sceneKeyAction}
Expression: ${sceneEmotion}
${sceneCharacterCount > 1 ? `All named characters in participants (${sceneParticipantsText}) must wear the SAME clothing/accessories as in their own reference images, but in NEW body positions fitting this scene.` : 'The person must wear the SAME clothing/accessories as in the reference, but in a NEW body position fitting this scene.'}

TECHNICAL REQUIREMENTS:
- ${exactCharacterRequirement}
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
        const referenceImagesPayload = characterBase64Images.map((img) => img.trim()).filter(Boolean);
        
        // 1) Start image generation (don't await yet)
        const imagePromise = fetch(
          getFunctionUrl("generate-image"),
          {
            method: "POST",
            headers: getFunctionHeaders(),
            signal: controller.signal,
            body: JSON.stringify({
              prompt: imagePromptText,
              referenceImages: referenceImagesPayload,
              aspectRatio: storyboardFormat,
              mode: "image",
              apiKey: apiKey
            }),
          }
        );

        // 2) Start video prompt generation simultaneously
        const videoPromptPromise = (async () => {
          try {
            const previousEndState = sceneIndex > 0 ? currentStoryPoints[sceneIndex - 1]?.veo3EndState : null;
            
            // Build story synopsis for full narrative context
            const storySynopsis = currentStoryPoints.map((sp, idx) => {
              const spText = (sp.detailedDescription || sp.versions[sp.currentVersion] || "").slice(0, 120);
              const marker = idx === sceneIndex ? " • YOU ARE HERE" : "";
              return `${idx + 1}. "${spText}"${marker}`;
            }).join('\n');
            
            const prevScene = sceneIndex > 0 ? currentStoryPoints[sceneIndex - 1] : null;
            const prevText = prevScene ? (prevScene.detailedDescription || prevScene.versions[prevScene.currentVersion] || "").slice(0, 80) : "";
            const nextScene = sceneIndex < currentStoryPoints.length - 1 ? currentStoryPoints[sceneIndex + 1] : null;
            const nextText = nextScene ? (nextScene.detailedDescription || nextScene.versions[nextScene.currentVersion] || "").slice(0, 80) : "";
            
            const dialogInfo = buildDialogIdentityInstruction(scenePoint?.dialogText);
            
            const videoPromptText = `You are a short-form video prompt writer for AI video generators (Veo3/Kling).
${storyCreatorMode === "reel" ? `
REEL MODE - CRITICAL PRIORITY:
This video is for a vertical 9:16 social media reel (TikTok/Instagram Reels/YouTube Shorts).
Each scene is a short beat-sized clip. Total runtime follows the user brief.
RULES FOR REEL PROMPTS:
- FIRST FRAME must be visually explosive - no slow intros, no establishing shots
- Every second counts: Pack maximum visual information into minimum time
- HIGH CONTRAST between scenes: If previous scene was close-up, this should be wide or vice versa
- MOVEMENT is mandatory: Camera must move, characters must act, environment must feel alive
- Vertical composition: Key action in upper 2/3 of frame, faces prominent
- Think "scroll-stopping": What would make someone stop scrolling?
- Exaggerated emotions and dramatic lighting over subtle, realistic aesthetics
- Colors should POP: High saturation, strong contrast, cinematic color grading
` : ''}
${storyCreatorMode === "reel" ? getReelVideoPromptDirective(effectiveStoryHook) : ''}
FULL STORY ARC (${currentStoryPoints.length} scenes):
${storySynopsis}

CURRENT SCENE (${sceneIndex + 1}/${currentStoryPoints.length}): "${storyText}"${dialogInfo}

${buildEnglishCharacterIdentityBlock(scenePoint)}
${buildSmartReelVisualLockEnglishFromValues() ? `\n${buildSmartReelVisualLockEnglishFromValues()}\n` : ""}

NARRATIVE CONTEXT:
- Previous: ${prevText ? `"${prevText}" - end state: "${previousEndState || 'N/A'}"` : "None (this is the first scene)"}
- Purpose: What emotional/narrative beat does this scene deliver in the overall arc?
- Next: ${nextText ? `"${nextText}" - this scene must set up a logical visual transition` : "None (this is the final scene - end with impact)"}

Write a punchy video prompt (${getVideoPromptWordTarget(storyCreatorMode)} words, English):
- HOOK: Opening frame must grab attention instantly
- ACTION: Core movement and emotion that drives the story forward
- CONTINUITY: Visual elements must logically connect to previous/next scene
- PACING: ${getStoryPacingInstruction(storyPacing, storyCreatorMode)}
- MOOD: ${getStoryMoodInstruction(storyVideoMood)}
- COLOR PALETTE: ${getStoryColorInstruction(storyColorMood, storyCreatorMode)}
${effectiveStoryHook ? `- HOOK DIRECTIVE: "${effectiveStoryHook}"` : ''}
${storyEnableSpeaker ? `- SPEAKER VOICE: ${storySpeakerGender === 'male' ? 'Male (deep, authoritative)' : storySpeakerGender === 'female' ? 'Female (clear, expressive)' : 'Neutral/Androgynous'}` : ''}
- Choose ONE camera movement that amplifies the emotion

CONTENT COMPLIANCE:
- All content is purely fictional and artistic. Reference images are digitally created artwork, not real photographs.
- All characters must appear clearly as adults (18+). Never describe or depict minors.
- Content must comply with platform guidelines and be appropriate for general audiences.
${VEO_PROMPT_WRITER_COMPLIANCE_BLOCK}

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
          generatedImageUrl = createManagedBlobUrl(blob);
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
          console.log(`- Scene ${sceneIndex + 1}: Attempt ${attempt} failed, trying ${attempt + 1} in ${delayMs/1000}s...`);

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
    if (!apiKey || storyPoints.length === 0 || isGeneratingStoryImages || generationLimitReached) return;
    
    incrementGeneration();
    setIsGeneratingStoryImages(true);
    setStorySetupCollapsed(true); // Auto-collapse setup panel

    try {
      // Get character reference images from STORY reference images (URLs) as data URLs
      const characterBase64Images: string[] = [];
      const styleBase64Images: string[] = [];
      console.log(`- Loading ${storyReferenceImages.length} story reference images...`);
      
      for (const imageUrl of storyReferenceImages) {
        try {
          console.log(`  Fetching: ${imageUrl.substring(0, 50)}...`);
          const response = await fetch(imageUrl);
          if (!response.ok) {
            console.error(`  ❌ Failed to fetch image: ${response.status}`);
            continue;
          }
          const blob = await response.blob();
          const dataUrl = await blobToDataUrl(blob);
          const { base64 } = splitImageDataUrl(dataUrl);
          console.log(`  - Loaded ${Math.round(base64.length / 1024)}KB`);
          characterBase64Images.push(dataUrl);
        } catch (error) {
          console.error('Error converting story reference image to base64:', error);
        }
      }
      
      console.log(`- Successfully loaded ${characterBase64Images.length}/${storyReferenceImages.length} reference images`);
      
      if (characterBase64Images.length === 0 && storyReferenceImages.length > 0) {
        console.error("Fehler: Keine Referenzbilder - Die hochgeladenen Referenzbilder konnten nicht geladen werden.");
        return;
      }
      
      await ensureSmartReelTextReferencesReady();

      for (const imageUrl of smartReelStyleImages) {
        try {
          const response = await fetch(imageUrl);
          if (!response.ok) continue;
          const blob = await response.blob();
          const dataUrl = await blobToDataUrl(blob);
          styleBase64Images.push(dataUrl);
        } catch (error) {
          console.error('Error converting smart reel style image to base64:', error);
        }
      }
      
      let successCount = 0;
      const RETRIES_PER_CYCLE = 3;
      const MAX_CYCLES = 4;
      
      for (let sceneIndex = 0; sceneIndex < storyPointsRef.current.length; sceneIndex++) {
        const point = storyPointsRef.current[sceneIndex];
        if (!point) continue;

        setGeneratingStoryImageIndex(sceneIndex);
        
        // Jede Szene verwendet nur die Story-Referenzbilder.
        const sceneReferenceImages = [...characterBase64Images, ...styleBase64Images];
        console.log(`Szene ${sceneIndex + 1}: Verwende ${sceneReferenceImages.length} Original-Referenzbilder`);
        
        let result: any = null;
        let totalAttempts = 0;
        let finalErrorMessage = "";

        for (let cycleNumber = 1; cycleNumber <= MAX_CYCLES; cycleNumber++) {
          console.log(`Szene ${sceneIndex + 1}: Zyklus ${cycleNumber}/${MAX_CYCLES} mit ${RETRIES_PER_CYCLE} Versuchen...`);
          
          if (cycleNumber > 1) {
            const waitTime = Math.min(5 + (cycleNumber - 1) * 2, 15);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
          }
          
          result = await generateSingleStoryScene(
            sceneIndex,
            storyPointsRef.current[sceneIndex] || point,
            sceneReferenceImages,
            RETRIES_PER_CYCLE
          );
          
          totalAttempts += RETRIES_PER_CYCLE;
          
          if (result?.success) {
            console.log(`- Szene ${sceneIndex + 1} erfolgreich nach ${totalAttempts} Gesamtversuchen`);
            break;
          }

          finalErrorMessage = result?.errorMessage || "Unbekannter Fehler";
          const retryClass = classifyRetryableSceneError(finalErrorMessage);
          if (retryClass === "non_retryable") {
            console.warn(`- Szene ${sceneIndex + 1}: Nicht-retrybarer Fehler erkannt -> Stoppe weitere Versuche`);
            break;
          }
        }
        
        if (!result?.success) {
          const sceneError = finalErrorMessage || "Szene konnte nicht generiert werden";
          console.error(`❌ Szene ${sceneIndex + 1} dauerhaft fehlgeschlagen: ${sceneError}`);
          setStoryPoints(prev => prev.map((p, idx) => idx === sceneIndex ? { ...p, generationError: sceneError } : p));
          continue;
        }

        const finalImageUrl = result.generatedImageUrl;
        if (!finalImageUrl) {
          const sceneError = "Kein Bild generiert";
          setStoryPoints(prev => prev.map((p, idx) => idx === sceneIndex ? { ...p, generationError: sceneError } : p));
          continue;
        }
        
        setStoryPoints(prev => prev.map((p, idx) => {
          if (idx === sceneIndex) {
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
      }
      
      console.log(`- Story-Bilder fertig: ${successCount}/${storyPointsRef.current.length} Szenen erfolgreich`);
    } finally {
      setGeneratingStoryImageIndex(null);
      setIsGeneratingStoryImages(false);
      decrementGeneration();
    }
  };

  // Generate detailed ~200-word video prompts for all scenes
  const generateVideoPrompts = async () => {
    if (!apiKey || storyPoints.length === 0 || isGeneratingVideoPrompts || generationLimitReached) return;
    
    incrementGeneration();
    setIsGeneratingVideoPrompts(true);
    await ensureSmartReelTextReferencesReady();
    
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
      if (point.participants) metadataLines.push(`Teilnehmende Charaktere: ${point.participants}`);
      if (point.cameraAngle) metadataLines.push(`Kamerawinkel: ${cameraAngleToEnglish[point.cameraAngle] || point.cameraAngle}`);
      if (point.shotType) metadataLines.push(`Shot-Typ: ${shotTypeToEnglish[point.shotType] || point.shotType}`);
      if (point.composition) metadataLines.push(`Komposition: ${compositionToEnglish[point.composition] || point.composition}`);
      if (point.movement) metadataLines.push(`Kamerabewegung: ${movementToEnglish[point.movement] || point.movement}`);
      if (point.audienceEffect) metadataLines.push(`Wirkung: ${effectToEnglish[point.audienceEffect] || point.audienceEffect}`);
      if (storyboardMainLocation) metadataLines.push(`Hauptort: ${storyboardMainLocation}`);
      if (point.styleNotes) metadataLines.push(`Stil-Hinweise: ${point.styleNotes}`);
      if (point.continuityNotes) metadataLines.push(`Kontinuitäts-Hinweise: ${point.continuityNotes}`);
      if (point.dialogText) metadataLines.push(`Dialog/Sprache: "${point.dialogText}" - Integriere diesen gesprochenen Dialog WÜRTLICH in der Originalsprache in den Video-Prompt, sodass der Charakter genau diese Worte sichtbar spricht. Der Dialog darf NICHT ins Englische übersetzt werden.`);
      
      const isLastScene = i === storyPoints.length - 1;
      const nextScene = !isLastScene ? storyPoints[i + 1] : null;
      const nextSceneText = nextScene ? (nextScene.detailedDescription || nextScene.versions[nextScene.currentVersion] || "") : "";
      
      // Build story synopsis for full narrative context
      const storySynopsis = storyPoints.map((sp, idx) => {
        const spText = (sp.detailedDescription || sp.versions[sp.currentVersion] || "").slice(0, 120);
        const marker = idx === i ? " • YOU ARE HERE" : "";
        return `${idx + 1}. "${spText}"${marker}`;
      }).join('\n');
      
      const prevScene = i > 0 ? storyPoints[i - 1] : null;
      const prevText = prevScene ? (prevScene.detailedDescription || prevScene.versions[prevScene.currentVersion] || "").slice(0, 80) : "";
      
      const dialogLine = buildDialogIdentityInstruction(point.dialogText);
      const characterIdentityBlock = buildEnglishCharacterIdentityBlock(point);

      const videoPromptRequest = `You are a short-form video prompt writer for AI video generators (Veo3/Kling).
${storyCreatorMode === "reel" ? `
REEL MODE - CRITICAL PRIORITY:
This video is for a vertical 9:16 social media reel (TikTok/Instagram Reels/YouTube Shorts).
Each scene is a short beat-sized clip. Total runtime follows the user brief.
RULES FOR REEL PROMPTS:
- FIRST FRAME must be visually explosive - no slow intros
- Every second counts: Maximum visual density in minimum time
- HIGH CONTRAST between consecutive scenes (alternate close-up/wide, static/dynamic)
- MOVEMENT is mandatory: Camera moves, characters act, environment is alive
- Vertical composition: Key action in upper 2/3 of frame
- "Scroll-stopping" visuals: Exaggerated emotions, dramatic lighting, high saturation
- Colors must POP with strong contrast and cinematic grading
` : ''}
${storyCreatorMode === "reel" ? getReelVideoPromptDirective(effectiveStoryHook) : ''}
FULL STORY ARC (${storyPoints.length} scenes):
${storySynopsis}

CURRENT SCENE (${i + 1}/${storyPoints.length}): "${sceneText}"${dialogLine}

${characterIdentityBlock}
${buildSmartReelVisualLockEnglishFromValues() ? `\n${buildSmartReelVisualLockEnglishFromValues()}\n` : ""}

SCENE METADATA:
${metadataLines.length > 0 ? metadataLines.join('\n') : 'No specific settings'}

NARRATIVE CONTEXT:
- Previous: ${prevText ? `"${prevText}" - end state: "${previousEndState || 'N/A'}"` : "None (this is the first scene - open with a strong hook)"}
- Purpose: What emotional/narrative beat does this scene deliver in the overall arc?
- Next: ${nextSceneText ? `"${nextSceneText}" - this scene must set up a logical visual transition to the next` : "None (this is the final scene - end with maximum impact)"}

Write a punchy video prompt (${getVideoPromptWordTarget(storyCreatorMode)} words, English):
- HOOK: Opening frame must grab attention instantly
- ACTION: Core movement and emotion that drives the story forward
- CONTINUITY: Visual elements must logically connect to previous/next scene
- PACING: ${getStoryPacingInstruction(storyPacing, storyCreatorMode)}
- MOOD: ${getStoryMoodInstruction(storyVideoMood)}
- COLOR PALETTE: ${getStoryColorInstruction(storyColorMood, storyCreatorMode)}
${effectiveStoryHook ? `- HOOK DIRECTIVE: "${effectiveStoryHook}"` : ''}
${storyEnableSpeaker ? `- SPEAKER VOICE: ${storySpeakerGender === 'male' ? 'Male (deep, authoritative)' : storySpeakerGender === 'female' ? 'Female (clear, expressive)' : 'Neutral/Androgynous'}` : ''}
- Choose ONE camera movement that amplifies the emotion
${VEO_PROMPT_WRITER_COMPLIANCE_BLOCK}

Respond ONLY with JSON:
{
  "videoPrompt": "The complete English video prompt (${getVideoPromptWordTarget(storyCreatorMode)} words)",
  "cameraMovement": "descriptive camera movement id",
  "startState": "Start frame description (1 sentence)",
  "motion": "Motion description (1 sentence)",
  "endState": "End frame description (1 sentence)"
}`;

      // Collect a maximum of 3 image references for the Veo-adjacent prompt writer.
      // Style images are translated to text beforehand and are NOT attached as images here.
      const videoReferenceImages: string[] = [];
      const loadImageAsDataUrl = async (imageUrl?: string) => {
        if (!imageUrl || videoReferenceImages.length >= VEO_REFERENCE_IMAGE_LIMIT) return;
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          videoReferenceImages.push(dataUrl);
        } catch (e) {
          console.warn("Could not load image reference for video prompt:", e);
        }
      };

      await loadImageAsDataUrl(point.generatedImage);
      for (const imageUrl of storyReferenceImages.slice(0, VEO_REFERENCE_IMAGE_LIMIT)) {
        if (videoReferenceImages.length >= VEO_REFERENCE_IMAGE_LIMIT) break;
        await loadImageAsDataUrl(imageUrl);
      }
      if (videoReferenceImages.length < VEO_REFERENCE_IMAGE_LIMIT) {
        await loadImageAsDataUrl(storyPoints[i - 1]?.generatedImage);
      }
      if (videoReferenceImages.length < VEO_REFERENCE_IMAGE_LIMIT) {
        await loadImageAsDataUrl(storyPoints[i + 1]?.generatedImage);
      }

      console.log(`- Szene ${i + 1}: ${videoReferenceImages.length}/${VEO_REFERENCE_IMAGE_LIMIT} Bildreferenzen für den Video-Prompt`);

      try {
        // Build parts: text + optional reference images
        const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: videoPromptRequest }];
        if (videoReferenceImages.length > 0) {
          for (const img of videoReferenceImages) {
            const { mimeType, base64 } = splitImageDataUrl(img);
            if (!base64) continue;
            parts.push({ inlineData: { mimeType: mimeType || "image/png", data: base64 } });
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
    decrementGeneration();
  };

  // Session-level cache for working Veo payload format and model
  const veoWorkingConfigRef = React.useRef<{ payloadFormat: 'inlineData' | 'bytesBase64Encoded' | null; model: string | null }>({ payloadFormat: null, model: null });

  const VEO_PROMPT_WRITER_COMPLIANCE_BLOCK = `COMPLIANCE REQUIREMENTS:
- Keep the final prompt fully within platform safety guidelines and appropriate for general audiences.
- Treat the scene as purely fictional and artistic.
- Any reference images are hand-drawn or digitally created artwork of fictional adult characters, not photographs of real people.
- All depicted characters must remain clearly adults (18+).
- Avoid wording that implies nudity, sexual content, minors, graphic injury, gore, self-harm, abuse, or real-person likeness.
- If the scene contains danger, tension, argument, fear, or conflict, describe it in a mild cinematic way without graphic details, visible injury, or explicit harm.
- Favor safe wording such as cinematic tension, emotional intensity, dramatic atmosphere, urgent movement, or suspenseful mood over risky explicit language.`;

  const withVeoCompliancePrefix = (prompt: string) => {
    const cleanPrompt = prompt.trim();
    const compliancePrefix = "SAFETY CONTEXT: This video is purely fictional artistic content and must stay fully within platform safety guidelines. Any reference images are hand-drawn or digitally created artwork of fictional adult characters, not photographs of real people. All depicted characters are clearly adults aged 18+. Keep the scene non-graphic, non-explicit, non-sexual, and appropriate for general audiences. If there is tension or conflict, render it as mild cinematic suspense without injury details. ";
    return `${compliancePrefix}${cleanPrompt}`;
  };

  // Helper: Build Veo request body (bytesBase64Encoded only)
  const buildVeoRequestBody = (prompt: string, startImageBase64: string, endImageBase64?: string, aspectRatio?: string) => {
    const startImage = splitImageDataUrl(startImageBase64);
    const instance: any = { prompt: withVeoCompliancePrefix(prompt) };

    instance.image = { bytesBase64Encoded: startImage.base64, mimeType: startImage.mimeType || "image/png" };
    if (endImageBase64) {
      const endImage = splitImageDataUrl(endImageBase64);
      instance.lastFrame = { bytesBase64Encoded: endImage.base64, mimeType: endImage.mimeType || "image/png" };
    }

    return {
      instances: [instance],
      parameters: {
        aspectRatio: aspectRatio || "16:9",
        durationSeconds: 8,
        personGeneration: "allow_adult",
      },
    };
  };

  // Helper: Start Gemini Veo video generation (bytesBase64Encoded, model fallback only)
  const startGeminiVideoGeneration = async (prompt: string, startImageBase64: string, endImageBase64?: string, aspectRatio?: string): Promise<string> => {
    const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
    const models = getVideoModelCandidates(storyVideoModel);

    // Try cached model first
    const cached = veoWorkingConfigRef.current;
    const orderedModels = cached.model 
      ? [cached.model, ...models.filter(m => m !== cached.model)]
      : models;

    const requestBody = buildVeoRequestBody(prompt, startImageBase64, endImageBase64, aspectRatio);
    let lastError = "";

    for (const model of orderedModels) {
      console.log(`- Veo attempt: configured=${mapStoryModelLabel(storyVideoModel)}, model=${model}`);

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
        console.log(`- Veo OK: model=${model}, op=${operationName}`);
        return operationName;
      }

      const errText = await response.text();
      console.warn(`⚠️ Veo ${model} - ${response.status}: ${errText.substring(0, 300)}`);

      if (response.status === 429) throw new Error("Rate limit erreicht. Bitte warte einen Moment.");
      if (response.status === 401 || response.status === 403) throw new Error("API-Key ungültig oder keine Berechtigung für Video-Generierung");

      if (response.status === 400) {
        lastError = errText.substring(0, 200);
        continue;
      }

      throw new Error(`Video-Generierung fehlgeschlagen: ${response.status} - ${errText.substring(0, 200)}`);
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
      if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
        return { status: "failed", error: `Status-Abfrage fehlgeschlagen (${response.status})` };
      }
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
      console.log("- Veo done - response keys:", Object.keys(resp).join(", "));
      
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
        console.log("- Video URL extrahiert, konvertiere zu Blob...");
        try {
          const videoResp = await fetch(remoteUrl);
          if (!videoResp.ok) throw new Error(`Video download failed: ${videoResp.status}`);
          const videoBlob = await videoResp.blob();
          const blobUrl = createManagedBlobUrl(videoBlob);
          console.log("- Video als Blob-URL gespeichert");
          return { status: "completed", videoUrl: blobUrl };
        } catch (dlErr) {
          console.warn("⚠️ Blob-Konvertierung fehlgeschlagen, nutze direkte URL:", dlErr);
          return { status: "completed", videoUrl: remoteUrl };
        }
      }
      
      // Fallback: direct base64 video in predictions
      const prediction = resp.predictions?.[0];
      if (prediction?.bytesBase64Encoded) {
        console.log("- Video als Base64 in predictions erhalten");
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
      console.error("- Response preview:", JSON.stringify(resp).substring(0, 800));
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
          console.log(`- Szene ${sceneIndex + 1}: Erneuter Versuch ${retry}/${MAX_RETRIES}...`);
          setVideoErrors(prev => {
            const n = new Map(prev);
            n.set(sceneIndex, `Server-Fehler - erneuter Versuch ${retry}/${MAX_RETRIES}...`);
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

        const operationName = await startGeminiVideoGeneration(point.videoPrompt!, startBase64, endBase64, storyboardFormat);
        console.log(`- Szene ${sceneIndex + 1}: Video-Operation gestartet: ${operationName}`);
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
            console.log(`- Szene ${sceneIndex + 1} Status: ${result.status}`);

            if (result.status === "completed" && result.videoUrl) {
              setVideoResults(prev => new Map(prev).set(sceneIndex, result.videoUrl!));
              setStoryPoints(prev => prev.map((p, i) =>
                i === sceneIndex ? { ...p, generatedVideo: result.videoUrl } : p
              ));
              return; // Success - exit retry loop
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

  // Generate videos via Gemini Veo API - sequential, one at a time
  const generateVideos = async () => {
    if (storyPoints.length === 0 || isGeneratingVideos || !apiKey || generationLimitReached) return;
    
    incrementGeneration();
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
    decrementGeneration();
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
    if (!point.videoPrompt || isGeneratingVideos || !apiKey || generationLimitReached) return;
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
          const dataUrl = await blobToDataUrl(blob);
          characterBase64Images.push(dataUrl);
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
            const prevDataUrl = await blobToDataUrl(blob);
            allReferenceImages.push(prevDataUrl);
          } catch (error) {
            console.error('Error converting previous scene image:', error);
          }
        }
        
        const imageResponse = await fetch(
          getFunctionUrl("generate-image"),
          {
            method: "POST",
            headers: getFunctionHeaders(),
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
          generatedImageUrl = createManagedBlobUrl(blob);
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
          errorMessage = error.name === 'AbortError' ? "Zeitüberschreitung - keine Antwort nach 40s" : error.message;
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
    
    // Now generate video - read fresh state from ref
    incrementGeneration();
    setIsGeneratingVideos(true);
    
    let freshPoint = storyPointsRef.current[sceneIndex];
    await ensureSmartReelTextReferencesReady();
    
    // Regenerate video prompt with latest dialogText and scene data
    try {
      const currentStoryPoints = storyPointsRef.current;
      const previousEndState = sceneIndex > 0 ? currentStoryPoints[sceneIndex - 1]?.veo3EndState : null;
      
      const storySynopsis = currentStoryPoints.map((sp, idx) => {
        const spText = (sp.detailedDescription || sp.versions[sp.currentVersion] || "").slice(0, 120);
        const marker = idx === sceneIndex ? " • YOU ARE HERE" : "";
        return `${idx + 1}. "${spText}"${marker}`;
      }).join('\n');
      
      const storyText = freshPoint.detailedDescription || freshPoint.versions[freshPoint.currentVersion] || "";
      const prevScene = sceneIndex > 0 ? currentStoryPoints[sceneIndex - 1] : null;
      const prevText = prevScene ? (prevScene.detailedDescription || prevScene.versions[prevScene.currentVersion] || "").slice(0, 80) : "";
      const nextScene = sceneIndex < currentStoryPoints.length - 1 ? currentStoryPoints[sceneIndex + 1] : null;
      const nextText = nextScene ? (nextScene.detailedDescription || nextScene.versions[nextScene.currentVersion] || "").slice(0, 80) : "";
      
      const dialogInfo = buildDialogIdentityInstruction(freshPoint.dialogText);
      const characterIdentityBlock = buildEnglishCharacterIdentityBlock(freshPoint);
      
      const videoPromptText = `You are a short-form video prompt writer for AI video generators (Veo3/Kling).
${storyCreatorMode === "reel" ? getReelVideoPromptDirective(effectiveStoryHook) : ""}

FULL STORY ARC (${currentStoryPoints.length} scenes):
${storySynopsis}

CURRENT SCENE (${sceneIndex + 1}/${currentStoryPoints.length}): "${storyText}"${dialogInfo}

${characterIdentityBlock}
${buildSmartReelVisualLockEnglishFromValues() ? `\n${buildSmartReelVisualLockEnglishFromValues()}\n` : ""}

NARRATIVE CONTEXT:
- Previous: ${prevText ? `"${prevText}" - end state: "${previousEndState || 'N/A'}"` : "None (this is the first scene)"}
- Purpose: What emotional/narrative beat does this scene deliver in the overall arc?
- Next: ${nextText ? `"${nextText}" - this scene must set up a logical visual transition` : "None (this is the final scene - end with impact)"}

Write a punchy video prompt (${getVideoPromptWordTarget(storyCreatorMode)} words, English):
- HOOK: Opening frame must grab attention instantly
- ACTION: Core movement and emotion that drives the story forward
- CONTINUITY: Visual elements must logically connect to previous/next scene
- PACING: ${getStoryPacingInstruction(storyPacing, storyCreatorMode)}
- MOOD: ${getStoryMoodInstruction(storyVideoMood)}
- COLOR PALETTE: ${getStoryColorInstruction(storyColorMood, storyCreatorMode)}
${effectiveStoryHook ? `- HOOK DIRECTIVE: "${effectiveStoryHook}"` : ''}
${storyEnableSpeaker ? `- SPEAKER VOICE: ${storySpeakerGender === 'male' ? 'Male (deep, authoritative)' : storySpeakerGender === 'female' ? 'Female (clear, expressive)' : 'Neutral/Androgynous'}` : ''}
- Choose ONE camera movement that amplifies the emotion

CONTENT COMPLIANCE:
- All content is purely fictional and artistic. Reference images are digitally created artwork, not real photographs.
- All characters must appear clearly as adults (18+). Never describe or depict minors.
- Content must comply with platform guidelines and be appropriate for general audiences.
${VEO_PROMPT_WRITER_COMPLIANCE_BLOCK}

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
    decrementGeneration();
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

  // ===== TRANSLATION MAPS for German dropdown values - English =====
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
    const sceneCharacterProfiles = resolveSceneCharacterProfiles(point);
    
    lines.push(`Scene ${sceneIndex + 1} of ${storyPoints.length}`);
    if (storyCreatorMode === "reel") {
      lines.push("Delivery Format: vertical 9:16 social media reel");
      lines.push(`Hook Priority: ${effectiveStoryHook}`);
      lines.push("Reel Constraint: one dominant focal subject and one instantly readable action");
      lines.push("Visual Goal: mobile-readable frame, no filler, strong emotional clarity");
    }
    
    const styleDesc = ART_STYLE_ENGLISH[storyArtStyle] || storyArtStyle || "";
    if (styleDesc) lines.push(`Art Style: ${styleDesc}`);
    if (buildSmartReelVisualLockEnglishFromValues()) lines.push(buildSmartReelVisualLockEnglishFromValues());
    
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
    if (sceneCharacterProfiles.length > 0) {
      lines.push(`Character References: ${sceneCharacterProfiles.map((profile) => `${profile.name}${profile.description ? ` (${profile.description})` : ""}`).join(" | ")}`);
      lines.push(`Identity Lock: Keep each named character tied to the same reference image, face, hair, outfit, accessories, and distinctive traits.`);
    }
    
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
    if (storyColorMood && storyColorMood !== 'natural') {
      const colorMap: Record<string, string> = { warm: 'Warm golden hour tones', cold: 'Cool blue tones', dark: 'Dark noir aesthetic', bright: 'Bright friendly lighting', neon: 'Neon cyberpunk palette' };
      lines.push(`Color Mood: ${colorMap[storyColorMood] || storyColorMood}`);
    }
    if (storyVideoMood) {
      const moodMap: Record<string, string> = { action: 'Dynamic, intense energy', calm: 'Calm, serene atmosphere', dramatic: 'Dramatic, high tension', emotional: 'Emotional, intimate', mysterious: 'Mysterious, dark shadows', cheerful: 'Cheerful, bright and upbeat' };
      lines.push(`Atmosphere: ${moodMap[storyVideoMood] || storyVideoMood}`);
    }
    
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
      ? `\n\n!!! MANDATORY ART STYLE: "${styleDesc}" !!!\nThe ENTIRE image MUST be rendered in this style. Every element - characters, background, lighting, textures - must look like a ${styleDesc}. Do NOT render anything photorealistically unless the style explicitly says so. Describe the visual medium, textures, colors, and rendering technique of "${styleDesc}" in your prompt.\n`
      : "";
    
    const systemInstruction = `You are an expert image prompt writer. You MUST faithfully include ALL scene details below. Do NOT omit, simplify, or generalize any of them.
${styleBlock}
PRIORITY HIERARCHY (strictly follow this order):
1. User-defined scene settings (HIGHEST - always override defaults)
2. Scene uniqueness (each scene must look distinct)
3. Visual consistency with other scenes (LOWEST - only for character identity)

REQUIRED FIELDS - you MUST explicitly include EACH of these in your prompt:
- Art Style/Medium: ${styleDesc ? `"${styleDesc}" (MANDATORY - describe the visual medium, textures, rendering technique)` : "describe the visual style"}
- Shot Type: Use the EXACT shot type specified (e.g. close-up, full-shot). Do NOT change it.
- Camera Angle: Use the EXACT camera angle specified. Do NOT default to eye-level.
- Location + Specific Area: Describe the exact environment and sub-location.
- Character Action: Describe the EXACT action specified - not a generic standing/posing.
- Character Expression/Emotion: Show the SPECIFIC emotion on the character's face and body language.
- Composition: Follow any composition notes precisely.
- Camera Movement: Reflect any specified camera movement in the framing.
- Style Notes: Incorporate all additional style instructions.
- Avoid: Respect all negative prompts / things to avoid.

Rules:
- Write a single descriptive paragraph (max 250 words).${styleDesc ? `\n- START the prompt by describing the art style/medium (e.g. "A ${styleDesc} depicting..."). This is critical.` : ""}
- Reference images are ONLY for character identity (face, body, clothing) - do NOT copy pose, style, or scene from them.
- If named character references are provided, never swap identities between those names.
- The character must have a NEW pose matching the scene action.
- Do NOT copy the visual style or medium of reference images.${styleDesc ? `\n- The visual style MUST be "${styleDesc}", NOT photorealistic, NOT a photograph.` : ""}
- Each scene must reflect its UNIQUE settings. Do NOT default to generic descriptions.
${storyCreatorMode === "reel" ? `- REEL MODE: This image is a keyframe for a vertical reel, so it must communicate the hook instantly on a phone screen.
- REEL MODE: Keep ONE dominant focal subject/action, with strong silhouette, strong contrast, and zero visual clutter.
- REEL MODE: Avoid slow establishing-shot energy, passive posing, and weak emotional reads.` : ""}
- CONTENT COMPLIANCE: All content is purely fictional and artistic. Reference images are digitally created artwork. All characters are clearly adults (18+).
- Output ONLY the image prompt text, nothing else. No explanations, no markdown, no quotes.

Scene Details:
${sceneContext}`;

    console.log(`🔄 Step 1: Asking Text-AI to write image prompt for scene ${sceneIndex + 1}...`);
    
    try {
      const aiPrompt = await callGeminiOrFull(
        [{ text: systemInstruction }],
        { model: "gemini-2.0-flash", temperature: 0.7, maxOutputTokens: 500 }
      );
      
      if (!aiPrompt) {
        console.warn("⚠️ Empty AI prompt, falling back to scene context");
        return sceneContext;
      }
      
      console.log(`- AI-generated image prompt for scene ${sceneIndex + 1}:`, aiPrompt.substring(0, 200) + '...');
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
    
    // Clear previous error (keep old image visible until a new one succeeds)
    setStoryPoints(prev => prev.map((p, idx) => {
      if (idx === sceneIndex) {
        return { ...p, generationError: undefined };
      }
      return p;
    }));
    
    // Use updatedPoint if provided (contains latest edits from popup), otherwise use latest ref state
    const point = updatedPoint || storyPointsRef.current[sceneIndex];
    console.log("- Regenerating with point data:", {
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
        const dataUrl = await blobToDataUrl(blob);
        characterBase64Images.push(dataUrl);
      } catch (error) {
        console.error('Error converting story reference image to base64:', error);
      }
    }
    
    // Get previous scene's image for continuity (NOT the current scene's old image)
    const previousSceneImage = sceneIndex > 0 ? storyPointsRef.current[sceneIndex - 1]?.generatedImage : null;
    
    const controller = new AbortController();
    activeRegenerationController.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout
    
    try {
      // Step 1: Let Text-AI write the image prompt
      const imagePromptText = await generateImagePromptViaAI(point, sceneIndex);
      
      console.log(`- Step 2: Sending AI-generated prompt to image AI for scene ${sceneIndex + 1}:`, imagePromptText.substring(0, 200) + '...');
      
      // Build image parts - collect all reference images as base64
      const allReferenceImages: string[] = [...characterBase64Images];
      
      // Add previous scene's image for visual continuity (NOT the current scene's old image)
      if (previousSceneImage) {
        try {
          const response = await fetch(previousSceneImage);
          const blob = await response.blob();
          const prevDataUrl = await blobToDataUrl(blob);
          allReferenceImages.push(prevDataUrl);
        } catch (e) {
          console.warn("Could not add previous scene as reference:", e);
        }
      }
      
      // Call edge function for image generation
      const imageResponse = await fetch(
        getFunctionUrl("generate-image"),
        {
          method: "POST",
          headers: getFunctionHeaders(),
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
        generatedImageUrl = createManagedBlobUrl(blob);
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
          const updatedPoint = {
            ...p,
            ...point, // Merge current point values to ensure state is in sync
            generatedImage: generatedImageUrl,
            detailedImagePrompt: imagePromptText,
            generationError: undefined,
            generationSnapshot,
            // Clear video if it existed - it's now stale since the image changed
            ...(hadVideo ? { generatedVideo: undefined } : {}),
          };
          // Auto-save as new version on regeneration
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
      
      // Trigger flip-back animation
      setRegeneratingCardIndex(null);
      setJustFinishedIndex(sceneIndex);
      setFlippedCards(prev => new Set(prev).add(sceneIndex));
      setTimeout(() => setJustFinishedIndex(null), 700);
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      let errorMessage = "Unbekannter Fehler";
      if (error instanceof Error) {
        errorMessage = error.name === 'AbortError' ? "Zeitüberschreitung - keine Antwort nach 20s" : error.message;
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
      activeRegenerationController.current = null;
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
        const dataUrl = await blobToDataUrl(blob);
        characterBase64Images.push(dataUrl);
      } catch (error) {
        console.error('Error converting story reference image to base64:', error);
      }
    }
    
    // Get previous scene's image for additional context
    const previousSceneImage = sceneIndex > 0 ? storyPoints[sceneIndex - 1]?.generatedImage : null;
    
    const controller = new AbortController();
    activeRegenerationController.current = controller;
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
          const prevDataUrl = await blobToDataUrl(blob);
          allReferenceImages.push(prevDataUrl);
        } catch (error) {
          console.error('Error converting previous scene image:', error);
        }
      }
      
      // NOTE: Current scene's own image is intentionally NOT added as reference
      // to ensure a fresh generation without self-referencing

      // Call edge function for image generation (same as regenerateSingleStoryScene)
      const imageResponse = await fetch(
        getFunctionUrl("generate-image"),
        {
          method: "POST",
          headers: getFunctionHeaders(),
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
        generatedImageUrl = createManagedBlobUrl(blob);
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
        errorMessage = error.name === 'AbortError' ? "Zeitüberschreitung - keine Antwort nach 20s" : error.message;
      }
      
      console.error(`Szene ${sceneIndex + 1} fehlgeschlagen:`, errorMessage);
      
      setStoryPoints(prev => prev.map((p, idx) => {
        if (idx === sceneIndex) {
          return { ...p, generationError: errorMessage };
        }
        return p;
      }));
    } finally {
      activeRegenerationController.current = null;
      setRegeneratingImageOnlyIndex(null);
      setRegeneratingPointIndex(null);
    }
  };

  const handleSuggestionClick = async (suggestion: string, index: number) => {
    setSelectedSuggestionIndex(index);
    setIsAnimatingSuggestion(true);
    
    const expandCount = parseInt(ideaCount) || 1;
    
    // After animation completes, expand the short summary into full text(s)
    setTimeout(async () => {
      setIsAnimatingSuggestion(false);
      setSelectedSuggestionIndex(null);
      
      // Clear suggestions and text, show overlay
      setStoryIdea("");
      setStorySuggestions([]);
      setIsExpandingSuggestion(true);
      
      try {
        const isDialogMode = storyEnableSpeaker && storyGenerationDirection === "description-from-speaker";
        const reelExpandExtra = storyCreatorMode === "reel" ? `
- REEL-OPTIMIERT: Denke an viralen TikTok-Content mit Millionen Views
- Übertriebene Emotionen: Subtilität funktioniert NICHT auf Social Media
- Jeder Satz muss "scroll-stopping" sein - warum sollte jemand weiterschauen?
- Genau ein dominanter Konflikt oder Fokus pro Beat
- Polarisierend oder emotional schockierend` : '';
        
        const multiPrefix = expandCount > 1 
          ? `Erstelle genau ${expandCount} verschiedene Varianten. Jede soll einen anderen Ansatz, Ton oder Fokus haben. Trenne die Varianten mit "---" auf einer eigenen Zeile.\n\n` 
          : '';
        
        const expandPrompt = isDialogMode
          ? `${multiPrefix}Erweitere diese Dialog-Zusammenfassung zu ${expandCount > 1 ? `${expandCount} packenden, emotionalen Dialogen` : 'einem packenden, emotionalen Dialog'} - optimiert für ein Social-Media-Video (TikTok/Reels/Shorts) mit der vom Nutzer vorgegebenen Länge.

REGELN:
- 4-8 Sätze gesprochener Dialog, filmisch und emotional
- Hook-First: Der ERSTE Satz muss sofort fesseln (provokant, überraschend, emotional)
- Natürlich klingende Sprache, keine steifen Formulierungen
- Emotionale Intensität: Jeder Satz muss eine Reaktion auslösen
- Denke an Pacing: Kurze, punchy Sätze wechseln sich mit emotionalen Momenten ab${reelExpandExtra}

Zusammenfassung: "${suggestion}"

Antworte NUR mit ${expandCount > 1 ? `den ${expandCount} fertigen Dialog-Texten, getrennt durch "---"` : 'dem fertigen Dialog-Text'}, ohne Erklärungen oder Anführungszeichen drumherum. Auf Deutsch.`
          : `${multiPrefix}Erweitere diese kurze Story-Zusammenfassung zu ${expandCount > 1 ? `${expandCount} visuell packenden Szenenbeschreibungen` : 'einer visuell packenden Szenenbeschreibung'} - optimiert für Social-Media-Videos (TikTok/Reels/Shorts) mit der vom Nutzer vorgegebenen Länge.

REGELN:
- 3-6 Sätze, visuell und atmosphärisch
- Hook-First: Die Beschreibung muss mit dem visuell stärksten Moment starten
- Dynamisch: Beschreibe Bewegung, Aktion, Emotionen - keine statischen Bilder
- Emotional: Jede Szene braucht einen klaren emotionalen Beat
- Denke in Szenen die man FILMEN kann: Kamerabewegungen, Licht, Mimik${reelExpandExtra}

Zusammenfassung: "${suggestion}"

Antworte NUR mit ${expandCount > 1 ? `den ${expandCount} fertigen Beschreibungen, getrennt durch "---"` : 'der fertigen Beschreibung'}, ohne Erklärungen. Auf Deutsch.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: expandPrompt }] }],
              generationConfig: {
                temperature: 0.9,
                maxOutputTokens: Math.max(expandCount * 800, 2000)
              }
            }),
          }
        );

        let expandedIdeas: string[] = [suggestion];
        if (response.ok) {
          const data = await response.json();
          const expandedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (expandedText) {
            if (expandCount > 1) {
              const split = expandedText.split(/\n\s*-{3,}\s*\n|\n\s*_{3,}\s*\n/).map((s: string) => s.trim()).filter((s: string) => s.length > 15);
              expandedIdeas = split.length > 0 ? split : [expandedText];
            } else {
              expandedIdeas = [expandedText];
            }
          }
        }
        
        // Set first idea with word-by-word animation
        setIsExpandingSuggestion(false);
        const firstIdea = expandedIdeas[0];
        const words = firstIdea.split(/\s+/);
        let accumulated = "";
        for (let w = 0; w < words.length; w++) {
          accumulated += (w > 0 ? " " : "") + words[w];
          setStoryIdea(accumulated);
          await new Promise(r => setTimeout(r, 12));
        }
        
        // If multiple ideas, populate the idea navigation
        if (expandedIdeas.length > 1) {
          setGeneratedIdeas(expandedIdeas);
          setCurrentIdeaIndex(0);
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
    
    const suggestCount = parseInt(ideaCount) || 3;
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
                  ? `Generiere genau ${suggestCount} sehr kurze DIALOG-ZUSAMMENFASSUNGEN (maximal 4-6 Wörter pro Zusammenfassung). Jede beschreibt knapp das Thema eines möglichen Dialogs - optimiert für kurze, packende Social-Media-Videos (TikTok, Reels, Shorts).
${storyCreatorMode === "reel" ? `
REEL-FOKUS: Die Dialoge müssen SOFORT polarisieren oder emotional schocken. Denke an virale TikTok-Dialoge:
- Konfrontationen, Geständnisse, überraschende Enthüllungen
- Emotionale Ausbrüche, dramatische Wendungen
- Der erste Satz muss zum Weiterschauen zwingen
- Eine klare Konfliktlinie, kein verwaschener Smalltalk
` : ''}
Die Dialoge sollen emotional, direkt und sofort fesselnd sein. Denke an Hook-First: Der erste Satz muss Aufmerksamkeit grabben.

Gute Beispiele:
${storyCreatorMode === "reel" ? `- Freundin erwischt bei Lüge
- Unbekannter kennt dein Geheimnis
- Chef sagt die Wahrheit` : `- Konfrontation nach dem Betrug
- Liebesgeständnis im Regen
- Letzte Nachricht vor dem Abflug`}

Antworte NUR mit den ${suggestCount} kurzen Zusammenfassungen, eine pro Zeile, ohne Nummerierung oder Aufzählungszeichen. Auf Deutsch.`
                  : `Generiere genau ${suggestCount} sehr kurze STORY-ZUSAMMENFASSUNGEN (maximal 4-6 Wörter pro Zusammenfassung). Jede beschreibt knapp das Thema einer möglichen Geschichte - optimiert für kurze, packende Social-Media-Videos (TikTok, Reels, Shorts).
${storyCreatorMode === "reel" ? `
REEL-FOKUS: Die Geschichten müssen VIRAL-POTENZIAL haben. Denke an Content der auf TikTok Millionen Views bekommt:
- Schockierende Wendungen, emotionale Achterbahnen
- Relateable Situationen mit unerwartetem Ausgang
- "Was würdest DU tun?" Szenarien
- Polarisierende oder kontroverse Alltagssituationen
- Ein klarer visueller Fokus statt zu vieler Ideen auf einmal
` : ''}
WICHTIG: Die Geschichten müssen sofort fesseln (Hook-First), emotional intensiv sein und sich für schnelle, dynamische Video-Szenen eignen. Realistische UND dramatische Themen.

Gute Beispiele:
${storyCreatorMode === "reel" ? `- Taxifahrer erkennt vermisste Tochter
- Date merkt: Es ist der Ex
- Paket enthält unmöglichen Brief` : `- Fremder rettet Kind im Park
- Traumjob-Absage verändert alles
- Zufälliges Wiedersehen nach Jahren`}

Antworte NUR mit den ${suggestCount} kurzen Zusammenfassungen, eine pro Zeile, ohne Nummerierung oder Aufzählungszeichen. Auf Deutsch.`
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
            .slice(0, suggestCount);
          
          if (ideas.length >= 1) {
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
  const currentSuggestionMode = `${storyCreatorMode}-${storyEnableSpeaker && storyGenerationDirection === "description-from-speaker" ? "dialog" : "story"}`;
  
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
    let sessionApiKey: string | null = null;
    try {
      sessionApiKey = sessionStorage.getItem("session_gemini_api_key");
    } catch (storageError) {
      console.warn("Could not read session API key:", storageError);
    }

    if (sessionApiKey) {
      setApiKey(sessionApiKey);
    } else {
      // Backward-compat migration from old cookie storage.
      const savedApiKey = getCookie("gemini_api_key");
      if (savedApiKey) {
        setApiKey(savedApiKey);
        try {
          sessionStorage.setItem("session_gemini_api_key", savedApiKey);
        } catch (storageError) {
          console.warn("Could not migrate API key to sessionStorage:", storageError);
        }
      }
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

    // Restore session state
    try {
      const s = sessionStorage;
      const si = s.getItem.bind(s);
      if (si('session_storyIdea')) setStoryIdea(si('session_storyIdea')!);
      if (si('session_storyCustomDetails')) setStoryCustomDetails(si('session_storyCustomDetails')!);
      if (si('session_storyArtStyle')) setStoryArtStyle(si('session_storyArtStyle')!);
      if (si('session_storyPointCount')) setStoryPointCount(Number(si('session_storyPointCount')));
      if (si('session_sceneDescription')) setSceneDescription(si('session_sceneDescription')!);
      if (si('session_customPrompt')) setCustomPrompt(si('session_customPrompt')!);
      if (si('session_selectedBackground')) setSelectedBackground(si('session_selectedBackground')!);
      if (si('session_activeView')) setActiveView(si('session_activeView') as any);
      if (si('session_activeMainTab')) setActiveMainTab(si('session_activeMainTab') as any);
      if (si('session_storyboardMainLocation')) setStoryboardMainLocation(si('session_storyboardMainLocation')!);
      if (si('session_storyEnableSpeaker')) setStoryEnableSpeaker(si('session_storyEnableSpeaker') === 'true');
      if (si('session_storyVoiceMode')) setStoryVoiceMode(si('session_storyVoiceMode') as any);
      if (si('session_storyGenerationDirection')) setStoryGenerationDirection(si('session_storyGenerationDirection') as any);
      if (si('session_storyboardFormat')) setStoryboardFormat(si('session_storyboardFormat')!);
      if (si('session_storySpeakerGender')) setStorySpeakerGender(si('session_storySpeakerGender') as any);
      if (si('session_storyVideoMood')) setStoryVideoMood(si('session_storyVideoMood')!);
      if (si('session_storyColorMood')) setStoryColorMood(si('session_storyColorMood')!);
      if (si('session_storyHook')) setStoryHook(si('session_storyHook')!);
      if (si('session_storyPacing')) setStoryPacing(si('session_storyPacing')!);
      if (si('session_storyCreatorMode')) setStoryCreatorMode(si('session_storyCreatorMode') as any);
      if (si('session_smartReelModeEnabled')) setSmartReelModeEnabled(si('session_smartReelModeEnabled') === 'true');
      if (si('session_smartReelTranscript')) setSmartReelTranscript(si('session_smartReelTranscript')!);
      if (si('session_smartReelReferenceSummary')) setSmartReelReferenceSummary(si('session_smartReelReferenceSummary')!);
      if (si('session_smartReelPlatform')) setSmartReelPlatform(si('session_smartReelPlatform') as any);
      if (si('session_smartReelTopic')) setSmartReelTopic(si('session_smartReelTopic')!);
      if (si('session_smartReelGoal')) setSmartReelGoal(si('session_smartReelGoal')!);
      if (si('session_smartReelDuration')) setSmartReelDuration(si('session_smartReelDuration') as any);
      if (si('session_smartReelSpeechMode')) setSmartReelSpeechMode(si('session_smartReelSpeechMode') as any);
      if (si('session_smartReelChatStep')) setSmartReelChatStep(si('session_smartReelChatStep') as SmartReelChatStep);
      if (si('session_smartReelChatMessages')) {
        try { setSmartReelChatMessages(JSON.parse(si('session_smartReelChatMessages')!)); } catch {}
      }
      
      const savedStoryPoints = si('session_storyPoints');
      if (savedStoryPoints) {
        try { setStoryPoints(parseStoryPointsFromSession(savedStoryPoints)); } catch {}
      }
      const savedCharacterImages = si('session_characterImages');
      if (savedCharacterImages) {
        try { setCharacterImages(JSON.parse(savedCharacterImages)); } catch {}
      }
    } catch {}
  }, []);

  // Save API key when it changes
  useEffect(() => {
    try {
      if (apiKey) {
        sessionStorage.setItem("session_gemini_api_key", apiKey);
      } else {
        sessionStorage.removeItem("session_gemini_api_key");
      }
    } catch (storageError) {
      console.warn("Could not persist API key in sessionStorage:", storageError);
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
        prompt = `${customPromptText}. Ultra high resolution. - ABSOLUTELY NO BLACK BORDERS - the image must fill 100% of the frame!`;
      } else {
        // Simplified prompt - only view angle and shot type
        prompt = `Professional photoshoot with EXACTLY ONE person only, ${viewAngle}, ${bgText}, ${shotText}. Match the exact style, realism level, art style, lighting quality, and visual aesthetic from the reference images. Ultra high resolution. - ABSOLUTELY NO BLACK BORDERS - the image must fill 100% of the frame!`;
      }
      
      console.log(`Generating image ${index + 1} with prompt: ${prompt}`);
      console.log(`Using ${base64Images.length} reference images for blending`);
      
      // Prepare ALL reference images with preserved MIME type
      const normalizedReferenceImages = base64Images
        .map((img) => splitImageDataUrl(img))
        .filter((img) => !!img.base64);
      
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
- - ABSOLUTELY NO BLACK BORDERS - the image must fill 100% of the frame!
- - NO letterboxing, NO black bars on any side (top, bottom, left, right)!

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
        ...normalizedReferenceImages.map(({ mimeType, base64 }) => ({
          inlineData: {
            mimeType: mimeType || "image/png",
            data: base64,
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

      console.log("- API Request sent, Response status:", response.status);

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
      console.log("- Full API Response for image", index + 1);

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
        // ===== BASE64 - BLOB (Browser) =====
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
        console.log(`- Image ${index + 1} generated successfully:`, objectUrl);
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
        throw new Error("Netzwerkfehler - prüfe deine Internetverbindung");
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error("Zeitüberschreitung - keine Antwort nach 20s");
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
    console.log("- processQueue gestartet!");
    console.log("- Queue Länge:", generationQueueRef.current.length);
    console.log("- isGenerating:", isGenerating);
    console.log("- totalCount:", totalCount);
    console.log("- base64Images Länge:", base64Images.length);
    
    const CONCURRENT_REQUESTS = isPro ? 2 : 1;
    const angles = ["front", "front-right", "right", "back-right", "back", "back-left", "left", "front-left"];

    console.log("- Starte worker-pool...");
    
    const processSlot = async (index: number) => {
      console.log(`- Starte Generierung für Index ${index}`);
      
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
    console.log("- handleGenerate aufgerufen!");
    console.log("- API Key vorhanden?", !!apiKey);
    console.log("- API Key Länge:", apiKey?.length || 0);
    console.log("-⚠️ Anzahl Reference Images:", referenceImages.length);
    console.log("- Hintergrund:", selectedBackground);
    console.log("- Anzahl zu generierende Bilder:", imageCount[0]);
    
    if (!canGenerate || generationLimitReached) {
      console.log("❌ Fehler: Keine Generierung möglich");
      return;
    }
    

    if (referenceImages.length === 0) {
      console.log("❌ Fehler: Keine Reference Images");
      return;
    }

    console.log("- Validierung erfolgreich, starte Generierung...");
    incrementGeneration();
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
      decrementGeneration();
    }
  };

  const handleGenerateMore = async () => {
    if (!canGenerate || generationLimitReached) {
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
    
    incrementGeneration();
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
      decrementGeneration();
    }
  };

  const handleCustomPrompt = async () => {
    if (!apiKey || !customPrompt) {
      return;
    }

    if (referenceImages.length === 0) {
      return;
    }

    console.log("- Starting custom prompt generation with reference images");
    console.log("- Custom Prompt:", customPrompt);
    console.log("- Reference Images:", referenceImages.length);

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
      const normalizedReferenceImages = base64Images
        .map((img) => splitImageDataUrl(img))
        .filter((img) => !!img.base64);

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
      const basePrompt = `Professional photoshoot, ${randomPose}, ${randomExpression}, ${bgText}, ${shotText}, studio lighting, high-end fashion photography, professional camera quality. Ultra high resolution. - ABSOLUTELY NO BLACK BORDERS - the image must fill 100% of the frame! - NO letterboxing, NO black bars on any side!`;
      
      // Combine base prompt with custom prompt
      const fullPrompt = `${basePrompt}\n\nADDITIONAL REQUIREMENTS: ${customPrompt}`;

      console.log("- Full combined prompt:", fullPrompt);
      console.log("- Using", normalizedReferenceImages.length, "reference images for blending");

      // Build parts array with text prompt and ALL reference images
      const parts = [
        {
          text: `Create a character image by BLENDING AND MIXING features from ALL ${normalizedReferenceImages.length} reference images provided. Combine facial features, style, and characteristics from each image harmoniously. ${fullPrompt}`,
        },
        // Add ALL reference images
        ...normalizedReferenceImages.map(({ mimeType, base64 }) => ({
          inlineData: {
            mimeType: mimeType || "image/png",
            data: base64,
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
      console.log("- Custom prompt API response received");
      
      // Extract the generated image from the response
      if (data.candidates && data.candidates[0]?.content?.parts) {
        const imagePart = data.candidates[0].content.parts.find(
          (part: any) => part.inlineData
        );
        
        if (imagePart?.inlineData?.data) {
          const imageData = imagePart.inlineData.data;
          const mimeType = imagePart.inlineData.mimeType || "image/jpeg";
          console.log("- Custom prompt image generated successfully");
          
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
            console.log(`-⚠️ Thumbnail created: ${canvas.width}x${canvas.height}`);
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
2. Die Geschwindigkeit und Art der Bewegung (langsam, flieÜend, dynamisch)
3. Details wie Haarbewegung, Kleidungsbewegung, Lichtveränderungen
4. Die Stimmung und Atmosphäre der Animation
5. Kamerabewegung oder -perspektive wenn passend

Beispiele für gute, detaillierte Prompts:
- "Die Person dreht langsam und elegant den Kopf nach links, während ein sanftes Lächeln über ihr Gesicht gleitet. Die Haare bewegen sich weich im Wind, einzelne Strähnen fallen natürlich ins Gesicht. Die Augen blinzeln langsam und verträumt, während das warme Licht über die Haut wandert."
- "Sanfte, flieÜende Bewegung: Die Person hebt langsam die Hand zur BegrüÜung, die Finger spreizen sich elegant. Der Kopf neigt sich leicht zur Seite mit einem warmen, einladenden Lächeln. Die Kleidung bewegt sich subtil, als würde ein leichter Wind wehen."

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

Der Nutzer möchte folgende Ünderung/Ergänzung:
"${promptChatInput}"

Bearbeite den Video-Prompt entsprechend und mache ihn SEHR DETAILLIERT. Der neue Prompt soll:
- Die gewünschten Ünderungen vollständig integrieren
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
- Beschreibe ausschlieÜlich die Kulisse/Szenerie selbst
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
- Beschreibe ausschlieÜlich die Kulisse/Szenerie selbst
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
        console.log(`⚠️ Cleaned up ${createdUrls.length} blob URLs after download`);
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
            v1.4.9
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
                    Dein API Key wird nur im aktuellen Browser gespeichert.
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
                      onClick={() => {
                        setSettingsOpen(false);
                        navigate("/rechtliches");
                      }}
                    >
                      <Scale className="w-4 h-4 mr-2" />
                      Impressum, Datenschutz & AGB
                    </Button>

                    {/* Paket verwalten */}
                    <div className="rounded-lg border border-border p-4 space-y-2">
                      <h4 className="font-semibold text-sm uppercase tracking-wide">Paket verwalten</h4>
                      <p className="text-xs text-muted-foreground">
                        Verwalte dein Abonnement, ändere deine Zahlungsmethode oder kündige dein Abo.
                      </p>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => {
                          setSettingsOpen(false);
                          navigate("/pakete");
                        }}
                      >
                        Paket verwalten
                      </Button>
                    </div>

                    {/* Daten verwalten */}
                    <div className="rounded-lg border border-border p-4 space-y-2">
                      <h4 className="font-semibold text-sm uppercase tracking-wide">Daten verwalten</h4>
                      <p className="text-xs text-muted-foreground">
                        Exportiere deine Daten gemäß DSGVO Art. 20 (Datenübertragbarkeit).
                      </p>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => {
                          const isSensitiveKey = (key: string): boolean =>
                            /(api|key|token|auth|license|secret|password|credential)/i.test(key);
                          const redactIfSensitive = (key: string, value: unknown): unknown =>
                            isSensitiveKey(key) ? "[REDACTED]" : value;

                          const allData: Record<string, any> = {
                            exportDatum: new Date().toISOString(),
                            account: {
                              email: authData.email,
                              plan: displayPlanName || authData.planCode,
                              istAuthentifiziert: authData.isAuthenticated,
                            },
                            einstellungen: {
                              theme,
                              apiKeyGespeichert: !!apiKey,
                            },
                            cookieEinwilligung: getCookie("cookie_consent") || getFromLocalStorage("cookie_consent") || sessionStorage.getItem("cookie_consent") || null,
                            disclaimerAkzeptiert: getCookie("disclaimer_accepted") || null,
                            gespeicherteDaten: {} as Record<string, any>,
                          };
                          // Collect all localStorage entries
                          try {
                            for (let i = 0; i < localStorage.length; i++) {
                              const key = localStorage.key(i);
                              if (key) {
                                try {
                                  const rawValue = localStorage.getItem(key);
                                  const parsedValue = rawValue ? JSON.parse(rawValue) : rawValue;
                                  allData.gespeicherteDaten[key] = redactIfSensitive(key, parsedValue);
                                } catch (parseError) {
                                  console.warn(`Could not parse localStorage key '${key}':`, parseError);
                                  allData.gespeicherteDaten[key] = redactIfSensitive(key, localStorage.getItem(key));
                                }
                              }
                            }
                          } catch (storageError) {
                            console.warn("Could not export localStorage:", storageError);
                          }
                          // Collect all cookies
                          try {
                            const cookies: Record<string, string> = {};
                            document.cookie.split(";").forEach(c => {
                              const [name, ...rest] = c.split("=");
                              if (name?.trim()) {
                                const cookieName = name.trim();
                                const cookieValue = rest.join("=");
                                cookies[cookieName] = String(redactIfSensitive(cookieName, cookieValue));
                              }
                            });
                            allData.cookies = cookies;
                          } catch (cookieError) {
                            console.warn("Could not export cookies:", cookieError);
                          }
                          // Collect sessionStorage
                          try {
                            const session: Record<string, any> = {};
                            for (let i = 0; i < sessionStorage.length; i++) {
                              const key = sessionStorage.key(i);
                              if (key) {
                                session[key] = redactIfSensitive(key, sessionStorage.getItem(key));
                              }
                            }
                            if (Object.keys(session).length > 0) allData.sessionDaten = session;
                          } catch (sessionError) {
                            console.warn("Could not export sessionStorage:", sessionError);
                          }
                          const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `meine-daten-${new Date().toISOString().slice(0, 10)}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Daten exportieren
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-border">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label>Account</Label>
                      <p className="text-sm text-muted-foreground">
                        Angemeldet als: {authData.email}
                      </p>
                      {displayPlanName && (
                        <p className="text-sm text-muted-foreground">
                          Plan: {displayPlanName}
                        </p>
                      )}
                    </div>
                    
                    {/* Abmelden */}
                    <div className="rounded-lg border border-border p-4 space-y-2">
                      <h4 className="font-semibold text-sm uppercase tracking-wide">Abmelden</h4>
                      <p className="text-xs text-muted-foreground">
                        Melde dich von deinem Account ab.
                      </p>
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
              </div>

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
          <p className="text-sm text-muted-foreground mb-2 tracking-wide">
            Zentrale Steuerung für deinen KI-Avatar.
          </p>
          <div className="flex items-center justify-center gap-3 mb-2 flex-wrap overflow-visible">
            <h1 className="text-4xl sm:text-5xl font-bold">
              <AnimatedTitle text="AvatarCreatorStudio" />
            </h1>
            <span 
              className={`px-3 py-1 text-sm font-semibold rounded-full shrink-0 transition-all duration-500 ${
                authData.planCode === "FULL"
                  ? "bg-gradient-to-r from-violet-500 to-purple-500 text-white"
                  : authData.planCode === "PREMIUM" 
                    ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black" 
                    : "bg-muted text-muted-foreground"
              }`}
              style={{
                opacity: 1,
                transform: "translateY(0) scale(1)",
                animation: "badge-appear 0.5s ease-out 0.8s both"
              }}
            >
              {displayPlanName || "Basic"}
            </span>
          </div>
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            Erstelle mit KI konsistente Bilder in 4K, individuelle Szenen und Videos - alles aus einer Quelle, flexibel steuerbar nach Stil, Umgebung und Perspektive.
          </p>
        </div>

        {/* HOME SCREEN */}
        {activeView === "home" && (
          <HomeScreen
            planCode={authData.planCode}
            onSelectFeature={(feature) => {
              if (feature === "story" && authData.planCode !== "FULL") {
                setUpgradePopupType("premium");
                setShowUpgradePopup(true);
                return;
              }
              setActiveMainTab(feature);
              setActiveView("tools");
            }}
            onShowUpgrade={() => { setUpgradePopupType("premium"); setShowUpgradePopup(true); }}
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
              setUpgradePopupType("premium");
              setShowUpgradePopup(true);
              return;
            }
            setActiveMainTab(tab);
          }} className="w-full">
            <TabsList className="w-fit bg-muted/50">
              <TabsTrigger value="poses" className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Avatar Shooting Studio
              </TabsTrigger>
              <TabsTrigger value="story" className={cn("flex items-center gap-2", authData.planCode !== "FULL" && "opacity-50")}>
                <BookOpen className="w-4 h-4" />
                Reel/Story Videocreator
                {authData.planCode !== "FULL" && <Lock className="w-3 h-3 ml-1" />}
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
          className="mb-8 border-border/50 bg-card/50 animate-fade-in"
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
              <p className="text-[9px] text-muted-foreground/60 leading-tight">Mit Upload bestätigst du, dass du die Rechte besitzt.</p>
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
          <div className="relative">
            {authData.planCode !== "FULL" && (
              <div 
                className="absolute inset-0 z-10 cursor-not-allowed rounded-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowUpgradePopup(true);
                }}
                onPointerDownCapture={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              />
            )}
          <Card 
            className={cn(
              "mb-8 animate-fade-in relative overflow-hidden",
              "transition-[border-color,box-shadow,background-color] duration-700 ease-in-out",
              authData.planCode !== "FULL" && "opacity-60 pointer-events-none",
              storyCreatorMode === "reel"
                ? "bg-gradient-to-br from-primary/10 via-card/60 to-primary/5 border-primary/30 shadow-lg shadow-primary/10"
                : "bg-card/50 border-border/50"
            )}
            style={{ animationDelay: '150ms', animationDuration: '600ms', animationFillMode: 'both' }}
          >
            {/* Reel mode glow overlay */}
            <div 
              className={cn(
                "absolute inset-0 pointer-events-none transition-opacity duration-700 ease-in-out rounded-[inherit]",
                "bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_60%)]",
                storyCreatorMode === "reel" ? "opacity-100" : "opacity-0"
              )}
            />
            <CardContent key={storyCreatorMode} className="pt-6 space-y-6 stagger-fade-children">
              <style>{`
                .stagger-fade-children > * {
                  opacity: 0;
                  animation: fade-in 0.35s ease-out forwards;
                }
                .stagger-fade-children > *:nth-child(1) { animation-delay: 0ms; }
                .stagger-fade-children > *:nth-child(2) { animation-delay: 60ms; }
                .stagger-fade-children > *:nth-child(3) { animation-delay: 120ms; }
                .stagger-fade-children > *:nth-child(4) { animation-delay: 180ms; }
                .stagger-fade-children > *:nth-child(5) { animation-delay: 240ms; }
                .stagger-fade-children > *:nth-child(6) { animation-delay: 300ms; }
                .stagger-fade-children > *:nth-child(7) { animation-delay: 360ms; }
                .stagger-fade-children > *:nth-child(8) { animation-delay: 420ms; }
                .stagger-fade-children > *:nth-child(9) { animation-delay: 480ms; }
                .stagger-fade-children > *:nth-child(10) { animation-delay: 540ms; }
              `}</style>
               {/* Mode Toggle: General vs Reel */}
               <div className="flex gap-2 p-1 rounded-lg bg-muted/30 border border-border/50 max-w-md">
                 <button
                   type="button"
                   onClick={() => handleStoryCreatorModeChange("general")}
                   className={cn(
                     "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                     storyCreatorMode === "general"
                       ? "bg-background text-foreground shadow-sm border border-border/50"
                       : "text-muted-foreground hover:text-foreground"
                   )}
                 >
                   <Clapperboard className="w-4 h-4" />
                   Generell
                 </button>
                 <button
                    type="button"
                    onClick={() => handleStoryCreatorModeChange("reel")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                      storyCreatorMode === "reel"
                        ? "bg-background text-foreground shadow-sm border border-border/50"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Smartphone className="w-4 h-4" />
                    Reel
                  </button>
               </div>
                <p className="text-xs text-muted-foreground -mt-4">
                  {storyCreatorMode === "general" 
                    ? "Volle Kontrolle über alle Parameter" 
                    : "Optimiert für TikTok, Instagram Reels & Shorts: Hook in Sekunde 1, klarer Fokus, mobile Lesbarkeit"}
                </p>

              {storyCreatorMode === "reel" && (
                <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-4 md:p-5 space-y-5 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                          Smart Reel
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Briefing, Referenzen und Reel-Logik an einem Ort
                        </span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-base">Smart Reel Modus</Label>
                        <p className="text-xs text-muted-foreground max-w-2xl leading-5">
                          Gib ein Transcript ein, lade Referenzbilder hoch und lass dir das Briefing über einen einfachen Chat zusammenbauen. Danach geht es direkt im normalen Reel Creator weiter.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background/80 px-3 py-2 lg:min-w-[180px]">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-foreground">Status</p>
                        <p className="text-[11px] text-muted-foreground">{smartReelModeEnabled ? "Smart Reel aktiv" : "Smart Reel inaktiv"}</p>
                      </div>
                      <Switch
                        checked={smartReelModeEnabled}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleStoryCreatorModeChange("reel");
                            setSmartReelModeEnabled(true);
                            startSmartReelChat();
                          } else {
                            setSmartReelModeEnabled(false);
                          }
                        }}
                      />
                    </div>
                  </div>

                  {smartReelModeEnabled && (
                    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-border/50 bg-background/80 p-4 md:p-5 space-y-3 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div className="space-y-1">
                              <Label htmlFor="smart-reel-transcript" className="text-sm">Referenz-Transcript</Label>
                              <p className="text-xs text-muted-foreground">
                                Vorlage für Hook, Tempo und Dramaturgie. Kein 1:1-Kopieren.
                              </p>
                            </div>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                              Schritt 1
                            </span>
                          </div>
                          <Textarea
                            id="smart-reel-transcript"
                            placeholder="Fuege hier das Transcript oder die wichtigsten Textstellen des Vorbildvideos ein..."
                            value={smartReelTranscript}
                            onChange={(e) => setSmartReelTranscript(e.target.value)}
                            className="min-h-[180px] resize-y text-sm bg-background"
                          />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="rounded-xl border border-border/50 bg-background/70 p-4 space-y-2">
                            <p className="text-xs font-medium text-foreground">Was der Smart-Modus übernimmt</p>
                            <div className="flex flex-wrap gap-2">
                              {["Reel-Fokus", "Idee", "Sprechmodus", "Plattform", "Laenge"].map((item) => (
                                <span
                                  key={item}
                                  className="rounded-full border border-border/50 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="rounded-xl border border-border/50 bg-background/70 p-4 space-y-2">
                            <p className="text-xs font-medium text-foreground">Aktueller Stand</p>
                            <p className="text-xs text-muted-foreground leading-5">
                              {smartReelBriefSummary || "Noch kein vollständiges Briefing. Beantworte die Fragen im Chat rechts."}
                            </p>
                          </div>
                        </div>

                        {smartReelReferenceSummary.trim() && (
                          <div className="rounded-2xl border border-border/50 bg-background/80 p-4 md:p-5 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">Visuelle Kurzbeschreibung</p>
                                <p className="text-xs text-muted-foreground">Automatisch aus Transcript und Referenzen verdichtet</p>
                              </div>
                              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                                Analyse
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground leading-6 mt-3">{smartReelReferenceSummary}</p>
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-border/50 bg-background/85 p-4 md:p-5 space-y-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <MessageSquare className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5">
                              <Label className="text-sm">Smart Reel Chat</Label>
                              <p className="text-[11px] text-muted-foreground">Schritt für Schritt zum fertigen Briefing</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => startSmartReelChat(true)}>
                            Neu starten
                          </Button>
                        </div>

                        <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                            {smartReelChatMessages.map((message, index) => (
                              <div
                                key={`smart-reel-msg-${index}`}
                                className={cn(
                                  "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm",
                                  message.role === "assistant"
                                    ? "bg-background text-foreground border border-border/50"
                                    : "ml-auto bg-primary text-primary-foreground"
                                )}
                              >
                                {message.text}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {smartReelChatStep === "speech" && (
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Button variant="outline" className="justify-start h-10" onClick={() => handleSmartReelOptionAnswer("speaker", "Separater Sprecher")}>
                                Separater Sprecher
                              </Button>
                              <Button variant="outline" className="justify-start h-10" onClick={() => handleSmartReelOptionAnswer("avatars", "Avatare sprechen selbst")}>
                                Avatare sprechen selbst
                              </Button>
                            </div>
                          )}

                          {smartReelChatStep === "platform" && (
                            <div className="grid gap-2 sm:grid-cols-3">
                              <Button variant="outline" className="justify-start h-10" onClick={() => handleSmartReelOptionAnswer("instagram", "Instagram Reels")}>
                                Instagram
                              </Button>
                              <Button variant="outline" className="justify-start h-10" onClick={() => handleSmartReelOptionAnswer("youtube", "YouTube Shorts")}>
                                YouTube
                              </Button>
                              <Button variant="outline" className="justify-start h-10" onClick={() => handleSmartReelOptionAnswer("tiktok", "TikTok")}>
                                TikTok
                              </Button>
                            </div>
                          )}

                          {(smartReelChatStep === "topic" || smartReelChatStep === "goal") && (
                            <div className="flex gap-2">
                              <Input
                                value={smartReelChatInput}
                                onChange={(e) => setSmartReelChatInput(e.target.value)}
                                placeholder={smartReelChatStep === "topic" ? "z.B. Low Carb, gesunde Snacks, Fitness..." : "z.B. Zuschauer sollen speichern, folgen oder neugierig werden..."}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSmartReelTextSubmit();
                                  }
                                }}
                                className="h-11"
                              />
                              <Button size="icon" className="h-11 w-11 shrink-0" onClick={handleSmartReelTextSubmit}>
                                <Send className="w-4 h-4" />
                              </Button>
                            </div>
                          )}

                          {smartReelChatStep === "duration" && (
                            <div className="grid gap-2 sm:grid-cols-3">
                              <Button variant="outline" className="justify-start h-10" onClick={() => handleSmartReelOptionAnswer("15-30", "15 bis 30 Sekunden")}>
                                15-30 Sek
                              </Button>
                              <Button variant="outline" className="justify-start h-10" onClick={() => handleSmartReelOptionAnswer("30-60", "30 bis 60 Sekunden")}>
                                30-60 Sek
                              </Button>
                              <Button variant="outline" className="justify-start h-10" onClick={() => handleSmartReelOptionAnswer("60+", "60+ Sekunden")}>
                                60+ Sek
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                          <Label className="text-xs text-muted-foreground">Optionaler Zusatzwunsch</Label>
                          <Textarea
                            placeholder="Optional: weiterer Wunsch für Idee, Hook oder Zielgruppe..."
                            value={storyAiAssistantInput}
                            onChange={(e) => setStoryAiAssistantInput(e.target.value)}
                            className="min-h-[84px] resize-y text-sm bg-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!(smartReelModeEnabled && storyCreatorMode === "reel") && (
                <>
               {/* Speaker Toggle + Direction - above story idea */}
                <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20 max-w-xl">
                  <div className="space-y-0.5 mr-auto">
                    <Label className="text-sm">Sprechertext / Dialog</Label>
                    <p className="text-xs text-muted-foreground">KI generiert Text pro Szene</p>
                  </div>
                  <Switch checked={storyEnableSpeaker} onCheckedChange={setStoryEnableSpeaker} />
                  
                  {storyEnableSpeaker && (
                    <div className="flex gap-1 ml-2">
                      <button
                        type="button"
                        onClick={() => {
                          setStoryVoiceMode("sprecher");
                          setStoryGenerationDirection("speaker-from-description");
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-md border text-xs font-medium transition-all duration-200",
                          storyVoiceMode === "sprecher"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/30"
                        )}
                      >
                        Sprecher
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStoryVoiceMode("dialog");
                          setStoryGenerationDirection("speaker-from-description");
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-md border text-xs font-medium transition-all duration-200",
                          storyVoiceMode === "dialog"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/30"
                        )}
                      >
                        Dialog
                      </button>
                    </div>
                  )}
                </div>

                {storyEnableSpeaker && (
                  <div className="px-1">
                    <div className="flex items-center gap-3">
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
                          {storyGenerationDirection === "speaker-from-description"
                            ? `Details - ${storyVoiceMode === "sprecher" ? "Sprechertext" : "Dialog"}`
                            : `${storyVoiceMode === "sprecher" ? "Sprechertext" : "Dialog"} - Details`}
                        </span>
                      </button>
                      <span
                        key={storyGenerationDirection + "-desc"}
                        className="text-xs text-muted-foreground animate-[fadeIn_0.3s_ease-out]"
                      >
                        {storyGenerationDirection === "speaker-from-description"
                          ? `KI schreibt ${storyVoiceMode === "sprecher" ? "den Sprechertext" : "den Dialog"} passend zur Szenenbeschreibung`
                          : `KI schreibt die Szene passend zum ${storyVoiceMode === "sprecher" ? "Sprechertext" : "Dialog"}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Story Idea and AI Assistant side by side */}
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Left: Generated Story Idea Display */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-2 h-7">
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
                   <div className="relative flex flex-col min-h-[160px] h-[160px] resize-y overflow-auto">
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
                      className="flex-1 resize-none"
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
                <div className="flex flex-col items-center md:items-center md:justify-start md:pt-[calc(1.75rem+0.5rem)] gap-3">
                  <Button
                    onClick={handleGenerateStoryIdea}
                    disabled={isGeneratingStoryAiIdea || (!storyAiAssistantInput.trim() && !storyIdea.trim() && !smartReelIdeaSeed.trim())}
                    className="w-full md:w-10 h-10 md:h-[160px] rounded-lg"
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
                  <div className="flex items-center justify-between mb-2 h-7">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-muted-foreground">{smartReelModeEnabled && storyCreatorMode === "reel" ? "Smart Briefing" : "KI-Assistent"}</Label>
                    </div>
                  </div>
                  <div className="relative flex flex-col min-h-[160px] h-[160px] resize-y overflow-auto rounded-lg border border-border/50 bg-muted/30 p-3">
                    {smartReelModeEnabled && storyCreatorMode === "reel" ? (
                      <div className="flex-1 space-y-3 text-sm">
                        <p className="text-muted-foreground">
                          Der Smart Reel Modus liefert das Briefing jetzt direkt aus Transcript, Referenzbildern und Chat-Antworten.
                        </p>
                        {smartReelBriefSummary && (
                          <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                            <p className="text-xs font-medium text-foreground">Zusammenfassung</p>
                            <p className="text-xs text-muted-foreground mt-1">{smartReelBriefSummary}</p>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Optionalen Zusatzwunsch kannst du oben im Smart Reel Chat ergänzen. Mit dem Pfeil werden daraus Ideen erzeugt.
                        </p>
                      </div>
                    ) : (
                      <Textarea
                        placeholder={generatedIdeas.length > 0 
                          ? "Beschreibe die gewuenschte Aenderung, z.B. 'Mach es dramatischer' oder 'Verlege es ans Meer'..."
                          : "Beschreibe was für eine Story du möchtest, z.B. 'Eine romantische Geschichte in Paris'..."
                        }
                        value={storyAiAssistantInput}
                        onChange={(e) => setStoryAiAssistantInput(e.target.value)}
                        className="flex-1 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 resize-none bg-transparent border-0 p-0"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleGenerateStoryIdea();
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
                </>
              )}

              {/* Character Reference Image Upload */}
              <div className="space-y-3 rounded-2xl border border-border/50 bg-card/40 p-4 md:p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                  {smartReelModeEnabled && storyCreatorMode === "reel" ? "Referenzbilder" : "Charakter Referenzbild"}
                    </Label>
                    <p className="text-xs text-muted-foreground leading-5">Lade Figuren und optional den visuellen Look hoch, damit Bild- und Video-Prompts konsistent bleiben.</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/70 leading-tight">Mit Upload bestätigst du, dass du die Rechte besitzt. Name und Kurzbeschreibung werden für Sprecher-, Charakter- und Stil-Konsistenz in Story und Video verwendet.</p>
                <div className={cn("grid gap-4", smartReelModeEnabled && storyCreatorMode === "reel" ? "lg:grid-cols-2" : "grid-cols-1")}>
                  <div className="space-y-3 rounded-xl border border-border/50 bg-background/70 p-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">Charaktere</p>
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: maxStoryReferenceImages }, (_, idx) => {
                          const isFilled = idx < storyReferenceImages.length;
                          return (
                            <span
                              key={idx}
                              className={cn(
                                "h-2 w-2 rounded-full transition-all",
                                isFilled
                                  ? "bg-primary"
                                  : "bg-border"
                              )}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {storyReferenceImages.map((imageUrl, index) => (
                        <div key={`story-ref-${index}`} className="relative w-28">
                          <div className="relative w-full">
                            <img 
                              src={imageUrl} 
                              alt={`Referenz ${index + 1}`}
                              className="w-full h-28 object-cover rounded-t-lg"
                            />
                            <button
                              type="button"
                              onClick={() => removeStoryImage(index)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <Input
                            value={storyReferenceLabels[index] || ""}
                            onChange={(e) => {
                              setStoryReferenceLabels(prev => {
                                const updated = [...prev];
                                updated[index] = e.target.value;
                                saveToLocalStorage('storyReferenceLabels', updated);
                                return updated;
                              });
                            }}
                            placeholder={`Person ${index + 1}`}
                            className="w-full h-6 text-[10px] text-center px-1 py-0 border-border/50 rounded-none border-t-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                          <Textarea
                            value={storyReferenceDescriptions[index] || ""}
                            onChange={(e) => {
                              setStoryReferenceDescriptions(prev => {
                                const updated = [...prev];
                                updated[index] = e.target.value;
                                saveToLocalStorage('storyReferenceDescriptions', updated);
                                return updated;
                              });
                            }}
                            placeholder="rote Jacke, Brille, lockige Haare"
                            className="w-full min-h-[44px] text-[9px] leading-tight px-1 py-1 border-border/50 resize-none rounded-none border-t-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-b-[4px]"
                          />
                        </div>
                      ))}
                      {storyReferenceImages.length < maxStoryReferenceImages && (
                        <ImageDropZone
                          onFiles={(files) => {
                            const fakeEvent = { target: { files } } as React.ChangeEvent<HTMLInputElement>;
                            handleStoryImageUpload(fakeEvent);
                          }}
                        >
                          <Upload className="w-6 h-6 text-muted-foreground" />
                        </ImageDropZone>
                      )}
                      {storyReferenceImages.length === 0 && (
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

                  {smartReelModeEnabled && storyCreatorMode === "reel" && (
                    <div className="space-y-3 rounded-xl border border-border/50 bg-background/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">Stilbilder</p>
                        <span className="text-[11px] text-muted-foreground">{smartReelStyleImages.length}/{maxSmartReelStyleImages}</span>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        {smartReelStyleImages.map((imageUrl, index) => (
                          <div key={`smart-style-${index}`} className="relative flex flex-col items-center gap-1">
                            <div className="relative w-28 h-28">
                              <img 
                                src={imageUrl} 
                                alt={`Stilbild ${index + 1}`}
                                className="w-full h-full object-cover rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => removeSmartReelStyleImage(index)}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <Textarea
                              value={smartReelStyleDescriptions[index] || ""}
                              onChange={(e) => {
                                setSmartReelStyleDescriptions(prev => {
                                  const updated = [...prev];
                                  updated[index] = e.target.value;
                                  saveToLocalStorage('smartReelStyleDescriptions', updated);
                                  return updated;
                                });
                              }}
                              placeholder="filmisch, warmes Licht, starke Kontraste"
                              className="w-24 min-h-[64px] text-[9px] leading-tight px-1 py-1 border-border/50 resize-none"
                            />
                          </div>
                        ))}
                        {smartReelStyleImages.length < maxSmartReelStyleImages && (
                          <ImageDropZone
                            onFiles={(files) => {
                              const fakeEvent = { target: { files } } as React.ChangeEvent<HTMLInputElement>;
                              handleSmartReelStyleUpload(fakeEvent);
                            }}
                          >
                            <Upload className="w-6 h-6 text-muted-foreground" />
                          </ImageDropZone>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {smartReelModeEnabled && storyCreatorMode === "reel" && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/50 bg-background/70 p-4">
                    <p className="text-sm text-muted-foreground leading-6">
                      Analysiere Transcript, Charaktere und Stilbilder, damit die Beschreibungen möglichst präzise für die Video-KI gefüllt werden.
                    </p>
                    <Button
                      variant="outline"
                      className="sm:min-w-[210px]"
                      onClick={analyzeSmartReelReferences}
                      disabled={isAnalyzingSmartReelReferences || (!smartReelTranscript.trim() && storyReferenceImages.length === 0 && smartReelStyleImages.length === 0)}
                    >
                      {isAnalyzingSmartReelReferences ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Analysiere...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Referenzen analysieren
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
              {smartReelModeEnabled && storyCreatorMode === "reel" && (
                <div className="space-y-4 rounded-2xl border border-border/50 bg-card/40 p-4 md:p-5 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <Label className="text-sm">Smart Reel Idee</Label>
                      <p className="text-xs text-muted-foreground leading-5">
                        Die Idee wird direkt aus Smart-Modus, Transcript und Referenzen erzeugt. Es gibt hier kein separates Ideen- oder Settings-Formular mehr.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        value={ideaCount}
                        onChange={(e) => setIdeaCount(e.target.value)}
                        className="h-10 text-sm text-center rounded-lg border border-border bg-background text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring px-3"
                        title="Anzahl Ideen"
                      >
                        {[1,2,3,4,5].map(n => (
                          <option key={n} value={String(n)}>{n} Idee{n > 1 ? "n" : ""}</option>
                        ))}
                      </select>
                      <Button
                        className="sm:min-w-[190px]"
                        onClick={handleGenerateStoryIdea}
                        disabled={isGeneratingStoryAiIdea || (!storyAiAssistantInput.trim() && !storyIdea.trim() && !smartReelIdeaSeed.trim())}
                      >
                        {isGeneratingStoryAiIdea ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Generiere...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            {storyIdea.trim() ? "Idee aktualisieren" : "Ideen generieren"}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
                    <div className="rounded-xl border border-border/50 bg-background/70 p-4 space-y-3">
                      <p className="text-sm font-medium text-foreground">Smart Briefing</p>
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 leading-5">
                          {smartReelBriefSummary || "Das Briefing wird aus dem Chat aufgebaut."}
                        </div>
                        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 leading-5">
                          {smartReelReferenceSummary.trim() || "Nach der Analyse erscheint hier die visuelle Kurzbeschreibung."}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/50 bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Aktuelle Ausgabe</Label>
                      {generatedIdeas.length > 0 && (
                        <div className="flex items-center gap-0 rounded-md border border-border/50 bg-background/60 px-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={currentIdeaIndex === 0}
                            onClick={() => navigateIdea("prev")}
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </Button>
                          <span className="text-xs text-muted-foreground font-medium tabular-nums min-w-[2.5rem] text-center">
                            {`${currentIdeaIndex + 1}/${generatedIdeas.length}`}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={currentIdeaIndex === generatedIdeas.length - 1}
                            onClick={() => navigateIdea("next")}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {(isExpandingSuggestion || isGeneratingStoryAiIdea) ? (
                      <div className="min-h-[140px] rounded-lg border border-primary/20 bg-background/80 backdrop-blur-sm flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <span className="text-sm font-medium text-primary">Ideen werden generiert...</span>
                      </div>
                    ) : storyIdea.trim() ? (
                      <div className="min-h-[140px] rounded-lg border border-border/50 bg-background/70 p-4 text-sm leading-6 whitespace-pre-wrap">
                        {storyIdea}
                      </div>
                    ) : (
                      <div className="min-h-[140px] rounded-lg border border-dashed border-border/50 bg-background/40 p-4 text-sm text-muted-foreground flex items-center">
                        Noch keine Idee generiert. Nutze oben den Button, dann erstellt der Smart-Modus die Reel-Idee aus deinem Briefing.
                      </div>
                    )}
                    </div>
                  </div>
                </div>
              )}

              {!(smartReelModeEnabled && storyCreatorMode === "reel") && (
                <>
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
                <CollapsibleContent className="pt-4 space-y-4 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
                  {/* Row 1: Artstyle + Video-Stimmung + Sprecherstimme */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                      <Label className="text-sm">Video-Stimmung</Label>
                      <Select value={storyVideoMood} onValueChange={setStoryVideoMood}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="action">Action / Dynamisch</SelectItem>
                          <SelectItem value="calm">Ruhig / Entspannt</SelectItem>
                          <SelectItem value="dramatic">Dramatisch / Spannend</SelectItem>
                          <SelectItem value="emotional">Emotional / Berührend</SelectItem>
                          <SelectItem value="mysterious">Mysteriös / Dunkel</SelectItem>
                          <SelectItem value="cheerful">Fröhlich / Leicht</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {storyEnableSpeaker && (
                      <div className="space-y-1.5">
                        <Label className="text-sm">Sprecherstimme</Label>
                        <Select value={storySpeakerGender} onValueChange={(v) => setStorySpeakerGender(v as any)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Männlich</SelectItem>
                            <SelectItem value="female">Weiblich</SelectItem>
                            <SelectItem value="neutral">Neutral</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Row 2: Standard-Übergang + Farbstimmung + Pacing */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                    <div className="space-y-1.5">
                      <Label className="text-sm">Farbstimmung</Label>
                      <Select value={storyColorMood} onValueChange={setStoryColorMood}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="warm">Warm (Golden Hour)</SelectItem>
                          <SelectItem value="cold">Kalt (Blautöne)</SelectItem>
                          <SelectItem value="dark">Dunkel / Noir</SelectItem>
                          <SelectItem value="bright">Hell / Freundlich</SelectItem>
                          <SelectItem value="neon">Neon / Cyberpunk</SelectItem>
                          <SelectItem value="natural">Natürlich</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {storyCreatorMode !== "reel" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm">Pacing / Tempo</Label>
                      <Select value={storyPacing} onValueChange={setStoryPacing}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instant-action">Sofort Action (0-2s)</SelectItem>
                          <SelectItem value="slow-build">Langsamer Aufbau (3-5s)</SelectItem>
                          <SelectItem value="tension-arc">Spannungsbogen</SelectItem>
                          <SelectItem value="fast-cuts">Schnelle Schnitte</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    )}
                  </div>

                  {/* Row 3: Hook + Besondere Details nebeneinander */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={cn("space-y-1.5", storyCreatorMode === "reel" && "p-3 rounded-lg border border-primary/30 bg-primary/5")}>
                      <Label className="text-sm flex items-center gap-2">
                        Hook (Einstieg)
                        {storyCreatorMode === "reel" && <span className="text-xs text-primary font-normal">Wichtig für Reels!</span>}
                      </Label>
                      <Textarea
                        placeholder={storyCreatorMode === "reel" 
                          ? "z.B. 'Starte mit dem schlimmsten Moment', 'Eine provokante Frage in Sekunde 1', 'Ein klarer Konflikt ohne Ablenkung'..."
                          : "z.B. 'Starte mit einer Explosion', 'Beginne mit einer Frage an den Zuschauer'..."}
                        value={storyHook}
                        onChange={(e) => setStoryHook(e.target.value)}
                        className="min-h-[100px] resize-y text-sm"
                      />
                      {storyCreatorMode === "reel" && !storyHook.trim() && (
                        <p className="text-xs text-primary/80">
                          Wenn du das Feld leer laesst, setzt der Reel-Modus automatisch einen Hook-First-Start im Hintergrund.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Besondere Details / Anweisungen</Label>
                      <Textarea
                        placeholder="z.B. 'Immer warmes Abendlicht', 'Film-Noir Stil', 'Keine Nahaufnahmen'..."
                        value={storyCustomDetails}
                        onChange={(e) => setStoryCustomDetails(e.target.value)}
                        className="min-h-[100px] resize-y text-sm"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
                </>
              )}

              {/* Storyboard Generator */}
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="space-y-1">
                    <Label>Storyboard generieren</Label>
                    <p className="text-xs text-muted-foreground">
                      {smartReelModeEnabled && storyCreatorMode === "reel"
                        ? "Das Storyboard übernimmt die Smart-Reel-Idee, die Referenzen und die Reel-Logik automatisch."
                        : "Erstelle jetzt die Szenenstruktur für Bilder und Video-Prompts."}
                    </p>
                  </div>
                  {smartReelModeEnabled && storyCreatorMode === "reel" ? (
                    <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                      {storyPointCount} Szenen aus Smart Reel Briefing
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{storyPointCount} Szenen</span>
                      <Slider
                        value={[storyPointCount]}
                        onValueChange={(value) => {
                          setStoryPointCount(Math.round(value[0]));
                        }}
                        min={storyCreatorMode === "reel" ? 3 : 2}
                        max={storyCreatorMode === "reel" ? 6 : 8}
                        step={1}
                        className="w-32"
                      />
                    </div>
                  )}
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
                            title="Generiert die Bilder aller Szenen neu"
                            onMouseEnter={() => setStoryboardHoverHighlight({ scope: "all-media", label: "Alle Bilder" })}
                            onMouseLeave={() => setStoryboardHoverHighlight(null)}
                            onFocus={() => setStoryboardHoverHighlight({ scope: "all-media", label: "Alle Bilder" })}
                            onBlur={() => setStoryboardHoverHighlight(null)}
                          >
                            {isGeneratingStoryImages ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                Szene {(generatingStoryImageIndex ?? 0) + 1}/{storyPoints.length}
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                Alle Bilder neu
                              </>
                            )}
                          </Button>
                          {/* Veo3 Format Dropdown */}
                          <Select value={storyboardFormat} onValueChange={setStoryboardFormat} disabled={storyCreatorMode === "reel"}>
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
                              onMouseEnter={() => setStoryboardHoverHighlight({ scope: "all-media", label: "Alle Videos" })}
                              onMouseLeave={() => setStoryboardHoverHighlight(null)}
                              onFocus={() => setStoryboardHoverHighlight({ scope: "all-media", label: "Alle Videos" })}
                              onBlur={() => setStoryboardHoverHighlight(null)}
                              disabled={isGeneratingVideos || isGeneratingStoryImages || isGeneratingStoryboard || isGeneratingVideoPrompts}
                              className="flex-1"
                              title="Generiert Videos für alle Szenen mit vorhandenem Video-Prompt"
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
                                  Alle Videos generieren
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={generateVideoPrompts}
                              onMouseEnter={() => setStoryboardHoverHighlight({ scope: "all-cards", label: "Alle Szenen" })}
                              onMouseLeave={() => setStoryboardHoverHighlight(null)}
                              onFocus={() => setStoryboardHoverHighlight({ scope: "all-cards", label: "Alle Szenen" })}
                              onBlur={() => setStoryboardHoverHighlight(null)}
                              disabled={isGeneratingVideoPrompts || isGeneratingStoryImages || isGeneratingStoryboard}
                              className="flex-1"
                              title="Erstellt Video-Prompts für alle Szenen"
                            >
                              {isGeneratingVideoPrompts ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Video Prompt {(generatingVideoPromptIndex ?? 0) + 1}/{storyPoints.length}...
                                </>
                              ) : (
                                <>
                                  <Video className="w-4 h-4 mr-2" />
                                  Alle Video-Prompts
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
                            onMouseEnter={() => setStoryboardHoverHighlight({ scope: "all-media", label: "Alle Bilder" })}
                            onMouseLeave={() => setStoryboardHoverHighlight(null)}
                            onFocus={() => setStoryboardHoverHighlight({ scope: "all-media", label: "Alle Bilder" })}
                            onBlur={() => setStoryboardHoverHighlight(null)}
                            disabled={isGeneratingStoryImages || isGeneratingStoryboard}
                            className="flex-1"
                            title="Generiert Bilder für alle Szenen"
                          >
                            {isGeneratingStoryImages ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generiere Szene {(generatingStoryImageIndex ?? 0) + 1}/{storyPoints.length}...
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-4 h-4 mr-2" />
                                Alle Bilder generieren
                              </>
                            )}
                          </Button>
                          {/* Veo3 Format Dropdown */}
                          <Select value={storyboardFormat} onValueChange={setStoryboardFormat} disabled={storyCreatorMode === "reel"}>
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
                                  onMouseEnter={() => setStoryboardHoverHighlight({ scope: "card", index, label: "Komplette Szene" })}
                                  onMouseLeave={() => setStoryboardHoverHighlight(null)}
                                  onFocus={() => setStoryboardHoverHighlight({ scope: "card", index, label: "Komplette Szene" })}
                                  onBlur={() => setStoryboardHoverHighlight(null)}
                                  disabled={regeneratingPointIndex !== null}
                                  title="Komplette Szene neu generieren"
                                  aria-label={`Szene ${index + 1} komplett neu generieren`}
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
                                  title="Szenendetails öffnen"
                                  aria-label={`Szenendetails für Szene ${index + 1} öffnen`}
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
                                          
                                          // Check if this is the only scene missing a video (and no generation running)
                                          const isMissingVideo = !point.generatedVideo && !videoResults.has(index);
                                          const otherScenesHaveVideos = !isGeneratingVideos && isMissingVideo && point.videoPrompt && storyPoints.length > 1 &&
                                            storyPoints.every((sp, i) => i === index || sp.generatedVideo || videoResults.has(i));
                                          const noGenerationQueued = !isGeneratingVideos && !videoTaskIds.has(index);
                                          const showGenerateButton = otherScenesHaveVideos && noGenerationQueued && !hasError;
                                          
                                          return (
                                            <>
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
                                            
                                            {/* Generate missing video button */}
                                            {showGenerateButton && (
                                              <div className="absolute inset-0 flex items-center justify-center rounded-lg overflow-hidden bg-black/40 backdrop-blur-[1px]">
                                                <Button
                                                  size="sm"
                                                  className="gap-1.5 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 text-xs"
                                                  title="Erstellt nur das Video für diese Szene aus dem vorhandenen Bild"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    regenerateSingleVideo(index);
                                                  }}
                                                >
                                                  <Video className="w-3.5 h-3.5" />
                                                  Nur Video erstellen
                                                </Button>
                                              </div>
                                            )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                      {(() => {
                                        const hoverLabel = getStoryboardMediaHoverLabel(index);
                                        return hoverLabel ? (
                                          <RegenerationSurfaceOverlay
                                            label={hoverLabel}
                                            className="rounded-lg z-10"
                                          />
                                        ) : null;
                                      })()}
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
                                      (() => {
                                        const previewActionLabel = point.generatedVideo
                                          ? "Nur Video neu"
                                          : "Nur Bild neu";
                                        const previewActionTitle = point.generatedVideo
                                          ? "Generiert nur das Video dieser Szene neu. Das Bild bleibt unverändert."
                                          : "Generiert nur das Bild dieser Szene neu. Die restliche Szene bleibt unverändert.";

                                        return (
                                          <div 
                                            className="absolute inset-0 bg-black/55 opacity-0 group-hover/image:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-20"
                                            onClick={() => setExpandedStoryPointIndex(index)}
                                          >
                                            <div className="pointer-events-none rounded-full bg-black/45 px-3 py-1 text-[10px] font-medium text-white/90">
                                              Klick ins Bild: Details dieser Szene
                                            </div>
                                            <div className="flex flex-wrap items-center justify-center gap-2 px-3">
                                              <Button 
                                                size="icon" 
                                                variant="secondary" 
                                                className="h-9 w-9 rounded-full shadow-lg"
                                                title="Bild dieser Szene herunterladen"
                                                aria-label={`Bild von Szene ${index + 1} herunterladen`}
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
                                                title={previewActionTitle}
                                                onMouseEnter={() => setStoryboardHoverHighlight({ scope: "media", index, label: previewActionLabel })}
                                                onMouseLeave={() => setStoryboardHoverHighlight(null)}
                                                onFocus={() => setStoryboardHoverHighlight({ scope: "media", index, label: previewActionLabel })}
                                                onBlur={() => setStoryboardHoverHighlight(null)}
                                                aria-label={`${previewActionLabel} für Szene ${index + 1}`}
                                                onClick={(e) => { 
                                                  e.stopPropagation(); 
                                                  if (point.generatedVideo) {
                                                    regenerateSingleVideo(index);
                                                  } else {
                                                    regenerateImageOnly(index);
                                                  }
                                                }}
                                                disabled={regeneratingPointIndex !== null || isGeneratingVideos}
                                              >
                                                <RefreshCw className="w-4 h-4" />
                                              </Button>
                                              <Button
                                                size="icon"
                                                variant="secondary"
                                                className="h-9 w-9 rounded-full shadow-lg"
                                                title="Üffnet die Details und Bearbeitung für diese Szene"
                                                aria-label={`Details für Szene ${index + 1} öffnen`}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setExpandedStoryPointIndex(index);
                                                }}
                                              >
                                                <Maximize2 className="w-4 h-4" />
                                              </Button>
                                            </div>
                                          </div>
                                        );
                                      })()
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
                                <div className="relative flex-1 flex flex-col p-2">
                                  {(() => {
                                    const hoverLabel = getStoryboardMediaHoverLabel(index);
                                    return hoverLabel ? (
                                      <RegenerationSurfaceOverlay
                                        label={hoverLabel}
                                        className="rounded-lg z-10"
                                      />
                                    ) : null;
                                  })()}
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
                            {(() => {
                              const hoverLabel = getStoryboardCardHoverLabel(index);
                              return hoverLabel ? (
                                <RegenerationSurfaceOverlay
                                  label={hoverLabel}
                                  className="rounded-xl z-10"
                                  chipClassName="left-3 top-3"
                                />
                              ) : null;
                            })()}
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
                      enableSpeaker={storyEnableSpeaker}
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
                  
                  {/* Warning dialog when closing popup during active regeneration */}
                  <AlertDialog open={showRegenerationCloseWarning} onOpenChange={setShowRegenerationCloseWarning}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Generierung läuft noch</AlertDialogTitle>
                        <AlertDialogDescription>
                          Ein Bild wird gerade generiert. Wenn du jetzt schlieÜt, wird die Generierung abgebrochen.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Weiterlaufen lassen</AlertDialogCancel>
                        <AlertDialogAction onClick={handleForceCloseExpandedCard}>
                          Abbrechen & SchlieÜen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
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
                  <h3 className="text-xl font-bold text-foreground">
                    {upgradePopupType === "premium" ? "Premium Version erforderlich" : "Pro Version erforderlich"}
                  </h3>
                  <p className="text-muted-foreground">
                    {upgradePopupType === "premium"
                      ? "Um den Reel/Story Videocreator zu nutzen, benötigst du die Premium Version. Trag dich jetzt auf die Warteliste ein!"
                      : "Dieses Feature ist in der Pro Version verfügbar. Upgrade jetzt für erweiterte Funktionen!"}
                  </p>
                  {upgradePopupType === "premium" ? (
                    <Button
                      onClick={() => {
                        window.open("https://www.aivataracademy.com/acspremium_warteliste/", "_blank");
                        setShowUpgradePopup(false);
                      }}
                      className="w-full bg-gradient-to-r from-purple-500 to-violet-600 text-white font-semibold hover:from-purple-600 hover:to-violet-700"
                    >
                      Auf die Premium Warteliste
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        window.open("https://www.digistore24.com/product/644591", "_blank");
                        setShowUpgradePopup(false);
                      }}
                      className="w-full bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-semibold hover:from-amber-600 hover:to-yellow-500"
                    >
                      Jetzt upgraden
                    </Button>
                  )}
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
                  setStoryReferenceLabels(prev => {
                    if (prev.length >= 2) return prev;
                    const updated = [...prev, ""];
                    saveToLocalStorage('storyReferenceLabels', updated);
                    return updated;
                  });
                  setStoryReferenceDescriptions(prev => {
                    if (prev.length >= 2) return prev;
                    const updated = [...prev, ""];
                    saveToLocalStorage('storyReferenceDescriptions', updated);
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
              <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card/80 via-card/60 to-primary/10 shadow-xl hover:shadow-2xl hover:shadow-primary/20 transition-all duration-500 hover:scale-[1.02] hover:border-primary/50">
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
                      Mehr Reichweite, mehr Style, mehr Möglichkeiten - entdecke unser exklusives Webinar und hebe dein KI-Game aufs nächste Level.
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

