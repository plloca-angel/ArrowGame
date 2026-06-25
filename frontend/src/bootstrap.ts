import { loadProgress, loadSettings, Settings } from "./storage";
import { hydrateLevelCache, warmLevel } from "./levels";
import { getDailyChallengeLevelId } from "./dailyChallenge";

export type BootstrapResult = {
  settings: Settings;
};

const MIN_SPLASH_MS = 900;

export async function runAppBootstrap(): Promise<BootstrapResult> {
  const [settings] = await Promise.all([
    loadSettings(),
    loadProgress(),
    hydrateLevelCache(),
  ]);

  setTimeout(() => {
    try {
      warmLevel(getDailyChallengeLevelId());
    } catch {
      // non-critical prefetch
    }
  }, 200);

  return { settings };
}

export function waitForMinSplash(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
  return new Promise((resolve) => setTimeout(resolve, remaining));
}
