import { useState } from "react";
import {
  Camera, Sparkles, Loader2, Check, RefreshCw, X, Trash2, Mountain,
  Plus, RotateCcw, ImageDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/Shell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Input";
import { Slider } from "@/components/ui/Slider";
import { ImageDropZone } from "@/components/ImageDropZone";
import { ImageGrid, type ImageSlot } from "@/components/ImageGrid";
import { MultiDownloadButton } from "@/components/DownloadButton";
import { PlanGate } from "@/components/PlanGate";
import { TutorialCTA } from "@/components/tutorials/TutorialCTA";
import { AiSuggestButton } from "@/components/ai/AiSuggestButton";
import { useProjectProfile } from "@/hooks/useProjectProfile";
import { buildProfilePreamble } from "@/lib/projectProfile";
import { ASPECT_RATIOS, aspectClass } from "@/lib/aspectRatio";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useProjectGallery, useProjectValue, useProjectRefImages } from "@/hooks/useProjectGallery";
import { AIError } from "@/lib/ai";
import { generateImage, generateText } from "@/lib/generate";
import { uid } from "@/lib/uid";
import { cn } from "@/lib/cn";

const SHOT_TYPES = [
  { value: "fullbody",  label: "Ganzkörper" },
  { value: "upperbody", label: "Oberkörper" },
  { value: "closeup",   label: "Nahaufnahme" },
  { value: "headshot",  label: "Headshot" },
];

const STYLES = [
  { value: "photoreal",    label: "Fotorealistisch" },
  { value: "editorial",    label: "Editorial" },
  { value: "cinematic",    label: "Cinematic" },
  { value: "softlight",    label: "Soft Light" },
  { value: "highcontrast", label: "High Contrast" },
];

const CAMERA_ANGLES = [
  { value: "random",            label: "Zufällig",           prompt: "" },
  { value: "frontal",            label: "Frontal",            prompt: "Camera directly in front of the subject at eye level." },
  { value: "seitlich",           label: "Seitlich",           prompt: "Camera at 90° profile view." },
  { value: "von-oben",           label: "Von oben",           prompt: "High angle from above." },
  { value: "von-unten",          label: "Von unten",          prompt: "Low angle from below." },
  { value: "ueber-schulter",     label: "Über die Schulter",  prompt: "Over-the-shoulder shot." },
  { value: "dutch-angle",        label: "Dutch Angle",        prompt: "Camera tilted sideways." },
  { value: "vogelperspektive",   label: "Vogelperspektive",   prompt: "Bird's eye view from directly above." },
  { value: "froschperspektive",  label: "Froschperspektive",  prompt: "Worm's eye view from ground level." },
];

const SKIN_TYPES = [
  { value: "soft",      label: "Weich",        prompt: "soft, smooth, flawless skin" },
  { value: "realistic", label: "Realistisch",  prompt: "realistic natural skin with visible pores" },
  { value: "imperfect", label: "Unvollkommen", prompt: "imperfect skin with freckles, fine lines, natural imperfections" },
];

// ─── Natural-pose pool — ported in spirit from the Projekt build. ────────────
// The recurring theme: relaxed body language, gaze NOT locked on the lens.
// That single trick is what makes the output look like a real photoshoot
// instead of a posed passport photo.
const NATURAL_POSES = [
  "standing casually with weight shifted to one leg",
  "leaning slightly forward, hands relaxed at the sides",
  "one hand in a pocket, the other arm relaxed",
  "arms loosely crossed, easy posture",
  "looking off to the side, thoughtful expression",
  "glancing slightly downward with a soft smile",
  "head turned three-quarters away from camera",
  "hands clasped in front, calm composure",
  "caught mid-step, natural in-between moment",
  "running a hand through their hair",
  "shoulder rolled slightly back, gaze drifting beyond the lens",
  "tilting head with a faint smile, eyes on a point off-frame",
  "weight shifted gracefully, looking past the camera",
  "leaning against an invisible surface, profile partly to the lens",
  "subtle shoulder turn, half-smile while looking aside",
];

