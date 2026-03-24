

## Plan: Ideen-Navigation und Text-Speicherung fixen

### Problem
Wenn der User rechts eine Änderung eingibt und generiert, wird die vorherige Idee in `generatedIdeas` gespeichert — aber das Seeding (Zeile 669-672) nutzt `setGeneratedIdeas` async. Wenn `generatedIdeas` beim Start leer ist, wird die Seed-State erst nach dem Render wirksam. Die `isModifyMode`-Logik und `splice` auf Zeile 733-737 arbeiten dann mit dem alten leeren Array via `prev`, was aber funktionieren sollte dank des `prev =>` Callbacks.

**Tatsächliches Problem:** Das Seeding auf Zeile 669-672 setzt `setGeneratedIdeas([storyIdea.trim()])`, aber der `splice` im Modify-Modus auf Zeile 733 nutzt `prev` — das ist zu dem Zeitpunkt noch das alte leere Array `[]`, nicht die geseedete Version. Die zwei `setGeneratedIdeas` Aufrufe batchen, und der zweite überschreibt den ersten.

### Lösung

**Datei: `src/pages/Index.tsx`**

1. **Seeding und Modify-Logik konsolidieren** (Zeilen 668-741):
   - Statt erst async zu seeden und dann separat zu splicen, die Logik in einem einzigen `setGeneratedIdeas`-Callback zusammenführen
   - Im Modify-Mode: Wenn `prev` leer ist, den aktuellen `storyIdea` als erstes Element + den neuen Text einfügen → `[storyIdea, generatedText]`
   - Wenn `prev` nicht leer: wie bisher `splice` nach `currentIdeaIndex`
   - `currentIdeaIndex` korrekt auf das neue Element setzen

2. **Das separate Seeding (Zeilen 669-672) entfernen** — wird nicht mehr benötigt

3. **Navigation sicherstellen**: `navigateIdea` Funktion ist korrekt, keine Änderung nötig

### Ergebnis
- Erste Generierung: `generatedIdeas = ["generierter text"]`, Index = 0, Anzeige: 1/1
- Modify bei 1/1: `generatedIdeas = ["alter text", "neuer text"]`, Index = 1, Anzeige: 2/2
- Navigation zurück: Index = 0, zeigt alten Text → 1/2
- Weiterer Modify: Insert nach aktuellem Index, korrekte Navigation

