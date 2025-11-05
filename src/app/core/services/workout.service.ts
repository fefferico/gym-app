// src/app/core/services/workout.service.ts
import { Injectable, Injector, inject } from '@angular/core';
import { BehaviorSubject, firstValueFrom, Observable, of, Subject, throwError } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

import { AnyScheme, AnyTarget, AnyTargetType, DISTANCE_TARGET_SCHEMES, DistanceTarget, DistanceTargetScheme, DistanceTargetType, DURATION_TARGET_SCHEMES, DurationTarget, DurationTargetScheme, DurationTargetType, ExerciseTargetSetParams, METRIC, PausedWorkoutState, REPS_TARGET_SCHEMES, RepsTarget, RepsTargetScheme, RepsTargetType, REST_TARGET_SCHEMES, RestTarget, RestTargetScheme, RestTargetType, Routine, WEIGHT_TARGET_SCHEMES, WeightTarget, WeightTargetScheme, WeightTargetType, WorkoutExercise } from '../models/workout.model'; // Ensure this path is correct
import { StorageService } from './storage.service';
import { LoggedSet, LoggedWorkoutExercise, WorkoutLog } from '../models/workout-log.model';
import { AlertService } from './alert.service';
import { ROUTINES_DATA } from './routines-data';
import { ToastService } from './toast.service';
import { ProgressiveOverloadService, ProgressiveOverloadStrategy } from './progressive-overload.service.ts';
import { AppSettingsService } from './app-settings.service';
import { Router } from '@angular/router';
import { UnitsService } from './units.service';
import { AlertButton, AlertInput } from '../models/alert.model';
import { Exercise } from '../models/exercise.model';
import { SubscriptionService } from './subscription.service';
import { TranslateService } from '@ngx-translate/core';
import { mapLoggedSetToExerciseTargetSetParams, mapLoggedWorkoutExerciseToWorkoutExercise, mapWorkoutExerciseToLoggedWorkoutExercise } from '../models/workout-mapper';
import { ExerciseService } from './exercise.service';
import { compareRepsTargets, migrateSetRepsToRepsTarget, repsTypeToReps, repsTargetToExactRepsTarget, genRepsTypeFromRepsNumber, repsToExact, compareDurationTargets, compareDistanceTargets, compareWeightTargets, getDurationValue, genDurationTypeFromDurationNumber, getRestValue, weightToExact, restToExact, distanceToExact, durationToExact, getWeightValue, getDistanceValue, migrateSetWeightToWeightTarget, migrateSetDurationToDurationTarget, migrateSetDistanceToDistanceTarget, migrateSetRestToRestTarget } from './workout-helper.service';

@Injectable({
  providedIn: 'root',
})
export class WorkoutService {
  private storageService = inject(StorageService);
  private appSettingsService = inject(AppSettingsService);
  private injector = inject(Injector);

  private _exerciseService: ExerciseService | undefined;
  private get exerciseService(): ExerciseService {
    if (!this._exerciseService) {
      this._exerciseService = this.injector.get(ExerciseService);
    }
    return this._exerciseService;
  }

  private router = inject(Router);
  private alertService = inject(AlertService);
  private unitsService = inject(UnitsService);
  private translate = inject(TranslateService);
  protected subscriptionService = inject(SubscriptionService);
  private readonly ROUTINES_STORAGE_KEY = 'fitTrackPro_routines';
  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';
  private readonly PAUSED_STATE_VERSION = '1.2';

  private toastService = inject(ToastService);
  private progressiveOverloadService = inject(ProgressiveOverloadService); // +++ INJECT THE SERVICE

  // Using a BehaviorSubject to make routines reactively available and to update them
  // It's initialized by loading routines from storage.
  private routinesSubject = new BehaviorSubject<Routine[]>(this.loadRoutinesFromStorage());

  // Public observable that components can subscribe to
  public routines$: Observable<Routine[]> = this.routinesSubject.asObservable();

  private isLoadingRoutinesSubject = new BehaviorSubject<boolean>(true); // Start as true
  public isLoadingRoutines$: Observable<boolean> = this.isLoadingRoutinesSubject.asObservable();

  private _pausedWorkoutDiscarded = new Subject<void>();
  pausedWorkoutDiscarded$ = this._pausedWorkoutDiscarded.asObservable();

  constructor() {
    this.isLoadingRoutinesSubject.next(true);

    // 1. Load initial routines from storage (this now includes sorting)
    const routinesFromStorage = this.loadRoutinesFromStorage();

    // 2. Initialize the BehaviorSubject with the sorted routines
    this.routinesSubject = new BehaviorSubject<Routine[]>(routinesFromStorage);
    this.routines$ = this.routinesSubject.asObservable().pipe(
      shareReplay(1)
    );

    // 3. Seed new data if necessary. The save method inside will handle re-sorting.
    this._seedAndMergeRoutinesFromStaticData(routinesFromStorage);
  }

  /**
   * --- NEW PUBLIC METHOD ---
   * Manually triggers a re-sorting of the current routines list and emits
   * the newly sorted array to all subscribers. This is useful when an external
   * service (like TrackingService) modifies a property on a routine that affects its sort order.
   */
  public refreshRoutinesSort(): void {
    const currentRoutines = this.routinesSubject.getValue();
    // This call handles both sorting and emitting the new array reference
    this._saveRoutinesToStorage(currentRoutines);
    console.log('WorkoutService: Routines list re-sorted and refreshed.');
  }

  // Add this helper method inside your WorkoutService class
  private _sortRoutines(routines: Routine[]): Routine[] {
    // Use slice() to create a shallow copy to avoid mutating the original array
    return routines.slice().sort((a, b) => {
      // 1. Primary Sort: Favourites on top
      if (a.isFavourite && !b.isFavourite) {
        return -1;
      }
      if (!a.isFavourite && b.isFavourite) {
        return 1;
      }

      // If favourite status is the same, proceed to the next sort criteria.

      // 2. Secondary Sort: Last Performed Date (most recent first)
      const aHasDate = !!a.lastPerformed;
      const bHasDate = !!b.lastPerformed;

      if (aHasDate && !bHasDate) {
        return -1; // 'a' has a date, 'b' does not, so 'a' comes first.
      }
      if (!aHasDate && bHasDate) {
        return 1;  // 'b' has a date, 'a' does not, so 'b' comes first.
      }
      if (aHasDate && bHasDate) {
        // If both have dates, sort descending (most recent date first).
        // A direct string comparison on ISO dates works for this.
        const dateComparison = b.lastPerformed!.localeCompare(a.lastPerformed!);
        if (dateComparison !== 0) {
          return dateComparison;
        }
      }

      // If dates are the same (or both are null/undefined), proceed to the final sort.

      // 3. Tertiary Sort: Alphabetical by name
      return a.name.localeCompare(b.name);
    });
  }

