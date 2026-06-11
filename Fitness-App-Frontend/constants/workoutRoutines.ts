// ─── Workout Routines Configuration ──────────────────────────────────────────
// Each routine has a list of exercises from the ExerciseDB API.
// gradient is used for the card background until real images are added.

export interface RoutineExercise {
  name: string;
  exerciseId: string;
  sets: number;
  reps: string;
  restSeconds: number;
  category: string;
  gifUrl: string | null;
  description?: string;
  durationSeconds?: number;   // per-set timer countdown (seconds)
  expectedCalories?: number;  // kcal burned per set
}

export interface WorkoutAthlete {
  name: string;
  title: string;
}

export interface WorkoutRoutine {
  id: string;
  name: string;
  emoji: string;
  description: string;
  duration: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  targetMuscles: string[];
  equipment: string[];
  gradient: [string, string];
  image?: string;
  completions?: number;
  athlete?: WorkoutAthlete;
  exercises: RoutineExercise[];
}

// ─── Routines ────────────────────────────────────────────────────────────────

export const ROUTINES: WorkoutRoutine[] = [
  // ── 1. Living Room Burner ─────────────────────────────────────────────────
  {
    id: "home_sweat",
    name: "Living Room Burner",
    emoji: "🏠",
    description: "No equipment, full body calorie crusher from your living room.",
    duration: "30 min",
    difficulty: "Intermediate",
    targetMuscles: ["Full Body", "Cardio"],
    equipment: ["Body weight"],
    gradient: ["#FF6B35", "#C62368"],
    image: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=900&q=80",
    completions: 12100,
    athlete: { name: "Chris Heria", title: "Calisthenics World Champion" },
    exercises: [
      { name: "Jumping Jacks", exerciseId: "f9lVSSI", sets: 3, reps: "40", restSeconds: 30, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/f9lVSSI.gif", durationSeconds: 50, expectedCalories: 10 },
      { name: "High Knees", exerciseId: "ealLwvX", sets: 3, reps: "30 sec", restSeconds: 30, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/ealLwvX.gif", durationSeconds: 35, expectedCalories: 12 },
      { name: "Burpees", exerciseId: "dK9394r", sets: 4, reps: "12", restSeconds: 45, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/dK9394r.gif", durationSeconds: 55, expectedCalories: 16 },
      { name: "Mountain Climbers", exerciseId: "RJgzwny", sets: 3, reps: "20 each", restSeconds: 30, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/RJgzwny.gif", durationSeconds: 40, expectedCalories: 12 },
      { name: "Close-Grip Push-Ups", exerciseId: "x6KpKpq", sets: 3, reps: "12", restSeconds: 45, category: "Chest", gifUrl: "https://static.exercisedb.dev/media/x6KpKpq.gif", durationSeconds: 40, expectedCalories: 8 },
      { name: "Walking Lunges", exerciseId: "IZVHb27", sets: 3, reps: "12 each leg", restSeconds: 45, category: "Legs", gifUrl: "https://static.exercisedb.dev/media/IZVHb27.gif", durationSeconds: 50, expectedCalories: 10 },
      { name: "Tuck Crunches", exerciseId: "BMMolZ3", sets: 3, reps: "15", restSeconds: 30, category: "Abs", gifUrl: "https://static.exercisedb.dev/media/BMMolZ3.gif", durationSeconds: 40, expectedCalories: 6 },
      { name: "Plank", exerciseId: "VBAWRPG", sets: 3, reps: "45 sec", restSeconds: 45, category: "Abs", gifUrl: "https://static.exercisedb.dev/media/VBAWRPG.gif", durationSeconds: 50, expectedCalories: 7 },
    ],
  },

  // ── 2. 30-Day Core Shred ──────────────────────────────────────────────────
  {
    id: "core_30day",
    name: "30-Day Core Shred",
    emoji: "🧊",
    description: "The ultimate ab routine for a shredded core and defined obliques.",
    duration: "20 min",
    difficulty: "Advanced",
    targetMuscles: ["Abs", "Obliques"],
    equipment: ["Gym mat", "Body weight"],
    gradient: ["#0093E9", "#80D0C7"],
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=80",
    completions: 8400,
    athlete: { name: "Jeff Cavaliere", title: "Physical Therapist & Strength Coach" },
    exercises: [
      { name: "Crunches", exerciseId: "TFqbd8t", sets: 4, reps: "20", restSeconds: 30, category: "Abs", gifUrl: "https://static.exercisedb.dev/media/TFqbd8t.gif", durationSeconds: 45, expectedCalories: 7 },
      { name: "Bicycle Crunches", exerciseId: "tZkGYZ9", sets: 4, reps: "15 each side", restSeconds: 30, category: "Obliques", gifUrl: "https://static.exercisedb.dev/media/tZkGYZ9.gif", durationSeconds: 45, expectedCalories: 8 },
      { name: "Leg Raises", exerciseId: "I3tsCnC", sets: 3, reps: "15", restSeconds: 40, category: "Abs", gifUrl: "https://static.exercisedb.dev/media/I3tsCnC.gif", durationSeconds: 50, expectedCalories: 8 },
      { name: "Flutter Kicks", exerciseId: "UVo2Qs2", sets: 3, reps: "25 each leg", restSeconds: 30, category: "Abs", gifUrl: "https://static.exercisedb.dev/media/UVo2Qs2.gif", durationSeconds: 40, expectedCalories: 6 },
      { name: "Mountain Climbers", exerciseId: "RJgzwny", sets: 3, reps: "30 sec", restSeconds: 30, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/RJgzwny.gif", durationSeconds: 35, expectedCalories: 10 },
      { name: "Tuck Crunches", exerciseId: "BMMolZ3", sets: 3, reps: "15", restSeconds: 30, category: "Abs", gifUrl: "https://static.exercisedb.dev/media/BMMolZ3.gif", durationSeconds: 40, expectedCalories: 6 },
      { name: "Glute Bridge March", exerciseId: "GibBPPg", sets: 3, reps: "12 each leg", restSeconds: 40, category: "Core", gifUrl: "https://static.exercisedb.dev/media/GibBPPg.gif", durationSeconds: 50, expectedCalories: 7 },
      { name: "Plank", exerciseId: "VBAWRPG", sets: 3, reps: "60 sec", restSeconds: 45, category: "Abs", gifUrl: "https://static.exercisedb.dev/media/VBAWRPG.gif", durationSeconds: 65, expectedCalories: 9 },
    ],
  },

  // ── 3. Morning Wake-Up Call ───────────────────────────────────────────────
  {
    id: "home_morning",
    name: "Morning Wake-Up Call",
    emoji: "🌅",
    description: "Quick 12-minute circuit to get your blood flowing and start the day right.",
    duration: "12 min",
    difficulty: "Beginner",
    targetMuscles: ["Full Body"],
    equipment: ["Body weight"],
    gradient: ["#FFD200", "#F7971E"],
    image: "https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&w=900&q=80",
    completions: 15300,
    athlete: { name: "David Goggins", title: "Navy SEAL & Ultra-Endurance Athlete" },
    exercises: [
      { name: "Jumping Jacks", exerciseId: "f9lVSSI", sets: 2, reps: "30", restSeconds: 30, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/f9lVSSI.gif", durationSeconds: 40, expectedCalories: 7 },
      { name: "High Knees", exerciseId: "ealLwvX", sets: 2, reps: "30 sec", restSeconds: 30, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/ealLwvX.gif", durationSeconds: 35, expectedCalories: 8 },
      { name: "Mountain Climbers", exerciseId: "RJgzwny", sets: 2, reps: "20", restSeconds: 30, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/RJgzwny.gif", durationSeconds: 35, expectedCalories: 8 },
      { name: "Walking Lunges", exerciseId: "IZVHb27", sets: 2, reps: "10 each leg", restSeconds: 30, category: "Legs", gifUrl: "https://static.exercisedb.dev/media/IZVHb27.gif", durationSeconds: 45, expectedCalories: 7 },
      { name: "Close-Grip Push-Ups", exerciseId: "x6KpKpq", sets: 2, reps: "10", restSeconds: 40, category: "Chest", gifUrl: "https://static.exercisedb.dev/media/x6KpKpq.gif", durationSeconds: 35, expectedCalories: 5 },
      { name: "Tuck Crunches", exerciseId: "BMMolZ3", sets: 2, reps: "15", restSeconds: 30, category: "Abs", gifUrl: "https://static.exercisedb.dev/media/BMMolZ3.gif", durationSeconds: 35, expectedCalories: 5 },
    ],
  },

  // ── 4. Apartment Leg Day ──────────────────────────────────────────────────
  {
    id: "apartment_legs",
    name: "Apartment Leg Day",
    emoji: "🦵",
    description: "Quiet, neighbor-friendly leg routine that still brings the burn.",
    duration: "25 min",
    difficulty: "Beginner",
    targetMuscles: ["Quads", "Glutes", "Calves"],
    equipment: ["Body weight"],
    gradient: ["#FA8BFF", "#2BD2FF"],
    image: "https://images.unsplash.com/photo-1434608519344-49d77a699e1d?auto=format&fit=crop&w=900&q=80",
    completions: 5200,
    athlete: { name: "Kayla Itsines", title: "Fitness Entrepreneur & BBG Creator" },
    exercises: [
      { name: "Jumping Jacks (Warm-Up)", exerciseId: "f9lVSSI", sets: 2, reps: "30", restSeconds: 20, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/f9lVSSI.gif", durationSeconds: 40, expectedCalories: 6 },
      { name: "Walking Lunges", exerciseId: "IZVHb27", sets: 4, reps: "12 each leg", restSeconds: 45, category: "Legs", gifUrl: "https://static.exercisedb.dev/media/IZVHb27.gif", durationSeconds: 55, expectedCalories: 10 },
      { name: "Curtsey Squat", exerciseId: "gUjqdei", sets: 3, reps: "12 each leg", restSeconds: 45, category: "Quads", gifUrl: "https://static.exercisedb.dev/media/gUjqdei.gif", durationSeconds: 50, expectedCalories: 9 },
      { name: "Glute Bridge March", exerciseId: "GibBPPg", sets: 3, reps: "15 each leg", restSeconds: 45, category: "Glutes", gifUrl: "https://static.exercisedb.dev/media/GibBPPg.gif", durationSeconds: 55, expectedCalories: 8 },
      { name: "Standing Calf Raises", exerciseId: "8ozhUIZ", sets: 4, reps: "20", restSeconds: 30, category: "Calves", gifUrl: "https://static.exercisedb.dev/media/8ozhUIZ.gif", durationSeconds: 40, expectedCalories: 5 },
      { name: "High Knees (Finisher)", exerciseId: "ealLwvX", sets: 3, reps: "30 sec", restSeconds: 30, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/ealLwvX.gif", durationSeconds: 35, expectedCalories: 10 },
      { name: "Plank", exerciseId: "VBAWRPG", sets: 3, reps: "45 sec", restSeconds: 40, category: "Core", gifUrl: "https://static.exercisedb.dev/media/VBAWRPG.gif", durationSeconds: 50, expectedCalories: 7 },
    ],
  },

  // ── 5. Home Dumbbell Pump ─────────────────────────────────────────────────
  {
    id: "home_dumbbells",
    name: "Home Dumbbell Pump",
    emoji: "🏋️",
    description: "Just a pair of dumbbells needed for this upper body pump.",
    duration: "40 min",
    difficulty: "Intermediate",
    targetMuscles: ["Shoulders", "Chest", "Arms"],
    equipment: ["Dumbbell"],
    gradient: ["#4158D0", "#C850C0"],
    image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80",
    completions: 9800,
    athlete: { name: "Arnold Schwarzenegger", title: "7× Mr. Olympia Champion" },
    exercises: [
      { name: "Incline Dumbbell Press", exerciseId: "ns0SIbU", sets: 4, reps: "10-12", restSeconds: 60, category: "Chest", gifUrl: "https://static.exercisedb.dev/media/ns0SIbU.gif", durationSeconds: 45, expectedCalories: 11 },
      { name: "Dumbbell Shoulder Press", exerciseId: "A6wtbuL", sets: 4, reps: "10", restSeconds: 60, category: "Shoulders", gifUrl: "https://static.exercisedb.dev/media/A6wtbuL.gif", durationSeconds: 45, expectedCalories: 11 },
      { name: "Lateral Raises", exerciseId: "DsgkuIt", sets: 3, reps: "15", restSeconds: 45, category: "Shoulders", gifUrl: "https://static.exercisedb.dev/media/DsgkuIt.gif", durationSeconds: 40, expectedCalories: 6 },
      { name: "Hammer Curls", exerciseId: "slDvUAU", sets: 3, reps: "12 each", restSeconds: 45, category: "Biceps", gifUrl: "https://static.exercisedb.dev/media/slDvUAU.gif", durationSeconds: 40, expectedCalories: 7 },
      { name: "Dumbbell Pullover", exerciseId: "FSD6PGL", sets: 3, reps: "12", restSeconds: 60, category: "Chest", gifUrl: "https://static.exercisedb.dev/media/FSD6PGL.gif", durationSeconds: 45, expectedCalories: 9 },
      { name: "Kneeling Triceps Extension", exerciseId: "s0HKO2I", sets: 3, reps: "12-15", restSeconds: 45, category: "Triceps", gifUrl: "https://static.exercisedb.dev/media/s0HKO2I.gif", durationSeconds: 40, expectedCalories: 7 },
      { name: "Close-Grip Push-Ups (Burnout)", exerciseId: "x6KpKpq", sets: 3, reps: "Max reps", restSeconds: 60, category: "Chest", gifUrl: "https://static.exercisedb.dev/media/x6KpKpq.gif", durationSeconds: 45, expectedCalories: 9 },
    ],
  },

  // ── 6. Full Body Gym Starter ──────────────────────────────────────────────
  {
    id: "full_body_gym",
    name: "Full Body Gym Starter",
    emoji: "🦍",
    description: "Hit all major muscle groups with gym equipment. Perfect for beginners entering the gym.",
    duration: "50 min",
    difficulty: "Beginner",
    targetMuscles: ["Full Body"],
    equipment: ["Barbell", "Dumbbell", "Bench"],
    gradient: ["#FF416C", "#FF4B2B"],
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=900&q=80",
    completions: 21000,
    athlete: { name: "Cristiano Ronaldo", title: "5× Ballon d'Or Winner" },
    exercises: [
      { name: "Barbell Bench Press", exerciseId: "EIeI8Vf", sets: 4, reps: "8-10", restSeconds: 90, category: "Chest", gifUrl: "https://static.exercisedb.dev/media/EIeI8Vf.gif", durationSeconds: 50, expectedCalories: 12 },
      { name: "Dumbbell Deadlift", exerciseId: "nUwVh7b", sets: 4, reps: "10", restSeconds: 90, category: "Back", gifUrl: "https://static.exercisedb.dev/media/nUwVh7b.gif", durationSeconds: 55, expectedCalories: 14 },
      { name: "Incline Dumbbell Press", exerciseId: "ns0SIbU", sets: 3, reps: "10-12", restSeconds: 75, category: "Chest", gifUrl: "https://static.exercisedb.dev/media/ns0SIbU.gif", durationSeconds: 45, expectedCalories: 11 },
      { name: "Dumbbell Shoulder Press", exerciseId: "A6wtbuL", sets: 3, reps: "10-12", restSeconds: 75, category: "Shoulders", gifUrl: "https://static.exercisedb.dev/media/A6wtbuL.gif", durationSeconds: 45, expectedCalories: 10 },
      { name: "Walking Lunges", exerciseId: "IZVHb27", sets: 3, reps: "12 each leg", restSeconds: 60, category: "Legs", gifUrl: "https://static.exercisedb.dev/media/IZVHb27.gif", durationSeconds: 55, expectedCalories: 10 },
      { name: "Lateral Raises", exerciseId: "DsgkuIt", sets: 3, reps: "15", restSeconds: 45, category: "Shoulders", gifUrl: "https://static.exercisedb.dev/media/DsgkuIt.gif", durationSeconds: 40, expectedCalories: 6 },
      { name: "Hammer Curls", exerciseId: "slDvUAU", sets: 3, reps: "12 each", restSeconds: 45, category: "Biceps", gifUrl: "https://static.exercisedb.dev/media/slDvUAU.gif", durationSeconds: 40, expectedCalories: 7 },
      { name: "Kneeling Triceps Extension", exerciseId: "s0HKO2I", sets: 3, reps: "12-15", restSeconds: 45, category: "Triceps", gifUrl: "https://static.exercisedb.dev/media/s0HKO2I.gif", durationSeconds: 40, expectedCalories: 7 },
    ],
  },

  // ── 7. Cardio Mix ─────────────────────────────────────────────────────────
  {
    id: "cardio_mix",
    name: "Cardio Mix",
    emoji: "🫀",
    description: "Get your heart rate up with a mix of gym cardio machines and bodyweight bursts.",
    duration: "35 min",
    difficulty: "Beginner",
    targetMuscles: ["Cardio"],
    equipment: ["Cardio Machine", "Body weight"],
    gradient: ["#00B4DB", "#0083B0"],
    image: "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=900&q=80",
    completions: 7600,
    athlete: { name: "Joe Wicks", title: "The Body Coach — HIIT Pioneer" },
    exercises: [
      { name: "Incline Treadmill", exerciseId: "rjiM4L3", sets: 1, reps: "10 min", restSeconds: 60, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/rjiM4L3.gif", durationSeconds: 600, expectedCalories: 90 },
      { name: "Jumping Jacks", exerciseId: "f9lVSSI", sets: 3, reps: "40", restSeconds: 30, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/f9lVSSI.gif", durationSeconds: 50, expectedCalories: 10 },
      { name: "Elliptical Cross Trainer", exerciseId: "rjtuP6X", sets: 1, reps: "8 min", restSeconds: 60, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/rjtuP6X.gif", durationSeconds: 480, expectedCalories: 70 },
      { name: "High Knees", exerciseId: "ealLwvX", sets: 3, reps: "30 sec", restSeconds: 20, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/ealLwvX.gif", durationSeconds: 35, expectedCalories: 10 },
      { name: "Stationary Bike", exerciseId: "H1PESYI", sets: 1, reps: "8 min", restSeconds: 60, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/H1PESYI.gif", durationSeconds: 480, expectedCalories: 65 },
      { name: "Burpees (Finisher)", exerciseId: "dK9394r", sets: 3, reps: "10", restSeconds: 30, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/dK9394r.gif", durationSeconds: 45, expectedCalories: 14 },
    ],
  },

  // ── 8. Quick HIIT ─────────────────────────────────────────────────────────
  {
    id: "quick_hiit",
    name: "Quick HIIT",
    emoji: "🐆",
    description: "A fast intense full-body high-intensity interval training session. No equipment needed.",
    duration: "20 min",
    difficulty: "Advanced",
    targetMuscles: ["Full Body", "Cardio"],
    equipment: ["Body weight"],
    gradient: ["#FDC830", "#F37335"],
    image: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=900&q=80",
    completions: 18200,
    athlete: { name: "Usain Bolt", title: "8× Olympic Gold Medalist" },
    exercises: [
      { name: "Jumping Jacks (Warm-Up)", exerciseId: "f9lVSSI", sets: 2, reps: "30 sec", restSeconds: 20, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/f9lVSSI.gif", durationSeconds: 35, expectedCalories: 8 },
      { name: "High Knees", exerciseId: "ealLwvX", sets: 4, reps: "30 sec", restSeconds: 15, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/ealLwvX.gif", durationSeconds: 35, expectedCalories: 13 },
      { name: "Burpees", exerciseId: "dK9394r", sets: 4, reps: "30 sec", restSeconds: 15, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/dK9394r.gif", durationSeconds: 35, expectedCalories: 16 },
      { name: "Mountain Climbers", exerciseId: "RJgzwny", sets: 4, reps: "30 sec", restSeconds: 15, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/RJgzwny.gif", durationSeconds: 35, expectedCalories: 13 },
      { name: "Close-Grip Push-Ups", exerciseId: "x6KpKpq", sets: 3, reps: "30 sec", restSeconds: 15, category: "Chest", gifUrl: "https://static.exercisedb.dev/media/x6KpKpq.gif", durationSeconds: 35, expectedCalories: 9 },
      { name: "Walking Lunges", exerciseId: "IZVHb27", sets: 3, reps: "30 sec", restSeconds: 15, category: "Legs", gifUrl: "https://static.exercisedb.dev/media/IZVHb27.gif", durationSeconds: 35, expectedCalories: 11 },
      { name: "Plank", exerciseId: "VBAWRPG", sets: 3, reps: "30 sec", restSeconds: 20, category: "Abs", gifUrl: "https://static.exercisedb.dev/media/VBAWRPG.gif", durationSeconds: 35, expectedCalories: 7 },
    ],
  },

  // ── 9. Upper Body Builder ─────────────────────────────────────────────────
  {
    id: "upper_body_builder",
    name: "Upper Body Builder",
    emoji: "🦾",
    description: "Focus on chest, shoulders, and arms with an intensive dumbbell session.",
    duration: "45 min",
    difficulty: "Intermediate",
    targetMuscles: ["Chest", "Shoulders", "Arms"],
    equipment: ["Dumbbell"],
    gradient: ["#3a7bd5", "#3a6073"],
    image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=80",
    completions: 11400,
    athlete: { name: "Ronnie Coleman", title: "8× Mr. Olympia Champion" },
    exercises: [
      { name: "Incline Dumbbell Press", exerciseId: "ns0SIbU", sets: 4, reps: "10-12", restSeconds: 60, category: "Chest", gifUrl: "https://static.exercisedb.dev/media/ns0SIbU.gif", durationSeconds: 45, expectedCalories: 11 },
      { name: "Dumbbell Pullover", exerciseId: "FSD6PGL", sets: 3, reps: "12", restSeconds: 60, category: "Chest", gifUrl: "https://static.exercisedb.dev/media/FSD6PGL.gif", durationSeconds: 45, expectedCalories: 9 },
      { name: "Dumbbell Shoulder Press", exerciseId: "A6wtbuL", sets: 4, reps: "10", restSeconds: 60, category: "Shoulders", gifUrl: "https://static.exercisedb.dev/media/A6wtbuL.gif", durationSeconds: 45, expectedCalories: 10 },
      { name: "Lateral Raises", exerciseId: "DsgkuIt", sets: 3, reps: "15", restSeconds: 45, category: "Shoulders", gifUrl: "https://static.exercisedb.dev/media/DsgkuIt.gif", durationSeconds: 40, expectedCalories: 6 },
      { name: "Hammer Curls", exerciseId: "slDvUAU", sets: 3, reps: "12 each", restSeconds: 45, category: "Biceps", gifUrl: "https://static.exercisedb.dev/media/slDvUAU.gif", durationSeconds: 40, expectedCalories: 7 },
      { name: "Kneeling Triceps Extension", exerciseId: "s0HKO2I", sets: 3, reps: "12-15", restSeconds: 45, category: "Triceps", gifUrl: "https://static.exercisedb.dev/media/s0HKO2I.gif", durationSeconds: 40, expectedCalories: 7 },
      { name: "Close-Grip Push-Ups (Superset)", exerciseId: "x6KpKpq", sets: 3, reps: "12-15", restSeconds: 45, category: "Triceps", gifUrl: "https://static.exercisedb.dev/media/x6KpKpq.gif", durationSeconds: 40, expectedCalories: 7 },
      { name: "Plank", exerciseId: "VBAWRPG", sets: 3, reps: "45 sec", restSeconds: 45, category: "Core", gifUrl: "https://static.exercisedb.dev/media/VBAWRPG.gif", durationSeconds: 50, expectedCalories: 7 },
    ],
  },

  // ── 10. Lower Body Power ──────────────────────────────────────────────────
  {
    id: "lower_body_power",
    name: "Lower Body Power",
    emoji: "🔥",
    description: "Build leg strength and power with dumbbells and bodyweight movements.",
    duration: "40 min",
    difficulty: "Intermediate",
    targetMuscles: ["Legs", "Glutes", "Calves"],
    equipment: ["Dumbbell", "Body weight"],
    gradient: ["#11998e", "#38ef7d"],
    image: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=80",
    completions: 6900,
    athlete: { name: "Kelsey Wells", title: "PWR Training Creator" },
    exercises: [
      { name: "Jumping Jacks (Warm-Up)", exerciseId: "f9lVSSI", sets: 2, reps: "30", restSeconds: 20, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/f9lVSSI.gif", durationSeconds: 40, expectedCalories: 6 },
      { name: "Dumbbell Deadlift", exerciseId: "nUwVh7b", sets: 4, reps: "10-12", restSeconds: 90, category: "Legs", gifUrl: "https://static.exercisedb.dev/media/nUwVh7b.gif", durationSeconds: 55, expectedCalories: 14 },
      { name: "Walking Lunges", exerciseId: "IZVHb27", sets: 4, reps: "12 each leg", restSeconds: 60, category: "Legs", gifUrl: "https://static.exercisedb.dev/media/IZVHb27.gif", durationSeconds: 55, expectedCalories: 11 },
      { name: "Curtsey Squat", exerciseId: "gUjqdei", sets: 3, reps: "12 each leg", restSeconds: 60, category: "Quads", gifUrl: "https://static.exercisedb.dev/media/gUjqdei.gif", durationSeconds: 50, expectedCalories: 9 },
      { name: "Glute Bridge March", exerciseId: "GibBPPg", sets: 3, reps: "15 each leg", restSeconds: 45, category: "Glutes", gifUrl: "https://static.exercisedb.dev/media/GibBPPg.gif", durationSeconds: 55, expectedCalories: 8 },
      { name: "Standing Calf Raises", exerciseId: "8ozhUIZ", sets: 4, reps: "20", restSeconds: 30, category: "Calves", gifUrl: "https://static.exercisedb.dev/media/8ozhUIZ.gif", durationSeconds: 40, expectedCalories: 5 },
      { name: "High Knees (Finisher)", exerciseId: "ealLwvX", sets: 3, reps: "30 sec", restSeconds: 30, category: "Cardio", gifUrl: "https://static.exercisedb.dev/media/ealLwvX.gif", durationSeconds: 35, expectedCalories: 11 },
      { name: "Plank", exerciseId: "VBAWRPG", sets: 3, reps: "45 sec", restSeconds: 40, category: "Core", gifUrl: "https://static.exercisedb.dev/media/VBAWRPG.gif", durationSeconds: 50, expectedCalories: 7 },
    ],
  },
];
