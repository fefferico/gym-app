// workout-log-detail.ts
import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { Exercise } from '../../../core/models/exercise.model';
import { LoggedWorkoutExercise, WorkoutLog, LoggedSet } from '../../../core/models/workout-log.model';
import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
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
  supersetId?: string;
  supersetOrder?: number;
  supersetSize?: number | null;
  supersetRounds?: number | null;      // Total rounds for THIS superset instance in the log
  supersetCurrentRound?: number | null; // The current round number for THIS exercise entry
}

@Component({
  selector: 'app-workout-log-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, WeightUnitPipe],
  templateUrl: './workout-log-detail.html',
  providers: [DecimalPipe] // DecimalPipe if used directly in template; WeightUnitPipe already handles it
})
export class WorkoutLogDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService);
  // private sanitizer = inject(DomSanitizer); // Keep if needed for other purposes

  workoutLog = signal<WorkoutLog | null | undefined>(undefined);
  displayExercises = signal<DisplayLoggedExercise[]>([]);

  @Input() logId?: string;

  ngOnInit(): void {
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
          isExpanded: index === 0,
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
            isExpanded: index === 0 && (!processedEx.supersetId || (processedEx.supersetId && processedEx.supersetOrder === 0 && (processedEx.supersetCurrentRound === 1 || !processedEx.supersetCurrentRound))),
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
            isExpanded: index === 0,
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
            isExpanded: index === 0,
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
}