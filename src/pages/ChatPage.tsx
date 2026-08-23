import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users, Send, RefreshCw, Sparkles, CheckCircle2, MessageSquare,
  Trash2, ChevronDown, ChevronUp, Loader2, ImageDown, Shuffle, Plus, Pencil, X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/Shell";
import { TutorialCTA } from "@/components/tutorials/TutorialCTA";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Slider } from "@/components/ui/Slider";
import { Select } from "@/components/ui/Select";
import { PlanGate } from "@/components/PlanGate";
import { ImageGrid, type ImageSlot } from "@/components/ImageGrid";
import { MultiDownloadButton } from "@/components/DownloadButton";
import { ASPECT_RATIOS, aspectClass } from "@/lib/aspectRatio";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useProjectGallery, useProjectValue } from "@/hooks/useProjectGallery";
import { useFieldSuggestions } from "@/hooks/useFieldSuggestions";
import { AIError } from "@/lib/ai";
import { generateImage } from "@/lib/generate";
import { buildChatPrompts } from "@/lib/characterPrompt";
import { uid } from "@/lib/uid";
import { cn } from "@/lib/cn";

interface QA {
  id: number;
  question: string;
  hint?: string;
}

const QUESTIONS: QA[] = [
  { id: 1,  question: "Welches Geschlecht hat dein Charakter?",       hint: "z. B. weiblich, männlich, divers" },
  { id: 2,  question: "Welche Nationalität oder Herkunft?",            hint: "Beeinflusst Hauttöne und Gesichtszüge" },
  { id: 3,  question: "Wie alt ist dein Charakter?",                   hint: "ungefähre Altersangabe genügt" },
  { id: 4,  question: "Welche Haarlänge?",                              hint: "kurz / schulterlang / lang / extrem lang" },
  { id: 5,  question: "Welche Haarfarbe?",                              hint: "blond, braun, schwarz, rot, gefärbt…" },
  { id: 6,  question: "Welche Haarstruktur?",                          hint: "glatt, wellig, lockig, krausig" },
  { id: 7,  question: "Welche Hautfarbe?",                              hint: "sehr hell bis sehr dunkel — natürlich beschreiben" },
  { id: 8,  question: "Welche Augenfarbe?",                              hint: "blau, grün, braun, grau, haselnuss…" },
  { id: 9,  question: "Wie ist der Körperbau?",                          hint: "schlank, athletisch, muskulös, kurvig…" },
  { id: 10, question: "Welcher Gesichtsausdruck?",                      hint: "fröhlich, ernst, neutral, melancholisch…" },
  { id: 11, question: "Gibt es besondere Merkmale?",                   hint: "Sommersprossen, Brille, Tattoos, Narbe, Bart…" },
  { id: 12, question: "Welcher visueller Stil?",                       hint: "realistisch, cinematic, anime, cartoon…" },
  { id: 13, question: "Welche Farbpalette oder Stimmung?",            hint: "warm, kühl, neutral, dramatisch…" },
];

// Clickable example answers per question — a click fills the chat bar (does not send).
// 3 are shown at a time, freshly drawn each question (and re-rollable).
const SUGGESTIONS: Record<number, string[]> = {
  1:  ["Männlich", "Weiblich", "Divers"],
  2:  ["Deutsch", "Italienisch", "Japanisch", "Brasilianisch", "Nigerianisch", "Indisch", "Französisch", "Koreanisch", "Türkisch", "Spanisch", "Ägyptisch", "US-amerikanisch", "Russisch", "Mexikanisch"],
  3:  ["Anfang 20", "Ende 20", "Mitte 30", "Anfang 40", "Mitte 50", "18 Jahre", "60+", "Mitte 20", "Anfang 30"],
  4:  ["Kurz", "Mittellang", "Lang", "Sehr lang", "Schulterlang", "Glatze"],
  5:  ["Schwarz", "Braun", "Blond", "Rot", "Grau", "Platinblond", "Dunkelbraun", "Kupfer", "Bunt"],
  6:  ["Glatt", "Wellig", "Lockig", "Krause", "Seitenscheitel", "Mittelscheitel"],
  7:  ["Hell", "Mittel", "Olive", "Gebräunt", "Dunkel", "Sehr hell", "Bronze"],
  8:  ["Braun", "Blau", "Grün", "Grau", "Haselnuss", "Bernstein", "Dunkelbraun"],
  9:  ["Schlank", "Athletisch", "Durchschnitt", "Kräftig", "Muskulös", "Zierlich", "Kurvig"],
  10: ["Selbstbewusstes Lächeln", "Nachdenklich", "Neutral", "Freundlich", "Ernst", "Verträumt", "Entschlossen"],
  11: ["Keine", "Sommersprossen", "Brille", "Bart", "Tattoos", "Narbe", "Piercings", "Muttermal"],
  12: ["Realistisch", "Anime", "Comic", "Pixar / 3D", "Cartoon", "Aquarell", "Cyberpunk"],
  13: ["Warm", "Kalt", "Neon", "Pastell", "Dunkel / Noir", "Natürlich"],
};

