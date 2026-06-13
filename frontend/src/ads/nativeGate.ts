import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

/** True for dev builds and store builds; false for Expo Go and web (no native ads module). */
export function shouldUseNativeAds(): boolean {
  if (Platform.OS === "web") return false;
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}
