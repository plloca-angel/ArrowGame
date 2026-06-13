import Svg, { Path, Polygon } from "react-native-svg";
import { Direction, GridCell, DIR_VEC } from "../levels";

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

export function getNeonTrace(index: number): NeonTrace {
  return NEON_TRACES[Math.abs(index) % NEON_TRACES.length];
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
  boardPad: number
): ArrowGeometry {
  const stroke = Math.max(3, cellSize * 0.13);
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

type Props = {
  cells: GridCell[];
  direction: Direction;
  cellSize: number;
  boardPad: number;
  color: string;
  glow: string;
  dimmed?: boolean;
};

export function NeonPathArrow({
  cells,
  direction,
  cellSize,
  boardPad,
  color,
  glow,
  dimmed,
}: Props) {
  const g = computeArrowGeometry(cells, direction, cellSize, boardPad);
  const headPts = arrowHeadFromStub(g.neckX, g.neckY, g.tipX, g.tipY, g.headSize);
  const opacity = dimmed ? 0.35 : 1;
  const { left, top, width, height } = g.bounds;

  return (
    <Svg width={width} height={height} viewBox={`${left} ${top} ${width} ${height}`}>
      <Path
        d={g.pathD}
        fill="none"
        stroke={glow}
        strokeWidth={g.outerGlow}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.22 * opacity}
      />
      <Path
        d={g.pathD}
        fill="none"
        stroke={glow}
        strokeWidth={g.glowStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.45 * opacity}
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
      <Polygon
        points={arrowHeadFromStub(g.neckX, g.neckY, g.tipX, g.tipY, g.headSize * 1.15)}
        fill={glow}
        opacity={0.28 * opacity}
      />
    </Svg>
  );
}
