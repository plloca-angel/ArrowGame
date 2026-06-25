const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
}

const nativeAdsBuild =
  process.env.EXPO_PUBLIC_NATIVE_ADS_BUILD === "true" ||
  process.env.EXPO_PUBLIC_NATIVE_ADS_BUILD === "1";

const config = getDefaultConfig(__dirname);

if (!nativeAdsBuild) {
  const adsStub = path.resolve(__dirname, "src/ads/stubs/native-ads-stub.js");
  const trackingStub = path.resolve(__dirname, "src/ads/stubs/tracking-stub.js");
  const prevResolve = config.resolver.resolveRequest;

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "react-native-google-mobile-ads") {
      return { filePath: adsStub, type: "sourceFile" };
    }
    if (moduleName === "expo-tracking-transparency") {
      return { filePath: trackingStub, type: "sourceFile" };
    }
    if (prevResolve) {
      return prevResolve(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
