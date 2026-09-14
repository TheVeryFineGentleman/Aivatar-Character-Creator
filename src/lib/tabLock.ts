/**
 * Nur EIN Tab darf speichern.
 *
 * Projekte, Storyboards und Keys liegen ausschließlich im localStorage. Jeder
 * Tab hält davon eine eigene Kopie im Arbeitsspeicher und erfährt nicht, was
 * ein anderer Tab schreibt. Zwei offene Tabs hießen deshalb: der veraltete Tab
 * schreibt beim nächsten Klick seinen alten Stand über die Arbeit des anderen
 * (Kundenfall 2026-09: ein Tab für die Erklärvideos, einer zum Arbeiten).
 *
 * Mechanik: Web Locks. Der erste Tab bekommt die Sperre und hält sie, bis er
 * geschlossen wird — auch bei einem Absturz gibt der Browser sie frei. Jeder
 * weitere Tab startet gesperrt, lädt die App gar nicht erst (siehe
 * `TabLockGate`) und rückt von selbst nach, sobald der andere Tab zugeht.
 *
 * NEULADEN DES SPEICHERNDEN TABS: Beim Entladen gibt er die Sperre frei, und
 * ein wartender Tab bekäme sie, bevor die neu geladene Seite überhaupt fragt —
 * wer seinen Arbeits-Tab neu lädt, stünde vor „schon in einem anderen Tab
 * offen" (so im Test passiert). Deshalb merkt sich der speichernde Tab das in
 * sessionStorage (pro Tab, übersteht das Neuladen) und holt sich die Sperre bei
 * einem echten Reload per `steal` zurück. Und ein Wartender übernimmt erst nach
 * `PROMOTE_DELAY_MS` — kommt der andere Tab bis dahin zurück, startet der
 * Wartende gar nicht erst die App.
 *
 * „Hier weiterarbeiten" lädt neu und STIEHLT die Sperre beim Start. Neu laden
 * ist Pflicht, nicht Bequemlichkeit: ein Tab, der die Sperre verloren hatte,
 * hält noch den alten Stand im Speicher, und laufende Abläufe darin würden ihn
 * sonst mit frischer Schreiberlaubnis zurückschreiben. Gestohlen wird erst
 * NACH dem Neuladen (Merker in sessionStorage) — hielte man die Sperre über das
 * Neuladen hinweg, bekäme sie beim Entladen ein dritter wartender Tab.
 *
 * Ohne Web Locks (unsicherer Kontext wie http://192.168.x.x, sehr alte
 * Browser) bleibt alles wie vorher: jeder Tab speichert.
 */

export type TabLockState =
  | "checking"     // Start, noch nicht entschieden — nichts wird geschrieben
  | "owner"        // dieser Tab speichert
  | "blocked"      // ein anderer Tab speichert; die App wurde hier nie geladen
  | "lost"         // dieser Tab HAT gespeichert, ein anderer hat übernommen
  | "unsupported"; // keine Web Locks — Verhalten wie vor der Sperre

const LOCK_NAME = "aivatar:writer";
const TAKEOVER_FLAG = "aivatar:tabLock.takeover";
const OWNER_FLAG = "aivatar:tabLock.owner";
const PROMOTE_DELAY_MS = 3000;

let state: TabLockState = "checking";
let started = false;
const listeners = new Set<() => void>();

function setState(next: TabLockState) {
  if (state === next) return;
  state = next;
  for (const l of listeners) l();
}

export function getTabLockState(): TabLockState {
  return state;
}

export function subscribeTabLock(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Darf dieser Tab speichern? Solange noch geprüft wird: nein. */
export function canWrite(): boolean {
  return state === "owner" || state === "unsupported";
}

function session(op: (s: Storage) => unknown): unknown {
  try { return op(sessionStorage); } catch { return null; }
}

/** Sperre halten, solange der Tab lebt — das Promise löst sich nie auf. */
function hold(): Promise<void> {
  setState("owner");
  session((s) => s.setItem(OWNER_FLAG, "1"));
  return new Promise<void>(() => {});
}

/** Abgelehnt wird eine gehaltene Sperre nur, wenn ein anderer Tab sie stiehlt. */
function onRejected() {
  if (state === "owner") {
    setState("lost");
    // Ein F5 hier soll die Sperre nicht zurückholen — das tut nur der Knopf.
    session((s) => s.removeItem(OWNER_FLAG));
  } else if (state === "checking") {
    setState("unsupported"); // z. B. SecurityError in einer Sandbox
  }
}

/** Nur ein echter Reload zählt — ein duplizierter Tab erbt sessionStorage mit. */
function isReload(): boolean {
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload";
}

/** Einmal beim App-Start aufrufen, VOR dem ersten Render. */
export function startTabLock(): void {
  if (started) return;
  started = true;

  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) { setState("unsupported"); return; }

  const takeover = session((s) => s.getItem(TAKEOVER_FLAG)) === "1";
  session((s) => s.removeItem(TAKEOVER_FLAG));
  const wasOwner = session((s) => s.getItem(OWNER_FLAG)) === "1";

  if (takeover || (wasOwner && isReload())) {
    locks.request(LOCK_NAME, { steal: true }, hold).catch(onRejected);
    return;
  }

  locks
    .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
      if (lock) return hold();
      setState("blocked");
      waitForTurn(locks);
      return undefined;
    })
    .catch(onRejected);
}

/**
 * Hinten anstellen: Wird der andere Tab geschlossen, geht es hier weiter —
 * aber erst nach `PROMOTE_DELAY_MS`. Lädt der andere Tab nur neu, stiehlt er
 * die Sperre in der Zeit zurück, und dieser Tab bleibt still gesperrt.
 */
function waitForTurn(locks: LockManager) {
  let stolen = false;
  locks
    .request(LOCK_NAME, () => new Promise<void>(() => {
      setTimeout(() => { if (!stolen) void hold(); }, PROMOTE_DELAY_MS);
    }))
    .catch(() => {
      stolen = true;
      // Noch in der Wartezeit gestohlen: wieder hinten anstellen, sonst rückte
      // dieser Tab nie mehr nach, wenn der andere später wirklich zugeht.
      if (state === "blocked") waitForTurn(locks);
      else onRejected();
    });
}

/** „Hier weiterarbeiten": neu laden und beim Start die Sperre übernehmen. */
export function takeOverTab(): void {
  session((s) => s.setItem(TAKEOVER_FLAG, "1"));
  window.location.reload();
}

// Nur Dev: Ein Hot-Update dieses Moduls ließe die alte Instanz samt echter
// Browser-Sperre weiterleben — die neue fände sie belegt, und jeder Tab stünde
// gesperrt da, ohne dass einer speichern darf. Also die Seite ganz neu laden.
if (import.meta.hot) {
  import.meta.hot.accept(() => window.location.reload());
}
