import { useState } from "react";
import { LayoutGrid, Sparkles, ScanLine, Trash2, Download, Loader2, ImageDown, FileArchive, Grid3X3 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/Shell";
import { TutorialCTA } from "@/components/tutorials/TutorialCTA";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ImageDropZone } from "@/components/ImageDropZone";
import { ImageSlotCard, type ImageSlotData } from "@/components/ImageSlot";
import { FullscreenLightbox } from "@/components/FullscreenLightbox";
import { PlanGate } from "@/components/PlanGate";
import { ASPECT_RATIOS } from "@/lib/aspectRatio";
import { useSettings } from "@/hooks/useSettings";
import { useProjectValue, useProjectRefImages, useProjectResults } from "@/hooks/useProjectGallery";
import { downloadAllAsZip, DOWNLOAD_RESOLUTIONS } from "@/lib/image";
import { urlToBase64 } from "@/lib/image";
import { Menu, MenuItem, MenuSection } from "@/components/ui/Menu";
import { geminiGenerateImage, AIError } from "@/lib/ai";
import { uid } from "@/lib/uid";
import { cn } from "@/lib/cn";

const ANGLES = [
  { id: "front",       label: "Front",                prompt: "head-on front view, camera at eye level, the person faces the camera directly with both eyes visible" },
  { id: "back",        label: "Rücken",               prompt: "from directly behind at eye level, showing the back of the head and body, the person faces away from camera" },
  { id: "right",       label: "Rechts",               prompt: "strict 90° right-side profile at eye level, the person's left side faces the camera, head looking to the viewer's left" },
  { id: "left",        label: "Links",                prompt: "strict 90° left-side profile at eye level, the person's right side faces the camera, head looking to the viewer's right" },
  { id: "front-above", label: "Schräg oben (vorne)",  prompt: "three-quarter view from the front at a slight high angle (~25° above), camera tilted down, the person's face is still clearly visible" },
  { id: "back-above",  label: "Schräg oben (hinten)", prompt: "three-quarter view from behind at a slight high angle (~25° above), camera tilted down, showing the back and shoulders" },
];

const STYLE_OPTIONS = [
  { id: "realistic", label: "Realistisch" },
  { id: "anime", label: "Anime" },
  { id: "comic", label: "Comic" },
  { id: "pixar", label: "Pixar / 3D" },
];

/**
 * Build a single-view prompt for the 6-angle character turnaround.
 *
 * Two non-negotiable goals:
 *  1. IDENTITY LOCK — every angle must depict the SAME individual from the
 *     reference image (face, age, build, hair, outfit, skin tone all identical).
 *  2. SAFETY — phrasing stays well within Google / fal content policy: the
 *     subject is an adult, fully clothed, in a neutral studio setting; no
 *     suggestive, romantic or intimate language; no minors implied.
 */
function buildViewPrompt(view: typeof ANGLES[number], style: string): string {
  const styleMap: Record<string, string> = {
    realistic: "photorealistic, natural studio lighting, true-to-life skin texture, sharp focus",
    anime:     "FULLY drawn 2D anime / manga illustration — clean bold cel ink linework, flat cel-shaded colour blocks, large expressive stylised anime eyes, simplified non-photographic skin, distinct stylised hair, vibrant palette. Hand-drawn anime art, NOT a photograph",
    comic:     "FULLY drawn Western comic-book illustration — thick black ink outlines, bold flat cel shading, halftone dot texture, high-contrast colours, graphic-novel rendering. Inked comic artwork, NOT a photograph",
    pixar:     "FULLY re-rendered stylised 3D CGI character in modern Pixar / 3D-animation style — smooth subsurface-scattering skin, soft rounded slightly-exaggerated features, large expressive eyes, glossy stylised hair, cinematic volumetric lighting. A 3D render, NOT a photograph",
  };
  // For non-realistic styles, the reference drives WHO it is — not the rendering.
  const stylized = style !== "realistic";
  return [
    // ── Subject ─────────────────────────────────────────────────────────────
    "A fully-clothed adult character — the SAME person shown in the uploaded reference image.",
    stylized
      ? "Treat the reference image as the canonical IDENTITY only: keep every facial feature, age, body proportion, " +
        "hair length, hair colour, eye colour and outfit recognisably the SAME person — but fully RE-DRAW them in the " +
        "render style below. Do NOT copy the reference's photographic look; transform the medium completely."
      : "Treat the reference image as the canonical identity. Every facial feature, age, body proportion, " +
        "hair length, hair color, eye color, skin tone, outfit and accessory MUST match the reference exactly. " +
        "Do not invent or alter the character's identity in any way.",

    // ── This specific view ─────────────────────────────────────────────────
    `Pose: standing upright in a relaxed, neutral pose, arms at the sides.`,
    `Camera angle: ${view.prompt}.`,
    `Framing: full body from head to feet, character centered, plenty of empty space around the silhouette.`,

    // ── Style + background ─────────────────────────────────────────────────
    `Render style: ${styleMap[style] || styleMap.realistic}.`,
    stylized
      ? "STYLE STRENGTH: apply this art style at 100% to the ENTIRE image — character, skin, hair, eyes, outfit and lighting must all be rendered in this style. It must NOT look like a photograph or a realistic render."
      : "",
    "Background: clean light-gray seamless photo studio backdrop, even soft lighting, no props, no other people, no shadows on the floor beyond a subtle contact shadow.",

    // ── Consistency directive ──────────────────────────────────────────────
    stylized
      ? "CONSISTENCY: this image is part of a 6-view character turnaround sheet. The OUTFIT, HAIR, BUILD and FACE " +
        "stay the same recognisable person AND the same art style across all views. If something is not visible in the " +
        "reference (e.g. the back of the head), extrapolate it plausibly while staying consistent with the visible cues."
      : "CONSISTENCY: this image is part of a 6-view character turnaround sheet. The OUTFIT, HAIR, BUILD and FACE " +
        "must be 100% identical to the reference and to the other views. No outfit changes, no hairstyle changes, " +
        "no aging, no weight change, no accessory swaps. If something is not visible in the reference (e.g. the back of the head), " +
        "extrapolate it plausibly while staying consistent with the visible cues.",

    // ── Safety / policy-friendly language ──────────────────────────────────
    "Content policy: depict a clothed adult only. No nudity, no sexually suggestive content, no intimate or " +
      "romantic context, no violence, no weapons, no minors. Tasteful, neutral, professional character sheet only.",

    // ── Negative directives ────────────────────────────────────────────────
    "Do NOT include: text, watermarks, logos, captions, multiple people, duplicate faces, collage, grid layout, " +
      "additional characters, props in hand, background scenery, distorted anatomy, extra limbs, missing limbs.",
  ].filter(Boolean).join("\n");
}

