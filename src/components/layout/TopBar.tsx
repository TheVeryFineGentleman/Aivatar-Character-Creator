import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Camera, Users, Film,
  Settings, LogOut, LogIn, Lock,
  KeyRound, ShieldCheck, CreditCard, Scale, MoreHorizontal, Sparkles, ArrowUp, X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Menu, MenuItem, MenuSection, MenuDivider } from "@/components/ui/Menu";
import { cn } from "@/lib/cn";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { StorageMeter } from "@/components/StorageMeter";
import { isFullSale } from "@/lib/plans";

// Build-Version (Git-Commit) — oben links, damit sofort sichtbar ist, welcher
// Stand geladen ist. Verlinkt auf den GitHub-Commit, wenn es ein echter SHA ist.
const APP_VERSION = __APP_VERSION__;
const COMMIT_URL = /^[0-9a-f]{7,40}$/i.test(APP_VERSION)
  ? `https://github.com/TheVeryFineGentleman/Aivatar-Character-Creator/commit/${APP_VERSION}`
  : null;

// ─── Tab config — 3 main tabs, Projekt-style consolidation ───────────────────

type TabId = "studio" | "character" | "story";

type TabSpec = {
  id: TabId;
  to: string;
  // List of pathnames that map to this tab (incl. legacy direct routes)
  matches: string[];
  label: string;
  Icon: LucideIcon;
  color: string;
  // If the *whole* group is locked at the current plan, mark as such.
  // Sub-features (e.g. chat inside character) gate themselves inside the hub.
  planKey?: "storyReel";
  tierLabel?: "Premium";
};

const TABS: TabSpec[] = [
  {
    id: "character",
    to: "/character",
    // Legacy sub-pages also activate this tab
    matches: ["/character", "/quick", "/chat", "/views", "/poses"],
    label: "Character Creator",
    Icon: Users,
    color: "hsl(263 70% 70%)",
  },
  {
    id: "studio",
    to: "/studio",
    matches: ["/studio"],
    label: "Avatar Studio",
    Icon: Camera,
    color: "hsl(28 95% 60%)",
  },
  {
    id: "story",
    to: "/story",
    matches: ["/story"],
    label: "Reel / Story",
    Icon: Film,
    color: "hsl(38 92% 60%)",
    planKey: "storyReel",
    tierLabel: "Premium",
  },
];

// ─── Plan badge ──────────────────────────────────────────────────────────────

function planBadgeStyle(tier: "basic" | "premium" | "full" | "studio"): React.CSSProperties {
  // Pro = amber, Premium = lila (Projekt-Mapping). Full = glacier zum Abgrenzen.
  const map = {
    studio:  { bg: "hsl(188 94% 45% / 0.18)", border: "hsl(188 94% 50% / 0.4)", color: "hsl(188 94% 75%)" },
    full:    { bg: "hsl(263 70% 55% / 0.18)", border: "hsl(263 70% 55% / 0.4)", color: "hsl(263 70% 78%)" },
    premium: { bg: "hsl(38 92% 55% / 0.18)",  border: "hsl(38 92% 55% / 0.4)",  color: "hsl(38 92% 70%)"  },
    basic:   {
      bg:     "linear-gradient(135deg, hsl(28 95% 55% / 0.20), hsl(263 70% 55% / 0.15))",
      border: "hsl(28 95% 60% / 0.55)",
      color:  "hsl(28 95% 78%)",
    },
  } as const;
  const s = map[tier];
  return {
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.05em",
    background: s.bg,
    border: `1.5px solid ${s.border}`,
    color: s.color,
    boxShadow: tier === "basic" ? "0 0 8px hsl(28 95% 55% / 0.15)" : undefined,
    whiteSpace: "nowrap" as const,
  };
}

// ─── TopBar ──────────────────────────────────────────────────────────────────

