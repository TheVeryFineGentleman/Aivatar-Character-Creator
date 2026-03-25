

## Zwei neue Features für den Character Creator

### Feature 1: 6 Portrait-Ansichten

Wenn der Nutzer auf ein generiertes Charakterbild klickt, erscheint ein neuer Button "6 Ansichten generieren". Nach Klick werden 6 Bilder mit dem gleichen Charakter aus verschiedenen Winkeln generiert, jeweils mit weißem Hintergrund.

**Ansichten:** Front, Rücken, Rechts, Links, Schräg oben von vorne, Schräg oben von hinten

**UI-Flow:**
1. Hover über ein generiertes Bild zeigt neuen Button "📐 6 Ansichten"
2. Klick öffnet ein Popup/Sheet mit Format-Auswahl (1:1, 3:4, 9:16, 16:9)
3. Nach "Generieren" werden die 6 Bilder sequentiell erstellt und angezeigt
4. Ergebnis: 2x3 Grid mit Label pro Bild (Front, Rücken, etc.)
5. Einzeln oder alle zusammen downloadbar

**Technisch:**
- Neues Edge Function `character-views/index.ts` — nimmt das Referenzbild + Winkel-Prompt, generiert via Gemini 3.1 Flash Image Preview mit `edit-image`-Ansatz (Referenzbild wird mitgeschickt)
- Neue Komponente `src/components/character/CharacterViewsDialog.tsx` — Dialog mit Format-Auswahl, Generierungs-Fortschritt, 2x3 Ergebnis-Grid
- Integration in `CharacterCreator.tsx` — neuer Button auf Bild-Hover

### Feature 2: Posen-Grid Generator

Separater Modus im Character Creator: Nutzer wählt ein bestehendes Charakterbild und generiert ein Grid mit verschiedenen Posen.

**UI-Flow:**
1. Neuer Tab/Button "Posen-Grid" unter den generierten Bildern
2. Nutzer wählt ein Referenzbild aus den generierten Charakteren
3. Einstellungen:
   - Grid-Größe: 2x2, 3x3, 4x4, 5x5 (Dropdown)
   - Outfit: Textfeld (z.B. "Business Anzug", "Sportkleidung")
   - Ort: Textfeld (z.B. "Büro", "Park", "Studio")
   - Hintergrund: Dropdown (Weiß, Custom Farbe, Ort-basiert)
4. "Grid generieren" startet sequentielle Generierung
5. Ergebnis als Grid angezeigt, jedes Bild einzeln downloadbar
6. "Alle herunterladen" erstellt ein zusammengesetztes Canvas-Bild

**Technisch:**
- Neues Edge Function `character-poses/index.ts` — generiert einzelne Posen-Bilder mit variierenden Pose-Prompts + Referenzbild
- Neue Komponente `src/components/character/PoseGridGenerator.tsx` — UI für Einstellungen, Grid-Anzeige, Download
- Integration in `CharacterCreator.tsx` — erscheint unterhalb der generierten Bilder, wenn mindestens 1 Bild vorhanden

### Dateien

| Datei | Aktion |
|---|---|
| `supabase/functions/character-views/index.ts` | Neu — Edge Function für 6 Ansichten |
| `supabase/functions/character-poses/index.ts` | Neu — Edge Function für Posen-Grid |
| `src/components/character/CharacterViewsDialog.tsx` | Neu — Dialog für 6 Ansichten |
| `src/components/character/PoseGridGenerator.tsx` | Neu — Posen-Grid UI |
| `src/components/CharacterCreator.tsx` | Erweitern — Integration beider Features |

### Edge Function Logik (beide)

Beide Functions nutzen den gleichen Ansatz: Referenzbild + spezifischer Prompt an Gemini 3.1 Flash Image Preview senden. Der Prompt enthält das Referenzbild als `inlineData` und instruiert die KI, denselben Charakter in einer neuen Pose/Ansicht darzustellen.

```text
Ansichten-Prompts (6x):
- "Front-facing portrait, looking directly at camera..."
- "Back view portrait, showing back of head and shoulders..."
- "Right side profile portrait..."
- "Left side profile portrait..."
- "Three-quarter view from slightly above, front..."
- "Three-quarter view from slightly above, behind..."

Posen-Prompts (NxN):
- Variiert automatisch: stehend, sitzend, gehend, lehnend, etc.
- Outfit/Ort/Hintergrund aus Nutzereingabe
```

