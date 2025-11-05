import { inject, Injectable, Injector } from '@angular/core';
import { METRIC, WeightTarget, RepsTarget, DurationTarget, DistanceTarget, RestTarget, WeightTargetType, RepsTargetType, DurationTargetType, DistanceTargetType, RestTargetType, ExerciseTargetSetParams, WorkoutExercise, Routine, AnyTarget, AnyTargetType, WEIGHT_TARGET_SCHEMES, REPS_TARGET_SCHEMES, DURATION_TARGET_SCHEMES, DISTANCE_TARGET_SCHEMES, REST_TARGET_SCHEMES, AnyScheme, LoggedRoutine } from '../models/workout.model';
import { UnitsService } from './units.service';
import { TranslateService } from '@ngx-translate/core';
import { LoggedSet } from '../models/workout-log.model';
import { Exercise } from '../models/exercise.model';
import { distanceToExact, durationToExact, repsToExact, restToExact, weightToExact } from './workout-helper.service';
import { AlertButton, AlertInput } from '../models/alert.model';
import { firstValueFrom } from 'rxjs';
import { AppSettingsService } from './app-settings.service';
import { ExerciseService } from './exercise.service';
import { AlertService } from './alert.service';
import { SubscriptionService } from './subscription.service';
import { ToastService } from './toast.service';
import { ProgressiveOverloadService } from './progressive-overload.service.ts';
import { mapLoggedWorkoutExerciseToWorkoutExercise } from '../models/workout-mapper';

@Injectable({
    providedIn: 'root'
})
export class WorkoutUtilsService {

    private unitsService = inject(UnitsService);
    private translate = inject(TranslateService);


    private appSettingsService = inject(AppSettingsService);
    private injector = inject(Injector);

    private _exerciseService: ExerciseService | undefined;
    private get exerciseService(): ExerciseService {
        if (!this._exerciseService) {
            this._exerciseService = this.injector.get(ExerciseService);
        }
        return this._exerciseService;
    }

    private alertService = inject(AlertService);
    protected subscriptionService = inject(SubscriptionService);
    private readonly ROUTINES_STORAGE_KEY = 'fitTrackPro_routines';
    private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';
    private readonly PAUSED_STATE_VERSION = '1.2';

    private toastService = inject(ToastService);
    private progressiveOverloadService = inject(ProgressiveOverloadService); // +++ INJECT THE SERVICE

    private formatMetricForLogged(target: any, metric: METRIC): string {
        switch (metric) {
            case METRIC.weight:
                if (target.type === WeightTargetType.bodyweight) return 'Bodyweight';
                if (target.type === WeightTargetType.exact) return `${target.value} kg`;
                if (target.type === WeightTargetType.percentage_1rm) return `${target.percentage}% 1RM`;
                if (target.type === WeightTargetType.range) return `${target.min}-${target.max} kg`;
                break;
            case METRIC.reps:
                if (target.type === RepsTargetType.exact) return `${target.value} reps`;
                if (target.type === RepsTargetType.range) return `${target.min}-${target.max} reps`;
                break;
            case METRIC.duration:
                if (target.type === DurationTargetType.exact) return `${target.seconds}s`;
                if (target.type === DurationTargetType.range) return `${target.minSeconds}-${target.maxSeconds}s`;
                break;
            case METRIC.distance:
                if (target.type === DistanceTargetType.exact) return `${target.value} m`;
                if (target.type === DistanceTargetType.range) return `${target.min}-${target.max} m`;
                break;
            case METRIC.rest:
                if (target.type === RestTargetType.exact) return `${target.seconds}s`;
                if (target.type === RestTargetType.range) return `${target.minSeconds}-${target.maxSeconds}s`;
                break;
            default:
                return target.value ? target.value.toString() : '-';
        }
        return '-';
    }


    formatMetricTarget(target: any, metric: METRIC, isLogMode: boolean = false): string {
        if (!target) return '-';
        if (isLogMode) {
            return this.formatMetricForLogged(target, metric);
        }
        switch (metric) {
            case METRIC.weight:
                if (target.type === WeightTargetType.bodyweight) return 'Bodyweight';
                if (target.type === WeightTargetType.exact) return `${target.value} kg`;
                if (target.type === WeightTargetType.percentage_1rm) return `${target.percentage}% 1RM`;
                if (target.type === WeightTargetType.range) return `${target.min}-${target.max} kg`;
                break;
            case METRIC.reps:
                if (target.type === RepsTargetType.exact) return `${target.value} reps`;
                if (target.type === RepsTargetType.range) return `${target.min}-${target.max} reps`;
                if (target.type === RepsTargetType.max) return 'Max reps';
                if (target.type === RepsTargetType.amrap) return 'AMRAP';
                break;
            case METRIC.duration:
                if (target.type === DurationTargetType.exact) return `${target.seconds}s`;
                if (target.type === DurationTargetType.range) return `${target.minSeconds}-${target.maxSeconds}s`;
                break;
            case METRIC.distance:
                if (target.type === DistanceTargetType.exact) return `${target.value} m`;
                if (target.type === DistanceTargetType.range) return `${target.min}-${target.max} m`;
                break;
            case METRIC.rest:
                if (target.type === RestTargetType.exact) return `${target.seconds}s`;
                if (target.type === RestTargetType.range) return `${target.minSeconds}-${target.maxSeconds}s`;
                break;
            default:
                return target.value ? target.value.toString() : '-';
        }
        return '-';
    }

    getRepsValue(target: RepsTarget | undefined): number | undefined {
        if (!target) return undefined;
        if (target && target.type === RepsTargetType.exact) return target.value;
        if (target && target.type === RepsTargetType.range) return Math.floor((target.min + target.max) / 2);
        return undefined;
    }

    // Add other utility functions here, e.g.:
    getWeightValue(target: WeightTarget | undefined): number | undefined {
        if (!target) return undefined;
        if (target && target.type === WeightTargetType.exact) return target.value;
        if (target && target.type === WeightTargetType.range) return Math.floor((target.min + target.max) / 2);
        return undefined;
    }

    getDurationValue(target: DurationTarget | undefined): number | undefined {
        if (!target) return undefined;
        if (target && target.type === DurationTargetType.exact) return target.seconds;
        // return the average value (floor)
        if (target && target.type === DurationTargetType.range) return Math.floor((target.minSeconds + target.maxSeconds) / 2);
        return undefined;
    }

    getRestValue(target: RestTarget | undefined): number | undefined {
        if (!target) return undefined;
        if (target && target.type === RestTargetType.exact) return target.seconds;
        // return the average value (floor)
        if (target && target.type === RestTargetType.range) return Math.floor((target.minSeconds + target.maxSeconds) / 2);
        return undefined;
    }

    getDistanceValue(target: DistanceTarget | undefined): number | undefined {
        if (!target) return undefined;
        if (target && target.type === DistanceTargetType.exact) return target.value;
        // return the average value (floor)
        if (target && target.type === DistanceTargetType.range) return Math.floor((target.min + target.max) / 2);
        return undefined;
    }

