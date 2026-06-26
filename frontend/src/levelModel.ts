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

/** Direction from one grid step to the next along a path. */
export function pathStepDirection(from: GridCell, to: GridCell): Direction | null {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (dr === -1 && dc === 0) return "up";
  if (dr === 1 && dc === 0) return "down";
  if (dr === 0 && dc === -1) return "left";
  if (dr === 0 && dc === 1) return "right";
  return null;
}

/** Continue straight from the last path segment (tail → head). */
export function defaultExitDirection(cells: GridCell[]): Direction {
  if (cells.length < 2) return "up";
  return pathStepDirection(cells[cells.length - 2], cells[cells.length - 1]) ?? "up";
}

/**
 * The tip must not point into any body cell. Single-cell arrows can point any way.
 */
export function arrowExitDirectionValid(
  cells: GridCell[],
  dir: Direction
): boolean {
  if (cells.length < 2) return true;
  const head = cells[cells.length - 1];
  const [dr, dc] = DIR_VEC[dir];
  const nr = head.row + dr;
  const nc = head.col + dc;
  for (let i = 0; i < cells.length - 1; i++) {
    if (cells[i].row === nr && cells[i].col === nc) return false;
  }
  return true;
}

/** Pick a direction that does not point the tip back into the arrow body. */
export function resolveArrowExitDirection(
  cells: GridCell[],
  preferred?: Direction
): Direction {
  if (cells.length < 2) return preferred ?? "up";
  if (preferred && arrowExitDirectionValid(cells, preferred)) return preferred;
  const along = defaultExitDirection(cells);
  if (arrowExitDirectionValid(cells, along)) return along;
  const order: Direction[] = ["up", "down", "left", "right"];
  for (const d of order) {
    if (arrowExitDirectionValid(cells, d)) return d;
  }
  return along;
}

export function levelArrowsExitValid(level: Level): boolean {
  return level.arrows.every((a) =>
    arrowExitDirectionValid(a.cells, a.direction)
  );
}

export function sanitizeLevelArrowDirections(level: Level): Level {
  let changed = false;
  const arrows = level.arrows.map((a) => {
    const direction = resolveArrowExitDirection(a.cells, a.direction);
    if (direction === a.direction) return a;
    changed = true;
    return { ...a, direction };
  });
  return changed ? { ...level, arrows } : level;
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
