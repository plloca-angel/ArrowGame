import { clearLevelCache, getLevel } from "../src/levels";
import { verifyLevelMoveRules } from "../src/levelSolvability";
import { isSpecialShapeLevel } from "../src/boardShapes";

const maxLevel = Number(process.argv[2] || 300);
const reportEvery = Number(process.argv[3] || 25);

clearLevelCache();

let failures = 0;
const failedLevels: { id: number; errors: string[] }[] = [];
const t0 = Date.now();

for (let id = 1; id <= maxLevel; id++) {
  let level;
  try {
    level = getLevel(id);
  } catch (err) {
    failures++;
    failedLevels.push({
      id,
      errors: [`generation failed: ${err instanceof Error ? err.message : err}`],
    });
    continue;
  }

  const errors = verifyLevelMoveRules(level);
  if (errors.length > 0) {
    failures++;
    failedLevels.push({ id, errors });
  }

  if (id % reportEvery === 0 || id === maxLevel) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(
      `… checked ${id}/${maxLevel} (${elapsed}s) failures: ${failures}`
    );
  }
}

const specialCount = Array.from({ length: maxLevel }, (_, i) => i + 1).filter(
  isSpecialShapeLevel
).length;

console.log("\n=== Level audit summary ===");
console.log(`Levels tested: ${maxLevel}`);
console.log(`Special shape levels in range: ${specialCount}`);
console.log(`Failures: ${failures}`);

if (failedLevels.length > 0) {
  console.log("\nFailed levels:");
  for (const { id, errors } of failedLevels.slice(0, 50)) {
    console.log(`  Level ${id}: ${errors.join("; ")}`);
  }
  if (failedLevels.length > 50) {
    console.log(`  … and ${failedLevels.length - 50} more`);
  }
  process.exit(1);
}

console.log("\nAll levels passed move-rule checks.");
