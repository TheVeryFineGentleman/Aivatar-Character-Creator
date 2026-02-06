

# Plan: Aspect Ratio an Gemini API weitergeben

## Problem

Der `aspectRatio` Parameter wird zwar vom Frontend an die Edge Function gesendet, aber die Edge Function gibt ihn **nicht** an die Gemini API weiter. Die `generationConfig` enthält nur `responseModalities`, aber kein `imageConfig` mit dem gewaehlten Seitenverhaeltnis.

**Aktuelle Edge Function (Zeile 99-104):**
```javascript
body: JSON.stringify({
  contents: [{ role: "user", parts }],
  generationConfig: {
    responseModalities: ["IMAGE", "TEXT"]
  }
})
```

## Loesung

Die Edge Function muss den empfangenen `aspectRatio` Wert in das `imageConfig` Objekt der Gemini API einfuegen.

**Korrigierte Version:**
```javascript
body: JSON.stringify({
  contents: [{ role: "user", parts }],
  generationConfig: {
    responseModalities: ["IMAGE", "TEXT"],
    imageConfig: {
      aspectRatio: aspectRatio  // z.B. "16:9" oder "9:16"
    }
  }
})
```

---

## Betroffene Datei

| Datei | Aenderung |
|-------|-----------|
| `supabase/functions/generate-image/index.ts` | `imageConfig.aspectRatio` zur `generationConfig` hinzufuegen |

---

## Technische Details

### Aenderung in der Edge Function (Zeile 99-105)

**Vorher:**
```typescript
body: JSON.stringify({
  contents: [{ role: "user", parts }],
  generationConfig: {
    responseModalities: ["IMAGE", "TEXT"]
  }
})
```

**Nachher:**
```typescript
body: JSON.stringify({
  contents: [{ role: "user", parts }],
  generationConfig: {
    responseModalities: ["IMAGE", "TEXT"],
    imageConfig: {
      aspectRatio: aspectRatio
    }
  }
})
```

---

## Unterstuetzte Formate (laut Google Dokumentation)

Gemini 2.5 Flash Image unterstuetzt folgende Aspect Ratios:
- **Landscape:** 21:9, 16:9, 4:3, 3:2
- **Square:** 1:1
- **Portrait:** 9:16, 3:4, 2:3
- **Flexible:** 5:4, 4:5

Die aktuellen Optionen im Dropdown (16:9 und 9:16) sind beide unterstuetzt.

---

## Erwartetes Ergebnis

Nach dieser Aenderung werden Bilder im tatsaechlich gewaehlten Seitenverhaeltnis generiert:
- Bei Auswahl "16:9" → Widescreen-Bilder
- Bei Auswahl "9:16" → Vertikale/Mobile Bilder

