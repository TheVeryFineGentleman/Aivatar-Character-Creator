import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Ctx {
  value: string;
  onValueChange: (v: string) => void;
}
const TabsCtx = createContext<Ctx | null>(null);

export function Tabs({ value, onValueChange, children, className }: Ctx & { children: ReactNode; className?: string }) {
  return (
    <TabsCtx.Provider value={{ value, onValueChange }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      "inline-flex items-center gap-1 p-1 rounded-2xl bg-ink-900/80 border border-white/8 backdrop-blur",
      className,
    )}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, icon }: { value: string; children: ReactNode; icon?: ReactNode }) {
  const ctx = useContext(TabsCtx)!;
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.onValueChange(value)}
      className={cn(
        "relative inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all",
        active
          ? "bg-flare-grad text-pure shadow-glow"
          : "text-ink-50/65 hover:text-ink-50 hover:bg-white/5",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TabsCtx)!;
  if (ctx.value !== value) return null;
  return <div className={cn("animate-fade-in", className)}>{children}</div>;
}
