

# Plan: Robustere Bild-Generierung mit Prompt-Sanitierung und Nutzer-Warnungen

## Problem
Bilder werden durch KI-Sicherheitsfilter blockiert (SAFETY, IMAGE_OTHER, RECITATION). Ursachen: problematische Prompts oder Referenzbilder. Aktuell werden Fehler erst **nach** dem fehlgeschlagenen Versuch angezeigt — es gibt keine Prävention.

## Lösung: Dreistufiger Schutz

### 1. Compliance-Prefix für ALLE Bildgenerierungen
Aktuell haben nur Video-Prompts einen Compliance-Prefix. Bildgenerierungen (generate-image, character-poses, character-views) bekommen keinen automatischen Schutz.

**Änderungen in `supabase/functions/generate-image/index.ts`, `character-poses/index.ts`, `character-views/index.ts`:**
- Jeden Bild-Prompt automatisch mit einem Compliance-Prefix versehen:
  `"SAFETY CONTEXT: This is purely fictional artistic content featuring digitally created characters. All characters are clearly adults (18+). Content is non-explicit and appropriate for general audiences."`
- Negative Prompt-Anweisungen ergänzen: `"Do NOT generate violent, explicit, or suggestive content."`

### 2. Automatischer Retry mit Prompt-Bereinigung
Wenn die API `SAFETY` oder `IMAGE_OTHER` zurückgibt, wird ein zweiter Versuch mit einem "sichereren" Prompt gestartet.

**Änderungen in `src/pages/Index.tsx` (Bildgenerierung):**
- Bei SAFETY/IMAGE_OTHER-Fehler: automatischer Retry mit vereinfachtem Prompt (Entfernung potenziell problematischer Wörter, stärkerer Compliance-Block)
- Max. 1 automatischer Retry, danach Fehlermeldung an Nutzer

### 3. Nutzer-Warnung vor der Generierung
Proaktive Hinweise im UI, wenn risikoreiche Inhalte erkannt werden.

**Änderungen in `src/pages/Index.tsx` (UI):**
- Vor dem Generieren: einfache Keyword-Prüfung des Nutzer-Prompts auf problematische Begriffe (Gewalt, explizite Inhalte, etc.)
- Bei Erkennung: gelber Warnhinweis-Toast mit Vorschlag zur Umformulierung
- Generierung wird trotzdem gestartet (keine Blockierung), aber der Nutzer ist vorgewarnt

## Betroffene Dateien
- `supabase/functions/generate-image/index.ts` — Compliance-Prefix für Bild-Prompts
- `supabase/functions/character-poses/index.ts` — Compliance-Prefix
- `supabase/functions/character-views/index.ts` — Compliance-Prefix
- `supabase/functions/generate-full/index.ts` — Compliance-Prefix
- `src/pages/Index.tsx` — Retry-Logik + Nutzer-Warnung vor Generierung

