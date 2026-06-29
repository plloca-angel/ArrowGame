import { Direction, GridCell, DIR_VEC } from "./levelModel";
import {
  buildSnakeStepSequence,
  extractSnakePolyline,
} from "./arrowMotion";

/** Grid cell center in canvas pixels (locked to grid lines). */
export function cellCenterAbs(
  cell: GridCell,
  cellSize: number,
  boardPad: number
) {
  return {
    x: boardPad + cell.col * cellSize + cellSize / 2,
    y: boardPad + cell.row * cellSize + cellSize / 2,
  };
}

export function arrowHeadFromStub(
  neckX: number,
  neckY: number,
  tipX: number,
  tipY: number,
  halfWidth: number
) {
  const dx = tipX - neckX;
  const dy = tipY - neckY;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * halfWidth;
  const py = (dx / len) * halfWidth;
  return `${tipX.toFixed(1)},${tipY.toFixed(1)} ${(neckX + px).toFixed(1)},${(neckY + py).toFixed(1)} ${(neckX - px).toFixed(1)},${(neckY - py).toFixed(1)}`;
}

export type ArrowGeometry = {
  pathD: string;
  neckX: number;
  neckY: number;
  tipX: number;
  tipY: number;
  stroke: number;
  glowStroke: number;
  outerGlow: number;
  headSize: number;
  bounds: { left: number; top: number; width: number; height: number };
};

export function computeArrowGeometry(
  cells: GridCell[],
  direction: Direction,
  cellSize: number,
  boardPad: number,
  strokeScale = 1
): ArrowGeometry {
  const stroke = Math.max(3, cellSize * 0.13 * strokeScale);
  const glowStroke = stroke * 2.2;
  const outerGlow = stroke * 3.6;
  const margin = outerGlow / 2 + cellSize * 0.3 + 6;

  const centers = cells.map((c) => cellCenterAbs(c, cellSize, boardPad));
  const head = cells[cells.length - 1];
  const { x: hx, y: hy } = cellCenterAbs(head, cellSize, boardPad);
  const [dr, dc] = DIR_VEC[direction];
  const isSingle = cells.length === 1;

  const stubLen = cellSize * (isSingle ? 0.3 : 0.4);
  let tipX = hx + dc * stubLen;
  let tipY = hy + dr * stubLen;
  const headHalf = stroke * 0.9;
  let headDepth = stubLen * 0.72;
  let neckX = tipX - dc * headDepth;
  let neckY = tipY - dr * headDepth;
  let shaftEndX = neckX - dc * stroke * 0.35;
  let shaftEndY = neckY - dr * stroke * 0.35;

  let pathD = "";
  if (centers.length > 0) {
    if (isSingle) {
      const half = stubLen * 0.55;
      const tailX = hx - dc * half;
      const tailY = hy - dr * half;
      tipX = hx + dc * half;
      tipY = hy + dr * half;
      headDepth = half * 0.72;
      neckX = tipX - dc * headDepth;
      neckY = tipY - dr * headDepth;
      shaftEndX = neckX - dc * stroke * 0.35;
      shaftEndY = neckY - dr * stroke * 0.35;
      pathD = `M ${tailX.toFixed(1)} ${tailY.toFixed(1)} L ${shaftEndX.toFixed(1)} ${shaftEndY.toFixed(1)}`;
    } else {
      pathD = centers
        .map(({ x, y }, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
        .join(" ");
      const last = centers[centers.length - 1];
      const atHead =
        Math.abs(last.x - hx) < 0.5 && Math.abs(last.y - hy) < 0.5;
      if (!atHead) {
        pathD += ` L ${hx.toFixed(1)} ${hy.toFixed(1)}`;
      }
      pathD += ` L ${shaftEndX.toFixed(1)} ${shaftEndY.toFixed(1)}`;
    }
  }

  let left: number;
  let top: number;
  let right: number;
  let bottom: number;

  if (isSingle) {
    const cellLeft = boardPad + head.col * cellSize;
    const cellTop = boardPad + head.row * cellSize;
    left = cellLeft - margin;
    top = cellTop - margin;
    right = cellLeft + cellSize + margin;
    bottom = cellTop + cellSize + margin;
  } else {
    const xs = [...centers.map((p) => p.x), tipX, neckX];
    const ys = [...centers.map((p) => p.y), tipY, neckY];
    left = Math.min(...xs) - margin;
    top = Math.min(...ys) - margin;
    right = Math.max(...xs) + margin;
    bottom = Math.max(...ys) + margin;
  }

  return {
    pathD,
    neckX,
    neckY,
    tipX,
    tipY,
    stroke,
    glowStroke,
    outerGlow,
    headSize: headHalf,
    bounds: { left, top, width: right - left, height: bottom - top },
  };
}

export function pathHitBox(
  cells: GridCell[],
  cellSize: number,
  boardPad: number,
  direction: Direction,
  strokeScale = 1
) {
  return computeArrowGeometry(
    cells,
    direction,
    cellSize,
    boardPad,
    strokeScale
  ).bounds;
}

/** One pre-baked frame of a sliding arrow (path strings only — no React work per tick). */
export type SlideAnimFrame = {
  pathD: string;
  headPts: string;
  visual: GridCell[];
  logical: GridCell[];
};

export type SlideAnimationData = {
  frames: SlideAnimFrame[];
  viewport: { left: number; top: number; width: number; height: number };
  stroke: number;
  glowStroke: number;
};

export function buildSlideAnimation(
  startCells: GridCell[],
  direction: Direction,
  track: GridCell[],
  totalSteps: number,
  segmentCount: number,
  cellSize: number,
  boardPad: number,
  largeArrows: boolean
): SlideAnimationData {
  const sequence = buildSnakeStepSequence(startCells, direction, totalSteps);
  const strokeScale = largeArrows ? 1.15 : 1;
  const frameCount = Math.min(480, Math.max(96, Math.ceil(totalSteps * 14)));
  const frames: SlideAnimFrame[] = [];
  let minL = Infinity;
  let minT = Infinity;
  let maxR = -Infinity;
  let maxB = -Infinity;

  for (let i = 0; i < frameCount; i++) {
    const t = frameCount <= 1 ? 1 : i / (frameCount - 1);
    const progress = t * totalSteps;
    const stepIdx = Math.min(Math.floor(progress), sequence.length - 1);
    const logical = (sequence[stepIdx] ?? startCells).map((c) => ({ ...c }));
    const visual = extractSnakePolyline(track, progress, segmentCount);
    const g = computeArrowGeometry(
      visual,
      direction,
      cellSize,
      boardPad,
      strokeScale
    );
    const headPts = arrowHeadFromStub(
      g.neckX,
      g.neckY,
      g.tipX,
      g.tipY,
      g.headSize
    );
    frames.push({
      pathD: g.pathD,
      headPts,
      visual: visual.map((c) => ({ ...c })),
      logical,
    });
    minL = Math.min(minL, g.bounds.left);
    minT = Math.min(minT, g.bounds.top);
    maxR = Math.max(maxR, g.bounds.left + g.bounds.width);
    maxB = Math.max(maxB, g.bounds.top + g.bounds.height);
  }

  const stroke = Math.max(3, cellSize * 0.13 * strokeScale);
  return {
    frames,
    viewport: {
      left: minL,
      top: minT,
      width: Math.max(1, maxR - minL),
      height: Math.max(1, maxB - minT),
    },
    stroke,
    glowStroke: stroke * 2.2,
  };
}
