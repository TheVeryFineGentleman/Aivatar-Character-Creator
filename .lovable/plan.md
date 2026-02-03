

# UX/UI Redesign-Spezifikation: Story-Editor mit Live-Vorschau

---

## 1) DIAGNOSE DES AKTUELLEN UI (Konkrete Probleme)

### Hierarchie-Probleme
1. **Flaches Layout ohne klare Priorisierung**: Die nummerierten Sektionen (1-4) sind visuell gleichwertig, obwohl Story-Kern (Ebene 1) wichtiger ist als Kamera-Einstellungen (Ebene 4).
2. **Tabs fragmentieren den Workflow**: Der Nutzer muss zwischen "Inhalt", "Bild", "Video" wechseln – das unterbricht den natürlichen Top-to-Bottom-Flow.
3. **Popup statt integrierter Editor**: Das Modal/Popup-Pattern erzwingt Kontext-Wechsel. Nutzer verlieren den Überblick über die Gesamtstory.

### Layout-Probleme
1. **Zweispaltig nur auf Desktop (lg:grid-cols-2)**: Auf Tablets und kleinen Laptops kippt das Layout einspaltig → die Vorschau verschwindet beim Scrollen.
2. **Vorschau nicht sticky**: Die rechte Spalte scrollt mit, statt fixiert zu bleiben.
3. **AI-Assistent am unteren Rand versteckt**: Der 90px hohe Footer mit dem KI-Assistenten ist am Ende des Popups – Nutzer müssen scrollen.

### State-Management-Probleme
1. **Kein Dirty-State sichtbar**: Es gibt keinen visuellen Unterschied zwischen "bearbeitet aber nicht gespeichert" und "final übernommen".
2. **"Als final" Button ohne Funktion**: Der grüne Button hat keine echte Logik – er sieht aus wie er was tut, tut aber nichts.
3. **"Änderungen verwerfen" ohne Referenz**: Es gibt keinen gespeicherten FINAL-Stand, zu dem man zurückkehren könnte.

### CTA-Logik-Probleme
1. **Vier gleichrangige Modi-Buttons (Text/Kamera/Bild/Beides)**: Unklar, was jeder tut. "Beides" ist kein Verb.
2. **"Vorschau neu" vs "Bild regenerieren"**: Zwei Buttons für ähnliche Aktionen (einer im Content-Tab, einer im Image-Tab).
3. **Versions-Navigation irrelevant**: Die Pfeilbuttons für Versionen (1/1, 2/2) sind für den Nutzer verwirrend – was sind "Versionen"?

### Szenen-Navigation-Probleme
1. **Szenen-Übersicht zeigt ALLE Szenen inkl. Entwürfe**: Keine Trennung zwischen finalisierten und In-Bearbeitung-Szenen.
2. **Horizontales Scrolling mit Mausrad-Override**: Unintuitiv und verletzt Plattform-Konventionen.
3. **Kein linearer Workflow**: Man kann beliebig zwischen Szenen springen, ohne dass klar ist, welche bereits "fertig" sind.

---

## 2) NEUER GESAMT-FLOW (End-to-End)

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           STORY-EDITOR WORKFLOW                                  │
└──────────────────────────────────────────────────────────────────────────────────┘

PHASE 1: PROJEKT-SETUP
  │
  ├─► Story-Idee eingeben (Textarea)
  ├─► Charakter-Referenzbilder hochladen (1-2 Bilder)
  ├─► Anzahl Szenen wählen (Slider 2-8)
  └─► [Storyboard generieren] klicken
        │
        ▼
PHASE 2: SZENEN-EDITOR (Kernbereich)
  │
  ├─► AKTIVE SZENE: Immer eine Szene im Fokus
  │     │
  │     ├── Linke Spalte: Editing (scrollbar)
  │     │     ├── Ebene 1: Story-Kern (IMMER SICHTBAR)
  │     │     ├── Ebene 2: Handlung & Beteiligte
  │     │     ├── Ebene 3: Emotion & Wirkung
  │     │     ├── Ebene 4: Kamera & Bildsprache (eingeklappt)
  │     │     └── Ebene 5: KI-Feintuning (eingeklappt)
  │     │
  │     └── Rechte Spalte: Vorschau (STICKY)
  │           ├── Live-Preview Bild
  │           ├── Status-Badge: "Entwurf" oder "Final"
  │           ├── [Vorschau neu generieren]
  │           ├── [Als final übernehmen] ← Speichert in FINAL-Liste
  │           └── [Änderungen verwerfen] ← Reset auf letzten FINAL-Stand
  │
  └─► Nach "Als final übernehmen":
        │
        ├── Badge wechselt zu "Final ✓"
        ├── Szene erscheint in FINAL-ÜBERSICHT
        └── "Nächste Szene bearbeiten" wird angeboten
              │
              ▼
