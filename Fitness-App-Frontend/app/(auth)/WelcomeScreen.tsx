import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { theme } from "@/constants/theme";
import FadeTranslate from "@/components/ui/FadeTranslate";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const AVATARS = [
  require("@/assets/avatars/avatar1.jpg"),
  require("@/assets/avatars/avatar2.jpg"),
  require("@/assets/avatars/avatar3.jpg"),
  require("@/assets/avatars/avatar4.jpg"),
  require("@/assets/avatars/avatar5.jpg"),
  require("@/assets/avatars/avatar6.jpg"),
  require("@/assets/avatars/avatar7.jpg"),
];

// ── Bubble cloud geometry ─────────────────────────────────────────────────────
// Two concentric rings rotating in opposite directions. Each bubble is
// counter-rotated so faces stay upright while orbiting. Ring centers sit near
// the top of the screen so only the lower arc is visible — a drifting cloud.

interface BubbleCfg {
  angle: number;       // degrees on the ring
  size: number;
  img: any;
  pulseDur: number;
  pulseDelay: number;
}

const OUTER_R = SCREEN_W * 0.78;
const OUTER_CY = SCREEN_H * 0.40 - OUTER_R;   // bottom of arc at 40% screen height
const INNER_R = SCREEN_W * 0.45;
const INNER_CY = SCREEN_H * 0.34 - INNER_R;

const OUTER_ANGLES = [8, 26, 43, 60, 79, 95, 113, 130, 148, 165, 184, 200, 218, 236, 253, 270, 288, 305, 322, 340, 356];
const OUTER_SIZES  = [88, 56, 72, 48, 92, 60, 76, 52, 84, 64, 90, 54, 70, 58, 86, 50, 78, 62, 94, 56, 68];
const INNER_ANGLES = [12, 41, 75, 102, 134, 162, 195, 224, 251, 282, 311, 343];
const INNER_SIZES  = [46, 58, 40, 62, 50, 44, 60, 48, 54, 42, 56, 64];

const buildBubbles = (angles: number[], sizes: number[], imgStep: number): BubbleCfg[] =>
  angles.map((angle, i) => ({
    angle,
    size: sizes[i],
    img: AVATARS[(i * imgStep) % AVATARS.length],
    pulseDur: 2200 + ((i * 137) % 1800),
    pulseDelay: (i * 263) % 1500,
  }));

const OUTER_BUBBLES = buildBubbles(OUTER_ANGLES, OUTER_SIZES, 1);
const INNER_BUBBLES = buildBubbles(INNER_ANGLES, INNER_SIZES, 3);

// ── Single avatar bubble: gather-in spring + breathing pulse ──────────────────
function Bubble({
  cfg, index, dx, dy, enterBase,
}: {
  cfg: BubbleCfg; index: number; dx: number; dy: number; enterBase: number;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(enterBase + index * 45),
      Animated.spring(enter, {
        toValue: 1, friction: 7, tension: 46, useNativeDriver: true,
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1, duration: cfg.pulseDur,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0, duration: cfg.pulseDur,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
      ])
    );
    const t = setTimeout(() => loop.start(), 1800 + cfg.pulseDelay);
    return () => { clearTimeout(t); loop.stop(); enter.stopAnimation(); };
  }, []);

  return (
    <Animated.View
      style={{
        width: "100%", height: "100%",
        borderRadius: cfg.size / 2, overflow: "hidden",
        borderWidth: 1.5, borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: "#17181A",
        opacity: enter.interpolate({
          inputRange: [0, 0.35, 1], outputRange: [0, 1, 1], extrapolate: "clamp",
        }),
        transform: [
          { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) },
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
          { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
          { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.055] }) },
        ],
      }}
    >
      <Image source={cfg.img} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
    </Animated.View>
  );
}

