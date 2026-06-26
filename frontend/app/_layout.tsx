import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SettingsProvider } from "../src/SettingsContext";
import { ErrorBoundary } from "../src/ErrorBoundary";
import { AdsProvider } from "../src/services/ads";
import { AdsBootstrap } from "../src/ads/AdsBootstrap";
import { AppLoadingScreen } from "../src/components/AppLoadingScreen";
import { runAppBootstrap, waitForMinSplash } from "../src/bootstrap";
import type { Settings } from "../src/storage";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [initialSettings, setInitialSettings] = useState<Settings | null>(null);

  // Reveal our dark loading UI immediately — don't sit on Expo Go's white splash.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    runAppBootstrap()
      .then(async (result) => {
        if (cancelled) return;
        setInitialSettings(result.settings);
        await waitForMinSplash(startedAt);
        if (cancelled) return;
        setReady(true);
      })
      .catch(async () => {
        if (cancelled) return;
        setInitialSettings({
          sound: true,
          haptics: true,
          reducedMotion: false,
          theme: "cyan",
          largeArrows: false,
          highContrast: false,
          colorBlindSafe: false,
        });
        await waitForMinSplash(startedAt);
        if (cancelled) return;
        setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const content =
    !ready || !initialSettings ? (
      <AppLoadingScreen />
    ) : (
      <SettingsProvider initialSettings={initialSettings}>
        <AdsProvider>
          <AdsBootstrap />
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#05060a" },
              animation: "none",
            }}
          />
        </AdsProvider>
      </SettingsProvider>
    );

  return (
    <View style={styles.root}>
      <ErrorBoundary>
        <SafeAreaProvider>{content}</SafeAreaProvider>
      </ErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#05060a" },
});
