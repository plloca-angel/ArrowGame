// Arrow Puzzle Escape - procedural levels with winding multi-cell paths
// Solvability: arrows placed center-out; each has clear exit before later blockers.
// Solve order = array order (index 0 fires first).

import {
  activeCellSetFromShape,
  fullRectCellSet,
  getBoardShapeForLevel,
  isSpecialShapeLevel,
} from "./boardShapes";
import {
  canPlaceArrowWithOthers,
  verifyCanonicalSolveOrder,
  verifyFullGridFill,
} from "./levelSolvability";

export type Direction = "up" | "down" | "left" | "right";

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
  /** Present on levels 5, 10, 15 … */
  shapeName?: string;
  shapeCategory?: string;
  isSpecialShape?: boolean;
  /** Playable cells; omitted on standard full rectangles. */
  activeCells?: GridCell[];
};

export const DIR_VEC: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function cellKey(r: number, c: number) {
  return `${r},${c}`;
}

export function oppositeDir(d: Direction): Direction {
  return OPPOSITE[d];
}

export function dirAngle(d: Direction): number {
  switch (d) {
    case "right":
      return 0;
    case "down":
      return 90;
    case "left":
      return 180;
    case "up":
      return -90;
  }
}

export function getLevelDimensions(id: number): { rows: number; cols: number } {
  const ramp: Array<[number, number]> = [
    [3, 3], [3, 4], [3, 4],
    [4, 4], [4, 4],
    [4, 5], [4, 5],
    [5, 5], [5, 5],
    [5, 6], [5, 6], [5, 6],
    [6, 6], [6, 6], [6, 6], [6, 6],
    [6, 7], [6, 7], [6, 7], [6, 7],
    [7, 7], [7, 7], [7, 7], [7, 7], [7, 7],
    [7, 8], [7, 8], [7, 8], [7, 8], [7, 8],
    [8, 8], [8, 8], [8, 8], [8, 8], [8, 8], [8, 8],
    [8, 9], [8, 9], [8, 9], [8, 9], [8, 9], [8, 9],
    [9, 9], [9, 9], [9, 9], [9, 9], [9, 9], [9, 9], [9, 9], [9, 9],
  ];
  if (id - 1 < ramp.length) {
    const [r, c] = ramp[id - 1];
    return { rows: r, cols: c };
  }
  const beyond = id - ramp.length;
  if (beyond <= 10) return { rows: 9, cols: 10 };
  if (beyond <= 22) return { rows: 10, cols: 10 };
  if (beyond <= 35) return { rows: 10, cols: 11 };
  if (beyond <= 50) return { rows: 11, cols: 11 };
  if (beyond <= 70) return { rows: 11, cols: 12 };
  return { rows: 12, cols: 12 };
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleDirs(dirs: Direction[], rand: () => number) {
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }
  return dirs;
}

export function getLevelActiveCellSet(level: Level): Set<string> {
  if (level.activeCells?.length) {
    return new Set(level.activeCells.map((c) => cellKey(c.row, c.col)));
  }
  return fullRectCellSet(level.rows, level.cols);
}

function occupiedNeighborScore(
  r: number,
  c: number,
  occupied: Set<string>
): number {
  let score = 0;
  for (const [dr, dc] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    if (occupied.has(cellKey(r + dr, c + dc))) score++;
  }
  return score;
}

function headAlignsWithExit(cells: GridCell[], dir: Direction): boolean {
  if (cells.length < 2) return true;
  const head = cells[cells.length - 1];
  const prev = cells[cells.length - 2];
  const [pdr, pdc] = DIR_VEC[dir];
  return prev.row === head.row - pdr && prev.col === head.col - pdc;
}

function stepDir(from: GridCell, to: GridCell): Direction | null {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (dr === -1 && dc === 0) return "up";
  if (dr === 1 && dc === 0) return "down";
  if (dr === 0 && dc === -1) return "left";
  if (dr === 0 && dc === 1) return "right";
  return null;
}