const NATURAL_EXPRESSIONS = [
  "quiet confidence, soft warm smile",
  "calm and contemplative",
  "warm and approachable, eyes slightly crinkled",
  "subtle joy, almost a laugh",
  "focused, self-assured",
  "relaxed mid-laugh energy",
  "genuine smile, eyes alive",
  "serene, gentle neutral expression",
  "easy confidence, mouth at rest",
];

// ─── Gaze pool — weighted blend of off-camera, at-camera, and over-the-shoulder
// looks. Real photoshoots mix all of these. Never a stiff straight-on stare.
const NATURAL_GAZES = [
  // Off-camera — the bulk of the rotation
  "gaze drifting off to the side, eyes following something just out of frame",
  "looking slightly downward, in a quiet introspective moment",
  "head turned three-quarters, eyes following the same direction",
  "eyes focused on a point well beyond the camera, lost in thought",
  "glancing upward and to the side, light catching the face",
  "profile-leaning gaze, attention on something off-frame",
  "eyes nearly closed mid-laugh, gaze tilted away",
  // Casual at-camera — about a third of the time, never stiff
  "a fleeting sideways glance toward the camera, caught between moments",
  "eyes flicking briefly toward the lens with a soft, candid expression",
  "looking just past the camera — almost at the lens but not quite",
  "a relaxed, knowing glance toward the camera, no staring",
  // Over-the-shoulder — back partly to the camera, head turning back. The
  // classic editorial / fashion turn-around moment.
  "back partly turned to the camera, head turned over the shoulder, eyes meeting the lens softly",
  "looking back over one shoulder with a candid expression, body angled away from the camera",
  "caught mid-turn — shoulders facing away, head twisted back toward the lens",
  "half-profile from behind, glancing back over the shoulder with quiet confidence",
];

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildPrompt(opts: {
  shotType: string; background: string; style: string; cameraAngle: string;
  skinType: string; sceneDescription: string; customPrompt: string; hasReference: boolean;
}): string {
  const { shotType, background, style, cameraAngle, skinType, sceneDescription, customPrompt, hasReference } = opts;
  const shot = SHOT_TYPES.find(s => s.value === shotType)?.label || shotType;
  const st = STYLES.find(s => s.value === style)?.label || style;
  const angleLine = CAMERA_ANGLES.find(c => c.value === cameraAngle)?.prompt || "";
  const skinLine = SKIN_TYPES.find(s => s.value === skinType)?.prompt || "";

  const refLine = hasReference
    ? "Use the uploaded reference image as a strict identity lock — face, body proportions, hair colour and overall look must remain consistent across every output."
    : "";

  const bgLine =
    background === "white" ? "Background: clean seamless white (#FFFFFF) studio cyclorama, uniform, no shadows on the floor beyond a subtle contact shadow." :
    background === "greenscreen" ? "Background: pure chroma key green (#00FF00), uniform, clean keyable edges." :
    background === "scenery" ? (sceneDescription ? `Environment: ${sceneDescription}. Treat it as a real on-location backdrop with depth and atmosphere.` : "Environment: tasteful on-location backdrop with natural depth.") :
    "";

  // ── Gaze direction — the key trick for "natural shoot moment" ──
  // Variation: most frames the subject's gaze is off-camera, some frames a
  // soft glance toward the lens (never a stiff, direct stare). The user-set
  // angle overrides random when it implies a specific gaze.
  let gazeLine: string;
  if (cameraAngle === "frontal") {
    gazeLine = "The subject is facing the camera with a relaxed, natural gaze — not stiff or staring, just present and at ease.";
  } else if (cameraAngle === "seitlich" || cameraAngle === "ueber-schulter") {
    gazeLine = "The subject's gaze follows the angle naturally — looking off-frame, not at the camera.";
  } else {
    // "random" (or any other angle): draw a random gaze direction. The pool is
    // weighted toward off-camera looks but includes a few casual at-camera ones
    // so the batch feels like a real shoot rotation.
    const gaze = pickRandom(NATURAL_GAZES);
    gazeLine =
      `Gaze direction: ${gaze}. Never a stiff, posed, dead-center stare into the lens — keep it candid, in-the-moment, like a real photoshoot.`;
  }

  // Pick a natural pose + expression for variety across the batch.
  const pose = pickRandom(NATURAL_POSES);
  const expression = pickRandom(NATURAL_EXPRESSIONS);

  // The "feeling" anchor — borrowed from the Projekt prompt template. This is
  // what shifts the output from "AI portrait" to "high-end editorial shoot".
  const styleAnchor =
    "high-end editorial fashion photography, professional photoshoot, captured on an 85mm portrait lens, shallow depth of field, soft directional studio lighting, true-to-life colors, sharp focus on the subject's face, ultra-high-definition photorealism";

  return [
    `A professional ${shot.toLowerCase()} photograph of one adult person — ${st.toLowerCase()} look.`,
    `Pose: ${pose}. Expression: ${expression}.`,
    gazeLine,
    angleLine,
    skinLine ? `Skin: ${skinLine}.` : "",
    `Style: ${styleAnchor}.`,
    refLine,
    bgLine,
    "Natural body language and posture, plausible anatomy, realistic hands, no awkward limb positions, no exaggerated symmetry.",
    "Content policy: depict a fully-clothed adult only. No nudity, no sexually suggestive content, no violence, no weapons, no minors. Tasteful, professional photoshoot only.",
    "Absolutely no text, letters, numbers, watermarks, logos or captions anywhere in the image.",
    customPrompt ? `Additional direction from the user (high priority): ${customPrompt}` : "",
  ].filter(Boolean).join("\n");
}

