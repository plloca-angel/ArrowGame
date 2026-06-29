import { View, Text, StyleSheet } from "react-native";
import { AppPressable as Pressable } from "./components/AppPressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useSettings } from "./SettingsContext";
import { loadEntitlements } from "./storage";
import { RADIUS, SPACING } from "./theme";
import { shouldUseNativeAds } from "./ads/nativeGate";
import { ADS_ENABLED } from "./ads/adsConfig";

// In Expo Go we show a Google-style test banner. Native builds use AdMob (or test units).
// Hidden when user has the "removeAds" entitlement.
export function AdBanner({ visible = true }: { visible?: boolean }) {
  const router = useRouter();
  const { colors, haptic } = useSettings();
  const [removeAds, setRemoveAds] = useState(false);

  useEffect(() => {
    let alive = true;
    loadEntitlements().then((e) => {
      if (alive) setRemoveAds(e.removeAds);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ADS_ENABLED || !visible || removeAds) return null;

  const previewMode = !shouldUseNativeAds();

  if (previewMode) {
    return (
      <View
        testID="ad-banner-test"
        style={[
          styles.testWrap,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.testTag, { backgroundColor: colors.bgElev }]}>
          <Text style={[styles.testTagText, { color: colors.textMuted }]}>
            Test Ad
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.testTitle, { color: colors.text }]}>
            Google AdMob test banner
          </Text>
          <Text style={[styles.testSub, { color: colors.textDim }]} numberOfLines={1}>
            Expo Go preview — real ads load in the APK build
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      testID="ad-banner"
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.inner}>
        <View
          style={[styles.adTag, { backgroundColor: colors.bgElev, borderColor: colors.border }]}
        >
          <Text style={[styles.adTagText, { color: colors.textMuted }]}>AD</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Tired of ads?</Text>
          <Text style={[styles.sub, { color: colors.textDim }]} numberOfLines={1}>
            Remove ads forever — one-time purchase
          </Text>
        </View>
        <Pressable
          testID="ad-banner-cta"
          onPress={() => {
            haptic("selection");
            router.push("/store");
          }}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: colors.cyan,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.ctaLabel}>REMOVE</Text>
          <Ionicons name="arrow-forward" size={14} color="#02141a" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.sm,
  },
  adTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  adTagText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
  },
  sub: {
    fontSize: 11,
    marginTop: 1,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  ctaLabel: {
    color: "#02141a",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.5,
  },
  testWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  testTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  testTagText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  testTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  testSub: {
    fontSize: 11,
    marginTop: 1,
  },
});
