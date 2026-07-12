/**
 * Project context — single source of truth for the active project.
 * Wraps lib/projectStorage with React state so the UI re-renders on switches.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  type ProjectMeta,
  createProject,
  deleteProject,
  ensureProject,
  getCurrentProjectId,
  getStorageQuota,
  listProjects,
  renameProject,
  setCurrentProjectId,
  type StorageQuota,
} from "@/lib/projectStorage";
import { KEYS, ls } from "@/lib/storage";
import { useAuth } from "@/hooks/useAuth";
import { deleteProjectAssets } from "@/lib/projectAssets";

interface ProjectsValue {
  projects: ProjectMeta[];
  current: ProjectMeta | null;
  quota: StorageQuota;
  hasAddon: boolean;
  switchTo: (id: string) => void;
  create: (name: string) => ProjectMeta | null;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
  refresh: () => void;
  canCreateMore: boolean;
}

const ProjectsContext = createContext<ProjectsValue | null>(null);

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { credentials } = useAuth();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  // Ensure we always have an active project.
  useEffect(() => { ensureProject(); refresh(); }, [refresh]);

  const hasAddon = !!ls.get<boolean>(KEYS.STORAGE_ADDON);

  const projects = useMemo(() => listProjects(), [tick]);
  const currentId = useMemo(() => getCurrentProjectId(), [tick]);
  const current = useMemo(() => projects.find((p) => p.id === currentId) ?? projects[0] ?? null, [projects, currentId]);
  const quota = useMemo(() => getStorageQuota(hasAddon), [tick, hasAddon]);

  const switchTo = useCallback((id: string) => {
    setCurrentProjectId(id);
    refresh();
  }, [refresh]);

  const create = useCallback((name: string): ProjectMeta | null => {
    const q = getStorageQuota(hasAddon);
    if (q.projectsUsed >= q.projectLimit) return null;
    const meta = createProject(name);
    refresh();
    return meta;
  }, [hasAddon, refresh]);

  const rename = useCallback((id: string, name: string) => {
    renameProject(id, name);
    refresh();
  }, [refresh]);

  const remove = useCallback((id: string) => {
    deleteProject(id);
    void deleteProjectAssets(credentials?.email ?? "", id);
    refresh();
  }, [refresh, credentials]);

  const canCreateMore = quota.projectsUsed < quota.projectLimit;

  const value = useMemo<ProjectsValue>(() => ({
    projects, current, quota, hasAddon,
    switchTo, create, rename, remove, refresh,
    canCreateMore,
  }), [projects, current, quota, hasAddon, switchTo, create, rename, remove, refresh, canCreateMore]);

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within ProjectsProvider");
  return ctx;
}
