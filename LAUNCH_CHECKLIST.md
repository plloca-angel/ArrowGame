# Arrow Escape - Launch Checklist

The codebase is now wired to use **real AdMob interstitials** and **real native In-App Purchases** when running in a native build. In the web preview / Expo Go you'll still see the mocked interstitial + Stripe flow.

This file contains the exact steps you need to complete before publishing to the App Store and Google Play.

---

## 1. Google AdMob (Real Ads)

### What I need from you
Sign in to https://apps.admob.com → create:
- 1 app entry for **iOS**, 1 for **Android** (Bundle ID = `com.arrowescape.app`)
- 1 **Interstitial** ad unit per platform (name it `skip_levelgate`)

Paste these IDs back to me:

```
ANDROID_APP_ID = ca-app-pub-XXXX~YYYY            # from AdMob → App settings
IOS_APP_ID = ca-app-pub-XXXX~YYYY                # from AdMob → App settings
ANDROID_INTERSTITIAL_AD_UNIT_ID = ca-app-pub-XXXX/ZZZZ
IOS_INTERSTITIAL_AD_UNIT_ID = ca-app-pub-XXXX/ZZZZ
```

### What I'll do once you send them
1. Replace the placeholder App IDs in `frontend/app.json` (currently using Google's test App IDs)
2. Add the Ad Unit IDs to `frontend/.env` as `EXPO_PUBLIC_IOS_INTERSTITIAL_AD_UNIT_ID` and `EXPO_PUBLIC_ANDROID_INTERSTITIAL_AD_UNIT_ID`

The native build will automatically pick them up. **In dev mode (`__DEV__`)**, the code still uses `TestIds.INTERSTITIAL` — that's a Google rule to prevent invalid-traffic strikes.

### What you still need to do for AdMob compliance
- [ ] **Privacy Policy URL** — required. Generate one at https://app-privacy-policy-generator.firebaseapp.com — list AdMob + IAP + AsyncStorage as data sources
- [ ] **AdMob → Payments**: complete tax forms + bank info before reaching the $100 payout threshold
- [ ] **EEA/UK consent (UMP SDK)**: only needed if you'll serve EU traffic. Tell me if yes; I'll add the consent prompt.
- [ ] **Apple ATT prompt**: already wired via `NSUserTrackingUsageDescription` in `app.json`. iOS will show "Allow App to Track" on first launch.

---

## 2. Native In-App Purchases (StoreKit / Play Billing)

### App Store Connect setup (iOS)
1. Go to https://appstoreconnect.apple.com
2. Create your app with Bundle ID = **`com.arrowescape.app`**
3. **Features → In-App Purchases** → create:
   - Product ID: `com.arrowescape.removeads` · Type: **Non-Consumable** · Price: $2.99 · Reference name: "Remove Ads"
   - Product ID: `com.arrowescape.hintpack10` · Type: **Consumable** · Price: $0.99 · Reference name: "Hint Pack 10"
4. Fill display name, description, screenshot (1024×1024 IAP screenshot) for each
5. Submit for review — they'll be reviewed alongside your first build

### Google Play Console setup (Android)
1. Go to https://play.google.com/console
2. Create your app with Package name = **`com.arrowescape.app`**
3. **Monetize → Products → In-app products** → create:
   - Product ID: `com.arrowescape.removeads` · One-time · $2.99
   - Product ID: `com.arrowescape.hintpack10` · Consumable · $0.99
4. Activate each product

### What the code already does
- File `frontend/src/services/iap.native.ts` maps your local product IDs (`remove_ads`, `hint_pack_10`) to these store IDs
- Calls `expo-iap` → `requestPurchase`, grants the entitlement locally on success, finalizes the transaction
- `restorePurchases()` is wired so users on a new device can recover their purchases

### What I'd recommend doing next (when you're ready)
- [ ] **Server-side receipt verification** — currently we trust the client purchase result. For a production launch I'd add a `POST /api/iap/verify` endpoint that calls Apple's `/verifyReceipt` or Google's `purchases.products.get` to confirm the receipt before granting. Takes ~30 min. Ask when you want this.

---

## 3. The "white Stripe page" issue

**Fixed.** The web Stripe Checkout flow now uses `window.open(url, "_blank")` — opens in a new tab where Stripe's anti-clickjacking headers don't block it. The same-tab fallback is kept in case the popup is blocked.

This only matters for the web build / preview. The mobile builds use native IAP, not Stripe.

---

## 4. App-store assets you need to provide

- [ ] **App icon** — 1024×1024 PNG, no transparency, no rounded corners. Replace `frontend/assets/images/icon.png`.
- [ ] **Adaptive icon foreground (Android)** — 432×432 PNG with safe-zone padding. Replace `frontend/assets/images/adaptive-icon.png`.
- [ ] **Splash image** — 1284×2778 (or any 9:19.5 ratio) PNG. Replace `frontend/assets/images/splash-icon.png`.
- [ ] **Store screenshots**:
  - iPhone 6.7" (1290×2796): 3-10 screenshots
  - iPhone 6.5" (1242×2688): 3-10 screenshots
  - iPad 12.9" (2048×2732): 3-10 screenshots (only if you publish to iPad)
  - Android phone (1080×1920+): 2-8 screenshots
  - Android 7-inch tablet, 10-inch tablet (optional)
- [ ] **App description** — short (80 chars) + long (4000 chars)
- [ ] **Keywords** — 100 chars (iOS only)
- [ ] **Promotional text** — 170 chars (iOS only)
- [ ] **Content rating questionnaire** — fill out in both stores

---

## 5. Publishing through Emergent

When everything above is ready:

1. Click the **Publish** button (top-right of the Emergent editor)
2. Pick **iOS**, **Android**, or both
3. Emergent will produce signed `.ipa` (iOS) and `.aab` (Android) files
4. Upload to App Store Connect and Google Play Console respectively
5. Submit for review

Review takes typically:
- **Google Play**: 1-3 days for first submission
- **App Store**: 1-2 days for first submission

---

## 6. Order I recommend

1. **You — right now**: create AdMob account → send me the 4 IDs
2. **Me — once you do**: 5 minute swap → real ad units configured
3. **You — in parallel**: create App Store Connect + Play Console listings, configure both IAP products with the IDs above
4. **You**: prepare icon, splash, screenshots, descriptions
5. **You**: write a privacy policy, host it (any free URL works)
6. **Me — when you ask**: add server-side receipt verification + EU consent prompt (if you need either)
7. **You**: click Publish, upload binaries, submit for review

---

## Quick reference — file locations

| Concern | File |
|---|---|
| AdMob plugin + App IDs | `frontend/app.json` → `plugins[].react-native-google-mobile-ads` |
| Ad unit IDs | `frontend/.env` (`EXPO_PUBLIC_*_INTERSTITIAL_AD_UNIT_ID`) |
| Ads SDK init + show logic | `frontend/src/services/ads.native.tsx` |
| Mocked ad (web/Expo Go) | `frontend/src/services/ads.tsx` |
| Native IAP mapping + flow | `frontend/src/services/iap.native.ts` |
| Stripe fallback (web) | `frontend/src/services/iap.ts` |
| Bundle ID / package | `frontend/app.json` (`ios.bundleIdentifier`, `android.package`) |
| Tracking description text | `frontend/app.json` (`ios.infoPlist.NSUserTrackingUsageDescription`) |
