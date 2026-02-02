
# Plan: Vereinheitlichtes Story-Szenen-Bearbeitungs-UI

## Analyse der aktuellen Probleme

### 1. Verstreute UI-Elemente
Das aktuelle Popup enthält viele separate Bereiche:
- Zusammenfassung (Textarea)
- Detaillierte Beschreibung (Textarea)
- Bild-Prompt (Textarea)
- Video-Prompt (Textarea)
- Veo3 Kamerabewegung (Select + 3 Textareas)
- Kamerawinkel + Shot-Typ (2 Selects)
- KI-Assistent (Textarea + Button)

Der Nutzer muss scrollen und zwischen vielen Feldern wechseln.

### 2. Fehlende Integration
- Der KI-Assistent ändert nur Text + Kamera-Settings
- Das Bild muss separat neu generiert werden
- Keine "Alles aktualisieren" Option

### 3. Ungenutzte Animation
- Die Flip-Animation wird nur bei Text-Regeneration verwendet
- Bei Bild-Regeneration fehlt visuelles Feedback

---

## Lösungskonzept

### A. Kompaktes Tab-basiertes Popup

Das Popup wird in **3 Tabs** unterteilt:

```text
+--------------------------------------------------+
|  Szene 1                       [1/3] [↻] [X]    |
+--------------------------------------------------+
|  [Inhalt]  [Bild]  [Video]                       |
+--------------------------------------------------+
|                                                   |
|   [Tab-Inhalt hier]                              |
|                                                   |
+--------------------------------------------------+
|   [KI-Assistent Panel - immer sichtbar]          |
|   +--------------------------------------------+ |
|   |  "Mache es dramatischer..."        [✨]    | |
|   +--------------------------------------------+ |
|   |  ☐ Text anpassen  ☐ Bild neu  ☐ Video neu | |
|   +--------------------------------------------+ |
+--------------------------------------------------+
```

**Tab 1: Inhalt**
- Zusammenfassung (kurz)
- Detaillierte Szenen-Beschreibung
- Kamerawinkel + Shot-Typ (nebeneinander)
- keyAction + emotion + specificArea (kompakt)

**Tab 2: Bild**
- Generiertes Bild (groß)
- Detaillierter Bild-Prompt (bearbeitbar)
- "Bild neu generieren" Button

**Tab 3: Video**
- Video-Prompt
- Veo3 Kamerabewegung
- Start-Frame, Bewegung, End-Frame

### B. Vereinheitlichter KI-Assistent (immer sichtbar)

Ein persistenter KI-Assistent am unteren Rand des Popups:

```text
+--------------------------------------------------+
| 🤖 KI-Assistent                                  |
+--------------------------------------------------+
| "Mache die Szene romantischer und nutze ein     |
|  Close-Up mit Gegenlicht"                [✨]    |
+--------------------------------------------------+
| Was soll aktualisiert werden?                    |
| [✓] Szenen-Text   [✓] Kamera   [ ] Bild neu    |
+--------------------------------------------------+
| [Szene anpassen]                                 |
+--------------------------------------------------+
```

**Funktionsweise:**
1. Nutzer gibt Anweisung ein
2. Wählt aus: Text, Kamera-Settings, Bild neu generieren
3. Ein Klick → KI optimiert alles Ausgewählte
4. Optional: Bild wird automatisch neu generiert

### C. Quick-Actions auf der Karte

Auf jeder Storyboard-Karte:
- **Hover-Overlay** mit 3 Icons: Bearbeiten, Bild regenerieren, Löschen
- Kein Vollbild-Popup nötig für einfache Bild-Regeneration

### D. Konsistente Animationen

- **Flip-Animation** bei jeder Regeneration (Text ODER Bild)
- **Loader auf dem Bild** während der Generierung
- **Grüner Checkmark** nach erfolgreicher Generierung

---

## Technische Umsetzung

### Datei: `src/pages/Index.tsx`

#### Schritt 1: Neue State-Variablen für Tabs und Checkboxen

```typescript
// Scene edit tabs
const [sceneEditTab, setSceneEditTab] = useState<"content" | "image" | "video">("content");

// AI Assistant update targets
const [sceneAiUpdateText, setSceneAiUpdateText] = useState(true);
const [sceneAiUpdateCamera, setSceneAiUpdateCamera] = useState(true);
const [sceneAiRegenerateImage, setSceneAiRegenerateImage] = useState(false);
```

#### Schritt 2: Erweiterter KI-Assistent Handler

