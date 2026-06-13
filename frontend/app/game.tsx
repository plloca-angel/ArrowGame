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
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../src/SettingsContext";
import { Direction, getLevel, Level, GridCell, getLevelActiveCellSet, cellKey } from "../src/levels";
import {
  recordWin,
  loadEntitlements,
  consumeHint,
  skipLevel,
  Entitlements,
} from "../src/storage";
import { RADIUS, SPACING } from "../src/theme";
import { AdBanner } from "../src/AdBanner";
import { presentInterstitialAd } from "../src/ads/interstitial";
import { NeonPathArrow, getNeonTrace, pathHitBox } from "../src/components/NeonPathArrow";
import {
  buildMovementTrack,
  buildSnakeStepSequence,
  extractSnakePolyline,
  simulateSnakeFlight,
  SnakeFlightResult,
} from "../src/arrowMotion";

type ArrowStatus = "idle" | "flying" | "escaped" | "broken";

type ArrowState = {
  id: string;
  cells: GridCell[];
  visualCells: GridCell[];
  direction: Direction;
  status: ArrowStatus;
  colorIndex: number;
  fade: Animated.Value;
  rotateShake: Animated.Value;
  hintPulse: Animated.Value;
};

type GameStatus = "playing" | "won" | "lost";

const STEP_MS = 88;
const ESCAPE_EXTRA_CELLS = 2;

const ARROW_GLOW = {
  hint: { color: "#f8ff5c", glow: "rgba(248, 255, 92, 0.55)" },
  broken: { color: "#ff3a5e", glow: "rgba(255, 58, 94, 0.55)" },
  escaped: { color: "#39ff88", glow: "rgba(57, 255, 136, 0.45)" },
};

