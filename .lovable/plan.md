
# Plan: Dropdown-Platzhalter "Von KI wählen lassen..." korrekt anzeigen

## Problem-Analyse

Es gibt zwei Probleme:

### Problem 1: Leere Strings statt undefined
Die Felder werden in der Storyboard-Generierung mit leeren Strings initialisiert (`emotion: scene.emotion || ""`). Radix UI's Select-Komponente zeigt den Placeholder nur bei `value={undefined}`, nicht bei `value=""`.

**Aktueller Code (Zeile 689-693):**
```typescript
emotion: scene.emotion || "",
cameraAngle: scene.cameraAngle || "",
shotType: scene.shotType || ""
```

### Problem 2: KI generiert Freitext statt Dropdown-Werte
Die KI generiert Emotionen als Freitext (z.B. "melancholisch", "hoffnungsvoll") statt als Dropdown-Werte (z.B. "melancholisch", "hoffnungsvoll" - diese matchen zufällig, aber "eye-level" != "frontal").

---

## Lösung

### Teil 1: Erste Option "Von KI wählen lassen..." hinzufügen

Jedes Dropdown bekommt als **erste Option** einen Eintrag mit einem speziellen Wert (z.B. `"_auto_"`), der "Von KI wählen lassen..." anzeigt. Wenn der Nutzer diese Option wählt, wird das Feld auf leer gesetzt.

**Alle Dropdown-Arrays erweitern:**
```typescript
const EMOTION_OPTIONS = [
  { value: "_auto_", label: "Von KI wählen lassen..." },
  { value: "gluecklich", label: "Glücklich" },
  // ... rest
];
```

### Teil 2: Select-Komponenten anpassen

Die Select-Komponenten müssen:
1. Bei leerem Wert (`""` oder `undefined`) den Wert `"_auto_"` anzeigen
2. Bei Auswahl von `"_auto_"` das Feld auf `""` setzen

**Angepasste Select-Logik:**
```typescript
<Select 
  value={point.emotion || "_auto_"} 
  onValueChange={value => handleFieldUpdate('emotion', value === "_auto_" ? "" : value)}
>
```

### Teil 3: Prompt-Generierung prüfen

In `buildFullImagePrompt` werden leere Felder bereits korrekt ignoriert (conditional includes). Keine Änderung nötig.

---

## Betroffene Stellen

| Datei | Zeilen (ca.) | Änderung |
|-------|-------------|----------|
| `src/components/StoryDetailPopup.tsx` | 73-238 | Alle OPTIONS-Arrays um `_auto_` erweitern |
| `src/components/StoryDetailPopup.tsx` | 652-780 | Alle Select-Komponenten: `value` und `onValueChange` anpassen |

---

## Konkrete Code-Änderungen

### 1. Options-Arrays erweitern

Alle 8 Dropdown-Arrays bekommen als ersten Eintrag:
```typescript
{ value: "_auto_", label: "Von KI wählen lassen..." }
```

Betroffene Arrays:
- `EMOTION_OPTIONS`
- `AUDIENCE_EFFECT_OPTIONS`
- `CAMERA_ANGLE_OPTIONS`
- `SHOT_TYPE_OPTIONS`
- `COMPOSITION_OPTIONS`
- `MOVEMENT_OPTIONS`
- `KEY_ACTION_OPTIONS`
- `AREA_OPTIONS`

### 2. Select-Komponenten anpassen

Alle 8 Select-Komponenten (Pose, Bereich, Emotion, Wirkung, Shot-Typ, Kamerawinkel, Bildaufbau, Bewegung) werden so angepasst:

**Vorher:**
```typescript
<Select value={point.keyAction || undefined} onValueChange={value => handleFieldUpdate('keyAction', value)}>
```

**Nachher:**
```typescript
<Select value={point.keyAction || "_auto_"} onValueChange={value => handleFieldUpdate('keyAction', value === "_auto_" ? "" : value)}>
```

---

## Erwartetes Ergebnis

1. Jedes leere Dropdown zeigt "Von KI wählen lassen..." als ausgewählte Option
2. Der Nutzer kann jedes Feld auf "Von KI wählen lassen..." zurücksetzen
3. Bei der Bildgenerierung werden leere Felder von der KI automatisch passend gewählt
4. Die Dirty-State-Erkennung funktioniert weiterhin korrekt (leerer String = `_auto_` gewählt)
