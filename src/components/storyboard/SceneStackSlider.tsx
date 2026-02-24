import React from "react";
import { cn } from "@/lib/utils";
import type { SceneStack } from "@/types/storyboard";
import { StatusBadge } from "./StatusBadge";

interface SceneStackSliderProps {
  scenes: SceneStack[];
  activeIndex: number | null;
  onSelect: (index: number) => void;
}

export const SceneStackSlider: React.FC<SceneStackSliderProps> = ({ scenes, activeIndex, onSelect }) => {
  if (scenes.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
      {scenes.map((scene, i) => {
        const summary = scene.subStacks
          .find(ss => ss.type === "story")
          ?.cards.find(c => c.type === "story-core")
          ?.data?.summary || "";
        const isActive = activeIndex === i;

        return (
          <button
            key={scene.id}
            onClick={() => onSelect(i)}
            className={cn(
              "shrink-0 w-[130px] rounded-lg border px-3 py-2 text-left transition-all",
              isActive
                ? "border-primary/50 bg-primary/10 shadow-sm"
                : "border-border/40 bg-card/40 hover:border-border/60 hover:bg-card/60"
            )}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10px] font-bold text-foreground">Szene {i + 1}</span>
              <StatusBadge status={scene.status} />
            </div>
            {summary && (
              <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">{summary}</p>
            )}
          </button>
        );
      })}
    </div>
  );
};
