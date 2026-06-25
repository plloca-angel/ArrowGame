import { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  ActivityIndicator,
} from "react-native";
import { getColors } from "../theme";

const colors = getColors({ variant: "cyan" });

export function AppLoadingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    const driftLoop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    pulseLoop.start();
    driftLoop.start();
    return () => {
      pulseLoop.stop();
      driftLoop.stop();
    };
  }, [pulse, drift]);

  const glowRadius = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 26],
  });

  const arrowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.85],
  });

  const driftX = drift.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, 8, 0, -8, 0],
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.deco} pointerEvents="none">
        <Text style={[styles.decoArrow, { color: colors.cyan, top: 80, left: 24 }]}>
          ▶
        </Text>
        <Text style={[styles.decoArrow, { color: colors.magenta, top: 160, right: 28 }]}>
          ◀
        </Text>
        <Text style={[styles.decoArrow, { color: colors.cyan, bottom: 120, left: 40 }]}>
          ▲
        </Text>
      </View>

      <View style={styles.center}>
        <Text style={[styles.eyebrow, { color: colors.cyan }]}>
          INFINITE NEON PUZZLE
        </Text>
        <Animated.Text
          style={[
            styles.title,
            {
              color: colors.text,
              textShadowColor: colors.cyanGlow,
              textShadowRadius: glowRadius,
            },
          ]}
        >
          ARROW
        </Animated.Text>
        <Animated.Text
          style={[
            styles.title,
            styles.titleAccent,
            {
              color: colors.magenta,
              textShadowColor: colors.magentaGlow,
              textShadowRadius: glowRadius,
            },
          ]}
        >
          ESCAPE
        </Animated.Text>

        <Animated.View style={[styles.arrowRow, { opacity: arrowOpacity, transform: [{ translateX: driftX }] }]}>
          <Text style={[styles.arrowGlyph, { color: colors.cyan }]}>▶</Text>
          <Text style={[styles.arrowGlyph, { color: colors.magenta }]}>▶</Text>
          <Text style={[styles.arrowGlyph, { color: colors.cyan }]}>▶</Text>
        </Animated.View>

        <ActivityIndicator
          size="small"
          color={colors.cyan}
          style={styles.spinner}
        />
        <Text style={[styles.label, { color: colors.textDim }]}>Loading…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  deco: {
    ...StyleSheet.absoluteFillObject,
  },
  decoArrow: {
    position: "absolute",
    fontSize: 48,
    opacity: 0.06,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 4,
    fontWeight: "800",
    marginBottom: 16,
  },
  title: {
    fontSize: 52,
    fontWeight: "900",
    letterSpacing: 2,
    textShadowOffset: { width: 0, height: 0 },
    lineHeight: 58,
  },
  titleAccent: {
    marginTop: -6,
    marginBottom: 24,
  },
  arrowRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  arrowGlyph: {
    fontSize: 22,
    fontWeight: "900",
  },
  spinner: {
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
  },
});