function pick3(pool: string[] | undefined): string[] {
  if (!pool) return [];
  if (pool.length <= 3) return [...pool];
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 3);
}

interface Message {
  role: "ai" | "user";
  text: string;
}

export default function ChatPage() {
  const { genChain, hasGenKey, missingKeyMessage } = useSettings();
  const { plan } = useAuth();

  const [answers, setAnswers] = useProjectValue<Record<number, string>>("chat:answers", {});
  const [step, setStep] = useProjectValue("chat:step", 0);
  const [input, setInput] = useState("");
  const [count, setCount] = useProjectValue("chat:count", 4);
  const [aspect, setAspect] = useProjectValue("chat:aspect", "4:5");
  const [slots, setSlots] = useProjectGallery("chat");
  const [running, setRunning] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [fallbackSuggestions, setFallbackSuggestions] = useState<string[]>(() => pick3(SUGGESTIONS[QUESTIONS[0].id]));
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Alle 13 Fragen in EINEM Lauf — die KI sieht das Projekt-Profil und schlägt
  // Antworten vor, die zum Thema passen (bei „Fitness-Reels" ein anderer Körperbau
  // als bei „Kinderbuch"). Die statische Liste oben bleibt als Rückfall, wenn kein
  // Key gesetzt ist oder der Lauf nichts liefert — Vorschläge stehen also immer.
  const aiSuggest = useFieldSuggestions(
    "chat:answers",
    QUESTIONS.map((q) => ({
      key: String(q.id),
      what: q.question.replace(/^Welche[rs]? |^Wie |^Gibt es /, "").replace(/\?$/, ""),
      shape: "1–3 Wörter",
    })),
    { context: "Es entsteht EIN Charakter — die Vorschläge aller Felder müssen zu derselben Person passen." },
  );

  // Fresh suggestions whenever the current question changes.
  useEffect(() => {
    const q = QUESTIONS[step];
    setFallbackSuggestions(q ? pick3(SUGGESTIONS[q.id]) : []);
  }, [step]);

  const currentQuestion = QUESTIONS[step];
  const aiForStep = currentQuestion ? aiSuggest.get(String(currentQuestion.id)) : [];
  const suggestions = aiForStep.length > 0 ? aiForStep : fallbackSuggestions;

  // Nur die Vorschläge der SICHTBAREN Frage neu holen. Vorher zog der Knopf die
  // Antworten aller 13 Fragen neu — ein voller Gruppen-Call für eine Frage.
  const rerollSuggestions = () => {
    if (currentQuestion && (aiForStep.length > 0 || aiSuggest.hasGenKey)) {
      aiSuggest.reroll(String(currentQuestion.id));
    }
    if (currentQuestion) setFallbackSuggestions(pick3(SUGGESTIONS[currentQuestion.id]));
  };

  const applySuggestion = (text: string) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const messages: Message[] = useMemo(() => {
    const m: Message[] = [
      { role: "ai", text: "Hallo, hier ist dein KI-Avatar Character Creator Assistent. Ich stelle dir 13 kurze Fragen — daraus entsteht dein Charakter.\n\nLos geht's!" },
    ];
    for (let i = 0; i <= Math.min(step, QUESTIONS.length - 1); i++) {
      m.push({ role: "ai", text: `Frage ${i + 1}/13 — ${QUESTIONS[i].question}` });
      const ans = answers[QUESTIONS[i].id];
      if (ans) m.push({ role: "user", text: ans });
    }
    if (step >= QUESTIONS.length) {
      m.push({ role: "ai", text: "Alle Antworten gesammelt. Stell die Anzahl der Varianten ein und starte die Generierung." });
    }
    return m;
  }, [step, answers]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // When the user clicks "Bearbeiten" in the review overview we drop back to
  // that one question; after saving we return to the overview instead of
  // marching on to the next question.
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);

  const submitAnswer = () => {
    if (!input.trim()) return;
    const q = QUESTIONS[step];
    setAnswers((a) => ({ ...a, [q.id]: input.trim() }));
    setInput("");
    if (editingQuestionId !== null) {
      // Single-question edit → jump back to the overview.
      setEditingQuestionId(null);
      setStep(QUESTIONS.length);
    } else {
      setStep((s) => s + 1);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const reset = () => {
    setAnswers({}); setStep(0); setInput(""); setSlots([]); setChatOpen(true);
    setEditingQuestionId(null);
  };

  const editAnswer = (questionId: number) => {
    const idx = QUESTIONS.findIndex((q) => q.id === questionId);
    if (idx < 0) return;
    setEditingQuestionId(questionId);
    setStep(idx);
    setInput(answers[questionId] || "");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditingQuestionId(null);
    setInput("");
    setStep(QUESTIONS.length);
  };

  const reviewComplete = step >= QUESTIONS.length;

  const generate = async (mode: "append" | "replace" = "append") => {
    if (!hasGenKey) {
      toast.error(missingKeyMessage ?? "Bitte hinterlege zuerst deine API-Keys.", {
        description: "Google und fal.ai sind beide Pflicht — beide in den Einstellungen eintragen.",
      });
      return;
    }
    const limit = plan.maxImagesPerRun === -1 ? count : Math.min(count, plan.maxImagesPerRun);
    const fresh: ImageSlot[] = Array.from({ length: limit }, () => ({ id: uid(), status: "loading" as const }));
    setSlots((prev) => mode === "replace" ? fresh : [...prev, ...fresh]);
    setRunning(true);
    setChatOpen(false);

    const prompts = buildChatPrompts(answers, limit);

    await Promise.all(fresh.map(async (slot, i) => {
      try {
        const prompt = prompts[i];
        const dataUrl = await generateImage(genChain, { prompt, aspectRatio: aspect });
        setSlots((s) => s.map((x) => x.id === slot.id ? { ...x, status: "done", dataUrl } : x));
      } catch (e: any) {
        const err = e instanceof AIError ? e : new AIError("UNKNOWN", e.message || "Fehler");
        setSlots((s) => s.map((x) => x.id === slot.id ? { ...x, status: "error", error: err.message, errorHint: err.hint } : x));
      }
    }));
    setRunning(false);
  };

  return (
    <PlanGate requires="premium" feature="Der KI-Chat Charakter-Creator">
      <PageHeader
        title="KI-Chat Charakter-Creator"
        subtitle="13 Fragen. Eine pro Antwort. Am Ende fertige Prompts und Bilder."
        badge={<Badge tone="cool"><Users className="w-3 h-3" /> Premium-Modus</Badge>}
        action={<Button variant="secondary" size="sm" iconLeft={<RefreshCw className="w-3.5 h-3.5" />} onClick={reset}>Neu starten</Button>}
        cta={<TutorialCTA tutorialId="chat" />}
      />

      {/* ── Collapsible chat — Projekt-style, narrower ── */}
      <Card padded={false} className="overflow-hidden animate-fade-in max-w-3xl mx-auto">
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-flare-300" />
            Chat {messages.length > 1 && `(${messages.length - 1} Nachrichten)`}
            {reviewComplete && <CheckCircle2 className="w-4 h-4 text-success ml-1" />}
          </span>
          {chatOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <div className={cn(
          "grid transition-all duration-300 ease-in-out",
          chatOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}>
          <div className="overflow-hidden">
            <div className="p-5 space-y-4">
              {/* Progress bar */}
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-flare-grad transition-all duration-500"
                  style={{ width: `${(Math.min(step, QUESTIONS.length) / QUESTIONS.length) * 100}%` }}
                />
              </div>

              {/* Messages list */}
              <div ref={scrollRef} className="overflow-y-auto space-y-3 pr-1 max-h-[380px]">
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
                {running && (
                  <div className="flex justify-start">
                    <div className="bg-white/[0.04] border border-white/8 rounded-2xl rounded-bl-md px-4 py-2.5">
                      <Loader2 className="w-4 h-4 animate-spin text-ink-50/55" />
                    </div>
                  </div>
                )}
              </div>

              {/* Answer input + clickable example chips */}
              {!reviewComplete && (
                <div className="space-y-2">
                  {suggestions.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] text-ink-50/45">Vorschläge:</span>
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => applySuggestion(s)}
                          className="px-2.5 py-1 rounded-full text-xs border border-white/10 bg-white/[0.04] text-ink-50/80 hover:border-flare-400/40 hover:text-flare-200 hover:bg-flare-500/10 transition-colors active:scale-[0.97]"
                          title="In die Eingabe übernehmen"
                        >
                          {s}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={rerollSuggestions}
                        title="Andere Vorschläge"
                        className="w-6 h-6 inline-flex items-center justify-center rounded-full text-ink-50/45 hover:text-ink-50 hover:bg-white/5 transition-colors"
                      >
                        <Shuffle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {editingQuestionId !== null && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-flare-500/10 border border-flare-400/30 text-flare-200 text-[11px]">
                      <Pencil className="w-3 h-3" />
                      Antwort bearbeiten — Senden übernimmt, Abbrechen verwirft.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      placeholder={QUESTIONS[step]?.hint || "Deine Antwort…"}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitAnswer();
                        if (e.key === "Escape" && editingQuestionId !== null) cancelEdit();
                      }}
                      className="flex-1"
                    />
                    {editingQuestionId !== null && (
                      <Button variant="ghost" onClick={cancelEdit} title="Bearbeitung abbrechen">
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                    <Button onClick={submitAnswer} disabled={!input.trim()} iconRight={<Send className="w-4 h-4" />}>
                      {editingQuestionId !== null ? "Übernehmen" : "Senden"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Final step — Review-Übersicht + Generierungs-Controls */}
              {reviewComplete && (
                <div className="space-y-4 pt-3 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold flex items-center gap-2 text-success">
                      <CheckCircle2 className="w-4 h-4" /> Deine Antworten — bei Bedarf anpassen
                    </div>
                    <span className="text-[11px] text-ink-50/45">{QUESTIONS.length} Fragen</span>
                  </div>

                  {/* Review list — eine Zeile pro Frage, Edit-Button beim Hover. */}
                  <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1 -mr-1">
                    {QUESTIONS.map((q, i) => {
                      const ans = answers[q.id]?.trim();
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => editAnswer(q.id)}
                          className="group w-full flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/8 hover:border-flare-400/30 hover:bg-flare-500/[0.04] transition-colors text-left"
                          title="Antwort bearbeiten"
                        >
                          <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-ink-950/70 border border-white/10 flex items-center justify-center text-[10px] font-semibold text-ink-50/70">
                            {i + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-ink-50/55 leading-tight">{q.question}</div>
                            <div className={cn(
                              "text-sm truncate mt-0.5",
                              ans ? "text-ink-50" : "italic text-ink-50/40",
                            )}>
                              {ans || "— keine Angabe —"}
                            </div>
                          </div>
                          <Pencil className="shrink-0 w-3.5 h-3.5 text-ink-50/35 group-hover:text-flare-300 transition-colors mt-1" />
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Format" value={aspect} onChange={(e) => setAspect(e.target.value)} options={ASPECT_RATIOS.map((a) => ({ value: a.value, label: a.label }))} />
                    <Slider
                      label="Varianten"
                      valueLabel={`${count}${plan.maxImagesPerRun > 0 ? ` / ${plan.maxImagesPerRun}` : ""}`}
                      min={1}
                      max={plan.maxImagesPerRun === -1 ? 10 : plan.maxImagesPerRun}
                      value={count}
                      onChange={(e) => setCount(parseInt(e.target.value))}
                    />
                  </div>
                  {/* Generate row: small "Neu generieren" (replace) left, wide "dazu generieren" (append) right */}
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => generate("replace")}
                      disabled={running}
                      iconLeft={<RefreshCw className="w-4 h-4" />}
                      title="Vorhandene ersetzen und neu generieren"
                    >
                      Neu generieren
                    </Button>
                    <Button
                      onClick={() => generate("append")}
                      loading={running}
                      className="flex-1"
                      iconLeft={<Sparkles className="w-4 h-4" />}
                    >
                      {running ? "Generiere…" : slots.length > 0 ? `${count} dazu generieren` : `${count} Charaktere generieren`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Gallery below ── */}
      <div className="mt-6">
        {slots.length === 0 ? (
          <div className="text-center py-16 text-sm text-ink-50/50 flex flex-col items-center gap-2">
            <ImageDown className="w-10 h-10 text-ink-50/25" />
            Erst chatten, dann generieren.
            <div className="text-xs text-ink-50/35">Beantworte die 13 Fragen oben.</div>
          </div>
        ) : (
          <div className="space-y-3 animate-slide-in-right">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-lg font-bold tracking-tight">Generierte Bilder</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-50/55">{slots.length} Bild{slots.length === 1 ? "" : "er"}</span>
                <MultiDownloadButton
                  images={slots
                    .filter((s) => s.status === "done" && s.dataUrl)
                    .map((s, i) => ({ dataUrl: s.dataUrl!, filename: s.filename || `chat-character-${i + 1}.png` }))}
                  zipName="chat-character-collection.zip"
                />
                <Button onClick={() => setSlots([])} variant="ghost" size="sm" iconLeft={<Trash2 className="w-3.5 h-3.5" />}>Leeren</Button>
              </div>
            </div>
            <ImageGrid slots={slots} aspectClass={aspectClass(aspect)} filenamePrefix="chat-character" />

            {/* Add more characters without scrolling back up to the chat. */}
            <Button
              onClick={() => generate("append")}
              disabled={running || !hasGenKey}
              fullWidth
              size="lg"
              iconLeft={running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
            >
              {running ? "Generiere…" : "Bilder hinzufügen"}
            </Button>
          </div>
        )}
      </div>
    </PlanGate>
  );
}
