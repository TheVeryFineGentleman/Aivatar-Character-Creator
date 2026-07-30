import { useEffect, useMemo, useRef, useState } from "react";
import {
  Film, Sparkles, RefreshCw, Image as ImageIcon, Wand2, Users, Settings2, AlertTriangle, Trash2, Download, Video as VideoIcon, Play,
  Lightbulb, Loader2, X, Upload, User as UserIcon, ChevronLeft, ChevronRight,
} from "lucide-react";
import { fileToBase64, compressImageToFitSize, urlToBase64, cropDataUrlToAspect } from "@/lib/image";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { SlotProgress } from "@/components/ui/SlotProgress";
import { PlanGate } from "@/components/PlanGate";
import { TutorialCTA } from "@/components/tutorials/TutorialCTA";
import { AiSuggestButton } from "@/components/ai/AiSuggestButton";
import { ImageDropZone, type RefImage } from "@/components/ImageDropZone";
import { StoryDetailDialog } from "@/components/dialogs/StoryDetailDialog";
import { RegenerationSurfaceOverlay } from "@/components/RegenerationSurfaceOverlay";
import { VideoMerger } from "@/components/VideoMerger";
import { VIDEO_ASPECT_RATIOS, aspectClass, videoAspect } from "@/lib/aspectRatio";
import { loadProject, saveProjectState } from "@/lib/projectStorage";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useProjectValue, useProjectRefImages } from "@/hooks/useProjectGallery";
import { useProjectProfile } from "@/hooks/useProjectProfile";
import { buildProfilePreamble } from "@/lib/projectProfile";
import { extractJson, AIError, translateErrorToGerman } from "@/lib/ai";
import { generateImage, generateText } from "@/lib/generate";
import { uid } from "@/lib/uid";
import { runVideoJob } from "@/lib/serverAI";
import { uploadAsset } from "@/lib/projectAssets";
import { extractLastFrame } from "@/lib/video";
import { ResolutionDownloadMenu } from "@/components/ResolutionDownloadMenu";
import { StoryboardSlotsBar } from "@/components/StoryboardSlotsBar";
import { useStoryReloadVersion, autosaveActiveSlot, getActiveSlotId } from "@/lib/storyboardSlots";
import { cn } from "@/lib/cn";
import {
  type StoryMode, type StoryScene, type StoryCharacter, type StoryConfig,
  buildStoryboardPrompt, buildSceneImagePrompt, buildSceneVideoPrompt, getEffectiveStoryHook,
  resolveCharacterNames,
  STORY_ART_STYLES, STORY_PACING_OPTIONS, STORY_MOOD_OPTIONS, STORY_COLOR_OPTIONS, STORY_LANGUAGES,
} from "@/lib/storyPrompts";

interface StoryboardJson {
  mainLocation?: string;
  scenes?: Array<Partial<StoryScene>>;
}

// How many times a scene image is (silently) re-attempted with a varied prompt
// before the error is finally surfaced to the user.
const MAX_IMAGE_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function newScene(raw: Partial<StoryScene>, idx: number): StoryScene {
  return {
    id: uid(),
    summary: raw.summary || `Szene ${idx + 1}`,
    detailedDescription: raw.detailedDescription || "",
    participants: raw.participants || "",
    specificArea: raw.specificArea || "",
    keyAction: raw.keyAction || "",
    emotion: raw.emotion || "",
    dialogText: raw.dialogText || "",
    cameraAngle: raw.cameraAngle || "eye-level",
    shotType: raw.shotType || "medium-shot",
    composition: raw.composition || "drittel-regel",
    movement: raw.movement || "keine",
    audienceEffect: raw.audienceEffect || "spannung",
    continuityNotes: raw.continuityNotes || "",
    imageStatus: "idle",
  };
}

