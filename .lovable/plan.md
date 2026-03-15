

## Analyse: Seite refresht gelegentlich

### Befund

Nach Durchsicht aller `useEffect`-Hooks, Event-Listener und State-Updates gibt es **keine offensichtliche Endlos-Schleife** im Code. Es gibt auch keinen Code, der `window.location.reload()` aufruft (außer dem manuellen Button in `ErrorBoundary`).

Die wahrscheinlichsten Ursachen für die gelegentlichen Refreshes:

1. **Lovable Preview HMR (Hot Module Replacement):** Bei einem 7.500-Zeilen `Index.tsx` kann Vite's HMR oft nicht hot-swappen und fällt auf einen Full Page Reload zurück. Das passiert besonders nach Code-Änderungen in der Lovable-Umgebung.

2. **Unbehandelte Fehler → ErrorBoundary:** Wenn ein unbehandelter Fehler auftritt (z.B. Memory-Probleme bei vielen Blob-URLs, fehlgeschlagene fetch-Aufrufe), könnte der ErrorBoundary die App kurz in den Fehlerzustand versetzen und nach einem `handleReset` die Komponente neu mounten — was wie ein Refresh wirkt.

3. **Memory Pressure:** Mit bis zu 80 Blob-URLs plus Base64-Bildern in localStorage kann der Browser bei wenig RAM die Seite verwerfen und neu laden.

### Geplanter Fix

**1. Debug-Logging für Refresh-Ursachen einbauen**
- In `main.tsx`: Globale `error` und `unhandledrejection` Event-Listener hinzufügen, die Fehler loggen bevor die Seite crasht
- In `ErrorBoundary`: Zusätzliches Logging wenn `getDerivedStateFromError` oder `componentDidCatch` aufgerufen wird (mit Timestamp)

**2. Index.tsx stabilisieren**
- Die `generateStorySuggestions`-Funktion in ein `useCallback` wrappen, damit der useEffect auf Zeile 3008 stabiler ist
- Sicherstellen, dass alle async-Funktionen in useEffects mit Abort-Pattern oder Cleanup geschützt sind

**3. ErrorBoundary: Auto-Recovery statt stiller Refresh**
- Statt dass der User den Fehler evtl. gar nicht sieht (wenn handleReset sofort greift): einen sichtbaren Toast zeigen, wenn ein Error gefangen wird — so kannst du sehen, ob das die Ursache ist

**Betroffene Dateien:**
- `src/main.tsx` — globale Error-Handler
- `src/pages/Index.tsx` — useCallback für generateStorySuggestions
- `src/components/ErrorBoundary.tsx` — Logging verbessern

