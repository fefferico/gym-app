// src/app/core/models/workout-log.model.ts

// Describes a single set that was actually performed and logged.
export interface LoggedSet {
  id: string; // Unique ID for this logged set instance (can be same as planned set ID if from a routine)
  exerciseId: string; // ID of the exercise performed (from Exercise Library)
  
  // Actual performance data
  repsAchieved: number;
  weightUsed?: number; // Weight used (e.g., kg, lbs). Optional for bodyweight or timed.
  durationPerformed?: number; // Duration in seconds (for timed sets like planks)
  
  // Target values (if this set originated from a planned routine)
  targetReps?: number;
  targetWeight?: number;
  targetDuration?: number;
  targetTempo?: string;

  // Optional additional details logged
  tempoUsed?: string; // Actual tempo if tracked
  restTakenBeforeNextSet?: number; // Seconds of rest taken before the *next* set (if tracked)
  notes?: string; // User notes specifically for this performed set
  formRating?: 1 | 2 | 3 | 4 | 5; // Optional: User's subjective rating of form
  rpe?: number; // Optional: Rate of Perceived Exertion (e.g., 1-10)
  
  timestamp: string; // ISO string: When this set was completed/logged
  
  // If part of a planned routine, this links back to the planned set's ID
  // from ExerciseSetParams.id in the Routine model.
  plannedSetId?: string;
}

// Describes all sets performed for a specific exercise within a single workout session.
export interface LoggedWorkoutExercise {
  exerciseId: string; // ID of the base exercise definition (from Exercise Library)
  exerciseName: string; // Denormalized for easier display in logs
  sets: LoggedSet[]; // Array of actual sets performed for this exercise
  notes?: string; // Overall notes for this exercise during this specific workout log
}

// Represents a single completed workout session.
export interface WorkoutLog {
  id: string; // UUID for the entire workout session log
  routineId?: string; // Optional: If this workout was based on a saved Routine
  routineName?: string; // Optional: Denormalized routine name for display
  
  date: string; // ISO string: Date the workout was performed (start date)
  startTime: number; // Timestamp (milliseconds since epoch) of when the workout started
  endTime?: number; // Timestamp (milliseconds since epoch) of when the workout finished
  durationMinutes?: number; // Total duration in minutes (can be calculated from startTime/endTime)
  
  exercises: LoggedWorkoutExercise[]; // List of exercises performed in this session
  
  // Optional overall workout feedback
  overallNotes?: string;
  location?: string; // e.g., "Home Gym", "Commercial Gym"
  mood?: 'great' | 'good' | 'okay' | 'bad' | 'terrible'; // User's mood pre/post workout
  effortLevel?: 'easy' | 'moderate' | 'hard' | 'very-hard' | 'max-effort'; // Overall perceived effort
  // Future: Could add bodyweight at time of workout, etc.
}