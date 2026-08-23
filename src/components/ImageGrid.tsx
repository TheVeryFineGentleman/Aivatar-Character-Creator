import { useState } from "react";
import { cn } from "@/lib/cn";
import { ImageSlotCard, type ImageSlotData } from "@/components/ImageSlot";
import { FullscreenLightbox } from "@/components/FullscreenLightbox";

// Re-export legacy alias so existing callers keep compiling.
export type ImageSlot = ImageSlotData;

interface Props {
  slots: ImageSlot[];
  aspectClass?: string;            // e.g. "aspect-square", "aspect-[9/16]"
  onRetry?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCancel?: (id: string) => void;
  filenamePrefix?: string;
}

export function ImageGrid({
  slots, aspectClass = "aspect-square", onRetry, onDelete, onCancel,
  filenamePrefix = "aivatar",
}: Props) {
  const [zoomId, setZoomId] = useState<string | null>(null);

  if (slots.length === 0) return null;

  // All finished images → drive the lightbox thumbnail strip + navigation.
  const gallery = slots.filter((s) => s.status === "done" && s.dataUrl);
  const lightboxItems = gallery.map((s, i) => ({
    src: s.dataUrl!,
    filename: s.filename || `${filenamePrefix}-${i + 1}.png`,
    caption: s.prompt,
  }));
  const zoomIndex = zoomId ? gallery.findIndex((s) => s.id === zoomId) : -1;
  const current = zoomIndex >= 0 ? lightboxItems[zoomIndex] : null;

  // Fixed column layout — tile size depends only on screen width, never on the
  // number of generated images, so every preview is rendered at the same size.
  const cols = "sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <>
      <div className={cn("grid gap-4 stagger grid-cols-1", cols)}>
        {slots.map((slot, i) => (
          <div key={slot.id} className="animate-pop-in opacity-0 [animation-fill-mode:forwards]">
            <ImageSlotCard
              slot={slot}
              aspectClass={aspectClass}
              index={i + 1}
              filenamePrefix={filenamePrefix}
              onRetry={onRetry}
              onDelete={onDelete}
              onCancel={onCancel}
              onZoom={(s) => s.dataUrl && setZoomId(s.id)}
            />
          </div>
        ))}
      </div>

      <FullscreenLightbox
        src={current?.src ?? null}
        filename={current?.filename || `${filenamePrefix}.png`}
        caption={current?.caption}
        items={lightboxItems}
        index={zoomIndex}
        onIndexChange={(i) => setZoomId(gallery[i]?.id ?? null)}
        onClose={() => setZoomId(null)}
      />
    </>
  );
}
