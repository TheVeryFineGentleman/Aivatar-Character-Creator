import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  type ProjectStoryboard,
  type SceneStack,
  type Character,
  type Transition,
  type SceneCard,
  type SubStackType,
  type StoryIdeaInput,
  createDefaultProject,
  createDefaultSceneStack,
  DEFAULT_LOCK_STATE,
  SUB_STACK_CONFIG,
} from "@/types/storyboard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StoryboardContextValue {
  project: ProjectStoryboard;
  setProject: React.Dispatch<React.SetStateAction<ProjectStoryboard>>;

  // Project-level helpers
  updateProjectField: (field: keyof ProjectStoryboard, value: any) => void;

  // Scene CRUD
  addScene: () => void;
  removeScene: (sceneId: string) => void;
  updateScene: (sceneId: string, updates: Partial<SceneStack>) => void;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  toggleSceneExpanded: (sceneId: string) => void;
  insertSceneAt: (index: number) => void;
  duplicateScene: (sceneId: string) => void;

  // Sub-stack toggles
  toggleSubStackExpanded: (sceneId: string, subStackType: SubStackType) => void;

  // Card helpers
  updateCard: (sceneId: string, cardId: string, dataUpdates: Record<string, any>) => void;
  toggleCardExpanded: (sceneId: string, cardId: string) => void;
  expandedCardId: string | null;

  // Character helpers
  addCharacter: (character: Character) => void;
  removeCharacter: (characterId: string) => void;
  updateCharacter: (characterId: string, updates: Partial<Character>) => void;

  // Transition helpers
  updateTransition: (transitionId: string, updates: Partial<Transition>) => void;

  // AI Generation
  generateFromIdea: (input: StoryIdeaInput) => Promise<void>;
  isGeneratingStoryboard: boolean;
  generationProgress: { current: number; total: number } | null;

  // Slider
  activeSceneIndex: number | null;
  setActiveSceneIndex: (index: number | null) => void;
}

const StoryboardContext = createContext<StoryboardContextValue | null>(null);

