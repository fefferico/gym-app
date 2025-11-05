import { v4 as uuidv4 } from 'uuid';
import { LoggedWorkoutExercise, LoggedSet } from './workout-log.model';
import { WorkoutExercise, ExerciseTargetSetParams, ExerciseTargetExecutionSetParams, METRIC, RepsTargetType } from './workout.model';
import { log } from 'console';
import { distanceToExact, durationToExact, repsTypeToReps, restToExact, weightToExact } from '../services/workout-helper.service';

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
                targetWeight: loggedSet.weightLogged,
                targetDuration: loggedSet.durationLogged,
                targetDistance: loggedSet.distanceLogged,
                targetReps: loggedSet.repsLogged,
                targetRest: loggedSet.restLogged ?? loggedSet.targetRest ?? restToExact(60),
                notes: loggedSet.notes,
                type: loggedSet.type,
                fieldOrder: loggedSet.fieldOrder
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
 * Maps a legacy LoggedSet object to the current model.
 * This function is self-contained and used by the mapper below.
 * @param set The potentially legacy LoggedSet object.
 * @returns A LoggedSet object conforming to the current model.
 */
function mapLegacyLoggedSet(set: any): LoggedSet {
    const newSet: any = { ...set };
    newSet.fieldOrder = Array.isArray(newSet.fieldOrder) ? [...newSet.fieldOrder] : [];

    const migrateMetric = (
        legacyTarget: string,
        newTarget: string,
        legacyLogged: string,
        newLogged: string,
        metricKey: keyof typeof METRIC
    ) => {
        let fieldToAdd = false;
        let value = null;

        if (newSet.hasOwnProperty(legacyTarget) && !newSet.hasOwnProperty(newTarget)) {
            newSet[newTarget] = newSet[legacyTarget];
            delete newSet[legacyTarget];
            fieldToAdd = true;
            value = newSet[newTarget];
        }

        if (newSet.hasOwnProperty(legacyLogged) && !newSet.hasOwnProperty(newLogged)) {
            newSet[newLogged] = newSet[legacyLogged];
            delete newSet[legacyLogged];
            fieldToAdd = true;
            value = newSet[newLogged];
        }

        // convert old numeric fields to target objects (check for strings as well) - TARGET
        if (typeof newSet[newTarget] === 'number' || typeof newSet[newTarget] === 'string') {
            newSet[newTarget] = { type: 'exact', value: Number(newSet[newTarget]) };
            fieldToAdd = true;
            value = newSet[newTarget];
        }
                // convert old numeric fields to target objects (check for strings as well) - LOGGED
        if (typeof newSet[newLogged] === 'number' || typeof newSet[newLogged] === 'string') {
            newSet[newLogged] = { type: 'exact', value: Number(newSet[newLogged]) };
            fieldToAdd = true;
            value = newSet[newLogged];
        }

        // handle old cases
        if (fieldToAdd && !newSet.fieldOrder.includes(metricKey)) {
            newSet.fieldOrder.push(METRIC[metricKey]);
        }
        // handle new cases
        if (newSet.hasOwnProperty(newLogged) && !newSet.fieldOrder.includes(metricKey)) {
            value = newSet[newLogged];
            newSet.fieldOrder.push(METRIC[metricKey]);
        }

        if (!value) {
            newSet.fieldOrder = newSet.fieldOrder.filter((metric: METRIC) => metric !== METRIC[metricKey]);
        }
    };

    migrateMetric('reps', 'targetReps', 'repsAchieved', 'repsLogged', 'reps');
    migrateMetric('weight', 'targetWeight', 'weightUsed', 'weightLogged', 'weight');
    migrateMetric('duration', 'targetDuration', 'durationPerformed', 'durationLogged', 'duration');
    migrateMetric('distance', 'targetDistance', 'distanceAchieved', 'distanceLogged', 'distance');

    // Handle rest separately due to its more complex legacy structure
    let restFieldToAdd = false;
    let restValue = null;

    if (newSet.targetRest == null) {
        if (typeof newSet.targetRestAfterSet === 'number') {
            newSet.targetRest = newSet.targetRestAfterSet;
            restFieldToAdd = true;
            restValue = newSet.targetRest;
        } else if (typeof newSet.restAfterSet === 'number') {
            newSet.targetRest = newSet.restAfterSet;
            restFieldToAdd = true;
            restValue = newSet.targetRest;
        }
    }

    if (newSet.restLogged == null) {
        if (typeof newSet.restLogged === 'number') {
            restFieldToAdd = true;
            restValue = newSet.restLogged;
        } else if (typeof newSet.targetRestAfterSet === 'number') {
            newSet.restLogged = newSet.targetRestAfterSet;
            restFieldToAdd = true;
            restValue = newSet.restLogged;
        }
    }

    if (restFieldToAdd && !newSet.fieldOrder.includes('rest')) {
        newSet.fieldOrder.push(METRIC.rest);
    }

    // handle new cases
    if (newSet.hasOwnProperty('restLogged') && !newSet.fieldOrder.includes(METRIC.rest)) {
        restValue = newSet['restLogged'];
        newSet.fieldOrder.push(METRIC.rest);
    }

    if (!restValue) {
        newSet.fieldOrder = newSet.fieldOrder.filter((metric: METRIC) => metric !== METRIC.rest);
    }

    delete newSet.targetRestAfterSet;
    delete newSet.restAfterSet;

    if (!newSet.hasOwnProperty('type')) {
        newSet.type = 'standard';
    }

    return newSet;
}


