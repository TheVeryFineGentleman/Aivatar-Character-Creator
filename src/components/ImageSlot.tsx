/**
 * Single image card — used by ImageGallery and as a standalone slot in StudioPage etc.
 * Layout ported from Projekt: top-left #index badge, centered hover overlay with prominent
 * circular action buttons (Maximize / Regenerate / Download / Delete), progress bar during
 * loading, structured error state with retry+delete row.
 */
import { useState } from "react";
import {
  Download, Maximize2, RefreshCw, AlertCircle, Trash2,
  Image as ImageIcon, Loader2, Ban,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { ResolutionDownloadMenu } from "@/components/ResolutionDownloadMenu";
import { SlotProgress } from "@/components/ui/SlotProgress";

export interface ImageSlotData {
  id: string;
  status: "pending" | "loading" | "done" | "error";
  dataUrl?: string;
  progress?: number;       // 0..100
  error?: string;
  errorHint?: string;
  prompt?: string;
  filename?: string;
}

interface Props {
  slot: ImageSlotData;
  aspectClass?: string;
  index?: number;
  onRetry?: (id: string) => void;
  onZoom?: (slot: ImageSlotData) => void;
  onDelete?: (id: string) => void;
  onCancel?: (id: string) => void;
  filenamePrefix?: string;
}

export function ImageSlotCard({
  slot, aspectClass = "aspect-square", index, onRetry, onZoom, onDelete, onCancel,
  filenamePrefix = "aivatar",
}: Props) {
  const fname = slot.filename || `${filenamePrefix}-${index ?? "x"}.png`;

  // Keep the hover overlay open while the download resolution menu is open.
  const [dlOpen, setDlOpen] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/8 bg-ink-900/70 backdrop-blur-sm shadow-soft",
        aspectClass,
      )}
    >
      {/* ── Pending ── */}
      {slot.status === "pending" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/[0.02]">
          <ImageIcon className="w-12 h-12 text-ink-50/25" />
        </div>
      )}

      {/* ── Loading ── */}
      {slot.status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 animate-fade-in">
          {/* Subtle shimmer behind the spinner so the slot reads as "active". */}
          <div className="absolute inset-0 skeleton" />
          <Loader2 className="relative z-10 w-8 h-8 text-flare-300 animate-spin" />
          <p className="relative z-10 text-xs text-ink-50/55">Generiere…</p>
          {onCancel && (
            <button
              onClick={(e) => { e.stopPropagation(); onCancel(slot.id); }}
              className="relative z-10 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md text-ink-50/55 hover:text-danger hover:bg-danger/10 transition-colors"
            >
              <Ban className="w-3 h-3" /> Abbrechen
            </button>
          )}
        </div>
      )}

      {/* ── Done ── */}
      {slot.status === "done" && slot.dataUrl && (
        <div className="group relative w-full h-full cursor-pointer" onClick={() => onZoom?.(slot)}>
          <img
            src={slot.dataUrl}
            alt={`Bild ${index ?? ""}`}
            // animate-image-reveal fades the image in gently — synced with
            // the SlotProgress centre flash that pops up on done.
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 animate-image-reveal"
            loading="lazy"
            decoding="async"
          />

          {/* Centered hover overlay — Projekt-style */}
          <div className={cn(
            "absolute inset-0 bg-ink-950/60 transition-opacity flex items-center justify-center gap-2 z-10",
            dlOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}>
            {onZoom && (
              <RoundActionBtn title="Vergrößern" onClick={(e) => { e.stopPropagation(); onZoom(slot); }}>
                <Maximize2 className="w-5 h-5" />
              </RoundActionBtn>
            )}
            <ResolutionDownloadMenu
              dataUrl={slot.dataUrl}
              filename={fname}
              triggerTitle="Herunterladen"
              onOpenChange={setDlOpen}
              triggerClassName={ROUND_BTN_CLASS}
            >
              <Download className="w-5 h-5" />
            </ResolutionDownloadMenu>
            {onRetry && (
              <RoundActionBtn title="Neu generieren" onClick={(e) => { e.stopPropagation(); onRetry(slot.id); }}>
                <RefreshCw className="w-5 h-5" />
              </RoundActionBtn>
            )}
            {onDelete && (
              <RoundActionBtn
                title="Entfernen"
                onClick={(e) => { e.stopPropagation(); onDelete(slot.id); }}
                tone="danger"
              >
                <Trash2 className="w-5 h-5" />
              </RoundActionBtn>
            )}
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {slot.status === "error" && (
        <div
          className="absolute inset-0 flex flex-col bg-danger/8"
          // In einer kleinen Kachel (25er-Raster: ~140 px) passt eine lange
          // Fehlerbeschreibung nicht — der Tooltip zeigt sie ganz, ohne dass
          // man im Briefmarkenformat scrollen muss.
          title={[slot.error || "Generierung fehlgeschlagen", slot.errorHint].filter(Boolean).join("\n\n")}
        >
          {/* ZENTRIEREN DARF DEN TEXT NICHT AUS DER KACHEL SCHIEBEN.
              Vorher stand `justify-center` direkt auf dem Scrollbereich: sobald
              die Beschreibung höher wurde als die Kachel, verteilte sich der
              Überschuss nach OBEN UND UNTEN — der Anfang lag über dem
              Scrollbereich, war abgeschnitten und per Scrollen nicht mehr
              erreichbar. Jetzt zentriert eine innere Fläche mit `min-h-full`:
              passt der Text, sieht es aus wie vorher; passt er nicht, wächst
              sie nach unten und der Text beginnt sichtbar oben.
              `p-3` sitzt bewusst INNEN — bei border-box bleibt `min-h-full`
              damit exakt die Kachelhöhe, sonst gäbe es allein durch das
              Padding immer eine Scrollleiste. */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="min-h-full p-3 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full bg-danger/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-danger" />
              </div>
              <p
                className="text-danger text-center w-full leading-snug font-medium text-xs"
                style={{ whiteSpace: "normal", overflowWrap: "break-word", wordBreak: "break-word" }}
              >
                {slot.error || "Generierung fehlgeschlagen"}
              </p>
              {slot.errorHint && (
                <p
                  className="text-[10.5px] text-ink-50/55 leading-snug text-center w-full"
                  style={{ overflowWrap: "break-word", wordBreak: "break-word" }}
                >
                  {slot.errorHint}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 p-2 shrink-0">
            {onRetry && (
              <button
                onClick={(e) => { e.stopPropagation(); onRetry(slot.id); }}
                className="inline-flex items-center gap-1 text-[10px] h-6 px-2 rounded-md bg-white/5 border border-white/10 text-ink-50 hover:bg-white/10 active:scale-[0.97] transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(slot.id); }}
                className="inline-flex items-center gap-1 text-[10px] h-6 px-2 rounded-md bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25 active:scale-[0.97] transition-all"
              >
                <Trash2 className="w-3 h-3" /> Löschen
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Shared progress bar + done-flash (loading / done states) ── */}
      {(slot.status === "loading" || slot.status === "done") && (
        <SlotProgress status={slot.status} expectedMs={20000} />
      )}

      {/* ── #Index badge (top-left) ── */}
      {index !== undefined && (
        <div className="absolute top-2 left-2 z-10 bg-ink-950/80 backdrop-blur-sm px-2 py-0.5 rounded text-[11px] font-semibold text-ink-50/85 pointer-events-none">
          #{index}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROUND_BTN_CLASS =
  "w-10 h-10 rounded-full flex items-center justify-center transition-all border backdrop-blur active:scale-95 bg-white/12 border-white/15 text-ink-50 hover:bg-white/20 hover:shadow-lg";

function RoundActionBtn({
  onClick, title, children, tone,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center transition-all border backdrop-blur",
        "active:scale-95",
        tone === "danger"
          ? "bg-danger/85 border-danger/40 text-pure hover:bg-danger hover:shadow-lg hover:shadow-danger/30"
          : "bg-white/12 border-white/15 text-ink-50 hover:bg-white/20 hover:shadow-lg",
      )}
    >
      {children}
    </button>
  );
}
