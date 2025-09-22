// src/app/core/services/workout.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

import { ExerciseTargetSetParams, PausedWorkoutState, Routine, WorkoutExercise } from '../models/workout.model'; // Ensure this path is correct
import { StorageService } from './storage.service';
import { LoggedSet, LoggedWorkoutExercise, WorkoutLog } from '../models/workout-log.model';
import { AlertService } from './alert.service';
import { ROUTINES_DATA } from './routines-data';
import { ToastService } from './toast.service';
import { ProgressiveOverloadService } from './progressive-overload.service.ts';
import { AppSettingsService } from './app-settings.service';
import { Router } from '@angular/router';
import { UnitsService } from './units.service';
import { AlertInput } from '../models/alert.model';
import { Exercise } from '../models/exercise.model';
import { SubscriptionService } from './subscription.service';

@Injectable({
  providedIn: 'root',
})
export class WorkoutService {
  private storageService = inject(StorageService);
  private appSettingsService = inject(AppSettingsService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private unitsService = inject(UnitsService); // +++ ADDED
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
  // Add this helper method inside your WorkoutService class
  private _sortRoutines(routines: Routine[]): Routine[] {
    // Use slice() to create a shallow copy to avoid mutating the original array directly
    return routines.slice().sort((a, b) => {
      // Primary sort: favourites first
      // If 'a' is a favourite and 'b' is not, 'a' should come first (-1).
      if (a.isFavourite && !b.isFavourite) {
        return -1;
      }
      // If 'b' is a favourite and 'a' is not, 'b' should come first (1).
      if (!a.isFavourite && b.isFavourite) {
        return 1;
      }

      // Secondary sort: alphabetical by name
      // If both are favourites or both are not, sort by name.
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
        await this.alertService.showAlert("Info", "It's not possible to edit a running routine. Complete it or discard it before doing it.").then(() => {
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
    this.toastService.error(`WorkoutService: Routine with id ${updatedRoutine.id} not found for update!`, 4000, "Error");
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
    // 1. If the progressive overload feature is disabled by the user, do nothing.
    if (!poSettings.enabled) {
      console.log('Progressive Overload disabled. Using planned set.');
      return suggestedParams;
    }

    // 2. If there's no history for this set, we can't make a suggestion.
    if (!lastPerformedSet) {
      console.log('No last performance found. Using planned set.');
      return suggestedParams;
    }

    // Note: The logic for 'sessionsToIncrement' should be handled by the TrackingService 
    // before this function is even called. This function assumes that if lastPerformedSet is provided,
    // it's the correct one to base progression on.

    const lastWeight = lastPerformedSet.weightUsed;
    const lastReps = lastPerformedSet.repsAchieved;
    const targetRepsInPlan = plannedSet.targetReps || plannedSet.targetRepsMin || 0;

    // --- MAIN PROGRESSION LOGIC ---
    // Check if the user successfully completed the set last time.
    // Definition of success: meeting or exceeding the planned reps for that set.
    const wasSuccessful = (targetRepsInPlan !== undefined && lastReps >= targetRepsInPlan);

    switch (poSettings.strategy) {
      // === STRATEGY 1: INCREASE WEIGHT ===
      case 'weight':
        if (wasSuccessful && lastWeight !== undefined && lastWeight !== null && poSettings.weightIncrement) {
          // SUCCESS: Increment the weight, reset reps to the planned target.
          suggestedParams.targetWeight = parseFloat((lastWeight + poSettings.weightIncrement).toFixed(2));
          suggestedParams.targetReps = targetRepsInPlan; // Reset reps to target
          console.log(`PO Suggestion (Weight): Success last time. Increasing weight to ${suggestedParams.targetWeight}`);
        } else if (lastWeight !== undefined && lastWeight !== null) {
          // FAILURE: Stick to the same weight, try to hit the target reps again.
          suggestedParams.targetWeight = lastWeight;
          suggestedParams.targetReps = targetRepsInPlan;
          console.log(`PO Suggestion (Weight): Failure last time. Sticking to weight ${suggestedParams.targetWeight}`);
        }
        break;

      // === STRATEGY 2: INCREASE REPS ===
      case 'reps':
        if (wasSuccessful && poSettings.repsIncrement) {
          // SUCCESS: Increment the reps, keep the same weight as last time.
          suggestedParams.targetReps = lastReps + poSettings.repsIncrement;
          suggestedParams.targetWeight = lastWeight ?? plannedSet.targetWeight; // Use last weight, fall back to planned
          console.log(`PO Suggestion (Reps): Success last time. Increasing reps to ${suggestedParams.targetReps}`);
        } else {
          // FAILURE: Keep the same weight, try to hit the target reps again.
          suggestedParams.targetReps = targetRepsInPlan;
          suggestedParams.targetWeight = lastWeight ?? plannedSet.targetWeight;
          console.log(`PO Suggestion (Reps): Failure last time. Sticking to ${suggestedParams.targetWeight} reps`);
        }
        break;

      // === FALLBACK: NO STRATEGY SELECTED ===
      default:
        console.log('Progressive Overload enabled, but no strategy selected. Using planned set.');
        return suggestedParams;
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
       * - Routines that exist locally but are not in the imported data will be preserved.
       *
       * @param newRoutines The array of Routine objects to merge.
       */
  public mergeData(newRoutines: Routine[]): void {
    // 1. Basic validation
    if (!Array.isArray(newRoutines)) {
      console.error('RoutineService: Imported data for routines is not an array.');
      this.toastService.error('Import failed: Invalid routine data file.', 0, "Import Error"); // Added user feedback
      return;
    }

    // +++ START of new merge logic +++

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
        // Skip invalid entries in the import file
        console.warn('Skipping invalid routine during import:', importedRoutine);
        return;
      }

      if (routineMap.has(importedRoutine.id)) {
        updatedCount++;
      } else {
        addedCount++;
      }
      // Whether it's new or an update, set it in the map.
      routineMap.set(importedRoutine.id, importedRoutine);
    });

    // 5. Convert the map back to an array
    const mergedRoutines = Array.from(routineMap.values());

    // 6. Save the new merged array
    this._saveRoutinesToStorage(mergedRoutines);

    // 7. Provide user feedback
    console.log(`RoutineService: Merged imported data. Updated: ${updatedCount}, Added: ${addedCount}`);
    this.toastService.success(
      `Import complete. ${updatedCount} routines updated, ${addedCount} added.`,
      6000,
      "Routines Merged"
    );
    // +++ END of new merge logic +++
  }


  clearAllRoutines_DEV_ONLY(): Promise<void> { // Changed return type
    return this.alertService.showConfirm("Info", "Are you sure you want to delete ALL routines? This will delete ALL the routines (not just the logs) and cannot be undone.")
      .then(async (result) => { // Added async for await
        if (result && result.data) {
          this.saveRoutinesToStorage([]); // Save an empty array
          await this.alertService.showAlert("Info", "All routines cleared!"); // await this
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
    this.toastService.info('Paused workout session discarded.');
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
        "Resume Paused Workout?",
        "You have a paused workout session. Would you like to resume it?",
        [{ text: "Resume", role: "confirm", data: true, icon: 'play' }, { text: "Discard", role: "cancel", data: false, icon: 'trash' }]
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
    const defaultRest = kbRelated ? 45 : 60;
    const defaultReps = kbRelated && lastLoggedSet ? (lastLoggedSet.targetReps ?? lastLoggedSet.repsAchieved) : 10;
    const defaultSets = 3;

    const baseParams: AlertInput[] = [
      { label: 'Exercise name', name: 'name', type: 'text', placeholder: 'Exercise name', value: selectedExercise.name, attributes: { required: true } },
      { label: 'Number of Sets', name: 'numSets', type: 'number', placeholder: 'e.g., 3', value: defaultSets, attributes: { min: 1, required: true } },
      { label: 'Rest Between Sets (seconds)', name: 'rest', type: 'number', placeholder: 'e.g., 60', value: defaultRest, attributes: { min: 1, required: true } }
    ];

    // Define the input fields for the alert prompt
    const exerciseParams: AlertInput[] = isCardioOnly
      ? [
        ...baseParams,
        { label: 'Target Duration (seconds)', name: 'duration', type: 'number', placeholder: 'e.g., 60', value: defaultDuration, attributes: { min: 0, required: true } },
      ]
      : [
        ...baseParams,
        { label: 'Number of Reps', name: 'numReps', type: 'number', placeholder: 'e.g., 10', value: defaultReps, attributes: { min: 0, required: true } },
        { label: `Target Weight (${this.unitsService.getWeightUnitSuffix()})`, name: 'weight', type: 'number', placeholder: 'e.g., 10', value: defaultWeight, attributes: { min: 0, required: true } },
      ];

    const exerciseData = await this.alertService.showPromptDialog(
      `Add ${selectedExercise.name}`,
      '',
      exerciseParams
    );

    if (!exerciseData) {
      this.toastService.info("Exercise addition cancelled.", 2000);
      return null;
    }

    const exerciseName = String(exerciseData['name']).trim() || selectedExercise.name;
    const numSets = parseInt(String(exerciseData['numSets'])) || defaultSets;
    const numReps = parseInt(String(exerciseData['numReps'])) || defaultReps;
    const weight = parseFloat(String(exerciseData['weight'])) ?? defaultWeight;
    const duration = parseInt(String(exerciseData['duration'])) || defaultDuration;
    const rest = parseInt(String(exerciseData['rest'])) || defaultRest;

    const newExerciseSets: ExerciseTargetSetParams[] = [];
    for (let i = 0; i < numSets; i++) {
      newExerciseSets.push({
        id: `custom-set-${uuidv4()}`,
        targetReps: isCardioOnly ? undefined : numReps,
        targetWeight: isCardioOnly ? undefined : weight,
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
      checked: exer.originalIndex === exIndex, // Pre-check the initiating exercise
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
  * @param field The field to display ('reps', 'duration', or 'weight').
  * @returns A formatted string like "8-12", "60+", "10", or an empty string if no target is set.
  */
  public getSetTargetDisplay(set: ExerciseTargetSetParams, field: 'reps' | 'duration' | 'weight' | 'distance'): string {
    // --- MODIFICATION START ---
    // Add a guard clause to prevent errors if an undefined set is passed in.
    if (!set) {
      return '';
    }
    // --- MODIFICATION END ---
    
    let min = -1;
    let max = -1;
    let single = -1;

    switch (field) {
      case 'reps':
        min = set.targetRepsMin || 0;
        max = set.targetRepsMax || 0;
        single = set.targetReps || 0;
        break;
      case 'duration':
        min = set.targetDurationMin || 0;
        max = set.targetDurationMax || 0;
        single = set.targetDuration || 0;
        break;
      case 'weight':
        min = set.targetWeightMin || 0;
        max = set.targetWeightMax || 0;
        single = set.targetWeight || 0;
        break;
      case 'distance':
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
        return `Up to ${max}`;
      }
    }

    // Fallback to the single value
    return single != null ? `${single}` : '';
  }

  /**
 * Gets the display string for a set's target weight.
 * @param set The set parameters.
 * @param exercise The base exercise definition.
 * @returns A user-friendly string for the UI.
 */
getWeightDisplay(set: ExerciseTargetSetParams, exercise: Exercise | WorkoutExercise): string {
  
  // Case 1: Cardio or Stretching
  if (exercise.category === 'cardio' || exercise.category === 'stretching') {
    return 'N/A';
  }

  // Case 2: Bodyweight
  if (exercise.category === 'bodyweight/calisthenics') {
    // If weight is explicitly added (e.g., weighted pull-up), show it.
    if (set.targetWeight != null && set.targetWeight > 0) {
      return `${set.targetWeight} ${this.unitsService.getWeightUnitSuffix()}`;
    }
    return 'Bodyweight';
  }

  // Case 3: Weighted exercise with a specific target
  if (set.targetWeight != null && set.targetWeight > 0) {
    return `${set.targetWeight} ${this.unitsService.getWeightUnitSuffix()}`;
  }

  // Case 4: Weighted exercise with zero weight target
  if (set.targetWeight === 0) {
    return 'No Added Wt.'; // Or "Bar Only"
  }

  // Case 5: Weighted exercise with no target set (null/undefined)
  return 'User Defined'; 
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
      delete newSet['reps']; // Remove the old field
    }

    // Migrate 'weight' to 'targetWeight'
    if (typeof set.weight === 'number' && typeof newSet.targetWeight === 'undefined') {
      newSet.targetWeight = set.weight;
      delete newSet['weight'];
    }

    // Migrate 'duration' to 'targetDuration'
    if (typeof set.duration === 'number' && typeof newSet.targetDuration === 'undefined') {
      newSet.targetDuration = set.duration;
      delete newSet['duration'];
    }

    // Migrate 'distance' to 'targetDistance'
    if (typeof set.distance === 'number' && typeof newSet.targetDistance === 'undefined') {
      newSet.targetDistance = set.distance;
      delete newSet['distance'];
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
    this.toastService.success("All routines enabled!");
  }

  getSupersetSize(routine: Routine | null | undefined, index: number): number {
    const ex = routine?.exercises[index];
    if (!ex?.supersetId) return 0;
    return routine?.exercises.filter(e => e.supersetId === ex.supersetId).length || 0;
  }

  public exerciseNameDisplay(exercise: WorkoutExercise): string {
    if (!exercise || !exercise.exerciseName) return 'Unnamed Exercise';

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

}