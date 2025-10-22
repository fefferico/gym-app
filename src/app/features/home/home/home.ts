// src/app/features/home/home.component.ts
import { Component, OnInit, PLATFORM_ID, inject, signal, effect, computed, OnDestroy } from '@angular/core'; // Added effect
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common'; // Added DatePipe
import { Router } from '@angular/router';
import { TodaysWorkoutComponent } from '../../dashboard/todays-workout/todays-workout';
import { StorageService } from '../../../core/services/storage.service';
import { AlertService } from '../../../core/services/alert.service';
import { ToastService } from '../../../core/services/toast.service';
import { WorkoutService } from '../../../core/services/workout.service';
import { UserProfileService } from '../../../core/services/user-profile.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AlertButton } from '../../../core/models/alert.model';
import { Subscription } from 'rxjs';
import { PausedWorkoutState, WorkoutExercise } from '../../../core/models/workout.model';
import { SubscriptionService } from '../../../core/services/subscription.service';
import { BarbellCalculatorModalComponent } from '../../../shared/components/barbell-calculator-modal/barbell-calculator-modal.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BumpClickDirective } from '../../../shared/directives/bump-click.directive';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, TodaysWorkoutComponent, IconComponent, BarbellCalculatorModalComponent, TranslateModule, BumpClickDirective], // Added DatePipe
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private storageService = inject(StorageService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private toastService = inject(ToastService);
  private workoutService = inject(WorkoutService); // For fetching routine name if only ID is in paused state
  private userProfileService = inject(UserProfileService); // Inject UserProfileService
  protected subscriptionService = inject(SubscriptionService);
  private translate = inject(TranslateService);

  userName = computed(() => this.userProfileService.username() || this.translate.instant('user.defaultName'));

  // Signal to hold information about a paused/active workout
  pausedWorkoutInfo = signal<PausedWorkoutState | null>(null);
  pausedRoutineName = signal<string>(this.translate.instant('pausedWorkout.defaultRoutineName')); // Default name
  pausedProgramName = signal<string>(''); // Default name

  private subscriptions = new Subscription(); // To manage subscriptions

  constructor() {
    // Effect to update pausedRoutineName when pausedWorkoutInfo changes
    effect(() => {
      const pausedInfo = this.pausedWorkoutInfo();
      this.pausedProgramName.set(pausedInfo?.programName || '');
      if (pausedInfo && pausedInfo.sessionRoutine && pausedInfo.sessionRoutine.name) {
        this.pausedRoutineName.set(pausedInfo.sessionRoutine.name);
      } else if (pausedInfo && pausedInfo.routineId) {
        // Fallback if sessionRoutine.name is not directly available in PausedWorkoutState
        this.workoutService.getRoutineById(pausedInfo.routineId).subscribe(routine => {
          if (routine) this.pausedRoutineName.set(routine.name);
          else this.pausedRoutineName.set(this.translate.instant('pausedWorkout.fallbackRoutineName'));
        })
      } else {
        this.pausedRoutineName.set(this.translate.instant('pausedWorkout.fallbackRoutineName'));
      }
    });
    this.userProfileService.showWipDisclaimer();
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
      this.checkPausedWorkout();

      // --- NEW: Subscribe to pausedWorkoutDiscarded$ event ---
      this.subscriptions.add(
        this.workoutService.pausedWorkoutDiscarded$.subscribe(() => {
          this.pausedWorkoutInfo.set(null); // Clear the paused workout info
        })
      );
      // --- END NEW ---
    }
  }


  checkPausedWorkout(): void {
    if (isPlatformBrowser(this.platformId)) {
      const pausedState = this.workoutService.getPausedSession();
      this.pausedWorkoutInfo.set(pausedState);
    }
  }

  resumePausedWorkout(): void {
    const pausedInfo = this.pausedWorkoutInfo();
    if (pausedInfo) {
      this.workoutService.vibrate();
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
        this.workoutService.navigateToPlayer(pausedInfo.routineId, { queryParams: { resume: 'true' }, forceNavigation: true });
      } else {
        const playerRoute = this.workoutService.checkPlayerMode('');
        console.log('HomeComponent: Resuming ad-hoc paused workout.');
        this.workoutService.navigateToPlayer('', { queryParams: { resume: 'true' } });
      }
    } else {
      this.toastService.warning(this.translate.instant('pausedWorkout.noPausedWorkoutFound'), 3000);
    }
  }

  async discardPausedWorkout(): Promise<void> {
    this.workoutService.vibrate();

    const buttons: AlertButton[] = [
      { text: this.translate.instant('common.cancel'), role: 'cancel', data: false, icon: 'cancel' },
      { text: this.translate.instant('common.discard'), role: 'confirm', data: true, cssClass: 'bg-red-500 hover:bg-red-600 text-white', icon: 'trash' },
    ];

    const confirm = await this.alertService.showConfirmationDialog(
      this.translate.instant('pausedWorkout.discardPromptTitle'),
      this.translate.instant('pausedWorkout.discardPromptMessage'),
      buttons
    );
    if (confirm && confirm.data) {
      if (isPlatformBrowser(this.platformId)) {
        this.workoutService.removePausedWorkout();
        // The subscription above will now handle setting pausedWorkoutInfo.set(null);
        // this.toastService.info(this.translate.instant('pausedWorkout.sessionDiscarded'), 3000);
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
      this.workoutService.vibrate();
      const routineName = pausedInfo.sessionRoutine?.name || this.translate.instant('pausedWorkout.adHocWorkout');
      const exercisesAvailable = pausedInfo.sessionRoutine && pausedInfo.sessionRoutine.exercises ? pausedInfo.sessionRoutine.exercises.length : 0;
      const exercisesDone = pausedInfo.currentWorkoutLogExercises?.length || 0;
      const setsDone = pausedInfo.currentWorkoutLogExercises?.reduce((acc, ex) => acc + ex.sets.length, 0);
      const targetSets = pausedInfo.originalWorkoutExercises && pausedInfo.originalWorkoutExercises['exercises'] ? pausedInfo.originalWorkoutExercises['exercises'].reduce((acc: number, ex: WorkoutExercise) => acc + ex.sets.length, 0) : null;
      const timeElapsed = new Date(pausedInfo.sessionTimerElapsedSecondsBeforePause * 1000).toISOString().slice(11, 19);
      const targetSetsInfo = targetSets ? ` out of ${targetSets}` : '';

      this.alertService.showAlert(
        this.translate.instant('pausedWorkout.summaryTitle', { routineName: routineName }),
        this.translate.instant('pausedWorkout.summaryMessage', {
          exercisesDone: exercisesDone,
          exercisesAvailable: exercisesAvailable,
          setsDone: setsDone,
          targetSetsInfo: targetSetsInfo,
          timeElapsed: timeElapsed
        })
      );
    }
  }

  startNewSession(): void {
    this.workoutService.vibrate();
    this.workoutService.navigateToPlayer('-1', { queryParams: { resume: 'true' } });
  }

  navigateToRoutines(): void {
    this.workoutService.vibrate();
    this.router.navigate(['/workout']);
  }

  navigateToPrograms(): void {
    this.workoutService.vibrate();
    if (!this.subscriptionService.isPremium()) {
      this.subscriptionService.showUpgradeModal();
      return;
    } else {
      this.router.navigate(['/training-programs']);
    }
  }

  navigateToHistory(): void {
    this.workoutService.vibrate();
    this.router.navigate(['/history']);
  }

  navigateToProfile(): void {
    this.workoutService.vibrate();
    this.router.navigate(['/profile']);
  }

  // +++ ADD THIS NEW NAVIGATION METHOD +++
  navigateToLogActivity(): void {
    this.workoutService.vibrate();
    if (!this.subscriptionService.isPremium()) {
      this.subscriptionService.showUpgradeModal();
      return;
    } else {
      this.router.navigate(['/activities/log']);
    }
  }


  navigateToPersonalGym(): void {
    this.workoutService.vibrate();
    if (!this.subscriptionService.isPremium()) {
      this.subscriptionService.showUpgradeModal();
      return;
    } else {
      this.router.navigate(['/personal-gym']);
    }
  }

  getVersion(): string {
    return this.storageService.getVersion();
  }


  isCalculatorModalVisible: boolean = false;
  openCalculatorModal(): void {
    this.isCalculatorModalVisible = true;
  }

  closeCalculatorModal(): void {
    this.isCalculatorModalVisible = false;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe(); // Unsubscribe to prevent memory leaks
  }
}