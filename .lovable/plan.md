

## Problem

Die Video-Generierung (Veo) ignoriert das vom User gewählte Format (`storyboardFormat`) und nutzt stattdessen immer hardcoded `"16:9"`.

**Ursache:** In der Funktion `buildVeoRequestBody` (Zeile 2220) steht `aspectRatio: "16:9"` fest im Code, anstatt den `storyboardFormat`-State zu verwenden.

## Lösung

### `src/pages/Index.tsx`

1. **`buildVeoRequestBody` erweitern** — Neuen Parameter `aspectRatio` hinzufügen und statt `"16:9"` diesen Wert nutzen:
   ```typescript
   const buildVeoRequestBody = (prompt: string, startImageBase64: string, endImageBase64?: string, aspectRatio?: string) => {
     // ...
     parameters: {
       aspectRatio: aspectRatio || "16:9",
       durationSeconds: 8,
       personGeneration: "allow_adult",
     }
   };
   ```

2. **Alle Aufrufe von `buildVeoRequestBody` und `startGeminiVideoGeneration` anpassen** — `storyboardFormat` als Parameter durchreichen, damit das gewählte Format (z.B. `9:16`, `1:1`, `16:9`) an die Veo API gesendet wird.

3. **`startGeminiVideoGeneration` erweitern** — Ebenfalls `aspectRatio`-Parameter akzeptieren und an `buildVeoRequestBody` weiterleiten.

Das betrifft nur eine Datei mit wenigen Stellen, an denen diese Funktionen aufgerufen werden.

