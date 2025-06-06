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
  providers: [DecimalPipe]
})
export class WorkoutLogDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService);
  // private alertService = inject(AlertService); // Remove if not used elsewhere

  workoutLog = signal<WorkoutLog | null | undefined>(undefined);
  displayExercises = signal<DisplayLoggedExercise[]>([]); // Back to original DisplayLoggedExercise

  @Input() logId?: string;

  // Remove isEditMode and editableLogDetails
  // Remove toggleEditMode, toggleSetEdit, saveSetChanges, cancelSetEdit, saveWorkoutLogChanges

  ngOnInit(): void {
    const idSource$ = this.logId ? of(this.logId) : this.route.paramMap.pipe(map(params => params.get('logId')));

    idSource$.pipe(
      switchMap(id => {
        if (id) {
          return this.trackingService.getWorkoutLogById(id);
        }
        return of(null);
      }),
      tap(log => { // Keep tap for initial load
        this.workoutLog.set(log); // No deep copy needed for display only
        if (log) {
          this.prepareDisplayExercises(log.exercises); // Original prepareDisplayExercises
        } else {
          this.displayExercises.set([]);
        }
      })
    ).subscribe();
  }

  // Original prepareDisplayExercises (without editable fields)
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

    if (detailFetchers$.length === 0) {
      this.displayExercises.set(loggedExercises.map(le => ({ ...le, baseExercise: null })));
      return;
    }

    forkJoin(detailFetchers$).subscribe({
      next: (exercisesWithDetails) => {
        this.displayExercises.set(exercisesWithDetails);
      },
      error: (err) => {
        console.error("Error fetching exercise details for log display:", err);
        this.displayExercises.set(loggedExercises.map(le => ({ ...le, baseExercise: null })));
      }
    });
  }

  displayExerciseDetails(id: string): void {
    this.router.navigate(['/library', id]);
  }
}