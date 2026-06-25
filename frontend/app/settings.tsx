import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { AppPressable as Pressable } from "../src/components/AppPressable";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../src/SettingsContext";
import { resetProgress } from "../src/storage";
import { RADIUS, SPACING } from "../src/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, setSetting, colors, haptic } = useSettings();
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const onReset = async () => {
    haptic("warning");
    if (typeof window !== "undefined" && window.confirm) {
      if (!window.confirm("Reset all level progress? This cannot be undone.")) return;
    } else {
      // mobile native confirm
      const ok: boolean = await new Promise((resolve) => {
        Alert.alert(
          "Reset progress?",
          "This will erase all level progress and stars.",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Reset", style: "destructive", onPress: () => resolve(true) },
          ]
        );
      });
      if (!ok) return;
    }
    await resetProgress();
    setResetMsg("Progress reset.");
    setTimeout(() => setResetMsg(null), 2000);
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: insets.top + SPACING.sm },
      ]}
      testID="settings-screen"
    >
      <View style={styles.header}>
        <Pressable
          testID="settings-back-btn"
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>SETTINGS</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACING.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Audio & Feedback" colors={colors}>
          <ToggleRow
            colors={colors}
            label="Sound effects"
            description="Play tones on taps & wins"
            value={settings.sound}
            onChange={(v) => {
              setSetting("sound", v);
              if (v) haptic("selection");
            }}
            testID="setting-sound"
          />
          <ToggleRow
            colors={colors}
            label="Vibration"
            description="Off to disable all vibrations and haptic feedback"
            value={settings.haptics}
            onChange={(v) => {
              setSetting("haptics", v);
              if (v) haptic("selection");
            }}
            testID="setting-vibration"
          />
        </Section>

        <Section title="Theme" colors={colors}>
          <View style={styles.themeRow}>
            {(["cyan", "magenta", "green"] as const).map((t) => {
              const palette =
                t === "cyan" ? "#00f0ff" : t === "magenta" ? "#ff2bd6" : "#39ff88";
              const active = settings.theme === t;
              return (
                <Pressable
                  key={t}
                  testID={`theme-${t}`}
                  onPress={() => {
                    setSetting("theme", t);
                    haptic("selection");
                  }}
                  style={({ pressed }) => [
                    styles.themeChip,
                    {
                      backgroundColor: colors.surface,
                      borderColor: active ? palette : colors.border,
                      shadowColor: active ? palette : "transparent",
                      ...(pressed ? { transform: [{ scale: 0.97 }] } : {}),
                    },
                  ]}
                >
                  <View
                    style={[styles.themeDot, { backgroundColor: palette }]}
                  />
                  <Text style={[styles.themeLabel, { color: colors.text }]}>
                    {t.toUpperCase()}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark-circle" size={14} color={palette} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Motion" colors={colors}>
          <ToggleRow
            colors={colors}
            label="Reduce motion"
            description="Disable title glow & shake animations"
            value={settings.reducedMotion}
            onChange={(v) => setSetting("reducedMotion", v)}
            testID="setting-reduced-motion"
          />
        </Section>

        <Section title="Data" colors={colors}>
          <Pressable
            testID="settings-reset-btn"
            onPress={onReset}
            style={({ pressed }) => [
              styles.dangerBtn,
              {
                borderColor: colors.red,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.red} />
            <Text style={[styles.dangerLabel, { color: colors.red }]}>
              Reset all progress
            </Text>
          </Pressable>
          {resetMsg && (
            <Text style={[styles.resetMsg, { color: colors.green }]}>{resetMsg}</Text>
          )}
        </Section>

        <Section title="Quick links" colors={colors}>
          <LinkRow
            colors={colors}
            label="Accessibility"
            icon="accessibility-outline"
            onPress={() => {
              haptic("selection");
              router.push("/accessibility");
            }}
            testID="settings-accessibility-link"
          />
          <LinkRow
            colors={colors}
            label="Store"
            icon="bag-outline"
            onPress={() => {
              haptic("selection");
              router.push("/store");
            }}
            testID="settings-store-link"
          />
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useSettings>["colors"];
}) {
  return (
    <View style={{ marginBottom: SPACING.lg }}>
      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {title.toUpperCase()}
      </Text>
      <View
        style={[
          styles.sectionBody,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
  colors,
  testID,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  colors: ReturnType<typeof useSettings>["colors"];
  testID?: string;
}) {
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        thumbColor={value ? colors.cyan : "#888"}
        trackColor={{ true: colors.cyanGlow, false: "#222" }}
      />
    </View>
  );
}

function LinkRow({
  label,
  icon,
  onPress,
  colors,
  testID,
}: {
  label: string;
  icon: any;
  onPress: () => void;
  colors: ReturnType<typeof useSettings>["colors"];
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.cyan} style={{ marginRight: 12 }} />
      <Text style={[styles.rowLabel, { color: colors.text, flex: 1 }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SPACING.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 4 },
  content: { paddingTop: SPACING.sm },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
    marginBottom: SPACING.sm,
    paddingHorizontal: 4,
  },
  sectionBody: { borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 14, fontWeight: "600" },
  rowDesc: { fontSize: 12, marginTop: 2 },
  themeRow: { flexDirection: "row", padding: SPACING.md, gap: SPACING.sm },
  themeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  themeDot: { width: 12, height: 12, borderRadius: 6 },
  themeLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: SPACING.md,
    paddingVertical: 14,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
  },
  dangerLabel: { fontSize: 13, fontWeight: "800", letterSpacing: 2 },
  resetMsg: {
    textAlign: "center",
    fontSize: 12,
    marginTop: -SPACING.sm,
    marginBottom: SPACING.sm,
    fontWeight: "700",
  },
});
