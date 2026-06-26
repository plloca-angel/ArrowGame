import { Pressable, type PressableProps } from "react-native";

type Props = PressableProps;

/** Reliable taps on Android and Expo Go — always Pressable. */
export function AppPressable({ style, onPress, onPressIn, children, ...rest }: Props) {
  return (
    <Pressable
      style={style}
      onPress={onPress}
      onPressIn={onPressIn}
      android_ripple={{ color: "rgba(255,255,255,0.08)", borderless: false }}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
