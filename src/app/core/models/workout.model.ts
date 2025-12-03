// src/app/core/models/workout.model.ts

import { MuscleValue } from "../services/muscles-data";
import { EXERCISE_CATEGORY_TYPES, ExerciseCategory } from "./exercise-category.model";
import { Exercise } from "./exercise.model";
import { WorkoutLocation } from "./location.model";
import { LastPerformanceSummary, LoggedSet, LoggedWorkoutExercise } from "./workout-log.model";
import { WorkoutSectionType } from "./workout-section-type.model";
import { WorkoutSection } from "./workout-section.model";

export enum RepsTargetType {
  "exact" = "exact",
  "range" = "range",
  "max" = "max",
  "max_fraction" = "max_fraction",
  "amrap" = "amrap",
  "min_plus" = "min_plus", // New type for "at least X reps"
}

export interface RepsTargetScheme {
  type: RepsTargetType;
  labelKey: string; // Key for ngx-translate, e.g., 'repsSchemes.exact'
  isTextual: boolean; // True for AMRAP, MAX, etc.
  availableInBuilder: boolean; // Can this be set when planning a routine?
  availableInPlayer: boolean;  // Can this be logged during a workout?
  availableInLogs?: boolean; // Can this appear in logged data?
}

export const REPS_TARGET_SCHEMES: RepsTargetScheme[] = [
  { type: RepsTargetType.exact, labelKey: 'repsSchemes.exact', isTextual: false, availableInBuilder: true, availableInPlayer: true, availableInLogs: true },
  { type: RepsTargetType.range, labelKey: 'repsSchemes.range', isTextual: false, availableInBuilder: true, availableInPlayer: false, availableInLogs: false }, // A user logs an exact number, not a range.
  { type: RepsTargetType.min_plus, labelKey: 'repsSchemes.minPlus', isTextual: false, availableInBuilder: true, availableInPlayer: false, availableInLogs: false }, // A user logs an exact number, not "5+".
  { type: RepsTargetType.amrap, labelKey: 'repsSchemes.amrap', isTextual: true, availableInBuilder: true, availableInPlayer: false, availableInLogs: false },
  { type: RepsTargetType.max, labelKey: 'repsSchemes.max', isTextual: true, availableInBuilder: true, availableInPlayer: false, availableInLogs: false },
  { type: RepsTargetType.max_fraction, labelKey: 'repsSchemes.maxFraction', isTextual: true, availableInBuilder: true, availableInPlayer: false, availableInLogs: false }
];

/**
 * Represents the target repetitions for a set. It can be a specific number,
 * a range, a maximum effort, a fraction of a maximum, or AMRAP.
 */
export type RepsTarget =
  | { type: RepsTargetType.exact; value: number }
  | { type: RepsTargetType.range; min: number; max: number }
  | { type: RepsTargetType.max; } // Added isTextual flag
  | { type: RepsTargetType.max_fraction; divisor: number; } // Added isTextual flag
  | { type: RepsTargetType.amrap; } // Added isTextual flag
  | { type: RepsTargetType.min_plus; value: number }; // New shape for "5+" style




// ===================================================================
// 2. WEIGHT (New)
// ===================================================================
export enum WeightTargetType {
  "exact" = "exact",
  "range" = "range",
  "bodyweight" = "bodyweight",
  "percentage_1rm" = "percentage_1rm", // e.g., 80% of 1RM
  // "rm1" = "rm1",
  // "rm3" = "rm3",
  // "rm5" = "rm5",
}

export interface WeightTargetScheme {
  type: WeightTargetType;
  labelKey: string;
  isNumeric: boolean; // Indicates if it takes a user-entered number
  availableInBuilder: boolean;
  availableInPlayer: boolean; // e.g., you can't log "bodyweight", you log an exact weight (even 0)
  availableInLogs?: boolean; // Can this appear in logged data?
}

export const WEIGHT_TARGET_SCHEMES: WeightTargetScheme[] = [
  { type: WeightTargetType.exact, labelKey: 'weightSchemes.exact', isNumeric: true, availableInBuilder: true, availableInPlayer: true, availableInLogs: true },
  { type: WeightTargetType.range, labelKey: 'weightSchemes.range', isNumeric: true, availableInBuilder: true, availableInPlayer: false, availableInLogs: false },
  { type: WeightTargetType.bodyweight, labelKey: 'weightSchemes.bodyweight', isNumeric: false, availableInBuilder: true, availableInPlayer: true, availableInLogs: true },
  { type: WeightTargetType.percentage_1rm, labelKey: 'weightSchemes.percentage1rm', isNumeric: true, availableInBuilder: true, availableInPlayer: false, availableInLogs: false },
  // { type: WeightTargetType.rm1, labelKey: 'weightSchemes.rm1', isNumeric: true, availableInBuilder: true, availableInPlayer: false },
  // { type: WeightTargetType.rm3, labelKey: 'weightSchemes.rm3', isNumeric: true, availableInBuilder: true, availableInPlayer: false },
  // { type: WeightTargetType.rm5, labelKey: 'weightSchemes.rm5', isNumeric: true, availableInBuilder: true, availableInPlayer: false },
];

