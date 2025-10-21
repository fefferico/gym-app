import { Component, inject, Input, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { map, switchMap, tap, take } from 'rxjs/operators';
import { Exercise } from '../../../core/models/exercise.model';
import { LoggedWorkoutExercise, PersonalBestSet, WorkoutLog } from '../../../core/models/workout-log.model';
import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { StatsService } from '../../../core/services/stats.service';
import { UnitsService } from '../../../core/services/units.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { PressDirective } from '../../../shared/directives/press.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PerceivedEffortModalComponent, PerceivedWorkoutInfo } from '../perceived-effort-modal.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';


interface DisplayLoggedExerciseSummary extends LoggedWorkoutExercise {
  baseExercise?: Exercise | null;
  sessionVolume?: number;
}

interface SessionPbInfo {
  exerciseName: string;
  pbType: string;
  value: string; // Formatted PB value
  isNewOrImproved: boolean; // True if this PB was set/broken in *this* session
}

@Component({
  selector: 'app-workout-summary',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, PressDirective, IconComponent, PerceivedEffortModalComponent, TranslateModule],
  templateUrl: './workout-summary.html',
  styleUrl: './workout-summary.scss',
})
export class WorkoutSummaryComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService);
  private statsService = inject(StatsService); // For volume
  protected unitsService = inject(UnitsService); // Use 'protected' for direct template access
  private translate = inject(TranslateService);

  workoutLog = signal<WorkoutLog | null | undefined>(undefined);
  displayExercisesSummary = signal<DisplayLoggedExerciseSummary[]>([]);
  sessionPBs = signal<SessionPbInfo[]>([]);
  sessionTotalVolume = signal<number>(0);

  @Input() logId?: string; // For route param binding (if component input binding is on)

  isEffortModalVisible = signal(false);


  ngOnInit(): void {
    const idSource$ = this.logId ? of(this.logId) : this.route.paramMap.pipe(map(params => params.get('logId')));

    idSource$.pipe(
      switchMap(id => id ? this.trackingService.getWorkoutLogById(id) : of(null)),
      tap(log => {
        if (log) {
          this.workoutLog.set(log);
          this.sessionTotalVolume.set(this.statsService.calculateWorkoutVolume(log));
          this.prepareDisplayExercisesSummary(log.exercises);
          this.identifySessionPBs(log);
          // --- NEW LOGIC TO TRIGGER MODAL ---
          this.checkForNewlyCompletedWorkout(log);
        } else {
          this.workoutLog.set(null);
          this.displayExercisesSummary.set([]);
          this.sessionPBs.set([]);
        }
      })
    ).subscribe();
  }

  private checkForNewlyCompletedWorkout(log: WorkoutLog): void {
    this.route.queryParamMap.pipe(take(1)).subscribe(params => {
      // Show modal if the param exists AND the workout hasn't been rated yet.
      if (params.get('newlyCompleted') === 'true' && !log.hasOwnProperty('perceivedWorkoutInfo')) {
        this.isEffortModalVisible.set(true);
      }
    });
  }

  handleEffortModalClose(perceivedInfo: PerceivedWorkoutInfo | null): void {
    this.isEffortModalVisible.set(false);
    const currentLog = this.workoutLog();

    // Clean the URL by removing the query parameter
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { newlyCompleted: null },
      queryParamsHandling: 'merge', // Keeps other params, removes null ones
      replaceUrl: true // Avoids adding a new entry to browser history
    });

    if (perceivedInfo !== null && currentLog) {
      this.trackingService.updatePerceivedWorkoutInfo(currentLog.id, perceivedInfo).subscribe({
        next: () => {
          // Update the local state instantly for immediate UI feedback
          this.workoutLog.update(log => ({ ...log!, perceivedWorkoutInfo: perceivedInfo }));
          console.log(this.translate.instant('workoutSummary.toasts.effortSaved'));
        },
        error: (err) => console.error(this.translate.instant('workoutSummary.toasts.effortSaveFailed'), err),
      });
    }
  }

  private prepareDisplayExercisesSummary(loggedExercises: LoggedWorkoutExercise[]): void {
    if (!loggedExercises || loggedExercises.length === 0) {
      this.displayExercisesSummary.set([]);
      return;
    }

    const detailFetchers$: Observable<DisplayLoggedExerciseSummary>[] = loggedExercises.map(loggedEx =>
      this.exerciseService.getExerciseById(loggedEx.exerciseId).pipe(
        map(baseEx => {
          let exerciseVolume = 0;
          loggedEx.sets.forEach(set => {
            exerciseVolume += (set.repsLogged || 0) * (set.weightLogged || 0);
          });
          return {
            ...loggedEx,
            baseExercise: baseEx || null,
            sessionVolume: exerciseVolume
          };
        })
      )
    );

    forkJoin(detailFetchers$).subscribe({
      next: (exercisesWithDetails) => this.displayExercisesSummary.set(exercisesWithDetails),
      error: (err) => {
        console.error("Error fetching exercise details for summary:", err);
        this.displayExercisesSummary.set(loggedExercises.map(le => ({ ...le, baseExercise: null, sessionVolume: 0 })));
      }
    });
  }

  private identifySessionPBs(currentLog: WorkoutLog): void {
    const achievedPBs: SessionPbInfo[] = [];
    // We need to get the PBs *as they were just updated by this log*
    // So we fetch all current PBs from TrackingService.
    this.trackingService.personalBests$.pipe(take(1)).subscribe(allPBs => {
      currentLog.exercises.forEach(loggedEx => {
        const exercisePBsList = allPBs[loggedEx.exerciseId];
        if (exercisePBsList) {
          loggedEx.sets.forEach(performedSet => {
            exercisePBsList.forEach(pb => {
              // A PB is "from this session" if its timestamp matches a set in this log,
              // OR if its details (weight/reps for that pbType) match exactly a set in this log,
              // AND its timestamp is within the workout session time.
              // Simpler: check if the PB's defining set matches one from this log.
              // The `id` of a LoggedSet in a PB record *is* the id of the set that achieved it.
              if (pb.id === performedSet.id && // The set ID in PB matches this performed set ID
                pb.timestamp === performedSet.timestamp && // And timestamp matches
                performedSet.weightLogged === pb.weightLogged && // And values match
                performedSet.repsLogged === pb.repsLogged) {

                achievedPBs.push({
                  exerciseName: loggedEx.exerciseName,
                  pbType: pb.pbType,
                  value: this.formatPbValueForSummary(pb),
                  isNewOrImproved: true // Assuming all PBs shown here are "new" for this session summary
                });
              }
            });
          });
        }
      });
      // Deduplicate PBs by type for the same exercise if multiple sets hit same PB type
      const uniqueSessionPBs = Array.from(new Map(achievedPBs.map(item => [`${item.exerciseName}-${item.pbType}`, item])).values());
      this.sessionPBs.set(uniqueSessionPBs);
    });
  }

  formatPbValueForSummary(pb: PersonalBestSet): string {
    let value = '';
    if (pb.weightLogged !== undefined && pb.weightLogged !== null && pb.weightLogged !== 0) {
      value += `${pb.weightLogged}${this.unitsService.getWeightUnitSuffix()}`;
      if (pb.repsLogged && (pb.pbType.includes('Heaviest') || pb.repsLogged > 1 && !pb.pbType.includes('RM'))) {
        value += ` x ${pb.repsLogged}`;
      }
    } else if (pb.repsLogged && pb.pbType.includes('Max Reps')) {
      value = `${pb.repsLogged} ${this.translate.instant('workoutSummary.units.reps')}`;
    } else if (pb.durationLogged && pb.durationLogged > 0 && pb.pbType.includes('Max Duration')) {
      value = `${pb.durationLogged}${this.translate.instant('workoutSummary.units.seconds')}`;
    }
    return value || 'N/A';
  }

  viewFullLog(): void {
    if (this.workoutLog()) {
      this.router.navigate(['/history/log', this.workoutLog()!.id]);
    }
  }

  navigateToRoutines(): void {
    this.router.navigate(['/workout']);
  }

  startNewWorkout(): void {
    // Could navigate to routine list or directly to a "quick start" if you implement that
    this.router.navigate(['/workout']);
  }
}