import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    port: 5173,
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
