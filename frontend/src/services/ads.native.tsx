import { ReactNode, useEffect, useState } from "react";
import { shouldUseNativeAds } from "../ads/nativeGate";
import {
  AdsProvider as MockAdsProvider,
  useAds,
  ADS_BACKEND,
} from "./ads.mock";

export function AdsProvider({ children }: { children: ReactNode }) {
  if (!shouldUseNativeAds()) {
    return <MockAdsProvider>{children}</MockAdsProvider>;
  }
  return <DeferredRealAdsProvider>{children}</DeferredRealAdsProvider>;
}

function DeferredRealAdsProvider({ children }: { children: ReactNode }) {
  const [Real, setReal] = useState<typeof MockAdsProvider | null>(null);

  useEffect(() => {
    import("./ads.real")
      .then((m) => setReal(() => m.AdsProvider))
      .catch(() => {});
  }, []);

  if (!Real) {
    return <MockAdsProvider>{children}</MockAdsProvider>;
  }
  return <Real>{children}</Real>;
}

export { useAds, ADS_BACKEND };
