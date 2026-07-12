/**
 * Top-Bar im Storyboard-Generator: bis zu 3 gespeicherte Storyboards.
 *
 * UX:
 *   - Karten-Reihe mit den vorhandenen Slots + ggf. ein leerer "+ Neuer Slot"-Knopf
 *   - Klick auf Slot → laden (überschreibt den Live-State)
 *   - Hover auf Slot → Schnellaktionen (Überschreiben / Umbenennen / Löschen)
 *   - Eine Karte ist visuell hervorgehoben, wenn ihr Snapshot dem Live-State
 *     entspricht (siehe `findMatchingSlot`).
 *
 * Die Komponente ruft `onLoad`/`onChange` als Hooks zurück — der Parent ist
 * dafür zuständig, den Editor-Bereich per `key`-Prop neu zu mounten, damit
 * alle `useProjectValue`-Hooks ihre Werte neu lesen.
 */

import { useState } from "react";
import { Save, FolderOpen, Plus, Pencil, Trash2, Check, X, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Menu } from "@/components/ui/Menu";
import { toast } from "sonner";
import { useProjects } from "@/hooks/useProjects";
import {
  MAX_STORYBOARD_SLOTS,
  type StoryboardSlot,
  createSlot,
  deleteSlot,
  listSlots,
  loadSlotIntoProject,
  overwriteSlot,
  renameSlot,
  getActiveSlotId,
  bumpStoryReloadVersion,
} from "@/lib/storyboardSlots";
import { cn } from "@/lib/cn";

