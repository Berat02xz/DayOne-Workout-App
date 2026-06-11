import { Database, Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class WorkoutLog extends Model {
  static table = 'workout_logs';

  @field('user_id')          userId!: string;
  @field('routine_id')       routineId!: string;
  @field('routine_name')     routineName!: string;
  @field('completed_at')     completedAt!: number;
  @field('duration_seconds') durationSeconds!: number;
  @field('calories_burned')  caloriesBurned!: number;

  static async logWorkout(
    database: Database,
    params: {
      userId: string;
      routineId: string;
      routineName: string;
      durationSeconds: number;
      caloriesBurned: number;
    }
  ): Promise<WorkoutLog> {
    return database.get<WorkoutLog>('workout_logs').create((log) => {
      log.userId          = params.userId;
      log.routineId       = params.routineId;
      log.routineName     = params.routineName;
      log.completedAt     = Date.now();
      log.durationSeconds = params.durationSeconds;
      log.caloriesBurned  = params.caloriesBurned;
    });
  }

  // Returns all logs for a user within [startMs, endMs]
  static async logsInRange(
    database: Database,
    userId: string,
    startMs: number,
    endMs: number
  ): Promise<WorkoutLog[]> {
    return database
      .get<WorkoutLog>('workout_logs')
      .query()
      .fetch()
      .then((all) =>
        all.filter(
          (l) => l.userId === userId && l.completedAt >= startMs && l.completedAt <= endMs
        )
      );
  }
}