export type WeightTarget =
  | { type: WeightTargetType.exact; value: number }
  | { type: WeightTargetType.range; min: number; max: number }
  | { type: WeightTargetType.bodyweight }
  | { type: WeightTargetType.percentage_1rm; percentage: number }
  // | { type: WeightTargetType.rm1; value: number }
  // | { type: WeightTargetType.rm3; value: number }
  // | { type: WeightTargetType.rm5; value: number };


// ===================================================================
// 3. DURATION (New)
// ===================================================================
export enum DurationTargetType {
  "exact" = "exact",      // e.g., "Hold for 60s"
  "range" = "range",      // e.g., "Hold for 45-60s"
  "to_failure" = "to_failure" // e.g., "Hold plank until failure"
}

export interface DurationTargetScheme {
  type: DurationTargetType;
  labelKey: string;
  isNumeric: boolean;
  availableInBuilder: boolean;
  availableInPlayer: boolean;
  availableInLogs?: boolean; // Can this appear in logged data?
}

export const DURATION_TARGET_SCHEMES: DurationTargetScheme[] = [
  { type: DurationTargetType.exact, labelKey: 'durationSchemes.exact', isNumeric: true, availableInBuilder: true, availableInPlayer: true, availableInLogs: true },
  { type: DurationTargetType.range, labelKey: 'durationSchemes.range', isNumeric: true, availableInBuilder: true, availableInPlayer: false, availableInLogs: false },
  { type: DurationTargetType.to_failure, labelKey: 'durationSchemes.toFailure', isNumeric: false, availableInBuilder: true, availableInPlayer: false, availableInLogs: false },
];

export type DurationTarget =
  | { type: DurationTargetType.exact; seconds: number }
  | { type: DurationTargetType.range; minSeconds: number; maxSeconds: number }
  | { type: DurationTargetType.to_failure };

// (You can create metadata schemes for Duration, Distance, and Rest if needed for modals, but they are simpler so we can omit for now)


// ===================================================================
// 4. DISTANCE (New)
// ===================================================================
// ===================================================================
// 4. DISTANCE (New)
// ===================================================================
export enum DistanceTargetType {
  "exact" = "exact", // e.g., "Run 5km"
  "range" = "range"  // e.g., "Run 3-5km"
}

// +++ NEW: Metadata for Distance +++
export interface DistanceTargetScheme {
  type: DistanceTargetType;
  labelKey: string;
  isNumeric: boolean;
  availableInBuilder: boolean;
  availableInPlayer: boolean;
  availableInLogs?: boolean; // Can this appear in logged data?
}

export const DISTANCE_TARGET_SCHEMES: DistanceTargetScheme[] = [
  { type: DistanceTargetType.exact, labelKey: 'distanceSchemes.exact', isNumeric: true, availableInBuilder: true, availableInPlayer: true, availableInLogs: true },
  { type: DistanceTargetType.range, labelKey: 'distanceSchemes.range', isNumeric: true, availableInBuilder: true, availableInPlayer: false, availableInLogs: false },
];

export type DistanceTarget =
  | { type: DistanceTargetType.exact; value: number }
  | { type: DistanceTargetType.range; min: number; max: number };

// ===================================================================
// 5. REST (New)
// ===================================================================
export enum RestTargetType {
    "exact" = "exact", // e.g., "Rest 90s"
    "range" = "range"  // e.g., "Rest 60-90s"
}

// +++ NEW: Metadata for Rest +++
export interface RestTargetScheme {
  type: RestTargetType;
  labelKey: string;
  isNumeric: boolean;
  availableInBuilder: boolean;
  availableInPlayer: boolean;
  availableInLogs?: boolean; // Can this appear in logged data?
}

export const REST_TARGET_SCHEMES: RestTargetScheme[] = [
  { type: RestTargetType.exact, labelKey: 'restSchemes.exact', isNumeric: true, availableInBuilder: true, availableInPlayer: true, availableInLogs: true },
  { type: RestTargetType.range, labelKey: 'restSchemes.range', isNumeric: true, availableInBuilder: true, availableInPlayer: false, availableInLogs: false },
];

export type RestTarget =
  | { type: RestTargetType.exact; seconds: number }
  | { type: RestTargetType.range; minSeconds: number; maxSeconds: number };

