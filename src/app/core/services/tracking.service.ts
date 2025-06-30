// src/app/core/services/tracking.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { LastPerformanceSummary, LoggedSet, PersonalBestSet, WorkoutLog, PBHistoryInstance } from '../models/workout-log.model'; // Ensure PBHistoryInstance is imported
import { StorageService } from './storage.service';
import { ExerciseSetParams, Routine } from '../models/workout.model';
import { parseISO } from 'date-fns';
import { AlertService } from './alert.service';
import { WorkoutService } from './workout.service';

export interface ExercisePerformanceDataPoint {
  date: Date;
  value: number;
  reps?: number;
  logId: string;
}

const MAX_PB_HISTORY_LENGTH = 999; // Max number of historical PBs to keep per type

@Injectable({
  providedIn: 'root',
})
export class TrackingService {
  private storageService = inject(StorageService);
  private alertService = inject(AlertService);
  private workoutService = inject(WorkoutService);
  private readonly WORKOUT_LOGS_STORAGE_KEY = 'fitTrackPro_workoutLogs';
  private readonly PERSONAL_BESTS_STORAGE_KEY = 'fitTrackPro_personalBests';

  private workoutLogsSubject = new BehaviorSubject<WorkoutLog[]>(this.loadWorkoutLogsFromStorage());
  public workoutLogs$: Observable<WorkoutLog[]> = this.workoutLogsSubject.asObservable();

  private personalBestsSubject = new BehaviorSubject<Record<string, PersonalBestSet[]>>(this.loadPBsFromStorage());
  public personalBests$: Observable<Record<string, PersonalBestSet[]>> = this.personalBestsSubject.asObservable();

  constructor() {
    // console.log('Initial workout logs loaded:', this.workoutLogsSubject.getValue());
  }

  private loadWorkoutLogsFromStorage(): WorkoutLog[] {
    const logs = this.storageService.getItem<WorkoutLog[]>(this.WORKOUT_LOGS_STORAGE_KEY);
    return logs ? logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
  }

