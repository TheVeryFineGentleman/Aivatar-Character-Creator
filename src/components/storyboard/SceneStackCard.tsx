import React from "react";
import { ChevronDown, ChevronRight, GripVertical, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SceneStack } from "@/types/storyboard";
import { useStoryboard } from "@/contexts/StoryboardContext";
import { StatusBadge } from "./StatusBadge";
import { OverflowActionMenu, type OverflowAction } from "./OverflowActionMenu";
import { SceneSubStack } from "./SceneSubStack";

interface SceneStackCardProps {
  scene: SceneStack;
}

export const SceneStackCard: React.FC<SceneStackCardProps> = ({ scene }) => {
  const { toggleSceneExpanded, removeScene } = useStoryboard();
  const isExpanded = scene.isExpanded;

  // Get story-core summary for collapsed view
  const storyCoreCard = scene.subStacks
    .find(ss => ss.type === "story")
    ?.cards.find(c => c.type === "story-core");
  const summary = storyCoreCard?.data?.summary || "";
  
  // Get emotion + camera for chips
  const emotionCard = scene.subStacks
    .find(ss => ss.type === "appearance")
    ?.cards.find(c => c.type === "emotion");
  const cameraCard = scene.subStacks
    .find(ss => ss.type === "appearance")
    ?.cards.find(c => c.type === "camera");
  const chips = [
    emotionCard?.data?.emotion,
    cameraCard?.data?.shotType,
    cameraCard?.data?.cameraAngle,
  ].filter(Boolean) as string[];

  const overflowActions: OverflowAction[] = [
    { label: "KI: Szene verbessern", icon: <Sparkles className="w-3.5 h-3.5" />, onClick: () => {} },
    { label: "Szene löschen", icon: <Trash2 className="w-3.5 h-3.5" />, onClick: () => removeScene(scene.id), destructive: true, separator: true },
  ];

  return (
    <div
      className={cn(
        "rounded-xl border bg-card/60 backdrop-blur-sm transition-all duration-300",
        isExpanded
          ? "border-border/60 shadow-lg"
          : "border-border/40 hover:border-border/60",
        scene.status === "final" && "border-primary/30"
      )}
    >
      {/* Scene Stack Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 cursor-pointer select-none",
          !isExpanded && "hover:bg-muted/5"
        )}
        onClick={() => toggleSceneExpanded(scene.id)}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 cursor-grab" />
        <span className="text-sm font-semibold text-foreground">Szene {scene.index + 1}</span>
        <StatusBadge status={scene.status} />

        {/* Collapsed: summary + chips */}
        {!isExpanded && (
          <div className="flex-1 min-w-0 flex items-center gap-2 ml-2">
            {summary && (
              <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                {summary}
              </span>
            )}
            {chips.length > 0 && (
              <div className="hidden sm:flex gap-1">
                {chips.map((chip, i) => (
                  <span key={i} className="inline-flex items-center rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1">
          <OverflowActionMenu actions={overflowActions} />
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded: Sub-Stacks */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {scene.subStacks.map(subStack => (
            <SceneSubStack
              key={subStack.type}
              subStack={subStack}
              sceneId={scene.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};