/** True when every cell shares the same row or the same column. */
function isStraightLine(cells: GridCell[]): boolean {
  if (cells.length <= 1) return true;
  const sameRow = cells.every((c) => c.row === cells[0].row);
  const sameCol = cells.every((c) => c.col === cells[0].col);
  return sameRow || sameCol;
}

function countTurns(cells: GridCell[]): number {
  if (cells.length < 3) return 0;
  let turns = 0;
  let prevDir: Direction | null = null;
  for (let i = 1; i < cells.length; i++) {
    const d = stepDir(cells[i - 1], cells[i]);
    if (d && prevDir && d !== prevDir) turns++;
    if (d) prevDir = d;
  }
  return turns;
}

function pathQuality(cells: GridCell[], minLen: number): boolean {
  if (cells.length < minLen) return cells.length >= 2;
  if (cells.length >= 3 && isStraightLine(cells)) return false;
  if (cells.length >= 4 && countTurns(cells) < 1) return false;
  return true;
}

/** Grow a winding tail with preferred 90° twists, weaving near other arrows. */
function growPath(
  headR: number,
  headC: number,
  dir: Direction,
  length: number,
  activeCells: Set<string>,
  occupied: Set<string>,
  rand: () => number,
  dense = false
): GridCell[] | null {
  const path: GridCell[] = [{ row: headR, col: headC }];
  let r = headR;
  let c = headC;
  let prev: Direction | null = null;

  for (let seg = 1; seg < length; seg++) {
    const all: Direction[] = ["up", "down", "left", "right"];
    const candidates: { d: Direction; score: number }[] = [];

    for (const d of all) {
      if (prev && d === oppositeDir(prev)) continue;
      const [dr, dc] = DIR_VEC[d];
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0) continue;
      if (!activeCells.has(cellKey(nr, nc))) continue;
      if (occupied.has(cellKey(nr, nc))) continue;
      if (path.some((p) => p.row === nr && p.col === nc)) continue;

      let score = rand() * 0.25;
      if (seg === 1) {
        if (d === oppositeDir(dir)) score += 2.5;
        const perpToExit = d !== dir && d !== oppositeDir(dir);
        if (perpToExit) score += 1.8;
      }
      if (prev) {
        const [pdr, pdc] = DIR_VEC[prev];
        const sameAxis =
          (pdr !== 0 && dr !== 0 && dc === 0) || (pdc !== 0 && dc !== 0 && dr === 0);
        if (sameAxis) score -= 3.5;
        const isPerp = dr !== pdr || dc !== pdc;
        if (isPerp && !(pdr === 0 && dr === 0) && !(pdc === 0 && dc === 0)) {
          score += 4.2;
        }
      }
      score += occupiedNeighborScore(nr, nc, occupied) * (dense ? 2.8 : 1.6);
      if (dense && prev) score += 1.2;
      candidates.push({ d, score });
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0].score;
    const top = candidates.filter((cand) => cand.score >= best - 0.45);
    const picked = top[Math.floor(rand() * top.length)].d;

    const [dr, dc] = DIR_VEC[picked];
    r += dr;
    c += dc;
    path.unshift({ row: r, col: c });
    prev = picked;
  }
  if (length >= 3 && isStraightLine(path)) return null;
  if (length >= 4 && countTurns(path) < 1) return null;
  return path;
}

function levelQualityStats(placed: ArrowDef[]) {
  const straightMulti = placed.filter(
    (a) => a.cells.length >= 2 && isStraightLine(a.cells)
  ).length;
  const twisted = placed.filter(
    (a) => a.cells.length >= 3 && !isStraightLine(a.cells)
  ).length;
  const singles = placed.filter((a) => a.cells.length === 1).length;
  return { straightMulti, twisted, singles };
}

