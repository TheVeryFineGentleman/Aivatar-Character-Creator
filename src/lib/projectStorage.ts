// Project save/load via DigitalOcean Spaces (S3-compatible).
// Each user has up to MAX_PROJECTS named projects. Each project stores:
//   - state.json (full app state snapshot)
//   - refs/{uuid}.{ext}       (reference images)
//   - generated/{uuid}.{ext}  (AI-generated images)
//   - videos/{uuid}.{ext}     (rendered videos)
//
// User scoping: paths are prefixed with sha-1(email).slice(0,12).

import {
  putJson,
  getJson,
  putObject,
  deleteObject,
  deletePrefix,
  publicUrl,
  keyFromPublicUrl,
  isConfigured,
  SPACES_PUBLIC_BASE,
} from "@/lib/doSpaces";

export const PROJECT_PREFIX = "aivatar-projects";
export const MAX_PROJECTS = 3;

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectState extends ProjectMeta {
  data: Record<string, any>;
}

export function isStorageReady(): boolean {
  return isConfigured();
}

// ============================================================
// USER NAMESPACE
// ============================================================

async function userPrefix(email: string): Promise<string> {
  if (!email) return "anon";
  try {
    const encoder = new TextEncoder();
    const buf = await crypto.subtle.digest("SHA-1", encoder.encode(email.trim().toLowerCase()));
    const arr = Array.from(new Uint8Array(buf));
    return arr.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 12);
  } catch {
    return email.replace(/[^a-z0-9]/gi, "_").slice(0, 32) || "anon";
  }
}

function projectKey(prefix: string, projectId: string, sub = ""): string {
  const base = `${PROJECT_PREFIX}/${prefix}/${projectId}`;
  return sub ? `${base}/${sub}` : base;
}

function indexKey(prefix: string): string {
  return `${PROJECT_PREFIX}/${prefix}/index.json`;
}

// ============================================================
// PROJECT INDEX
// ============================================================

export async function listProjects(email: string): Promise<ProjectMeta[]> {
  if (!isConfigured()) return [];
  const prefix = await userPrefix(email);
  const idx = await getJson<ProjectMeta[]>(indexKey(prefix));
  return Array.isArray(idx) ? idx : [];
}

async function writeIndex(prefix: string, projects: ProjectMeta[]): Promise<void> {
  await putJson(indexKey(prefix), projects, /* isPublic */ false);
}

export async function createProject(email: string, name: string): Promise<ProjectMeta> {
  if (!isConfigured()) throw new Error("DO Spaces nicht konfiguriert.");
  const prefix = await userPrefix(email);
  const projects = (await getJson<ProjectMeta[]>(indexKey(prefix))) || [];
  if (projects.length >= MAX_PROJECTS) {
    throw new Error(`Maximal ${MAX_PROJECTS} Projekte erlaubt.`);
  }
  const meta: ProjectMeta = {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Neues Projekt",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  projects.push(meta);
  await writeIndex(prefix, projects);
  await putJson(projectKey(prefix, meta.id, "state.json"), { ...meta, data: {} }, /* isPublic */ false);
  return meta;
}

export async function renameProject(email: string, projectId: string, newName: string): Promise<void> {
  const prefix = await userPrefix(email);
  const projects = (await getJson<ProjectMeta[]>(indexKey(prefix))) || [];
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx === -1) return;
  projects[idx].name = newName.trim() || projects[idx].name;
  projects[idx].updatedAt = new Date().toISOString();
  await writeIndex(prefix, projects);
}

export async function deleteProject(email: string, projectId: string): Promise<void> {
  const prefix = await userPrefix(email);
  // Delete every object under the project's prefix (state.json + assets).
  await deletePrefix(projectKey(prefix, projectId, ""));
  const projects = (await getJson<ProjectMeta[]>(indexKey(prefix))) || [];
  const filtered = projects.filter((p) => p.id !== projectId);
  await writeIndex(prefix, filtered);
}

// ============================================================
// PROJECT STATE
// ============================================================

export async function loadProjectState(email: string, projectId: string): Promise<ProjectState | null> {
  if (!isConfigured()) return null;
  const prefix = await userPrefix(email);
  return getJson<ProjectState>(projectKey(prefix, projectId, "state.json"));
}

export async function saveProjectState(
  email: string,
  projectId: string,
  data: Record<string, any>,
  nameOverride?: string
): Promise<void> {
  if (!isConfigured()) return;
  const prefix = await userPrefix(email);
  const projects = (await getJson<ProjectMeta[]>(indexKey(prefix))) || [];
  const meta = projects.find((p) => p.id === projectId);
  if (!meta) throw new Error(`Projekt nicht gefunden: ${projectId}`);

  meta.updatedAt = new Date().toISOString();
  if (nameOverride) meta.name = nameOverride;
  await writeIndex(prefix, projects);

  const state: ProjectState = { ...meta, data };
  await putJson(projectKey(prefix, projectId, "state.json"), state, /* isPublic */ false);
}

// ============================================================
// IMAGE / VIDEO BLOB UPLOAD
// ============================================================

export type AssetKind = "refs" | "generated" | "videos";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export async function uploadAsset(
  email: string,
  projectId: string,
  kind: AssetKind,
  source: Blob | string // Blob, data URL, or remote URL
): Promise<string> {
  if (!isConfigured()) throw new Error("DO Spaces nicht konfiguriert.");
  const prefix = await userPrefix(email);
  let blob: Blob;
  if (typeof source === "string") {
    if (source.startsWith("data:")) {
      const match = source.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error("Ungültige data URL");
      const mime = match[1];
      const bin = atob(match[2]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      blob = new Blob([bytes], { type: mime });
    } else {
      const resp = await fetch(source);
      if (!resp.ok) throw new Error(`Download fehlgeschlagen: ${resp.status}`);
      blob = await resp.blob();
    }
  } else {
    blob = source;
  }
  const ext = EXT_BY_MIME[blob.type] || "bin";
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const key = projectKey(prefix, projectId, `${kind}/${id}.${ext}`);
  return putObject(key, blob, blob.type, /* public */ true);
}

export async function deleteAssetByUrl(url: string): Promise<void> {
  if (!isConfigured()) return;
  if (!url.startsWith(SPACES_PUBLIC_BASE)) return;
  const key = keyFromPublicUrl(url);
  if (!key) return;
  try {
    await deleteObject(key);
  } catch (err: any) {
    console.warn("[projectStorage] deleteAssetByUrl failed:", err?.message);
  }
}

// ============================================================
// LOCAL STORAGE: which project is active right now
// ============================================================

const ACTIVE_PROJECT_KEY = "aivatar_active_project";

export function getActiveProjectId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function setActiveProjectId(projectId: string | null): void {
  try {
    if (projectId) localStorage.setItem(ACTIVE_PROJECT_KEY, projectId);
    else localStorage.removeItem(ACTIVE_PROJECT_KEY);
  } catch {}
}
