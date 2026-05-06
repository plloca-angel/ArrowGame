// Arrow Puzzle Escape - Level Definitions
// Each level: a grid where arrows must escape (exit the grid in their pointing direction)
// without colliding with another arrow's cell or a wall during flight.

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

// Directions vector mapping
export const DIR_VEC: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

export const LEVELS: Level[] = [
  // Level 1 - tutorial: 2 arrows, must release the one that points away first
  {
    id: 1,
    rows: 4,
    cols: 4,
    arrows: [
      { row: 1, col: 1, direction: "right" },
      { row: 1, col: 2, direction: "left" },
    ],
    hint: "Tap arrows to release. Don't let paths cross.",
  },
  // Level 2
  {
    id: 2,
    rows: 4,
    cols: 4,
    arrows: [
      { row: 0, col: 1, direction: "down" },
      { row: 2, col: 1, direction: "up" },
      { row: 1, col: 3, direction: "left" },
    ],
  },
  // Level 3
  {
    id: 3,
    rows: 5,
    cols: 5,
    arrows: [
      { row: 0, col: 2, direction: "down" },
      { row: 2, col: 0, direction: "right" },
      { row: 2, col: 4, direction: "left" },
      { row: 4, col: 2, direction: "up" },
    ],
  },
  // Level 4
  {
    id: 4,
    rows: 5,
    cols: 5,
    arrows: [
      { row: 1, col: 1, direction: "right" },
      { row: 1, col: 3, direction: "left" },
      { row: 3, col: 1, direction: "up" },
      { row: 3, col: 3, direction: "down" },
    ],
  },
  // Level 5
  {
    id: 5,
    rows: 5,
    cols: 5,
    arrows: [
      { row: 0, col: 0, direction: "right" },
      { row: 0, col: 4, direction: "down" },
      { row: 4, col: 0, direction: "up" },
      { row: 4, col: 4, direction: "left" },
      { row: 2, col: 2, direction: "up" },
    ],
  },
  // Level 6
  {
    id: 6,
    rows: 5,
    cols: 5,
    arrows: [
      { row: 1, col: 0, direction: "right" },
      { row: 1, col: 2, direction: "left" },
      { row: 1, col: 4, direction: "left" },
      { row: 3, col: 0, direction: "right" },
      { row: 3, col: 4, direction: "left" },
    ],
  },
  // Level 7
  {
    id: 7,
    rows: 6,
    cols: 6,
    arrows: [
      { row: 0, col: 2, direction: "down" },
      { row: 0, col: 3, direction: "down" },
      { row: 5, col: 2, direction: "up" },
      { row: 5, col: 3, direction: "up" },
      { row: 2, col: 0, direction: "right" },
      { row: 3, col: 5, direction: "left" },
    ],
  },
  // Level 8
  {
    id: 8,
    rows: 6,
    cols: 6,
    arrows: [
      { row: 1, col: 1, direction: "down" },
      { row: 1, col: 4, direction: "down" },
      { row: 4, col: 1, direction: "up" },
      { row: 4, col: 4, direction: "up" },
      { row: 2, col: 2, direction: "right" },
      { row: 3, col: 3, direction: "left" },
    ],
  },
  // Level 9 - with walls
  {
    id: 9,
    rows: 6,
    cols: 6,
    arrows: [
      { row: 0, col: 0, direction: "down" },
      { row: 0, col: 5, direction: "down" },
      { row: 5, col: 0, direction: "up" },
      { row: 5, col: 5, direction: "up" },
      { row: 2, col: 2, direction: "right" },
      { row: 3, col: 3, direction: "left" },
    ],
    walls: [{ row: 2, col: 5 }, { row: 3, col: 0 }],
  },
  // Level 10
  {
    id: 10,
    rows: 6,
    cols: 6,
    arrows: [
      { row: 0, col: 1, direction: "right" },
      { row: 0, col: 4, direction: "left" },
      { row: 5, col: 1, direction: "right" },
      { row: 5, col: 4, direction: "left" },
      { row: 2, col: 0, direction: "down" },
      { row: 3, col: 5, direction: "up" },
      { row: 2, col: 3, direction: "up" },
    ],
  },
  // Level 11
  {
    id: 11,
    rows: 7,
    cols: 7,
    arrows: [
      { row: 0, col: 3, direction: "down" },
      { row: 6, col: 3, direction: "up" },
      { row: 3, col: 0, direction: "right" },
      { row: 3, col: 6, direction: "left" },
      { row: 1, col: 1, direction: "down" },
      { row: 1, col: 5, direction: "down" },
      { row: 5, col: 1, direction: "up" },
      { row: 5, col: 5, direction: "up" },
    ],
  },
  // Level 12
  {
    id: 12,
    rows: 7,
    cols: 7,
    arrows: [
      { row: 0, col: 0, direction: "right" },
      { row: 0, col: 6, direction: "down" },
      { row: 6, col: 0, direction: "up" },
      { row: 6, col: 6, direction: "left" },
      { row: 2, col: 3, direction: "left" },
      { row: 3, col: 2, direction: "down" },
      { row: 3, col: 4, direction: "up" },
      { row: 4, col: 3, direction: "right" },
    ],
    walls: [{ row: 3, col: 3 }],
  },
];

// Generate procedural levels for IDs > LEVELS.length
export function getLevel(id: number): Level {
  if (id <= LEVELS.length) return LEVELS[id - 1];
  // Procedural fallback: scale difficulty
  const size = Math.min(7, 5 + Math.floor((id - LEVELS.length) / 3));
  const count = Math.min(10, 5 + Math.floor((id - LEVELS.length) / 2));
  const arrows: ArrowDef[] = [];
  const used = new Set<string>();
  const dirs: Direction[] = ["up", "down", "left", "right"];
  let safety = 0;
  while (arrows.length < count && safety < 200) {
    safety++;
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    const k = `${r},${c}`;
    if (used.has(k)) continue;
    used.add(k);
    arrows.push({
      row: r,
      col: c,
      direction: dirs[Math.floor(Math.random() * 4)],
    });
  }
  return { id, rows: size, cols: size, arrows };
}

export const TOTAL_HANDCRAFTED = LEVELS.length;
