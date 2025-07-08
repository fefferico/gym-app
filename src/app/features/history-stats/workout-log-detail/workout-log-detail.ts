// workout-log-detail.ts
import { Component, inject, Input, OnInit, signal, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin, Observable, of } from 'rxjs';
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
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, WeightUnitPipe, ModalComponent, ExerciseDetailComponent, IsWeightedPipe, ActionMenuComponent],
  templateUrl: './workout-log-detail.html',
  providers: [DecimalPipe] // DecimalPipe if used directly in template; WeightUnitPipe already handles it
})
export class WorkoutLogDetailComponent implements OnInit {
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



  async ngOnInit(): Promise<void> {
    const idSource$ = this.logId ? of(this.logId) : this.route.paramMap.pipe(map(params => params.get('logId')));

    idSource$.pipe(
      switchMap(id => {
        if (id) {
          return this.trackingService.getWorkoutLogById(id);
        }
        return of(null); // No ID, so no log to fetch
      }),
      tap(log => {
        this.workoutLog.set(log); // Set log, could be null if not found or no ID
        if (log && log.exercises && log.exercises.length > 0) {
          this.prepareDisplayExercises(log.exercises);
        } else {
          this.displayExercises.set([]); // No exercises or no log
        }
      }),
      catchError(err => {
        console.error("Error fetching workout log:", err);
        this.workoutLog.set(null); // Set to null on error
        this.displayExercises.set([]);
        return of(null); // Continue the stream gracefully
      })
    ).subscribe();

    await this.enrichLoggedExercisesWithTargets();
  }

