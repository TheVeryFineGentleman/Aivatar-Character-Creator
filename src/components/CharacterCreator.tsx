import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickModeCreator } from "@/components/character/QuickModeCreator";
import { ChatModeCreator } from "@/components/character/ChatModeCreator";

interface CharacterCreatorProps {
  apiKey: string;
}

const MODES = [
  { id: "quick", label: "Schnell-Modus", icon: Zap, desc: "Einfach auswählen & generieren" },
  { id: "chat", label: "KI-Chat Modus", icon: MessageSquare, desc: "Im Gespräch mit der KI erstellen" },
] as const;

type Mode = typeof MODES[number]["id"];

export const CharacterCreator: React.FC<CharacterCreatorProps> = ({ apiKey }) => {
  const [mode, setMode] = useState<Mode>("quick");

  return (
    <Card className="mb-8 border-border/50 bg-card/50 backdrop-blur-sm animate-fade-in"
      style={{ animationDelay: '150ms', animationDuration: '600ms', animationFillMode: 'both' }}>
      <CardContent className="pt-6">
        {/* Mode Switcher */}
        <div className="flex gap-2 mb-6">
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200",
                mode === m.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 bg-muted/20 text-muted-foreground hover:border-primary/30"
              )}
            >
              <m.icon className="w-4 h-4" />
              <div className="text-left">
                <div>{m.label}</div>
                <div className="text-xs font-normal opacity-70">{m.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {mode === "quick" ? (
          <QuickModeCreator apiKey={apiKey} />
        ) : (
          <ChatModeCreator apiKey={apiKey} />
        )}
      </CardContent>
    </Card>
  );
};