export interface ExerciseTargetSetParams {
  id: string;
  fieldOrder: METRIC[];
  targetTempo?: string;
  notes?: string;
  type: 'standard' | 'warmup' | 'amrap' | 'dropset' | 'failure' | 'myorep' | 'restpause' | 'custom' | 'superset' | 'tabata' | string; // More flexible
  _uiIsCompleted?: boolean;
  _uiActualReps?: number;
  _uiActualWeight?: number;
  _uiActualDuration?: number;
  // Add other specific fields if a type implies them, e.g.:
  targetRestMin?: number | null;
  targetRestMax?: number | null;
  targetRpe?: number | null; // Could be useful for 'failure' sets

  targetReps?: RepsTarget;
  targetWeight?: WeightTarget;
  targetDuration?: DurationTarget;
  targetDistance?: DistanceTarget;
  targetRest?: RestTarget;

  dropToWeight?: number | null; // For 'dropset'
  amrapTimeLimit?: number | null; // For AMRAP if it's time-bound rather than rep-bound
}

export interface ExerciseCurrentExecutionSetParams {
  id: string;
  tempoLogged?: string;
  notes?: string;
  type: 'standard' | 'warmup' | 'amrap' | 'dropset' | 'failure' | 'myorep' | 'restpause' | 'custom' | 'superset' | 'tabata' | string; // More flexible
  actualRest?: RestTarget;
  actualReps?: RepsTarget;
  actualWeight?: WeightTarget;
  actualDuration?: DurationTarget;
  actualDistance: DistanceTarget;
}

export interface ExerciseTargetExecutionSetParams {
  id: string;
  tempo?: string;
  notes?: string;
  type: 'standard' | 'warmup' | 'amrap' | 'dropset' | 'failure' | 'myorep' | 'restpause' | 'custom' | 'superset' | 'tabata' | string; // More flexible
  targetReps?: RepsTarget;
  targetWeight?: WeightTarget;
  targetDuration?: DurationTarget;
  targetDistance?: DistanceTarget;
  targetRest?: RestTarget;
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

  // `lastPerformed` was on WorkoutExercise, but it's usually a Routine-level or global exercise stat.
  // Keeping it here for now if your current logic uses it, but consider if it's truly per WorkoutExercise instance.
  lastPerformed?: Date;

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
  categories?: EXERCISE_CATEGORY_TYPES[];
  section?: WorkoutSectionType | undefined
}

export enum METRIC {
  weight = "weight",
  reps = "reps",
  duration = "duration",
  distance = "distance",
  tempo = "tempo",
  rest = "rest"
}

export interface LoggedRoutine extends Routine {
  workoutLogId: string; // Required for logged routines to link back to WorkoutLog
  // Add other log-specific fields if needed, e.g., date?: string;
}

export interface Routine {
  id: string;
  name: string;
  description?: string;
  exercises: WorkoutExercise[]; // This list will be ordered, and superset exercises will be contiguous
  estimatedDuration?: number;
  lastPerformed?: string;
  goal?: 'hypertrophy' | 'strength' | 'muscular endurance' | 'tabata' | 'cardiovascular endurance' | 'fat loss / body composition' | 'mobility & flexibility' | 'power / explosiveness' | 'speed & agility' | 'balance & coordination' | 'skill acquisition' | 'rehabilitation / injury prevention' | 'mental health / stress relief' | 'general health & longevity' | 'sport-specific performance' | 'maintenance' | 'rest' | 'custom';
  targetMuscleGroups?: MuscleValue[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  isHidden?: boolean;
  isFavourite?: boolean;
  isDisabled?: boolean;
  cardColor?: string;
  // === NEW CATEGORY FIELDS ===
  primaryCategory?: string;
  secondaryCategory?: string; // For sub-categories, or even a different categorization axis
  tags?: string[]; // A flexible way to add specific labels like "Bodyweight", "HIIT", "Dumbbells", "Yoga" etc.
  // ==========================
  sections?: WorkoutSection[];
}


export interface ActiveSetInfo {
  exerciseIndex: number;
  exerciseId?: string;
  setIndex: number;
  setId?: string;
  supersetId: string | null; // If part of a superset, this is the superset ID
  superSetType: 'standard' | 'emom' | null; // Type of the superset if applicable
  exerciseData: WorkoutExercise; // This WorkoutExercise will have sessionStatus
  setData: ExerciseTargetSetParams;
  baseExerciseInfo?: Exercise;
  isCompleted: boolean;
  actualReps?: RepsTarget;
  actualWeight?: WeightTarget;
  actualDuration?: DurationTarget;
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
  performanceInputValues?: { [key: string]: Partial<ExerciseCurrentExecutionSetParams> }
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


  // A new union type to make the generic function type-safe
export type AnyTarget = RepsTarget | WeightTarget | DurationTarget | DistanceTarget | RestTarget;
export type AnyScheme = RepsTargetScheme | WeightTargetScheme | DurationTargetScheme | DistanceTargetScheme | RestTargetScheme;
export type AnyTargetType = RepsTargetType | WeightTargetType | DurationTargetType | DistanceTargetType | RestTargetType;