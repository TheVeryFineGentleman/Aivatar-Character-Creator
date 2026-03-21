

## Problem
Änderungen im Detail-Popup (z.B. Dialogtext) werden nicht gespeichert, weil `regenerateSingleVideo` beim Start eine Kopie der Szene macht (`let point = storyPoints[sceneIndex]`) und diese veraltete Kopie dann beim Speichern und bei der Video-Generierung verwendet — wodurch alle zwischenzeitlichen Benutzeränderungen überschrieben werden.

## Lösung

**Datei: `src/pages/Index.tsx`**

1. **Zeile 2418 — Bild-Update**: `...point` aus dem Spread entfernen, damit die aktuelle State-Version `p` nicht mit der veralteten Kopie überschrieben wird:
   - Alt: `{ ...p, ...point, generatedImage: ..., generationSnapshot }`
   - Neu: `{ ...p, generatedImage: ..., detailedImagePrompt: ..., generationError: undefined, generationSnapshot }`

2. **Zeile 2428 — Point-Referenz für Video**: Statt den alten `point` weiterzuverwenden, die frische Version aus dem State lesen:
   - Nach dem `setStoryPoints`-Update eine Hilfsvariable setzen und für die Video-Generierung den aktuellen State-Wert verwenden

3. **Zeile 2305/2450 — Frischen State für Video**: Vor `generateAndPollSingleVideo` den aktuellen `storyPoints[sceneIndex]` frisch lesen (via einem Ref oder durch Weitergabe des aktuellen State aus dem `setStoryPoints`-Updater)

### Technischer Ansatz
- Einen `storyPointsRef` (useRef) einführen, der immer den aktuellen `storyPoints`-State widerspiegelt
- In `regenerateSingleVideo` den frischen Wert über den Ref lesen, statt die Closure-Variable zu verwenden
- Das `...point`-Spread auf Zeile 2418 entfernen

