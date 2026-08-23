import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execSync } from "child_process";

// Git-Commit des Builds — wird oben links in der TopBar angezeigt, damit man
// sofort sieht, welcher Stand deployed/geladen ist. Bevorzugt `git`; fällt sonst
// auf gängige CI-Env-Vars (DigitalOcean/Vercel/Netlify/GitHub Actions) zurück.
function buildVersion(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    const env = process.env;
    const sha =
      env.SOURCE_VERSION ||        // DigitalOcean App Platform
      env.VERCEL_GIT_COMMIT_SHA ||
      env.COMMIT_REF ||            // Netlify
      env.GITHUB_SHA ||
      "";
    return sha ? sha.slice(0, 7) : "dev";
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion()),
    __APP_BUILT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    // 5173 bleibt der Standard. PORT erlaubt eine zweite Instanz parallel zum
    // laufenden Testserver, ohne ihm den Port wegzunehmen.
    port: Number(process.env.PORT) || 5173,
  },
  // `npm start` serves the production build with `vite preview`. Since Vite
  // 5.4.12 the preview server rejects any Host header not in preview.allowedHosts
  // and answers "Blocked request. This host … is not allowed." — which also
  // blocks the JS bundle, leaving a white page. `true` accepts the custom domain
  // plus any current/future *.ondigitalocean.app URL (matches the fix on `main`).
  preview: {
    host: true,
    allowedHosts: true,
  },
});
