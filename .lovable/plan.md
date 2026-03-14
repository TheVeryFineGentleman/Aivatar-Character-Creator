
Ziel: Die Video-Generierung so stabil machen, dass Szenen nicht mehr mit „Kein Video in der Antwort“ scheitern und 400er bei Veo-Payloads automatisch abgefangen werden.

1) Befund im aktuellen Code (src/pages/Index.tsx)
- `startGeminiVideoGeneration(...)` sendet aktuell nur ein Payload-Format (`inlineData`) an `veo-3.1-generate-preview`.
- Bei 400 wird direkt abgebrochen (kein kompatibler Retry auf alternatives Bildformat / Modell).
- `pollGeminiVideoOperation(...)` akzeptiert praktisch nur einen finalen Antwortpfad:
  - `response.generateVideoResponse.generatedSamples[0].video.uri`
- Wenn die API ein alternatives, aber gültiges Antwortschema liefert, entsteht sofort:
  - „Kein Video in der Antwort – unbekannte API-Struktur“.

2) Geplanter Fix (robust + rückwärtskompatibel)
- Eine Kompatibilitäts-Schicht für Veo-Requests einbauen:
  - Primärformat + automatischer Fallback bei `400 INVALID_ARGUMENT`.
  - Unterstützte Bild-Payloads:
    - `inlineData` (wie in aktueller REST-Doku)
    - `bytesBase64Encoded` (für Konten/Model-Varianten, die `inlineData` ablehnen)
- Optionaler Modell-Fallback in derselben Routine:
  - zuerst `veo-3.1-generate-preview`, bei bestimmten 4xx-Fällen einmaliger Retry mit `veo-3.1-fast-generate-preview`.
- Erfolgreiches Format/Modell pro Session cachen (in-memory), damit nicht jede Szene erst fehlschlägt.

3) Polling/Response-Parsing härten
- `pollGeminiVideoOperation(...)` erweitert auf mehrere Endstrukturen, in dieser Reihenfolge:
  1. `response.generateVideoResponse.generatedSamples[0].video.uri`
  2. `response.generatedVideos[0].video.uri`
  3. `response.video.uri`
  4. `response.predictions[0].bytesBase64Encoded` (+ mimeType)
- Wenn kein Video gefunden wird:
  - strukturierte Diagnose ausgeben (vorhandene Keys, operationName, model, payloadMode),
  - differenzierte Fehlermeldung statt generischem „unbekannte API-Struktur“.

4) Fehler- und Statusbehandlung verbessern
- Bei `data.done === true` und `data.error` Fehlertext vollständig an Szene zurückgeben.
- Bei Safety/Filter-Fällen (falls Felder vorhanden) klare User-Meldung anzeigen.
- Logging nur diagnostisch präzise (kein unnötiges Voll-JSON-Spam).

5) Konkrete Codebereiche
- `src/pages/Index.tsx`
  - `startGeminiVideoGeneration(...)` refactor:
    - Builder für Payload-Varianten
    - Retry-/Fallback-Strategie
    - sessionweiter „working mode“
  - `pollGeminiVideoOperation(...)` refactor:
    - Multi-Path-Extraktion
    - robuste Fehlerdiagnose

6) Abnahme (End-to-End)
- Test 1: „Alle Videos generieren“ mit 4 Szenen → jede Szene liefert MP4 oder klaren, spezifischen Fehler.
- Test 2: „Einzelnes Video neu generieren“ pro Szene.
- Test 3: Mit/ohne End-Frame (`lastFrame`) prüfen.
- Test 4: Ein absichtlich grenzwertiger Prompt, um Fehlermeldungsqualität zu validieren.
- Erfolgskriterium: Kein „Kein Video in der Antwort“ mehr bei eigentlich erfolgreicher Operation; stattdessen korrektes Video-URL-Mapping oder nachvollziehbarer Fehlgrund.
