

## Problem

Nach einer erfolgreichen Bild-Regeneration im Detail-Popup:
1. Der **orange pulsierende Button** erscheint fälschlicherweise, weil `savedSnapshotRef` in `StoryDetailPopup.tsx` veraltet ist
2. Das **X zum Schließen** funktioniert nicht, weil `handleCloseAttempt` fälschlicherweise "unsaved changes" erkennt
3. Dies führt letztlich zum **Absturz**, da der User in einem nicht-schließbaren Zustand gefangen ist

**Ursache:** `savedSnapshotRef` wird nur beim Öffnen des Popups und bei expliziten User-Aktionen (Speichern/Schließen) aktualisiert — aber NICHT wenn die Regeneration im Hintergrund abschließt. Dadurch erkennt `videoPromptChanged` fälschlicherweise eine Änderung, was `needsImageRegeneration = true` setzt.

## Lösung

### `src/components/StoryDetailPopup.tsx`

**`savedSnapshotRef` nach erfolgreicher Regeneration aktualisieren:**

Einen zusätzlichen `useEffect` hinzufügen, der erkennt wenn eine Regeneration abgeschlossen wurde (Übergang von `regeneratingIndex === expandedIndex` zu `regeneratingIndex !== expandedIndex`) und dann `savedSnapshotRef` mit den aktuellen Werten neu setzt:

```typescript
// Reset savedSnapshot after regeneration completes so button state is correct
const prevRegeneratingRef = useRef<boolean>(false);
useEffect(() => {
  const wasRegenerating = prevRegeneratingRef.current;
  const isRegenerating = regeneratingIndex === expandedIndex;
  prevRegeneratingRef.current = isRegenerating;
  
  if (wasRegenerating && !isRegenerating && point) {
    savedSnapshotRef.current = {
      dialogText: point.dialogText || "",
      videoPrompt: point.videoPrompt || "",
    };
  }
}, [regeneratingIndex, expandedIndex, point?.dialogText, point?.videoPrompt]);
```

Das bewirkt:
- Nach erfolgreicher Regeneration wird der Snapshot aktualisiert
- `videoPromptChanged` und `hasTextChanges` werden `false`
- Der orange Button verschwindet korrekt
- Das X zum Schließen funktioniert wieder normal

### Betroffene Datei
- **`src/components/StoryDetailPopup.tsx`** — Ein neuer `useEffect` (~10 Zeilen)

