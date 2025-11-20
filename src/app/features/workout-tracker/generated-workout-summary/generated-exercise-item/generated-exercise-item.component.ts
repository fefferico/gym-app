// src/app/features/workout-routines/routine-list/generated-workout-summary/generated-exercise-item/generated-exercise-item.component.ts

import { Component, computed, effect, EventEmitter, inject, Input, OnChanges, OnInit, Output, Signal, signal, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExerciseTargetSetParams, METRIC, RepsTarget, RepsTargetType, WorkoutExercise } from '../../../../core/models/workout.model';
import { WorkoutService } from '../../../../core/services/workout.service';
import { UnitsService } from '../../../../core/services/units.service';
import { ExerciseService } from '../../../../core/services/exercise.service';
import { Exercise } from '../../../../core/models/exercise.model';
import { firstValueFrom } from 'rxjs';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { FormsModule } from '@angular/forms';
import { AlertService } from '../../../../core/services/alert.service';
import { v4 as uuidv4 } from 'uuid';
import { TranslateModule } from '@ngx-translate/core';
import { weightToExact } from '../../../../core/services/workout-helper.service';
import { WorkoutUtilsService } from '../../../../core/services/workout-utils.service';

@Component({
    selector: 'app-generated-exercise-item',
    standalone: true,
    imports: [CommonModule, FormsModule, IconComponent, TranslateModule],
    templateUrl: './generated-exercise-item.component.html',
})
export class GeneratedExerciseItemComponent implements OnInit {
    @Input({ required: true }) exercise!: Signal<WorkoutExercise>;
    // Keep the original Input
    @Output() exerciseUpdated = new EventEmitter<WorkoutExercise>();
    @Output() exerciseRemoved = new EventEmitter<string>();

    // Injected Services
    protected workoutService = inject(WorkoutService);
    protected workoutUtilsService = inject(WorkoutUtilsService);
    protected unitsService = inject(UnitsService);
    protected exerciseService = inject(ExerciseService);
    private alertService = inject(AlertService);

    // Local state for this component
    baseExercise = signal<Exercise | null>(null);
    weightToSet = signal<number | null>(null);
    useRepRange = signal<boolean>(false);

    constructor() {
        effect(async () => {
            const currentExercise = this.exercise();
            if (currentExercise) {
                const exerciseDef = await firstValueFrom(this.exerciseService.getExerciseById(currentExercise.exerciseId));
                this.baseExercise.set(exerciseDef ?? null);
                // Initialize rep range toggle based on the first set

                const firstSetRepTarget = currentExercise.sets[0]?.targetReps;
                // The toggle should be "on" (true) if the type is 'range'.
                // The optional chaining (?.) handles cases where `firstSetRepTarget` is undefined.
                this.useRepRange.set(firstSetRepTarget?.type === RepsTargetType.range);

                if (currentExercise.sets) {
                    currentExercise.sets.map(currentSet => {
                        if (currentSet && currentSet.targetReps?.type === RepsTargetType.range) {
                            const currentSetRepsType: RepsTarget = {
                                type: RepsTargetType.range,
                                min: currentSet.targetReps.min, 
                                max: currentSet.targetReps.max 
                            };
                            // Pre-populate the cache with the valid data from the model.
                            this.tempRangeValues.update(cache => ({
                                ...cache,
                                [currentSet.id]: {
                                    min: currentSetRepsType.min,
                                    max: currentSetRepsType.max
                                }
                            }));
                        }
                    });
                }
            }
        });
    }

    ngOnInit(): void { }


    isBodyweight = computed<boolean>(() => this.baseExercise()?.category === 'bodyweightCalisthenics');
    isCardio = computed<boolean>(() => this.baseExercise()?.category === 'cardio');

    roundInfo = computed(() => {
        const ex = this.exercise();
        if (!ex) return { totalRounds: 1, roundIndices: [0] };

        // For a superset, the number of rounds IS the number of sets.
        // For a standard exercise, it's always one conceptual round.
        const totalRounds = ex.supersetId ? ex.sets.length : 1;

        const roundIndices = Array.from({ length: totalRounds }, (_, i) => i);
        return { totalRounds, roundIndices };
    });

    totalPlannedSets = computed<number>(() => {
        const ex = this.exercise();
        if (!ex) return 0;
        // The total number of sets is now always just the length of the sets array.
        return ex.sets.length;
    });

    /**
     * Helper to provide the correct sets to the template's inner loop.
     * @param roundIndex The index of the current round being rendered.
     * @returns An array of sets to display for that specific round.
     */
    public getSetsForRound(roundIndex: number): ExerciseTargetSetParams[] {
        const ex = this.exercise();
        if (!ex) return [];

        if (ex.supersetId) {
            // For supersets, return an array with just the single set for this round.
            const setForRound = ex.sets[roundIndex];
            return setForRound ? [setForRound] : [];
        } else {
            // For standard exercises, this is only called when roundIndex is 0. Return all sets.
            return ex.sets;
        }
    }

