/**
 * Video utilities — client-side frame extraction for Story continuity.
 *
 * Zwei Aufrufer mit unterschiedlichem Zweck:
 * • Seamless-Modus (General): der letzte Frame von Clip N wird zum STARTFRAME
 *   von Clip N+1 — dort ist der Frame ein Veo-Startbild und muss in voller
 *   Auflösung und verlustfrei (PNG) bleiben.
 * • Vlog-Zustandsanschluss (Reel): der letzte Frame von Clip N wird nur
 *   REFERENZBILD für die Bildgenerierung von Szene N+1 — er belegt den Zustand
 *   (Haltung, Position, Requisiten), nicht das Framing. Dort ist ein kleines
 *   JPEG richtig: der Frame geht als base64 in einen Image-Gen-Request, und ein
 *   1080x1920-PNG sind mehrere MB.
 *
 * Weil der zweite Aufrufer auf dem kritischen Pfad JEDER Szene läuft (und nicht
 * mehr nur im Sonderfall), hat diese Funktion einen Timeout und eine
 * Dimensionsprüfung — ohne die würde ein hängendes `loadedmetadata` den ganzen
 * verschränkten Lauf blockieren, ohne dass ein Abbruch greift.
 */

export interface ExtractFrameOpts {
  /** How far before the absolute end to sample, in milliseconds.
   *  Some encoders emit black tail frames at exactly `duration`, so we sample
   *  slightly before by default. */
  offsetMs?: number;
  /** PNG vs JPEG — PNG is lossless and what Veo prefers as a reference. */
  mimeType?: "image/png" | "image/jpeg";
  /** Only used for jpeg. */
  quality?: number;
  /** Obergrenze für die längere Kante in Pixeln. Aus (undefined) = native
   *  Auflösung, also exakt das bisherige Verhalten. Der Referenz-Aufrufer setzt
   *  1024, damit der base64-String klein bleibt. */
  maxLongEdge?: number;
  /** Harte Zeitgrenze für Laden + Seek. Ohne sie wartet die Batch-Schleife bei
   *  einem hängenden Netz unbegrenzt — und `abortRef` kennt diese Promises nicht. */
  timeoutMs?: number;
}

/**
 * Returns the last frame of `videoUrl` as a base64 `data:` URL.
 *
 * Requires the video host to allow CORS reads (DO Spaces returns
 * `Access-Control-Allow-Origin: *` for public objects, and `data:` URLs always
 * work). On a cross-origin video without CORS the canvas turns "tainted" and
 * the export throws — the caller should treat that as soft-failure.
 */
export async function extractLastFrame(
  videoUrl: string,
  opts: ExtractFrameOpts = {},
): Promise<string> {
  const {
    offsetMs = 80,
    mimeType = "image/png",
    quality = 0.95,
    maxLongEdge,
    timeoutMs = 12000,
  } = opts;

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = videoUrl;

  /** Rennt `p` gegen den Timeout. Der Timer wird in JEDEM Fall wieder gelöscht,
   *  sonst hält ein 12s-Timer den Tab wach, obwohl längst alles fertig ist. */
  const withTimeout = <T,>(p: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout>;
    const guard = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Frame-Extraktion abgebrochen (Timeout).")), timeoutMs);
    });
    return Promise.race([p, guard]).finally(() => clearTimeout(timer)) as Promise<T>;
  };

  try {
    await withTimeout(new Promise<void>((resolve, reject) => {
      const onMeta = () => { cleanup(); resolve(); };
      const onErr = () => { cleanup(); reject(new Error("Video konnte nicht geladen werden.")); };
      const cleanup = () => {
        video.removeEventListener("loadedmetadata", onMeta);
        video.removeEventListener("error", onErr);
      };
      video.addEventListener("loadedmetadata", onMeta, { once: true });
      video.addEventListener("error", onErr, { once: true });
    }));

    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("Video-Dauer unbekannt.");
    }

    const target = Math.max(0, video.duration - offsetMs / 1000);
    await withTimeout(new Promise<void>((resolve, reject) => {
      const onSeeked = () => { cleanup(); resolve(); };
      const onErr = () => { cleanup(); reject(new Error("Seek zum letzten Frame fehlgeschlagen.")); };
      const cleanup = () => {
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onErr);
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      video.addEventListener("error", onErr, { once: true });
      video.currentTime = target;
    }));

    // Ohne diese Prüfung entsteht ein 0x0-Canvas und `toDataURL` liefert still
    // Müll — ein „erfolgreich" extrahierter Frame, der nichts zeigt. Das ist der
    // schlimmste Fehlerfall, weil er als Erfolg durchgereicht würde.
    if (!video.videoWidth || !video.videoHeight) {
      throw new Error("Videobild nicht lesbar.");
    }

    // Optionales Herunterskalieren. `drawImage` mit Zielgröße skaliert selbst —
    // ein zweiter Canvas ist nicht nötig.
    const scale = maxLongEdge
      ? Math.min(1, maxLongEdge / Math.max(video.videoWidth, video.videoHeight))
      : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar.");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      return canvas.toDataURL(mimeType, quality);
    } catch {
      throw new Error("Frame nicht lesbar (CORS oder geschützter Inhalt).");
    }
  } finally {
    // Den Dekoder wirklich freigeben. Ohne das hält jeder Aufruf einen
    // 8-Sekunden-Clip im Speicher, bis die Seite neu geladen wird — bei 4–8
    // Szenen pro Reel und mehreren Läufen summiert sich das.
    video.removeAttribute("src");
    video.load();
  }
}
