import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, RefreshCw, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { getFunctionHeaders, getFunctionUrl } from "@/lib/backend";
import { useToast } from "@/hooks/use-toast";

interface AdminPanelProps {
  requesterEmail: string;
}

export const ADMIN_EMAILS = new Set(["sattelite.de@gmail.com", "1", "2", "3"]);

export const isAdminEmail = (email: string) =>
  ADMIN_EMAILS.has((email || "").trim().toLowerCase());

export const AdminPanel = ({ requesterEmail }: AdminPanelProps) => {
  const { toast } = useToast();

  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);

  const [changeLicenseKey, setChangeLicenseKey] = useState("");
  const [changeProductId, setChangeProductId] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);
  const [changeResult, setChangeResult] = useState<any>(null);

  const callAdmin = async (payload: Record<string, unknown>) => {
    const response = await fetch(getFunctionUrl("license-admin"), {
      method: "POST",
      headers: getFunctionHeaders(),
      body: JSON.stringify({ ...payload, requesterEmail }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `Fehler (${response.status})`);
    }
    return data;
  };

  const handleLookup = async () => {
    if (!lookupEmail.trim()) {
      toast({ title: "Email fehlt", variant: "destructive" });
      return;
    }
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const data = await callAdmin({ action: "lookup", email: lookupEmail.trim() });
      setLookupResult(data);
      if (data?.found && data?.license?.licenseKey) {
        setChangeLicenseKey(data.license.licenseKey);
        if (data.license.productId != null) {
          setChangeProductId(String(data.license.productId));
        }
      }
    } catch (err) {
      toast({
        title: "Lookup fehlgeschlagen",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setLookupLoading(false);
    }
  };

  const handleChange = async () => {
    if (!changeLicenseKey.trim() || !changeProductId.trim()) {
      toast({ title: "License Key und Product ID erforderlich", variant: "destructive" });
      return;
    }
    const productIdNum = Number(changeProductId.trim());
    if (!Number.isFinite(productIdNum)) {
      toast({ title: "Product ID muss eine Zahl sein", variant: "destructive" });
      return;
    }
    setChangeLoading(true);
    setChangeResult(null);
    try {
      const data = await callAdmin({
        action: "change-product",
        licenseKey: changeLicenseKey.trim(),
        productId: productIdNum,
      });
      setChangeResult(data);
      toast({ title: "Produkt aktualisiert" });
    } catch (err) {
      toast({
        title: "Update fehlgeschlagen",
        description: err instanceof Error ? err.message : "Unbekannter Fehler",
        variant: "destructive",
      });
    } finally {
      setChangeLoading(false);
    }
  };

  return (
    <div className="pt-6 border-t border-border space-y-6">
      <div>
        <Label className="text-base">Admin Panel</Label>
        <p className="text-xs text-muted-foreground mt-1">
          Lizenzen suchen und Produkt-Zuordnung ändern.
        </p>
      </div>

      {/* Lizenz suchen */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h4 className="font-semibold text-sm uppercase tracking-wide">Lizenz suchen</h4>
        <div className="space-y-2">
          <Label htmlFor="admin-lookup-email">Email</Label>
          <Input
            id="admin-lookup-email"
            type="email"
            placeholder="user@example.com"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
          />
        </div>
        <Button onClick={handleLookup} disabled={lookupLoading} className="w-full">
          {lookupLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Search className="w-4 h-4 mr-2" />
          )}
          Suchen
        </Button>
        {lookupResult && (
          <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-64 select-text">
            {JSON.stringify(lookupResult, null, 2)}
          </pre>
        )}
      </div>

      {/* Produkt ändern */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h4 className="font-semibold text-sm uppercase tracking-wide">Produkt ändern</h4>
        <div className="space-y-2">
          <Label htmlFor="admin-change-key">License Key</Label>
          <Input
            id="admin-change-key"
            placeholder="ABC-123"
            value={changeLicenseKey}
            onChange={(e) => setChangeLicenseKey(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-change-product">Product ID</Label>
          <Input
            id="admin-change-product"
            type="number"
            placeholder="99"
            value={changeProductId}
            onChange={(e) => setChangeProductId(e.target.value)}
          />
        </div>
        <Button onClick={handleChange} disabled={changeLoading} className="w-full">
          {changeLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Produkt aktualisieren
        </Button>
        {changeResult && (
          <pre className="text-xs bg-muted/50 rounded p-2 overflow-auto max-h-64 select-text">
            {JSON.stringify(changeResult, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};
