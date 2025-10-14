import { Component, inject, OnInit, OnDestroy, signal, computed, ElementRef, QueryList, ViewChildren, AfterViewInit, ChangeDetectorRef, PLATFORM_ID, Input, HostListener, ViewChild, effect, AfterViewChecked, Signal } from '@angular/core';
import { CommonModule, DecimalPipe, isPlatformBrowser, TitleCasePipe } from '@angular/common'; // Added TitleCasePipe
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, AbstractControl, FormsModule, FormControl, ValidatorFn, ValidationErrors } from '@angular/forms';
import { Subscription, of, firstValueFrom, Observable, from } from 'rxjs';
import { switchMap, tap, take, distinctUntilChanged, map, mergeMap, startWith, debounceTime, filter, mergeAll, pairwise } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, isValid as isValidDate, set } from 'date-fns';

import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

import { Routine, ExerciseTargetSetParams, WorkoutExercise } from '../../core/models/workout.model';
import { Exercise } from '../../core/models/exercise.model';
import { WorkoutLog, LoggedWorkoutExercise, LoggedSet, EnrichedWorkoutLog } from '../../core/models/workout-log.model'; // For manual log
import { WorkoutService } from '../../core/services/workout.service';
import { ExerciseService } from '../../core/services/exercise.service';
import { UnitsService } from '../../core/services/units.service';
import { WeightUnitPipe } from '../../shared/pipes/weight-unit-pipe';
import { SpinnerService } from '../../core/services/spinner.service';
import { AlertService } from '../../core/services/alert.service';
import { ToastService } from '../../core/services/toast.service';
import { TrackingService } from '../../core/services/tracking.service'; // For manual log
import { AlertButton, AlertInput } from '../../core/models/alert.model';
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
import { ScheduledRoutineDay, TrainingProgram } from '../../core/models/training-program.model';
import { TrainingProgramService } from '../../core/services/training-program.service';
import { PressDirective } from '../../shared/directives/press.directive';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ExerciseSelectionModalComponent } from '../../shared/components/exercise-selection-modal/exercise-selection-modal.component';
import { MillisecondsDatePipe } from '../../shared/pipes/milliseconds-date.pipe';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { MenuMode } from '../../core/models/app-settings.model';
import { FabAction, FabMenuComponent } from '../../shared/components/fab-menu/fab-menu.component';
import { colorBtn } from '../../core/services/buttons-data';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgLetDirective } from '../../shared/directives/ng-let.directive';
import { GenerateWorkoutModalComponent } from './generate-workout-modal/generate-workout-modal.component';
import { WorkoutGenerationOptions, WorkoutGeneratorService } from '../../core/services/workout-generator.service';
import { PremiumFeature, SubscriptionService } from '../../core/services/subscription.service';

type BuilderMode = 'routineBuilder' | 'manualLogEntry';

