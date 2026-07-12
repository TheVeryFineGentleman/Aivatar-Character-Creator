/**
 * Generation limiter — guard against runaway loops, server abuse, and the per-plan caps.
 * Tracks per-session counters and exposes a `check` that returns whether the user may
 * generate `n` more images. Backed by sessionStorage so a reload resets the counter.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const SESSION_KEY = "aivatar:gen.session";

interface SessionCounter {
  total: number;
  perRun: number[];
  startedAt: number;
}

function read(): SessionCounter {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as SessionCounter;
  } catch { /* noop */ }
  return { total: 0, perRun: [], startedAt: Date.now() };
}

function write(value: SessionCounter) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch { /* noop */ }
}

const SOFT_HOURLY_CAP = 200; // safety net regardless of plan

export function useGenerationLimiter() {
  const { plan } = useAuth();
  const [counter, setCounter] = useState<SessionCounter>(read);

  useEffect(() => { write(counter); }, [counter]);

  /** How many images may run in a single generation pass. */
  const maxPerRun = plan.maxImagesPerRun === -1 ? 20 : plan.maxImagesPerRun;

  /** Clamp the requested count to the plan & hourly cap. */
  const clampCount = useCallback((requested: number): { allowed: number; reason: string | null } => {
    if (requested < 1) return { allowed: 0, reason: "Mindestens 1 Bild." };
    let allowed = Math.min(requested, maxPerRun);
    let reason: string | null = null;
    if (allowed < requested) reason = `Dein ${plan.label}-Plan erlaubt max. ${plan.maxImagesPerRun === -1 ? "20" : plan.maxImagesPerRun} pro Durchgang.`;
    if (counter.total + allowed > SOFT_HOURLY_CAP) {
      const remaining = Math.max(0, SOFT_HOURLY_CAP - counter.total);
      allowed = Math.min(allowed, remaining);
      reason = allowed === 0
        ? `Soft-Limit erreicht (${SOFT_HOURLY_CAP} Bilder/Session) — bitte später erneut.`
        : `Nur noch ${remaining} Bilder in dieser Session (Soft-Limit).`;
    }
    return { allowed, reason };
  }, [counter.total, maxPerRun, plan.label, plan.maxImagesPerRun]);

  const record = useCallback((count: number) => {
    setCounter((c) => ({ ...c, total: c.total + count, perRun: [...c.perRun, count].slice(-50) }));
  }, []);

  const reset = useCallback(() => {
    const fresh = { total: 0, perRun: [], startedAt: Date.now() };
    setCounter(fresh);
    write(fresh);
  }, []);

  return useMemo(() => ({
    total: counter.total,
    perRunHistory: counter.perRun,
    maxPerRun,
    softCap: SOFT_HOURLY_CAP,
    clampCount,
    record,
    reset,
  }), [counter.total, counter.perRun, maxPerRun, clampCount, record, reset]);
}
