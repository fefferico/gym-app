// src/app/features/workout-routines/routine-list/generated-workout-summary/generated-workout-summary.component.ts
import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ExerciseOverviewItemComponent } from '../session-overview-modal/app-exercise-overview-item/app-exercise-overview-item.component';
import { Routine, WorkoutExercise } from '../../../core/models/workout.model';
import { GeneratedExerciseItemComponent } from './generated-exercise-item/generated-exercise-item.component';

// Interfaces for structured data
interface StandardExerciseGroup {
  type: 'standard';
  exercise: WorkoutExercise;
}
interface SupersetGroup {
  type: 'superset';
  exercises: WorkoutExercise[];
  supersetId: string;
}
type DisplayGroup = StandardExerciseGroup | SupersetGroup;

@Component({
  selector: 'app-generated-workout-summary',
  standalone: true,
  imports: [CommonModule, IconComponent, GeneratedExerciseItemComponent],
  templateUrl: './generated-workout-summary.component.html',
})
export class GeneratedWorkoutSummaryComponent {
  @Input() isOpen: boolean = false;
  @Input() generatedRoutine: Routine | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() start = new EventEmitter<Routine>();

  groupedExercises = computed<DisplayGroup[]>(() => {
    const routine = this.generatedRoutine;
    if (!routine) return [];

    const displayGroups: DisplayGroup[] = [];
    const processedSupersetIds = new Set<string>();

    routine.exercises.forEach(exercise => {
      if (exercise.supersetId) {
        if (!processedSupersetIds.has(exercise.supersetId)) {
          const groupExercises = routine.exercises
            .filter(ex => ex.supersetId === exercise.supersetId)
            .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0));
          displayGroups.push({ type: 'superset', exercises: groupExercises, supersetId: exercise.supersetId });
          processedSupersetIds.add(exercise.supersetId);
        }
      } else {
        displayGroups.push({ type: 'standard', exercise });
      }
    });
    return displayGroups;
  });

  trackByGroup(index: number, group: DisplayGroup): string {
    return group.type === 'standard' ? group.exercise.id : group.supersetId;
  }

  /**
   * --- NEW METHOD ---
   * Handles the event emitted from a child item when its weight is updated.
   * @param updatedExercise The full WorkoutExercise object with new weights.
   */
  onExerciseUpdate(updatedExercise: WorkoutExercise): void {
    if (!this.generatedRoutine) return;

    // Create a new routine object to trigger change detection
    const newRoutineState: Routine = {
      ...this.generatedRoutine,
      exercises: this.generatedRoutine.exercises.map(ex => 
        ex.id === updatedExercise.id ? updatedExercise : ex
      )
    };
    
    // This is not a signal, so we re-assign the input property.
    // The parent component (routine-list) will get the final, updated routine
    // when the "Start" button is clicked.
    this.generatedRoutine = newRoutineState;
  }
}