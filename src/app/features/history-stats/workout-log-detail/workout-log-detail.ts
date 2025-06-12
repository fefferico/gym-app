// workout-log-detail.ts
import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, TitleCasePipe } from '@angular/common'; // Make sure CommonModule is here
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap, tap, catchError, defaultIfEmpty } from 'rxjs/operators';
import { Exercise } from '../../../core/models/exercise.model';
import { LoggedWorkoutExercise, WorkoutLog, LoggedSet } from '../../../core/models/workout-log.model';
import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'; // Import DomSanitizer

interface DisplayLoggedExercise extends LoggedWorkoutExercise {
  baseExercise?: Exercise | null;
  isExpanded?: boolean;
  showWarmups?: boolean;
  warmupSets?: LoggedSet[];
  workingSets?: LoggedSet[];
  iconName?: string; // To store the determined icon name
}

@Component({
  selector: 'app-workout-log-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, WeightUnitPipe],
  templateUrl: './workout-log-detail.html',
  providers: [DecimalPipe]
})
export class WorkoutLogDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService);
  private sanitizer = inject(DomSanitizer); // Inject DomSanitizer

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
        return of(null);
      }),
      tap(log => {
        this.workoutLog.set(log);
        if (log && log.exercises) {
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

    const detailFetchers$: Observable<DisplayLoggedExercise>[] = loggedExercises.map((loggedEx, index) =>
      this.exerciseService.getExerciseById(loggedEx.exerciseId).pipe(
        map(baseEx => { // baseEx here is Exercise | undefined
          const warmupSets = loggedEx.sets.filter(s => s.type === 'warmup');
          const workingSets = loggedEx.sets.filter(s => s.type !== 'warmup');
          const exerciseForIcon = baseEx || null; // Convert undefined to null

          return {
            ...loggedEx,
            baseExercise: exerciseForIcon, // Use the converted value
            isExpanded: index === 0,
            showWarmups: warmupSets.length > 0,
            warmupSets: warmupSets,
            workingSets: workingSets,
            iconName: this.exerciseService.determineExerciseIcon(exerciseForIcon, loggedEx.exerciseName), // Pass the null-coalesced value
          };
        }),
        catchError(err => {
          console.error(`Error fetching base exercise details for ID ${loggedEx.exerciseId}:`, err);
          const warmupSets = loggedEx.sets.filter(s => s.type === 'warmup');
          const workingSets = loggedEx.sets.filter(s => s.type !== 'warmup');
          // In catchError, baseEx is not available, so pass null directly
          return of({
            ...loggedEx,
            baseExercise: null,
            isExpanded: index === 0,
            showWarmups: warmupSets.length > 0,
            warmupSets: warmupSets,
            workingSets: workingSets,
            iconName: this.exerciseService.determineExerciseIcon(null, loggedEx.exerciseName),
          } as DisplayLoggedExercise);
        }),
        // defaultIfEmpty is tricky here because getExerciseById might emit `undefined` which is a value.
        // If getExerciseById *completes* without emitting (which it shouldn't for a BehaviorSubject-backed observable unless empty initially and not yet seeded),
        // then defaultIfEmpty would kick in.
        // The primary source of `undefined` is the `find()` method in ExerciseService.
        // The `baseEx || null` handles this `undefined` from `find()`.
      )
    );

    forkJoin(detailFetchers$).subscribe({
      next: (exercisesWithDetails) => {
        this.displayExercises.set(exercisesWithDetails);
      },
      error: (err) => {
        console.error("Error fetching exercise details for log display:", err);
        this.displayExercises.set(loggedExercises.map((le, index) => {
          const warmupSets = le.sets.filter(s => s.type === 'warmup');
          const workingSets = le.sets.filter(s => s.type !== 'warmup');
          return {
            ...le,
            baseExercise: null,
            isExpanded: index === 0,
            showWarmups: warmupSets.length > 0,
            warmupSets: warmupSets,
            workingSets: workingSets,
            iconName: this.exerciseService.determineExerciseIcon(null, le.exerciseName), // Pass null here
          };
        }));
      }
    });
  }

  getIconPath(iconName: string | undefined): string {
    return this.exerciseService.getIconPath(iconName);
  }

  toggleExerciseAccordion(exercise: DisplayLoggedExercise): void {
    exercise.isExpanded = !exercise.isExpanded;
  }

  toggleWarmupAccordion(exercise: DisplayLoggedExercise): void {
    exercise.showWarmups = !exercise.showWarmups;
  }

  getDisplaySetLabel(setsOfType: LoggedSet[], currentIndexInType: number): string {
    const currentSet = setsOfType[currentIndexInType];
    const displayIndex = currentIndexInType + 1;
    return currentSet.type === 'warmup' ? `Warm-up ${displayIndex}` : `Set ${displayIndex}`;
  }

  displayExerciseDetails(id: string): void {
    this.router.navigate(['/library', id]);
  }

  
}