// src/app/core/models/workout.model.ts

import { Exercise, ExerciseCategory } from "./exercise.model";
import { LastPerformanceSummary, LoggedSet, LoggedWorkoutExercise } from "./workout-log.model";

export interface ExerciseTargetSetParams {
  id: string;
  tempo?: string;
  restAfterSet: number; // For the set *within* an exercise. For supersets, this might be 0 for intermediate exercises.
  notes?: string;
  type: 'standard' | 'warmup' | 'amrap' | 'dropset' | 'failure' | 'myorep' | 'restpause' | 'custom' | 'superset' | 'tabata' | string; // More flexible
  _uiIsCompleted?: boolean;
  _uiActualReps?: number;
  _uiActualWeight?: number;
  _uiActualDuration?: number;
  // Add other specific fields if a type implies them, e.g.:
  targetRpe?: number | null; // Could be useful for 'failure' sets
  targetWeight?: number | null;
  targetWeightMin?: number | null;
  targetWeightMax?: number | null;
  targetDuration?: number | null;
  targetDurationMin?: number | null;
  targetDurationMax?: number | null;
  targetDistance?: number | null;
  targetDistanceMin?: number | null;
  targetDistanceMax?: number | null;
  targetReps?: number | null;
  targetRepsMin?: number | null;
  targetRepsMax?: number | null;
  dropToWeight?: number | null; // For 'dropset'
  amrapTimeLimit?: number | null; // For AMRAP if it's time-bound rather than rep-bound
}

export interface ExerciseExecutionSetParams {
  id: string;
  tempo?: string;
  notes?: string;
  type: 'standard' | 'warmup' | 'amrap' | 'dropset' | 'failure' | 'myorep' | 'restpause' | 'custom' | 'superset' | 'tabata' | string; // More flexible
  restAfterSet: number; // For the set *within* an exercise. For supersets, this might be 0 for intermediate exercises.
  repsAchieved: number;
  weightUsed: number;
  actualDuration: number;
  actualDistance: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string; // Foreign key to Exercise.id
  exerciseName?: string;
  sets: ExerciseTargetSetParams[];
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
  supersetRounds?: number | null;
  supersetCurrentRound?: number | null; // Tracks the current round when performing the superset

  // `lastPerformed` was on WorkoutExercise, but it's usually a Routine-level or global exercise stat.
  // Keeping it here for now if your current logic uses it, but consider if it's truly per WorkoutExercise instance.
  lastPerformed?: Date;

  /**
   * Number of rounds this exercise (or the superset/block it starts) should be repeated.
   * Default is 1. Only applies if this exercise is the START of a block
   * (i.e., not part of a superset OR supersetOrder === 0).
   */
  rounds?: number; // e.g., 3 for 3 rounds

  // +++ NEW: Superset Type & EMOM Properties +++
  /**
   * Defines the behavior of the superset.
   * 'standard': Traditional superset.
   * 'emom': Every Minute On the Minute style workout.
   */
  supersetType?: 'standard' | 'emom' | null;
  /**
   * For 'emom' type, this is the total time for one round in seconds.
   * e.g., 60 for EMOM, 120 for E2MOM.
   * Only relevant if supersetOrder is 0.
   */
  emomTimeSeconds?: number | null;
  
  workoutLogId?: string;
  sessionStatus?: 'pending' | 'skipped' | 'do_later' | 'completed' | 'started'; // For in-session tracking
  type: 'standard' | 'warmup' | 'amrap' | 'dropset' | 'failure' | 'myorep' | 'restpause' | 'custom' | 'superset' | string; // More flexible
  category?: ExerciseCategory;
}

export interface Routine {
  id: string;
  name: string;
  description?: string;
  exercises: WorkoutExercise[]; // This list will be ordered, and superset exercises will be contiguous
  estimatedDuration?: number;
  lastPerformed?: string;
  goal?: 'hypertrophy' | 'strength' | 'muscular endurance' | 'tabata' | 'cardiovascular endurance' | 'fat loss / body composition' | 'mobility & flexibility' | 'power / explosiveness' | 'speed & agility' | 'balance & coordination' | 'skill acquisition' | 'rehabilitation / injury prevention' | 'mental health / stress relief' | 'general health & longevity' | 'sport-specific performance' | 'maintenance' | 'rest' | 'custom';
  targetMuscleGroups?: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  isHidden?: boolean;
  isFavourite?: boolean;
  isDisabled?: boolean;
}


export interface ActiveSetInfo {
  exerciseIndex: number;
  setIndex: number;
  exerciseData: WorkoutExercise; // This WorkoutExercise will have sessionStatus
  setData: ExerciseTargetSetParams;
  baseExerciseInfo?: Exercise;
  isCompleted: boolean;
  actualReps?: number;
  actualWeight?: number | null;
  actualDuration?: number;
  notes?: string; // This is for the *individual set's notes*
  type: 'standard' | 'warmup' | 'amrap' | 'custom';
  historicalSetPerformance?: LoggedSet | null
}

export interface PausedWorkoutState {
  version: string;
  routineId: string | null;
  programId?: string | null;
  programName?: string | null;
  scheduledDayId?: string | null;
  sessionRoutine: Routine; // Routine object, its exercises will have sessionStatus
  originalWorkoutExercises?: Routine; // Snapshot of the *original* routine's exercises if one was loaded
  currentExerciseIndex: number;
  currentSetIndex: number;
  currentWorkoutLogExercises: LoggedWorkoutExercise[];
  workoutStartTimeOriginal: number;
  sessionTimerElapsedSecondsBeforePause: number;
  currentBlockRound: number;
  totalBlockRounds: number;
  timedSetTimerState?: TimedSetState;
  timedSetElapsedSeconds?: number;
  isResting: boolean;
  isRestTimerVisibleOnPause: boolean;
  restTimerRemainingSecondsOnPause?: number;
  restTimerInitialDurationOnPause?: number;
  restTimerMainTextOnPause?: string;
  restTimerNextUpTextOnPause: string | null;
  lastPerformanceForCurrentExercise?: LastPerformanceSummary | null;
  workoutDate: string; // Date of the workout when paused
  isTabataMode?: boolean;
  tabataCurrentIntervalIndex?: number;
  tabataTimeRemainingOnPause?: number;
}

export enum SessionState {
  Loading = 'loading',
  Playing = 'playing',
  Paused = 'paused',
  Error = 'error',
  End = 'end',
}

export enum TimedSetState {
  Idle = 'idle',
  Running = 'running',
  Paused = 'paused',
}

export enum PlayerSubState {
  PerformingSet = 'performing_set',
  PresetCountdown = 'preset_countdown',
  Resting = 'resting'
}