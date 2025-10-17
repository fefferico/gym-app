// src/app/core/services/workout.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

import { ExerciseTargetSetParams, METRIC, PausedWorkoutState, Routine, WorkoutExercise } from '../models/workout.model'; // Ensure this path is correct
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

@Injectable({
  providedIn: 'root',
})
export class WorkoutService {
  private storageService = inject(StorageService);
  private appSettingsService = inject(AppSettingsService);
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
    // Note: This assumes cardio duration is logged in 'repsAchieved' and distance in 'weightUsed'.
    const wasSuccessful = (
      // Reps check
      (plannedSet.targetReps && lastPerformedSet.repsAchieved >= plannedSet.targetReps) ||
      (plannedSet.targetRepsMin && lastPerformedSet.repsAchieved >= plannedSet.targetRepsMin) ||

      // Duration check (uses repsAchieved from log)
      (plannedSet.targetDuration && lastPerformedSet.repsAchieved >= plannedSet.targetDuration) ||
      (plannedSet.targetDurationMin && lastPerformedSet.repsAchieved >= plannedSet.targetDurationMin) ||

      // Distance check (uses weightUsed from log)
      (plannedSet.targetDistance && lastPerformedSet.weightUsed && lastPerformedSet.weightUsed >= plannedSet.targetDistance) ||
      (plannedSet.targetDistanceMin && lastPerformedSet.weightUsed && lastPerformedSet.weightUsed >= plannedSet.targetDistanceMin)
    );

