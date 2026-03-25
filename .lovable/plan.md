

## Problem: Veränderungen werden bei Video-Regenerierung nicht übernommen

### Ursache

Zwei zusammenhängende Probleme:

1. **Veralteter State (Stale Closure)**: `regenerateSingleVideo` liest `storyPoints[sceneIndex]` aus dem Closure-Kontext — das ist der Zustand zum Zeitpunkt des letzten Renderings, nicht der aktuelle mit den Änderungen. Die Änderungen wurden zwar via `onUpdateStoryPoint` gesetzt, aber die Funktion "sieht" sie nicht.

2. **Video-Prompt wird nicht neu generiert**: Wenn der Sprechertext (`dialogText`) geändert wird, wird der `videoPrompt` nicht aktualisiert. Das Video wird mit dem alten Prompt generiert, der den alten Dialog enthält.

### Lösungsplan

#### 1. storyPointsRef statt storyPoints verwenden
**Datei:** `src/pages/Index.tsx`

In `regenerateSingleVideo` (Zeile 2402) den `point` aus `storyPointsRef.current[sceneIndex]` lesen statt aus `storyPoints[sceneIndex]`. Der Ref wird bereits an anderer Stelle verwendet (Zeile 2545) und enthält immer den aktuellsten State.

#### 2. Video-Prompt bei Dialog-Änderung neu generieren
**Datei:** `src/pages/Index.tsx`

In `regenerateSingleVideo` vor der Video-Generierung (vor Zeile 2542) prüfen, ob sich `dialogText` oder `videoPrompt`-relevante Felder geändert haben. Falls ja, den `videoPrompt` mit dem gleichen AI-Aufruf wie bei der Erstgenerierung (Zeile 1574-1637) neu erzeugen und in den State schreiben, bevor das Video gestartet wird.

Konkret:
- Neuen Helper `regenerateVideoPrompt(sceneIndex, point)` erstellen, der den bestehenden Video-Prompt-Generierungscode wiederverwendet
- In `regenerateSingleVideo` nach dem Bild-Schritt und vor `generateAndPollSingleVideo` den Video-Prompt neu generieren
- Den frischen Prompt in `storyPointsRef` speichern, damit `generateAndPollSingleVideo` ihn nutzt

#### 3. hasImageFieldsChanged ebenfalls auf Ref umstellen
Damit auch die Bild-Vergleichslogik den aktuellsten State sieht.

### Technische Details

```text
regenerateSingleVideo(sceneIndex)
  1. point = storyPointsRef.current[sceneIndex]   ← FIX: Ref statt Closure
  2. if hasImageFieldsChanged(point) → Bild neu generieren
  3. Video-Prompt neu generieren mit aktuellem dialogText  ← NEU
  4. generateAndPollSingleVideo(sceneIndex, freshPoint, nextImage)
```

