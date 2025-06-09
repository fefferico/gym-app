import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common'; // Added TitleCasePipe
import { Router } from '@angular/router';
import { firstValueFrom, Observable, take } from 'rxjs';
import { Routine } from '../../core/models/workout.model';
import { WorkoutService } from '../../core/services/workout.service';
import { AlertService } from '../../core/services/alert.service';
import { SpinnerService } from '../../core/services/spinner.service';
import { TrackingService } from '../../core/services/tracking.service';
import { ToastService } from '../../core/services/toast.service';
import { animate, state, style, transition, trigger } from '@angular/animations';


@Component({
  selector: 'app-routine-list',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe],
  templateUrl: './routine-list.html',
  styleUrl: './routine-list.scss',
  animations: [ // <<<< THIS IS CORRECTLY PLACED
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
        paddingTop: '0.5rem',
        paddingBottom: '0.5rem'
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

  routines$: Observable<Routine[]> | undefined;

  // Signal to track which routine's actions are visible
  // Key: routine.id, Value: boolean (true if actions are visible)
  visibleActionsRutineId = signal<string | null>(null);


  ngOnInit(): void {
    window.scrollTo(0, 0);
    this.routines$ = this.workoutService.routines$;
  }

  navigateToCreateRoutine(): void {
    this.router.navigate(['/workout/new']);
  }

  editRoutine(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate(['/workout/edit', routineId]);
    this.visibleActionsRutineId.set(null); // Hide actions after click
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
                await this.trackingService.clearWorkoutLogsByRoutineId(routineId);
                this.toastService.info(`${associatedLogs.length} workout log(s) deleted.`, 3000, "Logs Cleared");
            }
            // Then delete the routine
            await this.workoutService.deleteRoutine(routineId);
            this.toastService.success(`Routine "${routineToDelete.name}" deleted successfully.`, 4000, "Routine Deleted");
        } catch (error) {
            console.error("Error during deletion:", error);
            this.toastService.error("Failed to delete routine or its logs. Please try again.", 0, "Deletion Failed");
        } finally {
            this.spinnerService.hide();
        }
    }
  }

  startWorkout(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate(['/workout/play', routineId]);
    this.visibleActionsRutineId.set(null); // Hide actions after click
  }

  viewRoutineDetails(routineId: string, event?: MouseEvent): void {
    // If event is passed, it's from a button, so stop propagation.
    // If no event, it's likely the main card click.
    event?.stopPropagation();
    this.router.navigate(['/workout/view', routineId]);
    this.visibleActionsRutineId.set(null); // Hide actions after click
  }

  // Toggle visibility of action buttons for a specific routine
  toggleActions(routineId: string, event: MouseEvent): void {
    event.stopPropagation(); // Prevent card click when opening actions
    if (this.visibleActionsRutineId() === routineId) {
      this.visibleActionsRutineId.set(null); // Hide if already visible
    } else {
      this.visibleActionsRutineId.set(routineId); // Show for this routine
    }
  }

  // Helper to check if actions should be visible for a routine
  areActionsVisible(routineId: string): boolean {
    return this.visibleActionsRutineId() === routineId;
  }

  // Method to handle clicks outside of the action buttons to close them
  // This might require a more global click listener if not careful
  // For simplicity, clicking on the card itself (viewRoutineDetails) will also hide actions.
  // Or, clicking another routine's "more" button.
}