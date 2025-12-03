// src/app/core/models/workout-log.model.ts

import { PerceivedWorkoutInfo } from "../../features/workout-tracker/perceived-effort-modal.component";
import { WorkoutLocation } from "./location.model";
import { DistanceTarget, DurationTarget, METRIC, RepsTarget, RestTarget, WeightTarget } from "./workout.model";

// Describes a single set that was actually performed and logged.
export interface LoggedSet {
  id: string; // Unique ID for this specific logged set instance (can be the plannedSetId if it originated from a routine)
  exerciseName: string | undefined;
  plannedSetId?: string; // ID of the ExerciseSetParams from the routine, if applicable
  exerciseId: string;    // ID of the base Exercise performed

  // Actual performance data
  repsLogged?: RepsTarget;
  weightLogged?: WeightTarget;
  durationLogged?: DurationTarget; // in seconds
  distanceLogged?: DistanceTarget; // in kilometers
  tempoLogged?: string | undefined;     // Actual tempo used, if tracked by user.
  restLogged?: RestTarget;
  // restTaken?: number;  // Actual rest taken before the next set (more complex to track accurately)

  // Target values (copied from the planned set in the routine at the time of performance)
  // These are useful for seeing if targets were met/exceeded.
  targetRest?: RestTarget;
  targetReps?: RepsTarget;
  targetWeight?: WeightTarget;
  targetDuration?: DurationTarget;
  targetDistance?: DistanceTarget; // in kilometers
  targetTempo?: string; // Target tempo from the plan
  notes?: string;         // User notes specific to this performed set (e.g., "Felt easy", "Form breakdown on last rep")
  // formRating?: 1 | 2 | 3 | 4 | 5; // Optional: User's perceived form rating for the set
  timestamp: string;       // ISO string of when this set was completed/logged.
  type: 'standard' | 'warmup' | 'amrap' | 'dropset' | 'failure' | 'myorep' | 'restpause' | 'custom' | 'superset' | string; // More flexible
  rpe?: number; // Optional: User's perceived exertion for this set (RPE 1-10)
  workoutLogId?: string; // ID of the WorkoutLog this set belongs to
  fieldOrder: METRIC[]; // Order of fields as per user preference
}

// Describes a group of sets performed together as a "round" (e.g., in a circuit or superset)
export interface LoggedRound {
  id: string; // Unique ID for this round
  exerciseIds: string[]; // IDs of exercises included in this round
  setIds: string[]; // IDs of LoggedSet instances that are part of this round
  order: number; // The order of this round within the workout or exercise
  timestamp: string; // ISO string of when this round was completed/logged
  notes?: string; // Optional notes for this round
  workoutLogId?: string; // ID of the WorkoutLog this round belongs to
}

// Describes all sets performed for a specific exercise within a single workout session.
export interface LoggedWorkoutExercise {
  id: string;     // ID of the base Exercise definition
  exerciseId: string;     // exerciseId of the base Exercise definition
  exerciseName: string;   // Denormalized name for easier display in logs
  sets: LoggedSet[];      // Array of actual sets performed for this exercise
  notes?: string;         // User notes for this exercise during this specific workout log
  workoutLogId?: string; // ID of the WorkoutLog this exercise belongs to
  supersetId?: string | null;
  supersetOrder?: number | null;
  supersetType?: 'standard' | 'emom' | null;
  emomTimeSeconds?: number | null;
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
  durationSeconds?: number; // Total duration of the workout in seconds
  workoutExercises: LoggedWorkoutExercise[]; // Array of all exercises performed in this session
  notes?: string;         // Overall user notes for the entire workout session
  goal?: string;         // Optional: Goal of the workout (e.g., "Strength", "Hypertrophy", "Endurance")
  // Optional: User-perceived effort, mood, location, etc.
  // effortLevel?: number; // e.g., RPE 1-10
  // mood?: 'good' | 'average' | 'poor';
  programId?: string; // ID of the program this workout belongs to, if applicable
  programName?: string;

  // +++ NEW PROPERTY TO LINK LOG TO THE SCHEDULE +++
  /** If part of a program, the ID of the specific ScheduledRoutineDay this log fulfills. */
  scheduledDayId?: string;
  iterationId?: string;
  perceivedWorkoutInfo?: PerceivedWorkoutInfo; // <-- ADD THIS LINE (e.g., a rating from 1 to 10)
  locationName?: string;  // e.g., 'Living Room' (optional, for display/backup)
  locationId?: string; // e.g., 'res-living'
  people?: string[]
}

// For displaying personal bests
export interface PersonalBestSet extends LoggedSet {
  pbType: string; // e.g., "1RM", "5RM (estimated)", "Max Reps @ X kg"
  exerciseId: string;
  repsLogged?: RepsTarget | undefined;
  weightLogged?: WeightTarget | undefined;
  volume?: number | undefined;
  durationLogged?: DurationTarget | undefined; // In seconds
  estimatedOneRepMax?: number | null;
  timestamp: string; // ISO date string of when this PB was achieved
  workoutLogId?: string; // <<<< ADD THIS if not present
  notes?: string; // Optional notes from the set that achieved this PB
  // Potentially routineId and routineName if you want to display that too
  history?: PBHistoryInstance[]; // Array of previous instances for this specific pbType, most recent previous PB at index 0
}

export interface LastPerformanceSummary {
  lastPerformedDate: string;
  workoutLogId: string;       // Ensure this is present
  sets: LoggedSet[];          // Ensure this is LoggedSet[]
  durationMinutes?: number; // Total duration of the last performance in minutes
  startTime?: number;      // Timestamp (milliseconds since epoch) of when the last performance started
  endTime?: number;       // Timestamp (milliseconds since epoch) of when the last performance ended
  notes?: string;         // Optional notes for the last performance
  goal?: string;          // Optional: Goal of the last performance (e.g., "Strength", "Hypertrophy", "Endurance")
  programId?: string;     // ID of the program this last performance belongs to, if applicable
  routineId?: string;     // If this was based on a saved Routine
  routineName?: string;   // Denormalized routine name for display
}


export interface PBHistoryInstance {
  weightLogged?: number | undefined;
  repsLogged?: number | undefined; // Actual reps for this historical PB instance
  durationLogged?: number | undefined; // Actual duration for this historical PB instance
  distanceLogged?: number | undefined; // Actual duration for this historical PB instance
  timestamp: string;    // ISO date string of when this historical PB was achieved
  workoutLogId?: string; // The log ID where this historical PB was achieved
  pbType?: string;
}


export interface EnrichedWorkoutLog extends WorkoutLog {
  weekName?: string | null;
  dayName?: string | null;
}

export interface AchievedPB {
  exerciseId: string;
  exerciseName: string;
  pbType: string;
  achievedSet: LoggedSet; // The set that achieved this PB
  isEstimated?: boolean; // True if it's an estimated 1RM
}