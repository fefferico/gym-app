// src/app/core/services/tracking.service.ts
import { Injectable, Injector, inject } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { LastPerformanceSummary, LoggedSet, PersonalBestSet, WorkoutLog, PBHistoryInstance } from '../models/workout-log.model'; // Ensure PBHistoryInstance is imported
import { StorageService } from './storage.service';
import { ExerciseSetParams, Routine } from '../models/workout.model';
import { parseISO } from 'date-fns';
import { AlertService } from './alert.service';
import { WorkoutService } from './workout.service';
import { ToastService } from './toast.service';
import { ExerciseService } from './exercise.service';
import { start } from 'repl';
import { TrainingProgramService } from './training-program.service';
import { PausedWorkoutState } from '../../features/workout-tracker/workout-player';

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
  private injector = inject(Injector); // Inject the Injector
  private toastService = inject(ToastService);
  private trainingProgramService = inject(TrainingProgramService);

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


  private get exerciseService(): ExerciseService {
    return this.injector.get(ExerciseService);
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
        timestamp: logStartTimeISO,
        exerciseId: ex.exerciseId,
      }))
    }));

    const newLog: WorkoutLog = {
      ...newLogData,
      exercises: updatedExercises,
      id: newWorkoutLogId,
      date: logStartTimeISO.split('T')[0],
      // Ensure scheduledDayId is passed through
      scheduledDayId: newLogData.scheduledDayId
    };

    if (newLog.startTime && newLog.endTime && !newLog.durationMinutes) {
      newLog.durationMinutes = Math.round((newLog.endTime - newLog.startTime) / (1000 * 60));
      newLog.durationSeconds = Math.round((newLog.endTime - newLog.startTime) / (1000));
    }

    const updatedLogs = [newLog, ...currentLogs];
    this.saveWorkoutLogsToStorage(updatedLogs);
    this.updateAllPersonalBestsFromLog(newLog);

    // --- NEW: LINK THE LOG TO THE PROGRAM SCHEDULE ---
    if (newLog.programId && newLog.scheduledDayId) {
      this.trainingProgramService.markScheduledDayAsCompleted(
        newLog.programId,
        newLog.scheduledDayId,
        newLog.id,
        newLog.date
      );
    }

    // --- NEW: UPDATE EXERCISE TIMESTAMPS ---
    if (newLog.exercises && newLog.exercises.length > 0) {
      const usedExerciseIds = newLog.exercises.map(ex => ex.exerciseId);
      this.exerciseService.updateLastUsedTimestamp(usedExerciseIds);
    }
    // -------------------------------------

    console.log('Added workout log:', newLog.id);
    return newLog;
  }

  getWorkoutLogById(id: string): Observable<WorkoutLog | undefined> {
    return this.workoutLogs$.pipe(map(logs => logs.find(log => log.id === id)));
  }

  getWorkoutLogByRoutineId(routineId: string): Observable<WorkoutLog | undefined> {
    return this.workoutLogs$.pipe(map(logs => logs.find(log => log.routineId === routineId)));
  }

  getLogsForDate(date: string): Observable<WorkoutLog[] | undefined> {
    return this.workoutLogs$.pipe(map(logs => logs.filter(log => log.date === date)));
  }

  clearAllWorkoutLogs_DEV_ONLY(): Promise<void> {
    return this.alertService.showConfirm("Info", "DEVELOPMENT: Are you sure you want to delete ALL workout logs? This cannot be undone")
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

  getLastPerformanceForRoutine(routineId: string): Observable<LastPerformanceSummary | null> {
    return this.workoutLogs$.pipe(
      map(logs => {
        const routineLog = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).find(log => log.routineId === routineId);
        if (!routineLog) return null;
        return {
          lastPerformedDate: routineLog.date,
          workoutLogId: routineLog.id,
          sets: routineLog.exercises.flatMap(ex => ex.sets),
          startTime: routineLog.startTime,
          endTime: routineLog.endTime,
          durationMinutes: routineLog.durationMinutes,
        };
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
        }
        if ((candidateSet.weightUsed ?? -1) >= (existingPb.weightUsed ?? -1) && (candidateSet.repsAchieved ?? -1) >= (existingPb.repsAchieved ?? -1)) {
            isBetter = true;
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
    const conf = await this.alertService.showAlert("PBs Recalculation", "All your personal bests from your entire workout history will be now recalculated: this may take a moment");
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
    return this.alertService.showConfirm("Info", "DEVELOPMENT: Are you sure you want to delete ALL personal bests? This cannot be undone")
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

  /**
    * Merges imported workout logs with the current data.
    * - If an imported log has an ID that already exists, it will be updated.
    * - If an imported log has a new ID, it will be added.
    * - Logs that exist locally but are not in the imported data will be preserved.
    * After merging, it triggers a full recalculation of personal bests.
    *
    * @param newLogs The array of WorkoutLog objects to merge.
    */
  public async replaceLogs(newLogs: WorkoutLog[]): Promise<void> { // +++ Made async for await
    // 1. Basic validation
    if (!Array.isArray(newLogs)) {
      console.error('TrackingService: Imported data for logs is not an array.');
      this.toastService.error('Import failed: Invalid workout log file.', 0, "Import Error");
      return;
    }

    // +++ START of new merge logic +++

    // 2. Get current state
    const currentLogs = this.workoutLogsSubject.getValue();

    // 3. Create a map of current logs for efficient lookup and update
    const logMap = new Map<string, WorkoutLog>(
      currentLogs.map(log => [log.id, log])
    );

    let updatedCount = 0;
    let addedCount = 0;

    // 4. Iterate over the imported logs and merge them into the map
    newLogs.forEach(importedLog => {
      if (!importedLog.id || !importedLog.date) {
        console.warn('Skipping invalid log during import:', importedLog);
        return;
      }

      if (logMap.has(importedLog.id)) {
        updatedCount++;
      } else {
        addedCount++;
      }
      // Overwrite existing or add new
      logMap.set(importedLog.id, importedLog);
    });

    // 5. Convert the map back to an array
    const mergedLogs = Array.from(logMap.values());

    // 6. Save the new merged array of logs
    this.saveWorkoutLogsToStorage(mergedLogs);

    // 7. Provide user feedback before the PB recalculation
    console.log(`TrackingService: Merged logs. Updated: ${updatedCount}, Added: ${addedCount}`);
    this.toastService.success(
      `Logs imported. ${updatedCount} updated, ${addedCount} added.`,
      6000,
      "Logs Merged"
    );

   // --- NEW: Trigger the backfill for lastUsedAt timestamps ---
    await this.backfillLastUsedExerciseTimestamps();
    // -----------------------------------------------------------

    // 8. Recalculate all PBs from the newly merged history
    // We do this without a confirmation prompt as it's a necessary step after import.
    console.log('Recalculating personal bests after log import...');
    this.toastService.info('Recalculating personal bests...', 2000, "Please Wait");

    // Perform the recalculation (reusing the core logic of the public method)
    const allMergedLogs = this.workoutLogsSubject.getValue();
    const sortedLogsForRecalc = [...allMergedLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sortedLogsForRecalc.length === 0) {
      this.savePBsToStorage({}); // Clear PBs if no logs exist
      this.toastService.success('Personal bests cleared as there are no logs.', 3000, "PBs Recalculated");
      return;
    }

    // This part is extracted from the public `recalculateAllPersonalBests` to avoid the user prompt
    const newPBsMaster: Record<string, PersonalBestSet[]> = {};
    sortedLogsForRecalc.forEach(log => {
      const logTimestamp = new Date(log.startTime).toISOString();
      log.exercises.forEach(loggedEx => {
        if (!newPBsMaster[loggedEx.exerciseId]) {
          newPBsMaster[loggedEx.exerciseId] = [];
        }
        const exercisePBsListForRecalc: PersonalBestSet[] = newPBsMaster[loggedEx.exerciseId];
        loggedEx.sets.forEach(originalSet => {
          const candidateSet: LoggedSet = { ...originalSet, timestamp: originalSet.timestamp || logTimestamp, workoutLogId: originalSet.workoutLogId || log.id, exerciseId: originalSet.exerciseId || loggedEx.exerciseId, };
          if (candidateSet.weightUsed === undefined || candidateSet.weightUsed === null || candidateSet.weightUsed === 0) {
            if (candidateSet.repsAchieved > 0) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Max Reps (Bodyweight)`);
            if (candidateSet.durationPerformed && candidateSet.durationPerformed > 0) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Max Duration`);
            return;
          }
          if (candidateSet.repsAchieved === 1) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `1RM (Actual)`);
          if (candidateSet.repsAchieved === 3) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `3RM (Actual)`);
          if (candidateSet.repsAchieved === 5) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `5RM (Actual)`);
          this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Heaviest Lifted`);
          if (candidateSet.repsAchieved > 1) {
            const e1RM = candidateSet.weightUsed * (1 + candidateSet.repsAchieved / 30);
            const e1RMSet: LoggedSet = { ...candidateSet, repsAchieved: 1, weightUsed: parseFloat(e1RM.toFixed(2)) };
            this.updateSpecificPB(exercisePBsListForRecalc, e1RMSet, `1RM (Estimated)`);
          }
        });
      });
    });

    this.savePBsToStorage(newPBsMaster);
    console.log('Personal Bests recalculated from all merged logs.');
    this.toastService.success('Personal bests successfully recalculated!', 3000, "PBs Updated");

    // +++ END of new merge logic +++
  }

  /**
     * Merges imported Personal Bests data. This is less common to use than merging logs,
     * but follows the same non-destructive pattern.
     * It merges the PB list for each exercise ID.
     *
     * @param newPBs The imported PB record object.
     */
  public replacePBs(newPBs: Record<string, PersonalBestSet[]>): void {
    if (typeof newPBs !== 'object' || newPBs === null || Array.isArray(newPBs)) {
      console.error('TrackingService: Imported data for PBs is not an object.');
      this.toastService.error('Import failed: Invalid personal bests file.', 0, "Import Error");
      return;
    }

    // +++ START of new merge logic +++
    const currentPBs = this.personalBestsSubject.getValue();

    // The newPBs object is the master. We iterate through it.
    for (const exerciseId in newPBs) {
      if (Object.prototype.hasOwnProperty.call(newPBs, exerciseId)) {
        const importedPbList = newPBs[exerciseId];
        const currentPbList = currentPBs[exerciseId] || [];

        // Create a map of the current PBs for this specific exercise
        const pbMap = new Map<string, PersonalBestSet>(
          currentPbList.map(pb => [pb.pbType, pb])
        );

        // Merge the imported PBs for this exercise into the map
        importedPbList.forEach(importedPb => {
          pbMap.set(importedPb.pbType, importedPb);
        });

        // Update the master PB object with the merged list for this exercise
        currentPBs[exerciseId] = Array.from(pbMap.values());
      }
    }

    this.savePBsToStorage(currentPBs);
    console.log('TrackingService: PBs merged with imported data.');
    this.toastService.success('Personal bests data merged successfully.', 3000, "PBs Merged");
    // +++ END of new merge logic +++
  }

  getWorkoutLogsByRoutineId(routineId: string | null | undefined): Observable<WorkoutLog[]> {
    if (!routineId) return of([]);
    return this.workoutLogs$.pipe(map(allLogs => allLogs.filter(log => log.routineId === routineId)));
  }

  public async clearWorkoutLogsByRoutineId(routineId: string): Promise<boolean> {
    if (!routineId) {
      this.alertService.showAlert("Warning", "No routine ID provided to clear logs");
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
      const result = await this.alertService.showConfirm("Confirm Deletion", `Are you sure you want to delete the routine "${routineOriginalName}"? This action cannot be undone`);
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
        this.alertService.showAlert("Success", `${logsToDeleteCount} workout log(s) and the routine "${routineOriginalName}" have been deleted`);
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

      // --- NEW: UPDATE EXERCISE TIMESTAMPS ON LOG EDIT ---
      if (fullyUpdatedLog.exercises && fullyUpdatedLog.exercises.length > 0) {
        const usedExerciseIds = fullyUpdatedLog.exercises.map(ex => ex.exerciseId);
        this.exerciseService.updateLastUsedTimestamp(usedExerciseIds);
      }
      // ------------------------------------------------

      await this.recalculateAllPersonalBests();
      console.log('Updated workout log and recalculated PBs:', updatedLog.id);
    } else {
      console.error(`TrackingService: WorkoutLog with ID ${updatedLog.id} not found for update`);
      throw new Error(`WorkoutLog with ID ${updatedLog.id} not found`);
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
          console.log(`Workout log ${log.id} will be deleted as it becomes empty`);
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
      console.warn(`TrackingService: WorkoutLog with ID ${logId} not found for deletion`);
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


  /**
   * --- NEW METHOD for Backfilling Data ---
   * Scans all workout logs to find the most recent usage date for each exercise
   * and updates the `lastUsedAt` property on the exercises via the ExerciseService.
   * This is an intensive operation and should be run manually or after data imports.
   */
  public async backfillLastUsedExerciseTimestamps(): Promise<void> {
    console.log('Starting backfill of lastUsedAt timestamps for all exercises...');
    this.toastService.info('Updating exercise history...', 2000, "Please Wait");

    const allLogs = this.workoutLogsSubject.getValue();
    if (!allLogs || allLogs.length === 0) {
      console.log('No logs found. Aborting backfill.');
      return;
    }

    // The logs are already sorted newest first, which is perfect.
    // We will iterate and the first time we see an exercise ID, that's its most recent use.
    const lastUsedMap = new Map<string, string>(); // Map<exerciseId, lastUsedTimestamp>

    for (const log of allLogs) {
      for (const loggedEx of log.exercises) {
        // If we haven't already found a newer log for this exercise, record this one.
        if (!lastUsedMap.has(loggedEx.exerciseId)) {
          lastUsedMap.set(loggedEx.exerciseId, log.date);
        }
      }
    }

    // Now, tell the ExerciseService to perform the batch update
    await this.exerciseService.batchUpdateLastUsedTimestamps(lastUsedMap);

    console.log(`Backfill complete. Updated timestamps for ${lastUsedMap.size} exercises.`);
    this.toastService.success('Exercise history has been updated!', 3000, "Update Complete");
  }
}