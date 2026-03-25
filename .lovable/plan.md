

## Problem: Neu generiertes Bild wird nicht angezeigt

### Ursache

Zwei Probleme:

1. **Timeout zu kurz**: Der 40s-Timeout deckt sowohl die AI-Prompt-Generierung als auch die Bildgenerierung ab. Die Edge Function braucht aber oft 40s+ allein fürs Bild. Der Client bricht ab, bevor das Bild ankommt → Fehler wird gesetzt, altes Bild bleibt.

2. **Altes Bild wird nicht gelöscht bei Start**: Wenn die Regenerierung startet, bleibt `generatedImage` auf dem alten Wert. Bei Timeout/Fehler wird nur `generationError` gesetzt — das alte Bild bleibt sichtbar.

### Lösungsplan

**Datei:** `src/pages/Index.tsx`

#### 1. Timeout erhöhen
In `regenerateSingleStoryScene` den Timeout von 40s auf 120s erhöhen (gleich wie bei der Erstgenerierung), damit die Bildgenerierung nicht vorzeitig abgebrochen wird.

#### 2. Altes Bild beim Start der Regenerierung löschen
Beim Start von `regenerateSingleStoryScene` das alte `generatedImage` clearen (auf `undefined` setzen), sodass während der Generierung kein altes Bild angezeigt wird. Die StoryDetailPopup zeigt dann den Ladezustand statt des alten Bildes.

#### 3. previousSceneImage auf Ref umstellen
Zeile 2884: `storyPoints[sceneIndex - 1]` durch `storyPointsRef.current[sceneIndex - 1]` ersetzen für Konsistenz.

### Technische Details

```text
regenerateSingleStoryScene(sceneIndex):
  1. generatedImage = undefined    ← NEU: altes Bild sofort löschen
  2. timeout = 120000              ← FIX: von 40s auf 120s
  3. generateImagePromptViaAI()
  4. fetch generate-image
  5. generatedImage = newUrl       ← neues Bild setzen
```

