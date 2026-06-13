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
  type TextStyle,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Ellipse, Path } from "react-native-svg";
import { theme } from "@/constants/theme";
import workoutDatabase from "@/database/database";
import { getUserIdFromToken } from "@/api/TokenDecoder";
import { WorkoutLog } from "@/models/WorkoutLog";
import { ROUTINES } from "@/constants/workoutRoutines";
import FadeTranslate from "@/components/ui/FadeTranslate";

const { width: SCREEN_W } = Dimensions.get("window");
const H_PAD = 20;
const CARD_PAD = 18;

const D = {
  bg:      "#000",
  card:    "#121214",
  border:  "rgba(255,255,255,0.06)",
  primary: "#AAFB05",
  text:    "#fff",
  sub:     "#8E8E93",
};

const NUM: TextStyle = { fontVariant: ["tabular-nums"] };

type RangeKey = "week" | "month" | "all";

const RANGES: { key: RangeKey; label: string; shortLabel: string; days: number | null }[] = [
  { key: "week", label: "This week", shortLabel: "Week", days: 7 },
  { key: "month", label: "Last 4 weeks", shortLabel: "Month", days: 28 },
  { key: "all", label: "All time", shortLabel: "All", days: null },
];

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

interface AnalyticsData {
  totalWorkouts: number;
  totalMinutes: number;
  totalKcal: number;
  streak: number;
  bestStreak: number;
  trainedDays: number;          // distinct days in grid window
  byDay: Map<string, DayActivity>;
  gridStart: Date;              // Monday, GRID_WEEKS ago
  muscleScores: Record<Group, number>;
  cardioScore: number;
  mostTrained: Group | null;
  leastTrained: Group | null;
  bestSessionMin: number;
  bestSessionName: string;
  bestBurn: number;
  bestWeekCount: number;
  lastWorkoutAt: number | null;
}

function aggregate(logs: WorkoutLog[]): AnalyticsData {
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
    streak, bestStreak, trainedDays, byDay, gridStart,
    muscleScores, cardioScore, mostTrained, leastTrained,
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
  }, [delay, duration, value]);

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
  }, [animKey, progress]);

  const weeks = Array.from({ length: GRID_WEEKS }, (_, w) =>
    new Date(gridStart.getTime() + w * 7 * DAY_MS)
  );

  // month segments (centered labels)
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
// Anatomical figure, viewBox 0 0 120 252, centered on x = 60.
// Left-side muscles are hand-drawn; right side is generated by mirroring,
// so the figure is perfectly symmetric.

const VB_W = 120;
const VB_H = 252;
const FIG_W = 124;

const BASE_FILL = "#1A1A1E";   // silhouette
const REST_FILL = "#27272D";   // untrained muscle
const SEP = D.card;            // separation strokes match the card bg

// Mirrors an absolute-coordinate path (M/L/C/Q/Z only) across x = 60.
function mirrorPath(d: string): string {
  return d.replace(/([MLCQ])([^MLCQZ]+)/g, (_match, cmd, coords) => {
    const nums = coords.trim().split(/[\s,]+/).map(Number);
    const out: number[] = [];
    for (let i = 0; i < nums.length; i += 2) {
      out.push(+(2 * 60 - nums[i]).toFixed(2), nums[i + 1]);
    }
    return cmd + out.join(" ") + " ";
  });
}

// — base silhouette parts —
const NECK =
  "M53.8 19.5 L66.2 19.5 C65.6 23.4 65.6 26.6 66.4 30 L53.6 30 C54.4 26.6 54.4 23.4 53.8 19.5 Z";

const TORSO =
  "M60 28.2 C57.5 28.2 55 28 53 28.6 C49 29.8 44.6 31.6 41 34 " +
  "C38 36 36.4 38 36 40.5 C37.6 44.5 38.8 48.5 40 52 " +
  "C41 55 41.2 57.5 41 60.5 C40.8 69 42.4 79 45 88 " +
  "C46.2 92.5 46 97 44.4 100.5 C43.4 103 42.8 105.5 43 108 " +
  "C43.4 113 45.4 117.5 48.6 120.6 C51.4 123.2 55.4 125 60 125.6 " +
  "C64.6 125 68.6 123.2 71.4 120.6 C74.6 117.5 76.6 113 77 108 " +
  "C77.2 105.5 76.6 103 75.6 100.5 C74 97 73.8 92.5 75 88 " +
  "C77.6 79 79.2 69 79 60.5 C78.8 57.5 79 55 80 52 " +
  "C81.2 48.5 82.4 44.5 84 40.5 C83.6 38 82 36 79 34 " +
  "C75.4 31.6 71 29.8 67 28.6 C65 28 62.5 28.2 60 28.2 Z";

