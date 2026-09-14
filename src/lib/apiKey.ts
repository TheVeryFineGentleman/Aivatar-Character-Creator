/**
 * Macht aus einem eingefügten Key den Key.
 *
 * Kopiert wird aus Mails, Notizen, .env-Dateien und Chat-Verläufen — und mit
 * dem Key kommen Anführungszeichen, Zeilenumbrüche, geschützte oder
 * unsichtbare Leerzeichen mit. Google sieht dann eine andere Zeichenkette und
 * antwortet „API key not valid", obwohl am Key selbst nichts falsch ist
 * (Kundenfall 2026-09: der Key wurde mitsamt Anführungszeichen gespeichert).
 *
 * Kein Key der drei Dienste enthält Leerraum, also fällt der überall weg;
 * Anführungszeichen nur an den Rändern, dort landen sie beim Kopieren.
 */
export function cleanApiKey(raw: string): string {
  return (raw || "")
    .replace(/[\s​-‍⁠﻿]/g, "")
    .replace(/^["'`„“”‚‘’«»]+|["'`„“”‚‘’«»]+$/g, "");
}

/**
 * Hinweis, wenn der Key nicht nach dem Dienst aussieht, zu dem das Feld gehört
 * — oder `null`. Häufigster Fall mit zwei Pflicht-Keys: beide gültig, aber
 * vertauscht.
 *
 * Bewusst nur ein HINWEIS unter dem Feld, keine Sperre und kein Ersatz für die
 * echte Prüfung: Key-Formate ändern sich, und ein Hinweis, der die Antwort von
 * Google verdeckt, lässt einen gültigen Key kaputt aussehen. Google-Keys
 * beginnen bisher mit „AIza"; fal-Keys haben die Form `<id>:<secret>`.
 */
export function keyFormatHint(kind: "google" | "fal", raw: string): string | null {
  const key = cleanApiKey(raw);
  if (!key) return null;
  if (kind === "google") {
    if (key.startsWith("AIza")) return null;
    if (key.includes(":")) return "Das sieht nach deinem fal.ai-Key aus — der gehört ins Feld darunter.";
    return "Google-Keys beginnen normalerweise mit „AIza“. Prüf, ob du den ganzen Key erwischt hast — nach dem Speichern fragen wir direkt bei Google nach.";
  }
  if (key.startsWith("AIza")) return "Das ist ein Google-Key — der gehört ins Feld darüber.";
  return null;
}
