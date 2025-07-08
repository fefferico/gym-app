// src/app/core/services/training-program.service.ts
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest, firstValueFrom, of } from 'rxjs';
import { map, shareReplay, switchMap, take, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { StorageService } from './storage.service';
import { TrainingProgram, ScheduledRoutineDay } from '../models/training-program.model';
import { Routine } from '../models/workout.model';
import { WorkoutService } from './workout.service';
import { AlertService } from './alert.service';
import { ToastService } from './toast.service';
import { isSameDay, getDay, eachDayOfInterval, parseISO } from 'date-fns'; // For date comparisons and getting day of week

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

  private isLoadingProgramsSubject = new BehaviorSubject<boolean>(true);
  public isLoadingPrograms$: Observable<boolean> = this.isLoadingProgramsSubject.asObservable();

  constructor() {
    this.isLoadingProgramsSubject.next(true);

    // +++ 1. Load initial programs from storage
    const programsFromStorage = this._loadProgramsFromStorage();

    // +++ 2. Initialize the BehaviorSubject and public observable
    this.programsSubject = new BehaviorSubject<TrainingProgram[]>(programsFromStorage);
    this.programs$ = this.programsSubject.asObservable().pipe(
      shareReplay(1) // +++ Add shareReplay for efficiency
    );

    // +++ 3. Seed new data if necessary. This will save and update the subject.
    this._seedAndMergeProgramsFromStaticData(programsFromStorage);
  }

  private _loadProgramsFromStorage(): TrainingProgram[] {
    const programs = this.storageService.getItem<TrainingProgram[]>(this.PROGRAMS_STORAGE_KEY);
    return programs ? programs : [];
  }

  private _saveProgramsToStorage(programs: TrainingProgram[]): void {
    this.storageService.setItem(this.PROGRAMS_STORAGE_KEY, programs);
    this.programsSubject.next([...programs]); // Emit a new array reference
  }

  // +++ NEW METHOD: The core merge/seed logic
  /**
   * Merges programs from the static PROGRAMS_DATA constant with existing programs from storage.
   * This ensures default programs are available without overwriting user data.
   * @param existingPrograms Programs already loaded from storage.
   */
  private _seedAndMergeProgramsFromStaticData(existingPrograms: TrainingProgram[]): void {
    try {
      const assetPrograms: TrainingProgram[] = [];
      const existingProgramIds = new Set(existingPrograms.map(p => p.id));

      const newProgramsToSeed = assetPrograms.filter(
        (assetProgram: TrainingProgram) => !existingProgramIds.has(assetProgram.id)
      );

      if (newProgramsToSeed.length > 0) {
        console.log(`Seeding ${newProgramsToSeed.length} new training programs from static data.`);
        const mergedPrograms = [...existingPrograms, ...newProgramsToSeed];
        this._saveProgramsToStorage(mergedPrograms);
      } else {
        console.log("No new training programs to seed. All default programs are present in storage.");
      }
    } catch (error) {
      console.error('Failed to process or seed training programs from static data:', error);
    } finally {
      // +++ Ensure loading is always set to false
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
      // if (programToSave.isActive) {
      //   programsArray = programsArray.map(p =>
      //     p.id === programToSave.id ? p : { ...p, isActive: false }
      //   );
      // }
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

  /**
   * Toggles the active status of a single program without affecting others.
   * This allows for multiple programs to be active simultaneously.
   * @param programId The ID of the program to activate or deactivate.
   */
  async toggleProgramActivation(programId: string): Promise<void> {
    const currentPrograms = this.programsSubject.getValue();
    const targetProgram = currentPrograms.find(p => p.id === programId);

    if (!targetProgram) {
      this.toastService.error("Program not found to update", 0, "Update Error");
      return;
    }

    // Map through the programs and toggle the 'isActive' property for the target program.
    const updatedPrograms = currentPrograms.map(p => {
      if (p.id === programId) {
        // Return a new object for the target program with the isActive status flipped.
        return { ...p, isActive: !p.isActive };
      }
      // Return all other programs unchanged.
      return p;
    });

    this._saveProgramsToStorage(updatedPrograms);

    // Provide a more descriptive toast message based on the action performed.
    // We check the original state of the program before it was toggled.
    if (!targetProgram.isActive) {
      this.toastService.success(`Program "${targetProgram.name}" is now active.`, 3000, "Program Activated");
    } else {
      this.toastService.info(`Program "${targetProgram.name}" has been deactivated.`, 3000, "Program Deactivated");
    }
  }

  async deactivateAllPrograms(): Promise<void> {
    const currentPrograms = this.programsSubject.getValue();
    if (currentPrograms.length > 0) {
      const updatedPrograms = currentPrograms.map(p => ({ ...p, isActive: false }));
      this._saveProgramsToStorage(updatedPrograms);
    }
  }

  async deactivateProgram(programId: string): Promise<void> {
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

    const updatedPrograms = currentPrograms.map(p =>
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

  /** Returns the current list of programs for backup */
  public getDataForBackup(): TrainingProgram[] {
    return this.programsSubject.getValue(); // Get current value from BehaviorSubject
  }

  /**
     * Merges imported program data with the current data.
     * - If an imported program has an ID that already exists, it will be updated.
     * - If an imported program has a new ID, it will be added.
     * - Programs that exist locally but are not in the imported data will be preserved.
     *
     * @param newPrograms The array of TrainingProgram objects to merge.
     */
  public mergeData(newPrograms: TrainingProgram[]): void {
    // 1. Basic validation
    if (!Array.isArray(newPrograms)) {
      console.error('TrainingProgramService: Imported data for programs is not an array.');
      this.toastService.error('Import failed: Invalid program data file.', 0, "Import Error"); // Added user feedback
      return;
    }

    // +++ START of new merge logic +++

    // 2. Get current state
    const currentPrograms = this.programsSubject.getValue();

    // 3. Create a map of current programs for efficient lookup and update
    const programMap = new Map<string, TrainingProgram>(
      currentPrograms.map(p => [p.id, p])
    );

    let updatedCount = 0;
    let addedCount = 0;

    // 4. Iterate over the imported programs and merge them into the map
    newPrograms.forEach(importedProgram => {
      if (!importedProgram.id || !importedProgram.name) {
        // Skip invalid entries in the import file
        console.warn('Skipping invalid program during import:', importedProgram);
        return;
      }

      if (programMap.has(importedProgram.id)) {
        updatedCount++;
      } else {
        addedCount++;
      }
      // Whether it's new or an update, set it in the map.
      programMap.set(importedProgram.id, importedProgram);
    });

    // 5. Convert the map back to an array
    const mergedPrograms = Array.from(programMap.values());

    // 6. Save the new merged array
    this._saveProgramsToStorage(mergedPrograms);

    // 7. Provide user feedback
    console.log(`TrainingProgramService: Merged imported data. Updated: ${updatedCount}, Added: ${addedCount}.`);
    this.toastService.success(
      `Import complete. ${updatedCount} programs updated, ${addedCount} added.`,
      6000,
      "Programs Merged"
    );
    // +++ END of new merge logic +++
  }


  /**
   * Finds the scheduled routine and its details for a specific program on a given date.
   * This is a synchronous helper method that works on a single, provided program object.
   *
   * @param targetDate The date to check the schedule for.
   * @param program The TrainingProgram object to check against.
   * @returns An object containing the Routine and ScheduledRoutineDay if a workout is scheduled, otherwise null.
   */
  public findRoutineForDayInProgram(targetDate: Date, program: TrainingProgram): { routine: Routine, scheduledDayInfo: ScheduledRoutineDay } | null {
    if (!program || !program.schedule || program.schedule.length === 0) {
      return null;
    }

    let scheduledDayInfo: ScheduledRoutineDay | undefined;

    // Check if the program uses a custom n-day cycle
    if (program.cycleLength && program.cycleLength > 0 && program.startDate) {
      const startDate = parseISO(program.startDate); // Use date-fns for reliable parsing

      // Ensure the target date is on or after the program's start date
      if (targetDate < startDate) {
        return null;
      }

      // Calculate the difference in days from the start date
      const diffTime = Math.abs(targetDate.getTime() - startDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Determine the current day within the cycle (1-indexed)
      const currentCycleDayNumber = (diffDays % program.cycleLength) + 1;

      // Find the schedule entry that matches the calculated cycle day
      scheduledDayInfo = program.schedule.find(s => s.dayOfWeek === currentCycleDayNumber);

    } else {
      // Logic for a standard weekly cycle
      const dayOfWeekForTargetDate = getDay(targetDate); // date-fns: 0 for Sunday, 1 for Monday, etc.

      // Find the schedule entry that matches the day of the week
      scheduledDayInfo = program.schedule.find(s => s.dayOfWeek === dayOfWeekForTargetDate);
    }

    // If a schedule entry was found, retrieve the full routine details from the WorkoutService
    if (scheduledDayInfo) {
      // This assumes workoutService can synchronously provide the routine map or has a similar helper.
      // If getRoutineById is async, this whole method must be async.
      // Let's assume you have a synchronous way to get routine details, like from a map.
      const routine = this.workoutService.getRoutineByIdSync(scheduledDayInfo.routineId); // You would need to create getRoutineByIdSync

      if (routine) {
        return { routine, scheduledDayInfo };
      }
    }

    // Return null if no scheduled day was found or the routine couldn't be retrieved
    return null;
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
          dayMatchLogic = (s: ScheduledRoutineDay) => s.dayOfWeek === Number(currentCycleDayNumber); // Assuming dayOfWeek stores cycle day number here
        } else {
          // Standard weekly cycle logic (0 for Sunday, 1 for Monday, etc.)
          const dayOfWeekForTargetDate = getDay(targetDate); // date-fns getDay: 0 for Sun, 1 for Mon...
          // console.log(`Target date: ${targetDate.toDateString()}, Day of week: ${dayOfWeekForTargetDate}`);
          dayMatchLogic = (s: ScheduledRoutineDay) => s.dayOfWeek === Number(dayOfWeekForTargetDate);
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

  /**
   * Gets all scheduled routine occurrences for a given program within a specific date range.
   * This method correctly calculates recurring weekly or cyclical schedules.
   *
   * @param programId The ID of the training program.
   * @param rangeStart The start of the date range.
   * @param rangeEnd The end of the date range.
   * @returns An observable emitting an array of scheduled entries, with the `date` property
   *          set to the actual occurrence date within the range.
   */
  getScheduledRoutinesForDateRangeByProgramId(programId: string, rangeStart: Date, rangeEnd: Date): Observable<{ date: Date; scheduledDayInfo: ScheduledRoutineDay }[]> {
    return this.getProgramById(programId).pipe(
      map(program => {
        if (!program || !program.schedule || program.schedule.length === 0) {
          return []; // No program or no schedule, return empty
        }

        const allDaysInRange = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
        const allOccurrences: { date: Date; scheduledDayInfo: ScheduledRoutineDay }[] = [];

        // Determine the cycle length: a custom number or 7 for a standard week.
        const cycleLength = program.cycleLength && program.cycleLength > 0 ? program.cycleLength : 7;
        const programStartDate = program.startDate ? parseISO(program.startDate) : new Date(1970, 0, 1); // A very early date if not set

        // Create a map for quick lookup of what's scheduled on a given cycle day.
        const scheduleMap = new Map<number, ScheduledRoutineDay[]>();
        program.schedule.forEach(day => {
          const dayIndex = day.dayOfWeek % cycleLength; // 0 for Sunday/Day 1, 1 for Monday/Day 2, etc.
          if (!scheduleMap.has(dayIndex)) {
            scheduleMap.set(dayIndex, []);
          }
          scheduleMap.get(dayIndex)!.push(day);
        });

        // Iterate through every single day in the requested calendar range.
        allDaysInRange.forEach(currentDate => {
          // Ignore days before the program's official start date.
          if (currentDate < programStartDate) {
            return;
          }

          // For weekly cycles (cycleLength is 7)
          if (cycleLength === 7) {
            const dayOfWeek = getDay(currentDate); // 0 for Sunday, 1 for Monday, etc.
            if (scheduleMap.has(dayOfWeek)) {
              scheduleMap.get(dayOfWeek)!.forEach(scheduledDayInfo => {
                allOccurrences.push({ date: currentDate, scheduledDayInfo });
              });
            }
          }
          // For custom-length cycles (e.g., 4-day cycle)
          else {
            const daysSinceStart = Math.floor((currentDate.getTime() - programStartDate.getTime()) / (1000 * 60 * 60 * 24));
            const currentCycleDay = daysSinceStart % cycleLength;
            if (scheduleMap.has(currentCycleDay)) {
              scheduleMap.get(currentCycleDay)!.forEach(scheduledDayInfo => {
                allOccurrences.push({ date: currentDate, scheduledDayInfo });
              });
            }
          }
        });

        return allOccurrences;
      })
    );
  }
}