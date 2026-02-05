
# Plan: Format-Anzeige und Veo3-Format-Dropdown hinzufügen

## Zusammenfassung

Es werden zwei Funktionen hinzugefügt:
1. **Format-Badge auf Storyboard-Karten**: Zeigt das aktuelle Bildformat (z.B. "16:9") auf jeder Karten-Vorschau an
2. **Format-Dropdown neben "Bilder generieren"**: Ermoeglicht die Auswahl zwischen den von Veo3 unterstuetzten Formaten

## Aenderungen im Detail

### 1. Neuer State fuer Storyboard-Format

Ein neuer State wird eingefuehrt, um das gewaehlte Format fuer die Storyboard-Bildgenerierung zu speichern:

```typescript
const [storyboardFormat, setStoryboardFormat] = useState<string>("16:9");
```

### 2. Format-Optionen fuer Veo3

Basierend auf den aktuellen Veo3-Spezifikationen werden folgende Formate unterstuetzt:
- **16:9** (Widescreen/Querformat) - Standard
- **9:16** (Vertikal/Mobile)

```typescript
const VEO3_FORMAT_OPTIONS = [
  { id: "16:9", label: "16:9 (Widescreen)" },
  { id: "9:16", label: "9:16 (Vertikal)" },
];
```

### 3. Format-Badge auf Storyboard-Karten

Ein kleines Badge wird auf jeder Karte angezeigt, das das aktuelle Format zeigt:

**Position**: Unten links auf dem Bild (aehnlich wie der Shot-Type unten rechts)

```text
+---------------------------+
|  Szene 1           [v] [x]|
+---------------------------+
|                           |
|   [Generiertes Bild]      |
|                           |
| [16:9]        [Close-Up]  |  <- Format links, Shot-Type rechts
+---------------------------+
|  Zusammenfassung...       |
+---------------------------+
```

### 4. Format-Dropdown neben "Bilder generieren" Button

Das Layout der Buttons wird angepasst:

**Vorher:**
```text
[ Bilder generieren          ] [ Alles loeschen ]
```

**Nachher:**
```text
[ Bilder generieren ] [16:9 v] [ Alles loeschen ]
```

Das Dropdown wird als kompaktes Select-Element zwischen den beiden Buttons platziert.

---

## Betroffene Dateien

| Datei | Aenderungen |
|-------|-------------|
| `src/pages/Index.tsx` | State, Format-Optionen, Button-Layout, API-Aufrufe anpassen |

---

## Technische Details

### State-Definition (ca. Zeile 308)
```typescript
const [storyboardFormat, setStoryboardFormat] = useState<string>("16:9");
```

### Format-Optionen (ca. Zeile 147)
```typescript
const VEO3_FORMAT_OPTIONS = [
  { id: "16:9", label: "16:9 (Widescreen)" },
  { id: "9:16", label: "9:16 (Vertikal)" },
];
```

### Format-Badge auf Karte (ca. Zeile 5318)
Neben dem bestehenden Shot-Type-Label wird ein Format-Badge hinzugefuegt:

```tsx
{/* Format label */}
{point.generatedImage && (
  <div className="absolute bottom-1.5 left-1.5 bg-black/80 text-white text-[10px] font-medium px-1.5 py-0.5 rounded pointer-events-none z-10">
    {storyboardFormat}
  </div>
)}
```

### Button-Layout anpassen (ca. Zeile 5063-5080)
```tsx
<div className="flex gap-2">
  <Button
    onClick={generateStoryImagesAndPrompts}
    disabled={isGeneratingStoryImages || isGeneratingStoryboard}
    className="flex-1"
  >
    {/* ... Button content ... */}
  </Button>
  
  {/* Format Dropdown */}
  <Select value={storyboardFormat} onValueChange={setStoryboardFormat}>
    <SelectTrigger className="w-[130px]">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {VEO3_FORMAT_OPTIONS.map(opt => (
        <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
      ))}
    </SelectContent>
  </Select>
  
  <AlertDialog>
    {/* Alles loeschen Button */}
  </AlertDialog>
</div>
```

### API-Aufrufe anpassen

Die Bildgenerierungs-Funktionen muessen das gewaehlte Format verwenden statt dem festen "16:9":

1. **generateStoryImageForScene** (ca. Zeile 1225): `aspectRatio: storyboardFormat`
2. **regenerateSingleStoryScene** (ca. Zeile 1847): `aspectRatio: storyboardFormat`
3. **regenerateImageOnly** (ca. Zeile 2045): `aspectRatio: storyboardFormat`

---

## Erwartetes Ergebnis

1. Nutzer sehen auf jeder Storyboard-Karte das aktuelle Format als Badge
2. Nutzer koennen vor der Bildgenerierung zwischen 16:9 und 9:16 waehlen
3. Alle generierten Bilder verwenden das gewaehlte Format
4. Der Veo3-Export funktioniert mit beiden Formaten
