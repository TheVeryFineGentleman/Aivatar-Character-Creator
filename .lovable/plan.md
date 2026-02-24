

# Redesign: Editor-First Storyboard-Tool

## Uebersicht

Dieses Dokument beschreibt die komplette Neugestaltung des Storyboard-Tools von einem "Generator-first" zu einem "Editor-first" Ansatz. Das Kernprinzip lautet: **Easy by default, powerful when needed.**

Die aktuelle Codebasis hat ~7200 Zeilen in `Index.tsx` und ~986 Zeilen in `StoryDetailPopup.tsx`. Das Redesign zerteilt diese monolithische Struktur in spezialisierte Komponenten und fuehrt ein Charakter-System, einen Dialog-Editor und spezialisierte KI-Assistenten ein.

---

## 1. INFORMATION ARCHITECTURE (NEUE STRUKTUR)

### Aktuelle Struktur
Zwei Tabs: "Posen" und "Story Bilder" -- alles in einer Seite, keine klare Trennung zwischen Planung und Generierung.

### Neue Struktur

```text
+----------------------------------------------------------+
|  [Projekt]  [Charaktere]  [Szenen]  [Generierung]        |
+----------------------------------------------------------+
```

| Tab | Inhalt | Warum |
|-----|--------|-------|
| **Projekt** | Story-Idee, Referenzbilder, Hauptort, globale Einstellungen, Format, Posen-Generator (bestehendes Feature) | Zentraler Einstiegspunkt, trennt Story-Setup vom Detail-Editing |
| **Charaktere** | Charakter-Karten, erstellen/bearbeiten, Referenzbilder pro Charakter | Eigenes System statt impliziter "Referenzbilder" |
| **Szenen** | Szenen-Timeline, Split-View mit Editor + Preview, Dialog-Composer | Kern des Editor-first Ansatzes |
| **Generierung** | Batch-Steuerung fuer Bild/Video, Status-Dashboard, Lock-Mechaniken | Klare Trennung: Erst planen, dann generieren |

**Warum diese Struktur besser ist:** Aktuell vermischt sich alles -- Story-Idee, Bildgenerierung und Szenen-Details leben auf einer Seite. Die neue Struktur folgt dem natuerlichen Workflow: Projekt definieren, Charaktere anlegen, Szenen ausarbeiten, dann generieren.

---

## 2. DUALER UX-MODUS: SCHNELLER KI-FLOW + DETAIL-EDITOR

### Konzept: Progressive Disclosure statt harter Modus-Wechsel

Es gibt keinen Toggle "Anfaenger/Profi". Stattdessen:

```text
STANDARD-ANSICHT (Quick Mode):
+----------------------------------+
| Story-Idee: [__________________] |
| [Storyboard generieren]          |
|                                  |
| Szene 1  Szene 2  Szene 3       |
| [Karte]  [Karte]  [Karte]       |
|                                  |
| [Alle Bilder generieren]         |
| [Alle Videos generieren]         |
+----------------------------------+

NACH KLICK AUF SZENE (Detail Mode):
+----------------------------------+-------------------+
| Story-Kern (immer sichtbar)      | Preview (sticky)  |
|   Zusammenfassung                |   [Bild/Video]    |
|   Dialog-Editor                  |   Status-Badges   |
|                                  |   Quick-Actions   |
| [v] Handlung & Blocking          |                   |
| [v] Emotion & Wirkung           |                   |
| [>] Kamera (eingeklappt)        |                   |
| [>] KI-Feintuning (eingeklappt) |                   |
|                                  |                   |
| KI-Assistent (immer sichtbar)   |                   |
+----------------------------------+-------------------+
```

### Zwei Bearbeitungsebenen

**A) Szene-Aktionen** (wirken auf mehrere Felder):
- Quick-Action-Buttons oben im Editor: "Dramatischer", "Ruhiger", "Filmischer", "Kuerzer"
- KI bekommt die komplette Szene und passt alle relevanten Felder an
- Ergebnis wird als Vorschlag angezeigt (Accept/Reject Diff-View)

**B) Feld-Aktionen** (wirken nur auf ein einzelnes Feld):
- Kleines Sparkles-Icon neben jedem Feld
- Klick oeffnet Mini-Assistent: "Dialog natuerlicher", "Kamera naeher", "Emotion subtiler"
- Nur dieses eine Feld wird geaendert, Rest bleibt gleich

---

## 3. NEUER USER FLOW (END-TO-END)

