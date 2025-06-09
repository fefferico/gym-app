// src/app/features/dashboard/todays-workout/todays-workout.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { Routine } from '../../../core/models/workout.model';
import { ScheduledRoutineDay } from '../../../core/models/training-program.model';
import { SpinnerService } from '../../../core/services/spinner.service'; // Optional: for loading state
import { WorkoutService } from '../../../core/services/workout.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-todays-workout',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './todays-workout.html',
  styleUrls: ['./todays-workout.scss']
})
export class TodaysWorkoutComponent implements OnInit {
  private trainingProgramService = inject(TrainingProgramService);
  private workoutService = inject(WorkoutService); // To fetch all routines for fallback
  private router = inject(Router);
  private spinnerService = inject(SpinnerService); // Optional

  isLoading = signal<boolean>(true);
  todaysScheduledWorkout = signal<{ routine: Routine, scheduledDayInfo: ScheduledRoutineDay } | null>(null);
  currentDate = signal<Date>(new Date());

  // For fallback if no scheduled workout
  availableRoutines$: Observable<Routine[]> | undefined;


  ngOnInit(): void {
    this.loadTodaysWorkout();
    this.availableRoutines$ = this.workoutService.routines$;
  }

  loadTodaysWorkout(): void {
    this.isLoading.set(true);
    // this.spinnerService.show("Checking today's schedule..."); // Optional
    this.trainingProgramService.getRoutineForDay(this.currentDate())
      .subscribe({
        next: (data) => {
          this.todaysScheduledWorkout.set(data);
          this.isLoading.set(false);
          // this.spinnerService.hide(); // Optional
        },
        error: (err) => {
          console.error("Error fetching today's scheduled workout:", err);
          this.isLoading.set(false);
          // this.spinnerService.hide(); // Optional
        }
      });
  }

  startWorkout(routineId: string | undefined): void {
    if (routineId) {
      this.router.navigate(['/workout/play', routineId]);
    }
  }

  viewRoutineDetails(routineId: string | undefined): void {
    if (routineId) {
      this.router.navigate(['/workout/view', routineId]);
    }
  }

  // Optional: For navigating to program management
  managePrograms(): void {
    this.router.navigate(['/training-programs']);
  }

  // Optional: For navigating to routine list
  browseRoutines(): void {
    this.router.navigate(['/workout']);
  }

  // Methods to change the displayed date (for testing or if you build a mini-calendar here)
  previousDay(): void {
    this.currentDate.update(d => {
      const newDate = new Date(d);
      newDate.setDate(d.getDate() - 1);
      return newDate;
    });
    this.loadTodaysWorkout();
  }

  nextDay(): void {
    this.currentDate.update(d => {
      const newDate = new Date(d);
      newDate.setDate(d.getDate() + 1);
      return newDate;
    });
    this.loadTodaysWorkout();
  }

  goToToday(): void {
    this.currentDate.set(new Date());
    this.loadTodaysWorkout();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }
}