PHASE 3: FINAL-SZENEN-ÜBERSICHT
  │
  ├─► Zeigt NUR finalisierte Szenen als Thumbnails
  ├─► Badge "2 von 5 Szenen finalisiert"
  ├─► Klick auf Thumbnail → öffnet Szene im Editor (als Entwurf-Kopie)
  └─► Wenn alle Szenen finalisiert:
        │
        ▼
PHASE 4: EXPORT
  │
  ├─► [Für Veo3 exportieren] → ZIP mit finalen Bildern + Video-Prompts
  └─► Download-Dialog
```

### Wie navigiert man zu Szene 2, wenn Übersicht nur FINAL zeigt?

**Lösung: Separater "Aktive Szene" Stepper**

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Aktive Szene (Entwurf):  [◀ Zurück]   Szene 3 von 5   [Weiter ▶]               │
│  ─────────────────────────────────────────────────────────────────────────       │
│  Finalisierte Szenen:     [1 ✓] [2 ✓] [ ] [ ] [ ]      2/5 abgeschlossen        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Stepper oben**: Zeigt aktuelle Szene (Entwurf). Pfeile navigieren zu vorheriger/nächster Szene.
- **Fortschrittsleiste unten**: Zeigt welche Szenen bereits finalisiert wurden. Punkte sind klickbar.

---

## 3) INFORMATIONSARCHITEKTUR (IA)

### Hauptbereiche

| Bereich | Beschreibung | Verhalten |
|---------|--------------|-----------|
| **Header** | Story-Titel, Szenen-Stepper | Sticky (top: 0) |
| **Projekt-Setup** | Story-Idee, Referenzbilder, Szenenanzahl | Collapsible nach Generierung |
| **Szenen-Editor** | Zweispaltiges Layout | Hauptbereich, scrollbar |
| **Final-Szenen-Übersicht** | Thumbnail-Leiste finaler Szenen | Collapsible, unterhalb Editor |
| **Export-Panel** | Download-Buttons | Nur sichtbar wenn ≥1 Szene final |

### Panel-Struktur (Szenen-Editor)

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ HEADER (sticky, 56px)                                                           │
│   [◀] Szene 3 von 5 [▶]    │    Status: Entwurf ●    │    [Schließen]           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────┐  ┌───────────────────────────────────────┐ │
│  │  LINKE SPALTE (60%, scrollbar)  │  │  RECHTE SPALTE (40%, sticky)          │ │
│  │                                 │  │                                       │ │
│  │  ● Ebene 1: Story-Kern          │  │  ┌─────────────────────────────────┐  │ │
│  │    (nicht einklappbar)          │  │  │                                 │  │ │
│  │                                 │  │  │       PREVIEW-BILD              │  │ │
│  │  ▼ Ebene 2: Handlung            │  │  │       (aspect 16:9)             │  │ │
│  │    (default offen)              │  │  │                                 │  │ │
│  │                                 │  │  └─────────────────────────────────┘  │ │
│  │  ▼ Ebene 3: Emotion             │  │                                       │ │
│  │    (default offen)              │  │  [Entwurf]  Medium Shot  Frontal      │ │
│  │                                 │  │                                       │ │
│  │  ▶ Ebene 4: Kamera              │  │  ✨ Aktualisiert nach letzter Änderung │ │
│  │    (default eingeklappt)        │  │                                       │ │
│  │                                 │  │  ┌─────────────────────────────────┐  │ │
│  │  ▶ Ebene 5: KI-Feintuning       │  │  │  [Vorschau neu generieren]      │  │ │
│  │    (default eingeklappt)        │  │  └─────────────────────────────────┘  │ │
│  │                                 │  │  ┌─────────────────────────────────┐  │ │
│  │                                 │  │  │  [✓ Als final übernehmen]       │  │ │
│  │                                 │  │  └─────────────────────────────────┘  │ │
│  │                                 │  │                                       │ │
│  │                                 │  │  [Änderungen verwerfen]               │ │
│  └─────────────────────────────────┘  └───────────────────────────────────────┘ │
│                                                                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│ FOOTER (sticky, 120px) - KI-Assistent                                           │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │  ✨ KI-Assistent          [Text optimieren] [Bild regenerieren]         │   │
│   │  ┌───────────────────────────────────────────────────────────┐ ┌─────┐  │   │
│   │  │ "Mache es dramatischer..."                                │ │ ✨  │  │   │
│   │  └───────────────────────────────────────────────────────────┘ └─────┘  │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4) KOMPONENTEN-SPEZIFIKATION

### A) LINKE SPALTE

#### Ebene 1: Story-Kern (IMMER SICHTBAR, NICHT EINKLAPPBAR)

**Zweck**: Narrativer Anker. Der Nutzer sieht immer, worum es in der Szene geht.

**Komponenten**:

| Feld | Typ | Default | Pflicht | Validierung |
|------|-----|---------|---------|-------------|
| Zusammenfassung | Textarea (1-2 Zeilen) | Leer | Nein | Max 200 Zeichen |
| Detaillierte Beschreibung | Textarea (mehrzeilig) | Generierter Text | Ja | Min 20 Zeichen |

**States**:
- `idle`: Normaler Zustand, Felder bearbeitbar
- `dirty`: Gelber Rand links, Badge "Nicht gespeichert" erscheint
- `saving`: Felder disabled, Spinner im Header
- `error`: Roter Rand, Fehlermeldung unterhalb

**Empty State**: 
```
Zusammenfassung: "Beschreibe kurz, was in dieser Szene passiert..."
Detaillierte Beschreibung: "Hier erscheint die generierte Szenenbeschreibung. Du kannst sie jederzeit bearbeiten."
```

**Fehlertext**:
- Pflichtfeld leer: "Die Szenenbeschreibung darf nicht leer sein."

**KI-Button** (optional, inline):
- Position: Rechts neben "Detaillierte Beschreibung" Label
- Icon: Sparkles (16px)
- Tooltip: "Mit KI verbessern"
- Aktion: Optimiert nur dieses Feld, setzt dirty=true

---

#### Ebene 2: Handlung & Beteiligte (Collapsible, default OFFEN)

**Zweck**: Inhaltliche Logik der Szene definieren.

**Komponenten**:

| Feld | Typ | Default | Optionen |
|------|-----|---------|----------|
| Schlüsselaktion | Select | "Von KI wählen..." | steht, geht, sitzt, lehnt, schaut, spricht, rennt, wartet, greift, hält, zeigt, wendet sich |
| Bereich | Select | "Von KI wählen..." | Innenraum, Außenbereich, Straße, Natur, Arbeitsplatz, Zuhause, Fahrzeug, Öffentlicher Ort |
| Beteiligte | Input | Generiert | Freitext, z.B. "Hauptcharakter, Hund" |

**States**:
- `collapsed`: Chevron nach rechts, Inhalt verborgen
- `expanded`: Chevron nach unten, Inhalt sichtbar
- `dirty`: Gelber Punkt neben Sektions-Titel

**Collapse-Trigger**: Klick auf gesamte Header-Zeile

---

#### Ebene 3: Emotion & Wirkung (Collapsible, default OFFEN)

**Zweck**: Emotionale Stimmung festlegen.

**Komponenten**:

| Feld | Typ | Optionen |
|------|-----|----------|
| Emotion Charakter | Select | Glücklich, Traurig, Nachdenklich, Aufgeregt, Ängstlich, Wütend, Überrascht, Verliebt, Verzweifelt, Hoffnungsvoll, Melancholisch, Entspannt, Neutral |
| Wirkung beim Zuschauer | Select | Spannung, Empathie, Freude, Unbehagen, Neugier, Erleichterung, Trauer, Hoffnung |

**Empty State**: Beide Dropdowns zeigen "Von KI wählen..."

---

#### Ebene 4: Kamera & Bildsprache (Collapsible, default EINGEKLAPPT)

**Zweck**: Technische Umsetzung. Für fortgeschrittene Nutzer.

**Visual Cue für eingeklappten Zustand**:
- Collapsed Header zeigt: "Kamera & Bildsprache" + kleine Tags: `Medium Shot` `Frontal`
- Das signalisiert: "Hier sind bereits Werte gesetzt, aber ich muss nicht reinschauen."

**Komponenten**:

| Feld | Typ | Optionen |
|------|-----|----------|
| Shot-Typ | Select | Extreme Close-Up, Close-Up, Medium Close-Up, Medium Shot, Medium Long Shot, Full Shot, Long Shot, Extreme Long Shot |
| Kamerawinkel | Select | Frontal, Seitlich, Von oben, Von unten, Über die Schulter, Dutch Angle, Vogelperspektive, Froschperspektive |
| Bildaufbau | Select | Zentriert, Regel der Drittel, Symmetrisch, Diagonal, Rahmen im Rahmen |
| Bewegung (optional) | Select | Keine, Dolly-In, Dolly-Out, Truck, Tilt, Pan, Crane, Arc |

**Enforced Rule**: Wenn Nutzer einen Wert ändert, wird er NICHT von KI überschrieben (außer bei explizitem "Reset auf KI-Vorschlag").

---

#### Ebene 5: KI-Feintuning (Collapsible, default EINGEKLAPPT)

**Zweck**: Advanced-Bereich für Power-User.

**Visual Cue**: Badge "Erweitert" neben dem Titel (graue Outline)

**Komponenten**:

| Feld | Typ | Placeholder |
|------|-----|-------------|
| Negative Prompts | Textarea | "Was soll NICHT im Bild erscheinen? z.B. 'keine Brille, keine Tattoos'" |
| Stil-Feintuning | Textarea | "Spezielle Stil-Anweisungen, z.B. 'im Stil von Studio Ghibli'" |
| Konsistenz-Hinweise | Textarea | "Hinweise zur Kontinuität, z.B. 'Charakter trägt selbe Kleidung wie Szene 1'" |

---

### B) RECHTE SPALTE (Ebene 6: Ergebnis & Vorschau)

**Layout**: Sticky (position: sticky, top: 80px), damit sie beim Scrollen sichtbar bleibt.

**Komponenten**:

#### Preview-Bild
- Aspect Ratio: 16:9
- Rahmen: 1px border, border-radius 12px
- Ladestate: Skeleton mit Pulse-Animation
- Kein Bild: Placeholder mit "Noch kein Bild generiert" + Icon

#### Status-Chips
- Position: Unterhalb des Bildes, horizontal
- Chips:
  - **Entwurf** (orange, outline): Szene wurde bearbeitet aber nicht finalisiert
  - **Final ✓** (grün, filled): Szene wurde übernommen
  - **Wird generiert...** (blau, animated): Bildgenerierung läuft
  - **Nicht übernommen** (rot, outline): Es gibt Änderungen seit letztem Final

#### Aktualisierungs-Status
- Text: "Aktualisiert nach letzter Änderung" (grün) ODER "Vorschau veraltet – bitte neu generieren" (orange)
- Icon: Sparkles (grün) oder RefreshCw (orange)

#### Aktions-Buttons

| Button | Variante | Funktion |
|--------|----------|----------|
| Vorschau neu generieren | Secondary (outline) | Erstellt PREVIEW (nicht final), setzt previewAsset |
| Als final übernehmen | Primary (grün, filled) | Kopiert aktuellen Zustand in finalAsset, setzt status="final" |
| Änderungen verwerfen | Ghost (text only) | Setzt alle Felder auf letzten finalAsset-Stand zurück |

**Button-Logik**:
```
IF status === "final" AND dirty === false:
  "Als final" Button → disabled, zeigt "Bereits finalisiert ✓"
  
