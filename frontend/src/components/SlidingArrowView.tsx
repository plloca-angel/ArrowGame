import { useEffect, useRef } from "react";
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

  useEffect(() => {
    const startedAt = performance.now();
    let raf = 0;
    let done = false;
    let lastIdx = -1;

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
      if (done) return;
      if (getMotionToken() !== motionToken) {
        done = true;
        cancelAnimationFrame(raf);
        return;
      }

      const elapsed = now - startedAt;
      const t = Math.min(1, elapsed / durationMs);
      const idx =
        frames.length <= 1
          ? 0
          : Math.min(frames.length - 1, Math.round(t * (frames.length - 1)));

      applyFrame(idx);

      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        done = true;
        onCompleteRef.current();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      done = true;
      cancelAnimationFrame(raf);
    };
  }, [frames, durationMs, motionToken, getMotionToken]);

  return (
    <View
      pointerEvents="none"
      collapsable={false}
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
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
    ...(Platform.OS === "android"
      ? { elevation: 8 }
      : { zIndex: 8 }),
  },
});
