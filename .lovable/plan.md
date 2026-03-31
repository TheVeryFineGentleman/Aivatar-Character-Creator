

# Erweiterte Story-Steuerung: Stimmung, Hook, Pacing & Stimme

## Was du gefragt hast

Du willst nach der Story-Idee mehr Einfluss auf das Video nehmen:
1. **Sprecherstimme** — Männlich/Weiblich wählen
2. **Video-Art** — Action, ruhig, dramatisch etc.
3. **Stimmung** — Farben, Beleuchtung, Location-Atmosphäre
4. **Hook** — Einen bestimmten Hook vorgeben
5. **Pacing** — Angeben, wann etwas passieren soll (z.B. "nach 2 Sekunden Action")

## Aktueller Stand

- **Sprecher** hat aktuell nur An/Aus + Modus (Erzähler/Dialog) — keine Geschlechter-Auswahl
- **Artstyle** existiert (realistisch, cinematic etc.) — aber keine Video-Stimmung/Art
- **Custom Details** ist ein Freitext-Feld — aber kein strukturierter Hook/Pacing-Input
- Alle diese Werte fließen in die KI-Prompts (Storyboard + Video-Prompt-Generierung)

## Plan

### 1. Neue State-Variablen (5 Stück)

| Variable | Typ | Optionen |
|----------|-----|----------|
| `storySpeakerGender` | Select | Männlich, Weiblich, Neutral |
| `storyVideoMood` | Select | Action/Dynamisch, Ruhig/Entspannt, Dramatisch/Spannend, Emotional/Berührend, Mysteriös/Dunkel, Fröhlich/Leicht |
| `storyColorMood` | Select | Warm (Golden Hour), Kalt (Blautöne), Dunkel/Noir, Hell/Freundlich, Neon/Cyberpunk, Natürlich |
| `storyHook` | Textarea | Freitext für den Hook (z.B. "Starte mit einer Explosion") |
| `storyPacing` | Select | Sofort Action (0-2s), Langsamer Aufbau (3-5s), Spannungsbogen, Schnelle Schnitte |

### 2. UI-Erweiterung in "Produktions-Einstellungen"

Neue Dropdowns und Felder in der bestehenden Collapsible-Sektion hinzufügen:
- **Zeile 1** (bestehend): Artstyle + Übergang
- **Zeile 2** (neu): Video-Stimmung + Farbstimmung
- **Zeile 3** (neu): Sprecherstimme (nur sichtbar wenn Sprecher aktiv) + Pacing
- **Zeile 4** (neu): Hook-Textfeld
- **Zeile 5** (bestehend): Custom Details

### 3. Prompt-Integration

Alle neuen Werte werden in drei Stellen eingebaut:

**a) Storyboard-Generierung** (Zeile ~1060): Die KI berücksichtigt Stimmung, Hook und Pacing bei der Story-Erstellung
```
- videoMood: "action"
- colorMood: "warm"  
- hook: "Beginne mit einem lauten Knall"
- pacing: "sofort-action"
```

**b) Video-Prompt-Generierung** (Zeile ~2241): Direkte Anweisungen für Veo3
```
STYLE DIRECTIVES:
- Mood: Action/Dynamic — fast cuts, intense energy
- Color palette: Warm golden tones
- Hook: "Start with an explosion in the first frame"
- Pacing: Action within first 2 seconds
- Speaker voice: Male (deep, authoritative)
```

**c) Bild-Generierung**: Farbstimmung und Atmosphäre in den Image-Prompt einbauen

### 4. Session-Persistenz

Alle neuen Werte werden wie die bestehenden in `sessionStorage` gespeichert und beim Laden wiederhergestellt.

### Betroffene Datei
- **`src/pages/Index.tsx`** — State, UI, Prompt-Logik, Session-Persistenz

