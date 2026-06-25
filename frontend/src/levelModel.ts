import { fullRectCellSet } from "./boardShapes";

export type Direction = "up" | "down" | "left" | "right";

export const DIR_VEC: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

export type GridCell = { row: number; col: number };

export type ArrowDef = {
  /** Tail → head (head is last cell). */
  cells: GridCell[];
  direction: Direction;
};

export type Level = {
  id: number;
  rows: number;
  cols: number;
  arrows: ArrowDef[];
  hint?: string;
  shapeName?: string;
  shapeCategory?: string;
  isSpecialShape?: boolean;
  activeCells?: GridCell[];
};

export function cellKey(r: number, c: number) {
  return `${r},${c}`;
}

// Cached per level object. The active-cell set never changes for a given
// level, but solvability/generation checks call this O(n²) times per attempt
// (and DFS calls it tens of thousands of times). Rebuilding the Set each call
// was a major hidden cost during level generation. Callers only ever read the
// set, so sharing a single instance per level is safe.
const activeCellSetCache = new WeakMap<Level, Set<string>>();

export function getLevelActiveCellSet(level: Level): Set<string> {
  const cached = activeCellSetCache.get(level);
  if (cached) return cached;
  const set = level.activeCells?.length
    ? new Set(level.activeCells.map((c) => cellKey(c.row, c.col)))
    : fullRectCellSet(level.rows, level.cols);
  activeCellSetCache.set(level, set);
  return set;
}

export type LevelFlightSurface = {
  isPlayable: (r: number, c: number) => boolean;
  inBounds: (r: number, c: number) => boolean;
  /** Shape levels have inactive cells inside the grid bounding box. */
  blockInteriorVoids: boolean;
};

// Cached per level object alongside the active-cell set: the surface closures
// are otherwise re-allocated on every canArrowEscapeNow call.
const flightSurfaceCache = new WeakMap<Level, LevelFlightSurface>();

export function getLevelFlightSurface(level: Level): LevelFlightSurface {
  const cached = flightSurfaceCache.get(level);
  if (cached) return cached;
  const shaped = Boolean(
    level.isSpecialShape || (level.activeCells?.length ?? 0) > 0
  );
  const activeCells = getLevelActiveCellSet(level);
  const surface: LevelFlightSurface = {
    isPlayable: (r, c) => activeCells.has(cellKey(r, c)),
    inBounds: (r, c) =>
      r >= 0 && r < level.rows && c >= 0 && c < level.cols,
    blockInteriorVoids: shaped,
  };
  flightSurfaceCache.set(level, surface);
  return surface;
}
