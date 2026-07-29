/**
 * Per-project persistence, scoped to the active project.
 *
 * Split (Projekt-style): IMAGES & VIDEOS go to DigitalOcean Spaces and we keep
 * only their public URLs; TEXT / inputs / metadata stay in localStorage.
 *
 * - useProjectValue   — any JSON-serializable input (localStorage)
 * - useProjectGallery — generated galleries (media → Spaces, URLs → localStorage)
 * - useProjectRefImages — uploaded reference images (→ Spaces; base64 rehydrated on load)
 * - useProjectResults — positional grids (Views/Poses) (media → Spaces)
 *
 * Everything degrades gracefully when Spaces isn't configured: media simply
 * isn't persisted (text still is), and nothing crashes.
 */

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { loadProject, saveProjectState } from "@/lib/projectStorage";
import { uploadAsset, spacesConfigured } from "@/lib/projectAssets";
import { urlToBase64 } from "@/lib/image";
import { useStoryReloadVersion } from "@/lib/storyboardSlots";
import type { ImageSlotData } from "@/components/ImageSlot";
import type { RefImage } from "@/components/ImageDropZone";

type Slots = ImageSlotData[];
interface SlotMeta { id: string; url?: string; prompt?: string; filename?: string }
const isData = (s?: string) => !!s && s.startsWith("data:");

// ───────────────────────────────────────────────────────────────────────────
// Generated galleries (Studio / Quick / Chat)
// ───────────────────────────────────────────────────────────────────────────

export function useProjectGallery(pageKey: string): [Slots, Dispatch<SetStateAction<Slots>>, boolean] {
  const { current } = useProjects();
  const { credentials } = useAuth();
  const projectId = current?.id ?? null;
  const email = credentials?.email ?? "";

  const [slots, setSlots] = useState<Slots>([]);
  const [hydrated, setHydrated] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const inflight = useRef<Set<string>>(new Set());

  // Load (metadata holds the durable URLs).
  useEffect(() => {
    if (!projectId) { setSlots([]); setHydrated(true); loadedFor.current = null; return; }
    setHydrated(false);
    const state = (loadProject(projectId)?.state ?? {}) as { galleries?: Record<string, SlotMeta[]> };
    const metas = Array.isArray(state.galleries?.[pageKey]) ? state.galleries![pageKey] : [];
    setSlots(metas.filter((m) => m.url).map((m) => ({
      id: m.id, status: "done", dataUrl: m.url, prompt: m.prompt, filename: m.filename,
    })));
    loadedFor.current = projectId;
    setHydrated(true);
  }, [projectId, pageKey]);

  // Upload freshly-generated base64 images to Spaces, then persist URL metadata.
  useEffect(() => {
    if (!projectId || !hydrated || loadedFor.current !== projectId) return;
    const done = slots.filter((s) => s.status === "done" && s.dataUrl);

    if (spacesConfigured() && email) {
      for (const s of done) {
        if (isData(s.dataUrl) && !inflight.current.has(s.id)) {
          inflight.current.add(s.id);
          uploadAsset(email, projectId, "generated", s.dataUrl!)
            .then((url) => setSlots((cur) => cur.map((x) => (x.id === s.id ? { ...x, dataUrl: url } : x))))
            .catch((err) => console.warn("[gallery] Spaces-Upload fehlgeschlagen (behalte base64, retry bei nächster Änderung):", err?.message || err))
            .finally(() => inflight.current.delete(s.id));
        }
      }
    }

    const h = setTimeout(() => {
      const metas: SlotMeta[] = done
        .filter((s) => !isData(s.dataUrl))   // only persist images already on Spaces
        .map((s) => ({ id: s.id, url: s.dataUrl!, prompt: s.prompt, filename: s.filename }));
      const st = (loadProject(projectId)?.state ?? {}) as { galleries?: Record<string, SlotMeta[]> };
      saveProjectState(projectId, { ...st, galleries: { ...(st.galleries ?? {}), [pageKey]: metas } });
    }, 400);
    return () => clearTimeout(h);
  }, [slots, projectId, hydrated, pageKey, email]);

  return [slots, setSlots, hydrated];
}

