import { useEffect, useState } from "react";
import { RefreshCw, Download, AlertTriangle, Sparkles } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea, Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { SlotProgress } from "@/components/ui/SlotProgress";
import { cn } from "@/lib/cn";
import { ResolutionDownloadMenu } from "@/components/ResolutionDownloadMenu";
import {
  STORY_CAMERA_ANGLES, STORY_SHOT_TYPES, STORY_COMPOSITIONS,
  STORY_MOVEMENTS, STORY_AUDIENCE_EFFECTS, type StoryScene,
} from "@/lib/storyPrompts";

interface Props {
  open: boolean;
  scene: StoryScene | null;
  sceneIndex: number;
  aspectClass: string;
  onClose: () => void;
  onUpdate: (patch: Partial<StoryScene>) => void;
  onRegenerate: () => void;
}

export function StoryDetailDialog({ open, scene, sceneIndex, aspectClass, onClose, onUpdate, onRegenerate }: Props) {
  const [draft, setDraft] = useState<StoryScene | null>(scene);

  useEffect(() => {
    setDraft(scene);
  }, [scene]);

  if (!scene || !draft) return null;

  // In-session base64, or the durable bucket URL after a reload.
  const imgSrc = draft.imageDataUrl || draft.imageUrl;

  const patch = (p: Partial<StoryScene>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
    onUpdate(p);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Szene ${sceneIndex + 1}`}
      subtitle={draft.summary || "Bearbeite Details, Cinematography und regeneriere das Bild."}
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-ink-50/40">Änderungen werden sofort übernommen.</div>
          <div className="flex gap-2">
            {imgSrc && (
              <ResolutionDownloadMenu
                dataUrl={imgSrc}
                filename={`scene-${sceneIndex + 1}.png`}
                align="left"
                preferSide="top"
                triggerTitle="Bild speichern"
                triggerClassName="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-all duration-150 active:scale-[0.97] text-ink-50/80 hover:bg-white/5 hover:text-ink-50 h-9 px-3 text-xs rounded-md"
              >
                <Download className="w-3.5 h-3.5" />
                Bild speichern
              </ResolutionDownloadMenu>
            )}
            <Button
              onClick={onRegenerate}
              loading={draft.imageStatus === "loading"}
              iconLeft={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Bild neu generieren
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
        <div>
          <div className={cn("relative rounded-2xl overflow-hidden bg-ink-900 border border-white/8", aspectClass)}>
            {draft.imageStatus === "loading" && <div className="absolute inset-0 skeleton" />}
            {draft.imageStatus === "done" && imgSrc && (
              <img src={imgSrc} alt={draft.summary} className="w-full h-full object-cover" />
            )}
            {draft.imageStatus === "error" && (
              <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-center bg-danger/5">
                <AlertTriangle className="w-7 h-7 text-danger mb-2" />
                <div className="text-sm font-medium text-danger">{draft.imageError}</div>
                {draft.imageHint && <div className="text-xs text-ink-50/55 mt-1">{draft.imageHint}</div>}
              </div>
            )}
            {draft.imageStatus === "idle" && (
              <div className="absolute inset-0 flex items-center justify-center text-ink-50/30 text-sm">
                Noch kein Bild generiert
              </div>
            )}
            {draft.imageStatus !== "error" && <SlotProgress status={draft.imageStatus} barSize="thick" />}
          </div>
          {draft.detailedImagePrompt && (
            <details className="mt-3">
              <summary className="text-xs text-ink-50/40 cursor-pointer hover:text-ink-50/70 transition-colors flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Verwendeter Image-Prompt
              </summary>
              <pre className="mt-2 text-[11px] text-ink-50/55 whitespace-pre-wrap bg-ink-950/40 rounded-lg p-3 border border-white/5">{draft.detailedImagePrompt}</pre>
            </details>
          )}
        </div>

        <div className="space-y-3">
          <Input
            label="Titel"
            value={draft.summary}
            onChange={(e) => patch({ summary: e.target.value })}
            placeholder={`Szene ${sceneIndex + 1}`}
          />

          <Textarea
            label="Detail-Beschreibung"
            rows={4}
            value={draft.detailedDescription}
            onChange={(e) => patch({ detailedDescription: e.target.value })}
            placeholder="Was passiert in dieser Szene? Wer ist im Bild? Welche Aktion?"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Beteiligte Charaktere"
              value={draft.participants}
              onChange={(e) => patch({ participants: e.target.value })}
              placeholder="z.B. Anna, Mark"
            />
            <Input
              label="Bereich / Sub-Ort"
              value={draft.specificArea}
              onChange={(e) => patch({ specificArea: e.target.value })}
              placeholder="z.B. Wohnzimmer am Fenster"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Schlüssel-Aktion"
              value={draft.keyAction}
              onChange={(e) => patch({ keyAction: e.target.value })}
              placeholder="Die zentrale Geste/Aktion"
            />
            <Input
              label="Emotion"
              value={draft.emotion}
              onChange={(e) => patch({ emotion: e.target.value })}
              placeholder="z.B. überrascht, entschlossen"
            />
          </div>

          <Textarea
            label="Dialog / Sprechertext"
            rows={2}
            value={draft.dialogText}
            onChange={(e) => patch({ dialogText: e.target.value })}
            placeholder='z.B. „Was ist das?" — leer lassen für stumme Szene'
          />

          <div className="border-t border-white/5 pt-3 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge tone="accent" className="text-[10px]">Cinematography</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Kamerawinkel"
                value={draft.cameraAngle}
                onChange={(e) => patch({ cameraAngle: e.target.value })}
                options={STORY_CAMERA_ANGLES}
              />
              <Select
                label="Shot-Typ"
                value={draft.shotType}
                onChange={(e) => patch({ shotType: e.target.value })}
                options={STORY_SHOT_TYPES}
              />
              <Select
                label="Komposition"
                value={draft.composition}
                onChange={(e) => patch({ composition: e.target.value })}
                options={STORY_COMPOSITIONS}
              />
              <Select
                label="Kamerabewegung"
                value={draft.movement}
                onChange={(e) => patch({ movement: e.target.value })}
                options={STORY_MOVEMENTS}
              />
            </div>
            <div className="mt-3">
              <Select
                label="Wirkung auf den Zuschauer"
                value={draft.audienceEffect}
                onChange={(e) => patch({ audienceEffect: e.target.value })}
                options={STORY_AUDIENCE_EFFECTS}
              />
            </div>
          </div>

          <Textarea
            label="Continuity-Notizen"
            rows={2}
            value={draft.continuityNotes}
            onChange={(e) => patch({ continuityNotes: e.target.value })}
            placeholder="z.B. Kleidung gleich wie Szene 1, Brille bleibt, Requisit Buch in linker Hand"
            hint="Hilft der KI, Charakter und Props zwischen Szenen konsistent zu halten."
          />
        </div>
      </div>
    </Dialog>
  );
}
