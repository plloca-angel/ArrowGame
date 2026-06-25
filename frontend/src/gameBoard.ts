import { simulateSnakeFlight, SnakeFlightResult } from "./arrowMotion";
import {
  ArrowDef,
  GridCell,
  Level,
  cellKey,
  getLevelActiveCellSet,
  getLevelFlightSurface,
} from "./levelModel";

export type LiveArrow = {
  id: string;
  cells: GridCell[];
  direction: ArrowDef["direction"];
  status: "idle" | "flying" | "escaped" | "broken";
};

export function arrowIndexFromId(id: string): number | null {
  const suffix = id.split("-").pop();
  const idx = Number(suffix);
  return Number.isFinite(idx) ? idx : null;
}

/** Idle arrows occupy their logical grid cells. Flying/escaped arrows do not block. */
export function buildOccupancy(
  arrows: LiveArrow[],
  excludeId?: string
): Set<string> {
  const occ = new Set<string>();
  for (const a of arrows) {
    if (a.id === excludeId || a.status !== "idle") continue;
    for (const c of a.cells) {
      occ.add(cellKey(Math.round(c.row), Math.round(c.col)));
    }
  }
  return occ;
}

export function computeLiveFlight(
  arrow: LiveArrow,
  arrows: LiveArrow[],
  level: Level
): SnakeFlightResult {
  const surface = getLevelFlightSurface(level);
  if (surface.blockInteriorVoids && getLevelActiveCellSet(level).size === 0) {
    return { result: "blocked" };
  }

  const occupancy = buildOccupancy(arrows, arrow.id);
  const isOccupied = (r: number, c: number) =>
    occupancy.has(cellKey(r, c));
  const escapeExtra = Math.max(2, Math.ceil(arrow.cells.length * 0.75));

  return simulateSnakeFlight(
    arrow.cells.map((c) => ({
      row: Math.round(c.row),
      col: Math.round(c.col),
    })),
    arrow.direction,
    surface.isPlayable,
    isOccupied,
    escapeExtra,
    level.rows + level.cols,
    {
      inBounds: surface.inBounds,
      blockInteriorVoids: surface.blockInteriorVoids,
    }
  );
}

export function canLiveArrowEscape(
  arrow: LiveArrow,
  arrows: LiveArrow[],
  level: Level
): boolean {
  return computeLiveFlight(arrow, arrows, level).result === "escape";
}

export function toLiveArrow(state: {
  id: string;
  cells: GridCell[];
  direction: ArrowDef["direction"];
  status: LiveArrow["status"];
}): LiveArrow {
  return {
    id: state.id,
    cells: state.cells.map((c) => ({
      row: Math.round(c.row),
      col: Math.round(c.col),
    })),
    direction: state.direction,
    status: state.status,
  };
}