  private loadRoutinesFromStorage(): Routine[] {
    let routines = this.storageService.getItem<Routine[]>(this.ROUTINES_STORAGE_KEY);
    return routines ? this._sortRoutines(routines) : [];
  }

  private _saveRoutinesToStorage(routines: Routine[]): void {
    const sortedRoutines = this._sortRoutines(routines);
    this.storageService.setItem(this.ROUTINES_STORAGE_KEY, sortedRoutines);
    this.routinesSubject.next(sortedRoutines);
  }

  /**
* Merges routines from the static ROUTINES_DATA constant with existing routines from storage.
* This is a synchronous operation and does not involve HTTP requests.
* @param existingRoutines Routines already loaded from storage.
*/
  private _seedAndMergeRoutinesFromStaticData(existingRoutines: Routine[]): void {
    try {
      const assetRoutines = ROUTINES_DATA as Routine[];
      // Migrate asset routines before comparing/merging
      const migratedAssetRoutines = this._migrateRoutines(assetRoutines);

      const existingRoutineIds = new Set(existingRoutines.map(r => r.id));
      const newRoutinesToSeed = migratedAssetRoutines.filter(
        assetRoutine => !existingRoutineIds.has(assetRoutine.id)
      );

      if (newRoutinesToSeed.length > 0) {
        console.log(`Seeding ${newRoutinesToSeed.length} new routines from static data`);
        const mergedRoutines = [...existingRoutines, ...newRoutinesToSeed];

        // This single call now handles sorting, saving, and updating the subject
        this.saveRoutinesToStorage(mergedRoutines);
      } else {
        console.log("No new routines to seed from static data. All are present in storage");
      }
    } catch (error) {
      console.error('Failed to process or seed routines from static data:', error);
    } finally {
      this.isLoadingRoutinesSubject.next(false);
    }
  }

  private saveRoutinesToStorage(routines: Routine[]): void {
    this.storageService.setItem(this.ROUTINES_STORAGE_KEY, routines);
    this.routinesSubject.next([...this._sortRoutines(routines)]);
  }

  public getCurrentRoutines(): Routine[] {
    return this.routinesSubject.getValue();
  }

  getRoutineById(id: string): Observable<Routine | undefined> {
    return this.routines$.pipe(
      map(routines => routines.find(r => r.id === id))
    );
  }

  /**
   * Synchronously retrieves a routine from the current state.
   * Useful for internal service helpers where the data is already loaded.
   * @param id The ID of the routine to retrieve.
   * @returns The Routine object or undefined if not found.
   */
  public getRoutineByIdSync(id: string): Routine | undefined {
    return this.routinesSubject.getValue().find(r => r.id === id);
  }

  addRoutine(newRoutineData: Omit<Routine, 'id'>): Routine {
    const currentRoutines = this.routinesSubject.getValue();
    const newRoutine: Routine = {
      ...newRoutineData,
      id: uuidv4(),
    };
    const updatedRoutines = [...currentRoutines, newRoutine];
    this.saveRoutinesToStorage(updatedRoutines);
    console.log('Added routine:', newRoutine);
    return newRoutine;
  }

  async updateRoutine(updatedRoutine: Routine, force: boolean = false): Promise<Routine | undefined> {
    let currentRoutines = this.routinesSubject.getValue();
    let index = currentRoutines.findIndex(r => r.id === updatedRoutine.id);

    if (!force) {
      // check paused routine
      const pausedRoutine = this.isPausedSession() ? this.getPausedSession() : null;
      let alertResult = false;
      if (pausedRoutine && pausedRoutine.routineId && pausedRoutine.routineId === updatedRoutine.id) {
        await this.alertService.showAlert(
          this.translate.instant('workoutService.alerts.editRunningTitle'),
          this.translate.instant('workoutService.alerts.editRunningMessage')
        ).then(() => {
          alertResult = true;
          index = -1;
          return;
        })
      }

      if (alertResult) {
        return;
      }
    }

    if (index > -1) {
      const updatedRoutinesArray = [...currentRoutines];
      // Ensure the updated routine also goes through migration, in case it's from an old format somewhere
      updatedRoutinesArray[index] = this._migrateRoutines([updatedRoutine])[0]; // Wrap in array for migration helper
      this.saveRoutinesToStorage(updatedRoutinesArray);
      console.log('Updated routine:', updatedRoutine);
      return updatedRoutine;
    }
    this.toastService.error(
      this.translate.instant('workoutService.toasts.updateErrorMessage', { id: updatedRoutine.id }),
      4000,
      this.translate.instant('workoutService.toasts.updateErrorTitle')
    );
    return undefined;
  }

  deleteRoutine(id: string): void {
    const currentRoutines = this.routinesSubject.getValue();
    const updatedRoutines = currentRoutines.filter(r => r.id !== id);
    if (updatedRoutines.length < currentRoutines.length) {
      this.saveRoutinesToStorage(updatedRoutines);
      console.log('Deleted routine with id:', id);
    } else {
      console.warn(`WorkoutService: Routine with id ${id} not found for deletion`);
    }
  }

  generateWorkoutExerciseId(): string {
    return uuidv4();
  }

  generateExerciseSetId(): string {
    return uuidv4();
  }

