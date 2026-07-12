/**
 * Take a list of generated scene videos and merge them via the server's FFmpeg endpoint.
 * Shows queued URLs, a progress hint, and a download link for the merged result.
 */
import { useState } from "react";
import { Film, Download, Loader2, AlertTriangle, GripVertical } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { mergeVideos } from "@/lib/serverAI";
import { toast } from "sonner";

interface Clip {
  id: string;
  url: string;
  label?: string;
}

interface Props {
  clips: Clip[];
  defaultFilename?: string;
  onClipsChange?: (clips: Clip[]) => void;
  /** Target output ratio (e.g. "9:16"). Keeps the merged video in the chosen
   *  format instead of the server's 16:9 default. */
  aspectRatio?: string;
  /** When the clips were generated with continuity (each clip's first frame ==
   *  the previous clip's last frame), tells the server to drop that duplicated
   *  boundary frame so the joins are seamless instead of a 1-frame freeze. */
  seamless?: boolean;
}

export function VideoMerger({ clips, defaultFilename = "story.mp4", onClipsChange, aspectRatio, seamless }: Props) {
  const [loading, setLoading] = useState(false);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reorder = (from: number, to: number) => {
    if (!onClipsChange) return;
    const next = [...clips];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onClipsChange(next);
  };

  const onDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData("text/plain", String(idx));
  };
  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (Number.isFinite(from)) reorder(from, idx);
  };

  const merge = async () => {
    if (clips.length < 2) {
      toast.info("Mindestens zwei Clips erforderlich.");
      return;
    }
    setLoading(true); setError(null); setMergedUrl(null);
    try {
      const res = await mergeVideos({ sources: clips.map((c) => c.url), aspectRatio, seamless });
      setMergedUrl(res.dataUrl);
      toast.success("Video erfolgreich zusammengefügt.");
    } catch (e: any) {
      setError(e.message || "Merge fehlgeschlagen.");
      toast.error(e.message || "Merge fehlgeschlagen.", { description: e.hint });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Clips zusammenfügen"
        subtitle={`${clips.length} Clip${clips.length === 1 ? "" : "s"} bereit${onClipsChange ? " · Reihenfolge per Drag" : ""}`}
        icon={<Film className="w-4 h-4" />}
        action={
          <Button onClick={merge} loading={loading} size="sm" disabled={clips.length < 2}>
            {loading ? "Rendere…" : "Mergen"}
          </Button>
        }
      />

      {clips.length === 0 ? (
        <div className="text-center py-6 text-sm text-ink-50/55">
          Generiere zuerst einzelne Szenen-Videos.
        </div>
      ) : (
        <div className="space-y-2">
          {clips.map((c, i) => (
            <div
              key={c.id}
              draggable={!!onClipsChange}
              onDragStart={(e) => onDragStart(e, i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, i)}
              className="flex items-center gap-2 p-2 rounded-xl bg-ink-950/40 border border-white/8 group hover:border-white/15 cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="w-3.5 h-3.5 text-ink-50/35 group-hover:text-ink-50/65 flex-shrink-0" />
              <video src={c.url} className="w-16 h-10 object-cover rounded-lg bg-ink-900 flex-shrink-0" muted />
              <div className="flex-1 min-w-0 text-xs">
                <div className="text-ink-50/85 truncate">{c.label || `Clip ${i + 1}`}</div>
                <div className="text-ink-50/40 truncate font-mono text-[10px]">{c.url}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-danger/10 border border-danger/30 flex items-start gap-2 text-xs text-danger">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {mergedUrl && (
        <div className="mt-4 p-4 rounded-2xl bg-flare-500/8 border border-flare-400/30">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-medium text-ink-50">Fertig</div>
              <div className="text-xs text-ink-50/55 mt-0.5">Dein Reel ist bereit.</div>
            </div>
            <a
              href={mergedUrl}
              download={defaultFilename}
              className="inline-flex items-center gap-1.5 px-3 h-8 text-xs rounded-xl bg-flare-grad text-white shadow-glow hover:brightness-110"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          </div>
          <video src={mergedUrl} controls className="w-full max-h-72 rounded-xl bg-ink-900" />
        </div>
      )}

      {loading && (
        <div className="mt-3 text-xs text-ink-50/55 inline-flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Server kombiniert Clips via FFmpeg…
        </div>
      )}
    </Card>
  );
}
