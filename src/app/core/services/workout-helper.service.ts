// src/app/core/services/workout-helper.service.ts

import { DistanceTarget, DistanceTargetType, DurationTarget, DurationTargetType, ExerciseTargetSetParams, METRIC, RepsTarget, RepsTargetType, RestTarget, RestTargetType, WeightTarget, WeightTargetType } from '../models/workout.model';

export function formatRepsTarget(reps: RepsTarget | null | undefined): string {
  if (!reps) {
    return '--';
  }

  switch (reps.type) {
    case RepsTargetType.exact:
      return reps.value.toString();
    case RepsTargetType.range:
      return `${reps.min}-${reps.max}`;
    case RepsTargetType.max:
      return 'Max';
    case RepsTargetType.min_plus:
      return reps.value.toString();
    case RepsTargetType.amrap:
      return 'AMRAP';
    case RepsTargetType.max_fraction:
      return `Max / ${reps.divisor}`;
    default:
      // This helps catch any unhandled cases at compile time
      const _exhaustiveCheck: never = reps;
      return '--';
  }
}

/**
* --- NEW HELPER FUNCTION ---
* Migrates legacy rep properties (targetReps, targetRepsMin/Max) on a set
* to the new structured `targetRepsNew` property if it doesn't already exist.
* This function mutates the set object for efficiency.
* @param set The set object to migrate.
*/
export function migrateSetRepsToRepsTarget(set: Partial<any>): void {
  // Only perform migration if the new structure isn't already present.
  if (set['targetRepsNew']) {
    return;
  }

  // Priority 1: Handle a defined range.
  if (typeof set['targetRepsMin'] === 'number' && typeof set['targetRepsMax'] === 'number' && set['targetRepsMin'] > 0 && set['targetRepsMax'] > 0) {
    set['targetReps'] = {
      type: RepsTargetType.range,
      min: set['targetRepsMin'],
      max: set['targetRepsMax']
    };
  }
  // Priority 2: Handle a single exact value.
  else if (typeof set['targetReps'] === 'number' && set['targetReps'] > 0) {
    set['targetReps'] = {
      type: RepsTargetType.exact,
      value: set['targetReps']
    };
  }
  cleanLegacySetProperties(set, METRIC.reps);
}

/**
* Migrates legacy weight properties (targetWeight, targetWeightMin/Max) on a set
* to the new structured `targetWeightNew` property if it doesn't already exist.
* This function mutates the set object for efficiency.
* @param set The set object to migrate.
*/
export function migrateSetWeightToWeightTarget(set: Partial<any>): void {
  // Only perform migration if the new structure isn't already present.
  if (set['targetWeightNew']) {
    return;
  }

  // Helper to get a valid number from number or string
  const getValidNumber = (val: any): number | null => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const min = getValidNumber(set['targetWeightMin']);
  const max = getValidNumber(set['targetWeightMax']);

  // Priority 1: Handle a defined range.
  if (min !== null && max !== null && min > 0 && max > 0) {
    set['targetWeight'] = {
      type: WeightTargetType.range,
      min: min,
      max: max
    };
  }
  // Priority 2: Handle a single exact value.
  else {
    const exact = getValidNumber(set['targetWeight']);
    if (exact !== null) {
      if (exact === 0) {
        // Treat 0 as bodyweight
        set['targetWeight'] = {
          type: WeightTargetType.bodyweight
        };
      } else if (exact > 0) {
        set['targetWeight'] = {
          type: WeightTargetType.exact,
          value: exact
        };
      }
      // If exact < 0, do nothing (invalid)
    }
  }
  cleanLegacySetProperties(set, METRIC.weight);
}

