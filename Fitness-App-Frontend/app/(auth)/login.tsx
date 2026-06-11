import { removeToken, setToken } from "@/api/AxiosInstance";
import { Login, FetchUserInformationAndStore, FetchUserMealsAndStore, GetUserDetails } from "@/api/UserDataEndpoint";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import RevenueCatService from "@/api/RevenueCatService";
import { theme } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "react-native";
import { router } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import FadeTranslate from "@/components/ui/FadeTranslate";

const { width } = Dimensions.get("window");

// ── Design tokens ──────────────────────────────────────────────────
const C = {
  bg:      "#000000",
  card:    "#1C1C1E",
  cardAlt: "#242426",
  border:  "#2C2C2E",
  primary: theme.primary,   // #AAFB05
  text:    "#FFFFFF",
  sub:     "#8E8E93",
  muted:   "#48484A",
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  container: {
    flex: 1,
    alignItems: 'center',
  },
  contentWrapper: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  centerSection: {
    paddingBottom: 32,
  },

  // ── Header ──────────────────────────────────────────────────────────
  headerContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontFamily: theme.bold,
    color: C.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: theme.regular,
    color: C.sub,
    textAlign: 'center',
  },

  // ── Form fields ──────────────────────────────────────────────────────
  formContainer: {
    gap: 16,
    marginTop: 40,
  },
  fieldWrapper: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: theme.medium,
    color: C.sub,
    letterSpacing: 0.3,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 30,
    height: 52,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputIcon: {
    opacity: 0.7,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: theme.regular,
    color: C.text,
    paddingVertical: 0,
    outlineStyle: 'none',
  } as any,
  eyeIcon: {
    padding: 4,
  },

  // ── Bottom / CTA ─────────────────────────────────────────────────────
  bottomSection: {
    alignItems: 'center',
    gap: 20,
  },
  loginButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    height: 56,
    width: width - 48,
    maxWidth: 400,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingIcon: {},
  loginButtonText: {
    color: '#000000',
    fontSize: 16,
    fontFamily: theme.bold,
  },
  signupText: {
    color: C.sub,
    fontSize: 14,
    fontFamily: theme.regular,
    textAlign: 'center',
  },
  signupTextHighlight: {
    color: '#FFFFFF',
    fontFamily: theme.bold,
  },
});

export const LoginScreen = () => {
  const [Email, setEmail] = useState<string>("");
  const [Password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Rotation animation
  useEffect(() => {
    if (isLoading) {
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      rotateAnimation.start();
      return () => rotateAnimation.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [isLoading]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  async function handleSubmit() {
    if (isLoading) return; // Prevent multiple submissions
    
    setIsLoading(true);
    try {
      const response = await Login({ email: Email, password: Password });
      if (!response || !response.token) {
        Toast.show({
          type: "error",
          text1: "Login Error",
          text2: "Login failed.",
        });
        return;
      } else {
        await setToken(response.token);
        
        // Fetch and store user data in local database
        try {
          const userId = await getUserIdFromToken();
          if (!userId) {
            throw new Error("Login token was invalid.");
          }
          if (userId) {
            console.log("🔐 Fetching user data for userId:", userId);
            await FetchUserInformationAndStore(userId);
            console.log("✅ User data fetched and stored successfully");
            
            // Identify user with RevenueCat and pass user attributes
            try {
              console.log("📱 Identifying user with RevenueCat...");
              // Get user details to pass as attributes
              const userDetails = await GetUserDetails();
              await RevenueCatService.identifyUser(userId, {
                email: userDetails?.email,
                name: userDetails?.name,
              });
              console.log("✅ RevenueCat user identified with attributes");
            } catch (revenueCatError) {
              console.warn("⚠️ RevenueCat identification failed:", revenueCatError);
              // Don't block login if RevenueCat fails
            }
            
            // Fetch and store user meals
            try {
              console.log("🍽️ Fetching user meals...");
              await FetchUserMealsAndStore(userId);
              console.log("✅ User meals fetched and stored successfully");
            } catch (mealsError) {
              console.error("⚠️ Failed to fetch user meals, but login succeeded:", mealsError);
              // Don't block login if meals fetch fails
            }
          }
        } catch (userDataError) {
          console.error("⚠️ Failed to fetch user data, but login succeeded:", userDataError);
          // Do not enter the app with a token but no local profile data.
          await removeToken();
          throw userDataError;
        }
        
        router.replace("/SubscriptionCheck");
      }
    } catch (error: any) {
      console.error("Submission error:", error);
      const msg =
        error?.response?.data && typeof error.response.data === "string"
          ? error.response.data
          : "An unexpected error occurred. Please try again.";
      Toast.show({
        type: "error",
        text1: "Error",
        text2: msg,
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.contentWrapper}>
        {/* Header + Form centered */}
        <View style={styles.centerSection}>

        {/* Header */}
        <View style={styles.headerContainer}>
          <FadeTranslate order={1}>
            <Image
              source={require('@/assets/images/InvictaLogo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </FadeTranslate>
          <FadeTranslate order={2}>
            <Text style={styles.title}>Welcome back</Text>
          </FadeTranslate>
          <FadeTranslate order={3}>
            <Text style={styles.subtitle}>Sign in to continue your journey</Text>
          </FadeTranslate>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <FadeTranslate order={4}>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={18} color="#48484A" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#48484A"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={Email}
                  onChangeText={setEmail}
                  underlineColorAndroid="transparent"
                />
              </View>
            </View>
          </FadeTranslate>

          <FadeTranslate order={5}>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={18} color="#48484A" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#48484A"
                  autoCapitalize="none"
                  autoComplete="password"
                  value={Password}
                  onChangeText={setPassword}
                  underlineColorAndroid="transparent"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#8E8E93" />
                </TouchableOpacity>
              </View>
            </View>
          </FadeTranslate>
        </View>

        {/* end centerSection */}
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <FadeTranslate order={6}>
            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <Animated.View style={[styles.loadingIcon, { transform: [{ rotate: rotateInterpolate }] }]}>
                    <Ionicons name="sync-outline" size={18} color="#000000" />
                  </Animated.View>
                  <Text style={styles.loginButtonText}>Signing in...</Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </FadeTranslate>

          <FadeTranslate order={7}>
            <TouchableOpacity onPress={() => router.push("/WelcomeScreen")} activeOpacity={0.7}>
              <Text style={styles.signupText}>
                Don&apos;t have an account?{" "}
                <Text style={styles.signupTextHighlight}>Get started</Text>
              </Text>
            </TouchableOpacity>
          </FadeTranslate>
        </View>

        {/* end contentWrapper */}
        </View>
      </SafeAreaView>
    </View>
  );
};

export default LoginScreen;
