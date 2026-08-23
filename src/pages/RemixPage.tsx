import { useState } from "react";
import { Wand2, Sparkles, Loader2, RefreshCw, RotateCcw, ImageDown, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/Shell";
import { TutorialCTA } from "@/components/tutorials/TutorialCTA";
import { SuggestionField } from "@/components/ai/SuggestionField";
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
import { ASPECT_RATIOS, aspectClass } from "@/lib/aspectRatio";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useProjectGallery, useProjectValue, useProjectRefImages } from "@/hooks/useProjectGallery";
import { AIError } from "@/lib/ai";
import { generateImage } from "@/lib/generate";
import { buildRemixPrompts } from "@/lib/characterPrompt";
import { uid } from "@/lib/uid";
import { cn } from "@/lib/cn";

// "Auto" lets the reference image drive the look; the rest force a style and
// override any photographic look in the upload (see characterPrompt STYLE_TECH).
const STYLE_OPTIONS = [
  { id: "auto", label: "Auto (wie Vorlage)" },
  { id: "realistic", label: "Realistisch" },
  { id: "anime", label: "Anime" },
  { id: "comic", label: "Comic" },
  { id: "pixar", label: "Pixar / 3D" },
];

export default function RemixPage() {
  const { genChain, hasGenKey, missingKeys } = useSettings();
  const { plan } = useAuth();

  const [refs, setRefs] = useProjectRefImages("remix:refs");
  const [idea, setIdea] = useProjectValue("remix:idea", "");
  const [style, setStyle] = useProjectValue("remix:style", "auto");
  const [aspectRatio, setAspectRatio] = useProjectValue("remix:aspectRatio", "1:1");
  const [count, setCount] = useProjectValue("remix:count", plan.maxImagesPerRun === 1 ? 1 : 4);

  const [slots, setSlots] = useProjectGallery("remix");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasInput = refs.length > 0 || idea.trim().length > 0;
  const canGenerate = hasGenKey && hasInput;

  const reset = () => {
    setIdea(""); setStyle("auto"); setAspectRatio("1:1"); setError(null);
  };

  const generate = async (mode: "append" | "replace" = "append") => {
    if (!canGenerate) return;
    setRunning(true);
    setError(null);

    const limit = plan.maxImagesPerRun === -1 ? count : Math.min(count, plan.maxImagesPerRun);
    const fresh: ImageSlot[] = Array.from({ length: limit }, () => ({ id: uid(), status: "loading" as const }));
    setSlots(prev => mode === "replace" ? fresh : [...prev, ...fresh]);

    const prompts = buildRemixPrompts({ idea, styleId: style, hasReference: refs.length > 0, count: limit });
    const references = refs.map(r => ({ mimeType: r.mimeType, base64: r.base64 }));

    await Promise.all(fresh.map(async (slot, i) => {
      try {
        const prompt = prompts[i];
        const dataUrl = await generateImage(genChain, { prompt, references, aspectRatio });
        setSlots(s => s.map(x => x.id === slot.id ? { ...x, status: "done", dataUrl, prompt } : x));
      } catch (e: any) {
        const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
        setSlots(s => s.map(x => x.id === slot.id ? { ...x, status: "error", error: err.message, errorHint: err.hint } : x));
      }
    }));
    setRunning(false);
  };

  const retry = async (id: string) => {
    setSlots(s => s.map(x => x.id === id ? { ...x, status: "loading", error: undefined } : x));
    try {
      const prompt = buildRemixPrompts({ idea, styleId: style, hasReference: refs.length > 0, count: 1 })[0];
      const references = refs.map(r => ({ mimeType: r.mimeType, base64: r.base64 }));
      const dataUrl = await generateImage(genChain, { prompt, references, aspectRatio });
      setSlots(s => s.map(x => x.id === id ? { ...x, status: "done", dataUrl, prompt } : x));
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
      setSlots(s => s.map(x => x.id === id ? { ...x, status: "error", error: err.message, errorHint: err.hint } : x));
    }
  };

  // Missing-input hint
  const missing: string[] = [];
  if (!hasInput) missing.push("Bild hochladen oder Idee eingeben");
  // Beide Keys sind Pflicht — die Zeile benennt, welcher davon fehlt.
  if (!hasGenKey) missing.push(`${missingKeys.map((p) => (p === "google" ? "Google-Key" : "fal.ai-Key")).join(" + ")} (Einstellungen)`);

  return (
    <PlanGate requires="premium" feature="Smart Remix">
      <PageHeader
        title="Smart Remix"
        subtitle="Bild hochladen oder Idee beschreiben — die KI macht dir daraus eigenständige Charakter-Vorschläge."
        badge={<Badge tone="accent"><Wand2 className="w-3 h-3" /> Inspiration → Charaktere</Badge>}
        cta={<TutorialCTA tutorialId="remix" />}
      />

      <Card className="!p-6 space-y-5 animate-fade-in max-w-2xl mx-auto">
        {/* Reference image upload */}
        <div className="space-y-2">
          <ImageDropZone
            images={refs}
            onChange={setRefs}
            max={2}
            label="Vorlage / Inspiration"
            hint="Bild aus dem Netz ablegen oder klicken — max. {max} Bilder"
          />
          <p className="text-[9px] text-ink-50/45 leading-tight">
            Mit Upload bestätigst du, dass du die Rechte am Bild besitzt. Es dient nur als Stil-/Vibe-Vorlage —
            es werden neue, eigenständige Charaktere erstellt, keine Kopie der abgebildeten Person.
          </p>
        </div>

        {/* Idea */}
        <div className="space-y-2">
          <label className="text-sm font-medium block">Idee / Beschreibung (optional)</label>
          <SuggestionField
            as="textarea"
            rows={3}
            placeholder="z.B. 'mutige Weltraum-Pilotin im Retro-Sci-Fi-Look' — oder leer lassen und nur das Bild sprechen lassen."
            value={idea}
            onChange={setIdea}
            emptyHint="Wähle eine Idee oder schreib deine eigene…"
            cacheKey={`remix:idea:${style}`}
            what="eine Bild-Idee für den Charakter, der aus der Vorlage entsteht"
            shape="1–2 Sätze, konkret und visuell"
            current={idea}
            context={`Stil: ${STYLE_OPTIONS.find((s) => s.id === style)?.label ?? style}. Es entsteht ein eigenständiger Charakter, keine Kopie der Vorlage.`}
          />
        </div>

        {/* Style chips + format */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium block">Stil</label>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setStyle(opt.id)}
                  className={cn(
                    "px-3 py-2 rounded-lg border text-sm font-medium transition-all duration-200 active:scale-[0.97]",
                    style === opt.id
                      ? "border-flare-400 bg-flare-500/10 text-flare-200"
                      : "border-white/8 bg-white/[0.03] text-ink-50/65 hover:border-flare-400/30 hover:text-ink-50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium block">Format</label>
            <Select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              options={ASPECT_RATIOS.map(a => ({ value: a.value, label: a.label }))}
            />
            <div className="pt-2">
              <Slider
                label="Anzahl Vorschläge"
                valueLabel={`${count}${plan.maxImagesPerRun > 0 ? ` / ${plan.maxImagesPerRun}` : ""}`}
                min={1}
                max={plan.maxImagesPerRun === -1 ? 10 : plan.maxImagesPerRun}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Missing-input hint */}
        {!canGenerate && !running && missing.length > 0 && (
          <p className="text-xs text-ink-50/55 bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2">
            ⬆️ Noch nötig: <strong className="text-ink-50/85">{missing.join(", ")}</strong>
          </p>
        )}

        {/* Generate row */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => generate("replace")}
            disabled={!canGenerate || running}
            iconLeft={<RefreshCw className="w-4 h-4" />}
            title="Vorhandene ersetzen und neu generieren"
          >
            Neu generieren
          </Button>
          <Button
            onClick={() => generate("append")}
            disabled={!canGenerate || running}
            className="flex-1"
            iconLeft={running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          >
            {running ? "Remixe…" : slots.length > 0 ? `${count} dazu remixen` : `${count} Vorschläge remixen`}
          </Button>
          <Button variant="ghost" size="md" onClick={reset} title="Eingaben zurücksetzen">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">{error}</div>
        )}
      </Card>

      {/* Gallery below */}
      <div className="mt-8">
        {slots.length === 0 ? (
          <div className="text-center py-16 text-sm text-ink-50/50 flex flex-col items-center gap-2">
            <ImageDown className="w-10 h-10 text-ink-50/25" />
            Noch nichts remixt.
          </div>
        ) : (
          <div className="space-y-3 animate-slide-in-right">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-bold tracking-tight">Vorschläge</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-50/55">{slots.length}</span>
                <MultiDownloadButton
                  images={slots
                    .filter((s) => s.status === "done" && s.dataUrl)
                    .map((s, i) => ({ dataUrl: s.dataUrl!, filename: s.filename || `remix-${i + 1}.png` }))}
                  zipName="smart-remix-collection.zip"
                />
                <Button onClick={() => setSlots([])} variant="ghost" size="sm" iconLeft={<Trash2 className="w-3.5 h-3.5" />}>Leeren</Button>
              </div>
            </div>
            <ImageGrid slots={slots} aspectClass={aspectClass(aspectRatio)} onRetry={retry} filenamePrefix="remix" />

            {/* Add more suggestions without scrolling back up to the controls. */}
            <Button
              onClick={() => generate("append")}
              disabled={!canGenerate || running}
              fullWidth
              size="lg"
              iconLeft={running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            >
              {running ? "Remixe…" : "Vorschläge hinzufügen"}
            </Button>
          </div>
        )}
      </div>
    </PlanGate>
  );
}
