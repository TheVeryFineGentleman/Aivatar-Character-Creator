/**
 * Support-Wiederherstellung: vom Support abgelegte Projektsicherungen, die der
 * Kunde beim Login in seine App übernehmen kann (siehe `RecoveryPrompt`).
 *
 * Abgefragt wird mit dem Sitzungs-Token aus der Lizenzprüfung — die E-Mail
 * nimmt der Server ausschließlich aus dem Token, nie aus der Anfrage. Sonst
 * könnte jeder mit einer fremden Adresse fremde Projekte abholen.
 */
import { API } from "@/lib/backend";
import { validateBundle, type ProjectBundle } from "@/lib/projectTransfer";

export interface RecoveryItem {
  id: number;
  label: string;
  createdAt: string;
  bundle: ProjectBundle;
}

export async function fetchRecoveries(token: string): Promise<RecoveryItem[]> {
  const res = await fetch(API("/api/recovery"), { headers: { Authorization: `Bearer ${token}` } });
  // Ein Server ohne diese Route (älterer Stand) ist kein Fehler — dann gibt es eben nichts.
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Wiederherstellung nicht abrufbar (${res.status}).`);
  const data = (await res.json()) as { items?: unknown[] };
  const out: RecoveryItem[] = [];
  for (const raw of data.items ?? []) {
    const it = raw as { id?: unknown; label?: unknown; createdAt?: unknown; bundle?: unknown };
    try {
      out.push({
        id: Number(it.id),
        label: String(it.label || "Wiederherstellung"),
        createdAt: String(it.createdAt || ""),
        bundle: validateBundle(it.bundle),
      });
    } catch { /* unlesbare Sicherung — überspringen statt die anderen zu blockieren */ }
  }
  return out;
}

export async function claimRecovery(token: string, id: number): Promise<void> {
  const res = await fetch(API("/api/recovery/claim"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(`Bestätigen fehlgeschlagen (${res.status}).`);
}
