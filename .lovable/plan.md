

# Plan: Szenenanzahl immer exakt einhalten

## Problem
Wenn der Nutzer z.B. 3 Szenen auswählt, liefert die KI manchmal nur 2. Der Code akzeptiert das nach dem Retry (`retryScenes.length > 0` statt `>= storyPointCount`) und zeigt weniger Szenen als gewählt.

## Lösung

### Änderungen in `src/pages/Index.tsx`

**1. Padding-Funktion für fehlende Szenen**
- Nach jedem erfolgreichen Parsing (Zeilen ~2526-2565, ~2596-2650, ~2470-2480): Falls `scenes.length < storyPointCount`, werden leere Platzhalter-Szenen angehängt bis die gewünschte Anzahl erreicht ist
- Platzhalter haben einen Titel wie "Szene X (bitte manuell ausfüllen)" und leere Felder

**2. Retry-Bedingung verschärfen**
- Zeile 2558: `retryScenes.length > 0` ändern zu: nach dem Retry trotzdem Padding anwenden statt nur zu akzeptieren was kommt

**3. Zentrale Hilfsfunktion**
- `padScenesToCount(scenes, targetCount)` — füllt fehlende Szenen mit sinnvollen Defaults auf
- Wird an allen Stellen aufgerufen wo `setStoryPoints` gesetzt wird (ca. 4-5 Stellen)

**4. Nutzer-Hinweis**
- Toast-Warnung wenn gepaddet wurde: "Google hat nur X von Y Szenen generiert. Fehlende Szenen wurden als Platzhalter hinzugefügt."

## Betroffene Dateien
- `src/pages/Index.tsx` — Padding-Logik, verschärfte Validierung, Toast-Warnung

