/**
 * Read-only sibling of StoryDetailDialog — quick peek at a scene without an editor.
 * Used in pages where editing isn't appropriate (admin, history).
 */
import { Download, Film, Sparkles, Image as ImageIcon } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ResolutionDownloadMenu } from "@/components/ResolutionDownloadMenu";
import type { StoryScene } from "@/lib/storyPrompts";

interface Props {
  open: boolean;
  scene: StoryScene | null;
  sceneIndex: number;
  aspectClass?: string;
  onClose: () => void;
  onUseAsReference?: () => void;
}

export function StoryDetailPopup({ open, scene, sceneIndex, aspectClass = "aspect-square", onClose, onUseAsReference }: Props) {
  if (!scene) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={scene.summary || `Szene ${sceneIndex + 1}`}
      subtitle={scene.specificArea || undefined}
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-ink-50/55">Szene {sceneIndex + 1}</div>
          <div className="flex gap-2">
            {scene.imageDataUrl && (
              <ResolutionDownloadMenu
                dataUrl={scene.imageDataUrl}
                filename={`scene-${sceneIndex + 1}.png`}
                align="left"
                preferSide="top"
                triggerTitle="Bild herunterladen"
                triggerClassName="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-all duration-150 active:scale-[0.97] bg-white/5 text-ink-50 border border-white/10 hover:bg-white/10 hover:border-white/15 hover:shadow-md h-9 px-3 text-xs rounded-md"
              >
                <Download className="w-3.5 h-3.5" />
                Bild herunterladen
              </ResolutionDownloadMenu>
            )}
            {onUseAsReference && scene.imageDataUrl && (
              <Button size="sm" onClick={onUseAsReference} iconLeft={<ImageIcon className="w-3.5 h-3.5" />}>
                Als Referenz nutzen
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className={`rounded-2xl overflow-hidden bg-ink-900 border border-white/8 ${aspectClass}`}>
          {scene.imageDataUrl ? (
            <img src={scene.imageDataUrl} alt={scene.summary} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-ink-50/35 gap-2">
              <Film className="w-8 h-8" />
              <span className="text-xs">Kein Bild generiert</span>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Field label="Beschreibung" text={scene.detailedDescription} />
          {scene.dialogText && <Field label="Dialog" text={scene.dialogText} italic />}
          {scene.keyAction && <Field label="Kernaktion" text={scene.keyAction} />}
          {scene.emotion && <Field label="Emotion" text={scene.emotion} />}
          {scene.continuityNotes && <Field label="Continuity" text={scene.continuityNotes} />}

          <div className="flex flex-wrap gap-1.5 pt-2">
            {scene.cameraAngle && <Badge tone="neutral">{scene.cameraAngle}</Badge>}
            {scene.shotType && <Badge tone="neutral">{scene.shotType}</Badge>}
            {scene.composition && <Badge tone="cool">{scene.composition}</Badge>}
            {scene.movement && <Badge tone="cool">{scene.movement}</Badge>}
            {scene.audienceEffect && <Badge tone="accent"><Sparkles className="w-3 h-3" />{scene.audienceEffect}</Badge>}
          </div>
        </div>
      </div>

      {scene.detailedImagePrompt && (
        <details className="mt-5 rounded-2xl bg-ink-950/40 border border-white/8 p-4">
          <summary className="text-xs uppercase tracking-widest text-ink-50/55 font-medium cursor-pointer">Bild-Prompt</summary>
          <pre className="text-[11px] text-ink-50/65 whitespace-pre-wrap mt-2 font-mono">{scene.detailedImagePrompt}</pre>
        </details>
      )}
    </Dialog>
  );
}

function Field({ label, text, italic }: { label: string; text: string; italic?: boolean }) {
  if (!text) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-ink-50/45 font-medium mb-1">{label}</div>
      <p className={`text-sm text-ink-50/85 leading-relaxed ${italic ? "italic" : ""}`}>{text}</p>
    </div>
  );
}