export default function Game() {
  const { level: levelParam } = useLocalSearchParams<{ level?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, haptic, settings } = useSettings();

  const levelId = Math.max(1, parseInt(levelParam || "1", 10) || 1);
  const level: Level = useMemo(() => getLevel(levelId), [levelId]);
  const activeCellSet = useMemo(() => getLevelActiveCellSet(level), [level]);

  // Board area: size cells from both width and height so the grid stays centered as levels grow
  const [boardSpace, setBoardSpace] = useState({ w: 0, h: 0 });
  const win = Dimensions.get("window");
  const layoutW =
    boardSpace.w > 0
      ? boardSpace.w
      : Math.min(win.width - SPACING.md * 2, win.width - 32);
  const layoutH =
    boardSpace.h > 0 ? boardSpace.h : Math.max(160, win.height * 0.36);
  const cellFromW = Math.floor(layoutW / (level.cols + (level.isSpecialShape ? 2 : 3)));
  const cellFromH = Math.floor(layoutH / (level.rows + (level.isSpecialShape ? 2 : 3)));
  const minCell = level.isSpecialShape ? 14 : 24;
  const cellSize = Math.max(minCell, Math.min(cellFromW, cellFromH));
  const boardW = cellSize * level.cols;
  const boardH = cellSize * level.rows;
  const boardPad = Math.ceil(cellSize * (level.isSpecialShape ? 1.6 : 2));
  const canvasW = boardW + boardPad * 2;
  const canvasH = boardH + boardPad * 2;

  const [arrows, setArrows] = useState<ArrowState[]>([]);
  const arrowsRef = useRef<ArrowState[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const statusRef = useRef<GameStatus>("playing");
  const [moves, setMoves] = useState(0);
  const movesRef = useRef(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [ents, setEnts] = useState<Entitlements | null>(null);
  const [hintHighlight, setHintHighlight] = useState<string | null>(null);

  useEffect(() => {
    loadEntitlements().then(setEnts);
  }, [resetSignal, status]);

  useFocusEffect(
    useCallback(() => {
      loadEntitlements().then(setEnts);
    }, [])
  );

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Initialize arrows from level
  useEffect(() => {
    const init: ArrowState[] = level.arrows.map((a, idx) => ({
      id: `${level.id}-${idx}`,
      cells: a.cells.map((c) => ({ ...c })),
      visualCells: a.cells.map((c) => ({ ...c })),
      direction: a.direction,
      colorIndex: idx,
      status: "idle",
      fade: new Animated.Value(1),
      rotateShake: new Animated.Value(0),
      hintPulse: new Animated.Value(0),
    }));
    setArrows(init);
    arrowsRef.current = init;
    setStatus("playing");
    statusRef.current = "playing";
    setMoves(0);
    movesRef.current = 0;
    setHintHighlight(null);
  }, [level, cellSize, resetSignal]);

  const isCellOccupied = useCallback(
    (r: number, c: number, list: ArrowState[], excludeId?: string) => {
      for (const a of list) {
        if (a.id === excludeId || a.status === "escaped") continue;
        for (const cell of a.cells) {
          if (cell.row === r && cell.col === c) return true;
        }
      }
      return false;
    },
    []
  );

  const computeFlight = useCallback(
    (arrow: ArrowState, list: ArrowState[]): SnakeFlightResult => {
      const escapeExtra = Math.max(
        ESCAPE_EXTRA_CELLS,
        Math.ceil(arrow.cells.length * 0.75)
      );
      const onBoard = (r: number, c: number) => activeCellSet.has(cellKey(r, c));
      return simulateSnakeFlight(
        arrow.cells,
        arrow.direction,
        onBoard,
        (r, c) => isCellOccupied(r, c, list, arrow.id),
        escapeExtra,
        level.rows + level.cols
      );
    },
    [level, isCellOccupied, activeCellSet]
  );

  const animateSnakeAlongPath = async (
    arrowId: string,
    startCells: GridCell[],
    direction: Direction,
    totalSteps: number,
    reducedMotion: boolean
  ) => {
    const track = buildMovementTrack(startCells, direction, totalSteps);
    const sequence = buildSnakeStepSequence(startCells, direction, totalSteps);
    const segmentCount = startCells.length;
    const stepDuration = reducedMotion ? 36 : STEP_MS;
    const progress = new Animated.Value(0);

    const discreteCellsAt = (value: number) => {
      if (value < 1) return startCells.map((c) => ({ ...c }));
      const idx = Math.min(Math.floor(value) - 1, sequence.length - 1);
      return sequence[idx].map((c) => ({ ...c }));
    };

    await new Promise<void>((resolve) => {
      const listenerId = progress.addListener(({ value }) => {
        const visual = extractSnakePolyline(track, value, segmentCount);
        const cells = discreteCellsAt(value);
        const updated = arrowsRef.current.map((a) =>
          a.id === arrowId ? { ...a, visualCells: visual, cells } : a
        );
        arrowsRef.current = updated;
        setArrows(updated);
      });

      Animated.timing(progress, {
        toValue: totalSteps,
        duration: stepDuration * totalSteps,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start(() => {
        progress.removeListener(listenerId);
        const finalCells = sequence[sequence.length - 1] ?? startCells;
        const snapped = arrowsRef.current.map((a) =>
          a.id === arrowId
            ? {
                ...a,
                cells: finalCells.map((c) => ({ ...c })),
                visualCells: finalCells.map((c) => ({ ...c })),
              }
            : a
        );
        arrowsRef.current = snapped;
        setArrows(snapped);
        resolve();
      });
    });
  };

  const fireArrowById = useCallback(
    (arrowId: string) => {
      const arrow = arrowsRef.current.find((a) => a.id === arrowId);
      if (arrow) fireArrow(arrow);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status]
  );

  const cellTapTargets = useMemo(() => {
    const targets: { row: number; col: number; arrowId: string }[] = [];
    const seen = new Set<string>();
    for (const a of arrows) {
      if (a.status !== "idle") continue;
      for (const cell of a.cells) {
        const key = `${cell.row},${cell.col}`;
        if (seen.has(key)) continue;
        seen.add(key);
        targets.push({ row: cell.row, col: cell.col, arrowId: a.id });
      }
    }
    return targets;
  }, [arrows]);

  const shakeAnim = (rotateShake: Animated.Value, reducedMotion: boolean) =>
    new Promise<void>((resolve) => {
      if (reducedMotion) {
        resolve();
        return;
      }
      Animated.sequence([
        Animated.timing(rotateShake, {
          toValue: 1,
          duration: 45,
          useNativeDriver: true,
        }),
        Animated.timing(rotateShake, {
          toValue: -1,
          duration: 45,
          useNativeDriver: true,
        }),
        Animated.timing(rotateShake, {
          toValue: 0.6,
          duration: 40,
          useNativeDriver: true,
        }),
        Animated.timing(rotateShake, {
          toValue: 0,
          duration: 40,
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });

  const bumpMoves = () => {
    setMoves((m) => {
      const next = m + 1;
      movesRef.current = next;
      return next;
    });
  };

  const checkWin = (list: ArrowState[]) => {
    const allOut = list.every((a) => a.status === "escaped");
    if (allOut) {
      setStatus("won");
      statusRef.current = "won";
      recordWin(levelId, movesRef.current, list.length).catch(() => {});
    }
  };

  const fireArrow = async (arrow: ArrowState) => {
    if (statusRef.current !== "playing") return;
    const live = arrowsRef.current.find((a) => a.id === arrow.id);
    if (!live || live.status !== "idle") return;
    setHintHighlight(null);

    const flight = computeFlight(live, arrowsRef.current);
    const startCells = live.cells.map((c) => ({ ...c }));

    const setFlying = () => {
      const next = arrowsRef.current.map((a) =>
        a.id === live.id ? { ...a, status: "flying" as ArrowStatus } : a
      );
      arrowsRef.current = next;
      setArrows(next);
    };

    if (flight.result === "blocked") {
      haptic("error");
      await shakeAnim(live.rotateShake, settings.reducedMotion);
      return;
    }

    setFlying();
    haptic("light");

    if (flight.result === "escape") {
      bumpMoves();

      await animateSnakeAlongPath(
        live.id,
        startCells,
        live.direction,
        flight.steps,
        settings.reducedMotion
      );

      haptic("success");
      await new Promise<void>((resolve) => {
        Animated.timing(live.fade, {
          toValue: 0,
          duration: settings.reducedMotion ? 80 : 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => resolve());
      });

      const updated = arrowsRef.current.map((a) =>
        a.id === live.id ? { ...a, status: "escaped" as ArrowStatus } : a
      );
      arrowsRef.current = updated;
      setArrows(updated);
      checkWin(updated);
      return;
    }

    await animateSnakeAlongPath(
      live.id,
      startCells,
      live.direction,
      flight.steps,
      settings.reducedMotion
    );
    haptic("error");
    await shakeAnim(live.rotateShake, settings.reducedMotion);

    const final = flight.finalCells;

    let updated = arrowsRef.current.map((a) => {
      if (a.id === live.id) {
        return {
          ...a,
          status: "broken" as ArrowStatus,
          cells: final.map((c) => ({ ...c })),
          visualCells: final.map((c) => ({ ...c })),
        };
      }
      if (
        a.status !== "escaped" &&
        a.status !== "broken" &&
        a.cells.some((c) => c.row === flight.hitRow && c.col === flight.hitCol)
      ) {
        return { ...a, status: "broken" as ArrowStatus };
      }
      return a;
    });

    arrowsRef.current = updated;
    setArrows(updated);
    bumpMoves();

    updated
      .filter((a) => a.status === "broken")
      .forEach((a) =>
        Animated.timing(a.fade, {
          toValue: 0.25,
          duration: 220,
          useNativeDriver: true,
        }).start()
      );

    setStatus("lost");
    statusRef.current = "lost";
  };

  const onRestart = () => {
    haptic("selection");
    setResetSignal((s) => s + 1);
  };

  const onNext = async () => {
    try {
      if (!ents?.removeAds && levelId % 2 === 0) {
        await presentInterstitialAd();
      }
    } catch {
      // never block navigation
    }
    haptic("medium");
    router.replace({
      pathname: "/game",
      params: { level: String(levelId + 1) },
    });
  };

  const onSkip = async () => {
    try {
      if (!ents?.removeAds) {
        await presentInterstitialAd();
      }
    } catch {
      // never block skip
    }
    haptic("warning");
    await skipLevel(levelId);
    router.replace({
      pathname: "/game",
      params: { level: String(levelId + 1) },
    });
  };

  const onHint = async () => {
    if (!ents || ents.hintCredits <= 0 || status !== "playing") {
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

  // Wireframe grid: visible cell outlines, transparent interiors
  const gridLines = [];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      if (!activeCellSet.has(cellKey(r, c))) continue;
      gridLines.push(
        <View
          key={`cell-${r}-${c}`}
          style={{
            position: "absolute",
            left: boardPad + c * cellSize,
            top: boardPad + r * cellSize,
            width: cellSize,
            height: cellSize,
            borderWidth: 1,
            borderColor: colors.gridTrace,
            backgroundColor: "transparent",
          }}
        />
      );
      gridLines.push(
        <View
          key={`pad-${r}-${c}`}
          style={[
            styles.gridPad,
            {
              backgroundColor: colors.gridPad,
              left: boardPad + c * cellSize + cellSize / 2 - 2,
              top: boardPad + r * cellSize + cellSize / 2 - 2,
            },
          ]}
        />
      );
    }
  }

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
            {level.isSpecialShape ? "SPECIAL" : "LEVEL"}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.text }]} testID="game-level-id">
            {levelId.toString().padStart(2, "0")}
          </Text>
          {level.shapeName ? (
            <Text
              style={{ color: colors.yellow, fontSize: 11, fontWeight: "700", marginTop: 2 }}
              numberOfLines={1}
            >
              {level.shapeName}
            </Text>
          ) : null}
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
            {level.isSpecialShape ? "SHAPE" : "GRID"}
          </Text>
          <Text
            style={[styles.statValue, { color: colors.text, fontSize: level.shapeName ? 12 : 16 }]}
            numberOfLines={1}
          >
            {level.shapeName ?? `${level.rows}×${level.cols}`}
          </Text>
        </View>
      </View>

      {/* Board */}
      <View
        style={styles.boardWrap}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) {
            setBoardSpace((prev) =>
              Math.abs(prev.w - width) > 8 || Math.abs(prev.h - height) > 8
                ? { w: width, h: height }
                : prev
            );
          }
        }}
      >
        <View
          style={[
            styles.boardCanvas,
            { width: canvasW, height: canvasH },
          ]}
        >
          <View
            style={[
              styles.board,
              {
                left: boardPad,
                top: boardPad,
                width: boardW,
                height: boardH,
                backgroundColor: "transparent",
                borderColor: colors.border,
                borderWidth: level.isSpecialShape ? 0 : 1,
              },
            ]}
            testID="game-board"
          />
          {gridLines}
          {arrows.map((a) => {
            const rotation = a.rotateShake.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: ["-12deg", "0deg", "12deg"],
            });
            const isHinted = hintHighlight === a.id;
            const trace =
              a.status === "broken"
                ? ARROW_GLOW.broken
                : a.status === "escaped"
                ? ARROW_GLOW.escaped
                : isHinted
                ? ARROW_GLOW.hint
                : getNeonTrace(a.colorIndex);
            const hit = pathHitBox(
              a.visualCells,
              cellSize,
              boardPad,
              a.direction
            );
            return (
              <Animated.View
                key={a.id}
                style={[
                  styles.arrowPathWrap,
                  {
                    left: hit.left,
                    top: hit.top,
                    width: hit.width,
                    height: hit.height,
                    transform: [{ rotate: rotation }],
                    opacity: a.fade,
                    pointerEvents: "none",
                  },
                ]}
              >
                <NeonPathArrow
                  cells={a.visualCells}
                  direction={a.direction}
                  cellSize={cellSize}
                  boardPad={boardPad}
                  color={trace.color}
                  glow={trace.glow}
                  dimmed={a.status === "escaped" || a.status === "broken"}
                />
              </Animated.View>
            );
          })}
          {/* Full grid-cell tap targets (easier than tapping thin arrow strokes) */}
          {cellTapTargets.map(({ row, col, arrowId }) => (
            <Pressable
              key={`tap-${row}-${col}`}
              testID={`cell-${row}-${col}`}
              accessibilityLabel="Arrow cell"
              onPress={() => fireArrowById(arrowId)}
              disabled={status !== "playing"}
              style={[
                styles.cellTap,
                {
                  left: boardPad + col * cellSize,
                  top: boardPad + row * cellSize,
                  width: cellSize,
                  height: cellSize,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Action bar - hint + skip */}
      <View style={styles.actionBar}>
        <Pressable
          testID="game-hint-btn"
          onPress={onHint}
          disabled={status !== "playing"}
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
  boardWrap: { alignItems: "center", justifyContent: "center", flex: 1, overflow: "visible" },
  boardCanvas: {
    position: "relative",
    overflow: "visible",
  },
  board: {
    position: "absolute",
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  gridLine: { position: "absolute", opacity: 0.35 },
  gridPad: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.25,
  },
  arrowPathWrap: {
    position: "absolute",
    overflow: "visible",
  },
  cellTap: {
    position: "absolute",
    backgroundColor: "transparent",
    zIndex: 10,
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
