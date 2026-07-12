/**
 * A download control for a single asset.
 *
 * Image only (default): opens straight to a resolution picker
 * (512 px / 1K / 2K / 4K-Original).
 *
 * Image + video (when `videoUrl` is passed): becomes a two-step menu — first
 * pick "Bild" or "Video", then pick the resolution (image) or download the
 * original (video). All existing image-only call sites keep working unchanged.
 *
 * The dropdown panel is rendered through a portal with fixed positioning so it
 * never gets clipped by the `overflow-hidden` image cards it usually lives in.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, ChevronLeft, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { DOWNLOAD_RESOLUTIONS, downloadAtResolution, downloadDataUrl } from "@/lib/image";
import { toast } from "sonner";

interface Props {
  dataUrl: string;
  filename: string;
  /** When set, the menu offers a Bild/Video choice. Video downloads as-is. */
  videoUrl?: string;
  videoFilename?: string;
  /** Trigger content (icon / label). */
  children: ReactNode;
  triggerClassName?: string;
  triggerTitle?: string;
  align?: "left" | "right" | "center";
  preferSide?: "top" | "bottom";
  /** Notified when the menu opens/closes — lets parents keep hover overlays visible. */
  onOpenChange?: (open: boolean) => void;
}

const PANEL_W = 184;
const PANEL_H = 236;

type View = "type" | "image" | "video";

export function ResolutionDownloadMenu({
  dataUrl, filename, videoUrl, videoFilename, children, triggerClassName, triggerTitle = "Herunterladen",
  align = "center", preferSide = "bottom", onOpenChange,
}: Props) {
  const hasVideo = !!videoUrl;
  const [open, setOpen] = useState(false);
  // "type" = pick Bild/Video (only when a video exists), else straight to images.
  const [view, setView] = useState<View>(hasVideo ? "type" : "image");
  const [busy, setBusy] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const setOpenState = (v: boolean) => {
    setOpen(v);
    if (v) setView(hasVideo ? "type" : "image"); // always reopen at the start
    onOpenChange?.(v);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    let top = preferSide === "top" ? r.top - PANEL_H - 8 : r.bottom + 8;
    if (preferSide === "bottom" && top + PANEL_H > window.innerHeight - 8) top = r.top - PANEL_H - 8;
    if (preferSide === "top" && top < 8) top = r.bottom + 8;
    top = Math.max(8, Math.min(top, window.innerHeight - PANEL_H - 8));
    let left =
      align === "right" ? r.right - PANEL_W :
      align === "left"  ? r.left :
      r.left + r.width / 2 - PANEL_W / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - PANEL_W - 8));
    setPos({ top, left });
  }, [open, align, preferSide]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpenState(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenState(false); };
    const close = () => setOpenState(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImage = async (maxWidth: number) => {
    setBusy(`img:${maxWidth}`);
    try {
      await downloadAtResolution(dataUrl, filename, maxWidth);
    } catch (e: any) {
      toast.error("Download fehlgeschlagen.", { description: e?.message });
    } finally {
      setBusy(null);
      setOpenState(false);
    }
  };

  const handleVideo = async () => {
    if (!videoUrl) return;
    setBusy("video");
    try {
      await downloadDataUrl(videoUrl, videoFilename || "video.mp4");
    } catch (e: any) {
      toast.error("Video-Download fehlgeschlagen.", { description: e?.message });
    } finally {
      setBusy(null);
      setOpenState(false);
    }
  };

  const rowCls =
    "w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-left text-ink-50/85 hover:bg-white/5 hover:text-ink-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
  const headCls = "px-3.5 pb-1 pt-1 text-[10px] uppercase tracking-widest text-ink-50/40 font-medium";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={triggerTitle}
        className={triggerClassName}
        onClick={(e) => { e.stopPropagation(); setOpenState(!open); }}
      >
        {children}
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[60] bg-ink-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slide-down origin-top py-1.5"
          style={{ top: pos.top, left: pos.left, width: PANEL_W }}
        >
          {/* key={view} → each step fades in for a smooth transition */}
          <div key={view} className="animate-fade-in">
            {/* Step 1 — pick what to download (only when a video exists) */}
            {view === "type" && (
              <>
                <div className={headCls}>Was herunterladen?</div>
                <button type="button" className={rowCls} onClick={(e) => { e.stopPropagation(); setView("image"); }}>
                  <ImageIcon className="w-4 h-4 flex-shrink-0 text-flare-300" />
                  <span className="flex-1">Bild</span>
                  <ChevronLeft className="w-3.5 h-3.5 rotate-180 text-ink-50/40" />
                </button>
                <button type="button" className={rowCls} onClick={(e) => { e.stopPropagation(); setView("video"); }}>
                  <VideoIcon className="w-4 h-4 flex-shrink-0 text-flare-300" />
                  <span className="flex-1">Video</span>
                  <ChevronLeft className="w-3.5 h-3.5 rotate-180 text-ink-50/40" />
                </button>
              </>
            )}

            {/* Step 2a — image resolution */}
            {view === "image" && (
              <>
                <div className="flex items-center gap-1.5 pr-2">
                  {hasVideo && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setView("type"); }}
                      className="ml-1 p-1 rounded-md text-ink-50/55 hover:text-ink-50 hover:bg-white/5 transition-colors"
                      title="Zurück"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div className={headCls}>Auflösung wählen</div>
                </div>
                {DOWNLOAD_RESOLUTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    disabled={busy !== null}
                    onClick={(e) => { e.stopPropagation(); handleImage(opt.maxWidth); }}
                    className={rowCls}
                  >
                    {busy === `img:${opt.maxWidth}`
                      ? <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin text-flare-300" />
                      : <Download className="w-4 h-4 flex-shrink-0" />}
                    <span className="flex-1">{opt.label}</span>
                  </button>
                ))}
              </>
            )}

            {/* Step 2b — video (original only) */}
            {view === "video" && (
              <>
                <div className="flex items-center gap-1.5 pr-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setView("type"); }}
                    className="ml-1 p-1 rounded-md text-ink-50/55 hover:text-ink-50 hover:bg-white/5 transition-colors"
                    title="Zurück"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className={headCls}>Video</div>
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={(e) => { e.stopPropagation(); handleVideo(); }}
                  className={rowCls}
                >
                  {busy === "video"
                    ? <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin text-flare-300" />
                    : <Download className="w-4 h-4 flex-shrink-0" />}
                  <span className="flex-1">Original (MP4)</span>
                </button>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