  async enrichLoggedExercisesWithTargets() {
    const log = this.workoutLog();
    if (!log?.routineId) return;

    // 1. FETCH ROUTINE DATA ONCE
    const routine$ = this.workoutService.getRoutineById(log.routineId);
    const routine = await firstValueFrom(routine$);
    if (!routine?.exercises) return;

    // 2. CREATE A MAP FOR FAST LOOKUPS
    // The key is the exercise ID, the value is the full routine exercise object.
    const routineExerciseMap = new Map(routine.exercises.map(ex => [ex.id, ex]));

    // 3. LOOP AND ENRICH
    for (const loggedEx of log.exercises) {
      // --- FIX: Use 'exerciseId' to find the corresponding routine exercise ---
      const routineEx = routineExerciseMap.get(loggedEx.id);

      // No need for an 'if (routineEx)' check here, the loop will just handle it.

      for (let i = 0; i < loggedEx.sets.length; i++) {
        const set = loggedEx.sets[i];
        const routineExerciseSet = routineEx?.sets?.[i];

        // --- THIS IS THE KEY LOGIC CHANGE ---
        // For each target, establish a priority order:
        // 1. Use the value already on the logged set (if it exists).
        // 2. If not, use the value from the corresponding routine set.
        // 3. If that also doesn't exist, default to 0.

        set.targetReps = (set.targetReps && set.targetReps > 0)
          ? set.targetReps
          : (routineExerciseSet?.targetReps ?? 0);

        set.targetDuration = (set.targetDuration && set.targetDuration > 0)
          ? set.targetDuration
          : (routineExerciseSet?.targetDuration ?? 0);

        set.targetWeight = (set.targetWeight && set.targetWeight > 0)
          ? set.targetWeight
          : (routineExerciseSet?.targetWeight ?? 0);

        set.targetRestAfterSet = (set.targetRestAfterSet && set.targetRestAfterSet > 0)
          ? set.targetRestAfterSet
          : (routineExerciseSet?.restAfterSet ?? 0);
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
            totalRoundsFromData: ex.rounds // Assuming 'rounds' on LoggedWorkoutExercise might mean total rounds for that superset instance
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

  // NEW: Method for the template to check if a set was a PB
  getPersonalBestTypesForSet(set: LoggedSet, exerciseId: string): string[] {
    const pbsForExercise = this.personalBestsForLog()[exerciseId];
    if (!pbsForExercise || !set.id) {
      return [];
    }

    // Find all PBs that originated from this exact set instance by matching the set's unique ID.
    return pbsForExercise
      .filter(pb => pb.id === set.id)
      .map(pb => pb.pbType);
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

  openModal(exerciseData: DisplayLoggedExercise) {
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

    let performedValue = 0;
    let targetValue = 0;

    // Determine which properties to compare based on the 'type'
    if (type === 'reps') {
      performedValue = set.repsAchieved ?? 0;
      targetValue = set.targetReps ?? 0;
    } else if (type === 'duration') {
      performedValue = set.durationPerformed ?? 0;
      targetValue = set.targetDuration ?? 0;
    } else if (type === 'weight') {
      performedValue = set.weightUsed ?? 0;
      targetValue = set.targetWeight ?? 0;
    } else if (type === 'rest') {
      performedValue = set.restAfterSetUsed ?? 0;
      targetValue = set.targetRestAfterSet ?? 0;
    }

    // The simple comparison logic
    if (performedValue > targetValue) {
      return 'text-green-500 dark:text-green-400';
    } else if (performedValue < targetValue) {
      return 'text-red-500 dark:text-red-400';
    } else {
      return 'text-gray-800 dark:text-white';
    }
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

    let performedValue: number = 0;
    let targetValue: number = 0;
    let modalData: TargetComparisonData | null = null;
    const unitLabel = this.unitService.getUnitLabel();

    // Determine values based on type
    if (type === 'reps') {
      performedValue = set.repsAchieved ?? 0;
      targetValue = set.targetReps ?? 0;
      if (performedValue < targetValue) {
        modalData = {
          metric: 'Reps',
          targetValue: `${targetValue}`,
          performedValue: `${performedValue}`
        };
      }
    } else if (type === 'duration') {
      performedValue = set.durationPerformed ?? 0;
      targetValue = set.targetDuration ?? 0;
      if (performedValue < targetValue) {
        modalData = {
          metric: 'Duration',
          targetValue: `${targetValue} s`,
          performedValue: `${performedValue} s`
        };
      }
    } else if (type === 'weight') {
      performedValue = set.weightUsed ?? 0;
      targetValue = set.targetWeight ?? 0;
      if (performedValue < targetValue) {
        modalData = {
          metric: 'Weight',
          targetValue: `${targetValue} ${unitLabel}`,
          performedValue: `${performedValue} ${unitLabel}`
        };
      }
    } else if (type === 'rest') {
      performedValue = set.restAfterSetUsed ?? 0;
      targetValue = set.targetRestAfterSet ?? 0;
      if (performedValue < targetValue) {
        modalData = {
          metric: 'Rest',
          targetValue: `${targetValue} s`,
          performedValue: `${performedValue} s`
        };
      }
    }

    // If a target was missed, set the signal to open the modal
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

    const performed = (type === 'reps' ? set.repsAchieved : type === 'duration' ? set.durationPerformed : type === 'rest' ? set.restAfterSetUsed : set.weightUsed) ?? 0;
    const target = (type === 'reps' ? set.targetReps : type === 'duration' ? set.targetDuration : type === 'rest' ? set.targetRestAfterSet : set.targetWeight) ?? 0;

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


  getLogDropdownActionItems(routineId: string, mode: 'dropdown' | 'compact-bar'): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';;

    const currentLog = this.workoutLog();
    const actionsArray = [
      {
        label: 'SUMMARY',
        actionKey: 'view',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" /><path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 11-8 0 4 4 0 018 0Z" clip-rule="evenodd" /></svg>`,
        iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      {
        label: 'EDIT',
        actionKey: 'edit',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      {
        label: 'DELETE',
        actionKey: 'delete',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.177-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5Zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5Z" clip-rule="evenodd" /></svg>`,
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
    }
    this.activeRoutineIdActions.set(null); // Close the menu
  }

  async deleteLogDetails(logId: string, event?: MouseEvent): Promise<void> {
    const confirm = await this.alertService.showConfirm("Delete Workout Log", "Are you sure you want to delete this workout log? This action cannot be undone", "Delete");
    if (confirm && confirm.data) {
      try {
        this.spinnerService.show(); await this.trackingService.deleteWorkoutLog(logId);
        this.toastService.success("Workout log deleted successfully.");
        this.router.navigate(['/history/list']);
      } catch (err) { this.toastService.error("Failed to delete workout log."); }
      finally { this.spinnerService.hide(); }
    }
  }

}