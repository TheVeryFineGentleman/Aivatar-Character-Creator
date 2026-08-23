import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Select } from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import { ttsSpeak } from "@/lib/serverAI";
import { defaultVoiceFor, falPremadeVoiceName, type StoryCharacter } from "@/lib/storyPrompts";
import { useElevenVoices, voiceOptions, resolveVoiceValue, isAccountVoice } from "@/hooks/useElevenVoices";
import { cn } from "@/lib/cn";

// Fester Vorhör-Satz: kurz genug für ein schnelles TTS-Roundtrip, lang genug
// um Timbre und Tempo einer Stimme wirklich zu beurteilen.
const PREVIEW_TEXT = "Hallo, so klingt deine Stimme in diesem Video — gleichmäßig, klar und über alle Clips hinweg identisch.";

interface Props {
  voiceName: string;
  onVoiceNameChange: (v: string) => void;
  voiceSpeed: number;
  onVoiceSpeedChange: (v: number) => void;
  voiceStability: number;
  onVoiceStabilityChange: (v: number) => void;
  voiceMode: "sprecher" | "dialog";
  characters: StoryCharacter[];
  characterVoices: Record<string, string>;
  onCharacterVoiceChange: (characterName: string, voice: string) => void;
  language: string;
  falKey: string;
  /** Eigener ElevenLabs-Key. Gesetzt = die Auswahl zeigt die Stimmen des
   *  Accounts (inklusive der selbst geklonten) statt der fal-Premade-Liste. */
  elevenKey: string;
  /** Die Geschlechts-Auswahl aus StoryPage, direkt ÜBER der Stimmenliste
   *  gerendert. Sie legt die Vorauswahl in genau dieser Liste fest — stand aber
   *  bisher zwei Karten entfernt unter „Stil & Tonalität", wo der Zusammenhang
   *  nicht erkennbar war. */
  genderSlot?: ReactNode;
}

