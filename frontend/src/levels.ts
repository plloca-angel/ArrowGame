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
  isLevelSolvable,
  levelHasBlockedStarts,
  levelHasMultiCellPaths,
  verifyGreedyClearBoard,
  verifyFullGridFill,
} from "./levelSolvability";
import type { ArrowDef, Direction, GridCell, Level } from "./levelModel";
import {
  cellKey,
  DIR_VEC,
  getLevelFlightSurface,
} from "./levelModel";
import prebuiltLevelData from "./data/prebuiltLevels.json";
import {
  hydratePersistedLevels,
  persistGeneratedLevel,
} from "./levelPersistence";

export type { ArrowDef, Direction, GridCell, Level } from "./levelModel";
export { cellKey, getLevelActiveCellSet, DIR_VEC } from "./levelModel";

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function oppositeDir(d: Direction): Direction {
  return OPPOSITE[d];
}

export function getLevelDimensions(id: number): { rows: number; cols: number } {
  const ramp: [number, number][] = [
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

function shuffleArray<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleDirs(dirs: Direction[], rand: () => number) {
  return shuffleArray(dirs, rand);
}

function shuffledLengthRange(minLen: number, maxLen: number, rand: () => number): number[] {
  const lengths: number[] = [];
  for (let len = minLen; len <= maxLen; len++) lengths.push(len);
  if (rand() < 0.7) {
    shuffleArray(lengths, rand);
  } else {
    lengths.reverse();
  }
  return lengths;
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

      let score = rand() * 1.35;
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
    const top = candidates.filter((cand) => cand.score >= best - (0.35 + rand() * 0.55));
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
  rand: () => number,
  special = false
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
        placementContext(id, rows, cols, placed, candidate, activeCells, special)
      )
    ) {
      return candidate;
    }
  }
  return null;
}

/** Try flipping arrow directions until the board becomes solvable. */
function repairDirectionsToSolvable(level: Level): Level | null {
  const dirs: Direction[] = ["up", "down", "left", "right"];
  const arrows = level.arrows.map((a) => ({
    cells: a.cells.map((c) => ({ ...c })),
    direction: a.direction,
  }));
  const rand = mulberry32(level.id * 919191);

  for (let pass = 0; pass < 48; pass++) {
    const i = Math.floor(rand() * arrows.length);
    const options = dirs.filter((d) => d !== arrows[i].direction);
    shuffleDirs(options, rand);
    for (const dir of options) {
      arrows[i].direction = dir;
      const trial: Level = { ...level, arrows: arrows.map((a) => ({ ...a })) };
      if (!verifyFullGridFill(trial) || !levelHasMultiCellPaths(trial)) continue;
      if (trial.arrows.length >= 2 && !levelHasBlockedStarts(trial)) continue;
      if (verifyGreedyClearBoard(trial)) {
        return trial;
      }
    }
  }
  return null;
}

function forceFillOutwardSingles(
  rows: number,
  cols: number,
  activeCells: Set<string>,
  occupied: Set<string>,
  placed: ArrowDef[],
  level: Level
): void {
  const surface = getLevelFlightSurface(level);
  for (const key of activeCells) {
    if (occupied.has(key)) continue;
    const [r, c] = key.split(",").map(Number);
    const dirs: Direction[] = ["up", "down", "left", "right"];
    let chosen: ArrowDef | null = null;
    for (const dir of dirs) {
      const [dr, dc] = DIR_VEC[dir];
      const nr = r + dr;
      const nc = c + dc;
      if (
        surface.blockInteriorVoids &&
        surface.inBounds(nr, nc) &&
        !surface.isPlayable(nr, nc)
      ) {
        continue;
      }
      chosen = { cells: [{ row: r, col: c }], direction: dir };
      break;
    }
    if (!chosen) {
      chosen = { cells: [{ row: r, col: c }], direction: "up" };
    }
    placed.push(chosen);
    occupied.add(key);
  }
}

function fillRemainingSingles(
  id: number,
  rows: number,
  cols: number,
  activeCells: Set<string>,
  occupied: Set<string>,
  placed: ArrowDef[],
  rand: () => number,
  special = false
): boolean {
  let filled = false;
  for (const key of activeCells) {
    if (occupied.has(key)) continue;
    const [r, c] = key.split(",").map(Number);
    const single = tryPlaceSingle(id, rows, cols, r, c, placed, activeCells, rand, special);
    if (!single) continue;
    occupied.add(key);
    placed.push(single);
    filled = true;
  }
  return filled;
}

