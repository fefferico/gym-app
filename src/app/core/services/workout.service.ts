// src/app/core/services/workout.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

import { ExerciseSetParams, Routine, WorkoutExercise } from '../models/workout.model'; // Ensure this path is correct
import { StorageService } from './storage.service';
import { LoggedSet } from '../models/workout-log.model';
import { AlertService } from './alert.service';
import { ROUTINES_DATA } from './routines-data';
import { ToastService } from './toast.service';
import { ProgressiveOverloadService } from './progressive-overload.service.ts';
import { AppSettingsService } from './app-settings.service';
import { Router } from '@angular/router';
import { PausedWorkoutState } from '../../features/workout-tracker/workout-player';
import { UnitsService } from './units.service';
import { AlertInput } from '../models/alert.model';
import { Exercise } from '../models/exercise.model';

@Injectable({
  providedIn: 'root',
})
export class WorkoutService {
  private storageService = inject(StorageService);
  private appSettingsService = inject(AppSettingsService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private unitsService = inject(UnitsService); // +++ ADDED
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
      const existingRoutineIds = new Set(existingRoutines.map(r => r.id));
      const newRoutinesToSeed = assetRoutines.filter(
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
      updatedRoutinesArray[index] = { ...updatedRoutine };
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
    plannedSet: ExerciseSetParams,
  ): ExerciseSetParams {
    // Start with a copy of the planned set. This is our fallback.
    const suggestedParams: ExerciseSetParams = JSON.parse(JSON.stringify(plannedSet));

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
    const targetRepsInPlan = plannedSet.reps;

    // --- MAIN PROGRESSION LOGIC ---
    // Check if the user successfully completed the set last time.
    // Definition of success: meeting or exceeding the planned reps for that set.
    const wasSuccessful = (targetRepsInPlan !== undefined && lastReps >= targetRepsInPlan);

    switch (poSettings.strategy) {
      // === STRATEGY 1: INCREASE WEIGHT ===
      case 'weight':
        if (wasSuccessful && lastWeight !== undefined && lastWeight !== null && poSettings.weightIncrement) {
          // SUCCESS: Increment the weight, reset reps to the planned target.
          suggestedParams.weight = parseFloat((lastWeight + poSettings.weightIncrement).toFixed(2));
          suggestedParams.reps = targetRepsInPlan; // Reset reps to target
          console.log(`PO Suggestion (Weight): Success last time. Increasing weight to ${suggestedParams.weight}`);
        } else if (lastWeight !== undefined && lastWeight !== null) {
          // FAILURE: Stick to the same weight, try to hit the target reps again.
          suggestedParams.weight = lastWeight;
          suggestedParams.reps = targetRepsInPlan;
          console.log(`PO Suggestion (Weight): Failure last time. Sticking to weight ${suggestedParams.weight}`);
        }
        break;

      // === STRATEGY 2: INCREASE REPS ===
      case 'reps':
        if (wasSuccessful && poSettings.repsIncrement) {
          // SUCCESS: Increment the reps, keep the same weight as last time.
          suggestedParams.reps = lastReps + poSettings.repsIncrement;
          suggestedParams.weight = lastWeight ?? plannedSet.weight; // Use last weight, fall back to planned
          console.log(`PO Suggestion (Reps): Success last time. Increasing reps to ${suggestedParams.reps}`);
        } else {
          // FAILURE: Keep the same weight, try to hit the target reps again.
          suggestedParams.reps = targetRepsInPlan;
          suggestedParams.weight = lastWeight ?? plannedSet.weight;
          console.log(`PO Suggestion (Reps): Failure last time. Sticking to ${suggestedParams.reps} reps`);
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
  public getEstimatedWorkTimeForSet(set: ExerciseSetParams): number {
    let timeFromReps = 0;

    // 1. Calculate the estimated time from reps, if reps are specified.
    if (set.reps && set.reps > 0) {
      // Estimate ~3 seconds per rep (1s up, 2s down). Adjust as needed.
      const timePerRep = 3;
      timeFromReps = set.reps * timePerRep;
    }

    // 2. Get the duration specified in the set, defaulting to 0 if not present.
    const timeFromDuration = set.duration || 0;

    // 3. Compare the two calculated times and return the greater value.
    const estimatedTime = Math.max(timeFromReps, timeFromDuration);

    // 4. Handle edge cases where neither reps nor duration are set.
    if (estimatedTime > 0) {
      // Return the calculated time, but with a minimum floor (e.g., 5s) 
      // to account for setup for very short sets.
      return Math.max(estimatedTime, 5);
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
  public getRestTimeForSet(set: ExerciseSetParams): number {
    return set.restAfterSet || 0;
  }


  /**
 * Estimates the total time to complete an entire routine in minutes,
 * including estimated work time for each set and rest times between sets.
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

    // We need to keep track of the index to correctly handle supersets and know
    // if we are at the very last exercise/set of the routine.
    for (let i = 0; i < exercises.length; i++) {
      const exercise = exercises[i];

      // Determine the exercises included in this block (single exercise or superset)
      let blockExercises: WorkoutExercise[];
      if (exercise.supersetId) {
        // If it's a superset, find all exercises with the same supersetId
        // This assumes superset exercises are always contiguous in the array and in order.
        blockExercises = exercises.filter(ex => ex.supersetId === exercise.supersetId);
        // Advance the main loop counter to skip these exercises on the next iteration
        // We do this by finding the last index of the superset and setting 'i' to it.
        const lastSupersetExerciseIndex = exercises.findIndex(ex => ex.id === blockExercises[blockExercises.length - 1].id);
        i = lastSupersetExerciseIndex; // Adjust i to the last exercise of the current superset
      } else {
        // If it's a single exercise block
        blockExercises = [exercise];
      }

      const rounds = exercise.rounds || 1; // Rounds apply to the entire block (single exercise or superset)

      for (let r = 0; r < rounds; r++) {
        // For each round, iterate through exercises in the block
        blockExercises.forEach((blockEx, blockExIndex) => {
          blockEx.sets.forEach((set: ExerciseSetParams, setIndex: number) => {
            // Add work time for the current set
            totalSeconds += this.getEstimatedWorkTimeForSet(set);

            // Add rest time, but only if it's NOT the very last set of the very last round
            // and NOT the very last set of the very last exercise in the block/routine.
            const isLastSetInExercise = setIndex === blockEx.sets.length - 1;
            const isLastExerciseInBlock = blockExIndex === blockExercises.length - 1;
            const isLastRound = r === rounds - 1;
            const isLastExerciseInRoutine = i === exercises.length - 1; // 'i' is the adjusted index for the current block

            // Only add rest if it's not the absolute last set of the entire routine
            if (!(isLastSetInExercise && isLastExerciseInBlock && isLastRound && isLastExerciseInRoutine)) {
              totalSeconds += this.getRestTimeForSet(set);
            }
          });
        });
      }
    }

    // Convert total seconds to minutes and round to the nearest whole number.
    const totalMinutes = Math.round(totalSeconds / 60);

    return totalMinutes;
  }


  startWorkout(): void {

  }

  checkPlayerMode(newRoutineId: string): string {
    const routine = this.getCurrentRoutines().find(routine => routine.id === newRoutineId);
    const playerMode = this.appSettingsService.getSettings() ? this.appSettingsService.getSettings().playerMode : false;
    const isTabata = routine?.goal === 'tabata';
    let url = '';

    if (isTabata) {
      return '/workout/play/tabata';
    }
    if (!isTabata && playerMode) {
      return '/workout/play/compact';
    } else {
      return '/workout/play/focus';
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

  removePausedWorkout(): void {
    this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
    // --- NEW: Emit when a paused workout is discarded ---
    this._pausedWorkoutDiscarded.next();
    // --- END NEW ---
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
    const defaultWeight = kbRelated && lastLoggedSet ? (lastLoggedSet.targetWeight ?? lastLoggedSet.weightUsed) : (this.unitsService.currentUnit() === 'kg' ? 10 : 22.2);
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
        { label: `Target Weight (${this.unitsService.getUnitLabel()})`, name: 'weight', type: 'number', placeholder: 'e.g., 10', value: defaultWeight, attributes: { min: 0, required: true } },
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

    const newExerciseSets: ExerciseSetParams[] = [];
    for (let i = 0; i < numSets; i++) {
      newExerciseSets.push({
        id: `custom-set-${uuidv4()}`,
        reps: isCardioOnly ? undefined : numReps,
        weight: isCardioOnly ? undefined : weight,
        duration: isCardioOnly ? duration : undefined,
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
      rounds: 1,
      supersetId: null,
      supersetOrder: null,
      supersetSize: null,
      sessionStatus: 'pending',
      type: 'standard'
    };

    return newWorkoutExercise;
  }
}