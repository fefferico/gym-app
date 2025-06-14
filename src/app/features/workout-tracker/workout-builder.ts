import { Component, inject, OnInit, OnDestroy, signal, computed, ElementRef, QueryList, ViewChildren, AfterViewInit, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, DecimalPipe, isPlatformBrowser, TitleCasePipe } from '@angular/common'; // Added TitleCasePipe
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, AbstractControl, FormsModule } from '@angular/forms';
import { Subscription, of, firstValueFrom } from 'rxjs';
import { switchMap, tap, take } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, isValid as isValidDate } from 'date-fns';

import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

import { Routine, ExerciseSetParams, WorkoutExercise } from '../../core/models/workout.model';
import { Exercise } from '../../core/models/exercise.model';
import { WorkoutLog, LoggedWorkoutExercise, LoggedSet } from '../../core/models/workout-log.model'; // For manual log
import { WorkoutService } from '../../core/services/workout.service';
import { ExerciseService } from '../../core/services/exercise.service';
import { UnitsService } from '../../core/services/units.service';
import { WeightUnitPipe } from '../../shared/pipes/weight-unit-pipe';
import { SpinnerService } from '../../core/services/spinner.service';
import { AlertService } from '../../core/services/alert.service';
import { ToastService } from '../../core/services/toast.service';
import { TrackingService } from '../../core/services/tracking.service'; // For manual log

type BuilderMode = 'routineBuilder' | 'manualLogEntry';

