import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CharacterCard } from "./CharacterCard";
import { CharacterEditor } from "./CharacterEditor";
import type { Character } from "@/types/storyboard";
import { createDefaultCharacter } from "@/types/storyboard";

interface CharacterPanelProps {
  characters: Character[];
  onCharactersChange: (characters: Character[]) => void;
  className?: string;
}

export const CharacterPanel: React.FC<CharacterPanelProps> = ({
  characters,
  onCharactersChange,
  className,
}) => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  const handleNew = () => {
    const newChar = createDefaultCharacter(crypto.randomUUID());
    setEditingCharacter(newChar);
    setEditorOpen(true);
  };

  const handleEdit = (character: Character) => {
    setEditingCharacter(character);
    setEditorOpen(true);
  };

  const handleSave = (character: Character) => {
    const exists = characters.find(c => c.id === character.id);
    if (exists) {
      onCharactersChange(characters.map(c => c.id === character.id ? character : c));
    } else {
      onCharactersChange([...characters, character]);
    }
  };

  const handleDelete = (characterId: string) => {
    onCharactersChange(characters.filter(c => c.id !== characterId));
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Charaktere</h2>
          {characters.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
              {characters.length}
            </span>
          )}
        </div>
        <Button onClick={handleNew} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" />
          Neuer Charakter
        </Button>
      </div>

      {/* Grid or Empty State */}
      {characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/50 rounded-xl bg-muted/10">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-primary/60" />
          </div>
          <h3 className="text-base font-semibold text-foreground/80 mb-1">Noch keine Charaktere</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Erstelle Charaktere mit Referenzbildern, Sprechstil und visueller Beschreibung für konsistente Ergebnisse.
          </p>
          <Button onClick={handleNew} variant="outline" size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Ersten Charakter anlegen
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {characters.map(char => (
            <CharacterCard
              key={char.id}
              character={char}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
          {/* Add button as card */}
          <button
            onClick={handleNew}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 bg-muted/10 p-5 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors min-h-[140px]"
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs font-medium">Hinzufügen</span>
          </button>
        </div>
      )}

      {/* Editor Sheet */}
      <CharacterEditor
        character={editingCharacter}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onSave={handleSave}
        allCharacters={characters}
      />
    </div>
  );
};
