

# Storyboard Stack Editor v2 -- Erweiterungsplan

## Ausgangslage

Phase 1+2 des Stack-Editors sind bereits implementiert:
- Datenmodell (`src/types/storyboard.ts`) mit SceneStack, SubStacks, Cards
- StoryboardContext mit CRUD-Operationen
- Basis-Komponenten: SceneStackCard, SceneSubStack, SceneSectionCard, TransitionCard, StoryboardHeaderCard, StatusBadge, OverflowActionMenu, GenerationLockChips
- Integration in Index.tsx unter dem "Story"-Tab

Dieser Plan erweitert die bestehende Architektur um die fehlenden Features.

---

## 1) Startflow: KI generiert komplette Story aus Story-Idee

### Neue Komponente: `StoryIdeaGenerateCard`

Wird angezeigt wenn `project.scenes.length === 0` (anstelle des aktuellen "Noch keine Szenen"-Placeholders in StoryboardStackEditor).

**Aufbau der Karte:**

```text
+----------------------------------------------------------+
| Story-Idee eingeben oder Vorschlag waehlen               |
|                                                          |
| Vorschlaege:                                             |
| [Ein Influencer entdeckt ein magisches Cafe...]          |
| [Zwei Fremde treffen sich jeden Tag...]                  |
| [Ein verlorener Brief fuehrt zu...]                      |
| [Neue Vorschlaege laden]                                 |
|                                                          |
| [Textarea: Eigene Story-Idee eingeben...]                |
|                                                          |
| Szenen: [---o----] 6     Format: [16:9 v]                |
|                                                          |
| v Erweiterte Optionen                                    |
|   [x] Dialoge automatisch erzeugen                       |
|   [x] Uebergaenge automatisch erzeugen                   |
|   Genre/Stil: [________________]                         |
|                                                          |
| [Storyboard generieren]                                  |
+----------------------------------------------------------+
```

**Easy Mode (Standard):** Textarea + Vorschlaege + Szenen-Slider + Format. Erweiterte Optionen eingeklappt.

**Loading-Zustand:** Karte zeigt Fortschrittsbalken mit "Storyboard wird erstellt... Szene 3/6" und pulsierende Animation.

**Ergebnis:** Context wird mit generierten Szenen, Dialogen, Transitions und Character-Vorschlaegen befuellt. Alle Scene Stacks erscheinen.

### Backend: Neue Edge Function `generate-storyboard`

Nutzt Lovable AI (gemini-3-flash-preview) mit Tool-Calling um strukturierte Szenen-Daten zurueckzugeben. Empfaengt Story-Idee, Szenenanzahl, Format. Gibt Array von Szenen mit allen Sub-Stack-Daten + Transitions + Character-Vorschlaege zurueck.

---

## 2) Echte Karten-Optik (Visual Upgrade)

Alle bestehenden Komponenten erhalten ein visuelles Upgrade fuer "echte Karten":

- **SceneStackCard**: Staerkerer Shadow/Glow, klarer Header/Body/Footer mit `border-b` Trennlinien, leichtes `bg-gradient-to-b`
- **SceneSectionCard**: Sichtbarer Kartenrand, dezenter `shadow-md`, Header-Bereich mit leichtem Hintergrund-Unterschied
- **SceneSubStack**: Kartengruppen-Container mit eigenem Border und leichtem Inset-Schatten
- **TransitionCard**: Schmalere, visuell abgesetzte "Zwischen-Karte" mit gestricheltem Rand

Aenderungen erfolgen primaer ueber CSS-Klassen in den bestehenden Komponenten -- keine neue Architektur noetig.

---

## 3) Szenen-Slider / Schnellnavigation

### Neue Komponente: `SceneStackSlider`

Horizontaler Mini-Card-Slider oberhalb der vertikalen Szenen-Liste. Zeigt kompakte Szenen-Thumbnails zur schnellen Navigation.

```text
[Szene 1] [Szene 2] [Szene 3] [Szene 4] [Szene 5] [Szene 6]
   ●         ○         ○         ○         ○         ○
```

- Jede Mini-Card: ~120px breit, zeigt Szenennummer + 1-Zeilen-Summary + Status-Badge
- Klick scrollt zur entsprechenden Szene im Editor
- Aktive Szene ist hervorgehoben
- Horizontales Scrollen per Touch/Drag oder Pfeiltasten
- Nutzt `embla-carousel-react` (bereits installiert)

