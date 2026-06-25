let showHandler: (() => Promise<void>) | null = null;

export function registerMockInterstitialHandler(
  handler: (() => Promise<void>) | null
): void {
  showHandler = handler;
}

export async function showMockInterstitialAd(): Promise<void> {
  if (!showHandler) return;
  await showHandler();
}
