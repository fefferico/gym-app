export interface ExerciseCategory {
  id: EXERCISE_CATEGORY_TYPES;   // A unique, stable identifier (e.g., "strengthTraining")
  name: string; // The translation key (e.g., "categories.strengthTraining")
}

export enum EXERCISE_CATEGORY_TYPES {
  "bodyweightCalisthenics" = "bodyweightCalisthenics",
  "rehabilitationMobility" = "rehabilitationMobility",
  "yogaPilates" = "yogaPilates",
  "powerlifting" = "powerlifting",
  "olympicWeightlifting" = "olympicWeightlifting",
  "crossfit" = "crossfit",
  "dumbbells" = "dumbbells",
  "kettlebells" = "kettlebells",
  "strength" = "strength",
  "barbells" = "barbells",
  "machines" = "machines",
  "cables" = "cables",
  "bands" = "bands",
  "cardio" = "cardio",
  "stretching" = "stretching",
  "plyometrics" = "plyometrics",
  "strongman" = "strongman",
  "custom" = "custom",
  "other" = "other",
}