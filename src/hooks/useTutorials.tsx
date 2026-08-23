/**
 * Globaler Zustand für das Video-Tutorial-Panel.
 *
 * `openPanel(id?)` öffnet das Panel und spielt optional direkt ein bestimmtes
 * Tutorial ab (Flow: "Video-Tutorial ansehen"-Link auf einem Tool).
 * Ohne id öffnet es einfach das Panel (Flow: Launcher oben links).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface TutorialsValue {
  open: boolean;
  activeId: string | null;
  /** true = das aktive Video darf automatisch starten (Klick auf CTA/Listeneintrag);
   *  false = nur Panel geöffnet (Launcher) → Video pausiert anzeigen. */
  autoplay: boolean;
  openPanel: (id?: string) => void;
  close: () => void;
  setActive: (id: string) => void;
}

const TutorialsContext = createContext<TutorialsValue | null>(null);

export function TutorialsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [autoplay, setAutoplay] = useState(false);

  const openPanel = useCallback((id?: string) => {
    // Mit Video-ID (CTA) → direkt abspielen. Ohne ID (Launcher) → nur öffnen.
    if (id) { setActiveId(id); setAutoplay(true); }
    else { setAutoplay(false); }
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const setActive = useCallback((id: string) => { setActiveId(id); setAutoplay(true); }, []);

  const value = useMemo(
    () => ({ open, activeId, autoplay, openPanel, close, setActive }),
    [open, activeId, autoplay, openPanel, close, setActive],
  );

  return <TutorialsContext.Provider value={value}>{children}</TutorialsContext.Provider>;
}

export function useTutorials() {
  const ctx = useContext(TutorialsContext);
  if (!ctx) throw new Error("useTutorials must be used within TutorialsProvider");
  return ctx;
}
