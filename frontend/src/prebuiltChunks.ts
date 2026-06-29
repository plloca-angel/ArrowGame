import type { Level } from "./levelModel";
import {
  PREBUILT_MANIFEST,
  loadPrebuiltChunk,
} from "./prebuiltChunks.generated";

const chunkLevelsCache = new Map<number, Record<string, Level>>();

export const PREBUILT_CHUNK_SIZE = PREBUILT_MANIFEST.chunkSize;
export const PREBUILT_MAX_LEVEL = PREBUILT_MANIFEST.maxLevel;

export function chunkIndexForLevel(id: number): number {
  return Math.floor((id - 1) / PREBUILT_CHUNK_SIZE) + 1;
}

export function isPrebuiltChunkLoaded(index: number): boolean {
  return chunkLevelsCache.has(index);
}

export function loadedPrebuiltChunkCount(): number {
  return chunkLevelsCache.size;
}

export function clearPrebuiltChunkCache(): void {
  chunkLevelsCache.clear();
}

/** Load one 20-level JSON chunk on demand (sync — parses ~60 KB, not the full bundle). */
export function getPrebuiltLevelSync(
  id: number,
  cacheVersion: number
): Level | undefined {
  if (cacheVersion !== PREBUILT_MANIFEST.version) return undefined;
  if (id < 1 || id > PREBUILT_MAX_LEVEL) return undefined;

  const chunkIndex = chunkIndexForLevel(id);
  let levels = chunkLevelsCache.get(chunkIndex);
  if (!levels) {
    const chunk = loadPrebuiltChunk(chunkIndex);
    if (chunk.version !== cacheVersion) return undefined;
    levels = chunk.levels;
    chunkLevelsCache.set(chunkIndex, levels);
  }

  return levels[String(id)];
}

/** Which chunk indices cover a level id (for warmup / prefetch). */
export function prebuiltChunkIndicesForLevels(...ids: number[]): number[] {
  const set = new Set<number>();
  for (const id of ids) {
    if (id >= 1 && id <= PREBUILT_MAX_LEVEL) {
      set.add(chunkIndexForLevel(id));
    }
  }
  return [...set].sort((a, b) => a - b);
}

/** Eagerly load chunk JSON into memory (same cost as first getLevel in that range). */
export function warmPrebuiltChunk(index: number, cacheVersion: number): void {
  if (cacheVersion !== PREBUILT_MANIFEST.version) return;
  if (chunkLevelsCache.has(index)) return;
  const chunk = loadPrebuiltChunk(index);
  if (chunk.version === cacheVersion) {
    chunkLevelsCache.set(index, chunk.levels);
  }
}
