import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { getFromLocalStorage, saveToLocalStorage } from "@/lib/storage";

export type ThemeVariant = "neon" | "sunset" | "ocean" | "frost" | "sand";

export const THEME_OPTIONS: { id: ThemeVariant; label: string; description: string; gradient: string }[] = [
  { id: "neon", label: "Neon", description: "Dunkel", gradient: "from-purple-500 to-cyan-400" },
  { id: "sunset", label: "Sunset", description: "Dunkel", gradient: "from-orange-500 to-yellow-400" },
  { id: "ocean", label: "Ocean", description: "Dunkel", gradient: "from-blue-500 to-teal-400" },
  { id: "frost", label: "Frost", description: "Hell", gradient: "from-blue-400 to-cyan-300" },
  { id: "sand", label: "Sand", description: "Hell", gradient: "from-orange-400 to-emerald-400" },
];

interface ThemeContextType {
  theme: ThemeVariant;
  setTheme: (theme: ThemeVariant) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeVariant>("neon");

  useEffect(() => {
    const savedTheme = getFromLocalStorage("app-theme") as ThemeVariant | null;
    if (savedTheme && THEME_OPTIONS.some(t => t.id === savedTheme)) {
      setThemeState(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const setTheme = (newTheme: ThemeVariant) => {
    setThemeState(newTheme);
    saveToLocalStorage("app-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
