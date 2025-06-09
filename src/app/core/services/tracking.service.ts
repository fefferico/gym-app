// src/app/core/services/tracking.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { LastPerformanceSummary, LoggedSet, PersonalBestSet, WorkoutLog } from '../models/workout-log.model'; // Ensure path is correct
import { StorageService } from './storage.service';       // Ensure path is correct
import { ExerciseSetParams, Routine } from '../models/workout.model';
// Later, you might import Exercise and Routine models for PB calculations
import { parseISO } from 'date-fns'; // For date handling
import { AlertService } from './alert.service';
import { WorkoutService } from './workout.service';

// New interface for performance data points
export interface ExercisePerformanceDataPoint {
  date: Date;       // The date of the workout log
  value: number;    // The metric being plotted (e.g., max weight, volume)
  reps?: number;    // Optional: reps achieved for this data point (if plotting max weight for X reps)
  logId: string;    // ID of the workout log for potential drill-down
}

@Injectable({
  providedIn: 'root',
})
export class TrackingService {
  private storageService = inject(StorageService);
  private alertService = inject(AlertService);
  private workoutService = inject(WorkoutService);
  private readonly WORKOUT_LOGS_STORAGE_KEY = 'fitTrackPro_workoutLogs';
  // private readonly PERSONAL_BESTS_STORAGE_KEY = 'fitTrackPro_personalBests'; // For later

  private readonly PERSONAL_BESTS_STORAGE_KEY = 'fitTrackPro_personalBests';

  // BehaviorSubject for reactive workout logs
  private workoutLogsSubject = new BehaviorSubject<WorkoutLog[]>(this.loadWorkoutLogsFromStorage());
  public workoutLogs$: Observable<WorkoutLog[]> = this.workoutLogsSubject.asObservable();

  // Personal Bests: Stored as a Record where key is exerciseId, value is an array of PBs (1RM, 5RM, etc.)
  private personalBestsSubject = new BehaviorSubject<Record<string, PersonalBestSet[]>>(this.loadPBsFromStorage());
  public personalBests$: Observable<Record<string, PersonalBestSet[]>> = this.personalBestsSubject.asObservable();


  constructor() {
    // console.log('Initial workout logs loaded:', this.workoutLogsSubject.getValue());
    // Load PBs from storage if implementing
  }

  private loadWorkoutLogsFromStorage(): WorkoutLog[] {
    const logs = this.storageService.getItem<WorkoutLog[]>(this.WORKOUT_LOGS_STORAGE_KEY);
    // Optionally sort logs by date here if needed, e.g., newest first
    return logs ? logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
  }

