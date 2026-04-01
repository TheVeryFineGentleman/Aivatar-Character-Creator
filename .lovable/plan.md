

# Fix: Rohe JSON-Fragmente in Storyboard-Karten verhindern

## Problem
Wenn das JSON-Parsing der KI-Antwort fehlschlägt, fällt der Code auf einen zeilenbasierten Fallback zurück (Zeile 1265-1278). Dieser Filter entfernt nur Zeilen die mit `[` oder `{` beginnen, lässt aber JSON-Fragmente wie `"mainLocation": "..."` oder `"scenes": [` durch. Diese landen dann als "Text" in den Szenen-Karten.

## Lösung

### 1. Robusteres JSON-Parsing (`extractJsonFromAiResponse`)
- Zusätzliche Reparatur-Logik: unbalancierte Klammern schließen, Markdown-Artefakte entfernen
- Zweiten Versuch mit Code-Block-Extraktion (`/```json...```/`) falls erster Versuch fehlschlägt

### 2. Besserer Fallback-Filter (Zeile 1267-1270)
- Zeilen die JSON-Syntax enthalten (`: "`, `": [`, `": {`, nur `{`, `}`, `[`, `]`) herausfiltern
- Nur Zeilen mit echtem Fließtext durchlassen (mind. 2 Leerzeichen = echte Wörter)

### 3. Validierung nach dem Parsing
- Nach erfolgreichem `extractJsonFromAiResponse`: Prüfen ob `scene.summary` und `scene.detailedDescription` tatsächlich Fließtext sind und keine JSON-Fragmente enthalten
- Falls ein Feld verdächtig aussieht (z.B. beginnt mit `"` + Feldname + `":`), als leer behandeln

### Betroffene Datei
- `src/pages/Index.tsx` — Funktion `extractJsonFromAiResponse` und Storyboard-Parsing-Block (Zeilen ~102-127 und ~1190-1280)

