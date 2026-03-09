

# Mobile-Optimierung des AvatarCreatorStudio

Die App ist aktuell primär für Desktop gebaut. Hier sind die konkreten Problembereiche und die geplanten Anpassungen:

## Hauptprobleme auf Mobile

1. **4-Spalten-Grid für Optionen (Bildformat, Aufnahme-Typ, etc.)** - `grid-cols-4` bricht auf kleinen Screens
2. **Generate-Buttons-Reihe** - `flex gap-3` mit 3 Buttons nebeneinander wird zu eng
3. **Header-Elemente** - Version-Indicator und Settings-Buttons überlappen sich bei kleinem Screen
4. **Story-Tab Layout** - Story-Idee und AI-Assistent nebeneinander (`flex gap-4`) passt nicht auf Mobile
5. **Image Gallery Grid** - `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` ist okay, aber Detail-Dialog braucht Anpassung
6. **StoryDetailPopup** - Komplexes mehrspaltige Layout, nicht mobilfähig
7. **Textareas mit fester Breite** - z.B. `w-[calc(3*120px+2*4px)]` für Szenerie-Beschreibung
8. **Fullscreen Lightbox** - Zoom-Interaktionen Touch-basiert anpassen
9. **Container Padding** - `px-4 py-8` ist okay, aber absolute positioned Elemente (top-4 left-4/right-4) kollidieren

## Geplante Änderungen

### 1. Index.tsx - Responsive Grid & Layout Fixes
- **Options-Grid**: `grid-cols-4` → `grid-cols-2 md:grid-cols-4` 
- **Generate-Buttons**: Auf Mobile vertikal stapeln (`flex-col sm:flex-row`)
- **Header-Bereich**: Version + Credits nach unten verschieben auf Mobile, oder kleiner machen
- **Story-Layout**: `flex gap-4` → `flex flex-col md:flex-row gap-4`
- **Szenerie-Textarea**: Feste Breite entfernen, `w-full` auf Mobile
- **Custom Prompt Layout**: Auf Mobile vertikal stapeln
- **Title**: `text-4xl sm:text-5xl` ist bereits responsive - gut

### 2. ImageGallery.tsx - Bereits responsive
- Grid ist schon `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` - passt

### 3. StoryDetailPopup.tsx - Mobile Layout
- Mehrspaltige Layouts auf Mobile zu single-column
- Dialog-Größe auf Mobile fullscreen

### 4. FullscreenLightbox.tsx - Touch Support
- Pinch-to-zoom als Alternative zum Mausrad
- Touch-Drag für Pan-Funktion

### 5. DownloadButton.tsx - Mobile Touch
- Dropdown-Trigger muss auf Touch funktionieren (sollte bereits gehen mit Radix)

### 6. Allgemeine CSS-Anpassungen
- Container max-width und Padding für kleine Screens
- Buttons mit abgekürzten Labels auf Mobile wo nötig

## Technischer Ansatz

Alle Änderungen nutzen Tailwind responsive Breakpoints (`sm:`, `md:`, `lg:`). Keine neuen Abhängigkeiten nötig. Touch-Events für Lightbox über native `onTouchStart/Move/End`.

Dateien die geändert werden:
- `src/pages/Index.tsx` - Hauptlayout-Fixes (Grid, Buttons, Abstände)
- `src/components/FullscreenLightbox.tsx` - Touch-Zoom/Pan
- `src/components/StoryDetailPopup.tsx` - Mobile single-column Layout
- `src/components/ImageSlot.tsx` - Eventuell kleinere Touch-Targets

