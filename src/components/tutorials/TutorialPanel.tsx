/**
 * Video-Tutorial-Panel — Drawer oben links.
 *
 * - Zeigt nur Tutorials, deren Tool im aktuellen Plan freigeschaltet ist
 *   (Setup-Videos wie API-Keys sind immer sichtbar).
 * - Oben der Player des aktiven Videos + "Zum Tool"-Button.
 * - Darunter die gruppierte Liste; Klick spielt das jeweilige Video ab.
 * - Öffnen mit vorgewähltem Video via useTutorials().openPanel(id).
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { GraduationCap, X, ArrowRight, Play, Loader2 } from "lucide-react";
import { useTutorials } from "@/hooks/useTutorials";
import { useAuth } from "@/hooks/useAuth";
import {
  TUTORIALS, CATEGORY_LABELS, isUnlocked, getTutorial, tutorialVideo, tutorialEmbedSrc, tint, tutorialActionLabel,
  type Tutorial, type TutorialCategory,
} from "@/lib/tutorials";
import { cn } from "@/lib/cn";

const CATEGORY_ORDER: TutorialCategory[] = ["setup", "character", "studio", "story"];

export function TutorialPanel({ onOpenSettings }: { onOpenSettings: () => void }) {
  const { open, activeId, autoplay, close, setActive } = useTutorials();
  const { plan } = useAuth();
  const navigate = useNavigate();

  // Mount-/Exit-Transition (rendert nur solange sichtbar oder ausblendend)
  const [render, setRender] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setRender(true);
      const r = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(r);
    }
    setVisible(false);
    const t = setTimeout(() => setRender(false), 260);
    return () => clearTimeout(t);
  }, [open]);

  // Escape schließt
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const unlocked = useMemo(() => TUTORIALS.filter((t) => isUnlocked(t, plan)), [plan]);

  const active: Tutorial | null = useMemo(() => {
    const byId = activeId ? getTutorial(activeId) : undefined;
    if (byId && isUnlocked(byId, plan)) return byId;
    return unlocked[0] ?? null;
  }, [activeId, plan, unlocked]);

  if (!render) return null;

  const grouped = CATEGORY_ORDER
    .map((cat) => ({ cat, items: unlocked.filter((t) => t.category === cat) }))
    .filter((g) => g.items.length > 0);

  const goToTool = (t: Tutorial) => {
    close();
    if (t.nav.kind === "settings") { onOpenSettings(); return; }
    if (t.nav.kind === "character") { navigate(`/character?mode=${t.nav.mode}`); return; }
    navigate(t.nav.to);
  };

  const iframeSrc = active ? tutorialEmbedSrc(active.id, autoplay) : null;

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 260ms ease" }}
        onClick={close}
      />

      {/* Zentriertes Modal — Video-Preview in der Bildschirmmitte */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
      <aside
        className={cn(
          "pointer-events-auto flex flex-col w-[min(960px,94vw)] max-h-[92vh]",
          "bg-ink-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden",
        )}
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? "scale(1)" : "scale(0.96)",
          transition: "opacity 200ms ease, transform 260ms cubic-bezier(.16,1,.3,1)",
        }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-flare-grad flex items-center justify-center shadow-glow">
                <GraduationCap className="w-4 h-4 text-pure" />
              </div>
              <h2 className="text-[15px] font-semibold">Video-Tutorials</h2>
            </div>
            <p className="text-xs text-ink-50/55 mt-1.5">
              {unlocked.length} {unlocked.length === 1 ? "Tutorial" : "Tutorials"} für deinen {plan.label}-Plan
            </p>
          </div>
          <button
            onClick={close}
            className="flex-none w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-ink-50/60 hover:text-ink-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* EIN Scrollbereich für Player UND Liste.
            Vorher war nur die Liste scrollbar (`flex-1 overflow-y-auto`), der
            Player darüber fest (`flex-none`). Auf niedrigen Fenstern hiess das:
            das Video frisst die Höhe, und im verbleibenden Rest scrollt eine
            Liste in Briefschlitzgrösse — man scrollte „unten am Ding" statt am
            Dialog. Jetzt läuft der ganze Inhalt durch; nur die Kopfzeile mit dem
            Schliessen-Knopf bleibt stehen, damit sie nie ausser Reichweite ist. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Player des aktiven Videos — zentriert in der Mitte, Titel oben, Aktion darunter */}
        {active && (
          <div className="px-5 pt-4 pb-4 border-b border-white/5">
            <div className="mx-auto flex flex-col" style={{ width: "min(100%, calc(52vh * 16 / 9))" }}>
              <div className="mb-2.5 flex items-center gap-2 min-w-0">
                <Play className="w-4 h-4 flex-none fill-current" style={{ color: active.color }} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: active.color }}>{active.title}</div>
                  <div className="text-[11px] text-ink-50/50 truncate">{active.subtitle}</div>
                </div>
              </div>

              <div
                className="relative w-full rounded-2xl overflow-hidden bg-ink-950 border border-white/8"
                style={{ aspectRatio: "16 / 9" }}
              >
                {iframeSrc ? (
                  <iframe
                    key={`${active.id}:${autoplay}`}
                    src={iframeSrc}
                    title={active.title}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-2">
                    <Loader2 className="w-6 h-6 text-flare-300 animate-spin" />
                    <div className="text-sm text-ink-50/70">Video wird verarbeitet …</div>
                    <div className="text-xs text-ink-50/45">Dieses Tutorial ist in Kürze verfügbar.</div>
                  </div>
                )}
              </div>

              {/* Aktion unter dem Video — dynamisch passend zum Video (Tool bzw. Einstellungen) */}
              <button
                onClick={() => goToTool(active)}
                className="mt-3 self-start inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium border transition-colors hover:brightness-110"
                style={{ color: active.color, borderColor: tint(active.color, 0.27), background: tint(active.color, 0.1) }}
              >
                {tutorialActionLabel(active)} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Liste */}
        <div className="px-3 py-3 space-y-4">
          {grouped.map(({ cat, items }) => (
            <div key={cat}>
              <div className="px-2 mb-1.5 text-[10px] uppercase tracking-widest text-ink-50/40 font-medium">
                {CATEGORY_LABELS[cat]}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {items.map((t) => {
                  const selected = active?.id === t.id;
                  const hasVideo = !!tutorialVideo(t.id);
                  const Icon = t.Icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActive(t.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-2.5 py-2 rounded-xl border text-left transition-colors",
                        selected ? "bg-white/8 border-white/12" : "border-transparent hover:bg-white/5",
                      )}
                    >
                      <div
                        className="flex-none w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: tint(t.color, 0.12), color: t.color }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium truncate">{t.title}</div>
                        <div className="text-[11px] text-ink-50/50 truncate">{t.subtitle}</div>
                      </div>
                      {selected ? (
                        <Play className="w-3.5 h-3.5 flex-none" style={{ color: t.color }} />
                      ) : !hasVideo ? (
                        <span className="text-[9px] uppercase tracking-wide text-ink-50/40 flex-none">bald</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        </div>
      </aside>
      </div>
    </div>,
    document.body,
  );
}
