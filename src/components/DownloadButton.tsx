/**
 * Download button with format options (PNG, JPEG, ZIP).
 * Single button → opens a menu when multiple formats apply.
 */
import { useState } from "react";
import { Download, FileImage, FileArchive, Loader2 } from "lucide-react";
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

/** Multi-file download — ZIP per resolution preset. */
export function MultiDownloadButton({ images, zipName = "aivatar-collection.zip", label = "Alle herunterladen" }: MultiProps) {
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
    <Menu
      align="right"
      triggerClassName="inline-flex items-center gap-2 px-3 h-8 text-xs rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
      trigger={
        <>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {label}
        </>
      }
    >
      <MenuSection label="Alle als ZIP — Auflösung wählen">
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
      {images.length <= 6 && (
        <MenuSection label="Einzeln (Original)">
          {images.map((img, i) => (
            <MenuItem
              key={img.filename + i}
              icon={<FileImage className="w-4 h-4" />}
              onClick={() => downloadDataUrl(img.dataUrl, img.filename)}
            >
              <span className="truncate">{img.filename}</span>
            </MenuItem>
          ))}
        </MenuSection>
      )}
    </Menu>
  );
}
