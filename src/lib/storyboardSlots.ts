/**
 * Storyboard-Save-Slots — bis zu 3 benannte Storyboard-Snapshots pro Projekt.
 *
 * Modell: Save-Game / Save-File mit Auto-Save.
 *   - Live-State (was der User gerade bearbeitet) lebt wie bisher in
 *     `state.values["story:*"]`, `state.refs["story:refs"]` und `state.story`.
 *   - Ein "Slot" ist ein Snapshot dieser drei Bereiche, der unter
 *     `state.storyboardSlots` als Array gespeichert wird.
 *   - Save = aktuellen Live-State in einen Slot kopieren (neuer oder bestehender).
 *   - Load = Slot-Snapshot zurück in den Live-State schreiben.
 *
 * Aktiver Slot:
 *   - `state.activeStoryboardSlotId` zeigt auf den Slot, in den auto-gespeichert
 *     wird. Wird beim `createSlot`/`loadSlotIntoProject` automatisch gesetzt
 *     und beim `deleteSlot` (falls passend) geleert.
 *   - Die StoryPage feuert nach jedem Edit einen debounced `autosaveActiveSlot`,
 *     der den aktuellen Live-State in den aktiven Slot zurückschreibt.
 */

import { useSyncExternalStore } from "react";
import { loadProject, saveProjectState } from "@/lib/projectStorage";
import type { StoryScene } from "@/lib/storyPrompts";
import { uid } from "@/lib/uid";

// ── Reload-Counter für Storyboard-State ────────────────────────────────────
//
// Wenn ein Slot geladen wird, schreiben wir den Snapshot ins Projekt zurück
// — aber die `useProjectValue`/`useProjectRefImages`-Hooks in der StoryPage
// merken davon nichts (ihre Effects hängen nur an `projectId`). Dieser
// Mini-Store dient als zusätzliche Reaktivitäts-Quelle: nach einem Load
// rufen wir `bumpStoryReloadVersion()` — die Hooks lesen via
// `useStoryReloadVersion()` mit und re-fetchen ihre Werte aus localStorage.

let storyReloadVersion = 0;
const reloadListeners = new Set<() => void>();

export function bumpStoryReloadVersion(): void {
  storyReloadVersion++;
  reloadListeners.forEach((l) => l());
}

export function useStoryReloadVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      reloadListeners.add(cb);
      return () => { reloadListeners.delete(cb); };
    },
    () => storyReloadVersion,
    () => 0,
  );
}

export const MAX_STORYBOARD_SLOTS = 3;

export interface SlotRefMeta {
  id: string;
  url: string;
  name: string;
  mimeType: string;
}

export interface StoryboardSnapshot {
  values: Record<string, unknown>;  // alle "story:*" keys aus state.values
  refs: SlotRefMeta[];               // state.refs["story:refs"]
  scenes: StoryScene[];              // state.story
}

export interface StoryboardSlot {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  snapshot: StoryboardSnapshot;
}

interface ProjectStateShape {
  values?: Record<string, unknown>;
  refs?: Record<string, SlotRefMeta[]>;
  story?: StoryScene[];
  storyboardSlots?: StoryboardSlot[];
  activeStoryboardSlotId?: string | null;
}

const STORY_KEY_PREFIX = "story:";
const REFS_KEY = "story:refs";

// ── Live-State ↔ Snapshot ──────────────────────────────────────────────────

/** Aktuellen Live-State aus dem Projekt extrahieren. */
export function extractCurrentSnapshot(projectId: string): StoryboardSnapshot {
  const state = (loadProject(projectId)?.state ?? {}) as ProjectStateShape;
  const storyValues: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state.values ?? {})) {
    if (k.startsWith(STORY_KEY_PREFIX)) storyValues[k] = v;
  }
  return {
    values: storyValues,
    refs: Array.isArray(state.refs?.[REFS_KEY]) ? state.refs![REFS_KEY] : [],
    scenes: Array.isArray(state.story) ? state.story : [],
  };
}

/** Slot-Snapshot zurück in den Live-State schreiben. */
export function applySnapshotToProject(projectId: string, snap: StoryboardSnapshot): void {
  const state = (loadProject(projectId)?.state ?? {}) as ProjectStateShape;

  // Alte story:*-Values rausnehmen, neue rein
  const nextValues: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(state.values ?? {})) {
    if (!k.startsWith(STORY_KEY_PREFIX)) nextValues[k] = v;
  }
  Object.assign(nextValues, snap.values);

  const nextRefs = { ...(state.refs ?? {}) };
  nextRefs[REFS_KEY] = snap.refs;

  saveProjectState(projectId, {
    ...state,
    values: nextValues,
    refs: nextRefs,
    story: snap.scenes,
  });
}

// ── Slot-CRUD ──────────────────────────────────────────────────────────────

export function listSlots(projectId: string | null): StoryboardSlot[] {
  if (!projectId) return [];
  const state = (loadProject(projectId)?.state ?? {}) as ProjectStateShape;
  return Array.isArray(state.storyboardSlots) ? state.storyboardSlots : [];
}

