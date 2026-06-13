import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurTargetView, BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ROUTINES, type RoutineExercise } from "@/constants/workoutRoutines";
import { SquircleSurface } from "@/components/ui/Squircle";
import { theme } from "@/constants/theme";

const H_PAD = 18;
const CARD_MARGIN = 16;
const SHEET_OVERLAP = 54;
const SUMMARY_H = 158;
const SUMMARY_OVERHANG = 86;          // how far the card rises above the sheet
const SUMMARY_RADIUS = 34;
const CTA_HEIGHT = 58;

const TRAINER_AVATARS = [
  require("@/assets/avatars/avatar1.jpg"),
  require("@/assets/avatars/avatar2.jpg"),
  require("@/assets/avatars/avatar3.jpg"),
  require("@/assets/avatars/avatar4.jpg"),
  require("@/assets/avatars/avatar5.jpg"),
  require("@/assets/avatars/avatar6.jpg"),
  require("@/assets/avatars/avatar7.jpg"),
];

const C = {
  background: "#000000",
  sheet: "#000000",
  card: "#161719",
  surface: "#141517",
  text: "#FFFFFF",
  muted: "#A3A5A8",
  faint: "#76797C",
  border: "rgba(255,255,255,0.07)",
  primary: theme.primary,
};

function compactCount(value = 0) {
  if (value < 1000) return value.toString();
  const count = value >= 10000 ? Math.round(value / 1000) : (value / 1000).toFixed(1);
  return `${count}k`;
}

