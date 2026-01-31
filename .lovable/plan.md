
# Plan: Storyboard Generator an Pose Generator angleichen ✅ ERLEDIGT

## Implementierte Änderungen

### 1. ✅ Prompt-Sprache vereinheitlichen (Englisch)
- Umfangreiches Deutsch→Englisch Wörterbuch hinzugefügt (40+ Begriffe)
- Locations: ballsaal→ballroom, villa→villa, wald→forest, etc.
- Atmosphäre: gedämpft→dim lighting, dunkel→dark, etc.
- Deutsche Füllwörter werden automatisch entfernt

### 2. ✅ Prompt-Struktur exakt vom Pose Generator kopiert
```javascript
imagePromptText = `Professional photoshoot with EXACTLY ONE person only, 
${cameraText}, ${sceneKeywords}, ${shotText}. 
Match the exact style, realism level, art style, lighting quality, 
and visual aesthetic from the reference images. Ultra high resolution.`;
```

### 3. ✅ Scene-Keyword-Extraktion optimiert
- Problematische Wörter werden entfernt (erweiterte Liste)
- Übersetzung Deutsch→Englisch
- Reduzierung auf max. 5 Wörter
- Fallback: "indoor scene"

### 4. ✅ Retry-Logik entschärft
- MAX_CYCLES: 10 → 3
- RETRIES_PER_CYCLE: 6 → 3
- Gesamt: 60 → 9 Versuche max.

## Testplan
1. Storyboard mit 3-4 Szenen generieren
2. Prüfen ob alle Szenen ohne IMAGE_OTHER durchlaufen
3. Charakter-Konsistenz zwischen Szenen verifizieren