    /**
   * Generic method to check if a target object is visible for a given metric.
   * Delegates to the specific visibility helper for the metric.
   * @param target The target object (e.g., RepsTarget, WeightTarget).
   * @param metric The metric to check (e.g., METRIC.duration).
   * @returns True if the target is visible (has valid values based on its type).
   */
    isTargetVisible(target: any, metric: METRIC): boolean {
        switch (metric) {
            case METRIC.reps:
                return this.isRepsTargetVisible(target);
            case METRIC.weight:
                return this.isWeightTargetVisible(target);
            case METRIC.duration:
                return this.isDurationTargetVisible(target);
            case METRIC.distance:
                return this.isDistanceTargetVisible(target);
            case METRIC.rest:
                return this.isRestTargetVisible(target);
            default:
                return false;
        }
    }




    // Visibility helpers for metrics
    private isWeightTargetVisible(target: WeightTarget | undefined): boolean {
        if (!target || typeof target !== 'object' || !('type' in target)) return false;
        switch (target.type) {
            case WeightTargetType.exact:
                return typeof target.value === 'number' && target.value > 0;
            case WeightTargetType.range:
                return typeof target.min === 'number' && typeof target.max === 'number' && (target.min > 0 || target.max > 0);
            case WeightTargetType.bodyweight:
                return true;
            case WeightTargetType.percentage_1rm:
                return typeof target.percentage === 'number' && target.percentage > 0;
            default:
                return false;
        }
    }

    private isRepsTargetVisible(target: RepsTarget | undefined): boolean {
        if (!target || typeof target !== 'object' || !('type' in target)) return false;
        switch (target.type) {
            case RepsTargetType.exact:
            case RepsTargetType.min_plus:
                return typeof target.value === 'number' && target.value > 0;
            case RepsTargetType.range:
                return typeof target.min === 'number' && typeof target.max === 'number' && (target.min > 0 || target.max > 0);
            case RepsTargetType.amrap:
            case RepsTargetType.max:
            case RepsTargetType.max_fraction:
                return true;
            default:
                return false;
        }
    }

    private isDurationTargetVisible(target: DurationTarget | undefined): boolean {
        if (!target || typeof target !== 'object' || !('type' in target)) return false;
        switch (target.type) {
            case DurationTargetType.exact:
                return typeof target.seconds === 'number' && target.seconds > 0;
            case DurationTargetType.range:
                return typeof target.minSeconds === 'number' && typeof target.maxSeconds === 'number' && (target.minSeconds > 0 || target.maxSeconds > 0);
            default:
                return false;
        }
    }

    private isDistanceTargetVisible(target: DistanceTarget | undefined): boolean {
        if (!target || typeof target !== 'object' || !('type' in target)) return false;
        switch (target.type) {
            case DistanceTargetType.exact:
                return typeof target.value === 'number' && target.value > 0;
            case DistanceTargetType.range:
                return typeof target.min === 'number' && typeof target.max === 'number' && (target.min > 0 || target.max > 0);
            default:
                return false;
        }
    }

    private isRestTargetVisible(target: RestTarget | undefined): boolean {
        if (!target || typeof target !== 'object' || !('type' in target)) return false;
        switch (target.type) {
            case RestTargetType.exact:
                return typeof target.seconds === 'number' && target.seconds > 0;
            case RestTargetType.range:
                return typeof target.minSeconds === 'number' && typeof target.maxSeconds === 'number' && (target.minSeconds > 0 || target.maxSeconds > 0);
            default:
                return false;
        }
    }


    /**
     * Generates a display string for a set's planned target, handling ranges and single values using TargetType logic.
     * @param set The ExerciseTargetSetParams object from the routine plan.
     * @param field The field to display ('reps', 'weight', etc.).
     * @returns A formatted string like "8-12", "60+", "10", or an empty string if no target is set.
     */
    getSetTargetDisplay(set: ExerciseTargetSetParams, field: METRIC): string {
        if (!set) {
            return '';
        }

        let min = -1;
        let max = -1;
        let single = -1;

        switch (field) {
            case METRIC.reps:
                if (set.targetReps) {
                    if (set.targetReps.type === RepsTargetType.range) {
                        min = set.targetReps.min;
                        max = set.targetReps.max;
                    } else if (set.targetReps.type === RepsTargetType.exact || set.targetReps.type === RepsTargetType.min_plus) {
                        single = set.targetReps.value;
                    } else if (set.targetReps.type === RepsTargetType.amrap || set.targetReps.type === RepsTargetType.max) {
                        return 'Max'; // Or appropriate display
                    }
                }
                break;
            case METRIC.weight:
                if (set.targetWeight) {
                    if (set.targetWeight.type === WeightTargetType.range) {
                        min = set.targetWeight.min;
                        max = set.targetWeight.max;
                    } else if (set.targetWeight.type === WeightTargetType.exact) {
                        single = set.targetWeight.value;
                    } else if (set.targetWeight.type === WeightTargetType.bodyweight) {
                        return 'Bodyweight';
                    } else if (set.targetWeight.type === WeightTargetType.percentage_1rm) {
                        return `${set.targetWeight.percentage}% 1RM`;
                    }
                }
                break;
            case METRIC.duration:
                if (set.targetDuration) {
                    if (set.targetDuration.type === DurationTargetType.range) {
                        min = set.targetDuration.minSeconds;
                        max = set.targetDuration.maxSeconds;
                    } else if (set.targetDuration.type === DurationTargetType.exact) {
                        single = set.targetDuration.seconds;
                    } else if (set.targetDuration.type === DurationTargetType.to_failure) {
                        return 'To Failure';
                    }
                }
                break;
            case METRIC.distance:
                if (set.targetDistance) {
                    if (set.targetDistance.type === DistanceTargetType.range) {
                        min = set.targetDistance.min;
                        max = set.targetDistance.max;
                    } else if (set.targetDistance.type === DistanceTargetType.exact) {
                        single = set.targetDistance.value;
                    }
                }
                break;
            case METRIC.rest:
                if (set.targetRest) {
                    if (set.targetRest.type === RestTargetType.range) {
                        min = set.targetRest.minSeconds;
                        max = set.targetRest.maxSeconds;
                    } else if (set.targetRest.type === RestTargetType.exact) {
                        single = set.targetRest.seconds;
                    }
                }
                break;
            case METRIC.tempo:
                return set.targetTempo || '';
            default:
                break;
        }

        // Handle ranges and single values
        if (min >= 0 && max >= 0) {
            if (min === max) {
                return min.toString();
            }
            return `${min}-${max}`;
        }
        if (min >= 0) {
            return `${min}+`;
        }
        if (single >= 0) {
            return single.toString();
        }
        return '';
    }


