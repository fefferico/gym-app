import { Component, inject, OnInit, OnDestroy, signal, computed, ElementRef, QueryList, ViewChildren, AfterViewInit, ChangeDetectorRef } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, AbstractControl, FormsModule } from '@angular/forms'; // Added FormArray, AbstractControl
import { Subscription, of } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

import { Routine, ExerciseSetParams, WorkoutExercise } from '../../core/models/workout.model';
import { Exercise } from '../../core/models/exercise.model'; // For later exercise selection
import { WorkoutService } from '../../core/services/workout.service';
import { ExerciseService } from '../../core/services/exercise.service'; // We'll need this soon

@Component({
  selector: 'app-workout-builder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule],
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
    // Find the full exercise details from availableExercises if exerciseId is present
    const baseExercise = exerciseData?.exerciseId ? this.availableExercises.find(e => e.id === exerciseData.exerciseId) : null;

    const fg = this.fb.group({
      id: [exerciseData?.id || this.workoutService.generateWorkoutExerciseId()],
      exerciseId: [exerciseData?.exerciseId || '', Validators.required], // ID from Exercise Library
      exerciseName: [exerciseData?.exerciseName || baseExercise?.name || 'Unknown Exercise'], // Display name
      notes: [exerciseData?.notes || ''],
      sets: this.fb.array(
        exerciseData?.sets.map(set => this.createSetFormGroup(set)) || []
      ),
      // Superset related fields can be added here if needed
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

  selectExercise(exercise: Exercise): void { // exercise is from Exercise Library
    const newExerciseFormGroup = this.createExerciseFormGroup({
      id: this.workoutService.generateWorkoutExerciseId(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sets: [ // Add one default set when adding a new exercise
        { id: this.workoutService.generateExerciseSetId(), reps: 8, weight: 0, restAfterSet: 60 }
      ]
    });
    this.exercisesFormArray.push(newExerciseFormGroup);
    this.closeExerciseSelectionModal();
  }

  removeExercise(exerciseIndex: number): void {
    this.exercisesFormArray.removeAt(exerciseIndex);
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

  // --- Form Submission ---
  onSubmit(): void {
    if (this.routineForm.invalid) {
      this.routineForm.markAllAsTouched();
      alert('Please fill in all required fields and correct any errors in exercises/sets.');
      console.log('Form Errors:', this.getFormErrors(this.routineForm));
      return;
    }

    // The form value now directly reflects the structure of our Routine model
    const routinePayload: Routine = {
      id: this.isEditMode && this.currentRoutineId ? this.currentRoutineId : uuidv4(), // Generate new ID if not editing
      ...this.routineForm.value, // This includes name, description, goal, and the exercises array
    };

    // Ensure IDs are present if they were generated by form creation but not explicitly set in value
    // This step might be redundant if createExerciseFormGroup and createSetFormGroup handle IDs correctly
    routinePayload.exercises = routinePayload.exercises.map(ex => ({
      ...ex,
      id: ex.id || this.workoutService.generateWorkoutExerciseId(),
      sets: ex.sets.map(set => ({
        ...set,
        id: set.id || this.workoutService.generateExerciseSetId()
      }))
    }));


    if (this.isEditMode) {
      this.workoutService.updateRoutine(routinePayload);
      console.log('Routine updated:', routinePayload);
    } else {
      this.workoutService.addRoutine(routinePayload); // addRoutine now expects full Routine object if id is handled this way
      console.log('Routine created:', routinePayload);
    }
    this.router.navigate(['/workout']);
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



  ngOnDestroy(): void {
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
  }
}