export default function ViewsPage() {
  const { activeKey, hasActiveKey } = useSettings();
  const [refs, setRefs] = useProjectRefImages("views:refs");
  const [selectedRef, setSelectedRef] = useProjectValue("views:selectedRef", 0);
  const [aspectRatio, setAspectRatio] = useProjectValue("views:aspectRatio", "1:1");
  const [style, setStyle] = useProjectValue("views:style", "realistic");
  const [results, setResults] = useProjectResults("views:results");
  const [currentAngle, setCurrentAngle] = useState(0);
  const [running, setRunning] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!hasActiveKey) { toast.error("API-Key fehlt."); return; }
    if (refs.length === 0) { toast.error("Lade ein Referenzbild hoch."); return; }

    setRunning(true);
    const ref = refs[Math.min(selectedRef, refs.length - 1)];
    const fresh: ImageSlotData[] = ANGLES.map(() => ({ id: uid(), status: "loading" as const }));
    setResults(fresh);

    // Identity anchor: once the FRONT view is generated, we feed it back as a
    // second reference for every subsequent angle. This is the single biggest
    // lever for keeping the same person across all 6 views.
    let frontAnchor: { mimeType: string; base64: string } | null = null;

    for (let i = 0; i < ANGLES.length; i++) {
      setCurrentAngle(i);
      try {
        const references = [{ mimeType: ref.mimeType, base64: ref.base64 }];
        if (frontAnchor && i > 0) references.push(frontAnchor);

        const dataUrl = await geminiGenerateImage({
          prompt: buildViewPrompt(ANGLES[i], style),
          references,
          apiKey: activeKey,
          aspectRatio,
        });
        setResults(prev => prev.map((x, idx) => idx === i ? { ...x, status: "done", dataUrl } : x));

        // First angle (front) → cache as identity anchor for the rest.
        if (i === 0 && dataUrl) {
          try {
            const { base64, mimeType } = await urlToBase64(dataUrl);
            frontAnchor = { base64, mimeType };
          } catch { /* not fatal — original ref alone still keeps identity reasonable */ }
        }
      } catch (e: any) {
        const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
        setResults(prev => prev.map((x, idx) => idx === i ? { ...x, status: "error", error: err.message, errorHint: err.hint } : x));
      }
      if (i < ANGLES.length - 1) await new Promise(r => setTimeout(r, 1500));
    }

    setRunning(false);
  };

  const retry = async (id: string) => {
    const idx = results.findIndex(r => r.id === id);
    if (idx < 0) return;
    const ref = refs[Math.min(selectedRef, refs.length - 1)];
    setResults(prev => prev.map((x, i) => i === idx ? { ...x, status: "loading", error: undefined } : x));

    // Build references: user upload + the already-generated front view (if any
    // and we're not regenerating the front itself), so a single-angle retry
    // still gets the identity anchor.
    const references = [{ mimeType: ref.mimeType, base64: ref.base64 }];
    if (idx > 0) {
      const front = results[0];
      if (front?.status === "done" && front.dataUrl) {
        try {
          const { base64, mimeType } = await urlToBase64(front.dataUrl);
          references.push({ base64, mimeType });
        } catch { /* fall back to user ref only */ }
      }
    }

    try {
      const dataUrl = await geminiGenerateImage({
        prompt: buildViewPrompt(ANGLES[idx], style),
        references,
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
    // Composite to canvas: 3 cols × 2 rows, 512px tiles
    const canvas = document.createElement("canvas");
    const cols = 3, rows = 2, size = 512, pad = 8;
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
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(x, y + size - 28, size, 28);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(ANGLES[i].label, x + size / 2, y + size - 9);
      } catch { /* skip */ }
    }

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `character-views-${Date.now()}.png`;
    a.click();
  };

  /** Download every view as a separate file in a ZIP, at the chosen resolution. */
  const handleDownloadZip = async (maxWidth: number) => {
    const items = results
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.status === "done" && r.dataUrl)
      .map(({ r, i }) => ({ dataUrl: r.dataUrl!, filename: `view-${ANGLES[i].id}.png` }));
    if (!items.length) return;
    try {
      await downloadAllAsZip(items, `character-views-${Date.now()}.zip`, maxWidth);
      const preset = DOWNLOAD_RESOLUTIONS.find((r) => r.maxWidth === maxWidth);
      toast.success(`ZIP (${preset?.label ?? "Original"}) heruntergeladen.`);
    } catch (e: any) {
      toast.error("Download fehlgeschlagen.", { description: e?.message });
    }
  };

  const progress = running ? ((currentAngle + 1) / ANGLES.length) * 100 : results.length > 0 ? 100 : 0;
  const validCount = results.filter(r => r.status === "done").length;

  return (
    <PlanGate requires="premium" feature="Die 6-Ansichten-Generierung">
      <PageHeader
        title="Character Views"
        subtitle="Ein Referenzbild — sechs konsistente Kameraperspektiven."
        badge={<Badge tone="cool"><LayoutGrid className="w-3 h-3" /> Pro</Badge>}
        cta={<TutorialCTA tutorialId="views" />}
      />

      {/* Card — Projekt 1:1 layout */}
      <Card className="!p-6 animate-fade-in max-w-3xl mx-auto">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <ScanLine className="w-4 h-4 text-flare-300" />
          6 Ansichten Generator
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

        {/* Format select */}
        <div className="space-y-1.5 mb-4">
          <label className="text-xs font-medium block">Format</label>
          <Select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            options={ASPECT_RATIOS.map(a => ({ value: a.value, label: a.label }))}
          />
        </div>

        {/* Style chips — 4-col grid */}
        <div className="space-y-1.5 mb-4">
          <label className="text-xs font-medium block">Stil</label>
          <div className="grid grid-cols-4 gap-2">
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

        {/* Generate button — full width */}
        <Button
          onClick={handleGenerate}
          disabled={refs.length === 0 || running || !hasActiveKey}
          fullWidth
          className="mb-4"
          iconLeft={running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        >
          {running ? `Ansicht ${currentAngle + 1} von ${ANGLES.length}…` : "6 Ansichten generieren"}
        </Button>

        {/* Progress bar */}
        {running && (
          <div className="mb-4 h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-flare-grad transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Results grid — 3 columns, labels at bottom of each tile */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-1.5">
              {ANGLES.map((angle, i) => (
                <div key={angle.id} className="relative">
                  <ImageSlotCard
                    slot={results[i]}
                    aspectClass="aspect-square"
                    onRetry={retry}
                    onZoom={() => results[i].status === "done" && setLightboxIndex(i)}
                    filenamePrefix={`view-${angle.id}`}
                  />
                  {results[i].status === "done" && (
                    <div className="absolute bottom-0 inset-x-0 bg-ink-950/70 backdrop-blur-sm text-ink-50 text-xs py-1 text-center font-medium pointer-events-none rounded-b-2xl">
                      {angle.label}
                    </div>
                  )}
                </div>
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
                      6er-Grid als PNG
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
            Lade ein Bild und starte die Generierung.
          </div>
        )}
      </Card>

      {(() => {
        const doneList = results
          .map((r, i) => ({ r, i }))
          .filter((x) => x.r.status === "done" && x.r.dataUrl);
        const items = doneList.map(({ r, i }) => ({
          src: r.dataUrl!,
          filename: `view-${ANGLES[i].id}.png`,
          label: ANGLES[i].label,
        }));
        const cur = lightboxIndex === null ? -1 : doneList.findIndex((x) => x.i === lightboxIndex);
        return (
          <FullscreenLightbox
            src={lightboxIndex !== null ? results[lightboxIndex]?.dataUrl ?? null : null}
            filename={lightboxIndex !== null ? `view-${ANGLES[lightboxIndex].id}.png` : "view.png"}
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
