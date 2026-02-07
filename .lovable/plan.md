

# Video Prompt System - Umstrukturierung

## Zusammenfassung
Nach der Bildgenerierung wird der Hauptbutton zu "Video Prompt generieren" (erzeugt detaillierte 200-Woerter-Video-Prompts). Der bisherige "Bilder generieren"-Button wird zu "Bilder neu generieren" und wird kleiner, links neben dem Aspect-Ratio-Dropdown positioniert. Der gruene "Als final uebernehmen"-Button im Detail-Popup wird entfernt. Der Video-Prompt wird im Detail-Popup unter dem "Vorschau neu generieren"-Button angezeigt und kann ueber den vorhandenen KI-Assistenten bearbeitet werden.

---

## Aenderungen im Detail

### 1. Button-Umstrukturierung (Index.tsx, Bereich ~5135-5215)

**Vorher:** Ein grosser "Bilder generieren"-Button + Aspect-Ratio-Dropdown + "Alles loeschen"-Button, darunter "Fuer Veo3 exportieren".

**Nachher (wenn Bilder vorhanden):**

```text
+------------------------------------------------------------+
| [Bilder neu gen.] [16:9 v] [Video Prompt generieren ****] |
|                            [Alles loeschen]                |
| [Fuer Veo3 exportieren]                                    |
+------------------------------------------------------------+
```

- "Bilder neu generieren": `variant="outline"`, `size="sm"`, links neben dem Format-Dropdown
- "Video Prompt generieren": Primaerer Button (`variant="default"`), nimmt den meisten Platz ein (`flex-1`)
- Wenn noch keine Bilder generiert wurden, bleibt es bei "Bilder generieren" als alleiniger Button

### 2. Neuer Video-Prompt-Generierungsprozess (Index.tsx)

Eine neue Funktion `generateVideoPrompts` wird erstellt, die fuer jede Szene einen detaillierten ~200-Woerter-Video-Prompt generiert. Der Prompt fokussiert sich auf:
- Alle eingetragenen Szenen-Einstellungen (Emotion, Kamera, Shot, Bereich, Pose, etc.)
- Das generierte Bild als visuelle Grundlage
- Kamerabewegungen, Start-/Endzustand fuer nahtlose Uebergaenge

Dieser Prozess laeuft sequentiell durch alle Szenen und speichert den generierten `videoPrompt` in jedem StoryPoint.

### 3. Video-Prompt-Anzeige im Detail-Popup (StoryDetailPopup.tsx)

In der rechten Spalte (Preview Column), **unter** dem "Vorschau neu generieren"-Button:
- Neuer Bereich: Video-Prompt-Anzeige als `Textarea` (readonly mit Bearbeitungsmoeglichkeit)
- Kopier-Button zum schnellen Kopieren des Prompts
- Wird nur angezeigt, wenn ein `videoPrompt` vorhanden ist

### 4. KI-Assistent fuer Video-Prompt (StoryDetailPopup.tsx)

Der bestehende KI-Assistent am unteren Rand des Popups bekommt einen dritten Modus:
- "Text optimieren" (bestehend)
- "Bild regenerieren" (bestehend)
- **"Video Prompt"** (neu) - Sendet den aktuellen Video-Prompt zusammen mit Szenen-Kontext an die KI, um ihn zu ueberarbeiten/optimieren

### 5. "Als final uebernehmen" Button entfernen (StoryDetailPopup.tsx)

- Der gruene "Als final uebernehmen"-Button und die zugehoerige Logik (Finalize-Confirmation-Dialog, Discard-Button) werden aus der Preview-Column entfernt
- Die Props `onFinalizeScene` und `onDiscardChanges` bleiben vorerst erhalten (fuer moegliche zukuenftige Nutzung), werden aber nicht mehr in der UI angezeigt
- Der "Dirty State"-Banner am oberen Rand wird ebenfalls entfernt

---

## Technische Details

### Neue Funktion: `generateVideoPrompts` (Index.tsx)

```typescript
const generateVideoPrompts = async () => {
  if (!apiKey || storyPoints.length === 0) return;
  // Sequentiell durch alle Szenen
  for (let i = 0; i < storyPoints.length; i++) {
    const point = storyPoints[i];
    if (!point.generatedImage) continue;
    // Detaillierten 200-Woerter-Prompt generieren
    // basierend auf: allen Metadaten + Bildbeschreibung + vorheriger Szene
    const prompt = buildVideoPromptRequest(point, i);
    const response = await fetch(generateImageUrl, { mode: "text", prompt });
    // Parse und speichere videoPrompt
  }
};
```

### KI-Assistent - Dritter Modus (StoryDetailPopup.tsx)

```typescript
// Neuer Modus "video" im aiMode state
const [aiMode, setAiMode] = useState<"text" | "image" | "video">("text");

// Dritter Toggle-Button
<Button onClick={() => setAiMode("video")}>
  <Video /> Video Prompt
</Button>
```

### Props-Erweiterung StoryDetailPopup

```typescript
interface StoryDetailPopupProps {
  // ... bestehende Props
  onAssistantSubmit: (mode: "text" | "image" | "video") => void;
  // onFinalizeScene und onDiscardChanges bleiben, werden aber nicht in UI genutzt
}
```

### Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/pages/Index.tsx` | Button-Layout, neue `generateVideoPrompts` Funktion, neuer `onAssistantSubmit("video")` Handler |
| `src/components/StoryDetailPopup.tsx` | Video-Prompt-Anzeige in Preview, dritter KI-Modus, "Als final uebernehmen" Button entfernen, Dirty-State-Banner entfernen |

