// workout-log-detail.ts
import { Component, inject, Input, OnInit, signal, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin, Observable, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { Exercise } from '../../../core/models/exercise.model';
import { LoggedWorkoutExercise, WorkoutLog, LoggedSet } from '../../../core/models/workout-log.model';
import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ExerciseDetailComponent } from '../../exercise-library/exercise-detail';
import { Routine, WorkoutExercise } from '../../../core/models/workout.model';
import { UnitsService } from '../../../core/services/units.service';
import { IsWeightedPipe } from '../../../shared/pipes/is-weighted-pipe';
import { WorkoutService } from '../../../core/services/workout.service';
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
  metric: 'Reps' | 'Duration' | 'Weight';
  targetValue: string;
  performedValue: string;
}

@Component({
  selector: 'app-workout-log-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, WeightUnitPipe, ModalComponent, ExerciseDetailComponent, IsWeightedPipe],
  templateUrl: './workout-log-detail.html',
  providers: [DecimalPipe] // DecimalPipe if used directly in template; WeightUnitPipe already handles it
})
export class WorkoutLogDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService);
  private workoutService = inject(WorkoutService);
  protected unitService = inject(UnitsService);
  // private sanitizer = inject(DomSanitizer); // Keep if needed for other purposes

  comparisonModalData = signal<TargetComparisonData | null>(null);
  notesModalsData = signal<string | null>(null);
  isExerciseDetailModalOpen = signal(false);
  isSimpleModalOpen = signal(false);
  exerciseDetailsId: string = '';
  exerciseDetailsName: string = '';

  workoutLog = signal<WorkoutLog | null | undefined>(undefined);
  displayExercises = signal<DisplayLoggedExercise[]>([]);

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
        this.displayExercises.set(exercisesWithDetails);
      },
      error: (err) => {
        console.error("Error fetching exercise details for log display:", err);
        // Fallback: display logged exercises without baseExercise details
        this.displayExercises.set(processedExercises.map((le, index) => {
          const warmupSets = le.sets?.filter(s => s.type === 'warmup') || [];
          const workingSets = le.sets?.filter(s => s.type !== 'warmup') || [];
          return {
            ...(le as LoggedWorkoutExercise),
            baseExercise: null,
            // isExpanded: index === 0,
            isExpanded: true,
            showWarmups: warmupSets.length > 0,
            warmupSets: warmupSets,
            workingSets: workingSets,
            iconName: this.exerciseService.determineExerciseIcon(null, le.exerciseName ?? ''),
            // Superset props are already on le
          } as DisplayLoggedExercise;
        }));
      }
    });
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

  checkIfTimedExercise(loggedEx: LoggedWorkoutExercise): boolean {
    return loggedEx.sets.some(set => set.targetDuration);
  }

  checkIfWeightedExercise(loggedEx: LoggedWorkoutExercise): boolean {
    return loggedEx?.sets.some(set => set.targetWeight) || loggedEx?.sets.some(set => set.weightUsed);
  }


  // This function is now fast, synchronous, and safe to call from a template.
  checkTextClass(set: LoggedSet, type: 'reps' | 'duration' | 'weight'): string {
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
   * @param type The metric being checked ('reps', 'duration', 'weight').
   */
  showComparisonModal(set: LoggedSet, type: 'reps' | 'duration' | 'weight'): void {
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
  isTargetMissed(set: LoggedSet, type: 'reps' | 'duration' | 'weight'): boolean {
    if (!set) return false;

    const performed = (type === 'reps' ? set.repsAchieved : type === 'duration' ? set.durationPerformed : set.weightUsed) ?? 0;
    const target = (type === 'reps' ? set.targetReps : type === 'duration' ? set.targetDuration : set.targetWeight) ?? 0;

    return performed < target && target > 0;
  }

  showNotesModal(notes: string): void {
    this.notesModalsData.set(notes);
  }
}