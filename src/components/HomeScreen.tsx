import React from "react";
import { Sparkles, BookOpen, User, Lock, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface HomeScreenProps {
  planCode: string;
  onSelectFeature: (feature: "poses" | "story" | "character") => void;
  onShowUpgrade: () => void;
}

const features = [
  {
    id: "poses" as const,
    title: "Avatar Shooting Studio",
    description: "Generiere vielfältige Character-Posen mit KI – von Casual bis Profi.",
    icon: Sparkles,
    gradient: "from-primary/20 to-primary/5",
    iconColor: "text-primary",
    minPlan: "BASIC",
  },
  {
    id: "story" as const,
    title: "Reel/Story Videocreator",
    description: "Erstelle Szenen-basierte Storyboards mit KI-generierten Bildern und Videos.",
    icon: BookOpen,
    gradient: "from-amber-500/20 to-amber-500/5",
    iconColor: "text-amber-500",
    minPlan: "FULL",
  },
  {
    id: "character" as const,
    title: "Character Creator",
    description: "Erschaffe einzigartige Charaktere per Fragebogen – die KI visualisiert sie für dich.",
    icon: User,
    gradient: "from-violet-500/20 to-violet-500/5",
    iconColor: "text-violet-500",
    minPlan: "BASIC",
  },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({ planCode, onSelectFeature, onShowUpgrade }) => {
  const isLocked = (minPlan: string) => {
    if (minPlan === "BASIC") return false;
    if (minPlan === "FULL") return planCode !== "FULL";
    return false;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="text-center mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold mb-3">
          Was möchtest du erstellen?
        </h2>
        <p className="text-muted-foreground text-lg">
          Wähle ein Tool, um loszulegen
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        {features.map((feature, index) => {
          const locked = isLocked(feature.minPlan);
          const Icon = feature.icon;

          return (
            <button
              key={feature.id}
              onClick={() => {
                if (locked) {
                  onShowUpgrade();
                } else {
                  onSelectFeature(feature.id);
                }
              }}
              className={cn(
                "group relative flex flex-col items-center text-center p-8 rounded-2xl border transition-all duration-300 animate-fade-in",
                "bg-card/50 backdrop-blur-sm border-border/50",
                locked
                  ? "opacity-70 cursor-not-allowed"
                  : "hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 cursor-pointer"
              )}
              style={{
                animationDelay: `${index * 100 + 100}ms`,
                animationDuration: "600ms",
                animationFillMode: "both",
              }}
            >
              {locked && (
                <div className="absolute top-4 right-4">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                </div>
              )}

              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mb-5 bg-gradient-to-br transition-transform duration-300 group-hover:scale-110",
                feature.gradient
              )}>
                <Icon className={cn("w-8 h-8", feature.iconColor)} />
              </div>

              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {feature.description}
              </p>

              <div className={cn(
                "flex items-center gap-1.5 text-sm font-medium transition-all duration-300",
                locked ? "text-muted-foreground" : "text-primary group-hover:gap-3"
              )}>
                {locked ? "Upgrade nötig" : "Starten"}
                <ArrowRight className="w-4 h-4" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
