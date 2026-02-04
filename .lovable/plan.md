
# Plan: Dirty-State-Erkennung für Bild-Regenerierung reparieren

## Problem-Analyse

Die "Vorschau ist veraltet"-Warnung erscheint nicht, wenn der Nutzer Änderungen vornimmt. Das Problem liegt in der **falschen Erstellung des `generationSnapshot`**.

### Aktueller Code-Ablauf:

1. Nutzer ändert z.B. Emotion von "neutral" → "glücklich"
2. `onUpdateStoryPoint` wird aufgerufen → State wird aktualisiert
3. Nutzer klickt "Vorschau neu generieren"
4. `regenerateSingleStoryScene(sceneIndex, storyPoints[expandedIndex])` wird aufgerufen
5. **PROBLEM**: Der `generationSnapshot` wird aus `p` (im `setStoryPoints` Callback) erstellt:
   ```typescript
   setStoryPoints(prev => prev.map((p, idx) => {
     const generationSnapshot = {
       summary: p.summary,  // ← p kommt aus prev, nicht aus updatedPoint!
       emotion: p.emotion,
       // ...
     };
   }));
   ```
6. Da `p` aus dem asynchronen State kommt, kann es passieren, dass der Snapshot **nicht** die aktuellen Werte enthält

### Resultat:
Der `generationSnapshot` stimmt nicht mit den tatsächlich für die Generierung verwendeten Werten überein, was zu falschen Dirty-State-Erkennungen führt.

---

## Lösung

Der `generationSnapshot` muss aus den **tatsächlich für die Generierung verwendeten Werten** erstellt werden - das ist `point` (die Variable, die für den Prompt verwendet wird), nicht `p` (der alte State).

### Änderungen in `src/pages/Index.tsx`:

| Funktion | Problem | Lösung |
|----------|---------|--------|
| `regenerateSingleStoryScene` | Snapshot aus `p` erstellt | Snapshot aus `point` erstellen |
| `regenerateImageOnly` | Snapshot aus `p` erstellt | Snapshot aus `point` erstellen |

---

## Technische Details

### Vorher (falsch):
```typescript
// In regenerateSingleStoryScene (ca. Zeile 1963-1987)
setStoryPoints(prev => prev.map((p, idx) => {
  if (idx === sceneIndex) {
    const generationSnapshot = {
      summary: p.summary,           // ← FALSCH: p ist der alte State
      emotion: p.emotion,
      keyAction: p.keyAction,
      // ...
    };
    return { ...p, generatedImage, generationSnapshot };
  }
  return p;
}));
```

### Nachher (korrekt):
```typescript
// In regenerateSingleStoryScene
// Der Snapshot wird VOR dem setStoryPoints erstellt, basierend auf 'point'
const generationSnapshot = {
  summary: point.summary,           // ← KORREKT: point enthält die aktuellen Werte
  detailedDescription: point.detailedDescription,
  keyAction: point.keyAction,
  specificArea: point.specificArea,
  emotion: point.emotion,
  audienceEffect: point.audienceEffect,
  cameraAngle: point.cameraAngle,
  shotType: point.shotType,
  composition: point.composition,
  movement: point.movement,
  participants: point.participants,
  negativePrompts: point.negativePrompts,
  styleNotes: point.styleNotes,
  continuityNotes: point.continuityNotes,
};

setStoryPoints(prev => prev.map((p, idx) => {
  if (idx === sceneIndex) {
    return { 
      ...p, 
      // Merge die aktuellen Änderungen von point
      ...point,
      generatedImage: generatedImageUrl, 
      detailedImagePrompt: imagePromptText,
      generationError: undefined,
      generationSnapshot,  // ← Jetzt enthält der Snapshot die korrekten Werte
    };
  }
  return p;
}));
```

---

## Betroffene Stellen

| Datei | Zeilen (ca.) | Funktion |
|-------|-------------|----------|
| `src/pages/Index.tsx` | 1963-1991 | `regenerateSingleStoryScene` - Success-Block |
| `src/pages/Index.tsx` | 2168-2196 | `regenerateImageOnly` - Success-Block |

---

## Erwartetes Ergebnis

Nach der Implementierung:
1. Nutzer öffnet Szene im Story-Detail-Popup
2. Nutzer ändert z.B. Emotion von "neutral" → "glücklich"
3. **Sofort** erscheint die orangefarbene Warnung "Vorschau ist veraltet"
4. Der "Vorschau jetzt aktualisieren" Button pulsiert orange
5. Nach Klick auf den Button wird das Bild mit den neuen Einstellungen generiert
6. Nach erfolgreicher Generierung verschwindet die Warnung wieder
