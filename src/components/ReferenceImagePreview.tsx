/**
 * Tiny chip-style preview for a single reference image with a remove button.
 * Used inline above generation buttons or in the character editor.
 */
import { X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface Props {
  src: string;
  name?: string;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

export function ReferenceImagePreview({ src, name, onRemove, onClick, className }: Props) {
  return (
    <div className={cn(
      "relative group inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-2xl bg-ink-950/60 border border-white/8 max-w-full",
      className,
    )}>
      <button
        type="button"
        onClick={onClick}
        className="relative w-10 h-10 rounded-xl overflow-hidden bg-ink-900 flex-shrink-0 group-hover:ring-2 group-hover:ring-flare-400/40 transition-all"
      >
        {src ? (
          <img src={src} alt={name || "Referenz"} className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-4 h-4 text-ink-50/40 m-auto" />
        )}
      </button>
      {name && (
        <div className="text-xs text-ink-50/85 truncate max-w-[140px]">{name}</div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 w-5 h-5 rounded-full bg-ink-900/80 hover:bg-danger/40 flex items-center justify-center text-ink-50/55 hover:text-ink-50 transition-colors"
          aria-label="Referenz entfernen"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
