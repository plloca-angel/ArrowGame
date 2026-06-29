import { memo } from "react";
import Svg, { Path, Polygon } from "react-native-svg";
import { Direction, GridCell, DIR_VEC } from "../levels";
import {
  buildSnakeStepSequence,
  extractSnakePolyline,
} from "../arrowMotion";

export type NeonTrace = { color: string; glow: string };

export const NEON_TRACES: NeonTrace[] = [
  { color: "#ff3355", glow: "rgba(255, 51, 85, 0.55)" },
  { color: "#ff7722", glow: "rgba(255, 119, 34, 0.55)" },
  { color: "#ffdd22", glow: "rgba(255, 221, 34, 0.5)" },
  { color: "#88ff33", glow: "rgba(136, 255, 51, 0.5)" },
  { color: "#22ffbb", glow: "rgba(34, 255, 187, 0.5)" },
  { color: "#22aaff", glow: "rgba(34, 170, 255, 0.5)" },
  { color: "#ff44dd", glow: "rgba(255, 68, 221, 0.5)" },
];

export const COLOR_BLIND_TRACES: NeonTrace[] = [
  { color: "#ffffff", glow: "rgba(255, 255, 255, 0.55)" },
  { color: "#ffb000", glow: "rgba(255, 176, 0, 0.55)" },
  { color: "#4da3ff", glow: "rgba(77, 163, 255, 0.55)" },
  { color: "#e8e8e8", glow: "rgba(232, 232, 232, 0.5)" },
  { color: "#ff8c00", glow: "rgba(255, 140, 0, 0.5)" },
  { color: "#7ec8ff", glow: "rgba(126, 200, 255, 0.5)" },
  { color: "#ffd966", glow: "rgba(255, 217, 102, 0.5)" },
];

export function getNeonTrace(index: number, colorBlindSafe = false): NeonTrace {
  const palette = colorBlindSafe ? COLOR_BLIND_TRACES : NEON_TRACES;
  return palette[Math.abs(index) % palette.length];
}

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

function arrowHeadFromStub(
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

  const stubLen = cellSize * 0.4;
  const tipX = hx + dc * stubLen;
  const tipY = hy + dr * stubLen;
  const headHalf = stroke * 0.9;
  const headDepth = stubLen * 0.72;
  const neckX = tipX - dc * headDepth;
  const neckY = tipY - dr * headDepth;
  // Stop shaft before arrowhead so round caps don't bleed past the tip.
  const shaftEndX = neckX - dc * stroke * 0.35;
  const shaftEndY = neckY - dr * stroke * 0.35;

  let pathD = "";
  if (centers.length > 0) {
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

  const xs = [...centers.map((p) => p.x), tipX, neckX];
  const ys = [...centers.map((p) => p.y), tipY, neckY];
  const left = Math.min(...xs) - margin;
  const top = Math.min(...ys) - margin;
  const right = Math.max(...xs) + margin;
  const bottom = Math.max(...ys) + margin;

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
  direction: Direction
) {
  return computeArrowGeometry(cells, direction, cellSize, boardPad).bounds;
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

/**
 * Pre-computes every visual frame of a slide up front. During playback the
 * animation loop only looks up path strings and pushes them to native via
 * setNativeProps — zero React re-renders and zero geometry math per frame.
 */
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
  const sequence = buildSnakeStepSequence(
    startCells,
    direction,
    totalSteps
  );
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

type Props = {
  cells: GridCell[];
  direction: Direction;
  cellSize: number;
  boardPad: number;
  color: string;
  glow: string;
  dimmed?: boolean;
  largeArrows?: boolean;
  /** Fixed board canvas — skips per-frame hit-box cropping during slides. */
  canvasSize?: { width: number; height: number };
  /** Lighter SVG (fewer glow layers) while the arrow is moving. */
  motionLite?: boolean;
};

function NeonPathArrowBase({
  cells,
  direction,
  cellSize,
  boardPad,
  color,
  glow,
  dimmed,
  largeArrows = false,
  canvasSize,
  motionLite = false,
}: Props) {
  const g = computeArrowGeometry(
    cells,
    direction,
    cellSize,
    boardPad,
    largeArrows ? 1.15 : 1
  );
  const headPts = arrowHeadFromStub(g.neckX, g.neckY, g.tipX, g.tipY, g.headSize);
  const opacity = dimmed ? 0.35 : 1;
  const { left, top, width, height } = g.bounds;
  const svgW = canvasSize?.width ?? width;
  const svgH = canvasSize?.height ?? height;
  const viewBox = canvasSize
    ? `0 0 ${canvasSize.width} ${canvasSize.height}`
    : `${left} ${top} ${width} ${height}`;

  return (
    <Svg width={svgW} height={svgH} viewBox={viewBox}>
      {!motionLite && (
        <Path
          d={g.pathD}
          fill="none"
          stroke={glow}
          strokeWidth={g.outerGlow}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.22 * opacity}
        />
      )}
      <Path
        d={g.pathD}
        fill="none"
        stroke={glow}
        strokeWidth={g.glowStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={(motionLite ? 0.35 : 0.45) * opacity}
      />
      <Path
        d={g.pathD}
        fill="none"
        stroke={color}
        strokeWidth={g.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
      <Polygon points={headPts} fill={color} opacity={opacity} />
      {!motionLite && (
        <Polygon
          points={arrowHeadFromStub(
            g.neckX,
            g.neckY,
            g.tipX,
            g.tipY,
            g.headSize * 1.15
          )}
          fill={glow}
          opacity={0.28 * opacity}
        />
      )}
    </Svg>
  );
}

/**
 * Memoized so stationary arrows don't re-render the SVG on every animation
 * frame — only the arrow whose cells/props actually change repaints. This keeps
 * arrow releases smooth even on larger boards with many arrows.
 */
export const NeonPathArrow = memo(NeonPathArrowBase);
