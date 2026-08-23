/**
 * Thin re-export over `sonner` so call sites don't import sonner directly.
 * Keeps a single seam for future swaps (custom toast UI, telemetry, etc.).
 */

import { toast as sonnerToast } from "sonner";

export const toast = sonnerToast;
export function useToast() {
  return { toast: sonnerToast };
}
