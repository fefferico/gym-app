import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // CommonModule for *ngFor, *ngIf, etc. DatePipe for formatting
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { Routine } from '../../core/models/workout.model';
import { WorkoutService } from '../../core/services/workout.service';
// You might want a confirmation dialog service later for delete
// import { ConfirmationDialogService } from '../../shared/services/confirmation-dialog.service';

@Component({
  selector: 'app-routine-list',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe], // Added DatePipe
  templateUrl: './routine-list.html',
  styleUrl: './routine-list.scss',
})
export class RoutineListComponent implements OnInit {
  private workoutService = inject(WorkoutService);
  private router = inject(Router);
  // private confirmationDialogService = inject(ConfirmationDialogService); // For later

  routines$: Observable<Routine[]> | undefined;

  // Example: Add a few dummy routines if none exist for easier UI development
  // You'd remove this in a production app or when you have the builder working.
  private ADD_DUMMY_DATA_IF_EMPTY = true; // Set to false when builder is ready

  ngOnInit(): void {
    this.routines$ = this.workoutService.routines$;

    if (this.ADD_DUMMY_DATA_IF_EMPTY) {
      this.routines$.subscribe(routines => {
        if (routines.length === 0) {
          // this.addDummyRoutines();
        }
      });
    }
  }

  navigateToCreateRoutine(): void {
    this.router.navigate(['/workout/new']);
  }

  editRoutine(routineId: string, event: MouseEvent): void {
    event.stopPropagation(); // Prevent card click if edit is on the card itself
    this.router.navigate(['/workout/edit', routineId]);
  }

  deleteRoutine(routineId: string, event: MouseEvent): void {
    event.stopPropagation(); // Prevent card click

    // Basic confirm for now. Replace with a nice modal dialog later.
    const confirmDelete = confirm('Are you sure you want to delete this routine? This action cannot be undone.');
    if (confirmDelete) {
      this.workoutService.deleteRoutine(routineId);
    }
  }

  startWorkout(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate(['/workout/play', routineId]); // Navigate to player
  }

  viewRoutineDetails(routineId: string): void {
    // If you want a separate detail view before editing or playing.
    // For now, clicking the card might go to edit, or you can implement a dedicated detail view.
    // Let's make card click go to edit for now for simplicity.
    this.router.navigate(['/workout/edit', routineId]);
    console.log('Viewing routine details for ID (or navigating to edit):', routineId);
  }


  // --- DUMMY DATA FUNCTION ---
  // Remove or comment out when WorkoutBuilder is functional
  // private addDummyRoutines(): void {
    // console.log('Adding dummy routines as storage is empty...');
    // const dummyRoutines: Omit<Routine, 'id'>[] = [
      // {
        // name: 'Full Body Strength A',
        // description: 'A balanced full-body workout focusing on compound movements.',
        // goal: 'strength',
        // targetMuscleGroups: ['Full Body'],
        // exercises: [
          // {
            // id: this.workoutService.generateWorkoutExerciseId(),
            // exerciseId: 'barbell-squat', // Assumes this ID exists in your ExerciseLibrary
            // exerciseName: 'Barbell Squat',
            // sets: [
              // { id: this.workoutService.generateExerciseSetId(), reps: 5, weight: 80, restAfterSet: 90 },
              // { id: this.workoutService.generateExerciseSetId(), reps: 5, weight: 80, restAfterSet: 90 },
              // { id: this.workoutService.generateExerciseSetId(), reps: 5, weight: 80, restAfterSet: 120 },
            // ],
          // },
          // {
            // id: this.workoutService.generateWorkoutExerciseId(),
            // exerciseId: 'dumbbell-bench-press',
            // exerciseName: 'Dumbbell Bench Press',
            // sets: [
              // { id: this.workoutService.generateExerciseSetId(), reps: 8, weight: 20, restAfterSet: 75 },
              // { id: this.workoutService.generateExerciseSetId(), reps: 8, weight: 20, restAfterSet: 75 },
              // { id: this.workoutService.generateExerciseSetId(), reps: 8, weight: 20, restAfterSet: 90 },
            // ],
          // },
        // ],
        // lastPerformed: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      // },
      // {
        // name: 'Upper Body Hypertrophy',
        // description: 'Focus on chest, back, and shoulders for muscle growth.',
        // goal: 'hypertrophy',
        // targetMuscleGroups: ['Upper Body'],
        // exercises: [
          // {
            // id: this.workoutService.generateWorkoutExerciseId(),
            // exerciseId: 'pull-up',
            // exerciseName: 'Pull-up',
            // sets: [
              // { id: this.workoutService.generateExerciseSetId(), reps: 10, restAfterSet: 60 },
              // { id: this.workoutService.generateExerciseSetId(), reps: 10, restAfterSet: 60 },
              // { id: this.workoutService.generateExerciseSetId(), reps: 8, restAfterSet: 75 },
            // ],
          // },
        // ],
      // },
    // ];
// 
    // dummyRoutines.forEach(routineData => {
      // this.workoutService.addRoutine(routineData);
    // });
  // }
  // --- END DUMMY DATA ---
}