  /**
   * Suggests parameters for the next set based on last performance and user's progressive overload settings.
   * This version handles multiple, simultaneous progression strategies (weight, reps, distance, duration).
   *
   * @param lastPerformedSet The actual performance of the corresponding set last time. Can be null if no history.
   * @param plannedSet The originally planned parameters for the current set (from the routine).
   * @returns Updated ExerciseSetParams with suggested values for the current session.
   */
  suggestNextSetParameters(
    lastPerformedSet: LoggedSet | null,
    plannedSet: ExerciseTargetSetParams,
  ): ExerciseTargetSetParams {
    // Start with a copy of the planned set. This is our fallback.
    const suggestedParams: ExerciseTargetSetParams = JSON.parse(JSON.stringify(plannedSet));

    // Get the user's progressive overload settings
    const poSettings = this.progressiveOverloadService.getSettings();

    // --- GUARD CLAUSES ---
    // 1. If PO is disabled or no strategies are selected, do nothing.
    if (!poSettings.enabled || !poSettings.strategies || poSettings.strategies.length === 0) {
      // console.log('Progressive Overload disabled or no strategy set. Using planned set.');
      return suggestedParams;
    }

    // 2. If there's no history for this set, we can't make a suggestion.
    if (!lastPerformedSet) {
      // console.log('No last performance found. Using planned set.');
      return suggestedParams;
    }

    // --- MAIN PROGRESSION LOGIC ---
    // Definition of success: meeting or exceeding any of the planned targets for that set.
    // Note: This assumes cardio duration is logged in 'repsLogged' and distance in 'weightLogged'.
    const wasSuccessful = (
      // Reps check
      (plannedSet.targetReps && lastPerformedSet.repsLogged && compareRepsTargets(lastPerformedSet.repsLogged, plannedSet.targetReps) >= 0) ||

      // Duration check (uses durationLogged from log)
      (plannedSet.targetDuration && lastPerformedSet.durationLogged && compareDurationTargets(lastPerformedSet.durationLogged, plannedSet.targetDuration) >= 0) ||

      // Distance check (uses distanceLogged from log)
      (plannedSet.targetDistance && lastPerformedSet.distanceLogged && compareDistanceTargets(lastPerformedSet.distanceLogged, plannedSet.targetDistance) >= 0) ||

      // Distance check (uses weightLogged from log)
      (plannedSet.targetWeight && lastPerformedSet.weightLogged && compareWeightTargets(lastPerformedSet.weightLogged, plannedSet.targetWeight) >= 0)
    );

    if (wasSuccessful) {
      // console.log(`PO Suggestion: Success last time. Applying progression for strategies: [${poSettings.strategies.join(', ')}]`);

      // Apply increments based on all active strategies
      poSettings.strategies.forEach(strategy => {
        switch (strategy) {
          case ProgressiveOverloadStrategy.WEIGHT:
            if (poSettings.weightIncrement && lastPerformedSet.weightLogged != null) {
              suggestedParams.targetWeight = weightToExact(parseFloat((getWeightValue(lastPerformedSet.weightLogged) + poSettings.weightIncrement).toFixed(2)));
            }
            break;
          case ProgressiveOverloadStrategy.REPS:
            if (poSettings.repsIncrement && lastPerformedSet.repsLogged != null) {
              const targetReps = (suggestedParams.targetReps || lastPerformedSet.repsLogged) as RepsTarget;
              let val: number = 0;
              if (targetReps.type === RepsTargetType.exact) {
                targetReps.value = targetReps.value + poSettings.repsIncrement;
              } else if (targetReps.type === RepsTargetType.range) {
                targetReps.min = targetReps.min + poSettings.repsIncrement;
              }
              suggestedParams.targetReps = targetReps;
            }
            break;
          case ProgressiveOverloadStrategy.DURATION:
            if (poSettings.durationIncrement && lastPerformedSet.durationLogged != null) {
              suggestedParams.targetDuration = durationToExact(getDurationValue((suggestedParams.targetDuration || lastPerformedSet.durationLogged)) + poSettings.durationIncrement);
            }
            break;
          case ProgressiveOverloadStrategy.DISTANCE:
            if (poSettings.distanceIncrement && lastPerformedSet.weightLogged != null) {
              suggestedParams.targetDistance = distanceToExact(parseFloat((getDistanceValue(suggestedParams.targetDistance || lastPerformedSet.distanceLogged) + poSettings.distanceIncrement).toFixed(2)));
            }
            break;
        }
      });
    } else {
      // FAILURE: Stick to the same parameters they used last time, but aim for the planned targets again.
      console.log(`PO Suggestion: Failure last time. Sticking to previous attempt's parameters.`);
      suggestedParams.targetWeight = plannedSet.targetWeight;
      suggestedParams.targetReps = plannedSet.targetReps;
      suggestedParams.targetDuration = plannedSet.targetDuration;
      suggestedParams.targetDistance = plannedSet.targetDistance;
    }

    // Ensure the original planned set ID is preserved
    suggestedParams.id = plannedSet.id;

    return suggestedParams;
  }

  /** Returns the current list of routines for backup */
  public getDataForBackup(): Routine[] {
    return this.routinesSubject.getValue(); // Get current value from BehaviorSubject
  }

  /**
   * Merges imported routine data with the current data.
   * - If an imported routine has an ID that already exists, it will be updated.
   * - If an imported routine has a new ID, it will be added.
   * - **This method now migrates legacy properties before merging.**
   * - After merging, the entire list is re-sorted and saved.
   *
   * @param newRoutines The array of Routine objects to merge.
   */
  public mergeData(newRoutines: Routine[]): void {
    // 1. Basic validation
    if (!Array.isArray(newRoutines)) {
      this.toastService.error(
        this.translate.instant('workoutService.toasts.importFailed'),
        0,
        this.translate.instant('workoutService.toasts.importErrorTitle')
      );
      return;
    }

    // 2. *** THE FIX IS HERE: Migrate the imported data first ***
    const migratedRoutines = this._migrateRoutines(newRoutines);

    // 3. Get current state
    const currentRoutines = this.routinesSubject.getValue();

    // 4. Create a map of current routines for efficient lookup and update
    const routineMap = new Map<string, Routine>(
      currentRoutines.map(p => [p.id, p])
    );

    let updatedCount = 0;
    let addedCount = 0;

    // 5. Iterate over the MIGRATED routines and merge them into the map
    migratedRoutines.forEach(importedRoutine => {
      if (!importedRoutine.id || !importedRoutine.name) {
        console.warn('Skipping invalid routine during import:', importedRoutine);
        return;
      }

      if (routineMap.has(importedRoutine.id)) {
        updatedCount++;
      } else {
        addedCount++;
      }
      // Overwrite existing or add new
      routineMap.set(importedRoutine.id, importedRoutine);
    });

    // 6. Convert the map back to an array
    const mergedRoutines = Array.from(routineMap.values());

    // 7. Pass the newly merged array through the sorting function before saving.
    this._saveRoutinesToStorage(this._sortRoutines(mergedRoutines));

    // 8. Provide user feedback
    console.log(`WorkoutService: Merged imported routines. Updated: ${updatedCount}, Added: ${addedCount}`);
    this.toastService.success(
      this.translate.instant('workoutService.toasts.importSuccessMessage', { updatedCount, addedCount }),
      6000,
      this.translate.instant('workoutService.toasts.importSuccessTitle')
    );
  }


