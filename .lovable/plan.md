

# Plan: Neues Layout für Story-Detail-Popup nach Referenzdesign

## Zieldesign (aus Referenzbildern)

Das neue Layout hat eine klare, nummerierte Struktur mit zwei Hauptvarianten:

### Desktop-Ansicht (2 Spalten)
```text
┌────────────────────────────────────────────────────────────────────────────────┐
│  ⬤ Inhalt    + Bild    📹 Video                                    [X]        │
├──────────────────────────────────────┬─────────────────────────────────────────┤
│  LINKE SPALTE (Bearbeitung)          │  RECHTE SPALTE (Ergebnis)              │
│                                      │                                         │
│  ● 1. Was passiert in dieser Szene?  │  ⬤ Ergebnis dieser Szene               │
│  ┌───────────────────────────────┐   │  ┌─────────────────────────────────┐    │
│  │ Zusammenfassung:              │   │  │                                 │    │
│  │ "Hektische Cafébesucher..."   │   │  │        [GENERIERTES BILD]       │    │
│  └───────────────────────────────┘   │  │                                 │    │
│  📖 Detaillierte Szenen-Beschreibung │  └─────────────────────────────────┘    │
│  ┌───────────────────────────────┐   │  [Unruhig] [Close-Up] [Von oben] [...]  │
│  │ "Im Hintergrund und an..."    │   │                                         │
│  └───────────────────────────────┘   │  ✨ Aktualisiert nach letzter Änderung  │
│                                      │                                         │
│  ● 2. Handlung & Beteiligte          │  [↻ Vorschau neu] [👍 Als final]        │
│  Schlüsselaktion [▼]    Bereich [▼]  │  [← Änderungen verwerfen]               │
│                                      │                                         │
│  ● 3. Emotion & Wirkung              │  ┌─────────────────────────────────┐    │
│  Emotion [▼]                         │  │ 📺 Szenen-Übersicht              │    │
│                                      │  │ "Mache es dramatischer..."       │    │
│  ● 4. Kamera & Bildsprache           │  │ [Text][Kamera][Bild neu][Beides] │    │
│  [Ruhig] [Dynamisch] [Intim] [...]   │  └─────────────────────────────────┘    │
│  Kamerawinkel [▼]   Shot-Typ [▼]     │                                         │
│                                      │                                         │
├──────────────────────────────────────┴─────────────────────────────────────────┤
│  📺 Szenen-Übersicht (Thumbnail-Leiste aller Szenen)                           │
│  [Szene 1] [Szene 2] [Szene 3] ...                                             │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Hauptänderungen

### 1. Nummerierte Sektionen mit Icons
Jeder Bereich hat eine klare Nummer und ein Icon:
- **1. Was passiert in dieser Szene?** - Zusammenfassung + Detailbeschreibung
- **2. Handlung & Beteiligte** - Schlüsselaktion + Bereich (als Dropdowns)
- **3. Emotion & Wirkung** - Emotion-Auswahl
- **4. Kamera & Bildsprache** - Mood-Tags + Kamera-Dropdowns + Bild-Vorschau
- **5. KI-Anweisungen & Feinjustierung** - Szenen-Übersicht

### 2. Zwei-Spalten-Layout (Desktop)
- **Links**: Alle Bearbeitungsfelder (Text, Metadaten)
- **Rechts**: Bild-Vorschau mit Status und Aktions-Buttons

### 3. Neue Aktions-Buttons beim Bild
- "Vorschau neu generieren"
- "Als final übernehmen" (grün)
- "Änderungen verwerfen"

### 4. Mood-Tags
Auswählbare Stimmungs-Chips: "Ruhig", "Dynamisch", "Intim", "Beobachtend"

### 5. Bild-Tags unterhalb des generierten Bildes
Zeigt die aktuellen Einstellungen: Emotion, Shot-Typ, Kamerawinkel, Bewegung

### 6. Szenen-Übersicht am unteren Rand
Horizontale Thumbnail-Leiste aller Szenen mit Shot-Typ-Labels

### 7. KI-Assistent (4 Modi)
Die Mode-Buttons werden zu:
- "Text" (nur Text optimieren)
- "Kamera" (nur Kamera-Einstellungen)
- "Bild neu" (nur Bild regenerieren)
- "Beides" (alles zusammen)

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `src/pages/Index.tsx` | Komplette Neustrukturierung des Story-Detail-Popups (Zeilen 5530-6073) |

## Technische Umsetzung

### Sektion 1: Was passiert in dieser Szene?
```tsx
<div className="space-y-4">
  <div className="flex items-center gap-2">
    <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs">●</div>
    <h3 className="font-semibold">1. Was passiert in dieser Szene?</h3>
  </div>
  
  <div className="space-y-2">
    <label className="text-sm text-muted-foreground">Zusammenfassung:</label>
    <div className="bg-muted/30 rounded-lg p-3">
      <Textarea value={...} onChange={...} className="..." />
    </div>
  </div>
  
  <div className="space-y-2">
    <label className="text-sm text-muted-foreground flex items-center gap-1.5">
      <BookOpen className="w-4 h-4" />
      Detaillierte Szenen-Beschreibung
    </label>
    <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
      <Textarea value={...} onChange={...} className="..." />
    </div>
  </div>
