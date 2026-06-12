import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { router } from "expo-router";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import FadeTranslate from "@/components/ui/FadeTranslate";
import { SquircleFrame } from "@/components/ui/Squircle";
import { ROUTINES, type WorkoutRoutine } from "@/constants/workoutRoutines";
import { ExerciseApi, type ExerciseInfo } from "@/api/ExerciseApi";
import { User } from "@/models/User";
import database from "@/database/database";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const H_PAD = 20;
const CARD_W = SCREEN_W - H_PAD * 2;
const CARD_H = CARD_W * 1.0;            // square cards like the reference UI
const CARD_RADIUS = 40;
const ITEM_H = CARD_H + 16;             // card + feed gap
const MAX_RESULTS = 30;
const MODE_SEG_W = 66;                  // width of each half of the Home/Gym toggle

const AVATARS = [
  require("@/assets/avatars/avatar1.jpg"),
  require("@/assets/avatars/avatar2.jpg"),
  require("@/assets/avatars/avatar3.jpg"),
  require("@/assets/avatars/avatar4.jpg"),
  require("@/assets/avatars/avatar5.jpg"),
  require("@/assets/avatars/avatar6.jpg"),
  require("@/assets/avatars/avatar7.jpg"),
];

const FEATURED_IDS = ["core_30day", "quick_hiit", "full_body_gym"];
const FILTER_PILLS = ["All", "Strength", "HIIT", "Core", "Cardio"];

const formatCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`;

const capitalize = (str: string) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

const diffColor = (d: string) =>
  d === "Beginner" ? "#34C759" : d === "Intermediate" ? "#FF9500" : "#FF5C5C";

const matchesFilter = (r: WorkoutRoutine, pill: string) => {
  if (pill === "All") return true;
  const muscles = r.targetMuscles.map((m) => m.toLowerCase());
  const name = r.name.toLowerCase();
  switch (pill) {
    case "Strength":
      return muscles.some((m) => ["chest","shoulders","arms","legs","glutes","quads","calves","full body"].includes(m));
    case "HIIT":
      return name.includes("hiit") || (muscles.includes("cardio") && muscles.includes("full body"));
    case "Core":
      return muscles.some((m) => ["abs","obliques","core"].includes(m));
    case "Cardio":
      return muscles.includes("cardio");
    default:
      return true;
  }
};

// Home = doable with no equipment (bodyweight / mat); Gym = needs actual gear
const HOME_GEAR = ["body weight", "gym mat", "no equipment"];
const isGymRoutine = (r: WorkoutRoutine) =>
  r.equipment.some((e) => !HOME_GEAR.includes(e.toLowerCase()));

// ── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  bg:      "#000",
  primary: "#AAFB05",
  text:    "#fff",
  sub:     "#8E8E93",
};

// ── RoutineCard (outside Workout to avoid recreation) ─────────────────────────
const RoutineCard = React.memo(function RoutineCard({
  routine, idx, isFocused, onPress,
}: {
  routine: WorkoutRoutine;
  idx: number;
  isFocused: boolean;
  onPress: (id: string) => void;
}) {
  const av0 = AVATARS[(idx * 3 + 0) % AVATARS.length];
  const av1 = AVATARS[(idx * 3 + 1) % AVATARS.length];
  const av2 = AVATARS[(idx * 3 + 2) % AVATARS.length];
  const isFeatured = FEATURED_IDS.includes(routine.id);

  // avatar bubble-in — useNativeDriver: true (scale + opacity)
  const av2Anim = useRef(new Animated.Value(0)).current;
  const av1Anim = useRef(new Animated.Value(0)).current;
  const av0Anim = useRef(new Animated.Value(0)).current;
  const countAnim = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(false);

  useEffect(() => {
    const isMount = !mountedRef.current;
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout>;

    if (isFocused) {
      timer = setTimeout(() => {
        Animated.stagger(110, [
          Animated.spring(av2Anim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
          Animated.spring(av1Anim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
          Animated.spring(av0Anim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
          Animated.spring(countAnim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
        ]).start();
      }, isMount ? 480 : 0);
    } else {
      Animated.parallel([
        Animated.timing(av0Anim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(av1Anim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(av2Anim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(countAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }

    return () => clearTimeout(timer);
  }, [isFocused]);

  const av2Scale = av2Anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const av1Scale = av1Anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const av0Scale = av0Anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const countScale = countAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <FadeTranslate direction="y" translateYFrom={36} delay={300} order={Math.min(idx, 4) * 0.1}>
      <TouchableOpacity activeOpacity={0.96} onPress={() => onPress(routine.id)}>
        <View style={s.card}>
          {/* photo */}
          <LinearGradient
            colors={routine.gradient}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {routine.image ? (
            <Image
              source={{ uri: routine.image }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}
          {/* darken top-left so the headline reads, like the price in the reference */}
          <LinearGradient
            colors={["rgba(0,0,0,0.62)", "rgba(0,0,0,0.18)", "rgba(0,0,0,0.02)"]}
            locations={[0, 0.36, 0.62]}
            style={StyleSheet.absoluteFill}
          />

          {/* top row — duration headline + star circle */}
          <View style={s.cardTopRow}>
            <View>
              <View style={s.cardTimeRow}>
                <Text style={s.cardTime}>{routine.duration}</Text>
                <Text style={[s.cardDiff, { color: diffColor(routine.difficulty) }]}>
                  {routine.difficulty}
                </Text>
              </View>

              <View style={s.avatarRow}>
                <Animated.View style={{ opacity: av2Anim, transform: [{ scale: av2Scale }] }}>
                  <Image source={av2} style={s.stackAv} />
                </Animated.View>
                <Animated.View style={{ opacity: av1Anim, transform: [{ scale: av1Scale }], marginLeft: -9 }}>
                  <Image source={av1} style={s.stackAv} />
                </Animated.View>
                <Animated.View style={{ opacity: av0Anim, transform: [{ scale: av0Scale }], marginLeft: -9 }}>
                  <Image source={av0} style={s.stackAv} />
                </Animated.View>
                <Animated.View style={[s.countPill, { opacity: countAnim, transform: [{ scale: countScale }] }]}>
                  <Text style={s.countPillText}>+{formatCount(routine.completions ?? 0)}</Text>
                </Animated.View>
              </View>
            </View>

            <View style={s.starCircle}>
              <Ionicons
                name="star"
                size={16}
                color={isFeatured ? D.primary : "#fff"}
              />
            </View>
          </View>

          {/* frosted glass bar — name + routine by + arrow */}
          <View style={s.glassBarWrap}>
            <BlurView
              experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
              intensity={Platform.OS === "ios" ? 55 : 35}
              tint="light"
              style={s.glassBar}
            >
              <View style={s.glassTextCol}>
                <Text style={s.glassTitle} numberOfLines={1}>{routine.name}</Text>
                <Text style={s.glassSub} numberOfLines={1}>
                  Routine by {routine.athlete?.name ?? "Invicta"} • {routine.exercises.length} exercises
                </Text>
              </View>
              <View style={s.arrowCircle}>
                <Ionicons
                  name="arrow-forward"
                  size={19}
                  color="#000"
                  style={{ transform: [{ rotate: "-45deg" }] }}
                />
              </View>
            </BlurView>
          </View>

          {/* squircle corners */}
          <SquircleFrame
            width={CARD_W}
            height={CARD_H}
            cornerRadius={CARD_RADIUS}
            color={D.bg}
            strokeColor="rgba(255,255,255,0.07)"
          />
        </View>
      </TouchableOpacity>
    </FadeTranslate>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

export default function Workout() {
  const insets = useSafeAreaInsets();

  const [userName, setUserName] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [focusedCard, setFocusedCard] = useState(0);
  // Home vs Gym — defaulted from the onboarding equipment answer
  const [workoutMode, setWorkoutMode] = useState<"home" | "gym">("home");

  const scrollYRef = useRef(0);
  const feedListYRef = useRef(0);

  // Exercise pool — loaded from DB cache, or downloaded once on first launch
  const [exPool, setExPool] = useState<ExerciseInfo[]>([]);
  const [poolReady, setPoolReady] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  const isSearching = search.trim().length > 0;
  const isCaching = !poolReady;

  // Local user name + default workout mode from onboarding equipment answer
  useEffect(() => {
    (async () => {
      try {
        const u = await User.getUserDetails(database);
        if (u?.name) setUserName(u.name.split(" ")[0]);
        // "Home Workouts" → home; "Basic Equipment" / "Gym Access" → gym
        // (equipment routines — dumbbells etc. — live on the gym side)
        if (u?.equipmentAccess && u.equipmentAccess !== "Home Workouts") setWorkoutMode("gym");
      } catch {}
    })();
  }, []);

  // Warm the exercise cache on open — instant if DB already has it
  useEffect(() => {
    let cancelled = false;
    const unsub = ExerciseApi.onExercises((exercises) => {
      if (!cancelled) setExPool(exercises);
    });
    ExerciseApi.getAllExercises()
      .catch(() => {})
      .finally(() => { if (!cancelled) setPoolReady(true); });
    return () => { cancelled = true; unsub(); };
  }, []);

  // Pulsing "Caching exercises..." placeholder
  useEffect(() => {
    if (!isCaching) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.9, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isCaching]);

  const routines = useMemo(() => {
    const list = ROUTINES.filter(
      (r) =>
        (workoutMode === "gym") === isGymRoutine(r) &&
        matchesFilter(r, activeFilter)
    );
    return [...list].sort((a, b) => {
      const fa = FEATURED_IDS.includes(a.id) ? 1 : 0;
      const fb = FEATURED_IDS.includes(b.id) ? 1 : 0;
      return fb - fa || (b.completions ?? 0) - (a.completions ?? 0);
    });
  }, [workoutMode, activeFilter]);

  const switchMode = useCallback((mode: "home" | "gym") => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));
    setWorkoutMode(mode);
    setFocusedCard(0);
  }, []);

  const switchFilter = useCallback((pill: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(220, "easeInEaseOut", "opacity"));
    setActiveFilter(pill);
    setFocusedCard(0);
  }, []);

  // Sliding thumb for the Home/Gym toggle
  const toggleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(toggleAnim, {
      toValue: workoutMode === "gym" ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [workoutMode]);

  // Exercise search over the cached pool
  const exerciseResults = useMemo(() => {
    if (!isSearching) return [];
    const q = search.trim().toLowerCase();
    const seen = new Set<string>();
    const out: ExerciseInfo[] = [];
    for (const ex of exPool) {
      if (seen.has(ex.exerciseId)) continue;
      const hit =
        ex.name.toLowerCase().includes(q) ||
        ex.targetMuscles.some((m) => m.toLowerCase().includes(q)) ||
        ex.equipments.some((e) => e.toLowerCase().includes(q)) ||
        ex.bodyParts.some((b) => b.toLowerCase().includes(q));
      if (hit) {
        seen.add(ex.exerciseId);
        out.push(ex);
        if (out.length >= MAX_RESULTS) break;
      }
    }
    return out;
  }, [isSearching, search, exPool]);

  const handleSearchChange = useCallback((text: string) => {
    const wasSearching = search.trim().length > 0;
    const willSearch = text.trim().length > 0;
    if (wasSearching !== willSearch) {
      LayoutAnimation.configureNext(LayoutAnimation.create(260, "easeInEaseOut", "opacity"));
    }
    setSearch(text);
  }, [search]);

  const openRoutine = useCallback((routineId: string) => {
    router.push({ pathname: "/RoutineDetail", params: { routineId } });
  }, []);

  const openExercise = useCallback((exercise: ExerciseInfo) => {
    router.push({
      pathname: "/ExerciseDetail",
      params: {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        sets: "3", reps: "12", restSeconds: "60",
        category: exercise.targetMuscles?.[0] ?? exercise.bodyParts?.[0] ?? "Strength",
        gifUrl: exercise.gifUrl ?? "",
      },
    });
  }, []);

  const onMainScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const sy = e.nativeEvent.contentOffset.y;
    scrollYRef.current = sy;
    const screenCenter = sy + SCREEN_H * 0.48;
    const relative = screenCenter - feedListYRef.current;
    const newIdx = Math.max(0, Math.min(routines.length - 1,
      Math.round(relative / ITEM_H - 0.3)
    ));
    setFocusedCard((prev) => prev !== newIdx ? newIdx : prev);
  }, [routines.length]);

  const onFeedListLayout = useCallback((e: any) => {
    feedListYRef.current = e.nativeEvent.layout.y;
  }, []);

  const firstLetter = userName ? userName[0].toUpperCase() : "";

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* bottom screen fade — sits above scroll content */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.72)", "#000"]}
        locations={[0, 0.52, 1]}
        style={s.bottomScreenFade}
        pointerEvents="none"
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onMainScroll}
        scrollEventThrottle={50}
      >
        {/* ── Top bar — avatar · mode · analytics ── */}
        <FadeTranslate order={0} direction="y" translateYFrom={-16}>
          <View style={s.topBar}>
            <View style={s.topAvatar}>
              {firstLetter ? (
                <Text style={s.topAvatarLetter}>{firstLetter}</Text>
              ) : (
                <Ionicons name="person" size={17} color="rgba(255,255,255,0.65)" />
              )}
            </View>

            <View style={s.topCenter}>
              <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.90)" />
              <Text style={s.topCenterText}>
                Training at {workoutMode === "gym" ? "the Gym" : "Home"}
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.75}
              style={s.topMenuBtn}
              onPress={() => router.push("/Analytics")}
            >
              <Ionicons name="menu" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </FadeTranslate>

        {/* ── Hello header ── */}
        <FadeTranslate order={0} delay={60} direction="y" translateYFrom={-10}>
          <View style={s.helloWrap}>
            <Text style={s.hello}>Hello, {userName || "Athlete"}</Text>
            <Text style={s.helloSub}>Let&apos;s explore your workout world!</Text>
          </View>
        </FadeTranslate>

        {/* ── Search ── */}
        <FadeTranslate order={0} delay={100} direction="y" translateYFrom={12}>
          <View style={s.searchBar}>
            {isCaching ? (
              <ActivityIndicator size="small" color={D.primary} />
            ) : (
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.45)" />
            )}
            <View style={s.searchInputWrap}>
              <TextInput
                style={s.searchInput}
                placeholder={isCaching ? "" : "Search Workouts & Exercises"}
                placeholderTextColor="rgba(255,255,255,0.45)"
                value={search}
                onChangeText={handleSearchChange}
                returnKeyType="search"
                autoCorrect={false}
                selectionColor={D.primary}
              />
              {isCaching && search.length === 0 && (
                <Animated.Text
                  pointerEvents="none"
                  style={[s.cachingPlaceholder, { opacity: pulseAnim }]}
                  numberOfLines={1}
                >
                  Caching exercises, please wait...
                </Animated.Text>
              )}
            </View>
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => handleSearchChange("")}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            )}
          </View>
        </FadeTranslate>

        {isSearching ? (
          /* ══ Search results ══ */
          <View style={s.resultsWrap}>
            {exPool.length === 0 ? (
              <View style={s.emptyState}>
                <ActivityIndicator size="large" color={D.primary} />
                <Text style={s.emptyText}>
                  {isCaching ? "Building your exercise library..." : "Loading exercises..."}
                </Text>
              </View>
            ) : exerciseResults.length === 0 ? (
              <FadeTranslate order={0}>
                <View style={s.emptyState}>
                  <View style={s.emptyIconWrap}>
                    <Ionicons name="barbell-outline" size={34} color={D.sub} />
                  </View>
                  <Text style={s.emptyTitle}>No exercises found</Text>
                  <Text style={s.emptyText}>Try a different name, muscle or equipment.</Text>
                </View>
              </FadeTranslate>
            ) : (
              <>
                <FadeTranslate order={0} direction="y" translateYFrom={-10}>
                  <Text style={s.resultsCount}>
                    {exerciseResults.length === MAX_RESULTS
                      ? `Top ${MAX_RESULTS} results`
                      : `${exerciseResults.length} exercise${exerciseResults.length !== 1 ? "s" : ""}`}
                  </Text>
                </FadeTranslate>
                <View style={s.resultsList}>
                  {exerciseResults.map((exercise, index) => {
                    const focus = exercise.targetMuscles?.[0] ?? exercise.bodyParts?.[0] ?? "Strength";
                    const equipment = exercise.equipments?.[0]
                      ? capitalize(exercise.equipments[0])
                      : "Bodyweight";
                    return (
                      <FadeTranslate
                        key={exercise.exerciseId}
                        direction="y" translateYFrom={24} delay={40}
                        order={Math.min(index, 10) * 0.04}
                      >
                        <TouchableOpacity
                          style={s.exerciseRow}
                          activeOpacity={0.75}
                          onPress={() => openExercise(exercise)}
                        >
                          <View style={s.exerciseThumbWrap}>
                            {exercise.gifUrl ? (
                              <Image
                                source={{ uri: exercise.gifUrl }}
                                style={s.exerciseThumb}
                                resizeMode="cover"
                              />
                            ) : (
                              <Ionicons name="barbell-outline" size={24} color={D.sub} />
                            )}
                          </View>
                          <View style={s.exerciseInfo}>
                            <Text style={s.exerciseName} numberOfLines={2}>
                              {capitalize(exercise.name)}
                            </Text>
                            <View style={s.exercisePillRow}>
                              <View style={s.exercisePill}>
                                <Text style={s.exercisePillText}>{capitalize(focus)}</Text>
                              </View>
                              <View style={s.exercisePill}>
                                <Ionicons name="barbell" size={10} color="rgba(255,255,255,0.45)" />
                                <Text style={s.exercisePillText}>{equipment}</Text>
                              </View>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={17} color="rgba(255,255,255,0.3)" />
                        </TouchableOpacity>
                      </FadeTranslate>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        ) : (
          /* ══ Browse: pills + section + cards ══ */
          <>
            {/* ── Filter pills ── */}
            <FadeTranslate order={0} delay={140} direction="y" translateYFrom={12}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.pillScroll}
              >
                {FILTER_PILLS.map((pill) => {
                  const active = activeFilter === pill;
                  return (
                    <TouchableOpacity
                      key={pill}
                      activeOpacity={0.85}
                      onPress={() => switchFilter(pill)}
                      style={[s.pill, active && s.pillActive]}
                    >
                      <Text style={[s.pillText, active && s.pillTextActive]}>{pill}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </FadeTranslate>

            {/* ── Section header + Home/Gym toggle ── */}
            <FadeTranslate order={0} delay={200} direction="y" translateYFrom={14}>
              <View style={s.sectionRow}>
                <Text style={s.sectionTitle}>Workout Routines</Text>

                {/* Home / Gym sliding toggle */}
                <View style={s.modeToggle}>
                  <Animated.View
                    style={[
                      s.modeThumb,
                      {
                        transform: [{
                          translateX: toggleAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, MODE_SEG_W],
                          }),
                        }],
                      },
                    ]}
                  />
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => switchMode("home")}
                    style={s.modeSeg}
                  >
                    <Ionicons
                      name="home"
                      size={12}
                      color={workoutMode === "home" ? "#000" : "rgba(255,255,255,0.45)"}
                    />
                    <Text style={[s.modeSegText, workoutMode === "home" && s.modeSegTextActive]}>
                      Home
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => switchMode("gym")}
                    style={s.modeSeg}
                  >
                    <Ionicons
                      name="barbell"
                      size={12}
                      color={workoutMode === "gym" ? "#000" : "rgba(255,255,255,0.45)"}
                    />
                    <Text style={[s.modeSegText, workoutMode === "gym" && s.modeSegTextActive]}>
                      Gym
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </FadeTranslate>

            {/* ── Routine cards feed ── */}
            <View style={s.feedList} onLayout={onFeedListLayout}>
              {routines.map((routine, idx) => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  idx={idx}
                  isFocused={focusedCard === idx}
                  onPress={openRoutine}
                />
              ))}
              {routines.length === 0 && (
                <Text style={s.emptyText}>
                  No {workoutMode === "gym" ? "gym" : "home"} workouts in this category yet.
                </Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.bg },
  scroll: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: H_PAD, marginBottom: 16,
  },
  topAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#161618",
    alignItems: "center", justifyContent: "center",
  },
  topAvatarLetter: { color: "#fff", fontFamily: theme.semibold, fontSize: 15 },
  topCenter: {
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  topCenterText: {
    color: "rgba(255,255,255,0.90)", fontFamily: theme.medium, fontSize: 12.5,
  },
  topMenuBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#161618",
    alignItems: "center", justifyContent: "center",
  },

  // Hello header
  helloWrap: { paddingHorizontal: H_PAD, marginBottom: 16 },
  hello: {
    color: D.text, fontFamily: theme.semibold, fontSize: 28, letterSpacing: -0.3,
  },
  helloSub: {
    color: "#8E8E93", fontFamily: theme.regular, fontSize: 13, marginTop: 4,
  },

  // Search
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: H_PAD, marginBottom: 16,
    backgroundColor: "#161618",
    borderRadius: 999, paddingHorizontal: 16, height: 44,
  },
  searchInputWrap: { flex: 1, justifyContent: "center" },
  searchInput: {
    color: D.text, fontFamily: theme.medium, fontSize: 13.5, paddingVertical: 0,
  },
  cachingPlaceholder: {
    position: "absolute", left: 0, right: 0,
    color: D.primary, fontFamily: theme.medium, fontSize: 13.5,
  },

  // Search results
  resultsWrap: { paddingHorizontal: H_PAD, paddingTop: 4 },
  resultsCount: {
    color: "rgba(255,255,255,0.5)", fontFamily: theme.medium,
    fontSize: 12.5, letterSpacing: 0.3, marginBottom: 14,
  },
  resultsList: { gap: 12 },
  exerciseRow: {
    flexDirection: "row", alignItems: "center", gap: 13,
    backgroundColor: "#161618",
    borderRadius: 16, padding: 10, paddingRight: 14,
  },
  exerciseThumbWrap: {
    width: 64, height: 64, borderRadius: 14,
    backgroundColor: "#111", overflow: "hidden",
    justifyContent: "center", alignItems: "center",
  },
  exerciseThumb: { width: "100%", height: "100%" },
  exerciseInfo: { flex: 1, gap: 7 },
  exerciseName: { color: D.text, fontFamily: theme.semibold, fontSize: 14.5, lineHeight: 19 },
  exercisePillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  exercisePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#1A1A1C",
    paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 8,
  },
  exercisePillText: { color: "rgba(255,255,255,0.55)", fontFamily: theme.medium, fontSize: 10.5 },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 14 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center", alignItems: "center",
  },
  emptyTitle: { color: D.text, fontFamily: theme.semibold, fontSize: 17 },
  emptyText: { color: D.sub, fontFamily: theme.medium, fontSize: 14, textAlign: "center" },

  // Filter pills
  pillScroll: { paddingHorizontal: H_PAD, paddingBottom: 24, gap: 8 },
  pill: {
    backgroundColor: "#161618",
    height: 36, justifyContent: "center",
    paddingHorizontal: 18, borderRadius: 999,
  },
  pillActive: { backgroundColor: D.primary },
  pillText: { color: "rgba(255,255,255,0.70)", fontFamily: theme.medium, fontSize: 13 },
  pillTextActive: { color: "#000", fontFamily: theme.semibold },

  // Section header
  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: H_PAD, marginBottom: 16,
  },
  sectionTitle: {
    color: D.text, fontFamily: theme.semibold, fontSize: 20, letterSpacing: -0.3,
  },

  // Home / Gym sliding toggle
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#161618",
    borderRadius: 999, padding: 3,
  },
  modeThumb: {
    position: "absolute",
    top: 3, left: 3,
    width: MODE_SEG_W, height: 28,
    borderRadius: 999,
    backgroundColor: D.primary,
  },
  modeSeg: {
    width: MODE_SEG_W, height: 28,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
  },
  modeSegText: {
    color: "rgba(255,255,255,0.45)", fontFamily: theme.semibold, fontSize: 11.5,
  },
  modeSegTextActive: { color: "#000" },

  // Routine cards
  feedList: { paddingHorizontal: H_PAD, gap: 16 },
  card: {
    width: CARD_W, height: CARD_H,
    backgroundColor: "#0D0D0D",
  },

  cardTopRow: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    padding: 20,
  },
  cardTimeRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  cardTime: {
    color: "#fff", fontFamily: theme.semibold, fontSize: 24, letterSpacing: -0.4,
  },
  cardDiff: { fontFamily: theme.semibold, fontSize: 12 },

  avatarRow: { flexDirection: "row", alignItems: "center", marginTop: 7 },
  stackAv: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: "rgba(0,0,0,0.85)",
  },
  countPill: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999, paddingHorizontal: 8, height: 24,
    alignItems: "center", justifyContent: "center",
    marginLeft: -6, borderWidth: 1.5, borderColor: "rgba(0,0,0,0.85)",
  },
  countPillText: { color: "#fff", fontFamily: theme.semibold, fontSize: 10 },

  starCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center", justifyContent: "center",
  },

  // Frosted glass bar — light glass like the reference
  glassBarWrap: {
    position: "absolute", bottom: 12, left: 12, right: 12,
    borderRadius: 30, overflow: "hidden",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.28)",
  },
  glassBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingVertical: 11, paddingLeft: 18, paddingRight: 10,
  },
  glassTextCol: { flex: 1, gap: 2 },
  glassTitle: {
    color: "#fff", fontFamily: theme.semibold, fontSize: 17.5, letterSpacing: -0.2,
    textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  glassSub: {
    color: "rgba(255,255,255,0.85)", fontFamily: theme.medium, fontSize: 11,
    textShadowColor: "rgba(0,0,0,0.45)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5,
  },
  arrowCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },

  bottomScreenFade: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: 130,
    zIndex: 10,
  },
});
