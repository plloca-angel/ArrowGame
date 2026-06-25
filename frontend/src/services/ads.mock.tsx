import { createContext, useContext, useState, ReactNode } from "react";
import { View, StyleSheet } from "react-native";
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
      <View style={styles.root}>
        {children}
        <MockedInterstitial visible={visible} onClose={onClose} />
      </View>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export function useAds() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAds must be used within AdsProvider");
  return ctx;
}

export const ADS_BACKEND = "mocked" as "mocked" | "admob";