function passesLevelQuality(
  placed: ArrowDef[],
  id: number,
  cellCount: number,
  special = false
): boolean {
  const { straightMulti, twisted, singles } = levelQualityStats(placed);
  const n = placed.length;
  if (special) {
    if (straightMulti / n > 0.12) return false;
    if (twisted / n < 0.32) return false;
    if (n < Math.max(10, Math.floor(cellCount / 4.5))) return false;
    if (singles / n > 0.15) return false;
    return true;
  }
  if (straightMulti / n > 0.12 && id > 2) return false;
  if (twisted / n < 0.28 && id > 2 && cellCount > 9) return false;
  if (cellCount > 16 && singles / n > 0.28) return false;
  if (cellCount > 16 && twisted / n < 0.22 && id > 4) return false;
  return true;
}

function minPathLen(id: number, special = false): number {
  if (special) return 3;
  if (id <= 2) return 2;
  return 3;
}

function maxPathLen(
  id: number,
  rows: number,
  cols: number,
  special = false
): number {
  const cap = Math.min(rows, cols, special ? 10 : 10);
  if (special) {
    return Math.min(cap, Math.max(6, 5 + Math.floor(id / 8)));
  }
  return Math.min(
    cap,
    Math.max(4, 3 + Math.floor(id / 2) + (id >= 8 ? 2 : 0))
  );
}

function tryPlaceSingle(
  id: number,
  rows: number,
  cols: number,
  r: number,
  c: number,
  placed: ArrowDef[],
  activeCells: Set<string>,
  rand: () => number
): ArrowDef | null {
  const dirs: Direction[] = ["up", "down", "left", "right"];
  shuffleDirs(dirs, rand);
  for (const dir of dirs) {
    const candidate = { cells: [{ row: r, col: c }], direction: dir };
    if (
      canPlaceArrowWithOthers(
        candidate,
        placed,
        activeCells,
        placementContext(id, rows, cols, placed, candidate)
      )
    ) {
      return candidate;
    }
  }
  return null;
}

function fillRemainingSingles(
  id: number,
  rows: number,
  cols: number,
  activeCells: Set<string>,
  occupied: Set<string>,
  placed: ArrowDef[],
  rand: () => number
): boolean {
  let filled = false;
  for (const key of activeCells) {
    if (occupied.has(key)) continue;
    const [r, c] = key.split(",").map(Number);
    const single = tryPlaceSingle(id, rows, cols, r, c, placed, activeCells, rand);
    if (!single) continue;
    occupied.add(key);
    placed.push(single);
    filled = true;
  }
  return filled;
}

function placementContext(
  id: number,
  rows: number,
  cols: number,
  placed: ArrowDef[],
  candidate: ArrowDef
): Level {
  return {
    id,
    rows,
    cols,
    arrows: [...placed, candidate],
  };
}

function levelFromPlaced(
  id: number,
  rows: number,
  cols: number,
  placed: ArrowDef[],
  shape: ReturnType<typeof getBoardShapeForLevel> | null,
  special: boolean
): Level {
  const arrows = [...placed].reverse();
  return {
    id,
    rows,
    cols,
    arrows,
    shapeName: shape?.name,
    shapeCategory: shape?.category,
    isSpecialShape: special,
    activeCells: special && shape ? shape.cells.map((c) => ({ ...c })) : undefined,
    hint:
      id === 1
        ? "Tap an arrow — it slides along its path and exits where the tip points!"
        : special && shape
        ? `Special shape: ${shape.name}!`
        : undefined,
  };
}

function acceptGeneratedLevel(draft: Level): boolean {
  return verifyFullGridFill(draft) && verifyCanonicalSolveOrder(draft);
}