    /**
   * Determines the appropriate weight string to display for a set.
   * It prioritizes the actual performed weight ('weightLogged') from a LoggedSet
   * but falls back to the 'targetWeight' for planned sets. It also handles
   * special display cases for different exercise categories.
   *
   * @param set The set data, which can be either a planned set or a logged set.
   * @param exercise The exercise context to determine the category.
   * @returns A formatted string for display (e.g., "100 kg", "Bodyweight", "N/A").
   */
    getWeightDisplay(set: ExerciseTargetSetParams | LoggedSet, exercise: Exercise | WorkoutExercise): string {
        // The 'set' object could be a LoggedSet, which has a 'weightLogged' property.
        // We check for this property to determine which value to prioritize.
        const performedWeight = (set as any).weightLogged;

        // Use the performed weight if it's a valid number (not null/undefined).
        // Otherwise, fall back to the target weight from the plan.
        const displayWeight = (performedWeight != null) ? performedWeight : set.targetWeight;

        // --- The rest of the display logic now uses the prioritized 'displayWeight' ---

        // 1. Handle categories where weight is not applicable.
        if (exercise?.category === 'cardio' || exercise?.category === 'stretching') {
            if (displayWeight != null && displayWeight > 0) {
                return `${displayWeight} ${this.unitsService.getWeightUnitSuffix()}`;
            }
            return this.translate.instant('workoutService.display.weightNotApplicable');
        }

        // 2. Handle bodyweight/calisthenics exercises.
        if (exercise?.category === 'bodyweight/calisthenics') {
            // If additional weight was used or targeted, display it.
            if (displayWeight != null && displayWeight > 0) {
                return `${displayWeight} ${this.unitsService.getWeightUnitSuffix()}`;
            }
            // Otherwise, the display should just indicate "Bodyweight".
            return this.translate.instant('workoutService.display.bodyweight');
        }

        // 3. Handle all other exercises (e.g., strength training).
        // If a specific weight value exists and is positive, display it with units.
        if (displayWeight != null && displayWeight > 0) {
            return `${displayWeight} ${this.unitsService.getWeightUnitSuffix()}`;
        }

        // If the weight is explicitly zero, it implies no *added* weight.
        if (displayWeight === 0) {
            return this.translate.instant('workoutService.display.noAddedWeight');
        }

        // 4. Fallback for cases where weight is not set (null/undefined).
        return this.translate.instant('workoutService.display.userDefined');
    }


    public checkIfMetricIsVisible(control: any, metric: METRIC): boolean {
        if (!control) return false;

        const setHasMetricVisible = (set: any): boolean => {
            let targetVisible = false;
            let loggedVisible = false;

            // Check target visibility
            switch (metric) {
                case METRIC.duration:
                    targetVisible = this.isDurationTargetVisible(set?.targetDuration);
                    break;
                case METRIC.weight:
                    targetVisible = this.isWeightTargetVisible(set?.targetWeight);
                    break;
                case METRIC.reps:
                    targetVisible = this.isRepsTargetVisible(set?.targetReps);
                    break;
                case METRIC.distance:
                    targetVisible = this.isDistanceTargetVisible(set?.targetDistance);
                    break;
                case METRIC.rest:
                    targetVisible = this.isRestTargetVisible(set?.targetRest);
                    break;
                default:
                    return false;
            }

            // Check logged visibility if it's a logged set
            if (this.isLoggedSet(set)) {
                switch (metric) {
                    case METRIC.duration:
                        loggedVisible = this.isDurationTargetVisible(set?.durationLogged);
                        break;
                    case METRIC.weight:
                        loggedVisible = this.isWeightTargetVisible(set?.weightLogged);
                        break;
                    case METRIC.reps:
                        loggedVisible = this.isRepsTargetVisible(set?.repsLogged);
                        break;
                    case METRIC.distance:
                        loggedVisible = this.isDistanceTargetVisible(set?.distanceLogged);
                        break;
                    case METRIC.rest:
                        loggedVisible = this.isRestTargetVisible(set?.restLogged);
                        break;
                    default:
                        loggedVisible = false;
                }
            }

            // Metric is visible if target is visible OR (for logged sets) logged value is present and valid
            return targetVisible || loggedVisible;
        };

        if (typeof control.get === 'function') {
            const rawValue = typeof control.getRawValue === 'function' ? control.getRawValue() : control.value;
            if (rawValue && Array.isArray(rawValue.sets)) {
                return rawValue.sets.some(setHasMetricVisible);
            }
            return setHasMetricVisible(rawValue);
        }

        if (control.sets && Array.isArray(control.sets)) {
            return control.sets.some(setHasMetricVisible);
        }

        return setHasMetricVisible(control);
    }










