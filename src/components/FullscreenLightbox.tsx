/**
 * Fullscreen image lightbox with wheel-zoom and drag-to-pan.
 * Open by passing a `src` data-URL or http URL.
 *
 * Optional gallery mode: pass `items` + `index` + `onIndexChange` to show a
 * thumbnail strip of the other generated images under the main image and allow
 * navigating between them (thumbnails, arrow buttons, ←/→ keys).
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn, ZoomOut, Download, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { ResolutionDownloadMenu } from "@/components/ResolutionDownloadMenu";
import { cn } from "@/lib/cn";

export interface LightboxItem {
  src: string;
  filename?: string;
  caption?: string;
  label?: string;
}

interface Props {
  src: string | null;
  alt?: string;
  filename?: string;
  caption?: string;
  onClose: () => void;
  /** All images to show as thumbnails under the main image. */
  items?: LightboxItem[];
  /** Index of the current image inside `items`. */
  index?: number;
  /** Called when the user picks another image (thumbnail / arrows / keys). */
  onIndexChange?: (i: number) => void;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 6;

export function FullscreenLightbox({
  src, alt = "Bild", filename = "aivatar.png", caption, onClose,
  items, index, onIndexChange,
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; tX: number; tY: number } | null>(null);
  const didDragRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasGallery =
    Array.isArray(items) && items.length > 1 &&
    typeof index === "number" && index >= 0 && !!onIndexChange;

  const go = (i: number) => {
    if (!hasGallery) return;
    const len = items!.length;
    onIndexChange!(((i % len) + len) % len);
  };
  const prev = () => go((index ?? 0) - 1);
  const next = () => go((index ?? 0) + 1);

  useEffect(() => {
    if (!src) return;
    setZoom(1);
    setTranslate({ x: 0, y: 0 });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(MAX_ZOOM, z * 1.2));
      if (e.key === "-") setZoom((z) => Math.max(MIN_ZOOM, z / 1.2));
      if (e.key === "0") { setZoom(1); setTranslate({ x: 0, y: 0 }); }
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [src, onClose, hasGallery, index, items]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!src) return null;

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * (e.deltaY > 0 ? 0.92 : 1.08))));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    didDragRef.current = false;
    dragRef.current = { startX: e.clientX, startY: e.clientY, tX: translate.x, tY: translate.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    // Past a small threshold this is a drag (pan), not a click.
    if (Math.hypot(dx, dy) > 4) didDragRef.current = true;
    setTranslate({ x: dragRef.current.tX + dx, y: dragRef.current.tY + dy });
  };
  const endDrag = () => { dragRef.current = null; };

  const onImageClick = () => {
    // A drag just happened → only pan, swallow the click.
    if (didDragRef.current) { didDragRef.current = false; return; }
    if (zoom > 1) { setZoom(1); setTranslate({ x: 0, y: 0 }); return; }
    // In gallery mode a click on the image advances to the next one (in addition
    // to the arrow buttons / thumbnails / ←→ keys). Zoom stays on the wheel and
    // the toolbar buttons.
    if (hasGallery) { next(); return; }
    setZoom(2);
  };

  // Portal to <body> so the fixed overlay fills the viewport rather than being
  // trapped inside an ancestor that creates a containing block (the gallery
  // Card uses `backdrop-blur`, which would otherwise clip/offset the lightbox).
  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-ink-950/95 backdrop-blur-xl animate-fade-in flex items-center justify-center"
      onClick={(e) => e.target === containerRef.current && onClose()}
      onWheel={onWheel}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      {/* Image wrapper — sized to the image's intrinsic box so we can pin the
          download button to the top-right CORNER of the picture, not the
          viewport. Wrapper itself does NOT get the transform; it stays
          unscaled even when the user zooms the image inside. */}
      <div
        className={cn(
          "relative inline-block max-w-[95vw]",
          hasGallery ? "max-h-[74vh]" : "max-h-[90vh]",
        )}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onMouseDown={onMouseDown}
          className={cn(
            "block max-w-full rounded-2xl shadow-2xl animate-scale-in select-none",
            hasGallery ? "max-h-[74vh]" : "max-h-[90vh]",
            zoom > 1 ? "cursor-grab active:cursor-grabbing" : hasGallery ? "cursor-pointer" : "cursor-zoom-in",
          )}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${zoom})`,
            transition: dragRef.current ? "none" : "transform 120ms ease-out",
          }}
          onClick={onImageClick}
        />

        {/* Download — corner of the IMAGE (not the viewport). */}
        <div className="absolute top-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
          <ResolutionDownloadMenu
            dataUrl={src}
            filename={filename}
            align="right"
            preferSide="bottom"
            triggerTitle="Herunterladen"
            triggerClassName="w-10 h-10 rounded-2xl bg-ink-950/65 border border-white/15 backdrop-blur-md flex items-center justify-center text-ink-50 hover:bg-ink-950/85 hover:border-white/25 transition-all shadow-lg"
          >
            <Download className="w-4 h-4" />
          </ResolutionDownloadMenu>
        </div>
      </div>

      {/* Prev / next arrows (gallery mode) */}
      {hasGallery && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev(); }}
            title="Vorheriges Bild"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur flex items-center justify-center text-ink-50/80 hover:text-ink-50 transition-all z-10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next(); }}
            title="Nächstes Bild"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur flex items-center justify-center text-ink-50/80 hover:text-ink-50 transition-all z-10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {caption && (
        <div
          className={cn(
            "absolute left-6 right-6 text-center text-xs text-ink-50/65 pointer-events-none",
            hasGallery ? "bottom-28" : "bottom-6",
          )}
        >
          {caption}
        </div>
      )}

      {/* Thumbnail strip (gallery mode) */}
      {hasGallery && (
        <div
          className="absolute bottom-0 inset-x-0 z-10 flex justify-center pb-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-2 max-w-[92vw] overflow-x-auto px-3 py-2.5 rounded-2xl bg-ink-950/70 backdrop-blur-md border border-white/10">
            {items!.map((it, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); go(i); }}
                title={it.label || `Bild ${i + 1}`}
                className={cn(
                  "relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all",
                  i === index
                    ? "border-flare-400 ring-2 ring-flare-400/40"
                    : "border-white/10 opacity-60 hover:opacity-100 hover:border-white/30",
                )}
              >
                <img src={it.src} alt={it.label || `Bild ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="absolute top-6 right-6 flex items-center gap-2">
        {hasGallery && (
          <div className="mr-1 px-2.5 h-10 rounded-2xl bg-white/5 border border-white/10 backdrop-blur flex items-center text-xs text-ink-50/70 font-medium">
            {(index ?? 0) + 1} / {items!.length}
          </div>
        )}
        <ToolbarBtn onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))} title="Reinzoomen"><ZoomIn className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.25))} title="Rauszoomen"><ZoomOut className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => { setZoom(1); setTranslate({ x: 0, y: 0 }); }} title="Zurücksetzen"><RotateCcw className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={onClose} title="Schließen"><X className="w-4 h-4" /></ToolbarBtn>
      </div>
    </div>,
    document.body,
  );
}

function ToolbarBtn({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 backdrop-blur flex items-center justify-center text-ink-50/75 hover:bg-white/10 hover:text-ink-50 transition-all"
    >
      {children}
    </button>
  );
}
