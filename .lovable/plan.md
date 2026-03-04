

# Video-Prompts: Szenen-Kohärenz und logischer Erzählfluss

## Problem

Beide Video-Prompt-Pfade (inline parallel + `generateVideoPrompts`) haben zwei zentrale Schwächen:

1. **Kein Story-Gesamtkontext**: Jede Szene wird isoliert betrachtet. Die KI kennt nur die aktuelle Szene und den End-State der vorherigen -- sie hat keine Ahnung vom Gesamtbogen der Geschichte.
2. **Kein narrativer Zusammenhang**: Es fehlt die Information, *warum* Szene 3 nach Szene 2 kommt, welche Ursache-Wirkung-Kette die Szenen verbindet.
3. **Alte deutsche Hard-Cut-Prompts**: Beide Pfade nutzen noch das alte ~200-Wörter-Format auf Deutsch mit starrem Hard-Cut-Konzept, obwohl die Short-Form-Optimierung beschlossen wurde.

## Lösung

### 1. Story-Synopsis als Kontext mitgeben

Vor der Prompt-Generierung wird eine kompakte Synopsis aller Szenen erstellt (1-2 Sätze pro Szene). Diese wird in jeden Video-Prompt eingefügt, damit die KI den Gesamtbogen kennt:

```text
FULL STORY ARC (5 scenes total):
1. "A lonely astronaut discovers a glowing artifact..."
2. "The artifact activates and projects a hologram..."
3. "She follows the hologram through a canyon..." ← YOU ARE HERE
4. "At the canyon's end, she finds a hidden city..."
5. "She enters the city and meets its inhabitants..."
```

### 2. Narrative Kausalität im Prompt verankern

Statt nur "vorherige Szene endete mit X" wird explizit beschrieben:
- Was hat zur aktuellen Szene **geführt** (Cause)
- Was ist die **emotionale Entwicklung** (Arc)
- Wohin führt die Szene **als nächstes** (Setup)

### 3. Beide Pfade auf neues englisches Short-Form-Template umstellen

Das `generateVideoPrompts`-Template (Zeilen 1821-1860) und das Inline-Template (Zeilen 1499-1502) werden beide auf ein einheitliches, englisches Template umgestellt:

```text
You are a short-form video prompt writer for AI video generators (Veo3/Kling).

FULL STORY ARC ({n} scenes):
{numbered synopsis of all scenes, marking current}

CURRENT SCENE ({i}/{n}): "{sceneText}"
{metadata: emotion, camera, dialog...}

NARRATIVE CONTEXT:
- Previous: {what just happened and how it connects}
- Current purpose: {why this scene exists in the story}
- Next: {what this scene sets up}

Write a punchy video prompt (80-120 words, English):
- HOOK: Opening must grab attention instantly
- ACTION: Core movement and emotion
- CONTINUITY: Visual elements must logically connect to previous/next scene
- DIALOG: {if present, lip-sync instructions}
- PACING: Fast, dynamic, social-media energy

Respond ONLY with JSON: {"videoPrompt":"...","cameraMovement":"...","startState":"...","motion":"...","endState":"..."}
```

### Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/pages/Index.tsx` | `generateVideoPrompts()` (Zeilen ~1821-1860): Neues englisches Template mit Story-Synopsis und Narrativ-Kontext |
| `src/pages/Index.tsx` | Inline-Video-Prompt (Zeilen ~1499-1502): Gleiches neues Template, Story-Synopsis und Kausalität |