// ── Orbiting ring of bubbles ──────────────────────────────────────────────────
function OrbitRing({
  radius, centerY, bubbles, duration, reverse, enterBase,
}: {
  radius: number; centerY: number; bubbles: BubbleCfg[];
  duration: number; reverse: boolean; enterBase: number;
}) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1, duration, easing: Easing.linear, useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ["0deg", "-360deg"] : ["0deg", "360deg"],
  });
  const counter = spin.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ["0deg", "360deg"] : ["0deg", "-360deg"],
  });

  const S = (radius + 70) * 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: S, height: S,
        left: SCREEN_W / 2 - S / 2,
        top: centerY - S / 2,
        transform: [{ rotate }],
      }}
    >
      {bubbles.map((b, i) => {
        const rad = (b.angle * Math.PI) / 180;
        const left = S / 2 + radius * Math.cos(rad) - b.size / 2;
        const top = S / 2 + radius * Math.sin(rad) - b.size / 2;
        // gather from outside-in: scatter radially away from the ring center
        const dx = Math.cos(rad) * 150;
        const dy = Math.sin(rad) * 150;
        return (
          <View
            key={i}
            style={{ position: "absolute", left, top, width: b.size, height: b.size }}
          >
            <Animated.View style={{ flex: 1, transform: [{ rotate: counter }] }}>
              <Bubble cfg={b} index={i} dx={dx} dy={dy} enterBase={enterBase} />
            </Animated.View>
          </View>
        );
      })}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const logoEnter = useRef(new Animated.Value(0)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(1250),
      Animated.spring(logoEnter, {
        toValue: 1, friction: 6, tension: 60, useNativeDriver: true,
      }),
    ]).start();

    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: 1, duration: 2400,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0, duration: 2400,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
      ])
    );
    const t = setTimeout(() => float.start(), 2100);
    return () => { clearTimeout(t); float.stop(); };
  }, []);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Avatar bubble cloud ── */}
      <OrbitRing
        radius={OUTER_R}
        centerY={OUTER_CY}
        bubbles={OUTER_BUBBLES}
        duration={80_000}
        reverse={false}
        enterBase={150}
      />
      <OrbitRing
        radius={INNER_R}
        centerY={INNER_CY}
        bubbles={INNER_BUBBLES}
        duration={65_000}
        reverse
        enterBase={350}
      />

      {/* fade cluster bottom into black */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)", "#000"]}
        pointerEvents="none"
        style={s.clusterFade}
      />

      {/* logo bubble anchoring the cloud */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.logoBubble,
          {
            opacity: logoEnter.interpolate({
              inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: "clamp",
            }),
            transform: [
              { scale: logoEnter.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
              { translateY: logoFloat.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
            ],
          },
        ]}
      >
        <Image
          source={require("@/assets/images/InvictaLogo.png")}
          style={{ width: 42, height: 42 }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* ── Content ── */}
      <SafeAreaView style={s.content} edges={["bottom"]}>
        <View style={s.textBlock}>
          <FadeTranslate order={1} direction="y" translateYFrom={24}>
            <Text style={s.title}>Real athletes.{"\n"}Real routines.</Text>
          </FadeTranslate>
          <FadeTranslate order={2} direction="y" translateYFrom={20}>
            <Text style={s.subtitle}>
              Train with programs built by elite athletes,{"\n"}coaches and creators — made to fit you.
            </Text>
          </FadeTranslate>
        </View>

        <View style={s.bottomBlock}>
          <FadeTranslate order={3} direction="y" translateYFrom={18}>
            <TouchableOpacity
              style={s.primaryBtn}
              activeOpacity={0.9}
              onPress={() => router.push("/Onboarding/Questions/FitnessGoal")}
            >
              <Text style={s.primaryBtnText}>Get Started</Text>
            </TouchableOpacity>
          </FadeTranslate>

          <FadeTranslate order={4} direction="y" translateYFrom={14}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push("/login")}>
              <Text style={s.loginText}>
                Already have an account? <Text style={s.loginHighlight}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </FadeTranslate>

          <FadeTranslate order={5} direction="y" translateYFrom={10}>
            <Text style={s.termsText}>
              By continuing, you accept the Terms of Service{"\n"}and Privacy Policy.
            </Text>
          </FadeTranslate>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", overflow: "hidden" },

  clusterFade: {
    position: "absolute",
    left: 0, right: 0,
    top: SCREEN_H * 0.30,
    height: SCREEN_H * 0.20,
  },

  logoBubble: {
    position: "absolute",
    left: SCREEN_W / 2 - 36,
    top: SCREEN_H * 0.40 - 36,
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#0E0E10",
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.14)",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#AAFB05",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },

  content: {
    flex: 1,
    justifyContent: "flex-end",
    alignSelf: "center",
    width: "100%",
    maxWidth: 480,
    paddingHorizontal: 28,
    paddingBottom: 12,
  },

  textBlock: { alignItems: "center", marginBottom: 40 },
  title: {
    color: "#fff",
    fontFamily: theme.bold,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -0.8,
    textAlign: "center",
    marginBottom: 16,
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: theme.medium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },

  bottomBlock: { alignItems: "center", gap: 20 },
  primaryBtn: {
    backgroundColor: "#fff",
    borderRadius: 30,
    height: 56,
    width: SCREEN_W - 56,
    maxWidth: 420,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: "#000",
    fontSize: 17,
    fontFamily: theme.bold,
  },
  loginText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    fontFamily: theme.regular,
    textAlign: "center",
  },
  loginHighlight: {
    color: "#fff",
    fontFamily: theme.bold,
  },
  termsText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: theme.regular,
    textAlign: "center",
    marginTop: 2,
  },
});
