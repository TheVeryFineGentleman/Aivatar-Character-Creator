

## Problem: Bild-Regenerierung übernimmt keine Änderungen

### Analyse

Nach Code-Review gibt es zwei mögliche Ursachen:

1. **`videoPrompt`-Änderungen werden nicht im Bild-Prompt berücksichtigt**: Wenn der Nutzer den `videoPrompt` (Beschreibungstext) ändert, wird `needsImageRegeneration = true` gesetzt, aber `buildSceneContext` verwendet nur `detailedDescription`, NICHT `videoPrompt`. Das Bild sieht also gleich aus, obwohl die UI anzeigt, dass Änderungen erkannt wurden.

2. **Fehlende Debug-Logs**: Es gibt keinen Log der zeigt, welche Feld-Werte tatsächlich an die KI geschickt werden — deshalb schwer nachvollziehbar, ob Änderungen ankommen.

### Lösung

**Datei: `src/pages/Index.tsx`**

#### 1. `buildSceneContext` erweitern — `videoPrompt` einbeziehen
Falls `videoPrompt` gesetzt ist, diesen als zusätzlichen Kontext für die Bild-Prompt-Generierung hinzufügen (z.B. `Video Context: ${point.videoPrompt}`). So fließen auch Änderungen am Video-Prompt in die Bildbeschreibung ein.

#### 2. Debug-Log vor Prompt-Generierung
In `regenerateSingleStoryScene` direkt nach Zeile 2858 einen `console.log` mit den wichtigsten Feldern des `point`-Objekts einfügen (detailedDescription, emotion, keyAction, cameraAngle, shotType, videoPrompt), um nachvollziehen zu können, welche Werte tatsächlich verwendet werden.

### Technische Details

```text
buildSceneContext(point, sceneIndex):
  ...bestehende Felder...
  + if (point.videoPrompt) → "Video/Scene Context: ${point.videoPrompt}"

regenerateSingleStoryScene:
  const point = updatedPoint || storyPointsRef.current[sceneIndex];
  + console.log("🔍 Regenerating with point data:", {
      detailedDescription, emotion, keyAction, cameraAngle, shotType, videoPrompt
    });
  → generateImagePromptViaAI(point, sceneIndex)
```

