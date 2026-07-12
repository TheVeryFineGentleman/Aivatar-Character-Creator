/**
 * TopBar widget — switch between projects, rename or delete, create a new one.
 * Closes the popover after each destructive/navigation action.
 */
import { useState } from "react";
import { Folder, FolderPlus, ChevronDown, Check, Pencil, Trash2, Loader2, X } from "lucide-react";
import { Menu, MenuDivider, MenuSection } from "@/components/ui/Menu";
import { Badge } from "@/components/ui/Badge";
import { useProjects } from "@/hooks/useProjects";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

export function ProjectSwitcher() {
  const { projects, current, switchTo, create, rename, remove, canCreateMore, quota } = useProjects();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  if (!current) return null;

  const startEdit = (id: string, name: string) => {
    setEditingId(id);
    setDraft(name);
  };

  const commitEdit = () => {
    if (editingId && draft.trim()) {
      rename(editingId, draft.trim());
      toast.success("Projekt umbenannt.");
    }
    setEditingId(null);
    setDraft("");
  };

  const handleDelete = (id: string, name: string) => {
    if (projects.length <= 1) {
      toast.error("Mindestens ein Projekt muss bestehen bleiben.");
      return;
    }
    if (!confirm(`„${name}" wirklich löschen? Alle Daten gehen verloren.`)) return;
    remove(id);
    toast.success("Projekt gelöscht.");
  };

  const handleCreate = () => {
    const name = newName.trim() || `Projekt ${projects.length + 1}`;
    const meta = create(name);
    if (!meta) {
      toast.error(`Projekt-Limit erreicht (${quota.projectLimit}). Upgrade auf 25 GB für mehr Slots.`);
      return;
    }
    toast.success(`„${meta.name}" erstellt.`);
    setNewName("");
    setCreating(false);
  };

  return (
    <Menu
      align="left"
      triggerClassName="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5 transition-colors max-w-[200px]"
      trigger={
        <>
          <Folder className="w-3.5 h-3.5 text-flare-300 flex-shrink-0" />
          <span className="text-sm font-medium truncate">{current.name}</span>
          <ChevronDown className="w-3.5 h-3.5 text-ink-50/55 flex-shrink-0" />
        </>
      }
    >
      <div className="w-72">
        <div className="px-3.5 py-2.5 border-b border-white/5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-ink-50/45 font-medium">Projekte</span>
          <Badge tone="neutral" className="!text-[9px] !py-0">
            {quota.projectsUsed} / {quota.projectLimit}
          </Badge>
        </div>

        <MenuSection>
          <div className="max-h-72 overflow-y-auto">
            {projects.map((p) => {
              const active = p.id === current.id;
              const editing = editingId === p.id;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "group flex items-center gap-2 px-3.5 py-2 hover:bg-white/5 transition-colors",
                    active && "bg-white/3",
                  )}
                >
                  {editing ? (
                    <>
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") { setEditingId(null); setDraft(""); }
                        }}
                        className="flex-1 bg-ink-950/60 border border-white/10 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-flare-400/50"
                      />
                      <button onClick={commitEdit} className="p-1 hover:text-flare-300" title="Speichern">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setEditingId(null); setDraft(""); }} className="p-1 hover:text-danger" title="Abbrechen">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => switchTo(p.id)} className="flex-1 flex items-center gap-2 text-left text-sm min-w-0">
                        <Folder className={cn("w-3.5 h-3.5 flex-shrink-0", active ? "text-flare-300" : "text-ink-50/55")} />
                        <span className={cn("truncate", active ? "text-ink-50" : "text-ink-50/80")}>{p.name}</span>
                        {active && <Check className="w-3 h-3 text-flare-300 flex-shrink-0" />}
                      </button>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                        <button onClick={() => startEdit(p.id, p.name)} className="p-1 rounded hover:bg-white/5 hover:text-flare-300" title="Umbenennen">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDelete(p.id, p.name)} className="p-1 rounded hover:bg-white/5 hover:text-danger" title="Löschen" disabled={projects.length <= 1}>
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </MenuSection>

        <MenuDivider />

        {creating ? (
          <div className="px-3.5 py-2.5 flex items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") { setCreating(false); setNewName(""); }
              }}
              placeholder="Projektname"
              className="flex-1 bg-ink-950/60 border border-white/10 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-flare-400/50"
            />
            <button onClick={handleCreate} className="p-1.5 rounded hover:bg-white/5 hover:text-flare-300">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => { setCreating(false); setNewName(""); }} className="p-1.5 rounded hover:bg-white/5 hover:text-danger">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => canCreateMore ? setCreating(true) : toast.error(`Projekt-Limit erreicht (${quota.projectLimit}).`)}
            disabled={!canCreateMore}
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-left transition-colors",
              canCreateMore
                ? "text-ink-50/85 hover:bg-white/5 hover:text-ink-50"
                : "text-ink-50/35 cursor-not-allowed",
            )}
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4 text-flare-300" />}
            Neues Projekt
            {!canCreateMore && <Badge tone="warn" className="!text-[9px] !py-0 ml-auto">Limit</Badge>}
          </button>
        )}
      </div>
    </Menu>
  );
}
