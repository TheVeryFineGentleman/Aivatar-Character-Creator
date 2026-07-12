import { useCallback, useRef, useState } from "react";
import { ImagePlus, X, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { fileToBase64, compressImageToFitSize } from "@/lib/image";
import { uid } from "@/lib/uid";

export interface RefImage {
  id: string;
  dataUrl: string;
  base64: string;
  mimeType: string;
  name: string;
}

interface Props {
  images: RefImage[];
  onChange: (imgs: RefImage[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}

export function ImageDropZone({ images, onChange, max = 3, label = "Referenzbilder", hint = "Drag & Drop oder klicken — max. {max} Bilder" }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const remaining = max - images.length;
    if (remaining <= 0) return;
    const next: RefImage[] = [];
    for (const f of Array.from(files).slice(0, remaining)) {
      if (!f.type.startsWith("image/")) continue;
      const compressed = await compressImageToFitSize(f);
      const { base64, mimeType } = await fileToBase64(compressed);
      next.push({
        id: uid(),
        dataUrl: `data:${mimeType};base64,${base64}`,
        base64,
        mimeType,
        name: f.name,
      });
    }
    onChange([...images, ...next]);
  }, [images, max, onChange]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div className="field-label flex items-center justify-between">
        <span>{label}</span>
        <span className="text-ink-50/40 text-[10px]">{images.length}/{max}</span>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 p-5",
          dragging
            ? "border-flare-400 bg-flare-500/10 scale-[1.01]"
            : "border-white/10 hover:border-white/20 bg-ink-900/40",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        {images.length === 0 ? (
          <div className="text-center py-6 animate-fade-in">
            <Upload className={cn("w-7 h-7 mx-auto mb-2 text-ink-50/40 transition-transform duration-300", dragging && "scale-125 text-flare-300")} />
            <div className="text-sm text-ink-50/80">Bilder hier ablegen oder klicken</div>
            <div className="text-xs text-ink-50/45 mt-1">{hint.replace("{max}", String(max))}</div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 stagger">
            {images.map((img) => (
              <div key={img.id} className="relative group aspect-square rounded-xl overflow-hidden bg-ink-800 animate-pop-in hover-lift">
                <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <button
                  onClick={(e) => { e.stopPropagation(); onChange(images.filter((i) => i.id !== img.id)); }}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-ink-950/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 hover:rotate-90 hover:bg-danger/80"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {images.length < max && (
              <div className="aspect-square rounded-xl border border-dashed border-white/15 flex items-center justify-center text-ink-50/40 hover:border-white/30 hover:text-ink-50/70 transition-colors">
                <ImagePlus className="w-5 h-5" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
