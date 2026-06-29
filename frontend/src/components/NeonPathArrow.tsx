import { memo } from "react";
import Svg, { Path, Polygon } from "react-native-svg";
import { Direction, GridCell } from "../levelModel";
import {
  arrowHeadFromStub,
  buildSlideAnimation,
  computeArrowGeometry,
  cellCenterAbs,
  pathHitBox,
  type ArrowGeometry,
  type SlideAnimFrame,
  type SlideAnimationData,
} from "../arrowGeometry";

export type { ArrowGeometry, SlideAnimFrame, SlideAnimationData };
export {
  cellCenterAbs,
  computeArrowGeometry,
  pathHitBox,
  buildSlideAnimation,
};

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

type Props = {
  cells: GridCell[];
  direction: Direction;
  cellSize: number;
  boardPad: number;
  color: string;
  glow: string;
  dimmed?: boolean;
  largeArrows?: boolean;
  canvasSize?: { width: number; height: number };
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

export const NeonPathArrow = memo(NeonPathArrowBase);
