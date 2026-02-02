
# Plan: Storyboard-Prompts komplett überarbeiten

## Analyse des Problems

Der aktuelle Storyboard-Generator hat mehrere Schwächen:

1. **Inkonsistente Szenen**: Die Bilder wirken wie zufällige, zusammenhanglose Fotos statt einer zusammenhängenden Story in einem Setting
2. **Pose-Kopie**: Die KI kopiert die Pose/Gestik vom Referenzbild anstatt eine szenisch passende Pose zu generieren
3. **Kamera-Anweisungen werden ignoriert**: Die technischen Kamera-Einstellungen sind zwar vorhanden, aber nicht dominant genug
4. **Keyword-Extraktion zu schwach**: Nur 5 Wörter werden extrahiert - das ist zu wenig Kontext

## Lösungskonzept

### 1. Storyboard-Erstellung (Text-Generierung) verbessern

Der Prompt für `generateStoryboard` muss explizit ein **EINHEITLICHES SETTING** definieren:

```text
Du bist ein professioneller Drehbuchautor. 

WICHTIG - RÄUMLICHE EINHEIT:
- Definiere ZUERST einen HAUPTORT (z.B. "eine alte Villa", "ein Waldweg")
- ALLE Szenen spielen an diesem EINEN Ort
- Variiere nur den BEREICH innerhalb des Ortes (z.B. Flur → Wohnzimmer → Garten der Villa)

Für jede Szene:
- "location": Der spezifische Bereich im Hauptort
- "keyAction": Die EINE zentrale Handlung/Gestik der Person
- "emotion": Die Emotion die sichtbar sein muss
- "cameraAngle": Passender Winkel
- "shotType": Passende Einstellung
```

### 2. Bild-Prompt komplett neu strukturieren

Der neue Prompt folgt diesem Schema:

```text
SETTING & LOCATION:
[Hauptort + spezifischer Bereich, Atmosphäre, Beleuchtung]

CHARACTER IDENTITY (from reference):
- Copy ONLY: face, hair color/style, body type, age, ethnicity
- Do NOT copy: pose, gesture, clothing, expression, background

KEY MOMENT (this scene):
[Die zentrale Aktion/Gestik + Emotion]

CAMERA FRAMING:
[Shot-Type mit detaillierter Beschreibung]
[Kamerawinkel mit detaillierter Beschreibung]
```

### 3. Änderungen im Detail

#### A. Neue JSON-Struktur für Storyboard-Szenen

```typescript
{
  mainLocation: string;        // NEU: Wird für ALLE Szenen übernommen
  summary: string;
  detailedDescription: string;
  specificArea: string;        // NEU: Bereich im Hauptort
  keyAction: string;           // NEU: Zentrale Gestik/Pose
  emotion: string;             // NEU: Sichtbare Emotion
  cameraAngle: string;
  shotType: string;
}
```

#### B. Neuer Bild-Generierungs-Prompt

```javascript
const imagePromptText = `
SCENE SETTING:
Location: ${mainLocation}, specifically ${specificArea}
Atmosphere: ${atmosphereFromDescription}
Lighting: ${lightingFromDescription}

CHARACTER INSTRUCTION:
From the reference image(s), copy ONLY the person's:
- Face structure, features, skin tone
- Hair color, style, length
- Body type and proportions
- Approximate age

DO NOT COPY from reference:
- Pose, gesture, or body position
- Clothing or accessories
- Facial expression
- Background or setting

KEY MOMENT TO CAPTURE:
${keyAction}
The person should show: ${emotion}

CAMERA FRAMING (MANDATORY):
${shotTypeDescriptions[shotType]}
${cameraAngleDescriptions[cameraAngle]}

TECHNICAL:
- Single person only
- No collages or split screens
- Ultra high resolution
- 16:9 aspect ratio
`;
```

### 4. Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `src/pages/Index.tsx` | Storyboard-Generierung, Bild-Prompt-Logik |

### 5. Konkrete Code-Änderungen

#### Schritt 1: StoryPoint-Interface erweitern (ca. Zeile 253)
- Neue Felder: `mainLocation`, `specificArea`, `keyAction`, `emotion`

