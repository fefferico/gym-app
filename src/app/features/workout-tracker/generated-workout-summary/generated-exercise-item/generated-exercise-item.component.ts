// src/app/features/workout-routines/routine-list/generated-workout-summary/generated-exercise-item/generated-exercise-item.component.ts

import { Component, computed, effect, EventEmitter, inject, Input, OnChanges, OnInit, Output, Signal, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExerciseTargetSetParams, WorkoutExercise } from '../../../../core/models/workout.model';
import { WorkoutService } from '../../../../core/services/workout.service';
import { UnitsService } from '../../../../core/services/units.service';
import { ExerciseService } from '../../../../core/services/exercise.service';
import { Exercise } from '../../../../core/models/exercise.model';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { AlertService } from '../../../../core/services/alert.service';
import { v4 as uuidv4 } from 'uuid';

@Component({
    selector: 'app-generated-exercise-item',
    standalone: true,
    imports: [CommonModule, FormsModule, IconComponent],
    templateUrl: './generated-exercise-item.component.html',
})
export class GeneratedExerciseItemComponent implements OnInit {
    @Input({ required: true }) exercise!: Signal<WorkoutExercise>;
    // Keep the original Input
    @Output() exerciseUpdated = new EventEmitter<WorkoutExercise>();
    @Output() exerciseRemoved = new EventEmitter<string>();

    // Injected Services
    protected workoutService = inject(WorkoutService);
    protected unitsService = inject(UnitsService);
    protected exerciseService = inject(ExerciseService);
    private alertService = inject(AlertService);

    // Local state for this component
    baseExercise = signal<Exercise | null>(null);
    weightToSet = signal<number | null>(null);

        constructor() {
        // This effect will run when the component is created AND
        // every time the input `exercise` signal changes.
        effect(async () => {
            const currentExercise = this.exercise(); // Read the signal
            if (currentExercise) {
                const exerciseDef = await firstValueFrom(this.exerciseService.getExerciseById(currentExercise.exerciseId));
                this.baseExercise.set(exerciseDef ?? null);
            }
        });
    }

        ngOnInit(): void {}


    isBodyweight = computed<boolean>(() => {
        return this.baseExercise()?.category === 'bodyweight/calisthenics';
    });

    roundInfo = computed(() => {
        const ex = this.exercise();
        if (!ex) return { totalRounds: 1, roundIndices: [0] };
        const totalRounds = ex.supersetId ? (ex.supersetRounds || 1) : (ex.rounds || 1);
        const roundIndices = Array.from({ length: totalRounds }, (_, i) => i);
        return { totalRounds, roundIndices };
    });

    totalPlannedSets = computed<number>(() => {
        const ex = this.exercise();
        if (!ex) return 0;
        return ex.sets.length * this.roundInfo().totalRounds;
    });

    applyWeightToAllSets(): void {
        const weight = this.weightToSet();
        if (weight === null || weight < 0) return;

        // Create a copy to emit, don't mutate the signal's value directly
        const updatedExercise = JSON.parse(JSON.stringify(this.exercise())) as WorkoutExercise;
        updatedExercise.sets.forEach(set => {
            set.targetWeight = weight;
        });
        
        this.exerciseUpdated.emit(updatedExercise);
        this.weightToSet.set(null);
    }
    
    onSetWeightChange(newWeight: number, setIndex: number): void {
        const updatedExercise = JSON.parse(JSON.stringify(this.exercise())) as WorkoutExercise;
        if (updatedExercise.sets[setIndex]) {
            updatedExercise.sets[setIndex].targetWeight = Math.max(0, Number(newWeight) || 0);
        }
        this.exerciseUpdated.emit(updatedExercise);
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

    /**
     * Calculates the estimated duration for this specific exercise block.
     */
    estimatedDuration = computed<number>(() => {
        const ex = this.exercise();
        if (!ex) return 0;
        // Use the service to calculate duration for just this one exercise
        return this.workoutService.getEstimatedRoutineDuration({ exercises: [ex] } as any);
    });

    /**
     * Removes a single set from the exercise. If it's the last set,
     * it triggers the removal of the entire exercise.
     */
    async removeSet(setIndexToRemove: number): Promise<void> {
        const currentExercise = this.exercise();
        if (!currentExercise) return;

        if (currentExercise.sets.length <= 1) {
            await this.removeExercise();
            return;
        }
        
        const updatedExercise = JSON.parse(JSON.stringify(currentExercise)) as WorkoutExercise;
        updatedExercise.sets.splice(setIndexToRemove, 1);
        this.exerciseUpdated.emit(updatedExercise);
    }

    /**
     * Asks for confirmation and then emits an event to remove the entire exercise.
     */
    async removeExercise(): Promise<void> {
        const ex = this.exercise();
        if (!ex) return;

        const confirm = await this.alertService.showConfirm(
            'Remove Exercise',
            `Are you sure you want to remove "${ex.exerciseName}" from this workout?`
        );

        if (confirm && confirm.data) {
            this.exerciseRemoved.emit(ex.id);
        }
    }

    // --- NEW METHOD ---
    /**
     * Adds a new set to the exercise by copying the last set's parameters.
     */
    addSet(): void {
        const currentExercise = this.exercise();
        if (!currentExercise || currentExercise.sets.length === 0) return;

        const updatedExercise = JSON.parse(JSON.stringify(currentExercise)) as WorkoutExercise;
        const lastSet = updatedExercise.sets[updatedExercise.sets.length - 1];
        const newSet: ExerciseTargetSetParams = {
            ...lastSet, // Copy all properties from the last set
            id: uuidv4(), // Give it a new unique ID
        };
        updatedExercise.sets.push(newSet);
        this.exerciseUpdated.emit(updatedExercise);
    }
}