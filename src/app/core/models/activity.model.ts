// src/app/core/models/activity.model.ts

/**
 * Defines the categories for various physical activities.
 */
export const ACTIVITY_CATEGORIES = [
  { key: 'teamSports', label: 'Team Sports' },
  { key: 'individualSports', label: 'Individual Sports' },
  { key: 'outdoorAdventure', label: 'Outdoor & Adventure' },
  { key: 'fitnessClasses', label: 'Fitness & Classes' },
  { key: 'mindBody', label: 'Mind & Body' },
  { key: 'recreationalLeisure', label: 'Recreational & Leisure' },
  { key: 'homeLifestyle', label: 'Home & Lifestyle' },
  { key: 'other', label: 'Other' }
] as const;

export type ActivityCategoryKey = typeof ACTIVITY_CATEGORIES[number]['key'];
export type ActivityCategoryLabel = typeof ACTIVITY_CATEGORIES[number]['label'];

export type IntensityLevel = 'Low' | 'Medium' | 'High';

/**
 * Defines which metrics are typically tracked for an activity.
 * This helps the UI know which input fields to show the user.
 */
export interface TrackingMetrics {
  duration: boolean;
  distance: boolean;
  calories: boolean;
  notes: boolean;
}

/**
 * Represents a general physical activity that can be logged by the user.
 */
export interface Activity {
  /** A unique, human-readable identifier (e.g., 'football', 'hatha-yoga'). */
  id: string;

  /** The display name of the activity (e.g., "Football", "Hatha Yoga"). */
  name: string;

  /** A brief description of the activity. */
  description: string;

  /** The category the activity belongs to. */
  categoryKey: ActivityCategoryKey;
  category: ActivityCategoryLabel;

  /** The name of an icon to represent the activity in the UI. */
  iconName: string;

  /** The typical intensity level, which can be used as a default for calorie calculation. */
  intensity: IntensityLevel;

  /** Defines the default metrics to be tracked when logging this activity. */
  defaultTrackingMetrics: TrackingMetrics;
}