export function generateLevel(id: number): Level {
  const special = isSpecialShapeLevel(id);
  const shape = special ? getBoardShapeForLevel(id) : null;
  const baseDim = getLevelDimensions(id);
  const rows = shape?.rows ?? baseDim.rows;
  const cols = shape?.cols ?? baseDim.cols;
  const activeCells = shape
    ? activeCellSetFromShape(shape)
    : fullRectCellSet(rows, cols);
  const target = activeCells.size;

  for (let attempt = 0; attempt < (special ? 500 : 350); attempt++) {
    const rand = mulberry32(id * 1000003 + attempt);
    const occupied = new Set<string>();
    const placed: ArrowDef[] = [];

    while (occupied.size < target) {
      const empties: { r: number; c: number; d: number; weave: number }[] = [];
      for (const key of activeCells) {
        if (occupied.has(key)) continue;
        const [r, c] = key.split(",").map(Number);
        empties.push({
          r,
          c,
          d: Math.min(r, rows - 1 - r, c, cols - 1 - c),
          weave: occupiedNeighborScore(r, c, occupied),
        });
      }

      if (empties.length === 0) break;

      empties.sort(
        (a, b) =>
          b.weave - a.weave ||
          b.d - a.d ||
          rand() - 0.5
      );

      let placedThis = false;
      for (const { r, c } of empties) {
        const dirs: Direction[] = ["up", "down", "left", "right"];
        shuffleDirs(dirs, rand);

        for (const dir of dirs) {
          const maxLen = maxPathLen(id, rows, cols, special);
          const minLen = minPathLen(id, special);
          let cells: GridCell[] | null = null;

          for (let len = maxLen; len >= minLen; len--) {
            cells = growPath(r, c, dir, len, activeCells, occupied, rand, special);
            if (cells && cells.length >= 2 && !headAlignsWithExit(cells, dir)) {
              cells = null;
              continue;
            }
            if (cells && !pathQuality(cells, minLen)) {
              cells = null;
              continue;
            }
            if (cells) break;
          }

          if (!cells && minLen > 2) {
            for (let len = Math.min(3, maxLen); len >= 3; len--) {
              cells = growPath(r, c, dir, len, activeCells, occupied, rand, special);
              if (cells && cells.length >= 2 && !headAlignsWithExit(cells, dir)) {
                cells = null;
                continue;
              }
              if (cells && isStraightLine(cells)) {
                cells = null;
                continue;
              }
              if (cells) break;
            }
          }

          if (!cells) {
            if (id <= 2) cells = [{ row: r, col: c }];
            else continue;
          }

          const candidate = { cells, direction: dir };
          if (
            !canPlaceArrowWithOthers(
              candidate,
              placed,
              activeCells,
              placementContext(id, rows, cols, placed, candidate)
            )
          ) {
            continue;
          }

          for (const cell of cells) {
            occupied.add(cellKey(cell.row, cell.col));
          }
          placed.push(candidate);
          placedThis = true;
          break;
        }
        if (placedThis) break;
      }

      if (!placedThis) {
        const before = occupied.size;
        fillRemainingSingles(id, rows, cols, activeCells, occupied, placed, rand);
        if (occupied.size === before) break;
      }
    }

    while (occupied.size < target) {
      const before = occupied.size;
      fillRemainingSingles(id, rows, cols, activeCells, occupied, placed, rand);
      if (occupied.size === before) break;
    }

    if (occupied.size === target && passesLevelQuality(placed, id, target, special)) {
      const draft = levelFromPlaced(id, rows, cols, placed, shape, special);
      if (acceptGeneratedLevel(draft)) return draft;
    }
  }
  return buildSolvableFallbackLevel(id, shape, activeCells, special);
}

function serpentinePath(cells: GridCell[]): GridCell[] {
  if (cells.length === 0) return [];
  const byRow = new Map<number, GridCell[]>();
  for (const cell of cells) {
    const row = byRow.get(cell.row) ?? [];
    row.push(cell);
    byRow.set(cell.row, row);
  }
  const rows = [...byRow.keys()].sort((a, b) => a - b);
  const path: GridCell[] = [];
  rows.forEach((row, idx) => {
    const rowCells = byRow.get(row)!.sort((a, b) => a.col - b.col);
    if (idx % 2 === 1) rowCells.reverse();
    path.push(...rowCells);
  });
  return path;
}

