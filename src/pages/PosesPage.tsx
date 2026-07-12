import { useState } from "react";
import { LayoutGrid, Sparkles, Grid3X3, Trash2, Download, Loader2, ImageDown, FileArchive } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/Shell";
import { TutorialCTA } from "@/components/tutorials/TutorialCTA";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ImageDropZone } from "@/components/ImageDropZone";
import { ImageSlotCard, type ImageSlotData } from "@/components/ImageSlot";
import { FullscreenLightbox } from "@/components/FullscreenLightbox";
import { PlanGate } from "@/components/PlanGate";
import { ASPECT_RATIOS } from "@/lib/aspectRatio";
import { useSettings } from "@/hooks/useSettings";
import { useProjectValue, useProjectRefImages, useProjectResults } from "@/hooks/useProjectGallery";
import { downloadAllAsZip, DOWNLOAD_RESOLUTIONS } from "@/lib/image";
import { Menu, MenuItem, MenuSection } from "@/components/ui/Menu";
import { geminiGenerateImage, AIError } from "@/lib/ai";
import { uid } from "@/lib/uid";
import { cn } from "@/lib/cn";

const POSE_BANK = [
  "standing relaxed, hands in pockets",
  "arms crossed, confident stance",
  "walking towards camera mid-stride",
  "leaning against an invisible wall",
  "sitting on the floor cross-legged",
  "kneeling on one knee, looking up",
  "jumping mid-air, arms up",
  "laughing with head tilted back",
  "thoughtful, hand on chin",
  "looking over the shoulder",
  "stretching upwards reaching",
  "running pose, dynamic",
  "dance pose, expressive arms",
  "fighting stance, focused",
  "yoga pose — warrior II",
  "waving at camera",
  "pointing at the viewer",
  "holding an invisible cup",
  "looking down softly",
  "looking up at the sky",
  "back to camera, looking back",
  "sitting on a stool, hands on lap",
  "crouched, low to ground",
  "celebrating arms raised",
  "leaning forward, hands on knees",
];

const GRID_SIZES = [
  { id: "2x2", label: "2×2 (4 Posen)",  count: 4,  cols: 2 },
  { id: "3x3", label: "3×3 (9 Posen)",  count: 9,  cols: 3 },
  { id: "4x4", label: "4×4 (16 Posen)", count: 16, cols: 4 },
  { id: "5x5", label: "5×5 (25 Posen)", count: 25, cols: 5 },
];

const BG_OPTIONS = [
  { value: "white",    label: "Weiß" },
  { value: "location", label: "Ort-basiert" },
];

