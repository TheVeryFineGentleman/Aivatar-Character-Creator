const FALLBACK_BACKEND_URL = "https://wpewsxohwwvdrinowxjb.supabase.co";
const FALLBACK_BACKEND_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwZXdzeG9od3d2ZHJpbm93eGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNDY1NjQsImV4cCI6MjA3NzkyMjU2NH0.a2n9C7I-cc2kJUTViGglEsvkCOfjZv7I9NBY1DQD6Rw";

const INVALID_ENV_VALUES = new Set(["", "undefined", "null"]);

const resolvePublicConfigValue = (value: string | undefined, fallback: string) => {
  const normalized = value?.trim() ?? "";
  return INVALID_ENV_VALUES.has(normalized) ? fallback : normalized;
};

export const getBackendUrl = () =>
  resolvePublicConfigValue(import.meta.env.VITE_SUPABASE_URL, FALLBACK_BACKEND_URL);

export const getBackendPublishableKey = () =>
  resolvePublicConfigValue(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, FALLBACK_BACKEND_PUBLISHABLE_KEY);

export const hasBackendConfig = () => Boolean(getBackendUrl() && getBackendPublishableKey());

export const getFunctionUrl = (functionName: string) => {
  const sanitizedFunctionName = functionName.replace(/^\/+/, "");
  return `${getBackendUrl()}/functions/v1/${sanitizedFunctionName}`;
};

export const getFunctionHeaders = () => {
  const key = getBackendPublishableKey();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
    apikey: key,
  };
};