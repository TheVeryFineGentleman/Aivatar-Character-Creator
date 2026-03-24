

## Speichern/Regenerieren-Button Logik überarbeiten

### Aktuelles Problem
Aktuell gibt es immer einen "Vorschau neu generieren" Button und einen separaten "Video neu generieren" Button — unabhängig davon, ob bereits ein Video existiert oder was sich geändert hat.

### Neue Logik

Die Buttons in der Preview-Spalte sollen kontextabhängig sein. Es gibt immer **nur 1 Hauptbutton**, der sich je nach Zustand ändert:

#### Zustand 1: Kein Video generiert (`!point.generatedVideo`)
- **Keine Änderung** → Kein Button (oder nur "Vorschau neu generieren" als outline)
- **Nur Text-Änderung** (dialogText/videoPrompt) → **"Änderungen speichern"** (Save-Icon, speichert nur Text-Snapshot)
- **Bild-relevante Änderung** (isDirty: Kamera, Emotion, etc.) → **"Speichern + Bild neu generieren"** (RefreshCw-Icon, orange hervorgehoben)

#### Zustand 2: Video existiert (`point.generatedVideo`)
- **Keine Änderung** → Kein Button
- **Nur Sprechertext-Änderung** (nur dialogText geändert) → **"Video neu generieren"** (Video-Icon) — kein neues Bild nötig, nur Video mit neuem Dialog-Prompt
- **Andere Änderung** (Kamera, Emotion, etc. — isDirty) → **"Bild + Video neu generieren"** (RefreshCw + Video-Icon, orange) — erst Bild regenerieren, dann automatisch Video

### Technische Umsetzung

**Datei:** `src/components/StoryDetailPopup.tsx`

1. **Neue Hilfsvariablen** im Component berechnen:
   - `hasVideo = !!point.generatedVideo`
   - `onlyDialogChanged` — prüft ob nur `dialogText` sich geändert hat (nicht videoPrompt oder bild-relevante Felder)
   - Bestehende `isDirty` (bild-relevante Felder) und `hasTextChanges` (dialogText + videoPrompt) weiter nutzen

2. **Bisherigen "Regenerate Button" Block (Zeilen 643-650) und "Video Regenerate Button" (Zeilen 678-698) entfernen** und durch einen einzigen kontextabhängigen Button ersetzen

3. **Neuer Button-Block:**
   - Wenn `!hasVideo`:
     - `isDirty` → "Speichern + Bild neu generieren" → `onRegenerateImage()`
     - `hasTextChanges && !isDirty` → "Änderungen speichern" → nur Snapshot updaten
     - Sonst → normaler outline "Vorschau neu generieren" Button
   - Wenn `hasVideo`:
     - `isDirty` → "Bild + Video neu generieren" → `onRegenerateImage()` dann `onRegenerateVideo()`
     - `onlyDialogChanged` → "Video neu generieren" → nur `onRegenerateVideo()`
     - Sonst → kein Button oder dezenter "Video neu generieren"

4. **`handleSave` anpassen** um bei Video-Existenz nach Bild-Regenerierung automatisch Video-Regenerierung anzustoßen (ggf. über Callback/Effect)

