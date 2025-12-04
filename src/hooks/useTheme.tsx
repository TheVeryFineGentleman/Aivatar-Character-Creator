import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { getFromLocalStorage, saveToLocalStorage } from "@/lib/storage";

export type ThemeVariant = "neon" | "sunset" | "ocean";

export const THEME_OPTIONS: { id: ThemeVariant; label: string; description: string }[] = [
  { id: "neon", label: "Neon", description: "Lila & Cyan" },
  { id: "sunset", label: "Sunset", description: "Orange & Gold" },
  { id: "ocean", label: "Ocean", description: "Blau & Teal" },
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
