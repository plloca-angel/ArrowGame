// IAP service - WEB / Expo Go fallback (Stripe Checkout via window.open).
// The native build uses ./iap.native.ts which uses StoreKit / Play Billing.
// Metro auto-picks the .native.ts file on iOS/Android builds.

import { Platform } from "react-native";
import { grantPurchase, getDeviceId } from "../storage";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL!;

export type IapProduct = {
  id: string; // local id ("remove_ads", "hint_pack_10")
  name: string;
  amount: number;
  currency: string;
  kind: string;
};

export async function listProducts(): Promise<IapProduct[]> {
  const res = await fetch(`${BACKEND}/api/products`);
  if (!res.ok) throw new Error("Couldn't load products");
  return res.json();
}

export async function purchase(product: IapProduct): Promise<{
  success: boolean;
  sessionId?: string;
  error?: string;
}> {
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
    const { url, session_id } = await res.json();
    if (Platform.OS === "web" && typeof window !== "undefined") {
      // Open in NEW TAB — fixes the "white iframe" issue in the Emergent
      // preview where Stripe Checkout refuses to load inside an iframe.
      const popup = window.open(url, "_blank");
      if (!popup) {
        // popup blocked — fall back to same-tab navigation
        window.top!.location.href = url;
      }
    }
    return { success: true, sessionId: session_id };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "purchase failed" };
  }
}

export async function pollStatus(sessionId: string): Promise<{
  paid: boolean;
  productId?: string;
}> {
  try {
    const res = await fetch(`${BACKEND}/api/checkout/status/${sessionId}`);
    if (!res.ok) return { paid: false };
    const data = await res.json();
    if (data.payment_status === "paid") {
      await grantPurchase(sessionId, data.product_id);
      return { paid: true, productId: data.product_id };
    }
    return { paid: false };
  } catch {
    return { paid: false };
  }
}

export async function restorePurchases() {
  // Web/Stripe: nothing to restore - entitlements are stored locally.
  return;
}

export const IAP_BACKEND = "stripe-web" as "stripe-web" | "native";
