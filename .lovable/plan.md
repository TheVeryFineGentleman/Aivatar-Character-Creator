

# Fix: "Supabase-Konfiguration fehlt" in useCredits.tsx

## Problem
`src/hooks/useCredits.tsx` liest `VITE_SUPABASE_URL` und `VITE_SUPABASE_PUBLISHABLE_KEY` auf Modulebene (Zeile 5-6) und baut die Headers statisch (Zeile 8-12). Genau der gleiche Bug, der in `useAuth.tsx` bereits gefixt wurde.

## Lösung

**`src/hooks/useCredits.tsx`**:
- Zeile 5-6 entfernen (die Konstanten `SUPABASE_URL` und `SUPABASE_PUBLISHABLE_KEY`)
- Zeile 8-12 entfernen (statisches `FUNCTION_HEADERS` Objekt)
- Neue Hilfsfunktion `getFunctionHeaders()` hinzufügen (wie in useAuth.tsx)
- In `fetchBalance` und `consumeCredit`: URL und Key dynamisch aus `import.meta.env` lesen

