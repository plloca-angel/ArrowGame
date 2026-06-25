import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import mobileAds, {
  InterstitialAd,
  AdEventType,
  TestIds,
} from "react-native-google-mobile-ads";
import { loadEntitlements } from "../storage";

const REAL_INTERSTITIAL_AD_UNIT_ID = Platform.select({
  ios: process.env.EXPO_PUBLIC_IOS_INTERSTITIAL_AD_UNIT_ID,
  android: process.env.EXPO_PUBLIC_ANDROID_INTERSTITIAL_AD_UNIT_ID,
});

const adUnitId =
  __DEV__ || !REAL_INTERSTITIAL_AD_UNIT_ID
    ? TestIds.INTERSTITIAL
    : REAL_INTERSTITIAL_AD_UNIT_ID;

type AdsCtx = {
  showInterstitial: () => Promise<void>;
  isLoaded: boolean;
};

const Ctx = createContext<AdsCtx | null>(null);

export function AdsProvider({ children }: { children: ReactNode }) {
  const interstitialRef = useRef<InterstitialAd | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const removeAdsRef = useRef(false);

  useEffect(() => {
    loadEntitlements().then((e) => {
      removeAdsRef.current = e.removeAds;
    });
  }, []);

  useEffect(() => {
    mobileAds()
      .initialize()
      .catch(() => {});
  }, []);

  const loadNew = () => {
    const ad = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });
    interstitialRef.current = ad;
    setIsLoaded(false);
    const subLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      setIsLoaded(true);
    });
    const subError = ad.addAdEventListener(AdEventType.ERROR, () => {
      setIsLoaded(false);
    });
    ad.load();
    return () => {
      subLoaded();
      subError();
    };
  };

  useEffect(() => {
    const cleanup = loadNew();
    return cleanup;
  }, []);

  const showInterstitial = () =>
    new Promise<void>((resolve) => {
      if (removeAdsRef.current) {
        resolve();
        return;
      }
      const ad = interstitialRef.current;
      if (!ad || !isLoaded) {
        resolve();
        loadNew();
        return;
      }
      const closedSub = ad.addAdEventListener(AdEventType.CLOSED, () => {
        closedSub();
        resolve();
        loadNew();
      });
      ad.show().catch(() => {
        closedSub();
        resolve();
        loadNew();
      });
    });

  return (
    <Ctx.Provider value={{ showInterstitial, isLoaded }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAds() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAds must be used within AdsProvider");
  return ctx;
}

export const ADS_BACKEND = "admob" as "mocked" | "admob";