export function TopBar({ onLogin, onSettings, settingsOpen }: { onLogin: () => void; onSettings: () => void; settingsOpen?: boolean }) {
  const { credentials, plan, signOut, license } = useAuth();
  const { hasGoogleKey, hasFalKey } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const planTier = (plan.tier ?? "basic") as "basic" | "premium" | "full" | "studio";
  // Vollverkauf (Einmalkauf): keine Pläne/Abos/Preise anzeigen.
  const fullSale = isFullSale(plan);

  // Fehlt ein nötiger API-Key? Google ist immer Pflicht (Text & Bilder); der
  // fal.ai-Key nur bei Video-fähigen Plänen. Mirrort SettingsDialog.connectNeedsAttention.
  const needsKey = !!credentials && (!hasGoogleKey || (plan.videoGen && !hasFalKey));

  // Hinweis-Callout ist wegklickbar — nur für die aktuelle Ansicht. Nach einem
  // Refresh erscheint er wieder (solange ein API-Key fehlt), da nur In-Memory.
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const showKeyNotice = needsKey && !settingsOpen && !noticeDismissed;

  // Resolve active tab from the current pathname (incl. legacy sub-routes).
  const activeTab: TabId | null = (() => {
    const found = TABS.find((t) => t.matches.some((m) => location.pathname.startsWith(m)));
    return found ? found.id : null;
  })();

  // Sliding indicator
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabsWrapRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number; color: string } | null>(null);

  useEffect(() => {
    if (!activeTab) { setIndicator(null); return; }
    // Measure after layout settles
    const tick = () => {
      const el = tabRefs.current[activeTab];
      const wrap = tabsWrapRef.current;
      if (!el || !wrap) return;
      const wRect = wrap.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const tab = TABS.find((t) => t.id === activeTab);
      setIndicator({
        left: eRect.left - wRect.left,
        width: eRect.width,
        color: tab?.color ?? "hsl(28 95% 60%)",
      });
    };
    const r = requestAnimationFrame(tick);
    window.addEventListener("resize", tick);
    return () => {
      cancelAnimationFrame(r);
      window.removeEventListener("resize", tick);
    };
  }, [activeTab, location.pathname]);

  const iconBtn = (danger?: boolean) =>
    cn(
      "flex items-center justify-center w-8 h-8 rounded-lg border border-transparent",
      "transition-all duration-150 cursor-pointer",
      danger
        ? "text-ink-50/55 hover:bg-danger/10 hover:border-danger/25 hover:text-danger"
        : "text-ink-50/55 hover:bg-white/5 hover:border-white/10 hover:text-ink-50",
    );

  return (
    <header className={cn(
      "sticky top-0 z-30 flex items-center gap-2 px-4 h-14",
      "bg-ink-950/85 backdrop-blur-xl border-b border-white/5",
    )}>
      {/* ── Left: logo + divider + project switcher + storage ── */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Link to="/" className="flex items-center gap-2 group">
          <div
            className="w-[30px] h-[30px] rounded-[9px] shrink-0 flex items-center justify-center bg-flare-grad shadow-glow"
          >
            <Sparkles size={15} className="text-white" />
          </div>
          <span className="hidden sm:block text-[15px] font-bold tracking-tight">Aivatar</span>
        </Link>

        {/* Build-Version (Git-Commit) — verrät sofort, welcher Stand live ist */}
        {COMMIT_URL ? (
          <a
            href={COMMIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            title={`Build ${APP_VERSION} · ${__APP_BUILT__}`}
            className="shrink-0 font-mono text-[10px] leading-none text-ink-50/35 hover:text-ink-50/70 transition-colors"
          >
            {APP_VERSION}
          </a>
        ) : (
          <span
            title={`Build ${APP_VERSION} · ${__APP_BUILT__}`}
            className="shrink-0 font-mono text-[10px] leading-none text-ink-50/35"
          >
            {APP_VERSION}
          </span>
        )}

        {credentials && (
          <>
            <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />
            <ProjectSwitcher />
            <StorageMeter variant="compact" />
          </>
        )}
      </div>

      {/* ── Center: tabs with sliding underline ── */}
      <div
        ref={tabsWrapRef}
        className="flex-1 flex items-center justify-center gap-1 relative overflow-x-auto no-scrollbar"
      >
        {TABS.map((tab) => {
          const locked = tab.planKey ? !plan[tab.planKey] : false;
          const active = activeTab === tab.id;
          const Icon = tab.Icon;

          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[tab.id] = el; }}
              onClick={() => {
                if (locked) { navigate("/pricing"); return; }
                navigate(tab.to);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium",
                "transition-all duration-150 whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-flare-400/40",
                locked && "opacity-70",
                active
                  ? "border-transparent"
                  : "border-transparent text-ink-50/60 hover:text-ink-50 hover:bg-white/5",
              )}
              style={active ? {
                background: `${tab.color}1e`,
                color: tab.color,
                outline: `1px solid ${tab.color}44`,
              } : undefined}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {locked && (
                <span
                  className="flex items-center gap-0.5 text-[9.5px] font-bold px-1.5 py-0.5 rounded"
                  style={{
                    background: "hsl(263 70% 55% / 0.18)",
                    color:      "hsl(263 70% 78%)",
                    letterSpacing: "0.05em",
                  }}
                >
                  <Lock size={8} />
                  {tab.tierLabel ?? "Pro"}
                </span>
              )}
            </button>
          );
        })}

        {indicator && (
          <div
            className="absolute bottom-[-1px] h-[2px] rounded-t-sm pointer-events-none"
            style={{
              left: indicator.left,
              width: indicator.width,
              background: `linear-gradient(90deg, transparent, ${indicator.color}, transparent)`,
              transition: "left 0.28s cubic-bezier(.16,1,.3,1), width 0.28s cubic-bezier(.16,1,.3,1), background 0.28s ease",
            }}
          />
        )}
      </div>

      {/* ── Right: plan badge + actions ── */}
      <div className="flex items-center gap-2 shrink-0">
        {credentials && (
          <span style={planBadgeStyle(planTier)} className="hidden md:inline-block">
            {plan.label}
          </span>
        )}

        {credentials ? (
          <>
            <div className="relative">
              <button
                onClick={onSettings}
                className={cn(iconBtn(), needsKey && "!text-warn bg-warn/10 border-warn/30 hover:bg-warn/15")}
                title="Einstellungen"
              >
                <Settings size={15} />
              </button>

              {/* Hinweis-Callout: fehlt ein API-Key, zeigt ein Pfeil aufs Zahnrad.
                  Per X wegklickbar — kommt nach der Abklingzeit wieder. */}
              {showKeyNotice && (
                <div className="absolute top-full right-0 pt-2 z-50 animate-attention-nudge pointer-events-none">
                  <div className="pointer-events-auto relative flex items-center gap-0.5 pl-2.5 pr-1 py-1.5 rounded-xl bg-warn text-ink-950 text-[11px] font-bold shadow-lg whitespace-nowrap">
                    <span className="absolute -top-1 right-4 w-2.5 h-2.5 rotate-45 bg-warn rounded-[2px]" />
                    <button
                      type="button"
                      onClick={onSettings}
                      title="API-Key eintragen"
                      className="flex items-center gap-1 hover:brightness-90"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                      API-Key eintragen
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoticeDismissed(true)}
                      title="Hinweis ausblenden"
                      className="ml-0.5 flex items-center justify-center w-4 h-4 rounded hover:bg-ink-950/20"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Menu
              triggerClassName="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/5 transition-colors"
              trigger={
                <div className="w-7 h-7 rounded-lg bg-flare-grad flex items-center justify-center text-white text-xs font-semibold shadow-glow">
                  {credentials.email.charAt(0).toUpperCase()}
                </div>
              }
            >
              <div className="px-3.5 py-3 border-b border-white/5">
                <div className="text-[10px] uppercase tracking-widest text-ink-50/45 mb-1">Angemeldet als</div>
                <div className="text-sm font-medium truncate">{credentials.email}</div>
                <div className="text-[11px] text-ink-50/55 mt-1.5 flex items-center gap-2">
                  <Badge tone={plan.tier === "studio" ? "cool" : plan.tier === "full" ? "accent" : plan.tier === "premium" ? "cool" : "neutral"} className="!text-[9px] !py-0">{plan.label}</Badge>
                  <span>{fullSale ? "Vollversion — alles freigeschaltet" : plan.monthlyChip}</span>
                </div>
              </div>
              <MenuSection>
                <MenuItem icon={<KeyRound className="w-4 h-4" />} onClick={onSettings}>
                  API-Keys & Provider
                </MenuItem>
                {!fullSale && (
                  <MenuItem icon={<CreditCard className="w-4 h-4" />} onClick={() => navigate("/pricing")}>
                    Pläne & Abos
                  </MenuItem>
                )}
                {license?.isAdmin && (
                  <MenuItem
                    icon={<ShieldCheck className="w-4 h-4" />}
                    onClick={() => navigate("/admin")}
                    badge={<Badge tone="warn" className="!text-[9px] !py-0">Admin</Badge>}
                  >
                    Admin-Panel
                  </MenuItem>
                )}
                <MenuItem icon={<Scale className="w-4 h-4" />} onClick={() => navigate("/legal")}>
                  Rechtliches
                </MenuItem>
              </MenuSection>
              <MenuDivider />
              <MenuSection>
                <MenuItem icon={<LogOut className="w-4 h-4" />} onClick={signOut} danger>
                  Abmelden
                </MenuItem>
              </MenuSection>
            </Menu>
          </>
        ) : (
          <>
            <Menu
              triggerClassName="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center text-ink-50/55 hover:text-ink-50 transition-colors"
              trigger={<MoreHorizontal className="w-4 h-4" />}
            >
              <MenuSection>
                <MenuItem icon={<KeyRound className="w-4 h-4" />} onClick={onSettings}>API-Keys</MenuItem>
                <MenuItem icon={<CreditCard className="w-4 h-4" />} onClick={() => navigate("/pricing")}>Pläne</MenuItem>
                <MenuItem icon={<Scale className="w-4 h-4" />} onClick={() => navigate("/legal")}>Rechtliches</MenuItem>
              </MenuSection>
            </Menu>
            <Button variant="primary" size="sm" iconLeft={<LogIn className="w-4 h-4" />} onClick={onLogin}>
              Anmelden
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
