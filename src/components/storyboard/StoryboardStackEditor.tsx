import React, { useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoryboard } from "@/contexts/StoryboardContext";
import { SceneStackCard } from "./SceneStackCard";
import { TransitionCard } from "./TransitionCard";
import { StoryIdeaGenerateCard } from "./StoryIdeaGenerateCard";
import { SceneStackSlider } from "./SceneStackSlider";
import { InsertSceneButtonRow } from "./InsertSceneButtonRow";

export const StoryboardStackEditor: React.FC = () => {
  const { project, addScene, updateTransition, activeSceneIndex, setActiveSceneIndex } = useStoryboard();
  const sceneRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const scrollToScene = useCallback((index: number) => {
    setActiveSceneIndex(index);
    sceneRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [setActiveSceneIndex]);

  if (project.scenes.length === 0) {
    return <StoryIdeaGenerateCard />;
  }

  return (
    <div className="space-y-2">
      {/* Scene Slider */}
      <SceneStackSlider
        scenes={project.scenes}
        activeIndex={activeSceneIndex}
        onSelect={scrollToScene}
      />

      {/* Scene Stacks */}
      {project.scenes.map((scene, i) => (
        <React.Fragment key={scene.id}>
          {/* Insert point before scene */}
          {i === 0 && <InsertSceneButtonRow insertIndex={0} />}

          {/* Transition card between scenes */}
          {i > 0 && (
            <>
              <TransitionCard
                transition={
                  project.transitions.find(
                    t => t.fromSceneIndex === i - 1 && t.toSceneIndex === i
                  ) || {
                    id: `default-${i}`,
                    fromSceneIndex: i - 1,
                    toSceneIndex: i,
                    type: "cut",
                    duration: 0,
                    audioTransition: "cut",
                    continuityNote: "",
                    isLocked: false,
                    aiSuggested: false,
                  }
                }
                onUpdate={(updates) => {
                  const existing = project.transitions.find(
                    t => t.fromSceneIndex === i - 1 && t.toSceneIndex === i
                  );
                  if (existing) {
                    updateTransition(existing.id, updates);
                  }
                }}
              />
              <InsertSceneButtonRow insertIndex={i} />
            </>
          )}

          <div ref={(el) => { sceneRefs.current[i] = el; }}>
            <SceneStackCard scene={scene} />
          </div>

          {/* Insert point after last scene */}
          {i === project.scenes.length - 1 && (
            <InsertSceneButtonRow insertIndex={i + 1} />
          )}
        </React.Fragment>
      ))}

      {/* Add scene button */}
      <div className="flex justify-center pt-2">
        <Button variant="outline" onClick={addScene} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Plus className="w-4 h-4" />
          Szene hinzufügen
        </Button>
      </div>
    </div>
  );
};