IF finalAsset === null:
  "Änderungen verwerfen" Button → hidden (nichts zum Verwerfen)
  
IF previewAsset !== finalAsset:
  "Nicht übernommen" Chip → visible
```

---

### C) KI-ASSISTENT (Footer, sticky)

**Position**: Am unteren Rand des Editors, immer sichtbar.

**Layout**:
```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ✨ KI-Assistent                     [Text optimieren] [Bild regenerieren]       │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────┐ ┌─────┐  │
│  │  Beschreibe was du ändern möchtest...                             │ │ ✨  │  │
│  │                                                                   │ │     │  │
│  └───────────────────────────────────────────────────────────────────┘ └─────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Modi (vereinfacht auf 2)**:
- **Text optimieren**: Ändert Textfelder (Beschreibung, Schlüsselaktion, Emotion, Kamera) basierend auf Eingabe. Setzt dirty=true.
- **Bild regenerieren**: Generiert neues Preview-Bild basierend auf aktuellen Einstellungen.

**ENTFERNT**: "Kamera" und "Beides" Modi. Diese waren verwirrend. Kamera-Änderungen passieren implizit bei "Text optimieren".

---

## 5) SZENE-DATENMODELL & STATE-MACHINE

### Datenmodell

```text
Scene {
  id: string
  index: number (0-based)
  
  // DRAFT-Daten (bearbeitbar)
  draft: {
    summary: string
    detailedDescription: string
    keyAction: string
    specificArea: string
    emotion: string
    shotType: string
    cameraAngle: string
    composition: string
    movement: string
    negativePrompts: string
    styleNotes: string
    continuityNotes: string
    previewImageUrl: string | null
    previewImagePrompt: string | null
    videoPrompt: string | null
    lastModified: timestamp
  }
  
  // FINAL-Daten (Snapshot bei "Als final übernehmen")
  final: {
    ...sameFieldsAsDraft
    finalizedAt: timestamp
  } | null
  
  // Berechnete Flags
  isDirty: boolean  // draft !== final
  hasPreview: boolean  // previewImageUrl !== null
  isFinalized: boolean  // final !== null
}
```

