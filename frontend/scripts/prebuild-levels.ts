/**
 * Pre-generates levels into a bundled JSON asset so the app loads them
 * instantly instead of running the (sometimes multi-second) procedural
 * generator on the device. Levels are deterministic per id, so the bundled
 * output is identical to what getLevel() would produce live.
 *
 * Usage: npx tsx scripts/prebuild-levels.ts [maxLevel]
 * The version stamp is read from levels.ts (LEVEL_CACHE_VERSION) — if that
 * changes, the bundle is treated as stale and must be regenerated.
 */
import fs from "fs";
import path from "path";
import { buildLevelFresh, LEVEL_CACHE_VERSION } from "../src/levels";

const maxLevel = Number(process.argv[2] || 200);
const outPath = path.join(__dirname, "..", "src", "data", "prebuiltLevels.json");

const levels: Record<string, unknown> = {};
const t0 = Date.now();
let slowest = { id: 0, ms: 0 };

for (let id = 1; id <= maxLevel; id++) {
  const start = Date.now();
  levels[String(id)] = buildLevelFresh(id);
  const ms = Date.now() - start;
  if (ms > slowest.ms) slowest = { id, ms };
  if (id % 25 === 0 || id === maxLevel) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`… generated ${id}/${maxLevel} (${elapsed}s)`);
  }
}

const payload = { version: LEVEL_CACHE_VERSION, maxLevel, levels };

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload));

const sizeKb = (fs.statSync(outPath).size / 1024).toFixed(0);
console.log(
  `\nWrote ${maxLevel} levels (v${LEVEL_CACHE_VERSION}) to ${outPath} — ${sizeKb} KB`
);
console.log(
  `Total ${((Date.now() - t0) / 1000).toFixed(1)}s, slowest level ${
    slowest.id
  } at ${slowest.ms}ms`
);