### Fast Path (Anfaenger, 4 Klicks)

```text
1. Story-Idee eingeben (oder KI-Vorschlag waehlen)
2. [Storyboard generieren] klicken
3. Kurz pruefen (Szenen-Karten anschauen)
4. [Alles generieren] klicken
```

### Pro Path (Fortgeschrittene)

```text
1. Story-Idee eingeben
2. Charaktere anlegen (Name, Referenzbilder, Beschreibung, Sprechstil)
3. Storyboard generieren lassen
4. Pro Szene: Dialog schreiben, Kamera einstellen, Emotion waehlen
5. Konsistenz pruefen (Continuity-Assistent)
6. Bilder einzeln oder batch generieren
7. Video-Prompts pruefen/editieren
8. Videos generieren
```

### Status-System pro Szene

```text
[Entwurf] -> [Text OK] -> [Bild OK] -> [Video OK] -> [Final]
   grau      orange       blau        gruen         gold
```

---

## 4. CHARAKTER-SYSTEM

### Datenmodell

```typescript
interface Character {
  id: string;
  name: string;
  role: string; // z.B. "Protagonist", "Nebenfigur", "Antagonist"
  referenceImages: string[]; // base64 oder URLs, max 3
  visualDescription: string; // "Grosse Frau, dunkle Haare, Brille"
  voice: string; // "warm, tief, ruhig"
  speakingStyle: string; // "kurze Saetze, direkt, poetisch"
  emotionalBaseline: string; // "melancholisch aber hoffnungsvoll"
  doRules: string; // "Traegt immer Brille, rote Jacke"
  dontRules: string; // "Nie laecheln, nie rennen"
  relationships: Array<{
    characterId: string;
    type: string; // "Freund", "Rivale", "Liebespaar"
  }>;
  color: string; // Akzentfarbe fuer UI-Zuordnung
}
```

### UI: Charakter-Panel

```text
+-----------------------------------------------+
| CHARAKTERE                    [+ Neuer Charakter] |
|                                                   |
| +----------+  +----------+  +----------+         |
| | [Avatar] |  | [Avatar] |  | [+]      |         |
| | Lena     |  | Max      |  | Hinzu-   |         |
| | Protag.  |  | Antagon. |  | fuegen   |         |
| +----------+  +----------+  +----------+         |
+-----------------------------------------------+
```

Klick auf eine Karte oeffnet den Charakter-Editor als Seitenleiste:
- Oben: Referenzbilder (Drag & Drop)
- Name + Rolle (Freitext + Dropdown)
- Visuelle Beschreibung (Textarea mit KI-Assist)
- Stimme & Sprechstil (Textarea)
- Do/Don't Regeln (zwei getrennte Felder)
- Beziehungen (Dropdown anderer Charaktere + Typ)

**KI-Auto-Generierung:** Beim Storyboard-Generieren kann die KI automatisch Charakter-Vorschlaege aus der Story-Idee ableiten. Nutzer koennen diese annehmen, anpassen oder ablehnen.

---

## 5. DIALOG-SYSTEM PRO SZENE

### Datenmodell

```typescript
interface DialogueLine {
  id: string;
  speakerId: string; // Charakter-ID oder "_narrator_" oder "_atmosphere_"
  text: string;
  emotion: string; // "wuetend", "fluestern", "neutral"
  intensity: number; // 1-5
  pause: number; // Sekunden Pause danach
  type: 'speech' | 'voiceover' | 'whisper' | 'shout' | 'silence';
}

// Ersetzt das bisherige `dialogText: string` Feld
interface SceneDialogue {
  lines: DialogueLine[];
  atmosphereNote?: string; // z.B. "Regen im Hintergrund"
}
```

### UI: Dialog-Composer

```text
+------------------------------------------------+
| DIALOG                                          |
|                                                  |
| [Lena v] "Ich haette nie gedacht..."  [traurig] |
|          Intensitaet: [====---]  Pause: 1.5s    |
|                                                  |
| [Max  v] "Das war dein Fehler."       [kalt]    |
|          Intensitaet: [======-]  Pause: 0s      |
|                                                  |
| [+ Zeile hinzufuegen]                           |
|                                                  |
| [KI: Dialog natuerlicher] [KI: Subtext]         |
+------------------------------------------------+
```

