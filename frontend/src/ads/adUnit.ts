import { Platform } from "react-native";
import Constants from "expo-constants";

type Extra = {
  EXPO_PUBLIC_USE_TEST_AD_UNITS?: string | boolean;
  EXPO_PUBLIC_ANDROID_INTERSTITIAL_AD_UNIT_ID?: string;
  EXPO_PUBLIC_IOS_INTERSTITIAL_AD_UNIT_ID?: string;
};

function extra(): Extra {
  return (Constants.expoConfig?.extra ?? {}) as Extra;
}

function shouldUseGoogleTestUnits(): boolean {
  const e = extra();
  if (__DEV__) return true;
  if (e.EXPO_PUBLIC_USE_TEST_AD_UNITS === false || e.EXPO_PUBLIC_USE_TEST_AD_UNITS === "false") {
    return false;
  }
  if (e.EXPO_PUBLIC_USE_TEST_AD_UNITS === true || e.EXPO_PUBLIC_USE_TEST_AD_UNITS === "true") {
    return true;
  }
  const platformId =
    Platform.OS === "ios"
      ? e.EXPO_PUBLIC_IOS_INTERSTITIAL_AD_UNIT_ID
      : e.EXPO_PUBLIC_ANDROID_INTERSTITIAL_AD_UNIT_ID;
  return !platformId?.trim();
}

/** Resolves interstitial unit id; prefers Google's TestIds in dev or when real IDs are unset. */
export function getInterstitialUnitId(TestIds: {
  INTERSTITIAL: string;
}): string {
  if (shouldUseGoogleTestUnits()) {
    return TestIds.INTERSTITIAL;
  }
  const e = extra();
  const id =
    Platform.OS === "ios"
      ? e.EXPO_PUBLIC_IOS_INTERSTITIAL_AD_UNIT_ID
      : e.EXPO_PUBLIC_ANDROID_INTERSTITIAL_AD_UNIT_ID;
  return id?.trim() || TestIds.INTERSTITIAL;
}
