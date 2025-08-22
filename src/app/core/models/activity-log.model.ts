// src/app/core/models/activity-log.model.ts

import { IntensityLevel } from './activity.model';

/**
 * Represents a single, completed instance of a physical activity logged by the user.
 */
export interface ActivityLog {
  /** A unique UUID for this specific log entry. */
  id: string;

  /** The ID of the base Activity that was performed (e.g., 'football'). */
  activityId: string;

  /** Denormalized name of the activity for easier display in lists and history. */
  activityName: string;

  /** The date the activity was performed (ISO string: YYYY-MM-DD). */
  date: string;

  /** Timestamp (milliseconds since epoch) of when the activity started. */
  startTime: number;

  /** Timestamp (milliseconds since epoch) of when the activity ended. */
  endTime?: number;

  /** The total duration of the activity in minutes. */
  durationMinutes: number;

  /** Optional: The total distance covered in kilometers. */
  distanceKm?: number;

  /** Optional: The estimated number of calories burned. */
  caloriesBurned?: number;

  /** The user's perceived intensity for this specific session. */
  intensity: IntensityLevel;

  /** Any user-specific notes about this activity session. */
  notes?: string;
}