- Sprecher-Dropdown zeigt alle Charaktere des Projekts + "Erzaehler" + "Atmosphaere"
- Jede Zeile hat: Sprecher, Text, Emotion-Dropdown, Intensitaets-Slider
- Drag & Drop zum Sortieren der Zeilen
- KI-Buttons: "Dialog natuerlicher", "Kuerzer", "Mehr Subtext", "Dramatischer"

### Bearbeitungsebenen im Dialog:
- **Szene-Ebene:** "Schreibe den gesamten Dialog dramatischer um"
- **Zeilen-Ebene:** Sparkles-Icon pro Zeile -- "Mach diese Zeile natuerlicher"

---

## 6. SZENEN-EDITOR (NEU STRUKTURIERT)

### Layout: Split-View

```text
+---------------------------+--------------------+
| LINKE SPALTE (Editor)     | RECHTE SPALTE      |
|                           | (sticky Preview)   |
| 1. Story-Kern             |                    |
|    - Zusammenfassung      | [Bild/Video]       |
|    - Beschreibung         | Status-Badges      |
|                           |                    |
| 2. Charaktere & Blocking  | Quick Actions:     |
|    - Wer steht wo?        | [Dramatischer]     |
|    - Blickrichtung        | [Ruhiger]          |
|    - Aktion               | [Filmischer]       |
|                           |                    |
| 3. Dialog & Audio         | [Bild regenerieren]|
|    - Dialog-Composer      | [Video generieren] |
|    - Atmosphaere-Notiz    |                    |
|                           |                    |
| 4. Emotion & Wirkung      |                    |
|    - Charakter-Emotion    |                    |
|    - Zuschauer-Wirkung    |                    |
|                           |                    |
| 5. Kamera & Bildsprache   |                    |
|    - Shot Type            |                    |
|    - Kamerawinkel         |                    |
|    - Komposition          |                    |
|    - Bewegung             |                    |
|                           |                    |
| 6. KI-Feintuning          |                    |
|    - Negative Prompts     |                    |
|    - Stil-Locks           |                    |
|    - Konsistenz-Hinweise  |                    |
|                           |                    |
| KI-Assistent (sticky)     |                    |
+---------------------------+--------------------+
```

### Feld-Assistenten

Jedes bearbeitbare Feld bekommt ein kleines Sparkles-Icon. Klick darauf zeigt ein Kontextmenu:

```text
[Zusammenfassung: "Lena steht am Fenster..."]  [*]
                                                 |
                                          +------+------+
                                          | Kuerzer     |
                                          | Laenger     |
                                          | Dramatischer|
                                          | Freistil... |
                                          +-------------+
```

### KI-Aenderungen als Vorschlag

Wenn die KI eine Szene ueberarbeitet, wird das Ergebnis nicht sofort uebernommen, sondern als Diff angezeigt:

```text
+------------------------------------------+
| KI-Vorschlag:                             |
|                                           |
| - "Lena steht am Fenster"               |
| + "Lena lehnt erschoepft am Fenster,    |
|    ihr Blick verliert sich im Regen"     |
|                                           |
| [Uebernehmen]  [Ablehnen]  [Bearbeiten] |
+------------------------------------------+
```

---

## 7. SPEZIALISIERTE KI-ASSISTENTEN

Statt eines generischen "KI-Assistent" Feldes gibt es fuenf spezialisierte Assistenten.

### 7.1 Story-Assistent
- **Aufgabe:** Pacing, Logik, Konflikt, Spannungsbogen
- **Ebene:** Projekt (alle Szenen)
- **Inputs:** Alle Szenen-Zusammenfassungen
- **Outputs:** Vorschlaege fuer Reihenfolge, fehlende Szenen, Pacing-Probleme
- **Buttons:** "Pacing pruefen", "Konflikt verstaerken", "Szene vorschlagen"

### 7.2 Charakter-Assistent
- **Aufgabe:** Beschreibung, Konsistenz, Sprechstil
- **Ebene:** Charakter + Szene
- **Inputs:** Charakter-Daten, aktuelle Szene
- **Outputs:** Beschreibungs-Vorschlaege, Konsistenz-Warnungen
- **Buttons:** "Beschreibung verfeinern", "Sprechstil anpassen"

### 7.3 Dialog-Assistent
- **Aufgabe:** Natuerlichkeit, Subtext, Tempo
- **Ebene:** Szene (Dialog-Composer)
- **Inputs:** Dialog-Zeilen, Charakter-Sprechstile, Szenen-Emotion
- **Outputs:** Ueberarbeiteter Dialog
- **Buttons:** "Natuerlicher", "Mehr Subtext", "Kuerzer", "Dramatischer"

