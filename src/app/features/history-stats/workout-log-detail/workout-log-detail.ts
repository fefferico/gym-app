import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { Exercise } from '../../../core/models/exercise.model';
import { LoggedWorkoutExercise, WorkoutLog } from '../../../core/models/workout-log.model';
import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';

interface DisplayLoggedExercise extends LoggedWorkoutExercise {
  baseExercise?: Exercise | null; // To hold image, category etc.
}

@Component({
  selector: 'app-workout-log-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe],
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
    const exercisesWithDetails: DisplayLoggedExercise[] = [];
    if (!loggedExercises || loggedExercises.length === 0) {
        this.displayExercises.set([]);
        return;
    }

    let loadedCount = 0;
    loggedExercises.forEach(loggedEx => {
      const displayEx: DisplayLoggedExercise = { ...loggedEx, baseExercise: undefined }; // Start with undefined
      exercisesWithDetails.push(displayEx);

      this.exerciseService.getExerciseById(loggedEx.exerciseId).subscribe(baseEx => {
        displayEx.baseExercise = baseEx || null; // Set to null if not found
        loadedCount++;
        if (loadedCount === loggedExercises.length) {
          this.displayExercises.set([...exercisesWithDetails]); // Update signal once all are processed
        }
      });
    });
     // If there were no exercises with IDs to fetch, set immediately
    if (loggedExercises.length === 0) {
        this.displayExercises.set(exercisesWithDetails);
    }
  }

  displayExerciseDetails(id:string): void {
    this.router.navigate(['/library',id]);
  }
}