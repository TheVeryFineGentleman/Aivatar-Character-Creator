/**
 * Take a list of generated scene videos and merge them via the server's FFmpeg endpoint.
 * Shows queued URLs, a progress hint, and a download link for the merged result.
 */
import { useEffect, useRef, useState } from "react";
import { Film, Download, Loader2, AlertTriangle, GripVertical, Scissors } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";
import { mergeVideos } from "@/lib/serverAI";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

interface Clip {
  id: string;
  url: string;
  label?: string;
  /**
   * Wie lange in diesem Clip tatsächlich GESPROCHEN wird (Sekunden).
   *
   * Avatar-Clips sind länger als ihr Ton: Kling hängt gemessene 0,3–2,7 s an,
   * dazu kommen 0,2 s bewusster Nachhall aus dem Sprech-Trim. In dieser
   * Restzeit führt kein Audio mehr den Mund — und die einzige Vorlage des
   * Modells ist ein Standbild mit OFFENEM Mund. Ergebnis: jemand setzt am
   * Clipende stumm zum Sprechen an, und der Satz kommt erst im nächsten Clip.
   *
   * Die Server-Automatik kann das nicht abfangen: Sie sucht ein EINGEFRORENES
   * Bild am Clipende, und ein sich öffnender Mund ist Bewegung — er fällt per
   * Konstruktion durch jedes ihrer Gatter. Deshalb wird hier nicht gemessen,
   * sondern gewusst: Diese Dauer stammt aus der TTS-Antwort und wird als
   * Schnittpunkt VORGEGEBEN. Ein vorgegebener Schnitt schlägt serverseitig
   * jede Automatik.
   */
  speechSec?: number;
}

interface Props {
  clips: Clip[];
  /**
   * Szenen, die es NICHT ins Reel schaffen — je ein fertiger Satz mit echter
   * Szenennummer und Grund („Szene 3: Vertonung fehlt").
   *
   * Ohne diese Liste war der Ausschluss unsichtbar: die Clips wurden nach dem
   * Filtern durchnummeriert, aus einer Lücke bei Szene 3 wurde also eine
   * lückenlose Liste, in der Szene 4 als „Szene 3" stand. Das Reel sah
   * vollständig aus und war es nicht.
   */
  missingLabels?: string[];
  defaultFilename?: string;
  onClipsChange?: (clips: Clip[]) => void;
  /**
   * Zählt hoch, wenn der Zusammenschnitt von aussen ausgelöst werden soll —
   * der Durchlauf in StoryPage kommt hier an. Ein Token statt eines
   * Funktionsaufrufs, weil der Merge-Zustand hier drin lebt.
   */
  autoMergeToken?: number;
  /** Meldet jeden abgeschlossenen Versuch zurück — Ergebnis oder `null`.
   *  MUSS auch im Fehlerfall feuern, sonst hinge die Etappe drüben fest. */
  onMergeSettled?: (result: { dataUrl: string; sig: string } | null) => void;
  /** Ein früher zusammengeschnittenes Reel aus dem Projektspeicher … */
  savedMergedUrl?: string | null;
  /** … und die Clipliste, zu der es gehört. Stimmt sie nicht mehr, wird das
   *  Reel nicht gezeigt: „Fertig · Dein Reel ist bereit" über einem Video,
   *  das eine andere Zusammenstellung zeigt, ist genau die Art Fehler, die man
   *  dem Ergebnis nicht ansieht. */
  savedMergedSig?: string | null;
  /** Target output ratio (e.g. "9:16"). Keeps the merged video in the chosen
   *  format instead of the server's 16:9 default. */
  aspectRatio?: string;
  /** When the clips were generated with continuity (each clip's first frame ==
   *  the previous clip's last frame), tells the server to drop that duplicated
   *  boundary frame so the joins are seamless instead of a 1-frame freeze. */
  seamless?: boolean;
}

/** Sekunden lesbar: 6,4 s — nicht 6.4000000001. */
const fmt = (s: number) => `${s.toFixed(1).replace(".", ",")} s`;

