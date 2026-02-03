
# Plan: Alle Einstellungen sollen den Bildprompt beeinflussen

## ✅ ABGESCHLOSSEN

### Umsetzung

1. **Übersetzungs-Maps erstellt** (Zeile ~1605-1695 in Index.tsx):
   - `emotionToEnglish`: Glücklich → happy, joyful expression, etc.
   - `actionToEnglish`: steht → standing, geht → walking, etc.
   - `areaToEnglish`: innenraum → indoor setting, etc.
   - `effectToEnglish`: spannung → tense, suspenseful, etc.
   - `compositionToEnglish`: zentriert → centered composition, etc.
   - `movementToEnglish`: dolly-in → dolly-in camera movement, etc.
   - `cameraAngleToEnglish`: frontal → frontal shot, eye level, etc.
   - `shotTypeToEnglish`: extreme-close-up → extreme close-up showing only a detail, etc.

2. **Helper-Funktion `buildFullImagePrompt` erstellt** (Zeile ~1700-1802):
   Generiert einen strukturierten Prompt mit 11 Sektionen:
   - MANDATORY CAMERA FRAMING (Shot Type, Camera Angle, Composition)
   - SCENE SETTING (Location, Area, Scene Description)
   - CHARACTER IDENTITY (Referenzbild-Anweisung)
   - CHARACTER POSE (Action, Expression)
   - PARTICIPANTS (falls vorhanden)
   - INTENDED MOOD (Audience Effect)
   - CAMERA MOVEMENT (falls vorhanden)
   - STYLE (Style Notes)
   - CONTINUITY (Continuity Notes)
   - AVOID (Negative Prompts)
   - TECHNICAL (16:9, ultra high res, etc.)

3. **Funktionen aktualisiert**:
   - `regenerateSingleStoryScene`: Nutzt jetzt `buildFullImagePrompt(point, sceneIndex)`
   - `regenerateImageOnly`: Nutzt jetzt `buildFullImagePrompt(point, sceneIndex)`

---

## Erwartetes Ergebnis

Wenn der Nutzer im Story-Detail-Popup irgendeine Einstellung ändert (Emotion, Schlüsselaktion, Bereich, Wirkung, Komposition, Bewegung, Stil-Notizen, etc.) und dann auf "Vorschau neu generieren" klickt, werden **alle** aktuellen Einstellungen in den Bildprompt übernommen.
