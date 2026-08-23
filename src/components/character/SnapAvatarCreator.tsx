/**
 * Snap Avatar Creator — a one-screen quick generator for fast portraits.
 * Lighter than the full Quick mode: random seed, one click, four variants.
 */
import { useState } from "react";
import { Sparkles, Shuffle, Camera, ImageDown } from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { Badge } from "@/components/ui/Badge";
import { ImageGallery } from "@/components/ImageGallery";
import type { ImageSlotData } from "@/components/ImageSlot";
import { ASPECT_RATIOS, aspectClass } from "@/lib/aspectRatio";
import { NATIONALITIES, pickRandomNationality } from "@/lib/nationalities";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useGenerationLimiter } from "@/hooks/useGenerationLimiter";
import { AIError } from "@/lib/ai";
import { generateImage } from "@/lib/generate";
import { buildVariationBlocks } from "@/lib/characterPrompt";
import { uid } from "@/lib/uid";

const QUICK_STYLES = [
  { value: "photoreal",  label: "Fotorealistisch" },
  { value: "editorial",  label: "Editorial" },
  { value: "anime",      label: "Anime / Illustration" },
  { value: "3d",         label: "3D Render" },
  { value: "vintage",    label: "Vintage / Film" },
];

const GENDERS = [
  { value: "female",  label: "Weiblich" },
  { value: "male",    label: "Männlich" },
  { value: "neutral", label: "Divers" },
];

const AGE_RANGES = [
  { value: "young", label: "20er", hint: "20–28" },
  { value: "mid",   label: "30er", hint: "29–38" },
  { value: "late",  label: "40+",  hint: "40–55" },
];

function buildSnapPrompt(opts: { gender: string; ageRange: string; nationalityCode: string; style: string }): string {
  const nat = NATIONALITIES.find((n) => n.code === opts.nationalityCode) || NATIONALITIES[0];
  const gender = GENDERS.find((g) => g.value === opts.gender)?.label || opts.gender;
  const style = QUICK_STYLES.find((s) => s.value === opts.style)?.label || opts.style;
  const ageLabel = AGE_RANGES.find((a) => a.value === opts.ageRange)?.hint || "30s";
  return [
    `High-quality portrait of a ${gender.toLowerCase()} person, age ${ageLabel}.`,
    `Ethnic features hint: ${nat.promptHint}.`,
    `Style: ${style.toLowerCase()}.`,
    "Background: clean studio white (#FFFFFF), soft directional light.",
    "Natural skin texture, sharp focus, no text, no watermarks, no logos.",
  ].join(" ");
}

