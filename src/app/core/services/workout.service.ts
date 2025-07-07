// src/app/core/services/workout.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

import { ExerciseSetParams, Routine, WorkoutExercise } from '../models/workout.model'; // Ensure this path is correct
import { StorageService } from './storage.service';
import { LoggedSet } from '../models/workout-log.model';
import { AlertService } from './alert.service';
import { ROUTINES_DATA } from './routines-data';
import { HttpClient } from '@angular/common/http';
import { ToastService } from './toast.service';

@Injectable({
  providedIn: 'root',
})
export class WorkoutService {
  private storageService = inject(StorageService);
  private alertService = inject(AlertService);
  private readonly ROUTINES_STORAGE_KEY = 'fitTrackPro_routines';
  private http = inject(HttpClient);
  private toastService = inject(ToastService);

  // Using a BehaviorSubject to make routines reactively available and to update them
  // It's initialized by loading routines from storage.
  private routinesSubject = new BehaviorSubject<Routine[]>(this.loadRoutinesFromStorage());

  // Public observable that components can subscribe to
  public routines$: Observable<Routine[]> = this.routinesSubject.asObservable();

  private isLoadingRoutinesSubject = new BehaviorSubject<boolean>(true); // Start as true
  public isLoadingRoutines$: Observable<boolean> = this.isLoadingRoutinesSubject.asObservable();

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

