// src/app/core/services/workout-generator.service.ts
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { Exercise, ExerciseCategory } from '../models/exercise.model';
import { Routine, WorkoutExercise, ExerciseTargetSetParams } from '../models/workout.model';
import { ExerciseService } from './exercise.service';
import { PersonalGymService } from './personal-gym.service';
import { WorkoutService } from './workout.service'; // Import WorkoutService
import { ToastService } from './toast.service';

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
    private toastService = inject(ToastService); // Inject WorkoutService

    /**
    * --- REWRITTEN METHOD ---
    * Generates a "surprise" full-body workout. It is completely independent
    * of the detailed generator and its options.
    */
    public async generateQuickWorkout(): Promise<Routine | null> {
        console.log("Starting QUICK workout generation...");

        // --- START OF FIX ---
        // Create a FULL options object that represents a quick workout.
        // This ensures that any function we pass it to receives all expected properties.
        const optionsForFiltering: WorkoutGenerationOptions = {
            usePersonalGym: true,
            avoidMuscles: [],
            split: 'full-body', // A quick workout is always full-body
            targetMuscles: [],    // No specific targets, so the service will use the default for the split
            // These properties aren't used by the filtering step, but we provide them to satisfy the type.
            duration: 45,
            goal: 'hypertrophy',
            equipment: [],
        };
        
        // 'Chest', 'Quadriceps', 'Core','Arms','Back'
        // The cast to WorkoutGenerationOptions is no longer needed as the object is complete.
        const availableExercises = await this.getSelectableExercises(optionsForFiltering);
        // --- END OF FIX ---

        if (availableExercises.length < 5) {
            this.toastService.error("Not enough exercises available to generate a workout.", 0, "Error");
            return null;
        }

        // 2. Group available exercises by their primary muscle group
        const exercisesPerMuscle = new Map<string, Exercise[]>();
        availableExercises.forEach(ex => {
            if (ex.primaryMuscleGroup) {
                if (!exercisesPerMuscle.has(ex.primaryMuscleGroup)) {
                    exercisesPerMuscle.set(ex.primaryMuscleGroup, []);
                }
                exercisesPerMuscle.get(ex.primaryMuscleGroup)!.push(ex);
            }
        });

        // 3. Define major muscle categories for a balanced workout
        const muscleCategories = {
            legs: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves'],
            push: ['Chest', 'Shoulders', 'Triceps'],
            pull: ['Lats', 'Traps', 'Biceps', 'Lower back', 'Back'],
            core: ['Abs', 'Obliques', 'Core']
        };

        const workoutExercises: WorkoutExercise[] = [];
        const usedExerciseIds = new Set<string>();

        // 4. Intelligently pick one exercise from each major category
        const pickFromCategory = (category: string[]) => {
            const availableMuscles = this.shuffleArray(category.filter(m => exercisesPerMuscle.has(m)));
            for (const muscle of availableMuscles) {
                const candidates = exercisesPerMuscle.get(muscle)!;
                const exercise = this.pickUniqueExercise(candidates, Array.from(usedExerciseIds));
                if (exercise) {
                    workoutExercises.push(this.createSimpleWorkoutExercise(exercise));
                    usedExerciseIds.add(exercise.id);
                    return; // Found one, move to next category
                }
            }
        };

        pickFromCategory(muscleCategories.legs);
        pickFromCategory(muscleCategories.push);
        pickFromCategory(muscleCategories.pull);
        pickFromCategory(muscleCategories.core);

        // Add one more random exercise for good measure if possible
        if (workoutExercises.length < 5) {
            const allMuscles = Array.from(exercisesPerMuscle.keys());
            pickFromCategory(allMuscles);
        }

        if (workoutExercises.length < 3) {
            console.error("Quick generation failed: could not build a balanced workout.");
            return null;
        }

        // 5. Assemble and return the routine
        const newRoutine: Routine = {
            id: `generated-${uuidv4()}`,
            name: 'Quick Surprise Workout',
            description: `A randomly generated full-body session created on ${new Date().toLocaleDateString()}.`,
            exercises: this.shuffleArray(workoutExercises), // Shuffle the final order
            goal: 'hypertrophy',
            isFavourite: false,
            isHidden: true,
        };

        return newRoutine;
    }

    /**
     * A helper that encapsulates a single generation attempt.
     */
    private async tryGenerateWithCriteria(options: WorkoutGenerationOptions): Promise<WorkoutExercise[] | null> {
        const selectableExercises = await this.getSelectableExercises(options);

        if (selectableExercises.length < 2) {
            return null; // Not enough exercises to proceed
        }

        return this.buildExerciseList(selectableExercises, options);
    }

    private async getSelectableExercises(options: WorkoutGenerationOptions): Promise<Exercise[]> {
        const allExercises = await firstValueFrom(this.exerciseService.getExercises());
        let availableExercises = allExercises.filter(ex => !ex.isHidden && ex.category !== 'stretching');

        // Filter by Equipment
        let equipmentFilter = new Set<string>();
        if (options.usePersonalGym) {
            const personalGym = await firstValueFrom(this.personalGymService.getAllEquipment());
            personalGym.forEach(e => equipmentFilter.add(e.name));
        } else if (options.equipment.length > 0) {
            options.equipment.forEach(e => equipmentFilter.add(e));
        }

        if (equipmentFilter.size > 0) {
            availableExercises = availableExercises.filter(ex =>
                ex.category === 'bodyweight/calisthenics' || !ex.equipment || equipmentFilter.has(ex.equipment)
            );
        }

        // Filter by Muscles to Avoid
        if (options.avoidMuscles.length > 0) {
            const avoidSet = new Set(options.avoidMuscles);
            availableExercises = availableExercises.filter(ex => !avoidSet.has(ex.primaryMuscleGroup));
        }

        // Filter by Target Muscles
        const targetMuscles = this.determineTargetMuscles(options.split, options.targetMuscles);
        if (targetMuscles.size > 0) {
            availableExercises = availableExercises.filter(ex => ex.primaryMuscleGroup && targetMuscles.has(ex.primaryMuscleGroup.toLowerCase()));
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
      * Builds a list of exercises by accumulating their estimated duration.
      */
    private buildExerciseList(exercises: Exercise[], options: WorkoutGenerationOptions): WorkoutExercise[] {
        const workout: WorkoutExercise[] = [];
        const exercisesPerMuscle = new Map<string, Exercise[]>();
        exercises.forEach(ex => {
            if (ex.primaryMuscleGroup) {
                if (!exercisesPerMuscle.has(ex.primaryMuscleGroup)) {
                    exercisesPerMuscle.set(ex.primaryMuscleGroup, []);
                }
                exercisesPerMuscle.get(ex.primaryMuscleGroup)!.push(ex);
            }
        });

        if (exercisesPerMuscle.size === 0) return [];

        const muscleGroupsToPickFrom = this.shuffleArray(Array.from(exercisesPerMuscle.keys()));

        let totalEstimatedSeconds = 0;
        const targetSeconds = options.duration * 60;
        let muscleIndex = 0;
        const maxExercises = 12;

        while (totalEstimatedSeconds < targetSeconds && workout.length < maxExercises) {
            if (muscleGroupsToPickFrom.length === 0) break;

            const muscle = muscleGroupsToPickFrom[muscleIndex % muscleGroupsToPickFrom.length];
            const availableForMuscle = exercisesPerMuscle.get(muscle);

            if (availableForMuscle && availableForMuscle.length > 0) {

                // --- START OF CORRECTION ---
                // We now map the 'workout' array to an array of just the exercise IDs
                // to match the new signature of 'pickUniqueExercise'.
                const existingExerciseIds = workout.map(wEx => wEx.exerciseId);
                const exerciseToAdd = this.pickUniqueExercise(availableForMuscle, existingExerciseIds);
                // --- END OF CORRECTION ---

                if (exerciseToAdd) {
                    const workoutExercise = this.createWorkoutExercise(exerciseToAdd, options.goal);
                    const exerciseDurationInSeconds = this.workoutService.getEstimatedRoutineDuration({ exercises: [workoutExercise] } as Routine) * 60;

                    if (totalEstimatedSeconds + exerciseDurationInSeconds < targetSeconds + 180) {
                        workout.push(workoutExercise);
                        totalEstimatedSeconds += exerciseDurationInSeconds;
                    }
                }
            }
            muscleIndex++;
            if (muscleIndex > muscleGroupsToPickFrom.length * 5) break;
        }

        return workout;
    }

    /** +++ NEW HELPER +++ */
    private pickUniqueExercise(from: Exercise[], existingIds: string[]): Exercise | null {
        const available = this.shuffleArray([...from]);
        for (const ex of available) {
            // The logic now correctly checks against an array of strings
            if (!existingIds.includes(ex.id)) {
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

    /**
     * --- NEW HELPER METHOD ---
     * Creates a WorkoutExercise with a simple, standard set/rep scheme.
     */
    private createSimpleWorkoutExercise(exercise: Exercise): WorkoutExercise {
        const sets: ExerciseTargetSetParams[] = Array.from({ length: 3 }, () => ({
            id: uuidv4(),
            type: 'standard',
            targetReps: 10,
            restAfterSet: 60,
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

    /**
     * --- FULL IMPLEMENTATION ---
     * The main engine for generating a detailed, customized workout with fallbacks.
     */
    public async generateWorkout(options: WorkoutGenerationOptions): Promise<Routine | null> {
        console.log("Starting workout generation with options:", options);

        let generatedExercises = await this.tryGenerateWithCriteria(options);
        
        if (!generatedExercises || generatedExercises.length < 2) {
            console.warn("Generation failed with strict criteria. Fallback 1: Ignoring equipment constraints.");
            this.toastService.info("Not enough specific exercises found. Broadening search...", 3000, "Expanding Search");
            
            const relaxedOptions = { ...options, usePersonalGym: false, equipment: [] };
            generatedExercises = await this.tryGenerateWithCriteria(relaxedOptions);
        }

        if (!generatedExercises || generatedExercises.length < 2) {
            console.warn("Generation failed after relaxing equipment. Fallback 2: Ignoring target muscle constraints.");
            this.toastService.info("Still not enough. Ignoring specific muscle targets...", 3000, "Expanding Further");
            
            const finalOptions = { ...options, targetMuscles: [] };
            generatedExercises = await this.tryGenerateWithCriteria(finalOptions);
        }

        if (!generatedExercises || generatedExercises.length === 0) {
            console.error("CRITICAL: Workout generation failed even with all fallbacks.");
            return null;
        }

        const routineName = `Generated ${options.split.replace('-', ' ')} Workout`;
        const newRoutine: Routine = {
            id: `generated-${uuidv4()}`,
            name: routineName,
            description: `Generated on ${new Date().toLocaleDateString()} for a ~${options.duration} minute, ${options.goal}-focused session.`,
            exercises: generatedExercises,
            goal: options.goal,
            isFavourite: false,
            isHidden: true,
        };

        return newRoutine;
    }

}