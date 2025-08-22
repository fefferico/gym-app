import { Component, inject, OnInit, OnDestroy, signal, computed, ElementRef, QueryList, ViewChildren, AfterViewInit, ChangeDetectorRef, PLATFORM_ID, Input, HostListener, ViewChild, effect, AfterViewChecked } from '@angular/core';
import { CommonModule, DecimalPipe, isPlatformBrowser, TitleCasePipe } from '@angular/common'; // Added TitleCasePipe
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, AbstractControl, FormsModule, FormControl } from '@angular/forms';
import { Subscription, of, firstValueFrom, Observable, from } from 'rxjs';
import { switchMap, tap, take, distinctUntilChanged, map, mergeMap, startWith, debounceTime, filter } from 'rxjs/operators';
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
import { AlertInput } from '../../core/models/alert.model';
import { LongPressDragDirective } from '../../shared/directives/long-press-drag.directive';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { merge } from 'hammerjs';
import { AutoGrowDirective } from '../../shared/directives/auto-grow.directive';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu';
import { ActionMenuItem } from '../../core/models/action-menu.model';
import { IsWeightedPipe } from '../../shared/pipes/is-weighted-pipe';
import { ModalComponent } from '../../shared/components/modal/modal.component';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { ExerciseDetailComponent } from '../exercise-library/exercise-detail';
import { TrainingProgram } from '../../core/models/training-program.model';
import { TrainingProgramService } from '../../core/services/training-program.service';
import { PressDirective } from '../../shared/directives/press.directive';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ExerciseSelectionModalComponent } from '../../shared/components/exercise-selection-modal/exercise-selection-modal.component';

type BuilderMode = 'routineBuilder' | 'manualLogEntry';

