

# Plan: Slider für Szenenanzahl zuverlässig machen

## Problem
Der Slider für die Szenenanzahl im Storyboard-Modus lässt sich manchmal nicht bewegen. Das Problem tritt sporadisch auf.

## Ursachenanalyse

**Hauptursache:** Die `Slider`-Komponente (`src/components/ui/slider.tsx`) hat `step={0.01}` hardcodiert vor dem `{...props}` Spread. Obwohl der Spread theoretisch überschreibt, erzeugt das bei Radix UI gelegentlich Konflikte — besonders bei schnellen Re-Renders (z.B. Moduswechsel mit `key={storyCreatorMode}`).

**Nebenursache:** Beim Wechsel zwischen "Generell" und "Reel" Modus ändert sich der `min`/`max`-Bereich (2-8 vs 3-6), aber der aktuelle `storyPointCount` kann