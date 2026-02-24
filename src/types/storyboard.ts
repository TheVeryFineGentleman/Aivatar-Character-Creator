// ============================================================
// Storyboard Stack Editor — Type Definitions
// ============================================================

// --- Project Level ---

export interface ProjectStoryboard {
  id: string;
  title: string;
  summary: string;
  mainLocation: string;
  format: "16:9" | "9:16";
  referenceImages: string[]; // base64
  characters: Character[];
  scenes: SceneStack[];
  transitions: Transition[];
  createdAt: number;
  updatedAt: number;
}

// --- Characters ---

export interface Character {
  id: string;
  name: string;
  role: string;
  referenceImages: string[];
  visualDescription: string;
  speakingStyle: string;
  doRules: string;
  dontRules: string;
}

export interface CharacterUsageInScene {
  characterId: string;
  sceneRole: "spricht" | "sichtbar" | "hintergrund" | "off-screen";
}

// --- Scene Stack ---

export type SceneStatus = "draft" | "text-ok" | "image-ok" | "video-ok" | "final";

export interface SceneStack {
  id: string;
  index: number;
  subStacks: SceneSubStack[];
  status: SceneStatus;
  isExpanded: boolean;
  // Generation results
  generatedImage?: string;
  imageVersions?: string[];
  currentImageVersionIndex?: number;
  generatedVideo?: string;
  detailedImagePrompt?: string;
  videoPrompt?: string;
  // Snapshots
  finalSnapshot?: Partial<SceneStack>;
  finalizedAt?: number;
  generationSnapshot?: Partial<SceneStack>;
}

// --- Sub-Stacks ---

export type SubStackType = "story" | "appearance" | "characters" | "generation";

export const SUB_STACK_CONFIG: Record<SubStackType, { label: string; colorAccent: string; letter: string }> = {
  story: { label: "Story & Handlung", colorAccent: "hsl(210 100% 50%)", letter: "A" },
  appearance: { label: "Aussehen & Feeling", colorAccent: "hsl(280 80% 60%)", letter: "B" },
  characters: { label: "Charaktere", colorAccent: "hsl(25 95% 53%)", letter: "C" },
  generation: { label: "Generierung & Output", colorAccent: "hsl(150 60% 45%)", letter: "D" },
};

export interface SceneSubStack {
  type: SubStackType;
  label: string;
  colorAccent: string;
  isExpanded: boolean;
  cards: SceneCard[];
}

// --- Cards ---

export type SceneCardType =
  | "story-core"
  | "action-goal"
  | "dialogue"
  | "emotion"
  | "camera"
  | "style"
  | "characters"
  | "prompt-blueprint"
  | "output-preview";

export interface SceneCard {
  id: string;
  type: SceneCardType;
  isExpanded: boolean;
  data: Record<string, any>;
  locks: LockState;
}

export interface LockState {
  character: boolean;
  style: boolean;
  camera: boolean;
  dialogue: boolean;
}

export const DEFAULT_LOCK_STATE: LockState = {
  character: false,
  style: false,
  camera: false,
  dialogue: false,
};

// --- Dialogue ---

export interface DialogueLine {
  characterId: string;
  text: string;
  direction?: string;
}

// --- Transitions ---

export type TransitionType =
  | "cut" | "fade" | "dissolve" | "match-cut"
  | "whip-pan" | "smash-cut" | "l-cut" | "j-cut";

export const TRANSITION_TYPES: { value: TransitionType; label: string }[] = [
  { value: "cut", label: "Cut" },
  { value: "fade", label: "Fade" },
  { value: "dissolve", label: "Dissolve" },
  { value: "match-cut", label: "Match Cut" },
  { value: "whip-pan", label: "Whip Pan" },
  { value: "smash-cut", label: "Smash Cut" },
  { value: "l-cut", label: "L-Cut" },
  { value: "j-cut", label: "J-Cut" },
];

export interface Transition {
  id: string;
  fromSceneIndex: number;
  toSceneIndex: number;
  type: TransitionType;
  duration: number;
  audioTransition: "cut" | "crossfade" | "fade-out" | "fade-in";
  continuityNote: string;
  isLocked: boolean;
  aiSuggested: boolean;
}

