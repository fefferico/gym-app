// src/app/core/models/exercise.model.ts
export type ExerciseCategory =
  | 'bodyweight'
  | 'dumbbells'
  | 'kettlebells'
  | 'barbells'
  | 'machines'
  | 'cables'
  | 'bands'
  | 'other';

export interface Exercise {
  id: string; // Unique identifier (e.g., UUID or a slug like 'push-up')
  name: string;
  description: string;
  category: ExerciseCategory;
  muscleGroups: string[]; // e.g., ['Chest', 'Triceps', 'Shoulders (Anterior)']
  primaryMuscleGroup: string; // For easier filtering/display
  equipmentNeeded?: string[]; // e.g., ['Dumbbells', 'Bench'] or empty for bodyweight
  imageUrls: string[]; // Paths to static images in assets, e.g., ['exercises/push-up_1.jpg', 'exercises/push-up_2.jpg']
  videoUrl?: string; // Optional: Link to a demonstration video (e.g., YouTube)
  notes?: string; // Optional: Tips, common mistakes, variations
  equipment?: string; // << NEW: e.g., 'Barbell', 'Dumbbell', 'Machine', 'Bodyweight'
  iconName?: string;
}