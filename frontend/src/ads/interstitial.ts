import { shouldUseNativeAds } from "./nativeGate";
import { getInterstitialUnitId } from "./adUnit";
import { showMockInterstitialAd } from "./mockInterstitialBridge";

const SHOW_TIMEOUT_MS = 25000;

/**
 * Loads (if needed) and shows one interstitial; resolves when dismissed or on error/timeout.
 * In Expo Go / web, shows the mocked "Test Ad" interstitial instead.
 */
export async function presentInterstitialAd(): Promise<void> {
  if (!shouldUseNativeAds()) {
    await showMockInterstitialAd();
    return;
  }

  try {
    const { InterstitialAd, AdEventType, TestIds } = await import(
      "react-native-google-mobile-ads"
    );
    const unitId = getInterstitialUnitId(TestIds);
    const interstitial = InterstitialAd.createForAdRequest(unitId);

    await new Promise<void>((resolve) => {
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        resolve();
      };

      const timeout = setTimeout(done, SHOW_TIMEOUT_MS);

      const unsubs: (() => void)[] = [];

      unsubs.push(
        interstitial.addAdEventListener(AdEventType.LOADED, () => {
          interstitial.show().catch(done);
        })
      );

      unsubs.push(
        interstitial.addAdEventListener(AdEventType.CLOSED, () => {
          clearTimeout(timeout);
          unsubs.forEach((u) => u());
          done();
        })
      );

      unsubs.push(
        interstitial.addAdEventListener(AdEventType.ERROR, () => {
          clearTimeout(timeout);
          unsubs.forEach((u) => u());
          done();
        })
      );

      interstitial.load();
    });
  } catch {
    // Package not linked (e.g. forgot npm install) — don't block gameplay
  }
}
