import { v4 as uuidv4 } from 'uuid';
import { LoggedWorkoutExercise, LoggedSet } from './workout-log.model';
import { WorkoutExercise, ExerciseTargetSetParams, ExerciseExecutionSetParams } from './workout.model';

/**
 * Maps an array of logged exercises back into a routine snapshot format.
 * This is useful for reconstructing the state of a workout plan from its log,
 * for example, when resuming a paused session.
 *
 * @param loggedExercises The array of exercises as they were logged.
 * @returns An array of WorkoutExercise suitable for use as a routine snapshot.
 */
export function mapLoggedExercisesToRoutineSnapshot(
    loggedExercises: LoggedWorkoutExercise[]
): WorkoutExercise[] {

    if (!loggedExercises || loggedExercises.length === 0) {
        return [];
    }

    return loggedExercises.map((loggedEx): WorkoutExercise => {
        // Map each logged set back to the format of a planned set (ExerciseSetParams).
        const mappedSets: ExerciseTargetSetParams[] = loggedEx.sets.map((loggedSet): ExerciseTargetSetParams => {
            return {
                // If the logged set was based on a planned set, reuse its ID to maintain consistency.
                // Otherwise, generate a new ID for this ad-hoc set.
                id: loggedSet.plannedSetId || uuidv4(),

                // The values of the new "plan" should be what the user actually achieved.
                targetRpe: loggedSet.rpe,
                targetWeight: loggedSet.weightUsed,
                targetDuration: loggedSet.durationPerformed,
                targetDistance: loggedSet.distanceAchieved,
                targetReps: loggedSet.repsAchieved, // <<< UPDATED to include reps
                notes: loggedSet.notes,
                type: loggedSet.type,

                // The 'restAfterSet' is required. Prioritize what was used, then the target, then a default.
                restAfterSet: loggedSet.restAfterSetUsed ?? loggedSet.targetRestAfterSet ?? 60,

                // Carry over target values if they exist, in case they are needed.
            };
        });

        // Construct the WorkoutExercise object for the routine.
        const workoutExercise: WorkoutExercise = {
            // Each exercise instance within a routine needs its own unique ID.
            // We generate a new one here as the logged exercise ID refers to the base exercise.
            id: uuidv4(),
            exerciseId: loggedEx.exerciseId,
            exerciseName: loggedEx.exerciseName,
            sets: mappedSets,
            notes: loggedEx.notes,
            type: loggedEx.type,
            // Map superset properties
            supersetId: loggedEx.supersetId || null,
            supersetOrder: loggedEx.supersetOrder ?? null,
        };

        return workoutExercise;
    });


}


/**
 * Maps a routine snapshot (the plan) to an initial array of logged exercises.
 * This is used to create the initial structure of a workout log when a session starts.
 * The `sets` array for each logged exercise will be empty, ready to be populated as the user completes them.
 *
 * @param routineSnapshot The array of exercises from a Routine object.
 * @returns An array of LoggedWorkoutExercise representing the initial state of the log.
 */
export function mapRoutineSnapshotToLoggedExercises(
    routineSnapshot: WorkoutExercise[]
): LoggedWorkoutExercise[] {

    if (!routineSnapshot || routineSnapshot.length === 0) {
        return [];
    }

    return routineSnapshot.map((planExercise): LoggedWorkoutExercise => {
        const loggedExercise: LoggedWorkoutExercise = {
            // Use the routine's exercise instance ID to link this log entry back to the specific
            // instance in the plan. This is useful if the same exercise appears multiple times.
            id: planExercise.id,

            // The canonical ID of the base exercise, used for long-term tracking.
            exerciseId: planExercise.exerciseId,
            exerciseName: planExercise.exerciseName || 'Unnamed Exercise',

            // CRITICAL: The log starts with zero completed sets.
            // This array will be filled as the user performs and logs each set.
            sets: [],

            notes: planExercise.notes,
            type: planExercise.type,

            // Directly map all superset properties from the plan to the log structure.
            supersetId: planExercise.supersetId || null,
            supersetOrder: planExercise.supersetOrder ?? null,

            // This is a runtime state property that tracks progress through a superset.
            // It should be initialized to null or 0.
        };

        return loggedExercise;
    });
}


/**
 * --- NEW ---
 * Maps a legacy LoggedSet object to the current model.
 * This function is self-contained and used by the mapper below.
 * @param set The potentially legacy LoggedSet object.
 * @returns A LoggedSet object conforming to the current model.
 */
function mapLegacyLoggedSet(set: any): LoggedSet {
    const newSet: any = { ...set };
    // const newSet: LoggedSet = { ...set };

    // Map legacy target properties to their new names.
    if (newSet.hasOwnProperty('reps') && !newSet.hasOwnProperty('targetReps')) {
        newSet.targetReps = newSet.reps;
        delete newSet.reps;
    }
    if (newSet.hasOwnProperty('weight') && !newSet.hasOwnProperty('targetWeight')) {
        newSet.targetWeight = newSet.weight;
        delete newSet.weight;
    }
    if (newSet.hasOwnProperty('duration') && !newSet.hasOwnProperty('targetDuration')) {
        newSet.targetDuration = newSet.duration;
        delete newSet.duration;
    }
    if (newSet.hasOwnProperty('distance') && !newSet.hasOwnProperty('targetDistance')) {
        newSet.targetDistance = newSet.distance;
        delete newSet.distance;
    }

    return newSet;
}


/**
 * --- NEW ---
 * Maps an array of potentially legacy logged exercises to the current data model.
 * This is crucial for importing old workout logs where target properties might have
 * different names (e.g., 'reps' instead of 'targetReps').
 *
 * @param legacyLoggedExercises The array of logged exercises from an import.
 * @returns An array of LoggedWorkoutExercise conforming to the current data model.
 */
export function mapLegacyLoggedExercisesToCurrent(
    legacyLoggedExercises: LoggedWorkoutExercise[]
): LoggedWorkoutExercise[] {
    if (!legacyLoggedExercises || !Array.isArray(legacyLoggedExercises)) {
        return [];
    }

    return legacyLoggedExercises.map((loggedEx): LoggedWorkoutExercise => {
        const updatedLoggedEx = { ...loggedEx };

        if (updatedLoggedEx.sets && Array.isArray(updatedLoggedEx.sets)) {
            // Map each set within the logged exercise using the helper
            updatedLoggedEx.sets = updatedLoggedEx.sets.map(mapLegacyLoggedSet);
        }

        return updatedLoggedEx;
    });
}

export function mapExerciseTargetSetParamsToExerciseExecutedSetParams(exerciseTargetSetParams: ExerciseTargetSetParams
): ExerciseExecutionSetParams {
    return {
        id: exerciseTargetSetParams.id,
        restAfterSet: exerciseTargetSetParams.restAfterSet,
        type: exerciseTargetSetParams.type,
        actualDistance: exerciseTargetSetParams.targetDistance || exerciseTargetSetParams.targetDistanceMin || 0,
        actualDuration: exerciseTargetSetParams.targetDuration || exerciseTargetSetParams.targetDurationMin || 0,
        weightUsed: exerciseTargetSetParams.targetWeight || exerciseTargetSetParams.targetWeightMin || 0,
        repsAchieved: exerciseTargetSetParams.targetReps || exerciseTargetSetParams.targetRepsMin || 0,
        notes: exerciseTargetSetParams.notes || '',
        tempo: exerciseTargetSetParams.tempo
    } as ExerciseExecutionSetParams;
}