    applyWeightToAllSets(): void {
        const weight = this.weightToSet();
        if (weight === null || weight < 0) return;

        const updatedExercise = JSON.parse(JSON.stringify(this.exercise())) as WorkoutExercise;
        updatedExercise.sets.forEach(set => {
            set.targetWeight = weightToExact(weight);
        });

        this.exerciseUpdated.emit(updatedExercise);
        this.weightToSet.set(null);
    }

    onSetWeightChange(newWeight: number, setIndex: number): void {
        const updatedExercise = JSON.parse(JSON.stringify(this.exercise())) as WorkoutExercise;
        if (updatedExercise.sets[setIndex]) {
            updatedExercise.sets[setIndex].targetWeight = weightToExact(Math.max(0, Number(newWeight) || 0));
        }
        this.exerciseUpdated.emit(updatedExercise);
    }

    formatSet(set: ExerciseTargetSetParams): string {
        // ... (this method remains the same as the last version, it's already correct)
        const repsText = this.workoutUtilsService.getSetTargetDisplay(set, METRIC.reps);
        const weightText = this.workoutUtilsService.getSetTargetDisplay(set, METRIC.weight);
        const durationText = this.workoutUtilsService.getSetTargetDisplay(set, METRIC.duration);
        const distanceText = this.workoutUtilsService.getSetTargetDisplay(set, METRIC.distance);

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

        if (setIndexToRemove === -1) {
            setIndexToRemove = updatedExercise.sets.length - 1;
        }

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

    /**
     * Updates the temporary cache and, if the data is valid, the real data model.
     */
    updateRepsRange(set: ExerciseTargetSetParams, part: 'min' | 'max', value: any): void {
        const numericValue = (value === '' || value === null) ? null : Number(value);

        // 1. Always update the temporary cache to reflect the UI state.
        const currentCache = this.tempRangeValues()[set.id] || { min: null, max: null };
        const updatedCache = { ...currentCache, [part]: numericValue };
        this.tempRangeValues.update(cache => ({ ...cache, [set.id]: updatedCache }));

        // 2. Check for validity. Only update the real model if both values are valid numbers.
        if (updatedCache.min !== null && updatedCache.max !== null) {
            // Data is valid, so update the single source of truth.
            set.targetReps = {
                type: RepsTargetType.range,
                min: updatedCache.min,
                max: updatedCache.max
            };
        }
        // If the data is temporarily invalid (e.g., one field is null), we do NOT touch `set.targetReps`.
        // It remains in its last known valid state.

        this.handleModelChange();
    }

    /**
     * --- NEW: Unified method to handle any change and emit ---
     * This is the key to fixing the keyboard focus issue.
     */
    handleModelChange(): void {
        // We emit a deep copy of the signal's current value.
        // The ngModel has already updated the object in memory.
        // this.exerciseUpdated.emit(JSON.parse(JSON.stringify(this.exercise())));
        console.log("Model changed!");
    }

    /**
     * --- CORRECTED METHOD ---
     * Toggles between single rep and rep range inputs, preserving values.
     */
    toggleRepRange(event: Event): void {
        event.stopPropagation();
        const updatedExercise = JSON.parse(JSON.stringify(this.exercise())) as WorkoutExercise;
        const newUseRepRange = !this.useRepRange(); // Determine the new state

        const standardSetReps = 10;

        updatedExercise.sets.forEach(set => {
            const currentTarget = set.targetReps;

            if (newUseRepRange) {
                // --- Switching TO Rep Range ---
                let baseReps = standardSetReps; // Default if there's no existing value

                // If the current value is an exact number, use it as the base for the new range.
                if (currentTarget && currentTarget.type === RepsTargetType.exact) {
                    baseReps = currentTarget.value;
                }

                // Create a new 'range' object and assign it to the single source of truth.
                set.targetReps = {
                    type: RepsTargetType.range,
                    min: Math.max(0, baseReps - 2), // Ensure min doesn't go below 0
                    max: baseReps + 2
                };

            } else {
                // --- Switching FROM Rep Range (or anything else) TO a Single Rep value ---
                let newSingleValue = standardSetReps; // Default if there's no existing range

                // If the current value is a range, calculate the average to set as the new single value.
                if (currentTarget && currentTarget.type === RepsTargetType.range) {
                    newSingleValue = Math.round((currentTarget.min + currentTarget.max) / 2);
                }

                // Create a new 'exact' object and assign it.
                set.targetReps = {
                    type: RepsTargetType.exact,
                    value: newSingleValue
                };
            }
        });

        // Update the signal that controls the UI toggle
        this.useRepRange.set(newUseRepRange);
        // Emit the full, updated exercise object
        this.exerciseUpdated.emit(updatedExercise);
    }

    protected repsTypeEnum = RepsTargetType;

    /**
     * A type guard function that checks if a RepsTarget is the 'range' variant.
     * This is still the correct way to inform the template about the type.
     */
    public isRepRange(target: RepsTarget | null | undefined): target is { type: RepsTargetType.range, min: number, max: number } {
        return target?.type === RepsTargetType.range;
    }

    tempRangeValues = signal<{ [key: string]: { min: number | null, max: number | null } }>({});

}