// ───────────────────────────────────────────────────────────────────────────
// Generic per-project value (form inputs, selections, typed text) → localStorage
// ───────────────────────────────────────────────────────────────────────────

export function useProjectValue<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const { current } = useProjects();
  const projectId = current?.id ?? null;
  const [value, setValue] = useState<T>(initial);
  const [loadedProject, setLoadedProject] = useState<string | null>(null);
  const initialRef = useRef(initial);

  // Story-Keys reagieren zusätzlich auf den Storyboard-Reload-Counter — der
  // wird vom `StoryboardSlotsBar` nach einem Slot-Load gebumpt, damit alle
  // `useProjectValue("story:*", …)`-Aufrufe ihre Werte neu aus localStorage
  // lesen, ohne dass die Page-Komponente komplett remountet werden muss.
  const storyReloadV = useStoryReloadVersion();
  const reloadKey = key.startsWith("story:") ? storyReloadV : 0;

  useEffect(() => {
    if (!projectId) { setLoadedProject(null); return; }
    const state = (loadProject(projectId)?.state ?? {}) as { values?: Record<string, unknown> };
    const saved = state.values?.[key];
    setValue(saved === undefined ? initialRef.current : (saved as T));
    setLoadedProject(projectId);
  }, [projectId, key, reloadKey]);

  useEffect(() => {
    if (!projectId || loadedProject !== projectId) return;
    const h = setTimeout(() => {
      const state = (loadProject(projectId)?.state ?? {}) as { values?: Record<string, unknown> };
      saveProjectState(projectId, { ...state, values: { ...(state.values ?? {}), [key]: value } });
    }, 400);
    return () => clearTimeout(h);
  }, [value, projectId, key, loadedProject]);

  return [value, setValue];
}

// ───────────────────────────────────────────────────────────────────────────
// Uploaded reference images → Spaces (base64 rehydrated on load for AI use)
// ───────────────────────────────────────────────────────────────────────────

interface RefMeta { id: string; url: string; name: string; mimeType: string }

export function useProjectRefImages(pageKey: string): [RefImage[], Dispatch<SetStateAction<RefImage[]>>] {
  const { current } = useProjects();
  const { credentials } = useAuth();
  const projectId = current?.id ?? null;
  const email = credentials?.email ?? "";

  const [refs, setRefs] = useState<RefImage[]>([]);
  const [loadedProject, setLoadedProject] = useState<string | null>(null);
  const urlById = useRef<Map<string, string>>(new Map());
  const inflight = useRef<Set<string>>(new Set());

  // Story-Refs reagieren auch auf den Storyboard-Reload-Counter (siehe
  // useProjectValue). Für Nicht-Story-Pages ist der Wert konstant 0.
  const storyReloadV = useStoryReloadVersion();
  const reloadKey = pageKey.startsWith("story:") ? storyReloadV : 0;

  useEffect(() => {
    let cancelled = false;
    setLoadedProject(null);
    urlById.current = new Map();
    if (!projectId) { setRefs([]); return; }
    (async () => {
      const state = (loadProject(projectId)?.state ?? {}) as { refs?: Record<string, RefMeta[]> };
      const metas = Array.isArray(state.refs?.[pageKey]) ? state.refs![pageKey] : [];
      const restored: RefImage[] = [];
      for (const m of metas) {
        if (!m.url) continue;
        try {
          // Rehydrate base64 — needed because the AI calls send inline image data.
          const { base64, mimeType } = await urlToBase64(m.url);
          restored.push({ id: m.id, dataUrl: m.url, base64, mimeType: mimeType || m.mimeType, name: m.name });
          urlById.current.set(m.id, m.url);
        } catch { /* asset unreachable — skip */ }
      }
      if (cancelled) return;
      setRefs(restored);
      setLoadedProject(projectId);
    })();
    return () => { cancelled = true; };
  }, [projectId, pageKey, reloadKey]);

  useEffect(() => {
    if (!projectId || loadedProject !== projectId) return;

    if (spacesConfigured() && email) {
      for (const r of refs) {
        if (!urlById.current.has(r.id) && !inflight.current.has(r.id)) {
          inflight.current.add(r.id);
          const src = r.dataUrl?.startsWith("data:") ? r.dataUrl : `data:${r.mimeType};base64,${r.base64}`;
          uploadAsset(email, projectId, "refs", src)
            .then((url) => { urlById.current.set(r.id, url); setRefs((cur) => [...cur]); })
            .catch((err) => console.warn("[refs] Spaces-Upload fehlgeschlagen:", err?.message || err))
            .finally(() => inflight.current.delete(r.id));
        }
      }
    }

    const h = setTimeout(() => {
      const metas: RefMeta[] = refs
        .filter((r) => urlById.current.has(r.id))
        .map((r) => ({ id: r.id, url: urlById.current.get(r.id)!, name: r.name, mimeType: r.mimeType }));
      const st = (loadProject(projectId)?.state ?? {}) as { refs?: Record<string, RefMeta[]> };
      saveProjectState(projectId, { ...st, refs: { ...(st.refs ?? {}), [pageKey]: metas } });
    }, 400);
    return () => clearTimeout(h);
  }, [refs, projectId, loadedProject, pageKey, email]);

  return [refs, setRefs];
}

