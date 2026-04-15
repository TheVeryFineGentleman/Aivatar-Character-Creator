

# Plan: Robustere Varianten-Generierung im Story Generator

## Problem
Wenn der Nutzer z.B. 3 oder 5 Varianten auswählt, wird oft nur 1 generiert. Das liegt an zwei Ursachen:
1. Die KI liefert die Varianten nicht immer mit `---` Trennzeichen, und die Fallback-Splitting-Strategien greifen nicht zuverlässig
2. Bei der Suggestion-Expansion (Klick auf Vorschlag) wird ebenfalls nicht zuverlässig in die gewünschte Anzahl aufgeteilt

## Lösung

### Änderungen in `src/pages/Index.tsx`

**1. JSON-basiertes Ausgabeformat statt Freitext-Trennung**
- Prompts ändern: Statt `"Trenne mit ---"` wird die KI angewiesen, ein JSON-Array zurückzugeben: `["Idee 1...", "Idee 2...", "Idee 3..."]`
- Betrifft: `handleGenerateStoryIdea` (Zeile ~2082-2112) und `handleSuggestionClick` (Zeile ~4952-4980)

**2. Robusteres Parsing mit Retry**
- Zuerst JSON-Parsing versuchen (`extractJsonFromAiResponse` oder direktes `JSON.parse`)
- Fallback: `---`-Split wie bisher
- Fallback 2: Doppelte Newlines
- Wenn immer noch zu wenig Ergebnisse: automatisch den gleichen Request nochmal senden mit expliziterem Prompt

**3. Validierung der Ergebnis-Anzahl**
- Nach dem Parsing prüfen ob `ideas.length >= count`
- Falls zu wenig: Warnung loggen, aber alle vorhandenen Ideas trotzdem anzeigen (kein stilles Verschlucken)

## Betroffene Dateien
- `src/pages/Index.tsx` — Prompt-Anpassungen und Parsing-Logik in `handleGenerateStoryIdea` und `handleSuggestionClick`

