export enum WorkoutSectionType {
  NONE = 'None',
  WARM_UP = 'WarmUp',
  MAIN_LIFT = 'MainLift',
  CARDIO = 'Cardio',
  FINISHER = 'Finisher',
  COOL_DOWN = 'CoolDown',
}

export const WORKOUT_SECTION_TYPE_ORDER: Record<WorkoutSectionType, number> = {
  [WorkoutSectionType.WARM_UP]: 0,
  [WorkoutSectionType.MAIN_LIFT]: 1,
  [WorkoutSectionType.FINISHER]: 2,
  [WorkoutSectionType.COOL_DOWN]: 3,
  [WorkoutSectionType.NONE]: 99,
  [WorkoutSectionType.CARDIO]: 99,
};