/**
* Migrates legacy duration properties (targetDuration, targetDurationMin/Max) on a set
* to the new structured `targetDurationNew` property if it doesn't already exist.
* This function mutates the set object for efficiency.
* @param set The set object to migrate.
*/
export function migrateSetDurationToDurationTarget(set: Partial<any>): void {
  // Only perform migration if the new structure isn't already present.
  if (set['targetDurationNew']) {
    return;
  }

  // Helper to get a valid number from number or string
  const getValidNumber = (val: any): number | null => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const min = getValidNumber(set['targetDurationMin']);
  const max = getValidNumber(set['targetDurationMax']);

  // Priority 1: Handle a defined range.
  if (min !== null && max !== null && min > 0 && max > 0) {
    set['targetDuration'] = {
      type: DurationTargetType.range,
      minSeconds: min,
      maxSeconds: max
    };
  }
  // Priority 2: Handle a single exact value.
  else {
    const exact = getValidNumber(set['targetDuration']);
    if (exact !== null && exact > 0) {
      set['targetDuration'] = {
        type: DurationTargetType.exact,
        seconds: exact
      };
    }
  }
  cleanLegacySetProperties(set, METRIC.duration);
}

/**
* Migrates legacy distance properties (targetDistance, targetDistanceMin/Max) on a set
* to the new structured `targetDistanceNew` property if it doesn't already exist.
* This function mutates the set object for efficiency.
* @param set The set object to migrate.
*/
export function migrateSetDistanceToDistanceTarget(set: Partial<any>): void {
  // Only perform migration if the new structure isn't already present.
  if (set['targetDistanceNew']) {
    return;
  }

  // Helper to get a valid number from number or string
  const getValidNumber = (val: any): number | null => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const min = getValidNumber(set['targetDistanceMin']);
  const max = getValidNumber(set['targetDistanceMax']);

  // Priority 1: Handle a defined range.
  if (min !== null && max !== null && min > 0 && max > 0) {
    set['targetDistance'] = {
      type: DistanceTargetType.range,
      min: min,
      max: max
    };
  }
  // Priority 2: Handle a single exact value.
  else {
    const exact = getValidNumber(set['targetDistance']);
    if (exact !== null && exact > 0) {
      set['targetDistance'] = {
        type: DistanceTargetType.exact,
        value: exact
      };
    }
  }

  cleanLegacySetProperties(set, METRIC.distance);
}

/**
* Migrates legacy rest properties (targetRest, targetRestMin/Max) on a set
* to the new structured `targetRestNew` property if it doesn't already exist.
* This function mutates the set object for efficiency.
* @param set The set object to migrate.
*/
export function migrateSetRestToRestTarget(set: Partial<any>): void {
  // Only perform migration if the new structure isn't already present.
  if (set['targetRestNew']) {
    return;
  }

  // Helper to get a valid number from number or string
  const getValidNumber = (val: any): number | null => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  const min = getValidNumber(set['targetRestMin']);
  const max = getValidNumber(set['targetRestMax']);

  // Priority 1: Handle a defined range.
  if (min !== null && max !== null && min > 0 && max > 0) {
    set['targetRest'] = {
      type: RestTargetType.range,
      minSeconds: min,
      maxSeconds: max
    };
  }
  // Priority 2: Handle a single exact value.
  else {
    const exact = getValidNumber(set['targetRest']);
    if (exact !== null && exact > 0) {
      set['targetRest'] = {
        type: RestTargetType.exact,
        seconds: exact
      };
    }
  }
  cleanLegacySetProperties(set, METRIC.rest);
}


export function genRepsTypeFromRepsNumber(reps: number | undefined | null, type?: RepsTargetType): RepsTarget {
  if (!reps) {
    return { type: RepsTargetType.exact, value: 0 };
  }

  if (!type) {
    return { type: RepsTargetType.exact, value: reps };
  }
  switch (type) {
    case RepsTargetType.range: {
      return { type: RepsTargetType.range, min: reps, max: reps + 1 };
      break;
    }
  }
  return { type: RepsTargetType.exact, value: reps };
}

/**
 * Calculates a single numeric value for a RepsTarget to be used in comparisons.
 * - For 'exact', it's the value.
 * - For 'range', it's the average of min and max.
 * - For non-numeric types like 'amrap', it's Infinity.
 * @param reps The RepsTarget to evaluate.
 * @returns A single number for comparison.
 */
