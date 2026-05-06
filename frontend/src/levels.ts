// Arrow Puzzle Escape - Level Definitions
// All levels are guaranteed solvable by construction:
// arrows are placed one-by-one with paths clear of previously-placed arrows.
// Solve order = reverse placement order (first arrow in `arrows` array is the
// first to escape; each newly-placed arrow's path is clear of all prior placements).

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
  // L1 - tutorial: tap the front (right) arrow first
  {
    id: 1,
    rows: 4,
    cols: 4,
    arrows: [
      { row: 1, col: 2, direction: "right" },
      { row: 1, col: 0, direction: "right" },
    ],
    hint: "Tap the front arrow first so the back one has a clear path.",
  },
  // L2
  {
    id: 2,
    rows: 4,
    cols: 4,
    arrows: [
      { row: 3, col: 3, direction: "left" },
      { row: 0, col: 3, direction: "down" },
      { row: 0, col: 0, direction: "right" },
    ],
  },
  // L3
  {
    id: 3,
    rows: 5,
    cols: 5,
    arrows: [
      { row: 0, col: 0, direction: "right" },
      { row: 4, col: 0, direction: "up" },
      { row: 4, col: 4, direction: "left" },
      { row: 1, col: 4, direction: "down" },
    ],
  },
  // L4
  {
    id: 4,
    rows: 5,
    cols: 5,
    arrows: [
      { row: 3, col: 1, direction: "down" },
      { row: 3, col: 3, direction: "left" },
      { row: 1, col: 3, direction: "down" },
      { row: 1, col: 1, direction: "right" },
    ],
  },
  // L5
  {
    id: 5,
    rows: 5,
    cols: 5,
    arrows: [
      { row: 0, col: 4, direction: "down" },
      { row: 2, col: 2, direction: "up" },
      { row: 4, col: 2, direction: "up" },
      { row: 4, col: 0, direction: "right" },
      { row: 0, col: 0, direction: "down" },
    ],
  },
  // L6 (procedurally generated, solvable)
  {
    id: 6,
    rows: 5,
    cols: 5,
    arrows: [
      { row: 2, col: 1, direction: "up" },
      { row: 4, col: 4, direction: "right" },
      { row: 0, col: 0, direction: "up" },
      { row: 2, col: 0, direction: "right" },
      { row: 0, col: 3, direction: "right" },
    ],
  },
  // L7
  {
    id: 7,
    rows: 6,
    cols: 6,
    arrows: [
      { row: 0, col: 0, direction: "right" },
      { row: 0, col: 3, direction: "down" },
      { row: 3, col: 3, direction: "left" },
      { row: 3, col: 0, direction: "down" },
      { row: 5, col: 5, direction: "up" },
      { row: 5, col: 0, direction: "right" },
    ],
  },
  // L8
  {
    id: 8,
    rows: 6,
    cols: 6,
    arrows: [
      { row: 5, col: 2, direction: "right" },
      { row: 2, col: 4, direction: "up" },
      { row: 0, col: 0, direction: "up" },
      { row: 2, col: 2, direction: "down" },
      { row: 4, col: 1, direction: "right" },
      { row: 0, col: 5, direction: "right" },
    ],
  },
  // L9 with walls
  {
    id: 9,
    rows: 6,
    cols: 6,
    arrows: [
      { row: 4, col: 4, direction: "right" },
      { row: 0, col: 4, direction: "left" },
      { row: 1, col: 1, direction: "right" },
      { row: 0, col: 5, direction: "up" },
      { row: 3, col: 5, direction: "right" },
      { row: 3, col: 3, direction: "right" },
    ],
    walls: [
      { row: 2, col: 5 },
      { row: 3, col: 0 },
    ],
  },
  // L10
  {
    id: 10,
    rows: 6,
    cols: 6,
    arrows: [
      { row: 3, col: 0, direction: "down" },
      { row: 3, col: 2, direction: "left" },
      { row: 4, col: 3, direction: "down" },
      { row: 3, col: 5, direction: "up" },
      { row: 0, col: 3, direction: "up" },
      { row: 3, col: 4, direction: "down" },
      { row: 2, col: 3, direction: "right" },
    ],
  },
  // L11
  {
    id: 11,
    rows: 7,
    cols: 7,
    arrows: [
      { row: 5, col: 3, direction: "right" },
      { row: 1, col: 5, direction: "left" },
      { row: 4, col: 3, direction: "up" },
      { row: 4, col: 2, direction: "up" },
      { row: 2, col: 5, direction: "up" },
      { row: 4, col: 4, direction: "down" },
      { row: 3, col: 6, direction: "up" },
      { row: 5, col: 0, direction: "up" },
    ],
  },
  // L12
  {
    id: 12,
    rows: 7,
    cols: 7,
    arrows: [
      { row: 3, col: 1, direction: "left" },
      { row: 5, col: 0, direction: "right" },
      { row: 6, col: 6, direction: "up" },
      { row: 6, col: 2, direction: "down" },
      { row: 3, col: 2, direction: "right" },
      { row: 0, col: 0, direction: "right" },
      { row: 2, col: 1, direction: "up" },
      { row: 4, col: 1, direction: "up" },
    ],
  },
];

// Procedural generator: places arrows so each new placement has a clear
// path of all currently-placed arrows. This guarantees solvability
// (firing in reverse-placement order always works).
function generateSolvableLevel(
  id: number,
  rows: number,
  cols: number,
  count: number
): Level {
  const occupied = new Set<string>();
  const placed: ArrowDef[] = [];
  let safety = 0;
  const dirs: Direction[] = ["up", "down", "left", "right"];

  while (placed.length < count && safety < 2000) {
    safety++;
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    if (occupied.has(`${r},${c}`)) continue;
    const shuffled = [...dirs].sort(() => Math.random() - 0.5);
    for (const d of shuffled) {
      const [dr, dc] = DIR_VEC[d];
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
        placed.push({ row: r, col: c, direction: d });
        occupied.add(`${r},${c}`);
        break;
      }
    }
  }
  // Reverse so the first arrow in the array is the first to be released
  // (which is the last-placed during construction)
  placed.reverse();
  return { id, rows, cols, arrows: placed };
}

export function getLevel(id: number): Level {
  if (id <= LEVELS.length) return LEVELS[id - 1];
  // Endless mode: increase difficulty
  const stage = id - LEVELS.length;
  const size = Math.min(7, 5 + Math.floor(stage / 3));
  const count = Math.min(9, 5 + Math.floor(stage / 2));
  return generateSolvableLevel(id, size, size, count);
}

export const TOTAL_HANDCRAFTED = LEVELS.length;
