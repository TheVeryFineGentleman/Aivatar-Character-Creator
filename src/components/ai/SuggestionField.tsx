/**
 * Ein Eingabefeld, das seine KI-Vorschläge IN SICH trägt — wie das Story-
 * Ideenfeld, dem diese Darstellung entstammt.
 *
 * Solange das Feld leer ist, stehen die Vorschläge dort, wo sonst der Platzhalter
 * stünde: ein Hinweistext, darunter die Vorschläge mit farbigem Punkt, darunter
 * „Neue Vorschläge". Ein Klick übernimmt und das Angebot verschwindet, weil das
 * Feld dann nicht mehr leer ist. Tippen tut dasselbe. Es gibt also nie beides
 * gleichzeitig zu lesen — genau deshalb darf der native Platzhalter währenddessen
 * auch nicht gesetzt sein, sonst liegen zwei Texte übereinander.
 *
 * Das gilt für JEDES Feld, auch das einzeilige. Vorher stand das Angebot dort
 * unter dem Feld, weil ~44 px Höhe nichts fassen. In einem Formular war dann
 * aber nicht mehr zu sehen, wozu was gehört: zwischen Hook, Details und CTA
 * lagen drei Aufzählungen im normalen Fluss und lasen sich wie Inhalt der Seite
 * statt wie Angebot des Feldes darüber. Statt das Angebot auszulagern, wächst
 * jetzt das Feld (siehe Messung weiter unten) — es bekommt unten so viel
 * Innenabstand dazu, wie das Angebot braucht, und schrumpft zurück, sobald
 * etwas drinsteht. Der
 * Textcursor bleibt dabei oben in der ersten Zeile, weil das Feld nur nach unten
 * wächst und nicht seine Zeilenhöhe ändert.
 *
 * Bewusst kein überlagerndes Dropdown bei Fokus: das versteckt die Vorschläge
 * hinter einem Klick, und in den Raster-Panels (Reel-Situation, Posen)
 * verdeckten sich mehrere Angebote gegenseitig.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Loader2, Lightbulb, Sparkles, X } from "lucide-react";
import { useAiSuggestions } from "@/hooks/useAiSuggestions";
import { suggestionCache, type SuggestSpec } from "@/lib/aiSuggest";
import { cn } from "@/lib/cn";

interface BaseProps {
  as?: "input" | "textarea";
  label?: string;
  hint?: string;
  placeholder?: string;
  rows?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /** Klassen für das Feld selbst (Höhe o. ä.). */
  fieldClassName?: string;
  /** Zeile über den Vorschlägen im leeren Feld. */
  emptyHint?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

interface Props extends BaseProps, Partial<SuggestSpec> {
  /** Vorschläge von außen (Panel holt gebündelt) — sonst holt das Feld selbst. */
  items?: string[];
  loading?: boolean;
  onReroll?: () => void;
  /** Nur beim Selbst-Holen: stabiler Schlüssel des Felds. */
  cacheKey?: string;
}

