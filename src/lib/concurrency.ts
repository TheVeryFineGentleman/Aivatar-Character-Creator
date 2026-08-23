/**
 * Parallelisierung mit Obergrenze.
 *
 * WARUM nicht einfach `Promise.all`: die Generierungsläufe schicken pro Element
 * einen Modell-Request. Ohne Deckel feuert ein 12er-Posen-Grid zwölf Requests
 * gleichzeitig los — das läuft bei Google direkt ins 429er-Rate-Limit, und ein
 * Rate-Limit ist LANGSAMER als die Serialisierung, die wir ersetzen wollen.
 * Ein kleines Fenster (3–4) holt praktisch den ganzen Zeitgewinn, ohne das
 * Kontingent zu reißen.
 */

/** Voreinstellung für Bild-Generierung. Empirisch der Punkt, an dem der Gewinn
 *  abflacht und die 429er anfangen. */
export const IMAGE_CONCURRENCY = 4;

/** Video-Jobs sind teurer und laufen minutenlang — kleineres Fenster. */
export const VIDEO_CONCURRENCY = 3;

/**
 * Wie `Promise.all(items.map(fn))`, aber es laufen nie mehr als `limit`
 * gleichzeitig. Die Ergebnisse behalten die Reihenfolge von `items`.
 *
 * `fn` darf werfen — der Fehler landet als rejected Promise am Ende, genau wie
 * bei `Promise.all`. Die Aufrufer hier fangen ihre Fehler ohnehin pro Element ab
 * (jede Kachel zeigt ihren eigenen Fehlerzustand), deshalb bleibt das Verhalten
 * absichtlich unverändert statt still zu schlucken.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    // Jeder Worker zieht sich den nächsten freien Index. Kein gemeinsamer
    // Zwischenstand außer dem Zähler — deshalb ist das hier race-frei, obwohl
    // mehrere Worker parallel laufen (JS ist single-threaded, `next++` ist atomar).
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker);
  await Promise.all(workers);
  return results;
}
