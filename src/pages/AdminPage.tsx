import { useEffect, useMemo, useRef, useState } from "react";
import {
  ShieldCheck, Search, HardDrive, KeyRound, Check, X, ArrowRight,
  Copy, ChevronDown, User, AlertTriangle, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog } from "@/components/ui/Dialog";
import { API } from "@/lib/backend";
import { useAuth } from "@/hooks/useAuth";
import { fetchStorageInfo, type ServerStorageInfo } from "@/lib/serverAI";
import { effectiveLimits, formatBytes } from "@/lib/projectStorage";
import { PLANS, type PlanTier } from "@/lib/plans";
import {
  adminKeyStore, recentEmails, planProductId, setPlanProductId,
  statusInfo, planFeatures, planHighlight, planDiff, imageLimitLabel,
  toLicenseView, type LicenseView,
} from "@/lib/adminPanel";

/** Reihenfolge im UI — vom kleinsten zum grössten Paket (Anzeigenamen!). */
const TIER_ORDER: PlanTier[] = ["basic", "premium", "full", "studio"];

export default function AdminPage() {
  const { license } = useAuth();

  const [adminKey, setAdminKey] = useState(() => adminKeyStore.get());
  const [keyDraft, setKeyDraft] = useState("");
  const [editingKey, setEditingKey] = useState(() => !adminKeyStore.get());

  const [email, setEmail] = useState("");
  const [recent, setRecent] = useState<string[]>(() => recentEmails.list());
  const [result, setResult] = useState<LicenseView | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [storage, setStorage] = useState<ServerStorageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTech, setShowTech] = useState(false);

  // Wechsel-Dialog
  const [target, setTarget] = useState<PlanTier | null>(null);
  const [idDraft, setIdDraft] = useState("");
  const [switching, setSwitching] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingKey) emailRef.current?.focus();
  }, [editingKey]);

  // Muss VOR dem Admin-Gate stehen — sonst unterschiedliche Hook-Anzahl pro Render.
  const diff = useMemo(
    () => (result && target ? planDiff(result.tier, target) : null),
    [result, target],
  );

  if (!license?.isAdmin) {
    return (
      <Card className="max-w-xl mx-auto text-center py-12">
        <ShieldCheck className="w-10 h-10 text-ink-50/30 mx-auto mb-3" />
        <div className="text-base font-semibold mb-1">Kein Zugriff</div>
        <div className="text-sm text-ink-50/55">Diese Seite ist Admin-only.</div>
      </Card>
    );
  }

  // Direkt gegen den Key-Manager (DigitalOcean) — kein Supabase. Auth über den
  // gespeicherten Admin-Schlüssel (Header x-admin-api-key).
  const callPanel = async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(API(path), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-api-key": adminKey },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({} as any));
    if (res.status === 401 || res.status === 403 || res.status === 503) {
      setEditingKey(true);
      setKeyDraft("");
      throw new Error("Der Admin-Schlüssel stimmt nicht. Bitte neu eingeben.");
    }
    if (!res.ok) throw new Error(data?.error || `Der Server meldet einen Fehler (${res.status}).`);
    return data;
  };

  const lookup = async (raw?: string) => {
    const q = (raw ?? email).trim();
    if (!q) { toast.error("Bitte eine E-Mail-Adresse eingeben."); emailRef.current?.focus(); return; }
    if (!adminKey) { setEditingKey(true); toast.error("Bitte zuerst den Admin-Schlüssel eintragen."); return; }
    setEmail(q);
    setLoading(true);
    setNotFound(null);
    try {
      const data = await callPanel("/api/admin/panel/lookup", { email: q });
      const view = toLicenseView(data, q);
      if (!view) {
        setResult(null); setStorage(null);
        setNotFound(q);
        return;
      }
      setResult(view);
      setRecent(recentEmails.add(view.email));
      fetchStorageInfo(view.email).then(setStorage).catch(() => setStorage(null));
    } catch (e: any) {
      toast.error(e.message);
      setResult(null); setStorage(null); setNotFound(null);
    } finally {
      setLoading(false);
    }
  };

  const applyPlan = async (tier: PlanTier, productId: number) => {
    if (!result) return;
    setSwitching(true);
    try {
      await callPanel("/api/admin/panel/change-product", { licenseKey: result.licenseKey, productId });
      toast.success(`${result.email} ist jetzt auf „${PLANS[tier].label}“.`);
      setTarget(null);
      await lookup(result.email);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSwitching(false);
    }
  };

  const confirmSwitch = async () => {
    if (!target) return;
    const known = planProductId(target);
    if (known) { await applyPlan(target, known); return; }
    // Nummer fehlt → einmalig eintragen, danach merkt sich das Panel sie.
    const n = Number(idDraft.trim());
    if (!Number.isInteger(n) || n <= 0) { toast.error("Bitte die Produkt-Nummer als Zahl eintragen."); return; }
    setPlanProductId(target, n);
    await applyPlan(target, n);
  };

  const saveKey = () => {
    const v = keyDraft.trim();
    if (!v) { toast.error("Bitte den Admin-Schlüssel eintragen."); return; }
    adminKeyStore.set(v);
    setAdminKey(v);
    setKeyDraft("");
    setEditingKey(false);
    toast.success("Gespeichert — du musst ihn nie wieder eingeben.");
  };

  const forgetKey = () => {
    adminKeyStore.clear();
    setAdminKey("");
    setKeyDraft("");
    setEditingKey(true);
  };

  return (
    <div>
      <PageHeader
        title="Admin-Panel"
        subtitle="Kunde suchen, Paket per Klick umstellen, Speicher prüfen."
        badge={<Badge tone="warn"><ShieldCheck className="w-3 h-3" /> Admin only</Badge>}
      />

      {/* ---------- Schritt 1: Kunde suchen ---------- */}
      <Card className="mb-4">
        <CardHeader
          title="1. Kunde suchen"
          subtitle="E-Mail eintippen, Enter drücken — mehr braucht es nicht."
          icon={<Search className="w-4 h-4" />}
          action={
            !editingKey ? (
              <button
                onClick={() => setEditingKey(true)}
                className="inline-flex items-center gap-1.5 text-xs text-ink-50/50 hover:text-ink-50 transition-colors"
                title="Admin-Schlüssel ändern"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Zugang gespeichert
              </button>
            ) : undefined
          }
        />

        {editingKey ? (
          <div className="mb-4 rounded-2xl border border-flare-400/25 bg-flare-500/5 p-4">
            <div className="flex items-start gap-3 mb-3">
              <KeyRound className="w-4 h-4 text-flare-300 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium text-ink-50">Einmalig: Admin-Schlüssel</div>
                <div className="text-ink-50/55 text-xs mt-0.5">
                  Wird nur in diesem Browser gespeichert. Danach musst du ihn nie wieder eintippen.
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <Input
                type="password"
                autoComplete="off"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveKey()}
                placeholder="Admin-Schlüssel"
                className="flex-1"
              />
              <div className="flex gap-2">
                <Button onClick={saveKey} iconLeft={<Check className="w-4 h-4" />}>Speichern & merken</Button>
                {adminKey && (
                  <Button variant="ghost" onClick={() => { setEditingKey(false); setKeyDraft(""); }}>Abbrechen</Button>
                )}
              </div>
            </div>
            {adminKey && (
              <button
                onClick={forgetKey}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-50/45 hover:text-danger transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Gespeicherten Schlüssel löschen
              </button>
            )}
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <Input
            ref={emailRef}
            label="E-Mail des Kunden"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void lookup()}
            placeholder="kunde@beispiel.de"
            iconLeft={<User className="w-4 h-4" />}
            className="flex-1"
          />
          <Button onClick={() => void lookup()} loading={loading} size="lg" iconLeft={<Search className="w-4 h-4" />}>
            Kunde suchen
          </Button>
        </div>

        {recent.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-xs text-ink-50/40">Zuletzt:</span>
            {recent.map((r) => (
              <button
                key={r}
                onClick={() => void lookup(r)}
                className="px-2.5 py-1 rounded-full text-[11px] border border-white/10 bg-white/5 text-ink-50/75 hover:bg-white/10 hover:text-ink-50 transition-colors"
              >
                {r}
              </button>
            ))}
            <button
              onClick={() => setRecent(recentEmails.clear())}
              className="text-[11px] text-ink-50/35 hover:text-ink-50/70 transition-colors"
            >
              leeren
            </button>
          </div>
        )}

        {notFound && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-warn/25 bg-warn/5 p-4">
            <AlertTriangle className="w-4 h-4 text-warn mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <div className="font-medium text-ink-50">Kein Kunde mit dieser E-Mail</div>
              <div className="text-ink-50/55 text-xs mt-0.5">
                Für <span className="font-mono">{notFound}</span> gibt es keine Lizenz. Tippfehler? Oder wurde mit einer
                anderen Adresse gekauft?
              </div>
            </div>
          </div>
        )}
      </Card>

      {result && (
        <div className="grid grid-cols-1 gap-4">
          {/* ---------- Schritt 2: aktuelles Paket ---------- */}
          <Card>
            <CardHeader
              title="2. Das hat der Kunde aktuell"
              subtitle={result.email}
              icon={<User className="w-4 h-4" />}
              action={<StatusBadge status={result.status} />}
            />

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="px-4 py-3 rounded-2xl bg-flare-500/10 border border-flare-400/25">
                <div className="text-[10px] uppercase tracking-widest text-flare-200/70">Paket</div>
                <div className="text-xl font-semibold text-ink-50 leading-tight">{PLANS[result.tier].label}</div>
              </div>
              <div className="text-sm text-ink-50/60">
                <div>{PLANS[result.tier].monthlyChip}</div>
                <div className="text-xs text-ink-50/45">{imageLimitLabel(PLANS[result.tier].maxImagesPerRun)}</div>
              </div>
              {result.expiresAt && (
                <div className="text-sm text-ink-50/60 ml-auto">
                  Läuft ab am{" "}
                  <span className="text-ink-50">{new Date(result.expiresAt).toLocaleDateString("de-DE")}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {planFeatures(result.tier).map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border border-success/25 bg-success/10 text-success"
                >
                  <Check className="w-3 h-3" /> {f}
                </span>
              ))}
            </div>

            <button
              onClick={() => setShowTech((v) => !v)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-ink-50/40 hover:text-ink-50/70 transition-colors"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTech ? "rotate-180" : ""}`} />
              Technische Details
            </button>
            {showTech && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-ink-800/60 border border-white/5 rounded-2xl p-3">
                  <div className="text-[10px] uppercase tracking-widest text-ink-50/45 mb-1">Lizenzschlüssel</div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-mono text-ink-50 truncate">{result.licenseKey}</div>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(result.licenseKey);
                        toast.success("Kopiert.");
                      }}
                      className="ml-auto text-ink-50/45 hover:text-ink-50 transition-colors"
                      title="Kopieren"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="bg-ink-800/60 border border-white/5 rounded-2xl p-3">
                  <div className="text-[10px] uppercase tracking-widest text-ink-50/45 mb-1">Datenbank</div>
                  <div className="text-sm font-mono text-ink-50 truncate">
                    {result.rawCode || "—"}
                    {result.rawProductId ? ` · ID ${result.rawProductId}` : ""}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* ---------- Schritt 3: Paket wechseln ---------- */}
          <Card>
            <CardHeader
              title="3. Paket umstellen"
              subtitle="Ein Klick — du siehst vorher genau, was sich für den Kunden ändert."
              icon={<ArrowRight className="w-4 h-4" />}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {TIER_ORDER.map((tier) => (
                <PlanButton
                  key={tier}
                  tier={tier}
                  current={tier === result.tier}
                  onClick={() => { setTarget(tier); setIdDraft(""); }}
                />
              ))}
            </div>
          </Card>

          {/* ---------- Speicher ---------- */}
          <Card>
            <CardHeader
              title="Speicher"
              subtitle="Was der Kunde an Speicher gebucht hat."
              icon={<HardDrive className="w-4 h-4" />}
            />
            {storage ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field
                    label="Zusatz-Speicher"
                    value={storage.activeAddons > 0 ? "Gebucht" : "Nicht gebucht"}
                  />
                  <Field label="Speicher-Limit" value={formatBytes(effectiveLimits(storage.activeAddons > 0).bytes)} />
                  <Field label="Projekte erlaubt" value={String(effectiveLimits(storage.activeAddons > 0).projects)} />
                </div>
                <div className="text-xs text-ink-50/40 mt-3">
                  Wie viel davon tatsächlich belegt ist, liegt nur im Browser des Kunden — das sieht der Server nicht.
                </div>
              </>
            ) : (
              <div className="text-sm text-ink-50/45 py-4">Speicher-Daten konnten nicht geladen werden.</div>
            )}
          </Card>
        </div>
      )}

      {/* ---------- Bestätigung ---------- */}
      <Dialog
        open={!!target && !!result}
        onClose={() => (switching ? undefined : setTarget(null))}
        title={target ? `Auf „${PLANS[target].label}“ umstellen?` : ""}
        subtitle={result?.email}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={switching}>Abbrechen</Button>
            <Button onClick={() => void confirmSwitch()} loading={switching}>
              {target ? `Ja, auf „${PLANS[target].label}“ umstellen` : "Bestätigen"}
            </Button>
          </div>
        }
      >
        {target && result && diff && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">{PLANS[result.tier].label}</span>
              <ArrowRight className="w-4 h-4 text-ink-50/40" />
              <span className="px-3 py-1.5 rounded-xl bg-flare-500/15 border border-flare-400/30 text-flare-200 font-medium">
                {PLANS[target].label}
              </span>
            </div>

            {planProductId(target) === null ? (
              <div className="rounded-2xl border border-warn/25 bg-warn/5 p-4">
                <div className="text-sm font-medium text-ink-50 mb-1">Einmalig: Produkt-Nummer für „{PLANS[target].label}“</div>
                <div className="text-xs text-ink-50/55 mb-3">
                  Diese Nummer steht in der Datenbank-Tabelle <span className="font-mono">products</span>. Einmal eintragen —
                  danach merkt sich das Panel sie dauerhaft.
                </div>
                <Input
                  type="number"
                  value={idDraft}
                  onChange={(e) => setIdDraft(e.target.value)}
                  placeholder="z. B. 3"
                  className="max-w-[160px]"
                />
              </div>
            ) : null}

            {diff.gained.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-widest text-success/80 mb-2">Kunde bekommt neu</div>
                <div className="flex flex-wrap gap-2">
                  {diff.gained.map((f) => (
                    <span key={f} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border border-success/25 bg-success/10 text-success">
                      <Check className="w-3 h-3" /> {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {diff.lost.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-widest text-danger/80 mb-2">Kunde verliert</div>
                <div className="flex flex-wrap gap-2">
                  {diff.lost.map((f) => (
                    <span key={f} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border border-danger/25 bg-danger/10 text-danger">
                      <X className="w-3 h-3" /> {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {diff.imageLimitChanged && (
              <div className="text-sm text-ink-50/70">
                Bilder: <span className="text-ink-50/50 line-through">{diff.imagesBefore}</span> → <span className="text-ink-50">{diff.imagesAfter}</span>
              </div>
            )}

            {diff.gained.length === 0 && diff.lost.length === 0 && !diff.imageLimitChanged && (
              <div className="text-sm text-ink-50/60">
                {result.tier === target
                  ? "Der Kunde ist bereits auf diesem Paket — es ändert sich nichts."
                  : "Die Funktionen bleiben gleich, nur das Paket wird gewechselt."}
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

function PlanButton({ tier, current, onClick }: { tier: PlanTier; current: boolean; onClick: () => void }) {
  const plan = PLANS[tier];
  return (
    <button
      onClick={current ? undefined : onClick}
      disabled={current}
      className={`text-left p-4 rounded-2xl border transition-all flex flex-col gap-1 min-h-[132px] ${
        current
          ? "border-success/30 bg-success/5 cursor-default"
          : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-flare-400/40 active:scale-[0.99]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-base font-semibold text-ink-50">{plan.label}</span>
        {current && <Badge tone="success"><Check className="w-3 h-3" /> Aktuell</Badge>}
      </div>
      <div className="text-xs text-ink-50/50">{plan.monthlyChip}</div>
      <div className="text-xs text-ink-50/65 leading-snug">{planHighlight(tier)}</div>
      <div className={`mt-auto pt-2 text-xs font-medium inline-flex items-center gap-1 ${current ? "text-success/70" : "text-flare-200"}`}>
        {current ? "Kein Wechsel nötig" : <>Auf „{plan.label}“ umstellen <ArrowRight className="w-3 h-3" /></>}
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const info = statusInfo(status);
  return <Badge tone={info.tone}>{info.label}</Badge>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-800/60 border border-white/5 rounded-2xl p-3">
      <div className="text-[10px] uppercase tracking-widest text-ink-50/45 mb-1">{label}</div>
      <div className="text-sm text-ink-50 truncate">{value}</div>
    </div>
  );
}
