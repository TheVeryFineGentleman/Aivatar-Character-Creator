import React from "react";
import { Lock, Unlock } from "lucide-react";
import type { LockState } from "@/types/storyboard";
import { cn } from "@/lib/utils";

interface GenerationLockChipsProps {
  locks: LockState;
  onToggle: (key: keyof LockState) => void;
}

const LOCK_LABELS: Record<keyof LockState, string> = {
  character: "Charakter",
  style: "Stil",
  camera: "Kamera",
  dialogue: "Dialog",
};

export const GenerationLockChips: React.FC<GenerationLockChipsProps> = ({ locks, onToggle }) => {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(locks) as (keyof LockState)[]).map((key) => {
        const isLocked = locks[key];
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border transition-all",
              isLocked
                ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                : "border-border bg-muted/30 text-muted-foreground hover:border-border/80"
            )}
          >
            {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            {LOCK_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
};
