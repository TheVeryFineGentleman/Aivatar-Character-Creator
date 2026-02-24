

# Redesign: Editor-First Storyboard-Generator (NUR Storyboard)

## Abgrenzung

Der Posen-Generator (Tab "Posen") bleibt komplett unangetastet. Alle Aenderungen betreffen ausschliesslich den Inhalt, der erscheint, wenn `activeMainTab === "story"`. Die bestehende Top-Level-Tab-Navigation ("Posen" / "Story Bilder") bleibt erhalten -- der Storyboard-Generator bekommt lediglich eine eigene interne Sub-Navigation.

### Was explizit NICHT geaendert wird:
- Posen-Generator UI, Logik und State
- ImageGallery / ImageSlot Komponenten
- Pose-spezifische Konstanten (CASUAL_POSES, COOL_POSES, etc.)
- Video-Prompt-Templates fuer den Posen-Bereich
- Login/Auth-Flow, Theme-System, DisclaimerPopup
- Top-Level Tab-Wechsel zwischen "Posen" und "Story Bilder"

---

## 1. INFORMATION ARCHITECTURE (NUR STORYBOARD)

### Aktuelle Struktur
Alles lebt in einem einzelnen Card-Block innerhalb des Story-Tabs: Story-Idee, Referenzbilder, Szenen-Karten und Generierung -- ohne klare Trennung.

### Neue interne Sub-Navigation im Story-Tab

```text
Story-Tab aktiv:
+----------------------------------------------------------+
| [Projekt]  [Charaktere]  [Szenen]  [Generierung]         |
+----------------------------------------------------------+
| (Inhalt je nach Sub-Tab)                                  |
+----------------------------------------------------------+
```

| Sub-Tab | Inhalt |
|---------|--------|
| **Projekt** | Story-Idee, Referenzbilder, Hauptort, Format (16:9/9:16), globale Einstellungen |
| **Charaktere** | Charakter-Karten erstellen/bearbeiten, Referenzbilder pro Charakter |
| **Szenen** | Szenen-Timeline, Split-View Editor + Preview, Dialog-Composer |
| **Generierung** | Batch-Steuerung Bild/Video, Status-Dashboard, Lock-Mechaniken |

**Warum besser:** Aktuell vermischt sich Story-Setup, Szenen-Detail und Generierung in einem langen Scroll. Die neue Struktur folgt dem natuerlichen Workflow: Projekt definieren, Charaktere anlegen, Szenen ausarbeiten, dann generieren.

---

## 2. DUALER UX-MODUS: PROGRESSIVE DISCLOSURE

Kein harter Modus-Wechsel. Stattdessen:

**Standard-Ansicht (Quick Mode):**
- Story-Idee eingeben, "Storyboard generieren" klicken
- Szenen-Karten erscheinen mit Zusammenfassungen
- "Alle Bilder generieren" / "Alle Videos generieren" Buttons

**Nach Klick auf Szene (Detail Mode):**
- Split-View: Editor links, sticky Preview rechts
- Story-Kern immer sichtbar (Zusammenfassung, Dialog)
- Erweiterte Sektionen einklappbar (Kamera, KI-Feintuning)
- KI-Assistent immer sichtbar am unteren Rand

### Zwei Bearbeitungsebenen

**A) Szene-Aktionen** (Quick-Action-Buttons: "Dramatischer", "Ruhiger", "Filmischer", "Kuerzer"):
- KI bekommt die komplette Szene und passt alle relevanten Felder an
- Ergebnis wird als Vorschlag angezeigt (Accept/Reject)

**B) Feld-Aktionen** (Sparkles-Icon neben jedem Feld):
- Klick oeffnet Mini-Assistent: "Dialog natuerlicher", "Kamera naeher"
- Nur dieses eine Feld wird geaendert, Rest bleibt gleich

---

## 3. NEUER USER FLOW

### Fast Path (4 Klicks)
1. Story-Idee eingeben -> "Storyboard generieren"
2. Szenen-Karten pruefen
3. "Alle Bilder generieren"
4. "Alle Videos generieren"

### Pro Path
1. Story-Idee + Charaktere anlegen (Name, Referenzbilder, Sprechstil)
2. Storyboard generieren lassen
3. Pro Szene: Dialog schreiben, Kamera einstellen, Emotion waehlen
4. Continuity-Check
5. Bilder generieren -> Video-Prompts pruefen -> Videos generieren

### Status-System pro Szene
`[Entwurf]` grau -> `[Text OK]` orange -> `[Bild OK]` blau -> `[Video OK]` gruen -> `[Final]` gold

