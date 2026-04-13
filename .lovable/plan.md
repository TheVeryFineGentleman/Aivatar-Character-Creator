

# Fix: Alle verbleibenden direkten `import.meta.env` Zugriffe durch Backend-Helper ersetzen

## Diagnose

Die Login-Dateien (useAuth, useCredits, LoginDialog) sind bereits korrekt mit Fallback-Werten gefixt. `hasBackendConfig()` gibt mit den Fallbacks immer `true` zurück.

Der Fehler "Supabase-Konfiguration fehlt" existiert nicht mehr im Code. Falls du den Fehler trotzdem siehst, könnte es sein, dass dein Browser einen alten Build cached hat (Hard-Refresh mit Ctrl+Shift+R).

Es gibt aber noch **5 Dateien**, die `import.meta.env.VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` direkt ohne Fallback verwenden. Diese werden bei der Bildgenerierung und Character-Features verwendet und können dort zu `undefined`-URLs führen:

1. **`src/pages/Index.tsx`** — 4 Stellen mit `generate-image` Fetch-Calls
2. **`src/components/character/ChatModeCreator.tsx`** — `character-chat` Fetch
3. **`src/components/character/PoseGridGenerator.tsx`** — Modul-Level-Konstante + `character-poses` Fetch
4. **`src/components/character/CharacterViewsGenerator.tsx`** — Modul-Level-Konstante + `character-views` Fetch
5. **`src/components/character/CharacterViewsDialog.tsx`** — Modul-Level-Konstante + `character-views` Fetch

## Lösung

Alle 5 Dateien auf `getFunctionUrl()` und `getFunctionHeaders()` aus `@/lib/backend` umstellen — identisch zum bereits funktionierenden Pattern in useAuth/useCredits/LoginDialog.

## Änderungen

Für jede Datei:
- Import `{ getFunctionUrl, getFunctionHeaders }` aus `@/lib/backend` hinzufügen
- Mo