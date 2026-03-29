

## Problem

FFmpeg `concat` mit `-c copy` scheitert, weil die einzelnen Videos von der Veo API unterschiedliche Codecs, Auflösungen, Frameraten oder Container-Formate haben können. Der `-c copy`-Modus kopiert nur die Streams ohne Re-Encoding — das funktioniert nur bei **exakt identischen** Video-Parametern.

Zusätzlich kommen Videos als Blob-URLs oder Base64 Data-URLs an, was bei `fetchFile` Probleme verursachen kann.

## Lösung

### VideoMerger.tsx komplett überarbeiten

**1. Re-Encoding statt Stream-Copy:**
Statt `-c copy` jedes Video einzeln auf ein einheitliches Format normalisieren und dann zusammenfügen:

```
// Für jedes Input-Video erst normalisieren:
ffmpeg.exec([
  "-i", inputFile,
  "-vf", "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2",
  "-r", "24",
  "-c:v", "libx264",
  "-preset", "fast",
  "-crf", "23",
  "-c:a", "aac",
  "-ar", "44100",
  "-ac", "2",
  "-shortest",
  normalizedFile
]);

// Dann concat mit den normalisierten Files
ffmpeg.exec([
  "-f", "concat", "-safe", "0",
  "-i", "concat_list.txt",
  "-c", "copy",
  "-movflags", "+faststart",
  "output.mp4"
]);
```

**2. Robuste Video-Download-Logik:**
- Blob-URLs und Data-URLs korrekt via `fetchFile` oder direktem `fetch` + `arrayBuffer` laden
- Dateigröße nach Download prüfen (> 0 Bytes)
- Fehler pro Video abfangen mit klarer Meldung

**3. Fortschrittsanzeige anpassen:**
- Download-Phase: 0-30%
- Normalisierung: 30-70%
- Concat: 70-90%
- Finalisierung: 90-100%

**4. Cleanup aller temporären Dateien** (input + normalized + concat_list + output)

### Betroffene Datei
- **`src/components/VideoMerger.tsx`** — komplette Überarbeitung der `mergeVideos`-Funktion