---

## 4. CHARAKTER-SYSTEM

### Datenmodell

```typescript
interface Character {
  id: string;
  name: string;
  role: string;
  referenceImages: string[];
  visualDescription: string;
  voice: string;
  speakingStyle: string;
  emotionalBaseline: string;
  doRules: string;
  dontRules: string;
  relationships: Array<{ characterId: string; type: string }>;
  color: string;
}
```

### UI
- Charakter-Karten-Grid mit Avatar, Name, Rolle
- Klick oeffnet Editor-Sidebar: Referenzbilder (Drag & Drop), Name + Rolle, visuelle Beschreibung (Textarea mit KI-Assist), Stimme & Sprechstil, Do/Don't Regeln, Beziehungen
- KI kann beim Storyboard-Generieren automatisch Charakter-Vorschlaege aus der Story-Idee ableiten

---

## 5. DIALOG-SYSTEM PRO SZENE

### Datenmodell

```typescript
interface DialogueLine {
  id: string;
  speakerId: string;
  text: string;
  emotion: string;
  intensity: number;
  pause: number;
  type: 'speech' | 'voiceover' | 'whisper' | 'shout' | 'silence';
}

interface SceneDialogue {
  lines: DialogueLine[];
  atmosphereNote?: string;
}
```

### UI: Dialog-Composer
- Sprecher-Dropdown (alle Charaktere + "Erzaehler" + "Atmosphaere")
- Jede Zeile: Sprecher, Text, Emotion-Dropdown, Intensitaets-Slider
- KI-Buttons: "Dialog natuerlicher", "Kuerzer", "Mehr Subtext", "Dramatischer"
- Bearbeitung auf Szene-Ebene ("gesamten Dialog dramatischer") und Zeilen-Ebene (Sparkles pro Zeile)

---

## 6. SZENEN-EDITOR (SPLIT-VIEW)

### Layout
Linke Spalte (Editor, scrollbar):
1. Story-Kern (Zusammenfassung, Beschreibung -- immer sichtbar)
2. Charaktere & Blocking (wer steht wo, Blickrichtung, Aktion)
3. Dialog & Audio (Dialog-Composer + Atmosphaere-Notiz)
4. Emotion & Wirkung (einklappbar)
5. Kamera & Bildsprache (einklappbar)
6. KI-Feintuning (Negative Prompts, Stil-Locks -- einklappbar)

Rechte Spalte (sticky):
- Bild/Video Preview
- Status-Badges
- Quick-Actions (Dramatischer, Ruhiger, Filmischer)
- Generierungs-Buttons

### Feld-Assistenten
Jedes Feld bekommt ein Sparkles-Icon. Klick zeigt Kontextmenue: "Kuerzer", "Laenger", "Dramatischer", "Freistil..."

### KI-Aenderungen als Vorschlag
Diff-View mit "Uebernehmen" / "Ablehnen" / "Bearbeiten" statt blindes Ueberschreiben.

---

## 7. SPEZIALISIERTE KI-ASSISTENTEN

| Assistent | Aufgabe | Ebene | Beispiel-Buttons |
|-----------|---------|-------|-----------------|
| **Story** | Pacing, Logik, Konflikt | Projekt | "Pacing pruefen", "Konflikt verstaerken" |
| **Charakter** | Beschreibung, Konsistenz | Charakter + Szene | "Beschreibung verfeinern", "Sprechstil anpassen" |
| **Dialog** | Natuerlichkeit, Subtext | Szene | "Natuerlicher", "Mehr Subtext", "Dramatischer" |
| **Kamera** | Shot-Vorschlaege, Dynamik | Szene | "Dynamischer", "Zur vorherigen Szene passend" |
| **Continuity** | Kleidung, Tageszeit, Requisiten | Projekt | "Konsistenz pruefen", "Kleidungs-Check" |

UI: Tabs im KI-Bereich am unteren Rand des Editors.

---

## 8. UI/UX-VERBESSERUNGEN

- **Split-View** im Szenen-Editor (Editor | Preview)
- **Status-Badges** pro Szene (5-Stufen)
- **Warnungen** bei fehlenden Pflichtfeldern
- **Inline-Edit** in Szenen-Karten (Zusammenfassung direkt bearbeitbar)
- **Quick Actions** fuer Anfaenger (1-Klick "Szene verbessern")
- **Accept/Reject** fuer KI-Vorschlaege
- **Empty States** mit hilfreichen Texten
- **Progress Guidance** ("Naechster Schritt: Bilder generieren")

