// src/app/features/home/home.component.ts
import { Component, OnInit, PLATFORM_ID, inject, signal, effect, computed } from '@angular/core'; // Added effect
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common'; // Added DatePipe
import { Router, RouterLink } from '@angular/router';
import { TodaysWorkoutComponent } from '../../dashboard/todays-workout/todays-workout';
import { StorageService } from '../../../core/services/storage.service';
import { AlertService } from '../../../core/services/alert.service';
import { ToastService } from '../../../core/services/toast.service';
import { WorkoutService } from '../../../core/services/workout.service';
import { PausedWorkoutState } from '../../workout-tracker/workout-player';
import { UserProfileService } from '../../../core/services/user-profile.service';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, TodaysWorkoutComponent, DatePipe], // Added DatePipe
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private storageService = inject(StorageService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private toastService = inject(ToastService);
  private workoutService = inject(WorkoutService); // For fetching routine name if only ID is in paused state
  private userProfileService = inject(UserProfileService); // Inject UserProfileService

  userName = computed(() => this.userProfileService.username() || 'Fitness Enthusiast');


  // Signal to hold information about a paused/active workout
  pausedWorkoutInfo = signal<PausedWorkoutState | null>(null);
  pausedRoutineName = signal<string>('your workout'); // Default name

  constructor() {
    // Effect to update pausedRoutineName when pausedWorkoutInfo changes
    effect(() => {
      const pausedInfo = this.pausedWorkoutInfo();
      if (pausedInfo && pausedInfo.sessionRoutine && pausedInfo.sessionRoutine.name) {
        this.pausedRoutineName.set(pausedInfo.sessionRoutine.name);
      } else if (pausedInfo && pausedInfo.routineId) {
        // Fallback if sessionRoutine.name is not directly available in PausedWorkoutState
        // This might happen if PausedWorkoutState doesn't store the full Routine object
        // or if it's an ad-hoc workout without a saved routine.
        // For now, we assume sessionRoutine.name is usually present.
        // If not, you might need to fetch from WorkoutService using pausedInfo.routineId
        // This is a simplified example for now.
        this.workoutService.getRoutineById(pausedInfo.routineId).subscribe(routine => {
          if (routine) this.pausedRoutineName.set(routine.name);
          else this.pausedRoutineName.set('your workout');
        })
      } else {
        this.pausedRoutineName.set('your workout');
      }
    });
    this.userProfileService.showWipDisclaimer();
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
      this.checkPausedWorkout();
    }
  }

  checkPausedWorkout(): void {
    if (isPlatformBrowser(this.platformId)) {
      const pausedState = this.storageService.getItem<PausedWorkoutState>('fitTrackPro_pausedWorkoutState'); // Use the correct key
      this.pausedWorkoutInfo.set(pausedState);
    }
  }

  resumePausedWorkout(): void {
    const pausedInfo = this.pausedWorkoutInfo();
    if (pausedInfo) {
      // Set the pausedWorkoutInfo to null immediately on the Home page
      // so the "paused workout" card disappears, giving immediate feedback.
      // The WorkoutPlayerComponent will handle the actual resume or re-display
      // if the user cancels the resume prompt there (though with auto-resume, this is less likely).
      // Note: The actual removal from localStorage will happen in WorkoutPlayerComponent
      // after successful resume or if the user discards it there.
      // This just updates the Home page's local view.
      // this.pausedWorkoutInfo.set(null); // Optional: immediate UI feedback on Home

      if (pausedInfo.routineId) {
        console.log(`HomeComponent: Resuming paused workout for routineId: ${pausedInfo.routineId}`);
        this.router.navigate(['/workout/play', pausedInfo.routineId], { queryParams: { resume: 'true' } });
      } else {
        // Ad-hoc workout (no routineId in paused state)
        console.log('HomeComponent: Resuming ad-hoc paused workout.');
        this.router.navigate(['/workout/play'], { queryParams: { resume: 'true' } });
      }
    } else {
      this.toastService.warning("No paused workout found to resume.", 3000);
    }
  }

  async discardPausedWorkout(): Promise<void> {
    const confirm = await this.alertService.showConfirm(
      'Discard Paused Workout?',
      'Are you sure you want to discard this paused workout session? This action cannot be undone.',
      'Discard', 'Cancel'
    );
    if (confirm && confirm.data) {
      if (isPlatformBrowser(this.platformId)) {
        this.storageService.removeItem('fitTrackPro_pausedWorkoutState');
        this.pausedWorkoutInfo.set(null);
        this.toastService.info('Paused workout session discarded.', 3000);
      }
    }
  }

  viewPausedSummary(): void {
    // This is a bit tricky because PausedWorkoutState has the *in-progress* log.
    // A full summary usually means a *completed* log.
    // For now, let's just navigate to the player, which will then offer to resume.
    // Or, you could show a modal with some basic info from pausedWorkoutInfo.
    const pausedInfo = this.pausedWorkoutInfo();
    if (pausedInfo) {
      const routineName = pausedInfo.sessionRoutine?.name || 'Ad-hoc Workout';
      const exercisesDone = pausedInfo.currentWorkoutLogExercises.length;
      const setsDone = pausedInfo.currentWorkoutLogExercises.reduce((acc, ex) => acc + ex.sets.length, 0);
      const timeElapsed = new Date(pausedInfo.sessionTimerElapsedSecondsBeforePause * 1000).toISOString().slice(11, 19);

      this.alertService.showAlert(
        `Paused: ${routineName}`,
        `You have ${exercisesDone} exercise(s) with ${setsDone} set(s) logged.
             Elapsed time: ${timeElapsed}.
             Resume the workout to see full details or to complete it.`
      );
    }
  }
}