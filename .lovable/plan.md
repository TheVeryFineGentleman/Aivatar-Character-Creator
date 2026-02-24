

# Storyboard Stack Editor -- Kompletter UX- und Architektur-Plan

---

## 1) Uebergeordnete Layout-Struktur

### Neues Layout (ersetzt die 4 Tabs)

```text
+----------------------------------------------------------+
| [Posen | Story Builder]  (kleiner Segment-Toggle, links)  |
+----------------------------------------------------------+
|                                                          |
| +------------------------------------------------------+ |
| | STORYBOARD HEADER CARD                               | |
| | Titel | Zusammenfassung | Chips | Quick Actions      | |
| +------------------------------------------------------+ |
|                                                          |
| +------------------------------------------------------+ |
| | SZENE 1 STACK (collapsed/expanded)                   | |
| |   Sub-Stacks mit Karten                              | |
| +------------------------------------------------------+ |
|                                                          |
| +--- TRANSITION CARD (optional, kompakt) ---------------+|
|                                                          |
| +------------------------------------------------------+ |
| | SZENE 2 STACK                                        | |
| +------------------------------------------------------+ |
|                                                          |
| +--- TRANSITION CARD -----------------------------------+|
|                                                          |
| +------------------------------------------------------+ |
| | SZENE 3 STACK                                        | |
| +------------------------------------------------------+ |
|                                                          |
| [+ Szene hinzufuegen]                                    |
+----------------------------------------------------------+
```

- Der Posen/Story-Toggle bleibt ein zurueckhaltender Segment-Control im oberen Bereich (gleiche Position wie heute)
- Kein Tab-System mehr innerhalb des Storyboard-Generators
- Eine einzige vertikale Scroll-Flaeche mit allen Szenen-Stacks
- Mobile: Identischer Stack, volle Breite, Stacks nehmen gesamte Viewport-Breite ein

### Desktop vs Mobile

- **Desktop**: Max-Width ~1100px, zentriert. Header Card und Scene Stacks volle Breite
- **Tablet**: Max-Width 100%, leicht reduzierte Paddings
- **Mobile**: Volle Breite, Sub-Stacks als volle Breite Accordions. Kein Side-by-Side

---

## 2) Storyboard Header Card

### Aufbau

```text
+----------------------------------------------------------+
| [Story-Titel]                    [Schnell gen.] [Export] [...]  |
|                                                          |
| "Kurze Zusammenfassung der Story..."                     |
|                                                          |
| [4 Szenen] [16:9] [3 Bilder OK] [1 Video OK] [2 Final]  |
|                                                          |
| Referenzbilder: [img1] [img2] [+ Upload]                 |
| Hauptort: [Textfeld mit KI-Button]                       |
+----------------------------------------------------------+
```

### Inhalte

- **Immer sichtbar**: Titel, Format-Badge, Fortschritts-Chips, Schnell-Generieren-Button
- **Expandierbar**: Story-Zusammenfassung (Textarea), Referenzbilder, Hauptort, Szenenanzahl-Slider
- **Overflow-Menu (...)**: Alles loeschen, Storyboard neu generieren, Veo3-Export, KI-Storyboard pruefen

### Fortschritts-Chips

Kompakte Badges mit Farben:
- `4 Szenen` (neutral)
- `16:9` (outline)
- `3/4 Bilder` (blau wenn alle, gelb wenn teilweise)
- `2/4 Videos` (gruen wenn alle)
- `1/4 Final` (primary wenn alle)

### Mobile

- Titel und Quick Actions bleiben sichtbar
- Chips werden horizontal scrollbar
- Story-Zusammenfassung, Referenzbilder und Hauptort sind standardmaessig eingeklappt

---

## 3) Storyboard Stack Editor (Hauptbereich)

### Struktur

Vertikale Liste von Scene Stacks mit optionalen Transition Cards dazwischen.

### Szenen-Stack im Ueberblick (Collapsed)

```text
+----------------------------------------------------------+
| Szene 2                          [Final]  [V] [>]        |
|                                                          |
| [Thumbnail] "Marie betritt zoegernd die Kueche..."       |
|             Emotion: nachdenklich | Close-Up | Frontal    |
|             [Bild OK] [Video fehlt]                       |
+----------------------------------------------------------+
```

Ein Szenen-Stack kann zwei Zustaende haben:
- **Collapsed**: Zeigt Thumbnail, Summary, Status-Chips, Schnellaktionen
- **Expanded**: Zeigt alle Sub-Stacks mit ihren Karten

### Scroll-Verhalten

- Vertikaler Scroll fuer die gesamte Seite
- Expanded Scene Stack: Oeffnet sich inline, kein Seitenwechsel
- Bei Expand scrollt der Browser sanft zum Stack-Anfang
- Sticky: Header Card bleibt NICHT sticky (wuerde zu viel Platz nehmen). Stattdessen ein kleiner Floating Action Button unten rechts fuer "Schnell generieren"

### Zustandsdarstellung

