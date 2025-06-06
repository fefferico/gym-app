import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, Observable, of, TimeoutError } from 'rxjs'; // Added TimeoutError
import { map, switchMap, tap, catchError, defaultIfEmpty, timeout } from 'rxjs/operators'; // Added timeout
import { Exercise } from '../../../core/models/exercise.model';
import { LoggedWorkoutExercise, WorkoutLog } from '../../../core/models/workout-log.model';
import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';

interface DisplayLoggedExercise extends LoggedWorkoutExercise {
  baseExercise?: Exercise | null;
}

const SERVICE_CALL_TIMEOUT_MS = 10000; // 10 seconds for service call timeout

@Component({
  selector: 'app-workout-log-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, WeightUnitPipe],
  templateUrl: './workout-log-detail.html',
  styleUrl: './workout-log-detail.scss',
  providers: [DecimalPipe]
})
export class WorkoutLogDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService);

  workoutLog = signal<WorkoutLog | null | undefined>(undefined);
  displayExercises = signal<DisplayLoggedExercise[]>([]);

  @Input() logId?: string;

  ngOnInit(): void {
    const idSource$ = this.logId
      ? of(this.logId)
      : this.route.paramMap.pipe(map(params => params.get('logId')));

    idSource$.pipe(
      switchMap(id => {
        if (id) {
          return this.trackingService.getWorkoutLogById(id).pipe(
          );
        }
        return of(null);
      }),
      tap(log => {
        this.workoutLog.set(log);
        if (log && log.exercises && log.exercises.length > 0) {
          this.prepareDisplayExercises(log.exercises);
        } else {
          if (!log) {
          } else if (!log.exercises) {
            console.warn("WorkoutLogDetailComponent: Outer tap - log exists but log.exercises is undefined/null. Setting displayExercises to [].", JSON.parse(JSON.stringify(log)));
          } else if (log.exercises.length === 0) {
          }
          this.displayExercises.set([]);
        }
      })
    ).subscribe({
      error: err => console.error("WorkoutLogDetailComponent: ngOnInit - main subscription error:", err),
    });
  }

  private prepareDisplayExercises(loggedExercises: LoggedWorkoutExercise[]): void {
    // Using JSON.parse(JSON.stringify(...)) for logging complex objects to ensure they are captured at the moment of logging

    if (!loggedExercises || loggedExercises.length === 0) {
      this.displayExercises.set([]);
      return;
    }

    const detailFetchers$: Observable<DisplayLoggedExercise>[] = loggedExercises.map((loggedEx, index) => {
      if (!loggedEx.exerciseId) {
        console.warn(`prepareDisplayExercises: Logged exercise at index ${index} encountered without an exerciseId:`, loggedEx);
        // Still return an observable that emits for forkJoin
        return of({
          ...loggedEx,
          baseExercise: null
        } as DisplayLoggedExercise);
      }

      return this.exerciseService.getExerciseById(loggedEx.exerciseId).pipe(
        // timeout(SERVICE_CALL_TIMEOUT_MS), // Add timeout
        defaultIfEmpty(null as Exercise | null), // Ensure emission even if service completes empty after timeout or normally
        map(baseEx => {
          const result = { ...loggedEx, baseExercise: baseEx };
          return result;
        }),
        catchError(err => {
          if (err instanceof TimeoutError) {
            console.error(`prepareDisplayExercises: TIMEOUT fetching base exercise details for ID ${loggedEx.exerciseId} (index: ${index}) after ${SERVICE_CALL_TIMEOUT_MS}ms.`);
          } else {
            console.error(`prepareDisplayExercises: Error fetching/processing base exercise details for ID ${loggedEx.exerciseId} (index ${index}):`, err);
          }
          // Return a successful observable with baseExercise as null for this specific item
          return of({ ...loggedEx, baseExercise: null } as DisplayLoggedExercise);
        }),
      );
    });

    if (detailFetchers$.length === 0) {
        // This should only happen if loggedExercises was initially empty, handled above.
        // But as a safeguard if logic changes:
        console.warn("prepareDisplayExercises: detailFetchers$ is unexpectedly empty despite loggedExercises having items. Fallback.");
        this.displayExercises.set(loggedExercises.map(le => ({ ...le, baseExercise: null } as DisplayLoggedExercise)));
        return;
    }

    forkJoin(detailFetchers$).subscribe({
      next: (exercisesWithDetails) => {
        this.displayExercises.set(exercisesWithDetails);
      },
      error: (forkJoinError) => {
        console.error("prepareDisplayExercises (forkJoin ERROR): Critical error in forkJoin operation itself:", forkJoinError);
        // Fallback: display exercises without base details if forkJoin fails catastrophically
        this.displayExercises.set(loggedExercises.map(le => ({ ...le, baseExercise: null } as DisplayLoggedExercise)));
      },
      complete: () => {
      }
    });
  }

  displayExerciseDetails(id: string): void {
    this.router.navigate(['/library', id]);
  }
}