  /**
 * Loads routines from local storage.
 * @returns An array of Routine objects.
 */
  private _loadRoutinesFromStorage(): Routine[] {
    const routines = this.storageService.getItem<Routine[]>(this.ROUTINES_STORAGE_KEY) || [];
    return routines ? routines.sort((a, b) => a.name.localeCompare(b.name)) : [];
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
        console.log(`Seeding ${newRoutinesToSeed.length} new routines from static data.`);
        const mergedRoutines = [...existingRoutines, ...newRoutinesToSeed];

        // This single call now handles sorting, saving, and updating the subject
        this.saveRoutinesToStorage(mergedRoutines);
      } else {
        console.log("No new routines to seed from static data. All are present in storage.");
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

  updateRoutine(updatedRoutine: Routine): Routine | undefined {
    let currentRoutines = this.routinesSubject.getValue();
    const index = currentRoutines.findIndex(r => r.id === updatedRoutine.id);
    if (index > -1) {
      const updatedRoutinesArray = [...currentRoutines];
      updatedRoutinesArray[index] = { ...updatedRoutine };
      this.saveRoutinesToStorage(updatedRoutinesArray);
      console.log('Updated routine:', updatedRoutine);
      return updatedRoutine;
    }
    console.warn(`WorkoutService: Routine with id ${updatedRoutine.id} not found for update.`);
    return undefined;
  }

  deleteRoutine(id: string): void {
    const currentRoutines = this.routinesSubject.getValue();
    const updatedRoutines = currentRoutines.filter(r => r.id !== id);
    if (updatedRoutines.length < currentRoutines.length) {
      this.saveRoutinesToStorage(updatedRoutines);
      console.log('Deleted routine with id:', id);
    } else {
      console.warn(`WorkoutService: Routine with id ${id} not found for deletion.`);
    }
  }

  generateWorkoutExerciseId(): string {
    return uuidv4();
  }

  generateExerciseSetId(): string {
    return uuidv4();
  }

  // +++ NEW METHOD for Progressive Overload Suggestion +++
  /**
   * Suggests parameters for the next set based on last performance and simple progression rules.
   * @param lastPerformedSet The actual performance of the corresponding set last time. Can be null if no history.
   * @param plannedSet The originally planned parameters for the current set (from the routine).
   * @param exerciseGoal The goal of the overall routine/exercise (e.g., 'strength', 'hypertrophy').
   * @returns Updated ExerciseSetParams with suggested values for the current session.
   */
  suggestNextSetParameters(
    lastPerformedSet: LoggedSet | null, // <<< This line
    plannedSet: ExerciseSetParams, // This is the target set from the *original* routine plan
    exerciseGoal?: Routine['goal'] // Optional: goal can influence progression
  ): ExerciseSetParams {
    // Start with a copy of the originally planned set parameters for this session
    // We will modify these based on last performance.
    const suggestedParams: ExerciseSetParams = JSON.parse(JSON.stringify(plannedSet));

    // If no last performance data, return the original planned set for this session
    if (!lastPerformedSet) {
      console.log('No last performance, using original planned set:', plannedSet);
      return suggestedParams;
    }

    const lastWeight = lastPerformedSet.weightUsed;
    const lastReps = lastPerformedSet.repsAchieved;
    const targetRepsInPlan = plannedSet.reps; // Original target reps for this set

    // --- Basic Progressive Overload Logic ---

    // Rule 1: For weight-based sets
    if (lastWeight !== undefined && lastWeight !== null && lastWeight >= 0 && targetRepsInPlan !== undefined) {
      const weightIncrement = 2.5; // Example: 2.5 kg/lbs. Make this configurable later.
      const minRepsForIncrement = targetRepsInPlan; // Must meet target reps

      // If last time reps met or exceeded target for that weight:
      if (lastReps >= minRepsForIncrement) {
        suggestedParams.weight = parseFloat((lastWeight + weightIncrement).toFixed(2));
        // When increasing weight, often aim for the lower end of the rep range or the original target.
        suggestedParams.reps = targetRepsInPlan;
        console.log(`Suggesting weight increase to ${suggestedParams.weight}kg for ${suggestedParams.reps} reps.`);
      } else {
        // Did not meet target reps last time, suggest staying at the same weight and trying to hit target reps.
        suggestedParams.weight = lastWeight;
        suggestedParams.reps = targetRepsInPlan; // Re-attempt target reps
        console.log(`Suggesting same weight ${suggestedParams.weight}kg, aiming for ${suggestedParams.reps} reps.`);
      }
    }
    // Rule 2: For bodyweight rep-based sets (where plannedSet.weight is undefined or 0)
    else if ((plannedSet.weight === undefined || plannedSet.weight === 0) && targetRepsInPlan !== undefined) {
      const repIncrement = 1; // Example: increase by 1 rep
      // If last time reps met or exceeded target:
      if (lastReps >= targetRepsInPlan) {
        suggestedParams.reps = lastReps + repIncrement; // Suggest more reps
        console.log(`Suggesting rep increase to ${suggestedParams.reps} for bodyweight exercise.`);
      } else {
        // Did not meet target reps, suggest re-attempting target reps.
        suggestedParams.reps = targetRepsInPlan;
        console.log(`Suggesting re-attempt of ${suggestedParams.reps} reps for bodyweight exercise.`);
      }
    }
    // Rule 3: For duration-based sets
    else if (plannedSet.duration !== undefined && lastPerformedSet.durationPerformed !== undefined) {
      const durationIncrement = 5; // Example: increase by 5 seconds
      // If last time duration met or exceeded target:
      if (lastPerformedSet.durationPerformed >= plannedSet.duration) {
        suggestedParams.duration = plannedSet.duration + durationIncrement;
        console.log(`Suggesting duration increase to ${suggestedParams.duration}s.`);
      } else {
        // Did not meet target duration, suggest re-attempting target duration.
        suggestedParams.duration = plannedSet.duration;
        console.log(`Suggesting re-attempt of ${suggestedParams.duration}s duration.`);
      }
    }

    // Tempo and Notes are usually carried over from the plan or set by user.
    // RestAfterSet is also usually from the plan.
    suggestedParams.id = plannedSet.id; // Keep the same planned set ID

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
    console.log(`RoutineService: Merged imported data. Updated: ${updatedCount}, Added: ${addedCount}.`);
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
   * --- FUNCTION 3 ---
   * Estimates the total time to complete an entire routine in minutes.
   * 
   * This function iterates through all exercises and their sets, summing up the
   * working time and resting time, and accounting for multiple rounds.
   *
   * @param routine The full Routine object.
   * @returns The total estimated duration in minutes.
   */
  public getEstimatedRoutineDuration(routine: Routine): number {
    if (!routine || !routine.exercises || routine.exercises.length === 0) {
      return 0;
    }

    let totalSeconds = 0;

    // Process exercises considering rounds and supersets
    for (let i = 0; i < routine.exercises.length; i++) {
      const exercise = routine.exercises[i];

      // --- Logic to handle rounds ---
      // A block of work is either a single exercise or a superset.
      // The number of rounds is defined on the FIRST exercise of a block.
      // We only process the round calculation when we encounter the start of a new block.

      const isStartOfBlock = !exercise.supersetId || exercise.supersetOrder === 0;

      if (isStartOfBlock) {
        const rounds = exercise.rounds || 1;
        let blockDurationSeconds = 0;

        // Determine the exercises included in this block
        let blockExercises: WorkoutExercise[];
        if (exercise.supersetId) {
          // If it's a superset, find all exercises with the same supersetId
          blockExercises = routine.exercises.filter(ex => ex.supersetId === exercise.supersetId);
          // Advance the main loop counter to skip these exercises on the next iteration
          i += blockExercises.length - 1;
        } else {
          // If it's a single exercise block
          blockExercises = [exercise];
        }

        // Calculate the duration of one round of the block
        blockExercises.forEach(blockEx => {
          blockEx.sets.forEach((set: ExerciseSetParams) => {
            blockDurationSeconds += this.getEstimatedWorkTimeForSet(set);
            blockDurationSeconds += this.getRestTimeForSet(set);
          });
        });

        // Multiply the block's duration by the number of rounds
        totalSeconds += blockDurationSeconds * rounds;
      }
    }

    // Convert total seconds to minutes and round to the nearest whole number.
    const totalMinutes = Math.round(totalSeconds / 60);

    return totalMinutes;
  }
}