function buildSolvableFallbackLevel(
  id: number,
  shape: ReturnType<typeof getBoardShapeForLevel> | null,
  activeCells: Set<string>,
  special: boolean
): Level {
  const rows = shape?.rows ?? getLevelDimensions(id).rows;
  const cols = shape?.cols ?? getLevelDimensions(id).cols;
  const target = activeCells.size;
  const playable = [...activeCells].map((key) => {
    const [r, c] = key.split(",").map(Number);
    return { row: r, col: c };
  });

  for (let attempt = 0; attempt < 800; attempt++) {
    const rand = mulberry32(id * 5003 + attempt);
    const occupied = new Set<string>();
    const placed: ArrowDef[] = [];
    const order = serpentinePath(playable);
    if (attempt % 2 === 1) order.reverse();
    if (attempt % 3 === 2) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }

    for (const { row, col } of order) {
      if (occupied.has(cellKey(row, col))) continue;

      const dirs: Direction[] = ["up", "down", "left", "right"];
      shuffleDirs(dirs, rand);
      let added = false;

      for (const dir of dirs) {
        const maxLen = Math.min(5, maxPathLen(id, rows, cols, special));
        for (let len = maxLen; len >= 1; len--) {
          let cells: GridCell[] | null =
            len === 1
              ? [{ row, col }]
              : growPath(row, col, dir, len, activeCells, occupied, rand, false);
          if (!cells) continue;
          if (cells.length >= 2 && !headAlignsWithExit(cells, dir)) continue;
          const candidate = { cells, direction: dir };
          if (
            !canPlaceArrowWithOthers(
              candidate,
              placed,
              activeCells,
              placementContext(id, rows, cols, placed, candidate)
            )
          ) {
            continue;
          }
          for (const cell of cells) occupied.add(cellKey(cell.row, cell.col));
          placed.push(candidate);
          added = true;
          break;
        }
        if (added) break;
      }
    }

    while (occupied.size < target) {
      const before = occupied.size;
      fillRemainingSingles(id, rows, cols, activeCells, occupied, placed, rand);
      if (occupied.size === before) break;
    }

    if (occupied.size !== target) continue;
    const draft = levelFromPlaced(id, rows, cols, placed, shape, special);
    if (acceptGeneratedLevel(draft)) return draft;
  }

  return buildSingleCellSolvableLevel(id, shape, activeCells, special);
}

function buildSingleCellSolvableLevel(
  id: number,
  shape: ReturnType<typeof getBoardShapeForLevel> | null,
  activeCells: Set<string>,
  special: boolean
): Level {
  const rows = shape?.rows ?? getLevelDimensions(id).rows;
  const cols = shape?.cols ?? getLevelDimensions(id).cols;
  const playable = [...activeCells].map((key) => {
    const [r, c] = key.split(",").map(Number);
    return { row: r, col: c };
  });

  for (let attempt = 0; attempt < 1200; attempt++) {
    const rand = mulberry32(id * 9001 + attempt);
    const placed: ArrowDef[] = [];
    const occupied = new Set<string>();
    const order = serpentinePath(playable);
    if (attempt % 2 === 1) order.reverse();
    if (attempt % 5 === 3) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    }

    for (const { row, col } of order) {
      const single = tryPlaceSingle(id, rows, cols, row, col, placed, activeCells, rand);
      if (!single) break;
      occupied.add(cellKey(row, col));
      placed.push(single);
    }

    if (occupied.size !== playable.length) continue;
    const draft = levelFromPlaced(id, rows, cols, placed, shape, special);
    if (acceptGeneratedLevel(draft)) return draft;
  }

  throw new Error(`Failed to build solvable level ${id}`);
}

const levelCache = new Map<number, Level>();
const LEVEL_CACHE_VERSION = 2;
let activeCacheVersion = 0;

export function clearLevelCache(): void {
  levelCache.clear();
}

export function getLevel(id: number): Level {
  if (activeCacheVersion !== LEVEL_CACHE_VERSION) {
    levelCache.clear();
    activeCacheVersion = LEVEL_CACHE_VERSION;
  }
  const key = Math.max(1, id);
  const cached = levelCache.get(key);
  if (cached) return cached;
  const level = generateLevel(key);
  levelCache.set(key, level);
  return level;
}
