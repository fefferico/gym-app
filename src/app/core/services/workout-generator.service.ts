// src/app/core/services/workout-generator.service.ts
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { Exercise, ExerciseCategory } from '../models/exercise.model';
import { Routine, WorkoutExercise, ExerciseTargetSetParams } from '../models/workout.model';
import { ExerciseService } from './exercise.service';
import { PersonalGymService } from './personal-gym.service';
import { WorkoutService } from './workout.service'; // Import WorkoutService

// Interface for the detailed generation options
export interface WorkoutGenerationOptions {
    duration: number; // in minutes
    goal: 'hypertrophy' | 'strength' | 'muscular endurance';
    split: 'full-body' | 'upper-lower' | 'push-pull-legs';
    targetMuscles: string[];
    avoidMuscles: string[];
    usePersonalGym: boolean;
    equipment: string[];
}

@Injectable({
    providedIn: 'root'
})
export class WorkoutGeneratorService {
    private exerciseService = inject(ExerciseService);
    private personalGymService = inject(PersonalGymService);
    private workoutService = inject(WorkoutService); // Inject WorkoutService

    public async generateQuickWorkout(): Promise<Routine | null> {
        const options: WorkoutGenerationOptions = {
            duration: 45,
            goal: 'hypertrophy',
            split: 'full-body',
            targetMuscles: [],
            avoidMuscles: [],
            usePersonalGym: true,
            equipment: []
        };
        return this.generateWorkout(options);
    }

    public async generateWorkout(options: WorkoutGenerationOptions): Promise<Routine | null> {
        // 1. Get and Filter Exercises
        const selectableExercises = await this.getSelectableExercises(options);

        if (selectableExercises.length < 3) {
            console.warn("Generation failed: Fewer than 3 selectable exercises after filtering.");
            return null;
        }

        // 2. Build the Workout Structure
        const generatedExercises = this.buildExerciseList(selectableExercises, options);

        if (generatedExercises.length === 0) {
            console.warn("Generation failed: No exercises were selected for the routine.");
            return null;
        }

        const routineName = `Generated ${options.split.replace('-', ' ')} Workout`;
        const newRoutine: Routine = {
            id: `generated-${uuidv4()}`,
            name: routineName,
            description: `Generated on ${new Date().toLocaleDateString()} for a ${options.duration} minute, ${options.goal}-focused session.`,
            exercises: generatedExercises,
            goal: options.goal,
            isFavourite: false,
            isHidden: true,
        };

        return newRoutine;
    }

    private async getSelectableExercises(options: WorkoutGenerationOptions): Promise<Exercise[]> {
        const allExercises = await firstValueFrom(this.exerciseService.getExercises());
        let availableExercises = allExercises.filter(ex => !ex.isHidden && ex.category !== 'stretching');

        // Filter by Equipment
        if (options.usePersonalGym) {
            const personalGym = await firstValueFrom(this.personalGymService.getAllEquipment());
            const personalEquipment = new Set(personalGym.map(e => e.name));
            availableExercises = availableExercises.filter(ex =>
                ex.category === 'bodyweight/calisthenics' || !ex.equipment || personalEquipment.has(ex.equipment)
            );
        } // Add else block for manual equipment selection if needed

        // Filter by Muscles to Avoid
        if (options.avoidMuscles.length > 0) {
            const avoidSet = new Set(options.avoidMuscles);
            availableExercises = availableExercises.filter(ex => !avoidSet.has(ex.primaryMuscleGroup));
        }

        // Filter by Target Muscles (determined by split and user choice)
        const targetMuscles = this.determineTargetMuscles(options.split, options.targetMuscles);
        if (targetMuscles.size > 0) {
            availableExercises = availableExercises.filter(ex => targetMuscles.has(ex.primaryMuscleGroup));
        }

        return availableExercises;
    }

    private determineTargetMuscles(split: string, userTargets: string[]): Set<string> {
        if (userTargets.length > 0) {
            return new Set(userTargets);
        }

        switch (split) {
            case 'upper-lower': return new Set(['chest', 'lats', 'shoulders', 'biceps', 'triceps', 'traps', 'lower back', 'forearms', 'abs', 'obliques']);
            case 'push-pull-legs': return new Set(['chest', 'shoulders', 'triceps']);
            case 'full-body':
            default:
                return new Set(['quadriceps', 'hamstrings', 'glutes', 'calves', 'chest', 'lats', 'shoulders', 'biceps', 'triceps', 'lower back', 'traps', 'abs']);
        }
    }

