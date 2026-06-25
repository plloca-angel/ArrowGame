import { clearLevelCache, getLevel } from "../src/levels";
import { verifyLevelMoveRules } from "../src/levelSolvability";
import { countEscapableAtStart } from "../src/levelSolvability";

const levelId = Number(process.argv[2] || 100);
clearLevelCache();
const level = getLevel(levelId);
const errors = verifyLevelMoveRules(level);

console.log(
  "Level",
  levelId,
  level.shapeName ?? "standard",
  "special",
  level.isSpecialShape,
  "arrows",
  level.arrows.length,
  "escapable",
  countEscapableAtStart(level)
);

if (errors.length === 0) {
  console.log("OK — no move-rule violations");
} else {
  console.log("FAILURES:");
  for (const e of errors) console.log(" ", e);
  process.exit(1);
}
