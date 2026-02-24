import React from "react";
import { StoryboardProvider } from "@/contexts/StoryboardContext";
import { StoryboardHeaderCard } from "./StoryboardHeaderCard";
import { StoryboardStackEditor } from "./StoryboardStackEditor";

export const StoryboardEditor: React.FC = () => {
  return (
    <StoryboardProvider>
      <div className="space-y-6 max-w-[1100px] mx-auto animate-fade-in">
        <StoryboardHeaderCard />
        <StoryboardStackEditor />
      </div>
    </StoryboardProvider>
  );
};
