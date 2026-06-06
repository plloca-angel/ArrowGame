import { memo } from "react";
import Svg, { Path, Defs, Filter, FeGaussianBlur, FeMerge, FeMergeNode } from "react-native-svg";
import { Direction } from "./levels";

type Props = {
  direction: Direction;
  size: number;
  color: string;
  glowColor?: string;
  strokeWidth?: number;
};

// Renders a thick hollow neon arrow with rounded line caps and a soft glow,
// matching the look in the reference screenshot.
// The path is drawn for "right" and rotated via the viewBox transform.
const ROT: Record<Direction, number> = {
  right: 0,
  down: 90,
  left: 180,
  up: 270,
};

const NeonArrow = memo(function NeonArrow({
  direction,
  size,
  color,
  glowColor,
  strokeWidth = 8,
}: Props) {
  // viewBox 64x64. Body runs from (8,32) to (44,32). Arrowhead from (38,18) to (54,32) to (38,46).
  const filterId = `glow-${color.replace("#", "")}`;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      // expo-router types confuse the optional fill prop; rely on stroke only
      fill="none"
    >
      <Defs>
        <Filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <FeGaussianBlur in="SourceGraphic" stdDeviation="2" />
          <FeMerge>
            <FeMergeNode />
            <FeMergeNode in="SourceGraphic" />
          </FeMerge>
        </Filter>
      </Defs>
      {/* Inner stroked arrow, rotated according to direction. The transform is
          applied as a string on the <Path /> rather than a group, for stability. */}
      <Path
        d="M 8 32 L 38 32 M 30 18 L 50 32 L 30 46"
        stroke={glowColor ?? color}
        strokeWidth={strokeWidth + 4}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.45}
        transform={`rotate(${ROT[direction]} 32 32)`}
      />
      <Path
        d="M 8 32 L 38 32 M 30 18 L 50 32 L 30 46"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`rotate(${ROT[direction]} 32 32)`}
      />
    </Svg>
  );
});

export default NeonArrow;
