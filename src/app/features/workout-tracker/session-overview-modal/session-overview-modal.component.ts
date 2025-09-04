import { Component, Input, Output, EventEmitter, computed, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routine, WorkoutExercise, ExerciseSetParams } from '../../../core/models/workout.model';
import { LoggedWorkoutExercise, LoggedSet } from '../../../core/models/workout-log.model';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ExerciseOverviewItemComponent } from './app-exercise-overview-item/app-exercise-overview-item.component';

// Define interfaces for the structured data this component will use
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
  selector: 'app-session-overview-modal',
  standalone: true,
  imports: [CommonModule, IconComponent, ExerciseOverviewItemComponent],
  templateUrl: 'session-overview-modal.component.html'
})
export class SessionOverviewModalComponent {
  @Input() isOpen: boolean = false;
  // CORRECTED: Remove the old, non-signal inputs
  // @Input() routine: Routine | undefined | null = undefined;
  // @Input() loggedExercises: LoggedWorkoutExercise[] = [];

  // Use signals for reactive data flow from the parent component
  @Input() routineSignal: Signal<Routine | null | undefined> = computed(() => undefined);
  @Input() loggedExercisesSignal: Signal<LoggedWorkoutExercise[]> = computed(() => []);
  @Input() activeExerciseId: string | undefined;
  @Output() close = new EventEmitter<void>();

  groupedExercises = computed<DisplayGroup[]>(() => {
    const routine = this.routineSignal();
    if (!routine) return [];

    // ... rest of the method is correct
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
}