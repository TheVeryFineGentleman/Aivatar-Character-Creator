import React from "react";
import { cn } from "@/lib/utils";
import type { Transition as TransitionType } from "@/types/storyboard";
import { TRANSITION_TYPES } from "@/types/storyboard";
import { Lock, Unlock } from "lucide-react";

interface TransitionCardProps {
  transition: TransitionType;
  onUpdate: (updates: Partial<TransitionType>) => void;
}

export const TransitionCard: React.FC<TransitionCardProps> = ({ transition, onUpdate }) => {
  const typeLabel = TRANSITION_TYPES.find(t => t.value === transition.type)?.label || transition.type;
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (!isExpanded) {
    return (
      <div
        className="flex items-center justify-center gap-3 py-1 cursor-pointer group"
        onClick={() => setIsExpanded(true)}
      >
        <div className="h-px flex-1 bg-border/30 group-hover:bg-border/60 transition-colors" />
        <span className="text-[10px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors font-medium">
          {typeLabel} • {transition.duration}s
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpdate({ isLocked: !transition.isLocked });
          }}
          className="text-muted-foreground/40 hover:text-muted-foreground"
        >
          {transition.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
        </button>
        <div className="h-px flex-1 bg-border/30 group-hover:bg-border/60 transition-colors" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border/50 bg-card/20 backdrop-blur-sm p-3 space-y-3 shadow-sm shadow-black/5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          Übergang: Szene {transition.fromSceneIndex + 1} → {transition.toSceneIndex + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdate({ isLocked: !transition.isLocked })}
            className={cn(
              "p-1 rounded transition-colors",
              transition.isLocked ? "text-amber-400" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {transition.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setIsExpanded(false)} className="text-xs text-muted-foreground hover:text-foreground px-1">
            ▲
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Typ</label>
          <select
            value={transition.type}
            onChange={(e) => onUpdate({ type: e.target.value as any })}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            {TRANSITION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Dauer</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="5"
            value={transition.duration}
            onChange={(e) => onUpdate({ duration: parseFloat(e.target.value) || 0 })}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">Audio</label>
          <select
            value={transition.audioTransition}
            onChange={(e) => onUpdate({ audioTransition: e.target.value as any })}
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          >
            <option value="cut">Cut</option>
            <option value="crossfade">Crossfade</option>
            <option value="fade-out">Fade Out</option>
            <option value="fade-in">Fade In</option>
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Kontinuität</label>
        <input
          value={transition.continuityNote}
          onChange={(e) => onUpdate({ continuityNote: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          placeholder="Hinweise zur visuellen Kontinuität..."
        />
      </div>
    </div>
  );
};
