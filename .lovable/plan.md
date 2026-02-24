

# Design-Verbesserungen fur den Storyboard Generator

Basierend auf der Analyse des aktuellen Designs gibt es mehrere Bereiche, die das Nutzererlebnis deutlich verbessern konnten. Hier sind die konkreten Vorschlage, gruppiert nach Prioritat:

---

## 1. Storyboard-Karten modernisieren

**Aktuell:** Die Szenen-Karten sind horizontal scrollbar in einer Reihe mit fester Hohe (295px), kleinen Bildern (160px) und dichtem Text.

**Verbesserung:**
- Grossere Bildvorschau mit mehr vertikalem Platz (Bild nimmt 60-70% der Kartenhohe ein)
- Szenen-Titel prominent uber dem Bild anzeigen (z.B. "Szene 1: Das Cafe")
- Status-Badge oben links auf der Karte (Entwurf / Bild OK / Video OK) mit Farbcodierung
- Subtiler Fortschrittsbalken am unteren Kartenrand, der den Gesamtstatus der Szene anzeigt
- Hover-Effekt: Karte hebt sich leicht an (translate-y + shadow) statt nur Border-Farbe

## 2. Grid-Layout statt horizontalem Scroll

**Aktuell:** Alle Karten in einer horizontal scrollbaren Reihe -- bei vielen Szenen verliert man den Uberblick.

**Verbesserung:**
- Responsives Grid-Layout (2 Spalten auf Desktop, 1 auf Mobile) als Alternative zum Scroll
- Toggle-Button oben rechts: "Reihe" (horizontal scroll) vs "Raster" (Grid)
- Im Raster-Modus sind Karten etwas grosser und zeigen mehr Inhalt
- Drag-and-Drop zum Umsortieren der Szenen im Raster-Modus

## 3. Story-Eingabebereich aufwerten

**Aktuell:** Einfache Textarea mit Vorschlags-Overlay und KI-Assistent daneben -- funktional, aber visuell schlicht.

**Verbesserung:**
- Story-Vorschlage als anklickbare Chip-Buttons unterhalb der Textarea statt als Overlay im Textfeld
- Visuelles Feedback beim Auswahlen eines Vorschlags (Chip wird farbig, Text wird eingesetzt)
- Klarere visuelle Trennung zwischen "Story-Idee" und "KI-Assistent" durch dezenten vertikalen Separator mit Label
- Fortschrittsanzeige: "Story -> Referenzbild -> Szenen generieren" als Stepper-Leiste oben

## 4. Szenen-Ubergangs-Vorschau

**Aktuell:** Einzelne Karten ohne visuellen Zusammenhang zwischen den Szenen.

**Verbesserung:**
- Zwischen den Karten dezente Verbindungspfeile oder eine durchgehende Timeline-Linie
- Mini-Transition-Indikator zwischen Karten (z.B. kleines Pfeil-Icon oder "->")
- Optional: "Filmstreifen"-Ansicht, bei der die Bilder als fortlaufender Strip angezeigt werden

## 5. Verbesserter Empty State

**Aktuell:** Einfacher Platzhalter mit Sparkles-Icon und "Generierte Szenen erscheinen hier..."

**Verbesserung:**
- Illustrativer Platzhalter mit angedeuteten leeren Filmkarten (3 gestrichelte Rechtecke)
- Kurze Anleitung in 3 Schritten: "1. Story-Idee eingeben -> 2. Referenzbild hochladen -> 3. Generieren"
- Animierter Hintergrund-Effekt (subtiles Shimmer), um den Bereich einladend zu machen

## 6. Szenen-Navigation verbessern

**Aktuell:** Pfeile am Kartenrand fur Version-Wechsel, Maximize-Button zum Offnen des Detail-Popups.

**Verbesserung:**
- Thumbnail-Leiste am oberen Rand des Szenen-Bereichs (Mini-Previews aller Szenen)
- Aktive Szene wird hervorgehoben, Klick scrollt zur Karte
- Tastatur-Navigation: Pfeiltasten zum Wechseln zwischen Szenen
- Szenen-Zahler prominent anzeigen: "Szene 2 von 6"

---

## Technische Umsetzung

### Betroffene Dateien:
1. **`src/pages/Index.tsx`** -- Storyboard-Karten-Layout, Grid/Scroll-Toggle, Thumbnail-Leiste, Empty State, Timeline-Verbinder
2. **`src/index.css`** -- Neue Animationen (Karten-Hover-Lift, Shimmer fur Empty State, Timeline-Styles)
3. **`src/components/StoryDetailPopup.tsx`** -- Keine grossen Anderungen noetig, profitiert indirekt

### Reihenfolge:
1. Grid-Layout Toggle + responsives Raster implementieren
2. Karten-Design modernisieren (grossere Bilder, Status-Badges, Hover-Lift)
3. Timeline-Verbinder zwischen Karten
4. Empty State mit illustrativem Platzhalter
5. Story-Eingabe: Vorschlage als Chips, Stepper-Leiste
6. Thumbnail-Navigationsleiste

### Umfang:
- Mittleres Feature -- ca. 2-3 Iterationen sinnvoll
- Vorschlag: Mit Punkt 1+2 (Grid + Karten-Design) starten, da diese den groessten visuellen Unterschied machen

