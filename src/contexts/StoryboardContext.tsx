import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  type ProjectStoryboard,
  type SceneStack,
  type Character,
  type Transition,
  type SceneCard,
  type SubStackType,
  createDefaultProject,
  createDefaultSceneStack,
} from "@/types/storyboard";

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
}

const StoryboardContext = createContext<StoryboardContextValue | null>(null);

export function StoryboardProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectStoryboard>(createDefaultProject);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

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

  const toggleCardExpanded = useCallback((sceneId: string, cardId: string) => {
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
        toggleSubStackExpanded,
        updateCard,
        toggleCardExpanded,
        expandedCardId,
        addCharacter,
        removeCharacter,
        updateCharacter,
        updateTransition,
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