| Zustand | Visuell |
|---|---|
| Empty (kein Text) | Gestrichelte Umrandung, "Szene hinzufuegen" Placeholder |
| Draft (nur Text) | Normale Karte, Badge "Entwurf" |
| Bild OK | Thumbnail sichtbar, Badge "Bild OK" blau |
| Video OK | Video-Icon im Thumbnail, Badge "Video OK" gruen |
| Final | Gruener Rahmen-Akzent, Badge "Final" mit Haekchen |
| Dirty (geaendert seit Final) | Gelber Punkt am Badge, "Nicht uebernommen" |
| Generierend | Pulsierender Rahmen, Loader im Thumbnail |

### Drag and Drop

- Vertikales Drag-Handle am linken Rand jedes Scene Stacks (6-Punkt-Icon)
- Beim Drag wird ein Ghost-Element angezeigt
- Transition Cards bewegen sich mit ihren angrenzenden Szenen

---

## 4) Szenen-Stack: Sub-Stacks

### Struktur innerhalb eines expandierten Szenen-Stacks

```text
+----------------------------------------------------------+
| SZENE 2                                    [Collapse] [...]|
+----------------------------------------------------------+
|                                                          |
| A) Story und Handlung                          [v]       |
|    +-- Story-Kern Karte (collapsed summary)              |
|    +-- Handlung/Ziel Karte (collapsed summary)           |
|    +-- Dialog Karte (collapsed summary)                  |
|                                                          |
| B) Aussehen und Feeling                        [v]       |
|    +-- Emotion und Wirkung Karte                         |
|    +-- Kamera und Bildsprache Karte                      |
|    +-- Stil und Feintuning Karte                         |
|                                                          |
| C) Charaktere                                  [v]       |
|    +-- Charaktere in Szene Karte                         |
|                                                          |
| D) Generierung und Output                      [v]       |
|    +-- Prompt/Blueprint Karte                            |
|    +-- Output/Preview Karte (Bild + Video)               |
|                                                          |
+----------------------------------------------------------+
```

### Sub-Stack Collapsed Zustand

```text
+----------------------------------------------------------+
| [A] Story und Handlung                   [3 Karten] [v]  |
|     "Marie betritt zoegernd..." | Ziel: Konfrontation    |
+----------------------------------------------------------+
```

- Nummer/Buchstabe-Badge links
- Titel
- 1-Zeilen-Summary der wichtigsten Karten-Inhalte als Chips/Text
- Chevron zum Aufklappen

### Sub-Stack Expanded Zustand

- Karten werden vertikal untereinander angezeigt
- Jede Karte hat ihren eigenen Collapsed/Expanded Zustand
- Sub-Stack-Header wird leicht hervorgehoben (z.B. linker Farbbalken)
- Am Ende des Sub-Stacks: KI-Aktion fuer den gesamten Sub-Stack

### Navigation zwischen Sub-Stacks

- Einfaches Accordion-Prinzip (mehrere gleichzeitig offen moeglich)
- Kein horizontales Tab-System
- Optional: "Alle aufklappen" / "Alle zuklappen" im Scene-Stack-Header

### Visuelle Trennung

- Sub-Stacks haben einen feinen linken Farbbalken (unterschiedlich pro Typ):
  - A) Story: Blau
  - B) Aussehen: Lila
  - C) Charaktere: Orange
  - D) Generierung: Gruen
- Zwischen Sub-Stacks: 16px Abstand
- Innerhalb Sub-Stacks zwischen Karten: 8px Abstand

---

## 5) Karten-System (Compact / Expanded)

### A) Compact (Standard)

Jede Karte zeigt eine informative 1-3 Zeilen Summary:

**Story-Kern Karte (Compact)**
```text
| Story-Kern         [Sparkles] [...]                      |
| "Marie betritt zoegernd die Kueche und sieht..."         |
| Bereich: Kueche | Aktion: steht zoegernd                |
```

**Charaktere Karte (Compact)**
```text
| Charaktere in Szene   [+]  [...]                        |
| [Avatar: Marie] spricht  [Avatar: Tom] Hintergrund      |
```

**Dialog Karte (Compact)**
```text
| Dialog                [Sparkles] [...]                   |
| Marie: "Ich wusste nicht, dass du hier bist."            |
| Tom: (schweigt)                                          |
```

**Emotion Karte (Compact)**
```text
| Emotion und Wirkung   [Sparkles] [...]                   |
| nachdenklich | Wirkung: Spannung                         |
```

**Kamera Karte (Compact)**
```text
| Kamera und Bild       [Sparkles] [...]                   |
| Close-Up | Frontal | Drittel-Regel                       |
```

**Output Karte (Compact)**
```text
| Output                                    [Regenerieren]  |
| [Thumbnail 80x80] Bild: OK | Video: fehlt               |
```

### B) Expanded (Detailbearbeitung)

- Karte erweitert sich inline (kein Modal/Popup)
- Alle Felder editierbar (Textareas, Selects, Dropdowns)
- KI-Aktionen pro Feld sichtbar (kleine Sparkles-Buttons)
- "Speichern" / "Verwerfen" Buttons am unteren Rand wenn dirty
- Rest der Karten im selben Sub-Stack wird leicht gedimmt (opacity: 0.6)

