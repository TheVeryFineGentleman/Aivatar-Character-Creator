// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const allowedHosts = [
  "localhost",
  "127.0.0.1",
  "aivatar-character-creator-z5i9x.ondigitalocean.app",
];

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  preview: {
    host: "0.0.0.0",
    // Port ist egal, DO setzt ihn über --port $PORT,
    // wichtig ist hier nur allowedHosts:
    allowedHosts,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
