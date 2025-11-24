# DigitalOcean Deployment Anleitung

Dieses Projekt ist für das Deployment auf DigitalOcean App Platform optimiert.

## Voraussetzungen

- DigitalOcean Account
- GitHub Repository mit diesem Projekt
- Supabase Projekt (für Backend-Funktionen)

## Deployment-Optionen

### Option 1: DigitalOcean App Platform (Empfohlen)

1. **GitHub Repository vorbereiten**
   - Pushe deinen Code zu GitHub
   - Stelle sicher, dass die `.do/app.yaml` Datei im Repository ist

2. **App Platform App erstellen**
   - Gehe zu [DigitalOcean App Platform](https://cloud.digitalocean.com/apps)
   - Klicke auf "Create App"
   - Wähle dein GitHub Repository aus
   - DigitalOcean erkennt automatisch die `.do/app.yaml` Konfiguration

3. **Environment Variables setzen**
   Füge folgende Environment Variables in den App Settings hinzu:
   ```
   VITE_SUPABASE_URL=deine-supabase-url
   VITE_SUPABASE_PUBLISHABLE_KEY=dein-supabase-publishable-key
   VITE_SUPABASE_PROJECT_ID=deine-supabase-project-id
   ```

4. **Deploy starten**
   - Klicke auf "Create Resources"
   - DigitalOcean baut und deployt deine App automatisch

### Option 2: Docker Container (mit Node.js)

1. **Docker Image bauen**
   ```bash
   docker build -t aivatar-character-creator .
   ```

2. **Docker Container lokal testen**
   ```bash
   docker run -p 8080:8080 \
     -e VITE_SUPABASE_URL=deine-url \
     -e VITE_SUPABASE_PUBLISHABLE_KEY=dein-key \
     -e VITE_SUPABASE_PROJECT_ID=deine-id \
     aivatar-character-creator
   ```

3. **Auf DigitalOcean Container Registry pushen**
   ```bash
   # Login
   doctl registry login
   
   # Tag image
   docker tag aivatar-character-creator registry.digitalocean.com/YOUR_REGISTRY/aivatar-character-creator
   
   # Push
   docker push registry.digitalocean.com/YOUR_REGISTRY/aivatar-character-creator
   ```

### Option 3: Docker Container (mit Nginx - Schneller)

Verwende `Dockerfile.nginx` für eine performantere Lösung:

```bash
docker build -f Dockerfile.nginx \
  --build-arg VITE_SUPABASE_URL=deine-url \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=dein-key \
  --build-arg VITE_SUPABASE_PROJECT_ID=deine-id \
  -t aivatar-character-creator-nginx .
```

## Nach dem Deployment

1. **Domain konfigurieren**
   - In den App Settings kannst du eine Custom Domain hinzufügen
   - DigitalOcean konfiguriert automatisch SSL/TLS

2. **Monitoring**
   - DigitalOcean bietet integriertes Monitoring
   - Logs sind im Dashboard verfügbar

3. **Automatic Deployments**
   - Bei Push auf den main Branch deployed DigitalOcean automatisch
   - Du kannst auch manuelle Deployments triggern

## Wichtige Hinweise

- **Environment Variables**: Niemals API Keys oder Secrets ins Repository committen!
- **Build Time**: Der erste Build kann 3-5 Minuten dauern
- **Costs**: Die basic-xxs Instanz kostet ca. $5/Monat
- **Scaling**: Du kannst die Instanzgröße jederzeit in den Settings anpassen

## Troubleshooting

### Build schlägt fehl
- Überprüfe, ob alle Environment Variables gesetzt sind
- Stelle sicher, dass `package.json` alle Dependencies enthält

### App startet nicht
- Überprüfe die Logs im DigitalOcean Dashboard
- Stelle sicher, dass Port 8080 verwendet wird

### 404 Fehler bei React Router
- Die nginx.conf ist bereits für SPAs konfiguriert
- Bei App Platform wird dies automatisch gehandhabt

## Weitere Hilfe

- [DigitalOcean App Platform Docs](https://docs.digitalocean.com/products/app-platform/)
- [DigitalOcean Support](https://www.digitalocean.com/support/)
