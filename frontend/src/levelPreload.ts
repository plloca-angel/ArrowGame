import type { Level } from "./levelModel";
import { sanitizeLevelArrowDirections } from "./levelModel";
import {
  chunkIndexForLevel,
  getPrebuiltLevelSync,
  PREBUILT_MAX_LEVEL,
  warmPrebuiltChunk,
} from "./prebuiltChunks";
import { PREBUILT_MANIFEST } from "./prebuiltChunks.generated";

const playCache = new Map<number, Level>();
let levelsModulePromise: Promise<typeof import("./levels")> | null = null;

export function preloadLevelsModule(): Promise<typeof import("./levels")> {
  if (!levelsModulePromise) {
    levelsModulePromise = import("./levels");
  }
  return levelsModulePromise;
}

/** Parse only the JSON chunk that contains this level (~60 KB, no generator). */
export function warmChunkForLevel(id: number): void {
  if (id < 1 || id > PREBUILT_MAX_LEVEL) return;
  warmPrebuiltChunk(chunkIndexForLevel(id), PREBUILT_MANIFEST.version);
}

/** Instant for prebuilt levels 1–200 when the chunk is warm. */
export function getPlayLevelSync(id: number): Level | null {
  const cached = playCache.get(id);
  if (cached) return cached;

  if (id >= 1 && id <= PREBUILT_MAX_LEVEL) {
    const prebuilt = getPrebuiltLevelSync(id, PREBUILT_MANIFEST.version);
    if (prebuilt) {
      const level = sanitizeLevelArrowDirections(prebuilt);
      playCache.set(id, level);
      return level;
    }
  }
  return null;
}

/** Full loader — uses prebuilt fast path first, then procedural for ids > prebuilt max. */
export async function resolvePlayLevel(id: number): Promise<Level> {
  const sync = getPlayLevelSync(id);
  if (sync) return sync;

  const levels = await preloadLevelsModule();
  const level = levels.getLevel(id);
  playCache.set(id, level);
  return level;
}

/**
 * Background pre-warm for an upcoming level. ONLY warms prebuilt levels — never
 * triggers live generation, which runs synchronously and would freeze the JS
 * thread (timer + touches) mid-play. Daily puzzles map into the prebuilt pool.
 */
export function primePlayLevel(id: number): void {
  if (id < 1 || id > PREBUILT_MAX_LEVEL) return;
  warmChunkForLevel(id);
  void resolvePlayLevel(id);
}

/** True when this id is served from prebuilt chunks (cheap, non-blocking). */
export function isPrebuiltPlayLevel(id: number): boolean {
  return id >= 1 && id <= PREBUILT_MAX_LEVEL;
}

export function clearPlayLevelCache(): void {
  playCache.clear();
}