// ───────────────────────────────────────────────────────────────────────────
// Positional result grids (Views / Poses) — order & length preserved
// ───────────────────────────────────────────────────────────────────────────

export function useProjectResults(pageKey: string): [ImageSlotData[], Dispatch<SetStateAction<ImageSlotData[]>>] {
  const { current } = useProjects();
  const { credentials } = useAuth();
  const projectId = current?.id ?? null;
  const email = credentials?.email ?? "";

  const [results, setResults] = useState<ImageSlotData[]>([]);
  const [loadedProject, setLoadedProject] = useState<string | null>(null);
  const inflight = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLoadedProject(null);
    if (!projectId) { setResults([]); return; }
    const state = (loadProject(projectId)?.state ?? {}) as { results?: Record<string, SlotMeta[]> };
    const metas = Array.isArray(state.results?.[pageKey]) ? state.results![pageKey] : [];
    setResults(metas.map((m) =>
      m.url
        ? { id: m.id, status: "done", dataUrl: m.url, prompt: m.prompt, filename: m.filename }
        : { id: m.id, status: "error", error: "Nicht mehr gespeichert", errorHint: "Erneut generieren." },
    ));
    setLoadedProject(projectId);
  }, [projectId, pageKey]);

  useEffect(() => {
    if (!projectId || loadedProject !== projectId) return;
    if (results.some((r) => r.status === "loading")) return;

    if (spacesConfigured() && email) {
      for (const r of results) {
        if (r.status === "done" && isData(r.dataUrl) && !inflight.current.has(r.id)) {
          inflight.current.add(r.id);
          uploadAsset(email, projectId, "generated", r.dataUrl!)
            .then((url) => setResults((cur) => cur.map((x) => (x.id === r.id ? { ...x, dataUrl: url } : x))))
            .catch((err) => console.warn("[results] Spaces-Upload fehlgeschlagen:", err?.message || err))
            .finally(() => inflight.current.delete(r.id));
        }
      }
    }

    const h = setTimeout(() => {
      const metas: SlotMeta[] = results.map((r) => ({
        id: r.id,
        url: r.status === "done" && r.dataUrl && !isData(r.dataUrl) ? r.dataUrl : undefined,
        prompt: r.prompt, filename: r.filename,
      }));
      const st = (loadProject(projectId)?.state ?? {}) as { results?: Record<string, SlotMeta[]> };
      saveProjectState(projectId, { ...st, results: { ...(st.results ?? {}), [pageKey]: metas } });
    }, 400);
    return () => clearTimeout(h);
  }, [results, projectId, loadedProject, pageKey, email]);

  return [results, setResults];
}
