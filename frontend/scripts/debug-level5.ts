import { getBoardShapeForLevel, activeCellSetFromShape } from "../src/boardShapes";
import { verifyFullGridFill, verifyGreedyClearBoard } from "../src/levelSolvability";
import { getLevelFlightSurface, cellKey, DIR_VEC, Direction } from "../src/levelModel";

const id = 5;
const shape = getBoardShapeForLevel(id);
const activeCells = activeCellSetFromShape(shape);
const surface = getLevelFlightSurface({
  id,
  rows: shape.rows,
  cols: shape.cols,
  arrows: [],
  isSpecialShape: true,
  activeCells: shape.cells.map((c) => ({ ...c })),
});

const dirs: Direction[] = ["up", "down", "left", "right"];
let ok = 0;
for (let attempt = 0; attempt < 500; attempt++) {
  const placed = [];
  for (const key of activeCells) {
    const [row, col] = key.split(",").map(Number);
    const valid = dirs.filter((dir) => {
      const [dr, dc] = DIR_VEC[dir];
      const nr = row + dr;
      const nc = col + dc;
      return !(surface.inBounds(nr, nc) && !surface.isPlayable(nr, nc));
    });
    const dir = valid[Math.floor(Math.random() * valid.length)] ?? "up";
    placed.push({ cells: [{ row, col }], direction: dir });
  }
  const level = {
    id,
    rows: shape.rows,
    cols: shape.cols,
    arrows: [...placed].reverse(),
    isSpecialShape: true,
    activeCells: shape.cells.map((c) => ({ ...c })),
  };
  if (verifyFullGridFill(level) && verifyGreedyClearBoard(level)) ok++;
}
console.log("passed", ok, "/ 500");
