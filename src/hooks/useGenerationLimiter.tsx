import { useState, useCallback, useSyncExternalStore } from "react";

// Global generation concurrency limiter
// Ensures max 2 concurrent generations across ALL tools
const MAX_CONCURRENT = 2;

let activeCount = 0;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((l) => l());

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const getSnapshot = () => activeCount;

export const incrementGeneration = () => {
  activeCount++;
  console.log(`🔒 Generation started (${activeCount}/${MAX_CONCURRENT})`);
  notify();
};

export const decrementGeneration = () => {
  activeCount = Math.max(0, activeCount - 1);
  console.log(`🔓 Generation ended (${activeCount}/${MAX_CONCURRENT})`);
  notify();
};

export const isGenerationLimitReached = () => activeCount >= MAX_CONCURRENT;

export const useGenerationLimiter = () => {
  const active = useSyncExternalStore(subscribe, getSnapshot);
  const limitReached = active >= MAX_CONCURRENT;

  return { activeGenerations: active, limitReached, MAX_CONCURRENT };
};
