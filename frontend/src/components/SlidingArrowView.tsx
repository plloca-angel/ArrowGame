import { useLayoutEffect, useRef } from "react";
import { Platform, View, StyleSheet } from "react-native";
import Svg, { Path, Polygon } from "react-native-svg";
import type { SlideAnimationData } from "./NeonPathArrow";

type Props = {
  animation: SlideAnimationData;
  color: string;
  glow: string;
  durationMs: number;
  motionToken: number;
  getMotionToken: () => number;
  onFrame: (frameIndex: number) => void;
  onComplete: () => void;
};

/**
 * Plays a pre-baked slide by pushing path updates straight to native SVG nodes.
 * React never re-renders during playback — only setNativeProps runs each frame.
 */
export function SlidingArrowView({
  animation,
  color,
  glow,
  durationMs,
  motionToken,
  getMotionToken,
  onFrame,
  onComplete,
}: Props) {
  const glowPathRef = useRef<Path>(null);
  const shaftPathRef = useRef<Path>(null);
  const headRef = useRef<Polygon>(null);
  const onFrameRef = useRef(onFrame);
  const onCompleteRef = useRef(onComplete);
  onFrameRef.current = onFrame;
  onCompleteRef.current = onComplete;

  const { frames, viewport, stroke, glowStroke } = animation;
  const { left, top, width, height } = viewport;
  const first = frames[0];

  useLayoutEffect(() => {
    const startedAt = performance.now();
    let raf = 0;
    let cancelled = false;
    let finished = false;
    let lastIdx = -1;

    const finish = () => {
      if (finished) return;
      finished = true;
      onCompleteRef.current();
    };

    const applyFrame = (idx: number) => {
      if (idx === lastIdx) return;
      lastIdx = idx;
      const f = frames[idx];
      glowPathRef.current?.setNativeProps({ d: f.pathD });
      shaftPathRef.current?.setNativeProps({ d: f.pathD });
      headRef.current?.setNativeProps({ points: f.headPts });
      onFrameRef.current(idx);
    };

    applyFrame(0);

    const tick = (now: number) => {
      if (cancelled) return;
      if (getMotionToken() !== motionToken) {
        cancelled = true;
        return;
      }

      const elapsed = now - startedAt;
      const linearT = Math.min(1, elapsed / Math.max(1, durationMs));
      const idx =
        frames.length <= 1
          ? 0
          : Math.min(
              frames.length - 1,
              Math.floor(linearT * (frames.length - 1))
            );

      applyFrame(idx);

      if (linearT < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        finish();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (!finished) {
        finish();
      }
    };
  }, [frames, durationMs, motionToken, getMotionToken]);

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      style={[
        styles.wrap,
        { left, top, width, height },
      ]}
    >
      <Svg
        width={width}
        height={height}
        viewBox={`${left} ${top} ${width} ${height}`}
      >
        <Path
          ref={glowPathRef}
          d={first.pathD}
          fill="none"
          stroke={glow}
          strokeWidth={glowStroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.35}
        />
        <Path
          ref={shaftPathRef}
          d={first.pathD}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Polygon ref={headRef} points={first.headPts} fill={color} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    zIndex: 8,
    ...(Platform.OS === "android" ? { elevation: 0 } : {}),
  },
});
