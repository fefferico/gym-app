// src/app/features/workout-routines/routine-list/generated-workout-summary/generated-exercise-item/generated-exercise-item.component.ts

import { Component, computed, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
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
    imports: [CommonModule, FormsModule], // <--- ADD FormsModule here
    templateUrl: './generated-exercise-item.component.html',
})
export class GeneratedExerciseItemComponent implements OnInit {
    @Input({ required: true }) exercise!: WorkoutExercise;
    @Output() exerciseUpdated = new EventEmitter<WorkoutExercise>(); // This line will now be error-free

    // Injected Services
    private workoutService = inject(WorkoutService);
    private unitsService = inject(UnitsService);
    private exerciseService = inject(ExerciseService);

    // Local state for this component
    baseExercise = signal<Exercise | null>(null);
    weightToSet = signal<number | null>(null);

    async ngOnInit(): Promise<void> {
        const exerciseDef = await firstValueFrom(this.exerciseService.getExerciseById(this.exercise.exerciseId));
        this.baseExercise.set(exerciseDef ?? null);
    }

    isBodyweight = computed<boolean>(() => {
        return this.baseExercise()?.category === 'bodyweight/calisthenics';
    });

    roundInfo = computed(() => {
        const totalRounds = this.exercise.supersetId
            ? (this.exercise.supersetRounds || 1)
            : (this.exercise.rounds || 1);
        const roundIndices = Array.from({ length: totalRounds }, (_, i) => i);
        return { totalRounds, roundIndices };
    });

    totalPlannedSets = computed<number>(() => {
        return this.exercise.sets.length * this.roundInfo().totalRounds;
    });

    applyWeightToAllSets(): void {
        const weight = this.weightToSet();
        if (weight === null || weight < 0) return;

        const updatedExercise = JSON.parse(JSON.stringify(this.exercise)) as WorkoutExercise;
        updatedExercise.sets.forEach(set => {
            set.targetWeight = weight;
        });

        this.exerciseUpdated.emit(updatedExercise);
        this.weightToSet.set(null);
    }

    // --- No changes needed in formatSet, it's already correct ---
    formatSet(set: ExerciseTargetSetParams): string {
        const repsText = this.workoutService.getSetTargetDisplay(set, 'reps');
        const weightText = this.workoutService.getSetTargetDisplay(set, 'weight');
        const durationText = this.workoutService.getSetTargetDisplay(set, 'duration');

        if (durationText && set.targetDuration) {
            return `${durationText}s`;
        }

        let weightDisplay = '';
        if ((weightText && set.targetWeight != null) || !this.isBodyweight()) {
            weightDisplay = `${weightText}${this.unitsService.getWeightUnitSuffix()}`;
        } else {
            weightDisplay = 'Bodyweight';
        }

        if (repsText) {
            return weightDisplay ? `${weightDisplay} x ${repsText} reps` : `${repsText} reps`;
        }

        return 'N/A';
    }
}