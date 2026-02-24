import React, { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStoryboard } from "@/contexts/StoryboardContext";

interface InsertSceneButtonRowProps {
  insertIndex: number;
}

export const InsertSceneButtonRow: React.FC<InsertSceneButtonRowProps> = ({ insertIndex }) => {
  const { insertSceneAt, duplicateScene, project } = useStoryboard();
  const [showMenu, setShowMenu] = useState(false);

  const prevScene = insertIndex > 0 ? project.scenes[insertIndex - 1] : null;

  return (
    <div className="relative flex items-center justify-center py-1 group">
      <div className="h-px flex-1 bg-border/20 group-hover:bg-border/40 transition-colors" />
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={cn(
          "w-6 h-6 rounded-full border border-border/40 bg-card flex items-center justify-center",
          "text-muted-foreground/50 hover:text-primary hover:border-primary/40 transition-all",
          "opacity-0 group-hover:opacity-100",
          showMenu && "opacity-100 text-primary border-primary/40"
        )}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      <div className="h-px flex-1 bg-border/20 group-hover:bg-border/40 transition-colors" />

      {showMenu && (
        <div className="absolute top-full mt-1 z-20 rounded-lg border border-border bg-popover shadow-lg py-1 min-w-[180px]">
          <button
            onClick={() => { insertSceneAt(insertIndex); setShowMenu(false); }}
            className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted/50 transition-colors"
          >
            Leere Szene einfügen
          </button>
          {prevScene && (
            <button
              onClick={() => { duplicateScene(prevScene.id); setShowMenu(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted/50 transition-colors"
            >
              Vorherige Szene duplizieren
            </button>
          )}
        </div>
      )}
    </div>
  );
};
