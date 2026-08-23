/**
 * Video-Tutorial-CTA als Mini-Player-Card: echtes Vimeo-Thumbnail, Play-Overlay
 * und Dauer-Badge (via Vimeo-oEmbed). Klick öffnet wie bisher das Tutorial-Panel
 * mit dem großen Player. Bewusst auffällig, damit niemand das Erklärvideo übersieht.
 *
 * Rendert nichts, wenn das zugehörige Tool im aktuellen Plan gesperrt ist.
 */
import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { useTutorials } from "@/hooks/useTutorials";
import { useAuth } from "@/hooks/useAuth";
import { getTutorial, isUnlocked, tint, tutorialVideo } from "@/lib/tutorials";
import { cn } from "@/lib/cn";

interface OEmbedMeta { thumb?: string; duration?: string }
// Modul-Cache: pro Video-ID nur einmal von Vimeo laden.
const oembedCache = new Map<string, OEmbedMeta>();

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TutorialCTA({ tutorialId, className }: { tutorialId: string; className?: string }) {
  const { openPanel } = useTutorials();
  const { plan } = useAuth();
  const t = getTutorial(tutorialId);
  const v = t ? tutorialVideo(t.id) : null;
  const [meta, setMeta] = useState<OEmbedMeta | null>(v ? oembedCache.get(v.id) ?? null : null);

  useEffect(() => {
    if (!v || oembedCache.has(v.id)) return;
    let cancelled = false;
    const page = `https://vimeo.com/${v.id}${v.hash ? `/${v.hash}` : ""}`;
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(page)}&width=480`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const result: OEmbedMeta = {
          thumb: typeof d.thumbnail_url === "string" ? d.thumbnail_url : undefined,
          duration: typeof d.duration === "number" ? fmtDuration(d.duration) : undefined,
        };
        oembedCache.set(v.id, result);
        if (!cancelled) setMeta(result);
      })
      .catch(() => { /* Platzhalter-Thumbnail bleibt */ });
    return () => { cancelled = true; };
  }, [v?.id]);

  if (!t || !isUnlocked(t, plan)) return null;

  return (
    <button
      type="button"
      onClick={() => openPanel(t.id)}
      title="Video-Tutorial ansehen"
      className={cn(
        "group flex items-center gap-3.5 p-2.5 rounded-2xl text-left transition-all",
        "hover:brightness-[1.08] active:scale-[0.99]",
        className,
      )}
      style={{
        background: tint(t.color, 0.1),
        border: `1px solid ${tint(t.color, 0.3)}`,
        boxShadow: `0 6px 22px ${tint(t.color, 0.18)}`,
      }}
    >
      {/* Mini-Player-Thumbnail (16:9) */}
      <span
        className="relative flex-none w-[128px] aspect-video rounded-xl overflow-hidden shadow-lg"
        style={{
          background: meta?.thumb
            ? `center/cover no-repeat url("${meta.thumb}")`
            : `linear-gradient(135deg, ${tint(t.color, 0.55)}, ${tint(t.color, 0.18)})`,
        }}
      >
        <span className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/5" />
        {/* Play-Button — klassisches Video-Overlay */}
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex items-center justify-center w-11 h-11 rounded-full bg-black/45 ring-2 ring-white/80 backdrop-blur-sm transition-transform group-hover:scale-110">
            <Play className="w-5 h-5 translate-x-[1px] text-pure fill-pure" />
          </span>
        </span>
        {/* Dauer-Badge unten rechts */}
        {meta?.duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-pure">
            {meta.duration}
          </span>
        )}
      </span>

      {/* Text */}
      <span className="flex min-w-0 flex-col gap-1 pr-1">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: t.color }}>
          ▶ Video-Tutorial
        </span>
        <span className="text-sm font-bold leading-snug" style={{ color: t.color }}>
          {t.title}
        </span>
        <span className="text-xs text-ink-50/60">
          Video abspielen{meta?.duration ? ` · ${meta.duration} Min` : ""}
        </span>
      </span>
    </button>
  );
}
