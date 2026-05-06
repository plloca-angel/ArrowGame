import AsyncStorage from "@react-native-async-storage/async-storage";

const PROGRESS_KEY = "arrow_escape_progress_v1";

export type Progress = {
  highestUnlocked: number; // highest level unlocked (1-based)
  completed: Record<number, { stars: number; bestMoves: number }>; // levelId -> stats
};

const DEFAULT_PROGRESS = (): Progress => ({
  highestUnlocked: 1,
  completed: {},
});

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) return DEFAULT_PROGRESS();
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PROGRESS(), ...parsed };
  } catch {
    return DEFAULT_PROGRESS();
  }
}

export async function saveProgress(p: Progress): Promise<void> {
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
}

export async function recordWin(
  levelId: number,
  moves: number,
  arrowCount: number
): Promise<Progress> {
  const p = await loadProgress();
  // Stars: 3 if moves == arrowCount (perfect), 2 if <= arrowCount+1, else 1
  const stars =
    moves === arrowCount ? 3 : moves <= arrowCount + 1 ? 2 : 1;
  const prev = p.completed[levelId];
  const nextStars = Math.max(prev?.stars ?? 0, stars);
  const nextBest = prev ? Math.min(prev.bestMoves, moves) : moves;
  p.completed[levelId] = { stars: nextStars, bestMoves: nextBest };
  p.highestUnlocked = Math.max(p.highestUnlocked, levelId + 1);
  await saveProgress(p);
  return p;
}

export async function resetProgress(): Promise<Progress> {
  await AsyncStorage.removeItem(PROGRESS_KEY);
  return DEFAULT_PROGRESS();
}