export default function StoryPage() {
  const { genChain, hasGenKey, videoApi } = useSettings();
  const { plan, credentials } = useAuth();
  const { current: currentProject } = useProjects();
  const projectId = currentProject?.id ?? null;

  // Uploaded character references + their typed meta persist per project.
  const [refs, setRefs] = useProjectRefImages("story:refs");
  const [projectProfile] = useProjectProfile();
  const [characterNames, setCharacterNames] = useProjectValue<string[]>("story:characterNames", []);
  const [characterGenders, setCharacterGenders] = useProjectValue<Array<"male" | "female" | "neutral">>("story:characterGenders", []);
  const [characterDescriptions, setCharacterDescriptions] = useProjectValue<string[]>("story:characterDescriptions", []);

  const [mode, setMode] = useProjectValue<StoryMode>("story:mode", "reel");
  const [idea, setIdea] = useProjectValue("story:idea", "");

  // Idea-suggestion bullets (Projekt-style)
  const [storySuggestions, setStorySuggestions] = useState<string[]>([
    "Zufälliges Wiedersehen im Supermarkt",
    "Stilles Treffen ohne Worte",
    "Verlorener Brief verändert alles",
  ]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);
  const [expandingSuggestion, setExpandingSuggestion] = useState(false);

  // KI-Assistent (free-text brief) + generated idea version-history (Projekt-style)
  const [aiAssistantInput, setAiAssistantInput] = useProjectValue("story:aiAssistantInput", "");
  const [generatedIdeas, setGeneratedIdeas] = useProjectValue<string[]>("story:generatedIdeas", []);
  const [currentIdeaIndex, setCurrentIdeaIndex] = useProjectValue("story:currentIdeaIndex", 0);
  const [ideaCount, setIdeaCount] = useProjectValue("story:ideaCount", 1);
  const [generatingIdea, setGeneratingIdea] = useState(false);
  // Wie viele Kurz-Vorschläge (Bullets im leeren Idee-Feld) bei „Neue Vorschläge"
  // generiert werden. Eigener Counter — nicht zu verwechseln mit ideaCount oben.
  const [suggestCount, setSuggestCount] = useProjectValue("story:suggestCount", 3);
  const [pointCount, setPointCount] = useProjectValue("story:pointCount", 4);
  const [aspect, setAspect] = useProjectValue<string>("story:aspect", "9:16");
  const [voiceMode, setVoiceMode] = useProjectValue<"sprecher" | "dialog">("story:voiceMode", "sprecher");
  const [dialogMode, setDialogMode] = useProjectValue<"smart" | "forced">("story:dialogMode", "smart");
  const [generationDirection, setGenerationDirection] = useProjectValue<"speaker-from-description" | "description-from-speaker">("story:generationDirection", "speaker-from-description");
  const [enableSpeaker, setEnableSpeaker] = useProjectValue("story:enableSpeaker", true);
  const [enableSceneDescription, setEnableSceneDescription] = useProjectValue("story:enableSceneDescription", true);
  // Continuity Mode: the last frame of scene N's video becomes the start frame
  // of scene N+1, so cuts visually flow into each other. Default OFF — das
  // Erklär-/Erzähl-Reel-Format lebt von bewusst sichtbaren harten Schnitten;
  // nahtlose Übergänge sind jetzt Opt-in über den Toggle.
  const [continuityMode, setContinuityMode] = useProjectValue("story:continuityMode", false);
  // Session flag: once Veo's lastFrame is rejected for this key, skip it for
  // the rest of the session and fall back to last-frame extraction. Must be a
  // ref, not state: generateAllVideos runs a whole batch inside one render's
  // closures, so a setState from scene 1 wouldn't be visible to scenes 2..N in
  // the same run — they'd keep retrying the guaranteed-failing lastFrame path
  // and lose their continuity transition. A ref updates synchronously.
  const lastFrameUnavailableRef = useRef(false);
  const [speakerGender, setSpeakerGender] = useProjectValue<"male" | "female" | "neutral">("story:speakerGender", "neutral");
  const [artStyle, setArtStyle] = useProjectValue("story:artStyle", "cinematic");
  const [pacing, setPacing] = useProjectValue("story:pacing", "instant-action");
  const [videoMood, setVideoMood] = useProjectValue("story:videoMood", "dramatic");
  const [colorMood, setColorMood] = useProjectValue("story:colorMood", "natural");
  const [hook, setHook] = useProjectValue("story:hook", "");
  const [language, setLanguage] = useProjectValue("story:language", "de");
  const [customDetails, setCustomDetails] = useProjectValue("story:customDetails", "");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [mainLocation, setMainLocation] = useProjectValue("story:mainLocation", "");
  const [scenes, setScenes] = useState<StoryScene[]>([]);
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingVideos, setGeneratingVideos] = useState(false);
  // Cooperative cancellation. The actual fetch can't be aborted (the AI lib has
  // no AbortSignal yet), but batch loops check this between scenes and the UI
  // flips the primary button to "Abbrechen" while anything is running.
  const abortRef = useRef(false);
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);

  const characters: StoryCharacter[] = useMemo(() =>
    refs.map((r, i) => ({
      id: `char_${i}`,
      name: characterNames[i]?.trim() || `Person ${i + 1}`,
      description: characterDescriptions[i] || "",
      gender: characterGenders[i] || "neutral",
      mimeType: r.mimeType,
      base64: r.base64,
    })),
  [refs, characterNames, characterGenders, characterDescriptions]);

  const config: StoryConfig = {
    mode, idea, pointCount, voiceMode, dialogMode, generationDirection,
    enableSpeaker, enableSceneDescription, speakerGender, artStyle,
    pacing, videoMood, colorMood, hook, language, customDetails,
  };

  const expandedSceneIndex = expandedSceneId ? scenes.findIndex((s) => s.id === expandedSceneId) : -1;
  const expandedScene = expandedSceneIndex >= 0 ? scenes[expandedSceneIndex] : null;

  const updateScene = (id: string, patch: Partial<StoryScene>) =>
    setScenes((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  // ── Persist the storyboard per project (sanitized: durable URLs only, never
  //    the heavy in-session base64 — that would blow the localStorage quota). ──
  const [scenesLoaded, setScenesLoaded] = useState<string | null>(null);

  // Wenn ein Storyboard-Slot geladen wird, schreibt der Loader die Szenen
  // direkt in `state.story` zurück und bumpt `storyReloadV`. Dieser Effect
  // hängt mit drin und liest dann das frische Szenen-Array nach.
  const storyReloadV = useStoryReloadVersion();

  useEffect(() => {
    if (!projectId) { setScenesLoaded(null); return; }
    const state = (loadProject(projectId)?.state ?? {}) as { story?: StoryScene[] };
    setScenes(Array.isArray(state.story) ? state.story : []);
    setScenesLoaded(projectId);
  }, [projectId, storyReloadV]);

  useEffect(() => {
    if (!projectId || scenesLoaded !== projectId) return;
    // Don't persist mid-generation (transient loading states / no URL yet).
    if (scenes.some((s) => s.imageStatus === "loading" || s.videoStatus === "loading")) return;
    const h = setTimeout(() => {
      const sanitized: StoryScene[] = scenes.map((s) => ({
        ...s,
        imageDataUrl: undefined,
        imageStatus: s.imageUrl ? "done" : (s.imageStatus === "loading" ? "idle" : s.imageStatus),
        videoStatus: s.videoUrl ? "done" : (s.videoStatus === "loading" ? "idle" : s.videoStatus),
      }));
      const state = (loadProject(projectId)?.state ?? {}) as Record<string, unknown>;
      saveProjectState(projectId, { ...state, story: sanitized });
    }, 500);
    return () => clearTimeout(h);
  }, [scenes, projectId, scenesLoaded]);

  // ── Auto-Save in den aktiven Storyboard-Slot ──────────────────────────────
  //
  // Jeder Re-Render schiebt einen Save-Timer 900ms in die Zukunft; läuft der ab,
  // wird der Live-State in den aktiven Slot zurückgeschrieben. 900ms sitzt
  // bewusst hinter den 400–500ms-Debounces von useProjectValue / scenes-persist,
  // damit der Snapshot, den `autosaveActiveSlot` aus localStorage liest, schon
  // den letzten Edit enthält.
  //
  // Kein dep-Array → läuft auf jedem Render. Da Re-Renders dieser Seite fast
  // immer aus Storyboard-Edits kommen, ist das günstig genug; konstant tickende
  // Background-Renderer würden den Timer ständig resetten, aber davon gibt es
  // hier keine.
  useEffect(() => {
    if (!projectId) return;
    if (!getActiveSlotId(projectId)) return;
    const h = setTimeout(() => { autosaveActiveSlot(projectId); }, 900);
    return () => clearTimeout(h);
  });

  const onRefsChange = (next: RefImage[]) => {
    setRefs(next);
    // Leave names empty so the input shows the "Person N" placeholder and invites
    // a real name — no "CharN" default leaking into the storyboard text.
    setCharacterNames((prev) => next.map((_, i) => prev[i] ?? ""));
    setCharacterGenders((prev) => next.map((_, i) => prev[i] || "neutral"));
    setCharacterDescriptions((prev) => next.map((_, i) => prev[i] || ""));
  };

  // Inline file upload for Projekt-style character cards
  const charFileInputRef = useRef<HTMLInputElement>(null);
  const MAX_CHARS = 3;

  const addCharacterFiles = async (files: FileList | File[]) => {
    const remaining = MAX_CHARS - refs.length;
    if (remaining <= 0) return;
    const next: RefImage[] = [];
    for (const f of Array.from(files).slice(0, remaining)) {
      if (!f.type.startsWith("image/")) continue;
      const compressed = await compressImageToFitSize(f);
      const { base64, mimeType } = await fileToBase64(compressed);
      next.push({
        id: uid(),
        dataUrl: `data:${mimeType};base64,${base64}`,
        base64,
        mimeType,
        name: f.name,
      });
    }
    onRefsChange([...refs, ...next]);
  };

  const removeRef = (i: number) => {
    const nextRefs = refs.filter((_, idx) => idx !== i);
    setCharacterNames((prev) => prev.filter((_, idx) => idx !== i));
    setCharacterGenders((prev) => prev.filter((_, idx) => idx !== i));
    setCharacterDescriptions((prev) => prev.filter((_, idx) => idx !== i));
    setRefs(nextRefs);
  };

  const generateSuggestions = async () => {
    if (!hasGenKey) { toast.error("Bitte hinterlege zuerst deinen API-Key."); return; }
    const n = Math.max(1, Math.min(20, suggestCount));
    setLoadingSuggestions(true);
    try {
      const json = await generateText(genChain, {
        prompt: buildProfilePreamble(projectProfile) + `Generiere genau ${n} sehr kurze ${mode === "reel" ? "Themen-Ideen (jeweils max. 6 Wörter) für ein Erklär-/Erzähl-Reel (TikTok/Shorts) — Botschaften, Thesen oder Themen, die man erklären/erzählen kann, KEINE Geschichten" : "Story-Ideen (jeweils max. 6 Wörter) für ein längeres Storyboard"}.

REGELN:
- Jede Idee ist eine prägnante deutsche Phrase
- Keine kompletten Sätze, eher Stichworte/Konzepte
- Eigenständig und unterschiedlich voneinander
- Antworte NUR mit einem JSON-Array von Strings, sonst nichts

Beispiel-Format: ${JSON.stringify(Array.from({ length: n }, (_, i) => `Idee ${i + 1}`))}`,      });
      const parsed = extractJson(json);
      if (Array.isArray(parsed) && parsed.length >= 1) {
        const list = parsed.slice(0, n).map((s: any) => String(s));
        while (list.length < n) list.push("Eigene Idee schreiben…");
        setStorySuggestions(list);
        setPickedIdx(null);
      } else {
        toast.error("Konnte keine Ideen extrahieren.");
      }
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
      toast.error(err.message);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const pickSuggestion = async (i: number) => {
    if (expandingSuggestion) return;
    setPickedIdx(i);
    const seed = storySuggestions[i];

    if (!hasGenKey) {
      // No key — just paste the seed
      setIdea(seed);
      return;
    }

    setExpandingSuggestion(true);
    setIdea("");
    try {
      const reelHints = mode === "reel"
        ? "\n- ERKLÄR-/ERZÄHL-REEL: eine klare Botschaft, die gesprochen vermittelt wird (in die Kamera oder als Off-Sprecher) — KEINE Kurzgeschichte\n- Hook-First: der stärkste gesprochene Satz kommt zuerst\n- Zu jeder Aussage eine übertriebene, wörtliche visuelle Umsetzung (z. B. „KI ist kaputt\" → Kugel zertrümmert einen Laptop)\n- Harte Schnitte, Creator-Style, scroll-stopping"
        : "";

      const result = await generateText(genChain, {
        prompt: buildProfilePreamble(projectProfile) + `Erweitere diese kurze ${mode === "reel" ? "Themen-Idee zu einem packenden Konzept für ein Erklär-/Erzähl-Reel: Was wird gesagt, und mit welchen dramatischen Bildern wird es unterstrichen?" : "Story-Zusammenfassung zu einer visuell packenden Szenenbeschreibung — optimiert für ein längeres Storyboard."}

REGELN:
- 3–6 Sätze, visuell und atmosphärisch
- Beschreibe Bewegung, Aktion, Emotionen — keine statischen Bilder
- Jeder Satz braucht einen klaren emotionalen Beat
- Denke in Szenen die man FILMEN kann: Kamerabewegungen, Licht, Mimik${reelHints}

Zusammenfassung: "${seed}"

Antworte NUR mit der fertigen Beschreibung auf Deutsch. Keine Einleitungen, keine Meta-Kommentare, keine Anführungszeichen drumherum.`,      });
      const expanded = result.trim();
      if (expanded) setIdea(expanded);
      else setIdea(seed);
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
      toast.error(err.message);
      setIdea(seed); // fallback to plain seed
    } finally {
      setExpandingSuggestion(false);
      setPickedIdx(null);
    }
  };

  // KI-Assistent: free-text brief → generate N full story ideas. If there is already
  // an idea in the left textarea, the input is treated as an adjustment wish instead.
  const generateStoryIdea = async () => {
    if (!hasGenKey) { toast.error("Bitte hinterlege zuerst deinen API-Key."); return; }
    const trimmedBrief = aiAssistantInput.trim();
    const trimmedIdea  = idea.trim();
    if (!trimmedBrief && !trimmedIdea) {
      toast.error("Schreibe links eine Idee oder rechts ein Briefing.");
      return;
    }
    setGeneratingIdea(true);
    try {
      const tweak = !!trimmedIdea;
      const reelHints = mode === "reel"
        ? "\n- ERKLÄR-/ERZÄHL-REEL: eine Botschaft/These, gesprochen vermittelt (in die Kamera oder Off-Sprecher) — keine Kurzgeschichte\n- Hook-First: stärkster gesprochener Satz zuerst, scroll-stopping\n- Pro Aussage eine übertriebene, wörtliche visuelle Umsetzung als Blickfang (z. B. „KI ist kaputt\" → Kugel zertrümmert einen Laptop)"
        : "";
      const outputRule = ideaCount > 1
        ? `AUSGABEFORMAT: Antworte AUSSCHLIESSLICH mit einem JSON-Array mit genau ${ideaCount} Strings. Kein Markdown, keine Erklärungen.`
        : `AUSGABEFORMAT: Antworte NUR mit der Story-Idee, keine Einleitungen, keine Anführungszeichen.`;

      const prompt = tweak
        ? `Du bist ein ${mode === "reel" ? "Creator-Texter für kurze Erklär-/Erzähl-Reels (TikTok/Shorts)" : "Story-Autor für längere Storyboards"}.

AKTUELLE STORY-IDEE:
"${trimmedIdea}"

${trimmedBrief ? `ÄNDERUNGSWUNSCH:\n"${trimmedBrief}"` : "Verbessere und erweitere diese Story-Idee."}

Erstelle genau ${ideaCount} ${ideaCount > 1 ? "verschiedene Varianten" : "Variante"} der angepassten Idee. Behalte den Kern bei, integriere die Änderung.${ideaCount > 1 ? " Jede Variante mit anderem Fokus." : ""}${reelHints}

REGELN:
- ${ideaCount > 1 ? "Jede Variante" : "Die Variante"} 4–8 Sätze, visuell und konkret beschrieben
- Auf Deutsch
- ${outputRule}`
        : `Du bist ein ${mode === "reel" ? "Creator-Texter für kurze Erklär-/Erzähl-Reels (TikTok/Shorts)" : "Story-Autor für längere Storyboards"}. Erstelle genau ${ideaCount} fesselnde Story-Idee${ideaCount > 1 ? "n" : ""}.

BRIEFING vom User:
"${trimmedBrief}"

REGELN:
- ${ideaCount > 1 ? "Jede Idee" : "Die Idee"} 4–8 Sätze, visuell und filmbar
- Auf Deutsch${reelHints}
- ${outputRule}`;

      const result = await generateText(genChain, {
        prompt: buildProfilePreamble(projectProfile) + prompt,        json: ideaCount > 1,
      });

      let newIdeas: string[];
      if (ideaCount > 1) {
        const parsed = extractJson(result);
        newIdeas = Array.isArray(parsed)
          ? parsed.map((s: any) => String(s).trim()).filter(Boolean)
          : [];
      } else {
        newIdeas = [result.trim()].filter(Boolean);
      }

      if (!newIdeas.length) {
        toast.error("Konnte keine Idee extrahieren.");
        return;
      }

      setGeneratedIdeas(newIdeas);
      setCurrentIdeaIndex(0);
      setIdea(newIdeas[0]);
      toast.success(newIdeas.length > 1 ? `${newIdeas.length} Varianten generiert.` : "Idee generiert.");
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
      toast.error(err.message);
    } finally {
      setGeneratingIdea(false);
    }
  };

  const navigateIdea = (dir: "prev" | "next") => {
    if (!generatedIdeas.length) return;
    const nextIdx = dir === "prev"
      ? Math.max(0, currentIdeaIndex - 1)
      : Math.min(generatedIdeas.length - 1, currentIdeaIndex + 1);
    if (nextIdx === currentIdeaIndex) return;
    setCurrentIdeaIndex(nextIdx);
    setIdea(generatedIdeas[nextIdx]);
  };

  // Cooperative abort. Sets the flag so all running loops bail at their next
  // checkpoint, then immediately clears the loading UI so the user sees a
  // response. The in-flight network call still finishes server-side — we just
  // discard its result.
  const requestAbort = () => {
    abortRef.current = true;
    setGeneratingStoryboard(false);
    setGeneratingImages(false);
    setGeneratingVideos(false);
    toast.info("Abbruch — laufende Anfrage wird verworfen.");
  };

  const generateStoryboard = async () => {
    if (!hasGenKey) { toast.error("Bitte hinterlege zuerst deinen API-Key."); return; }
    if (!idea.trim()) { toast.error("Bitte gib deine Story-Idee ein."); return; }

    abortRef.current = false;
    setGeneratingStoryboard(true);
    setExpandedSceneId(null);
    try {
      const prompt = buildStoryboardPrompt({ ...config, characters, continuity: continuityMode });
      const json = await generateText(genChain, {
        prompt,        temperature: mode === "reel" ? 0.55 : 0.8,
        maxOutputTokens: mode === "reel" ? 6000 : 8000,
        json: true,
      });
      if (abortRef.current) return; // User cancelled — discard the result.
      if (import.meta.env.DEV) console.log("[Storyboard] raw model response:\n", json);
      const parsed = extractJson<StoryboardJson>(json);
      const sceneList = Array.isArray(parsed.scenes) ? parsed.scenes : [];
      if (!sceneList.length) throw new AIError("NO_SCENES", "KI hat keine Szenen geliefert.", "Versuche die Idee konkreter zu formulieren.");

      setMainLocation(parsed.mainLocation || "");
      const mapped = sceneList.slice(0, pointCount).map((raw, i) => newScene(raw, i));
      // Replace any "Char 1 / Char 2" placeholders the model may still emit with
      // the real character names (Torsten, Isla, …) so the dialog & participants
      // read correctly everywhere.
      const named = mapped.map((s) => ({
        ...s,
        summary: resolveCharacterNames(s.summary, characters),
        detailedDescription: resolveCharacterNames(s.detailedDescription, characters),
        participants: resolveCharacterNames(s.participants, characters),
        keyAction: resolveCharacterNames(s.keyAction, characters),
        dialogText: resolveCharacterNames(s.dialogText, characters),
        continuityNotes: resolveCharacterNames(s.continuityNotes, characters),
      }));
      setScenes(named);

      if (mapped.length < pointCount) {
        toast.warning(`KI hat ${mapped.length} von ${pointCount} Szenen generiert.`);
      } else {
        toast.success(`Storyboard mit ${mapped.length} Szenen erstellt.`);
      }
    } catch (e: any) {
      if (abortRef.current) return; // Don't surface errors from cancelled runs.
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Storyboard-Generierung fehlgeschlagen.");
      toast.error(err.message, { description: err.hint });
    } finally {
      setGeneratingStoryboard(false);
    }
  };

  // Resolves the previous scene's image as a data URL — preferring the in-session
  // base64 (just rendered), falling back to the persisted URL on Spaces. Returns
  // null for the first scene or when no image exists yet.
  const resolvePrevSceneImage = async (sceneId: string): Promise<string | null> => {
    const idx = scenes.findIndex((s) => s.id === sceneId);
    if (idx <= 0) return null;
    const prev = scenes[idx - 1];
    if (prev.imageDataUrl) return prev.imageDataUrl;
    if (prev.imageUrl) {
      try {
        const { base64, mimeType } = await urlToBase64(prev.imageUrl);
        return `data:${mimeType};base64,${base64}`;
      } catch { return null; }
    }
    return null;
  };

  const generateSceneImage = async (
    scene: StoryScene,
    opts: { prevImageOverride?: string | null; minAttempt?: number } = {},
  ): Promise<string | null> => {
    if (!hasGenKey) { toast.error("Bitte hinterlege zuerst deinen API-Key."); return null; }
    updateScene(scene.id, { imageStatus: "loading", imageError: undefined, imageHint: undefined });

    // The previous scene's image goes in ONLY for environment / outfit / lighting
    // continuity — NOT as a face source. Chaining a face off the prev frame lets
    // small errors compound scene-to-scene (drift). What stops the drift is the
    // prompt's labelled reference-map (avatar = identity anchor, prev frame =
    // "continuity only, never a face"), NOT the image order — so the avatars stay
    // first and the prev frame last, which preserves per-scene variation.
    // `prevImageOverride === null` means "explicitly no prev" (first scene in a
    // batch); `undefined` means "look it up from state".
    const prevImg = opts.prevImageOverride !== undefined
      ? opts.prevImageOverride
      : await resolvePrevSceneImage(scene.id);

    // Resolve the prev frame to base64 first so the prompt's reference-map order
    // matches the actual inline-image order even if the prev image is unreachable.
    // Done once and reused across retries.
    let prevRef: { mimeType: string; base64: string } | null = null;
    if (prevImg) {
      try {
        const { base64, mimeType } = await urlToBase64(prevImg);
        prevRef = { mimeType, base64 };
      } catch { /* prev image unreachable — proceed without it */ }
    }

    // Order MUST mirror buildSceneImagePrompt's reference-map: avatar identity
    // anchors first, previous frame (continuity only) last.
    const allRefs: { mimeType: string; base64: string }[] =
      refs.map((r) => ({ mimeType: r.mimeType, base64: r.base64 }));
    if (prevRef) allRefs.push(prevRef);

    // Silent retry loop. Each attempt varies / softens the prompt in the
    // background; the scene stays in the "loading" state the WHOLE time so the
    // user never sees a flicker of error — it just looks like it's still
    // rendering. Only once every attempt is exhausted do we surface an error,
    // and only then with a German-translated message.
    let lastErr: AIError | null = null;
    // `minAttempt` hebt die Softening-Stufe an: beim Nachgenerieren fehlender
    // (also bereits am Filter gescheiterter) Szenen starten wir sofort mit einer
    // entschärften, umformulierten Prompt-Variante statt dem rohen Erstversuch.
    const attemptFloor = opts.minAttempt ?? 0;
    for (let i = 0; i < MAX_IMAGE_ATTEMPTS; i++) {
      const attempt = attemptFloor + i;
      if (abortRef.current) return null; // explicit user cancel — bail silently

      const prompt = buildSceneImagePrompt({
        scene, mode, mainLocation,
        artStyle, colorMood, videoMood,
        characters,
        hasReferences: refs.length > 0 || !!prevRef,
        hasPrevImage: !!prevRef,
        aspect,
        voiceMode: enableSpeaker ? voiceMode : "sprecher",
        continuity: continuityMode,
        attempt,
      });

      try {
        const dataUrl = await generateImage(genChain, {
          prompt,
          references: allRefs,
          aspectRatio: aspect,
        });
        if (abortRef.current) return null;
        updateScene(scene.id, {
          imageStatus: "done", imageDataUrl: dataUrl, detailedImagePrompt: prompt,
          imageError: undefined, imageHint: undefined,
          // Neu generiertes Bild → das alte, nicht mehr passende Video entfernen,
          // sodass nur das neue Bild angezeigt wird.
          videoStatus: "idle", videoUrl: undefined, videoJobId: undefined,
          videoProgressPct: undefined, videoError: undefined,
        });
        // Persist the image to the bucket so it survives reloads (best-effort —
        // falls back silently to the in-session base64 if Spaces isn't configured).
        if (projectId) {
          uploadAsset(credentials?.email ?? "", projectId, "generated", dataUrl)
            .then((url) => updateScene(scene.id, { imageUrl: url }))
            .catch(() => { /* Spaces off/unreachable — keep base64 only */ });
        }
        return dataUrl;
      } catch (e: any) {
        lastErr = e instanceof AIError ? e : new AIError("UNKNOWN", e?.message || "Bild-Generierung fehlgeschlagen.");
        if (import.meta.env.DEV) {
          console.warn(`[SceneImage] attempt ${attempt + 1}/${MAX_IMAGE_ATTEMPTS} failed:`, lastErr.message);
        }
        // Keep the card looking like it's still loading — do NOT flip to error yet.
        updateScene(scene.id, { imageStatus: "loading", imageError: undefined, imageHint: undefined });
        // Back off before the next variant: longer on rate-limit / server errors.
        if (i < MAX_IMAGE_ATTEMPTS - 1) {
          const code = lastErr.code;
          const backoff = code === 429 ? 4000 : (typeof code === "number" && code >= 500 ? 2500 : 700);
          await sleep(backoff);
        }
      }
    }

    // Every attempt failed → surface the error now, translated into German.
    if (abortRef.current) return null;
    const rawMsg = lastErr?.message || "Bild-Generierung fehlgeschlagen.";
    let germanMsg = rawMsg;
    try { germanMsg = await translateErrorToGerman(rawMsg, genChain[0]?.key ?? ""); } catch { /* keep raw */ }
    updateScene(scene.id, { imageStatus: "error", imageError: germanMsg, imageHint: lastErr?.hint });
    return null;
  };

  const generateAllImages = async (opts: { onlyMissing?: boolean } = {}) => {
    if (!scenes.length) { toast.error("Erst Storyboard generieren."); return; }
    abortRef.current = false;
    setGeneratingImages(true);
    try {
      // Sequential — each scene gets the previous scene's just-generated image as
      // an extra reference. Parallel batching would defeat the continuity link.
      let prevImg: string | null = null;
      for (const s of scenes) {
        if (abortRef.current) break; // user clicked „Abbrechen"
        // „Fehlende Bilder generieren": bereits fertige Szenen NICHT neu rendern.
        // Ihr Bild wird trotzdem als Kontinuitäts-Referenz weitergereicht, damit
        // die nachfolgenden fehlenden Szenen die Anschluss-Kette behalten.
        const alreadyDone = s.imageStatus === "done" && (!!s.imageDataUrl || !!s.imageUrl);
        if (opts.onlyMissing && alreadyDone) {
          prevImg = s.imageDataUrl || s.imageUrl || prevImg;
          continue;
        }
        // Nachgenerierte (fehlende) Szenen sind schon einmal gescheitert → direkt
        // mit einer stark entschärften, umformulierten Prompt-Variante starten.
        const dataUrl = await generateSceneImage(s, {
          prevImageOverride: prevImg,
          minAttempt: opts.onlyMissing ? 2 : 0,
        });
        if (dataUrl) prevImg = dataUrl;
      }
    } finally {
      setGeneratingImages(false);
    }
  };

  const generateSceneVideo = async (
    scene: StoryScene,
    opts: { startImageOverride?: string; endImageOverride?: string } = {},
  ) => {
    if (!plan.videoGen) {
      toast.error("Video-Generierung benötigt mindestens Premium.");
      return;
    }
    // Continuity mode passes in the previous scene's last frame as the start.
    // Otherwise: use the scene's own image (in-session base64 or restored URL).
    let startImageDataUrl = opts.startImageOverride || scene.imageDataUrl;
    if (!startImageDataUrl && scene.imageUrl) {
      try {
        const { base64, mimeType } = await urlToBase64(scene.imageUrl);
        startImageDataUrl = `data:${mimeType};base64,${base64}`;
      } catch { /* fall through to the error below */ }
    }
    if (!startImageDataUrl) {
      toast.error("Erst Bild für die Szene generieren.");
      return;
    }

    // Smart-Pick aus useSettings: nimmt den priorisierten Provider, fällt auf
    // den anderen zurück wenn dessen Key vorhanden ist.
    if (!videoApi) {
      toast.error("Kein Video-Key gesetzt (Google oder fal.ai) — Einstellungen öffnen.");
      return;
    }
    // Provider-Kette fürs Video: gewählter Provider zuerst, der andere als
    // Fallback bei Fehler (beide können Video; fal hat andere Moderation, kann
    // also z. B. einen von Veo gefilterten Frame doch rendern).
    const videoChain = genChain.length ? genChain : [videoApi];

    // In continuity mode the override frame IS the scene's image now — show it
    // immediately so the UI reflects the new start frame while Veo renders.
    const patch: Partial<StoryScene> = {
      videoStatus: "loading", videoProgressPct: 0, videoError: undefined,
    };
    if (opts.startImageOverride) {
      patch.imageDataUrl = opts.startImageOverride;
      patch.imageStatus = "done";
      patch.imageError = undefined;
      patch.imageHint = undefined;
    }
    updateScene(scene.id, patch);

    // Persist the override frame as the scene's durable image too, so reloads
    // keep the continuity link intact.
    if (opts.startImageOverride && projectId) {
      uploadAsset(credentials?.email ?? "", projectId, "generated", opts.startImageOverride)
        .then((url) => updateScene(scene.id, { imageUrl: url }))
        .catch(() => { /* keep base64 only */ });
    }
    try {
      const sceneIdx = scenes.findIndex((x) => x.id === scene.id);
      const videoPrompt = buildSceneVideoPrompt({
        scene, mode,
        pacing, mood: videoMood, colorMood,
        effectiveHook: getEffectiveStoryHook(mode, hook, enableSpeaker),
        language,
        aspect,
        voiceMode: enableSpeaker ? voiceMode : "sprecher",
        speakerGender,
        // Position + continuity drive the "one continuous take" in/out directives.
        sceneIndex: sceneIdx < 0 ? 0 : sceneIdx,
        sceneCount: scenes.length,
        continuity: continuityMode,
      });
      // Crop+compress reference frames before sending. Cropping to the EXACT
      // target ratio is what stops Veo from letterboxing an off-ratio start
      // frame into the clip (the black-bars bug). Compression keeps the request
      // body small — 4 MB PNGs would balloon start+end to 6+ MB.
      const videoRatio = videoAspect(aspect);
      const startCompressed = await cropDataUrlToAspect(startImageDataUrl, videoRatio);
      const endCompressed = opts.endImageOverride
        ? await cropDataUrlToAspect(opts.endImageOverride, videoRatio)
        : undefined;
      const runOnce = (withEnd: boolean, provider: "google" | "fal", key: string) => {
        // lastFrame ist Veo-3.1-only → der WITH-end-Versuch bleibt auf 3.1.
        // Der Retry OHNE End-Frame erweitert wieder auf die volle Liste, damit ein
        // transienter 3.1-Ausfall (preview-Modell, gelegentlich 5xx/overloaded) auf
        // die stabilen 3.0/2.0 durchfallen kann. Vorher wurde die Liste einmal aus
        // `endCompressed` berechnet — dann schickte der Retry dieselbe 3.1-only-
        // Liste und scheiterte identisch, was ganze Continuity-Reels killte.
        const googleModels = withEnd
          ? ["veo-3.1-generate-preview", "veo-3.1-fast-generate-preview"]
          : ["veo-3.1-generate-preview", "veo-3.1-fast-generate-preview", "veo-3.0-generate-001", "veo-2.0-generate-001"];
        return runVideoJob(
          {
            provider,
            apiKey: key,
            modelCandidates: provider === "google" ? googleModels : undefined,
            params: {
              prompt: videoPrompt,
              startImageDataUrl: startCompressed,
              // Server forwards endImageDataUrl as Veo's `lastFrame`. Only Veo 3.1
              // supports it — older models 400 or just ignore it.
              endImageDataUrl: withEnd ? endCompressed : undefined,
              // Veo/fal only render 9:16 | 16:9 | 1:1 — snap the chosen format so the
              // clip is never silently rendered as the provider default (16:9).
              aspectRatio: videoAspect(aspect),
              // Veo 3.1's lastFrame ONLY works at 8s (at 4s/6s Google rejects it).
              // Zudem immer 8s rendern: die LETZTE Reel-Szene hat keinen End-Frame
              // und bekam früher nur 6s — zu kurz, der Dialog wurde abgeschnitten.
              // 8s gibt jeder Szene genug Zeit, alles vollständig auszusprechen.
              durationSeconds: 8,
            },
          },
          (p) => {
            const fakePct = Math.min(95, 5 + p.ticks * 6);
            updateScene(scene.id, {
              videoStatus: p.status === "completed" ? "done" : "loading",
              videoProgressPct: fakePct,
              videoJobId: p.handle,
            });
          },
        );
      };

      // Once Veo's lastFrame failed for this key (session flag), don't try it
      // again — it costs an extra 5+s server round-trip for guaranteed failure.
      const tryWithEnd = !!endCompressed && !lastFrameUnavailableRef.current;

      // Provider-Fallback: erst der gewählte Provider (mit lastFrame-Retry-Logik),
      // bei Fehler der nächste in der Kette (z. B. fal, wenn Veo den Frame filtert).
      let videoUrl: string | undefined;
      let lastVideoErr: unknown;
      for (let ci = 0; ci < videoChain.length; ci++) {
        const link = videoChain[ci];
        try {
          try {
            videoUrl = await runOnce(/* withEnd */ tryWithEnd, link.provider, link.key);
          } catch (e: any) {
            const msg = String(e?.message || "");
            const lastFrameRejected = /lastFrame.*not supported|isn'?t supported by this model/i.test(msg);
            // Inhaltsfilter/leeres Ergebnis kommt vom START-Bild (Gesicht) — ein
            // Retry OHNE End-Frame schickt dasselbe Gesicht und scheitert identisch.
            // Also NICHT ohne End-Frame wiederholen, sondern raus (der Provider-Loop
            // versucht dann den anderen Provider, dessen Moderation abweichen kann).
            const contentFiltered = /Kein Video in der Antwort|Inhaltsrichtlinie|raiMedia|gefiltert/i.test(msg);
            if (endCompressed && !contentFiltered && (tryWithEnd || lastFrameRejected)) {
              if (lastFrameRejected && !lastFrameUnavailableRef.current) {
                lastFrameUnavailableRef.current = true;
                toast.info("Veo-Modell ohne lastFrame — Übergänge laufen jetzt über Frame-Extraktion (auch nahtlos).", {
                  id: "lastframe-disabled",
                });
              } else if (!lastFrameRejected) {
                toast.warning(`Szene ${scenes.findIndex((x) => x.id === scene.id) + 1}: erneuter Versuch ohne End-Frame…`);
              }
              if (import.meta.env.DEV) console.warn("[Video] retry without lastFrame:", msg);
              videoUrl = await runOnce(/* withEnd */ false, link.provider, link.key);
            } else {
              throw e;
            }
          }
          break; // Erfolg mit diesem Provider
        } catch (e) {
          lastVideoErr = e;
          if (ci < videoChain.length - 1) {
            toast.warning(`Szene ${scenes.findIndex((x) => x.id === scene.id) + 1}: ${link.provider} fehlgeschlagen — versuche ${link.provider === "google" ? "fal.ai" : "Google"}…`);
            if (import.meta.env.DEV) console.warn(`[Video] provider ${link.provider} failed, falling back:`, e);
          }
        }
      }
      if (videoUrl === undefined) {
        throw lastVideoErr instanceof Error ? lastVideoErr : new AIError("VIDEO_FAIL", "Video-Generierung fehlgeschlagen.");
      }
      // Offload the (ephemeral) fal/Veo video URL to the bucket so it stays
      // available after it expires / across reloads. Server fetches it directly.
      let durableVideoUrl = videoUrl;
      if (import.meta.env.DEV) {
        console.log("[Video] received from server:", videoUrl.slice(0, 80) + (videoUrl.length > 80 ? "…" : ""));
      }
      if (projectId) {
        try {
          durableVideoUrl = await uploadAsset(credentials?.email ?? "", projectId, "videos", videoUrl);
          if (import.meta.env.DEV) console.log("[Video] uploaded to Spaces:", durableVideoUrl);
        } catch (e) {
          if (import.meta.env.DEV) console.warn("[Video] Spaces upload failed, keeping source URL:", e);
        }
      }
      updateScene(scene.id, { videoStatus: "done", videoUrl: durableVideoUrl, videoPrompt, videoProgressPct: 100 });
      toast.success(`Szene ${scenes.findIndex((x) => x.id === scene.id) + 1}: Video bereit.`);
      // Return the finished URL so the continuity batch can chain frames without
      // depending on a React state read that hasn't flushed yet.
      return durableVideoUrl;
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Video-Generierung fehlgeschlagen.");
      // Den ECHTEN Serverfehler zeigen. Nur wenn er wirklich nach fehlendem
      // Veo-Zugriff/Modell aussieht den Billing/Deploy-Hinweis anhaengen — sonst
      // wuerde jeder Poll-/Download-Fehler (der auch "fehlgeschlagen" enthaelt)
      // faelschlich als "Modell nicht verfuegbar" gemeldet.
      const msg = err.message || "";
      const isModelAccess =
        /Veo-Zugriff|ohne Veo|Allowlist|Alle Veo-Modelle|predictLongRunning|not found|nicht verfügbar|401|403/i.test(msg);
      // "Kein Video in der Antwort" / "Inhaltsrichtlinie" = KEIN Video erzeugt
      // (meist Inhaltsfilter beim echten Gesicht-Startbild) — NICHT als "Abruf
      // schlug fehl, erneut versuchen" labeln: ein identischer Retry scheitert
      // wieder und verbrennt Veo-Kontingent.
      const isEmptyOrFiltered = /Kein Video in der Antwort|Inhaltsrichtlinie/i.test(msg);
      const isDownloadOrPoll = /Video-Download|Status-Abfrage/i.test(msg);
      const hint =
        err.hint ||
        (isModelAccess
          ? "Veo-Zugriff fehlt: Google-Key für Veo freischalten (Billing) oder Server-Update einspielen."
          : isEmptyOrFiltered
            ? "Kein Video erzeugt — Inhalt evtl. von Veo gefiltert. Prompt/Startbild (Gesicht) anpassen; ein identischer erneuter Versuch schlägt meist wieder fehl."
            : isDownloadOrPoll
              ? "Video wurde erzeugt, aber Abruf schlug fehl — bitte erneut versuchen (ggf. kürzere Dauer)."
              : undefined);
      updateScene(scene.id, { videoStatus: "error", videoError: err.message, videoHint: hint } as any);
      toast.error(err.message, { description: hint });
    }
  };

  const generateAllVideos = async (opts: { force?: boolean } = {}) => {
    // Continuity mode walks scenes in ORDER (not just the unfinished ones), so
    // it can carry frames between scenes. Without continuity we generate only
    // what's missing, like before.
    const targets = continuityMode
      ? scenes.filter((s) => opts.force || s.videoStatus !== "done")
      : scenes.filter((s) =>
          s.imageStatus === "done" &&
          s.videoStatus !== "loading" &&
          (opts.force || s.videoStatus !== "done"),
        );
    if (!targets.length) {
      toast.info(opts.force ? "Keine passenden Szenen." : "Alle Videos sind bereits fertig.");
      return;
    }

    // Helper: get an image as a data URL (in-session base64 or rehydrate from
    // the durable Spaces URL). Needed for Veo's lastFrame parameter.
    const asDataUrl = async (s: StoryScene): Promise<string | undefined> => {
      if (s.imageDataUrl) return s.imageDataUrl;
      if (s.imageUrl) {
        try {
          const { base64, mimeType } = await urlToBase64(s.imageUrl);
          return `data:${mimeType};base64,${base64}`;
        } catch { return undefined; }
      }
      return undefined;
    };

    // Wie bei generateSceneVideo: priorisierten Provider + Fallback nutzen
    if (!videoApi) {
      toast.error("Kein Video-Key gesetzt (Google oder fal.ai) — Einstellungen öffnen.");
      return;
    }
    const videoProvider: "google" | "fal" = videoApi.provider;

    abortRef.current = false;
    setGeneratingVideos(true);
    try {
      // Sequential. With Google + continuity we use Veo's lastFrame parameter
      // (clip morphs start → end, perfectly aligned cuts). With fal + continuity
      // we extract the previous video's last frame and use it as the next start.
      let prevVideoUrl: string | undefined;
      for (let i = 0; i < scenes.length; i++) {
        if (abortRef.current) break; // user clicked „Abbrechen"
        const s = scenes[i];
        if (!targets.find((t) => t.id === s.id)) {
          // Already-done scene — still remember its video for fal's last-frame path.
          if (continuityMode && s.videoStatus === "done" && s.videoUrl) prevVideoUrl = s.videoUrl;
          continue;
        }

        let startImageOverride: string | undefined;
        let endImageOverride: string | undefined;

        if (continuityMode) {
          // Google Veo with lastFrame access: pass next scene's image as end frame.
          // Otherwise (fal.ai, or Veo without lastFrame for this key): extract
          // the previous video's last frame as this scene's start.
          const useLastFrame = videoProvider === "google" && !lastFrameUnavailableRef.current;
          if (useLastFrame) {
            const next = scenes[i + 1];
            if (next) {
              endImageOverride = await asDataUrl(next);
              if (!endImageOverride && import.meta.env.DEV) {
                console.warn(`[Continuity] scene ${i + 1}: no image for next scene, no end-frame morph.`);
              }
            }
          } else if (prevVideoUrl) {
            try {
              startImageOverride = await extractLastFrame(prevVideoUrl);
            } catch (err) {
              if (import.meta.env.DEV) console.warn(`[Continuity/extract] scene ${i + 1}: frame extract failed:`, err);
              toast.warning(`Szene ${i + 1}: Frame-Übergang nicht möglich (eigenes Bild genutzt).`);
            }
          }
        }

        // Scene needs SOME starting image (its own, or the override).
        if (!startImageOverride && s.imageStatus !== "done") {
          toast.error(`Szene ${i + 1}: Kein Bild vorhanden — überspringe.`);
          continue;
        }

        // Use the URL returned directly from generateSceneVideo for the next
        // iteration's continuity frame. Reading it back from React state here was
        // unreliable — the preceding updateScene had already dirtied the fiber, so
        // the functional-updater read ran deferred and returned undefined, which
        // silently broke the fal / Veo-without-lastFrame frame-extraction chain.
        const finishedUrl = await generateSceneVideo(s, { startImageOverride, endImageOverride });
        if (finishedUrl) prevVideoUrl = finishedUrl;
      }
    } finally {
      setGeneratingVideos(false);
    }
  };

  const regenerateSceneFull = async (scene: StoryScene) => {
    await generateSceneImage(scene);
    if (plan.videoGen) await generateSceneVideo(scene);
  };

  const generateFullStory = async () => {
    await generateStoryboard();
    // Hinweis: scenes State ist nach setState noch leer in dieser Closure — also danach explizit.
    // Wir warten kurz, damit React den State propagiert, und triggern dann Image-Gen.
    setTimeout(() => {
      setScenes((current) => {
        if (current.length) {
          (async () => {
            setGeneratingImages(true);
            try {
              // Sequenziell — siehe Kommentar in generateAllImages: nur so kann
              // Szene N+1 das gerade generierte Bild von Szene N als Referenz nutzen.
              let prevImg: string | null = null;
              for (const s of current) {
                if (abortRef.current) break; // user clicked „Abbrechen"
                const dataUrl = await generateSceneImage(s, { prevImageOverride: prevImg });
                if (dataUrl) prevImg = dataUrl;
              }
            } finally {
              setGeneratingImages(false);
            }
          })();
        }
        return current;
      });
    }, 50);
  };

  const clearStory = () => {
    setScenes([]);
    setMainLocation("");
    setExpandedSceneId(null);
  };

  const ac = aspectClass(aspect);

  // ============ Smart primary action ============
  // The orange button morphs based on what's already done:
  //   1. No scenes yet → "Storyboard + Bilder generieren"
  //   2. Scenes without images → "Alle Bilder generieren"
  //   3. All scenes have images, no videos yet (FULL) → "Alle Videos generieren"
  //   4. Everything done → "Alle Videos neu generieren"
  const sceneCount = scenes.length;
  const imagesDone = sceneCount > 0 && scenes.every((s) => s.imageStatus === "done");
  const anyImage = scenes.some((s) => s.imageStatus === "done");
  const videosDone = sceneCount > 0 && plan.videoGen && scenes.every((s) => s.videoStatus === "done");
  const anyVideo = scenes.some((s) => s.videoStatus === "done");

  type Phase = "create" | "images" | "videos" | "videos-redo";
  const phase: Phase = (() => {
    if (sceneCount === 0) return "create";
    if (!imagesDone) return "images";
    if (plan.videoGen && !videosDone) return "videos";
    if (plan.videoGen && videosDone) return "videos-redo";
    return "images"; // non-FULL plan with completed images — fall back to "neu"
  })();

  const primaryLabel = (() => {
    if (generatingStoryboard) return "Storyboard wird geschrieben…";
    if (generatingImages) return "Bilder werden gerendert…";
    if (generatingVideos) return "Videos werden gerendert…";
    switch (phase) {
      case "create":      return "Storyboard + Bilder generieren";
      case "images":      return anyImage ? "Fehlende Bilder generieren" : "Alle Bilder generieren";
      case "videos":      return anyVideo ? "Fehlende Videos generieren" : "Alle Videos generieren";
      case "videos-redo": return "Alle Videos neu generieren";
    }
  })();

  const primaryAction = () => {
    switch (phase) {
      case "create":      return generateFullStory();
      case "images":      return generateAllImages({ onlyMissing: anyImage });
      case "videos":      return generateAllVideos();
      case "videos-redo": return generateAllVideos({ force: true });
    }
  };

  const primaryLoading = generatingStoryboard || generatingImages || generatingVideos;

  return (
    <PlanGate requires="full" feature="Der Storyboard / Reel Generator">
      <PageHeader
        title="Storyboard / Reel Generator"
        subtitle="Idee rein — KI baut dir ein konsistentes Multi-Szenen-Storyboard mit Bildern."
        badge={<Badge tone="cool"><Film className="w-3 h-3" /> Premium</Badge>}
        cta={<TutorialCTA tutorialId="story" />}
      />

      {/* Save-Slots — bis zu 3 Storyboards pro Projekt speichern/laden */}
      <div className="max-w-4xl mx-auto">
        <StoryboardSlotsBar />
      </div>

      {/* Single-column stacked layout — Projekt-style, centered + narrower */}
      <div className="space-y-6">
        {/* === Setup-Sektion (narrower) ===
            Reihenfolge per CSS `order`: erst Charaktere (Profilbild + Name +
            Geschlecht), dann Story-Idee, dann Stil, dann Generieren. So sind die
            Namen schon gesetzt, bevor die Story erzeugt wird. */}
        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
          <Card className="order-2">
            <CardHeader title="2 · Story-Idee" subtitle="Was soll passieren? In 1–3 Sätzen." icon={<Wand2 className="w-4 h-4" />} />
            <div className="space-y-4">
              <div className="inline-flex bg-white/5 rounded-2xl p-1 gap-1">
                <ModeChip active={mode === "reel"}    onClick={() => { setMode("reel"); setAspect("9:16"); setPacing("instant-action"); }}>Reel (9:16)</ModeChip>
                <ModeChip active={mode === "general"} onClick={() => { setMode("general"); setAspect("16:9"); setPacing("tension-arc"); }}>General (16:9)</ModeChip>
              </div>

              {/*
               * Voice/Dialog-Block — Stack mit Reveal-Flow.
               * Box A (Master) liegt oben (z-30). Box B (Voice) liegt z-20 und schiebt
               * sich beim Aktivieren hinter A hervor nach unten. Box C (Dialog) liegt
               * z-10 und schiebt sich hinter B hervor. Boxen sind immer im DOM, damit
               * die Slide-/Fade-Animation in beide Richtungen läuft.
               */}
              <div className="space-y-1.5 max-w-md">
                {/* Box A — Master-Toggle (Sprechertext aktiv?) */}
                <div className="relative z-30 flex items-center gap-3 p-3 rounded-xl border border-white/8 bg-ink-950/70 shadow-sm">
                  <div className="space-y-0.5 mr-auto">
                    <div className="text-sm font-medium text-ink-50">Sprechertext / Dialog</div>
                    <div className="text-[11px] text-ink-50/55">KI generiert Text pro Szene</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enableSpeaker}
                    onClick={() => setEnableSpeaker(!enableSpeaker)}
                    className={cn(
                      "h-6 w-11 rounded-full transition-colors flex-shrink-0 flex items-center p-0.5",
                      enableSpeaker ? "bg-flare-500 justify-end" : "bg-ink-700 justify-start",
                    )}
                    title={enableSpeaker ? "Sprechertext aus" : "Sprechertext an"}
                  >
                    <span className="block h-5 w-5 rounded-full bg-white shadow" />
                  </button>
                </div>

                {/* Box B — Voice-Modus, schiebt sich hinter Box A hervor */}
                <div
                  className={cn(
                    "relative z-20 overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out",
                    enableSpeaker
                      ? "max-h-32 opacity-100"
                      : "max-h-0 opacity-0 -mt-1.5 pointer-events-none",
                  )}
                  aria-hidden={!enableSpeaker}
                >
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/8 bg-ink-950/55 transition-transform duration-300 ease-out",
                      enableSpeaker ? "translate-y-0" : "-translate-y-full",
                    )}
                  >
                    <div className="space-y-0.5 mr-auto">
                      <div className="text-xs font-medium text-ink-50">Voice-Modus</div>
                      <div className="text-[11px] text-ink-50/55">
                        {voiceMode === "sprecher"
                          ? "Erzähler-Stimme über den Szenen"
                          : "Charaktere reden direkt miteinander"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => { setVoiceMode("sprecher"); setGenerationDirection("speaker-from-description"); }}
                        className={cn(
                          "px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
                          voiceMode === "sprecher"
                            ? "border-flare-400/70 bg-flare-500/15 text-flare-200"
                            : "border-white/10 bg-ink-900/40 text-ink-50/60 hover:border-flare-400/30 hover:text-ink-50",
                        )}
                      >
                        Sprecher
                      </button>
                      <button
                        type="button"
                        onClick={() => { setVoiceMode("dialog"); setGenerationDirection("speaker-from-description"); }}
                        className={cn(
                          "px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
                          voiceMode === "dialog"
                            ? "border-flare-400/70 bg-flare-500/15 text-flare-200"
                            : "border-white/10 bg-ink-900/40 text-ink-50/60 hover:border-flare-400/30 hover:text-ink-50",
                        )}
                      >
                        Dialog
                      </button>
                    </div>
                  </div>
                </div>

                {/* Box C — Dialog-Modus, schiebt sich hinter Box B hervor */}
                <div
                  className={cn(
                    "relative z-10 overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out",
                    enableSpeaker && voiceMode === "dialog"
                      ? "max-h-32 opacity-100"
                      : "max-h-0 opacity-0 -mt-1.5 pointer-events-none",
                  )}
                  aria-hidden={!(enableSpeaker && voiceMode === "dialog")}
                >
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/8 bg-ink-950/45 transition-transform duration-300 ease-out",
                      enableSpeaker && voiceMode === "dialog" ? "translate-y-0" : "-translate-y-full",
                    )}
                  >
                    <div className="space-y-0.5 mr-auto">
                      <div className="text-xs font-medium text-ink-50">Dialog-Modus</div>
                      <div className="text-[11px] text-ink-50/55">
                        {dialogMode === "smart"
                          ? "KI entscheidet pro Szene ob Dialog passt"
                          : "Jede Szene MUSS Dialog enthalten"}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setDialogMode("smart")}
                        className={cn(
                          "px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
                          dialogMode === "smart"
                            ? "border-flare-400/70 bg-flare-500/15 text-flare-200"
                            : "border-white/10 bg-ink-900/40 text-ink-50/60 hover:border-flare-400/30 hover:text-ink-50",
                        )}
                      >
                        Smart
                      </button>
                      <button
                        type="button"
                        onClick={() => setDialogMode("forced")}
                        className={cn(
                          "px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
                          dialogMode === "forced"
                            ? "border-flare-400/70 bg-flare-500/15 text-flare-200"
                            : "border-white/10 bg-ink-900/40 text-ink-50/60 hover:border-flare-400/30 hover:text-ink-50",
                        )}
                      >
                        Erzwungen
                      </button>
                    </div>
                  </div>
                </div>

                {/* Generation-Direction-Pill — gleicher Reveal-Flow wie Box B/C, damit nichts darunter snapped */}
                <div
                  className={cn(
                    "overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out",
                    enableSpeaker
                      ? "max-h-24 opacity-100"
                      : "max-h-0 opacity-0 -mt-1.5 pointer-events-none",
                  )}
                  aria-hidden={!enableSpeaker}
                >
                  <div
                    className={cn(
                      "flex items-center gap-3 flex-wrap transition-transform duration-300 ease-out",
                      enableSpeaker ? "translate-y-0" : "-translate-y-full",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setGenerationDirection(generationDirection === "speaker-from-description" ? "description-from-speaker" : "speaker-from-description")}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/10 bg-ink-950/40 text-xs font-medium text-ink-50 hover:border-flare-400/40 transition-all active:scale-95"
                    >
                      {generationDirection === "speaker-from-description"
                        ? `Details → ${voiceMode === "sprecher" ? "Sprechertext" : "Dialog"}`
                        : `${voiceMode === "sprecher" ? "Sprechertext" : "Dialog"} → Details`}
                    </button>
                    <span className="text-[11px] text-ink-50/55">
                      {generationDirection === "speaker-from-description"
                        ? `KI schreibt ${voiceMode === "sprecher" ? "den Sprechertext" : "den Dialog"} passend zur Szenenbeschreibung`
                        : `KI schreibt die Szene passend zum ${voiceMode === "sprecher" ? "Sprechertext" : "Dialog"}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Top row — Projekt-style: Idee | Generate-Button | KI-Assistent Briefing */}
              <div className="grid lg:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
                {/* LEFT — Deine Idee + Versionshistorie-Navigator */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between h-7">
                    <label className="text-xs font-medium uppercase tracking-wider text-ink-50/55">Deine Idee</label>
                    <div className="flex items-center gap-0 rounded-md border border-white/8 bg-ink-950/40 px-0.5">
                      <button
                        type="button"
                        disabled={generatedIdeas.length === 0 || currentIdeaIndex === 0}
                        onClick={() => navigateIdea("prev")}
                        className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-ink-50/75 transition-colors"
                        title="Vorherige Variante"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] text-ink-50/65 font-medium tabular-nums min-w-[2.5rem] text-center">
                        {generatedIdeas.length > 0
                          ? `${currentIdeaIndex + 1}/${generatedIdeas.length}`
                          : (generatingIdea || expandingSuggestion)
                            ? `1/${ideaCount}`
                            : "1/1"}
                      </span>
                      <button
                        type="button"
                        disabled={generatedIdeas.length === 0 || currentIdeaIndex >= generatedIdeas.length - 1}
                        onClick={() => navigateIdea("next")}
                        className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-ink-50/75 transition-colors"
                        title="Nächste Variante"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="relative flex-1">
                    <Textarea
                      rows={8}
                      value={idea}
                      onChange={(e) => {
                        setIdea(e.target.value);
                        // Mirror manual edits into the active history slot.
                        if (generatedIdeas.length > 0) {
                          const updated = [...generatedIdeas];
                          updated[currentIdeaIndex] = e.target.value;
                          setGeneratedIdeas(updated);
                        }
                      }}
                      // Native placeholder absichtlich leer — der Vorschläge-Overlay
                      // unten zeigt „Wähle eine Idee oder schreibe deine eigene…" plus
                      // klickbare Bullets. Mit einem Placeholder hier würden sich beide
                      // optisch überlagern (Bug-Screenshot vom 2026-06-03).
                      placeholder=""
                      disabled={expandingSuggestion || generatingIdea}
                      className="h-full min-h-[160px]"
                    />
                    {(expandingSuggestion || generatingIdea) && (
                      <div className="absolute inset-0 rounded-2xl bg-ink-900/85 backdrop-blur-sm flex items-center justify-center gap-2 border border-flare-400/30 animate-fade-in">
                        <Loader2 className="w-5 h-5 animate-spin text-flare-300" />
                        <span className="text-sm font-medium text-flare-200">
                          {generatingIdea ? "Ideen werden generiert…" : "KI baut die Story-Idee aus…"}
                        </span>
                      </div>
                    )}
                    {/* Vorschläge-Overlay solange Textarea leer ist */}
                    {!idea && !generatingIdea && !expandingSuggestion && (
                      <div className="absolute inset-0 p-3 pointer-events-none overflow-hidden">
                        <p className="text-xs text-ink-50/55 mb-2">Wähle eine Idee oder schreibe deine eigene…</p>
                        <div className="space-y-0.5 pointer-events-auto">
                          {loadingSuggestions ? (
                            <div className="flex items-center gap-2 text-xs text-ink-50/55 py-1">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-flare-300" />
                              <span>Lädt…</span>
                            </div>
                          ) : (
                            storySuggestions.map((s, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => pickSuggestion(i)}
                                disabled={expandingSuggestion}
                                className={cn(
                                  "block w-full text-left text-sm py-0.5 transition-colors",
                                  pickedIdx === i
                                    ? "text-flare-200"
                                    : "text-ink-50/70 hover:text-flare-200",
                                  "disabled:cursor-not-allowed disabled:opacity-50",
                                )}
                              >
                                <span className="text-flare-300/70 mr-1.5">•</span>{s}
                              </button>
                            ))
                          )}
                          <button
                            type="button"
                            onClick={generateSuggestions}
                            disabled={loadingSuggestions || expandingSuggestion || !hasGenKey}
                            className="inline-flex items-center gap-1 text-[11px] text-flare-300 hover:text-flare-200 mt-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Neue Vorschläge generieren"
                          >
                            {loadingSuggestions
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <Lightbulb className="w-3 h-3" />}
                            Neue Vorschläge
                          </button>
                        </div>
                        {/* Kleines weißes Anzahl-Feld unten rechts — steuert wie viele
                            Kurz-Vorschläge bei „Neue Vorschläge" generiert werden. */}
                        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 pointer-events-auto">
                          <span className="text-[10px] uppercase tracking-wide text-ink-50/45 font-medium select-none">Anzahl</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={suggestCount}
                            onChange={(e) => {
                              const raw = parseInt(e.target.value);
                              const n = Number.isFinite(raw) ? Math.max(1, Math.min(20, raw)) : 1;
                              setSuggestCount(n);
                            }}
                            className="w-12 h-6 text-xs text-center rounded border border-white/30 bg-white text-ink-900 font-medium focus:outline-none focus:border-flare-400 focus:ring-1 focus:ring-flare-400/30"
                            title="Anzahl Vorschläge (1–20)"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* MIDDLE — Generate-Button + Anzahl-Dropdown. Auf lg füllt der Button
                    die volle Höhe der Textarea-Spalten (h-7-Spacer oben für bündigen Top,
                    Count-Select bleibt fix unten). */}
                <div className="flex lg:flex-col items-center gap-2 lg:h-full">
                  <div className="hidden lg:block h-7 flex-shrink-0" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={generateStoryIdea}
                    disabled={generatingIdea || (!aiAssistantInput.trim() && !idea.trim()) || !hasGenKey}
                    className={cn(
                      "rounded-2xl flex items-center justify-center transition-all flex-shrink-0",
                      "w-12 h-12 lg:w-12 lg:h-auto lg:min-h-[160px] lg:flex-1",
                      "bg-flare-500/15 border border-flare-400/30 hover:bg-flare-500/25 hover:border-flare-400/50 text-flare-200",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      "active:scale-95",
                    )}
                    title={idea.trim() ? "Idee anpassen" : "Ideen generieren"}
                  >
                    {generatingIdea
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <ChevronLeft className="w-6 h-6" />}
                  </button>
                  <select
                    value={String(ideaCount)}
                    onChange={(e) => setIdeaCount(parseInt(e.target.value))}
                    className="w-12 h-7 text-xs text-center rounded border border-white/8 bg-ink-950 text-ink-50 cursor-pointer focus:outline-none focus:border-flare-400/50 flex-shrink-0"
                    title="Anzahl Ideen"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={String(n)}>{n}</option>
                    ))}
                  </select>
                </div>

                {/* RIGHT — KI-Assistent: Free-Text-Briefing */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 h-7">
                    <Sparkles className="w-3.5 h-3.5 text-flare-300" />
                    <label className="text-xs font-medium uppercase tracking-wider text-ink-50/55">KI-Assistent</label>
                  </div>
                  <div className="relative flex-1">
                    <Textarea
                      rows={8}
                      value={aiAssistantInput}
                      onChange={(e) => setAiAssistantInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void generateStoryIdea();
                        }
                      }}
                      placeholder={generatedIdeas.length > 0
                        ? 'Beschreibe die gewünschte Änderung, z.B. „Mach es dramatischer" oder „Verlege es ans Meer"…'
                        : 'Beschreibe was für eine Story du möchtest, z.B. „Eine romantische Geschichte in Paris"…'}
                      disabled={generatingIdea}
                      className="h-full min-h-[160px]"
                    />
                  </div>
                </div>
              </div>

            </div>
          </Card>

          <Card className="order-1">
            <CardHeader
              title="1 · Charaktere — Profilbild, Name & Geschlecht"
              subtitle={`Zuerst hochladen & benennen — die Story erkennt die Namen. ${refs.length}/${MAX_CHARS}`}
              icon={<Users className="w-4 h-4" />}
            />

            {/* hidden file input — shared trigger for the dropzone tile */}
            <input
              ref={charFileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) void addCharacterFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {/* Polished card grid with drag-drop */}
            <div
              className="flex flex-wrap gap-3"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files?.length) void addCharacterFiles(e.dataTransfer.files);
              }}
            >
              {refs.map((r, i) => (
                <div
                  key={r.id}
                  className="group w-40 rounded-2xl border border-white/8 bg-ink-900/60 overflow-hidden hover-lift transition-all hover:border-white/15"
                >
                  {/* Image with X remove (revealed on hover) */}
                  <div className="relative aspect-square bg-ink-800">
                    <img
                      src={r.dataUrl}
                      alt={`Referenz ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeRef(i)}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-ink-950/85 backdrop-blur flex items-center justify-center text-ink-50 opacity-0 group-hover:opacity-100 transition-all hover:bg-danger hover:rotate-90 hover:scale-110 active:scale-95"
                      title="Entfernen"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-ink-950/75 backdrop-blur text-[10px] font-semibold text-ink-50/85 pointer-events-none">
                      #{i + 1}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-2.5 space-y-2 border-t border-white/5">
                    {/* Name */}
                    <input
                      value={characterNames[i] || ""}
                      onChange={(e) =>
                        setCharacterNames((arr) =>
                          arr.map((x, j) => (j === i ? e.target.value : x)),
                        )
                      }
                      placeholder={`Person ${i + 1}`}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-ink-800/60 border border-white/8 text-xs font-medium text-center text-ink-50 placeholder:text-ink-50/35 outline-none transition-colors focus:bg-ink-800 focus:border-flare-400/40"
                    />

                    {/* Gender chips */}
                    <div className="grid grid-cols-3 gap-1">
                      {(["male", "female", "neutral"] as const).map((g) => {
                        const active = (characterGenders[i] || "neutral") === g;
                        const label = g === "male" ? "M" : g === "female" ? "W" : "D";
                        const tooltip = g === "male" ? "Männlich" : g === "female" ? "Weiblich" : "Divers";
                        return (
                          <button
                            key={g}
                            type="button"
                            title={tooltip}
                            onClick={() =>
                              setCharacterGenders((arr) =>
                                arr.map((x, j) => (j === i ? g : x)),
                              )
                            }
                            className={cn(
                              "h-7 rounded-md text-[11px] font-semibold transition-all duration-150 active:scale-95",
                              active
                                ? "bg-flare-500/20 text-flare-200 border border-flare-400/40"
                                : "border border-white/8 bg-ink-800/40 text-ink-50/55 hover:text-ink-50 hover:bg-white/5 hover:border-white/15",
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Description */}
                    <textarea
                      value={characterDescriptions[i] || ""}
                      onChange={(e) =>
                        setCharacterDescriptions((arr) =>
                          arr.map((x, j) => (j === i ? e.target.value : x)),
                        )
                      }
                      placeholder="rote Jacke, Brille…"
                      rows={2}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-ink-800/60 border border-white/8 text-[11px] leading-snug text-ink-50 placeholder:text-ink-50/35 outline-none transition-colors focus:bg-ink-800 focus:border-flare-400/40 resize-none"
                    />
                  </div>
                </div>
              ))}

              {/* Add-more tile — matches card dimensions */}
              {refs.length < MAX_CHARS && (
                <button
                  type="button"
                  onClick={() => charFileInputRef.current?.click()}
                  className={cn(
                    "w-40 rounded-2xl border-2 border-dashed border-white/12 bg-ink-900/30",
                    "flex flex-col items-center justify-center gap-2 px-3 py-6",
                    "text-ink-50/50 hover:text-ink-50/85 hover:border-flare-400/40 hover:bg-ink-900/50",
                    "transition-all active:scale-[0.98]",
                  )}
                  style={{ minHeight: refs.length > 0 ? undefined : 240 }}
                  title="Charakter hinzufügen"
                >
                  <div className="w-10 h-10 rounded-xl bg-flare-500/10 border border-flare-400/20 flex items-center justify-center">
                    <Upload className="w-4 h-4 text-flare-300" />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium">Charakter hinzufügen</div>
                    <div className="text-[10px] text-ink-50/40 mt-0.5">Drag & Drop oder klicken</div>
                  </div>
                </button>
              )}

              {/* "Character erstellen" shortcut — only when nothing uploaded yet */}
              {refs.length === 0 && (
                <button
                  type="button"
                  onClick={() => window.location.assign("/character")}
                  className={cn(
                    "w-40 rounded-2xl border border-white/8 bg-ink-900/40",
                    "flex flex-col items-center justify-center gap-2 px-3 py-6",
                    "text-ink-50/55 hover:text-ink-50 hover:border-glacier-400/30 hover:bg-ink-900/60",
                    "transition-all active:scale-[0.98]",
                  )}
                  style={{ minHeight: 240 }}
                  title="Character Creator öffnen"
                >
                  <div className="w-10 h-10 rounded-xl bg-glacier-500/12 border border-glacier-400/20 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-glacier-300" />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium">Erst erstellen</div>
                    <div className="text-[10px] text-ink-50/40 mt-0.5">Character Creator</div>
                  </div>
                </button>
              )}
            </div>

            <p className="text-[11px] text-ink-50/40 mt-3 leading-relaxed">
              Drag & Drop ins Feld, oder klick die Kachel. Name + Geschlecht + Kurzbeschreibung fließen in jeden Szenen-Prompt als Identity-Lock ein.
            </p>
          </Card>

          <Card className="order-3">
            <CardHeader
              title="3 · Stil & Tonalität"
              subtitle={showAdvanced ? "Alle Optionen sichtbar." : 'Klick auf „Erweitert" für alle Optionen.'}
              icon={<Settings2 className="w-4 h-4" />}
              action={
                <Button variant="ghost" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
                  {showAdvanced ? "Weniger" : "Erweitert"}
                </Button>
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Stimmung" value={videoMood} onChange={(e) => setVideoMood(e.target.value)} options={STORY_MOOD_OPTIONS} />
              <Select label="Farbwelt" value={colorMood} onChange={(e) => setColorMood(e.target.value)} options={STORY_COLOR_OPTIONS} />
              <Select label="Pacing" value={pacing} onChange={(e) => setPacing(e.target.value)} options={STORY_PACING_OPTIONS} />
              <Select label="Bildstil" value={artStyle} onChange={(e) => setArtStyle(e.target.value)} options={STORY_ART_STYLES.map((s) => ({ value: s.value, label: s.label }))} />
              <Select label="Format" value={aspect} onChange={(e) => setAspect(e.target.value)} options={VIDEO_ASPECT_RATIOS.map((a) => ({ value: a.value, label: a.label }))} />
              <Select label="Sprache" value={language} onChange={(e) => setLanguage(e.target.value)} options={STORY_LANGUAGES} />
              {enableSpeaker && (
                <Select
                  label="Sprecherstimme"
                  value={speakerGender}
                  onChange={(e) => setSpeakerGender(e.target.value as any)}
                  options={[
                    { value: "neutral", label: "Neutral" },
                    { value: "male",    label: "Männlich" },
                    { value: "female",  label: "Weiblich" },
                  ]}
                />
              )}
            </div>

            <div className={cn("collapse-row mt-4", showAdvanced && "is-open")}>
              <div className="collapse-inner">
                <div className="space-y-3 p-4 rounded-2xl bg-ink-950 border border-white/10 shadow-inner animate-slide-down">
                {/* Continuity Mode — last frame of scene N's video becomes the start frame of scene N+1. */}
                <label className="flex items-start gap-2 text-sm text-ink-50/80 cursor-pointer p-3 rounded-xl border border-white/8 bg-ink-900/40 hover:border-flare-400/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={continuityMode}
                    onChange={(e) => setContinuityMode(e.target.checked)}
                    className="rounded mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-ink-50">Nahtlose Übergänge</div>
                    <div className="text-[11px] text-ink-50/55 mt-0.5 leading-tight">
                      Das Ende von Video&nbsp;N wird zum Anfang (und Bild) von Video&nbsp;N+1. Erzeugt fließende Schnitte ohne sichtbare Sprünge.
                      „Alle Videos generieren" läuft dann sequenziell.
                    </div>
                  </div>
                </label>

                <div className="flex justify-end -mb-1">
                  <AiSuggestButton
                    label="Hook vorschlagen"
                    buildPrompt={() => `Schreibe EINEN kurzen, scroll-stoppenden ${mode === "reel" ? "gesprochenen Hook-Satz für ein Erklär-/Erzähl-Reel (wird direkt in die Kamera oder vom Off-Sprecher gesprochen)" : "Hook/Eröffnungssatz für ein Video"}, passend zum Projekt. Aktuell: "${hook || "—"}". Antworte nur mit dem Hook.`}
                    onApply={setHook}
                  />
                </div>
                <Input
                  label={mode === "reel" ? "Hook (Pflicht bei Reel — Default wenn leer)" : "Hook (optional)"}
                  value={hook}
                  onChange={(e) => setHook(e.target.value)}
                  placeholder={mode === "reel" ? 'z.B. „Niemand ahnt, was in der ersten Sekunde passiert."' : "Optionaler Eröffnungs-Beat"}
                />

                <div className="flex justify-end -mb-1">
                  <AiSuggestButton
                    label="Details vorschlagen"
                    buildPrompt={() => `Fülle „Custom Details" für dieses Projekt sinnvoll aus (Branche, Zielgruppe, Besonderheiten, Tabu-Themen). Aktuell: "${customDetails || "—"}". Kurz, nur der Text.`}
                    onApply={setCustomDetails}
                  />
                </div>
                <Textarea
                  label="Custom Details (optional)"
                  rows={2}
                  value={customDetails}
                  onChange={(e) => setCustomDetails(e.target.value)}
                  placeholder="Branche, Zielgruppe, Besonderheiten, Tabu-Themen — alles was die KI wissen sollte."
                />
                </div>
              </div>
            </div>
          </Card>

          {/* Szenen-Anzahl + Generieren — unter dem gesamten Stil-&-Tonalität-Feld */}
          <Card className="order-4">
            <Slider
              label="Szenen-Anzahl"
              valueLabel={`${pointCount}`}
              min={2}
              max={mode === "reel" ? 8 : 12}
              value={pointCount}
              onChange={(e) => setPointCount(parseInt(e.target.value))}
            />
            <div className="flex flex-wrap items-center justify-end gap-2 pt-4">
              <Button
                onClick={generateStoryboard}
                loading={generatingStoryboard}
                variant="ghost"
                size="sm"
                iconLeft={<Sparkles className="w-3.5 h-3.5" />}
              >
                Nur Storyboard-Text
              </Button>
              <Button
                onClick={primaryLoading ? requestAbort : primaryAction}
                size="lg"
                variant={primaryLoading ? "danger" : "primary"}
                iconLeft={primaryLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : phase === "videos" || phase === "videos-redo"
                    ? <VideoIcon className="w-4 h-4" />
                    : <Sparkles className="w-4 h-4" />}
              >
                {primaryLoading ? "Abbrechen" : primaryLabel}
              </Button>
            </div>
          </Card>
        </div>

        {/* === Storyboard-Output unten === */}
        <div>
          {scenes.length === 0 ? (
            <div className="text-center py-16 text-sm text-ink-50/50 flex flex-col items-center gap-2 animate-fade-in">
              <Film className="w-10 h-10 text-ink-50/25 animate-pulse-ring rounded-full" />
              Noch kein Storyboard.
              <div className="text-xs text-ink-50/40 max-w-md mx-auto">
                Trage deine Idee oben ein, stell die Optionen ein und klick „Storyboard + Bilder generieren".
              </div>
            </div>
          ) : (
            <div className="space-y-3 animate-slide-in-right">
              {/* Toolbar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold tracking-tight">Storyboard</h2>
                  {mainLocation && (
                    <div className="text-xs text-ink-50/55">
                      <span className="uppercase tracking-wider text-ink-50/40 mr-1.5">Hauptort:</span>
                      <span className="text-ink-50/85 font-medium">{mainLocation}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={() => generateAllImages()}
                    loading={generatingImages}
                    size="sm"
                    iconLeft={<ImageIcon className="w-3.5 h-3.5" />}
                    disabled={!scenes.length}
                  >
                    Alle Bilder
                  </Button>
                  {plan.videoGen && (
                    <Button
                      onClick={() => generateAllVideos()}
                      loading={generatingVideos}
                      size="sm"
                      variant="secondary"
                      iconLeft={<VideoIcon className="w-3.5 h-3.5" />}
                      disabled={!scenes.some((s) => s.imageStatus === "done")}
                    >
                      Alle Videos
                    </Button>
                  )}
                  <Button onClick={generateStoryboard} loading={generatingStoryboard} variant="secondary" size="sm" iconLeft={<RefreshCw className="w-3.5 h-3.5" />}>
                    Story neu
                  </Button>
                  <Button onClick={clearStory} variant="ghost" size="sm" iconLeft={<Trash2 className="w-3.5 h-3.5" />}>Verwerfen</Button>
                </div>
              </div>

              {/* Scene grid — wider since full-width now */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 stagger">
                {scenes.map((scene, idx) => (
                  <div key={scene.id} className="animate-pop-in opacity-0 [animation-fill-mode:forwards]">
                    <SceneCard
                      scene={scene}
                      idx={idx}
                      aspectClass={ac}
                      onClick={() => setExpandedSceneId(scene.id)}
                      onGenImage={() => generateSceneImage(scene)}
                      onGenVideo={plan.videoGen ? () => generateSceneVideo(scene) : undefined}
                      onRegenerateAll={() => regenerateSceneFull(scene)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {plan.videoGen && scenes.some((s) => s.videoStatus === "done") && (
            <div className="mt-6 space-y-3">
              {videosDone && (
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-flare-400/30 bg-flare-500/8 animate-fade-in">
                  <div className="w-9 h-9 rounded-xl bg-flare-grad flex items-center justify-center shadow-glow shrink-0">
                    <Film className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink-50">Alle Szenen-Videos sind fertig 🎬</div>
                    <div className="text-xs text-ink-50/60 mt-0.5">
                      Füge sie unten zu deinem finalen Video zusammen und lade es herunter.
                    </div>
                  </div>
                </div>
              )}
              <VideoMerger
                clips={scenes
                  .filter((s) => s.videoStatus === "done" && s.videoUrl)
                  .map((s, i) => ({ id: s.id, url: s.videoUrl!, label: `Szene ${i + 1}: ${s.summary}` }))}
                defaultFilename={`${mode}-${Date.now()}.mp4`}
                aspectRatio={videoAspect(aspect)}
                // Continuity = each clip's first frame duplicates the previous
                // clip's last frame → let the server drop it for seamless joins.
                seamless={continuityMode}
              />
            </div>
          )}
        </div>
      </div>

      <StoryDetailDialog
        open={!!expandedScene}
        scene={expandedScene}
        sceneIndex={expandedSceneIndex}
        aspectClass={ac}
        onClose={() => setExpandedSceneId(null)}
        onUpdate={(patch) => expandedScene && updateScene(expandedScene.id, patch)}
        onRegenerate={() => expandedScene && generateSceneImage(expandedScene)}
      />
    </PlanGate>
  );
}

function ModeChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all",
        active ? "bg-flare-grad text-white shadow-glow" : "text-ink-50/65 hover:text-ink-50",
      )}
    >
      {children}
    </button>
  );
}

function SceneCard({ scene, idx, aspectClass, onClick, onGenImage, onGenVideo, onRegenerateAll }: {
  scene: StoryScene; idx: number; aspectClass: string;
  onClick: () => void; onGenImage: () => void;
  onGenVideo?: () => void;
  onRegenerateAll: () => void;
}) {
  const hasVideo = scene.videoStatus === "done" && scene.videoUrl;
  const videoLoading = scene.videoStatus === "loading";
  // Prefer the in-session base64; fall back to the durable bucket URL (e.g. after a reload).
  const imgSrc = scene.imageDataUrl || scene.imageUrl;
  const hasImage = scene.imageStatus === "done" && !!imgSrc;

  return (
    <div className="rounded-2xl bg-ink-950/40 border border-white/8 overflow-hidden hover:border-white/15 hover-lift group">
      {/* overflow-hidden here too — without it the image's hover scale-105
          pushes past the bottom of the image area into the text block below. */}
      <div className={cn("relative bg-ink-900 overflow-hidden", aspectClass)}>
        {scene.imageStatus === "loading" && <div className="absolute inset-0 skeleton animate-fade-in" />}
        {hasImage && !hasVideo && (
          <img
            src={imgSrc}
            alt={scene.summary}
            // origin-bottom anchors the hover scale at the bottom edge, so the
            // image grows upward (clipped by overflow-hidden) and NEVER pushes
            // past the bottom of the image area into the title block below.
            className="w-full h-full object-cover origin-bottom cursor-pointer animate-image-reveal transition-transform duration-500 group-hover:scale-105"
            title="Szene bearbeiten"
            onClick={onClick}
          />
        )}
        {hasVideo && (
          <video
            src={scene.videoUrl}
            poster={imgSrc}
            controls
            playsInline
            preload="metadata"
            // z-10 keeps the native <video> controls above the regenerate-overlay
            // — otherwise the absolute-positioned overlay swallows the play click.
            className="relative z-10 w-full h-full object-cover bg-ink-900"
          />
        )}
        {scene.imageStatus === "error" && (
          <div className="absolute inset-0 p-3 flex flex-col items-center justify-center text-center bg-danger/5 animate-shake">
            <AlertTriangle className="w-6 h-6 text-danger mb-1.5" />
            <div className="text-[11px] font-medium text-danger px-2">{scene.imageError}</div>
            {scene.imageHint && <div className="text-[10px] text-ink-50/55 mt-1">{scene.imageHint}</div>}
          </div>
        )}
        {scene.imageStatus === "idle" && !hasVideo && (
          <button
            onClick={onGenImage}
            className="absolute inset-0 flex flex-col items-center justify-center text-ink-50/40 hover:text-ink-50/80 hover:bg-white/5 transition-all duration-200 text-xs gap-2"
          >
            <ImageIcon className="w-6 h-6 transition-transform group-hover:scale-110" />
            Bild generieren
          </button>
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-ink-950/80 backdrop-blur-sm text-[10px] font-semibold text-ink-50">
          {idx + 1}
        </div>
        {hasVideo && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-flare-grad text-white text-[10px] font-semibold inline-flex items-center gap-1">
            <Play className="w-2.5 h-2.5" /> Video
          </div>
        )}
        {videoLoading && (
          <div className="absolute inset-x-2 bottom-2 bg-ink-950/85 rounded-lg px-2 py-1.5 backdrop-blur">
            <div className="flex items-center justify-between text-[10px] text-ink-50/85 mb-1">
              <span className="inline-flex items-center gap-1"><VideoIcon className="w-3 h-3 text-flare-300" /> Veo3 rendert…</span>
              <span className="tabular-nums">{typeof scene.videoProgressPct === "number" ? `${Math.round(scene.videoProgressPct)}%` : ""}</span>
            </div>
            <div className="h-1 rounded-full bg-white/8 overflow-hidden">
              <div className="h-full bg-flare-grad transition-all" style={{ width: `${scene.videoProgressPct ?? 5}%` }} />
            </div>
          </div>
        )}
        {scene.imageStatus !== "error" && !hasVideo && <SlotProgress status={scene.imageStatus} expectedMs={20000} />}

        {/* Regenerate overlay: shows when we have an image, but NOT when a video
            is already there — otherwise the overlay swallows the play-button
            clicks of the native <video> controls. With a video the regenerate
            actions in the footer below cover the same needs. */}
        <RegenerationSurfaceOverlay
          show={!!hasImage && !hasVideo}
          onImage={onGenImage}
          onVideo={onGenVideo && hasImage ? onGenVideo : undefined}
          onScene={onRegenerateAll}
          busyLabel={videoLoading ? "Video rendert…" : scene.imageStatus === "loading" ? "Bild rendert…" : null}
        />
      </div>
      <div className="p-3 space-y-2">
        <div className="text-sm font-medium text-ink-50 line-clamp-2 min-h-[2.5em]">{scene.summary}</div>
        {scene.dialogText && (
          <div className="text-[11px] text-ink-50/55 italic line-clamp-2 border-l-2 border-white/10 pl-2">„{scene.dialogText}"</div>
        )}
        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
          <Button size="sm" variant="secondary" onClick={onClick}>Bearbeiten</Button>
          {/* Icon-only by default; the label expands in smoothly on hover. */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onGenImage}
            loading={scene.imageStatus === "loading"}
            iconLeft={<ImageIcon className="w-3 h-3" />}
            title="Bild neu"
            aria-label="Bild neu"
            className="group/imgbtn gap-0"
          >
            <span className="max-w-0 opacity-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out group-hover/imgbtn:max-w-[6rem] group-hover/imgbtn:opacity-100 group-hover/imgbtn:ml-1.5 motion-reduce:transition-none">
              Bild neu
            </span>
          </Button>
          {onGenVideo && hasImage && (
            hasVideo ? (
              // Video already rendered → offer a clear single-scene re-render.
              <Button
                size="sm"
                variant="ghost"
                onClick={onGenVideo}
                loading={videoLoading}
                iconLeft={<RefreshCw className="w-3 h-3" />}
                title="Dieses Video neu rendern"
              >
                Video neu
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={onGenVideo} loading={videoLoading} title="Video erzeugen">
                <VideoIcon className="w-3 h-3" />
              </Button>
            )
          )}
          {imgSrc && (
            <ResolutionDownloadMenu
              dataUrl={imgSrc}
              filename={`scene-${idx + 1}.png`}
              videoUrl={hasVideo ? scene.videoUrl : undefined}
              videoFilename={`scene-${idx + 1}.mp4`}
              align="center"
              preferSide="top"
              triggerTitle={hasVideo ? "Herunterladen (Bild / Video)" : "Bild herunterladen"}
              triggerClassName="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-all duration-150 active:scale-[0.97] text-ink-50/80 hover:bg-white/5 hover:text-ink-50 h-9 px-3 text-xs rounded-md"
            >
              <Download className="w-3 h-3" />
            </ResolutionDownloadMenu>
          )}
          {scene.videoError && (
            <span className="text-[10px] text-danger inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Video-Fehler
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
