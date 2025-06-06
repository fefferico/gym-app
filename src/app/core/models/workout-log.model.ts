// src/app/core/models/workout-log.model.ts

// Describes a single set that was actually performed and logged.
export interface LoggedSet {
  id: string; // Unique ID for this specific logged set instance (can be the plannedSetId if it originated from a routine)
  plannedSetId?: string; // ID of the ExerciseSetParams from the routine, if applicable
  exerciseId: string;    // ID of the base Exercise performed

  // Actual performance data
  repsAchieved: number;
  weightUsed?: number | null;
  durationPerformed?: number; // Duration in seconds, if it was a timed set or part of one.
  tempoUsed?: string;     // Actual tempo used, if tracked by user.
  // restTaken?: number;  // Actual rest taken before the next set (more complex to track accurately)

  // Target values (copied from the planned set in the routine at the time of performance)
  // These are useful for seeing if targets were met/exceeded.
  targetReps?: number;
  targetWeight?: number | null;
  targetDuration?: number;
  targetTempo?: string; // Target tempo from the plan

  notes?: string;         // User notes specific to this performed set (e.g., "Felt easy", "Form breakdown on last rep")
  // formRating?: 1 | 2 | 3 | 4 | 5; // Optional: User's perceived form rating for the set
  timestamp: string;       // ISO string of when this set was completed/logged.
  isWarmup?: boolean; // <<<< NEW
}

// Describes all sets performed for a specific exercise within a single workout session.
export interface LoggedWorkoutExercise {
  exerciseId: string;     // ID of the base Exercise definition
  exerciseName: string;   // Denormalized name for easier display in logs
  sets: LoggedSet[];      // Array of actual sets performed for this exercise
  notes?: string;         // User notes for this exercise during this specific workout log
}

// Describes an entire completed workout session.
export interface WorkoutLog {
  id: string;             // Unique UUID for this entire workout session log
  routineId?: string;     // If this workout was based on a saved Routine
  routineName?: string;   // Denormalized routine name for display
  date: string;           // Start date of the workout (ISO string: YYYY-MM-DD)
  startTime: number;      // Timestamp (milliseconds since epoch) of when the workout started
  endTime?: number;       // Timestamp (milliseconds since epoch) of when the workout ended
  durationMinutes?: number; // Total duration of the workout in minutes
  exercises: LoggedWorkoutExercise[]; // Array of all exercises performed in this session
  notes?: string;         // Overall user notes for the entire workout session
  // Optional: User-perceived effort, mood, location, etc.
  // effortLevel?: number; // e.g., RPE 1-10
  // mood?: 'good' | 'average' | 'poor';
}

// For displaying personal bests
export interface PersonalBestSet extends LoggedSet {
  pbType: string; // e.g., "1RM", "5RM (estimated)", "Max Reps @ X kg"
}

export interface LastPerformanceSummary {
  lastPerformedDate: string;
  workoutLogId: string;       // Ensure this is present
  sets: LoggedSet[];          // Ensure this is LoggedSet[]
}