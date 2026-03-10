import React, { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ZoomIn } from "lucide-react";
import { DownloadButton } from "@/components/DownloadButton";

interface FullscreenLightboxProps {
  src: string;
  aspectRatio: string;
  expandedIndex: number;
  onClose: () => void;
  isBasicPlan?: boolean;
  onLockedClick?: () => void;
}

export const FullscreenLightbox: React.FC<FullscreenLightboxProps> = ({
  src,
  aspectRatio,
  expandedIndex,
  onClose,
  isBasicPlan = false,
  onLockedClick,
}) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Touch/pinch state
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

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

    setPosition(prev => clampPosition({
      x: prev.x + deltaX,
      y: prev.y + deltaY,
    }, zoom));

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [zoom, isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // Touch handlers for pinch-to-zoom and drag
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return null;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touches: React.TouchList) => {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
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
      
      if (newZoom === 1) {
        setPosition({ x: 0, y: 0 });
      }
      
      setZoom(newZoom);
      lastTouchDistance.current = newDist;
      
      // Also pan with two fingers
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
    if (e.touches.length === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleBackdropClick = () => {
    if (zoom > 1) {
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
        className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Aspect ratio badge */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
        <Badge variant="outline" className="text-[10px] h-5 px-2 border-primary/50 text-primary bg-primary/10">
          <span className="mr-1">📐</span> {aspectRatio}
        </Badge>
      </div>

      {/* Download button */}
      <div className="absolute bottom-14 sm:bottom-4 right-3 sm:right-4 z-10">
        <DownloadButton
          imageUrl={src}
          fileName={`szene-${expandedIndex + 1}-${aspectRatio.replace(":", "x")}.png`}
          variant="lightbox"
          isBasicPlan={isBasicPlan}
          onLockedClick={onLockedClick}
        />
      </div>

      {/* Zoom indicator */}
      {zoom > 1 && (
        <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-10 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full text-white text-xs font-medium flex items-center gap-1.5">
          <ZoomIn className="w-3.5 h-3.5" />
          {Math.round(zoom * 100)}%
        </div>
      )}

      {/* Hint text */}
      <p className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs sm:text-sm text-center whitespace-nowrap">
        {zoom > 1 ? "Tippen zum Zurücksetzen" : "Tippen zum Schließen • Pinch zum Zoomen"}
      </p>

      {/* Zoomable image */}
      <img
        ref={imgRef}
        src={src}
        alt="Vollbild-Ansicht"
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl select-none touch-none"
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
};
