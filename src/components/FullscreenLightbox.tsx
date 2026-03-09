import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ZoomIn } from "lucide-react";
import { DownloadButton } from "@/components/DownloadButton";

interface FullscreenLightboxProps {
  src: string;
  aspectRatio: string;
  expandedIndex: number;
  onClose: () => void;
}

export const FullscreenLightbox: React.FC<FullscreenLightboxProps> = ({
  src,
  aspectRatio,
  expandedIndex,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

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

    const maxOffset = (zoom - 1) * 50;
    setPosition(prev => ({
      x: Math.max(-maxOffset, Math.min(maxOffset, prev.x + deltaX)),
      y: Math.max(-maxOffset, Math.min(maxOffset, prev.y + deltaY)),
    }));

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [zoom, isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleBackdropClick = () => {
    if (zoom > 1) {
      // Reset zoom instead of closing
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    } else {
      onClose();
    }
  };


  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center animate-backdrop-in"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Aspect ratio badge - same style as preview column */}
      <div className="absolute top-4 left-4 z-10">
        <Badge variant="outline" className="text-[10px] h-5 px-2 border-primary/50 text-primary bg-primary/10">
          <span className="mr-1">📐</span> {aspectRatio}
        </Badge>
      </div>

      {/* Download button */}
      <div className="absolute bottom-4 right-4 z-10">
        <DownloadButton
          imageUrl={src}
          fileName={`szene-${expandedIndex + 1}-${aspectRatio.replace(":", "x")}.png`}
          variant="lightbox"
        />
      </div>

      {/* Zoom indicator */}
      {zoom > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium flex items-center gap-1.5">
          <ZoomIn className="w-3.5 h-3.5" />
          {Math.round(zoom * 100)}%
        </div>
      )}

      {/* Hint text */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
        {zoom > 1 ? "Klicken zum Zurücksetzen • Mausrad zum Zoomen" : "Klicken zum Schließen • Mausrad zum Zoomen"}
      </p>

      {/* Zoomable image */}
      <img
        src={src}
        alt="Vollbild-Ansicht"
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl select-none"
        style={{
          transform: `translate(${position.x}%, ${position.y}%) scale(${zoom})`,
          cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "ns-resize",
          transition: isDragging ? "none" : "transform 0.1s ease-out",
        }}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};