---

## 9. GENERIERUNGSFLOW

### Minimal: Zwei Hauptbuttons
"Alle Bilder generieren" + "Alle Videos generieren"

### Erweitert (optionale Kontrolle):
- Scope: Alle Szenen / Nur ausgewaehlte / Nur aktuelle
- Typ: Bild + Video / Nur Bild / Nur Video
- Lock-Mechanik: Charakter-Stil, Kamera-Einstellungen, Dialog sperren
- "Szene komplett neu" Button (Accept/Reject Vorschlag)
- Sparkles pro Feld fuer einzelne Regenerierung

---

## 10. KONKRETE UMSETZUNG

### Neue Komponenten

| Komponente | Aufgabe |
|-----------|---------|
| `StoryboardLayout.tsx` | Sub-Tab-Navigation innerhalb des Story-Tabs |
| `StoryboardContext.tsx` | React Context fuer gesamten Storyboard-State |
| `ProjectTab.tsx` | Story-Idee, Referenzbilder, Hauptort, Format |
| `CharacterPanel.tsx` | Charakter-Liste + Karten |
| `CharacterCard.tsx` | Einzelne Charakter-Karte |
| `CharacterEditor.tsx` | Charakter-Formular (Sheet/Sidebar) |
| `ScenesTab.tsx` | Szenen-Uebersicht mit Karten-Grid |
| `SceneCardV2.tsx` | Szenen-Karte mit Status-Badge + Inline-Edit |
| `SceneEditor.tsx` | Split-View Detail-Editor (ersetzt StoryDetailPopup) |
| `SceneStatusBadge.tsx` | Farbiger Status-Badge |
| `DialogueEditor.tsx` | Dialog-Composer |
| `DialogueLineRow.tsx` | Einzelne Dialog-Zeile |
| `FieldAssistantMenu.tsx` | Sparkles-Kontextmenu pro Feld |
| `QuickActionBar.tsx` | Szene-Level Quick-Actions |
| `AiSuggestionPreview.tsx` | Accept/Reject Diff-View |
| `AssistantDock.tsx` | Tab-basierter KI-Assistent |
| `GenerationTab.tsx` | Batch-Generierungs-Steuerung |
| `ContinuityPanel.tsx` | Konsistenz-Uebersicht |

### State-Struktur

Der gesamte Storyboard-State wird aus Index.tsx in einen `StoryboardContext` extrahiert:

```typescript
interface StoryboardState {
  storyIdea: string;
  mainLocation: string;
  characters: Character[];
  scenes: Scene[];
  globalReferenceImages: string[];
  format: string;
  generationSettings: GenerationSettings;
  activeSubTab: 'project' | 'characters' | 'scenes' | 'generation';
  selectedSceneIndex: number | null;
}

interface Scene {
  id: string;
  versions: string[];
  currentVersion: number;
  summary: string;
  detailedDescription: string;
  characterIds: string[];
  blocking: Array<{
    characterId: string;
    position: string;
    action: string;
    lookDirection: string;
  }>;
  dialogue: SceneDialogue;
  emotion: string;
  audienceEffect: string;
  cameraAngle: string;
  shotType: string;
  composition: string;
  movement: string;
  generatedImage: string;
  generatedVideo: string;
  videoPrompt: string;
  detailedImagePrompt: string;
  status: 'draft' | 'text-ok' | 'image-ok' | 'video-ok' | 'final';
  lockedFields: LockedFields;
  pendingSuggestion?: Partial<Scene>;
  // Bestehende Felder aus StoryPoint...
  specificArea?: string;
  keyAction?: string;
  negativePrompts?: string;
  styleNotes?: string;
  continuityNotes?: string;
  dialogText?: string;
  veo3CameraMovement?: string;
  veo3StartState?: string;
  veo3Motion?: string;
  veo3EndState?: string;
}

interface LockedFields {
  characterStyle: boolean;
  cameraSettings: boolean;
  imageStyle: boolean;
  dialogue: boolean;
}

interface GenerationSettings {
  scope: 'all' | 'selected' | 'single';
  selectedScenes: number[];
  type: 'image' | 'video' | 'both';
  locks: LockedFields;
}

interface AssistantSuggestion {
  id: string;
  scope: 'scene' | 'field';
  targetSceneId: string;
  targetField?: string;
  original: any;
  suggested: any;
  status: 'pending' | 'accepted' | 'rejected';
}
```

### Layout