#### Schritt 2: generateStoryboard-Prompt anpassen (Zeile 572-591)
- Neues JSON-Format mit Hauptort-Definition
- Explizite Anweisung für räumliche Einheit

#### Schritt 3: Bild-Generierung komplett neu (Zeile 1136-1148)
- Weg von Keyword-Extraktion
- Hin zu strukturiertem Prompt mit klaren Sektionen
- Explizite "DO NOT COPY pose" Anweisung

#### Schritt 4: Kamera-Anweisungen verstärken
- Kamera-Anweisungen an den ANFANG des Prompts
- Wiederholung am Ende als Reminder

## Technische Details

### Neuer Storyboard-Generierungs-Prompt:

```javascript
`Du bist ein professioneller Drehbuchautor für visuelle Storyboards.

STORY-IDEE: "${storyIdea}"

WICHTIGSTE REGEL - RÄUMLICHE EINHEIT:
Definiere ZUERST einen HAUPTORT für die gesamte Geschichte. 
ALLE ${storyPointCount} Szenen spielen an diesem EINEN Ort.
Variiere nur den BEREICH innerhalb des Ortes.

Beispiel: Hauptort = "eine alte Villa am See"
- Szene 1: Im Eingangsbereich der Villa
- Szene 2: Im Wohnzimmer mit Blick auf den See
- Szene 3: Auf der Terrasse der Villa

ANTWORTE NUR mit diesem JSON:
{
  "mainLocation": "Der Hauptort der gesamten Geschichte",
  "scenes": [
    {
      "summary": "1-Satz Zusammenfassung",
      "specificArea": "Welcher Bereich des Hauptorts",
      "keyAction": "Die EINE zentrale Aktion/Gestik der Person (z.B. 'lehnt nachdenklich am Fenster', 'sitzt zusammengesunken auf der Couch')",
      "emotion": "Die sichtbare Emotion (z.B. 'melancholisch', 'hoffnungsvoll')",
      "detailedDescription": "Ausführliche visuelle Beschreibung",
      "cameraAngle": "eye-level|low-angle|high-angle|...",
      "shotType": "close-up|medium-shot|full-shot|..."
    }
  ]
}

REGELN:
- Jede Szene hat EINE klare Aktion/Gestik
- Die Szenen bauen logisch aufeinander auf
- Der Hauptort bleibt IMMER gleich
- NUR realistische Szenarien, keine Fantasy`
```

### Neuer Bild-Generierungs-Prompt:

```javascript
const imagePromptText = `
MANDATORY CAMERA FRAMING (follow exactly):
${shotTypeDescriptions[selectedShotType]}
${cameraAngleDescriptions[selectedCameraAngle]}

LOCATION:
${mainLocation}, in the ${specificArea}.
${atmosphereDetails}

CHARACTER IDENTITY (copy from reference):
- Face: exact facial features, structure, skin tone
- Hair: exact color, style, length
- Body: same body type and proportions
- Age: same approximate age

CHARACTER POSE (DO NOT copy from reference):
${keyAction}
Expression showing: ${emotion}
Create a NEW pose that fits this scene - ignore the reference pose completely.

TECHNICAL REQUIREMENTS:
- Exactly ONE person
- Single image, no collage
- Ultra high resolution
- Match lighting style from reference
`.trim();
```

## Erwartetes Ergebnis

Nach der Implementierung:
- ✅ Alle Szenen spielen am selben Ort (z.B. immer in der Villa)
- ✅ Jede Szene zeigt einen anderen Bereich (Flur, Wohnzimmer, Terrasse)
- ✅ Die Person hat das Aussehen vom Referenzbild
- ✅ Die Pose/Gestik ist passend zur Szene (nicht kopiert)
- ✅ Kamera-Einstellungen werden korrekt umgesetzt
- ✅ Schlüsselmomente sind klar erkennbar

## Risiken & Mitigation

| Risiko | Mitigation |
|--------|------------|
| Gemini ignoriert "DO NOT COPY pose" | Formulierung verstärken, Wiederholung im Prompt |
| JSON-Parsing fehlschlägt | Fallback-Logik beibehalten |
| Zu lange Prompts | Prompt-Länge unter 500 Wörtern halten |