</div>
```

### Sektion 2: Handlung & Beteiligte (Dropdowns statt Inputs)
```tsx
<div className="space-y-3">
  <div className="flex items-center gap-2">
    <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">●</div>
    <h3 className="font-semibold">2. Handlung & Beteiligte</h3>
  </div>
  
  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <label className="text-sm text-muted-foreground">Schlüsselaktion</label>
      <Select value={...} onValueChange={...}>
        <SelectTrigger>...</SelectTrigger>
        <SelectContent>
          <SelectItem value="tippen">Andere Gäste tippen und wischen umher</SelectItem>
          {/* Dynamische Optionen */}
        </SelectContent>
      </Select>
    </div>
    <div className="space-y-2">
      <label className="text-sm text-muted-foreground">Bereich</label>
      <Select value={...} onValueChange={...}>...</Select>
    </div>
  </div>
</div>
```

### Sektion 3: Emotion & Wirkung
```tsx
<div className="space-y-3">
  <div className="flex items-center gap-2">
    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">💚</div>
    <h3 className="font-semibold">3. Emotion & Wirkung</h3>
  </div>
  
  <div className="space-y-2">
    <label className="text-sm text-muted-foreground">Emotion</label>
    <Select value={...} onValueChange={...}>
      <SelectTrigger className="w-full">...</SelectTrigger>
      <SelectContent>
        <SelectItem value="unruhig-abgelenkt">Unruhig, abgelenkt</SelectItem>
        <SelectItem value="gluecklich">Glücklich</SelectItem>
        {/* weitere Emotionen */}
      </SelectContent>
    </Select>
  </div>
</div>
```

### Sektion 4: Kamera & Bildsprache
```tsx
<div className="space-y-3">
  <div className="flex items-center gap-2 justify-between">
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">◉</div>
      <h3 className="font-semibold">4. Kamera & Bildsprache</h3>
    </div>
    <Button variant="ghost" size="sm" className="gap-1">
      <Download className="w-3 h-3" /> Weiteren
    </Button>
  </div>
  
  {/* Mood Tags */}
  <div className="flex gap-2 flex-wrap">
    {["Ruhig", "Dynamisch", "Intim", "Beobachtend"].map(mood => (
      <Button key={mood} variant={selectedMood === mood ? "default" : "outline"} size="sm">
        {mood}
      </Button>
    ))}
  </div>
  
  {/* Kamera-Dropdowns */}
  <div className="grid grid-cols-2 gap-3">
    <Select><SelectTrigger>Kamerawinkel</SelectTrigger>...</Select>
    <Select><SelectTrigger>Shot-Typ</SelectTrigger>...</Select>
  </div>
  
  {/* Bild-Vorschau mit Tags */}
  <div className="relative">
    <img src={...} className="rounded-lg" />
    <div className="flex gap-2 mt-2">
      <Badge variant="secondary">{emotion}</Badge>
      <Badge variant="outline">{shotType}</Badge>
      <Badge variant="outline">{cameraAngle}</Badge>
    </div>
  </div>
