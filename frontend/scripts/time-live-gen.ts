/**
 * Times live generation of levels in a range to find slow / hanging ones.
 * Usage: npx tsx scripts/time-live-gen.ts [start] [end]
 */
import { buildLevelFresh, clearLevelCache } from "../src/levels";

const start = Number(process.argv[2] || 201);
const end = Number(process.argv[3] || 260);

clearLevelCache();

let slowest = { id: 0, ms: 0 };
for (let id = start; id <= end; id++) {
  const t0 = Date.now();
  let arrows = 0;
  let ok = true;
  try {
    const lvl = buildLevelFresh(id);
    arrows = lvl.arrows.length;
  } catch {
    ok = false;
  }
  const ms = Date.now() - t0;
  if (ms > slowest.ms) slowest = { id, ms };
  const flag = ms > 1000 ? "  <-- SLOW" : "";
  console.log(
    `level ${id}: ${ms} ms${ok ? "" : " (FAILED)"} arrows=${arrows}${flag}`
  );
}

console.log(`\nSlowest: level ${slowest.id} at ${slowest.ms} ms`);
