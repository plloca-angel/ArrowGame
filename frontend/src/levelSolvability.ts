import { simulateSnakeFlight } from "./arrowMotion";
import {
  ArrowDef,
  Level,
  cellKey,
  getLevelActiveCellSet,
} from "./levels";

const ESCAPE_EXTRA_CELLS = 2;

function occupancyFromIndices(
  arrows: ArrowDef[],
  present: Set<number>,
  skip?: number
): Set<string> {
  const occ = new Set<string>();
  for (let i = 0; i < arrows.length; i++) {
    if (i === skip || !present.has(i)) continue;
    for (const c of arrows[i].cells) {
      occ.add(cellKey(c.row, c.col));
    }
  }
  return occ;
}

function gameFlightParams(level: Level, arrow: ArrowDef) {
  return {
    escapeExtra: Math.max(
      ESCAPE_EXTRA_CELLS,
      Math.ceil(arrow.cells.length * 0.75)
    ),
    travelLimit: level.rows + level.cols,
  };
}

export function canArrowEscapeNow(
  arrow: ArrowDef,
  arrows: ArrowDef[],
  arrowIndex: number,
  present: Set<number>,
  activeCells: Set<string>,
  level?: Level
): boolean {
  const occ = occupancyFromIndices(arrows, present, arrowIndex);
  const onBoard = (r: number, c: number) => activeCells.has(cellKey(r, c));
  const isOccupied = (r: number, c: number) => occ.has(cellKey(r, c));
  const { escapeExtra, travelLimit } = level
    ? gameFlightParams(level, arrow)
    : { escapeExtra: ESCAPE_EXTRA_CELLS, travelLimit: 96 };
  const flight = simulateSnakeFlight(
    arrow.cells.map((c) => ({ ...c })),
    arrow.direction,
    onBoard,
    isOccupied,
    escapeExtra,
    travelLimit
  );
  return flight.result === "escape";
}

/** Every playable cell covered exactly once. */
export function verifyFullGridFill(level: Level): boolean {
  const active = getLevelActiveCellSet(level);
  const covered = new Set<string>();
  for (const arrow of level.arrows) {
    for (const cell of arrow.cells) {
      const key = cellKey(cell.row, cell.col);
      if (!active.has(key) || covered.has(key)) return false;
      covered.add(key);
    }
  }
  return covered.size === active.size;
}

/** Intended solve order: fire arrows[0], then [1], … each removed after escaping. */
export function verifyCanonicalSolveOrder(level: Level): boolean {
  const activeCells = getLevelActiveCellSet(level);
  const n = level.arrows.length;
  const present = new Set<number>(Array.from({ length: n }, (_, i) => i));

  for (let i = 0; i < n; i++) {
    if (
      !canArrowEscapeNow(
        level.arrows[i],
        level.arrows,
        i,
        present,
        activeCells,
        level
      )
    ) {
      return false;
    }
    present.delete(i);
  }
  return true;
}

/** Backtracking search — level is solvable if any removal order clears the board. */
export function findSolveOrder(level: Level): number[] | null {
  const activeCells = getLevelActiveCellSet(level);
  const n = level.arrows.length;
  const present = new Set<number>(Array.from({ length: n }, (_, i) => i));
  const order: number[] = [];

  const dfs = (): boolean => {
    if (order.length === n) return true;
    for (let i = 0; i < n; i++) {
      if (!present.has(i)) continue;
      if (
        !canArrowEscapeNow(
          level.arrows[i],
          level.arrows,
          i,
          present,
          activeCells,
          level
        )
      ) {
        continue;
      }
      order.push(i);
      present.delete(i);
      if (dfs()) return true;
      present.add(i);
      order.pop();
    }
    return false;
  };

  return dfs() ? order : null;
}

/** Matches in-game hint: always fire the first escapable idle arrow. */
export function verifyGreedyHintSolve(level: Level): boolean {
  const activeCells = getLevelActiveCellSet(level);
  const n = level.arrows.length;
  const present = new Set<number>(Array.from({ length: n }, (_, i) => i));

  while (present.size > 0) {
    let fired: number | null = null;
    for (let i = 0; i < n; i++) {
      if (!present.has(i)) continue;
      if (
        canArrowEscapeNow(
          level.arrows[i],
          level.arrows,
          i,
          present,
          activeCells,
          level
        )
      ) {
        fired = i;
        break;
      }
    }
    if (fired === null) return false;
    present.delete(fired);
  }
  return true;
}

export function isLevelSolvable(level: Level): boolean {
  return findSolveOrder(level) !== null;
}

export function canPlaceArrowWithOthers(
  candidate: ArrowDef,
  placed: ArrowDef[],
  activeCells: Set<string>,
  level?: Level
): boolean {
  const all = [...placed, candidate];
  const present = new Set<number>(all.map((_, i) => i));
  return canArrowEscapeNow(
    candidate,
    all,
    placed.length,
    present,
    activeCells,
    level
  );
}

export type LevelAuditResult = {
  levelId: number;
  shapeName?: string;
  arrows: number;
  cells: number;
  fill: boolean;
  solvable: boolean;
  canonical: boolean;
  greedyHint: boolean;
  solveOrder: number[] | null;
  ms: number;
  ok: boolean;
};

export function auditLevel(level: Level): LevelAuditResult {
  const t0 = Date.now();
  const fill = verifyFullGridFill(level);
  const solvable = isLevelSolvable(level);
  const canonical = verifyCanonicalSolveOrder(level);
  const greedyHint = verifyGreedyHintSolve(level);
  const solveOrder = solvable ? findSolveOrder(level) : null;

  return {
    levelId: level.id,
    shapeName: level.shapeName,
    arrows: level.arrows.length,
    cells: getLevelActiveCellSet(level).size,
    fill,
    solvable,
    canonical,
    greedyHint,
    solveOrder,
    ms: Date.now() - t0,
    ok: fill && solvable,
  };
}