### Sub-Stack-Segment-Auswahl

Innerhalb einer expandierten Szene: Horizontale Segment-Buttons (A, B, C, D) statt klassischer Tabs. Klick scrollt zum Sub-Stack oder blendet nur den gewaehlten Sub-Stack ein.

```text
[A Story] [B Aussehen] [C Charaktere] [D Generierung]
```

---

## 4) Szenen-Management (Hinzufuegen/Duplizieren/Einfuegen)

### Neue Komponente: `InsertSceneButtonRow`

Schmaler "+"-Button zwischen Szenen-Stacks (und am Ende), der bei Hover ein Dropdown zeigt:

- Leere Szene einfuegen
- Szene per KI erzeugen
- Szene duplizieren (von vorheriger/naechster)

### Erweiterung StoryboardContext

Neue Methoden:
- `insertSceneAt(index: number)` -- fuegt leere Szene an Position ein
- `duplicateScene(sceneId: string)` -- kopiert Szene mit allen Daten
- `insertSceneWithAI(index: number, prompt: string)` -- generiert neue Szene per KI

### Erweiterung OverflowActionMenu in SceneStackCard

Zusaetzliche Aktionen:
- "Szene davor einfuegen"
- "Szene danach einfuegen"
- "Szene duplizieren"
- "Nur Dialog neu generieren"
- "Nur Uebergang neu generieren"

---

## 5) KI-Assistenz auf 5 Ebenen

### Ebene 0: Gesamtes Storyboard (NEU)

Neue Komponente: `StoryboardAssistantBar` -- erscheint im Header-Card-Bereich oder als Floating-Element.

- Freitext: "Mache die ganze Story dramatischer"
- Quick-Presets: [Dramatischer] [Kuerzer] [Mehr Dialoge] [Weniger Szenen]
- Ergebnis: Alle betroffenen Szenen werden markiert, Accept/Reject pro Szene oder global

### Ebenen 1-4 (bereits konzipiert, Implementierung)

- **Ebene 1 (Feld):** `FieldAssistantButton` -- Sparkles-Icon neben jedem Textfeld in expanded Cards
- **Ebene 2 (Karte):** Sparkles-Button im SceneSectionCard-Header
- **Ebene 3 (Sub-Stack):** Sparkles-Button im SceneSubStack-Header
- **Ebene 4 (Szene):** "KI: Szene verbessern" im SceneStackCard OverflowMenu

### Neue Komponente: `AiSuggestionPreview`

Universelle Preview-Karte fuer KI-Vorschlaege auf allen Ebenen:

```text
+----------------------------------------------------------+
| KI-VORSCHLAG: 3 Aenderungen              [Accept] [X]    |
|                                                          |
| [x] Emotion: nachdenklich -> melancholisch               |
| [x] Dialog: "Ich wusste..." -> "Warum bist du hier?"    |
| [ ] Kamera: unveraendert                                |
|                                                          |
| [Ausgewaehlte uebernehmen] [Alles verwerfen]             |
+----------------------------------------------------------+
```

### Backend: Erweiterung `generate-storyboard` Edge Function

Neuer Modus fuer KI-Ueberarbeitung: empfaengt aktuellen Storyboard-State + Prompt + Scope (storyboard/scene/substack/card/field), gibt strukturierte Aenderungsvorschlaege zurueck.

---

## 6) Datenmodell-Erweiterungen

### Neue Typen in `src/types/storyboard.ts`

```typescript
// Story-Idee Input
interface StoryIdeaInput {
  idea: string;
  sceneCount: number;
  format: "16:9" | "9:16";
  genre?: string;
  generateDialogues: boolean;
  generateTransitions: boolean;
}

// EditScope erweitern um "storyboard" Level
type EditScopeLevel = "field" | "card" | "substack" | "scene" | "storyboard";

// Slider-Selection State (fuer Context)
interface SliderSelectionState {
  activeSceneIndex: number | null;
  activeSubStackType: SubStackType | null;
}
```

### StoryboardContext Erweiterungen