// One reusable context Level per activeCells set. canArrowEscapeNow only reads
// id/rows/cols/isSpecialShape/activeCells from the level (never level.arrows —
// occupancy comes from the `all` array canPlaceArrowWithOthers builds itself),
// so a single stable object is correct for every placement check in a given
// generation. This is the hot path: without it, each of the thousands of
// candidate checks per generation rebuilt the activeCells array AND its Set,
// which is what made special-shape levels take 10–25s to generate.
const placementCtxCache = new WeakMap<Set<string>, Level>();

function placementContext(
  id: number,
  rows: number,
  cols: number,
  _placed: ArrowDef[],
  _candidate: ArrowDef,
  activeCells: Set<string>,
  special: boolean
): Level {
  const cached = placementCtxCache.get(activeCells);
  if (cached) return cached;
  const level: Level = {
    id,
    rows,
    cols,
    arrows: [],
    isSpecialShape: special,
    activeCells: special
      ? [...activeCells].map((key) => {
          const [r, c] = key.split(",").map(Number);
          return { row: r, col: c };
        })
      : undefined,
  };
  placementCtxCache.set(activeCells, level);
  return level;
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

function passesAcceptance(draft: Level): boolean {
  if (!verifyFullGridFill(draft) || !levelHasMultiCellPaths(draft)) return false;
  if (draft.arrows.length >= 2 && !levelHasBlockedStarts(draft)) return false;
  return verifyGreedyClearBoard(draft) || isLevelSolvable(draft);
}

function acceptGeneratedLevel(draft: Level): boolean {
  if (!verifyFullGridFill(draft) || !levelHasMultiCellPaths(draft)) return false;
  if (draft.arrows.length >= 2 && !levelHasBlockedStarts(draft)) return false;
  return verifyGreedyClearBoard(draft);
}

export function generateLevel(id: number, shapeBump = 0): Level {
  const special = isSpecialShapeLevel(id);
  const shape = special ? getBoardShapeForLevel(id, shapeBump) : null;
  const baseDim = getLevelDimensions(id);
  const rows = shape?.rows ?? baseDim.rows;
  const cols = shape?.cols ?? baseDim.cols;
  const activeCells = shape
    ? activeCellSetFromShape(shape)
    : fullRectCellSet(rows, cols);
  const target = activeCells.size;

  for (let attempt = 0; attempt < (special ? 120 : 80); attempt++) {
    const rand = mulberry32(id * 1000003 + attempt);
    const occupied = new Set<string>();
    const placed: ArrowDef[] = [];

    while (occupied.size < target) {
      const emptyCells: GridCell[] = [];
      for (const key of activeCells) {
        if (occupied.has(key)) continue;
        const [r, c] = key.split(",").map(Number);
        emptyCells.push({ row: r, col: c });
      }

      if (emptyCells.length === 0) break;

      const placementOrder = pickPlacementOrder(emptyCells, rand, rows, cols);

      let placedThis = false;
      for (const { row: r, col: c } of placementOrder) {
        if (occupied.has(cellKey(r, c))) continue;

        const dirs = biasedDirections(r, c, rows, cols, rand);

        for (const dir of dirs) {
          const maxLen = maxPathLen(id, rows, cols, special);
          const minLen = minPathLen(id, special);
          let cells: GridCell[] | null = null;

          for (const len of shuffledLengthRange(minLen, maxLen, rand)) {
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
            for (const len of shuffledLengthRange(3, Math.min(3, maxLen), rand)) {
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
              placementContext(
                id,
                rows,
                cols,
                placed,
                candidate,
                activeCells,
                special
              )
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
        fillRemainingSingles(id, rows, cols, activeCells, occupied, placed, rand, special);
        if (occupied.size === before) break;
      }
    }

    while (occupied.size < target) {
      const before = occupied.size;
      fillRemainingSingles(id, rows, cols, activeCells, occupied, placed, rand, special);
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

function columnSerpentinePath(cells: GridCell[]): GridCell[] {
  if (cells.length === 0) return [];
  const byCol = new Map<number, GridCell[]>();
  for (const cell of cells) {
    const col = byCol.get(cell.col) ?? [];
    col.push(cell);
    byCol.set(cell.col, col);
  }
  const cols = [...byCol.keys()].sort((a, b) => a - b);
  const path: GridCell[] = [];
  cols.forEach((col, idx) => {
    const colCells = byCol.get(col)!.sort((a, b) => a.row - b.row);
    if (idx % 2 === 1) colCells.reverse();
    path.push(...colCells);
  });
  return path;
}

function biasedRandomOrder(
  cells: GridCell[],
  rand: () => number,
  rows: number,
  cols: number
): GridCell[] {
  const focusR = rand() * Math.max(1, rows - 1);
  const focusC = rand() * Math.max(1, cols - 1);
  const preferNear = rand() < 0.5;
  return [...cells].sort((a, b) => {
    const da = Math.hypot(a.row - focusR, a.col - focusC) + rand() * 2.4;
    const db = Math.hypot(b.row - focusR, b.col - focusC) + rand() * 2.4;
    return preferNear ? da - db : db - da;
  });
}

function pickPlacementOrder(
  cells: GridCell[],
  rand: () => number,
  rows: number,
  cols: number
): GridCell[] {
  const mode = Math.floor(rand() * 6);
  switch (mode) {
    case 0:
      return shuffleArray([...cells], rand);
    case 1:
      return serpentinePath(cells);
    case 2:
      return [...serpentinePath(cells)].reverse();
    case 3:
      return columnSerpentinePath(cells);
    case 4:
      return [...columnSerpentinePath(cells)].reverse();
    default:
      return biasedRandomOrder(cells, rand, rows, cols);
  }
}

function biasedDirections(
  row: number,
  col: number,
  rows: number,
  cols: number,
  rand: () => number
): Direction[] {
  const dirs: Direction[] = ["up", "down", "left", "right"];
  if (rand() < 0.42) return shuffleArray([...dirs], rand);
  const edgeDist = (dir: Direction) => {
    if (dir === "up") return row;
    if (dir === "down") return rows - 1 - row;
    if (dir === "left") return col;
    return cols - 1 - col;
  };
  const preferEdge = rand() < 0.38;
  return [...dirs].sort(
    (a, b) =>
      (preferEdge ? 1 : -1) * (edgeDist(a) - edgeDist(b)) + (rand() - 0.5) * 2.8
  );
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

  for (let attempt = 0; attempt < 80; attempt++) {
    const rand = mulberry32(id * 5003 + attempt);
    const occupied = new Set<string>();
    const placed: ArrowDef[] = [];
    const order = pickPlacementOrder(playable, rand, rows, cols);

    for (const { row, col } of order) {
      if (occupied.has(cellKey(row, col))) continue;

      const dirs = biasedDirections(row, col, rows, cols, rand);
      let added = false;

      for (const dir of dirs) {
        const maxLen = maxPathLen(id, rows, cols, special);
        for (const len of shuffledLengthRange(2, maxLen, rand)) {
          const cells = growPath(row, col, dir, len, activeCells, occupied, rand, false);
          if (!cells) continue;
          if (!headAlignsWithExit(cells, dir)) continue;
          const candidate = { cells, direction: dir };
          if (
            !canPlaceArrowWithOthers(
              candidate,
              placed,
              activeCells,
              placementContext(
                id,
                rows,
                cols,
                placed,
                candidate,
                activeCells,
                special
              )
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
      fillRemainingSingles(id, rows, cols, activeCells, occupied, placed, rand, special);
      if (occupied.size === before) break;
    }

    if (occupied.size !== target) continue;
    const draft = levelFromPlaced(id, rows, cols, placed, shape, special);
    if (acceptGeneratedLevel(draft)) return draft;
  }

  return buildGuaranteedMultiCellLevel(id, shape, activeCells, special);
}

/** Deterministic last resort — short snake arrows, not a grid of singles. */
function buildGuaranteedMultiCellLevel(
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
  const placed: ArrowDef[] = [];
  const occupied = new Set<string>();

  for (let variant = 0; variant < 32; variant++) {
    placed.length = 0;
    occupied.clear();
    const rand = mulberry32(id * 424242 + variant * 7919);
    const order = pickPlacementOrder(playable, rand, rows, cols);

    for (const { row, col } of order) {
      if (occupied.has(cellKey(row, col))) continue;

      const dirs = biasedDirections(row, col, rows, cols, rand);

      let added: ArrowDef | null = null;
      const maxLen = maxPathLen(id, rows, cols, special);
      for (const dir of dirs) {
        for (const len of shuffledLengthRange(2, Math.min(maxLen, 4), rand)) {
          const cells = growPath(row, col, dir, len, activeCells, occupied, rand, false);
          if (!cells || !headAlignsWithExit(cells, dir)) continue;
          const candidate = { cells, direction: dir };
          added = candidate;
          break;
        }
        if (added) break;
      }

      if (!added) {
        added = tryPlaceSingle(
          id,
          rows,
          cols,
          row,
          col,
          placed,
          activeCells,
          rand,
          special
        );
      }
      if (!added) continue;

      for (const cell of added.cells) occupied.add(cellKey(cell.row, cell.col));
      placed.push(added);
    }

    fillRemainingSingles(id, rows, cols, activeCells, occupied, placed, rand, special);
    if (occupied.size !== activeCells.size) {
      const partial = levelFromPlaced(id, rows, cols, placed, shape, special);
      forceFillOutwardSingles(rows, cols, activeCells, occupied, placed, partial);
    }

    const draft = levelFromPlaced(id, rows, cols, placed, shape, special);
    if (acceptGeneratedLevel(draft)) return draft;
    const repaired = repairDirectionsToSolvable(draft);
    if (repaired) return repaired;
  }

  throw new Error(`Failed to build solvable level ${id}`);
}

const levelCache = new Map<number, Level>();
export const LEVEL_CACHE_VERSION = 22;
let activeCacheVersion = 0;

// Levels pre-generated at build time (scripts/prebuild-levels.ts). They're
// deterministic per id, so these are identical to live generation but cost
// nothing on device — the generator can take many seconds for some special
// shapes (worst observed: 65s). Only used when the bundle matches the current
// cache version; otherwise we fall back to generating live. Levels beyond the
// bundled range are always generated live (and then cached for the session).
const prebuiltBundle = prebuiltLevelData as unknown as {
  version: number;
  maxLevel: number;
  levels: Record<string, Level>;
};
const prebuiltLevels: Map<number, Level> =
  prebuiltBundle.version === LEVEL_CACHE_VERSION
    ? new Map(
        Object.entries(prebuiltBundle.levels).map(([k, v]) => [Number(k), v])
      )
    : new Map();

export const PREBUILT_MAX_LEVEL = prebuiltBundle.maxLevel ?? 200;

let persistedLevels = new Map<number, Level>();
let hydratePromise: Promise<void> | null = null;

/** Load AsyncStorage cache for levels beyond the prebuilt bundle (call once at app start). */
export function hydrateLevelCache(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = hydratePersistedLevels(
      LEVEL_CACHE_VERSION,
      PREBUILT_MAX_LEVEL
    ).then((map) => {
      persistedLevels = map;
      for (const [id, level] of map) {
        levelCache.set(id, level);
      }
    });
  }
  return hydratePromise;
}

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

  const prebuilt = prebuiltLevels.get(key);
  if (prebuilt) {
    levelCache.set(key, prebuilt);
    return prebuilt;
  }

  const persisted = persistedLevels.get(key);
  if (persisted) {
    levelCache.set(key, persisted);
    return persisted;
  }

  const level = buildLevelFresh(key);
  levelCache.set(key, level);
  if (key > PREBUILT_MAX_LEVEL) {
    void persistGeneratedLevel(
      LEVEL_CACHE_VERSION,
      PREBUILT_MAX_LEVEL,
      key,
      level
    );
  }
  return level;
}

/**
 * Runs the procedural generator from scratch, bypassing both the session cache
 * and the prebuilt bundle. Used by the build-time prebuild script so re-running
 * it always regenerates rather than reading back its own previous output.
 */
export function buildLevelFresh(id: number): Level {
  const key = Math.max(1, id);
  const shapeBumps = isSpecialShapeLevel(key) ? [0, 13, 29, 41, 57] : [0];
  let lastError: unknown;
  for (const bump of shapeBumps) {
    try {
      const level = generateLevel(key, bump);
      if (passesAcceptance(level)) return level;
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError instanceof Error) throw lastError;
  throw new Error(`Failed to build solvable level ${key}`);
}

/** Pre-generate a level off the critical UI path (e.g. on home screen). */
export function warmLevel(id: number): void {
  const key = Math.max(1, id);
  if (levelCache.has(key)) return;
  setTimeout(() => {
    try {
      getLevel(key);
    } catch {
      // generation retries on next getLevel call
    }
  }, 0);
}
