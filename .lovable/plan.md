

## Problem-Analyse

Der Absturz passiert, wenn das StoryDetailPopup geschlossen wird (X-Klick), während eine Bild-Regeneration läuft. Die Ursachen:

1. **Popup schließt → `expandedStoryPointIndex = null`** — aber die async `regenerateSingleStoryScene` läuft weiter
2. **Hinter dem Popup** setzt die Regeneration den `regeneratingCardIndex`, was eine Flip-Animation auf der Szenen-Karte startet — das ist das "etwas hat sich geändert"
3. **Potentieller Crash**: Wenn die Regeneration abschließt und `setStoryPoints` aufruft, aktualisiert sich die gesamte UI. Bei 8000+ Zeilen Index.tsx kann das zu Memory Pressure führen, besonders wenn gleichzeitig Blob-URLs erstellt und Animationen getriggert werden
4. **Kein Abort-Mechanismus**: Es gibt keinen `AbortController` der beim Popup-Schließen die laufende Fetch-Anfrage abbricht

## Lösung

### 1. `handleCloseExpandedCard` absichern (Index.tsx, ~Zeile 856)
- Wenn `regeneratingPointIndex !== null` beim Schließen: Unsaved-Warning anzeigen ("Generierung läuft noch — wirklich schließen?")
- Bei Bestätigung: `AbortController` der laufenden Regeneration abbrechen

### 2. Abbruch-Mechanismus für laufende Regeneration (Index.tsx)
- Neuen `useRef<AbortController | null>` (`activeRegenerationController`) erstellen
- In `regenerateSingleStoryScene`: den bestehenden `controller` in die Ref speichern
- Neue Funktion `cancelActiveRegeneration()`: Controller abbrechen + State zurücksetzen
- Im `finally`-Block: Ref auf null setzen

### 3. Graceful Cleanup bei Popup-Schließen (Index.tsx)
- Wenn User trotz Warnung schließt: `cancelActiveRegeneration()` aufrufen
- `regeneratingCardIndex`, `regeneratingPointIndex` sofort zurücksetzen
- Verhindert "hängende" Animationen und State-Inkonsistenzen

### 4. Guard in Animations-State (Index.tsx)
- `setJustFinishedIndex` und `setFlippedCards` in `regenerateSingleStoryScene` nur setzen wenn `expandedStoryPointIndex === null` (Popup bereits geschlossen) — sonst leise die Werte setzen ohne Animation-Trigger

### Betroffene Datei
- **`src/pages/Index.tsx`**: AbortController-Ref, Close-Handler mit Warnung, Regeneration-Abbruch

