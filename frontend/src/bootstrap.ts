import { loadProgress, loadSettings, Settings } from "./storage";

export type BootstrapResult = {
  settings: Settings;
};

const MIN_SPLASH_MS = __DEV__ ? 0 : 300;

/** Hydrate persisted level cache after the UI is idle — never block bootstrap. */
function hydrateLevelsLater(): void {
  setTimeout(() => {
    void import("./levels").then(({ hydrateLevelCache }) => hydrateLevelCache());
  }, 5000);
}

export async function runAppBootstrap(): Promise<BootstrapResult> {
  const settings = await loadSettings();
  // Progress read is cheap; level hydration waits until after first paint.
  void loadProgress().catch(() => {});
  hydrateLevelsLater();
  return { settings };
}

export function waitForMinSplash(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
  return new Promise((resolve) => setTimeout(resolve, remaining));
}
