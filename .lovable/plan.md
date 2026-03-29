

## Problem Analysis

Two issues in the Character Creator chat flow:

1. **"Jetzt generieren" button bypasses the summary step**: The `requestGenerateNow` function sends a message that directly requests prompts with a preset `imageCount`, skipping the AI's built-in flow of showing the summary and asking for variant count.

2. **System prompt already has correct wording** ("Wie viele Charactervarianten soll ich für dich erstellen?") but `requestGenerateNow` overrides it with: "Erstelle jetzt die Prompts... Erstelle {imageCount} Charactervarianten mit unterschiedlichen Gesichtern" — this triggers immediate JSON output instead of the summary + variant-count question flow.

## Plan

### 1. Fix `requestGenerateNow` in `ChatModeCreator.tsx`

Change the trigger message from requesting prompts directly to asking the AI to wrap up the conversation and show the summary overview. New message:

> "Fasse meine bisherigen Angaben zusammen und zeige mir die Übersicht. Denke dir fehlende Details selbst aus."

This lets the AI follow its natural flow: show summary → ask for confirmation → ask for variant count → output JSON.

### 2. Remove `imageCount` dependency from trigger

The variant count should come from the user's chat input (e.g. "3"), not from the slider. The `imageCount` prop is still used as a fallback/max limit for `generateImages`, but the trigger message no longer hardcodes it.

### 3. Update `handleRegenerateWithChanges` similarly

Change the regeneration trigger to also follow the natural flow rather than bypassing it.

### Technical Details

**File: `src/components/character/ChatModeCreator.tsx`**
- `requestGenerateNow`: Change trigger message to request summary instead of prompts
- `handleRegenerateWithChanges`: Same approach — ask for summary with changes

**File: `supabase/functions/character-chat/index.ts`**
- No changes needed — the system prompt already handles the correct flow (summary → confirm → ask count → generate JSON)

