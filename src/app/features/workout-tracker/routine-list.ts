// src/app/features/workout-routines/routine-list/routine-list.component.ts
import { Component, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router'; // Added RouterLink
import { firstValueFrom, Observable, take } from 'rxjs';
import { Routine } from '../../core/models/workout.model';
import { WorkoutService } from '../../core/services/workout.service';
import { AlertService } from '../../core/services/alert.service';
import { SpinnerService } from '../../core/services/spinner.service';
import { TrackingService } from '../../core/services/tracking.service';
import { ToastService } from '../../core/services/toast.service';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { StorageService } from '../../core/services/storage.service'; // Import StorageService
import { AlertButton } from '../../core/models/alert.model'; // Import AlertButton for custom dialogs
import { format } from 'date-fns'; // For formatting date in dialog
import { PausedWorkoutState } from './workout-player';

@Component({
  selector: 'app-routine-list',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, RouterLink], // Added RouterLink
  templateUrl: './routine-list.html',
  styleUrl: './routine-list.scss',
  animations: [
    trigger('slideInOutActions', [
      state('void', style({
        height: '0px',
        opacity: 0,
        overflow: 'hidden',
        paddingTop: '0',
        paddingBottom: '0',
        marginTop: '0',
        marginBottom: '0'
      })),
      state('*', style({
        height: '*',
        opacity: 1,
        overflow: 'hidden',
        paddingTop: '0.5rem', // Tailwind's p-2
        paddingBottom: '0.5rem' // Tailwind's p-2
      })),
      transition('void <=> *', animate('200ms ease-in-out'))
    ])
  ]
})
export class RoutineListComponent implements OnInit {
  private workoutService = inject(WorkoutService);
  private trackingService = inject(TrackingService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private spinnerService = inject(SpinnerService);
  private toastService = inject(ToastService);
  private storageService = inject(StorageService); // Inject StorageService
  private platformId = inject(PLATFORM_ID);

  routines$: Observable<Routine[]> | undefined;
  visibleActionsRutineId = signal<string | null>(null);

  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';


  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }
    this.routines$ = this.workoutService.routines$;
  }

  navigateToCreateRoutine(): void {
    this.router.navigate(['/workout/new']);
  }

  editRoutine(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate(['/workout/edit', routineId]);
    this.visibleActionsRutineId.set(null);
  }

  async deleteRoutine(routineId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.visibleActionsRutineId.set(null); // Hide actions first

    const routineToDelete = await firstValueFrom(this.workoutService.getRoutineById(routineId).pipe(take(1)));
    if (!routineToDelete) {
      this.toastService.error("Routine not found for deletion.", 0, "Error");
      return;
    }

    const associatedLogs = await firstValueFrom(this.trackingService.getWorkoutLogsByRoutineId(routineId).pipe(take(1))) || [];

    let confirmationMessage = `Are you sure you want to delete the routine "${routineToDelete.name}"?`;
    if (associatedLogs.length > 0) {
      confirmationMessage += ` This will also delete ${associatedLogs.length} associated workout log(s). This action cannot be undone.`;
    }

    const confirm = await this.alertService.showConfirm(
      'Delete Routine',
      confirmationMessage,
      'Delete', // confirmButtonText
    );

    if (confirm && confirm.data) {
      try {
        this.spinnerService.show();
        // Delete associated logs first
        if (associatedLogs.length > 0) {
          // Assuming clearWorkoutLogsByRoutineId in TrackingService handles its own confirmation/toast for logs.
          // Or if it's just a direct clear, then this toast is fine.
          await this.trackingService.clearWorkoutLogsByRoutineId(routineId);
          // this.toastService.info(`${associatedLogs.length} workout log(s) deleted.`, 3000, "Logs Cleared"); // May be redundant if service toasts
        }
        // Then delete the routine
        // workoutService.deleteRoutine is not async, but if it were, await it.
        this.workoutService.deleteRoutine(routineId); // This was not awaited before, should be if it's async
        this.toastService.success(`Routine "${routineToDelete.name}" deleted successfully.`, 4000, "Routine Deleted");
      } catch (error) {
        console.error("Error during deletion:", error);
        this.toastService.error("Failed to delete routine or its logs. Please try again.", 0, "Deletion Failed");
      } finally {
        this.spinnerService.hide();
      }
    }
  }

  async startWorkout(newRoutineId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.visibleActionsRutineId.set(null);

    if (!isPlatformBrowser(this.platformId)) {
      // Should not happen if button is only clickable in browser, but as a safeguard
      this.router.navigate(['/workout/play', newRoutineId]);
      return;
    }

    const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);

    if (pausedState) {
      const pausedRoutineName = pausedState.sessionRoutine?.name || 'a previous session';
      const pausedDate = pausedState.workoutDate ? ` from ${format(new Date(pausedState.workoutDate), 'MMM d, HH:mm')}` : '';

      const buttons: AlertButton[] = [
        { text: 'Cancel', role: 'cancel', data: 'cancel' },
        {
          text: 'Discard Paused & Start New',
          role: 'confirm',
          data: 'discard_start_new',
          cssClass: 'bg-red-500 hover:bg-red-600 text-white'
        },
        {
          text: `Resume: ${pausedRoutineName.substring(0,15)}${pausedRoutineName.length > 15 ? '...' : ''}`,
          role: 'confirm',
          data: 'resume_paused',
          cssClass: 'bg-green-500 hover:bg-green-600 text-white'
        },
      ];

      const confirmation = await this.alertService.showConfirmationDialog(
        'Workout in Progress',
        `You have a paused workout ("${pausedRoutineName}"${pausedDate}). What would you like to do?`,
        buttons
      );

      if (confirmation && confirmation.data === 'resume_paused') {
        // Navigate to player, player's ngOnInit will handle resume logic using stored state
        // Pass the specific routine ID of the paused session if available,
        // otherwise, the player will load the generic paused state.
        const targetRoutineId = pausedState.routineId || 'ad-hoc'; // Need a way to signal ad-hoc if no ID
        if (pausedState.routineId) {
            this.router.navigate(['/workout/play', pausedState.routineId], { queryParams: { resume: 'true' } });
        } else {
            this.router.navigate(['/workout/play'], { queryParams: { resume: 'true' } }); // For ad-hoc
        }
      } else if (confirmation && confirmation.data === 'discard_start_new') {
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        this.toastService.info('Previous paused workout discarded.', 3000);
        this.router.navigate(['/workout/play', newRoutineId]);
      } else {
        // User cancelled or closed dialog, do nothing
        this.toastService.info('Starting new workout cancelled.', 2000);
      }
    } else {
      // No paused session, proceed to start the new workout
      this.router.navigate(['/workout/play', newRoutineId]);
    }
  }

  viewRoutineDetails(routineId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/workout/view', routineId]);
    this.visibleActionsRutineId.set(null);
  }

  toggleActions(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.visibleActionsRutineId.update(current => (current === routineId ? null : routineId));
  }

  areActionsVisible(routineId: string): boolean {
    return this.visibleActionsRutineId() === routineId;
  }
}