export function getRepsValue(reps: RepsTarget | undefined): number {
  if (!reps) {
    return 0;
  }
  switch (reps.type) {
    case RepsTargetType.exact:
      return reps.value;
    case RepsTargetType.range:
      // The average of the range provides a good center-point for comparison.
      return (reps.min + reps.max) / 2;
    // Non-numeric targets are considered infinitely high for sorting/comparison.
    case RepsTargetType.amrap:
    case RepsTargetType.max:
    case RepsTargetType.min_plus:
    case RepsTargetType.max_fraction:
      return Infinity;
    default:
      // Should not happen with exhaustive type checking.
      const _exhaustiveCheck: never = reps;
      return -Infinity;
  }
}

/**
 * Compares two RepsTarget objects to determine which is "greater".
 * Useful for sorting or checking for progression.
 *
 * @param repsA The first RepsTarget.
 * @param repsB The second RepsTarget.
 * @returns -1 if A < B, 1 if A > B, and 0 if they are equal.
 */
export function compareRepsTargets(repsA: RepsTarget | null | undefined, repsB: RepsTarget | null | undefined): number {
  // --- Step 1: Handle null or undefined inputs ---
  const aExists = repsA != null;
  const bExists = repsB != null;

  if (!aExists && !bExists) return 0; // Both are null, so they are equal.
  if (!aExists) return -1;             // A is null, B is not, so A is "less than" B.
  if (!bExists) return 1;              // B is null, A is not, so A is "greater than" B.

  // --- Step 2: Compare their representative numeric values ---
  const valA = getRepsValue(repsA);
  const valB = getRepsValue(repsB);

  if (valA < valB) return -1;
  if (valA > valB) return 1;

  // --- Step 3: Apply Tie-Breaker Logic ---
  // If representative values are equal (e.g., 'exact' 10 vs 'range' 8-12),
  // we can consider the range to be "greater" as it offers more potential.
  if (repsA.type === RepsTargetType.range && repsB.type === RepsTargetType.exact) {
    return 1; // A is greater
  }
  if (repsA.type === RepsTargetType.exact && repsB.type === RepsTargetType.range) {
    return -1; // B is greater
  }

  // If they are the same type with the same representative value, they are equal.
  return 0;
}

export function repsToExact(reps: number): RepsTarget {
  const defaultObj = { type: RepsTargetType.exact, value: reps } as RepsTarget;
  return defaultObj;
}

export function repsTargetToExactRepsTarget(originalTarget: RepsTarget | undefined | null): RepsTarget {
  const defaultObj = { type: RepsTargetType.exact, value: 0 } as RepsTarget;
  if (!originalTarget) {
    return defaultObj;
  }

  switch (originalTarget.type) {
    case RepsTargetType.exact: {
      return { type: RepsTargetType.exact, value: originalTarget.value } as RepsTarget;
      break;
    }
    case RepsTargetType.range: {
      return { type: RepsTargetType.exact, value: Math.round((originalTarget.min + originalTarget.max) / 2) } as RepsTarget;
      break;
    }
    default:
      return defaultObj;
  }
}

export function repsTypeToReps(repsTarget: RepsTarget | undefined | null): number {
  const defaultObj = { type: RepsTargetType.exact, value: 0 } as RepsTarget;
  if (!repsTarget) {
    return 0;
  }

  switch (repsTarget.type) {
    case RepsTargetType.exact: {
      return repsTarget.value;
      break;
    }
    case RepsTargetType.range: {
      return repsTarget.min
      break;
    }
    case RepsTargetType.min_plus: {
      return repsTarget.value
      break;
    }
    default:
      return 0;
  }
}

export function repsNumberToExactRepsTarget(reps: number | undefined | null): RepsTarget {
  const defaultObj = { type: RepsTargetType.exact, value: 0 } as RepsTarget;
  if (!reps) {
    return defaultObj;
  }
  if (defaultObj.type === RepsTargetType.exact) {
    defaultObj.value = reps;
  }

  return defaultObj;
}

