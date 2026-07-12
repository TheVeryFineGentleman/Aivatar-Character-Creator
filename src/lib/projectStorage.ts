/**
 * Project management — keeps each project's app state under its own namespaced key
 * so users can switch between named projects without losing state.
 *
 * Storage backend is localStorage by default (browser-only, no DigitalOcean Spaces calls).
 * Future: swap to S3 by hot-swapping `readProjectData` / `writeProjectData`.
 */

import { KEYS, ls } from "@/lib/storage";
import { uid } from "@/lib/uid";

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  sizeBytes: number;
}

export interface ProjectData {
  meta: ProjectMeta;
  state: unknown; // free-form app state per page
}

const GB = 1024 ** 3;

export const STORAGE_FREE = {
  bytes: 3 * GB,
  projects: 3,
};

export const STORAGE_ADDON = {
  bytes: 25 * GB,
  projects: 3,
};

/** Effective limits — addon replaces (not adds to) free. */
export function effectiveLimits(hasAddon: boolean) {
  return hasAddon ? STORAGE_ADDON : STORAGE_FREE;
}

/** List all projects (sorted by modifiedAt desc). */
export function listProjects(): ProjectMeta[] {
  const idx = ls.get<ProjectMeta[]>(KEYS.PROJECTS_INDEX, []) || [];
  return [...idx].sort((a, b) => b.modifiedAt - a.modifiedAt);
}

function writeIndex(items: ProjectMeta[]) {
  ls.set(KEYS.PROJECTS_INDEX, items);
}

export function getCurrentProjectId(): string | null {
  return ls.get<string>(KEYS.CURRENT_PROJECT);
}

export function setCurrentProjectId(id: string | null) {
  if (id) ls.set(KEYS.CURRENT_PROJECT, id);
  else ls.remove(KEYS.CURRENT_PROJECT);
}

/** Create a fresh project. Returns its meta. */
export function createProject(name: string): ProjectMeta {
  const id = uid();
  const now = Date.now();
  const meta: ProjectMeta = {
    id,
    name: name.trim() || "Unbenanntes Projekt",
    createdAt: now,
    modifiedAt: now,
    sizeBytes: 0,
  };
  const items = listProjects();
  items.unshift(meta);
  writeIndex(items);
  ls.set(KEYS.PROJECT_PREFIX + id, { meta, state: {} } satisfies ProjectData);
  setCurrentProjectId(id);
  return meta;
}

export function renameProject(id: string, newName: string): void {
  const items = listProjects();
  const next = items.map((p) => (p.id === id ? { ...p, name: newName.trim() || p.name, modifiedAt: Date.now() } : p));
  writeIndex(next);
  const data = ls.get<ProjectData>(KEYS.PROJECT_PREFIX + id);
  if (data) {
    data.meta = { ...data.meta, name: newName.trim() || data.meta.name, modifiedAt: Date.now() };
    ls.set(KEYS.PROJECT_PREFIX + id, data);
  }
}

export function deleteProject(id: string): void {
  const items = listProjects().filter((p) => p.id !== id);
  writeIndex(items);
  ls.remove(KEYS.PROJECT_PREFIX + id);
  if (getCurrentProjectId() === id) {
    setCurrentProjectId(items[0]?.id ?? null);
  }
}

export function loadProject(id: string): ProjectData | null {
  return ls.get<ProjectData>(KEYS.PROJECT_PREFIX + id);
}

export function saveProjectState(id: string, state: unknown): void {
  const data = loadProject(id);
  if (!data) return;
  const json = JSON.stringify(state);
  const next: ProjectData = {
    meta: { ...data.meta, modifiedAt: Date.now(), sizeBytes: json.length * 2 },
    state,
  };
  ls.set(KEYS.PROJECT_PREFIX + id, next);
  // bubble updated meta into index
  const idx = listProjects().map((p) => (p.id === id ? next.meta : p));
  writeIndex(idx);
}

/** Ensure there is always at least one project; returns its meta. */
export function ensureProject(): ProjectMeta {
  let items = listProjects();
  let currentId = getCurrentProjectId();
  if (!items.length) {
    return createProject("Mein erstes Projekt");
  }
  if (!currentId || !items.find((p) => p.id === currentId)) {
    setCurrentProjectId(items[0].id);
    currentId = items[0].id;
  }
  return items.find((p) => p.id === currentId) ?? items[0];
}

export interface StorageQuota {
  usedBytes: number;
  limitBytes: number;
  projectsUsed: number;
  projectLimit: number;
  percentUsed: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
  hasAddon: boolean;
}

export function getStorageQuota(hasAddon = false): StorageQuota {
  const limits = effectiveLimits(hasAddon);
  const usedBytes = ls.usedBytes();
  const projectsUsed = listProjects().length;
  const percentUsed = limits.bytes > 0 ? Math.min(100, (usedBytes / limits.bytes) * 100) : 0;
  return {
    usedBytes,
    limitBytes: limits.bytes,
    projectsUsed,
    projectLimit: limits.projects,
    percentUsed,
    isOverLimit: usedBytes >= limits.bytes || projectsUsed > limits.projects,
    isNearLimit: percentUsed >= 80,
    hasAddon,
  };
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(decimals)} ${units[i]}`;
}
