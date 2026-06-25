import { Pressable, type PressableProps } from "react-native";

/**
 * Thin wrapper around RN's Pressable so we have one place to adjust touch
 * behavior across the app if platform-specific workarounds are needed.
 */
export function AppPressable(props: PressableProps) {
  return <Pressable {...props} />;
}