const ARM_L =
  "M41 35.5 C36 36.5 31.6 39.6 29.4 44.4 C27.8 48 27.2 52 27 56 " +
  "C26.6 63 26 71 25 78 C23.8 85 22.4 93 21.4 100 " +
  "C20.8 105 20.2 109.5 20 113 C18.6 116.5 18 120 18.8 122.8 " +
  "C19.8 125.4 22.6 125.8 24.4 123.8 C25.8 121.8 26.6 118.6 27.2 115.4 " +
  "C28.6 107 30 99 31.2 91 C32.4 83 33.4 76 34.2 69 " +
  "C34.8 63 35.6 57 36.6 52 C37.4 47.5 38.6 43 40.2 39.4 Z";

const LEG_L =
  "M43.2 108 C42.6 115 42.8 123 43.6 131 C44.4 140 45.6 150 47.4 159 " +
  "C48.2 164 48.6 169 48.4 173 C47.6 178 47.2 183 47.6 188 " +
  "C46.8 196 47.4 205 48.8 213 C49.8 219 50.6 224 51 228.5 " +
  "C51 232.5 50.4 236 49.4 239.5 C49.2 242.5 50.8 244.6 53.6 244.6 " +
  "C56.4 244.6 57.8 243 57.8 239.8 C57.8 236 57.4 232 57.2 228.5 " +
  "C57 221 57.4 212 57.8 204 C58.2 197 58 190 57.4 184 " +
  "C56.8 178 56.6 172.5 57 168 C57.6 161 58 152 58 144 " +
  "C58 137 58.2 131 58.6 126 C54 122 48 118 45 113 " +
  "C44 111.4 43.6 109.6 43.2 108 Z";

const BASE_PARTS = [NECK, TORSO, ARM_L, mirrorPath(ARM_L), LEG_L, mirrorPath(LEG_L)];

// — shared muscle shapes (left side) —
const DELT_L =
  "M40.6 35.4 C36.2 36.6 32.2 39.6 30 44 C28.6 47.2 28 51 28.2 54.4 " +
  "C30.4 55.6 33 55.2 35 53.6 C36.8 51.8 38 49.2 38.8 46.4 C39.6 42.8 40.4 39 40.6 35.4 Z";

const UPPER_ARM_L =
  "M36.4 54 C34.2 56.4 32.8 59.8 32 63.4 C31 68.4 30.6 73.6 31 78.4 " +
  "C31.6 81.4 33.4 82.6 35 80.8 C36.6 78.6 37.4 75 37.8 71 C38.2 65.4 38 59.4 36.4 54 Z";

const FOREARM_L =
  "M29.8 88 C28.2 92.6 26.8 98 25.8 103.4 C25.2 107 24.8 110.4 24.8 113 " +
  "C26.2 114.8 28 114.4 29 112.2 C30.2 107.6 31.2 102 32 96.4 " +
  "C32.4 93 32.4 90 31.6 87.6 C31 86.6 30.2 86.8 29.8 88 Z";

const CALF_L =
  "M48.8 182 C47.8 189 47.8 197.6 48.8 205.6 C49.6 211.6 50.8 217 52 220.6 " +
  "C53.6 223 55.4 222.4 56.4 219.2 C57.2 212.4 57.4 204 56.8 196 " +
  "C56.4 189.6 55.4 184 53.8 180 C51.8 177.8 49.8 178.4 48.8 182 Z";

interface MusclePath { group: Group; d: string }
const sym = (group: Group, d: string): MusclePath[] => [
  { group, d },
  { group, d: mirrorPath(d) },
];

// — front —
const PEC_L =
  "M59 36.4 L59 58 C55 61.4 49.4 61.8 45.4 59.4 C42.4 57.4 40.8 54 40.6 50.2 " +
  "C40.5 45.4 42.4 40.9 46 38.6 C50 36.6 54.6 36 59 36.4 Z";

const ABS =
  "M53 62 C57.6 60.8 62.4 60.8 67 62 L67 102 C65.8 107 63.4 110.4 60 110.4 " +
  "C56.6 110.4 54.2 107 53 102 Z";

const OBLIQUE_L =
  "M51.6 63.6 C49.4 64.8 47.6 66.8 46.4 69.6 C45 74.6 44.6 80.6 45.8 86.2 " +
  "C47 90.8 49.2 94.6 51.6 97 Z";

const QUAD_L =
  "M44.6 122 C43.8 130 44 139 45.2 147.4 C46.2 154.6 47.8 161 50 166.4 " +
  "C52.2 169 54.8 168.6 56.2 165.2 C57.4 158.2 57.8 149.4 57.6 141 " +
  "C57.4 132.8 56.4 125.8 54.2 120.6 C51 117.4 47.4 118.6 44.6 122 Z";

