// src/app/core/services/workout.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, finalize, map, shareReplay, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs

import { ExerciseSetParams, Routine } from '../models/workout.model'; // Ensure this path is correct
import { StorageService } from './storage.service';
import { LoggedSet } from '../models/workout-log.model';
import { AlertService } from './alert.service';
import { ROUTINES_DATA } from './routines-data';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class WorkoutService {
  private storageService = inject(StorageService);
  private alertService = inject(AlertService);
  private readonly ROUTINES_STORAGE_KEY = 'fitTrackPro_routines';
  private http = inject(HttpClient);

  // Using a BehaviorSubject to make routines reactively available and to update them
  // It's initialized by loading routines from storage.
  private routinesSubject = new BehaviorSubject<Routine[]>(this.loadRoutinesFromStorage());

  // Public observable that components can subscribe to
  public routines$: Observable<Routine[]> = this.routinesSubject.asObservable();

  private isLoadingRoutinesSubject = new BehaviorSubject<boolean>(true); // Start as true
  public isLoadingRoutines$: Observable<boolean> = this.isLoadingRoutinesSubject.asObservable();

  constructor(
  ) {
    this.isLoadingRoutinesSubject.next(true);

    // Load initial routines from storage
    const routinesFromStorage = this._loadRoutinesFromStorage();

    // Initialize the BehaviorSubject with routines from storage
    this.routinesSubject = new BehaviorSubject<Routine[]>(routinesFromStorage);
    this.routines$ = this.routinesSubject.asObservable().pipe(
      shareReplay(1)
    );

    // Call the new, synchronous seeding method
    this._seedAndMergeRoutinesFromStaticData(routinesFromStorage);
  }

  private loadRoutinesFromStorage(): Routine[] {
    const routines = this.storageService.getItem<Routine[]>(this.ROUTINES_STORAGE_KEY);
    // Sort by name for consistent display, or by lastPerformed if available
    return routines ? routines.sort((a, b) => a.name.localeCompare(b.name)) : [];
  }

  /**
 * Loads routines from local storage.
 * @returns An array of Routine objects.
 */
  private _loadRoutinesFromStorage(): Routine[] {
    const routines = this.storageService.getItem<Routine[]>(this.ROUTINES_STORAGE_KEY) || [];
    return routines ? routines.sort((a, b) => a.name.localeCompare(b.name)) : [];
  }

  private _saveRoutinesToStorage(exercises: Routine[]): void {
    this.storageService.setItem(this.ROUTINES_STORAGE_KEY, exercises);
    this.routinesSubject.next([...exercises].sort((a, b) => a.name.localeCompare(b.name)));
  }

  /**
 * Merges routines from the static ROUTINES_DATA constant with existing routines from storage.
 * This is a synchronous operation and does not involve HTTP requests.
 * @param existingRoutines Routines already loaded from storage.
 */
  private _seedAndMergeRoutinesFromStaticData(existingRoutines: Routine[]): void {
    try {
      // Cast the imported data to the Routine[] type for type safety.
      const assetRoutines = ROUTINES_DATA as Routine[];

      // Create a Set of existing routine IDs for efficient lookup.
      const existingRoutineIds = new Set(existingRoutines.map(r => r.id));

      // Filter the asset routines to only include those that are NOT already in storage.
      const newRoutinesToSeed = assetRoutines.filter(
        assetRoutine => !existingRoutineIds.has(assetRoutine.id)
      );

      // If there are new routines to add, merge them and update the state.
      if (newRoutinesToSeed.length > 0) {
        console.log(`Seeding ${newRoutinesToSeed.length} new routines from static data.`);
        const mergedRoutines = [...existingRoutines, ...newRoutinesToSeed];

        // Update the subject with the full, merged list.
        this.routinesSubject.next(mergedRoutines);
        // Save the merged list back to storage for the next session.
        this._saveRoutinesToStorage(mergedRoutines);
      } else {
        console.log("No new routines to seed from static data. All are present in storage.");
      }
    } catch (error) {
      console.error('Failed to process or seed routines from static data:', error);
    } finally {
      // This logic now happens synchronously, so we can set loading to false right after.
      this.isLoadingRoutinesSubject.next(false);
    }
  }

  private saveRoutinesToStorage(routines: Routine[]): void {
    this.storageService.setItem(this.ROUTINES_STORAGE_KEY, routines);
    this.routinesSubject.next([...routines].sort((a, b) => a.name.localeCompare(b.name)));
  }

  public getCurrentRoutines(): Routine[] {
    return this.routinesSubject.getValue();
  }

  getRoutineById(id: string): Observable<Routine | undefined> {
    return this.routines$.pipe(
      map(routines => routines.find(r => r.id === id))
    );
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

  /** Replaces the current routines with imported data */
  public replaceData(newRoutines: Routine[]): void {
    // Basic validation: check if it's an array
    if (!Array.isArray(newRoutines)) {
      console.error('WorkoutService: Imported data for routines is not an array.');
      // Optionally throw an error or return false
      return;
    }
    // TODO: More robust validation of array content (check if items look like Routines)

    this.saveRoutinesToStorage(newRoutines); // Save the new array and update the subject
    console.log('WorkoutService: Routines replaced with imported data.');
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
}