@Component({
  selector: 'app-workout-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule, DragDropModule, WeightUnitPipe, TitleCasePipe],
  templateUrl: './workout-builder.html',
  styleUrl: './workout-builder.scss',
  providers: [DecimalPipe]
})
export class WorkoutBuilderComponent implements OnInit, OnDestroy, AfterViewInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  protected unitsService = inject(UnitsService);
  protected spinnerService = inject(SpinnerService);
  protected alertService = inject(AlertService);
  protected toastService = inject(ToastService);
  private trackingService = inject(TrackingService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  @ViewChildren('setRepsInput') setRepsInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChildren('expandedSetElement') expandedSetElements!: QueryList<ElementRef<HTMLDivElement>>;

  builderForm!: FormGroup;
  mode: BuilderMode = 'routineBuilder';
  isEditMode = false;
  isNewMode = true;
  isViewMode = false; // Only for routineBuilder mode
  currentRoutineId: string | null = null; // For editing/viewing a Routine
  currentLogId: string | null = null;     // For editing a WorkoutLog
  private routeSub: Subscription | undefined;
  private initialRoutineIdForLogEdit: string | null | undefined = undefined; // For log edit mode

  expandedSetPath = signal<{ exerciseIndex: number, setIndex: number } | null>(null);

  availableSetTypes: { value: string, label: string }[] = [
    { value: 'standard', label: 'Standard' },
    { value: 'warmup', label: 'Warm-up' },
    { value: 'amrap', label: 'AMRAP' },
    { value: 'dropset', label: 'Dropset' },
    { value: 'failure', label: 'To Failure' },
    { value: 'myorep', label: 'Myo-rep' },
    { value: 'restpause', label: 'Rest-Pause' },
    { value: 'custom', label: 'Custom Type' }
  ];
  routineGoals: { value: Routine['goal'], label: string }[] = [
    { value: 'hypertrophy', label: 'Hypertrophy' }, { value: 'strength', label: 'Strength' },
    { value: 'muscular endurance', label: 'Muscular endurance' }, { value: 'cardiovascular endurance', label: 'Cardiovascular endurance' },
    { value: 'fat loss / body composition', label: 'Fat loss / body composition' }, { value: 'mobility & flexibility', label: 'Mobility & flexibility' },
    { value: 'power / explosiveness', label: 'Power / explosiveness' }, { value: 'speed & agility', label: 'Speed & agility' },
    { value: 'balance & coordination', label: 'Balance & coordination' }, { value: 'skill acquisition', label: 'Skill acquisition' },
    { value: 'rehabilitation / injury prevention', label: 'Rehabilitation / injury prevention' }, { value: 'mental health / stress relief', label: 'Mental health' },
    { value: 'general health & longevity', label: 'General health & longevity' }, { value: 'sport-specific performance', label: 'Sport-specific performance' },
    { value: 'maintenance', label: 'Maintenance' }, { value: 'rest', label: 'Rest' }, { value: 'custom', label: 'Custom' }
  ];

  isExerciseModalOpen = false;
  availableExercises: Exercise[] = [];
  availableRoutines: Routine[] = []; // For selecting a base routine when logging manually
  modalSearchTerm = signal('');
  filteredAvailableExercises = computed(() => {
    const term = this.modalSearchTerm().toLowerCase();
    if (!term) return this.availableExercises;
    return this.availableExercises.filter(ex =>
      ex.name.toLowerCase().includes(term) ||
      ex.category.toLowerCase().includes(term) ||
      (ex.primaryMuscleGroup && ex.primaryMuscleGroup.toLowerCase().includes(term))
    );
  });
  selectedExerciseIndicesForSuperset = signal<number[]>([]);

  constructor() {
    this.builderForm = this.fb.group({
      name: [''], // Validated based on mode
      description: [''], // Only for routineBuilder
      goal: ['custom' as Routine['goal']], // Only for routineBuilder

      workoutDate: [''], // Only for manualLogEntry
      startTime: [''],   // Only for manualLogEntry
      durationMinutes: [60, [Validators.min(1)]], // Only for manualLogEntry
      overallNotesLog: [''], // Only for manualLogEntry
      routineIdForLog: [''], // For selecting base routine in manualLogEntry

      exercises: this.fb.array([]), // Validated based on mode/goal
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) { window.scrollTo(0, 0); }
    this.loadAvailableExercises(); // For exercise selection modal
    this.workoutService.routines$.pipe(take(1)).subscribe(routines => this.availableRoutines = routines); // For routine selection in log mode

    this.routeSub = this.route.data.pipe(
      switchMap(data => {
        this.mode = data['mode'] as BuilderMode || 'routineBuilder';
        this.isNewMode = data['isNew'] === true; // True if creating new (Routine or Log)
        console.log(`Builder ngOnInit: Mode=${this.mode}, isNewMode=${this.isNewMode}`);

        this.currentRoutineId = this.route.snapshot.paramMap.get('routineId'); // For editing/viewing a Routine, or prefilling a Log
        this.currentLogId = this.route.snapshot.paramMap.get('logId');         // For editing a WorkoutLog

        // isViewMode is specific to viewing a Routine template
        this.isViewMode = (this.mode === 'routineBuilder' && !!this.currentRoutineId && !this.isNewMode && this.route.snapshot.routeConfig?.path?.includes('view')) || false;
        // isEditMode is true if not new and not view (i.e. editing a routine or a log)
        this.isEditMode = !this.isNewMode && !this.isViewMode;

        this.configureFormValidatorsAndFieldsForMode();
        this.expandedSetPath.set(null);
        this.exercisesFormArray.clear({ emitEvent: false }); // Clear before reset
        this.builderForm.reset(this.getDefaultFormValuesForMode(), { emitEvent: false });

        if (this.mode === 'routineBuilder') {
          if (this.currentRoutineId && (this.isEditMode || this.isViewMode)) { // Editing or Viewing a Routine
            return this.workoutService.getRoutineById(this.currentRoutineId);
          }
        } else if (this.mode === 'manualLogEntry') {
          if (this.currentLogId && this.isEditMode) { // Editing an existing Log
            return this.trackingService.getWorkoutLogById(this.currentLogId);
          } else if (this.currentRoutineId && this.isNewMode) { // New Log, prefilling from a Routine
            return this.workoutService.getRoutineById(this.currentRoutineId);
          }
        }
        return of(null); // New Routine or New Ad-hoc Log
      }),
      tap(loadedData => { // data can be Routine, WorkoutLog, or null
        if (loadedData) {
          if (this.mode === 'routineBuilder') {
            this.patchFormWithRoutineData(loadedData as Routine);
          } else if (this.mode === 'manualLogEntry' && this.isEditMode && this.currentLogId) {
            this.patchFormWithLogData(loadedData as WorkoutLog);
          } else if (this.mode === 'manualLogEntry' && this.isNewMode && this.currentRoutineId) {
            this.prefillLogFormFromRoutine(loadedData as Routine);
          }
        } else if (!this.isNewMode && (this.currentRoutineId || this.currentLogId)) {
          this.toastService.error(`Data not found.`, 0, "Error");
          this.router.navigate([this.mode === 'routineBuilder' ? '/workout' : '/history/list']);
        }

        if (this.isViewMode) this.toggleFormState(true);
        else this.toggleFormState(false); // Enable for new/edit modes
      })
    ).subscribe();

    if (this.mode === 'manualLogEntry') {
      this.builderForm.get('routineIdForLog')?.valueChanges.subscribe(routineId => {
        if (this.isEditMode && routineId === this.initialRoutineIdForLogEdit && !this.builderForm.get('routineIdForLog')?.dirty) {
          return;
        }
        const selectedRoutine = this.availableRoutines.find(r => r.id === routineId);
        if (selectedRoutine) {
          this.prefillLogFormFromRoutine(selectedRoutine, false); // Don't reset date/time if user already set them
        } else {
          this.exercisesFormArray.clear();
          // If user deselects routine, workout name might become editable or clear
          if (!this.isEditMode) this.builderForm.get('name')?.setValue('Ad-hoc Workout');
        }
      });
    }

    this.builderForm.get('goal')?.valueChanges.subscribe(goalValue => {
      if (this.mode === 'routineBuilder' && goalValue === 'rest') {
        while (this.exercisesFormArray.length) this.exercisesFormArray.removeAt(0);
        this.exercisesFormArray.clearValidators();
      }
      this.exercisesFormArray.updateValueAndValidity();
    });
  }

  private getDefaultFormValuesForMode(): any { /* ... (as previously defined) ... */
    if (this.mode === 'manualLogEntry') {
      const today = new Date();
      return {
        name: '', description: '', goal: 'custom',
        workoutDate: format(today, 'yyyy-MM-dd'),
        startTime: format(today, 'HH:mm'),
        durationMinutes: 60,
        overallNotesLog: '',
        routineIdForLog: '',
        exercises: []
      };
    } else { // routineBuilder
      return {
        name: '', description: '', goal: 'custom',
        workoutDate: '', startTime: '', durationMinutes: 60, overallNotesLog: '', routineIdForLog: '',
        exercises: []
      };
    }
  }

  private configureFormValidatorsAndFieldsForMode(): void { /* ... (as previously defined) ... */
    const nameCtrl = this.builderForm.get('name');
    const goalCtrl = this.builderForm.get('goal');
    const dateCtrl = this.builderForm.get('workoutDate');
    const timeCtrl = this.builderForm.get('startTime');
    const durationCtrl = this.builderForm.get('durationMinutes');

    nameCtrl?.clearValidators();
    goalCtrl?.clearValidators();
    dateCtrl?.clearValidators();
    timeCtrl?.clearValidators();
    durationCtrl?.clearValidators();


    if (this.mode === 'routineBuilder') {
      nameCtrl?.setValidators(Validators.required);
      goalCtrl?.setValidators(Validators.required);
      this.builderForm.get('exercises')?.setValidators(Validators.nullValidator); // Exercises not strictly required if goal is 'rest'
    } else { // manualLogEntry
      dateCtrl?.setValidators(Validators.required);
      timeCtrl?.setValidators(Validators.required);
      durationCtrl?.setValidators([Validators.required, Validators.min(1)]);
      this.builderForm.get('exercises')?.setValidators(Validators.required); // Exercises always required for a log
    }
    this.builderForm.updateValueAndValidity({ emitEvent: false });
  }

  private toggleFormState(disable: boolean): void {
    if (disable) {
      this.builderForm.disable({ emitEvent: false });
    } else {
      this.builderForm.enable({ emitEvent: false });
      // Specific field disabling based on mode after enabling all
      if (this.mode === 'routineBuilder') {
        this.builderForm.get('workoutDate')?.disable({ emitEvent: false });
        this.builderForm.get('startTime')?.disable({ emitEvent: false });
        this.builderForm.get('durationMinutes')?.disable({ emitEvent: false });
        this.builderForm.get('overallNotesLog')?.disable({ emitEvent: false });
        this.builderForm.get('routineIdForLog')?.disable({ emitEvent: false });
      } else { // manualLogEntry
        // Name field is used for WorkoutLog's title, so it should be enabled or prefilled
        // this.builderForm.get('name')?.enable({ emitEvent: false });
        this.builderForm.get('description')?.disable({ emitEvent: false });
        this.builderForm.get('goal')?.disable({ emitEvent: false });
      }
      this.exercisesFormArray.controls.forEach(exCtrl => {
        this.updateRoundsControlability(exCtrl as FormGroup);
      });
    }
  }

  get exercisesFormArray(): FormArray { return this.builderForm.get('exercises') as FormArray; }
  getSetsFormArray(exerciseControl: AbstractControl): FormArray { return exerciseControl.get('sets') as FormArray; }
  private loadAvailableExercises(): void { this.exerciseService.getExercises().pipe(take(1)).subscribe(exs => this.availableExercises = exs); }

  patchFormWithRoutineData(routine: Routine): void {
    this.builderForm.patchValue({
      name: routine.name,
      description: routine.description,
      goal: routine.goal,
    }, { emitEvent: false });
    this.exercisesFormArray.clear({ emitEvent: false });
    routine.exercises.forEach(exerciseData => {
      this.exercisesFormArray.push(this.createExerciseFormGroup(exerciseData, true, false), { emitEvent: false });
    });
    this.builderForm.markAsPristine();
  }

  patchFormWithLogData(log: WorkoutLog): void {
    this.initialRoutineIdForLogEdit = log.routineId;
    this.builderForm.patchValue({
      name: log.routineName || 'Logged Workout',
      workoutDate: format(parseISO(log.date), 'yyyy-MM-dd'),
      startTime: format(new Date(log.startTime), 'HH:mm'),
      durationMinutes: log.durationMinutes || 60,
      overallNotesLog: log.notes || '',
      routineIdForLog: log.routineId || '',
    }, { emitEvent: false });

    this.exercisesFormArray.clear({ emitEvent: false });
    log.exercises.forEach(loggedEx => {
      // createExerciseFormGroupFromLog will call createSetFormGroup with forLogging=true
      this.exercisesFormArray.push(this.createExerciseFormGroupFromLog(loggedEx), { emitEvent: false });
    });

    this.toggleFormState(false);
    this.expandedSetPath.set(null);
    this.builderForm.markAsPristine();
  }
  prefillLogFormFromRoutine(routine: Routine, resetDateTime: boolean = true): void {
    const patchData: any = {
      name: `Log: ${routine.name}`,
      routineIdForLog: routine.id,
    };
    if (resetDateTime) {
      const today = new Date();
      patchData.workoutDate = format(today, 'yyyy-MM-dd');
      patchData.startTime = format(today, 'HH:mm');
      patchData.durationMinutes = 60;
    }
    this.builderForm.patchValue(patchData, { emitEvent: false });
    this.exercisesFormArray.clear({ emitEvent: false });
    routine.exercises.forEach(routineEx => {
      this.exercisesFormArray.push(this.createExerciseFormGroup(routineEx, false, true), { emitEvent: false });
    });
    this.builderForm.markAsDirty();
  }

  private createExerciseFormGroup(exerciseData?: WorkoutExercise, isFromRoutineTemplate: boolean = false, forLogging: boolean = false): FormGroup {
    const baseExercise = exerciseData?.exerciseId ? this.availableExercises.find(e => e.id === exerciseData.exerciseId) : null;
    const sets = exerciseData?.sets || [];
    const fg = this.fb.group({
      id: [exerciseData?.id || this.workoutService.generateWorkoutExerciseId()],
      exerciseId: [exerciseData?.exerciseId || '', Validators.required],
      exerciseName: [exerciseData?.exerciseName || baseExercise?.name || 'Select Exercise'],
      notes: [exerciseData?.notes || ''],
      sets: this.fb.array(
        sets.map(set => this.createSetFormGroup(set, forLogging))
      ),
      supersetId: [isFromRoutineTemplate ? exerciseData?.supersetId : null],
      supersetOrder: [isFromRoutineTemplate ? exerciseData?.supersetOrder : null],
      supersetSize: [isFromRoutineTemplate ? exerciseData?.supersetSize : null],
      rounds: [isFromRoutineTemplate ? (exerciseData?.rounds ?? 1) : 1, [Validators.min(1)]],
    });
    if (isFromRoutineTemplate) {
      fg.get('supersetId')?.valueChanges.subscribe(() => this.updateRoundsControlability(fg));
      fg.get('supersetOrder')?.valueChanges.subscribe(() => this.updateRoundsControlability(fg));
      this.updateRoundsControlability(fg);
    } else {
      fg.get('rounds')?.enable({ emitEvent: false });
    }
    fg.get('exerciseId')?.valueChanges.subscribe(newExerciseId => {
      const selectedBaseExercise = this.availableExercises.find(e => e.id === newExerciseId);
      fg.get('exerciseName')?.setValue(selectedBaseExercise?.name || 'Unknown Exercise', { emitEvent: false });
    });
    return fg;
  }
  private createExerciseFormGroupFromLog(loggedEx: LoggedWorkoutExercise): FormGroup {
    return this.fb.group({
      id: [loggedEx.exerciseId || uuidv4()],
      exerciseId: [loggedEx.exerciseId, Validators.required],
      exerciseName: [loggedEx.exerciseName, Validators.required],
      notes: [loggedEx.notes || ''],
      sets: this.fb.array(loggedEx.sets.map(set => this.createSetFormGroup(set, true))),
      supersetId: [null], supersetOrder: [null], supersetSize: [null], rounds: [1],
    });
  }
  private createSetFormGroup(setData?: ExerciseSetParams | LoggedSet, forLogging: boolean = false): FormGroup {
    let repsValue, weightValue, durationValue, notesValue, typeValue, tempoValue, restValue;
    let id = uuidv4();
    let plannedSetIdValue;
    let timestampValue = new Date().toISOString(); // Default for new sets being logged

    if (setData) {
      id = setData.id || id; // Keep original set ID if from template or editing logged set
      if ('repsAchieved' in setData) { // It's a LoggedSet
        const loggedS = setData as LoggedSet;
        repsValue = loggedS.repsAchieved;
        weightValue = loggedS.weightUsed;
        durationValue = loggedS.durationPerformed;
        notesValue = loggedS.notes;
        typeValue = loggedS.type || 'standard'; // Use logged type, default to standard
        plannedSetIdValue = loggedS.plannedSetId;
        timestampValue = loggedS.timestamp; // Preserve original timestamp for logged sets
        // For logging, tempo and restAfterSet usually come from the plan, not directly part of LoggedSet for achievement
        tempoValue = loggedS.targetTempo || '';
        restValue = 60; // Default, or could be inferred if prefilling from a plan
      } else { // It's ExerciseSetParams from routine template
        const plannedS = setData as ExerciseSetParams;
        repsValue = plannedS.reps;
        weightValue = plannedS.weight;
        durationValue = plannedS.duration;
        notesValue = plannedS.notes;
        typeValue = plannedS.type || 'standard';
        tempoValue = plannedS.tempo;
        restValue = plannedS.restAfterSet;
        plannedSetIdValue = plannedS.id; // This is the template set ID
      }
    } else { // New blank set
      repsValue = null; weightValue = null; durationValue = null; notesValue = ''; typeValue = 'standard'; tempoValue = ''; restValue = 60;
    }

    const formGroupConfig: { [key: string]: any } = {
      id: [id],
      type: [typeValue, Validators.required], // Type is always present
      notes: [notesValue || ''],
    };

    if (forLogging) {
      formGroupConfig['repsAchieved'] = [repsValue ?? null, [Validators.required, Validators.min(0)]];
      formGroupConfig['weightUsed'] = [this.unitsService.convertFromKg(weightValue, this.unitsService.currentUnit()) ?? null, [Validators.min(0)]];
      formGroupConfig['durationPerformed'] = [durationValue ?? null, [Validators.min(0)]];
      formGroupConfig['plannedSetId'] = [plannedSetIdValue];
      formGroupConfig['timestamp'] = [timestampValue];
      // For manual log, tempo and restAfterSet are not primary achievement fields from the form
      // They might be prefilled if basing on a routine, but not directly editable *as achieved values* here.
      // If you want them to be editable achievements, add FormControls for them.
    } else { // For routine builder (planning mode)
      formGroupConfig['reps'] = [repsValue ?? null, [Validators.min(0)]];
      formGroupConfig['weight'] = [this.unitsService.convertFromKg(weightValue, this.unitsService.currentUnit()) ?? null, [Validators.min(0)]];
      formGroupConfig['duration'] = [durationValue ?? null, [Validators.min(0)]];
      formGroupConfig['tempo'] = [tempoValue || ''];
      formGroupConfig['restAfterSet'] = [restValue ?? 60, [Validators.required, Validators.min(0)]];
    }
    return this.fb.group(formGroupConfig);
  }

  openExerciseSelectionModal(): void {
    if (this.isViewMode) return;
    this.modalSearchTerm.set('');
    this.isExerciseModalOpen = true;
  }

  closeExerciseSelectionModal(): void {
    this.isExerciseModalOpen = false;
  }

  onModalSearchTermChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.modalSearchTerm.set(inputElement.value);
  }
  selectExercise(exercise: Exercise): void { // For Routine Builder
    const newExerciseFormGroup = this.createExerciseFormGroup({
      id: this.workoutService.generateWorkoutExerciseId(), exerciseId: exercise.id, exerciseName: exercise.name,
      sets: [{ id: this.workoutService.generateExerciseSetId(), type: 'standard', reps: 8, weight: 0, restAfterSet: 60, duration: undefined, tempo: '', notes: '' }],
      supersetId: null, supersetOrder: null, supersetSize: null, rounds: 1
    }, true, false);
    this.exercisesFormArray.push(newExerciseFormGroup); this.closeExerciseSelectionModal();
    this.toggleSetExpansion(this.exercisesFormArray.length - 1, 0);
  }
  selectExerciseForLog(exerciseFromLibrary: Exercise): void { // For Manual Log
    const workoutExercise: WorkoutExercise = {
      id: this.workoutService.generateWorkoutExerciseId(),
      exerciseId: exerciseFromLibrary.id,
      exerciseName: exerciseFromLibrary.name,
      sets: [{
        id: this.workoutService.generateExerciseSetId(),
        type: 'standard',
        reps: 8,
        weight: 0,
        restAfterSet: 60,
        duration: undefined,
        tempo: '',
        notes: ''
      }],
      supersetId: null,
      supersetOrder: null,
      supersetSize: null,
      rounds: 1
    };
    this.exercisesFormArray.push(this.createExerciseFormGroup(workoutExercise, false, true));
    this.closeExerciseSelectionModal();
  }

  ngAfterViewInit(): void {
    // This can be used to scroll to the expanded set after it's rendered
    this.expandedSetElements.changes.subscribe((elems: QueryList<ElementRef<HTMLDivElement>>) => {
      if (elems.first) {
        // Check if expandedSetPath is not null to ensure we only scroll when a set is truly expanded
        if (this.expandedSetPath()) {
          setTimeout(() => { // Timeout ensures DOM is fully ready
            elems.first.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 0);
        }
      }
    });
  }

  addSet(exerciseControl: AbstractControl, exerciseIndex: number): void {
    if (this.isViewMode) return;
    const setsArray = this.getSetsFormArray(exerciseControl);
    setsArray.push(this.createSetFormGroup(undefined, this.mode === 'manualLogEntry')); // Pass forLogging
    this.cdr.detectChanges();
    const newSetIndex = setsArray.length - 1;
    this.toggleSetExpansion(exerciseIndex, newSetIndex);
  }
  removeSet(exerciseControl: AbstractControl, exerciseIndex: number, setIndex: number): void {
    if (this.isViewMode) return;
    const setsArray = this.getSetsFormArray(exerciseControl);
    setsArray.removeAt(setIndex);
    // If the removed set was the expanded one, collapse (set to null)
    const currentExpanded = this.expandedSetPath();
    if (currentExpanded && currentExpanded.exerciseIndex === exerciseIndex && currentExpanded.setIndex === setIndex) {
      this.expandedSetPath.set(null);
    } else if (currentExpanded && currentExpanded.exerciseIndex === exerciseIndex && currentExpanded.setIndex > setIndex) {
      // If a set before the expanded one was removed, adjust the expanded index
      this.expandedSetPath.set({ exerciseIndex, setIndex: currentExpanded.setIndex - 1 });
    }
  }

  toggleSetExpansion(exerciseIndex: number, setIndex: number, event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.isViewMode && !(this.expandedSetPath()?.exerciseIndex === exerciseIndex && this.expandedSetPath()?.setIndex === setIndex)) {
      this.expandedSetPath.set({ exerciseIndex, setIndex }); // Allow expanding in view mode
      return;
    } else if (this.isViewMode) {
      this.expandedSetPath.set(null); return;
    } // For edit/new modes:
    const currentPath = this.expandedSetPath();
    if (currentPath?.exerciseIndex === exerciseIndex && currentPath?.setIndex === setIndex) {
      this.expandedSetPath.set(null);
    } else {
      this.expandedSetPath.set({ exerciseIndex, setIndex });
      this.cdr.detectChanges();
      setTimeout(() => { /* ... focus logic ... */ }, 50);
    }
  }
  isSetExpanded(exerciseIndex: number, setIndex: number): boolean {
    const currentPath = this.expandedSetPath();
    return currentPath?.exerciseIndex === exerciseIndex && currentPath?.setIndex === setIndex;
  }
  collapseExpandedSet(): void { this.expandedSetPath.set(null); }
  private getFormErrors(formGroup: FormGroup | FormArray): any {
    const errors: any = {};
    Object.keys(formGroup.controls).forEach(key => {
      const controlErrors = (formGroup.get(key) as AbstractControl).errors;
      if (controlErrors) {
        errors[key] = controlErrors;
      }
      if (formGroup.get(key) instanceof FormGroup || formGroup.get(key) instanceof FormArray) {
        const nestedErrors = this.getFormErrors(formGroup.get(key) as FormGroup | FormArray);
        if (Object.keys(nestedErrors).length > 0) {
          errors[key] = nestedErrors;
        }
      }
    });
    return errors;
  }
  get f() { return this.builderForm.controls; } // Use builderForm

  toggleExerciseSelectionForSuperset(index: number, event: Event): void {
    if (this.isViewMode) return;
    const checkbox = event.target as HTMLInputElement;
    this.selectedExerciseIndicesForSuperset.update(currentSelected => {
      let newSelected: number[];
      if (checkbox.checked) {
        newSelected = currentSelected.includes(index) ? currentSelected : [...currentSelected, index];
      } else {
        newSelected = currentSelected.filter(i => i !== index);
      }
      return newSelected.sort((a, b) => a - b);
    });
  }

  canGroupSelectedExercises(): boolean {
    const selectedIndices = this.selectedExerciseIndicesForSuperset();
    if (selectedIndices.length < 2) return false;
    const firstSelectedSupersetId = (this.exercisesFormArray.at(selectedIndices[0]) as FormGroup).get('supersetId')?.value;
    for (let i = 1; i < selectedIndices.length; i++) {
      const currentIndex = selectedIndices[i];
      const currentSupersetId = (this.exercisesFormArray.at(currentIndex) as FormGroup).get('supersetId')?.value;
      if (firstSelectedSupersetId && currentSupersetId && firstSelectedSupersetId !== currentSupersetId) return false;
      if (!firstSelectedSupersetId && currentSupersetId) return false;
    }
    return true;
  }

  onExerciseDrop(event: CdkDragDrop<AbstractControl[]>): void {
    if (this.isViewMode) return;
    if (event.previousContainer === event.container) {
      const exercisesArray = this.exercisesFormArray;
      moveItemInArray(exercisesArray.controls, event.previousIndex, event.currentIndex);
      exercisesArray.updateValueAndValidity();
      this.selectedExerciseIndicesForSuperset.set([]);
      this.handleSupersetIntegrityAfterDrag(event.previousIndex, event.currentIndex);
      this.recalculateSupersetOrders();
      this.expandedSetPath.set(null); // Collapse any expanded set after reorder
    }
  }

  private handleSupersetIntegrityAfterDrag(previousIndex: number, currentIndex: number): void {
    const affectedIndices = new Set<number>();
    affectedIndices.add(previousIndex);
    affectedIndices.add(currentIndex);
    if (previousIndex < currentIndex) {
      for (let i = previousIndex; i <= currentIndex; i++) affectedIndices.add(i);
    } else {
      for (let i = currentIndex; i <= previousIndex; i++) affectedIndices.add(i);
    }
    const supersetIdsToUngroup = new Set<string>();
    affectedIndices.forEach(index => {
      if (index < this.exercisesFormArray.length) {
        const exerciseControl = this.exercisesFormArray.at(index) as FormGroup;
        const supersetId = exerciseControl.get('supersetId')?.value;
        if (supersetId) supersetIdsToUngroup.add(supersetId);
      }
    });
    supersetIdsToUngroup.forEach(supersetIdToClear => {
      this.exercisesFormArray.controls.forEach(exCtrl => {
        const fg = exCtrl as FormGroup;
        if (fg.get('supersetId')?.value === supersetIdToClear) {
          fg.patchValue({ supersetId: null, supersetOrder: null, supersetSize: null });
        }
      });
    });
    this.recalculateSupersetOrders();
  } private recalculateSupersetOrders(): void {
    const supersetGroups = new Map<string, FormGroup[]>();
    this.exercisesFormArray.controls.forEach(control => {
      const exerciseForm = control as FormGroup;
      const supersetId = exerciseForm.get('supersetId')?.value;
      if (supersetId) {
        if (!supersetGroups.has(supersetId)) {
          supersetGroups.set(supersetId, []);
        }
        supersetGroups.get(supersetId)!.push(exerciseForm);
      } else {
        exerciseForm.patchValue({ supersetOrder: null, supersetSize: null }, { emitEvent: false });
        this.updateRoundsControlability(exerciseForm);
      }
    });
    supersetGroups.forEach((groupExercises, supersetId) => {
      if (groupExercises.length < 2) {
        groupExercises.forEach(fg => {
          fg.patchValue({ supersetId: null, supersetOrder: null, supersetSize: null });
          this.updateRoundsControlability(fg);
        });
      } else {
        groupExercises.sort((a, b) => {
          return this.exercisesFormArray.controls.indexOf(a) - this.exercisesFormArray.controls.indexOf(b);
        });
        groupExercises.forEach((exerciseForm, index) => {
          exerciseForm.patchValue({
            supersetOrder: index,
            supersetSize: groupExercises.length,
          }, { emitEvent: false });
          this.updateRoundsControlability(exerciseForm);
        });
      }
    });
    this.exercisesFormArray.updateValueAndValidity({ emitEvent: false });
  }

  groupSelectedAsSuperset(): void {
    if (this.isViewMode) return;
    const selectedIndices = this.selectedExerciseIndicesForSuperset().sort((a, b) => a - b);
    if (selectedIndices.length < 2) {
      this.toastService.warning("Select at least two exercises.", 3000, "Superset Error");
      return;
    }
    for (let i = 1; i < selectedIndices.length; i++) {
      if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
        this.toastService.warning("Selected exercises must be next to each other to form a superset.", 5000, "Superset Error");
        return;
      }
    }
    const newSupersetId = uuidv4();
    const supersetSize = selectedIndices.length;
    const firstExerciseControl = this.exercisesFormArray.at(selectedIndices[0]) as FormGroup;
    const supersetRounds = firstExerciseControl.get('rounds')?.value ?? 1;

    selectedIndices.forEach((exerciseIndexInFormArray, orderInSuperset) => {
      const exerciseControl = this.exercisesFormArray.at(exerciseIndexInFormArray) as FormGroup;
      exerciseControl.patchValue({
        supersetId: newSupersetId,
        supersetOrder: orderInSuperset,
        supersetSize: supersetSize,
        rounds: supersetRounds
      });
      this.updateRoundsControlability(exerciseControl);
      const setsArray = exerciseControl.get('sets') as FormArray;
      setsArray.controls.forEach((setControl) => {
        if (orderInSuperset < supersetSize - 1) {
          (setControl as FormGroup).get('restAfterSet')?.setValue(0);
        }
      });
    });
    this.selectedExerciseIndicesForSuperset.set([]);
    this.toastService.success("Superset created!", 3000, "Success");
  }

  ungroupSuperset(exerciseIndex: number): void {
    if (this.isViewMode) return;
    const exerciseControl = this.exercisesFormArray.at(exerciseIndex) as FormGroup;
    const supersetIdToClear = exerciseControl.get('supersetId')?.value;
    if (!supersetIdToClear) return;
    this.exercisesFormArray.controls.forEach(ctrl => {
      const fg = ctrl as FormGroup;
      if (fg.get('supersetId')?.value === supersetIdToClear) {
        fg.patchValue({ supersetId: null, supersetOrder: null, supersetSize: null });
        this.updateRoundsControlability(fg);
      }
    });
    this.selectedExerciseIndicesForSuperset.set([]);
    this.toastService.info("Superset ungrouped.", 3000, "Ungrouped");
  }

  removeExercise(exerciseIndex: number): void {
    if (this.isViewMode) return;
    const exerciseControl = this.exercisesFormArray.at(exerciseIndex) as FormGroup;
    const removedSupersetId = exerciseControl.get('supersetId')?.value;
    this.exercisesFormArray.removeAt(exerciseIndex);
    this.selectedExerciseIndicesForSuperset.set([]);
    if (removedSupersetId) {
      this.recalculateSupersetOrders();
    }
    this.toastService.info("Exercise removed.", 2000);
    this.expandedSetPath.set(null); // Collapse if an exercise is removed
  }
  errorMessage = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    if (this.isViewMode) { this.toastService.info("View mode. No changes.", 3000, "View Mode"); return; }

    if (this.mode === 'routineBuilder') this.recalculateSupersetOrders();

    const isRestGoalRoutine = this.mode === 'routineBuilder' && this.builderForm.get('goal')?.value === 'rest';

    if ((this.mode === 'routineBuilder' && (this.builderForm.get('name')?.invalid || this.builderForm.get('goal')?.invalid)) ||
      (this.mode === 'manualLogEntry' && (this.builderForm.get('workoutDate')?.invalid || this.builderForm.get('startTime')?.invalid || this.builderForm.get('durationMinutes')?.invalid))) {
      this.builderForm.markAllAsTouched();
      this.toastService.error('Please fill all required details.', 0, "Validation Error");
      return;
    }
    if (!isRestGoalRoutine && this.exercisesFormArray.length === 0) {
      this.toastService.error(this.mode === 'manualLogEntry' ? 'Log must have exercises.' : 'Routine needs exercises.', 0, "Validation Error");
      return;
    }
    if (this.mode === 'routineBuilder' && !isRestGoalRoutine && !this.validateSupersetIntegrity()) {
      this.toastService.error('Invalid superset configuration.', 0, "Validation Error"); return;
    }
    // Detailed set validation loop (ensure this is robust)
    // ...

