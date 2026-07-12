/**
 * Lightbox specialised for generated character portraits — adds copy-prompt
 * and "use as reference" actions on top of the generic FullscreenLightbox.
 */
import { useState } from "react";
import { Copy, Download, RefreshCw, ChevronLeft, ChevronRight, X, ImagePlus, Check } from "lucide-react";
import { ResolutionDownloadMenu } from "@/components/ResolutionDownloadMenu";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

export interface CharacterImage {
  id: string;
  dataUrl: string;
  prompt?: string;
  meta?: Record<string, string>;
}

interface Props {
  images: CharacterImage[];
  startId?: string | null;
  open: boolean;
  onClose: () => void;
  onRegenerate?: (img: CharacterImage) => void;
  onUseAsReference?: (img: CharacterImage) => void;
  filenamePrefix?: string;
}

export function CharacterLightbox({
  images, startId, open, onClose, onRegenerate, onUseAsReference, filenamePrefix = "character",
}: Props) {
  const [index, setIndex] = useState(() => {
    const i = images.findIndex((x) => x.id === startId);
    return i >= 0 ? i : 0;
  });

  if (!open || !images.length) return null;
  const current = images[Math.min(index, images.length - 1)];

  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);

  const copyPrompt = async () => {
    if (!current.prompt) return;
    try {
      await navigator.clipboard.writeText(current.prompt);
      toast.success("Prompt kopiert.");
    } catch {
      toast.error("Konnte Prompt nicht kopieren.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-950/95 backdrop-blur-xl animate-fade-in flex"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") prev();
        if (e.key === "ArrowRight") next();
        if (e.key === "Escape") onClose();
      }}
      tabIndex={-1}
      role="dialog"
    >
      <div className="flex-1 flex items-center justify-center relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={prev} className="absolute left-4 w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <img
          src={current.dataUrl}
          alt="Charakter"
          className="max-w-[80vw] max-h-[90vh] rounded-2xl shadow-2xl animate-scale-in"
        />
        <button onClick={next} className="absolute right-4 w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <aside
        onClick={(e) => e.stopPropagation()}
        className="hidden lg:flex flex-col w-80 bg-ink-900/95 backdrop-blur-2xl border-l border-white/8 p-5 overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs uppercase tracking-widest text-ink-50/45 font-medium">
            Bild {index + 1} / {images.length}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {current.meta && Object.keys(current.meta).length > 0 && (
          <div className="space-y-2 mb-5">
            {Object.entries(current.meta).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-ink-950/40 border border-white/5 px-3 py-2">
                <div className="text-[10px] uppercase tracking-widest text-ink-50/45 mb-0.5">{k}</div>
                <div className="text-xs text-ink-50/85 break-words">{v}</div>
              </div>
            ))}
          </div>
        )}

        {current.prompt && (
          <div className="rounded-xl bg-ink-950/40 border border-white/8 p-3 mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-widest text-ink-50/45 font-medium">Prompt</span>
              <CopyButton onCopy={copyPrompt} />
            </div>
            <p className="text-[11px] text-ink-50/65 leading-relaxed whitespace-pre-wrap">{current.prompt}</p>
          </div>
        )}

        <div className="mt-auto space-y-2">
          <ResolutionDownloadMenu
            dataUrl={current.dataUrl}
            filename={`${filenamePrefix}-${index + 1}.png`}
            align="left"
            preferSide="top"
            triggerClassName="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <span className="text-flare-300"><Download className="w-4 h-4" /></span>
            <span className="flex-1 text-left">Herunterladen</span>
          </ResolutionDownloadMenu>
          {onUseAsReference && (
            <SideAction onClick={() => { onUseAsReference(current); onClose(); }} icon={<ImagePlus className="w-4 h-4" />}>
              Als Referenz nutzen
            </SideAction>
          )}
          {onRegenerate && (
            <SideAction onClick={() => onRegenerate(current)} icon={<RefreshCw className="w-4 h-4" />}>
              Variante generieren
            </SideAction>
          )}
        </div>
      </aside>
    </div>
  );
}

function CopyButton({ onCopy }: { onCopy: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { onCopy(); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="text-[10px] text-ink-50/55 hover:text-flare-300 inline-flex items-center gap-1"
    >
      {done ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
      {done ? "Kopiert" : "Kopieren"}
    </button>
  );
}

function SideAction({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm",
        "bg-white/5 border border-white/10 hover:bg-white/10 transition-colors",
      )}
    >
      <span className="text-flare-300">{icon}</span>
      <span className="flex-1 text-left">{children}</span>
    </button>
  );
}
