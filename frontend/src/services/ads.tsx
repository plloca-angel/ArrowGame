// Ads service - WEB / Expo Go fallback (mocked interstitial via modal).
// The native build uses ./ads.native.ts which loads real AdMob interstitials.
// Metro auto-picks the .native.ts file on iOS/Android builds.

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { InterstitialAd as MockedInterstitial } from "../InterstitialAd";

type AdsCtx = {
  showInterstitial: () => Promise<void>;
  isLoaded: boolean;
};

const Ctx = createContext<AdsCtx | null>(null);

export function AdsProvider({ children }: { children: ReactNode }) {
  const [resolver, setResolver] = useState<(() => void) | null>(null);
  const [visible, setVisible] = useState(false);

  const showInterstitial = () =>
    new Promise<void>((resolve) => {
      setResolver(() => resolve);
      setVisible(true);
    });

  const onClose = () => {
    setVisible(false);
    if (resolver) {
      resolver();
      setResolver(null);
    }
  };

  return (
    <Ctx.Provider value={{ showInterstitial, isLoaded: true }}>
      {children}
      <MockedInterstitial visible={visible} onClose={onClose} />
    </Ctx.Provider>
  );
}

export function useAds() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAds must be used within AdsProvider");
  return ctx;
}

// Identify the runtime in the rest of the app
export const ADS_BACKEND = "mocked" as "mocked" | "admob";