/**
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
): ExerciseTargetExecutionSetParams {
    return {
        id: exerciseTargetSetParams.id,
        type: exerciseTargetSetParams.type,
        targetReps: repsTypeToReps(exerciseTargetSetParams.targetReps) || {type: RepsTargetType.exact, value: 0},
        targetWeight: exerciseTargetSetParams.targetWeight || weightToExact(0),
        targetDistance: exerciseTargetSetParams.targetDistance || distanceToExact(0),
        targetDuration: exerciseTargetSetParams.targetDuration || durationToExact(0),
        targetRest: exerciseTargetSetParams.targetRest || restToExact(0),
        notes: exerciseTargetSetParams.notes || '',
        tempo: exerciseTargetSetParams.targetTempo
    } as ExerciseTargetExecutionSetParams;
}

/**
 * Maps a single WorkoutExercise (from a plan) to a LoggedWorkoutExercise.
 * This is used to create the initial structure of a single workout log entry when
 * an exercise is started or added mid-session.
 * The `sets` array will be empty, ready to be populated as the user completes them.
 *
 * @param planExercise The WorkoutExercise object from a Routine.
 * @returns A LoggedWorkoutExercise representing the initial state of the log for that exercise.
 */
export function mapWorkoutExerciseToLoggedWorkoutExercise(
    planExercise: WorkoutExercise
): LoggedWorkoutExercise {
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
    };

    return loggedExercise;
}

/**
 * Maps a single LoggedWorkoutExercise back to a WorkoutExercise format.
 * This is useful for creating a new routine based on a completed workout,
 * where the actual performance becomes the target for the new plan.
 *
 * @param loggedExercise The logged exercise data.
 * @returns A WorkoutExercise object ready to be included in a new Routine.
 */
export function mapLoggedWorkoutExerciseToWorkoutExercise(
    loggedExercise: LoggedWorkoutExercise
): WorkoutExercise {

    // Map each logged set to a new planned set (ExerciseTargetSetParams).
    const mappedSets: ExerciseTargetSetParams[] = loggedExercise.sets.map((loggedSet): ExerciseTargetSetParams => mapLoggedSetToExerciseTargetSetParams(loggedSet));

    // Construct the new WorkoutExercise for the routine.
    const newWorkoutExercise: WorkoutExercise = {
        id: uuidv4(), // This new instance within a routine gets its own unique ID.
        exerciseId: loggedExercise.exerciseId,
        exerciseName: loggedExercise.exerciseName,
        sets: mappedSets,
        notes: loggedExercise.notes,
        type: loggedExercise.type,

        // Carry over the superset structure information.
        supersetId: loggedExercise.supersetId || null,
        supersetOrder: loggedExercise.supersetOrder ?? null,

        // These properties are specific to the routine's structure and are not present in the log.
        // They are initialized to null and can be configured later if needed.
        supersetType: null,
        emomTimeSeconds: null,
    };

    return newWorkoutExercise;
}

/**
 * Maps a single LoggedSet back to an ExerciseTargetSetParams format.
 * This function is key for converting workout history into a new, editable routine plan.
 *
 * @param loggedSet The logged set data representing actual performance.
 * @returns An ExerciseTargetSetParams object for a new routine.
 */
export function mapLoggedSetToExerciseTargetSetParams(loggedSet: LoggedSet): ExerciseTargetSetParams {
    return {
        id: uuidv4(), // A new plan requires a new unique ID for the set.

        // --- Core Mapping Logic ---
        // The user's actual performance becomes the target for the new plan.
        targetReps: loggedSet.repsLogged,
        targetWeight: loggedSet.weightLogged,
        targetDuration: loggedSet.durationLogged,
        targetDistance: loggedSet.distanceLogged,
        targetRest: loggedSet.restLogged,
        targetRpe: loggedSet.rpe,
        targetTempo: loggedSet.tempoLogged,

        // Set other optional target values to null as they are not explicitly tracked
        // in the single performance log entry. These can be refined in the routine editor.
        dropToWeight: null,
        amrapTimeLimit: null,

        // Map other relevant properties directly.
        notes: loggedSet.notes,
        type: loggedSet.type,
        fieldOrder: loggedSet.fieldOrder,

        // Use the actual rest time used, with fallbacks to the original target or a default value.
    };
}