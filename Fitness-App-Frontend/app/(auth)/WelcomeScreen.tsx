import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, {
  Circle as SvgCircle,
  Ellipse as SvgEllipse,
  Defs,
  RadialGradient as SvgRadialGradient,
  LinearGradient as SvgLinearGradient,
  Stop,
} from "react-native-svg";
import { router } from "expo-router";
import { theme } from "@/constants/theme";

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
interface BubbleCfg {
  angle: number;
  size: number;
  img: any;
  pulseDur: number;
  pulseDelay: number;
}
interface RingCfg {
  radius: number;
  centerY: number;
  duration: number;
  reverse: boolean;
  enterBase: number;
  bubbles: BubbleCfg[];
}

const JITTER = [0, 4, -3, 5, -4, 2];
const buildBubbles = (sizes: number[], angleOffset: number, imgStep: number): BubbleCfg[] =>
  sizes.map((size, i) => ({
    angle: i * (360 / sizes.length) + angleOffset + JITTER[i % JITTER.length],
    size,
    img: AVATARS[(i * imgStep) % AVATARS.length],
    pulseDur: 2300 + ((i * 137) % 1700),
    pulseDelay: (i * 263) % 1500,
  }));

const OUTER_SIZES  = [88, 68, 92, 72, 80, 66, 94, 70, 84, 68, 90, 66, 78, 72, 96, 68, 86, 66, 92, 70, 82, 68, 88, 72];
const MIDDLE_SIZES = [70, 58, 76, 60, 68, 56, 78, 62, 72, 58, 74, 56, 66, 60, 78, 58, 70, 56, 76, 62, 68, 58, 72, 60];
const INNER_SIZES  = [58, 48, 64, 50, 60, 46, 66, 52, 62, 48, 64, 46, 56, 50, 68, 48, 60, 46, 64, 52, 58, 48, 62, 50];

const RINGS: RingCfg[] = [
  { radius: SCREEN_W * 0.78, centerY: SCREEN_H * 0.42 - SCREEN_W * 0.78, duration: 80_000, reverse: false, enterBase: 120, bubbles: buildBubbles(OUTER_SIZES, 0, 1) },
  { radius: SCREEN_W * 0.70, centerY: SCREEN_H * 0.365 - SCREEN_W * 0.70, duration: 68_000, reverse: true,  enterBase: 260, bubbles: buildBubbles(MIDDLE_SIZES, 7.5, 3) },
  { radius: SCREEN_W * 0.62, centerY: SCREEN_H * 0.30 - SCREEN_W * 0.62, duration: 58_000, reverse: false, enterBase: 400, bubbles: buildBubbles(INNER_SIZES, 4, 2) },
];

// ── Glass shader overlay ──────────────────────────────────────────────────────
function GlassOverlay({ size }: { size: number }) {
  const r = size / 2;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgRadialGradient id="vig" cx="50%" cy="50%" r="50%">
          <Stop offset="60%" stopColor="#000" stopOpacity="0" />
          <Stop offset="86%" stopColor="#000" stopOpacity="0.16" />
          <Stop offset="100%" stopColor="#000" stopOpacity="0.42" />
        </SvgRadialGradient>
        <SvgRadialGradient id="gloss" cx="32%" cy="22%" r="48%">
          <Stop offset="0%" stopColor="#fff" stopOpacity="0.42" />
          <Stop offset="55%" stopColor="#fff" stopOpacity="0.1" />
          <Stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </SvgRadialGradient>
        <SvgLinearGradient id="rim" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <Stop offset="45%" stopColor="#fff" stopOpacity="0.08" />
          <Stop offset="100%" stopColor="#fff" stopOpacity="0.03" />
        </SvgLinearGradient>
      </Defs>
      <SvgCircle cx={r} cy={r} r={r} fill="url(#vig)" />
      <SvgCircle cx={r} cy={r} r={r} fill="url(#gloss)" />
      <SvgCircle cx={r} cy={r} r={r - 0.75} stroke="url(#rim)" strokeWidth={1.5} fill="none" />
      <SvgEllipse
        cx={size * 0.34} cy={size * 0.2}
        rx={r * 0.18} ry={r * 0.1}
        fill="#fff" opacity={0.38}
        transform={`rotate(-28 ${size * 0.34} ${size * 0.2})`}
      />
    </Svg>
  );
}

