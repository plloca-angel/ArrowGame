import { PREBUILT_MAX_LEVEL } from "./prebuiltChunks";

/** Legacy base — daily puzzles now map into the prebuilt campaign pool. */
export const DAILY_LEVEL_BASE = 9_000_001;

/** UTC date key shared by every player (YYYY-MM-DD). */
export function getUtcDateKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hashDateKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Same prebuilt level for all users on a given UTC day (instant chunk load —
 * no live generation on the JS thread).
 */
export function getDailyChallengeLevelId(date = new Date()): number {
  let slot = hashDateKey(getUtcDateKey(date)) % PREBUILT_MAX_LEVEL;
  let id = slot + 1;
  // Skip special-shape ids (multiples of 5) — slightly faster boards, no shape mask.
  while (id % 5 === 0) id += 1;
  if (id > PREBUILT_MAX_LEVEL) id = 1;
  return id;
}

export function formatDailyDateLabel(date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDailyTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
