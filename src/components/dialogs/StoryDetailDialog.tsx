import { useEffect, useRef, useState } from "react";
import { RefreshCw, Download, AlertTriangle, Sparkles, Check, Wand2, Loader2, Send, Users } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { SlotProgress } from "@/components/ui/SlotProgress";
import { SuggestionField } from "@/components/ai/SuggestionField";
import { useFieldSuggestions } from "@/hooks/useFieldSuggestions";
import { cn } from "@/lib/cn";
import { ResolutionDownloadMenu } from "@/components/ResolutionDownloadMenu";
import {
  STORY_CAMERA_ANGLES, STORY_SHOT_TYPES, STORY_COMPOSITIONS,
  STORY_MOVEMENTS, STORY_AUDIENCE_EFFECTS, VOICE_DELIVERIES,
  type StoryScene, type SceneChatTurn,
} from "@/lib/storyPrompts";

interface Props {
  open: boolean;
  scene: StoryScene | null;
  sceneIndex: number;
  aspectClass: string;
  onClose: () => void;
  onUpdate: (patch: Partial<StoryScene>) => void;
  onRegenerate: () => void;
  /**
   * Läuft diese Szene als DUO-BILD (beide Personen nebeneinander)?
   *
   * Muss hier ankommen, weil in diesem Fall die halbe Maske des Dialogs
   * wirkungslos ist: Der Duo-Pfad schreibt den Aufbau fest (beide STEHEND, je
   * eine Bildhälfte) und liest die Detail-Beschreibung überhaupt nicht — die
   * Schlüssel-Aktion färbt nur Stimmung und Gesicht. Wer hier „Leo liegt auf dem
   * Boden" einträgt, bekommt danach exakt dasselbe Bild und keinerlei Hinweis,
   * warum. Genau das ist passiert (Nutzerbefund 2026-08-16).
   */
  isDuo?: boolean;
  /** Umschalter auf „nur Sprecher" — nur gesetzt, wo Duo überhaupt möglich ist. */
  onToggleDuo?: () => void;
  /**
   * Ein Zug im Gespräch mit dem Szenen-Assistenten.
   *
   * Er bekommt das GANZE bisherige Gespräch, nicht nur die letzte Nachricht:
   * seine Rückfragen ergeben sonst keinen Sinn, weil er die Antwort darauf nicht
   * mehr im Zusammenhang sähe. `force` heisst „Jetzt ändern" — dann wird nicht
   * mehr gefragt, sondern umgesetzt.
   *
   * Die eigentliche Arbeit liegt bewusst in StoryPage — nur dort stehen Profil,
   * Idee, Look, Besetzung und die übrigen Szenen, und genau dieser Kontext ist
   * der Grund, warum der Assistent mehr kann als „Feld neu würfeln".
   */
  onAssist?: (
    history: SceneChatTurn[],
    force: boolean,
  ) => Promise<{ action: "ask" | "apply"; message: string; changedLabels: string[] } | null>;
}

/** Eine Nachricht im Chatfenster. `applied` ist die ausgeführte Änderung — sie
 *  sieht anders aus als eine gewöhnliche Antwort, weil sie eine ist. */
type ChatMsg =
  | { role: "user"; text: string }
  | { role: "ai"; text: string }
  | { role: "applied"; text: string; labels: string[] };

