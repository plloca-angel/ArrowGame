import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { COLORS, RADIUS, SPACING } from "../src/theme";
import { loadProgress, Progress, resetProgress } from "../src/storage";
import { LEVELS, TOTAL_HANDCRAFTED } from "../src/levels";

const TOTAL_VISIBLE = TOTAL_HANDCRAFTED + 6; // show some procedural ones too

export default function Levels() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState<Progress | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadProgress().then(setProgress);
    }, [])
  );

  const onSelect = (id: number, locked: boolean) => {
    if (locked) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => {}
      );
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    router.push({ pathname: "/game", params: { level: String(id) } });
  };

  const onReset = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
      () => {}
    );
    const p = await resetProgress();
    setProgress(p);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <View style={styles.header}>
        <Pressable
          testID="levels-back-btn"
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.headerTitle}>SELECT LEVEL</Text>
        <Pressable
          testID="levels-reset-btn"
          onPress={onReset}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Ionicons name="refresh" size={20} color={COLORS.textDim} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.grid,
          { paddingBottom: insets.bottom + SPACING.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {Array.from({ length: TOTAL_VISIBLE }, (_, i) => i + 1).map((id) => {
          const stars = progress?.completed[id]?.stars ?? 0;
          const locked = progress ? id > progress.highestUnlocked : id !== 1;
          const isHandcrafted = id <= LEVELS.length;
          return (
            <Pressable
              testID={`level-tile-${id}`}
              key={id}
              onPress={() => onSelect(id, locked)}
              style={({ pressed }) => [
                styles.tile,
                locked && styles.tileLocked,
                stars > 0 && styles.tileSolved,
                pressed && !locked && { transform: [{ scale: 0.95 }] },
              ]}
            >
              {locked ? (
                <Ionicons name="lock-closed" size={22} color={COLORS.textMuted} />
              ) : (
                <>
                  <Text
                    style={[styles.tileNum, stars > 0 && { color: COLORS.cyan }]}
                  >
                    {id}
                  </Text>
                  <View style={styles.starsRow}>
                    {[1, 2, 3].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= stars ? "star" : "star-outline"}
                        size={10}
                        color={s <= stars ? COLORS.star : COLORS.textMuted}
                        style={{ marginHorizontal: 1 }}
                      />
                    ))}
                  </View>
                  {!isHandcrafted && (
                    <Text style={styles.endlessTag}>∞</Text>
                  )}
                </>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.lg,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
    justifyContent: "center",
  },
  tile: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLocked: {
    opacity: 0.45,
  },
  tileSolved: {
    borderColor: COLORS.cyan,
    shadowColor: COLORS.cyan,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  tileNum: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "800",
  },
  starsRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  endlessTag: {
    position: "absolute",
    top: 6,
    right: 8,
    color: COLORS.magenta,
    fontSize: 12,
    fontWeight: "800",
  },
});
