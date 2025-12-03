// src/app/core/services/tracking.service.ts
import { Injectable, Injector, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import { delay, distinctUntilChanged, map, shareReplay, take } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { LastPerformanceSummary, LoggedSet, PersonalBestSet, WorkoutLog, PBHistoryInstance, LoggedWorkoutExercise } from '../models/workout-log.model'; // Ensure PBHistoryInstance is imported
import { StorageService } from './storage.service';
import { ExerciseTargetSetParams, METRIC, Routine } from '../models/workout.model';
import { parseISO } from 'date-fns';
import { AlertService } from './alert.service';
import { WorkoutService } from './workout.service';
import { ToastService } from './toast.service';
import { ExerciseService } from './exercise.service';
import { TrainingProgramService } from './training-program.service';
import { PerceivedWorkoutInfo } from '../../features/workout-tracker/perceived-effort-modal.component';
import { mapLegacyLoggedExercisesToCurrent } from '../models/workout-mapper';
import { TranslateService } from '@ngx-translate/core';
import { repsTypeToReps, genRepsTypeFromRepsNumber, getWeightValue, weightToExact, getDurationValue, getDistanceValue, durationToExact, distanceToExact, restToExact, migrateSetRepsToRepsTarget, migrateSetWeightToWeightTarget, migrateSetDurationToDurationTarget, migrateSetDistanceToDistanceTarget, migrateSetRestToRestTarget, weightToBodyweight } from './workout-helper.service';

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
  private translate = inject(TranslateService);

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

    const updatedExercises = newLogData.workoutExercises.map(ex => ({
      ...ex,
      workoutLogId: newWorkoutLogId,
      sets: ex.sets.map(set => ({
        ...set,
        id: set.id ?? uuidv4(),
        workoutLogId: newWorkoutLogId,
        timestamp: set.timestamp || logStartTimeISO,
        exerciseId: ex.exerciseId,
      }))
    }));

    const newLog: WorkoutLog = {
      ...newLogData,
      workoutExercises: updatedExercises,
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
    if (newLog.workoutExercises && newLog.workoutExercises.length > 0) {
      const usedExerciseIds = newLog.workoutExercises.map(ex => ex.exerciseId);
      this.exerciseService.updateLastUsedTimestamp(usedExerciseIds);
    }
    // After adding the new log and saving, if it was associated with a routine,
    // run our new helper to ensure the routine's lastPerformed date is correct.
    if (newLog.routineId) {
      this._updateRoutineLastPerformed(newLog.routineId, updatedLogs);
    }
    // +++++++++++++++++++++++++

    console.log('Added workout log:', newLog.id);
    return newLog;
  }

  getWorkoutLogById(id: string): Observable<WorkoutLog | undefined> {
    return this.workoutLogs$.pipe(map(logs => logs.find(log => log.id === id)));
  }

  getWorkoutLogByRoutineId(routineId: string): Observable<WorkoutLog | undefined> {
    return this.workoutLogs$.pipe(map(logs => logs.find(log => log.routineId === routineId)));
  }

  /**
  * Retrieves workout logs for a specific routine, sorted with the most recent first.
  * @param routineId The ID of the routine.
  * @param limit Optional. The maximum number of logs to return.
  * @returns An Observable emitting an array of workout logs.
  */
  getLogsForRoutine(routineId: string, limit?: number): Observable<WorkoutLog[]> {
    return this.workoutLogs$.pipe(
      map(logs => {
        // Filter logs for the specific routine
        const routineLogs = logs.filter(log => log.routineId === routineId);

        // Sort the filtered logs by start time in descending order (most recent first).
        // Using the `startTime` timestamp is more precise than the date string.
        routineLogs.sort((a, b) => b.startTime - a.startTime);

        if (limit) {
          return routineLogs.slice(0, limit);
        }

        return routineLogs;
      })
    );
  }

  getLogsForDate(date: string): Observable<WorkoutLog[] | undefined> {
    return this.workoutLogs$.pipe(map(logs => logs.filter(log => log.date === date)));
  }

  clearAllWorkoutLogs_DEV_ONLY(): Promise<void> {
    const title = this.translate.instant('trackingService.clearLogsConfirm.title');
    const message = this.translate.instant('trackingService.clearLogsConfirm.message');

    return this.alertService.showConfirm(title, message)
      .then(async (result) => {
        if (result && result.data) {
          this.saveWorkoutLogsToStorage([]);
          await this.recalculateAllPersonalBests();
          const successMessage = this.translate.instant('trackingService.clearLogsConfirm.success');
          await this.alertService.showAlert(title, successMessage);
        }
      });
  }

  getLastPerformanceForExercise(exerciseId: string): Observable<LastPerformanceSummary | null> {
    return this.workoutLogs$.pipe(
      map(logs => {
        for (const log of logs) {
          const performedExercise = log.workoutExercises.find(ex => ex.exerciseId === exerciseId);
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
          sets: routineLog.workoutExercises.flatMap(ex => ex.sets),
          startTime: routineLog.startTime,
          endTime: routineLog.endTime,
          durationMinutes: routineLog.durationMinutes,
        };
      })
    );
  }


  findPreviousSetPerformance(lastPerformance: LastPerformanceSummary | null, currentSetTarget: ExerciseTargetSetParams, currentSetIndexInRoutine: number): LoggedSet | null {
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

    log.workoutExercises.forEach(loggedEx => {
      if (!currentPBs[loggedEx.exerciseId]) {
        currentPBs[loggedEx.exerciseId] = [];
      }
      const exercisePBsList: PersonalBestSet[] = currentPBs[loggedEx.exerciseId];
      //const workoutLogId = loggedEx.workoutLogId || log.id;

      loggedEx.sets.forEach(setFromLog => {
        // Ensure set has all necessary context for PB processing
        const candidateSet: LoggedSet = {
          ...setFromLog,
          timestamp: setFromLog.timestamp || new Date(log.startTime).toISOString(),
          workoutLogId: setFromLog.workoutLogId || log.id,
          exerciseId: setFromLog.exerciseId || loggedEx.exerciseId,
        };

        // Check for non-weight based PBs
        if (candidateSet.repsLogged && (candidateSet.weightLogged === undefined || candidateSet.weightLogged === null || getWeightValue(candidateSet.weightLogged) === 0)) {
          this.updateSpecificPB(exercisePBsList, candidateSet, `Max Reps (Bodyweight)`);
        }
        if (candidateSet.durationLogged && getDurationValue(candidateSet.durationLogged) > 0) {
          this.updateSpecificPB(exercisePBsList, candidateSet, `Max Duration`);
        }
        if (candidateSet.distanceLogged && getDistanceValue(candidateSet.distanceLogged) > 0) {
          this.updateSpecificPB(exercisePBsList, candidateSet, `Max Distance`);
        }

        // Check for weight-based PBs (these are not mutually exclusive with the ones above)
        if (candidateSet.weightLogged !== undefined && candidateSet.weightLogged !== null && getWeightValue(candidateSet.weightLogged) > 0) {
          if (repsTypeToReps(candidateSet.repsLogged) === 1) this.updateSpecificPB(exercisePBsList, candidateSet, `1RM (Actual)`);
          if (repsTypeToReps(candidateSet.repsLogged) === 3) this.updateSpecificPB(exercisePBsList, candidateSet, `3RM (Actual)`);
          if (repsTypeToReps(candidateSet.repsLogged) === 5) this.updateSpecificPB(exercisePBsList, candidateSet, `5RM (Actual)`);
          this.updateSpecificPB(exercisePBsList, candidateSet, `Heaviest Lifted`);
          if (candidateSet.repsLogged && repsTypeToReps(candidateSet.repsLogged) > 1) {
            const e1RM = getWeightValue(candidateSet.weightLogged) * (1 + repsTypeToReps(candidateSet.repsLogged) / 30);
            const e1RMSet: LoggedSet = { ...candidateSet, repsLogged: genRepsTypeFromRepsNumber(1), weightLogged: weightToExact(parseFloat(e1RM.toFixed(2))) };
            this.updateSpecificPB(exercisePBsList, e1RMSet, `1RM (Estimated)`);
          }
        }
      });
      // Sort for this exercise (mainly for internal consistency, display sorts separately)
      currentPBs[loggedEx.exerciseId] = exercisePBsList.sort((a, b) => (getWeightValue(b.weightLogged) ?? 0) - (getWeightValue(a.weightLogged) ?? 0));
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
        if (candidateSet.repsLogged && existingPb.repsLogged && candidateSet.repsLogged > existingPb.repsLogged) isBetter = true;
        else if (candidateSet.repsLogged === existingPb.repsLogged && (candidateSet.weightLogged ?? -1) > (existingPb.weightLogged ?? -1)) isBetter = true;
      } else if (pbType.includes('Max Duration')) {
        if ((candidateSet.durationLogged ?? 0) > (existingPb.durationLogged ?? 0)) isBetter = true;
      } else if (pbType.includes('Max Distance')) {
        if ((candidateSet.distanceLogged ?? 0) > (existingPb.distanceLogged ?? 0)) isBetter = true;
      } else { // Weight-based (XRM, Heaviest Lifted)
        if ((candidateSet.weightLogged ?? -1) > (existingPb.weightLogged ?? -1)) {
          isBetter = true;
        }
        if ((candidateSet.weightLogged ?? -1) >= (existingPb.weightLogged ?? -1) && (candidateSet.repsLogged ?? -1) > (existingPb.repsLogged ?? -1)) {
          isBetter = true;
        }
      }

      if (isBetter) {
        shouldUpdateOrAdd = true;
        oldPbToDemote = { ...existingPb }; // Capture the state of the PB being replaced for history
        // Prepare history for the new PB: new history item + old PB's history
        const historyInstance: PBHistoryInstance = {
          weightLogged: getWeightValue(oldPbToDemote.weightLogged),
          repsLogged: repsTypeToReps(oldPbToDemote.repsLogged),
          durationLogged: getDurationValue(oldPbToDemote.durationLogged),
          distanceLogged: getDistanceValue(oldPbToDemote.distanceLogged),
          timestamp: oldPbToDemote.timestamp,
          workoutLogId: oldPbToDemote.workoutLogId,
          pbType: oldPbToDemote.pbType, // <-- THE CRUCIAL FIX
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

  public async recalculateAllPersonalBests(noPrompt: boolean = false): Promise<void> {
    if (!noPrompt) {
      const title = this.translate.instant('trackingService.recalcPbs.title');
      const message = this.translate.instant('trackingService.recalcPbs.message');
      await this.alertService.showAlert(title, message);
    }
    this.savePBsToStorage({});

    const allLogs = this.workoutLogsSubject.getValue();
    // Sort logs by date, OLDEST FIRST, to build history correctly
    const sortedLogs = [...allLogs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (!sortedLogs || sortedLogs.length === 0) {
      const noLogsTitle = this.translate.instant('trackingService.recalcPbs.noLogsTitle');
      const noLogsMessage = this.translate.instant('trackingService.recalcPbs.noLogsMessage');
      this.alertService.showAlert(noLogsTitle, noLogsMessage);
      return Promise.resolve();
    }

    const newPBsMaster: Record<string, PersonalBestSet[]> = {};

    sortedLogs.forEach(log => {
      // Each set within a log needs to be processed.
      // The timestamp for a set should ideally be from the log's start time, or if sets have individual timestamps, use those.
      const logTimestamp = new Date(log.startTime).toISOString(); // Consistent timestamp for all sets in this log iteration

      log.workoutExercises.forEach(loggedEx => {
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

          // Check for non-weight based PBs
          if (candidateSet.repsLogged && (candidateSet.weightLogged === undefined || candidateSet.weightLogged === null || getWeightValue(candidateSet.weightLogged) === 0)) {
            this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Max Reps (Bodyweight)`);
          }
          if (candidateSet.durationLogged && getDurationValue(candidateSet.durationLogged) > 0) {
            this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Max Duration`);
          }
          if (candidateSet.distanceLogged && getDistanceValue(candidateSet.distanceLogged) > 0) {
            this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Max Distance`);
          }

          // Check for weight-based PBs
          if (candidateSet.weightLogged !== undefined && candidateSet.weightLogged !== null && getWeightValue(candidateSet.weightLogged) > 0) {
            if (repsTypeToReps(candidateSet.repsLogged) === 1) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `1RM (Actual)`);
            if (repsTypeToReps(candidateSet.repsLogged) === 3) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `3RM (Actual)`);
            if (repsTypeToReps(candidateSet.repsLogged) === 5) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `5RM (Actual)`);
            this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Heaviest Lifted`);
            if (candidateSet.repsLogged && repsTypeToReps(candidateSet.repsLogged) > 1) {
              const e1RM = getWeightValue(candidateSet.weightLogged) * (1 + repsTypeToReps(candidateSet.repsLogged) / 30);
              const e1RMSet: LoggedSet = { ...candidateSet, repsLogged: genRepsTypeFromRepsNumber(1), weightLogged: weightToExact(parseFloat(e1RM.toFixed(2))) };
              this.updateSpecificPB(exercisePBsListForRecalc, e1RMSet, `1RM (Estimated)`);
            }
          }
        });
        // newPBsMaster[loggedEx.exerciseId] is already updated by reference via exercisePBsListForRecalc
      });
    });

    // After processing all logs, sort PBs within each exercise (optional, as display component sorts)
    for (const exId in newPBsMaster) {
      if (newPBsMaster.hasOwnProperty(exId)) {
        newPBsMaster[exId].sort((a, b) => (getWeightValue(b.weightLogged) ?? 0) - (getWeightValue(a.weightLogged) ?? 0));
      }
    }

    this.savePBsToStorage(newPBsMaster);
    console.log('Personal Bests recalculated from all logs:', newPBsMaster);
    if (!noPrompt) {
      const successTitle = this.translate.instant('trackingService.recalcPbs.successTitle');
      const successMessage = this.translate.instant('trackingService.recalcPbs.successMessage');
      this.alertService.showAlert(successTitle, successMessage);
    }
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
          .filter(log => log.workoutExercises.some(ex => ex.exerciseId === exerciseId))
          .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

        relevantLogs.forEach(log => {
          let maxWeightThisSession: number | undefined = undefined;
          let repsAtMaxWeight: number | undefined = undefined;
          log.workoutExercises.forEach(loggedEx => {
            if (loggedEx.exerciseId === exerciseId) {
              loggedEx.sets.forEach(set => {
                if (set.weightLogged !== undefined && set.weightLogged !== null) {
                  if (maxWeightThisSession === undefined || getWeightValue(set.weightLogged) > maxWeightThisSession) {
                    maxWeightThisSession = getWeightValue(set.weightLogged);
                    repsAtMaxWeight = repsTypeToReps(set.repsLogged);
                  } else if (getWeightValue(set.weightLogged) === maxWeightThisSession) {
                    if (repsAtMaxWeight === undefined || (set.repsLogged && repsTypeToReps(set.repsLogged) > repsAtMaxWeight)) {
                      repsAtMaxWeight = repsTypeToReps(set.repsLogged);
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

  public getDataForBackup(): WorkoutLog[] { return this.workoutLogsSubject.getValue(); }
  public getPBsForBackup(): Record<string, PersonalBestSet[]> { return this.personalBestsSubject.getValue(); }

  private parseLoggedValue(val: any): number | null {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? null : parsed;
    }
    if (val && typeof val === 'object' && 'type' in val) {
      // Handle current TargetType objects
      switch (val.type) {
        case 'exact':
          if ('value' in val) return val.value;
          if ('seconds' in val) return val.seconds; // For duration/rest
          break;
        case 'range':
          if ('min' in val) return val.min; // Use min for ranges
          if ('minSeconds' in val) return val.minSeconds; // For duration/rest ranges
          break;
        case 'bodyweight':
          return 0; // Bodyweight implies 0 weight
        case 'to_failure':
        case 'amrap':
        case 'max':
          return null; // No specific numeric value
        default:
          break;
      }
    }
    return null;
  }

  /**
    * Merges imported workout logs with the current data.
    * - If an imported log has an ID that already exists, it will be updated.
    * - If an imported log has a new ID, it will be added.
    * - Logs that exist locally but are not in the imported data will be preserved.
    * After merging, it triggers a full recalculation of personal bests.
    *
    * @param newLogs The array of WorkoutLog objects to merge.
    */
  public async replaceLogs(newLogs: any[]): Promise<void> { // Accept 'any' to handle legacy formats
    // 1. Basic validation
    if (!Array.isArray(newLogs)) {
      const errorTitle = this.translate.instant('trackingService.import.logsErrorTitle');
      const errorMessage = this.translate.instant('trackingService.import.logsErrorMessage');
      this.toastService.error(errorMessage, 0, errorTitle);
      return;
    }

    // 2. Get current state
    const currentLogs = this.workoutLogsSubject.getValue();

    // 3. Create a map of current logs for efficient lookup and update
    const logMap = new Map<string, WorkoutLog>(
      currentLogs.map(log => [log.id, log])
    );

    let updatedCount = 0;
    let addedCount = 0;

    // 4. Iterate over the imported logs and merge them into the map
    newLogs.forEach((importedLog: WorkoutLog) => {
      if (!importedLog.id || !importedLog.date) {
        console.warn('Skipping invalid log during import:', importedLog);
        return;
      }

      // Map legacy log formats and ensure workoutLogId is set ---
      if (importedLog.workoutExercises && Array.isArray(importedLog.workoutExercises)) {
        // 1. Map legacy properties like 'reps' to 'targetReps' on sets
        importedLog.workoutExercises = mapLegacyLoggedExercisesToCurrent(importedLog.workoutExercises as LoggedWorkoutExercise[]);

        // 2. Ensure each set has the workoutLogId from its parent log
        importedLog.workoutExercises.forEach(ex => {
          if (ex.sets && Array.isArray(ex.sets)) {
            ex.sets.forEach(set => {
              if (!set.workoutLogId) {
                set.workoutLogId = importedLog.id;
              }
              // Migrate targets (e.g., targetReps from number to RepsTarget)
              migrateSetRepsToRepsTarget(set);
              migrateSetWeightToWeightTarget(set);
              migrateSetDurationToDurationTarget(set);
              migrateSetDistanceToDistanceTarget(set);
              migrateSetRestToRestTarget(set);

              // Convert legacy logged values (numbers/strings) to TargetType objects (separate from targets)
              const repsVal = this.parseLoggedValue(set.repsLogged);
              if (repsVal !== null && repsVal > 0) {
                set.repsLogged = genRepsTypeFromRepsNumber(repsVal);
              }

              const weightVal = this.parseLoggedValue(set.weightLogged);
              if (weightVal !== null) {
                if (weightVal > 0) {
                  set.weightLogged = weightToExact(weightVal);
                } else if (weightVal === 0) {
                  set.weightLogged = weightToBodyweight();
                } else {
                  // Invalid negative value, remove from fieldOrder
                  if (set.fieldOrder && set.fieldOrder.includes(METRIC.weight)) {
                    set.fieldOrder = set.fieldOrder.filter(f => f !== METRIC.weight);
                  }
                }
              } else if (set.weightLogged === undefined || set.weightLogged === null) {
                // Ensure fieldOrder is cleaned if no logged value
                if (set.fieldOrder && set.fieldOrder.includes(METRIC.weight)) {
                  set.fieldOrder = set.fieldOrder.filter(f => f !== METRIC.weight);
                }
              }

              const durationVal = this.parseLoggedValue(set.durationLogged);
              if (durationVal !== null && durationVal > 0) {
                set.durationLogged = durationToExact(durationVal);
              }

              const distanceVal = this.parseLoggedValue(set.distanceLogged);
              if (distanceVal !== null && distanceVal > 0) {
                set.distanceLogged = distanceToExact(distanceVal);
              }

              const restVal = this.parseLoggedValue(set.restLogged);
              if (restVal !== null && restVal > 0) {
                set.restLogged = restToExact(restVal);
              }

              // Tempo is already a string, no conversion needed
              if (typeof set.tempoLogged !== 'string') {
                set.tempoLogged = undefined; // Or handle as needed
              }

              if (!set.workoutLogId) {
                set.workoutLogId = importedLog.id;
              }
            });
          }
        });
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
    const successTitle = this.translate.instant('trackingService.import.logsSuccessTitle');
    const successMessage = this.translate.instant('trackingService.import.logsSuccessMessage', { updatedCount, addedCount });
    this.toastService.success(successMessage, 6000, successTitle);

    // --- NEW: Trigger the backfill for lastUsedAt timestamps ---
    await this.backfillLastUsedExerciseTimestamps();
    // -----------------------------------------------------------

    // 8. Recalculate all PBs from the newly merged history
    // We do this without a confirmation prompt as it's a necessary step after import.
    console.log('Recalculating personal bests after log import...');
    const recalcTitle = this.translate.instant('trackingService.recalcAfterImport.title');
    const recalcMessage = this.translate.instant('trackingService.recalcAfterImport.message');
    this.toastService.info(recalcMessage, 2000, recalcTitle);

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
      log.workoutExercises.forEach(loggedEx => {
        if (!newPBsMaster[loggedEx.exerciseId]) {
          newPBsMaster[loggedEx.exerciseId] = [];
        }
        const exercisePBsListForRecalc: PersonalBestSet[] = newPBsMaster[loggedEx.exerciseId];
        loggedEx.sets.forEach(originalSet => {
          const candidateSet: LoggedSet = { ...originalSet, timestamp: originalSet.timestamp || logTimestamp, workoutLogId: originalSet.workoutLogId || log.id, exerciseId: originalSet.exerciseId || loggedEx.exerciseId, };
          if (candidateSet.weightLogged === undefined || candidateSet.weightLogged === null || getWeightValue(candidateSet.weightLogged) === 0) {
            if (candidateSet.repsLogged) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Max Reps (Bodyweight)`);
            if (candidateSet.durationLogged && getDurationValue(candidateSet.durationLogged) > 0) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Max Duration`);
            return;
          }
          if (repsTypeToReps(candidateSet.repsLogged) === 1) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `1RM (Actual)`);
          if (repsTypeToReps(candidateSet.repsLogged) === 3) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `3RM (Actual)`);
          if (repsTypeToReps(candidateSet.repsLogged) === 5) this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `5RM (Actual)`);
          this.updateSpecificPB(exercisePBsListForRecalc, candidateSet, `Heaviest Lifted`);
          if (candidateSet.repsLogged && repsTypeToReps(candidateSet.repsLogged) > 1) {
            const e1RM = getWeightValue(candidateSet.weightLogged) * (1 + repsTypeToReps(candidateSet.repsLogged) / 30);
            const e1RMSet: LoggedSet = { ...candidateSet, repsLogged: genRepsTypeFromRepsNumber(1), weightLogged: weightToExact(parseFloat(e1RM.toFixed(2))) };
            this.updateSpecificPB(exercisePBsListForRecalc, e1RMSet, `1RM (Estimated)`);
          }
        });
      });
    });

    this.savePBsToStorage(newPBsMaster);
    console.log('Personal Bests recalculated from all merged logs.');
    const finalTitle = this.translate.instant('trackingService.recalcAfterImport.successTitle');
    const finalMessage = this.translate.instant('trackingService.recalcAfterImport.successMessage');
    this.toastService.success(finalMessage, 3000, finalTitle);
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
      const newExercises = updatedLog.workoutExercises.map(ex => ({
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
      // After updating the log and saving, if it's tied to a routine,
      // re-check and update the routine's lastPerformed date.
      if (fullyUpdatedLog.routineId) {
        this._updateRoutineLastPerformed(fullyUpdatedLog.routineId, newLogsArray);
      }
      // +++++++++++++++++++++++++

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
      const originalExerciseCount = log.workoutExercises.length;
      const exercisesToKeep = log.workoutExercises.filter(loggedEx => loggedEx.exerciseId !== deletedExerciseId);
      if (exercisesToKeep.length < originalExerciseCount) {
        logsModified = true;
        if (exercisesToKeep.length === 0) {
          console.log(`Workout log ${log.id} will be deleted as it becomes empty`);
          return null;
        }
        return { ...log, workoutExercises: exercisesToKeep };
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

  async deleteWorkoutLog(logId: string, noPrompt: boolean = false): Promise<void> {
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

    await this.recalculateAllPersonalBests(noPrompt);

    // =================== START OF CORRECTION ===================
    // After deleting a log and recalculating PBs, we must also
    // resync the last used timestamps to ensure consistency.
    console.log(`Syncing exercise timestamps after log deletion...`);
    await this.backfillLastUsedExerciseTimestamps(noPrompt);
    // =================== END OF CORRECTION ===================
  }

  /**
   * Retrieves all workout logs associated with a specific program ID and within a given date range.
   * @param programId The ID of the program to filter logs by.
   * @param startDate The start date (inclusive) as a Date object.
   * @param endDate The end date (inclusive) as a Date object.
   * @returns An Observable emitting an array of WorkoutLog objects that match the criteria.
   */
  getWorkoutLogsByProgramIdForDateRange(
    programId: string | null | undefined,
    startDate: Date,
    endDate: Date
  ): Observable<WorkoutLog[]> {
    // 1. Guard clause: Return an empty observable immediately if inputs are invalid.
    if (!programId || !startDate || !endDate) {
      return of([]);
    }

    // 2. Get the specific program as an observable, and ensure it completes after one emission.
    const program$ = this.trainingProgramService.getProgramById(programId).pipe(
      take(1) // Important: We only need the program info once.
    );

    // 3. Return the stream.
    return combineLatest([
      this.workoutLogs$, // Assuming workoutLogs$ provides the current array of all logs
      program$
    ]).pipe(
      map(([allLogs, program]) => {
        // 4. Handle the case where the program might not be found.
        if (!program) {
          return [];
        }

        // 5. Filter the logs. The result of this filter is implicitly returned by the map operator.
        return allLogs.filter(log => {
          const logDate = parseISO(log.date);

          // 6. The boolean expression is now correctly returned by the filter's callback.
          return log.programId === programId &&
            logDate >= startDate &&
            logDate <= endDate &&
            log.iterationId === program.iterationId; // Use the iterationId from the fetched program
        });
      }),
      take(1) // Optional but recommended: Ensures the entire observable completes after producing one filtered array.
    );
  }

  getWorkoutLogByProgrmIdAndRoutineId(programId: string, routineId: string): Observable<WorkoutLog[]> {
    if (!programId || !routineId) return of([]);
    return this.workoutLogs$.pipe(
      map(allLogs =>
        allLogs.filter(log => {
          const logDate = parseISO(log.date);
          return (log.programId === programId && log.routineId === routineId);
        })
      )
    );
  }

  getWorkoutLogsByProgramId(programId: string): Observable<WorkoutLog[]> {
    if (!programId) return of([]);
    return this.workoutLogs$.pipe(
      map(allLogs =>
        allLogs.filter(log => {
          return (log.programId === programId);
        })
      )
    );
  }

  getWorkoutLogByProgrmIdAndRoutineIdAndIterationId(programId: string, routineId: string, iterationId: string): Observable<WorkoutLog[]> {
    if (!programId || !routineId) return of([]);
    return this.workoutLogs$.pipe(
      map(allLogs =>
        allLogs.filter(log => {
          const logDate = parseISO(log.date);
          return (log.programId === programId && log.routineId === routineId && log.iterationId === iterationId);
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
  public async backfillLastUsedExerciseTimestamps(noPrompt: boolean = false): Promise<void> {
    console.log('Starting backfill of lastUsedAt timestamps for all exercises...');
    if (!noPrompt) {
      this.toastService.info('Updating exercise history...', 2000, "Please Wait");
    }

    const allLogs = this.workoutLogsSubject.getValue();
    if (!allLogs || allLogs.length === 0) {
      console.log('No logs found. Aborting backfill.');
      return;
    }

    // The logs are already sorted newest first, which is perfect.
    // We will iterate and the first time we see an exercise ID, that's its most recent use.
    const lastUsedMap = new Map<string, { lastUsedTimestamp: string, lastUsedLogId: string }>(); // Map<exerciseId, lastUsedTimestamp>

    for (const log of allLogs) {
      for (const loggedEx of log.workoutExercises) {
        // If we haven't already found a newer log for this exercise, record this one.
        if (!lastUsedMap.has(loggedEx.exerciseId)) {
          lastUsedMap.set(loggedEx.exerciseId, { lastUsedTimestamp: log.date, lastUsedLogId: log.id });
        }
      }
    }

    // Now, tell the ExerciseService to perform the batch update
    await this.exerciseService.batchUpdateLastUsedTimestamps(lastUsedMap);

    console.log(`Backfill complete. Updated timestamps for ${lastUsedMap.size} exercises.`);
    if (!noPrompt) {
      this.toastService.success(this.translate.instant('trackingService.history.backfillSuccessMessage'), 3000, this.translate.instant('trackingService.history.backfillSuccessTitle'));
    }
  }


  /**
   * Returns an Observable Map that tracks the logged status of each scheduled day for a given program.
   * The key of the map is the `scheduledDayId`, and the value is a boolean (true if logged).
   * This is designed to be used safely in templates with the async pipe.
   *
   * @param programId The ID of the training program to check.
   * @returns An Observable<Map<string, boolean>> that emits whenever the logged status changes.
   */
  getScheduledDaysLoggedStatus(programId: string): Observable<Map<string, boolean>> {
    const program$ = this.trainingProgramService.getProgramById(programId);
    const allLogs$ = this.workoutLogs$;

    return combineLatest([program$, allLogs$]).pipe(
      map(([program, allLogs]) => {
        const loggedStatusMap = new Map<string, boolean>();

        if (!program) {
          return loggedStatusMap;
        }

        // Create a highly efficient lookup Set of logged scheduledDayId's for this specific program.
        const loggedDayIds = new Set(
          allLogs
            .filter(log => log.programId === program.id && log.scheduledDayId)
            .map(log => log.scheduledDayId)
        );

        const allScheduledDays = program.programType === 'linear'
          ? program.weeks?.flatMap(w => w.schedule) ?? []
          : program.schedule;

        allScheduledDays.forEach(day => {
          // For each scheduled day, check if its unique ID is in our lookup Set.
          loggedStatusMap.set(day.id, loggedDayIds.has(day.id));
        });

        return loggedStatusMap;
      }),
      // Only emit a new map if its contents have actually changed.
      distinctUntilChanged((prev, curr) => {
        if (prev.size !== curr.size) return false;
        for (const [key, value] of prev) {
          if (curr.get(key) !== value) return false;
        }
        return true;
      }),
      shareReplay(1)
    );
  }

  /**
* Generates a new iteration ID (e.g., '#2') for a given program.
* It does this by finding the highest existing iteration ID among all logs
* for that program and incrementing it. If no logs exist, it starts with '#1'.
* @param programId The ID of the program to generate an iteration for.
* @returns An Observable that emits the new iteration ID string.
*/
  generateIterationId(programId: string): Observable<string> {
    // If there's no programId, we can't look anything up. Return '#1' by default.
    if (!programId) {
      return of('#1');
    }

    const programLogs$ = this.getWorkoutLogsByProgramId(programId);

    return programLogs$.pipe(
      map(logs => {
        // If there are no logs for this program, the first iteration is #1.
        if (!logs || logs.length === 0) {
          return '#1';
        }

        // Use reduce to find the highest iteration number in the array of logs.
        const maxIteration = logs.reduce((currentMax, log) => {
          // We only care about logs that have a valid iterationId string.
          if (log.iterationId && typeof log.iterationId === 'string' && log.iterationId.startsWith('#')) {

            // Parse the number from the string (e.g., '#3' -> 3).
            // Use substring(1) to strip the '#' character.
            const iterationNum = parseInt(log.iterationId.substring(1), 10);

            // If parsing was successful and this log's iteration is higher than our current max,
            // it becomes the new max.
            if (!isNaN(iterationNum) && iterationNum > currentMax) {
              return iterationNum;
            }
          }

          // Otherwise, the max remains unchanged for this iteration.
          return currentMax;
        }, 0); // The initial value for 'currentMax' is 0.

        // The new iteration is the highest one we found, plus one.
        const nextIterationNum = maxIteration + 1;

        // Format the result as a string and return it.
        return `#${nextIterationNum}`;
      })
    );
  }

  /**
   * Updates the perceived effort rating for a specific workout log.
   * @param logId The ID of the workout log to update.
   * @param perceivedWorkoutInfo The user's perceived effort rating (e.g., 1-10).
   * @returns An observable that completes when the update is successful.
   */
  updatePerceivedWorkoutInfo(logId: string, perceivedWorkoutInfo: PerceivedWorkoutInfo): Observable<void> {
    // --- This section handles updating your local state stream ---
    const currentLogs = this.workoutLogsSubject.getValue();
    const logIndex = currentLogs.findIndex(log => log.id === logId);

    if (logIndex > -1) {
      // Create a new object for the updated log to maintain immutability
      const updatedLog: WorkoutLog = {
        ...currentLogs[logIndex],
        perceivedWorkoutInfo: perceivedWorkoutInfo,
      };

      // Create a new array with the updated log
      const updatedLogs = [
        ...currentLogs.slice(0, logIndex),
        updatedLog,
        ...currentLogs.slice(logIndex + 1)
      ];

      // Push the new array into the subject
      this.workoutLogsSubject.next(updatedLogs);
    }

    // --- This section would handle your backend persistence ---
    // Example: return this.http.patch(`/api/logs/${logId}`, { perceivedEffort: effort });
    // For now, we'll return a simulated success observable.
    console.log(`Updating log ${logId} with perceived effort: ${perceivedWorkoutInfo}. (Backend call would go here)`);
    return of(undefined).pipe(delay(200)); // Simulate async backend call
  }

  /**
   * Finds the most recent log for a given routine and updates the routine's
   * `lastPerformed` timestamp. This ensures the timestamp always reflects the
   * true latest performance, even when back-dating logs.
   * @param routineId The ID of the routine to update.
   * @param allLogs The complete, current list of all workout logs.
   */
  private _updateRoutineLastPerformed(routineId: string, allLogs: WorkoutLog[]): Promise<Routine | undefined> { // Return type changed
    const logsForRoutine = allLogs.filter(log => log.routineId === routineId);

    const routineToUpdate = this.workoutService.getRoutineByIdSync(routineId);
    if (!routineToUpdate) {
      return Promise.resolve(undefined);
    }

    if (logsForRoutine.length === 0) {
      // If no logs, ensure lastPerformed is null/undefined
      if (routineToUpdate.lastPerformed) {
        routineToUpdate.lastPerformed = undefined;
        return this.workoutService.updateRoutine(routineToUpdate, true);
      }
      return Promise.resolve(routineToUpdate);
    }

    const mostRecentLog = logsForRoutine.reduce((latest, current) => {
      return current.startTime > latest.startTime ? current : latest;
    });

    // Only update if the date is different
    if (routineToUpdate.lastPerformed !== mostRecentLog.date) {
      routineToUpdate.lastPerformed = mostRecentLog.date;
      return this.workoutService.updateRoutine(routineToUpdate, true);
    }

    return Promise.resolve(routineToUpdate);
  }

  /**
   * --- NEW PUBLIC METHOD ---
   * Performs a full history sync, backfilling `lastUsedAt` for all exercises
   * and ensuring `lastPerformed` is correct for all routines based on the log history.
   * This is an intensive operation designed to correct any data inconsistencies.
   */
  public async syncAllHistory(): Promise<void> {
    console.log('Starting full history sync for exercises and routines...');
    this.toastService.info('Syncing all history...', 2000, "Please Wait");

    const allLogs = this.workoutLogsSubject.getValue();
    if (!allLogs || allLogs.length === 0) {
      console.log('No logs found. Aborting history sync.');
      this.toastService.info('No history to sync.');
      return;
    }

    // --- Part 1: Backfill Exercise Timestamps ---
    const lastUsedMap = new Map<string, { lastUsedTimestamp: string, lastUsedLogId: string }>();
    for (const log of allLogs) {
      for (const loggedEx of log.workoutExercises) {
        if (!lastUsedMap.has(loggedEx.exerciseId)) {
          lastUsedMap.set(loggedEx.exerciseId, { lastUsedTimestamp: log.date, lastUsedLogId: log.id });
        }
      }
    }
    await this.exerciseService.batchUpdateLastUsedTimestamps(lastUsedMap);
    console.log(`Exercise sync complete. Updated timestamps for ${lastUsedMap.size} exercises.`);

    // --- Part 2: Backfill Routine Timestamps ---
    const allRoutines = this.workoutService.getCurrentRoutines();
    // Use Promise.all to wait for all routine updates to complete.
    await Promise.all(allRoutines.map(routine => {
      // The _updateRoutineLastPerformed is an async-like operation because it calls updateRoutine
      return this._updateRoutineLastPerformed(routine.id, allLogs);
    }));
    console.log(`Routine sync complete. Verified 'lastPerformed' date for ${allRoutines.length} routines.`);

    // +++ THE FINAL FIX IS HERE +++
    // After all routines have been updated, tell the WorkoutService to
    // re-sort its list and notify all subscribers of the change.
    this.workoutService.refreshRoutinesSort();
    // ++++++++++++++++++++++++++++++

    this.toastService.success('Full history has been synced!', 3000, "Sync Complete");
  }

  /**
   * --- NEW METHOD ---
   * Returns an observable map of exercise usage counts.
   * The key is the exercise ID, and the value is the number of workout logs
   * in which the exercise appears at least once.
   * @returns An Observable<Map<string, number>> that emits whenever the logs change.
   */
  public getExerciseUsageCounts(): Observable<Map<string, number>> {
    return this.workoutLogs$.pipe(
      map(logs => {
        const usageMap = new Map<string, number>();
        if (!logs) return usageMap;

        for (const log of logs) {
          // Use a Set to count each exercise only once per workout log,
          // preventing multiple sets of the same exercise from inflating the count.
          const exercisesInThisLog = new Set<string>();
          for (const loggedEx of log.workoutExercises) {
            exercisesInThisLog.add(loggedEx.exerciseId);
          }

          // Increment the count for each unique exercise found in the log.
          for (const exerciseId of exercisesInThisLog) {
            const currentCount = usageMap.get(exerciseId) || 0;
            usageMap.set(exerciseId, currentCount + 1);
          }
        }
        return usageMap;
      }),
      shareReplay(1) // Cache the last emitted map for new subscribers
    );
  }

  /**
  * Retrieves all workout logs that contain a specific exercise, sorted most recent first.
  * @param exerciseId The ID of the exercise to search for.
  * @returns An Observable emitting an array of workout logs.
  */
  getLogsForExercise(exerciseId: string): Observable<WorkoutLog[]> {
    return this.workoutLogs$.pipe(
      map(logs => {
        // Filter logs to find any that include the specified exerciseId
        const exerciseLogs = logs.filter(log =>
          log.workoutExercises.some(ex => ex.exerciseId === exerciseId)
        );

        // The main workoutLogs$ is already sorted, but we can ensure it here just in case.
        exerciseLogs.sort((a, b) => b.startTime - a.startTime);

        return exerciseLogs;
      })
    );
  }

  public getAllWorkoutLogs(): WorkoutLog[] {
    return this.workoutLogsSubject.getValue();
  }

  public getWorkoutLocations(): string[] {
    const locations = this.getAllWorkoutLogs()
      .map(workoutLog => (workoutLog.locationName || '').trim())
      .filter(location => location !== '')
      .map(location => {
        // Lowercase, then titlecase each word
        return location
          .toLowerCase()
          .replace(/\b\w/g, char => char.toUpperCase());
      });
    return Array.from(new Set(locations));
  }


  /**
   * Generates and saves 50 random WorkoutLog entries for development/testing.
   * Each log will have random exercises, sets, and plausible values.
   */
  public generateAndSaveRandomWorkoutLogs(): void {
    const randomId = () => uuidv4();
    const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const randomFloat = (min: number, max: number, decimals = 2) =>
      parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
    const randomDate = (start: Date, end: Date) =>
      new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

    // Get all exercises from ExerciseService (async)
    if (!this.exerciseService.getExercises) {
      this.toastService.error('No exercises found. Please add some exercises first.', 3000, 'Random Log Generation');
      return;
    }

    this.exerciseService.getExercises().subscribe((allExercises) => {
      if (!allExercises || allExercises.length === 0) {
        this.toastService.error('No exercises found. Please add some exercises first.', 3000, 'Random Log Generation');
        return;
      }

      const logs: WorkoutLog[] = [];
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()); // 3 months ago

      for (let i = 0; i < 50; i++) {
        const logId = randomId();
        const logDate = randomDate(startDate, today);
        const startTime = logDate.getTime();
        const endTime = startTime + randomInt(30, 120) * 60 * 1000; // 30-120 min workout

        // Pick 2-5 random exercises for this log
        const numExercises = randomInt(2, Math.min(5, allExercises.length));
        const shuffledExercises = [...allExercises].sort(() => 0.5 - Math.random());
        const chosenExercises = shuffledExercises.slice(0, numExercises);

        const exercises = chosenExercises.map(ex => {
          const numSets = randomInt(2, 5);
          const sets = Array.from({ length: numSets }).map(() => {
            const reps = randomInt(5, 15);
            const weight = randomFloat(20, 100);
            return {
              id: randomId(),
              workoutLogId: logId,
              exerciseId: ex.id,
              repsLogged: genRepsTypeFromRepsNumber(reps),
              weightLogged: weightToExact(weight),
              timestamp: new Date(startTime + randomInt(0, 60 * 60 * 1000)).toISOString(),
              fieldOrder: [METRIC.reps, METRIC.weight],
            };
          });
          return {
            exerciseId: ex.id,
            workoutLogId: logId,
            sets,
          };
        });

        logs.push({
          id: logId,
          date: logDate.toISOString().split('T')[0],
          startTime,
          endTime,
          durationMinutes: Math.round((endTime - startTime) / (1000 * 60)),
          durationSeconds: Math.round((endTime - startTime) / 1000),
          workoutExercises: exercises,
          locationName: ['Home', 'Gym', 'Park'][randomInt(0, 2)],
        } as WorkoutLog);
      }

      this.saveWorkoutLogsToStorage([...logs, ...this.getAllWorkoutLogs()]);
      this.toastService.success('50 random workout logs generated and saved.', 3000, 'Random Logs');
    });
  }

  /**
   * Returns the number of workout sessions logged for a given routine.
   * @param routineId The ID of the routine (string or number).
   * @returns The count of workout logs associated with the routine.
   */
  public getNumberOfSessionsLoggedForRoutine(routineId: string | number): number {
    if (!routineId || routineId === '-1') return 1; // Always at least 1, even if no routineId is provided
    const logs = this.getAllWorkoutLogs();
    const count = logs.filter(log => log.routineId === routineId).length;
    return count > 0 ? count : 1; // Ensure at least 1 is returned
  }

}