### 7.4 Kamera-Assistent
- **Aufgabe:** Shot-Vorschlaege, Dynamik, visuelle Kontinuitaet
- **Ebene:** Szene
- **Inputs:** Szenen-Beschreibung, Emotion, vorherige/naechste Szene
- **Outputs:** Kamerawinkel, Shot-Typ, Bewegungs-Vorschlag
- **Buttons:** "Dynamischer", "Ruhiger", "Zur vorherigen Szene passend"

### 7.5 Continuity-Assistent
- **Aufgabe:** Kleidung, Tageszeit, Requisiten, Raumlogik
- **Ebene:** Projekt (alle Szenen)
- **Inputs:** Alle Szenen + Charakter-Daten
- **Outputs:** Warnungen bei Inkonsistenzen
- **Buttons:** "Konsistenz pruefen", "Tageszeit-Logik", "Kleidungs-Check"

### UI-Integration

Die Assistenten werden als Tabs im KI-Bereich angezeigt:

```text
+------------------------------------------------------+
| KI-Assistent:  [Story] [Dialog] [Kamera] [Continuity]|
|                                                       |
| [Eingabe oder Quick-Actions]                          |
+------------------------------------------------------+
```

---

## 8. UI/UX-VERBESSERUNGEN

| Feature | Beschreibung | Warum |
|---------|-------------|-------|
| **Split-View** | Szenen-Liste links, Editor mitte, Preview rechts | Kontext bleibt sichtbar beim Editieren |
| **Status-Badges** | Farbige Badges pro Szene (Entwurf/Text OK/Bild OK/Video OK/Final) | Sofort erkennbar, was noch fehlt |
| **Warnungen** | Orange Hinweise bei fehlenden Pflichtfeldern | Verhindert Fehler vor Generierung |
| **Inline-Edit in Karten** | Zusammenfassung direkt in Szenen-Karte bearbeitbar | Weniger Klicks fuer kleine Aenderungen |
| **Drag & Drop** | Szenen-Reihenfolge per Drag aendern | Natuerliche Story-Anpassung |
| **Templates/Presets** | "Drama", "Horror", "Interview", "Werbung" als Schnellstart | Reduziert Einstiegshuerde |
| **Undo** | Ctrl+Z fuer letzte Aenderung pro Feld | Sicherheitsnetz beim Editieren |
| **Empty States** | Hilfreiche Texte wenn Bereiche leer sind | Fuehrt Anfaenger durch den Prozess |
| **Quick Actions** | 1-Klick "Szene verbessern" Buttons | Einfachster Weg zur Verbesserung |
| **Accept/Reject** | KI-Vorschlaege als Preview statt blind ueberschreiben | Nutzer behaelt Kontrolle |
| **Progress Guidance** | "Naechster Schritt: Bilder generieren" Hinweis | Klare Fuehrung |

---

## 9. GENERIERUNGSFLOW

### Minimal-Flow (2 Buttons)

```text
[Alle Bilder generieren]    [Alle Videos generieren]
```

### Erweiterter Flow

```text
Generierungs-Einstellungen:
+--------------------------------------------------+
| Auswahl:  [Alle Szenen]  [Nur aktuelle]          |
| Typ:      [Bild + Video]  [Nur Bild]  [Nur Video]|
|                                                    |
| Locks:                                             |
| [x] Charakter-Stil beibehalten                    |
| [x] Kamera-Einstellungen beibehalten              |
| [ ] Bildstil beibehalten                          |
|                                                    |
| [Generieren]                                       |
+--------------------------------------------------+
```

### Lock-Mechanik

```typescript
interface LockedFields {
  characterStyle: boolean; // Referenzbilder immer verwenden
  cameraSettings: boolean; // Kamerawinkel/Shot nicht von KI aendern
  imageStyle: boolean; // Stil-Notizen als fix betrachten
  dialogue: boolean; // Dialog nicht aendern bei Szenen-Rewrite
}

interface GenerationSettings {
  scope: 'all' | 'selected' | 'single';
  selectedScenes: number[];
  type: 'image' | 'video' | 'both';
  locks: LockedFields;
}
```

### Szene komplett neu schreiben lassen

Quick-Action Button "Szene komplett neu" -- KI bekommt Story-Kontext + vorherige/naechste Szene und schreibt alle Felder neu. Ergebnis als Accept/Reject Vorschlag.

