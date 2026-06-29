import { View, Text, StyleSheet } from "react-native";
import { AppPressable as Pressable } from "../src/components/AppPressable";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "../src/SettingsContext";
import { MAX_CAMPAIGN_LEVEL } from "../src/campaign";
import { RADIUS, SPACING } from "../src/theme";

export default function ComingSoonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, haptic } = useSettings();

  const onHome = () => {
    haptic("medium");
    router.replace("/");
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top + SPACING.lg,
          paddingBottom: insets.bottom + SPACING.lg,
        },
      ]}
      testID="coming-soon-screen"
    >
      <View style={styles.content}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: colors.surface, borderColor: colors.cyan },
          ]}
        >
          <Ionicons name="rocket-outline" size={40} color={colors.cyan} />
        </View>
        <Text style={[styles.eyebrow, { color: colors.cyan }]}>
          LEVEL {MAX_CAMPAIGN_LEVEL} COMPLETE
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>
          More levels soon
        </Text>
        <Text style={[styles.body, { color: colors.textDim }]}>
          You&apos;ve cleared every level we have right now. New puzzles are on
          the way — check back later, or play today&apos;s daily challenge from
          the home screen.
        </Text>
        <Pressable
          testID="coming-soon-home-btn"
          onPress={onHome}
          style={({ pressed }) => [
            styles.homeBtn,
            {
              backgroundColor: colors.cyan,
              shadowColor: colors.cyan,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="home" size={20} color="#02141a" />
          <Text style={styles.homeBtnLabel}>HOME</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    maxWidth: 360,
    alignSelf: "center",
    width: "100%",
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: SPACING.xl,
  },
  homeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: RADIUS.md,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 6,
  },
  homeBtnLabel: {
    color: "#02141a",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },
});