  private saveWorkoutLogsToStorage(logs: WorkoutLog[]): void {
    this.storageService.setItem(this.WORKOUT_LOGS_STORAGE_KEY, logs);
    this.workoutLogsSubject.next([...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }

  addWorkoutLog(newLogData: Omit<WorkoutLog, 'id' | 'date'> & { startTime: number }): WorkoutLog {
    const newWorkoutLogId: string = uuidv4();
    const currentLogs = this.workoutLogsSubject.getValue();
    const logStartTimeISO = new Date(newLogData.startTime).toISOString();

    const updatedExercises = newLogData.exercises.map(ex => ({
      ...ex,
      workoutLogId: newWorkoutLogId,
      sets: ex.sets.map(set => ({
        ...set,
        id: set.id ?? uuidv4(),
        workoutLogId: newWorkoutLogId,
        timestamp: logStartTimeISO, // Set timestamp for each LoggedSet
        exerciseId: ex.exerciseId,  // Ensure exerciseId is on the set
      }))
    }));

    const newLog: WorkoutLog = {
      ...newLogData,
      exercises: updatedExercises,
      id: newWorkoutLogId,
      date: logStartTimeISO.split('T')[0],
    };

    if (newLog.startTime && newLog.endTime && !newLog.durationMinutes) {
      newLog.durationMinutes = Math.round((newLog.endTime - newLog.startTime) / (1000 * 60));
      newLog.durationSeconds = Math.round((newLog.endTime - newLog.startTime) / (1000));
    }

    const updatedLogs = [newLog, ...currentLogs];
    this.saveWorkoutLogsToStorage(updatedLogs);
    this.updateAllPersonalBestsFromLog(newLog); // Call PB update incrementally
    console.log('Added workout log:', newLog.id);
    return newLog;
  }

  getWorkoutLogById(id: string): Observable<WorkoutLog | undefined> {
    return this.workoutLogs$.pipe(map(logs => logs.find(log => log.id === id)));
  }

  clearAllWorkoutLogs_DEV_ONLY(): Promise<void> {
    return this.alertService.showConfirm("Info", "DEVELOPMENT: Are you sure you want to delete ALL workout logs? This cannot be undone.")
      .then(async (result) => {
        if (result && result.data) {
          this.saveWorkoutLogsToStorage([]);
          await this.recalculateAllPersonalBests(); // Recalculate PBs (will clear them)
          await this.alertService.showAlert("Info", "All workout logs cleared!");
        }
      });
  }

  getLastPerformanceForExercise(exerciseId: string): Observable<LastPerformanceSummary | null> {
    return this.workoutLogs$.pipe(
      map(logs => {
        for (const log of logs) {
          const performedExercise = log.exercises.find(ex => ex.exerciseId === exerciseId);
          if (performedExercise && performedExercise.sets.length > 0) {
            const summary: LastPerformanceSummary = {
              lastPerformedDate: log.date,
              workoutLogId: log.id,
              sets: [...performedExercise.sets]
            };
            return summary;
          }
        }
        return null;
      })
    );
  }

  findPreviousSetPerformance(lastPerformance: LastPerformanceSummary | null, currentSetTarget: ExerciseSetParams, currentSetIndexInRoutine: number): LoggedSet | null {
    if (!lastPerformance || !lastPerformance.sets || lastPerformance.sets.length === 0) {
      return null;
    }
    if (currentSetIndexInRoutine < lastPerformance.sets.length) {
      return lastPerformance.sets[currentSetIndexInRoutine];
    }
    return null;
  }

  private loadPBsFromStorage(): Record<string, PersonalBestSet[]> {
    return this.storageService.getItem<Record<string, PersonalBestSet[]>>(this.PERSONAL_BESTS_STORAGE_KEY) || {};
  }

  private savePBsToStorage(pbs: Record<string, PersonalBestSet[]>): void {
    this.storageService.setItem(this.PERSONAL_BESTS_STORAGE_KEY, pbs);
    this.personalBestsSubject.next({ ...pbs });
  }

  /**
   * Incrementally updates PBs based on a single new log.
   * Processes sets in the order they appear in the log.
   */
  private updateAllPersonalBestsFromLog(log: WorkoutLog): void {
    const currentPBs = { ...this.personalBestsSubject.getValue() }; // Get a mutable copy

    log.exercises.forEach(loggedEx => {
      if (!currentPBs[loggedEx.exerciseId]) {
        currentPBs[loggedEx.exerciseId] = [];
      }
      const exercisePBsList: PersonalBestSet[] = currentPBs[loggedEx.exerciseId];
      //const workoutLogId = loggedEx.workoutLogId || log.id;

      loggedEx.sets.forEach(setFromLog => {
        // Ensure set has all necessary context for PB processing
        const candidateSet: LoggedSet = {
          ...setFromLog,
          // timestamp is already set during addWorkoutLog
          // workoutLogId is already set during addWorkoutLog
          // exerciseId is already set during addWorkoutLog
        };

        if (candidateSet.weightUsed === undefined || candidateSet.weightUsed === null || candidateSet.weightUsed === 0) {
          if (candidateSet.repsAchieved > 0) this.updateSpecificPB(exercisePBsList, candidateSet, `Max Reps (Bodyweight)`);
          if (candidateSet.durationPerformed && candidateSet.durationPerformed > 0) this.updateSpecificPB(exercisePBsList, candidateSet, `Max Duration`);
          return;
        }

        if (candidateSet.repsAchieved === 1) this.updateSpecificPB(exercisePBsList, candidateSet, `1RM (Actual)`);
        if (candidateSet.repsAchieved === 3) this.updateSpecificPB(exercisePBsList, candidateSet, `3RM (Actual)`);
        if (candidateSet.repsAchieved === 5) this.updateSpecificPB(exercisePBsList, candidateSet, `5RM (Actual)`);
        this.updateSpecificPB(exercisePBsList, candidateSet, `Heaviest Lifted`);
        if (candidateSet.repsAchieved > 1) {
          const e1RM = candidateSet.weightUsed * (1 + candidateSet.repsAchieved / 30);
          const e1RMSet: LoggedSet = { ...candidateSet, repsAchieved: 1, weightUsed: parseFloat(e1RM.toFixed(2)) };
          this.updateSpecificPB(exercisePBsList, e1RMSet, `1RM (Estimated)`);
        }
      });
      // Sort for this exercise (mainly for internal consistency, display sorts separately)
      currentPBs[loggedEx.exerciseId] = exercisePBsList.sort((a, b) => (b.weightUsed ?? 0) - (a.weightUsed ?? 0));
    });
    this.savePBsToStorage(currentPBs);
    // console.log('Personal Bests updated incrementally:', currentPBs);
  }

  private updateSpecificPB(
    exercisePBsList: PersonalBestSet[],
    candidateSet: LoggedSet,
    pbType: string
  ): void {
    // Ensure candidateSet has all properties, especially timestamp, workoutLogId, exerciseId
    // These should be set when the LoggedSet is created from the WorkoutLog
    if (!candidateSet.timestamp || !candidateSet.workoutLogId || !candidateSet.exerciseId) {
      console.warn('PB Candidate set is missing critical context (timestamp, workoutLogId, or exerciseId):', candidateSet, 'for pbType:', pbType);
      return; // Cannot process without full context
    }

    const newPbData: PersonalBestSet = {
      ...candidateSet,
      pbType,
      history: [], // Initialize history for the new PB data
    };

    const existingPbIndex = exercisePBsList.findIndex(pb => pb.pbType === pbType);
    let shouldUpdateOrAdd = false;
    let oldPbToDemote: PersonalBestSet | undefined = undefined;

    if (existingPbIndex > -1) {
      const existingPb = exercisePBsList[existingPbIndex];
      // oldPbToDemote will be this existingPb if it's actually beaten

      let isBetter = false;
      if (pbType.includes('Max Reps')) {
        if (candidateSet.repsAchieved > existingPb.repsAchieved) isBetter = true;
        else if (candidateSet.repsAchieved === existingPb.repsAchieved && (candidateSet.weightUsed ?? -1) > (existingPb.weightUsed ?? -1)) isBetter = true;
      } else if (pbType.includes('Max Duration')) {
        if ((candidateSet.durationPerformed ?? 0) > (existingPb.durationPerformed ?? 0)) isBetter = true;
      } else { // Weight-based (XRM, Heaviest Lifted)
        if ((candidateSet.weightUsed ?? -1) > (existingPb.weightUsed ?? -1)) {
          isBetter = true;
        } else if (
          (candidateSet.weightUsed ?? -1) === (existingPb.weightUsed ?? -1) &&
          new Date(candidateSet.timestamp).getTime() > new Date(existingPb.timestamp).getTime()
          // Optional: Could add reps as a tie-breaker for same weight, same date if desired for 'Heaviest Lifted'
        ) {
          isBetter = true; // Same weight, newer date wins (or same performance on a later log)
        }
      }

      if (isBetter) {
        shouldUpdateOrAdd = true;
        oldPbToDemote = { ...existingPb }; // Capture the state of the PB being replaced for history
        // Prepare history for the new PB: new history item + old PB's history
        const historyInstance: PBHistoryInstance = {
          weightUsed: oldPbToDemote.weightUsed,
          repsAchieved: oldPbToDemote.repsAchieved,
          durationPerformed: oldPbToDemote.durationPerformed,
          timestamp: oldPbToDemote.timestamp,
          workoutLogId: oldPbToDemote.workoutLogId,
        };
        newPbData.history = [historyInstance, ...(oldPbToDemote.history || [])].slice(0, MAX_PB_HISTORY_LENGTH);
        exercisePBsList[existingPbIndex] = newPbData;
      } else {
        // Not better, do nothing to the existing PB.
        // If it's the *same* record being re-processed (e.g. recalculation), history is already on existingPb.
      }

    } else { // No PB of this type exists yet for this exercise
      shouldUpdateOrAdd = true;
      exercisePBsList.push(newPbData); // History is already initialized as []
    }
  }

  public async recalculateAllPersonalBests(): Promise<void> {
    const conf = await this.alertService.showConfirm("Confirm Recalculation", "Recalculate all personal bests from your entire workout history? This may take a moment.");
    if (!conf || !conf.data) {
      return;
    }

    // reset PBs
    this.savePBsToStorage({});

    const allLogs = this.workoutLogsSubject.getValue();
    // Sort logs by date, OLDEST FIRST, to build history correctly
    const sortedLogs = [...allLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (!sortedLogs || sortedLogs.length === 0) {
      this.alertService.showAlert('Info', 'There are no personal bests to be recalculated.');
      return Promise.resolve();
    }

    const newPBsMaster: Record<string, PersonalBestSet[]> = {};

    sortedLogs.forEach(log => {
      // Each set within a log needs to be processed.
      // The timestamp for a set should ideally be from the log's start time, or if sets have individual timestamps, use those.
      const logTimestamp = new Date(log.startTime).toISOString(); // Consistent timestamp for all sets in this log iteration

      log.exercises.forEach(loggedEx => {
        if (!newPBsMaster[loggedEx.exerciseId]) {
          newPBsMaster[loggedEx.exerciseId] = [];
        }
        // This is the list that updateSpecificPB will modify for the current exercise
        const exercisePBsListForRecalc: PersonalBestSet[] = newPBsMaster[loggedEx.exerciseId];

        loggedEx.sets.forEach(originalSet => {
          // Enrich set with context, especially timestamp from the log being processed, and exerciseId
          const candidateSet: LoggedSet = {
            ...originalSet,
            timestamp: originalSet.timestamp || logTimestamp, // Use log's timestamp if set doesn't have its own
            workoutLogId: originalSet.workoutLogId || log.id, // Prefer set's workoutLogId if it exists (e.g. from prior processing)
            exerciseId: originalSet.exerciseId || loggedEx.exerciseId, // Prefer set's exerciseId
          };

          if (candidateSet.weightUsed === undefined || candidateSet.weightUsed === null || candidateSet.weightUsed === 0) {
            if (candidateSet.repsAchieved > 0) {
              this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Max Reps (Bodyweight)`);
            }
            if (candidateSet.durationPerformed && candidateSet.durationPerformed > 0) {
              this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Max Duration`);
            }
            return;
          }

          if (candidateSet.repsAchieved === 1) {
            this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `1RM (Actual)`);
          }
          if (candidateSet.repsAchieved === 3) {
            this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `3RM (Actual)`);
          }
          if (candidateSet.repsAchieved === 5) {
            this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `5RM (Actual)`);
          }
          this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Heaviest Lifted`);
          if (candidateSet.repsAchieved > 1) {
            const e1RM = candidateSet.weightUsed * (1 + candidateSet.repsAchieved / 30);
            const e1RMSet: LoggedSet = { ...candidateSet, repsAchieved: 1, weightUsed: parseFloat(e1RM.toFixed(2)) };
            this.updateSpecificPB(exercisePBsListForRecalc, e1RMSet, `1RM (Estimated)`);
          }
        });
        // newPBsMaster[loggedEx.exerciseId] is already updated by reference via exercisePBsListForRecalc
      });
    });

    // After processing all logs, sort PBs within each exercise (optional, as display component sorts)
    for (const exId in newPBsMaster) {
      if (newPBsMaster.hasOwnProperty(exId)) {
        newPBsMaster[exId].sort((a, b) => (b.weightUsed ?? 0) - (a.weightUsed ?? 0));
      }
    }

    this.savePBsToStorage(newPBsMaster);
    console.log('Personal Bests recalculated from all logs:', newPBsMaster);
    this.alertService.showAlert('Success', 'All personal bests have been recalculated.');
  }

  getPersonalBestForExerciseByType(exerciseId: string, pbType: string): Observable<PersonalBestSet | null> {
    return this.personalBests$.pipe(map(allPBs => allPBs[exerciseId]?.find(pb => pb.pbType === pbType) || null));
  }

  getAllPersonalBestsForExercise(exerciseId: string): Observable<PersonalBestSet[]> {
    return this.personalBests$.pipe(map(allPBs => allPBs[exerciseId] || []));
  }

  getAllPersonalWorkouts(): Observable<WorkoutLog[]> {
    return this.workoutLogs$;
  }

  clearAllPersonalBests_DEV_ONLY(): Promise<void> {
    return this.alertService.showConfirm("Info", "DEVELOPMENT: Are you sure you want to delete ALL personal bests? This cannot be undone.")
      .then(async (result) => {
        if (result && result.data) {
          this.savePBsToStorage({});
          await this.alertService.showAlert("Info", "All personal bests cleared!");
        }
      });
  }

  getExercisePerformanceHistory(exerciseId: string): Observable<ExercisePerformanceDataPoint[]> {
    return this.workoutLogs$.pipe(
      map(logs => {
        const performanceHistory: ExercisePerformanceDataPoint[] = [];
        const relevantLogs = logs
          .filter(log => log.exercises.some(ex => ex.exerciseId === exerciseId))
          .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

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
                    if (repsAtMaxWeight === undefined || (set.repsAchieved > repsAtMaxWeight)) {
                      repsAtMaxWeight = set.repsAchieved;
                    }
                  }
                }
              });
            }
          });
          if (maxWeightThisSession !== undefined) {
            performanceHistory.push({
              date: parseISO(log.date),
              value: maxWeightThisSession,
              reps: repsAtMaxWeight,
              logId: log.id
            });
          }
        });
        return performanceHistory;
      })
    );
  }

  public getLogsForBackup(): WorkoutLog[] { return this.workoutLogsSubject.getValue(); }
  public getPBsForBackup(): Record<string, PersonalBestSet[]> { return this.personalBestsSubject.getValue(); }

  public replaceLogs(newLogs: WorkoutLog[]): void {
    if (!Array.isArray(newLogs)) { console.error('TrackingService: Imported data for logs is not an array.'); return; }
    this.saveWorkoutLogsToStorage(newLogs);
    this.recalculateAllPersonalBests(); // Recalculate PBs after importing logs
    console.log('TrackingService: Logs replaced, PBs recalculated.');
  }

  public replacePBs(newPBs: Record<string, PersonalBestSet[]>): void {
    if (typeof newPBs !== 'object' || newPBs === null || Array.isArray(newPBs)) { console.error('TrackingService: Imported data for PBs is not an object.'); return; }
    this.savePBsToStorage(newPBs);
    console.log('TrackingService: PBs replaced with imported data.');
  }

  getWorkoutLogsByRoutineId(routineId: string | null | undefined): Observable<WorkoutLog[]> {
    if (!routineId) return of([]);
    return this.workoutLogs$.pipe(map(allLogs => allLogs.filter(log => log.routineId === routineId)));
  }

  public async clearWorkoutLogsByRoutineId(routineId: string): Promise<boolean> {
    if (!routineId) {
      this.alertService.showAlert("Warning", "No routine ID provided to clear logs.");
      return false;
    }
    const currentLogs = this.workoutLogsSubject.getValue();
    const logsToKeep = currentLogs.filter(log => log.routineId !== routineId);
    const logsToDeleteCount = currentLogs.length - logsToKeep.length;
    let routineOriginalName = '';

    try {
      const routine = await this.workoutService.getRoutineById(routineId).pipe(take(1)).toPromise();
      routineOriginalName = routine?.name || 'Unknown Routine';
    } catch (e) { console.warn("Could not fetch routine name"); }


    if (logsToDeleteCount === 0) {
      const result = await this.alertService.showConfirm("Confirm Deletion", `Are you sure you want to delete the routine "${routineOriginalName}"? This action cannot be undone.`);
      if (result && result.data) {
        await this.workoutService.deleteRoutine(routineId);
        this.alertService.showAlert("Info", `Routine "${routineOriginalName}" deleted successfully!`);
        return true;
      }
      return false;
    } else {
      const confirmation = await this.alertService.showConfirm(
        "Confirm Deletion",
        `Are you sure you want to delete the routine "${routineOriginalName}"? There are ${logsToDeleteCount} workout log(s) associated with it. Deleting the routine will also delete these logs. This action cannot be undone.`
      );
      if (confirmation && confirmation.data) {
        this.saveWorkoutLogsToStorage(logsToKeep);
        await this.workoutService.deleteRoutine(routineId);
        await this.recalculateAllPersonalBests(); // Recalculate PBs
        this.alertService.showAlert("Success", `${logsToDeleteCount} workout log(s) and the routine "${routineOriginalName}" have been deleted.`);
        return true;
      }
      return false;
    }
  }

  async updateWorkoutLog(updatedLog: WorkoutLog): Promise<void> {
    if (!updatedLog || !updatedLog.id) {
      console.error('TrackingService: updateWorkoutLog called with invalid data or missing ID.');
      throw new Error('Invalid log data for update.');
    }
    let currentLogs = this.workoutLogsSubject.getValue();
    const logIndex = currentLogs.findIndex(log => log.id === updatedLog.id);

    if (logIndex > -1) {
      const logStartTimeISO = new Date(updatedLog.startTime).toISOString();
      const newExercises = updatedLog.exercises.map(ex => ({
        ...ex,
        sets: ex.sets.map(s => ({
          ...s,
          timestamp: s.timestamp || logStartTimeISO,
          workoutLogId: s.workoutLogId || updatedLog.id,
          exerciseId: s.exerciseId || ex.exerciseId,
        }))
      }));
      const fullyUpdatedLog = { ...updatedLog, exercises: newExercises };

      const newLogsArray = [...currentLogs];
      newLogsArray[logIndex] = fullyUpdatedLog;
      this.saveWorkoutLogsToStorage(newLogsArray);
      // For best accuracy after an edit, a full recalculation is ideal.
      // updateAllPersonalBestsFromLog(fullyUpdatedLog) is faster but might not catch all edge cases (e.g., if a PB was reduced).
      await this.recalculateAllPersonalBests();
      console.log('Updated workout log and recalculated PBs:', updatedLog.id);
    } else {
      console.error(`TrackingService: WorkoutLog with ID ${updatedLog.id} not found for update.`);
      throw new Error(`WorkoutLog with ID ${updatedLog.id} not found.`);
    }
  }

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
          console.log(`Workout log ${log.id} will be deleted as it becomes empty.`);
          return null;
        }
        return { ...log, exercises: exercisesToKeep };
      }
      return log;
    }).filter(log => log !== null) as WorkoutLog[];

    if (logsModified || allLogs.length !== updatedLogs.length) {
      console.log('Some workout logs were modified or deleted due to exercise deletion.');
      this.saveWorkoutLogsToStorage(updatedLogs);
    }

    // Always recalculate PBs to ensure consistency, even if only PBs for the deleted exercise are affected.
    // This will also handle clearing PBs for the deleted exercise.
    console.log('Recalculating PBs after exercise deletion.');
    await this.recalculateAllPersonalBests();
  }

  async deleteWorkoutLog(logId: string): Promise<void> {
    if (!logId) { throw new Error('Invalid log ID for deletion.'); }
    const currentLogs = this.workoutLogsSubject.getValue();
    const logExists = currentLogs.some(log => log.id === logId);

    if (!logExists) {
      console.warn(`TrackingService: WorkoutLog with ID ${logId} not found for deletion.`);
      return;
    }
    const updatedLogs = currentLogs.filter(log => log.id !== logId);
    this.saveWorkoutLogsToStorage(updatedLogs);
    console.log(`Workout log with ID ${logId} deleted. Recalculating PBs...`);
    await this.recalculateAllPersonalBests();
  }

  /**
   * Retrieves all workout logs associated with a specific program ID and within a given date range.
   * @param programId The ID of the program to filter logs by.
   * @param startDate The start date (inclusive) as a Date object.
   * @param endDate The end date (inclusive) as a Date object.
   * @returns An Observable emitting an array of WorkoutLog objects that match the criteria.
   */
  getWorkoutLogsByProgramIdForDateRange(programId: string | null | undefined, startDate: Date, endDate: Date): Observable<WorkoutLog[]> {
    if (!programId || !startDate || !endDate) return of([]);
    return this.workoutLogs$.pipe(
      map(allLogs =>
        allLogs.filter(log => {
          const logDate = parseISO(log.date);
          return (log.programId === programId && logDate >= startDate && logDate <= endDate);
        })
      )
    );
  }
}