### UX-Regeln

- Standardmaessig alle Karten compact
- Klick auf Karte oder Bearbeiten-Button expandiert sie
- Pro Szene maximal eine Karte expanded (andere klappen automatisch zu)
- Expanded Karte bekommt einen leichten Glow/Border-Highlight
- ESC oder Klick ausserhalb klappt die Karte wieder zu

---

## 6) KI-Assistenz auf 4 Ebenen

### Ebene 1: FELD

- Kleiner Sparkles-Button neben jedem editierbaren Feld
- Oeffnet ein Mini-Popover mit:
  - Freitext-Input: "Was soll die KI aendern?"
  - Quick-Actions: z.B. "Subtiler", "Dramatischer", "Kuerzer"
- Ergebnis: Vorschlag im Feld als Diff (alter Text durchgestrichen, neuer Text hervorgehoben)
- Accept/Reject Buttons

### Ebene 2: KARTE

- Im Karten-Header: Sparkles-Button
- Oeffnet Karten-Assistenten am unteren Rand der Karte
- Freitext-Input + Quick-Presets (z.B. "Filmischer", "Natuerlicher")
- Ergebnis: Alle Felder der Karte werden als Vorschlag aktualisiert
- Accept/Reject fuer gesamte Karte, ODER "Aenderungen auswaehlen" (Checkboxen pro Feld)

### Ebene 3: SUB-STACK

- Im Sub-Stack-Header: Sparkles-Button
- Oeffnet Sub-Stack-Assistenten (aehnlich wie Karten-Assistent, aber groesser)
- Freitext + Quick-Presets
- Ergebnis: Betroffene Karten werden markiert (Badge "KI-Vorschlag")
- Accept/Reject pro Karte oder fuer gesamten Sub-Stack

### Ebene 4: GESAMTE SZENE

- Im Scene-Stack-Header: Sparkles-Button im Overflow-Menu oder als eigenstaendiger Button
- Oeffnet Scene-Assistenten als Bottom-Sheet/Drawer
- Freitext: z.B. "Mache die Szene dramatischer und dunkler"
- Ergebnis: Alle betroffenen Sub-Stacks und Karten werden markiert
- Zusammenfassung: "5 Karten in 3 Sub-Stacks geaendert"
- Accept/Reject + Detail-Ansicht

### UI-Elemente

| Kontext | Compact sichtbar | Expanded sichtbar |
|---|---|---|
| Feld-KI | Nein | Ja (Sparkles neben Feld) |
| Karten-KI | Ja (Sparkles im Header) | Ja (Assistent-Bar unten) |
| Sub-Stack-KI | Ja (Sparkles im Sub-Stack-Header) | Ja |
| Szenen-KI | Ja (im Scene-Header) | Ja |

### Accept/Reject Flow

```text
+----------------------------------------------------------+
| KI-VORSCHLAG                               [Accept] [X]  |
|                                                          |
| Geaenderte Felder:                                       |
| [x] Emotion: nachdenklich -> melancholisch               |
| [x] Kamera: Close-Up -> Medium Close-Up                  |
| [ ] Dialog: unveraendert                                 |
|                                                          |
| [Ausgewaehlte uebernehmen] [Alles verwerfen]             |
+----------------------------------------------------------+
```

---

## 7) Charaktere (Integriertes System)

### Charakter-Karte im Sub-Stack C

**Empty State:**
```text
| Charaktere in Szene                                      |
| Noch keine Charaktere zugewiesen.                        |
| [+ Charakter hinzufuegen]                                |
```

**Mit Charakteren:**
```text
| Charaktere in Szene                     [+ Hinzufuegen]  |
| [Avatar] Marie - spricht                [Bearbeiten] [X] |
| [Avatar] Tom - sichtbar (Hintergrund)   [Bearbeiten] [X] |
```

### Character Picker Drawer

Oeffnet sich als Sheet von rechts (Desktop) oder Bottom-Sheet (Mobile):

```text
+-------------------------------+
| Charakter auswaehlen     [X]  |
+-------------------------------+
| [Suche...]                    |
|                               |
| BIBLIOTHEK                    |
| [Avatar] Marie    [Waehlen]   |
| [Avatar] Tom      [Waehlen]   |
| [Avatar] Lisa     [Waehlen]   |
|                               |
| [+ Neuer Charakter]           |
+-------------------------------+
```

### Neuer Charakter (im Drawer)

- Name (Input)
- Rolle (Input: z.B. "Protagonistin")
- Referenzbilder (Upload, max 3)
- Visuelle Beschreibung (Textarea)
- Sprechstil (Textarea)
- Do/Don't Regeln (Textarea)

### Charakter-Chips im Szenen-Header (Collapsed Scene Stack)

```text
| Szene 2  [Marie] [Tom]                    [Final] [>]    |
```

Kleine Avatar-Badges mit Namen, zeigen auf einen Blick wer in der Szene ist.

### Rolle in der Szene

