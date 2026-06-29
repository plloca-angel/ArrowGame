/**
 * Demo: only the chunk that contains the requested level is parsed.
 *
 * Usage: npx tsx scripts/demo-chunk-load.ts
 */
import { performance } from "node:perf_hooks";
import { clearLevelCache, getLevel } from "../src/levels";
import {
  clearPrebuiltChunkCache,
  chunkIndexForLevel,
  loadedPrebuiltChunkCount,
  prebuiltChunkIndicesForLevels,
} from "../src/prebuiltChunks";

function bench(label: string, id: number): void {
  clearLevelCache();
  clearPrebuiltChunkCache();

  const chunksBefore = loadedPrebuiltChunkCount();
  const t0 = performance.now();
  const level = getLevel(id);
  const ms = performance.now() - t0;
  const chunksAfter = loadedPrebuiltChunkCount();

  console.log(
    `${label}: level ${id} (${level.rows}×${level.cols}, ${level.arrows.length} arrows) — ${ms.toFixed(1)} ms, chunks loaded: ${chunksBefore} → ${chunksAfter} (chunk #${chunkIndexForLevel(id)})`
  );
}

console.log("Prebuilt chunk demo (20 levels per batch)\n");

bench("First load in batch 1", 1);
bench("Another in batch 1 (chunk already warm)", 5);
bench("First load in batch 2", 21);
bench("First load in batch 10", 199);

console.log(
  `\nWarmup targets for levels 18–22 would load chunks: ${prebuiltChunkIndicesForLevels(18, 19, 20, 21, 22).join(", ")}`
);
