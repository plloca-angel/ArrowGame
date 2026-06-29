import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
  Platform,
  Pressable as CellPressable,
} from "react-native";
import { AppPressable as Pressable } from "../src/components/AppPressable";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../src/SettingsContext";
import {
  Direction,
  Level,
  GridCell,
  cellKey,
  getLevelActiveCellSet,
} from "../src/levelModel";
import {
  recordWin,
  loadEntitlements,
  consumeHint,
  skipLevel,
  recordDailyWin,
  Entitlements,
} from "../src/storage";
import {
  formatDailyDateLabel,
  getDailyChallengeLevelId,
} from "../src/dailyChallenge";
import { RADIUS, SPACING } from "../src/theme";
import { AdBanner } from "../src/AdBanner";
import { presentInterstitialAd } from "../src/ads/interstitial";
import { NeonPathArrow, getNeonTrace, pathHitBox } from "../src/components/NeonPathArrow";
import {
  MovingArrowSprite,
  type SlideSpec,
} from "../src/components/MovingArrowSprite";
import {
  buildMovementTrack,
} from "../src/arrowMotion";
import {
  findSafeEscapeFromStates,
  isArrowBoardSolvable,
  levelHasMisleadingMoves,
} from "../src/levelSolvability";
import { computeLiveFlight, toLiveArrow } from "../src/gameBoard";
import {
  getPlayLevelSync,
  primePlayLevel,
  resolvePlayLevel,
  warmChunkForLevel,
} from "../src/levelPreload";

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

type GameStatus = "playing" | "won" | "stuck";

const STEP_MS = 135;

