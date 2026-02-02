

# Plan: Klarere Funktionalität für den Story-KI-Assistenten

## Problem-Analyse

Das Segmented Control im Story-Detail-Popup hat verwirrende Labels und eine unklare Wirkung:

| Aktuelles Label | Was es tut | Erwartete Wirkung (vermutet) |
|-----------------|-----------|------------------------------|
| "Text & Kamera" | Optimiert nur den Szenentext + Kamera-Einstellungen | Unklar, evtl. erwartet: bearbeitet den Text |
| "Bild neu" | Generiert nur das Bild neu | Unklar, evtl. erwartet: ändert das Bild |
| "Beides" | Text optimieren + Bild neu generieren | Evtl. zu viel/zu wenig? |

**Kernproblem:** Die Labels im Posen-Generator ("Prompt", "Hintergrund", "Beides") beschreiben, welches **Textfeld** betroffen ist. Die Labels im Story-Builder beschreiben aber verschiedene **Aktionen** - das ist ein konzeptuell anderer Ansatz und deshalb verwirrend.

## Lösungsvorschlag: Konsistente Terminologie und klare Funktionsbeschreibungen

### Option A: Labels klarer machen (minimale Änderung)

Bessere Labels verwenden, die genau beschreiben, was passiert:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✨ KI-Assistent                                                            │
│                                                                             │
│        [Nur Text optimieren] [Nur Bild regenerieren] [Text + Bild]          │
│                                                                             │
│  ┌─────────────────────────────────────┐    ┌──────┐                        │
│  │  "Mache es dramatischer..."         │    │  ✨  │                        │
│  └─────────────────────────────────────┘    └──────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Option B: Layout wie beim Posen-Generator (empfohlen)

Den Button links neben der Textarea platzieren (statt rechts) und die Logik so gestalten, dass der Pfeil die Richtung anzeigt:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✨ KI-Assistent                  [Text] [Bild] [Beides]                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────┐  ┌──────────────────────────────────────────────────────────────┐ │
│  │  →   │  │  "Mache es dramatischer..."                                  │ │
│  └──────┘  └──────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Aber:** Im Story-Builder gibt es kein "Ziel-Textfeld" links wie beim Posen-Generator. Die Aktionen sind fundamentale Prozesse (Text optimieren / Bild generieren), nicht Textfeld-Transfers.

## Empfohlene Lösung

### 1. Klarere Labels für das Segmented Control

| Alter Text | Neuer Text | Bedeutung |
|------------|------------|-----------|
| "Text & Kamera" | "Text optimieren" | Optimiert Beschreibung, Kamerawinkel, Shot-Typ basierend auf der Eingabe |
| "Bild neu" | "Bild regenerieren" | Generiert das Bild zur Szene neu |
| "Beides" | "Text + Bild" | Führt beide Aktionen nacheinander aus |

### 2. Tooltips für jedes Segment hinzufügen

Jeder Button bekommt ein `title`-Attribut, das erklärt, was genau passiert:

```tsx
<Button
  title="Optimiert den Szenentext, Kamerawinkel und Shot-Typ basierend auf deiner Anweisung"
  ...
>
  Text optimieren
</Button>
```

### 3. Button-Icon ändern

Statt dem generischen `Sparkles`-Icon könnte der Button kontextabhängig ein passendes Icon zeigen:
- Bei "Text optimieren": Sparkles oder MessageSquare
- Bei "Bild regenerieren": RefreshCw oder Image
- Bei "Text + Bild": Sparkles (alles zusammen)

## Betroffene Datei

| Datei | Änderung |
|-------|----------|
| `src/pages/Index.tsx` | Segmented Control Labels und Tooltips anpassen (Zeilen 6001-6025) |

## Technische Umsetzung

```tsx
{/* Segmented Control mit klareren Labels */}
<div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
  <Button
    variant={sceneAiMode === "text" ? "default" : "ghost"}
    size="sm"
    className={`h-6 px-2 text-xs ${sceneAiMode === "text" ? "" : "text-muted-foreground hover:text-foreground"}`}
    onClick={() => setSceneAiMode("text")}
    title="Optimiert den Szenentext, Kamerawinkel und Shot-Typ"
  >
    Text optimieren
  </Button>
  <Button
    variant={sceneAiMode === "image" ? "default" : "ghost"}
    size="sm"
    className={`h-6 px-2 text-xs ${sceneAiMode === "image" ? "" : "text-muted-foreground hover:text-foreground"}`}
    onClick={() => setSceneAiMode("image")}
    title="Generiert das Bild zur Szene neu"
  >
    Bild regenerieren
  </Button>
  <Button
    variant={sceneAiMode === "both" ? "default" : "ghost"}
    size="sm"
    className={`h-6 px-2 text-xs ${sceneAiMode === "both" ? "" : "text-muted-foreground hover:text-foreground"}`}
    onClick={() => setSceneAiMode("both")}
    title="Optimiert erst den Text, dann regeneriert das Bild"
  >
    Text + Bild
  </Button>
</div>
```

## Zusammenfassung

1. **"Text & Kamera" → "Text optimieren"** - klarer, was optimiert wird
2. **"Bild neu" → "Bild regenerieren"** - konsistent mit "Regenerieren" im restlichen UI
3. **"Beides" → "Text + Bild"** - zeigt die Reihenfolge der Aktionen
4. **Tooltips hinzufügen** - erklärt bei Hover genau, was jede Option macht

