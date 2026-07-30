import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, type Theme, COLOR_THEMES } from "@/hooks/useTheme";
import { toast } from "sonner";
import { Trash2, ExternalLink, Eye, EyeOff, Sun, Moon, Monitor, KeyRound, Palette, HardDrive, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BACKEND } from "@/lib/backend";
import { StorageMeter } from "@/components/StorageMeter";
import { TutorialCTA } from "@/components/tutorials/TutorialCTA";
import { cn } from "@/lib/cn";

type SectionId = "connect" | "appearance" | "storage";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { provider, setProvider, googleKey, setGoogleKey, falKey, setFalKey, clearAll, hasFalKey, hasGoogleKey } = useSettings();
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();
  const { plan } = useAuth();
  const [section, setSection] = useState<SectionId>("connect");
  const [showG, setShowG] = useState(false);
  const [showF, setShowF] = useState(false);
  const [g, setG] = useState(googleKey);
  const [f, setF] = useState(falKey);

  // fal.ai ist Video-only — bei Plänen ohne videoGen blenden wir Key-Feld
  // und Provider-Toggle aus und resetten die Priorität auf Google.
  const showFal = plan.videoGen;
  useEffect(() => {
    if (!showFal && provider === "fal") setProvider("google");
  }, [showFal, provider, setProvider]);

  // Dropdown-Verhalten: Escape schließt das Panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const save = () => {
    setGoogleKey(g);
    setFalKey(f);
    toast.success("API-Keys gespeichert.");
    onClose();
  };

  const resetEverything = () => {
    if (!confirm("Alle Keys, Theme und Provider zurücksetzen? Projekte bleiben erhalten.")) return;
    clearAll();
    setG(""); setF("");
    setTheme("dark");
    setColorTheme("neon");
    setProvider("google");
    toast.success("Einstellungen zurückgesetzt.");
  };

  // Setup-Lücke → amber Punkt im Nav: Google-Key fehlt (kritisch) oder
  // fal-Key fehlt obwohl der Plan Video kann (kein Fallback).
  const connectNeedsAttention = !hasGoogleKey || (showFal && !hasFalKey);

  const nav: { id: SectionId; label: string; icon: React.ReactNode; dot?: boolean; meta?: string }[] = [
    { id: "connect",    label: "Verbindung",       icon: <KeyRound className="w-4 h-4" />, dot: connectNeedsAttention },
    { id: "appearance", label: "Erscheinungsbild", icon: <Palette className="w-4 h-4" /> },
    { id: "storage",    label: "Speicher",         icon: <HardDrive className="w-4 h-4" /> },
  ];

  if (!open) return null;

  // Als Dropdown gerendert: Portal an <body>, fix oben rechts unter der TopBar
  // (h-14 = 56px) verankert, klappt von oben rechts herunter. Ein transparenter
  // Klick-Fänger schließt bei Klick daneben — ohne dunkles Modal-Overlay.
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className={cn(
          "absolute top-[62px] right-3 flex flex-col",
          "w-[min(720px,calc(100vw-1.5rem))] h-[min(600px,calc(100vh-74px))]",
          "bg-ink-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl",
          "overflow-hidden animate-slide-down origin-top-right",
        )}
      >
        {/* ── Header ── */}
        <div className="px-6 pt-5 pb-4 border-b border-white/5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink-50">Einstellungen</h2>
            <p className="text-sm text-ink-50/55 mt-1">API-Keys, Provider, Theme — alles lokal im Browser.</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-ink-50/60 hover:text-ink-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* ── Sidebar ── */}
          <nav className="w-[196px] flex-none border-r border-white/6 p-3 bg-white/[0.015]">
          {nav.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cn(
                  "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm font-medium mb-0.5 transition-colors",
                  active ? "bg-white/8 text-ink-50" : "text-ink-50/55 hover:bg-white/5 hover:text-ink-50/80",
                )}
              >
                <span className={active ? "text-flare-300" : "text-ink-50/45"}>{item.icon}</span>
                <span className="flex-1 text-left">{item.label}</span>
                {item.dot && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-none"
                    style={{ background: "#e0aa4a", boxShadow: active ? "0 0 8px #e0aa4a" : undefined }}
                  />
                )}
              </button>
            );
          })}
        </nav>

          {/* ── Inhalt ── */}
          <div className="flex-1 min-h-0 p-6 overflow-y-auto">
          {section === "connect" && (
            <div className="space-y-6">
              {connectNeedsAttention && (
                <div className="flex items-center gap-2.5 rounded-2xl border border-warn/35 bg-warn/10 px-3.5 py-3">
                  <span className="w-2 h-2 rounded-full flex-none" style={{ background: "#e0aa4a" }} />
                  <span className="text-xs text-warn">
                    {!hasGoogleKey ? "Google-Key fehlt — Text & Bilder brauchen ihn." : "fal.ai-Key fehlt — Video-Fallback ist inaktiv."}
                  </span>
                </div>
              )}

              {showFal && (
                <Section
                  title="Video-Provider — Priorität"
                  hint="Text & Bilder laufen immer über Google Gemini. Diese Auswahl gilt nur für Video: der bevorzugte Provider wird zuerst genutzt, der andere als Fallback (wenn dessen Key gesetzt ist)."
                >
                  <div className="flex gap-2">
                    <ProviderTile
                      active={provider === "google"}
                      onClick={() => setProvider("google")}
                      title="Google Veo"
                      hint={hasGoogleKey ? "Key vorhanden" : "Kein Google-Key gesetzt"}
                      ok={hasGoogleKey}
                      right={<Badge tone="accent">Standard</Badge>}
                    />
                    <ProviderTile
                      active={provider === "fal"}
                      onClick={() => setProvider("fal")}
                      title="fal.ai"
                      hint={hasFalKey ? "Key vorhanden" : "Kein fal-Key gesetzt"}
                      ok={hasFalKey}
                      right={<Badge tone="cool">Alternative</Badge>}
                    />
                  </div>
                </Section>
              )}

              <Section title="Google Gemini API-Key" hint="Erstelle einen Key auf aistudio.google.com.">
                <Input
                  type={showG ? "text" : "password"}
                  value={g}
                  onChange={(e) => setG(e.target.value)}
                  placeholder="AIza…"
                  iconLeft={<button type="button" onClick={() => setShowG(!showG)}>{showG ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>}
                />
                <a href={BACKEND.geminiKeyUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-flare-300 hover:text-flare-200">
                  aistudio.google.com → API Keys <ExternalLink className="w-3 h-3" />
                </a>
                <div className="mt-3"><TutorialCTA tutorialId="google-api-key" /></div>
              </Section>

              {showFal && (
                <Section title="fal.ai API-Key" hint="Wird für Video-Generierung verwendet.">
                  <Input
                    type={showF ? "text" : "password"}
                    value={f}
                    onChange={(e) => setF(e.target.value)}
                    placeholder="fal_…"
                    iconLeft={<button type="button" onClick={() => setShowF(!showF)}>{showF ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>}
                  />
                  <a href={BACKEND.falKeyUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-glacier-300 hover:text-glacier-200">
                    fal.ai → Dashboard → Keys <ExternalLink className="w-3 h-3" />
                  </a>
                  <div className="mt-3"><TutorialCTA tutorialId="fal-api-key" /></div>
                </Section>
              )}
            </div>
          )}

          {section === "appearance" && (
            <div className="space-y-6">
              <Section title="Theme" hint="Light, Dark oder Systempräferenz folgen.">
                <div className="grid grid-cols-3 gap-2">
                  <ThemeTile active={theme === "light"} onClick={() => setTheme("light")} icon={<Sun className="w-4 h-4" />} label="Light" />
                  <ThemeTile active={theme === "dark"} onClick={() => setTheme("dark")} icon={<Moon className="w-4 h-4" />} label="Dark" />
                  <ThemeTile active={theme === "system"} onClick={() => setTheme("system" as Theme)} icon={<Monitor className="w-4 h-4" />} label="System" />
                </div>
              </Section>

              <Section title="Akzentfarbe" hint="Die Brand-Farbe färbt Buttons, Slider, Highlights & Body-Glow.">
                <div className="flex flex-col gap-2">
                  {COLOR_THEMES.map((opt) => {
                    const active = colorTheme === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setColorTheme(opt.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl border text-left transition-all active:scale-[0.99]",
                          active
                            ? "bg-white/5 border-white/20 shadow-soft"
                            : "bg-white/3 border-white/8 hover:bg-white/5 hover:border-white/15",
                        )}
                      >
                        <div
                          className="w-8 h-8 rounded-xl flex-shrink-0 shadow-md"
                          style={{
                            background: `linear-gradient(135deg, ${opt.swatch[0]} 0%, ${opt.swatch[1]} 100%)`,
                            boxShadow: active ? `0 0 0 2px ${opt.swatch[0]}55, 0 4px 12px ${opt.swatch[0]}33` : undefined,
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-ink-50">{opt.label}</div>
                          <div className="text-[11px] text-ink-50/55 mt-0.5 leading-tight">{opt.description}</div>
                        </div>
                        {active && <span className="text-flare-300 text-sm">●</span>}
                      </button>
                    );
                  })}
                </div>
              </Section>
            </div>
          )}

          {section === "storage" && (
            <Section title="Speicher" hint="Verbrauchsanzeige & Upgrade-Möglichkeit.">
              <StorageMeter variant="full" />
            </Section>
          )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-white/5 bg-ink-950/40 flex items-center justify-between gap-3">
          <Button variant="danger" size="sm" iconLeft={<Trash2 className="w-3.5 h-3.5" />} onClick={resetEverything}>
            Zurücksetzen
          </Button>
          <Button onClick={save}>Speichern</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-[10px] uppercase tracking-widest text-ink-50/45 font-medium mb-1">{title}</div>
      {hint && <div className="text-xs text-ink-50/55 mb-2">{hint}</div>}
      {children}
    </section>
  );
}

function ProviderTile({ active, onClick, title, hint, ok, right }: { active: boolean; onClick: () => void; title: string; hint: string; ok?: boolean; right?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 text-left p-4 rounded-2xl border transition-all",
        active
          ? "bg-flare-500/10 border-flare-400/40 shadow-glow"
          : "bg-white/3 border-white/8 hover:bg-white/5",
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="text-sm font-semibold">{title}</div>
        {right}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-ink-50/55">
        <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: ok ? "#3fa66a" : "#d9a441" }} />
        {hint}
      </div>
    </button>
  );
}

function ThemeTile({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all text-xs font-medium",
        active
          ? "bg-flare-500/10 border-flare-400/40 text-ink-50 shadow-glow"
          : "bg-white/3 border-white/8 text-ink-50/65 hover:bg-white/5 hover:text-ink-50",
      )}
    >
      <span className={active ? "text-flare-300" : "text-ink-50/55"}>{icon}</span>
      {label}
    </button>
  );
}
