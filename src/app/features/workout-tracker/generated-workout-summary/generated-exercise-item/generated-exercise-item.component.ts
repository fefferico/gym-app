// src/app/features/workout-routines/routine-list/generated-workout-summary/generated-exercise-item/generated-exercise-item.component.ts

import { Component, computed, EventEmitter, inject, Input, OnChanges, OnInit, Output, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExerciseTargetSetParams, WorkoutExercise } from '../../../../core/models/workout.model';
import { WorkoutService } from '../../../../core/services/workout.service';
import { UnitsService } from '../../../../core/services/units.service';
import { ExerciseService } from '../../../../core/services/exercise.service';
import { Exercise } from '../../../../core/models/exercise.model';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-generated-exercise-item',
    standalone: true,
    imports: [CommonModule, FormsModule, IconComponent],
    templateUrl: './generated-exercise-item.component.html',
})
export class GeneratedExerciseItemComponent implements OnInit, OnChanges {
    // Keep the original Input
    @Input({ required: true }) exercise!: WorkoutExercise;
    @Output() exerciseUpdated = new EventEmitter<WorkoutExercise>();

    // --- NEW: Internal state for the component ---
    // This signal holds the mutable copy of the exercise data for the UI
    editableExercise = signal<WorkoutExercise | null>(null);

    // Injected Services
    protected workoutService = inject(WorkoutService);
    protected unitsService = inject(UnitsService);
    protected exerciseService = inject(ExerciseService);

    // Local state for this component
    baseExercise = signal<Exercise | null>(null);
    weightToSet = signal<number | null>(null);

    async ngOnInit(): Promise<void> {
        const exerciseDef = await firstValueFrom(this.exerciseService.getExerciseById(this.exercise.exerciseId));
        this.baseExercise.set(exerciseDef ?? null);
    }

    // --- NEW: Lifecycle Hook to sync internal state with parent changes ---
    ngOnChanges(changes: SimpleChanges): void {
        if (changes['exercise']) {
            // When the input from the parent changes, update our internal, editable copy
            this.editableExercise.set(JSON.parse(JSON.stringify(this.exercise)));
        }
    }

    isBodyweight = computed<boolean>(() => {
        return this.baseExercise()?.category === 'bodyweight/calisthenics';
    });

    roundInfo = computed(() => {
        const ex = this.editableExercise();
        if (!ex) return { totalRounds: 1, roundIndices: [0] };
        const totalRounds = ex.supersetId ? (ex.supersetRounds || 1) : (ex.rounds || 1);
        const roundIndices = Array.from({ length: totalRounds }, (_, i) => i);
        return { totalRounds, roundIndices };
    });

    totalPlannedSets = computed<number>(() => {
        const ex = this.editableExercise();
        if (!ex) return 0;
        return ex.sets.length * this.roundInfo().totalRounds;
    });

    applyWeightToAllSets(): void {
        const weight = this.weightToSet();
        if (weight === null || weight < 0) return;

        // Update the internal signal directly
        this.editableExercise.update(ex => {
            if (!ex) return null;
            ex.sets.forEach(set => {
                set.targetWeight = weight;
            });
            return ex;
        });

        // Emit the full, updated exercise object
        this.exerciseUpdated.emit(this.editableExercise()!);
        this.weightToSet.set(null);
    }

    // --- NEW: Method to handle individual set weight changes ---
    onSetWeightChange(newWeight: number, setIndex: number): void {
        this.editableExercise.update(ex => {
            if (ex && ex.sets[setIndex]) {
                // Ensure weight is a number and not negative
                ex.sets[setIndex].targetWeight = Math.max(0, Number(newWeight) || 0);
            }
            return ex;
        });
        // Emit the full, updated exercise object after any change
        this.exerciseUpdated.emit(this.editableExercise()!);
    }

    formatSet(set: ExerciseTargetSetParams): string {
        // ... (this method remains the same as the last version, it's already correct)
        const repsText = this.workoutService.getSetTargetDisplay(set, 'reps');
        const weightText = this.workoutService.getSetTargetDisplay(set, 'weight');
        const durationText = this.workoutService.getSetTargetDisplay(set, 'duration');

        if (durationText && set.targetDuration) {
            return `${durationText}s`;
        }

        let weightDisplay = '';
        if (weightText && set.targetWeight != null) {
            weightDisplay = `${weightText}${this.unitsService.getWeightUnitSuffix()}`;
        } else if (this.isBodyweight()) {
            weightDisplay = 'Bodyweight';
        }

        if (repsText) {
            return weightDisplay ? `${weightDisplay} x ${repsText} reps` : `${repsText} reps`;
        }

        return 'N/A';
    }
}