### State-Machine

```text
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                                                                 │
                    ▼                                                                 │
┌──────────┐    onChange    ┌──────────┐   onGeneratePreview   ┌──────────────────┐   │
│  CLEAN   │ ─────────────► │  DIRTY   │ ────────────────────► │ PREVIEW_READY    │   │
│          │                │          │                       │                  │   │
└──────────┘                └──────────┘                       └──────────────────┘   │
     ▲                           │                                    │               │
     │                           │ onDiscard                          │ onFinalize    │
     │                           ▼                                    ▼               │
     │                    ┌──────────────┐                    ┌──────────────────┐    │
     │                    │ (reset auf   │                    │    FINALIZED     │    │
     │                    │  final-Stand)│                    │                  │    │
     │                    └──────────────┘                    └──────────────────┘    │
     │                                                               │                │
     └───────────────────────────────────────────────────────────────┘                │
                                                                                      │
                                        onChange ─────────────────────────────────────┘
```

### Events

| Event | Trigger | Aktion |
|-------|---------|--------|
| `onChange(field, value)` | Jede Feldänderung | `draft[field] = value`, `isDirty = true` |
| `onGeneratePreview()` | "Vorschau neu generieren" Button | API-Call, `draft.previewImageUrl = result`, Status → PREVIEW_READY |
| `onFinalize()` | "Als final übernehmen" Button | `final = deepCopy(draft)`, `isDirty = false`, Status → FINALIZED |
| `onDiscard()` | "Änderungen verwerfen" Button | `draft = deepCopy(final)`, `isDirty = false`, Status → CLEAN |

