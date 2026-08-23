/**
 * Tutorial-Katalog — ein Erklärvideo pro ACS-Tool.
 *
 * Jedes Tutorial ist an ein Plan-Feature-Flag gekoppelt (`planFlag`). Ist das
 * Flag im aktuellen Plan false, wird das Tutorial NICHT angezeigt — genau wie
 * das zugehörige Tool gesperrt ist. `planFlag: null` = immer sichtbar (Setup,
 * z. B. API-Keys, die jeder Tier braucht).
 *
 * `nav` beschreibt, wohin der "Zum Tool"-Button springt:
 *   - route     → feste Route (/studio, /story)
 *   - character → Character-Hub mit ?mode=… (Quick/Chat/Views/Poses/Remix)
 *   - settings  → öffnet den Einstellungen-Dialog (API-Keys)
 */
import type { LucideIcon } from "lucide-react";
import { KeyRound, Sparkles, Users, LayoutGrid, Wand2, Camera, Film, Mic } from "lucide-react";
import type { PlanCapabilities } from "@/lib/plans";
import { TUTORIAL_VIDEOS, type VimeoRef } from "@/lib/tutorialVideos";

export type TutorialCategory = "setup" | "character" | "studio" | "story";

export type CharacterMode = "quick" | "chat" | "views" | "poses" | "remix";

export type TutorialNav =
  | { kind: "route"; to: string }
  | { kind: "character"; mode: CharacterMode }
  | { kind: "settings" };

/** Nur die boolean-Feature-Flags aus PlanCapabilities, die ein Tool freischalten. */
export type PlanFlag =
  | "avatarStudio" | "quickCreator" | "chatCreator"
  | "characterViews" | "poseGrid" | "smartRemix" | "storyReel";

export interface Tutorial {
  id: string;                 // Slug — identisch zum Vimeo-Upload-Key
  num: string;                // "01".."09" — Reihenfolge/Anzeige
  title: string;
  subtitle: string;
  category: TutorialCategory;
  planFlag: PlanFlag | null;  // null = immer sichtbar
  nav: TutorialNav;
  color: string;              // Akzentfarbe (passend zum Tool)
  Icon: LucideIcon;
}

export const TUTORIALS: Tutorial[] = [
  { id: "google-api-key", num: "01", title: "Google API-Key", subtitle: "Gemini-Key erstellen & eintragen", category: "setup", planFlag: null, nav: { kind: "settings" }, color: "hsl(217 91% 62%)", Icon: KeyRound },
  { id: "fal-api-key",    num: "02", title: "fal.ai API-Key", subtitle: "Video-Key erstellen & eintragen",  category: "setup", planFlag: null, nav: { kind: "settings" }, color: "hsl(188 94% 55%)", Icon: KeyRound },
  // ElevenLabs ist optional (ohne Key läuft die Stimme über fal), gehört aber in
  // dieselbe Einrichtungs-Strecke: der Key UND die Stimmenauswahl werden im
  // selben Dialog gesetzt. Deshalb `planFlag: null` wie die beiden Key-Videos.
  { id: "eleven-voice",   num: "03", title: "ElevenLabs & Stimmen", subtitle: "API-Key und Stimmen einrichten", category: "setup", planFlag: null, nav: { kind: "settings" }, color: "hsl(292 72% 68%)", Icon: Mic },
  { id: "quick", num: "04", title: "Quick Creator",   subtitle: "Schnell einen Charakter erstellen",       category: "character", planFlag: "quickCreator",   nav: { kind: "character", mode: "quick" }, color: "hsl(263 70% 70%)", Icon: Sparkles },
  { id: "chat",  num: "05", title: "Chat Creator",    subtitle: "Charakter im Dialog entwickeln",          category: "character", planFlag: "chatCreator",    nav: { kind: "character", mode: "chat" },  color: "hsl(270 60% 72%)", Icon: Users },
  { id: "views", num: "06", title: "Character Views",  subtitle: "Mehrere Ansichten generieren",            category: "character", planFlag: "characterViews", nav: { kind: "character", mode: "views" }, color: "hsl(188 94% 60%)", Icon: LayoutGrid },
  { id: "poses", num: "07", title: "Pose Grid",        subtitle: "Posen-Raster erzeugen",                   category: "character", planFlag: "poseGrid",       nav: { kind: "character", mode: "poses" }, color: "hsl(160 70% 55%)", Icon: LayoutGrid },
  { id: "remix", num: "08", title: "Smart Remix",      subtitle: "Bestehende Bilder neu interpretieren",    category: "character", planFlag: "smartRemix",     nav: { kind: "character", mode: "remix" }, color: "hsl(330 82% 64%)", Icon: Wand2 },
  { id: "studio", num: "09", title: "Avatar Studio",   subtitle: "Perfekte Shots aus einem Referenzbild",   category: "studio", planFlag: "avatarStudio", nav: { kind: "route", to: "/studio" }, color: "hsl(28 95% 60%)", Icon: Camera },
  { id: "story",  num: "10", title: "Reel / Story",    subtitle: "Storyboards & Veo-Videos erstellen",      category: "story",  planFlag: "storyReel",    nav: { kind: "route", to: "/story" },  color: "hsl(38 92% 60%)", Icon: Film },
];

export const CATEGORY_LABELS: Record<TutorialCategory, string> = {
  setup: "Einrichtung",
  character: "Character Creator",
  studio: "Avatar Studio",
  story: "Reel / Story",
};

/** Sichtbar, wenn Setup-Video (planFlag null) oder das Feature im Plan aktiv ist. */
export function isUnlocked(t: Tutorial, plan: PlanCapabilities): boolean {
  if (t.planFlag === null) return true;
  return !!plan[t.planFlag];
}

export function getTutorial(id: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.id === id);
}

/** Beschriftung des Aktions-Buttons — passend zum Ziel des Videos. */
export function tutorialActionLabel(t: Tutorial): string {
  return t.nav.kind === "settings" ? "Zu den Einstellungen" : "Zum Tool";
}

/**
 * Akzentfarbe mit Alpha. Die Tool-Farben sind `hsl(H S% L%)`-Strings — ein
 * hex-Alpha-Suffix (`${color}16`) ist dort UNGÜLTIG und rendert transparent.
 * Deshalb die moderne `hsl(H S% L% / a)`-Syntax verwenden.
 */
export function tint(color: string, alpha: number): string {
  const m = color.match(/^hsl\(([^)]+)\)$/i);
  return m ? `hsl(${m[1]} / ${alpha})` : color;
}

/** Vimeo-Referenz, aber nur wenn tatsächlich eine ID hinterlegt ist. */
export function tutorialVideo(id: string): VimeoRef | null {
  const v = TUTORIAL_VIDEOS[id];
  return v && v.id ? v : null;
}

/** Embed-URL für den Vimeo-Player (mit Privacy-Hash für unlisted Videos). */
export function tutorialEmbedSrc(id: string, autoplay = true): string | null {
  const v = tutorialVideo(id);
  if (!v) return null;
  const params = [
    v.hash ? `h=${v.hash}` : null,
    "badge=0", "byline=0", "portrait=0", "title=0", "dnt=1",
    autoplay ? "autoplay=1" : null,
  ].filter(Boolean).join("&");
  return `https://player.vimeo.com/video/${v.id}?${params}`;
}
