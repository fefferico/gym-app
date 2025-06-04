// src/app/core/models/workout.model.ts

// Renamed from 'Set' to 'ExerciseSetParams' to avoid conflict with built-in Set
export interface ExerciseSetParams {
  id: string; // UUID for this specific instance of a set in a routine or workout plan
  reps?: number;         // Target/planned reps
  weight?: number;       // Target/planned weight
  duration?: number;     // Target/planned duration for timed sets
  tempo?: string;        // e.g., "2-0-1-0"
  restAfterSet: number;  // Seconds of rest planned after this set
  notes?: string;        // Notes for planning this set

  // These fields can be used by the WorkoutPlayerComponent for temporary UI state during an active workout
  // They are not part of the persistent LoggedSet data directly, but inform it.
  _uiIsCompleted?: boolean;  // Has the user marked this set as done in the player?
  _uiActualReps?: number;    // Reps input by user in player
  _uiActualWeight?: number;  // Weight input by user in player
  _uiActualDuration?: number;// Duration input by user in player
}

export interface WorkoutExercise {
  id: string; // UUID for this exercise instance within a routine
  exerciseName?: string;
  lastPerformed?: Date;
  exerciseId: string; // Foreign key to Exercise.id from exercise.model.ts
  sets: ExerciseSetParams[]; // Array of planned sets for this exercise
  isSupersetStart?: boolean; // Marks the beginning of a superset
  supersetGroup?: string; // Identifier for exercises in the same superset/giant set
  notes?: string; // Notes specific to this exercise in the routine (e.g., "Focus on form")
}

export interface Routine {
  id: string; // UUID
  name: string;
  description?: string;
  exercises: WorkoutExercise[];
  estimatedDuration?: number; // Calculated or user-defined
  lastPerformed?: string;
  // For intelligent generation
  goal?: 'strength' | 'hypertrophy' | 'endurance' | 'custom';
  targetMuscleGroups?: string[];
  notes?: string; // General notes for the routine
}