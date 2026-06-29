/**
 * Fixes arrow directions in chunked prebuilt levels so tips never point into body cells.
 * Run after changing exit-direction rules: npx tsx scripts/patch-prebuilt-exit-directions.ts
 */
import fs from "fs";
import path from "path";
import type { Level } from "../src/levelModel";
import type { PrebuiltChunk, PrebuiltManifest } from "../src/prebuiltChunkTypes";
import {
  arrowExitDirectionValid,
  sanitizeLevelArrowDirections,
} from "../src/levelModel";
import { LEVEL_CACHE_VERSION } from "../src/levels";

const prebuiltDir = path.join(__dirname, "..", "src", "data", "prebuilt");
const manifestPath = path.join(prebuiltDir, "manifest.json");
const manifest = JSON.parse(
  fs.readFileSync(manifestPath, "utf8")
) as PrebuiltManifest;

let fixed = 0;
let stillInvalid = 0;

for (const chunkMeta of manifest.chunks) {
  const chunkPath = path.join(prebuiltDir, chunkMeta.file);
  const chunk = JSON.parse(fs.readFileSync(chunkPath, "utf8")) as PrebuiltChunk;

  for (const [id, level] of Object.entries(chunk.levels)) {
    const before = JSON.stringify(level.arrows.map((a) => a.direction));
    const sanitized = sanitizeLevelArrowDirections(level);
    const after = JSON.stringify(sanitized.arrows.map((a) => a.direction));
    if (before !== after) fixed++;
    chunk.levels[id] = sanitized;
    for (let i = 0; i < sanitized.arrows.length; i++) {
      const a = sanitized.arrows[i];
      if (!arrowExitDirectionValid(a.cells, a.direction)) {
        stillInvalid++;
        console.warn(`Level ${id} arrow ${i} still invalid after sanitize`);
      }
    }
  }

  chunk.version = LEVEL_CACHE_VERSION;
  fs.writeFileSync(chunkPath, JSON.stringify(chunk));
}

manifest.version = LEVEL_CACHE_VERSION;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(
  `Patched prebuilt chunks v${LEVEL_CACHE_VERSION}: ${fixed} levels updated, ${stillInvalid} arrows still invalid`
);
