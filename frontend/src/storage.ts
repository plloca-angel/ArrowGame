import AsyncStorage from "@react-native-async-storage/async-storage";

const PROGRESS_KEY = "arrow_escape_progress_v2";
const SETTINGS_KEY = "arrow_escape_settings_v1";
const ENTITLEMENTS_KEY = "arrow_escape_entitlements_v1";
const DEVICE_KEY = "arrow_escape_device_id_v1";

// ---------- Progress ----------
export type Progress = {
  currentLevel: number; // next level to play (infinite)
  completedCount: number;
  totalStars: number;
  bestByLevel: Record<number, { stars: number; bestMoves: number }>;
};

const newProgress = (): Progress => ({
  currentLevel: 1,
  completedCount: 0,
  totalStars: 0,
  bestByLevel: {},
});

export async function loadProgress(): Promise<Progress> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) return newProgress();
    return { ...newProgress(), ...JSON.parse(raw) };
  } catch {
    return newProgress();
  }
}

export async function saveProgress(p: Progress) {
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
}

export async function recordWin(
  levelId: number,
  moves: number,
  arrowCount: number
): Promise<Progress> {
  const p = await loadProgress();
  const stars =
    moves === arrowCount
      ? 3
      : moves <= Math.ceil(arrowCount * 1.15)
      ? 2
      : 1;
  const prev = p.bestByLevel[levelId];
  const nextStars = Math.max(prev?.stars ?? 0, stars);
  const nextMoves = prev ? Math.min(prev.bestMoves, moves) : moves;
  const wasNew = !prev;
  p.bestByLevel[levelId] = { stars: nextStars, bestMoves: nextMoves };
  if (wasNew) p.completedCount += 1;
  p.totalStars = Object.values(p.bestByLevel).reduce(
    (s, c) => s + c.stars,
    0
  );
  if (levelId >= p.currentLevel) p.currentLevel = levelId + 1;
  await saveProgress(p);
  return p;
}

export async function skipLevel(levelId: number): Promise<Progress> {
  const p = await loadProgress();
  if (levelId >= p.currentLevel) p.currentLevel = levelId + 1;
  await saveProgress(p);
  return p;
}

export async function resetProgress(): Promise<Progress> {
  await AsyncStorage.removeItem(PROGRESS_KEY);
  return newProgress();
}

// ---------- Settings ----------
export type Settings = {
  sound: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  // Theme variant
  theme: "cyan" | "magenta" | "green";
  // Accessibility
  largeArrows: boolean;
  highContrast: boolean;
  colorBlindSafe: boolean;
};

const defaultSettings = (): Settings => ({
  sound: true,
  haptics: true,
  reducedMotion: false,
  theme: "cyan",
  largeArrows: false,
  highContrast: false,
  colorBlindSafe: false,
});

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(s: Settings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ---------- Entitlements (purchases) ----------
export type Entitlements = {
  removeAds: boolean;
  hintCredits: number;
  // session ids that have already been granted (idempotency on the client)
  grantedSessions: string[];
};

const defaultEntitlements = (): Entitlements => ({
  removeAds: false,
  hintCredits: 0,
  grantedSessions: [],
});

export async function loadEntitlements(): Promise<Entitlements> {
  try {
    const raw = await AsyncStorage.getItem(ENTITLEMENTS_KEY);
    if (!raw) return defaultEntitlements();
    return { ...defaultEntitlements(), ...JSON.parse(raw) };
  } catch {
    return defaultEntitlements();
  }
}

export async function saveEntitlements(e: Entitlements) {
  await AsyncStorage.setItem(ENTITLEMENTS_KEY, JSON.stringify(e));
}

export async function grantPurchase(
  sessionId: string,
  productId: string
): Promise<Entitlements> {
  const e = await loadEntitlements();
  if (e.grantedSessions.includes(sessionId)) return e; // idempotent
  if (productId === "remove_ads") e.removeAds = true;
  if (productId === "hint_pack_10") e.hintCredits += 10;
  e.grantedSessions.push(sessionId);
  await saveEntitlements(e);
  return e;
}

export async function consumeHint(): Promise<Entitlements> {
  const e = await loadEntitlements();
  if (e.hintCredits > 0) {
    e.hintCredits -= 1;
    await saveEntitlements(e);
  }
  return e;
}

// ---------- Device ID ----------
export async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_KEY);
  if (!id) {
    id =
      "dev_" +
      Math.random().toString(36).slice(2, 10) +
      Date.now().toString(36);
    await AsyncStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}