Jeder zugewiesene Charakter hat eine Rolle:
- `spricht` - Aktiver Dialog
- `sichtbar` - Im Bild, aber kein Dialog
- `hintergrund` - Im Hintergrund
- `off-screen` - Nicht sichtbar, aber erwaehnt

### Konsistenz-Anzeige

In der Output/Preview Karte: Hinweis wenn Charakter-Referenzbilder fuer die Generierung verwendet werden. Badge: "2 Referenzbilder aktiv"

---

## 8) Transition Cards

### Collapsed

```text
+--- Uebergang: Szene 2 -> 3 -------- [Cut] --- [Lock] ---+
```

Eine schmale Zeile zwischen den Szenen-Stacks. Zeigt nur Uebergangstyp und Lock-Status.

### Expanded

```text
+----------------------------------------------------------+
| Uebergang: Szene 2 -> Szene 3              [KI] [Lock]   |
|                                                          |
| Typ: [Match Cut v]                                       |
| Dauer: [0.5s]                                            |
| Audio: [Crossfade v]                                     |
| Kontinuitaet: "Kameraposition aehnlich halten"           |
|                                                          |
| KI-Vorschlag: Match Cut (Maries Hand -> Tuerklinke)      |
| [Uebernehmen] [Ignorieren]                               |
+----------------------------------------------------------+
```

### Beispiel: Szene 2 -> Szene 3

```text
| Szene 2: Marie steht in der Kueche, blickt zum Fenster   |
+--- Match Cut (0.5s, Audio Crossfade) --- [Lock] ---------+
| Szene 3: Marie oeffnet die Haustuer und tritt hinaus      |
```

### Uebergangsarten

Cut, Fade, Dissolve, Match Cut, Whip Pan, Smash Cut, L-Cut, J-Cut

### KI-Integration

- KI kann Uebergaenge automatisch vorschlagen basierend auf den angrenzenden Szenen
- Lock/Pin: Verhindert, dass KI den Uebergang aendert
- Manuelles Override jederzeit moeglich

---

## 9) Generierungsflow

### Globale Generierung (Header Card)

**Schnell-Generieren Button (immer sichtbar im Header):**
- Erkennt automatisch was fehlt (Text -> Bilder -> Video Prompts -> Videos)
- Ein Klick startet die naechste fehlende Phase
- Tooltip zeigt was passieren wird: "3 Bilder generieren"

**Overflow-Menu im Header:**
- Alle Szenen: Text generieren
- Alle Szenen: Bilder generieren
- Alle Szenen: Video Prompts generieren
- Alle Szenen: Videos generieren
- Veo3-Export
- Alles loeschen

### Lokale Generierung (pro Szene)

Im Scene-Stack-Header (Overflow-Menu):
- Szene neu generieren (Text)
- Bild neu generieren
- Video Prompt neu generieren
- Video neu generieren
- Nur bestimmten Sub-Stack ueberarbeiten

In der Output/Preview Karte (expanded):
- Bild regenerieren Button
- Video Prompt regenerieren Button
- Video generieren Button

### Locks

Lock-Chips in der Generierung-und-Output Sub-Stack Karte:
- [Lock: Charakter] - Referenzbilder werden beibehalten
- [Lock: Stil] - Style Notes werden nicht ueberschrieben
- [Lock: Kamera] - Shot/Angle bleiben fixiert
- [Lock: Dialog] - Dialog wird nicht geaendert

Visuell: Kleine Schloss-Icons, Toggle per Klick. Gesperrte Elemente haben einen goldenen Rand.

### Status-Anzeige

- Generierender Scene Stack pulsiert leicht
- Progress-Badge im Scene-Header: "Bild wird generiert..."
- Floating Action Button unten rechts: Zeigt globalen Fortschritt wenn Batch laeuft

---

## 10) Uebersicht und Visuelle Ordnung

### Visuelle Hierarchie

```text
Ebene 1: Scene Stack     - Grosse Karte, 24px Padding, staerkster Border
Ebene 2: Sub-Stack       - Linker Farbbalken, 16px Padding, leichter Border
Ebene 3: Karte           - 12px Padding, subtiler Border, leichter Hintergrund
Ebene 4: Feld            - Inline, kein eigener Container
```

### Spacing

- Zwischen Scene Stacks: 24px (mit Transition Card: 8px + Card + 8px)
- Zwischen Sub-Stacks: 16px
- Zwischen Karten: 8px
- Innerhalb Karten (Felder): 12px

### Farblogik

| Typ | Farbe |
|---|---|
| Status: Entwurf | Grau/Muted |
| Status: Bild OK | Blau |
| Status: Video OK | Gruen |
| Status: Final | Primary (Lila/Indigo) |
| Status: Dirty | Gelb/Amber |
| Aktion: KI | Sparkles-Gold/Primary |
| Aktion: Destructive | Rot |
| Inhalt | Foreground (neutral) |

### Progressive Disclosure Regeln

1. Scene Stack standardmaessig collapsed (nur Summary)
2. Sub-Stacks standardmaessig collapsed (nur Summary-Zeile)
3. Karten standardmaessig compact
4. KI-Felder nur in expanded Karten sichtbar
5. Lock-Optionen nur in Generierung-Sub-Stack sichtbar
6. Destructive Actions nur in Overflow-Menus