  clearAllRoutines_DEV_ONLY(): Promise<void> {
    const title = this.translate.instant('workoutService.alerts.clearAllTitle');
    return this.alertService.showConfirm(title, this.translate.instant('workoutService.alerts.clearAllMessage'))
      .then(async (result) => {
        if (result && result.data) {
          this.saveRoutinesToStorage([]);
          await this.alertService.showAlert(title, this.translate.instant('workoutService.alerts.clearAllSuccess'));
        }
      });
  }

  clearAllExecutedRoutines_DEV_ONLY(): Promise<void> {
    return this.alertService.showConfirm("Info", "Are you sure you want to reset the 'lastPerformed' property of ALL routines LOGS? This cannot be undone.")
      .then(async (result) => { // Added async for await
        if (result && (result.data)) {
          this.getCurrentRoutines().forEach(routine => {
            routine.lastPerformed = undefined;
            this.updateRoutine(routine);
          });
          await this.alertService.showAlert("Info", "All routines logs cleared!");
        }
      })
  }










  /**
  * --- FUNCTION 1 (Updated) ---
  * Estimates the "working time" for a single set in seconds.
  * 
  * - It calculates an estimated time based on the number of reps.
  * - It considers the explicitly set `duration`.
  * - It returns the HIGHER of the two values to provide a more realistic estimate,
  *   especially for AMRAPs or sets with both rep and time targets.
  *
  * @param set The ExerciseSetParams object for a single set.
  * @returns The estimated working time in seconds.
  */
  public getEstimatedWorkTimeForSet(set: ExerciseTargetSetParams): number {
    let timeFromReps = 0;

    // 1. Calculate the estimated time from reps, if reps are specified.
    if ((!set.targetReps || repsTypeToReps(set.targetReps) <= 0) && (set.targetReps?.type === RepsTargetType.range)) {
      // Use the average of min and max if both are defined and > 0
      set.targetReps = repsToExact(Math.round((set.targetReps.min + set.targetReps.max) / 2));
    } else if ((!set.targetReps || repsTypeToReps(set.targetReps) <= 0) && (set.targetReps?.type === RepsTargetType.range && set.targetReps.min)) {
      // Use min if only min is defined
      set.targetReps = repsToExact(set.targetReps.min);
    } else if ((!set.targetReps || repsTypeToReps(set.targetReps) <= 0) && (set.targetReps?.type === RepsTargetType.range && set.targetReps.max)) {
      // Use max if only max is defined
      set.targetReps = repsToExact(set.targetReps.max);
    }

    if (set.targetReps && repsTypeToReps(set.targetReps) > 0) {
      // Estimate ~4 seconds per rep. Adjust as needed.
      const timePerRep = 4;
      timeFromReps = repsTypeToReps(set.targetReps) * timePerRep;
    }

    // 2. Get the duration specified in the set, defaulting to 0 if not present.
    const timeFromDuration = set.targetDuration || genDurationTypeFromDurationNumber(0);

    // 3. Compare the two calculated times and return the greater value.
    const estimatedTime = Math.max(timeFromReps, getDurationValue(timeFromDuration));

    // 4. Handle edge cases where neither reps nor duration are set.
    if (estimatedTime > 0) {
      // Return the calculated time, but with a minimum floor (e.g., 5s) 
      // to account for setup for very short sets.
      return Math.max(estimatedTime, 30);
    }

    // 5. Fallback for sets with no duration AND no reps (e.g., a "carry to failure").
    // Assume a default time, e.g., 30 seconds.
    return 30;
  }


  /**
   * --- FUNCTION 2 ---
   * Extracts the "resting time" for a single set in seconds.
   * 
   * This is straightforward as it's directly defined by `targetRest`.
   *
   * @param set The ExerciseSetParams object for a single set.
   * @returns The planned resting time in seconds after the set is completed.
   */
  public getRestTimeForSet(set: ExerciseTargetSetParams): number {
    return getRestValue(set.targetRest) || 0;
  }


  /**
 * Estimates the total time to complete an entire routine in minutes.
 * This version correctly handles standard exercises, standard supersets, and EMOM supersets.
 * The rest time after the very last set of the entire routine is NOT included.
 *
 * @param routine The full Routine object.
 * @returns The total estimated duration in minutes.
 */
  public getEstimatedRoutineDuration(routine: Routine): number {
    if (!routine || !routine.exercises || routine.exercises.length === 0) {
      return 0;
    }

    let totalSeconds = 0;
    const exercises = routine.exercises;
    const processedSupersetIds = new Set<string>();

    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i];

      if (exercise.supersetId && processedSupersetIds.has(exercise.supersetId)) {
        continue; // Skip if this superset group has already been processed
      }

