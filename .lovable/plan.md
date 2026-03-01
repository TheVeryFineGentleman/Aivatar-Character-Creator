
# Story Builder: Erweiterte Setup-Optionen -- Phase 1

Da wir schrittweise vorgehen, beginnen wir mit dem **Setup-Panel** das vor der Storyboard-Generierung erscheint. Die weiteren Phasen (KI-Chat-Panel, Transitions, dynamische KI-Steuerung) folgen danach.

---

## Phase 1: Setup-Optionen vor der Generierung

### Was gebaut wird

Ein neues **Setup-Panel** zwischen "Story-Idee + Referenzbilder" und dem "Storyboard generieren"-Button mit folgenden Optionen:

1. **Sprechertext (Switch)** -- Soll es gesprochenen Dialog geben? Wenn JA, generiert die KI automatisch `dialogText` pro Szene.

2. **Szenenbeschreibung (Switch)** -- Soll die KI detaillierte Szenenbeschreibungen generieren? Wenn NEIN, muss der Nutzer sie selbst schreiben.

3. **Videomodell-Auswahl (Select)** -- Welches Modell von kie.ai soll verwendet werden (z.B. Veo 3, andere verfuegbare Modelle).

4. **Artstyle (Select)** -- Visueller Stil fuer die gesamte Story (z.B. Realistisch, Cinematic, Anime, Comic, Illustration, etc.)

5. **Uebergaenge / Transitions (Select)** -- Standard-Uebergangstyp zwischen Szenen (Harter Cut, Smooth Transition, Swipe, Fade, etc.)

6. **Besondere Details / Custom (Textarea)** -- Freitextfeld fuer globale Anweisungen die auf alle Szenen angewandt werden (z.B. "Immer warmes Licht", "Noir-Stil", etc.)

### UI-Layout

```text
+--------------------------------------------------+
|  Story-Idee + KI-Assistent (bestehend)           |
+--------------------------------------------------+
|  Referenzbilder (bestehend)                       |
+--------------------------------------------------+
|                                                    |
|  --- Neue Setup-Optionen ---                      |
|                                                    |
|  [Switch] Sprechertext    [Switch] Szenenbeschr.  |
|                                                    |
|  Videomodell: [Dropdown]   Artstyle: [Dropdown]   |
|                                                    |
|  Uebergang: [Dropdown]                            |
|                                                    |
|  Besondere Details:                               |
|  [Textarea - optionales Freitextfeld]             |
|                                                    |
+--------------------------------------------------+
|  Storyboard generieren (bestehend)                |
+--------------------------------------------------+
```

Die Optionen werden in einem kompakten 2-Spalten-Grid dargestellt.

### Verhalten nach Bildgenerierung

Sobald Szenenbilder generiert wurden, wird das Setup-Panel **eingeklappt** (Collapsible) mit einem kleinen "Einstellungen"-Button zum erneuten Oeffnen. Ab diesem Punkt erfolgt die Feinsteuerung ueber die Detailansicht der einzelnen Szenen.

---

## Technische Details

### Neue State-Variablen in Index.tsx

- `storyEnableSpeaker: boolean` (default: true)
- `storyEnableSceneDescription: boolean` (default: true)  
- `storyVideoModel: string` (default: "veo3")
- `storyArtStyle: string` (default: "realistic")
- `storyTransitionType: string` (default: "hard-cut")
- `storyCustomDetails: string` (default: "")

### Konstanten fuer Dropdown-Optionen

- `STORY_VIDEO_MODELS`: Liste der verfuegbaren kie.ai Modelle
- `STORY_ART_STYLES`: Realistisch, Cinematic, Anime, Comic, Illustration, Watercolor, etc.
- `STORY_TRANSITION_TYPES`: Harter Cut, Smooth Transition, Swipe Links, Swipe Rechts, Fade, Dissolve

### Integration in Generierungslogik

- Der `storyArtStyle` wird in die `buildFullImagePrompt`-Funktion integriert
- `storyEnableSpeaker` steuert ob `dialogText` generiert wird
- `storyTransitionType` wird als Default fuer neue Szenen gesetzt
- `storyCustomDetails` wird als globaler Kontext an alle Prompts angehaengt

### Dateien die geaendert werden

- `src/pages/Index.tsx` -- Neue States, Konstanten, UI-Bereich, Logik-Integration