### Collapsed Summary Regeln

- Max 2 Zeilen Text
- Max 3-4 Chips/Badges
- Keine editierbaren Felder
- Keine Icons ausser im Header (Overflow statt Icon-Flut)

### Fokusmodus

Wenn eine Karte expanded wird:
- Andere Karten im gleichen Sub-Stack: opacity 0.6
- Andere Sub-Stacks: opacity 0.8
- Expanded Karte: Ring/Glow Highlight
- Smooth scroll zur expanded Karte

---

## 11) Konkrete Komponentenliste

| Komponente | Zweck | Wichtigste Props | Zustaende |
|---|---|---|---|
| `StoryboardEditor` | Root-Container fuer gesamten Storyboard-Generator | `project`, `onProjectChange` | loading, empty, active |
| `StoryboardHeaderCard` | Projekt-Header mit Titel, Summary, Chips, Actions | `project`, `onQuickGenerate`, `onExport` | collapsed, expanded |
| `StoryboardStackEditor` | Vertikale Liste aller Scene Stacks | `scenes`, `transitions`, `onReorder` | empty, populated |
| `SceneStackCard` | Einzelner Szenen-Stack (collapsed/expanded) | `scene`, `index`, `onUpdate`, `onExpand` | collapsed, expanded, generating, final |
| `SceneStackHeader` | Header-Bar eines Scene Stacks | `scene`, `status`, `characters`, `onCollapse` | collapsed, expanded, dirty |
| `SceneSubStack` | Gruppierung von thematischen Karten | `type`, `cards`, `onAiAction`, `colorAccent` | collapsed, expanded |
| `SceneSectionCard` | Einzelne editierbare Karte | `type`, `data`, `onUpdate`, `onAiAction` | compact, expanded, ai-preview |
| `ExpandableCardSummary` | Compact-Ansicht einer Karte | `summaryText`, `chips`, `onExpand` | default |
| `CardFocusEditor` | Expanded-Ansicht einer Karte mit allen Feldern | `fields`, `onSave`, `onDiscard` | clean, dirty, saving |
| `CharacterPickerDrawer` | Sheet/Drawer fuer Charakter-Auswahl | `characters`, `onSelect`, `onCreate` | empty, populated, creating |
| `CharacterChip` | Avatar + Name Badge | `character`, `role`, `onRemove` | active, muted |
| `DialogueCard` | Spezialkarte fuer Dialog-Bearbeitung | `lines`, `characters`, `onUpdate` | compact, expanded |
| `TransitionCard` | Uebergangs-Karte zwischen Szenen | `transition`, `prevScene`, `nextScene` | collapsed, expanded, ai-suggestion |
| `AiAssistantBar` | KI-Input-Bar (verwendet auf Stack/Sub-Stack/Karten-Ebene) | `scope`, `onSubmit`, `presets` | idle, generating, preview |
| `AiSuggestionPreview` | Accept/Reject Vorschau fuer KI-Aenderungen | `changes`, `onAccept`, `onReject` | pending, accepted, rejected |
| `FieldAssistantButton` | Sparkles-Button neben Feldern | `field`, `onAiAction` | idle, loading |
| `GenerationLockChips` | Lock-Toggles fuer Generierungseinstellungen | `locks`, `onToggle` | locked, unlocked |
| `StatusBadge` | Farbiger Status-Badge | `status`, `variant` | draft, image-ok, video-ok, final, dirty |
| `OverflowActionMenu` | Dropdown mit weiteren Aktionen | `actions` | default |
| `OutputPreviewCard` | Bild/Video Vorschau mit Regenerieren | `image`, `video`, `onRegenerate` | empty, image, video, generating |

---

## 12) Datenmodell (TypeScript Interfaces)