export function repsTargetAsString(target: RepsTarget | undefined | null): string {
  if (!target) return '';
  switch (target.type) {
    case RepsTargetType.exact:
      return target.value.toString();
    case RepsTargetType.range:
      return `${target.min}-${target.max}`;
    case RepsTargetType.amrap:
      return 'AMRAP';
    case RepsTargetType.max:
      return 'MAX';
    case RepsTargetType.max_fraction:
      return `1/${target.divisor} MAX`;
    case RepsTargetType.min_plus: // Handle the new type
      return `${target.value}+`;
    default:
      return '';
  }
}

// ===================================================================
// WEIGHT (New Functions)
// ===================================================================

/**
 * Calculates a single numeric value for a WeightTarget to be used in comparisons.
 * @param weight The WeightTarget to evaluate.
 * @returns A single number in KG for comparison.
 */
export function getWeightValue(weight: WeightTarget | undefined): number {
  if (!weight) {
    return 0;
  }
  switch (weight.type) {
    case WeightTargetType.exact:
      return weight.value;
    case WeightTargetType.range:
      // The average of the range provides a good center-point.
      return (weight.min + weight.max) / 2;
    // Non-numeric or variable targets are considered "less" than a fixed weight for sorting purposes.
    case WeightTargetType.bodyweight:
      return 0; // Treat bodyweight as 0 for comparison against loaded weights.
    case WeightTargetType.percentage_1rm:
      // This is variable and depends on an external value (1RM), so we treat it as less defined.
      // You could implement logic to calculate the actual weight if 1RM is available.
      return -1;
    // case WeightTargetType.rm1:
    //   // This is variable and depends on an external value (1RM), so we treat it as less defined.
    //   // You could implement logic to calculate the actual weight if 1RM is available.
    //   return -1; 
    // case WeightTargetType.rm3:
    //   // This is variable and depends on an external value (1RM), so we treat it as less defined.
    //   // You could implement logic to calculate the actual weight if 1RM is available.
    //   return -1; 
    // case WeightTargetType.rm5:
    //   // This is variable and depends on an external value (1RM), so we treat it as less defined.
    //   // You could implement logic to calculate the actual weight if 1RM is available.
    //   return -1; 
    default:
      const _exhaustiveCheck: never = weight;
      return -Infinity;
  }
}

/**
 * Compares two WeightTarget objects to determine which is "greater" (heavier).
 * @param weightA The first WeightTarget.
 * @param weightB The second WeightTarget.
 * @returns -1 if A < B, 1 if A > B, and 0 if they are equal.
 */
export function compareWeightTargets(weightA: WeightTarget | null | undefined, weightB: WeightTarget | null | undefined): number {
  const aExists = weightA != null;
  const bExists = weightB != null;

  if (!aExists && !bExists) return 0;
  if (!aExists) return -1;
  if (!bExists) return 1;

  const valA = getWeightValue(weightA);
  const valB = getWeightValue(weightB);

  if (valA < valB) return -1;
  if (valA > valB) return 1;

  // Tie-breaker: A range is considered "greater" than an exact value if averages are equal.
  if (weightA.type === WeightTargetType.range && weightB.type === WeightTargetType.exact) return 1;
  if (weightA.type === WeightTargetType.exact && weightB.type === WeightTargetType.range) return -1;

  return 0;
}

export function weightToExact(weight: number | undefined): WeightTarget {
  const defaultObj = { type: WeightTargetType.exact, value: weight || 1 } as WeightTarget;
  return defaultObj;
}

export function weightToBodyweight(): WeightTarget {
  const defaultObj = { type: WeightTargetType.bodyweight } as WeightTarget;
  return defaultObj;
}

/**
  * Formats a WeightTarget object into a user-friendly string for display.
  * Note: This function does NOT add units (kg/lbs); the calling component should do that.
  * @param target The WeightTarget object.
  * @returns A string like "100", "80-90", "Bodyweight", or "85% 1RM".
  */