      if (exercise.supersetId) {
        // --- SUPERSET OR EMOM BLOCK ---
        processedSupersetIds.add(exercise.supersetId);
        const groupExercises = exercises.filter(ex => ex.supersetId === exercise.supersetId);
        const firstExerciseInGroup = groupExercises.find(ex => ex.supersetOrder === 0);

        if (!firstExerciseInGroup) {
          i += groupExercises.length - 1; // Skip malformed group
          continue;
        }

        const totalRounds = firstExerciseInGroup.sets.length;
        const isLastBlock = (i + groupExercises.length) >= exercises.length;

        if (firstExerciseInGroup.supersetType === 'emom') {
          // --- EMOM LOGIC ---
          const emomTimePerRound = firstExerciseInGroup.emomTimeSeconds || 60;
          const blockDuration = emomTimePerRound * totalRounds;
          totalSeconds += blockDuration;

          // Add rest after the entire block, unless it's the end of the workout.
          if (!isLastBlock) {
            const lastExerciseInGroup = groupExercises[groupExercises.length - 1];
            const lastSetOfBlock = lastExerciseInGroup.sets[totalRounds - 1];
            totalSeconds += this.getRestTimeForSet(lastSetOfBlock);
          }
        } else {
          // --- STANDARD SUPERSET LOGIC ---
          for (let r = 0; r < totalRounds; r++) {
            groupExercises.forEach((groupEx, groupExIndex) => {
              const setForThisRound = groupEx.sets[r];
              if (setForThisRound) {
                totalSeconds += this.getEstimatedWorkTimeForSet(setForThisRound);

                const isLastRound = r === totalRounds - 1;
                const isLastExerciseInGroup = groupExIndex === groupExercises.length - 1;

                if (!(isLastRound && isLastExerciseInGroup && isLastBlock)) {
                  totalSeconds += this.getRestTimeForSet(setForThisRound);
                }
              }
            });
          }
        }
        // Advance the main loop to the end of the current superset group
        i += groupExercises.length - 1;
      } else {
        // --- STANDARD EXERCISE BLOCK ---
        exercise.sets.forEach((set, setIndex) => {
          totalSeconds += this.getEstimatedWorkTimeForSet(set);
          const isLastExerciseInRoutine = i === exercises.length - 1;
          const isLastSet = setIndex === exercise.sets.length - 1;
          if (!(isLastExerciseInRoutine && isLastSet)) {
            totalSeconds += this.getRestTimeForSet(set);
          }
        });
      }
    }

    return Math.round(totalSeconds / 60);
  }


  startWorkout(): void {

  }

  checkPlayerMode(newRoutineId: string): string {
    const routine = this.getCurrentRoutines().find(routine => routine.id === newRoutineId);
    const freeTierPlayerMode = 'compact';
    const playerMode = !this.subscriptionService.isPremium() ? freeTierPlayerMode : this.appSettingsService.getSettings() ? this.appSettingsService.getSettings().playerMode : freeTierPlayerMode;
    const isTabata = this.subscriptionService.isPremium() && routine?.goal === 'tabata';
    let url = '';

    if (isTabata) {
      return '/workout/play/tabata';
    } else {
      if (playerMode === 'focus') {
        return '/workout/play/focus';
      } else {
        return '/workout/play/compact';
      }
    }

  }

  // { queryParams: { newSession: 'true' } }
  async navigateToPlayer(newRoutineId: string, params?: any): Promise<void> {
    let playerRoute = this.checkPlayerMode(newRoutineId);
    const forceNavigation = params && params.forceNavigation;
    const pausedResult = await this.checkForPausedSession(forceNavigation);
    if (pausedResult) {
      const pausedRoutineId = pausedResult.routineId || '-1';
      playerRoute = this.checkPlayerMode(pausedRoutineId);
      // this.removePausedWorkout();
      this.router.navigate([playerRoute, pausedRoutineId], { queryParams: { resume: 'true' } });
    } else {
      this.router.navigate([playerRoute, newRoutineId], params ? params : {});
    }
  }

  removePausedWorkout(showAlert: boolean = true): void {
    this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
    this._pausedWorkoutDiscarded.next();
    if (!showAlert) return;
    // this.toastService.info(this.translate.instant('workoutService.toasts.pausedDiscarded'));
  }

  savePausedWorkout(stateToSave: PausedWorkoutState): void {
    if (stateToSave) {
      this.storageService.setItem(this.PAUSED_WORKOUT_KEY, stateToSave);
    }
  }

  isPausedSession(): boolean {
    return !!this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);
  }

  getPausedVersion(): string {
    return this.storageService.getItem<string>(this.PAUSED_STATE_VERSION) || '1.0';
  }

  getPausedSession(): PausedWorkoutState | null {
    return this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);
  }

  private async checkForPausedSession(forceNavigation: boolean = false): Promise<PausedWorkoutState | undefined> {
    const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);

    if (pausedState) {
      if (forceNavigation) {
        return pausedState;
      }
      const confirmation = await this.alertService.showConfirmationDialog(
        this.translate.instant('workoutService.alerts.resume.title'),
        this.translate.instant('workoutService.alerts.resume.message'),
        [
          { text: this.translate.instant('workoutService.alerts.resume.resumeButton'), role: "confirm", data: true, icon: 'play' },
          { text: this.translate.instant('workoutService.alerts.resume.discardButton'), role: "cancel", data: false, icon: 'trash' }
        ]
      );
      if (confirmation?.data) {
        return pausedState;
      } else {
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        return undefined;
      }
    }
    return undefined;
  }

  public async promptAndCreateWorkoutExercise(
    selectedExercise: Exercise,
    lastLoggedSet: LoggedSet | null
  ): Promise<WorkoutExercise | null> {
    const isCardioOnly = selectedExercise.category === 'cardio';
    const kbRelated = selectedExercise.category === 'kettlebells';

    // Determine default values based on the last logged set or general defaults
    const defaultWeight: number = kbRelated && lastLoggedSet ? getWeightValue(lastLoggedSet.targetWeight ?? lastLoggedSet.weightLogged) : (this.unitsService.currentWeightUnit() === 'kg' ? 10 : 22.2);
    const defaultDuration = isCardioOnly ? 60 : undefined;
    const defaultDistance = isCardioOnly ? 1 : undefined;
    const defaultRest = kbRelated ? 45 : 60;
    const defaultReps: number = kbRelated && lastLoggedSet ? repsTypeToReps(lastLoggedSet.targetReps ?? lastLoggedSet.repsLogged ?? repsToExact(0)) : 10;
    const defaultSets = 3;

    const defaultRepsValue = 5;

    const baseParams: AlertInput[] = [
      { label: this.translate.instant('workoutService.prompts.labels.exerciseName'), name: 'name', type: 'text', value: selectedExercise.name, attributes: { disabled: true } },
      { label: this.translate.instant('workoutService.prompts.labels.numSets'), name: 'numSets', type: 'number', value: defaultSets, attributes: { min: 1, required: true } },
      { label: this.translate.instant('workoutService.prompts.labels.rest'), name: METRIC.rest, type: 'number', value: defaultRest, attributes: { min: 1, required: true } }
    ];

    // Define the input fields for the alert prompt
    const exerciseParams: AlertInput[] = isCardioOnly
      ? [
        ...baseParams,
        { label: this.translate.instant('workoutService.prompts.labels.targetDistance', { unit: this.unitsService.getDistanceMeasureUnitSuffix() }), name: METRIC.distance, type: 'number', value: defaultDistance, attributes: { min: 0, required: true } },
        { label: this.translate.instant('workoutService.prompts.labels.targetDuration'), name: METRIC.duration, type: 'number', value: defaultDuration, attributes: { min: 0, required: true } },
      ]
      : [
        ...baseParams,
        { label: this.translate.instant('workoutService.prompts.labels.numReps'), name: 'numReps', type: 'number', value: defaultRepsValue, attributes: { min: 0, required: true } },
        { label: this.translate.instant('workoutService.prompts.labels.targetWeight', { unit: this.unitsService.getWeightUnitSuffix() }), name: METRIC.weight, type: 'number', value: defaultWeight, attributes: { min: 0, required: true } },
      ];

    const exerciseData = await this.alertService.showPromptDialog(
      this.translate.instant('workoutService.prompts.addExerciseTitle', { exerciseName: selectedExercise.name }),
      '',
      exerciseParams
    );

    if (!exerciseData) {
      // this.toastService.info("Exercise addition cancelled.", 2000);
      return null;
    }

    const exerciseName = String(exerciseData['name']).trim() || selectedExercise.name;
    const numSets = parseInt(String(exerciseData['numSets'])) || defaultSets;
    const numReps = parseInt(String(exerciseData['numReps'])) || defaultRepsValue;
    const weight = weightToExact(parseFloat(String(exerciseData[METRIC.weight]))) ?? defaultWeight;
    const distance = distanceToExact(parseInt(String(exerciseData[METRIC.distance]))) || distanceToExact(defaultDistance);
    const duration = durationToExact(parseInt(String(exerciseData[METRIC.duration]))) || durationToExact(defaultDuration);
    const rest = restToExact(parseInt(String(exerciseData[METRIC.rest]))) || restToExact(defaultRest);

    const newExerciseSets: ExerciseTargetSetParams[] = [];
    for (let i = 0; i < numSets; i++) {
      newExerciseSets.push({
        id: `custom-set-${uuidv4()}`,
        targetReps: isCardioOnly ? undefined : genRepsTypeFromRepsNumber(numReps),
        fieldOrder: isCardioOnly ? [METRIC.duration] : [METRIC.reps, METRIC.weight],
        targetWeight: isCardioOnly ? undefined : weight,
        targetDistance: isCardioOnly ? distance : undefined,
        targetDuration: isCardioOnly ? duration : undefined,
        targetRest: rest,
        type: 'standard',
        notes: ''
      });
    }

    const newWorkoutExercise: WorkoutExercise = {
      id: `custom-exercise-${uuidv4()}`,
      exerciseId: selectedExercise.id,
      exerciseName: exerciseName,
      sets: newExerciseSets,
      supersetId: null,
      supersetOrder: null,
      sessionStatus: 'pending',
      type: 'standard'
    };

    return newWorkoutExercise;
  }

  /**
 * Helper to check if all properties of an object are falsy.
 */
  areAllPropertiesFalsy(obj: any): boolean {
    return Object.values(obj).every(value => !value);
  }

  /**
   * Helper to reorder an array of exercises to keep superset groups contiguous.
   */
  reorderExercisesForSupersets(exercises: WorkoutExercise[]): WorkoutExercise[] {
    const reordered: WorkoutExercise[] = [];
    const processedIds = new Set<string>();

    for (const exercise of exercises) {
      if (processedIds.has(exercise.id)) continue;

      if (exercise.supersetId) {
        const group = exercises
          .filter(ex => ex.supersetId === exercise.supersetId)
          .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0));
        group.forEach(ex => {
          reordered.push(ex);
          processedIds.add(ex.id);
        });
      } else {
        reordered.push(exercise);
        processedIds.add(exercise.id);
      }
    }
    return reordered;
  }

  /**
   * Orchestrates the creation of a superset through a UI prompt.
   * This function is self-contained and does not depend on component state.
   *
   * @param routine The current workout routine object.
   * @param exIndex The index of the exercise initiating the action.
   * @param loggedExercisesToExclude The current array of logged exercises for the session.
   * @param alertService An instance of the AlertService for UI prompts.
   * @param toastService An instance of the ToastService for user feedback.
   * @returns A promise that resolves with the updated routine and logged exercises, or null if cancelled.
   */
  public async createSuperset(
    routine: Routine,
    exIndex: number,
    loggedExercisesToExclude: LoggedWorkoutExercise[]
  ): Promise<{ updatedRoutine: Routine; updatedLoggedExercises: LoggedWorkoutExercise[], newSupersetId: string } | null> {
    const availableExercises = routine.exercises
      .map((ex, index) => ({ ...ex, originalIndex: index }))
      .filter(ex => !ex.supersetId);

    const exerciseInputs: AlertInput[] = availableExercises.map(exer => ({
      label: exer.exerciseName,
      name: String(exer.originalIndex),
      type: 'checkbox',
      value: exer.originalIndex === exIndex, // Pre-check the initiating exercise
    }));

    exerciseInputs.push({
      name: 'supersetRounds',
      type: 'number',
      label: 'Number of Rounds',
      value: '1',
      min: 1,
      placeholder: 'Enter number of rounds',
    });

    const choice = await this.alertService.showPromptDialog(
      'Create Superset',
      'Select exercises to link together.',
      exerciseInputs
    );

    if (!choice || this.areAllPropertiesFalsy(choice)) {
      return null; // User cancelled
    }

    const rounds = Number(choice['supersetRounds']) || 1;
    delete choice['supersetRounds'];

    const selectedOriginalIndices = Object.keys(choice)
      .filter(key => choice[key])
      .map(Number)
      .sort((a, b) => a - b);

    if (selectedOriginalIndices.length < 2) {
      this.toastService.info("Please select at least two exercises to create a superset.");
      return null;
    }

    // Work on copies to avoid side effects until the operation is confirmed
    const updatedRoutine = JSON.parse(JSON.stringify(routine)) as Routine;
    let updatedLogs = [...loggedExercisesToExclude];
    const newSupersetId = uuidv4();
    let currentOrder = 0;

    for (const originalIndex of selectedOriginalIndices) {
      const targetExercise = updatedRoutine.exercises[originalIndex];
      if (targetExercise) {
        // Remove any existing logs for this exercise as its structure is changing
        updatedLogs = updatedLogs.filter(log => log.id !== targetExercise.id);

        const templateSet = targetExercise.sets.length > 0
          ? { ...targetExercise.sets[0] }
          : { id: uuidv4(), targetReps: repsToExact(8), targetWeight: weightToExact(10), targetRest: restToExact(60), type: 'standard' };

        // 1. Define the fieldOrder for this exercise's sets
        const isLastExerciseInGroup = originalIndex === selectedOriginalIndices[selectedOriginalIndices.length - 1];
        const fieldOrder = [METRIC.weight, METRIC.reps];
        if (isLastExerciseInGroup) {
          fieldOrder.push(METRIC.rest);
        }

        // 2. Update exercise properties
        targetExercise.sets = [];
        targetExercise.supersetId = newSupersetId;
        targetExercise.supersetOrder = currentOrder++;
        targetExercise.type = 'superset'; // Ensure type is correctly set

        // 3. Create the new sets, now including the correct fieldOrder
        for (let i = 1; i <= rounds; i++) {
          targetExercise.sets.push({
            ...templateSet,
            id: uuidv4(),
            fieldOrder: fieldOrder // Add the fieldOrder to each new set
          });
        }
      }
    }

    updatedRoutine.exercises = this.reorderExercisesForSupersets(updatedRoutine.exercises);
    this.alertService.showAlert("INFO", `Superset created with ${selectedOriginalIndices.length} exercises and ${rounds} rounds: existing logs were cleared and sets standardized.`);

    return { updatedRoutine, updatedLoggedExercises: updatedLogs, newSupersetId };
  }










  vibrate(): void {
    const currentVibrator = navigator;
    if (currentVibrator && 'vibrate' in currentVibrator) {
      currentVibrator.vibrate(50);
    }
  }



  /**
   * Opens a modal to add a standalone exercise to an existing superset.
   * @returns A promise that resolves with the updated routine, or null if cancelled.
   */
  public async addToSuperset(
    routine: Routine,
    exIndex: number,
    alertService: AlertService,
    toastService: ToastService
  ): Promise<Routine | null> {
    const exerciseToAdd = routine.exercises[exIndex];
    if (exerciseToAdd.supersetId) {
      toastService.info("This exercise is already in a superset.");
      return null;
    }

    const supersetMap = new Map<string, WorkoutExercise[]>();
    routine.exercises.forEach(ex => {
      if (ex.supersetId) {
        if (!supersetMap.has(ex.supersetId)) supersetMap.set(ex.supersetId, []);
        supersetMap.get(ex.supersetId)!.push(ex);
      }
    });

    if (supersetMap.size === 0) {
      toastService.error("No supersets exist to add this exercise to.");
      return null;
    }

    const supersetChoices: AlertInput[] = Array.from(supersetMap.values()).map((group, i) => ({
      name: 'supersetChoice',
      type: 'radio',
      label: `Superset: ${group.map(e => e.exerciseName).join(' & ')}`,
      value: group[0].supersetId!,
      checked: i === 0,
    }));

    const result = await alertService.showPromptDialog('Add to Superset', `Which superset for "${exerciseToAdd.exerciseName}"?`, supersetChoices, 'Add', 'Cancel');

    if (!result || !result['supersetChoice']) return null;

    const chosenSupersetId = result['supersetChoice'];
    const updatedRoutine = JSON.parse(JSON.stringify(routine)) as Routine;
    const targetExercise = updatedRoutine.exercises.find(ex => ex.id === exerciseToAdd.id);
    const existingInSuperset = updatedRoutine.exercises.filter(ex => ex.supersetId === chosenSupersetId);

    if (!targetExercise || existingInSuperset.length === 0) {
      toastService.error("Could not find the target exercise or superset.");
      return null;
    }

    // =================== START OF FIX ===================

    // 1. Forcefully remove METRIC.rest from ALL exercises CURRENTLY in the superset.
    // This ensures a clean state before adding the new exercise.
    existingInSuperset.forEach(groupEx => {
      const exerciseToUpdate = updatedRoutine.exercises.find(ex => ex.id === groupEx.id);
      if (exerciseToUpdate) {
        exerciseToUpdate.sets.forEach(set => {
          if (set.fieldOrder) {
            set.fieldOrder = set.fieldOrder.filter(field => field !== METRIC.rest);
          }
        });
      }
    });

    // 2. Prepare the new exercise that will be added.
    const rounds = existingInSuperset[0].sets.length || 1;
    const templateSet = targetExercise.sets[0] || { id: uuidv4(), targetReps: 8, targetWeight: 10, targetRest: 60, type: 'superset' };

    // 3. Define the fieldOrder for the NEW exercise, which is now the last one.
    // This is the ONLY place where METRIC.rest should be added.
    const newLastExerciseFieldOrder = [METRIC.weight, METRIC.reps, METRIC.rest];

    // 4. Update the new exercise's properties and create its sets with the correct fieldOrder.
    targetExercise.sets = Array.from({ length: rounds }, () => ({
      ...templateSet,
      id: uuidv4(),
      fieldOrder: newLastExerciseFieldOrder
    }));
    targetExercise.supersetId = String(chosenSupersetId);
    targetExercise.supersetOrder = existingInSuperset.length; // It becomes the new last item.
    targetExercise.type = 'superset';

    // =================== END OF FIX ===================

    updatedRoutine.exercises = this.reorderExercisesForSupersets(updatedRoutine.exercises);
    toastService.success(`${targetExercise.exerciseName} added to the superset.`);

    return updatedRoutine;
  }

  /**
   * Removes an exercise from a superset, clearing its logs and dissolving the superset if necessary.
   * @returns A promise resolving with updated routine and logs, or null if cancelled.
   */
  public async removeFromSuperset(
    routine: Routine,
    exIndex: number,
    loggedExercises: LoggedWorkoutExercise[],
    alertService: AlertService,
    toastService: ToastService
  ): Promise<{ updatedRoutine: Routine; updatedLoggedExercises: LoggedWorkoutExercise[] } | null> {
    const exercise = routine.exercises[exIndex];
    if (!exercise.supersetId) return null;

    const confirm = await alertService.showConfirm("Remove from Superset", `Remove ${exercise.exerciseName} from this superset? Its logged sets for this session will be cleared.`);
    if (!confirm?.data) return null;

    const updatedRoutine = JSON.parse(JSON.stringify(routine)) as Routine;
    let updatedLogs = [...loggedExercises];
    const exerciseToRemove = updatedRoutine.exercises[exIndex];
    const supersetId = exerciseToRemove.supersetId!;

    // Clear existing logs for this exercise
    const logIndex = updatedLogs.findIndex(le => le.id === exerciseToRemove.id);
    if (logIndex > -1) {
      updatedLogs.splice(logIndex, 1);
      toastService.info(`Logged data for ${exerciseToRemove.exerciseName} was cleared.`);
    }

    // Reset superset properties on the target exercise
    exerciseToRemove.supersetId = null;
    exerciseToRemove.supersetOrder = null;
    exerciseToRemove.type = 'standard';

    const remainingInSuperset = updatedRoutine.exercises.filter(ex => ex.supersetId === supersetId);

    if (remainingInSuperset.length <= 1) {
      remainingInSuperset.forEach(ex => {
        ex.supersetId = null;
        ex.supersetOrder = null;
        ex.type = 'standard';
      });
      toastService.info("Superset dissolved as only one exercise remains.");
    } else {
      remainingInSuperset
        .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0))
        .forEach((ex, i) => {
          ex.supersetOrder = i;
        });
      toastService.info(`${exerciseToRemove.exerciseName} removed from superset.`);
    }

    updatedRoutine.exercises = this.reorderExercisesForSupersets(updatedRoutine.exercises);
    return { updatedRoutine, updatedLoggedExercises: updatedLogs };
  }

  /**
   * Helper to migrate old ExerciseSetParams fields to new 'target' fields.
   * This now includes logic to map legacy rest properties.
   */
  private _migrateSetParams(set: any): ExerciseTargetSetParams {
    const newSet: any = { ...set };

    migrateSetRepsToRepsTarget(newSet);
    migrateSetWeightToWeightTarget(newSet);
    migrateSetDurationToDurationTarget(newSet);
    migrateSetDistanceToDistanceTarget(newSet);
    migrateSetRestToRestTarget(newSet);

    // --- MIGRATION LOGIC FOR REST ---
    // Handles mapping 'restAfterSet' or 'targetRestAfterSet' to the new 'targetRest' property.
    if (newSet.targetRest === undefined || newSet.targetRest === null) {
      if (typeof newSet.targetRestAfterSet === 'number') {
        newSet.targetRest = newSet.targetRestAfterSet;
      } else if (typeof newSet.restAfterSet === 'number') {
        newSet.targetRest = newSet.restAfterSet;
      }
    }

    // Clean up the old, now-migrated properties from the object.
    delete newSet.targetRestAfterSet;
    delete newSet.restAfterSet;

    // Ensure 'id' exists for all sets
    if (!newSet.id) {
      newSet.id = uuidv4();
    }

    return newSet;
  }

  /**
   * Helper to migrate old Routine structures, specifically ExerciseSetParams.
   */
  private _migrateRoutines(routines: Routine[]): Routine[] {
    if (!routines || routines.length === 0) {
      return [];
    }
    return routines.map(routine => {
      const updatedExercises = routine.exercises.map(exercise => {
        // By calling _migrateSetParams here, the logic is applied to every set.
        const updatedSets = exercise.sets.map(set => this._migrateSetParams(set));
        return { ...exercise, sets: updatedSets };
      });
      return { ...routine, exercises: updatedExercises };
    });
  }

  enableAllRoutines_DEV_ONLY(): void {
    const routines = this.getCurrentRoutines().map(routine => ({ ...routine, isDisabled: false }));
    this._saveRoutinesToStorage(routines);
    this.toastService.success(this.translate.instant('workoutService.toasts.enableAllSuccess'));
  }

  getSupersetSize(routine: Routine | null | undefined, index: number): number {
    const ex = routine?.exercises[index];
    if (!ex?.supersetId) return 0;
    return routine?.exercises.filter(e => e.supersetId === ex.supersetId).length || 0;
  }

  public exerciseNameDisplay(exercise: WorkoutExercise): string {
    if (!exercise || !exercise.exerciseName) return this.translate.instant('workoutService.display.unnamedExercise');

    let tmpExerciseStringName = exercise.exerciseName.trim();
    if (/dumbbell/i.test(tmpExerciseStringName)) {
      tmpExerciseStringName = tmpExerciseStringName.replace(/dumbbell/gi, 'DB');
    }
    if (/kettlebell/i.test(tmpExerciseStringName)) {
      tmpExerciseStringName = tmpExerciseStringName.replace(/kettlebell/gi, 'KB');
    }
    if (/kb/i.test(tmpExerciseStringName)) {
      tmpExerciseStringName = tmpExerciseStringName.replace(/overhead/gi, 'OH');
    }
    if (/alternating/i.test(tmpExerciseStringName)) {
      tmpExerciseStringName = tmpExerciseStringName.replace(/alternating/gi, 'ALT.');
    }


    return tmpExerciseStringName;
  }


  /**
   * --- NEW METHOD for Ghost Loading ---
   * Synchronously returns the first 'n' routines from the current list.
   * This is used for a fast initial render in components.
   * @param count The number of initial routines to return.
   * @returns An array of routines.
   */
  public getInitialRoutines(count: number): Routine[] {
    const allRoutines = this.routinesSubject.getValue();
    return allRoutines.slice(0, count);
  }

 
}