

# Fix: "Supabase-Konfiguration fehlt" Fehler beim Login

## Problem
In `src/hooks/useAuth.tsx` werden `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` auf Modulebene gelesen (Zeile 6-7). Wenn diese Umgebungsvariablen beim Laden des Moduls noch nicht verfügbar sind oder leer sind, schlägt die `validateLicense`-Funktion mit "Supabase-Konfiguration fehlt" fehl — obwohl die Werte in einem Lovable Cloud Projekt immer gesetzt sein sollten.

## Lösung
Die Umgebungsvariablen nicht auf Modulebene cachen, sondern direkt in der `validateLicense`-Funktion lesen. So wird bei jedem Login-Versuch der aktuelle Wert aus `import.meta.env` geholt.

## Änderungen

**`src/hooks/useAuth.tsx`**:
- Zeile 6-7: Die Konstanten `SUPABASE_URL` und `SUPABASE_PUBLISHABLE_KEY` entfernen
- In `validateLicense` und `FUNCTION_HEADERS`: Die Werte direkt aus `import.meta.env.VITE_SUPABASE_URL` und `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY` lesen
- `FUNCTION_HEADERS` von einer Konstante zu einer Funktion umwandeln, die die Header dynamisch erstellt

