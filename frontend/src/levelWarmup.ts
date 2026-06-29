/**
 * Pre-parses prebuilt level chunks in idle time so navigation never stalls on a
 * cold JSON parse. CRITICAL: only ever warms PREBUILT levels — it must never
 * trigger live generation, which runs synchronously and would freeze the JS
 * thread (timer + touches) mid-play. Out-of-range ids (e.g. the daily level) are
 * ignored here and generated on-demand by the game screen instead.
 */
import { PREBUILT_MAX_LEVEL } from "./prebuiltChunks";

const pending = new Set<number>();
let timer: ReturnType<typeof setTimeout> | null = null;

const INITIAL_DELAY_MS = 4000;
const BETWEEN_LEVELS_MS = 1200;

export function scheduleLevelWarmup(...ids: number[]): void {
  for (const id of ids) {
    const key = Math.max(1, id);
    // Skip live-generated levels — warming them would block the JS thread.
    if (key > PREBUILT_MAX_LEVEL) continue;
    pending.add(key);
  }
  if (pending.size === 0 || timer !== null) return;
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
    // getPlayLevelSync only parses prebuilt chunks (cheap) and never generates.
    const { getPlayLevelSync } = await import("./levelPreload");
    getPlayLevelSync(id);
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
