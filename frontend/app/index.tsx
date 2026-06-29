import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  Platform,
} from "react-native";
import { AppPressable as Pressable } from "../src/components/AppPressable";
import { Link, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../src/SettingsContext";
import { loadProgress, Progress, loadEntitlements, Entitlements, isLevelUnlocked, getLevelStars, loadDailyChallenge, DailyChallengeState } from "../src/storage";
import { RADIUS, SPACING } from "../src/theme";
import { formatDailyDateLabel, formatDailyTime, getDailyChallengeLevelId } from "../src/dailyChallenge";
import { scheduleLevelWarmup } from "../src/levelWarmup";
import {
  preloadLevelsModule,
  primePlayLevel,
  warmChunkForLevel,
} from "../src/levelPreload";

const LEVELS_PER_PAGE = 25;

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, haptic, settings } = useSettings();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [ents, setEnts] = useState<Entitlements | null>(null);
  const [levelPage, setLevelPage] = useState(0);
  const [levelSelectorOpen, setLevelSelectorOpen] = useState(false);
  const [daily, setDaily] = useState<DailyChallengeState | null>(null);
  const glow = useState(new Animated.Value(0))[0];

  useFocusEffect(
    useCallback(() => {
      loadProgress().then((p) => {
        setProgress(p);
        const page = Math.max(0, Math.floor((p.currentLevel - 1) / LEVELS_PER_PAGE));
        setLevelPage(page);
      });
      loadEntitlements().then(setEnts);
      loadDailyChallenge().then(setDaily);
    }, [])
  );

  useEffect(() => {
    if (settings.reducedMotion || Platform.OS !== "web") {
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

  useEffect(() => {
    if (!progress) return;
    const current = progress.currentLevel;
    const dailyId = getDailyChallengeLevelId();
    const timer = setTimeout(() => {
      warmChunkForLevel(current);
      warmChunkForLevel(current + 1);
      warmChunkForLevel(dailyId);
      primePlayLevel(current);
      primePlayLevel(dailyId);
      preloadLevelsModule();
    }, 400);
    return () => clearTimeout(timer);
  }, [progress?.currentLevel]);

  const warmLevelsForPlay = (currentLevel: number) => {
    const dailyId = getDailyChallengeLevelId();
    warmChunkForLevel(currentLevel);
    warmChunkForLevel(currentLevel + 1);
    warmChunkForLevel(dailyId);
    primePlayLevel(currentLevel);
    primePlayLevel(currentLevel + 1);
    primePlayLevel(dailyId);
    scheduleLevelWarmup(currentLevel, currentLevel + 1);
  };

  const onPlayDaily = () => {
    const dailyId = getDailyChallengeLevelId();
    warmChunkForLevel(dailyId);
    primePlayLevel(dailyId);
    router.push({ pathname: "/game", params: { mode: "daily" } });
    haptic("medium");
  };

  const onPlay = () => {
    warmLevelsForPlay(nextLevel);
    router.push({ pathname: "/game", params: { level: String(nextLevel) } });
    haptic("medium");
  };

  const onSelectLevel = (levelId: number) => {
    if (!progress || !isLevelUnlocked(progress, levelId)) {
      haptic("error");
      return;
    }
    haptic("selection");
    setLevelSelectorOpen(false);
    warmLevelsForPlay(levelId);
    router.push({ pathname: "/game", params: { level: String(levelId) } });
  };

  const openLevelSelector = () => {
    haptic("selection");
    setLevelSelectorOpen(true);
  };

  const pageStart = levelPage * LEVELS_PER_PAGE + 1;
  const pageEnd = pageStart + LEVELS_PER_PAGE - 1;
  const levelIds = Array.from({ length: LEVELS_PER_PAGE }, (_, i) => pageStart + i);
  const canPrevPage = levelPage > 0;
  const canNextPage = true;

  const titleShadow = settings.reducedMotion ? 20 : glow.interpolate({
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

      <View style={styles.mainContent}>
      {/* Top bar with action icons */}
      <View style={styles.topBar}>
        <View style={styles.brandTag}>
          <View style={[styles.brandDot, { backgroundColor: colors.cyan }]} />
          <Text style={[styles.brandText, { color: colors.textDim }]}>
            ARROW · ESCAPE
          </Text>
        </View>
        <View style={styles.topRight}>
          <Link href="/store" asChild>
            <Pressable
              testID="home-store-btn"
              onPress={() => haptic("selection")}
              hitSlop={10}
              style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Ionicons name="bag-outline" size={18} color={colors.text} />
            </Pressable>
          </Link>
          <Link href="/settings" asChild>
            <Pressable
              testID="home-settings-btn"
              onPress={() => haptic("selection")}
              hitSlop={10}
              style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Ionicons name="settings-outline" size={18} color={colors.text} />
            </Pressable>
          </Link>
          <Link href="/accessibility" asChild>
            <Pressable
              testID="home-accessibility-btn"
              onPress={() => haptic("selection")}
              hitSlop={10}
              style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Ionicons name="accessibility-outline" size={18} color={colors.text} />
            </Pressable>
          </Link>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + SPACING.lg },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero */}
        <View style={styles.hero} pointerEvents="none">
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

        {/* Daily challenge */}
        <Pressable
          testID="home-daily-btn"
          onPress={onPlayDaily}
          style={({ pressed }) => [
            styles.dailyCard,
            {
              backgroundColor: colors.surface,
              borderColor: daily?.completed ? colors.cyan : colors.magenta,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={styles.dailyHeader}>
            <View style={[styles.dailyIconWrap, { backgroundColor: colors.bgElev }]}>
              <Ionicons name="calendar" size={20} color={colors.magenta} />
            </View>
            <View style={styles.dailyCopy}>
              <Text style={[styles.dailyTitle, { color: colors.text }]}>
                DAILY CHALLENGE
              </Text>
              <Text style={[styles.dailySub, { color: colors.textMuted }]}>
                Same puzzle for everyone · {formatDailyDateLabel()} UTC
              </Text>
            </View>
            {daily?.completed ? (
              <View style={[styles.dailyBadge, { backgroundColor: colors.cyan }]}>
                <Ionicons name="checkmark" size={14} color="#02141a" />
              </View>
            ) : null}
          </View>
          {daily?.completed && daily.bestMs !== null ? (
            <Text style={[styles.dailyBest, { color: colors.cyan }]}>
              Best time · {formatDailyTime(daily.bestMs)}
              {daily.stars > 0 ? ` · ${daily.stars}★` : ""}
            </Text>
          ) : (
            <Text style={[styles.dailyBest, { color: colors.textDim }]}>
              Tap to play today&apos;s shared puzzle
            </Text>
          )}
        </Pressable>

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

        <Pressable
          testID="home-levels-btn"
          onPress={openLevelSelector}
          style={({ pressed }) => [
            styles.levelsBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <View style={styles.levelsBtnLeft}>
            <Ionicons name="grid" size={20} color={colors.magenta} />
            <View>
              <Text style={[styles.levelsBtnTitle, { color: colors.text }]}>
                SELECT LEVEL
              </Text>
              <Text style={[styles.levelsBtnSub, { color: colors.textMuted }]}>
                Current · Level {nextLevel}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {/* Secondary nav */}
        <View style={styles.secondaryRow}>
          <Link href="/store" asChild>
            <Pressable
              testID="home-store-card"
              onPress={() => haptic("selection")}
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
          </Link>
          <Link href="/settings" asChild>
            <Pressable
              testID="home-settings-card"
              onPress={() => haptic("selection")}
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
          </Link>
        </View>
      </ScrollView>
      </View>

      {levelSelectorOpen ? (
        <View
          style={[
            styles.levelOverlay,
            { paddingBottom: insets.bottom + SPACING.md },
          ]}
        >
          <Pressable
            style={styles.modalDismissArea}
            onPress={() => setLevelSelectorOpen(false)}
            accessibilityLabel="Close level selector"
          />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.bgElev,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.levelSectionHeader}>
              <Text style={[styles.levelSectionTitle, { color: colors.text }]}>
                SELECT LEVEL
              </Text>
              <Pressable
                testID="level-selector-close"
                onPress={() => {
                  haptic("selection");
                  setLevelSelectorOpen(false);
                }}
                hitSlop={10}
                style={[styles.modalCloseBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </Pressable>
            </View>

            <View style={styles.levelPageNav}>
              <Pressable
                testID="level-page-prev"
                onPress={() => {
                  if (!canPrevPage) return;
                  haptic("selection");
                  setLevelPage((p) => Math.max(0, p - 1));
                }}
                disabled={!canPrevPage}
                style={[
                  styles.pageBtn,
                  {
                    borderColor: colors.border,
                    opacity: canPrevPage ? 1 : 0.35,
                  },
                ]}
              >
                <Ionicons name="chevron-back" size={16} color={colors.text} />
              </Pressable>
              <Text style={[styles.levelPageLabel, { color: colors.textMuted }]}>
                Levels {pageStart}–{pageEnd}
              </Text>
              <Pressable
                testID="level-page-next"
                onPress={() => {
                  if (!canNextPage) return;
                  haptic("selection");
                  setLevelPage((p) => p + 1);
                }}
                disabled={!canNextPage}
                style={[
                  styles.pageBtn,
                  {
                    borderColor: colors.border,
                    opacity: canNextPage ? 1 : 0.35,
                  },
                ]}
              >
                <Ionicons name="chevron-forward" size={16} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.levelGridScroll}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.levelGrid}>
                {levelIds.map((levelId) => {
                  const unlocked = progress
                    ? isLevelUnlocked(progress, levelId)
                    : levelId === 1;
                  const stars = progress ? getLevelStars(progress, levelId) : 0;
                  const isCurrent = levelId === nextLevel;
                  return (
                    <Pressable
                      key={levelId}
                      testID={`level-tile-${levelId}`}
                      accessibilityRole="button"
                      accessibilityLabel={
                        unlocked
                          ? `Level ${levelId}${stars > 0 ? `, ${stars} stars` : ""}${isCurrent ? ", current level" : ""}`
                          : `Level ${levelId}, locked`
                      }
                      accessibilityState={{ disabled: !unlocked }}
                      onPress={() => onSelectLevel(levelId)}
                      disabled={!unlocked}
                      style={({ pressed }) => [
                        styles.levelTile,
                        {
                          borderColor: isCurrent ? colors.cyan : colors.border,
                          backgroundColor: unlocked ? colors.surface : colors.bg,
                          opacity:
                            pressed && unlocked ? 0.75 : unlocked ? 1 : 0.55,
                        },
                      ]}
                    >
                      {!unlocked ? (
                        <Ionicons
                          name="lock-closed"
                          size={14}
                          color={colors.textMuted}
                        />
                      ) : (
                        <>
                          <Text
                            style={[
                              styles.levelTileNum,
                              { color: isCurrent ? colors.cyan : colors.text },
                            ]}
                          >
                            {levelId}
                          </Text>
                          {stars > 0 && (
                            <View style={styles.levelStars}>
                              {[1, 2, 3].map((s) => (
                                <Ionicons
                                  key={s}
                                  name={s <= stars ? "star" : "star-outline"}
                                  size={8}
                                  color={
                                    s <= stars ? colors.star : colors.textMuted
                                  }
                                />
                              ))}
                            </View>
                          )}
                        </>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      ) : null}
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
  mainContent: { flex: 1, zIndex: 1, elevation: 1 },
  scrollView: { flex: 1 },
  deco: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    elevation: 0,
  },
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
  dailyCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  dailyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  dailyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dailyCopy: { flex: 1 },
  dailyTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  dailySub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  dailyBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dailyBest: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: SPACING.sm,
    letterSpacing: 0.5,
  },
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
    marginBottom: SPACING.md,
  },
  playLabel: {
    color: "#02141a",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 2,
  },
  levelsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.lg,
  },
  levelsBtnLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  levelsBtnTitle: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 2,
  },
  levelsBtnSub: {
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  levelOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "flex-end",
    paddingHorizontal: SPACING.md,
  },
  modalDismissArea: {
    flex: 1,
    width: "100%",
  },
  modalCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    maxHeight: "78%",
    width: "100%",
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  levelSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
  },
  levelSectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 3,
  },
  levelPageNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: SPACING.sm,
  },
  levelPageLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    minWidth: 120,
    textAlign: "center",
  },
  pageBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  levelGridScroll: {
    paddingBottom: SPACING.xs,
  },
  levelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    justifyContent: "center",
  },
  levelTile: {
    flexBasis: "18%",
    flexGrow: 1,
    maxWidth: 72,
    aspectRatio: 1,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  levelTileNum: { fontSize: 15, fontWeight: "900" },
  levelStars: { flexDirection: "row", gap: 1 },
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