```typescript
// Gesamtes Storyboard-Projekt
interface ProjectStoryboard {
  id: string;
  title: string;
  summary: string;
  mainLocation: string;
  format: "16:9" | "9:16";
  referenceImages: string[]; // base64
  characters: Character[];
  scenes: SceneStack[];
  transitions: Transition[];
  createdAt: number;
  updatedAt: number;
}

// Ein Charakter im Projekt
interface Character {
  id: string;
  name: string;
  role: string; // z.B. "Protagonistin"
  referenceImages: string[];
  visualDescription: string;
  speakingStyle: string;
  doRules: string;
  dontRules: string;
}

// Verwendung eines Charakters in einer Szene
interface CharacterUsageInScene {
  characterId: string;
  sceneRole: "spricht" | "sichtbar" | "hintergrund" | "off-screen";
}

// Gesamter Szenen-Stack
interface SceneStack {
  id: string;
  index: number;
  subStacks: SceneSubStack[];
  status: SceneStatus;
  isExpanded: boolean;
  // Generierungsergebnisse
  generatedImage?: string;
  generatedVideo?: string;
  detailedImagePrompt?: string;
  videoPrompt?: string;
  // Snapshots
  finalSnapshot?: Partial<SceneStack>;
  finalizedAt?: number;
  generationSnapshot?: Partial<SceneStack>;
}

type SceneStatus = "draft" | "text-ok" | "image-ok" | "video-ok" | "final";

// Thematische Gruppierung innerhalb einer Szene
interface SceneSubStack {
  type: "story" | "appearance" | "characters" | "generation";
  label: string;
  colorAccent: string;
  isExpanded: boolean;
  cards: SceneCard[];
}

// Einzelne Karte
interface SceneCard {
  id: string;
  type: SceneCardType;
  isExpanded: boolean;
  data: Record<string, any>;
  locks: LockState;
}

type SceneCardType =
  | "story-core"       // summary, detailedDescription, specificArea, keyAction
  | "action-goal"      // handlung, ziel, blocking
  | "dialogue"         // dialogLines[]
  | "emotion"          // emotion, audienceEffect
  | "camera"           // cameraAngle, shotType, composition, movement
  | "style"            // styleNotes, negativePrompts, continuityNotes
  | "characters"       // characterUsages[]
  | "prompt-blueprint" // detailedImagePrompt, videoPrompt
  | "output-preview";  // generatedImage, generatedVideo

// Dialog-Zeile
interface DialogueLine {
  characterId: string;
  text: string;
  direction?: string; // Regieanweisung
}

// Uebergang zwischen Szenen
interface Transition {
  id: string;
  fromSceneIndex: number;
  toSceneIndex: number;
  type: TransitionType;
  duration: number; // Sekunden
  audioTransition: "cut" | "crossfade" | "fade-out" | "fade-in";
  continuityNote: string;
  isLocked: boolean;
  aiSuggested: boolean;
}

type TransitionType =
  | "cut" | "fade" | "dissolve" | "match-cut"
  | "whip-pan" | "smash-cut" | "l-cut" | "j-cut";

// KI-Vorschlag
interface AssistantSuggestion {
  id: string;
  scope: EditScope;
  targetId: string; // sceneId, subStackType, oder cardId
  changes: Record<string, { old: any; new: any }>;
  status: "pending" | "accepted" | "rejected" | "partial";
  prompt: string;
  createdAt: number;
}

// KI-Bearbeitungsebene
interface EditScope {
  level: "field" | "card" | "substack" | "scene";
  sceneId: string;
  subStackType?: string;
  cardId?: string;
  fieldName?: string;
}

// Lock-Status
interface LockState {
  character: boolean;
  style: boolean;
  camera: boolean;
  dialogue: boolean;
}

// Karten-Summary-Zustand
interface CardSummaryState {
  isExpanded: boolean;
  summaryText: string;
  summaryChips: string[];
}
```

---

## 13) Desktop, Tablet und Mobile Verhalten

### Desktop (1024px+)

- Header Card: Volle Breite, alle Chips sichtbar
- Scene Stacks: Volle Breite, Sub-Stacks vertikal
- Expanded Karten: Volle Breite innerhalb des Sub-Stacks
- Character Picker: Sheet von rechts (400px breit)
- KI-Vorschlaege: Inline unterhalb der Karte

### Tablet (768-1023px)

- Wie Desktop, aber reduzierte Paddings
- Header Card Chips: horizontal scrollbar wenn noetig
- Character Picker: Sheet von rechts (320px)

### Mobile (unter 768px)

- Header Card: Kompakt, Chips horizontal scrollbar, Details eingeklappt
- Scene Stacks: Volle Breite, Collapsed zeigt Mini-Thumbnail + 1 Zeile Summary
- Sub-Stacks: Volle Breite Accordion
- Expanded Karte: Nimmt fast volle Viewport-Hoehe ein (Bottom Sheet Stil)
- Character Picker: Bottom Sheet (volle Breite)
- KI-Vorschlaege: Bottom Sheet
- Output Preview: Eigener Fullscreen-View (wie heute)

### Sticky Elemente

- **Desktop/Tablet**: Nichts sticky (alles scrollt mit)
- **Mobile**: Scene-Stack-Header sticky wenn Scene expanded ist
- **Alle**: Floating Action Button unten rechts fuer "Schnell generieren" (nur wenn Batch aktiv)

### Vermeidung von Scroll-Chaos

1. Standardmaessig alles collapsed - kurze Seite
2. Nur ein Scene Stack gleichzeitig expanded empfohlen
3. "Alle zuklappen" Button im Header
4. Smooth-Scroll zum geoeffneten Element
5. Breadcrumb-artige Position: "Szene 3 > Aussehen > Kamera" als kleine Leiste

---

## 14) Konkrete Beispiele

### A) Vollstaendiger Szene-Stack "Szene 2" (Collapsed)

```text
+----------------------------------------------------------+
| [Drag] Szene 2  [Marie][Tom]  [Bild OK]   [Expand] [...]  |
|                                                          |
| [Thumbnail] "Marie betritt zoegernd die Kueche und       |
|              sieht Tom am Tisch sitzen."                  |
|              nachdenklich | Close-Up | Frontal            |
+----------------------------------------------------------+
```