    /**
         * --- REWRITTEN METHOD ---
         * Builds a list of exercises by accumulating their estimated duration until it
         * reaches the user's target time.
         */
    private buildExerciseList(exercises: Exercise[], options: WorkoutGenerationOptions): WorkoutExercise[] {
        const workout: WorkoutExercise[] = [];
        const exercisesPerMuscle = new Map<string, Exercise[]>();

        exercises.forEach(ex => {
            if (!exercisesPerMuscle.has(ex.primaryMuscleGroup)) {
                exercisesPerMuscle.set(ex.primaryMuscleGroup, []);
            }
            exercisesPerMuscle.get(ex.primaryMuscleGroup)!.push(ex);
        });

        // Shuffle the muscle groups to ensure variety in every generated workout
        const muscleGroupsToPickFrom = this.shuffleArray(Array.from(exercisesPerMuscle.keys()));

        let totalEstimatedSeconds = 0;
        const targetSeconds = options.duration * 60;
        let muscleIndex = 0;
        const maxExercises = 10; // Safety break to prevent huge workouts

        // Loop until we hit the target duration or the max exercise limit
        while (totalEstimatedSeconds < targetSeconds && workout.length < maxExercises) {
            if (muscleGroupsToPickFrom.length === 0) break;

            // Cycle through the available muscle groups
            const muscle = muscleGroupsToPickFrom[muscleIndex % muscleGroupsToPickFrom.length];
            const availableForMuscle = exercisesPerMuscle.get(muscle);

            if (availableForMuscle && availableForMuscle.length > 0) {
                // Pick a random exercise from the list that hasn't been used yet
                const exerciseToAdd = this.pickUniqueExercise(availableForMuscle, workout);

                if (exerciseToAdd) {
                    const workoutExercise = this.createWorkoutExercise(exerciseToAdd, options.goal);

                    // Use the accurate duration estimator from WorkoutService
                    const exerciseDurationInSeconds = this.workoutService.getEstimatedRoutineDuration({ exercises: [workoutExercise] } as Routine) * 60;

                    // Add the new exercise ONLY if it doesn't grossly overshoot the target duration
                    if (totalEstimatedSeconds + exerciseDurationInSeconds < targetSeconds + 180) { // Allow going over by 3 mins
                        workout.push(workoutExercise);
                        totalEstimatedSeconds += exerciseDurationInSeconds;
                    }
                }
            }
            muscleIndex++;
            // Safety break to prevent an infinite loop if we run out of unique exercises
            if (muscleIndex > muscleGroupsToPickFrom.length * 3) break;
        }

        return workout;
    }

    /** +++ NEW HELPER +++ */
    private pickUniqueExercise(from: Exercise[], existing: WorkoutExercise[]): Exercise | null {
        const available = this.shuffleArray([...from]);
        for (const ex of available) {
            if (!existing.some(wEx => wEx.exerciseId === ex.id)) {
                return ex;
            }
        }
        return null; // No unique exercise could be found
    }

    private shuffleArray<T>(array: T[]): T[] {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    private createWorkoutExercise(exercise: Exercise, goal: string): WorkoutExercise {
        let numSets = 3;
        let repRange = { min: 8, max: 12 };
        let rest = 60;

        switch (goal) {
            case 'strength':
                numSets = 4;
                repRange = { min: 4, max: 6 };
                rest = 90;
                break;
            case 'muscular endurance':
                numSets = 3;
                repRange = { min: 15, max: 20 };
                rest = 45;
                break;
            case 'hypertrophy':
            default:
                numSets = 3;
                repRange = { min: 8, max: 12 };
                rest = 60;
                break;
        }

        const sets: ExerciseTargetSetParams[] = Array.from({ length: numSets }, () => ({
            id: uuidv4(),
            type: 'standard',
            targetRepsMin: repRange.min,
            targetRepsMax: repRange.max,
            restAfterSet: rest,
        }));

        return {
            id: uuidv4(),
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            sets: sets,
            supersetId: null,
            supersetOrder: null,
            supersetRounds: 1,
            rounds: 1,
            type: 'standard'
        };
    }

}