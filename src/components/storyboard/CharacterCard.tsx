import React from "react";
import { cn } from "@/lib/utils";
import { User, Pencil, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Character } from "@/types/storyboard";

interface CharacterCardProps {
  character: Character;
  onEdit: (character: Character) => void;
  onDelete: (characterId: string) => void;
  className?: string;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  onEdit,
  onDelete,
  className,
}) => {
  const avatar = character.referenceImages[0];

  return (
    <div
      className={cn(
        "group relative flex flex-col items-center gap-3 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-5 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 cursor-pointer",
        className,
      )}
      onClick={() => onEdit(character)}
    >
      {/* Avatar */}
      <div
        className="relative w-16 h-16 rounded-full overflow-hidden border-2 flex items-center justify-center bg-muted/50"
        style={{ borderColor: character.color || 'hsl(var(--border))' }}
      >
        {avatar ? (
          <img src={avatar} alt={character.name} className="w-full h-full object-cover" />
        ) : (
          <User className="w-7 h-7 text-muted-foreground" />
        )}
      </div>

      {/* Color dot */}
      <span
        className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full"
        style={{ backgroundColor: character.color || 'hsl(var(--primary))' }}
      />

      {/* Info */}
      <div className="text-center space-y-0.5 min-w-0 w-full">
        <p className="text-sm font-semibold text-foreground truncate">
          {character.name || "Unbenannt"}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {character.role || "Keine Rolle"}
        </p>
      </div>

      {/* Reference image count */}
      {character.referenceImages.length > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <ImageIcon className="w-3 h-3" />
          <span>{character.referenceImages.length} Bild{character.referenceImages.length > 1 ? 'er' : ''}</span>
        </div>
      )}

      {/* Hover actions */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 bg-card/80 backdrop-blur-sm hover:bg-primary/20"
          onClick={(e) => { e.stopPropagation(); onEdit(character); }}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 bg-card/80 backdrop-blur-sm hover:bg-destructive/20 hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(character.id); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};
