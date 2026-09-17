/**
 * Das Sitzungs-Token der aktuellen Anmeldung — für Module außerhalb von React
 * (Uploads in `projectAssets`). Gesetzt von `SessionTokenSync`, sobald die
 * Lizenzprüfung eins liefert; beim Abmelden wieder leer.
 */
let current: string | undefined;

export function setSessionToken(token: string | undefined): void {
  current = token;
}

export function getSessionToken(): string | undefined {
  return current;
}
