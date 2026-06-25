import { Direction, DIR_VEC, GridCell } from "./levelModel";

/** One step: head advances in exit direction, body follows along the path. */
export function snakeStep(cells: GridCell[], direction: Direction): GridCell[] {
  const [dr, dc] = DIR_VEC[direction];
  if (cells.length === 1) {
    const h = cells[0];
    return [{ row: h.row + dr, col: h.col + dc }];
  }
  const head = cells[cells.length - 1];
  const newHead = { row: head.row + dr, col: head.col + dc };
  const next: GridCell[] = [];
  for (let i = 0; i < cells.length - 1; i++) {
    next.push({ ...cells[i + 1] });
  }
  next.push(newHead);
  return next;
}

export type SnakeFlightResult =
  | { result: "blocked" }
  | {
      result: "collision";
      steps: number;
      hitRow: number;
      hitCol: number;
      finalCells: GridCell[];
    }
  | { result: "escape"; steps: number; finalCells: GridCell[] };

export type SnakeFlightOptions = {
  inBounds?: (r: number, c: number) => boolean;
  /** When true, in-bounds but non-playable cells block (shape holes). */
  blockInteriorVoids?: boolean;
};

export function simulateSnakeFlight(
  startCells: GridCell[],
  direction: Direction,
  isPlayable: (r: number, c: number) => boolean,
  isOccupied: (r: number, c: number) => boolean,
  escapeExtra = 2,
  travelLimit = 96,
  options?: SnakeFlightOptions
): SnakeFlightResult {
  const inBounds = options?.inBounds ?? (() => true);
  const blockInteriorVoids = options?.blockInteriorVoids ?? false;
  let current = startCells.map((c) => ({ ...c }));
  let stepCount = 0;
  const maxSteps = travelLimit + startCells.length + escapeExtra + 32;

  while (stepCount < maxSteps) {
    const next = snakeStep(current, direction);

    for (const { row, col } of next) {
      if (blockInteriorVoids && inBounds(row, col) && !isPlayable(row, col)) {
        if (stepCount === 0) return { result: "blocked" };
        return {
          result: "collision",
          steps: stepCount,
          hitRow: row,
          hitCol: col,
          finalCells: current,
        };
      }
      if (isPlayable(row, col) && isOccupied(row, col)) {
        if (stepCount === 0) return { result: "blocked" };
        return {
          result: "collision",
          steps: stepCount,
          hitRow: row,
          hitCol: col,
          finalCells: current,
        };
      }
    }

    const allOut = next.every(({ row, col }) => !isPlayable(row, col));
    if (allOut) {
      return {
        result: "escape",
        steps: stepCount + 1 + escapeExtra,
        finalCells: next,
      };
    }

    stepCount++;
    current = next;
  }

  return {
    result: "blocked",
  };
}

/** Replay snake steps for animation (includes extra steps after leaving board). */
export function buildSnakeStepSequence(
  startCells: GridCell[],
  direction: Direction,
  totalSteps: number
): GridCell[][] {
  const sequence: GridCell[][] = [];
  let current = startCells.map((c) => ({ ...c }));
  for (let i = 0; i < totalSteps; i++) {
    current = snakeStep(current, direction);
    sequence.push(current.map((c) => ({ ...c })));
  }
  return sequence;
}

/** Head positions over time — used to sample smooth snake motion along bends. */
export function buildMovementTrack(
  startCells: GridCell[],
  direction: Direction,
  totalSteps: number
): GridCell[] {
  const track = startCells.map((c) => ({ ...c }));
  let current = startCells.map((c) => ({ ...c }));
  for (let i = 0; i < totalSteps; i++) {
    current = snakeStep(current, direction);
    track.push({ ...current[current.length - 1] });
  }
  return track;
}

export function sampleTrack(track: GridCell[], dist: number): GridCell {
  if (track.length === 0) return { row: 0, col: 0 };
  if (dist <= 0) return { ...track[0] };

  const maxIdx = track.length - 1;
  if (dist >= maxIdx) {
    const last = track[maxIdx];
    const prev = track[maxIdx - 1] ?? last;
    const extra = dist - maxIdx;
    return {
      row: last.row + (last.row - prev.row) * extra,
      col: last.col + (last.col - prev.col) * extra,
    };
  }

  const d0 = Math.floor(dist);
  const frac = dist - d0;
  const a = track[d0];
  const b = track[d0 + 1];
  return {
    row: a.row + (b.row - a.row) * frac,
    col: a.col + (b.col - a.col) * frac,
  };
}

/**
 * Visible snake polyline that stays on the original orthogonal path while sliding.
 * Avoids diagonal corner cuts from per-segment lerp during escape.
 */
export function extractSnakePolyline(
  track: GridCell[],
  progress: number,
  segmentCount: number
): GridCell[] {
  if (segmentCount <= 0) return [];
  const end = progress + segmentCount - 1;
  const points: GridCell[] = [sampleTrack(track, progress)];

  const firstInt = Math.floor(progress) + 1;
  for (let d = firstInt; d <= Math.floor(end) && d < track.length; d++) {
    if (d > progress + 1e-6) {
      const p = { ...track[d] };
      const prev = points[points.length - 1];
      if (
        Math.abs(prev.row - p.row) > 1e-4 ||
        Math.abs(prev.col - p.col) > 1e-4
      ) {
        points.push(p);
      }
    }
  }

  const endPt = sampleTrack(track, end);
  const last = points[points.length - 1];
  if (
    Math.abs(last.row - endPt.row) > 1e-4 ||
    Math.abs(last.col - endPt.col) > 1e-4
  ) {
    points.push(endPt);
  }

  return points;
}
