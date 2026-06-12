import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  Image,
  StatusBar,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import { ROUTINES, RoutineExercise } from "@/constants/workoutRoutines";

const { width: W, height: H } = Dimensions.get("window");

// Hero takes ~78% of screen — matches the composition in the mockup
const HERO_H = Math.round(H * 0.78);
const ROUND_SIZE = 3;
const CONTENT_PAD_H = 20;
const DIVIDER_H = 48;      // height of the "˅" at the top of the content area
const ROUNDS_PAD_TOP = 16; // gap between divider and first "Round" label
const ROUND_HEADER_H = 42;
const ROUND_BOTTOM_GAP = 22;
const EX_ROW_H = 78;
const EX_ROW_GAP = 10;
const FADE_RANGE = 90;

const C = {
  bg: "#0A0A0A",
  primary: "#AAFB05",
  text: "#FFFFFF",
  sub: "rgba(255,255,255,0.42)",
  card: "#1C1C1E",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(s?: number): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")} min`;
}

function chunk<T>(arr: T[], n: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / n) }, (_, i) =>
    arr.slice(i * n, (i + 1) * n)
  );
}

// Compute absolute Y positions of round headers and exercise rows in scroll content
function buildLayout(rounds: RoutineExercise[][]) {
  const roundY: number[] = [];
  const exY: number[] = [];
  // Content starts after hero + topDivider + roundsPadTop
  let y = HERO_H + DIVIDER_H + ROUNDS_PAD_TOP;
  for (const round of rounds) {
    roundY.push(y);
    y += ROUND_HEADER_H;
    for (let e = 0; e < round.length; e++) {
      exY.push(y);
      y += EX_ROW_H + (e < round.length - 1 ? EX_ROW_GAP : 0);
    }
    y += ROUND_BOTTOM_GAP;
  }
  return { roundY, exY };
}

// Items within the initial viewport (posY <= H - half of fade range) are always visible.
// Items below the fold fade + slide in as the user scrolls to them.
function fadeIn(sv: Animated.Value, posY: number): Animated.AnimatedInterpolation<number> {
  if (posY <= H - FADE_RANGE / 2) {
    return sv.interpolate({ inputRange: [0, 1], outputRange: [1, 1], extrapolate: "clamp" });
  }
  const start = posY - H;
  const end = Math.max(start + 1, posY - H + FADE_RANGE);
  return sv.interpolate({ inputRange: [start, end], outputRange: [0, 1], extrapolate: "clamp" });
}

