// src/app/core/models/training-program.model.ts

/**
 * Defines a specific day within a training program's schedule.
 */
export interface ScheduledRoutineDay {
  /** A unique ID for this scheduled day entry, useful if you need to edit/delete individual schedule days. */
  id: string;
  /**
   * Day of the week (0 for Sunday, 1 for Monday, ..., 6 for Saturday).
   * Or, if using a custom cycle (e.g., "Day 1", "Day 2"), this could be the cycle day number.
   */
  dayOfWeek: number;
  /** ID of the Routine to be performed on this day. */
  routineId: string;
  /** Denormalized routine name for easier display. Should be updated if the source routine name changes. */
  routineName?: string;
  /** Specific notes or instructions for this day within the program (e.g., "Focus on form", "Go heavy"). */
  notes?: string;
  /** Optional: Specific time of day suggestion, e.g., "AM" or "PM" or "08:00" */
  timeOfDay?: string;
}

/**
 * Represents a structured training program or plan that a user can follow.
 */
export interface TrainingProgram {
  /** Unique identifier for the training program. */
  id: string;
  /** User-defined name for the training program (e.g., "Starting Strength", "My 5-Day Split"). */
  name: string;
  /** Optional detailed description of the program, its goals, or methodology. */
  description?: string;
  /**
   * The schedule of routines, defining which routine is planned for which day.
   * The order in this array might also imply a sequence if not strictly tied to dayOfWeek.
   */
  schedule: ScheduledRoutineDay[];
  /** Indicates if this is the program the user is currently actively following. Only one program can be active at a time. */
  isActive: boolean;
  /** Optional: The date (ISO string YYYY-MM-DD) when the user started or intends to start this program. */
  startDate?: string;
  /**
   * Optional: Defines the length of the program's cycle in days if it's not a standard 7-day week.
   * For example, a 3-day on, 1-day off cycle might have a cycleLength of 4.
   * If undefined, a 7-day weekly cycle is assumed.
   */
  cycleLength?: number;
  /** Optional: General notes for the entire program. */
  programNotes?: string;
}