```typescript
const handleUnifiedSceneAssistant = async () => {
  // 1. Text & Kamera optimieren (wenn ausgewählt)
  if (sceneAiUpdateText || sceneAiUpdateCamera) {
    await handleSceneAssistant(); // Vorhandene Funktion
  }
  
  // 2. Bild neu generieren (wenn ausgewählt)
  if (sceneAiRegenerateImage && expandedStoryPointIndex !== null) {
    await regenerateSingleStoryScene(expandedStoryPointIndex);
  }
};
```

#### Schritt 3: Popup-UI mit Tabs

Das bestehende Popup (~Zeile 5230-5640) wird umstrukturiert:

```tsx
{/* Tab Navigation */}
<div className="border-b border-border/30 px-4">
  <Tabs value={sceneEditTab} onValueChange={setSceneEditTab}>
    <TabsList className="bg-transparent">
      <TabsTrigger value="content">Inhalt</TabsTrigger>
      <TabsTrigger value="image">Bild</TabsTrigger>
      <TabsTrigger value="video">Video</TabsTrigger>
    </TabsList>
  </Tabs>
</div>

{/* Tab Content */}
<div className="p-4 flex-1 overflow-y-auto">
  {sceneEditTab === "content" && (
    // Zusammenfassung, Beschreibung, Kamera-Settings, keyAction, emotion
  )}
  {sceneEditTab === "image" && (
    // Großes Bild + Bild-Prompt + Regenerieren-Button
  )}
  {sceneEditTab === "video" && (
    // Video-Prompt + Veo3 Details
  )}
</div>

{/* Persistent AI Assistant at bottom */}
<div className="border-t border-border/30 p-4 bg-muted/10">
  // KI-Assistent mit Checkboxen
</div>
```

#### Schritt 4: Karten Quick-Actions

Hover-Overlay auf jeder Karte:

```tsx
{/* Quick Action Overlay on hover */}
<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
  <Button size="icon" variant="secondary" onClick={() => setExpandedStoryPointIndex(index)}>
    <Maximize2 className="w-4 h-4" />
  </Button>
  <Button size="icon" variant="secondary" onClick={() => regenerateSingleStoryScene(index)}>
    <RefreshCw className="w-4 h-4" />
  </Button>
</div>
```

---

## Änderungsliste

| Bereich | Änderung |
|---------|----------|
| **State** | Neue State-Variablen für Tabs und Checkboxen |
| **Popup Header** | Bleibt gleich (Szene X, Version, Close) |
| **Popup Body** | Tab-System mit 3 Tabs |
| **KI-Assistent** | Persistent am unteren Rand mit Checkboxen |
| **Karten** | Quick-Action Overlay beim Hover |
| **Animationen** | Flip bei Text UND Bild Regeneration |
| **Handler** | `handleUnifiedSceneAssistant` kombiniert Text + Bild |

---

## Erwartetes Ergebnis

Nach der Implementierung:
- Das Popup ist übersichtlicher durch Tab-System
- Alle Szenen-Aspekte sind auf einem Blick bearbeitbar
- Der KI-Assistent kann alles auf einmal anpassen
- Bild-Regeneration ist mit einem Klick möglich
- Konsistente Flip-Animation bei allen Regenerationen
- Quick-Actions auf den Karten für schnelle Änderungen

---

## Wireframe des neuen Popups

```text
+----------------------------------------------------------+
|  Szene 2 von 4                    [◀ 1/2 ▶] [↻] [✕]     |
+----------------------------------------------------------+
|  [📝 Inhalt]   [🖼️ Bild]   [🎬 Video]                    |
+----------------------------------------------------------+
|                                                           |
|  📖 Zusammenfassung                                       |
|  +-----------------------------------------------------+  |
|  | Eine Frau steht nachdenklich am Fenster...          |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  📋 Detaillierte Beschreibung                             |
|  +-----------------------------------------------------+  |
|  | Sie lehnt am Fensterrahmen, draußen fällt Regen... |  |
|  +-----------------------------------------------------+  |
|                                                           |
|  [Kamerawinkel: Seitlich ▼]  [Shot-Typ: Medium Shot ▼]   |
|                                                           |
|  🎯 Schlüsselaktion          😊 Emotion                   |
|  +----------------------+    +----------------------+     |
|  | lehnt am Fenster     |    | melancholisch        |     |
|  +----------------------+    +----------------------+     |
|                                                           |
+----------------------------------------------------------+
| 🤖 KI-Assistent                                          |
+----------------------------------------------------------+
| +------------------------------------------------------+ |
| | Mache die Szene dramatischer mit Gegenlicht...       | |
| +------------------------------------------------------+ |
|                                                           |
| Was aktualisieren?                                        |
| [✓] Szenen-Text  [✓] Kamera-Settings  [ ] Bild neu      |
|                                                           |
|                    [✨ Szene anpassen]                    |
+----------------------------------------------------------+
```
