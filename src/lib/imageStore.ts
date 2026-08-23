/**
 * IndexedDB-backed store for generated image data-URLs.
 *
 * Generated images are far too large for localStorage (~5 MB cap), so their
 * base64 data lives here while only light metadata (id, prompt, filename) is
 * kept in the project state. Records are keyed `${projectId}::${pageKey}::${id}`
 * so a project's gallery for a given page can be loaded, replaced or cleared
 * by key prefix.
 */

const DB_NAME = "aivatar";
const STORE = "images";
const SEP = "::";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

interface ImageRecord {
  key: string;
  projectId: string;
  pageKey: string;
  id: string;
  dataUrl: string;
}

const prefixOf = (projectId: string, pageKey: string) => `${projectId}${SEP}${pageKey}${SEP}`;
const keyOf = (projectId: string, pageKey: string, id: string) => prefixOf(projectId, pageKey) + id;
const rangeForPrefix = (prefix: string) => IDBKeyRange.bound(prefix, prefix + "￿");

/** Load all images for a (project, page) as a map of id → dataUrl. */
export async function loadGallery(projectId: string, pageKey: string): Promise<Record<string, string>> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const out: Record<string, string> = {};
      const tx = db.transaction(STORE, "readonly");
      const cursorReq = tx.objectStore(STORE).openCursor(rangeForPrefix(prefixOf(projectId, pageKey)));
      cursorReq.onsuccess = () => {
        const cur = cursorReq.result;
        if (cur) {
          const rec = cur.value as ImageRecord;
          out[rec.id] = rec.dataUrl;
          cur.continue();
        } else {
          resolve(out);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } catch {
    return {};
  }
}

/**
 * Replace the stored gallery for a (project, page): writes all `items` and
 * removes any previously stored image under the same prefix that is no longer
 * present, so deletions and "clear" free their space.
 */
export async function saveGallery(
  projectId: string,
  pageKey: string,
  items: { id: string; dataUrl: string }[],
): Promise<void> {
  try {
    const db = await openDB();
    const keep = new Set(items.map((it) => keyOf(projectId, pageKey, it.id)));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);

      // Drop stale records under the prefix.
      const cursorReq = store.openCursor(rangeForPrefix(prefixOf(projectId, pageKey)));
      cursorReq.onsuccess = () => {
        const cur = cursorReq.result;
        if (cur) {
          if (!keep.has(String(cur.key))) cur.delete();
          cur.continue();
        }
      };

      // Write the current records.
      for (const it of items) {
        store.put({
          key: keyOf(projectId, pageKey, it.id),
          projectId, pageKey, id: it.id, dataUrl: it.dataUrl,
        } satisfies ImageRecord);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    /* IndexedDB unavailable or quota exceeded — metadata still persists. */
  }
}

/** Remove every image belonging to a project (used when a project is deleted). */
export async function clearProjectImages(projectId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const cursorReq = tx.objectStore(STORE).openCursor(rangeForPrefix(`${projectId}${SEP}`));
      cursorReq.onsuccess = () => {
        const cur = cursorReq.result;
        if (cur) { cur.delete(); cur.continue(); }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* noop */
  }
}
