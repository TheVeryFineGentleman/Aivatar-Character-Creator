

## Plan: Dockerfile vereinfachen

**Problem:** `Dockerfile.nginx` existiert als einziges Dockerfile, aber der Name verursacht Verwirrung. Außerdem nutzt es `npm ci` obwohl das Projekt `bun.lock` hat — das verursacht den Lock-File-Konflikt.

**Änderungen:**

1. **`Dockerfile.nginx` → `Dockerfile` umbenennen** (löschen + neu erstellen)
   - Inhalt bleibt gleich, aber `npm ci` wird durch `bun install --frozen-lockfile` ersetzt
   - `package-lock.json` wird nicht mehr benötigt

2. **`.do/app.yaml`** — `dockerfile_path` von `Dockerfile.nginx` auf `Dockerfile` ändern

3. **`package-lock.json` löschen** — nur `bun.lock` bleibt, kein Konflikt mehr

4. **`.doignore` anpassen** — `package-lock.json` Eintrag entfernen (nicht mehr nötig)

### Dockerfile (neu):
```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY bun.lock package.json ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
RUN bun run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

**Ergebnis:** Ein einziges `Dockerfile`, konsistent mit `bun.lock`, kein Lock-File-Konflikt mehr.

