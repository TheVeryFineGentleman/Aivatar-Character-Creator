import { useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useSettings } from "@/hooks/useSettings";
import {
  disableAccountKeys,
  getAccountKeysSnapshot,
  saveAccountKeys,
  subscribeAccountKeys,
} from "@/lib/accountKeys";
import { cn } from "@/lib/cn";

/**
 * Das Häkchen unter den Key-Feldern: „Keys in meinem Konto speichern".
 *
 * Standard ist AUS. Angehakt wird erst nach einem Dialog, der sagt, was
 * gespeichert wird, wie es geschützt ist und wie man es widerruft — eine
 * Zustimmung, die man aus Versehen gibt, wäre keine. Abhaken fragt ebenfalls
 * nach und löscht die Keys im Konto.
 */
export function AccountKeysConsent() {
  const { googleKey, falKey, elevenKey } = useSettings();
  const state = useSyncExternalStore(subscribeAccountKeys, getAccountKeysSnapshot);
  const [ask, setAsk] = useState<null | "on" | "off">(null);

  const on = state.status === "on";
  const disabled = !state.available || state.busy || state.status === "unknown";

  const confirm = async () => {
    const wanted = ask;
    setAsk(null);
    if (wanted === "on") {
      const ok = await saveAccountKeys({ google: googleKey, fal: falKey, eleven: elevenKey });
      if (ok) toast.success("Keys im Konto gespeichert.", { description: "Nach dem Login sind sie in jedem Browser da." });
      else toast.error("Keys konnten nicht im Konto gespeichert werden.");
    } else {
      const ok = await disableAccountKeys();
      if (ok) toast.success("Keys aus dem Konto gelöscht.", { description: "In diesem Browser bleiben sie eingetragen." });
      else toast.error("Keys konnten nicht aus dem Konto gelöscht werden.");
    }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <button
        type="button"
        onClick={() => setAsk(on ? "off" : "on")}
        disabled={disabled}
        className={cn(
          "flex items-start gap-3 w-full text-left",
          disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-90",
        )}
      >
        <span
          className={cn(
            "mt-0.5 w-4 h-4 rounded-[5px] border flex-none flex items-center justify-center transition-colors",
            on ? "bg-flare-grad border-transparent text-pure" : "border-white/25 bg-white/5",
          )}
        >
          {state.busy ? <Loader2 className="w-3 h-3 animate-spin" /> : on ? <Check className="w-3 h-3" /> : null}
        </span>
        <span className="min-w-0">
          <span className="text-sm font-medium text-ink-50 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-flare-300" />
            Keys in meinem Konto speichern
          </span>
          <span className="block text-xs text-ink-50/55 mt-1 leading-snug">
            {state.available
              ? "Verschlüsselt in deinem Konto — dann stehen sie nach dem Login in jedem Browser. Ohne Häkchen bleiben sie nur in diesem Browser."
              : "Nur mit Konto-Login möglich. Ohne Häkchen bleiben die Keys in diesem Browser."}
          </span>
        </span>
      </button>
      {state.error && <p className="text-xs text-warn mt-2">{state.error}</p>}

      <Dialog
        open={ask !== null}
        onClose={() => setAsk(null)}
        title={ask === "off" ? "Keys aus dem Konto löschen?" : "Keys in deinem Konto speichern?"}
        subtitle={ask === "off" ? "Der Widerruf gilt sofort." : "Damit sie in jedem Browser verfügbar sind."}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAsk(null)}>Abbrechen</Button>
            <Button onClick={confirm} variant={ask === "off" ? "danger" : "primary"}>
              {ask === "off" ? "Ja, aus dem Konto löschen" : "Ja, im Konto speichern"}
            </Button>
          </div>
        }
      >
        {ask === "off" ? (
          <div className="space-y-3 text-sm text-ink-50/75">
            <p>Deine Keys werden aus deinem Konto gelöscht. In diesem Browser bleiben sie eingetragen und funktionieren weiter.</p>
            <p className="text-xs text-ink-50/55">In anderen Browsern musst du sie danach wieder selbst eintragen.</p>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-ink-50/75">
            <p>Deine API-Keys (Google, fal.ai und, falls eingetragen, ElevenLabs) werden verschlüsselt in deinem Konto auf unserem Server gespeichert.</p>
            <ul className="space-y-1.5 text-xs text-ink-50/65 list-disc pl-4">
              <li>Sie werden ausschließlich dafür benutzt, sie dir nach dem Login wieder bereitzustellen.</li>
              <li>Gespeichert wird verschlüsselt; herausgegeben werden sie nur an deinen eingeloggten Zugang.</li>
              <li>Du kannst das Häkchen jederzeit entfernen — dann werden sie im Konto gelöscht.</li>
              <li>Die Kosten deiner Keys rechnest du weiterhin direkt mit Google bzw. fal.ai ab.</li>
            </ul>
            <p className="text-xs text-ink-50/55">
              Einzelheiten stehen unter{" "}
              <Link to="/legal" className="text-flare-300 hover:text-flare-200 underline">Rechtliches</Link>{" "}
              im Abschnitt „API-Keys im Konto“.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}
