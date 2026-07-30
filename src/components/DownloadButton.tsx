/**
 * Download button with format options (PNG, JPEG, ZIP).
 * Single button → opens a menu when multiple formats apply.
 */
import { useState } from "react";
import { Download, FileArchive, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Menu, MenuItem, MenuSection } from "@/components/ui/Menu";
import { downloadDataUrl, downloadAllAsZip, DOWNLOAD_RESOLUTIONS } from "@/lib/image";
import { toast } from "sonner";

interface SimpleProps {
  dataUrl: string;
  filename: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost" | "outline";
}

/** Single-file download. */
export function DownloadButton({ dataUrl, filename, label = "Herunterladen", size = "sm", variant = "secondary" }: SimpleProps) {
  return (
    <Button
      size={size}
      variant={variant}
      iconLeft={<Download className="w-3.5 h-3.5" />}
      onClick={() => {
        try {
          downloadDataUrl(dataUrl, filename);
        } catch (e: any) {
          toast.error("Download fehlgeschlagen.", { description: e?.message });
        }
      }}
    >
      {label}
    </Button>
  );
}

interface MultiProps {
  images: { dataUrl: string; filename: string }[];
  zipName?: string;
  label?: string;
}

/**
 * Multi-Download — IMMER als ZIP. Haupt-Klick lädt sofort ein ZIP mit allen
 * Bildern (Originalauflösung); der Caret öffnet nur die Auflösungswahl (ebenfalls
 * ZIP). Es gibt bewusst keinen Einzeldownload-Pfad mehr hier — „Alle" heißt ZIP.
 */
export function MultiDownloadButton({ images, zipName = "aivatar-collection.zip", label = "Alle als ZIP" }: MultiProps) {
  const [busy, setBusy] = useState(false);

  const downloadAll = async (maxWidth: number) => {
    setBusy(true);
    try {
      await downloadAllAsZip(images, zipName, maxWidth);
      const preset = DOWNLOAD_RESOLUTIONS.find((r) => r.maxWidth === maxWidth);
      toast.success(`ZIP (${preset?.label ?? "Original"}) mit ${images.length} Bildern heruntergeladen.`);
    } catch (e: any) {
      toast.error("Download fehlgeschlagen.", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  if (!images.length) return null;

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-white/10 bg-white/5">
      {/* Haupt-Aktion: EIN Klick → ZIP mit allen Bildern (Originalauflösung). */}
      <button
        type="button"
        onClick={() => downloadAll(0)}
        disabled={busy}
        title={`Alle ${images.length} Bilder als ZIP herunterladen`}
        className="inline-flex items-center gap-2 px-3 h-8 text-xs transition-colors hover:bg-white/10 disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileArchive className="w-3.5 h-3.5" />}
        {label}
      </button>
      {/* Sekundär: Auflösung wählen (weiterhin ZIP). */}
      <Menu
        align="right"
        triggerClassName="flex items-center justify-center px-1.5 h-8 border-l border-white/10 transition-colors hover:bg-white/10"
        trigger={<ChevronDown className="w-3.5 h-3.5" />}
      >
        <MenuSection label="Als ZIP — Auflösung wählen">
          {DOWNLOAD_RESOLUTIONS.map((opt) => (
            <MenuItem
              key={opt.label}
              icon={<FileArchive className="w-4 h-4" />}
              onClick={() => downloadAll(opt.maxWidth)}
              disabled={busy}
            >
              {opt.label}
            </MenuItem>
          ))}
        </MenuSection>
      </Menu>
    </div>
  );
}
