

# Plan: Verbessertes Layout für den KI-Assistenten im Detail-Popup

## Problem-Analyse

Das aktuelle Layout hat folgende Schwächen:
1. **Textarea zu lang** - Die Textbox erstreckt sich über die volle Breite (max-w-4xl ≈ 896px), was unproportional wirkt
2. **Verschwendeter vertikaler Platz** - Die Struktur ist vertikal gestapelt statt horizontal optimiert
3. **Unruhiges Layout** - Mehrere Trennlinien und Abstände fragmentieren den Bereich

## Neues Layout-Konzept

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✨ KI-Assistent                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────┐   ☑ Text & Kamera                 │
│  │                                      │   ☑ + Bild neu                    │
│  │  Textarea (begrenzte Breite)         │                                   │
│  │  2-3 Zeilen hoch                     │   [✨ Anpassen]                   │
│  │                                      │                                   │
│  └──────────────────────────────────────┘                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Vorteile:**
- Textarea ist links, max 60% Breite - nicht mehr "lang gezogen"
- Checkboxen und Button rechts daneben - spart vertikalen Platz
- Kompakteres, aufgeräumteres Erscheinungsbild
- Alle Steuerelemente auf einen Blick sichtbar

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/pages/Index.tsx` | KI-Assistent Bereich neu strukturieren (Zeilen 5990-6049) |

## Technische Umsetzung

```tsx
{/* KI-Assistent - horizontales Layout */}
<div className="border-t border-border/30 p-4 bg-muted/10 flex-shrink-0">
  <div className="flex items-center gap-2 mb-3">
    <Sparkles className="w-4 h-4 text-primary" />
    <span className="text-sm font-medium">KI-Assistent</span>
    {isGeneratingSceneAssistant && (
      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
    )}
  </div>
  
  {/* Horizontales Layout: Textarea links, Controls rechts */}
  <div className="flex gap-4 items-start">
    {/* Textarea - begrenzte Breite */}
    <Textarea
      value={sceneAssistantInput}
      onChange={(e) => setSceneAssistantInput(e.target.value)}
      placeholder="z.B. 'Mache es dramatischer'..."
      className="text-sm min-h-[70px] max-h-[70px] bg-background/50 resize-none flex-1 max-w-md"
      disabled={isGeneratingSceneAssistant}
      onKeyDown={...}
    />
    
    {/* Controls rechts */}
    <div className="flex flex-col gap-2 min-w-[140px]">
      <label className="flex items-center gap-1.5 cursor-pointer">
        <Checkbox checked={sceneAiUpdateText} ... />
        <span className="text-sm">Text & Kamera</span>
      </label>
      <label className="flex items-center gap-1.5 cursor-pointer">
        <Checkbox checked={sceneAiRegenerateImage} ... />
        <span className="text-sm">+ Bild neu</span>
      </label>
      <Button size="sm" onClick={handleUnifiedSceneAssistant} ...>
        <Sparkles className="w-4 h-4" />
        Anpassen
      </Button>
    </div>
  </div>
</div>
```

## Zusammenfassung der Änderungen

1. **Horizontales Layout** statt vertikalem Stack
2. **Textarea max-w-md** (~448px) statt voller Breite
3. **Feste Höhe** (70px) für konsistentes Erscheinungsbild
4. **Checkboxen vertikal gestapelt** rechts neben der Textarea
5. **Button direkt unter den Checkboxen** - alles kompakt gruppiert

