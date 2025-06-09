// src/app/features/training-programs/training-program-list/training-program-list.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { TrainingProgram } from '../../../core/models/training-program.model';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { AlertService } from '../../../core/services/alert.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerService } from '../../../core/services/spinner.service';

@Component({
  selector: 'app-training-program-list',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe],
  templateUrl: './training-program-list.html',
  styleUrls: ['./training-program-list.scss']
})
export class TrainingProgramListComponent implements OnInit {
  private trainingProgramService = inject(TrainingProgramService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private toastService = inject(ToastService);
  private spinnerService = inject(SpinnerService);

  programs$: Observable<TrainingProgram[]> | undefined;

  // Signal to manage dropdown visibility for actions
  activeProgramActions = signal<string | null>(null); // Stores the ID of the program whose actions are visible

  constructor() { }

  ngOnInit(): void {
    window.scrollTo(0, 0);
    this.programs$ = this.trainingProgramService.getAllPrograms();
  }

  navigateToCreateProgram(): void {
    this.router.navigate(['/training-programs/new']);
  }

  viewProgram(programId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/training-programs/view', programId]);
    this.activeProgramActions.set(null);
  }

  editProgram(programId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate(['/training-programs/edit', programId]);
    this.activeProgramActions.set(null);
  }

  async deleteProgram(programId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.activeProgramActions.set(null); // Close dropdown before alert
    // The service method already handles confirmation and toasts
    try {
        this.spinnerService.show("Deleting program...");
        await this.trainingProgramService.deleteProgram(programId);
    } catch (error) {
        console.error("Error initiating program deletion from component:", error);
        this.toastService.error("An unexpected error occurred while trying to delete the program.", 0, "Deletion Error");
    } finally {
        this.spinnerService.hide();
    }
  }

  async toggleActiveProgram(programId: string, currentIsActive: boolean, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.activeProgramActions.set(null);

    if (currentIsActive) {
      // Optionally, confirm deactivation or just allow it.
      // For now, let's assume deactivation doesn't need a separate method if only one can be active.
      // Setting another program active will automatically deactivate this one.
      // Or, if you want a dedicated "deactivate" that leaves no program active:
      // await this.trainingProgramService.deactivateProgram(programId); // You'd need to implement this
      this.toastService.info("To deactivate, set another program as active.", 3000, "Info");
      return;
    }

    try {
      this.spinnerService.show("Activating program...");
      await this.trainingProgramService.setActiveProgram(programId);
      // Toast is handled by the service
    } catch (error) {
      console.error("Error activating program from component:", error);
      this.toastService.error("Failed to activate program.", 0, "Activation Error");
    } finally {
      this.spinnerService.hide();
    }
  }

  toggleActionsDropdown(programId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeProgramActions.update(current => current === programId ? null : programId);
  }

  getDaysScheduled(program: TrainingProgram): string {
    if (!program.schedule || program.schedule.length === 0) return '0 days';
    const uniqueDays = new Set(program.schedule.map(s => s.dayOfWeek));
    const count = uniqueDays.size;
    return `${count} day${count === 1 ? '' : 's'}`;
  }

  getCycleInfo(program: TrainingProgram): string {
    if (program.cycleLength && program.cycleLength > 0) {
      return `${program.cycleLength}-day cycle`;
    }
    return 'Weekly';
  }
}