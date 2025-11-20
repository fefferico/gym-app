import { WorkoutSectionType } from "./workout-section-type.model";
import { WorkoutExercise } from "./workout.model";

/**
 * Defines a structural section of the workout (e.g., Warm-up, Cool-down).
 */
export interface WorkoutSection {
  // Unique ID for the section within a workout (e.g., 'S1-WarmUp')
  id: string;
  // Use the Enum for strict typing of the section type
  type: WorkoutSectionType;
  // Property for tracking the translated section title
  titleI18nKey: string;
  // Optional longer description
  descriptionI18nKey?: string;

  // The core feature: an array of exercises contained within this section
  exercises: WorkoutExercise[];
}