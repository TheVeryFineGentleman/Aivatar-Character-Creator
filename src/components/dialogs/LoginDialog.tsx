import { useState } from "react";
import { Mail, KeyRound, ExternalLink, ShieldCheck } from "lucide-react";
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

        {/* Dev-Login Shortcuts (wie in Projekt). Tippe die Werte selbst ein oder
            klicke einen Quick-Button. Admin ist bewusst NICHT als Knopf dabei —
            Admin-Anmeldung nur durch manuelle Eingabe von E-Mail + Lizenzschlüssel. */}
        <div className="grid grid-cols-2 gap-2 mt-1">
          <DevQuickLogin label="Basic"             hint="1 · 1"      onPick={() => { setEmail("1"); setLicenseKey("1"); }} />
          <DevQuickLogin label="Pro"               hint="2 · 2"      onPick={() => { setEmail("2"); setLicenseKey("2"); }} />
          <DevQuickLogin label="Full (Einmalkauf)" hint="4 · 4"      onPick={() => { setEmail("4"); setLicenseKey("4"); }} />
        </div>
      </div>
    </Dialog>
  );
}

function DevQuickLogin({
  label, hint, admin, onPick,
}: { label: string; hint: string; admin?: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      title={`Schnelltest-Login: ${hint}`}
      className={
        "px-2 py-2 rounded-xl border border-dashed text-[11px] inline-flex flex-col items-center gap-0.5 transition-colors " +
        (admin
          ? "border-flare-400/30 bg-flare-500/5 hover:bg-flare-500/10 text-flare-200"
          : "border-white/12 bg-white/[0.03] hover:bg-white/5 text-ink-50/75")
      }
    >
      <span className="inline-flex items-center gap-1 font-medium">
        {admin && <ShieldCheck className="w-3 h-3" />}
        {label}
      </span>
      <kbd className="font-mono text-[10px] opacity-70">{hint}</kbd>
    </button>
  );
}
