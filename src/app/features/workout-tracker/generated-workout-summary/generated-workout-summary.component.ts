// src/app/features/workout-routines/routine-list/generated-workout-summary/generated-workout-summary.component.ts
import { Component, Input, Output, EventEmitter, computed, inject, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { Routine, WorkoutExercise } from '../../../core/models/workout.model';
import { GeneratedExerciseItemComponent } from './generated-exercise-item/generated-exercise-item.component';
import { AlertService } from '../../../core/services/alert.service';
import { WorkoutService } from '../../../core/services/workout.service';

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
    @Input({ required: true }) generatedRoutineSignal!: Signal<Routine | null>;
    @Output() back = new EventEmitter<void>();
    @Output() close = new EventEmitter<void>();
    @Output() start = new EventEmitter<Routine>();
    @Output() routineUpdated = new EventEmitter<Routine>();
    @Output() retry = new EventEmitter<void>();

    private alertService = inject(AlertService);
    private workoutService = inject(WorkoutService);

    groupedExercises = computed<DisplayGroup[]>(() => {
        const routine = this.generatedRoutineSignal();
        if (!routine) return [];

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




    /**
  * --- NEW: Computed Signal for Total Duration ---
  * Reactively calculates the total estimated duration of the current routine state.
  */
    totalEstimatedDuration = computed<number>(() => {
        const routine = this.generatedRoutineSignal();
        if (!routine) return 0;
        return this.workoutService.getEstimatedRoutineDuration(routine);
    });

    onExerciseUpdate(updatedExercise: WorkoutExercise): void {
        const routine = this.generatedRoutineSignal();
        if (!routine) return;
        const newRoutineState: Routine = {
            ...routine,
            workoutExercises: routine.workoutExercises.map(ex =>
                ex.id === updatedExercise.id ? updatedExercise : ex
            )
        };
        this.routineUpdated.emit(newRoutineState);
    }

    onExerciseRemove(exerciseIdToRemove: string): void {
        const routine = this.generatedRoutineSignal();
        if (!routine) return;
        const newRoutineState: Routine = {
            ...routine,
            workoutExercises: routine.workoutExercises.filter(ex => ex.id !== exerciseIdToRemove)
        };
        this.routineUpdated.emit(newRoutineState); // Emit the change
    }

    async onSupersetRemove(supersetIdToRemove: string): Promise<void> {
        const routine = this.generatedRoutineSignal();
        if (!routine) return;
        const confirm = await this.alertService.showConfirm(
            'Remove Superset',
            `Are you sure you want to remove this entire superset from the workout?`
        );
        if (confirm && confirm.data) {
            const newRoutineState: Routine = {
                ...routine,
                workoutExercises: routine.workoutExercises.filter(ex => ex.supersetId !== supersetIdToRemove)
            };
            this.routineUpdated.emit(newRoutineState); // Emit the change
        }
    }

    /**
   * --- NEW HELPER METHOD ---
   * Creates a new computed signal for a specific exercise ID.
   * This allows us to pass a reactive slice of the main routine signal
   * down to each child component.
   * @param exerciseId The ID of the exercise to create a signal for.
   */
    getExerciseSignal(exerciseId: string): Signal<WorkoutExercise> {
        return computed(() => {
            const routine = this.generatedRoutineSignal();
            const exercise = routine?.workoutExercises.find(ex => ex.id === exerciseId);
            // This assertion is safe because we know the exercise exists when this is called.
            return exercise!;
        });
    }
}