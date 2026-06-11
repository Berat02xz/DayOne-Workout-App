import { schemaMigrations, createTable } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [],
    },
    {
      toVersion: 3,
      steps: [],
    },
    {
      toVersion: 4,
      steps: [],
    },
    {
      toVersion: 5,
      steps: [],
    },
    {
      toVersion: 6,
      steps: [],
    },
    {
      toVersion: 7,
      steps: [],
    },
    {
      toVersion: 8,
      steps: [],
    },
    {
      toVersion: 9,
      steps: [],
    },
    {
      toVersion: 10,
      steps: [],
    },
    {
      toVersion: 11,
      steps: [],
    },
    {
      toVersion: 12,
      steps: [],
    },
    {
      toVersion: 13,
      steps: [
        createTable({
          name: 'liked_exercises',
          columns: [
            { name: 'exercise_id', type: 'string', isIndexed: true },
            { name: 'name', type: 'string' },
            { name: 'gif_url', type: 'string' },
            { name: 'category', type: 'string' },
            { name: 'liked_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 15,
      steps: [
        createTable({
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
      ],
    },
    {
      toVersion: 14,
      steps: [
        createTable({
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
    },
  ],
});