const SHIN_L =
  "M48.8 178 C47.8 186 47.8 196 48.8 205 C49.6 211.6 50.6 217.8 51.6 222 " +
  "C53.2 224 55 223.6 56 220.8 C56.8 214 57 205 56.6 196.6 " +
  "C56.2 189.4 55.2 182.6 53.6 177.6 C51.8 175.6 50 175.8 48.8 178 Z";

const FRONT_MUSCLES: MusclePath[] = [
  ...sym("Shoulders", DELT_L),
  ...sym("Chest", PEC_L),
  ...sym("Arms", UPPER_ARM_L),
  ...sym("Arms", FOREARM_L),
  { group: "Core", d: ABS },
  ...sym("Core", OBLIQUE_L),
  ...sym("Quads", QUAD_L),
  ...sym("Calves", SHIN_L),
];

// detail strokes that carve the muscles (ab rows, quad sweep)
const FRONT_DETAILS = [
  "M53.4 72 L66.6 72",
  "M53.4 82 L66.6 82",
  "M53.4 92 L66.6 92",
  "M60 61.5 L60 109",
  "M51.2 122 C50.8 135 51.2 150 52.6 163",
  mirrorPath("M51.2 122 C50.8 135 51.2 150 52.6 163"),
];

// — back —
const TRAPS =
  "M60 27 C56 27.6 51.6 28.6 48 30.4 C44 32.2 40.6 34.4 38.4 36.6 " +
  "C43.8 38.8 49.6 40.2 54.4 42.6 C57 44.4 58.8 47.4 59.4 51 " +
  "C59.8 57 60 64 60 70 C60 64 60.2 57 60.6 51 " +
  "C61.2 47.4 63 44.4 65.6 42.6 C70.4 40.2 76.2 38.8 81.6 36.6 " +
  "C79.4 34.4 76 32.2 72 30.4 C68.4 28.6 64 27.6 60 27 Z";

const LAT_L =
  "M41.6 54 C40.8 62 41.4 70 43.6 77.4 C45.4 83.4 48.4 88.6 52.6 92 " +
  "C55.4 94.2 58 93.4 58.8 90 L59 60 C56.4 58.6 53.6 57.6 51 56.4 " +
  "C47.8 55 44.6 54.2 41.6 54 Z";

const ERECTOR_L =
  "M55 94.5 C53.8 99.5 53.6 104.4 54.6 109 C56.2 111.4 58.2 112.2 59.4 110.6 " +
  "L59.4 95.8 C58 94.8 56.4 94.3 55 94.5 Z";

const GLUTE_L =
  "M46.4 110 C43.8 112.6 42.8 116.6 43.2 120.8 C43.6 125 45.4 128.6 48.6 130.4 " +
  "C52.4 132.2 56.6 131.4 58.8 128.2 C60 125.4 60 121.8 59.2 118.4 " +
  "C58 114.4 55.6 111.2 52.4 109.6 C50.4 108.8 48.2 108.8 46.4 110 Z";

const HAM_L =
  "M45.4 134 C44.6 142 45 151 46.4 159 C47.4 164.6 49 169.6 51 173.4 " +
  "C53.2 175.8 55.4 175 56.6 171.4 C57.6 164.6 57.8 156.4 57.2 148.6 " +
  "C56.8 143 55.8 138 54.2 134.2 C51.2 131.4 48 131.4 45.4 134 Z";

const BACK_MUSCLES: MusclePath[] = [
  { group: "Back", d: TRAPS },
  ...sym("Shoulders", DELT_L),
  ...sym("Back", LAT_L),
  ...sym("Back", ERECTOR_L),
  ...sym("Arms", UPPER_ARM_L),
  ...sym("Arms", FOREARM_L),
  ...sym("Glutes", GLUTE_L),
  ...sym("Hamstrings", HAM_L),
  ...sym("Calves", CALF_L),
];

const BACK_DETAILS = [
  "M51.4 134 C51 146 51.4 160 52.6 171",          // hamstring split
  mirrorPath("M51.4 134 C51 146 51.4 160 52.6 171"),
  "M52.8 182 C52.6 192 52.8 204 53.6 215",        // gastrocnemius heads
  mirrorPath("M52.8 182 C52.6 192 52.8 204 53.6 215"),
  "M60 97 L60 110.5",                              // spine through erectors
];

function heatColor(score: number, max: number): string {
  if (score <= 0 || max <= 0) return REST_FILL;
  // sqrt scaling keeps mid-volume muscles visibly lit
  const t = Math.sqrt(Math.min(1, score / max));
  return `rgba(170,251,5,${(0.16 + 0.84 * t).toFixed(2)})`;
}

