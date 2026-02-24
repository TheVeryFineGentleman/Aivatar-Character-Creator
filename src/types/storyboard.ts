// ============================================================
// Storyboard Types - Editor-First Redesign
// ============================================================

// --- Character System ---

export interface CharacterRelationship {
  characterId: string;
  type: string; // e.g. "Freund", "Rivale", "Liebespaar"
}

export interface Character {
  id: string;
  name: string;
  role: string; // e.g. "Protagonist", "Nebenfigur", "Antagonist"
  referenceImages: string[]; // base64 or URLs, max 3
  visualDescription: string;
  voice: string; // e.g. "warm, tief, ruhig"
  speakingStyle: string; // e.g. "kurze Sätze, direkt, poetisch"
  emotionalBaseline: string; // e.g. "melancholisch aber hoffnungsvoll"
  doRules: string; // e.g. "Trägt immer Brille, rote Jacke"
  dontRules: string; // e.g. "Nie lächeln, nie rennen"
  relationships: CharacterRelationship[];
  color: string; // Accent color for UI assignment
}

// --- Dialogue System ---

export type DialogueLineType = 'speech' | 'voiceover' | 'whisper' | 'shout' | 'silence';

export interface DialogueLine {
  id: string;
  speakerId: string; // Character ID, "_narrator_", or "_atmosphere_"
  text: string;
  emotion: string; // e.g. "wütend", "flüstern", "neutral"
  intensity: number; // 1-5
  pause: number; // seconds after this line
  type: DialogueLineType;
}

export interface SceneDialogue {
  lines: DialogueLine[];
  atmosphereNote?: string; // e.g. "Regen im Hintergrund"
}

// --- Scene System ---

export type SceneStatus = 'draft' | 'text-ok' | 'image-ok' | 'video-ok' | 'final';

export interface SceneBlocking {
  characterId: string;
  position: string;
  action: string;
  lookDirection: string;
}

export interface LockedFields {
  characterStyle: boolean;
  cameraSettings: boolean;
  imageStyle: boolean;
  dialogue: boolean;
}

export interface Scene {
  id: string;
  versions: string[];
  currentVersion: number;
  summary: string;
  detailedDescription: string;
  // Character assignment
  characterIds: string[];
  blocking: SceneBlocking[];
  // Structured dialogue
  dialogue: SceneDialogue;
  // Existing fields from StoryPoint
  emotion: string;
  audienceEffect: string;
  cameraAngle: string;
  shotType: string;
  composition: string;
  movement: string;
  specificArea?: string;
  keyAction?: string;
  negativePrompts?: string;
  styleNotes?: string;
  continuityNotes?: string;
  dialogText?: string; // Legacy plain-text dialog field
  // Veo3 fields
  veo3CameraMovement?: string;
  veo3StartState?: string;
  veo3Motion?: string;
  veo3EndState?: string;
  // Generation outputs
  generatedImage: string;
  generatedVideo: string;
  videoPrompt: string;
  detailedImagePrompt: string;
  generationError?: string;
  // Status & locks
  status: SceneStatus;
  lockedFields: LockedFields;
  // AI suggestion (pending)
  pendingSuggestion?: Partial<Scene>;
  // Snapshots
  finalSnapshot?: Partial<Scene>;
  finalizedAt?: number;
  generationSnapshot?: Partial<Scene>;
}

// --- Generation Settings ---

export interface GenerationSettings {
  scope: 'all' | 'selected' | 'single';
  selectedScenes: number[];
  type: 'image' | 'video' | 'both';
  locks: LockedFields;
}

// --- AI Assistant ---

export type AssistantScope = 'scene' | 'field';

export interface AssistantSuggestion {
  id: string;
  scope: AssistantScope;
  targetSceneId: string;
  targetField?: string; // e.g. "dialogue", "emotion", "summary"
  original: unknown;
  suggested: unknown;
  status: 'pending' | 'accepted' | 'rejected';
}

// --- Storyboard Sub-Tabs ---

export type StoryboardSubTab = 'project' | 'characters' | 'scenes' | 'generation';

// --- Storyboard State ---

export interface StoryboardState {
  storyIdea: string;
  mainLocation: string;
  characters: Character[];
  scenes: Scene[];
  globalReferenceImages: string[];
  format: string; // "16:9" | "9:16"
  generationSettings: GenerationSettings;
  activeSubTab: StoryboardSubTab;
  selectedSceneIndex: number | null;
}

// --- Helpers ---

export const DEFAULT_LOCKED_FIELDS: LockedFields = {
  characterStyle: false,
  cameraSettings: false,
  imageStyle: false,
  dialogue: false,
};

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  scope: 'all',
  selectedScenes: [],
  type: 'both',
  locks: { ...DEFAULT_LOCKED_FIELDS },
};

export const createDefaultCharacter = (id: string): Character => ({
  id,
  name: '',
  role: '',
  referenceImages: [],
  visualDescription: '',
  voice: '',
  speakingStyle: '',
  emotionalBaseline: '',
  doRules: '',
  dontRules: '',
  relationships: [],
  color: '#8B5CF6', // default purple
});

export const createDefaultDialogue = (): SceneDialogue => ({
  lines: [],
  atmosphereNote: '',
});

export const createDefaultScene = (id: string): Scene => ({
  id,
  versions: [],
  currentVersion: 0,
  summary: '',
  detailedDescription: '',
  characterIds: [],
  blocking: [],
  dialogue: createDefaultDialogue(),
  emotion: '',
  audienceEffect: '',
  cameraAngle: '',
  shotType: '',
  composition: '',
  movement: '',
  generatedImage: '',
  generatedVideo: '',
  videoPrompt: '',
  detailedImagePrompt: '',
  status: 'draft',
  lockedFields: { ...DEFAULT_LOCKED_FIELDS },
});

// Status display configuration
export const SCENE_STATUS_CONFIG: Record<SceneStatus, {
  label: string;
  colorClass: string;
  dotClass: string;
}> = {
  'draft': {
    label: 'Entwurf',
    colorClass: 'bg-muted text-muted-foreground border-muted-foreground/30',
    dotClass: 'bg-muted-foreground',
  },
  'text-ok': {
    label: 'Text OK',
    colorClass: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    dotClass: 'bg-orange-400',
  },
  'image-ok': {
    label: 'Bild OK',
    colorClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dotClass: 'bg-blue-400',
  },
  'video-ok': {
    label: 'Video OK',
    colorClass: 'bg-green-500/15 text-green-400 border-green-500/30',
    dotClass: 'bg-green-400',
  },
  'final': {
    label: 'Final',
    colorClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dotClass: 'bg-amber-400',
  },
};
