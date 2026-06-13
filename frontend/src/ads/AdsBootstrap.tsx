import { useEffect } from "react";
import { initializeConsentAndAds } from "./initAds";

/** Mount once under the app root to run UMP + ATT + Mobile Ads SDK init. */
export function AdsBootstrap() {
  useEffect(() => {
    initializeConsentAndAds().catch(() => {});
  }, []);
  return null;
}
