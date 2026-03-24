import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, ZoomIn, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CharacterLightboxProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

export const CharacterLightbox: React.FC<CharacterLightboxProps> = ({
  images,
  initialIndex,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const resetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const selectImage = (index: number) => {
    setCurrentIndex(index);
    resetZoom();
  };

  const clampPosition = (pos: { x: number; y: number }, z: number) => {
    const maxOffset = (z - 1) * 50;
    return {
      x: Math.max(-maxOffset, Math.min(maxOffset, pos.x)),
      y: Math.max(-maxOffset, Math.min(maxOffset, pos.y)),
    };
  };

  const handleWheel = useCallback((e: React.WheelEvent<HTMLImageElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseXPx = e.clientX - (rect.left + rect.width / 2);
    const mouseYPx = e.clientY - (rect.top + rect.height / 2);
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    const newZoom = Math.min(Math.max(zoom + delta, 1), 4);
    if (newZoom === 1) {
      setPosition({ x: 0, y: 0 });
    } else {
      const zoomRatio = newZoom / zoom;
      setPosition(prev => ({
        x: prev.x * zoomRatio + (mouseXPx / rect.width * 100) * (1 - zoomRatio),
        y: prev.y * zoomRatio + (mouseYPx / rect.height * 100) * (1 - zoomRatio),
      }));
    }
    setZoom(newZoom);
  }, [zoom]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (zoom <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (zoom <= 1 || !isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100 * zoom;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100 * zoom;
    setPosition(prev => clampPosition({ x: prev.x + deltaX, y: prev.y + deltaY }, zoom));
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [zoom, isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) return { x: touches[0].clientX, y: touches[0].clientY };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  };

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLImageElement>) => {
    e.stopPropagation();
    if (e.touches.length === 2) {
      e.preventDefault();
      lastTouchDistance.current = getTouchDistance(e.touches);
      lastTouchCenter.current = getTouchCenter(e.touches);
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [zoom]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLImageElement>) => {
    e.stopPropagation();
    if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      e.preventDefault();
      const newDist = getTouchDistance(e.touches);
      if (newDist === null) return;
      const scale = newDist / lastTouchDistance.current;
      const newZoom = Math.min(Math.max(zoom * scale, 1), 4);
      if (newZoom === 1) setPosition({ x: 0, y: 0 });
      setZoom(newZoom);
      lastTouchDistance.current = newDist;
      const center = getTouchCenter(e.touches);
      if (lastTouchCenter.current && imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect();
        const dx = ((center.x - lastTouchCenter.current.x) / rect.width) * 100 * newZoom;
        const dy = ((center.y - lastTouchCenter.current.y) / rect.height) * 100 * newZoom;
        setPosition(prev => clampPosition({ x: prev.x + dx, y: prev.y + dy }, newZoom));
      }
      lastTouchCenter.current = center;
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      e.preventDefault();
      const rect = imgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = ((e.touches[0].clientX - dragStart.x) / rect.width) * 100 * zoom;
      const dy = ((e.touches[0].clientY - dragStart.y) / rect.height) * 100 * zoom;
      setPosition(prev => clampPosition({ x: prev.x + dx, y: prev.y + dy }, zoom));
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  }, [zoom, isDragging, dragStart]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLImageElement>) => {
    if (e.touches.length < 2) {
      lastTouchDistance.current = null;
      lastTouchCenter.current = null;
    }
    if (e.touches.length === 0) setIsDragging(false);
  }, []);

  const handleBackdropClick = () => {
    if (zoom > 1) resetZoom();
    else onClose();
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = images[currentIndex];
    link.download = `character-${currentIndex + 1}-${Date.now()}.png`;
    link.click();
  };

  const src = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col animate-backdrop-in"
      onClick={handleBackdropClick}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 z-10">
        <span className="text-white/60 text-sm">{currentIndex + 1} / {images.length}</span>
        
        {zoom > 1 && (
          <div className="bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium flex items-center gap-1.5">
            <ZoomIn className="w-3.5 h-3.5" />
            {Math.round(zoom * 100)}%
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white"
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main image area */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 px-4">
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
              onClick={(e) => { e.stopPropagation(); selectImage((currentIndex - 1 + images.length) % images.length); }}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
              onClick={(e) => { e.stopPropagation(); selectImage((currentIndex + 1) % images.length); }}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </>
        )}

        <img
          ref={imgRef}
          src={src}
          alt={`Charakter ${currentIndex + 1}`}
          className="max-w-[90vw] max-h-[70vh] object-contain rounded-lg shadow-2xl select-none touch-none"
          style={{
            transform: `translate(${position.x}%, ${position.y}%) scale(${zoom})`,
            cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-in",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      {/* Bottom thumbnail strip */}
      {images.length > 1 && (
        <div
          className="flex items-center justify-center gap-2 px-4 py-3 overflow-x-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => selectImage(i)}
              className={cn(
                "w-14 h-14 rounded-lg overflow-hidden border-2 transition-all shrink-0",
                i === currentIndex
                  ? "border-primary ring-1 ring-primary/50 scale-110"
                  : "border-white/20 opacity-60 hover:opacity-100"
              )}
            >
              <img src={img} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Hint */}
      <p className="text-white/40 text-xs text-center pb-3">
        {zoom > 1 ? "Tippen zum Zurücksetzen" : "Scrollen zum Zoomen • Tippen zum Schließen"}
      </p>
    </div>
  );
};