function getTrainerAvatar(routineId: string) {
  const index = [...routineId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TRAINER_AVATARS[index % TRAINER_AVATARS.length];
}

function StatPill({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
}) {
  return (
    <View style={s.statPill}>
      <Ionicons name={icon} size={14} color="#D9D9D9" />
      <Text style={s.statPillText}>{label}</Text>
    </View>
  );
}

function ExerciseRow({
  exercise,
  index,
  onPress,
}: {
  exercise: RoutineExercise;
  index: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${exercise.name}`}
      style={({ pressed }) => [s.exerciseRow, pressed && s.exerciseRowPressed]}
    >
      <View style={s.exerciseThumb}>
        {exercise.gifUrl ? (
          <Image source={{ uri: exercise.gifUrl }} style={s.exerciseImage} resizeMode="cover" />
        ) : (
          <Ionicons name="barbell-outline" size={20} color={C.faint} />
        )}
      </View>

      <View style={s.exerciseCopy}>
        <Text style={s.exerciseName} numberOfLines={1}>{exercise.name}</Text>
        <Text style={s.exerciseMeta} numberOfLines={1}>
          {exercise.sets} sets · {exercise.reps} · {exercise.restSeconds}s rest
        </Text>
      </View>

      <Text style={s.exerciseIndex}>{String(index + 1).padStart(2, "0")}</Text>
    </Pressable>
  );
}

export default function RoutineDetail() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const scrollY = useRef(new Animated.Value(0)).current;
  const heroBlurTarget = useRef<View | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [saved, setSaved] = useState(false);

  const routine = ROUTINES.find((item) => item.id === routineId);
  const heroHeight = Math.min(438, Math.max(370, height * 0.52));
  const summaryWidth = width - CARD_MARGIN * 2;

  const totalCalories = useMemo(
    () =>
      Math.round(
        routine?.exercises.reduce(
          (sum, exercise) => sum + (exercise.expectedCalories ?? 0) * exercise.sets,
          0
        ) ?? 0
      ),
    [routine]
  );

  if (!routine) {
    return (
      <View style={s.missing}>
        <Text style={s.missingTitle}>Routine not found</Text>
        <Pressable onPress={() => router.back()} style={s.missingButton}>
          <Text style={s.missingButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const showToggle = routine.description.length > 90;

  const heroTranslate = scrollY.interpolate({
    inputRange: [-heroHeight, 0, heroHeight],
    outputRange: [-heroHeight * 0.18, 0, heroHeight * 0.26],
    extrapolate: "clamp",
  });
  const heroScale = scrollY.interpolate({
    inputRange: [-heroHeight, 0],
    outputRange: [1.8, 1],
    extrapolate: "clamp",
  });

  const handleStart = () =>
    router.replace({ pathname: "/WorkoutPlayer", params: { routineId: routine.id } });

  const handleShare = () =>
    Share.share({
      message: `Try the ${routine.name} routine in Invicta: ${routine.description}`,
    });

  const handleExercise = (exercise: RoutineExercise) =>
    router.push({
      pathname: "/ExerciseDetail",
      params: {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        sets: exercise.sets.toString(),
        reps: exercise.reps,
        restSeconds: exercise.restSeconds.toString(),
        category: exercise.category,
        gifUrl: exercise.gifUrl ?? "",
      },
    });

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + CTA_HEIGHT + 56 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      >
        {/* ── Hero ── */}
        <View style={[s.hero, { height: heroHeight }]}>
          <BlurTargetView ref={heroBlurTarget} style={StyleSheet.absoluteFillObject}>
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                { transform: [{ translateY: heroTranslate }, { scale: heroScale }] },
              ]}
            >
              {routine.image ? (
                <Image source={{ uri: routine.image }} style={s.heroImage} resizeMode="cover" />
              ) : (
                <LinearGradient colors={routine.gradient} style={StyleSheet.absoluteFillObject} />
              )}
            </Animated.View>

            <LinearGradient
              colors={["rgba(0,0,0,0.28)", "rgba(0,0,0,0)", "rgba(0,0,0,0.55)"]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFillObject}
            />
          </BlurTargetView>

          <View style={[s.heroHeader, { top: insets.top + 14 }]}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [s.headerButtonHit, pressed && s.pressed]}
            >
              <BlurView
                blurTarget={heroBlurTarget}
                blurMethod="dimezisBlurViewSdk31Plus"
                intensity={38}
                tint="systemUltraThinMaterialDark"
                style={s.headerButton}
              >
                <Ionicons name="chevron-back" size={22} color={C.text} />
              </BlurView>
            </Pressable>

            <Text style={s.headerTitle}>Details</Text>

            <Pressable
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share routine"
              style={({ pressed }) => [s.headerButtonHit, pressed && s.pressed]}
            >
              <BlurView
                blurTarget={heroBlurTarget}
                blurMethod="dimezisBlurViewSdk31Plus"
                intensity={38}
                tint="systemUltraThinMaterialDark"
                style={s.headerButton}
              >
                <Ionicons name="share-outline" size={20} color={C.text} />
              </BlurView>
            </Pressable>
          </View>
        </View>

        {/* ── Sheet ── */}
        <View style={s.sheet}>
          {/* Summary squircle card (overlaps the hero) */}
          <View style={[s.summaryCard, { width: summaryWidth, height: SUMMARY_H }]}>
            <SquircleSurface
              width={summaryWidth}
              height={SUMMARY_H}
              cornerRadius={SUMMARY_RADIUS}
              fill={C.card}
              strokeColor="rgba(255,255,255,0.06)"
            />
            <View style={s.summaryThumb}>
              {routine.image ? (
                <Image source={{ uri: routine.image }} style={s.summaryImage} resizeMode="cover" />
              ) : (
                <LinearGradient colors={routine.gradient} style={StyleSheet.absoluteFillObject} />
              )}
            </View>

            <View style={s.summaryCopy}>
              <Text style={s.routineName} numberOfLines={2}>{routine.name}</Text>

              <View style={s.metaRow}>
                <Text style={s.difficulty}>{routine.difficulty}</Text>
                {!!routine.completions && (
                  <>
                    <Ionicons name="star" size={12} color={C.primary} style={{ marginLeft: 9 }} />
                    <Text style={s.completions}>{compactCount(routine.completions)}+ done</Text>
                  </>
                )}
              </View>

              <View style={s.trainerRow}>
                <Image source={getTrainerAvatar(routine.id)} style={s.trainerAvatar} />
                <View style={s.trainerCopy}>
                  <Text style={s.trainerName} numberOfLines={1}>
                    {routine.athlete?.name ?? "Invicta Training"}
                  </Text>
                  <Text style={s.trainerRole} numberOfLines={1}>
                    {routine.athlete?.title ?? "Routine by Invicta athlete"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Description</Text>
            <Text style={s.description} numberOfLines={expanded ? undefined : 3}>
              {routine.description}
            </Text>
            {showToggle && (
              <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
                <Text style={s.showMore}>{expanded ? "Show less" : "Show more"}</Text>
              </Pressable>
            )}

            <View style={s.statsRow}>
              <StatPill icon="barbell-outline" label={`${routine.exercises.length} Exercises`} />
              <StatPill icon="flame-outline" label={`${totalCalories} Kcal`} />
              <StatPill icon="time-outline" label={routine.duration} />
            </View>
          </View>

          {/* Exercises */}
          <View style={s.exerciseSection}>
            <View style={s.exerciseHeader}>
              <Text style={s.exerciseTitle}>Exercises</Text>
              <Text style={s.exerciseCount}>{routine.exercises.length} total</Text>
            </View>

            <View style={s.exerciseList}>
              {routine.exercises.map((exercise, index) => (
                <ExerciseRow
                  key={`${exercise.exerciseId}-${index}`}
                  exercise={exercise}
                  index={index}
                  onPress={() => handleExercise(exercise)}
                />
              ))}
            </View>
          </View>
        </View>
      </Animated.ScrollView>

      {/* ── Bottom action bar ── */}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.85)", C.sheet]}
        locations={[0, 0.5, 1]}
        style={s.ctaGradient}
        pointerEvents="none"
      />
      <View style={[s.ctaWrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <Pressable
          onPress={() => setSaved((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Remove from saved" : "Save routine"}
          style={({ pressed }) => [s.saveButtonHit, pressed && s.pressed]}
        >
          <BlurView
            experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
            intensity={Platform.OS === "ios" ? 55 : 35}
            tint="light"
            style={s.saveButton}
          >
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={22}
              color={saved ? C.primary : "#fff"}
            />
          </BlurView>
        </Pressable>

        <Pressable
          onPress={handleStart}
          accessibilityRole="button"
          accessibilityLabel={`Start ${routine.name}`}
          style={({ pressed }) => [s.startButton, pressed && s.startButtonPressed]}
        >
          <Text style={s.startButtonText}>Start Workout</Text>
          <Ionicons name="play" size={13} color="#000000" />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: C.background,
  },
  missingTitle: { color: C.text, fontFamily: theme.bold, fontSize: 20 },
  missingButton: { marginTop: 18, padding: 12 },
  missingButtonText: { color: C.primary, fontFamily: theme.bold, fontSize: 15 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },

  // Hero
  hero: { overflow: "hidden", backgroundColor: C.background },
  heroImage: { width: "100%", height: "100%" },
  heroHeader: {
    position: "absolute",
    left: H_PAD,
    right: H_PAD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButtonHit: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    backgroundColor: "rgba(10,10,10,0.14)",
  },
  headerTitle: { color: C.text, fontFamily: theme.semibold, fontSize: 15 },

  // Sheet
  sheet: {
    minHeight: 600,
    marginTop: -SHEET_OVERLAP,
    paddingTop: SUMMARY_H - SUMMARY_OVERHANG + 30,
    paddingHorizontal: H_PAD,
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
    backgroundColor: C.sheet,
  },

  // Summary squircle card
  summaryCard: {
    position: "absolute",
    top: -SUMMARY_OVERHANG,
    left: CARD_MARGIN,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 20,
  },
  summaryThumb: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: "hidden",
    backgroundColor: C.surface,
  },
  summaryImage: { width: "100%", height: "100%" },
  summaryCopy: { flex: 1, minWidth: 0, marginLeft: 16 },
  routineName: {
    color: C.text,
    fontFamily: theme.bold,
    fontSize: 21,
    lineHeight: 24,
    letterSpacing: -0.5,
  },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  difficulty: { color: C.primary, fontFamily: theme.bold, fontSize: 13.5 },
  completions: { color: C.muted, fontFamily: theme.medium, fontSize: 12, marginLeft: 4 },
  trainerRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  trainerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface },
  trainerCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  trainerName: { color: C.text, fontFamily: theme.semibold, fontSize: 12.5 },
  trainerRole: { color: C.faint, fontFamily: theme.regular, fontSize: 10.5, marginTop: 1 },

  // Description + stats
  section: { paddingHorizontal: 4 },
  sectionTitle: { color: C.text, fontFamily: theme.bold, fontSize: 18, letterSpacing: -0.2 },
  description: {
    marginTop: 10,
    color: C.muted,
    fontFamily: theme.regular,
    fontSize: 13.5,
    lineHeight: 20,
  },
  showMore: { color: C.primary, fontFamily: theme.semibold, fontSize: 13, marginTop: 8 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 20 },
  statPill: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  statPillText: { color: "#E6E6E6", fontFamily: theme.medium, fontSize: 12 },

  // Exercises
  exerciseSection: { marginTop: 34 },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  exerciseTitle: { color: C.text, fontFamily: theme.bold, fontSize: 20, letterSpacing: -0.4 },
  exerciseCount: { color: C.faint, fontFamily: theme.medium, fontSize: 12 },
  exerciseList: { gap: 10 },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    paddingRight: 16,
    borderRadius: 20,
    backgroundColor: C.surface,
  },
  exerciseRowPressed: { opacity: 0.7 },
  exerciseThumb: {
    width: 56,
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C0D0E",
  },
  exerciseImage: { width: "100%", height: "100%" },
  exerciseCopy: { flex: 1, minWidth: 0, marginLeft: 13 },
  exerciseName: { color: C.text, fontFamily: theme.semibold, fontSize: 14.5 },
  exerciseMeta: { color: C.faint, fontFamily: theme.regular, fontSize: 11.5, marginTop: 5 },
  exerciseIndex: { color: "rgba(255,255,255,0.22)", fontFamily: theme.bold, fontSize: 13 },

  // Bottom action bar
  ctaGradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: 130 },
  ctaWrap: {
    position: "absolute",
    left: H_PAD,
    right: H_PAD,
    bottom: 0,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  saveButtonHit: { height: CTA_HEIGHT },
  saveButton: {
    width: 62,
    height: CTA_HEIGHT,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  startButton: {
    flex: 1,
    height: CTA_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 22,
    backgroundColor: C.primary,
  },
  startButtonPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  startButtonText: {
    color: "#000000",
    fontFamily: theme.black,
    fontSize: 15,
    letterSpacing: -0.25,
  },
});
