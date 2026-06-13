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

const H_PAD = 20;
const CARD_MARGIN = 16;
const SHEET_RADIUS = 44;
const CARD_RADIUS = 36;
const CARD_HEIGHT = 168;
const CARD_OVERHANG = 92; // how far the card floats above the sheet
const SHEET_OVERLAP = 52; // how far the sheet rides up over the hero
const CTA_HEIGHT = 62;

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
  bg: "#000000",
  card: "#17181A",
  surface: "#121315",
  text: "#FFFFFF",
  muted: "#9B9DA1",
  faint: "#6E7174",
  hairline: "rgba(255,255,255,0.07)",
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

/** Big, fully-rounded stat chip used in the info row. */
function Stat({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
}) {
  return (
    <View style={s.stat}>
      <Ionicons name={icon} size={15} color={C.primary} />
      <Text style={s.statText}>{label}</Text>
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
      style={({ pressed }) => [s.exerciseRow, pressed && s.rowPressed]}
    >
      <View style={s.exerciseThumb}>
        {exercise.gifUrl ? (
          <Image source={{ uri: exercise.gifUrl }} style={s.fill} resizeMode="cover" />
        ) : (
          <Ionicons name="barbell-outline" size={20} color={C.faint} />
        )}
      </View>

      <View style={s.exerciseCopy}>
        <Text style={s.exerciseName} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text style={s.exerciseMeta} numberOfLines={1}>
          {exercise.sets} × {exercise.reps}
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
  const heroHeight = Math.min(470, Math.max(390, height * 0.55));
  const cardWidth = width - CARD_MARGIN * 2;

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

  const showToggle = routine.description.length > 92;

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
                <Image source={{ uri: routine.image }} style={s.fill} resizeMode="cover" />
              ) : (
                <LinearGradient colors={routine.gradient} style={StyleSheet.absoluteFillObject} />
              )}
            </Animated.View>

            <LinearGradient
              colors={["rgba(0,0,0,0.34)", "rgba(0,0,0,0)", "rgba(0,0,0,0.6)"]}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFillObject}
            />
          </BlurTargetView>

          <View style={[s.heroHeader, { top: insets.top + 12 }]}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [s.iconHit, pressed && s.pressed]}
            >
              <BlurView
                blurTarget={heroBlurTarget}
                blurMethod="dimezisBlurViewSdk31Plus"
                intensity={36}
                tint="systemUltraThinMaterialDark"
                style={s.iconButton}
              >
                <Ionicons name="chevron-back" size={23} color={C.text} />
              </BlurView>
            </Pressable>

            <Text style={s.headerTitle}>Details</Text>

            <Pressable
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share routine"
              style={({ pressed }) => [s.iconHit, pressed && s.pressed]}
            >
              <BlurView
                blurTarget={heroBlurTarget}
                blurMethod="dimezisBlurViewSdk31Plus"
                intensity={36}
                tint="systemUltraThinMaterialDark"
                style={s.iconButton}
              >
                <Ionicons name="share-outline" size={20} color={C.text} />
              </BlurView>
            </Pressable>
          </View>
        </View>

        {/* ── Sheet ── */}
        <View style={s.sheet}>
          {/* Floating identity card */}
          <View style={[s.card, { width: cardWidth, height: CARD_HEIGHT }]}>
            <SquircleSurface
              width={cardWidth}
              height={CARD_HEIGHT}
              cornerRadius={CARD_RADIUS}
              fill={C.card}
              strokeColor="rgba(255,255,255,0.05)"
            />

            <View style={s.cardThumb}>
              {routine.image ? (
                <Image source={{ uri: routine.image }} style={s.fill} resizeMode="cover" />
              ) : (
                <LinearGradient colors={routine.gradient} style={StyleSheet.absoluteFillObject} />
              )}
            </View>

            <View style={s.cardCopy}>
              <Text style={s.routineName} numberOfLines={2}>
                {routine.name}
              </Text>

              <View style={s.metaRow}>
                <Text style={s.difficulty}>{routine.difficulty}</Text>
                {!!routine.completions && (
                  <>
                    <View style={s.dot} />
                    <Ionicons name="star" size={13} color={C.primary} />
                    <Text style={s.completions}>{compactCount(routine.completions)}+</Text>
                  </>
                )}
              </View>

              <View style={s.trainerRow}>
                <Image source={getTrainerAvatar(routine.id)} style={s.trainerAvatar} />
                <Text style={s.trainerName} numberOfLines={1}>
                  {routine.athlete?.name ?? "Invicta Training"}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <Text style={s.sectionTitle}>Description</Text>
          <Text style={s.description} numberOfLines={expanded ? undefined : 3}>
            {routine.description}
          </Text>
          {showToggle && (
            <Pressable onPress={() => setExpanded((v) => !v)} hitSlop={8}>
              <Text style={s.showMore}>{expanded ? "Show less" : "Show more"}</Text>
            </Pressable>
          )}

          {/* Stats */}
          <View style={s.statsRow}>
            <Stat icon="barbell-outline" label={`${routine.exercises.length} moves`} />
            <Stat icon="flame-outline" label={`${totalCalories} kcal`} />
            <Stat icon="time-outline" label={routine.duration} />
          </View>

          {/* Exercises */}
          <View style={s.exerciseHeader}>
            <Text style={s.sectionTitle}>Exercises</Text>
            <Text style={s.exerciseCount}>{routine.exercises.length}</Text>
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
      </Animated.ScrollView>

      {/* ── Bottom action bar ── */}
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.85)", C.bg]}
        locations={[0, 0.5, 1]}
        style={s.ctaGradient}
        pointerEvents="none"
      />
      <View style={[s.ctaWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable
          onPress={() => setSaved((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Remove from saved" : "Save routine"}
          style={({ pressed }) => [s.saveHit, pressed && s.pressed]}
        >
          <BlurView
            experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
            intensity={Platform.OS === "ios" ? 55 : 35}
            tint="light"
            style={s.saveButton}
          >
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={23}
              color={saved ? C.primary : "#fff"}
            />
          </BlurView>
        </Pressable>

        <Pressable
          onPress={handleStart}
          accessibilityRole="button"
          accessibilityLabel={`Start ${routine.name}`}
          style={({ pressed }) => [s.startButton, pressed && s.startPressed]}
        >
          <Text style={s.startText}>Start Workout</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  fill: { width: "100%", height: "100%" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  rowPressed: { opacity: 0.7 },

  missing: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: C.bg,
  },
  missingTitle: { color: C.text, fontFamily: theme.bold, fontSize: 20 },
  missingButton: { marginTop: 18, padding: 12 },
  missingButtonText: { color: C.primary, fontFamily: theme.bold, fontSize: 15 },

  // Hero
  hero: { overflow: "hidden", backgroundColor: C.bg },
  heroHeader: {
    position: "absolute",
    left: H_PAD,
    right: H_PAD,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconHit: { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(10,10,10,0.12)",
  },
  headerTitle: { color: C.text, fontFamily: theme.semibold, fontSize: 16 },

  // Sheet
  sheet: {
    minHeight: 600,
    marginTop: -SHEET_OVERLAP,
    paddingTop: CARD_HEIGHT - CARD_OVERHANG + 34,
    paddingHorizontal: H_PAD,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    backgroundColor: C.bg,
  },

  // Floating identity card
  card: {
    position: "absolute",
    top: -CARD_OVERHANG,
    left: CARD_MARGIN,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 22,
  },
  cardThumb: {
    width: 116,
    height: 116,
    borderRadius: 58,
    overflow: "hidden",
    backgroundColor: C.surface,
  },
  cardCopy: { flex: 1, minWidth: 0, marginLeft: 18 },
  routineName: {
    color: C.text,
    fontFamily: theme.bold,
    fontSize: 24,
    lineHeight: 27,
    letterSpacing: -0.6,
  },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 9, gap: 4 },
  difficulty: { color: C.primary, fontFamily: theme.bold, fontSize: 14 },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.faint, marginHorizontal: 4 },
  completions: { color: C.muted, fontFamily: theme.medium, fontSize: 13 },
  trainerRow: { flexDirection: "row", alignItems: "center", marginTop: 14, gap: 9 },
  trainerAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surface },
  trainerName: { flex: 1, color: C.muted, fontFamily: theme.semibold, fontSize: 13 },

  // Description
  sectionTitle: {
    color: C.text,
    fontFamily: theme.bold,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  description: {
    marginTop: 12,
    color: C.muted,
    fontFamily: theme.regular,
    fontSize: 14.5,
    lineHeight: 22,
  },
  showMore: { color: C.primary, fontFamily: theme.semibold, fontSize: 13.5, marginTop: 8 },

  // Stats
  statsRow: { flexDirection: "row", gap: 10, marginTop: 22 },
  stat: {
    flex: 1,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 25,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.hairline,
  },
  statText: { color: "#E6E6E6", fontFamily: theme.medium, fontSize: 13 },

  // Exercises
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 36,
    marginBottom: 14,
  },
  exerciseCount: { color: C.faint, fontFamily: theme.bold, fontSize: 15 },
  exerciseList: { gap: 10 },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    paddingRight: 18,
    borderRadius: 24,
    backgroundColor: C.surface,
  },
  exerciseThumb: {
    width: 56,
    height: 56,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0C0D",
  },
  exerciseCopy: { flex: 1, minWidth: 0, marginLeft: 14 },
  exerciseName: { color: C.text, fontFamily: theme.semibold, fontSize: 15 },
  exerciseMeta: { color: C.faint, fontFamily: theme.regular, fontSize: 12.5, marginTop: 5 },
  exerciseIndex: { color: "rgba(255,255,255,0.2)", fontFamily: theme.bold, fontSize: 14 },

  // Bottom action bar
  ctaGradient: { position: "absolute", left: 0, right: 0, bottom: 0, height: 140 },
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
  saveHit: { height: CTA_HEIGHT },
  saveButton: {
    width: 62,
    height: CTA_HEIGHT,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.26)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  startButton: {
    flex: 1,
    height: CTA_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 31,
    backgroundColor: C.primary,
  },
  startPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  startText: {
    color: "#000000",
    fontFamily: theme.black,
    fontSize: 16,
    letterSpacing: -0.2,
  },
});
