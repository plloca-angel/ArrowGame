import Svg, { Path, Polygon } from "react-native-svg";
import { Direction } from "../levels";

export type NeonTrace = { color: string; glow: string };

/** Circuit-board neon palette matching reference art. */
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

type PathDef = { d: string; head: [number, number, number] };

/** Winding trace + arrowhead tip (x,y) and facing angle (deg). */
function getPathDef(direction: Direction, variant: number): PathDef {
  const v = variant % 4;
  switch (direction) {
    case "right":
      if (v === 0) return { d: "M 8 58 L 8 42 L 38 42 L 38 28 L 62 28", head: [72, 28, 0] };
      if (v === 1) return { d: "M 8 72 L 8 38 L 48 38", head: [58, 38, 0] };
      if (v === 2) return { d: "M 8 50 L 36 50 L 36 66 L 58 66", head: [68, 66, 0] };
      return { d: "M 8 32 L 8 50 L 52 50", head: [62, 50, 0] };
    case "left":
      if (v === 0) return { d: "M 92 42 L 92 58 L 62 58 L 62 72 L 38 72", head: [28, 72, 180] };
      if (v === 1) return { d: "M 92 62 L 92 38 L 52 38", head: [42, 38, 180] };
      if (v === 2) return { d: "M 92 50 L 64 50 L 64 34 L 42 34", head: [32, 34, 180] };
      return { d: "M 92 68 L 92 50 L 48 50", head: [38, 50, 180] };
    case "up":
      if (v === 0) return { d: "M 58 92 L 42 92 L 42 62 L 28 62 L 28 38", head: [28, 28, -90] };
      if (v === 1) return { d: "M 72 92 L 38 92 L 38 52", head: [38, 42, -90] };
      if (v === 2) return { d: "M 50 92 L 50 64 L 66 64 L 66 42", head: [66, 32, -90] };
      return { d: "M 32 92 L 50 92 L 50 48", head: [50, 38, -90] };
    case "down":
      if (v === 0) return { d: "M 42 8 L 58 8 L 58 38 L 72 38 L 72 62", head: [72, 72, 90] };
      if (v === 1) return { d: "M 38 8 L 62 8 L 62 48", head: [62, 58, 90] };
      if (v === 2) return { d: "M 50 8 L 50 36 L 34 36 L 34 58", head: [34, 68, 90] };
      return { d: "M 68 8 L 50 8 L 50 52", head: [50, 62, 90] };
  }
}

function arrowHeadPoints(tipX: number, tipY: number, angleDeg: number, size: number) {
  const rad = (angleDeg * Math.PI) / 180;
  const bx = tipX - Math.cos(rad) * size;
  const by = tipY - Math.sin(rad) * size;
  const wing = size * 0.55;
  const lx = bx + Math.cos(rad + Math.PI / 2) * wing;
  const ly = by + Math.sin(rad + Math.PI / 2) * wing;
  const rx = bx + Math.cos(rad - Math.PI / 2) * wing;
  const ry = by + Math.sin(rad - Math.PI / 2) * wing;
  return `${tipX},${tipY} ${lx},${ly} ${rx},${ry}`;
}

type Props = {
  direction: Direction;
  variant: number;
  size: number;
  color: string;
  glow: string;
  dimmed?: boolean;
};

export function NeonArrow({ direction, variant, size, color, glow, dimmed }: Props) {
  const { d, head } = getPathDef(direction, variant);
  const headSize = size * 0.11;
  const stroke = size * 0.085;
  const glowStroke = stroke * 2.4;
  const outerGlow = stroke * 3.6;
  const headPts = arrowHeadPoints(head[0], head[1], head[2], headSize);
  const opacity = dimmed ? 0.35 : 1;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path
        d={d}
        fill="none"
        stroke={glow}
        strokeWidth={outerGlow}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.22 * opacity}
      />
      <Path
        d={d}
        fill="none"
        stroke={glow}
        strokeWidth={glowStroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.45 * opacity}
      />
      <Path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={opacity}
      />
      <Polygon points={headPts} fill={color} opacity={opacity} />
      <Polygon
        points={arrowHeadPoints(head[0], head[1], head[2], headSize * 1.3)}
        fill={glow}
        opacity={0.3 * opacity}
      />
    </Svg>
  );
}
