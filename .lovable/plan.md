

## Problem: KI-Prompt ignoriert Szenen-Einstellungen

Die aktuelle System-Instruction an die Prompt-KI behandelt die Szenen-Details als optionale Hinweise. Bei 150 Wörtern max werden Details weggelassen. Außerdem fehlt eine klare Priorisierung der Nutzer-Einstellungen.

## Lösung

**Datei:** `src/pages/Index.tsx` — `generateImagePromptViaAI` (Zeile ~2804)

### 1. System-Instruction umschreiben mit strikter Feldpflicht

Die Instruction wird so geändert, dass jedes Szenen-Detail als **PFLICHTFELD** behandelt wird:

- Wortlimit von 150 auf **250 Wörter** erhöhen
- Explizite Anweisung: "You MUST include ALL of the following scene details. Do NOT omit or simplify any of them."
- Jedes Feld (Shot Type, Camera Angle, Emotion, Action, Location, Composition, Movement, Style Notes) wird als "REQUIRED" markiert
- Klare Hierarchie: **Nutzer-Einstellungen > Konsistenz zur Vorgängerszene > eigene kreative Freiheit**

### 2. Konsistenz-Hinweis abschwächen

Aktuell gibt es keinen expliziten Konsistenz-Zwang im Prompt-Text selbst — das läuft über die Referenzbilder. Aber die KI tendiert dazu, "sichere" generische Prompts zu schreiben. Die neue Instruction betont: "Each scene must reflect its UNIQUE settings. Do NOT default to generic descriptions."

### Technische Details

```text
Neue System-Instruction Struktur:
1. "You MUST faithfully include ALL scene details below."
2. "REQUIRED fields — include each one explicitly:"
   - Art Style (MANDATORY OVERRIDE)
   - Shot Type
   - Camera Angle  
   - Location + Specific Area
   - Character Action (exact action, not generic)
   - Character Expression/Emotion
   - Composition
   - Camera Movement
   - Style Notes
   - Avoid (negative prompts)
3. "Priority: User settings > scene uniqueness > visual consistency"
4. "Max 250 words. Include EVERY required field."
5. Referenzbilder nur für Charakter-Identität, NICHT für Pose/Stil/Szene
```

