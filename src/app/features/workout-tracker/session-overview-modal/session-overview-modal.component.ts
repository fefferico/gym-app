import { Component, Input, Output, EventEmitter, computed, Signal, SimpleChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { Routine, WorkoutExercise } from '../../../core/models/workout.model';
import { LoggedWorkoutExercise, WorkoutLog } from '../../../core/models/workout-log.model';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ExerciseOverviewItemComponent } from './app-exercise-overview-item/app-exercise-overview-item.component';
import { TranslateModule } from '@ngx-translate/core';
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
  imports: [CommonModule, IconComponent, ExerciseOverviewItemComponent, TranslateModule],
  templateUrl: 'session-overview-modal.component.html'
})
export class SessionOverviewModalComponent {
  @Input() isOpen: boolean = false;
  // Use signals for reactive data flow from the parent component
  @Input() routineSignal: Signal<Routine | null | undefined> = computed(() => undefined);
  @Input() loggedExercisesSignal: Signal<LoggedWorkoutExercise[]> = computed(() => []);
  @Input() activeExerciseId: string | undefined;
  @Input() activeSetIndex: number | undefined;
  @Input() activeBlockRound: number | undefined;
  @Output() close = new EventEmitter<void>();

  groupedExercises = computed<DisplayGroup[]>(() => {
    const routine = this.routineSignal();
    if (!routine) return [];

    // ... rest of the method is correct
    const displayGroups: DisplayGroup[] = [];
    const processedSupersetIds = new Set<string>();

    routine.workoutExercises.forEach(exercise => {
      if (exercise.supersetId) {
        if (!processedSupersetIds.has(exercise.supersetId)) {
          const groupExercises = routine.workoutExercises
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

  ngOnChanges(changes: SimpleChanges): void {
    if ('isOpen' in changes) {
      if (this.isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  }

  ngOnDestroy(): void {
    // Restore scrolling if the component is destroyed while open
    document.body.style.overflow = '';
  }
}