### A) Vollstaendiger Szene-Stack "Szene 2" (Expanded)

```text
+----------------------------------------------------------+
| [Drag] Szene 2  [Marie][Tom]  [Bild OK]  [Collapse] [...]|
+==========================================================+
|                                                          |
| [A] Story und Handlung                             [v]   |
| -------- (blauer Akzent-Balken) --------                 |
|                                                          |
|   | Story-Kern                    [Sparkles] [...]  |    |
|   | "Marie betritt zoegernd die Kueche und sieht    |    |
|   |  Tom am Tisch sitzen."                          |    |
|   | Bereich: Kueche | Aktion: steht zoegernd        |    |
|                                                          |
|   | Handlung/Ziel                 [Sparkles] [...]  |    |
|   | Ziel: Konfrontation vermeiden | Blocking: Tuer  |    |
|                                                          |
|   | Dialog                        [Sparkles] [...]  |    |
|   | Marie: "Ich wusste nicht, dass du hier bist."    |    |
|   | Tom: (schweigt)                                  |    |
|                                                          |
|   [KI: Gesamten Story-Block verbessern]                  |
|                                                          |
| [B] Aussehen und Feeling                           [v]   |
| -------- (lila Akzent-Balken) --------                   |
|                                                          |
|   | Emotion + Wirkung             [Sparkles] [...]  |    |
|   | nachdenklich | Wirkung: Spannung                 |    |
|                                                          |
|   | Kamera + Bild                 [Sparkles] [...]  |    |
|   | Close-Up | Frontal | Drittel-Regel               |    |
|                                                          |
|   | Stil + Feintuning             [Sparkles] [...]  |    |
|   | Keine besonderen Stil-Notizen                    |    |
|                                                          |
|   [KI: Aussehen filmischer machen]                       |
|                                                          |
| [C] Charaktere                                     [v]   |
| -------- (orange Akzent-Balken) --------                 |
|                                                          |
|   | Charaktere in Szene          [+ Hinzufuegen]    |    |
|   | [Marie] spricht  [Tom] sichtbar                  |    |
|                                                          |
| [D] Generierung + Output                           [v]   |
| -------- (gruener Akzent-Balken) --------                |
|                                                          |
|   | Locks: [Charakter] [Stil] [Kamera] [Dialog]     |    |
|                                                          |
|   | Output                        [Bild regen.] [...] |  |
|   | [Bild-Preview 200px]  Status: Bild OK            |    |
|   | Video: nicht generiert  [Video Prompt gen.]       |    |
|                                                          |
+==========================================================+
```

### B) "Aussehen und Feeling" Sub-Stack (Expanded, Emotion-Karte expanded)

```text
| [B] Aussehen und Feeling                           [^]   |
| -------- (lila Akzent-Balken) --------                   |
|                                                          |
|   +-- Emotion + Wirkung (EXPANDED) --+                   |
|   |                                  |                   |
|   | Emotion:                         |                   |
|   | [nachdenklich v] [Sparkles]      |                   |
|   |                                  |                   |
|   | Wirkung auf Zuschauer:           |                   |
|   | [Spannung v]     [Sparkles]      |                   |
|   |                                  |                   |
|   | Zusaetzliche Notizen:            |                   |
|   | [Textarea: "Leichte Unsicherheit |                   |
|   |  soll spuerbar sein"]            |                   |
|   |                                  |                   |
|   +----------------------------------+                   |
|                                                          |
|   | Kamera + Bild (compact, gedimmt)            [...]  | |
|   | Close-Up | Frontal | Drittel-Regel                 | |
|                                                          |
|   | Stil + Feintuning (compact, gedimmt)        [...]  | |
|   | Keine besonderen Stil-Notizen                      | |
|                                                          |
|   [KI: Gesamten Aussehen-Block verbessern]               |
```

### C) Transition Card: Szene 2 -> Szene 3

**Collapsed:**
```text
+--- Uebergang 2->3 ----------- [Match Cut] --- [Locked] --+
```

**Expanded:**
```text
+----------------------------------------------------------+
| Uebergang: Szene 2 -> Szene 3              [KI] [Lock]   |
|                                                          |
| Typ: [Match Cut v]                                       |
| Dauer: [0.5s ----o--------]                              |
| Audio: [Crossfade v]                                     |
|                                                          |
| Kontinuitaet:                                            |
| "Maries Hand greift zur Tuer - naechste Szene zeigt      |
|  die Tuer von aussen. Aehnliche Handposition."           |
|                                                          |
| +-- KI-Vorschlag --+                                     |
| | Match Cut empfohlen: Maries Hand (Kueche) ->           |
| | Tuerklinke (Aussen). Visuell starker Uebergang.        |
| | [Uebernehmen] [Ignorieren]                             |
| +-------------------+                                    |
+----------------------------------------------------------+
```

### D) KI-Aktion auf Sub-Stack-Ebene

Nutzer klickt auf [KI] im "Aussehen und Feeling" Sub-Stack-Header:

