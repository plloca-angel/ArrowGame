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
import * as Haptics from "expo-haptics";
import { COLORS, RADIUS, SPACING } from "../src/theme";
import { Direction, DIR_VEC, getLevel, Level } from "../src/levels";
import { recordWin } from "../src/storage";

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

  const levelId = Math.max(1, parseInt(levelParam || "1", 10) || 1);
  const level: Level = useMemo(() => getLevel(levelId), [levelId]);

  // Compute cell size based on actual measured container (more reliable than Dimensions on web)
  const [containerW, setContainerW] = useState(
    Math.min(Dimensions.get("window").width - SPACING.md * 2, 420)
  );
  const maxBoardWidth = Math.min(containerW, 420);
  const cellSize = Math.max(40, Math.floor(maxBoardWidth / level.cols));
  const boardW = cellSize * level.cols;
  const boardH = cellSize * level.rows;

  const [arrows, setArrows] = useState<ArrowState[]>([]);
  const arrowsRef = useRef<ArrowState[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [moves, setMoves] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

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
    }));
    setArrows(init);
    arrowsRef.current = init;
    setStatus("playing");
    setMoves(0);
    setAnimating(false);
  }, [level, cellSize, resetSignal]);

  const occupiedAt = useCallback(
    (r: number, c: number, list: ArrowState[]) => {
      // walls
      if (level.walls?.some((w) => w.row === r && w.col === c)) return "wall";
      const hit = list.find(
        (a) =>
          a.status !== "escaped" &&
          a.status !== "broken" &&
          a.row === r &&
          a.col === c
      );
      return hit ? "arrow" : null;
    },
    [level]
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

    const flight = computeFlight(arrow, arrowsRef.current);
    setAnimating(true);
    setMoves((m) => m + 1);

    // Mark flying
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
    const duration = Math.max(160, dist * 80);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    Animated.timing(arrow.anim, {
      toValue: { x: targetX, y: targetY },
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      if (flight.result === "escape") {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
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
        // collision
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error
        ).catch(() => {});
        // shake
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
        // mark broken on this arrow + the one it hit (if arrow)
        let updated = arrowsRef.current.map((a) =>
          a.id === arrow.id
            ? { ...a, status: "broken" as ArrowStatus, row: flight.row, col: flight.col }
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
        // fade broken arrows
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
    Haptics.selectionAsync().catch(() => {});
    setResetSignal((s) => s + 1);
  };

  const onNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    router.replace({
      pathname: "/game",
      params: { level: String(levelId + 1) },
    });
  };

  const onBack = () => {
    Haptics.selectionAsync().catch(() => {});
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
          { left: i * cellSize, top: 0, width: 1, height: boardH },
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
          { top: i * cellSize, left: 0, height: 1, width: boardW },
        ]}
      />
    );
  }

  const arrowSize = Math.floor(cellSize * 0.62);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + SPACING.sm },
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
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow}>LEVEL</Text>
          <Text style={styles.headerTitle} testID="game-level-id">
            {levelId.toString().padStart(2, "0")}
          </Text>
        </View>
        <Pressable
          testID="game-restart-btn"
          onPress={onRestart}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Ionicons name="refresh" size={22} color={COLORS.text} />
        </Pressable>
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>ARROWS</Text>
          <Text style={styles.statValue} testID="stat-arrows">
            {arrows.filter((a) => a.status === "idle" || a.status === "flying").length}
            /{arrows.length}
          </Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>MOVES</Text>
          <Text style={[styles.statValue, { color: COLORS.magenta }]} testID="stat-moves">
            {moves}
          </Text>
        </View>
      </View>

      {/* Board */}
      <View
        style={styles.boardWrap}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width - SPACING.md * 2;
          if (w > 0 && Math.abs(w - containerW) > 4) {
            setContainerW(w);
          }
        }}
      >
        <View
          style={[
            styles.board,
            { width: boardW, height: boardH },
          ]}
          testID="game-board"
        >
          {gridLines}
          {/* Walls */}
          {level.walls?.map((w, i) => (
            <View
              key={`wall-${i}`}
              style={[
                styles.wall,
                {
                  left: w.col * cellSize,
                  top: w.row * cellSize,
                  width: cellSize,
                  height: cellSize,
                },
              ]}
            />
          ))}
          {/* Arrows */}
          {arrows.map((a) => {
            const rotation = a.rotateShake.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: ["-12deg", "0deg", "12deg"],
            });
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
                  onPress={() => fireArrow(a)}
                  disabled={a.status !== "idle" || animating || status !== "playing"}
                  style={({ pressed }) => [
                    styles.arrowBtn,
                    {
                      width: cellSize - 6,
                      height: cellSize - 6,
                      backgroundColor:
                        a.status === "broken"
                          ? COLORS.surface
                          : COLORS.bgElev,
                      borderColor:
                        a.status === "broken"
                          ? COLORS.red
                          : a.status === "escaped"
                          ? COLORS.green
                          : COLORS.cyan,
                      shadowColor:
                        a.status === "broken" ? COLORS.red : COLORS.cyan,
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
                            ? COLORS.red
                            : a.status === "escaped"
                            ? COLORS.green
                            : COLORS.cyan,
                        textShadowColor:
                          a.status === "broken"
                            ? COLORS.redGlow
                            : COLORS.cyanGlow,
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

      {level.hint && levelId === 1 && status === "playing" && (
        <Text style={styles.hint} testID="game-hint">
          {level.hint}
        </Text>
      )}

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
              status === "won" ? styles.modalWon : styles.modalLost,
            ]}
            testID={status === "won" ? "modal-won" : "modal-lost"}
          >
            <Text
              style={[
                styles.modalEyebrow,
                { color: status === "won" ? COLORS.cyan : COLORS.red },
              ]}
            >
              {status === "won" ? "ESCAPED" : "COLLISION"}
            </Text>
            <Text style={styles.modalTitle}>
              {status === "won" ? "Level Clear" : "Try Again"}
            </Text>
            {status === "won" && (
              <View style={styles.modalStars}>
                {[1, 2, 3].map((s) => {
                  const earned =
                    s === 1 ||
                    (s === 2 && moves <= level.arrows.length + 1) ||
                    (s === 3 && moves === level.arrows.length);
                  return (
                    <Ionicons
                      key={s}
                      name={earned ? "star" : "star-outline"}
                      size={36}
                      color={earned ? COLORS.star : COLORS.textMuted}
                      style={{ marginHorizontal: 6 }}
                    />
                  );
                })}
              </View>
            )}
            <Text style={styles.modalSub}>
              Moves: {moves} · Arrows: {level.arrows.length}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                testID="modal-restart-btn"
                onPress={onRestart}
                style={[styles.modalBtn, styles.modalBtnSecondary]}
              >
                <Ionicons name="refresh" size={18} color={COLORS.text} />
                <Text style={styles.modalBtnLabel}>RETRY</Text>
              </Pressable>
              {status === "won" ? (
                <Pressable
                  testID="modal-next-btn"
                  onPress={onNext}
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                >
                  <Text
                    style={[styles.modalBtnLabel, { color: "#02141a" }]}
                  >
                    NEXT
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#02141a" />
                </Pressable>
              ) : (
                <Pressable
                  testID="modal-home-btn"
                  onPress={onBack}
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                >
                  <Ionicons name="home" size={16} color={COLORS.text} />
                  <Text style={styles.modalBtnLabel}>HOME</Text>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { alignItems: "center" },
  headerEyebrow: {
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 4,
    fontWeight: "700",
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 2,
  },
  statsBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    justifyContent: "space-around",
    marginBottom: SPACING.lg,
  },
  statBlock: { alignItems: "center" },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: "700",
  },
  statValue: {
    color: COLORS.cyan,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 2,
  },
  boardWrap: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  board: {
    backgroundColor: COLORS.bgElev,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  gridLine: {
    position: "absolute",
    backgroundColor: COLORS.border,
    opacity: 0.6,
  },
  wall: {
    position: "absolute",
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    borderStyle: "dashed",
  },
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
    lineHeight: undefined,
  },
  hint: {
    color: COLORS.textDim,
    textAlign: "center",
    fontSize: 13,
    marginVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
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
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    alignItems: "center",
    borderWidth: 2,
  },
  modalWon: {
    borderColor: COLORS.cyan,
    shadowColor: COLORS.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  modalLost: {
    borderColor: COLORS.red,
    shadowColor: COLORS.red,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  modalEyebrow: {
    fontSize: 11,
    letterSpacing: 5,
    fontWeight: "800",
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
  },
  modalStars: {
    flexDirection: "row",
    marginVertical: SPACING.md,
  },
  modalSub: {
    color: COLORS.textDim,
    fontSize: 13,
    marginTop: SPACING.sm,
    letterSpacing: 1,
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
  },
  modalBtnPrimary: {
    backgroundColor: COLORS.cyan,
  },
  modalBtnSecondary: {
    backgroundColor: COLORS.bgElev,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalBtnLabel: {
    color: COLORS.text,
    fontWeight: "800",
    letterSpacing: 2,
    fontSize: 13,
  },
});
