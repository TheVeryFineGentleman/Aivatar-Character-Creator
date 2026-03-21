
## Plan: Character Creator Layout kompakter machen

### Ziel
Das Layout des Character Creators soll schmaler und kompakter werden, ohne Funktionalität zu verlieren.

### Änderungen

**1. CharacterCreator.tsx - Container einschränken**
- Wrapper mit `max-w-2xl mx-auto` um den gesamten Inhalt, damit alles nicht die volle Breite einnimmt
- Bildergalerie-Grid von `grid-cols-4 sm:grid-cols-6 md:grid-cols-8` auf `grid-cols-3 sm:grid-cols-4 md:grid-cols-6` reduzieren für größere, übersichtlichere Thumbnails

**2. QuickModeCreator.tsx - Kompakteres Formular**
- Stil-Auswahl von `grid-cols-2` auf eine einzelne Zeile (`grid-cols-4`) oder kompaktere Darstellung
- Weniger vertikalen Abstand (`space-y-4` statt `space-y-5`)

**3. ChatModeCreator.tsx - Chat kompakter**
- Chat-Bereich max-height leicht reduzieren (`max-h-[300px]` statt `max-h-[350px]`)
- Kompaktere Abstände

### Dateien
- `src/components/CharacterCreator.tsx` - max-width Container + Grid anpassen
- `src/components/character/QuickModeCreator.tsx` - kompakteres Layout
- `src/components/character/ChatModeCreator.tsx` - kompaktere Abstände
