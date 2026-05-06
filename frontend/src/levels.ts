// Arrow Puzzle Escape - Level Definitions
// Every cell on the grid contains an arrow.
// All levels are guaranteed solvable: arrows are placed center-out so each
// new placement has a clear path of all previously-placed arrows. Solve order
// = reverse placement order (first arrow in `arrows` is the first to escape).

export type Direction = "up" | "down" | "left" | "right";

export type ArrowDef = {
  row: number;
  col: number;
  direction: Direction;
};

export type WallDef = { row: number; col: number };

export type Level = {
  id: number;
  rows: number;
  cols: number;
  arrows: ArrowDef[];
  walls?: WallDef[];
  hint?: string;
};

export const DIR_VEC: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

export const LEVELS: Level[] = [
  {
    id: 1,
    rows: 3,
    cols: 3,
    arrows: [
      { row: 2, col: 1, direction: "down" },
      { row: 0, col: 1, direction: "up" },
      { row: 0, col: 2, direction: "up" },
      { row: 1, col: 2, direction: "up" },
      { row: 2, col: 2, direction: "down" },
      { row: 2, col: 0, direction: "left" },
      { row: 1, col: 0, direction: "down" },
      { row: 0, col: 0, direction: "down" },
      { row: 1, col: 1, direction: "right" },
    ],
    hint: "Tap arrows in the right order — each one flies in its direction!",
  },
  {
    id: 2,
    rows: 3,
    cols: 4,
    arrows: [
      { row: 0, col: 2, direction: "up" },
      { row: 2, col: 2, direction: "down" },
      { row: 1, col: 0, direction: "left" },
      { row: 0, col: 1, direction: "up" },
      { row: 2, col: 3, direction: "down" },
      { row: 2, col: 1, direction: "down" },
      { row: 0, col: 3, direction: "right" },
      { row: 1, col: 3, direction: "right" },
      { row: 0, col: 0, direction: "right" },
      { row: 2, col: 0, direction: "up" },
      { row: 1, col: 1, direction: "up" },
      { row: 1, col: 2, direction: "right" },
    ],
  },
  {
    id: 3,
    rows: 3,
    cols: 4,
    arrows: [
      { row: 0, col: 3, direction: "up" },
      { row: 2, col: 0, direction: "down" },
      { row: 2, col: 3, direction: "right" },
      { row: 2, col: 2, direction: "right" },
      { row: 0, col: 0, direction: "up" },
      { row: 0, col: 2, direction: "up" },
      { row: 0, col: 1, direction: "right" },
      { row: 2, col: 1, direction: "down" },
      { row: 1, col: 0, direction: "up" },
      { row: 1, col: 3, direction: "right" },
      { row: 1, col: 2, direction: "down" },
      { row: 1, col: 1, direction: "right" },
    ],
  },
  {
    id: 4,
    rows: 4,
    cols: 4,
    arrows: [
      { row: 2, col: 3, direction: "right" },
      { row: 3, col: 0, direction: "left" },
      { row: 1, col: 3, direction: "right" },
      { row: 3, col: 1, direction: "down" },
      { row: 0, col: 1, direction: "up" },
      { row: 1, col: 0, direction: "left" },
      { row: 2, col: 0, direction: "down" },
      { row: 3, col: 2, direction: "down" },
      { row: 0, col: 3, direction: "right" },
      { row: 3, col: 3, direction: "left" },
      { row: 0, col: 2, direction: "up" },
      { row: 0, col: 0, direction: "right" },
      { row: 2, col: 1, direction: "left" },
      { row: 1, col: 1, direction: "up" },
      { row: 2, col: 2, direction: "down" },
      { row: 1, col: 2, direction: "up" },
    ],
  },
  {
    id: 5,
    rows: 4,
    cols: 4,
    arrows: [
      { row: 0, col: 3, direction: "right" },
      { row: 3, col: 1, direction: "down" },
      { row: 0, col: 0, direction: "left" },
      { row: 3, col: 2, direction: "down" },
      { row: 2, col: 0, direction: "left" },
      { row: 3, col: 3, direction: "down" },
      { row: 0, col: 1, direction: "up" },
      { row: 1, col: 3, direction: "right" },
      { row: 1, col: 0, direction: "up" },
      { row: 3, col: 0, direction: "left" },
      { row: 0, col: 2, direction: "right" },
      { row: 2, col: 3, direction: "up" },
      { row: 2, col: 2, direction: "right" },
      { row: 1, col: 2, direction: "up" },
      { row: 1, col: 1, direction: "up" },
      { row: 2, col: 1, direction: "left" },
    ],
  },
  {
    id: 6,
    rows: 4,
    cols: 5,
    arrows: [
      { row: 3, col: 0, direction: "left" },
      { row: 0, col: 4, direction: "right" },
      { row: 0, col: 0, direction: "left" },
      { row: 3, col: 1, direction: "down" },
      { row: 0, col: 2, direction: "up" },
      { row: 3, col: 3, direction: "down" },
      { row: 0, col: 1, direction: "up" },
      { row: 1, col: 4, direction: "up" },
      { row: 1, col: 0, direction: "up" },
      { row: 3, col: 4, direction: "right" },
      { row: 3, col: 2, direction: "down" },
      { row: 2, col: 0, direction: "left" },
      { row: 2, col: 4, direction: "up" },
      { row: 0, col: 3, direction: "left" },
      { row: 1, col: 1, direction: "up" },
      { row: 2, col: 3, direction: "right" },
      { row: 2, col: 1, direction: "left" },
      { row: 2, col: 2, direction: "right" },
      { row: 1, col: 3, direction: "right" },
      { row: 1, col: 2, direction: "up" },
    ],
  },
  {
    id: 7,
    rows: 4,
    cols: 5,
    arrows: [
      { row: 3, col: 0, direction: "down" },
      { row: 2, col: 0, direction: "left" },
      { row: 0, col: 4, direction: "up" },
      { row: 0, col: 3, direction: "up" },
      { row: 3, col: 2, direction: "down" },
      { row: 0, col: 2, direction: "right" },
      { row: 3, col: 1, direction: "down" },
      { row: 3, col: 4, direction: "right" },
      { row: 3, col: 3, direction: "right" },
      { row: 1, col: 4, direction: "right" },
      { row: 0, col: 1, direction: "up" },
      { row: 2, col: 4, direction: "up" },
      { row: 0, col: 0, direction: "left" },
      { row: 1, col: 0, direction: "left" },
      { row: 1, col: 1, direction: "up" },
      { row: 2, col: 3, direction: "right" },
      { row: 1, col: 3, direction: "up" },
      { row: 2, col: 1, direction: "up" },
      { row: 2, col: 2, direction: "right" },
      { row: 1, col: 2, direction: "down" },
    ],
  },
  {
    id: 8,
    rows: 5,
    cols: 5,
    arrows: [
      { row: 1, col: 4, direction: "right" },
      { row: 4, col: 0, direction: "down" },
      { row: 4, col: 3, direction: "down" },
      { row: 0, col: 3, direction: "up" },
      { row: 3, col: 0, direction: "left" },
      { row: 1, col: 0, direction: "left" },
      { row: 0, col: 2, direction: "up" },
      { row: 0, col: 1, direction: "up" },
      { row: 2, col: 0, direction: "down" },
      { row: 3, col: 4, direction: "right" },
      { row: 0, col: 4, direction: "up" },
      { row: 4, col: 2, direction: "down" },
      { row: 4, col: 1, direction: "left" },
      { row: 2, col: 4, direction: "up" },
      { row: 4, col: 4, direction: "right" },
      { row: 0, col: 0, direction: "right" },
      { row: 3, col: 2, direction: "down" },
      { row: 1, col: 1, direction: "up" },
      { row: 2, col: 1, direction: "up" },
      { row: 3, col: 1, direction: "up" },
      { row: 3, col: 3, direction: "right" },
      { row: 1, col: 3, direction: "up" },
      { row: 1, col: 2, direction: "up" },
      { row: 2, col: 3, direction: "down" },
      { row: 2, col: 2, direction: "up" },
    ],
  },
  {
    id: 9,
    rows: 5,
    cols: 5,
    arrows: [
      { row: 1, col: 4, direction: "right" },
      { row: 3, col: 4, direction: "right" },
      { row: 1, col: 0, direction: "left" },
      { row: 4, col: 2, direction: "down" },
      { row: 0, col: 1, direction: "up" },
      { row: 4, col: 0, direction: "down" },
      { row: 2, col: 0, direction: "left" },
      { row: 0, col: 2, direction: "up" },
      { row: 3, col: 0, direction: "left" },
      { row: 4, col: 3, direction: "down" },
      { row: 0, col: 3, direction: "up" },
      { row: 0, col: 0, direction: "up" },
      { row: 4, col: 4, direction: "down" },
      { row: 2, col: 4, direction: "down" },
      { row: 0, col: 4, direction: "left" },
      { row: 4, col: 1, direction: "down" },
      { row: 3, col: 1, direction: "left" },
      { row: 2, col: 3, direction: "right" },
      { row: 2, col: 1, direction: "down" },
      { row: 3, col: 3, direction: "right" },
      { row: 1, col: 2, direction: "up" },
      { row: 1, col: 3, direction: "down" },
      { row: 3, col: 2, direction: "right" },
      { row: 1, col: 1, direction: "right" },
      { row: 2, col: 2, direction: "right" },
    ],
  },
  {
    id: 10,
    rows: 5,
    cols: 6,
    arrows: [
      { row: 4, col: 1, direction: "down" },
      { row: 2, col: 5, direction: "right" },
      { row: 3, col: 0, direction: "left" },
      { row: 2, col: 0, direction: "left" },
      { row: 1, col: 0, direction: "left" },
      { row: 0, col: 1, direction: "up" },
      { row: 0, col: 5, direction: "right" },
      { row: 4, col: 4, direction: "down" },
      { row: 4, col: 0, direction: "left" },
      { row: 4, col: 2, direction: "left" },
      { row: 0, col: 0, direction: "left" },
      { row: 0, col: 2, direction: "up" },
      { row: 4, col: 5, direction: "down" },
      { row: 3, col: 5, direction: "down" },
      { row: 4, col: 3, direction: "down" },
      { row: 0, col: 4, direction: "up" },
      { row: 0, col: 3, direction: "left" },
      { row: 1, col: 5, direction: "down" },
      { row: 3, col: 3, direction: "down" },
      { row: 1, col: 2, direction: "up" },
      { row: 2, col: 1, direction: "left" },
      { row: 3, col: 4, direction: "down" },
      { row: 1, col: 1, direction: "up" },
      { row: 3, col: 2, direction: "down" },
      { row: 2, col: 4, direction: "down" },
      { row: 3, col: 1, direction: "left" },
      { row: 1, col: 3, direction: "left" },
      { row: 1, col: 4, direction: "left" },
      { row: 2, col: 2, direction: "left" },
      { row: 2, col: 3, direction: "left" },
    ],
  },
  {
    id: 11,
    rows: 6,
    cols: 6,
    arrows: [
      { row: 1, col: 5, direction: "right" },
      { row: 2, col: 0, direction: "left" },
      { row: 5, col: 2, direction: "down" },
      { row: 4, col: 0, direction: "left" },
      { row: 5, col: 4, direction: "down" },
      { row: 5, col: 0, direction: "left" },
      { row: 0, col: 3, direction: "up" },
      { row: 2, col: 5, direction: "right" },
      { row: 5, col: 1, direction: "down" },
      { row: 5, col: 3, direction: "left" },
      { row: 3, col: 5, direction: "right" },
      { row: 0, col: 5, direction: "right" },
      { row: 5, col: 5, direction: "right" },
      { row: 0, col: 1, direction: "up" },
      { row: 1, col: 0, direction: "left" },
      { row: 3, col: 0, direction: "down" },
      { row: 0, col: 0, direction: "left" },
      { row: 4, col: 5, direction: "up" },
      { row: 0, col: 2, direction: "up" },
      { row: 0, col: 4, direction: "right" },
      { row: 3, col: 1, direction: "left" },
      { row: 4, col: 4, direction: "down" },
      { row: 2, col: 4, direction: "right" },
      { row: 1, col: 4, direction: "up" },
      { row: 1, col: 2, direction: "up" },
      { row: 1, col: 3, direction: "up" },
      { row: 4, col: 3, direction: "right" },
      { row: 1, col: 1, direction: "right" },
      { row: 2, col: 1, direction: "left" },
      { row: 4, col: 2, direction: "down" },
      { row: 4, col: 1, direction: "up" },
      { row: 3, col: 4, direction: "up" },
      { row: 3, col: 2, direction: "left" },
      { row: 2, col: 2, direction: "up" },
      { row: 3, col: 3, direction: "down" },
      { row: 2, col: 3, direction: "right" },
    ],
  },
  {
    id: 12,
    rows: 6,
    cols: 6,
    arrows: [
      { row: 5, col: 3, direction: "down" },
      { row: 5, col: 1, direction: "down" },
      { row: 2, col: 0, direction: "left" },
      { row: 5, col: 2, direction: "down" },
      { row: 5, col: 5, direction: "down" },
      { row: 0, col: 5, direction: "right" },
      { row: 0, col: 4, direction: "right" },
      { row: 3, col: 0, direction: "left" },
      { row: 1, col: 0, direction: "left" },
      { row: 0, col: 2, direction: "up" },
      { row: 5, col: 0, direction: "down" },
      { row: 2, col: 5, direction: "right" },
      { row: 3, col: 5, direction: "right" },
      { row: 0, col: 1, direction: "up" },
      { row: 0, col: 3, direction: "up" },
      { row: 5, col: 4, direction: "right" },
      { row: 4, col: 0, direction: "down" },
      { row: 1, col: 5, direction: "right" },
      { row: 4, col: 5, direction: "up" },
      { row: 0, col: 0, direction: "right" },
      { row: 2, col: 4, direction: "right" },
      { row: 1, col: 4, direction: "up" },
      { row: 3, col: 4, direction: "up" },
      { row: 1, col: 3, direction: "right" },
      { row: 4, col: 1, direction: "down" },
      { row: 3, col: 1, direction: "down" },
      { row: 1, col: 1, direction: "left" },
      { row: 2, col: 1, direction: "left" },
      { row: 4, col: 2, direction: "left" },
      { row: 1, col: 2, direction: "up" },
      { row: 4, col: 4, direction: "right" },
      { row: 4, col: 3, direction: "down" },
      { row: 2, col: 3, direction: "up" },
      { row: 3, col: 3, direction: "right" },
      { row: 3, col: 2, direction: "right" },
      { row: 2, col: 2, direction: "up" },
    ],
  },
];

