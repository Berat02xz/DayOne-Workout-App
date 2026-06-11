import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 15,
  tables: [
    tableSchema({
      name: 'user',
      columns: [
        { name: 'user_id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },

        { name: 'age', type: 'number' },
        { name: 'gender', type: 'string' },
        { name: 'height', type: 'string' },
        { name: 'weight', type: 'number' },

        { name: 'equipment_access', type: 'string' },
        { name: 'activity_level', type: 'string' },
        { name: 'fitness_level', type: 'string' },
        { name: 'weight_goal', type: 'string' },

        { name: 'bmi', type: 'number' },
        { name: 'bmr', type: 'number' },
        { name: 'tdee', type: 'number' },
        { name: 'caloric_intake', type: 'number' },
        { name: 'caloric_deficit', type: 'string' },

        { name: 'unit', type: 'string' },
        { name: 'app_name', type: 'string' },
        { name: 'role', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'meals',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'meal_name', type: 'string' },
        { name: 'calories', type: 'number' },
        { name: 'protein', type: 'number' },
        { name: 'carbohydrates', type: 'number' },
        { name: 'fats', type: 'number' },
        { name: 'label', type: 'string' },
        { name: 'created_at', type: 'number', isIndexed: true },
        { name: 'health_score', type: 'number' },
        { name: 'one_emoji', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'saved_messages',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'message_text', type: 'string' },
        { name: 'message_type', type: 'string' }, // 'user' or 'ai'
        { name: 'saved_at', type: 'number', isIndexed: true },
      ],
    }),
    tableSchema({
      name: 'liked_exercises',
      columns: [
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'gif_url', type: 'string' },
        { name: 'category', type: 'string' },
        { name: 'liked_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'workout_logs',
      columns: [
        { name: 'user_id',          type: 'string', isIndexed: true },
        { name: 'routine_id',       type: 'string' },
        { name: 'routine_name',     type: 'string' },
        { name: 'completed_at',     type: 'number', isIndexed: true },
        { name: 'duration_seconds', type: 'number' },
        { name: 'calories_burned',  type: 'number' },
      ],
    }),
    tableSchema({
      name: 'cached_exercises',
      columns: [
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'gif_url', type: 'string' },
        { name: 'target_muscles', type: 'string' },
        { name: 'body_parts', type: 'string' },
        { name: 'equipments', type: 'string' },
        { name: 'secondary_muscles', type: 'string' },
        { name: 'instructions', type: 'string' },
        { name: 'cached_at', type: 'number' },
      ],
    }),
  ],
});
