// src/app/core/models/activity-log.model.ts

import { IntensityLevel } from './activity.model';

/**
 * Represents a single, completed instance of a physical activity logged by the user.
 */
export interface ActivityLog {
  id: string;
  activityId: string;
  activityName: string; // Denormalized for easy display
  date: string; // ISO format: YYYY-MM-DD
  startTime: number; // Timestamp (milliseconds since epoch)
  
  endTime?: number; // Optional timestamp for the end time
  
  durationMinutes: number; // This will now be calculated
  intensity: 'Low' | 'Medium' | 'High';
  distanceKm?: number;
  locationId?: string;
  locationName?: string;
  caloriesBurned?: number;
  notes?: string;
  people?: string[];
}