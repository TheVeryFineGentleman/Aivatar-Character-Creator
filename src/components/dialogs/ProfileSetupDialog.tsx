/**
 * Projekt-Profil-Dialog. Zwei Modi:
 *  - "create": App-Level-Gate beim ersten profillosen Projekt, überspringbar.
 *  - "edit":   aus dem Projekt-Menü (Umbenennen) — hier lässt sich der Projekt-
 *              NAME und das Profil ändern.
 * Bei Fertigstellen werden Voreinstellungen deterministisch geseedet.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, UserCircle2, Sparkles, Send, Loader2, PencilLine, MessagesSquare } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { SuggestionField } from "@/components/ai/SuggestionField";
import { useProjects } from "@/hooks/useProjects";
import { useProjectProfile } from "@/hooks/useProjectProfile";
import { useSettings } from "@/hooks/useSettings";
import { generateText } from "@/lib/generate";
import { extractJson } from "@/lib/ai";
import { loadProject } from "@/lib/projectStorage";
import { CONTENT_TYPES, PROFILE_VERSION, applyProfileDefaults, type ProjectProfile, type ProfileContentType } from "@/lib/projectProfile";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

const LANGUAGES = ["Deutsch", "English", "Français", "Español", "Italiano"];

/** Die erste Frage steht FEST — sie kostet keinen Aufruf und der Dialog ist
 *  sofort da. Erst die Antwort darauf geht ans Modell. */
const OPENER = "Worum geht es in diesem Projekt? Beschreib einfach in ein, zwei Sätzen, was du hier erstellen willst — ich frage dann nach, was noch fehlt.";

interface ChatMsg { role: "user" | "assistant"; text: string }

