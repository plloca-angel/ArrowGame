import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../src/SettingsContext";
import { loadProgress, Progress, loadEntitlements, Entitlements } from "../src/storage";
import { RADIUS, SPACING } from "../src/theme";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, haptic, settings } = useSettings();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [ents, setEnts] = useState<Entitlements | null>(null);
  const glow = useState(new Animated.Value(0))[0];

  useFocusEffect(
    useCallback(() => {
      loadProgress().then(setProgress);
      loadEntitlements().then(setEnts);
    }, [])
  );

  useEffect(() => {
    if (settings.reducedMotion) {
      glow.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
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
    );
    loop.start();
    return () => loop.stop();
  }, [glow, settings.reducedMotion]);

  const nextLevel = progress?.currentLevel ?? 1;
  const totalStars = progress?.totalStars ?? 0;
  const completed = progress?.completedCount ?? 0;
  const isFirstPlay = completed === 0;

  const onPlay = () => {
    haptic("medium");
    router.push({ pathname: "/game", params: { level: String(nextLevel) } });
  };

  const titleShadow = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 28],
  });

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: insets.top + SPACING.md },
      ]}
    >
      {/* Decorative neon arrows */}
      <View style={styles.deco} pointerEvents="none">
        <Text
          style={[
            styles.decoArrow,
            { color: colors.cyan, top: 60, left: 20, opacity: 0.06 },
          ]}
        >
          ▶
        </Text>
        <Text
          style={[
            styles.decoArrow,
            { color: colors.magenta, top: 140, right: 30, opacity: 0.07 },
          ]}
        >
          ◀
        </Text>
        <Text
          style={[
            styles.decoArrow,
            { color: colors.cyan, bottom: 280, left: 30, opacity: 0.05 },
          ]}
        >
          ▲
        </Text>
        <Text
          style={[
            styles.decoArrow,
            { color: colors.magenta, bottom: 200, right: 40, opacity: 0.06 },
          ]}
        >
          ▼
        </Text>
      </View>

      {/* Top bar with action icons */}
      <View style={styles.topBar}>
        <View style={styles.brandTag}>
          <View style={[styles.brandDot, { backgroundColor: colors.cyan }]} />
          <Text style={[styles.brandText, { color: colors.textDim }]}>
            ARROW · ESCAPE
          </Text>
        </View>
        <View style={styles.topRight}>
          <Pressable
            testID="home-store-btn"
            onPress={() => {
              haptic("selection");
              router.push("/store");
            }}
            hitSlop={10}
            style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Ionicons name="bag-outline" size={18} color={colors.text} />
          </Pressable>
          <Pressable
            testID="home-settings-btn"
            onPress={() => {
              haptic("selection");
              router.push("/settings");
            }}
            hitSlop={10}
            style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Ionicons name="settings-outline" size={18} color={colors.text} />
          </Pressable>
          <Pressable
            testID="home-accessibility-btn"
            onPress={() => {
              haptic("selection");
              router.push("/accessibility");
            }}
            hitSlop={10}
            style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Ionicons name="accessibility-outline" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + SPACING.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: colors.cyan }]}>
            INFINITE NEON PUZZLE
          </Text>
          <View style={styles.titleStack}>
            <Animated.Text
              testID="home-title"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.title,
                {
                  color: colors.text,
                  textShadowColor: colors.cyanGlow,
                  textShadowRadius: titleShadow,
                },
              ]}
            >
              ARROW
            </Animated.Text>
            <Animated.Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.title,
                {
                  color: colors.magenta,
                  textShadowColor: colors.magentaGlow,
                  textShadowRadius: titleShadow,
                },
              ]}
            >
              ESCAPE
            </Animated.Text>
          </View>
          <Text style={[styles.tagline, { color: colors.textDim }]}>
            Tap arrows in the right order. Clear the grid. Forever.
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatChip
            color={colors.cyan}
            label="Lv reached"
            value={String(nextLevel)}
            border={colors.border}
            bg={colors.surface}
            textDim={colors.textMuted}
            testID="stat-level"
          />
          <StatChip
            color={colors.magenta}
            label="Solved"
            value={String(completed)}
            border={colors.border}
            bg={colors.surface}
            textDim={colors.textMuted}
            testID="stat-completed"
          />
          <StatChip
            color={colors.star}
            label="Stars"
            value={String(totalStars)}
            border={colors.border}
            bg={colors.surface}
            textDim={colors.textMuted}
            testID="stat-stars"
          />
        </View>

        {/* Hints chip */}
        {ents && ents.hintCredits > 0 && (
          <View
            style={[
              styles.hintsChip,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Ionicons name="bulb" size={16} color={colors.yellow} />
            <Text style={[styles.hintsText, { color: colors.text }]}>
              {ents.hintCredits} hint{ents.hintCredits === 1 ? "" : "s"} ready
            </Text>
          </View>
        )}

        {/* Primary CTA */}
        <Pressable
          testID="home-play-btn"
          onPress={onPlay}
          style={({ pressed }) => [
            styles.playBtn,
            {
              backgroundColor: colors.cyan,
              shadowColor: colors.cyan,
            },
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <Text style={styles.playLabel}>
            {isFirstPlay ? "PLAY" : `CONTINUE · LV ${nextLevel}`}
          </Text>
          <Ionicons name="arrow-forward" size={20} color="#02141a" />
        </Pressable>

        {/* Secondary nav */}
        <View style={styles.secondaryRow}>
          <Pressable
            testID="home-store-card"
            onPress={() => {
              haptic("selection");
              router.push("/store");
            }}
            style={({ pressed }) => [
              styles.secondaryCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="bag" size={18} color={colors.magenta} />
            <Text style={[styles.secondaryLabel, { color: colors.text }]}>STORE</Text>
            <Text style={[styles.secondarySub, { color: colors.textMuted }]}>
              Hints · Remove ads
            </Text>
          </Pressable>
          <Pressable
            testID="home-settings-card"
            onPress={() => {
              haptic("selection");
              router.push("/settings");
            }}
            style={({ pressed }) => [
              styles.secondaryCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="settings" size={18} color={colors.cyan} />
            <Text style={[styles.secondaryLabel, { color: colors.text }]}>
              SETTINGS
            </Text>
            <Text style={[styles.secondarySub, { color: colors.textMuted }]}>
              Sound · Theme · Reset
            </Text>
          </Pressable>
        </View>

        {/* Banner ad */}
        <View style={{ marginTop: SPACING.lg }}>
          <AdBanner />
        </View>
      </ScrollView>
    </View>
  );
}

function StatChip({
  color,
  label,
  value,
  bg,
  border,
  textDim,
  testID,
}: {
  color: string;
  label: string;
  value: string;
  bg: string;
  border: string;
  textDim: string;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={[styles.statCard, { backgroundColor: bg, borderColor: border }]}
    >
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: textDim }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SPACING.lg },
  deco: { ...StyleSheet.absoluteFillObject },
  decoArrow: {
    position: "absolute",
    fontSize: 88,
    fontWeight: "900",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  brandTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandDot: { width: 6, height: 6, borderRadius: 3 },
  brandText: {
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: "800",
  },
  topRight: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: { paddingTop: SPACING.md },
  hero: { marginBottom: SPACING.xl },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 4,
    fontWeight: "800",
    marginBottom: SPACING.md,
  },
  titleStack: { gap: -8 },
  title: {
    fontSize: 64,
    fontWeight: "900",
    letterSpacing: 2,
    textShadowOffset: { width: 0, height: 0 },
    paddingVertical: 4,
    lineHeight: 72,
  },
  tagline: {
    fontSize: 13,
    marginTop: SPACING.md,
    maxWidth: 320,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    minHeight: 76,
    justifyContent: "center",
  },
  statValue: { fontSize: 26, fontWeight: "900" },
  statLabel: {
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 4,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  hintsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginBottom: SPACING.lg,
  },
  hintsText: { fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: RADIUS.lg,
    paddingVertical: 22,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  playLabel: {
    color: "#02141a",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  secondaryCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 4,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 4,
  },
  secondarySub: { fontSize: 11, letterSpacing: 1 },
});