    if (wasSuccessful) {
      // console.log(`PO Suggestion: Success last time. Applying progression for strategies: [${poSettings.strategies.join(', ')}]`);

      // Apply increments based on all active strategies
      poSettings.strategies.forEach(strategy => {
        switch (strategy) {
          case ProgressiveOverloadStrategy.WEIGHT:
            if (poSettings.weightIncrement && lastPerformedSet.weightUsed != null) {
              suggestedParams.targetWeight = parseFloat((lastPerformedSet.weightUsed + poSettings.weightIncrement).toFixed(2));
            }
            break;
          case ProgressiveOverloadStrategy.REPS:
            if (poSettings.repsIncrement && lastPerformedSet.repsAchieved != null) {
              suggestedParams.targetReps = (suggestedParams.targetReps || lastPerformedSet.repsAchieved) + poSettings.repsIncrement;
            }
            break;
          case ProgressiveOverloadStrategy.DURATION:
            if (poSettings.durationIncrement && lastPerformedSet.repsAchieved != null) {
              suggestedParams.targetDuration = (suggestedParams.targetDuration || lastPerformedSet.repsAchieved) + poSettings.durationIncrement;
            }
            break;
          case ProgressiveOverloadStrategy.DISTANCE:
            if (poSettings.distanceIncrement && lastPerformedSet.weightUsed != null) {
              suggestedParams.targetDistance = parseFloat(((suggestedParams.targetDistance || lastPerformedSet.weightUsed) + poSettings.distanceIncrement).toFixed(2));
            }
            break;
        }
      });
    } else {
      // FAILURE: Stick to the same parameters they used last time, but aim for the planned targets again.
      console.log(`PO Suggestion: Failure last time. Sticking to previous attempt's parameters.`);
      suggestedParams.targetWeight = plannedSet.targetWeight ?? plannedSet.targetWeightMin;
      suggestedParams.targetReps = plannedSet.targetReps ?? plannedSet.targetRepsMin;
      suggestedParams.targetDuration = plannedSet.targetDuration ?? plannedSet.targetDurationMin;
      suggestedParams.targetDistance = plannedSet.targetDistance ?? plannedSet.targetDistanceMin;
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

    // 2. Get current state
    const currentRoutines = this.routinesSubject.getValue();

    // 3. Create a map of current routines for efficient lookup and update
    const routineMap = new Map<string, Routine>(
      currentRoutines.map(p => [p.id, p])
    );

    let updatedCount = 0;
    let addedCount = 0;

    // 4. Iterate over the imported routines and merge them into the map
    newRoutines.forEach(importedRoutine => {
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

    // 5. Convert the map back to an array
    const mergedRoutines = Array.from(routineMap.values());

    // 6. *** THE FIX IS HERE ***
    // Pass the newly merged array through the sorting function before saving.
    this._saveRoutinesToStorage(this._sortRoutines(mergedRoutines));

    // 7. Provide user feedback
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
    if ((!set.targetReps || set.targetReps <= 0) && (set.targetRepsMin && set.targetRepsMax)) {
      // Use the average of min and max if both are defined and > 0
      set.targetReps = Math.round((set.targetRepsMin + set.targetRepsMax) / 2);
    } else if ((!set.targetReps || set.targetReps <= 0) && set.targetRepsMin) {
      // Use min if only min is defined
      set.targetReps = set.targetRepsMin;
    } else if ((!set.targetReps || set.targetReps <= 0) && set.targetRepsMax) {
      // Use max if only max is defined
      set.targetReps = set.targetRepsMax;
    }

    if (set.targetReps && set.targetReps > 0) {
      // Estimate ~4 seconds per rep. Adjust as needed.
      const timePerRep = 4;
      timeFromReps = set.targetReps * timePerRep;
    }

    // 2. Get the duration specified in the set, defaulting to 0 if not present.
    const timeFromDuration = set.targetDuration || 0;

    // 3. Compare the two calculated times and return the greater value.
    const estimatedTime = Math.max(timeFromReps, timeFromDuration);

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
   * This is straightforward as it's directly defined by `restAfterSet`.
   *
   * @param set The ExerciseSetParams object for a single set.
   * @returns The planned resting time in seconds after the set is completed.
   */
  public getRestTimeForSet(set: ExerciseTargetSetParams): number {
    return set.restAfterSet || 0;
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
    this.toastService.info(this.translate.instant('workoutService.toasts.pausedDiscarded'));
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

  // +++ NEW: Shared method to add an exercise during a workout +++
  public async promptAndCreateWorkoutExercise(
    selectedExercise: Exercise,
    lastLoggedSet: LoggedSet | null
  ): Promise<WorkoutExercise | null> {
    const isCardioOnly = selectedExercise.category === 'cardio';
    const kbRelated = selectedExercise.category === 'kettlebells';

    // Determine default values based on the last logged set or general defaults
    const defaultWeight = kbRelated && lastLoggedSet ? (lastLoggedSet.targetWeight ?? lastLoggedSet.weightUsed) : (this.unitsService.currentWeightUnit() === 'kg' ? 10 : 22.2);
    const defaultDuration = isCardioOnly ? 60 : undefined;
    const defaultDistance = isCardioOnly ? 1 : undefined;
    const defaultRest = kbRelated ? 45 : 60;
    const defaultReps = kbRelated && lastLoggedSet ? (lastLoggedSet.targetReps ?? lastLoggedSet.repsAchieved) : 10;
    const defaultSets = 3;

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
        { label: this.translate.instant('workoutService.prompts.labels.numReps'), name: 'numReps', type: 'number', value: defaultReps, attributes: { min: 0, required: true } },
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
    const numReps = parseInt(String(exerciseData['numReps'])) || defaultReps;
    const weight = parseFloat(String(exerciseData[METRIC.weight])) ?? defaultWeight;
    const distance = parseInt(String(exerciseData[METRIC.distance])) || defaultDistance;
    const duration = parseInt(String(exerciseData[METRIC.duration])) || defaultDuration;
    const rest = parseInt(String(exerciseData[METRIC.rest])) || defaultRest;

    const newExerciseSets: ExerciseTargetSetParams[] = [];
    for (let i = 0; i < numSets; i++) {
      newExerciseSets.push({
        id: `custom-set-${uuidv4()}`,
        targetReps: isCardioOnly ? undefined : numReps,
        targetWeight: isCardioOnly ? undefined : weight,
        targetDistance: isCardioOnly ? distance : undefined,
        targetDuration: isCardioOnly ? duration : undefined,
        restAfterSet: rest,
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
          : { id: uuidv4(), targetReps: 8, targetWeight: 10, restAfterSet: 60, type: 'standard' };

        targetExercise.sets = [];
        targetExercise.supersetId = newSupersetId;
        targetExercise.supersetOrder = currentOrder++;
        targetExercise.type = 'superset';

        for (let i = 1; i <= rounds; i++) {
          targetExercise.sets.push({ ...templateSet, id: uuidv4() });
          // targetExercise.sets.push({ ...templateSet, id: uuidv4(), supersetRound: i });
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

    const newSize = existingInSuperset.length + 1;
    const rounds = existingInSuperset[0].sets.length || 1;
    const templateSet = targetExercise.sets[0] || { id: uuidv4(), targetReps: 8, targetWeight: 10, restAfterSet: 60, type: 'standard' };

    targetExercise.sets = Array.from({ length: rounds }, () => ({ ...templateSet, id: uuidv4() }));
    targetExercise.supersetId = String(chosenSupersetId);
    targetExercise.supersetOrder = existingInSuperset.length;
    targetExercise.type = 'superset';

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
        return set.tempoUsed || '-';
      }
      return set.targetTempo || '-';
    }

    let min = -1;
    let max = -1;
    let single = -1;

    switch (field) {
      case METRIC.reps:
        min = set.targetRepsMin || 0;
        max = set.targetRepsMax || 0;
        single = set.targetReps || 0;
        break;
      case METRIC.duration:
        min = set.targetDurationMin || 0;
        max = set.targetDurationMax || 0;
        single = set.targetDuration || 0;
        break;
      case METRIC.rest:
        single = set.restAfterSet || 0;
        break;
      case METRIC.weight:
        min = set.targetWeightMin || 0;
        max = set.targetWeightMax || 0;
        single = set.targetWeight || 0;
        break;
      case METRIC.distance:
        min = set.targetDistanceMin || 0;
        max = set.targetDistanceMax || 0;
        single = set.targetDistance || 0;
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
   * It prioritizes the actual performed weight ('weightUsed') from a LoggedSet
   * but falls back to the 'targetWeight' for planned sets. It also handles
   * special display cases for different exercise categories.
   *
   * @param set The set data, which can be either a planned set or a logged set.
   * @param exercise The exercise context to determine the category.
   * @returns A formatted string for display (e.g., "100 kg", "Bodyweight", "N/A").
   */
  getWeightDisplay(set: ExerciseTargetSetParams | LoggedSet, exercise: Exercise | WorkoutExercise): string {
    // The 'set' object could be a LoggedSet, which has a 'weightUsed' property.
    // We check for this property to determine which value to prioritize.
    const performedWeight = (set as any).weightUsed;

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
   */
  private _migrateSetParams(set: any): ExerciseTargetSetParams {
    // const newSet: ExerciseSetParams = { ...set };
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
  private addFieldToSet(routine: Routine, exIndex: number, setIndex: number, fieldToAdd: string, targetValue: any): Routine {
    const updatedRoutine = JSON.parse(JSON.stringify(routine)) as Routine;
    const setToUpdate = updatedRoutine.exercises[exIndex].sets[setIndex] as any;

    if (!setToUpdate.fieldOrder) {
      const { visible } = this.getFieldsForSet(routine, exIndex, setIndex);
      setToUpdate.fieldOrder = visible;
    }

    if (!setToUpdate.fieldOrder.includes(fieldToAdd)) {
      setToUpdate.fieldOrder.push(fieldToAdd);
    }

    const stringValue = (fieldToAdd === METRIC.tempo || fieldToAdd === 'notes') ? String(targetValue) : '';
    const numberValue = (fieldToAdd !== METRIC.tempo && fieldToAdd !== 'notes') ? Number(targetValue) : null;

    switch (fieldToAdd) {
      case METRIC.weight: {
        setToUpdate.targetWeight = numberValue;
        setToUpdate.weightUsed = numberValue;
        break;
      }
      case METRIC.reps: {
        setToUpdate.targetReps = numberValue;
        setToUpdate.repsAchieved = numberValue;
        break;
      }
      case METRIC.distance: {
        setToUpdate.targetDistance = numberValue;
        setToUpdate.distanceAchieved = numberValue;
        break;
      }
      case METRIC.duration: {
        setToUpdate.targetDuration = numberValue;
        setToUpdate.durationPerformed = numberValue;
        break;
      }
      case METRIC.rest: {
        setToUpdate.restAfterSet = numberValue;
        break;
      }
      case METRIC.tempo: {
        setToUpdate.targetTempo = stringValue;
        setToUpdate.tempoUsed = stringValue;
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
      [METRIC.weight]: wkEx.sets.some(set => (set.targetWeight ?? 0) > 0 || (set.targetWeightMin ?? 0) > 0) || wkExFromLog.sets.some(set => (set.targetWeight ?? 0) > 0) || !!(wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.weight)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.weight))),
      [METRIC.reps]: wkEx.sets.some(set => (set.targetReps ?? 0) > 0 || (set.targetRepsMin ?? 0) > 0) || wkExFromLog.sets.some(set => (set.targetReps ?? 0) > 0) || !!(wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.reps)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.reps))),
      [METRIC.distance]: wkEx.sets.some(set => (set.targetDistance ?? 0) > 0 || (set.targetDistanceMin ?? 0) > 0) || wkExFromLog.sets.some(set => (set.targetDistance ?? 0) > 0) || !!(wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.distance)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.distance))),
      [METRIC.duration]: wkEx.sets.some(set => (set.targetDuration ?? 0) > 0 || (set.targetDurationMin ?? 0) > 0) || wkExFromLog.sets.some(set => (set.targetDuration ?? 0) > 0) || !!(wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.duration)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.duration))),
      [METRIC.rest]: wkEx.sets.some(set => (set.restAfterSet ?? 0) > 0) || !!(wkEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.rest)) || wkExFromLog.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.rest))),
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
        weight: !!((set.weightUsed ?? 0) > 0 || set.fieldOrder?.includes(METRIC.weight)),
        reps: !!((set.repsAchieved ?? 0) > 0 || set.fieldOrder?.includes(METRIC.reps)),
        distance: !!((set.distanceAchieved ?? 0) > 0 || set.fieldOrder?.includes(METRIC.distance)),
        duration: !!((set.durationPerformed ?? 0) > 0 || set.fieldOrder?.includes(METRIC.duration)),
        tempo: !!(set.targetTempo?.trim() || set.fieldOrder?.includes(METRIC.tempo)),
        rest: !!((set.restAfterSetUsed ?? 0) > 0 || set.fieldOrder?.includes(METRIC.rest)),
      };
    } else {
      // It's an ExerciseTargetSetParams, so we check the target fields.
      const plannedSet = set as ExerciseTargetSetParams; // We can now safely cast it.
      visibleSetFieldsObj = {
        weight: !!((plannedSet.targetWeight ?? 0) > 0 || (plannedSet.targetWeightMin ?? 0) > 0 || plannedSet.fieldOrder?.includes(METRIC.weight)),
        reps: !!((plannedSet.targetReps ?? 0) > 0 || (plannedSet.targetRepsMin ?? 0) > 0 || plannedSet.fieldOrder?.includes(METRIC.reps)),
        distance: !!((plannedSet.targetDistance ?? 0) > 0 || (plannedSet.targetDistanceMin ?? 0) > 0 || plannedSet.fieldOrder?.includes(METRIC.distance)),
        duration: !!((plannedSet.targetDuration ?? 0) > 0 || (plannedSet.targetDurationMin ?? 0) > 0 || plannedSet.fieldOrder?.includes(METRIC.duration)),
        tempo: !!(plannedSet.targetTempo?.trim() || plannedSet.fieldOrder?.includes(METRIC.tempo)),
        rest: !!((plannedSet.restAfterSet ?? 0) > 0 || plannedSet.fieldOrder?.includes(METRIC.rest)),
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
  public async promptAddField(routine: Routine, exIndex: number, setIndex: number): Promise<Routine | null> {
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

    // --- Step 1: Ask WHICH field to add ---
    const availableMetrics = filteredHidden ? filteredHidden : hidden;
    const buttons: AlertButton[] = availableMetrics.map(field => ({
      text: field.charAt(0).toUpperCase() + field.slice(1),
      role: 'add', data: field,
      icon: field === METRIC.duration ? 'duration' : field
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

    const fieldToAdd = choice.data as string;

    // --- Step 2: Ask for the VALUE of the chosen field ---
    let inputLabel = `${this.translate.instant('workoutBuilder.prompts.setTarget.title', { field: fieldToAdd })}`;
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
      this.translate.instant('workoutBuilder.prompts.setTarget.title', { field: fieldToAdd.charAt(0).toUpperCase() + fieldToAdd.slice(1) }),
      this.translate.instant('workoutBuilder.prompts.setTarget.message', { setNumber: setIndex + 1 }),
      [{
        name: 'targetValue',
        type: fieldToAdd === METRIC.tempo ? 'text' : 'number',
        label: inputLabel,
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

    this.toastService.success(`'${fieldToAdd.toUpperCase()}' field added to Set #${setIndex + 1}.`);
    return updatedRoutine;
  }

  public defaultHiddenFields(): any {
    return { visible: [], hidden: this.getDefaultFields() };
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

  public async promptRemoveField(routine: Routine, exIndex: number, setIndex: number): Promise<Routine | null> {
    const cols = this.getVisibleSetColumns(routine, exIndex, setIndex);
    const removableFields = Object.keys(cols).filter(key => cols[key as keyof typeof cols]);

    if (removableFields.length === 0) {
      this.toastService.info("No fields can be removed from this set.");
      return routine;
    };

    const buttons: AlertButton[] = removableFields.map(field => ({
      text: field.charAt(0).toUpperCase() + field.slice(1),
      role: 'remove',
      data: field,
      icon: field === METRIC.duration ? 'duration' : field,
      cssClass: 'bg-red-500 hover:bg-red-600'
    }));

    // --- START OF CORRECTION ---
    // Add a dedicated "Cancel" button to the array.
    buttons.push({
      text: 'Cancel',
      role: 'cancel',
      data: null,
      icon: 'cancel'
    });
    // --- END OF CORRECTION ---

    const choice = await this.alertService.showConfirmationDialog(
      'Remove Field from Exercise',
      'Which metric would you like to remove from this set of this exercise?',
      buttons,
      { showCloseButton: true }
    );


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
      typeof set.repsAchieved !== 'undefined' ||
      typeof set.weightUsed !== 'undefined' ||
      typeof set.durationPerformed !== 'undefined' ||
      typeof set.distanceAchieved !== 'undefined' ||
      typeof set.tempoUsed !== 'undefined'
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
        case METRIC.reps: return (exSet.repsAchieved ?? '-').toString();
        case METRIC.weight: return exSet.weightUsed != null ? exSet.weightUsed.toString() : '-';
        case METRIC.distance: return (exSet.distanceAchieved ?? '-').toString();
        case METRIC.duration: return this.formatSecondsToTime(exSet.durationPerformed);
        case METRIC.rest: return this.formatSecondsToTime(exSet.restAfterSetUsed);
        case METRIC.tempo: return exSet.tempoUsed || '-';
        default: return '-';
      }
    }
    // CASE 2: The set is a PLANNED set, so we display the target values, handling ranges.
    else {
      const plannedSet = exSet as ExerciseTargetSetParams; // Safe to cast here
      switch (field) {
        case METRIC.reps:
          if (plannedSet.targetRepsMin != null && plannedSet.targetRepsMax != null) {
            const midValue = Math.floor((plannedSet.targetRepsMin + plannedSet.targetRepsMax) / 2);
            return midValue.toString();
          }
          return (plannedSet.targetReps ?? '-').toString();

        case METRIC.weight:
          if (plannedSet.targetWeightMin != null && plannedSet.targetWeightMax != null) {
            const midValue = Math.floor((plannedSet.targetWeightMin + plannedSet.targetWeightMax) / 2);
            return midValue.toString();
          }
          return (plannedSet.targetWeight ?? '-').toString();

        case METRIC.distance:
          if (plannedSet.targetDistanceMin != null && plannedSet.targetDistanceMax != null) {
            const midValue = Math.floor((plannedSet.targetDistanceMin + plannedSet.targetDistanceMax) / 2);
            return midValue.toString();
          }
          return (plannedSet.targetDistance ?? '-').toString();

        case METRIC.duration:
          if (plannedSet.targetDurationMin != null && plannedSet.targetDurationMax != null) {
            const midValue = Math.floor((plannedSet.targetDurationMin + plannedSet.targetDurationMax) / 2);
            return this.formatSecondsToTime(midValue);
          }
          return this.formatSecondsToTime(plannedSet.targetDuration ?? undefined);
        case METRIC.rest:
          return this.formatSecondsToTime(plannedSet.restAfterSet ?? undefined);

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

}