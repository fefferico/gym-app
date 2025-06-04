// src/app/core/services/tracking.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { LoggedSet, WorkoutLog } from '../models/workout-log.model'; // Ensure path is correct
import { StorageService } from './storage.service';       // Ensure path is correct
import { ExerciseSetParams } from '../models/workout.model';
// Later, you might import Exercise and Routine models for PB calculations


export interface LastPerformanceSummary {
  lastPerformedDate: string;
  sets: LoggedSet[]; // The actual sets performed for that exercise in that last session
}

@Injectable({
  providedIn: 'root',
})
export class TrackingService {
  private storageService = inject(StorageService);
  private readonly WORKOUT_LOGS_STORAGE_KEY = 'fitTrackPro_workoutLogs';
  // private readonly PERSONAL_BESTS_STORAGE_KEY = 'fitTrackPro_personalBests'; // For later

  // BehaviorSubject for reactive workout logs
  private workoutLogsSubject = new BehaviorSubject<WorkoutLog[]>(this.loadWorkoutLogsFromStorage());
  public workoutLogs$: Observable<WorkoutLog[]> = this.workoutLogsSubject.asObservable();

  // Placeholder for PBs - to be developed
  // private personalBestsSubject = new BehaviorSubject<any>({}); // Define PB model later
  // public personalBests$: Observable<any> = this.personalBestsSubject.asObservable();


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
    const currentLogs = this.workoutLogsSubject.getValue();
    const newLog: WorkoutLog = {
      ...newLogData,
      id: uuidv4(),
    };

    // Calculate duration if not provided and endTime exists
    if (newLog.startTime && newLog.endTime && !newLog.durationMinutes) {
      newLog.durationMinutes = Math.round((newLog.endTime - newLog.startTime) / (1000 * 60));
    }

    const updatedLogs = [newLog, ...currentLogs]; // Add to the beginning for newest first
    this.saveWorkoutLogsToStorage(updatedLogs);
    console.log('Added workout log:', newLog);

    // TODO: Update Personal Bests based on this new log
    // this.updatePersonalBests(newLog);

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
  clearAllWorkoutLogs_DEV_ONLY(): void {
    const confirmClear = confirm("DEVELOPMENT: Are you sure you want to delete ALL workout logs? This cannot be undone.");
    if (confirmClear) {
      this.saveWorkoutLogsToStorage([]);
      console.log("All workout logs cleared.");
    }
  }

  /**
   * Gets the most recent performance (all logged sets) for a specific exercise.
   * @param exerciseId The ID of the exercise.
   * @returns An Observable of LastPerformanceSummary or null if no prior performance is found.
   */
  getLastPerformanceForExercise(exerciseId: string): Observable<LastPerformanceSummary | null> {
    return this.workoutLogs$.pipe(
      map(logs => {
        // Logs are already sorted newest first by date in load/save
        for (const log of logs) {
          const foundExerciseInLog = log.exercises.find(ex => ex.exerciseId === exerciseId);
          if (foundExerciseInLog && foundExerciseInLog.sets.length > 0) {
            return {
              lastPerformedDate: log.date,
              sets: [...foundExerciseInLog.sets] // Return a copy of the sets array
            };
          }
        }
        return null; // No performance found for this exercise
      }),
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
  ): LoggedSet | null {
    if (!lastPerformance || !lastPerformance.sets || lastPerformance.sets.length === 0) {
      return null;
    }

    // Simplistic approach: Try to match by set index if the number of sets was similar.
    // A more robust approach would be to match based on `plannedSetId` if the `LoggedSet`
    // stored the `plannedSetId` from the routine it was part of.
    // For now, let's assume we try to get the set at the same index.
    if (currentSetIndexInRoutine < lastPerformance.sets.length) {
      // Return the logged set from the previous performance at the same set index.
      // This assumes the structure of the exercise (number of sets) was similar.
      return lastPerformance.sets[currentSetIndexInRoutine];
    }

    // Fallback: return the last set performed for that exercise if index is out of bounds
    // but user might be doing more sets this time. This might not always be the desired behavior.
    // return lastPerformance.sets[lastPerformance.sets.length - 1];

    return null; // No matching previous set found by this logic
  }
}