export function SuggestionField({
  as = "input", label, hint, placeholder, rows = 4, value, onChange, disabled,
  className, fieldClassName, emptyHint = "Wähle einen Vorschlag oder schreib deinen eigenen…",
  onKeyDown, items: itemsProp, loading: loadingProp, onReroll: onRerollProp, cacheKey, ...spec
}: Props) {
  const id = useId();
  const { runMany, hasGenKey } = useAiSuggestions();
  const [own, setOwn] = useState<string[]>(() => (cacheKey ? suggestionCache.get(cacheKey) ?? [] : []));
  const [ownLoading, setOwnLoading] = useState(false);
  /** Hat der Nutzer die Vorschläge selbst angefordert (Stern)? Nur dann darf das
   *  Angebot ein GEFÜLLTES Feld behelligen — siehe `replaceVisible`. */
  const [asked, setAsked] = useState(false);
  // Der aktuelle Wert gehört in den Prompt, darf aber kein Neuladen auslösen.
  const specRef = useRef(spec);
  specRef.current = spec;

  const selfFetch = itemsProp === undefined && !!cacheKey;
  const items = itemsProp ?? own;
  const loading = loadingProp ?? ownLoading;

  const load = async (force = false) => {
    if (!cacheKey || !hasGenKey) return;
    if (force) suggestionCache.clear(cacheKey);
    else if (suggestionCache.get(cacheKey)) return;
    setOwnLoading(true);
    try {
      const values = await suggestionCache.load(cacheKey, () =>
        // Beim Nachfordern zählen die eben gezeigten Vorschläge als verbraucht:
        // ohne diese Liste bekäme das Modell exakt denselben Prompt wie vorhin
        // und lieferte oft wieder dieselben drei Sätze — „Neue Vorschläge" wäre
        // dann ein Knopf, der bezahlt und nichts ändert.
        runMany({ ...(specRef.current as SuggestSpec), avoid: force ? own : undefined }),
      );
      if (values.length) setOwn(values);
    } finally {
      setOwnLoading(false);
    }
  };

  useEffect(() => {
    setAsked(false);
    if (!selfFetch || !cacheKey) return;
    const cached = suggestionCache.get(cacheKey);
    if (cached) { setOwn(cached); return; }
    setOwn([]);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, hasGenKey, selfFetch]);

  const reroll = onRerollProp ?? (selfFetch ? () => void load(true) : undefined);
  const offerVisible = !value && items.length > 0 && !disabled;
  /**
   * DAS ANGEBOT FÜR EIN GEFÜLLTES FELD — der eigentliche Sinn des Sterns.
   *
   * Das Angebot oben liegt IM Feld und setzt deshalb ein leeres Feld voraus.
   * Genau dort ist der Stern aber gar nicht sichtbar; er erscheint erst, wenn
   * etwas im Feld steht (siehe unten). Damit lief sein Klick bis hierher ins
   * Leere: Es wurde generiert, „Generiert…" lag sichtbar über dem Feld — nur
   * hatte das Ergebnis danach keinen Ort zum Anzeigen. Für den Nutzer sah der
   * ganze Vorgang aus, als ändere sich nichts.
   *
   * Also bekommt das gefüllte Feld sein Angebot UNTER sich, als eigener Kasten:
   * der bestehende Text bleibt lesbar (genau darum verlangt das In-Feld-Angebot
   * ein leeres Feld) und steht dem Vergleich zur Verfügung. Dass ein Klick ihn
   * ersetzt, sagt der Kasten dazu — anders als beim leeren Feld geht hier etwas
   * verloren. Nur auf ausdrückliche Anforderung (`asked`), damit gebündelt
   * geholte Vorschläge nicht ungefragt unter jedem ausgefüllten Feld aufgehen.
   */
  // `|| generating`: Der Kasten klappt schon auf, WÄHREND geladen wird — die
  // Meldung „Generiert…" steht dadurch genau dort, wo gleich die Vorschläge
  // stehen, statt über dem Text des Nutzers zu liegen.
  const replaceVisible = !offerVisible && !!value && asked && !disabled && (items.length > 0 || (loading && !disabled));
  /**
   * WÄHREND GENERIERT WIRD, LIEGT MILCHGLAS ÜBER DEN VORSCHLÄGEN — NICHT ÜBER
   * DEM TEXT DES NUTZERS.
   *
   * Warum es die Schicht überhaupt gibt: Vorher stand „Lädt…" als vierte Zeile
   * in der Vorschlagsliste, und beim Nachladen blieben die alten Vorschläge
   * scharf stehen und wechselten irgendwann lautlos den Text. Man sah nicht,
   * DASS gerade etwas passiert und für welches Feld.
   *
   * Warum sie jetzt gezielt liegt (Nutzerwunsch 2026-08-13): Sie deckte den
   * ganzen Feldbereich ab — auch den bereits geschriebenen Text, für den sie
   * gar nicht gedacht war. Deshalb zwei Fälle:
   *  • LEERES Feld — dort ist nichts zu verdecken, die Schicht darf wie bisher
   *    über dem Feld liegen (die Vorschläge liegen ja IM Feld).
   *  • GEFÜLLTES Feld — die Schicht liegt ausschließlich im aufgeklappten
   *    Kasten unter dem Feld. Der eigene Text bleibt lesbar und vergleichbar,
   *    genau darum geht es beim Ersetzen.
   */
  const generating = loading && !disabled;
  const busyOverField = generating && !value;

  /**
   * DAS FELD MACHT PLATZ FÜR SEIN ANGEBOT.
   *
   * Gemessen statt geraten: wie hoch das Angebot ausfällt, hängt an der Länge
   * der Vorschläge und an der Feldbreite (Umbrüche), beides ist zur Bauzeit
   * unbekannt. Vor jeder Messung wird der eigene Zuschlag zurückgenommen —
   * sonst wüchse das Feld bei jeder Messung um seinen eigenen Zuwachs weiter.
   *
   * Einzeilig wächst der untere Innenabstand: die Zeile für den Text bleibt
   * dadurch oben, der Cursor sitzt beim Hineinklicken vor dem Hinweistext und
   * nicht in der Mitte der Vorschläge. Mehrzeilig wächst `min-height` — außer
   * die Höhe gehört dem Layout (`h-full` o. ä.), dann bliebe das Feld nicht
   * mehr in seinem Kasten, und es bleibt beim bisherigen Ausschnitt.
   */
  // Ein Callback-Ref, weil derselbe Halter mal ein input und mal ein textarea
  // aufnimmt — ein RefObject wäre nur für eines von beiden typrichtig.
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const setFieldRef = (el: HTMLInputElement | HTMLTextAreaElement | null) => { fieldRef.current = el; };
  const offerBoxRef = useRef<HTMLDivElement>(null);
  const offerBodyRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef<HTMLDivElement>(null);
  /** Unser bisheriger Aufschlag und die Feldhoehe ohne ihn — damit jede Messung
   *  von derselben Grundlage ausgeht statt vom letzten Ergebnis. */
  const extraPadRef = useRef(0);
  const naturalHeightRef = useRef(0);
  const layoutOwnsHeight = /(?:^|\s)h-(?:full|screen|\[)/.test(fieldClassName ?? "");
  const itemsKey = items.join(" ");

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const clear = () => {
      field.style.paddingBottom = "";
      field.style.minHeight = "";
      extraPadRef.current = 0;
      naturalHeightRef.current = 0;
    };
    clear();
    // Die Lade-Schicht liegt bündig auf dem Feld: gleiche Rundung, sonst stünden
    // ihre Ecken über dem Rahmen.
    if (busyRef.current) busyRef.current.style.borderRadius = getComputedStyle(field).borderRadius;
    const box = offerBoxRef.current, body = offerBodyRef.current;
    if (!offerVisible || !box || !body) return;

    /**
     * Rechnet IMMER aus der Grundgroesse, nie aus dem zuletzt gesetzten Wert:
     * zweimal hintereinander gerufen kommt zweimal dasselbe heraus. Anders darf
     * es nicht sein — der ResizeObserver ruft das hier auch dann, wenn er die
     * eigene Aenderung sieht, und eine Rechnung "aktuelle Hoehe + Bedarf"
     * schaukelt sich dabei auf mehrere hundert Pixel hoch.
     */
    const fit = () => {
      const cs = getComputedStyle(field);
      // Das Angebot beginnt genau dort, wo der eigene Text begänne — deshalb
      // erbt es die Innenabstände des Feldes statt fester Klassen (ein Feld
      // ohne Rahmen und ohne Padding gibt es auch, siehe Studio-Assistent).
      const padTop = parseFloat(cs.paddingTop) || 0;
      const padLeft = parseFloat(cs.paddingLeft) || 0;
      const padRight = parseFloat(cs.paddingRight) || 0;
      const padBottomNow = parseFloat(cs.paddingBottom) || 0;
      const basePadBottom = padBottomNow - extraPadRef.current;
      box.style.padding = `${padTop}px ${padRight}px ${basePadBottom}px ${padLeft}px`;
      const needed = body.offsetHeight;

      if (as === "textarea") {
        if (layoutOwnsHeight) return;
        if (!naturalHeightRef.current) naturalHeightRef.current = field.offsetHeight;
        const borders = field.offsetHeight - field.clientHeight;
        const required = needed + padTop + basePadBottom + borders;
        field.style.minHeight = required > naturalHeightRef.current ? `${required}px` : "";
      } else {
        // Der Textbereich eines einzeiligen Feldes bleibt eine Zeile hoch, was
        // unten auch dazukommt — er ist damit ein fester Bezugspunkt.
        const line = field.clientHeight - padTop - padBottomNow;
        const extra = Math.max(0, needed - line);
        field.style.paddingBottom = extra ? `${basePadBottom + extra}px` : "";
        extraPadRef.current = extra;
      }
    };

    fit();
    // Die Angebotshöhe ändert sich mit der Feldbreite (Umbrüche) und mit
    // nachgeladenen Vorschlägen. Beobachtet wird nur der Inhalt, nie das Feld:
    // das Feld verändern wir selbst, das ergäbe eine Endlosschleife.
    const ro = new ResizeObserver(() => fit());
    ro.observe(body);
    return () => { ro.disconnect(); clear(); };
  }, [offerVisible, generating, itemsKey, as, layoutOwnsHeight, emptyHint, fieldClassName]);

  /**
   * DER STERN — Vorschläge auf Zuruf.
   *
   * Bis hierher erschienen Vorschläge nur, wenn sie von selbst geladen wurden.
   * Blieb das aus — kein Key, ein gescheiterter Aufruf, ein Panel, das gar nicht
   * gebündelt geholt hat —, sah das Feld aus wie ein gewöhnliches Eingabefeld,
   * und die KI-Hilfe war schlicht unerreichbar. Es gab keinen Knopf, der sie
   * ANFORDERT.
   *
   * Er zeigt sich aber NUR, solange kein Angebot im Feld steht: liegen die
   * Vorschläge sichtbar drin, steht „Neue Vorschläge" schon darunter, und der
   * Stern täte daneben exakt dasselbe — zwei Knöpfe für einen Griff. Sichtbar
   * ist er also genau dann, wenn er der einzige Weg zur KI ist: leeres Feld ohne
   * Vorschläge (Einstieg) oder gefülltes Feld, das das Angebot verdrängt hat.
   * Während generiert wird, verschwindet er ebenfalls — das Feld selbst zeigt
   * ja schon, dass es arbeitet.
   */
  const askAi = reroll && (() => { setAsked(true); reroll(); });
  const starTitle = !hasGenKey
    ? "Dafür wird ein API-Key gebraucht — in den Einstellungen hinterlegen."
    : items.length
      ? "Neue Vorschläge von der KI"
      : "Von der KI ausfüllen lassen";
  const star = askAi && !offerVisible && !replaceVisible && !generating ? (
    <button
      type="button"
      onClick={() => askAi()}
      disabled={disabled || !hasGenKey}
      title={starTitle}
      aria-label={starTitle}
      className={cn(
        "flex-none w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors",
        "text-flare-300 hover:bg-flare-500/15 hover:text-flare-200",
        "disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:bg-transparent",
      )}
    >
      <Sparkles className="w-3.5 h-3.5" />
    </button>
  ) : null;

  /** Die Meldung selbst — an beiden Orten dieselbe. */
  const busyBadge = (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                     bg-ink-900/85 border border-white/10 text-ink-50/80 shadow-lg">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-flare-300" />
      Generiert…
    </span>
  );

  /** Im aufgeklappten Kasten unter einem GEFÜLLTEN Feld. `rounded-[inherit]`
   *  übernimmt dessen Rundung, ohne sie doppelt zu pflegen. */
  const busyLayer = (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[inherit]
                    backdrop-blur-[3px] bg-ink-800/40 cursor-wait">
      {busyBadge}
    </div>
  );

  /** Über einem LEEREN Feld — dort liegen die Vorschläge im Feld, und es gibt
   *  keinen eigenen Text, der verdeckt werden könnte. Die Rundung setzt der
   *  Effekt oben aus der Feld-Rundung (`busyRef`). */
  const busyFieldLayer = (
    <div
      ref={busyRef}
      className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl backdrop-blur-[3px] bg-ink-800/30 cursor-wait"
    >
      {busyBadge}
    </div>
  );

  /** Übernehmen schließt den Kasten unter einem gefüllten Feld — er hat seine
   *  Aufgabe erfüllt, und im Feld steht ab jetzt genau dieser Vorschlag. */
  const pick = (s: string) => { onChange(s); setAsked(false); };

  /** Dieselbe Liste an beiden Orten: im leeren Feld und im Kasten darunter. */
  const suggestionList = (
    <div className="space-y-0.5 pointer-events-auto">
      {items.map((s, i) => (
        <button
          key={`${i}-${s.slice(0, 24)}`}
          type="button"
          onClick={() => pick(s)}
          disabled={loading}
          title="Übernehmen"
          className={cn(
            "block w-full text-left text-sm py-0.5 transition-colors",
            "text-ink-50/70 hover:text-flare-200",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <span className="text-flare-300/70 mr-1.5">•</span>{s}
        </button>
      ))}
      {reroll && (
        <button
          type="button"
          onClick={() => reroll()}
          disabled={loading}
          title="Neue Vorschläge generieren"
          className="inline-flex items-center gap-1 text-[11px] text-flare-300 hover:text-flare-200 mt-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Lightbulb className="w-3 h-3" />}
          Neue Vorschläge
        </button>
      )}
    </div>
  );

  const offer = (
    <>
      {emptyHint && <p className="text-xs text-ink-50/55 mb-2">{emptyHint}</p>}
      {suggestionList}
    </>
  );

  /**
   * DER KASTEN KLAPPT AUS DEM FELD AUF — er steht nicht daneben.
   *
   * Vorher war es ein eigener, abgesetzter Kasten (`mt-1.5`, rundum gerundet).
   * In einem Formular las er sich wie ein neuer Abschnitt der Seite statt wie
   * das Angebot des Feldes darüber — dasselbe Problem, das das In-Feld-Angebot
   * beim leeren Feld schon gelöst hatte. Jetzt sitzt er bündig an der Unterkante:
   * kein Abstand, keine obere Rundung, kein doppelter Rahmen (`-mt-px`,
   * `border-t-0`), und das Feld gibt oben passend seine unteren Ecken auf. Das
   * Aufklappen selbst macht der Grid-Trick weiter unten.
   */
  const replaceBox = (
    <div className="relative -mt-px rounded-b-xl border border-white/10 border-t-white/5 bg-ink-900/60 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-xs text-ink-50/55">
          {items.length > 0 ? "Ein Klick ersetzt, was im Feld steht:" : " "}
        </p>
        <button
          type="button"
          onClick={() => setAsked(false)}
          title="Vorschläge ausblenden — der Text im Feld bleibt"
          aria-label="Vorschläge ausblenden"
          className="flex-none w-5 h-5 -mr-1 rounded-md inline-flex items-center justify-center
                     text-ink-50/40 hover:text-ink-50/80 hover:bg-white/5 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      {/* Beim allerersten Lauf gibt es noch nichts zu zeigen — die Mindesthöhe
          hält den Kasten trotzdem auf, damit die Meldung darin Platz hat und er
          beim Eintreffen der Vorschläge nicht springt. */}
      {items.length > 0 ? suggestionList : <div className="h-14" />}
      {generating && busyLayer}
    </div>
  );

  const fieldProps = {
    id,
    value,
    disabled,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
    onKeyDown,
    // Der Platzhalter weicht, solange das Angebot im Feld liegt — zwei Texte
    // übereinander waren genau der Fehler, den das Ideenfeld schon hatte. Der
    // Hinweistext des Angebots steht an derselben Stelle und sagt dasselbe.
    placeholder: offerVisible ? "" : placeholder,
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Mit Beschriftung sitzt der Stern in deren Zeile rechts — dort, wo bei
          einem Feld ohnehin die Zusatzaktion erwartet wird, und ohne den
          Eingabebereich zu verkleinern. */}
      {label ? (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="field-label">{label}</label>
          {star}
        </div>
      ) : null}
      <div className="relative">
        {/* Ohne Beschriftung gibt es keine Zeile, in die der Stern passt —
            dann liegt er oben rechts im Feld. `top-1.5 right-1.5` hält ihn aus
            dem Textfluss heraus; einzeilige Felder bekommen zusätzlich rechts
            Platz, damit der Text nicht darunter läuft. */}
        {!label && star && <div className="absolute top-1.5 right-1.5 z-10">{star}</div>}
        {/* `block`: Ein inline-block-Feld lässt unter sich Platz für die
            Grundlinie, der umgebende `relative`-Container wird dadurch ein paar
            Pixel höher als das Feld — und das `inset-0`-Angebot ragte genau um
            diese Pixel unten heraus. */}
        {/* `rounded-b-none`, solange der Kasten aufgeklappt ist: nur so sieht es
            aus, als wüchse er aus dem Feld heraus, statt darunter zu liegen. */}
        {as === "textarea" ? (
          <textarea {...fieldProps} ref={setFieldRef} rows={rows} className={cn("field-input block resize-y min-h-24", !label && star && "pr-9", replaceVisible && "!rounded-b-none", fieldClassName)} />
        ) : (
          <input {...fieldProps} ref={setFieldRef} className={cn("field-input block", !label && star && "pr-9", replaceVisible && "!rounded-b-none", fieldClassName)} />
        )}

        {/* `pointer-events-none` auf der Hülle, `auto` auf der Liste: neben den
            Vorschlägen trifft der Klick weiterhin das Feld darunter. Die
            Innenabstände setzt der Effekt, `p-3` ist nur die Startposition für
            den ersten Aufbau. */}
        {offerVisible && (
          <div ref={offerBoxRef} className="absolute inset-0 p-3 pointer-events-none overflow-hidden">
            <div ref={offerBodyRef}>{offer}</div>
          </div>
        )}
        {/* AUFKLAPPEN statt Erscheinen: derselbe Grid-Trick wie beim
            Custom-Prompt im Studio (grid-rows 0fr → 1fr). Der Kasten bleibt
            dabei gemountet, deshalb nimmt er im zugeklappten Zustand weder
            Klicks noch Fokus an. */}
        {/* `invisible` im zugeklappten Zustand ist nicht nur Kosmetik: eine
            zugeklappte, aber sichtbare Schaltfläche bliebe mit Tab erreichbar
            und stünde im Barrierefreiheits-Baum. `visibility: hidden` nimmt sie
            aus beidem heraus, ohne sie auszuhängen — die Animation bleibt. */}
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
            replaceVisible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 invisible pointer-events-none",
          )}
        >
          <div className="overflow-hidden">{replaceBox}</div>
        </div>
        {busyOverField && busyFieldLayer}
      </div>
      {hint && <p className="text-xs text-ink-50/40 mt-1.5">{hint}</p>}
    </div>
  );
}
