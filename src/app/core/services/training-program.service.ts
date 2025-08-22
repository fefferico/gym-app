// src/app/core/services/training-program.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, firstValueFrom, of } from 'rxjs';
import { map, shareReplay, switchMap, take, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { StorageService } from './storage.service';
import { TrainingProgram, ScheduledRoutineDay, TrainingProgramHistoryEntry, ProgramDayInfo } from '../models/training-program.model';
import { Routine } from '../models/workout.model';
import { WorkoutService } from './workout.service';
import { AlertService } from './alert.service';
import { ToastService } from './toast.service';
import { isSameDay, getDay, eachDayOfInterval, parseISO, differenceInDays, startOfDay, format } from 'date-fns';

// +++ 1. IMPORT THE STATIC PROGRAMS DATA +++
import { PROGRAMS_DATA } from './programs-data';
import { TrackingService } from './tracking.service';
import { WorkoutLog } from '../models/workout-log.model';

@Injectable({
  providedIn: 'root'
})
export class TrainingProgramService {
  private storageService = inject(StorageService);
  private workoutService = inject(WorkoutService);
  private alertService = inject(AlertService);
  private toastService = inject(ToastService);
  private trackingService = inject(TrackingService);

  private readonly PROGRAMS_STORAGE_KEY = 'fitTrackPro_trainingPrograms';

  private programsSubject = new BehaviorSubject<TrainingProgram[]>(this._loadProgramsFromStorage());
  public programs$: Observable<TrainingProgram[]> = this.programsSubject.asObservable();

  private isLoadingProgramsSubject = new BehaviorSubject<boolean>(true);
  public isLoadingPrograms$: Observable<boolean> = this.isLoadingProgramsSubject.asObservable();

  constructor() {
    this.isLoadingProgramsSubject.next(true);

    const programsFromStorage = this._loadProgramsFromStorage();

    this.programsSubject = new BehaviorSubject<TrainingProgram[]>(programsFromStorage);
    this.programs$ = this.programsSubject.asObservable().pipe(
      shareReplay(1)
    );

    this._seedAndMergeProgramsFromStaticData(programsFromStorage);
  }

  private _loadProgramsFromStorage(): TrainingProgram[] {
    const programs = this.storageService.getItem<TrainingProgram[]>(this.PROGRAMS_STORAGE_KEY);
    return programs ? programs : [];
  }

  private _saveProgramsToStorage(programs: TrainingProgram[]): void {
    this.storageService.setItem(this.PROGRAMS_STORAGE_KEY, programs);
    this.programsSubject.next([...programs]);
  }

  /**
   * Merges programs from the static PROGRAMS_DATA constant with existing programs from storage.
   * This ensures default programs are available without overwriting user data.
   * @param existingPrograms Programs already loaded from storage.
   */
  private _seedAndMergeProgramsFromStaticData(existingPrograms: TrainingProgram[]): void {
    try {
      // +++ 2. USE THE IMPORTED DATA AS THE SOURCE OF TRUTH FOR SEEDING +++
      const assetPrograms: TrainingProgram[] = PROGRAMS_DATA.map(program => ({
        ...program,
        programType: !program.programType || program.programType === 'cycled' ? 'cycled' : 'linear'
      }));
      const existingProgramIds = new Set(existingPrograms.map(p => p.id));

      const newProgramsToSeed = assetPrograms.filter(
        (assetProgram: TrainingProgram) => !existingProgramIds.has(assetProgram.id)
      );

      if (newProgramsToSeed.length > 0) {
        console.log(`Seeding ${newProgramsToSeed.length} new training programs from static data`);
        const mergedPrograms = [...existingPrograms, ...newProgramsToSeed];
        this._saveProgramsToStorage(mergedPrograms);
      } else {
        console.log("No new training programs to seed. All default programs are present in storage");
      }
    } catch (error) {
      console.error('Failed to process or seed training programs from static data:', error);
    } finally {
      this.isLoadingProgramsSubject.next(false);
    }
  }

  getAllPrograms(): Observable<TrainingProgram[]> {
    return this.programs$;
  }

  getProgramsByRoutineId(routineId: string | null | undefined): Observable<TrainingProgram[]> {
    if (!routineId) return of([]);
    return this.programs$.pipe(map(allPrograms => allPrograms.filter(program => program.schedule.some(schedule => schedule.routineId === routineId))));
  }

  getProgramById(id: string): Observable<TrainingProgram | undefined> {
    return this.programs$.pipe(
      map(programs => {
        const program = programs.find(p => p.id === id);
        if (program && Array.isArray(program.history)) {
          // Sort history by most recent (descending by date)
          const sortedHistory = [...program.history].sort((a, b) => {
            return (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0);
          });
          return { ...program, history: sortedHistory };
        }
        return program;
      })
    );
  }

  async addProgram(programData: Omit<TrainingProgram, 'id' | 'isActive' | 'schedule'> & { schedule: Omit<ScheduledRoutineDay, 'id'>[] }): Promise<TrainingProgram> {
    const currentPrograms = this.programsSubject.getValue();
    const newProgram: TrainingProgram = {
      ...programData,
      id: uuidv4(),
      isActive: false,
      schedule: programData.schedule.map(s => ({ ...s, id: uuidv4() })),
    };
    const updatedPrograms = [...currentPrograms, newProgram];
    this._saveProgramsToStorage(updatedPrograms);
    this.toastService.success(`Program "${newProgram.name}" created.`, 3000, "Program Created");
    return newProgram;
  }

  async updateProgram(updatedProgramData: TrainingProgram): Promise<TrainingProgram | undefined> {
    const currentPrograms = this.programsSubject.getValue();
    const index = currentPrograms.findIndex(p => p.id === updatedProgramData.id);

    if (index > -1) {
      const scheduleWithIds = updatedProgramData.schedule.map(s => ({
        ...s,
        id: s.id || uuidv4()
      }));
      const programToSave: TrainingProgram = { ...updatedProgramData, schedule: scheduleWithIds };

      let programsArray = [...currentPrograms];
      programsArray[index] = programToSave;

      this._saveProgramsToStorage(programsArray);
      this.toastService.success(`Program "${programToSave.name}" updated.`, 3000, "Program Updated");
      return programToSave;
    }
    this.toastService.error(`Program with ID ${updatedProgramData.id} not found.`, 0, "Update Error");
    return undefined;
  }

  async deleteProgram(programId: string): Promise<void> {
    const programToDelete = await firstValueFrom(this.getProgramById(programId).pipe(take(1)));
    if (!programToDelete) {
      this.toastService.error("Program not found", 0, "Delete Error");
      return;
    }

    const confirm = await this.alertService.showConfirmationDialog(
      'Delete Program',
      `Are you sure you want to delete the program "${programToDelete.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', role: 'cancel', data: false, cssClass: 'bg-gray-400 hover:bg-gray-600', icon: 'cancel' },
        { text: 'Delete Program', role: 'confirm', data: true, cssClass: 'bg-primary hover:bg-primary-dark', icon: 'done' }
      ]
    );

    if (confirm && confirm.data) {
      const currentPrograms = this.programsSubject.getValue();
      const updatedPrograms = currentPrograms.filter(p => p.id !== programId);
      this._saveProgramsToStorage(updatedPrograms);
      this.toastService.info(`Program "${programToDelete.name}" deleted.`, 3000, "Program Deleted");
    }
  }

  async toggleProgramActivation(programId: string, status: 'active' | 'completed' | 'archived' | 'cancelled' = 'completed'): Promise<void> {
    const currentPrograms = this.programsSubject.getValue();
    const targetProgram = currentPrograms.find(p => p.id === programId);

    if (!targetProgram) {
      this.toastService.error("Program not found to update", 0, "Update Error");
      return;
    }

    const newDate = new Date().toISOString();
    this.updateProgramHistory(programId, status, newDate);
    const updatedPrograms = this.programsSubject.getValue().map(p => {
      if (p.id === programId) {
        return { ...p, isActive: !p.isActive, startDate: status === 'active' ? newDate : p.startDate, endDate: (status === 'completed' || status === 'cancelled') ? newDate : '-' };
      }
      return p;
    });

    this._saveProgramsToStorage(updatedPrograms);

    if (!targetProgram.isActive) {
      this.toastService.success(`Program "${targetProgram.name}" is now active.`, 3000, "Program Activated");
    } else {
      let statusMessage = '';
      switch (status) {
        case 'completed':
          statusMessage = `Program "${targetProgram.name}" marked as completed.`;
          break;
        case 'archived':
          statusMessage = `Program "${targetProgram.name}" archived.`;
          break;
        case 'cancelled':
          statusMessage = `Program "${targetProgram.name}" cancelled.`;
          break;
        default:
          statusMessage = `Program "${targetProgram.name}" deactivated.`;
          break;
      }
      this.toastService.info(statusMessage, 3000, "Program Status Updated");
    }
  }

  async deactivateAllPrograms(): Promise<void> {
    const currentPrograms = this.programsSubject.getValue();
    if (currentPrograms.length > 0) {
      const updatedPrograms = currentPrograms.map(p => ({ ...p, isActive: false }));
      this._saveProgramsToStorage(updatedPrograms);
    }
  }

  async deactivateProgram(programId: string, status: 'active' | 'completed' | 'archived' | 'cancelled' = 'completed'): Promise<void> {
    const currentPrograms = this.programsSubject.getValue();
    const targetProgram = currentPrograms.find(p => p.id === programId);

    if (!targetProgram) {
      this.toastService.error("Program not found to deactivate", 0, "Deactivation Error");
      return;
    }

    if (!targetProgram.isActive) {
      this.toastService.info(`Program "${targetProgram.name}" is already inactive.`, 3000, "Already Inactive");
      return;
    }

    this.updateProgramHistory(programId, status);
    const updatedPrograms = this.programsSubject.getValue().map(p =>
      p.id === programId ? { ...p, isActive: false } : p
    );
    this._saveProgramsToStorage(updatedPrograms);
    this.toastService.info(`Program "${targetProgram.name}" has been deactivated.`, 3000, "Program Deactivated");
  }

  getActiveProgram(): Observable<TrainingProgram | undefined> {
    return this.programs$.pipe(
      map(programs => programs.find(p => p.isActive))
    );
  }

  getActivePrograms(): Observable<TrainingProgram[] | undefined> {
    return this.programs$.pipe(
      map(programs => programs.filter(p => p.isActive))
    );
  }

  public getDataForBackup(): TrainingProgram[] {
    return this.programsSubject.getValue();
  }

  public mergeData(newPrograms: TrainingProgram[]): void {
    if (!Array.isArray(newPrograms)) {
      console.error('TrainingProgramService: Imported data for programs is not an array.');
      this.toastService.error('Import failed: Invalid program data file.', 0, "Import Error");
      return;
    }

    const currentPrograms = this.programsSubject.getValue();
    const programMap = new Map<string, TrainingProgram>(
      currentPrograms.map(p => [p.id, p])
    );

    let updatedCount = 0;
    let addedCount = 0;

    newPrograms.forEach(importedProgram => {
      if (!importedProgram.id || !importedProgram.name) {
        console.warn('Skipping invalid program during import:', importedProgram);
        return;
      }

      if (programMap.has(importedProgram.id)) {
        updatedCount++;
      } else {
        addedCount++;
      }
      programMap.set(importedProgram.id, importedProgram);
    });

    const mergedPrograms = Array.from(programMap.values());
    this._saveProgramsToStorage(mergedPrograms);

    console.log(`TrainingProgramService: Merged imported data. Updated: ${updatedCount}, Added: ${addedCount}`);
    this.toastService.success(
      `Import complete. ${updatedCount} programs updated, ${addedCount} added.`,
      6000,
      "Programs Merged"
    );
  }

  public findRoutineForDayInProgram(targetDate: Date, program: TrainingProgram): { routine: Routine, scheduledDayInfo: ScheduledRoutineDay } | null {
    // +++ FIX: The guard clause must check for BOTH linear and cycled schedule data.
    if (!program || !program.startDate ||
      (program.programType === 'linear' && (!program.weeks || program.weeks.length === 0)) ||
      (program.programType !== 'linear' && (!program.schedule || program.schedule.length === 0))
    ) {
      return null; // The program is not schedulable.
    }

    const programStartDate = parseISO(program.startDate);
    const normalizedTargetDate = startOfDay(targetDate);

    // Universal check: The target date cannot be before the program's start date.
    if (normalizedTargetDate < startOfDay(programStartDate)) {
      return null;
    }

    let scheduledDayInfo: ScheduledRoutineDay | undefined;

    // +++ FIX: Main logic split based on program type. +++
    if (program.programType === 'linear') {
      // --- LOGIC FOR LINEAR PROGRAMS ---
      const daysSinceStart = differenceInDays(normalizedTargetDate, startOfDay(programStartDate));
      const currentWeekIndex = Math.floor(daysSinceStart / 7);
      const targetWeek = program.weeks?.[currentWeekIndex]; // Safety check with optional chaining

      if (targetWeek) {
        const dayOfWeek = getDay(targetDate); // Sunday: 0, Monday: 1...
        scheduledDayInfo = targetWeek.schedule.find(s => s.dayOfWeek === dayOfWeek);
      }
    } else {
      // --- LOGIC FOR CYCLED PROGRAMS (the previously corrected logic) ---
      const cycleLength = program.cycleLength ?? 7;

      if (cycleLength === 7) {
        // Standard weekly cycle (day is 0-6)
        const dayOfWeekForTargetDate = getDay(targetDate);
        scheduledDayInfo = program.schedule.find(s => s.dayOfWeek === dayOfWeekForTargetDate);
      } else {
        // N-day cycle (day is 1-N)
        const daysSinceStart = differenceInDays(normalizedTargetDate, startOfDay(programStartDate));
        const currentCycleDayNumber = (daysSinceStart % cycleLength) + 1;
        scheduledDayInfo = program.schedule.find(s => s.dayOfWeek === currentCycleDayNumber);
      }
    }

    // Common return logic: If we found a scheduled day, find its corresponding routine.
    if (scheduledDayInfo) {
      const routine = this.workoutService.getRoutineByIdSync(scheduledDayInfo.routineId);
      if (routine) {
        return { routine, scheduledDayInfo };
      }
    }

    return null; // No scheduled routine found for this day.
  }

  getRoutineForDay(targetDate: Date): Observable<{ routine: Routine, scheduledDayInfo: ScheduledRoutineDay } | null> {
    return this.getActiveProgram().pipe(
      switchMap(activeProgram => {
        if (!activeProgram) {
          return of(null);
        }

        let dayMatchLogic: (day: ScheduledRoutineDay) => boolean;

        if (activeProgram.cycleLength && activeProgram.cycleLength > 0 && activeProgram.startDate) {
          const startDate = new Date(activeProgram.startDate);
          const diffTime = Math.abs(targetDate.getTime() - startDate.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          const currentCycleDayNumber = (diffDays % activeProgram.cycleLength) + 1;
          dayMatchLogic = (s: ScheduledRoutineDay) => s.dayOfWeek === Number(currentCycleDayNumber);
        } else {
          const dayOfWeekForTargetDate = getDay(targetDate);
          dayMatchLogic = (s: ScheduledRoutineDay) => s.dayOfWeek === Number(dayOfWeekForTargetDate);
        }

        const scheduledDayInfo = activeProgram.schedule.find(dayMatchLogic);

        if (!scheduledDayInfo) {
          return of(null);
        }

        return this.workoutService.getRoutineById(scheduledDayInfo.routineId).pipe(
          map(routine => {
            if (routine) {
              return { routine, scheduledDayInfo };
            }
            console.warn(`Routine with ID ${scheduledDayInfo.routineId} not found for scheduled day`);
            return null;
          })
        );
      })
    );
  }

  getScheduledRoutinesForDateRange(
    viewStartDate: Date,
    viewEndDate: Date
  ): Observable<{ date: Date; routine: Routine; scheduledDayInfo: ScheduledRoutineDay }[]> {
    return this.getActiveProgram().pipe(
      switchMap(activeProgram => {
        if (!activeProgram || !activeProgram.schedule || activeProgram.schedule.length === 0) {
          return of([]);
        }

        const scheduledEntries: Observable<{ date: Date; routine: Routine; scheduledDayInfo: ScheduledRoutineDay } | null>[] = [];
        let currentDate = new Date(viewStartDate);

        while (currentDate <= viewEndDate) {
          let dayMatchLogic: (day: ScheduledRoutineDay) => boolean;
          const currentTargetDate = new Date(currentDate);

          if (activeProgram.cycleLength && activeProgram.cycleLength > 0 && activeProgram.startDate) {
            const programStartDate = new Date(activeProgram.startDate);
            const diffTime = Math.abs(currentTargetDate.getTime() - programStartDate.getTime());
            const diffDays = currentTargetDate >= programStartDate ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : -1;

            if (diffDays >= 0) {
              const currentCycleDayNumber = (diffDays % activeProgram.cycleLength) + 1;
              dayMatchLogic = (s: ScheduledRoutineDay) => s.dayOfWeek === currentCycleDayNumber;
            } else {
              dayMatchLogic = () => false;
            }
          } else {
            const dayOfWeekForTargetDate = getDay(currentTargetDate);
            dayMatchLogic = (s: ScheduledRoutineDay) => s.dayOfWeek === dayOfWeekForTargetDate;
          }

          const scheduledDayInfo = activeProgram.schedule.find(dayMatchLogic);

          if (scheduledDayInfo) {
            scheduledEntries.push(
              this.workoutService.getRoutineById(scheduledDayInfo.routineId).pipe(
                map(routine => {
                  if (routine) {
                    return { date: currentTargetDate, routine, scheduledDayInfo };
                  }
                  return null;
                })
              )
            );
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }

        if (scheduledEntries.length === 0) {
          return of([]);
        }
        return combineLatest(scheduledEntries).pipe(
          map(results => results.filter(r => r !== null) as { date: Date; routine: Routine; scheduledDayInfo: ScheduledRoutineDay }[])
        );
      })
    );
  }

  getScheduledRoutinesForDateRangeByProgramId(programId: string, rangeStart: Date, rangeEnd: Date): Observable<{ date: Date; scheduledDayInfo: ScheduledRoutineDay }[]> {
    return this.getProgramById(programId).pipe(
      map(program => {
        if (!program || (!program.schedule?.length && !program.weeks?.length)) {
          return [];
        }

        const allDaysInRange = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
        const allOccurrences: { date: Date; scheduledDayInfo: ScheduledRoutineDay }[] = [];
        const programStartDate = program.startDate ? parseISO(program.startDate) : new Date(1970, 0, 1);

        // --- NEW: Handle 'linear' (week-by-week) programs ---
        if (program.programType === 'linear' && program.weeks?.length) {
          allDaysInRange.forEach(currentDate => {
            if (currentDate < programStartDate) return;

            const daysSinceStart = differenceInDays(currentDate, programStartDate);
            if (daysSinceStart < 0) return;

            const currentWeekIndex = Math.floor(daysSinceStart / 7);
            const targetWeek = program.weeks![currentWeekIndex];

            if (targetWeek) {
              const dayOfWeek = getDay(currentDate);
              const scheduledDay = targetWeek.schedule.find(s => s.dayOfWeek === dayOfWeek);
              if (scheduledDay) {
                allOccurrences.push({ date: currentDate, scheduledDayInfo: scheduledDay });
              }
            }
          });
        }
        // --- MODIFIED: Handle 'cycled' programs (existing logic) ---
        else if (program.programType === 'cycled' && program.schedule?.length) {
          const cycleLength = program.cycleLength && program.cycleLength > 0 ? program.cycleLength : 7;

          const scheduleMap = new Map<number, ScheduledRoutineDay>();
          program.schedule.forEach(day => {
            // For weekly cycles (cycleLength=7), key is day of week (0-6). For n-day, it's day number (1-n).
            const key = cycleLength === 7 ? day.dayOfWeek : day.dayOfWeek;
            scheduleMap.set(key, day);
          });

          allDaysInRange.forEach(currentDate => {
            if (currentDate < programStartDate) return;

            let scheduledDayInfo: ScheduledRoutineDay | undefined;

            if (cycleLength === 7) { // Standard weekly logic
              const dayOfWeek = getDay(currentDate);
              scheduledDayInfo = scheduleMap.get(dayOfWeek);
            } else { // N-day cycle logic
              const daysSinceStart = differenceInDays(currentDate, programStartDate);
              const currentCycleDayNumber = (daysSinceStart % cycleLength) + 1;
              scheduledDayInfo = scheduleMap.get(currentCycleDayNumber);
            }

            if (scheduledDayInfo) {
              allOccurrences.push({ date: currentDate, scheduledDayInfo });
            }
          });
        }

        return allOccurrences;
      })
    );
  }

  // date:  // ISO string YYYY-MM-DD
  async updateProgramHistory(
    programId: string,
    statusOrEntry: ('active' | 'completed' | 'archived' | 'cancelled') | TrainingProgramHistoryEntry,
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    const currentPrograms = this.programsSubject.getValue();
    const programIndex = currentPrograms.findIndex(p => p.id === programId);

    if (programIndex === -1) {
      this.toastService.error("Program not found to update history", 0, "Update Error");
      return;
    }

    const targetProgram = currentPrograms[programIndex];
    // Ensure history is a mutable array
    const history = Array.isArray(targetProgram.history) ? [...targetProgram.history] : [];
    let updatedProgram: TrainingProgram;

    // --- CASE 1: Updating a specific existing entry (from history modal) ---
    if (typeof statusOrEntry === 'object' && statusOrEntry.id) {
      const entryToUpdateIndex = history.findIndex(h => h.id === statusOrEntry.id);
      if (entryToUpdateIndex !== -1) {
        // Update the specific entry in the history array
        history[entryToUpdateIndex] = { ...history[entryToUpdateIndex], ...statusOrEntry };

        // After updating the history, we MUST re-evaluate and sync the root isActive flag.
        // A program is considered active if ANY of its history entries has the status 'active'.
        const isNowActive = history.some(h => h.status === 'active');

        updatedProgram = { ...targetProgram, history, isActive: isNowActive };

        this.toastService.success(`History entry updated.`, 3000, "History Updated");
      } else {
        this.toastService.error("History entry not found to update.", 0, "Update Error");
        return;
      }
    }
    // --- CASE 2: Logging a new status change (from toggleProgramActivation etc.) ---
    else if (typeof statusOrEntry === 'string') {
      const status = statusOrEntry;

      if (!targetProgram.startDate && status !== 'active') { // Starting date is needed unless we are activating
        this.toastService.error("Program does not have a 'starting date'", 0, "Finish Error");
        return;
      }

      const finishedDate = new Date().toISOString();
      const activeHistoryIndex = history.findIndex(entry => entry.status === 'active');

      if (activeHistoryIndex !== -1) {
        // An active entry exists, so we update it
        history[activeHistoryIndex] = {
          ...history[activeHistoryIndex],
          endDate: endDate ? endDate : status === 'active' ? '-' : finishedDate,
          status,
          date: new Date().toISOString()
        };
      } else {
        // No active entry, so we push a new history record
        history.push({
          endDate: endDate ? endDate : status === 'active' ? '-' : finishedDate,
          programId: targetProgram.id,
          id: uuidv4(),
          startDate: startDate ? startDate : targetProgram.startDate!, // Non-null assertion is safe due to check above
          date: new Date().toISOString(),
          status: status
        });
      }

      // CRITICAL: In this flow, we ONLY update the history. The calling function
      // (e.g., toggleProgramActivation) is responsible for setting the root `isActive` flag.
      // This prevents a recursive loop.
      updatedProgram = { ...targetProgram, history };
    } else {
      console.error("Invalid call to updateProgramHistory");
      return;
    }

    const updatedPrograms = [...currentPrograms];
    updatedPrograms[programIndex] = updatedProgram;
    this._saveProgramsToStorage(updatedPrograms);
  }


  async removeProgramHistoryEntry(programId: string, historyEntryId: string): Promise<void> {
    const currentPrograms = this.programsSubject.getValue();
    const targetProgram = currentPrograms.find(p => p.id === programId);

    if (!targetProgram) {
      this.toastService.error("Program not found", 0, "Remove History Error");
      return;
    }

    const updatedHistory = (targetProgram.history || []).filter(entry => entry.id !== historyEntryId);

    // If the removed entry was the latest or active, update isActive accordingly
    let isActive = targetProgram.isActive;
    if (targetProgram.history && targetProgram.history.length > 0) {
      const removedEntry = targetProgram.history.find(entry => entry.id === historyEntryId);
      if (removedEntry && removedEntry.status === 'active') {
        // If the removed entry was active, set isActive to false
        isActive = false;
      }
    }

    const updatedProgram = {
      ...targetProgram,
      history: updatedHistory,
      isActive: isActive,
    };

    const updatedPrograms = currentPrograms.map(p =>
      p.id === programId ? updatedProgram : p
    );

    this._saveProgramsToStorage(updatedPrograms);
    this.toastService.success("History entry removed.", 3000, "History Updated");
  }

  /**
  * Checks if a logged workout completes a linear training program.
  * If completed, it updates the program's status and history.
  * @param programId The ID of the program to check.
  * @param loggedWorkout The workout log that was just saved.
  * @returns A Promise resolving to `true` if the program was completed, otherwise `false`.
  */
  public async checkAndHandleProgramCompletion(programId: string, loggedWorkout: WorkoutLog): Promise<boolean> {
    const program = await firstValueFrom(this.getProgramById(programId));

    // Proceed only for active, linear programs with defined weeks
    if (!program || !program.isActive || program.programType !== 'linear' || !program.weeks?.length) {
      return false;
    }

    // --- Determine if this was the last workout of the program ---

    // 1. Find the final week (highest weekNumber)
    const lastWeek = program.weeks.reduce((prev, current) =>
      (prev.weekNumber > current.weekNumber) ? prev : current
    );

    // 2. Find the last scheduled day in that week (highest dayOfWeek)
    const lastScheduledDay = lastWeek.schedule.reduce((prev, current) =>
      (prev.dayOfWeek > current.dayOfWeek) ? prev : current
    );

    if (loggedWorkout.routineId !== lastScheduledDay.routineId) {
      // The logged routine was not the final one scheduled for the program.
      return false;
    }

    // 3. Verify that all other routines in the program have been completed.
    const allProgramRoutineIds = new Set(
      program.weeks.flatMap(w => w.schedule.map(s => s.routineId))
    );

    const programLogs = await firstValueFrom(
      this.trackingService.getWorkoutLogsByProgramIdForDateRange(
        program.id,
        parseISO(program.startDate!),
        new Date() // up to now
      )
    );

    const completedRoutineIds = new Set(programLogs.map(log => log.routineId));

    // Check if the set of completed routines contains all unique routines from the program schedule.
    const allRoutinesCompleted = [...allProgramRoutineIds].every(id => completedRoutineIds.has(id));

    if (allRoutinesCompleted) {
      console.log(`Program "${program.name}" completed!`);
      // Use existing method to mark the program as completed.
      // This will update its status, set the end date, and manage history.
      await this.toggleProgramActivation(program.id, 'completed');
      return true;
    }

    return false;
  }

  /**
  * Finds the corresponding week name for a given workout log if it's part of a linear program.
  * @param log The WorkoutLog to analyze.
  * @returns An Observable emitting the week name as a string, or null if not applicable.
  */
  public getWeekNameForLog(log: WorkoutLog): Observable<string | null> {
    // 1. Check for the essential prerequisite: a programId.
    if (!log.programId) {
      return of(null);
    }

    // 2. Fetch the program and perform the logic within an RxJS pipe.
    return this.getProgramById(log.programId).pipe(
      take(1), // We only need the current state of the program.
      map(program => {
        // 3. Validate the fetched program.
        if (
          !program ||
          program.programType !== 'linear' ||
          !program.startDate ||
          !program.weeks ||
          program.weeks.length === 0
        ) {
          return null; // Not a valid linear program log.
        }

        try {
          // 4. Calculate the week index.
          const logDate = startOfDay(parseISO(log.date));
          const programStartDate = startOfDay(parseISO(program.startDate));

          // Ensure the log date is not before the program started.
          if (logDate < programStartDate) {
            return null;
          }

          const daysSinceStart = differenceInDays(logDate, programStartDate);
          const weekIndex = Math.floor(daysSinceStart / 7);

          // 5. Retrieve the week name.
          const targetWeek = program.weeks[weekIndex];

          return targetWeek ? targetWeek.name : null; // Return name or null if index is out of bounds.

        } catch (error) {
          console.error("Error calculating week name for log:", log, error);
          return null;
        }
      })
    );
  }

  /**
  * Finds the corresponding day of the routine (e.g., "Wednesday" or "Day 3") for a given workout log.
  * @param log The WorkoutLog to analyze.
  * @returns An Observable emitting a ProgramDayInfo object, or null if not applicable.
  */
  public getDayOfWeekForLog(log: WorkoutLog): Observable<ProgramDayInfo | null> {
    if (!log.programId) {
      return of(null);
    }

    return this.getProgramById(log.programId).pipe(
      take(1),
      map(program => {
        if (!program || !program.startDate) {
          return null; // Not a valid program log.
        }

        try {
          const logDate = startOfDay(parseISO(log.date));
          const programStartDate = startOfDay(parseISO(program.startDate));

          if (logDate < programStartDate) {
            return null; // Log is from before the program started.
          }

          // --- Logic for Linear or Weekly Cycled Programs ---
          if (program.programType === 'linear' || (program.programType === 'cycled' && (program.cycleLength === 7 || !program.cycleLength))) {
            const dayNumber = getDay(logDate); // 0 = Sunday, 1 = Monday...
            const dayName = format(logDate, 'EEEE'); // e.g., "Wednesday"
            return { dayNumber, dayName };
          }

          // --- Logic for N-Day Cycled Programs ---
          if (program.programType === 'cycled' && program.cycleLength && program.cycleLength !== 7) {
            const daysSinceStart = differenceInDays(logDate, programStartDate);
            const dayNumber = (daysSinceStart % program.cycleLength) + 1; // Day 1 to N
            const dayName = `Day ${dayNumber}`;
            return { dayNumber, dayName };
          }

          return null; // Fallback if program type is unknown or invalid.

        } catch (error) {
          console.error("Error calculating day of week for log:", log, error);
          return null;
        }
      })
    );
  }

}