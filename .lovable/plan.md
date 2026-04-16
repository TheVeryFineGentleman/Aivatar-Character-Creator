

# Plan: Client-seitige Timeouts auf 120s angleichen

## Problem
Wenn ein einzelnes Bild regeneriert wird (Szene neu generieren oder nur Bild neu generieren), bricht der Client nach **40 Sekunden** die Verbindung ab. Google verarbeitet die Anfrage aber weiter und bucht Geld ab — das Bild kommt nur nie