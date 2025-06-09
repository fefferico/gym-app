import { Component, inject, OnInit, OnDestroy, signal, computed, ElementRef, QueryList, ViewChildren, AfterViewInit, ChangeDetectorRef } from '@angular/core';

import { CommonModule, DecimalPipe } from '@angular/common';
import { ActivatedRoute, ActivatedRouteSnapshot, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, AbstractControl, FormsModule } from '@angular/forms'; // Added FormArray, AbstractControl
import { Subscription, of, firstValueFrom } from 'rxjs'; // Added firstValueFrom
import { switchMap, tap, take } from 'rxjs/operators'; // Added take
import { v4 as uuidv4 } from 'uuid';

import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop'; // Import CDK Drag and Drop

import { Routine, ExerciseSetParams, WorkoutExercise } from '../../core/models/workout.model';
import { Exercise } from '../../core/models/exercise.model'; // For later exercise selection
import { WorkoutService } from '../../core/services/workout.service';
import { ExerciseService } from '../../core/services/exercise.service'; // We'll need this soon
import { UnitsService } from '../../core/services/units.service';
import { WeightUnitPipe } from '../../shared/pipes/weight-unit-pipe';
import { SpinnerService } from '../../core/services/spinner.service';
import { AlertComponent } from '../../shared/components/alert/alert.component';
import { AlertService } from '../../core/services/alert.service';
import { ToastService } from '../../core/services/toast.service'; // Import ToastService
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
  protected toastService = inject(ToastService); // Inject ToastService
  private trackingService = inject(TrackingService);


  @ViewChildren('setRepsInput') setRepsInputs!: QueryList<ElementRef<HTMLInputElement>>;
  private cdr = inject(ChangeDetectorRef);

  routineForm!: FormGroup;
  isEditMode = false;
  isNewMode = false;
  isViewMode = false;
  currentRoutineId: string | null = null;
  private routeSub: Subscription | undefined;

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
    { value: 'rehabilitation / injury prevention', label: 'Rehabilitation / injury prevention' }, // Corrected typo
    { value: 'mental health / stress relief', label: 'Mental health' },
    { value: 'general health & longevity', label: 'General health & longevity' }, // Corrected typo
    { value: 'sport-specific performance', label: 'Sport-specific performance' },
    { value: 'maintenance', label: 'Maintenance'},
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

  ngOnInit(): void {
    window.scrollTo(0, 0);
    this.loadAvailableExercises();

    this.routeSub = this.route.paramMap.pipe(
      switchMap(params => {
        this.currentRoutineId = params.get('routineId');
        const currentPath = this.route.snapshot.url[0]?.path;
        this.isNewMode = currentPath === 'new';
        this.isViewMode = currentPath === 'view' && !!this.currentRoutineId;
        // Edit mode is true if path is 'edit' OR if it's 'new' (because new form is editable)
        this.isEditMode = (currentPath === 'edit' && !!this.currentRoutineId) || this.isNewMode;


        if (this.currentRoutineId && (this.isEditMode || this.isViewMode) && !this.isNewMode) {
          return this.workoutService.getRoutineById(this.currentRoutineId);
        }
        this.exercisesFormArray.clear();
        this.routineForm.reset({ goal: 'custom', exercises: [] });
         if (this.isNewMode) { // Ensure form is enabled for new mode
            this.toggleFormState(false);
        }
        return of(null);
      }),
      tap(routine => {
        if (routine) {
          this.patchFormWithRoutineData(routine);
          // If in view mode, disable the form.
          // If in edit mode (existing routine), it should already be enabled by patchForm or default.
          if (this.isViewMode) {
            this.toggleFormState(true);
          } else if (this.isEditMode && !this.isNewMode) { // Editing an existing routine
             this.toggleFormState(false);
          }
        } else if ((this.isEditMode || this.isViewMode) && !this.isNewMode && this.currentRoutineId) {
          this.toastService.error(`Routine with ID ${this.currentRoutineId} not found.`, 0, "Error");
          this.router.navigate(['/workout']);
        }
      })
    ).subscribe();
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
      rounds: [exerciseData?.rounds ?? 1, [Validators.min(1)]]
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
      weight: [this.unitsService.convertFromKg(setData?.weight, this.unitsService.currentUnit()) ?? null, [Validators.min(0)]], // Convert to display unit
      duration: [setData?.duration ?? null, [Validators.min(0)]],
      tempo: [setData?.tempo || ''],
      restAfterSet: [setData?.restAfterSet ?? 60, [Validators.required, Validators.min(0)]],
      notes: [setData?.notes || ''],
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
      sets: [{ id: this.workoutService.generateExerciseSetId(), reps: 8, weight: 0, restAfterSet: 60 }],
      supersetId: null,
      supersetOrder: null,
      supersetSize: null,
      rounds: 1
    });
    this.exercisesFormArray.push(newExerciseFormGroup);
    this.closeExerciseSelectionModal();
  }

  ngAfterViewInit(): void {
    // For focusing logic, if needed after dynamic elements.
  }

  addSet(exerciseControl: AbstractControl, exerciseIndex: number): void {
    if (this.isViewMode) return;
    const setsArray = this.getSetsFormArray(exerciseControl);
    setsArray.push(this.createSetFormGroup());
    this.cdr.detectChanges();
    setTimeout(() => {
      let globalInputIndex = 0;
      for (let i = 0; i < exerciseIndex; i++) {
        const prevExerciseControl = this.exercisesFormArray.at(i);
        globalInputIndex += this.getSetsFormArray(prevExerciseControl).length;
      }
      globalInputIndex += setsArray.length - 1;
      const inputToFocus = this.setRepsInputs.toArray()[globalInputIndex];
      if (inputToFocus && inputToFocus.nativeElement) {
        inputToFocus.nativeElement.focus();
        inputToFocus.nativeElement.select();
      }
    }, 0);
  }

  removeSet(exerciseControl: AbstractControl, setIndex: number): void {
    if (this.isViewMode) return;
    const setsArray = this.getSetsFormArray(exerciseControl);
    setsArray.removeAt(setIndex);
  }

  private getFormErrors(formGroup: FormGroup | FormArray): any {
    // ... (implementation remains the same)
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
      } else { // Ensure standalone exercises have null superset fields and controllable rounds
        exerciseForm.patchValue({ supersetOrder: null, supersetSize: null }, { emitEvent: false });
        this.updateRoundsControlability(exerciseForm);
      }
    });
    supersetGroups.forEach((groupExercises, supersetId) => {
      if (groupExercises.length < 2) {
        groupExercises.forEach(fg => {
            fg.patchValue({ supersetId: null, supersetOrder: null, supersetSize: null });
            this.updateRoundsControlability(fg); // Update rounds for now standalone exercises
        });
      } else {
        groupExercises.sort((a, b) => { // Sort by original form array index to maintain visual order
            return this.exercisesFormArray.controls.indexOf(a) - this.exercisesFormArray.controls.indexOf(b);
        });
        groupExercises.forEach((exerciseForm, index) => {
          exerciseForm.patchValue({
            supersetOrder: index,
            supersetSize: groupExercises.length,
          }, { emitEvent: false });
           this.updateRoundsControlability(exerciseForm); // Update rounds based on new order
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
    // Contiguity check (important for this simplified grouping)
    for (let i = 1; i < selectedIndices.length; i++) {
      if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
        this.toastService.warning("Selected exercises must be next to each other in the list to form a superset. Please reorder them first.", 5000, "Superset Error");
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
      this.recalculateSupersetOrders(); // This will handle re-ordering or disbanding if needed
    }
    this.toastService.info("Exercise removed.", 2000);
  }

  errorMessage = signal<string | null>(null);

  private showErrorMessage(message: string, duration: number = 3000): void { // Not used, using ToastService
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), duration);
  }

  onSubmit(): void {
    if (this.isViewMode) {
      this.toastService.info("Currently in view mode. No changes to save.", 3000, "View Mode");
      return;
    }
    this.recalculateSupersetOrders();
    if (!this.validateSupersetIntegrity()) {
      this.toastService.error('Superset configuration is invalid. Ensure supersets have at least two contiguous exercises.', 0, "Validation Error");
      return;
    }

    // Existing validations for exercises and sets
     const exercisesValue = this.exercisesFormArray.value as WorkoutExercise[];
    for (let i = 0; i < exercisesValue.length; i++) {
      const exercise = exercisesValue[i];
      const baseExerciseDetails = this.availableExercises.find(e => e.id === exercise.exerciseId);
      const exerciseDisplayName = exercise.exerciseName || baseExerciseDetails?.name || `Exercise ${i + 1}`;

      if (!exercise.sets || exercise.sets.length === 0) {
        this.toastService.error(`The exercise "${exerciseDisplayName}" must have at least one set.`, 0, "Validation Error");
        return;
      }
      const exerciseFormControl = this.exercisesFormArray.at(i) as FormGroup;
      const roundsValue = exerciseFormControl.get('rounds')?.value;
      if (roundsValue !== null && roundsValue !== undefined && roundsValue < 1) {
          this.toastService.error(`The exercise "${exerciseDisplayName}" must have at least 1 round.`, 0, "Validation Error");
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
            const durationCategories = ['cardio', 'stretching', 'plank', 'isometric'];
            if (durationCategories.includes(baseExerciseDetails.category.toLowerCase())) {
                isPrimarilyDurationSet = true;
            }
        }
        if (isPrimarilyDurationSet) {
          if (duration <= 0) {
            this.toastService.error(`${setDisplayName} is timed but has no duration.`, 0, "Validation Error");
            return;
          }
        } else {
          if (reps <= 0 && weight <= 0) {
            this.toastService.error(`${setDisplayName} must have reps or weight.`, 0, "Validation Error");
            return;
          }
           if (reps <= 0 && weight > 0) { // Changed this condition from original
            this.toastService.error(`${setDisplayName} with weight must also have reps.`, 0, "Validation Error");
            return;
          }
        }
      }
    }

    if (this.routineForm.invalid || (!this.exercisesFormArray || this.exercisesFormArray.length === 0)) {
      this.routineForm.markAllAsTouched();
      this.toastService.error('Please fill required fields (Name, at least one exercise with sets).', 0, "Validation Error");
      console.log('Form Errors:', this.getFormErrors(this.routineForm));
      return;
    }

    const formValue = this.routineForm.getRawValue(); // Use getRawValue to include disabled fields like 'rounds' in supersets

    const routinePayload: Routine = {
      id: (this.isEditMode || this.isNewMode) && this.currentRoutineId ? this.currentRoutineId : uuidv4(),
      name: formValue.name,
      description: formValue.description,
      goal: formValue.goal,
      exercises: formValue.exercises.map((exInput: any) => ({
        ...exInput,
        sets: exInput.sets.map((setInput: any) => ({
          ...setInput,
          weight: this.unitsService.convertToKg(setInput.weight, this.unitsService.currentUnit()) ?? null,
          restAfterSet: setInput.restAfterSet ?? 0,
        }))
      })),
    };
    if (this.isNewMode && !this.currentRoutineId) {
        routinePayload.id = uuidv4();
    }

    try {
        this.spinnerService.show();
        if (this.isNewMode) {
          this.workoutService.addRoutine(routinePayload);
          this.toastService.success("Routine created successfully!", 4000, "Success");
        } else if (this.isEditMode && this.currentRoutineId) {
          this.workoutService.updateRoutine(routinePayload);
          this.toastService.success("Routine updated successfully!", 4000, "Success");
        } else {
          this.toastService.warning("No save operation performed. Mode is unclear or ID missing.", 0, "Save Warning");
          this.spinnerService.hide();
          return;
        }
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

    if (this.isViewMode) { // Always disable in view mode
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
        // this.updateRoundsControlability(exerciseFg); // Not strictly needed here as only value changes for others
      }
    });
  }

  // --- NEW METHODS FOR BUILDER ACTIONS ---
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
        this.isEditMode = true; // Now it's explicitly edit mode for an existing routine
        this.toggleFormState(false); // Enable the form
        this.router.navigate(['/workout/edit', this.currentRoutineId], { replaceUrl: true }); // Update URL without adding to history
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
                await this.trackingService.clearWorkoutLogsByRoutineId(this.currentRoutineId); // ensure this is async or returns a promise
                 this.toastService.info(`${associatedLogs.length} workout log(s) deleted.`, 3000, "Logs Cleared");
            }
            await this.workoutService.deleteRoutine(this.currentRoutineId); // ensure this is async
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