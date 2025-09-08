// workout-log-detail.ts
import { Component, HostListener, inject, Input, OnDestroy, OnInit, PLATFORM_ID, signal, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin, Observable, of, Subscription } from 'rxjs';
import { map, switchMap, tap, catchError, take } from 'rxjs/operators';
import { Exercise } from '../../../core/models/exercise.model';
// MODIFICATION: Import PersonalBestSet
import { LoggedWorkoutExercise, WorkoutLog, LoggedSet, PersonalBestSet } from '../../../core/models/workout-log.model';
import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ExerciseDetailComponent } from '../../exercise-library/exercise-detail';
import { Routine, WorkoutExercise } from '../../../core/models/workout.model';
import { UnitsService } from '../../../core/services/units.service';
import { IsWeightedPipe } from '../../../shared/pipes/is-weighted-pipe';
import { WorkoutService } from '../../../core/services/workout.service';
import { ActionMenuComponent } from '../../../shared/components/action-menu/action-menu';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { AlertService } from '../../../core/services/alert.service';
import { SpinnerService } from '../../../core/services/spinner.service';
import { ToastService } from '../../../core/services/toast.service';
import { PressDirective } from '../../../shared/directives/press.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { ProgramDayInfo, TrainingProgram } from '../../../core/models/training-program.model';
import { MenuMode } from '../../../core/models/app-settings.model';
// DomSanitizer is not explicitly used in this version after previous edits, but good to keep if you plan to use [innerHTML] with dynamic SVGs later.
// import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface DisplayLoggedExercise extends LoggedWorkoutExercise {
  baseExercise?: Exercise | null;
  isExpanded?: boolean;
  showWarmups?: boolean;
  warmupSets?: LoggedSet[];
  workingSets?: LoggedSet[];
  iconName?: string;
  // Superset related properties (assuming they come from LoggedWorkoutExercise or are derived)
  supersetId?: string | null;
  supersetOrder?: number | null;
  supersetSize?: number | null;
  supersetRounds?: number | null;      // Total rounds for THIS superset instance in the log
  supersetCurrentRound?: number | null; // The current round number for THIS exercise entry
}

interface TargetComparisonData {
  metric: 'Reps' | 'Duration' | 'Weight' | 'Rest';
  targetValue: string;
  performedValue: string;
}

