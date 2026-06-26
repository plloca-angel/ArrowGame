import { simulateSnakeFlight, snakeStep } from "./arrowMotion";
import { canLiveArrowEscape, toLiveArrow } from "./gameBoard";
import {
  ArrowDef,
  Level,
  arrowExitDirectionValid,
  cellKey,
  getLevelActiveCellSet,
  getLevelFlightSurface,
} from "./levelModel";

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
  if (activeCells.size === 0) return false;
  const occ = occupancyFromIndices(arrows, present, arrowIndex);
  const isOccupied = (r: number, c: number) => occ.has(cellKey(r, c));
  const { escapeExtra, travelLimit } = level
    ? gameFlightParams(level, arrow)
    : { escapeExtra: ESCAPE_EXTRA_CELLS, travelLimit: 96 };
  const surface = level
    ? getLevelFlightSurface(level)
    : {
        isPlayable: (r: number, c: number) => activeCells.has(cellKey(r, c)),
        inBounds: () => true,
        blockInteriorVoids: false,
      };
  const flight = simulateSnakeFlight(
    arrow.cells.map((c) => ({ ...c })),
    arrow.direction,
    surface.isPlayable,
    isOccupied,
    escapeExtra,
    travelLimit,
    level
      ? {
          inBounds: surface.inBounds,
          blockInteriorVoids: surface.blockInteriorVoids,
        }
      : undefined
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
export function findSolveOrder(
  level: Level,
  maxNodes = 120_000
): number[] | null {
  const activeCells = getLevelActiveCellSet(level);
  const n = level.arrows.length;
  const present = new Set<number>(Array.from({ length: n }, (_, i) => i));
  const order: number[] = [];
  let nodes = 0;

  const dfs = (): boolean => {
    if (++nodes > maxNodes) return false;
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

/** Fast solvability check for large / special boards during generation. */
export function verifyGreedyClearBoard(level: Level): boolean {
  const activeCells = getLevelActiveCellSet(level);
  const n = level.arrows.length;
  const present = new Set<number>(Array.from({ length: n }, (_, i) => i));

  while (present.size > 0) {
    let removed = false;
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
        present.delete(i);
        removed = true;
        break;
      }
    }
    if (!removed) return false;
  }
  return true;
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

/** How many arrows can escape on the opening board. */
export function countEscapableAtStart(level: Level): number {
  const activeCells = getLevelActiveCellSet(level);
  const n = level.arrows.length;
  const present = new Set<number>(Array.from({ length: n }, (_, i) => i));
  let count = 0;
  for (let i = 0; i < n; i++) {
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
      count++;
    }
  }
  return count;
}

/** Require winding multi-cell paths, not a grid of singles. */
export function levelHasMultiCellPaths(level: Level): boolean {
  const n = level.arrows.length;
  if (n === 0) return false;
  const multi = level.arrows.filter((a) => a.cells.length >= 2).length;
  if (level.id <= 2) return multi >= 1;
  if (n <= 6) return multi >= 2;
  return multi >= Math.max(3, Math.ceil(n * 0.28));
}

/** At least one arrow is blocked until others move. */
export function levelHasBlockedStarts(level: Level): boolean {
  if (level.arrows.length < 2) return true;
  const esc = countEscapableAtStart(level);
  const n = level.arrows.length;
  if (esc >= n) return false;
  if (level.isSpecialShape) {
    return esc <= Math.max(2, Math.ceil(n * 0.55));
  }
  if (level.id >= 4) {
    const cap = Math.max(2, Math.ceil(n * 0.35));
    return esc <= cap;
  }
  return esc < n;
}

export function isRemainderSolvable(
  level: Level,
  present: Set<number>
): boolean {
  const remaining = level.arrows.filter((_, i) => present.has(i));
  if (remaining.length === 0) return true;
  const sub: Level = {
    ...level,
    arrows: remaining.map((a) => ({
      cells: a.cells.map((c) => ({ ...c })),
      direction: a.direction,
    })),
  };
  return findSolveOrder(sub) !== null;
}

/** At least two escapable arrows where one choice still solves and one dead-ends. */
export function levelHasMisleadingMoves(level: Level): boolean {
  if (level.arrows.length < 2) return true;

  const activeCells = getLevelActiveCellSet(level);
  const n = level.arrows.length;
  const present = new Set<number>(Array.from({ length: n }, (_, i) => i));

  const escapable: number[] = [];
  for (let i = 0; i < n; i++) {
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
      escapable.push(i);
    }
  }
  if (escapable.length < 2) return false;

  let hasTrap = false;
  let hasSafe = false;
  for (const i of escapable) {
    const next = new Set(present);
    next.delete(i);
    if (isRemainderSolvable(level, next)) hasSafe = true;
    else hasTrap = true;
  }
  return hasTrap && hasSafe;
}

