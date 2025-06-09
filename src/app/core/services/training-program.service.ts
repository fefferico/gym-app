// src/app/core/services/training-program.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, firstValueFrom, of } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { StorageService } from './storage.service';
import { TrainingProgram, ScheduledRoutineDay } from '../models/training-program.model';
import { Routine } from '../models/workout.model';
import { WorkoutService } from './workout.service';
import { AlertService } from './alert.service';
import { ToastService } from './toast.service';
import { isSameDay, getDay } from 'date-fns'; // For date comparisons and getting day of week

@Injectable({
  providedIn: 'root'
})
export class TrainingProgramService {
  private storageService = inject(StorageService);
  private workoutService = inject(WorkoutService);
  private alertService = inject(AlertService);
  private toastService = inject(ToastService);

  private readonly PROGRAMS_STORAGE_KEY = 'fitTrackPro_trainingPrograms';

  private programsSubject = new BehaviorSubject<TrainingProgram[]>(this._loadProgramsFromStorage());
  public programs$: Observable<TrainingProgram[]> = this.programsSubject.asObservable();

  constructor() {
    // console.log('TrainingProgramService initialized. Loaded programs:', this.programsSubject.getValue());
  }

  private _loadProgramsFromStorage(): TrainingProgram[] {
    const programs = this.storageService.getItem<TrainingProgram[]>(this.PROGRAMS_STORAGE_KEY);
    return programs ? programs : [];
  }

  private _saveProgramsToStorage(programs: TrainingProgram[]): void {
    this.storageService.setItem(this.PROGRAMS_STORAGE_KEY, programs);
    this.programsSubject.next([...programs]); // Emit a new array reference
  }

  getAllPrograms(): Observable<TrainingProgram[]> {
    return this.programs$;
  }

  getProgramById(id: string): Observable<TrainingProgram | undefined> {
    return this.programs$.pipe(
      map(programs => programs.find(p => p.id === id))
    );
  }

  async addProgram(programData: Omit<TrainingProgram, 'id' | 'isActive' | 'schedule'> & { schedule: Omit<ScheduledRoutineDay, 'id'>[] }): Promise<TrainingProgram> {
    const currentPrograms = this.programsSubject.getValue();
    const newProgram: TrainingProgram = {
      ...programData,
      id: uuidv4(),
      isActive: false, // New programs are not active by default
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
      // Ensure schedule day IDs are present or generated
      const scheduleWithIds = updatedProgramData.schedule.map(s => ({
        ...s,
        id: s.id || uuidv4() // Assign new ID if a schedule day is new and lacks one
      }));
      const programToSave: TrainingProgram = { ...updatedProgramData, schedule: scheduleWithIds };

      let programsArray = [...currentPrograms];
      programsArray[index] = programToSave;

      // If this program is being set to active, deactivate others
      if (programToSave.isActive) {
        programsArray = programsArray.map(p =>
          p.id === programToSave.id ? p : { ...p, isActive: false }
        );
      }
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
      this.toastService.error("Program not found.", 0, "Delete Error");
      return;
    }

    const confirm = await this.alertService.showConfirm(
      'Delete Program',
      `Are you sure you want to delete the program "${programToDelete.name}"? This action cannot be undone.`,
      'Delete'
    );

    if (confirm && confirm.data) {
      const currentPrograms = this.programsSubject.getValue();
      const updatedPrograms = currentPrograms.filter(p => p.id !== programId);
      this._saveProgramsToStorage(updatedPrograms);
      this.toastService.info(`Program "${programToDelete.name}" deleted.`, 3000, "Program Deleted");
    }
  }

  async setActiveProgram(programId: string): Promise<void> {
    const currentPrograms = this.programsSubject.getValue();
    const targetProgram = currentPrograms.find(p => p.id === programId);

    if (!targetProgram) {
      this.toastService.error("Program not found to activate.", 0, "Activation Error");
      return;
    }

    const updatedPrograms = currentPrograms.map(p => ({
      ...p,
      isActive: p.id === programId,
    }));
    this._saveProgramsToStorage(updatedPrograms);
    this.toastService.success(`Program "${targetProgram.name}" is now active.`, 3000, "Program Activated");
  }

