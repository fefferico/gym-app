import { inject, Injectable, Injector } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, AbstractControl } from '@angular/forms';
import { WorkoutExercise, ExerciseTargetSetParams } from '../models/workout.model';
import { LoggedSet, LoggedWorkoutExercise } from '../models/workout-log.model';
import { UnitsService } from './units.service';
import { TranslateService } from '@ngx-translate/core';
import { AppSettingsService } from './app-settings.service';
import { WorkoutUtilsService } from './workout-utils.service';

@Injectable({ providedIn: 'root' })
export class WorkoutFormService {
    
    private unitsService = inject(UnitsService);
    private translate = inject(TranslateService);
    private workoutUtilsService = inject(WorkoutUtilsService);


    private appSettingsService = inject(AppSettingsService);
    private injector = inject(Injector);
    constructor(private fb: FormBuilder) { }

    // NOTE: You must inject dependencies like unitService, workoutUtilsService, etc. from the component when calling these methods.
    createSetFormGroup(
        setData?: ExerciseTargetSetParams | LoggedSet,
        forLogging: boolean = false,
        targetMinValidator?: (min: number) => any,
        createRangeValidator?: () => any
    ): FormGroup {
        let id = (setData && setData.id) || (typeof crypto !== 'undefined' ? crypto.randomUUID() : '');
        let fieldOrderValue: any = setData?.fieldOrder || [/* default METRIC values */];
        let notesValue = setData?.notes || '';
        let typeValue = setData?.type || 'standard';
        let tempoValue = 'targetTempo' in (setData || {}) ? (setData as any).targetTempo || '' : '';
        let plannedSetIdValue: string | undefined;
        let timestampValue = new Date().toISOString();

        // Simplified value determination based on mode
        let repsValue: any;
        let weightValue: any;
        let durationValue: any;
        let distanceValue: any;
        let restValue: any;
        let targetTempoValue: string | undefined;

        if (setData) {
            // Type guards
            const isLoggedSet = (obj: any): obj is LoggedSet => 'repsLogged' in obj;
            const isExerciseTargetSetParams = (obj: any): obj is ExerciseTargetSetParams => 'targetReps' in obj;

            if (forLogging) {
                // Log mode: Use logged values from setData, falling back to target values if logged is null/undefined
                const loggedData = setData as LoggedSet;
                const targetData = setData as ExerciseTargetSetParams;
                repsValue = loggedData.repsLogged ?? targetData.targetReps ?? null;
                weightValue = loggedData.weightLogged ?? targetData.targetWeight ?? null;
                durationValue = loggedData.durationLogged ?? targetData.targetDuration ?? null;
                distanceValue = loggedData.distanceLogged ?? targetData.targetDistance ?? null;
                restValue = loggedData.restLogged ?? targetData.targetRest ?? null;
                plannedSetIdValue = loggedData.plannedSetId;
                timestampValue = loggedData.timestamp;
            } else {
                // Routine mode: Use target values from setData (ExerciseTargetSetParams takes priority)
                const targetData = setData as ExerciseTargetSetParams;
                repsValue = targetData.targetReps ?? null;
                weightValue = targetData.targetWeight ?? null;
                durationValue = targetData.targetDuration ?? null;
                distanceValue = targetData.targetDistance ?? null;
                restValue = targetData.targetRest ?? null;
                plannedSetIdValue = targetData.id;
            }
        }

        // fieldOrder fallback logic omitted for brevity

        const setDataBk = { ...setData } as any;
        // rest fieldOrder logic omitted for brevity

        const formGroupConfig: { [key: string]: any } = {
            id: [id],
            type: [typeValue],
            notes: [notesValue || ''],
            fieldOrder: [fieldOrderValue || []]
        };

        if (forLogging) {
            formGroupConfig['repsLogged'] = [
                repsValue ?? null,
                [
                    (control: AbstractControl) => {
                        const parent = control.parent;
                        if (!parent) return null;
                        const weightLogged = parent.get('weightLogged')?.value;
                        const durationLogged = parent.get('durationLogged')?.value;
                        if ((weightLogged == null || weightLogged === '') && (durationLogged == null || durationLogged === '')) {
                            return typeof targetMinValidator === 'function' ? targetMinValidator(1)(control) : null;
                        }
                        return null;
                    },
                ]
            ];
            formGroupConfig['weightLogged'] = [weightValue ?? null];
            formGroupConfig['durationLogged'] = [durationValue ?? null];
            formGroupConfig['distanceLogged'] = [distanceValue ?? null];
            formGroupConfig['plannedSetId'] = [plannedSetIdValue];
            formGroupConfig['timestamp'] = [timestampValue];
            formGroupConfig['tempo'] = [tempoValue];
            formGroupConfig['restLogged'] = [restValue];
        } else {
            // Routine mode logic (keep as is, but use repsValue, etc.)
            let initialRepsTarget: any = null;
            if (setDataBk.targetReps && typeof setDataBk.targetReps === 'object') {
                initialRepsTarget = setDataBk.targetReps;
            } else if (setDataBk.min != null && setDataBk.max != null) {
                initialRepsTarget = { type: 'range', min: setDataBk.min, max: setDataBk.max };
            } else if (setDataBk.targetReps != null) {
                initialRepsTarget = { type: 'exact', value: setDataBk.targetReps };
            }
            formGroupConfig['targetReps'] = [initialRepsTarget];
            formGroupConfig['targetWeight'] = [weightValue ?? null];
            formGroupConfig['targetDuration'] = [durationValue ?? null];
            formGroupConfig['targetDistance'] = [distanceValue ?? null];
            formGroupConfig['targetRest'] = [restValue ?? null];
            formGroupConfig['targetTempo'] = [tempoValue ?? null];
        }

        const groupOptions = forLogging ? {} : { validators: typeof createRangeValidator === 'function' ? createRangeValidator() : null };
        return this.fb.group(formGroupConfig, groupOptions);
    }

