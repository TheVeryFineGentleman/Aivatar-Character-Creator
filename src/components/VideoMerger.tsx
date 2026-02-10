import React, { useState, useRef, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Download, Film, Loader2, AlertCircle, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoMergerProps {
  videos: { index: number; url: string }[];
  className?: string;
}

export const VideoMerger: React.FC<VideoMergerProps> = ({ videos, className }) => {
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [mergedVideoUrl, setMergedVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    
    const ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress: p }) => {
      setProgress(Math.round(p * 100));
    });
    ffmpeg.on("log", ({ message }) => {
      console.log("[ffmpeg]", message);
    });

    setProgressMessage("FFmpeg wird geladen...");
    await ffmpeg.load({
      coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
      wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
    });
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  }, []);

  const mergeVideos = useCallback(async () => {
    if (videos.length === 0) return;

    setIsMerging(true);
    setError(null);
    setProgress(0);
    setMergedVideoUrl(null);

    try {
      const ffmpeg = await loadFFmpeg();

      // Download and write each video to ffmpeg's virtual filesystem
      const fileNames: string[] = [];
      for (let i = 0; i < videos.length; i++) {
        const { url, index } = videos[i];
        setProgressMessage(`Video ${i + 1}/${videos.length} wird heruntergeladen...`);
        setProgress(Math.round((i / videos.length) * 40));

        const fileName = `input_${index}.mp4`;
        fileNames.push(fileName);

        try {
          const fileData = await fetchFile(url);
          await ffmpeg.writeFile(fileName, fileData);
        } catch (fetchErr) {
          console.error(`Failed to fetch video ${i + 1}:`, fetchErr);
          throw new Error(`Video ${i + 1} konnte nicht geladen werden. Möglicherweise ist der Download-Link abgelaufen.`);
        }
      }

      // Create concat list file
      setProgressMessage("Videos werden zusammengefügt...");
      setProgress(50);

      const concatList = fileNames.map(f => `file '${f}'`).join("\n");
      await ffmpeg.writeFile("concat_list.txt", concatList);

      // Run concat command
      await ffmpeg.exec([
        "-f", "concat",
        "-safe", "0",
        "-i", "concat_list.txt",
        "-c", "copy",
        "-movflags", "+faststart",
        "output.mp4"
      ]);

      setProgressMessage("Fertig! Video wird vorbereitet...");
      setProgress(90);

      // Read the output file
      const outputData = await ffmpeg.readFile("output.mp4");
      const blob = new Blob([new Uint8Array(outputData as Uint8Array)], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setMergedVideoUrl(url);
      setProgress(100);
      setProgressMessage("Zusammenfügung abgeschlossen!");

      // Cleanup ffmpeg filesystem
      for (const fileName of fileNames) {
        try { await ffmpeg.deleteFile(fileName); } catch {}
      }
      try { await ffmpeg.deleteFile("concat_list.txt"); } catch {}
      try { await ffmpeg.deleteFile("output.mp4"); } catch {}

    } catch (err) {
      console.error("Video merge failed:", err);
      setError(err instanceof Error ? err.message : "Zusammenfügung fehlgeschlagen");
    } finally {
      setIsMerging(false);
    }
  }, [videos, loadFFmpeg]);

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
              <Button size="sm" onClick={mergeVideos}>
                <Play className="w-4 h-4 mr-1.5" />
                Videos zusammenfügen ({videos.length} Szenen)
              </Button>
            )}
          </div>
        </div>

        {/* Progress */}
        {isMerging && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">{progressMessage}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={mergeVideos}>
              Erneut versuchen
            </Button>
          </div>
        )}

        {/* Merged Video Player */}
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

        {/* Info when not yet merged */}
        {!mergedVideoUrl && !isMerging && !error && (
          <div className="text-center py-6 text-muted-foreground">
            <Film className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-xs">
              Klicke auf "Videos zusammenfügen" um alle {videos.length} Szenen-Videos zu einem Gesamtvideo zu kombinieren.
            </p>
            <p className="text-xs mt-1 text-muted-foreground/70">
              Die Verarbeitung erfolgt lokal in deinem Browser.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