### Regel: Übersicht liest nur FINAL

```text
FinalScenesOverview {
  scenes: Scene[]
  
  render() {
    return scenes
      .filter(scene => scene.final !== null)
      .map(scene => <Thumbnail src={scene.final.previewImageUrl} />)
  }
}
```

---

## 6) ASCII-WIREFRAMES

### A) Haupteditor (zweispaltig, sticky preview)

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ◀ Zurück zur Übersicht              Szene 3 von 5              Status: Entwurf ●   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌───────────────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  │                                 │ │
│  │  ● 1. STORY-KERN                          │  │  ┌─────────────────────────┐    │ │
│  │  ──────────────────────────────────────── │  │  │                         │    │ │
│  │                                           │  │  │     PREVIEW-BILD        │    │ │
│  │  Zusammenfassung:                         │  │  │     (16:9)              │    │ │
│  │  ┌─────────────────────────────────────┐  │  │  │                         │    │ │
│  │  │ Anna betritt das Tierheim...        │  │  │  └─────────────────────────┘    │ │
│  │  └─────────────────────────────────────┘  │  │                                 │ │
│  │                                           │  │  [Entwurf]  Medium  Frontal     │ │
│  │  Detaillierte Beschreibung:       [✨]    │  │                                 │ │
│  │  ┌─────────────────────────────────────┐  │  │  ✨ Aktualisiert                 │ │
│  │  │ Im Eingangsbereich des Tierheims   │  │  │                                 │ │
│  │  │ steht Anna und schaut sich um...   │  │  │  ┌─────────────────────────┐    │ │
│  │  │                                     │  │  │  │ Vorschau neu generieren │    │ │
│  │  └─────────────────────────────────────┘  │  │  └─────────────────────────┘    │ │
│  │                                           │  │                                 │ │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  │  ┌─────────────────────────┐    │ │
│  │  ▼ 2. HANDLUNG & BETEILIGTE               │  │  │ ✓ Als final übernehmen  │    │ │
│  │  ──────────────────────────────────────── │  │  └─────────────────────────┘    │ │
│  │                                           │  │                                 │ │
│  │  Schlüsselaktion        Bereich           │  │  Änderungen verwerfen           │ │
│  │  ┌──────────────┐       ┌──────────────┐  │  │                                 │ │
│  │  │ schaut    ▼  │       │ Innenraum ▼  │  │  └─────────────────────────────────┘ │
│  │  └──────────────┘       └──────────────┘  │  │                                 │ │
│  │                                           │  │         (sticky)                │ │
│  │  Beteiligte                               │  │                                 │ │
│  │  ┌─────────────────────────────────────┐  │                                    │
│  │  │ Anna, Tierheim-Mitarbeiter          │  │                                    │
│  │  └─────────────────────────────────────┘  │                                    │
│  │                                           │                                    │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │                                    │
│  │  ▼ 3. EMOTION & WIRKUNG                   │                                    │
│  │  ──────────────────────────────────────── │                                    │
│  │                                           │                                    │
│  │  Emotion               Wirkung            │                                    │
│  │  ┌──────────────┐      ┌──────────────┐   │                                    │
│  │  │ Hoffnungsv ▼ │      │ Neugier   ▼  │   │                                    │
│  │  └──────────────┘      └──────────────┘   │                                    │
│  │                                           │                                    │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │                                    │
│  │  ▶ 4. KAMERA & BILDSPRACHE  [Medium Shot, Frontal]                            │
│  │  ──────────────────────────────────────── │                                    │
│  │                                           │                                    │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │                                    │
│  │  ▶ 5. KI-FEINTUNING  [Erweitert]          │                                    │
│  │  ──────────────────────────────────────── │                                    │
│  │                                           │                                    │
│  └───────────────────────────────────────────┘                                    │
│                                                                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ✨ KI-Assistent                              [Text optimieren] [Bild regenerieren] │
│  ┌───────────────────────────────────────────────────────────────────────┐ ┌─────┐ │
│  │ Mache die Szene emotionaler und füge mehr Details hinzu...            │ │ ✨  │ │
│  └───────────────────────────────────────────────────────────────────────┘ └─────┘ │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### B) Final-Szenen-Übersicht (nur finals)

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  FINALISIERTE SZENEN                                         3 von 5 abgeschlossen │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │            │  │            │  │            │  │            │  │            │    │
│  │   ✓ 1      │  │   ✓ 2      │  │   ✓ 3      │  │     4      │  │     5      │    │
│  │   [BILD]   │  │   [BILD]   │  │   [BILD]   │  │   [LEER]   │  │   [LEER]   │    │
│  │            │  │            │  │            │  │            │  │            │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │
│   Final ✓         Final ✓         Final ✓        Ausstehend      Ausstehend        │
│                                                                                     │
│  ────────────────────────────────────────────────────────────────────────────────── │
│                                                                                     │
│  [                    Für Veo3 exportieren (3 Szenen)                           ]  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Regeln**:
- Nur Szenen mit `final !== null` zeigen ein Bild
- Nicht-finalisierte Szenen zeigen leeren Platzhalter mit Nummer
- Klick auf finalierte Szene → öffnet sie im Editor (erstellt Entwurf-Kopie)
- Klick auf nicht-finalisierte Szene → öffnet sie im Editor zum Erstellen