@Component({
  selector: 'app-workout-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink,
    FormsModule, DragDropModule, WeightUnitPipe, TitleCasePipe,
    LongPressDragDirective, AutoGrowDirective, ActionMenuComponent,
    IsWeightedPipe, ModalComponent, ClickOutsideDirective,
    ExerciseDetailComponent, PressDirective, IconComponent, TooltipDirective, ExerciseSelectionModalComponent],
  templateUrl: './workout-builder.html',
  styleUrl: './workout-builder.scss',
  providers: [DecimalPipe]
})
export class WorkoutBuilderComponent implements OnInit, OnDestroy, AfterViewInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private workoutService = inject(WorkoutService);
  private trainingService = inject(TrainingProgramService);
  private exerciseService = inject(ExerciseService);
  protected unitService = inject(UnitsService);
  protected spinnerService = inject(SpinnerService);
  protected alertService = inject(AlertService);
  protected toastService = inject(ToastService);
  private trackingService = inject(TrackingService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  @ViewChildren('setRepsInput') setRepsInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChildren('expandedSetElement') expandedSetElements!: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChild('exerciseSearchFied') myExerciseInput!: ElementRef;

  isAllExpandedInViewMode = signal(false);

  exerciseInfoTooltipString = 'Exercise details and progression';
  lastRoutineDuration: number = 0;

  routine: Routine | undefined = undefined;
  builderForm!: FormGroup;
  mode: BuilderMode = 'routineBuilder';
  isEditableMode = signal<boolean>(false);
  isEditMode = false;
  isNewMode = true;
  isViewMode = false; // Only for routineBuilder mode
  currentRoutineId: string | null = null; // For editing/viewing a Routine
  currentProgramId: string | null = null;
  dateParam: Date | null = null;
  currentLogId: string | null = null;     // For editing a WorkoutLog
  private routeSub: Subscription | undefined;
  private initialRoutineIdForLogEdit: string | null | undefined = undefined; // For log edit mode
  private initialProgramIdForLogEdit: string | null | undefined = undefined; // For log edit mode

  isCompactView: boolean = true;

  private subscriptions = new Subscription();

  expandedSetPath = signal<{ exerciseIndex: number, setIndex: number } | null>(null);
  expandedSetPaths: { exerciseIndex: number, setIndex: number }[] = [];

  availableSetTypes: { value: string, label: string }[] = [
    { value: 'standard', label: 'Standard' },
    { value: 'warmup', label: 'Warm-up' },
    { value: 'superset', label: 'Superset' },
    { value: 'amrap', label: 'AMRAP' },
    { value: 'dropset', label: 'Dropset' },
    { value: 'failure', label: 'To Failure' },
    { value: 'myorep', label: 'Myo-rep' },
    { value: 'restpause', label: 'Rest-Pause' },
    { value: 'custom', label: 'Custom Type' }
  ];
  routineGoals: { value: Routine['goal'], label: string }[] = [
    { value: 'hypertrophy', label: 'Hypertrophy' }, { value: 'strength', label: 'Strength' },
    { value: 'tabata', label: 'Tabata' },
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
  availablePrograms: TrainingProgram[] = [];
  modalSearchTerm = signal('');
  filteredAvailableExercises = computed(() => {
    let term = this.modalSearchTerm().toLowerCase();
    if (!term) {
      return this.availableExercises;
    }
    term = this.exerciseService.normalizeExerciseNameForSearch(term);
    return this.availableExercises.filter(ex =>
      ex.name.toLowerCase().includes(term) ||
      (ex.category && ex.category.toLowerCase().includes(term)) ||
      (ex.primaryMuscleGroup && ex.primaryMuscleGroup.toLowerCase().includes(term))
    );
  });
  selectedExerciseIndicesForSuperset = signal<number[]>([]);

  private sanitizer = inject(DomSanitizer);
  public sanitizedDescription: SafeHtml = '';

  constructor() {
    this.builderForm = this.fb.group({
      name: [''], // Validated based on mode
      description: [''], // Only for routineBuilder
      goal: ['custom' as Routine['goal']], // Only for routineBuilder

      workoutDate: [''], // Only for manualLogEntry
      startTime: [''],   // Only for manualLogEntry
      endTime: [''],   // Only for manualLogEntry
      // durationMinutes: [60, [Validators.min(1)]], // Only for manualLogEntry
      overallNotesLog: [''], // Only for manualLogEntry
      routineIdForLog: [''], // For selecting base routine in manualLogEntry
      programIdForLog: [''], // For selecting base routine in manualLogEntry

      exercises: this.fb.array([]), // Validated based on mode/goal
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) { window.scrollTo(0, 0); }
    this.loadAvailableExercises(); // For exercise selection modal
    
     this.subscriptions.add(
      this.workoutService.routines$.pipe(take(1)).subscribe(routines => {
        this.availableRoutines = routines;
      })
    );

    this.subscriptions.add(
      this.trainingService.programs$.pipe(take(1)).subscribe(programs => {
        this.availablePrograms = programs;
      })
    );

    this.routeSub = this.route.data.pipe(
      switchMap(data => {
        this.mode = data['mode'] as BuilderMode || 'routineBuilder';
        this.isNewMode = data['isNew'] === true; // True if creating new (Routine or Log)
        console.log(`Builder ngOnInit: Mode=${this.mode}, isNewMode=${this.isNewMode}`);

        this.currentRoutineId = this.route.snapshot.paramMap.get('routineId'); // For editing/viewing a Routine, or prefilling a Log
        this.currentLogId = this.route.snapshot.paramMap.get('logId');         // For editing a WorkoutLog or creating a routine from a log
        this.currentProgramId = this.route.snapshot.queryParamMap.get('programId');
        const paramDate = this.route.snapshot.queryParamMap.get('date');
        this.dateParam = paramDate ? new Date(paramDate) : null;

        // isViewMode is specific to viewing a Routine template
        this.isViewMode = (this.mode === 'routineBuilder' && !!this.currentRoutineId && !this.isNewMode && this.route.snapshot.routeConfig?.path?.includes('view')) || false;
        // isEditMode is true if not new and not view (i.e. editing a routine or a log)
        this.isEditMode = !this.isNewMode && !this.isViewMode;
        this.isEditableMode.set(this.isEditMode || this.isNewMode);

        this.configureFormValidatorsAndFieldsForMode();
        this.expandedSetPath.set(null);
        this.exercisesFormArray.clear({ emitEvent: false }); // Clear before reset
        this.builderForm.reset(this.getDefaultFormValuesForMode(), { emitEvent: false });

        if (this.mode === 'routineBuilder') {
          if (this.currentLogId && this.isNewMode) { // Creating a new Routine from a Log
            return this.trackingService.getWorkoutLogById(this.currentLogId);
          }
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
          if (this.mode === 'routineBuilder' && this.currentLogId && this.isNewMode) {
            this.prefillRoutineFormFromLog(loadedData as WorkoutLog);
          } else if (this.mode === 'routineBuilder') {
            this.routine = loadedData as Routine;
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

        if (this.isViewMode) {
          this.toggleFormState(true);
          this.isAllExpandedInViewMode.set(true);
          this.isCompactView = false; // This ensures the component doesn't start in compact mode
        } else {
          this.toggleFormState(false); // Enable for new/edit modes
        }
      })
    ).subscribe();

    this.subscriptions.add(this.routeSub);

    if (this.mode === 'manualLogEntry') {
      this.builderForm.get('routineIdForLog')?.valueChanges.subscribe(routineId => {
        if (this.isEditMode && routineId === this.initialRoutineIdForLogEdit && !this.builderForm.get('routineIdForLog')?.dirty) {
          return;
        }
        if (this.isEditMode && routineId === this.initialProgramIdForLogEdit && !this.builderForm.get('programIdForLog')?.dirty) {
          return;
        }
        const selectedRoutine = this.availableRoutines.find(r => r.id === routineId);
        // const selectedProgram = this.availablePrograms.find(p => p.id === routineId);
        if (selectedRoutine) {
          this.prefillLogFormFromRoutine(selectedRoutine, false); // Don't reset date/time if user already set them
        } else {
          this.exercisesFormArray.clear();
          // If user deselects routine, workout name might become editable or clear
          if (!this.isEditMode) this.builderForm.get('name')?.setValue('Ad-hoc Workout');
        }
      });
    }

    const goalSub = this.builderForm.get('goal')?.valueChanges.subscribe(goalValue => {
      if (this.mode === 'routineBuilder' && goalValue === 'rest') {
        while (this.exercisesFormArray.length) this.exercisesFormArray.removeAt(0);
        this.exercisesFormArray.clearValidators();
      }
      // if goal is changed to tabata it updates all exercises to have a duration of 40 and rest of 20 seconds
      if (this.mode === 'routineBuilder' && goalValue === 'tabata') {
        this.exercisesFormArray.controls.forEach(exerciseControl => {
          const setsArray = (exerciseControl as FormGroup).get('sets') as FormArray;
          setsArray.controls.forEach(setControl => {
            (setControl as FormGroup).patchValue({
              duration: 40,
              restAfterSet: 20,
              reps: null,
              weight: null
            });
          });
        });
        this.toastService.info("Exercises updated to standard TABATA schema 40 work / 20 rest")
      }
      this.exercisesFormArray.updateValueAndValidity();
    });
    this.subscriptions.add(goalSub);

    const descSub = this.builderForm.get('description')?.valueChanges.subscribe(value => {
      this.updateSanitizedDescription(value || '');
    });
    this.subscriptions.add(descSub);

    const setsSub = this.builderForm.get('sets')?.valueChanges.subscribe(value => {
      this.getRoutineDuration();
    });
    this.subscriptions.add(setsSub);
    const roundsSub = this.builderForm.get('rounds')?.valueChanges.subscribe(value => {
      this.getRoutineDuration();
    });
    this.subscriptions.add(roundsSub);

    this.getLastRoutineDuration();

  }

  /**
   * This method is triggered when the user presses "Enter"
   * inside the exercise search input field.
   */
  onSearchEnter(): void {
    const filteredList = this.filteredAvailableExercises();

    // Check if there is exactly one exercise in the filtered list
    if (filteredList.length === 1) {
      // If so, select that exercise
      const singleExercise = filteredList[0];
      this.selectExerciseFromLibrary(singleExercise);
    }
    // If there are 0 or more than 1 results, pressing Enter does nothing,
    // which is the desired behavior.
  }

  private updateSanitizedDescription(value: string): void {
    // This tells Angular to trust this HTML string and render it as is.
    this.sanitizedDescription = this.sanitizer.bypassSecurityTrustHtml(value);
  }

  private getDefaultFormValuesForMode(): any { /* ... (as previously defined) ... */
    if (this.mode === 'manualLogEntry') {
      const today = new Date();
      return {
        name: '', description: '', goal: 'custom',
        workoutDate: format(today, 'yyyy-MM-dd'),
        startTime: format(today, 'HH:mm'),
        endTime: format(today, 'HH:mm'),
        // durationMinutes: 60,
        overallNotesLog: '',
        routineIdForLog: '',
        programIdForLog: '',
        exercises: []
      };
    } else { // routineBuilder
      return {
        name: '', description: '', goal: '',
        workoutDate: '', startTime: '', endTime: '',
        // durationMinutes: 60,
        overallNotesLog: '', routineIdForLog: '', programIdForLog: '',
        exercises: []
      };
    }
  }

  private configureFormValidatorsAndFieldsForMode(): void {
    const nameCtrl = this.builderForm.get('name');
    const goalCtrl = this.builderForm.get('goal');
    const dateCtrl = this.builderForm.get('workoutDate');
    const startTimeCtrl = this.builderForm.get('startTime');
    const endTimeCtrl = this.builderForm.get('endTime');
    // const durationCtrl = this.builderForm.get('durationMinutes');

    nameCtrl?.clearValidators();
    goalCtrl?.clearValidators();
    dateCtrl?.clearValidators();
    startTimeCtrl?.clearValidators();
    endTimeCtrl?.clearValidators();
    // durationCtrl?.clearValidators();


    if (this.mode === 'routineBuilder') {
      nameCtrl?.setValidators(Validators.required);
      goalCtrl?.setValidators(Validators.required);
      this.builderForm.get('exercises')?.setValidators(Validators.nullValidator); // Exercises not strictly required if goal is 'rest'
    } else { // manualLogEntry
      dateCtrl?.setValidators(Validators.required);
      startTimeCtrl?.setValidators(Validators.required);
      endTimeCtrl?.setValidators(Validators.required);
      // durationCtrl?.setValidators([Validators.required, Validators.min(1)]);
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
        this.builderForm.get('endTime')?.disable({ emitEvent: false });
        // this.builderForm.get('durationMinutes')?.disable({ emitEvent: false });
        this.builderForm.get('overallNotesLog')?.disable({ emitEvent: false });
        this.builderForm.get('routineIdForLog')?.disable({ emitEvent: false });
        this.builderForm.get('programIdForLog')?.disable({ emitEvent: false });
      } else { // manualLogEntry
        // Name field is used for WorkoutLog's title, so it should be enabled or prefilled
        // this.builderForm.get('name')?.enable({ emitEvent: false });
        this.builderForm.get('description')?.disable({ emitEvent: false });
        this.builderForm.get('goal')?.disable({ emitEvent: false });

        if (this.checkIfLogForProgram()) {
          this.builderForm.get('programIdForLog')?.disable();
          this.builderForm.get('workoutDate')?.disable();
          this.builderForm.get('routineIdForLog')?.disable();
        }

      }
      this.exercisesFormArray.controls.forEach(exCtrl => {
        this.updateRoundsControlability(exCtrl as FormGroup);
      });
    }
  }

  checkIfLogForProgram(): boolean {
    return !!(this.currentProgramId && this.mode === 'manualLogEntry' && this.dateParam && this.currentRoutineId);
  }

  getLogTitleForProgramEntry(): string {
    if (this.checkIfLogForProgram()) {
      const program = this.availablePrograms.find(p => p.id === this.currentProgramId);
      const routine = this.availableRoutines.find(p => p.id === this.currentRoutineId);
      if (program) {
        return `Log for Program: ${program.name} - Routine: ${routine?.name || 'Ad-hoc'}`;
      }
    } 
    return 'Ad-hoc Workout';
  }

  get exercisesFormArray(): FormArray {
    return this.builderForm.get('exercises') as FormArray;
  }
  getSetsFormArray(exerciseControl: AbstractControl): FormArray {
    return exerciseControl.get('sets') as FormArray;
  }

  private addRepsListener(exerciseControl: FormGroup): void {
    const repsSubscription = this.setupRepsListener(exerciseControl);
    this.subscriptions.add(repsSubscription);
  }

  private setupRepsListener(exerciseControl: FormGroup): void {
    const setsFormArray = this.getSetsFormArray(exerciseControl);

    const repsSub = setsFormArray.valueChanges.pipe(
      debounceTime(300),
      // startWith will now emit an initial value, just to kick off the stream.
      // The value itself doesn't matter.
      startWith(null),

      // --- THIS IS THE CRITICAL FIX ---
      // We ignore the value from the stream (`_`) and ALWAYS use setsFormArray.controls.
      // This guarantees we are always working with the actual Form Controls.
      mergeMap((_) => {
        const controls = setsFormArray.controls; // Get the up-to-date controls array

        // The rest of the logic is now safe because 'controls' is always AbstractControl[]
        return from(controls).pipe(
          mergeMap((setControl, index) => {
            const repsControl = setControl.get('reps');
            if (!repsControl) {
              return of(null);
            }
            return repsControl.valueChanges.pipe(
              map(repsValue => ({
                reps: repsValue,
                setIndex: index,
                exerciseId: exerciseControl.get('id')?.value
              })),
              distinctUntilChanged((prev, curr) => prev.reps === curr.reps)
            );
          })
        );
      }),
      filter(change => change !== null)

    ).subscribe(change => {
      console.log(`Reps changed on Ex: ${change.exerciseId}, Set: ${change.setIndex} to ${change.reps}`);
      this.getRoutineDuration();
    });

    this.subscriptions.add(repsSub);
  }

  private loadAvailableExercises(): void {
    this.exerciseService.getExercises().pipe(take(1)).subscribe(exs => this.availableExercises = exs);
  }

  patchFormWithRoutineData(routine: Routine): void {
    this.builderForm.patchValue({
      name: routine.name,
      description: routine.description,
      goal: routine.goal,
    }, { emitEvent: false });
    this.updateSanitizedDescription(routine.description || '');
    this.exercisesFormArray.clear({ emitEvent: false });
    routine.exercises.forEach(exerciseData => {
      const newExerciseFormGroup = this.createExerciseFormGroup(exerciseData, true, false);
      this.exercisesFormArray.push(newExerciseFormGroup, { emitEvent: false });
      this.addRepsListener(newExerciseFormGroup);
    });
    this.builderForm.markAsPristine();
  }


  patchFormWithLogData(log: WorkoutLog): void {
    this.initialRoutineIdForLogEdit = log.routineId;
    this.initialProgramIdForLogEdit = log.programId;
    this.builderForm.patchValue({
      name: log.routineName || 'Logged Workout',
      workoutDate: format(parseISO(log.date), 'yyyy-MM-dd'),
      startTime: format(new Date(log.startTime), 'HH:mm'),
      endTime: log.endTime
        ? format(new Date(log.endTime), 'HH:mm')
        : (log.startTime && log.durationMinutes
          ? format(new Date(new Date(log.startTime).getTime() + log.durationMinutes * 60000), 'HH:mm')
          : ''),
      // durationMinutes: log.durationMinutes || 60,
      overallNotesLog: log.notes || '',
      routineIdForLog: log.routineId || '',
      programIdForLog: log.programId || '',
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
      const date = this.dateParam ? this.dateParam : today;
      patchData.programIdForLog = this.currentProgramId || null
      patchData.workoutDate = format(date, 'yyyy-MM-dd');
      patchData.startTime = format(date, 'HH:mm');
      // patchData.durationMinutes = 60;
    }
    this.builderForm.patchValue(patchData, { emitEvent: false });
    this.exercisesFormArray.clear({ emitEvent: false });
    routine.exercises.forEach(routineEx => {
      this.exercisesFormArray.push(this.createExerciseFormGroup(routineEx, false, true), { emitEvent: false });
    });
    this.builderForm.markAsDirty();
  }

  prefillRoutineFormFromLog(log: WorkoutLog): void {
    this.builderForm.patchValue({
      // Suggest a name for the new routine based on the log
      name: `${log.routineName || 'Logged Workout'} - As Routine`,
      // Use the log's notes as a starting point for the routine description
      description: log.notes || '',
      // Try to find the original goal, otherwise default to 'custom'
      goal: this.availableRoutines.find(r => r.id === log.routineId)?.goal || 'custom',
    }, { emitEvent: false });

    this.updateSanitizedDescription(log.notes || '');

    this.exercisesFormArray.clear({ emitEvent: false });

    log.exercises.forEach(loggedEx => {
      const newRoutineExercise = this.createRoutineExerciseFromLoggedExercise(loggedEx);
      this.exercisesFormArray.push(newRoutineExercise, { emitEvent: false });
    });

    this.toggleFormState(false); // Enable the form for editing
    this.builderForm.markAsDirty(); // Mark as dirty since it's a new, unsaved routine
  }

  private createRoutineExerciseFromLoggedExercise(loggedEx: LoggedWorkoutExercise): FormGroup {
    const sets = loggedEx.sets.map(loggedSet => {
      // For the new routine, the 'target' is what was 'achieved' in the log.
      const newSetParams: ExerciseSetParams = {
        id: this.workoutService.generateExerciseSetId(), // New ID for the routine set
        reps: loggedSet.repsAchieved,
        weight: loggedSet.weightUsed ?? null,
        duration: loggedSet.durationPerformed,
        restAfterSet: loggedSet.targetRestAfterSet ?? 60, // Use original target rest, or default
        type: loggedSet.type,
        notes: loggedSet.notes,
        tempo: loggedSet.targetTempo,
      };
      // Return a FormGroup for the set
      return this.createSetFormGroup(newSetParams, false); // forLogging = false
    });

    const exerciseFg = this.fb.group({
      id: this.workoutService.generateWorkoutExerciseId(), // New ID
      exerciseId: [loggedEx.exerciseId, Validators.required],
      exerciseName: [loggedEx.exerciseName],
      notes: [loggedEx.notes || ''],
      sets: this.fb.array(sets),
      // Carry over superset info from the log
      supersetId: [loggedEx.supersetId || null],
      supersetOrder: [loggedEx.supersetOrder ?? null],
      supersetSize: [loggedEx.supersetSize ?? null],
      rounds: [loggedEx.rounds || 0, [Validators.min(0)]],
    });

    // Add listeners and update controls as needed, similar to createExerciseFormGroup
    exerciseFg.get('supersetId')?.valueChanges.subscribe(() => this.updateRoundsControlability(exerciseFg));
    this.updateRoundsControlability(exerciseFg);
    this.addRepsListener(exerciseFg);

    return exerciseFg;
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
      rounds: [isFromRoutineTemplate ? (exerciseData?.rounds ?? 0) : 0, [Validators.min(0)]],
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
      id: [loggedEx.id || uuidv4()],
      exerciseId: [loggedEx.exerciseId, Validators.required],
      exerciseName: [loggedEx.exerciseName, Validators.required],
      notes: [loggedEx.notes || ''],
      sets: this.fb.array(loggedEx.sets.map(set => this.createSetFormGroup(set, true))),
      supersetId: [null], supersetOrder: [null], supersetSize: [null], rounds: [0],
    });
  }
  private createSetFormGroup(setData?: ExerciseSetParams | LoggedSet, forLogging: boolean = false): FormGroup {
    let repsValue, targetReps, weightValue, targetWeighValue, durationValue, targetDurationValue, notesValue, typeValue, tempoValue, restValue;
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
        restValue = loggedS.restAfterSetUsed;
      } else { // It's ExerciseSetParams from routine template
        const plannedS = setData as ExerciseSetParams;
        repsValue = plannedS.reps;
        targetReps = plannedS.reps;
        weightValue = plannedS.weight;
        targetWeighValue = plannedS.weight;
        durationValue = plannedS.duration;
        targetDurationValue = plannedS.duration;
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
      // repsAchieved is required only if both weightUsed and durationPerformed are null
      formGroupConfig['repsAchieved'] = [
        repsValue ?? null,
        [
          (control: AbstractControl) => {
            const parent = control.parent;
            if (!parent) return null;
            const weightUsed = parent.get('weightUsed')?.value;
            const durationPerformed = parent.get('durationPerformed')?.value;
            // Only require repsAchieved if both weightUsed and durationPerformed are null or empty
            if ((weightUsed == null || weightUsed === '') && (durationPerformed == null || durationPerformed === '')) {
              return Validators.required(control);
            }
            return null;
          },
          Validators.min(0)
        ]
      ];
      formGroupConfig['weightUsed'] = [this.unitService.convertFromKg(weightValue, this.unitService.currentUnit()) ?? null, [Validators.min(0)]];
      formGroupConfig['durationPerformed'] = [durationValue ?? null, [Validators.min(0)]];
      formGroupConfig['plannedSetId'] = [plannedSetIdValue];
      formGroupConfig['timestamp'] = [timestampValue];
      formGroupConfig['tempo'] = [tempoValue];
      formGroupConfig['restAfterSet'] = [restValue];
    } else { // For routine builder (planning mode)
      formGroupConfig['reps'] = [repsValue ?? null, [Validators.min(0)]];
      formGroupConfig['targetReps'] = [targetReps ?? null, [Validators.min(0)]];
      formGroupConfig['weight'] = [this.unitService.convertFromKg(weightValue, this.unitService.currentUnit()) ?? null, [Validators.min(0)]];
      formGroupConfig['targetWeight'] = [this.unitService.convertFromKg(targetWeighValue, this.unitService.currentUnit()) ?? null, [Validators.min(0)]];
      formGroupConfig['duration'] = [durationValue ?? null, [Validators.min(0)]];
      formGroupConfig['targetDuration'] = [targetDurationValue ?? null, [Validators.min(0)]];
      formGroupConfig['tempo'] = [tempoValue || ''];
      formGroupConfig['restAfterSet'] = [restValue ?? 60, [Validators.required, Validators.min(0)]];
    }
    return this.fb.group(formGroupConfig);
  }

  private scrollIntoVie(): void {
    // scroll the new exercise into view
    setTimeout(() => {
      // Get the last exercise FormGroup and try to scroll its DOM element into view if available
      const lastExerciseIndex = this.exercisesFormArray.length - 1;
      const lastExerciseElem = this.expandedSetElements.get(lastExerciseIndex)?.nativeElement;
      if (lastExerciseElem) {
        lastExerciseElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 2000);
  }

  openExerciseSelectionModal(): void {
    if (this.isViewMode) return;
    this.modalSearchTerm.set('');
    this.isExerciseModalOpen = true;

    setTimeout(() => {
      if (this.myExerciseInput && this.myExerciseInput.nativeElement) {
        this.myExerciseInput?.nativeElement?.focus();
      }
    });
  }

  closeExerciseSelectionModal(): void {
    this.isExerciseModalOpen = false;
  }

  onModalSearchTermChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.modalSearchTerm.set(inputElement.value);
  }
  selectExerciseFromLibrary(exerciseFromLibrary: Exercise): void {
    const isCardio = this.isExerciseCardioOnly(exerciseFromLibrary.id);
    const baseSet = {
      id: this.workoutService.generateExerciseSetId(),
      type: 'standard',
      reps: isCardio ? 0 : 8,
      weight: 0,
      restAfterSet: 60,
      duration: isCardio ? 60 : undefined,
      tempo: '',
      notes: ''
    };

    const workoutExercise: WorkoutExercise = {
      id: this.workoutService.generateWorkoutExerciseId(),
      exerciseId: exerciseFromLibrary.id,
      exerciseName: exerciseFromLibrary.name,
      sets: [baseSet],
      type: 'standard',
      supersetId: null,
      supersetOrder: null,
      supersetSize: null,
      rounds: 0
    };

    let newExerciseFormGroup: FormGroup;
    if (this.mode === 'routineBuilder') {
      newExerciseFormGroup = this.createExerciseFormGroup(workoutExercise, true, false);
      this.addRepsListener(newExerciseFormGroup);
      this.exercisesFormArray.push(newExerciseFormGroup);
      this.toggleSetExpansion(this.exercisesFormArray.length - 1, 0);
    } else {
      newExerciseFormGroup = this.createExerciseFormGroup(workoutExercise, false, true);
      this.exercisesFormArray.push(newExerciseFormGroup);
    }

    this.closeExerciseSelectionModal();
  }

  ngAfterViewInit(): void {
    // This can be used to scroll to the expanded set after it's rendered
    this.expandedSetElements.changes.subscribe((elems: QueryList<ElementRef<HTMLDivElement>>) => {
      // Capture the element reference at the exact moment the change happens.
      const elementToScroll = elems.first;

      // Now, check if that specific element reference exists.
      if (elementToScroll) {
        // Also check if the component's state still intends for a set to be expanded.
        if (this.expandedSetPath()) {
          setTimeout(() => {
            // Use the captured 'elementToScroll' constant inside the timeout.
            // This is safe because it holds the reference from when the subscription fired,
            // even if the main 'elems' QueryList has changed since.
            elementToScroll.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100); // Reduced timeout slightly, often doesn't need to be that long.
        }
      }
    });
  }

  addSet(exerciseControl: AbstractControl, exerciseIndex: number): void {
    if (this.isViewMode) return;

    // Prevent adding more than one set to an exercise that is part of a superset.
    if (!!exerciseControl.get('supersetId')?.value) {
      this.toastService.warning("Exercises in a superset can only have one set", 4000, "Action Blocked");
      return;
    }

    const setsArray = this.getSetsFormArray(exerciseControl);
    let newSet;
    if (setsArray.length > 0) {
      // Copy values from the previous set
      const prevSet = setsArray.at(setsArray.length - 1).value;
      // Only copy relevant fields, not IDs
      const setData = { ...prevSet };
      // Remove unique fields
      delete setData.id;
      if (this.mode === 'manualLogEntry') {
        // For logging, only copy fields that make sense
        // Get the current exerciseId from the parent exerciseControl
        const exerciseId = exerciseControl.get('exerciseId')?.value;
        newSet = this.createSetFormGroup({
          id: setData.id ?? this.workoutService.generateExerciseSetId(),
          exerciseId: exerciseId,
          exerciseName: setData.exerciseName,
          repsAchieved: setData.repsAchieved,
          weightUsed: setData.weightUsed,
          durationPerformed: setData.durationPerformed,
          notes: setData.notes,
          type: setData.type,
          plannedSetId: setData.plannedSetId,
          timestamp: new Date().toISOString(),
          targetReps: setData.targetReps,
          targetWeight: setData.targetWeight,
          targetDuration: setData.targetDuration,
          targetTempo: setData.targetTempo
        }, true);
      } else {
        // For routine builder, copy planning fields
        newSet = this.createSetFormGroup({
          id: setData.id ?? this.workoutService.generateExerciseSetId(),
          reps: setData.reps,
          weight: setData.weight,
          duration: setData.duration,
          notes: setData.notes,
          type: setData.type,
          tempo: setData.tempo,
          restAfterSet: setData.restAfterSet
        }, false);
      }
    } else {
      // No previous set, use blank/default
      newSet = this.createSetFormGroup(undefined, this.mode === 'manualLogEntry');
    }
    setsArray.push(newSet);
    this.cdr.detectChanges();
    const newSetIndex = setsArray.length - 1;
    this.toggleSetExpansion(exerciseIndex, newSetIndex);
  }
  removeSet(exerciseControl: AbstractControl, exerciseIndex: number, setIndex: number, event?: MouseEvent): void {
    event?.stopPropagation();
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

  toggleSetExpansion(exerciseIndex: number, setIndex: number, event?: Event): void {
    this.isAllExpandedInViewMode.set(false); // <-- ADD THIS LINE
    event?.stopPropagation();

    if (navigator.vibrate) {
      navigator.vibrate(50); // Use a distinct vibration for long press if desired, e.g., [100, 50, 100]
    }

    // If the event is from a checkbox (superset selection), do not expand/collapse set
    if (
      event &&
      (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement)
    ) {
      return;
    }

    if (this.expandedSetPath() !== null && this.expandedSetPath()?.exerciseIndex === exerciseIndex
      && this.expandedSetPath()?.setIndex === setIndex) {
      return;
    }

    if (this.isViewMode && !(this.expandedSetPath()?.exerciseIndex === exerciseIndex && this.expandedSetPath()?.setIndex === setIndex)) {
      this.expandedSetPath.set({ exerciseIndex, setIndex }); // Allow expanding in view mode
      this.isCompactView = false;
      return;
    } else if (this.isViewMode) {
      this.expandedSetPath.set(null); return;
    } // For edit/new modes:
    const currentPath = this.expandedSetPath();
    if (currentPath?.exerciseIndex === exerciseIndex && currentPath?.setIndex === setIndex) {
      return;
      // this.expandedSetPath.set(null);
      // if (!this.isCompactView) {
      //   return;
      // }
    } else {
      this.expandedSetPath.set({ exerciseIndex, setIndex });
      this.isCompactView = false;
      this.cdr.detectChanges();
      setTimeout(() => {
        const expandedElem = this.expandedSetElements.first?.nativeElement;
        if (expandedElem) {
          const input = expandedElem.querySelector('input[type="text"], input[type="number"]') as HTMLInputElement | null;
          if (input) {
            input.focus();
          }
        }
      }, 50);
    }
  }


  isSetExpanded(exerciseIndex: number, setIndex: number): boolean {
    const currentPath = this.expandedSetPath();
    return currentPath?.exerciseIndex === exerciseIndex && currentPath?.setIndex === setIndex;
  }
  collapseExpandedSet(collapseAll: boolean = false, event?: Event): void {
    this.isAllExpandedInViewMode.set(false); // <-- ADD THIS LINE
    this.expandedSetPath.set(null);
    this.isCompactView = collapseAll;
    event?.stopPropagation();
  }
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

    // fix for compact view
    if (this.isCompactView) {

    }
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

  canUngroupSelectedExercises(): boolean {
    const selectedIndices = this.selectedExerciseIndicesForSuperset();
    if (selectedIndices.length === 0) return false;
    // All selected exercises must be part of the same superset
    const supersetIds = Array.from(new Set(
      selectedIndices
        .map(i => (this.exercisesFormArray.at(i) as FormGroup).get('supersetId')?.value)
        .filter(id => !!id)
    ));
    const uniqueSupersetIds = Array.from(new Set(supersetIds));
    return uniqueSupersetIds.length === 1;
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
      this.toastService.warning("Select at least two exercises", 3000, "Superset Error");
      return;
    }
    for (let i = 1; i < selectedIndices.length; i++) {
      if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
        this.toastService.warning("Selected exercises must be next to each other to form a superset", 5000, "Superset Error");
        return;
      }
    }
    const newSupersetId = uuidv4();
    const supersetSize = selectedIndices.length;
    const supersetRounds = 1;

    selectedIndices.forEach((exerciseIndexInFormArray, orderInSuperset) => {
      const exerciseControl = this.exercisesFormArray.at(exerciseIndexInFormArray) as FormGroup;
      exerciseControl.patchValue({
        supersetId: newSupersetId,
        supersetOrder: orderInSuperset,
        supersetSize: supersetSize,
        rounds: supersetRounds,
        type: 'superset'
      });
      this.updateRoundsControlability(exerciseControl);
      const setsArray = exerciseControl.get('sets') as FormArray;

      // If an exercise is part of a superset, it should only have one set.
      // Remove any additional sets, keeping only the first one.
      while (setsArray.length > 1) {
        setsArray.removeAt(1);
      }

      // This loop will now only run for the single set (if it exists)
      setsArray.controls.forEach((setControl) => {
        if (orderInSuperset < supersetSize - 1) {
          (setControl as FormGroup).get('restAfterSet')?.setValue(0);
        }
      });
    });
    this.selectedExerciseIndicesForSuperset.set([]);
    this.toastService.success("Superset created! Each exercise is now limited to one set", 4000, "Success");
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
    this.toastService.info("Superset ungrouped", 3000, "Ungrouped");
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
    this.toastService.info("Exercise removed", 2000);
    this.expandedSetPath.set(null); // Collapse if an exercise is removed
  }
  errorMessage = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    if (this.isViewMode) { this.toastService.info("View mode. No changes", 3000, "View Mode"); return; }

    if (this.mode === 'routineBuilder') this.recalculateSupersetOrders();

    const isRestGoalRoutine = this.mode === 'routineBuilder' && this.builderForm.get('goal')?.value === 'rest';

    if ((this.mode === 'routineBuilder' && (this.builderForm.get('name')?.invalid || this.builderForm.get('goal')?.invalid)) ||
      (this.mode === 'manualLogEntry' && (this.builderForm.get('workoutDate')?.invalid || this.builderForm.get('startTime')?.invalid || this.builderForm.get('endTime')?.invalid
        //  || this.builderForm.get('durationMinutes')?.invalid
      )
      )) {
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
        this.routine = this.mapFormToRoutine(formValue);
        if (this.isNewMode) {
          this.routine = this.workoutService.addRoutine(this.routine);
        } else {
          this.routine = this.workoutService.updateRoutine(this.routine);
        }
        this.toastService.success(`Routine ${this.isNewMode ? 'created' : 'updated'}!`, 4000, "Success");

        if (this.isNewMode && this.routine) {
          this.isEditMode = true;
          this.isNewMode = false;
          this.currentRoutineId = this.routine.id;
        }

        // this.router.navigate(['/workout']);
      } else { // manualLogEntry
        const workoutDateStr = formValue.workoutDate;
        const startTimeStr = formValue.startTime;
        const endTimeStr = formValue.endTime;
        const combinedStartingDateTimeStr = `${workoutDateStr}T${startTimeStr}:00`;
        const combinedEndingDateTimeStr = `${workoutDateStr}T${endTimeStr}:00`;
        let startTimeMs: number;
        try {
          const parsedStartingDate = parseISO(combinedStartingDateTimeStr);
          if (!isValidDate(parsedStartingDate)) throw new Error("Invalid starting date/time for log entry");
          startTimeMs = parsedStartingDate.getTime();
        } catch (e) { this.toastService.error("Invalid starting date or time format", 0, "Error"); this.spinnerService.hide(); return; }

        let endTimeMs: number | undefined = undefined;
        try {
          const parsedEndingDate = parseISO(combinedEndingDateTimeStr);
          if (!isValidDate(parsedEndingDate)) throw new Error("Invalid ending date/time for log entry");
          endTimeMs = parsedEndingDate.getTime();
        } catch (e) { this.toastService.error("Invalid ending date or time format", 0, "Error"); this.spinnerService.hide(); return; }

        const logExercises: LoggedWorkoutExercise[] = formValue.exercises.map((exInput: any): LoggedWorkoutExercise => ({
          id: exInput.id,
          exerciseId: exInput.exerciseId,
          exerciseName: exInput.exerciseName,
          notes: exInput.notes, // Exercise-level notes from the form
          sets: exInput.sets.map((setInput: any): LoggedSet => ({
            id: setInput.id || uuidv4(),
            exerciseName: exInput.exerciseName,
            plannedSetId: setInput.plannedSetId, // This was set during prefill or from existing log
            exerciseId: exInput.exerciseId,
            type: setInput.type, // <<<< ENSURE THIS IS SAVED
            repsAchieved: setInput.repsAchieved,
            weightUsed: this.unitService.convertToKg(setInput.weightUsed, this.unitService.currentUnit()) ?? undefined,
            durationPerformed: setInput.durationPerformed,
            notes: setInput.notes, // Set-level notes
            // Target fields are not directly edited in log mode form, but might be on LoggedSet if prefilled
            targetReps: setInput.targetReps,
            targetWeight: setInput.targetWeight,
            targetDuration: setInput.targetDuration,
            targetTempo: setInput.targetTempo,
            rpe: undefined, // RPE not part of this form
            timestamp: setInput.timestamp || new Date().toISOString(),
          })),
          rounds: exInput.rounds || 0,
          type: exInput.type || 'standard'
        }));

        const logPayloadBase = {
          date: format(new Date(startTimeMs), 'yyyy-MM-dd'),
          startTime: startTimeMs,
          endTime: endTimeMs,
          durationMinutes:  // Calculate duration in minutes
            endTimeMs ? Math.round((endTimeMs - startTimeMs) / 60000) : Math.round((Date.now() - startTimeMs) / 60000),
          routineId: formValue.routineIdForLog || undefined,
          routineName: formValue.routineIdForLog ?
            (this.availableRoutines.find(r => r.id === formValue.routineIdForLog)?.name || formValue.name || 'Workout from Routine') :
            (formValue.name || 'Ad-hoc Workout'), // Use form 'name' as log title if no routine
          programId: formValue.programIdForLog || undefined,
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
      this.toastService.error("Cannot start workout: Routine ID is missing", 0, "Error");
    }
  }

  enableEditMode(): void {
    if (this.isViewMode && this.currentRoutineId) {
      this.isViewMode = false;
      this.isEditMode = true;
      this.toggleFormState(false);
      this.toastService.info("Edit mode enabled", 3000, "Mode Changed");
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  getExerciseCardClasses(
    exerciseControl: AbstractControl,
    exIndex: number
  ): { [klass: string]: boolean } {
    const isSuperset =
      this.mode === 'routineBuilder' &&
      !!exerciseControl.get('supersetId')?.value;
    const supersetOrder = exerciseControl.get('supersetOrder')?.value ?? -1;
    const supersetName = exerciseControl.get('exerciseName')?.value;
    const supersetSize = exerciseControl.get('supersetSize')?.value ?? 0;
    const isSelected = this.mode === 'routineBuilder' && this.selectedExerciseIndicesForSuperset().includes(exIndex);
    const isFirstInSuperset = isSuperset && supersetOrder === 0;
    const isLastInSuperset = isSuperset && supersetOrder === supersetSize - 1;
    const isMiddleInSuperSet = isSuperset && (!isFirstInSuperset && !isLastInSuperset);
    const isCompact = this.isCompactView;
    const isEdit = this.isEditMode;
    const firstSelected = this.firstSelectedExerciseIndexForSuperset;
    const sets = exerciseControl.get('sets')?.value || [];
    const isWarmup = sets.length > 0 && sets.every((set: any) => set.type === 'warmup');

    const returnObj = {
      // 'p-1.5 sm:p-2': true,
      // 'p-3': !isCompact && this.expandedSetPath()?.exerciseIndex !== exIndex,
      // 'space-y-3': !isCompact,
      // 'border rounded-lg': true,
      'border rounded': true,
      'shadow-sm': true,
      'border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-800/30': isSuperset,
      'ring-2 ring-orange-400 dark:ring-orange-300 shadow-md': isSelected,
      'dark:bg-orange-800/40': isSuperset && isSelected,
      'bg-blue-800/40': isWarmup,
      'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800': !isSuperset && !isSelected && !isWarmup,
      'rounded-b-none border-b-transparent dark:border-b-transparent':
        this.mode === 'routineBuilder' &&
        isSuperset && (isFirstInSuperset || isMiddleInSuperSet),
      'rounded-t-none border-t-transparent dark:border-t-transparent': isSuperset && (isLastInSuperset || isMiddleInSuperSet),
      'border-x border-t':
        isSuperset &&
        isFirstInSuperset,
      'mb-2': !isSuperset || (isSuperset && isLastInSuperset),
      'cursor-grab': this.isEditableMode(),
      'cursor-pointer': !this.isEditableMode(),
    };
    return returnObj;
  }

  /**
   * Checks if the exercise at the given index is adjacent to another exercise with the same supersetId.
   * Returns true if the previous or next exercise shares the same supersetId.
   */
  hasAdjacentSupersets(exerciseIndex: number): boolean {
    const exercises = this.exercisesFormArray;
    if (exerciseIndex < 0 || exerciseIndex >= exercises.length) return false;
    const currentSupersetId = (exercises.at(exerciseIndex) as FormGroup).get('supersetId')?.value;
    if (!currentSupersetId) return false;

    // Check previous exercise
    if (exerciseIndex > 0) {
      const prevSupersetId = (exercises.at(exerciseIndex - 1) as FormGroup).get('supersetId')?.value;
      if (prevSupersetId && prevSupersetId === currentSupersetId) return true;
    }
    // Check next exercise
    if (exerciseIndex < exercises.length - 1) {
      const nextSupersetId = (exercises.at(exerciseIndex + 1) as FormGroup).get('supersetId')?.value;
      if (nextSupersetId && nextSupersetId === currentSupersetId) return true;
    }
    return false;
  }

  isSupersetSpacing(exIndex: number): boolean {
    if (exIndex <= 0) return false;
    const currentSupersetId = this.exercisesFormArray.at(exIndex).get('id')?.value;
    const prevSupersetId = this.exercisesFormArray.at(exIndex - 1).get('id')?.value;
    return exIndex > 0 && currentSupersetId && currentSupersetId !== prevSupersetId;
  }

  // Called if user wants to define a completely new exercise not in the library
  async handleTrulyCustomExerciseEntry(showError: boolean = false): Promise<void> {
    const inputs: AlertInput[] = [
      { name: 'exerciseName', type: 'text', placeholder: 'Custom Exercise Name', value: '', attributes: { required: true }, label: 'Custom Exercise Name', },
      { name: 'numSets', type: 'number', placeholder: 'Number of Sets (e.g., 3)', value: '3', attributes: { min: '1', required: true }, label: 'Number of Sets' },
      { name: 'equipmentNeeded', type: 'text', placeholder: 'Equipment', value: '', attributes: { required: false }, label: 'Equipment' },
      { name: 'description', type: 'textarea', placeholder: 'Description', value: '', attributes: { required: false }, label: 'Description' },
    ];

    if (showError) {
      this.toastService.error("Invalid input for custom exercise", 0, "Error");
    }
    const result = await this.alertService.showPromptDialog('Add New Custom Exercise', 'Define exercise name and sets:', inputs, 'Add Exercise');

    if (result && result['exerciseName']) {
      const exerciseName = String(result['exerciseName']).trim();
      const description = String(result['description']).trim();
      const numSets = result['numSets'] ? parseInt(String(result['numSets']), 10) : 3;
      if (!exerciseName || numSets <= 0) {
        this.toastService.error("Invalid input for custom exercise", 0, "Error"); return;
      }
      const newExerciseSets: ExerciseSetParams[] = Array.from({ length: numSets }, () => ({
        id: `custom-adhoc-set-${uuidv4()}`, reps: 8, weight: null, duration: undefined, restAfterSet: 60, type: 'standard', notes: '',
      }));
      const slug = exerciseName.trim().toLowerCase().replace(/\s+/g, '-');
      const newExercise: Exercise = {
        id: `custom-adhoc-ex-${slug}-${uuidv4()}`,
        name: exerciseName,
        description: description,
        category: 'custom',
        muscleGroups: [],
        primaryMuscleGroup: '',
        imageUrls: []
      };

      this.closeExerciseSelectionModal();
      this.exerciseService.addExercise(newExercise);

      const workoutExercise: WorkoutExercise = {
        id: this.workoutService.generateWorkoutExerciseId(),
        exerciseId: newExercise.id,
        exerciseName: newExercise.name,
        sets: newExerciseSets,
        type: 'standard',
        supersetId: null,
        supersetOrder: null,
        supersetSize: null,
        rounds: 0
      };
      const newExerciseFormGroup = this.createExerciseFormGroup(workoutExercise, true, false);
      this.exercisesFormArray.push(newExerciseFormGroup);
      this.toggleSetExpansion(this.exercisesFormArray.length - 1, 0);
      this.addRepsListener(newExerciseFormGroup);
    } else {
      if (!result) {
        return
      }
      this.handleTrulyCustomExerciseEntry(true);
      return;
    }
  }


  getRoutineDuration(): number {
    if (this.routine) {
      this.routine = this.mapFormToRoutine(this.builderForm.getRawValue());
      return this.workoutService.getEstimatedRoutineDuration(this.routine);
    } else {
      return 0;
    }
  }

  async getLastRoutineDuration(): Promise<void> {
    this.lastRoutineDuration = 0;
    if (this.routine) {
      const lastRoutineLogged = await firstValueFrom(
        this.trackingService.getLastPerformanceForRoutine(this.routine.id).pipe(take(1))
      );
      if (lastRoutineLogged && lastRoutineLogged.lastPerformedDate && lastRoutineLogged.durationMinutes) {
        // const totalMinutes = Math.round(lastRoutineLogged.durationMinutes / 60);
        this.lastRoutineDuration = lastRoutineLogged.durationMinutes;
      }
    }
  }

  private mapFormToRoutine(formValue: any): Routine {
    const routinePayload: Routine = {
      id: this.currentRoutineId || uuidv4(), name: formValue.name, description: formValue.description, goal: formValue.goal,
      exercises: (formValue.goal === 'rest') ? [] : formValue.exercises.map((exInput: any) => ({
        ...exInput,
        id: exInput.id || uuidv4(),
        sets: exInput.sets.map((setInput: any) => ({
          ...setInput, // This includes 'type', 'reps', 'duration', 'tempo', 'restAfterSet', 'notes'
          weight: this.unitService.convertToKg(setInput.weight, this.unitService.currentUnit()) ?? null,
        }))
      })),
      isFavourite: this.routine?.isFavourite,
      isHidden: this.routine?.isHidden,
      lastPerformed: this.routine?.lastPerformed || '',
    };
    return routinePayload;
  }


  getRoutineDropdownActionItems(routineId: string, mode: 'dropdown' | 'compact-bar'): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';;

    const editButton = {
      label: 'EDIT',
      actionKey: 'edit',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    };

    const currentRoutine = this.routine;

    const actionsArray = [
      {
        label: 'START',
        actionKey: 'start',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      {
        label: 'CLONE',
        actionKey: 'clone',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" fill="none"><path d="M 5 3 H 16 A 2 2 0 0 1 18 5 V 16 A 2 2 0 0 1 16 18 H 5 A 2 2 0 0 1 3 16 V 5 A 2 2 0 0 1 5 3 Z M 8 6 H 19 A 2 2 0 0 1 21 8 V 19 A 2 2 0 0 1 19 21 H 8 A 2 2 0 0 1 6 19 V 8 A 2 2 0 0 1 8 6 Z" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      }
    ];

    if (this.isViewMode) {
      actionsArray.push(editButton);
    }

    return actionsArray;
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
    // originalMouseEvent.stopPropagation(); // Stop original event that opened the menu
    const routineId = this.routine?.id;
    if (!routineId) return;

    switch (event.actionKey) {
      case 'start':
        this.startCurrentWorkout();
        break;
      case 'edit':
        this.router.navigate(['/workout/routine/edit', routineId]);
        break;
      case 'clone':
        this.cloneAndEditRoutine(routineId);
        break;
    }
    this.activeRoutineIdActions.set(null); // Close the menu
  }

  // Your existing toggleActions, areActionsVisible, viewRoutineDetails, etc. methods
  // The toggleActions will now just control a signal like `activeRoutineIdActions`
  // which is used to show/hide the <app-action-menu>
  activeRoutineIdActions = signal<string | null>(null); // Store ID of routine whose actions are open

  toggleActions(routineId: string, event: Event): void {
    event.stopPropagation();
    this.activeRoutineIdActions.update(current => (current === routineId ? null : routineId));
  }

  areActionsVisible(routineId: string): boolean {
    return this.activeRoutineIdActions() === routineId;
  }

  // When closing menu from the component's output
  onCloseActionMenu() {
    this.activeRoutineIdActions.set(null);
  }

  async cloneAndEditRoutine(routineId: string, event?: MouseEvent): Promise<void> {
    const originalRoutine = this.routine;
    if (!originalRoutine) {
      this.toastService.error("Routine not found for cloning", 0, "Error");
      return;
    }

    // Deep clone the routine and assign a new id
    let clonedRoutine: Routine = {
      ...structuredClone(originalRoutine),
      name: originalRoutine.name + " (Copy)",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      this.spinnerService.show();
      clonedRoutine = await this.workoutService.addRoutine(clonedRoutine);
      this.toastService.success(`Routine "${clonedRoutine.name}" cloned successfully.`, 3000, "Routine Cloned");
      this.router.navigate(['/workout/routine/edit', clonedRoutine.id]);
    } catch (error) {
      console.error("Error during routine cloning:", error);
      this.toastService.error("Failed to clone routine", 0, "Clone Failed");
    } finally {
      this.spinnerService.hide();
    }
  }

  checkIfTimedExercise(loggedEx: any): boolean {
    const loggedExActual = loggedEx?.getRawValue() as WorkoutExercise;
    return loggedExActual?.sets.some(set => set.targetDuration) || loggedExActual?.sets.some(set => set.duration);
  }

  checkIfWeightedExercise(loggedEx: any): boolean {
    const loggedExActual = loggedEx?.getRawValue() as WorkoutExercise;
    return loggedExActual?.sets.some(set => set.targetWeight) || loggedExActual?.sets.some(set => set.weight);
  }

  getSetReps(loggedEx: any): string {
    const rawValue = loggedEx?.getRawValue();
    if (!rawValue || !rawValue.sets) {
      return '';
    }

    let reps: (number | null | undefined)[];

    if (this.currentLogId && !this.isNewMode) { // If we're viewing a logged workout
      const loggedExActual = rawValue as LoggedWorkoutExercise;
      reps = loggedExActual.sets.map(set => set.repsAchieved);
    } else { // If we're in the routine builder
      const loggedExActual = rawValue as WorkoutExercise;
      reps = loggedExActual.sets.map(set => set.reps);
    }

    const validReps = reps.filter(rep => rep != null && rep !== undefined);

    return validReps.length > 0 ? validReps.join(' - ') : '';
  }

  getSetWeightsUsed(loggedEx: any): string {
    if (this.currentLogId) {
      const loggedExActual = loggedEx?.getRawValue() as LoggedWorkoutExercise;
      return loggedExActual?.sets.map(set => set.weightUsed).join(' - ');
    } else {
      const loggedExActual = loggedEx?.getRawValue() as WorkoutExercise;
      return loggedExActual?.sets.map(set => set.weight).join(' - ');
    }
  }

  getSetDurationPerformed(loggedEx: any): string {
    if (this.currentLogId) {
      const loggedExActual = loggedEx?.getRawValue() as LoggedWorkoutExercise;
      return loggedExActual?.sets.map(set => set.durationPerformed).join(' - ');
    } else {
      const loggedExActual = loggedEx?.getRawValue() as WorkoutExercise;
      return loggedExActual?.sets.map(set => set.duration).join(' - ');
    }
  }

  getIconPath(exerciseId: string | undefined): Observable<string> {
    // If there's no ID, return an Observable of the default path immediately.
    if (!exerciseId) {
      return of(this.exerciseService.getIconPath('default-exercise'));
    }

    // Find the exercise in the local routine data.
    const exerciseInRoutine = this.routine?.exercises.find(ex => ex.exerciseId === exerciseId);

    if (exerciseInRoutine) {
      // If found, get the full exercise details from the service.
      // Use .pipe() to transform the result before it's returned.
      return this.exerciseService.getExerciseById(exerciseInRoutine.exerciseId).pipe(
        map(exerciseDetails => {
          // The `map` operator transforms the emitted Exercise object
          // into the icon path string you need.
          if (exerciseDetails) {
            const iconName = this.exerciseService.determineExerciseIcon(exerciseDetails, exerciseDetails.name);
            return this.exerciseService.getIconPath(iconName);
          } else {
            return this.exerciseService.getIconPath('default-exercise');
          }
        })
      );
    } else {
      // If not found in the routine, return an Observable of the default path.
      return of(this.exerciseService.getIconPath('default-exercise'));
    }
  }

  // This function is now fast, synchronous, and safe to call from a template.
  checkTextClass(set: LoggedSet, type: 'reps' | 'duration' | 'weight'): string {
    if (!set) {
      return 'text-gray-700 dark:text-gray-300';
    }

    let performedValue = 0;
    let targetValue = 0;

    // Determine which properties to compare based on the 'type'
    if (type === 'reps') {
      performedValue = set.repsAchieved ?? 0;
      targetValue = set.targetReps ?? 0;
    } else if (type === 'duration') {
      performedValue = set.durationPerformed ?? 0;
      targetValue = set.targetDuration ?? 0;
    } else if (type === 'weight') {
      performedValue = set.weightUsed ?? 0;
      targetValue = set.targetWeight ?? 0;
    }

    // The simple comparison logic
    if (performedValue > targetValue) {
      return 'text-green-500 dark:text-green-400';
    } else if (performedValue < targetValue) {
      return 'text-red-500 dark:text-red-400';
    } else {
      return 'text-gray-800 dark:text-white';
    }
  }


  notesModalsData = signal<string | null>(null);
  showNotesModal(notes: string): void {
    this.notesModalsData.set(notes);
  }

  // Add this new public method to the class
  public shouldShowExpandedExercise(exIndex: number): boolean {
    if (this.isCompactView) {
      return false;
    }
    if (this.isAllExpandedInViewMode()) {
      return true;
    }
    const currentPath = this.expandedSetPath();
    return currentPath?.exerciseIndex === exIndex;
  }


  isExerciseDetailModalOpen = signal(false);
  isSimpleModalOpen = signal(false);
  exerciseDetailsId: string = '';
  exerciseDetailsName: string = '';
  openModal(exerciseData: any) {
    this.exerciseDetailsId = exerciseData.exerciseId;
    this.exerciseDetailsName = exerciseData.exerciseName || 'Exercise details';
    this.isSimpleModalOpen.set(true);
  }

  isExerciseCardioOnlyCtrl(exercise: AbstractControl): boolean {
    // This method should be async or use a callback to handle the Observable.
    // Here's a synchronous fallback using availableExercises if possible:
    const exerciseId = exercise.value?.exerciseId;
    return this.isExerciseCardioOnly(exerciseId);
  }

  isExerciseCardioOnly(exerciseId: string): boolean {
    // This method should be async or use a callback to handle the Observable.
    // Here's a synchronous fallback using availableExercises if possible:
    if (!exerciseId) return false;
    const exerciseDetails = this.availableExercises.find(e => e.id === exerciseId);
    if (exerciseDetails && exerciseDetails.category) {
      return exerciseDetails.category === 'cardio';
    }
    return false;
  }

  handleEndTimeChange(): void {
    const dateCtrl = this.builderForm.get('workoutDate');
    const startTimeCtrl = this.builderForm.get('startTime');
    const endTimeCtrl = this.builderForm.get('endTime');

    if (!dateCtrl || !startTimeCtrl || !endTimeCtrl) return;

    const workoutDate = dateCtrl.value;
    const startTime = startTimeCtrl.value;
    const endTime = endTimeCtrl.value;

    if (!workoutDate || !startTime || !endTime) return;

    // Parse start and end times as Date objects on the same day
    const startDateTime = new Date(`${workoutDate}T${startTime}:00`);
    let endDateTime = new Date(`${workoutDate}T${endTime}:00`);

    // If end time is before start time, assume it's the next day
    if (endDateTime.getTime() < startDateTime.getTime()) {
      endDateTime.setDate(endDateTime.getDate() + 1);
      // Update workoutDate to the next day
      const newDateStr = format(endDateTime, 'yyyy-MM-dd');
      dateCtrl.setValue(newDateStr, { emitEvent: false });
      this.toastService.info('End time was before start time, assuming next day');
    }
  }
}