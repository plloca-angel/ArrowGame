/**
 * Scan prebuilt levels for flight/animation edge cases that could hang gameplay.
 * Usage: npx tsx scripts/scan-flight-risks.ts
 */
import { getPlayLevelSync } from "../src/levelPreload";
import { computeLiveFlight, toLiveArrow } from "../src/gameBoard";
import { isSpecialShapeLevel } from "../src/boardShapes";

const MAX_STEPS_WARN = 40;
const issues: string[] = [];

for (let id = 1; id <= 200; id++) {
  const level = getPlayLevelSync(id);
  if (!level) {
    issues.push(`level ${id}: missing from prebuilt chunks`);
    continue;
  }

  const board = level.arrows.map((a, i) =>
    toLiveArrow({
      id: `${id}-${i}`,
      cells: a.cells,
      direction: a.direction,
      status: "idle",
    })
  );

  for (let i = 0; i < board.length; i++) {
    const flight = computeLiveFlight(board[i], board, level);
    if (flight.result === "escape" && flight.steps > MAX_STEPS_WARN) {
      issues.push(
        `level ${id} arrow ${i}: long escape (${flight.steps} steps)${level.isSpecialShape ? " [special]" : ""}`
      );
    }
    if (
      flight.result === "escape" &&
      (!Number.isFinite(flight.steps) || flight.steps < 1)
    ) {
      issues.push(`level ${id} arrow ${i}: invalid escape steps`);
    }
  }
}

const special = Array.from({ length: 200 }, (_, i) => i + 1).filter(
  isSpecialShapeLevel
).length;

console.log(`Scanned 200 levels (${special} special shapes)`);
if (issues.length === 0) {
  console.log("No flight-risk issues found.");
} else {
  console.log(`${issues.length} note(s):`);
  for (const line of issues.slice(0, 30)) console.log(" ", line);
  if (issues.length > 30) console.log(`  … and ${issues.length - 30} more`);
}
