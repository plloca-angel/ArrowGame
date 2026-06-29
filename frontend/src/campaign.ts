import { PREBUILT_MAX_LEVEL } from "./prebuiltChunks";
import type { Progress } from "./storage";

/** Last playable campaign level (matches prebuilt content). */
export const MAX_CAMPAIGN_LEVEL = PREBUILT_MAX_LEVEL;

export function clampCampaignLevel(levelId: number): number {
  return Math.max(1, Math.min(levelId, MAX_CAMPAIGN_LEVEL));
}

export function isBeyondCampaign(levelId: number): boolean {
  return levelId > MAX_CAMPAIGN_LEVEL;
}

/** True once the player has cleared level 600 and has nothing left to continue. */
export function hasFinishedCampaign(p: Progress): boolean {
  return p.currentLevel > MAX_CAMPAIGN_LEVEL;
}

/** Level number to show in UI (never above the cap). */
export function displayCampaignLevel(p: Progress): number {
  return clampCampaignLevel(p.currentLevel);
}

export function nextCampaignLevelAfter(levelId: number): number {
  return Math.min(levelId + 1, MAX_CAMPAIGN_LEVEL + 1);
}