    createExerciseFormGroup(
        exerciseData?: WorkoutExercise,
        isFromRoutineTemplate: boolean = false,
        forLogging: boolean = false,
        availableExercises?: any[],
        unitService?: any,
        workoutUtilsService?: any,
        targetMinValidator?: (min: number) => any,
        createRangeValidator?: () => any
    ): FormGroup {
        const baseExercise = exerciseData?.exerciseId ? availableExercises?.find(e => e.id === exerciseData.exerciseId) : null;
        const sets = exerciseData?.sets || [];
        const fg = this.fb.group({
            id: [exerciseData?.id],
            exerciseId: [exerciseData?.exerciseId],
            exerciseName: [baseExercise?.name || exerciseData?.exerciseName],
            notes: [exerciseData?.notes || ''],
            sets: this.fb.array(
                sets.map(set => this.createSetFormGroup(set, forLogging, targetMinValidator, createRangeValidator))
            ),
            supersetId: [exerciseData?.supersetId || null],
            supersetOrder: [exerciseData?.supersetOrder ?? null],
            supersetType: [exerciseData?.supersetType ?? 'standard'],
            emomTimeSeconds: [exerciseData?.emomTimeSeconds ?? null]
        }) as FormGroup;
        return fg;
    }

    createExerciseFormGroupFromLoggedExercise(
        loggedEx: LoggedWorkoutExercise,
        availableExercises?: any[],
        unitService?: any,
        workoutUtilsService?: any,
        targetMinValidator?: (min: number) => any,
        createRangeValidator?: () => any
    ): FormGroup {
        const baseExercise = availableExercises?.find(e => e.id === loggedEx.exerciseId);
        const fg = this.fb.group({
            id: [loggedEx.id],
            exerciseId: [loggedEx.exerciseId],
            exerciseName: [baseExercise?.name || loggedEx.exerciseName],
            notes: [loggedEx.notes || ''],
            sets: this.fb.array(loggedEx.sets.map(set => this.createSetFormGroup(set, true, targetMinValidator, createRangeValidator))),
            supersetId: [loggedEx.supersetId || null],
            supersetOrder: [loggedEx.supersetOrder ?? null],
            supersetType: [loggedEx.supersetType ?? 'standard'],
            emomTimeSeconds: [loggedEx.emomTimeSeconds ?? null]
        });
        return fg;
    }

    getSetsFormArray(exerciseControl: FormGroup | AbstractControl): FormArray {
        return (exerciseControl.get('sets') as FormArray) ?? this.fb.array([]);
    }
}
