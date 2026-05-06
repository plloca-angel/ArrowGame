import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Dimensions,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../src/SettingsContext";
import { Direction, DIR_VEC, getLevel, Level } from "../src/levels";
import {
  recordWin,
  loadEntitlements,
  consumeHint,
  skipLevel,
  Entitlements,
} from "../src/storage";
import { RADIUS, SPACING } from "../src/theme";
import { AdBanner } from "../src/AdBanner";

type ArrowStatus = "idle" | "flying" | "escaped" | "broken";

type ArrowState = {
  id: string;
  row: number;
  col: number;
  direction: Direction;
  status: ArrowStatus;
  anim: Animated.ValueXY;
  fade: Animated.Value;
  rotateShake: Animated.Value;
  hintPulse: Animated.Value;
};

type GameStatus = "playing" | "won" | "lost";

const ARROW_GLYPH: Record<Direction, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
};

export default function Game() {
  const { level: levelParam } = useLocalSearchParams<{ level?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, haptic, settings } = useSettings();

  const levelId = Math.max(1, parseInt(levelParam || "1", 10) || 1);
  const level: Level = useMemo(() => getLevel(levelId), [levelId]);

  // Container measurement
  const [containerW, setContainerW] = useState(
    Math.min(Dimensions.get("window").width - SPACING.md * 2, 420)
  );
  const maxBoardWidth = Math.min(containerW, 480);
  const cellSize = Math.max(28, Math.floor(maxBoardWidth / level.cols));
  const boardW = cellSize * level.cols;
  const boardH = cellSize * level.rows;

  const [arrows, setArrows] = useState<ArrowState[]>([]);
  const arrowsRef = useRef<ArrowState[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [moves, setMoves] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [ents, setEnts] = useState<Entitlements | null>(null);
  const [hintHighlight, setHintHighlight] = useState<string | null>(null);

  useEffect(() => {
    loadEntitlements().then(setEnts);
  }, [resetSignal, status]);

  // Initialize arrows from level
  useEffect(() => {
    const init: ArrowState[] = level.arrows.map((a, idx) => ({
      id: `${level.id}-${idx}`,
      row: a.row,
      col: a.col,
      direction: a.direction,
      status: "idle",
      anim: new Animated.ValueXY({ x: a.col * cellSize, y: a.row * cellSize }),
      fade: new Animated.Value(1),
      rotateShake: new Animated.Value(0),
      hintPulse: new Animated.Value(0),
    }));
    setArrows(init);
    arrowsRef.current = init;
    setStatus("playing");
    setMoves(0);
    setAnimating(false);
    setHintHighlight(null);
  }, [level, cellSize, resetSignal]);

  const occupiedAt = useCallback(
    (r: number, c: number, list: ArrowState[]) => {
      const hit = list.find(
        (a) =>
          a.status !== "escaped" &&
          a.status !== "broken" &&
          a.row === r &&
          a.col === c
      );
      return hit ? "arrow" : null;
    },
    []
  );

  const computeFlight = useCallback(
    (arrow: ArrowState, list: ArrowState[]) => {
      const [dr, dc] = DIR_VEC[arrow.direction];
      let r = arrow.row + dr;
      let c = arrow.col + dc;
      while (r >= 0 && r < level.rows && c >= 0 && c < level.cols) {
        const occ = occupiedAt(r, c, list);
        if (occ) {
          return { result: "collision" as const, row: r, col: c, occ };
        }
        r += dr;
        c += dc;
      }
      return { result: "escape" as const, row: r, col: c };
    },
    [level, occupiedAt]
  );

  const fireArrow = (arrow: ArrowState) => {
    if (animating || status !== "playing") return;
    if (arrow.status !== "idle") return;
    setHintHighlight(null);

    const flight = computeFlight(arrow, arrowsRef.current);
    setAnimating(true);
    setMoves((m) => m + 1);

    const newList = arrowsRef.current.map((a) =>
      a.id === arrow.id ? { ...a, status: "flying" as ArrowStatus } : a
    );
    arrowsRef.current = newList;
    setArrows(newList);

    const targetX = flight.col * cellSize;
    const targetY = flight.row * cellSize;
    const dist = Math.max(
      Math.abs(flight.row - arrow.row),
      Math.abs(flight.col - arrow.col)
    );
    const baseDuration = settings.reducedMotion ? 80 : 80;
    const duration = Math.max(140, dist * baseDuration);

    haptic("light");

    Animated.timing(arrow.anim, {
      toValue: { x: targetX, y: targetY },
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      if (flight.result === "escape") {
        haptic("success");
        Animated.timing(arrow.fade, {
          toValue: 0,
          duration: 180,
          useNativeDriver: false,
        }).start(() => {
          const updated = arrowsRef.current.map((a) =>
            a.id === arrow.id ? { ...a, status: "escaped" as ArrowStatus } : a
          );
          arrowsRef.current = updated;
          setArrows(updated);
          setAnimating(false);
          checkWin(updated);
        });
      } else {
        haptic("error");
        if (!settings.reducedMotion) {
          Animated.sequence([
            Animated.timing(arrow.rotateShake, {
              toValue: 1,
              duration: 60,
              useNativeDriver: false,
            }),
            Animated.timing(arrow.rotateShake, {
              toValue: -1,
              duration: 60,
              useNativeDriver: false,
            }),
            Animated.timing(arrow.rotateShake, {
              toValue: 0,
              duration: 60,
              useNativeDriver: false,
            }),
          ]).start();
        }
        let updated = arrowsRef.current.map((a) =>
          a.id === arrow.id
            ? {
                ...a,
                status: "broken" as ArrowStatus,
                row: flight.row,
                col: flight.col,
              }
            : a
        );
        if (flight.occ === "arrow") {
          updated = updated.map((a) =>
            a.row === flight.row &&
            a.col === flight.col &&
            a.id !== arrow.id &&
            a.status !== "escaped" &&
            a.status !== "broken"
              ? { ...a, status: "broken" as ArrowStatus }
              : a
          );
        }
        arrowsRef.current = updated;
        setArrows(updated);
        updated
          .filter((a) => a.status === "broken")
          .forEach((a) =>
            Animated.timing(a.fade, {
              toValue: 0.25,
              duration: 220,
              useNativeDriver: false,
            }).start()
          );
        setAnimating(false);
        setStatus("lost");
      }
    });
  };

  const checkWin = (list: ArrowState[]) => {
    const allOut = list.every((a) => a.status === "escaped");
    if (allOut) {
      setStatus("won");
      recordWin(levelId, moves + 1, list.length).catch(() => {});
    }
  };

  const onRestart = () => {
    haptic("selection");
    setResetSignal((s) => s + 1);
  };

  const onNext = () => {
    haptic("medium");
    router.replace({
      pathname: "/game",
      params: { level: String(levelId + 1) },
    });
  };

  const onSkip = async () => {
    haptic("warning");
    await skipLevel(levelId);
    router.replace({
      pathname: "/game",
      params: { level: String(levelId + 1) },
    });
  };

  const onHint = async () => {
    if (!ents || ents.hintCredits <= 0 || animating || status !== "playing") {
      if (!ents || ents.hintCredits <= 0) {
        haptic("warning");
        router.push("/store");
      }
      return;
    }
    haptic("medium");
    // Hint: highlight the next arrow that is safe to fire (any idle arrow with clear path)
    const next = arrowsRef.current.find((a) => {
      if (a.status !== "idle") return false;
      const flight = computeFlight(a, arrowsRef.current);
      return flight.result === "escape";
    });
    if (next) {
      const updated = await consumeHint();
      setEnts(updated);
      setHintHighlight(next.id);
      // pulse animation
      if (!settings.reducedMotion) {
        Animated.sequence([
          Animated.timing(next.hintPulse, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(next.hintPulse, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(next.hintPulse, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
          Animated.timing(next.hintPulse, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }),
        ]).start();
      }
    }
  };

  const onBack = () => {
    haptic("selection");
    router.back();
  };

  // Render grid lines
  const gridLines = [];
  for (let i = 1; i < level.cols; i++) {
    gridLines.push(
      <View
        key={`v${i}`}
        style={[
          styles.gridLine,
          {
            backgroundColor: colors.border,
            left: i * cellSize,
            top: 0,
            width: 1,
            height: boardH,
          },
        ]}
      />
    );
  }
  for (let i = 1; i < level.rows; i++) {
    gridLines.push(
      <View
        key={`h${i}`}
        style={[
          styles.gridLine,
          {
            backgroundColor: colors.border,
            top: i * cellSize,
            left: 0,
            height: 1,
            width: boardW,
          },
        ]}
      />
    );
  }

  const arrowSizeFactor = settings.largeArrows ? 0.78 : 0.62;
  const arrowSize = Math.max(12, Math.floor(cellSize * arrowSizeFactor));

  const idleArrows = arrows.filter(
    (a) => a.status === "idle" || a.status === "flying"
  ).length;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: insets.top + SPACING.sm },
      ]}
      testID="game-screen"
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="game-back-btn"
          onPress={onBack}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerEyebrow, { color: colors.textMuted }]}>
            LEVEL
          </Text>
          <Text style={[styles.headerTitle, { color: colors.text }]} testID="game-level-id">
            {levelId.toString().padStart(2, "0")}
          </Text>
        </View>
        <Pressable
          testID="game-restart-btn"
          onPress={onRestart}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Ionicons name="refresh" size={22} color={colors.text} />
        </Pressable>
      </View>

      {/* Stats */}
      <View
        style={[
          styles.statsBar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.statBlock}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            ARROWS
          </Text>
          <Text style={[styles.statValue, { color: colors.cyan }]} testID="stat-arrows">
            {idleArrows}/{arrows.length}
          </Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            MOVES
          </Text>
          <Text
            style={[styles.statValue, { color: colors.magenta }]}
            testID="stat-moves"
          >
            {moves}
          </Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            GRID
          </Text>
          <Text style={[styles.statValue, { color: colors.text, fontSize: 16 }]}>
            {level.rows}×{level.cols}
          </Text>
        </View>
      </View>

      {/* Board */}
      <View
        style={styles.boardWrap}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width - SPACING.md * 2;
          if (w > 0 && Math.abs(w - containerW) > 4) setContainerW(w);
        }}
      >
        <View
          style={[
            styles.board,
            {
              width: boardW,
              height: boardH,
              backgroundColor: colors.bgElev,
              borderColor: colors.border,
            },
          ]}
          testID="game-board"
        >
          {gridLines}
          {arrows.map((a) => {
            const rotation = a.rotateShake.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: ["-12deg", "0deg", "12deg"],
            });
            const isHinted = hintHighlight === a.id;
            return (
              <Animated.View
                key={a.id}
                style={[
                  styles.arrowCell,
                  {
                    width: cellSize,
                    height: cellSize,
                    transform: [
                      { translateX: a.anim.x },
                      { translateY: a.anim.y },
                      { rotate: rotation },
                    ],
                    opacity: a.fade,
                  },
                ]}
              >
                <Pressable
                  testID={`arrow-${a.id}`}
                  accessibilityLabel={`Arrow pointing ${a.direction}`}
                  onPress={() => fireArrow(a)}
                  disabled={
                    a.status !== "idle" || animating || status !== "playing"
                  }
                  style={({ pressed }) => [
                    styles.arrowBtn,
                    {
                      width: cellSize - 6,
                      height: cellSize - 6,
                      backgroundColor:
                        a.status === "broken" ? colors.surface : colors.bgElev,
                      borderColor:
                        a.status === "broken"
                          ? colors.red
                          : a.status === "escaped"
                          ? colors.green
                          : isHinted
                          ? colors.yellow
                          : colors.cyan,
                      shadowColor:
                        a.status === "broken"
                          ? colors.red
                          : isHinted
                          ? colors.yellow
                          : colors.cyan,
                    },
                    pressed && a.status === "idle" && { transform: [{ scale: 0.92 }] },
                  ]}
                >
                  <Text
                    style={[
                      styles.arrowGlyph,
                      {
                        fontSize: arrowSize,
                        color:
                          a.status === "broken"
                            ? colors.red
                            : a.status === "escaped"
                            ? colors.green
                            : isHinted
                            ? colors.yellow
                            : colors.cyan,
                        textShadowColor:
                          a.status === "broken" ? colors.redGlow : colors.cyanGlow,
                      },
                    ]}
                  >
                    {ARROW_GLYPH[a.direction]}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      </View>

      {/* Action bar - hint + skip */}
      <View style={styles.actionBar}>
        <Pressable
          testID="game-hint-btn"
          onPress={onHint}
          disabled={animating || status !== "playing"}
          style={({ pressed }) => [
            styles.actionChip,
            {
              backgroundColor: colors.surface,
              borderColor:
                ents && ents.hintCredits > 0 ? colors.yellow : colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="bulb" size={16} color={colors.yellow} />
          <Text style={[styles.actionLabel, { color: colors.text }]}>
            HINT
          </Text>
          <View
            style={[
              styles.actionCounter,
              {
                backgroundColor:
                  ents && ents.hintCredits > 0
                    ? colors.yellow
                    : colors.textMuted,
              },
            ]}
          >
            <Text style={styles.actionCounterText}>
              {ents?.hintCredits ?? 0}
            </Text>
          </View>
        </Pressable>

        <Pressable
          testID="game-skip-btn"
          onPress={onSkip}
          style={({ pressed }) => [
            styles.actionChip,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="play-skip-forward" size={16} color={colors.textDim} />
          <Text style={[styles.actionLabel, { color: colors.text }]}>
            SKIP
          </Text>
        </Pressable>
      </View>

      {/* Banner ad at bottom */}
      <View style={{ marginBottom: insets.bottom + SPACING.sm }}>
        <AdBanner />
      </View>

      {/* Win/Lose Modal */}
      <Modal
        visible={status !== "playing"}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modal,
              {
                backgroundColor: colors.surface,
                borderColor: status === "won" ? colors.cyan : colors.red,
                shadowColor: status === "won" ? colors.cyan : colors.red,
              },
            ]}
            testID={status === "won" ? "modal-won" : "modal-lost"}
          >
            <Text
              style={[
                styles.modalEyebrow,
                { color: status === "won" ? colors.cyan : colors.red },
              ]}
            >
              {status === "won" ? "ESCAPED" : "COLLISION"}
            </Text>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {status === "won" ? "Level Clear" : "Try Again"}
            </Text>
            {status === "won" && (
              <View style={styles.modalStars}>
                {[1, 2, 3].map((s) => {
                  const earned =
                    s === 1 ||
                    (s === 2 &&
                      moves <= Math.ceil(level.arrows.length * 1.15)) ||
                    (s === 3 && moves === level.arrows.length);
                  return (
                    <Ionicons
                      key={s}
                      name={earned ? "star" : "star-outline"}
                      size={36}
                      color={earned ? colors.star : colors.textMuted}
                      style={{ marginHorizontal: 6 }}
                    />
                  );
                })}
              </View>
            )}
            <Text style={[styles.modalSub, { color: colors.textDim }]}>
              Moves: {moves} · Arrows: {level.arrows.length} · {level.rows}×
              {level.cols}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                testID="modal-restart-btn"
                onPress={onRestart}
                style={[
                  styles.modalBtn,
                  { backgroundColor: colors.bgElev, borderColor: colors.border },
                ]}
              >
                <Ionicons name="refresh" size={18} color={colors.text} />
                <Text style={[styles.modalBtnLabel, { color: colors.text }]}>
                  RETRY
                </Text>
              </Pressable>
              {status === "won" ? (
                <Pressable
                  testID="modal-next-btn"
                  onPress={onNext}
                  style={[styles.modalBtn, { backgroundColor: colors.cyan }]}
                >
                  <Text style={[styles.modalBtnLabel, { color: "#02141a" }]}>
                    NEXT
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#02141a" />
                </Pressable>
              ) : (
                <Pressable
                  testID="modal-skip-btn"
                  onPress={onSkip}
                  style={[
                    styles.modalBtn,
                    { backgroundColor: colors.bgElev, borderColor: colors.border },
                  ]}
                >
                  <Ionicons
                    name="play-skip-forward"
                    size={16}
                    color={colors.textDim}
                  />
                  <Text style={[styles.modalBtnLabel, { color: colors.text }]}>
                    SKIP
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SPACING.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { alignItems: "center" },
  headerEyebrow: { fontSize: 10, letterSpacing: 4, fontWeight: "700" },
  headerTitle: { fontSize: 22, fontWeight: "900", letterSpacing: 2 },
  statsBar: {
    flexDirection: "row",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm + 2,
    justifyContent: "space-around",
    marginBottom: SPACING.md,
  },
  statBlock: { alignItems: "center", flex: 1 },
  statLabel: { fontSize: 10, letterSpacing: 3, fontWeight: "700" },
  statValue: { fontSize: 18, fontWeight: "900", marginTop: 2 },
  boardWrap: { alignItems: "center", justifyContent: "center", flex: 1 },
  board: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  gridLine: { position: "absolute", opacity: 0.6 },
  arrowCell: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowBtn: {
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  arrowGlyph: {
    fontWeight: "900",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  actionBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.sm,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  actionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
  },
  actionLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  actionCounter: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  actionCounterText: {
    color: "#000",
    fontSize: 10,
    fontWeight: "900",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 360,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: "center",
    borderWidth: 2,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  modalEyebrow: { fontSize: 11, letterSpacing: 5, fontWeight: "800" },
  modalTitle: { fontSize: 32, fontWeight: "900", marginTop: 4 },
  modalStars: { flexDirection: "row", marginVertical: SPACING.md },
  modalSub: {
    fontSize: 12,
    marginTop: SPACING.sm,
    letterSpacing: 1,
    textAlign: "center",
  },
  modalActions: {
    flexDirection: "row",
    gap: SPACING.md,
    marginTop: SPACING.lg,
    width: "100%",
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
  },
  modalBtnLabel: { fontWeight: "800", letterSpacing: 2, fontSize: 13 },
});
