// src/app/core/models/training-program.model.ts

/**
 * Defines a specific day within a training program's schedule.
 */
export interface ScheduledRoutineDay {
  /** A unique ID for this scheduled day entry. */
  id: string;
  /**
   * The day number within the program's cycle this routine falls on.
   * - For weekly programs (cycleLength=7 or null): 0 is Sunday, 1 is Monday, ..., 6 is Saturday.
   * - For N-day cycles: 1 is Day 1, 2 is Day 2, etc., up to the cycleLength.
   */
  dayOfWeek: number;
  /** ID of the Routine to be performed on this day. */
  routineId: string;
  /** ID of the Program this schedule entry belongs to. */
  programId: string;
  programName?: string;
  /** Denormalized routine name for easier display. */
  routineName?: string;
  /** Specific notes for this day within the program. */
  notes?: string;
  /** Optional: Specific time of day suggestion, e.g., "AM" or "PM". */
  timeOfDay?: string;
  isUnscheduled?: boolean;

  // +++ NEW PROPERTIES FOR TRACKING STATE +++
  /** The completion status of this specific scheduled day. */
  completionStatus?: 'pending' | 'completed' | 'skipped';
  /** The ISO date (YYYY-MM-DD) on which this was completed. */
  completedOnDate?: string;
  /** The ID of the WorkoutLog that fulfilled this scheduled day. */
  workoutLogId?: string;
  iterationId?: string | undefined; // ID of the program iteration
}

/**
 * Represents a structured training program or plan.
 */
export interface TrainingProgram {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  /** The date (ISO string YYYY-MM-DD) when the user started or intends to start this program. */
  startDate?: string;
  /**
   * --- KEY CHANGE ---
   * The total duration of the program's micro-cycle in days, including rest days.
   * Example: An Upper/Lower split (Upper, Rest, Lower, Rest) has a cycleLength of 4.
   * If null, empty, or 7, a standard 7-day weekly cycle is assumed.
   */
  cycleLength?: number;
  programNotes?: string;
  goals?: string[];
  history?: TrainingProgramHistoryEntry[];
  programType: 'cycled' | 'linear';
  /** 
     * For 'cycled' programs: The schedule of the repeating cycle.
     * This property will be used if programType is 'cycled'.
     */
  schedule: ScheduledRoutineDay[];

  /**
   * NEW: For 'linear' programs: An array of weekly blocks.
   * This property will be used if programType is 'linear'.
   */
  weeks?: ProgramWeek[];
  iterationId?: string | undefined; // id of current TrainingProgramHistoryEntry
}

export interface TrainingProgramHistoryEntry {
  id: string;
  programId: string;
  /** The date when this history entry was logged. */
  date: string; // ISO string YYYY-MM-DD
  startDate: string; // ISO string YYYY-MM-DD
  endDate: string; // ISO string YYYY-MM-DD
  status: 'active' | 'completed' | 'archived' | 'cancelled';
}

export interface ProgramWeek {
  /** A unique ID for this week entry. */
  id: string;
  /** The sequential number of the week in the program (e.g., 1, 2, 3). */
  weekNumber: number;
  /** A customizable name for the week, e.g., "Volume Accumulation" or "Week 1". */
  name: string;
  /** The schedule of routines for this specific week. */
  schedule: ScheduledRoutineDay[];
}

/**
 * A generic interface to describe the day of a program that a log corresponds to.
 */
export interface ProgramDayInfo {
  /**
   * The numeric representation of the day.
   * - For weekly/linear programs: 0 for Sunday, 1 for Monday, etc.
   * - For n-day cycles: 1 for Day 1, 2 for Day 2, etc.
   */
  dayNumber: number;

  /**
   * A user-friendly display name for the day.
   * - e.g., "Wednesday" for weekly/linear programs.
   * - e.g., "Day 3" for n-day cycles.
   */
  dayName: string;
}