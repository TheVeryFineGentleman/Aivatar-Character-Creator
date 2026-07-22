import { useState } from "react";
import { Mail, KeyRound, ExternalLink } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [licenseKey, setLicenseKey] = useState("");

  const handle = async () => {
    if (!email.trim() || !licenseKey.trim()) {
      toast.error("Bitte E-Mail und Lizenzschlüssel angeben.");
      return;
    }
    const ok = await signIn({ email: email.trim(), licenseKey: licenseKey.trim() });
    if (ok) {
      toast.success("Angemeldet — willkommen zurück.");
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Anmelden"
      subtitle="Mit Lizenzschlüssel & E-Mail aus deiner Bestellbestätigung."
      size="md"
      footer={
        <div className="flex items-center justify-between gap-3">
          <a
            href="https://www.digistore24.com/product/644591"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-ink-50/55 hover:text-flare-300 inline-flex items-center gap-1"
          >
            Noch kein Konto? Plan kaufen <ExternalLink className="w-3 h-3" />
          </a>
          <Button onClick={handle} loading={loading}>Einloggen</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="E-Mail-Adresse"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="du@beispiel.de"
          iconLeft={<Mail className="w-4 h-4" />}
        />
        <Input
          label="Lizenzschlüssel"
          value={licenseKey}
          onChange={(e) => setLicenseKey(e.target.value)}
          placeholder="AIVTR-XXXX-XXXX-XXXX"
          iconLeft={<KeyRound className="w-4 h-4" />}
          autoComplete="off"
          hint="Findest du in deiner Bestätigungs-Mail."
          error={error || undefined}
        />
      </div>
    </Dialog>
  );
}