export default function PosesPage() {
  const { activeKey, hasActiveKey } = useSettings();

  const [refs, setRefs] = useProjectRefImages("poses:refs");
  const [selectedRef, setSelectedRef] = useProjectValue("poses:selectedRef", 0);
  const [gridSize, setGridSize] = useProjectValue("poses:gridSize", "3x3");
  const [aspectRatio, setAspectRatio] = useProjectValue("poses:aspectRatio", "1:1");
  const [outfit, setOutfit] = useProjectValue("poses:outfit", "");
  const [location, setLocation] = useProjectValue("poses:location", "");
  const [background, setBackground] = useProjectValue("poses:background", "white");

  const [results, setResults] = useProjectResults("poses:results");
  const [currentPose, setCurrentPose] = useState(0);
  const [running, setRunning] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const gridConfig = GRID_SIZES.find(g => g.id === gridSize) || GRID_SIZES[1];
  const cols = gridConfig.cols;
  const bgLabel = BG_OPTIONS.find(b => b.value === background)?.label || background;

  const handleGenerate = async () => {
    if (!hasActiveKey) { toast.error("API-Key fehlt."); return; }
    if (refs.length === 0) { toast.error("Lade ein Referenzbild hoch."); return; }

    setRunning(true);
    const ref = refs[Math.min(selectedRef, refs.length - 1)];
    const fresh: ImageSlotData[] = Array.from({ length: gridConfig.count }, () => ({ id: uid(), status: "loading" as const }));
    setResults(fresh);

    for (let i = 0; i < gridConfig.count; i++) {
      setCurrentPose(i);
      const pose = POSE_BANK[i % POSE_BANK.length];
      const prompt = [
        `Same character as in the reference image — strict identity lock (face, body, hair colour).`,
        `Pose: ${pose}.`,
        outfit.trim() ? `Outfit: ${outfit.trim()}.` : "",
        background === "location" && location.trim() ? `Location: ${location.trim()}.` : "",
        `Background: ${bgLabel.toLowerCase()}.`,
        "Photorealistic, full body framing, dynamic but natural composition, soft cinematic lighting.",
        "No text, letters, numbers or watermarks anywhere in the image.",
      ].filter(Boolean).join("\n");

      try {
        const dataUrl = await geminiGenerateImage({
          prompt,
          references: [{ mimeType: ref.mimeType, base64: ref.base64 }],
          apiKey: activeKey,
          aspectRatio,
        });
        setResults(prev => prev.map((x, idx) => idx === i ? { ...x, status: "done", dataUrl } : x));
      } catch (e: any) {
        const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
        setResults(prev => prev.map((x, idx) => idx === i ? { ...x, status: "error", error: err.message, errorHint: err.hint } : x));
      }
      if (i < gridConfig.count - 1) await new Promise(r => setTimeout(r, 1500));
    }

    setRunning(false);
  };

  const retry = async (id: string) => {
    const idx = results.findIndex(r => r.id === id);
    if (idx < 0) return;
    const ref = refs[Math.min(selectedRef, refs.length - 1)];
    setResults(prev => prev.map((x, i) => i === idx ? { ...x, status: "loading", error: undefined } : x));
    const pose = POSE_BANK[idx % POSE_BANK.length];
    const prompt = [
      `Same character as in the reference image — strict identity lock.`,
      `Pose: ${pose}.`,
      outfit.trim() ? `Outfit: ${outfit.trim()}.` : "",
      background === "location" && location.trim() ? `Location: ${location.trim()}.` : "",
      `Background: ${bgLabel.toLowerCase()}.`,
      "Photorealistic, full body framing.",
    ].filter(Boolean).join("\n");
    try {
      const dataUrl = await geminiGenerateImage({
        prompt,
        references: [{ mimeType: ref.mimeType, base64: ref.base64 }],
        apiKey: activeKey,
        aspectRatio,
      });
      setResults(prev => prev.map((x, i) => i === idx ? { ...x, status: "done", dataUrl } : x));
    } catch (e: any) {
      const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
      setResults(prev => prev.map((x, i) => i === idx ? { ...x, status: "error", error: err.message, errorHint: err.hint } : x));
    }
  };

  const handleDownloadAll = async () => {
    const valid = results.filter(r => r.status === "done" && r.dataUrl);
    if (valid.length === 0) return;
    const canvas = document.createElement("canvas");
    const size = 512, pad = 8;
    const rows = Math.ceil(gridConfig.count / cols);
    canvas.width = cols * size + (cols + 1) * pad;
    canvas.height = rows * size + (rows + 1) * pad;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const load = (src: string) => new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src;
    });

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status !== "done" || !r.dataUrl) continue;
      const col = i % cols, row = Math.floor(i / cols);
      const x = pad + col * (size + pad), y = pad + row * (size + pad);
      try {
        const im = await load(r.dataUrl);
        const scale = Math.max(size / im.width, size / im.height);
        const sw = size / scale, sh = size / scale;
        ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x, y, size, size);
      } catch { /* skip */ }
    }

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `pose-grid-${gridSize}-${Date.now()}.png`;
    a.click();
  };

  const handleDownloadZip = async (maxWidth: number) => {
    const items = results
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.status === "done" && r.dataUrl)
      .map(({ r, i }) => ({ dataUrl: r.dataUrl!, filename: `pose-${i + 1}.png` }));
    if (!items.length) return;
    try {
      await downloadAllAsZip(items, `pose-grid-${gridSize}-${Date.now()}.zip`, maxWidth);
      const preset = DOWNLOAD_RESOLUTIONS.find((r) => r.maxWidth === maxWidth);
      toast.success(`ZIP (${preset?.label ?? "Original"}) heruntergeladen.`);
    } catch (e: any) {
      toast.error("Download fehlgeschlagen.", { description: e?.message });
    }
  };

  const progress = running ? ((currentPose + 1) / gridConfig.count) * 100 : results.length > 0 ? 100 : 0;
  const validCount = results.filter(r => r.status === "done").length;

  return (
    <PlanGate requires="premium" feature="Das Pose-Grid">
      <PageHeader
        title="Pose Grid"
        subtitle="Bis zu 25 Posen für deinen Charakter — Outfit, Location und Hintergrund frei wählbar."
        badge={<Badge tone="cool"><LayoutGrid className="w-3 h-3" /> Pro</Badge>}
        cta={<TutorialCTA tutorialId="poses" />}
      />

      <Card className="!p-6 animate-fade-in max-w-3xl mx-auto">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <Grid3X3 className="w-4 h-4 text-flare-300" />
          Posen-Grid Generator
        </h3>

        {/* Reference upload + thumbnail strip */}
        <div className="space-y-2 mb-4">
          <label className="text-sm font-medium block">Referenzbild auswählen</label>
          <ImageDropZone images={refs} onChange={setRefs} max={3} />
          {refs.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 pt-2">
              {refs.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedRef(i)}
                  className={cn(
                    "shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all",
                    selectedRef === i
                      ? "border-flare-400 ring-2 ring-flare-400/30"
                      : "border-white/10 hover:border-flare-400/30",
                  )}
                >
                  <img src={`data:${r.mimeType};base64,${r.base64}`} alt={`Ref ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Settings — 2-col grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium block">Format</label>
            <Select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              options={ASPECT_RATIOS.map(a => ({ value: a.value, label: a.label }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium block">Grid-Größe</label>
            <Select
              value={gridSize}
              onChange={(e) => setGridSize(e.target.value)}
              options={GRID_SIZES.map(g => ({ value: g.id, label: g.label }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium block">Hintergrund</label>
            <Select
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              options={BG_OPTIONS}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium block">Outfit (optional)</label>
            <Input
              value={outfit}
              onChange={(e) => setOutfit(e.target.value)}
              placeholder="z. B. Business Anzug"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <label className="text-xs font-medium block">Ort (optional)</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="z. B. Büro, Park"
              disabled={background !== "location"}
            />
          </div>
        </div>

        {/* Generate button — w-full */}
        <Button
          onClick={handleGenerate}
          disabled={refs.length === 0 || running || !hasActiveKey}
          fullWidth
          className="mb-4"
          iconLeft={running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        >
          {running
            ? `Pose ${currentPose + 1} von ${gridConfig.count}…`
            : `${gridConfig.count} Posen generieren`}
        </Button>

        {/* Progress bar */}
        {running && (
          <div className="mb-4 h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-flare-grad transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Results grid — dynamic cols */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {results.map((slot, i) => (
                <ImageSlotCard
                  key={slot.id}
                  slot={slot}
                  aspectClass="aspect-square"
                  index={i + 1}
                  onRetry={retry}
                  onZoom={() => slot.status === "done" && setLightboxIndex(i)}
                  filenamePrefix={`pose-${i + 1}`}
                />
              ))}
            </div>

            {!running && results.some(r => r.status === "done") && (
              <div className="flex gap-2">
                <Menu
                  align="left"
                  triggerClassName="flex-1 inline-flex items-center justify-center gap-2 px-3 h-9 text-xs rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-ink-50"
                  trigger={<><Download className="w-3.5 h-3.5" /> Alle herunterladen ({validCount})</>}
                >
                  <MenuSection label="Composite (Grid-Bild)">
                    <MenuItem icon={<Grid3X3 className="w-4 h-4" />} onClick={handleDownloadAll}>
                      Posen-Grid als PNG
                    </MenuItem>
                  </MenuSection>
                  <MenuSection label="Einzelbilder als ZIP">
                    {DOWNLOAD_RESOLUTIONS.map((opt) => (
                      <MenuItem
                        key={opt.label}
                        icon={<FileArchive className="w-4 h-4" />}
                        onClick={() => handleDownloadZip(opt.maxWidth)}
                      >
                        {opt.label}
                      </MenuItem>
                    ))}
                  </MenuSection>
                </Menu>
                <Button variant="secondary" size="sm" onClick={() => setResults([])} iconLeft={<Trash2 className="w-3.5 h-3.5" />}>
                  Zurücksetzen
                </Button>
              </div>
            )}
          </div>
        )}

        {!running && results.length === 0 && (
          <div className="text-center py-6 text-xs text-ink-50/40 flex flex-col items-center gap-1.5">
            <ImageDown className="w-8 h-8 text-ink-50/20" />
            Lade ein Bild und wähle Grid-Größe.
          </div>
        )}
      </Card>

      {(() => {
        const doneList = results
          .map((r, i) => ({ r, i }))
          .filter((x) => x.r.status === "done" && x.r.dataUrl);
        const items = doneList.map(({ r, i }) => ({
          src: r.dataUrl!,
          filename: `pose-${i + 1}.png`,
          label: `Pose ${i + 1}`,
        }));
        const cur = lightboxIndex === null ? -1 : doneList.findIndex((x) => x.i === lightboxIndex);
        return (
          <FullscreenLightbox
            src={lightboxIndex !== null ? results[lightboxIndex]?.dataUrl ?? null : null}
            filename={lightboxIndex !== null ? `pose-${lightboxIndex + 1}.png` : "pose.png"}
            items={items}
            index={cur}
            onIndexChange={(di) => setLightboxIndex(doneList[di].i)}
            onClose={() => setLightboxIndex(null)}
          />
        );
      })()}
    </PlanGate>
  );
}
