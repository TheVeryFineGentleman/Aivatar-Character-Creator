import React from "react";
import { cn } from "@/lib/utils";
import type { SceneStatus } from "@/types/storyboard";

interface StatusBadgeProps {
  status: SceneStatus;
  className?: string;
}

const STATUS_CONFIG: Record<SceneStatus, { label: string; classes: string }> = {
  draft: { label: "Entwurf", classes: "bg-muted text-muted-foreground border-border" },
  "text-ok": { label: "Text OK", classes: "bg-muted text-muted-foreground border-border" },
  "image-ok": { label: "Bild OK", classes: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  "video-ok": { label: "Video OK", classes: "bg-green-500/15 text-green-400 border-green-500/30" },
  final: { label: "Final ✓", classes: "bg-primary/15 text-primary border-primary/30" },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        config.classes,
        className
      )}
    >
      {config.label}
    </span>
  );
};