  getActiveProgram(): Observable<TrainingProgram | undefined> {
    return this.programs$.pipe(
      map(programs => programs.find(p => p.isActive))
    );
  }

  /**
   * Gets the scheduled routine for a given date based on the active program.
   * @param targetDate The date for which to find the scheduled routine.
   * @returns An Observable emitting an object with the Routine and ScheduledRoutineDay, or null if none.
   */
  getRoutineForDay(targetDate: Date): Observable<{ routine: Routine, scheduledDayInfo: ScheduledRoutineDay } | null> {
    return this.getActiveProgram().pipe(
      switchMap(activeProgram => {
        if (!activeProgram) {
          // console.log('No active program found.');
          return of(null);
        }

        let dayMatchLogic: (day: ScheduledRoutineDay) => boolean;

        if (activeProgram.cycleLength && activeProgram.cycleLength > 0 && activeProgram.startDate) {
          // N-day cycle logic
          const startDate = new Date(activeProgram.startDate);
          const diffTime = Math.abs(targetDate.getTime() - startDate.getTime());
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          const currentCycleDayNumber = (diffDays % activeProgram.cycleLength) + 1; // 1-indexed cycle day
          // console.log(`Target date: ${targetDate.toDateString()}, Start date: ${startDate.toDateString()}, Diff days: ${diffDays}, Cycle day: ${currentCycleDayNumber}`);
          dayMatchLogic = (s: ScheduledRoutineDay) => s.dayOfWeek === currentCycleDayNumber; // Assuming dayOfWeek stores cycle day number here
        } else {
          // Standard weekly cycle logic (0 for Sunday, 1 for Monday, etc.)
          const dayOfWeekForTargetDate = getDay(targetDate); // date-fns getDay: 0 for Sun, 1 for Mon...
          // console.log(`Target date: ${targetDate.toDateString()}, Day of week: ${dayOfWeekForTargetDate}`);
          dayMatchLogic = (s: ScheduledRoutineDay) => s.dayOfWeek === dayOfWeekForTargetDate;
        }

        const scheduledDayInfo = activeProgram.schedule.find(dayMatchLogic);

        if (!scheduledDayInfo) {
          // console.log('No scheduled routine found for this day in the active program.');
          return of(null);
        }

        // console.log('Found scheduled day:', scheduledDayInfo);
        return this.workoutService.getRoutineById(scheduledDayInfo.routineId).pipe(
          map(routine => {
            if (routine) {
              // console.log('Routine details fetched:', routine.name);
              return { routine, scheduledDayInfo };
            }
            console.warn(`Routine with ID ${scheduledDayInfo.routineId} not found for scheduled day.`);
            return null;
          })
        );
      })
    );
  }

  /**
   * Retrieves all scheduled routine days for a given date range from the active program.
   * Useful for populating a calendar view.
   * @param startDate The start of the date range.
   * @param endDate The end of the date range.
   * @returns An Observable emitting an array of objects, each containing the date, routine, and scheduled day info.
   */
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
          const currentTargetDate = new Date(currentDate); // Important: Use a new Date object for each iteration

          if (activeProgram.cycleLength && activeProgram.cycleLength > 0 && activeProgram.startDate) {
            const programStartDate = new Date(activeProgram.startDate);
            const diffTime = Math.abs(currentTargetDate.getTime() - programStartDate.getTime());
            // Ensure we only consider dates on or after the program start date for cycle calculation
            const diffDays = currentTargetDate >= programStartDate ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : -1;

            if (diffDays >= 0) {
              const currentCycleDayNumber = (diffDays % activeProgram.cycleLength) + 1;
              dayMatchLogic = (s: ScheduledRoutineDay) => s.dayOfWeek === currentCycleDayNumber;
            } else {
              dayMatchLogic = () => false; // Date is before program start, no match for cycle
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
}