// --- AI Assistant ---

export interface EditScope {
  level: "field" | "card" | "substack" | "scene";
  sceneId: string;
  subStackType?: SubStackType;
  cardId?: string;
  fieldName?: string;
}

export interface AssistantSuggestion {
  id: string;
  scope: EditScope;
  targetId: string;
  changes: Record<string, { old: any; new: any }>;
  status: "pending" | "accepted" | "rejected" | "partial";
  prompt: string;
  createdAt: number;
}

// --- Helpers ---

export function createDefaultSceneStack(index: number): SceneStack {
  const id = crypto.randomUUID();
  return {
    id,
    index,
    status: "draft",
    isExpanded: false,
    subStacks: [
      {
        type: "story",
        label: SUB_STACK_CONFIG.story.label,
        colorAccent: SUB_STACK_CONFIG.story.colorAccent,
        isExpanded: false,
        cards: [
          { id: crypto.randomUUID(), type: "story-core", isExpanded: false, data: { summary: "", detailedDescription: "", specificArea: "", keyAction: "" }, locks: { ...DEFAULT_LOCK_STATE } },
          { id: crypto.randomUUID(), type: "action-goal", isExpanded: false, data: { goal: "", blocking: "" }, locks: { ...DEFAULT_LOCK_STATE } },
          { id: crypto.randomUUID(), type: "dialogue", isExpanded: false, data: { dialogText: "", lines: [] as DialogueLine[] }, locks: { ...DEFAULT_LOCK_STATE } },
        ],
      },
      {
        type: "appearance",
        label: SUB_STACK_CONFIG.appearance.label,
        colorAccent: SUB_STACK_CONFIG.appearance.colorAccent,
        isExpanded: false,
        cards: [
          { id: crypto.randomUUID(), type: "emotion", isExpanded: false, data: { emotion: "", audienceEffect: "" }, locks: { ...DEFAULT_LOCK_STATE } },
          { id: crypto.randomUUID(), type: "camera", isExpanded: false, data: { cameraAngle: "", shotType: "", composition: "", movement: "" }, locks: { ...DEFAULT_LOCK_STATE } },
          { id: crypto.randomUUID(), type: "style", isExpanded: false, data: { styleNotes: "", negativePrompts: "", continuityNotes: "" }, locks: { ...DEFAULT_LOCK_STATE } },
        ],
      },
      {
        type: "characters",
        label: SUB_STACK_CONFIG.characters.label,
        colorAccent: SUB_STACK_CONFIG.characters.colorAccent,
        isExpanded: false,
        cards: [
          { id: crypto.randomUUID(), type: "characters", isExpanded: false, data: { characterUsages: [] as CharacterUsageInScene[] }, locks: { ...DEFAULT_LOCK_STATE } },
        ],
      },
      {
        type: "generation",
        label: SUB_STACK_CONFIG.generation.label,
        colorAccent: SUB_STACK_CONFIG.generation.colorAccent,
        isExpanded: false,
        cards: [
          { id: crypto.randomUUID(), type: "prompt-blueprint", isExpanded: false, data: { detailedImagePrompt: "", videoPrompt: "" }, locks: { ...DEFAULT_LOCK_STATE } },
          { id: crypto.randomUUID(), type: "output-preview", isExpanded: false, data: {}, locks: { ...DEFAULT_LOCK_STATE } },
        ],
      },
    ],
  };
}

export function createDefaultProject(): ProjectStoryboard {
  return {
    id: crypto.randomUUID(),
    title: "",
    summary: "",
    mainLocation: "",
    format: "16:9",
    referenceImages: [],
    characters: [],
    scenes: [],
    transitions: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Card type display labels
export const CARD_TYPE_LABELS: Record<SceneCardType, string> = {
  "story-core": "Story-Kern",
  "action-goal": "Handlung & Ziel",
  "dialogue": "Dialog",
  "emotion": "Emotion & Wirkung",
  "camera": "Kamera & Bild",
  "style": "Stil & Feintuning",
  "characters": "Charaktere in Szene",
  "prompt-blueprint": "Prompt / Blueprint",
  "output-preview": "Output & Vorschau",
};
