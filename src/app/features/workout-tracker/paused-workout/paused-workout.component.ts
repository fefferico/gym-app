// src/app/layout/paused-workout/paused-workout.component.ts

import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PressDirective } from '../../../shared/directives/press.directive';
import { WorkoutService } from '../../../core/services/workout.service';
import { AlertService } from '../../../core/services/alert.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-paused-workout',
  standalone: true,
  imports: [CommonModule, IconComponent, PressDirective, TranslateModule],
  templateUrl: './paused-workout.component.html',
  styleUrls: ['./paused-workout.component.scss']
})
export class PausedWorkoutComponent implements OnInit {
  // Make the workout service public to use its methods directly in the template
  public workoutService = inject(WorkoutService);
  private alertService = inject(AlertService);
  protected translate = inject(TranslateService);

  // Signal to hold the name of the paused routine for display
  pausedRoutineName = signal<string>('');

  ngOnInit(): void {
    this.pausedRoutineName.set(this.translate.instant('pausedWorkout.newSession'));
    // When the component loads, check for a paused session and get its name
    this.getPausedRoutineInfo();
  }

  /**
   * Retrieves the paused session state and finds the corresponding
   * routine name to display in the banner.
   */
  private getPausedRoutineInfo(): void {
    const pausedState = this.workoutService.getPausedSession();
    if (pausedState && pausedState.routineId) {
      const routine = this.workoutService.getRoutineByIdSync(pausedState.routineId);
      if (routine) {
        this.pausedRoutineName.set(routine.name);
      }
    }
  }

  /**
   * Resumes the paused workout by navigating to the correct player.
   * The navigateToPlayer method already contains the logic to handle resumption.
   */
  resumeWorkout(): void {
    // We can pass any routineId; the service will detect the paused session and override it.
    this.workoutService.navigateToPlayer('', { forceNavigation: true });
  }

  /**
   * Asks for confirmation and then discards the paused workout session.
   */
  async discardWorkout(): Promise<void> {
    const confirmation = await this.alertService.showConfirm(
      this.translate.instant('pausedWorkout.discardTitle'),
      this.translate.instant('pausedWorkout.discardMessage'),
      this.translate.instant('pausedWorkout.discardButton')
    );

    if (confirmation && confirmation.data) {
      this.workoutService.removePausedWorkout();
    }
  }
}