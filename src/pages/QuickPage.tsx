import { useState } from "react";
import { Sparkles, Loader2, RotateCcw, RefreshCw, ImageDown, Trash2, Dice5, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/Shell";
import { TutorialCTA } from "@/components/tutorials/TutorialCTA";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { ImageGrid, type ImageSlot } from "@/components/ImageGrid";
import { MultiDownloadButton } from "@/components/DownloadButton";
import { PlanGate } from "@/components/PlanGate";
import { ASPECT_RATIOS, aspectClass } from "@/lib/aspectRatio";
import { NATIONALITIES, pickRandomNationality, findNationality } from "@/lib/nationalities";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useProjectGallery, useProjectValue } from "@/hooks/useProjectGallery";
import { geminiGenerateImage, AIError } from "@/lib/ai";
import { buildQuickPrompts } from "@/lib/characterPrompt";
import { uid } from "@/lib/uid";
import { cn } from "@/lib/cn";

const GENDER_OPTIONS = [
  { id: "male", label: "Männlich" },
  { id: "female", label: "Weiblich" },
  { id: "nonbinary", label: "Divers" },
];

const AGE_OPTIONS = [
  { id: "child", label: "Kind (6-12)", midpoint: 9 },
  { id: "teen", label: "Teenager (13-19)", midpoint: 16 },
  { id: "young-adult", label: "Jung (20-30)", midpoint: 25 },
  { id: "adult", label: "Erwachsen (30-50)", midpoint: 40 },
  { id: "senior", label: "Senior (50+)", midpoint: 60 },
];

const STYLE_OPTIONS = [
  { id: "realistic", label: "Realistisch" },
  { id: "anime", label: "Anime" },
  { id: "comic", label: "Comic" },
  { id: "pixar", label: "Pixar / 3D" },
];

