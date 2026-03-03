

# Video-Prompts für Short-Form Social Media Content optimieren

## Analyse des aktuellen Problems

Die Video-Prompts sind aktuell auf einen technischen "Storyboard-Film"-Ansatz ausgelegt:
- Fokus auf Hard Cuts, Start/End-Frames, nahtlose Übergänge
- ~200 Wörter, sehr technisch formuliert
- Kamerabewegungen aus einer starren Liste
- Prompt ist auf Deutsch formuliert und wird vom LLM ins Englische übersetzt

**Das passt nicht zum Ziel**: Kurze, packende Social-Media-Videos (TikTok, Reels, Shorts) brauchen ganz andere Prompts -- schnell, emotional, aufmerksamkeitsstark.

## Plan

### 1. Video-Prompt-System-Instruction komplett neu schreiben

Statt des technischen Storyboard-Prompts wird ein neues Template verwendet, das auf Short-Form Content optimiert ist:

- **Pacing**: Schnelle, dynamische Bewegungen statt langsamer Kinoästhetik
- **Hook-First**: Die ersten Frames müssen sofort fesseln (Social Media = 1-3 Sekunden Aufmerksamkeit)
- **Emotionale Intensität**: Stärkere emotionale Beats, ausdrucksstarke Mimik
- **Dialog-Integration**: Gesprochener Dialog wird als zentrales Element behandelt (Lip-Sync für Veo3)
- **Kein Hard-Cut-Konzept mehr in jedem Prompt**: Das Hard-Cut-Konzept wird nur noch optional verwendet wenn es eine Folgeszene gibt, statt als zwingendes Strukturelement
- **Prompt auf Englisch**: Der System-Prompt wird direkt auf Englisch geschrieben, da die Video-KI Englisch bevorzugt

### 2. Prompt-Struktur vereinfachen

Aktuell: ~50 Zeilen System-Instruction mit vielen deutschen Anweisungen, starrem Hard-Cut-Konzept, und technischen Details.

Neu: Kompakter, englischer System-Prompt mit klarem Fokus:

```text
Prompt-Struktur (neu):
1. HOOK (erste 1-2 Sekunden): Was fesselt sofort?
2. CORE ACTION: Was passiert visuell + emotional?
3. DIALOG: Lip-sync mit exaktem Wortlaut
4. ENERGY/PACING: Schnell, dynamisch, social-media-tauglich
5. TRANSITION (optional): Nur wenn Folgeszene existiert
```

### 3. Prompt-Länge reduzieren

Von ~200 Wörtern auf ~80-120 Wörter. Kürzere Prompts sind stabiler bei der kie.ai API und passender für kurze Videos (5-10 Sekunden pro Szene).

### 4. Kamerabewegungen dynamischer gestalten

Statt der starren `VEO3_CAMERA_MOVEMENTS`-Liste mit "bereits verwendete ausschließen" wird die KI angewiesen, die Kamerabewegung frei zum Inhalt passend zu wählen -- Wiederholungen sind bei Social Media Content sogar gewünscht (z.B. immer Zoom-Ins bei Reveals).

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/pages/Index.tsx` | `generateVideoPrompts()` (~Zeilen 1784-1860): System-Prompt komplett neu, englisch, auf Short-Form optimiert. Prompt-Länge auf ~100 Wörter reduziert. Hard-Cut nur optional. |
| `src/pages/Index.tsx` | Inline video prompt generation (~Zeilen 1490-1540): Gleiche Anpassung für den parallelen Prompt-Generierungspfad |

