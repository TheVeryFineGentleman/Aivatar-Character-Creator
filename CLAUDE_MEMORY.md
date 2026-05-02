# Aivatar Character Creator – Stand & Features (24.04.2026)

## Projektstruktur
- **Frontend**: React + TypeScript + Vite, Tailwind, shadcn/ui
- **Backend**: Supabase Edge Functions (Deno/TypeScript)
- **KI**: Google Gemini API (direkt vom Client ODER über Supabase-Funktionen)
- **Deployment**: GitHub Repo → automatisch auf Server (DigitalOcean App Platform)
- **Nutzer-API-Key**: Jeder Nutzer gibt seinen eigenen Gemini API Key ein

---

## Haupt-Bereiche der App

### 1. Avatar Shooting Studio (Drehstudio)
- Nutzer lädt Referenzbild(er) hoch
- Wählt Format, Shot-Typ, Hintergrund (weiß / Greenscreen / Szenerie)
- Optionaler Custom Prompt
- Ruft **direkt** `gemini-2.5-flash-image-preview` auf (NICHT über Supabase)
- Ergebnis: generierte Avatar-Bilder in Slots (ImageSlot/ImageGallery)
- **NEU (heute)**: Fehlermeldungen im Slot zeigen jetzt konkret was falsch ist (429/401/403 mit Billing-Hinweis auf aistudio.google.com)

### 2. Character Creator
- Zwei Modi: **Schnell-Modus** und **KI-Chat Modus** (Chat nur ab Pro)
- Schnell-Modus (`QuickModeCreator.tsx`):
  - Felder: Geschlecht, Alter, **Nationalität (NEU)**, Stil, Format
  - **NEU (heute)**: Nationalitäts-Dropdown mit 20 Optionen + Zufällig (🇩🇪🇮🇹🇫🇷🇬🇧🇯🇵 etc.)
  - Nationalität beeinflusst Gesichtszüge, Hautton, Haarfarbe im Prompt
  - Generiert direkt über Gemini API (`gemini-3.1-flash-image-preview`)
- KI-Chat Modus (`ChatModeCreator.tsx` + `supabase/functions/character-chat/`):
  - KI stellt 13 Fragen einzeln (eine pro Nachricht)
  - **NEU (heute)**: Frage 2 ist jetzt Nationalität/Herkunft
  - Reihenfolge: Geschlecht → Nationalität → Alter → Haarlänge → Haarfarbe → Haarstruktur → Hautfarbe → Augenfarbe → Körperbau → Gesichtsausdruck → Besondere Merkmale → Stil → Farbpalette
  - Am Ende: Übersicht + Anzahl-Auswahl → JSON mit Prompts → Bildgenerierung
  - Nutzt `gemini-2.5-flash-lite` für Chat, `gemini-3.1-flash-image-preview` für Bilder

### 3. Story Generator / Reel Creator
- Erstellt Storyboards mit mehreren Szenen
- Referenzcharaktere: Bilder hochladen → werden als Base64 in Prompts eingebettet
- Charakterkonsistenz über Szenen hinweg via Identity-Lock im Prompt
- **NEU (heute)**: 
  - `ABSOLUTELY NO TEXT, LETTERS, WORDS, NUMBERS, WATERMARKS...` im Bildprompt → verhindert Schrift im Bild
  - Leere Dialogfelder → KI wird jetzt immer explizit angewiesen: stumme Szene, keine Lippenbewegung
  - Hover-Overlay über Szenenbilder: jetzt **zwei getrennte Icons** — Bild-Icon (nur Bild neu) und Video-Icon (nur Video neu, erscheint wenn Video vorhanden)

### 4. Video-Generierung (Veo)
- Szenen-Bilder werden zu Videos generiert
- `regenerateSingleVideo()` — nur Video neu
- `regenerateImageOnly()` — nur Bild neu
- `regenerateStoryPoint()` — komplette Szene neu

---

## Supabase Edge Functions
| Funktion | Zweck |
|---|---|
| `character-chat` | KI-Chat für Character Creator, System-Prompt mit 13 Fragen |
| `generate-image` | Bildgenerierung mit Referenzbildern (Storyboard) |
| `generate-full` | Vollständige Generierung (Text + Bild) |
| `character-views` | 6 Portrait-Ansichten (nur FULL Plan) |
| `character-poses` | Posen-Grid Generator (nur FULL Plan) |
| `license-check` | Lizenz-Prüfung |
| `credits-balance` | Credits-Abfrage |
| `credits-consume` | Credits-Verbrauch |

**NEU (heute)**: Alle Funktionen haben jetzt verbesserte Fehlermeldungen:
- 429 → Rate limit + Hinweis auf Billing/Wartezeit
- 401 → Key ungültig + Link zu aistudio.google.com
- 403 → Zugriff verweigert + Billing-Hinweis

---

## Pläne / Zugriffsrechte
- **BASIC**: Max. 1 Bild, kein KI-Chat, kein CharacterViews, kein PoseGrid
- **PREMIUM**: Mehr Bilder, KI-Chat
- **FULL**: Alle Features inkl. 6-Ansichten und Posen-Grid

---

## Bekannte Probleme / Hinweise
- `removeChild`-Fehler: Kein App-Bug, wird durch Browser-Erweiterungen (Übersetzer etc.) ausgelöst → Lösung für Nutzer: Erweiterungen deaktivieren oder Inkognito
- Nutzer mit Billing-Problemen (403): `gemini-2.5-flash-image-preview` und `gemini-3.1-flash-image-preview` benötigen Billing-Aktivierung in Google Cloud, auch wenn kein Geld abgebucht wird
- Charakterkonsistenz über Szenen: Funktioniert über Referenzbilder + Prompt-Anweisungen, ist aber KI-seitig nie 100% garantiert

---

## Wichtige Dateipfade
- `src/pages/Index.tsx` — Haupt-App (509KB, sehr groß)
- `src/components/character/QuickModeCreator.tsx` — Schnell-Modus Character Creator
- `src/components/character/ChatModeCreator.tsx` — KI-Chat Character Creator
- `src/components/CharacterCreator.tsx` — Wrapper für beide Modi
- `src/components/ImageGallery.tsx` / `ImageSlot.tsx` — Bild-Slots im Drehstudio
- `supabase/functions/character-chat/index.ts` — System-Prompt der KI (13 Fragen)
- `supabase/functions/generate-image/index.ts` — Bildgenerierung Backend
