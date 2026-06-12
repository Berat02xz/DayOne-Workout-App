import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Vibration,
  Easing,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import ConfettiCannon from "react-native-confetti-cannon";
import { ROUTINES } from "../../constants/workoutRoutines";
import { ExerciseApi, type ExerciseInfo } from "../../api/ExerciseApi";
import FadeTranslate from "../../components/ui/FadeTranslate";
import { theme } from "../../constants/theme";
import WorkoutComplete from "../../components/ui/WorkoutComplete";
import { LikedExercise } from "../../models/LikedExercise";
import { WorkoutLog } from "../../models/WorkoutLog";
import { User } from "../../models/User";
import { getUserIdFromToken } from "../../api/TokenDecoder";
import database from "../../database/database";

const SOCIAL_PROOF_MESSAGES = [
  "169 people are working out right now",
  "250+ users have quit after this screen",
  "42 people are doing the next exercise",
  "88% of users push through this rest",
  "317 people completed this routine today",
  "15 users are on the same set as you",
  "Only 12% skip this exercise — stay strong",
  "204 people finished their workout today",
  "You're in the top 20% for consistency this week",
  "Most users give up here. Will you?",
];

const AVATAR_POOL = [
  require('../../assets/avatars/avatar1.jpg'),
  require('../../assets/avatars/avatar2.jpg'),
  require('../../assets/avatars/avatar3.jpg'),
  require('../../assets/avatars/avatar4.jpg'),
  require('../../assets/avatars/avatar5.jpg'),
  require('../../assets/avatars/avatar6.jpg'),
  require('../../assets/avatars/avatar7.jpg'),
];

export const D = {
  bg: "#000000",
  primary: "#3CD070", // Vibrant green to match mockup exactly
  card: "#121212",
  cardAlt: "#1C1C1E",
  textRef: "#B3B3B7",
  border: "#2A2A2E",
  white: "#FFFFFF",
};

// Stage palette — dark pitch-green, shared by every phase so transitions never flash
const C = {
  bgTop: "#0A120E",       // Deep dark forest green top
  bgMid: "#050806",       // Deep dark forest green middle
  bgBottom: "#020302",    // Solid black-green bottom
  glass: "rgba(255,255,255,0.06)",       // Clean dark glass
  glassStrong: "rgba(255,255,255,0.10)", // Slightly stronger glass
  glassBorder: "rgba(255,255,255,0.04)", // Ultra thin glass border
  dim: "rgba(255,255,255,0.50)",         // Medium white text
  faint: "rgba(255,255,255,0.30)",       // Low opacity white text
};

