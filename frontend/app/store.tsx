import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useSettings } from "../src/SettingsContext";
import {
  loadEntitlements,
  Entitlements,
  grantPurchase,
  getDeviceId,
} from "../src/storage";
import { RADIUS, SPACING } from "../src/theme";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL!;

type Product = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  kind: string;
};

type CheckoutStatus = {
  session_id: string;
  status: string;
  payment_status: string;
  product_id: string;
  granted: boolean;
  amount_total: number;
  currency: string;
};

export default function StoreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, haptic } = useSettings();
  const params = useLocalSearchParams<{ session_id?: string; cancelled?: string }>();

  const [products, setProducts] = useState<Product[]>([]);
  const [ents, setEnts] = useState<Entitlements | null>(null);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{
    text: string;
    kind: "success" | "error" | "pending";
  } | null>(null);
  const pollAttempts = useRef(0);

  // Load products + entitlements
  const refreshEnts = useCallback(async () => {
    const e = await loadEntitlements();
    setEnts(e);
  }, []);

  useEffect(() => {
    fetch(`${BACKEND}/api/products`)
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => {
        setStatusMsg({ text: "Couldn't load products. Check connection.", kind: "error" });
      });
    refreshEnts();
  }, [refreshEnts]);

  useFocusEffect(
    useCallback(() => {
      refreshEnts();
    }, [refreshEnts])
  );

  // Poll status when returning from Stripe (web flow appends ?session_id=…)
  useEffect(() => {
    const sessionId = params.session_id;
    if (params.cancelled) {
      setStatusMsg({ text: "Payment cancelled.", kind: "error" });
      return;
    }
    if (!sessionId) return;
    pollAttempts.current = 0;
    pollStatus(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.session_id, params.cancelled]);

  async function pollStatus(sessionId: string) {
    const MAX = 6;
    if (pollAttempts.current >= MAX) {
      setStatusMsg({
        text: "Payment status check timed out. Refresh in a moment.",
        kind: "error",
      });
      return;
    }
    pollAttempts.current += 1;
    setStatusMsg({ text: "Confirming payment…", kind: "pending" });
    try {
      const res = await fetch(
        `${BACKEND}/api/checkout/status/${sessionId}`
      );
      if (!res.ok) throw new Error("status fetch failed");
      const data: CheckoutStatus = await res.json();
      if (data.payment_status === "paid") {
        await grantPurchase(sessionId, data.product_id);
        await refreshEnts();
        haptic("success");
        setStatusMsg({
          text:
            data.product_id === "remove_ads"
              ? "Ads removed. Enjoy!"
              : "Hints added to your account!",
          kind: "success",
        });
        return;
      }
      if (data.status === "expired") {
        setStatusMsg({ text: "Payment expired.", kind: "error" });
        return;
      }
      setTimeout(() => pollStatus(sessionId), 2000);
    } catch (e) {
      setStatusMsg({ text: "Error checking status. Try again.", kind: "error" });
    }
  }

  async function buy(product: Product) {
    haptic("medium");
    setLoadingProductId(product.id);
    setStatusMsg(null);
    try {
      const deviceId = await getDeviceId();
      const origin =
        Platform.OS === "web" && typeof window !== "undefined"
          ? window.location.origin
          : BACKEND;
      const res = await fetch(`${BACKEND}/api/checkout/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          origin_url: origin,
          user_id: deviceId,
        }),
      });
      if (!res.ok) throw new Error("checkout create failed");
      const { url } = await res.json();
      if (Platform.OS === "web") {
        // Direct browser redirect for web preview so deep links work cleanly
        window.location.href = url;
      } else {
        await WebBrowser.openBrowserAsync(url);
        // After returning, re-check entitlements (user may have completed)
        refreshEnts();
      }
    } catch (e) {
      haptic("error");
      setStatusMsg({ text: "Couldn't start checkout.", kind: "error" });
    } finally {
      setLoadingProductId(null);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: insets.top + SPACING.sm },
      ]}
      testID="store-screen"
    >
      <View style={styles.header}>
        <Pressable
          testID="store-back-btn"
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>STORE</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACING.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Entitlement summary */}
        <View
          style={[
            styles.summary,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.summaryItem}>
            <Ionicons
              name={ents?.removeAds ? "checkmark-circle" : "remove-circle-outline"}
              size={18}
              color={ents?.removeAds ? colors.green : colors.textMuted}
            />
            <Text
              style={[
                styles.summaryLabel,
                { color: ents?.removeAds ? colors.text : colors.textMuted },
              ]}
            >
              Ads {ents?.removeAds ? "removed" : "showing"}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="bulb" size={18} color={colors.yellow} />
            <Text style={[styles.summaryLabel, { color: colors.text }]}>
              {ents?.hintCredits ?? 0} hints
            </Text>
          </View>
        </View>

        {statusMsg && (
          <View
            testID="store-status"
            style={[
              styles.statusBox,
              {
                borderColor:
                  statusMsg.kind === "success"
                    ? colors.green
                    : statusMsg.kind === "error"
                    ? colors.red
                    : colors.cyan,
                backgroundColor: colors.surface,
              },
            ]}
          >
            {statusMsg.kind === "pending" && (
              <ActivityIndicator size="small" color={colors.cyan} />
            )}
            <Text style={[styles.statusText, { color: colors.text }]}>
              {statusMsg.text}
            </Text>
          </View>
        )}

        {/* Products */}
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
          PURCHASES
        </Text>
        {products.map((p) => {
          const owned =
            (p.id === "remove_ads" && ents?.removeAds) ||
            (p.id === "hint_pack_10" && false); // hint pack is consumable
          return (
            <View
              key={p.id}
              style={[
                styles.productCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.productIcon,
                  { backgroundColor: colors.bgElev, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name={p.id === "remove_ads" ? "shield-checkmark" : "bulb"}
                  size={26}
                  color={p.id === "remove_ads" ? colors.cyan : colors.yellow}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.productName, { color: colors.text }]}>
                  {p.name}
                </Text>
                <Text style={[styles.productDesc, { color: colors.textDim }]}>
                  {p.id === "remove_ads"
                    ? "One-time purchase · removes the banner ad forever."
                    : "10 hints to peek at the next move when stuck."}
                </Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.price, { color: colors.text }]}>
                    ${p.amount.toFixed(2)}
                  </Text>
                  <Text style={[styles.currency, { color: colors.textMuted }]}>
                    {p.currency.toUpperCase()}
                  </Text>
                </View>
              </View>
              {owned ? (
                <View
                  style={[styles.ownedTag, { borderColor: colors.green }]}
                  testID={`owned-${p.id}`}
                >
                  <Ionicons name="checkmark" size={14} color={colors.green} />
                  <Text style={[styles.ownedLabel, { color: colors.green }]}>
                    OWNED
                  </Text>
                </View>
              ) : (
                <Pressable
                  testID={`buy-${p.id}`}
                  onPress={() => buy(p)}
                  disabled={loadingProductId !== null}
                  style={({ pressed }) => [
                    styles.buyBtn,
                    {
                      backgroundColor: colors.cyan,
                      opacity:
                        loadingProductId === p.id || pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  {loadingProductId === p.id ? (
                    <ActivityIndicator size="small" color="#02141a" />
                  ) : (
                    <Text style={styles.buyLabel}>BUY</Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        })}

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          Powered by Stripe · Test mode. Card 4242 4242 4242 4242 / any future date
          / any CVC.
        </Text>
      </ScrollView>
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
  headerTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 4 },
  content: { paddingTop: SPACING.sm },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  summaryLabel: { fontSize: 13, fontWeight: "700" },
  summaryDivider: { width: 1, height: 20, backgroundColor: "#222" },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    marginBottom: SPACING.lg,
  },
  statusText: { flex: 1, fontSize: 13, fontWeight: "600" },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
    marginBottom: SPACING.sm,
    paddingHorizontal: 4,
  },
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  productIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  productName: { fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  productDesc: { fontSize: 11, marginTop: 2, lineHeight: 16 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 8 },
  price: { fontSize: 20, fontWeight: "900" },
  currency: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  buyBtn: {
    paddingHorizontal: 18,
    height: 40,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
  },
  buyLabel: {
    color: "#02141a",
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: 13,
  },
  ownedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderRadius: RADIUS.pill,
  },
  ownedLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  disclaimer: {
    fontSize: 10,
    textAlign: "center",
    marginTop: SPACING.md,
    letterSpacing: 0.5,
    lineHeight: 14,
  },
});