// ── Single avatar bubble ──────────────────────────────────────────────────────
function Bubble({ cfg, index, dx, dy, enterBase }: {
  cfg: BubbleCfg; index: number; dx: number; dy: number; enterBase: number;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(enterBase + index * 30),
      Animated.spring(enter, { toValue: 1, friction: 7, tension: 46, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: cfg.pulseDur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: cfg.pulseDur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const t = setTimeout(() => loop.start(), 1700 + cfg.pulseDelay);
    return () => { clearTimeout(t); loop.stop(); enter.stopAnimation(); };
  }, []);

  return (
    <Animated.View
      style={{
        width: "100%", height: "100%",
        borderRadius: cfg.size / 2, overflow: "hidden",
        backgroundColor: "#141416",
        opacity: enter.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1], extrapolate: "clamp" }),
        transform: [
          { translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) },
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
          { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
          { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) },
        ],
      }}
    >
      <Image source={cfg.img} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      <GlassOverlay size={cfg.size} />
    </Animated.View>
  );
}

// ── Orbiting ring ─────────────────────────────────────────────────────────────
function OrbitRing({ ring }: { ring: RingCfg }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: ring.duration, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const rotate  = spin.interpolate({ inputRange: [0, 1], outputRange: ring.reverse ? ["0deg", "-360deg"] : ["0deg", "360deg"] });
  const counter = spin.interpolate({ inputRange: [0, 1], outputRange: ring.reverse ? ["0deg", "360deg"] : ["0deg", "-360deg"] });
  const S = (ring.radius + 70) * 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: S, height: S,
        left: SCREEN_W / 2 - S / 2,
        top: ring.centerY - S / 2,
        transform: [{ rotate }],
      }}
    >
      {ring.bubbles.map((b, i) => {
        const rad = (b.angle * Math.PI) / 180;
        const left = S / 2 + ring.radius * Math.cos(rad) - b.size / 2;
        const top  = S / 2 + ring.radius * Math.sin(rad) - b.size / 2;
        const dx = Math.cos(rad) * 130;
        const dy = Math.sin(rad) * 130;
        return (
          <View key={i} style={{ position: "absolute", left, top, width: b.size, height: b.size }}>
            <Animated.View style={{ flex: 1, transform: [{ rotate: counter }] }}>
              <Bubble cfg={b} index={i} dx={dx} dy={dy} enterBase={ring.enterBase} />
            </Animated.View>
          </View>
        );
      })}
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();

  // ── Loading overlay ──────────────────────────────────────────────────────
  const [overlayActive, setOverlayActive] = useState(true);
  const loadingOpacity = useRef(new Animated.Value(1)).current;
  const spinAnim       = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // ── Dismiss animation ────────────────────────────────────────────────────
  const dismissAnim = useRef(new Animated.Value(0)).current;

  // ── Mount effects ────────────────────────────────────────────────────────
  useEffect(() => {
    // Spin the loading arc
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 750, easing: Easing.linear, useNativeDriver: true })
    );
    spinLoop.start();

    // After 750ms reveal the content
    const timer = setTimeout(() => {
      spinLoop.stop();
      Animated.parallel([
        // fade out loader
        Animated.timing(loadingOpacity, {
          toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        // fade in content (starts slightly after loader starts fading)
        Animated.timing(contentOpacity, {
          toValue: 1, duration: 500, delay: 100, easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setOverlayActive(false);
      });
    }, 750);

    return () => {
      clearTimeout(timer);
      spinLoop.stop();
    };
  }, []);

  // ── Get Started handler ──────────────────────────────────────────────────
  const handleGetStarted = useCallback(() => {
    Animated.timing(dismissAnim, {
      toValue: 1, duration: 560,
      easing: Easing.in(Easing.quad), useNativeDriver: true,
    }).start(() => router.push("/Onboarding/Questions/FitnessGoal"));
  }, []);

  // ── Derived dismiss values ───────────────────────────────────────────────
  const bubblesOpacity = dismissAnim.interpolate({ inputRange: [0, 0.60, 1], outputRange: [1, 1, 0] });
  const bubblesScale   = dismissAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.38] });
  const logoScale      = dismissAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const logoOpacity    = dismissAnim.interpolate({ inputRange: [0, 0.42, 1], outputRange: [1, 0, 0] });
  const textOpacity    = dismissAnim.interpolate({ inputRange: [0, 0.46, 1], outputRange: [1, 0, 0] });
  const textTranslate  = dismissAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -40] });
  const btnOpacity     = dismissAnim.interpolate({ inputRange: [0, 0.38, 1], outputRange: [1, 0, 0] });
  const btnScale       = dismissAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] });

  const spinInterp = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Bubble cloud + gradient — all wrapped for dismiss scale ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { opacity: bubblesOpacity, transform: [{ scale: bubblesScale }] },
        ]}
      >
        {RINGS.map((ring, i) => <OrbitRing key={i} ring={ring} />)}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.88)", "#000"]}
          style={s.clusterFade}
          pointerEvents="none"
        />
      </Animated.View>

      {/* ── Logo ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          s.topLogo,
          { top: insets.top + 10 },
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Animated.View style={{ opacity: contentOpacity }}>
          <Image
            source={require("@/assets/images/InvictaLogo.png")}
            style={{ width: 44, height: 44 }}
            resizeMode="contain"
          />
        </Animated.View>
      </Animated.View>

      {/* ── Content ── */}
      <SafeAreaView style={s.content} edges={["bottom"]}>
        {/* Title + subtitle */}
        <Animated.View
          style={[
            s.textBlock,
            {
              opacity: Animated.multiply(contentOpacity, textOpacity) as any,
              transform: [{ translateY: textTranslate }],
            },
          ]}
        >
          <Text style={s.title}>Built by pros.{"\n"}Made for you.</Text>
          <Text style={s.subtitle}>
            Programs from elite coaches and athletes,{"\n"}personalized for your goals.
          </Text>
        </Animated.View>

        {/* Buttons */}
        <Animated.View
          style={[
            s.bottomBlock,
            {
              opacity: Animated.multiply(contentOpacity, btnOpacity) as any,
              transform: [{ scale: btnScale }],
            },
          ]}
        >
          <TouchableOpacity
            style={s.primaryBtn}
            activeOpacity={0.9}
            onPress={handleGetStarted}
          >
            <Text style={s.primaryBtnText}>Get Started</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7} onPress={() => router.push("/login")}>
            <Text style={s.loginText}>
              Already have an account? <Text style={s.loginHighlight}>Sign In</Text>
            </Text>
          </TouchableOpacity>

          <Text style={s.termsText}>
            By continuing, you accept the Terms of Service{"\n"}and Privacy Policy.
          </Text>
        </Animated.View>
      </SafeAreaView>

      {/* ── Loading overlay (always on top while active) ── */}
      {overlayActive && (
        <Animated.View
          style={[StyleSheet.absoluteFill, s.loadingOverlay, { opacity: loadingOpacity }]}
          pointerEvents="auto"
        >
          <Animated.View
            style={[s.spinner, { transform: [{ rotate: spinInterp }] }]}
          />
        </Animated.View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", overflow: "hidden" },

  clusterFade: {
    position: "absolute",
    left: 0, right: 0,
    top: SCREEN_H * 0.34,
    height: SCREEN_H * 0.20,
  },

  topLogo: {
    position: "absolute",
    left: 0, right: 0,
    alignItems: "center",
    zIndex: 10,
  },

  content: {
    flex: 1,
    justifyContent: "flex-end",
    alignSelf: "center",
    width: "100%",
    maxWidth: 480,
    paddingHorizontal: 28,
    paddingBottom: 48,
  },

  textBlock: { alignItems: "center", marginBottom: 42 },
  title: {
    color: "#fff",
    fontFamily: theme.bold,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -0.8,
    textAlign: "center",
    marginBottom: 14,
  },
  subtitle: {
    color: "rgba(255,255,255,0.58)",
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
    color: "rgba(255,255,255,0.28)",
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: theme.regular,
    textAlign: "center",
    marginTop: 2,
  },

  // Loading overlay
  loadingOverlay: {
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  spinner: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    borderTopColor: "rgba(255,255,255,0.72)",
  },
});
