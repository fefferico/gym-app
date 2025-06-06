// src/app/core/models/workout.model.ts

export interface ExerciseSetParams {
  id: string;
  reps?: number;
  weight?: number | null; // Allow null for bodyweight or if weight is not applicable
  duration?: number;
  tempo?: string;
  restAfterSet: number; // For the set *within* an exercise. For supersets, this might be 0 for intermediate exercises.
  notes?: string;
  isWarmup?: boolean; // <<<< NEW
  _uiIsCompleted?: boolean;
  _uiActualReps?: number;
  _uiActualWeight?: number;
  _uiActualDuration?: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string; // Foreign key to Exercise.id
  exerciseName?: string;
  sets: ExerciseSetParams[];
  notes?: string; // Notes specific to this exercise within the routine

  // --- Superset Properties ---
  /**
   * A unique ID grouping exercises in the same superset.
   * If null or undefined, this exercise is not part of a superset.
   */
  supersetId: string | null;
  /**
   * The order of this exercise within its superset group (0-indexed).
   * Relevant only if supersetId is not null.
   */
  supersetOrder: number | null;
  /**
   * The total number of exercises in this superset group.
   * Relevant only if supersetId is not null.
   * Can be derived or explicitly set.
   */
  supersetSize?: number | null; // Can be useful for display "Exercise 1 of 2 in Superset"

  // `lastPerformed` was on WorkoutExercise, but it's usually a Routine-level or global exercise stat.
  // Keeping it here for now if your current logic uses it, but consider if it's truly per WorkoutExercise instance.
  lastPerformed?: Date;

  /**
   * Number of rounds this exercise (or the superset/block it starts) should be repeated.
   * Default is 1. Only applies if this exercise is the START of a block
   * (i.e., not part of a superset OR supersetOrder === 0).
   */
  rounds?: number; // e.g., 3 for 3 rounds
}

export interface Routine {
  id: string;
  name: string;
  description?: string;
  exercises: WorkoutExercise[]; // This list will be ordered, and superset exercises will be contiguous
  estimatedDuration?: number;
  lastPerformed?: string;
  goal?: 'hypertrophy' | 'strength' | 'muscular endurance' | 'cardiovascular endurance' | 'fat loss / body composition' | 'mobility & flexibility' | 'power / explosiveness' | 'speed & agility' | 'balance & coordination' | 'skill acquisition' | 'rehabilitation / injury prevention' | 'mental health / stress relief' | 'general health & longevity' | 'sport-specific performance' | 'maintenance' | 'custom';
  targetMuscleGroups?: string[];
  notes?: string;
}

