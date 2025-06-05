import { Component, inject, OnInit, OnDestroy, signal, computed, ElementRef, QueryList, ViewChildren, AfterViewInit, ChangeDetectorRef } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, AbstractControl, FormsModule } from '@angular/forms'; // Added FormArray, AbstractControl
import { Subscription, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop'; // Import CDK Drag and Drop

import { Routine, ExerciseSetParams, WorkoutExercise } from '../../core/models/workout.model';
import { Exercise } from '../../core/models/exercise.model'; // For later exercise selection
import { WorkoutService } from '../../core/services/workout.service';
import { ExerciseService } from '../../core/services/exercise.service'; // We'll need this soon

@Component({
  selector: 'app-workout-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule, DragDropModule],
  templateUrl: './workout-builder.html',
  styleUrl: './workout-builder.scss',
})
export class WorkoutBuilderComponent implements OnInit, OnDestroy, AfterViewInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService); // Inject ExerciseService

  @ViewChildren('setRepsInput') setRepsInputs!: QueryList<ElementRef<HTMLInputElement>>;
  private cdr = inject(ChangeDetectorRef); // Inject ChangeDetectorRef

  routineForm!: FormGroup;
  isEditMode = false;
  currentRoutineId: string | null = null;
  private routeSub: Subscription | undefined;

  routineGoals: { value: Routine['goal'], label: string }[] = [
    { value: 'strength', label: 'Strength' },
    { value: 'hypertrophy', label: 'Hypertrophy' },
    { value: 'endurance', label: 'Endurance' },
    { value: 'custom', label: 'Custom' },
  ];

  // For exercise selection modal (to be implemented)
  isExerciseModalOpen = signal(false); // Use signal for modal state
  availableExercises: Exercise[] = []; // To be populated from ExerciseService
  modalSearchTerm = signal(''); // Signal for modal search

  // Computed signal for exercises displayed in the modal
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

  // Signal to track selected exercise indices for superset actions
  selectedExerciseIndicesForSuperset = signal<number[]>([]);

  constructor() {
    this.routineForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      goal: ['custom' as Routine['goal']],
      exercises: this.fb.array([]), // Initialize exercises as a FormArray
    });
  }

  ngOnInit(): void {
    this.loadAvailableExercises(); // Load exercises for the selection modal

    this.routeSub = this.route.paramMap.pipe(
      switchMap(params => {
        this.currentRoutineId = params.get('routineId');
        if (this.currentRoutineId) {
          this.isEditMode = true;
          return this.workoutService.getRoutineById(this.currentRoutineId);
        }
        this.isEditMode = false;
        this.exercisesFormArray.clear(); // Clear exercises for new routine
        return of(null);
      }),
      tap(routine => {
        if (routine) {
          this.patchFormWithRoutineData(routine);
        } else if (this.isEditMode) {
          console.error(`Routine with ID ${this.currentRoutineId} not found.`);
          this.router.navigate(['/workout']);
        } else {
          this.routineForm.reset({ goal: 'custom', exercises: [] });
          this.exercisesFormArray.clear();
        }
      })
    ).subscribe();
  }

  // --- FormArray Getters ---
  get exercisesFormArray(): FormArray {
    return this.routineForm.get('exercises') as FormArray;
  }

  // Helper to get sets FormArray from an exercise FormGroup
  getSetsFormArray(exerciseControl: AbstractControl): FormArray {
    return exerciseControl.get('sets') as FormArray;
  }

  // --- Load Data ---
  private loadAvailableExercises(): void {
    this.exerciseService.getExercises().subscribe(exercises => {
      this.availableExercises = exercises;
    });
  }

  private patchFormWithRoutineData(routine: Routine): void {
    this.routineForm.patchValue({
      name: routine.name,
      description: routine.description,
      goal: routine.goal,
    });

    this.exercisesFormArray.clear(); // Clear existing exercises before patching
    routine.exercises.forEach(exerciseData => {
      const exerciseFormGroup = this.createExerciseFormGroup(exerciseData);
      this.exercisesFormArray.push(exerciseFormGroup);
    });
  }

  // --- Form Group Creation ---
  private createExerciseFormGroup(exerciseData?: WorkoutExercise): FormGroup {
    const baseExercise = exerciseData?.exerciseId ? this.availableExercises.find(e => e.id === exerciseData.exerciseId) : null;

    const fg = this.fb.group({
      // --- Existing fields ---
      id: [exerciseData?.id || this.workoutService.generateWorkoutExerciseId()],
      exerciseId: [exerciseData?.exerciseId || '', Validators.required],
      exerciseName: [exerciseData?.exerciseName || baseExercise?.name || 'Unknown Exercise'],
      notes: [exerciseData?.notes || ''],
      sets: this.fb.array(
        exerciseData?.sets.map(set => this.createSetFormGroup(set)) || []
      ),
      // --- NEW Superset fields ---
      supersetId: [exerciseData?.supersetId || null],
      supersetOrder: [exerciseData?.supersetOrder ?? null], // Use ?? for nullish coalescing
      supersetSize: [exerciseData?.supersetSize ?? null],
    });

    // If exerciseId changes, update exerciseName (example of dynamic field update)
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
      weight: [setData?.weight ?? null, [Validators.min(0)]],
      duration: [setData?.duration ?? null, [Validators.min(0)]], // For timed sets
      tempo: [setData?.tempo || ''],
      restAfterSet: [setData?.restAfterSet ?? 60, [Validators.required, Validators.min(0)]],
      notes: [setData?.notes || ''],
    });
  }

  // --- Exercise Management ---
  openExerciseSelectionModal(): void {
    this.modalSearchTerm.set(''); // Reset search term when opening
    this.isExerciseModalOpen.set(true);
  }

  closeExerciseSelectionModal(): void {
    this.isExerciseModalOpen.set(false);
  }

  onModalSearchTermChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.modalSearchTerm.set(inputElement.value);
  }

  // --- Exercise Management (selectExercise, removeExercise methods might need slight tweaks if they affect superset grouping) ---
  selectExercise(exercise: Exercise): void { // From modal
    const newExerciseFormGroup = this.createExerciseFormGroup({
      id: this.workoutService.generateWorkoutExerciseId(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sets: [{ id: this.workoutService.generateExerciseSetId(), reps: 8, weight: 0, restAfterSet: 60 }],
      // Initialize superset fields as null for a new, standalone exercise
      supersetId: null,
      supersetOrder: null,
      supersetSize: null,
    });
    this.exercisesFormArray.push(newExerciseFormGroup);
    this.closeExerciseSelectionModal();
  }

  ngAfterViewInit(): void {
    // Subscribe to changes in the QueryList (e.g., when new inputs are added)
    // This is one way to handle focusing after dynamic elements are rendered.
    // We'll refine focus logic within addSet more directly.
  }


  // --- Set Management ---
  addSet(exerciseControl: AbstractControl, exerciseIndex: number): void { // Added exerciseIndex
    const setsArray = this.getSetsFormArray(exerciseControl);
    setsArray.push(this.createSetFormGroup());

    // --- Auto-focus logic ---
    // We need to wait for Angular to render the new input field.
    // Using a microtask (setTimeout with 0ms) is a common way.
    this.cdr.detectChanges(); // Ensure DOM is updated before trying to focus
    setTimeout(() => {
      // Calculate the global index of the newly added reps input
      // This logic assumes all exercises before this one have their inputs rendered.
      // And that each exercise's inputs are grouped.
      let globalInputIndex = 0;
      for (let i = 0; i < exerciseIndex; i++) {
        const prevExerciseControl = this.exercisesFormArray.at(i);
        globalInputIndex += this.getSetsFormArray(prevExerciseControl).length;
      }
      // Add the number of sets in the current exercise *before* the new one
      globalInputIndex += setsArray.length - 1;


      const inputToFocus = this.setRepsInputs.toArray()[globalInputIndex];
      if (inputToFocus && inputToFocus.nativeElement) {
        console.log('Focusing input:', inputToFocus.nativeElement);
        inputToFocus.nativeElement.focus();
        inputToFocus.nativeElement.select(); // Optionally select text
      } else {
        console.warn('Could not find reps input to focus at global index:', globalInputIndex, this.setRepsInputs.toArray());
      }
    }, 0);
  }

  removeSet(exerciseControl: AbstractControl, setIndex: number): void {
    const setsArray = this.getSetsFormArray(exerciseControl);
    setsArray.removeAt(setIndex);
  }

  // Helper to get all form errors for debugging
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


  // Basic get for cleaner template access to form controls (metadata part)
  get f() {
    return this.routineForm.controls;
  }


  // --- Superset Management Logic ---
  toggleExerciseSelectionForSuperset(index: number, event: Event): void {
    const checkbox = event.target as HTMLInputElement;
    this.selectedExerciseIndicesForSuperset.update(currentSelected => {
      let newSelected: number[];
      if (checkbox.checked) {
        newSelected = currentSelected.includes(index) ? currentSelected : [...currentSelected, index];
      } else {
        newSelected = currentSelected.filter(i => i !== index);
      }
      return newSelected.sort((a, b) => a - b); // Ensure it's always sorted
    });
  }

  canGroupSelectedExercises(): boolean {
    // Can group if 2 or more are selected AND they are not already part of different supersets
    // OR if they are part of the SAME superset (for potential regrouping, though less common)
    const selectedIndices = this.selectedExerciseIndicesForSuperset();
    if (selectedIndices.length < 2) return false;

    const firstSelectedSupersetId = (this.exercisesFormArray.at(selectedIndices[0]) as FormGroup).get('supersetId')?.value;

    for (let i = 1; i < selectedIndices.length; i++) {
      const currentIndex = selectedIndices[i];
      // Check if selected exercises are contiguous for simplicity in initial implementation
      if (currentIndex !== selectedIndices[i - 1] + 1) {
        // alert("Superset exercises must be next to each other in the list to be grouped.");
        // return false; // For drag-and-drop this wouldn't be a restriction
      }
      // Check if they belong to different existing supersets
      const currentSupersetId = (this.exercisesFormArray.at(currentIndex) as FormGroup).get('supersetId')?.value;
      if (firstSelectedSupersetId && currentSupersetId && firstSelectedSupersetId !== currentSupersetId) {
        // alert("Cannot group exercises from different existing supersets directly. Ungroup them first.");
        return false; // More complex merging would be needed
      }
      // If first is not in a superset, but current is, they can't be simply grouped.
      if (!firstSelectedSupersetId && currentSupersetId) return false;
    }
    return true;
  }

  // --- DRAG AND DROP for Exercises ---
  onExerciseDrop(event: CdkDragDrop<AbstractControl[]>): void {
    if (event.previousContainer === event.container) {
      const exercisesArray = this.exercisesFormArray;
      moveItemInArray(exercisesArray.controls, event.previousIndex, event.currentIndex);
      exercisesArray.updateValueAndValidity();

      console.log(`Moved exercise from index ${event.previousIndex} to ${event.currentIndex}`);
      this.selectedExerciseIndicesForSuperset.set([]);

      this.handleSupersetIntegrityAfterDrag(event.previousIndex, event.currentIndex);
      this.recalculateSupersetOrders(); // <-- ADD THIS CALL HERE
    } else {
      console.log('Item dropped into a different container - not handled in this version.');
    }
  }

  private handleSupersetIntegrityAfterDrag(previousIndex: number, currentIndex: number): void {
    // This is a complex problem. A simple strategy for now:
    // If any of the exercises involved in the move (original position, new position, and items shifted)
    // were part of a superset, it's safest to ungroup those affected supersets.
    // The user can then re-group them if desired.

    const affectedIndices = new Set<number>();
    affectedIndices.add(previousIndex); // Original location of dragged item (before moveItemInArray)
    affectedIndices.add(currentIndex);  // New location of dragged item

    // Consider items that were shifted
    if (previousIndex < currentIndex) {
      for (let i = previousIndex; i <= currentIndex; i++) affectedIndices.add(i);
    } else {
      for (let i = currentIndex; i <= previousIndex; i++) affectedIndices.add(i);
    }

    const supersetIdsToUngroup = new Set<string>();

    affectedIndices.forEach(index => {
      if (index < this.exercisesFormArray.length) { // Check bounds
        const exerciseControl = this.exercisesFormArray.at(index) as FormGroup;
        const supersetId = exerciseControl.get('supersetId')?.value;
        if (supersetId) {
          supersetIdsToUngroup.add(supersetId);
        }
      }
    });

    supersetIdsToUngroup.forEach(supersetIdToClear => {
      console.log(`Drag operation potentially broke superset ${supersetIdToClear}. Ungrouping it.`);
      this.exercisesFormArray.controls.forEach(exCtrl => {
        const fg = exCtrl as FormGroup;
        if (fg.get('supersetId')?.value === supersetIdToClear) {
          fg.patchValue({
            supersetId: null,
            supersetOrder: null,
            supersetSize: null,
          });
        }
      });
    });
    // After ungrouping, if you want to automatically re-apply superset order based on new positions for *other* intact supersets:
    this.recalculateSupersetOrders();
  }

  private recalculateSupersetOrders(): void {
    // Iterates through the form array and re-assigns supersetOrder for exercises
    // that are still part of a valid superset group.
    const supersetGroups = new Map<string, FormGroup[]>();

    // Group exercises by supersetId
    this.exercisesFormArray.controls.forEach(control => {
      const exerciseForm = control as FormGroup;
      const supersetId = exerciseForm.get('supersetId')?.value;
      if (supersetId) {
        if (!supersetGroups.has(supersetId)) {
          supersetGroups.set(supersetId, []);
        }
        supersetGroups.get(supersetId)!.push(exerciseForm);
      }
    });

    // Update order and size for each group
    supersetGroups.forEach((groupExercises, supersetId) => {
      if (groupExercises.length < 2) { // Not a valid superset anymore
        groupExercises.forEach(fg => fg.patchValue({ supersetId: null, supersetOrder: null, supersetSize: null }));
      } else {
        groupExercises.forEach((exerciseForm, index) => {
          exerciseForm.patchValue({
            supersetOrder: index,
            supersetSize: groupExercises.length,
          }, { emitEvent: false }); // Avoid triggering excessive change detections
        });
      }
    });
    this.exercisesFormArray.updateValueAndValidity(); // Ensure form reflects changes
  }


  // --- Superset Management Logic ---
  // groupSelectedAsSuperset and ungroupSuperset might need slight adjustments
  // to ensure they correctly re-evaluate order after changes.

  groupSelectedAsSuperset(): void {
    const selectedIndices = this.selectedExerciseIndicesForSuperset().sort((a, b) => a - b); // Ensure sorted for contiguous check
    // Basic contiguity check (simplification for now)
    for (let i = 1; i < selectedIndices.length; i++) {
      if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
        alert("For this version, please select contiguous exercises to form a superset. You can drag exercises to make them contiguous first.");
        return;
      }
    }
    // Further checks from canGroupSelectedExercises can be integrated here or kept separate
    // ... (rest of your grouping logic from previous step, ensure it sets supersetId, supersetOrder, supersetSize)
    // After grouping, clear selection
    const newSupersetId = uuidv4();
    const supersetSize = selectedIndices.length;

    selectedIndices.forEach((exerciseIndexInFormArray, orderInSuperset) => {
      const exerciseControl = this.exercisesFormArray.at(exerciseIndexInFormArray) as FormGroup;
      exerciseControl.patchValue({
        supersetId: newSupersetId,
        supersetOrder: orderInSuperset,
        supersetSize: supersetSize,
      });
      const setsArray = exerciseControl.get('sets') as FormArray;
      setsArray.controls.forEach((setControl) => {
        if (orderInSuperset < supersetSize - 1) {
          (setControl as FormGroup).get('restAfterSet')?.setValue(0);
        }
      });
    });
    this.selectedExerciseIndicesForSuperset.set([]);
    this.recalculateSupersetOrders(); // Recalculate all orders
  }

  ungroupSuperset(exerciseIndex: number): void { // Ungroups the entire superset the clicked exercise belongs to
    const exerciseControl = this.exercisesFormArray.at(exerciseIndex) as FormGroup;
    const supersetIdToClear = exerciseControl.get('supersetId')?.value;

    if (!supersetIdToClear) return;

    this.exercisesFormArray.controls.forEach(ctrl => {
      const fg = ctrl as FormGroup;
      if (fg.get('supersetId')?.value === supersetIdToClear) {
        fg.patchValue({
          supersetId: null,
          supersetOrder: null,
          supersetSize: null,
        });
      }
    });
    this.selectedExerciseIndicesForSuperset.set([]);
    this.recalculateSupersetOrders(); // Recalculate (though none should be left for this ID)
  }

  // Modified removeExercise to better handle supersets
  removeExercise(exerciseIndex: number): void {
    const exerciseControl = this.exercisesFormArray.at(exerciseIndex) as FormGroup;
    const removedSupersetId = exerciseControl.get('supersetId')?.value;

    this.exercisesFormArray.removeAt(exerciseIndex);
    this.selectedExerciseIndicesForSuperset.set([]); // Clear selection

    if (removedSupersetId) {
      // If an exercise is removed from a superset, the superset group might become invalid or need reordering.
      // It's simplest to ungroup all remaining exercises from that specific supersetId
      // or recalculate their order and size.
      const remainingInSuperset: FormGroup[] = [];
      this.exercisesFormArray.controls.forEach(ctrl => {
        const fg = ctrl as FormGroup;
        if (fg.get('supersetId')?.value === removedSupersetId) {
          remainingInSuperset.push(fg);
        }
      });

      if (remainingInSuperset.length < 2) { // Superset is no longer valid
        remainingInSuperset.forEach(fg => {
          fg.patchValue({ supersetId: null, supersetOrder: null, supersetSize: null });
        });
      } else { // Re-order and re-size the remaining superset
        remainingInSuperset.forEach((fg, order) => {
          fg.patchValue({ supersetOrder: order, supersetSize: remainingInSuperset.length });
        });
      }
    }
    // After any removal that might affect other supersets, recalculate all
    this.recalculateSupersetOrders();
  }


  // --- Error Handling / User Feedback (Placeholder) ---
  // We can add a signal for error messages
  errorMessage = signal<string | null>(null);

  private showErrorMessage(message: string, duration: number = 3000): void {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(null), duration);
  }

  // --- Form Submission ---
  onSubmit(): void {
    this.errorMessage.set(null); // Clear previous errors
    if (this.routineForm.invalid) {
      this.routineForm.markAllAsTouched(); // Show validation errors on form controls
      this.showErrorMessage('Please fill in all required fields and correct any errors.');
      console.log('Form Errors:', this.getFormErrors(this.routineForm));
      return;
    }

    // Validate superset integrity before saving (optional but good)
    if (!this.validateSupersetIntegrity()) {
      this.showErrorMessage('Superset configuration is invalid. Please ensure supersets have at least two exercises and are ordered correctly.');
      return;
    }


    const routinePayload: Routine = {
      id: this.isEditMode && this.currentRoutineId ? this.currentRoutineId : uuidv4(),
      ...this.routineForm.value,
    };

    // Ensure supersetOrder is sequential if supersetId exists
    // This might already be handled by recalculateSupersetOrders
    // but good to double check or transform data if needed for backend.

    if (this.isEditMode) {
      this.workoutService.updateRoutine(routinePayload);
      // Add toast/snackbar: this.feedbackService.showSuccess('Routine updated!');
    } else {
      this.workoutService.addRoutine(routinePayload);
      // Add toast/snackbar: this.feedbackService.showSuccess('Routine created!');
    }
    this.router.navigate(['/workout']);
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
      if (group.length < 2) {
        console.error(`Invalid superset ${id}: only ${group.length} exercise(s).`);
        return false; // Superset must have at least 2 exercises
      }
      // Check for contiguous supersetOrder starting from 0
      const sortedGroup = group.sort((a, b) => (a.supersetOrder ?? Infinity) - (b.supersetOrder ?? Infinity));
      for (let i = 0; i < sortedGroup.length; i++) {
        if (sortedGroup[i].supersetOrder !== i) {
          console.error(`Invalid superset order in ${id}. Exercise ${sortedGroup[i].exerciseName} has order ${sortedGroup[i].supersetOrder}, expected ${i}.`);
          return false;
        }
      }
    }
    return true;
  }

  // Helper to get the index of the first selected exercise in the form array
  // This will be used in the template to position the button.
  get firstSelectedExerciseIndexForSuperset(): number | null {
    const selectedIndices = this.selectedExerciseIndicesForSuperset();
    if (selectedIndices.length > 0) {
      // The signal already stores them sorted (or should if toggleExerciseSelectionForSuperset sorts it)
      // If not, sort here: return [...selectedIndices].sort((a, b) => a - b)[0];
      return selectedIndices[0]; // Assuming it's always sorted numerically ascending
    }
    return null;
  }

  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }
}