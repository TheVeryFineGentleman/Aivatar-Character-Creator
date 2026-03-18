

# Plan: Home Screen mit 3 Feature-Karten + Character Creator

## Übersicht

Beim App-Start wird ein neuer Home-Screen angezeigt mit 3 Feature-Karten (Posen Generator, Story Bilder, Character Creator). Erst nach Klick auf eine Karte gelangt man zu den eigentlichen Tools mit der bekannten Tab-Navigation.

## Änderungen

### 1. Neuer State für Navigation

In `src/pages/Index.tsx`:
- Neuen State `activeView` hinzufügen: `"home" | "tools"` (startet mit `"home"`)
- `activeMainTab` erweitern auf `"poses" | "story" | "character"`
- Zurück-Button in der Tool-Ansicht, um zum Home-Screen zu navigieren

### 2. Home Screen (neuer Abschnitt in Index.tsx)

Wenn `activeView === "home"`, wird statt der Tools ein zentrierter Screen gezeigt:
- Begrüßungstext ("Willkommen zurück!" / "Was möchtest du heute erstellen?")
- 3 Karten nebeneinander (responsive: untereinander auf Mobile):
  - **Fotoshooting Generator** (Sparkles-Icon) - setzt `activeMainTab="poses"` und `activeView="tools"`
  - **Story Bilder** (BookOpen-Icon) - nur für FULL-Plan sichtbar/klickbar, sonst Lock-Icon + Upgrade-Popup
  - **Character Creator** (neu, User-Icon) - setzt `activeMainTab="character"` und `activeView="tools"`
- Karten im bestehenden glassmorphism-Stil (bg-card/50, backdrop-blur, border-border/50)

### 3. Tab-Navigation erweitern

Die bestehende TabsList bekommt einen dritten Tab "Character Creator". Sichtbar für alle Pläne (oder plan-gated je nach Wunsch).

### 4. Character Creator Tab Content (Grundgerüst)

Neuer Abschnitt wenn `activeMainTab === "character"`:
- Fragebogen/Prompt-basierter Character-Ersteller
- Felder: Name, Geschlecht, Alter, Stil, Persönlichkeit, visuelle Beschreibung
- "Character generieren"-Button der per KI (Lovable AI) ein Character-Bild erstellt
- Ergebnis-Anzeige mit generiertem Bild

### 5. Technische Details

- Der Home-Screen ersetzt den bisherigen direkten Einstieg in die Tools
- Die gesamte bestehende Tool-UI wird in eine `activeView === "tools"` Bedingung gewrappt
- Character Creator nutzt die bestehende Gemini API Key Infrastruktur (clientseitiger Key)
- Kein neues Backend nötig für Phase 1 - die KI-Generierung läuft wie bei den anderen Features