// Procedural generator for endless mode (id > LEVELS.length).
// Same center-out construction guarantees solvability.
function generateSolvableLevel(
  id: number,
  rows: number,
  cols: number
): Level {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const occupied = new Set<string>();
    const placed: ArrowDef[] = [];
    const target = rows * cols;
    let stuck = false;
    while (placed.length < target && !stuck) {
      const empties: { r: number; c: number; d: number }[] = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!occupied.has(`${r},${c}`)) {
            empties.push({
              r,
              c,
              d: Math.min(r, rows - 1 - r, c, cols - 1 - c),
            });
          }
        }
      }
      // Innermost cells first (highest distance from edge)
      empties.sort((a, b) => b.d - a.d || Math.random() - 0.5);
      let placedThis = false;
      for (const { r, c } of empties) {
        const dirs: Direction[] = ["up", "down", "left", "right"].sort(
          () => Math.random() - 0.5
        ) as Direction[];
        for (const dir of dirs) {
          const [dr, dc] = DIR_VEC[dir];
          let rr = r + dr;
          let cc = c + dc;
          let blocked = false;
          while (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
            if (occupied.has(`${rr},${cc}`)) {
              blocked = true;
              break;
            }
            rr += dr;
            cc += dc;
          }
          if (!blocked) {
            placed.push({ row: r, col: c, direction: dir });
            occupied.add(`${r},${c}`);
            placedThis = true;
            break;
          }
        }
        if (placedThis) break;
      }
      if (!placedThis) stuck = true;
    }
    if (placed.length === target) {
      placed.reverse();
      return { id, rows, cols, arrows: placed };
    }
  }
  // Fallback: return a small grid if generation fails
  return generateSolvableLevel(id, 4, 4);
}

export function getLevel(id: number): Level {
  if (id <= LEVELS.length) return LEVELS[id - 1];
  // Endless: ramp size 5x5 -> 6x6 -> 7x6 -> 7x7
  const stage = id - LEVELS.length;
  let rows = 5;
  let cols = 5;
  if (stage > 6) {
    rows = 6;
    cols = 6;
  } else if (stage > 3) {
    rows = 5;
    cols = 6;
  }
  return generateSolvableLevel(id, rows, cols);
}

export const TOTAL_HANDCRAFTED = LEVELS.length;