### C) "Nächste Szene" Ablauf

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                     │
│                              ┌──────────────────────────────────┐                   │
│                              │                                  │                   │
│                              │     ✓ Szene 3 finalisiert!       │                   │
│                              │                                  │                   │
│                              │     Die Szene wurde erfolgreich  │                   │
│                              │     in deine Story übernommen.   │                   │
│                              │                                  │                   │
│                              │  ┌────────────────────────────┐  │                   │
│                              │  │ Zur nächsten Szene (4/5) ▶ │  │                   │
│                              │  └────────────────────────────┘  │                   │
│                              │                                  │                   │
│                              │        Zur Übersicht             │                   │
│                              │                                  │                   │
│                              └──────────────────────────────────┘                   │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7) MICROCOPY (Deutsch, Final)

### Button Labels

| Button | Label | Tooltip |
|--------|-------|---------|
| Preview generieren | Vorschau neu generieren | Erstellt eine neue Vorschau basierend auf den aktuellen Einstellungen |
| Finalisieren | Als final übernehmen | Speichert diese Szene als Teil deiner fertigen Story |
| Verwerfen | Änderungen verwerfen | Setzt alle Änderungen auf den letzten finalen Stand zurück |
| KI Text | Text optimieren | Die KI verbessert Beschreibung und Einstellungen |
| KI Bild | Bild regenerieren | Generiert ein neues Bild basierend auf deinen Änderungen |
| Export | Für Veo3 exportieren | Lädt alle finalen Szenen als ZIP herunter |
| Nächste Szene | Nächste Szene bearbeiten | |
| Vorherige | ◀ Zurück | |
| Weiter | Weiter ▶ | |

