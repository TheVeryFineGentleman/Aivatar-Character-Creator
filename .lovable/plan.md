

## Versions-System für den Story Generator (StoryDetailPopup)

### Konzept

Jede Szene bekommt ein Array von "Szenen-Versionen". Beim Speichern/Regenerieren wird der aktuelle Zustand als neue Version gespeichert. Der Nutzer kann zwischen Versionen navigieren. Beim Schließen mit ungespeicherten Änderungen erscheint ein Warn-Popup.

### Änderungen

**1. StoryPoint-Typ erweitern** (`src/pages/Index.tsx` + `src/components/StoryDetailPopup.tsx`)

Neues Feld im StoryPoint-Interface:
- `sceneVersions: Array<Partial<StoryPoint>>` — Array aller gespeicherten Szenen-Snapshots
- `currentSceneVersion: number` — Index der aktuell angezeigten Version

**2. Versions-Navigation im Header** (`src/components/StoryDetailPopup.tsx`)

Im Sticky Header zwischen Szenen-Navigation und Close-Button:
- Links-Pfeil / "1/3" / Rechts-Pfeil Anzeige
- Pfeile navigieren durch gespeicherte Versionen
- Bei Version-Wechsel werden alle Felder der Szene auf die gewählte Version zurückgesetzt

**3. Version erstellen beim Speichern**

Bei jedem Klick auf "Speichern + Bild neu generieren" oder "Speichern + Video neu generieren":
- Aktueller Zustand wird als neuer Snapshot in `sceneVersions` gepusht
- `currentSceneVersion` wird auf den neuesten Index gesetzt
- Neue Version erscheint erst NACH dem Speichern

**4. Warn-Dialog beim Schließen mit ungespeicherten Änderungen** (`src/components/StoryDetailPopup.tsx`)

Neuer AlertDialog der erscheint, wenn `onClose` aufgerufen wird und es ungespeicherte Änderungen gibt (`needsImageRegeneration || hasTextChanges`):
- Titel: "Ungespeicherte Änderungen"
- Text: "Du hast Änderungen vorgenommen die noch nicht gespeichert wurden."
- Button 1: "Speichern & Schließen" — speichert als neue Version, dann schließt
- Button 2: "Zurücksetzen & Schließen" — verwirft Änderungen, setzt auf letzte Version zurück
- Button 3: "Abbrechen" — bleibt im Popup

### Technische Details

```text
StoryPoint {
  ...existing fields...
  sceneVersions: Array<Partial<StoryPoint>>  // Snapshots aller Versionen
  currentSceneVersion: number                 // Aktuelle Version (0-basiert)
}

Header Layout:
[← Zurück] [Szene 2/5] [Weiter →]   [◀ 1/3 ▶]   [Status] [X]

Version-Snapshot enthält: summary, detailedDescription, dialogText,
videoPrompt, cameraAngle, shotType, emotion, keyAction, specificArea,
composition, movement, negativePrompts, styleNotes, generatedImage,
generatedVideo, detailedImagePrompt
```

**Dateien:**
- `src/components/StoryDetailPopup.tsx` — Versions-Navigation UI, Close-Warning Dialog, Version-Wechsel Logik
- `src/pages/Index.tsx` — StoryPoint-State um `sceneVersions`/`currentSceneVersion` erweitern, Speicher-Callbacks anpassen um Versionen zu erstellen

