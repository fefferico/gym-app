import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Exercise } from '../../../core/models/exercise.model';
import { LoggedWorkoutExercise, WorkoutLog } from '../../../core/models/workout-log.model';
import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';

interface DisplayLoggedExercise extends LoggedWorkoutExercise {
  baseExercise?: Exercise | null; // To hold image, category etc.
}

@Component({
  selector: 'app-workout-log-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, WeightUnitPipe],
  templateUrl: './workout-log-detail.html',
  styleUrl: './workout-log-detail.scss',
})
export class WorkoutLogDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService); // Inject

  workoutLog = signal<WorkoutLog | null | undefined>(undefined); // undefined: loading, null: not found
  displayExercises = signal<DisplayLoggedExercise[]>([]);

  @Input() logId?: string; // For route param binding

  ngOnInit(): void {
    const idSource$ = this.logId ? of(this.logId) : this.route.paramMap.pipe(map(params => params.get('logId')));

    idSource$.pipe(
      switchMap(id => {
        if (id) {
          return this.trackingService.getWorkoutLogById(id);
        }
        return of(null);
      }),
      tap(log => {
        this.workoutLog.set(log);
        if (log) {
          this.prepareDisplayExercises(log.exercises);
        } else {
          this.displayExercises.set([]);
        }
      })
    ).subscribe();
  }

  private prepareDisplayExercises(loggedExercises: LoggedWorkoutExercise[]): void {
  if (!loggedExercises || loggedExercises.length === 0) {
    this.displayExercises.set([]);
    return;
  }

  const detailFetchers$: Observable<DisplayLoggedExercise>[] = loggedExercises.map(loggedEx =>
    this.exerciseService.getExerciseById(loggedEx.exerciseId).pipe(
      map(baseEx => ({
        ...loggedEx,
        baseExercise: baseEx || null
      }))
    )
  );

  if (detailFetchers$.length === 0) { // Should not happen if loggedExercises wasn't empty but good check
      this.displayExercises.set(loggedExercises.map(le => ({...le, baseExercise: null })));
      return;
  }

  forkJoin(detailFetchers$).subscribe({
    next: (exercisesWithDetails) => {
      this.displayExercises.set(exercisesWithDetails);
    },
    error: (err) => {
      console.error("Error fetching exercise details for log display:", err);
      // Fallback: display logged exercises without baseExercise details
      this.displayExercises.set(loggedExercises.map(le => ({ ...le, baseExercise: null })));
    }
  });
}

  displayExerciseDetails(id:string): void {
    this.router.navigate(['/library',id]);
  }
}