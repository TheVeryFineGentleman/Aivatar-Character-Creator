import React from "react";
import { cn } from "@/lib/utils";
import { type SceneStatus, SCENE_STATUS_CONFIG } from "@/types/storyboard";

interface SceneStatusBadgeProps {
  status: SceneStatus;
  className?: string;
  showDot?: boolean;
}

export const SceneStatusBadge: React.FC<SceneStatusBadgeProps> = ({
  status,
  className,
  showDot = true,
}) => {
  const config = SCENE_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide transition-colors",
        config.colorClass,
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dotClass)} />
      )}
      {config.label}
    </span>
  );
};