    public getVisibleExerciseColumns(routine: Routine, exIndex: number, isLogged: boolean = false): { [key: string]: boolean } {
        const exercise = routine.exercises[exIndex];

        if (!exercise || exercise.sets?.length === 0) {
            // Fallback for safety, though it should always find a set.
            return { [METRIC.weight]: false, [METRIC.reps]: false, [METRIC.distance]: false, [METRIC.duration]: false, [METRIC.tempo]: false, [METRIC.rest]: false };
        }

        const wkEx = { ...exercise } as WorkoutExercise;
        const wkExFromLog = { ...mapLoggedWorkoutExerciseToWorkoutExercise(exercise as any) } as WorkoutExercise;

        let visibleExerciseFieldsObj = {};
        if (!isLogged) {
            visibleExerciseFieldsObj = {
                [METRIC.weight]: wkEx.sets.some(set => (set.targetWeight)) || wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.weight)),
                [METRIC.reps]: wkEx.sets.some(set => (set.targetReps)) || wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.reps)),
                [METRIC.distance]: wkEx.sets.some(set => (set.targetDistance)) || wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.distance)),
                [METRIC.duration]: wkEx.sets.some(set => (set.targetDuration)) || wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.duration)),
                [METRIC.rest]: wkEx.sets.some(set => (set.targetRest)) || wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.rest)),
                [METRIC.tempo]: wkEx.sets.some(set => (set.targetTempo)) || wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.tempo)),
            };
        } else {
            visibleExerciseFieldsObj = {
                [METRIC.weight]: wkExFromLog.sets.some(set => (set.targetWeight)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.weight)),
                [METRIC.reps]: wkExFromLog.sets.some(set => (set.targetReps)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.reps)),
                [METRIC.distance]: wkExFromLog.sets.some(set => (set.targetDistance)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.distance)),
                [METRIC.duration]: wkExFromLog.sets.some(set => (set.targetDuration)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.duration)),
                [METRIC.rest]: wkExFromLog.sets.some(set => (set.targetRest)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.rest)),
                [METRIC.tempo]: wkExFromLog.sets.some(set => (set.targetTempo)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.tempo)),
            };
        }



        return visibleExerciseFieldsObj;
    }

    public getVisibleSetColumns(routine: Routine, exIndex: number, setIndex: number): { [key: string]: boolean } {
        const exercise = routine.exercises[exIndex];
        const set = exercise?.sets[setIndex];

        if (!set) {
            // Fallback for safety, though it should always find a set.
            return { weight: false, reps: false, distance: false, duration: false, tempo: false };
        }

        // --- The Smart Implementation: Use the type guard ---
        let visibleSetFieldsObj;
        if (this.isLoggedSet(set)) {
            // It's a LoggedSet, so we check the performance fields.
            visibleSetFieldsObj = {
                [METRIC.weight]: !!((this.getWeightValue(set.weightLogged) ?? 0) > 0 || set.fieldOrder?.includes(METRIC.weight)),
                [METRIC.reps]: !!((this.getRepsValue(set.repsLogged) ?? 0) > 0 || set.fieldOrder?.includes(METRIC.reps)),
                [METRIC.distance]: !!((this.getDistanceValue(set.distanceLogged) ?? 0) > 0 || set.fieldOrder?.includes(METRIC.distance)),
                [METRIC.duration]: !!((this.getDurationValue(set.durationLogged) ?? 0) > 0 || set.fieldOrder?.includes(METRIC.duration)),
                [METRIC.tempo]: !!(set.targetTempo?.trim() || set.fieldOrder?.includes(METRIC.tempo)),
                [METRIC.rest]: !!((this.getRestValue(set.restLogged) ?? 0) > 0 || set.fieldOrder?.includes(METRIC.rest)),
            };
        } else {
            // It's an ExerciseTargetSetParams, so we check the target fields.
            const plannedSet = set as ExerciseTargetSetParams; // We can now safely cast it.
            visibleSetFieldsObj = {
                [METRIC.weight]: !!((plannedSet.targetWeight) || plannedSet.fieldOrder?.includes(METRIC.weight)),
                [METRIC.reps]: !!((plannedSet.targetReps) || plannedSet.fieldOrder?.includes(METRIC.reps)),
                [METRIC.distance]: !!((plannedSet.targetDistance) || plannedSet.fieldOrder?.includes(METRIC.distance)),
                [METRIC.duration]: !!((plannedSet.targetDuration) || plannedSet.fieldOrder?.includes(METRIC.duration)),
                [METRIC.tempo]: !!(plannedSet.targetTempo?.trim() || plannedSet.fieldOrder?.includes(METRIC.tempo)),
                [METRIC.rest]: !!((plannedSet.targetRest) || plannedSet.fieldOrder?.includes(METRIC.rest)),
            };
        }
        return visibleSetFieldsObj;
    }

    /**
     * Orchestrates adding a new field to a specific set by first asking WHICH field,
     * and then asking for its VALUE.
     * @returns A promise that resolves with the updated Routine object, or null if cancelled.
     */
    public async promptAddField(routine: Routine | LoggedRoutine, exIndex: number, setIndex: number, isPlayer: boolean = false): Promise<Routine | null> {
        const { hidden } = this.getFieldsForSet(routine, exIndex, setIndex);

        if (hidden.length === 0) {
            this.toastService.info("All available metrics are already added to this set.");
            return null;
        }

        const isSuperSet = !!routine.exercises[exIndex].supersetId;
        let filteredHidden;
        if (isSuperSet) {
            // check that superset exercise must have only "reps" and "weight" as metrics, let the user add/remove them but nothing else
            const allowedFields = [METRIC.weight, METRIC.reps];

            // remove any disallowed fields from the hidden list
            filteredHidden = hidden.filter(field => allowedFields.includes(field));
            if (filteredHidden.every(field => !allowedFields.includes(field))) {
                this.toastService.info("Only 'Weight' and 'Reps' can be added to sets within a superset.");
                return null;
            }
        }

        let availableMetrics = filteredHidden ? filteredHidden : hidden;
        const appSettings = this.appSettingsService.getSettings();


        // If the call is coming from the workout player, filter out the 'rest' metric
        // If in the player and True GYM mode is on, filter the available metrics
        if (isPlayer && appSettings.enableTrueGymMode) {
            // We need the base exercise to determine if it's cardio
            const baseExercise = await firstValueFrom(this.exerciseService.getExerciseById(routine.exercises[exIndex].exerciseId));
            const isCardio = baseExercise?.category === 'cardio';

            const allowedFields = isCardio
                ? [METRIC.duration] // Rest is handled by its own modal now
                : [METRIC.weight, METRIC.reps];

            availableMetrics = availableMetrics.filter(field => allowedFields.includes(field as METRIC));
        }

        // If after all filtering there are no metrics left to add, inform the user and exit.
        if (availableMetrics.length === 0) {
            this.toastService.info("No more metrics can be added to this set.");
            return null;
        }


        // --- Step 1: Ask WHICH field to add ---
        const buttons: AlertButton[] = availableMetrics.map(field => ({
            text: this.translate.instant('metrics.' + field),
            role: 'add', data: field,
            icon: field
        }));
        buttons.push({ text: this.translate.instant('common.cancel'), role: 'cancel', data: null, icon: 'cancel' });

        const choice = await this.alertService.showConfirmationDialog(
            this.translate.instant('workoutBuilder.prompts.addField.title'),
            this.translate.instant('workoutBuilder.prompts.addField.message', { setNumber: setIndex + 1 }),
            buttons,
            { showCloseButton: true }
        );

        if (!choice || !choice.data) {
            return null; // User cancelled the first prompt
        }

        const fieldToAdd = choice.data as METRIC;
        const translatedFieldToAdd = this.translate.instant('metrics.' + fieldToAdd);

        // --- Step 2: Ask for the VALUE of the chosen field ---
        let inputLabel = this.translate.instant('workoutBuilder.prompts.setTarget.title', { field: translatedFieldToAdd });
        let placeholderValue: number | string = 0;

        switch (fieldToAdd) {
            case METRIC.weight:
                inputLabel += ` (${this.unitsService.getWeightUnitSuffix()})`;
                placeholderValue = 10;
                break;
            case METRIC.reps:
                placeholderValue = 8;
                break;
            case METRIC.duration:
                inputLabel += ' (s)';
                placeholderValue = 60;
                break;
            case METRIC.rest:
                inputLabel += ' (s)';
                placeholderValue = 60;
                break;
            case METRIC.distance:
                inputLabel += ` (${this.unitsService.getDistanceMeasureUnitSuffix()})`;
                placeholderValue = 1;
                break;
            case METRIC.tempo:
                placeholderValue = '2-0-1-0';
                break;
        }

        const correctAttribute = fieldToAdd !== METRIC.tempo ? { min: '0', step: 'any' } : {};
        const valueResult = await this.alertService.showPromptDialog(
            this.translate.instant('workoutBuilder.prompts.setTarget.title', { field: translatedFieldToAdd }),
            this.translate.instant('workoutBuilder.prompts.setTarget.message', { setNumber: setIndex + 1 }),
            [{
                name: 'targetValue',
                type: fieldToAdd === METRIC.tempo ? 'text' : 'number',
                label: this.translate.instant('metrics.' + fieldToAdd),
                value: placeholderValue,
                attributes: correctAttribute
            }] as AlertInput[],
            this.translate.instant('workoutBuilder.prompts.setTarget.applyButton')
        );

        if (!valueResult || valueResult['targetValue'] === null || valueResult['targetValue'] === undefined) {
            return null; // User cancelled the second prompt
        }

        const targetValue = valueResult['targetValue'];

        // --- Step 3: Call the private method to apply the change ---
        const updatedRoutine = this.addFieldToSet(routine, exIndex, setIndex, fieldToAdd, targetValue);

        // this.toastService.success(`'${fieldToAdd.toUpperCase()}' field added to Set #${setIndex + 1}.`);
        return updatedRoutine;
    }

    public defaultHiddenFields(): any {
        return { visible: [], hidden: this.getDefaultFields() };
    }

    public getRepsAndWeightFields(): METRIC[] {
        return [METRIC.reps, METRIC.weight];
    }

    public getDefaultFields(): METRIC[] {
        return [METRIC.weight, METRIC.reps, METRIC.distance, METRIC.duration, METRIC.tempo, METRIC.rest];
    }

    public getFieldsForSet(routine: Routine, exIndex: number, setIndex: number): { visible: METRIC[], hidden: METRIC[] } {
        const allFields = this.getDefaultFields();
        // As requested, this now uses the exercise-wide visibility check.
        const visibleCols = this.getVisibleSetColumns(routine, exIndex, setIndex);

        const visible = allFields.filter(field => visibleCols[field as keyof typeof visibleCols]);
        const hidden = allFields.filter(field => !visible.includes(field));

        return { visible, hidden };
    }


    /**
   * A private, synchronous helper that applies a new field and its value to a specific set
   * within a routine object and returns the modified routine.
   */
    private addFieldToSet(
        routine: Routine | LoggedRoutine,
        exIndex: number,
        setIndex: number,
        fieldToAdd: METRIC,
        targetValue: AnyTarget | string | number | boolean
    ): Routine {
        const updatedRoutine = JSON.parse(JSON.stringify(routine)) as Routine;
        const setToUpdate: ExerciseTargetSetParams | LoggedSet = updatedRoutine.exercises[exIndex].sets[setIndex];

        // Ensure fieldOrder exists and includes the new field
        if (!setToUpdate.fieldOrder) {
            const { visible } = this.getFieldsForSet(routine, exIndex, setIndex);
            setToUpdate.fieldOrder = visible;
        }
        if (!setToUpdate.fieldOrder.includes(fieldToAdd)) {
            setToUpdate.fieldOrder.push(fieldToAdd);
        }

        // Type-aware assignment for each metric
        switch (fieldToAdd) {
            case METRIC.weight: {
                let weightTarget: WeightTarget;
                if (typeof targetValue === 'number') {
                    weightTarget = weightToExact(targetValue);
                } else if (typeof targetValue === 'string' && !isNaN(Number(targetValue))) {
                    weightTarget = weightToExact(Number(targetValue));
                } else if (typeof targetValue === 'object' && targetValue && 'type' in targetValue) {
                    weightTarget = targetValue as WeightTarget;
                } else {
                    weightTarget = weightToExact(0);
                }
                setToUpdate.targetWeight = weightTarget;

                if (this.isLoggedRoutine(routine)) {
                    (setToUpdate as LoggedSet).weightLogged = weightTarget;
                    delete setToUpdate.targetWeight;
                }
                break;
            }
            case METRIC.reps: {
                let repsTarget: RepsTarget;
                if (typeof targetValue === 'number') {
                    repsTarget = repsToExact(targetValue);
                } else if (typeof targetValue === 'string' && !isNaN(Number(targetValue))) {
                    repsTarget = repsToExact(Number(targetValue));
                } else if (typeof targetValue === 'object' && targetValue && 'type' in targetValue) {
                    repsTarget = targetValue as RepsTarget;
                } else {
                    repsTarget = repsToExact(0);
                }
                setToUpdate.targetReps = repsTarget;

                if (this.isLoggedRoutine(routine)) {
                    (setToUpdate as LoggedSet).repsLogged = repsTarget;
                    delete setToUpdate.targetReps;
                }
                break;
            }
            case METRIC.distance: {
                let distanceTarget: DistanceTarget;
                if (typeof targetValue === 'number') {
                    distanceTarget = distanceToExact(targetValue);
                } else if (typeof targetValue === 'string' && !isNaN(Number(targetValue))) {
                    distanceTarget = distanceToExact(Number(targetValue));
                } else if (typeof targetValue === 'object' && targetValue && 'type' in targetValue) {
                    distanceTarget = targetValue as DistanceTarget;
                } else {
                    distanceTarget = distanceToExact(0);
                }
                setToUpdate.targetDistance = distanceTarget;

                if (this.isLoggedRoutine(routine)) {
                    (setToUpdate as LoggedSet).distanceLogged = distanceTarget;
                    delete setToUpdate.targetDistance;
                }
                break;
            }
            case METRIC.duration: {
                let durationTarget: DurationTarget;
                if (typeof targetValue === 'number') {
                    durationTarget = durationToExact(targetValue);
                } else if (typeof targetValue === 'string' && !isNaN(Number(targetValue))) {
                    durationTarget = durationToExact(Number(targetValue));
                } else if (typeof targetValue === 'object' && targetValue && 'type' in targetValue) {
                    durationTarget = targetValue as DurationTarget;
                } else {
                    durationTarget = durationToExact(0);
                }
                setToUpdate.targetDuration = durationTarget;

                if (this.isLoggedRoutine(routine)) {
                    (setToUpdate as LoggedSet).durationLogged = durationTarget;
                    delete setToUpdate.targetDuration;
                }
                break;
            }
            case METRIC.rest: {
                let restTarget: RestTarget;
                if (typeof targetValue === 'number') {
                    restTarget = restToExact(targetValue);
                } else if (typeof targetValue === 'string' && !isNaN(Number(targetValue))) {
                    restTarget = restToExact(Number(targetValue));
                } else if (typeof targetValue === 'object' && targetValue && 'type' in targetValue) {
                    restTarget = targetValue as RestTarget;
                } else {
                    restTarget = restToExact(0);
                }
                setToUpdate.targetRest = restTarget;

                if (this.isLoggedRoutine(routine)) {
                    (setToUpdate as LoggedSet).restLogged = restTarget;
                    delete setToUpdate.targetRest;
                }
                break;
            }
            case METRIC.tempo: {
                const tempoValue = typeof targetValue === 'string' ? targetValue : '';
                setToUpdate.targetTempo = tempoValue;
                if (this.isLoggedRoutine(routine)) {
                    (setToUpdate as LoggedSet).tempoLogged = tempoValue;
                }
                break;
            }
            default: {
                if (fieldToAdd in setToUpdate) {
                    (setToUpdate as any)[fieldToAdd] = targetValue;
                }
                break;
            }
        }

        return updatedRoutine;
    }



    public async promptRemoveField(routine: Routine, exIndex: number, setIndex: number, isPlayer: boolean = false): Promise<Routine | null> {
        const cols = this.getVisibleSetColumns(routine, exIndex, setIndex);
        let removableFields = Object.keys(cols).filter(key => cols[key as keyof typeof cols]);

        const appSettings = this.appSettingsService.getSettings();

        // If the call is coming from the workout player, filter out the 'rest' metric
        // If in the player and True GYM mode is on, filter the available metrics
        if (isPlayer) {
            removableFields = removableFields.filter(field => field !== METRIC.rest);

            if (appSettings.enableTrueGymMode) {
                const baseExercise = await firstValueFrom(this.exerciseService.getExerciseById(routine.exercises[exIndex].exerciseId));
                const isCardio = baseExercise?.category === 'cardio';

                const allowedFields = isCardio
                    ? [METRIC.duration]
                    : [METRIC.weight, METRIC.reps];

                removableFields = removableFields.filter(field => allowedFields.includes(field as METRIC));
            }
        }

        if (removableFields.length === 0) {
            // Get translated toast message
            const toastMessage = await firstValueFrom(this.translate.get("workoutService.alerts.removeField.noFieldsToast"));
            this.toastService.info(toastMessage);
            return routine;
        };

        // --- START OF TRANSLATION IMPLEMENTATION ---

        // 1. Prepare all the translation keys we will need.
        const metricTranslationKeys = removableFields.map(field => `metrics.${field}`);
        const requiredKeys = [
            'workoutService.alerts.removeField.title',
            'workoutService.alerts.removeField.message',
            'common.cancel',
            ...metricTranslationKeys
        ];

        // 2. Fetch all translations in one network call for efficiency.
        const translations = await firstValueFrom(this.translate.get(requiredKeys));

        // 3. Build the buttons using the fetched translations.
        const buttons: AlertButton[] = removableFields.map(field => ({
            text: translations[`metrics.${field}`], // Use translated metric name
            role: 'remove',
            data: field,
            icon: field,
            cssClass: 'bg-red-500 hover:bg-red-600'
        }));

        // Add a dedicated "Cancel" button with its translation.
        buttons.push({
            text: translations['common.cancel'],
            role: 'cancel',
            data: null,
            icon: 'cancel'
        });

        // 4. Show the confirmation dialog with translated content.
        const choice = await this.alertService.showConfirmationDialog(
            translations['workoutService.alerts.removeField.title'],
            translations['workoutService.alerts.removeField.message'],
            buttons,
            { showCloseButton: true }
        );

        // --- END OF TRANSLATION IMPLEMENTATION ---

        if (!choice || !choice.data) {
            return null; // User cancelled
        }

        const fieldToRemove = choice.data;
        const updatedRoutine = this.removeMetricFromSet(routine, exIndex, setIndex, fieldToRemove);
        return updatedRoutine;
    }

    public removeMetricFromSet(routine: Routine, exIndex: number, setIndex: number, fieldToRemove: METRIC): Routine {
        // Create a deep copy to avoid mutating the original object
        const newRoutine = JSON.parse(JSON.stringify(routine)) as Routine;

        const setToUpdate: any = newRoutine.exercises[exIndex].sets[setIndex];

        // 1. Remove the field's value
        setToUpdate[`target${fieldToRemove.charAt(0).toUpperCase() + fieldToRemove.slice(1)}`] = undefined;
        setToUpdate[`target${fieldToRemove.charAt(0).toUpperCase() + fieldToRemove.slice(1)}Min`] = undefined;
        setToUpdate[`target${fieldToRemove.charAt(0).toUpperCase() + fieldToRemove.slice(1)}Max`] = undefined;
        setToUpdate[`${fieldToRemove}Used`] = undefined;
        setToUpdate[`${fieldToRemove}Achieved`] = undefined;

        // OLD REST
        setToUpdate[`${fieldToRemove}AfterSet`] = undefined;

        // 2. Also remove the field from the order array
        if (setToUpdate.fieldOrder) {
            setToUpdate.fieldOrder = setToUpdate.fieldOrder.filter((field: string) => field !== fieldToRemove);
        }

        this.toastService.info(`'${fieldToRemove.toUpperCase()}' field removed from set #${setIndex + 1}.`);

        // 3. Return the fully modified new routine object
        return newRoutine;
    }

    /**
       * Safely retrieves the 'fieldOrder' array for a specific set within a routine.
       * This is used by the UI to render metric inputs in their correct, user-defined order.
       * @param routine The full Routine object.
       * @param exIndex The index of the exercise within the routine.
       * @param setIndex The index of the set within the exercise.
       * @returns The `fieldOrder` array (e.g., ['reps', 'weight']) or `null` if not found.
       */
    public getSetFieldOrder(routine: Routine, exIndex: number, setIndex: number): string[] | null {
        // Safely access the nested properties
        const exercise = routine?.exercises?.[exIndex];
        const set = exercise?.sets?.[setIndex];

        // Return the fieldOrder array if it exists and is an array, otherwise return null.
        if (set && Array.isArray(set.fieldOrder)) {
            return set.fieldOrder;
        }

        return null;
    }

    /**
  * Checks if an object has the structure of a LoggedSet by looking for
  * performance-specific properties. This is a "type guard".
  * @param set The object to check.
  * @returns True if the object is a LoggedSet.
  */
    public isLoggedSet(set: any): set is LoggedSet {
        // A LoggedSet will have performance fields. We check for the existence of these keys.
        return set && set.workoutLogId && (
            typeof set.repsLogged !== 'undefined' ||
            typeof set.weightLogged !== 'undefined' ||
            typeof set.durationLogged !== 'undefined' ||
            typeof set.distanceLogged !== 'undefined' ||
            typeof set.tempoLogged !== 'undefined'
        );
    }

    /**
   * Gets a display-ready value for a specific field from a set object.
   * This method intelligently handles both LoggedSet (performance) and 
   * ExerciseTargetSetParams (planning) types.
   *
   * @param exSet The set object, which can be either logged or planned.
   * @param field The metric to retrieve ('weight', 'reps', etc.).
   * @returns A formatted string for display.
   */
    public getSetFieldValue(exSet: ExerciseTargetSetParams | LoggedSet, field: METRIC): string {
        if (!exSet) {
            return '-';
        }

        // --- Smart Handling Starts Here ---

        // CASE 1: The set is a LOGGED set, so we display the actual performance values.
        if (this.isLoggedSet(exSet)) {
            switch (field) {
                case METRIC.reps: return (exSet.repsLogged ?? '-').toString();
                case METRIC.weight: return exSet.weightLogged != null ? exSet.weightLogged.toString() : '-';
                case METRIC.distance: return (exSet.distanceLogged ?? '-').toString();
                case METRIC.duration: return exSet.durationLogged != null ? this.formatSecondsToTime(exSet.durationLogged.toString()) : '-';
                case METRIC.duration: return exSet.restLogged != null ? this.formatSecondsToTime(exSet.restLogged.toString()) : '-';
                case METRIC.tempo: return exSet.tempoLogged || '-';
                default: return '-';
            }
        }
        // CASE 2: The set is a PLANNED set, so we display the target values, handling ranges.
        else {
            const plannedSet = exSet as ExerciseTargetSetParams; // Safe to cast here
            switch (field) {
                case METRIC.reps:
                    if (plannedSet.targetReps && plannedSet.targetReps.type === RepsTargetType.range) {
                        const midValue = Math.floor((plannedSet.targetReps.min + plannedSet.targetReps.max) / 2);
                        return midValue.toString();
                    }
                    return (plannedSet.targetReps ?? '-').toString();

                case METRIC.weight:
                    if (plannedSet.targetWeight && plannedSet.targetWeight.type === WeightTargetType.range) {
                        const midValue = Math.floor((plannedSet.targetWeight.min + plannedSet.targetWeight.max) / 2);
                        return midValue.toString();
                    }
                    return (plannedSet.targetWeight ?? '-').toString();

                case METRIC.distance:
                    if (plannedSet.targetDistance && plannedSet.targetDistance.type === DistanceTargetType.range) {
                        const midValue = Math.floor((plannedSet.targetDistance.min + plannedSet.targetDistance.max) / 2);
                        return midValue.toString();
                    }
                    return (plannedSet.targetDistance ?? '-').toString();

                case METRIC.duration:
                    if (plannedSet.targetDuration && plannedSet.targetDuration.type === DurationTargetType.range) {
                        const midValue = Math.floor((plannedSet.targetDuration.minSeconds + plannedSet.targetDuration.maxSeconds) / 2);
                        return midValue.toString();
                    }
                    return (plannedSet.targetDuration ?? '-').toString();
                case METRIC.rest:
                    if (plannedSet.targetRest && plannedSet.targetRest.type === RestTargetType.range) {
                        const midValue = Math.floor((plannedSet.targetRest.minSeconds + plannedSet.targetRest.maxSeconds) / 2);
                        return midValue.toString();
                    }
                    return (plannedSet.targetRest ?? '-').toString();
                case METRIC.tempo:
                    return plannedSet.targetTempo || '-';

                default:
                    return '-';
            }
        }
    }




    /**
       * Formats a single numeric value of seconds into a "mm:ss" string.
       * @param seconds The number of seconds to format.
       * @returns The formatted time string, or an empty string if the input is invalid.
       */
    private _formatSingleSecondValue(seconds: number | string): string {
        let numericValue: number;

        if (typeof seconds === 'number') {
            numericValue = seconds;
        } else {
            // Parse string representations of time
            const str = seconds.trim().toLowerCase();

            if (str.includes(':')) {
                // Handle "mm:ss" format (e.g., "1:30")
                const parts = str.split(':');
                if (parts.length === 2) {
                    const min = parseFloat(parts[0]);
                    const sec = parseFloat(parts[1]);
                    if (!isNaN(min) && !isNaN(sec)) {
                        numericValue = min * 60 + sec;
                    } else {
                        return '';
                    }
                } else {
                    return '';
                }
            } else if (str.includes('m') || str.includes('minute')) {
                // Handle minutes (e.g., "1m", "1 minute", "2 minutes")
                const num = parseFloat(str.replace(/m|minute|minutes/g, ''));
                if (!isNaN(num)) {
                    numericValue = num * 60;
                } else {
                    return '';
                }
            } else if (str.includes('s') || str.includes('second')) {
                // Handle seconds (e.g., "50s", "50 seconds")
                const num = parseFloat(str.replace(/s|second|seconds/g, ''));
                if (!isNaN(num)) {
                    numericValue = num;
                } else {
                    return '';
                }
            } else {
                // Fallback: try to parse as a plain number
                numericValue = parseFloat(str);
                if (isNaN(numericValue)) {
                    return '';
                }
            }
        }

        // Format as "mm:ss"
        const mins = String(Math.floor(numericValue / 60)).padStart(2, '0');
        const secs = String(numericValue % 60).padStart(2, '0');
        return `${mins}:${secs}`;
    }

    /**
     * Formats a total number of seconds into a "mm:ss" time string.
     * It can also handle a string representing a range (e.g., "60-90"),
     * which it will format as "01:00-01:30".
     *
     * @param totalSeconds The total seconds as a number, a string, or a range string.
     * @returns The formatted time string.
     */
    formatSecondsToTime(totalSeconds: number | string | undefined): string {
        // 1. Handle null, undefined, or empty string inputs
        if (totalSeconds == null || totalSeconds === '') {
            return '';
        }

        // 2. Check if the input is a range string (e.g., "60-90")
        if (typeof totalSeconds === 'string' && totalSeconds.includes('-')) {
            const [minSeconds, maxSeconds] = totalSeconds.split('-');

            // Format both parts of the range individually using the helper
            const formattedMin = this._formatSingleSecondValue(minSeconds);
            const formattedMax = this._formatSingleSecondValue(maxSeconds);

            // Return the combined formatted range
            return `${formattedMin}-${formattedMax}`;
        }

        // 3. If it's not a range, format it as a single value using the helper
        return this._formatSingleSecondValue(totalSeconds);
    }

    /**
       * Gets a translated and filtered list of available rep schemes based on the context.
       * @param context Whether the list is for the 'builder' or the 'player'.
       * @returns An array of objects with the type and its translated label.
       */
    public getAvailableRepsSchemes(context: 'builder' | 'player'): { type: RepsTargetType; label: string }[] {

        // 1. Filter the master list based on the context
        const filteredSchemes = REPS_TARGET_SCHEMES.filter(scheme => {
            return context === 'builder' ? scheme.availableInBuilder : scheme.availableInPlayer;
        });

        // 2. Map the filtered list to include translated labels
        return filteredSchemes.map(scheme => ({
            type: scheme.type,
            label: this.translate.instant(scheme.labelKey)
        }));
    }


    // Gets a list of available weight schemes for a modal
    public getAvailableWeightSchemes(context: 'builder' | 'player'): { type: WeightTargetType; label: string }[] {
        return WEIGHT_TARGET_SCHEMES
            .filter(scheme => context === 'builder' ? scheme.availableInBuilder : scheme.availableInPlayer)
            .map(scheme => ({ type: scheme.type, label: this.translate.instant(scheme.labelKey) }));
    }
    // Creates a display string like "100kg", "80-90kg", or "Bodyweight"
    public weightTargetAsString(target: WeightTarget | undefined | null): string {
        if (!target) return '';
        switch (target.type) {
            case WeightTargetType.exact:
                return `${target.value}`; // The pipe will add the unit
            case WeightTargetType.range:
                return `${target.min}-${target.max}`; // The pipe will add the unit
            case WeightTargetType.bodyweight:
                return this.translate.instant('weightSchemes.bodyweight'); // "Bodyweight"
            case WeightTargetType.percentage_1rm:
                return `${target.percentage}% 1RM`;
            default:
                return '';
        }
    }

    // --- DURATION (New) ---
    public getAvailableDurationSchemes(context: 'builder' | 'player'): { type: DurationTargetType; label: string }[] {
        return DURATION_TARGET_SCHEMES
            .filter(scheme => context === 'builder' ? scheme.availableInBuilder : scheme.availableInPlayer)
            .map(scheme => ({ type: scheme.type, label: this.translate.instant(scheme.labelKey) }));
    }
    public durationTargetAsString(target: DurationTarget | undefined | null): string {
        if (!target) return '';
        switch (target.type) {
            case DurationTargetType.exact: return `${target.seconds}s`;
            case DurationTargetType.range: return `${target.minSeconds}-${target.maxSeconds}s`;
            case DurationTargetType.to_failure: return this.translate.instant('durationSchemes.toFailure');
            default: return '';
        }
    }

    // --- DISTANCE (New) ---
    public getAvailableDistanceSchemes(context: 'builder' | 'player'): { type: DistanceTargetType; label: string }[] {
        return DISTANCE_TARGET_SCHEMES
            .filter(scheme => context === 'builder' ? scheme.availableInBuilder : scheme.availableInPlayer)
            .map(scheme => ({ type: scheme.type, label: this.translate.instant(scheme.labelKey) }));
    }
    public distanceTargetAsString(target: DistanceTarget | undefined | null): string {
        if (!target) return '';
        switch (target.type) {
            case DistanceTargetType.exact: return `${target.value}`;
            case DistanceTargetType.range: return `${target.min}-${target.max}`;
            default: return '';
        }
    }

    // --- REST (New) ---
    public getAvailableRestSchemes(context: 'builder' | 'player'): { type: RestTargetType; label: string }[] {
        return REST_TARGET_SCHEMES
            .filter(scheme => context === 'builder' ? scheme.availableInBuilder : scheme.availableInPlayer)
            .map(scheme => ({ type: scheme.type, label: this.translate.instant(scheme.labelKey) }));
    }
    public restTargetAsString(target: RestTarget | undefined | null): string {
        if (!target) return '';
        switch (target.type) {
            case RestTargetType.exact:
                return `${target.seconds}s`;
            case RestTargetType.range:
                return `${target.minSeconds}-${target.maxSeconds}s`; // <-- Use minSeconds/maxSeconds
            default:
                return '';
        }
    }


    /**
     * A generic modal to configure a target scheme for any metric (Reps, Weight, Duration, etc.).
     * @param metric The metric being configured (e.g., 'reps', 'weight').
     * @param currentTarget The current target object for pre-filling the modal.
     * @param availableSchemes The metadata array for the metric (e.g., REPS_TARGET_SCHEMES).
     * @returns A promise that resolves with the new target object or null if cancelled.
     */
    public async showSchemeModal(
        metric: METRIC,
        currentTarget: AnyTarget | null,
        availableSchemes: AnyScheme[]
    ): Promise<{ role: string, data: AnyTarget } | null> {

        // --- Step 1: Dynamically generate the selection buttons ---
        const typeButtons: AlertButton[] = availableSchemes.map(scheme => {
            // You can expand this with more icons as needed
            let iconName = 'pin';
            if (scheme.type.includes('range')) iconName = 'range';
            if (scheme.type.includes('max')) iconName = 'max_performance';
            if (scheme.type.includes('amrap')) iconName = 'repeat';
            if (scheme.type.includes('min_plus')) iconName = 'plus-circle';
            if (scheme.type.includes('bodyweight')) iconName = 'bodyweight';

            return {
                text: this.translate.instant(scheme.labelKey),
                role: 'select',
                data: scheme.type,
                icon: iconName,
            };
        });

        const typeChoice = await this.alertService.showConfirmationDialog(
            this.translate.instant(`schemes.titles.selectType`, { metric: this.translate.instant(`metrics.${metric}`) }),
            '',
            typeButtons,
            { customButtonDivCssClass: 'grid grid-cols-2 gap-3', showCloseButton: true }
        );

        if (!typeChoice || !typeChoice.data) {
            return null;
        }

        const selectedType = typeChoice.data as AnyTargetType;
        let newTarget: AnyTarget | null = null;

        // --- Step 2: Dynamically generate the value prompt based on the selected type ---
        const inputs: AlertInput[] = [];
        const titleKey = `schemes.titles.set${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)}`;

        switch (selectedType) {
            case RepsTargetType.exact:
            case WeightTargetType.exact:
            case DistanceTargetType.exact:
                inputs.push({
                    name: 'value', type: 'number', label: this.translate.instant(`metrics.${metric}`),
                    value: (currentTarget as any)?.value ?? 8, // Default to 8 or appropriate value
                    attributes: { min: 0, required: true }
                });
                break;
            case DurationTargetType.exact:
            case RestTargetType.exact:
                inputs.push({
                    name: 'seconds', type: 'number', label: this.translate.instant(`metrics.${metric}`),
                    value: (currentTarget as any)?.value ?? 30,
                    attributes: { min: 0, required: true }
                });
                break;

            case RepsTargetType.min_plus:
                inputs.push({
                    name: 'min', type: 'number', label: this.translate.instant('common.atLeast'),
                    value: (currentTarget as any)?.min ?? 5,
                    attributes: { min: 0, required: true }
                });
                break;
            case RepsTargetType.max_fraction:
                inputs.push({
                    name: 'divisor', type: 'number', label: this.translate.instant('common.fractionOfMax'),
                    value: (currentTarget as any)?.divisor ?? 2,
                    attributes: { min: 1, required: true }
                });
                break;

            case RepsTargetType.range:
            case WeightTargetType.range:
            case DurationTargetType.range:
            case DistanceTargetType.range:
            case RestTargetType.range:
                inputs.push(
                    { name: 'min', type: 'number', label: this.translate.instant('common.min'), value: (currentTarget as any)?.min ?? 8, attributes: { min: 0, required: true } },
                    { name: 'max', type: 'number', label: this.translate.instant('common.max'), value: (currentTarget as any)?.max ?? 12, attributes: { min: 0, required: true } }
                );
                break;

            case WeightTargetType.percentage_1rm:
                inputs.push({ name: 'percentage', type: 'number', label: '% 1RM', value: (currentTarget as any)?.percentage ?? 80, attributes: { min: 1, max: 150, required: true } });
                break;
        }

        // --- Step 3: Show the value prompt if needed ---
        if (inputs.length > 0) {
            const result = await this.alertService.showPromptDialog(this.translate.instant(titleKey), '', inputs);
            if (!result) return null;

            // --- FIX: Use both metric and selectedType ---
            switch (metric) {
                case METRIC.reps:
                    switch (selectedType) {
                        case RepsTargetType.exact:
                            newTarget = { type: selectedType, value: Number(result['value']) };
                            break;
                        case RepsTargetType.range:
                            newTarget = { type: selectedType, min: Number(result['min']), max: Number(result['max']) };
                            break;
                        case RepsTargetType.min_plus:
                            newTarget = { type: selectedType, value: Number(result['min']) };
                            break;
                        case RepsTargetType.max_fraction:
                            newTarget = { type: selectedType, divisor: Number(result['divisor']) };
                            break;
                    }
                    break;
                case METRIC.weight:
                    switch (selectedType) {
                        case WeightTargetType.exact:
                            newTarget = { type: selectedType, value: Number(result['value']) };
                            break;
                        case WeightTargetType.range:
                            newTarget = { type: selectedType, min: Number(result['min']), max: Number(result['max']) };
                            break;
                        case WeightTargetType.percentage_1rm:
                            newTarget = { type: selectedType, percentage: Number(result['percentage']) };
                            break;
                    }
                    break;
                case METRIC.duration:
                    switch (selectedType) {
                        case DurationTargetType.exact:
                            newTarget = { type: selectedType, seconds: Number(result['value']) };
                            break;
                        case DurationTargetType.range:
                            newTarget = { type: selectedType, minSeconds: Number(result['min']), maxSeconds: Number(result['max']) };
                            break;
                        case DurationTargetType.to_failure:
                            newTarget = { type: selectedType };
                            break;
                    }
                    break;
                case METRIC.rest:
                    switch (selectedType) {
                        case RestTargetType.exact:
                            newTarget = { type: selectedType, seconds: Number(result['value']) };
                            break;
                        case RestTargetType.range:
                            newTarget = { type: selectedType, minSeconds: Number(result['min']), maxSeconds: Number(result['max']) };
                            break;
                    }
                    break;
                case METRIC.distance:
                    switch (selectedType) {
                        case DistanceTargetType.exact:
                            newTarget = { type: selectedType, value: Number(result['value']) };
                            break;
                        case DistanceTargetType.range:
                            newTarget = { type: selectedType, min: Number(result['min']), max: Number(result['max']) };
                            break;
                    }
                    break;
            }
        } else {
            // For types without inputs, this is still correct.
            newTarget = { type: selectedType } as AnyTarget;
        }

        if (newTarget) {
            return { role: 'confirm', data: newTarget };
        }

        return null;
    }

    private isLoggedRoutine(routine: Routine | LoggedRoutine): routine is LoggedRoutine {
        return 'workoutLogId' in routine;
    }

}