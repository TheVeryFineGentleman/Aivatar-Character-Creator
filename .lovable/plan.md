
# Fix: Storyboard-Bilder werden nicht neu generiert

## Problem

Bei der Karten-Regenerierung (`regenerateStoryPoint`) wird nach dem Text-Schritt die Bildgenerierung (`regenerateSingleStoryScene`) aufgerufen. Allerdings hat `regenerateSingleStoryScene` eine Schutzabfrage:

```text
if (!apiKey || regeneratingPointIndex !== null) return;
```

Das Problem: `regenerateStoryPoint` setzt zwar `setRegeneratingPointIndex(null)` vor dem Aufruf, aber React-State-Updates sind **asynchron**. Die Funktion liest den alten Wert aus der Closure (`regeneratingPointIndex` ist noch `index`, nicht `null`), und `regenerateSingleStoryScene` bricht sofort ab, ohne ein Bild zu generieren. Die Karte dreht sich zurueck und zeigt das alte Bild.

## Loesung

Die Funktion `regenerateSingleStoryScene` erhaelt einen optionalen Parameter `skipGuard`, der die Schutzabfrage umgeht, wenn sie programmatisch aus `regenerateStoryPoint` aufgerufen wird.

## Betroffene Datei

| Datei | Aenderung |
|-------|-----------|
| `src/pages/Index.tsx` | `skipGuard`-Parameter hinzufuegen und Aufruf anpassen |

## Technische Details

### 1. `regenerateSingleStoryScene` - Guard ueberspringbar machen

Die Funktionssignatur wird um `skipGuard?: boolean` erweitert:

```typescript
const regenerateSingleStoryScene = async (
  sceneIndex: number, 
  updatedPoint?: typeof storyPoints[0],
  skipGuard?: boolean
) => {
  if (!skipGuard && (!apiKey || regeneratingPointIndex !== null)) return;
  // ... Rest bleibt gleich
};
```

### 2. `regenerateStoryPoint` - Aufruf mit `skipGuard: true`

In Schritt 3 wird der Aufruf angepasst, damit die Schutzabfrage uebersprungen wird:

```typescript
// Step 3: Image regenerieren
setRegeneratingPointIndex(null);
await new Promise(resolve => setTimeout(resolve, 300));
await regenerateSingleStoryScene(index, updatedPoint, true); // skipGuard = true
```

### 3. `apiKey`-Check beibehalten

Der `apiKey`-Check wird separat am Anfang der Funktion geprueft, damit er auch bei `skipGuard` greift:

```typescript
if (!apiKey) return;
if (!skipGuard && regeneratingPointIndex !== null) return;
```

## Erwartetes Ergebnis

- Beim Klick auf "Karte regenerieren" werden **Text und Bild** vollstaendig neu generiert
- Die Schutzabfrage verhindert weiterhin Doppelklicks bei direkten Nutzer-Interaktionen
- Der programmatische Aufruf aus `regenerateStoryPoint` wird nicht mehr blockiert
