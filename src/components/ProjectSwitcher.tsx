import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2, FolderOpen, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ProjectMeta,
  MAX_PROJECTS,
  listProjects,
  createProject,
  deleteProject,
  isStorageReady,
} from "@/lib/projectStorage";

interface ProjectSwitcherProps {
  email: string;
  activeProjectId: string | null;
  onSwitchProject: (projectId: string | null) => void | Promise<void>;
  onProjectsChanged?: (projects: ProjectMeta[]) => void;
}

export const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({
  email,
  activeProjectId,
  onSwitchProject,
  onProjectsChanged,
}) => {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<ProjectMeta | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initial load + when email changes.
  useEffect(() => {
    if (!email) {
      setProjects([]);
      return;
    }
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listProjects(email);
      setProjects(list);
      onProjectsChanged?.(list);
    } catch (err: any) {
      setError(err?.message || "Konnte Projekte nicht laden");
    } finally {
      setLoading(false);
    }
  };

  // Close dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open]);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;
  const canCreateMore = projects.length < MAX_PROJECTS;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const meta = await createProject(email, newName.trim());
      setNewName("");
      setShowCreateModal(false);
      await refresh();
      await onSwitchProject(meta.id);
    } catch (err: any) {
      setError(err?.message || "Konnte Projekt nicht anlegen");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (project: ProjectMeta) => {
    setConfirmDelete(null);
    setLoading(true);
    setError(null);
    try {
      await deleteProject(email, project.id);
      if (activeProjectId === project.id) {
        await onSwitchProject(null);
      }
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Löschen fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-background/80 backdrop-blur-sm border border-border/60",
            "hover:bg-background hover:border-primary/40 transition-colors",
            "max-w-[220px]"
          )}
        >
          <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">
            {activeProject ? activeProject.name : "Kein Projekt"}
          </span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-2 w-72 rounded-lg border border-border/60 bg-background/95 backdrop-blur-md shadow-xl z-30 overflow-hidden">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40 flex items-center justify-between">
              <span>Projekte ({projects.length}/{MAX_PROJECTS})</span>
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>

            {!isStorageReady() && (
              <div className="px-3 py-3 text-[11px] text-amber-500 bg-amber-500/10 border-b border-amber-500/30">
                ⚠️ DO Spaces nicht konfiguriert. Trage <code className="font-mono">VITE_DO_SPACES_SECRET</code> in <code className="font-mono">.env</code> ein und starte den Dev-Server neu.
              </div>
            )}

            {projects.length === 0 && !loading && isStorageReady() && (
              <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                Noch keine Projekte
              </div>
            )}

            {projects.map((p) => {
              const isActive = p.id === activeProjectId;
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm group hover:bg-muted/40",
                    isActive && "bg-primary/10"
                  )}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      setOpen(false);
                      if (!isActive) await onSwitchProject(p.id);
                    }}
                    className="flex-1 text-left flex items-center gap-2 min-w-0"
                  >
                    {isActive ? (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{p.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(p)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20 text-destructive"
                    title="Projekt löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              disabled={!canCreateMore}
              onClick={() => {
                setOpen(false);
                setShowCreateModal(true);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm border-t border-border/40",
                canCreateMore
                  ? "hover:bg-primary/10 text-primary"
                  : "text-muted-foreground/60 cursor-not-allowed"
              )}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {canCreateMore ? "Neues Projekt" : `Maximum (${MAX_PROJECTS}) erreicht`}
              </span>
            </button>

            {error && (
              <div className="px-3 py-2 text-[11px] text-destructive bg-destructive/10 border-t border-destructive/20">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
          onClick={() => !creating && setShowCreateModal(false)}
        >
          <div
            className="w-[90%] max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-1">Neues Projekt</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Gib einen Namen ein. Du kannst maximal {MAX_PROJECTS} Projekte anlegen.
            </p>
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim() && !creating) handleCreate();
                if (e.key === "Escape" && !creating) setShowCreateModal(false);
              }}
              placeholder="z.B. 'Sommer-Reel' oder 'Promo Q3'"
              maxLength={40}
              className={cn(
                "w-full px-3 py-2 rounded-lg bg-background border border-border",
                "focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary",
                "text-sm"
              )}
            />
            {error && (
              <div className="mt-3 p-2 rounded text-xs text-destructive bg-destructive/10 border border-destructive/20">
                {error}
              </div>
            )}
            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                disabled={creating}
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted/40 disabled:opacity-50"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={creating || !newName.trim()}
                onClick={handleCreate}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground",
                  "hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center gap-2"
                )}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Anlegen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="w-[90%] max-w-md rounded-xl border border-destructive/40 bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2">Projekt löschen?</h3>
            <p className="text-sm text-muted-foreground mb-1">
              <span className="font-medium text-foreground">"{confirmDelete.name}"</span> wird
              komplett gelöscht — inklusive aller Referenzbilder, generierten Bilder und Videos.
            </p>
            <p className="text-xs text-destructive mt-2">Diese Aktion kann nicht rückgängig gemacht werden.</p>
            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-muted/40"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 rounded-lg text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Endgültig löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
