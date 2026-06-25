import { clearLevelCache, getLevel } from "../src/levels";
import {
  canArrowEscapeNow,
  countEscapableAtStart,
  levelHasBlockedStarts,
} from "../src/levelSolvability";
import { computeLiveFlight, toLiveArrow } from "../src/gameBoard";
import { getLevelActiveCellSet } from "../src/levelModel";

clearLevelCache();

let failures = 0;

for (let id = 1; id <= 10; id++) {
  const level = getLevel(id);
  const active = getLevelActiveCellSet(level);
  const n = level.arrows.length;
  const present = new Set(Array.from({ length: n }, (_, i) => i));
  const esc = countEscapableAtStart(level);
  const blocked = levelHasBlockedStarts(level);

  console.log(
    `Level ${id}: arrows=${n} escapable=${esc} blockedStarts=${blocked}`
  );

  if (active.size === 0) {
    console.error(`  FAIL: empty active cell set`);
    failures++;
    continue;
  }

  if (n >= 2 && esc >= n) {
    console.error(`  FAIL: every arrow escapable at start`);
    failures++;
  }

  for (let i = 0; i < n; i++) {
    const def = level.arrows[i];
    const canEsc = canArrowEscapeNow(
      def,
      level.arrows,
      i,
      present,
      active,
      level
    );

    const live = {
      id: `${id}-${i}`,
      cells: def.cells,
      direction: def.direction,
      status: "idle" as const,
    };
    const liveBoard = level.arrows.map((a, j) =>
      toLiveArrow({
        id: `${id}-${j}`,
        cells: a.cells,
        direction: a.direction,
        status: "idle",
      })
    );
    const flight = computeLiveFlight(live, liveBoard, level);

    if (canEsc !== (flight.result === "escape")) {
      console.error(
        `  FAIL arrow ${i}: solvability=${canEsc} liveFlight=${flight.result}`
      );
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}

console.log("\nAll checks passed.");