  private saveWorkoutLogsToStorage(logs: WorkoutLog[]): void {
    this.storageService.setItem(this.WORKOUT_LOGS_STORAGE_KEY, logs);
    // Also sort before emitting, or ensure load sorts consistently
    this.workoutLogsSubject.next([...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }

  /**
   * Adds a new completed workout log.
   * The WorkoutLog object should be fully populated by the WorkoutPlayerComponent before calling this.
   */
  addWorkoutLog(newLogData: Omit<WorkoutLog, 'id'>): WorkoutLog {
    const newWorkoutLogId: string = uuidv4();
    const currentLogs = this.workoutLogsSubject.getValue();

    const updatedExercises = newLogData.exercises.map(ex => ({
      ...ex,
      workoutLogId: newWorkoutLogId,
      sets: ex.sets.map(set => ({
        ...set,
        id: set.id ?? uuidv4(),
        workoutLogId: newWorkoutLogId,
      }))
    }));

    const newLog: WorkoutLog = {
      ...newLogData,
      exercises: updatedExercises,
      id: newWorkoutLogId,
      date: new Date(newLogData.startTime).toISOString().split('T')[0], // YYYY-MM-DD
    };


    if (newLog.startTime && newLog.endTime && !newLog.durationMinutes) {
      newLog.durationMinutes = Math.round((newLog.endTime - newLog.startTime) / (1000 * 60));
    }

    const updatedLogs = [newLog, ...currentLogs];
    this.saveWorkoutLogsToStorage(updatedLogs);

    this.updateAllPersonalBestsFromLog(newLog); // Call PB update

    console.log('Added workout log:', newLog);
    return newLog;
  }

  getWorkoutLogById(id: string): Observable<WorkoutLog | undefined> {
    return this.workoutLogs$.pipe(
      map(logs => logs.find(log => log.id === id))
    );
  }

  // --- Methods for Personal Bests (To be implemented later) ---
  /*
  private updatePersonalBests(log: WorkoutLog): void {
    // Logic to iterate through log.exercises and log.sets
    // Compare with existing PBs (load from storage)
    // Update PBs if new records are set
    // Save updated PBs to storage and update personalBestsSubject
    console.log('Updating PBs based on log:', log.id);
  }

  getPersonalBestForExercise(exerciseId: string, repRange: number = 1): Observable<LoggedSet | null> {
    // Logic to find the best set for a given exerciseId and rep range (e.g., 1RM, 5RM)
    // This would query the workoutLogs$
    return of(null); // Placeholder
  }
  */

  // For development: clear logs
  clearAllWorkoutLogs_DEV_ONLY(): Promise<void> { // Changed return type
    return this.alertService.showConfirm("Info", "DEVELOPMENT: Are you sure you want to delete ALL workout logs? This cannot be undone.")
      .then(async (result) => { // Added async for await
        if (result && result.data) {
          this.saveWorkoutLogsToStorage([]);
          await this.alertService.showAlert("Info", "All workout logs cleared!"); // await this
        }
      });
  }

  /**
   * Gets the most recent performance (all logged sets) for a specific exercise.
   * @param exerciseId The ID of the exercise.
   * @returns An Observable of LastPerformanceSummary or null if no prior performance is found.
   */
  getLastPerformanceForExercise(exerciseId: string): Observable<LastPerformanceSummary | null> {
    return this.workoutLogs$.pipe(
      map(logs => {
        for (const log of logs) { // logs are already sorted newest first
          const performedExercise = log.exercises.find(ex => ex.exerciseId === exerciseId);
          if (performedExercise && performedExercise.sets.length > 0) {
            // Construct the LastPerformanceSummary including workoutLogId
            const summary: LastPerformanceSummary = { // Explicitly type for clarity
              lastPerformedDate: log.date,
              workoutLogId: log.id, // <--- ADD THIS
              sets: [...performedExercise.sets] // Return a copy of the sets array
            };
            return summary;
          }
        }
        return null; // No performance found for this exercise
      })
      // tap(summary => console.log(`Last performance for ${exerciseId}:`, summary)) // For debugging
    );
  }

  /**
   * Helper to find the performance of a specific set number from a LastPerformanceSummary.
   * This is a simple example; more robust matching might involve comparing plannedSetId
   * or looking for the set with the closest target reps/weight if the routine structure changed.
   */
  findPreviousSetPerformance(
    lastPerformance: LastPerformanceSummary | null,
    currentSetTarget: ExerciseSetParams, // Target parameters for the set about to be performed
    currentSetIndexInRoutine: number // 0-based index of the current set in the routine
  ): LoggedSet | null { // <--- It correctly returns LoggedSet | null
    if (!lastPerformance || !lastPerformance.sets || lastPerformance.sets.length === 0) {
      return null;
    }

    // lastPerformance.sets are LoggedSet[] objects because LastPerformanceSummary.sets is LoggedSet[]
    if (currentSetIndexInRoutine < lastPerformance.sets.length) {
      return lastPerformance.sets[currentSetIndexInRoutine]; // This is a LoggedSet
    }
    return null;
  }

  // --- Personal Best (PB) Management ---
  private loadPBsFromStorage(): Record<string, PersonalBestSet[]> {
    return this.storageService.getItem<Record<string, PersonalBestSet[]>>(this.PERSONAL_BESTS_STORAGE_KEY) || {};
  }

  private savePBsToStorage(pbs: Record<string, PersonalBestSet[]>): void {
    this.storageService.setItem(this.PERSONAL_BESTS_STORAGE_KEY, pbs);
    this.personalBestsSubject.next({ ...pbs }); // Emit a new object reference
  }

  /**
   * Updates all relevant PBs based on a newly completed workout log.
   */
  private updateAllPersonalBestsFromLog(log: WorkoutLog): void {
    const currentPBs = { ...this.personalBestsSubject.getValue() }; // Get a mutable copy

    log.exercises.forEach(loggedEx => {
      if (!currentPBs[loggedEx.exerciseId]) {
        currentPBs[loggedEx.exerciseId] = [];
      }
      const exercisePBsList: PersonalBestSet[] = currentPBs[loggedEx.exerciseId];
      const workoutLogId = loggedEx.workoutLogId || log.id; // Use the log's ID if not set on the exercise

      loggedEx.sets.forEach(loggedSet => {
        if (loggedSet.weightUsed === undefined || loggedSet.weightUsed === null || loggedSet.weightUsed === 0) {
          // For bodyweight exercises or timed sets without weight, PBs might be max reps/duration
          if (loggedSet.repsAchieved > 0) {
            this.updateSpecificPB(exercisePBsList, loggedSet, `Max Reps (Bodyweight)`);
          }
          if (loggedSet.durationPerformed && loggedSet.durationPerformed > 0) {
            this.updateSpecificPB(exercisePBsList, loggedSet, `Max Duration`);
          }
          return; // Skip weight-based PBs if no weight
        }

        // --- Weight-Based PBs ---
        // 1RM (Actual)
        if (loggedSet.repsAchieved === 1) {
          this.updateSpecificPB(exercisePBsList, loggedSet, `1RM (Actual)`);
        }
        // 3RM (Actual)
        if (loggedSet.repsAchieved === 3) {
          this.updateSpecificPB(exercisePBsList, loggedSet, `3RM (Actual)`);
        }
        // 5RM (Actual)
        if (loggedSet.repsAchieved === 5) {
          this.updateSpecificPB(exercisePBsList, loggedSet, `5RM (Actual)`);
        }
        // Max Reps at a specific weight (more complex to track all weights, so this is a simplification)
        // For now, let's just track "Heaviest Set" regardless of reps (if weight exists)
        this.updateSpecificPB(exercisePBsList, loggedSet, `Heaviest Lifted`);

        // Estimated 1RM (Epley Formula: weight * (1 + reps / 30)) - only for reps > 1
        if (loggedSet.repsAchieved > 1) {
          const e1RM = loggedSet.weightUsed * (1 + loggedSet.repsAchieved / 30);
          // Create a pseudo LoggedSet for the E1RM, as weight is estimated for 1 rep
          const e1RMSet: LoggedSet = {
            ...loggedSet, // Copy context like exerciseId, timestamp, notes
            repsAchieved: 1, // It's for 1 rep
            weightUsed: parseFloat(e1RM.toFixed(2)), // Estimated weight for 1 rep
          };
          this.updateSpecificPB(exercisePBsList, e1RMSet, `1RM (Estimated)`);
        }
      });
      currentPBs[loggedEx.exerciseId] = exercisePBsList.sort((a, b) => (b.weightUsed ?? 0) - (a.weightUsed ?? 0)); // Sort PBs for this exercise
    });
    this.savePBsToStorage(currentPBs);
    console.log('Personal Bests updated:', currentPBs);
  }

  /**
   * Helper to update or add a specific type of PB for an exercise.
   * @param existingPBsList The array of PBs for the specific exercise.
   * @param candidateSet The newly performed set that might be a PB.
   * @param pbType A string describing the type of PB (e.g., "1RM (Actual)", "5RM (Estimated)").
   */
  private updateSpecificPB(existingPBsList: PersonalBestSet[], candidateSet: LoggedSet, pbType: string): void {
    const newPbData: PersonalBestSet = { ...candidateSet, pbType, workoutLogId: candidateSet.workoutLogId };
    const existingPbIndex = existingPBsList.findIndex(pb => pb.pbType === pbType);

    let shouldUpdateOrAdd = false;

    if (existingPbIndex > -1) { // PB of this type already exists
      const existingPb = existingPBsList[existingPbIndex];
      // Logic to determine if candidateSet is "better"
      if (pbType.includes('Max Reps')) { // For max reps PBs, higher reps are better (at same or higher weight if applicable)
        if (candidateSet.repsAchieved > existingPb.repsAchieved) {
          shouldUpdateOrAdd = true;
        } else if (candidateSet.repsAchieved === existingPb.repsAchieved && (candidateSet.weightUsed ?? -1) > (existingPb.weightUsed ?? -1)) {
          shouldUpdateOrAdd = true; // Same reps but heavier weight
        }
      } else if (pbType.includes('Max Duration')) { // For max duration, longer is better
        if ((candidateSet.durationPerformed ?? 0) > (existingPb.durationPerformed ?? 0)) {
          shouldUpdateOrAdd = true;
        }
      } else { // For weight-based PBs (XRM, Heaviest Lifted), heavier is better
        if ((candidateSet.weightUsed ?? -1) > (existingPb.weightUsed ?? -1)) {
          shouldUpdateOrAdd = true;
        }
        // Could add a tie-breaker for same weight but more reps if the pbType implies it (e.g. "Heaviest 5RM")
      }

      if (shouldUpdateOrAdd) {
        existingPBsList[existingPbIndex] = newPbData;
      }
    } else { // No PB of this type exists yet, so add it
      shouldUpdateOrAdd = true;
      existingPBsList.push(newPbData);
    }
  }

  getPersonalBestForExerciseByType(exerciseId: string, pbType: string): Observable<PersonalBestSet | null> {
    return this.personalBests$.pipe(
      map(allPBs => {
        const exercisePBs = allPBs[exerciseId];
        return exercisePBs?.find(pb => pb.pbType === pbType) || null;
      })
    );
  }

  getAllPersonalBestsForExercise(exerciseId: string): Observable<PersonalBestSet[]> {
    return this.personalBests$.pipe(map(allPBs => allPBs[exerciseId] || []));
  }

  getAllPersonalWorkouts(): Observable<WorkoutLog[]> {
    return this.workoutLogs$;
  }

  /**
   * Clears all stored personal bests.
   * Useful for development or user-initiated reset.
   */
  clearAllPersonalBests_DEV_ONLY(): Promise<void> { // Changed return type
    return this.alertService.showConfirm("Info", "DEVELOPMENT: Are you sure you want to delete ALL personal bests? This cannot be undone.")
      .then(async (result) => { // Added async for await
        if (result && result.data) {
          this.savePBsToStorage({}); // Save an empty object to clear PBs
          await this.alertService.showAlert("Info", "All personal bests cleared!"); // await this
        }
      });
  }


  /**
   * Retrieves performance history for a specific exercise.
   * For each workout log containing the exercise, it finds the set with the maximum weight lifted.
   * @param exerciseId The ID of the exercise.
   * @returns An Observable array of performance data points, sorted by date.
   */
  getExercisePerformanceHistory(exerciseId: string): Observable<ExercisePerformanceDataPoint[]> {
    return this.workoutLogs$.pipe(
      map(logs => {
        const performanceHistory: ExercisePerformanceDataPoint[] = [];

        // Filter logs that contain the specific exercise and sort them by date ascending
        const relevantLogs = logs
          .filter(log => log.exercises.some(ex => ex.exerciseId === exerciseId))
          .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()); // Oldest first for charting

        relevantLogs.forEach(log => {
          let maxWeightThisSession: number | undefined = undefined;
          let repsAtMaxWeight: number | undefined = undefined;

          log.exercises.forEach(loggedEx => {
            if (loggedEx.exerciseId === exerciseId) {
              loggedEx.sets.forEach(set => {
                if (set.weightUsed !== undefined && set.weightUsed !== null) {
                  if (maxWeightThisSession === undefined || set.weightUsed > maxWeightThisSession) {
                    maxWeightThisSession = set.weightUsed;
                    repsAtMaxWeight = set.repsAchieved;
                  } else if (set.weightUsed === maxWeightThisSession) {
                    // If weights are equal, prefer higher reps (or could be other logic)
                    if (repsAtMaxWeight === undefined || set.repsAchieved > repsAtMaxWeight) {
                      repsAtMaxWeight = set.repsAchieved;
                    }
                  }
                }
              });
            }
          });

          if (maxWeightThisSession !== undefined) {
            performanceHistory.push({
              date: parseISO(log.date), // Use the log's date
              value: maxWeightThisSession,
              reps: repsAtMaxWeight,
              logId: log.id
            });
          }
        });
        // console.log(`Performance history for ${exerciseId}:`, performanceHistory);
        return performanceHistory;
      })
    );
  }

  /** Returns the current list of workout logs for backup */
  public getLogsForBackup(): WorkoutLog[] {
    return this.workoutLogsSubject.getValue();
  }

  /** Returns the current personal bests data for backup */
  public getPBsForBackup(): Record<string, PersonalBestSet[]> {
    return this.personalBestsSubject.getValue();
  }


  /** Replaces the current workout logs with imported data */
  public replaceLogs(newLogs: WorkoutLog[]): void {
    if (!Array.isArray(newLogs)) {
      console.error('TrackingService: Imported data for logs is not an array.');
      return;
    }
    // TODO: More robust validation of array content

    this.saveWorkoutLogsToStorage(newLogs);
    console.log('TrackingService: Logs replaced with imported data.');
  }

  /** Replaces the current personal bests with imported data */
  public replacePBs(newPBs: Record<string, PersonalBestSet[]>): void {
    // Basic validation: check if it's an object
    if (typeof newPBs !== 'object' || newPBs === null || Array.isArray(newPBs)) {
      console.error('TrackingService: Imported data for PBs is not an object.');
      return;
    }
    // TODO: More robust validation of object content

    this.savePBsToStorage(newPBs);
    console.log('TrackingService: PBs replaced with imported data.');
  }

  /**
   * Retrieves all workout logs associated with a specific routine ID.
   * Logs are returned sorted by date, newest first, inheriting the sort order from workoutLogs$.
   * @param routineId The ID of the routine to filter logs by.
   * @returns An Observable emitting an array of WorkoutLog objects that match the routineId.
   *          Returns an empty array if no logs match or if routineId is null/undefined.
   */
  getWorkoutLogsByRoutineId(routineId: string | null | undefined): Observable<WorkoutLog[]> {
    if (!routineId) {
      return of([]); // Return an empty array observable if routineId is not provided
    }
    return this.workoutLogs$.pipe(
      map(allLogs => {
        return allLogs.filter(log => log.routineId === routineId);
      })
      // tap(filteredLogs => console.log(`Logs for routine ${routineId}:`, filteredLogs)) // For debugging
    );
  }

  /**
   * Clears all workout logs associated with a specific routine ID.
   * Prompts the user for confirmation before deleting.
   * @param routineId The ID of the routine whose logs should be cleared.
   * @returns A Promise that resolves to true if logs were cleared, false otherwise.
   */
  public async clearWorkoutLogsByRoutineId(routineId: string): Promise<boolean> {
    if (!routineId) {
      console.warn('TrackingService: clearWorkoutLogsByRoutineId called with no routineId.');
      this.alertService.showAlert("Warning", "No routine ID provided to clear logs.");
      return false;
    }

    const currentLogs = this.workoutLogsSubject.getValue();
    const logsToKeep = currentLogs.filter(log => log.routineId !== routineId);
    const logsToDeleteCount = currentLogs.length - logsToKeep.length;

    let routineOriginalName = '';
    this.workoutService.getRoutineById(routineId).pipe(
      take(1),
      map(routine => routine?.name || '')
    ).subscribe(routineName => {
      routineOriginalName = routineName;
    });

    if (logsToDeleteCount === 0) {
      this.alertService.showConfirm("Info", "Are you sure you want to delete this routine? This action cannot be undone.").then((result) => {
        console.log(result);
        if (result && (result.data)) {
          this.workoutService.deleteRoutine(routineId);
          this.alertService.showAlert("Info", `Routine "${routineOriginalName}" deleted successfully!`);
          return true;
        } else {
          return false;
        }
      });
      return false;
    } else {
      const confirmation = await this.alertService.showConfirm(
        "Confirm Deletion",
        `Are you sure you want to delete this routine? There are ${logsToDeleteCount} workout log(s) associated with this routine: if you confirm you'll delete the routine and loose your previously logged workouts. This action cannot be undone.`
      );

      if (confirmation && confirmation.data) { // Assuming confirmation.data is true if confirmed
        this.saveWorkoutLogsToStorage(logsToKeep);
        this.workoutService.deleteRoutine(routineId);
        // Note: This does not automatically update/remove PBs that might have been derived
        // from these deleted logs. A full PB recalculation or targeted PB removal
        // would be a more complex operation if required.
        this.alertService.showAlert("Success", `${logsToDeleteCount} workout log(s) for the routine have been cleared and the routine itself (${routineOriginalName}) it's been deleted.`);
        console.log(`Cleared ${logsToDeleteCount} logs for routineId: ${routineId}`);
        return true;
      }
      return false;
    }
  }

  /**
   * Updates an existing workout log.
   * @param updatedLog The complete WorkoutLog object with modifications.
   * @returns A Promise that resolves when the update is complete.
   */
  async updateWorkoutLog(updatedLog: WorkoutLog): Promise<void> { // Make it async
    if (!updatedLog || !updatedLog.id) {
      console.error('TrackingService: updateWorkoutLog called with invalid data or missing ID.');
      throw new Error('Invalid log data for update.'); // Or return Promise.reject()
    }

    let currentLogs = this.workoutLogsSubject.getValue();
    const logIndex = currentLogs.findIndex(log => log.id === updatedLog.id);

    if (logIndex > -1) {
      // --- Optional: More sophisticated PB handling for updates ---
      // 1. Get PBs derived from the *original* version of this log (complex to track which PBs came from which set of which log)
      // 2. Remove those PBs.
      // 3. Then, after saving the updated log, re-calculate PBs based on the *new* version of the log.
      // For now, a simpler approach: just update the log and run PB calculation on the new version.
      // This might leave some old PBs orphaned if a record set was edited to be lower.
      // A full "recalculate all PBs from all logs" might be another utility if needed.

      const newLogsArray = [...currentLogs];
      newLogsArray[logIndex] = { ...updatedLog }; // Ensure a new object reference for change detection
      this.saveWorkoutLogsToStorage(newLogsArray); // This also sorts and emits

      // Re-calculate PBs based on the updated log.
      // This assumes updateAllPersonalBestsFromLog correctly handles potentially "downgrading" PBs
      // if an edited set is now worse than a previous PB from another log.
      // If not, more complex logic is needed to "retract" PBs from the original log version first.
      this.updateAllPersonalBestsFromLog(updatedLog);

      console.log('Updated workout log:', updatedLog);
      // return Promise.resolve(); // Implicitly returns Promise<void> if no error
    } else {
      console.error(`TrackingService: WorkoutLog with ID ${updatedLog.id} not found for update.`);
      throw new Error(`WorkoutLog with ID ${updatedLog.id} not found.`); // Or return Promise.reject()
    }
  }

  /**
   * Handles the repercussions of an exercise definition being deleted.
   * It iterates through all workout logs, removes references to the deleted exercise,
   * and potentially deletes logs if they become empty.
   * Also, PBs for the deleted exercise are cleared.
   * @param deletedExerciseId The ID of the exercise definition that was deleted.
   * @returns A Promise that resolves when processing is complete.
   */
  async handleExerciseDeletion(deletedExerciseId: string): Promise<void> {
    console.log(`Handling deletion repercussions for exercise ID: ${deletedExerciseId}`);
    let allLogs = this.workoutLogsSubject.getValue();
    let logsModified = false;

    const updatedLogs = allLogs.map(log => {
      const originalExerciseCount = log.exercises.length;
      const exercisesToKeep = log.exercises.filter(loggedEx => loggedEx.exerciseId !== deletedExerciseId);

      if (exercisesToKeep.length < originalExerciseCount) {
        logsModified = true;
        if (exercisesToKeep.length === 0) {
          // Log becomes empty, mark it for removal by returning null (or filter out later)
          console.log(`Workout log ${log.id} will be deleted as it becomes empty after removing exercise ${deletedExerciseId}.`);
          return null;
        }
        return { ...log, exercises: exercisesToKeep };
      }
      return log;
    }).filter(log => log !== null) as WorkoutLog[]; // Filter out logs marked for deletion

    if (logsModified) {
      console.log('Some workout logs were modified or deleted due to exercise deletion.');
      this.saveWorkoutLogsToStorage(updatedLogs); // Save the modified list of logs
    }

    // Clear Personal Bests for the deleted exercise
    const currentPBs = this.personalBestsSubject.getValue();
    if (currentPBs[deletedExerciseId]) {
      const updatedPBs = { ...currentPBs };
      delete updatedPBs[deletedExerciseId];
      this.savePBsToStorage(updatedPBs);
      console.log(`Personal bests cleared for deleted exercise ID: ${deletedExerciseId}`);
    }
    // No need to return explicitly for a Promise<void> if successful
  }

}