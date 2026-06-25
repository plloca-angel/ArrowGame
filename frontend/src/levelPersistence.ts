import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Level } from "./levelModel";

const MAX_PERSISTED = 50;

function storageKey(cacheVersion: number): string {
  return `arrow_escape_generated_levels_v${cacheVersion}`;
}

/** Load device-persisted levels (beyond prebuilt range) into memory. */
export async function hydratePersistedLevels(
  cacheVersion: number,
  prebuiltMax: number
): Promise<Map<number, Level>> {
  const map = new Map<number, Level>();
  try {
    const raw = await AsyncStorage.getItem(storageKey(cacheVersion));
    if (!raw) return map;
    const data = JSON.parse(raw) as Record<string, Level>;
    for (const [k, level] of Object.entries(data)) {
      const id = Number(k);
      if (id > prebuiltMax && level?.id === id) {
        map.set(id, level);
      }
    }
  } catch {
    // corrupt cache — ignore and regenerate on demand
  }
  return map;
}

/** Persist a live-generated level so the next session skips regeneration. */
export async function persistGeneratedLevel(
  cacheVersion: number,
  prebuiltMax: number,
  id: number,
  level: Level
): Promise<void> {
  if (id <= prebuiltMax) return;
  try {
    const key = storageKey(cacheVersion);
    const raw = await AsyncStorage.getItem(key);
    const data: Record<string, Level> = raw ? JSON.parse(raw) : {};
    data[String(id)] = level;
    const ids = Object.keys(data)
      .map(Number)
      .filter((n) => n > prebuiltMax)
      .sort((a, b) => b - a);
    while (ids.length > MAX_PERSISTED) {
      const drop = ids.pop();
      if (drop !== undefined) delete data[String(drop)];
    }
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch {
    // non-critical — session cache still holds the level
  }
}
