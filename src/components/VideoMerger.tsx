import React, { useState, useRef, useCallback, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import ffmpegClassWorkerUrl from "@ffmpeg/ffmpeg/worker?url";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, Film, Loader2, AlertCircle, Play, RotateCcw, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkBrowserCompatibility, getDeviceInfo } from "@/lib/storage";

interface VideoMergerProps {
  videos: { index: number; url: string }[];
  className?: string;
}

interface CdnProbeResult {
  label: string;
  ok: boolean;
  status?: number;
  error?: string;
}

interface WorkerProbeResult {
  ok: boolean;
  error?: string;
}

const MAX_SINGLE_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_VIDEO_BYTES = 300 * 1024 * 1024;
const FFMPEG_CORE_VERSION = "0.12.9";

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function getDataUrlSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Ungültige Data-URL");
  }

  const metadata = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);

  if (metadata.includes(";base64")) {
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }

  return new TextEncoder().encode(decodeURIComponent(payload)).length;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    throw new Error("Ungültige Data-URL");
  }

  const metadata = dataUrl.slice(0, commaIndex);
  const payload = dataUrl.slice(commaIndex + 1);

  if (metadata.includes(";base64")) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return new TextEncoder().encode(decodeURIComponent(payload));
}

async function getVideoSizeEstimate(url: string, timeoutMs = 15000): Promise<number | null> {
  if (url.startsWith("data:")) {
    return getDataUrlSize(url);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (url.startsWith("blob:")) {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        return null;
      }

      const blob = await response.blob();
      return blob.size;
    }

    const headResponse = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      cache: "no-store",
    });

    if (!headResponse.ok) {
      return null;
    }

    const contentLength = headResponse.headers.get("content-length");
    if (!contentLength) {
      return null;
    }

    const parsed = Number.parseInt(contentLength, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return null;
    }
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchVideoAsUint8Array(url: string, timeoutMs = 90000): Promise<Uint8Array> {
  if (url.startsWith("data:")) {
    return dataUrlToUint8Array(url);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Download-Timeout");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function probeRemoteAsset(
  url: string,
  label: string,
  method: "HEAD" | "GET" = "HEAD",
  timeoutMs = 10000
): Promise<CdnProbeResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        label,
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}`,
      };
    }

    return {
      label,
      ok: true,
      status: response.status,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        label,
        ok: false,
        error: "Timeout",
      };
    }

    return {
      label,
      ok: false,
      error: error instanceof Error ? error.message : "Fetch fehlgeschlagen",
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function probeLocalModuleWorker(workerUrl: string, timeoutMs = 4000): Promise<WorkerProbeResult> {
  return new Promise((resolve) => {
    let settled = false;
    let worker: Worker | null = null;

    const finish = (result: WorkerProbeResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      try {
        worker?.terminate();
      } catch {
        // Ignore worker cleanup errors during diagnostics.
      }
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish({ ok: true });
    }, timeoutMs);

    try {
      worker = new Worker(workerUrl, { type: "module" });
      worker.onerror = (event) => {
        finish({
          ok: false,
          error: event.message || "Module-Worker konnte nicht gestartet werden",
        });
      };
      worker.onmessageerror = () => {
        finish({
          ok: false,
          error: "Module-Worker meldet einen Nachrichten-/Serialisierungsfehler",
        });
      };
    } catch (error) {
      finish({
        ok: false,
        error: error instanceof Error ? error.message : "Module-Worker Konstruktor fehlgeschlagen",
      });
    }
  });
}

async function tryDeleteFile(ffmpeg: FFmpeg, fileName: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(fileName);
  } catch (error) {
    console.debug(`[ffmpeg] Cleanup skip for ${fileName}:`, error);
  }
}

export const VideoMerger: React.FC<VideoMergerProps> = ({ videos, className }) => {
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showZipFallback, setShowZipFallback] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [diagnosticDetails, setDiagnosticDetails] = useState<string[]>([]);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegLogTailRef = useRef<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const pushFfmpegLog = useCallback((message: string) => {
    const normalized = message.trim();
    if (!normalized) return;
    const next = [...ffmpegLogTailRef.current, normalized];
    ffmpegLogTailRef.current = next.slice(-20);
  }, []);

  const clearFfmpegLogs = useCallback(() => {
    ffmpegLogTailRef.current = [];
  }, []);

  const getFfmpegLogTail = useCallback(() => {
    if (ffmpegLogTailRef.current.length === 0) return "";
    return ffmpegLogTailRef.current.slice(-8).join(" | ");
  }, []);

  const execFfmpegOrThrow = useCallback(
    async (ffmpeg: FFmpeg, args: string[], step: string, timeout = -1): Promise<void> => {
      clearFfmpegLogs();
      const exitCode = await ffmpeg.exec(args, timeout);
      if (exitCode !== 0) {
        const logTail = getFfmpegLogTail();
        throw new Error(
          `FFmpeg ${step} fehlgeschlagen (Exit-Code ${exitCode})${logTail ? ` | Logs: ${logTail}` : ""}`
        );
      }
    },
    [clearFfmpegLogs, getFfmpegLogTail]
  );

  useEffect(() => {
    return () => {
      if (mergedVideoUrl) {
        URL.revokeObjectURL(mergedVideoUrl);
      }
    };
  }, [mergedVideoUrl]);

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    const browserCheck = checkBrowserCompatibility();
    const deviceInfo = getDeviceInfo();
    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    const isFirefox = typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox");
    const diagnosticLines: string[] = [`Browser: ${deviceInfo}`];

    if (!online) {
      diagnosticLines.push("Netzwerk: Browser meldet Offline-Modus");
      setDiagnosticDetails(diagnosticLines);
      throw new Error("Browser ist offline. Bitte Verbindung prüfen.");
    }

    if (!browserCheck.compatible) {
      diagnosticLines.push(...browserCheck.issues.map((issue) => `Browser: ${issue}`));
      setDiagnosticDetails(diagnosticLines);
      throw new Error("Browser unterstützt den Video-Merger nicht vollständig.");
    }

    if (typeof Worker === "undefined") {
      diagnosticLines.push("Browser: Worker API fehlt");
      setDiagnosticDetails(diagnosticLines);
      throw new Error("Worker API fehlt. FFmpeg kann nicht gestartet werden.");
    }

    if (typeof WebAssembly === "undefined") {
      diagnosticLines.push("Browser: WebAssembly fehlt");
      setDiagnosticDetails(diagnosticLines);
      throw new Error("WebAssembly fehlt. FFmpeg kann nicht gestartet werden.");
    }

    if (isFirefox) {
      diagnosticLines.push("Browser: Firefox erkannt - FFmpeg/WASM braucht hier oft deutlich länger");
      setProgressMessage("FFmpeg wird in Firefox geladen (~30 MB, erster Start kann länger dauern)...");
    } else {
      setProgressMessage("FFmpeg wird geladen (~30 MB, kann kurz dauern)...");
    }
    diagnosticLines.push(`FFmpeg Core-Version: ${FFMPEG_CORE_VERSION}`);
    diagnosticLines.push(`FFmpeg Class-Worker URL: ${ffmpegClassWorkerUrl}`);

    const cdnSources = [
      `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`,
      `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`,
    ];
    // Firefox often needs much longer for WASM download + compile.
    const timeoutMs = isFirefox ? 120000 : 45000;
    const cdnDiagnostics = await Promise.all([
      probeRemoteAsset(`${cdnSources[0]}/ffmpeg-core.js`, "jsDelivr JS", "GET"),
      probeRemoteAsset(`${cdnSources[0]}/ffmpeg-core.wasm`, "jsDelivr WASM"),
      probeRemoteAsset(`${cdnSources[1]}/ffmpeg-core.js`, "unpkg JS", "GET"),
      probeRemoteAsset(`${cdnSources[1]}/ffmpeg-core.wasm`, "unpkg WASM"),
    ]);

    diagnosticLines.push(
      ...cdnDiagnostics.map((probe) =>
        probe.ok
          ? `CDN: ${probe.label} erreichbar`
          : `CDN: ${probe.label} fehlgeschlagen${probe.status ? ` (${probe.status})` : ""}${probe.error ? ` - ${probe.error}` : ""}`
      )
    );
    setDiagnosticDetails(diagnosticLines);

    const successfulChecks = cdnDiagnostics.filter((probe) => probe.ok).length;
    if (successfulChecks === 0) {
      throw new Error(
        "FFmpeg-CDNs sind aus dem Browser nicht erreichbar. Wahrscheinliche Ursachen: Adblocker, VPN, Firewall, DNS-Filter oder strenge Browser-Schutzfunktion."
      );
    }

    const workerProbe = await probeLocalModuleWorker(ffmpegClassWorkerUrl);
    diagnosticLines.push(
      workerProbe.ok
        ? "Worker: lokaler Modul-Worker startbar"
        : `Worker: lokaler Modul-Worker fehlgeschlagen - ${workerProbe.error || "Unbekannter Fehler"}`
    );
    setDiagnosticDetails([...diagnosticLines]);

    if (!workerProbe.ok) {
      throw new Error(
        "Der lokale FFmpeg-Modul-Worker startet im Browser nicht. Das Problem liegt damit vor dem Core/WASM-Load."
      );
    }

    for (let cdnIndex = 0; cdnIndex < cdnSources.length; cdnIndex++) {
      const baseURL = cdnSources[cdnIndex];
      const ffmpeg = new FFmpeg();
      ffmpeg.on("log", ({ message }) => {
        console.log("[ffmpeg]", message);
        pushFfmpegLog(message);
      });

      try {
        console.log(`[ffmpeg] Trying CDN ${cdnIndex + 1}/${cdnSources.length}: ${baseURL}`);
        if (cdnIndex > 0) {
          setProgressMessage(
            isFirefox
              ? `FFmpeg wird in Firefox geladen (Alternativ-Server ${cdnIndex + 1})...`
              : `FFmpeg wird geladen (Alternativ-Server ${cdnIndex + 1})...`
          );
        }

        const loadPromise = (async () => {
          const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript");
          const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm");
          await ffmpeg.load({ classWorkerURL: ffmpegClassWorkerUrl, coreURL, wasmURL });
        })();

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), timeoutMs)
        );

        await Promise.race([loadPromise, timeoutPromise]);
        ffmpegRef.current = ffmpeg;
        console.log("[ffmpeg] Successfully loaded from", baseURL);
        return ffmpeg;
      } catch (err) {
        console.warn(`[ffmpeg] CDN ${cdnIndex + 1} failed:`, err);
        try {
          ffmpeg.terminate();
        } catch (terminateError) {
          console.warn("[ffmpeg] Worker cleanup after failed load failed:", terminateError);
        }
        if (cdnIndex === cdnSources.length - 1) {
          const blockerSuspected = cdnDiagnostics.every(
            (probe) => !probe.ok && (!probe.status || probe.status >= 400 || probe.error === "Timeout")
          );

          if (blockerSuspected) {
            throw new Error(
              "FFmpeg wurde wahrscheinlich durch Adblocker, VPN, Firewall oder Browser-Schutz blockiert. Bitte diese Blocker für jsDelivr/unpkg testweise deaktivieren oder den ZIP-Download nutzen."
            );
          }

          if (isFirefox) {
            throw new Error(
              "Firefox hat FFmpeg/WASM nicht rechtzeitig initialisiert. Das ist kein CDN-Problem. Bitte erneut versuchen, Firefox ohne strenge Schutz-Add-ons testen oder für das Zusammenfügen Chrome/Edge verwenden."
            );
          }

          throw new Error("FFmpeg konnte nicht rechtzeitig geladen werden. Nutze stattdessen den ZIP-Download oder versuche es erneut.");
        }
      }
    }

    throw new Error("FFmpeg konnte nicht geladen werden.");
  }, []);

  const mergeVideos = useCallback(async () => {
    if (videos.length === 0) return;

    setIsMerging(true);
    setError(null);
    setProgress(0);
    setDiagnosticDetails([]);
    setMergedVideoUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      return null;
    });
    setShowZipFallback(false);

    const inputFiles: string[] = [];
    const normalizedFiles: string[] = [];

    try {
      setProgressMessage("Prüfe Video-Größen...");
      const estimatedSizes = await Promise.all(
        videos.map(async ({ index, url }) => ({
          index,
          bytes: await getVideoSizeEstimate(url),
        }))
      );

      const oversizedVideo = estimatedSizes.find(
        (video) => video.bytes !== null && video.bytes > MAX_SINGLE_VIDEO_BYTES
      );
      if (oversizedVideo?.bytes) {
        throw new Error(
          `Video ${oversizedVideo.index + 1} ist mit ${formatBytes(oversizedVideo.bytes)} zu groß für Browser-Merging. Grenze: ${formatBytes(MAX_SINGLE_VIDEO_BYTES)} pro Video. Bitte ZIP nutzen oder dieses Video kleiner neu generieren.`
        );
      }

      const knownTotalBytes = estimatedSizes.reduce((sum, video) => sum + (video.bytes ?? 0), 0);
      if (knownTotalBytes > MAX_TOTAL_VIDEO_BYTES) {
        throw new Error(
          `Die bekannte Gesamtgröße liegt bei ${formatBytes(knownTotalBytes)}. Browser-Merging ist auf ${formatBytes(MAX_TOTAL_VIDEO_BYTES)} Gesamtgröße begrenzt. Bitte ZIP nutzen oder weniger/kleinere Videos zusammenfügen.`
        );
      }

      const ffmpeg = await loadFFmpeg();
      let downloadedTotalBytes = 0;

      // Phase 1: Download (0-30%)
      for (let i = 0; i < videos.length; i++) {
        const { url } = videos[i];
        setProgressMessage(`Video ${i + 1}/${videos.length} wird heruntergeladen...`);
        setProgress(Math.round((i / videos.length) * 30));

        const fileName = `input_${i}.mp4`;
        inputFiles.push(fileName);

        try {
          const fileData = await fetchVideoAsUint8Array(url);
          if (fileData.length === 0) {
            throw new Error("Leere Datei");
          }
          if (fileData.length > MAX_SINGLE_VIDEO_BYTES) {
            throw new Error(
              `Video ${videos[i].index + 1} ist mit ${formatBytes(fileData.length)} zu groß für Browser-Merging. Grenze: ${formatBytes(MAX_SINGLE_VIDEO_BYTES)} pro Video.`
            );
          }

          downloadedTotalBytes += fileData.length;
          if (downloadedTotalBytes > MAX_TOTAL_VIDEO_BYTES) {
            throw new Error(
              `Die Gesamtgroesse der heruntergeladenen Videos liegt bei ${formatBytes(downloadedTotalBytes)} und ueberschreitet die Grenze von ${formatBytes(MAX_TOTAL_VIDEO_BYTES)} fuer Browser-Merging.`
            );
          }

          console.log(`[ffmpeg] Downloaded video ${i + 1}: ${fileData.length} bytes`);
          await ffmpeg.writeFile(fileName, fileData);
        } catch (fetchErr) {
          console.error(`Failed to fetch video ${i + 1}:`, fetchErr);
          if (fetchErr instanceof Error && /zu gross|Gesamtgroesse/i.test(fetchErr.message)) {
            throw fetchErr;
          }
          if (url.startsWith("blob:")) {
            throw new Error(
              `Video ${videos[i].index + 1} ist nur als temporaerer Blob-Link vorhanden. Bitte dieses Video neu generieren und erneut zusammenfügen.`
            );
          }
          throw new Error(
            `Video ${videos[i].index + 1} konnte nicht geladen werden. Moeglicherweise ist der Link abgelaufen.`
          );
        }
      }

      // Phase 2: Normalize each video (30-70%)
      for (let i = 0; i < inputFiles.length; i++) {
        const input = inputFiles[i];
        const normalized = `norm_${i}.mp4`;
        normalizedFiles.push(normalized);

        setProgressMessage(`Video ${i + 1}/${videos.length} wird normalisiert...`);
        setProgress(30 + Math.round((i / inputFiles.length) * 40));

        try {
          await execFfmpegOrThrow(ffmpeg, [
            "-i",
            input,
            "-vf",
            "fps=24,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-g",
            "48",
            "-keyint_min",
            "48",
            "-sc_threshold",
            "0",
            "-an",
            "-movflags",
            "+faststart",
            "-y",
            normalized,
          ], `Normalisierung Szene ${videos[i].index + 1}`);

          console.log(`[ffmpeg] Normalized video ${i + 1}`);

          // Keep memory usage lower by deleting raw file after normalization.
          await tryDeleteFile(ffmpeg, input);
        } catch (normErr) {
          console.error(`Normalization failed for video ${i + 1}:`, normErr);
          throw new Error(
            `Video ${videos[i].index + 1} konnte nicht normalisiert werden. Das Format wird moeglicherweise nicht unterstuetzt.`
          );
        }
      }

      // Phase 3: Concat (70-90%)
      setProgressMessage("Videos werden zusammengefuegt...");
      setProgress(70);

      try {
        const concatInputs: string[] = [];
        for (const file of normalizedFiles) {
          concatInputs.push("-i", file);
        }
        const filterPrefix = normalizedFiles.map((_, idx) => `[${idx}:v]`).join("");
        const filterComplex = `${filterPrefix}concat=n=${normalizedFiles.length}:v=1:a=0[vout]`;

        await execFfmpegOrThrow(ffmpeg, [
          ...concatInputs,
          "-filter_complex",
          filterComplex,
          "-map",
          "[vout]",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
          "-r",
          "24",
          "-movflags",
          "+faststart",
          "-y",
          "output.mp4",
        ], "Filter-Concat");
      } catch (concatErr) {
        console.warn("[ffmpeg] Filter-Concat failed, trying demuxer fallback...", concatErr);
        setProgressMessage("Zusammenfuegen im Fallback-Modus...");

        const concatList = normalizedFiles.map((file) => `file '${file}'`).join("\n");
        await ffmpeg.writeFile("concat_list.txt", concatList);

        await execFfmpegOrThrow(ffmpeg, [
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          "concat_list.txt",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "23",
          "-pix_fmt",
          "yuv420p",
          "-r",
          "24",
          "-an",
          "-movflags",
          "+faststart",
          "-y",
          "output.mp4",
        ], "Concat-Fallback");
      }

      // Phase 4: Finalize (90-100%)
      setProgressMessage("Fertig! Video wird vorbereitet...");
      setProgress(90);

      const outputData = await ffmpeg.readFile("output.mp4");
      const outputBytes = new Uint8Array(outputData as Uint8Array);

      if (outputBytes.length === 0) {
        throw new Error("Zusammenfuegung ergab eine leere Datei.");
      }

      console.log(`[ffmpeg] Final output: ${outputBytes.length} bytes`);
      const blob = new Blob([outputBytes], { type: "video/mp4" });
      const blobUrl = URL.createObjectURL(blob);
      setMergedVideoUrl((previousUrl) => {
        if (previousUrl) {
          URL.revokeObjectURL(previousUrl);
        }
        return blobUrl;
      });

      setProgress(100);
      setProgressMessage("Zusammenfuegung abgeschlossen!");
    } catch (err) {
      console.error("Video merge failed:", err);
      const message = err instanceof Error ? err.message : "Zusammenfuegung fehlgeschlagen";
      const logTail = getFfmpegLogTail();
      setError(logTail && !message.includes("Logs:") ? `${message} | Letzte FFmpeg-Logs: ${logTail}` : message);
      setShowZipFallback(true);
    } finally {
      const ffmpeg = ffmpegRef.current;
      if (ffmpeg) {
        const allFiles = Array.from(
          new Set([...inputFiles, ...normalizedFiles, "concat_list.txt", "output.mp4"])
        );
        for (const file of allFiles) {
          await tryDeleteFile(ffmpeg, file);
        }
      }
      setIsMerging(false);
    }
  }, [videos, loadFFmpeg]);

  const downloadAsZip = useCallback(async () => {
    if (videos.length === 0) return;
    setIsZipping(true);
    setError(null);

    try {
      const zip = new JSZip();
      for (let i = 0; i < videos.length; i++) {
        setProgressMessage(`Video ${i + 1}/${videos.length} wird heruntergeladen...`);
        const data = await fetchVideoAsUint8Array(videos[i].url);
        if (data.length === 0) throw new Error(`Video ${i + 1} ist leer.`);
        zip.file(`szene_${videos[i].index + 1}.mp4`, data);
      }

      setProgressMessage("ZIP wird erstellt...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `storyboard_videos_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      setProgressMessage("");
    } catch (err) {
      console.error("ZIP download failed:", err);
      setError(err instanceof Error ? err.message : "ZIP-Download fehlgeschlagen");
    } finally {
      setIsZipping(false);
    }
  }, [videos]);

  const handleDownload = useCallback(() => {
    if (!mergedVideoUrl) return;
    const a = document.createElement("a");
    a.href = mergedVideoUrl;
    a.download = `storyboard_komplett_${Date.now()}.mp4`;
    a.click();
  }, [mergedVideoUrl]);

  if (videos.length < 2) return null;

  return (
    <Card className={cn("border-border/40 bg-gradient-to-br from-muted/30 to-muted/10", className)}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Endergebnis - Zusammengefuegtes Video</h3>
          </div>
          <div className="flex items-center gap-2">
            {mergedVideoUrl && (
              <>
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1.5" />
                  Download
                </Button>
                <Button size="sm" variant="ghost" onClick={mergeVideos} disabled={isMerging}>
                  <RotateCcw className="w-4 h-4 mr-1.5" />
                  Neu
                </Button>
              </>
            )}
            {!mergedVideoUrl && !isMerging && (
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={mergeVideos}>
                  <Play className="w-4 h-4 mr-1.5" />
                  Videos zusammenfuegen ({videos.length} Szenen)
                </Button>
                <Button size="sm" variant="outline" onClick={downloadAsZip} disabled={isZipping}>
                  <Archive className="w-4 h-4 mr-1.5" />
                  {isZipping ? "..." : "ZIP"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {(isMerging || isZipping) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">{progressMessage}</span>
            </div>
            {isMerging && <Progress value={progress} className="h-2" />}
          </div>
        )}

        {error && (
          <div className="flex flex-col gap-2 text-destructive text-xs bg-destructive/10 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
            {diagnosticDetails.length > 0 && (
              <div className="rounded border border-destructive/20 bg-background/50 p-2 text-[11px] text-muted-foreground">
                {diagnosticDetails.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            )}
            {showZipFallback && (
              <div className="flex items-center gap-2 mt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={downloadAsZip}
                  disabled={isZipping}
                >
                  <Archive className="w-3.5 h-3.5 mr-1" />
                  Stattdessen als ZIP herunterladen
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={mergeVideos}>
                  Erneut versuchen
                </Button>
              </div>
            )}
          </div>
        )}

        {mergedVideoUrl && (
          <div className="rounded-lg overflow-hidden bg-black/90 border border-border/30">
            <video
              ref={videoRef}
              src={mergedVideoUrl}
              className="w-full max-h-[400px] object-contain"
              controls
              autoPlay
              playsInline
            />
          </div>
        )}

        {!mergedVideoUrl && !isMerging && !isZipping && !error && (
          <div className="text-center py-6 text-muted-foreground">
            <Film className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-xs">
              Klicke auf "Videos zusammenfuegen", um alle {videos.length} Szenen-Videos zu einem Gesamtvideo zu kombinieren.
            </p>
            <p className="text-xs mt-1 text-muted-foreground/70">
              Die Verarbeitung erfolgt lokal in deinem Browser (Re-Encoding auf 720p). Alternativ als ZIP herunterladen.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
