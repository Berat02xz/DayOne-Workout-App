import {
  View,
  StyleSheet,
  Platform,
  useWindowDimensions,
  TouchableOpacity,
  Text,
} from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { theme } from "@/constants/theme";
import { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const ICON_ACTIVE = "#000000";
const ICON_INACTIVE = "rgba(255,255,255,0.45)";

export const icon = {
  workout: (props: any) => (
    <Ionicons
      name={props.focused ? "barbell" : "barbell-outline"}
      size={22}
      color={props.focused ? ICON_ACTIVE : ICON_INACTIVE}
    />
  ),
  nutrition: (props: any) => (
    <Ionicons
      name={props.focused ? "restaurant" : "restaurant-outline"}
      size={22}
      color={props.focused ? ICON_ACTIVE : ICON_INACTIVE}
    />
  ),
  chatbot: (props: any) => (
    <Ionicons
      name={props.focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"}
      size={22}
      color={props.focused ? ICON_ACTIVE : ICON_INACTIVE}
    />
  ),
  profile: (props: any) => (
    <Ionicons
      name={props.focused ? "person" : "person-outline"}
      size={22}
      color={props.focused ? ICON_ACTIVE : ICON_INACTIVE}
    />
  ),
};

const LABEL: Record<string, string> = {
  workout: "Workout",
  nutrition: "Nutrition",
  chatbot: "Chat",
  profile: "Profile",
};

const BAR_HEIGHT = 72;
const PILL_HEIGHT = 52;

export function TabBar({
  state,
  descriptors,
  navigation,
  vertical,
}: BottomTabBarProps & { vertical?: boolean }) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const tabBarWidth = Math.min(windowWidth * 0.88, 420);
  const buttonWidth = tabBarWidth / state.routes.length;
  const pillWidth = buttonWidth - 16;

  // — animations
  const pillX = useSharedValue(0);
  const hideY = useSharedValue(0);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const pressScale = useSharedValue(1);

  const isChatbot = state.routes[state.index]?.name === "chatbot";

  // hide/show for chatbot screen — fast, no bounce
  useEffect(() => {
    hideY.value = withTiming(isChatbot ? 130 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [isChatbot]);

  // pill indicator — fast cubic ease, zero bounce
  useEffect(() => {
    const offset = (buttonWidth - pillWidth) / 2;
    pillX.value = withTiming(buttonWidth * state.index + offset, {
      duration: 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [state.index, buttonWidth, pillWidth]);

  // drag gesture — long press to grab, spring snap back on release
  const pan = Gesture.Pan()
    .activateAfterLongPress(320)
    .onStart(() => {
      pressScale.value = withTiming(0.965, { duration: 120 });
    })
    .onUpdate((e) => {
      dragX.value = e.translationX;
      dragY.value = e.translationY;
    })
    .onEnd(() => {
      pressScale.value = withSpring(1, { damping: 22, stiffness: 320 });
      dragX.value = withSpring(0, { damping: 18, stiffness: 200, mass: 0.85 });
      dragY.value = withSpring(0, { damping: 18, stiffness: 200, mass: 0.85 });
    })
    .onFinalize(() => {
      // safety — restore if gesture is cancelled mid-drag
      pressScale.value = withSpring(1, { damping: 22, stiffness: 320 });
      dragX.value = withSpring(0, { damping: 18, stiffness: 200, mass: 0.85 });
      dragY.value = withSpring(0, { damping: 18, stiffness: 200, mass: 0.85 });
    });

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value },
      { translateY: hideY.value + dragY.value },
      { scale: pressScale.value },
    ],
    opacity: interpolate(hideY.value, [0, 80, 130], [1, 0.3, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.wrapper,
          {
            bottom: Math.max(insets.bottom, 12) + 10,
            width: tabBarWidth,
          },
          wrapperStyle,
        ]}
      >
        <BlurView
          experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
          intensity={Platform.OS === "ios" ? 85 : 55}
          tint={Platform.OS === "ios" ? "systemChromeMaterialDark" : "dark"}
          style={[styles.bar, { width: tabBarWidth, height: BAR_HEIGHT }]}
        >
          {/* thin top-edge highlight — the only glass cue needed */}
          <View style={styles.topEdge} pointerEvents="none" />

          {/* border */}
          <View style={styles.border} pointerEvents="none" />

          {/* ── Active pill ──────────────────────────────────────────────── */}
          <Animated.View
            style={[
              styles.pill,
              {
                top: (BAR_HEIGHT - PILL_HEIGHT) / 2,
                width: pillWidth,
                height: PILL_HEIGHT,
              },
              pillStyle,
            ]}
          />

          {/* ── Tab buttons ──────────────────────────────────────────────── */}
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const label = LABEL[route.name] ?? options.tabBarLabel ?? route.name;
            const isFocused = state.index === index;

            const onPress = () => {
              const offset = (buttonWidth - pillWidth) / 2;
              pillX.value = withTiming(buttonWidth * index + offset, {
                duration: 200,
                easing: Easing.out(Easing.cubic),
              });

              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <TouchableOpacity
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={onPress}
                style={{
                  width: buttonWidth,
                  height: BAR_HEIGHT,
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: isFocused ? 2 : 1,
                }}
                activeOpacity={0.72}
              >
                <View style={styles.tabContent}>
                  {icon[route.name as keyof typeof icon]?.({ focused: isFocused })}
                  <Text
                    style={[
                      styles.label,
                      { color: isFocused ? "#000000" : "rgba(255,255,255,0.45)" },
                    ]}
                  >
                    {String(label)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </BlurView>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(8, 16, 8, 0.68)",
    borderRadius: 100,
    overflow: "hidden",
  },
  topEdge: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 100,
    zIndex: 4,
  },
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 100,
    borderWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    borderLeftColor: "rgba(255, 255, 255, 0.035)",
    borderBottomColor: "rgba(255, 255, 255, 0.025)",
    borderRightColor: "rgba(255, 255, 255, 0.035)",
    zIndex: 3,
  },
  pill: {
    position: "absolute",
    backgroundColor: theme.primary,
    borderRadius: 100,
    zIndex: 1,
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  label: {
    fontSize: 10,
    fontFamily: theme.bold,
    marginTop: 1,
  },
});
