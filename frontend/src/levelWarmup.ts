/**
 * Loads levels slowly in idle time so navigation and taps never stall on sync
 * getLevel / JSON parse. Never use InteractionManager here — it can stall when
 * animations are running.
 */
const pending = new Set<number>();
let timer: ReturnType<typeof setTimeout> | null = null;

const INITIAL_DELAY_MS = 4000;
const BETWEEN_LEVELS_MS = 1200;

export function scheduleLevelWarmup(...ids: number[]): void {
  for (const id of ids) {
    pending.add(Math.max(1, id));
  }
  if (timer !== null) return;
  timer = setTimeout(() => {
    timer = null;
    void drainOne();
  }, INITIAL_DELAY_MS);
}

async function drainOne(): Promise<void> {
  if (pending.size === 0) return;
  const id = pending.values().next().value as number;
  pending.delete(id);
  try {
    const levels = await import("./levels");
    if (!levels.isLevelCached(id)) {
      levels.getLevel(id);
    }
  } catch {
    // retried on next getLevel call
  }
  if (pending.size > 0) {
    timer = setTimeout(() => {
      timer = null;
      void drainOne();
    }, BETWEEN_LEVELS_MS);
  }
}
