import { generateLevel } from "../src/levels";
import { auditLevel } from "../src/levelSolvability";

const args = process.argv.slice(2);
const only = args.length > 0 ? args.map(Number) : null;

function formatResult(r: ReturnType<typeof auditLevel>): string {
  const status = r.ok ? "OK" : "FAIL";
  const shape = r.shapeName ? ` (${r.shapeName})` : "";
  const flags = [
    `fill=${r.fill}`,
    `solvable=${r.solvable}`,
    `canonical=${r.canonical}`,
    `hint=${r.greedyHint}`,
  ].join(" ");
  return `Level ${r.levelId}${shape}: ${status} | arrows=${r.arrows} cells=${r.cells} ${flags} ms=${r.ms}`;
}

let failed: number[] = [];

if (only && only.some((n) => !Number.isFinite(n))) {
  console.error("Usage: npx tsx scripts/audit-special-levels.ts [levelIds...]");
  process.exit(1);
}

const levels = only ?? Array.from({ length: 60 }, (_, i) => (i + 1) * 5);

for (const id of levels) {
  const level = generateLevel(id);
  const result = auditLevel(level);
  console.log(formatResult(result));
  if (!result.ok) {
    failed.push(id);
    if (!result.fill) console.error(`  - incomplete grid fill`);
    if (!result.solvable) console.error(`  - no solve order exists`);
    if (result.solvable && !result.canonical)
      console.error(`  - canonical order fails (player may need non-obvious sequence)`);
    if (result.solvable && !result.greedyHint)
      console.error(`  - hint-guided play can dead-end`);
  }
}

if (failed.length > 0) {
  console.error(`\nFailed levels (${failed.length}): ${failed.join(", ")}`);
  process.exit(1);
}

console.log(`\nAll ${levels.length} special levels passed audit.`);
