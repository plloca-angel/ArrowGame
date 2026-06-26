import { useMemo } from "react";
import { Direction, GridCell } from "../levelModel";
import {
  buildSlideAnimation,
  getNeonTrace,
} from "./NeonPathArrow";
import { SlidingArrowView } from "./SlidingArrowView";

export type SlideSpec = {
  id: string;
  startCells: GridCell[];
  direction: Direction;
  track: GridCell[];
  totalSteps: number;
  segmentCount: number;
  colorIndex: number;
  stepDurationMs: number;
  /** Frozen at slide start — must not change mid-animation. */
  cellSize: number;
  boardPad: number;
  largeArrows: boolean;
};

type Props = {
  spec: SlideSpec;
  colorBlindSafe: boolean;
  motionToken: number;
  getMotionToken: () => number;
  onFrame: (
    id: string,
    visualCells: GridCell[],
    logicalCells: GridCell[]
  ) => void;
  onComplete: (
    id: string,
    finalCells: GridCell[],
    finalVisual: GridCell[]
  ) => void;
};

/**
 * Drives one arrow slide: pre-bakes every frame once, then plays back via
 * native SVG updates (no React re-renders during the glide).
 */
export function MovingArrowSprite({
  spec,
  colorBlindSafe,
  motionToken,
  getMotionToken,
  onFrame,
  onComplete,
}: Props) {
  const animation = useMemo(
    () =>
      buildSlideAnimation(
        spec.startCells,
        spec.direction,
        spec.track,
        spec.totalSteps,
        spec.segmentCount,
        spec.cellSize,
        spec.boardPad,
        spec.largeArrows
      ),
    [spec]
  );

  const trace = getNeonTrace(spec.colorIndex, colorBlindSafe);
  const durationMs = spec.stepDurationMs * spec.totalSteps;
  const { frames } = animation;

  return (
    <SlidingArrowView
      animation={animation}
      color={trace.color}
      glow={trace.glow}
      durationMs={durationMs}
      motionToken={motionToken}
      getMotionToken={getMotionToken}
      onFrame={(idx) => {
        const f = frames[idx];
        onFrame(spec.id, f.visual, f.logical);
      }}
      onComplete={() => {
        const last = frames[frames.length - 1];
        onComplete(
          spec.id,
          last.logical.map((c) => ({ ...c })),
          last.visual.map((c) => ({ ...c }))
        );
      }}
    />
  );
}
