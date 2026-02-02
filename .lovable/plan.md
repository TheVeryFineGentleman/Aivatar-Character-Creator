
# Plan: Vergrößern-Button wechselt automatisch zum Bild-Tab + Übersichtlicherer KI-Assistent

## Übersicht
Zwei Verbesserungen am Story-Detail-Popup:
1. Beim Klick auf den Vergrößern-Button (Maximize2) über einem Szenen-Bild wird automatisch zum "Bild"-Tab gewechselt
2. Der KI-Assistent am unteren Rand des Popups wird übersichtlicher und kompakter gestaltet

## Änderungen

### 1. Automatischer Tab-Wechsel beim Vergrößern

**Aktuelles Verhalten:**
- Klick auf Maximize2-Button öffnet das Popup im aktuell aktiven Tab (Standard: "Inhalt")

**Neues Verhalten:**
- Klick auf Maximize2-Button öffnet das Popup UND wechselt automatisch zum "Bild"-Tab
- So sieht der Nutzer direkt das vergrößerte Bild

**Technische Umsetzung:**
- Im onClick-Handler des Maximize2-Buttons zusätzlich `setSceneEditTab("image")` aufrufen

### 2. Übersichtlicherer KI-Assistent

**Aktuelles Layout:**
```text
┌──────────────────────────────────┐
│ ✨ KI-Assistent                 🔄 │
├──────────────────────────────────┤
│ [Textarea 60px Höhe]             │
├──────────────────────────────────┤
│ Aktualisieren: [☑ Text] [☑ Bild] │
├──────────────────────────────────┤
│ [🔘 Szene anpassen - volle Breite]│
└──────────────────────────────────┘
```

**Neues Layout - Kompakter und klarer:**
```text
┌──────────────────────────────────┐
│ ✨ KI-Assistent                  │
│                                  │
│ [Textarea mit Placeholder]       │
│                                  │
│ ☑ Text & Kamera  ☑ + Bild neu  ▶│
└──────────────────────────────────┘
```

**Verbesserungen:**
- Checkboxen und Button in einer Zeile kombiniert (flexibler Abstand)
- Button wird kleiner (Icon-only oder kompakt mit Text)
- Weniger vertikaler Platz benötigt
- Klarere visuelle Hierarchie durch weniger Trennungen

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/pages/Index.tsx` | Maximize2 onClick-Handler + KI-Assistent UI-Refactoring |

## Technische Details

```tsx
// 1. Maximize2-Button anpassen (Zeile ~5408)
onClick={(e) => { 
  e.stopPropagation(); 
  setExpandedStoryPointIndex(index); 
  setSceneEditTab("image"); // NEU: Wechsle zum Bild-Tab
}}

// 2. KI-Assistent kompakter gestalten (Zeilen ~5990-6057)
// Checkboxen und Button in einer Zeile mit flex-wrap
<div className="flex items-center gap-2 flex-wrap">
  <label className="flex items-center gap-1.5">
    <Checkbox ... />
    <span>Text & Kamera</span>
  </label>
  <label className="flex items-center gap-1.5">
    <Checkbox ... />
    <span>+ Bild neu</span>
  </label>
  <div className="flex-1" /> {/* Spacer */}
  <Button size="sm">
    <Sparkles /> Anpassen
  </Button>
</div>
```