export function VoicePicker({
  voiceName, onVoiceNameChange,
  voiceSpeed, onVoiceSpeedChange,
  voiceStability, onVoiceStabilityChange,
  voiceMode, characters, characterVoices, onCharacterVoiceChange,
  language, falKey, elevenKey, genderSlot,
}: Props) {
  const [previewing, setPreviewing] = useState<string | null>(null);
  // Das laufende Vorhör-Audio muss festgehalten werden: ohne Referenz lässt es
  // sich weder stoppen noch beim Unmount aufräumen — zwei Klicks hintereinander
  // spielten sonst zwei Stimmen gleichzeitig, und der Ton lief nach dem
  // Schließen des Bereichs einfach weiter.
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const { voices: accountVoices, loading: voicesLoading, error: voicesError } = useElevenVoices(elevenKey);
  const options = voiceOptions(accountVoices);
  // Der gespeicherte Wert kann aus der anderen Welt stammen (Name statt
  // voice_id). Im Dropdown MUSS aber ein vorhandener Wert stehen: sonst zeigt
  // das <select> stumm den ersten Eintrag an, während gespeichert etwas anderes
  // ist — die Anzeige würde also lügen.
  const selectedVoice = resolveVoiceValue(voiceName, accountVoices, "neutral", !!elevenKey);
  // Wurde der gespeicherte Wert dabei ERSETZT? Dann spricht eine andere Stimme
  // als die gewählte, und zwar dauerhaft. Der häufige Fall: eine voice_id aus
  // dem eigenen Account liegt im Projekt, der ElevenLabs-Key ist aber (nicht
  // mehr) gesetzt — über fal ist diese Stimme unerreichbar. Ohne Hinweis merkt
  // man es erst am fertigen Reel, weil das Dropdown brav einen gültigen Namen
  // anzeigt. Beim Laden der Kontoliste NICHT warnen, das ist nur ein Zwischenstand.
  // Groß-/Kleinschreibung ist KEINE Ersetzung: „sarah" wird zu „Sarah"
  // kanonisiert, gesprochen wird dieselbe Stimme. Nur echte Wechsel melden.
  const voiceWasSwapped =
    !!voiceName.trim()
    && selectedVoice.toLowerCase() !== voiceName.trim().toLowerCase()
    && !voicesLoading;

  const stopPreview = () => {
    const audio = previewAudioRef.current;
    previewAudioRef.current = null;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.onpause = null;
    audio.pause();
  };

  useEffect(() => stopPreview, []);

  const preview = async (value: string, key: string = value) => {
    if (!elevenKey && !falKey) {
      toast.error("Vorhören braucht einen fal.ai- oder ElevenLabs-Key — Einstellungen öffnen.");
      return;
    }
    // Der Weg folgt dem WERT (dieselbe Regel wie in `renderSceneVoice`): ein
    // Premade-Name gehört zu fal, alles andere ist eine voice_id und darf nur
    // direkt zu ElevenLabs. Die Kontoliste bestätigt das nur — steht sie noch
    // aus, ginge eine ID sonst an fal und käme als 422 „Voice not found" zurück.
    const premadeName = falPremadeVoiceName(value);
    const useElevenDirect = (isAccountVoice(value, accountVoices) || !premadeName) && !!elevenKey;
    if (!useElevenDirect && !premadeName) {
      toast.error(`„${value}" ist eine ElevenLabs-Stimme — dafür braucht es deinen ElevenLabs-Key in den Einstellungen.`);
      return;
    }
    if (!useElevenDirect && !falKey) {
      toast.error("Vorhören über fal braucht einen fal.ai-Key — Einstellungen öffnen.");
      return;
    }
    stopPreview();
    setPreviewing(key);
    try {
      // Exakt dieselbe Modell- und Feldwahl wie `renderSceneVoice`, sonst klänge
      // die Vorschau anders als die späteren Clips.
      const res = await ttsSpeak({
        model: "multilingual-v2",
        text: PREVIEW_TEXT,
        voice: useElevenDirect ? value : premadeName ?? value,
        languageCode: language,
        speed: voiceSpeed,
        stability: voiceStability,
        apiKey: falKey,
        elevenKey: useElevenDirect ? elevenKey : undefined,
      });
      const audio = new Audio(res.audioDataUrl);
      previewAudioRef.current = audio;
      // Die Sperre erst am ENDE der Wiedergabe lösen. Direkt nach `play()` (also
      // im finally) wären die Buttons schon wieder aktiv, während die erste
      // Stimme noch läuft — der nächste Klick legte eine zweite darüber.
      const done = () => {
        if (previewAudioRef.current === audio) previewAudioRef.current = null;
        setPreviewing((cur) => (cur === key ? null : cur));
      };
      audio.onended = done;
      audio.onerror = done;
      audio.onpause = done;
      await audio.play();
    } catch (e: any) {
      toast.error(e?.message || "Vorhören fehlgeschlagen.");
      stopPreview();
      setPreviewing(null);
    }
  };

  return (
    <div className="space-y-1.5 max-w-md">
      {/* Die feste Stimme ist nicht mehr abschaltbar — sie wird immer separat
          erzeugt und bleibt über alle Clips gleich. Es fehlt nur noch der Weg,
          über den sie entsteht: ohne Sprach-Key gibt es keine TTS-Spur, und der
          Clip trägt wieder die zufällige Modellstimme. */}
      {!falKey && (
        <div className="flex items-center gap-2.5 rounded-xl border border-warn/35 bg-warn/10 px-3 py-2">
          <span className="w-2 h-2 rounded-full flex-none" style={{ background: "#e0aa4a" }} />
          <span className="text-[11px] text-warn">
            {elevenKey
              ? "Kein fal.ai-Key — ohne ihn entstehen gar keine Clips: Video läuft ausschließlich über Kling (fal.ai)."
              : "Kein fal.ai- oder ElevenLabs-Key — ohne fal.ai gibt es keine Clips, ohne Stimm-Key keine feste Stimme."}
          </span>
        </div>
      )}

      {/* Stille Ersetzung sichtbar machen — siehe `voiceWasSwapped`. */}
      {voiceWasSwapped && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warn/35 bg-warn/10 px-3 py-2">
          <span className="w-2 h-2 mt-1.5 rounded-full flex-none" style={{ background: "#e0aa4a" }} />
          <span className="text-[11px] text-warn">
            Die gespeicherte Stimme <span className="font-mono">{voiceName.trim()}</span> ist auf dem
            aktuellen Weg nicht erreichbar — es spricht stattdessen <span className="font-medium">{selectedVoice}</span>.
            {elevenKey
              ? " Sie gehört nicht (mehr) zu diesem ElevenLabs-Account."
              : " Es ist eine Stimme aus einem ElevenLabs-Account; ohne eigenen ElevenLabs-Key läuft die Vertonung über fal.ai, und dort gibt es nur die Katalogstimmen."}
          </span>
        </div>
      )}

      <div>
        <div className="space-y-3 px-3 py-3 rounded-xl border border-white/8 bg-ink-950/55">
          {/* Geschlecht steht jetzt unmittelbar über der Liste, die es
              vorbelegt — der Zusammenhang war über zwei Karten hinweg nicht
              erkennbar. */}
          {genderSlot}

          <div className="space-y-1.5">
            {/* Im Dialog-Modus bekommt jede Person unten ihre eigene Stimme —
                eine zusätzliche projektweite Auswahl wäre hier dieselbe Frage
                zweimal. Im Sprecher-Modus ist sie dagegen die EINZIGE Auswahl
                und muss stehen bleiben. */}
            {voiceMode !== "dialog" && (
              <Select
                label="Stimme"
                options={options}
                value={selectedVoice}
                onChange={(e) => onVoiceNameChange(e.target.value)}
                disabled={voicesLoading}
              />
            )}

            {/* Welcher Weg gerade aktiv ist, entscheidet, WAS in der Liste steht
                — das gehört sichtbar dazu, sonst wirkt eine plötzlich andere
                Stimmenliste wie ein Fehler. */}
            {elevenKey ? (
              voicesLoading ? (
                <div className="text-[10px] text-ink-50/45">Stimmen deines ElevenLabs-Accounts werden geladen …</div>
              ) : voicesError ? (
                <div className="text-[10px] text-warn">
                  ElevenLabs-Stimmen nicht ladbar ({voicesError}) —{" "}
                  {falKey
                    ? "es gilt die Standardliste über fal.ai."
                    : "und ohne fal.ai-Key gibt es keinen zweiten Weg: die Vertonung schlägt fehl, im Clip bleibt die Modellstimme."}
                </div>
              ) : (
                <div className="text-[10px] text-ink-50/45">
                  Aus deinem ElevenLabs-Account — {accountVoices.length} Stimmen, eigene zuerst.
                </div>
              )
            ) : (
              <div className="text-[10px] text-ink-50/45">
                Standardstimmen über fal.ai. Für eigene und deutsche Stimmen einen ElevenLabs-Key in den Einstellungen hinterlegen.
              </div>
            )}
          </div>

          {/* Tempo und Gleichmäßigkeit gelten für multilingual-v2 — das einzige
              Modell, das die App noch fährt. */}
          <Slider
            label="Sprechtempo"
            valueLabel={`${voiceSpeed.toFixed(2)}×`}
            min={0.7}
            max={1.2}
            step={0.05}
            value={voiceSpeed}
            onChange={(e) => onVoiceSpeedChange(Number(e.target.value))}
          />
          <Slider
            label="Wie gleichmäßig soll die Stimme sein?"
            valueLabel={voiceStability.toFixed(2)}
            min={0}
            max={1}
            step={0.05}
            value={voiceStability}
            onChange={(e) => onVoiceStabilityChange(Number(e.target.value))}
          />

          {/* Dialog: jede Figur bekommt ihre eigene feste Stimme. */}
          {voiceMode === "dialog" && characters.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-xs font-medium text-ink-50">Stimme je Person</div>
              {characters.map((c) => {
                // Exakt derselbe Ausgangswert wie in StoryPage (`""`, nicht
                // defaultVoiceFor) — sonst zeigt das Dropdown eine andere
                // Stimme an als die, mit der spaeter gesprochen wird.
                const value = resolveVoiceValue(characterVoices[c.name] || "", accountVoices, c.gender, !!elevenKey);
                // Der Vorhör-Knopf sitzt an der Auswahl, die er betrifft:
                // aussuchen, anhören, weiter zur nächsten Person. Als Schlüssel
                // die Figur, nicht die Stimme — zwei Figuren dürfen dieselbe
                // Stimme haben, ohne dass beide Knöpfe zugleich drehen.
                const busy = previewing === c.id;
                return (
                  <div key={c.id} className="flex items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <Select
                        label={c.name}
                        options={options}
                        value={value}
                        onChange={(e) => onCharacterVoiceChange(c.name, e.target.value)}
                        disabled={voicesLoading}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => preview(value, c.id)}
                      disabled={previewing !== null || voicesLoading}
                      className="h-[46px] w-11 flex-none inline-flex items-center justify-center rounded-2xl border border-white/10 bg-ink-900/40 text-ink-50/70 hover:text-flare-200 hover:border-flare-400/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title={`Stimme von ${c.name} vorhören`}
                      aria-label={`Stimme von ${c.name} vorhören`}
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