### Einzelnes Feld regenerieren

Sparkles-Icon neben jedem Feld -- KI optimiert nur dieses Feld.

---

## 10. KONKRETE UMSETZUNG

### Neue Komponenten

| Komponente | Aufgabe |
|-----------|---------|
| `StoryboardLayout.tsx` | Haupt-Layout mit Tab-Navigation (Projekt/Charaktere/Szenen/Generierung) |
| `CharacterPanel.tsx` | Charakter-Liste + Editor-Sidebar |
| `CharacterCard.tsx` | Einzelne Charakter-Karte |
| `CharacterEditor.tsx` | Vollstaendiges Charakter-Formular |
| `SceneTimeline.tsx` | Horizontale Szenen-Uebersicht mit Drag & Drop |
| `SceneCardV2.tsx` | Verbesserte Szenen-Karte mit Inline-Edit + Status-Badge |
| `SceneEditor.tsx` | Refactored Scene-Detail-Editor (aus StoryDetailPopup) |
| `DialogueEditor.tsx` | Dialog-Composer pro Szene |
| `DialogueLine.tsx` | Einzelne Dialog-Zeile mit Sprecher/Emotion/Intensitaet |
| `FieldAssistantMenu.tsx` | Kontextmenu fuer Feld-spezifische KI-Aktionen |
| `QuickActionBar.tsx` | Szene-Level Quick-Actions (Dramatischer, Ruhiger, etc.) |
| `SceneStatusBadge.tsx` | Farbiger Status-Badge |
| `AssistantDock.tsx` | Tab-basierter KI-Assistent (Story/Dialog/Kamera/Continuity) |
| `AiSuggestionPreview.tsx` | Accept/Reject Diff-View fuer KI-Vorschlaege |
| `GenerationPanel.tsx` | Batch-Generierungs-Steuerung |
| `ContinuityPanel.tsx` | Konsistenz-Uebersicht ueber alle Szenen |

### State-Struktur

```typescript
// Projekt-Level State (in StoryboardLayout oder Context)
interface ProjectState {
  storyIdea: string;
  mainLocation: string;
  characters: Character[];
  scenes: Scene[];
  globalReferenceImages: string[];
  format: string; // "16:9" | "9:16"
  generationSettings: GenerationSettings;
}

// Scene (erweitert bisheriges StoryPoint)
interface Scene {
  id: string;
  // Bestehende Felder aus StoryPoint...
  versions: string[];
  currentVersion: number;
  summary: string;
  detailedDescription: string;
  // NEU: Charakter-Zuordnung
  characterIds: string[]; // Welche Charaktere in dieser Szene
  blocking: Array<{
    characterId: string;
    position: string;
    action: string;
    lookDirection: string;
  }>;
  // NEU: Strukturierter Dialog
  dialogue: SceneDialogue;
  // Bestehende Felder...
  emotion: string;
  audienceEffect: string;
  cameraAngle: string;
  shotType: string;
  composition: string;
  movement: string;
  // Generation
  generatedImage: string;
  generatedVideo: string;
  videoPrompt: string;
  detailedImagePrompt: string;
  // Status
  status: 'draft' | 'text-ok' | 'image-ok' | 'video-ok' | 'final';
  lockedFields: LockedFields;
  // KI-Vorschlag (pending)
  pendingSuggestion?: Partial<Scene>;
}

// KI-Vorschlag
interface AssistantSuggestion {
  id: string;
  scope: 'scene' | 'field';
  targetSceneId: string;
  targetField?: string; // z.B. "dialogue", "emotion"
  original: any;
  suggested: any;
  status: 'pending' | 'accepted' | 'rejected';
}
```

### Seiten-/Layout-Struktur

**Desktop (ab 1024px):**
```text
+--------+-----------------------------------+
| Sidebar| Main Content Area                  |
| (Nav)  | (Abhaengig vom aktiven Tab)        |
|        |                                    |
| [Proj] | Szenen-Tab:                        |
| [Char] | +------+------------------+-------+|
| [Szen] | |Time- | Editor           |Preview||
| [Gen ] | |line  | (scrollbar)      |(sticky)||
|        | +------+------------------+-------+|
+--------+-----------------------------------+
```

**Mobile (unter 768px):**
- Tabs als horizontale Leiste oben
- Volle Breite fuer Content
- Preview als Floating-Button (wie aktuell)
- Dialog-Editor als Bottom-Sheet

### Priorisierte Roadmap

