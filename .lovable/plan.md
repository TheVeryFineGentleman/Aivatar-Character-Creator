

## Problem: FFmpeg funktioniert nicht

**Ursache:** FFmpeg im Browser benötigt `SharedArrayBuffer`, welches nur funktioniert wenn spezielle HTTP-Security-Headers gesetzt sind:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Diese Headers fehlen aktuell komplett — sowohl in der Vite-Entwicklungsumgebung als auch in der Nginx-Produktionskonfiguration.

---

## Plan

### 1. Vite-Config: COOP/COEP Headers für Entwicklung hinzufügen
**Datei:** `vite.config.ts`

Server-Headers konfigurieren, damit SharedArrayBuffer in der Lovable-Preview und lokal verfügbar ist.

### 2. Nginx-Config: COOP/COEP Headers für Produktion hinzufügen
**Datei:** `nginx.conf`

Die gleichen Headers für das DigitalOcean-Deployment setzen.

### 3. Mögliches Risiko
Diese Headers können dazu führen, dass externe Ressourcen (Bilder, Fonts von anderen Domains) blockiert werden, wenn sie nicht `crossorigin`-kompatibel sind. Falls danach andere Features Probleme haben, müssen wir ggf. `crossorigin="anonymous"` Attribute ergänzen.

---

### Technische Details

```
# Headers die gesetzt werden:
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Diese aktivieren den "cross-origin isolated" Modus des Browsers, der `SharedArrayBuffer` freischaltet — eine Voraussetzung für FFmpeg WASM.

