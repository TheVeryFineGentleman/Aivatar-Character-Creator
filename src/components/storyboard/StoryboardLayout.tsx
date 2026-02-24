import React from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FolderOpen, Users, Film, Zap } from "lucide-react";
import type { StoryboardSubTab } from "@/types/storyboard";

interface StoryboardLayoutProps {
  activeSubTab: StoryboardSubTab;
  onSubTabChange: (tab: StoryboardSubTab) => void;
  /** Content for the Projekt tab */
  projectContent: React.ReactNode;
  /** Content for the Charaktere tab */
  charactersContent?: React.ReactNode;
  /** Content for the Szenen tab */
  scenesContent?: React.ReactNode;
  /** Content for the Generierung tab */
  generationContent?: React.ReactNode;
  className?: string;
}

const SUB_TABS: { value: StoryboardSubTab; label: string; icon: React.ElementType }[] = [
  { value: 'project', label: 'Projekt', icon: FolderOpen },
  { value: 'characters', label: 'Charaktere', icon: Users },
  { value: 'scenes', label: 'Szenen', icon: Film },
  { value: 'generation', label: 'Generierung', icon: Zap },
];

// Empty state placeholder for tabs not yet populated
const EmptyTabState: React.FC<{ tabLabel: string; description: string }> = ({ tabLabel, description }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
      <span className="text-2xl opacity-50">🚧</span>
    </div>
    <h3 className="text-lg font-semibold text-foreground/80 mb-2">{tabLabel}</h3>
    <p className="text-sm text-muted-foreground max-w-md">{description}</p>
  </div>
);

export const StoryboardLayout: React.FC<StoryboardLayoutProps> = ({
  activeSubTab,
  onSubTabChange,
  projectContent,
  charactersContent,
  scenesContent,
  generationContent,
  className,
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Sub-Tab Navigation */}
      <Tabs
        value={activeSubTab}
        onValueChange={(v) => onSubTabChange(v as StoryboardSubTab)}
        className="w-full"
      >
        <TabsList className="w-fit bg-muted/50 backdrop-blur-sm">
          {SUB_TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="project" className="mt-4">
          {projectContent}
        </TabsContent>

        <TabsContent value="characters" className="mt-4">
          {charactersContent || (
            <EmptyTabState
              tabLabel="Charaktere"
              description="Erstelle und verwalte Charaktere für dein Storyboard. Referenzbilder, Sprechstil und mehr – alles an einem Ort."
            />
          )}
        </TabsContent>

        <TabsContent value="scenes" className="mt-4">
          {scenesContent || (
            <EmptyTabState
              tabLabel="Szenen"
              description="Generiere zuerst ein Storyboard im Projekt-Tab, dann kannst du hier jede Szene im Detail bearbeiten."
            />
          )}
        </TabsContent>

        <TabsContent value="generation" className="mt-4">
          {generationContent || (
            <EmptyTabState
              tabLabel="Generierung"
              description="Steuere die Bild- und Video-Generierung für alle Szenen. Batch-Generierung, Locks und Status-Dashboard."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