### Hinweise/Helper

| Kontext | Text |
|---------|------|
| Zusammenfassung leer | Beschreibe kurz, was in dieser Szene passiert (1-2 Sätze) |
| Beschreibung leer | Die detaillierte Szenen-Beschreibung wird hier angezeigt. Du kannst sie jederzeit bearbeiten. |
| Dropdown "Von KI" | Von KI wählen lassen... |
| Kamera eingeklappt | Shot-Typ und Winkel werden automatisch von der KI gewählt, wenn du sie nicht selbst festlegst. |
| KI-Feintuning | Erweiterte Einstellungen für erfahrene Nutzer. Die meisten Szenen brauchen das nicht. |
| KI-Assistent Placeholder | Beschreibe was du ändern möchtest, z.B. "Mache es dramatischer" oder "Ändere zu Nahaufnahme"... |

### Fehlermeldungen

| Fehler | Meldung |
|--------|---------|
| Beschreibung leer | Die Szenenbeschreibung darf nicht leer sein. |
| Bildgenerierung fehlgeschlagen | Das Bild konnte nicht generiert werden. Bitte versuche es erneut. |
| Netzwerkfehler | Verbindungsproblem. Überprüfe deine Internetverbindung. |
| KI-Limit erreicht | Du hast das Limit für KI-Anfragen erreicht. Warte einen Moment und versuche es erneut. |

### Dirty-State Banner

```text
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ⚠️ Nicht gespeicherte Änderungen                                    [Verwerfen]    │
│    Klicke auf "Als final übernehmen" um deine Änderungen zu sichern.               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

Position: Oberhalb des Editors, sticky, gelber Hintergrund (bg-warning/10)

### Finalize-Confirm (falls nötig bei Überschreiben)

Nur anzeigen wenn `final !== null` (überschreibt vorherige finale Version):

```text
┌──────────────────────────────────────────────────────────────────┐
│  Finale Version überschreiben?                                   │
│                                                                  │
│  Diese Szene hat bereits eine finale Version. Möchtest du       │
│  sie mit der aktuellen Vorschau überschreiben?                  │
│                                                                  │
│  Die vorherige Version kann nicht wiederhergestellt werden.     │
│                                                                  │
│             [Abbrechen]        [Ja, überschreiben]              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 8) VISUAL SYSTEM (Dark UI)

### Typografie-Hierarchie

| Element | Font Size | Weight | Color |
|---------|-----------|--------|-------|
| H1 (Seiten-Titel) | 24px / 1.5rem | Bold (700) | foreground |
| H2 (Sektions-Titel) | 16px / 1rem | Semibold (600) | foreground |
| H3 (Subsection) | 14px / 0.875rem | Medium (500) | foreground/80 |
| Body | 14px / 0.875rem | Regular (400) | foreground |
| Label | 12px / 0.75rem | Medium (500) | muted-foreground |
| Caption | 11px / 0.6875rem | Regular (400) | muted-foreground |

### Abstände (8pt Grid)

| Spacing | Value | Usage |
|---------|-------|-------|
| xs | 4px | Inline icon gaps |
| sm | 8px | Between related elements |
| md | 16px | Between sections |
| lg | 24px | Major section gaps |
| xl | 32px | Panel padding |

### Cards/Accordions/Dividers

**Accordion Header**:
- Height: 48px
- Background: transparent (hover: muted/10)
- Chevron: 16px, muted-foreground
- Border-bottom: 1px solid border/30

**Content Cards**:
- Background: muted/30
- Border: 1px solid border/20
- Border-radius: 8px
- Padding: 12px

**Dividers**:
- Horizontal: 1px solid border/30, margin 16px 0
- Mit Label: "──── Label ────" centered

### Button-Prioritäten

| Priority | Variant | Example |
|----------|---------|---------|
| Primary | Filled (bg-primary) | "Als final übernehmen" |
| Secondary | Outline (border-input) | "Vorschau neu generieren" |
| Tertiary | Ghost | "Änderungen verwerfen" |
| Destructive | Filled (bg-destructive) | "Löschen" |

