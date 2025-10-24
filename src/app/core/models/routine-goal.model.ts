export type RoutineGoalValue =
  | 'hypertrophy'
  | 'strength'
  | 'tabata'
  | 'muscular endurance'
  | 'cardiovascular endurance'
  | 'fat loss / body composition'
  | 'mobility & flexibility'
  | 'power / explosiveness'
  | 'speed & agility'
  | 'balance & coordination'
  | 'skill acquisition'
  | 'rehabilitation / injury prevention'
  | 'mental health / stress relief'
  | 'general health & longevity'
  | 'sport-specific performance'
  | 'maintenance'
  | 'rest'
  | 'custom';

export interface RoutineGoal {
  value: RoutineGoalValue;
  label: string;
}