

## Plan: Sprechertext-Steuerung durchgängig im Story Generator

### Problem
Der `storyEnableSpeaker`-State wird zwar beim initialen Storyboard-Prompt berücksichtigt, aber:
1. Das **Dialog-Feld** in der Szenen-Detailansicht (`StoryDetailPopup`) wird immer angezeigt — auch wenn Sprechertext deaktiviert ist
2. Der **Video-Prompt** enthält keine explizite Anweisung, ob der Charakter sprechen soll oder nicht
3. Die `dialogText`-Daten werden bei der Generierung immer verarbeitet, unabhängig vom Schalter

### Änderungen

#### 1. `StoryDetailPopup.tsx` — Dialog-Feld nur bei aktivem Sprecher anzeigen
- Neue Prop `enableSpeaker?: boolean` hinzufügen
- Den gesamten "Dialog / Gesprochener Text" Block (Zeilen 923-932) in ein `{enableSpeaker && (...)}` wrappen
- Wenn deaktiviert: Feld wird komplett ausgeblendet

#### 2. `Index.tsx` — Prop an StoryDetailPopup übergeben
- `enableSpeaker={storyEnableSpeaker}` als Prop beim `<StoryDetailPopup>` Aufruf hinzufügen

#### 3. `Index.tsx` — Video-Prompt explizit steuern (Zeile ~1697)
- Wenn `storyEnableSpeaker` aktiv: bestehende dialogInfo-Logik beibehalten (Dialog/Sprechertext im Video-Prompt)
- Wenn `storyEnableSpeaker` deaktiviert: explizite Anweisung im Video-Prompt: `"NO dialogue or speech — the character does NOT speak in this scene. No lip movement, no voiceover."`

#### 4. `Index.tsx` — Storyboard-Generierung: dialogText bei deaktiviertem Sprecher leeren
- Nach der initialen Generierung (Zeile ~1052): Wenn `storyEnableSpeaker === false`, `dialogText` auf leeren String setzen, damit kein Text aus dem AI-Response übernommen wird

### Technische Details

**Datei: `src/components/StoryDetailPopup.tsx`**
- Neue Prop: `enableSpeaker?: boolean`
- Conditional Rendering des Dialog-Blocks

**Datei: `src/pages/Index.tsx`**
- Prop-Übergabe bei `<StoryDetailPopup>`
- Video-Prompt-Logik (Zeile 1697): Explizite "kein Sprechen"-Anweisung wenn deaktiviert
- Post-Generation Cleanup für dialogText