function writeSlots(projectId: string, slots: StoryboardSlot[]): void {
  const state = (loadProject(projectId)?.state ?? {}) as ProjectStateShape;
  saveProjectState(projectId, { ...state, storyboardSlots: slots });
}

/**
 * Neuen Slot anlegen — speichert den aktuellen Live-State unter dem Namen.
 * Setzt den neuen Slot direkt als aktiven Auto-Save-Slot.
 * Gibt `null` zurück wenn das Limit erreicht ist.
 */
export function createSlot(projectId: string, name: string): StoryboardSlot | null {
  const slots = listSlots(projectId);
  if (slots.length >= MAX_STORYBOARD_SLOTS) return null;
  const now = Date.now();
  const slot: StoryboardSlot = {
    id: uid(),
    name: name.trim() || `Storyboard ${slots.length + 1}`,
    createdAt: now,
    updatedAt: now,
    snapshot: extractCurrentSnapshot(projectId),
  };
  writeSlots(projectId, [...slots, slot]);
  setActiveSlotId(projectId, slot.id);
  return slot;
}

/** Bestehenden Slot mit dem aktuellen Live-State überschreiben. */
export function overwriteSlot(projectId: string, slotId: string): StoryboardSlot | null {
  const slots = listSlots(projectId);
  const idx = slots.findIndex((s) => s.id === slotId);
  if (idx < 0) return null;
  const updated: StoryboardSlot = {
    ...slots[idx],
    updatedAt: Date.now(),
    snapshot: extractCurrentSnapshot(projectId),
  };
  const next = [...slots];
  next[idx] = updated;
  writeSlots(projectId, next);
  return updated;
}

export function renameSlot(projectId: string, slotId: string, name: string): void {
  const slots = listSlots(projectId);
  const next = slots.map((s) =>
    s.id === slotId ? { ...s, name: name.trim() || s.name, updatedAt: Date.now() } : s,
  );
  writeSlots(projectId, next);
}

export function deleteSlot(projectId: string, slotId: string): void {
  const slots = listSlots(projectId).filter((s) => s.id !== slotId);
  writeSlots(projectId, slots);
  // Aktiven Slot leeren, wenn er gerade gelöscht wurde — sonst läuft Auto-Save
  // ins Leere (überschreibt-NoOp), behält aber den ungültigen Pointer.
  if (getActiveSlotId(projectId) === slotId) {
    setActiveSlotId(projectId, null);
  }
}

/**
 * Slot in den Live-State laden — schreibt Snapshot zurück, kein State-Reset hier.
 * Setzt den geladenen Slot direkt als aktiven Auto-Save-Slot.
 */
export function loadSlotIntoProject(projectId: string, slotId: string): StoryboardSlot | null {
  const slot = listSlots(projectId).find((s) => s.id === slotId);
  if (!slot) return null;
  applySnapshotToProject(projectId, slot.snapshot);
  setActiveSlotId(projectId, slot.id);
  return slot;
}

// ── Aktiver Auto-Save-Slot ────────────────────────────────────────────────

/** Liefert die ID des aktiven Slots (Auto-Save-Ziel) oder `null`. */
export function getActiveSlotId(projectId: string | null): string | null {
  if (!projectId) return null;
  const state = (loadProject(projectId)?.state ?? {}) as ProjectStateShape;
  const id = state.activeStoryboardSlotId ?? null;
  // Wenn die Referenz ins Leere zeigt (Slot wurde extern gelöscht), aufräumen.
  if (id && !listSlots(projectId).some((s) => s.id === id)) return null;
  return id;
}

/** Aktiven Auto-Save-Slot setzen (oder per `null` deaktivieren). */
export function setActiveSlotId(projectId: string, slotId: string | null): void {
  const state = (loadProject(projectId)?.state ?? {}) as ProjectStateShape;
  saveProjectState(projectId, { ...state, activeStoryboardSlotId: slotId });
}

/**
 * Auto-Save: aktuellen Live-State in den aktiven Slot zurückschreiben.
 * No-op wenn kein aktiver Slot gesetzt ist.
 */
export function autosaveActiveSlot(projectId: string | null): StoryboardSlot | null {
  if (!projectId) return null;
  const activeId = getActiveSlotId(projectId);
  if (!activeId) return null;
  return overwriteSlot(projectId, activeId);
}

// ── "Welcher Slot ist gerade geladen?" — vergleicht Snapshot-Inhalt ────────

/** Liefert die Slot-ID, deren Snapshot 1:1 dem aktuellen Live-State entspricht. */
export function findMatchingSlot(projectId: string | null): string | null {
  if (!projectId) return null;
  const live = JSON.stringify(extractCurrentSnapshot(projectId));
  for (const slot of listSlots(projectId)) {
    if (JSON.stringify(slot.snapshot) === live) return slot.id;
  }
  return null;
}