Neue State-Felder:
- `storyIdeaInput: StoryIdeaInput | null`
- `isGeneratingStoryboard: boolean`
- `generationProgress: { current: number; total: number } | null`
- `activeSceneIndex: number | null` (fuer Slider-Synchronisation)
- `pendingSuggestion: AssistantSuggestion | null`

Neue Methoden:
- `generateFromIdea(input: StoryIdeaInput): Promise<void>`
- `insertSceneAt(index: number): void`
- `duplicateScene(sceneId: string): void`
- `applyAiSuggestion(suggestion: AssistantSuggestion): void`
- `rejectAiSuggestion(): void`
- `setActiveSceneIndex(index: number | null): void`

---

## 7) Implementierungsplan (Phasen)

### Phase A: Startflow + Edge Function

1. Edge Function `generate-storyboard` erstellen (Lovable AI mit Tool-Calling)
2. `StoryIdeaGenerateCard` Komponente bauen
3. `StoryboardStackEditor` anpassen: zeigt StoryIdeaGenerateCard wenn keine Szenen
4. Context erweitern: `generateFromIdea`, Loading-State, Progress

### Phase B: Visuelle Karten-Aufwertung

5. SceneStackCard: Header/Body/Footer Trennung, Shadows, Gradient
6. SceneSectionCard: Kartenoptik mit Tiefe
7. SceneSubStack: Gruppencontainer-Stil
8. TransitionCard: "Zwischen-Karte" Optik

### Phase C: Slider-Navigation

9. `SceneStackSlider` mit embla-carousel-react
10. Sub-Stack Segment-Buttons in SceneStackCard
11. Synchronisation: Slider-Klick scrollt zu Szene, Szene-Expand aktualisiert Slider

### Phase D: Szenen-Management

12. `InsertSceneButtonRow` zwischen Szenen
13. Context: `insertSceneAt`, `duplicateScene`
14. OverflowMenu-Erweiterungen in SceneStackCard

### Phase E: KI-Assistenz (5 Ebenen)

15. `StoryboardAssistantBar` fuer Ebene 0
16. `AiSuggestionPreview` als universelle Vorschau-Komponente
17. `FieldAssistantButton` fuer Feld-Ebene
18. Edge Function erweitern: AI-Ueberarbeitungsmodus
19. Accept/Reject-Flow im Context

---

## 8) Betroffene Dateien

| Datei | Aenderung |
|---|---|
| `src/types/storyboard.ts` | StoryIdeaInput, EditScope erweitern, SliderSelectionState |
| `src/contexts/StoryboardContext.tsx` | Neue Methoden + State (generateFromIdea, insertSceneAt, duplicateScene, AI-Suggestion-State) |
| `src/components/storyboard/StoryboardStackEditor.tsx` | StoryIdeaGenerateCard einbinden, InsertSceneButtonRow, SceneStackSlider |
| `src/components/storyboard/SceneStackCard.tsx` | Visual Upgrade, Sub-Stack Segment-Buttons, erweiterte OverflowActions |
| `src/components/storyboard/SceneSectionCard.tsx` | Visual Upgrade (Kartenoptik) |
| `src/components/storyboard/SceneSubStack.tsx` | Visual Upgrade (Gruppencontainer) |
| `src/components/storyboard/TransitionCard.tsx` | Visual Upgrade |
| `src/components/storyboard/StoryboardHeaderCard.tsx` | StoryboardAssistantBar Integration |
| `src/components/storyboard/StoryIdeaGenerateCard.tsx` | NEU |
| `src/components/storyboard/SceneStackSlider.tsx` | NEU |
| `src/components/storyboard/InsertSceneButtonRow.tsx` | NEU |
| `src/components/storyboard/StoryboardAssistantBar.tsx` | NEU |
| `src/components/storyboard/AiSuggestionPreview.tsx` | NEU |
| `src/components/storyboard/FieldAssistantButton.tsx` | NEU |
| `supabase/functions/generate-storyboard/index.ts` | NEU: Edge Function fuer KI-Generierung |

---

## 9) Was NICHT geaendert wird

- Der Posen-Generator bleibt vollstaendig separat
- Keine Vermischung von Posen-Flow und Storyboard-Flow
- Keine Rueckkehr zu den 4 alten Storyboard-Tabs
- Keine klassische Tab-Navigation im Storyboard-Editor
- Der bestehende Posen-Generator Code in Index.tsx wird nicht veraendert

