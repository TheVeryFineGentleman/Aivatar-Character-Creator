

# Story Generator: Generell vs. Reel Modus

## Übersicht

Oben im Story-Tab wird ein Modus-Umschalter eingefügt (Pill-Buttons oder Tabs), der zwischen **Generell** und **Reel** umschaltet. Der Generell-Modus bleibt wie bisher. Der Reel-Modus setzt automatisch optimale Presets für Social-Media-Reels und bietet eine vereinfachte, fokussierte Oberfläche.

## Reel-Modus Unterschiede

| Eigenschaft | Generell | Reel |
|---|---|---|
| Format | Frei wählbar | Fest 9:16 |
| Pacing | Frei wählbar | Schnelle Schnitte (default) |
| Szenenanzahl | 2-8 | 3-6 (Reel-typisch) |
| Farbstimmung | Frei | Kontrastreiche Optionen bevorzugt |
| Hook | Optional | Prominenter, mit Vorschlägen |
| Produktions-Einstellungen | Vollständig sichtbar | Vereinfacht / teils automatisch |
| Video-Stimmung | Frei | Reel-optimierte Defaults (Action/Dynamisch) |
| Prompt-Anpassung | KI generiert generisch | KI-Prompts enthalten Reel-spezifische Anweisungen (Hook-First, schnelle Schnitte, Aufmerksamkeits-Grabber) |

## Technische Umsetzung

### 1. Neuer State in `Index.tsx`
- `storyCreatorMode: "general" | "reel"` — steuert den aktiven Modus
- Session-Storage-Persistenz wie bei anderen States

### 2. Modus-Umschalter UI
- Direkt oben im Story-Tab-Content (vor den Referenzbildern), als zwei Pill-Buttons:
  - **Generell** — Filmklappe-Icon, "Volle Kontrolle über alle Parameter"
  - **Reel** — Smartphone/Play-Icon, "Optimiert für TikTok, Instagram Reels & Shorts"

### 3. Reel-Modus Logik
- Beim Wechsel zu "Reel": Automatische Presets setzen (9:16, schnelle Schnitte, Action-Stimmung, kontrastreiche Farben)
- Produktions-Einstellungen werden im Reel-Modus vereinfacht: Format und Pacing sind fixiert/ausgeblendet, Hook-Feld ist prominenter
- Szenen-Slider: Range auf 3-6 begrenzt im Reel-Modus

### 4. Prompt-Anpassung
- Im Reel-Modus wird der KI-Prompt für Storyboard-Generierung um Reel-spezifische Anweisungen ergänzt:
  - "Hook in den ersten 1-2 Sekunden"
  - "Schnelle Schnitte, hoher visueller Kontrast"
  - "Social-Media-optimiert, vertikales Format"
  - "Jede Szene muss visuell eigenständig auffallen"

### 5. Dateien die geändert werden
- **`src/pages/Index.tsx`** — Neuer State, Modus-Umschalter UI, bedingte Presets, Prompt-Modifikation im Reel-Modus, angepasste UI-Sichtbarkeit

