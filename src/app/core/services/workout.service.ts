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
import { compareRepsTargets, migrateSetRepsToRepsTarget, repsTypeToReps, repsTargetToExactRepsTarget, genRepsTypeFromRepsNumber, repsToExact, compareDurationTargets, compareDistanceTargets, compareWeightTargets, getDurationValue, genDurationTypeFromDurationNumber, getRestValue, weightToExact, restToExact, distanceToExact, durationToExact, getWeightValue, getDistanceValue } from './workout-helper.service';

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
  * Generates a display string for a set's planned target, handling ranges and single values.
  * @param set The ExerciseSetParams object from the routine plan.
  * @param field The field to display ('reps', METRIC.duration, or 'weight').
  * @returns A formatted string like "8-12", "60+", "10", or an empty string if no target is set.
  */
  public getSetTargetDisplay(set: ExerciseTargetSetParams, field: METRIC): string {
    // Add a guard clause to prevent errors if an undefined set is passed in.
    if (!set) {
      return '';
    }

    if (field === METRIC.tempo) {
      if (this.isLoggedSet(set)) {
        return set.tempoLogged || '-';
      }
      return set.targetTempo || '-';
    }

    let min = -1;
    let max = -1;
    let single = -1;

    switch (field) {
      case METRIC.reps:
        min = set.targetReps && set.targetReps.type === RepsTargetType.range && set.targetReps.min || 0;
        min = set.targetReps && set.targetReps.type === RepsTargetType.range && set.targetReps.max || 0;
        single = repsTypeToReps(set.targetReps) || 0;
        break;
      case METRIC.duration:
        min = set.targetDuration && set.targetDuration.type === DurationTargetType.range && set.targetDuration.minSeconds || 0;
        min = set.targetDuration && set.targetDuration.type === DurationTargetType.range && set.targetDuration.maxSeconds || 0;
        single = getDurationValue(set.targetDuration) || 0;
        break;
      case METRIC.rest:
        min = set.targetRest && set.targetRest.type === RestTargetType.range && set.targetRest.minSeconds || 0;
        min = set.targetRest && set.targetRest.type === RestTargetType.range && set.targetRest.maxSeconds || 0;
        single = getRestValue(set.targetRest) || 0;
        break;
      case METRIC.weight:
        min = set.targetWeight && set.targetWeight.type === WeightTargetType.range && set.targetWeight.min || 0;
        min = set.targetWeight && set.targetWeight.type === WeightTargetType.range && set.targetWeight.max || 0;
        single = getWeightValue(set.targetWeight) || 0;
        break;
      case METRIC.distance:
        min = set.targetDistance && set.targetDistance.type === DistanceTargetType.range && set.targetDistance.min || 0;
        min = set.targetDistance && set.targetDistance.type === DistanceTargetType.range && set.targetDistance.max || 0;
        single = getDistanceValue(set.targetDistance) || 0;
        break;

      default:
        break;
    }

    // If a range is defined, format it
    if (min != null || max != null) {
      if (min != null && max != null) {
        // Don't show a range if min and max are the same, just show the single value
        return min === max ? (single ?? min).toString() : `${min}-${max}`;
      }
      if (min != null) {
        return `${min}+`;
      }
      if (max != null) {
        return `${this.translate.instant('workoutService.display.upTo')} ${max}`;
      }
    }

    // Fallback to the single value
    return single != null ? `${single}` : '';
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


  /**
   * Helper to migrate old ExerciseSetParams fields to new 'target' fields.
   * This now includes logic to map legacy rest properties.
   */
  private _migrateSetParams(set: any): ExerciseTargetSetParams {
    const newSet: any = { ...set };

    // Migrate 'reps' to 'targetReps' if 'reps' exists and 'targetReps' does not
    if (typeof set.reps === 'number' && typeof newSet.targetReps === 'undefined') {
      newSet.targetReps = set.reps;
      delete newSet[METRIC.reps]; // Remove the old field
    }

    // Migrate 'weight' to 'targetWeight'
    if (typeof set.weight === 'number' && typeof newSet.targetWeight === 'undefined') {
      newSet.targetWeight = set.weight;
      delete newSet[METRIC.weight];
    }

    // Migrate METRIC.duration to 'targetDuration'
    if (typeof set.duration === 'number' && typeof newSet.targetDuration === 'undefined') {
      newSet.targetDuration = set.duration;
      delete newSet[METRIC.duration];
    }

    // Migrate METRIC.distance to 'targetDistance'
    if (typeof set.distance === 'number' && typeof newSet.targetDistance === 'undefined') {
      newSet.targetDistance = set.distance;
      delete newSet[METRIC.distance];
    }

    // +++ USE THE NEW HELPER TO MIGRATE REPS TO THE NEW STRUCTURE +++
    migrateSetRepsToRepsTarget(newSet);
    // +++ END OF CHANGE +++

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
 * A private, synchronous helper that applies a new field and its value to a specific set
 * within a routine object and returns the modified routine.
 */
  private addFieldToSet(
    routine: Routine,
    exIndex: number,
    setIndex: number,
    fieldToAdd: METRIC,
    targetValue: AnyTarget | string | number | boolean
  ): Routine {
    const updatedRoutine = JSON.parse(JSON.stringify(routine)) as Routine;
    const setToUpdate = updatedRoutine.exercises[exIndex].sets[setIndex];

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

        if (this.isLoggedSet(setToUpdate)) {
          setToUpdate.weightLogged = weightTarget;
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

        if (this.isLoggedSet(setToUpdate)) {
          setToUpdate.repsLogged = repsTarget;
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

        if (this.isLoggedSet(setToUpdate)) {
          setToUpdate.distanceLogged = distanceTarget;
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

        if (this.isLoggedSet(setToUpdate)) {
          setToUpdate.durationLogged = durationTarget;
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

        if (this.isLoggedSet(setToUpdate)) {
          setToUpdate.restLogged = restTarget;
        }
        break;
      }
      case METRIC.tempo: {
        const tempoValue = typeof targetValue === 'string' ? targetValue : '';
        setToUpdate.targetTempo = tempoValue;
        if (this.isLoggedSet(setToUpdate)) {
          setToUpdate.tempoLogged = tempoValue;
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

  public getVisibleExerciseColumns(routine: Routine, exIndex: number): { [key: string]: boolean } {
    const exercise = routine.exercises[exIndex];

    if (!exercise || exercise.sets?.length === 0) {
      // Fallback for safety, though it should always find a set.
      return { [METRIC.weight]: false, [METRIC.reps]: false, [METRIC.distance]: false, [METRIC.duration]: false, [METRIC.tempo]: false, [METRIC.rest]: false };
    }

    const wkEx = { ...exercise } as WorkoutExercise;
    const wkExFromLog = { ...mapLoggedWorkoutExerciseToWorkoutExercise(exercise as any) } as WorkoutExercise;

    const visibleExerciseFieldsObj = {
      [METRIC.weight]: wkEx.sets.some(set => (set.targetWeight || wkExFromLog.sets.some(set => (set.targetWeight) || !!(wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.weight)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.weight)))))),
      [METRIC.reps]: wkEx.sets.some(set => (set.targetReps || wkExFromLog.sets.some(set => (set.targetReps) || !!(wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.reps)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.reps)))))),
      [METRIC.distance]: wkEx.sets.some(set => (set.targetDistance || wkExFromLog.sets.some(set => (set.targetDistance) || !!(wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.distance)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.distance)))))),
      [METRIC.duration]: wkEx.sets.some(set => (set.targetDuration || wkExFromLog.sets.some(set => (set.targetDuration) || !!(wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.duration)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.duration)))))),
      [METRIC.rest]: wkEx.sets.some(set => (set.targetRest || wkExFromLog.sets.some(set => (set.targetRest) || !!(wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.rest)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.rest)))))),
      [METRIC.tempo]: wkEx.sets.some(set => !!set.targetTempo && set.targetTempo.trim().length > 0) || wkExFromLog.sets.some(set => !!set.targetTempo && set.targetTempo.trim().length > 0) || !!(wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.tempo)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.tempo))),
    };

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
        [METRIC.weight]: !!((getWeightValue(set.weightLogged) ?? 0) > 0 || set.fieldOrder?.includes(METRIC.weight)),
        [METRIC.reps]: !!((repsTypeToReps(set.repsLogged) ?? 0) > 0 || set.fieldOrder?.includes(METRIC.reps)),
        [METRIC.distance]: !!((getDistanceValue(set.distanceLogged) ?? 0) > 0 || set.fieldOrder?.includes(METRIC.distance)),
        [METRIC.duration]: !!((getDurationValue(set.durationLogged) ?? 0) > 0 || set.fieldOrder?.includes(METRIC.duration)),
        [METRIC.tempo]: !!(set.targetTempo?.trim() || set.fieldOrder?.includes(METRIC.tempo)),
        [METRIC.rest]: !!((getRestValue(set.restLogged) ?? 0) > 0 || set.fieldOrder?.includes(METRIC.rest)),
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
   * --- NEW AND COMPLETE ---
   * Orchestrates adding a new field to a specific set by first asking WHICH field,
   * and then asking for its VALUE.
   * @returns A promise that resolves with the updated Routine object, or null if cancelled.
   */
  public async promptAddField(routine: Routine, exIndex: number, setIndex: number, isPlayer: boolean = false): Promise<Routine | null> {
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
    const numericValue = Number(seconds);
    // Return empty if the value is not a valid number
    if (isNaN(numericValue)) {
      return '';
    }

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
}