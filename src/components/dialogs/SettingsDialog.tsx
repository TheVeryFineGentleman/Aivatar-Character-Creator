import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, type Theme, COLOR_THEMES } from "@/hooks/useTheme";
import { useElevenVoices } from "@/hooks/useElevenVoices";
import { checkGeminiKey } from "@/lib/ai";
import { toast } from "sonner";
import { Trash2, ExternalLink, Eye, EyeOff, Sun, Moon, Monitor, KeyRound, Palette, HardDrive, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { BACKEND } from "@/lib/backend";
import { StorageMeter } from "@/components/StorageMeter";
import { TutorialCTA } from "@/components/tutorials/TutorialCTA";
import { cn } from "@/lib/cn";

type SectionId = "connect" | "appearance" | "storage";

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { provider, setProvider, googleKey, setGoogleKey, falKey, setFalKey, elevenKey, setElevenKey, clearAll, hasFalKey, hasGoogleKey } = useSettings();
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();
  const { plan } = useAuth();
  const [section, setSection] = useState<SectionId>("connect");
  const [showG, setShowG] = useState(false);
  const [showF, setShowF] = useState(false);
  const [showE, setShowE] = useState(false);
  const [g, setG] = useState(googleKey);
  const [f, setF] = useState(falKey);
  const [el, setEl] = useState(elevenKey);

  // ElevenLabs-Feld und Provider-Toggle bleiben Video-Plänen vorbehalten.
  //
  // DAS fal-KEY-FELD NICHT MEHR: fal ist seit der Pflicht-Regelung
  // (`hasGenKey` in useSettings) für JEDEN Plan erforderlich. Bliebe das Feld
  // planabhängig verborgen, wäre die Pflicht auf Plänen ohne Video-Freischaltung
  // unerfüllbar — die App verlangte einen Key, den man nirgends eintragen kann,
  // und wäre damit tot. Was der Plan freischaltet, entscheidet weiterhin `plan`;
  // der Key gehört davon getrennt.
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
    setElevenKey(el);
    toast.success("API-Keys gespeichert.");
    onClose();
  };

  const resetEverything = () => {
    if (!confirm("Alle Keys, Theme und Provider zurücksetzen? Projekte bleiben erhalten.")) return;
    clearAll();
    setG(""); setF(""); setEl("");
    setTheme("light");
    setColorTheme("neon");
    setProvider("google");
    toast.success("Einstellungen zurückgesetzt.");
  };

  // Setup-Lücke → amber Punkt im Nav. Beide Keys sind Pflicht, also zählt jeder
  // fehlende — unabhängig vom Plan (siehe `showFal` oben).
  const connectNeedsAttention = !hasGoogleKey || !hasFalKey;

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
            /* Ein Block pro Dienst, jeder mit derselben Kopfzeile:
               Name · wofür · Zustand. Damit beantwortet ein Blick von oben nach
               unten „was brauche ich, was habe ich, was fehlt" — vorher standen
               Zustand (in den Provider-Kacheln) und Eingabefeld an verschiedenen
               Stellen, und nur ElevenLabs sagte überhaupt, ob es funktioniert. */
            <div className="space-y-3">
              {connectNeedsAttention && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-warn/35 bg-warn/10 px-3.5 py-3">
                  <span className="w-2 h-2 rounded-full flex-none mt-1.5" style={{ background: "#e0aa4a" }} />
                  <span className="text-xs text-warn">
                    {!hasGoogleKey && !hasFalKey
                      ? "Beide Keys fehlen. Google macht Texte und Bilder, fal.ai die Clips, die Lippensynchronität und die Stimme — ohne beide startet keine Generierung."
                      : !hasGoogleKey
                      ? "Google-Key fehlt — ohne ihn entstehen weder Texte noch Bilder. Er ist Pflicht."
                      : "fal.ai-Key fehlt — ohne ihn keine Clips, keine Lippensynchronität und keine feste Stimme. Er ist Pflicht."}
                  </span>
                </div>
              )}

              <KeyCard
                title="Google Gemini"
                purpose="Texte, Storyboards und alle Bilder."
                requirement="Pflicht"
                state={looksSwapped("google", g)
                  ? keyState(g, googleKey, "google")
                  : <GoogleStatus googleKey={googleKey} dirty={g.trim() !== googleKey} />}
                value={g}
                onChange={setG}
                reveal={showG}
                onReveal={() => setShowG(!showG)}
                placeholder="AIza…"
                linkUrl={BACKEND.geminiKeyUrl}
                linkLabel="aistudio.google.com → API Keys"
              >
                <TutorialCTA tutorialId="google-api-key" />
              </KeyCard>

              <KeyCard
                title="fal.ai"
                purpose="Clips (Kling), Lippensynchronität und die feste Sprecherstimme."
                requirement="Pflicht"
                state={keyState(f, falKey, "fal")}
                value={f}
                onChange={setF}
                reveal={showF}
                onReveal={() => setShowF(!showF)}
                placeholder="fal_…"
                linkUrl={BACKEND.falKeyUrl}
                linkLabel="fal.ai → Dashboard → Keys"
              >
                <TutorialCTA tutorialId="fal-api-key" />
              </KeyCard>

              {showFal && (
                <KeyCard
                  title="ElevenLabs"
                  purpose="Deine eigenen und native deutsche Stimmen statt der Standardliste. Ohne Key läuft die Stimme über fal.ai."
                  requirement="Optional"
                  /* Der Zustand bezieht sich auf den GESPEICHERTEN Key, nicht auf
                     das Eingabefeld — sonst liefe bei jedem Tastendruck eine
                     Anfrage, und „verbunden" stünde da, bevor irgendwas gilt. */
                  state={<ElevenStatus elevenKey={elevenKey} dirty={el.trim() !== elevenKey} />}
                  value={el}
                  onChange={setEl}
                  reveal={showE}
                  onReveal={() => setShowE(!showE)}
                  placeholder="sk_…"
                  linkUrl={BACKEND.elevenKeyUrl}
                  linkLabel="elevenlabs.io → Settings → API Keys"
                >
                  <TutorialCTA tutorialId="eleven-voice" />
                </KeyCard>
              )}

              {showFal && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="text-sm font-semibold text-ink-50">Wer macht Texte & Bilder zuerst?</div>
                  <div className="text-xs text-ink-50/55 mt-1 mb-3">
                    Der Gewählte kommt zuerst dran, der andere springt bei einem Fehler ein — sofern dessen Key gesetzt ist.
                    Gilt nur für Texte und Bilder: Clips laufen immer über Kling (fal.ai), ohne Ausweichen.
                  </div>
                  <div className="flex gap-2">
                    <ProviderTile
                      active={provider === "google"}
                      onClick={() => setProvider("google")}
                      title="Google"
                      hint={hasGoogleKey ? "Key vorhanden" : "Kein Key — kann nicht einspringen"}
                      ok={hasGoogleKey}
                      right={<Badge tone="accent">Standard</Badge>}
                    />
                    <ProviderTile
                      active={provider === "fal"}
                      onClick={() => setProvider("fal")}
                      title="fal.ai"
                      hint={hasFalKey ? "Key vorhanden" : "Kein Key — kann nicht einspringen"}
                      ok={hasFalKey}
                      right={<Badge tone="cool">Alternative</Badge>}
                    />
                  </div>
                </div>
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

/** Zustands-Plakette in der Kopfzeile eines Dienstes. Immer an derselben
 *  Stelle, damit man die drei Blöcke von oben nach unten abscannen kann. */
function StatePill({ tone, label }: { tone: "ok" | "warn" | "idle"; label: string }) {
  const color = tone === "ok" ? "#3fa66a" : tone === "warn" ? "#d9a441" : "#8a90a0";
  return (
    <span
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap max-w-[15rem]",
        "border bg-white/5 border-white/10",
        tone === "ok" ? "text-ink-50/75" : tone === "warn" ? "text-warn" : "text-ink-50/50",
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: color }} />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Zustand eines Key-Feldes. Der Entwurf im Eingabefeld zählt NICHT als
 *  verbunden — sonst stünde „Verbunden" da, bevor „Speichern" gedrückt wurde. */
/**
 * Sieht der eingetragene Wert nach dem Key aus, der in DIESES Feld gehört?
 *
 * Der häufigste Fehler mit zwei Pflicht-Keys ist der simpelste: beide sind
 * gültig, aber vertauscht. Google antwortet darauf mit „API key not valid" —
 * und der Nutzer prüft einen Key, an dem nichts falsch ist, weil die Meldung
 * über den ORT nichts sagt.
 *
 * Bewusst nur ein HINWEIS, keine Sperre: Key-Formate ändern sich, und eine
 * Formatprüfung, die einen gültigen neuen Key ablehnt, wäre schlimmer als das
 * Problem. Google-Keys beginnen seit jeher mit „AIza", fal-Keys nicht.
 */
function looksSwapped(kind: "google" | "fal", value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (kind === "google") return !v.startsWith("AIza");
  return v.startsWith("AIza");
}

function keyState(draft: string, saved: string, kind?: "google" | "fal") {
  if (kind && looksSwapped(kind, draft)) {
    return <StatePill tone="warn" label={kind === "google" ? "Sieht nicht nach einem Google-Key aus" : "Das ist ein Google-Key"} />;
  }
  if (draft.trim() !== saved) return <StatePill tone="warn" label="Noch nicht gespeichert" />;
  if (saved) return <StatePill tone="ok" label="Verbunden" />;
  return <StatePill tone="warn" label="Kein Key" />;
}

/**
 * Wie `ElevenStatus`, nur für Google: fragt den Key wirklich bei Google an,
 * statt „Verbunden" zu behaupten, weil das Feld gefüllt ist.
 *
 * Genau diese Lücke hat uns Stunden gekostet — die Einstellungen sagten
 * „Verbunden", während Google jeden Aufruf mit „API key not valid" ablehnte.
 * Geprüft wird der GESPEICHERTE Key (nicht das Eingabefeld), sonst liefe bei
 * jedem Tastendruck eine Anfrage.
 */
function GoogleStatus({ googleKey, dirty }: { googleKey: string; dirty: boolean }) {
  const [state, setState] = useState<Awaited<ReturnType<typeof checkGeminiKey>> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (dirty || !googleKey) { setState(null); return; }
    let alive = true;
    setBusy(true);
    checkGeminiKey(googleKey)
      .then((r) => { if (alive) setState(r); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [googleKey, dirty]);

  if (dirty)      return <StatePill tone="warn" label="Noch nicht gespeichert" />;
  if (!googleKey) return <StatePill tone="warn" label="Kein Key" />;
  if (busy)       return <StatePill tone="idle" label="Wird geprüft …" />;
  if (!state)     return <StatePill tone="idle" label="Nicht geprüft" />;
  if (!state.ok)  return <StatePill tone="warn" label={state.message} />;
  // Ein akzeptierter Key, dem die benutzten Modelle fehlen, ist genauso wenig
  // brauchbar — nur scheitert er später und mit einer ganz anderen Meldung.
  if (!state.hasText || !state.hasImage) {
    return <StatePill tone="warn" label={`Key gültig, aber ${!state.hasText ? "Text" : "Bild"}-Modell nicht freigeschaltet`} />;
  }
  return <StatePill tone="ok" label={`Verbunden · ${state.models} Modelle`} />;
}

/**
 * Zeigt, ob der gespeicherte ElevenLabs-Key wirklich trägt. Ein Key-Feld allein
 * beantwortet die Frage „bin ich verbunden?" nicht — ein Tippfehler fällt sonst
 * erst beim ersten Vertonungsversuch auf, also mitten in einem Rendering-Lauf.
 */
function ElevenStatus({ elevenKey, dirty }: { elevenKey: string; dirty: boolean }) {
  const { voices, loading, error } = useElevenVoices(elevenKey);
  const own = voices.filter((v) => v.category && v.category !== "premade").length;

  if (dirty)      return <StatePill tone="warn" label="Noch nicht gespeichert" />;
  if (!elevenKey) return <StatePill tone="idle" label="Nicht verbunden" />;
  if (loading)    return <StatePill tone="idle" label="Wird geprüft …" />;
  if (error)      return <StatePill tone="warn" label={error} />;
  return <StatePill tone="ok" label={`Verbunden · ${voices.length} Stimmen, ${own} eigene`} />;
}

/** Ein Dienst: Kopfzeile (Name · Pflicht/Optional · Zustand), ein Satz wofür,
 *  das Key-Feld, die Fundstelle des Keys. Für alle drei identisch aufgebaut. */
function KeyCard({
  title, purpose, requirement, state,
  value, onChange, reveal, onReveal, placeholder,
  linkUrl, linkLabel, children,
}: {
  title: string;
  purpose: string;
  requirement: string;
  state: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  reveal: boolean;
  onReveal: () => void;
  placeholder: string;
  linkUrl: string;
  linkLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-ink-50">{title}</span>
          <Badge tone={requirement === "Optional" ? "neutral" : "accent"} className="!text-[9px] !py-0">
            {requirement}
          </Badge>
        </div>
        <div className="flex-none">{state}</div>
      </div>
      <p className="text-xs text-ink-50/55 mt-1 mb-3 leading-snug">{purpose}</p>
      <Input
        type={reveal ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        iconLeft={
          <button type="button" onClick={onReveal} title={reveal ? "Key verbergen" : "Key anzeigen"}>
            {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
      />
      <a
        href={linkUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs text-flare-300 hover:text-flare-200"
      >
        {linkLabel} <ExternalLink className="w-3 h-3" />
      </a>
      {children && <div className="mt-3">{children}</div>}
    </section>
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
