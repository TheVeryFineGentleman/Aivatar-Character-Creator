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
  "fal-api-key":    { id: "1208742538", hash: "a09c3ad479" },
  "quick":          { id: "1208742580", hash: "87633225d5" },
  "chat":           { id: "1208742640", hash: "4e705b8f85" },
  "views":          { id: "1208742714", hash: "fc92ed444e" },
  "poses":          { id: "1208742758", hash: "46ff5f6c65" },
  "remix":          { id: "1208742823", hash: "f667f4f8ef" },
  "studio":         { id: "1208742903", hash: "cad591d5af" },
  "story":          { id: "1208743202", hash: "0921a6333b" },
};
