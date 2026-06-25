import { generateLevel } from "../src/levels";
import {
  findSolveOrder,
  isLevelSolvable,
  verifyCanonicalSolveOrder,
} from "../src/levelSolvability";

const args = process.argv.slice(2);
const only = args.length > 0 ? args.map(Number) : null;

function checkLevel(id: number): boolean {
  const t0 = Date.now();
  const level = generateLevel(id);
  const solvable = isLevelSolvable(level);
  const canonical = verifyCanonicalSolveOrder(level);
  const order = solvable ? findSolveOrder(level) : null;
  const ms = Date.now() - t0;

  const status = solvable ? "OK" : "FAIL";
  console.log(
    `Level ${id}${level.isSpecialShape ? ` (${level.shapeName})` : ""}: ${status} | arrows=${level.arrows.length} canonical=${canonical} ms=${ms}`
  );
  if (!solvable) {
    console.error(`  UNSOLVABLE level ${id}`);
  }
  return solvable;
}

let failed: number[] = [];

if (only && only.some((n) => !Number.isFinite(n))) {
  console.error("Usage: npx tsx scripts/verify-solvability.ts [levelIds...]");
  process.exit(1);
}

if (only) {
  for (const id of only) {
    if (!checkLevel(id)) failed.push(id);
  }
} else {
  const specials = Array.from({ length: 60 }, (_, i) => (i + 1) * 5);
  for (const id of specials) {
    if (!checkLevel(id)) failed.push(id);
  }
}

if (failed.length > 0) {
  console.error(`\nFailed levels: ${failed.join(", ")}`);
  process.exit(1);
}

console.log("\nAll checked levels are solvable.");
