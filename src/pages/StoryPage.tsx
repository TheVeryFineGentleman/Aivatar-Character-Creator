import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Film, Sparkles, RefreshCw, Image as ImageIcon, Wand2, Users, Settings2, AlertTriangle, Trash2, Download, Video as VideoIcon, Play,
  Lightbulb, Loader2, X, Upload, User as UserIcon, ChevronLeft, ChevronRight, Volume2, Coins,
} from "lucide-react";
import { fileToBase64, prepareReferenceImage, urlToBase64, urlToReferenceBase64, cropDataUrlToAspect, makeSideMaskDataUrl } from "@/lib/image";
import { mapLimit, VIDEO_CONCURRENCY } from "@/lib/concurrency";
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
import { SuggestionField } from "@/components/ai/SuggestionField";
import { useFieldSuggestions } from "@/hooks/useFieldSuggestions";
import { ImageDropZone, type RefImage } from "@/components/ImageDropZone";
import { StoryDetailDialog } from "@/components/dialogs/StoryDetailDialog";
import { RegenerationSurfaceOverlay } from "@/components/RegenerationSurfaceOverlay";
import { VideoMerger } from "@/components/VideoMerger";
import { VoicePicker } from "@/components/VoicePicker";
import { VIDEO_ASPECT_RATIOS, aspectClass, videoAspect } from "@/lib/aspectRatio";
import { loadProject, saveProjectState } from "@/lib/projectStorage";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useProjectValue, useProjectRefImages } from "@/hooks/useProjectGallery";
import { useProjectProfile } from "@/hooks/useProjectProfile";
import { useElevenVoices, ensureElevenVoices, resolveVoiceValue } from "@/hooks/useElevenVoices";
import { buildProfilePreamble } from "@/lib/projectProfile";
import { SettingsSyncDialog, type SyncPhase } from "@/components/dialogs/SettingsSyncDialog";
import {
  SYNC_SCOPE, buildSettingsSyncPrompt, parseSettingsSync, readSyncField,
  type SyncTrigger, type SyncProposal, type SyncFieldKey, type SyncSnapshot,
} from "@/lib/settingsSync";
import { estimateRunCost, formatUsd } from "@/lib/cost";
import { extractJson, AIError, translateErrorToGerman } from "@/lib/ai";
import { generateImage, generateText } from "@/lib/generate";
import { uid } from "@/lib/uid";
import { runVideoJob, runTalkingAvatarJob, resumeVideoJob } from "@/lib/serverAI";
import { uploadAsset } from "@/lib/projectAssets";
import { SPACES_PUBLIC_BASE } from "@/lib/doSpaces";
import { extractLastFrame } from "@/lib/video";
import { renderSceneVoice, dubSceneVideo } from "@/lib/voice";
import { ResolutionDownloadMenu } from "@/components/ResolutionDownloadMenu";
import { StoryboardSlotsBar } from "@/components/StoryboardSlotsBar";
import { useStoryReloadVersion, autosaveActiveSlot, getActiveSlotId, setActiveSlotId } from "@/lib/storyboardSlots";
import { cn } from "@/lib/cn";
import { ReelSituationPanel } from "@/components/ReelSituationPanel";
import { StepCard } from "@/components/story/StepCard";
import { LockedRow } from "@/components/story/LockedRow";
import { ToolsMenu } from "@/components/story/ToolsMenu";
import { SceneBusyBar } from "@/components/story/SceneBusyBar";
import { PipelineSteps } from "@/components/story/PipelineSteps";
import {
  type StoryMode, type StoryScene, type StoryCharacter, type StoryConfig,
  type ReelStyle, type ReelSituation, type DuoStaging, type ActionLevel,
  buildStoryboardPrompt, buildSceneImagePrompt, buildKlingVideoPrompt, buildStagePlatePrompt, buildBackRefPrompt,
  buildHookCtaPrompt,
  buildSceneAssistPrompt, parseSceneAssist,
  type SceneChatTurn, type SceneAssistResult,
  duoFramePlan, buildDuoFramePrompt,
  KLING_NEGATIVE_PROMPT,
  enforceHardCutVariation, enforceVlogJumpCuts,
  resolveCharacterNames, resolveSceneCast, sceneAnchorPlan, splitDialogLine,
  sceneFinalVideo, scriptSeamReport,
  REEL_STYLES, DUO_STAGINGS, ACTION_LEVELS, VOICE_DELIVERIES, EMPTY_REEL_SITUATION,
  STORY_ART_STYLES, STORY_PACING_OPTIONS, STORY_MOOD_OPTIONS, STORY_COLOR_OPTIONS, STORY_LANGUAGES,
} from "@/lib/storyPrompts";

/**
 * Was vom Storyboard in den localStorage darf — und in welchem Zustand.
 *
 * Zwei Aufgaben:
 * 1. `data:`-URLs rauswerfen. Sie sind reine Session-Werte und mehrere hundert KB
 *    bis MB gross; blieben sie drin, riesse der erste Save die Quota und ab da
 *    wuerde fuer das Projekt GAR NICHTS mehr gespeichert.
 * 2. Laufende Zustaende ehrlich aufloesen. Ein "loading" darf nur ueberleben,
 *    wenn es auch wieder aufloesbar ist — also wenn ein Auftrags-Handle
 *    existiert, an das sich die naechste Sitzung anhaengen kann. Alles andere
 *    wird zum Fehler mit Begruendung, statt stillschweigend zu "idle" zu werden
 *    (dann sah es aus, als haette der Lauf nie stattgefunden).
 */
function sanitizeScenes(list: StoryScene[]): StoryScene[] {
  const durable = (u?: string) => (u && !u.startsWith("data:") ? u : undefined);
  return list.map((s) => {
    const dubbedVideoUrl = durable(s.dubbedVideoUrl);
    // `videoUrl` MUSS mitgefiltert werden — im Google-Fallback (bzw. wenn der
    // Spaces-Upload scheitert) ist es eine mehrere MB grosse data-URL.
    const videoUrl = durable(s.videoUrl);
    // Laeuft der Clip noch UND ist er abholbar? Dann bleibt "loading" stehen.
    // Die Reihenfolge ist wichtig: der Zweig steht VOR `videoUrl ? "done"`,
    // sonst schriebe ein "Video neu" auf einer Szene mit altem Clip weiter
    // "done" — der Startpatch loescht `videoUrl` naemlich nicht.
    const videoResumable = s.videoStatus === "loading" && !!s.videoJobId;
    const videoInterrupted = s.videoStatus === "loading" && !s.videoJobId;
    return {
      ...s,
      videoUrl,
      imageDataUrl: undefined,
      // Genau derselbe Grund wie bei `imageDataUrl`: der Endframe ist eine
      // mehrere hundert KB grosse data-URL.
      endFrameDataUrl: undefined,
      endImageDataUrl: undefined,
      // Der Fortschritt gehoert nicht in den Snapshot: er aendert sich im
      // Sekundentakt und wuerde sonst bei jedem Poll-Tick einen Save ausloesen.
      videoProgressPct: undefined,
      // Bilder laufen als synchroner Aufruf OHNE Handle — ein Reload mittendrin
      // ist endgueltiger Verlust. Das ehrlich als Fehler markieren, statt es als
      // "nie passiert" zu tarnen.
      imageStatus: s.imageUrl ? "done" : (s.imageStatus === "loading" ? "error" : s.imageStatus),
      imageError: s.imageStatus === "loading" && !s.imageUrl
        ? "Beim Neuladen war dieses Bild noch in Arbeit — der Versuch ist verloren."
        : s.imageError,
      endImageStatus: s.endImageUrl ? "done" : (s.endImageStatus === "loading" ? "error" : (s.endImageStatus ?? "idle")),
      endImageError: s.endImageStatus === "loading" && !s.endImageUrl
        ? "Beim Neuladen war dieses Bild noch in Arbeit — der Versuch ist verloren."
        : s.endImageError,
      videoStatus: videoResumable
        ? "loading"
        : videoUrl
          ? "done"
          : videoInterrupted
            ? "error"
            : (s.videoStatus === "error" ? "error" : "idle"),
      // Ohne Handle ist der Lauf nicht abholbar — der Grund gehoert an die Szene,
      // sonst steht dort ein Fehler ohne Text.
      videoError: videoInterrupted && !videoUrl
        ? "Der Lauf wurde durch einen Neustart unterbrochen, bevor der Auftrag bestaetigt war."
        : s.videoError,
      dubbedVideoUrl,
      audioUrl: durable(s.audioUrl),
      // "error" ist terminal und muss den Reload ueberleben: ein noch
      // herumliegender (alter) Dub darf eine gescheiterte Vertonung nicht in ein
      // "done" verwandeln. Beim SPRECHENDEN AVATAR steckt die Stimme im Clip —
      // dort beweist `voiceBakedIn` zusammen mit dem durablen `videoUrl` dasselbe.
      //
      // Ein laufendes "loading" wird zum Fehler — AUSSER auf der Avatar-Strecke:
      // dort entsteht die Spur VOR dem Video und steckt im gerade rendernden
      // Clip. Ein Fehler waere dort schlicht falsch und wuerde ueber die
      // Sticky-Regel oben dauerhaft haengenbleiben.
      audioStatus: s.audioStatus === "error"
        ? "error"
        : dubbedVideoUrl || (s.voiceBakedIn && videoUrl)
          ? "done"
          : s.audioStatus === "loading"
            ? (s.videoJobKind === "avatar" || videoResumable ? "idle" : "error")
            : s.audioStatus === "done" ? "idle" : s.audioStatus,
      voiceError: s.audioStatus === "loading" && s.videoJobKind !== "avatar" && !videoResumable
        ? "Die Vertonung lief noch, als die Seite neu geladen wurde — bitte neu vertonen."
        : s.voiceError,
    };
  });
}

interface StoryboardJson {
  mainLocation?: string;
  /** Nur im Vlog-Pfad: die EINE Situation, die für alle Szenen gilt. */
  situation?: Partial<ReelSituation> | null;
  scenes?: Array<Partial<StoryScene>>;
}

/** Roh-JSON → ReelSituation. Fehlt das Objekt komplett oder sind alle vier
 *  Felder leer, gibt es keine Situation (null) — die Prompt-Builder müssen und
 *  können ohne sie arbeiten. */
function parseSituation(raw: Partial<ReelSituation> | null | undefined): ReelSituation | null {
  if (!raw || typeof raw !== "object") return null;
  const sit: ReelSituation = {
    activity: typeof raw.activity === "string" ? raw.activity.trim() : "",
    setting: typeof raw.setting === "string" ? raw.setting.trim() : "",
    outfit: typeof raw.outfit === "string" ? raw.outfit.trim() : "",
    cameraSetup: typeof raw.cameraSetup === "string" ? raw.cameraSetup.trim() : "",
  };
  const empty = !sit.activity && !sit.setting && !sit.outfit && !sit.cameraSetup;
  return empty ? null : sit;
}

// How many times a scene image is (silently) re-attempted with a varied prompt
// before the error is finally surfaced to the user.
const MAX_IMAGE_ATTEMPTS = 3;

// Obergrenze des Szenen-Sliders. Steht hier statt am Slider, weil die Migration
// weiter unten dieselbe Zahl braucht: ein Altprojekt kann eine gespeicherte
// pointCount über dieser Grenze mitbringen.
const MAX_SCENES = 8;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Die SCHRITTE eines Video-Laufs — Beschriftung, Abschnitt der Fortschrittsleiste
 * und die erwartete Dauer.
 *
 * Warum überhaupt: Vorher stand auf jeder rendernden Karte „Clip wird abgeholt",
 * egal was gerade lief, und die Leiste kam aus einem Tick-Zähler des Polls
 * (`5 + ticks*6`, gedeckelt bei 95). Der sprang nur beim Eintreffen einer
 * Antwort und stand danach still — bei einem langen Render minutenlang auf 95 %.
 *
 * Die Abschnitte schliessen lückenlos aneinander an: jeder Schritt beginnt dort,
 * wo der vorige aufhört. Damit läuft die Leiste über die ganze Kette hinweg nur
 * vorwärts, auch wenn die Schritte unterschiedlich lange dauern. Innerhalb eines
 * Abschnitts kriecht sie zeitgesteuert (siehe SceneBusyBar) und erreicht sein
 * Ende nie — fertig ist erst fertig.
 *
 * Die Zahlen sind Erfahrungswerte, keine Messungen: sie steuern nur das Tempo
 * des Kriechens, nie das Ergebnis.
 */
const VIDEO_PHASES = {
  voice:  { label: "Stimme wird erzeugt…",        from: 0,  to: 14, expectedMs: 20000 },
  upload: { label: "Bild und Ton werden übertragen…", from: 14, to: 24, expectedMs: 15000 },
  queue:  { label: "Auftrag wird gestartet…",     from: 24, to: 30, expectedMs: 8000 },
  render: { label: "Clip wird gerendert…",        from: 30, to: 88, expectedMs: 150000 },
  fetch:  { label: "Clip wird abgeholt…",         from: 88, to: 93, expectedMs: 45000 },
  // Der Schritt, den die Karte bisher verschwiegen hat: der Clip ist beim
  // Anbieter fertig und BEZAHLT, unser Server schneidet ihn noch (Tail-Trim,
  // 9:16). Es gibt dafür genau einen Platz, bei drei parallelen Szenen steht
  // die dritte also legitim minutenlang an. Ohne eigene Phase sah das aus wie
  // „hängt bei 88 %" — und war der Zustand, in dem die alte Zeitgrenze zuschlug.
  post:   { label: "Clip wird nachbearbeitet…",   from: 93, to: 96, expectedMs: 45000 },
  store:  { label: "Clip wird gespeichert…",      from: 96, to: 99, expectedMs: 15000 },
} as const;

/**
 * Die WANDUHR eines ganzen Video-Schritts — die Summe der Phasen oben.
 *
 * Nur die Startschätzung für die Restzeit-Anzeige: sobald der Lauf seinen ersten
 * Clip fertig hat, rechnet `runStatus` mit dem GEMESSENEN Durchsatz weiter. Eine
 * Schätzung, die nie nachjustiert, ist nach zwei Minuten keine Schätzung mehr,
 * sondern eine Behauptung — und genau davon hatte die Seite schon genug.
 */
const VIDEO_EXPECTED_MS = Object.values(VIDEO_PHASES).reduce((sum, p) => sum + p.expectedMs, 0);

/**
 * Was der SERVER über `phase` meldet, übersetzt in die Anzeige-Phasen oben.
 *
 * Bis hierher wusste die Karte gar nicht, wo ein laufender Auftrag steht: sie
 * schrieb ab dem ersten Tick pauschal „Clip wird gerendert…" und blieb dabei,
 * auch wenn der Auftrag noch in der fal-Schlange stand oder längst fertig war
 * und nur die Nachbearbeitung lief. `deliver` heißt „bei fal fertig, Abruf
 * klemmt" — genau das, was die Karte seit jeher „Clip wird abgeholt" nennt.
 */
const SERVER_PHASE_TO_VIDEO_PHASE = {
  queue: "queue",
  render: "render",
  deliver: "fetch",
  post: "post",
} as const;

/** Dasselbe für ein Szenenbild — inklusive der stillen Retry-Kaskade, die ein
 *  gefiltertes Bild bis zu MAX_IMAGE_ATTEMPTS mal neu versucht. */
const IMAGE_EXPECTED_MS = 30000;

/**
 * Restzeit in Worten. Bewusst GROB gerundet: „noch ca. 6 Min." ist eine
 * ehrliche Schätzung, „noch 5:47" behauptet eine Genauigkeit, die keine
 * Modell-Warteschlange dieser Welt einhält.
 */
const fmtEta = (ms: number): string => {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 45) return "unter 1 Min.";
  const min = Math.round(sec / 60);
  return `ca. ${Math.max(1, min)} Min.`;
};

/** Verstrichene Laufzeit — „läuft seit 3:05". */
const fmtElapsed = (ms: number): string => {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
};

/**
 * Namen vergleichbar machen: Groß-/Kleinschreibung und Unicode-Normalform raus.
 * „Anna" aus dem Modell und „anna" aus dem Eingabefeld sind dieselbe Person, und
 * ein zusammengesetztes „ä" (NFD) darf nicht an einem vorkomponierten scheitern.
 */
const nameKey = (s: string) => s.trim().normalize("NFC").toLowerCase();

function newScene(raw: Partial<StoryScene>, idx: number, knownNames: string[] = []): StoryScene {
  // Der Sprecher wird gegen die BEKANNTEN Namen validiert — dasselbe Muster wie
  // bei `voiceDelivery` darunter. Ein erfundener oder vertippter Name bliebe
  // sonst als Zeichenkette an der Szene hängen, und jede spätere Auflösung
  // (Bild-Prompt, Stimme) liefe ins Leere, ohne dass irgendwo etwas auffällt.
  // Zurückgeschrieben wird die KANONISCHE Schreibweise des Nutzers, nicht die
  // des Modells.
  const speakerRaw = String(raw.speaker || "").trim();
  const speaker = speakerRaw
    ? knownNames.find((n) => nameKey(n) === nameKey(speakerRaw)) ?? ""
    : "";

  return {
    id: uid(),
    summary: raw.summary || `Szene ${idx + 1}`,
    detailedDescription: raw.detailedDescription || "",
    participants: raw.participants || "",
    specificArea: raw.specificArea || "",
    keyAction: raw.keyAction || "",
    emotion: raw.emotion || "",
    dialogText: raw.dialogText || "",
    // Die Aussprache-Fassung zählt nur, wenn sie sich vom Sprechtext
    // unterscheidet. Liefert das Modell sie identisch zurück (der Regelfall bei
    // Zeilen ganz ohne englische Namen), wäre ein gespeicherter Wert nur eine
    // zweite Wahrheit, die bei jeder späteren Textänderung veraltet.
    dialogSpeech: (() => {
      const s = String(raw.dialogSpeech || "").trim();
      return s && s !== String(raw.dialogText || "").trim() ? s : undefined;
    })(),
    speaker,
    // Nur echte Enum-Werte übernehmen — erfindet das Modell ein eigenes Delivery,
    // bliebe es sonst als unbekannter String an der Szene hängen und würde in der
    // UI als „kein Delivery" gelesen, obwohl etwas drinsteht.
    voiceDelivery: VOICE_DELIVERIES.some((d) => d.value === raw.voiceDelivery)
      ? raw.voiceDelivery
      : undefined,
    cameraAngle: raw.cameraAngle || "eye-level",
    shotType: raw.shotType || "medium-shot",
    composition: raw.composition || "drittel-regel",
    movement: raw.movement || "keine",
    audienceEffect: raw.audienceEffect || "spannung",
    continuityNotes: raw.continuityNotes || "",
    endState: raw.endState || "",
    // Nur die beiden echten Werte übernehmen. Default ist bewusst "cut": ein
    // fälschlich fließender Übergang verklebt zwei Szenen sichtbar, ein
    // fälschlich harter Schnitt ist bloß ein normaler Schnitt. Im Reel steht das
    // Feld gar nicht erst im Schema — dort greift dieser Default für alle Szenen.
    transitionToNext: raw.transitionToNext === "flow" ? "flow" : "cut",
    imageStatus: "idle",
  };
}

/**
 * Für welche Projekt/Modus-Kombination wurden die Ideen-Vorschläge in dieser
 * Sitzung schon automatisch geholt? Absichtlich auf Modul-Ebene: überlebt einen
 * Seitenwechsel innerhalb der App (kein doppelter bezahlter Lauf), aber nicht
 * das Neuladen der Seite — nach jedem Refresh kommen frische Ideen.
 */
const autoIdeasDone = new Set<string>();

export default function StoryPage() {
  const { genChain, hasGenKey, missingKeyMessage, videoApi, falKey, elevenKey, googleKey } = useSettings();
  const { plan, credentials } = useAuth();
  const { current: currentProject } = useProjects();
  const projectId = currentProject?.id ?? null;

  // Uploaded character references + their typed meta persist per project.
  const [refs, setRefs] = useProjectRefImages("story:refs");
  const [projectProfile] = useProjectProfile();
  const [characterNames, setCharacterNames] = useProjectValue<string[]>("story:characterNames", []);
  const [characterGenders, setCharacterGenders] = useProjectValue<Array<"male" | "female" | "neutral">>("story:characterGenders", []);
  const [characterDescriptions, setCharacterDescriptions] = useProjectValue<string[]>("story:characterDescriptions", []);
  /**
   * Was jede Person im Reel TRÄGT — die Wahl des Nutzers, getrennt vom
   * Referenzfoto.
   *
   * Vorher gab es dafür kein Feld, und der Prompt las die Kleidung aus dem
   * Porträt. Damit trug eine Figur im Home-Office-Reel den Bademantel aus ihrem
   * Urlaubsbild, und dagegen half nichts (Nutzerentscheid 2026-08-10: „das ist
   * ja nur das Portraitbild und das muss egal sein, was sie anhat").
   * Leer = keine Vorgabe; dann wählt das Bildmodell etwas zum Ort Passendes.
   */
  const [characterOutfits, setCharacterOutfits] = useProjectValue<string[]>("story:characterOutfits", []);

  /** Welche Charakterkarte gerade von der KI ausgelesen wird (Index) — für den Spinner. */
  const [readingCharacter, setReadingCharacter] = useState<number | null>(null);

  /**
   * Aussehen und Kleidung einer Charakterkarte von der KI ausfüllen lassen.
   *
   * DAS AUSSEHEN kommt aus dem FOTO — dafür ist es da, und nur ein Modell, das
   * das Bild wirklich sieht, kann es beschreiben (`images` in generateText).
   *
   * DIE KLEIDUNG NICHT. Das Foto ist ein Porträt; was die Person darauf trägt,
   * ist Zufall der Aufnahme (Nutzerentscheid 2026-08-10: Bademantel aus dem
   * Urlaubsbild). Der Vorschlag richtet sich deshalb nach dem PROJEKT — Idee und
   * Hauptort — und ignoriert das Kleidungsstück im Bild ausdrücklich.
   *
   * Beides landet direkt in den Feldern und ist danach frei überschreibbar; es
   * ist ein Startpunkt, keine Festlegung.
   */
  const readCharacterFromPhoto = async (i: number) => {
    const ref = refs[i];
    if (!ref) return;
    if (!hasGenKey) {
      toast.error(missingKeyMessage ?? "Bitte hinterlege zuerst deine API-Keys.");
      return;
    }
    if (readingCharacter !== null) return;
    setReadingCharacter(i);
    try {
      const name = characterNames[i]?.trim();
      const raw = await generateText(genChain, {
        json: true,
        temperature: 0.4,
        images: [{ mimeType: ref.mimeType, base64: ref.base64 }],
        prompt: [
          `Sieh dir die Person auf dem Bild an${name ? ` (sie heißt ${name})` : ""} und fülle zwei Felder für ein Video-Storyboard.`,
          "",
          '"aussehen": wie die Person AUSSIEHT — ungefähres Alter, Haare (Farbe, Länge, Frisur oder Glatze), Bart, Brille, Statur, markante Merkmale.',
          "  Höchstens 12 Wörter, Stichworte mit Komma getrennt, auf Deutsch. KEINE Kleidung, KEIN Hintergrund, keine Stimmung, keine Bewertung.",
          "",
          '"kleidung": ein Vorschlag, was die Person in DIESEM Projekt tragen soll.',
          "  WICHTIG: Das Bild ist ein Porträt — was die Person darauf anhat, ist unerheblich und darf NICHT übernommen werden.",
          `  Wähle etwas Alltägliches, das zum Projekt passt${mainLocation.trim() ? ` (Ort: ${mainLocation.trim()})` : ""}${idea.trim() ? ` (Thema: ${idea.trim().slice(0, 200)})` : ""}.`,
          "  Höchstens 6 Wörter, auf Deutsch, ohne Marken und ohne Aufdrucke.",
          "",
          'Antworte NUR mit JSON: {"aussehen": "...", "kleidung": "..."}',
        ].join("\n"),
      });
      const parsed = extractJson<{ aussehen?: string; kleidung?: string }>(raw);
      const aussehen = String(parsed?.aussehen || "").trim();
      const kleidung = String(parsed?.kleidung || "").trim();
      if (!aussehen && !kleidung) throw new Error("Die Antwort enthielt keine verwertbaren Felder.");
      const put = (arr: string[], value: string) => {
        const next = [...arr];
        while (next.length <= i) next.push("");
        next[i] = value;
        return next;
      };
      if (aussehen) setCharacterDescriptions((arr) => put(arr, aussehen));
      if (kleidung) setCharacterOutfits((arr) => put(arr, kleidung));
      toast.success(`Charakter ${i + 1} ausgefüllt.`, {
        description: "Aussehen aus dem Foto, Kleidung passend zum Projekt — beides frei änderbar.",
      });
    } catch (e: any) {
      toast.error(e?.message || "Das Bild konnte nicht ausgelesen werden.", { description: e?.hint });
    } finally {
      setReadingCharacter(null);
    }
  };

  const [mode, setMode] = useProjectValue<StoryMode>("story:mode", "reel");
  const [idea, setIdea] = useProjectValue("story:idea", "");

  // Idea-suggestion bullets (Projekt-style). Diese drei stehen nur da, bis der
  // erste Lauf zurück ist (bzw. dauerhaft, wenn kein API-Key hinterlegt ist) —
  // siehe den Auto-Lauf weiter unten, der beim Seitenaufbau profilpassende
  // Ideen holt.
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

  /**
   * Altprojekte auf „reel" ziehen.
   *
   * `story:mode` liegt pro Projekt in localStorage, aber es gibt seit dem
   * Reel-Umbau keinen Umschalter mehr: `setMode` wird sonst nirgends gerufen,
   * der Default ist „reel", und alles darunter — Prompting, harte Schnitte,
   * Lipsync-Zwang, Continuity — ist darauf ausgelegt. Ein Projekt, in dem noch
   * ein gespeichertes „general" steckt, lief deshalb still in der alten
   * Story-Pipeline weiter, und der Szenen-Slider ging dort bis 12 statt 8. Von
   * aussen sah das nach unterschiedlichen Accounts aus, obwohl es derselbe
   * Build war.
   *
   * Beide Werte werden gezogen, nicht nur der Modus: eine gespeicherte
   * pointCount von 12 überlebt die Umstellung sonst unsichtbar. Der Slider
   * würde nur bis 8 zeigen, generiert würden weiter 12 Szenen.
   *
   * Der Effekt bleibt stehen (kein Einmal-Lauf): ein Storyboard-Slot
   * schnappschusst alle `story:*`-Werte und schreibt sie beim Laden zurück,
   * kann also ein altes „general" erneut einspielen.
   */
  useEffect(() => {
    if (mode !== "reel") setMode("reel");
  }, [mode, setMode]);
  useEffect(() => {
    if (pointCount > MAX_SCENES) setPointCount(MAX_SCENES);
  }, [pointCount, setPointCount]);

  const [aspect, setAspect] = useProjectValue<string>("story:aspect", "9:16");
  const [voiceMode, setVoiceMode] = useProjectValue<"sprecher" | "dialog">("story:voiceMode", "sprecher");
  const [dialogMode, setDialogMode] = useProjectValue<"smart" | "forced">("story:dialogMode", "smart");
  const [generationDirection, setGenerationDirection] = useProjectValue<"speaker-from-description" | "description-from-speaker">("story:generationDirection", "speaker-from-description");
  const [enableSpeaker, setEnableSpeaker] = useProjectValue("story:enableSpeaker", true);
  const [enableSceneDescription, setEnableSceneDescription] = useProjectValue("story:enableSceneDescription", true);
  // Continuity Mode: the last frame of scene N's video becomes the start frame
  // of scene N+1, so cuts visually flow into each other. Default OFF und im
  // Reel-Modus gar nicht verfügbar: Erklär-/Erzähl-Reels werden IMMER mit
  // bewusst sichtbaren harten Schnitten montiert.
  const [continuityMode, setContinuityMode] = useProjectValue("story:continuityMode", false);
  // ── Zustandsanschluss (Vlog-Reel) ─────────────────────────────────────────
  // Der letzte Frame von Clip N wird KONTINUITÄTS-REFERENZ für das BILD von
  // Szene N+1 — nicht dessen Startframe. Unterschied zum Seamless-Modus: dort
  // IST der Frame das Startbild, erster Frame von N+1 == letzter Frame von N,
  // und damit gibt es überhaupt keinen Schnitt mehr. Hier rendert das
  // Bildmodell den Zustand neu, in Stil und Auflösung des Standbilds und aus
  // dem Kamerawinkel dieser Szene — Haltung/Position/Requisiten laufen durch,
  // der Blickwinkel wechselt trotzdem.
  //
  // Preis: Bild- und Videolauf müssen verschränkt laufen, weil Bild N+1 erst
  // nach dem FERTIGEN Clip N entstehen kann (siehe `advanceReel`).
  const [stateCarryOver, setStateCarryOver] = useProjectValue("story:stateCarryOver", true);
  const [speakerGender, setSpeakerGender] = useProjectValue<"male" | "female" | "neutral">("story:speakerGender", "neutral");
  const [artStyle, setArtStyle] = useProjectValue("story:artStyle", "cinematic");
  const [pacing, setPacing] = useProjectValue("story:pacing", "instant-action");
  const [videoMood, setVideoMood] = useProjectValue("story:videoMood", "dramatic");
  const [colorMood, setColorMood] = useProjectValue("story:colorMood", "natural");
  const [hook, setHook] = useProjectValue("story:hook", "");
  const [language, setLanguage] = useProjectValue("story:language", "de");
  const [customDetails, setCustomDetails] = useProjectValue("story:customDetails", "");
  // Optionaler Call-to-Action der letzten Szene. Leer = wie bisher (Payoff/Fazit).
  const [cta, setCta] = useProjectValue("story:cta", "");
  // `showAdvanced` ist entfallen: EIN globaler Schalter klappte die
  // Feineinstellungen der halben Seite gleichzeitig auf und war nicht
  // persistiert. Jeder Schritt hat jetzt seinen eigenen Ausklapper, gespeichert
  // pro Projekt (`story:ui:adv1`…`adv6`, siehe StepCard).

  // ── Reel-Stil ───────────────────────────────────────────────────────────────
  // Exakt dasselbe Default-Muster wie beim Voice-Lock unten: `null` = für dieses
  // Projekt noch nie entschieden. Altprojekte (haben schon ein gespeichertes
  // Storyboard) bleiben auf "explainer", damit ihr bisheriges Reel-Verhalten
  // nicht hinter dem Rücken des Nutzers kippt; neue Projekte starten auf "vlog".
  // Der Default wird beim Projekt-Load EINMAL bestimmt und dort sofort
  // durchgeschrieben — sonst ergäbe derselbe Ausdruck beim nächsten Load
  // (Storyboard existiert jetzt) das Gegenteil.
  const [reelStyleRaw, setReelStyle] = useProjectValue<ReelStyle | null>("story:reelStyle", null);
  const [reelStyleDefault, setReelStyleDefault] = useState<ReelStyle>("vlog");
  const reelStyle: ReelStyle = reelStyleRaw ?? reelStyleDefault;
  // Darf die LETZTE Szene hart in einen anderen Kontext schneiden? Rein additiv,
  // deshalb für alle Projekte an (wirkt nur im Vlog-Stil ab 3 Szenen).
  const [reelOutro, setReelOutro] = useProjectValue("story:reelOutro", true);
  // Zwei Personen in einer Sprech-Szene: reden sie zum Zuschauer oder
  // miteinander? Default „camera" — die Direktansprache ist die Form, die ein
  // Reel trägt; ein belauschtes Gespräch ist die bewusste Ausnahme.
  const [duoStaging, setDuoStaging] = useProjectValue<DuoStaging>("story:duoStaging", "camera");
  // Wie viel machen die Personen mit den Händen, während sie reden? Default
  // „calm" — und zwar für ALLE Projekte, nicht nur für alte: Der gesamte
  // bisherige Code (Gesten-Regeln, Bild-Prompt, Duo-Clip) war hart auf Ruhe
  // verdrahtet. „calm" IST also das Ist-Verhalten, und deshalb braucht es hier
  // auch keine null-Sentinel-Unterscheidung wie beim Reel-Stil oben.
  // Der gespeicherte Wert wird bewusst normalisiert statt roh benutzt:
  // `useProjectValue` validiert nicht, und ein Storyboard-Slot kann jederzeit
  // einen Fremdwert zurückschreiben. Ohne diese Zeile stünde er unverändert im
  // State — alle Ternäre fielen still auf „calm", aber in der UI wäre KEINE der
  // beiden Kacheln markiert, und der Schalter sähe aus wie kaputt.
  const [actionLevelRaw, setActionLevel] = useProjectValue<ActionLevel>("story:actionLevel", "calm");
  const actionLevel: ActionLevel = actionLevelRaw === "active" ? "active" : "calm";
  // Die vom Storyboard-Modell festgelegte Situation des Vlog-Reels. Steckt in
  // JEDEM Szenen-Prompt — deshalb sichtbar und editierbar (siehe Panel unten).
  const [reelSituation, setReelSituation] = useProjectValue<ReelSituation | null>("story:reelSituation", null);

  // ── Voice-Lock ──────────────────────────────────────────────────────────────
  // Keine Wahl mehr: die feste Stimme ist IMMER an. Der frühere Schalter konnte
  // nur schaden — ausgeschaltet würfelte das Videomodell die Stimme pro Clip neu,
  // und die getroffene Stimmenauswahl blieb wirkungslos.
  // Die einzige Ausnahme bleibt technisch bedingt: ohne Sprach-Key gibt es keine
  // TTS-Spur. Der Clip darf dann auch NICHT stumm geprompted werden, sonst bleibt
  // das fertige Reel komplett tonlos.
  const voiceLock = !!falKey || !!elevenKey;
  // Leer = noch nicht explizit gewählt → folgt weiter dem Sprecher-Geschlecht.
  const [voiceNameRaw, setVoiceName] = useProjectValue("story:voiceName", "");
  // Mit eigenem ElevenLabs-Key ist `voice` eine voice_id, ohne ihn ein
  // Premade-NAME. Der gespeicherte Wert überlebt das Hinterlegen eines Keys und
  // wäre danach im falschen Format — `resolveVoiceValue` fängt genau das ab.
  const { voices: elevenVoices } = useElevenVoices(elevenKey);
  // Nur diese IDs duerfen den ElevenLabs-Direktweg ausloesen — siehe
  // `renderSceneVoice`. Ein Premade-NAME muss ueber fal laufen.
  const elevenVoiceIds = useMemo(() => elevenVoices.map((v) => v.voiceId), [elevenVoices]);
  const voiceName = resolveVoiceValue(voiceNameRaw, elevenVoices, speakerGender, !!elevenKey);
  const [voiceStability, setVoiceStability] = useProjectValue("story:voiceStability", 0.5);
  const [voiceSpeed, setVoiceSpeed] = useProjectValue("story:voiceSpeed", 1);
  // TTS-Modell — FEST auf multilingual-v2, keine Auswahl mehr. Es ist das
  // einzige Modell mit `speed`/`style` (Sprechtempo-Regler) und das einzige, das
  // der eigene ElevenLabs-Weg fährt (`eleven_multilingual_v2` im Server). Ein
  // umschaltbares v3 hätte den Tempo-Regler tot gestellt und je nach Key-Lage
  // etwas anderes gemeint. Bewusst eine Konstante statt `useProjectValue`:
  // damit gilt es auch für Altprojekte, in denen "eleven-v3" gespeichert ist.
  const voiceModel = "multilingual-v2" as const;
  const [characterVoices, setCharacterVoices] = useProjectValue<Record<string, string>>("story:characterVoices", {});

  const [mainLocation, setMainLocation] = useProjectValue("story:mainLocation", "");
  /**
   * Die beiden menschenleeren BÜHNEN-AUFNAHMEN: derselbe Raum aus den beiden
   * Richtungen des Gesprächs. Sie ersetzen das vorherige Szenenbild als
   * Anschluss-Referenz, sobald zwei Personen im Reel sind — ein Bild mit einer
   * Person darin schleppt immer deren Gesicht und deren Anordnung mit, und
   * genau daran vermischten sich die Charaktere.
   * Durable URLs, damit sie den Reload überleben.
   */
  const [stagePlates, setStagePlates] = useProjectValue<{ a?: string; b?: string }>("story:stagePlates", {});
  const [platesRunning, setPlatesRunning] = useState(false);
  // Ref-Spiegel der Platten: der Volllauf erzeugt sie und rendert DANACH sofort
  // die Szenenbilder — aus derselben Closure. Der State ist dort noch der alte,
  // und die frisch bezahlten Platten blieben ungenutzt liegen.
  const stagePlatesRef = useRef(stagePlates);
  useEffect(() => { stagePlatesRef.current = stagePlates; }, [stagePlates]);
  /**
   * RÜCKEN-REFERENZEN, eine pro Charakter (Schlüssel: Name in Normalform).
   * Aus dem Charakterfoto erzeugt: dieselbe Person von hinten — Haare, Statur,
   * Kleidung, kein Gesicht. Sie geht für die abgewandte Person als Bild in den
   * Szenen-Request; die reine Wortbeschreibung hatte Haarfarbe und Outfit dem
   * Zufall überlassen. Ref-Spiegel aus demselben Grund wie bei den Platten.
   */
  const [backRefs, setBackRefs] = useProjectValue<Record<string, string>>("story:backRefs", {});
  const backRefsRef = useRef(backRefs);
  useEffect(() => { backRefsRef.current = backRefs; }, [backRefs]);

  // Vorschläge für Hook + Custom Details in EINEM Lauf — beide beschreiben
  // dieselbe Story, getrennte Anfragen wüssten nichts voneinander.
  //
  // `auto` hängt am Ausklapp-Zustand desselben Schritts (derselbe Schlüssel wie
  // in StepCard): der Hook läuft im Seiten-Body und würde sonst schon beim
  // Öffnen der Seite einen Call für Felder auslösen, die niemand sieht.
  const [adv3Open] = useProjectValue<boolean>("story:ui:adv3", false);
  const briefSuggest = useFieldSuggestions(
    // Der Aktions-Level MUSS in den Cache-Schlüssel: `useFieldSuggestions` lädt
    // genau bei dessen Wechsel neu. Ohne ihn stünden nach dem Umschalten weiter
    // die drei lauten Vorschläge unter einem Feld, das inzwischen ruhig gemeint
    // ist — und das ist die sichtbarste Ton-Quelle der ganzen Seite.
    `story:brief:${mode}:${actionLevel}`,
    [
      {
        key: "hook",
        what: mode === "reel"
          ? (actionLevel === "active"
              ? "der gesprochene Hook-Satz, mit dem das Reel startet — eine steile Behauptung, die in die Kamera gerufen wird und das Scrollen sofort stoppt (Stil: „Albert Einstein hat gelogen.“); kein Gruß, keine Ankündigung"
              : "der gesprochene erste Satz des Reels — eine ruhige, konkrete Feststellung, wie man sie einem Bekannten gegenüber macht (Stil: „Die meisten Schulterschmerzen kommen nicht vom Training.“); kein Gruß, keine Ankündigung, KEINE Großbuchstaben, kein Ausrufezeichen, kein Vorwurf")
          : "der Eröffnungs-Beat des Videos",
        shape: actionLevel === "active"
          ? "EIN kurzer, steiler Satz, höchstens 12 Wörter"
          : "EIN kurzer, ruhig gesprochener Satz, höchstens 12 Wörter",
        current: hook,
      },
      {
        key: "customDetails",
        what: "Custom Details für die KI — Branche, Zielgruppe, Besonderheiten, Tabu-Themen",
        shape: "1–2 Sätze",
        current: customDetails,
      },
      {
        key: "cta",
        what: "der Call-to-Action, den die letzte Szene ausspricht — genau EINE Handlung, die direkt in der App möglich ist (kommentieren, speichern, folgen, teilen)",
        shape: actionLevel === "active"
          ? "EIN kurzer, gesprochener Satz — keine Werbefloskel"
          : "EIN kurzer, beiläufig gesprochener Satz — keine Werbefloskel, kein Ausrufezeichen",
        current: cta,
      },
    ],
    {
      auto: adv3Open,
      context: mode === "reel"
        ? (actionLevel === "active"
            ? "Erklär-/Erzähl-Reel: Das Gesprochene trägt, die Inszenierung bleibt alltäglich — aber der Vortrag ist energiegeladen und die Emotion im Gesicht deutlich sichtbar. Harte Schnitte, hohes Tempo."
            : "Erklär-/Erzähl-Reel im RUHIGEN Modus: Das Gesprochene trägt, und es klingt wie eine normale Unterhaltung — konkret und zugewandt, aber nie gerufen, nie anklagend, nie werbend. Keine Wörter in Großbuchstaben, keine Ausrufezeichen.")
        : "Storyboard mit Handlung über mehrere Szenen.",
    },
  );

  const [scenes, setScenes] = useState<StoryScene[]>([]);
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatingVideos, setGeneratingVideos] = useState(false);

  // ══ GESAMTFORTSCHRITT EINES LAUFS ══════════════════════════════════════════
  //
  // WAS läuft, seit wann, und wie viel war davor schon fertig?
  //
  // Der Fortschritt selbst wird hier bewusst NICHT mitgezählt — er steht bereits
  // in den Szenen (`imageStatus`/`videoStatus`). Ein zweiter Zähler daneben wäre
  // die erste Stelle, die nach einem Einzelklick, einem Abbruch oder einem
  // Reload auseinanderliefe. Gespeichert wird nur, was sich aus den Szenen NICHT
  // ablesen lässt: der Startzeitpunkt (für die Restzeit) und der Stand bei
  // Beginn — damit der Durchsatz allein über die Stücke rechnet, die DIESER Lauf
  // erzeugt hat, und nicht über die zwanzig, die schon vorher dastanden.
  type RunPhaseKind = "storyboard" | "images" | "videos" | "merge";
  const [runPhase, setRunPhase] = useState<{ kind: RunPhaseKind; startedAt: number; baseDone: number } | null>(null);
  /** Sekundentakt, damit die Restzeit runterläuft, statt beim letzten Render zu
   *  kleben. Läuft nur, solange überhaupt etwas läuft. */
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!runPhase) return;
    setNowMs(Date.now());
    const h = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(h);
  }, [runPhase]);

  const beginRunPhase = (kind: RunPhaseKind, baseDone: number) =>
    setRunPhase({ kind, startedAt: Date.now(), baseDone });
  /** Nur die EIGENE Etappe beenden: im Durchlauf hat die nächste unter Umständen
   *  schon übernommen, und die dürfte ein spätes `finally` nicht wegräumen. */
  const endRunPhase = (kind: RunPhaseKind) =>
    setRunPhase((p) => (p && p.kind === kind ? null : p));

  /** Läuft gerade der verkettete Durchlauf („Reel komplett erstellen")? */
  const autoRunRef = useRef(false);
  const [autoRunning, setAutoRunning] = useState(false);

  // ── Das fertige, zusammengeschnittene Reel ─────────────────────────────────
  //
  // Es lebte bisher ausschliesslich im lokalen State des Mergers: ein Reload,
  // ein Seitenwechsel oder ein versehentliches Zuklappen — und das Ergebnis von
  // zwanzig Minuten bezahlter Renderzeit war weg, ohne dass irgendwo gestanden
  // hätte, dass man es SOFORT herunterladen muss.
  //
  // Gespeichert wird nur die Bucket-URL, nie die data-URL: ein fertiges Reel
  // sind schnell zweistellige Megabyte, und der localStorage ist auf dieser
  // Seite ohnehin schon das Nadelöhr (siehe die Quota-Warnung beim Sichern der
  // Szenen). Die Signatur daneben beantwortet „gehört dieses Reel überhaupt noch
  // zur aktuellen Clipliste?" — ohne sie zeigte die Seite nach jeder Änderung
  // weiter „Fertig · Dein Reel ist bereit" über einem veralteten Video.
  const [mergedReelUrl, setMergedReelUrl] = useProjectValue<string>("story:mergedUrl", "");
  const [mergedReelSig, setMergedReelSig] = useProjectValue<string>("story:mergedSig", "");
  /** Zählt hoch, wenn der Durchlauf den Zusammenschnitt selbst auslösen soll. */
  const [autoMergeToken, setAutoMergeToken] = useState(0);
  // Cooperative cancellation. The actual fetch can't be aborted (the AI lib has
  // no AbortSignal yet), but batch loops check this between scenes and the UI
  // flips the primary button to "Abbrechen" while anything is running.
  const abortRef = useRef(false);

  // ══ SCHUTZ GEGEN DOPPEL- UND KONFLIKT-KLICKS ═══════════════════════════════
  //
  // WARUM REFS UND NICHT STATE: `setGeneratingImages(true)` wird erst beim
  // nächsten Render sichtbar. Zwischen zwei schnellen Klicks liegt oft kein
  // Render — beide Klicks sehen `false` und starten je einen bezahlten Lauf.
  // Ein Ref ist sofort gesetzt und schließt dieses Fenster.
  //
  // ZWEI EBENEN, bewusst getrennt:
  // • `busyScenesRef` — welche SZENEN gerade arbeiten. Verhindert, dass
  //   dieselbe Szene doppelt läuft und dass „Bild neu" einen gerade rendernden
  //   (bezahlten!) Clip derselben Szene entwertet.
  // • `batchRef` — läuft ein globaler Durchgang? Verhindert, dass ein zweiter
  //   Batch oder ein Einzelklick in einen laufenden Batch hineinfunkt.
  //
  // Die UI-`disabled`-Zustände weiter unten sind NUR Feedback. Die eigentliche
  // Sicherheit sitzt hier, damit sie für jeden Pfad gilt — Karte, Overlay,
  // Detaildialog, Toolbar — auch für Pfade, die später dazukommen.
  const busyScenesRef = useRef<Set<string>>(new Set());
  const batchRef = useRef<null | { kind: "storyboard" | "images" | "videos"; token: number }>(null);
  // Jede Reservierung bekommt eine eigene Nummer. „Alles verwerfen" räumt die
  // laufende weg — der abgeräumte Lauf kommt aber irgendwann trotzdem aus seinem
  // `await` zurück und ruft sein `releaseBatch`. Ohne die Nummer gäbe er dann
  // die Reservierung eines längst NEU gestarteten Laufs frei, und zwei bezahlte
  // Durchgänge liefen nebeneinander über dieselben Szenen.
  const batchTokenRef = useRef(0);
  /**
   * Zählt harte Stopps („Alles verwerfen"). Ein Batch, der zwischendurch
   * abgeräumt wurde, hängt oft noch in einem `await`. Käme er zurück, während
   * schon ein NEUES Storyboard läuft, fände er `abortRef` frisch auf `false` und
   * würde für Szenen der alten Liste weiter bezahlte Jobs starten. Die Nummer
   * beantwortet „gehört dieser Lauf noch zur aktuellen Runde?" — anders als
   * `abortRef`, das jeder neue Lauf zurücksetzen muss.
   */
  const runEpochRef = useRef(0);
  // Nur damit React neu rendert, wenn sich die Belegung ändert — gelesen wird
  // immer aus den Refs.
  const [busyTick, setBusyTick] = useState(0);

  /** Szene für eine Aktion reservieren. `false` = sie arbeitet schon. */
  const claimScene = (id: string): boolean => {
    if (busyScenesRef.current.has(id)) return false;
    busyScenesRef.current.add(id);
    setBusyTick((n) => n + 1);
    return true;
  };
  const releaseScene = (id: string) => {
    busyScenesRef.current.delete(id);
    setBusyTick((n) => n + 1);
  };
  const isSceneBusy = (id: string) => busyScenesRef.current.has(id);

  /**
   * Läuft IRGENDWO auf der Seite gerade eine Generierung? Liefert den Grund als
   * Text, sonst `null`.
   *
   * Es darf immer nur EINE laufen. Vorher galt das nur je Ebene: ein Batch
   * schloss den nächsten Batch aus, eine Szene sich selbst — aber ein Einzelklick
   * auf Szene 3 lief problemlos neben dem Batch, und ein Batch startete über eine
   * laufende Einzelszene hinweg. Beide schreiben dann auf denselben Szenenstand,
   * und wer zuletzt zurückkommt, gewinnt — inklusive bereits bezahlter Clips, die
   * dabei still verworfen werden.
   */
  const generationBlocked = (): string | null => {
    if (batchRef.current) return "Es läuft schon ein Durchgang — warte, bis er fertig ist, oder brich ihn ab.";
    if (busyScenesRef.current.size > 0) return "An einer Szene wird gerade gearbeitet — es läuft immer nur eine Generierung.";
    return null;
  };

  /**
   * Globalen Lauf reservieren. `null` = es läuft schon einer.
   *
   * Der zurückgegebene Token gehört in das zugehörige `releaseBatch(token)` —
   * nur so kann ein Lauf, den „Alles verwerfen" zwischendurch abgeräumt hat,
   * beim Zurückkommen keinen fremden Lauf mehr freigeben.
   */
  const claimBatch = (kind: "storyboard" | "images" | "videos"): number | null => {
    if (generationBlocked()) return null;
    const token = ++batchTokenRef.current;
    batchRef.current = { kind, token };
    setBusyTick((n) => n + 1);
    return token;
  };
  const releaseBatch = (token: number) => {
    // Fremder/abgeräumter Lauf → nichts anfassen.
    if (batchRef.current?.token !== token) return;
    batchRef.current = null;
    setBusyTick((n) => n + 1);
  };

  /**
   * Arbeitet an dieser Szene gerade etwas — laut Ref ODER laut gespeichertem
   * Status? Der Status-Teil fängt Läufe ab, die ein Reload überdauert haben
   * (z. B. „loading" aus einer abgebrochenen Sitzung).
   */
  const sceneIsWorking = (s: StoryScene) =>
    isSceneBusy(s.id) ||
    s.imageStatus === "loading" ||
    s.endImageStatus === "loading" ||
    s.videoStatus === "loading" ||
    s.audioStatus === "loading";

  /** Läuft irgendeine Generierung — Durchgang ODER Einzelszene? Für `disabled`
   *  in der UI; die eigentliche Sperre sitzt in `generationBlocked`. */
  const anyBatchRunning = batchRef.current !== null || busyScenesRef.current.size > 0;

  /** 1-basierte Szenennummer für Meldungen. Über `scenesRef`, weil Meldungen
   *  auch aus Läufen kommen, deren Closure den State noch leer gesehen hat. */
  const sceneNumber = (id: string) => scenesRef.current.findIndex((x) => x.id === id) + 1;
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);

  const characters: StoryCharacter[] = useMemo(() =>
    refs.map((r, i) => ({
      id: `char_${i}`,
      name: characterNames[i]?.trim() || `Person ${i + 1}`,
      description: characterDescriptions[i] || "",
      outfit: characterOutfits[i] || "",
      gender: characterGenders[i] || "neutral",
      mimeType: r.mimeType,
      base64: r.base64,
    })),
  [refs, characterNames, characterGenders, characterDescriptions, characterOutfits]);

  // Dieselbe Umschlüsselung wie bei `voiceName`, nur für die Dialog-Stimmen:
  // ohne sie spräche im Dialog-Modus jede Figur mit einem Namen, den ElevenLabs
  // gar nicht auflösen kann.
  const resolvedCharacterVoices = useMemo(() => {
    if (elevenVoices.length === 0) return characterVoices;
    const out: Record<string, string> = { ...characterVoices };
    for (const c of characters) {
      // NUR gesetzte Werte umschluesseln. Lief die Schleife ueber alle Figuren,
      // bekam auch jede NICHT zugeordnete Figur einen Eintrag (resolveVoiceValue
      // liefert bei leerem Wert die erste Kontostimme) — `voiceForScene` fand
      // dann immer einen Treffer und kam nie mehr auf die im Picker gewaehlte
      // Projektstimme zurueck. Genau der Fehler, den der Kommentar unten als
      // behoben beschreibt.
      const stored = characterVoices[c.name];
      if (!stored) continue;
      out[c.name] = resolveVoiceValue(stored, elevenVoices, c.gender, !!elevenKey);
    }
    return out;
  }, [characterVoices, characters, elevenVoices]);

  const config: StoryConfig = {
    mode, idea, pointCount, voiceMode, dialogMode, generationDirection,
    enableSpeaker, enableSceneDescription, speakerGender, artStyle,
    pacing, videoMood, colorMood, hook, cta, language, customDetails,
    reelStyle, reelOutro, duoStaging, actionLevel,
    voiceLock, voiceName, voiceModel, voiceStability, voiceSpeed,
    characterVoices: resolvedCharacterVoices,
  };

  /**
   * Dieselbe Stimmen-Konfiguration, aber auf der FERTIG geladenen Kontoliste.
   *
   * `config.voiceName`, `characterVoices` und `elevenVoiceIds` entstehen im
   * Render — also möglicherweise, während `useElevenVoices` noch lädt. Dann ist
   * die Liste leer, `resolveVoiceValue` liefert einen Premade-NAMEN statt der
   * gewählten Konto-Stimme, und `renderSceneVoice` schickt die Anfrage über fal.
   * Ohne fal-Key gibt es dort keinen Weg: die Szene bekommt keine Tonspur. Im
   * Stapellauf traf das die ersten Szenen — genau das Bild „einige Clips ohne
   * Ton", das sich nicht reproduzieren ließ, weil es beim zweiten Versuch (Liste
   * inzwischen da) verschwand.
   *
   * Deshalb wird hier vor JEDER Vertonung auf die (gecachte) Liste gewartet.
   */
  const voiceConfigNow = async (): Promise<{ config: StoryConfig; elevenVoiceIds: string[] }> => {
    if (!elevenKey) return { config, elevenVoiceIds };
    let voices = elevenVoices;
    try {
      voices = await ensureElevenVoices(elevenKey);
    } catch {
      // Liste unerreichbar: mit dem Stand des Renders weiter. `renderSceneVoice`
      // wirft dann mit benanntem Grund, statt still ohne Ton zu enden.
    }
    if (voices.length === 0) return { config, elevenVoiceIds };
    const characterVoicesResolved: Record<string, string> = { ...characterVoices };
    for (const c of characters) {
      const stored = characterVoices[c.name];
      if (stored) characterVoicesResolved[c.name] = resolveVoiceValue(stored, voices, c.gender, !!elevenKey);
    }
    return {
      config: {
        ...config,
        voiceName: resolveVoiceValue(voiceNameRaw, voices, speakerGender, !!elevenKey),
        characterVoices: characterVoicesResolved,
      },
      elevenVoiceIds: voices.map((v) => v.voiceId),
    };
  };

  /**
   * Die beiden Bühnen-Aufnahmen erzeugen: derselbe leere Raum aus beiden
   * Gesprächsrichtungen.
   *
   * Zwei Bilder, ein Klick — einzeln wären sie nicht garantiert derselbe Raum.
   * Bewusst OHNE Referenzbilder: ginge ein Charakterfoto mit, malte das Modell
   * die Person hinein, und die Platte hätte ihren Zweck verloren.
   */
  const generateStagePlates = async (): Promise<{ a?: string; b?: string } | null> => {
    if (!hasGenKey) { toast.error(missingKeyMessage ?? "Bitte hinterlege zuerst deine API-Keys.", { description: "Google und fal.ai sind beide Pflicht — beide in den Einstellungen eintragen." }); return null; }
    if (platesRunning) return null;
    setPlatesRunning(true);
    try {
      const [first, second] = characters.map((c) => c.name).filter(Boolean);
      const sides: ("A" | "B")[] = ["A", "B"];
      const results = await Promise.all(sides.map(async (side) => {
        const prompt = buildStagePlatePrompt({
          side,
          mainLocation,
          specificArea: scenesRef.current[0]?.specificArea,
          artStyle, colorMood, aspect,
          situation: reelSituationRef.current,
          facingName: first, otherName: second,
        });
        const dataUrl = await generateImage(genChain, { prompt, aspectRatio: aspect });
        if (!projectId) return dataUrl;
        try {
          return await uploadAsset(credentials?.email ?? "", projectId, "generated", dataUrl);
        } catch {
          // Spaces aus/unerreichbar: die data-URL trägt die Sitzung, überlebt
          // aber den Reload nicht — besser als gar keine Platte.
          return dataUrl;
        }
      }));
      const next = { a: results[0], b: results[1] };
      // Ref ZUERST: der Volllauf liest direkt nach diesem await weiter — der
      // State-Weg über den Effekt käme dafür einen Render zu spät.
      stagePlatesRef.current = next;
      setStagePlates(next);
      toast.success("Bühne aufgenommen — beide Kamerapositionen stehen.");
      return next;
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e?.message || "Bühne konnte nicht aufgenommen werden.");
      toast.error(err.message, { description: err.hint });
      return null;
    } finally {
      setPlatesRunning(false);
    }
  };

  /**
   * Fehlende Rücken-Referenzen erzeugen — eine pro Charakter, aus dessen
   * Charakterfoto ([Foto] + „dieselbe Person von hinten"). Bereits vorhandene
   * werden übersprungen; ein Fehlschlag einer einzelnen Person blockiert die
   * anderen nicht (die Szene fällt dort auf die Wortbeschreibung zurück).
   */
  const generateBackRefs = async (): Promise<void> => {
    if (!hasGenKey) return;
    const existing = backRefsRef.current;
    const jobs = characters
      .map((c, i) => ({ c, ref: refs[i] }))
      .filter(({ c, ref }) => !!c.name.trim() && !!ref && !existing[nameKey(c.name)]);
    if (!jobs.length) return;
    const results = await Promise.all(jobs.map(async ({ c, ref }) => {
      try {
        const prompt = buildBackRefPrompt({
          name: c.name, gender: c.gender, description: c.description, artStyle, aspect,
        });
        const dataUrl = await generateImage(genChain, {
          prompt,
          references: [{ mimeType: ref.mimeType, base64: ref.base64 }],
          aspectRatio: aspect,
        });
        let url = dataUrl;
        if (projectId) {
          try { url = await uploadAsset(credentials?.email ?? "", projectId, "generated", dataUrl); }
          catch { /* Spaces aus — data-URL trägt die Sitzung */ }
        }
        return [nameKey(c.name), url] as const;
      } catch {
        return null; // Wortbeschreibung bleibt der Rückfall dieser Person.
      }
    }));
    const next = { ...backRefsRef.current };
    for (const r of results) if (r) next[r[0]] = r[1];
    backRefsRef.current = next;
    setBackRefs(next);
  };

  /**
   * Vorbereitung für Zwei-Personen-Reels: Bühnen-Platten + Rücken-Referenzen,
   * jeweils nur was fehlt.
   *
   * Läuft vor JEDEM Bildlauf — Volllauf UND „Bild neu" an der Einzelszene.
   * Der Mantel-Fehler kam genau daher: Einzelszenen liefen ohne die
   * Rücken-Referenz, und das Modell erfand dem Abgewandten Kleidung dazu.
   * Scheitern ist kein Abbruchgrund; die Szene fällt dann auf die
   * Nur-bei-gleichem-Fokus-Regel bzw. die Wortbeschreibung zurück.
   */
  const ensureTwoPersonPrep = async (): Promise<void> => {
    // STILLGELEGT (Nutzerentscheid 2026-08-08): Bühnen-Platten und Rücken-
    // Referenzen („Charaktere vorne und hinten") sind abgeschafft — Sprech-
    // Szenen laufen als Duo-Frame mit beiden Gesichtern in EINEM Bild, die
    // Sprecherwahl macht die OmniHuman-Maske. Die Funktion bleibt als No-op
    // stehen, damit die Aufrufstellen (Volllauf, „Bild neu") unverändert
    // funktionieren; `generateStagePlates`/`generateBackRefs` existieren noch,
    // werden aber nirgends mehr automatisch gestartet.
    return;
  };

  /**
   * Wer zeigt in dieser Szene das Gesicht, wer wird zur Schulter — für die
   * Anzeige an der Szenenkarte.
   *
   * Bewusst dieselbe Quelle wie der Bild-Prompt (`resolveSceneCast` plus die
   * Alternierung beim Sprecherwechsel), damit die Karte nicht etwas anderes
   * behauptet als der Prompt verlangt. Genau darum geht es: Zeigt das fertige
   * Bild die falsche Person, sagt diese Zeile, ob schon die ZUORDNUNG falsch
   * war oder ob das Bildmodell die Vorgabe ignoriert hat.
   */
  const sceneCastLabel = (s: StoryScene, idx: number): { focus: string; backs: string[]; bothFaces?: boolean } | null => {
    if (characters.length < 2) return null;
    const cast = resolveSceneCast(s, characters);
    if (cast.framePeople.length < 2) return null;
    // Stummes Gruppenbild: hier sind ALLE Gesichter zu sehen — „… von hinten"
    // wäre genau die Falschaussage, gegen die dieses Label existiert. Der
    // Hinweis soll ja belegen, was der Prompt verlangt hat.
    if (sceneIsGroupStill(s)) {
      return { focus: cast.framePeople.join(", "), backs: [], bothFaces: true };
    }
    const prev = idx > 0 ? scenes[idx - 1] : null;
    const prevSpeaker = prev ? resolveSceneCast(prev, characters).speaker : "";
    const focus = cast.speaker
      || (cast.framePeople.length === 2 && prevSpeaker
          ? cast.framePeople.find((n) => n.toLowerCase() !== prevSpeaker.toLowerCase()) ?? cast.framePeople[0]
          : cast.framePeople[0]);
    return { focus, backs: cast.framePeople.filter((n) => n.toLowerCase() !== focus.toLowerCase()) };
  };

  /**
   * Duo-Frame an/aus (OmniHuman-Test): die Sprech-Szene zeigt BEIDE Personen,
   * der Clip läuft über OmniHuman mit Sprecher-Maske statt Kling ai-avatar.
   *
   * Der Umschalter verwirft vorhandenes Material der Szene: Ein-Personen-Bild
   * und Duo-Bild sind nicht ineinander überführbar, und der Clip hängt am Bild.
   * Deshalb wird die Folge benannt (Projektregel) und nichts still behalten —
   * ein stehen gelassenes Bild der falschen Fassung würde beim nächsten
   * Video-Lauf mit der falschen Engine gerendert.
   */
  const toggleDuoFrame = (scene: StoryScene) => {
    const live = scenesRef.current.find((x) => x.id === scene.id) ?? scene;
    if (live.imageStatus === "loading" || live.endImageStatus === "loading"
        || live.videoStatus === "loading" || live.audioStatus === "loading") {
      toast.info("An dieser Szene läuft gerade ein Vorgang — bitte warten oder abbrechen.");
      return;
    }
    // Duo ist der Standard — `next` ist die ZIEL-Lage, explizit als true/false
    // gespeichert (undefined hieße wieder „Standard = an").
    const next = !sceneIsDuo(live);
    const hadWork = live.imageStatus === "done" || live.videoStatus === "done";
    if (hadWork) delete endFrameRef.current[scene.id];
    updateScene(scene.id, {
      duoFrame: next,
      // Die Seite gehört zum GENERIERTEN Duo-Bild — ohne Bild keine Seite.
      duoSpeakerSide: undefined,
      ...(hadWork ? {
        imageStatus: "idle" as const, imageDataUrl: undefined, imageUrl: undefined,
        imageError: undefined, imageHint: undefined, detailedImagePrompt: undefined,
        videoStatus: "idle" as const, videoUrl: undefined, videoJobId: undefined,
        videoJobStartedAt: undefined, videoJobKind: undefined,
        videoJobNormalize916: undefined, videoJobTrimTail: undefined,
        videoProgressPct: undefined, videoError: undefined,
        audioStatus: "idle" as const, audioUrl: undefined, audioDurationSec: undefined,
        dubbedVideoUrl: undefined, voiceBakedIn: undefined, voiceError: undefined,
        endFrameDataUrl: undefined, endFrameUrl: undefined,
        endImageStatus: "idle" as const, endImageDataUrl: undefined,
        endImageUrl: undefined, endImageError: undefined,
      } : {}),
    });
    toast.info(
      next
        ? "Szene zeigt jetzt BEIDE Personen — der Clip läuft über OmniHuman (Maske lässt nur den Sprecher sprechen)."
        : "Szene zeigt wieder nur den Sprecher — der Clip läuft über Kling ai-avatar.",
      hadWork ? { description: "Bild und Clip der Szene wurden verworfen und müssen neu erzeugt werden." } : undefined,
    );
  };

  /** Braucht diese Szene eine eigene TTS-Spur? Ohne Sprechtext gibt es nichts
   *  zu vertonen — der rohe (stumme) Clip ist dann schon das Endergebnis. */
  const sceneNeedsVoice = (s: StoryScene) => voiceLock && enableSpeaker && !!s.dialogText?.trim();

  /**
   * Läuft diese Szene über den SPRECHENDEN AVATAR (Kling `ai-avatar`) statt über
   * die Kette Bild → Video → Lipsync/Dub?
   *
   * Das Kriterium ist bewusst exakt dasselbe wie das bisherige `needsLipsync`:
   * die SICHTBARE Person spricht selbst — im Dialog-Modus immer, im Reel-Modus
   * generell (dort trägt das Gesprochene das Format, die Person bleibt ruhig).
   * Für genau diese Szenen ist ai-avatar der direktere Weg: Bild + Ton rein,
   * lippensynchroner Clip raus. Damit fallen auf einen Schlag weg:
   *
   *   • das Raten der Cliplänge (6/8s gegen Klings 5/10s) — das Audio bestimmt sie,
   *   • das stille Abschneiden zu langer Zeilen (`truncated`),
   *   • der separate Lipsync-Schritt, der als eigener fal-Dienst ausfallen kann
   *     und dann nur den Ton tauscht, während der Mund etwas anderes sagt.
   *
   * Szenen OHNE Sprechtext und der Story-Modus mit reiner Off-Stimme bleiben
   * unverändert auf der Kling/Veo-Kette: dort gibt es keine Lippen zu treffen,
   * dafür Bewegung, die ein Bewegungs-Prompt steuern muss — und genau den kennt
   * ai-avatar nicht.
   *
   * MUSS vor `runCost` stehen (useMemo-Factory läuft beim Rendern — eine
   * `const` weiter unten wäre dort noch in der Temporal Dead Zone).
   */
  const sceneUsesTalkingAvatar = (s: StoryScene) =>
    sceneNeedsVoice(s) && (voiceMode === "dialog" || mode === "reel");

  /**
   * Läuft diese Szene als DUO — beide Personen im Bild, Clip über OmniHuman
   * (Maske lässt nur den Sprecher sprechen)?
   *
   * ZUM TESTEN ist Duo der STANDARD für jede Sprechszene, sobald das Projekt
   * zwei Charaktere hat (Nutzerentscheid 2026-08-08: „mache das was wir davor
   * hatten aus"). `duoFrame === false` ist das bewusste Opt-out pro Szene
   * (Umschalter „Nur Sprecher zeigen") — deshalb der Vergleich gegen `false`
   * statt Truthiness: `undefined` heißt AN, nicht AUS. Die alte
   * Ein-Gesicht-Strecke bleibt für Solo-Projekte, stumme Szenen und
   * abgeschaltete Szenen unverändert bestehen.
   */
  const sceneIsDuo = (s: StoryScene) =>
    characters.length >= 2 && sceneUsesTalkingAvatar(s) && s.duoFrame !== false;

  /**
   * WENDET SICH DIESE SZENE ANS PUBLIKUM STATT AN DIE ANDERE PERSON?
   *
   * Der Call-to-Action ist der LETZTE gesprochene Satz („Schau dir den Link in
   * der Beschreibung an") — und der geht an den ZUSCHAUER, nicht an den
   * Gesprächspartner. Bei der Inszenierung „miteinander reden" stand er bisher
   * trotzdem im Gesprächs-Setup: zwei Menschen im Halbprofil, Blick auf den
   * anderen, während der Satz das Publikum anspricht. Das ist der eine Moment
   * im Reel, in dem sich beide zur Kamera drehen müssen — genau die Wendung,
   * die jedes Creator-Duo am Schluss macht.
   *
   * Nur die LETZTE Szene, und nur wenn es überhaupt einen CTA gibt: im Reel
   * schreibt ihn `ensureHookAndCta` notfalls selbst, im Story-Modus zählt das,
   * was im Feld steht. Eine Unterhaltung ohne Schlusswort ans Publikum bleibt
   * bis zum letzten Bild eine Unterhaltung.
   *
   * Über `scenesRef`, nicht über `scenes`: der Volllauf startet Bilder und Clips
   * aus einer älteren Closure heraus, in der `scenes` noch leer sein kann —
   * dieselbe Falle wie bei `isLastScene` weiter unten.
   */
  const sceneTurnsToViewer = (s: StoryScene, list: StoryScene[] = scenesRef.current) => {
    // In der Inszenierung „in die Kamera" schauen ohnehin schon beide hin.
    if (duoStaging !== "conversation") return false;
    const isLast = list.length > 1 && list[list.length - 1]?.id === s.id;
    if (isLast) return mode === "reel" || !!cta.trim();
    // Die Position ist der Normalfall, aber nicht der einzige Weg: steht der CTA
    // aus irgendeinem Grund NICHT in der letzten Szene (nachträglich eine Szene
    // angehängt, umsortiert, das Modell hat ihn eine Szene früher untergebracht),
    // dann entscheidet die Zeile selbst. Sie ist das, worum es geht — nicht ihr
    // Platz in der Liste.
    return lineCarriesCta(s);
  };

  /**
   * Trägt DIESE Sprechzeile den Call-to-Action?
   *
   * Verglichen wird bewusst unscharf: der `dialogText` kommt mit Sprecher-Präfix
   * („Leo: …"), und das Modell übernimmt den CTA fast nie wortgleich — es baut
   * ihn in den Satzfluss ein („Hol dir deine Energie zurück UND speichere das
   * Video…"). Ein Gleichheitsvergleich fände deshalb nie etwas. Gezählt werden
   * die INHALTSWÖRTER des CTA: kommen mindestens zwei Drittel davon in der Zeile
   * vor, ist es diese Zeile. Ein normaler Gesprächssatz erreicht das nicht.
   */
  const lineCarriesCta = (s: StoryScene) => {
    const norm = (t: string) =>
      t.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
    const words = norm(cta).split(" ").filter((w) => w.length > 3);
    if (words.length < 3) return false;   // zu kurz für einen belastbaren Vergleich
    const spoken = norm(splitDialogLine(s.dialogText || "", characters.map((c) => c.name)).line);
    if (!spoken) return false;
    const hits = words.filter((w) => spoken.includes(w)).length;
    return hits / words.length >= 0.66;
  };

  /**
   * Die Inszenierung, die für DIESE eine Szene tatsächlich gilt.
   *
   * Standbild und Clip MÜSSEN dieselbe benutzen. Liefe hier auseinander, was
   * `buildDuoFramePrompt` und der OmniHuman-Prompt bekommen, zöge der Clip die
   * beiden wieder aus der Kamera heraus, in die das Standbild sie gerade
   * gedreht hat — und der Blick wechselt mitten im Satz.
   */
  const stagingForScene = (s: StoryScene): DuoStaging =>
    sceneTurnsToViewer(s) ? "camera" : duoStaging;

  /**
   * Ist das ein stummes GRUPPENBILD — mehrere Personen im Bild, KEINE gesprochene
   * Zeile, und jede von ihnen hat ihr eigenes Anker-Foto im Request?
   *
   * Das ist die Schluss-/Establishing-Szene, die das Storyboard bewusst baut
   * („Beide Gesichter zusammen in einem Bild gibt es nur in einer Szene OHNE
   * dialogText"). Sie läuft NICHT über den Duo-Weg: ohne Sprechtext gibt es
   * keine Maske und kein OmniHuman, der Clip entsteht wie jeder stumme Clip.
   * Unterschieden werden muss sie trotzdem — sie trägt wie das Duo-Bild mehrere
   * Gesichter und darf deshalb keiner Ein-Gesicht-Szene als Vorlage dienen.
   *
   * Die Antwort kommt aus `sceneAnchorPlan`, damit hier nicht dieselbe
   * Entscheidung ein zweites Mal (und irgendwann anders) getroffen wird.
   */
  const sceneIsGroupStill = (s: StoryScene) => {
    if (characters.length < 2) return false;
    const p = sceneAnchorPlan(s, characters, null);
    return p.anchorNames.length > 1 && p.describedNames.length === 0;
  };

  /**
   * Was ein vollständiger Durchgang mit der eingestellten Szenenzahl kostet.
   * Hängt an denselben Schaltern wie die Erzeugung selbst: Sprechszenen laufen
   * über den (teureren) Avatar-Weg, Bilder nur dann über fal, wenn fal auch der
   * Bild-Provider ist, und die Stimme nur dann, wenn kein eigener
   * ElevenLabs-Vertrag dazwischensteht.
   */
  const runCost = useMemo(() => estimateRunCost({
    scenes: pointCount,
    talkingAvatar: voiceLock && enableSpeaker && (voiceMode === "dialog" || mode === "reel"),
    withVoice: voiceLock && enableSpeaker,
    imagesViaFal: genChain[0]?.provider === "fal",
    ttsViaFal: !elevenKey,
    // Duo-Szenen (OmniHuman) sind teurer und brauchen einen zweiten Bild-Pass.
    // Duo ist der Standard: VOR dem Storyboard (noch keine Szenen) zählt jede
    // geplante Sprechszene als Duo, sobald zwei Charaktere existieren — sonst
    // zeigte die Spanne vor dem teuersten Lauf den billigeren Kling-Preis.
    duoScenes: characters.length >= 2
      ? (scenes.length > 0 ? scenes.filter(sceneIsDuo).length : pointCount)
      : 0,
  }), [pointCount, voiceLock, enableSpeaker, voiceMode, mode, genChain, elevenKey, scenes, characters]);

  // Dialog-Modus: jede Figur bekommt eine Default-Stimme nach Geschlecht, sobald
  // sie existiert. Ohne das würden alle Figuren die Projektstimme sprechen —
  // `voiceForScene` fällt genau darauf zurück, wenn hier nichts steht.
  useEffect(() => {
    if (!characters.length) return;
    // NICHT mehr automatisch befüllen. `voiceForScene` bevorzugt im Dialog-Modus
    // die Charakter-Zuordnung vor der Projektstimme — wurde sie hier ungefragt
    // mit einem Geschlechts-Default vorbelegt, hat dieser Default die im
    // Voice-Picker GEWÄHLTE Stimme still überstimmt. Genau das ist passiert:
    // der Nutzer wählte eine Stimme und hörte eine andere.
    // Jetzt steht hier nur etwas, wenn es der Nutzer selbst gesetzt hat; sonst
    // greift die Projektstimme. Der Picker zeigt den Default weiterhin als
    // Vorauswahl an, schreibt ihn aber nicht in den State.
    setCharacterVoices((prev) => {
      // Bereits gespeicherte Automatik-Werte aus früheren Sitzungen stehen lassen
      // wäre der gleiche Fehler mit Verzögerung — sie zählen nicht als Wahl.
      const names = new Set(characters.map((c) => c.name).filter(Boolean));
      const cleaned: Record<string, string> = {};
      let changed = false;
      for (const [name, voice] of Object.entries(prev)) {
        if (!names.has(name)) { changed = true; continue; } // Charakter gelöscht/umbenannt
        cleaned[name] = voice;
      }
      return changed ? cleaned : prev;
    });
  }, [characters, characterVoices, setCharacterVoices]);

  // Die EINZIGE Quelle für „fließen die Clips ineinander?". Reels werden immer
  // hart geschnitten — der Toggle wirkt nur im General-Modus. Steuert Prompt,
  // Frame-Verkettung (lastFrame / Frame-Extraktion) UND den Merge gemeinsam,
  // damit die drei nie widersprüchliche Anweisungen produzieren.
  const seamlessActive = continuityMode && mode !== "reel";

  // Der Vlog-Stil greift nur im Reel — im General-Modus ignorieren die
  // Prompt-Builder `reelStyle`/`situation`/`isOutro` ohnehin komplett.
  const vlogActive = mode === "reel" && reelStyle === "vlog";

  // Läuft der Zustandsanschluss wirklich?
  // • `vlogActive`: harte Regel — Explainer-Reels und der Story-Modus behalten
  //   ihr heutiges Verhalten.
  // • `!seamlessActive`: PFLICHT. Der Seamless-Modus besitzt die Frame-Kette
  //   bereits (Endframe → Startframe). Zwei Ketten gleichzeitig würden sich
  //   widersprechen: die eine will den Frame als Startbild festschreiben, die
  //   andere ihn nur als Referenz neu rendern lassen.
  // • Ohne Video-Plan/Key gibt es gar keine Clips, aus denen ein Endframe
  //   entstehen könnte — dann ist der Anschluss schlicht nicht herstellbar.
  const carryOverActive = stateCarryOver && vlogActive && !seamlessActive && plan.videoGen && !!videoApi;

  // „Storyboard + Bilder generieren" startet die Bildläufe direkt nach dem
  // Storyboard aus einer Closure heraus, die das Szenen-Array und die Situation
  // noch von VOR dem Storyboard-Lauf gesehen hat. Beides also zusätzlich in Refs
  // halten und in `generateStoryboard` SYNCHRON mitschreiben, damit Outro-Erkennung und
  // Situation schon beim allerersten Bild stimmen.
  const scenesRef = useRef<StoryScene[]>(scenes);
  useEffect(() => { scenesRef.current = scenes; }, [scenes]);

  /**
   * DER FRISCHE SZENEN-STAND — ohne auf einen Effekt zu warten.
   *
   * `scenesRef` wird oben in einem Effekt nachgezogen, also erst NACH dem
   * nächsten Rendern. Direkt hinter einem `await generateAllImages()` steht dort
   * deshalb noch der Stand von VOR dem letzten `updateScene` — und zwar
   * verlässlich für die zuletzt bearbeitete Szene, weil deren Statuswechsel die
   * letzte Anweisung vor dem Rücksprung ist.
   *
   * Genau daran ist „Reel komplett erstellen" hängengeblieben: Die Bilder waren
   * alle fertig, der Durchlauf las den veralteten Stand, sah die letzte Szene
   * ohne Bild und hielt mit „Szene N hat kein Bild" an — kurz bevor die Clips
   * an der Reihe gewesen wären. Der Nutzer musste die Clips danach von Hand
   * starten, und dann klappte es, weil der Effekt inzwischen gelaufen war.
   *
   * Der Umweg über den Updater ist der einzige Weg, den AKTUELLEN State
   * garantiert zu lesen: React ruft ihn mit dem neuesten Wert auf. Dasselbe
   * Array geht unverändert zurück — React bricht dann ab und rendert nichts neu.
   */
  const readScenes = () => new Promise<StoryScene[]>((resolve) => {
    setScenes((cur) => { resolve(cur); return cur; });
  });

  /** Frisch lesen UND das Ref gleich mitziehen. Das zweite ist der eigentliche
   *  Punkt: `generateAllVideos` und die Prompt-Bauer lesen alle `scenesRef` —
   *  ohne den Abgleich würde der nächste Schritt auf demselben veralteten Stand
   *  weiterarbeiten und z. B. die letzte Szene aus den Zielen filtern. */
  const syncScenes = async () => {
    const fresh = await readScenes();
    scenesRef.current = fresh;
    return fresh;
  };
  const reelSituationRef = useRef<ReelSituation | null>(reelSituation);
  useEffect(() => { reelSituationRef.current = reelSituation; }, [reelSituation]);
  // Aus demselben Grund wie die Situation darüber: Bild- und Videoläufe arbeiten
  // ihre Szenen innerhalb EINER Render-Closure ab. Ohne Ref läse ein Lauf, der
  // vor dem Umschalten gestartet ist, bis zum Ende den alten Wert — und das Reel
  // hätte zur Hälfte ruhige und zur Hälfte aktive Szenen.
  const actionLevelRef = useRef<ActionLevel>(actionLevel);
  useEffect(() => { actionLevelRef.current = actionLevel; }, [actionLevel]);

  // Endframes des laufenden Durchgangs, sceneId → data-URL. Muss ein Ref sein,
  // aus exakt demselben Grund wie `scenesRef`:
  // der verschränkte Lauf arbeitet die Szenen innerhalb EINER Render-Closure ab,
  // ein `setScenes` aus Szene 1 ist für Szene 2 im selben Lauf unsichtbar. Der
  // Endframe wird deshalb synchron hier hinterlegt und zusätzlich (für UI und
  // Reload) an die Szene geschrieben.
  const endFrameRef = useRef<Record<string, string>>({});

  /** Ist das die Outro-Szene (letzte Szene, die hart in einen anderen Kontext
   *  schneiden darf)? Erst ab 3 Szenen — sonst wäre die halbe Reel-Länge der
   *  „Ausbruch" und die durchgehende Situation gäbe es nicht mehr. Muss an BEIDE
   *  Prompt-Builder (Bild + Video) gehen, sonst widersprechen sie sich. */
  const isOutroScene = (sceneId: string): boolean => {
    if (!vlogActive || !reelOutro) return false;
    const list = scenesRef.current;
    return list.length >= 3 && list[list.length - 1]?.id === sceneId;
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
    const state = (loadProject(projectId)?.state ?? {}) as { story?: StoryScene[]; values?: Record<string, unknown> };
    const stored = Array.isArray(state.story) ? state.story : [];
    setScenes(stored);
    // Reel-Stil-Default nach demselben Muster: bereits vorhandenes Storyboard =
    // Altprojekt → "explainer" (bisheriges Verhalten), sonst "vlog".
    if (state.values?.["story:reelStyle"] == null) {
      const initialStyle: ReelStyle = stored.length === 0 ? "vlog" : "explainer";
      setReelStyleDefault(initialStyle);
      setReelStyle(initialStyle);
    }
    setScenesLoaded(projectId);
  }, [projectId, storyReloadV]);

  // ── Speichern des Storyboards ──────────────────────────────────────────────
  //
  // Frueher stand hier eine Sperre: solange IRGENDEINE Szene lud, wurde gar
  // nichts gespeichert. Das war die Ursache dafuer, dass ein Reload waehrend
  // einer Generierung aussah, als haette nie etwas angefangen — und es traf
  // nicht nur die laufende Szene, sondern auch alle bereits fertigen daneben.
  // Jetzt wird durchgehend gespeichert; `sanitizeScenes` entscheidet, welcher
  // Zustand den Reload ueberleben darf.
  const lastSavedRef = useRef<string>("");
  const quotaWarnedRef = useRef(false);

  const persistScenes = useCallback(() => {
    if (!projectId || scenesLoaded !== projectId) return;
    const sanitized = sanitizeScenes(scenesRef.current);
    // Der Fortschrittswert ist bewusst NICHT Teil des Vergleichs (und auch nicht
    // des Snapshots): sonst schriebe jeder Poll-Tick das komplette Projekt-JSON
    // neu, im Sekundentakt und pro laufender Szene.
    const json = JSON.stringify(sanitized);
    if (json === lastSavedRef.current) return;
    lastSavedRef.current = json;
    const state = (loadProject(projectId)?.state ?? {}) as Record<string, unknown>;
    const ok = saveProjectState(projectId, { ...state, story: sanitized });
    // Ein an der Quota gescheiterter Save sah bisher exakt wie Datenverlust aus,
    // ohne dass irgendwo etwas stand. Einmal pro Sitzung sagen.
    if (!ok && !quotaWarnedRef.current) {
      quotaWarnedRef.current = true;
      toast.error("Der Browser-Speicher ist voll — das Storyboard wird nicht mehr gesichert.", {
        description: "Alte Projekte loeschen oder Bilder/Clips in den Bucket auslagern.",
      });
    }
  }, [projectId, scenesLoaded]);

  useEffect(() => {
    if (!projectId || scenesLoaded !== projectId) return;
    const h = setTimeout(persistScenes, 500);
    return () => clearTimeout(h);
  }, [scenes, projectId, scenesLoaded, persistScenes]);

  // Beim Verlassen der Seite SOFORT sichern. Der 500ms-Debounce oben wird von
  // parallel laufenden Szenen (VIDEO_CONCURRENCY) immer wieder zurueckgesetzt —
  // ohne diesen Flush kann der letzte Stand genau dann fehlen, wenn er gebraucht
  // wird: beim Reload mitten im Lauf.
  useEffect(() => {
    const flush = () => persistScenes();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [persistScenes]);

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
    // Ein Slot ist ein ARCHIVSTAND. Ein noch laufender Auftrag gehoert da nicht
    // hinein: beim spaeteren Zurueckholen stuende dort ein "laeuft"-Zustand mit
    // einem laengst abgelaufenen Handle.
    if (scenesRef.current.some((s) => s.videoStatus === "loading")) return;
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
      // Referenzgröße statt „irgendwas unter 4 MB": diese Avatare gehen bei
      // JEDER Szene erneut mit hoch — bei 8 Szenen × 3 Avataren ist das der
      // größte einzelne Zeitposten des ganzen Storyboard-Laufs.
      const compressed = await prepareReferenceImage(f);
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
    if (!hasGenKey) { toast.error(missingKeyMessage ?? "Bitte hinterlege zuerst deine API-Keys.", { description: "Google und fal.ai sind beide Pflicht — beide in den Einstellungen eintragen." }); return; }
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

  /**
   * Beim Seitenaufbau EINMAL frische Ideen holen, statt die drei fest
   * einprogrammierten Beispiele stehen zu lassen — die passten zu keinem
   * Projekt und mussten erst per „Neue Vorschläge" weggeklickt werden.
   *
   * Der Merker liegt auf MODUL-Ebene, nicht im State: so überlebt er das
   * Wechseln der Seite (kein zweiter bezahlter Lauf, wenn man nur kurz ins
   * Studio und zurück geht), aber nicht das Neuladen der Seite — nach jedem
   * Refresh stehen also neue Ideen da, wie gewünscht. Projekt und Modus gehen in
   * den Schlüssel ein: ein anderes Projekt (anderes Profil) und ein Wechsel
   * Reel↔Story brauchen andere Ideen.
   */
  const generateSuggestionsRef = useRef(generateSuggestions);
  generateSuggestionsRef.current = generateSuggestions;
  useEffect(() => {
    if (!hasGenKey || !projectId) return;
    // Steht schon eine Idee im Feld, ist das Angebot ohnehin verdeckt.
    if (idea.trim()) return;
    const key = `${projectId}:${mode}`;
    if (autoIdeasDone.has(key)) return;
    autoIdeasDone.add(key);
    // Ein Tick Abstand: `useProjectProfile` liest das Profil in seinem eigenen
    // Mount-Effekt aus dem Storage. Sofort gestartet, liefe der erste (bezahlte)
    // Lauf ohne Profil-Kontext — also mit generischen Ideen. Über die Ref, damit
    // die Funktion aus dem Render MIT Profil genommen wird, nicht die aus diesem.
    const t = setTimeout(() => void generateSuggestionsRef.current(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGenKey, projectId, mode, idea]);

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
        ? "\n- ERZÄHL-REEL: eine klare Botschaft, die gesprochen vermittelt wird (in die Kamera oder als Off-Sprecher) — KEINE Kurzgeschichte\n- Hook-First: der stärkste gesprochene Satz kommt zuerst\n- Das ERZÄHLEN trägt: die Person bleibt ruhig, keine krassen Aktionen, keine Gags — höchstens kleine alltägliche Gesten\n- Harte Schnitte, Creator-Style, scroll-stopping durch das Gesagte"
        : "";

      const result = await generateText(genChain, {
        prompt: buildProfilePreamble(projectProfile) + `Erweitere diese kurze ${mode === "reel" ? "Themen-Idee zu einem packenden Konzept für ein Erzähl-Reel: Was wird gesagt, und wie trägt die Erzählung allein — die Person bleibt ruhig, keine krassen Aktionen?" : "Story-Zusammenfassung zu einer erzählbaren Geschichte — ruhig vorgetragen, die Spannung lebt in den Worten, nicht in Action."}

REGELN:
- 3–6 Sätze, visuell und atmosphärisch
- Beschreibe, was erzählt wird, und die Emotionen dahinter — keine Action-Inszenierung
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
    if (!hasGenKey) { toast.error(missingKeyMessage ?? "Bitte hinterlege zuerst deine API-Keys.", { description: "Google und fal.ai sind beide Pflicht — beide in den Einstellungen eintragen." }); return; }
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
        ? "\n- ERZÄHL-REEL: eine Botschaft/These, gesprochen vermittelt (in die Kamera oder Off-Sprecher) — keine Kurzgeschichte\n- Hook-First: stärkster gesprochener Satz zuerst, scroll-stopping durch das Gesagte\n- Die Person bleibt ruhig und erzählt — keine krassen Aktionen, keine Gags, höchstens kleine alltägliche Gesten"
        : "";
      const outputRule = ideaCount > 1
        ? `AUSGABEFORMAT: Antworte AUSSCHLIESSLICH mit einem JSON-Array mit genau ${ideaCount} Strings. Kein Markdown, keine Erklärungen.`
        : `AUSGABEFORMAT: Antworte NUR mit der Story-Idee, keine Einleitungen, keine Anführungszeichen.`;

      // ── Die BESETZUNG gehört in den Prompt ────────────────────────────────
      // Sie fehlte hier komplett. Das Modell erfand deshalb eigene Namen — man
      // trug oben „Thorsten" ein und bekam eine Idee über „Tom". Der Fehler
      // pflanzt sich fort: das Storyboard baut auf dieser Idee auf, und danach
      // steht in jeder Szene der falsche Name.
      //
      // Nur WIRKLICH benannte Personen mitgeben: `characters` füllt fehlende
      // Namen mit „Person 1" auf. Die als verbindlich zu diktieren hieße, dem
      // Modell „Person 1" als Eigennamen in die Idee zu schreiben — schlimmer
      // als ein frei erfundener Name.
      const namedCast = characters.filter((_, i) => !!characterNames[i]?.trim());
      const castBlock = namedCast.length
        ? `\n\nPERSONEN — VERBINDLICH, exakt diese Namen verwenden und KEINE weiteren erfinden:\n${
            namedCast.map((c) => {
              const g = c.gender === "male" ? "männlich" : c.gender === "female" ? "weiblich" : null;
              return `- ${c.name}${g ? ` (${g})` : ""}${c.description ? `: ${c.description}` : ""}`;
            }).join("\n")
          }`
        : "";

      const prompt = tweak
        ? `Du bist ein ${mode === "reel" ? "Creator-Texter für kurze Erklär-/Erzähl-Reels (TikTok/Shorts)" : "Story-Autor für längere Storyboards"}.

AKTUELLE STORY-IDEE:
"${trimmedIdea}"

${trimmedBrief ? `ÄNDERUNGSWUNSCH:\n"${trimmedBrief}"` : "Verbessere und erweitere diese Story-Idee."}${castBlock}

Erstelle genau ${ideaCount} ${ideaCount > 1 ? "verschiedene Varianten" : "Variante"} der angepassten Idee. Behalte den Kern bei, integriere die Änderung.${ideaCount > 1 ? " Jede Variante mit anderem Fokus." : ""}${reelHints}

REGELN:
- ${ideaCount > 1 ? "Jede Variante" : "Die Variante"} 4–8 Sätze, visuell und konkret beschrieben
- Auf Deutsch${namedCast.length ? "\n- Die Personen AUSSCHLIESSLICH mit den oben genannten Namen benennen — keine anderen Namen erfinden, auch nicht für Nebenfiguren" : ""}
- ${outputRule}`
        : `Du bist ein ${mode === "reel" ? "Creator-Texter für kurze Erklär-/Erzähl-Reels (TikTok/Shorts)" : "Story-Autor für längere Storyboards"}. Erstelle genau ${ideaCount} fesselnde Story-Idee${ideaCount > 1 ? "n" : ""}.

BRIEFING vom User:
"${trimmedBrief}"${castBlock}

REGELN:
- ${ideaCount > 1 ? "Jede Idee" : "Die Idee"} 4–8 Sätze, visuell und filmbar
- Auf Deutsch${reelHints}${namedCast.length ? "\n- Die Personen AUSSCHLIESSLICH mit den oben genannten Namen benennen — keine anderen Namen erfinden, auch nicht für Nebenfiguren" : ""}
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
    // Auch eine laufende Wiederaufnahme beenden — sie haelt sonst die Szenen
    // reserviert und der Knopf sieht wirkungslos aus.
    resumeAbortRef.current?.abort();
    abortRef.current = true;
    setGeneratingStoryboard(false);
    setGeneratingImages(false);
    setGeneratingVideos(false);
    setRunPhase(null);
    autoRunRef.current = false;
    setAutoRunning(false);
    // EHRLICH SAGEN, WAS DER ABBRUCH KANN — und was nicht.
    //
    // Er verhindert, dass NEUE Aufträge starten. Bereits laufende Clips rendern
    // beim Anbieter weiter und werden auch fertig; ihr Ergebnis kommt noch an
    // der Szene an, statt bezahlt zu verpuffen. „Laufende Anfrage wird
    // verworfen" behauptete das Gegenteil — der Nutzer glaubte, er habe gerade
    // Geld gespart, und wunderte sich Minuten später über einen Clip, der
    // trotzdem auftauchte.
    const stillRunning = busyScenesRef.current.size;
    toast.info(
      stillRunning > 0
        ? `Abbruch — es werden keine neuen Szenen mehr gestartet. ${stillRunning === 1 ? "Die eine bereits laufende Szene wird" : `Die ${stillRunning} bereits laufenden Szenen werden`} noch fertig; ihr Ergebnis bleibt erhalten.`
        : "Abbruch — es wird nichts Neues mehr gestartet.",
    );
  };

  /**
   * HOOK UND CTA SIND STANDARDMÄSSIG AUTOMATISCH.
   *
   * Beide Felder sind optional und blieben deshalb im Normalfall leer. Leer hieß
   * bisher: für den Hook eine generische Standard-Direktive („öffne mit der
   * stärksten Aussage"), für den CTA gar kein CTA. Das Reel fing also brav an
   * und hörte ohne Aufforderung auf — genau die zwei Sekunden, über die ein Reel
   * gewinnt oder weggescrollt wird.
   *
   * Jetzt schreibt das Modell beides passend zu Profil, Idee und Story, BEVOR
   * das Storyboard entsteht. Das Ergebnis wird in die sichtbaren Felder
   * zurückgeschrieben: der Nutzer sieht, womit sein Reel anfängt und aufhört,
   * und kann es für den nächsten Lauf überschreiben. Ein unsichtbarer
   * Automatismus wäre hier das Falsche — beim nächsten Lauf stünde sonst wieder
   * etwas anderes drin, ohne dass jemand sagen könnte warum.
   *
   * Ein bereits gefülltes Feld wird NIE überschrieben, und ein Fehlschlag ist
   * folgenlos: dann läuft das Storyboard wie zuvor mit der Standard-Direktive
   * (`getEffectiveStoryHook`) bzw. ohne CTA weiter, statt den bezahlten Lauf
   * abzubrechen.
   */
  const ensureHookAndCta = async (profileContext: string): Promise<{ hook: string; cta: string }> => {
    // NUR IM REEL. Im Story-Modus sind Hook und CTA keine Formatelemente: Dort
    // gibt es ohne Eingabe bewusst gar keinen Hook, und ein in die Schlussszene
    // gesprochenes „Folg mir für mehr" würde eine Erzählung zerstören.
    if (mode !== "reel") return { hook, cta };
    const needHook = !hook.trim();
    const needCta = !cta.trim();
    if (!needHook && !needCta) return { hook, cta };
    try {
      const raw = await generateText(genChain, {
        prompt: buildHookCtaPrompt({
          mode, idea, language, reelStyle, customDetails,
          characterNames: characters.map((c) => c.name).filter(Boolean),
          profileContext,
          needHook, needCta,
          // HIER entsteht der Ton, nicht erst im Storyboard: Bei leerem Feld
          // schreibt dieser Lauf den Hook, der danach wortgleich als erste Zeile
          // gesprochen wird. Ohne den Level käme auch im ruhigen Modus ein
          // gerufener Satz heraus.
          actionLevel: actionLevelRef.current,
        }),
        json: true,
        // Etwas höher als beim Storyboard: ein Hook darf zuspitzen, und drei
        // Läufe mit derselben Idee sollen nicht dreimal denselben Satz ergeben.
        temperature: 1,
        maxOutputTokens: 500,
      });
      const parsed = extractJson<{ hook?: string; cta?: string }>(raw);
      // Anführungszeichen kommen trotz Anweisung regelmäßig mit — sie würden im
      // Prompt sonst das umschließende Zitat der Hook-Zeile aufbrechen.
      const clean = (s: unknown) => String(s ?? "").trim().replace(/^["'„“»]+|["'“”«]+$/g, "").trim();
      const nextHook = needHook ? clean(parsed.hook) : hook;
      const nextCta = needCta ? clean(parsed.cta) : cta;
      const wroteHook = needHook && !!nextHook;
      const wroteCta = needCta && !!nextCta;
      if (wroteHook) setHook(nextHook);
      if (wroteCta) setCta(nextCta);
      // Sagen, was geschrieben wurde — sonst steht plötzlich Text in Feldern,
      // die der Nutzer leer gelassen hat, ohne dass er weiß woher.
      if (wroteHook || wroteCta) {
        toast.info(
          wroteHook && wroteCta ? "Hook und Call-to-Action automatisch geschrieben."
          : wroteHook ? "Hook automatisch geschrieben."
          : "Call-to-Action automatisch geschrieben.",
          {
            description: [wroteHook ? `Hook: „${nextHook}"` : "", wroteCta ? `CTA: „${nextCta}"` : ""]
              .filter(Boolean).join("  ·  "),
          },
        );
      }
      return { hook: nextHook, cta: nextCta };
    } catch {
      // Bewusst still: der Storyboard-Lauf ist wichtiger als der Zusatz, und der
      // Rückfall (Standard-Direktive / kein CTA) ist genau das bisherige Verhalten.
      return { hook, cta };
    }
  };

  const generateStoryboard = async () => {
    if (!hasGenKey) { toast.error(missingKeyMessage ?? "Bitte hinterlege zuerst deine API-Keys.", { description: "Google und fal.ai sind beide Pflicht — beide in den Einstellungen eintragen." }); return; }
    if (!idea.trim()) { toast.error("Bitte gib deine Story-Idee ein."); return; }
    /**
     * NAMENLOSE CHARAKTERE STOPPEN DEN LAUF.
     *
     * `characters` füllt einen fehlenden Namen mit „Person 1" auf — als
     * Anzeigetext gedacht, aber der Storyboard-Prompt diktiert ihn dem Modell
     * als VERBINDLICHEN Eigennamen. Ergebnis: Dialogzeilen wie „Person 1: …",
     * ein `speaker`, der zwar validiert aber nichts bedeutet, und Szenen, in
     * denen das Modell die Zeile lieber ganz weglässt, als einen Platzhalter
     * anzusprechen. Genau das kam als „Namen nicht richtig gesetzt und Dialog
     * dazu nicht generiert" zurück.
     *
     * Die Ideen-Generierung filtert unbenannte Personen längst heraus
     * (`namedCast`) — nur hier fehlte die Entsprechung. Statt still einen
     * Platzhalter zu diktieren, sagt der Lauf jetzt, welche Karte fehlt.
     */
    const unnamed = refs
      .map((_, i) => i)
      .filter((i) => !characterNames[i]?.trim());
    if (unnamed.length) {
      toast.error(
        unnamed.length === 1
          ? `Charakter #${unnamed[0] + 1} hat noch keinen Namen.`
          : `Diese Charaktere haben noch keinen Namen: ${unnamed.map((i) => `#${i + 1}`).join(", ")}.`,
        { description: "Die Story benutzt genau diese Namen — ohne sie stünde 'Person 1' in jeder Dialogzeile." },
      );
      return;
    }
    // Ein neues Storyboard ersetzt `scenes` UND `scenesRef` synchron. Mitten in
    // einem Bild-/Video-Batch würde der weiterlaufen und für Szenen bezahlen,
    // die es nicht mehr gibt — seine Patches fänden die IDs nicht mehr und
    // verpufften still.
    const batchToken = claimBatch("storyboard");
    if (batchToken === null) {
      toast.info("Es läuft gerade ein Durchgang — bitte warten oder abbrechen.");
      return;
    }

    abortRef.current = false;
    setGeneratingStoryboard(true);
    beginRunPhase("storyboard", 0);
    setExpandedSceneId(null);
    try {
      // Das Profil gehört auch HIER hin, nicht nur an die Ideen-Vorschläge:
      // sonst entsteht das eigentliche Reel ohne jeden Projekt-Bezug. Sprache
      // ausgenommen — die steht als `outputLanguage` schon im Prompt.
      const profileContext = buildProfilePreamble(projectProfile, { includeLanguage: false });
      // Hook und CTA kommen VOR dem Storyboard — leer heißt jetzt „automatisch",
      // nicht mehr „generisch bzw. gar nicht".
      const { hook: effHook, cta: effCta } = await ensureHookAndCta(profileContext);
      if (abortRef.current) return;
      const prompt = buildStoryboardPrompt({
        ...config,
        hook: effHook,
        cta: effCta,
        characters,
        profileContext,
      });
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
      // Die Situation gehört zu GENAU diesem Storyboard — deshalb bei jedem Lauf
      // neu setzen (und auf null, wenn das Modell keine geliefert hat bzw. der
      // Explainer-Pfad sie gar nicht erst anfordert). Sonst würde die Situation
      // eines alten Vlog-Laufs in die Prompts des neuen Storyboards lecken.
      const situation = parseSituation(parsed.situation);
      reelSituationRef.current = situation;
      setReelSituation(situation);
      const knownNames = characters.map((c) => c.name.trim()).filter(Boolean);
      const mapped = sceneList.slice(0, pointCount).map((raw, i) => newScene(raw, i, knownNames));
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
        // Die Aussprache-Fassung trägt denselben Sprechernamen vor dem
        // Doppelpunkt — bliebe dort „Char 1" stehen, spräche die Stimme ihn mit.
        dialogSpeech: s.dialogSpeech ? resolveCharacterNames(s.dialogSpeech, characters) : undefined,
        continuityNotes: resolveCharacterNames(s.continuityNotes, characters),
        // Der Endzustand nennt dieselben Personen wie die keyAction — ohne diese
        // Zeile stünde dort „Char 1", während überall sonst der echte Name steht.
        endState: resolveCharacterNames(s.endState ?? "", characters),
      }))
        // Besetzung EINMAL festschreiben, direkt nach der Namensauflösung: hier
        // sind „Char 1"-Platzhalter schon ersetzt, und ab jetzt lesen Bild-,
        // Video- und Stimmenpfad dieselben, geprüften Werte aus der Szene statt
        // jeder für sich im Freitext zu suchen. Ein vertippter oder erfundener
        // Name verschwindet damit an genau einer Stelle statt dreimal anders zu
        // wirken.
        .map((s) => {
          const cast = resolveSceneCast(s, characters);
          return { ...s, participants: cast.participants || s.participants, speaker: cast.speaker };
        });
      // Reel = harte Schnitte, aber je nach Stil in die entgegengesetzte Richtung:
      // Explainer trennt zwei gleiche Einstellungen deterministisch auf, Vlog zieht
      // umgekehrt ALLE Szenen auf denselben Kameraaufbau (Jump Cuts), falls das
      // Modell die Regeln ignoriert hat.
      const finalScenes = mode === "reel"
        ? (reelStyle === "vlog"
            ? enforceVlogJumpCuts(named, { reelOutro })
            // `voiceLock` und `mode` MÜSSEN mit: ohne sie hält der Guard den
            // Reel-Standardfall (Sprecher-Modus) für stumm und lässt genau dort
            // blickfeindliche Kamerawerte stehen.
            : enforceHardCutVariation(named, { voiceMode, enableSpeaker, voiceLock, mode, characterNames: knownNames, actionLevel }))
        : named;
      scenesRef.current = finalScenes;
      setScenes(finalScenes);

      // Messpunkt für die Zeilenende-Regel: wie viele Zeilen enden trotz
      // Anweisung weder auf Punkt/Frage-/Ausrufezeichen noch auf Komma, laufen
      // also unabgeschlossen in den nächsten Clip? `commas` deckt den zweiten
      // Umgehungsweg ab — lauter Komma-Enden wären der alte Satzbogen in neuer
      // Verkleidung. Nur DEV.
      if (import.meta.env.DEV && mode === "reel" && enableSpeaker && voiceLock) {
        const seam = scriptSeamReport(finalScenes);
        console.log(
          `[seam] ${seam.dangling}/${seam.lines} Zeilen ohne Satzzeichen · ${seam.commas}/${seam.lines} auf Komma` +
            (seam.commaLast ? " · letzte Zeile endet auf Komma (soll nicht)" : ""),
          seam.offenders.length ? `— Szenen ${seam.offenders.map((i) => i + 1).join(", ")}` : "— sauber");
      }

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
      endRunPhase("storyboard");
      releaseBatch(batchToken);
    }
  };

  /**
   * Das Kontinuitäts-Referenzbild für diese Szene — plus die Information, WOHER
   * es stammt (der Prompt formuliert je nach Quelle anders).
   *
   * Reihenfolge und ihr Grund:
   *  1. Endframe des Vorgänger-CLIPS (Ref → Szene → Bucket-URL) = der Zustand
   *     NACH dessen Handlung. Nur damit kann diese Szene dort anfangen, wo der
   *     vorige Clip aufgehört hat.
   *  2. Sonst das Startbild der Vorszene = der Zustand VOR deren Handlung.
   *     Das ist das bisherige Verhalten und bleibt der Rückfall, wenn es keinen
   *     Clip gibt, die Extraktion fehlgeschlagen ist oder das Projekt aus einer
   *     Zeit vor diesem Feature stammt.
   *
   * Hierüber profitieren ALLE Einzelbuttons („Bild neu" auf Szene 3 schließt an
   * das Ende von Clip 2 an), ohne dass an ihnen etwas geändert werden muss.
   *
   *  3. NACH VORNE, wenn rückwärts nichts da ist: das Bild der nächsten Szene,
   *     die schon eines hat. Das ist der Fall „Szene 1 einzeln neu erzeugen" —
   *     sie hat keinen Vorgänger, aber die Szenen danach existieren bereits und
   *     legen Raum, Licht und Kleidung längst fest. Ohne diesen Rückfall entsteht
   *     ausgerechnet der Frame, der den Anschluss für alle folgenden vorgibt,
   *     völlig frei — und passt dann als einziger nicht zum Rest.
   *     Die Richtung MUSS mit in den Prompt: ein Bild, das einen SPÄTEREN Moment
   *     zeigt, ist bindend für Aussehen und Ort, aber niemals für Haltung und
   *     Fortschritt. Als „vorige Szene" beschrieben würde es die Handlung dieser
   *     Szene vorwegnehmen.
   *     Greift nur beim Einzel-Button: der Volllauf gibt sein Referenzbild
   *     ausdrücklich mit (`prevImageOverride`) und fragt hier gar nicht.
   */
  const resolvePrevSceneImage = async (
    sceneId: string,
  ): Promise<{ url: string; kind: "sceneStill" | "clipEndFrame" | "nextSceneStill"; fromSceneId: string } | null> => {
    const list = scenesRef.current;
    const idx = list.findIndex((s) => s.id === sceneId);
    if (idx < 0) return null;

    /** Das fertige Startbild einer Szene als data-URL — oder null. */
    const stillOf = async (s: StoryScene): Promise<string | null> => {
      if (s.imageDataUrl) return s.imageDataUrl;
      if (s.imageUrl) {
        try {
          const { base64, mimeType } = await urlToBase64(s.imageUrl);
          return `data:${mimeType};base64,${base64}`;
        } catch { return null; }
      }
      return null;
    };

    const prev = idx > 0 ? list[idx - 1] : null;

    if (prev && carryOverActive) {
      const inSession = endFrameRef.current[prev.id] ?? prev.endFrameDataUrl;
      if (inSession) return { url: inSession, kind: "clipEndFrame", fromSceneId: prev.id };
      if (prev.endFrameUrl) {
        try {
          const { base64, mimeType } = await urlToBase64(prev.endFrameUrl);
          return { url: `data:${mimeType};base64,${base64}`, kind: "clipEndFrame", fromSceneId: prev.id };
        } catch { /* Bucket unerreichbar — auf das Szenenbild zurückfallen */ }
      }
    }

    if (prev) {
      const still = await stillOf(prev);
      if (still) return { url: still, kind: "sceneStill", fromSceneId: prev.id };
    }

    // Rückwärts nichts da → nach vorne schauen. Erste Szene mit fertigem Bild
    // gewinnt; die direkt folgende ist die aussagekräftigste, deshalb von vorn.
    for (let i = idx + 1; i < list.length; i++) {
      const still = await stillOf(list[i]);
      if (still) return { url: still, kind: "nextSceneStill", fromSceneId: list[i].id };
    }
    return null;
  };

  const generateSceneImage = async (
    scene: StoryScene,
    opts: {
      prevImageOverride?: string | null;
      /** Woher `prevImageOverride` stammt — steuert nur den Prompt-Wortlaut.
       *  Default "sceneStill" = bisheriges Verhalten. */
      prevImageKind?: "sceneStill" | "clipEndFrame" | "ownStartFrame" | "nextSceneStill";
      minAttempt?: number;
      /**
       * Welchen der beiden Frames dieser Szene wir rendern.
       * • "start" (Default) — das Startbild. Unverändertes Verhalten.
       * • "end" — den Endframe derselben Einstellung. Schreibt in die
       *   `endImage*`-Felder und lässt Video/Vertonung in Ruhe: der Endframe
       *   ist Teil DESSELBEN Clips, kein neuer Bildstand, der ihn entwertet.
       * Bewusst ein Parameter statt einer zweiten Funktion — Retry-Backoff,
       * Abort-Prüfung, Fehlerübersetzung und Upload sind hier identisch und
       * würden in einer Kopie sofort auseinanderlaufen.
       */
      frameKind?: "start" | "end";
      /** Aufruf kommt aus einem Batch, der die Szene bereits reserviert hat und
       *  selbst wieder freigibt. Überspringt die Konflikt-Guards. */
      fromBatch?: boolean;
    } = {},
  ): Promise<string | null> => {
    if (!hasGenKey) { toast.error(missingKeyMessage ?? "Bitte hinterlege zuerst deine API-Keys.", { description: "Google und fal.ai sind beide Pflicht — beide in den Einstellungen eintragen." }); return null; }
    const isEnd = opts.frameKind === "end";

    // `fromBatch`: der Batch hat die Szene bereits reserviert und gibt sie auch
    // wieder frei — er darf hier nicht an seiner eigenen Reservierung scheitern.
    const owned = !opts.fromBatch;
    if (owned) {
      const blocked = generationBlocked();
      if (blocked) { toast.info(blocked); return null; }
      const live = scenesRef.current.find((x) => x.id === scene.id) ?? scene;
      // Ein laufendes Video derselben Szene ist der teure Fall: ein neues Bild
      // verwirft Video und Vertonung — der bezahlte Clip wäre weg, und der noch
      // laufende Job schriebe danach auf eine Szene, zu der er nicht mehr passt.
      if (live.videoStatus === "loading") {
        toast.info(`Szene ${sceneNumber(scene.id)}: Das Video rendert gerade — währenddessen lässt sich das Bild nicht neu erzeugen.`, {
          description: "Warte, bis der Clip fertig ist, oder brich den Lauf ab.",
        });
        return null;
      }
      if (live.audioStatus === "loading") {
        toast.info(`Szene ${sceneNumber(scene.id)}: Die Vertonung läuft gerade.`);
        return null;
      }
      if (!claimScene(scene.id)) {
        // Zweiter Klick auf denselben Knopf, bevor React neu gerendert hat.
        return null;
      }
      // Der Abbruch-Merker gehört dem VORIGEN Lauf. Er blieb nach „Abbrechen"
      // und nach „Alles verwerfen" stehen, und die Prüfpunkte weiter unten
      // liessen diesen frischen Klick dann still ins Leere laufen — der Knopf
      // sah kaputt aus. `generationBlocked()` oben garantiert, dass hier kein
      // fremder Lauf mitläuft, dem wir den Abbruch wegnehmen würden.
      abortRef.current = false;
    }
    try {
    updateScene(scene.id, isEnd
      ? { endImageStatus: "loading", endImageError: undefined }
      : { imageStatus: "loading", imageError: undefined, imageHint: undefined });

    // Wer zeigt hier das Gesicht, wessen Anker geht mit? Einmal berechnet und
    // danach für Referenzbild-Auswahl, Bühnen-Platte und Prompt gemeinsam
    // benutzt — drei Stellen, die sich sonst widersprechen könnten.
    const castPlan = characters.length > 0
      ? sceneAnchorPlan(scene, characters, (() => {
          const list = scenesRef.current;
          const i = list.findIndex((x) => x.id === scene.id);
          return i > 0 ? list[i - 1] : null;
        })())
      : null;

    // ── DUO-Frame (OmniHuman-Test): beide Personen im Bild ──────────────────
    //
    // Eigener Zweig, der die komplette Ein-Gesicht-Maschinerie umgeht — sie
    // wäre hier das Gegenteil des Ziels. Das Bild entsteht in ZWEI Pässen
    // (Sprecher allein auf seiner Seite, dann der Zuhörer per Referenz-Edit
    // dazu), weil zwei Gesichts-Anker im selben Request nachweislich
    // vermischen. Der Endframe-Fall geht hier nie durch: Duo-Szenen laufen
    // über den Avatar-Weg, der nur das Startbild kennt.
    if (sceneIsDuo(scene) && !isEnd) {
      const plan = duoFramePlan(scene, characters);
      const fail = async (msg: string, hint?: string) => {
        updateScene(scene.id, { imageStatus: "error", imageError: msg, imageHint: hint });
        return null;
      };
      if (!plan) {
        return await fail(
          "Duo-Bild braucht einen erkannten Sprecher und eine zweite Person.",
          "Sprecher der Szene prüfen — und das Projekt braucht mindestens zwei Charaktere.",
        );
      }
      const refOf = (name: string) => {
        const i = characters.findIndex((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
        return i >= 0 ? refs[i] : undefined;
      };
      const speakerChar = characters.find((c) => c.name.trim().toLowerCase() === plan.speaker.trim().toLowerCase());
      const listenerChar = characters.find((c) => c.name.trim().toLowerCase() === plan.listener.trim().toLowerCase());
      const speakerRef = refOf(plan.speaker);
      const listenerRef = refOf(plan.listener);
      if (!speakerChar || !listenerChar || !speakerRef || !listenerRef) {
        return await fail(
          "Für ein Duo-Bild brauchen beide Charaktere ein Referenzbild.",
          "Auf der Charakterseite für beide Personen ein Foto erzeugen/hochladen.",
        );
      }

      // Kleine eigene Retry-Schleife statt der grossen: die Softening-Varianten
      // dort sind auf die Ein-Gesicht-Prompts zugeschnitten und wuerden die
      // Duo-Anweisungen (feste Seiten, Mund zu/offen) verwaessern.
      const runPass = async (prompt: string, references: { mimeType: string; base64: string }[]) => {
        let last: unknown;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (abortRef.current) return null;
          try {
            return await generateImage(genChain, { prompt, references, aspectRatio: aspect });
          } catch (e) {
            last = e;
            if (attempt < 2) await sleep(1500);
          }
        }
        throw last;
      };

      // ── Anschluss an die Vorszene ───────────────────────────────────────
      //
      // Der Duo-Pfad kannte bisher nur die beiden Charakterfotos und startete
      // damit jede Szene bei null. Am Storyboard sichtbar: dieselben zwei
      // Personen in drei Clips mit drei Oberteilen, drei Lichtstimmungen und
      // einmal einem völlig anderen Raum. Kleidung, Licht und Ort sind
      // BILD-Eigenschaften — gegen ein Referenzbild kommt keine Textzeile an,
      // also bekommt der Duo-Pass jetzt auch eines.
      //
      // Dass dieses Bild zwei Gesichter trägt, ist hier ungefährlich (anders als
      // in den Ein-Gesicht-Szenen): beide Personen haben ihren eigenen Anker im
      // selben Request, es gibt also kein Gesicht ohne Vorlage, das sich aus dem
      // Vorgängerbild bedienen müsste.
      const duoPrev = opts.prevImageOverride !== undefined
        ? (opts.prevImageOverride
            ? { url: opts.prevImageOverride, kind: opts.prevImageKind ?? ("sceneStill" as const) }
            : null)
        : await resolvePrevSceneImage(scene.id);
      let duoPrevRef: { mimeType: string; base64: string } | null = null;
      if (duoPrev?.url) {
        try {
          const { base64, mimeType } = await urlToReferenceBase64(duoPrev.url);
          duoPrevRef = { mimeType, base64 };
        } catch { /* Nachbarbild unerreichbar — dann eben ohne, wie bisher */ }
      }

      try {
        // EIN Durchgang, beide Charakterfotos als Referenz — der Weg vom
        // Projektanfang (Nutzerentscheid 2026-08-08). Die Zwei-Pass-Kette ist
        // raus: ihr Einfüge-Edit legte das Zuhörer-Gesicht nachweislich auf
        // BEIDE Personen. Reihenfolge = Vertrag mit den "Image N"-Karten:
        // [1] Sprecher-Anker, [2] Zuhörer-Anker, [3] Vorgängerframe.
        const duoPrompt = buildDuoFramePrompt({
          scene, speaker: speakerChar, listener: listenerChar,
          speakerSide: plan.speakerSide, mainLocation,
          artStyle, colorMood, aspect, situation: reelSituationRef.current,
          // Muss zum OmniHuman-Laufzeit-Prompt passen (dort dieselbe Weiche über
          // `actionLevelRef`) — sonst hebt der Clip die Hände wieder herunter,
          // die dieses Standbild gerade hochgehalten hat.
          actionLevel: actionLevelRef.current,
          // Muss zum Laufzeit-Prompt an OmniHuman passen (siehe unten) — sonst
          // zieht der Clip die beiden wieder in die andere Inszenierung.
          // `stagingForScene` statt `duoStaging`: die CTA-Szene am Schluss
          // wendet sich ans Publikum, auch wenn der Rest ein Gespräch ist.
          staging: stagingForScene(scene),
          // Richtung mitgeben: ein Bild der NÄCHSTEN Szene ist bindend für
          // Aussehen und Ort, aber nie für Haltung und Fortschritt — als
          // „Vorgängerframe" beschrieben würde es die Handlung vorwegnehmen.
          neighbourFrame: duoPrevRef
            ? (duoPrev?.kind === "nextSceneStill" ? "next" : "prev")
            : null,
        });
        const duoImg = await runPass(duoPrompt, [
          { mimeType: speakerRef.mimeType, base64: speakerRef.base64 },
          { mimeType: listenerRef.mimeType, base64: listenerRef.base64 },
          ...(duoPrevRef ? [duoPrevRef] : []),
        ]);
        if (!duoImg || abortRef.current) return null;

        // Erfolg: exakt die Invalidierungskaskade des normalen Startbilds —
        // plus die Sprecher-Seite, an der später die OmniHuman-Maske hängt.
        delete endFrameRef.current[scene.id];
        updateScene(scene.id, {
          imageStatus: "done", imageDataUrl: duoImg,
          detailedImagePrompt: duoPrompt,
          imageError: undefined, imageHint: undefined,
          duoSpeakerSide: plan.speakerSide,
          videoStatus: "idle", videoUrl: undefined, videoJobId: undefined,
          videoJobStartedAt: undefined, videoJobKind: undefined,
          videoJobNormalize916: undefined, videoJobTrimTail: undefined,
          videoProgressPct: undefined, videoError: undefined,
          audioStatus: "idle", audioUrl: undefined, audioDurationSec: undefined,
          dubbedVideoUrl: undefined, voiceBakedIn: undefined, voiceError: undefined,
          endFrameDataUrl: undefined, endFrameUrl: undefined,
          // Ein alter Endframe stammt aus der Ein-Personen-Fassung der Szene.
          endImageStatus: "idle", endImageDataUrl: undefined,
          endImageUrl: undefined, endImageError: undefined,
        });
        if (projectId) {
          uploadAsset(credentials?.email ?? "", projectId, "generated", duoImg)
            .then((url) => updateScene(scene.id, { imageUrl: url }))
            .catch(() => { /* Spaces aus/unerreichbar — base64 trägt die Sitzung */ });
        }
        return duoImg;
      } catch (e: any) {
        if (abortRef.current) return null;
        const err = e instanceof AIError ? e : new AIError("UNKNOWN", e?.message || "Duo-Bild fehlgeschlagen.");
        let germanMsg = err.message;
        try { germanMsg = await translateErrorToGerman(err.message, genChain[0]?.key ?? ""); } catch { /* keep raw */ }
        return await fail(germanMsg, err.hint);
      }
    }

    // The previous scene's image goes in ONLY for environment / outfit / lighting
    // continuity — NOT as a face source. Chaining a face off the prev frame lets
    // small errors compound scene-to-scene (drift). What stops the drift is the
    // prompt's labelled reference-map (avatar = identity anchor, prev frame =
    // "continuity only, never a face"), NOT the image order — so the avatars stay
    // first and the prev frame last, which preserves per-scene variation.
    // `prevImageOverride === null` means "explicitly no prev" (first scene in a
    // batch); `undefined` means "look it up from state".
    const resolved = opts.prevImageOverride !== undefined
      ? (opts.prevImageOverride
          ? {
              url: opts.prevImageOverride,
              kind: opts.prevImageKind ?? ("sceneStill" as const),
              // Der Volllauf reicht IMMER das Bild der Vorszene durch — er geht
              // die Liste der Reihe nach durch. Den Guard darunter interessiert
              // nur, wessen Gesicht darauf zu sehen ist.
              fromSceneId: (() => {
                const list = scenesRef.current;
                const i = list.findIndex((x) => x.id === scene.id);
                return i > 0 ? list[i - 1].id : "";
              })(),
            }
          : null)
      : await resolvePrevSceneImage(scene.id);

    // ── Bühnen-Platten: STILLGELEGT (Nutzerentscheid 2026-08-08) ────────────
    //
    // Die menschenleeren Raum-Aufnahmen sind abgeschafft — Sprech-Szenen laufen
    // als Duo-Frame (beide Gesichter in einem Bild, Zweig oben), und die
    // wenigen verbleibenden Ein-Gesicht-Szenen nutzen wie früher das
    // Vorgängerbild mit dem prevCarriesWrongFace-Guard darunter. `plateUrl`
    // bleibt als toter Schalter stehen, damit die Folge-Logik unverändert ist.
    const twoPeople = characters.length > 1;
    const plateUrl: string | null = null;

    // OHNE Platte gilt bei zwei Personen: das Vorgängerbild darf nur mit, wenn
    // DIESELBE Person im Fokus bleibt. Am erzeugten Bild belegt: Szene 2 sollte
    // Tim zeigen (Anker war Tims Foto), gerendert wurde Leos Gesicht — dessen
    // einzige Quelle im Request war das Vorgängerbild. Alle Verbotszeilen im
    // Prompt haben das nicht verhindert; ein Bild wiegt schwerer als Text.
    // Lieber den Raum-Anschluss verlieren als die Identität.
    //
    // Gerechnet wird auf der Szene, aus der das Bild TATSÄCHLICH stammt
    // (`fromSceneId`) — seit der Vorwärts-Suche ist das nicht mehr zwangsläufig
    // die Vorszene. Über den Index hätte der Guard sonst das Gesicht der falschen
    // Szene geprüft und wäre genau dort blind, wo er gebraucht wird.
    const prevFocus = twoPeople && !plateUrl && resolved
      ? (() => {
          const list = scenesRef.current;
          const i = list.findIndex((x) => x.id === resolved.fromSceneId);
          const src = i >= 0 ? list[i] : null;
          return src ? sceneAnchorPlan(src, characters, i > 0 ? list[i - 1] : null).focus : "";
        })()
      : "";
    // GRUPPENBILD (stumme Szene, jede Person im Bild hat ihr eigenes Anker-Foto):
    // Der Guard darf hier NICHT greifen. Er schützt gegen ein Gesicht, für das
    // es im Request keine Vorlage gibt — das Vorgängerbild wäre dann dessen
    // einzige Quelle. Sind alle Anwesenden verankert, kann dieser Fall gar nicht
    // eintreten, und ohne Vorgängerbild verliert genau die Schluss-Szene ihren
    // ganzen Anschluss: anderer Tisch, andere Kleidung, anderes Licht.
    const allFacesAnchored = (castPlan?.anchorNames.length ?? 0) > 1
      && (castPlan?.describedNames.length ?? 0) === 0;
    const prevCarriesWrongFace = twoPeople && !plateUrl && !allFacesAnchored && !!castPlan?.focus
      && !!prevFocus && prevFocus.toLowerCase() !== castPlan.focus.toLowerCase();

    const prevImg = plateUrl ?? (prevCarriesWrongFace ? null : resolved?.url ?? null);
    const prevKind = plateUrl ? ("stagePlate" as const) : (resolved?.kind ?? "sceneStill");

    // Resolve the prev frame to base64 first so the prompt's reference-map order
    // matches the actual inline-image order even if the prev image is unreachable.
    // Done once and reused across retries.
    let prevRef: { mimeType: string; base64: string } | null = null;
    if (prevImg) {
      try {
        // Auf Referenzgröße stutzen: das Vorgängerbild belegt Umgebung, Outfit
        // und Licht — dafür braucht es keine volle Modellauflösung, und es hängt
        // an jedem einzelnen Szenen-Request mit dran.
        const { base64, mimeType } = await urlToReferenceBase64(prevImg);
        prevRef = { mimeType, base64 };
      } catch { /* prev image unreachable — proceed without it */ }
    }

    // Order MUST mirror buildSceneImagePrompt's reference-map: avatar identity
    // anchors first, previous frame (continuity only) last.
    //
    // NUR EIN GESICHT PRO REQUEST: Zwei Anker-Bilder im selben Aufruf vermischt
    // das Bildmodell — die Haarfarbe des einen landet am Kopf des anderen, und
    // über die Szenen driftet es weiter. Da im Bild ohnehin nur eine Person ihr
    // Gesicht zeigt, geht auch nur deren Anker mit; die Abgewandten beschreibt
    // der Prompt in Worten (`sceneAnchorPlan` entscheidet, dieselbe Funktion
    // beschriftet drüben die „Image N"-Karten).
    const anchorPlan = castPlan ?? sceneAnchorPlan(scene, characters, null);
    const anchorRefs = characters
      .map((c, i) => ({ c, ref: refs[i] }))
      .filter(({ c, ref }) => !!ref && anchorPlan.anchorNames.some((n) => n.toLowerCase() === c.name.trim().toLowerCase()))
      .map(({ ref }) => ({ mimeType: ref.mimeType, base64: ref.base64 }));
    // RÜCKEN-REFERENZEN: STILLGELEGT (Nutzerentscheid 2026-08-08, „Charaktere
    // vorne und hinten weg"). Abgewandte Personen werden wie früher rein in
    // WORTEN beschrieben; die Arrays bleiben leer, damit Referenz-Stapel und
    // „Image N"-Karten unverändert zusammenpassen.
    const backRefNames: string[] = [];
    const backRefImages: { mimeType: string; base64: string }[] = [];
    // Kein Treffer (namenlose Figuren, Altprojekt) → wie bisher alle Referenzen.
    const allRefs: { mimeType: string; base64: string }[] = anchorRefs.length
      ? [...anchorRefs, ...backRefImages]
      : refs.map((r) => ({ mimeType: r.mimeType, base64: r.base64 }));
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
        // Der Prompt muss wissen, ob das Referenzbild der Zustand VOR (Startbild
        // der Vorszene) oder NACH deren Handlung (letzter Frame ihres Clips) ist
        // — sonst behauptet er das Falsche über ein Bild, das er mitschickt.
        prevImageKind: prevKind,
        backRefNames,
        frameKind: opts.frameKind ?? "start",
        aspect,
        voiceMode: enableSpeaker ? voiceMode : "sprecher",
        // DIE Weiche für Mundbild + Blick im Standbild. Muss von hier kommen:
        // `voiceLock`/`enableSpeaker` erreichen den Prompt-Builder nicht (die
        // Zeile darüber verschleift `enableSpeaker: false` bereits zu
        // "sprecher"), und bei ai-avatar ist das Standbild die EINZIGE
        // Bildquelle des Clips — was hier fehlt, fehlt im fertigen Video.
        talkingAvatar: sceneUsesTalkingAvatar(scene),
        // Vlog: die durchgehende Situation ist der Anker, der Ort, Outfit und
        // Kameraposition über ALLE Szenen identisch hält. Über das Ref, weil der
        // Volllauf die Bilder aus einer älteren Closure heraus startet.
        reelStyle,
        situation: reelSituationRef.current,
        // Aus demselben Grund über das Ref: der Aktions-Level entscheidet in §2
        // und §3, ob die Hände im Standbild arbeiten oder ruhen — und bei
        // ai-avatar ist dieses Bild die einzige Bildquelle des Clips.
        actionLevel: actionLevelRef.current,
        isOutro: isOutroScene(scene.id),
        // Der HOOK-Frame: Szene 1 eines Reels. Bei Sprech-Szenen rendert Kling
        // `ai-avatar`, und das kennt keinen Prompt — dieses Standbild ist die
        // einzige Steuerung dafür, wie die Person im ersten Clip aussieht.
        // Nur für den START-Frame: der Endframe derselben Szene ist bereits
        // Sekunden später und nicht mehr der Moment, der das Scrollen stoppt.
        isHookScene:
          mode === "reel" &&
          (opts.frameKind ?? "start") === "start" &&
          scenesRef.current[0]?.id === scene.id,
        // Das Gegenstück: die LETZTE Szene ist der Abschluss und muss auch so
        // dastehen. Wie beim Hook nur für den Start-Frame — und über `scenesRef`,
        // weil der Volllauf die Bilder aus einer älteren Closure heraus startet
        // und `scenes` dort noch leer sein kann.
        isLastScene: (() => {
          if (mode !== "reel" || (opts.frameKind ?? "start") !== "start") return false;
          const list = scenesRef.current;
          return list.length > 1 && list[list.length - 1]?.id === scene.id;
        })(),
        // Die vorige Szene als TEXT — das Referenzbild allein sagt dem Modell
        // nicht, was gerade geschehen ist, und es lässt sonst Requisiten aus
        // dem Nichts auftauchen. Über scenesRef aus demselben Grund wie oben.
        prevScene: (() => {
          const list = scenesRef.current;
          const i = list.findIndex((x) => x.id === scene.id);
          return i > 0 ? list[i - 1] : null;
        })(),
        attempt,
      });

      try {
        const dataUrl = await generateImage(genChain, {
          prompt,
          references: allRefs,
          aspectRatio: aspect,
        });
        // HIER STAND EIN `if (abortRef.current) return null;` — und das warf ein
        // bereits erzeugtes, BEZAHLTES Bild weg, nur weil der Nutzer eine
        // Sekunde vorher „Abbrechen" gedrückt hat. Er zahlte also für ein Bild,
        // das er nie zu sehen bekam, und die Karte blieb leer zurück.
        //
        // Der Abbruch wirkt weiterhin an jedem Prüfpunkt DAVOR (oben in der
        // Schleife) und bei der nächsten Szene — er verhindert Ausgaben, statt
        // getätigte zu vernichten. Nach „Alles verwerfen" ist das ebenfalls
        // ungefährlich: der Patch sucht dann eine Szenen-ID, die es nicht mehr
        // gibt, und verpufft (siehe `clearStory`).
        if (isEnd) {
          // Der Endframe entwertet NICHTS: er gehört zu genau dem Clip, den das
          // Startbild ebenfalls beschreibt. Ihn nachzugenerieren darf deshalb
          // kein bezahltes Video wegwerfen — anders als beim Startbild unten.
          updateScene(scene.id, {
            endImageStatus: "done", endImageDataUrl: dataUrl, endImageError: undefined,
          });
        } else {
          // Der Endframe gehört zum Clip, der hier gerade verworfen wird — er muss
          // synchron mit weg. Bliebe er stehen, würde die Folgeszene an einen
          // Zustand anschließen, den kein existierender Clip mehr zeigt: ein
          // Fehler, der im Bild plausibel aussieht und praktisch nicht auffindbar
          // ist. Dieselbe Klasse Fehler wie beim `dubbedVideoUrl` unten.
          delete endFrameRef.current[scene.id];
          updateScene(scene.id, {
            imageStatus: "done", imageDataUrl: dataUrl, detailedImagePrompt: prompt,
            imageError: undefined, imageHint: undefined,
            // Neu generiertes Bild → das alte, nicht mehr passende Video entfernen,
            // sodass nur das neue Bild angezeigt wird. Die Vertonung hängt am
            // Video und muss deshalb mit weg. Das Auftrags-Handle ebenfalls:
            // sonst holte die Wiederaufnahme einen Clip zu einem Bild ab, das es
            // nicht mehr gibt.
            videoStatus: "idle", videoUrl: undefined, videoJobId: undefined,
            videoJobStartedAt: undefined, videoJobKind: undefined,
            videoJobNormalize916: undefined, videoJobTrimTail: undefined,

            videoProgressPct: undefined, videoError: undefined,
            audioStatus: "idle", audioUrl: undefined, audioDurationSec: undefined,
            // `voiceBakedIn` gehört zum Clip, der gerade ungültig wird — bliebe es
            // stehen, hielte der nächste (klassisch gerenderte) Clip sich für vertont.
            dubbedVideoUrl: undefined, voiceBakedIn: undefined, voiceError: undefined,
            endFrameDataUrl: undefined, endFrameUrl: undefined,
            // Ein neues Startbild macht den ALTEN Endframe ungültig: der zeigt das
            // Ende einer Einstellung, die es nicht mehr gibt. Ohne diese Zeile
            // bekäme Veo ein Frame-Paar aus zwei verschiedenen Aufnahmen und würde
            // sichtbar zwischen ihnen morphen.
            endImageStatus: "idle", endImageDataUrl: undefined,
            endImageUrl: undefined, endImageError: undefined,
          });
        }
        // Persist the image to the bucket so it survives reloads (best-effort —
        // falls back silently to the in-session base64 if Spaces isn't configured).
        if (projectId) {
          uploadAsset(credentials?.email ?? "", projectId, "generated", dataUrl)
            .then((url) => updateScene(scene.id, isEnd ? { endImageUrl: url } : { imageUrl: url }))
            .catch(() => { /* Spaces off/unreachable — keep base64 only */ });
        }
        return dataUrl;
      } catch (e: any) {
        lastErr = e instanceof AIError ? e : new AIError("UNKNOWN", e?.message || "Bild-Generierung fehlgeschlagen.");
        if (import.meta.env.DEV) {
          console.warn(`[SceneImage] attempt ${attempt + 1}/${MAX_IMAGE_ATTEMPTS} failed:`, lastErr.message);
        }
        // Keep the card looking like it's still loading — do NOT flip to error yet.
        updateScene(scene.id, isEnd
          ? { endImageStatus: "loading", endImageError: undefined }
          : { imageStatus: "loading", imageError: undefined, imageHint: undefined });
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
    updateScene(scene.id, isEnd
      ? { endImageStatus: "error", endImageError: germanMsg }
      : { imageStatus: "error", imageError: germanMsg, imageHint: lastErr?.hint });
    return null;
    } finally {
      // In JEDEM Fall freigeben — auch bei Abbruch, Fehler oder frühem return.
      // Sonst bliebe die Szene für den Rest der Sitzung gesperrt.
      if (owned) releaseScene(scene.id);
    }
  };

  /**
   * Den Endframe der Vorszene als STARTBILD dieser Szene übernehmen.
   *
   * Das ist die „flow"-Naht: bei `transitionToNext === "flow"` sollen der letzte
   * Frame von Clip N und der erste von Clip N+1 nicht bloß ähnlich, sondern
   * DASSELBE Bild sein — nur dann ist der Übergang wirklich unsichtbar statt
   * annähernd. Deshalb wird hier nichts generiert, sondern kopiert.
   *
   * Der Upload läuft trotzdem: die beiden Szenen bekommen zwar dieselben Pixel,
   * aber jede braucht ihre eigene durable URL, sonst hängt Szene N+1 nach einem
   * Reload an einem Feld, das zu Szene N gehört.
   */
  const adoptStartFrame = async (scene: StoryScene, dataUrl: string) => {
    updateScene(scene.id, {
      imageStatus: "done", imageDataUrl: dataUrl,
      imageError: undefined, imageHint: undefined,
      // Gleiche Invalidierung wie bei einem frisch generierten Startbild: das
      // alte Video dieser Szene fing woanders an und passt nicht mehr.
      videoStatus: "idle", videoUrl: undefined, videoJobId: undefined,
      videoJobStartedAt: undefined, videoJobKind: undefined,
      videoJobNormalize916: undefined, videoJobTrimTail: undefined,
      videoProgressPct: undefined, videoError: undefined,
      audioStatus: "idle", audioUrl: undefined, audioDurationSec: undefined,
      // `voiceBakedIn` gehört zum Clip, der gerade ungültig wird — bliebe es
      // stehen, hielte der nächste (klassisch gerenderte) Clip sich für vertont.
      dubbedVideoUrl: undefined, voiceBakedIn: undefined, voiceError: undefined,
      endImageStatus: "idle", endImageDataUrl: undefined,
      endImageUrl: undefined, endImageError: undefined,
    });
    if (projectId) {
      uploadAsset(credentials?.email ?? "", projectId, "generated", dataUrl)
        .then((url) => updateScene(scene.id, { imageUrl: url }))
        .catch(() => { /* Spaces off/unreachable — keep base64 only */ });
    }
  };

  const generateAllImages = async (opts: { onlyMissing?: boolean } = {}) => {
    // `scenesRef`, nicht `scenes`: direkt nach dem Storyboard-Lauf ruft
    // `generateFullStory` diese Funktion aus einer Closure heraus auf, die den
    // State noch leer gesehen hat. Das Ref wird synchron mitgeschrieben.
    const list = scenesRef.current;
    if (!list.length) { toast.error("Erst Storyboard generieren."); return; }
    // Nur EIN globaler Lauf gleichzeitig: ein zweiter Bild-Batch würde dieselben
    // Szenen doppelt erzeugen, und quer zu einem Video-Batch würde er dessen
    // bezahlte Clips beim Bild-Erfolg verwerfen.
    const batchToken = claimBatch("images");
    if (batchToken === null) {
      toast.info("Es läuft bereits ein Durchgang — bitte warten oder abbrechen.");
      return;
    }
    abortRef.current = false;
    const epoch = runEpochRef.current;
    setGeneratingImages(true);
    // Der Gesamtfortschritt hängt an JEDEM Bild-Durchgang, nicht nur am
    // Durchlauf-Knopf: auch wer die Etappen einzeln klickt, soll sehen, bei
    // welchem Bild von wie vielen er steht.
    beginRunPhase("images", list.filter((s) => s.imageStatus === "done").length);
    try {
      // EIN BILD PRO SZENE — der Stand vom Projektanfang (Nutzerentscheid
      // 2026-08-08): kein generierter Endframe mehr („Szene vorne und hinten"
      // ist weg), keine Bühnen-Platten, keine Rücken-Referenzen. Kling rendert
      // mit dem Startbild allein; die „flow"-Naht über adoptStartFrame entfällt
      // damit (Reels sind ohnehin immer "cut"). Sequenziell nur noch wegen der
      // Kontinuitäts-Referenz aufs Vorgängerbild.
      let prevImg: string | null = null;      // Kontinuitäts-Referenz (Umgebung/Licht)
      // Zweite Kette für die Bilder mit MEHREREN Gesichtern (Duo- und
      // Gruppenbilder). Sie dürfen nicht in `prevImg` landen — für eine
      // Ein-Gesicht-Szene sind sie die schlimmste denkbare Vorlage. Für ein
      // stummes Gruppenbild sind sie umgekehrt die BESTE: dieselben zwei
      // Personen, derselbe Ort, dieselbe Kleidung. Ohne diese Kette bekam die
      // Schluss-Szene eines Duo-Reels gar keine Anschluss-Referenz.
      let prevMultiFaceImg: string | null = null;

      for (const s of list) {
        // „Abbrechen" ODER „Alles verwerfen" — Letzteres auch dann noch, wenn
        // inzwischen ein neuer Lauf `abortRef` wieder auf false gesetzt hat.
        if (abortRef.current || epoch !== runEpochRef.current) break;

        // Szene reservieren: solange der Batch an ihr arbeitet, sind Einzel-
        // Aktionen auf derselben Szene gesperrt (und umgekehrt — eine Szene, die
        // der Nutzer gerade einzeln rendert, überspringt der Batch).
        if (!claimScene(s.id)) continue;
        try {
        const hasStart = s.imageStatus === "done" && (!!s.imageDataUrl || !!s.imageUrl);
        const duo = sceneIsDuo(s);
        // Zeigt DIESES Bild mehrere Gesichter? Duo-Szene oder stummes
        // Gruppenbild — beide gehören in die zweite Kette, nicht in `prevImg`.
        const groupStill = sceneIsGroupStill(s);
        const multiFace = duo || groupStill;
        if (opts.onlyMissing && hasStart) {
          // Ein Duo-Bild taugt NICHT als Kontinuitäts-Referenz der Folgeszene:
          // es trägt zwei Gesichter — die schlimmste denkbare Bildquelle für
          // die Ein-Gesicht-Szenen danach. prevImg bleibt dann unverändert.
          const done = s.imageDataUrl || s.imageUrl;
          if (multiFace) prevMultiFaceImg = done || prevMultiFaceImg;
          else prevImg = done || prevImg;
          continue;
        }

        // Nachgenerierte (fehlende) Szenen sind schon einmal gescheitert → direkt
        // mit einer stark entschärften, umformulierten Prompt-Variante starten.
        const startUrl = await generateSceneImage(s, {
          // Bilder MIT mehreren Gesichtern (Duo, stummes Gruppenbild) schliessen
          // aneinander an — dort hat jede Person ihren eigenen Anker, das
          // Vorgängerbild trägt nur Kleidung, Licht und Raum bei. Die
          // Ein-Gesicht-Szenen bleiben auf ihrer eigenen Kette.
          prevImageOverride: multiFace ? (prevMultiFaceImg ?? prevImg) : prevImg,
          minAttempt: opts.onlyMissing ? 2 : 0,
          fromBatch: true,
        });
        if (!startUrl || abortRef.current) continue;
        if (multiFace) prevMultiFaceImg = startUrl;
        else prevImg = startUrl;
        } finally {
          releaseScene(s.id);
        }
      }
    } finally {
      setGeneratingImages(false);
      endRunPhase("images");
      releaseBatch(batchToken);
    }
  };

  /**
   * Voice-Lock: Sprechtext → TTS → auf den Clip legen.
   *
   * Läuft IMMER gegen ein bereits vorhandenes Video (kein Veo-Call), damit sich
   * eine Szene neu vertonen lässt, ohne sie neu zu rendern. Fehler bleiben
   * bewusst weich: der rohe Clip ist noch da und bleibt nutzbar.
   * Gibt die URL des fertig vertonten Clips zurück (oder undefined).
   */
  const voiceScene = async (
    scene: StoryScene,
    opts: { videoOverride?: string; fromBatch?: boolean } = {},
  ): Promise<string | undefined> => {
    // Avatar-Szenen tragen die Stimme IM Clip — es gibt keine Tonspur, die sich
    // nachträglich austauschen ließe. „Neu vertonen" heißt hier deshalb: neu
    // rendern. Bewusst VOR dem Claim, damit `generateSceneVideo` die Szene selbst
    // beanspruchen kann; sonst blockierte sie sich gegen sich selbst.
    //
    // `videoOverride` schließt den Fall aus, in dem `generateSceneVideo` diese
    // Funktion nach einem KLASSISCH gerenderten Clip aufruft (der Rückfall, wenn
    // ai-avatar ausgefallen ist). Ohne diese Bedingung riefen sich beide
    // gegenseitig endlos auf.
    if (sceneUsesTalkingAvatar(scene) && !opts.videoOverride) {
      return await generateSceneVideo(scene, { fromBatch: opts.fromBatch });
    }

    // Ohne Guard vertont ein Klick auf „Neu vertonen" den ALTEN Clip, während
    // nebenan schon der neue rendert — und der fertige Video-Lauf vertont gleich
    // selbst. Zwei konkurrierende Dubs, und `dubbedVideoUrl` gewinnt zufällig.
    const ownsVoice = !opts.fromBatch && !opts.videoOverride;
    if (ownsVoice) {
      const blocked = generationBlocked();
      if (blocked) { toast.info(blocked); return undefined; }
      const live = scenesRef.current.find((x) => x.id === scene.id) ?? scene;
      if (live.videoStatus === "loading") {
        toast.info(`Szene ${sceneNumber(scene.id)}: Das Video rendert gerade — es wird danach automatisch vertont.`);
        return undefined;
      }
      if (!claimScene(scene.id)) return undefined;
      abortRef.current = false; // Merker des vorigen Laufs — siehe generateSceneImage.
    }
    try {
    // scenesRef statt `scenes`: im verschränkten Lauf ist das Szenen-Array der
    // Closure leer, und dann hieße jede Meldung „Szene 0" — und `index` (geht in
    // renderSceneVoice) wäre für jede Szene 0.
    const sceneList = scenesRef.current;
    const idx = sceneList.findIndex((x) => x.id === scene.id);
    const sceneNo = (idx < 0 ? 0 : idx) + 1;
    const sourceVideo = opts.videoOverride || scene.videoUrl;
    // Die Abbruchgründe werden mit an die Szene geschrieben, nicht nur getoastet:
    // sonst bleibt `audioStatus` undefined, die Karte zeigt kein „Stimme fehlt",
    // und der Fehlzustand ist nach einem Reload spurlos weg — bei stummen Clips.
    if (!sourceVideo) {
      toast.error(`Szene ${sceneNo}: Kein Video zum Vertonen.`);
      updateScene(scene.id, { audioStatus: "error", voiceError: "Kein Video zum Vertonen." });
      return undefined;
    }
    if (!scene.dialogText?.trim()) {
      toast.error(`Szene ${sceneNo}: Kein Sprechtext vorhanden.`);
      updateScene(scene.id, { audioStatus: "error", voiceError: "Kein Sprechtext vorhanden." });
      return undefined;
    }
    // TTS laeuft ueber fal ODER ueber den eigenen ElevenLabs-Key; der ffmpeg-Dub
    // braucht gar keinen Key. Der frueher hier stehende `!falKey` warf deshalb
    // eine bereits erzeugte, bezahlte Tonspur weg und liess den rohen Clip mit
    // der Modellstimme stehen.
    if (!falKey && !elevenKey) {
      toast.error("Feste Sprecherstimme braucht einen fal.ai- oder ElevenLabs-Key — Einstellungen öffnen.");
      updateScene(scene.id, { audioStatus: "error", voiceError: "Feste Sprecherstimme braucht einen fal.ai- oder ElevenLabs-Key." });
      return undefined;
    }

    // Den alten Dub sofort fallen lassen: scheitert die neue Vertonung, wäre er
    // über `sceneFinalVideo` sonst weiter maßgeblich — mit dem ALTEN Sprechtext.
    // Ab hier entsteht ein NACHTRÄGLICHER Dub — was auch immer vorher im Clip
    // steckte, gilt nicht mehr.
    updateScene(scene.id, { audioStatus: "loading", voiceError: undefined, dubbedVideoUrl: undefined, voiceBakedIn: undefined });
    try {
      const live = await voiceConfigNow();
      const tts = await renderSceneVoice({
        scene, scenes: sceneList, index: idx < 0 ? 0 : idx,
        config: live.config, falKey, elevenKey, elevenVoiceIds: live.elevenVoiceIds,
      });
      // Die Spur genauso durable ablegen wie Bild/Video — sonst lässt sich nach
      // einem Reload nicht mehr nachvollziehen, was gesprochen wurde. Schlägt
      // der Upload fehl: data-URL behalten (wie beim Video).
      let audioUrl = tts.audioDataUrl;
      if (projectId) {
        try {
          audioUrl = await uploadAsset(credentials?.email ?? "", projectId, "audio", tts.audioDataUrl);
        } catch { /* Spaces off/unreachable — keep the data URL */ }
      }
      updateScene(scene.id, { audioUrl, audioDurationSec: tts.durationSec ?? undefined });

      const dub = await dubSceneVideo({
        videoUrl: sourceVideo,
        audioDataUrl: tts.audioDataUrl,
        // Dialog: die sichtbare Person soll die neue Stimme auch wirklich
        // sprechen → zusätzlich durch das Lipsync-Modell.
        // Vlog: dort spricht die sichtbare Person IMMER selbst in die Linse —
        // auch im Sprecher-Modus (Bild- und Video-Prompt bauen genau darauf auf).
        // Ohne Lipsync läge die TTS-Spur unter einer nicht passenden
        // Mundbewegung, statt sie zu treffen.
        // ERZÄHL-FOKUS: im GANZEN Reel-Modus spricht die sichtbare Person selbst
        // — nicht mehr nur im Vlog. Vorher lief der „Erzähler"-Stil im
        // Sprecher-Modus ohne Lipsync: die Off-Stimme lief über eine stumme
        // Person, und der Mund bewegte sich sichtbar falsch. Genau der Fehler.
        // Lipsync laeuft ueber fal — ohne fal-Key gibt es ihn nicht.
        needsLipsync: (voiceMode === "dialog" || mode === "reel") && !!falKey,
        falKey,
        // Lipsync kürzt still auf die Cliplänge — nur mit diesen beiden Dauern
        // kann `truncated` auch im Dialog-Modus stimmen (im Sprecher-Modus
        // rechnet der Dub-Endpoint es selbst aus). Die Cliplänge ist 5 ODER 10s
        // — Klings einzige beiden Werte, siehe `durationSeconds` in
        // generateSceneVideo.
        audioDurationSec: tts.durationSec ?? undefined,
        clipDurationSec: scene.videoDurationSec ?? 10,
      });
      let dubbedUrl = dub.videoUrl || dub.videoDataUrl!;
      if (projectId) {
        try {
          dubbedUrl = await uploadAsset(credentials?.email ?? "", projectId, "videos", dubbedUrl);
        } catch { /* keep the source URL */ }
      }
      updateScene(scene.id, { audioStatus: "done", dubbedVideoUrl: dubbedUrl, voiceError: undefined });
      if (dub.truncated) {
        toast.warning(`Szene ${sceneNo}: Sprechtext war länger als der Clip — das Satzende fehlt im Video. Zeile kürzen.`);
      }
      // Der Zweig „Lipsync ausgefallen, nur der Ton wurde getauscht" ist weg:
      // `dubSceneVideo` fällt nicht mehr still auf den reinen Dub zurück,
      // sondern wirft. Diese Meldung konnte also nur noch einen Zustand
      // beschreiben, den es nicht mehr gibt.
      return dubbedUrl;
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e?.message || "Vertonung fehlgeschlagen.");
      // KEIN videoStatus:"error" — das Video ist fertig, nur die Stimme fehlt.
      updateScene(scene.id, { audioStatus: "error", voiceError: err.message });
      toast.warning(`Szene ${sceneNo}: Vertonung fehlgeschlagen — ${err.message}`, {
        description: "Der Clip bleibt nutzbar — die Vertonung lässt sich einzeln neu starten.",
      });
      return undefined;
    }
    } finally {
      if (ownsVoice) releaseScene(scene.id);
    }
  };

  /**
   * Den letzten Frame eines fertigen Clips sichern — die Übergabe an die
   * nächste Szene.
   *
   * Bewusst KLEIN und als JPEG: der Frame geht als Referenzbild in einen
   * Image-Gen-Request, ein volles 1080x1920-PNG wären mehrere MB base64. Für
   * eine reine ZUSTANDS-Referenz (Haltung, Position, Requisiten) reicht 1024px
   * mühelos — das Gesicht wird von dort ohnehin nie kopiert (siehe
   * Referenzkarte im Prompt).
   *
   * Fehler sind IMMER weich: der Aufrufer fällt dann auf das Szenenbild zurück
   * und verhält sich für diese eine Naht exakt wie bisher.
   */
  const captureEndFrame = async (sceneId: string, clipUrl: string): Promise<string | null> => {
    if (!carryOverActive) return null;
    try {
      const frame = await extractLastFrame(clipUrl, {
        mimeType: "image/jpeg",
        quality: 0.9,
        maxLongEdge: 1024,
        timeoutMs: 12000,
        // Der allerletzte Frame eines lipsyncten Clips zeigt oft eine halb
        // geöffnete, neu gerenderte Mundpartie. Für eine Zustandsreferenz
        // belanglos, aber gratis sauberer.
        offsetMs: 120,
      });
      // SYNCHRON ins Ref: der verschränkte Lauf liest den Frame in derselben
      // Closure wieder aus, ein setScenes wäre dort noch nicht sichtbar.
      endFrameRef.current[sceneId] = frame;
      updateScene(sceneId, { endFrameDataUrl: frame });
      // Durable ablegen, damit der Anschluss einen Reload überlebt — der
      // Sanitizer wirft `endFrameDataUrl` bewusst aus dem Snapshot (Quota).
      // Best effort, exakt wie beim Szenenbild.
      if (projectId) {
        uploadAsset(credentials?.email ?? "", projectId, "generated", frame)
          .then((url) => updateScene(sceneId, { endFrameUrl: url }))
          .catch(() => { /* Spaces aus/unerreichbar — base64 reicht für die Session */ });
      }
      return frame;
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[CarryOver] end-frame extract failed:", err);
      const no = scenesRef.current.findIndex((x) => x.id === sceneId) + 1;
      // Häufigste ECHTE Ursache: der Clip liegt nicht im Projektspeicher, weil
      // der Spaces-Upload fehlgeschlagen ist (der wird sonst nur in DEV
      // geloggt). Die ephemere fal/Veo-URL liefert typischerweise keinen
      // ACAO-Header → tainted canvas → Wurf. Ohne diese Unterscheidung sucht
      // der Nutzer den Fehler bei der Frame-Extraktion statt beim Upload.
      const notInBucket = !clipUrl.startsWith("data:") && !clipUrl.startsWith(SPACES_PUBLIC_BASE);
      toast.warning(
        notInBucket
          ? `Szene ${no}: Clip liegt nicht im Projektspeicher — Anschluss-Frame nicht lesbar.`
          : `Szene ${no}: Anschluss-Frame nicht lesbar — nächste Szene nutzt das Szenenbild.`,
      );
      return null;
    }
  };

  /**
   * Sprechenden Clip für eine Szene rendern (Spec „Talking-Avatar-Video", Format A).
   *
   * Reihenfolge umgedreht gegenüber der Veo-Strecke: ERST die Stimme, DANN das
   * Bild-zu-Video. Die Cliplänge fällt damit aus dem Audio heraus, statt hinterher
   * gegen eine geratene Länge zu laufen.
   *
   * Die Vertonung läuft ABSICHTLICH über `renderSceneVoice` — also über exakt
   * dieselbe Funktion wie der klassische Weg. Nur so gelten im Avatar-Modus
   * weiterhin Delivery-Tags pro Szene, Modellwahl (v2/v3), Tempo, Stabilität und
   * die Sprecher-Zuordnung im Dialog. Der Server könnte das nicht nachbilden,
   * ohne die Einstellungen des Voice-Pickers still zu übergehen.
   *
   * Wirft bei Fehlern — der Aufrufer entscheidet dann über den Rückfall auf die
   * klassische Kette.
   */
  const renderTalkingAvatarScene = async (
    scene: StoryScene,
    startImageDataUrl: string,
    sceneNo: number,
  ): Promise<{ videoUrl: string; audioUrl: string; durationSec: number | null }> => {
    const sceneList = scenesRef.current;
    const idx = sceneList.findIndex((x) => x.id === scene.id);

    // Duo-Szene ohne festgeschriebene Sprecher-Seite: das Bild stammt noch aus
    // der Ein-Personen-Fassung. Hart abbrechen, BEVOR TTS und Render Geld
    // kosten — eine geratene Maske hiesse, die falsche Person spricht.
    if (sceneIsDuo(scene) && !scene.duoSpeakerSide) {
      throw new AIError(
        "NO_REFERENCE",
        "Das Startbild dieser Duo-Szene zeigt noch nicht beide Personen.",
        "Erst „Bild neu“ ausführen — das erzeugt das Duo-Bild, dann den Clip starten.",
      );
    }

    // 1. Stimme. `audioStatus` schon hier mitführen, damit die Karte während des
    //    (langen) Laufs nicht „Stimme fehlt" zeigt, obwohl sie gerade entsteht.
    updateScene(scene.id, { audioStatus: "loading", voiceError: undefined, videoPhase: "voice" });
    const live = await voiceConfigNow();
    const tts = await renderSceneVoice({
      scene, scenes: sceneList, index: idx < 0 ? 0 : idx,
      config: live.config, falKey, elevenKey, elevenVoiceIds: live.elevenVoiceIds,
    });
    // Ab hier gehen Ton und Bild zu fal — der naechste sichtbare Schritt.
    updateScene(scene.id, { videoPhase: "upload" });

    // Die Spur durable ablegen wie Bild und Video — sonst ist nach einem Reload
    // nicht mehr nachvollziehbar, was gesprochen wurde. Best effort, wie überall.
    let durableAudioUrl = tts.audioDataUrl;
    if (projectId) {
      try {
        durableAudioUrl = await uploadAsset(credentials?.email ?? "", projectId, "audio", tts.audioDataUrl);
      } catch { /* Spaces aus/unerreichbar — data-URL behalten */ }
    }
    updateScene(scene.id, { audioUrl: durableAudioUrl, audioDurationSec: tts.durationSec ?? undefined });

    // 2. Startbild auf das Zielformat beschneiden — derselbe Grund wie in der
    //    Veo-Strecke: ein off-ratio Bild ergäbe einen Clip mit schwarzen Balken.
    //    Bei ai-avatar bestimmt das Bild das Ausgabeformat sogar allein, es gibt
    //    kein `aspect_ratio`-Feld, das man danach noch korrigieren könnte.
    const videoRatio = videoAspect(aspect);
    const croppedImage = await cropDataUrlToAspect(startImageDataUrl, videoRatio);

    // Duo-Szene → OmniHuman: Maske aus dem GECROPPTEN Bild bauen (sie muss
    // dessen Abmessungen exakt treffen) — weisse Haelfte = Sprecher-Seite, die
    // beim Bildlauf festgeschrieben wurde. Der Prompt stuetzt nur noch die
    // Rollenverteilung; die Sprecherwahl traegt allein die Maske.
    let duoMaskDataUrl: string | undefined;
    let duoPrompt: string | undefined;
    const isDuoScene = sceneIsDuo(scene);
    if (isDuoScene && scene.duoSpeakerSide) {
      duoMaskDataUrl = await makeSideMaskDataUrl(croppedImage, scene.duoSpeakerSide);
      const dp = duoFramePlan(scene, characters);
      // Der Prompt muss dasselbe Format behaupten wie das Standbild, sonst zieht
      // das Videomodell die beiden im Clip wieder in die andere Inszenierung.
      // „calm" ist in beiden Fassungen raus — es arbeitete gegen Deliveries wie
      // Energisch oder Dringlich. Die Sprecherwahl traegt weiter allein die Maske.
      const who = dp?.speaker ?? `the person on the ${scene.duoSpeakerSide}`;
      // OmniHuman NIMMT einen Prompt — anders als Kling ai-avatar, das nur Bild
      // und Audio kennt. fal empfiehlt dafür die Reihenfolge
      // [Kamera] + [Stimmung] + [Sprechzustand] + [Handlung]; danach ist dieser
      // Prompt aufgebaut. Die Stimmung fehlte hier bisher ganz, obwohl die Szene
      // sie mitbringt — der Clip war dadurch ausdrucksloser als sein Standbild.
      const emo = (scene.emotion || "").trim();
      // KAMERAFAHRT NUR ALS LANGSAMER PUSH-IN AUF DIE BILDMITTE — und nur, wenn
      // die Szene sie ausdrücklich will. Der Grund ist die Maske: sie ist ein
      // starrer Halbbild-Schnitt und wandert NICHT mit. Ein Zoom auf die Mitte
      // ist der einzige Weg, der sie nicht verletzt, weil er beide Personen nach
      // AUSSEN schiebt — jede bleibt dabei auf ihrer Seite. Orbit, Schwenk oder
      // Seitenfahrt würden den Sprecher aus der weissen Hälfte tragen, und dann
      // animiert das Modell den falschen Mund.
      const camera = scene.movement === "dolly-in"
        ? "The camera pushes in slowly and steadily towards the centre of the frame, staying on the same axis — no pan, no tilt, no orbit, no sideways travel. Both people stay on their own side of the frame throughout. "
        : "The camera does not move. ";
      const mood = emo
        ? `The mood is ${emo}, clearly visible on ${who}'s face. `
        : "";
      // `stagingForScene` statt `duoStaging`: die letzte Szene trägt den
      // Call-to-Action, und der geht ans Publikum. Sie läuft deshalb in der
      // Kamera-Fassung — dieselbe Entscheidung wie beim Standbild, aus derselben
      // Funktion, damit Bild und Clip nicht auseinanderlaufen können.
      // HÄNDE RUHIG, GESICHT VOLL DA.
      //
      // Hier stand „expressive gestures" — in BEIDEN Fassungen, also in jedem
      // Duo-Clip. Zusammen mit der Gesten-Pflicht im Standbild ergab das eine
      // Person, die jeden einzelnen Satz mit den Händen unterstreicht. Der
      // Ausdruck bleibt ausdrücklich gross („clearly readable facial
      // expression", plus `mood` davor) — reduziert wird nur die Gestik.
      // AKTIONS-LEVEL — dieselbe Weiche wie im Duo-Standbild (`buildDuoFramePrompt`).
      // Sie MUSS hier stehen: Sagt nur das Bild „Hände hoch" und der Clip
      // weiterhin „Hände ruhig", zieht der Clip sie in der ersten Sekunde wieder
      // herunter, und die bezahlte Geste ist weg.
      // DIE MITTELLINIE BLEIBT IN BEIDEN FASSUNGEN: Die OmniHuman-Maske
      // schneidet starr bei w/2 — ein Arm über die Mitte legt den Sprecher
      // teilweise in die falsche Hälfte, und dann bewegt der Falsche den Mund.
      const handsLine = actionLevelRef.current === "active"
        ? `Their hands are active and clearly visible: they gesture broadly while speaking — pointing, open palms, ` +
          `counting on fingers, holding something up at chest height — with the arms staying on their own side of ` +
          `the frame, never crossing the vertical centre line and never in front of their own face. `
        : `Their hands stay calm and mostly still — no pointing, no raised palms, no counting fingers, no wide arm ` +
          `movement. At most one small, unforced hand movement in the whole clip. `;
      duoPrompt = stagingForScene(scene) === "conversation"
        ? camera + mood +
          `Two people in a lively conversation with each other. Only ${who} speaks, with natural mouth movement and ` +
          `a clearly readable facial expression. ${handsLine}The other person listens, mouth closed, with ` +
          `natural reactions on the face only. They keep looking at each other and neither turns to the camera.`
        : camera + mood +
          `Two people standing side by side, presenting straight to camera. Only ${who} speaks, looking into the ` +
          `lens the whole time, with natural mouth movement and a lively facial expression. ${handsLine}The ` +
          `other person stays silent, mouth closed, facing the camera as well, reacting with the face only. ` +
          `Neither of them turns to face the other, and neither turns away from the lens.`;
    }

    // Ab hier laeuft die AVATAR-Strecke. Die Nacharbeit-Flags des Polls muessen
    // mitgespeichert werden — nach einem Reload sind sie sonst weg, und der
    // wiederaufgenommene Clip kaeme unnormalisiert und mit Klings Standbild-
    // Schwanz zurueck.
    updateScene(scene.id, {
      videoJobId: undefined,
      videoJobStartedAt: Date.now(),
      videoJobKind: "avatar",
      videoJobNormalize916: videoRatio === "9:16",
      videoJobTrimTail: true,
      videoPhase: "queue",
    });

    const talk = await runTalkingAvatarJob(
      {
        imageDataUrl: croppedImage,
        audioDataUrl: tts.audioDataUrl,
        audioDurationSec: tts.durationSec,
        apiKey: falKey,
        // Duo-Szenen laufen über OmniHuman (Maske = Sprecherwahl); alles andere
        // bleibt unverändert auf Kling ai-avatar.
        ...(isDuoScene ? { engine: "omnihuman" as const, maskDataUrl: duoMaskDataUrl, prompt: duoPrompt } : {}),
        // Spec Schritt 5 normalisiert auf 1080×1920 — das ist ein 9:16-Crop und
        // würde ein 16:9- oder 1:1-Projekt zerschneiden. Deshalb NUR dort, wo das
        // Zielformat ohnehin 9:16 ist; sonst behält der Clip das Format des Bildes.
        normalize916: videoRatio === "9:16",
        // Kling hängt hinter das letzte Wort Stille + eingefrorenes Bild — an einem
        // echten Reel gemessen 0,9–2,5 s pro Clip, in Summe ein Viertel der
        // Gesamtlänge. Im Schnitt liest sich das als „das Video pausiert an jedem
        // Schnitt". Wird serverseitig am ENDE gekappt, wo der Mund stillsteht;
        // dadurch verschiebt sich nichts und die Lippen bleiben synchron.
        trimTail: true,
      },
      (p) => {
        updateScene(scene.id, {
          videoStatus: p.status === "completed" ? "done" : "loading",
          // Der Tick-Zaehler steuert den Balken NICHT mehr (das war die Quelle
          // des Einfrierens bei 95 %) — er sagt nur noch, in welchem Schritt wir
          // sind. Den Verlauf innerhalb des Schritts macht die Uhr in
          // `SceneBusyBar`. Welcher Schritt das IST, sagt jetzt der Server:
          // vorher stand hier fest „render", auch wenn der Auftrag noch in der
          // Warteschlange stand oder schon nachbearbeitet wurde.
          videoPhase: p.phase ? SERVER_PHASE_TO_VIDEO_PHASE[p.phase] : "render",
          videoJobId: p.handle,
          // Die GETRIMMTE Sprechdauer sofort festschreiben, nicht erst am Ende
          // des Laufs. In der Szene steht bis hierher die ungetrimmte Dauer aus
          // dem TTS-Lauf; bricht die Sitzung jetzt ab, holt die Wiederaufnahme
          // zwar den Clip, aber keine Dauer mehr — und der Schnitt am Clipende
          // säße hinter dem letzten Wort, also wirkungslos.
          ...(p.audioDurationSec != null ? { audioDurationSec: p.audioDurationSec } : {}),
        });
      },
    );

    // Der Auftrag ist durch — jetzt wird der fertige Clip abgelegt.
    updateScene(scene.id, { videoPhase: "store" });

    // 3. Den fertigen Clip durable ablegen. Ohne das bliebe bei normalisierten
    //    Clips eine mehrere MB große data:-URL im Zustand stehen.
    let durableVideoUrl = talk.videoUrl;
    if (projectId) {
      try {
        durableVideoUrl = await uploadAsset(credentials?.email ?? "", projectId, "videos", talk.videoUrl);
      } catch (e) {
        if (import.meta.env.DEV) console.warn("[ai-avatar] Spaces-Upload fehlgeschlagen, behalte Quell-URL:", e);
      }
    }

    if (import.meta.env.DEV) {
      console.log(`[ai-avatar] Szene ${sceneNo}: ${talk.modelUsed}, ${talk.audioDurationSec ?? "?"}s`);
    }
    return {
      videoUrl: durableVideoUrl,
      audioUrl: durableAudioUrl,
      durationSec: talk.audioDurationSec ?? tts.durationSec ?? null,
    };
  };

  /**
   * Nacharbeit nach einem fertigen KLASSISCHEN Clip: festschreiben, vertonen.
   *
   * Eigene Funktion, weil sie von zwei Seiten gebraucht wird — vom Live-Lauf und
   * von der Wiederaufnahme nach einem Reload. Ohne sie waere die Wiederaufnahme
   * eine Kopie dieses Blocks, und die beiden liefen sofort auseinander.
   *
   * `videoJobId` faellt hier weg: der Auftrag ist erledigt, ein stehendes Handle
   * wuerde die naechste Sitzung zu einer sinnlosen Abholung verleiten.
   */
  const finishVeoScene = async (
    scene: StoryScene,
    durableVideoUrl: string,
    o: { sceneNo: number; videoPrompt?: string; durationSec?: number },
  ): Promise<string> => {
    updateScene(scene.id, {
      videoStatus: "done",
      videoUrl: durableVideoUrl,
      videoProgressPct: 100,
      videoJobId: undefined,
      videoError: undefined,
      // Nur SETZEN, was gesetzt ist — `updateScene` ist ein Merge, ein
      // durchgereichtes `undefined` wuerde den persistierten Wert loeschen.
      ...(o.videoPrompt != null ? { videoPrompt: o.videoPrompt } : {}),
      ...(o.durationSec != null ? { videoDurationSec: o.durationSec } : {}),
    });
    toast.success(`Szene ${o.sceneNo}: Video bereit.`);
    // Voice-Lock: der Veo-Clip ist bewusst ohne (bzw. mit beliebiger) Stimme
    // gerendert — die feste Stimme kommt jetzt aus TTS obendrauf. Fehler dort
    // kippen die Szene NICHT auf videoStatus:"error", das Video ist ja da.
    let finalVideoUrl = durableVideoUrl;
    if (sceneNeedsVoice(scene)) {
      // Die gerenderte Länge mitgeben — der lokale `scene` trägt sie noch nicht
      // (nur der State via updateScene), die Truncation-Prüfung braucht sie.
      const dubbedUrl = await voiceScene(
        { ...scene, videoDurationSec: o.durationSec ?? scene.videoDurationSec },
        { videoOverride: durableVideoUrl },
      );
      if (dubbedUrl) finalVideoUrl = dubbedUrl;
    }
    return finalVideoUrl;
  };

  const generateSceneVideo = async (
    scene: StoryScene,
    opts: { fromBatch?: boolean } = {},
  ) => {
    if (!plan.videoGen) {
      toast.error("Video-Generierung benötigt mindestens Premium.");
      return;
    }
    // Ohne Guard startet ein zweiter Klick einen zweiten Veo-/Kling-Job für
    // dieselbe Szene — beide werden berechnet, einer gewinnt zufällig.
    const ownsVideo = !opts.fromBatch;
    if (ownsVideo) {
      const blocked = generationBlocked();
      if (blocked) { toast.info(blocked); return; }
      const live = scenesRef.current.find((x) => x.id === scene.id) ?? scene;
      if (live.imageStatus === "loading" || live.endImageStatus === "loading") {
        toast.info(`Szene ${sceneNumber(scene.id)}: Die Bilder werden gerade erzeugt — das Video startet danach.`);
        return;
      }
      if (!claimScene(scene.id)) return;
      abortRef.current = false; // Merker des vorigen Laufs — siehe generateSceneImage.
    }
    try {
    // Beide Frames kommen aus der Szene selbst — nicht mehr als Parameter von
    // außen. Das war die eigentliche Fessel des alten Modells: nur der
    // sequenzielle Batch konnte Overrides liefern, also rannte jeder andere
    // Aufruf (Einzelbutton, Parallel-Lauf) still ohne Endframe.
    let startImageDataUrl = scene.imageDataUrl;
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

    // Endframe: symmetrisch aufgelöst, aber WEICH — fehlt er, rendert der Clip
    // eben ohne vorgegebenes Ende, statt die Szene zu blockieren. Die
    // Rehydrierung aus `endImageUrl` ist der einzige Weg, wie der Endframe einen
    // Reload übersteht (die base64 wird bewusst nicht persistiert).
    let endImageDataUrl = scene.endImageDataUrl;
    if (!endImageDataUrl && scene.endImageUrl) {
      try {
        const { base64, mimeType } = await urlToBase64(scene.endImageUrl);
        endImageDataUrl = `data:${mimeType};base64,${base64}`;
      } catch { /* ohne Endframe weiter */ }
    }

    // Video läuft ausschließlich über Kling (fal.ai) — ein Google-Key allein
    // erzeugt keine Clips mehr. Das muss die Meldung auch so sagen, sonst sucht
    // der Nutzer den Fehler bei einem Key, der hier gar nichts mehr tut.
    if (!falKey) {
      toast.error("Kein fal.ai-Key gesetzt — Clips laufen über Kling (fal.ai).", {
        description: "Einstellungen öffnen und den fal.ai-Key eintragen.",
      });
      return;
    }
    const klingKey = falKey;

    // In continuity mode the override frame IS the scene's image now — show it
    // immediately so the UI reflects the new start frame while Kling renders.
    const patch: Partial<StoryScene> = {
      videoStatus: "loading", videoProgressPct: 0, videoError: undefined,
      // Neuer Clip → die alte Vertonung gehört nicht mehr dazu (wie in
      // generateSceneImage). Ohne das bliebe `dubbedVideoUrl` stehen und
      // `sceneFinalVideo` lieferte überall (Preview, Download, Merge,
      // Frame-Extraktion) weiter den ALTEN vertonten Clip — das neue Video wäre
      // nirgends erreichbar. Bewusst schon hier, nicht erst nach Erfolg: auch ein
      // mittendrin abgebrochener Veo-Lauf darf den alten Dub nicht behalten.
      audioStatus: "idle", audioUrl: undefined, audioDurationSec: undefined,
      // `voiceBakedIn` gehört zum Clip, der gerade ungültig wird — bliebe es
      // stehen, hielte der nächste (klassisch gerenderte) Clip sich für vertont.
      dubbedVideoUrl: undefined, voiceBakedIn: undefined, voiceError: undefined,
      // Neuer Clip in Arbeit → der Endframe des ALTEN Clips ist tot. Bewusst
      // schon hier, aus demselben Grund wie beim Dub darüber: es darf nie ein
      // Fenster geben, in dem ein Endframe zu einem Clip gehört, den es nicht
      // mehr gibt — die Folgeszene würde sonst an einen erfundenen Zustand
      // anschließen.
      endFrameDataUrl: undefined, endFrameUrl: undefined,
      // ── Wiederaufnahme nach einem Reload ────────────────────────────────
      // Das alte Handle MUSS hier weg: bliebe es stehen, holte die naechste
      // Sitzung den Clip des VORIGEN Laufs ab und schriebe ihn als Ergebnis
      // dieses Laufs fest. Die Strecke wird in `runOnce` bzw. im Avatar-Zweig
      // genauer gesetzt.
      videoJobId: undefined,
      videoJobStartedAt: Date.now(),
      // "veo" ist hier nur noch der PERSISTIERTE Name der klassischen Strecke
      // (Bewegungs-Prompt statt Bild+Ton) — gerendert wird sie von Kling. Der
      // Wert bleibt, weil er in gespeicherten Projekten steht und die
      // Wiederaufnahme nur „avatar" gegen „alles andere" unterscheidet.
      videoJobKind: "veo",
      videoJobNormalize916: false,
      videoJobTrimTail: false,
    };
    delete endFrameRef.current[scene.id];
    // Der Block, der hier früher einen übergebenen Startframe als Szenenbild
    // festschrieb, ist ersatzlos entfallen: das Startbild IST jetzt das der
    // Szene, es gibt nichts mehr zu überschreiben.
    updateScene(scene.id, patch);

    try {
      // ÜBER scenesRef, NICHT über `scenes`: im verschränkten Lauf
      // (`advanceReel`) stammt die
      // Closure aus der Zeit VOR dem Storyboard — `scenes` ist dort leer.
      // `sceneIdx` wäre -1→0, `sceneCount` 0, alle Toasts hießen „Szene 0", und
      // der Video-Prompt bekäme falsche Positionsangaben (isFirst/isLast steuern
      // Hook, Start- und Endgrammatik). Der Fehler sieht funktionierend aus und
      // liefert still falsche Prompts — deshalb ist das Voraussetzung, nicht
      // Kosmetik.
      const sceneList = scenesRef.current;
      const sceneIdx = sceneList.findIndex((x) => x.id === scene.id);
      const sceneNo = (sceneIdx < 0 ? 0 : sceneIdx) + 1;

      // ── Sprechender Avatar ────────────────────────────────────────────────
      // Spricht die sichtbare Person selbst, geht die Szene über `ai-avatar`:
      // Bild + Ton rein, lippensynchroner Clip raus. Kein Bewegungs-Prompt,
      // keine geratene Länge, kein nachgelagerter Lipsync.
      //
      // Scheitert das, scheitert die SZENE. Früher übernahm hier die klassische
      // Kette und lieferte einen Clip, dessen Lippen etwas anderes sagen als der
      // Ton — gerettet war damit nur die Zeile in der Übersicht, nicht das Reel.
      // Ein solcher Clip fällt zwischen echten Avatar-Clips sofort auf, und man
      // merkt es erst im fertigen Schnitt. Also: klarer Fehler, gezielt
      // wiederholbar.
      if (sceneUsesTalkingAvatar(scene)) {
        {
          const talk = await renderTalkingAvatarScene(scene, startImageDataUrl, sceneNo);
          updateScene(scene.id, {
            videoStatus: "done",
            videoUrl: talk.videoUrl,
            videoProgressPct: 100,
            // Beim Avatar IST die Cliplänge die Audiolänge — kein Schätzwert.
            videoDurationSec: talk.durationSec ?? undefined,
            // ai-avatar kennt keinen Prompt (Spec §4b: der „Prompt" IST Bild +
            // Ton). Einen aus einem früheren klassischen Lauf stehenzulassen
            // hieße, im Detail-Dialog Anweisungen zu zeigen, die diesen Clip nie
            // gesehen haben.
            videoPrompt: undefined,
            // Die Stimme steckt IM Clip. `dubbedVideoUrl` bleibt deshalb leer:
            // `sceneFinalVideo` liefert dann `videoUrl`, und das ist hier schon
            // der fertige, vertonte Clip.
            audioStatus: "done",
            audioUrl: talk.audioUrl,
            audioDurationSec: talk.durationSec ?? undefined,
            // Ohne diese Marke stuft der Sanitizer die Szene beim Speichern auf
            // „unvertont" zurück (er erkennt eine fertige Stimme sonst nur am
            // `dubbedVideoUrl`) — nach dem Reload gälte das Reel als unfertig und
            // die Reparatur würde den bezahlten Clip neu rendern.
            voiceBakedIn: true,
            voiceError: undefined,
          });
          toast.success(`Szene ${sceneNo}: Sprechender Clip bereit.`);
          await captureEndFrame(scene.id, talk.videoUrl);
          return talk.videoUrl;
        }
      }

      // Ist der Sprechertext abgeschaltet, darf die Zeile auch nicht mehr in den
      // Video-Prompt: sonst laesst `SPEECH TIMING` das Modell sie sprechen und
      // `voiceLock: false` bestellt zusaetzlich ausdruecklich eine Erzaehlstimme —
      // waehrend gleichzeitig (sceneNeedsVoice=false) gar keine TTS-Spur entsteht,
      // die sie ersetzen koennte. Der Clip traegt dann eine fremde Stimme.
      const promptScene = enableSpeaker ? scene : { ...scene, dialogText: "" };

      // Der Prompt für Kling: kurz, und auf Bewegung statt Aussehen konzentriert.
      //
      // Hier wurde daneben noch die lange Veo-Fassung (`buildSceneVideoPrompt`)
      // gebaut. Die ging an Veo — den es nicht mehr gibt. Übrig blieb, dass sie
      // als `videoPrompt` in die Szene geschrieben wurde: der Detail-Dialog
      // zeigte damit Anweisungen, die dieser Clip nie gesehen hat.
      const klingPrompt = buildKlingVideoPrompt({
        scene: promptScene, mode, pacing, mood: videoMood,
        voiceMode: enableSpeaker ? voiceMode : "sprecher",
        // Sichtbar sprechen heißt: es braucht ein brauchbares Mundbild, sonst hat
        // der Lipsync-Schritt danach nichts, worauf er aufsetzen kann.
        speaksOnCamera: sceneNeedsVoice(scene) && (voiceMode === "dialog" || vlogActive),
        // Über das Ref wie überall sonst: Der Volllauf startet die Clips aus
        // einer älteren Closure, ein Umschalten mittendrin erreicht ihn sonst
        // nicht — und das Reel liefe zur Hälfte im anderen Modus.
        actionLevel: actionLevelRef.current,
      });

      // ── Cliplänge an die Sprechzeile anpassen ──────────────────────────────
      // Die nötige Länge aus der Wortzahl schätzen (~2,4 Wörter/s + ~1,1s Luft
      // zum Ein- und Ausatmen) und dann auf eine Länge runden, die KLING
      // tatsächlich rendert.
      //
      // Kling kennt nur 5 und 10 Sekunden — nicht Veos 6 und 8. Hier standen
      // trotzdem 6/8: der Server rundete beides auf "10" auf, während in der
      // Szene 6 bzw. 8 als `videoDurationSec` gespeichert wurde. Die Vertonung
      // prüfte danach gegen eine Länge, die der Clip nie hatte, und meldete
      // „Text gekürzt" für Zeilen, die bequem passten.
      const spokenLine = scene.dialogText?.trim() || "";
      const wordCount = spokenLine ? spokenLine.split(/\s+/).filter(Boolean).length : 0;
      const neededSeconds = wordCount / 2.4 + 1.1;
      // Ohne Sprechzeile gibt es nichts zu treffen — dann der kurze Clip, sonst
      // stünde die Person sekundenlang still herum.
      const wantShorter = wordCount === 0 || neededSeconds <= 5;
      const renderedDurationSec = wantShorter ? 5 : 10;
      // Crop+compress reference frames before sending. Cropping to the EXACT
      // target ratio is what stops Veo from letterboxing an off-ratio start
      // frame into the clip (the black-bars bug). Compression keeps the request
      // body small — 4 MB PNGs would balloon start+end to 6+ MB.
      const videoRatio = videoAspect(aspect);
      const startCompressed = await cropDataUrlToAspect(startImageDataUrl, videoRatio);
      // Derselbe exakte Crop wie beim Startframe — sonst sind die beiden Enden
      // des Clips unterschiedlich beschnitten und Veo letterboxt das Ende.
      const endCompressed = endImageDataUrl
        ? await cropDataUrlToAspect(endImageDataUrl, videoRatio)
        : undefined;
      // EIN Lauf, EIN Anbieter: Kling über fal.ai.
      //
      // Hier stand eine Provider-Kette mit zwei verschachtelten Rückfällen —
      // erst „nochmal ohne End-Frame", dann „nimm den anderen Anbieter". Beide
      // haben die Szene gerettet und dabei das Ergebnis verändert: ein Veo-Clip
      // zwischen Kling-Clips sieht anders aus, und ohne End-Frame bricht die
      // Anschlusskette. Ein Reel aus zwei Bildsprachen ist schlechter als eine
      // Szene, die ehrlich fehlschlägt und die man gezielt wiederholt.
      updateScene(scene.id, {
        videoJobId: undefined,
        videoJobStartedAt: Date.now(),
        videoDurationSec: renderedDurationSec,
        videoPrompt: klingPrompt,
      });
      const videoUrl = await runVideoJob(
        {
          provider: "kling",
          apiKey: klingKey,
          params: {
            // Kling bekommt eine eigene, kurze Fassung: der lange Prompt würde
            // dort bei 2500 Zeichen mitten im Satz abgeschnitten — und was
            // wegfiele, wären ausgerechnet die Kamera- und Anschlussregeln am
            // Ende. Siehe `buildKlingVideoPrompt`.
            prompt: klingPrompt,
            negativePrompt: KLING_NEGATIVE_PROMPT,
            startImageDataUrl: startCompressed,
            // Kling nimmt den Endframe als `end_image_url` — die Frame-Kette
            // läuft also unverändert weiter. Kein Sonderfall, keine Retry-Logik:
            // das war Veos `lastFrame`, das nur 3.1 und nur bei exakt 8s konnte.
            endImageDataUrl: endCompressed,
            // Kling kennt kein `aspect_ratio` — das Format kommt aus dem oben
            // exakt zugeschnittenen Startbild. Das Feld geht trotzdem mit, weil
            // die Poll-Nacharbeit (9:16-Normalisierung) sich danach richtet.
            aspectRatio: videoAspect(aspect),
            durationSeconds: renderedDurationSec,
          },
        },
        (p) => {
          // Wie beim Avatar-Weg: der Tick-Zaehler beschreibt nur noch den
          // SCHRITT, nicht den Balken — und der Schritt kommt vom Server.
          updateScene(scene.id, {
            videoStatus: p.status === "completed" ? "done" : "loading",
            videoPhase: p.phase ? SERVER_PHASE_TO_VIDEO_PHASE[p.phase] : "render",
            videoJobId: p.handle,
          });
        },
      );
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
      const finalVideoUrl = await finishVeoScene(scene, durableVideoUrl, {
        // Der Prompt, der diesen Clip TATSÄCHLICH erzeugt hat. Hier stand die
        // lange Veo-Fassung — die ging nie an Kling, und der Detail-Dialog
        // zeigte damit Anweisungen, die dieser Clip nie gesehen hat.
        sceneNo, videoPrompt: klingPrompt, durationSec: renderedDurationSec,
      });
      // Zustandsanschluss: den Übergabeframe HIER erfassen, nicht erst im Batch.
      // Dadurch profitiert auch der Einzelbutton „Video neu" — danach schließt
      // ein späteres „Bild neu" auf der Folgeszene automatisch an das Ende
      // dieses Clips an, ohne dass an den Buttons etwas geändert werden muss.
      // Bewusst der FERTIGE Clip (siehe unten): Lipsync rendert die Mundpartie
      // neu. Fehler bleiben weich — captureEndFrame wirft nie.
      await captureEndFrame(scene.id, finalVideoUrl);
      // Return the finished URL so the continuity batch can chain frames without
      // depending on a React state read that hasn't flushed yet. Bewusst der
      // FERTIGE Clip: Lipsync rendert die Mundpartie neu, der Übergabeframe muss
      // also von dort kommen.
      return finalVideoUrl;
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Video-Generierung fehlgeschlagen.");
      // Den ECHTEN Fehler zeigen. Die Hinweise sind auf Kling/fal umgestellt —
      // die alten sprachen von Veo-Billing und Google-Allowlist und schickten
      // den Nutzer damit zu einem Zugang, der für Clips gar nicht mehr benutzt
      // wird.
      const msg = err.message || "";
      const isKeyOrAccess = /API-Key ungültig|401|403|Kein API-Key/i.test(msg);
      // „Kein Video in …" / Inhaltsrichtlinie = es wurde KEIN Video erzeugt
      // (meist die Moderation am echten Gesicht im Startbild) — NICHT als
      // „Abruf schlug fehl, erneut versuchen" labeln: ein identischer zweiter
      // Versuch scheitert genauso und kostet wieder.
      const isEmptyOrFiltered = /Kein Video in|Inhaltsrichtlinie|gefiltert|Moderation/i.test(msg);
      // „nicht ausgeliefert": der Server hat aufgegeben, weil ein bei fal
      // FERTIGER Clip seinen Ergebnis-Abruf 90 s lang verweigert hat. Gehört in
      // genau diese Gruppe — der Clip existiert und ist bezahlt, nur der Weg
      // zurück ist zu.
      const isDownloadOrPoll = /Video-Download|Status-Abfrage|Ergebnis-Fehler|nicht ausgeliefert/i.test(msg);
      const hint =
        err.hint ||
        (isKeyOrAccess
          ? "fal.ai-Key prüfen — Clips laufen ausschließlich über Kling (fal.ai)."
          : isEmptyOrFiltered
            ? "Kein Clip erzeugt — Inhalt evtl. von der fal-Moderation blockiert. Startbild oder Szenentext anpassen; ein identischer erneuter Versuch schlägt meist wieder fehl."
            : isDownloadOrPoll
              ? "Der Clip ist fertig und bezahlt, nur der Abruf beim Anbieter schlug fehl. Mit „Ergebnis abholen“ erneut versuchen — ein neuer Lauf würde denselben Clip ein zweites Mal bezahlen."
              : undefined);
      // `audioStatus` MUSS hier mit zurück: die Avatar-Strecke setzt sie auf
      // „loading", bevor sie die Stimme erzeugt. Scheitert sie danach, zeigte
      // die Karte sonst dauerhaft „Stimme wird erzeugt…" für eine Szene, an der
      // längst nichts mehr läuft.
      // IST DER CLIP SCHON FERTIG UND DER FEHLER KAM ERST AUS DER NACHARBEIT?
      //
      // `finishVeoScene` setzt `videoStatus: "done"` und schreibt die bezahlte
      // Clip-URL, BEVOR es vertont und den Endframe zieht. Wirft irgendetwas
      // danach, landete es hier — und diese Zeile kippte die Szene zurück auf
      // „error". Das ist nicht nur eine falsche Beschriftung: `videoStatus` ist
      // genau das Kriterium, nach dem der Zusammenschnitt unten filtert. Ein
      // fertiger, abspielbarer, bereits bezahlter Clip verschwand damit
      // vollständig aus dem fertigen Reel, weil der Schritt DANACH gehakt hat.
      //
      // Der Fehler gehört an die Vertonung, wo er entstanden ist — genau so, wie
      // `voiceScene` es an seiner eigenen Fehlerstelle längst macht.
      const live = scenesRef.current.find((x) => x.id === scene.id);
      const clipSurvived = live?.videoStatus === "done" && !!live.videoUrl;
      // ── EINE ZEITGRENZE IST KEIN ENDE ─────────────────────────────────────
      //
      // Läuft die Uhr ab, heißt das NICHT, dass etwas kaputt ist: der Auftrag
      // läuft beim Anbieter weiter, wird fertig und ist bezahlt. Die Szene
      // trotzdem auf „error" zu kippen war eine Sackgasse mit Handarbeit — der
      // Nutzer musste „Ergebnis abholen" drücken, und weil dessen Fenster
      // kürzer war als die serverseitige Nachbearbeitung, oft mehrfach.
      //
      // Stattdessen bleibt die Szene „läuft" MIT ihrem Handle. Damit ist sie
      // für den Wiederaufnahme-Effekt eine verwaiste Szene, und der holt sie
      // genau EINMAL weiter ab: `resumeHandledRef` merkt sich jedes Paar aus
      // Szene und Auftrag, und älter als 30 Minuten adoptiert er ohnehin nicht.
      // Kein Dauerlauf, keine zweite Rechnung — nur der Schritt, den der Nutzer
      // sonst von Hand auslösen musste. Scheitert auch dieser Anlauf, endet die
      // Szene dort im Fehler (siehe `runResumes`).
      //
      // `!clipSurvived` steht bewusst VORNE: ein bereits fertiger, bezahlter
      // Clip darf unter keinen Umständen wieder auf „läuft" zurückkippen — das
      // ist derselbe Fehler, den der Block darüber schon einmal gekostet hat.
      const timedOutButAlive = !clipSurvived && err.code === "VIDEO_TIMEOUT" && !!live?.videoJobId;
      if (timedOutButAlive) {
        updateScene(scene.id, {
          videoStatus: "loading", videoPhase: "fetch",
          videoError: undefined, videoHint: undefined,
        });
        toast.info(`Szene ${sceneNumber(scene.id)}: ${err.message}`, {
          description: "Der Auftrag läuft weiter — das Ergebnis wird automatisch weiter abgeholt.",
        });
      } else if (clipSurvived) {
        if (sceneNeedsVoice(scene)) {
          updateScene(scene.id, { audioStatus: "error", voiceError: err.message });
        }
        toast.error(`Szene ${sceneNumber(scene.id)}: Der Clip ist fertig, die Nacharbeit schlug fehl — ${err.message}`, {
          description: "Der bezahlte Clip bleibt erhalten und nutzbar. Nur den fehlenden Schritt — meist die Vertonung — einzeln nachziehen.",
        });
      } else {
        // `as any` ist hier weg: `videoHint` steht jetzt im Typ (siehe
        // StoryScene) — es fehlte dort, und genau deshalb war es jahrelang
        // unsichtbar, ohne dass der Compiler je etwas gesagt hätte.
        updateScene(scene.id, {
          videoStatus: "error", videoError: err.message, videoHint: hint,
          audioStatus: "idle", videoProgressPct: 0,
        });
        toast.error(err.message, { description: hint });
      }
    }
    } finally {
      if (ownsVideo) releaseScene(scene.id);
    }
  };

  // ── Wiederaufnahme nach einem Reload ────────────────────────────────────────
  //
  // Eine Szene mit `videoStatus === "loading"`, die NICHT in `busyScenesRef`
  // steht, gehoert zu keinem Lauf dieser Sitzung — sie ist verwaist. Genau das
  // ist der Fall nach einem Reload (und nach dem Zurueckholen eines Slots).
  // Jeder Durchlauf loest sie auf: entweder haengt er sich per Handle wieder an
  // den laufenden Auftrag, oder er macht daraus einen Fehler mit Begruendung.
  // Ein verwaistes "laeuft" darf es nie geben — es wuerde die Karte dauerhaft
  // sperren.
  const resumeAbortRef = useRef<AbortController | null>(null);
  const resumeCountRef = useRef(0);
  const resumeHandledRef = useRef<Set<string>>(new Set());

  const runResumes = async (list: StoryScene[]) => {
    const ctrl = resumeAbortRef.current ?? new AbortController();
    resumeAbortRef.current = ctrl;
    // Zaehler statt Boolean: bei mehreren Szenen verschwaende der
    // Abbrechen-Knopf sonst, sobald die erste fertig ist — waehrend die Sperre
    // fuer die uebrigen noch steht.
    if (resumeCountRef.current++ === 0) setGeneratingVideos(true);
    try {
      await mapLimit(list, VIDEO_CONCURRENCY, async (s) => {
        const no = sceneNumber(s.id);
        try {
          const key = s.videoJobId!.startsWith("google:") ? googleKey : falKey;
          const rawUrl = await resumeVideoJob(
            s.videoJobId!, key,
            { normalize916: s.videoJobNormalize916, trimTail: s.videoJobTrimTail },
            (pr) => updateScene(s.id, {
              videoStatus: pr.status === "completed" ? "done" : "loading",
              // Wiederaufnahme: der Auftrag laeuft beim Anbieter schon, wir holen
              // nur noch ab — das ist ein anderer Schritt als „rendert". Meldet
              // der Server eine genauere Phase (er rendert doch noch, oder die
              // Nachbearbeitung laeuft), gilt seine.
              videoPhase: pr.phase ? SERVER_PHASE_TO_VIDEO_PHASE[pr.phase] : "fetch",
            }),
            ctrl.signal,
          );
          // Genau wie im Live-Lauf durable ablegen — sonst ist der Clip nach dem
          // naechsten Reload wieder weg (der Sanitizer wirft data:-URLs raus).
          let durableUrl = rawUrl;
          if (projectId) {
            try { durableUrl = await uploadAsset(credentials?.email ?? "", projectId, "videos", rawUrl); }
            catch { /* Spaces aus/unerreichbar — Quell-URL behalten */ }
          }
          if (s.videoJobKind === "avatar") {
            // Beim sprechenden Avatar steckt die Stimme IM Clip. Denselben Patch
            // schreiben wie der Live-Lauf, sonst gilt die Szene als unvertont und
            // die naechste Etappe rendert sie ein zweites Mal — bezahlt.
            updateScene(s.id, {
              videoStatus: "done", videoUrl: durableUrl, videoProgressPct: 100,
              videoJobId: undefined, videoError: undefined, videoPrompt: undefined,
              audioStatus: "done", voiceBakedIn: true, voiceError: undefined,
            });
            toast.success(`Szene ${no}: Sprechender Clip abgeholt.`);
            await captureEndFrame(s.id, durableUrl);
          } else {
            const finalUrl = await finishVeoScene(s, durableUrl, {
              sceneNo: no, durationSec: s.videoDurationSec,
            });
            await captureEndFrame(s.id, finalUrl);
          }
        } catch (e: any) {
          const aborted = /abgebrochen/i.test(String(e?.message || ""));
          const live = scenesRef.current.find((x) => x.id === s.id);
          updateScene(s.id, {
            videoStatus: "error",
            videoError: aborted
              ? "Abholen abgebrochen — der Auftrag kann beim Anbieter weiterlaufen."
              : (e?.message || "Ergebnis konnte nicht abgeholt werden."),
            // Eine Vertonung, die hier noch auf „laeuft" steht, hoerte sonst nie
            // auf: die Karte zeigte dauerhaft „Stimme wird erzeugt…" fuer eine
            // Szene, an der nichts mehr passiert. Betrifft die Avatar-Strecke,
            // die `audioStatus` vor dem Clip auf "loading" setzt.
            ...(live?.audioStatus === "loading" ? { audioStatus: "idle" as const } : {}),
            // Das Handle bleibt STEHEN: damit ist „Ergebnis abholen" weiter moeglich.
          });
        } finally {
          releaseScene(s.id);
        }
      });
    } finally {
      if (--resumeCountRef.current === 0) {
        setGeneratingVideos(false);
        resumeAbortRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (!projectId || scenesLoaded !== projectId) return;
    const orphans = scenesRef.current.filter(
      (s) => s.videoStatus === "loading"
        && !isSceneBusy(s.id)
        && !resumeHandledRef.current.has(`${s.id}:${s.videoJobId ?? ""}`),
    );
    if (!orphans.length) return;

    const adopt: StoryScene[] = [];
    for (const s of orphans) {
      // SYNCHRON entscheiden und merken — sonst greift der Effect beim naechsten
      // `scenes`-Update erneut auf dieselbe Szene zu.
      resumeHandledRef.current.add(`${s.id}:${s.videoJobId ?? ""}`);
      const key = s.videoJobId?.startsWith("google:") ? googleKey : falKey;
      const stale = !s.videoJobStartedAt || Date.now() - s.videoJobStartedAt > 30 * 60 * 1000;
      if (!plan.videoGen) {
        updateScene(s.id, { videoStatus: "error", videoError: "Video ist im aktuellen Plan nicht enthalten — Ergebnis nicht abholbar." });
      } else if (!s.videoJobId || !key) {
        updateScene(s.id, { videoStatus: "error", videoError: "Der Lauf lief noch, aber Auftrag oder API-Key fehlt — nicht abholbar." });
      } else if (stale) {
        // Nicht ungefragt abholen: die Nacharbeit stoesst Vertonung und (bezahlten)
        // Lipsync an. Bei altem Auftrag entscheidet der Nutzer per Knopf.
        updateScene(s.id, { videoStatus: "error", videoError: "Der Lauf ist aelter als 30 Minuten — Ergebnis bei Bedarf manuell abholen." });
      } else if (claimScene(s.id)) {
        adopt.push(s);
      }
    }
    if (adopt.length) {
      toast.info(adopt.length === 1
        ? "Ein noch laufender Clip wird weiter abgeholt."
        : `${adopt.length} noch laufende Clips werden weiter abgeholt.`);
      void runResumes(adopt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes, projectId, scenesLoaded, plan.videoGen, googleKey, falKey]);

  /** „Ergebnis abholen" von Hand — fuer Timeout, Abbruch und alte Auftraege. */
  const retrieveVideoResult = (scene: StoryScene) => {
    const blocked = generationBlocked();
    if (blocked) { toast.info(blocked); return; }
    if (!scene.videoJobId) { toast.error("Zu dieser Szene gibt es keinen Auftrag zum Abholen."); return; }
    resumeHandledRef.current.delete(`${scene.id}:${scene.videoJobId}`);
    if (!claimScene(scene.id)) return;
    updateScene(scene.id, { videoStatus: "loading", videoError: undefined });
    void runResumes([scene]);
  };

  const generateAllVideos = async (opts: { force?: boolean } = {}) => {
    // Eine Szene mit fertigem Video, aber fehlender/gescheiterter Vertonung ist
    // ebenfalls ein Target — sonst meldet der Batch „Alle Videos sind bereits
    // fertig", während `videosDone` wegen der fehlenden Stimme false bleibt: der
    // Primärbutton hieße weiter „Fehlende Videos generieren" und täte nichts.
    const needsWork = (s: StoryScene) =>
      opts.force || s.videoStatus !== "done" || (sceneNeedsVoice(s) && s.audioStatus !== "done");

    // `scenesRef`, nicht `scenes`: der Batch startet aus einer Closure, die das
    // Array unter Umständen noch von vor dem Storyboard-Lauf kennt.
    const list = scenesRef.current;
    const targets = list.filter((s) =>
      s.imageStatus === "done" &&
      s.videoStatus !== "loading" &&
      needsWork(s),
    );
    if (!targets.length) {
      // Eine noch abzuholende Szene fällt oben durch den `videoStatus !==
      // "loading"`-Filter. Ohne diesen Zweig hieße es dann „Alle Videos sind
      // bereits fertig", obwohl gerade noch ein Clip unterwegs ist.
      const pending = list.filter((s) => s.videoStatus === "loading");
      if (pending.length) {
        toast.info(pending.length === 1
          ? `Für Szene ${sceneNumber(pending[0].id)} wird noch ein Clip abgeholt.`
          : `Für ${pending.length} Szenen wird noch ein Clip abgeholt.`);
        return;
      }
      toast.info(opts.force ? "Keine passenden Szenen." : "Alle Videos sind bereits fertig.");
      return;
    }

    // Die frühere „ohne Endbild"-Warnung ist mit dem Rückbau (2026-08-08)
    // entfallen: es gibt keinen generierten Endframe mehr — jeder Clip rendert
    // bewusst nur mit dem Startbild, wie am Projektanfang.

    if (!videoApi) {
      toast.error("Kein fal.ai-Key gesetzt — Clips laufen über Kling (fal.ai).", {
        description: "Einstellungen öffnen und den fal.ai-Key eintragen.",
      });
      return;
    }
    // Quer zu einem laufenden Bild-Batch wäre jeder hier gerenderte Clip sofort
    // wieder wertlos: dessen Bild-Erfolg verwirft Video und Vertonung der Szene.
    const batchToken = claimBatch("videos");
    if (batchToken === null) {
      toast.info("Es läuft bereits ein Durchgang — bitte warten oder abbrechen.");
      return;
    }

    abortRef.current = false;
    const epoch = runEpochRef.current;
    setGeneratingVideos(true);
    // Wie beim Bild-Durchgang: der Fortschritt zählt über ALLE Szenen, nicht nur
    // über die `targets` dieses Laufs — „Clip 5 von 8" ist die Aussage, die der
    // Nutzer sucht, nicht „Clip 2 von 3 Nachzüglern".
    beginRunPhase(
      "videos",
      list.filter((s) => s.videoStatus === "done" && (!sceneNeedsVoice(s) || s.audioStatus === "done")).length,
    );
    try {
      // VOLLSTÄNDIG PARALLEL — der eigentliche Gewinn der Frame-Kette.
      //
      // Früher standen hier drei Zweige, und zwei davon mussten sequenziell
      // laufen, weil Clip N+1 auf ein Ergebnis von Clip N wartete (extrahierter
      // Endframe bzw. nachgerendertes Bild). Beide Frames jeder Szene stehen
      // jetzt schon VOR dem Lauf fest, also wartet nichts mehr auf nichts.
      // `mapLimit` deckelt nur die gleichzeitigen Requests gegen Rate-Limits.
      await mapLimit(targets, VIDEO_CONCURRENCY, async (s) => {
        // „Abbrechen" ODER „Alles verwerfen" — hier hängt ein bezahlter Job dran.
        if (abortRef.current || epoch !== runEpochRef.current) return;
        // Szene, an der gerade einzeln gearbeitet wird, überspringen — sonst
        // liefen zwei bezahlte Veo-Jobs für dieselbe Szene.
        if (!claimScene(s.id)) return;
        try {
          // Video steht schon, nur die feste Stimme fehlt (oder ist gescheitert)
          // → nur nachvertonen, kein neuer Veo-Call. Ohne diesen Zweig würfe der
          // Batch bezahlte Clips weg, bloß weil TTS/Lipsync gehakt hat.
          // Bei Avatar-Szenen gibt es diese Abkürzung nicht: dort steckt die
          // Stimme im Clip, `voiceScene` rendert die Szene also neu. Das ist dort
          // die einzig mögliche Reparatur — und immer noch billiger als ein
          // Reel, in dem eine Szene stumm bleibt.
          if (!opts.force && s.videoStatus === "done" && sceneNeedsVoice(s) && s.audioStatus !== "done") {
            await voiceScene(s, { fromBatch: true });
            return;
          }

          await generateSceneVideo(s, { fromBatch: true });
        } finally {
          releaseScene(s.id);
        }
      });
    } finally {
      setGeneratingVideos(false);
      endRunPhase("videos");
      releaseBatch(batchToken);
    }
  };

  /**
   * DER VERSCHRÄNKTE LAUF — Bild → Video → Bild → Video …
   *
   * WARUM überhaupt verschränkt: Bild N+1 soll an den Zustand anschließen, den
   * Clip N hinterlassen hat (Person steht, Gegenstand liegt woanders). Dieser
   * Zustand existiert erst, wenn Clip N FERTIG ist. In zwei getrennten
   * Durchläufen (erst alle Bilder, dann alle Videos) kann er es prinzipiell
   * nicht — genau daher kommt der Fehler „Clip N steht auf, Clip N+1 sitzt
   * wieder".
   *
   * Ersetzt `generateAllImages`/`generateAllVideos` NICHT — beide bleiben
   * unverändert bestehen und über die Toolbar erreichbar (die billigen
   * Einzelpfade).
   */

  /**
   * „Alles neu" für eine Szene — erzeugt NUR das Bild neu.
   *
   * Früher lief direkt danach ungefragt die Video-Generierung. Damit war das
   * Bild nicht mehr änderbar: der teure Clip war schon unterwegs, bevor man es
   * überhaupt gesehen hatte. Das Video startet jetzt ausschließlich auf einen
   * eigenen Klick — hier wie im verketteten Lauf.
   */
  const regenerateSceneFull = async (scene: StoryScene) => {
    // Reserviert die Szene EINMAL für beide Frames — sonst könnte zwischen
    // Start- und Endbild ein anderer Klick dazwischenfunken und die Szene mit
    // einem Frame-Paar aus zwei verschiedenen Aufnahmen zurücklassen.
    const blocked = generationBlocked();
    if (blocked) { toast.info(blocked); return; }
    const live = scenesRef.current.find((x) => x.id === scene.id) ?? scene;
    if (live.videoStatus === "loading") {
      toast.info(`Szene ${sceneNumber(scene.id)}: Das Video rendert gerade — währenddessen lässt sich die Szene nicht neu erzeugen.`);
      return;
    }
    if (!claimScene(scene.id)) return;
    abortRef.current = false; // Merker des vorigen Laufs — siehe generateSceneImage.
    setGeneratingImages(true);
    try {
      // Seit dem Rückbau (2026-08-08) ist das Startbild das EINZIGE Bild der
      // Szene — kein Endframe-Zweitlauf, keine Platten-/Rücken-Vorbereitung.
      await generateSceneImage(scene, { fromBatch: true });
    } finally {
      setGeneratingImages(false);
      releaseScene(scene.id);
    }
  };

  /**
   * Welcher Schritt kommt als nächstes im verketteten Lauf?
   *
   * Bewusst aus dem Szenen-Zustand ABGELEITET statt in einer eigenen Variable
   * geführt: ein separater Schrittzeiger würde nach jedem Einzelbutton, jedem
   * Abbruch und jedem Reload nachgezogen werden müssen und wäre die erste
   * Stelle, die auseinanderläuft. „Bild fertig, Video fehlt" IST die Freigabe-
   * Situation — mehr Zustand braucht es nicht.
   */
  const nextChainStep = (): { kind: "image" | "video" | "voice"; scene: StoryScene; index: number } | null => {
    const list = scenesRef.current;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const imgOk = s.imageStatus === "done" && (!!s.imageDataUrl || !!s.imageUrl);
      if (!imgOk) return { kind: "image", scene: s, index: i };
      if (!plan.videoGen) continue;
      const videoRendered = s.videoStatus === "done" && !!s.videoUrl;
      // Das Video FEHLT → rendern. Das Video ist DA, nur die feste Stimme fehlt
      // (oder schlug fehl) → NUR nachvertonen. Der Unterschied ist bares Geld:
      // ein „video"-Schritt hier würde den fertigen, bezahlten Veo-Clip
      // wegwerfen und neu rendern, obwohl bloß der TTS-/Lipsync-Schritt hakte.
      if (!videoRendered) return { kind: "video", scene: s, index: i };
      if (sceneNeedsVoice(s) && s.audioStatus !== "done") return { kind: "voice", scene: s, index: i };
    }
    return null;
  };

  /**
   * Ein Schritt des verketteten Reel-Laufs — und dann ANHALTEN.
   *
   * Ablauf über mehrere Klicks:
   *   Bild 1 → [halt] → Video 1 + Bild 2 → [halt] → Video 2 + Bild 3 → [halt] → …
   *
   * Warum Video N und Bild N+1 im selben Schritt liegen: Bild N+1 soll an den
   * ENDFRAME von Clip N anschließen (`resolvePrevSceneImage` holt ihn sich), und
   * der existiert erst, wenn Clip N fertig ist. Die Freigabe gehört aber VOR das
   * Video — also endet jeder Schritt mit einem frischen, noch nicht verfilmten
   * Bild, das in Ruhe geprüft und geändert werden kann.
   */
  const advanceReel = async () => {
    const step = nextChainStep();
    if (!step) { toast.info("Alle Szenen sind fertig."); return; }
    abortRef.current = false;

    // Dieser Lauf hält bereits die globale Reservierung (`advanceReelGuarded`).
    // Die Einzelschritte müssen deshalb als `fromBatch` laufen — sonst scheitern
    // sie an genau der Sperre, die dieser Lauf selbst gesetzt hat. Die Szene wird
    // hier reserviert, damit die Karte trotzdem als „arbeitet" erkennbar bleibt.
    const epoch = runEpochRef.current;
    const runStep = async <T,>(sceneId: string, fn: () => Promise<T>): Promise<T | undefined> => {
      // Nach „Alles verwerfen" gehört diese Szene zu einem Storyboard, das es
      // nicht mehr gibt — kein weiterer Schritt darauf.
      if (epoch !== runEpochRef.current) return undefined;
      if (!claimScene(sceneId)) return undefined;
      try { return await fn(); } finally { releaseScene(sceneId); }
    };

    if (step.kind === "image") {
      setGeneratingImages(true);
      try { await runStep(step.scene.id, () => generateSceneImage(step.scene, { fromBatch: true })); }
      finally { setGeneratingImages(false); }
      return; // Anhalten — das Bild will erst angeschaut werden.
    }

    if (step.kind === "voice") {
      // Video ist fertig, nur die Stimme fehlt → NUR nachvertonen, kein Veo-Call.
      setGeneratingVideos(true);
      try { await runStep(step.scene.id, () => voiceScene(step.scene, { fromBatch: true })); }
      finally { setGeneratingVideos(false); }
      return;
    }

    setGeneratingVideos(true);
    let clip: string | undefined;
    try { clip = await runStep(step.scene.id, () => generateSceneVideo(step.scene, { fromBatch: true })); }
    finally { setGeneratingVideos(false); }
    if (abortRef.current || !clip) return; // Fehlgeschlagen → nicht weiterlaufen.

    // Direkt anschließend das nächste Bild, damit es den eben entstandenen
    // Endframe als Vorlage bekommt. Danach wieder anhalten.
    const list = scenesRef.current;
    const i = list.findIndex((x) => x.id === step.scene.id);
    const next = i >= 0 ? list[i + 1] : undefined;
    if (!next || abortRef.current) return;
    setGeneratingImages(true);
    try { await runStep(next.id, () => generateSceneImage(next, { fromBatch: true })); }
    finally { setGeneratingImages(false); }
  };

  /**
   * „Schritt für Schritt" — Bild N, dann Clip N, dann Bild N+1.
   *
   * `advanceReel` war vollständig implementiert, hatte aber KEINEN Aufrufer:
   * der Weg existierte im Code und war über die Oberfläche nicht erreichbar.
   * Der Wrapper ist nötig, weil `advanceReel` selbst kein `claimBatch` macht —
   * ohne ihn bliebe `anyBatchRunning` false und sämtliche Sperren an anderen
   * Knöpfen wären während des Laufs falsch.
   */
  const advanceReelGuarded = async () => {
    const batchToken = claimBatch("images");
    if (batchToken === null) { toast.info("Es läuft schon ein Durchgang."); return; }
    try { await advanceReel(); } finally { releaseBatch(batchToken); }
  };

  /** Beschriftung des Schritt-Knopfes — nennt die NÄCHSTE konkrete Aktion,
   *  statt den Nutzer raten zu lassen, was als Nächstes passiert. */
  const nextStepLabel = (() => {
    const s = nextChainStep();
    if (!s) return null;
    const n = s.index + 1;
    if (s.kind === "image") return `Nächster Schritt: Bild für Szene ${n}`;
    if (s.kind === "video") return `Nächster Schritt: Clip für Szene ${n}`;
    return `Nächster Schritt: Vertonung Szene ${n}`;
  })();

  /** Der teuerste Klick der Seite — verwirft fertige Clips. Die Rückfrage lag
   *  bisher direkt im Toolbar-Knopf; sie wandert mit ins Werkzeuge-Menü. */
  const handleAllImagesConfirmed = () => {
    const doomed = scenes.filter((s) => s.videoStatus === "done").length;
    if (doomed > 0 && !window.confirm(
      `Alle Bilder werden neu erzeugt. Dabei ${doomed === 1 ? "geht 1 fertiges Video" : `gehen ${doomed} fertige Videos`} samt Vertonung verloren.\n\nFortfahren?`,
    )) return;
    generateAllImages();
  };

  /** Ersetzt ALLE Szenen — bekam bisher keine Rückfrage, obwohl der Klick
   *  jedes bereits geprüfte Storyboard verwirft. */
  const handleRewriteStory = () => {
    if (scenes.length > 0 && !window.confirm(
      "Das Storyboard wird komplett neu geschrieben. Alle bestehenden Szenen werden ersetzt.\n\nFortfahren?",
    )) return;
    void generateStoryboard();
  };

  const generateFullStory = async () => {
    await generateStoryboard();
    // Die frisch generierten Szenen kommen aus `scenesRef`, das `generateStoryboard`
    // synchron mitschreibt — der State selbst ist in dieser Closure noch leer.
    //
    // Früher lief das über `setTimeout` + einen `setScenes`-Updater, in dem die
    // Bild-Schleife GESTARTET wurde. Ein State-Updater muss aber frei von
    // Seiteneffekten sein: React ruft ihn unter StrictMode bewusst DOPPELT auf
    // (genau um solche Fälle sichtbar zu machen). Dadurch liefen zwei
    // Bild-Schleifen parallel über dieselben Szenen — sichtbar als „erst das eine
    // Bild, dann das richtige", und jedes Bild wurde doppelt bezahlt.
    if (!scenesRef.current.length) return;
    // Die VORSCHAU: alle Start- und Endframes des ganzen Reels, bevor auch nur
    // ein Clip bezahlt wird. Genau dieselbe Kette wie „Alle Bilder generieren" —
    // bewusst derselbe Aufruf statt einer zweiten Schleife, denn eine Kopie
    // hätte die flow-Naht und die Endframes nicht mitbekommen.
    await generateAllImages();
  };

  /**
   * DER DURCHLAUF — ein Klick bis zum fertigen, zusammengeschnittenen Reel.
   *
   * Bisher endete der grosse Knopf nach den Bildern. Clips und Zusammenschnitt
   * waren zwei weitere Klicks mit je einer Wartepause von zehn bis
   * fünfundzwanzig Minuten dazwischen — und den letzten musste man unten am
   * Merger überhaupt erst finden. Wer nur ein Video wollte, musste dreimal
   * wiederkommen und dabei jedes Mal wissen, dass es weitergeht.
   *
   * Es wird NICHTS entfernt: jeder Einzelknopf steht weiter da, wo er stand.
   * Dies ist nur die durchgehende Strecke für alle, die zwischendurch nichts
   * prüfen wollen.
   *
   * ANGEHALTEN WIRD AN JEDEM BRUCH — und zwar VOR der jeweils teureren Etappe:
   *   • Abbruch oder „Alles verwerfen" → sofort raus.
   *   • Eine Etappe mit Fehlern geht nicht in die nächste über. Ohne diese
   *     Prüfung würde ein Lauf mit drei gescheiterten Bildern trotzdem Clips
   *     für die übrigen bezahlen und am Ende ein Reel mit Löchern
   *     zusammenschneiden — jeder dieser Clips wäre echtes Geld für ein
   *     Ergebnis, das so niemand haben wollte.
   * Der Nutzer landet dann genau an der Stelle, an der es hakt, mit einem Satz
   * dazu, was fehlt.
   */
  const runEverything = async () => {
    const blocked = generationBlocked();
    if (blocked) { toast.info(blocked); return; }
    // Zwischen den Etappen hält dieser Lauf KEINE Batch-Reservierung (die holt
    // sich jede Etappe selbst). Dieses Ref schliesst das Fenster, in dem ein
    // zweiter Klick einen zweiten Durchlauf danebenstellen könnte.
    if (autoRunRef.current) { toast.info("Der Durchlauf läuft bereits."); return; }
    autoRunRef.current = true;
    setAutoRunning(true);

    abortRef.current = false;
    const epoch = runEpochRef.current;
    /** Gehört der Lauf noch zu dieser Runde — kein Abbruch, kein Verwerfen? */
    const stillOurs = () => !abortRef.current && epoch === runEpochRef.current;

    try {
      // JEDE Etappengrenze liest den Szenen-Stand FRISCH (siehe `syncScenes`).
      // Vorher stand hier überall `scenesRef.current` — ein Stand, der direkt
      // nach einer Etappe noch nicht nachgezogen war. Der Durchlauf hielt
      // dadurch an einer Bedingung an, die zum Zeitpunkt der Prüfung längst
      // erfüllt war.
      let list = await syncScenes();

      // ── Etappe 1: Szenen ──────────────────────────────────────────────────
      // Nur wenn noch keine dastehen. Ein vorhandenes Storyboard wird NICHT
      // überschrieben — wer den Durchlauf auf halber Strecke drückt, will
      // weitermachen, nicht von vorn anfangen.
      if (!list.length) {
        await generateStoryboard();
        if (!stillOurs()) return;
        list = await syncScenes();
        if (!list.length) return; // Fehler wurde bereits gemeldet.
      }

      // ── Etappe 2: Bilder ──────────────────────────────────────────────────
      if (list.some((s) => s.imageStatus !== "done")) {
        await generateAllImages({ onlyMissing: list.some((s) => s.imageStatus === "done") });
        if (!stillOurs()) return;
        list = await syncScenes();
        const missing = list.filter((s) => s.imageStatus !== "done");
        if (missing.length) {
          toast.error(
            missing.length === 1
              ? `Szene ${sceneNumber(missing[0].id)} hat kein Bild — der Durchlauf hält hier an.`
              : `${missing.length} Szenen haben kein Bild — der Durchlauf hält hier an.`,
            { description: "Erst die fehlenden Bilder erzeugen, dann erneut durchlaufen lassen. Clips für ein lückenhaftes Storyboard wären bezahlt und unbrauchbar." },
          );
          return;
        }
      }

      // Ohne Video-Plan ist hier Schluss — und das ist kein Fehler, sondern der
      // vollständige Umfang dieses Plans.
      if (!plan.videoGen) {
        toast.success("Alle Bilder stehen. Clips brauchen den Video-Plan.");
        return;
      }

      // ── Etappe 3: Clips ───────────────────────────────────────────────────
      const clipDone = (s: StoryScene) =>
        s.videoStatus === "done" && (!sceneNeedsVoice(s) || s.audioStatus === "done");
      if (list.some((s) => !clipDone(s))) {
        await generateAllVideos();
        if (!stillOurs()) return;
        list = await syncScenes();
        const missing = list.filter((s) => !clipDone(s));
        if (missing.length) {
          toast.error(
            missing.length === 1
              ? `Szene ${sceneNumber(missing[0].id)} hat keinen fertigen Clip — der Durchlauf hält hier an.`
              : `${missing.length} Szenen haben keinen fertigen Clip — der Durchlauf hält hier an.`,
            { description: "Die fehlenden Clips einzeln nachziehen (der Grund steht an der jeweiligen Karte), dann unten zusammenfügen. Ein Reel mit Löchern wird hier bewusst nicht gebaut." },
          );
          return;
        }
      }

      // ── Etappe 4: Zusammenschnitt ─────────────────────────────────────────
      // Vorher zählen, ob es überhaupt etwas zusammenzufügen gibt. Ohne diese
      // Prüfung würde die Etappe an einen Merger übergeben, der gar nicht
      // montiert ist (oder sofort ablehnt) — und die Fortschrittsanzeige bliebe
      // für den Rest der Sitzung auf „wird zusammengefügt" stehen.
      const mergeable = list.filter(
        (s) => s.videoStatus === "done" && sceneFinalVideo(s) && (!sceneNeedsVoice(s) || s.audioStatus === "done"),
      ).length;
      if (mergeable < 2) {
        toast.info("Für einen Zusammenschnitt braucht es mindestens zwei fertige Clips.");
        return;
      }
      // Der Merger sitzt in einer eigenen Komponente und hält seinen Lauf
      // selbst. Übergeben wird deshalb ein hochzählender Token statt eines
      // Funktionsaufrufs — die Komponente ist an dieser Stelle garantiert
      // montiert, weil alle Clips fertig sind. Die Etappe räumt der Merger
      // selbst ab, über `onMergeSettled`.
      beginRunPhase("merge", 0);
      setAutoMergeToken((n) => n + 1);
    } finally {
      // Die Etappen räumen ihre eigene Phase in ihrem jeweiligen `finally` ab —
      // hier bleibt nur der Durchlauf-Merker. Ausnahme ist der Zusammenschnitt:
      // der läuft nach dieser Funktion weiter und meldet sich selbst zurück.
      autoRunRef.current = false;
      setAutoRunning(false);
    }
  };

  /**
   * Der Zusammenschnitt hat sich zurückgemeldet — die letzte Etappe schliessen
   * und das Ergebnis SICHERN.
   *
   * Gespeichert wird ausschliesslich die Bucket-URL. Die data-URL, die der
   * Merger liefert, hat bei einem fertigen Reel schnell zweistellige Megabyte —
   * im localStorage wäre das nicht bloss unhöflich, es riss die Quota und damit
   * die Sicherung des ganzen Storyboards mit (siehe die Quota-Warnung in
   * `persistScenes`).
   *
   * Ohne erreichbares Spaces bleibt es beim bisherigen Verhalten — der Download
   * hier funktioniert, nach einem Reload ist er weg. Der Unterschied ist, dass
   * das jetzt DASTEHT, statt sich erst beim Reload zu zeigen.
   */
  const handleMergeSettled = async (result: { dataUrl: string; sig: string } | null) => {
    endRunPhase("merge");
    if (!result || !projectId) return;
    try {
      const url = await uploadAsset(credentials?.email ?? "", projectId, "videos", result.dataUrl);
      setMergedReelUrl(url);
      setMergedReelSig(result.sig);
    } catch {
      toast.warning("Das fertige Reel liegt nur in dieser Sitzung.", {
        description: "Es liess sich nicht dauerhaft ablegen — nach einem Neuladen ist es weg. Am besten jetzt herunterladen.",
      });
    }
  };

  /**
   * DER SZENEN-ASSISTENT — ein Satz Umgangssprache statt fünfzehn Felder.
   *
   * „Ich will ein Frame von den Schultern." Bisher hiess das: selbst
   * herausfinden, dass dafür der Shot-Typ zuständig ist, ihn umstellen, und dann
   * merken, dass die Detail-Beschreibung immer noch eine Ganzkörperaufnahme
   * beschreibt — die geht nämlich fast wörtlich in den Bild-Prompt. Wer diesen
   * zweiten Schritt vergass, bekam ein Bild, das den Wunsch ignorierte, und
   * suchte den Fehler beim Modell.
   *
   * Der Assistent bekommt denselben Kontext, aus dem das Storyboard entstanden
   * ist — Profil, Idee, Hook, Look, Ort, Besetzung und ALLE Nachbarszenen —,
   * ändert nur die betroffenen Felder und zieht die abhängigen mit.
   *
   * DAS BILD KOMMT DIREKT HINTERHER. Ein geänderter Text ohne neues Bild ist die
   * halbe Antwort: das Bild oben zeigt dann weiter die alte Einstellung, und der
   * Nutzer müsste raten, ob überhaupt etwas passiert ist. Die einzige Ausnahme
   * ist ein bereits bezahlter Clip — der wird nie ungefragt weggeworfen.
   */
  const assistScene = async (
    scene: StoryScene,
    history: SceneChatTurn[],
    force: boolean,
  ): Promise<{ action: "ask" | "apply"; message: string; changedLabels: string[] } | null> => {
    if (!hasGenKey) {
      toast.error(missingKeyMessage ?? "Bitte hinterlege zuerst deine API-Keys.");
      return null;
    }
    if (!history.length) return null;
    // Der Assistent schreibt Felder, die eine laufende Generierung gerade liest.
    const blocked = generationBlocked();
    if (blocked) { toast.info(blocked); return null; }

    const list = scenesRef.current;
    const idx = list.findIndex((s) => s.id === scene.id);
    const live = idx >= 0 ? list[idx] : scene;

    let result: SceneAssistResult;
    try {
      const raw = await generateText(genChain, {
        prompt: buildSceneAssistPrompt({
          scene: live,
          sceneIndex: idx < 0 ? 0 : idx,
          allScenes: list,
          history,
          force,
          ctx: {
            mode, reelStyle, idea, hook, cta, language,
            artStyle, videoMood, colorMood, pacing,
            mainLocation, aspect,
            characterNames: characters.map((c) => c.name).filter(Boolean),
            // Über das Ref, aus demselben Grund wie überall sonst auf dieser
            // Seite: die Closure kann älter sein als der letzte Storyboard-Lauf.
            situation: reelSituationRef.current,
            // Ohne den Aktions-Level schreibt der Assistent bei jeder Änderung
            // wieder eine ruhige keyAction — er kennt die Einstellung sonst
            // nicht und arbeitet damit gegen den Schalter.
            actionLevel: actionLevelRef.current,
            profileContext: buildProfilePreamble(projectProfile),
            // OHNE DIESE ZWEI SCHREIBT DER ASSISTENT INS LEERE.
            // Bei einer Duo-Szene baut `buildDuoFramePrompt` den Ausschnitt
            // fest — halbnah, beide Personen, je eine Bildhälfte — und liest
            // shotType, cameraAngle und detailedDescription dafür gar nicht.
            // Ein „mach eine Nahaufnahme" landete dann als Satz im Textfeld,
            // während das Bild unverändert beide in voller Größe zeigte.
            isDuo: sceneIsDuo(live),
            duoPossible: characters.length >= 2 && sceneUsesTalkingAvatar(live),
          },
        }),
        json: true,
        // Niedriger als bei den Vorschlägen: hier ist eine Anweisung UMZUSETZEN,
        // nicht etwas zu erfinden. Drei Läufe mit demselben Satz sollen dasselbe
        // ergeben.
        temperature: 0.4,
        maxOutputTokens: 2000,
      });
      result = parseSceneAssist(extractJson(raw), live);
    } catch (e: any) {
      const err = e instanceof AIError
        ? e
        : new AIError("UNKNOWN", e?.message || "Der Assistent konnte die Szene nicht ändern.");
      toast.error(err.message, { description: err.hint });
      return null;
    }

    // ── Rückfrage: nichts anfassen, nur antworten ────────────────────────────
    if (result.action === "ask") {
      return {
        action: "ask",
        message: result.message || "Was genau soll anders sein?",
        changedLabels: [],
      };
    }

    // „apply" ohne eine einzige gültige Änderung ist keine Änderung. Das als
    // Erfolg zu melden — und dafür ein Bild neu zu bezahlen — wäre die
    // schlechteste aller Antworten; es wird zur Rückfrage.
    if (!Object.keys(result.patch).length) {
      return {
        action: "ask",
        message: result.message
          || "Daraus konnte ich keine konkrete Änderung ableiten. Sag es bitte etwas genauer — zum Beispiel „näher ran, nur Kopf und Schultern“.",
        changedLabels: [],
      };
    }

    // ── WECHSELT DER BILDAUFBAU, IST DIE BISHERIGE ARBEIT UNGÜLTIG ───────────
    //
    // Ein Duo-Bild und ein Sprecher-Bild sind nicht nur andere Ausschnitte, sie
    // laufen über verschiedene Video-Engines (OmniHuman mit Halbbild-Maske
    // gegen Kling ai-avatar). Bliebe das alte Bild stehen, rendert der nächste
    // Clip mit der falschen — genau das, wovor `toggleDuoFrame` beim
    // Handschalter schützt. Also dieselbe Räumung wie dort.
    const switchesFraming = result.patch.duoFrame !== undefined;
    const before = scenesRef.current.find((s) => s.id === scene.id);
    const hadWork = !!before && (before.imageStatus === "done" || before.videoStatus === "done");

    // ZUERST FRAGEN, DANN RÄUMEN. Die Räumung unten setzt `videoStatus` auf
    // "idle" — die Rückfrage weiter unten (vor dem Bildlauf) sähe danach keinen
    // fertigen Clip mehr und bliebe stumm. Ein bezahltes Video wäre also ohne
    // ein einziges Wort verschwunden.
    if (switchesFraming && before?.videoStatus === "done" && before.videoUrl) {
      if (!window.confirm(
        "Dafür muss der Bildaufbau dieser Szene wechseln (beide Personen ↔ nur der Sprecher).\n\n"
        + "Das verwirft das fertige Video dieser Szene samt Vertonung — beide Fassungen werden von "
        + "verschiedenen Video-Diensten gerendert, der vorhandene Clip passt danach nicht mehr.\n\nFortfahren?",
      )) {
        return {
          action: "ask",
          message: "Verstanden — ich lasse alles wie es ist. Für einen engeren Ausschnitt müsste der "
            + "Bildaufbau wechseln, und das kostet den fertigen Clip dieser Szene. Sag Bescheid, wenn du es doch willst.",
          changedLabels: [],
        };
      }
    }

    if (switchesFraming && hadWork) delete endFrameRef.current[scene.id];

    updateScene(scene.id, {
      ...result.patch,
      ...(switchesFraming && hadWork ? {
        imageStatus: "idle" as const, imageDataUrl: undefined, imageUrl: undefined,
        imageError: undefined, imageHint: undefined, detailedImagePrompt: undefined,
        videoStatus: "idle" as const, videoUrl: undefined, videoJobId: undefined,
        videoJobStartedAt: undefined, videoJobKind: undefined,
        videoJobNormalize916: undefined, videoJobTrimTail: undefined,
        videoProgressPct: undefined, videoError: undefined,
        audioStatus: "idle" as const, audioUrl: undefined, audioDurationSec: undefined,
        dubbedVideoUrl: undefined, voiceBakedIn: undefined, voiceError: undefined,
        endFrameDataUrl: undefined, endFrameUrl: undefined,
        endImageStatus: "idle" as const, endImageDataUrl: undefined,
        endImageUrl: undefined, endImageError: undefined,
      } : {}),
    });
    const applied = {
      action: "apply" as const,
      message: result.message || "Szene angepasst.",
      changedLabels: result.changedLabels,
    };

    // ── Und jetzt das passende Bild ───────────────────────────────────────────
    //
    // ÜBER `syncScenes`, NICHT ÜBER `scenesRef.current` (Fehler 2026-08-16):
    // `updateScene` ruft nur `setScenes`. Das Ref wird erst in einem EFFEKT nach
    // dem Rendern nachgezogen — hier, im selben Tick direkt hinter dem Patch,
    // steht darin also noch die Szene VON VORHER.
    //
    // Was daraus wurde: Der Assistent ändert die Felder korrekt, meldet „Das
    // Bild dazu wird gerade erzeugt" — und `generateSceneImage` rendert die ALTE
    // Fassung. Jede Änderung lag damit genau einen Lauf zurück. Am teuersten
    // beim Bildaufbau: Der Assistent stellt auf „nur Sprecher" um, das Bild
    // entsteht aber noch als Duo (`duoFrame` war im veralteten Objekt undefined
    // = an), und der Nutzer sieht wieder beide Personen nebeneinander stehen,
    // obwohl im Feld längst etwas anderes steht. Der Fehler ist unsichtbar: Es
    // kommt ja ein NEUES Bild, nur eben zum vorigen Stand.
    //
    // `syncScenes` liest den State über den Updater — das ist der einzige Weg,
    // den aktuellen Stand garantiert zu bekommen — und zieht das Ref gleich mit.
    const fresh = (await syncScenes()).find((s) => s.id === scene.id);
    if (!fresh) return applied;
    if (fresh.videoStatus === "done" && fresh.videoUrl) {
      // Bezahlter Clip: fragen, nie einfach wegwerfen. Sagt der Nutzer nein,
      // bleiben die Textänderungen trotzdem stehen — sie waren gewollt.
      if (!window.confirm(
        "Die Szene ist angepasst. Ein neues Bild dazu verwirft das fertige Video dieser Szene samt Vertonung.\n\nJetzt neues Bild erzeugen?",
      )) {
        return {
          ...applied,
          message: `${applied.message} Das Bild zeigt noch die alte Fassung — „Bild neu generieren“ holt es nach.`,
        };
      }
    }

    // BEWUSST OHNE `await`: Der Bildlauf dauert eine halbe Minute, und solange
    // hinge die Antwort im Chat fest — dort stünde „denkt nach…", während in
    // Wahrheit längst gerendert wird. Die Antwort geht also sofort zurück; dass
    // das Bild entsteht, zeigen die Kachel und die Schicht über den Feldern.
    // Ein zweiter Auftrag ist trotzdem gesperrt: `imageStatus: "loading"` steht
    // ab dem ersten Moment an der Szene, und daran hängt `sceneBusy` im Dialog.
    // Fehler fängt `generateSceneImage` selbst ab und schreibt sie an die Kachel.
    void generateSceneImage(fresh);
    return {
      ...applied,
      message: `${applied.message} Das Bild dazu wird gerade erzeugt.`,
    };
  };

  const clearStory = () => {
    // „Verwerfen" heisst: danach läuft NICHTS mehr und alles ist wieder startbar.
    //
    // Vorher wurde nur ein laufender DURCHGANG abgebrochen (`batchRef`). Eine
    // einzeln rendernde Szene lief weiter — und blieb dabei in `busyScenesRef`
    // reserviert. `generationBlocked()` meldete deshalb minutenlang „An einer
    // Szene wird gerade gearbeitet", der Generieren-Knopf war gesperrt, und der
    // Nutzer sah ein leeres Storyboard, das sich nicht neu erzeugen liess. Beim
    // wiederaufgenommenen Clip (`resumeVideoJob`) hing es sogar an einem
    // Poll-Fenster von bis zu zehn Minuten.
    //
    // Die noch laufenden Aufrufe können hier nichts mehr kaputt machen: ihre
    // `updateScene`-Patches suchen Szenen-IDs, die es nicht mehr gibt, und
    // verpuffen. Ihre späteren `releaseBatch(token)` laufen ins Leere, weil der
    // Token nicht mehr der aktuelle ist.
    const wasRunning = batchRef.current !== null || busyScenesRef.current.size > 0;

    abortRef.current = true;          // Schleifen brechen am nächsten Prüfpunkt ab
    runEpochRef.current++;            // …und starten nichts Neues mehr, auch nach einem neuen Lauf
    resumeAbortRef.current?.abort();  // laufendes Abholen ebenfalls beenden

    batchRef.current = null;
    busyScenesRef.current.clear();
    // `resumeCountRef`/`resumeAbortRef` NICHT von Hand zurücksetzen: das noch
    // laufende `runResumes` zählt in seinem `finally` selbst herunter und räumt
    // den Controller weg. Ein Reset hier machte den Zähler negativ — danach käme
    // kein Abhol-Lauf mehr sauber auf 0.
    resumeHandledRef.current.clear();
    setBusyTick((n) => n + 1);
    setGeneratingStoryboard(false);
    setGeneratingImages(false);
    setGeneratingVideos(false);

    if (wasRunning) {
      toast.info("Laufende Generierung abgebrochen — das Storyboard ist verworfen.");
    }

    setRunPhase(null);
    setScenes([]);
    setMainLocation("");
    // Die Situation gehört zum verworfenen Storyboard — genau wie mainLocation.
    setReelSituation(null);
    setExpandedSceneId(null);
    // Das fertige Reel gehört zu Clips, die es gerade nicht mehr gibt.
    setMergedReelUrl("");
    setMergedReelSig("");

    // ── DEN AKTIVEN SLOT LOSLASSEN, NICHT ÜBERSCHREIBEN ──────────────────────
    //
    // Der Auto-Save weiter oben schreibt den Live-Stand 900 ms später in den
    // aktiven Storyboard-Slot. Nach „Alles verwerfen" ist dieser Live-Stand
    // leer — der gespeicherte Slot, der in genau diesem Moment der einzige
    // Rettungsanker war, wurde also von der Rettungsfunktion selbst
    // ausgelöscht. Wer den Slot wirklich leeren will, überschreibt ihn in der
    // Slot-Leiste; das ist eine eigene, bewusste Handlung.
    if (projectId) setActiveSlotId(projectId, null);
  };

  const ac = aspectClass(aspect);

  // ============ Smart primary action ============
  // The orange button morphs based on what's already done:
  //   1. No scenes yet → "Storyboard + Bilder generieren"
  //   2. Scenes without images → "Alle Bilder generieren"
  //   3. All scenes have images, no videos yet (FULL) → "Alle Videos generieren"
  //   4. Everything done → "Alle Videos neu generieren"
  const sceneCount = scenes.length;
  // Eine Szene ist erst bebildert, wenn BEIDE Frames stehen. Zählte hier nur das
  // Startbild, gälte ein Reel mit fehlendem Endbild als fertig: die Phase spränge
  // auf „videos", der Knopf „Fehlende Bilder generieren" verschwände — und der
  // einzige verbleibende Weg wäre „Alle Bilder", das ALLES neu rendert und dabei
  // jeden bezahlten Clip verwirft. Für ein einzelnes fehlendes Endbild.
  // Seit dem Rückbau (2026-08-08) gibt es pro Szene nur noch EIN Bild — der
  // generierte Endframe ist abgeschafft, das Startbild allein zählt.
  const sceneImagesDone = (s: StoryScene) => s.imageStatus === "done";
  const imagesDone = sceneCount > 0 && scenes.every(sceneImagesDone);
  const anyImage = scenes.some((s) => s.imageStatus === "done");
  // Mit aktivem Voice-Lock gilt eine Szene erst als fertig, wenn auch ihre feste
  // Stimme drauf ist — sonst würde ein unvertontes Reel als „fertig" gelten.
  const videosDone = sceneCount > 0 && plan.videoGen &&
    scenes.every((s) => s.videoStatus === "done" && (!sceneNeedsVoice(s) || s.audioStatus === "done"));
  const anyVideo = scenes.some((s) => s.videoStatus === "done");

  /**
   * SICHERHEITSNETZ FÜR DIE LETZTE ETAPPE.
   *
   * Die Merge-Etappe wartet auf eine Rückmeldung des Mergers (`onMergeSettled`).
   * Ist der gar nicht montiert — weil es gerade keine fertigen Clips mehr gibt,
   * etwa nach einem verworfenen Storyboard oder einem neu erzeugten Bild —, käme
   * diese Rückmeldung nie, und die Fortschrittsanzeige bliebe für den Rest der
   * Sitzung auf „Clips werden zusammengefügt" stehen. Genau die Sorte
   * Anzeige-Lüge, die dieser Umbau abschaffen soll.
   */
  useEffect(() => {
    if (runPhase?.kind !== "merge") return;
    if (plan.videoGen && scenes.some((s) => s.videoStatus === "done")) return;
    endRunPhase("merge");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runPhase, scenes, plan.videoGen]);

  /**
   * DER GESAMTFORTSCHRITT — „Clip 5 von 8 · noch ca. 6 Min."
   *
   * Vorher stand während des ganzen Laufs derselbe Satz („Videos werden
   * gerendert…"), zwanzig Minuten lang, ohne eine einzige Zahl. Wer nicht
   * wusste, dass ein Clip minutenlang rendert, hielt die Seite für
   * hängengeblieben — und klickte.
   *
   * Die Restzeit rechnet mit dem GEMESSENEN Durchsatz dieses Laufs (verstrichene
   * Zeit ÷ hier fertig gewordene Stücke), nicht mit einer festen Zahl pro Stück.
   * Damit steckt die Parallelität (VIDEO_CONCURRENCY) automatisch drin, ohne
   * dass hier irgendwo durch eine Bahnzahl geteilt werden müsste — und eine
   * langsame Warteschlange beim Anbieter schlägt sofort auf die Schätzung durch,
   * statt sie zur Lüge zu machen. Solange noch nichts fertig ist, trägt der
   * Erfahrungswert; Bilder laufen dabei sequenziell, Clips zu dritt.
   */
  const runStatus = (() => {
    if (!runPhase) return null;
    const elapsedMs = Math.max(0, nowMs - runPhase.startedAt);
    if (runPhase.kind === "storyboard") {
      return { what: "Storyboard wird geschrieben", done: 0, total: 0, etaMs: null as number | null, elapsedMs };
    }
    if (runPhase.kind === "merge") {
      return { what: "Clips werden zusammengefügt", done: 0, total: 0, etaMs: null as number | null, elapsedMs };
    }
    const isImages = runPhase.kind === "images";
    const total = scenes.length;
    const done = isImages
      ? scenes.filter(sceneImagesDone).length
      : scenes.filter((s) => s.videoStatus === "done" && (!sceneNeedsVoice(s) || s.audioStatus === "done")).length;
    // Nur die Stücke zählen, die DIESER Lauf erzeugt hat — sonst rechnete ein
    // Nachzügler-Durchgang seinen Durchsatz über zwanzig längst fertige Clips
    // und meldete „noch 3 Sekunden".
    const madeHere = Math.max(0, done - runPhase.baseDone);
    const remaining = Math.max(0, total - done);
    const perItemMs = madeHere > 0
      ? elapsedMs / madeHere
      : (isImages ? IMAGE_EXPECTED_MS : VIDEO_EXPECTED_MS / VIDEO_CONCURRENCY);
    return {
      what: isImages ? "Bild" : "Clip",
      done, total,
      etaMs: remaining > 0 ? Math.round(remaining * perItemMs) : 0,
      elapsedMs,
    };
  })();

  /**
   * Welche Szenen kommen ins fertige Reel — und welche nicht?
   *
   * Beides aus EINER Quelle, damit die Liste unten und die Begründung daneben
   * nicht auseinanderlaufen können. Die Nummer stammt aus der ungefilterten
   * Szenenliste: vorher nummerierte der Merger nach dem Filtern durch, und aus
   * „Szene 3 fehlt" wurde stillschweigend eine Liste, in der Szene 4 als
   * „Szene 3" auftauchte. Der Zusammenschnitt sah dann vollständig aus.
   */
  const reelClipPlan = (() => {
    const inReel: { id: string; url: string; label: string; speechSec?: number }[] = [];
    const missing: string[] = [];
    scenes.forEach((s, i) => {
      const no = i + 1;
      const url = sceneFinalVideo(s);
      const voiceOk = !sceneNeedsVoice(s) || s.audioStatus === "done";
      if (s.videoStatus === "done" && url && voiceOk) {
        inReel.push({
          id: s.id,
          url,
          label: `Szene ${no}: ${s.summary}`,
          // DIE SPRECHDAUER IST BEKANNT — sie muss nicht gemessen werden.
          // Avatar-Clips sind laenger als ihr Ton (Kling haengt 0,3-2,7 s an,
          // dazu 0,2 s bewusster Nachhall aus dem Sprech-Trim). In dieser
          // Restzeit fuehrt kein Audio mehr den Mund, und die einzige Vorlage
          // des Modells ist ein Standbild mit OFFENEM Mund — daher der stumme
          // Sprechansatz am Clipende. Die Server-Automatik kann das nicht
          // kappen: sie sucht ein eingefrorenes Bild, und ein sich oeffnender
          // Mund ist Bewegung.
          speechSec: s.audioDurationSec,
        });
        return;
      }
      // Szenen ohne Vertonung werden bei aktivem Voice-Lock bewusst
      // AUSGESCHLOSSEN: ihr roher Clip trägt die zufällige Modellstimme, und
      // genau EINE solche Szene im Schnitt zerstört die Stimm-Konsistenz des
      // ganzen Reels — das, wofür die feste Stimme überhaupt existiert.
      // Ausgeschlossen heisst aber nicht verschwiegen.
      missing.push(
        `Szene ${no}: ${
          s.videoStatus === "done" && !voiceOk ? "Vertonung fehlt"
          : s.videoStatus === "error" ? "Clip fehlgeschlagen"
          : s.videoStatus === "loading" ? "Clip läuft noch"
          : "noch kein Clip"
        }`,
      );
    });

    // ══ DAS ENDE DES REELS BEKOMMT KEINEN NACHHALL ═══════════════════════════
    //
    // Überall sonst ist der 0,2-s-Beat hinter dem letzten Laut richtig: Er hält
    // den harten Schnitt davon ab, auf dem Schlusskonsonanten zu kleben, und was
    // in diesen fünf Frames (24 fps) noch passiert, verdeckt der nächste Schnitt.
    //
    // AM REEL-ENDE IST GENAU DIESER BEAT DER FEHLER (Nutzerbefund 2026-08-16:
    // „er sagt Power-Haltung, als würde er danach noch was sagen wollen — er
    // macht sogar den Mund auf"). Dort führt kein Ton mehr den Mund, und
    // `ai-avatar` hat als einzige Vorlage das Standbild — das per Prompt-Pflicht
    // einen OFFENEN Mund zeigt (der Lipsync-Anker, siehe buildSceneImagePrompt).
    // Das Modell läuft aus dem letzten Visem in genau diese Pose zurück. Danach
    // kommt kein Schnitt mehr, der es verdeckt: es IST das Ende.
    //
    // Die Zahl ist dieselbe wie `SPEECH_TAIL_HOLD_SEC` im Server. Sie steht hier
    // bewusst als eigene Konstante: dort ist sie die Regel für JEDEN Clip, hier
    // ist sie die Ausnahme für genau einen. Die Konstante dort zu ändern, würde
    // jeden Zwischenschnitt auf den Schlusskonsonanten kleben.
    const REEL_CLOSING_HOLD_SEC = 0.2;
    const closingClip = inReel[inReel.length - 1];
    // Untergrenze wie die Sicherheitsnetze des Servers: Was übrig bleibt, muss
    // als Schnittbild noch brauchbar sein.
    if (closingClip?.speechSec != null && closingClip.speechSec - REEL_CLOSING_HOLD_SEC >= 0.8) {
      closingClip.speechSec = +(closingClip.speechSec - REEL_CLOSING_HOLD_SEC).toFixed(3);
    }

    return { inReel, missing };
  })();

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
      // Mit Zahl: „Fehlende Bilder generieren" liest sich wie ein Fehler, wenn
      // jede Karte sichtbar ein Bild hat — es fehlt dann nämlich ein ENDbild,
      // und das zeigt die Kachel nur als kleines Badge.
      case "images": {
        if (!anyImage) return "Alle Bilder generieren";
        const missing = scenes.filter((s) => !sceneImagesDone(s)).length;
        return missing > 0
          ? `Fehlende Bilder generieren (${missing} ${missing === 1 ? "Szene" : "Szenen"})`
          : "Fehlende Bilder generieren";
      }
      case "videos":      return anyVideo ? "Fehlende Videos generieren" : "Alle Videos generieren";
      case "videos-redo": return "Alle Videos neu generieren";
    }
  })();

  const primaryAction = () => {
    switch (phase) {
      case "create":      return generateFullStory();
      case "images":      return generateAllImages({ onlyMissing: anyImage });
      // Mit Zustandsanschluss ersetzt dieser Lauf die Vorschaubilder der
      // Folgeszenen durch angeschlossene — aber nur bei Szenen ohne eigenen
      // Clip, damit kein bezahltes Veo-Video weggeworfen wird (siehe
      // `generateAllVideos`).
      case "videos":      return generateAllVideos();
      case "videos-redo": return generateAllVideos({ force: true });
    }
  };

  const primaryLoading = generatingStoryboard || generatingImages || generatingVideos;

  // ══ EINSTELLUNGS-ABGLEICH ══════════════════════════════════════════════════
  //
  // Die großen Schalter hängen voneinander ab, die UI zeigt sie aber als
  // unabhängige Kacheln. Nach jeder solchen Umstellung bietet dieser Ablauf an,
  // die betroffenen FELDER nachzuziehen — siehe src/lib/settingsSync.ts.
  //
  // AUSSCHLIESSLICH aus onClick/onChange aufgerufen, NIE aus einem Effekt: Ein
  // Projektwechsel oder ein Storyboard-Slot-Load setzt dieselben Werte
  // programmatisch neu (useProjectValue liest dann aus localStorage), und ein
  // wertbeobachtender Effekt würde danach einen KI-Lauf für etwas anbieten, das
  // niemand geklickt hat.
  const [syncState, setSyncState] = useState<{
    trigger: SyncTrigger;
    phase: SyncPhase;
    proposals: SyncProposal[];
  } | null>(null);
  // Gegen die verspätete Antwort: Ein abgebrochener Lauf darf die Liste eines
  // neueren nicht überschreiben. Dasselbe Ref-Muster wie beim Stapellauf.
  const syncRunRef = useRef(0);

  // Der Duo-Schalter existiert nur ab zwei Personen. Löscht der Nutzer während
  // des offenen Dialogs eine Referenz, verschwindet der Schalter — der Dialog
  // dazu muss dann mitgehen. Als Effekt zulässig, weil er nur SCHLIESST: Ein
  // Effekt, der den Dialog öffnete, ginge bei jedem Projektwechsel auf.
  useEffect(() => {
    if (syncState?.trigger.key === "duoStaging" && characters.length < 2) setSyncState(null);
  }, [characters.length, syncState]);

  const syncSnapshot = (): SyncSnapshot => ({
    idea, language, mode, reelStyle, actionLevel, duoStaging, voiceMode,
    enableSpeaker, reelOutro, artStyle, videoMood, colorMood, pacing,
    hook, cta, customDetails, mainLocation,
    situation: reelSituationRef.current,
    characterNames: characters.map((c) => c.name).filter(Boolean),
    // NUR die Anzahl. Die Szenen selbst sieht der Abgleich nie — er kann die
    // Story damit nicht umschreiben, weil er sie nicht in der Hand hat.
    sceneCount: scenesRef.current.length,
  });

  const requestSettingsSync = (trigger: SyncTrigger) => {
    if (mode !== "reel") return;
    // Ohne Key gibt es nichts anzubieten — dann lieber stumm bleiben, statt eine
    // Fehlermeldung für etwas zu zeigen, das der Nutzer gar nicht wollte.
    if (!hasGenKey) return;
    if (syncState) return;
    const blocked = generationBlocked();
    if (blocked) { toast.info(blocked); return; }
    // Sind alle betroffenen Felder leer, gibt es nichts nachzuziehen. Bei Hook
    // und CTA ist leer sogar die bessere Einstellung: sie werden vor dem
    // Storyboard automatisch geschrieben — und zwar bereits im richtigen Ton.
    const snap = syncSnapshot();
    if (!SYNC_SCOPE[trigger.key].some((k) => readSyncField(snap, k).trim())) return;
    setSyncState({ trigger, phase: "ask", proposals: [] });
  };

  const runSettingsSync = async () => {
    if (!syncState) return;
    const { trigger } = syncState;
    const scope = SYNC_SCOPE[trigger.key];
    const run = ++syncRunRef.current;
    setSyncState((s) => (s ? { ...s, phase: "loading" } : s));
    try {
      const raw = await generateText(genChain, {
        prompt: buildSettingsSyncPrompt({
          trigger,
          snapshot: syncSnapshot(),
          scope,
          profileContext: buildProfilePreamble(projectProfile),
        }),
        json: true,
        // Wie beim Szenen-Assistenten: hier wird eine Vorgabe UMGESETZT, nicht
        // etwas erfunden. Zwei Läufe mit derselben Lage sollen dasselbe ergeben.
        temperature: 0.4,
        maxOutputTokens: 1200,
      });
      if (syncRunRef.current !== run) return;
      const proposals = parseSettingsSync(extractJson(raw), syncSnapshot(), scope);
      if (!proposals.length) {
        setSyncState(null);
        toast.info("Passt alles — es gibt nichts anzupassen.");
        return;
      }
      setSyncState({ trigger, phase: "review", proposals });
    } catch (e: any) {
      if (syncRunRef.current !== run) return;
      setSyncState(null);
      const err = e instanceof AIError ? e : null;
      toast.error(err?.message ?? "Der Abgleich hat nicht geklappt.", { description: err?.hint });
    }
  };

  /**
   * Der Setter-Tisch — und zugleich die härteste der vier Story-Sperren.
   *
   * Er ist ein `Record<SyncFieldKey, …>`: Ein Eintrag für `idea` oder `scenes`
   * wäre ein Compile-Fehler, weil diese Schlüssel in der Union gar nicht
   * vorkommen. Die Story ist damit nicht „verboten", sondern unerreichbar.
   */
  const SYNC_SETTERS: Record<SyncFieldKey, (v: string) => void> = {
    hook: setHook,
    cta: setCta,
    customDetails: setCustomDetails,
    mainLocation: setMainLocation,
    videoMood: setVideoMood,
    pacing: setPacing,
    "situation.activity": (v) => setReelSituation((s) => ({ ...(s ?? EMPTY_REEL_SITUATION), activity: v })),
    "situation.setting": (v) => setReelSituation((s) => ({ ...(s ?? EMPTY_REEL_SITUATION), setting: v })),
    "situation.outfit": (v) => setReelSituation((s) => ({ ...(s ?? EMPTY_REEL_SITUATION), outfit: v })),
    "situation.cameraSetup": (v) => setReelSituation((s) => ({ ...(s ?? EMPTY_REEL_SITUATION), cameraSetup: v })),
  };

  const applySettingsSync = (picked: SyncProposal[]) => {
    picked.forEach((p) => SYNC_SETTERS[p.key](p.after));
    setSyncState(null);
    toast.success(
      picked.length === 1 ? "Ein Feld angepasst." : `${picked.length} Felder angepasst.`,
      { description: picked.map((p) => p.label).join(" · ") },
    );
  };

  return (
    <PlanGate requires="full" feature="Der Storyboard / Reel Generator">
      <PageHeader
        title="Reel-Generator"
        subtitle="Geh von oben nach unten durch — ganz unten steht am Ende dein fertiges Reel."
        badge={<Badge tone="cool"><Film className="w-3 h-3" /> Premium</Badge>}
        cta={<TutorialCTA tutorialId="story" />}
      />

      <div className="max-w-4xl mx-auto space-y-3">
        {/* Die Landkarte: wie viele Etappen es gibt und wo man steht. Vorher
            musste man das aus der wechselnden Beschriftung EINES Knopfes raten.
            Der Hochkant/Quer-Umschalter stand früher daneben; das Seitenverhältnis
            wird jetzt allein über „Bildformat" in Schritt 2 gewählt. */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <PipelineSteps
            steps={[
              { label: "Szenen", state: generatingStoryboard ? "running" : scenes.length ? "done" : "todo" },
              { label: "Bilder", state: generatingImages ? "running" : (scenes.length > 0 && imagesDone) ? "done" : "todo" },
              { label: "Clips",  state: generatingVideos ? "running" : (scenes.length > 0 && videosDone) ? "done" : "todo" },
              { label: "Fertiges Reel", state: (scenes.length > 0 && videosDone) ? "todo" : "todo" },
            ]}
          />
        </div>

        {/* Save-Slots — bis zu 3 Storyboards pro Projekt speichern/laden */}
        <StoryboardSlotsBar />
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
          {/* ══ SCHRITT 1 ══ */}
          <StepCard
            step={1}
            title="Wer ist zu sehen?"
            intro="Lade bis zu drei Personen hoch und gib ihnen Namen — die Story benutzt genau diese Namen."
            status={refs.length ? `${refs.length} ${refs.length === 1 ? "Person" : "Personen"}` : null}
            advKey="story:ui:adv1"
            advanced={
              <p className="text-[11px] text-ink-50/45 leading-relaxed">
                Drag &amp; Drop funktioniert auch direkt ins Feld. Die Bilder dienen als Identity-Lock:
                Gesicht, Haare und Statur bleiben über alle Szenen gleich.
              </p>
            }
          >
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
                    {/* KI liest die Karte aus dem Foto — erscheint beim Hover,
                        wie das X daneben.
                        AUSNAHME: während der Lauf läuft, bleibt der Knopf
                        stehen. Sonst verschwände der Spinner, sobald die Maus
                        die Karte verlässt, und der einzige Hinweis darauf, dass
                        gerade etwas passiert, wäre weg. */}
                    <button
                      type="button"
                      onClick={() => void readCharacterFromPhoto(i)}
                      disabled={readingCharacter !== null}
                      className={cn(
                        "absolute top-1.5 right-9 w-7 h-7 rounded-full bg-ink-950/85 backdrop-blur flex items-center justify-center text-flare-300 transition-all hover:bg-flare-500/25 hover:scale-110 active:scale-95 disabled:cursor-not-allowed",
                        // Bewusst KEIN `disabled:opacity-…` daneben: welche der
                        // beiden Varianten gewinnt, entscheidet in Tailwind die
                        // Reihenfolge im erzeugten Stylesheet, nicht die im
                        // Attribut — das wäre eine Wette, keine Regel.
                        readingCharacter === i ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                      )}
                      title="Von der KI ausfüllen lassen — Aussehen aus diesem Foto, Kleidung passend zum Projekt (nicht die aus dem Foto)."
                      aria-label={`Charakter ${i + 1} von der KI ausfüllen lassen`}
                    >
                      {readingCharacter === i
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Sparkles className="w-3.5 h-3.5" />}
                    </button>
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
                      // Der Platzhalter hieß „Person 1" und sah damit aus wie ein
                      // bereits gesetzter Wert — leer blieb unsichtbar, bis im
                      // fertigen Storyboard „Person 1" sprach. Jetzt sagt das
                      // Feld, dass es eine Eingabe ERWARTET, und der leere
                      // Zustand ist am Rahmen erkennbar.
                      placeholder="Name eingeben"
                      title={characterNames[i]?.trim() ? undefined : "Pflicht — die Story benutzt genau diesen Namen."}
                      className={cn(
                        "w-full px-2.5 py-1.5 rounded-lg bg-ink-800/60 border text-xs font-medium text-center text-ink-50 placeholder:text-ink-50/35 outline-none transition-colors focus:bg-ink-800 focus:border-flare-400/40",
                        characterNames[i]?.trim() ? "border-white/8" : "border-warn/45",
                      )}
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

                    {/* Description — AUSSEHEN, nicht Kleidung. Der Platzhalter
                        nannte früher „rote Jacke": das mischte Identität und
                        Garderobe in ein Feld, und der Prompt konnte beides nicht
                        trennen. Kleidung hat jetzt ihr eigenes Feld darunter. */}
                    <textarea
                      value={characterDescriptions[i] || ""}
                      onChange={(e) =>
                        setCharacterDescriptions((arr) =>
                          arr.map((x, j) => (j === i ? e.target.value : x)),
                        )
                      }
                      placeholder="Aussehen: Brille, Bart, Ende 40…"
                      rows={2}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-ink-800/60 border border-white/8 text-[11px] leading-snug text-ink-50 placeholder:text-ink-50/35 outline-none transition-colors focus:bg-ink-800 focus:border-flare-400/40 resize-none"
                    />

                    {/* Kleidung — bewusst ein EIGENES Feld. Das Referenzfoto ist
                        ein Porträt: was die Person darauf trägt, ist Zufall der
                        Aufnahme und darf das Reel nicht einkleiden. */}
                    <input
                      value={characterOutfits[i] || ""}
                      onChange={(e) =>
                        setCharacterOutfits((arr) => {
                          const next = [...arr];
                          while (next.length <= i) next.push("");
                          next[i] = e.target.value;
                          return next;
                        })
                      }
                      placeholder="Kleidung: dunkelblaues Hemd…"
                      title="Was die Person im Reel trägt. Leer lassen = die KI wählt etwas zum Ort Passendes. Das Referenzfoto gibt die Kleidung NICHT vor."
                      className="mt-1.5 w-full px-2.5 py-1.5 rounded-lg bg-ink-800/60 border border-white/8 text-[11px] leading-snug text-ink-50 placeholder:text-ink-50/35 outline-none transition-colors focus:bg-ink-800 focus:border-flare-400/40"
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
          </StepCard>

          {/* ══ SCHRITT 2 ══ */}
          <StepCard
            step={2}
            /* „Video/Reel", nicht nur „Reel": im Bildformat darunter steht 16:9
               zur Wahl, und das IST ein Video und kein Reel. Die alte Überschrift
               ließ die Querformat-Wahl wie eine Reel-Variante aussehen. */
            title="Was für ein Video/Reel wird das?"
            intro="Die Erzählform bestimmt, wie die Szenen geschnitten werden."
            status={mode === "reel"
              ? [REEL_STYLES.find((s) => s.value === reelStyle)?.label,
                 ACTION_LEVELS.find((a) => a.value === actionLevel)?.label].filter(Boolean).join(" · ") || null
              : null}
            advKey="story:ui:adv2"
            advanced={
              <>
                <Select label="Bildformat" value={aspect} onChange={(e) => setAspect(e.target.value)} options={VIDEO_ASPECT_RATIOS.map((a) => ({ value: a.value, label: a.label }))} />
                {mode === "reel" && (
                  <div className="text-sm text-ink-50/80 p-3 rounded-xl border border-white/8 bg-ink-900/40">
                    <div className="font-medium text-ink-50">Harte Schnitte</div>
                    <div className="text-[11px] text-ink-50/55 mt-0.5 leading-tight">
                      {reelStyle === "vlog"
                        ? "Reels werden immer mit deutlich sichtbaren harten Schnitten montiert — im Vlog-Stil als reine Zeitsprünge: gleicher Ort, gleicher Kameraaufbau, nur die Person steht anders da. Keine Überblendungen, kein Morph."
                        : "Reels werden immer mit deutlich sichtbaren harten Schnitten montiert — jede Szene ist ein neues Kamera-Setup. Keine Überblendungen, kein Morph."}
                    </div>
                  </div>
                )}
              </>
            }
          >
              {mode === "reel" && (
                <div className="space-y-1.5 max-w-md">
                  <div className="text-xs font-medium text-ink-50">Reel-Stil</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {REEL_STYLES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => {
                          if (s.value === reelStyle) return;
                          const from = REEL_STYLES.find((x) => x.value === reelStyle)?.label ?? "";
                          // Bewusst `setReelStyle` und NICHT `setReelStyleDefault`:
                          // Nur der erste Wert wird gespeichert, der zweite ist
                          // die einmalige Vorbelegung beim Projekt-Load.
                          setReelStyle(s.value);
                          requestSettingsSync({
                            key: "reelStyle",
                            title: "Reel-Stil",
                            fromLabel: from,
                            toLabel: s.label,
                          });
                        }}
                        title={s.hint}
                        className={cn(
                          "text-left rounded-xl border px-3 py-2 transition-all active:scale-[0.98]",
                          reelStyle === s.value
                            ? "border-flare-400/70 bg-flare-500/15"
                            : "border-white/10 bg-ink-900/40 hover:border-flare-400/30",
                        )}
                      >
                        <div className={cn("text-xs font-medium", reelStyle === s.value ? "text-flare-200" : "text-ink-50/80")}>
                          {s.label}
                        </div>
                        <div className="text-[10px] text-ink-50/50 mt-0.5 leading-tight">{s.hint}</div>
                      </button>
                    ))}
                  </div>

                  {/* Outro nur im Vlog-Stil: im Explainer ist ohnehin jede Szene
                      ein neuer Kontext, da gäbe es nichts auszubrechen. */}
                  {reelStyle === "vlog" && (
                    <label className="flex items-start gap-2 cursor-pointer p-3 rounded-xl border border-white/8 bg-ink-950/55 hover:border-flare-400/30 transition-colors">
                      <input
                        type="checkbox"
                        checked={reelOutro}
                        onChange={(e) => setReelOutro(e.target.checked)}
                        className="rounded mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-ink-50">Outro-Szene</div>
                        <div className="text-[11px] text-ink-50/55 mt-0.5 leading-tight">
                          Letzte Szene schneidet hart in einen anderen Kontext (z. B. nach draußen).
                          Braucht mindestens 3 Szenen.
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              )}

              {/* Der Schalter steuert ZWEI Dinge, die zusammengehören: Stärke und
                  Häufigkeit der Handlungen — und den TON des Gesprochenen. Beides
                  entsteht im Storyboard (dort wird die keyAction UND der
                  dialogText geschrieben) und wirkt danach auf Standbild und Clip.
                  Deshalb steht er hier oben bei der Erzählform und nicht in den
                  Feineinstellungen.
                  Anders als der Duo-Block darunter gilt er IMMER, auch bei einer
                  einzigen Person. */}
              <div className="space-y-1.5 max-w-md mt-4">
                <div className="text-xs font-medium text-ink-50">Wie tritt die Person auf?</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {ACTION_LEVELS.map((a) => (
                    <button
                      key={a.value}
                      type="button"
                      onClick={() => {
                        // Klick auf die BEREITS aktive Kachel ist keine
                        // Änderung — ohne diesen Riegel ginge der Abgleich
                        // jedes Mal aufs Neue auf.
                        if (a.value === actionLevel) return;
                        const from = ACTION_LEVELS.find((x) => x.value === actionLevel)?.label ?? "";
                        setActionLevel(a.value);
                        requestSettingsSync({
                          key: "actionLevel",
                          title: "Wie tritt die Person auf?",
                          fromLabel: from,
                          toLabel: a.label,
                        });
                      }}
                      title={a.hint}
                      className={cn(
                        "text-left rounded-xl border px-3 py-2 transition-all active:scale-[0.98]",
                        actionLevel === a.value
                          ? "border-flare-400/70 bg-flare-500/15"
                          : "border-white/10 bg-ink-900/40 hover:border-flare-400/30",
                      )}
                    >
                      <div className={cn("text-xs font-medium", actionLevel === a.value ? "text-flare-200" : "text-ink-50/80")}>
                        {a.label}
                      </div>
                      <div className="text-[10px] text-ink-50/50 mt-0.5 leading-tight">{a.hint}</div>
                    </button>
                  ))}
                </div>
                {/* Die Erwartung geradeziehen: Die Handlung wird im STORYBOARD
                    geschrieben. Ein Wechsel bei fertigen Szenen ändert deren
                    keyAction nicht — Bild und Clip erfinden keine Geste dazu. */}
                <div className="text-[10px] text-ink-50/40 leading-tight">
                  Wirkt auf das Gesprochene, das Bild und den Clip. Nach dem Umschalten musst du das
                  Storyboard neu erzeugen — bei fertigen Szenen stehen Text und Handlung schon fest.
                </div>
                {actionLevel === "active" && (
                  <div className="text-[10px] text-ink-50/40 leading-tight">
                    Pro Szene bleibt es bei EINER Handlung: Der Clip entsteht aus einem einzigen Bild.
                    Hände und Gegenstände bleiben dabei aus dem Gesicht — darauf läuft die Lippensynchronisation.
                  </div>
                )}
              </div>

              {/* Zwei Personen: reden sie zum Zuschauer oder miteinander? Die
                  Wahl wirkt auf das Duo-Standbild, den Clip UND den Sprechtext —
                  deshalb steht sie hier oben bei der Erzählform und nicht bei
                  den Feineinstellungen. Nur sichtbar, wenn es überhaupt zwei
                  Charaktere gibt; darunter gibt es keine Duo-Szenen. */}
              {characters.length >= 2 && (
                <div className="space-y-1.5 max-w-md mt-4">
                  <div className="text-xs font-medium text-ink-50">Wenn zwei Personen in einer Szene sind</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DUO_STAGINGS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => {
                          if (s.value === duoStaging) return;
                          const from = DUO_STAGINGS.find((x) => x.value === duoStaging)?.label ?? "";
                          setDuoStaging(s.value);
                          requestSettingsSync({
                            key: "duoStaging",
                            title: "Wenn zwei Personen in einer Szene sind",
                            fromLabel: from,
                            toLabel: s.label,
                          });
                        }}
                        title={s.hint}
                        className={cn(
                          "text-left rounded-xl border px-3 py-2 transition-all active:scale-[0.98]",
                          duoStaging === s.value
                            ? "border-flare-400/70 bg-flare-500/15"
                            : "border-white/10 bg-ink-900/40 hover:border-flare-400/30",
                        )}
                      >
                        <div className={cn("text-xs font-medium", duoStaging === s.value ? "text-flare-200" : "text-ink-50/80")}>
                          {s.label}
                        </div>
                        <div className="text-[10px] text-ink-50/50 mt-0.5 leading-tight">{s.hint}</div>
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-ink-50/40 leading-tight">
                    Wirkt auf Bild, Clip und Sprechtext. Wechselst du das nachträglich, müssen die
                    betroffenen Szenen neu erzeugt werden.
                  </div>
                  {/* Die eine Ausnahme sichtbar machen: wer „miteinander" wählt,
                      soll nicht überrascht sein, dass sich beide im Schlussclip
                      zur Kamera drehen. Der CTA spricht das Publikum an — und
                      dabei den Partner anzusehen, wäre der eigentliche Bruch. */}
                  {duoStaging === "conversation" && (
                    <div className="text-[10px] text-ink-50/40 leading-tight">
                      Ausnahme: In der letzten Szene wenden sich beide der Kamera zu — dort läuft der
                      Call-to-Action, und der geht an den Zuschauer.
                    </div>
                  )}
                </div>
              )}
          </StepCard>

          {/* ══ SCHRITT 3 ══ */}
          <StepCard
            step={3}
            title="Worum geht's?"
            intro="Ein bis drei Sätze. Du kannst sie tippen, einen Vorschlag anklicken oder schreiben lassen."
            status={idea.trim() ? "Idee steht" : null}
            advKey="story:ui:adv3"
            advanced={
              <>
                <SuggestionField
                  label={mode === "reel" ? "Hook (leer = wird automatisch geschrieben)" : "Hook (optional)"}
                  value={hook}
                  onChange={setHook}
                  placeholder={mode === "reel" ? 'z.B. „Albert Einstein hat gelogen."' : "Optionaler Eröffnungs-Beat"}
                  hint={mode === "reel"
                    ? "Der erste Satz, in die Kamera gerufen. Leer lassen: Die KI schreibt ihn passend zu Profil und Story und trägt ihn hier ein."
                    : undefined}
                  emptyHint="Wähle einen Hook oder schreib deinen eigenen…"
                  items={briefSuggest.get("hook")}
                  loading={briefSuggest.busy("hook")}
                  onReroll={() => briefSuggest.reroll("hook")}
                />

                <SuggestionField
                  as="textarea"
                  label="Custom Details (optional)"
                  rows={3}
                  value={customDetails}
                  onChange={setCustomDetails}
                  placeholder="Branche, Zielgruppe, Besonderheiten, Tabu-Themen — alles was die KI wissen sollte."
                  emptyHint="Wähle Details oder schreib deine eigenen…"
                  items={briefSuggest.get("customDetails")}
                  loading={briefSuggest.busy("customDetails")}
                  onReroll={() => briefSuggest.reroll("customDetails")}
                />

                {/* Call-to-Action. Er wird GESPROCHEN, in der letzten Szene,
                    nicht als Overlay eingeblendet: im Erzähl-Reel trägt die
                    Stimme, ein Textbanner wäre der einzige Fremdkörper im Bild.
                    Leer lassen heißt jetzt „automatisch" (siehe
                    `ensureHookAndCta`), nicht mehr „gar kein CTA". */}
                <SuggestionField
                  label="Call-to-Action (leer = wird automatisch geschrieben)"
                  value={cta}
                  onChange={setCta}
                  placeholder='z.B. „Schreib mir Reel in die Kommentare."'
                  hint="Wird in der letzten Szene gesprochen. Leer lassen: Die KI schreibt ihn passend zu Profil und Story und trägt ihn hier ein."
                  emptyHint="Wähle einen CTA oder schreib deinen eigenen…"
                  items={briefSuggest.get("cta")}
                  loading={briefSuggest.busy("cta")}
                  onReroll={() => briefSuggest.reroll("cta")}
                />
                <label className="flex items-start gap-2 text-sm text-ink-50/80 cursor-pointer p-3 rounded-xl border border-white/8 bg-ink-900/40 hover:border-flare-400/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={enableSceneDescription}
                    onChange={(e) => setEnableSceneDescription(e.target.checked)}
                    className="rounded mt-0.5"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-ink-50">Szenenbeschreibungen von der KI schreiben lassen</div>
                    <div className="text-[11px] text-ink-50/55 mt-0.5 leading-tight">
                      Aus = du schreibst die Beschreibung jeder Szene selbst im Detail-Dialog.
                    </div>
                  </div>
                </label>
              </>
            }
          >
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
                            className="w-12 h-6 text-xs text-center rounded border border-white/30 bg-pure text-[#11141d] font-medium focus:outline-none focus:border-flare-400 focus:ring-1 focus:ring-flare-400/30"
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
                  {/* Im leeren Briefing-Feld stehen drei Aufträge, die der
                      Assistent gerade übernehmen könnte — genau wie links die
                      Ideen im leeren Ideenfeld. Vorher verlangte das Feld, dass
                      man selbst auf eine Formulierung kommt, obwohl die KI aus
                      dem Profil längst weiß, worum es geht. Ein Klick füllt das
                      Feld, abgeschickt wird weiterhin per Knopf oder Enter. */}
                  <SuggestionField
                    as="textarea"
                    className="flex-1"
                    fieldClassName="h-full min-h-[160px]"
                    rows={8}
                    value={aiAssistantInput}
                    onChange={setAiAssistantInput}
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
                    emptyHint="Der Assistent könnte…"
                    cacheKey={`story:assistant:${mode}:${generatedIdeas.length > 0 ? "adjust" : "new"}`}
                    kind="instruction"
                    what={generatedIdeas.length > 0
                      ? "die bereits erzeugte Story-Idee ändern lassen"
                      : `eine ${mode === "reel" ? "Reel-Idee" : "Story-Idee"} von Grund auf schreiben lassen`}
                    context={generatedIdeas.length > 0
                      ? `Aktuelle Idee: "${idea.slice(0, 400)}"`
                      : mode === "reel"
                        ? "Erklär-/Erzähl-Reel: Das Gesprochene trägt, die Person bleibt ruhig."
                        : "Storyboard mit Handlung über mehrere Szenen."}
                  />

                  {/* Die erzeugten Vorschläge zum ANKLICKEN.
                      Vorher landete stumm die erste Variante links, und die
                      übrigen erreichte man nur über die ‹ ›-Pfeile darüber —
                      man musste also erst merken, dass es sie gibt, und sich
                      dann durchklicken, ohne zu sehen, was kommt. Hier stehen
                      sie nebeneinander, ein Klick setzt die Idee links. */}
                  {generatedIdeas.length > 1 && (
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-ink-50/40">
                        Vorschläge — klick einen an
                      </div>
                      {generatedIdeas.map((g, gi) => (
                        <button
                          key={gi}
                          type="button"
                          onClick={() => { setCurrentIdeaIndex(gi); setIdea(g); }}
                          disabled={generatingIdea}
                          className={cn(
                            "w-full text-left px-2.5 py-1.5 rounded-lg border text-[11px] leading-snug transition-colors disabled:opacity-40",
                            gi === currentIdeaIndex
                              ? "border-flare-400/50 bg-flare-500/10 text-ink-50"
                              : "border-white/8 bg-ink-950/40 text-ink-50/65 hover:border-white/20 hover:text-ink-50",
                          )}
                          title="Diese Idee links übernehmen"
                        >
                          <span className="font-medium text-flare-300 mr-1.5">{gi + 1}</span>
                          <span className="line-clamp-2">{g}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            <Select
              label="Sprache aller Texte"
              value={language}
              onChange={(e) => {
                const next = e.target.value;
                if (next === language) return;
                const nameOf = (v: string) => STORY_LANGUAGES.find((l) => l.value === v)?.label ?? v;
                const from = nameOf(language);
                setLanguage(next);
                // Der Sprachwechsel ist der Auslöser mit dem größten Umfang: Hook,
                // CTA, Details, Ort und Situation stehen danach alle noch in der
                // alten Sprache und gehen wortgleich in die Prompts.
                requestSettingsSync({ key: "language", title: "Sprache aller Texte", fromLabel: from, toLabel: nameOf(next) });
              }}
              options={STORY_LANGUAGES}
            />
          </StepCard>

          {/* ══ SCHRITT 4 ══ */}
          <StepCard
            step={4}
            title="Wer spricht — und wie klingt das?"
            intro="Erst der Text, dann die Stimme."
            status={enableSpeaker ? "Feste Stimme" : "Stumm"}
            advKey="story:ui:adv4"
          >
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-50/40">Text</div>
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
                    onClick={() => {
                      const next = !enableSpeaker;
                      setEnableSpeaker(next);
                      // Nur beim EINschalten gibt es etwas nachzuziehen. Aus
                      // heißt: es wird gar nicht gesprochen — dann sind Hook und
                      // CTA gegenstandslos, aber nicht falsch, und sie beim
                      // nächsten Einschalten noch vorzufinden ist das Richtige.
                      if (next) {
                        requestSettingsSync({ key: "enableSpeaker", title: "Sprechertext / Dialog", fromLabel: "Aus", toLabel: "An" });
                      }
                    }}
                    className={cn(
                      "h-6 w-11 rounded-full transition-colors flex-shrink-0 flex items-center p-0.5",
                      enableSpeaker ? "bg-flare-500 justify-end" : "bg-ink-700 justify-start",
                    )}
                    title={enableSpeaker ? "Sprechertext aus" : "Sprechertext an"}
                  >
                    <span className="block h-5 w-5 rounded-full bg-pure shadow" />
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
                        onClick={() => {
                          if (voiceMode === "sprecher") return;
                          setVoiceMode("sprecher"); setGenerationDirection("speaker-from-description");
                          requestSettingsSync({ key: "voiceMode", title: "Sprechertext", fromLabel: "Dialog", toLabel: "Sprecher" });
                        }}
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
                        onClick={() => {
                          if (voiceMode === "dialog") return;
                          setVoiceMode("dialog"); setGenerationDirection("speaker-from-description");
                          requestSettingsSync({ key: "voiceMode", title: "Sprechertext", fromLabel: "Sprecher", toLabel: "Dialog" });
                        }}
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
            <div className="text-[11px] font-medium uppercase tracking-wider text-ink-50/40 pt-2 border-t border-white/8">Stimme</div>
              {plan.videoGen && enableSpeaker && (
                <VoicePicker
                  voiceName={voiceName}
                  onVoiceNameChange={setVoiceName}
                  voiceSpeed={voiceSpeed}
                  onVoiceSpeedChange={setVoiceSpeed}
                  voiceStability={voiceStability}
                  onVoiceStabilityChange={setVoiceStability}
                  voiceMode={voiceMode}
                  characters={characters}
                  characterVoices={characterVoices}
                  onCharacterVoiceChange={(name, voice) =>
                    setCharacterVoices((prev) => ({ ...prev, [name]: voice }))}
                  language={language}
                  falKey={falKey}
                  elevenKey={elevenKey}
                  // Stand bisher zwei Karten entfernt unter „Stil & Tonalität",
                  // obwohl es nur die Vorauswahl in der Stimmenliste direkt
                  // darunter setzt. Der Zusammenhang war nicht erkennbar.
                  genderSlot={
                    <Select
                      label="Stimme klingt nach"
                      hint="Legt die Vorauswahl in der Liste darunter fest."
                      value={speakerGender}
                      onChange={(e) => setSpeakerGender(e.target.value as any)}
                      options={[
                        { value: "neutral", label: "Neutral" },
                        { value: "male",    label: "Männlich" },
                        { value: "female",  label: "Weiblich" },
                      ]}
                    />
                  }
                />
              )}
            {/* Vorher verschwand der ganze Stimmen-Bereich ersatzlos, wenn eine
                der beiden Bedingungen fehlte — der Nutzer konnte nicht sehen,
                dass es ihn überhaupt gibt. */}
            {!plan.videoGen && (
              <LockedRow title="Immer dieselbe Stimme" reason="Feste Stimmen brauchen den Video-Plan." />
            )}
            {plan.videoGen && !enableSpeaker && (
              <LockedRow title="Immer dieselbe Stimme" reason={'Ist oben unter „Im Reel wird gesprochen“ abgeschaltet.'} />
            )}
          </StepCard>

          {/* ══ SCHRITT 5 ══ */}
          <StepCard
            step={5}
            title="Wie soll es aussehen?"
            intro="Bildstil, Stimmung und Farben gelten für alle Szenen."
            advKey="story:ui:adv5"
            advanced={
              <>
                {mode === "reel" ? (
                  <>
                  <div className="text-sm text-ink-50/80 p-3 rounded-xl border border-white/8 bg-ink-900/40">
                    <div className="font-medium text-ink-50">Harte Schnitte</div>
                    {/* Beide Reel-Stile schneiden hart — nur WAS sich am Schnitt
                        ändert, ist ein anderes: beim Explainer der ganze Aufbau,
                        beim Vlog nur die verstrichene Zeit. */}
                    <div className="text-[11px] text-ink-50/55 mt-0.5 leading-tight">
                      {reelStyle === "vlog"
                        ? "Reels werden immer mit deutlich sichtbaren harten Schnitten montiert — im Vlog-Stil als reine Zeitsprünge: gleicher Ort, gleicher Kameraaufbau, nur die Person steht anders da. Keine Überblendungen, kein Morph."
                        : "Reels werden immer mit deutlich sichtbaren harten Schnitten montiert — jede Szene ist ein neues Kamera-Setup. Keine Überblendungen, kein Morph."}
                    </div>
                  </div>
                  {/* Zustandsanschluss — nur im Vlog-Stil sinnvoll (dort ist es
                      derselbe Ort und dieselbe Person über alle Clips) und nur
                      mit Video-Plan, weil ohne Clips kein Endframe entsteht.
                      Kein Widerspruch zu „Nahtlose Übergänge": der Schalter dort
                      ist im Reel gar nicht verfügbar (seamlessActive ist im Reel
                      immer false), und `carryOverActive` schließt ihn zusätzlich
                      hart aus. */}
                  {vlogActive && plan.videoGen && (
                    <label className="flex items-start gap-2 text-sm text-ink-50/80 cursor-pointer p-3 rounded-xl border border-white/8 bg-ink-900/40 hover:border-flare-400/30 transition-colors">
                      <input
                        type="checkbox"
                        checked={stateCarryOver}
                        onChange={(e) => setStateCarryOver(e.target.checked)}
                        className="rounded mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-ink-50">Zustand aus dem letzten Clip übernehmen</div>
                        {/* Der zweite Absatz („Bilder und Videos laufen abwechselnd,
                            der Button erzeugt das ganze Reel inklusive Clips") beschrieb
                            den verschränkten Lauf — der ist ersetzt, der Code dafür tot.
                            Was der Schalter WIRKLICH noch tut, steht jetzt hier. */}
                        <div className="text-[11px] text-ink-50/55 mt-0.5 leading-tight">
                          Erzeugst du ein einzelnes Bild neu, orientiert es sich am Ende des vorherigen Clips —
                          steht die Person dort, sitzt sie im neuen Bild nicht wieder. Braucht einen bereits
                          fertigen Clip davor. Der Schnitt bleibt hart.
                        </div>
                      </div>
                    </label>
                  )}
                  </>
                ) : (
                  <label className="flex items-start gap-2 text-sm text-ink-50/80 cursor-pointer p-3 rounded-xl border border-white/8 bg-ink-900/40 hover:border-flare-400/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={continuityMode}
                      onChange={(e) => setContinuityMode(e.target.checked)}
                      className="rounded mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-ink-50">Nahtlose Übergänge</div>
                      {/* Früher: „Das Ende von Video N wird zum Anfang (und Bild) von
                          N+1 … läuft dann sequenziell." Beides stimmt nicht mehr — die
                          Frame-Weitergabe hängt jetzt pro Szene am Übergang „fließend",
                          und der Video-Lauf ist immer parallel. */}
                      <div className="text-[11px] text-ink-50/55 mt-0.5 leading-tight">
                        Weist das Video-Modell an, die Clips ineinander laufen zu lassen statt hart zu schneiden.
                        Ob zwei Szenen wirklich verschmelzen, entscheidet das Storyboard pro Übergang.
                      </div>
                    </div>
                  </label>
                )}
              </>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <Select label="Bildstil" value={artStyle} onChange={(e) => setArtStyle(e.target.value)} options={STORY_ART_STYLES.map((s) => ({ value: s.value, label: s.label }))} />
              <Select label="Stimmung" value={videoMood} onChange={(e) => setVideoMood(e.target.value)} options={STORY_MOOD_OPTIONS} />
              <Select label="Farben" value={colorMood} onChange={(e) => setColorMood(e.target.value)} options={STORY_COLOR_OPTIONS} />
              <Select label="Tempo" value={pacing} onChange={(e) => setPacing(e.target.value)} options={STORY_PACING_OPTIONS} />
            </div>
          </StepCard>

          {/* ══ SCHRITT 6 ══ */}
          <StepCard
            step={6}
            title="Reel bauen"
            intro="Ein Knopf pro Etappe: erst Szenen und Bilder, dann Clips, dann das fertige Reel."
            advKey="story:ui:adv6"
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-50/55">
              <span className={refs.length ? "text-flare-200" : ""}>{refs.length ? "✓" : "○"} {refs.length} {refs.length === 1 ? "Person" : "Personen"}</span>
              <span className="text-ink-50/20">·</span>
              <span className={idea.trim() ? "text-flare-200" : ""}>{idea.trim() ? "✓" : "○"} Idee</span>
              <span className="text-ink-50/20">·</span>
              <span className={enableSpeaker ? "text-flare-200" : ""}>{enableSpeaker ? "✓" : "○"} {enableSpeaker ? "Sprechtext" : "stumm"}</span>
            </div>

            {/* Szenen-Anzahl gehört unmittelbar an den Generieren-Knopf: sie
                bestimmt, was der nächste Klick erzeugt und kostet. In Schritt 2
                stand sie weit vor dieser Entscheidung. */}
            <div className="pt-4">
              <Slider
                label="Szenen-Anzahl"
                valueLabel={`${pointCount}`}
                min={2}
                max={MAX_SCENES}
                value={pointCount}
                onChange={(e) => setPointCount(parseInt(e.target.value))}
              />
              <p className="text-[11px] text-ink-50/45 mt-1.5">
                {pointCount} Szenen ≈ {pointCount * 6}–{pointCount * 8} Sekunden.
              </p>
              {/* Was der nächste Klick kostet. Die Nutzer zahlen mit ihrem eigenen
                  fal-Key — acht Sprechszenen sind keine Kleinigkeit, und bisher
                  stand die Zahl nirgends. Spanne statt Punktwert, weil die
                  Cliplänge erst aus dem fertigen Audio feststeht. */}
              <p
                className="text-[11px] text-ink-50/55 mt-1 flex items-center gap-1.5 flex-wrap"
                title={[
                  "Geschätzte fal.ai-Kosten für einen vollständigen Durchgang:",
                  ...runCost.parts.map((p) => `• ${p.label}: bis ${formatUsd(p.max)} $`),
                  "",
                  "Nicht enthalten: Wiederholungen einzelner Szenen" +
                    (falKey ? "" : ", und ohne fal-Key laufen Video-Schritte gar nicht") +
                    (googleKey ? ", Bilder über deinen Google-Key" : "") +
                    (elevenKey ? ", Stimme über deinen ElevenLabs-Vertrag" : "") +
                    ".",
                  "Preise Stand 06.08.2026.",
                ].join("\n")}
              >
                <Coins className="w-3 h-3 text-flare-300/70 flex-none" />
                <span>
                  Kosten ungefähr <strong className="text-ink-50/80 font-semibold">
                    {formatUsd(runCost.min)}–{formatUsd(runCost.max)} $
                  </strong>{" "}
                  über deinen fal-Key
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-4">
              <Button
                onClick={generateStoryboard}
                loading={generatingStoryboard}
                disabled={anyBatchRunning}
                variant="ghost"
                size="sm"
                iconLeft={<Sparkles className="w-3.5 h-3.5" />}
                title={anyBatchRunning ? "Es läuft bereits eine Generierung." : "Schreibt nur die Szenen als Text — noch keine Bilder, keine Kosten für Clips."}
              >
                Erst nur den Text schreiben
              </Button>
              {/* ══ DER DURCHLAUF ══════════════════════════════════════════
                  Ein Knopf bis zum fertigen, zusammengeschnittenen Reel.

                  Er steht VOR dem Etappenknopf und trägt dessen bisherige
                  Optik: für den Fall „ich will einfach ein Video" ist er der
                  richtige, und der war bisher gar nicht vorhanden — man musste
                  wissen, dass nach den Bildern noch zwei Klicks und ein
                  Zusammenschnitt kommen. Der Etappenknopf daneben bleibt
                  vollständig erhalten, nur eine Stufe leiser: wer zwischendurch
                  prüfen will, findet ihn genau dort, wo er immer war.

                  Während eines Laufs verschwindet er — dann ist der Etappenknopf
                  der Abbrechen-Knopf, und zwei große Knöpfe nebeneinander, von
                  denen einer abbricht, sind ein Fehlklick mit Rechnung. */}
              {!primaryLoading && (
                <Button
                  onClick={runEverything}
                  size="lg"
                  variant="primary"
                  disabled={anyBatchRunning || autoRunning}
                  iconLeft={<Wand2 className="w-4 h-4" />}
                  title="Szenen, Bilder, Clips und der Zusammenschnitt hintereinander — hält an, sobald eine Etappe nicht sauber durchläuft."
                >
                  {/* Der Knopf bleibt auch dann sinnvoll, wenn schon alles
                      gerendert ist: dann ist genau noch der Zusammenschnitt
                      offen, und ihn ganz unten am Merger suchen zu müssen war
                      der letzte Bruch in der Kette. */}
                  {sceneCount === 0 ? "Reel komplett erstellen"
                    : videosDone ? "Reel zusammenfügen"
                    : "Bis zum fertigen Reel durchlaufen"}
                </Button>
              )}
              <Button
                onClick={primaryLoading ? requestAbort : primaryAction}
                size="lg"
                // Läuft an einer EINZELNEN Szene etwas, ist `primaryLoading` false —
                // der Knopf trüge dann seine normale Beschriftung und liefe in den
                // Guard. Hier abschalten, damit die Oberfläche dasselbe sagt.
                disabled={!primaryLoading && (anyBatchRunning || autoRunning)}
                // Nicht mehr `primary`: diese Rolle hat jetzt der Durchlauf
                // daneben. Als Abbrechen-Knopf bleibt er unverändert rot.
                variant={primaryLoading ? "danger" : "secondary"}
                iconLeft={primaryLoading
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : phase === "videos" || phase === "videos-redo"
                    ? <VideoIcon className="w-4 h-4" />
                    : <Sparkles className="w-4 h-4" />}
              >
                {primaryLoading ? "Abbrechen" : primaryLabel}
              </Button>
              {/* „Alles verwerfen" steht hier statt im Werkzeuge-Menü: es ist der
                  Gegenknopf zum Generieren und war drei Klicks tief versteckt.
                  Rot, weil er alles löscht — inklusive bezahlter Clips.

                  BEWUSST NICHT `disabled` während eines Laufs: er ist die
                  Notbremse und bricht den Lauf selbst ab. Genau dafür braucht es
                  aber die Rückfrage — an dieser prominenten Stelle sitzt er
                  einen Fehlklick vom teuersten Knopf der Seite entfernt. */}
              {scenes.length > 0 && (
                <Button
                  onClick={() => {
                    const clips = scenes.filter((s) => s.videoStatus === "done").length;
                    if (!window.confirm(
                      `Das ganze Storyboard wird gelöscht — ${scenes.length} ${scenes.length === 1 ? "Szene" : "Szenen"}${clips > 0 ? ` samt ${clips} fertigen ${clips === 1 ? "Clip" : "Clips"}` : ""}.\n\nFortfahren?`,
                    )) return;
                    clearStory();
                  }}
                  size="lg"
                  variant="danger"
                  iconLeft={<Trash2 className="w-4 h-4" />}
                  title={anyBatchRunning
                    ? "Bricht den laufenden Durchgang ab und löscht das Storyboard."
                    : "Löscht alle Szenen, Bilder und Clips dieses Reels."}
                >
                  Alles verwerfen
                </Button>
              )}
            </div>
            {/* ══ GESAMTFORTSCHRITT ═══════════════════════════════════════════
                WO STEHE ICH, UND WIE LANGE NOCH?

                Hier stand bisher nichts. Der einzige Hinweis darauf, dass
                überhaupt etwas läuft, war die Beschriftung des Knopfes
                („Videos werden gerendert…") — zwanzig Minuten lang derselbe
                Satz, ohne eine einzige Zahl. Wer nicht wusste, dass ein Clip
                minutenlang rendert, hielt die Seite für hängengeblieben.

                Die Zahlen kommen aus den Szenen selbst, die Restzeit aus dem
                gemessenen Durchsatz dieses Laufs (siehe `runStatus`). */}
            {(runStatus || autoRunning) && (
              <div className="mt-4 p-3 rounded-xl border border-flare-400/25 bg-flare-500/6 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-2 text-xs text-ink-50/85 min-w-0">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-flare-300 flex-none" />
                    <span className="truncate">
                      {!runStatus
                        ? "Durchlauf — die nächste Etappe wird vorbereitet…"
                        : runStatus.total > 0
                          ? `${runStatus.what === "Bild" ? "Bilder" : "Clips"}: ${runStatus.done} von ${runStatus.total} fertig`
                          : `${runStatus.what}…`}
                    </span>
                    {autoRunning && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md border border-flare-400/30 text-flare-200 flex-none">
                        Durchlauf
                      </span>
                    )}
                  </span>
                  {runStatus && (
                    <span className="text-[11px] text-ink-50/55 tabular-nums flex-none">
                      läuft seit {fmtElapsed(runStatus.elapsedMs)}
                      {runStatus.etaMs ? ` · noch ${fmtEta(runStatus.etaMs)}` : ""}
                    </span>
                  )}
                </div>
                {runStatus && runStatus.total > 0 && (
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full bg-flare-grad transition-[width] duration-500"
                      style={{ width: `${Math.round((runStatus.done / runStatus.total) * 100)}%` }}
                    />
                  </div>
                )}
                {/* Der Satz, der bisher nirgends stand und den jeder einmal
                    schmerzhaft selbst gelernt hat. */}
                <p className="text-[11px] text-ink-50/45">
                  Die Seite offen lassen — ein Seitenwechsel innerhalb der App bricht laufende Bilder ab.
                  Ein Neuladen überstehen nur bereits gestartete Clips, die sich danach selbst wieder abholen.
                </p>
              </div>
            )}
            {/* Das Werkzeuge-Menü stand hier ein zweites Mal — direkt über dem
                identischen im Kopf der Szenenliste, keine zwei Zeilen entfernt.
                Es bleibt nur dort, bei den Szenen, auf die es wirkt. */}
            {scenes.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-white/8">
                <Button
                  onClick={advanceReelGuarded}
                  variant="ghost"
                  size="sm"
                  disabled={anyBatchRunning || !nextStepLabel}
                  title={nextStepLabel || "Alle Szenen sind fertig."}
                  iconLeft={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  {nextStepLabel || "Alle Szenen sind fertig"}
                </Button>
              </div>
            )}
          </StepCard>
        </div>

        {/* === Storyboard-Output unten === */}
        <div>
          {scenes.length === 0 ? (
            <div className="text-center py-16 text-sm text-ink-50/50 flex flex-col items-center gap-2 animate-fade-in">
              <Film className="w-10 h-10 text-ink-50/25 animate-pulse-ring rounded-full" />
              Noch keine Szenen.
              <div className="text-xs text-ink-50/40 max-w-md mx-auto">
                Geh Schritt 1 bis 5 durch und klick in Schritt 6 auf den großen Knopf.
              </div>
            </div>
          ) : (
            <div className="space-y-3 animate-slide-in-right">
              {/* Kopf: Überschrift + Werkzeuge-Menü. Die fünf gleich großen
                  Knöpfe von früher sind darin gebündelt: die teure Aktion
                  („Alle Bilder neu") sah dort aus wie die harmlose. */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-lg font-bold tracking-tight">Deine Szenen</h2>
                <ToolsMenu
                  onAllImages={handleAllImagesConfirmed}
                  onMissingImages={() => generateAllImages({ onlyMissing: true })}
                  onAllVideos={() => generateAllVideos()}
                  onRewriteStory={handleRewriteStory}
                  hasScenes={scenes.length > 0}
                  imagesComplete={scenes.every(sceneImagesDone)}
                  canRenderVideos={scenes.some((s) => s.imageStatus === "done")}
                  videoPlan={plan.videoGen}
                  batchRunning={anyBatchRunning}
                />
              </div>

              {/* „Gilt für alle Szenen" — Hauptort und (im Vlog) die durchgehende
                  Situation an EINEM Ort. Der Hauptort war bisher nur Anzeige,
                  obwohl er in jeden Bild-Prompt geht; die Situation erschien erst
                  NACH dem ersten bezahlten Lauf, obwohl sie genau ihn steuert. */}
              <div className="p-4 rounded-2xl border border-white/8 bg-ink-950/45 space-y-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-ink-50/40">
                  Gilt für alle Szenen
                </div>
                <SuggestionField
                  label="Hauptort"
                  value={mainLocation}
                  onChange={setMainLocation}
                  placeholder="z.B. Altbauwohnung, Küche"
                  hint="Steht in jedem Bild-Prompt — leer lassen, dann entscheidet die KI."
                  emptyHint="Wähle einen Ort oder schreib deinen eigenen…"
                  cacheKey={`story:mainLocation:${mode}`}
                  what="der Hauptort, an dem die Szenen spielen"
                  shape="wenige Worte"
                  current={mainLocation}
                  context={idea.trim() ? `Story-Idee: "${idea.slice(0, 400)}"` : undefined}
                />

                {/* Der „Bühne aufnehmen"-Block (leere Raum-Aufnahmen + Rücken-
                    Referenzen) ist ersatzlos entfernt — Nutzerentscheid
                    2026-08-08: Sprech-Szenen zeigen beide Personen in EINEM
                    einfach generierten Bild, die Sprecherwahl macht die
                    OmniHuman-Maske. */}

                {vlogActive && (
                  <ReelSituationPanel situation={reelSituation} onChange={setReelSituation} actionLevel={actionLevel} />
                )}
              </div>

              {/* Scene grid — wider since full-width now */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 stagger">
                {scenes.map((scene, idx) => (
                  <div key={scene.id} className="animate-pop-in opacity-0 [animation-fill-mode:forwards]">
                    <SceneCard
                      scene={scene}
                      idx={idx}
                      aspectClass={ac}
                      cast={sceneCastLabel(scene, idx)}
                      onClick={() => setExpandedSceneId(scene.id)}
                      // Erzeugt das (seit dem Rückbau einzige) Szenenbild neu.
                      onGenImage={() => regenerateSceneFull(scene)}
                      onGenVideo={plan.videoGen ? () => generateSceneVideo(scene) : undefined}
                      // „Neu vertonen": nur die Stimme neu, kein Veo-Call.
                      onVoiceScene={plan.videoGen && voiceLock ? () => voiceScene(scene) : undefined}
                      // …AUSSER bei Avatar-Szenen: dort ist die Stimme in den Clip
                      // gerendert, der Knopf erzeugt also das ganze Video neu. Das
                      // muss er sagen, bevor er geklickt wird — er kostet dann Geld.
                      voiceRerendersClip={sceneUsesTalkingAvatar(scene)}
                      onRetrieveResult={() => retrieveVideoResult(scene)}
                      // Duo-Frame nur anbieten, wo er funktionieren kann: eine
                      // Sprechszene (der Clip läuft über den Avatar-Weg) und
                      // mindestens zwei Charaktere im Projekt.
                      onToggleDuo={
                        characters.length >= 2 && sceneUsesTalkingAvatar(scene)
                          ? () => toggleDuoFrame(scene)
                          : undefined
                      }
                      duoActive={sceneIsDuo(scene)}
                      // Bewusst über `scenes` statt `scenesRef`: der Ref wird
                      // erst in einem Effekt NACH dem Rendern nachgezogen, die
                      // Marke hinkte damit eine Änderung hinterher.
                      toViewer={sceneTurnsToViewer(scene, scenes)}
                      batchRunning={anyBatchRunning}
                      sceneWorking={sceneIsWorking(scene)}
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
                    <Film className="w-4 h-4 text-pure" />
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
                // Immer der FERTIGE Clip: mit Voice-Lock ist das der vertonte,
                // sonst der rohe Clip. Welche Szene drin ist, welche nicht und
                // warum — das steht jetzt an EINER Stelle (`reelClipPlan`),
                // inklusive der echten Szenennummern.
                clips={reelClipPlan.inReel}
                missingLabels={reelClipPlan.missing}
                // Der Durchlauf löst den Zusammenschnitt selbst aus, sobald alle
                // Clips stehen.
                autoMergeToken={autoMergeToken}
                onMergeSettled={handleMergeSettled}
                // Das fertige Reel aus einer früheren Sitzung — nur gültig,
                // solange die Clipliste dieselbe ist (siehe `story:mergedSig`).
                savedMergedUrl={mergedReelUrl || null}
                savedMergedSig={mergedReelSig || null}
                defaultFilename={`${mode}-${Date.now()}.mp4`}
                aspectRatio={videoAspect(aspect)}
                // Continuity = each clip's first frame duplicates the previous
                // clip's last frame → let the server drop it for seamless joins.
                // Im Reel nie: dort sollen die Schnitte hart und sichtbar bleiben.
                // Der Merger lässt den doppelten Grenzframe fallen. Doppelt ist
                // er genau dann, wenn eine „flow"-Naht existiert: dort IST der
                // Endframe von N das Startbild von N+1, beide Clips zeigen ihn.
                // Früher hing das am globalen Seamless-Toggle — der weiß seit der
                // Frame-Kette nichts mehr darüber, wo tatsächlich geklebt wird.
                seamless={scenes.some((s, i) => s.transitionToNext === "flow" && i < scenes.length - 1)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Der Abgleich nach einer großen Umstellung. Er blockiert nichts — der
          Schalter ist längst umgestellt, hier geht es nur um die Felder, die
          daran hängen. */}
      <SettingsSyncDialog
        open={!!syncState}
        trigger={syncState?.trigger ?? null}
        phase={syncState?.phase ?? "ask"}
        scope={syncState ? SYNC_SCOPE[syncState.trigger.key] : []}
        proposals={syncState?.proposals ?? []}
        onConfirmAsk={() => void runSettingsSync()}
        onApply={applySettingsSync}
        // Während der KI-Lauf läuft, darf Escape/Backdrop den Dialog nicht
        // wegnehmen — die Antwort käme sonst ins Leere und der Lauf wäre bezahlt.
        onClose={() => { if (syncState?.phase !== "loading") setSyncState(null); }}
      />

      <StoryDetailDialog
        open={!!expandedScene}
        scene={expandedScene}
        sceneIndex={expandedSceneIndex}
        aspectClass={ac}
        onClose={() => setExpandedSceneId(null)}
        onUpdate={(patch) => expandedScene && updateScene(expandedScene.id, patch)}
        // ÜBER `scenesRef`, nicht über `expandedScene`: der Assistent schreibt
        // unmittelbar davor Felder derselben Szene, und diese Closure stammt aus
        // dem Render DAVOR. Mit dem alten Objekt entstünde das Bild aus genau
        // den Werten, die gerade ersetzt wurden — sichtbar als „der Knopf tut
        // nichts", tatsächlich ein bezahltes Bild der alten Fassung.
        onRegenerate={() => {
          if (!expandedScene) return;
          const live = scenesRef.current.find((s) => s.id === expandedScene.id) ?? expandedScene;
          void generateSceneImage(live);
        }}
        onAssist={(history, force) =>
          expandedScene ? assistScene(expandedScene, history, force) : Promise.resolve(null)
        }
        // Der Dialog muss wissen, dass im Duo-Bild seine halbe Maske wirkungslos
        // ist — sonst nimmt das Beschreibungsfeld eine Haltung an, die der
        // Duo-Pfad gar nicht liest, und das Bild bleibt unverändert.
        isDuo={!!expandedScene && sceneIsDuo(expandedScene)}
        onToggleDuo={
          expandedScene && characters.length >= 2 && sceneUsesTalkingAvatar(expandedScene)
            ? () => toggleDuoFrame(expandedScene)
            : undefined
        }
      />
    </PlanGate>
  );
}

function SceneCard({ scene, idx, aspectClass, cast, onClick, onGenImage, onGenVideo, onVoiceScene, voiceRerendersClip, onRetrieveResult, onToggleDuo, duoActive, toViewer, batchRunning, sceneWorking }: {
  scene: StoryScene; idx: number; aspectClass: string;
  /** Wer in dieser Szene das Gesicht zeigt und wer zur Schulter wird — genau die
   *  Zuordnung, die auch der Bild-Prompt benutzt. Sichtbar, weil man einem
   *  fertigen Bild sonst nicht ansieht, ob die App den richtigen Sprecher
   *  erkannt hat oder ob das Modell die Vorgabe ignoriert hat. `null` bei nur
   *  einer Person im Projekt. */
  /** `bothFaces`: stummes Gruppenbild — alle Anwesenden zeigen ihr Gesicht,
   *  niemand ist abgewandt. Dann trägt `focus` die ganze Besetzung. */
  cast?: { focus: string; backs: string[]; bothFaces?: boolean } | null;
  onClick: () => void; onGenImage: () => void;
  onGenVideo?: () => void;
  onVoiceScene?: () => void;
  /** Sprechender Avatar: die Stimme steckt IM Clip, „Neu vertonen" rendert also
   *  das ganze Video neu (kostet). Der Knopf muss das benennen. */
  voiceRerendersClip?: boolean;
  /** „Ergebnis abholen" — nur gesetzt, wenn ein Auftrags-Handle existiert. */
  onRetrieveResult?: () => void;
  /** Duo-Frame umschalten (OmniHuman-Test) — nur gesetzt, wenn die Szene dafür
   *  in Frage kommt (Sprechszene, mindestens zwei Charaktere im Projekt). */
  onToggleDuo?: () => void;
  /** Läuft die Szene als Duo? Kommt BERECHNET aus `sceneIsDuo` — Duo ist der
   *  Standard, das rohe `scene.duoFrame`-Feld allein (undefined = an) würde
   *  hier die falsche Anzeige ergeben. */
  duoActive?: boolean;
  /** Wendet sich diese Szene ans Publikum (letzte Szene / CTA)? Nur Anzeige —
   *  entschieden wird es in `sceneTurnsToViewer`, damit Karte, Standbild und
   *  Clip garantiert dieselbe Antwort benutzen. */
  toViewer?: boolean;
  /** Läuft ein globaler Durchgang? Dann macht ein Einzelklick nichts Sinnvolles
   *  mehr — der Batch erzeugt dieselben Bilder ohnehin gleich. */
  batchRunning: boolean;
  /** Arbeitet gerade etwas an DIESER Szene (Bild, Endbild, Video oder Stimme)? */
  sceneWorking: boolean;
}) {
  // Der abgespielte Clip ist immer der fertige — mit Voice-Lock der vertonte.
  const finalVideo = sceneFinalVideo(scene);
  const hasVideo = scene.videoStatus === "done" && !!finalVideo;
  const videoLoading = scene.videoStatus === "loading";
  // Wie lange laeuft dieser Auftrag schon? Nur gesetzt, wenn er einen Start
  // traegt — das ist genau dann der Fall, wenn er auch abholbar ist.
  const jobMinutes = videoLoading && scene.videoJobStartedAt
    ? Math.max(0, Math.round((Date.now() - scene.videoJobStartedAt) / 60000))
    : null;
  const voiceLoading = scene.audioStatus === "loading";
  const imageLoading = scene.imageStatus === "loading" || scene.endImageStatus === "loading";

  /**
   * GENAU EIN Vorgang wird angezeigt — der teuerste zuerst.
   *
   * Vorher hatte jeder Vorgang seine eigene Anzeige, und die lagen alle auf
   * derselben unteren Kante: rendert eine Szene und wird gleichzeitig vertont,
   * stapelten sich Video-Balken, Stimm-Balken und Bild-Fortschritt übereinander
   * und über die Knöpfe. Hier wird stattdessen entschieden, WAS gerade zählt.
   */
  // Was in dieser Phase wirklich passiert — plus der Abschnitt der Leiste, in
  // dem sie kriechen darf. Die Abschnitte schliessen aneinander an, sodass der
  // Balken über die ganze Kette hinweg nur vorwärts geht.
  const phase = VIDEO_PHASES[scene.videoPhase ?? "render"];
  const busyState = videoLoading
    ? {
        kind: "video",
        // Der Schritt zuerst, die Laufzeit dahinter. „Clip wird abgeholt" stand
        // hier pauschal — auch dann, wenn gerade die Stimme entstand.
        label: jobMinutes != null ? `${phase.label} — läuft seit ${jobMinutes} min` : phase.label,
        pct: null,
        from: phase.from,
        to: phase.to,
        expectedMs: phase.expectedMs,
      }
    : imageLoading
      // Start- und Endframe sind fuer den Nutzer EIN Bild.
      ? { kind: "image", label: "Bild rendert…", pct: null, from: undefined, to: undefined, expectedMs: 20000 }
      : voiceLoading
        ? { kind: "voice", label: "Stimme wird erzeugt…", pct: null, from: undefined, to: undefined, expectedMs: 15000 }
        : null;

  // Prefer the in-session base64; fall back to the durable bucket URL (e.g. after a reload).
  const imgSrc = scene.imageDataUrl || scene.imageUrl;
  const hasImage = scene.imageStatus === "done" && !!imgSrc;
  // Nur ein exakter Enum-Treffer wird angezeigt — hier bewusst NICHT über
  // getVoiceDelivery, das still auf "Neutral" zurückfällt und damit ein
  // Delivery vortäuschen würde, wo die Szene keins hat.
  const deliveryLabel = VOICE_DELIVERIES.find((d) => d.value === scene.voiceDelivery)?.label;

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
            src={finalVideo}
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
        {/* Während eines Durchgangs KEIN Generier-Knopf: der Batch erzeugt das
            Bild ohnehin gleich. Stattdessen sagen, dass die Szene wartet — sonst
            klickt der Nutzer und bezahlt dasselbe Bild ein zweites Mal. */}
        {scene.imageStatus === "idle" && !hasVideo && (
          batchRunning ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-ink-50/35 text-xs gap-2">
              <ImageIcon className="w-6 h-6" />
              Wartet auf den Durchgang…
            </div>
          ) : (
            <button
              onClick={onGenImage}
              disabled={sceneWorking}
              className="absolute inset-0 flex flex-col items-center justify-center text-ink-50/40 hover:text-ink-50/80 hover:bg-white/5 transition-all duration-200 text-xs gap-2 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <ImageIcon className="w-6 h-6 transition-transform group-hover:scale-110" />
              Bild generieren
            </button>
          )
        )}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-ink-950/80 backdrop-blur-sm text-[10px] font-semibold text-ink-50">
          {idx + 1}
        </div>
        {hasVideo && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-flare-grad text-pure text-[10px] font-semibold inline-flex items-center gap-1">
            <Play className="w-2.5 h-2.5" /> Video
          </div>
        )}
        {/* Der Endframe gehoert zum selben Bild und bleibt unsichtbar. Frueher
            stand hier eine „Schlussbild fehlt"-Plakette — sie machte eine interne
            Zweiteilung sichtbar, die den Nutzer nichts angeht. Dass er
            mitgezogen wird, sichert jetzt der Bild-Knopf (regenerateSceneFull). */}
        {/* DIE Ladeanzeige der Kachel — eine einzige, egal was gerade läuft.
            `key` setzt den Kriech-Verlauf zurück, wenn ein anderer Vorgang
            übernimmt (Bild → Clip → Stimme). */}
        {busyState && (
          <SceneBusyBar
            key={busyState.kind}
            label={busyState.label}
            pct={busyState.pct}
            from={busyState.from}
            to={busyState.to}
            expectedMs={busyState.expectedMs}
          />
        )}
        {/* Nur noch der Erfolgs-Haken: den Balken zeichnet oben `SceneBusyBar`. */}
        {scene.imageStatus !== "error" && !hasVideo && (
          <SlotProgress status={scene.imageStatus} expectedMs={20000} showBar={false} />
        )}

        {/* Regenerate overlay: shows when we have an image, but NOT when a video
            is already there — otherwise the overlay swallows the play-button
            clicks of the native <video> controls. With a video the regenerate
            actions in the footer below cover the same needs. */}
        <RegenerationSurfaceOverlay
          show={!!hasImage && !hasVideo}
          onImage={onGenImage}
          onVideo={onGenVideo && hasImage ? onGenVideo : undefined}
          // Die Plakette sagt nur noch etwas, wofür es KEINE Leiste gibt: dass
          // ein Durchgang über alle Szenen läuft und diese Kachel noch wartet.
          // Alles andere zeigt `SceneBusyBar` — sonst stünde dasselbe zweimal da.
          busyLabel={!busyState && batchRunning ? "Durchgang läuft…" : null}
          reserveBottom={!!busyState}
          busy={sceneWorking || batchRunning}
          busyTitle={
            videoLoading ? "Das Video dieser Szene rendert gerade — ein neues Bild würde den Clip verwerfen."
            : batchRunning ? "Es läuft ein Durchgang über alle Szenen."
            : sceneWorking ? "An dieser Szene wird gerade gearbeitet."
            : undefined
          }
        />
      </div>
      <div className="p-3 space-y-2">
        <div className="text-sm font-medium text-ink-50 line-clamp-2 min-h-[2.5em]">{scene.summary}</div>
        {scene.dialogText && (
          <div className="text-[11px] text-ink-50/55 italic line-clamp-2 border-l-2 border-white/10 pl-2">„{scene.dialogText}"</div>
        )}
        {/* Stimmlage der Zeile — nur als Label, geändert wird sie im Detail-Dialog. */}
        {deliveryLabel && scene.dialogText && (
          <div className="inline-flex items-center gap-1 text-[10px] text-ink-50/50">
            <Volume2 className="w-2.5 h-2.5" />
            {deliveryLabel}
          </div>
        )}
        {/* Wer in dieser Szene das Gesicht zeigt.
            Einem fertigen Bild sieht man nicht an, ob die falsche Person
            zu sehen ist, weil die App den Sprecher falsch zugeordnet hat oder
            weil das Bildmodell die Vorgabe ignoriert hat. Hier steht, was der
            Prompt verlangt hat — stimmt das Bild damit nicht überein, lag es am
            Modell und ein neuer Versuch hilft. */}
        {cast && !duoActive && (
          <div className="inline-flex items-center gap-1 text-[10px] text-flare-300/80" title="Diese Zuordnung geht so in den Bild-Prompt">
            <UserIcon className="w-2.5 h-2.5" />
            {cast.bothFaces ? (
              <>
                {cast.focus} im Bild
                <span className="text-ink-50/45">· niemand spricht, beide Gesichter sichtbar</span>
              </>
            ) : (
              <>
                Im Bild: {cast.focus || "—"}
                {cast.backs.length > 0 && (
                  <span className="text-ink-50/45">· {cast.backs.join(", ")} von hinten</span>
                )}
              </>
            )}
          </div>
        )}
        {/* Duo-Frame (OmniHuman, Standard bei zwei Charakteren): beide Personen
            sichtbar, die Maske lässt nur den Sprecher sprechen. Der Umschalter
            benennt die Folge — Bild und Clip der Szene passen nach dem Wechsel
            nicht mehr und werden verworfen (Meldung kommt aus toggleDuoFrame). */}
        {onToggleDuo && (
          <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
            {duoActive && (
              <span className="inline-flex items-center gap-1 text-flare-300/80" title="Der Clip läuft über OmniHuman — die Sprecher-Maske lässt nur eine Person sprechen">
                <UserIcon className="w-2.5 h-2.5" />
                Beide im Bild — nur {cast?.focus || "der Sprecher"} spricht
              </span>
            )}
            {/* Die Ausnahme SICHTBAR machen. Ob eine Szene als CTA-Szene gilt,
                entschied sich bisher unsichtbar im Prompt-Bau — man sah es erst
                am fertigen (bezahlten) Bild. Steht die Marke hier, weiss man es
                vorher, und wenn sie an der falschen Szene hängt, sieht man auch
                das sofort. */}
            {duoActive && toViewer && (
              <span className="inline-flex items-center gap-1 text-flare-300/80" title="Letzte Szene / Call-to-Action: beide wenden sich der Kamera zu, statt einander anzusehen. Gilt für neu erzeugte Bilder und Clips.">
                · zur Kamera (CTA)
              </span>
            )}
            <button
              type="button"
              onClick={onToggleDuo}
              disabled={sceneWorking || batchRunning}
              className="underline decoration-dotted text-ink-50/55 hover:text-ink-50/85 disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                (scene.imageStatus === "done" || scene.videoStatus === "done")
                  ? "Umschalten verwirft Bild und Clip dieser Szene — beides wird neu erzeugt."
                  : duoActive
                    ? "Ausnahme für diese Szene: nur der Sprecher im Bild (Clip über Kling ai-avatar)."
                    : "Beide Personen im Bild, Clip über OmniHuman (Maske wählt den Sprecher)."
              }
            >
              {duoActive ? "Nur Sprecher zeigen" : "Beide im Bild (OmniHuman)"}
            </button>
          </div>
        )}
        {/* KEIN `loading` an den Knöpfen dieser Reihe: der Spinner im Knopf war
            die dritte Ladeanzeige derselben Szene, neben Leiste und Plakette.
            Gesperrt sind sie weiterhin — `sceneWorking` deckt Bild, Endbild,
            Clip und Stimme ab, genau die Fälle, für die `loading` hier stand. */}
        <div className="flex items-center gap-1.5 pt-1 flex-wrap">
          <Button size="sm" variant="secondary" onClick={onClick}>Bearbeiten</Button>
          {/* Feste Breite, KEIN Ausklappen beim Hovern.
              Hier wuchs die Beschriftung von 0 auf bis zu 10rem — und weil die
              Reihe umbricht, sprangen die Knöpfe darunter beim Hovern eine Zeile
              nach unten. Man zielt also auf einen Knopf, der sich unter dem
              Zeiger wegbewegt.

              Der Tooltip sagt weiterhin die FOLGE, nicht nur die Aktion: ein
              neues Bild verwirft Video und Vertonung der Szene. Ohne diesen
              Hinweis klickt man „nur das Bild" und verliert einen bezahlten
              Clip. Er trug diese Warnung schon vorher — die ausklappende
              Beschriftung hat sie nur wiederholt. */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onGenImage}
            disabled={sceneWorking || batchRunning}
            iconLeft={<ImageIcon className="w-3 h-3" />}
            title={
              batchRunning ? "Es läuft ein Durchgang — bitte warten."
              : videoLoading ? "Video rendert gerade — währenddessen kein neues Bild."
              : hasVideo ? "Bild neu — verwirft Video und Stimme dieser Szene"
              : "Bild neu"
            }
            aria-label={hasVideo ? "Bild neu — verwirft Video und Stimme dieser Szene" : "Bild neu"}
          />
          {onGenVideo && hasImage && (
            hasVideo ? (
              // Video already rendered → offer a clear single-scene re-render.
              <Button
                size="sm"
                variant="ghost"
                onClick={onGenVideo}
                disabled={sceneWorking || batchRunning}
                iconLeft={<RefreshCw className="w-3 h-3" />}
                title={batchRunning ? "Es läuft ein Durchgang — bitte warten." : "Dieses Video neu rendern"}
              >
                Video neu
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={onGenVideo}
                disabled={sceneWorking || batchRunning}
                title={batchRunning ? "Es läuft ein Durchgang — bitte warten." : "Video erzeugen"}>
                <VideoIcon className="w-3 h-3" />
              </Button>
            )
          )}
          {/* Neu vertonen — nur die feste Stimme neu erzeugen, kein Veo-Call. */}
          {onVoiceScene && scene.videoUrl && scene.dialogText && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onVoiceScene}
              disabled={sceneWorking || batchRunning}
              iconLeft={<Volume2 className="w-3 h-3" />}
              title={
                videoLoading ? "Das Video rendert gerade — es wird danach automatisch vertont."
                : batchRunning ? "Es läuft ein Durchgang — bitte warten."
                : voiceRerendersClip
                  ? "Die Stimme ist in diesen Clip gerendert — sie lässt sich nur zusammen mit dem Video neu erzeugen."
                  : "Szene mit der festen Stimme neu vertonen"
              }
            >
              {voiceRerendersClip ? "Stimme neu (Clip wird neu gerendert)" : "Nur neu vertonen"}
            </Button>
          )}
          {imgSrc && (
            <ResolutionDownloadMenu
              dataUrl={imgSrc}
              filename={`scene-${idx + 1}.png`}
              videoUrl={hasVideo ? finalVideo : undefined}
              videoFilename={`scene-${idx + 1}.mp4`}
              align="center"
              preferSide="top"
              triggerTitle={hasVideo ? "Herunterladen (Bild / Video)" : "Bild herunterladen"}
              triggerClassName="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-all duration-150 active:scale-[0.97] text-ink-50/80 hover:bg-white/5 hover:text-ink-50 h-9 px-3 text-xs rounded-md"
            >
              <Download className="w-3 h-3" />
            </ResolutionDownloadMenu>
          )}
          {/* Den GRUND zeigen, nicht nur „Fehler".
              Vorher stand hier ein generisches Label und die eigentliche Meldung
              nur im `title` — sichtbar erst, wenn man mit der Maus draufbleibt.
              Wer den Fehler meldet, hat ihn damit praktisch nie zur Hand, und
              jede Diagnose beginnt mit Raten. Der Text steht jetzt da. */}
          {scene.videoError && (
            <span className="w-full text-[10px] text-danger inline-flex items-start gap-1" title={scene.videoError}>
              <AlertTriangle className="w-3 h-3 flex-none mt-[1px]" />
              <span className="min-w-0 break-words">{scene.videoError}</span>
            </span>
          )}
          {/* DER HINWEIS, WAS ZU TUN IST — er wurde erzeugt und nie angezeigt.
              `generateSceneVideo` baut zu jedem Videofehler einen konkreten Rat
              („Startbild oder Szenentext anpassen", „fal.ai-Key prüfen",
              „Ergebnis erneut abholen") und schrieb ihn als `videoHint` an die
              Szene — gerendert wurde nur die technische Meldung darüber. Der
              einzige umsetzbare Satz war damit ausgerechnet der unsichtbare.
              Beim Bild steht er längst da (`imageHint`, gleich darüber). */}
          {scene.videoHint && (
            <span className="w-full text-[10px] text-ink-50/55 pl-4 break-words">{scene.videoHint}</span>
          )}
          {/* Der Auftrag laeuft beim Anbieter weiter, auch wenn das Abholen
              schiefging (Zeitueberschreitung, Abbruch, zu alt). Ohne diesen Knopf
              waere ein bereits bezahlter Clip unerreichbar. */}
          {onRetrieveResult && scene.videoJobId && scene.videoStatus === "error" && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRetrieveResult(); }}
              disabled={sceneWorking || batchRunning}
              className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-white/15 bg-white/5 text-ink-50/80 hover:text-flare-200 hover:border-flare-400/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Der Auftrag laeuft beim Anbieter weiter — Ergebnis erneut abholen, ohne neu zu rendern."
            >
              <RefreshCw className="w-3 h-3" /> Ergebnis abholen
            </button>
          )}
          {/* Gleicher Grund wie beim Video-Fehler darüber: der Text gehört sichtbar. */}
          {scene.voiceError && (
            <span className="w-full text-[10px] text-warn inline-flex items-start gap-1" title={scene.voiceError}>
              <AlertTriangle className="w-3 h-3 flex-none mt-[1px]" />
              <span className="min-w-0 break-words">{scene.voiceError}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