@Component({
  selector: 'app-workout-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink,
    FormsModule, DragDropModule, WeightUnitPipe, TitleCasePipe,
    LongPressDragDirective, AutoGrowDirective, ActionMenuComponent,
    ModalComponent, ClickOutsideDirective,
    ExerciseDetailComponent, IconComponent, TooltipDirective, ExerciseSelectionModalComponent, MillisecondsDatePipe, FabMenuComponent, TranslateModule, NgLetDirective,
    GenerateWorkoutModalComponent],
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
  private appSettingsService = inject(AppSettingsService);
  private translate = inject(TranslateService);
  private workoutGeneratorService = inject(WorkoutGeneratorService);
  private subscriptionService = inject(SubscriptionService);


  @ViewChildren('setRepsInput') setRepsInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChildren('expandedSetElement') expandedSetElements!: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChildren('expandedExerciseCard') expandedExerciseCard!: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChild('exerciseSearchFied') myExerciseInput!: ElementRef;

  isAllExpandedInViewMode = signal(false);
  expandedExerciseNotes = signal<number | null>(null);

  exerciseInfoTooltipString = this.translate.instant('workoutBuilder.exerciseInfoTooltip');
  lastRoutineDuration: number = 0;

  liveFormAsRoutine: Signal<Routine | undefined>;
  private loadedRoutine = signal<Routine | undefined>(undefined);

  lastLoggedRoutineInfo = signal<{ [id: string]: { duration: number, name: string, startTime: number | null } }>({});
  builderForm!: FormGroup;
  mode: BuilderMode = 'routineBuilder';
  isEditableMode = signal<boolean>(false);
  isEditMode = false;
  isNewMode = true;
  isViewMode = false; // Only for routineBuilder mode
  pastSession: boolean = false;
  currentRoutineId: string | null = null; // For editing/viewing a Routine
  currentProgramId: string | null = null;
  dateParam: Date | null = null;
  currentLogId: string | null = null;     // For editing a WorkoutLog
  private routeSub: Subscription | undefined;
  private initialRoutineIdForLogEdit: string | null | undefined = undefined; // For log edit mode
  initialProgramIdForLogEdit: string | null | undefined = undefined; // For log edit mode
  private initialProgramIterationIdForLogEdit: string | null | undefined = undefined; // For log edit mode
  private initialProgramScheduledIdForLogEdit: string | null | undefined = undefined; // For log edit mode

  private subscriptions = new Subscription();

  expandedSetPath = signal<{ exerciseIndex: number, setIndex: number } | null>(null);
  expandedExercisePath = signal<{ exerciseIndex: number } | null>(null);

  lastLogForCurrentRoutine = computed(() => {
    const currentRoutine = this.liveFormAsRoutine();
    const allLogsInfo = this.lastLoggedRoutineInfo();

    // Guard clauses for when data is not yet available
    if (!currentRoutine || !allLogsInfo) {
      return null;
    }

    // Directly look up the info using the routine's ID. This is extremely fast.
    return allLogsInfo[currentRoutine.id] || null;
  });

  availableSetTypes: { value: string, label: string }[] = [
    { value: 'standard', label: this.translate.instant('workoutBuilder.setTypes.standard') },
    { value: 'warmup', label: this.translate.instant('workoutBuilder.setTypes.warmup') },
    { value: 'superset', label: this.translate.instant('workoutBuilder.setTypes.superset') },
    { value: 'amrap', label: this.translate.instant('workoutBuilder.setTypes.amrap') },
    { value: 'dropset', label: this.translate.instant('workoutBuilder.setTypes.dropset') },
    { value: 'failure', label: this.translate.instant('workoutBuilder.setTypes.failure') },
    { value: 'myorep', label: this.translate.instant('workoutBuilder.setTypes.myorep') },
    { value: 'restpause', label: this.translate.instant('workoutBuilder.setTypes.restpause') },
    { value: 'custom', label: this.translate.instant('workoutBuilder.setTypes.custom') }
  ];
  routineGoals: { value: Routine['goal'], label: string }[] = [
    { value: 'hypertrophy', label: this.translate.instant('workoutBuilder.goals.hypertrophy') }, { value: 'strength', label: this.translate.instant('workoutBuilder.goals.strength') },
    { value: 'tabata', label: this.translate.instant('workoutBuilder.goals.tabata') },
    { value: 'muscular endurance', label: this.translate.instant('workoutBuilder.goals.muscularEndurance') }, { value: 'cardiovascular endurance', label: this.translate.instant('workoutBuilder.goals.cardiovascularEndurance') },
    { value: 'fat loss / body composition', label: this.translate.instant('workoutBuilder.goals.fatLoss') }, { value: 'mobility & flexibility', label: this.translate.instant('workoutBuilder.goals.mobility') },
    { value: 'power / explosiveness', label: this.translate.instant('workoutBuilder.goals.power') }, { value: 'speed & agility', label: this.translate.instant('workoutBuilder.goals.speed') },
    { value: 'balance & coordination', label: this.translate.instant('workoutBuilder.goals.balance') }, { value: 'skill acquisition', label: this.translate.instant('workoutBuilder.goals.skill') },
    { value: 'rehabilitation / injury prevention', label: this.translate.instant('workoutBuilder.goals.rehabilitation') }, { value: 'mental health / stress relief', label: this.translate.instant('workoutBuilder.goals.mentalHealth') },
    { value: 'general health & longevity', label: this.translate.instant('workoutBuilder.goals.generalHealth') }, { value: 'sport-specific performance', label: this.translate.instant('workoutBuilder.goals.sportSpecific') },
    { value: 'maintenance', label: this.translate.instant('workoutBuilder.goals.maintenance') }, { value: 'rest', label: this.translate.instant('workoutBuilder.goals.rest') }, { value: 'custom', label: this.translate.instant('workoutBuilder.goals.custom') }
  ];

  isExerciseModalOpen = false;
  availableExercises: Exercise[] = [];
  availableRoutines: Routine[] = []; // For selecting a base routine when logging manually
  availablePrograms: TrainingProgram[] = [];
  // START: Added properties for program-based logging
  // availableRoutineForProgram: ScheduledRoutineDay[] = [];
  availableIterationIds: string[] = [];
  availableScheduledDayIds: string[] = [];
  availableScheduledDayInfos: ScheduledRoutineDay[] = [];
  // END: Added properties
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
      (ex.description && ex.description.toLowerCase().includes(term)) ||
      (ex.primaryMuscleGroup && ex.primaryMuscleGroup.toLowerCase().includes(term))
    );
  });
  selectedExerciseIndicesForSuperset = signal<number[]>([]);

  private sanitizer = inject(DomSanitizer);
  public sanitizedDescription: SafeHtml = '';

  private previousFormState: any = null;

  /**
  * Defines the canonical, fixed order in which metric fields should be displayed.
  * The template will iterate over this array and only show the fields that are currently visible.
  */
  readonly defaultMetricFieldOrder = ['reps', 'weight', 'distance', 'duration'];

  // Add new signals to manage the generator's state
  isGeneratorModalOpen = signal(false);
  isGeneratedRoutine = signal(false);
  lastGenerationOptions = signal<WorkoutGenerationOptions | null>(null);

  constructor() {
    this.builderForm = this.fb.group({
      name: [''], // Validated based on mode
      description: [''], // Only for routineBuilder
      goal: [''], // Only for routineBuilder

      // --- START: ADD NEW FORM CONTROLS ---
      primaryCategory: [''],
      secondaryCategory: [''],
      tags: [''],
      // --- END: ADD NEW FORM CONTROLS ---

      workoutDate: [''], // Only for manualLogEntry
      startTime: [''],   // Only for manualLogEntry
      endTime: [''],   // Only for manualLogEntry
      // durationMinutes: [60, [Validators.min(1)]], // Only for manualLogEntry
      overallNotesLog: [''], // Only for manualLogEntry
      routineIdForLog: [''], // For selecting base routine in manualLogEntry
      programIdForLog: [''], // For selecting base program in manualLogEntry
      iterationIdForLog: [''], // For selecting base program iteration in manualLogEntry
      scheduledDayIdForLog: [''], // For selecting base program iteration in manualLogEntry
      exercises: this.fb.array([]), // Validated based on mode/goal
    });

    const formValue$ = this.builderForm.valueChanges.pipe(
      startWith(this.builderForm.getRawValue()),
      map(formValue => this.mapFormToRoutine(formValue))
    );
    this.liveFormAsRoutine = toSignal(formValue$, { initialValue: undefined });

    this.builderForm.valueChanges.pipe(
      // Use pairwise to get both the previous and current value
      debounceTime(500),
      startWith(this.builderForm.getRawValue()), // Emit initial value to start the stream
      pairwise()
    ).subscribe(([previousValue, currentValue]) => {
      if (this.isUndoingOrRedoing) {
        this.isUndoingOrRedoing = false; // Reset flag
        return;
      }

      // When a new change is made, it invalidates any "redo" states
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }

      // Add the new state to the history
      this.history.push(JSON.parse(JSON.stringify(currentValue)));
      this.historyIndex++;

      // Enforce the maximum history size
      if (this.history.length > this.MAX_HISTORY_SIZE) {
        this.history.shift(); // Remove the oldest state
        this.historyIndex--;
      }

      // Update the state of our control signals
      this.updateHistorySignals();
      this.refreshFabMenuItems();
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
        this.isGeneratedRoutine.set(false);
        this.mode = data['mode'] as BuilderMode || 'routineBuilder';
        this.isNewMode = data['isNew'] === true; // True if creating new (Routine or Log)
        console.log(`Builder ngOnInit: Mode=${this.mode}, isNewMode=${this.isNewMode}`);

        this.currentRoutineId = this.route.snapshot.paramMap.get('routineId'); // For editing/viewing a Routine, or prefilling a Log
        this.currentLogId = this.route.snapshot.paramMap.get('logId');         // For editing a WorkoutLog or creating a routine from a log
        this.currentProgramId = this.route.snapshot.queryParamMap.get('programId');
        this.pastSession = this.route.snapshot.queryParamMap.get('pastSession') ? Boolean(this.route.snapshot.queryParamMap.get('pastSession')) : false;
        this.initialProgramIdForLogEdit = this.currentProgramId;

        this.initialProgramIterationIdForLogEdit = this.route.snapshot.queryParamMap.get('iterationId');
        this.initialProgramScheduledIdForLogEdit = this.route.snapshot.queryParamMap.get('scheduledDayId');

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
          if (this.isEditMode) {
            // For both routine and log editing, capture the initial state
            this.originalStateSnapshot = JSON.parse(JSON.stringify(loadedData));
            this.canRestore.set(true);
          }

          if (this.mode === 'routineBuilder' && this.currentLogId && this.isNewMode) {
            this.prefillRoutineFormFromLog(loadedData as WorkoutLog);
          } else if (this.mode === 'routineBuilder') {
            // Set our new signal with the initial data
            this.loadedRoutine.set(loadedData as Routine);
            this.patchFormWithRoutineData(loadedData as Routine);
          } else if (this.mode === 'manualLogEntry' && this.isEditMode && this.currentLogId) {
            this.patchFormWithLogData(loadedData as WorkoutLog);
            // For a log, we can derive the initial routine state from the form immediately
            this.loadedRoutine.set(this.mapFormToRoutine(this.builderForm.getRawValue()));
          } else if (this.mode === 'manualLogEntry' && this.isNewMode && this.currentRoutineId) {
            this.prefillLogFormFromRoutine(loadedData as Routine);
          }
        } else if (!this.isNewMode && (this.currentRoutineId || this.currentLogId)) {
          this.toastService.error(`Data not found.`, 0, "Error");
          this.router.navigate([this.mode === 'routineBuilder' ? '/workout' : '/history/list']);
        }

        if (this.isViewMode) {
          this.expandAllSets();
        } else {
          this.toggleFormState(false); // Enable for new/edit modes
        }
        this.refreshFabMenuItems();
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

      // START: Added subscription for program selection
      this.builderForm.get('programIdForLog')?.valueChanges.subscribe(programId => {
        if (programId) {
          this.builderForm.get('routineIdForLog')?.disable();
          this.initialProgramIdForLogEdit = programId;
          this.retrieveProgramInfo(programId);
          // Reset the dependent fields if the program changes
          this.builderForm.get('iterationIdForLog')?.setValue('', { emitEvent: false });
          this.builderForm.get('scheduledDayIdForLog')?.setValue('', { emitEvent: false });
          this.builderForm.get('routineIdForLog')?.setValue('', { emitEvent: false });
          this.exercisesFormArray.clear();
        } else {
          this.builderForm.get('routineIdForLog')?.enable();
          this.initialProgramIdForLogEdit = undefined;
          // Clear the options and values if no program is selected
          // this.availableRoutineForProgram = [];
          this.availableIterationIds = [];
          this.availableScheduledDayIds = [];
          this.availableScheduledDayInfos = [];
          this.builderForm.get('iterationIdForLog')?.setValue('', { emitEvent: false });
          this.builderForm.get('scheduledDayIdForLog')?.setValue('', { emitEvent: false });
        }
      });

      // =================== START: FIXED SNIPPET ===================
      this.builderForm.get('scheduledDayIdForLog')?.valueChanges.subscribe(scheduledDayId => {
        const scheduledDayInfo = this.availableScheduledDayInfos.find(
          (info) => info.id === scheduledDayId
        );

        if (!scheduledDayInfo) {
          this.exercisesFormArray.clear();
          this.builderForm.get('routineIdForLog')?.setValue('', { emitEvent: false });
          this.builderForm.get('name')?.setValue('Ad-hoc Workout', { emitEvent: false });
          return;
        }

        firstValueFrom(this.workoutService.getRoutineById(scheduledDayInfo.routineId))
          .then(routineToLog => {
            if (routineToLog) {
              // Surgically update only the necessary parts of the form
              this.builderForm.get('name')?.setValue(`Log: ${routineToLog.name}`, { emitEvent: false });
              this.builderForm.get('routineIdForLog')?.setValue(routineToLog.id, { emitEvent: false });

              // Prefill only the exercises without touching other form controls
              this.exercisesFormArray.clear({ emitEvent: false });
              routineToLog.exercises.forEach(routineEx => {
                this.exercisesFormArray.push(this.createExerciseFormGroup(routineEx, false, true), { emitEvent: false });
              });

              // If the scheduled day has an iterationId, set it in the form
              if (scheduledDayInfo.iterationId) {
                this.builderForm.get('iterationIdForLog')?.setValue(scheduledDayInfo.iterationId, { emitEvent: false });
              }
            } else {
              this.toastService.error(`Routine with ID ${scheduledDayInfo.routineId} not found.`, 0, "Error");
              this.exercisesFormArray.clear();
            }
          })
          .catch(error => {
            console.error("Failed to fetch routine for scheduled day:", error);
            this.toastService.error("Could not load routine details.", 0, "Error");
            this.exercisesFormArray.clear();
          });
      });
      // =================== END: FIXED SNIPPET ===================

      // END: Added subscription
    }

    this.previousGoalValue = this.builderForm.get('goal')?.value;
    const goalSub = this.builderForm.get('goal')?.valueChanges.subscribe(async goalValue => {
      if (this.previousGoalValue !== goalValue && goalValue !== 'tabata') {
        this.previousGoalValue = goalValue;
      }
      if (this.mode === 'routineBuilder' && goalValue === 'rest') {
        while (this.exercisesFormArray.length) this.exercisesFormArray.removeAt(0);
        this.exercisesFormArray.clearValidators();
      }
      // --- NEW/MODIFIED: Tabata and Post-Tabata Logic ---
      const exercises = this.exercisesFormArray.controls as FormGroup[];
      // --- START OF CORRECTION ---
      if (this.mode === 'routineBuilder' && goalValue === 'tabata') {
        const exercises = this.exercisesFormArray.controls as FormGroup[];
        if (exercises.length < 2) {
          this.toastService.warning('Tabata routines require at least 2 exercises. Please add more exercises first.', 5000);
          this.builderForm.get('goal')?.setValue(this.previousGoalValue, { emitEvent: false });
          return;
        }

        const confirm = await this.alertService.showConfirm(
          'Convert to Tabata?',
          'This will convert all exercises into a single superset. Each round will be set to 20 seconds of work and 10 seconds of rest. Are you sure?',
          'Convert',
          'Cancel'
        );

        if (!confirm || !confirm.data) {
          // User cancelled, so revert the change and stop processing
          this.builderForm.get('goal')?.setValue(this.previousGoalValue, { emitEvent: false });
          return;
        }

        // User confirmed, now proceed with the conversion
        const newSupersetId = uuidv4();
        exercises.forEach((exerciseControl, index) => {
          const setsArray = exerciseControl.get('sets') as FormArray;
          // Standardize to a single set which represents the work interval
          while (setsArray.length > 1) {
            setsArray.removeAt(1);
          }
          if (setsArray.length === 0) {
            const defaultSet: ExerciseTargetSetParams = {
              id: uuidv4(), type: 'standard', restAfterSet: 10, targetDuration: 20
            };
            setsArray.push(this.createSetFormGroup(defaultSet, false));
          }
          // Enforce Tabata timings
          setsArray.at(0).patchValue({
            targetDuration: 20,
            restAfterSet: 10,
            targetReps: null, targetRepsMin: null, targetRepsMax: null,
            targetWeight: null, targetWeightMin: null, targetWeightMax: null,
            targetDistance: null, targetDistanceMin: null, targetDistanceMax: null,
          }, { emitEvent: false });

          exerciseControl.patchValue({
            supersetId: newSupersetId,
            supersetOrder: index,
            supersetType: 'standard', // Tabata is a type of standard superset in this structure
            type: 'superset'
          }, { emitEvent: false });
        });
        this.toastService.info("Routine converted to Tabata format.");

      } else if (this.mode === 'routineBuilder' && this.builderForm.get('goal')?.value !== 'tabata') {
        const firstExercise = this.exercisesFormArray.at(0) as FormGroup;
        if (firstExercise && firstExercise.get('supersetId')?.value && firstExercise.get('sets')?.value?.length === this.exercisesFormArray.length) {
          this.exercisesFormArray.controls.forEach(exerciseControl => {
            (exerciseControl as FormGroup).patchValue({
              supersetId: null,
              supersetOrder: null,
              type: 'standard'
            }, { emitEvent: false });
          });
          this.toastService.info("Tabata grouping removed.", 3000);
        }
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
    const roundsSub = this.builderForm.get('supersetRounds')?.valueChanges.subscribe(value => {
      this.getRoutineDuration();
    });
    this.subscriptions.add(roundsSub);
  }

  // START: Added methods to retrieve program data

  retrieveProgramRoutines(programId: string): ScheduledRoutineDay[] {
    const program = this.availablePrograms.find(p => p.id === programId);
    if (!program) {
      return [];
    }

    if (program.schedule && program.schedule.length > 0) {
      return program.schedule;
    }

    return [];
  }

  retrieveProgramIterationIds(programId: string): string[] {
    const program = this.availablePrograms.find(p => p.id === programId);
    if (!program) {
      return [];
    }

    // If the program has a history of iterations, return their IDs
    if (program.history && program.history.length > 0) {
      return program.history.map(entry => entry.id).filter((id): id is string => !!id);
    }

    // Otherwise, check for a single, top-level iterationId
    if (program.iterationId) {
      return [program.iterationId];
    }

    return [];
  }

  retrieveProgramScheduledDayInfo(programId: string): ScheduledRoutineDay[] {
    const program = this.availablePrograms.find(p => p.id === programId);
    if (!program) {
      return [];
    }

    let schedules: ScheduledRoutineDay[] = [];

    // Check for a top-level schedule array
    if (program.schedule && program.schedule.length > 0) {
      const scheduleInside = program.schedule;
      schedules.push(...scheduleInside);
    }

    // Check for schedules nested within weeks and flatten the result
    if (program.weeks && program.weeks.length > 0) {
      const weeklyIds = program.weeks.flatMap(week =>
        week.schedule ? week.schedule : []
      );
      schedules.push(...weeklyIds);
    }

    // Return only unique schedules
    return [...new Set(schedules)];
  }

  retrieveProgramScheduledDayIds(programId: string): string[] {
    const program = this.availablePrograms.find(p => p.id === programId);
    if (!program) {
      return [];
    }

    let ids: string[] = [];

    // Check for a top-level schedule array
    if (program.schedule && program.schedule.length > 0) {
      const scheduleIds = program.schedule.map(entry => entry.id).filter((id): id is string => !!id);
      ids.push(...scheduleIds);
    }

    // Check for schedules nested within weeks and flatten the result
    if (program.weeks && program.weeks.length > 0) {
      const weeklyIds = program.weeks.flatMap(week =>
        week.schedule ? week.schedule.map(sched => sched.id).filter((id): id is string => !!id) : []
      );
      ids.push(...weeklyIds);
    }

    // Return only unique IDs
    return [...new Set(ids)];
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
      this.selectExercisesFromLibrary([singleExercise]);
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
        iterationIdForLog: '',
        scheduledDayIdForLog: '',
        exercises: []
      };
    } else { // routineBuilder
      return {
        name: '', description: '', goal: '',
        workoutDate: '', startTime: '', endTime: '',
        // durationMinutes: 60,
        overallNotesLog: '', routineIdForLog: '', programIdForLog: '', iterationIdForLog: '', scheduledDayIdForLog: '',
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
        this.builderForm.get('iterationIdForLog')?.disable({ emitEvent: false });
        this.builderForm.get('scheduledDayIdForLog')?.disable({ emitEvent: false });
      } else { // manualLogEntry
        // Name field is used for WorkoutLog's title, so it should be enabled or prefilled
        // this.builderForm.get('name')?.enable({ emitEvent: false });
        this.builderForm.get('description')?.disable({ emitEvent: false });
        this.builderForm.get('goal')?.disable({ emitEvent: false });

        if (this.checkIfLogForProgram()) {
          this.builderForm.get('programIdForLog')?.disable();
          this.builderForm.get('routineIdForLog')?.disable();

          if (this.pastSession) {
            this.builderForm.get('iterationIdForLog')?.disable();
            this.builderForm.get('scheduledDayIdForLog')?.disable();
          } else {
            this.builderForm.get('iterationIdForLog')?.enable();
            this.builderForm.get('scheduledDayIdForLog')?.enable();
          }

          this.builderForm.get('workoutDate')?.disable();
        }

      }
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
      startWith(null),
      mergeMap((_) => {
        const controls = setsFormArray.controls;
        return from(controls).pipe(
          mergeMap((setControl, index) => {
            const repsMinControl = setControl.get('targetRepsMin');
            const repsMaxControl = setControl.get('targetRepsMax');

            const observables = [
              repsMinControl?.valueChanges,
              repsMaxControl?.valueChanges
            ].filter((obs): obs is Observable<any> => !!obs);

            if (observables.length === 0) {
              return of(null);
            }

            return from(observables).pipe(
              mergeAll(),
              map(() => ({ // This map now correctly receives emissions from any of the merged streams
                setIndex: index,
                exerciseId: exerciseControl.get('id')?.value
              })),
              distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
            );
          })
        );
      }),
      filter((change): change is { setIndex: number; exerciseId: string } => change !== null)
    ).subscribe(change => {
      console.log(`Reps Range changed on Ex: ${change.exerciseId}, Set: ${change.setIndex}`);
      this.getRoutineDuration();
    });

    this.subscriptions.add(repsSub);
  }

  private setupDurationListener(exerciseControl: FormGroup): void {
    const setsFormArray = this.getSetsFormArray(exerciseControl);

    const durationSub = setsFormArray.valueChanges.pipe(
      debounceTime(300),
      startWith(null),
      mergeMap((_) => {
        const controls = setsFormArray.controls;
        return from(controls).pipe(
          mergeMap((setControl, index) => {
            const durationMinControl = setControl.get('targetDurationMin');
            const durationMaxControl = setControl.get('targetDurationMax');

            const observables = [
              durationMinControl?.valueChanges,
              durationMaxControl?.valueChanges
            ].filter((obs): obs is Observable<any> => !!obs);

            if (observables.length === 0) {
              return of(null);
            }

            // --- THE CORRECTED PATTERN ---
            // Apply the same robust pattern here for the duration listeners.
            return from(observables).pipe(
              mergeAll(),
              map(() => ({
                setIndex: index,
                exerciseId: exerciseControl.get('id')?.value
              })),
              distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
            );
          })
        );
      }),
      filter((change): change is { setIndex: number; exerciseId: string } => change !== null)
    ).subscribe(change => {
      console.log(`Duration Range changed on Ex: ${change.exerciseId}, Set: ${change.setIndex}`);
      this.getRoutineDuration();
    });

    this.subscriptions.add(durationSub);
  }

  private addDurationListener(exerciseControl: FormGroup): void {
    this.setupDurationListener(exerciseControl);
  }

  private loadAvailableExercises(): void {
    this.exerciseService.getExercises().pipe(take(1)).subscribe(exs => this.availableExercises = exs);
  }

  patchFormWithRoutineData(routine: Routine): void {
    this.builderForm.patchValue({
      name: routine.name,
      description: routine.description,
      goal: routine.goal,
      // --- START: ADD NEW PATCH VALUES ---
      primaryCategory: routine.primaryCategory,
      secondaryCategory: routine.secondaryCategory,
      tags: routine.tags?.join(', ') || '', // Convert array to comma-separated string
      // --- END: ADD NEW PATCH VALUES ---
    });
    this.updateSanitizedDescription(routine.description || '');
    this.exercisesFormArray.clear();
    routine.exercises.forEach(exerciseData => {
      const newExerciseFormGroup = this.createExerciseFormGroup(exerciseData, true, false);
      this.exercisesFormArray.push(newExerciseFormGroup);
      this.addRepsListener(newExerciseFormGroup);
      this.addDurationListener(newExerciseFormGroup);
    });
    this.builderForm.markAsPristine();
  }


  patchFormWithLogData(log: WorkoutLog): void {
    this.initialRoutineIdForLogEdit = log.routineId;
    this.initialProgramIdForLogEdit = log.programId;
    this.initialProgramIterationIdForLogEdit = log.iterationId;
    this.initialProgramScheduledIdForLogEdit = log.scheduledDayId;
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
      iterationIdForLog: log.iterationId || '',
      scheduledDayIdForLog: log.scheduledDayId || '',
    });

    // START: Manually trigger population of dropdowns for existing log
    if (log.programId) {
      this.availableIterationIds = this.retrieveProgramIterationIds(log.programId);
      this.availableScheduledDayIds = this.retrieveProgramScheduledDayIds(log.programId);
      this.availableScheduledDayInfos = this.retrieveProgramScheduledDayInfo(log.programId);
    }
    // END: Manual trigger

    this.exercisesFormArray.clear();
    log.exercises.forEach(loggedEx => {
      // Use this helper to create exercise groups with superset info
      const exerciseFormGroup = this.createExerciseFormGroupFromLoggedExercise(loggedEx);
      this.exercisesFormArray.push(exerciseFormGroup);
    });

    this.toggleFormState(false);
    this.expandedSetPath.set(null);
    this.builderForm.markAsPristine();
  }

  // +++ NEW: Helper to create exercise group FROM LOG data +++
  private createExerciseFormGroupFromLoggedExercise(loggedEx: LoggedWorkoutExercise): FormGroup {
    const fg = this.fb.group({
      id: [loggedEx.id || uuidv4()],
      exerciseId: [loggedEx.exerciseId, Validators.required],
      exerciseName: [loggedEx.exerciseName, Validators.required],
      notes: [loggedEx.notes || ''],
      sets: this.fb.array(loggedEx.sets.map(set => this.createSetFormGroup(set, true))),
      supersetId: [loggedEx.supersetId || null],
      supersetOrder: [loggedEx.supersetOrder ?? null],
      supersetType: [loggedEx.supersetType ?? 'standard'], // Ensure type is also mapped
      emomTimeSeconds: [loggedEx.emomTimeSeconds ?? null] //EMOM seconds
    });
    return fg;
  }

  prefillLogFormFromRoutine(routine: Routine, resetDateTime: boolean = true): void {
    if (this.currentProgramId) {
      this.retrieveProgramInfo(this.currentProgramId);
    }
    const patchData: any = {
      name: `${this.translate.instant('workoutBuilder.logEntry.logForProgramTitle', { programName: '', routineName: '' })}${routine.name}`,
      routineIdForLog: routine.id,
      iterationIdForLog: this.initialProgramIterationIdForLogEdit,
      scheduledDayIdForLog: this.initialProgramScheduledIdForLogEdit,
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
      //IMPORTANT: isFromRoutineTemplate MUST be true, so the exercise can hold supersetId if there is one
      const newExercise = this.createExerciseFormGroup(routineEx, true, true);

      this.exercisesFormArray.push(newExercise, { emitEvent: false });
    });
    this.builderForm.markAsDirty();
  }

  prefillRoutineFormFromLog(log: WorkoutLog): void {
    this.builderForm.patchValue({
      // Suggest a name for the new routine based on the log
      name: `${log.routineName || this.translate.instant('workoutBuilder.logEntry.adHocTitle')} - As Routine`,
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
      const newSetParams: ExerciseTargetSetParams = {
        id: this.workoutService.generateExerciseSetId(), // New ID for the routine set
        targetReps: loggedSet.repsAchieved,
        targetWeight: loggedSet.weightUsed ?? null,
        targetDuration: loggedSet.durationPerformed,
        targetDistance: loggedSet.distanceAchieved,
        restAfterSet: loggedSet.targetRestAfterSet ?? 60, // Use original target rest, or default
        type: loggedSet.type,
        notes: loggedSet.notes,
        targetTempo: loggedSet.targetTempo,
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
    });

    // Add listeners and update controls as needed, similar to createExerciseFormGroup
    this.addRepsListener(exerciseFg);
    this.addDurationListener(exerciseFg);

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
      supersetId: [exerciseData?.supersetId || null], // PRESERVE superset
      supersetOrder: [exerciseData?.supersetOrder ?? null], // PRESERVE superset
      // +++ NEW FORM CONTROLS +++
      supersetType: [exerciseData?.supersetType ?? 'standard'],
      emomTimeSeconds: [exerciseData?.emomTimeSeconds ?? null] //PRESERVE EMOM
    }) as FormGroup;

    if (isFromRoutineTemplate) {
    } else {
      fg.get('supersetRounds')?.enable({ emitEvent: false });
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
      supersetId: [null], supersetOrder: [null], supersetRounds: [0],
    });
  }

  private createRangeValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const group = control as FormGroup;
      if (!group) return null;

      const repsMinControl = group.get('targetRepsMin');
      const repsMaxControl = group.get('targetRepsMax');
      const durationMinControl = group.get('targetDurationMin');
      const durationMaxControl = group.get('targetDurationMax');

      // Reps validation
      if (repsMinControl && repsMaxControl && repsMinControl.value != null && repsMaxControl.value != null && +repsMaxControl.value < +repsMinControl.value) {
        repsMaxControl.setErrors({ min: true });
      } else if (repsMaxControl?.hasError('min')) {
        // Clear the specific 'min' error if valid now
        const { min, ...errors } = repsMaxControl.errors || {};
        repsMaxControl.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }

      // Duration validation
      if (durationMinControl && durationMaxControl && durationMinControl.value != null && durationMaxControl.value != null && +durationMaxControl.value < +durationMinControl.value) {
        durationMaxControl.setErrors({ min: true });
      } else if (durationMaxControl?.hasError('min')) {
        // Clear the specific 'min' error if valid now
        const { min, ...errors } = durationMaxControl.errors || {};
        durationMaxControl.setErrors(Object.keys(errors).length > 0 ? errors : null);
      }

      // This validator sets errors on controls, so it doesn't need to return an error for the group itself.
      return null;
    };
  }


  // isRepsRangeMode, isWeightRangeMode, isDurationRangeMode
  private createSetFormGroup(setData?: ExerciseTargetSetParams | LoggedSet, forLogging: boolean = false): FormGroup {
    let targetRepsValue, targetWeighValue, targetDurationValue, notesValue, typeValue, tempoValue, restValue;
    let targetRepsMinValue, targetRepsMaxValue, targetDurationMinValue, targetDurationMaxValue, targetWeightMinValue, targetWeightMaxValue; // For ranges
    let targetDistanceValue, targetDistanceMinValue, targetDistanceMaxValue;
    let id = uuidv4();
    let plannedSetIdValue;
    let timestampValue = new Date().toISOString(); // Default for new sets being logged
    let fieldOrderValue: string[] | undefined;

    if (setData) {
      id = setData.id || id; // Keep original set ID if from template or editing logged set
      fieldOrderValue = setData.fieldOrder;
      if ('repsAchieved' in setData) { // It's a LoggedSet
        const loggedS = setData as LoggedSet;
        targetRepsValue = loggedS.repsAchieved;
        targetWeighValue = loggedS.weightUsed;
        targetDurationValue = loggedS.durationPerformed;
        targetDistanceValue = loggedS.distanceAchieved;
        notesValue = loggedS.notes;
        typeValue = loggedS.type || 'standard'; // Use logged type, default to standard
        plannedSetIdValue = loggedS.plannedSetId;
        timestampValue = loggedS.timestamp; // Preserve original timestamp for logged sets
        tempoValue = loggedS.targetTempo || '';
        restValue = loggedS.restAfterSetUsed;
      } else { // It's ExerciseSetParams from routine template
        const plannedS = setData as ExerciseTargetSetParams;
        targetRepsValue = plannedS.targetReps;
        targetRepsMinValue = plannedS.targetRepsMin;
        targetRepsMaxValue = plannedS.targetRepsMax;
        targetWeighValue = plannedS.targetWeight;
        targetWeightMinValue = plannedS.targetWeightMin;
        targetWeightMaxValue = plannedS.targetWeightMax;
        targetDurationValue = plannedS.targetDuration;
        targetDurationMinValue = plannedS.targetDurationMin;
        targetDurationMaxValue = plannedS.targetDurationMax;
        targetDistanceValue = plannedS.targetDistance;
        targetDistanceMinValue = plannedS.targetDistanceMin;
        targetDistanceMaxValue = plannedS.targetDistanceMax;
        notesValue = plannedS.notes;
        typeValue = plannedS.type || 'standard';
        tempoValue = plannedS.targetTempo;
        restValue = plannedS.restAfterSet;
        plannedSetIdValue = plannedS.id; // This is the template set ID
      }
    } else { // New blank set
      notesValue = '';
      typeValue = 'standard';
      tempoValue = '';
      restValue = 60;
      // For a brand new set, default to reps and weight
      fieldOrderValue = ['reps', 'weight'];
      targetRepsValue = 8;
      targetWeighValue = 10;
    }

    // =================== START OF THE FIX ===================
    if (!fieldOrderValue && setData) {
      // If fieldOrder is missing BUT we have setData (i.e., loading an old routine), calculate it.

      // 1. Create a mock structure that `getVisibleExerciseColumns` can understand.
      // It only needs an object with a `sets` array containing our current `setData`.
      const mockRoutineForHelper = { exercises: [{ sets: [setData] }] } as Routine;

      // 2. Call the service method. We use index 0 because our mock structure only has one exercise.
      const visibleCols = this.workoutService.getVisibleExerciseColumns(mockRoutineForHelper, 0);

      // 3. Filter the canonical order by which columns are visible to create the initial order.
      fieldOrderValue = this.defaultMetricFieldOrder.filter(field => visibleCols[field]);
    }
    // =================== END OF THE FIX ===================

    const formGroupConfig: { [key: string]: any } = {
      id: [id],
      type: [typeValue, Validators.required],
      notes: [notesValue || ''],
      fieldOrder: [fieldOrderValue || []]
    };


    if (forLogging) {
      // repsAchieved is required only if both weightUsed and durationPerformed are null
      formGroupConfig['repsAchieved'] = [
        targetRepsValue ?? null,
        [
          (control: AbstractControl) => {
            const parent = control.parent;
            if (!parent) return null;
            const weightUsed = parent.get('weightUsed')?.value;
            const durationPerformed = parent.get('durationPerformed')?.value;
            if ((weightUsed == null || weightUsed === '') && (durationPerformed == null || durationPerformed === '')) {
              return Validators.required(control);
            }
            return null;
          },
          Validators.min(0)
        ]
      ];
      formGroupConfig['weightUsed'] = [targetWeighValue != null ? this.unitService.convertWeight(targetWeighValue, 'kg', this.unitService.currentWeightUnit()) : null, [Validators.min(0)]];
      formGroupConfig['durationPerformed'] = [targetDurationValue ?? null, [Validators.min(0)]];
      formGroupConfig['distanceAchieved'] = [targetDistanceValue ?? null, [Validators.min(0)]];
      formGroupConfig['plannedSetId'] = [plannedSetIdValue];
      formGroupConfig['timestamp'] = [timestampValue];
      formGroupConfig['tempo'] = [tempoValue];
      formGroupConfig['restAfterSet'] = [restValue];
    } else { // For routine builder (planning mode)
      formGroupConfig['targetReps'] = [targetRepsValue ?? null, [Validators.min(0)]];
      formGroupConfig['targetRepsMin'] = [targetRepsMinValue ?? null, [Validators.min(0)]];
      formGroupConfig['targetRepsMax'] = [targetRepsMaxValue ?? null, [Validators.min(0)]];

      // =================== START: FIXED SNIPPET ===================
      formGroupConfig['targetWeight'] = [targetWeighValue != null ? this.unitService.convertWeight(targetWeighValue, 'kg', this.unitService.currentWeightUnit()) : null, [Validators.min(0)]];
      formGroupConfig['targetWeightMin'] = [targetWeightMinValue != null ? this.unitService.convertWeight(targetWeightMinValue, 'kg', this.unitService.currentWeightUnit()) : null, [Validators.min(0)]];
      formGroupConfig['targetWeightMax'] = [targetWeightMaxValue != null ? this.unitService.convertWeight(targetWeightMaxValue, 'kg', this.unitService.currentWeightUnit()) : null, [Validators.min(0)]];
      // =================== END: FIXED SNIPPET ===================

      formGroupConfig['targetDuration'] = [targetDurationValue ?? null, [Validators.min(0)]];
      formGroupConfig['targetDurationMin'] = [targetDurationMinValue ?? null, [Validators.min(0)]];
      formGroupConfig['targetDurationMax'] = [targetDurationMaxValue ?? null, [Validators.min(0)]];

      formGroupConfig['targetDistance'] = [targetDistanceValue ?? null, [Validators.min(0)]];
      formGroupConfig['targetDistanceMin'] = [targetDistanceMinValue ?? null, [Validators.min(0)]];
      formGroupConfig['targetDistanceMax'] = [targetDistanceMaxValue ?? null, [Validators.min(0)]];

      formGroupConfig['targetTempo'] = [tempoValue || ''];
      formGroupConfig['restAfterSet'] = [restValue ?? 60, [Validators.required, Validators.min(0)]];
    }
    const groupOptions = forLogging ? {} : { validators: this.createRangeValidator() };

    const setFG = this.fb.group(formGroupConfig, groupOptions);

    return setFG;
  }

  private scrollExpandedExerciseIntoView(): void {
    const path = this.expandedSetPath();
    if (path) {
      const exerciseElem = this.expandedSetElements.get(path.exerciseIndex)?.nativeElement;
      if (exerciseElem) {
        // add a few pixels of offset from the top
        const offset = 50;
        const elementPosition = exerciseElem.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - offset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    }
  }

  private scrollExpandedSetIntoView(): void {
    const path = this.expandedSetPath();
    if (path) {
      const exerciseElem = this.expandedSetElements.get(path.exerciseIndex)?.nativeElement;
      if (exerciseElem) {
        const setElems = exerciseElem.querySelectorAll('.set-item');
        const setElem = setElems[path.setIndex] as HTMLElement | undefined;
        if (setElem) {
          // add a few pixels of offset from the top
          const offset = 120;
          const elementPosition = setElem.getBoundingClientRect().top + window.pageYOffset;
          const offsetPosition = elementPosition - offset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      }
    }
  }

  private scrollIntoView(): void {
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
  selectExercisesFromLibrary(selectedExercises: Exercise[]): void {
    selectedExercises.forEach(exerciseFromLibrary => {

      const isCardio = this.isExerciseCardioOnly(exerciseFromLibrary.id);
      const baseSet = {
        id: this.workoutService.generateExerciseSetId(),
        type: 'standard',
        targetReps: isCardio ? 0 : 8,
        targetWeight: 10,
        restAfterSet: 60,
        targetDuration: isCardio ? 60 : undefined,
        targetDistance: isCardio ? 1 : undefined,
        targetTempo: '',
        notes: ''
      } as ExerciseTargetSetParams;

      const workoutExercise: WorkoutExercise = {
        id: this.workoutService.generateWorkoutExerciseId(),
        exerciseId: exerciseFromLibrary.id,
        exerciseName: exerciseFromLibrary.name,
        sets: [baseSet],
        type: 'standard',
        supersetId: null,
        supersetOrder: null,
      };

      let newExerciseFormGroup: FormGroup;
      if (this.mode === 'routineBuilder') {
        newExerciseFormGroup = this.createExerciseFormGroup(workoutExercise, true, false);
        this.addRepsListener(newExerciseFormGroup);
        this.addDurationListener(newExerciseFormGroup);
        this.exercisesFormArray.push(newExerciseFormGroup);
        this.toggleSetExpansion(this.exercisesFormArray.length - 1, 0);
      } else {
        newExerciseFormGroup = this.createExerciseFormGroup(workoutExercise, false, true);
        this.exercisesFormArray.push(newExerciseFormGroup);
      }

      // Optionally, only expand the last one added
      if (selectedExercises.indexOf(exerciseFromLibrary) === selectedExercises.length - 1) {
        this.toggleSetExpansion(this.exercisesFormArray.length - 1, 0);
      }
    });

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

    const supersetId = exerciseControl.get('supersetId')?.value;

    // If it's part of a superset, we need to add a set to ALL exercises in that group.
    if (supersetId) {
      this.exercisesFormArray.controls.forEach((ctrl, idx) => {
        const fg = ctrl as FormGroup;
        if (fg.get('supersetId')?.value === supersetId) {
          const setsArray = this.getSetsFormArray(fg);
          const newSet = this.createSyncedSet(setsArray, ctrl); // Use a helper to create the new set
          setsArray.push(newSet);
        }
      });

      // Expand the new set on the exercise the user actually clicked
      const setsOnClickedExercise = this.getSetsFormArray(exerciseControl);
      const newSetIndex = setsOnClickedExercise.length - 1;
      this.toggleSetExpansion(exerciseIndex, newSetIndex);

    } else {
      // Standard behavior for non-superset exercises
      const setsArray = this.getSetsFormArray(exerciseControl);
      const newSet = this.createSyncedSet(setsArray, exerciseControl);
      setsArray.push(newSet);
      this.cdr.detectChanges();
      const newSetIndex = setsArray.length - 1;
      this.toggleSetExpansion(exerciseIndex, newSetIndex);
    }
  }

  /**
   * Helper method to create a new set, copying from the last one if it exists.
   * This will be used for both standard and superset set additions.
   */
  private createSyncedSet(setsArray: FormArray, ctrl: AbstractControl): FormGroup {
    if (setsArray.length > 0) {
      const prevSet = setsArray.at(setsArray.length - 1).value;
      const setData = { ...prevSet };
      delete setData.id; // Ensure new set gets a new ID
      return this.createSetFormGroup(setData, this.mode === 'manualLogEntry');
    } else {
      // If no sets exist, create a blank default one.
      return this.createSetFormGroup(undefined, this.mode === 'manualLogEntry');
    }
  }

  removeSet(exerciseControl: AbstractControl, exerciseIndex: number, setIndex: number, event?: MouseEvent): void {
    event?.stopPropagation();
    if (this.isViewMode) return;

    const supersetId = exerciseControl.get('supersetId')?.value;

    // If part of a superset, remove the set at the same index from all sibling exercises.
    if (supersetId) {
      this.exercisesFormArray.controls.forEach((ctrl, idx) => {
        const fg = ctrl as FormGroup;
        if (fg.get('supersetId')?.value === supersetId) {
          const setsArray = this.getSetsFormArray(fg);
          // Ensure we don't try to remove a set that doesn't exist
          if (setIndex < setsArray.length) {
            setsArray.removeAt(setIndex);
          }
        }
      });
    } else {
      // Standard behavior for non-superset exercises
      const setsArray = this.getSetsFormArray(exerciseControl);
      setsArray.removeAt(setIndex);

      if (setsArray.length === 0) {
        // If no sets remain, add a default one to avoid empty state
        this.exercisesFormArray.removeAt(exerciseIndex);
      }
    }

    // Collapse UI if the currently expanded set was the one removed.
    const currentExpanded = this.expandedSetPath();
    if (currentExpanded && currentExpanded.exerciseIndex === exerciseIndex && currentExpanded.setIndex === setIndex) {
      this.expandedSetPath.set(null);
    } else if (currentExpanded && currentExpanded.exerciseIndex === exerciseIndex && currentExpanded.setIndex > setIndex) {
      this.expandedSetPath.set({ exerciseIndex, setIndex: currentExpanded.setIndex - 1 });
    }
  }

  toggleSetExpansion(exerciseIndex: number, setIndex: number, event?: Event): void {
    this.closeExerciseActionMenu();
    event?.stopPropagation();

    // Vibrate for haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Ignore clicks on interactive form elements within the header
    if (
      event &&
      (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement)
    ) {
      return;
    }

    const currentPath = this.expandedSetPath();
    const isThisSetCurrentlyExpanded = currentPath?.exerciseIndex === exerciseIndex && currentPath?.setIndex === setIndex;

    // --- START OF THE FIX ---
    if (isThisSetCurrentlyExpanded) {
      // If the clicked set is already open, collapse it by setting the path to null.
      this.expandedSetPath.set(null);
    } else {
      // If no set is open, or a different set is open, expand the clicked set.
      this.expandedSetPath.set({ exerciseIndex, setIndex });

      // The rest of the logic to auto-focus an input remains the same.
      this.cdr.detectChanges();
      setTimeout(() => {
        this.scrollExpandedSetIntoView();
        const expandedElem = this.expandedSetElements.find((_, i) => i === setIndex)?.nativeElement;
        // if (expandedElem) {
        //   const input = expandedElem.querySelector('input[type="text"], input[type="number"]') as HTMLInputElement | null;
        //   if (input) {
        //     // input.focus();
        //   }
        // }
      }, 50);
    }
    // --- END OF THE FIX ---
  }


  isSetExpanded(exerciseIndex: number, setIndex: number): boolean {
    const currentPath = this.expandedSetPath();
    return currentPath?.exerciseIndex === exerciseIndex && currentPath?.setIndex === setIndex;
  }

  collapseExpandedSet(collapseAll: boolean = false, event?: Event): void {
    // Check if the click event exists and if its target is inside our control button container.
    if (event && (event.target as HTMLElement).closest('.view-mode-controls')) {
      // If the click was on one of the buttons, do nothing and exit the function.
      return;
    }

    // If the click was anywhere else, proceed with the original collapse logic.
    this.isAllExpandedInViewMode.set(false);
    this.expandedSetPath.set(null);
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
    event?.stopPropagation();
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
          fg.patchValue({ supersetId: null, supersetOrder: null });
        }
      });
    });
    this.recalculateSupersetOrders();
  }

  private recalculateSupersetOrders(): void {
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
        exerciseForm.patchValue({ supersetOrder: null }, { emitEvent: false });
      }
    });
    supersetGroups.forEach((groupExercises, supersetId) => {
      const supersetGroupType = groupExercises[0].get('supersetType')?.value || 'standard';
      if (supersetGroupType === 'standard' && groupExercises.length < 2) {
        groupExercises.forEach(fg => {
          fg.patchValue({ supersetId: null, supersetOrder: null });
        });
      } else {
        groupExercises.sort((a, b) => {
          return this.exercisesFormArray.controls.indexOf(a) - this.exercisesFormArray.controls.indexOf(b);
        });
        groupExercises.forEach((exerciseForm, index) => {
          exerciseForm.patchValue({
            supersetOrder: index,
          }, { emitEvent: false });
        });
      }
    });
    this.exercisesFormArray.updateValueAndValidity({ emitEvent: false });
  }

  async groupSelectedAsSuperset(): Promise<void> {
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

    let isEmom: boolean = false;

    const customBtns: AlertButton[] = [
      { text: 'STANDARD', role: 'confirm', data: 'standard', cssClass: 'bg-orange-500 text-white' },
      { text: 'EMOM', role: 'confirm', data: 'emom', cssClass: 'bg-teal-500 text-white' }
    ];

    const typeResult = await this.alertService.showConfirmationDialog(
      'Select Group Type',
      'How would you like to group these exercises?',
      customBtns,
    );

    if (!typeResult || !typeResult.data) {
      this.toastService.info("Grouping cancelled.", 2000);
      return;
    }

    const supersetType: 'standard' | 'emom' = typeResult.data;
    let numberOfSets: number;
    let emomTimeSeconds: number | null = null;

    if (supersetType === 'emom') {
      isEmom = true;
      const emomInputs: AlertInput[] = [
        { name: 'emomTime', type: 'number', label: 'Time per Round (s)', value: '60', attributes: { min: '10', required: true } },
        { name: 'numSets', type: 'number', label: 'Number of Rounds (Sets)', value: '5', attributes: { min: '1', required: true } }
      ];
      const emomResult = await this.alertService.showPromptDialog('Set EMOM Details', 'Configure the EMOM parameters.', emomInputs);

      if (!emomResult || !emomResult['emomTime'] || !emomResult['numSets']) {
        return;
      }
      emomTimeSeconds = Number(emomResult['emomTime']);
      numberOfSets = Number(emomResult['numSets']);
    } else {
      const setsResult = await this.alertService.showPromptDialog('Set Superset Rounds', 'How many rounds (sets) should this superset have?',
        [{ name: 'numSets', type: 'number', label: 'Number of Rounds (Sets)', value: '3', attributes: { min: '1', required: true } }]
      );

      if (!setsResult || !setsResult['numSets']) {
        this.toastService.info("Superset creation cancelled.", 2000);
        return;
      }
      numberOfSets = Number(setsResult['numSets']);
    }

    // --- START: CORRECTED LOGIC TO GATHER EXERCISE-SPECIFIC VALUES ---
    const exerciseValueInputs: AlertInput[] = [];
    const selectedExercises = selectedIndices.map(index => this.exercisesFormArray.at(index) as FormGroup);
    const defaultWeightKg = 15;
    const defaultWeightInCurrentUnit = this.unitService.convertWeight(defaultWeightKg, this.unitService.currentWeightUnit(), 'kg');

    selectedExercises.forEach((exerciseControl, i) => {
      const exerciseName = exerciseControl.get('exerciseName')?.value;

      // Get the base exercise details to determine its properties
      const exerciseId = exerciseControl.get('exerciseId')?.value;
      const baseExercise = this.availableExercises.find(ex => ex.id === exerciseId);

      // An exercise is considered weighted if its category is not 'cardio'.
      // This is more reliable than checking the form's current state.
      const isWeighted = baseExercise ? baseExercise.category !== 'cardio' : false;

      exerciseValueInputs.push({
        name: `reps_${i}`,
        type: 'number',
        label: `${exerciseName} - Reps`,
        value: '8', // Default reps
        attributes: { min: '0', required: true }
      });

      // Now, this check correctly determines if a weight input is needed.
      if (isWeighted) {
        exerciseValueInputs.push({
          name: `weight_${i}`,
          type: 'number',
          label: `${exerciseName} - Weight (${this.unitService.getWeightUnitSuffix()})`,
          value: String(Math.round(defaultWeightInCurrentUnit!)),
          attributes: { min: '0' }
        });
      }
    });

    const exerciseValuesResult = await this.alertService.showPromptDialog(
      'Set Exercise Targets',
      'Enter the target reps and weight for each set in the group.',
      exerciseValueInputs
    );

    if (!exerciseValuesResult) {
      this.toastService.info("Grouping cancelled.", 2000);
      return;
    }
    // --- END: CORRECTED LOGIC ---

    const newSupersetId = uuidv4();
    const supersetSize = selectedIndices.length;

    selectedIndices.forEach((exerciseIndexInFormArray, orderInSuperset) => {
      const exerciseControl = this.exercisesFormArray.at(exerciseIndexInFormArray) as FormGroup;

      exerciseControl.patchValue({
        supersetId: newSupersetId,
        supersetOrder: orderInSuperset,
        supersetType: supersetType,
        emomTimeSeconds: emomTimeSeconds,
        type: 'superset'
      });

      const setsArray = exerciseControl.get('sets') as FormArray;
      const targetReps = Number(exerciseValuesResult[`reps_${orderInSuperset}`] ?? 8);
      const targetWeightRaw = exerciseValuesResult[`weight_${orderInSuperset}`] !== undefined
        ? Number(exerciseValuesResult[`weight_${orderInSuperset}`])
        : null;

      const targetWeightKg = targetWeightRaw !== null
        ? this.unitService.convertWeight(targetWeightRaw, 'kg', this.unitService.currentWeightUnit())
        : null;

      const templateSetData: ExerciseTargetSetParams = {
        id: uuidv4(),
        type: 'superset',
        targetReps: targetReps,
        targetWeight: targetWeightKg,
        restAfterSet: 60
      };

      setsArray.clear();

      for (let i = 0; i < numberOfSets; i++) {
        if (isEmom) {
          templateSetData.restAfterSet = 0;
        }

        const newSet = this.createSetFormGroup(templateSetData, false);
        const restValue = (orderInSuperset < supersetSize - 1) ? 0 : 60;
        if (!isEmom) {
          newSet.get('restAfterSet')?.setValue(restValue);
        }
        setsArray.push(newSet);
      }
    });

    this.selectedExerciseIndicesForSuperset.set([]);
    const successMessage = supersetType === 'emom'
      ? `EMOM created for ${numberOfSets} rounds!`
      : `Superset created with ${numberOfSets} rounds!`;
    this.toastService.success(successMessage, 4000, "Success");
    this.expandedSetPath.set(null);
    this.toggleSetExpansion(selectedIndices[0], 0);
  }

  ungroupSuperset(exerciseIndex: number): void {
    if (this.isViewMode) return;
    const exerciseControl = this.exercisesFormArray.at(exerciseIndex) as FormGroup;
    const supersetIdToClear = exerciseControl.get('supersetId')?.value;
    if (!supersetIdToClear) return;

    this.exercisesFormArray.controls.forEach(ctrl => {
      const fg = ctrl as FormGroup;
      if (fg.get('supersetId')?.value === supersetIdToClear) {
        // +++ RESET NEW PROPERTIES ON UNGROUP +++
        fg.patchValue({
          supersetId: null,
          supersetOrder: null,
          supersetType: 'standard', // Reset to default
          emomTimeSeconds: null
        });
      }
    });
    this.selectedExerciseIndicesForSuperset.set([]);
    this.toastService.info("Superset ungrouped", 3000, "Ungrouped");
  }

  removeExercise(exerciseIndex: number, event?: Event): void {
    if (this.isViewMode) return;
    event?.stopPropagation();

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
    if (this.isViewMode) { this.toastService.info(this.translate.instant('workoutBuilder.toasts.viewMode'), 3000, this.translate.instant('workoutBuilder.toasts.viewMode')); return; }
    this.recalculateSupersetOrders();

    // --- NEW: TABATA VALIDATION BLOCK ---
    const formValueForValidation = this.builderForm.getRawValue();
    if (this.mode === 'routineBuilder' && formValueForValidation.goal === 'tabata') {
      const exercises = this.exercisesFormArray.controls as FormGroup[];

      if (exercises.length >= 2) {
        const firstSupersetId = exercises[0].get('supersetId')?.value;
        const numSetsInFirst = (exercises[0].get('sets') as FormArray).length;

        // 1. All exercises must be in the same, single superset
        if (!firstSupersetId || !exercises.every(ex => ex.get('supersetId')?.value === firstSupersetId)) {
          this.toastService.error(this.translate.instant('workoutBuilder.toasts.tabataValidationError1'), 0, this.translate.instant('workoutBuilder.toasts.validationErrorTitle'));
          this.spinnerService.hide();
          return;
        }

        // 2. All exercises must have the same number of sets (rounds)
        if (!exercises.every(ex => (ex.get('sets') as FormArray).length === numSetsInFirst)) {
          this.toastService.error(this.translate.instant('workoutBuilder.toasts.tabataValidationError2'), 0, this.translate.instant('workoutBuilder.toasts.validationErrorTitle'));
          this.spinnerService.hide();
          return;
        }

        // 3. ENFORCE Tabata values on all sets before saving to fix any manual edits
        this.exercisesFormArray.controls.forEach(exControl => {
          const setsArray = exControl.get('sets') as FormArray;
          setsArray.controls.forEach(setControl => {
            setControl.patchValue({
              targetDuration: 20,
              restAfterSet: 10,
              targetReps: null, targetRepsMin: null, targetRepsMax: null,
              targetWeight: null, targetWeightMin: null, targetWeightMax: null,
              targetDistance: null, targetDistanceMin: null, targetDistanceMax: null,
            }, { emitEvent: false });
          });
        });

      } else {
        this.toastService.error(this.translate.instant('workoutBuilder.toasts.tabataSizeError'), 0, this.translate.instant('workoutBuilder.toasts.validationErrorTitle'));
        this.spinnerService.hide();
        return;
      }
    }
    // --- END: TABATA VALIDATION BLOCK ---

    const isRestGoalRoutine = this.mode === 'routineBuilder' && this.builderForm.get('goal')?.value === 'rest';

    if ((this.mode === 'routineBuilder' && (this.builderForm.get('name')?.invalid || this.builderForm.get('goal')?.invalid)) ||
      (this.mode === 'manualLogEntry' && (this.builderForm.get('workoutDate')?.invalid || this.builderForm.get('startTime')?.invalid || this.builderForm.get('endTime')?.invalid
        //  || this.builderForm.get('durationMinutes')?.invalid
      )
      )) {
      this.builderForm.markAllAsTouched();
      // get the errors to be shown in the alert
      const errors: string[] = [];
      if (this.builderForm.get('name')?.invalid) {
        errors.push(this.translate.instant('workoutBuilder.routineBuilder.nameLabel'));
      }
      if (this.builderForm.get('goal')?.invalid) {
        errors.push(this.translate.instant('workoutBuilder.routineBuilder.goalLabel'));
      }
      if (this.builderForm.get('workoutDate')?.invalid) {
        errors.push(this.translate.instant('workoutBuilder.logEntry.dateLabel'));
      }
      if (this.builderForm.get('startTime')?.invalid) {
        errors.push(this.translate.instant('workoutBuilder.logEntry.startTimeLabel'));
      }
      if (this.builderForm.get('endTime')?.invalid) {
        errors.push(this.translate.instant('workoutBuilder.logEntry.endTimeLabel'));
      }

      this.toastService.error(`${this.translate.instant('workoutBuilder.toasts.validationError', { errors: errors.join(', ') })}`, 0, this.translate.instant('workoutBuilder.toasts.validationErrorTitle'));
      return;
    }
    if (!isRestGoalRoutine && this.exercisesFormArray.length === 0) {
      this.toastService.error(this.mode === 'manualLogEntry' ? this.translate.instant('workoutBuilder.toasts.noExercisesLogError') : this.translate.instant('workoutBuilder.toasts.noExercisesRoutineError'), 0, this.translate.instant('workoutBuilder.toasts.validationErrorTitle'));
      return;
    }
    if (!isRestGoalRoutine && !this.validateSupersetIntegrity()) {
      this.toastService.error(this.translate.instant('workoutBuilder.toasts.invalidSupersetError'), 0, this.translate.instant('workoutBuilder.toasts.validationErrorTitle')); return;
    }

    if (this.builderForm.invalid) {
      this.toastService.error(this.translate.instant('workoutBuilder.toasts.formError'), 0, this.translate.instant('workoutBuilder.toasts.validationErrorTitle'));
      this.builderForm.markAllAsTouched(); return;
    }

    const formValue = this.builderForm.getRawValue();
    this.spinnerService.show(this.isNewMode ? "Saving..." : "Updating...");

    try {
      if (this.mode === 'routineBuilder') {
        // First, map the form value to a valid Routine object
        const routinePayload = this.mapFormToRoutine(formValue);
        let savedRoutine: Routine; // Variable to hold the result from the service

        if (this.isNewMode) {
          // Await the async service call
          savedRoutine = await this.workoutService.addRoutine(routinePayload);
        } else {
          // Await the async service call
          // color handling
          const currentRoutineColor: string | undefined = this.liveFormAsRoutine() ? this.liveFormAsRoutine()?.cardColor : '';
          routinePayload.cardColor = currentRoutineColor;

          const tmpResult = await this.workoutService.updateRoutine(routinePayload);
          if (tmpResult) {
            savedRoutine = tmpResult;
          } else {
            return;
          }
        }

        this.toastService.success(`Routine ${this.isNewMode ? 'created' : 'updated'}!`, 4000, "Success");

        // This logic correctly transitions the component from "new" to "edit" mode
        if (this.isNewMode && savedRoutine) {
          this.isEditMode = true;
          this.isNewMode = false;
          this.currentRoutineId = savedRoutine.id;
          // Optionally navigate to the edit URL to make the state consistent with the URL
          this.router.navigate(['/workout/routine/edit', savedRoutine.id], { replaceUrl: true });
        }

        // this.router.navigate(['/workout']);
      } else { // manualLogEntry
        const workoutDateStr = formValue.workoutDate;
        const startTimeStr = formValue.startTime;
        const endTimeStr = formValue.endTime;
        const combinedStartingDateTimeStr = `${workoutDateStr}T${startTimeStr}:00`;
        const combinedEndingDateTimeStr = `${workoutDateStr}T${endTimeStr}:00`;

        const startTimeMs = parseISO(combinedStartingDateTimeStr).getTime();
        let endTimeMs: number | undefined = parseISO(combinedEndingDateTimeStr).getTime();

        if (endTimeMs < startTimeMs) {
          endTimeMs += 24 * 60 * 60 * 1000; // Add one day if end time is on the next day
        }

        const logExercises: LoggedWorkoutExercise[] = formValue.exercises.map((exInput: any): LoggedWorkoutExercise => {
          // *** NEW SIMPLIFIED LOGIC ***
          // The logic is now the same for ALL exercises. We just map the sets from the form.
          const loggedSets: LoggedSet[] = exInput.sets.map((setInput: any): LoggedSet => ({
            id: setInput.id || uuidv4(),
            exerciseName: exInput.exerciseName,
            plannedSetId: setInput.plannedSetId,
            exerciseId: exInput.exerciseId,
            type: setInput.type,
            repsAchieved: setInput.repsAchieved,
            weightUsed: this.unitService.convertWeight(setInput.weightUsed, 'kg', this.unitService.currentWeightUnit()) ?? undefined,
            distanceAchieved: setInput.distanceAchieved,
            durationPerformed: setInput.durationPerformed,
            notes: setInput.notes,
            targetReps: setInput.targetReps,
            targetWeight: setInput.targetWeight,
            targetDuration: setInput.targetDuration,
            targetTempo: setInput.targetTempo,
            rpe: undefined,
            timestamp: setInput.timestamp || new Date().toISOString(),
          }));


          // Return the complete LoggedWorkoutExercise object.
          // Note that we no longer save 'supersetRounds' to the log.
          return {
            id: exInput.id,
            exerciseId: exInput.exerciseId,
            exerciseName: exInput.exerciseName,
            notes: exInput.notes,
            sets: loggedSets, // Use the newly created sets array
            supersetId: exInput.supersetId,
            supersetOrder: exInput.supersetOrder,
            // supersetRounds: is gone
            supersetType: exInput.supersetType || 'standard',
            emomTimeSeconds: exInput.emomTimeSeconds || null,
            type: exInput.type || 'standard'
          };
        });

        const logPayloadBase = {
          date: format(new Date(startTimeMs), 'yyyy-MM-dd'),
          startTime: startTimeMs,
          endTime: endTimeMs,
          durationMinutes:  // Calculate duration in minutes
            endTimeMs ? Math.round((endTimeMs - startTimeMs) / 60000) : Math.round((Date.now() - startTimeMs) / 60000),
          routineId: formValue.routineIdForLog || undefined,
          routineName: formValue.routineIdForLog ?
            (this.availableRoutines.find(r => r.id === formValue.routineIdForLog)?.name || formValue.name || 'Workout from Routine') :
            (formValue.name || this.translate.instant('workoutBuilder.logEntry.adHocTitle')), // Use form 'name' as log title if no routine
          programId: formValue.programIdForLog || undefined,
          notes: formValue.overallNotesLog, // Overall log notes
          exercises: logExercises,
          iterationId: formValue.iterationIdForLog || undefined,
          scheduledDayId: formValue.scheduledDayIdForLog || undefined,
          dayName: 'AAAA'
        } as EnrichedWorkoutLog;

        if (this.isEditMode && this.currentLogId) {
          const updatedLog: WorkoutLog = { ...logPayloadBase, id: this.currentLogId };
          await this.trackingService.updateWorkoutLog(updatedLog);
          this.toastService.success(this.translate.instant('workoutBuilder.toasts.logUpdated'), 4000, "Success");
          this.router.navigate(['/history/log', this.currentLogId]);
        } else {
          const newLog: Omit<WorkoutLog, 'id'> = logPayloadBase;
          const savedLog = await this.trackingService.addWorkoutLog(newLog);
          this.toastService.success(this.translate.instant('workoutBuilder.toasts.logSaved'), 4000, "Success");
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
      // An EMOM can have 1 or more exercises. A standard superset must have at least 2.
      const isEmom = group.length > 0 && group[0].supersetType === 'emom';
      if (group.length < 2 && !isEmom) {
        // This is an invalid group of 1 that is NOT an EMOM.
        return false;
      }

      // Further validation only applies to groups with more than one exercise.
      if (group.length > 1) {
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
    }
    return true;
  }

  get firstSelectedExerciseIndexForSuperset(): number | null {
    const selectedIndices = this.selectedExerciseIndicesForSuperset();
    return selectedIndices.length > 0 ? selectedIndices[0] : null;
  }

  startCurrentWorkout(): void {
    if (this.currentRoutineId) {
      const playerRoute = this.workoutService.checkPlayerMode(this.currentRoutineId);
      this.router.navigate([playerRoute, this.currentRoutineId]);
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

  getSupersetSize(index: number): number {
    return this.workoutService.getSupersetSize(this.liveFormAsRoutine(), index);
  }

  getExerciseCardClass(exerciseControl: AbstractControl, exIndex: number): { [klass: string]: boolean } {
    // --- 1. Determine State ---
    const isEmom = exerciseControl.get('supersetType')?.value === 'emom';
    const isStandardSuperset = !!exerciseControl.get('supersetId')?.value && !isEmom;
    const isSelected = this.selectedExerciseIndicesForSuperset().includes(exIndex);
    const sets = exerciseControl.get('sets')?.value || [];
    const isWarmup = sets.length > 0 && sets.every((set: any) => set.type === 'warmup');

    const supersetOrder = exerciseControl.get('supersetOrder')?.value ?? 0;
    const supersetSize = this.getSupersetSize(exIndex);
    const isFirst = supersetOrder === 0;
    const isLast = supersetOrder === supersetSize - 1;
    const isMiddle = !isFirst && !isLast;
    const isSingle = supersetSize === 1;

    let classes: { [key: string]: boolean } = {};

    // --- 2. Apply Logic Based on Exercise Type ---
    if (isEmom) {


      classes = {
        'border-teal-500 dark:border-teal-400': true,
        'bg-teal-50 dark:bg-teal-900/10': !isSelected,
        'bg-teal-100 dark:bg-teal-800/50': isSelected,
        'rounded-md border-4': isSingle,
        'mb-2': isSingle || isLast,
        'mt-4': isSingle || isFirst,
        'rounded-t-md border-x-4 border-t-4': isFirst && !isSingle,
        'border-x-4': true,
        'rounded-b-md border-b-4': isLast || isSingle,
      };

    } else if (isStandardSuperset) {
      classes = {
        'border-primary': true,
        'bg-orange-100 dark:bg-orange-900/10': !isSelected,
        'bg-orange-200 dark:bg-orange-800/50': isSelected,
        'rounded-t-md border-x-4 border-t-4 mt-4': isFirst,
        'border-x-4': true,
        'rounded-b-md border-b-4 mb-2': isLast,
      };

    } else {
      // This is a standard, non-superset exercise

      classes = {
        'border rounded-md mb-2': true,
        'bg-blue-50 dark:bg-blue-900/40 border-blue-400': isWarmup && !isSelected,
        'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600': !isWarmup && !isSelected,
        'mt-5': this.isEditableMode() && this.selectedExerciseIndicesForSuperset().length >= 2 && exIndex === this.firstSelectedExerciseIndexForSuperset,
      };
    }

    // --- 3. Apply Overriding and Common Classes ---
    if (isSelected) {
      classes['ring-2 ring-yellow-400 dark:ring-yellow-300'] = true;
    }

    classes['shadow-sm'] = true;
    classes['cursor-grab'] = this.isEditableMode();
    classes['cursor-pointer'] = !this.isEditableMode();

    return classes;
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
      const newExerciseSets: ExerciseTargetSetParams[] = Array.from({ length: numSets }, () => ({
        id: `custom-adhoc-set-${uuidv4()}`, targetReps: 8, targetWeight: null, targetDuration: undefined, restAfterSet: 60, type: 'standard', notes: '',
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
      };
      const newExerciseFormGroup = this.createExerciseFormGroup(workoutExercise, true, false);
      this.exercisesFormArray.push(newExerciseFormGroup);
      this.toggleSetExpansion(this.exercisesFormArray.length - 1, 0);
      this.addRepsListener(newExerciseFormGroup);
      this.addDurationListener(newExerciseFormGroup);
    } else {
      if (!result) {
        return
      }
      this.handleTrulyCustomExerciseEntry(true);
      return;
    }
  }

  getRoutineDuration(): number {
    if (this.liveFormAsRoutine()) {
      return this.workoutService.getEstimatedRoutineDuration(this.mapFormToRoutine(this.builderForm.getRawValue()));
    } else {
      return 0;
    }
  }

  //   /**
  //  * Converts a millisecond timestamp into a 'dd/MM/yy HH:mm' formatted string.
  //  * @param msTime The timestamp in milliseconds (e.g., from Date.now() or log.startTime).
  //  * @returns The formatted date string, or an empty string if the input is invalid.
  //  */
  // formatMilliseconds(msTime: number | undefined | null): string {
  //   if (msTime === null || msTime === undefined || !isFinite(msTime)) {
  //     return ''; // Return empty for invalid input
  //   }

  //   try {
  //     const date = new Date(msTime);
  //     return format(date, 'dd/MM/yy HH:mm');
  //   } catch (error) {
  //     console.error("Error formatting date from milliseconds:", error);
  //     return ''; // Return empty on formatting error
  //   }
  // }


  private mapFormToRoutine(formValue: any): Routine {
    const initialRoutine = this.loadedRoutine();

    // Convert comma-separated tags string into a clean string array
    const tagsValue = formValue.tags;
    let tagsArray: string[] = [];

    // Check if tagsValue is a string (from user input) or already an array (from a restored state)
    if (typeof tagsValue === 'string') {
      tagsArray = tagsValue.split(',')
        .map((tag: string) => tag.trim())
        .filter((tag: string) => tag.length > 0);
    } else if (Array.isArray(tagsValue)) {
      // If it's already an array, just use it directly.
      tagsArray = tagsValue;
    }

    const valueObj: Routine = {
      id: this.currentRoutineId || uuidv4(),
      name: formValue.name,
      description: formValue.description,
      goal: formValue.goal,

      // --- START: ADD NEW MAPPED PROPERTIES ---
      primaryCategory: formValue.primaryCategory || undefined,
      secondaryCategory: formValue.secondaryCategory || undefined,
      tags: tagsArray,
      // --- END: ADD NEW MAPPED PROPERTIES ---

      exercises: (formValue.goal === 'rest') ? [] : formValue.exercises.map((exInput: any) => {
        const isSuperset = !!exInput.supersetId;
        return {
          id: exInput.id || uuidv4(),
          exerciseId: exInput.exerciseId,
          exerciseName: exInput.exerciseName,
          notes: exInput.notes,
          sets: exInput.sets.map((setInput: any) => ({
            ...setInput, // Spread to include all set properties like reps, repsMin, repsMax, etc.
            targetWeight: this.unitService.convertWeight(setInput.targetWeight, 'kg', this.unitService.currentWeightUnit()) ?? null,
            targetWeightMin: setInput.targetWeightMin ?? null,
            targetWeightMax: setInput.targetWeightMax ?? null,
            targetReps: setInput.targetReps ?? null,
            targetRepsMin: setInput.targetRepsMin ?? null,
            targetRepsMax: setInput.targetRepsMax ?? null,
            targetDuration: setInput.targetDuration ?? null,
            targetDurationMin: setInput.targetDurationMin ?? null,
            targetDurationMax: setInput.targetDurationMax ?? null,
            targetDistance: setInput.targetDistance ?? null,
            targetDistanceMin: setInput.targetDistanceMin ?? null,
            targetDistanceMax: setInput.targetDistanceMax ?? null,
          } as ExerciseTargetSetParams)),
          supersetId: exInput.supersetId || null,
          supersetOrder: isSuperset ? exInput.supersetOrder : null,
          // +++ MAP NEW PROPERTIES +++
          supersetType: isSuperset ? (exInput.supersetType || 'standard') : null,
          emomTimeSeconds: isSuperset && exInput.supersetType === 'emom' ? exInput.emomTimeSeconds : null,
          type: exInput.type,
        };
      }),
      isFavourite: initialRoutine?.isFavourite,
      isHidden: initialRoutine?.isHidden,
      lastPerformed: initialRoutine?.lastPerformed,
      isDisabled: false,
      cardColor: initialRoutine?.cardColor || undefined,
      createdAt: initialRoutine?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return valueObj;
  }

  isSuperSet(index: number): boolean {
    const exercises = this.liveFormAsRoutine()?.exercises;
    if (!exercises) return false;
    const ex = exercises[index];
    if (!ex?.supersetId) return false;
    return true;
  }


  getRoutineDropdownActionItems(routineId: string, mode: MenuMode): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';


    const colorButton = {
      ...colorBtn,
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    } as ActionMenuItem;

    const editButton = {
      label: 'actionButtons.edit',
      actionKey: 'edit',
      iconName: `edit`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    } as ActionMenuItem;

    const expandAllBtn = {
      label: 'actionButtons.expand',
      actionKey: 'expand',
      iconName: `ungroup`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    } as ActionMenuItem;

    const collapseAllBtn = {
      label: 'actionButtons.collapse',
      actionKey: 'collapse',
      iconName: `collapse`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    } as ActionMenuItem;

    const deleteButton = {
      label: 'actionButtons.delete',
      actionKey: 'delete',
      iconName: `trash`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
      data: { routineId }
    } as ActionMenuItem;

    const routineHistoryBtn = {
      label: 'actionButtons.logs',
      actionKey: 'history',
      iconName: `clock`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    } as ActionMenuItem;


    const actionsArray = [
      {
        label: 'actionButtons.start',
        actionKey: 'start',
        iconName: 'play',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      {
        label: 'actionButtons.copy',
        actionKey: 'clone',
        iconName: 'copy',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      routineHistoryBtn
    ] as ActionMenuItem[];

    if (this.isViewMode) {
      actionsArray.push(editButton);
      if (this.exercisesFormArray?.length > 0) {
        actionsArray.push(expandAllBtn);
        actionsArray.push(collapseAllBtn);
      }
    }
    actionsArray.push(colorButton);

    actionsArray.push({ isDivider: true });
    actionsArray.push(deleteButton);

    return actionsArray;
  }

  async checkEditRoutine(routineId: string): Promise<void> {
    const pausedRoutine = this.workoutService.getPausedSession();
    if (this.workoutService.isPausedSession() && pausedRoutine && pausedRoutine?.routineId === routineId) {
      await this.alertService.showAlert("Info", "It's not possible to edit a running routine. Complete it or discard it before doing it.").then(() => {
        return;
      })
      return;
    }
    this.router.navigate(['/workout/routine/edit', routineId]);
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
    // originalMouseEvent.stopPropagation(); // Stop original event that opened the menu
    const routineId = this.liveFormAsRoutine()?.id;
    if (!routineId) return;

    switch (event.actionKey) {
      case 'start':
        this.startCurrentWorkout();
        break;
      case 'edit':
        this.checkEditRoutine(routineId);
        break;
      case 'clone':
        this.cloneAndEditRoutine(routineId);
        break;
      case 'color':
        this.openColorPicker();
        break;
      case 'delete':
        this.deleteRoutine(routineId);
        break;
      case 'history':
        this.goToRoutineHistory(routineId);
        break;
      case 'collapse':
        this.collapseAllSets();
        break;
      case 'expand':
        this.expandAllSets();
        break;
    }
    this.activeRoutineIdActions.set(null); // Close the menu
  }

  goToRoutineHistory(routineId: string): void {
    this.router.navigate(['/history/list'], routineId ? { queryParams: { routineId: routineId } } : {});
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

  async deleteRoutine(routineId: string, event?: MouseEvent): Promise<void> {
    const confirm = await this.alertService.showConfirm("Delete Routine", "Are you sure you want to delete this workout? This action cannot be undone", "Delete");
    if (confirm && confirm.data) {
      try {
        this.spinnerService.show(); await this.workoutService.deleteRoutine(routineId);
        this.toastService.success("Workout deleted successfully");
        this.router.navigate(['/workout']);
      } catch (err) { this.toastService.error("Failed to delete workout"); }
      finally { this.spinnerService.hide(); }
    }
  }

  async cloneAndEditRoutine(routineId: string, event?: MouseEvent): Promise<void> {
    const originalRoutine = this.liveFormAsRoutine();
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
    const loggedExActual = loggedEx?.getRawValue();
    if (!loggedExActual || !loggedExActual.sets) return false;

    // This now works for both WorkoutExercise (builder) and LoggedWorkoutExercise (log)
    return loggedExActual.sets.some((set: any) =>
      set.duration != null ||
      set.durationMin != null ||
      set.durationMax != null ||
      set.durationPerformed != null
    );
  }

  checkIfWeightedExercise(loggedEx: any): boolean {
    const loggedExActual = loggedEx?.getRawValue() as LoggedWorkoutExercise;
    return loggedExActual?.sets.some(set =>
      (set.weightUsed || set.targetWeight || set.targetWeightMin || set.targetWeightMax));
  }

  getSetReps(loggedEx: any): string { // 'loggedEx' is an AbstractControl (FormGroup)
    const sets = loggedEx?.getRawValue()?.sets as LoggedSet[];
    if (!sets || sets.length === 0) {
      return '';
    }

    const displayValues = sets.map(set => {
      // Use the generic getSetDisplayValue which can handle both LoggedSet and ExerciseTargetSetParams
      // by checking for the relevant min/max/single value properties.
      return this.getSetDisplayValue(new FormGroup({
        targetReps: new FormControl(set.targetReps || set.repsAchieved),
        targetRepsMin: new FormControl(set.targetRepsMin),
        targetRepsMax: new FormControl(set.targetRepsMax),
        repsAchieved: new FormControl(set.weightUsed)
      }), 'reps');
    });

    let stringResult = displayValues.join(', ');

    if (displayValues.every(val => val === displayValues[0])) {
      return 'x ' + displayValues[0];
    }

    if (stringResult.length > 15) {
      stringResult = stringResult.substring(0, 15) + '...';
    }
    return stringResult;
  }

  /**
  * Toggles the input mode for a set's repetitions between a single value and a range.
  * @param setControl The form group for the specific set.
  */
  toggleRepsMode(setControl: AbstractControl, event?: Event): void {
    event?.stopPropagation();
    if (this.isViewMode || !(setControl instanceof FormGroup)) return;

    const repsCtrl = setControl.get('targetReps');
    const repsMinCtrl = setControl.get('targetRepsMin');
    const repsMaxCtrl = setControl.get('targetRepsMax');

    // Check if we are currently in range mode by seeing if either min or max has a value.
    const isCurrentlyRange = repsMinCtrl?.value != null || repsMaxCtrl?.value != null;

    if (isCurrentlyRange) {
      // --- BEHAVIOR 1: Switch FROM Range TO Single ---
      // Get the current min and max, defaulting to 0 if they are null.
      const minVal = repsMinCtrl?.value ?? 0;
      const maxVal = repsMaxCtrl?.value ?? 0;

      // Calculate the average of the range and round it to the nearest whole number.
      const averageValue = Math.round((minVal + maxVal) / 2);

      repsCtrl?.setValue(averageValue); // Set the single value to the calculated average.
      repsMinCtrl?.setValue(null);      // Clear the min range value.
      repsMaxCtrl?.setValue(null);      // Clear the max range value.

    } else {
      // --- BEHAVIOR 2: Switch FROM Single TO Range ---
      // Get the current single value, defaulting to 8 if it's null.
      const singleValue = repsCtrl?.value ?? 8;

      // Calculate the new range [value - 2, value + 2].
      // Ensure the new minimum value is never less than 0.
      const newMin = Math.max(0, singleValue - 2);
      const newMax = singleValue + 2;

      repsMinCtrl?.setValue(newMin); // Set the new min value.
      repsMaxCtrl?.setValue(newMax); // Set the new max value.
      repsCtrl?.setValue(null);     // Clear the single value field.
    }
  }

  /**
   * Toggles the input mode for a set's weight between a single value and a range.
   * Applies a +/- 5kg offset when creating a range.
   * @param setControl The form group for the specific set.
   */
  toggleWeightMode(setControl: AbstractControl, event?: Event): void {
    event?.stopPropagation();
    if (this.isViewMode || !(setControl instanceof FormGroup)) return;

    const weightCtrl = setControl.get('targetWeight');
    const weightMinCtrl = setControl.get('targetWeightMin');
    const weightMaxCtrl = setControl.get('targetWeightMax');

    const isCurrentlyRange = weightMinCtrl?.value != null || weightMaxCtrl?.value != null;

    if (isCurrentlyRange) {
      // Switch FROM Range TO Single
      const minVal = weightMinCtrl?.value ?? 0;
      const maxVal = weightMaxCtrl?.value ?? 0;
      const averageValue = Math.round((minVal + maxVal) / 2);

      weightCtrl?.setValue(averageValue);
      weightMinCtrl?.setValue(null);
      weightMaxCtrl?.setValue(null);
    } else {
      // Switch FROM Single TO Range
      const singleValue = weightCtrl?.value ?? 0;

      // Convert 5kg offset to the user's current weight unit
      const offsetInCurrentUnit = this.unitService.convertWeight(5, this.unitService.currentWeightUnit(), 'kg');

      const newMin = Math.max(0, singleValue - offsetInCurrentUnit);
      const newMax = singleValue + offsetInCurrentUnit;

      weightMinCtrl?.setValue(Math.round(newMin));
      weightMaxCtrl?.setValue(Math.round(newMax));
      weightCtrl?.setValue(null);
    }
  }

  /**
  * Toggles the input mode for a set's duration between a single value and a range.
  * Applies a +/- 30 second offset when creating a range.
  * @param setControl The form group for the specific set.
  */
  toggleDurationMode(setControl: AbstractControl, event?: Event): void {
    event?.stopPropagation();
    if (this.isViewMode || !(setControl instanceof FormGroup)) return;

    const durationCtrl = setControl.get('targetDuration');
    const durationMinCtrl = setControl.get('targetDurationMin');
    const durationMaxCtrl = setControl.get('targetDurationMax');

    const isCurrentlyRange = durationMinCtrl?.value != null || durationMaxCtrl?.value != null;

    if (isCurrentlyRange) {
      // Switch FROM Range TO Single
      const minVal = durationMinCtrl?.value ?? 0;
      const maxVal = durationMaxCtrl?.value ?? 0;
      const averageValue = Math.round((minVal + maxVal) / 2);

      durationCtrl?.setValue(averageValue);
      durationMinCtrl?.setValue(null);
      durationMaxCtrl?.setValue(null);
    } else {
      // Switch FROM Single TO Range
      const singleValue = durationCtrl?.value ?? 30; // Default to 30s
      const offset = 30;

      const newMin = Math.max(0, singleValue - offset);
      const newMax = singleValue + offset;

      durationMinCtrl?.setValue(newMin);
      durationMaxCtrl?.setValue(newMax);
      durationCtrl?.setValue(null);
    }
  }

  /**
   * Helper function for the template to determine if a set is in range mode.
   * @param setControl The AbstractControl for the set.
   * @param field The field to check ('reps' or 'duration').
   * @returns True if the set is configured for a range, otherwise false.
   */
  isRangeMode(setControl: AbstractControl, field: 'reps' | 'duration' | 'weight' | 'distance', event?: Event): boolean {
    event?.stopPropagation();

    if (!(setControl instanceof FormGroup)) return false;

    const firstUpperCaseField = field ? String(field).charAt(0).toUpperCase() + String(field).slice(1) : '';
    const minCtrl = setControl.get(`target${firstUpperCaseField}Min`);
    const maxCtrl = setControl.get(`target${firstUpperCaseField}Max`);
    // A set is in range mode if either min or max has a value.
    return minCtrl?.value != null || maxCtrl?.value != null;
  }

  getSetDurationDisplay(exerciseControl: AbstractControl): string {
    // Check for invalid input or empty sets array
    if (!exerciseControl || !exerciseControl.value || !exerciseControl.value.sets || exerciseControl.value.sets.length === 0) {
      return '';
    }

    // --- MANUAL LOG ENTRY MODE (No Change) ---
    // This correctly shows the actual duration performed for each set.
    if (this.mode === 'manualLogEntry') {
      const rawValue = exerciseControl.getRawValue() as LoggedWorkoutExercise;
      const durations = rawValue.sets.map(set => set.durationPerformed).filter(d => d != null && d > 0);
      return durations.length > 0 ? durations.join('-') : '';
    }

    // --- ROUTINE BUILDER MODE (Updated Logic) ---
    else {
      // Get the FormArray of sets to work directly with the controls.
      const setsFormArray = this.getSetsFormArray(exerciseControl);

      // Map over each set's form control to get its individual display string (e.g., "30-60").
      const displayValues = setsFormArray.controls.map(setControl =>
        this.getSetDisplayValue(setControl, 'duration')
      );

      // Filter out any sets that might not have a duration value to keep the output clean.
      const validDisplayValues = displayValues.filter(value => value && value !== '-');

      // Join the array of display values with a comma and space.
      return validDisplayValues.join(', ');
    }
  }

  /**
  * Generates a display string for a set's value, handling both single values and ranges.
  * @param setControl The AbstractControl for the set.
  * @param field The field to display ('reps' or 'duration').
  * @returns A formatted string for display in the collapsed view.
  */
  getSetDisplayValue(setControl: AbstractControl, field: 'reps' | 'duration' | 'weight' | 'distance'): string {
    if (!setControl) return '-';

    const firstUpperCaseField = field ? String(field).charAt(0).toUpperCase() + String(field).slice(1) : '';

    const min = setControl.get(`target${firstUpperCaseField}Min`)?.value;
    const max = setControl.get(`target${firstUpperCaseField}Max`)?.value;
    const single = setControl.get(`target${firstUpperCaseField}`)?.value;

    const isRange = min != null || max != null;

    if (isRange) {
      if (min != null && max != null) {
        return min === max ? `${min}` : `${min}-${max}`;
      }
      if (min != null) {
        return `${min}+`;
      }
      if (max != null) {
        return `Up to ${max}`;
      }
    }

    return single ?? '-';
  }

  getSetWeightsUsed(loggedEx: any): string {
    const sets = loggedEx?.getRawValue()?.sets as LoggedSet[];
    if (!sets || sets.length === 0) {
      return '';
    }

    const displayValues = sets.map(set => {
      // Use the generic getSetDisplayValue which can handle both LoggedSet and ExerciseTargetSetParams
      // by checking for the relevant min/max/single value properties.
      return this.getSetDisplayValue(new FormGroup({
        targetWeight: new FormControl(set.targetWeight || set.weightUsed),
        targetWeightMin: new FormControl(set.targetWeightMin),
        targetWeightMax: new FormControl(set.targetWeightMax),
        weightUsed: new FormControl(set.weightUsed)
      }), 'weight');
    });

    let stringResult = displayValues.join(', ');
    if (stringResult.length > 15) {
      stringResult = stringResult.substring(0, 15) + '...';
    }
    return stringResult;
  }

  getSetDurationPerformed(loggedEx: any): string {
    if (this.currentLogId) {
      const loggedExActual = loggedEx?.getRawValue() as LoggedWorkoutExercise;
      return loggedExActual?.sets.map(set => set.durationPerformed).join(' - ');
    } else {
      const loggedExActual = loggedEx?.getRawValue() as WorkoutExercise;
      return loggedExActual?.sets.map(set => set.targetDuration).join(' - ');
    }
  }

  getIconPath(exerciseId: string | undefined): Observable<string> {
    // If there's no ID, return an Observable of the default path immediately.
    if (!exerciseId) {
      return of(this.exerciseService.getIconPath('default-exercise'));
    }

    // Find the exercise in the local routine data.
    const exerciseInRoutine = this.liveFormAsRoutine()?.exercises.find((ex: any) => ex.exerciseId === exerciseId);

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
  checkTextClass(set: LoggedSet, type: 'reps' | 'duration' | 'weight' | 'distance'): string {
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

  public expandExerciseCard(exIndex: number, event?: Event): void {
    this.closeExerciseActionMenu();
    // --- START OF THE FIX ---
    if (event) {
      const target = event.target as HTMLElement;
      if (target.closest('button') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }
    }
    // --- END OF THE FIX ---

    // If the guards above did not return, proceed with the original expansion logic.
    event?.stopPropagation();

    if (exIndex < 0 || exIndex >= this.exercisesFormArray.length) {
      this.expandedExercisePath.set(null);
      this.expandedSetPath.set(null);
      return; // Invalid index
    }

    const clickedExercise = this.exercisesFormArray.at(exIndex) as FormGroup;
    const supersetId = clickedExercise.get('supersetId')?.value;

    let masterIndexToExpand = exIndex;
    if (supersetId) {
      const firstIndex = this.exercisesFormArray.controls.findIndex(c =>
        (c as FormGroup).get('supersetId')?.value === supersetId &&
        (c as FormGroup).get('supersetOrder')?.value === 0
      );
      if (firstIndex !== -1) {
        masterIndexToExpand = firstIndex;
      }
    }

    const expandedExIndex = this.expandedExercisePath();
    if (expandedExIndex?.exerciseIndex === masterIndexToExpand) {
      // If the clicked exercise is already expanded, collapse it and its notes
      this.expandedExercisePath.set(null);
      this.expandedSetPath.set(null);
      this.expandedExerciseNotes.set(null); // <-- ADD THIS LINE
    } else {
      // Expand the clicked exercise
      this.expandedExercisePath.set({ exerciseIndex: masterIndexToExpand });
      this.scrollExpandedExerciseIntoView();
    }
  }

  /**
   * Retrieves the specific set's FormGroup for a given exercise and round index.
   * This is a crucial helper for the round-based superset rendering in the template.
   * @param exerciseControl The FormGroup of the exercise, passed as AbstractControl from the template.
   * @param roundIndex The index of the round (which corresponds to the set index).
   * @returns The FormGroup for that specific set.
   */
  public getSetControl(exerciseControl: AbstractControl, roundIndex: number): FormGroup {
    // --- THIS IS THE FIX ---
    // We cast the control to a FormGroup here, inside the component's logic,
    // instead of in the template.
    const exerciseFg = exerciseControl as FormGroup;
    return (exerciseFg.get('sets') as FormArray).at(roundIndex) as FormGroup;
  }

  // Add this new public method to the class
  public shouldShowExpandedExercise(exIndex: number): boolean {
    const currentPath = this.expandedExercisePath();
    return currentPath?.exerciseIndex === exIndex;
  }


  isExerciseDetailModalOpen = signal(false);
  isSimpleModalOpen = signal(false);
  exerciseDetailsId: string = '';
  exerciseDetailsName: string = '';
  openModal(exerciseData: any, event?: Event) {
    event?.stopPropagation();
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

  retrieveProgramInfo(programId: string): void {
    // this.availableRoutineForProgram = this.retrieveProgramRoutines(programId);
    this.availableIterationIds = this.retrieveProgramIterationIds(programId);
    this.availableScheduledDayIds = this.retrieveProgramScheduledDayIds(programId);
    this.availableScheduledDayInfos = this.retrieveProgramScheduledDayInfo(programId);
  }

  isFormInvalid(): boolean {
    return this.builderForm.invalid || (this.exercisesFormArray.length === 0 && !(this.mode === 'routineBuilder' && this.builderForm.get('goal')?.value === 'rest'))
  }

  /**
   * Generates a display string for a set's planned target range.
   * @param set The ExerciseSetParams object from the routine plan.
   * @param field The field to display ('reps' or 'duration' or 'weight).
   * @returns A formatted string like "8-12" or "60+", or an empty string if no range is set.
   */
  public getSetTargetDisplay(set: ExerciseTargetSetParams, field: 'reps' | 'duration' | 'weight' | 'distance'): string {
    let stringResult = this.workoutService.getSetTargetDisplay(set, field);

    if (stringResult.length > 15) {
      stringResult = stringResult.substring(0, 15) + '...';
    }
    return stringResult;
  }




  // +++ NEW METHOD: To change a superset's type +++
  async changeSupersetType(exerciseControl: AbstractControl): Promise<void> {
    if (this.isViewMode || !(exerciseControl instanceof FormGroup)) return;

    const supersetId = exerciseControl.get('supersetId')?.value;
    if (!supersetId) return;

    const currentType = exerciseControl.get('supersetType')?.value || 'standard';
    const newType = currentType === 'standard' ? 'emom' : 'standard';
    let emomTime: number | null = 60; // Default to 60 for EMOM

    if (newType === 'emom') {
      const result = await this.alertService.showPromptDialog(
        'Set EMOM Time',
        'Enter the time for each round in seconds (e.g., 60 for EMOM, 120 for E2MOM).',
        [{ name: 'emomTime', type: 'number', value: '60', attributes: { min: '10', required: true } }]
      );
      if (result && result['emomTime']) {
        emomTime = Number(result['emomTime']);
      } else {
        return; // User cancelled
      }
    } else {
      emomTime = null; // Clear EMOM time when switching back to standard
    }

    // Sync the properties across all exercises in the superset group
    this.syncSupersetProperties(supersetId, newType, emomTime);
    this.toastService.success(`Superset converted to ${newType.toUpperCase()}`, 3000, "Type Changed");

    this.expandedSetPath.set(null);
    this.toggleSetExpansion(this.getExerciseIndexByControl(exerciseControl), 0);
  }

  private getExerciseIndexByControl(exerciseControl: AbstractControl): number {
    return this.exercisesFormArray.controls.findIndex(ctrl => ctrl === exerciseControl);
  }

  // +++ NEW HELPER: To sync properties across a superset group +++
  private syncSupersetProperties(supersetId: string, type: 'standard' | 'emom', emomTime: number | null): void {
    this.exercisesFormArray.controls.forEach(control => {
      const exerciseFg = control as FormGroup;
      if (exerciseFg.get('supersetId')?.value === supersetId) {
        exerciseFg.patchValue({
          supersetType: type,
          emomTimeSeconds: emomTime
        }, { emitEvent: false }); // Use emitEvent: false to prevent circular updates
      }
    });
  }

  /**
 * Checks if the exercise at a given index is the first in its superset group.
 * @param index The index of the exercise in the exercisesFormArray.
 * @returns True if the exercise is the first in a superset.
 */
  public isFirstInSuperset(index: number): boolean {
    const currentEx = this.exercisesFormArray.at(index) as FormGroup;
    // Not a superset if there's no ID
    if (!currentEx?.get('supersetId')?.value) {
      return false;
    }
    // It's the first if its order is 0
    return currentEx.get('supersetOrder')?.value === 0;
  }

  /**
   * Gets the number of rounds for a superset as an array of indices for easy looping.
   * @param index The index of an exercise within the superset.
   */
  getNumberOfRoundsAsArray(index: number): number[] {
    const exerciseControl = this.exercisesFormArray.at(index) as FormGroup;
    const numRounds = (exerciseControl.get('sets') as FormArray)?.length || 0;
    return Array.from({ length: numRounds }, (_, i) => i);
  }

  /**
   * Checks if the exercise at a given index is the last in its superset group.
   * @param index The index of the exercise in the exercisesFormArray.
   * @returns True if the exercise is the last in a superset.
   */
  public isLastInSuperset(index: number): boolean {
    const currentEx = this.exercisesFormArray.at(index) as FormGroup;
    const supersetId = currentEx?.get('supersetId')?.value;
    const supersetSize = currentEx?.get('sets')?.value?.length;

    if (!supersetId || supersetSize == null) {
      return false;
    }
    // It's the last if its order is one less than the total size
    return currentEx.get('supersetOrder')?.value === supersetSize - 1;
  }

  /**
   * Checks if an exercise is neither the first nor the last in its superset group.
   * @param index The index of the exercise in the exercisesFormArray.
   * @returns True if the exercise is in the middle of a superset.
   */
  public isMiddleInSuperset(index: number): boolean {
    const currentEx = this.exercisesFormArray.at(index) as FormGroup;
    if (!currentEx?.get('supersetId')?.value) {
      return false;
    }
    // True if it's part of a superset but not the first or last element
    return !this.isFirstInSuperset(index) && !this.isLastInSuperset(index);
  }

  /**
   * Finds the original index of an exercise control within the main exercisesFormArray.
   * @param control The exercise FormGroup to find.
   */
  getIndexOfExercise(control: AbstractControl): number {
    return this.exercisesFormArray.controls.indexOf(control);
  }

  /**
   * Retrieves all exercise controls that belong to the same superset group.
   * @param index The index of any exercise within the desired superset group.
   * @returns An array of AbstractControls for the exercises in the group, sorted by their order.
   */
  public getSupersetGroupExercises(index: number): AbstractControl[] {
    const currentEx = this.exercisesFormArray.at(index) as FormGroup;
    const supersetId = currentEx?.get('supersetId')?.value;
    if (!supersetId) {
      return []; // Return empty if it's not in a superset
    }

    // Filter all exercises to find those with the same superset ID
    return this.exercisesFormArray.controls
      .filter(ex => (ex as FormGroup).get('supersetId')?.value === supersetId)
      .sort((a, b) => ((a as FormGroup).get('supersetOrder')?.value ?? 0) - ((b as FormGroup).get('supersetOrder')?.value ?? 0));
  }

  protected standarSuperSetOrEmomClass(exerciseControl: AbstractControl, isExpanded: boolean = false): string {
    const standardCardClass = ' absolute -left-2 top-2 text-white text-xs font-bold rounded-md shadow-lg z-10 transform translate-x-3 -translate-y-6 p-1';
    if (exerciseControl.get('supersetType')?.value == 'emom') {
      return !isExpanded ? standardCardClass + ' bg-teal-400 text-white' : 'font-bold text-teal-600 dark:text-teal-400';
    } else if (exerciseControl.get('supersetType')?.value !== 'emom') {
      return !isExpanded ? standardCardClass + ' bg-primary text-white' : 'font-bold text-primary';
    } else {
      return '';
    }
  }

  protected setLabelClass(exerciseControl: AbstractControl): string {
    const standardCardClass = 'flex text-white text-md font-bold rounded-md shadow-lg z-10 p-1 w-full bg-primary justify-between';
    if (exerciseControl.get('supersetType')?.value == 'emom') {
      return standardCardClass + ' bg-teal-400 text-white';
    } else if (exerciseControl.get('supersetType')?.value !== 'emom') {
      return standardCardClass + ' bg-primary text-white';
    } else {
      return '';
    }
  }

  protected standarSuperSetOrEmomLabel(exerciseControl: AbstractControl): string {
    const rounds = exerciseControl.get('sets')?.value?.length || 1;
    let roundString = rounds > 1 ? ` (${rounds} ROUNDS)` : ` (${rounds} ROUND)`;

    if (exerciseControl.get('supersetType')?.value == 'emom') {
      return `EMOM${roundString} - Every ${exerciseControl.get('emomTimeSeconds')?.value || 60}s`;
    } else if (exerciseControl.get('supersetType')?.value !== 'emom') {
      return `SUPERSET${roundString}`;
    } else {
      return '';
    }
  }

  /**
  * Converts a single, standard exercise into a multi-round EMOM.
  * This creates a "superset" of size 1 and flattens multiple sets into one.
  * @param exerciseControl The form group for the exercise to convert.
  */
  async convertToSingleExerciseEmom(exerciseControl: AbstractControl, event?: Event): Promise<void> {
    if (this.isViewMode || !(exerciseControl instanceof FormGroup)) return;

    event?.stopPropagation();

    const exIndex = this.getExerciseIndexByControl(exerciseControl);
    this.expandExerciseCardIfNeeded(exIndex);

    const emomInputs: AlertInput[] = [
      { name: 'emomTime', type: 'number', label: 'Time per Round (s)', value: '60', attributes: { min: '10', required: true } },
      // CORRECTED: Ask for number of sets, not rounds
      { name: 'numSets', type: 'number', label: 'Number of Rounds (Sets)', value: '10', attributes: { min: '1', required: true } }
    ];
    const emomResult = await this.alertService.showPromptDialog('Create Single-Exercise EMOM', 'Configure EMOM parameters.', emomInputs);

    if (!emomResult || !emomResult['emomTime'] || !emomResult['numSets']) {
      // this.toastService.info("EMOM creation cancelled.", 2000);
      return;
    }

    const emomTimeSeconds = Number(emomResult['emomTime']);
    const numberOfSets = Number(emomResult['numSets']); // CORRECTED

    const setsArray = exerciseControl.get('sets') as FormArray;
    const templateSetData = setsArray.length > 0 ? { ...setsArray.at(0).value } : { id: uuidv4(), type: 'standard', targetReps: 8, restAfterSet: 60 };
    delete templateSetData.id;

    setsArray.clear();
    for (let i = 0; i < numberOfSets; i++) { // CORRECTED
      setsArray.push(this.createSetFormGroup(templateSetData, false));
    }

    exerciseControl.patchValue({
      supersetId: uuidv4(),
      supersetOrder: 0,
      supersetType: 'emom',
      emomTimeSeconds: emomTimeSeconds,
      type: 'superset'
    });

    // udpate exercise control
    // this.builderForm.controls['exercises'].get(exerciseControl.get('id')?.value)?.setValue(exerciseControl.value);

    // this.toastService.success(`EMOM created for ${numberOfSets} rounds!`, 4000, "Success");
  }

  protected isEmomExerciseByIndex(exIndex: number): boolean {
    const exercise = this.exercisesFormArray.at(exIndex) as FormGroup;
    return this.isEmom(exercise);
  }

  protected isEmomExercise(exerciseControl: AbstractControl): boolean {
    const exIndex = this.getExerciseIndexByControl(exerciseControl);
    const exercise = this.exercisesFormArray.at(exIndex) as FormGroup;
    const isEmom = this.isEmom(exercise);

    return exerciseControl.get('supersetType')?.value === 'emom' || isEmom;
  }

  protected isStandardSupersetExercise(exerciseControl: AbstractControl): boolean {
    return exerciseControl.get('supersetType')?.value === 'standard';
  }

  /**
 * Adds a new round to all exercises within a superset group.
 * A "round" is equivalent to adding a new set to each exercise.
 * @param exerciseControl The form control of the exercise that triggered the action.
 * @param event The mouse event to stop propagation.
 */
  public addRoundToSuperset(exerciseControl: AbstractControl, event: Event): void {
    event.stopPropagation();
    if (this.isViewMode) return;

    const supersetId = exerciseControl.get('supersetId')?.value;
    if (!supersetId) return;

    // Find all exercises in the same superset group
    this.exercisesFormArray.controls.forEach(ctrl => {
      const fg = ctrl as FormGroup;
      if (fg.get('supersetId')?.value === supersetId) {
        const setsArray = this.getSetsFormArray(fg);
        // Use our existing helper to create a new set, intelligently copying the last one
        const newSet = this.createSyncedSet(setsArray, ctrl);
        setsArray.push(newSet);
      }
    });

    this.toastService.success("Round added to superset.", 2000);
  }

  /**
   * Removes the last round from all exercises within a superset group.
   * This is equivalent to removing the last set from each exercise.
   * @param exerciseControl The form control of the exercise that triggered the action.
   * @param event The mouse event to stop propagation.
   */
  public removeRoundFromSuperset(exerciseControl: AbstractControl, event: Event): void {
    event.stopPropagation();
    if (this.isViewMode) return;

    const supersetId = exerciseControl.get('supersetId')?.value;
    if (!supersetId) return;

    // Find all exercises in the same superset group
    this.exercisesFormArray.controls.forEach(ctrl => {
      const fg = ctrl as FormGroup;
      if (fg.get('supersetId')?.value === supersetId) {
        const setsArray = this.getSetsFormArray(fg);
        // Only remove if there is more than one set
        if (setsArray.length > 1) {
          setsArray.removeAt(setsArray.length - 1);
        }
      }
    });

    this.toastService.info("Round removed from superset.", 2000);
  }


  protected isEmom(exerciseControl: AbstractControl): boolean {
    return exerciseControl.get('supersetType')?.value === 'emom';
  }

  protected checkIfWeightIsVisible(control: any): boolean {
    if (!control) return false;
    // Handle both AbstractControl and plain object
    if (typeof control.get === 'function') {
      if (typeof control.getRawValue === 'function' && control.getRawValue() && control.getRawValue()['sets']) {
        return ((control.getRawValue()['sets'].some((innerControl: any) => innerControl['targetWeight']) ?? 0) > 0) || ((control.getRawValue()['sets'].some((innerControl: any) => innerControl['targetWeightMin']) ?? 0) > 0);
      } else {
        return ((control.get('targetWeight')?.value ?? 0) > 0) || ((control.get('targetWeightMin')?.value ?? 0) > 0);
      }
    }
    return (control.targetWeight ?? 0) > 0 || (control.targetWeightMin ?? 0) > 0;
  }
  protected checkIfRepsIsVisible(control: any): boolean {
    if (!control) return false;
    // Handle both AbstractControl and plain object
    if (typeof control.get === 'function') {
      if (typeof control.getRawValue === 'function' && control.getRawValue() && control.getRawValue()['sets']) {
        return ((control.getRawValue()['sets'].some((innerControl: any) => innerControl['targetReps']) ?? 0) > 0) || ((control.getRawValue()['sets'].some((innerControl: any) => innerControl['targetRepsMin']) ?? 0) > 0);
      } else {
        return ((control.get('targetReps')?.value ?? 0) > 0) || ((control.get('targetRepsMin')?.value ?? 0) > 0);
      }
    }
    return (control.targetReps ?? 0) > 0 || (control.targetRepsMin ?? 0) > 0;
  }
  protected checkIfDistanceIsVisible(control: any): boolean {
    if (!control) return false;
    // Handle both AbstractControl and plain object
    if (typeof control.get === 'function') {
      if (typeof control.getRawValue === 'function' && control.getRawValue() && control.getRawValue()['sets']) {
        return ((control.getRawValue()['sets'].some((innerControl: any) => innerControl['targetDistance']) ?? 0) > 0) || ((control.getRawValue()['sets'].some((innerControl: any) => innerControl['targetDistanceMin']) ?? 0) > 0);
      } else {
        return ((control.get('targetDistance')?.value ?? 0) > 0) || ((control.get('targetDistanceMin')?.value ?? 0) > 0);
      }
    }
    return (control.targetDistance ?? 0) > 0 || (control.targetDistanceMin ?? 0) > 0;
  }
  protected checkIfDurationIsVisible(control: any): boolean {
    if (!control) return false;
    // Handle both AbstractControl and plain object
    if (typeof control.get === 'function') {
      if (typeof control.getRawValue === 'function' && control.getRawValue() && control.getRawValue()['sets']) {
        return ((control.getRawValue()['sets'].some((innerControl: any) => innerControl['targetDuration']) ?? 0) > 0) || ((control.getRawValue()['sets'].some((innerControl: any) => innerControl['targetDurationMin']) ?? 0) > 0);
      } else {
        return ((control.get('targetDuration')?.value ?? 0) > 0) || ((control.get('targetDurationMin')?.value ?? 0) > 0);
      }
    }
    return (control.targetDuration ?? 0) > 0 || (control.targetDurationMin ?? 0) > 0;
  }
  protected checkIfNotesIsVisible(control: any): boolean {
    if (!control) return false;
    // Handle both AbstractControl and plain object
    if (typeof control.get === 'function') {
      if (typeof control.getRawValue === 'function' && control.getRawValue() && control.getRawValue()['sets']) {
        return control.getRawValue()['sets'].some((innerControl: any) => !!innerControl['notes']);
      } else {
        return !!(control.get('notes')?.value);
      }
    }

    return !!(control.notes);
  }

  protected getGridColsForExercise(exerciseControl: AbstractControl): string {
    const isEmom = this.isEmom(exerciseControl);
    let columnCount = 2; // Always start with columns for 'Set #' and 'Rest'

    const setsControls = exerciseControl.get('sets') as FormArray;
    if (setsControls && setsControls.length > 0) {
      if (this.checkIfWeightIsVisible(exerciseControl)) { columnCount++; }
      if (this.checkIfRepsIsVisible(exerciseControl)) { columnCount++; }
      if (this.checkIfDistanceIsVisible(exerciseControl)) { columnCount++; }
      if (this.checkIfNotesIsVisible(exerciseControl)) { columnCount++; }
      // Duration/Time column is not shown for EMOMs in the view-only grid
      if (!isEmom && this.checkIfDurationIsVisible(exerciseControl)) { columnCount++; }
    }

    let gridColsClass: string;

    // By using full class names in the switch, we ensure Tailwind's JIT compiler finds and generates them.
    switch (columnCount) {
      case 1: gridColsClass = 'grid-cols-1'; break;
      case 2: gridColsClass = 'grid-cols-2'; break;
      case 3: gridColsClass = 'grid-cols-3'; break;
      case 4: gridColsClass = 'grid-cols-4'; break;
      case 5: gridColsClass = 'grid-cols-5'; break;
      case 6: gridColsClass = 'grid-cols-6'; break;
      case 7: gridColsClass = 'grid-cols-7'; break; // Max possible columns (Set, Reps, Wt, Dist, Time, Rest, Notes)
      default: gridColsClass = 'grid-cols-2'; // A sensible fallback
    }

    const baseClasses = 'grid';

    return `${baseClasses} ${gridColsClass}`;
  }

  // --- 1. Add a new signal to manage the action menu's visibility ---
  activeExerciseActionMenu = signal<number | null>(null);

  // --- 2. Add methods to control the new action menu ---
  isExerciseActionMenuVisible(exIndex: number): boolean {
    return this.activeExerciseActionMenu() === exIndex;
  }

  toggleExerciseActionMenu(index: number, event: Event): void {
    event.stopPropagation();
    this.activeExerciseActionMenu.update(current => (current === index ? null : index));
  }

  closeExerciseActionMenu(): void {
    this.activeExerciseActionMenu.set(null);
  }

  fabMenuItems: FabAction[] = [];

  private refreshFabMenuItems(): void {
    const isSave = this.mode === 'routineBuilder' ? (!this.currentRoutineId ? false : true) : (this.isNewMode ? true : false);
    if (this.isEditableMode()) {
      this.fabMenuItems = [{
        label: 'fab.add_exercise',
        actionKey: 'add_exercise',
        iconName: 'plus-circle',
        cssClass: 'bg-green-500 focus:ring-green-400',
        isPremium: false
      },
      {
        label: this.mode === 'routineBuilder' ? 'fab.save_routine' : (this.isNewMode ? 'fab.save_log' : 'fab.save_log_changes'),
        actionKey: 'save_routine',
        iconName: 'save',
        cssClass: 'bg-primary focus:ring-primary-light',
        isPremium: false
      },
      {
        label: 'fab.start',
        actionKey: 'start',
        iconName: 'play',
        cssClass: 'bg-blue-400 focus:ring-blue-600',
        isPremium: false
      }
      ];

      if (this.canRestore()) {
        this.fabMenuItems.unshift({
          label: 'fab.restore',
          actionKey: 'restore',
          iconName: 'restore',
          cssClass: 'bg-red-500 focus:ring-red-400',
        });
      }
      if (this.canRedo()) {
        this.fabMenuItems.unshift({
          label: 'fab.redo',
          actionKey: 'redo',
          iconName: 'redo',
          cssClass: 'bg-blue-500 focus:ring-blue-400',
        });
      }
      if (this.canUndo()) {
        this.fabMenuItems.unshift({
          label: 'fab.undo',
          actionKey: 'undo',
          iconName: 'undo',
          cssClass: 'bg-yellow-500 focus:ring-yellow-400',
        });
      }

      // if (this.isGeneratedRoutine()) {
      //   // If the current routine was generated, show a "Regenerate" button
      //   this.fabMenuItems.unshift({
      //     label: 'fab.regenerate',
      //     actionKey: 'regenerate_workout',
      //     iconName: 'random',
      //     cssClass: 'bg-purple-500 focus:ring-purple-400',
      //   });
      // } else 
      // if (this.isNewMode) {
      // Otherwise, if creating a new routine, show the "Generate" button

      if (this.subscriptionService.canAccess(PremiumFeature.WORKOUT_GENERATOR)) {
        this.fabMenuItems.unshift({
          label: 'fab.generate',
          actionKey: 'generate_workout',
          iconName: 'magic-wand',
          cssClass: 'bg-purple-500 focus:ring-purple-400',
          isPremium: true
        });
      }
      // }
    } else {
      this.fabMenuItems = [
        {
          label: 'fab.start',
          actionKey: 'start',
          iconName: 'play',
          cssClass: 'bg-blue-400 focus:ring-blue-600',
          isPremium: false
        }
      ];
    }
  }

  onFabAction(actionKey: string): void {
    switch (actionKey) {
      case 'add_exercise':
        this.openExerciseSelectionModal();
        break;
      case 'save_routine':
        this.onSubmit();
        break;
      case 'start':
        this.startCurrentWorkout();
        break;
      case 'undo': this.undoLastChange(); break;
      case 'redo': this.redoLastChange(); break;
      case 'restore': this.restoreOriginal(); break;
      case 'generate_workout':
        this.openWorkoutGenerator();
        break;
      case 'regenerate_workout':
        this.regenerateWorkout();
        break;
    }
  }


  /**
     * NEW: Directly regenerates the workout using the last known options,
     * or triggers a new 'quick' generation if no options are stored.
     */
  async regenerateWorkout(): Promise<void> {
    const lastOptions = this.lastGenerationOptions();
    if (lastOptions) {
      // If we have stored options, use them for regeneration
      await this.handleWorkoutGeneration(lastOptions);
    } else {
      // If the last generation was 'quick' or there are no options, do another quick one
      await this.handleWorkoutGeneration('quick');
    }
  }






  isSwitchExerciseModalOpen = signal(false);
  exerciseToSwitchIndex = signal<number | null>(null);
  isShowingSimilarInSwitchModal = signal(false);
  // This signal will hold the list of exercises (either all or similar) for the modal
  exercisesForSwitchModal = signal<Exercise[]>([]);

  handleExerciseActionMenuItemClick(event: { actionKey: string }, exIndex: number, exerciseControl: AbstractControl): void {
    switch (event.actionKey) {
      case 'ungroup':
        this.ungroupSuperset(exIndex);
        break;
      case 'make_emom':
        this.convertToSingleExerciseEmom(exerciseControl);
        break;
      case 'switchExercise':
        this.openSwitchExerciseModal(exIndex);
        break;
      case 'fill_latest':
        this.fillWithLatestPerformanceData(exIndex);
        break;
      case 'toggle_notes':
        this.toggleExerciseNotes(exIndex);
        break;
      case 'remove':
        this.removeExercise(exIndex);
        break;
    }
    this.closeExerciseActionMenu();
  }

  // +++ NEW: Method to generate items for the expanded exercise action menu +++
  getExerciseActionMenuItems(exerciseControl: AbstractControl): ActionMenuItem[] {
    const items: ActionMenuItem[] = [];
    const isSuperset = !!exerciseControl.get('supersetId')?.value;

    const exIndex = this.getExerciseIndexByControl(exerciseControl);
    const isFirstInSuperset = this.isFirstInSuperset(exIndex);

    if (isSuperset) {
      if (isFirstInSuperset) {
        // items.push({
        //   label: this.translate.instant('workoutBuilder.exercise.remove'),
        //   buttonClass: 'bg-red-500 text-white hover:bg-red-700',
        //   actionKey: 'remove',
        //   iconName: 'trash',
        // });
        items.push({
        label: 'Ungroup',
        buttonClass: 'bg-purple-500 text-white hover:bg-purple-700',
        actionKey: 'ungroup',
        iconName: 'ungroup',
      });
      }
    } else {
      items.push({
        label: this.translate.instant('workoutBuilder.exercise.remove'),
        buttonClass: 'bg-red-500 text-white hover:bg-red-700',
        actionKey: 'remove',
        iconName: 'trash',
      });
      items.push({
        label: this.translate.instant('workoutBuilder.exercise.fillWithLast'),
        buttonClass: 'bg-green-500 text-white hover:bg-green-700 text-left',
        actionKey: 'fill_latest',
        iconName: 'task',
      });
      items.push({
        label: this.translate.instant('workoutBuilder.exercise.toggleNotes'),
        buttonClass: 'bg-yellow-500 text-gray-500 hover:bg-yellow-700 rounded-full focus:outline-none flex items-center p-2 transition-colors',
        actionKey: 'toggle_notes',
        iconName: 'clipboard-list',
      });
      items.push({
        label: 'Make EMOM',
        buttonClass: 'bg-teal-500 text-white hover:bg-teal-700',
        actionKey: 'make_emom',
        iconName: 'clock',
      });
      // Add the "Switch Exercise" option only for non-superset exercises
      items.push({
        label: 'Switch Exercise',
        buttonClass: 'bg-blue-500 text-white hover:bg-blue-700',
        actionKey: 'switchExercise',
        iconName: 'change', // Assuming you have a 'change' icon
      });
    }

    return items;
  }

  // +++ NEW: Methods to control the Switch Exercise Modal +++

  /**
   * Opens the exercise selection modal in "switch" mode.
   * @param exIndex The index of the exercise in the form array to be switched.
   */
  openSwitchExerciseModal(exIndex: number, event?: Event): void {
    event?.stopPropagation();
    this.exerciseToSwitchIndex.set(exIndex);
    // Initially populate the modal with all available exercises for searching
    this.exercisesForSwitchModal.set(this.availableExercises);

    // Reset modal state
    this.isShowingSimilarInSwitchModal.set(false);
    this.modalSearchTerm.set('');

    // Open the modal
    this.isSwitchExerciseModalOpen.set(true);
  }

  /**
   * Closes the switch exercise modal and resets its state.
   */
  closeSwitchExerciseModal(): void {
    this.isSwitchExerciseModalOpen.set(false);
    this.exerciseToSwitchIndex.set(null);
  }

  /**
   * Fetches exercises similar to the one being switched and updates the modal's list.
   */
  async findAndShowSimilarExercises(): Promise<void> {
    const index = this.exerciseToSwitchIndex();
    if (index === null) return;

    const exerciseControl = this.exercisesFormArray.at(index);
    const exerciseId = exerciseControl.get('exerciseId')?.value;
    const baseExercise = this.availableExercises.find(ex => ex.id === exerciseId);

    if (!baseExercise) {
      this.toastService.error("Could not find the base exercise to search for similar ones.");
      return;
    }

    try {
      const similarExercises = await firstValueFrom(this.exerciseService.getSimilarExercises(baseExercise, 12));
      if (similarExercises.length === 0) {
        this.toastService.info("No similar exercises found.");
      }
      // Overwrite the modal's list with the new, shorter list of similar exercises
      this.exercisesForSwitchModal.set(similarExercises);
      this.isShowingSimilarInSwitchModal.set(true);
    } catch (error) {
      this.toastService.error("Failed to load similar exercises.");
    }
  }

  /**
   * Resets the modal from the "similar" view back to the main search view.
   */
  onBackToSearchFromSimilar(): void {
    this.exercisesForSwitchModal.set(this.availableExercises);
    this.isShowingSimilarInSwitchModal.set(false);
    this.modalSearchTerm.set('');
  }

  /**
   * Handles the final selection from the modal, replacing the exercise in the form.
   * @param newExercise The new exercise selected by the user.
   */
  handleExerciseSwitch(newExercise: Exercise): void {
    const index = this.exerciseToSwitchIndex();
    if (index === null) return;

    const exerciseControl = this.exercisesFormArray.at(index) as FormGroup;
    const oldExerciseName = exerciseControl.get('exerciseName')?.value;

    // Patch the form group with the new exercise's ID and name
    exerciseControl.patchValue({
      exerciseId: newExercise.id,
      exerciseName: newExercise.name
    });

    this.toastService.success(`Switched '${oldExerciseName}' to '${newExercise.name}'.`);
    this.closeSwitchExerciseModal();
  }

  /**
     * Expands all exercise cards when in view mode.
     * It sets the global flag and clears any single-set expansion path.
     */
  expandAllSets(): void {
    if (!this.isViewMode) return;
    this.expandedSetPath.set(null); // Clear any single expanded set
    this.isAllExpandedInViewMode.set(true); // Set the global flag
  }

  /**
   * Collapses all exercise cards when in view mode.
   * It resets all expansion state flags.
   */
  collapseAllSets(): void {
    if (!this.isViewMode) return;
    this.expandedSetPath.set(null);
    this.isAllExpandedInViewMode.set(false);
  }

  /**
   * Removes the last set from a standard (non-superset) exercise.
   * @param exerciseControl The form control of the exercise that triggered the action.
   * @param event The mouse event to stop propagation.
   */
  public removeLastSet(exerciseControl: AbstractControl, event: Event): void {
    event.stopPropagation();
    if (this.isViewMode) return;

    const setsArray = this.getSetsFormArray(exerciseControl);
    // Only remove if there is more than one set
    if (setsArray.length > 1) {
      setsArray.removeAt(setsArray.length - 1);
      this.toastService.info("Set removed.", 2000);
    }

    // Collapse UI if the currently expanded set was the one removed.
    const lastIndex = setsArray.length; // The index of the set that was just removed
    const currentExpanded = this.expandedSetPath();
    if (currentExpanded && currentExpanded.exerciseIndex === this.getExerciseIndexByControl(exerciseControl) && currentExpanded.setIndex === lastIndex) {
      this.expandedSetPath.set(null);
    }
  }

  /**
  * Retrieves the last logged performance for an exercise and fills the
  * current sets in the form with that data.
  * @param exIndex The index of the exercise in the exercisesFormArray.
  */
  async fillWithLatestPerformanceData(exIndex: number, event?: Event): Promise<void> {
    if (this.isViewMode) {
      this.toastService.info("Cannot modify data in view mode.", 3000);
      return;
    }
    event?.stopPropagation();

    this.expandExerciseCardIfNeeded(exIndex);

    const exerciseControl = this.exercisesFormArray.at(exIndex) as FormGroup;
    if (!exerciseControl) {
      console.error(`Exercise control at index ${exIndex} not found.`);
      return;
    }

    const exerciseId = exerciseControl.get('exerciseId')?.value;
    if (!exerciseId) {
      this.toastService.warning("Please select an exercise first.", 3000);
      return;
    }

    this.spinnerService.show("Loading last performance...");

    try {
      // Fetch the last performance log for this specific exercise
      const lastPerformance = await firstValueFrom(
        this.trackingService.getLastPerformanceForExercise(exerciseId)
      );

      if (!lastPerformance || lastPerformance.sets.length === 0) {
        this.toastService.info("No recent performance data found for this exercise.", 3000);
        return;
      }

      const setsFormArray = this.getSetsFormArray(exerciseControl);

      // Iterate over the sets currently in the form
      setsFormArray.controls.forEach((setControl, setIndex) => {
        // Find the corresponding set from the historical log
        const historicalSet = lastPerformance.sets[setIndex];
        if (historicalSet) {
          const patchData: { [key: string]: any } = {};

          // Convert the historical weight (stored in kg) to the user's current unit
          const weightInCurrentUnit = historicalSet.weightUsed != null
            ? this.unitService.convertWeight(historicalSet.weightUsed, this.unitService.currentWeightUnit(), 'kg')
            : null;

          // Apply data to the correct fields based on the builder's mode
          if (this.mode === 'manualLogEntry') {
            patchData['repsAchieved'] = historicalSet.repsAchieved;
            patchData['weightUsed'] = weightInCurrentUnit;
            patchData['durationPerformed'] = historicalSet.durationPerformed;
          } else { // 'routineBuilder' mode
            patchData['targetReps'] = historicalSet.repsAchieved;
            patchData['targetWeight'] = weightInCurrentUnit;
            patchData['targetDuration'] = historicalSet.durationPerformed;
          }

          // Patch the form group for the individual set
          setControl.patchValue(patchData);
        }
      });

      this.builderForm.markAsDirty();
      this.toastService.success("Sets pre-filled with your last performance data.", 3000, "Success");

    } catch (error) {
      console.error("Failed to load performance data:", error);
      this.toastService.error("Could not load performance data.", 0, "Error");
    } finally {
      this.spinnerService.hide();
    }
  }

  getSetDistanceDisplay(exerciseControl: AbstractControl): string {
    if (!exerciseControl || !exerciseControl.value || !exerciseControl.value.sets || exerciseControl.value.sets.length === 0) {
      return '';
    }

    if (this.mode === 'manualLogEntry') {
      const rawValue = exerciseControl.getRawValue() as LoggedWorkoutExercise;
      const distances = rawValue.sets.map(set => set.distanceAchieved).filter(d => d != null && d > 0);
      return distances.length > 0 ? distances.join('-') : '';
    } else {
      const setsFormArray = this.getSetsFormArray(exerciseControl);
      const displayValues = setsFormArray.controls.map(setControl => this.getSetDisplayValue(setControl, 'distance'));
      const validDisplayValues = displayValues.filter(value => value && value !== '-');
      return validDisplayValues.join(', ');
    }
  }


  /**
  * Toggles the input mode for a set's distance between a single value and a range.
  * Applies a +/- 1km offset when creating a range.
  * @param setControl The form group for the specific set.
  */
  toggleDistanceMode(setControl: AbstractControl, event?: Event): void {
    event?.stopPropagation();
    if (this.isViewMode || !(setControl instanceof FormGroup)) return;

    const distanceCtrl = setControl.get('targetDistance');
    const distanceMinCtrl = setControl.get('targetDistanceMin');
    const distanceMaxCtrl = setControl.get('targetDistanceMax');

    const isCurrentlyRange = distanceMinCtrl?.value != null || distanceMaxCtrl?.value != null;

    if (isCurrentlyRange) {
      // Switch FROM Range TO Single
      const minVal = distanceMinCtrl?.value ?? 0;
      const maxVal = distanceMaxCtrl?.value ?? 0;
      // For distance, we might want decimals, so let's round to 2 decimal places.
      const averageValue = Math.round(((minVal + maxVal) / 2) * 100) / 100;

      distanceCtrl?.setValue(averageValue);
      distanceMinCtrl?.setValue(null);
      distanceMaxCtrl?.setValue(null);
    } else {
      // Switch FROM Single TO Range
      const singleValue = distanceCtrl?.value ?? 1; // Default to 1

      // Convert 1km offset to the user's current distance unit
      const offsetInCurrentUnit = this.unitService.convertDistance(1, this.unitService.currentDistanceMeasureUnit(), 'km');

      const newMin = Math.max(0, singleValue - offsetInCurrentUnit);
      const newMax = singleValue + offsetInCurrentUnit;

      distanceMinCtrl?.setValue(Math.round(newMin * 100) / 100);
      distanceMaxCtrl?.setValue(Math.round(newMax * 100) / 100);
      distanceCtrl?.setValue(null);
    }
  }


  private cardColors = [
    '#7f1d1d', '#86198f', '#4a044e', '#1e1b4b', '#1e3a8a', '#064e3b', '#14532d',
    '#b91c1c', '#c026d3', '#701a75', '#312e81', '#2563eb', '#047857', '#15803d',
    '#f97316', '#ca8a04', '#4d7c0f', '#0f766e', '#0369a1', '#1d4ed8', '#5b21b6'
  ];

  async openColorPicker(): Promise<void> {
    // Note: Adjust how you get the 'routine' object based on the component
    const routine = this.liveFormAsRoutine();
    if (!routine) return;

    // This part remains the same
    const colorButtons: AlertButton[] = this.cardColors.map(color => ({
      text: '',
      role: 'confirm',
      data: color,
      cssClass: 'color-swatch',
      styles: {
        'background-color': color,
        'width': '40px',
        'height': '40px',
        'border-radius': '50%',
        'border': '2px solid white',
        'box-shadow': '0 2px 4px rgba(0,0,0,0.2)'
      }
    }));

    colorButtons.push({
      text: 'Clear Color',
      role: 'confirm',
      data: 'clear',
      cssClass: 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 mt-4 col-span-5',
      icon: 'trash'
    });

    const result = await this.alertService.showConfirmationDialog(
      `Select a Color for "${routine.name}"`,
      '',
      colorButtons,
      { customButtonDivCssClass: 'grid grid-cols-5 gap-3 justify-center' }
    );

    if (result && result.data) {
      if (result.data === 'clear') {
        delete routine.cardColor;
      } else {
        routine.cardColor = result.data as string;
      }

      const savedRoutine = await this.workoutService.updateRoutine(routine);

      this.toastService.success(`Color updated for "${routine.name}"`);
    }
  }

  protected getCardValueTextColor(): string {
    return 'text-gray-700 dark:text-gray-200';
  }

  protected getCardTitleTextColor(): string {
    if (!this.liveFormAsRoutine() || this.liveFormAsRoutine() === undefined) {
      return '';
    }
    const routine = this.liveFormAsRoutine();
    if (routine === undefined) {
      return '';
    }
    if (!routine.cardColor) {
      return 'text-gray-600 dark:text-gray-200';
    }
    if (!!routine.cardColor) {
      return 'text-white';
    }
    return '';
  }

  // --- START: ADD NEW PROPERTY FOR CATEGORY OPTIONS ---
  primaryCategories: { value: Routine['primaryCategory'], label: string }[] = [
    { value: 'Strength Training', label: 'Strength Training' },
    { value: 'Cardio & Endurance', label: 'Cardio & Endurance' },
    { value: 'Flexibility & Mobility', label: 'Flexibility & Mobility' },
    { value: 'Mind-Body & Recovery', label: 'Mind-Body & Recovery' },
    { value: 'Sport-Specific Training', label: 'Sport-Specific Training' },
    { value: 'Quick Workouts', label: 'Quick Workouts' },
    { value: 'Specialty/Unique Classes', label: 'Specialty/Unique Classes' },
    { value: 'Targeted Workouts (by Body Part/Focus)', label: 'Targeted Workouts' },
    { value: 'Guided Programs/Challenges', label: 'Guided Programs/Challenges' },
    { value: 'Equipment-Specific (Beyond weights)', label: 'Equipment-Specific' },
    { value: 'custom', label: 'Custom' }
  ];
  // --- END: ADD NEW PROPERTY ---

  private previousGoalValue: Routine['goal'] | null = null;


  /**
   * Checks if all sets for an exercise are uniform (same reps and weight).
   * If they are, it returns the uniform values. Otherwise, it returns null.
   * @param exerciseControl The FormGroup for the exercise.
   * @returns An object with uniform reps and weight, or null.
   */
  public getUniformSetValues(exerciseControl: AbstractControl): { reps: string, weight: string | null } | null {
    const setsFormArray = this.getSetsFormArray(exerciseControl);
    if (!setsFormArray || setsFormArray.length === 0) {
      return null;
    }

    const isWeighted = this.checkIfWeightedExercise(exerciseControl);
    const firstSet = setsFormArray.at(0) as FormGroup;

    // Get the reference values from the first set
    const referenceReps = this.getSetDisplayValue(firstSet, 'reps');
    const referenceWeight = isWeighted ? this.getSetDisplayValue(firstSet, 'weight') : null;

    // Check if all subsequent sets match the first one
    const allUniform = setsFormArray.controls.every(setControl => {
      const currentReps = this.getSetDisplayValue(setControl, 'reps');
      if (currentReps !== referenceReps) return false;

      if (isWeighted) {
        const currentWeight = this.getSetDisplayValue(setControl, 'weight');
        if (currentWeight !== referenceWeight) return false;
      }
      return true;
    });

    // Return the uniform values only if they are consistent and not empty
    if (allUniform && referenceReps && referenceReps !== '-') {
      return { reps: referenceReps, weight: referenceWeight };
    }

    return null;
  }

  public async promptRemoveField(exIndex: number, setIndex: number): Promise<void> {
    const currentRoutine = this.liveFormAsRoutine();
    if (!currentRoutine) return;

    const updatedRoutine = await this.workoutService.promptRemoveField(currentRoutine, exIndex, setIndex);

    if (updatedRoutine) {
      // Get the updated set data (with the field removed) from the routine returned by the service
      const updatedSetData = updatedRoutine.exercises[exIndex].sets[setIndex];

      // Get the FormArray for the sets of the specific exercise
      const setsFormArray = this.getSetsFormArray(this.exercisesFormArray.at(exIndex));

      // Create a brand new FormGroup based on this updated data structure
      const newSetFormGroup = this.createSetFormGroup(updatedSetData, this.mode === 'manualLogEntry');

      // Replace the old FormGroup at the specified index with the new one
      setsFormArray.setControl(setIndex, newSetFormGroup);
    }
  }

  getFieldsForSet(exIndex: number, setIndex: number): { visible: string[], hidden: string[] } {
    const routine = this.liveFormAsRoutine();
    if (!routine) return { visible: [], hidden: ['weight', 'reps', 'distance', 'duration', 'tempo'] };
    return this.workoutService.getFieldsForSet(routine, exIndex, setIndex);
  }

  public async promptAddField(exIndex: number, setIndex: number): Promise<void> {
    const currentRoutine = this.liveFormAsRoutine();
    if (!currentRoutine) return;

    const updatedRoutine = await this.workoutService.promptAddField(currentRoutine, exIndex, setIndex);

    if (updatedRoutine) {
      // Get the updated set data from the routine returned by the service
      const updatedSetData = updatedRoutine.exercises[exIndex].sets[setIndex];

      // Get the FormArray for the sets of the specific exercise
      const setsFormArray = this.getSetsFormArray(this.exercisesFormArray.at(exIndex));

      // Create a brand new FormGroup for the set
      const newSetFormGroup = this.createSetFormGroup(updatedSetData, this.mode === 'manualLogEntry');

      // Replace the old FormGroup with the new one
      setsFormArray.setControl(setIndex, newSetFormGroup);
    }
  }


  /**
   * Checks all sets within an exercise to determine which data columns should be visible in the UI.
   * A column is considered visible if at least one set has a target value for that metric.
   * @param exerciseControl The FormGroup for the exercise.
   * @returns An object with boolean flags for each potential column (reps, weight, etc.).
   */
  public getVisibleColumnsForExercise(exIndex: number): { [key: string]: boolean } {
    const routine = this.liveFormAsRoutine();
    if (!routine) return {};
    return this.workoutService.getVisibleExerciseColumns(routine, exIndex);
  }

  /**
   * Generates the dynamic Tailwind CSS grid-template-columns class based on the
   * number of visible columns for a given exercise.
   * @param exerciseControl The FormGroup for the exercise.
   * @returns A string like 'grid-cols-4' or 'grid-cols-5'.
   */
  public getGridClassForExercise(exIndex: number): string {
    const visibleCols = this.getVisibleColumnsForExercise(exIndex);

    // Start with a base count for the static columns: Set # and Actions
    let columnCount = 2;

    if (visibleCols['reps']) columnCount++;
    if (visibleCols['weight']) columnCount++;
    if (visibleCols['distance']) columnCount++;
    if (visibleCols['duration']) columnCount++;
    // The "Rest/Notes" column is always present, so we don't need to check for it.
    columnCount++; // Add one for the Rest/Notes column

    // Use a failsafe in case something goes wrong
    const finalCount = Math.max(2, columnCount);

    return `grid-cols-${finalCount}`;
  }

  /**
  * Toggles the visibility of the exercise notes textarea for a given exercise.
  * @param exIndex The index of the exercise.
  * @param event The mouse event, used to stop propagation.
  */
  toggleExerciseNotes(exIndex: number, event?: Event): void {
    event?.stopPropagation(); // Prevents the main card from collapsing
    this.expandedExerciseNotes.update(current => (current === exIndex ? null : exIndex));
    this.expandExerciseCardIfNeeded(exIndex);

    // focus on text area
    setTimeout(() => {
      const textArea = document.getElementById(`exerciseNotes-${exIndex}`);
      textArea?.focus();
    }, 300);
  }

  private expandExerciseCardIfNeeded(exIndex: number): void {
    if (!this.expandedExercisePath() || this.expandedExercisePath()?.exerciseIndex !== exIndex) {
      this.expandExerciseCard(exIndex);
    }
  }

  /**
  * Generates the complete, dynamic CSS class string for the collapsed set row.
  * This includes both the grid layout and the background color.
  * @param exerciseControl The FormGroup for the exercise.
  * @param setControl The FormGroup for the specific set.
  * @returns A string of Tailwind CSS classes like 'grid grid-cols-5 bg-gray-50 dark:bg-gray-700/50'.
  */
  public getCollapsedSetRowClass(exIndex: number, setIndex: number): string {
    const visibleCols = this.getVisibleColumnsForExercise(exIndex);

    // --- 1. Calculate Grid Class ---
    let columnCount = 2; // Base for Set # and Actions
    if (visibleCols['reps']) columnCount++;
    if (visibleCols['weight']) columnCount++;
    if (visibleCols['distance']) columnCount++;
    if (visibleCols['duration']) columnCount++;
    columnCount++; // For Rest/Notes
    const gridClass = `grid-cols-${Math.max(2, columnCount)}`;

    // --- 2. Determine Background Color Class ---
    const exerciseControl = this.exercisesFormArray.at(exIndex);
    const setsFormArray = this.getSetsFormArray(exerciseControl);
    const setControl = setsFormArray.at(setIndex);
    if (!(setControl instanceof FormGroup)) {
      return `grid ${gridClass} bg-white dark:bg-gray-800`; // Fallback if not a FormGroup
    }
    const setType = setControl.get('type')?.value;
    let bgClass = 'bg-white dark:bg-gray-800'; // Default background

    if (setType === 'standard') {
      bgClass = 'bg-gray-50 dark:bg-gray-700/50';
    } else if (setType === 'warmup') {
      // Note: your original code had 'dark:bg-gray-blue/50'. Assuming you meant 'blue'.
      bgClass = 'bg-blue-50 dark:bg-blue-900/40';
    }
    // ... you can add other else-if for other set types like 'dropset' etc.

    // --- 3. Combine and return the full string ---
    return `grid ${gridClass} ${bgClass}`;
  }


  // +++ NEW: Undo Method +++
  /**
   * Reverts the form to its last known state.
   */
  public undoLastChange(): void {
    if (!this.canUndo()) return;

    this.isUndoingOrRedoing = true; // Set flag to prevent subscription from firing
    this.historyIndex--;
    const stateToRestore = this.history[this.historyIndex];
    this.restoreFormState(stateToRestore);
    this.toastService.info("Undo successful.");
    this.updateHistorySignals();
    this.refreshFabMenuItems(); // Update FAB menu items
  }

  // +++ NEW: Redo Method +++
  public redoLastChange(): void {
    if (!this.canRedo()) return;

    this.isUndoingOrRedoing = true; // Set flag
    this.historyIndex++;
    const stateToRestore = this.history[this.historyIndex];
    this.restoreFormState(stateToRestore);
    this.toastService.info("Redo successful.");
    this.updateHistorySignals();
    this.refreshFabMenuItems(); // Update FAB menu items
  }

  // +++ NEW: Restore Method +++
  public async restoreOriginal(): Promise<void> {
    if (!this.canRestore() || !this.originalStateSnapshot) return;

    const confirm = await this.alertService.showConfirm(
      "Restore Original",
      "Are you sure you want to discard all changes and restore the routine to its original state?",
      "Restore"
    );

    if (confirm && confirm.data) {
      this.isUndoingOrRedoing = true; // Use the same flag to prevent history pollution
      this.restoreFormState(this.originalStateSnapshot);

      // After restoring, clear the undo/redo history as it's no longer valid
      this.history = [JSON.parse(JSON.stringify(this.originalStateSnapshot))];
      this.historyIndex = 0;

      this.toastService.success("Routine has been restored to its original state.");
      this.updateHistorySignals();
    }
    this.refreshFabMenuItems(); // Update FAB menu items
  }

  // +++ NEW: Centralized helper to apply a state to the form +++
  private restoreFormState(state: any): void {
    if (!state) return;

    // Rebuild the FormArrays correctly
    this.exercisesFormArray.clear({ emitEvent: false });
    const exercises = state.exercises || [];
    exercises.forEach((exerciseData: any) => {
      const exerciseGroup = this.createExerciseFormGroup(exerciseData, true, this.mode === 'manualLogEntry');
      this.exercisesFormArray.push(exerciseGroup, { emitEvent: false });
    });

    // Patch the rest of the form. This will trigger valueChanges, but our flag will catch it.
    this.builderForm.patchValue(state);
  }

  private history: any[] = [];
  private historyIndex = -1;
  private readonly MAX_HISTORY_SIZE = 20;
  private isUndoingOrRedoing = false; // Flag to prevent feedback loops

  // Signals to control the button states in the UI
  canUndo = signal<boolean>(false);
  canRedo = signal<boolean>(false);
  canRestore = signal<boolean>(false);

  // This will store the pristine, initial state of the routine when editing
  private originalStateSnapshot: any = null;

  // +++ NEW: Helper to update button states +++
  private updateHistorySignals(): void {
    this.canUndo.set(this.historyIndex > 0);
    this.canRedo.set(this.historyIndex < this.history.length - 1);
  }

  /**
     * Handles the output from the generation modal, generates the workout,
     * and patches the form with the result.
     */
  async handleWorkoutGeneration(options: WorkoutGenerationOptions | 'quick'): Promise<void> {
    this.isGeneratorModalOpen.set(false);
    this.spinnerService.show('Generating your workout...');

    let generatedRoutine: Routine | null = null;
    try {
      // --- THIS IS THE CORRECTED LINE ---
      // Removed the unnecessary `firstValueFrom()` wrapper.
      if (options === 'quick') {
        // For a quick workout, we don't have detailed options to save for a retry,
        // so we'll just re-run the quick generator if they retry.
        this.lastGenerationOptions.set(null); // Mark as quick
        generatedRoutine = await this.workoutGeneratorService.generateQuickWorkout();
      } else {
        generatedRoutine = await this.workoutGeneratorService.generateWorkout(options);

      }

      // --- END OF CORRECTION ---

      if (!generatedRoutine) {
        // Handle the case where the generator returns null (e.g., no exercises found)
        this.errorMessage.set("Could not generate a workout with the selected options. Please try different criteria.");
        this.isGeneratedRoutine.set(false);
        this.lastGenerationOptions.set(null);
        return; // Stop execution
      }

      if (options !== 'quick') {
        this.lastGenerationOptions.set(options);
      } else {
        this.lastGenerationOptions.set(null); // No options to save for quick generate
      }

      // Patch the main builder form with the new routine data
      this.patchFormWithRoutineData(generatedRoutine);
      this.builderForm.markAsDirty();

      // Set the flag to true so the UI can show the "Regenerate" button
      this.isGeneratedRoutine.set(true);
      this.toastService.success("Workout generated successfully!");

    } catch (error: any) {
      this.errorMessage.set(error.message || "An unknown error occurred during workout generation.");
    } finally {
      this.spinnerService.hide();
      this.refreshFabMenuItems(); // Refresh the FAB menu
    }
  }

  /**
   * Opens the workout generator modal.
   */
  private openWorkoutGenerator(): void {
    this.isGeneratorModalOpen.set(true);
  }
}