if (this.builderForm.invalid) {
      this.toastService.error('Please correct validation errors.', 0, "Validation Error");
      this.builderForm.markAllAsTouched(); return;
    }

    const formValue = this.builderForm.getRawValue();
    this.spinnerService.show(this.isNewMode ? "Saving..." : "Updating...");

    try {
      if (this.mode === 'routineBuilder') {
        const routinePayload: Routine = {
          id: this.currentRoutineId || uuidv4(), name: formValue.name, description: formValue.description, goal: formValue.goal,
          exercises: (formValue.goal === 'rest') ? [] : formValue.exercises.map((exInput: any) => ({
            ...exInput, sets: exInput.sets.map((setInput: any) => ({
              ...setInput, // This includes 'type', 'reps', 'duration', 'tempo', 'restAfterSet', 'notes'
              weight: this.unitsService.convertToKg(setInput.weight, this.unitsService.currentUnit()) ?? null,
            }))
          })),
        };
        if (this.isNewMode) this.workoutService.addRoutine(routinePayload); else this.workoutService.updateRoutine(routinePayload);
        this.toastService.success(`Routine ${this.isNewMode ? 'created' : 'updated'}!`, 4000, "Success");
        this.router.navigate(['/workout']);
      } else { // manualLogEntry
        const workoutDateStr = formValue.workoutDate; const startTimeStr = formValue.startTime;
        const combinedDateTimeStr = `${workoutDateStr}T${startTimeStr}:00`;
        let startTimeMs: number;
        try {
            const parsedDate = parseISO(combinedDateTimeStr);
            if (!isValidDate(parsedDate)) throw new Error("Invalid date/time for log entry");
            startTimeMs = parsedDate.getTime();
        } catch (e) { this.toastService.error("Invalid date or time format.", 0, "Error"); this.spinnerService.hide(); return; }
        let endTimeMs: number | undefined = undefined;
        if (formValue.durationMinutes) endTimeMs = new Date(startTimeMs).setMinutes(new Date(startTimeMs).getMinutes() + formValue.durationMinutes);


        const logExercises: LoggedWorkoutExercise[] = formValue.exercises.map((exInput: any): LoggedWorkoutExercise => ({
          exerciseId: exInput.exerciseId,
          exerciseName: exInput.exerciseName,
          notes: exInput.notes, // Exercise-level notes from the form
          sets: exInput.sets.map((setInput: any): LoggedSet => ({
            id: setInput.id || uuidv4(),
            plannedSetId: setInput.plannedSetId, // This was set during prefill or from existing log
            exerciseId: exInput.exerciseId,
            type: setInput.type, // <<<< ENSURE THIS IS SAVED
            repsAchieved: setInput.repsAchieved,
            weightUsed: this.unitsService.convertToKg(setInput.weightUsed, this.unitsService.currentUnit()) ?? null,
            durationPerformed: setInput.durationPerformed,
            notes: setInput.notes, // Set-level notes
            // Target fields are not directly edited in log mode form, but might be on LoggedSet if prefilled
            targetReps: setInput.targetReps,
            targetWeight: setInput.targetWeight,
            targetDuration: setInput.targetDuration,
            targetTempo: setInput.targetTempo,
            rpe: undefined, // RPE not part of this form
            timestamp: setInput.timestamp || new Date().toISOString(),
          }))
        }));

        const logPayloadBase = {
          date: format(new Date(startTimeMs), 'yyyy-MM-dd'),
          startTime: startTimeMs,
          endTime: endTimeMs,
          durationMinutes: formValue.durationMinutes,
          routineId: formValue.routineIdForLog || undefined,
          routineName: formValue.routineIdForLog ?
                       (this.availableRoutines.find(r => r.id === formValue.routineIdForLog)?.name || formValue.name || 'Workout from Routine') :
                       (formValue.name || 'Ad-hoc Workout'), // Use form 'name' as log title if no routine
          notes: formValue.overallNotesLog, // Overall log notes
          exercises: logExercises
        };

        if (this.isEditMode && this.currentLogId) {
          const updatedLog: WorkoutLog = { ...logPayloadBase, id: this.currentLogId };
          await this.trackingService.updateWorkoutLog(updatedLog);
          this.toastService.success("Log updated!", 4000, "Success");
          this.router.navigate(['/history/log', this.currentLogId]);
        } else {
          const newLog: Omit<WorkoutLog, 'id'> = logPayloadBase;
          const savedLog = this.trackingService.addWorkoutLog(newLog);
          this.toastService.success("Workout logged!", 4000, "Success");
          this.router.navigate(['/history/log', savedLog.id]);
        }
      }
      this.builderForm.markAsPristine();
    } catch (e: any) {
      console.error("Error saving:", e);
      this.toastService.error(`Failed to save: ${e.message || 'Unknown error'}`, 0, "Save Error");
    } finally {
      this.spinnerService.hide();
    }
  }

  private validateSupersetIntegrity(): boolean {
    const exercises = this.exercisesFormArray.value as WorkoutExercise[];
    const supersetGroups = new Map<string, WorkoutExercise[]>();
    for (const exercise of exercises) {
      if (exercise.supersetId) {
        if (!supersetGroups.has(exercise.supersetId)) {
          supersetGroups.set(exercise.supersetId, []);
        }
        supersetGroups.get(exercise.supersetId)!.push(exercise);
      }
    }
    for (const [id, group] of supersetGroups.entries()) {
      if (group.length < 2) return false; // Superset must have at least 2 exercises
      const sortedGroup = group.sort((a, b) => (a.supersetOrder ?? Infinity) - (b.supersetOrder ?? Infinity));
      for (let i = 0; i < sortedGroup.length; i++) {
        if (sortedGroup[i].supersetOrder !== i) return false; // Orders must be sequential 0, 1, 2...
      }
      // Check if all exercises in the group are contiguous in the main exercisesFormArray
      const formIndices = sortedGroup.map(ex => this.exercisesFormArray.controls.findIndex(ctrl => (ctrl as FormGroup).get('id')?.value === ex.id));
      for (let i = 1; i < formIndices.length; i++) {
        if (formIndices[i] !== formIndices[i - 1] + 1) return false; // Not contiguous
      }
    }
    return true;
  }
  get firstSelectedExerciseIndexForSuperset(): number | null {
    const selectedIndices = this.selectedExerciseIndicesForSuperset();
    return selectedIndices.length > 0 ? selectedIndices[0] : null;
  }

  private updateRoundsControlability(exerciseFormGroup: FormGroup): void {
    const supersetId = exerciseFormGroup.get('supersetId')?.value;
    const supersetOrder = exerciseFormGroup.get('supersetOrder')?.value;
    const roundsControl = exerciseFormGroup.get('rounds');

    if (this.isViewMode) {
      roundsControl?.disable({ emitEvent: false });
      return;
    }

    if (supersetId && supersetOrder !== null && supersetOrder > 0) {
      roundsControl?.disable({ emitEvent: false });
      const firstInSuperset = this.exercisesFormArray.controls.find(ctrl =>
        (ctrl as FormGroup).get('supersetId')?.value === supersetId &&
        (ctrl as FormGroup).get('supersetOrder')?.value === 0
      ) as FormGroup | undefined;
      if (firstInSuperset) {
        roundsControl?.setValue(firstInSuperset.get('rounds')?.value ?? 1, { emitEvent: false });
      }
    } else {
      roundsControl?.enable({ emitEvent: false });
    }
  }

  syncSupersetRounds(supersetIdToSync: string | null, newRoundsValue: number | null | undefined, changedExerciseIndex: number): void {
    if (this.isViewMode) return;
    if (!supersetIdToSync || newRoundsValue === null || newRoundsValue === undefined || newRoundsValue < 1) return;
    const changedExerciseControl = this.exercisesFormArray.at(changedExerciseIndex) as FormGroup;
    if (changedExerciseControl.get('supersetOrder')?.value !== 0) return;

    this.exercisesFormArray.controls.forEach(control => {
      const exerciseFg = control as FormGroup;
      if (exerciseFg.get('supersetId')?.value === supersetIdToSync) {
        if (exerciseFg.get('rounds')?.value !== newRoundsValue) {
          exerciseFg.get('rounds')?.setValue(newRoundsValue, { emitEvent: false });
        }
      }
    });
  }

  startCurrentWorkout(): void {
    if (this.currentRoutineId) {
      this.router.navigate(['/workout/play', this.currentRoutineId]);
    } else {
      this.toastService.error("Cannot start workout: Routine ID is missing.", 0, "Error");
    }
  }

  enableEditMode(): void {
    if (this.isViewMode && this.currentRoutineId) {
      this.isViewMode = false;
      this.isEditMode = true;
      this.toggleFormState(false);
      this.toastService.info("Edit mode enabled.", 3000, "Mode Changed");
    }
  }

  async deleteCurrentRoutine(): Promise<void> {
    if (!this.currentRoutineId) {
      this.toastService.error("Cannot delete: Routine ID is missing.", 0, "Error");
      return;
    }
    const routineToDelete = await firstValueFrom(this.workoutService.getRoutineById(this.currentRoutineId).pipe(take(1)));

    if (!routineToDelete) {
      this.toastService.error("Routine not found for deletion.", 0, "Error");
      return;
    }

    const associatedLogs = await firstValueFrom(this.trackingService.getWorkoutLogsByRoutineId(this.currentRoutineId).pipe(take(1))) || [];
    let confirmationMessage = `Are you sure you want to delete the routine "${routineToDelete.name}"?`;
    if (associatedLogs.length > 0) {
      confirmationMessage += ` This will also delete ${associatedLogs.length} associated workout log(s). This action cannot be undone.`;
    }

    const confirm = await this.alertService.showConfirm(
      'Delete Routine',
      confirmationMessage,
      'Delete',
    );

    if (confirm && confirm.data) {
      try {
        this.spinnerService.show();
        if (associatedLogs.length > 0) {
          await this.trackingService.clearWorkoutLogsByRoutineId(this.currentRoutineId);
          this.toastService.info(`${associatedLogs.length} workout log(s) deleted.`, 3000, "Logs Cleared");
        }
        await this.workoutService.deleteRoutine(this.currentRoutineId);
        this.toastService.success(`Routine "${routineToDelete.name}" deleted.`, 4000, "Routine Deleted");
        this.router.navigate(['/workout']);
      } catch (error) {
        console.error("Error during deletion:", error);
        this.toastService.error("Failed to delete routine or logs. Please try again.", 0, "Deletion Failed");
      } finally {
        this.spinnerService.hide();
      }
    }
  }


  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }
}