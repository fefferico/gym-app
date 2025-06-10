import { Component, inject, OnInit, OnDestroy, signal, computed, ElementRef, QueryList, ViewChildren, AfterViewInit, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';

import { CommonModule, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, ActivatedRouteSnapshot, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, AbstractControl, FormsModule } from '@angular/forms';
import { Subscription, of, firstValueFrom } from 'rxjs';
import { switchMap, tap, take } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';

import { Routine, ExerciseSetParams, WorkoutExercise } from '../../core/models/workout.model';
import { Exercise } from '../../core/models/exercise.model';
import { WorkoutService } from '../../core/services/workout.service';
import { ExerciseService } from '../../core/services/exercise.service';
import { UnitsService } from '../../core/services/units.service';
import { WeightUnitPipe } from '../../shared/pipes/weight-unit-pipe';
import { SpinnerService } from '../../core/services/spinner.service';
import { AlertComponent } from '../../shared/components/alert/alert.component';
import { AlertService } from '../../core/services/alert.service';
import { ToastService } from '../../core/services/toast.service';
import { TrackingService } from '../../core/services/tracking.service';


@Component({
  selector: 'app-workout-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule, DragDropModule
    , WeightUnitPipe
  ],
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

  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';
  private readonly PAUSED_STATE_VERSION = '1.1'; // Incremented version for new snapshot field


  @ViewChildren('setRepsInput') setRepsInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChildren('expandedSetElement') expandedSetElements!: QueryList<ElementRef<HTMLDivElement>>;

  private cdr = inject(ChangeDetectorRef);

  routineForm!: FormGroup;
  isEditMode = false;
  isNewMode = false;
  isViewMode = false;
  currentRoutineId: string | null = null;
  private routeSub: Subscription | undefined;

  // Signal to track the path to the currently expanded set for detailed editing
  // Path is { exerciseIndex, setIndex }
  expandedSetPath = signal<{ exerciseIndex: number, setIndex: number } | null>(null);


  routineGoals: { value: Routine['goal'], label: string }[] = [
    { value: 'hypertrophy', label: 'Hypertrophy' },
    { value: 'strength', label: 'Strength' },
    { value: 'muscular endurance', label: 'Muscular endurance' },
    { value: 'cardiovascular endurance', label: 'Cardiovascular endurance' },
    { value: 'fat loss / body composition', label: 'Fat loss / body composition' },
    { value: 'mobility & flexibility', label: 'Mobility & flexibility' },
    { value: 'power / explosiveness', label: 'Power / explosiveness' },
    { value: 'speed & agility', label: 'Speed & agility' },
    { value: 'balance & coordination', label: 'Balance & coordination' },
    { value: 'skill acquisition', label: 'Skill acquisition' },
    { value: 'rehabilitation / injury prevention', label: 'Rehabilitation / injury prevention' },
    { value: 'mental health / stress relief', label: 'Mental health' },
    { value: 'general health & longevity', label: 'General health & longevity' },
    { value: 'sport-specific performance', label: 'Sport-specific performance' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'rest', label: 'Rest' },
    { value: 'custom', label: 'Custom' }
  ];

  isExerciseModalOpen = signal(false);
  availableExercises: Exercise[] = [];
  modalSearchTerm = signal('');

  filteredAvailableExercises = computed(() => {
    const term = this.modalSearchTerm().toLowerCase();
    if (!term) {
      return this.availableExercises;
    }
    return this.availableExercises.filter(ex =>
      ex.name.toLowerCase().includes(term) ||
      ex.category.toLowerCase().includes(term) ||
      ex.primaryMuscleGroup.toLowerCase().includes(term)
    );
  });

  selectedExerciseIndicesForSuperset = signal<number[]>([]);

  constructor() {
    this.routineForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      goal: ['custom' as Routine['goal']],
      exercises: this.fb.array([]),
    });
  }

  private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) { // Check if running in a browser
      window.scrollTo(0, 0);
    }
    this.loadAvailableExercises();

    this.routeSub = this.route.paramMap.pipe(
      switchMap(params => {
        this.currentRoutineId = params.get('routineId');
        const currentPath = this.route.snapshot.url[0]?.path;
        this.isNewMode = currentPath === 'new';
        this.isViewMode = currentPath === 'view' && !!this.currentRoutineId;
        this.isEditMode = (currentPath === 'edit' && !!this.currentRoutineId) || this.isNewMode;

        this.expandedSetPath.set(null); // Reset expanded set on route change

        if (this.currentRoutineId && (this.isEditMode || this.isViewMode) && !this.isNewMode) {
          return this.workoutService.getRoutineById(this.currentRoutineId);
        }
        this.exercisesFormArray.clear();
        this.routineForm.reset({ goal: 'custom', exercises: [] });
        if (this.isNewMode) {
          this.toggleFormState(false);
        }
        return of(null);
      }),
      tap(routine => {
        if (routine) {
          this.patchFormWithRoutineData(routine);
          if (this.isViewMode) {
            this.toggleFormState(true);
          } else if (this.isEditMode && !this.isNewMode) {
            this.toggleFormState(false);
          }
        } else if ((this.isEditMode || this.isViewMode) && !this.isNewMode && this.currentRoutineId) {
          this.toastService.error(`Routine with ID ${this.currentRoutineId} not found.`, 0, "Error");
          this.router.navigate(['/workout']);
        }
      })
    ).subscribe();

    this.routineForm.get('goal')?.valueChanges.subscribe(goalValue => {
      const exercisesCtrl = this.exercisesFormArray;
      if (goalValue === 'rest') {
        // If goal is rest, clear exercises and remove 'required' validator from the array
        while (exercisesCtrl.length) {
          exercisesCtrl.removeAt(0);
        }
        exercisesCtrl.clearValidators(); // Remove validators like Validators.required
        // Optional: disable add exercise buttons, though *ngIf in template handles UI
      } else {
        // If goal is not rest, ensure 'required' validator is present (if it's always required for non-rest)
        // However, your current validation in onSubmit handles this better by checking array length.
        // So, just ensuring it's enabled or re-adding validator if it was removed.
        // For simplicity, let's assume the onSubmit validation is sufficient.
        // If you had dynamically added/removed Validators.required from exercisesFormArray:
        // exercisesCtrl.setValidators(Validators.required);
      }
      exercisesCtrl.updateValueAndValidity(); // Important after changing validators
    });
  }

  private toggleFormState(disable: boolean): void {
    if (disable) {
      this.routineForm.disable({ emitEvent: false });
    } else {
      this.routineForm.enable({ emitEvent: false });
      this.exercisesFormArray.controls.forEach(exCtrl => {
        this.updateRoundsControlability(exCtrl as FormGroup);
      });
    }
  }

  get exercisesFormArray(): FormArray {
    return this.routineForm.get('exercises') as FormArray;
  }

  getSetsFormArray(exerciseControl: AbstractControl): FormArray {
    return exerciseControl.get('sets') as FormArray;
  }

  private loadAvailableExercises(): void {
    this.exerciseService.getExercises().subscribe(exercises => {
      this.availableExercises = exercises;
    });
  }

  patchFormWithRoutineData(routine: Routine): void {
    this.routineForm.patchValue({
      name: routine.name,
      description: routine.description,
      goal: routine.goal,
    });

    this.exercisesFormArray.clear();
    routine.exercises.forEach(exerciseData => {
      const exerciseFormGroup = this.createExerciseFormGroup(exerciseData);
      this.exercisesFormArray.push(exerciseFormGroup);
    });

    if (this.isViewMode) {
      this.toggleFormState(true);
    } else {
      this.toggleFormState(false);
    }
    this.expandedSetPath.set(null); // Ensure no set is expanded after patching
  }

  private createExerciseFormGroup(exerciseData?: WorkoutExercise): FormGroup {
    const baseExercise = exerciseData?.exerciseId ? this.availableExercises.find(e => e.id === exerciseData.exerciseId) : null;

    const fg = this.fb.group({
      id: [exerciseData?.id || this.workoutService.generateWorkoutExerciseId()],
      exerciseId: [exerciseData?.exerciseId || '', Validators.required],
      exerciseName: [exerciseData?.exerciseName || baseExercise?.name || 'Select Exercise'],
      notes: [exerciseData?.notes || ''],
      sets: this.fb.array(
        exerciseData?.sets.map(set => this.createSetFormGroup(set)) || []
      ),
      supersetId: [exerciseData?.supersetId || null],
      supersetOrder: [exerciseData?.supersetOrder ?? null],
      supersetSize: [exerciseData?.supersetSize ?? null],
      rounds: [exerciseData?.rounds ?? 1, [Validators.min(1)]],
    });

    fg.get('supersetId')?.valueChanges.subscribe(() => this.updateRoundsControlability(fg));
    fg.get('supersetOrder')?.valueChanges.subscribe(() => this.updateRoundsControlability(fg));
    this.updateRoundsControlability(fg);

    fg.get('exerciseId')?.valueChanges.subscribe(newExerciseId => {
      const selectedBaseExercise = this.availableExercises.find(e => e.id === newExerciseId);
      fg.get('exerciseName')?.setValue(selectedBaseExercise?.name || 'Unknown Exercise', { emitEvent: false });
    });
    return fg;
  }

  private createSetFormGroup(setData?: ExerciseSetParams): FormGroup {
    return this.fb.group({
      id: [setData?.id || this.workoutService.generateExerciseSetId()],
      reps: [setData?.reps ?? null, [Validators.min(0)]],
      weight: [this.unitsService.convertFromKg(setData?.weight, this.unitsService.currentUnit()) ?? null, [Validators.min(0)]],
      duration: [setData?.duration ?? null, [Validators.min(0)]],
      tempo: [setData?.tempo || ''],
      restAfterSet: [setData?.restAfterSet ?? 60, [Validators.required, Validators.min(0)]],
      notes: [setData?.notes || ''],
      isWarmup: [setData?.isWarmup || false], // <<<< NEW
    });
  }

  openExerciseSelectionModal(): void {
    if (this.isViewMode) return;
    this.modalSearchTerm.set('');
    this.isExerciseModalOpen.set(true);
  }

  closeExerciseSelectionModal(): void {
    this.isExerciseModalOpen.set(false);
  }

  onModalSearchTermChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.modalSearchTerm.set(inputElement.value);
  }

  selectExercise(exercise: Exercise): void {
    const newExerciseFormGroup = this.createExerciseFormGroup({
      id: this.workoutService.generateWorkoutExerciseId(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sets: [{ id: this.workoutService.generateExerciseSetId(), reps: 8, weight: 0, restAfterSet: 60, duration: 0, tempo: '-', notes: '' }],
      supersetId: null,
      supersetOrder: null,
      supersetSize: null,
      rounds: 1
    });
    this.exercisesFormArray.push(newExerciseFormGroup);
    this.closeExerciseSelectionModal();
    // Automatically expand the first set of the new exercise
    this.toggleSetExpansion(this.exercisesFormArray.length - 1, 0);
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
    setsArray.push(this.createSetFormGroup());
    this.cdr.detectChanges(); // Ensure new set is rendered

    // Expand the newly added set
    const newSetIndex = setsArray.length - 1;
    this.toggleSetExpansion(exerciseIndex, newSetIndex);
    // Focus logic will be handled by ngAfterViewInit when the expanded element is rendered.
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

  // --- Set Expansion Logic ---
  toggleSetExpansion(exerciseIndex: number, setIndex: number, event?: MouseEvent): void {
    event?.stopPropagation(); // Prevent exercise card click if called from a button/icon
    if (this.isViewMode && !(this.expandedSetPath()?.exerciseIndex === exerciseIndex && this.expandedSetPath()?.setIndex === setIndex)) {
      // In view mode, allow expanding but not direct editing inputs.
      // If already expanded, clicking again will collapse it.
    } else if (this.isViewMode) {
      this.expandedSetPath.set(null); // Collapse if clicking the already expanded one in view mode
      return;
    }


    const currentPath = this.expandedSetPath();
    if (currentPath?.exerciseIndex === exerciseIndex && currentPath?.setIndex === setIndex) {
      this.expandedSetPath.set(null); // Collapse if already expanded
    } else {
      this.expandedSetPath.set({ exerciseIndex, setIndex });
      // Focus logic can be more targeted here or rely on ngAfterViewInit for the #expandedSetElement
      this.cdr.detectChanges(); // Ensure the expanded element is rendered
      setTimeout(() => {
        const expandedElement = this.expandedSetElements.find((el, idx) => {
          // This logic for finding the correct element might need refinement
          // if QueryList doesn't map directly to the *ngFor of expanded sets.
          // For now, assuming only one can be expanded, so .first might work.
          return true; // Simplified, assuming first is the one if any
        });
        if (expandedElement) {
          // Find the first focusable input within the expanded set
          const firstInput = expandedElement.nativeElement.querySelector('input[formControlName="reps"], input[formControlName="weight"], input[formControlName="duration"]');
          if (firstInput instanceof HTMLInputElement) {
            firstInput.focus();
            firstInput.select();
          }
        }
      }, 50); // Small delay
    }
  }

  isSetExpanded(exerciseIndex: number, setIndex: number): boolean {
    const currentPath = this.expandedSetPath();
    return currentPath?.exerciseIndex === exerciseIndex && currentPath?.setIndex === setIndex;
  }

  collapseExpandedSet(): void {
    this.expandedSetPath.set(null);
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


  get f() {
    return this.routineForm.controls;
  }

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

  onSubmit(): void {
    if (this.isViewMode) {
      this.toastService.info("Currently in view mode. No changes to save.", 3000, "View Mode");
      return;
    }

    // Recalculate superset orders before any validation that might depend on it
    this.recalculateSupersetOrders();

    // Determine if the routine is a "rest" type routine
    const isRestTypeRoutine = this.routineForm.get('goal')?.value === 'rest';

    // --- Validation ---
    // 1. Basic form validity (name, etc.)
    if (this.routineForm.get('name')?.invalid || this.routineForm.get('goal')?.invalid) {
      this.routineForm.markAllAsTouched(); // Mark all fields to show errors
      this.toastService.error('Please fill all required routine details (Name, Goal).', 0, "Validation Error");
      console.log('Form Errors (Details):', this.getFormErrors(this.routineForm));
      return;
    }

    // 2. Superset integrity validation (only if not a rest type routine AND has exercises)
    if (!isRestTypeRoutine && this.exercisesFormArray.length > 0 && !this.validateSupersetIntegrity()) {
      this.toastService.error('Superset configuration is invalid. Ensure supersets have at least two contiguous exercises.', 0, "Validation Error");
      return;
    }

    // 3. Exercise and Set validation (only if not a rest type routine)
    if (!isRestTypeRoutine) {
      if (!this.exercisesFormArray || this.exercisesFormArray.length === 0) {
        this.routineForm.markAllAsTouched(); // Mark exercises array as touched if needed by UI
        this.toastService.error('A non-rest routine must have at least one exercise.', 0, "Validation Error");
        return;
      }

      const exercisesValue = this.exercisesFormArray.value as WorkoutExercise[];
      for (let i = 0; i < exercisesValue.length; i++) {
        const exercise = exercisesValue[i];
        const baseExerciseDetails = this.availableExercises.find(e => e.id === exercise.exerciseId);
        const exerciseDisplayName = exercise.exerciseName || baseExerciseDetails?.name || `Exercise ${i + 1}`;

        if (!exercise.sets || exercise.sets.length === 0) {
          this.toastService.error(`The exercise "${exerciseDisplayName}" must have at least one set.`, 0, "Validation Error");
          // Potentially mark this specific exercise control as touched/invalid if UI shows errors at that level
          (this.exercisesFormArray.at(i) as FormGroup).markAllAsTouched();
          return;
        }
        const exerciseFormControl = this.exercisesFormArray.at(i) as FormGroup;
        const roundsValue = exerciseFormControl.get('rounds')?.value;
        if (roundsValue !== null && roundsValue !== undefined && roundsValue < 1) {
          this.toastService.error(`The exercise "${exerciseDisplayName}" must have at least 1 round.`, 0, "Validation Error");
          (this.exercisesFormArray.at(i) as FormGroup).get('rounds')?.markAsTouched();
          return;
        }
        for (let j = 0; j < exercise.sets.length; j++) {
          const set = exercise.sets[j];
          const setDisplayName = `Set ${j + 1} of "${exerciseDisplayName}"`;
          const reps = set.reps ?? 0;
          const weight = set.weight ?? 0;
          const duration = set.duration ?? 0;
          let isPrimarilyDurationSet = duration > 0;

          if (!isPrimarilyDurationSet && baseExerciseDetails) {
            const durationCategories = ['cardio', 'stretching', 'plank', 'isometric']; // Consider 'yoga', 'pilates' etc.
            if (durationCategories.includes(baseExerciseDetails.category.toLowerCase())) {
              isPrimarilyDurationSet = true;
            }
          }

          if (isPrimarilyDurationSet) {
            if (duration <= 0) {
              this.toastService.error(`${setDisplayName} is timed but has no duration.`, 0, "Validation Error");
              ((this.exercisesFormArray.at(i) as FormGroup).get('sets') as FormArray).at(j).markAllAsTouched();
              return;
            }
          } else { // Not primarily duration based (i.e., reps/weight based)
            if (reps <= 0 && weight <= 0 && duration <= 0) { // If duration is also 0 or null, then reps or weight must be > 0
              this.toastService.error(`${setDisplayName} must have reps, weight, or duration.`, 0, "Validation Error");
              ((this.exercisesFormArray.at(i) as FormGroup).get('sets') as FormArray).at(j).markAllAsTouched();
              return;
            }
            if (reps <= 0 && weight > 0) {
              this.toastService.error(`${setDisplayName} with weight must also have reps.`, 0, "Validation Error");
              ((this.exercisesFormArray.at(i) as FormGroup).get('sets') as FormArray).at(j).markAllAsTouched();
              return;
            }
          }
        }
      }
    }
    // --- End of Validation ---


    // If all validations pass (or are skipped for "rest" type)
    const formValue = this.routineForm.getRawValue();

    const routinePayload: Routine = {
      id: (this.isEditMode || this.isNewMode) && this.currentRoutineId ? this.currentRoutineId : uuidv4(),
      name: formValue.name,
      description: formValue.description,
      goal: formValue.goal,
      // If it's a rest type routine, exercises array will be empty or what was submitted (should be empty due to validation skip)
      // Otherwise, map the exercises.
      exercises: isRestTypeRoutine ? [] : formValue.exercises.map((exInput: any) => ({
        ...exInput,
        sets: exInput.sets.map((setInput: any) => ({
          ...setInput,
          weight: this.unitsService.convertToKg(setInput.weight, this.unitsService.currentUnit()) ?? null,
          restAfterSet: setInput.restAfterSet ?? 0,
        }))
      })),
    };

    if (this.isNewMode && !this.currentRoutineId) {
      routinePayload.id = uuidv4(); // Ensure new ID for new routines
    }

    try {
      this.spinnerService.show("Saving routine...");
      if (this.isNewMode) {
        this.workoutService.addRoutine(routinePayload);
        this.toastService.success("Routine created successfully!", 4000, "Success");
      } else if (this.isEditMode && this.currentRoutineId) {
        this.workoutService.updateRoutine(routinePayload);
        this.toastService.success("Routine updated successfully!", 4000, "Success");
      } else {
        // This case should ideally not be reached if modes are set correctly
        this.toastService.warning("No save operation performed. Mode is unclear or ID missing.", 0, "Save Warning");
        this.spinnerService.hide();
        return;
      }
      this.routineForm.markAsPristine(); // Mark form as pristine after successful save
      this.router.navigate(['/workout']);
    } catch (e: any) {
      console.error("Error saving routine:", e);
      this.toastService.error(`Failed to save routine: ${e.message || 'Unknown error'}`, 0, "Save Error");
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
      if (group.length < 2) return false;
      const sortedGroup = group.sort((a, b) => (a.supersetOrder ?? Infinity) - (b.supersetOrder ?? Infinity));
      for (let i = 0; i < sortedGroup.length; i++) {
        if (sortedGroup[i].supersetOrder !== i) return false;
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
      this.router.navigate(['/workout/edit', this.currentRoutineId], { replaceUrl: true });
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