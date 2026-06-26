/**
 * Fixes arrow directions in the prebuilt bundle so tips never point into body cells.
 * Run after changing exit-direction rules: npx tsx scripts/patch-prebuilt-exit-directions.ts
 */
import fs from "fs";
import path from "path";
import type { Level } from "../src/levelModel";
import {
  arrowExitDirectionValid,
  sanitizeLevelArrowDirections,
} from "../src/levelModel";
import { LEVEL_CACHE_VERSION } from "../src/levels";

const outPath = path.join(__dirname, "..", "src", "data", "prebuiltLevels.json");
const raw = JSON.parse(fs.readFileSync(outPath, "utf8")) as {
  version: number;
  maxLevel: number;
  levels: Record<string, Level>;
};

let fixed = 0;
let stillInvalid = 0;

for (const [id, level] of Object.entries(raw.levels)) {
  const before = JSON.stringify(level.arrows.map((a) => a.direction));
  const sanitized = sanitizeLevelArrowDirections(level);
  const after = JSON.stringify(sanitized.arrows.map((a) => a.direction));
  if (before !== after) fixed++;
  raw.levels[id] = sanitized;
  for (let i = 0; i < sanitized.arrows.length; i++) {
    const a = sanitized.arrows[i];
    if (!arrowExitDirectionValid(a.cells, a.direction)) {
      stillInvalid++;
      console.warn(`Level ${id} arrow ${i} still invalid after sanitize`);
    }
  }
}

raw.version = LEVEL_CACHE_VERSION;
fs.writeFileSync(outPath, JSON.stringify(raw));
console.log(
  `Patched prebuilt levels v${LEVEL_CACHE_VERSION}: ${fixed} levels updated, ${stillInvalid} arrows still invalid`
);