type Phase = "exercise" | "rest" | "complete";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function ProgressRing({
  progress,
  percent,
  size = 56,
  strokeWidth = 5,
}: {
  progress: Animated.Value;
  percent: number;
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={strokeWidth}
          fill="rgba(0,0,0,0.30)"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={D.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={progress.interpolate({
            inputRange: [0, 1],
            outputRange: [circumference, 0],
          })}
        />
      </Svg>
      <Text style={styles.ringPercent}>
        {percent}
        <Text style={styles.ringPercentSign}>%</Text>
      </Text>
    </View>
  );
}

export default function WorkoutPlayer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ routineId: string }>();

  const routine = ROUTINES.find((r) => r.id === params.routineId) ?? null;
  const exercises = routine?.exercises ?? [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [phase, setPhase] = useState<Phase>("exercise");
  const currentExercise = exercises[currentIndex] ?? null;

  const getExerciseDuration = (ex: any) => ex?.durationSeconds || 300; // fallback to 5mins

  const [restTimer, setRestTimer] = useState(0);
  const [exerciseTimer, setExerciseTimer] = useState<number>(getExerciseDuration(currentExercise));
  const [isPaused, setIsPaused] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [exerciseInfo, setExerciseInfo] = useState<ExerciseInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [userInitials, setUserInitials] = useState("");

  const [showHypeOverlay, setShowHypeOverlay] = useState(true);
  const hypeOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Keep overlay for 2 seconds, then animate out over 1 second
    const timer = setTimeout(() => {
      Animated.timing(hypeOpacity, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start(() => {
        setShowHypeOverlay(false);
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    User.getUserDetails(database)
      .then((u) => {
        if (u?.name) setUserInitials(u.name.substring(0, 2).toUpperCase());
      })
      .catch(() => {});
  }, []);

  // Fetch exercise info & check like status when exercise changes
  useEffect(() => {
    if (currentExercise?.exerciseId) {
      LikedExercise.isLiked(database, currentExercise.exerciseId).then(setIsLiked);
      setInfoLoading(true);
      setExerciseInfo(null);
      ExerciseApi.getExerciseById(currentExercise.exerciseId)
        .then((info) => setExerciseInfo(info))
        .catch(() => { })
        .finally(() => setInfoLoading(false));
    }
  }, [currentIndex]);

  const handleToggleLike = async () => {
    if (!currentExercise) return;
    const liked = await LikedExercise.toggle(
      database,
      currentExercise.exerciseId,
      currentExercise.name,
      currentExercise.gifUrl || "",
      currentExercise.category || "",
    );
    setIsLiked(liked);
  };

  // Bottom Sheet
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [activeSheet, setActiveSheet] = useState<"upNext" | "instruction" | null>(null);

  const handleOpenSheet = (type: "upNext" | "instruction") => {
    setActiveSheet(type);
    bottomSheetRef.current?.snapToIndex(0);
  };

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleTransitionAnim = useRef(new Animated.Value(1)).current;
  const timerCircleAnim = useRef(new Animated.Value(1)).current;
  const breathingScale1 = useRef(new Animated.Value(1)).current;
  const breathingScale2 = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const cardEnterAnim = useRef(new Animated.Value(0)).current;
  const arrowNudge = useRef(new Animated.Value(0)).current;
  const hintBounce = useRef(new Animated.Value(0)).current;
  const fabScale = useRef(new Animated.Value(1)).current;
  const [socialProofVisible, setSocialProofVisible] = useState(false);
  const [socialProofAvatars, setSocialProofAvatars] = useState<number[]>([]);
  const [socialProofMessage, setSocialProofMessage] = useState('');

  // Gamification: Burning Calories
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const fireScaleAnim = useRef(new Animated.Value(1)).current;
  const fireRotateAnim = useRef(new Animated.Value(0)).current;
  const calPulseAnim = useRef(new Animated.Value(1)).current;

  const totalExercises = exercises.length;

  // Keep an up-to-date ref for handleNext to avoid stale closures inside intervals
  const handleNextRef = useRef<(() => void) | undefined>(undefined);

  // GIF card slides in fresh every time the exercise (or set) changes
  useEffect(() => {
    if (phase !== "exercise") return;
    cardEnterAnim.setValue(0);
    Animated.spring(cardEnterAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [currentIndex, currentSet, phase]);

  // Idle nudge on the edge arrows + bounce on the swipe-up hint
  useEffect(() => {
    const nudge = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowNudge, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(arrowNudge, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    const bounce = Animated.loop(
      Animated.sequence([
        Animated.timing(hintBounce, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(hintBounce, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    nudge.start();
    bounce.start();
    return () => {
      nudge.stop();
      bounce.stop();
    };
  }, []);

  useEffect(() => {
    if (phase === "exercise" && !isPaused) {
      if (exerciseTimer <= 0) return;

      const interval = setInterval(() => {
        setExerciseTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            // Trigger automatic transition
            setTimeout(() => {
              if (handleNextRef.current) handleNextRef.current();
            }, 0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [phase, isPaused, exerciseTimer]);

  useEffect(() => {
    if (totalExercises > 0 && currentExercise) {
      if (phase === "complete") {
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }).start();
      } else {
        const currentDur = getExerciseDuration(currentExercise);
        const baseProgress = currentIndex / totalExercises;
        const totalSets = currentExercise.sets || 1;
        const setFraction = 1 / totalSets;

        let targetProgress = baseProgress;

        if (phase === "exercise") {
          const completedSetsProgress = (currentSet - 1) * setFraction;
          const activeSetProgress = (1 - exerciseTimer / currentDur) * setFraction;
          targetProgress += (completedSetsProgress + activeSetProgress) / totalExercises;

          Animated.timing(progressAnim, {
            toValue: targetProgress,
            duration: 1000,
            useNativeDriver: false,
          }).start();
        } else if (phase === "rest") {
          const completedSetsProgress = currentSet * setFraction;
          targetProgress += completedSetsProgress / totalExercises;

          Animated.timing(progressAnim, {
            toValue: targetProgress,
            duration: 500,
            useNativeDriver: false,
          }).start();
        }
      }
    }
  }, [currentIndex, currentSet, totalExercises, phase, exerciseTimer, currentExercise]);

  useEffect(() => {
    if (phase === "rest" && !isPaused) {
      // Social proof banner
      setSocialProofVisible(true);
      const indices = Array.from({ length: AVATAR_POOL.length }, (_, i) => i)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      setSocialProofAvatars(indices);
      setSocialProofMessage(
        SOCIAL_PROOF_MESSAGES[Math.floor(Math.random() * SOCIAL_PROOF_MESSAGES.length)]
      );

      Animated.loop(
        Animated.sequence([
          Animated.timing(timerCircleAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(timerCircleAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(breathingScale1, {
            toValue: 1.4,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(breathingScale1, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(breathingScale2, {
            toValue: 1.8,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(breathingScale2, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      timerCircleAnim.setValue(1);
      timerCircleAnim.stopAnimation();
      breathingScale1.setValue(1);
      breathingScale1.stopAnimation();
      breathingScale2.setValue(1);
      breathingScale2.stopAnimation();
    }
  }, [phase, isPaused, timerCircleAnim, breathingScale1, breathingScale2]);

  // Tick rest timer
  useEffect(() => {
    if (phase !== "rest" || isPaused) return;

    if (restTimer <= 0) {
      handleRestComplete();
      return;
    }

    const interval = setInterval(() => {
      setRestTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleRestComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, restTimer, isPaused]);

  // Total elapsed time & Calorie counter
  useEffect(() => {
    if (phase === "complete" || isPaused) return;

    // Start pulsing/wobbling animation for the fire icon while active
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(fireScaleAnim, { toValue: 1.25, duration: 300, useNativeDriver: true }),
          Animated.timing(fireScaleAnim, { toValue: 0.9, duration: 350, useNativeDriver: true }),
          Animated.timing(fireScaleAnim, { toValue: 1.1, duration: 300, useNativeDriver: true }),
          Animated.timing(fireScaleAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(fireRotateAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(fireRotateAnim, { toValue: -1, duration: 600, useNativeDriver: true }),
          Animated.timing(fireRotateAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      ])
    ).start();

    const interval = setInterval(() => {
      setTotalElapsed((t) => t + 1);

      const duration = getExerciseDuration(currentExercise);
      const expected = currentExercise?.expectedCalories || 10;
      const burnRatePerSecond = expected / duration;

      setCaloriesBurned((c) => {
        const next = +(c + burnRatePerSecond).toFixed(2);
        if (Math.floor(next) > Math.floor(c)) {
          Animated.sequence([
            Animated.timing(calPulseAnim, { toValue: 1.6, duration: 80, useNativeDriver: true }),
            Animated.spring(calPulseAnim, { toValue: 1, useNativeDriver: true, bounciness: 16, speed: 12 } as any),
          ]).start();
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      fireScaleAnim.stopAnimation();
      fireRotateAnim.stopAnimation();
    };
  }, [phase, isPaused, fireScaleAnim, fireRotateAnim]);

  const fireRotationInterpolate = fireRotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-12deg', '12deg']
  });

  // Cross-fade + soft zoom. Both phases share the same stage background, so the
  // swap never flashes a different color mid-transition.
  const animateTransition = useCallback(
    (cb: () => void) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scaleTransitionAnim, {
          toValue: 0.96,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        cb();
        scaleTransitionAnim.setValue(1.04);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(scaleTransitionAnim, {
            toValue: 1,
            friction: 8,
            tension: 60,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [fadeAnim, scaleTransitionAnim]
  );

  const handleNext = () => {
    if (phase === "rest") {
      setRestTimer(0);
      handleRestComplete();
      return;
    }

    if (!currentExercise) return;

    // Check if this is the last set of the last exercise
    if (currentIndex >= exercises.length - 1 && currentSet >= currentExercise.sets) {
      setPhase("complete");
      // Persist the workout log
      const totalCalories = exercises.reduce(
        (sum, ex) => sum + (ex.expectedCalories ?? 0) * ex.sets, 0
      );
      getUserIdFromToken().then((userId) => {
        if (userId && routine) {
          database.write(() =>
            WorkoutLog.logWorkout(database, {
              userId,
              routineId:       routine.id,
              routineName:     routine.name,
              durationSeconds: totalElapsed,
              caloriesBurned:  totalCalories,
            })
          ).catch(() => {});
        }
      }).catch(() => {});
      return;
    }

    animateTransition(() => {
      setRestTimer(currentExercise.restSeconds || 60);
      setPhase("rest");
    });
  };

  handleNextRef.current = handleNext;

  const handleRestComplete = () => {
    if (!currentExercise) return;
    Vibration.vibrate([0, 100, 50, 100]);

    if (currentSet < currentExercise.sets) {
      animateTransition(() => {
        setExerciseTimer(getExerciseDuration(currentExercise));
        setCurrentSet((s) => s + 1);
        setPhase("exercise");
      });
    } else {
      animateTransition(() => {
        const nextIdx = currentIndex + 1;
        setExerciseTimer(getExerciseDuration(exercises[nextIdx]));
        setCurrentIndex(nextIdx);
        setCurrentSet(1);
        setPhase("exercise");
      });
    }
  };

  const handlePrevious = () => {
    if (phase === "rest") {
      setExerciseTimer(getExerciseDuration(currentExercise));
      animateTransition(() => {
        setPhase("exercise");
      });
      return;
    }

    if (currentSet > 1) {
      setExerciseTimer(getExerciseDuration(currentExercise));
      animateTransition(() => setCurrentSet((s) => s - 1));
    } else if (currentIndex > 0) {
      const prevExercise = exercises[currentIndex - 1];
      setExerciseTimer(getExerciseDuration(prevExercise));
      animateTransition(() => {
        setCurrentIndex((i) => i - 1);
        setCurrentSet(prevExercise.sets);
        setPhase("exercise");
      });
    } else {
      // Re-start current if already at beginning
      setExerciseTimer(getExerciseDuration(currentExercise));
    }
  };

  const handleTogglePause = () => {
    Animated.sequence([
      Animated.timing(fabScale, { toValue: 0.88, duration: 90, useNativeDriver: true }),
      Animated.spring(fabScale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    setIsPaused((p) => !p);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!routine) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Routine not found.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // Numeric overall progress mirrors what progressAnim animates towards
  let numericProgress = 0;
  if (totalExercises > 0 && currentExercise) {
    if (phase === "complete") {
      numericProgress = 1;
    } else {
      const setFraction = 1 / (currentExercise.sets || 1);
      const dur = getExerciseDuration(currentExercise);
      const within =
        phase === "exercise"
          ? (currentSet - 1) * setFraction + (1 - exerciseTimer / dur) * setFraction
          : currentSet * setFraction;
      numericProgress = (currentIndex + within) / totalExercises;
    }
  }
  const percentLabel = Math.max(0, Math.min(100, Math.round(numericProgress * 100)));

  // Up-next target (used by rest screen)
  let upNextExercise = currentExercise;
  let upNextSetLabel = currentExercise ? `Set ${Math.min(currentSet + 1, currentExercise.sets)} of ${currentExercise.sets}` : "";
  if (currentExercise && currentSet >= currentExercise.sets) {
    const nextExer = exercises[currentIndex + 1];
    if (nextExer) {
      upNextExercise = nextExer;
      upNextSetLabel = `Set 1 of ${nextExer.sets}`;
    } else {
      upNextExercise = null as any;
      upNextSetLabel = "";
    }
  }

  const headerTitle = phase === "rest" ? "Rest" : isPaused ? "Paused" : "In Progress";
  const isTimerLow = phase === "exercise" && exerciseTimer <= 10;

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[C.bgTop, C.bgMid, C.bgBottom]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>

        {/* HYPE OVERLAY */}
        {showHypeOverlay && (
          <Animated.View style={[StyleSheet.absoluteFill, { top: -insets.top, bottom: -insets.bottom, zIndex: 9999, opacity: hypeOpacity }]}>
            <BlurView intensity={120} experimentalBlurMethod="dimezisBlurView" tint="dark" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
              <FadeTranslate order={0} translateYFrom={20}>
                <Text style={styles.hypeTitle}>Ready to Start?</Text>
                <Text style={styles.hypeSub}>Let&apos;s get this workout!</Text>
              </FadeTranslate>
            </BlurView>
          </Animated.View>
        )}

        {/* HEADER — persists across phases so the swap feels seamless */}
        {phase !== "complete" && (
          <FadeTranslate order={0} direction="y" translateYFrom={-16} style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.headerGlassBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </Pressable>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <View style={styles.headerAvatar}>
              <Image source={AVATAR_POOL[0]} style={{ width: "100%", height: "100%" }} />
            </View>
          </FadeTranslate>
        )}

        <Animated.View
          style={[
            styles.contentHost,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleTransitionAnim }],
            },
          ]}
        >
          {phase === "complete" ? (
            <WorkoutComplete
              routineName={routine?.name || "Custom Workout"}
              duration={formatTime(totalElapsed)}
              calories={caloriesBurned}
              exercises={totalExercises}
              onFinish={() => router.back()}
            />
          ) : phase === "rest" ? (
            /* ─────────────── REST ─────────────── */
            <View style={styles.restContainer}>

              {/* Social proof */}
              {socialProofVisible && (
                <FadeTranslate order={0.5} translateYFrom={-12} style={styles.socialProofChip}>
                  <View style={{ flexDirection: 'row', marginRight: 12 }}>
                    {socialProofAvatars.map((idx, i) => (
                      <Image key={i} source={AVATAR_POOL[idx]} style={[styles.socialAvatar, { marginLeft: i > 0 ? -10 : 0 }]} />
                    ))}
                  </View>
                  <Text style={styles.socialProofText} numberOfLines={2}>
                    {socialProofMessage}
                  </Text>
                </FadeTranslate>
              )}

              {/* Breathing timer */}
              <View style={styles.restTimerZone}>
                <Animated.View style={[styles.breathCircle, { width: 280, height: 280, transform: [{ scale: breathingScale2 }] }]} />
                <Animated.View style={[styles.breathCircle, { width: 200, height: 200, backgroundColor: 'rgba(170,251,5,0.08)', transform: [{ scale: breathingScale1 }] }]} />
                <Text style={styles.restEyebrow}>TAKE A BREATH</Text>
                <Animated.Text style={[styles.restTimerText, { transform: [{ scale: timerCircleAnim }] }]}>
                  {formatTime(restTimer)}
                </Animated.Text>
                <Text style={styles.restExerciseCount}>
                  Exercise {currentIndex + 1}/{totalExercises}
                </Text>
              </View>

              {/* Up next card */}
              {upNextExercise && (
                <FadeTranslate order={1} translateYFrom={16}>
                  <Pressable onPress={() => handleOpenSheet('upNext')} style={styles.upNextCard}>
                    <View style={styles.upNextThumb}>
                      {upNextExercise.gifUrl ? (
                        <Image source={{ uri: upNextExercise.gifUrl }} style={{ width: '100%', height: '100%' }} />
                      ) : (
                        <Ionicons name="barbell-outline" size={26} color="#999" />
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.upNextLabel}>UP NEXT</Text>
                      <Text style={styles.upNextName} numberOfLines={1}>{upNextExercise.name}</Text>
                      <Text style={styles.upNextSets}>{upNextSetLabel}</Text>
                    </View>
                    <Ionicons name="list" size={22} color={C.dim} />
                  </Pressable>
                </FadeTranslate>
              )}

              {/* Rest controls */}
              <View style={[styles.restControls, { marginBottom: Math.max(insets.bottom, 12) + 8 }]}>
                <Pressable
                  onPress={() => setRestTimer((r) => r + 30)}
                  style={({ pressed }) => [styles.restGlassBtn, pressed && styles.pressedDim]}
                >
                  <Text style={styles.restGlassBtnText}>+30 sec</Text>
                </Pressable>
                <Pressable
                  onPress={handleNext}
                  style={({ pressed }) => [styles.restSkipBtn, pressed && styles.pressedDim]}
                >
                  <Text style={styles.restSkipBtnText}>Start Now</Text>
                  <Ionicons name="play-skip-forward" size={18} color="#000" />
                </Pressable>
              </View>
            </View>
          ) : (
            /* ─────────────── EXERCISE ─────────────── */
            currentExercise && (
              <View style={styles.exerciseContainer}>

                {/* Top card — "25 Hand Pass / 30 sec" + progress ring */}
                <FadeTranslate order={0.5} translateYFrom={-12} style={styles.topPill}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text numberOfLines={1}>
                      <Text style={styles.topPillReps}>{currentExercise.reps || "25"} </Text>
                      <Text style={styles.topPillName}>{currentExercise.name}</Text>
                    </Text>
                    <Text style={styles.topPillMeta} numberOfLines={1}>
                      / {getExerciseDuration(currentExercise)} sec  ·  Set {Math.min(currentSet, currentExercise.sets)}/{currentExercise.sets}  ·  {Math.floor(caloriesBurned)} kcal
                    </Text>
                  </View>

                  <ProgressRing progress={progressAnim} percent={percentLabel} />
                </FadeTranslate>

                {/* Stage — free-floating exercise animation + edge arrows */}
                <View style={styles.stage}>
                  <View style={[styles.gifHost, isPaused && { opacity: 0.35 }]}>
                    <Animated.View
                      style={[
                        styles.gifWrap,
                        {
                          opacity: cardEnterAnim,
                          transform: [
                            { scale: cardEnterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                            { translateY: cardEnterAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                          ],
                        },
                      ]}
                    >
                      {currentExercise.gifUrl ? (
                        <Image source={{ uri: currentExercise.gifUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                      ) : (
                        <View style={styles.gifFallback}>
                          <Ionicons name="barbell-outline" size={90} color="rgba(255,255,255,0.2)" />
                        </View>
                      )}
                    </Animated.View>
                  </View>

                  {/* Paused indicator */}
                  {isPaused && (
                    <View style={styles.pausedChip} pointerEvents="none">
                      <Ionicons name="pause" size={16} color="#fff" />
                      <Text style={styles.pausedChipText}>PAUSED</Text>
                    </View>
                  )}

                  {/* Edge arrows */}
                  <Animated.View
                    style={[
                      styles.edgeArrow,
                      styles.edgeArrowLeft,
                      { transform: [{ translateY: -32 }, { translateX: arrowNudge.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] },
                    ]}
                  >
                    <Pressable
                      onPress={handlePrevious}
                      disabled={currentIndex === 0 && currentSet === 1}
                      style={styles.edgeArrowPress}
                      hitSlop={10}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={16}
                        color={currentIndex === 0 && currentSet === 1 ? C.faint : D.primary}
                      />
                    </Pressable>
                  </Animated.View>
                  <Animated.View
                    style={[
                      styles.edgeArrow,
                      styles.edgeArrowRight,
                      { transform: [{ translateY: -32 }, { translateX: arrowNudge.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) }] },
                    ]}
                  >
                    <Pressable onPress={handleNext} style={styles.edgeArrowPress} hitSlop={10}>
                      <Ionicons name="chevron-forward" size={16} color={D.primary} />
                    </Pressable>
                  </Animated.View>
                </View>

                {/* Big timer — overlaps the bottom of the animation */}
                <Text
                  style={[styles.bigTimer, isTimerLow && { color: D.primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {formatTime(exerciseTimer)}
                </Text>

                {/* Bottom controls — Session | Pause | Time */}
                <View style={styles.controlsRow}>
                  <View style={styles.controlPill}>
                    <Text style={styles.controlPillLabel}>Session</Text>
                    <Text style={styles.controlPillValue} numberOfLines={1}>
                      {currentExercise.category || routine.name}
                    </Text>
                  </View>

                  <Animated.View style={[styles.fabHalo, { transform: [{ scale: fabScale }] }]}>
                    <Pressable onPress={handleTogglePause} style={styles.pauseFab}>
                      <Ionicons name={isPaused ? "play" : "pause"} size={26} color="#000" style={isPaused ? { marginLeft: 3 } : undefined} />
                    </Pressable>
                  </Animated.View>

                  <View style={styles.controlPill}>
                    <Text style={styles.controlPillLabel}>Time</Text>
                    <Text style={styles.controlPillValue} numberOfLines={1}>{routine.duration}</Text>
                  </View>
                </View>

                {/* Swipe up hint + side actions */}
                <View style={[styles.hintRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                  <Pressable onPress={handleToggleLike} style={styles.sideActionBtn} hitSlop={6}>
                    <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={isLiked ? "#ff4757" : C.dim} />
                  </Pressable>
                  <Pressable onPress={() => handleOpenSheet("instruction")} style={styles.hintCenter}>
                    <Animated.View style={{ transform: [{ translateY: hintBounce.interpolate({ inputRange: [0, 1], outputRange: [3, -3] }) }] }}>
                      <Ionicons name="chevron-up" size={16} color={D.primary} />
                    </Animated.View>
                    <Text style={styles.hintText}>Swipe up for instruction</Text>
                  </Pressable>
                  <Pressable onPress={() => handleOpenSheet("upNext")} style={styles.sideActionBtn} hitSlop={6}>
                    <Ionicons name="list" size={18} color={C.dim} />
                  </Pressable>
                </View>
              </View>
            )
          )}
        </Animated.View>

        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={["70%", "95%"]}
          enablePanDownToClose={true}
          backgroundStyle={{ backgroundColor: '#141A10', borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
          handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.2)', width: 40 }}
          onChange={(index) => {
            if (index === -1) setActiveSheet(null);
          }}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ width: 32, height: 32 }} />
            <Text style={styles.sheetHeaderTitle}>
              {activeSheet === "instruction" ? "Instructions" : "List of exercises"}
            </Text>
            <Pressable
              onPress={() => bottomSheetRef.current?.close()}
              style={styles.sheetCloseBtn}
            >
              <Ionicons name='close' size={20} color='#fff' />
            </Pressable>
          </View>

          <BottomSheetScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {activeSheet === "instruction" && (
              <View>
                {infoLoading ? (
                  <Text style={styles.sheetEmptyText}>Loading...</Text>
                ) : !exerciseInfo ? (
                  <Text style={styles.sheetEmptyText}>No details available.</Text>
                ) : (
                  <View>
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                      {exerciseInfo.category && (
                        <View style={styles.infoCard}>
                          <View style={styles.infoCardIcon}>
                            <Ionicons name="body-outline" size={20} color={D.primary} />
                          </View>
                          <Text style={styles.infoCardLabel}>Target Muscle</Text>
                          <Text style={styles.infoCardValue} numberOfLines={1}>
                            {exerciseInfo.target || exerciseInfo.bodyPart || exerciseInfo.category}
                          </Text>
                        </View>
                      )}
                      {exerciseInfo.equipment && (
                        <View style={styles.infoCard}>
                          <View style={styles.infoCardIcon}>
                            <Ionicons name="barbell-outline" size={20} color={D.primary} />
                          </View>
                          <Text style={styles.infoCardLabel}>Equipment</Text>
                          <Text style={styles.infoCardValue} numberOfLines={1}>
                            {exerciseInfo.equipment.replace(/_/g, ' ')}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.sheetSectionTitle}>How to perform</Text>

                    {exerciseInfo.instructions && exerciseInfo.instructions.length > 0 ? (
                      <View style={styles.stepsCard}>
                        {exerciseInfo.instructions.map((step, index) => {
                          // Remove "Step 1:", "1.", etc from the beginning of the string
                          const cleanStep = step.replace(/^(?:Step\s*\d+\s*:\s*|\d+\.\s*)/i, '').trim();
                          return (
                            <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: index === exerciseInfo.instructions!.length - 1 ? 0 : 20 }}>
                              <View style={styles.stepBadge}>
                                <Text style={styles.stepBadgeText}>{index + 1}</Text>
                              </View>
                              <Text style={styles.stepText}>{cleanStep}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.sheetEmptyText}>
                        Instructions not available for this exercise.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {activeSheet === "upNext" && (
              <View>
                {/* Dynamic Grouping */}
                {Object.entries((exercises || []).reduce((acc, ex, i) => {
                  const cat = ex.category || "WARM UP";
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push({ ...ex, origIndex: i });
                  return acc;
                }, {} as Record<string, any[]>)).map(([category, exs]) => (
                  <View key={category} style={{ marginBottom: 12 }}>
                    {/* Section Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 16 }}>
                      <Text style={styles.sheetCategoryTitle}>{category.toUpperCase()}</Text>
                      <Text style={styles.sheetCategoryCount}>{exs.length} exercises</Text>
                    </View>

                    {/* Exercise List */}
                    {exs.map((ex) => {
                      const isActive = ex.origIndex === currentIndex;
                      let durationStr = "0:30";
                      if (ex.durationSeconds) {
                        const mins = Math.floor(ex.durationSeconds / 60);
                        const secs = ex.durationSeconds % 60;
                        durationStr = mins + ":" + secs.toString().padStart(2, '0');
                      } else if (ex.duration) {
                        durationStr = ex.duration + "";
                      } else if (ex.sets) {
                        durationStr = ex.sets + " Sets";
                      }

                      return (
                        <View key={ex.origIndex} style={[styles.sheetExerciseRow, isActive && { backgroundColor: D.primary }]}>
                          {/* Thumbnail */}
                          <View style={styles.sheetExerciseThumb}>
                            {ex.gifUrl ? (
                              <Image source={{ uri: ex.gifUrl }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                              <Ionicons name='barbell-outline' size={30} color='#333' style={{ alignSelf: 'center', marginTop: 20 }} />
                            )}
                          </View>

                          {/* Info */}
                          <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Text style={[styles.sheetExerciseName, isActive && { color: '#000' }]} numberOfLines={1}>
                              {ex.name}
                            </Text>
                            <Text style={[styles.sheetExerciseDuration, isActive && { color: 'rgba(0,0,0,0.6)' }]}>
                              {durationStr}
                            </Text>
                          </View>

                          {/* Info Icon */}
                          <View style={{ alignSelf: 'flex-start', padding: 4 }}>
                            <Ionicons name='information-circle' size={20} color={isActive ? '#000' : 'rgba(255,255,255,0.3)'} />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      </View>

      {/* Confetti fires when workout is complete — rendered last so it's on top */}
      {phase === "complete" && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <ConfettiCannon
            count={120}
            origin={{ x: -10, y: 0 }}
            fadeOut
            autoStart
            colors={["#AAFB05", "#FFFFFF", "#FFD700", "#22C55E", "#3B82F6"]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: D.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: D.white,
    fontSize: 18,
    fontFamily: theme.semibold,
    marginBottom: 20,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: D.cardAlt,
    borderRadius: 12,
  },
  backBtnText: {
    color: D.white,
    fontFamily: theme.semibold,
  },
  screen: {
    flex: 1,
    backgroundColor: C.bgBottom,
  },
  container: {
    flex: 1,
  },
  contentHost: {
    flex: 1,
  },
  hypeTitle: {
    fontFamily: theme.black,
    fontSize: 44,
    color: "#fff",
    textAlign: "center",
  },
  hypeSub: {
    fontFamily: theme.bold,
    fontSize: 18,
    color: D.primary,
    textAlign: "center",
    marginTop: 12,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    height: 60,
    zIndex: 50,
  },
  headerGlassBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.glass,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: theme.bold,
    letterSpacing: 0.3,
  },
  headerAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  headerAvatarText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: theme.bold,
  },

  // Top card
  topPill: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  topPillReps: {
    color: "#fff",
    fontSize: 22,
    fontFamily: theme.black,
  },
  topPillName: {
    color: "#fff",
    fontSize: 22,
    fontFamily: theme.medium,
  },
  topPillMeta: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontFamily: theme.medium,
    marginTop: 4,
  },
  kcalStack: {
    alignItems: "center",
    marginRight: 14,
  },
  kcalValue: {
    color: "#fff",
    fontSize: 16,
    fontFamily: theme.black,
  },
  kcalUnit: {
    color: C.faint,
    fontSize: 8,
    fontFamily: theme.bold,
    letterSpacing: 1.5,
    marginTop: 1,
  },
  ringPercent: {
    color: "#fff",
    fontSize: 13,
    fontFamily: theme.bold,
  },
  ringPercentSign: {
    fontSize: 9,
    color: C.dim,
  },

  // Stage — free-floating animation
  exerciseContainer: {
    flex: 1,
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  gifHost: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  gifWrap: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    borderRadius: 28,
    overflow: "hidden",
  },
  gifFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pausedChip: {
    position: "absolute",
    alignSelf: "center",
    top: "44%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(8,12,6,0.85)",
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    zIndex: 5,
  },
  pausedChipText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: theme.black,
    letterSpacing: 3,
  },
  edgeArrow: {
    position: "absolute",
    top: "50%",
    marginTop: -32,
    width: 28,
    height: 64,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    justifyContent: "center",
    zIndex: 10,
  },
  edgeArrowLeft: {
    left: 0,
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: "flex-start",
    paddingLeft: 4,
    borderLeftWidth: 0,
  },
  edgeArrowRight: {
    right: 0,
    borderTopLeftRadius: 32,
    borderBottomLeftRadius: 32,
    alignItems: "flex-end",
    paddingRight: 4,
    borderRightWidth: 0,
  },
  edgeArrowPress: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  // Big timer — pulled up so it overlaps the animation like the mockup
  bigTimer: {
    color: "#fff",
    fontSize: 98,
    lineHeight: 102,
    fontFamily: theme.black,
    textAlign: "center",
    marginTop: -42,
    marginHorizontal: 24,
    zIndex: 5,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    transform: [{ scaleX: 1.35 }], // Wide futuristic extended style
  },

  // Bottom controls
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    marginTop: 10,
    marginBottom: 6,
  },
  controlPill: {
    flex: 1,
    maxWidth: 120,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  controlPillLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontFamily: theme.bold,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  controlPillValue: {
    color: "#fff",
    fontSize: 14,
    fontFamily: theme.bold,
  },
  fabHalo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  pauseFab: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: D.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: D.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingTop: 14,
  },
  hintCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  hintText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    fontFamily: theme.medium,
    marginTop: 4,
  },
  sideActionBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.35,
  },

  // Rest
  restContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  socialProofChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    marginTop: 14,
  },
  socialAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.bgMid,
  },
  socialProofText: {
    fontFamily: theme.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    maxWidth: 200,
  },
  restTimerZone: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  breathCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(60,208,112,0.05)",
  },
  restEyebrow: {
    color: C.dim,
    fontSize: 13,
    fontFamily: theme.bold,
    letterSpacing: 4,
    marginBottom: 8,
  },
  restTimerText: {
    color: D.primary,
    fontSize: 96,
    lineHeight: 104,
    fontFamily: theme.black,
    letterSpacing: -2,
  },
  restExerciseCount: {
    color: C.faint,
    fontSize: 14,
    fontFamily: theme.medium,
    marginTop: 8,
  },
  upNextCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 24,
    padding: 12,
    marginBottom: 18,
  },
  upNextThumb: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#fff",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  upNextLabel: {
    color: D.primary,
    fontSize: 11,
    fontFamily: theme.bold,
    letterSpacing: 2,
    marginBottom: 3,
  },
  upNextName: {
    color: "#fff",
    fontSize: 17,
    fontFamily: theme.bold,
    marginBottom: 2,
  },
  upNextSets: {
    color: C.dim,
    fontSize: 13,
    fontFamily: theme.medium,
  },
  restControls: {
    flexDirection: "row",
    gap: 12,
  },
  restGlassBtn: {
    flex: 1,
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    paddingVertical: 17,
    borderRadius: 30,
    alignItems: "center",
  },
  restGlassBtnText: {
    color: "#fff",
    fontFamily: theme.bold,
    fontSize: 16,
  },
  restSkipBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    backgroundColor: D.primary,
    paddingVertical: 17,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  restSkipBtnText: {
    color: "#000",
    fontFamily: theme.bold,
    fontSize: 16,
  },
  pressedDim: {
    opacity: 0.75,
  },

  // Bottom sheet
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
  },
  sheetHeaderTitle: {
    color: "#fff",
    fontSize: 22,
    fontFamily: theme.bold,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetEmptyText: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: theme.medium,
    fontSize: 16,
    textAlign: "center",
    marginTop: 40,
  },
  sheetSectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontFamily: theme.bold,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 16,
    borderRadius: 20,
    alignItems: "flex-start",
  },
  infoCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(60, 208, 112, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  infoCardLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontFamily: theme.medium,
    marginBottom: 4,
  },
  infoCardValue: {
    color: "#fff",
    fontSize: 16,
    fontFamily: theme.bold,
    textTransform: "capitalize",
  },
  stepsCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(60, 208, 112, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    marginTop: 2,
  },
  stepBadgeText: {
    color: D.primary,
    fontFamily: theme.bold,
    fontSize: 14,
  },
  stepText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontFamily: theme.medium,
    flex: 1,
    lineHeight: 24,
  },
  sheetCategoryTitle: {
    color: "#fff",
    fontFamily: theme.bold,
    fontSize: 13,
    letterSpacing: 1,
  },
  sheetCategoryCount: {
    color: D.primary,
    fontFamily: theme.medium,
    fontSize: 13,
  },
  sheetExerciseRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 8,
    borderRadius: 20,
    marginBottom: 12,
    minHeight: 80,
  },
  sheetExerciseThumb: {
    width: 70,
    height: 70,
    backgroundColor: "#111",
    borderRadius: 16,
    overflow: "hidden",
    marginRight: 16,
  },
  sheetExerciseName: {
    color: "#fff",
    fontFamily: theme.bold,
    fontSize: 16,
    marginBottom: 4,
  },
  sheetExerciseDuration: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: theme.medium,
    fontSize: 14,
  },
});
