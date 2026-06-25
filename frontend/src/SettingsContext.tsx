import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { loadSettings, saveSettings, Settings } from "./storage";
import { getColors } from "./theme";

type Ctx = {
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  colors: ReturnType<typeof getColors>;
  haptic: (kind: "light" | "medium" | "success" | "warning" | "error" | "selection") => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({
  children,
  initialSettings,
}: {
  children: ReactNode;
  initialSettings?: Settings;
}) {
  const [settings, setSettings] = useState<Settings>(
    initialSettings ?? {
      sound: true,
      haptics: true,
      reducedMotion: false,
      theme: "cyan",
      largeArrows: false,
      highContrast: false,
      colorBlindSafe: false,
    }
  );

  useEffect(() => {
    if (initialSettings) return;
    loadSettings()
      .then((s) => setSettings(s))
      .catch(() => {});
  }, [initialSettings]);

  const setSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        saveSettings(next).catch(() => {});
        return next;
      });
    },
    []
  );

  const colors = getColors({
    variant: settings.theme,
    highContrast: settings.highContrast,
    colorBlindSafe: settings.colorBlindSafe,
  });

  const haptic = useCallback(
    (kind: "light" | "medium" | "success" | "warning" | "error" | "selection") => {
      if (!settings.haptics) return;
      try {
        switch (kind) {
          case "light":
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case "medium":
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case "success":
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case "warning":
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          case "error":
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
          case "selection":
            Haptics.selectionAsync();
            break;
        }
      } catch {
        // ignore
      }
    },
    [settings.haptics]
  );

  return (
    <SettingsContext.Provider value={{ settings, setSetting, colors, haptic }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be inside SettingsProvider");
  return ctx;
}
