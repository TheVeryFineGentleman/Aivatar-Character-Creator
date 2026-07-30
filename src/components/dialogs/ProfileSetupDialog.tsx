/**
 * Projekt-Profil-Setup — erscheint beim Erstellen/Öffnen eines Projekts ohne
 * Profil (App-Level-Gate). Überspringbar („Später"). Kompakt: Ziel + Content-Typ
 * + Sprache. Auf Fertigstellen werden Voreinstellungen deterministisch geseedet.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, UserCircle2, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { AiSuggestButton } from "@/components/ai/AiSuggestButton";
import { useProjects } from "@/hooks/useProjects";
import { useProjectProfile } from "@/hooks/useProjectProfile";
import { CONTENT_TYPES, applyProfileDefaults, type ProjectProfile, type ProfileContentType } from "@/lib/projectProfile";
import { toast } from "sonner";

const LANGUAGES = ["Deutsch", "English", "Français", "Español", "Italiano"];

export function ProfileSetupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { current } = useProjects();
  const [, setProfile] = useProjectProfile();
  const [purpose, setPurpose] = useState("");
  const [contentType, setContentType] = useState<ProfileContentType>("reel");
  const [language, setLanguage] = useState("Deutsch");

  useEffect(() => {
    if (open) { setPurpose(""); setContentType("reel"); setLanguage("Deutsch"); }
  }, [open, current?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && save(true);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !current) return null;

  const save = (skipped: boolean) => {
    const profile: ProjectProfile = {
      version: 1,
      completed: true,
      skipped,
      purpose: purpose.trim(),
      contentType,
      language,
      createdAt: Date.now(),
    };
    setProfile(profile);
    if (!skipped) {
      applyProfileDefaults(current.id, profile);
      toast.success("Profil gespeichert — KI-Vorschläge & Voreinstellungen passen sich jetzt an.");
    }
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => save(true)} />
      <div className="relative w-[min(560px,100%)] max-h-[calc(100vh-4rem)] overflow-y-auto bg-ink-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl animate-slide-down">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 border-b border-white/5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-flare-500/15 text-flare-300 flex items-center justify-center flex-none">
              <UserCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink-50">Projekt-Profil</h2>
              <p className="text-sm text-ink-50/55 mt-0.5">
                Sag der KI kurz, worum es geht — dann passen alle Vorschläge & Voreinstellungen dazu.
              </p>
            </div>
          </div>
          <button
            onClick={() => save(true)}
            title="Überspringen"
            className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-ink-50/60 hover:text-ink-50 flex-none"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="text-sm font-medium">Was möchtest du in diesem Projekt erstellen?</label>
              <AiSuggestButton
                label="Ausformulieren"
                buildPrompt={() =>
                  `Formuliere aus dieser kurzen Notiz ein klares, konkretes Projekt-Ziel (1-2 Sätze, auf ${language}): "${purpose || contentType}". Antworte NUR mit dem Zieltext, ohne Anführungszeichen.`
                }
                onApply={setPurpose}
              />
            </div>
            <Textarea
              rows={3}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="z. B. Kurze, verspielte Werbe-Reels für mein Café auf Instagram"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Content-Typ</label>
              <Select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as ProfileContentType)}
                options={CONTENT_TYPES.map((c) => ({ value: c.value, label: c.label }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Sprache</label>
              <Select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                options={LANGUAGES.map((l) => ({ value: l, label: l }))}
              />
            </div>
          </div>

          <p className="text-xs text-ink-50/45 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-flare-300 flex-none" />
            Du kannst das Profil später jederzeit ändern — es steuert nur Vorschläge & Voreinstellungen.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-ink-950/40 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => save(true)}>Später</Button>
          <Button onClick={() => save(false)} disabled={!purpose.trim()}>Profil speichern</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
