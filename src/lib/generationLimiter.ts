// Global generation concurrency limiter
// Ensures max 2 concurrent generations across ALL tabs (poses, story, character)

const MAX_GLOBAL_CONCURRENT = 2;

let activeGenerations = 0;
const waitQueue: Array<() => void> = [];

export const getActiveGenerations = () => activeGenerations;

export const acquireGenerationSlot = (): Promise<void> => {
  if (activeGenerations < MAX_GLOBAL_CONCURRENT) {
    activeGenerations++;
    console.log(`🔒 Generation slot acquired (${activeGenerations}/${MAX_GLOBAL_CONCURRENT})`);
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    console.log(`⏳ Waiting for generation slot (${activeGenerations}/${MAX_GLOBAL_CONCURRENT} active, ${waitQueue.length + 1} queued)`);
    waitQueue.push(() => {
      activeGenerations++;
      console.log(`🔒 Generation slot acquired from queue (${activeGenerations}/${MAX_GLOBAL_CONCURRENT})`);
      resolve();
    });
  });
};

export const releaseGenerationSlot = () => {
  activeGenerations = Math.max(0, activeGenerations - 1);
  console.log(`🔓 Generation slot released (${activeGenerations}/${MAX_GLOBAL_CONCURRENT})`);
  
  if (waitQueue.length > 0) {
    const next = waitQueue.shift()!;
    next();
  }
};

export const getAvailableSlots = () => MAX_GLOBAL_CONCURRENT - activeGenerations;
