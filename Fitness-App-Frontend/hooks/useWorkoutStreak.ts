import { useState, useEffect, useCallback } from 'react';
import database from '@/database/database';
import { WorkoutLog } from '@/models/WorkoutLog';
import { getUserIdFromToken } from '@/api/TokenDecoder';

export interface DayStatus {
  date:         Date;
  label:        string;   // "Mon" … "Sun"
  letter:       string;   // "M" "T" "W" …
  isToday:      boolean;
  isFuture:     boolean;
  completed:    boolean;
  workoutName?: string;
  count:        number;
}

const DAY_LABELS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LETTERS = ['S',   'M',   'T',   'W',   'T',   'F',   'S'];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

// Always returns the 7 days of the current Mon–Sun week
function getCurrentWeekDays(): Date[] {
  const today = startOfDay(new Date());
  const dow   = today.getDay(); // 0=Sun … 6=Sat
  // Days since Monday (Sunday counts as 6 back)
  const daysSinceMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(today.getTime() - daysSinceMon * 86_400_000);
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getTime() + i * 86_400_000)
  );
}

export function useWorkoutStreak() {
  const [streak,        setStreak]        = useState<DayStatus[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [loading,       setLoading]       = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const userId  = await getUserIdFromToken();
      const today   = startOfDay(new Date());
      const week    = getCurrentWeekDays();
      const result: DayStatus[] = [];

      for (const dayDate of week) {
        const isFuture = dayDate.getTime() > today.getTime();
        const isToday  = dayDate.getTime() === today.getTime();
        let logs: WorkoutLog[] = [];

        if (!isFuture) {
          logs = await WorkoutLog.logsInRange(
            database,
            userId ?? '',
            startOfDay(dayDate).getTime(),
            endOfDay(dayDate).getTime()
          );
        }

        const dow = dayDate.getDay();
        result.push({
          date:        dayDate,
          label:       DAY_LABELS[dow],
          letter:      DAY_LETTERS[dow],
          isToday,
          isFuture,
          completed:   logs.length > 0,
          workoutName: logs[0]?.routineName,
          count:       logs.length,
        });
      }

      // Consecutive streak: walk backwards from today
      let s = 0;
      for (let i = result.length - 1; i >= 0; i--) {
        if (result[i].isFuture) continue;
        if (result[i].completed) s++;
        else break;
      }

      setStreak(result);
      setCurrentStreak(s);
    } catch {
      setStreak([]);
      setCurrentStreak(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { streak, currentStreak, loading, refresh: load };
}
