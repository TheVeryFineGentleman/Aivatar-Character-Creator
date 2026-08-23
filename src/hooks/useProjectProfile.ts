/**
 * Liest/schreibt das Projekt-Profil, projekt-scoped und reaktiv — dünne
 * Hülle über useProjectValue (persistiert unter state.values.profile).
 * Überall nutzbar: App-Gate, jede Seite, jeder Vorschlags-Prompt.
 */
import { useProjectValue } from "@/hooks/useProjectGallery";
import type { ProjectProfile } from "@/lib/projectProfile";

export function useProjectProfile() {
  return useProjectValue<ProjectProfile | null>("profile", null);
}
