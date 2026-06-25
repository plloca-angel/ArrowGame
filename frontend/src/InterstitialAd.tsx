import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { AppPressable as Pressable } from "./components/AppPressable";
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "./SettingsContext";
import { RADIUS, SPACING } from "./theme";
import { shouldUseNativeAds } from "./ads/nativeGate";

// Mocked full-screen interstitial ad. Visual-only, runs a countdown then
// becomes dismissible. In a real build this would be replaced by
// react-native-google-mobile-ads InterstitialAd.show().
//
// IMPORTANT: respects the removeAds entitlement — if user owns it,
// the parent component should never even call show().

const COUNTDOWN_SECONDS = 4;

export function InterstitialAd({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, settings } = useSettings();
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const [shimmer] = useState(new Animated.Value(0));

  useEffect(() => {
    if (!visible) {
      setRemaining(COUNTDOWN_SECONDS);
      return;
    }
    setRemaining(COUNTDOWN_SECONDS);
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [visible]);

  useEffect(() => {
    if (!visible || settings.reducedMotion) {
      shimmer.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [visible, settings.reducedMotion, shimmer]);

  if (!visible) return null;

  const shimmerLeft = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ["-30%", "130%"],
  });

  const dismissible = remaining === 0;
  const previewMode = !shouldUseNativeAds();

  return (
    <View style={styles.overlay} testID="interstitial-ad">
      <View style={[styles.backdrop, { backgroundColor: colors.bg }]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View
            style={[
              styles.adTag,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.adTagText, { color: colors.textMuted }]}>
              {previewMode ? "TEST AD · EXPO GO PREVIEW" : "SPONSORED · AD"}
            </Text>
          </View>
          <Pressable
            testID="interstitial-close-btn"
            onPress={dismissible ? onClose : undefined}
            disabled={!dismissible}
            style={[
              styles.closeBtn,
              {
                backgroundColor: colors.surface,
                borderColor: dismissible ? colors.cyan : colors.border,
                opacity: dismissible ? 1 : 0.6,
              },
            ]}
          >
            {dismissible ? (
              <Ionicons name="close" size={20} color={colors.text} />
            ) : (
              <Text style={[styles.timerText, { color: colors.textDim }]}>
                {remaining}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Fake ad creative */}
        <View
          style={[
            styles.creative,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* Shimmer band */}
          {!settings.reducedMotion && (
            <Animated.View
              style={[
                styles.shimmer,
                {
                  left: shimmerLeft as unknown as number,
                  backgroundColor: colors.cyanGlow,
                  pointerEvents: "none",
                },
              ]}
            />
          )}
          <View style={styles.creativeBody}>
            <View
              style={[
                styles.brandRow,
                { borderColor: colors.border },
              ]}
            >
              <View
                style={[styles.brandIcon, { backgroundColor: colors.cyan }]}
              >
                <Ionicons name="game-controller" size={24} color="#02141a" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.brandName, { color: colors.text }]}>
                  Pixel Quest Saga
                </Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name="star"
                      size={11}
                      color={colors.star}
                      style={{ marginRight: 1 }}
                    />
                  ))}
                  <Text
                    style={[styles.brandSub, { color: colors.textMuted }]}
                  >
                    {"  "}4.8 · 12K reviews
                  </Text>
                </View>
              </View>
            </View>

            <Text style={[styles.tagline, { color: colors.text }]}>
              Save the kingdom, one tap at a time.
            </Text>
            <Text style={[styles.subTagline, { color: colors.textDim }]}>
              The retro-RPG everyone is playing this month.
            </Text>

            <View
              style={[styles.cta, { backgroundColor: colors.cyan }]}
            >
              <Text style={styles.ctaLabel}>INSTALL · FREE</Text>
              <Ionicons name="download" size={16} color="#02141a" />
            </View>
          </View>
        </View>

        <Text style={[styles.foot, { color: colors.textMuted }]}>
          {previewMode
            ? "This is a test interstitial. The APK build uses Google AdMob test units until you add real ad IDs."
            : "Ads keep Arrow Escape free. Tap "}
          {!previewMode ? (
            <>
              <Text style={{ color: colors.cyan, fontWeight: "800" }}>
                Remove Ads
              </Text>{" "}
              in the Store to play uninterrupted.
            </>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  adTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  adTagText: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: { fontSize: 14, fontWeight: "900" },
  creative: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: "hidden",
    flex: 1,
    marginVertical: SPACING.lg,
    justifyContent: "center",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: "30%",
    transform: [{ skewX: "-20deg" }],
  },
  creativeBody: { padding: SPACING.lg, gap: SPACING.md },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: SPACING.sm,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
  brandSub: { fontSize: 11 },
  starsRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  tagline: { fontSize: 22, fontWeight: "900", letterSpacing: 0.5 },
  subTagline: { fontSize: 13, lineHeight: 18 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  ctaLabel: { color: "#02141a", fontWeight: "900", letterSpacing: 2, fontSize: 14 },
  foot: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});