export function SnapAvatarCreator() {
  const { genChain, hasGenKey, missingKeyMessage } = useSettings();
  const { plan } = useAuth();
  const limiter = useGenerationLimiter();

  const [gender, setGender] = useState("female");
  const [ageRange, setAgeRange] = useState("mid");
  const [nationality, setNationality] = useState(NATIONALITIES[0].code);
  const [style, setStyle] = useState("photoreal");
  const [aspect, setAspect] = useState("4:5");
  const [count, setCount] = useState(plan.maxImagesPerRun === 1 ? 1 : 4);
  const [items, setItems] = useState<ImageSlotData[]>([]);
  const [running, setRunning] = useState(false);

  const randomize = () => {
    setGender(GENDERS[Math.floor(Math.random() * GENDERS.length)].value);
    setAgeRange(AGE_RANGES[Math.floor(Math.random() * AGE_RANGES.length)].value);
    setNationality(pickRandomNationality().code);
    setStyle(QUICK_STYLES[Math.floor(Math.random() * QUICK_STYLES.length)].value);
    toast.success("Zufalls-Mix gesetzt — los geht's!");
  };

  const snap = async () => {
    if (!hasGenKey) {
      toast.error(missingKeyMessage ?? "Bitte hinterlege zuerst deine API-Keys.", {
        description: "Google und fal.ai sind beide Pflicht — beide in den Einstellungen eintragen.",
      });
      return;
    }

    const { allowed, reason } = limiter.clampCount(count);
    if (reason) toast.info(reason);
    if (allowed === 0) return;

    const newSlots: ImageSlotData[] = Array.from({ length: allowed }, () => ({
      id: uid(),
      status: "loading",
    }));
    setItems((prev) => [...newSlots, ...prev]);
    setRunning(true);

    const prompt = buildSnapPrompt({ gender, ageRange, nationalityCode: nationality, style });
    // One distinct facial roll per image so every face is a different person.
    const variations = buildVariationBlocks(newSlots.length);

    await Promise.all(newSlots.map(async (slot, i) => {
      try {
        const fullPrompt = `${prompt}\n\n${variations[i]}`;
        const dataUrl = await generateImage(genChain, {
          prompt: fullPrompt,
          aspectRatio: aspect,
        });
        setItems((s) => s.map((x) => (x.id === slot.id ? { ...x, status: "done", dataUrl, prompt: fullPrompt } : x)));
      } catch (e: any) {
        const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
        setItems((s) => s.map((x) => (x.id === slot.id ? { ...x, status: "error", error: err.message, errorHint: err.hint } : x)));
      }
    }));
    limiter.record(allowed);
    setRunning(false);
  };

  const retry = async (id: string) => {
    setItems((s) => s.map((x) => (x.id === id ? { ...x, status: "loading", error: undefined } : x)));
    const prompt = `${buildSnapPrompt({ gender, ageRange, nationalityCode: nationality, style })}\n\n${buildVariationBlocks(1)[0]}`;
    try {
      const dataUrl = await generateImage(genChain, { prompt, aspectRatio: aspect });
      setItems((s) => s.map((x) => (x.id === id ? { ...x, status: "done", dataUrl } : x)));
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
      setItems((s) => s.map((x) => (x.id === id ? { ...x, status: "error", error: err.message, errorHint: err.hint } : x)));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Snap Avatar"
        subtitle='Vier Klicks — fertig. Für Tests, Mood-Boards und „mal schnell ein Gesicht".'
        icon={<Camera className="w-4 h-4" />}
        action={<Badge tone="cool">Schnell</Badge>}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <Select label="Geschlecht" value={gender} onChange={(e) => setGender(e.target.value)} options={GENDERS} />
        <Select label="Alter" value={ageRange} onChange={(e) => setAgeRange(e.target.value)} options={AGE_RANGES.map((a) => ({ value: a.value, label: a.label }))} />
        <Select label="Nationalität" value={nationality} onChange={(e) => setNationality(e.target.value)} options={NATIONALITIES.map((n) => ({ value: n.code, label: `${n.flag} ${n.label}` }))} />
        <Select label="Stil" value={style} onChange={(e) => setStyle(e.target.value)} options={QUICK_STYLES} />
        <Select label="Format" value={aspect} onChange={(e) => setAspect(e.target.value)} options={ASPECT_RATIOS.map((a) => ({ value: a.value, label: a.label }))} />
        <div>
          <Slider
            label="Bilder"
            valueLabel={`${count}`}
            min={1}
            max={plan.maxImagesPerRun === -1 ? 8 : plan.maxImagesPerRun}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <Button onClick={snap} loading={running} iconLeft={<Sparkles className="w-4 h-4" />} size="lg">
          {running ? "Schnappschuss…" : "Snap"}
        </Button>
        <Button onClick={randomize} variant="secondary" iconLeft={<Shuffle className="w-4 h-4" />}>
          Zufalls-Mix
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/8 py-12 text-center text-sm text-ink-50/45">
          <ImageDown className="w-8 h-8 mx-auto mb-2 text-ink-50/25" />
          Noch keine Schnappschüsse.
        </div>
      ) : (
        <ImageGallery
          items={items}
          aspectClass={aspectClass(aspect)}
          filenamePrefix="snap"
          onRetry={retry}
          onDelete={(id) => setItems((s) => s.filter((x) => x.id !== id))}
          onClear={() => setItems([])}
          title="Snap-Galerie"
        />
      )}
    </Card>
  );
}
