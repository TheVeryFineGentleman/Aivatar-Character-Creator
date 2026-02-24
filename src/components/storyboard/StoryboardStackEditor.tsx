import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStoryboard } from "@/contexts/StoryboardContext";
import { SceneStackCard } from "./SceneStackCard";
import { TransitionCard } from "./TransitionCard";

export const StoryboardStackEditor: React.FC = () => {
  const { project, addScene, updateTransition } = useStoryboard();

  return (
    <div className="space-y-2">
      {project.scenes.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border/40 p-12 flex flex-col items-center justify-center gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Plus className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground mb-1">Noch keine Szenen</p>
            <p className="text-xs text-muted-foreground">Füge deine erste Szene hinzu, um mit dem Storyboard zu beginnen.</p>
          </div>
          <Button onClick={addScene} className="gap-1.5">
            <Plus className="w-4 h-4" />
            Erste Szene hinzufügen
          </Button>
        </div>
      ) : (
        <>
          {project.scenes.map((scene, i) => (
            <React.Fragment key={scene.id}>
              {/* Transition card between scenes */}
              {i > 0 && (
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
              )}
              <SceneStackCard scene={scene} />
            </React.Fragment>
          ))}

          {/* Add scene button */}
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={addScene} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <Plus className="w-4 h-4" />
              Szene hinzufügen
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
