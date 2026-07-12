import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Sparkles, Users, LayoutGrid, Wand2, Lock, type LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/cn";
import QuickPage from "@/pages/QuickPage";
import ChatPage from "@/pages/ChatPage";
import ViewsPage from "@/pages/ViewsPage";
import PosesPage from "@/pages/PosesPage";
import RemixPage from "@/pages/RemixPage";

// ─── Sub-mode config ─────────────────────────────────────────────────────────

type SubMode = "quick" | "chat" | "views" | "poses" | "remix";

type ModeSpec = {
  id: SubMode;
  label: string;
  Icon: LucideIcon;
  color: string;
  planKey?: "chatCreator" | "characterViews" | "poseGrid" | "smartRemix";
  tierLabel?: "Pro" | "Premium";
};

const MODES: ModeSpec[] = [
  { id: "quick", label: "Quick Creator",   Icon: Sparkles,   color: "hsl(263 70% 70%)" },
  { id: "chat",  label: "Chat Creator",    Icon: Users,      color: "hsl(270 60% 72%)", planKey: "chatCreator",    tierLabel: "Pro" },
  { id: "views", label: "Character Views", Icon: LayoutGrid, color: "hsl(188 94% 60%)", planKey: "characterViews", tierLabel: "Pro" },
  { id: "poses", label: "Pose Grid",       Icon: LayoutGrid, color: "hsl(160 70% 55%)", planKey: "poseGrid",       tierLabel: "Pro" },
  { id: "remix", label: "Smart Remix",     Icon: Wand2,      color: "hsl(330 82% 64%)", planKey: "smartRemix",     tierLabel: "Pro" },
];

// ─── CharacterPage ───────────────────────────────────────────────────────────

export default function CharacterPage() {
  const { plan } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Mode from ?mode=… query param, default = quick
  const initialMode = (searchParams.get("mode") as SubMode | null) ?? "quick";
  const [mode, setMode] = useState<SubMode>(MODES.some((m) => m.id === initialMode) ? initialMode : "quick");

  // Keep URL in sync when mode changes
  useEffect(() => {
    if (searchParams.get("mode") !== mode) {
      const next = new URLSearchParams(searchParams);
      next.set("mode", mode);
      setSearchParams(next, { replace: true });
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep mode in sync when the URL changes von außen — z. B. wenn man über das
  // Tutorial-Panel („Zum Tool") einen Sub-Modus wählt, während man schon auf
  // /character ist (gleiche Route → kein Remount, Initializer läuft nicht neu).
  useEffect(() => {
    const urlMode = searchParams.get("mode") as SubMode | null;
    if (urlMode && urlMode !== mode && MODES.some((m) => m.id === urlMode)) {
      setMode(urlMode);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sliding indicator
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabsWrapRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number; color: string } | null>(null);

  useEffect(() => {
    const tick = () => {
      const el = tabRefs.current[mode];
      const wrap = tabsWrapRef.current;
      if (!el || !wrap) return;
      const wRect = wrap.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const m = MODES.find((m) => m.id === mode);
      setIndicator({
        left: eRect.left - wRect.left,
        width: eRect.width,
        color: m?.color ?? "hsl(263 70% 70%)",
      });
    };
    const r = requestAnimationFrame(tick);
    window.addEventListener("resize", tick);
    return () => {
      cancelAnimationFrame(r);
      window.removeEventListener("resize", tick);
    };
  }, [mode, location.pathname]);

  const renderBody = () => {
    switch (mode) {
      case "quick": return <QuickPage />;
      case "chat":  return <ChatPage />;
      case "views": return <ViewsPage />;
      case "poses": return <PosesPage />;
      case "remix": return <RemixPage />;
    }
  };

  return (
    <div className="flex flex-col">
      {/* ── Sub-tab strip — centered, sliding underline (Projekt style) ── */}
      <div className="mb-8">
        <div
          ref={tabsWrapRef}
          className={cn(
            "relative flex items-center justify-center gap-1 px-2 py-2 rounded-2xl",
            "bg-ink-900/60 border border-white/5 backdrop-blur-md w-fit mx-auto",
            "overflow-x-auto max-w-full",
          )}
        >
          {MODES.map((m) => {
            const locked = m.planKey ? !plan[m.planKey] : false;
            const active = mode === m.id;
            const Icon = m.Icon;

            return (
              <button
                key={m.id}
                ref={(el) => { tabRefs.current[m.id] = el; }}
                onClick={() => {
                  if (locked) { navigate("/pricing"); return; }
                  setMode(m.id);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-[13px] font-medium",
                  "transition-all duration-150 whitespace-nowrap",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flare-400/40",
                  locked && "opacity-70",
                  active
                    ? "border-transparent"
                    : "border-transparent text-ink-50/60 hover:text-ink-50 hover:bg-white/5",
                )}
                style={active ? {
                  background: `${m.color}1e`,
                  color: m.color,
                  outline: `1px solid ${m.color}44`,
                } : undefined}
              >
                <Icon size={14} />
                <span>{m.label}</span>
                {locked && (
                  <span
                    className="flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      // Pro = amber, Premium = lila (Projekt-Farbschema)
                      background: m.tierLabel === "Premium" ? "hsl(263 70% 55% / 0.18)" : "hsl(38 92% 55% / 0.18)",
                      color:      m.tierLabel === "Premium" ? "hsl(263 70% 78%)"        : "hsl(38 92% 65%)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <Lock size={8} />
                    {m.tierLabel ?? "Pro"}
                  </span>
                )}
              </button>
            );
          })}

          {indicator && (
            <div
              className="absolute bottom-0 h-[2px] rounded-t-sm pointer-events-none"
              style={{
                left: indicator.left,
                width: indicator.width,
                background: `linear-gradient(90deg, transparent, ${indicator.color}, transparent)`,
                transition: "left 0.28s cubic-bezier(.16,1,.3,1), width 0.28s cubic-bezier(.16,1,.3,1), background 0.28s ease",
              }}
            />
          )}
        </div>
      </div>

      {/* ── Active sub-mode body ── */}
      <div key={mode} className="animate-fade-in">
        {renderBody()}
      </div>
    </div>
  );
}
