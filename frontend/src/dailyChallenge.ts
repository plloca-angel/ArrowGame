/** Base id for daily puzzles — far outside campaign / prebuilt ranges. */
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

/** Same level id for all users on a given UTC day. */
export function getDailyChallengeLevelId(date = new Date()): number {
  let offset = hashDateKey(getUtcDateKey(date)) % 999_990;
  // Skip special-shape ids (multiples of 5) so daily loads stay fast.
  while (offset % 5 === 0) offset += 1;
  return DAILY_LEVEL_BASE + offset;
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
