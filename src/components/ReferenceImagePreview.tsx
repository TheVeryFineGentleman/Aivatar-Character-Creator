import { useState, useEffect } from "react";

interface ReferenceImagePreviewProps {
  file: File;
  index: number;
  onRemove: (index: number) => void;
}

export const ReferenceImagePreview = ({ file, index, onRemove }: ReferenceImagePreviewProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset error state when file changes
    setHasError(false);
    
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Cleanup blob URL when component unmounts or file changes
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // If there's an error loading, auto-remove the problematic image
  useEffect(() => {
    if (hasError) {
      console.warn(`Removing corrupted reference image at index ${index}`);
      onRemove(index);
    }
  }, [hasError, index, onRemove]);

  if (!previewUrl) {
    return (
      <div className="w-24 h-24 rounded-lg border-2 border-border bg-muted animate-pulse" />
    );
  }

  return (
    <div className="relative group">
      <img
        src={previewUrl}
        alt={`Reference ${index + 1}`}
        className="w-24 h-24 object-cover rounded-lg border-2 border-border"
        onError={() => {
          console.warn("Failed to load preview image, marking for removal");
          setHasError(true);
        }}
      />
      <button
        onClick={() => onRemove(index)}
        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </div>
  );
};