export default function StudioPage() {
  const { genChain, hasGenKey } = useSettings();
  const { plan } = useAuth();

  // Uploaded references + all inputs are persisted per project.
  const [refs, setRefs] = useProjectRefImages("studio:refs");
  const [projectProfile] = useProjectProfile();
  const [aspect, setAspect] = useProjectValue("studio:aspect", "4:5");
  const [shotType, setShotType] = useProjectValue("studio:shotType", "upperbody");
  const [background, setBackground] = useProjectValue("studio:background", "white");
  const [style, setStyle] = useProjectValue("studio:style", "photoreal");
  const [cameraAngle, setCameraAngle] = useProjectValue("studio:cameraAngle", "random");
  const [skinType, setSkinType] = useProjectValue("studio:skinType", "realistic");
  const [sceneDescription, setSceneDescription] = useProjectValue("studio:sceneDescription", "");
  const [useCustomPrompt, setUseCustomPrompt] = useProjectValue("studio:useCustomPrompt", false);
  const [customPrompt, setCustomPrompt] = useProjectValue("studio:customPrompt", "");
  const [count, setCount] = useProjectValue("studio:count", plan.maxImagesPerRun === 1 ? 1 : 4);

  const [aiSuggestion, setAiSuggestion] = useState("");
  const [suggesting, setSuggesting] = useState(false);

  // KI-Assistent state (prompt history persisted; live chat draft is transient)
  const [promptVersions, setPromptVersions] = useProjectValue<string[]>("studio:promptVersions", []);
  const [promptVersionIdx, setPromptVersionIdx] = useProjectValue("studio:promptVersionIdx", 0);
  const [chatInput, setChatInput] = useState("");
  const [aiTarget, setAiTarget] = useProjectValue<"prompt" | "background" | "both">("studio:aiTarget", "prompt");
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  const [slots, setSlots] = useProjectGallery("studio");
  const [running, setRunning] = useState(false);

  const generate = async () => {
    if (!hasGenKey) {
      toast.error("Bitte hinterlege zuerst deinen API-Key in den Einstellungen.");
      return;
    }
    if (refs.length === 0 && !customPrompt.trim()) {
      toast.error("Lade ein Referenzbild hoch oder beschreibe das gewünschte Motiv.");
      return;
    }

    const limit = plan.maxImagesPerRun === -1 ? count : Math.min(count, plan.maxImagesPerRun);
    if (limit < count) {
      toast.info(`Dein ${plan.label}-Plan erlaubt max. ${plan.maxImagesPerRun} Bilder pro Durchgang.`);
    }

    const newSlots: ImageSlot[] = Array.from({ length: limit }, () => ({ id: uid(), status: "loading" as const }));
    setSlots(prev => [...prev, ...newSlots]);
    setRunning(true);

    await Promise.all(newSlots.map(async (slot, idx) => {
      // Re-roll the prompt per image: buildPrompt picks a random pose +
      // expression, so each variation lands on a genuinely different "moment"
      // of the shoot rather than the same look stamped N times.
      const prompt = buildPrompt({
        shotType, background, style, cameraAngle, skinType, sceneDescription,
        customPrompt: useCustomPrompt ? customPrompt : "",
        hasReference: refs.length > 0,
      });
      try {
        const dataUrl = await generateImage(genChain, {
          prompt: prompt + `\n\nFrame ${idx + 1} of the shoot — same person, fresh natural moment.`,
          references: refs.map(r => ({ mimeType: r.mimeType, base64: r.base64 })),
          aspectRatio: aspect,
        });
        setSlots(s => s.map(x => x.id === slot.id ? { ...x, status: "done", dataUrl, prompt } : x));
      } catch (e: any) {
        const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
        setSlots(s => s.map(x => x.id === slot.id ? { ...x, status: "error", error: err.message, errorHint: err.hint } : x));
      }
    }));
    setRunning(false);
  };

  const regenerateAll = async () => {
    setSlots([]);
    await generate();
  };

  const retry = async (id: string) => {
    setSlots(s => s.map(x => x.id === id ? { ...x, status: "loading", error: undefined } : x));
    const prompt = buildPrompt({
      shotType, background, style, cameraAngle, skinType, sceneDescription,
      customPrompt: useCustomPrompt ? customPrompt : "",
      hasReference: refs.length > 0,
    });
    try {
      const dataUrl = await generateImage(genChain, {
        prompt,
        references: refs.map(r => ({ mimeType: r.mimeType, base64: r.base64 })),
        aspectRatio: aspect,
      });
      setSlots(s => s.map(x => x.id === id ? { ...x, status: "done", dataUrl } : x));
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
      setSlots(s => s.map(x => x.id === id ? { ...x, status: "error", error: err.message, errorHint: err.hint } : x));
    }
  };

  const suggestBackground = async () => {
    if (!hasGenKey) { toast.error("API-Key fehlt."); return; }
    setSuggesting(true);
    try {
      const seed = customPrompt.trim() || sceneDescription.trim() || `${shotType} portrait, ${style} style`;
      const result = await generateText(genChain, {
        prompt: buildProfilePreamble(projectProfile) + `Der Nutzer hat folgenden Bild-Kontext: "${seed}".

Beschreibe einen passenden Hintergrund. STRENGE REGELN:
- Antworte NUR mit der reinen Hintergrundbeschreibung
- KEINE Einleitungen, keine Erklärungen
- KEINE Details über Personen oder Charaktere
- 2-3 Sätze auf Deutsch`,
      });
      const s = result.trim();
      if (s) setAiSuggestion(s);
      else toast.error("Keine Vorschläge erhalten.");
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
      toast.error(err.message);
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestion = () => {
    if (!aiSuggestion) return;
    setSceneDescription(aiSuggestion);
    setAiSuggestion("");
    if (background === "white" || background === "greenscreen") setBackground("scenery");
  };

  // ── KI-Assistent: build a polished image prompt from natural-language input ──
  const handleGenerateWithAI = async () => {
    if (!hasGenKey || !chatInput.trim()) return;
    setGeneratingPrompt(true);
    try {
      const wantsPrompt = aiTarget === "prompt" || aiTarget === "both";
      const wantsBackground = (aiTarget === "background" || aiTarget === "both") && background === "scenery";

      const shotLabel = SHOT_TYPES.find(s => s.value === shotType)?.label || shotType;
      const styleLabel = STYLES.find(s => s.value === style)?.label || style;

      if (wantsPrompt) {
        const result = await generateText(genChain, {
          prompt: buildProfilePreamble(projectProfile) + `Du bist ein Profi-Prompt-Writer für KI-Bildgenerierung.

Wunsch des Nutzers: "${chatInput.trim()}"

Kontext: ${shotLabel}, ${styleLabel}-Stil${refs.length > 0 ? ", mit Referenzbild" : ""}.

Schreibe einen prägnanten, dichten Bild-Prompt auf Deutsch (max. 3 Sätze). Beschreibe Pose, Ausdruck, Licht, Atmosphäre. KEINE Einleitungen, KEINE Meta-Kommentare. NUR der Prompt-Text.`,
        });
        const prompt = result.trim();
        if (prompt) {
          setPromptVersions(prev => [...prev, prompt]);
          setPromptVersionIdx(promptVersions.length);
          setCustomPrompt(prompt);
        }
      }

      if (wantsBackground) {
        const result = await generateText(genChain, {
          prompt: buildProfilePreamble(projectProfile) + `Beschreibe einen passenden Hintergrund für: "${chatInput.trim()}".

STRENGE REGELN: Nur die reine Hintergrundbeschreibung. Keine Personen. 2-3 Sätze auf Deutsch.`,
        });
        const bg = result.trim();
        if (bg) setSceneDescription(bg);
      }

      setChatInput("");
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
      toast.error(err.message);
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const navigatePromptVersion = (dir: "prev" | "next") => {
    const next = dir === "prev" ? Math.max(0, promptVersionIdx - 1) : Math.min(promptVersions.length - 1, promptVersionIdx + 1);
    setPromptVersionIdx(next);
    setCustomPrompt(promptVersions[next] ?? "");
  };

  const handleNewEmptyPrompt = () => {
    setPromptVersions(prev => [...prev, ""]);
    setPromptVersionIdx(promptVersions.length);
    setCustomPrompt("");
  };

  const handleCustomPromptChange = (val: string) => {
    setCustomPrompt(val);
    // Track edit in current version slot, or seed first version
    if (promptVersions.length === 0) {
      if (val) {
        setPromptVersions([val]);
        setPromptVersionIdx(0);
      }
    } else {
      setPromptVersions(prev => prev.map((v, i) => i === promptVersionIdx ? val : v));
    }
  };

  return (
    <PlanGate requires="basic" feature="Das Avatar Shooting Studio">
      <PageHeader
        title="Avatar Shooting Studio"
        subtitle="Lade ein Referenzbild hoch, wähle Format, Shot-Typ und Hintergrund — der Rest passiert automatisch."
        badge={<Badge tone="accent"><Camera className="w-3 h-3" /> Drehstudio</Badge>}
        cta={<TutorialCTA tutorialId="studio" />}
      />

      {/* ── Main Controls Card — Projekt 1:1 ── */}
      <Card className="!p-6 space-y-6 animate-fade-in max-w-4xl mx-auto">
        {/* Reference image upload — Projekt's slot-dots header */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            Referenzbilder
            <span className="flex items-center gap-2 ml-1">
              {[1, 2, 3].map((n) => (
                <span key={n} className="relative flex items-center justify-center w-4 h-4">
                  <span
                    className={cn(
                      "block w-3 h-3 rounded-full transition-all",
                      n <= refs.length ? "bg-flare-400" : "bg-ink-50/10 border border-ink-50/25",
                    )}
                  />
                </span>
              ))}
            </span>
          </label>
          <p className="text-[9px] text-ink-50/45 leading-tight">
            Mit Upload bestätigst du, dass du die Rechte besitzt.
          </p>
          <ImageDropZone images={refs} onChange={setRefs} max={3} />
        </div>

        {/* 4-col grid: Bildformat / Aufnahme-Typ / Kamerawinkel / Hauttyp */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium block">Bildformat</label>
            <Select
              value={aspect}
              onChange={(e) => setAspect(e.target.value)}
              options={ASPECT_RATIOS.map(a => ({ value: a.value, label: a.label }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium block">Aufnahme-Typ</label>
            <Select
              value={shotType}
              onChange={(e) => setShotType(e.target.value)}
              options={SHOT_TYPES}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium block">Kamerawinkel</label>
            <Select
              value={cameraAngle}
              onChange={(e) => setCameraAngle(e.target.value)}
              options={CAMERA_ANGLES.map(c => ({ value: c.value, label: c.label }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium block">Hauttyp</label>
            <Select
              value={skinType}
              onChange={(e) => setSkinType(e.target.value)}
              options={SKIN_TYPES.map(s => ({ value: s.value, label: s.label }))}
            />
          </div>
        </div>

        {/* Image Count Slider */}
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium">Anzahl Bilder</label>
            <span className="text-sm text-ink-50/55">
              {count}{plan.maxImagesPerRun > 0 ? ` / ${plan.maxImagesPerRun}` : ""}
            </span>
          </div>
          <Slider
            min={1}
            max={plan.maxImagesPerRun === -1 ? 10 : plan.maxImagesPerRun}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
          />
        </div>

        {/* Background — segmented horizontal toggle */}
        <div className="flex flex-col gap-2 items-start">
          <label className="text-xs text-ink-50/55">Hintergrund</label>
          <div className="inline-flex rounded-lg bg-ink-800/40 border border-white/8 p-1 gap-1 w-fit">
            {[
              { id: "white",       label: "Weiß",        icon: <div className="w-4 h-4 rounded-full bg-white border border-white/30" /> },
              { id: "greenscreen", label: "Green Screen", icon: <div className="w-4 h-4 rounded-full bg-green-500 border border-white/30" /> },
              { id: "scenery",     label: "Custom",       icon: <Mountain className="w-4 h-4" /> },
            ].map((option) => {
              const isSelected = background === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => setBackground(option.id)}
                  className={cn(
                    "relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                    isSelected
                      ? "bg-ink-900 text-ink-50 shadow-sm"
                      : "text-ink-50/55 hover:text-ink-50 hover:bg-ink-900/50",
                  )}
                >
                  {option.icon}
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>

          {/* Scene Description — collapsible when scenery selected */}
          <div className={cn(
            "overflow-hidden transition-all duration-300 ease-in-out w-full",
            background === "scenery" ? "max-h-96 opacity-100 mt-3" : "max-h-0 opacity-0 mt-0",
          )}>
            <div className="space-y-3">
              <Textarea
                placeholder="Beschreibe die Szene... (z.B. 'Strand bei Sonnenuntergang', 'Urbaner Park im Herbst')"
                value={sceneDescription}
                onChange={(e) => setSceneDescription(e.target.value)}
                rows={3}
              />

              {aiSuggestion && (
                <div className="animate-fade-in rounded-lg border border-flare-400/30 bg-flare-500/5 p-3 max-w-2xl">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-flare-300 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-50 leading-relaxed">{aiSuggestion}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button onClick={applySuggestion} size="sm" className="flex-1" iconLeft={<Check className="w-4 h-4" />}>
                      Übernehmen
                    </Button>
                    <Button
                      onClick={suggestBackground}
                      disabled={suggesting}
                      variant="secondary"
                      size="sm"
                    >
                      {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    </Button>
                    <Button onClick={() => setAiSuggestion("")} variant="ghost" size="sm">
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {!aiSuggestion && (
                <Button
                  onClick={suggestBackground}
                  loading={suggesting}
                  variant="secondary"
                  size="sm"
                  iconLeft={<Sparkles className="w-3.5 h-3.5" />}
                >
                  KI-Vorschlag
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Look + Custom Prompt toggle */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium block">Look / Stil</label>
            <Select value={style} onChange={(e) => setStyle(e.target.value)} options={STYLES} />
          </div>

          {/* Custom Prompt toggle */}
          <div className="flex items-center gap-3">
            <label
              htmlFor="custom-prompt-toggle"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Custom Prompt verwenden
            </label>
            <button
              id="custom-prompt-toggle"
              type="button"
              role="switch"
              aria-checked={useCustomPrompt}
              onClick={() => setUseCustomPrompt(v => !v)}
              className={cn(
                "relative inline-flex shrink-0 w-11 h-6 rounded-full transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flare-400/40",
                useCustomPrompt ? "bg-flare-grad" : "bg-white/10",
              )}
            >
              <span
                className={cn(
                  // 20px knob, 2px gutters on both sides → 44 − 20 − 2 − 2 = 20
                  // travel distance, so translate-x-5 lands the knob flush with
                  // a 2px right gutter inside the pill.
                  "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200",
                  useCustomPrompt ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
          </div>

          {/* Custom prompt input with KI-Assistent — smooth collapsible */}
          <div className={cn(
            "grid transition-all duration-300 ease-in-out",
            useCustomPrompt ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}>
            <div className="overflow-hidden">
              <div className="pt-2">
                <div className="flex gap-3 items-stretch flex-col lg:flex-row">
                  {/* Left: Prompt output with version navigation header */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2 h-7">
                      <div className="flex items-center gap-2 min-w-0">
                        <label htmlFor="custom-prompt-input" className="text-sm font-medium">Custom Image Prompt</label>
                        <AiSuggestButton
                          label="KI-Vorschlag"
                          buildPrompt={() => `Schreibe einen detaillierten, direkt nutzbaren Bild-Prompt für eine Pose/Szene, passend zum Projekt. Aktuell: "${customPrompt || "—"}". Antworte nur mit dem Prompt.`}
                          onApply={(v) => handleCustomPromptChange(v)}
                        />
                      </div>
                      {promptVersions.length > 0 && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigatePromptVersion("prev")}
                            disabled={promptVersionIdx === 0}
                            className="h-6 w-6 rounded-md flex items-center justify-center text-ink-50/65 hover:text-ink-50 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title="Vorherige Version"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="text-xs text-ink-50/55 font-medium min-w-[40px] text-center tabular-nums">
                            {promptVersionIdx + 1}/{promptVersions.length}
                          </span>
                          <button
                            onClick={() => navigatePromptVersion("next")}
                            disabled={promptVersionIdx === promptVersions.length - 1}
                            className="h-6 w-6 rounded-md flex items-center justify-center text-ink-50/65 hover:text-ink-50 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            title="Nächste Version"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <Textarea
                      id="custom-prompt-input"
                      placeholder="Beschreibe eine bestimmte Pose oder Szene..."
                      value={customPrompt}
                      onChange={(e) => handleCustomPromptChange(e.target.value)}
                      rows={5}
                      className="min-h-[124px]"
                    />
                  </div>

                  {/* Center: action buttons */}
                  <div className="flex lg:flex-col gap-2 lg:pt-9 self-stretch lg:self-auto">
                    <Button
                      onClick={handleGenerateWithAI}
                      disabled={!hasGenKey || !chatInput.trim() || generatingPrompt}
                      className="lg:w-10 lg:flex-1 flex-1"
                      title={
                        aiTarget === "background" ? "Hintergrund generieren" :
                        aiTarget === "both" ? "Prompt & Hintergrund generieren" :
                        "Prompt generieren und links einfügen"
                      }
                    >
                      {generatingPrompt
                        ? <Sparkles className="w-5 h-5 animate-spin" />
                        : <ChevronLeft className="w-6 h-6 hidden lg:block" />}
                      <span className="lg:hidden">{generatingPrompt ? "" : "Generieren"}</span>
                    </Button>
                    <Button
                      onClick={handleNewEmptyPrompt}
                      variant="secondary"
                      className="lg:w-10 lg:h-10 flex-shrink-0"
                      title="Neue leere Version"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Right: KI-Assistent chat input with target tabs */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center mb-2 h-7 gap-2">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-flare-300" />
                        <span className="text-sm font-medium text-ink-50/70">KI-Assistent</span>
                      </div>
                      <div className="flex-1 flex justify-end">
                        <div className="flex items-center gap-0.5 bg-ink-800/50 border border-white/8 rounded-md p-0.5">
                          {([
                            { key: "prompt",     label: "Prompt",     enabled: true },
                            { key: "background", label: "Hintergrund", enabled: background === "scenery" },
                            { key: "both",       label: "Beides",      enabled: background === "scenery" },
                          ] as const).map((tab) => {
                            const active = aiTarget === tab.key;
                            return (
                              <button
                                key={tab.key}
                                onClick={() => tab.enabled && setAiTarget(tab.key)}
                                disabled={!tab.enabled}
                                title={!tab.enabled ? "Nur bei 'Custom' Hintergrund verfügbar" : ""}
                                className={cn(
                                  "h-6 px-2 text-[11px] font-medium rounded transition-colors",
                                  active
                                    ? "bg-flare-grad text-white"
                                    : tab.enabled
                                      ? "text-ink-50/55 hover:text-ink-50 hover:bg-white/5"
                                      : "text-ink-50/30 cursor-not-allowed",
                                )}
                              >
                                {tab.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/8 bg-ink-800/30 h-[124px]">
                      <Textarea
                        placeholder={
                          aiTarget === "prompt"
                            ? "Beschreibe was du möchtest, z.B. 'Person sitzt auf einem Stuhl und lächelt'…"
                            : aiTarget === "background"
                              ? "Beschreibe den gewünschten Hintergrund, z.B. 'Strand bei Sonnenuntergang'…"
                              : "Beschreibe Person und Hintergrund, z.B. 'Person liest ein Buch im gemütlichen Café'…"
                        }
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleGenerateWithAI();
                          }
                        }}
                        className="h-full min-h-0 text-sm resize-none bg-transparent !border-0 !p-0 !shadow-none focus:!ring-0"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Generate buttons — single big or trio row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {slots.length === 0 ? (
            <Button
              onClick={generate}
              disabled={running || !hasGenKey || refs.length === 0}
              fullWidth
              size="lg"
              iconLeft={running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            >
              {running ? "Generiere…" : "Bilder generieren"}
            </Button>
          ) : (
            <>
              <Button
                onClick={generate}
                disabled={running || !hasGenKey || refs.length === 0}
                className="flex-[2]"
                size="lg"
                iconLeft={<Plus className="w-5 h-5" />}
              >
                {running ? "Hinzufügen…" : "Bilder dazu generieren"}
              </Button>
              <Button
                onClick={regenerateAll}
                disabled={running || !hasGenKey || refs.length === 0}
                variant="danger"
                className="flex-1"
                size="lg"
                iconLeft={<RotateCcw className="w-4 h-4" />}
              >
                Neu generieren
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* ── Gallery — outside the Card, full width ── */}
      <div className="mt-8">
        {slots.length === 0 ? (
          <div className="text-center py-12 text-sm text-ink-50/50 flex flex-col items-center gap-2">
            <ImageDown className="w-10 h-10 text-ink-50/25" />
            Noch keine Bilder generiert.
          </div>
        ) : (
          <div className="space-y-3 animate-slide-in-right">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-2xl font-bold tracking-tight">Generierte Bilder</h2>
              <div className="flex items-center gap-2">
                <MultiDownloadButton
                  images={slots
                    .filter((s) => s.status === "done" && s.dataUrl)
                    .map((s, i) => ({ dataUrl: s.dataUrl!, filename: s.filename || `studio-${i + 1}.png` }))}
                  zipName="studio-collection.zip"
                />
                <Button onClick={() => setSlots([])} variant="ghost" size="sm" iconLeft={<Trash2 className="w-3.5 h-3.5" />}>
                  Leeren
                </Button>
              </div>
            </div>
            <ImageGrid slots={slots} aspectClass={aspectClass(aspect)} onRetry={retry} filenamePrefix="studio" />

            {/* Add more images right where the gallery is — no need to scroll back up. */}
            <Button
              onClick={generate}
              disabled={running || !hasGenKey || refs.length === 0}
              fullWidth
              size="lg"
              iconLeft={running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            >
              {running ? "Hinzufügen…" : "Bilder hinzufügen"}
            </Button>
          </div>
        )}
      </div>
    </PlanGate>
  );
}
