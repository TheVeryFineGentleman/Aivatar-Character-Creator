
# Plan: Alle Einstellungen sollen den Bildprompt beeinflussen

## Problem-Analyse

Aktuell werden bei der Bild-Regenerierung im Story-Detail-Popup die meisten Einstellungen **ignoriert**. Die Regenerierungs-Funktionen nutzen nur einen ultra-minimalen Prompt:

```
Reference person. [kurzer Szenentext]. [Kamera]. 16:9.
```

Folgende Felder werden **nicht** in den Bildprompt integriert:
- **Emotion** (Glücklich, Traurig, etc.)
- **Schlüsselaktion** (Steht, Geht, Sitzt, etc.)
- **Bereich** (Innenraum, Außenbereich, etc.)
- **Wirkung beim Zuschauer** (Spannung, Empathie, etc.)
- **Beteiligte** (z.B. "Hauptcharakter, Hund")
- **Bildaufbau/Komposition** (Zentriert, Drittel-Regel, etc.)
- **Bewegung** (Dolly-In, Pan, etc.)
- **Stil-Notizen** und **Kontinuitäts-Notizen**
- **Negative Prompts** (Was vermieden werden soll)

## Lösung

Beide Regenerierungs-Funktionen (`regenerateSingleStoryScene` und `regenerateImageOnly`) werden angepasst, um einen **vollständigen, strukturierten Prompt** zu erstellen, der alle Metadaten einbezieht.

---

## Umsetzung

### 1. Helper-Funktion erstellen

Eine neue Funktion `buildFullImagePrompt` wird erstellt, die alle Metadaten eines Story-Points in einen strukturierten Prompt umwandelt:

```text
buildFullImagePrompt(point, sceneIndex)
├── MANDATORY CAMERA FRAMING (cameraAngle + shotType + composition)
├── SCENE SETTING (mainLocation + specificArea)  
├── CHARACTER IDENTITY (von Referenzbild kopieren)
├── CHARACTER POSE (keyAction + emotion)
├── PARTICIPANTS (falls vorhanden)
├── INTENDED EFFECT (audienceEffect → Bildstimmung)
├── STYLE NOTES (styleNotes, continuityNotes)
├── MOVEMENT (falls movement gewählt)
└── AVOID (negativePrompts)
```

### 2. Funktionen aktualisieren

| Funktion | Änderung |
|----------|----------|
| `regenerateSingleStoryScene` | Ultra-minimalen Prompt durch `buildFullImagePrompt` ersetzen |
| `regenerateImageOnly` | Ultra-minimalen Prompt durch `buildFullImagePrompt` ersetzen |

### 3. Übersetzungs-Dictionary erweitern

Deutsche Dropdown-Werte (z.B. "gluecklich" → "happy") müssen ins Englische übersetzt werden für den API-Prompt.

---

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/pages/Index.tsx` | Neue Helper-Funktion + beide Regenerierungs-Funktionen anpassen |

---

## Technische Details

### Neue Helper-Funktion (in Index.tsx)

```typescript
const buildFullImagePrompt = (
  point: typeof storyPoints[0], 
  sceneIndex: number
): string => {
  // Übersetzungs-Maps für deutsche Dropdown-Werte
  const emotionToEnglish: Record<string, string> = {
    "gluecklich": "happy, joyful", "traurig": "sad, melancholic",
    "nachdenklich": "thoughtful, pensive", "aufgeregt": "excited",
    // ... alle Optionen
  };
  
  const actionToEnglish: Record<string, string> = {
    "steht": "standing", "geht": "walking", "sitzt": "sitting",
    // ... alle Optionen
  };
  
  // Prompt-Bausteine zusammensetzen
  let prompt = `MANDATORY CAMERA FRAMING:\n`;
  prompt += `Shot: ${point.shotType || 'medium shot'}\n`;
  prompt += `Angle: ${point.cameraAngle || 'eye level'}\n`;
  if (point.composition) prompt += `Composition: ${point.composition}\n`;
  
  prompt += `\nSCENE SETTING:\n`;
  prompt += `Location: ${storyboardMainLocation}, area: ${point.specificArea || 'unspecified'}\n`;
  prompt += `${point.detailedDescription || point.versions[point.currentVersion]}\n`;
  
  prompt += `\nCHARACTER POSE:\n`;
  prompt += `Action: ${actionToEnglish[point.keyAction] || point.keyAction || 'natural pose'}\n`;
  prompt += `Expression: ${emotionToEnglish[point.emotion] || point.emotion || 'neutral'}\n`;
  
  if (point.participants) {
    prompt += `\nPARTICIPANTS: ${point.participants}\n`;
  }
  
  if (point.audienceEffect) {
    prompt += `\nINTENDED MOOD: Create a ${point.audienceEffect} atmosphere\n`;
  }
  
  if (point.styleNotes) {
    prompt += `\nSTYLE: ${point.styleNotes}\n`;
  }
  
  if (point.negativePrompts) {
    prompt += `\nAVOID: ${point.negativePrompts}\n`;
  }
  
  prompt += `\nTECHNICAL: 16:9 aspect ratio, ultra high resolution, single cohesive image.`;
  
  return prompt;
};
```

### Anpassung der Regenerierungs-Funktionen

In `regenerateSingleStoryScene` und `regenerateImageOnly`:

```typescript
// ALT (ultra-minimal):
const imagePromptText = `Reference person. ${shortScene}. ${cameraShot}. 16:9.`;

// NEU (vollständig):
const imagePromptText = buildFullImagePrompt(point, sceneIndex);
```

---

## Erwartetes Ergebnis

Nach der Implementierung werden alle Änderungen im Story-Detail-Popup (Emotion, Schlüsselaktion, Bereich, Wirkung, Komposition, etc.) direkt in den Bildgenerierungs-Prompt übernommen. Wenn der Nutzer auf "Vorschau neu generieren" klickt, werden alle aktuellen Einstellungen berücksichtigt.
