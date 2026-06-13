import { Platform } from "react-native";
import { shouldUseNativeAds } from "./nativeGate";

let initOnce: Promise<void> | null = null;

/**
 * UMP (EEA/UK) → iOS ATT → Mobile Ads SDK init.
 * Skips in Expo Go / web. Safe to call multiple times.
 */
export function initializeConsentAndAds(): Promise<void> {
  if (!shouldUseNativeAds()) return Promise.resolve();
  if (!initOnce) {
    initOnce = runInit();
  }
  return initOnce;
}

async function runInit(): Promise<void> {
  try {
    const { AdsConsent, AdsConsentStatus } = await import(
      "react-native-google-mobile-ads"
    );
    const info = await AdsConsent.requestInfoUpdate();
    if (info.status === AdsConsentStatus.REQUIRED) {
      await AdsConsent.showForm();
    }
  } catch {
    // Older SDK shapes / simulator — continue without blocking the app
  }

  if (Platform.OS === "ios") {
    try {
      const tt = await import("expo-tracking-transparency");
      await tt.requestTrackingPermissionsAsync();
    } catch {
      // Optional
    }
  }

  try {
    const mobileAds = (await import("react-native-google-mobile-ads")).default;
    await mobileAds().initialize();
  } catch {
    // Native module unavailable until a dev/production build is installed
  }
}
