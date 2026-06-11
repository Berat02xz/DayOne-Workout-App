import React from "react";
import {
  ActivityIndicator,
  View,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import ChatbotScreen from "./chatbot/index";
import WorkoutScreen from "./workout/index";
import NutritionScreen from "./nutrition/index";
import ProfileScreen from "./profile/index";
import { TabBar } from "@/components/ui/TabBarUi/TabBar";
import { theme } from "@/constants/theme";
import { ensureAuthenticatedSession } from "@/api/AuthSession";
import { router } from "expo-router";

const Tab = createBottomTabNavigator();

// Persists across remounts so the correct tab is restored when
// navigating back from a (screens) route.
let lastActiveTab = "workout";

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 1400;
  const [authReady, setAuthReady] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    (async () => {
      const isAuthenticated = await ensureAuthenticatedSession();
      if (!active) {
        return;
      }
      if (!isAuthenticated) {
        router.replace("/WelcomeScreen");
        return;
      }
      setAuthReady(true);
    })();

    return () => {
      active = false;
    };
  }, []);

  if (!authReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <BottomSheetModalProvider>
    <View style={{ flex: 1, flexDirection: isLargeScreen ? "row" : "column", backgroundColor: theme.backgroundColor }}>
      <Tab.Navigator
        initialRouteName={lastActiveTab}
        tabBar={props =>
          isLargeScreen
            ? <TabBar {...props} vertical />
            : <TabBar {...props} />
        }
        screenOptions={{
          headerShown: false,
          animation: "shift",
          sceneStyle: { backgroundColor: theme.backgroundColor },
        }}
        screenListeners={{
          state: (e) => {
            const state = e.data?.state;
            if (state) {
              lastActiveTab = state.routes[state.index]?.name ?? "workout";
            }
          },
        }}
      >
        <Tab.Screen
          name="workout"
          component={WorkoutScreen}
          options={{ tabBarLabel: "Workout" }}
        />
        <Tab.Screen
          name="nutrition"
          component={NutritionScreen}
          options={{ tabBarLabel: "Nutrition" }}
        />
        <Tab.Screen
          name="chatbot"
          component={ChatbotScreen}
          options={{ tabBarLabel: "Chatbot" }}
        />
        <Tab.Screen
          name="profile"
          component={ProfileScreen}
          options={{ tabBarLabel: "Profile" }}
        />
      </Tab.Navigator>
    </View>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.backgroundColor,
  },
});
