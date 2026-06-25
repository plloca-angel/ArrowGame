const fs = require("fs");
const path = require("path");

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnvFile();

const appJson = require("./app.json");

const SAMPLE_ANDROID_APP_ID = "ca-app-pub-3940256099942544~3347511713";
const SAMPLE_IOS_APP_ID = "ca-app-pub-3940256099942544~1458002511";

const androidAppId =
  process.env.EXPO_PUBLIC_ANDROID_APP_ID || SAMPLE_ANDROID_APP_ID;
const iosAppId = process.env.EXPO_PUBLIC_IOS_APP_ID || SAMPLE_IOS_APP_ID;

const nativeAdsBuild =
  process.env.EXPO_PUBLIC_NATIVE_ADS_BUILD === "true" ||
  process.env.EXPO_PUBLIC_NATIVE_ADS_BUILD === "1";

const basePlugins = (appJson.expo.plugins || []).filter((plugin) => {
  const name = Array.isArray(plugin) ? plugin[0] : plugin;
  if (name !== "expo-iap") return true;
  try {
    require.resolve("expo-iap");
    return true;
  } catch {
    console.warn(
      "[app.config] Skipping expo-iap plugin — package not installed (Expo Go / web dev still works)."
    );
    return false;
  }
});

const adPlugins = nativeAdsBuild
  ? [
      [
        "react-native-google-mobile-ads",
        { androidAppId, iosAppId },
      ],
      [
        "expo-tracking-transparency",
        {
          userTrackingPermission:
            "This helps us measure ad performance and offer more relevant ads in Arrow Escape.",
        },
      ],
    ]
  : [];

module.exports = {
  expo: {
    ...appJson.expo,
    name: "Arrow Escape",
    slug: "arrow-escape",
    scheme: "arrowescape",
    updates: {
      enabled: false,
      checkAutomatically: "NEVER",
    },
    ios: {
      ...appJson.expo.ios,
      infoPlist: {
        ...(appJson.expo.ios?.infoPlist || {}),
        NSUserTrackingUsageDescription:
          "This helps us measure ad performance and offer more relevant ads in Arrow Escape.",
      },
    },
    android: {
      ...appJson.expo.android,
      package: "com.arrowescape.app",
      versionCode: 1,
    },
    plugins: [...basePlugins, ...adPlugins],
    extra: {
      ...(appJson.expo.extra || {}),
      EXPO_PUBLIC_BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL || "",
      EXPO_PUBLIC_NATIVE_ADS_BUILD: nativeAdsBuild ? "true" : "false",
      EXPO_PUBLIC_ANDROID_APP_ID: androidAppId,
      EXPO_PUBLIC_IOS_APP_ID: iosAppId,
      EXPO_PUBLIC_ANDROID_INTERSTITIAL_AD_UNIT_ID:
        process.env.EXPO_PUBLIC_ANDROID_INTERSTITIAL_AD_UNIT_ID || "",
      EXPO_PUBLIC_IOS_INTERSTITIAL_AD_UNIT_ID:
        process.env.EXPO_PUBLIC_IOS_INTERSTITIAL_AD_UNIT_ID || "",
      EXPO_PUBLIC_USE_TEST_AD_UNITS: process.env.EXPO_PUBLIC_USE_TEST_AD_UNITS,
      EXPO_PUBLIC_PRIVACY_POLICY_URL:
        process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || "",
    },
  },
};
