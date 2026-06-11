import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Vibration,
  Image,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import { ROUTINES, RoutineExercise } from "../../constants/workoutRoutines";
import { ExerciseApi, type ExerciseInfo } from "../../api/ExerciseApi";
import SolidBackground from "../../components/ui/SolidBackground";
import FadeTranslate from "../../components/ui/FadeTranslate";
import GlassEffect from "../../components/ui/GlassEffect";
import ButtonFit from "../../components/ui/ButtonFit";
import { BlurView } from "expo-blur";
import { theme } from "../../constants/theme";
import WorkoutComplete from "../../components/ui/WorkoutComplete";
import { LikedExercise } from "../../models/LikedExercise";
import { WorkoutLog } from "../../models/WorkoutLog";
import { getUserIdFromToken } from "../../api/TokenDecoder";
import database from "../../database/database";
import ConfettiCannon from "react-native-confetti-cannon";

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
  primary: "#AAFB05",
  card: "#121212",
  cardAlt: "#1C1C1E",
  textRef: "#B3B3B7",
  border: "#2A2A2E",
  white: "#FFFFFF",
};

type Phase = "exercise" | "rest" | "complete";

export default function WorkoutPlayer() {
  const insets = useSafeAreaInsets();
  const { height: SCREEN_H, width: SCREEN_W } = useWindowDimensions();
  const artworkSize = Math.min(SCREEN_W - 40, 450); // Give it a fixed max width for tablets
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
  const exerciseIntroAnim = useRef(new Animated.Value(0)).current;
  const prevIndexRef = useRef(currentIndex);
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

  const isFirstIntroRef = useRef(true);

  useEffect(() => {
    if (phase === "exercise") {
      if (currentIndex !== prevIndexRef.current || isFirstIntroRef.current) {
        prevIndexRef.current = currentIndex;
        isFirstIntroRef.current = false;
        exerciseIntroAnim.setValue(0);
        Animated.sequence([
          Animated.delay(1000),
          Animated.timing(exerciseIntroAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: false,
          })
        ]).start();
      }
    }
  }, [currentIndex, phase]);

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

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"]
  });

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

  const animateTransition = useCallback(
    (cb: () => void) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleTransitionAnim, {
          toValue: 1.1, // Punch out (grow slightly)
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        cb();
        scaleTransitionAnim.setValue(0.5); // Start small for punch in
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(scaleTransitionAnim, {
            toValue: 1,
            friction: 6,
            tension: 50,
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
      if (currentSet < currentExercise.sets) {
        setRestTimer(currentExercise.restSeconds || 60);
        setPhase("rest");
      } else {
        // We're on the last set of the current exercise
        setRestTimer(currentExercise.restSeconds || 60);
        setPhase("rest");
      }
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

  const screenBackgroundColor =
    phase === "rest" ? D.primary : phase === "complete" ? D.bg : "#FFFFFF";

  return (
    <View style={[styles.screen, { backgroundColor: screenBackgroundColor }]}>
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: screenBackgroundColor }]}>

        {/* HYPE OVERLAY */}
        {showHypeOverlay && (
          <Animated.View style={[StyleSheet.absoluteFill, { top: -insets.top, bottom: -insets.bottom, zIndex: 9999, opacity: hypeOpacity }]}>
            <BlurView intensity={120} experimentalBlurMethod="dimezisBlurView" tint="dark" style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
              <FadeTranslate order={0} translateYFrom={20}>
                <Text style={{ fontFamily: theme.black, fontSize: 44, fontWeight: "900", color: "#fff", textAlign: "center" }}>
                  Ready to Start?
                </Text>
                <Text style={{ fontFamily: theme.bold, fontSize: 18, color: D.primary, textAlign: "center", marginTop: 12 }}>
                  Let&apos;s get this workout!
                </Text>
              </FadeTranslate>
            </BlurView>
          </Animated.View>
        )}

        {/* TOP HEADER (Calories) */}
        {phase === "exercise" && (
          <FadeTranslate order={0} direction="y" translateYFrom={-20} style={[styles.topToggleRow, { justifyContent: 'space-between', paddingHorizontal: 24, gap: 16, alignItems: 'center', zIndex: 100 }]}>
            <Pressable onPress={() => router.back()} style={{ zIndex: 10 }}>
              <Ionicons name="chevron-down" size={32} color="#000" />
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999 }}>
              <Animated.View style={{ transform: [{ scale: fireScaleAnim }, { rotate: fireRotationInterpolate }], marginRight: 6 }}>
                <Text style={{ fontSize: 18 }}>🔥</Text>
              </Animated.View>
              <Animated.Text style={{ color: '#fff', fontSize: 20, fontFamily: theme.black, transform: [{ scale: calPulseAnim }], letterSpacing: 0 }}>
                {Math.floor(caloriesBurned)}
              </Animated.Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: theme.bold, marginLeft: 4, paddingTop: 2 }}>KCAL</Text>
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
            (() => {
              let upNextExerName = currentExercise?.name;
              let upNextSetName = `Set ${currentSet + 1} of ${currentExercise?.sets}`;
              let upNextImage = currentExercise?.gifUrl;

              if (currentExercise && currentSet >= currentExercise.sets) {
                const nextExer = exercises[currentIndex + 1];
                if (nextExer) {
                  upNextExerName = nextExer.name;
                  upNextSetName = `Set 1 of ${nextExer.sets}`;
                  upNextImage = nextExer.gifUrl;
                } else {
                  upNextExerName = "Workout Complete";
                  upNextSetName = "";
                  upNextImage = null;
                }
              }

              return (
                <FadeTranslate order={0.2} delay={100} style={[StyleSheet.absoluteFillObject, { backgroundColor: D.primary, justifyContent: 'center', alignItems: 'center' }]}>
                  {/* Top Right List Icon */}
                  <Pressable onPress={() => handleOpenSheet('upNext')} style={{ position: 'absolute', top: 16, right: 24, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                    <Ionicons name="list" size={24} color="#000" />
                  </Pressable>

                  {/* Rest Text */}
                  {/* Social Proof Box */}
                  {socialProofVisible && (
                    <Animated.View style={{ position: 'absolute', top: 80, flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, zIndex: 10 }}>
                      <View style={{ flexDirection: 'row', marginRight: 12 }}>
                        {socialProofAvatars.map((idx, i) => (
                          <Image key={i} source={AVATAR_POOL[idx]} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#000', marginLeft: i > 0 ? -10 : 0 }} />
                        ))}
                      </View>
                      <Text style={{ fontFamily: theme.medium, fontSize: 13, color: '#fff', maxWidth: 200 }} numberOfLines={2}>
                        {socialProofMessage}
                      </Text>
                    </Animated.View>
                  )}

                  <Text style={{ fontFamily: theme.bold, fontSize: 36, color: '#000', marginBottom: 20 }}>Rest</Text>

                  {/* Timer */}
                  <Text style={{ fontFamily: theme.black, fontSize: 100, color: '#000', marginBottom: 30, letterSpacing: -2 }}>
                    {formatTime(restTimer)}
                  </Text>

                  {/* Up Next Info */}
                  <View style={{ alignItems: 'center', marginTop: 10 }}>
                    <Text style={{ fontFamily: theme.medium, fontSize: 13, color: '#000', marginBottom: 6 }}>
                      Exercise {currentIndex + 1}/{totalExercises}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontFamily: theme.bold, fontSize: 20, color: '#000', textTransform: 'uppercase' }}>
                        {upNextExerName}
                      </Text>
                      <Ionicons name="information-circle" size={20} color="#000" style={{ marginLeft: 8 }} />
                    </View>
                  </View>

                  {/* Bottom Buttons */}
                  <View style={{ position: 'absolute', bottom: insets.bottom + 20, left: 24, right: 24, flexDirection: 'row', gap: 12 }}>
                    <Pressable
                      onPress={() => setRestTimer((r) => r + 30)}
                      style={{ flex: 1, backgroundColor: '#000', paddingVertical: 18, borderRadius: 30, alignItems: 'center' }}
                    >
                      <Text style={{ color: '#fff', fontFamily: theme.medium, fontSize: 18 }}>+30 sec</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleNext}
                      style={{ flex: 1, backgroundColor: 'transparent', paddingVertical: 18, borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: '#000' }}
                    >
                      <Text style={{ color: '#000', fontFamily: theme.medium, fontSize: 16 }}>Start Exercise</Text>
                    </Pressable>
                  </View>
                </FadeTranslate>
              );
            })()
          ) : (
            currentExercise && (
              <View style={{ flex: 1 }}>
                {/* Top Image Section */}
                <Animated.View style={{ height: exerciseIntroAnim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H, SCREEN_H * 0.60] }), position: 'absolute', top: -insets.top, left: 0, right: 0, backgroundColor: '#FFF' }}>
                  {currentExercise.gifUrl ? (
                    <Image source={{ uri: currentExercise.gifUrl }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                  ) : (
                    <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="barbell-outline" size={100} color="#ccc" />
                    </View>
                  )}
                </Animated.View>

                {/* Bottom Information Section */}
                <Animated.View style={{ flex: 1, marginTop: exerciseIntroAnim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H, SCREEN_H * 0.60 - insets.top] }) }}>
                  <View style={{ flex: 1, backgroundColor: '#121212', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 24, paddingHorizontal: 24 }}>

                    {/* Title & Set/Exercise Status */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1, paddingRight: 16 }}>
                        <Text style={{ color: D.primary, fontSize: 14, fontFamily: theme.bold, marginBottom: 8, letterSpacing: 1 }}>
                          SET {Math.min(currentSet, currentExercise.sets)}/{currentExercise.sets} • EXERCISE {currentIndex + 1}/{totalExercises}
                        </Text>
                        <Text style={{ color: '#fff', fontSize: 32, fontFamily: theme.black, textTransform: 'uppercase', lineHeight: 36 }} numberOfLines={2}>
                          {currentExercise.name}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <Pressable onPress={handleToggleLike} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={isLiked ? "heart" : "heart-outline"} size={22} color={isLiked ? "#ff4757" : "#fff"} />
                        </Pressable>
                        <Pressable onPress={() => handleOpenSheet("instruction")} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="information-circle" size={24} color="#fff" />
                        </Pressable>
                        <Pressable onPress={() => handleOpenSheet("upNext")} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name="list" size={24} color="#fff" />
                        </Pressable>
                      </View>
                    </View>

                    {/* Timer and Progress Section */}
                    <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                        {/* Left Side Timer */}
                        <Text style={{ color: '#fff', fontSize: 13, fontFamily: theme.bold, width: 44, textAlign: 'right' }}>
                          {formatTime(exerciseTimer)}
                        </Text>

                        {/* Center Progress Track */}
                        <View style={{ flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
                          <Animated.View style={{ height: '100%', backgroundColor: D.primary, width: progressWidth, borderRadius: 2 }} />
                          {/* Playhead dot style visual */}
                          <Animated.View style={{
                            position: 'absolute', top: -2, bottom: -2,
                            left: progressWidth,
                            width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff',
                            marginLeft: -4
                          }} />
                        </View>

                        {/* Right Side Percentage */}
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontFamily: theme.bold, width: 44, textAlign: 'left' }}>
                          {Math.round(((currentIndex + 1) / totalExercises) * 100)}%
                        </Text>
                      </View>
                    </View>

                    {/* Next / Prev Controls */}
                    <View style={{ flexDirection: 'row', marginTop: 'auto', marginBottom: Math.max(insets.bottom + 16, 24), gap: 16 }}>
                      <Pressable
                        onPress={handlePrevious}
                        disabled={currentIndex === 0 && currentSet === 1}
                        style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#2C2C2E', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Ionicons name="play-skip-back" size={24} color={(currentIndex === 0 && currentSet === 1) ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.6)"} />
                      </Pressable>

                      {/* Large Next Button */}
                      <Pressable onPress={handleNext} style={{ flex: 1, height: 64, borderRadius: 32, backgroundColor: D.primary, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
                        {(() => {
                          let nextExName = "Workout Complete";
                          let nextExTime = "0:00";
                          let nextExImg = null;

                          if (currentSet < currentExercise.sets) {
                            nextExName = currentExercise.name + " (Set " + (currentSet + 1) + ")";
                            nextExTime = formatTime(getExerciseDuration(currentExercise));
                            nextExImg = currentExercise.gifUrl;
                          } else if (currentIndex < exercises.length - 1) {
                            const nextEx = exercises[currentIndex + 1];
                            nextExName = nextEx.name;
                            nextExTime = formatTime(getExerciseDuration(nextEx));
                            nextExImg = nextEx.gifUrl;
                          }

                          return (
                            <>
                              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                                {nextExImg && <Image source={{ uri: nextExImg }} style={{ width: '100%', height: '100%' }} />}
                              </View>
                              <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={{ color: '#000', fontSize: 16, fontFamily: theme.bold }} numberOfLines={1}>{nextExName}</Text>
                                <Text style={{ color: 'rgba(0,0,0,0.6)', fontSize: 14, fontFamily: theme.medium }}>{nextExTime}</Text>
                              </View>
                              <View style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="play-skip-forward" size={24} color="#000" />
                              </View>
                            </>
                          )
                        })()}
                      </Pressable>
                    </View>
                  </View>
                </Animated.View>
              </View>
            )
          )}
        </Animated.View>

        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={["70%", "95%"]}
          enablePanDownToClose={true}
          backgroundStyle={{ backgroundColor: '#1C1C1E', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          handleIndicatorStyle={{ display: 'none' }}
          onChange={(index) => {
            if (index === -1) setActiveSheet(null);
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20 }}>
            <View style={{ width: 32, height: 32 }} /> {/* Spacer to center title */}
            <Text style={{ color: '#fff', fontSize: 22, fontFamily: theme.bold }}>
              {activeSheet === "instruction" ? "Instructions" : "List of exercises"}
            </Text>
            <Pressable
              onPress={() => bottomSheetRef.current?.close()}
              style={{ width: 32, height: 32, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}
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
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: theme.medium, fontSize: 16, textAlign: 'center', marginTop: 40 }}>Loading...</Text>
                ) : !exerciseInfo ? (
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: theme.medium, fontSize: 16, textAlign: 'center', marginTop: 40 }}>No details available.</Text>
                ) : (
                  <View>
                    <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                      {exerciseInfo.category && (
                        <View style={{ flex: 1, backgroundColor: '#252528', padding: 16, borderRadius: 20, alignItems: 'flex-start' }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(170, 251, 5, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                            <Ionicons name="body-outline" size={20} color={D.primary} />
                          </View>
                          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: theme.medium, marginBottom: 4 }}>Target Muscle</Text>
                          <Text style={{ color: '#fff', fontSize: 16, fontFamily: theme.bold, textTransform: 'capitalize' }} numberOfLines={1}>
                            {exerciseInfo.target || exerciseInfo.bodyPart || exerciseInfo.category}
                          </Text>
                        </View>
                      )}
                      {exerciseInfo.equipment && (
                        <View style={{ flex: 1, backgroundColor: '#252528', padding: 16, borderRadius: 20, alignItems: 'flex-start' }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(170, 251, 5, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                            <Ionicons name="barbell-outline" size={20} color={D.primary} />
                          </View>
                          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: theme.medium, marginBottom: 4 }}>Equipment</Text>
                          <Text style={{ color: '#fff', fontSize: 16, fontFamily: theme.bold, textTransform: 'capitalize' }} numberOfLines={1}>
                            {exerciseInfo.equipment.replace(/_/g, ' ')}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Text style={{ color: '#fff', fontSize: 20, fontFamily: theme.bold, marginBottom: 16 }}>How to perform</Text>

                    {exerciseInfo.instructions && exerciseInfo.instructions.length > 0 ? (
                      <View style={{ backgroundColor: '#252528', borderRadius: 24, padding: 20, marginBottom: 20 }}>
                        {exerciseInfo.instructions.map((step, index) => {
                          // Remove "Step 1:", "1.", etc from the beginning of the string
                          const cleanStep = step.replace(/^(?:Step\s*\d+\s*:\s*|\d+\.\s*)/i, '').trim();
                          return (
                            <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: index === exerciseInfo.instructions!.length - 1 ? 0 : 20 }}>
                              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(170, 251, 5, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 16, marginTop: 2 }}>
                                <Text style={{ color: D.primary, fontFamily: theme.bold, fontSize: 14 }}>{index + 1}</Text>
                              </View>
                              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, fontFamily: theme.medium, flex: 1, lineHeight: 24 }}>
                                {cleanStep}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, fontFamily: theme.medium }}>
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
                  const cat = ex.category || "WARM UP"; // Fallback to reference layout
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push({ ...ex, origIndex: i });
                  return acc;
                }, {} as Record<string, any[]>)).map(([category, exs]) => (
                  <View key={category} style={{ marginBottom: 12 }}>
                    {/* Section Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 16 }}>
                      <Text style={{ color: '#fff', fontFamily: theme.bold, fontSize: 13, letterSpacing: 1 }}>{category.toUpperCase()}</Text>
                      <Text style={{ color: D.primary, fontFamily: theme.medium, fontSize: 13 }}>{exs.length} exercises</Text>
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
                        <View key={ex.origIndex} style={{ flexDirection: 'row', alignItems: 'stretch', backgroundColor: isActive ? D.primary : '#252528', padding: 8, borderRadius: 20, marginBottom: 12, minHeight: 80 }}>
                          {/* Thumbnail */}
                          <View style={{ width: 70, height: 70, backgroundColor: '#111', borderRadius: 16, overflow: 'hidden', marginRight: 16 }}>
                            {ex.gifUrl ? (
                              <Image source={{ uri: ex.gifUrl }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                              <Ionicons name='barbell-outline' size={30} color='#333' style={{ alignSelf: 'center', marginTop: 20 }} />
                            )}
                          </View>

                          {/* Info */}
                          <View style={{ flex: 1, justifyContent: 'center' }}>
                            <Text style={{ color: isActive ? '#000' : '#fff', fontFamily: theme.bold, fontSize: 16, marginBottom: 4 }} numberOfLines={1}>
                              {ex.name}
                            </Text>
                            <Text style={{ color: isActive ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.5)', fontFamily: theme.medium, fontSize: 14 }}>
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
  },
  container: {
    flex: 1,
  },
  topToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    position: 'relative',
    height: 40,
  },
  topToggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 30,
    padding: 3,
  },
  toggleActive: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  toggleInactive: {
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  toggleTextActive: {
    color: '#fff',
    fontFamily: theme.bold,
    fontSize: 14,
  },
  toggleTextInactive: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: theme.semibold,
    fontSize: 14,
  },
  contentHost: {
    flex: 1,
  },

  // YT Music Player Styles
  ytContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  ytArtwork: {
    alignSelf: 'center',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    marginTop: 10,
  },
  ytLowerHalf: {
    flex: 1,
    justifyContent: 'space-evenly',
    paddingBottom: 8,
  },
  ytTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 450,
    maxWidth: '100%',
    alignSelf: 'center',
    paddingTop: 10,
  },
  calTopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,64,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,64,0,0.35)',
  },
  calTopPillText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: theme.bold,
    letterSpacing: 0.3,
  },
  caloriesBannerContainer: {
    marginBottom: 20,
    alignSelf: 'center',
    backgroundColor: '#1C1C1E', // solid modern sleek
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#2A2A2E',
  },
  caloriesBannerText: {
    color: '#fff',
    fontFamily: theme.bold,
    fontSize: 20,
    letterSpacing: 0.5,
  },
  ytTitleCenter: {
    flex: 1,
    alignItems: 'flex-start',
    marginHorizontal: 8,
  },
  ytTitle: {
    color: '#fff',
    fontSize: 28,
    fontFamily: theme.bold,
    marginBottom: 8,
    lineHeight: 34,
  },
  ytSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontFamily: theme.medium,
  },
  heartButton: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  ytControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    width: 450,
    maxWidth: '100%',
    alignSelf: 'center',
    gap: 40,
  },
  controlButton: {
    padding: 12,
  },
  ytPlayPause: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  ytBottomTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'transparent',
    paddingTop: 10,
    paddingBottom: 25,
  },
  ytBottomTabCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
  },
  ytBottomTabIndicator: {
    width: 24,
    height: 3,
    backgroundColor: '#fff',
    borderRadius: 2,
    marginTop: 4,
    position: 'absolute',
    bottom: -10,
  },
  ytBottomTab: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: theme.medium,
  },

  // INLINE GUIDE STYLES
  inlineGuideContainer: {
    paddingHorizontal: 24,
    paddingTop: 30, // Brought up
    paddingBottom: 60,
    backgroundColor: D.cardAlt,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: 20, // Push slightly below the fold
  },
  sheetTitle: {
    color: D.white,
    fontFamily: theme.bold,
    fontSize: 22,
    marginBottom: 30,
  },
  sheetDescText: {
    color: D.textRef,
    fontFamily: theme.medium,
    fontSize: 16,
    lineHeight: 24,
  },
  stepRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepLineContainer: {
    alignItems: 'center',
    marginRight: 16,
    width: 32,
  },
  stepNumberWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: D.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepNumber: {
    color: D.bg,
    fontFamily: theme.bold,
    fontSize: 14,
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(170, 251, 5, 0.3)',
    marginTop: 4,
    marginBottom: -16,
  },
  stepTextContainer: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 16,
  },
  stepText: {
    color: D.white,
    fontFamily: theme.medium,
    fontSize: 16,
    lineHeight: 24,
  },

  // New Rest Screen Styles
  restContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  timerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  timerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 30,
    zIndex: 10,
  },
  timeAdjustBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerValueCol: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
  },
  timerValAnimated: {
    color: D.primary,
    fontFamily: theme.bold,
    fontSize: 72,
    lineHeight: 80,
    textShadowColor: 'rgba(170, 251, 5, 0.3)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 15,
  },
  timerLblAnimated: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: theme.bold,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 4,
  },
  glowQuoteWrapper: {
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 60,
    paddingBottom: 8,
  },
  upNextContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  quoteIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: D.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  topMessageContainer: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    paddingHorizontal: 24,
  },
  socialProofRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 30,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  socialAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: D.bg,
  },
  socialProofText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontFamily: theme.medium,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  glowQuoteText: {
    color: D.white,
    fontFamily: theme.medium,
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
    opacity: 0.75,
    marginBottom: 20,
  },
  upNextCard: {
    backgroundColor: '#121212',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2E',
  },
  upNextCardTitle: {
    color: D.textRef,
    fontFamily: theme.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  upNextCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 400,
    maxWidth: '100%',
    alignSelf: 'center',
  },
  upNextThumb: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginRight: 16,
    backgroundColor: '#1C1C1E',
  },
  upNextCardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  upNextCardExer: {
    color: D.white,
    fontFamily: theme.bold,
    fontSize: 18,
    marginBottom: 4,
  },
  upNextCardSets: {
    color: D.primary,
    fontFamily: theme.medium,
    fontSize: 14,
  },
  skipRestFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: D.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  completeScreen: {
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 60,
    flexGrow: 1,
  },
  completeEyebrow: {
    color: D.primary,
    fontFamily: theme.bold,
    fontSize: 16,
    letterSpacing: 4,
    marginBottom: 16,
    textAlign: "center",
  },
  completeTitle: {
    color: D.white,
    fontFamily: theme.black,
    fontSize: 52,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 60,
  },
  completeSub: {
    color: D.textRef,
    fontFamily: theme.medium,
    fontSize: 20,
    textAlign: "center",
    lineHeight: 28,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    width: "100%",
    marginBottom: 40,
  },
  statCard: {
    width: "47%",
    backgroundColor: "#111111",
    borderRadius: 20,
    padding: 20,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#222",
  },
  statCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  statCardVal: {
    color: D.white,
    fontFamily: theme.bold,
    fontSize: 26,
    marginBottom: 4,
  },
  statCardLbl: {
    color: D.textRef,
    fontFamily: theme.medium,
    fontSize: 13,
  },
  completeCTA: {
    width: "100%",
  },
  // legacy — kept to avoid any remaining references
  statsRow: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
    marginBottom: 40,
  },
  statBox: {
    flex: 1,
    backgroundColor: "#151515",
    borderRadius: 24,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2A2A2E",
  },
  statIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(170,251,5,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  statVal: {
    color: D.white,
    fontFamily: theme.bold,
    fontSize: 24,
    marginBottom: 4,
  },
  statLbl: {
    color: D.textRef,
    fontFamily: theme.medium,
    fontSize: 13,
  },
  sheetContent: {
    padding: 24,
  },
  sheetExerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: D.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  sheetExerInfo: {
    flex: 1,
  },
  sheetExerName: {
    color: D.white,
    fontSize: 16,
    fontFamily: theme.semibold,
    marginBottom: 4,
  },
  sheetExerSets: {
    color: D.primary,
    fontSize: 14,
    fontFamily: theme.medium,
  },
  sheetEmptyText: {
    color: D.textRef,
    fontSize: 16,
    fontFamily: theme.medium,
    textAlign: "center",
    marginTop: 20,
  },
  breathingCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
});