export function StoryboardProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectStoryboard>(createDefaultProject);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState<number | null>(null);

  const updateProjectField = useCallback((field: keyof ProjectStoryboard, value: any) => {
    setProject(prev => ({ ...prev, [field]: value, updatedAt: Date.now() }));
  }, []);

  const addScene = useCallback(() => {
    setProject(prev => {
      const newScene = createDefaultSceneStack(prev.scenes.length);
      newScene.isExpanded = true;
      return { ...prev, scenes: [...prev.scenes, newScene], updatedAt: Date.now() };
    });
  }, []);

  const removeScene = useCallback((sceneId: string) => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.filter(s => s.id !== sceneId).map((s, i) => ({ ...s, index: i })),
      updatedAt: Date.now(),
    }));
  }, []);

  const updateScene = useCallback((sceneId: string, updates: Partial<SceneStack>) => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, ...updates } : s),
      updatedAt: Date.now(),
    }));
  }, []);

  const reorderScenes = useCallback((fromIndex: number, toIndex: number) => {
    setProject(prev => {
      const scenes = [...prev.scenes];
      const [moved] = scenes.splice(fromIndex, 1);
      scenes.splice(toIndex, 0, moved);
      return { ...prev, scenes: scenes.map((s, i) => ({ ...s, index: i })), updatedAt: Date.now() };
    });
  }, []);

  const toggleSceneExpanded = useCallback((sceneId: string) => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(s => s.id === sceneId ? { ...s, isExpanded: !s.isExpanded } : s),
    }));
  }, []);

  const insertSceneAt = useCallback((index: number) => {
    setProject(prev => {
      const newScene = createDefaultSceneStack(index);
      newScene.isExpanded = true;
      const scenes = [...prev.scenes];
      scenes.splice(index, 0, newScene);
      return { ...prev, scenes: scenes.map((s, i) => ({ ...s, index: i })), updatedAt: Date.now() };
    });
  }, []);

  const duplicateScene = useCallback((sceneId: string) => {
    setProject(prev => {
      const source = prev.scenes.find(s => s.id === sceneId);
      if (!source) return prev;
      const clone: SceneStack = JSON.parse(JSON.stringify(source));
      clone.id = crypto.randomUUID();
      clone.isExpanded = true;
      clone.status = "draft";
      clone.generatedImage = undefined;
      clone.generatedVideo = undefined;
      // Re-generate card IDs
      clone.subStacks.forEach(ss => {
        ss.cards.forEach(c => { c.id = crypto.randomUUID(); });
      });
      const scenes = [...prev.scenes];
      scenes.splice(source.index + 1, 0, clone);
      return { ...prev, scenes: scenes.map((s, i) => ({ ...s, index: i })), updatedAt: Date.now() };
    });
  }, []);

  const toggleSubStackExpanded = useCallback((sceneId: string, subStackType: SubStackType) => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(s =>
        s.id === sceneId
          ? {
              ...s,
              subStacks: s.subStacks.map(ss =>
                ss.type === subStackType ? { ...ss, isExpanded: !ss.isExpanded } : ss
              ),
            }
          : s
      ),
    }));
  }, []);

  const updateCard = useCallback((sceneId: string, cardId: string, dataUpdates: Record<string, any>) => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(s =>
        s.id === sceneId
          ? {
              ...s,
              subStacks: s.subStacks.map(ss => ({
                ...ss,
                cards: ss.cards.map(c =>
                  c.id === cardId ? { ...c, data: { ...c.data, ...dataUpdates } } : c
                ),
              })),
            }
          : s
      ),
      updatedAt: Date.now(),
    }));
  }, []);

  const toggleCardExpanded = useCallback((_sceneId: string, cardId: string) => {
    setExpandedCardId(prev => prev === cardId ? null : cardId);
  }, []);

  const addCharacter = useCallback((character: Character) => {
    setProject(prev => ({ ...prev, characters: [...prev.characters, character], updatedAt: Date.now() }));
  }, []);

  const removeCharacter = useCallback((characterId: string) => {
    setProject(prev => ({
      ...prev,
      characters: prev.characters.filter(c => c.id !== characterId),
      updatedAt: Date.now(),
    }));
  }, []);

  const updateCharacter = useCallback((characterId: string, updates: Partial<Character>) => {
    setProject(prev => ({
      ...prev,
      characters: prev.characters.map(c => c.id === characterId ? { ...c, ...updates } : c),
      updatedAt: Date.now(),
    }));
  }, []);

  const updateTransition = useCallback((transitionId: string, updates: Partial<Transition>) => {
    setProject(prev => ({
      ...prev,
      transitions: prev.transitions.map(t => t.id === transitionId ? { ...t, ...updates } : t),
      updatedAt: Date.now(),
    }));
  }, []);

  const generateFromIdea = useCallback(async (input: StoryIdeaInput) => {
    setIsGeneratingStoryboard(true);
    setGenerationProgress({ current: 0, total: input.sceneCount });

    try {
      const { data, error } = await supabase.functions.invoke("generate-storyboard", {
        body: input,
      });

      if (error) throw new Error(error.message || "Fehler bei der Generierung");
      if (data?.error) throw new Error(data.error);

      // Build scenes from AI response
      const aiScenes: any[] = data.scenes || [];
      const scenes: SceneStack[] = aiScenes.map((s: any, i: number) => {
        const scene = createDefaultSceneStack(i);
        scene.isExpanded = false;

        // Fill story sub-stack
        const storyStack = scene.subStacks.find(ss => ss.type === "story");
        if (storyStack) {
          const storyCore = storyStack.cards.find(c => c.type === "story-core");
          if (storyCore) {
            storyCore.data = {
              summary: s.summary || "",
              detailedDescription: s.detailedDescription || "",
              specificArea: s.specificArea || "",
              keyAction: s.keyAction || "",
            };
          }
          const actionGoal = storyStack.cards.find(c => c.type === "action-goal");
          if (actionGoal) {
            actionGoal.data = { goal: s.goal || "", blocking: "" };
          }
          const dialogue = storyStack.cards.find(c => c.type === "dialogue");
          if (dialogue) {
            dialogue.data = { dialogText: s.dialogText || "", lines: [] };
          }
        }

        // Fill appearance sub-stack
        const appearanceStack = scene.subStacks.find(ss => ss.type === "appearance");
        if (appearanceStack) {
          const emotion = appearanceStack.cards.find(c => c.type === "emotion");
          if (emotion) {
            emotion.data = { emotion: s.emotion || "", audienceEffect: s.audienceEffect || "" };
          }
          const camera = appearanceStack.cards.find(c => c.type === "camera");
          if (camera) {
            camera.data = {
              shotType: s.shotType || "",
              cameraAngle: s.cameraAngle || "",
              composition: s.composition || "",
              movement: "",
            };
          }
          const style = appearanceStack.cards.find(c => c.type === "style");
          if (style) {
            style.data = { styleNotes: s.styleNotes || "", negativePrompts: "", continuityNotes: "" };
          }
        }

        setGenerationProgress({ current: i + 1, total: input.sceneCount });
        return scene;
      });

      // Build transitions
      const aiTransitions: any[] = data.transitions || [];
      const transitions: Transition[] = aiTransitions.map((t: any) => ({
        id: crypto.randomUUID(),
        fromSceneIndex: t.fromIndex,
        toSceneIndex: t.toIndex,
        type: t.type || "cut",
        duration: t.duration || 0.5,
        audioTransition: "crossfade" as const,
        continuityNote: t.continuityNote || "",
        isLocked: false,
        aiSuggested: true,
      }));

      setProject(prev => ({
        ...prev,
        title: data.title || prev.title,
        summary: data.summary || prev.summary,
        format: input.format,
        scenes,
        transitions,
        updatedAt: Date.now(),
      }));

      toast.success(`Storyboard mit ${scenes.length} Szenen erstellt!`);
    } catch (err: any) {
      console.error("Generate storyboard error:", err);
      toast.error(err.message || "Fehler bei der Storyboard-Generierung");
    } finally {
      setIsGeneratingStoryboard(false);
      setGenerationProgress(null);
    }
  }, []);

  return (
    <StoryboardContext.Provider
      value={{
        project,
        setProject,
        updateProjectField,
        addScene,
        removeScene,
        updateScene,
        reorderScenes,
        toggleSceneExpanded,
        insertSceneAt,
        duplicateScene,
        toggleSubStackExpanded,
        updateCard,
        toggleCardExpanded,
        expandedCardId,
        addCharacter,
        removeCharacter,
        updateCharacter,
        updateTransition,
        generateFromIdea,
        isGeneratingStoryboard,
        generationProgress,
        activeSceneIndex,
        setActiveSceneIndex,
      }}
    >
      {children}
    </StoryboardContext.Provider>
  );
}

export function useStoryboard() {
  const ctx = useContext(StoryboardContext);
  if (!ctx) throw new Error("useStoryboard must be used within StoryboardProvider");
  return ctx;
}
