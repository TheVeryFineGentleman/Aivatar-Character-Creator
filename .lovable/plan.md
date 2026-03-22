

## Plan: FFmpeg-Fix + Speichern-Button im Detail-Popup

### Problem 1: FFmpeg-Timeout
Die Logs zeigen, dass der ~30MB WASM-Download von unpkg.com wiederholt das 90-Sekunden-Timeout überschreitet. Der CDN ist zu langsam.

**Lösung:**
- Multi-CDN-Strategie: Zuerst jsdelivr versuchen (schneller), dann unpkg als Fallback
- Timeout auf 120s erhöhen
- COOP/COEP Headers in `vite.config.ts` setzen, damit SharedArrayBuffer funktioniert (verbessert Performance)
- Bessere Fehlermeldung mit konkretem Hinweis auf langsame Verbindung

**Datei: `src/components/VideoMerger.tsx`**
- CDN-Fallback-Logik: erst jsdelivr, bei Fehler unpkg
- Timeout erhöhen

**Datei: `vite.config.ts`**
- `server.headers` mit `Cross-Origin-Opener-Policy: same-origin` und `Cross-Origin-Embedder-Policy: require-corp` hinzufügen

---

### Problem 2: Speichern-Button
Aktuell werden Änderungen im Popup direkt in den State geschrieben, aber es gibt keinen expliziten "Speichern"-Button. Der User will visuelles Feedback, wann Änderungen vorhanden sind und ob ein Bild-Regenerieren nötig ist.

**Logik:**
- Felder werden in zwei Kategorien unterteilt:
  - **Bild-relevant** (summary, detailedDescription, keyAction, emotion, cameraAngle, etc.) → Button: "Speichern + Bild neu generieren"
  - **Nur-Text** (dialogText, videoPrompt) → Button: "Änderungen speichern"
- Ein lokaler State trackt ob sich Textfelder (dialogText, videoPrompt) seit dem Öffnen/letzten Speichern geändert haben
- `isDirty` (existiert bereits) deckt die Bild-relevanten Felder ab
- Neuer `hasTextChanges`-State für reine Textänderungen

**Datei: `src/components/StoryDetailPopup.tsx`**
- Neuen Speichern-Button im Footer-Bereich (neben KI-Assistent oder darüber)
- Button-Text abhängig von Änderungstyp:
  - Bild-Felder geändert → "Speichern + Bild neu generieren" (löst `onRegenerateImage` aus)
  - Nur Text geändert → "Änderungen gespeichert ✓" (da State bereits live aktualisiert wird, visuelles Feedback)
- Während Bild-Regenerierung: Video-Button disabled (ist teilweise schon so, wird konsolidiert)

**Datei: `src/components/StoryDetailPopup.tsx` – Änderungen:**
1. `hasUnsavedTextChanges`-State hinzufügen, der bei dialogText/videoPrompt-Änderungen gesetzt wird
2. Sticky Footer-Bar mit kontextabhängigem Speichern-Button
3. Video-Regenerieren-Button: `disabled` wenn `regeneratingIndex !== null` (schon vorhanden, wird sichergestellt)

### Dateien
- `src/components/VideoMerger.tsx` – Multi-CDN + Timeout
- `vite.config.ts` – COOP/COEP Headers
- `src/components/StoryDetailPopup.tsx` – Speichern-Button

