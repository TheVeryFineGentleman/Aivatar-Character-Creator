/**
 * Server-AI proxy — talks to the self-hosted Express endpoints on `apiUrl`.
 * Used for things that don't fit pure client-side: video generation, FFmpeg merging,
 * YouTube transcripts.
 *
 * Body / response shapes mirror Server/server.js verbatim — do NOT invent new fields.
 */

import { API } from "@/lib/backend";
import { AIError } from "@/lib/ai";

function looksLikeConnectionRefused(err: unknown): boolean {
  // The browser surfaces a network-level failure as TypeError("Failed to fetch")
  // — Firefox also calls it "NetworkError". CORS-was-blocked-because-no-response
  // arrives the same way. Catch them all here so callers get a useful hint.
  if (err instanceof TypeError) return true;
  const msg = String((err as any)?.message || "");
  return /fail|network|cors|fetch/i.test(msg);
}

async function postJson<T = any>(path: string, body: unknown, init: RequestInit = {}, timeoutMs?: number): Promise<T> {
  // Optional per-request timeout. The timer stays armed across the BODY read too,
  // because the finishing poll-video response streams the whole finished MP4 as
  // base64 — a stall lives in that body stream, not the headers. A timeout maps to
  // a transient NETWORK error so runVideoJob re-polls instead of hanging at 95%.
  let timedOut = false;
  const ctrl = timeoutMs ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs) : null;
  try {
    let res: Response;
    try {
      res = await fetch(API(path), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(init.headers || {}) },
        body: JSON.stringify(body),
        ...init,
        ...(ctrl ? { signal: ctrl.signal } : {}),
      });
    } catch (e) {
      if (timedOut) throw new AIError("NETWORK", "Zeitüberschreitung beim Server-Aufruf.");
      if (looksLikeConnectionRefused(e)) {
        throw new AIError(
          "SERVER_UNREACHABLE",
          "Backend-Server nicht erreichbar.",
          `Läuft der Express-Server unter ${API("")}? (npm run dev im /Server-Ordner)`,
        );
      }
      throw new AIError("NETWORK", "Netzwerkfehler beim Server-Aufruf.");
    }
    if (!res.ok) {
      // Read the body ONCE as text, then try JSON — a reverse-proxy/gateway error
      // (nginx 502/504, Cloudflare, PM2 restart page, Express 413 PayloadTooLarge)
      // isn't JSON, and res.json() would otherwise swallow the real cause.
      let raw = "";
      try { raw = await res.text(); } catch { /* noop */ }
      let payload: any = null;
      try { payload = raw ? JSON.parse(raw) : null; } catch { /* noop */ }
      const text = payload?.error || payload?.message || (raw ? raw.slice(0, 300) : `Server-Fehler (${res.status}).`);
      throw new AIError(res.status, text);
    }
    try {
      return (await res.json()) as T;
    } catch (e) {
      if (timedOut) throw new AIError("NETWORK", "Zeitüberschreitung beim Server-Aufruf.");
      throw new AIError("NETWORK", "Ungültige Server-Antwort.");
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getJson<T = any>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API(path));
  } catch (e) {
    if (looksLikeConnectionRefused(e)) {
      throw new AIError("SERVER_UNREACHABLE", "Backend-Server nicht erreichbar.");
    }
    throw new AIError("NETWORK", "Netzwerkfehler beim Server-Aufruf.");
  }
  if (!res.ok) {
    let raw = ""; try { raw = await res.text(); } catch { /* noop */ }
    throw new AIError(res.status, raw || `Server-Fehler (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

/* ============================================================
 * Video pipeline (Google Veo / fal.ai via server)
 * ============================================================ */

// "kling" läuft serverseitig über fal (fal-ai/kling-video/...) und benutzt
// deshalb den fal-Key — es ist kein eigener Anbieter, sondern ein anderes Modell
// hinter demselben Zugang.
export type VideoProvider = "google" | "fal" | "kling";

/** Mirrors the `params` object the server expects on start-video. */
export interface StartVideoParams {
  prompt: string;
  startImageDataUrl?: string;  // base64 data: URL — REQUIRED for Google Veo
  endImageDataUrl?: string;
  aspectRatio?: string;        // "9:16" | "16:9" | "1:1"
  durationSeconds?: number;
  /** Nur Kling: eigenes Feld für Verbote (Untertitel, Morphing, Schnitte …).
   *  Zählt dort nicht gegen das 2500-Zeichen-Limit des Haupt-Prompts. */
  negativePrompt?: string;
}

export interface StartVideoOpts {
  params: StartVideoParams;
  provider: VideoProvider;
  apiKey: string;
  modelCandidates?: string[];
}

export interface StartVideoResult {
  handle: string;             // "google:<operation>" or "fal:<model>|<id>"
  modelUsed: string;
}

export interface PollVideoOpts {
  handle: string;
  provider: VideoProvider;
  apiKey: string;
  /** Spec Schritt 5: den fertigen Clip serverseitig auf 1080×1920/25fps bringen.
   *  NUR für 9:16 setzen — bei 16:9 oder 1:1 würde der Crop das gewählte Format
   *  zerschneiden. Kommt dann als `videoDataUrl` zurück. */
  normalize916?: boolean;
  /** Klings Standbild-Schwanz hinter dem letzten Wort abschneiden (Stille +
   *  eingefrorenes Bild, gemessen 0,9–2,5 s pro Clip). Nur für ai-avatar-Clips
   *  sinnvoll; die Veo-Strecke braucht ihre volle Cliplänge für den Dub. */
  trimTail?: boolean;
}

/**
 * WO der Auftrag gerade steht. Bisher gab es nur „processing" — ein Wort für
 * vier grundverschiedene Zustände, und damit keine Grundlage für die Frage
 * „warten oder aufgeben?".
 *
 * • `queue`   — steht bei fal in der Schlange, nichts gerendert, nichts bezahlt
 * • `render`  — das Modell arbeitet
 * • `deliver` — bei fal FERTIG, nur der Ergebnis-Abruf klemmt (Clip ist bezahlt)
 * • `post`    — unser eigener Server schneidet/normalisiert (Clip ist bezahlt)
 */
export type VideoJobPhase = "queue" | "render" | "deliver" | "post";

export interface PollVideoResult {
  status: "processing" | "completed" | "failed";
  videoUrl?: string;
  /** Nur beim abschließenden Poll mit `normalize916`: der normalisierte Clip.
   *  Der Server liefert `videoUrl` daneben WEITER (die rohe fal-URL) — wer nur
   *  die liest, bekommt still das unnormalisierte Original. */
  videoDataUrl?: string;
  error?: string;
  /** Siehe `VideoJobPhase`. Fehlt bei älteren Servern — Aufrufer müssen ohne
   *  auskommen (dann verhält sich alles wie vorher). */
  phase?: VideoJobPhase;
  /** Nur `queue`: Position in fals Warteschlange, wenn fal sie mitschickt. */
  queuePosition?: number;
  /** Nur `post`: wie lange die Nachbearbeitung schon läuft (Sekunden). */
  postSec?: number;
  /** Nur `deliver`: seit wie vielen Sekunden der Abruf klemmt. */
  stuckSec?: number;
}

export function startVideo(opts: StartVideoOpts): Promise<StartVideoResult> {
  return postJson<StartVideoResult>("/api/ai/start-video", opts);
}

export interface TalkingAvatarOpts {
  /** Was gesprochen wird. Bestimmt zugleich die Cliplänge.
   *  Entfällt, wenn die Spur über `audioDataUrl`/`audioUrl` fertig mitkommt. */
  text?: string;
  /** Premade-NAME (fal-Weg) oder echte voice_id (eigener ElevenLabs-Key).
   *  Ebenfalls nur nötig, wenn der Server die Stimme selbst erzeugen soll. */
  voiceId?: string;
  /** Fertige Sprachspur. Die Story-Strecke nimmt IMMER diesen Weg: `renderSceneVoice`
   *  kennt Delivery-Tags, Modellwahl und Tempo der Szene — der Server könnte das
   *  nicht nachbilden, ohne die Einstellungen des Voice-Pickers zu übergehen. */
  audioDataUrl?: string;
  /** Bereits in fal-Storage liegende Spur — spart beim Resubmit den Upload. */
  audioUrl?: string;
  /** Nur informativ (der Server misst sie beim Eigenbau selbst): wird 1:1
   *  zurückgegeben, damit der Aufrufer die Cliplänge kennt. */
  audioDurationSec?: number | null;
  /** Startbild der Szene — als data: oder https. Der Server lädt es zu fal hoch. */
  imageDataUrl?: string;
  imageUrl?: string;
  apiKey: string;      // fal
  elevenKey?: string;  // optional: dann native/geklonte Stimmen
  languageCode?: string;
  stability?: number;
  style?: number;
  similarityBoost?: number;
  /** Welcher Avatar-Renderer den Clip baut. Default "kling" (`ai-avatar`,
   *  Ein-Gesicht-Szenen). "omnihuman" = fal `bytedance/omnihuman/v1.5` für
   *  DUO-Szenen: zwei sichtbare Personen, die Maske bestimmt den Sprecher.
   *  Kein Fallback zwischen beiden — ein Fehler bleibt ein Fehler. */
  engine?: "kling" | "omnihuman";
  /** Sprecher-Maske (nur OmniHuman): weiße Fläche = die Person, die spricht.
   *  Muss dieselben Abmessungen haben wie das Startbild. */
  maskDataUrl?: string;
  /** Optionaler Führungs-Prompt (nur OmniHuman — Kling ai-avatar kennt keinen). */
  prompt?: string;
}

export interface TalkingAvatarResult {
  handle: string;
  modelUsed: string;
  audioUrl: string;
  audioDurationSec: number | null;
}

/**
 * Sprechenden Clip erzeugen: Text → Stimme → Kling `ai-avatar` (Bild + Audio).
 *
 * Der entscheidende Unterschied zu `startVideo`: Es gibt KEINE Cliplänge zu
 * wählen — das Audio bestimmt sie. Damit entfallen auf einen Schlag das Raten
 * der Dauer (6/8 s gegen Klings 5/10 s), das stille Abschneiden durch
 * `sync_mode` und der separate Lipsync-Schritt: der Mund gehört von Anfang an
 * zum Ton, statt nachträglich daraufgelegt zu werden.
 *
 * Gepollt wird über dieselbe `pollVideo`-Strecke — das Handle trägt bereits die
 * von fal gelieferten status/response-URLs.
 */
export function startTalkingAvatar(opts: TalkingAvatarOpts): Promise<TalkingAvatarResult> {
  // Großzügiger Timeout: der Server macht TTS, zwei Uploads und den Submit in
  // EINEM Request, bevor er antwortet.
  return postJson<TalkingAvatarResult>("/api/ai/talking-avatar", opts, {}, 120_000);
}

export function pollVideo(opts: PollVideoOpts): Promise<PollVideoResult> {
  // 120s ceiling: the completing poll makes the server download+base64-inline the
  // whole finished MP4. If that body stalls, time out → transient → runVideoJob
  // re-polls (the server re-fetches on the next poll) instead of hanging forever.
  return postJson<PollVideoResult>("/api/ai/poll-video", opts, {}, 120_000);
}

export interface RunVideoProgress {
  status: "processing" | "completed" | "failed";
  handle: string;
  ticks: number;
  videoUrl?: string;
  error?: string;
  /** Der Schritt, den der Server zuletzt gemeldet hat — für die Anzeige an der
   *  Szene. Fehlt, solange noch kein Poll durch ist. */
  phase?: VideoJobPhase;
  queuePosition?: number;
  /**
   * Nur auf der Avatar-Strecke: die GETRIMMTE Sprechdauer, sobald der Submit
   * durch ist.
   *
   * Sie ist der einzige Schnittpunkt, den der Zusammenschnitt später kennt — und
   * nach einem Reload gibt es keine zweite Gelegenheit, sie zu erfahren:
   * `resumeVideoJob` liefert nur die Video-URL zurück. Ohne diese Meldung stünde
   * in der Szene weiter die UNGETRIMMTE Dauer aus dem TTS-Lauf, und der
   * Schnitt am Clipende liefe ins Leere.
   */
  audioDurationSec?: number | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Terminal (non-retryable) video failures — surface these immediately.
 * Everything else (network blips, transient 5xx, "Status-Abfrage/Video-Download
 * fehlgeschlagen", rate limits) is treated as transient and retried, so a single
 * hiccup does not kill a scene mid-reel.
 *
 * NOTE: lastFrame/"not supported" MUST stay terminal so the caller's
 * retry-without-end-frame path still triggers.
 */
const TERMINAL_VIDEO_ERR =
  /Inhaltsrichtlinie|raiMedia|Veo-Zugriff|ohne Veo|Allowlist|API-Key ung(ü|ue)ltig|Ung(ü|ue)ltiges oder fehlendes Startbild|lastFrame|not supported|isn'?t supported by this model|Kein Video in|Ergebnis-Fehler|Status-Fehler|nicht ausgeliefert|Alle Veo-Modelle fehlgeschlagen|Kein API-Key/i;
// „nicht ausgeliefert": der Server hat aufgegeben, weil ein FERTIGER fal-Job
// seinen Ergebnis-Abruf 90 s lang mit 404/504 verweigert hat. Muss hier
// terminal sein, sonst pollt diese Schleife zwölf weitere Male, der Server
// startet dabei jedes Mal seine 90-s-Uhr neu, und beide warten im Wechsel
// aufeinander — genau die zehn Minuten Schweigen, gegen die der Deckel gebaut
// wurde. Der Clip ist dabei nicht verloren: das Handle bleibt an der Szene,
// „Ergebnis abholen" bekommt ein frisches Zeitfenster.
// „Kein Video in" statt „Kein Video in der Antwort": der Server meldete
// „Kein Video in fal.ai-Antwort", was hier NICHT griff — ein fertiger Job galt
// deshalb als vorübergehender Aussetzer und wurde sechsmal nachgepollt, bevor
// der Fehler ankam. Ergebnis-/Status-Fehler sind ebenfalls terminal: sie
// bedeuten eine kaputte Anfrage, die auch beim siebten Versuch kaputt bleibt.

function isTransientVideoError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  return !TERMINAL_VIDEO_ERR.test(msg);
}

/**
 * Die Poll-Schleife hinter `runVideoJob` UND `runLipsyncJob`. Bewusst geteilt
 * statt kopiert: sync-lipsync liefert auf fal exakt dieselbe Output-Shape wie
 * Veo (`result.video.url`) und läuft deshalb über denselben Endpoint
 * `/api/ai/poll-video`. Verhalten und Fehlermeldungen sind unverändert die von
 * `runVideoJob` (inkl. TERMINAL_VIDEO_ERR-Logik).
 */
async function pollUntilDone(
  handle: string,
  provider: VideoProvider,
  apiKey: string,
  onProgress: ((p: RunVideoProgress) => void) | undefined,
  signal: AbortSignal | undefined,
  pollMs: number,
  deadline: number,
  normalize916 = false,
  trimTail = false,
): Promise<string> {
  // Großzügig, und das ist seit der serverseitigen Umstellung auch billig: der
  // Server rechnet die Nachbearbeitung eines Auftrags nur noch EINMAL und hält
  // das Ergebnis bereit. Ein wiederholter Poll kostet ihn deshalb einen
  // Dateizugriff statt eines kompletten Re-Encodes — früher war jeder dieser
  // Versuche eine neue Minute Arbeit, weshalb hier eine kleine Zahl stehen
  // musste. Genau daran starben einzelne Szenen: die Antwort ging unterwegs
  // verloren (Gateway-Grenze bei großen Clips), und nach sechs gleich teuren
  // Fehlversuchen war ein längst fertiger, bezahlter Clip verloren.
  const MAX_CONSECUTIVE_POLL_FAILS = 12;
  let ticks = 0;
  let consecutiveFails = 0;

  // ═══ DIE UHR DARF NICHT BLIND LAUFEN ═══════════════════════════════════════
  //
  // Hier stand eine einzige feste Frist. Sie hat nie gefragt, WO der Auftrag
  // steht — und war damit kuerzer als die Summe der Wartezeiten, die der Weg
  // selbst voellig regulaer mitbringt:
  //
  //   fal-Schlange + Render          unbegrenzt, real 1-6 Min. (Duo mehr)
  //   Ergebnis-Auslieferung          bis 90 s (serverseitige Notbremse)
  //   Nachbearbeitung auf dem Server bis 4 Min. Warten + 2,5 Min. Arbeit
  //                                  (EIN Platz, drei parallele Szenen)
  //
  // Ein gesunder Lauf konnte so ueber zehn Minuten brauchen, ohne dass irgendwo
  // etwas kaputt war — und lief trotzdem in „dauert zu lange". Der Clip war zu
  // diesem Zeitpunkt fertig und bezahlt; verloren ging nur der Weg zu ihm.
  //
  // Deshalb jetzt ZWEI Fristen. Die normale (`deadline`) gilt, solange der
  // Auftrag noch beim Anbieter liegt. Meldet der Server dagegen `deliver` oder
  // `post`, ist der Clip BEWEISBAR vorhanden und bezahlt — dann gibt es die
  // Nachfrist, weil Aufgeben an dieser Stelle die mit Abstand teuerste Antwort
  // waere. Die Nachfrist ist bewusst laenger als das Zeitbudget der
  // serverseitigen Nachbearbeitung: die endet IMMER, notfalls mit der
  // unbearbeiteten Original-URL, und genau darauf wartet sie.
  const CLIP_EXISTS_GRACE_MS = 8 * 60 * 1000;
  const hardDeadline = deadline + CLIP_EXISTS_GRACE_MS;
  let lastPhase: VideoJobPhase | undefined;
  const clipExists = () => lastPhase === "deliver" || lastPhase === "post";
  const expired = () => Date.now() >= (clipExists() ? hardDeadline : deadline);

  while (!expired()) {
    if (signal?.aborted) throw new AIError("ABORTED", "Video-Generierung abgebrochen.");
    await sleep(pollMs);
    ticks++;

    let tick: PollVideoResult;
    try {
      tick = await pollVideo({ handle, provider, apiKey, normalize916, trimTail });
    } catch (e) {
      // Transient error just talking to the server — keep the job alive.
      if (!isTransientVideoError(e) || ++consecutiveFails >= MAX_CONSECUTIVE_POLL_FAILS) throw e;
      onProgress?.({ status: "processing", handle, ticks, phase: lastPhase });
      continue;
    }

    if (tick.phase) lastPhase = tick.phase;
    onProgress?.({ ...tick, handle, ticks });
    // `videoDataUrl` zuerst: mit `normalize916` ist DAS der fertige Clip, während
    // `videoUrl` weiterhin das rohe fal-Original zeigt.
    if (tick.status === "completed" && (tick.videoDataUrl || tick.videoUrl)) {
      return tick.videoDataUrl || tick.videoUrl!;
    }
    if (tick.status === "failed") {
      const err = new AIError("VIDEO_FAIL", tick.error || "Video-Generierung fehlgeschlagen.");
      // Terminal → surface now (content filter, Veo access, lastFrame, …).
      if (!isTransientVideoError({ message: tick.error }) || ++consecutiveFails >= MAX_CONSECUTIVE_POLL_FAILS) throw err;
      // Transient server-side blip (download/status). The server re-fetches the
      // finished video on the next poll, so keep going.
      continue;
    }
    consecutiveFails = 0; // a clean "processing" tick clears the transient streak
  }
  // DER HINWEIS HAT IN DIE FALSCHE RICHTUNG GEZEIGT.
  //
  // Er lautete „Versuche es erneut oder mit kürzerer Dauer." — beides falsch:
  // Die Cliplänge ist gar keine Stellschraube (Kling kennt nur 5 oder 10 s, und
  // die Renderzeit hängt kaum daran), und „erneut versuchen" ist hier die TEURE
  // Antwort: Der Auftrag läuft beim Anbieter weiter und wird auch fertig — ein
  // neuer Lauf bezahlt denselben Clip ein zweites Mal. Richtig ist der Knopf
  // „Ergebnis abholen" an der Szene, der genau an diesem Fall hängt
  // (`videoJobId` vorhanden + videoStatus "error").
  //
  // UND SIE SAGT JETZT, WOMIT SIE ABGELAUFEN IST.
  //
  // „dauert zu lange" allein liess offen, ob der Auftrag in der Schlange stand,
  // rendete oder laengst fertig war — drei Zustaende mit drei verschiedenen
  // richtigen Reaktionen. Der Wortlaut „dauert zu lange" bleibt trotzdem im
  // Satz: `AVATAR_DELIVERY_ERR` und die Hinweis-Logik in StoryPage haengen an
  // genau dieser Wendung.
  const phaseText =
    lastPhase === "queue"
      ? "Der Auftrag steht bei fal noch in der Warteschlange."
      : lastPhase === "post"
        ? "Der Clip ist fertig, nur die Nachbearbeitung auf dem Server war nicht rechtzeitig durch."
        : lastPhase === "deliver"
          ? "Der Clip ist bei fal fertig, wird aber gerade nicht ausgeliefert."
          : "Der Auftrag rendert beim Anbieter noch.";
  throw new AIError(
    "VIDEO_TIMEOUT",
    `Video-Generierung dauert zu lange — ${phaseText}`,
    "Der Auftrag läuft beim Anbieter weiter — hol ihn mit „Ergebnis abholen“ an der Szene. Ein neuer Lauf würde denselben Clip ein zweites Mal bezahlen.",
  );
}

/**
 * Start a video and poll until done. Reports each tick to `onProgress`.
 * Provider + apiKey are forwarded to the server so it knows which backend to call.
 *
 * Resilient by design: `startVideo` is retried on transient errors, and a
 * transient poll failure (network drop, transient server 5xx, or a server
 * "failed" whose message is a transient download/status blip) does NOT abort the
 * job — the server re-fetches the finished video on the next poll, so we keep
 * polling until the overall deadline. Genuinely terminal failures still throw
 * right away.
 */
export async function runVideoJob(
  opts: StartVideoOpts,
  onProgress?: (p: RunVideoProgress) => void,
  signal?: AbortSignal,
  pollMs = 5000,
  // 18 statt 8 Minuten. Die alten acht waren keine Grosszuegigkeitsfrage,
  // sondern schlicht zu kurz fuer den Weg: Kling-Render (1-6 Min.) plus
  // Nachbearbeitung auf dem EINEN Server-Platz (bis 6,5 Min., wenn drei Szenen
  // parallel fertig werden) passen darin nicht zusammen. Pollen kostet nichts,
  // ein weggeworfener fertiger Clip schon — dieselbe Abwaegung, die bei
  // `resumeVideoJob` schon immer im Kommentar stand.
  timeoutMs = 18 * 60 * 1000,
): Promise<string> {
  if (!opts.apiKey) {
    throw new AIError("NO_KEY", "Kein API-Key gesetzt.", "Trag den Key in den Einstellungen ein.");
  }
  // Kling braucht das Startbild genauso wie Veo — der Guard galt aber nur für
  // Google. Bei Kling lief der Aufruf deshalb erst zum Server und kam von dort
  // als „Ungültiges oder fehlendes Startbild" zurück, mit Upload dazwischen.
  if (!opts.params.startImageDataUrl) {
    throw new AIError(
      "NO_REFERENCE",
      "Für den Clip fehlt das Startbild.",
      "Erst Bild für die Szene generieren, dann erneut starten.",
    );
  }

  const deadline = Date.now() + timeoutMs;
  const MAX_START_ATTEMPTS = 3;

  // Start with retry/backoff on transient errors.
  let start: StartVideoResult | undefined;
  for (let attempt = 1; ; attempt++) {
    if (signal?.aborted) throw new AIError("ABORTED", "Video-Generierung abgebrochen.");
    try {
      start = await startVideo(opts);
      break;
    } catch (e) {
      if (!isTransientVideoError(e) || attempt >= MAX_START_ATTEMPTS || Date.now() > deadline) throw e;
      await sleep(Math.min(15000, 2000 * attempt));
    }
  }
  onProgress?.({ status: "processing", handle: start.handle, ticks: 0 });

  return pollUntilDone(start.handle, opts.provider, opts.apiKey, onProgress, signal, pollMs, deadline);
}

/**
 * Einen BEREITS LAUFENDEN Auftrag weiterverfolgen — ohne neuen Submit.
 *
 * Der Handle traegt alles Noetige (`fal:modell|id`, `google:operation`), der
 * Poll-Endpoint braucht sonst nur den Key. Damit ueberlebt ein Lauf einen
 * Reload: statt ihn neu zu starten (und ein zweites Mal zu bezahlen), haengt
 * sich die neue Sitzung an den alten Auftrag.
 *
 * Bewusst ein FRISCHES Zeitfenster statt „Startzeit + Restbudget": Pollen kostet
 * nichts, ein weggeworfener fertiger Clip schon.
 */
export function resumeVideoJob(
  handle: string,
  apiKey: string,
  opts: { normalize916?: boolean; trimTail?: boolean; timeoutMs?: number } = {},
  onProgress?: (p: RunVideoProgress) => void,
  signal?: AbortSignal,
  pollMs = 5000,
): Promise<string> {
  if (!apiKey) throw new AIError("NO_KEY", "Kein API-Key für die Wiederaufnahme.");
  const provider: VideoProvider = handle.startsWith("google:") ? "google" : "fal";
  return pollUntilDone(
    handle, provider, apiKey, onProgress, signal, pollMs,
    // 15 statt 6 Minuten. Sechs waren WENIGER als das, was die serverseitige
    // Nachbearbeitung allein im Extremfall braucht (4 Min. Warten + 2,5 Min.
    // Arbeit) — „Ergebnis abholen" konnte also am selben gesunden Zustand
    // scheitern wie der Lauf davor, und der Nutzer drueckte den Knopf ein
    // zweites und drittes Mal.
    Date.now() + (opts.timeoutMs ?? 15 * 60 * 1000),
    !!opts.normalize916, !!opts.trimTail,
  );
}

/**
 * Auslieferungs-Störung — der Job ist durch, nur das Ergebnis kommt nicht an.
 *
 * Genau DAS ist der Fall, den Spec §6.2 mit „denselben Job frisch neu submitten"
 * beantwortet: eine neue `request_id` bekommt einen neuen Ergebnis-Blob, während
 * der alte dauerhaft 404/504 liefert. Abzugrenzen von echten Fehlern (Key,
 * Rate-Limit, Inhaltsfilter, fehlendes Bild) — die bleiben beim zweiten Versuch
 * identisch und kosten dann nur ein zweites Mal Geld.
 */
const AVATAR_DELIVERY_ERR =
  /Kein Video in|Ergebnis-Fehler|Status-Fehler|dauert zu lange|nicht ausgeliefert|Video-Download|Zeitüberschreitung|Ungültige Server-Antwort|Netzwerkfehler|Server-Fehler \(5\d\d\)|Bad Gateway|Gateway Time-?out/i;
// Die zweite Hälfte kam dazu, weil genau diese Fehler den Clip NICHT betreffen,
// sondern nur seinen Weg zurück: ein gekappter Request, ein 502/504 vom Gateway,
// eine abgerissene Antwort. Vorher galten sie als „unbekannter Fehler", der
// Resubmit blieb aus, und die Szene starb mit einem fertigen Clip beim Anbieter.

export interface TalkingAvatarJobResult {
  /** Der fertige Clip: data:-URL wenn normalisiert, sonst die fal-URL. */
  videoUrl: string;
  /** Die verwendete Sprachspur (fal-Storage) — für Resubmits und die Anzeige. */
  audioUrl: string;
  audioDurationSec: number | null;
  modelUsed: string;
}

/**
 * Sprechenden Clip erzeugen und bis zum fertigen Video pollen.
 *
 * Unterschied zu `runVideoJob`: keine Cliplänge, kein Prompt, kein
 * nachgelagerter Lipsync-Schritt — der Mund gehört von Anfang an zum Ton.
 * Dafür gibt es hier den Auto-Resubmit aus Spec §6.2: bleibt das Ergebnis eines
 * FERTIGEN Jobs aus, wird derselbe Job einmal frisch eingereicht. Die Sprachspur
 * liegt dann schon in fal-Storage und geht als `audioUrl` mit — der zweite
 * Versuch kostet also keine zweite Vertonung.
 *
 * Bewusst KEINE Endlosschleife (§10.4): ein Resubmit, danach der ehrliche Fehler.
 */
export async function runTalkingAvatarJob(
  opts: TalkingAvatarOpts & { normalize916?: boolean; trimTail?: boolean },
  onProgress?: (p: RunVideoProgress) => void,
  signal?: AbortSignal,
  pollMs = 6000,
  // Kling ai-avatar braucht typisch 2–4 Min (Spec §6.8) — großzügiger als die
  // Veo-Strecke, damit ein normal langsamer Job nicht als „hängt" gilt.
  //
  // Von 10 auf 22 Minuten: die typischen 2–4 Min. sind der RENDER, nicht der
  // Weg. Dahinter liegen die fal-Schlange (unter Last minutenlang), OmniHuman
  // bei Duo-Szenen (deutlich langsamer als ai-avatar) und die serverseitige
  // Nachbearbeitung mit ihrem einen Platz. Die alten zehn Minuten waren die
  // Grenze, an der ein gesunder Duo-Lauf regelmäßig starb.
  timeoutMs = 22 * 60 * 1000,
): Promise<TalkingAvatarJobResult> {
  if (!opts.apiKey) {
    throw new AIError("NO_KEY", "Kein fal.ai-Key gesetzt.", "Trag den Key in den Einstellungen ein.");
  }
  if (!opts.imageDataUrl && !opts.imageUrl) {
    throw new AIError("NO_REFERENCE", "Sprechender Avatar benötigt ein Startbild.", "Erst Bild für die Szene generieren.");
  }

  const deadline = Date.now() + timeoutMs;
  const MAX_SUBMITS = 2; // Erstversuch + EIN Resubmit (Spec §6.2)
  let audioUrl = opts.audioUrl;
  let audioDurationSec = opts.audioDurationSec ?? null;
  let lastErr: unknown;

  for (let submit = 1; submit <= MAX_SUBMITS; submit++) {
    if (signal?.aborted) throw new AIError("ABORTED", "Video-Generierung abgebrochen.");

    // Submit selbst einmal wiederholen: ein Netzaussetzer soll den Versuch nicht
    // verbrennen — dieselbe Logik wie in `runVideoJob`.
    let start: TalkingAvatarResult | undefined;
    for (let attempt = 1; ; attempt++) {
      try {
        // Ab dem zweiten Anlauf die bereits hochgeladene Spur wiederverwenden —
        // und die base64-Fassung dann WEGLASSEN. Sonst ginge derselbe MP3-Body
        // ein zweites Mal über die Leitung, obwohl der Server ihn gar nicht mehr
        // anfasst (er bevorzugt `audioUrl`).
        start = await startTalkingAvatar(
          audioUrl ? { ...opts, audioUrl, audioDataUrl: undefined } : opts,
        );
        break;
      } catch (e) {
        // Der Server verlangt noch zwingend `text`/`voiceId`? Dann läuft er auf
        // dem Stand VOR der Avatar-Route — node lädt server.js nur beim Start.
        // Das ist NICHT transient: jeder weitere Versuch scheitert identisch, und
        // der Rückfall auf die klassische Kette liefert danach Clips, deren Lippen
        // nicht passen. Genau dieses Symptom ist ohne klare Ansage nicht als
        // „Server veraltet" erkennbar — deshalb sofort raus, mit Anleitung.
        if (/Missing text|Missing voiceId/i.test(String((e as any)?.message ?? e ?? ""))) {
          throw new AIError(
            "SERVER_OUTDATED",
            "Der AI-Server kennt die Talking-Avatar-Route noch nicht.",
            "AI-Server neu starten — er lädt server.js nur beim Start.",
          );
        }
        if (!isTransientVideoError(e) || attempt >= 3 || Date.now() > deadline) throw e;
        await sleep(Math.min(15000, 2000 * attempt));
      }
    }
    // Ein alter Server kennt `engine` nicht und startet still Kling — der Clip
    // würde bei einem Duo-Bild ein beliebiges der beiden Gesichter animieren.
    // `modelUsed` verrät das sofort; dann lieber hart abbrechen (der eine
    // Kling-Submit ist verloren, aber ein FALSCHER Clip wäre teurer: er fällt
    // erst im fertigen Schnitt auf).
    if (opts.engine === "omnihuman" && !/omnihuman/i.test(start.modelUsed || "")) {
      throw new AIError(
        "SERVER_OUTDATED",
        "Der AI-Server kennt OmniHuman noch nicht.",
        "AI-Server neu starten — er lädt server.js nur beim Start.",
      );
    }
    audioUrl = start.audioUrl || audioUrl;
    // NUR beim ERSTEN Submit übernehmen. Ab dem zweiten geht die bereits
    // hochgeladene Spur als `audioUrl` mit; der Server überspringt dann seinen
    // Trim-Block und echot exakt den UNGETRIMMTEN Wert zurück, den wir ihm
    // geschickt haben. Der würde die zuvor gemessene, getrimmte Dauer
    // überschreiben — und der Schnitt am Clipende läge danach HINTER dem
    // Sprechende, wäre also wirkungslos.
    if (submit === 1 && start.audioDurationSec != null) audioDurationSec = start.audioDurationSec;
    // Die Dauer sofort mitmelden, nicht erst am Ende des Laufs: Bricht die
    // Sitzung zwischen Submit und Ergebnis ab, holt die Wiederaufnahme zwar den
    // Clip, aber keine Dauer mehr.
    onProgress?.({ status: "processing", handle: start.handle, ticks: 0, audioDurationSec });

    try {
      const videoUrl = await pollUntilDone(
        start.handle, "fal", opts.apiKey, onProgress, signal, pollMs, deadline,
        !!opts.normalize916, !!opts.trimTail,
      );
      return { videoUrl, audioUrl: audioUrl || "", audioDurationSec, modelUsed: start.modelUsed };
    } catch (e) {
      lastErr = e;
      if (signal?.aborted) throw e;
      const msg = String((e as any)?.message ?? e ?? "");
      // Mindestens eine Minute Restzeit verlangen: ein Resubmit in ein
      // Zehn-Sekunden-Fenster erzeugt nur Kosten und läuft garantiert in denselben
      // Timeout. Ein echter Timeout hat das Budget ohnehin schon aufgebraucht —
      // dort greift der Resubmit also bewusst gar nicht mehr.
      const canResubmit =
        submit < MAX_SUBMITS && AVATAR_DELIVERY_ERR.test(msg) && deadline - Date.now() > 60_000;
      if (!canResubmit) throw e;
      // eslint-disable-next-line no-console
      console.warn("[ai-avatar] Ergebnis kam nicht an — Job wird einmal frisch eingereicht:", msg);
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new AIError("VIDEO_FAIL", "Sprechender Avatar konnte nicht erzeugt werden.");
}

/* ============================================================
 * Voice-Lock (ElevenLabs TTS, ffmpeg-Dub, sync-lipsync — alle via Server)
 * ============================================================ */

export interface TtsOpts {
  text: string;
  /**
   * Was hier stehen muss, hängt vom Weg ab — der Server entscheidet ihn anhand
   * von `elevenKey`:
   * • ohne `elevenKey` (fal-Weg): ein NAME aus dem Premade-Enum (ELEVEN_VOICES).
   *   Eine voice_id wird dort mit 422 abgelehnt.
   * • mit `elevenKey` (direkt): eine echte `voice_id` — nur so sind eigene,
   *   geklonte und native deutsche Stimmen erreichbar.
   */
  voice: string;
  languageCode?: string;
  speed?: number;              // 0.7..1.2 — der Server clamped zusätzlich
  stability?: number;          // 0..1
  similarityBoost?: number;    // 0..1
  style?: number;              // 0..1
  previousText?: string;
  nextText?: string;
  /** Welches ElevenLabs-Modell. Fehlt es, nimmt der Server multilingual-v2
   *  (Abwärtskompatibilität für alle bestehenden Aufrufer).
   *
   *  eleven-v3 versteht dafür Inline-Audio-Tags im `text` ([excited], [whispers]
   *  …), kennt aber WEDER `speed` NOCH `style`/`similarityBoost`/`previousText`/
   *  `nextText`. Diese Felder werden serverseitig aus dem v3-Request gefiltert —
   *  trotzdem gehören sie hier gar nicht erst mitgeschickt. */
  model?: "multilingual-v2" | "eleven-v3";
  /** fal-Key. Trägt den fal-Weg; bei gesetztem `elevenKey` ungenutzt. */
  apiKey: string;
  /**
   * Eigener ElevenLabs-Key. Ist er gesetzt, spricht der Server ElevenLabs
   * DIREKT an (`eleven_multilingual_v2`) statt über fal — `voice` ist dann eine
   * voice_id. Ohne Key bleibt alles beim fal-Weg.
   */
  elevenKey?: string;
}

export interface TtsResult {
  audioDataUrl: string;
  durationSec: number | null;
  mimeType: string;
}

/** Erzeugt eine Sprachspur mit FESTER Stimme. Sync-Route — TTS ist schnell. */
export function ttsSpeak(opts: TtsOpts): Promise<TtsResult> {
  return postJson<TtsResult>("/api/ai/tts", opts, {}, 120_000);
}

/** Eine Stimme aus dem ElevenLabs-Account. `voiceId` ist der Wert, der als
 *  `voice` in `ttsSpeak` gehört. */
export interface ElevenVoice {
  voiceId: string;
  name: string;
  /** "premade" = Katalog; alles andere (cloned/generated/professional) = eigen. */
  category: string;
  language: string;
  gender: string;
  description: string;
}

/**
 * Die Stimmen des eigenen ElevenLabs-Accounts.
 *
 * Erst über den eigenen Server (`/api/ai/eleven-voices`), weil der Key dort
 * ohnehin schon für TTS durchläuft und kein CORS im Weg steht. Antwortet der
 * Server nicht mit einer Liste — etwa weil eine ältere key-manager-Version ohne
 * diese Route deployed ist —, wird ElevenLabs direkt aus dem Browser gefragt.
 * Ohne diesen Rückfall bliebe die Auswahl auf einem nicht mitgezogenen Backend
 * einfach leer, ohne dass irgendwo etwas kaputt aussieht.
 */
export async function listElevenVoices(elevenKey: string): Promise<ElevenVoice[]> {
  if (!elevenKey) throw new AIError("NO_KEY", "Kein ElevenLabs-Key gesetzt.");

  try {
    const res = await postJson<{ voices: ElevenVoice[] }>("/api/ai/eleven-voices", { elevenKey }, {}, 30_000);
    if (Array.isArray(res?.voices)) return res.voices;
  } catch (e) {
    console.warn("[voices] Server-Route nicht verfügbar — frage ElevenLabs direkt:", e);
  }

  const resp = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": elevenKey },
  });
  if (!resp.ok) {
    throw new AIError(
      resp.status === 401 ? "NO_KEY" : "NETWORK",
      resp.status === 401 ? "ElevenLabs-Key ungültig." : `Stimmen konnten nicht geladen werden (${resp.status}).`,
    );
  }
  const data = await resp.json();
  return (data?.voices || []).map((v: any) => ({
    voiceId: v.voice_id,
    name: v.name,
    category: v.category || "",
    language: v?.labels?.language || "",
    gender: v?.labels?.gender || "",
    description: v?.labels?.description || v?.labels?.use_case || "",
  }));
}

export interface DubOpts {
  video: { base64?: string; dataUrl?: string; url?: string };
  audio: { base64?: string; dataUrl?: string; url?: string };
  maxTempo?: number;
  loudnorm?: boolean;
}

export interface DubServerResult {
  success: boolean;
  video: string;       // base64 mp4 — server's actual response field
  mimeType: string;
  videoDurationSec: number | null;
  audioDurationSec: number | null;
  tempo: number;
  truncated: boolean;
}

export interface DubResult {
  dataUrl: string;
  tempo: number;
  /** Sprechtext war länger als der Clip und wurde gekürzt → UI muss warnen. */
  truncated: boolean;
  videoDurationSec: number | null;
  audioDurationSec: number | null;
}

/** Tauscht die Tonspur eines Clips gegen die TTS-Spur (ffmpeg, ohne Re-Encode
 *  des Bildes). 180s Timeout: der Body trägt Video UND Audio in beide Richtungen. */
export async function dubVideo(opts: DubOpts): Promise<DubResult> {
  const result = await postJson<DubServerResult>("/api/ai/dub", opts, {}, 180_000);
  return {
    dataUrl: `data:${result.mimeType || "video/mp4"};base64,${result.video}`,
    tempo: result.tempo,
    truncated: !!result.truncated,
    videoDurationSec: result.videoDurationSec ?? null,
    audioDurationSec: result.audioDurationSec ?? null,
  };
}

/** Anbieter der Lipsync-Kette. Reihenfolge = Reihenfolge der Versuche. */
export type LipsyncProvider = "sync-v3" | "veed" | "latentsync" | "sync-v2";

/**
 * Nur EIN Anbieter: sync-lipsync (beste Qualität).
 *
 * Hier standen vorher drei (`sync-v3`, `veed`, `latentsync`), damit der Ausfall
 * eines fal-Dienstes die Lippensynchronität nicht lahmlegt. Der Preis war ein
 * anderer Mund pro Anbieter — im selben Reel nebeneinander sofort sichtbar.
 * Verfügbarkeit ist hier weniger wert als ein einheitliches Ergebnis; fällt
 * sync-lipsync aus, scheitert die Vertonung mit Begründung.
 */
export const LIPSYNC_CHAIN: LipsyncProvider[] = ["sync-v3"];

export interface StartLipsyncOpts {
  videoUrl?: string;
  videoDataUrl?: string;
  audioUrl?: string;
  audioDataUrl?: string;
  model?: "lipsync-2" | "lipsync-2-pro";
  syncMode?: "cut_off" | "loop" | "bounce" | "silence" | "remap";
  /** Welcher Anbieter — wird von `runLipsyncJob` pro Versuch gesetzt. */
  lipsyncModel?: LipsyncProvider;
  apiKey: string;
}

export function startLipsync(opts: StartLipsyncOpts): Promise<StartVideoResult> {
  return postJson<StartVideoResult>("/api/ai/start-lipsync", opts);
}

/**
 * Lipsync starten und pollen. Gepollt wird über den BESTEHENDEN
 * `/api/ai/poll-video` — dasselbe Handle-Format, dieselbe Output-Shape.
 * Lipsync läuft immer über Provider "fal".
 */
export async function runLipsyncJob(
  opts: StartLipsyncOpts,
  onProgress?: (p: RunVideoProgress) => void,
  signal?: AbortSignal,
  pollMs = 5000,
  timeoutMs = 8 * 60 * 1000,
): Promise<string> {
  if (!opts.apiKey) {
    throw new AIError("NO_KEY", "Kein API-Key gesetzt.", "Trag den fal.ai-Key in den Einstellungen ein.");
  }
  const deadline = Date.now() + timeoutMs;

  // ── Anbieter-Kette ────────────────────────────────────────────────────────
  // Ein einzelnes Modell macht die Lippensynchronität von der Verfügbarkeit
  // genau eines fal-Dienstes abhängig — und genau der (sync-lipsync) war
  // wochenlang gestört: Jobs liefen durch, meldeten COMPLETED, und das Ergebnis
  // kam dauerhaft als 504. Deshalb wird bei Ausfall der nächste Anbieter
  // versucht, statt sofort auf den Ton-Ersatz zurückzufallen.
  const chain = opts.lipsyncModel ? [opts.lipsyncModel] : LIPSYNC_CHAIN;
  let lastErr: unknown;

  for (const provider of chain) {
    if (signal?.aborted) throw new AIError("ABORTED", "Vertonung abgebrochen.");
    if (Date.now() > deadline) break;
    try {
      // Start einmal wiederholen: ein einzelner Netzaussetzer soll den Anbieter
      // nicht verbrennen. Mehr Versuche lohnen nicht — dafür gibt es die Kette.
      let start: StartVideoResult | undefined;
      for (let attempt = 1; ; attempt++) {
        try {
          start = await startLipsync({ ...opts, lipsyncModel: provider });
          break;
        } catch (e) {
          if (!isTransientVideoError(e) || attempt >= 2 || Date.now() > deadline) throw e;
          await sleep(2000);
        }
      }
      onProgress?.({ status: "processing", handle: start.handle, ticks: 0 });
      const url = await pollUntilDone(start.handle, "fal", opts.apiKey, onProgress, signal, pollMs, deadline);
      if (import.meta.env.DEV) console.log(`[lipsync] erfolgreich über "${provider}"`);
      return url;
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
      // eslint-disable-next-line no-console
      console.warn(`[lipsync] Anbieter "${provider}" fehlgeschlagen — nächster Versuch:`, e);
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new AIError("LIPSYNC_FAIL", "Kein Lipsync-Anbieter konnte den Clip verarbeiten.");
}

/* ============================================================
 * Video merge (FFmpeg concat via server)
 * ============================================================ */

export interface MergeVideosOpts {
  /** Base64-encoded MP4s — matches the server's `{ videos: string[] }` body. */
  videos: string[];
}

export interface MergeVideosServerResult {
  success: boolean;
  video: string;       // base64 mp4 — server's actual response field
  mimeType: string;
}

export interface MergeVideosResult {
  dataUrl: string;
}

/** Fetches a video at `src` (data:, blob:, http(s):) and returns the raw base64 payload. */
async function videoSrcToBase64(src: string): Promise<string> {
  if (src.startsWith("data:")) return src.split(",")[1] || "";
  const res = await fetch(src);
  if (!res.ok) throw new AIError(res.status, `Konnte Video nicht laden: ${src}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function mergeVideos(opts: {
  sources: string[];
  aspectRatio?: string;
  seamless?: boolean;
  /**
   * Schnittpunkt je Clip in Sekunden, index-gleich zu `sources`: ab dieser
   * Sekunde fällt der Clip weg. `null` = der Server misst selbst, wo das
   * Gesprochene endet (Default).
   */
  cuts?: (number | null)[];
}): Promise<MergeVideosResult> {
  if (!opts.sources?.length) throw new AIError("NO_INPUT", "Keine Videos zum Mergen.");
  const videos = await Promise.all(opts.sources.map(videoSrcToBase64));
  const result = await postJson<MergeVideosServerResult>("/api/merge-videos", {
    videos,
    aspectRatio: opts.aspectRatio,
    seamless: opts.seamless,
    cuts: opts.cuts,
  });
  return { dataUrl: `data:${result.mimeType || "video/mp4"};base64,${result.video}` };
}

/* ============================================================
 * Misc proxies (text, image, transcript)
 * ============================================================ */

export interface TranscriptResult {
  text: string;
  source?: "youtube" | "fallback";
  language?: string;
}

export function fetchTranscript(youtubeUrl: string): Promise<TranscriptResult> {
  return postJson<TranscriptResult>("/api/ai/transcript", { url: youtubeUrl });
}

export interface ImageRef { mimeType: string; base64: string; }

/**
 * fal.ai image generation via the server proxy (nano-banana / nano-banana/edit).
 * Returns a data: URL. Throws AIError on block/empty so the caller can fall back.
 * The server route expects { prompt, provider, apiKey, options:{ referenceImages,
 * aspectRatio } } where referenceImages are data-URL strings.
 */
export async function serverGenerateImageFal(opts: {
  prompt: string; apiKey: string; references?: ImageRef[]; aspectRatio?: string;
}): Promise<string> {
  const referenceImages = (opts.references ?? []).map((r) => `data:${r.mimeType};base64,${r.base64}`);
  const res = await postJson<{ dataUrl: string | null; blocked?: boolean }>("/api/ai/generate-image", {
    prompt: opts.prompt,
    provider: "fal",
    apiKey: opts.apiKey,
    options: { referenceImages, aspectRatio: opts.aspectRatio },
  });
  if (res?.blocked) throw new AIError("BLOCKED", "fal.ai hat den Inhalt blockiert (Moderation).");
  if (!res?.dataUrl) throw new AIError("NO_IMAGE", "fal.ai lieferte kein Bild.");
  return res.dataUrl;
}

/**
 * fal.ai text generation via the server proxy (fal-ai/any-llm). Returns the text.
 * Server route expects { parts:[{text}|{inlineData}], options:{model}, provider,
 * apiKey } — NOT { prompt } (that was the old broken shape).
 */
export async function serverGenerateTextFal(opts: {
  prompt: string; apiKey: string; model?: string; references?: ImageRef[];
}): Promise<string> {
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  for (const r of opts.references ?? []) parts.push({ inlineData: { mimeType: r.mimeType, data: r.base64 } });
  parts.push({ text: opts.prompt });
  const res = await postJson<{ text: string }>("/api/ai/generate-text", {
    provider: "fal",
    apiKey: opts.apiKey,
    parts,
    options: { model: opts.model },
  });
  return (res?.text ?? "").toString();
}

/* ============================================================
 * Storage quota
 * ============================================================ */

/**
 * Was der Server über den Speicher eines Kunden WIRKLICH weiss: nur wie viele
 * Storage-Boost-Addons aktiv sind (`GET /api/storage/quota` → `{ activeAddons }`).
 * Der tatsächliche Verbrauch liegt im localStorage des Kunden und ist
 * serverseitig nicht sichtbar — deshalb hier bewusst kein `usedBytes`.
 */
export interface ServerStorageInfo {
  activeAddons: number;
}

export async function fetchStorageInfo(email: string): Promise<ServerStorageInfo> {
  const data = await getJson<{ activeAddons?: number }>(`/api/storage/quota?email=${encodeURIComponent(email)}`);
  return { activeAddons: Number(data?.activeAddons || 0) };
}

export interface StorageCheckoutOpts {
  email: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface StorageCheckoutResult {
  url: string;
}

export function startStorageCheckout(opts: StorageCheckoutOpts): Promise<StorageCheckoutResult> {
  return postJson<StorageCheckoutResult>("/api/storage/checkout", opts);
}

/* ============================================================
 * Durable asset storage (DigitalOcean Spaces, via server)
 * ============================================================ */

export interface UploadAssetOpts {
  projectId: string;
  id: string;
  kind: "image" | "video";
  email?: string;
  /** A base64 `data:` URL — used for generated images. */
  dataUrl?: string;
  /** A remote URL the server fetches itself — used for fal/Veo videos (avoids CORS). */
  sourceUrl?: string;
  contentType?: string;
}

export interface UploadAssetResult {
  url: string;   // durable public/CDN URL
  bytes?: number;
}

/**
 * Upload a generated image/video to the bucket and get back a durable URL.
 * Throws AIError (e.g. 503) when Spaces isn't configured — callers should catch
 * and fall back to the ephemeral source.
 */
export function uploadAsset(opts: UploadAssetOpts): Promise<UploadAssetResult> {
  return postJson<UploadAssetResult>("/api/storage/upload", opts);
}