export function weightTargetAsString(target: WeightTarget | undefined | null): string {
  if (!target) {
    return '';
  }
  switch (target.type) {
    case WeightTargetType.exact:
      return target.value.toString();
    case WeightTargetType.range:
      return `${target.min}-${target.max}`;
    case WeightTargetType.bodyweight:
      // Assumes you have a translation key like: { "weightSchemes": { "bodyweight": "Bodyweight" } }
      return 'BW';
    case WeightTargetType.percentage_1rm:
      return `${target.percentage}% 1RM`;
    default:
      // This ensures if you add a new type, TypeScript will warn you if it's not handled here.
      const _exhaustiveCheck: never = target;
      return '';
  }
}


// ===================================================================
// DURATION (New Functions)
// ===================================================================

export function getDurationValue(duration: DurationTarget | undefined): number {
  if (!duration) {
    return 0;
  }
  switch (duration.type) {
    case DurationTargetType.exact:
      return duration.seconds;
    case DurationTargetType.range:
      return (duration.minSeconds + duration.maxSeconds) / 2;
    case DurationTargetType.to_failure:
      return Infinity; // 'To Failure' is considered the maximum possible duration.
    default:
      const _exhaustiveCheck: never = duration;
      return -Infinity;
  }
}

export function compareDurationTargets(durationA: DurationTarget | null | undefined, durationB: DurationTarget | null | undefined): number {
  const aExists = durationA != null;
  const bExists = durationB != null;

  if (!aExists && !bExists) return 0;
  if (!aExists) return -1;
  if (!bExists) return 1;

  const valA = getDurationValue(durationA);
  const valB = getDurationValue(durationB);

  if (valA < valB) return -1;
  if (valA > valB) return 1;

  if (durationA.type === DurationTargetType.range && durationB.type === DurationTargetType.exact) return 1;
  if (durationA.type === DurationTargetType.exact && durationB.type === DurationTargetType.range) return -1;

  return 0;
}

export function genDurationTypeFromDurationNumber(seconds: number | undefined | null, type?: DurationTargetType): DurationTarget {
  if (!seconds) {
    return { type: DurationTargetType.exact, seconds: 0 };
  }

  if (!type) {
    return { type: DurationTargetType.exact, seconds: seconds };
  }
  switch (type) {
    case DurationTargetType.range: {
      return { type: DurationTargetType.range, minSeconds: seconds, maxSeconds: seconds + 1 };
      break;
    }
  }
  return { type: DurationTargetType.exact, seconds: seconds };
}


export function durationToExact(seconds: number | undefined): DurationTarget {
  const defaultObj = { type: DurationTargetType.exact, seconds: seconds || 1 } as DurationTarget;
  return defaultObj;
}

/**
  * Formats a DurationTarget object into a user-friendly string for display.
  * @param target The DurationTarget object.
  * @returns A string like "60", "45-60", or "To Failure".
  */
export function durationTargetAsString(target: DurationTarget | undefined | null): string {
  if (!target) {
    return '';
  }
  switch (target.type) {
    case DurationTargetType.exact:
      return target.seconds.toString();
    case DurationTargetType.range:
      return `${target.minSeconds}-${target.maxSeconds}`;
    case DurationTargetType.to_failure:
      // Assumes you have a translation key like: { "durationSchemes": { "toFailure": "To Failure" } }
      return 'TO FAILURE';
    default:
      const _exhaustiveCheck: never = target;
      return '';
  }
}

// ===================================================================
// DISTANCE (New Functions)
// ===================================================================

export function getDistanceValue(distance: DistanceTarget | undefined): number {
  if (!distance) {
    return 0;
  }
  switch (distance.type) {
    case DistanceTargetType.exact:
      return distance.value;
    case DistanceTargetType.range:
      return (distance.min + distance.max) / 2;
    default:
      const _exhaustiveCheck: never = distance;
      return -Infinity;
  }
}

