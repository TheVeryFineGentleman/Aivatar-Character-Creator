import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, RefreshCw, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getFunctionHeaders, getFunctionUrl } from "@/lib/backend";
import { useToast } from "@/hooks/use-toast";

interface AdminPanelProps {
  requesterEmail: string;
}

export const ADMIN_EMAILS = new Set(["sattelite.de@gmail.com", "1", "2", "3"]);

export const isAdminEmail = (email: string) =>
  ADMIN_EMAILS.has((email || "").trim().toLowerCase());

interface LicenseInfo {
  email?: string;
  licenseKey?: string;
  status?: string;
  productId?: number | string | null;
  planCode?: string;
  planName?: string;
}

export const AdminPanel = ({ requesterEmail }: AdminPanelProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [productIdInput, setProductIdInput] = useState("");
  const [changeLoading, setChangeLoading] = useState(false);

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
    setLicense(null);
    setNotFound(false);
    try {
      const data = await callAdmin({ action: "lookup", email: lookupEmail.trim() });
      if (data?.found && data?.license) {
        setLicense(data.license);
        setProductIdInput(
          data.license.productId != null ? String(data.license.productId) : ""
        );
      } else {
        setNotFound(true);
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
    if (!license?.licenseKey) return;
    const productIdNum = Number(productIdInput.trim());
    if (!Number.isFinite(productIdNum)) {
      toast({ title: "Product ID muss eine Zahl sein", variant: "destructive" });
      return;
    }
    setChangeLoading(true);
    try {
      const data = await callAdmin({
        action: "change-product",
        licenseKey: license.licenseKey,
        productId: productIdNum,
      });
      if (data?.updated && data?.license) {
        setLicense({ ...license, ...data.license });
        setProductIdInput(
          data.license.productId != null ? String(data.license.productId) : ""
        );
      }
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

  const currentProductIdStr = license?.productId != null ? String(license.productId) : "";
  const hasChanged = productIdInput.trim() !== "" && productIdInput.trim() !== currentProductIdStr;

  return (
    <div className="pt-6 border-t border-border">
      <div className="rounded-lg border border-border p-4 space-y-2">
        <h4 className="font-semibold text-sm uppercase tracking-wide">Admin Panel</h4>
        <p className="text-xs text-muted-foreground">
          Lizenzen suchen und Produkt-Zuordnung ändern.
        </p>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) {
              setLicense(null);
              setNotFound(false);
              setLookupEmail("");
              setProductIdInput("");
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              <Shield className="w-4 h-4 mr-2" />
              Admin Panel öffnen
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Admin Panel</DialogTitle>
              <DialogDescription>
                Lizenzen suchen und Produkt-Zuordnung ändern.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 mt-4">
              {/* Lookup */}
              <div className="space-y-2">
                <Label htmlFor="admin-lookup-email">Email der Lizenz</Label>
                <div className="flex gap-2">
                  <Input
                    id="admin-lookup-email"
                    type="email"
                    placeholder="user@example.com"
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  />
                  <Button onClick={handleLookup} disabled={lookupLoading}>
                    {lookupLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {notFound && (
                <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground text-center">
                  Keine Lizenz gefunden.
                </div>
              )}

              {license && (
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Email
                    </p>
                    <p className="text-sm font-medium select-text break-all">
                      {license.email || "—"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      License Key
                    </p>
                    <p className="text-sm font-mono select-text break-all">
                      {license.licenseKey || "—"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Status
                    </p>
                    <p className="text-sm font-medium select-text">
                      {license.status || "—"}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Plan
                    </p>
                    <p className="text-sm font-medium select-text">
                      {license.planName || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground select-text">
                      Code: {license.planCode || "—"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-product-id" className="text-xs uppercase tracking-wide text-muted-foreground">
                      Product ID
                    </Label>
                    <Input
                      id="admin-product-id"
                      type="number"
                      value={productIdInput}
                      onChange={(e) => setProductIdInput(e.target.value)}
                      className="font-mono"
                    />
                  </div>

                  <Button
                    onClick={handleChange}
                    disabled={!hasChanged || changeLoading}
                    className="w-full"
                  >
                    {changeLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Produkt updaten
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
