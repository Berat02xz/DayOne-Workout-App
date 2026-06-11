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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/constants/theme";
import FadeTranslate from "@/components/ui/FadeTranslate";
import { ROUTINES, type WorkoutRoutine } from "@/constants/workoutRoutines";
import { ExerciseApi, type ExerciseInfo } from "@/api/ExerciseApi";
import { User } from "@/models/User";
import database from "@/database/database";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const H_PAD = 20;
const FEATURED_W = SCREEN_W - H_PAD * 2;
const FEATURED_H = FEATURED_W * 0.78;   // ~20% shorter than before
const CARD_W = SCREEN_W - H_PAD * 2;
const CARD_H = CARD_W * 0.72;
const ITEM_H = CARD_H + 82;             // feedCard + feedInfo (~58px) + gap (26px) approx
const MAX_RESULTS = 30;

const AVATARS = [
  require("@/assets/avatars/avatar1.jpg"),
  require("@/assets/avatars/avatar2.jpg"),
  require("@/assets/avatars/avatar3.jpg"),
  require("@/assets/avatars/avatar4.jpg"),
  require("@/assets/avatars/avatar5.jpg"),
  require("@/assets/avatars/avatar6.jpg"),
  require("@/assets/avatars/avatar7.jpg"),
];

// Local images for featured routines that have them
const FEATURED_LOCAL: Record<string, any> = {
  core_30day: require("@/assets/images/workouts/core-30-day.png"),
  quick_hiit:  require("@/assets/images/workouts/quick-hiit.png"),
};

const FEATURED_IDS = ["core_30day", "quick_hiit", "full_body_gym"];
const FILTER_PILLS = ["All", "Strength", "HIIT", "Core", "Cardio"];

const formatCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${n}`;

const capitalize = (str: string) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : str;

const matchesFilter = (r: WorkoutRoutine, pill: string) => {
  if (pill === "All") return true;
  const muscles = r.targetMuscles.map((m) => m.toLowerCase());
  const name = r.name.toLowerCase();
  switch (pill) {
    case "Strength":
      return muscles.some((m) => ["chest","shoulders","arms","legs","glutes","quads","calves"].includes(m));
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

// ── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  bg:      "#000",
  primary: "#AAFB05",
  text:    "#fff",
  sub:     "#8E8E93",
};

// ── PopularCard (outside Workout to avoid recreation) ─────────────────────────
const PopularCard = React.memo(function PopularCard({
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
  const infoAv = AVATARS[(idx + 4) % AVATARS.length];
  const athlete = routine.athlete;
  const diffColor =
    routine.difficulty === "Beginner"     ? "#34C759" :
    routine.difficulty === "Intermediate" ? "#FF9500" : "#FF3B30";

  // creator pill text width — useNativeDriver: false
  const creatorAnim = useRef(new Animated.Value(0)).current;
  // avatar bubble-in — useNativeDriver: true (scale + opacity)
  const av2Anim = useRef(new Animated.Value(0)).current;
  const av1Anim = useRef(new Animated.Value(0)).current;
  const av0Anim = useRef(new Animated.Value(0)).current;
  // heart pulse — useNativeDriver: true
  const heartAnim = useRef(new Animated.Value(1)).current;
  const mountedRef = useRef(false);

  useEffect(() => {
    const isMount = !mountedRef.current;
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout>;

    if (isFocused) {
      timer = setTimeout(() => {
        Animated.timing(creatorAnim, {
          toValue: 1, duration: 500,
          easing: Easing.out(Easing.quad), useNativeDriver: false,
        }).start();
        Animated.stagger(120, [
          Animated.spring(av2Anim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
          Animated.spring(av1Anim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
          Animated.spring(av0Anim, { toValue: 1, friction: 9, tension: 70, useNativeDriver: true }),
        ]).start();
      }, isMount ? 480 : 0);
    } else {
      Animated.timing(creatorAnim, {
        toValue: 0, duration: 280,
        easing: Easing.in(Easing.quad), useNativeDriver: false,
      }).start();
      Animated.parallel([
        Animated.timing(av0Anim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(av1Anim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(av2Anim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }

    return () => clearTimeout(timer);
  }, [isFocused]);

  const pulseHeart = useCallback(() => {
    Animated.sequence([
      Animated.spring(heartAnim, { toValue: 1.55, friction: 3, tension: 450, useNativeDriver: true }),
      Animated.spring(heartAnim, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }),
    ]).start();
  }, []);

  const textWidth   = creatorAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 105] });
  const textOpacity = creatorAnim.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0, 1] });

  const av2Scale = av2Anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const av1Scale = av1Anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });
  const av0Scale = av0Anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <FadeTranslate direction="y" translateYFrom={36} delay={300} order={Math.min(idx, 4) * 0.1}>
      <TouchableOpacity activeOpacity={0.96} onPress={() => onPress(routine.id)}>
        {/* photo card */}
        <View style={s.feedCard}>
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
          <LinearGradient
            colors={["rgba(0,0,0,0.4)", "transparent", "rgba(0,0,0,0.62)"]}
            locations={[0, 0.42, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* animated creator pill */}
          <View style={s.creatorPill}>
            <Image source={infoAv} style={s.creatorAvatar} />
            <Animated.View style={{ width: textWidth, overflow: "hidden" }}>
              <Animated.View
                style={{
                  opacity: textOpacity,
                  paddingLeft: 6, paddingRight: 8,
                  width: 105,
                }}
              >
                <Text style={s.creatorByLine} numberOfLines={1}>Routine by</Text>
                <Text style={s.creatorName} numberOfLines={1}>
                  {athlete?.name ?? routine.name}
                </Text>
              </Animated.View>
            </Animated.View>
          </View>

          {/* bottom overlay */}
          <View style={s.cardBottom}>
            <View style={s.cardStatRow}>
              <TouchableOpacity activeOpacity={0.7} onPress={pulseHeart} style={s.cardStat}>
                <Animated.View style={{ transform: [{ scale: heartAnim }] }}>
                  <Ionicons name="heart" size={15} color="#FF3B5C" />
                </Animated.View>
                <Text style={s.cardStatText}>{formatCount(routine.completions ?? 0)}</Text>
              </TouchableOpacity>
              <View style={s.cardStat}>
                <Ionicons name="barbell-outline" size={14} color="rgba(255,255,255,0.8)" />
                <Text style={s.cardStatText}>{routine.exercises.length} exercises</Text>
              </View>
            </View>

            <View style={s.avatarStack}>
              <Animated.View style={{ opacity: av2Anim, transform: [{ scale: av2Scale }] }}>
                <Image source={av2} style={[s.stackAv, { zIndex: 1 }]} />
              </Animated.View>
              <Animated.View style={{ opacity: av1Anim, transform: [{ scale: av1Scale }], marginLeft: -11 }}>
                <Image source={av1} style={[s.stackAv, { zIndex: 2 }]} />
              </Animated.View>
              <Animated.View style={{ opacity: av0Anim, transform: [{ scale: av0Scale }], marginLeft: -11 }}>
                <Image source={av0} style={[s.stackAv, { zIndex: 3 }]} />
              </Animated.View>
            </View>
          </View>
        </View>

        {/* compact info row */}
        <View style={s.feedInfo}>
          <View style={{ flex: 1 }}>
            <Text style={s.feedInfoName}>{routine.name}</Text>
            <Text style={s.feedInfoMeta} numberOfLines={1}>
              {routine.duration} · {routine.targetMuscles[0]} ·{" "}
              <Text style={{ color: diffColor }}>{routine.difficulty}</Text>
            </Text>
          </View>
          <View style={s.goBtn}>
            <Ionicons name="play" size={13} color="#000" />
          </View>
        </View>
      </TouchableOpacity>
    </FadeTranslate>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

export default function Workout() {
  const insets = useSafeAreaInsets();

  const [userName, setUserName] = useState("");
  const [greeting, setGreeting] = useState("Good Morning");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [focusedCard, setFocusedCard] = useState(0);

  const scrollYRef = useRef(0);
  const feedListYRef = useRef(0);
  const featuredScrollRef = useRef<ScrollView>(null);
  const dotAnim0 = useRef(new Animated.Value(1)).current;
  const dotAnim1 = useRef(new Animated.Value(0)).current;
  const dotAnim2 = useRef(new Animated.Value(0)).current;
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Exercise pool — loaded from DB cache, or downloaded once on first launch
  const [exPool, setExPool] = useState<ExerciseInfo[]>([]);
  const [poolReady, setPoolReady] = useState(false);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  const isSearching = search.trim().length > 0;
  const isCaching = !poolReady;

  // Greeting + local user name
  useEffect(() => {
    (async () => {
      try {
        const u = await User.getUserDetails(database);
        if (u?.name) setUserName(u.name.split(" ")[0]);
      } catch {}
    })();
    const h = new Date().getHours();
    if (h < 5)       setGreeting("Good Night");
    else if (h < 12) setGreeting("Good Morning");
    else if (h < 18) setGreeting("Good Afternoon");
    else             setGreeting("Good Evening");
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

  // Reset focus when filter changes
  useEffect(() => { setFocusedCard(0); }, [activeFilter]);

  const featured = useMemo(
    () => FEATURED_IDS.map((id) => ROUTINES.find((r) => r.id === id)).filter(Boolean) as WorkoutRoutine[],
    []
  );

  const popular = useMemo(() => {
    let list = ROUTINES.filter((r) => !FEATURED_IDS.includes(r.id));
    if (activeFilter !== "All") list = list.filter((r) => matchesFilter(r, activeFilter));
    return [...list].sort((a, b) => (b.completions ?? 0) - (a.completions ?? 0));
  }, [activeFilter]);

  // Featured auto-play
  useEffect(() => {
    autoPlayRef.current = setInterval(() => {
      setFeaturedIndex(prev => {
        const next = (prev + 1) % featured.length;
        featuredScrollRef.current?.scrollTo({ x: next * (FEATURED_W + 12), animated: true });
        return next;
      });
    }, 3500);
    return () => { if (autoPlayRef.current) clearInterval(autoPlayRef.current); };
  }, [featured.length]);

  // Dot animations
  useEffect(() => {
    [dotAnim0, dotAnim1, dotAnim2].forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: i === featuredIndex ? 1 : 0,
        duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: false,
      }).start();
    });
  }, [featuredIndex]);

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

  const onFeaturedScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (FEATURED_W + 12));
    setFeaturedIndex(i);
  }, []);

  const onMainScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const sy = e.nativeEvent.contentOffset.y;
    scrollYRef.current = sy;
    const screenCenter = sy + SCREEN_H * 0.48;
    const relative = screenCenter - feedListYRef.current;
    const newIdx = Math.max(0, Math.min(popular.length - 1,
      Math.round(relative / ITEM_H - 0.3)
    ));
    setFocusedCard((prev) => prev !== newIdx ? newIdx : prev);
  }, [popular.length]);

  const onFeedListLayout = useCallback((e: any) => {
    feedListYRef.current = e.nativeEvent.layout.y;
  }, []);

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
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onMainScroll}
        scrollEventThrottle={50}
      >
        {/* ── Header ── */}
        <FadeTranslate order={0} direction="y" translateYFrom={-16}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.greeting}>{greeting}</Text>
              <Text style={s.userName}>{userName || "Athlete"} 👋</Text>
            </View>
            <TouchableOpacity
              style={s.analyticsBtn}
              activeOpacity={0.75}
              onPress={() => router.push("/Analytics")}
            >
              <Ionicons name="stats-chart" size={18} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
        </FadeTranslate>

        {/* ── Search ── */}
        <FadeTranslate order={0} delay={80} direction="y" translateYFrom={14}>
          <View style={s.searchBar}>
            {isCaching ? (
              <ActivityIndicator size="small" color={D.primary} />
            ) : (
              <Ionicons name="search" size={18} color="rgba(255,255,255,0.4)" />
            )}
            <View style={s.searchInputWrap}>
              <TextInput
                style={s.searchInput}
                placeholder={isCaching ? "" : "Search workouts, exercises..."}
                placeholderTextColor="rgba(255,255,255,0.35)"
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
            {search.length > 0 ? (
              <TouchableOpacity
                onPress={() => handleSearchChange("")}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            ) : (
              <Ionicons name="options-outline" size={18} color="rgba(255,255,255,0.55)" />
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
          /* ══ Browse: pills + featured + popular ══ */
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
                      onPress={() => setActiveFilter(pill)}
                      style={[s.pill, active && s.pillActive]}
                    >
                      <Text style={[s.pillText, active && s.pillTextActive]}>{pill}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </FadeTranslate>

            {/* ── Featured carousel ── */}
            <FadeTranslate order={0} delay={200} direction="y" translateYFrom={20}>
              <ScrollView
                ref={featuredScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={FEATURED_W + 12}
                decelerationRate="fast"
                onScroll={onFeaturedScroll}
                scrollEventThrottle={16}
                contentContainerStyle={s.featuredScroll}
              >
                {featured.map((routine) => {
                  const localImg = FEATURED_LOCAL[routine.id];
                  return (
                    <TouchableOpacity
                      key={routine.id}
                      activeOpacity={0.95}
                      onPress={() => openRoutine(routine.id)}
                      style={s.featuredCard}
                    >
                      {localImg ? (
                        <Image source={localImg} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : routine.image ? (
                        <Image source={{ uri: routine.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : null}
                      {/* lighter left gradient so image shows through on the right */}
                      <LinearGradient
                        colors={["rgba(0,0,0,0.78)", "rgba(0,0,0,0.36)", "rgba(0,0,0,0.0)"]}
                        locations={[0, 0.52, 1]}
                        start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                        style={StyleSheet.absoluteFill}
                      />
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.55)"]}
                        locations={[0.45, 1]}
                        style={StyleSheet.absoluteFill}
                      />

                      <View style={s.featuredContent}>
                        <View>
                          <Text style={s.featuredEyebrow}>FEATURED ROUTINE</Text>
                          <Text style={s.featuredTitle}>{routine.name.toUpperCase()}</Text>
                          <Text style={s.featuredAthlete}>by {routine.athlete?.name}</Text>
                          <View style={s.featuredPills}>
                            <View style={s.metaPill}>
                              <Text style={s.metaPillText}>{routine.duration.toUpperCase()}</Text>
                            </View>
                            <View style={s.metaPill}>
                              <Text style={s.metaPillText}>{routine.difficulty.toUpperCase()}</Text>
                            </View>
                          </View>
                        </View>

                        <View style={s.startBtn}>
                          <Text style={s.startBtnText}>Start Routine</Text>
                          <Ionicons name="play" size={14} color="#000" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* dots */}
              <View style={s.dotsRow}>
                {[dotAnim0, dotAnim1, dotAnim2].map((anim, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      s.dot,
                      {
                        width: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 18] }),
                        backgroundColor: anim.interpolate({ inputRange: [0, 1], outputRange: ["rgba(255,255,255,0.22)", D.primary] }),
                      },
                    ]}
                  />
                ))}
              </View>
            </FadeTranslate>

            {/* ── Popular workouts ── */}
            <FadeTranslate order={0} delay={260} direction="y" translateYFrom={16}>
              <View style={s.sectionRow}>
                <Text style={s.sectionTitle}>Popular Workouts</Text>
                <TouchableOpacity activeOpacity={0.7} onPress={() => setActiveFilter("All")}>
                  <Text style={s.seeAll}>See all</Text>
                </TouchableOpacity>
              </View>
            </FadeTranslate>

            <View style={s.feedList} onLayout={onFeedListLayout}>
              {popular.map((routine, idx) => (
                <PopularCard
                  key={routine.id}
                  routine={routine}
                  idx={idx}
                  isFocused={focusedCard === idx}
                  onPress={openRoutine}
                />
              ))}
              {popular.length === 0 && (
                <Text style={s.emptyText}>No workouts match this filter.</Text>
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

  // Header
  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: H_PAD, marginBottom: 20,
  },
  greeting: { color: "rgba(255,255,255,0.55)", fontFamily: theme.medium, fontSize: 14 },
  userName: { color: D.text, fontFamily: theme.bold, fontSize: 26, letterSpacing: -0.4, marginTop: 2 },
  analyticsBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center", alignItems: "center",
  },

  // Search
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: H_PAD, marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16, paddingHorizontal: 14, height: 48,
  },
  searchInputWrap: { flex: 1, justifyContent: "center" },
  searchInput: {
    color: D.text, fontFamily: theme.medium, fontSize: 14, paddingVertical: 0,
  },
  cachingPlaceholder: {
    position: "absolute", left: 0, right: 0,
    color: D.primary, fontFamily: theme.medium, fontSize: 14,
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
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 18, padding: 10, paddingRight: 14,
  },
  exerciseThumbWrap: {
    width: 64, height: 64, borderRadius: 14,
    backgroundColor: "#111", overflow: "hidden",
    justifyContent: "center", alignItems: "center",
  },
  exerciseThumb: { width: "100%", height: "100%" },
  exerciseInfo: { flex: 1, gap: 7 },
  exerciseName: { color: D.text, fontFamily: theme.bold, fontSize: 14.5, lineHeight: 19 },
  exercisePillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  exercisePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 8, paddingVertical: 3.5, borderRadius: 8,
  },
  exercisePillText: { color: "rgba(255,255,255,0.55)", fontFamily: theme.medium, fontSize: 10.5 },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 14 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center", alignItems: "center",
  },
  emptyTitle: { color: D.text, fontFamily: theme.bold, fontSize: 17 },

  // Filter pills
  pillScroll: { paddingHorizontal: H_PAD, paddingBottom: 20, gap: 8 },
  pill: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 21,
  },
  pillActive: { backgroundColor: D.primary, borderColor: D.primary },
  pillText: { color: "rgba(255,255,255,0.85)", fontFamily: theme.medium, fontSize: 13.5 },
  pillTextActive: { color: "#000", fontFamily: theme.bold },

  // Featured carousel
  featuredScroll: { paddingHorizontal: H_PAD, gap: 12 },
  featuredCard: {
    width: FEATURED_W, height: FEATURED_H,
    borderRadius: 28, overflow: "hidden",
    backgroundColor: "#0A1200",
    borderWidth: 1, borderColor: "rgba(170,251,5,0.22)",
  },
  featuredContent: { flex: 1, padding: 22, justifyContent: "space-between" },
  featuredEyebrow: {
    color: D.primary, fontFamily: theme.bold, fontSize: 11,
    letterSpacing: 1.6, marginBottom: 10,
  },
  featuredTitle: {
    color: D.text, fontFamily: theme.black ?? theme.bold, fontSize: 28,
    lineHeight: 33, letterSpacing: -0.5, maxWidth: FEATURED_W * 0.72,
  },
  featuredAthlete: {
    color: "rgba(255,255,255,0.65)", fontFamily: theme.medium, fontSize: 13.5, marginTop: 8,
  },
  featuredPills: { flexDirection: "row", gap: 8, marginTop: 14 },
  metaPill: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 15, paddingHorizontal: 13, paddingVertical: 6,
  },
  metaPillText: {
    color: "rgba(255,255,255,0.85)", fontFamily: theme.bold,
    fontSize: 10.5, letterSpacing: 0.8,
  },
  startBtn: {
    alignSelf: "flex-start",
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: D.primary,
    borderRadius: 26, paddingHorizontal: 24, paddingVertical: 13,
  },
  startBtnText: { color: "#000", fontFamily: theme.bold, fontSize: 15 },

  dotsRow: {
    flexDirection: "row", justifyContent: "center", gap: 6,
    marginTop: 14, marginBottom: 26,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.22)" },
  dotActive: { backgroundColor: D.primary, width: 18 },

  // Section header
  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: H_PAD, marginBottom: 16,
  },
  sectionTitle: { color: D.text, fontFamily: theme.bold, fontSize: 18, letterSpacing: -0.3 },
  seeAll: { color: D.primary, fontFamily: theme.medium, fontSize: 13.5 },

  // Feed cards
  feedList: { paddingHorizontal: H_PAD, gap: 26 },
  feedCard: {
    width: CARD_W, height: CARD_H,
    borderRadius: 24, overflow: "hidden",
    justifyContent: "space-between", padding: 14,
  },

  // animated creator pill
  creatorPill: {
    flexDirection: "row", alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.48)",
    borderRadius: 24, paddingVertical: 5, paddingLeft: 5, paddingRight: 5,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  creatorAvatar: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.55)",
  },
  creatorByLine: {
    color: "rgba(255,255,255,0.55)", fontFamily: theme.medium,
    fontSize: 9, letterSpacing: 0.4, textTransform: "uppercase",
  },
  creatorName: { color: "#fff", fontFamily: theme.bold, fontSize: 12 },

  cardBottom: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  cardStatRow: { flexDirection: "row", gap: 14 },
  cardStat: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardStatText: {
    color: "#fff", fontFamily: theme.bold, fontSize: 13.5,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  avatarStack: { flexDirection: "row", alignItems: "center" },
  stackAv: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2.5, borderColor: "#000",
  },

  // compact info under card
  feedInfo: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 4, paddingTop: 12,
  },
  feedInfoName: { color: D.text, fontFamily: theme.bold, fontSize: 15.5, letterSpacing: -0.2 },
  feedInfoMeta: { color: D.sub, fontFamily: theme.medium, fontSize: 12.5, marginTop: 2 },
  goBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: D.primary,
    justifyContent: "center", alignItems: "center",
    paddingLeft: 2, // optical center for play icon
  },

  emptyText: { color: D.sub, fontFamily: theme.medium, fontSize: 14, textAlign: "center" },

  bottomScreenFade: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    height: 130,
    zIndex: 10,
  },
});
