

# Fix: Fehlende Referenzbilder bei Video-Prompt-Generierung

## Problem
Bei der Video-Prompt-Generierung werden aktuell nur die globalen Referenzbilder und das Bild der vorherigen Szene mitgeschickt. Es fehlen:
1. Das Bild der **aktuellen Szene** (Start-Frame) - die KI kann nicht "sehen" wovon sie ausgeht
2. Das Bild der **naechsten Szene** (End-Frame) - die KI kann den Zielzustand des Hard Cuts nicht sehen

## Loesung

### Datei: `src/pages/Index.tsx` (Zeilen ~1750-1785)

Die Referenzbild-Sammlung wird erweitert um drei zusaetzliche Bilder:

```text
Reihenfolge der Referenzbilder:
1. Globale Story-Referenzbilder (Charakter-Konsistenz)
2. Bild der VORHERIGEN Szene (i-1) - fuer Kontext/Uebergang
3. Bild der AKTUELLEN Szene (i) - START-FRAME
4. Bild der NAECHSTEN Szene (i+1) - END-FRAME fuer den Hard Cut
```

### Konkrete Aenderung

Im Block nach den globalen Referenzbildern (Zeile ~1769) werden zwei weitere Bild-Ladebloecke ergaenzt:

1. **Aktuelles Szenen-Bild** (`storyPoints[i].generatedImage`): Wird immer hinzugefuegt (ist garantiert vorhanden, da wir mit `if (!point.generatedImage) continue;` pruefen)

2. **Naechstes Szenen-Bild** (`storyPoints[i + 1]?.generatedImage`): Wird hinzugefuegt wenn vorhanden (nicht bei der letzten Szene)

### Betroffene Datei

| Datei | Aenderung |
|---|---|
| `src/pages/Index.tsx` | Zeilen ~1769-1785: Zwei neue fetch+base64 Bloecke fuer aktuelles und naechstes Szenen-Bild, Log-Meldung aktualisieren |

