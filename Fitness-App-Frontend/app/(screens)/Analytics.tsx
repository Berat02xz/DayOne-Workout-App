import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
  Animated,
  Easing,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Ellipse, Path, Rect } from "react-native-svg";
import { theme } from "@/constants/theme";
import database from "@/database/database";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import { WorkoutLog } from "@/models/WorkoutLog";
import { ROUTINES } from "@/constants/workoutRoutines";
import FadeTranslate from "@/components/ui/FadeTranslate";

const { width: SCREEN_W } = Dimensions.get("window");
const H_PAD = 20;
const CARD_PAD = 18;

const D = {
  bg:      "#000",
  card:    "#151517",
  cardHi:  "#1D1D20",
  cardLo:  "#121214",
  border:  "rgba(255,255,255,0.055)",
  primary: "#AAFB05",
  text:    "#fff",
  sub:     "#8E8E93",
};

const ACircle: any = Animated.createAnimatedComponent(Circle);

// ── Date helpers ──────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const mondayOf = (d: Date) => {
  const sd = startOfDay(d);
  const dow = sd.getDay();
  return new Date(sd.getTime() - (dow === 0 ? 6 : dow - 1) * DAY_MS);
};

const agoStr = (ts: number | null) => {
  if (!ts) return "—";
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const fmtThousand = (v: number) =>
  Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// ── Muscle mapping ────────────────────────────────────────────────────────────
const GROUPS = [
  "Chest", "Back", "Shoulders", "Arms", "Core",
  "Quads", "Hamstrings", "Glutes", "Calves",
] as const;
type Group = (typeof GROUPS)[number];

// routine targetMuscles → canonical groups with weights
const MUSCLE_MAP: Record<string, [Group, number][]> = {
  chest:      [["Chest", 1]],
  back:       [["Back", 1]],
  lats:       [["Back", 1]],
  shoulders:  [["Shoulders", 1]],
  arms:       [["Arms", 1]],
  biceps:     [["Arms", 1]],
  triceps:    [["Arms", 1]],
  abs:        [["Core", 1]],
  obliques:   [["Core", 1]],
  core:       [["Core", 1]],
  quads:      [["Quads", 1]],
  hamstrings: [["Hamstrings", 1]],
  glutes:     [["Glutes", 1]],
  calves:     [["Calves", 1]],
  legs:       [["Quads", 0.5], ["Hamstrings", 0.5], ["Glutes", 0.5], ["Calves", 0.5]],
  "full body": GROUPS.map((g) => [g, 0.35] as [Group, number]),
};

// ── Analytics aggregation ─────────────────────────────────────────────────────
const GRID_WEEKS = 12;

interface DayActivity { minutes: number; count: number }

interface Analytics {
  totalWorkouts: number;
  totalMinutes: number;
  totalKcal: number;
  streak: number;
  bestStreak: number;
  weekDays: number;             // distinct trained days this week
  trainedDays: number;          // distinct days in grid window
  byDay: Map<string, DayActivity>;
  gridStart: Date;              // Monday, GRID_WEEKS ago
  muscleScores: Record<Group, number>;
  cardioScore: number;
  mostTrained: Group | null;
  leastTrained: Group | null;
  thisWeekMin: number;
  lastWeekMin: number;
  bestSessionMin: number;
  bestSessionName: string;
  bestBurn: number;
  bestWeekCount: number;
  lastWorkoutAt: number | null;
}

function aggregate(logs: WorkoutLog[]): Analytics {
  const byDay = new Map<string, DayActivity>();
  const dayTimes = new Set<number>();
  const muscleScores = Object.fromEntries(GROUPS.map((g) => [g, 0])) as Record<Group, number>;
  let cardioScore = 0;
  let totalMinutes = 0;
  let totalKcal = 0;
  let bestSessionMin = 0;
  let bestSessionName = "";
  let bestBurn = 0;
  let lastWorkoutAt: number | null = null;

  const weekCounts = new Map<string, number>();

  for (const log of logs) {
    const date = new Date(log.completedAt);
    const key = dayKey(date);
    const minutes = Math.round((log.durationSeconds ?? 0) / 60);
    const prev = byDay.get(key) ?? { minutes: 0, count: 0 };
    byDay.set(key, { minutes: prev.minutes + minutes, count: prev.count + 1 });
    dayTimes.add(startOfDay(date).getTime());

    totalMinutes += minutes;
    totalKcal += log.caloriesBurned ?? 0;
    if (!lastWorkoutAt || log.completedAt > lastWorkoutAt) lastWorkoutAt = log.completedAt;

    if (minutes > bestSessionMin) {
      bestSessionMin = minutes;
      bestSessionName = log.routineName;
    }
    if ((log.caloriesBurned ?? 0) > bestBurn) bestBurn = log.caloriesBurned ?? 0;

    const wk = dayKey(mondayOf(date));
    weekCounts.set(wk, (weekCounts.get(wk) ?? 0) + 1);

    const routine = ROUTINES.find((r) => r.id === log.routineId);
    for (const muscle of routine?.targetMuscles ?? []) {
      const m = muscle.toLowerCase();
      if (m === "cardio") { cardioScore += 1; continue; }
      for (const [group, w] of MUSCLE_MAP[m] ?? []) muscleScores[group] += w;
    }
  }

  // Streak — consecutive days ending today (or yesterday, so today isn't punished early)
  let streak = 0;
  const cursor = startOfDay(new Date());
  if (!byDay.has(dayKey(cursor))) cursor.setTime(cursor.getTime() - DAY_MS);
  while (byDay.has(dayKey(cursor))) {
    streak++;
    cursor.setTime(cursor.getTime() - DAY_MS);
  }

  // Longest streak ever
  const sortedDays = [...dayTimes].sort((a, b) => a - b);
  let bestStreak = 0;
  let run = 0;
  for (let i = 0; i < sortedDays.length; i++) {
    run = i > 0 && sortedDays[i] - sortedDays[i - 1] === DAY_MS ? run + 1 : 1;
    if (run > bestStreak) bestStreak = run;
  }

  // Grid window + trained days within it
  const gridStart = new Date(mondayOf(new Date()).getTime() - (GRID_WEEKS - 1) * 7 * DAY_MS);
  let trainedDays = 0;
  const today = startOfDay(new Date());
  for (let t = gridStart.getTime(); t <= today.getTime(); t += DAY_MS) {
    if (byDay.has(dayKey(new Date(t)))) trainedDays++;
  }

  // This week vs last week (minutes) + trained days this week
  const thisMonday = mondayOf(new Date());
  const lastMonday = new Date(thisMonday.getTime() - 7 * DAY_MS);
  let thisWeekMin = 0;
  let lastWeekMin = 0;
  for (const log of logs) {
    const min = Math.round((log.durationSeconds ?? 0) / 60);
    if (log.completedAt >= thisMonday.getTime()) thisWeekMin += min;
    else if (log.completedAt >= lastMonday.getTime()) lastWeekMin += min;
  }
  let weekDays = 0;
  for (const t of dayTimes) if (t >= thisMonday.getTime()) weekDays++;

  // Most / least trained
  const trained = GROUPS.filter((g) => muscleScores[g] > 0);
  const mostTrained = trained.length
    ? trained.reduce((a, b) => (muscleScores[a] >= muscleScores[b] ? a : b))
    : null;
  const leastTrained = trained.length
    ? GROUPS.reduce((a, b) => (muscleScores[a] <= muscleScores[b] ? a : b))
    : null;

  const bestWeekCount = Math.max(0, ...weekCounts.values());

  return {
    totalWorkouts: logs.length,
    totalMinutes, totalKcal: Math.round(totalKcal),
    streak, bestStreak, weekDays, trainedDays, byDay, gridStart,
    muscleScores, cardioScore, mostTrained, leastTrained,
    thisWeekMin, lastWeekMin,
    bestSessionMin, bestSessionName, bestBurn: Math.round(bestBurn), bestWeekCount,
    lastWorkoutAt,
  };
}

// ── CountUp ───────────────────────────────────────────────────────────────────
function CountUp({
  value, duration = 1100, delay = 0, format, style,
}: {
  value: number;
  duration?: number;
  delay?: number;
  format?: (v: number) => string;
  style?: any;
}) {
  const [disp, setDisp] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = Date.now() + delay;
    const tick = () => {
      const now = Date.now();
      if (now < start) { raf = requestAnimationFrame(tick); return; }
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisp(value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <Text style={style}>{format ? format(disp) : `${Math.round(disp)}`}</Text>;
}

// ── Consistency dot grid ──────────────────────────────────────────────────────
const GRID_COLS = GRID_WEEKS;
const GRID_INNER_W = SCREEN_W - H_PAD * 2 - CARD_PAD * 2;
const COL_W = GRID_INNER_W / GRID_COLS;

const DOT_LEVELS = [
  { size: 5,   color: "rgba(255,255,255,0.10)", glow: false },
  { size: 6,   color: "rgba(170,251,5,0.40)",   glow: false },
  { size: 7,   color: "rgba(170,251,5,0.72)",   glow: false },
  { size: 7.5, color: "#AAFB05",                glow: true },
];

function levelFor(act?: DayActivity): number {
  if (!act || act.minutes <= 0) return 0;
  if (act.minutes >= 60 || act.count >= 2) return 3;
  if (act.minutes >= 30) return 2;
  return 1;
}

function GridDot({
  idx, total, level, future, progress,
}: {
  idx: number; total: number; level: number; future: boolean;
  progress: Animated.Value;
}) {
  const t0 = (idx / total) * 0.82;
  const t1 = Math.min(t0 + 0.14, 1);
  const opacity = progress.interpolate({
    inputRange: [t0, t1], outputRange: [0, 1], extrapolate: "clamp",
  });
  const scale = progress.interpolate({
    inputRange: [t0, t1], outputRange: [0.2, 1], extrapolate: "clamp",
  });

  const cfg = DOT_LEVELS[level];
  const size = future ? 4 : cfg.size;
  const color = future ? "rgba(255,255,255,0.04)" : cfg.color;

  return (
    <View style={{ width: 9, height: 9, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: color,
          opacity, transform: [{ scale }],
          ...(cfg.glow && !future
            ? { shadowColor: D.primary, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } }
            : null),
        }}
      />
    </View>
  );
}

function ConsistencyGrid({
  byDay, gridStart, animKey,
}: {
  byDay: Map<string, DayActivity>; gridStart: Date; animKey: number;
}) {
  const today = startOfDay(new Date()).getTime();
  const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1, duration: 1500, delay: 250,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [animKey]);

  const weeks = Array.from({ length: GRID_WEEKS }, (_, w) =>
    new Date(gridStart.getTime() + w * 7 * DAY_MS)
  );

  // month segments (centered labels, like the reference)
  const segments: { label: string; count: number }[] = [];
  for (const monday of weeks) {
    const label = monthShort[monday.getMonth()];
    const last = segments[segments.length - 1];
    if (last && last.label === label) last.count++;
    else segments.push({ label, count: 1 });
  }

  const total = GRID_WEEKS * 7;

  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: 14 }}>
        {segments.map((seg, i) => (
          <View key={i} style={{ width: seg.count * COL_W, alignItems: "center" }}>
            <Text style={g.monthLabel}>{seg.count >= 2 ? seg.label : ""}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row" }}>
        {weeks.map((monday, w) => (
          <View key={w} style={{ width: COL_W, alignItems: "center", gap: 9 }}>
            {Array.from({ length: 7 }, (_, d) => {
              const date = new Date(monday.getTime() + d * DAY_MS);
              const future = date.getTime() > today;
              const level = levelFor(byDay.get(dayKey(date)));
              return (
                <GridDot
                  key={d}
                  idx={w * 7 + d}
                  total={total}
                  level={level}
                  future={future}
                  progress={progress}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const g = StyleSheet.create({
  monthLabel: {
    color: "rgba(255,255,255,0.45)",
    fontFamily: theme.medium, fontSize: 11, letterSpacing: 0.2,
  },
});

// ── Body heatmap ──────────────────────────────────────────────────────────────
const FIG_W = 150;
const FIG_H = 300;
const BASE_FILL = "#202024";

function heatColor(score: number, max: number): string {
  if (score <= 0 || max <= 0) return "rgba(255,255,255,0.05)";
  const t = Math.min(1, score / max);
  return `rgba(170,251,5,${(0.14 + 0.82 * t).toFixed(2)})`;
}

interface MusclePath { group: Group; d: string }

// Shared silhouette (torso, arms, legs, pelvis)
const BASE_PATHS = [
  // torso
  "M44 46 Q75 38 106 46 Q112 50 111 60 L107 104 Q105 122 99 132 L97 138 Q75 146 53 138 L51 132 Q45 122 43 104 L39 60 Q38 50 44 46 Z",
  // pelvis
  "M53 130 Q75 141 97 130 L94 152 Q75 160 56 152 Z",
  // left arm
  "M38 50 Q30 56 30 68 L28 100 Q26 124 30 144 Q32 152 36 152 Q41 151 42 143 Q45 120 44 98 L46 64 Q45 54 38 50 Z",
  // right arm
  "M112 50 Q120 56 120 68 L122 100 Q124 124 120 144 Q118 152 114 152 Q109 151 108 143 Q105 120 106 98 L104 64 Q105 54 112 50 Z",
  // left leg
  "M52 140 Q48 166 50 196 L52 216 Q52 248 54 266 Q56 276 61 276 Q66 276 67 266 Q70 242 68 216 L71 192 Q72 162 69 142 Q60 134 52 140 Z",
  // right leg
  "M98 140 Q102 166 100 196 L98 216 Q98 248 96 266 Q94 276 89 276 Q84 276 83 266 Q80 242 82 216 L79 192 Q78 162 81 142 Q90 134 98 140 Z",
];

const DELT_L = "M46 48 Q38 51 36 60 Q35 68 38 73 Q44 70 48 64 Q51 56 50 50 Q48 47 46 48 Z";
const DELT_R = "M104 48 Q112 51 114 60 Q115 68 112 73 Q106 70 102 64 Q99 56 100 50 Q102 47 104 48 Z";
const ARM_UPPER_L = "M37 56 Q33 64 33 76 Q33 90 36 98 Q40 102 43 97 Q45 88 45 74 Q45 62 43 56 Q40 52 37 56 Z";
const ARM_UPPER_R = "M113 56 Q117 64 117 76 Q117 90 114 98 Q110 102 107 97 Q105 88 105 74 Q105 62 107 56 Q110 52 113 56 Z";
const ARM_LOWER_L = "M32 104 Q30 118 30 132 Q31 142 35 144 Q39 142 40 132 Q41 118 42 106 Q38 100 32 104 Z";
const ARM_LOWER_R = "M118 104 Q120 118 120 132 Q119 142 115 144 Q111 142 110 132 Q109 118 108 106 Q112 100 118 104 Z";

const FRONT_MUSCLES: MusclePath[] = [
  { group: "Shoulders", d: DELT_L },
  { group: "Shoulders", d: DELT_R },
  { group: "Chest", d: "M52 52 Q64 48 73 51 L73 80 Q64 86 55 81 Q47 74 48 62 Q49 55 52 52 Z" },
  { group: "Chest", d: "M98 52 Q86 48 77 51 L77 80 Q86 86 95 81 Q103 74 102 62 Q101 55 98 52 Z" },
  { group: "Arms", d: ARM_UPPER_L },
  { group: "Arms", d: ARM_UPPER_R },
  { group: "Arms", d: ARM_LOWER_L },
  { group: "Arms", d: ARM_LOWER_R },
  { group: "Core", d: "M59 86 Q75 82 91 86 L89 126 Q82 134 75 134 Q68 134 61 126 Z" },
  { group: "Quads", d: "M54 144 Q50 162 51 184 Q52 200 58 208 Q65 206 67 190 Q68 166 65 148 Q59 138 54 144 Z" },
  { group: "Quads", d: "M96 144 Q100 162 99 184 Q98 200 92 208 Q85 206 83 190 Q82 166 85 148 Q91 138 96 144 Z" },
  { group: "Calves", d: "M55 222 Q53 240 54 256 Q55 266 59 268 Q63 266 64 254 Q64 238 63 224 Q59 216 55 222 Z" },
  { group: "Calves", d: "M95 222 Q97 240 96 256 Q95 266 91 268 Q87 266 86 254 Q86 238 87 224 Q91 216 95 222 Z" },
];

const BACK_MUSCLES: MusclePath[] = [
  // traps
  { group: "Back", d: "M75 38 Q88 42 100 50 L88 58 Q79 53 75 64 Q71 53 62 58 L50 50 Q62 42 75 38 Z" },
  { group: "Shoulders", d: DELT_L },
  { group: "Shoulders", d: DELT_R },
  // lats
  { group: "Back", d: "M52 60 Q48 76 52 94 Q56 108 64 116 Q70 120 72 114 L72 72 Q61 68 52 60 Z" },
  { group: "Back", d: "M98 60 Q102 76 98 94 Q94 108 86 116 Q80 120 78 114 L78 72 Q89 68 98 60 Z" },
  // lower back
  { group: "Back", d: "M67 100 Q75 97 83 100 L81 128 Q75 133 69 128 Z" },
  { group: "Arms", d: ARM_UPPER_L },
  { group: "Arms", d: ARM_UPPER_R },
  { group: "Arms", d: ARM_LOWER_L },
  { group: "Arms", d: ARM_LOWER_R },
  { group: "Glutes", d: "M56 136 Q48 142 49 153 Q50 163 58 166 Q68 167 71 159 Q73 147 68 139 Q62 133 56 136 Z" },
  { group: "Glutes", d: "M94 136 Q102 142 101 153 Q100 163 92 166 Q82 167 79 159 Q77 147 82 139 Q88 133 94 136 Z" },
  { group: "Hamstrings", d: "M53 172 Q50 188 52 202 Q54 214 60 218 Q66 214 67 198 Q68 182 65 172 Q58 166 53 172 Z" },
  { group: "Hamstrings", d: "M97 172 Q100 188 98 202 Q96 214 90 218 Q84 214 83 198 Q82 182 85 172 Q92 166 97 172 Z" },
  { group: "Calves", d: "M55 226 Q52 240 54 254 Q56 266 60 267 Q64 265 65 252 Q66 238 63 226 Q59 219 55 226 Z" },
  { group: "Calves", d: "M95 226 Q98 240 96 254 Q94 266 90 267 Q86 265 85 252 Q84 238 87 226 Q91 219 95 226 Z" },
];

function BodyFigure({ muscles, heat }: { muscles: MusclePath[]; heat: Record<Group, string> }) {
  return (
    <Svg width={FIG_W} height={FIG_H} viewBox={`0 0 ${FIG_W} ${FIG_H}`}>
      <Ellipse cx={75} cy={18} rx={11.5} ry={13.5} fill={BASE_FILL} />
      <Rect x={67} y={28} width={16} height={13} rx={5} fill={BASE_FILL} />
      {BASE_PATHS.map((d, i) => (
        <Path key={`b${i}`} d={d} fill={BASE_FILL} />
      ))}
      {muscles.map((m, i) => (
        <Path
          key={`m${i}`}
          d={m.d}
          fill={heat[m.group]}
          stroke="rgba(0,0,0,0.4)"
          strokeWidth={0.8}
        />
      ))}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [showAllMuscles, setShowAllMuscles] = useState(false);
  const [side, setSide] = useState<0 | 1>(0);

  const ringAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;
  const sideAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const userId = await getUserIdFromToken();
          if (!userId) return;
          const all = await database.get<WorkoutLog>("workout_logs").query().fetch();
          if (active) setLogs(all.filter((l) => l.userId === userId));
        } catch {}
      })();
      return () => { active = false; };
    }, [])
  );

  const a = useMemo(() => aggregate(logs), [logs]);

  // ring + bars animate when data lands
  useEffect(() => {
    ringAnim.setValue(0);
    Animated.timing(ringAnim, {
      toValue: 1, duration: 1200, delay: 250,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    barAnim.setValue(0);
    Animated.timing(barAnim, {
      toValue: 1, duration: 950, delay: 400,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [logs.length]);

  // ambient breathing glow behind the body figure
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const flipSide = (v: 0 | 1) => {
    setSide(v);
    Animated.timing(sideAnim, {
      toValue: v, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  };

  const maxScore = Math.max(...GROUPS.map((gr) => a.muscleScores[gr]), 0.001);
  const heat = Object.fromEntries(
    GROUPS.map((gr) => [gr, heatColor(a.muscleScores[gr], maxScore)])
  ) as Record<Group, string>;

  // Ranked split incl. cardio, as percentages
  const split = useMemo(() => {
    const entries: { name: string; score: number }[] = [
      ...GROUPS.map((gr) => ({ name: gr, score: a.muscleScores[gr] })),
      { name: "Cardio", score: a.cardioScore },
    ];
    const total = entries.reduce((s, e) => s + e.score, 0);
    return entries
      .sort((x, y) => y.score - x.score)
      .map((e) => ({ ...e, pct: total > 0 ? Math.round((e.score / total) * 100) : 0 }));
  }, [a]);

  const visibleSplit = showAllMuscles ? split : split.slice(0, 5);

  // Balance: least / most trained ratio across trained groups
  const balance = useMemo(() => {
    const scores = GROUPS.map((gr) => a.muscleScores[gr]).filter((v) => v > 0);
    if (scores.length < 2) return null;
    return Math.round((Math.min(...scores) / Math.max(...scores)) * 100);
  }, [a]);

  // Weekly delta
  const delta =
    a.lastWeekMin > 0
      ? Math.round(((a.thisWeekMin - a.lastWeekMin) / a.lastWeekMin) * 100)
      : null;

  // One contextual insight, picked by priority
  const insight = useMemo(() => {
    if (a.totalWorkouts === 0)
      return "Complete your first workout and watch this page come alive.";
    if (a.leastTrained && a.muscleScores[a.leastTrained] === 0)
      return `You haven't hit ${a.leastTrained.toLowerCase()} yet — sneak it into next week.`;
    if (a.mostTrained && a.leastTrained && a.mostTrained !== a.leastTrained) {
      const ratio = a.muscleScores[a.mostTrained] / Math.max(a.muscleScores[a.leastTrained], 0.001);
      if (ratio >= 3)
        return `${a.mostTrained} gets ${Math.round(ratio)}× more work than ${a.leastTrained.toLowerCase()}. Balance it out.`;
    }
    if (a.streak >= 3) return `${a.streak}-day streak — momentum looks good on you.`;
    return "Every session counts. Keep showing up.";
  }, [a]);

  // Streak ring geometry
  const RING_R = 30;
  const RING_C = 2 * Math.PI * RING_R;
  const weekFrac = Math.min(1, a.weekDays / 7);
  const dashOffset = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_C, RING_C * (1 - weekFrac)],
  });

  const frontOpacity = sideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const backOpacity = sideAnim;
  const frontScale = sideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });
  const backScale = sideAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const thumbX = sideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 64] });
  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Text style={s.headerTitle}>Analytics</Text>
        <TouchableOpacity style={s.closeBtn} activeOpacity={0.8} onPress={() => router.back()}>
          <Ionicons name="close" size={21} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Row 1: streak ring + workouts ── */}
        <FadeTranslate order={0} direction="y" translateYFrom={16}>
          <View style={s.row1}>
            {/* Streak card */}
            <LinearGradient colors={[D.cardHi, D.cardLo]} style={s.bigCard}>
              <Ionicons name="flame" size={18} color="rgba(170,251,5,0.35)" style={s.ghostIcon} />
              <View style={s.ringWrap}>
                <Svg width={72} height={72}>
                  <Circle
                    cx={36} cy={36} r={RING_R}
                    stroke="rgba(255,255,255,0.09)" strokeWidth={5} fill="none"
                  />
                  <ACircle
                    cx={36} cy={36} r={RING_R}
                    stroke={D.primary} strokeWidth={5} fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${RING_C}`}
                    strokeDashoffset={dashOffset}
                    rotation={-90} origin="36,36"
                  />
                </Svg>
                <View style={s.ringCenter}>
                  <CountUp value={a.streak} style={s.ringNumber} />
                </View>
              </View>
              <View>
                <Text style={s.bigCardLabel}>Day streak</Text>
                <Text style={s.bigCardSub}>
                  {a.bestStreak > 0 ? `Best · ${a.bestStreak}d` : "Start one today"}
                </Text>
              </View>
            </LinearGradient>

            {/* Workouts card */}
            <LinearGradient colors={[D.cardHi, D.cardLo]} style={s.bigCard}>
              <Ionicons name="barbell" size={18} color="rgba(255,255,255,0.18)" style={s.ghostIcon} />
              <CountUp value={a.totalWorkouts} style={s.bigNumber} />
              <View>
                <Text style={s.bigCardLabel}>Workouts</Text>
                <Text style={s.bigCardSub}>
                  {a.lastWorkoutAt ? `Last · ${agoStr(a.lastWorkoutAt)}` : "None yet"}
                </Text>
              </View>
            </LinearGradient>
          </View>
        </FadeTranslate>

        {/* ── Consistency dots ── */}
        <FadeTranslate order={0} delay={90} direction="y" translateYFrom={16}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Consistency</Text>
            <Text style={s.cardSub}>
              {a.trainedDays} of the last {GRID_WEEKS * 7} days
            </Text>
            <View style={{ marginTop: 18 }}>
              <ConsistencyGrid byDay={a.byDay} gridStart={a.gridStart} animKey={logs.length} />
            </View>
          </View>
        </FadeTranslate>

        {/* ── This week strip ── */}
        <FadeTranslate order={0} delay={160} direction="y" translateYFrom={14}>
          <View style={s.strip}>
            <View style={{ flex: 1 }}>
              <Text style={s.stripLabel}>This week</Text>
              {delta !== null ? (
                <View style={s.deltaRow}>
                  <Ionicons
                    name={delta >= 0 ? "trending-up" : "trending-down"}
                    size={13}
                    color={delta >= 0 ? D.primary : "#FF6B6B"}
                  />
                  <Text style={[s.deltaText, { color: delta >= 0 ? D.primary : "#FF6B6B" }]}>
                    {delta >= 0 ? "+" : ""}{delta}% vs last week
                  </Text>
                </View>
              ) : (
                <Text style={s.stripSub}>Training time</Text>
              )}
            </View>
            <View style={s.stripValueRow}>
              <CountUp value={a.thisWeekMin} style={s.stripValue} />
              <Text style={s.stripUnit}>min</Text>
            </View>
          </View>
        </FadeTranslate>

        {/* ── Muscle heatmap (hero) ── */}
        <FadeTranslate order={0} delay={230} direction="y" translateYFrom={16}>
          <LinearGradient colors={[D.cardHi, D.cardLo]} style={s.card}>
            <View style={s.heatHeader}>
              <View>
                <Text style={s.cardTitle}>Muscle heatmap</Text>
                <Text style={s.cardSub}>Brighter means more trained</Text>
              </View>
              {/* segmented control */}
              <View style={s.segWrap}>
                <Animated.View style={[s.segThumb, { transform: [{ translateX: thumbX }] }]} />
                <TouchableOpacity style={s.segBtn} activeOpacity={0.8} onPress={() => flipSide(0)}>
                  <Text style={[s.segText, side === 0 && s.segTextActive]}>Front</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.segBtn} activeOpacity={0.8} onPress={() => flipSide(1)}>
                  <Text style={[s.segText, side === 1 && s.segTextActive]}>Back</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={s.heatBody}>
              {/* figure with ambient glow + crossfade */}
              <View style={{ width: FIG_W, height: FIG_H }}>
                <Animated.View
                  style={[s.figureGlow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
                  pointerEvents="none"
                />
                <Animated.View
                  style={[StyleSheet.absoluteFill, { opacity: frontOpacity, transform: [{ scale: frontScale }] }]}
                  pointerEvents="none"
                >
                  <BodyFigure muscles={FRONT_MUSCLES} heat={heat} />
                </Animated.View>
                <Animated.View
                  style={[StyleSheet.absoluteFill, { opacity: backOpacity, transform: [{ scale: backScale }] }]}
                  pointerEvents="none"
                >
                  <BodyFigure muscles={BACK_MUSCLES} heat={heat} />
                </Animated.View>
              </View>

              {/* side stats */}
              <View style={s.heatStats}>
                <View>
                  <Text style={s.heatStatLabel}>MOST TRAINED</Text>
                  <View style={s.heatStatRow}>
                    <View style={[s.heatStatDot, { backgroundColor: D.primary }]} />
                    <Text style={s.heatStatValue}>{a.mostTrained ?? "—"}</Text>
                  </View>
                </View>
                <View>
                  <Text style={s.heatStatLabel}>LEAST TRAINED</Text>
                  <View style={s.heatStatRow}>
                    <View style={[s.heatStatDot, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
                    <Text style={s.heatStatValue}>{a.leastTrained ?? "—"}</Text>
                  </View>
                </View>
                <View>
                  <Text style={s.heatStatLabel}>BALANCE</Text>
                  <View style={s.heatStatRow}>
                    <Ionicons name="speedometer-outline" size={13} color={D.sub} />
                    <Text style={s.heatStatValue}>{balance !== null ? `${balance}%` : "—"}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* legend */}
            <View style={s.legendRow}>
              <Text style={s.legendText}>Less</Text>
              <LinearGradient
                colors={["rgba(255,255,255,0.08)", "rgba(170,251,5,0.4)", "#AAFB05"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.legendBar}
              />
              <Text style={s.legendText}>More</Text>
            </View>
          </LinearGradient>
        </FadeTranslate>

        {/* ── Muscle split ── */}
        <FadeTranslate order={0} delay={300} direction="y" translateYFrom={16}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Muscle split</Text>
            <Text style={s.cardSub}>Where your training goes</Text>
            <View style={{ gap: 12, marginTop: 16 }}>
              {visibleSplit.map((m) => (
                <View key={m.name} style={s.splitRow}>
                  <Text style={s.splitName}>{m.name}</Text>
                  <View style={s.splitBarTrack}>
                    <Animated.View
                      style={{
                        height: "100%",
                        width: barAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", `${Math.max(m.pct, m.score > 0 ? 4 : 0)}%`],
                        }),
                      }}
                    >
                      <LinearGradient
                        colors={["#D7FF4F", "#AAFB05"]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={{ flex: 1, borderRadius: 4 }}
                      />
                    </Animated.View>
                  </View>
                  <Text style={s.splitPct}>{m.pct}%</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowAllMuscles((v) => !v)}
              style={s.showAllBtn}
            >
              <Text style={s.showAllText}>
                {showAllMuscles ? "Show less" : "Show all"}
              </Text>
              <Ionicons
                name={showAllMuscles ? "chevron-up" : "chevron-down"}
                size={13}
                color={D.sub}
              />
            </TouchableOpacity>
          </View>
        </FadeTranslate>

        {/* ── Active time + energy ── */}
        <FadeTranslate order={0} delay={360} direction="y" translateYFrom={14}>
          <View style={s.miniRow}>
            <View style={s.miniCard}>
              <Text style={s.miniLabel}>Active time</Text>
              <View style={s.miniValueRow}>
                <CountUp
                  value={a.totalMinutes}
                  style={s.miniValue}
                  format={(v) => (a.totalMinutes >= 100 ? (v / 60).toFixed(1) : `${Math.round(v)}`)}
                />
                <Text style={s.miniUnit}>{a.totalMinutes >= 100 ? "h" : "min"}</Text>
              </View>
            </View>
            <View style={s.miniCard}>
              <Text style={s.miniLabel}>Energy burned</Text>
              <View style={s.miniValueRow}>
                <CountUp value={a.totalKcal} style={s.miniValue} format={fmtThousand} />
                <Text style={s.miniUnit}>kcal</Text>
              </View>
            </View>
          </View>
        </FadeTranslate>

        {/* ── Personal bests ── */}
        <FadeTranslate order={0} delay={420} direction="y" translateYFrom={16}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Personal bests</Text>
            <View style={{ gap: 14, marginTop: 16 }}>
              <View style={s.bestRow}>
                <View style={s.bestIconWrap}>
                  <Ionicons name="hourglass-outline" size={15} color={D.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.bestLabel}>Longest session</Text>
                  {!!a.bestSessionName && (
                    <Text style={s.bestMeta} numberOfLines={1}>{a.bestSessionName}</Text>
                  )}
                </View>
                <Text style={s.bestValue}>{a.bestSessionMin} min</Text>
              </View>
              <View style={s.bestRow}>
                <View style={s.bestIconWrap}>
                  <Ionicons name="flame-outline" size={15} color={D.primary} />
                </View>
                <Text style={[s.bestLabel, { flex: 1 }]}>Biggest burn</Text>
                <Text style={s.bestValue}>{a.bestBurn} kcal</Text>
              </View>
              <View style={s.bestRow}>
                <View style={s.bestIconWrap}>
                  <Ionicons name="calendar-outline" size={15} color={D.primary} />
                </View>
                <Text style={[s.bestLabel, { flex: 1 }]}>Best week</Text>
                <Text style={s.bestValue}>
                  {a.bestWeekCount} workout{a.bestWeekCount !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
          </View>
        </FadeTranslate>

        {/* ── Insight banner ── */}
        <FadeTranslate order={0} delay={480} direction="y" translateYFrom={14}>
          <View style={s.insightBanner}>
            <Ionicons name="sparkles" size={15} color={D.primary} />
            <Text style={s.insightText}>{insight}</Text>
          </View>
        </FadeTranslate>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.bg },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: H_PAD, paddingBottom: 18,
  },
  headerTitle: {
    color: D.text, fontFamily: theme.bold, fontSize: 32, letterSpacing: -0.8,
  },
  closeBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    justifyContent: "center", alignItems: "center",
  },

  // Row 1 bento
  row1: { flexDirection: "row", gap: 12, paddingHorizontal: H_PAD, marginBottom: 12 },
  bigCard: {
    flex: 1, height: 188, borderRadius: 28, padding: CARD_PAD,
    borderWidth: 1, borderColor: D.border,
    justifyContent: "space-between", overflow: "hidden",
  },
  ghostIcon: { position: "absolute", top: 16, right: 16 },
  ringWrap: { width: 72, height: 72 },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center", alignItems: "center",
  },
  ringNumber: { color: D.text, fontFamily: theme.bold, fontSize: 24, letterSpacing: -0.5 },
  bigNumber: { color: D.text, fontFamily: theme.bold, fontSize: 46, letterSpacing: -1.5, marginTop: 2 },
  bigCardLabel: { color: D.text, fontFamily: theme.bold, fontSize: 17, letterSpacing: -0.2 },
  bigCardSub: { color: D.sub, fontFamily: theme.medium, fontSize: 12.5, marginTop: 3 },

  // Generic card
  card: {
    marginHorizontal: H_PAD, marginBottom: 12,
    backgroundColor: D.card,
    borderWidth: 1, borderColor: D.border,
    borderRadius: 28, padding: CARD_PAD,
    overflow: "hidden",
  },
  cardTitle: { color: D.text, fontFamily: theme.bold, fontSize: 17, letterSpacing: -0.2 },
  cardSub: { color: D.sub, fontFamily: theme.medium, fontSize: 12.5, marginTop: 3 },

  // Strip (label left, big number right)
  strip: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: H_PAD, marginBottom: 12,
    backgroundColor: D.card,
    borderWidth: 1, borderColor: D.border,
    borderRadius: 24, paddingHorizontal: CARD_PAD, paddingVertical: 16,
  },
  stripLabel: { color: D.text, fontFamily: theme.bold, fontSize: 16, letterSpacing: -0.2 },
  stripSub: { color: D.sub, fontFamily: theme.medium, fontSize: 12, marginTop: 3 },
  deltaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  deltaText: { fontFamily: theme.bold, fontSize: 12 },
  stripValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 5 },
  stripValue: { color: D.text, fontFamily: theme.bold, fontSize: 34, letterSpacing: -1 },
  stripUnit: { color: D.sub, fontFamily: theme.bold, fontSize: 15, marginBottom: 5 },

  // Heatmap
  heatHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
  },
  segWrap: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 17, padding: 3,
  },
  segThumb: {
    position: "absolute", top: 3, left: 3,
    width: 64, height: 28, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  segBtn: { width: 64, height: 28, justifyContent: "center", alignItems: "center" },
  segText: { color: D.sub, fontFamily: theme.medium, fontSize: 12.5 },
  segTextActive: { color: D.text, fontFamily: theme.bold },

  heatBody: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  figureGlow: {
    position: "absolute", top: 40, left: -15,
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(170,251,5,0.05)",
  },
  heatStats: { flex: 1, paddingLeft: 18, gap: 20 },
  heatStatLabel: {
    color: "rgba(255,255,255,0.35)", fontFamily: theme.medium,
    fontSize: 10, letterSpacing: 1,
  },
  heatStatRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 5 },
  heatStatDot: { width: 8, height: 8, borderRadius: 4 },
  heatStatValue: { color: D.text, fontFamily: theme.bold, fontSize: 15.5, letterSpacing: -0.2 },

  legendRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
  legendBar: { flex: 1, height: 6, borderRadius: 3 },
  legendText: { color: "rgba(255,255,255,0.35)", fontFamily: theme.medium, fontSize: 11 },

  // Muscle split
  splitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  splitName: { width: 86, color: "rgba(255,255,255,0.75)", fontFamily: theme.medium, fontSize: 13 },
  splitBarTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  splitPct: {
    width: 40, textAlign: "right",
    color: D.text, fontFamily: theme.bold, fontSize: 12.5,
  },
  showAllBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, marginTop: 15,
  },
  showAllText: { color: D.sub, fontFamily: theme.medium, fontSize: 12.5 },

  // Mini cards
  miniRow: { flexDirection: "row", gap: 12, paddingHorizontal: H_PAD, marginBottom: 12 },
  miniCard: {
    flex: 1,
    backgroundColor: D.card,
    borderWidth: 1, borderColor: D.border,
    borderRadius: 24, padding: 16,
  },
  miniLabel: { color: D.sub, fontFamily: theme.medium, fontSize: 12.5 },
  miniValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 8 },
  miniValue: { color: D.text, fontFamily: theme.bold, fontSize: 27, letterSpacing: -0.8 },
  miniUnit: { color: D.sub, fontFamily: theme.bold, fontSize: 13, marginBottom: 3 },

  // Personal bests
  bestRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  bestIconWrap: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: "rgba(170,251,5,0.1)",
    justifyContent: "center", alignItems: "center",
  },
  bestLabel: { color: "rgba(255,255,255,0.78)", fontFamily: theme.medium, fontSize: 13.5 },
  bestMeta: { color: D.sub, fontFamily: theme.medium, fontSize: 11, marginTop: 1 },
  bestValue: { color: D.text, fontFamily: theme.bold, fontSize: 13.5 },

  // Insight
  insightBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginHorizontal: H_PAD,
    backgroundColor: "rgba(170,251,5,0.08)",
    borderWidth: 1, borderColor: "rgba(170,251,5,0.22)",
    borderRadius: 20, paddingHorizontal: 15, paddingVertical: 14,
  },
  insightText: {
    flex: 1, color: "rgba(255,255,255,0.85)",
    fontFamily: theme.medium, fontSize: 13, lineHeight: 18,
  },
});
