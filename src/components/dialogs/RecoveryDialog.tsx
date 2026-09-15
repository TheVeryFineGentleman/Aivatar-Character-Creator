import { useEffect, useRef, useState } from "react";
import { ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { claimRecovery, fetchRecoveries, type RecoveryItem } from "@/lib/recovery";
import { describeProject, importBundle, summarizeImport } from "@/lib/projectTransfer";

/**
 * Bietet nach dem Login an, vom Support wiederhergestellte Projekte zu übernehmen.
 *
 * Nie automatisch: der Kunde entscheidet, und nichts Vorhandenes wird
 * überschrieben (siehe `importBundle`). Als erledigt gemeldet (claim) wird die
 * Sicherung erst, wenn alles angekommen ist — sonst kommt das Angebot beim
 * nächsten Login wieder, statt still verloren zu gehen.
 */
export function RecoveryPrompt() {
  const { license } = useAuth();
  const { quota, switchTo, refresh } = useProjects();
  const token = license?.valid ? license.sessionToken : undefined;
  const [items, setItems] = useState<RecoveryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const checkedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!token || checkedFor.current === token) return;
    checkedFor.current = token;
    fetchRecoveries(token)
      .then(setItems)
      .catch((err) => console.warn("[recovery]", err?.message || err));
  }, [token]);

  const item = items[0];
  if (!item || !token) return null;

  // „Später" nimmt das Angebot nur für diese Sitzung weg.
  const next = () => setItems((cur) => cur.slice(1));

  const accept = async () => {
    setBusy(true);
    try {
      const res = importBundle(item.bundle, quota.projectLimit);
      if (res.imported[0]) switchTo(res.imported[0].id);
      else refresh();
      const complete = res.skipped.every((s) => s.reason === "exists");
      if (complete) {
        try { await claimRecovery(token, item.id); }
        catch (err: any) { console.warn("[recovery] claim:", err?.message || err); }
      }
      const msg = summarizeImport(res);
      if (complete) toast.success(msg.title, { description: msg.description });
      else toast.error(msg.title, { description: msg.description });
      next();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={next}
      closeOnBackdrop={false}
      title="Deine Projekte sind wieder da"
      subtitle={item.label}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={next} disabled={busy}>Später</Button>
          <Button onClick={accept} loading={busy} iconLeft={<ArchiveRestore className="w-4 h-4" />}>
            In die App übernehmen
          </Button>
        </div>
      }
    >
      <p className="text-sm text-ink-50/70 leading-relaxed">
        Unser Support hat diese Projekte für dich wiederhergestellt. Sie kommen zu deinen jetzigen
        Projekten dazu — überschrieben wird nichts.
      </p>
      <ul className="mt-4 space-y-2">
        {item.bundle.projects.map((p) => {
          const d = describeProject(p.state);
          const facts = [
            d.scenes ? `${d.scenes} Szenen` : "",
            d.videos ? `${d.videos} Videos` : "",
            d.images ? `${d.images} Bilder` : "",
          ].filter(Boolean).join(" · ");
          return (
            <li key={p.meta.id} className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <div className="text-sm font-medium text-ink-50">{p.meta.name}</div>
              {facts && <div className="text-xs text-ink-50/55 mt-0.5">{facts}</div>}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-ink-50/45 mt-4">„Später" fragt beim nächsten Login wieder.</p>
    </Dialog>
  );
}