export default function QuickPage() {
  const { activeKey, hasActiveKey } = useSettings();
  const { plan } = useAuth();

  const [gender, setGender] = useProjectValue("quick:gender", "");
  const [ageId, setAgeId] = useProjectValue("quick:ageId", "");
  const [style, setStyle] = useProjectValue("quick:style", "realistic");
  const [aspectRatio, setAspectRatio] = useProjectValue("quick:aspectRatio", "1:1");
  const [nat, setNat] = useProjectValue("quick:nat", "DE");
  const [count, setCount] = useProjectValue("quick:count", plan.maxImagesPerRun === 1 ? 1 : 4);

  const [slots, setSlots] = useProjectGallery("quick");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canGenerate = hasActiveKey && gender && ageId;

  const randomize = () => {
    const n = pickRandomNationality();
    setNat(n.code);
    toast(`Zufällig: ${n.flag} ${n.label}`);
  };

  const reset = () => {
    setGender(""); setAgeId(""); setStyle("realistic"); setAspectRatio("1:1");
    setError(null);
  };

  const generate = async (mode: "append" | "replace" = "append") => {
    if (!canGenerate) return;
    setRunning(true);
    setError(null);

    const age = AGE_OPTIONS.find(a => a.id === ageId)?.midpoint ?? 25;
    const limit = plan.maxImagesPerRun === -1 ? count : Math.min(count, plan.maxImagesPerRun);
    const fresh: ImageSlot[] = Array.from({ length: limit }, () => ({ id: uid(), status: "loading" as const }));
    setSlots(prev => mode === "replace" ? fresh : [...prev, ...fresh]);

    const nationalityHint = findNationality(nat)?.promptHint;
    const prompts = buildQuickPrompts({ gender, age, styleId: style, nationalityHint, count: limit });

    await Promise.all(fresh.map(async (slot, i) => {
      try {
        const prompt = prompts[i];
        const dataUrl = await geminiGenerateImage({ prompt, apiKey: activeKey, aspectRatio });
        setSlots(s => s.map(x => x.id === slot.id ? { ...x, status: "done", dataUrl } : x));
      } catch (e: any) {
        const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
        setSlots(s => s.map(x => x.id === slot.id ? { ...x, status: "error", error: err.message, errorHint: err.hint } : x));
      }
    }));
    setRunning(false);
  };

  const retry = async (id: string) => {
    const age = AGE_OPTIONS.find(a => a.id === ageId)?.midpoint ?? 25;
    setSlots(s => s.map(x => x.id === id ? { ...x, status: "loading", error: undefined } : x));
    try {
      const nationalityHint = findNationality(nat)?.promptHint;
      const prompt = buildQuickPrompts({ gender, age, styleId: style, nationalityHint, count: 1 })[0];
      const dataUrl = await geminiGenerateImage({ prompt, apiKey: activeKey, aspectRatio });
      setSlots(s => s.map(x => x.id === id ? { ...x, status: "done", dataUrl } : x));
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
      setSlots(s => s.map(x => x.id === id ? { ...x, status: "error", error: err.message, errorHint: err.hint } : x));
    }
  };

  // Missing-fields hint
  const missing: string[] = [];
  if (!gender) missing.push("Geschlecht");
  if (!ageId) missing.push("Alter");
  if (!hasActiveKey) missing.push("API-Key (Einstellungen)");

  return (
    <PlanGate requires="basic" feature="Der Quick Character Creator">
      <PageHeader
        title="Quick Character Creator"
        subtitle="Eckdaten setzen — Charakter erscheint."
        badge={<Badge tone="accent"><Sparkles className="w-3 h-3" /> Schnell-Modus</Badge>}
        cta={<TutorialCTA tutorialId="quick" />}
      />

      <Card className="!p-6 space-y-4 animate-fade-in max-w-2xl mx-auto">
        {/* Row 1: Gender + Age */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium block">Geschlecht *</label>
            <Select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              options={[{ value: "", label: "Wählen..." }, ...GENDER_OPTIONS.map(o => ({ value: o.id, label: o.label }))]}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium block">Alter *</label>
            <Select
              value={ageId}
              onChange={(e) => setAgeId(e.target.value)}
              options={[{ value: "", label: "Wählen..." }, ...AGE_OPTIONS.map(o => ({ value: o.id, label: o.label }))]}
            />
          </div>
        </div>

        {/* Row 2: Style chips (2x2) + Format select */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium block">Stil *</label>
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
            <label className="text-sm font-medium block">Format *</label>
            <Select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              options={ASPECT_RATIOS.map(a => ({ value: a.value, label: a.label }))}
            />
          </div>
        </div>

        {/* Row 3 (FINAL extra): Nationality + Zufall, Image count slider */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium block">Nationalität</label>
            <div className="flex gap-2">
              <Select
                className="flex-1"
                value={nat}
                onChange={(e) => setNat(e.target.value)}
                options={NATIONALITIES.map(n => ({ value: n.code, label: `${n.flag} ${n.label}` }))}
              />
              <Button variant="secondary" size="md" onClick={randomize} title="Zufällig">
                <Dice5 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <Slider
            label="Varianten"
            valueLabel={`${count}${plan.maxImagesPerRun > 0 ? ` / ${plan.maxImagesPerRun}` : ""}`}
            min={1}
            max={plan.maxImagesPerRun === -1 ? 10 : plan.maxImagesPerRun}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
          />
        </div>

        {/* Missing-fields hint */}
        {!canGenerate && !running && missing.length > 0 && (
          <p className="text-xs text-ink-50/55 bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2">
            ⬆️ Noch ausfüllen: <strong className="text-ink-50/85">{missing.join(", ")}</strong>
          </p>
        )}

        {/* Generate row: small "Neu generieren" (replace) left, wide "dazu generieren" (append) right */}
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
            iconLeft={running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          >
            {running ? "Generiere…" : slots.length > 0 ? `${count} dazu generieren` : `${count} Charaktere generieren`}
          </Button>
          <Button variant="ghost" size="md" onClick={reset} title="Auswahl zurücksetzen">
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
            Noch nichts generiert.
          </div>
        ) : (
          <div className="space-y-3 animate-slide-in-right">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-bold tracking-tight">Generierte Bilder</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-50/55">{slots.length}</span>
                <MultiDownloadButton
                  images={slots
                    .filter((s) => s.status === "done" && s.dataUrl)
                    .map((s, i) => ({ dataUrl: s.dataUrl!, filename: s.filename || `character-${i + 1}.png` }))}
                  zipName="character-collection.zip"
                />
                <Button onClick={() => setSlots([])} variant="ghost" size="sm" iconLeft={<Trash2 className="w-3.5 h-3.5" />}>Leeren</Button>
              </div>
            </div>
            <ImageGrid slots={slots} aspectClass={aspectClass(aspectRatio)} onRetry={retry} filenamePrefix="character" />

            {/* Add more characters without scrolling back up to the controls. */}
            <Button
              onClick={() => generate("append")}
              disabled={!canGenerate || running}
              fullWidth
              size="lg"
              iconLeft={running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            >
              {running ? "Generiere…" : "Bilder hinzufügen"}
            </Button>
          </div>
        )}
      </div>
    </PlanGate>
  );
}