type BoardArrow = {
  id?: string;
  cells: { row: number; col: number }[];
  direction: ArrowDef["direction"];
  status: string;
};

/** Live board (idle/flying arrows) still has a complete solve path. */
export function isArrowBoardSolvable(
  level: Level,
  states: BoardArrow[]
): boolean {
  const remaining = states
    .filter((a) => a.status === "idle" || a.status === "flying")
    .map((a) => ({
      cells: a.cells.map((c) => ({ ...c })),
      direction: a.direction,
    }));
  if (remaining.length === 0) return true;
  const sub: Level = { ...level, arrows: remaining };
  return findSolveOrder(sub) !== null;
}

/** First arrow index that escapes and leaves a solvable remainder. */
export function findSafeEscapeIndex(
  level: Level,
  present: Set<number>
): number | null {
  const activeCells = getLevelActiveCellSet(level);
  const n = level.arrows.length;
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
    const next = new Set(present);
    next.delete(i);
    if (isRemainderSolvable(level, next)) return i;
  }
  return null;
}

/** Safe hint target using the live board, not the level template. */
export function findSafeEscapeFromStates(
  level: Level,
  states: BoardArrow[]
): number | null {
  const liveStates = states.filter(
    (a) => a.status === "idle" || a.status === "flying"
  );
  if (liveStates.length === 0) return null;

  const liveBoard = liveStates.map((a) =>
    toLiveArrow({
      id: a.id ?? "",
      cells: a.cells,
      direction: a.direction,
      status: a.status as "idle" | "flying" | "escaped" | "broken",
    })
  );

  for (let i = 0; i < liveStates.length; i++) {
    const candidate = liveStates[i];
    const live = liveBoard[i];
    if (!canLiveArrowEscape(live, liveBoard, level)) continue;

    const after = states.map((a) =>
      a.id === candidate.id ? { ...a, status: "escaped" } : a
    );
    if (isArrowBoardSolvable(level, after)) {
      const suffix = candidate.id?.split("-").pop();
      const idx = Number(suffix);
      return Number.isFinite(idx) ? idx : i;
    }
  }
  return null;
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

export function verifyLevelMoveRules(level: Level): string[] {
  const errors: string[] = [];
  const active = getLevelActiveCellSet(level);
  const n = level.arrows.length;
  const present = new Set(Array.from({ length: n }, (_, i) => i));
  const surface = getLevelFlightSurface(level);

  if (active.size === 0) {
    errors.push("empty active cell set");
    return errors;
  }

  if (!verifyFullGridFill(level)) {
    errors.push("grid fill invalid");
  }
  const solvable =
    level.arrows.length > 28
      ? verifyGreedyClearBoard(level)
      : isLevelSolvable(level);
  if (!solvable) {
    errors.push("not solvable");
  }
  if (n >= 2 && !levelHasBlockedStarts(level)) {
    errors.push("all arrows escapable at start");
  }

  for (let i = 0; i < n; i++) {
    const def = level.arrows[i];
    if (!arrowExitDirectionValid(def.cells, def.direction)) {
      errors.push(`arrow ${i}: tip points into own body`);
    }
    const canEsc = canArrowEscapeNow(
      def,
      level.arrows,
      i,
      present,
      active,
      level
    );

    const occ = occupancyFromIndices(level.arrows, present, i);
    const isOccupied = (r: number, c: number) => occ.has(cellKey(r, c));
    const { escapeExtra, travelLimit } = gameFlightParams(level, def);
    const flight = simulateSnakeFlight(
      def.cells.map((c) => ({ ...c })),
      def.direction,
      surface.isPlayable,
      isOccupied,
      escapeExtra,
      travelLimit,
      {
        inBounds: surface.inBounds,
        blockInteriorVoids: surface.blockInteriorVoids,
      }
    );

    if (canEsc !== (flight.result === "escape")) {
      errors.push(`arrow ${i}: flight mismatch`);
    }

    if (flight.result === "escape" && surface.blockInteriorVoids) {
      let current = def.cells.map((c) => ({ ...c }));
      for (let step = 0; step < travelLimit + def.cells.length + 8; step++) {
        const next = snakeStep(current, def.direction);
        for (const { row, col } of next) {
          if (surface.inBounds(row, col) && !surface.isPlayable(row, col)) {
            errors.push(`arrow ${i}: escapes through shape hole`);
            break;
          }
        }
        if (errors.some((e) => e.startsWith(`arrow ${i}:`))) break;
        if (next.every(({ row, col }) => !surface.isPlayable(row, col))) break;
        current = next;
      }
    }
  }

  return errors;
}

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
