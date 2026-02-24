import React from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SceneSubStack as SceneSubStackType, SubStackType } from "@/types/storyboard";
import { SUB_STACK_CONFIG } from "@/types/storyboard";
import { SceneSectionCard } from "./SceneSectionCard";
import { useStoryboard } from "@/contexts/StoryboardContext";

interface SceneSubStackProps {
  subStack: SceneSubStackType;
  sceneId: string;
}

// Map sub-stack types to tailwind border-l color classes
const ACCENT_CLASSES: Record<SubStackType, string> = {
  story: "border-l-blue-500",
  appearance: "border-l-purple-500",
  characters: "border-l-orange-500",
  generation: "border-l-green-500",
};

export const SceneSubStack: React.FC<SceneSubStackProps> = ({ subStack, sceneId }) => {
  const { toggleSubStackExpanded, updateCard, toggleCardExpanded, expandedCardId } = useStoryboard();
  const config = SUB_STACK_CONFIG[subStack.type];
  const isExpanded = subStack.isExpanded;

  // Build summary for collapsed state
  const summaryParts = subStack.cards
    .map(c => {
      const vals = Object.values(c.data).filter(v => typeof v === "string" && v.trim());
      return vals.length > 0 ? vals[0] as string : null;
    })
    .filter(Boolean);
  const summaryText = summaryParts.length > 0
    ? (summaryParts[0] as string).slice(0, 60) + ((summaryParts[0] as string).length > 60 ? "..." : "")
    : "";

  return (
    <div className={cn("border-l-2 rounded-r-lg", ACCENT_CLASSES[subStack.type])}>
      {/* Sub-Stack Header */}
      <button
        onClick={() => toggleSubStackExpanded(sceneId, subStack.type)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/10 transition-colors rounded-tr-lg"
      >
        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
          {config.letter}
        </span>
        <span className="text-xs font-semibold text-foreground">{config.label}</span>
        <span className="text-[10px] text-muted-foreground ml-1">{subStack.cards.length} Karten</span>

        {/* Collapsed summary */}
        {!isExpanded && summaryText && (
          <span className="text-[10px] text-muted-foreground truncate ml-auto mr-2 max-w-[200px]">
            {summaryText}
          </span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); /* AI sub-stack action */ }}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors"
            title={`KI: ${config.label} verbessern`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </button>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded: Cards */}
      {isExpanded && (
        <div className="space-y-2 px-2 pb-3 pt-1">
          {subStack.cards.map(card => {
            const isCardExpanded = expandedCardId === card.id;
            const anotherExpanded = expandedCardId !== null && expandedCardId !== card.id;
            return (
              <SceneSectionCard
                key={card.id}
                card={card}
                isExpanded={isCardExpanded}
                isFocused={isCardExpanded}
                isDimmed={anotherExpanded}
                onToggleExpand={() => toggleCardExpanded(sceneId, card.id)}
                onUpdateData={(updates) => updateCard(sceneId, card.id, updates)}
              >
                {/* Placeholder expanded editor — will be replaced per card type */}
                <div className="space-y-3 py-2">
                  {Object.entries(card.data).map(([key, value]) => {
                    if (Array.isArray(value)) return null;
                    return (
                      <div key={key} className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                          {key}
                        </label>
                        <textarea
                          value={String(value || "")}
                          onChange={(e) => updateCard(sceneId, card.id, { [key]: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y min-h-[60px]"
                          placeholder={`${key}...`}
                        />
                      </div>
                    );
                  })}
                </div>
              </SceneSectionCard>
            );
          })}
        </div>
      )}
    </div>
  );
};
