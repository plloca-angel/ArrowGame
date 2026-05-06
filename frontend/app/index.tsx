import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { COLORS, RADIUS, SPACING } from "../src/theme";
import { loadProgress, Progress } from "../src/storage";
import { LEVELS } from "../src/levels";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState<Progress | null>(null);
  const glow = useState(new Animated.Value(0))[0];

  useFocusEffect(
    useCallback(() => {
      loadProgress().then(setProgress);
    }, [])
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [glow]);

  const completedCount = progress
    ? Object.keys(progress.completed).length
    : 0;
  const nextLevel = progress?.highestUnlocked ?? 1;

  const onPlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.push({ pathname: "/game", params: { level: String(nextLevel) } });
  };

  const onLevels = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push("/levels");
  };

  const titleShadow = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 28],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.xl }]}>
      {/* Decorative neon arrows */}
      <View style={styles.deco} pointerEvents="none">
        <Text style={[styles.decoArrow, styles.decoCyan, { top: 80, left: 30 }]}>
          ▶
        </Text>
        <Text
          style={[styles.decoArrow, styles.decoMagenta, { top: 160, right: 40 }]}
        >
          ◀
        </Text>
        <Text
          style={[styles.decoArrow, styles.decoCyan, { bottom: 240, left: 50 }]}
        >
          ▲
        </Text>
        <Text
          style={[
            styles.decoArrow,
            styles.decoMagenta,
            { bottom: 180, right: 60 },
          ]}
        >
          ▼
        </Text>
      </View>

      <View style={styles.titleWrap}>
        <Text style={styles.eyebrow}>NEON · PUZZLE</Text>
        <Animated.Text
          testID="home-title"
          style={[
            styles.title,
            {
              textShadowRadius: titleShadow,
            },
          ]}
        >
          ARROW
        </Animated.Text>
        <Animated.Text
          style={[
            styles.titleAlt,
            {
              textShadowRadius: titleShadow,
            },
          ]}
        >
          ESCAPE
        </Animated.Text>
        <Text style={styles.tagline}>
          Release every arrow. Don&apos;t let paths cross.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum} testID="stat-completed">
            {completedCount}
          </Text>
          <Text style={styles.statLabel}>Solved</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: COLORS.magenta }]}>
            {LEVELS.length}+
          </Text>
          <Text style={styles.statLabel}>Levels</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNum, { color: COLORS.yellow }]}>
            {progress
              ? Object.values(progress.completed).reduce(
                  (s, c) => s + c.stars,
                  0
                )
              : 0}
          </Text>
          <Text style={styles.statLabel}>Stars</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          testID="home-play-btn"
          onPress={onPlay}
          style={({ pressed }) => [
            styles.playBtn,
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.playLabel}>
            {completedCount === 0 ? "PLAY" : `CONTINUE · LV ${nextLevel}`}
          </Text>
        </Pressable>

        <Pressable
          testID="home-levels-btn"
          onPress={onLevels}
          style={({ pressed }) => [
            styles.secondaryBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.secondaryLabel}>LEVEL SELECT</Text>
        </Pressable>
      </View>

      <Text style={[styles.footer, { marginBottom: insets.bottom + SPACING.md }]}>
        Tap an arrow → it flies in its direction. Clear the board.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.lg,
    justifyContent: "space-between",
  },
  deco: { ...StyleSheet.absoluteFillObject },
  decoArrow: {
    position: "absolute",
    fontSize: 72,
    opacity: 0.08,
  },
  decoCyan: { color: COLORS.cyan },
  decoMagenta: { color: COLORS.magenta },
  titleWrap: { marginTop: SPACING.xl, alignItems: "flex-start" },
  eyebrow: {
    color: COLORS.cyan,
    letterSpacing: 6,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: SPACING.sm,
  },
  title: {
    color: COLORS.text,
    fontSize: 72,
    fontWeight: "900",
    letterSpacing: 4,
    textShadowColor: COLORS.cyanGlow,
    textShadowOffset: { width: 0, height: 0 },
    lineHeight: 76,
  },
  titleAlt: {
    color: COLORS.magenta,
    fontSize: 72,
    fontWeight: "900",
    letterSpacing: 4,
    textShadowColor: COLORS.magentaGlow,
    textShadowOffset: { width: 0, height: 0 },
    lineHeight: 76,
  },
  tagline: {
    color: COLORS.textDim,
    fontSize: 14,
    marginTop: SPACING.md,
    maxWidth: 280,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginVertical: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statNum: {
    color: COLORS.cyan,
    fontSize: 28,
    fontWeight: "800",
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 2,
    textTransform: "uppercase",
  },
  actions: { gap: SPACING.md, marginBottom: SPACING.lg },
  playBtn: {
    backgroundColor: COLORS.cyan,
    borderRadius: RADIUS.lg,
    paddingVertical: 22,
    alignItems: "center",
    shadowColor: COLORS.cyan,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  playLabel: {
    color: "#02141a",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 3,
  },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: COLORS.magenta,
    borderRadius: RADIUS.lg,
    paddingVertical: 18,
    alignItems: "center",
  },
  secondaryLabel: {
    color: COLORS.magenta,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 3,
  },
  footer: {
    color: COLORS.textMuted,
    textAlign: "center",
    fontSize: 12,
    letterSpacing: 1,
  },
});
