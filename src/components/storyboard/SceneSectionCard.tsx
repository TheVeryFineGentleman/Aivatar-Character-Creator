import React from "react";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { CARD_TYPE_LABELS, type SceneCard, type SceneCardType } from "@/types/storyboard";
import { OverflowActionMenu, type OverflowAction } from "./OverflowActionMenu";

interface SceneSectionCardProps {
  card: SceneCard;
  isExpanded: boolean;
  isFocused: boolean; // true when THIS card is expanded
  isDimmed: boolean;  // true when ANOTHER card in same sub-stack is expanded
  onToggleExpand: () => void;
  onUpdateData: (updates: Record<string, any>) => void;
  children?: React.ReactNode; // expanded editor content
}

// Generate compact summary text based on card type and data
function getCardSummary(type: SceneCardType, data: Record<string, any>): { text: string; chips: string[] } {
  switch (type) {
    case "story-core":
      return {
        text: data.summary || "Keine Beschreibung",
        chips: [data.specificArea, data.keyAction].filter(Boolean),
      };
    case "action-goal":
      return {
        text: [data.goal && `Ziel: ${data.goal}`, data.blocking && `Blocking: ${data.blocking}`].filter(Boolean).join(" | ") || "Keine Handlung definiert",
        chips: [],
      };
    case "dialogue":
      return {
        text: data.dialogText || "Kein Dialog",
        chips: [],
      };
    case "emotion":
      return {
        text: [data.emotion, data.audienceEffect && `Wirkung: ${data.audienceEffect}`].filter(Boolean).join(" | ") || "Keine Emotion gewählt",
        chips: [],
      };
    case "camera":
      return {
        text: "",
        chips: [data.shotType, data.cameraAngle, data.composition].filter(Boolean),
      };
    case "style":
      return {
        text: data.styleNotes || "Keine besonderen Stil-Notizen",
        chips: [],
      };
    case "characters":
      return {
        text: data.characterUsages?.length
          ? data.characterUsages.map((u: any) => `${u.characterId} (${u.sceneRole})`).join(", ")
          : "Keine Charaktere zugewiesen",
        chips: [],
      };
    case "prompt-blueprint":
      return {
        text: data.detailedImagePrompt ? "Prompt vorhanden" : "Kein Prompt",
        chips: [data.videoPrompt ? "Video Prompt ✓" : null].filter(Boolean) as string[],
      };
    case "output-preview":
      return {
        text: "",
        chips: [],
      };
    default:
      return { text: "", chips: [] };
  }
}

export const SceneSectionCard: React.FC<SceneSectionCardProps> = ({
  card,
  isExpanded,
  isFocused,
  isDimmed,
  onToggleExpand,
  onUpdateData,
  children,
}) => {
  const label = CARD_TYPE_LABELS[card.type];
  const summary = getCardSummary(card.type, card.data);

  const overflowActions: OverflowAction[] = [
    { label: "Bearbeiten", onClick: onToggleExpand },
  ];

  return (
    <div
      className={cn(
        "rounded-lg border bg-card/50 transition-all duration-200",
        isFocused
          ? "border-primary/40 ring-1 ring-primary/20 shadow-[0_0_20px_hsl(var(--primary)/0.1)]"
          : "border-border/40",
        isDimmed && "opacity-60",
        !isExpanded && "cursor-pointer hover:border-border/60"
      )}
      onClick={() => !isExpanded && onToggleExpand()}
    >
      {/* Card Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <div className="ml-auto flex items-center gap-1">
          {!isExpanded && (
            <button
              onClick={(e) => { e.stopPropagation(); /* AI action placeholder */ }}
              className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors"
              title="KI verbessern"
            >
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}
          <OverflowActionMenu actions={overflowActions} />
        </div>
      </div>

      {/* Compact Summary */}
      {!isExpanded && (
        <div className="px-3 pb-2.5">
          {summary.text && (
            <p className="text-xs text-muted-foreground line-clamp-2">{summary.text}</p>
          )}
          {summary.chips.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {summary.chips.map((chip, i) => (
                <span key={i} className="inline-flex items-center rounded-full bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expanded Editor */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/30">
          {children}
        </div>
      )}
    </div>
  );
};