```text
+----------------------------------------------------------+
| KI-Assistent: Aussehen und Feeling                       |
|                                                          |
| [Textarea: "Mache alles filmischer und melancholischer"]  |
|                                                          |
| Quick: [Filmischer] [Heller] [Dunkler] [Vertraeumt]     |
|                                                          |
| [Vorschlag generieren]                                   |
+----------------------------------------------------------+
```

Nach Generierung:

```text
+----------------------------------------------------------+
| KI-VORSCHLAG: 3 Karten geaendert            [X]         |
|                                                          |
| [x] Emotion: nachdenklich -> melancholisch               |
|     Wirkung: Spannung -> Trauer                          |
|                                                          |
| [x] Kamera: Close-Up -> Medium Close-Up                  |
|     Komposition: Drittel-Regel -> Rahmen im Rahmen       |
|                                                          |
| [x] Stil: (neu) "Desaturierte Farben, weiches            |
|     Gegenlicht, leichter Grain-Effekt"                   |
|                                                          |
| [Ausgewaehlte uebernehmen] [Alles verwerfen]             |
+----------------------------------------------------------+
```

---

## 15) Was explizit NICHT geaendert wird

- Der **Posen-Generator** bleibt vollstaendig separat und wird nicht veraendert
- Keine Vermischung von Posen-Flow und Storyboard-Flow
- Keine Rueckkehr zu den 4 alten Storyboard-Tabs (Projekt / Charaktere / Szenen / Generierung)
- Keine ueberladene Tab-Navigation innerhalb des Storyboard-Editors
- Der Posen/Story Toggle bleibt als einfacher Segment-Control bestehen

---

## Technischer Implementierungsplan

### Phase 1: Datenmodell und State-Management

1. Neues `StoryboardContext` mit dem oben definierten Datenmodell erstellen
2. Migration der bestehenden flachen `storyPoints[]` in die neue `SceneStack[]`-Struktur
3. Character-State aus dem Projekt herausloesen in eigenen State

### Phase 2: Basis-Komponenten

4. `StatusBadge`, `OverflowActionMenu`, `GenerationLockChips` erstellen
5. `SceneSectionCard` mit Compact/Expanded Logik
6. `SceneSubStack` als Accordion-Container
7. `SceneStackCard` als Collapsed/Expanded Container
8. `SceneStackHeader` mit Charakter-Chips und Status

### Phase 3: Layout und Integration

9. `StoryboardHeaderCard` mit Projekt-Infos und Quick-Actions
10. `StoryboardStackEditor` als vertikale Liste
11. `StoryboardEditor` als Root-Container (ersetzt aktuellen Story-Tab-Inhalt)
12. `TransitionCard` zwischen Szenen

### Phase 4: KI-Integration

13. `FieldAssistantButton` fuer Feld-Ebene
14. `AiAssistantBar` fuer Karten/Sub-Stack/Szenen-Ebene
15. `AiSuggestionPreview` mit Accept/Reject/Partial-Select
16. KI-Logik aus Index.tsx in eigene Hooks extrahieren

### Phase 5: Charakter-System

17. `CharacterPickerDrawer` mit Bibliothek und Erstellung
18. `CharacterChip` fuer Szenen-Header
19. Charakter-zu-Szene Zuweisungslogik

### Phase 6: Feinschliff

20. Drag-and-Drop fuer Szenen-Reihenfolge
21. Mobile-Optimierung (Bottom Sheets, responsive Cards)
22. Animations und Transitions
23. Bestehende Generierungslogik in neue Struktur einbinden

### Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/pages/Index.tsx` | Story-Tab-Inhalt durch `<StoryboardEditor />` ersetzen, Storyboard-State extrahieren |
| `src/components/StoryDetailPopup.tsx` | Wird langfristig ersetzt durch inline CardFocusEditor |
| `src/components/storyboard/StoryboardEditor.tsx` | NEU: Root-Container |
| `src/components/storyboard/StoryboardHeaderCard.tsx` | NEU |
| `src/components/storyboard/StoryboardStackEditor.tsx` | NEU |
| `src/components/storyboard/SceneStackCard.tsx` | NEU |
| `src/components/storyboard/SceneStackHeader.tsx` | NEU |
| `src/components/storyboard/SceneSubStack.tsx` | NEU |
| `src/components/storyboard/SceneSectionCard.tsx` | NEU |
| `src/components/storyboard/TransitionCard.tsx` | NEU |
| `src/components/storyboard/CharacterPickerDrawer.tsx` | NEU |
| `src/components/storyboard/AiAssistantBar.tsx` | NEU |
| `src/components/storyboard/AiSuggestionPreview.tsx` | NEU |
| `src/components/storyboard/OutputPreviewCard.tsx` | NEU |
| `src/components/storyboard/StatusBadge.tsx` | NEU |
| `src/components/storyboard/GenerationLockChips.tsx` | NEU |
| `src/contexts/StoryboardContext.tsx` | NEU: State-Management |
| `src/hooks/useStoryboardAi.ts` | NEU: KI-Logik extrahiert |
| `src/types/storyboard.ts` | NEU: Alle TypeScript Interfaces |

