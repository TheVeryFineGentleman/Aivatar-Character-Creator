import { useState } from "react";
import { Mail, KeyRound, ExternalLink } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { BACKEND, SUPA_FUNC } from "@/lib/backend";
import { toast } from "sonner";

export function LoginDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signIn, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [remindLoading, setRemindLoading] = useState(false);

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

  // "Key vergessen?" — löst über die Edge Function `license-remind` eine
  // Erinnerungs-Mail mit dem aktuellen Lizenzschlüssel aus. Die Function
  // injiziert serverseitig den toolApiKey; das Tool braucht nur die E-Mail.
  const handleRemind = async () => {
    const mail = email.trim();
    if (!mail) {
      toast.error("Bitte zuerst deine E-Mail-Adresse eingeben.");
      return;
    }
    setRemindLoading(true);
    try {
      const res = await fetch(SUPA_FUNC("license-remind"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(BACKEND.supabaseAnonKey ? { Authorization: `Bearer ${BACKEND.supabaseAnonKey}` } : {}),
        },
        body: JSON.stringify({ email: mail }),
      });
      let data: any = null;
      try { data = await res.json(); } catch { /* noop */ }

      if (res.ok && data?.sent) {
        toast.success("Erledigt — wir haben dir deinen Lizenzschlüssel per E-Mail geschickt. Schau ggf. auch im Spam-Ordner nach.");
        return;
      }

      const reasons: Record<string, string> = {
        USER_NOT_FOUND: "Zu dieser E-Mail konnten wir keinen Zugang finden. Nutze die E-Mail aus deiner Bestellbestätigung.",
        ACTIVE_LICENSE_NOT_FOUND: "Wir haben keine aktive Lizenz zu dieser E-Mail gefunden.",
        INVALID_TOOL_API_KEY: "Dienst gerade nicht verfügbar. Bitte später erneut versuchen.",
        MAIL_SENDING_FAILED: "E-Mail konnte nicht versendet werden. Bitte später erneut versuchen.",
      };
      toast.error(reasons[data?.reason] || "Konnte die Erinnerung nicht senden. Bitte später erneut versuchen.");
    } catch {
      toast.error("Netzwerkfehler — bitte später erneut versuchen.");
    } finally {
      setRemindLoading(false);
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
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleRemind}
            disabled={remindLoading}
            className="text-xs text-ink-50/55 hover:text-flare-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {remindLoading ? "Sende E-Mail…" : "Key vergessen?"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