/**
 * Steht der Regler am Clipende? Das ist ein EIGENER Zustand, nicht dasselbe wie
 * „Auto": Auto kappt den Standbild-Schwanz hinter dem letzten Wort, der Regler
 * ganz rechts sagt ausdrücklich „lass den Clip in voller Länge". Beides mit
 * „Schnitt bei 7,3 s" zu beschriften, behauptet einen Schnitt, den es nicht gibt.
 */
const isFullLength = (cut: number, dur: number) => cut >= dur - 0.05;

export function VideoMerger({
  clips, missingLabels, defaultFilename = "story.mp4", onClipsChange, aspectRatio, seamless,
  autoMergeToken, onMergeSettled, savedMergedUrl, savedMergedSig,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  /** Zu WELCHER Clipliste gehört das Ergebnis oben? Siehe `clipSig` unten. */
  const [mergedSig, setMergedSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Seit wann läuft der Zusammenschnitt? Er ist der längste Schritt der Seite
   *  und hatte bisher als einziger keinerlei Anzeige — nur einen Spinner. */
  const [mergeStartedAt, setMergeStartedAt] = useState(0);
  const [mergeNow, setMergeNow] = useState(0);
  useEffect(() => {
    if (!loading) return;
    setMergeNow(Date.now());
    const h = setInterval(() => setMergeNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, [loading]);

  /**
   * Schnittpunkt je Clip in Sekunden — fehlt der Eintrag, misst der Server
   * selbst, wo das Gesprochene endet.
   *
   * Bewusst über die Clip-ID und nicht über den Index: die Reihenfolge lässt
   * sich per Drag ändern, ein indexbasierter Schlüssel würde den Schnitt dabei
   * auf einen anderen Clip umhängen.
   *
   * Ebenso bewusst NICHT im Projekt gespeichert: der Wert gehört zu diesem
   * Zusammenschnitt, nicht zur Szene. Nach einem Reload steht wieder Automatik.
   */
  const [cuts, setCuts] = useState<Record<string, number>>({});
  const [durations, setDurations] = useState<Record<string, number>>({});
  /**
   * Welche Clips sind AUS, kommen also nicht ins fertige Reel?
   *
   * Bewusst als „aus"-Liste statt als „an"-Liste: neu dazukommende Clips (eine
   * Szene wird nachgerendert) sind damit automatisch dabei, ohne dass hier
   * irgendetwas nachgezogen werden müsste. Schlüssel ist wie bei `cuts` die
   * Clip-ID, nicht der Index — sonst hinge das Aus-Schalten nach einem Drag am
   * falschen Clip.
   *
   * Ebenfalls wie `cuts` NICHT im Projekt gespeichert: die Auswahl gehört zu
   * diesem Zusammenschnitt. Nach einem Reload sind wieder alle Clips dabei.
   */
  const [off, setOff] = useState<Record<string, boolean>>({});
  // Für die Vorschau: beim Ziehen auf den Schnittpunkt springen, damit man das
  // letzte Bild des Clips SIEHT statt eine Zahl zu raten.
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const reorder = (from: number, to: number) => {
    if (!onClipsChange) return;
    const next = [...clips];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onClipsChange(next);
  };

  const onDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData("text/plain", String(idx));
  };
  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (Number.isFinite(from)) reorder(from, idx);
  };

  const setCut = (id: string, sec: number) => {
    setCuts((prev) => ({ ...prev, [id]: sec }));
    const v = videoRefs.current[id];
    // `seekable` prüfen: bei noch nicht geladenen Metadaten wirft das Setzen
    // zwar nicht, wird aber still verworfen — dann lieber gar nicht springen.
    if (v && Number.isFinite(v.duration)) v.currentTime = Math.min(sec, v.duration);
  };

  const clearCut = (id: string) => {
    setCuts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    const v = videoRefs.current[id];
    if (v) v.currentTime = 0;
  };

  /**
   * Clip an/aus. Der Schnittpunkt bleibt dabei erhalten — wer einen Clip
   * kurz herausnimmt und wieder dazunimmt, hätte ihn sonst verloren.
   *
   * Ein bereits fertig gerendertes Reel verschwindet dabei von selbst: es hängt
   * über `clipSig` an genau der Zusammenstellung, aus der es entstanden ist.
   * Früher stand hier ein `setMergedUrl(null)` — das griff nur beim Umschalten
   * und übersah jede andere Änderung: eine neu gerenderte Szene, eine geänderte
   * Reihenfolge, eine nachgezogene Vertonung. Danach behauptete „Fertig · Dein
   * Reel ist bereit" ein Video, das die Änderung nicht enthielt.
   */
  const toggleClip = (id: string) => {
    setOff((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  /** Die Clips, die tatsächlich ins Reel gehen — in der eingestellten Reihenfolge. */
  const usedClips = clips.filter((c) => !off[c.id]);

  /**
   * DIE UNTERSCHRIFT DIESER ZUSAMMENSTELLUNG — welche Clips, in welcher
   * Reihenfolge, in welcher Fassung.
   *
   * Die URL gehört mit hinein, nicht nur die ID: eine neu gerenderte Szene
   * behält ihre ID, ist aber ein anderer Clip. Genau daran erkennt die Anzeige
   * unten, ob das fertige Reel noch zum aktuellen Stand gehört.
   */
  const clipSig = usedClips.map((c) => `${c.id}@${c.url}`).join("|");

  /**
   * Das Reel, das gezeigt werden DARF: das dieser Sitzung, sonst das
   * gespeicherte — beides nur, solange die Unterschrift passt. Bewusst
   * abgeleitet statt in einem Effekt nachgezogen: ein Effekt hätte genau ein
   * Render lang das falsche Video stehen lassen, und das ist das eine Render,
   * in dem jemand auf „Download" klickt.
   */
  const shownUrl =
    mergedSig && mergedSig === clipSig ? mergedUrl
    : savedMergedSig && savedMergedSig === clipSig ? savedMergedUrl ?? null
    : null;
  /** Es GIBT ein fertiges Reel, es passt nur nicht mehr. Das ist eine Aussage
   *  für den Nutzer, kein Grund zu schweigen. */
  const staleReel = !shownUrl && !!((mergedUrl && mergedSig !== clipSig) || (savedMergedUrl && savedMergedSig !== clipSig));

  const merge = async () => {
    if (usedClips.length < 2) {
      toast.info("Mindestens zwei Clips müssen eingeschaltet sein.");
      // Auch der Nicht-Lauf ist ein abgeschlossener Versuch — ohne diese
      // Meldung hinge der Durchlauf drüben ewig in der Etappe „wird
      // zusammengefügt", ohne dass je etwas zusammengefügt würde.
      onMergeSettled?.(null);
      return;
    }
    const sig = clipSig;
    setLoading(true); setError(null); setMergedUrl(null); setMergedSig(null);
    setMergeStartedAt(Date.now());
    try {
      const res = await mergeVideos({
        sources: usedClips.map((c) => c.url),
        aspectRatio,
        seamless,
        // Index-gleich zu `sources` — der Server liest sie genau so. Deshalb
        // MUSS hier dieselbe gefilterte Liste stehen: über `clips` gerechnet
        // wären die Schnittpunkte ab dem ersten ausgeschalteten Clip um eins
        // verschoben und lägen am falschen Video.
        // Reihenfolge der Vorgaben: eigener Regler > bekannte Sprechdauer >
        // Server-Automatik. Bei nahtlosen Übergängen bleibt die Sprechdauer
        // aussen vor — dort ist der überstehende Rest gewollt, er trägt die
        // Verbindung zum nächsten Clip.
        cuts: usedClips.map((c) => cuts[c.id] ?? (seamless ? null : c.speechSec ?? null)),
      });
      setMergedUrl(res.dataUrl);
      setMergedSig(sig);
      toast.success("Video erfolgreich zusammengefügt.");
      // Die Unterschrift geht mit: drüben wird sie neben der Bucket-URL
      // gespeichert und beantwortet nach dem nächsten Reload, ob dieses Reel
      // noch zum dann sichtbaren Stand gehört.
      onMergeSettled?.({ dataUrl: res.dataUrl, sig });
    } catch (e: any) {
      setError(e.message || "Merge fehlgeschlagen.");
      toast.error(e.message || "Merge fehlgeschlagen.", { description: e.hint });
      onMergeSettled?.(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Der Durchlauf löst den Zusammenschnitt selbst aus.
   *
   * Über einen hochzählenden Token statt eines Aufrufs von aussen: der
   * Merge-Zustand (Schnittpunkte, abgewählte Clips, Reihenfolge) lebt hier
   * drin, und ein Aufruf von aussen müsste ihn entweder duplizieren oder
   * ignorieren.
   *
   * `merge` gehört bewusst NICHT in die Abhängigkeiten — die Funktion entsteht
   * bei jedem Render neu, der Effekt liefe damit dauernd und würde einen
   * bezahlten Serverlauf nach dem anderen starten. Ausgelöst wird genau von
   * einer Sache: einem neuen Token.
   */
  const autoTokenRef = useRef(autoMergeToken ?? 0);
  useEffect(() => {
    const token = autoMergeToken ?? 0;
    if (token === autoTokenRef.current) return;
    autoTokenRef.current = token;
    if (loading) { onMergeSettled?.(null); return; }
    void merge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMergeToken]);

  // „Eigene Länge", nicht „eigener Schnitt": der Regler ganz rechts setzt die
  // volle Länge fest und schneidet dabei nichts weg — er überstimmt nur die
  // Automatik. Beides zählt hier, weil beides eine Vorgabe des Nutzers ist.
  const manualCount = usedClips.filter((c) => cuts[c.id] != null).length;
  const offCount = clips.length - usedClips.length;

  return (
    <Card>
      <CardHeader
        title="Clips zusammenfügen"
        // Sind Clips abgewählt, zählt nur noch, wie viele wirklich ins Reel
        // gehen — „3 Clips bereit" wäre dann eine Aussage über die Liste, nicht
        // über das Ergebnis.
        subtitle={`${offCount ? `${usedClips.length} von ${clips.length} Clips im Reel` : `${clips.length} Clip${clips.length === 1 ? "" : "s"} bereit`}${onClipsChange ? " · Reihenfolge per Drag" : ""}${manualCount ? ` · ${manualCount}× eigene Länge` : ""}`}
        icon={<Film className="w-4 h-4" />}
        action={
          <Button onClick={merge} loading={loading} size="sm" disabled={usedClips.length < 2}>
            {loading ? "Rendere…" : "Reel fertigstellen"}
          </Button>
        }
      />

      {clips.length === 0 ? (
        <div className="text-center py-6 text-sm text-ink-50/55">
          Generiere zuerst einzelne Szenen-Videos.
        </div>
      ) : (
        <div className="space-y-2">
          {clips.map((c, i) => {
            const dur = durations[c.id];
            const cut = cuts[c.id];
            const hasCut = cut != null;
            const isOff = !!off[c.id];
            /** Greift die bekannte Sprechdauer? Nur wenn sie wirklich etwas
             *  wegnimmt und der Nutzer nicht selbst geschnitten hat. */
            const speechCut = !hasCut && !seamless && c.speechSec && dur && c.speechSec < dur - 0.05
              ? Number(c.speechSec.toFixed(1))
              : null;
            return (
              <div
                key={c.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, i)}
                className={cn(
                  "p-2 rounded-xl border group transition-colors",
                  isOff
                    ? "bg-ink-950/20 border-white/5"
                    : "bg-ink-950/40 border-white/8 hover:border-white/15",
                )}
              >
                <div className="flex items-center gap-2">
                  {/* Der Schalter steht AUSSERHALB des ziehbaren Bereichs: in
                      einem draggable-Element beginnt schon der Mausdruck einen
                      Zieh-Vorgang, und ein Klick, der als Drag endet, schaltet
                      nichts. Dieselbe Lehre wie beim Schnitt-Regler unten. */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!isOff}
                    onClick={() => toggleClip(c.id)}
                    title={isOff
                      ? "Diesen Clip wieder ins Reel aufnehmen"
                      : "Diesen Clip aus dem Reel herausnehmen — er bleibt in der Liste und behält seinen Schnitt"}
                    aria-label={`${c.label || `Clip ${i + 1}`} ${isOff ? "ins Reel aufnehmen" : "aus dem Reel herausnehmen"}`}
                    className={cn(
                      "relative w-9 h-5 rounded-full flex-shrink-0 transition-colors",
                      isOff ? "bg-white/12 hover:bg-white/20" : "bg-flare-grad shadow-glow",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-pure transition-transform",
                        isOff ? "translate-x-0" : "translate-x-4",
                      )}
                    />
                  </button>

                  {/* Nur diese Zeile ist ziehbar. Vorher war es die ganze Karte —
                      mit dem Schnitt-Regler darin hätte jeder Zieh-Versuch am
                      Regler stattdessen die Reihenfolge geändert. */}
                  <div
                    draggable={!!onClipsChange}
                    onDragStart={(e) => onDragStart(e, i)}
                    className={cn(
                      "flex items-center gap-2 flex-1 min-w-0",
                      onClipsChange && "cursor-grab active:cursor-grabbing",
                      // Ausgeschaltet: die ganze Zeile tritt zurück, bleibt aber
                      // lesbar — man muss sehen können, WAS man abgewählt hat.
                      isOff && "opacity-45 grayscale",
                    )}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-ink-50/35 group-hover:text-ink-50/65 flex-shrink-0" />
                    <video
                      ref={(el) => { videoRefs.current[c.id] = el; }}
                      src={c.url}
                      preload="metadata"
                      onLoadedMetadata={(e) => {
                        const d = e.currentTarget.duration;
                        if (Number.isFinite(d) && d > 0) setDurations((prev) => ({ ...prev, [c.id]: d }));
                      }}
                      className="w-16 h-10 object-cover rounded-lg bg-ink-900 flex-shrink-0"
                      muted
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="text-ink-50/85 truncate">{c.label || `Clip ${i + 1}`}</div>
                      <div className="text-ink-50/40 truncate font-mono text-[10px]">
                        {dur ? fmt(dur) : "…"}
                        {isOff ? (
                          <span className="text-ink-50/55"> · nicht im Reel</span>
                        ) : hasCut && dur ? (
                          <span className="text-flare-300">
                            {isFullLength(cut, dur) ? " · volle Länge, kein Auto-Schnitt" : ` · Schnitt bei ${fmt(cut)}`}
                          </span>
                        ) : speechCut ? (
                          <span className="text-ink-50/55"> · gesprochen bis {fmt(speechCut)}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Schnittpunkt ──────────────────────────────────────────
                    Ohne eigenen Wert misst der Server selbst, wo das Gesprochene
                    endet, und kappt den Standbild-Schwanz dahinter. Das trifft
                    nicht jeden Fall: eine Geste, die nachklingen soll, oder ein
                    Wort zu viel am Ende. Dafür ist der Regler da. */}
                {!dur ? (
                  <div className="mt-2 pl-6 text-[10px] text-ink-50/35">Länge wird gelesen…</div>
                ) : (
                  // Am ausgeschalteten Clip ist der Schnittpunkt gegenstandslos —
                  // er bleibt gespeichert und sichtbar, lässt sich aber erst
                  // wieder verstellen, wenn der Clip auch im Reel landet.
                  <div className={cn("mt-2 pl-6 flex items-center gap-2", isOff && "opacity-45")}>
                    <Scissors className={`w-3 h-3 flex-shrink-0 ${hasCut && !isOff ? "text-flare-300" : "text-ink-50/35"}`} />
                    <Slider
                      min={0.5}
                      max={Number(dur.toFixed(1))}
                      step={0.1}
                      // Ohne eigenen Schnitt steht der Regler am Clipende — er
                      // zeigt dann den Ist-Zustand „ungeschnitten" und nicht
                      // einen Wert, der schon etwas wegnähme.
                      value={hasCut ? cut : speechCut ?? Number(dur.toFixed(1))}
                      onChange={(e) => setCut(c.id, parseFloat(e.currentTarget.value))}
                      disabled={isOff}
                      className={cn("flex-1", isOff && "cursor-not-allowed")}
                      aria-label={`Schnittpunkt für ${c.label || `Clip ${i + 1}`}`}
                    />
                    <span className={`text-[10px] tabular-nums w-14 text-right flex-shrink-0 ${hasCut && !isOff ? "text-flare-300" : "text-ink-50/40"}`}>
                      {hasCut ? (isFullLength(cut, dur) ? "ganz" : fmt(cut)) : speechCut ? fmt(speechCut) : "Auto"}
                    </span>
                    <button
                      type="button"
                      onClick={() => clearCut(c.id)}
                      disabled={!hasCut || isOff}
                      className="text-[10px] px-2 py-0.5 rounded-md border border-white/15 text-ink-50/70 hover:text-ink-50 hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                      title="Wieder automatisch schneiden — der Server misst dann selbst, wo das Gesprochene endet."
                    >
                      Auto
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {clips.length > 0 && (
        <p className="mt-3 text-[11px] text-ink-50/45">
          Der Schalter links entscheidet, ob ein Clip ins fertige Reel kommt — abgeschaltete Clips
          bleiben in der Liste und behalten ihren Schnitt.
          {" "}Ohne eigenen Schnitt endet jeder Clip dort, wo das Gesprochene aufhört — bei Avatar-Clips
          ist diese Dauer bekannt und wird direkt vorgegeben, sonst misst der Server sie. So fällt der
          stumme Rest weg, in dem der Mund ohne Ton weiterläuft. Der Regler überschreibt das für einzelne Clips.
          {seamless && " Bei nahtlosen Übergängen bleibt automatisch ungeschnitten; ein eigener Schnitt gilt trotzdem."}
        </p>
      )}

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-danger/10 border border-danger/30 flex items-start gap-2 text-xs text-danger">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* WELCHE SZENEN FEHLEN — und warum.
          Der Ausschluss ist begründet (eine Szene mit der zufälligen
          Modellstimme mitten im Reel zerstört die Stimm-Konsistenz), aber er
          war unsichtbar: das Reel entstand einfach ohne sie. */}
      {!!missingLabels?.length && (
        <div className="mt-3 p-3 rounded-xl border border-warn/25 bg-warn/8 text-[11px] text-ink-50/75">
          <div className="font-medium text-ink-50 mb-1 inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-warn" />
            {missingLabels.length === 1
              ? "Eine Szene ist nicht im Reel"
              : `${missingLabels.length} Szenen sind nicht im Reel`}
          </div>
          <ul className="space-y-0.5 pl-5 list-disc marker:text-ink-50/30">
            {missingLabels.map((m) => <li key={m}>{m}</li>)}
          </ul>
          <div className="mt-1.5 text-ink-50/50">
            Oben an der jeweiligen Szenenkarte nachziehen — danach hier erneut zusammenfügen.
          </div>
        </div>
      )}

      {/* Es liegt ein fertiges Reel vor, es passt nur nicht mehr zu dem, was
          jetzt eingestellt ist. Verschweigen wäre schlimmer als sagen. */}
      {staleReel && !loading && (
        <div className="mt-3 p-3 rounded-xl border border-white/10 bg-ink-950/40 text-[11px] text-ink-50/60">
          Seit dem letzten Zusammenschnitt hat sich etwas geändert (andere Clips, andere Reihenfolge
          oder eine neu gerenderte Szene). Das alte Reel wird deshalb nicht mehr angezeigt —
          „Reel fertigstellen" baut es mit dem aktuellen Stand neu.
        </div>
      )}

      {shownUrl && (
        <div className="mt-4 p-4 rounded-2xl bg-flare-500/8 border border-flare-400/30">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-medium text-ink-50">Fertig</div>
              <div className="text-xs text-ink-50/55 mt-0.5">
                Dein Reel ist bereit — {usedClips.length} {usedClips.length === 1 ? "Clip" : "Clips"}.
              </div>
            </div>
            <a
              href={shownUrl}
              download={defaultFilename}
              className="inline-flex items-center gap-1.5 px-3 h-8 text-xs rounded-xl bg-flare-grad text-pure shadow-glow hover:brightness-110"
            >
              <Download className="w-3.5 h-3.5" /> Download
            </a>
          </div>
          <video src={shownUrl} controls className="w-full max-h-72 rounded-xl bg-ink-900" />
        </div>
      )}

      {/* Der längste Schritt der Seite hatte als einziger keine Anzeige: ein
          Spinner und ein Satz, minutenlang, ohne Zahl. Jetzt steht wenigstens
          da, WORAN gearbeitet wird und wie lange schon. */}
      {loading && (
        <div className="mt-3 text-xs text-ink-50/55 inline-flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Der Server fügt {usedClips.length} Clips zusammen…
          {mergeStartedAt > 0 && (
            <span className="tabular-nums text-ink-50/40">
              läuft seit {(() => {
                const sec = Math.max(0, Math.floor((mergeNow - mergeStartedAt) / 1000));
                return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
              })()}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
