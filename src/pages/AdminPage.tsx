import { useState } from "react";
import { ShieldCheck, Search, RefreshCw, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/Shell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { API } from "@/lib/backend";
import { useAuth } from "@/hooks/useAuth";
import { fetchStorageQuota, type ServerQuota } from "@/lib/serverAI";
import { formatBytes } from "@/lib/projectStorage";

interface LicenseRecord {
  email: string;
  licenseKey: string;
  productCode?: string;
  status?: string;
  expiresAt?: string;
}

export default function AdminPage() {
  const { license } = useAuth();
  const [email, setEmail] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [result, setResult] = useState<LicenseRecord | null>(null);
  const [quota, setQuota] = useState<ServerQuota | null>(null);
  const [loading, setLoading] = useState(false);
  const [newProduct, setNewProduct] = useState("FULL");

  if (!license?.isAdmin) {
    return (
      <Card className="max-w-xl mx-auto text-center py-12">
        <ShieldCheck className="w-10 h-10 text-ink-50/30 mx-auto mb-3" />
        <div className="text-base font-semibold mb-1">Kein Zugriff</div>
        <div className="text-sm text-ink-50/55">Diese Seite ist Admin-only.</div>
      </Card>
    );
  }

  const lookup = async () => {
    if (!email.trim() || !adminKey.trim()) {
      toast.error("Email und Admin-Key benötigt.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(API("/api/admin/license/lookup"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey.trim() },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup fehlgeschlagen.");
      setResult(data);

      // Try fetching extras — non-fatal if this endpoint is missing.
      await fetchStorageQuota(data.email).then((q) => setQuota(q)).catch(() => setQuota(null));
    } catch (e: any) {
      toast.error(e.message);
      setResult(null); setQuota(null);
    } finally {
      setLoading(false);
    }
  };

  const changeProduct = async () => {
    if (!result) return;
    try {
      const res = await fetch(API("/api/admin/license/change-product"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Admin-Key": adminKey.trim() },
        body: JSON.stringify({ email: result.email, newProductCode: newProduct }),
      });
      if (!res.ok) throw new Error("Änderung fehlgeschlagen.");
      toast.success(`Produkt für ${result.email} → ${newProduct}`);
      await lookup();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Admin-Panel"
        subtitle="Lizenz-Lookup, Produkt-Wechsel & Speicher-Übersicht."
        badge={<Badge tone="warn"><ShieldCheck className="w-3 h-3" /> Admin only</Badge>}
      />

      <Card className="mb-4">
        <CardHeader title="Lizenz-Lookup" subtitle="Findet den aktuellen Plan einer E-Mail-Adresse" icon={<Search className="w-4 h-4" />} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kunde@beispiel.de" />
          <Input label="Admin-Key" type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} placeholder="X-Admin-Key Header" />
        </div>
        <div className="mt-4">
          <Button onClick={lookup} loading={loading} iconLeft={<Search className="w-4 h-4" />}>Suchen</Button>
        </div>
      </Card>

      {result && (
        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader title="Treffer" subtitle={result.email} icon={<RefreshCw className="w-4 h-4" />} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Field label="Schlüssel" value={result.licenseKey} mono />
              <Field label="Produkt" value={result.productCode || "—"} />
              <Field label="Status" value={result.status || "—"} />
              <Field label="Läuft ab" value={result.expiresAt ? new Date(result.expiresAt).toLocaleDateString("de-DE") : "—"} />
            </div>
            <div className="flex items-end gap-3 pt-3 border-t border-white/5">
              <Select label="Neues Produkt" value={newProduct} onChange={(e) => setNewProduct(e.target.value)} options={[
                { value: "BASIC",   label: "BASIC" },
                { value: "PREMIUM", label: "PREMIUM" },
                { value: "FULL",    label: "FULL" },
              ]} />
              <Button onClick={changeProduct} variant="secondary">Produkt ändern</Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Speicher" subtitle={quota ? `${formatBytes(quota.usedBytes)} von ${formatBytes(quota.limitBytes)}` : "Keine Daten"} icon={<HardDrive className="w-4 h-4" />} />
            {quota ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Field label="Verwendet" value={formatBytes(quota.usedBytes)} />
                  <Field label="Limit" value={formatBytes(quota.limitBytes)} />
                  <Field label="Projekt-Limit" value={String(quota.projectLimit)} />
                  <Field label="Addon" value={quota.hasAddon ? "Aktiv" : "—"} />
                </div>
                <div className="h-2 rounded-full bg-ink-950/60 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${quota.isOverLimit ? "bg-danger" : "bg-flare-grad"}`}
                    style={{ width: `${Math.min(100, quota.percentUsed)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm text-ink-50/45 py-4">Keine Speicher-Daten geladen.</div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-ink-800/60 border border-white/5 rounded-2xl p-3">
      <div className="text-[10px] uppercase tracking-widest text-ink-50/45 mb-1">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : ""} text-ink-50 truncate`}>{value}</div>
    </div>
  );
}
