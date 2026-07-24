/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_SERVER_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_APP_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Build-Zeit-Konstanten (injiziert via vite.config.ts `define`).
declare const __APP_VERSION__: string;
declare const __APP_BUILT__: string;