function slideIn(sv: Animated.Value, posY: number, from = 18): Animated.AnimatedInterpolation<number> {
  if (posY <= H - FADE_RANGE / 2) {
    return sv.interpolate({ inputRange: [0, 1], outputRange: [0, 0], extrapolate: "clamp" });
  }
  const start = posY - H;
  const end = Math.max(start + 1, posY - H + FADE_RANGE);
  return sv.interpolate({ inputRange: [start, end], outputRange: [from, 0], extrapolate: "clamp" });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RoutineDetail() {
  const insets = useSafeAreaInsets();
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const scrollY = useRef(new Animated.Value(0)).current;

  // Mount animations for hero overlay content
  const titleO  = useRef(new Animated.Value(0)).current;
  const titleY  = useRef(new Animated.Value(26)).current;
  const statsO  = useRef(new Animated.Value(0)).current;
  const statsY  = useRef(new Animated.Value(18)).current;
  const btnS    = useRef(new Animated.Value(0.88)).current;
  const btnO    = useRef(new Animated.Value(0)).current;
  const hintO   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(80),
      Animated.parallel([
        Animated.timing(titleO, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.timing(titleY, { toValue: 0, duration: 480, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(statsO, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(statsY, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(btnS, { toValue: 1, friction: 7, tension: 130, useNativeDriver: true }),
        Animated.timing(btnO, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.timing(hintO, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  const routine = ROUTINES.find((r) => r.id === routineId);

  if (!routine) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ color: C.text, fontFamily: theme.medium }}>Routine not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: C.primary, fontFamily: theme.bold }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const rounds = chunk(routine.exercises, ROUND_SIZE);
  const { roundY, exY } = buildLayout(rounds);

  const totalKcal = Math.round(
    routine.exercises.reduce((sum, ex) => sum + (ex.expectedCalories || 0) * ex.sets, 0)
  );

  // The scroll-hint chevrons start pointing UP (˄˄ = pull up for details)
  // and rotate to DOWN (˅˅) once the user has scrolled into the content.
  const chevronRotate = scrollY.interpolate({
    inputRange: [0, H * 0.28],
    outputRange: ["0deg", "180deg"],
    extrapolate: "clamp",
  });

  // "Details" label fades away as the user scrolls
  const detailsTxtO = Animated.multiply(
    hintO,
    scrollY.interpolate({
      inputRange: [0, H * 0.14],
      outputRange: [1, 0],
      extrapolate: "clamp",
    })
  );

  const handleStart = () =>
    router.replace({ pathname: "/WorkoutPlayer", params: { routineId: routine.id } });

  const handleExercise = (ex: RoutineExercise) =>
    router.push({
      pathname: "/ExerciseDetail",
      params: {
        exerciseId: ex.exerciseId,
        name: ex.name,
        sets: ex.sets?.toString(),
        reps: ex.reps?.toString(),
        restSeconds: ex.restSeconds?.toString(),
        category: ex.category,
        gifUrl: ex.gifUrl || "",
      },
    });

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Animated.ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 52 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        bounces
      >
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <View style={[s.hero, { height: HERO_H }]}>
          {/* Background: photo or gradient fallback */}
          {routine.image ? (
            <Image source={{ uri: routine.image }} style={s.heroBg} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={routine.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.65, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          )}

          {/* Gradient overlay — darkens the bottom so text reads clearly */}
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.52)", "rgba(8,8,8,0.98)"]}
            locations={[0.38, 0.66, 1]}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Back button */}
          <TouchableOpacity
            style={[s.back, { top: insets.top + 14 }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={21} color="#FFF" />
          </TouchableOpacity>

          {/* Bottom content overlay */}
          <View style={s.heroBot}>
            {/* Title */}
            <Animated.Text
              style={[s.heroTitle, { opacity: titleO, transform: [{ translateY: titleY }] }]}
              numberOfLines={2}
            >
              {routine.name}
            </Animated.Text>

            {/* Stat chips: ⚡ Kcal  ⏱ Duration */}
            <Animated.View
              style={[s.statsRow, { opacity: statsO, transform: [{ translateY: statsY }] }]}
            >
              {totalKcal > 0 && (
                <View style={s.chip}>
                  <Ionicons name="flash" size={13} color={C.primary} />
                  <Text style={s.chipTxt}>{totalKcal} Kcal</Text>
                </View>
              )}
              <View style={s.chip}>
                <Ionicons name="time-outline" size={13} color={C.primary} />
                <Text style={s.chipTxt}>{routine.duration}</Text>
              </View>
            </Animated.View>

            {/* Start Workout button — lime pill, dark circle play icon on right */}
            <Animated.View style={{ opacity: btnO, transform: [{ scale: btnS }] }}>
              <TouchableOpacity style={s.startBtn} onPress={handleStart} activeOpacity={0.84}>
                <Text style={s.startLabel}>Start Workout</Text>
                <View style={s.startCircle}>
                  <Ionicons name="play" size={15} color={C.primary} />
                </View>
              </TouchableOpacity>
            </Animated.View>

            {/* Scroll indicator:
                ˄˄ + "Details" at rest  →  ˅˅ (rotated 180°) + no text when scrolled */}
            <Animated.View style={[s.detailHint, { opacity: hintO }]}>
              <Animated.View
                style={{ alignItems: "center", transform: [{ rotate: chevronRotate }] }}
              >
                <Ionicons
                  name="chevron-up"
                  size={14}
                  color="rgba(255,255,255,0.42)"
                  style={{ marginBottom: -6 }}
                />
                <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.22)" />
              </Animated.View>
              <Animated.Text style={[s.detailHintTxt, { opacity: detailsTxtO }]}>
                Details
              </Animated.Text>
            </Animated.View>
          </View>
        </View>

        {/* ── Content ────────────────────────────────────────────────── */}
        <View style={s.content}>
          {/* Single ˅ divider — appears between hero and exercise list in the scrolled view */}
          <View style={s.topDivider}>
            <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.18)" />
          </View>

          {/* Round sections */}
          <View style={s.rounds}>
            {rounds.map((round, rIdx) => (
              <View key={rIdx} style={s.roundSection}>
                {/* Round label */}
                <Animated.Text
                  style={[
                    s.roundLabel,
                    {
                      opacity: fadeIn(scrollY, roundY[rIdx]),
                      transform: [{ translateY: slideIn(scrollY, roundY[rIdx], 14) }],
                    },
                  ]}
                >
                  Round {rIdx + 1}
                </Animated.Text>

                {/* Exercise rows */}
                {round.map((ex, eIdx) => {
                  const gi = rIdx * ROUND_SIZE + eIdx;
                  const dur = fmtTime(ex.durationSeconds);
                  const meta = dur || (ex.reps ? `${ex.sets} × ${ex.reps}` : "");

                  return (
                    <Animated.View
                      key={eIdx}
                      style={[
                        s.exCard,
                        eIdx > 0 && { marginTop: EX_ROW_GAP },
                        {
                          opacity: fadeIn(scrollY, exY[gi]),
                          transform: [{ translateY: slideIn(scrollY, exY[gi], 18) }],
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={s.exInner}
                        activeOpacity={0.72}
                        onPress={() => handleExercise(ex)}
                      >
                        {/* GIF thumbnail */}
                        <View style={s.exThumb}>
                          {ex.gifUrl ? (
                            <Image
                              source={{ uri: ex.gifUrl }}
                              style={s.exImg}
                              resizeMode="cover"
                            />
                          ) : (
                            <Ionicons name="barbell-outline" size={22} color="#555" />
                          )}
                        </View>

                        {/* Name + meta */}
                        <View style={s.exInfo}>
                          <Text style={s.exName} numberOfLines={1}>{ex.name}</Text>
                          {meta ? <Text style={s.exMeta}>{meta}</Text> : null}
                        </View>

                        {/* Play circle */}
                        <View style={s.exPlay}>
                          <Ionicons name="play" size={12} color="rgba(255,255,255,0.72)" />
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },

  // ── Hero ────────────────────────────────────────────────────────────────────
  hero: { width: W, overflow: "hidden" },
  heroBg: { ...StyleSheet.absoluteFillObject, width: W } as any,

  back: {
    position: "absolute",
    left: 20,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.38)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroBot: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: CONTENT_PAD_H + 4,
    paddingBottom: 22,
  },

  heroTitle: {
    fontFamily: theme.black,
    fontSize: 36,
    color: C.text,
    letterSpacing: -1,
    lineHeight: 42,
    marginBottom: 12,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginBottom: 18,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  chipTxt: {
    fontFamily: theme.semibold,
    fontSize: 14,
    color: C.text,
  },

  // Lime pill with dark play circle — mirrors the image exactly
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.primary,
    borderRadius: 32,
    height: 58,
    paddingLeft: 26,
    paddingRight: 8,
  },
  startLabel: {
    flex: 1,
    fontFamily: theme.bold,
    fontSize: 17,
    color: "#000",
    letterSpacing: -0.2,
  },
  startCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Scroll indicator: ˄˄ Details → rotates to ˅˅ on scroll
  detailHint: {
    alignItems: "center",
    marginTop: 14,
  },
  detailHintTxt: {
    fontFamily: theme.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.36)",
    marginTop: 5,
    letterSpacing: 0.5,
  },

  // ── Content ─────────────────────────────────────────────────────────────────
  content: { backgroundColor: C.bg },

  // Single ˅ shown between hero and exercise list once scrolled (matches right phone in image)
  topDivider: {
    height: DIVIDER_H,
    alignItems: "center",
    justifyContent: "center",
  },

  rounds: {
    paddingHorizontal: CONTENT_PAD_H,
    paddingTop: ROUNDS_PAD_TOP,
    paddingBottom: 24,
  },
  roundSection: {
    marginBottom: ROUND_BOTTOM_GAP,
  },
  roundLabel: {
    fontFamily: theme.semibold,
    fontSize: 14,
    color: "rgba(255,255,255,0.40)",
    marginBottom: 10,
    letterSpacing: 0.3,
  },

  // ── Exercise card ────────────────────────────────────────────────────────────
  exCard: {
    borderRadius: 18,
    backgroundColor: C.card,
    overflow: "hidden",
  },
  exInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    minHeight: EX_ROW_H,
  },
  exThumb: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: "#111",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  exImg: { width: "100%" as any, height: "100%" as any },
  exInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  exName: {
    fontFamily: theme.bold,
    fontSize: 15,
    color: C.text,
    marginBottom: 5,
  },
  exMeta: {
    fontFamily: theme.medium,
    fontSize: 13,
    color: C.sub,
  },
  exPlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    marginRight: 4,
  },
});
