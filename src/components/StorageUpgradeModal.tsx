/**
 * Storage upgrade — sells the €5/mo 25 GB Stripe subscription.
 * Falls back to a hint if the user isn't logged in or the server is offline.
 */
import { useState } from "react";
import { HardDrive, Zap, Check, ExternalLink } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { formatBytes } from "@/lib/projectStorage";
import { startStorageCheckout } from "@/lib/serverAI";
import { toast } from "sonner";

export function StorageUpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { credentials } = useAuth();
  const { quota } = useProjects();
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    if (!credentials) {
      toast.error("Bitte zuerst anmelden, um ein Addon zu buchen.");
      return;
    }
    setLoading(true);
    try {
      const { url } = await startStorageCheckout({
        email: credentials.email,
        successUrl: `${window.location.origin}/?storage=success`,
        cancelUrl:  `${window.location.origin}/?storage=cancel`,
      });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message || "Checkout konnte nicht gestartet werden.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={quota.hasAddon ? "Speicher-Addon aktiv" : "Mehr Speicher freischalten"}
      subtitle={quota.hasAddon ? "Du nutzt das 25-GB-Addon." : "Erweitere auf 25 GB und 3 Projekte für 5 € / Monat."}
      size="lg"
      footer={
        <div className="flex justify-between gap-3 items-center">
          <a href="https://www.aistudio.google.com" target="_blank" rel="noreferrer" className="text-xs text-ink-50/55 hover:text-flare-300 inline-flex items-center gap-1">
            Warum brauche ich Speicher? <ExternalLink className="w-3 h-3" />
          </a>
          {quota.hasAddon ? (
            <Button onClick={onClose}>Schließen</Button>
          ) : (
            <Button onClick={startCheckout} loading={loading} iconLeft={<Zap className="w-4 h-4" />}>
              Jetzt upgraden — 5 €/mo
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Tile
          tone="default"
          active={!quota.hasAddon}
          title="Free"
          price="0 €"
          features={["3 GB Speicher", "1 Projekt", "Alle Studio-Tools"]}
        />
        <Tile
          tone="hot"
          active={quota.hasAddon}
          title="Storage Addon"
          price="5 € / mo"
          features={["25 GB Speicher", "3 Projekte", "Inkl. Backups"]}
          highlight
        />
      </div>

      <div className="mt-6 p-4 rounded-2xl bg-ink-950/40 border border-white/8 text-xs text-ink-50/65 leading-relaxed">
        <div className="flex items-center gap-2 mb-1.5 text-ink-50">
          <HardDrive className="w-3.5 h-3.5 text-flare-300" />
          <span className="font-medium">Aktueller Verbrauch</span>
        </div>
        {formatBytes(quota.usedBytes)} von {formatBytes(quota.limitBytes)} ·
        {" "}{quota.projectsUsed} von {quota.projectLimit} Projekt{quota.projectLimit === 1 ? "" : "en"}.
      </div>
    </Dialog>
  );
}

function Tile({
  title, price, features, highlight, active, tone,
}: {
  title: string; price: string; features: string[];
  highlight?: boolean; active?: boolean; tone: "default" | "hot";
}) {
  void tone;
  return (
    <div className={`relative rounded-2xl border p-5 ${
      highlight ? "border-flare-400/40 bg-flare-500/10 shadow-glow" : "border-white/10 bg-white/3"
    }`}>
      {active && <Badge tone="accent" className="absolute -top-2 right-4">Aktiv</Badge>}
      <div className="text-sm font-semibold text-ink-50">{title}</div>
      <div className="text-2xl font-semibold mt-1 mb-3 grad-text">{price}</div>
      <ul className="space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2 text-xs text-ink-50/75">
            <Check className="w-3.5 h-3.5 text-flare-300 flex-shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
