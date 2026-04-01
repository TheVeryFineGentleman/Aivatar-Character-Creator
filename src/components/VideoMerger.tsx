import React, { useState, useRef, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, Film, Loader2, AlertCircle, Play, RotateCcw, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoMergerProps {
  videos: { index: number; url: string }[];
  className?: string;
}

async function fetchVideoAsUint8Array(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

export const VideoMerger: React.FC<VideoMergerProps> = ({ videos, className }) => {
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showZipFallback, setShowZipFallback] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => {
      console.log("[ffmpeg]", message);
    });

    setProgressMessage("FFmpeg wird geladen (~30 MB)...");

    const cdnSources = [
      "https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@0.12.6/dist/umd",
      "https://unpkg.com/@ffmpeg/core-st@0.12.6/dist/umd",
    ];
    const timeoutMs = 120000;

    for (let cdnIndex = 0; cdnIndex < cdnSources.length; cdnIndex++) {
      const baseURL = cdnSources[cdnIndex];
      try {
        console.log(`[ffmpeg] Trying CDN ${cdnIndex + 1}/${cdnSources.length}: ${baseURL}`);
        if (cdnIndex > 0) {
          setProgressMessage(`FFmpeg wird geladen (Alternativ-Server ${cdnIndex + 1})...`);
        }

        const loadPromise = (async () => {
          const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript");
          const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm");
          await ffmpeg.load({ coreURL, wasmURL });
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
        if (cdnIndex === cdnSources.length - 1) {
          throw new Error("FFmpeg konnte nicht geladen werden. Nutze stattdessen den ZIP-Download.");
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
    setMergedVideoUrl(null);
    setShowZipFallback(false);

    const inputFiles: string[] = [];
    const normalizedFiles: string[] = [];

    try {
      const ffmpeg = await loadFFmpeg();

      // Phase 1: Download (0-30%)
      for (let i = 0; i < videos.length; i++) {
        const { url, index } = videos[i];
        setProgressMessage(`Video ${i + 1}/${videos.length} wird heruntergeladen...`);
        setProgress(Math.round((i / videos.length) * 30));

        const fileName = `input_${index}.mp4`;
        inputFiles.push(fileName);

        try {
          const fileData = await fetchVideoAsUint8Array(url);
          if (fileData.length === 0) {
            throw new Error("Leere Datei");
          }
          console.log(`[ffmpeg] Downloaded video ${i + 1}: ${fileData.length} bytes`);
          await ffmpeg.writeFile(fileName, fileData);
        } catch (fetchErr) {
          console.error(`Failed to fetch video ${i + 1}:`, fetchErr);
          throw new Error(`Video ${i + 1} konnte nicht geladen werden. Möglicherweise ist der Download-Link abgelaufen.`);
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
          await ffmpeg.exec([
            "-i", input,
            "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black",
            "-r", "24",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "23",
            "-an",
            "-movflags", "+faststart",
            "-y",
            normalized,
          ]);

          // Verify output exists and has size
          const normData = await ffmpeg.readFile(normalized);
          if ((normData as Uint8Array).length === 0) {
            throw new Error("Normalisierung ergab leere Datei");
          }
          console.log(`[ffmpeg] Normalized video ${i + 1}: ${(normData as Uint8Array).length} bytes`);
        } catch (normErr) {
          console.error(`Normalization failed for video ${i + 1}:`, normErr);
          throw new Error(`Video ${i + 1} konnte nicht normalisiert werden. Das Format wird möglicherweise nicht unterstützt.`);
        }
      }

      // Phase 3: Concat (70-90%)
      setProgressMessage("Videos werden zusammengefügt...");
      setProgress(70);

      const concatList = normalizedFiles.map(f => `file '${f}'`).join("\n");
      await ffmpeg.writeFile("concat_list.txt", concatList);

      await ffmpeg.exec([
        "-f", "concat",
        "-safe", "0",
        "-i", "concat_list.txt",
        "-c", "copy",
        "-movflags", "+faststart",
        "-y",
        "output.mp4",
      ]);

      // Phase 4: Finalize (90-100%)
      setProgressMessage("Fertig! Video wird vorbereitet...");
      setProgress(90);

      const outputData = await ffmpeg.readFile("output.mp4");
      const outputBytes = new Uint8Array(outputData as Uint8Array);

      if (outputBytes.length === 0) {
        throw new Error("Zusammenfügung ergab eine leere Datei.");
      }

      console.log(`[ffmpeg] Final output: ${outputBytes.length} bytes`);
      const blob = new Blob([outputBytes], { type: "video/mp4" });
      const blobUrl = URL.createObjectURL(blob);
      setMergedVideoUrl(blobUrl);
      setProgress(100);
      setProgressMessage("Zusammenfügung abgeschlossen!");

    } catch (err) {
      console.error("Video merge failed:", err);
      setError(err instanceof Error ? err.message : "Zusammenfügung fehlgeschlagen");
      setShowZipFallback(true);
    } finally {
      // Cleanup all temp files
      const ffmpeg = ffmpegRef.current;
      if (ffmpeg) {
        const allFiles = [...inputFiles, ...normalizedFiles, "concat_list.txt", "output.mp4"];
        for (const f of allFiles) {
          try { await ffmpeg.deleteFile(f); } catch {}
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
            <h3 className="text-sm font-semibold text-foreground">Endergebnis – Zusammengefügtes Video</h3>
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
                  Videos zusammenfügen ({videos.length} Szenen)
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
            {showZipFallback && (
              <div className="flex items-center gap-2 mt-1">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={downloadAsZip} disabled={isZipping}>
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
              Klicke auf "Videos zusammenfügen" um alle {videos.length} Szenen-Videos zu einem Gesamtvideo zu kombinieren.
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