</div>
```

### Rechte Spalte: Ergebnis dieser Szene
```tsx
<div className="space-y-4">
  <div className="flex items-center gap-2">
    <div className="w-6 h-6 rounded-full bg-purple-600/20 flex items-center justify-center">
      <span className="text-purple-400">⬤</span>
    </div>
    <h3 className="font-semibold">Ergebnis dieser Szene</h3>
  </div>
  
  {/* Großes Bild */}
  <div className="relative rounded-lg overflow-hidden">
    <img src={...} className="w-full aspect-video object-cover" />
  </div>
  
  {/* Tags */}
  <div className="flex gap-2 flex-wrap">
    <Badge className="bg-primary">{emotion}</Badge>
    <Badge variant="outline">{shotType}</Badge>
    <Badge variant="outline">{cameraAngle}</Badge>
    <Badge variant="outline">Keine Bewegung</Badge>
  </div>
  
  {/* Status */}
  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
    <Sparkles className="w-4 h-4" />
    Aktualisiert nach letzter Änderung
  </p>
  
  {/* Aktions-Buttons */}
  <div className="flex gap-2">
    <Button variant="outline" className="flex-1 gap-2">
      <RefreshCw className="w-4 h-4" />
      Vorschau neu generieren
    </Button>
    <Button className="flex-1 gap-2 bg-green-600 hover:bg-green-700">
      <ThumbsUp className="w-4 h-4" />
      Als final übernehmen
    </Button>
  </div>
  <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
    <ArrowLeft className="w-4 h-4" />
    Änderungen verwerfen
  </Button>
</div>
```

### KI-Assistent mit 4 Modi
```tsx
<div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
  <Button variant={mode === "text" ? "default" : "ghost"}>
    <MessageSquare className="w-3 h-3" /> Text
  </Button>
  <Button variant={mode === "camera" ? "default" : "ghost"}>
    <Camera className="w-3 h-3" /> Kamera
  </Button>
  <Button variant={mode === "image" ? "default" : "ghost"}>
    <ImageIcon className="w-3 h-3" /> Bild neu
  </Button>
  <Button variant={mode === "both" ? "default" : "ghost"} className="bg-primary">
    <Sparkles className="w-3 h-3" /> Beides
  </Button>
</div>
```

## Neue State-Variablen

```tsx
// Für Mood-Tags
const [selectedMood, setSelectedMood] = useState<string>("");

// Erweiterter sceneAiMode um "camera"
type SceneAiMode = "text" | "camera" | "image" | "both";
```

## Zusammenfassung der Änderungen

1. **Nummerierte Sektionen** mit farbigen Icons (1-5)
2. **Zwei-Spalten-Layout** auf Desktop (links: Bearbeitung, rechts: Ergebnis)
3. **Dropdowns** für Schlüsselaktion, Bereich, Emotion (statt Textfelder)
4. **Mood-Tags** (Ruhig, Dynamisch, Intim, Beobachtend)
5. **Tags unter dem Bild** zeigen aktuelle Einstellungen
6. **Neue Buttons**: "Vorschau neu generieren", "Als final übernehmen", "Änderungen verwerfen"
7. **4 KI-Modi**: Text, Kamera, Bild neu, Beides
8. **Szenen-Übersicht** als horizontale Thumbnail-Leiste am unteren Rand