@Component({
  selector: 'app-workout-log-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, ModalComponent, ExerciseDetailComponent, IsWeightedPipe, ActionMenuComponent, PressDirective, IconComponent, TooltipDirective],
  templateUrl: './workout-log-detail.html',
  providers: [DecimalPipe] // DecimalPipe if used directly in template; WeightUnitPipe already handles it
})
export class WorkoutLogDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  // MODIFICATION: trackingService is now used directly in the component
  protected trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService);
  private workoutService = inject(WorkoutService);
  protected unitService = inject(UnitsService);
  private alertService = inject(AlertService);
  private spinnerService = inject(SpinnerService);
  private toastService = inject(ToastService);
  // private sanitizer = inject(DomSanitizer); // Keep if needed for other purposes
  private platformId = inject(PLATFORM_ID);

  private trainingService = inject(TrainingProgramService);

  comparisonModalData = signal<TargetComparisonData | null>(null);
  notesModalsData = signal<string | null>(null);
  isExerciseDetailModalOpen = signal(false);
  isSimpleModalOpen = signal(false);
  exerciseDetailsId: string = '';
  exerciseDetailsName: string = '';

  workoutLog = signal<WorkoutLog | null | undefined>(undefined);
  displayExercises = signal<DisplayLoggedExercise[]>([]);
  // NEW: Signal to store PB data for the exercises in this log
  personalBestsForLog = signal<Record<string, PersonalBestSet[]>>({});

  @Input() logId?: string;
  exerciseInfoTooltipString = 'Exercise details and progression';

  private subscriptions = new Subscription();
  availablePrograms: TrainingProgram[] = [];


  weekName = signal<string | null>(null);
  dayInfo = signal<ProgramDayInfo | null>(null);

  constructor() {
    // Initialization if needed
  }

  async ngOnInit(): Promise<void> {
    window.scrollTo(0, 0);
    // This subscription is fine as it is.
    this.subscriptions.add(
      this.trainingService.programs$.pipe(take(1)).subscribe(programs => {
        this.availablePrograms = programs;
      })
    );

    const idSource$ = this.logId ? of(this.logId) : this.route.paramMap.pipe(map(params => params.get('logId')));
    this.subscriptions.add( // Add the main subscription to the master Subscription object
      idSource$.pipe(
        // Get the log by ID
        switchMap(id => {
          if (id) {
            return this.trackingService.getWorkoutLogById(id);
          }
          return of(null); // If no ID, emit null
        }),
        // Use a single, async tap for all dependent operations
        tap(async (log) => {
          this.workoutLog.set(log); // Set the main log signal

          if (log && log.exercises && log.exercises.length > 0) {
            // All of this logic now correctly waits for the log to be available
            this.prepareDisplayExercises(log.exercises);
            await this.enrichLoggedExercisesWithTargets();

            this.trainingService.getWeekNameForLog(log).pipe(take(1)).subscribe(name => {
              this.weekName.set(name);
            });

            this.trainingService.getDayOfWeekForLog(log).pipe(take(1)).subscribe(info => {
              this.dayInfo.set(info);
            });

          } else {
            // Handle the case where there is no log or no exercises
            this.displayExercises.set([]);
            this.weekName.set(null);
            this.dayInfo.set(null);
          }
        }),
        catchError(err => {
          console.error("Error fetching workout log:", err);
          this.workoutLog.set(null);
          this.displayExercises.set([]);
          this.weekName.set(null);
          return of(null); // Keep the stream alive
        })
      ).subscribe()
    );
  }

   async enrichLoggedExercisesWithTargets() {
    const log = this.workoutLog();
    if (!log?.routineId) return;

    const routine = await firstValueFrom(this.workoutService.getRoutineById(log.routineId));
    if (!routine?.exercises) return;

    const routineExerciseMap = new Map(routine.exercises.map(ex => [ex.id, ex]));

    for (const loggedEx of log.exercises) {
      // Find the corresponding exercise from the original routine plan.
      // Note: This relies on the instance `id` being consistent.
      const routineEx = routineExerciseMap.get(loggedEx.id);

      for (let i = 0; i < loggedEx.sets.length; i++) {
        const set = loggedEx.sets[i];
        // Find the corresponding set from the routine plan.
        const routineExerciseSet = routineEx?.sets?.find(s => s.id === set.plannedSetId) ?? routineEx?.sets?.[i];

        // --- THIS IS THE KEY LOGIC CHANGE ---
        // For each target, use the value on the logged set if it exists,
        // otherwise, fall back to the value from the original routine.
        
        set.targetReps = set.targetReps ?? routineExerciseSet?.targetReps;
        set.targetRepsMin = set.targetRepsMin ?? routineExerciseSet?.targetRepsMin;
        set.targetRepsMax = set.targetRepsMax ?? routineExerciseSet?.targetRepsMax;

        set.targetDuration = set.targetDuration ?? routineExerciseSet?.targetDuration;
        set.targetDurationMin = set.targetDurationMin ?? routineExerciseSet?.targetDurationMin;
        set.targetDurationMax = set.targetDurationMax ?? routineExerciseSet?.targetDurationMax;

        set.targetWeight = set.targetWeight ?? routineExerciseSet?.targetWeight;
        set.targetWeightMin = set.targetWeightMin ?? routineExerciseSet?.targetWeightMin;
        set.targetWeightMax = set.targetWeightMax ?? routineExerciseSet?.targetWeightMax;

        set.targetDistance = set.targetDistance ?? routineExerciseSet?.targetDistance;
        set.targetDistanceMin = set.targetDistanceMin ?? routineExerciseSet?.targetDistanceMin;
        set.targetDistanceMax = set.targetDistanceMax ?? routineExerciseSet?.targetDistanceMax;

        set.targetRestAfterSet = set.targetRestAfterSet ?? routineExerciseSet?.restAfterSet;
      }
    }

    // Update the signal to trigger view refresh with the enriched data.
    this.workoutLog.set({ ...log });
  }
  private prepareDisplayExercises(loggedExercises: LoggedWorkoutExercise[]): void {
    // --- Logic to determine supersetRounds and supersetCurrentRound ---
    // This part is crucial and depends on how your `loggedExercises` array is structured
    // when multiple rounds of a superset are present.
    // The following is a conceptual approach. You'll need to adapt it
    // based on whether `rounds` for a superset is on the LoggedWorkoutExercise,
    // or if you infer it from the sequence.

    const processedExercises: Partial<DisplayLoggedExercise>[] = [];
    const supersetRoundData: {
      [supersetId: string]: {
        firstOccurrenceIndex: number;
        instanceCount: number;
        totalRoundsFromData?: number; // Rounds specified on the logged exercise itself
      }
    } = {};
    const supersetInstancePassCounters: { [supersetId: string]: number } = {};

    // First pass: Collect info about superset instances and potential total rounds
    loggedExercises.forEach((ex, index) => {
      if (ex.supersetId) {
        if (!supersetRoundData[ex.supersetId]) {
          supersetRoundData[ex.supersetId] = {
            firstOccurrenceIndex: index,
            instanceCount: 0,
            totalRoundsFromData: ex.supersetRounds ? ex.supersetRounds : ex.sets.length // Assuming 'rounds' on LoggedWorkoutExercise might mean total rounds for that superset instance
          };
        }
        if (ex.supersetOrder === 0) { // Count each time a superset starts
          supersetRoundData[ex.supersetId].instanceCount++;
        }
      }
    });

    // Second pass: Assign round information
    loggedExercises.forEach(loggedEx => {
      const displayEx: Partial<DisplayLoggedExercise> = { ...loggedEx }; // Start with a copy

      if (loggedEx.supersetId) {
        const supData = supersetRoundData[loggedEx.supersetId];
        displayEx.supersetRounds = supData.totalRoundsFromData || supData.instanceCount || 1;

        if (loggedEx.supersetOrder === 0) {
          supersetInstancePassCounters[loggedEx.supersetId] = (supersetInstancePassCounters[loggedEx.supersetId] || 0) + 1;
        }
        displayEx.supersetCurrentRound = supersetInstancePassCounters[loggedEx.supersetId] || 1;
      }
      processedExercises.push(displayEx);
    });
    // --- End of conceptual round determination ---

    const detailFetchers$: Observable<DisplayLoggedExercise>[] = processedExercises.map((processedEx, index) => {
      // Ensure exerciseId is present before calling service
      const exerciseId = processedEx.exerciseId;
      if (!exerciseId) {
        // Handle cases where exerciseId might be missing, though it shouldn't for a logged exercise
        console.warn("Logged exercise missing exerciseId:", processedEx);
        const warmupSets = processedEx.sets?.filter(s => s.type === 'warmup') || [];
        const workingSets = processedEx.sets?.filter(s => s.type !== 'warmup') || [];
        return of({
          ...(processedEx as LoggedWorkoutExercise), // Cast back if needed, ensure all base props
          baseExercise: null,
          // isExpanded: index === 0,
          isExpanded: true,
          showWarmups: warmupSets.length > 0,
          warmupSets: warmupSets,
          workingSets: workingSets,
          iconName: this.exerciseService.determineExerciseIcon(null, processedEx.exerciseName ?? ''),
          supersetId: processedEx.supersetId,
          supersetOrder: processedEx.supersetOrder,
          supersetSize: processedEx.supersetSize,
          supersetRounds: processedEx.supersetRounds,
          supersetCurrentRound: processedEx.supersetCurrentRound,
        } as DisplayLoggedExercise);
      }

      return this.exerciseService.getExerciseById(exerciseId).pipe(
        map(baseEx => { // baseEx is Exercise | undefined
          const warmupSets = processedEx.sets?.filter(s => s.type === 'warmup') || [];
          const workingSets = processedEx.sets?.filter(s => s.type !== 'warmup') || [];
          const exerciseForIcon = baseEx || null;

          return {
            ...(processedEx as LoggedWorkoutExercise), // Spread original loggedEx properties (which now include round info)
            baseExercise: exerciseForIcon,
            // isExpanded: index === 0 && (!processedEx.supersetId || (processedEx.supersetId && processedEx.supersetOrder === 0 && (processedEx.supersetCurrentRound === 1 || !processedEx.supersetCurrentRound))),
            isExpanded: true,
            showWarmups: warmupSets.length > 0,
            warmupSets: warmupSets,
            workingSets: workingSets,
            iconName: this.exerciseService.determineExerciseIcon(exerciseForIcon, processedEx.exerciseName ?? ''),
            // Superset props are already on processedEx
          } as DisplayLoggedExercise;
        }),
        catchError(err => {
          console.error(`Error fetching base exercise details for ID ${exerciseId}:`, err);
          const warmupSets = processedEx.sets?.filter(s => s.type === 'warmup') || [];
          const workingSets = processedEx.sets?.filter(s => s.type !== 'warmup') || [];
          return of({
            ...(processedEx as LoggedWorkoutExercise),
            baseExercise: null,
            // isExpanded: index === 0,
            isExpanded: true,
            showWarmups: warmupSets.length > 0,
            warmupSets: warmupSets,
            workingSets: workingSets,
            iconName: this.exerciseService.determineExerciseIcon(null, processedEx.exerciseName ?? ''),
            // Superset props are already on processedEx
          } as DisplayLoggedExercise);
        })
      );
    });

    if (detailFetchers$.length === 0) {
      this.displayExercises.set([]);
      return;
    }

    forkJoin(detailFetchers$).subscribe({
      next: (exercisesWithDetails) => {

        // 1. Add originalIndex to preserve workout order before splitting/sorting
        const exercisesWithOriginalIndex = exercisesWithDetails.map((ex, index) => ({ ...ex, originalIndex: index }));

        // 2. Use flatMap to split multi-round supersets into individual round objects
        const processedExercises = exercisesWithOriginalIndex.flatMap(le => {
          if (le.supersetId && le.supersetRounds && le.supersetRounds > 1) {
            const splitByRound: any = [];
            for (let i = 1; i <= le.supersetRounds; i++) {
              const roundSet = le.sets[i - 1];
              if (roundSet) {
                splitByRound.push({
                  ...le, // This now includes originalIndex and supersetOrder
                  id: `${le.id}-round-${i}`,
                  supersetCurrentRound: i,
                  sets: [roundSet],
                  workingSets: [roundSet],
                  warmupSets: [],
                  isExpanded: true,
                });
              }
            }
            return splitByRound;
          } else {
            return [{
              ...le,
              isExpanded: true,
              workingSets: le.sets.filter(s => s.type !== 'warmup'),
              warmupSets: le.sets.filter(s => s.type === 'warmup'),
              showWarmups: le.sets.some(s => s.type === 'warmup'),
            }];
          }
        });

        // 3. NEW: Sort by exercise "block", then by round, then by order within the round.
        processedExercises.sort((a, b) => {
          // Determine the starting index of the block each item belongs to.
          // For a standard exercise, its block index is its own original index.
          // For a superset exercise, its block index is its original index minus its order within the superset.
          const blockIndexA = a.supersetId ? (a.originalIndex - (a.supersetOrder || 0)) : a.originalIndex;
          const blockIndexB = b.supersetId ? (b.originalIndex - (b.supersetOrder || 0)) : b.originalIndex;

          // If the items are in different blocks, sort by the block's starting position.
          if (blockIndexA !== blockIndexB) {
            return blockIndexA - blockIndexB;
          }

          // If they are in the same block, they must be part of the same superset.
          // Now sort them internally: first by round number...
          if (a.supersetCurrentRound !== b.supersetCurrentRound) {
            return a.supersetCurrentRound - b.supersetCurrentRound;
          }

          // ...then by the exercise's intended order within the superset round.
          return (a.supersetOrder || 0) - (b.supersetOrder || 0);
        });

        this.displayExercises.set(processedExercises as DisplayLoggedExercise[]);
        // NEW: After setting exercises, fetch their PBs for display
        this.fetchPersonalBestsForLog(processedExercises as DisplayLoggedExercise[]);
      },
      error: (err) => {
        console.error("Error fetching exercise details for log display:", err);

        const initialLoggedExercises = this.workoutLog()?.exercises || [];
        const exercisesWithOriginalIndex = initialLoggedExercises.map((ex, index) => ({ ...ex, originalIndex: index }));

        const fallbackExercises = exercisesWithOriginalIndex.flatMap(le => {
          if (le.supersetId && le.supersetRounds && le.supersetRounds > 1 && le.sets) {
            const splitByRound = [];
            for (let i = 1; i <= le.supersetRounds; i++) {
              const roundSet = le.sets[i - 1];
              if (roundSet) {
                splitByRound.push({
                  ...(le as LoggedWorkoutExercise),
                  originalIndex: le.originalIndex,
                  baseExercise: null,
                  id: `${le.id}-round-${i}`,
                  supersetCurrentRound: i,
                  sets: [roundSet],
                  workingSets: [roundSet],
                  warmupSets: [],
                  isExpanded: true,
                  showWarmups: false,
                  iconName: this.exerciseService.determineExerciseIcon(null, le.exerciseName ?? ''),
                });
              }
            }
            return splitByRound;
          } else {
            const warmupSets = le.sets?.filter(s => s.type === 'warmup') || [];
            const workingSets = le.sets?.filter(s => s.type !== 'warmup') || [];
            return [{
              ...(le as LoggedWorkoutExercise),
              originalIndex: le.originalIndex,
              baseExercise: null,
              isExpanded: true,
              showWarmups: warmupSets.length > 0,
              warmupSets: warmupSets,
              workingSets: workingSets,
              iconName: this.exerciseService.determineExerciseIcon(null, le.exerciseName ?? ''),
            }];
          }
        });

        // Apply the same robust sorting logic in the error handler
        fallbackExercises.sort((a, b) => {
          const blockIndexA = a.supersetId ? (a.originalIndex - (a.supersetOrder || 0)) : a.originalIndex;
          const blockIndexB = b.supersetId ? (b.originalIndex - (b.supersetOrder || 0)) : b.originalIndex;

          if (blockIndexA !== blockIndexB) {
            return blockIndexA - blockIndexB;
          }

          if ((a.supersetCurrentRound !== undefined && a.supersetCurrentRound !== null) &&
            (b.supersetCurrentRound !== undefined && b.supersetCurrentRound !== null) && a.supersetCurrentRound !== b.supersetCurrentRound) {
            return a.supersetCurrentRound - b.supersetCurrentRound;
          }

          return (a.supersetOrder || 0) - (b.supersetOrder || 0);
        });

        this.displayExercises.set(fallbackExercises as DisplayLoggedExercise[]);
        // NEW: Also fetch PBs in the error case
        this.fetchPersonalBestsForLog(fallbackExercises as DisplayLoggedExercise[]);
      }
    });
  }

  // NEW: Method to fetch PBs for the exercises in the log
  private fetchPersonalBestsForLog(exercises: DisplayLoggedExercise[]): void {
    const exerciseIds = [...new Set(exercises.map(ex => ex.exerciseId).filter(id => !!id))];
    if (exerciseIds.length === 0) {
      this.personalBestsForLog.set({});
      return;
    }

    const pbObservables = exerciseIds.map(id =>
      this.trackingService.getAllPersonalBestsForExercise(id!).pipe(
        take(1),
        map(pbs => ({ exerciseId: id!, pbs }))
      )
    );

    forkJoin(pbObservables).subscribe(results => {
      const pbMap: Record<string, PersonalBestSet[]> = {};
      results.forEach(result => {
        console.log("results", result)
        if (result.pbs.length > 0) {
          pbMap[result.exerciseId] = result.pbs;
        }
      });
      this.personalBestsForLog.set(pbMap);
    });
  }

  /**
     * Checks if a specific set was a Personal Best at any point in time.
     * It does this by checking if the set's ID matches the current PB's ID,
     * OR if a record matching this set's performance exists in the PB's history.
     * @param set The LoggedSet to check.
     * @param exerciseId The ID of the exercise this set belongs to.
     * @returns An array of strings representing the PB types achieved with this set.
     */
  getPersonalBestTypesForSet(set: LoggedSet, exerciseId: string): string[] {
    const pbsForExercise = this.personalBestsForLog()[exerciseId];
    if (!pbsForExercise || !set.id) {
      return [];
    }

    const achievedPbTypes: string[] = [];

    // Iterate through each type of current PB for the exercise (e.g., '5RM', 'Heaviest Lifted')
    for (const currentPb of pbsForExercise) {
      // 1. Check if this set IS the current Personal Best record.
      if (currentPb.id === set.id) {
        achievedPbTypes.push(currentPb.pbType);
        continue; // Move to the next PB type, no need to check history
      }

      // 2. If not the current PB, check if this set exists in the history of that PB type.
      // This means this set WAS a record holder before it was beaten.
      if (currentPb.history && currentPb.history.length > 0) {
        const wasHistoricPb = currentPb.history.some(historicPb =>
          // We match based on the workout log and performance, as the set ID isn't in history.
          historicPb.workoutLogId === set.workoutLogId &&
          historicPb.weightUsed === set.weightUsed &&
          historicPb.repsAchieved === set.repsAchieved
        );

        if (wasHistoricPb) {
          achievedPbTypes.push(currentPb.pbType);
        }
      }
    }

    return achievedPbTypes;
  }


  getIconPath(iconName: string | undefined): string {
    return this.exerciseService.getIconPath(iconName);
  }

  toggleExerciseAccordion(exercise: DisplayLoggedExercise): void {
    exercise.isExpanded = !exercise.isExpanded;
    // Potentially, if it's the first item of a multi-round superset and is being collapsed,
    // you might want to collapse all other items of the same superset instance (same supersetId and supersetCurrentRound).
    // This is more advanced UX and not implemented here for simplicity.
  }

  toggleWarmupAccordion(exercise: DisplayLoggedExercise): void {
    exercise.showWarmups = !exercise.showWarmups;
  }

  getDisplaySetLabel(setsOfType: LoggedSet[], currentIndexInType: number): string {
    const currentSet = setsOfType[currentIndexInType];
    const displayIndex = currentIndexInType + 1;

    let labelPrefix = `Set ${displayIndex}`; // Default
    if (currentSet.type === 'warmup') {
      labelPrefix = `Warm-up ${displayIndex}`;
    } else if (currentSet.type === 'failure') {
      labelPrefix = `Failure Set ${displayIndex}`;
    } else if (currentSet.type === 'dropset') {
      labelPrefix = `Drop Set ${displayIndex}`;
    } else if (currentSet.type === 'amrap') {
      labelPrefix = `AMRAP Set ${displayIndex}`;
    } // Add other types as needed

    return labelPrefix;
  }

  displayExerciseDetails(id: string): void {
    this.router.navigate(['/library', id]);
  }

  performAction() {
    console.log('Action performed from modal footer!');
    this.isExerciseDetailModalOpen.set(false);
  }

  openModal(exerciseData: DisplayLoggedExercise, event?: Event) {
    event?.stopPropagation();
    this.exerciseDetailsId = exerciseData.exerciseId;
    this.exerciseDetailsName = exerciseData.exerciseName || 'Exercise details';
    this.isSimpleModalOpen.set(true);
  }

  secondsToDateTime(seconds: number): Date {
    const d = new Date(0, 0, 0, 0, 0, 0, 0);
    d.setSeconds(seconds);
    return d;
  }

  getSetWeightsUsed(loggedEx: LoggedWorkoutExercise): string {
    return loggedEx.sets.map(set => set.weightUsed).join(' - ');
  }

  getSetDurationPerformed(loggedEx: LoggedWorkoutExercise): string {
    return loggedEx.sets.map(set => set.durationPerformed).join(' - ');
  }

  getSetReps(loggedEx: LoggedWorkoutExercise): string {
    return loggedEx?.sets.map(set => set.repsAchieved).join(' - ');
  }

  checkIfTimedExercise(loggedEx: LoggedWorkoutExercise): boolean {
    return loggedEx.sets.some(set => set.targetDuration) || loggedEx?.sets.some(set => set.durationPerformed);
  }

  checkIfWeightedExercise(loggedEx: LoggedWorkoutExercise): boolean {
    return loggedEx?.sets.some(set => set.targetWeight) || loggedEx?.sets.some(set => set.weightUsed);
  }


  // This function is now fast, synchronous, and safe to call from a template.
  checkTextClass(set: LoggedSet, type: 'reps' | 'duration' | 'weight' | 'rest'): string {
    if (!set) {
      return 'text-gray-700 dark:text-gray-300';
    }

    // For reps and duration, check for range targets first.
    if (type === 'reps') {
      const performed = set.repsAchieved ?? 0;
      const min = set.targetRepsMin;
      const max = set.targetRepsMax;

      if (min != null || max != null) {
        if (min != null && performed < min) return 'text-red-500 dark:text-red-400';     // Below range
        if (max != null && performed > max) return 'text-green-500 dark:text-green-400'; // Above range
        return 'text-gray-800 dark:text-white';                                          // Within range
      }
    }

    if (type === 'duration') {
      const performed = set.durationPerformed ?? 0;
      const min = set.targetDurationMin;
      const max = set.targetDurationMax;

      if (min != null || max != null) {
        if (min != null && performed < min) return 'text-red-500 dark:text-red-400';     // Below range
        if (max != null && performed > max) return 'text-green-500 dark:text-green-400'; // Above range
        return 'text-gray-800 dark:text-white';                                          // Within range
      }
    }

    // Fallback to single target comparison for weight, rest, or if no range is set.
    let performedValue = 0;
    let targetValue = 0;

    switch (type) {
      case 'reps':
        performedValue = set.repsAchieved ?? 0;
        targetValue = set.targetReps ?? 0;
        break;
      case 'duration':
        performedValue = set.durationPerformed ?? 0;
        targetValue = set.targetDuration ?? 0;
        break;
      case 'weight':
        performedValue = set.weightUsed ?? 0;
        targetValue = set.targetWeight ?? 0;
        break;
      case 'rest':
        performedValue = set.restAfterSetUsed ?? 0;
        targetValue = set.targetRestAfterSet ?? 0;
        break;
    }

    if (targetValue > 0) {
      if (performedValue > targetValue) return 'text-green-500 dark:text-green-400';
      if (performedValue < targetValue) return 'text-red-500 dark:text-red-400';
    }

    return 'text-gray-800 dark:text-white';
  }


  // --- ADD THIS NEW METHOD ---
  /**
   * Checks if a performance target was missed and, if so,
   * prepares and shows the comparison modal.
   * @param set The LoggedSet object.
   * @param type The metric being checked ('reps', 'duration', 'weight', 'rest').
   */
  showComparisonModal(set: LoggedSet, type: 'reps' | 'duration' | 'weight' | 'rest'): void {
    if (!set) return;

    let performedValue: number | undefined;
    let targetValueDisplay: string | undefined;
    let modalData: TargetComparisonData | null = null;
    const unitLabel = this.unitService.getWeightUnitSuffix();

    const createTargetDisplay = (min?: number | null, max?: number | null, single?: number | null, suffix: string = ''): string => {
      if (min != null || max != null) {
        if (min != null && max != null) return min === max ? `${single ?? min}${suffix}` : `${min}-${max}${suffix}`;
        if (min != null) return `${min}+${suffix}`;
        if (max != null) return `Up to ${max}${suffix}`;
      }
      return single != null ? `${single}${suffix}` : '-';
    };

    if (type === 'reps') {
      performedValue = set.repsAchieved;
      targetValueDisplay = createTargetDisplay(set.targetRepsMin, set.targetRepsMax, set.targetReps);
      if ((set.targetRepsMin != null && (performedValue ?? 0) < set.targetRepsMin) || (set.targetRepsMin == null && (performedValue ?? 0) < (set.targetReps ?? 0))) {
        modalData = { metric: 'Reps', targetValue: targetValueDisplay, performedValue: `${performedValue ?? '-'}` };
      }
    } else if (type === 'duration') {
      performedValue = set.durationPerformed;
      targetValueDisplay = createTargetDisplay(set.targetDurationMin, set.targetDurationMax, set.targetDuration, ' s');
      if ((set.targetDurationMin != null && (performedValue ?? 0) < set.targetDurationMin) || (set.targetDurationMin == null && (performedValue ?? 0) < (set.targetDuration ?? 0))) {
        modalData = { metric: 'Duration', targetValue: targetValueDisplay, performedValue: `${performedValue ?? '-'} s` };
      }
    } else if (type === 'weight') {
      performedValue = set.weightUsed;
      targetValueDisplay = set.targetWeight != null ? `${set.targetWeight} ${unitLabel}` : '-';
      if ((performedValue ?? 0) < (set.targetWeight ?? 0)) {
        modalData = { metric: 'Weight', targetValue: targetValueDisplay, performedValue: `${performedValue ?? '-'} ${unitLabel}` };
      }
    } else if (type === 'rest') {
      performedValue = set.restAfterSetUsed;
      targetValueDisplay = set.targetRestAfterSet != null ? `${set.targetRestAfterSet} s` : '-';
      if ((performedValue ?? 0) < (set.targetRestAfterSet ?? 0)) {
        modalData = { metric: 'Rest', targetValue: targetValueDisplay, performedValue: `${performedValue ?? '-'} s` };
      }
    }

    if (modalData) {
      this.comparisonModalData.set(modalData);
    }
  }

  // --- ADD A HELPER METHOD FOR STYLING ---
  /**
   * A simple boolean check to help with styling clickable elements.
   */
  isTargetMissed(set: LoggedSet, type: 'reps' | 'duration' | 'weight' | 'rest'): boolean {
    if (!set) return false;

    if (type === 'reps') {
      const performed = set.repsAchieved ?? 0;
      const min = set.targetRepsMin;
      // It's a miss if there's a minimum target and performance is below it.
      if (min != null) return performed < min;
      // Fallback for single target
      return performed < (set.targetReps ?? 0);
    }

    if (type === 'duration') {
      const performed = set.durationPerformed ?? 0;
      const min = set.targetDurationMin;
      if (min != null) return performed < min;
      return performed < (set.targetDuration ?? 0);
    }

    // Logic for weight and rest remains the same as they don't use ranges
    const performed = (type === 'weight' ? set.weightUsed : set.restAfterSetUsed) ?? 0;
    const target = (type === 'weight' ? set.targetWeight : set.targetRestAfterSet) ?? 0;

    return performed < target && target > 0;
  }

  showNotesModal(notes: string): void {
    this.notesModalsData.set(notes);
  }

  // Your existing toggleActions, areActionsVisible, viewRoutineDetails, etc. methods
  // The toggleActions will now just control a signal like `activeRoutineIdActions`
  // which is used to show/hide the <app-action-menu>
  activeRoutineIdActions = signal<string | null>(null); // Store ID of routine whose actions are open

  toggleActions(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeRoutineIdActions.update(current => (current === routineId ? null : routineId));
  }

  areActionsVisible(routineId: string): boolean {
    return this.activeRoutineIdActions() === routineId;
  }

  // When closing menu from the component's output
  onCloseActionMenu() {
    this.activeRoutineIdActions.set(null);
  }


  getLogDropdownActionItems(routineId: string, mode: MenuMode): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';

    const currentLog = this.workoutLog();


    const routineDetailsBtn = {
      label: 'ROUTINE',
      actionKey: 'routine',
      iconName: `routines`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    } as ActionMenuItem;

    const actionsArray: ActionMenuItem[] = [
      {
        label: 'SUMMARY',
        actionKey: 'view',
        iconName: 'eye',
        iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      {
        label: 'EDIT LOG',
        actionKey: 'edit',
        iconName: 'edit',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      routineDetailsBtn,
      { isDivider: true },
      {
        label: 'DELETE',
        actionKey: 'delete',
        iconName: 'trash',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
        data: { routineId }
      }
    ];
    return actionsArray;
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
    // originalMouseEvent.stopPropagation(); // Stop original event that opened the menu
    const logId = event.data?.routineId;
    if (!logId) return;

    switch (event.actionKey) {
      case 'edit':
        this.router.navigate(['/workout/log/manual/edit', logId])
        break;
      case 'view':
        this.router.navigate(['/workout/summary', logId])
        break;
      case 'delete':
        this.deleteLogDetails(logId);
        break;
      case 'routine':
        this.goToRoutineDetails();
        break;
    }
    this.activeRoutineIdActions.set(null); // Close the menu
  }

  createRoutineFromLog(logId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    // This will navigate to a new route that the workout builder will handle
    this.router.navigate(['/workout/routine/new-from-log', logId]);
  }

  async goToRoutineDetails(): Promise<void> {
    if (!this.workoutLog() || !this.workoutLog()?.routineId) {
      return;
    } else {

    }

    const log = this.workoutLog();
    if (log && log.routineId && log.routineId !== '-1') {
      this.router.navigate(['/workout/routine/view/', log.routineId]);
    } else {
      const createNewRoutineFromLog = await this.alertService.showConfirm("No routine for log", "There is no routine associated with this log: would you like to create one? If so remember to link it to this log once created");
      if (log && createNewRoutineFromLog && createNewRoutineFromLog.data) {
        this.createRoutineFromLog(log.id);
      }
      return;
    }
  }

  async deleteLogDetails(logId: string, event?: MouseEvent): Promise<void> {
    const confirm = await this.alertService.showConfirm("Delete Workout Log", "Are you sure you want to delete this workout log? This action cannot be undone", "Delete");
    if (confirm && confirm.data) {
      try {
        this.spinnerService.show(); await this.trackingService.deleteWorkoutLog(logId);
        this.toastService.success("Workout log deleted successfully");
        this.router.navigate(['/history/list']);
      } catch (err) { this.toastService.error("Failed to delete workout log"); }
      finally { this.spinnerService.hide(); }
    }
  }

  showBackToTopButton = signal<boolean>(false);
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    // Check if the user has scrolled down more than a certain amount (e.g., 400 pixels)
    // You can adjust this value to your liking.
    const verticalOffset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    this.showBackToTopButton.set(verticalOffset > 400);
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth' // For a smooth scrolling animation
      });
    }
  }


  checkIfLogForProgram(): boolean {
    return !!(this.workoutLog()?.programId);
  }

  getLogTitleForProgramEntry(): string {
    if (this.checkIfLogForProgram()) {
      const program = this.availablePrograms.find(p => p.id === this.workoutLog()?.programId);

      // if it's a linear program, show even name and week
      if (program) {
        return `Log for Program: ${program.name}${this.weekName() ? ' - ' + this.weekName() : ''}${this.dayInfo() ? ' - Day ' + this.dayInfo()?.dayNumber : ''}`;
      }
    }
    return 'Ad-hoc Workout';
  }

  /**
   * Checks if any set within a logged exercise has a performed duration greater than 0.
   * This is used to conditionally show the "Time" column in the details grid.
   * @param loggedEx The exercise to check.
   * @returns True if at least one set has a performed duration, otherwise false.
   */
  protected hasPerformedTimedSets(loggedEx: DisplayLoggedExercise): boolean {
    return loggedEx?.sets?.some(set => set.durationPerformed != null && set.durationPerformed > 0) ?? false;
  }


  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

}