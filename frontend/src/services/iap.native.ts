// IAP service - NATIVE (iOS + Android) implementation using expo-iap.
// Metro picks this file automatically on native platforms.

import {
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  requestPurchase,
  type Product,
  type Purchase,
} from "expo-iap";
import { grantPurchase } from "../storage";

// === Store product IDs ============================================
// These MUST match the product IDs configured in App Store Connect
// (iOS) and Google Play Console (Android).
// Convention: keep app-internal ids ("remove_ads", "hint_pack_10")
// the same as before; map them to platform-specific store ids here.
export const PLATFORM_PRODUCT_IDS: Record<
  "remove_ads" | "hint_pack_10",
  string
> = {
  remove_ads: "com.arrowescape.removeads",
  hint_pack_10: "com.arrowescape.hintpack10",
};

const PLATFORM_TO_LOCAL: Record<string, "remove_ads" | "hint_pack_10"> =
  Object.fromEntries(
    Object.entries(PLATFORM_PRODUCT_IDS).map(([local, platform]) => [
      platform,
      local as "remove_ads" | "hint_pack_10",
    ])
  );

// Re-export the unified product list endpoint for parity with the web impl.
const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL!;

export type IapProduct = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  kind: string;
  // platform-specific store SKUs (for the StoreKit / Play Billing call)
  storeId?: string;
};

function applyLiveStorePrice(
  target: IapProduct,
  live: Pick<Product, "price" | "currency" | "title">
): void {
  if (typeof live.price === "number" && !Number.isNaN(live.price)) {
    target.amount = live.price;
  }
  if (live.currency) target.currency = live.currency;
  if (live.title) target.name = live.title;
}

function asPurchase(
  result: Purchase | Purchase[] | null
): Purchase | null {
  if (!result) return null;
  return Array.isArray(result) ? (result[0] ?? null) : result;
}

export async function listProducts(): Promise<IapProduct[]> {
  // 1) Get canonical product metadata from our backend
  const res = await fetch(`${BACKEND}/api/products`);
  if (!res.ok) throw new Error("Couldn't load products");
  const products = (await res.json()) as IapProduct[];

  // 2) Annotate with the platform store SKU
  const annotated = products.map((p) => ({
    ...p,
    storeId:
      PLATFORM_PRODUCT_IDS[p.id as "remove_ads" | "hint_pack_10"] ?? p.id,
  }));

  // 3) Best-effort: connect to the store + fetch real prices
  try {
    await initConnection();
    const ids = annotated.map((p) => p.storeId!);
    const storeProducts = await fetchProducts({ skus: ids, type: "in-app" });
    if (!storeProducts) return annotated;

    for (const p of annotated) {
      const live = storeProducts.find((s) => s.id === p.storeId);
      if (live) applyLiveStorePrice(p, live);
    }
  } catch {
    // ignore - fall back to backend prices
  }

  return annotated;
}

export async function purchase(product: IapProduct): Promise<{
  success: boolean;
  sessionId?: string;
  error?: string;
}> {
  try {
    await initConnection();
    const sku = product.storeId ?? product.id;
    const result = asPurchase(
      await requestPurchase({
        type: "in-app",
        request: {
          apple: { sku },
          google: { skus: [sku] },
        },
      })
    );

    const purchaseId: string =
      result?.id ??
      result?.purchaseToken ??
      result?.productId ??
      `local-${Date.now()}`;

    const localId =
      PLATFORM_TO_LOCAL[sku] ?? (product.id as "remove_ads" | "hint_pack_10");

    await grantPurchase(purchaseId, localId);

    if (result) {
      try {
        await finishTransaction({
          purchase: result,
          isConsumable: product.kind === "consumable",
        });
      } catch {
        // ignore - some platforms auto-finish
      }
    }

    return { success: true, sessionId: purchaseId };
  } catch (e: unknown) {
    const msg = String(e instanceof Error ? e.message : e ?? "purchase failed");
    if (/user cancelled|cancel/i.test(msg)) {
      return { success: false, error: "Cancelled" };
    }
    return { success: false, error: msg };
  }
}

export async function pollStatus(_sessionId: string): Promise<{
  paid: boolean;
  productId?: string;
}> {
  // Native flow grants synchronously in purchase(). No polling needed.
  return { paid: true };
}

export async function restorePurchases() {
  try {
    await initConnection();
    const purchases = await getAvailablePurchases();
    for (const p of purchases) {
      const sku = p.productId;
      const localId = PLATFORM_TO_LOCAL[sku];
      if (!localId) continue;
      const txId = p.id ?? p.purchaseToken ?? `restore-${sku}`;
      await grantPurchase(txId, localId);
    }
  } catch {
    // ignore
  }
}

export const IAP_BACKEND = "native" as "stripe-web" | "native";
