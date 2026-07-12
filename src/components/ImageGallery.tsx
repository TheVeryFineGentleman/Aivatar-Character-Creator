/**
 * Persistent gallery of all generated images for the current project.
 * Pages through results in 24-item chunks and offers a bulk-download.
 */
import { useMemo, useState } from "react";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ImageSlotCard, type ImageSlotData } from "@/components/ImageSlot";
import { FullscreenLightbox } from "@/components/FullscreenLightbox";
import { MultiDownloadButton } from "@/components/DownloadButton";
import { cn } from "@/lib/cn";

interface Props {
  items: ImageSlotData[];
  aspectClass?: string;
  filenamePrefix?: string;
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClear?: () => void;
  title?: string;
  emptyHint?: string;
}

const PAGE_SIZE = 24;

export function ImageGallery({
  items, aspectClass = "aspect-square", filenamePrefix = "aivatar",
  onRetry, onDelete, onClear, title = "Galerie", emptyHint = "Noch keine Bilder.",
}: Props) {
  const [page, setPage] = useState(0);
  const [zoomed, setZoomed] = useState<ImageSlotData | null>(null);

  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const visible = useMemo(() => items.slice(start, start + PAGE_SIZE), [items, start]);

  const downloadable = useMemo(() =>
    items
      .filter((s) => s.status === "done" && s.dataUrl)
      .map((s, i) => ({ dataUrl: s.dataUrl!, filename: s.filename || `${filenamePrefix}-${i + 1}.png` })),
  [items, filenamePrefix]);

  if (!items.length) {
    return (
      <div className="text-center py-12 text-sm text-ink-50/55">{emptyHint}</div>
    );
  }

  return (
    <div className="space-y-3 animate-slide-in-right">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-ink-50/45 font-medium">{title}</span>
          <Badge tone="neutral" className="!text-[9px] !py-0">{items.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {downloadable.length > 0 && (
            <MultiDownloadButton images={downloadable} zipName={`${filenamePrefix}.zip`} />
          )}
          {onClear && (
            <Button onClick={onClear} variant="ghost" size="sm" iconLeft={<Trash2 className="w-3.5 h-3.5" />}>Leeren</Button>
          )}
        </div>
      </div>

      <div className={cn(
        "grid gap-3 stagger grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
      )}>
        {visible.map((slot, i) => (
          <div key={slot.id} className="animate-pop-in opacity-0 [animation-fill-mode:forwards]">
            <ImageSlotCard
              slot={slot}
              aspectClass={aspectClass}
              index={start + i + 1}
              filenamePrefix={filenamePrefix}
              onRetry={onRetry}
              onDelete={onDelete}
              onZoom={(s) => setZoomed(s)}
            />
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-xs text-ink-50/65 pt-2">
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} iconLeft={<ChevronLeft className="w-3.5 h-3.5" />}>
            Zurück
          </Button>
          <span>{page + 1} / {pages}</span>
          <Button variant="ghost" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} iconRight={<ChevronRight className="w-3.5 h-3.5" />}>
            Weiter
          </Button>
        </div>
      )}

      <FullscreenLightbox
        src={zoomed?.dataUrl ?? null}
        filename={zoomed?.filename || `${filenamePrefix}.png`}
        caption={zoomed?.prompt}
        onClose={() => setZoomed(null)}
      />
    </div>
  );
}