export function StoryDetailDialog({ open, scene, sceneIndex, aspectClass, onClose, onUpdate, onRegenerate, onAssist, isDuo, onToggleDuo }: Props) {
  const [draft, setDraft] = useState<StoryScene | null>(scene);
  /** Der Wunsch, den der Nutzer gerade tippt. */
  const [assistInput, setAssistInput] = useState("");
  const [assisting, setAssisting] = useState(false);
  /**
   * DAS GESPRÄCH ÜBER DIESE SZENE — älteste Nachricht zuerst, wie in jedem Chat.
   *
   * Es trägt die Höhe des angedockten Panels: leer ist die Fläche eine
   * Ankündigung, gefüllt ist sie der Beleg dafür, was hier verstellt wurde.
   * Ein einzelner Auftrag mit einer einzelnen Antwort hätte das nicht getragen —
   * und vor allem könnte der Assistent dann nicht nachfragen, wenn ihm für ein
   * gutes Ergebnis etwas fehlt.
   */
  const [chat, setChat] = useState<ChatMsg[]>([]);
  /** Ans Ende springen, sobald etwas dazukommt — sonst wächst das Gespräch
   *  unsichtbar unter dem Rand weiter. */
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(scene);
  }, [scene]);

  // Andere Szene geöffnet → das Gespräch der vorigen gehört nicht mehr dazu.
  // Es dreht sich um genau EINE Szene, und die Rückfragen darin wären für eine
  // andere schlicht falsch.
  useEffect(() => {
    setAssistInput("");
    setChat([]);
  }, [scene?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [chat, assisting]);

  // Vorschläge für die Textfelder dieser Szene — ein Lauf für alle, damit
  // Aktion, Emotion und Dialog derselben Szene folgen und nicht drei
  // unabhängige Erfindungen sind. Gecacht pro Szene, `auto` erst wenn der
  // Dialog wirklich offen ist (er hängt dauerhaft im Baum).
  // Muss VOR dem frühen Return stehen — Hooks laufen in jedem Render.
  const suggest = useFieldSuggestions(
    `story:scene:${scene?.id ?? "none"}`,
    [
      { key: "detailedDescription", what: "was in dieser Szene passiert — wer im Bild ist und was getan wird", shape: "2–3 Sätze", current: draft?.detailedDescription },
      { key: "specificArea", what: "der genaue Bereich/Sub-Ort innerhalb des Hauptorts", shape: "wenige Worte", current: draft?.specificArea },
      { key: "keyAction", what: "die zentrale Geste oder Aktion der Szene", shape: "wenige Worte", current: draft?.keyAction },
      { key: "emotion", what: "die Emotion, die die Szene trägt", shape: "ein bis zwei Wörter", current: draft?.emotion },
      { key: "dialogText", what: "der gesprochene Satz dieser Szene", shape: "EIN Satz, sprechbar", current: draft?.dialogText },
    ],
    {
      auto: open && !!scene,
      context: [
        `Szene ${sceneIndex + 1}${draft?.summary ? `: „${draft.summary}"` : ""}.`,
        draft?.participants ? `Beteiligte: ${draft.participants}` : "",
      ].filter(Boolean).join("\n"),
    },
  );

  if (!scene || !draft) return null;

  // In-session base64, or the durable bucket URL after a reload.
  const imgSrc = draft.imageDataUrl || draft.imageUrl;

  const patch = (p: Partial<StoryScene>) => {
    setDraft((d) => (d ? { ...d, ...p } : d));
    onUpdate(p);
  };

  /**
   * ES DARF IMMER NUR EINES LAUFEN.
   *
   * `draft` folgt der echten Szene (der `useEffect` oben zieht jede Änderung
   * nach), die Zustände hier sind also live und nicht bloss eine Kopie vom
   * Öffnen des Dialogs. Der Assistent zählt mit hinein: er ENDET mit einem
   * Bildlauf, ein zweiter Klick daneben würde also zwei bezahlte Bilder für
   * dieselbe Szene starten. Die eigentliche Sperre sitzt weiterhin in
   * StoryPage (`generationBlocked` + `claimScene`) — hier steht, was der Nutzer
   * davon sieht.
   */
  const imageRunning = draft.imageStatus === "loading";
  const videoRunning = draft.videoStatus === "loading";
  const voiceRunning = draft.audioStatus === "loading";
  const endImageRunning = draft.endImageStatus === "loading";
  const sceneBusy = imageRunning || videoRunning || voiceRunning || endImageRunning || assisting;
  const busyReason =
    assisting ? "Der Assistent arbeitet gerade an dieser Szene."
    : imageRunning ? "Das Bild wird gerade erzeugt — es läuft immer nur eine Generierung."
    : videoRunning ? "Das Video rendert gerade — währenddessen lässt sich das Bild nicht neu erzeugen."
    : voiceRunning ? "Die Vertonung läuft gerade."
    : endImageRunning ? "Es wird gerade ein Bild dieser Szene erzeugt."
    : undefined;

  /**
   * EIN ZUG IM GESPRÄCH.
   *
   * `force` ist der Knopf „Jetzt ändern": dann darf der Assistent nicht mehr
   * fragen. Ohne ihn entscheidet er selbst, ob er noch eine Sache wissen will
   * oder schon genug hat.
   *
   * Der Verlauf wird VOR dem Aufruf zusammengebaut und mitgegeben, statt sich
   * auf den State zu verlassen: `setChat` ist asynchron, und der Aufruf würde
   * sonst die gerade getippte Nachricht noch nicht enthalten.
   */
  const sendTurn = async (text: string, force: boolean) => {
    if (!onAssist || sceneBusy) return;
    const next: ChatMsg[] = text ? [...chat, { role: "user", text }] : [...chat];
    if (text) setChat(next);
    setAssistInput("");
    setAssisting(true);
    try {
      // Ausgeführte Änderungen gehen als Assistenten-Nachrichten mit — der
      // Assistent muss wissen, was er schon getan hat, sonst macht er es beim
      // nächsten Zug ein zweites Mal.
      const history: SceneChatTurn[] = next.map((m) => ({
        role: m.role === "user" ? "user" : "ai",
        text: m.role === "applied"
          ? `[Änderung ausgeführt] ${m.text}${m.labels.length ? ` (geändert: ${m.labels.join(", ")})` : ""}`
          : m.text,
      }));
      if (force) {
        history.push({ role: "user", text: "Setz es jetzt um — keine Rückfragen mehr." });
      }
      const res = await onAssist(history, force);
      if (!res) return;
      setChat((c) => [
        ...c,
        res.action === "apply"
          ? { role: "applied", text: res.message, labels: res.changedLabels }
          : { role: "ai", text: res.message },
      ]);
    } finally {
      setAssisting(false);
    }
  };

  const runAssist = () => {
    const wish = assistInput.trim();
    if (!wish) return;
    void sendTurn(wish, false);
  };

  /** „Jetzt ändern" — mit dem, was gerade im Feld steht, sonst mit dem Gespräch
   *  allein. Erlaubt keine weitere Rückfrage. */
  const applyNow = () => void sendTurn(assistInput.trim(), true);

  // ══ DIE BAUSTEINE DES ASSISTENTEN ═════════════════════════════════════════
  //
  // Einmal gebaut, in zwei Anordnungen verwendet (angedockt / eingeklappt) —
  // zweimal geschrieben würde eine der beiden früher oder später veralten.

  /** Das Eingabefeld. Behält IMMER seine natürliche Höhe von drei Zeilen.
   *
   *  Es vorher auf die volle Panelhöhe zu dehnen war der Fehler: aus dem Feld
   *  wurde ein leeres Rechteck über die halbe Seite, mit drei Vorschlägen oben
   *  und nichts darunter — und der Knopf stand dadurch eine Handbreit vom Feld
   *  entfernt am unteren Rand. Höhe füllt jetzt der Verlauf, nicht das Feld. */
  const assistField = (
    <SuggestionField
      as="textarea"
      rows={3}
      value={assistInput}
      onChange={setAssistInput}
      disabled={sceneBusy}
      onKeyDown={(e) => {
        // Enter schickt ab, Shift+Enter macht eine Zeile — dasselbe Verhalten
        // wie beim KI-Assistenten in Schritt 3.
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          void runAssist();
        }
      }}
      placeholder='z.B. „Frame nur von den Schultern aufwärts" oder „Tim soll nicht im Bild sein"'
      emptyHint="Wähle einen Auftrag oder schreib deinen eigenen…"
      // Vorschläge als AUFTRÄGE, nicht als Feldinhalte: hier steht, was die KI
      // tun soll, nicht was in einem Feld landen soll.
      kind="instruction"
      cacheKey={`story:sceneAssist:${scene.id}`}
      what="eine Änderung an dieser Storyboard-Szene"
      shape="höchstens 8 Wörter, Imperativ"
      context={[
        `Szene ${sceneIndex + 1}${draft.summary ? `: „${draft.summary}"` : ""}.`,
        draft.detailedDescription ? `Beschreibung: ${draft.detailedDescription.slice(0, 300)}` : "",
        draft.participants ? `Im Bild: ${draft.participants}` : "",
        draft.shotType ? `Aktuelle Einstellung: ${draft.shotType}` : "",
        "Vorschläge sind Änderungswünsche an Bildausschnitt, Kamera, Handlung, Emotion oder Zeile.",
      ].filter(Boolean).join("\n")}
    />
  );

  /** Es gibt etwas zu übernehmen, sobald der Nutzer einmal etwas gesagt hat —
   *  oder gerade etwas im Feld steht. Vorher wäre „Jetzt ändern" ein Knopf ohne
   *  Gegenstand. */
  const canApplyNow = chat.some((m) => m.role === "user") || !!assistInput.trim();

  /** Die zwei Knöpfe: schicken und übernehmen.
   *
   *  Getrennt, weil sie verschiedene Dinge tun — „Senden" führt das Gespräch
   *  weiter und lässt den Assistenten entscheiden, „Jetzt ändern" beendet es.
   *  Ein einziger Knopf müsste eines von beidem heimlich mitmachen. */
  const assistButtons = (
    <div className="flex gap-2">
      <Button
        size="sm"
        className="flex-1"
        onClick={runAssist}
        loading={assisting}
        disabled={!assistInput.trim() || sceneBusy}
        title={busyReason ?? "An den Assistenten schicken — er fragt nach oder setzt es um"}
        iconLeft={<Send className="w-3.5 h-3.5" />}
      >
        {assisting ? "Arbeitet…" : "Senden"}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        className="flex-none"
        onClick={applyNow}
        disabled={!canApplyNow || sceneBusy}
        title={busyReason ?? "Ohne weitere Rückfrage übernehmen — was noch offen ist, nimmt der Assistent an"}
        iconLeft={<Wand2 className="w-3.5 h-3.5" />}
      >
        Jetzt ändern
      </Button>
    </div>
  );

  /** Eine Nachricht im Chat. */
  const chatBubble = (m: ChatMsg, key: number) => {
    if (m.role === "user") {
      return (
        <div key={key} className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-flare-500/15 border border-flare-400/25 px-3 py-2 text-[11px] text-ink-50/90 leading-relaxed whitespace-pre-wrap">
            {m.text}
          </div>
        </div>
      );
    }
    if (m.role === "ai") {
      return (
        <div key={key} className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-ink-950/60 border border-white/8 px-3 py-2 text-[11px] text-ink-50/75 leading-relaxed whitespace-pre-wrap">
            {m.text}
          </div>
        </div>
      );
    }
    // Die ausgeführte Änderung ist keine Gesprächsnachricht, sondern ein
    // Ereignis — sie steht über die volle Breite und nennt die Felder, damit im
    // Formular niemand suchen muss.
    return (
      <div key={key} className="rounded-xl border border-flare-400/30 bg-flare-500/8 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-flare-200">
          <Check className="w-3 h-3 flex-none" /> Geändert
        </div>
        <div className="text-[11px] text-ink-50/75 mt-1 leading-relaxed">{m.text}</div>
        {m.labels.length > 0 && (
          <div className="text-[10px] text-ink-50/40 mt-1">{m.labels.join(" · ")}</div>
        )}
      </div>
    );
  };

  /**
   * DER CHAT — er trägt die Höhe des angedockten Panels.
   *
   * Leer ist die Fläche kein verlorener Platz, sondern eine Ankündigung: hier
   * entsteht gleich das Gespräch. Genau das fehlte vorher — sie war einfach leer
   * und wirkte deshalb weggenommen.
   */
  const assistChat = (
    <div className="h-full flex flex-col">
      {chat.length === 0 && !assisting ? (
        // Die Erklärung steht IM LEEREN ZUSTAND, nicht im Kopf: dort erklärt sie
        // genau dann, wenn man sie braucht — und verschwindet von selbst, sobald
        // das Gespräch sie ersetzt. Im Kopf stünde sie für immer und machte ihn
        // drei Zeilen hoch.
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-1">
          <Wand2 className="w-7 h-7 text-ink-50/12" />
          <p className="text-[11px] text-ink-50/40 leading-relaxed">
            Sag unten, was an dieser Szene anders sein soll.
          </p>
          <p className="text-[10px] text-ink-50/25 leading-relaxed">
            Fehlt ihm etwas, fragt er nach — eine Sache nach der anderen. Wenn es passt, sagst du
            es ihm oder drückst „Jetzt ändern". Dann ändert er die Felder links und erzeugt das
            passende Bild.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {chat.map(chatBubble)}
          {assisting && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-ink-950/60 border border-white/8 px-3 py-2 text-[11px] text-ink-50/55 inline-flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-flare-300" /> denkt nach…
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}
    </div>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      // AB `lg` IST DER ASSISTENT EINE ERWEITERUNG DES DIALOGS.
      //
      // Er dockt bündig an dessen rechte Kante an: keine Lücke, keine eigene
      // linke Rundung, kein zweiter Rahmen am Stoß (`border-l-0` — die rechte
      // Kante des Dialogs ist die Trennlinie). Die Höhe kommt vom `items-stretch`
      // der Gruppe in `Dialog` — er ist damit exakt so hoch wie der Dialog
      // daneben, statt als kleiner Kasten mittig daneben zu schweben.
      //
      // Darunter fehlt der Platz — dort hängt derselbe Inhalt oben in der
      // Feldspalte (`lg:hidden` weiter unten).
      aside={onAssist ? (
        <aside className="hidden lg:flex w-80 flex-none flex-col rounded-r-3xl border border-l-0 border-white/10 bg-ink-900/95 backdrop-blur-2xl shadow-2xl overflow-hidden animate-slide-in-right">
          {/* KOPF — bewusst OHNE Trennlinie.
              Eine hier läge nie auf Höhe der Linie im Dialogkopf daneben: dessen
              Höhe hängt am Szenentitel, der mal ein- und mal zweizeilig umbricht
              (gemessen: 93 px gegen 117 px). Zwei Striche knapp nebeneinander auf
              verschiedener Höhe lesen sich als Schlamperei — kein Strich liest
              sich als eine Spalte. Der Zusammenhalt kommt ohnehin aus der
              gemeinsamen Fläche und der nahtlosen Kante links. */}
          <div className="flex-none px-4 pt-6 pb-3 flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-flare-300" />
            <span className="text-xs font-medium uppercase tracking-wider text-ink-50/60">
              KI-Assistent
            </span>
          </div>

          {/* DAS GESPRÄCH — der einzige Teil, der die Höhe nimmt. */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
            {assistChat}
          </div>

          {/* EINGABE — als Leiste am unteren Rand, in derselben Farbe wie die
              Dialog-Fußzeile daneben. Sie ist höher als die (ein Textfeld ist
              höher als eine Knopfreihe) und soll das auch sein: das Feld gehört
              unmittelbar über seinen Knopf. Vorher stand es oben und der Knopf
              klebte allein am unteren Rand, eine halbe Panelhöhe entfernt. */}
          <div className="flex-none px-4 py-4 border-t border-white/5 bg-ink-950/40 space-y-2">
            {assistField}
            {assistButtons}
          </div>
        </aside>
      ) : undefined}
      title={`Szene ${sceneIndex + 1}`}
      subtitle={draft.summary || "Bearbeite Details, Cinematography und regeneriere das Bild."}
      size="xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          {/* „sofort übernommen" las sich so, als änderte sich das gezeigte Bild
              mit dem Text — es entstand aber aus dem Text von vorher. */}
          {/* Der Hinweis darf schrumpfen, die Knöpfe nicht: mit drei Aktionen
              in der Zeile würde sonst auf schmalen Fenstern der Text die
              Knöpfe aus der Fußzeile drücken. */}
          <div className="min-w-0 flex-1 text-xs text-ink-50/40">Änderungen sind gespeichert und wirken beim nächsten Generieren.</div>
          <div className="flex flex-none gap-2">
            {imgSrc && (
              <ResolutionDownloadMenu
                dataUrl={imgSrc}
                filename={`scene-${sceneIndex + 1}.png`}
                align="left"
                preferSide="top"
                // Hieß „Bild speichern" — und las sich damit wie „Änderungen
                // speichern", obwohl es das Bild als Datei HERUNTERLÄDT. Neben
                // einem Dialog ohne sichtbaren Speichern-Knopf war das die
                // denkbar schlechteste Beschriftung.
                triggerTitle="Bild als Datei herunterladen"
                triggerClassName="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium select-none transition-all duration-150 active:scale-[0.97] text-ink-50/80 hover:bg-white/5 hover:text-ink-50 h-9 px-3 text-xs rounded-md"
              >
                <Download className="w-3.5 h-3.5" />
                Bild herunterladen
              </ResolutionDownloadMenu>
            )}
            {/* FERTIG — der Knopf, der bisher fehlte.
                Technisch speichert jede Eingabe längst sofort (`patch` schreibt
                direkt in die Szene). Sichtbar war davon aber nichts: die einzige
                betonte Aktion hieß „Bild neu generieren", und daneben stand ein
                Download, der „speichern" hieß. Wer nur den Text ändern wollte,
                musste glauben, dass er ein Bild neu erzeugen MUSS. Dieser Knopf
                erzeugt nichts, er bestätigt und schließt. */}
            <Button
              variant="secondary"
              onClick={onClose}
              iconLeft={<Check className="w-3.5 h-3.5" />}
              title="Übernimmt die Änderungen und schließt — ohne etwas neu zu erzeugen."
            >
              Fertig
            </Button>
            {/* Der Dialog zeigt weder Video noch Endframe — ohne diesen Hinweis
                zerstört der Klick etwas Bezahltes, das hier gar nicht sichtbar
                ist. Deshalb Folge im Label UND Rückfrage. */}
            <Button
              onClick={() => {
                const hasVideo = draft.videoStatus === "done" && !!draft.videoUrl;
                if (hasVideo && !window.confirm(
                  "Ein neues Bild verwirft das fertige Video dieser Szene samt Vertonung.\n\nFortfahren?",
                )) return;
                onRegenerate();
              }}
              loading={imageRunning}
              // `sceneBusy` statt der drei Einzelprüfungen von vorher: der
              // Assistent gehört mit hinein, weil er selbst in einem Bildlauf
              // endet — sonst liessen sich hier und dort zwei bezahlte Bilder
              // für dieselbe Szene starten. Und der Grund steht jetzt im
              // Tooltip, statt dass ein blasser Knopf schweigt.
              disabled={sceneBusy}
              title={busyReason}
              iconLeft={<RefreshCw className="w-3.5 h-3.5" />}
            >
              {draft.videoStatus === "done" && draft.videoUrl ? "Bild neu (verwirft Video)" : "Bild neu generieren"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
        <div>
          <div className={cn("relative rounded-2xl overflow-hidden bg-ink-900 border border-white/8", aspectClass)}>
            {draft.imageStatus === "loading" && <div className="absolute inset-0 skeleton" />}
            {draft.imageStatus === "done" && imgSrc && (
              <img src={imgSrc} alt={draft.summary} className="w-full h-full object-cover" />
            )}
            {draft.imageStatus === "error" && (
              <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-center bg-danger/5">
                <AlertTriangle className="w-7 h-7 text-danger mb-2" />
                <div className="text-sm font-medium text-danger">{draft.imageError}</div>
                {draft.imageHint && <div className="text-xs text-ink-50/55 mt-1">{draft.imageHint}</div>}
              </div>
            )}
            {draft.imageStatus === "idle" && (
              <div className="absolute inset-0 flex items-center justify-center text-ink-50/30 text-sm">
                Noch kein Bild generiert
              </div>
            )}
            {draft.imageStatus !== "error" && <SlotProgress status={draft.imageStatus} barSize="thick" />}
          </div>
          {draft.detailedImagePrompt && (
            <details className="mt-3">
              <summary className="text-xs text-ink-50/40 cursor-pointer hover:text-ink-50/70 transition-colors flex items-center gap-1.5">
                <Sparkles className="w-3 h-3" /> Verwendeter Image-Prompt
              </summary>
              <pre className="mt-2 text-[11px] text-ink-50/55 whitespace-pre-wrap bg-ink-950/40 rounded-lg p-3 border border-white/5">{draft.detailedImagePrompt}</pre>
            </details>
          )}
        </div>

        <div className="relative space-y-3">
          {/* Unterhalb von `lg` ist rechts neben dem Dialog kein Platz — dort
              steht derselbe Inhalt als Kasten oben in der Spalte. */}
          {onAssist && (
            <div className="lg:hidden p-3 rounded-2xl border border-flare-400/25 bg-flare-500/6 space-y-2.5">
              <div className="flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5 text-flare-300" />
                <span className="text-xs font-medium uppercase tracking-wider text-ink-50/60">
                  KI-Assistent
                </span>
              </div>
              <p className="text-[11px] text-ink-50/45 leading-relaxed">
                Sag, was anders sein soll. Fehlt ihm etwas, fragt er nach — sonst ändert er die
                Felder darunter und erzeugt das passende Bild.
              </p>
              {/* Das Gespräch steht auch hier, aber gedeckelt: der Kasten sitzt
                  in einer mitscrollenden Spalte und darf nicht mit ihr ins
                  Endlose wachsen. */}
              {chat.length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {chat.map(chatBubble)}
                  {assisting && (
                    <div className="text-[11px] text-ink-50/55 inline-flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-flare-300" /> denkt nach…
                    </div>
                  )}
                </div>
              )}
              {assistField}
              {assistButtons}
            </div>
          )}

          {/* ══ „GENERIERT…" ÜBER DEN FELDERN ══════════════════════════════
              Dieselbe Schicht und dasselbe Abzeichen wie an jedem einzelnen
              KI-Feld (SuggestionField) — nur über der ganzen Spalte, weil der
              Assistent quer über mehrere Felder schreibt und vorher niemand
              weiss, über welche. Ohne sie stünde das Formular sekundenlang
              scheinbar unverändert da, und die einzige Rückmeldung wäre ein
              Knopf mit Spinner drüben im Panel.

              Sie fängt die Klicks gleich mit ab: an einem Feld zu tippen, das
              gleich überschrieben wird, wäre verlorene Arbeit. */}
          {assisting && (
            <div className="absolute -inset-2 z-20 flex items-center justify-center rounded-2xl backdrop-blur-[3px] bg-ink-800/40 cursor-wait">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                               bg-ink-900/85 border border-white/10 text-ink-50/80 shadow-lg">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-flare-300" />
                Generiert…
              </span>
            </div>
          )}

          <Input
            label="Titel"
            value={draft.summary}
            onChange={(e) => patch({ summary: e.target.value })}
            placeholder={`Szene ${sceneIndex + 1}`}
          />

          <SuggestionField
            as="textarea"
            label="Detail-Beschreibung"
            rows={4}
            value={draft.detailedDescription}
            onChange={(v) => patch({ detailedDescription: v })}
            placeholder="Was passiert in dieser Szene? Wer ist im Bild? Welche Aktion?"
            emptyHint="Wähle eine Beschreibung oder schreib deine eigene…"
            items={suggest.get("detailedDescription")}
            loading={suggest.busy("detailedDescription")}
            onReroll={() => suggest.reroll("detailedDescription")}
          />

          {/* WARUM DIESER HINWEIS EXISTIERT: Im Duo-Bild ist der Aufbau fest —
              beide STEHEND, je eine Bildhälfte —, weil die OmniHuman-Maske starr
              in der Bildmitte schneidet. Die Detail-Beschreibung wird für dieses
              Bild gar nicht gelesen, die Schlüssel-Aktion färbt nur Stimmung und
              Gesicht. Ohne diesen Hinweis schreibt man „Leo liegt auf dem Boden"
              ins Feld, das Feld nimmt es an, und das Bild bleibt gleich — ohne
              dass irgendwo etwas widerspricht. */}
          {isDuo && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-warn/30 bg-warn/8">
              <Users className="w-3.5 h-3.5 text-warn mt-0.5 flex-shrink-0" />
              <div className="min-w-0 text-[11px] leading-snug">
                <div className="font-medium text-ink-50">Diese Szene läuft als Duo-Bild — der Aufbau ist fest.</div>
                <div className="text-ink-50/60 mt-0.5">
                  Beide stehen nebeneinander, jede Person auf ihrer Bildhälfte. Beschreibung,
                  Ausschnitt und Kamerawinkel wirken hier nicht; die Schlüssel-Aktion färbt nur
                  Stimmung und Gesicht. Für eine freie Haltung — liegen, sitzen, knien, Nahaufnahme —
                  muss die Szene auf „nur Sprecher" umgestellt werden. Die zweite Person ist dann
                  nur noch von hinten oder angeschnitten im Bild.
                </div>
                {onToggleDuo && (
                  <button
                    type="button"
                    onClick={onToggleDuo}
                    className="mt-1.5 text-[11px] font-medium text-flare-200 hover:text-flare-100 transition-colors"
                  >
                    Auf „nur Sprecher" umstellen →
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Beteiligte Charaktere"
              value={draft.participants}
              onChange={(e) => patch({ participants: e.target.value })}
              placeholder="z.B. Anna, Mark"
            />
            <SuggestionField
              label="Bereich / Sub-Ort"
              value={draft.specificArea}
              onChange={(v) => patch({ specificArea: v })}
              placeholder="z.B. Wohnzimmer am Fenster"
              items={suggest.get("specificArea")}
              loading={suggest.busy("specificArea")}
              onReroll={() => suggest.reroll("specificArea")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <SuggestionField
              label="Schlüssel-Aktion"
              value={draft.keyAction}
              onChange={(v) => patch({ keyAction: v })}
              placeholder="Die zentrale Geste/Aktion"
              items={suggest.get("keyAction")}
              loading={suggest.busy("keyAction")}
              onReroll={() => suggest.reroll("keyAction")}
            />
            <SuggestionField
              label="Emotion"
              value={draft.emotion}
              onChange={(v) => patch({ emotion: v })}
              placeholder="z.B. überrascht, entschlossen"
              items={suggest.get("emotion")}
              loading={suggest.busy("emotion")}
              onReroll={() => suggest.reroll("emotion")}
            />
          </div>

          <SuggestionField
            as="textarea"
            label="Dialog / Sprechertext"
            rows={3}
            value={draft.dialogText}
            // Die Aussprache-Fassung gehört zu GENAU diesem Wortlaut. Bleibt sie
            // nach einer Textänderung stehen, spricht die Stimme weiter den alten
            // Satz, während auf der Karte der neue steht — ein Fehler, den man
            // erst im fertigen Clip hört. Deshalb fällt sie hier weg; die Stimme
            // liest dann wieder den Text selbst.
            onChange={(v) => patch({ dialogText: v, dialogSpeech: undefined })}
            placeholder='z.B. „Was ist das?" — leer lassen für stumme Szene'
            emptyHint="Wähle eine Zeile oder schreib deine eigene…"
            items={suggest.get("dialogText")}
            loading={suggest.busy("dialogText")}
            onReroll={() => suggest.reroll("dialogText")}
          />

          {/* AUSSPRACHE — bewusst EDITIERBAR.
              Eine Lautschrift ist ein grobes Werkzeug: schreibt das Modell sie
              schlecht, sagt die Stimme ein anderes Wort („Autoplay" wurde als
              „Utopie Lord" gelesen), und ohne Eingriffsmöglichkeit bliebe nur,
              das ganze Storyboard neu zu erzeugen. Deshalb steht hier ein Feld
              und kein Hinweistext: korrigieren oder leeren, fertig. Leer heisst
              immer „die Stimme liest den Text von oben".
              Nur bei vorhandenem Sprechtext — ohne Zeile gibt es nichts zu
              sprechen und das Feld wäre eine leere Behauptung. */}
          {draft.dialogText?.trim() && (
            <div className="-mt-2">
              <Input
                label="Aussprache für die Stimme (optional)"
                value={draft.dialogSpeech ?? ""}
                onChange={(e) => patch({ dialogSpeech: e.target.value.trim() ? e.target.value : undefined })}
                placeholder="Leer = Text von oben wird vorgelesen"
                className="font-mono text-xs"
              />
              <div className="mt-1 flex items-start justify-between gap-3">
                <span className="text-[11px] text-ink-50/45">
                  Nur für den Klang — angezeigt wird immer der Text darüber. Englische Firmennamen
                  hier lautschriftlich schreiben („Google Ads" → „Guhgel Ähds"), damit die Stimme sie
                  nicht deutsch ausspricht. Klingt etwas falsch: Feld leeren.
                </span>
                {draft.dialogSpeech && (
                  <button
                    type="button"
                    onClick={() => patch({ dialogSpeech: undefined })}
                    className="flex-none text-[11px] px-2 py-0.5 rounded-md border border-white/15 text-ink-50/70 hover:text-ink-50 hover:border-white/30 transition-colors"
                    title="Vorgabe entfernen — die Stimme liest dann den Sprechertext selbst."
                  >
                    Leeren
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Vortragsart der Zeile. Leer = kein bewusstes Delivery: dann gilt
              weiter die projektweite Stabilität, und bei Eleven v3 geht kein
              Audio-Tag in den Text. Siehe renderSceneVoice in lib/voice.ts. */}
          <Select
            label="Stimmlage"
            value={draft.voiceDelivery || ""}
            onChange={(e) => patch({ voiceDelivery: e.target.value || undefined })}
            options={VOICE_DELIVERIES.map((d) => ({ value: d.value, label: d.label }))}
            placeholder="Ohne — Projekt-Einstellung"
            hint="Wie die Zeile vorgetragen wird. Wirkt nur mit fester Sprecherstimme."
          />

          <div className="border-t border-white/5 pt-3 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <Badge tone="accent" className="text-[10px]">Cinematography</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Kamerawinkel"
                value={draft.cameraAngle}
                onChange={(e) => patch({ cameraAngle: e.target.value })}
                options={STORY_CAMERA_ANGLES}
              />
              <Select
                label="Shot-Typ"
                value={draft.shotType}
                onChange={(e) => patch({ shotType: e.target.value })}
                options={STORY_SHOT_TYPES}
              />
              <Select
                label="Komposition"
                value={draft.composition}
                onChange={(e) => patch({ composition: e.target.value })}
                options={STORY_COMPOSITIONS}
              />
              <Select
                label="Kamerabewegung"
                value={draft.movement}
                onChange={(e) => patch({ movement: e.target.value })}
                options={STORY_MOVEMENTS}
              />
            </div>
            <div className="mt-3">
              <Select
                label="Wirkung auf den Zuschauer"
                value={draft.audienceEffect}
                onChange={(e) => patch({ audienceEffect: e.target.value })}
                options={STORY_AUDIENCE_EFFECTS}
              />
            </div>
          </div>

          <Textarea
            label="Continuity-Notizen"
            rows={2}
            value={draft.continuityNotes}
            onChange={(e) => patch({ continuityNotes: e.target.value })}
            placeholder="z.B. Kleidung gleich wie Szene 1, Brille bleibt, Requisit Buch in linker Hand"
            hint="Hilft der KI, Charakter und Props zwischen Szenen konsistent zu halten."
          />
        </div>
      </div>
    </Dialog>
  );
}