export function compareDistanceTargets(distanceA: DistanceTarget | null | undefined, distanceB: DistanceTarget | null | undefined): number {
  const aExists = distanceA != null;
  const bExists = distanceB != null;

  if (!aExists && !bExists) return 0;
  if (!aExists) return -1;
  if (!bExists) return 1;

  const valA = getDistanceValue(distanceA);
  const valB = getDistanceValue(distanceB);

  if (valA < valB) return -1;
  if (valA > valB) return 1;

  if (distanceA.type === DistanceTargetType.range && distanceB.type === DistanceTargetType.exact) return 1;
  if (distanceA.type === DistanceTargetType.exact && distanceB.type === DistanceTargetType.range) return -1;

  return 0;
}

export function distanceToExact(value: number | undefined): DistanceTarget {
  const defaultObj = { type: DistanceTargetType.exact, value: value || 1 } as DistanceTarget;
  return defaultObj;
}

/**
   * Formats a DistanceTarget object into a user-friendly string for display.
   * Note: This function does NOT add units (km/mi); the calling component should do that.
   * @param target The DistanceTarget object.
   * @returns A string like "5" or "3-5".
   */
export function distanceTargetAsString(target: DistanceTarget | undefined | null): string {
  if (!target) {
    return '';
  }
  switch (target.type) {
    case DistanceTargetType.exact:
      return target.value.toString();
    case DistanceTargetType.range:
      return `${target.min}-${target.max}`;
    default:
      const _exhaustiveCheck: never = target;
      return '';
  }
}


// ===================================================================
// REST (New Functions)
// ===================================================================

export function getRestValue(rest: RestTarget | undefined): number {
  if (!rest) {
    return 0;
  }
  switch (rest.type) {
    case RestTargetType.exact:
      return rest.seconds;
    case RestTargetType.range:
      return (rest.minSeconds + rest.maxSeconds) / 2;
    default:
      const _exhaustiveCheck: never = rest;
      return -Infinity;
  }
}

export function compareRestTargets(restA: RestTarget | null | undefined, restB: RestTarget | null | undefined): number {
  const aExists = restA != null;
  const bExists = restB != null;

  if (!aExists && !bExists) return 0;
  if (!aExists) return -1; // Less rest is "less"
  if (!bExists) return 1;

  const valA = getRestValue(restA);
  const valB = getRestValue(restB);

  if (valA < valB) return -1;
  if (valA > valB) return 1;

  if (restA.type === RestTargetType.range && restB.type === RestTargetType.exact) return 1;
  if (restA.type === RestTargetType.exact && restB.type === RestTargetType.range) return -1;

  return 0;
}

export function restToExact(value: number): RestTarget {
  const defaultObj = { type: RestTargetType.exact, seconds: value } as RestTarget;
  return defaultObj;
}

/**
  * Formats a RestTarget object into a user-friendly string for display.
  * @param target The RestTarget object.
  * @returns A string like "90" or "60-90".
  */
export function restTargetAsString(target: RestTarget | undefined | null): string {
  if (!target) {
    return '';
  }
  switch (target.type) {
    case RestTargetType.exact:
      return target.seconds.toString();
    case RestTargetType.range:
      return `${target.minSeconds}-${target.maxSeconds}`;
    default:
      const _exhaustiveCheck: never = target;
      return '';
  }
}


// proper method for removing legacy properties from ExerciseTargetSetParams for specific METRIC
export function cleanLegacySetProperties(set: any, metric: METRIC): void {
  switch (metric) {
    case METRIC.reps: {
      delete set['targetRepsMin'];
      delete set['targetRepsMax'];
      break;
    }
    case METRIC.weight: {
      delete set['targetWeightMin'];
      delete set['targetWeightMax'];
      break;
    }
    case METRIC.duration: {
      delete set['targetDurationMin'];
      delete set['targetDurationMax'];
      break;
    }
    case METRIC.distance: {
      delete set['targetDistanceMin'];
      delete set['targetDistanceMax'];
      break;
    }
    case METRIC.rest: {
      delete set['targetRestMin'];
      delete set['targetRestMax'];
      break;
    }
  }
}
