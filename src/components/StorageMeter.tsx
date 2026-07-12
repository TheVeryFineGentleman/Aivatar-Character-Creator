/**
 * Storage gauge — slim ring in the TopBar, full bar in the Settings dialog.
 * Drives the "Upgrade" CTA when usage exceeds 80%.
 */
import { useState } from "react";
import { HardDrive, Zap } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { formatBytes } from "@/lib/projectStorage";
import { cn } from "@/lib/cn";
import { StorageUpgradeModal } from "@/components/StorageUpgradeModal";

interface Props {
  variant?: "compact" | "full";
  className?: string;
}

export function StorageMeter({ variant = "compact", className }: Props) {
  const { quota } = useProjects();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const tone = quota.isOverLimit
    ? "text-danger border-danger/40 bg-danger/10"
    : quota.isNearLimit
    ? "text-warn border-warn/40 bg-warn/10"
    : "text-glacier-300 border-white/8 bg-white/3";

  if (variant === "compact") {
    return (
      <>
        <button
          type="button"
          onClick={() => setUpgradeOpen(true)}
          className={cn(
            "hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-colors hover:bg-white/5",
            tone,
            className,
          )}
          title={`${formatBytes(quota.usedBytes)} von ${formatBytes(quota.limitBytes)} verwendet`}
        >
          <HardDrive className="w-3 h-3" />
          <span className="text-[11px] font-medium tabular-nums">{Math.round(quota.percentUsed)}%</span>
        </button>
        <StorageUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
      </>
    );
  }

  return (
    <>
      <div className={cn("rounded-2xl border p-4 space-y-3", tone, className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4" />
            <span className="text-sm font-medium">Speicher</span>
          </div>
          <button
            onClick={() => setUpgradeOpen(true)}
            className="text-[11px] inline-flex items-center gap-1 hover:underline"
          >
            <Zap className="w-3 h-3" /> {quota.hasAddon ? "Verwalten" : "Upgrade"}
          </button>
        </div>

        <div>
          <div className="h-2 rounded-full bg-ink-950/60 overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                quota.isOverLimit ? "bg-danger" : quota.isNearLimit ? "bg-warn" : "bg-flare-grad",
              )}
              style={{ width: `${Math.min(100, quota.percentUsed)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[11px] text-ink-50/65">
            <span>{formatBytes(quota.usedBytes)} verwendet</span>
            <span>{formatBytes(quota.limitBytes)} verfügbar</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-ink-50/55">
          <span>{quota.projectsUsed} / {quota.projectLimit} Projekt{quota.projectLimit === 1 ? "" : "e"}</span>
          {quota.hasAddon && <span className="inline-flex items-center gap-1 text-flare-300"><Zap className="w-3 h-3" /> Addon aktiv</span>}
        </div>
      </div>
      <StorageUpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </>
  );
}