**Desktop (ab 1024px):**
```text
+--------+-----------------------------------+
| Top-   | Story-Tab Content:                 |
| Level  | +----------------------------------+
| Tabs   | | [Projekt][Charaktere][Szenen][Gen]|
|        | +----------------------------------+
| Posen  | | (Sub-Tab Inhalt)                 |
| Story  | |                                  |
|        | | Szenen Sub-Tab:                  |
|        | | +-------------------+-----------+|
|        | | | Editor (scroll)   | Preview   ||
|        | | |                   | (sticky)  ||
|        | | +-------------------+-----------+|
+--------+-----------------------------------+
```

**Mobile (unter 768px):**
- Sub-Tabs als horizontale Leiste
- Volle Breite fuer Content
- Preview als Floating-Button
- Dialog-Editor als Bottom-Sheet

### Priorisierte Roadmap

#### Phase 1: Schneller UX-Impact
1. TypeScript Interfaces (Character, Scene, DialogueLine, etc.) als `src/types/storyboard.ts`
2. `StoryboardContext.tsx` -- State aus Index.tsx extrahieren (ca. 150 State-Variablen)
3. `StoryboardLayout.tsx` mit Sub-Tab-Navigation
4. `ProjectTab.tsx` (bestehende Story-Idee + Referenzbilder + Format)
5. `ScenesTab.tsx` + `SceneCardV2.tsx` mit Status-Badges
6. `SceneStatusBadge.tsx`
7. `SceneEditor.tsx` als Ersatz fuer StoryDetailPopup (Split-View)
8. `QuickActionBar.tsx` + `FieldAssistantMenu.tsx`
9. `AiSuggestionPreview.tsx` (Accept/Reject)

#### Phase 2: Qualitaetsboost
1. `CharacterPanel.tsx` + `CharacterCard.tsx` + `CharacterEditor.tsx`
2. `DialogueEditor.tsx` + `DialogueLineRow.tsx`
3. `AssistantDock.tsx` mit spezialisierten Assistenten
4. Charakter-Zuordnung pro Szene
5. `ContinuityPanel.tsx`
6. KI-Auto-Generierung von Charakteren aus Story-Idee

#### Phase 3: Pro-Features
1. `GenerationTab.tsx` mit Lock-Mechaniken
2. Templates/Presets System
3. Undo/Versionsverlauf pro Feld
4. Drag & Drop Szenen-Reihenfolge
5. Blocking-Editor (visuell)
6. Voice-Preview Integration
7. Batch-Bearbeitung mehrerer Szenen

---

## Beispiele

### Szene 2 Editor (Pro Path)

```text
+-------------------------------------------------------+
| < Szene 1  |  Szene 2 von 4  |  Szene 3 >            |
| Status: [Text OK]  [Bild veraltet]                     |
+-------------------------------------------------------+
|                                    |                   |
| Story-Kern                         | [Generiertes Bild]|
| Zusammenfassung:                   | Format: 16:9      |
| "Lena kehrt in die leere          |                   |
|  Wohnung zurueck" [Sparkles]      | Quick Actions:    |
|                                    | [Dramatischer]    |
| Charaktere: [Lena] [+]            | [Ruhiger]         |
|                                    | [Kuerzer]         |
| Dialog:                            |                   |
| [Lena] "Wo bist du?" [traurig]    | [Bild generieren] |
| [+ Zeile]                          | [Video generieren]|
|                                    |                   |
| [v] Emotion: Traurig              |                   |
| [>] Kamera (Medium Shot, Frontal) |                   |
| [>] KI-Feintuning                 |                   |
|                                    |                   |
| KI: [Story] [Dialog] [Kamera]     |                   |
+-------------------------------------------------------+
```

### Fast Path (Anfaenger)
1. Story-Idee eingeben -> "Storyboard generieren"
2. 4 Szenen-Karten erscheinen -> kurz pruefen
3. "Alle Bilder generieren"
4. "Alle Videos generieren" -> Fertig!

### Pro Path (Fortgeschrittene)
1. Story-Idee eingeben
2. Charaktere-Tab: "Lena" anlegen (2 Referenzbilder, Sprechstil "poetisch")
3. Storyboard generieren -> 4 Szenen
4. Szene 2 oeffnen: Dialog schreiben, Kamera auf "Over-Shoulder", Sparkles neben Emotion -> "Subtiler"
5. Continuity-Check -> "Lena traegt in Szene 1 blaue Jacke, in Szene 3 keine erwaehnt" -> Fix
6. Bilder generieren -> Video-Prompts pruefen -> Videos generieren

