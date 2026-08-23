/**
 * Vimeo-Referenzen der Tutorial-Videos — Slug → { id, hash }.
 *
 * Wird aus dem Upload-Ergebnis befüllt (Vimeo-Account "Aivatar Upload").
 * `id === ""` bedeutet: noch nicht hochgeladen / wird verarbeitet — das Panel
 * zeigt dann einen Platzhalter statt des Players.
 *
 * `hash` ist der Privacy-Token für "unlisted" Videos und MUSS beim Embed
 * mitgegeben werden (player.vimeo.com/video/<id>?h=<hash>).
 */
export interface VimeoRef {
  id: string;
  hash: string | null;
}

export const TUTORIAL_VIDEOS: Record<string, VimeoRef> = {
  "google-api-key": { id: "1208742473", hash: "27306971f3" },
  // Neuaufnahme vom 2026-08-09; ersetzt die Fassung 1208742538/a09c3ad479.
  // Die alte Datei liegt noch im Vimeo-Konto und muss dort gelöscht werden —
  // hier verweist nichts mehr auf sie.
  "fal-api-key":    { id: "1216786777", hash: "e352cdb59f" },
  "eleven-voice":   { id: "1216786782", hash: "168d54d63e" },
  "quick":          { id: "1208742580", hash: "87633225d5" },
  "chat":           { id: "1208742640", hash: "4e705b8f85" },
  "views":          { id: "1208742714", hash: "fc92ed444e" },
  "poses":          { id: "1208742758", hash: "46ff5f6c65" },
  "remix":          { id: "1208742823", hash: "f667f4f8ef" },
  "studio":         { id: "1208742903", hash: "cad591d5af" },
  // Neuaufnahme vom 2026-08-22; ersetzt die Fassung 1208743202/0921a6333b.
  // Die alte Datei liegt noch im Vimeo-Konto und muss dort gelöscht werden.
  "story":          { id: "1220152669", hash: "792872f59e" },
};
