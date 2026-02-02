# Plan: Vereinheitlichtes Story-Szenen-Bearbeitungs-UI

## ✅ Implementiert

Das Szenen-Bearbeitungs-Popup wurde komplett überarbeitet:

### Neue Features

1. **Tab-basiertes Popup** mit 3 Tabs:
   - **Inhalt**: Zusammenfassung, Beschreibung, Kamera-Settings, keyAction, emotion, specificArea
   - **Bild**: Generiertes Bild, Bild-Prompt, Regenerieren-Button
   - **Video**: Video-Prompt, Veo3 Kamerabewegung, Start/Bewegung/End-Frame

2. **Persistenter KI-Assistent** am unteren Rand:
   - Textarea für Anweisungen
   - Checkboxen: "Text & Kamera" und "Bild neu generieren"
   - Ein Klick aktualisiert alle ausgewählten Bereiche

3. **Quick-Actions auf Karten** (Hover-Overlay):
   - Maximize-Button für Details
   - RefreshCw-Button für Bild-Regeneration

4. **Neue bearbeitbare Felder**:
   - keyAction (Schlüsselaktion)
   - emotion (Emotion)
   - specificArea (Bereich im Hauptort)

### Geänderte Dateien
- `src/pages/Index.tsx`: State-Variablen, Tab-UI, persistenter KI-Assistent, Quick-Actions