#### Phase 1: Schneller UX-Impact (2-3 Wochen)
1. `StoryboardLayout.tsx` mit Tab-Navigation erstellen
2. `SceneCardV2.tsx` mit Status-Badges und Inline-Edit
3. `SceneStatusBadge.tsx` mit 5-Stufen-System
4. `QuickActionBar.tsx` (Dramatischer/Ruhiger/Filmischer)
5. `FieldAssistantMenu.tsx` (Sparkles pro Feld)
6. `AiSuggestionPreview.tsx` (Accept/Reject statt blind ueberschreiben)
7. Index.tsx aufteilen in kleinere Dateien (State in Context)

#### Phase 2: Qualitaetsboost (3-4 Wochen)
1. `CharacterPanel.tsx` + `CharacterEditor.tsx` + `CharacterCard.tsx`
2. `DialogueEditor.tsx` + `DialogueLine.tsx`
3. `AssistantDock.tsx` mit spezialisierten Assistenten
4. `SceneTimeline.tsx` mit Drag & Drop
5. `ContinuityPanel.tsx`
6. Charakter-Zuordnung pro Szene
7. KI-Auto-Generierung von Charakteren aus Story

#### Phase 3: Pro-Features (4+ Wochen)
1. `GenerationPanel.tsx` mit Lock-Mechaniken
2. Templates/Presets System
3. Undo/Versionsverlauf pro Feld
4. Blocking-Editor (visuell: wer steht wo)
5. Voice-Preview Integration (Text-to-Speech)
6. Export-Verbesserungen
7. Batch-Bearbeitung mehrerer Szenen gleichzeitig

---

## Beispiele

### Beispiel: Szene 2 Editor (Pro Path)

```text
+-------------------------------------------------------+
| < Szene 1  |  Szene 2 von 4  |  Szene 3 >            |
| Status: [Text OK]  [Bild veraltet]                     |
+-------------------------------------------------------+
|                                    |                   |
| Story-Kern                         | [Generiertes Bild]|
| Zusammenfassung:                   | Format: 16:9      |
| "Lena kehrt in die leere          |                   |
|  Wohnung zurueck" [*]             | Emotion: traurig  |
|                                    | Shot: Medium      |
| Beschreibung:                      |                   |
| "Lena oeffnet die Tuer..." [*]    | [Bild generieren] |
|                                    | [Video generieren]|
| Charaktere: [Lena] [+]            |                   |
|                                    | Quick Actions:    |
| Dialog:                            | [Dramatischer]    |
| [Lena v] "Wo bist du?" [traurig]  | [Ruhiger]         |
| [Lena v] "..."          [still]   | [Kuerzer]         |
| [+ Zeile]                          |                   |
|                                    |                   |
| [v] Emotion: Traurig              |                   |
| [>] Kamera (Medium Shot, Frontal) |                   |
| [>] KI-Feintuning                 |                   |
|                                    |                   |
| KI: [Story] [Dialog] [Kamera]     |                   |
| [Eingabe... ___________________]  |                   |
+-------------------------------------------------------+
```

### Beispiel: Fast Path (Anfaenger)

```text
1. "Eine Frau entdeckt einen Brief ihres verstorbenen Vaters"
   -> [Storyboard generieren]

2. 4 Szenen erscheinen als Karten mit Zusammenfassungen
   -> Kurz lesen, sieht gut aus

3. -> [Alle Bilder generieren]
   -> Bilder erscheinen automatisch

4. -> [Alle Videos generieren]
   -> Fertig!
```

### Beispiel: Pro Path (Fortgeschrittene)

```text
1. Story-Idee eingeben
2. [Charaktere] Tab -> "Lena" anlegen mit 2 Referenzbildern,
   Beschreibung, Sprechstil "kurz, poetisch, melancholisch"
3. Storyboard generieren -> 4 Szenen
4. Szene 2 oeffnen:
   - Zusammenfassung anpassen
   - Dialog schreiben: "Wo bist du?" (traurig, Intensitaet 4)
   - Kamera auf "Over-Shoulder" aendern
   - [*] neben Emotion -> "Subtiler" waehlen
5. Continuity-Check -> "Lena traegt in Szene 1 blaue Jacke,
   in Szene 3 ist keine erwaehnt" -> Fix anwenden
6. Szene 2 Bild generieren -> Ergebnis pruefen
7. Video-Prompt pruefen -> "Mehr Kamerabewegung" per KI anpassen
8. Videos generieren
```

