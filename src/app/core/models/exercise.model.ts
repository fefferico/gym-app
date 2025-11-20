import { EquipmentValue } from "../services/equipment-data";
import { MuscleValue } from "../services/muscles-data";
import { Equipment } from "./equipment.model";
import { Muscle } from "./muscle.model";

// src/app/core/models/exercise.model.ts
export const EXERCISE_CATEGORIES = [
  'bodyweightCalisthenics',
  'rehabilitationMobility',
  'yogaPilates',
  'powerlifting',
  'olympicWeightlifting',
  'crossfit',
  'dumbbells',
  'kettlebells',
  'strength',
  'barbells',
  'machines',
  'cables',
  'bands',
  'cardio',
  'stretching',
  'plyometrics',
  'strongman',
  'custom',
  'other',
] as const;

export type ExerciseCategory = typeof EXERCISE_CATEGORIES[number];

export interface Exercise {
  id: string; // Unique identifier (e.g., UUID or a slug like 'push-up')
  name: string;
  description: string;
  category: ExerciseCategory;
  muscleGroups: MuscleValue[]; // e.g., ['Chest', 'Triceps', 'Shoulders (Anterior)']
  primaryMuscleGroup?: MuscleValue; // For easier filtering/display
  equipmentNeeded?: EquipmentValue[]; // e.g., ['Dumbbells', 'Bench'] or empty for bodyweight
  imageUrls: string[]; // Paths to static images in assets, e.g., ['exercises/push-up_1.jpg', 'exercises/push-up_2.jpg']
  videoUrl?: string; // Optional: Link to a demonstration video (e.g., YouTube)
  notes?: string; // Optional: Tips, common mistakes, variations
  equipment?: EquipmentValue; // << NEW: e.g., 'Barbell', 'Dumbbell', 'Machine', 'bodyweightCalisthenics'
  iconName?: string;
  isCustom?: boolean; // Flag to indicate if this is a user-defined exercise
  createdAt?: string; // Timestamp for when the exercise was created
  updatedAt?: string; // Timestamp for when the exercise was last updated
  lastUsedAt?: string; // Timestamp for when the exercise was last used in a workout
  lastUsedLogId?: string;
  isHidden?: boolean; // Flag to indicate if the exercise is hidden from the main list
  usageCount?: number;

  _searchName?: string;
  _searchCategory?: string;
  _searchDescription?: string;
  _searchPrimaryMuscle?: string;
}