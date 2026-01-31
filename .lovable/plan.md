
# Plan: Storyboard Generator an Pose Generator angleichen

## Problemzusammenfassung
Der Storyboard Generator produziert `IMAGE_OTHER` Fehler, weil:
- Deutsche Story-Texte direkt in den Prompt eingebaut werden
- Prompts zu lang und komplex sind
- Die Prompt-Struktur vom erfolgreichen Pose Generator abweicht

## Lösungsstrategie

### 1. Prompt-Sprache vereinheitlichen (Englisch)
Die Scene-Keywords werden vor dem API-Call ins Englische übersetzt. Der Pose Generator funktioniert zuverlässig, weil alle Prompts ausschließlich auf Englisch sind.

**Vorher:**
```
"Professional photoshoot... Der Ballsaal der Villa ist erfüllt von gedämpftem..."
```

**Nachher:**
```
"Professional photoshoot... elegant ballroom with dim lighting..."
```

### 2. Prompt-Struktur exakt vom Pose Generator kopieren
Der Storyboard-Prompt wird auf die exakt gleiche Struktur wie der Pose Generator umgestellt:

```javascript
const basePrompt = `Professional photoshoot with EXACTLY ONE person only, 
${viewAngle}, ${bgText}, ${shotText}. 
Match the exact style, realism level, art style, lighting quality, 
and visual aesthetic from the reference images. 
Ultra high resolution.`;
```

### 3. Scene-Keyword-Extraktion optimieren
- Reduzierung auf maximal 5 englische Schlüsselwörter
- Automatische Übersetzung deutscher Szenenbeschreibungen
- Entfernung aller potenziell problematischen Begriffe

### 4. Retry-Logik anpassen
Statt 60 aggressive Retries:
- Maximal 3 Versuche pro Szene
- Bei IMAGE_OTHER: Szene überspringen und mit Original-Referenzbildern fortfahren
- Das entspricht dem Pose Generator Verhalten

## Technische Änderungen

### Datei: `src/pages/Index.tsx`

#### A) Neue Übersetzungsfunktion hinzufügen (ca. Zeile 974)
```javascript
const translateToEnglish = async (germanText: string): Promise<string> => {
  // Einfache Keywords ohne API-Call
  const germanToEnglish: Record<string, string> = {
    "ballsaal": "ballroom",
    "villa": "villa",
    "gedämpft": "dim lighting",
    "wald": "forest",
    "strand": "beach",
    // ... weitere Mappings
  };
  
  let result = germanText.toLowerCase();
  for (const [de, en] of Object.entries(germanToEnglish)) {
    result = result.replace(new RegExp(de, 'gi'), en);
  }
  return result;
};
```

#### B) extractSceneKeywords überarbeiten (Zeile 974-983)
```javascript
const extractSceneKeywords = (text: string): string => {
  // 1. Problematische Wörter entfernen
  // 2. Auf 5 Wörter reduzieren
  // 3. Ins Englische übersetzen
  // 4. Fallback: "indoor scene"
};
```

#### C) Prompt-Taktiken vereinfachen (Zeile 991-1016)
Alle 6 Taktiken auf das Pose Generator Format umstellen:
- Taktik 1: Vollständiger Pose Generator Prompt
- Taktik 2-4: Progressiv kürzere Varianten
- Taktik 5-6: Minimale Fallbacks ohne Scene-Keywords

#### D) Retry-Logik entschärfen (Zeile 1243-1312)
```javascript
const MAX_CYCLES = 3;  // Statt 10
const RETRIES_PER_CYCLE = 3;  // Statt 6
// = 9 Versuche statt 60
```

## Erwartetes Ergebnis
- IMAGE_OTHER Fehler werden drastisch reduziert
- Generierung ist schneller (weniger Retries)
- Charakter-Konsistenz bleibt erhalten durch Referenzbilder
- Fallback auf Original-Referenzbilder bei Szenen-Fehlschlag

## Risiken
- Szenen-Beschreibungen könnten weniger präzise sein (Tradeoff für Stabilität)
- Kürzere Prompts = weniger Kontrolle über Szenen-Details

## Testplan
Nach der Implementierung:
1. Storyboard mit 3-4 Szenen generieren
2. Prüfen ob alle Szenen ohne IMAGE_OTHER durchlaufen
3. Charakter-Konsistenz zwischen Szenen verifizieren
