import { Camera } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SuggestionField } from "@/components/ai/SuggestionField";
import { useFieldSuggestions } from "@/hooks/useFieldSuggestions";
import { EMPTY_REEL_SITUATION, type ReelSituation, type ActionLevel } from "@/lib/storyPrompts";

interface Props {
  /** `null` = das Storyboard hat noch keine Situation festgelegt. Das Panel
   *  zeigt dann leere Felder statt zu verschwinden — vorher war die Situation
   *  erst NACH dem ersten (bezahlten) Storyboard-Lauf einstellbar, obwohl sie
   *  genau diesen Lauf steuert. */
  situation: ReelSituation | null;
  onChange: (next: ReelSituation) => void;
  /**
   * Der Aktions-Level des Reels. Er MUSS hier ankommen: Die Tätigkeit ist die
   * Quelle jeder späteren Handlung. Schlägt die KI „am Schreibtisch sitzen" vor,
   * hat der aktive Modus danach nichts, womit die Hände arbeiten könnten — der
   * Schalter liefe gegen eine Situation, die ihn ausschließt.
   */
  actionLevel?: ActionLevel;
}

// Die leere Situation kommt jetzt aus storyPrompts — der Abgleich-Dialog setzt
// dieselben vier Felder einzeln und braucht denselben Ausgangswert.
const EMPTY_SITUATION = EMPTY_REEL_SITUATION;

/**
 * Die durchgehende Situation eines Vlog-Reels — vom Storyboard-Modell EINMAL
 * festgelegt und danach wortgleich in JEDEN Szenen-Prompt (Bild UND Video)
 * geschrieben. Genau deshalb muss sie sichtbar und korrigierbar sein: ein
 * schlecht gewähltes Setting steckt sonst unsichtbar in allen Clips.
 *
 * Die Felder sind bewusst frei editierbar (keine Auswahl): sie gehen als
 * englischer bzw. deutscher Klartext direkt in den Prompt. Unter jedem Feld
 * stehen drei KI-Vorschläge zum Thema des Projekts — sie stammen aus EINEM
 * gemeinsamen Lauf, damit Tätigkeit, Ort, Outfit und Kamera zusammenpassen.
 */
export function ReelSituationPanel({ situation, onChange, actionLevel }: Props) {
  const value = situation ?? EMPTY_SITUATION;
  const patch = (p: Partial<ReelSituation>) => onChange({ ...value, ...p });
  const actionActive = actionLevel === "active";

  const suggest = useFieldSuggestions(
    // Der Aktions-Level gehört in den Cache-Schlüssel: Die Vorschläge sind für
    // beide Modi verschieden, und ein gemeinsamer Schlüssel würde nach dem
    // Umschalten die Liste des anderen Modus zeigen.
    `reel:situation:${actionActive ? "active" : "calm"}`,
    [
      { key: "activity", what: actionActive
          ? "was die Person durchgehend MIT DEN HÄNDEN tut, während sie spricht — die Tätigkeit muss Gegenstände zum Greifen und Hochhalten hergeben"
          : "was die Person durchgehend tut, während sie spricht", shape: "wenige Worte", current: value.activity },
      { key: "setting", what: "EIN konkreter Ort, an dem das ganze Reel spielt", shape: "wenige Worte, keine Aufzählung", current: value.setting },
      { key: "outfit", what: "das Outfit der Person, über alle Szenen identisch", shape: "wenige Worte", current: value.outfit },
      { key: "cameraSetup", what: "der Kameraaufbau, der zwischen den Szenen nicht angefasst wird", shape: "wenige Worte", current: value.cameraSetup },
    ],
    {
      context:
        (actionActive
          ? "Erzähl-Reel im Hochformat: Die Person spricht durchgehend und HANTIERT dabei sichtbar — die Tätigkeit " +
            "braucht die Hände (Training, Kochen, Reparieren, Packen). Keine Stunts, aber auch nichts, wobei man nur dasteht. "
          : "Erzähl-Reel im Hochformat: Die Person spricht durchgehend, bleibt ruhig und macht keine Stunts. ") +
        "Alle vier Angaben gelten für JEDE Szene und müssen zusammen eine glaubwürdige, alltägliche Situation ergeben.",
    },
  );

  const field = (key: keyof ReelSituation, label: string, placeholder: string, hint: string) => (
    <SuggestionField
      label={label}
      value={value[key]}
      onChange={(v) => patch({ [key]: v } as Partial<ReelSituation>)}
      placeholder={placeholder}
      hint={hint}
      items={suggest.get(key)}
      loading={suggest.busy(key)}
      onReroll={() => suggest.reroll(key)}
    />
  );

  return (
    <div className="p-4 rounded-2xl border border-white/8 bg-ink-950/45 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge tone="accent" className="text-[10px]">
          <Camera className="w-3 h-3" /> Situation
        </Badge>
        <span className="text-[11px] text-ink-50/50">
          Gilt für jede Szene — Ort, Outfit und Kameraaufbau bleiben über das ganze Reel identisch.
          {!situation && " Leer lassen = die KI entscheidet beim ersten Lauf."}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field("activity", "Tätigkeit", "z.B. Hanteltraining im Fitnessstudio",
          actionActive
            ? "Was die Person durchgehend tut — im aktiven Modus etwas, das die Hände beschäftigt."
            : "Was die Person durchgehend tut, während sie spricht.")}
        {field("setting", "Ort", "z.B. Hantelecke, Fenster im Rücken", "EIN konkreter Ort — keine Aufzählung.")}
        {field("outfit", "Outfit", "z.B. graues Tanktop, schwarze Shorts", "Über alle Szenen identisch.")}
        {field("cameraSetup", "Kameraaufbau", "z.B. festes Stativ auf Augenhöhe, 1,5 m Abstand", "Die Kamera wird zwischen den Szenen nicht angefasst.")}
      </div>
    </div>
  );
}
