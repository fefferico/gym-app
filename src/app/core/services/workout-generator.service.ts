// src/app/core/services/workout-generator.service.ts
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { Exercise } from '../models/exercise.model';
import { Routine, WorkoutExercise, ExerciseTargetSetParams, METRIC, RepsTargetType } from '../models/workout.model';
import { ExerciseService } from './exercise.service';
import { PersonalGymService } from './personal-gym.service';
import { WorkoutService } from './workout.service'; // Import WorkoutService
import { ToastService } from './toast.service';
import { distanceToExact, durationToExact, repsNumberToExactRepsTarget, restToExact, weightToExact } from './workout-helper.service';
import { HydratedExerciseCategory } from './exercise-category.service';
import { EXERCISE_CATEGORY_TYPES } from '../models/exercise-category.model';

// Interface for the detailed generation options
export interface WorkoutGenerationOptions {
    duration: number; // in minutes
    goal: 'hypertrophy' | 'strength' | 'muscular endurance';
    split: "fullBody" | 'upper-lower' | 'push-pull-legs';
    targetMuscles: string[];
    avoidMuscles: string[];
    usePersonalGym: boolean;
    equipment: string[];
    excludeEquipment: string[];
    exerciseCategory?: HydratedExerciseCategory;
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
            split: "fullBody", // A quick workout is always full-body
            targetMuscles: [],    // No specific targets, so the service will use the default for the split
            // These properties aren't used by the filtering step, but we provide them to satisfy the type.
            duration: 45,
            goal: 'hypertrophy',
            equipment: [],
            excludeEquipment: []
        };

        // 'Chest', 'quadriceps', 'Core','Arms','Back'
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
            legs: ['quadriceps', 'Hamstrings', 'Glutes', 'Calves'],
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
        // First, get the entire pool of exercises that match ALL user criteria (muscles, equipment, EXCLUSIONS).
        const selectableExercises = await this.getSelectableExercises(options);

        if (selectableExercises.length < 2) {
            return null; // Not enough exercises to proceed.
        }

        // The builder will handle all other logic, now trusting the pre-filtered list.
        return this.buildExerciseList(selectableExercises, options);
    }

    private async getSelectableExercises(options: WorkoutGenerationOptions): Promise<Exercise[]> {
        const allExercises = await firstValueFrom(this.exerciseService.getExercises());
        let availableExercises = allExercises.filter(ex => !ex.isHidden && !ex.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.stretching) === undefined);

        // --- Category filtering ---
        if (options.exerciseCategory && options.exerciseCategory) {
            availableExercises = availableExercises.filter(ex => ex.categories.find(cat => cat === options.exerciseCategory?.id) !== undefined);
        }

        // Determine equipment filter values, all lowercased for consistent comparison
        let equipmentFilterValues: string[] = [];
        if (options.usePersonalGym) {
            const personalGym = await firstValueFrom(this.personalGymService.getAllEquipment());
            equipmentFilterValues = personalGym.map(eq => eq.category.toLowerCase());
        } else if (options.equipment.length > 0) {
            equipmentFilterValues = options.equipment.map(e => e.toLowerCase());
        }

        // Apply equipment inclusion filter if there are any specified
        if (equipmentFilterValues.length > 0) {
            availableExercises = availableExercises.filter(ex => {
                // Always include exercises that don't require any specific equipment
                if (ex.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.bodyweightCalisthenics) !== undefined || (!ex.equipment && (!ex.equipmentNeeded || ex.equipmentNeeded.length === 0))) {
                    return true;
                }

                const exerciseEquipmentLower = (ex.equipment || '').toLowerCase();
                const equipmentNeededLower = (ex.equipmentNeeded || []).map(eq => eq.toLowerCase());

                // Check if the exercise's equipment needs are met by the filter.
                // Using .includes() allows for flexible matching (e.g., "macebell" in the filter will match "Macebells" in the exercise data).
                return equipmentFilterValues.some(filterEq => {
                    if (exerciseEquipmentLower && exerciseEquipmentLower.includes(filterEq)) {
                        return true;
                    }
                    return equipmentNeededLower.some(neededEq => neededEq.includes(filterEq));
                });
            });
        }

        // Filter by Muscles to Avoid
        if (options.avoidMuscles.length > 0) {
            const avoidSet = new Set(options.avoidMuscles);
            availableExercises = availableExercises.filter(ex => ex && ex.primaryMuscleGroup && !avoidSet.has(ex.primaryMuscleGroup));
        }

        // Filter by Target Muscles
        const targetMuscles = this.determineTargetMuscles(options.split, options.targetMuscles);
        if (targetMuscles.size > 0) {
            availableExercises = availableExercises.filter(ex => ex.primaryMuscleGroup && targetMuscles.has(ex.primaryMuscleGroup.toLowerCase()));
        }

        // Apply equipment exclusion filter using the same robust logic
        if (options.excludeEquipment && options.excludeEquipment.length > 0) {
            const excludeValues = options.excludeEquipment.map(eq => eq.toLowerCase());
            availableExercises = availableExercises.filter(ex => {
                const equipmentLower = (ex.equipment || '').toLowerCase();
                const equipmentNeededLower = (ex.equipmentNeeded || []).map(eq => eq.toLowerCase());

                // Keep the exercise only if NONE of its required equipment are in the exclusion list.
                const isExcluded = excludeValues.some(excludedEq =>
                    (equipmentLower.includes(excludedEq)) ||
                    (equipmentNeededLower.some(neededEq => neededEq.includes(excludedEq)))
                );
                return !isExcluded;
            });
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
            case "fullBody":
            default:
                return new Set(['quadriceps', 'hamstrings', 'glutes', 'calves', 'chest', 'lats', 'shoulders', 'biceps', 'triceps', 'lower back', 'traps', 'abs']);
        }
    }

    /**
    * --- CORRECTED METHOD ---
    * Builds a workout from a PRE-FILTERED list of exercises, ensuring variety and respecting all constraints.
    */
    private buildExerciseList(
        allValidExercises: Exercise[],
        options: WorkoutGenerationOptions
    ): WorkoutExercise[] {
        const workout: WorkoutExercise[] = [];
        let totalEstimatedSeconds = 0;
        const targetSeconds = options.duration * 60;
        const maxExercises = 15;

        // 1. Define Goals & Prepare Pools
        // --- START OF FIX ---
        // The ONLY source of truth for equipment goals is now the `allValidExercises` list.
        // This inherently respects all exclusions applied by getSelectableExercises.
        const equipmentGoals = new Set<string>();
        allValidExercises.forEach(ex => {
            if (ex.equipment && ex.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.bodyweightCalisthenics) === undefined) {
                equipmentGoals.add(ex.equipment.toLowerCase());
            }
            // Also consider the equipmentNeeded array if it exists
            (ex.equipmentNeeded || []).forEach(eq => equipmentGoals.add(eq.toLowerCase()));
        });

        const equipmentToInclude = this.shuffleArray(Array.from(equipmentGoals));
        // --- END OF FIX ---

        const remainingExercises = this.shuffleArray(allValidExercises);
        const muscleCounts = new Map<string, number>();

        // 2. Main Loop: Continue until duration is met, we run out of exercises, or hit the limit.
        while (totalEstimatedSeconds < targetSeconds && workout.length < maxExercises && remainingExercises.length > 0) {
            let exerciseToAdd: Exercise | null = null;
            let exerciseIndex = -1;

            // Goal A: Prioritize satisfying an unmet equipment goal from our derived list.
            const unmetEquipment = equipmentToInclude.find(
                eq => !workout.some(wEx => ((wEx as any).exercise.equipment?.toLowerCase() === eq) || ((wEx as any).exercise.equipmentNeeded?.map((e: string) => e.toLowerCase()).includes(eq)))
            );

            if (unmetEquipment) {
                // Find a random valid exercise that satisfies this equipment goal.
                const potentialMatches = this.shuffleArray(
                    remainingExercises.filter(ex =>
                        (ex.equipment?.toLowerCase() === unmetEquipment) || (ex.equipmentNeeded?.map(e => e.toLowerCase()).includes(unmetEquipment)))
                );

                if (potentialMatches.length > 0) {
                    exerciseToAdd = potentialMatches[0];
                    exerciseIndex = remainingExercises.findIndex(ex => ex.id === exerciseToAdd!.id);
                }
            }

            // Goal B: If no equipment goal, or if one couldn't be met, pick any valid exercise from the top.
            if (!exerciseToAdd && remainingExercises.length > 0) {
                exerciseToAdd = remainingExercises[0];
                exerciseIndex = 0;
            }

            if (!exerciseToAdd) {
                break; // No more exercises to evaluate.
            }

            // Remove the candidate from the pool so we don't evaluate it again.
            remainingExercises.splice(exerciseIndex, 1);


            // 3. Validate the chosen exercise against all remaining constraints.
            const muscle = exerciseToAdd.primaryMuscleGroup;
            if (!muscle) {
                continue; // Skip exercises without a primary muscle group.
            }
            const currentMuscleCount = muscleCounts.get(muscle) || 0;

            // Constraint: Muscle group overuse (e.g., no more than 3 chest exercises)
            if (currentMuscleCount >= 3) {
                continue; // Skip, this muscle is over-represented.
            }

            // Constraint: Duration. Check if adding it would exceed the target time.
            const tempWorkoutExercise = this.createWorkoutExercise(exerciseToAdd, options.goal);
            const exerciseDuration = this.workoutService.getEstimatedRoutineDuration({ exercises: [tempWorkoutExercise] } as Routine) * 60;

            if (totalEstimatedSeconds + exerciseDuration > targetSeconds + 120) { // Allow a 2-minute buffer
                continue; // Skip, adding this exercise would make the workout too long.
            }

            // 4. If all checks pass, add the exercise to the workout.
            workout.push(tempWorkoutExercise);
            totalEstimatedSeconds += exerciseDuration;
            if (muscle) {
                muscleCounts.set(muscle?.toString(), currentMuscleCount + 1);
            }
        }

        return this.shuffleArray(workout); // Final shuffle for variety in exercise order.
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
        let duration = 300; // Default duration for cardio/endurance

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
                duration = 600; // Longer duration for endurance goal
                break;
            case 'hypertrophy':
            default:
                numSets = 3;
                repRange = { min: 8, max: 12 };
                rest = 60;
                break;
        }

        let templateSet: Partial<ExerciseTargetSetParams> = {};

        // =================== START OF NEW LOGIC ===================
        if (exercise.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.cardio) !== undefined) {
            templateSet = {
                fieldOrder: [METRIC.duration, METRIC.distance, METRIC.rest],
                targetDuration: durationToExact(duration),
                targetDistance: distanceToExact(1),
            };
        } else if (exercise.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.bodyweightCalisthenics) !== undefined) {
            templateSet = {
                fieldOrder: [METRIC.reps, METRIC.rest],
                targetReps: { type: RepsTargetType.range, min: repRange.min, max: repRange.max },
            };
        } else { // Default for strength-based exercises
            templateSet = {
                fieldOrder: [METRIC.reps, METRIC.weight, METRIC.rest],
                targetReps: { type: RepsTargetType.range, min: repRange.min, max: repRange.max },
                targetWeight: weightToExact(10), // Default placeholder weight
            };
        }
        // =================== END OF NEW LOGIC ===================

        const sets: ExerciseTargetSetParams[] = Array.from({ length: numSets }, () => ({
            id: uuidv4(),
            type: 'standard',
            targetRest: restToExact(rest),
            ...templateSet, // Spread the category-specific properties
        } as ExerciseTargetSetParams));


        const workoutExercise: any = {
            id: uuidv4(),
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            sets: sets,
            supersetId: null,
            supersetOrder: null,
            type: 'standard',
            exercise: exercise
        };

        return workoutExercise as WorkoutExercise;
    }

    /**
   * Creates a WorkoutExercise with a simple, standard set/rep scheme
   * that is appropriate for the exercise's category.
   */
    private createSimpleWorkoutExercise(exercise: Exercise): WorkoutExercise {
        let sets: ExerciseTargetSetParams[];
        const numSets = 3;

        if (exercise.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.cardio) !== undefined) {
            // Cardio exercises get duration and distance
            sets = Array.from({ length: numSets }, () => ({
                id: uuidv4(),
                type: 'standard',
                fieldOrder: [METRIC.duration, METRIC.distance, METRIC.rest],
                targetDuration: durationToExact(300), // Default to 5 minutes
                targetDistance: distanceToExact(1),   // Default to 1 km/mi
                targetRest: restToExact(90),
            }));
        } else if (exercise.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.bodyweightCalisthenics) !== undefined) {
            // Bodyweight exercises get reps but no weight
            sets = Array.from({ length: numSets }, () => ({
                id: uuidv4(),
                type: 'standard',
                fieldOrder: [METRIC.reps, METRIC.rest],
                targetReps: repsNumberToExactRepsTarget(10),
                targetRest: restToExact(60),
            }));
        } else {
            // Default for strength, hypertrophy, etc.
            sets = Array.from({ length: numSets }, () => ({
                id: uuidv4(),
                type: 'standard',
                fieldOrder: [METRIC.reps, METRIC.weight, METRIC.rest],
                targetReps: repsNumberToExactRepsTarget(10),
                targetWeight: weightToExact(10), // A placeholder default weight
                targetRest: restToExact(60),
            }));
        }

        return {
            id: uuidv4(),
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            sets: sets,
            supersetId: null,
            supersetOrder: null,
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