### Status-Chips/Badges

| Status | Background | Border | Text |
|--------|------------|--------|------|
| Entwurf | transparent | orange-500 | orange-500 |
| Final ✓ | green-600 | transparent | white |
| Wird generiert | blue-500/20 | blue-500 | blue-500 |
| Nicht übernommen | transparent | destructive | destructive |
| Ausstehend | muted/50 | muted-foreground | muted-foreground |

### Fokus/States

| State | Style |
|-------|-------|
| Hover (Button) | +brightness, +shadow |
| Focus | ring-2 ring-primary ring-offset-2 |
| Disabled | opacity-50, cursor-not-allowed |
| Active | scale(0.98) |
| Dirty Field | border-left: 3px solid warning (orange) |

---

## 9) ACCESSIBILITY + RESPONSIVE

### Keyboard Flow (Tab Order)

Top-to-bottom, left-to-right:

1. Szenen-Stepper (◀ ▶)
2. Zusammenfassung Textarea
3. Detaillierte Beschreibung Textarea
4. KI-Button (optional)
5. Handlung Accordion Trigger
6. Schlüsselaktion Select
7. Bereich Select
8. Beteiligte Input
9. Emotion Accordion Trigger
10. Emotion Select
11. Wirkung Select
12. Kamera Accordion Trigger
13. Shot-Typ, Winkel, etc.
14. KI-Feintuning Accordion Trigger
15. Negative Prompts, etc.
16. Vorschau neu generieren Button
17. Als final übernehmen Button
18. Änderungen verwerfen Button
19. KI-Assistent Mode Toggle
20. KI-Assistent Textarea
21. KI-Assistent Submit Button

### Sticky Preview auf Mobile

**Breakpoints**:
- `>= 1024px` (lg): Zweispaltig, rechte Spalte sticky
- `< 1024px`: Einspaltig, Preview wird zu "Floating Preview Button"

**Mobile Layout**:

```text
┌─────────────────────────────────────────┐
│  Szene 3 von 5          [👁 Vorschau]   │ ← Sticky Header mit Preview-Button
├─────────────────────────────────────────┤
│                                         │
│  [Alle Ebenen untereinander]            │
│                                         │
│  ...                                    │
│                                         │
├─────────────────────────────────────────┤
│  KI-Assistent (sticky footer)           │
└─────────────────────────────────────────┘
```

Klick auf "👁 Vorschau" öffnet Overlay mit:
- Großes Bild
- Status-Chips
- Aktions-Buttons
- "Schließen" Button

### Kontrast

- Minimum WCAG AA (4.5:1 für Text)
- Alle interaktiven Elemente haben Fokus-Ringe
- Keine rein farbbasierte Information (immer mit Icon/Text)

### ARIA Patterns

**Accordions**:
```html
<button
  aria-expanded="true/false"
  aria-controls="panel-id"
>
  <span>Titel</span>
  <ChevronIcon aria-hidden="true" />
</button>
<div id="panel-id" role="region">
  ...content
</div>
```

**Status-Badge**:
```html
<span role="status" aria-live="polite">
  Entwurf - nicht gespeichert
</span>
```

**Dirty-State Banner**:
```html
<div role="alert" aria-live="assertive">
  Nicht gespeicherte Änderungen...
</div>
```

---

## ZUSAMMENFASSUNG DER WICHTIGSTEN ENTSCHEIDUNGEN

1. **Tabs entfernen**: Kein Wechsel zwischen Inhalt/Bild/Video. Ein linearer Flow.
2. **Sticky Preview**: Rechte Spalte bleibt beim Scrollen sichtbar.
3. **Dirty-State Banner**: Gelber Hinweis oberhalb des Editors bei ungespeicherten Änderungen.
4. **Zwei KI-Modi statt vier**: "Text optimieren" und "Bild regenerieren". Klar und eindeutig.
5. **Szenen-Stepper separiert von Übersicht**: "Aktive Szene 3/5" navigiert zwischen Entwürfen, Übersicht zeigt nur Finals.
6. **Ebene 4+5 eingeklappt mit Preview-Tags**: Nutzer sieht "Medium Shot, Frontal" ohne aufklappen zu müssen.
7. **Finalize-Bestätigung nur bei Überschreiben**: Erstmaliges Finalisieren ohne Dialog, Überschreiben mit Warnung.
8. **Mobile: Floating Preview Button**: Statt zweispaltiges Layout, das auf Mobile bricht.

