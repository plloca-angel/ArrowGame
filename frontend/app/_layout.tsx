import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SettingsProvider } from "../src/SettingsContext";
import { ErrorBoundary } from "../src/ErrorBoundary";

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <SettingsProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "#05060a" },
            }}
          />
        </SettingsProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