export function StoryboardSlotsBar() {
  const { current } = useProjects();
  const projectId = current?.id ?? null;

  // Lokaler Counter zwingt Re-Render nach Mutationen (Slots leben im
  // projectStorage — der ändert sich von hier aus nicht reaktiv).
  const [, bump] = useState(0);
  const refresh = () => bump((n) => n + 1);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const slots = listSlots(projectId);
  // Persistent pointer auf den Auto-Save-Slot — bleibt stabil während der User
  // tippt (Hash-Vergleich würde flackern, weil Live-State ≠ Snapshot bis
  // Auto-Save 900ms später feuert).
  const activeId = getActiveSlotId(projectId);
  const canCreateMore = slots.length < MAX_STORYBOARD_SLOTS;

  if (!projectId) return null;

  const handleCreate = () => {
    const name = newName.trim() || `Storyboard ${slots.length + 1}`;
    const slot = createSlot(projectId, name);
    if (!slot) {
      toast.error(`Maximal ${MAX_STORYBOARD_SLOTS} Storyboards pro Projekt.`);
      return;
    }
    toast.success(`„${slot.name}" gespeichert.`);
    setCreating(false);
    setNewName("");
    refresh();
  };

  const handleLoad = (slot: StoryboardSlot) => {
    if (activeId === slot.id) return; // already loaded
    loadSlotIntoProject(projectId, slot.id);
    toast.success(`„${slot.name}" geladen.`);
    refresh();
    // Story-Hooks zum Re-Read auffordern (siehe useProjectGallery.ts)
    bumpStoryReloadVersion();
  };

  const handleOverwrite = (slot: StoryboardSlot) => {
    if (!confirm(`„${slot.name}" mit dem aktuellen Stand überschreiben?`)) return;
    overwriteSlot(projectId, slot.id);
    toast.success(`„${slot.name}" überschrieben.`);
    refresh();
  };

  const handleDelete = (slot: StoryboardSlot) => {
    if (!confirm(`„${slot.name}" wirklich löschen?`)) return;
    deleteSlot(projectId, slot.id);
    toast.success("Slot gelöscht.");
    refresh();
  };

  const startRename = (slot: StoryboardSlot) => {
    setEditingId(slot.id);
    setDraft(slot.name);
  };

  const commitRename = () => {
    if (editingId && draft.trim()) {
      renameSlot(projectId, editingId, draft.trim());
      refresh();
    }
    setEditingId(null);
    setDraft("");
  };

  return (
    <Card padded={false} className="mb-6">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-flare-300" />
            <span className="text-sm font-semibold text-ink-50">Gespeicherte Storyboards</span>
            <Badge tone="neutral" className="!text-[10px] !py-0">
              {slots.length} / {MAX_STORYBOARD_SLOTS}
            </Badge>
          </div>
          <span className="hidden sm:inline text-[11px] text-ink-50/45">
            {activeId ? "Auto-Save in den aktiven Slot · Hover für Aktionen" : "Klick lädt · Hover für Aktionen"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {slots.map((slot) => {
            const isActive = slot.id === activeId;
            const editing = editingId === slot.id;
            return (
              <div
                key={slot.id}
                className={cn(
                  "group relative rounded-2xl border transition-all overflow-hidden",
                  isActive
                    ? "border-flare-400/50 bg-flare-500/8 shadow-glow"
                    : "border-white/8 bg-ink-950/40 hover:border-flare-400/30 hover:bg-flare-500/5",
                )}
              >
                {/* Click-Layer für "Laden" — wird vom Rename-/Action-Overlay überdeckt */}
                {!editing && (
                  <button
                    type="button"
                    onClick={() => handleLoad(slot)}
                    className="absolute inset-0 z-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-flare-400/50 rounded-2xl"
                    aria-label={`„${slot.name}" laden`}
                  />
                )}

                <div className="relative z-10 p-3.5 flex items-start gap-3 pointer-events-none">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                    isActive ? "bg-flare-500/20 text-flare-300" : "bg-white/5 text-ink-50/55",
                  )}>
                    <Save className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {editing ? (
                      <div className="pointer-events-auto flex items-center gap-1">
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename();
                            if (e.key === "Escape") { setEditingId(null); setDraft(""); }
                          }}
                          className="flex-1 bg-ink-950/60 border border-flare-400/40 rounded-lg px-2 py-1 text-sm focus:outline-none"
                        />
                        <button onClick={commitRename} className="p-1 rounded hover:bg-flare-500/15 hover:text-flare-300" title="Speichern">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setEditingId(null); setDraft(""); }} className="p-1 rounded hover:bg-danger/20 hover:text-danger" title="Abbrechen">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm font-medium text-ink-50 truncate">{slot.name}</span>
                          {isActive && <Badge tone="success" className="!text-[9px] !py-0">aktiv</Badge>}
                        </div>
                        <div className="text-[11px] text-ink-50/55 flex items-center gap-1">
                          <Clock3 className="w-3 h-3" />
                          <span>{formatRelative(slot.updatedAt)}</span>
                          <span className="text-ink-50/30">·</span>
                          <span>{slot.snapshot.scenes.length} Szenen</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Aktions-Menü oben rechts — nur sichtbar bei Hover */}
                  {!editing && (
                    <div className="pointer-events-auto opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                      <Menu
                        align="right"
                        triggerClassName="p-1 rounded hover:bg-white/5"
                        // Default-min-w im Menu ist 220px — hier nicht nötig,
                        // die drei kurzen Labels passen locker in 170px.
                        popoverClassName="!min-w-[170px]"
                        trigger={<span className="text-ink-50/55 hover:text-ink-50 text-base leading-none">⋮</span>}
                      >
                        {/* Kein eigener width-Constraint mehr — Popover hat min-w-[220px],
                            der innere Inhalt soll die volle Breite füllen, sonst kleben
                            Hover-Backgrounds zu schmal in der Mitte. */}
                        <div className="py-1">
                          <MenuItem icon={<Save className="w-3.5 h-3.5" />} onClick={() => handleOverwrite(slot)}>
                            Überschreiben
                          </MenuItem>
                          <MenuItem icon={<Pencil className="w-3.5 h-3.5" />} onClick={() => startRename(slot)}>
                            Umbenennen
                          </MenuItem>
                          <MenuItem icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => handleDelete(slot)} danger>
                            Löschen
                          </MenuItem>
                        </div>
                      </Menu>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* "+ Neu"-Karte */}
          {canCreateMore && (
            <div className={cn(
              "rounded-2xl border-2 border-dashed transition-all",
              creating ? "border-flare-400/60 bg-flare-500/8" : "border-white/10 bg-ink-950/30 hover:border-flare-400/40 hover:bg-flare-500/5",
            )}>
              {creating ? (
                <div className="p-3.5 flex items-center gap-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") { setCreating(false); setNewName(""); }
                    }}
                    placeholder={`Storyboard ${slots.length + 1}`}
                    className="flex-1 bg-ink-950/60 border border-flare-400/40 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                  />
                  <button onClick={handleCreate} className="p-1.5 rounded hover:bg-flare-500/15 hover:text-flare-300" title="Speichern">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setCreating(false); setNewName(""); }} className="p-1.5 rounded hover:bg-danger/20 hover:text-danger" title="Abbrechen">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full p-3.5 flex items-center gap-3 text-left text-sm text-ink-50/65 hover:text-ink-50"
                >
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium">Aktuellen Stand speichern</div>
                    <div className="text-[11px] text-ink-50/45">Snapshot als neues Storyboard sichern</div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Voll-Hinweis statt "+ Neu"-Karte */}
          {!canCreateMore && (
            <div className="rounded-2xl border border-white/8 bg-ink-950/30 p-3.5 flex items-center gap-3 text-xs text-ink-50/55">
              <Badge tone="warn" className="!text-[9px] !py-0">Voll</Badge>
              <span>Lösche einen Slot, um Platz für ein weiteres Storyboard zu schaffen.</span>
            </div>
          )}
        </div>

        {/* Auto-Save-Statuszeile — ersetzt den früheren manuellen Save-Button. */}
        {activeId && (
          <div className="mt-3 flex justify-end items-center gap-1.5 text-[11px] text-ink-50/55">
            <Save className="w-3 h-3 text-flare-300/70" />
            <span>
              Auto-Save in „<span className="text-ink-50/85">{slots.find((s) => s.id === activeId)?.name ?? "Slot"}</span>"
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function MenuItem({ icon, onClick, children, danger }: { icon: React.ReactNode; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // w-full + justify-center: Hover-Bg deckt die ganze Popover-Breite ab,
        // Icon + Label sitzen horizontal mittig im Button.
        "w-full flex items-center justify-center gap-2 px-3 py-2 text-sm transition-colors",
        danger ? "text-danger hover:bg-danger/10" : "text-ink-50/85 hover:bg-white/5 hover:text-ink-50",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "gerade eben";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `vor ${mins} Min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `vor ${days} Tag${days === 1 ? "" : "en"}`;
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
}