function BodyFigure({
  side, heat, width = FIG_W, selected,
}: {
  side: "front" | "back";
  heat: Record<Group, string>;
  width?: number;
  selected?: Group | null;
}) {
  const muscles = side === "front" ? FRONT_MUSCLES : BACK_MUSCLES;
  const details = side === "front" ? FRONT_DETAILS : BACK_DETAILS;
  return (
    <Svg width={width} height={Math.round(width * (VB_H / VB_W))} viewBox={`0 0 ${VB_W} ${VB_H}`}>
      <Ellipse cx={60} cy={13.5} rx={9} ry={11} fill={BASE_FILL} />
      {BASE_PARTS.map((d, i) => (
        <Path key={`b${i}`} d={d} fill={BASE_FILL} />
      ))}
      {muscles.map((m, i) => (
        <Path
          key={`m${i}`}
          d={m.d}
          fill={heat[m.group]}
          stroke={selected === m.group ? "#D7FF69" : SEP}
          strokeWidth={selected === m.group ? 2.2 : 1.1}
        />
      ))}
      {details.map((d, i) => (
        <Path key={`d${i}`} d={d} stroke={SEP} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      ))}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [showAllMuscles, setShowAllMuscles] = useState(false);
  const [range, setRange] = useState<RangeKey>("week");
  const [figureSide, setFigureSide] = useState<"front" | "back">("front");
  const [selectedMuscle, setSelectedMuscle] = useState<Group | null>(null);

  const barAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const userId = await getUserIdFromToken();
          if (!userId) return;
          const all = await workoutDatabase.get<WorkoutLog>("workout_logs").query().fetch();
          if (active) setLogs(all.filter((l) => l.userId === userId));
        } catch {}
      })();
      return () => { active = false; };
    }, [])
  );

  const rangeConfig = RANGES.find((item) => item.key === range) ?? RANGES[0];
  const filteredLogs = useMemo(() => {
    if (!rangeConfig.days) return logs;
    const cutoff = startOfDay(new Date()).getTime() - (rangeConfig.days - 1) * DAY_MS;
    return logs.filter((log) => log.completedAt >= cutoff);
  }, [logs, rangeConfig.days]);

  const allTime = useMemo(() => aggregate(logs), [logs]);
  const a = useMemo(() => aggregate(filteredLogs), [filteredLogs]);

  // Bars animate when the selected range changes.
  useEffect(() => {
    barAnim.setValue(0);
    Animated.timing(barAnim, {
      toValue: 1, duration: 950, delay: 400,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [barAnim, filteredLogs.length, range]);

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
  const topMuscles = useMemo(
    () => split.filter((item) => GROUPS.includes(item.name as Group)).slice(0, 4),
    [split]
  );
  const focusedMuscle = selectedMuscle ?? a.mostTrained;
  const focusedSplit = split.find((item) => item.name === focusedMuscle);

  const averageMinutes = a.totalWorkouts > 0 ? Math.round(a.totalMinutes / a.totalWorkouts) : 0;

  // Balance includes untouched groups so neglected areas are not hidden.
  const balance = useMemo(() => {
    const scores = GROUPS.map((gr) => a.muscleScores[gr]);
    if (Math.max(...scores) <= 0) return null;
    return Math.round((Math.min(...scores) / Math.max(...scores)) * 100);
  }, [a]);

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

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <View>
          <Text style={s.headerTitle}>Performance</Text>
          <Text style={s.headerSub}>Your training story</Text>
        </View>
        <TouchableOpacity style={s.closeBtn} activeOpacity={0.8} onPress={() => router.back()}>
          <Ionicons name="close" size={21} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 60 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Range control ── */}
        <FadeTranslate order={0} direction="y" translateYFrom={16}>
          <View style={s.rangeControl}>
            {RANGES.map((item) => {
              const active = item.key === range;
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.85}
                  onPress={() => setRange(item.key)}
                  style={[s.rangeButton, active && s.rangeButtonActive]}
                >
                  <Text style={[s.rangeButtonText, active && s.rangeButtonTextActive]}>
                    {item.shortLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </FadeTranslate>

        {/* ── Primary metric ── */}
        <FadeTranslate order={0} delay={30} direction="y" translateYFrom={18}>
          <View style={s.hero}>
            <View style={s.heroLabelRow}>
              <View style={s.heroIcon}>
                <Ionicons name="pulse" size={14} color="#000" />
              </View>
              <Text style={s.heroLabel}>ACTIVE TRAINING · {rangeConfig.label.toUpperCase()}</Text>
            </View>
            <View style={s.heroValueRow}>
              <CountUp value={a.totalMinutes} style={s.heroValue} />
              <Text style={s.heroGoal}>minutes</Text>
            </View>
            <View style={s.heroMetaRow}>
              <View style={s.heroMetaPill}>
                <Ionicons name="barbell-outline" size={13} color={D.primary} />
                <Text style={s.heroMetaValue}>{a.totalWorkouts}</Text>
                <Text style={s.heroMetaLabel}>sessions</Text>
              </View>
              <View style={s.heroMetaPill}>
                <Ionicons name="flame-outline" size={13} color="#FF795C" />
                <Text style={[s.heroMetaValue, { color: "#FF795C" }]}>{fmtThousand(a.totalKcal)}</Text>
                <Text style={s.heroMetaLabel}>kcal</Text>
              </View>
              <View style={s.livePill}>
                <View style={s.liveDot} />
                <Text style={s.liveText}>{a.lastWorkoutAt ? agoStr(a.lastWorkoutAt) : "No sessions"}</Text>
              </View>
            </View>
          </View>
        </FadeTranslate>

        {/* ── Editorial signal deck ── */}
        <FadeTranslate order={0} delay={70} direction="y" translateYFrom={14}>
          <View style={s.signalDeck}>
            <LinearGradient
              colors={["#D4FF62", "#9FE900"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.streakFeature}
            >
              <View style={s.featureTop}>
                <View style={s.featureIcon}>
                  <Ionicons name="flame" size={17} color="#000" />
                </View>
                <Text style={s.featureIndex}>01</Text>
              </View>
              <View>
                <Text style={s.featureValue}>{allTime.streak}</Text>
                <Text style={s.featureTitle}>day streak</Text>
                <Text style={s.featureSub}>Personal best · {allTime.bestStreak} days</Text>
              </View>
            </LinearGradient>
            <View style={s.signalStack}>
              <LinearGradient colors={["#232329", "#151518"]} style={s.signalCard}>
                <View style={s.signalCardTop}>
                  <Text style={s.eyebrow}>AVG SESSION</Text>
                  <Ionicons name="timer-outline" size={15} color="#8ABEFF" />
                </View>
                <Text style={s.signalValue}>{averageMinutes}<Text style={s.signalUnit}> min</Text></Text>
              </LinearGradient>
              <LinearGradient colors={["#211D20", "#151518"]} style={s.signalCard}>
                <View style={s.signalCardTop}>
                  <Text style={s.eyebrow}>MUSCLE BALANCE</Text>
                  <Ionicons name="analytics-outline" size={15} color="#FF9A77" />
                </View>
                <Text style={s.signalValue}>{balance !== null ? balance : "—"}<Text style={s.signalUnit}>%</Text></Text>
              </LinearGradient>
            </View>
          </View>
        </FadeTranslate>

        {/* ── Consistency dots ── */}
        <FadeTranslate order={0} delay={90} direction="y" translateYFrom={16}>
          <LinearGradient colors={["#161619", "#101012"]} style={s.card}>
            <View style={s.cardHeaderRow}>
              <View>
                <Text style={s.eyebrow}>CONSISTENCY</Text>
                <Text style={s.cardTitle}>Last 12 weeks</Text>
              </View>
              <Text style={s.cardHeaderValue}>
                {allTime.trainedDays}<Text style={s.cardHeaderDim}> / {GRID_WEEKS * 7} days</Text>
              </Text>
            </View>
            <View style={{ marginTop: 18 }}>
              <ConsistencyGrid byDay={allTime.byDay} gridStart={allTime.gridStart} animKey={logs.length} />
            </View>
          </LinearGradient>
        </FadeTranslate>

        {/* ── Muscle focus centerpiece ── */}
        <FadeTranslate order={0} delay={230} direction="y" translateYFrom={16}>
          <LinearGradient
            colors={["#1B2511", "#12150F", "#101011"]}
            locations={[0, 0.44, 1]}
            style={[s.card, s.heatmapCard]}
          >
            <View style={s.cardHeaderRow}>
              <View>
                <Text style={s.eyebrow}>MUSCLE FOCUS</Text>
                <Text style={s.heatmapTitle}>Your training map</Text>
              </View>
              <View style={s.figureToggle}>
                {(["front", "back"] as const).map((side) => {
                  const active = figureSide === side;
                  return (
                    <TouchableOpacity
                      key={side}
                      activeOpacity={0.85}
                      onPress={() => setFigureSide(side)}
                      style={[s.figureToggleButton, active && s.figureToggleButtonActive]}
                    >
                      <Text style={[s.figureToggleText, active && s.figureToggleTextActive]}>
                        {side === "front" ? "Front" : "Back"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.muscleChips}
            >
              {topMuscles.map((item) => {
                const active = focusedMuscle === item.name;
                return (
                  <TouchableOpacity
                    key={item.name}
                    activeOpacity={0.85}
                    onPress={() => setSelectedMuscle(item.name as Group)}
                    style={[s.muscleChip, active && s.muscleChipActive]}
                  >
                    <View style={[s.muscleChipDot, active && s.muscleChipDotActive]} />
                    <Text style={[s.muscleChipText, active && s.muscleChipTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={s.figureStage}>
              <Text style={s.figureGhost}>FOCUS</Text>
              <BodyFigure side={figureSide} heat={heat} width={178} selected={focusedMuscle} />
              <View style={s.focusReadout}>
                <View>
                  <Text style={s.focusReadoutLabel}>SELECTED GROUP</Text>
                  <Text style={s.focusReadoutTitle}>{focusedMuscle ?? "No data yet"}</Text>
                </View>
                <View style={s.focusPctWrap}>
                  <Text style={s.focusPct}>{focusedSplit?.pct ?? 0}%</Text>
                  <Text style={s.focusPctLabel}>of sessions</Text>
                </View>
              </View>
            </View>

            <View style={s.heatStatsRow}>
              <View style={s.heatStatCol}>
                <Text style={s.heatStatLabel}>MOST TRAINED</Text>
                <View style={s.heatStatValueRow}>
                  <View style={[s.heatStatDot, { backgroundColor: D.primary }]} />
                  <Text style={s.heatStatValue}>{a.mostTrained ?? "—"}</Text>
                </View>
              </View>
              <View style={s.heatStatDivider} />
              <View style={s.heatStatCol}>
                <Text style={s.heatStatLabel}>LEAST TRAINED</Text>
                <View style={s.heatStatValueRow}>
                  <View style={[s.heatStatDot, { backgroundColor: "rgba(255,255,255,0.28)" }]} />
                  <Text style={s.heatStatValue}>{a.leastTrained ?? "—"}</Text>
                </View>
              </View>
              <View style={s.heatStatDivider} />
              <View style={s.heatStatCol}>
                <Text style={s.heatStatLabel}>BALANCE</Text>
                <View style={s.heatStatValueRow}>
                  <Text style={s.heatStatValue}>{balance !== null ? `${balance}%` : "—"}</Text>
                </View>
              </View>
            </View>

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

        {/* ── Training split ── */}
        <FadeTranslate order={0} delay={300} direction="y" translateYFrom={16}>
          <LinearGradient colors={["#17171A", "#101012"]} style={s.card}>
            <View style={s.cardHeaderRow}>
              <View>
                <Text style={s.eyebrow}>TRAINING SPLIT</Text>
                <Text style={s.cardTitle}>Session distribution</Text>
              </View>
              <View style={s.rangeBadge}>
                <Text style={s.rangeBadgeText}>{rangeConfig.shortLabel}</Text>
              </View>
            </View>
            <View style={{ gap: 15, marginTop: 22 }}>
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
                        backgroundColor: D.primary,
                        borderRadius: 3,
                      }}
                    />
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
          </LinearGradient>
        </FadeTranslate>

        {/* ── Personal bests ── */}
        <FadeTranslate order={0} delay={420} direction="y" translateYFrom={16}>
          <LinearGradient colors={["#1D1913", "#111112"]} style={s.card}>
            <View style={s.cardHeaderRow}>
              <View>
                <Text style={s.eyebrow}>PERSONAL BESTS</Text>
                <Text style={s.cardTitle}>Your high marks</Text>
              </View>
              <View style={s.trophyIcon}>
                <Ionicons name="trophy" size={16} color="#FFCC66" />
              </View>
            </View>
            <View style={{ gap: 0, marginTop: 12 }}>
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
              <View style={s.bestDivider} />
              <View style={s.bestRow}>
                <View style={s.bestIconWrap}>
                  <Ionicons name="flame-outline" size={15} color={D.primary} />
                </View>
                <Text style={[s.bestLabel, { flex: 1 }]}>Biggest burn</Text>
                <Text style={s.bestValue}>{a.bestBurn} kcal</Text>
              </View>
              <View style={s.bestDivider} />
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
          </LinearGradient>
        </FadeTranslate>

        {/* ── Insight ── */}
        <FadeTranslate order={0} delay={480} direction="y" translateYFrom={14}>
          <LinearGradient colors={["#263911", "#151A10"]} style={s.insightBanner}>
            <View style={s.insightIcon}>
              <Ionicons name="sparkles" size={15} color="#000" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.insightLabel}>COACHING SIGNAL</Text>
              <Text style={s.insightText}>{insight}</Text>
            </View>
          </LinearGradient>
        </FadeTranslate>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: D.bg },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: H_PAD, paddingBottom: 16,
  },
  headerTitle: {
    color: D.text, fontFamily: theme.bold, fontSize: 27, letterSpacing: -0.8,
  },
  headerSub: {
    color: "rgba(255,255,255,0.38)", fontFamily: theme.medium,
    fontSize: 11.5, marginTop: 2,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#161618",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    justifyContent: "center", alignItems: "center",
  },

  eyebrow: {
    color: "rgba(255,255,255,0.38)", fontFamily: theme.medium,
    fontSize: 10.5, letterSpacing: 1.3,
  },

  // Primary metric
  hero: {
    paddingHorizontal: H_PAD, paddingTop: 29, paddingBottom: 28,
  },
  heroLabelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroIcon: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: "center", justifyContent: "center", backgroundColor: D.primary,
    shadowColor: D.primary, shadowOpacity: 0.42, shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  heroLabel: {
    color: "rgba(255,255,255,0.62)", fontFamily: theme.bold,
    fontSize: 10, letterSpacing: 1.25,
  },
  livePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 999, paddingHorizontal: 3, height: 27,
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: D.primary },
  liveText: { color: "rgba(255,255,255,0.55)", fontFamily: theme.medium, fontSize: 9.5 },
  heroValueRow: {
    flexDirection: "row", alignItems: "baseline", marginTop: 18, marginBottom: 13,
  },
  heroValue: {
    color: D.text, fontFamily: theme.bold, fontSize: 78, letterSpacing: -5, ...NUM,
  },
  heroGoal: {
    color: "rgba(255,255,255,0.30)", fontFamily: theme.medium,
    fontSize: 18, letterSpacing: -0.5, marginLeft: 7,
  },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  heroMetaPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, height: 27, borderRadius: 8, backgroundColor: "#111A09",
  },
  heroMetaValue: { color: D.primary, fontFamily: theme.bold, fontSize: 10.5, ...NUM },
  heroMetaLabel: { color: "rgba(255,255,255,0.36)", fontFamily: theme.medium, fontSize: 9.5 },
  rangeControl: {
    flexDirection: "row", gap: 5, padding: 4,
    backgroundColor: "#161618", borderRadius: 999,
    marginHorizontal: H_PAD,
  },
  rangeButton: {
    flex: 1, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center",
  },
  rangeButtonActive: { backgroundColor: "#fff" },
  rangeButtonText: {
    color: "rgba(255,255,255,0.46)", fontFamily: theme.bold, fontSize: 11.5,
  },
  rangeButtonTextActive: { color: "#000" },

  // Editorial signal deck
  signalDeck: {
    flexDirection: "row", gap: 10, paddingHorizontal: H_PAD, marginBottom: 12,
  },
  streakFeature: {
    flex: 1.12, minHeight: 190, borderRadius: 26, padding: 17,
    justifyContent: "space-between", overflow: "hidden",
  },
  featureTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  featureIcon: {
    width: 34, height: 34, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.45)", alignItems: "center", justifyContent: "center",
  },
  featureIndex: { color: "rgba(0,0,0,0.3)", fontFamily: theme.bold, fontSize: 10, letterSpacing: 1.2 },
  featureValue: { color: "#000", fontFamily: theme.bold, fontSize: 64, letterSpacing: -4, ...NUM },
  featureTitle: { color: "#000", fontFamily: theme.bold, fontSize: 18, letterSpacing: -0.6, marginTop: -7 },
  featureSub: { color: "rgba(0,0,0,0.48)", fontFamily: theme.medium, fontSize: 9.5, marginTop: 5 },
  signalStack: { flex: 0.88, gap: 10 },
  signalCard: {
    flex: 1, borderRadius: 22, padding: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.055)",
    justifyContent: "space-between",
  },
  signalCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  signalValue: { color: "#fff", fontFamily: theme.bold, fontSize: 30, letterSpacing: -1.5, ...NUM },
  signalUnit: { color: "rgba(255,255,255,0.34)", fontFamily: theme.medium, fontSize: 12 },

  // Generic card
  card: {
    marginHorizontal: H_PAD, marginBottom: 10,
    backgroundColor: D.card,
    borderWidth: 1, borderColor: D.border,
    borderRadius: 22, padding: CARD_PAD,
  },
  cardHeaderRow: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between",
  },
  cardHeaderValue: { color: D.text, fontFamily: theme.bold, fontSize: 14, ...NUM },
  cardHeaderDim: { color: D.sub, fontFamily: theme.medium, fontSize: 12 },
  cardTitle: { color: "#fff", fontFamily: theme.bold, fontSize: 18, letterSpacing: -0.5, marginTop: 5 },

  // Heatmap
  heatmapCard: {
    paddingTop: 20, borderColor: "rgba(170,251,5,0.12)", borderRadius: 28,
  },
  heatmapTitle: {
    color: D.text, fontFamily: theme.bold, fontSize: 21,
    letterSpacing: -0.6, marginTop: 5,
  },
  rangeBadge: {
    backgroundColor: "rgba(170,251,5,0.10)",
    borderWidth: 1, borderColor: "rgba(170,251,5,0.14)",
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
  },
  rangeBadgeText: { color: D.primary, fontFamily: theme.bold, fontSize: 10 },
  figureToggle: {
    flexDirection: "row", gap: 3, padding: 3, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.045)",
  },
  figureToggleButton: {
    minWidth: 52, height: 29, borderRadius: 999,
    alignItems: "center", justifyContent: "center",
  },
  figureToggleButtonActive: { backgroundColor: D.primary },
  figureToggleText: {
    color: "rgba(255,255,255,0.42)", fontFamily: theme.bold, fontSize: 11.5,
  },
  figureToggleTextActive: { color: "#000" },
  muscleChips: { gap: 7, paddingTop: 17, paddingBottom: 3 },
  muscleChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 999, paddingHorizontal: 11, height: 30,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.05)",
  },
  muscleChipActive: { backgroundColor: "#fff", borderColor: "#fff" },
  muscleChipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.2)" },
  muscleChipDotActive: { backgroundColor: D.primary },
  muscleChipText: { color: "rgba(255,255,255,0.52)", fontFamily: theme.bold, fontSize: 10.5 },
  muscleChipTextActive: { color: "#000" },
  figureStage: {
    minHeight: 420, marginTop: 10, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.17)",
    borderWidth: 1, borderColor: "rgba(170,251,5,0.07)",
    overflow: "hidden",
  },
  figureGhost: {
    position: "absolute", top: 48,
    color: "rgba(170,251,5,0.035)", fontFamily: theme.black,
    fontSize: 62, letterSpacing: -3,
  },
  focusReadout: {
    position: "absolute", left: 12, right: 12, bottom: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  focusReadoutLabel: { color: D.primary, fontFamily: theme.bold, fontSize: 8.5, letterSpacing: 1.1 },
  focusReadoutTitle: { color: "#fff", fontFamily: theme.bold, fontSize: 17, marginTop: 3 },
  focusPctWrap: { alignItems: "flex-end" },
  focusPct: { color: "#fff", fontFamily: theme.bold, fontSize: 22, letterSpacing: -0.8, ...NUM },
  focusPctLabel: { color: D.sub, fontFamily: theme.medium, fontSize: 8.5 },
  heatStatsRow: {
    flexDirection: "row", alignItems: "center",
    marginTop: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)",
  },
  heatStatCol: { flex: 1, gap: 6 },
  heatStatDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.06)", marginHorizontal: 12 },
  heatStatLabel: {
    color: "rgba(255,255,255,0.32)", fontFamily: theme.medium,
    fontSize: 9.5, letterSpacing: 0.9,
  },
  heatStatValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  heatStatDot: { width: 7, height: 7, borderRadius: 3.5 },
  heatStatValue: { color: D.text, fontFamily: theme.bold, fontSize: 14, letterSpacing: -0.2, ...NUM },

  legendRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18 },
  legendBar: { flex: 1, height: 5, borderRadius: 2.5 },
  legendText: { color: "rgba(255,255,255,0.32)", fontFamily: theme.medium, fontSize: 10.5 },

  // Training split
  splitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  splitName: { width: 88, color: "rgba(255,255,255,0.72)", fontFamily: theme.medium, fontSize: 13 },
  splitBarTrack: {
    flex: 1, height: 8, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.055)",
    overflow: "hidden",
  },
  splitPct: {
    width: 40, textAlign: "right",
    color: D.text, fontFamily: theme.bold, fontSize: 12.5, ...NUM,
  },
  showAllBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, marginTop: 16,
  },
  showAllText: { color: D.sub, fontFamily: theme.medium, fontSize: 12.5 },

  // Personal bests
  bestRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  bestDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.04)", marginLeft: 46 },
  bestIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center", alignItems: "center",
  },
  bestLabel: { color: "rgba(255,255,255,0.78)", fontFamily: theme.medium, fontSize: 13.5 },
  bestMeta: { color: D.sub, fontFamily: theme.medium, fontSize: 11, marginTop: 1 },
  bestValue: { color: D.text, fontFamily: theme.bold, fontSize: 13.5, ...NUM },
  trophyIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,204,102,0.10)",
    borderWidth: 1, borderColor: "rgba(255,204,102,0.13)",
  },

  // Insight
  insightBanner: {
    flexDirection: "row", alignItems: "center", gap: 14,
    marginHorizontal: H_PAD,
    borderWidth: 1, borderColor: "rgba(170,251,5,0.14)",
    borderRadius: 22, paddingHorizontal: 16, paddingVertical: 16,
  },
  insightIcon: {
    width: 38, height: 38, borderRadius: 13,
    backgroundColor: D.primary, alignItems: "center", justifyContent: "center",
  },
  insightLabel: { color: D.primary, fontFamily: theme.bold, fontSize: 8.5, letterSpacing: 1.1, marginBottom: 4 },
  insightText: {
    color: "rgba(255,255,255,0.84)",
    fontFamily: theme.medium, fontSize: 13, lineHeight: 19,
  },
});