export function ProfileSetupDialog({ open, mode = "create", onClose }: { open: boolean; mode?: "create" | "edit"; onClose: () => void }) {
  const { current, rename } = useProjects();
  const [, setProfile] = useProjectProfile();
  const { genChain, hasGenKey } = useSettings();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [contentType, setContentType] = useState<ProfileContentType>("reel");
  const [language, setLanguage] = useState("Deutsch");
  const isEdit = mode === "edit";

  /**
   * Ansicht: Gespräch oder Formular.
   *
   * Beim Anlegen ist das GESPRÄCH der Standard — ein leeres Formular mit vier
   * Feldern beantwortet niemand gern, und die Felder verlangen genau die
   * Verdichtung („Ziel des Projekts in 1–2 Sätzen"), die man am Anfang noch
   * nicht hat. Im Bearbeiten-Modus ist das Formular richtig: dort sind die
   * Werte schon da und sollen gezielt geändert werden, nicht neu erfragt.
   */
  const [view, setView] = useState<"chat" | "form">(isEdit ? "form" : "chat");
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: "assistant", text: OPENER }]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Immer ans Ende scrollen — sonst steht die neue Frage unter der Falz.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  /**
   * Ein Zug im Gespräch: Antwort abschicken, nächste Frage holen — und wenn das
   * Modell genug weiß, die Profilfelder füllen und ins Formular wechseln.
   *
   * Bewusst KEIN stilles Speichern am Ende: der Nutzer sieht, was aus seinen
   * Antworten geworden ist, und drückt selbst auf Speichern. Ein Profil, das
   * sich unbemerkt setzt, steuert danach jeden KI-Vorschlag im Projekt.
   */
  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    if (!hasGenKey) { toast.error("Für das Gespräch wird ein API-Key gebraucht — oder fülle das Formular aus."); return; }
    const next: ChatMsg[] = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setThinking(true);
    try {
      const transcript = next.map((m) => `${m.role === "user" ? "NUTZER" : "DU"}: ${m.text}`).join("\n");
      const raw = await generateText(genChain, {
        json: true,
        temperature: 0.6,
        prompt: `Du führst ein kurzes Aufnahmegespräch für ein Video-/Bild-Projekt. Ziel ist ein Projekt-Profil.
${purpose.trim() ? `
BESTEHENDES PROFIL (der Nutzer will es ÄNDERN, nicht neu erfinden — übernimm alles, was er nicht anspricht):
- Ziel: ${purpose.trim()}
- Content-Typ: ${CONTENT_TYPES.find((c) => c.value === contentType)?.label ?? contentType}
- Sprache: ${language}
` : ""}
BISHERIGES GESPRÄCH:
${transcript}

DEINE AUFGABE:
- Stelle IMMER NUR EINE Frage auf einmal, kurz und konkret, auf Deutsch, per „du".
- Frage nur nach, was für das Profil noch fehlt: Zweck des Projekts, Art des Inhalts, Sprache der fertigen Texte.
- Nach HÖCHSTENS drei Fragen bist du fertig — im Zweifel früher. Niemals mehr fragen, als du brauchst.
- Frage NICHT nach Dingen, die der Nutzer schon beantwortet hat, und niemals nach technischen Einstellungen (Format, Kamera, Modelle).

ANTWORTE NUR MIT JSON:
{
  "reply": "deine nächste Frage — oder, wenn fertig, ein Satz, der das Ergebnis zusammenfasst",
  "done": true|false,
  "purpose": "Ziel des Projekts in 1-2 konkreten Sätzen (nur wenn done=true, sonst leer)",
  "contentType": "einer von: ${CONTENT_TYPES.map((c) => c.value).join(" | ")} (nur wenn done=true)",
  "language": "einer von: ${LANGUAGES.join(" | ")} (nur wenn done=true)",
  "projectName": "kurzer Projektname, 2-4 Wörter (nur wenn done=true)"
}`,
      });
      const p = extractJson<{
        reply?: string; done?: boolean; purpose?: string;
        contentType?: string; language?: string; projectName?: string;
      }>(raw);
      const reply = String(p?.reply || "").trim() || "Alles klar.";
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
      if (p?.done) {
        if (p.purpose?.trim()) setPurpose(p.purpose.trim());
        // Nur bekannte Werte übernehmen — erfindet das Modell einen eigenen,
        // stünde sonst ein ungültiger Typ im Profil und die Voreinstellungen
        // liefen ins Leere.
        if (CONTENT_TYPES.some((c) => c.value === p.contentType)) setContentType(p.contentType as ProfileContentType);
        if (p.language && LANGUAGES.includes(p.language)) setLanguage(p.language);
        if (p.projectName?.trim() && (!name.trim() || name === current?.name)) setName(p.projectName.trim());
        setView("form");
      }
    } catch (e: any) {
      toast.error(e?.message || "Das Gespräch konnte nicht fortgesetzt werden.", {
        description: "Du kannst jederzeit auf „Selbst ausfüllen“ wechseln.",
      });
    } finally {
      setThinking(false);
    }
  };

  // Beim Öffnen aus dem aktuellen Projekt + (falls vorhanden) Profil vorbelegen.
  // Synchron aus dem Storage gelesen, damit der Edit-Modus die echten Werte zeigt.
  useEffect(() => {
    if (!open || !current) return;
    setName(current.name);
    const p = ((loadProject(current.id)?.state as { values?: Record<string, unknown> } | undefined)?.values?.profile) as ProjectProfile | undefined;
    const existing = (p?.purpose ?? "").trim();
    setPurpose(existing);
    setContentType(p?.contentType ?? "reel");
    setLanguage(p?.language ?? "Deutsch");
    // Gespräch bei jedem Öffnen frisch aufsetzen — sonst hinge beim nächsten
    // Projekt noch der Verlauf des vorigen darin.
    //
    // Der EINSTIEG hängt daran, ob schon ein Profil da ist: „Worum geht es in
    // diesem Projekt?" wäre bei einem bestehenden Profil eine Frage, deren
    // Antwort zwei Zentimeter weiter im Formular steht. Stattdessen liest die
    // KI den Stand vor und fragt, was sich ändern soll.
    setMessages([{
      role: "assistant",
      text: existing
        ? `Aktuell steht hier: „${existing}“ (${CONTENT_TYPES.find((c) => c.value === (p?.contentType ?? "reel"))?.label}, ${p?.language ?? "Deutsch"}).\n\nWas soll sich ändern? Beschreib es einfach — oder sag, was dir daran nicht passt.`
        : OPENER,
    }]);
    setInput("");
    setThinking(false);
    // Ohne Profil ist das Gespräch der Einstieg, mit Profil das Formular — dort
    // stehen die Werte schon, und der Weg ins Gespräch ist einen Klick entfernt.
    setView(existing ? "form" : "chat");
  }, [open, current?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit]);

  if (!open || !current) return null;

  const persist = (skipped: boolean) => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== current.name) rename(current.id, trimmed);
    const profile: ProjectProfile = {
      version: PROFILE_VERSION, completed: true, skipped,
      purpose: purpose.trim(), contentType, language, createdAt: Date.now(),
    };
    setProfile(profile);
    if (!skipped) applyProfileDefaults(current.id, profile);
    toast.success(isEdit ? "Gespeichert." : (skipped ? "Ohne Profil weiter." : "Profil gespeichert — KI-Vorschläge & Voreinstellungen passen sich an."));
    onClose();
  };

  // „Später" ist eine ENTSCHEIDUNG: Profil wird als bewusst übersprungen
  // gespeichert und der Dialog kommt nicht wieder.
  const skipForNow = () => (isEdit ? onClose() : persist(true));

  // Wegklicken (Backdrop, X, Escape) ist KEINE Entscheidung — hier wird nichts
  // persistiert, der Dialog erscheint beim nächsten Mal wieder. Vorher lief das
  // auf dasselbe `persist(true)` hinaus: ein versehentlicher Klick daneben hat
  // das Profil dauerhaft stillgelegt (completed=true, skipped=true), der Gate
  // kam nie wieder, und sämtliche KI-Vorschläge liefen ab da ohne Projekt-
  // Kontext — ohne dass irgendwo sichtbar war, warum.
  const dismiss = () => onClose();

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />
      <div className="relative w-[min(560px,100%)] max-h-[calc(100vh-4rem)] overflow-y-auto bg-ink-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl animate-slide-down">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 border-b border-white/5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-flare-500/15 text-flare-300 flex items-center justify-center flex-none">
              <UserCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-ink-50">{isEdit ? "Projekt bearbeiten" : "Projekt-Profil"}</h2>
              <p className="text-sm text-ink-50/55 mt-0.5">
                {isEdit ? "Name und Profil dieses Projekts — steuert Vorschläge & Voreinstellungen." : "Sag der KI kurz, worum es geht — dann passen alle Vorschläge & Voreinstellungen dazu."}
              </p>
            </div>
          </div>
          <button onClick={dismiss} title={isEdit ? "Abbrechen" : "Schließen — Frage kommt später wieder"} className="w-9 h-9 rounded-xl hover:bg-white/5 flex items-center justify-center text-ink-50/60 hover:text-ink-50 flex-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Gespräch ────────────────────────────────────────────────────────
            Der Weg für neue Projekte: die KI fragt, der Nutzer antwortet in
            eigenen Worten. Am Ende füllt sie die Felder und der Dialog wechselt
            ins Formular — sichtbar, überprüfbar, und gespeichert wird erst auf
            Knopfdruck. */}
        {view === "chat" && (
          <div className="p-6 pt-5 space-y-3">
            <div ref={scrollRef} className="max-h-[46vh] overflow-y-auto space-y-2.5 pr-1">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-flare-grad text-pure rounded-br-md"
                      : "bg-white/[0.04] border border-white/8 text-ink-50 rounded-bl-md",
                  )}>
                    {m.text}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.04] border border-white/8 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-ink-50/60 inline-flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> denkt nach …
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                // Enter schickt ab, Shift+Enter macht einen Umbruch — dasselbe
                // Verhalten wie in jedem Chat, damit man nicht zur Maus greift.
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                rows={2}
                placeholder="Deine Antwort…"
                className="flex-1 px-3 py-2 rounded-xl bg-ink-800/60 border border-white/8 text-sm text-ink-50 placeholder:text-ink-50/35 outline-none transition-colors focus:bg-ink-800 focus:border-flare-400/40 resize-none"
              />
              <Button onClick={() => void send()} disabled={!input.trim() || thinking} size="sm" iconLeft={<Send className="w-3.5 h-3.5" />}>
                Senden
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setView("form")}
              className="text-xs text-ink-50/50 hover:text-ink-50 inline-flex items-center gap-1.5 transition-colors"
            >
              <PencilLine className="w-3.5 h-3.5" /> Lieber selbst ausfüllen
            </button>
          </div>
        )}

        {/* Body */}
        {view === "form" && (
        <div className="p-6 space-y-5">
          {/* Auch im Bearbeiten-Modus: ein bestehendes Profil zu ändern ist
              genau der Fall, in dem man lieber sagt „mach daraus eher X", als
              drei Felder von Hand umzuschreiben. Das Gespräch startet dann
              nicht bei null, sondern liest den Stand vor. */}
          <button
            type="button"
            onClick={() => setView("chat")}
            className="text-xs text-flare-300 hover:text-flare-200 inline-flex items-center gap-1.5 transition-colors"
          >
            <MessagesSquare className="w-3.5 h-3.5" />
            {purpose.trim() ? "Per Gespräch ändern" : "Zurück zum Gespräch"}
          </button>
          <div>
            <label className="text-sm font-medium block mb-1.5">Projektname</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Café-Reels Sommer" />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1.5">Was möchtest du in diesem Projekt erstellen?</label>
            <SuggestionField
              as="textarea"
              rows={3}
              value={purpose}
              onChange={setPurpose}
              placeholder="z. B. Kurze, verspielte Werbe-Reels für mein Café auf Instagram"
              emptyHint="Wähle ein Ziel oder schreib dein eigenes…"
              cacheKey={`profile:purpose:${language}:${contentType}`}
              what="das Ziel dieses Projekts — was hier erstellt werden soll"
              shape={`1–2 klare, konkrete Sätze auf ${language}`}
              context={`Content-Typ: ${CONTENT_TYPES.find((c) => c.value === contentType)?.label ?? contentType}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1.5">Content-Typ</label>
              <Select value={contentType} onChange={(e) => setContentType(e.target.value as ProfileContentType)} options={CONTENT_TYPES.map((c) => ({ value: c.value, label: c.label }))} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Sprache</label>
              <Select value={language} onChange={(e) => setLanguage(e.target.value)} options={LANGUAGES.map((l) => ({ value: l, label: l }))} />
            </div>
          </div>

          <p className="text-xs text-ink-50/45 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-flare-300 flex-none" />
            {isEdit ? "Änderungen gelten für dieses Projekt." : "Du kannst das später jederzeit über Umbenennen im Projekt-Menü ändern."}
          </p>
        </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-ink-950/40 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={skipForNow}>{isEdit ? "Abbrechen" : "Später"}</Button>
          {/* Im Gespräch gibt es nichts zu speichern, solange nichts feststeht —
              der Knopf erscheint erst, wenn die KI die Felder gefüllt hat (dann
              steht die Ansicht ohnehin auf „form"). Bis dahin wäre er nur ein
              Angebot, ein leeres Profil zu sichern. */}
          {view === "form" && (
            <Button onClick={() => persist(false)} disabled={!isEdit && !purpose.trim()}>{isEdit ? "Speichern" : "Profil speichern"}</Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
