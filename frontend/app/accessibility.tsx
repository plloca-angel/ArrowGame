import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../src/SettingsContext";
import { ToggleRow } from "./settings";
import { RADIUS, SPACING } from "../src/theme";

export default function AccessibilityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, setSetting, colors, haptic } = useSettings();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: insets.top + SPACING.sm },
      ]}
      testID="accessibility-screen"
    >
      <View style={styles.header}>
        <Pressable
          testID="accessibility-back-btn"
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          ACCESSIBILITY
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACING.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: colors.textDim }]}>
          Tweak the visuals to make every level comfortable to play.
        </Text>

        <Section title="Visual" colors={colors}>
          <ToggleRow
            colors={colors}
            label="Larger arrows"
            description="Increase arrow icon size on the board"
            value={settings.largeArrows}
            onChange={(v) => {
              setSetting("largeArrows", v);
              haptic("selection");
            }}
            testID="setting-large-arrows"
          />
          <ToggleRow
            colors={colors}
            label="High contrast"
            description="Pure black background and brighter borders"
            value={settings.highContrast}
            onChange={(v) => {
              setSetting("highContrast", v);
              haptic("selection");
            }}
            testID="setting-high-contrast"
          />
          <ToggleRow
            colors={colors}
            label="Color-blind safe"
            description="White & amber palette instead of cyan/magenta"
            value={settings.colorBlindSafe}
            onChange={(v) => {
              setSetting("colorBlindSafe", v);
              haptic("selection");
            }}
            testID="setting-colorblind"
          />
        </Section>

        <Section title="Motion" colors={colors}>
          <ToggleRow
            colors={colors}
            label="Reduce motion"
            description="Disable glowing pulse, shake & decorative animations"
            value={settings.reducedMotion}
            onChange={(v) => setSetting("reducedMotion", v)}
            testID="setting-a11y-reduced-motion"
          />
        </Section>

        <View
          style={[
            styles.note,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          testID="a11y-screen-reader-note"
        >
          <Ionicons name="information-circle" size={18} color={colors.cyan} />
          <Text style={[styles.noteText, { color: colors.textDim }]}>
            Every interactive button on this screen is labeled for screen readers.
            Arrows on the board announce their direction when focused.
          </Text>
        </View>
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

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SPACING.md },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 14, fontWeight: "900", letterSpacing: 3 },
  content: { paddingTop: SPACING.sm },
  intro: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: SPACING.lg,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
    marginBottom: SPACING.sm,
    paddingHorizontal: 4,
  },
  sectionBody: { borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden" },
  note: {
    flexDirection: "row",
    gap: 10,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
});