function runTrackedAnimation(
  trackAnimation: (anim: Animated.CompositeAnimation) => Animated.CompositeAnimation,
  anim: Animated.CompositeAnimation,
  timeoutMs: number
): Promise<void> {
  return Promise.race([
    new Promise<void>((resolve) => {
      trackAnimation(anim).start(() => resolve());
    }),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

const ARROW_GLOW = {
  hint: { color: "#f8ff5c", glow: "rgba(248, 255, 92, 0.55)" },
  broken: { color: "#ff3a5e", glow: "rgba(255, 58, 94, 0.55)" },
  escaped: { color: "#39ff88", glow: "rgba(57, 255, 136, 0.45)" },
};

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type BoardArrowViewProps = {
  visualCells: GridCell[];
  direction: Direction;
  status: ArrowStatus;
  colorIndex: number;
  fade: Animated.Value;
  rotateShake: Animated.Value;
  isHinted: boolean;
  cellSize: number;
  boardPad: number;
  colorBlindSafe: boolean;
  largeArrows: boolean;
};

/**
 * One arrow's wrapper + SVG. Memoized so that while a single arrow is sliding,
 * the other (stationary) arrows don't recompute their hit box or reconcile their
 * Animated.View every frame — only the moving arrow, whose visualCells array
 * changes identity each frame, re-renders. This keeps releases smooth even on
 * large boards with many arrows.
 */
const BoardArrowView = memo(function BoardArrowView({
  visualCells,
  direction,
  status,
  colorIndex,
  fade,
  rotateShake,
  isHinted,
  cellSize,
  boardPad,
  colorBlindSafe,
  largeArrows,
}: BoardArrowViewProps) {
  const rotation = rotateShake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-10deg", "0deg", "10deg"],
  });
  const trace =
    status === "broken"
      ? ARROW_GLOW.broken
      : status === "escaped"
      ? ARROW_GLOW.escaped
      : isHinted
      ? ARROW_GLOW.hint
      : getNeonTrace(colorIndex, colorBlindSafe);
  const hit = pathHitBox(visualCells, cellSize, boardPad, direction);

  return (
    <Animated.View
      style={[
        styles.arrowPathWrap,
        {
          left: hit.left,
          top: hit.top,
          width: hit.width,
          height: hit.height,
          transform: [{ rotate: rotation }],
          opacity: fade,
          pointerEvents: "none",
        },
      ]}
    >
      <NeonPathArrow
        cells={visualCells}
        direction={direction}
        cellSize={cellSize}
        boardPad={boardPad}
        color={trace.color}
        glow={trace.glow}
        dimmed={status === "escaped" || status === "broken"}
        largeArrows={largeArrows}
      />
    </Animated.View>
  );
});

type ActiveSlide = SlideSpec & { motionToken: number };

export default function Game() {
  const { level: levelParam, mode: modeParam } = useLocalSearchParams<{
    level?: string;
    mode?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, haptic, settings } = useSettings();

  const isDailyMode = modeParam === "daily";
  const levelId = isDailyMode
    ? getDailyChallengeLevelId()
    : Math.max(1, parseInt(levelParam || "1", 10) || 1);
  const [level, setLevel] = useState<Level | null>(null);
  const levelRef = useRef<Level | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    levelRef.current = level;
    if (!level) {
      levelHasTrapsRef.current = false;
      return;
    }
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      levelHasTrapsRef.current = levelHasMisleadingMoves(level);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [level]);

  useEffect(() => {
    let cancelled = false;
    retryCountRef.current = 0;

    const sync = getPlayLevelSync(levelId);
    if (sync) {
      setLevel(sync);
      warmChunkForLevel(levelId + 1);
      primePlayLevel(levelId + 1);
      return;
    }

    setLevel(null);
    void resolvePlayLevel(levelId).then((loaded) => {
      if (cancelled) return;
      setLevel(loaded);
      warmChunkForLevel(levelId + 1);
      primePlayLevel(levelId + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [levelId]);

  const activeCellSet = useMemo(
    () => (level ? getLevelActiveCellSet(level) : new Set<string>()),
    [level]
  );

  // Board area: size cells from both width and height so the grid stays centered as levels grow
  const [boardSpace, setBoardSpace] = useState({ w: 0, h: 0 });
  const [stableLayout, setStableLayout] = useState<{
    cellSize: number;
    boardPad: number;
  } | null>(null);
  const win = Dimensions.get("window");
  const layoutW =
    boardSpace.w > 0
      ? boardSpace.w
      : Math.min(win.width - SPACING.md * 2, win.width - 32);
  const layoutH =
    boardSpace.h > 0 ? boardSpace.h : Math.max(160, win.height * 0.36);
  const cellFromW = Math.floor(layoutW / ((level?.cols ?? 3) + (level?.isSpecialShape ? 2 : 3)));
  const cellFromH = Math.floor(layoutH / ((level?.rows ?? 3) + (level?.isSpecialShape ? 2 : 3)));
  const arrowScale = settings.largeArrows ? 1.22 : 1;
  const baseMin = level?.isSpecialShape ? 14 : 24;
  const minCell = Math.round(baseMin * arrowScale);
  const cellSize = Math.max(
    minCell,
    Math.floor(Math.min(cellFromW, cellFromH) * arrowScale)
  );
  const boardPad = Math.ceil(cellSize * (level?.isSpecialShape ? 1.6 : 2));
  const boardCellSize = stableLayout?.cellSize ?? cellSize;
  const boardPadLocked = stableLayout?.boardPad ?? boardPad;
  const boardW = boardCellSize * (level?.cols ?? 3);
  const boardH = boardCellSize * (level?.rows ?? 3);
  const canvasW = boardW + boardPadLocked * 2;
  const canvasH = boardH + boardPadLocked * 2;

  const [arrows, setArrows] = useState<ArrowState[]>([]);
  const arrowsRef = useRef<ArrowState[]>([]);
  const [status, setStatus] = useState<GameStatus>("playing");
  const statusRef = useRef<GameStatus>("playing");
  const [moves, setMoves] = useState(0);
  const movesRef = useRef(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedMsRef = useRef(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [ents, setEnts] = useState<Entitlements | null>(null);
  const [hintHighlight, setHintHighlight] = useState<string | null>(null);
  const activeMovesRef = useRef(0);
  const firingIdsRef = useRef<Set<string>>(new Set());
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const levelHasTrapsRef = useRef(false);
  const motionTokenRef = useRef(0);
  const activeAnimationsRef = useRef<Animated.CompositeAnimation[]>([]);
  const slidingIdsRef = useRef<Set<string>>(new Set());
  const slideResolversRef = useRef<Map<string, () => void>>(new Map());
  const [activeSlides, setActiveSlides] = useState<ActiveSlide[]>([]);
  const activeSlidesRef = useRef<ActiveSlide[]>([]);
  /** Hides the static arrow the instant a tap registers, before the slide sprite mounts. */
  const [pendingLaunchIds, setPendingLaunchIds] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    activeSlidesRef.current = activeSlides;
  }, [activeSlides]);

  // Only remeasure when the level (and thus board dimensions) actually changes.
  // Retrying the same level must NOT wipe the locked layout, or arrows flash at
  // the wrong size/position before onLayout re-measures.
  useEffect(() => {
    setStableLayout(null);
    setBoardSpace({ w: 0, h: 0 });
  }, [level?.id]);

  useEffect(() => {
    if (boardSpace.w <= 0 || boardSpace.h <= 0) return;
    // Keep cell size frozen while arrows slide; refit when idle so the grid
    // doesn't overflow after chrome (ads, safe area) settles.
    if (activeSlides.length > 0 || slidingIdsRef.current.size > 0) return;
    // Avoid creating a new object when nothing changed — prevents redundant
    // re-renders (and a subtle jitter) each time a slide finishes.
    setStableLayout((prev) =>
      prev && prev.cellSize === cellSize && prev.boardPad === boardPad
        ? prev
        : { cellSize, boardPad }
    );
  }, [boardSpace, cellSize, boardPad, activeSlides.length]);

  const slidingIdSet = useMemo(() => {
    const ids = new Set(activeSlides.map((s) => s.id));
    for (const id of pendingLaunchIds) ids.add(id);
    return ids;
  }, [activeSlides, pendingLaunchIds]);

  const getMotionToken = useCallback(() => motionTokenRef.current, []);

  const invalidateMotion = () => {
    motionTokenRef.current += 1;
    for (const anim of activeAnimationsRef.current) {
      anim.stop();
    }
    activeAnimationsRef.current = [];
    slidingIdsRef.current.clear();
    for (const resolve of slideResolversRef.current.values()) {
      resolve();
    }
    slideResolversRef.current.clear();
    setActiveSlides([]);
    setPendingLaunchIds(new Set());
    activeMovesRef.current = 0;
    firingIdsRef.current.clear();
  };

  const claimLaunchHide = (arrowId: string) => {
    setPendingLaunchIds((prev) => {
      if (prev.has(arrowId)) return prev;
      const next = new Set(prev);
      next.add(arrowId);
      return next;
    });
  };

  const releaseLaunchHide = (arrowId: string) => {
    setPendingLaunchIds((prev) => {
      if (!prev.has(arrowId)) return prev;
      const next = new Set(prev);
      next.delete(arrowId);
      return next;
    });
  };

  const trackAnimation = (anim: Animated.CompositeAnimation) => {
    activeAnimationsRef.current.push(anim);
    return anim;
  };

  const applyArrowsUpdate = (
    updater: (prev: ArrowState[]) => ArrowState[]
  ): ArrowState[] => {
    // Compute synchronously from the ref (always the latest state) so callers
    // like checkWin see up-to-date statuses immediately, not on the next render.
    const computed = updater(arrowsRef.current);
    arrowsRef.current = computed;
    setArrows(computed);
    return computed;
  };

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
    if (!level) return;
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
    setElapsedMs(0);
    elapsedMsRef.current = 0;
    setHintHighlight(null);
    activeMovesRef.current = 0;
    firingIdsRef.current = new Set();
    invalidateMotion();
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, [level?.id, resetSignal]);

  useEffect(() => {
    if (status !== "playing") return;
    const startedAt = Date.now();
    const id = setInterval(() => {
      const next = Date.now() - startedAt;
      elapsedMsRef.current = next;
      setElapsedMs(next);
    }, 250);
    return () => clearInterval(id);
  }, [status, level?.id, resetSignal]);

  const handleSlideFrame = useCallback(
    (id: string, visual: GridCell[], logical: GridCell[]) => {
      const a = arrowsRef.current.find((x) => x.id === id);
      if (a) {
        a.cells = logical;
        a.visualCells = visual;
      }
    },
    []
  );

  const handleSlideComplete = useCallback(
    (id: string, finalCells: GridCell[], finalVisual: GridCell[]) => {
      slidingIdsRef.current.delete(id);
      setActiveSlides((prev) => prev.filter((s) => s.id !== id));
      // Always merge from arrowsRef — React's `prev` can be stale when several
      // arrows finish quickly and overwrite another arrow's escaped status.
      const next = arrowsRef.current.map((a) =>
        a.id === id
          ? {
              ...a,
              cells: finalCells.map((c) => ({ ...c })),
              visualCells: finalVisual.map((c) => ({ ...c })),
            }
          : a
      );
      arrowsRef.current = next;
      setArrows(next);
      const resolve = slideResolversRef.current.get(id);
      if (resolve) {
        slideResolversRef.current.delete(id);
        resolve();
      }
    },
    []
  );

  const beginArrowSlide = (
    arrowId: string,
    startCells: GridCell[],
    direction: Direction,
    totalSteps: number,
    colorIndex: number,
    reducedMotion: boolean,
    motionToken: number
  ): Promise<void> => {
    if (motionToken !== motionTokenRef.current) {
      releaseLaunchHide(arrowId);
      return Promise.resolve();
    }

    const track = buildMovementTrack(startCells, direction, totalSteps);
    const slideTimeoutMs = Math.max(
      2500,
      (reducedMotion ? 36 : STEP_MS) * Math.max(1, totalSteps) + 800
    );

    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };

      // Fallback: if the native slide never reports completion (dropped frames,
      // unmount race), tear the sprite down ourselves so no arrow stays stranded.
      const timer = setTimeout(() => {
        slidingIdsRef.current.delete(arrowId);
        setActiveSlides((prev) => prev.filter((s) => s.id !== arrowId));
        slideResolversRef.current.delete(arrowId);
        releaseLaunchHide(arrowId);
        finish();
      }, slideTimeoutMs);

      slidingIdsRef.current.add(arrowId);
      slideResolversRef.current.set(arrowId, finish);
      releaseLaunchHide(arrowId);
      setActiveSlides((prev) => [
        ...prev,
        {
          id: arrowId,
          startCells: startCells.map((c) => ({ ...c })),
          direction,
          track,
          totalSteps,
          segmentCount: startCells.length,
          colorIndex,
          stepDurationMs: reducedMotion ? 36 : STEP_MS,
          motionToken,
          cellSize: boardCellSize,
          boardPad: boardPadLocked,
          largeArrows: settings.largeArrows,
        },
      ]);
    });
  };

  // Static per level — avoids re-mounting every cell pressable when one arrow fires.
  const cellTapTargets = useMemo(() => {
    if (!level) return [];
    const targets: {
      row: number;
      col: number;
      arrowId: string;
      direction: Direction;
    }[] = [];
    const seen = new Set<string>();
    level.arrows.forEach((a, idx) => {
      const arrowId = `${level.id}-${idx}`;
      for (const cell of a.cells) {
        const key = cellKey(cell.row, cell.col);
        if (seen.has(key)) continue;
        seen.add(key);
        targets.push({
          row: cell.row,
          col: cell.col,
          arrowId,
          direction: a.direction,
        });
      }
    });
    return targets;
  }, [level?.id]);

  const directionLabel: Record<Direction, string> = {
    up: "up",
    down: "down",
    left: "left",
    right: "right",
  };

  const shakeAnim = async (
    rotateShake: Animated.Value,
    reducedMotion: boolean,
    motionToken: number
  ) => {
    if (reducedMotion || motionToken !== motionTokenRef.current) return;
    rotateShake.setValue(0);
    await runTrackedAnimation(
      trackAnimation,
      Animated.sequence([
        Animated.timing(rotateShake, {
          toValue: 1,
          duration: 55,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rotateShake, {
          toValue: -0.85,
          duration: 65,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rotateShake, {
          toValue: 0.4,
          duration: 55,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rotateShake, {
          toValue: 0,
          duration: 75,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      700
    );
  };

  const triggerGameOver = () => {
    activeMovesRef.current = 0;
    firingIdsRef.current = new Set();
    if (settleTimerRef.current) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
    setStatus("stuck");
    statusRef.current = "stuck";
    haptic("warning");
  };

  const hasActiveAnimation = () =>
    activeMovesRef.current > 0 ||
    activeSlidesRef.current.length > 0 ||
    slidingIdsRef.current.size > 0;

  const checkStuck = (list: ArrowState[]): boolean => {
    if (!levelHasTrapsRef.current) return false;
    const lv = levelRef.current;
    if (!lv) return false;
    if (hasActiveAnimation()) return false;
    if (list.some((a) => a.status === "flying")) return false;
    const remaining = list.filter((a) => a.status === "idle");
    if (remaining.length === 0) return false;
    if (isArrowBoardSolvable(lv, list)) return false;
    triggerGameOver();
    return true;
  };

  const scheduleBoardSettle = () => {
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;
      if (statusRef.current !== "playing") return;
      if (activeMovesRef.current === 0) {
        tryFinalizeBoard();
      }
      if (hasActiveAnimation()) return;
      checkStuck(arrowsRef.current);
    }, 60);
  };

  const fireArrowById = (arrowId: string) => {
    if (statusRef.current !== "playing") return;
    if (firingIdsRef.current.has(arrowId)) return;
    const arrow = arrowsRef.current.find(
      (a) => a.id === arrowId && a.status === "idle"
    );
    if (!arrow) return;
    firingIdsRef.current.add(arrowId);
    claimLaunchHide(arrowId);
    void executeFireArrow(arrow).finally(() => {
      firingIdsRef.current.delete(arrowId);
      releaseLaunchHide(arrowId);
    });
  };

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
      activeMovesRef.current = 0;
      firingIdsRef.current = new Set();
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      setStatus("won");
      statusRef.current = "won";
      if (isDailyMode) {
        recordDailyWin(
          movesRef.current,
          list.length,
          elapsedMsRef.current
        ).catch(() => {});
      } else {
        recordWin(levelId, movesRef.current, list.length).catch(() => {});
      }
    }
  };

  /** Mark one arrow escaped and re-check win (idempotent). */
  const finalizeEscape = (arrowId: string, motionToken: number) => {
    if (statusRef.current !== "playing") return;
    if (motionToken !== motionTokenRef.current) return;
    const updated = applyArrowsUpdate((prev) =>
      prev.map((a) =>
        a.id === arrowId && a.status !== "escaped"
          ? { ...a, status: "escaped" as ArrowStatus }
          : a
      )
    );
    checkWin(updated);
  };

  /**
   * When the board is idle, catch missed win detection — e.g. fast multi-tap
   * races that left the last arrow stuck as invisible "flying" after fade.
   */
  const tryFinalizeBoard = () => {
    if (statusRef.current !== "playing") return;
    if (activeMovesRef.current > 0) return;
    if (activeSlidesRef.current.length > 0) return;
    if (slidingIdsRef.current.size > 0) return;

    let list = arrowsRef.current;
    const flying = list.filter((a) => a.status === "flying");
    const escaped = list.filter((a) => a.status === "escaped").length;

    if (
      flying.length > 0 &&
      escaped + flying.length === list.length &&
      list.length > 0
    ) {
      list = applyArrowsUpdate((prev) =>
        prev.map((a) =>
          a.status === "flying" ? { ...a, status: "escaped" as ArrowStatus } : a
        )
      );
    }

    if (list.length > 0 && list.every((a) => a.status === "escaped")) {
      checkWin(list);
    }
  };

  // Recover from hung slide/fade promises that never resolve (orphaned Animated values).
  useEffect(() => {
    if (status !== "playing") return;
    const id = setInterval(() => {
      if (
        activeMovesRef.current > 0 &&
        activeSlidesRef.current.length === 0 &&
        slidingIdsRef.current.size === 0
      ) {
        activeMovesRef.current = 0;
        firingIdsRef.current.clear();
        tryFinalizeBoard();
        scheduleBoardSettle();
      }
    }, 2000);
    return () => clearInterval(id);
  }, [status, level?.id, resetSignal]);

  const executeFireArrow = async (arrow: ArrowState) => {
    if (statusRef.current !== "playing") return;
    const motionToken = motionTokenRef.current;

    const idx = arrowsRef.current.findIndex(
      (a) => a.id === arrow.id && a.status === "idle"
    );
    if (idx < 0) return;

    const lv = levelRef.current;
    if (!lv) return;

    const idleArrow = arrowsRef.current[idx];
    const startCells = idleArrow.cells.map((c) => ({ ...c }));
    const liveBoard = arrowsRef.current.map(toLiveArrow);
    const flight = computeLiveFlight(
      toLiveArrow(idleArrow),
      liveBoard,
      lv
    );

    const isWrongMove =
      flight.result === "blocked" || flight.result === "collision";

    const claimIdx = arrowsRef.current.findIndex(
      (a) => a.id === arrow.id && a.status === "idle"
    );
    if (claimIdx < 0) return;

    if (isWrongMove) {
      bumpMoves();
      haptic("error");
      activeMovesRef.current += 1;
      setHintHighlight(null);

      const live: ArrowState = {
        ...idleArrow,
        status: "flying",
      };

      try {
        let slidePromise: Promise<void> | null = null;
        if (flight.result === "collision" && flight.steps > 0) {
          slidePromise = beginArrowSlide(
            live.id,
            startCells,
            live.direction,
            flight.steps,
            live.colorIndex,
            settings.reducedMotion,
            motionToken
          );
        } else {
          releaseLaunchHide(live.id);
        }

        applyArrowsUpdate((prev) =>
          prev.map((a, i) => (i === claimIdx ? live : a))
        );

        if (slidePromise) await slidePromise;
        if (motionToken !== motionTokenRef.current) {
          applyArrowsUpdate((prev) =>
            prev.map((a) =>
              a.id === live.id && a.status === "flying"
                ? {
                    ...a,
                    status: "idle" as ArrowStatus,
                    cells: startCells.map((c) => ({ ...c })),
                    visualCells: startCells.map((c) => ({ ...c })),
                  }
                : a
            )
          );
          return;
        }
        await shakeAnim(live.rotateShake, settings.reducedMotion, motionToken);
        if (motionToken !== motionTokenRef.current) {
          applyArrowsUpdate((prev) =>
            prev.map((a) =>
              a.id === live.id && a.status === "flying"
                ? {
                    ...a,
                    status: "idle" as ArrowStatus,
                    cells: startCells.map((c) => ({ ...c })),
                    visualCells: startCells.map((c) => ({ ...c })),
                  }
                : a
            )
          );
          return;
        }
        applyArrowsUpdate((prev) =>
          prev.map((a) =>
            a.id === live.id ? { ...a, status: "broken" as ArrowStatus } : a
          )
        );
        triggerGameOver();
      } finally {
        activeMovesRef.current = Math.max(0, activeMovesRef.current - 1);
        scheduleBoardSettle();
      }
      return;
    }

    bumpMoves();
    haptic("light");
    activeMovesRef.current += 1;
    setHintHighlight(null);

    const live: ArrowState = {
      ...idleArrow,
      status: "flying",
    };

    const slidePromise = beginArrowSlide(
      live.id,
      startCells,
      live.direction,
      flight.steps,
      live.colorIndex,
      settings.reducedMotion,
      motionToken
    );
    applyArrowsUpdate((prev) =>
      prev.map((a, i) => (i === claimIdx ? live : a))
    );

    let escapeNeedsFinalize = true;
    try {
      if (flight.result === "escape") {
        await slidePromise;
        if (
          statusRef.current !== "playing" ||
          motionToken !== motionTokenRef.current
        ) {
          escapeNeedsFinalize = false;
          return;
        }

        haptic("success");
        await runTrackedAnimation(
          trackAnimation,
          Animated.timing(live.fade, {
            toValue: 0,
            duration: settings.reducedMotion ? 80 : 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          settings.reducedMotion ? 200 : 450
        );
        if (
          statusRef.current !== "playing" ||
          motionToken !== motionTokenRef.current
        ) {
          escapeNeedsFinalize = false;
          return;
        }

        finalizeEscape(live.id, motionToken);
        escapeNeedsFinalize = false;
      }
    } catch {
      applyArrowsUpdate((prev) =>
        prev.map((a) => {
          if (a.id !== live.id) return a;
          return {
            ...a,
            status: "idle" as ArrowStatus,
            cells: startCells.map((c) => ({ ...c })),
            visualCells: startCells.map((c) => ({ ...c })),
          };
        })
      );
      escapeNeedsFinalize = false;
    } finally {
      activeMovesRef.current = Math.max(0, activeMovesRef.current - 1);
      if (escapeNeedsFinalize && motionToken === motionTokenRef.current) {
        finalizeEscape(live.id, motionToken);
      }
      scheduleBoardSettle();
    }
  };

  const onRestart = async () => {
    haptic("selection");
    retryCountRef.current += 1;
    try {
      if (!ents?.removeAds && retryCountRef.current % 2 === 0) {
        await presentInterstitialAd();
      }
    } catch {
      // never block restart
    }
    setResetSignal((s) => s + 1);
  };

  const onHome = () => {
    haptic("medium");
    router.replace("/");
  };

  const onNext = async () => {
    const nextId = levelId + 1;
    warmChunkForLevel(nextId);
    primePlayLevel(nextId);
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
      params: { level: String(nextId) },
    });
  };

  const onSkip = async () => {
    const nextId = levelId + 1;
    warmChunkForLevel(nextId);
    primePlayLevel(nextId);
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
      params: { level: String(nextId) },
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
    const lv = levelRef.current;
    if (!lv) return;
    const safeIdx = findSafeEscapeFromStates(lv, arrowsRef.current);
    if (safeIdx === null) {
      haptic("warning");
      return;
    }
    const next = arrowsRef.current.find((a) => a.id === `${levelId}-${safeIdx}`);
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

  const gridLines = useMemo(() => {
    if (!level) return null;
    const lines = [];
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (!activeCellSet.has(cellKey(r, c))) continue;
        lines.push(
          <View
            key={`cell-${r}-${c}`}
            pointerEvents="none"
            style={{
              position: "absolute",
              left: boardPadLocked + c * boardCellSize,
              top: boardPadLocked + r * boardCellSize,
              width: boardCellSize,
              height: boardCellSize,
              borderWidth: 1,
              borderColor: colors.gridTrace,
              backgroundColor: "transparent",
            }}
          />
        );
        lines.push(
          <View
            key={`pad-${r}-${c}`}
            pointerEvents="none"
            style={[
              styles.gridPad,
              {
                backgroundColor: colors.gridPad,
                left: boardPadLocked + c * boardCellSize + boardCellSize / 2 - 2,
                top: boardPadLocked + r * boardCellSize + boardCellSize / 2 - 2,
              },
            ]}
          />
        );
      }
    }
    return lines;
  }, [
    level,
    activeCellSet,
    boardPadLocked,
    boardCellSize,
    colors.gridTrace,
    colors.gridPad,
  ]);

  if (!level) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.bg,
            paddingTop: insets.top + SPACING.sm,
          },
        ]}
        testID="game-loading"
      >
        <View style={styles.header}>
          <Pressable
            testID="game-loading-back-btn"
            onPress={onBack}
            style={styles.iconBtn}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerEyebrow, { color: colors.textMuted }]}>
              {isDailyMode ? "DAILY" : "LEVEL"}
            </Text>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {isDailyMode
                ? formatDailyDateLabel()
                : levelId.toString().padStart(2, "0")}
            </Text>
          </View>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={colors.cyan} />
          <Text style={[styles.loadingLabel, { color: colors.textDim }]}>
            Loading level…
          </Text>
        </View>
      </View>
    );
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
            {isDailyMode ? "DAILY" : level?.isSpecialShape ? "SPECIAL" : "LEVEL"}
          </Text>
          <Text style={[styles.headerTitle, { color: colors.text }]} testID="game-level-id">
            {isDailyMode
              ? formatDailyDateLabel()
              : levelId.toString().padStart(2, "0")}
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
        <View style={[styles.statBlock, styles.statBlockCenter]}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            TIME
          </Text>
          <Text
            style={[styles.statValue, styles.statTimer, { color: colors.magenta }]}
            testID="stat-timer"
          >
            {formatElapsed(elapsedMs)}
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
                left: boardPadLocked,
                top: boardPadLocked,
                width: boardW,
                height: boardH,
                backgroundColor: colors.board,
                borderColor: colors.border,
                borderWidth: level.isSpecialShape ? 0 : 1,
              },
            ]}
            pointerEvents="none"
            testID="game-board"
          />
          {gridLines}
          {arrows.map((a) =>
            slidingIdSet.has(a.id) ? null : (
              <BoardArrowView
                key={a.id}
                visualCells={a.visualCells}
                direction={a.direction}
                status={a.status}
                colorIndex={a.colorIndex}
                fade={a.fade}
                rotateShake={a.rotateShake}
                isHinted={hintHighlight === a.id}
                cellSize={boardCellSize}
                boardPad={boardPadLocked}
                colorBlindSafe={settings.colorBlindSafe}
                largeArrows={settings.largeArrows}
              />
            )
          )}
          {activeSlides.map((slide) => (
            <MovingArrowSprite
              key={slide.id}
              spec={slide}
              motionToken={slide.motionToken}
              getMotionToken={getMotionToken}
              colorBlindSafe={settings.colorBlindSafe}
              onFrame={handleSlideFrame}
              onComplete={handleSlideComplete}
            />
          ))}
          {cellTapTargets.map(({ row, col, arrowId, direction }) => (
            <CellPressable
              key={`tap-${row}-${col}`}
              testID={`cell-${row}-${col}`}
              accessibilityRole="button"
              accessibilityLabel={`Arrow pointing ${directionLabel[direction]}, row ${row + 1} column ${col + 1}`}
              accessibilityHint="Double tap to fire this arrow"
              onPress={() => fireArrowById(arrowId)}
              disabled={status !== "playing"}
              hitSlop={0}
              android_ripple={{ color: "transparent" }}
              style={[
                styles.cellTap,
                {
                  left: boardPadLocked + col * boardCellSize,
                  top: boardPadLocked + row * boardCellSize,
                  width: boardCellSize,
                  height: boardCellSize,
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
          disabled={isDailyMode}
          style={({ pressed }) => [
            styles.actionChip,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: isDailyMode ? 0.35 : pressed ? 0.7 : 1,
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

      {/* Win / Stuck overlay */}
      {status !== "playing" ? (
        <View style={styles.endOverlay}>
          <View
            style={[
              styles.modal,
              {
                backgroundColor: colors.surface,
                borderColor: status === "won" ? colors.cyan : colors.yellow,
                shadowColor: status === "won" ? colors.cyan : colors.yellow,
              },
            ]}
            testID={status === "won" ? "modal-won" : "modal-stuck"}
          >
            <Text
              style={[
                styles.modalEyebrow,
                { color: status === "won" ? colors.cyan : colors.yellow },
              ]}
            >
              {status === "won" ? "ESCAPED" : "LOCKED OUT"}
            </Text>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {status === "won"
                ? isDailyMode
                  ? "Daily Complete"
                  : "Level Clear"
                : "No Way Forward"}
            </Text>
            {status === "stuck" && (
              <Text style={[styles.modalSub, { color: colors.textDim, marginTop: SPACING.sm }]}>
                That arrow could not escape. Restart and try a different order.
              </Text>
            )}
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
              Time: {formatElapsed(elapsedMs)} · Arrows: {level.arrows.length} ·{" "}
              {level.rows}×{level.cols}
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
                  testID={isDailyMode ? "modal-home-btn" : "modal-next-btn"}
                  onPress={isDailyMode ? onHome : onNext}
                  style={[styles.modalBtn, { backgroundColor: colors.cyan }]}
                >
                  <Text style={[styles.modalBtnLabel, { color: "#02141a" }]}>
                    {isDailyMode ? "HOME" : "NEXT"}
                  </Text>
                  <Ionicons
                    name={isDailyMode ? "home" : "arrow-forward"}
                    size={18}
                    color="#02141a"
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SPACING.md },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingLabel: {
    marginTop: SPACING.md,
    fontSize: 14,
    fontWeight: "600",
  },
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
  statBlockCenter: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statLabel: { fontSize: 10, letterSpacing: 3, fontWeight: "700" },
  statValue: { fontSize: 18, fontWeight: "900", marginTop: 2 },
  statTimer: {
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
  },
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
    zIndex: 100,
    // Elevation on every cell stacks Android drop-shadows toward the bottom row.
    ...(Platform.OS === "android" ? { elevation: 0 } : {}),
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
  endOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    elevation: 200,
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
