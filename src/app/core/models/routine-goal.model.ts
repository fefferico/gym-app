export type RoutineGoalValue =
  | 'hypertrophy'
  | 'strength'
  | 'tabata'
  | 'muscularEndurance'
  | 'cardiovascular Endurance'
  | 'fatLossBodyComposition'
  | 'mobilityFlexibility'
  | 'powerExplosiveness'
  | 'speedAgility'
  | 'balanceCoordination'
  | 'skillAcquisition'
  | 'rehabilitationInjuryPrevention'
  | 'mentalHealthStressRelief'
  | 'generalHealthLongevity'
  | 'sportSpecificPerformance'
  | 'maintenance'
  | 'rest'
  | 'custom';

export interface RoutineGoal {
  value: RoutineGoalValue;
  label: string;
}