import { Component, inject, OnInit, signal, computed, ChangeDetectorRef } from '@angular/core'; // Added signal, computed
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common'; // Added TitleCasePipe
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormsModule } from '@angular/forms'; // Added FormsModule
import { format, parseISO } from 'date-fns';

import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog, LoggedWorkoutExercise, LoggedSet } from '../../../core/models/workout-log.model';
import { Routine, WorkoutExercise, ExerciseSetParams } from '../../../core/models/workout.model';
import { Exercise } from '../../../core/models/exercise.model';
import { WorkoutService } from '../../../core/services/workout.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { v4 as uuidv4 } from 'uuid'; // Needed for generating IDs if not linking to plannedSetId

@Component({
  selector: 'app-manual-log-entry',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DatePipe, FormsModule, TitleCasePipe], // Added FormsModule, TitleCasePipe
  templateUrl: './manual-log-entry.html',
  styleUrl: './manual-log-entry.scss',
})
export class ManualLogEntryComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private trackingService = inject(TrackingService);
  private workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  private cdr = inject(ChangeDetectorRef); 

  logForm!: FormGroup;
  availableRoutines: Routine[] = [];
  availableExercises: Exercise[] = [];

  isExerciseModalOpenNew: boolean = false;
  isExerciseModalOpen = signal(false); // Use signal for modal state
  modalSearchTerm = signal('');     // Signal for modal search term

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
    const today = new Date();
    this.logForm = this.fb.group({
      workoutDate: [format(today, 'yyyy-MM-dd'), Validators.required],
      startTime: [format(today, 'HH:mm'), Validators.required],
      routineId: [''],
      routineName: [{ value: '', disabled: true }], // Disable if auto-filled, enable if ad-hoc
      overallNotes: [''],
      durationMinutes: [60, [Validators.min(1), Validators.max(720)]],
      exercises: this.fb.array([], Validators.required),
    });
  }

  ngOnInit(): void {
    this.workoutService.routines$.subscribe(routines => {
      this.availableRoutines = routines;
    });
    this.exerciseService.getExercises().subscribe(exercises => {
      this.availableExercises = exercises;
    });

    this.logForm.get('routineId')?.valueChanges.subscribe(routineId => {
      const routineNameCtrl = this.logForm.get('routineName');
      if (routineId) {
        const selectedRoutine = this.availableRoutines.find(r => r.id === routineId);
        routineNameCtrl?.setValue(selectedRoutine?.name || '');
        routineNameCtrl?.disable(); // Disable when a routine is selected
        if (selectedRoutine) {
          this.prefillExercisesFromRoutine(selectedRoutine);
        }
      } else {
        routineNameCtrl?.setValue('');
        routineNameCtrl?.enable(); // Enable for ad-hoc workout name
        this.exercisesFormArray.clear(); // Clear exercises if routine is deselected
      }
    });
  }

  get exercisesFormArray(): FormArray {
    return this.logForm.get('exercises') as FormArray;
  }

  getSetsFormArray(exerciseControl: any): FormArray {
    return exerciseControl.get('sets') as FormArray;
  }

  createLoggedExerciseFormGroup(exercise?: WorkoutExercise | Exercise, isFromRoutine: boolean = false): FormGroup {
    const baseExerciseDetails = exercise?.id ? this.availableExercises.find(e => e.id === (isFromRoutine ? (exercise as WorkoutExercise).exerciseId : exercise.id)) : null;
    let exerciseNameToUse = 'Unknown Exercise';
    if (isFromRoutine) {
        exerciseNameToUse = (exercise as WorkoutExercise).exerciseName || baseExerciseDetails?.name || 'Unknown Exercise';
    } else {
        exerciseNameToUse = (exercise as Exercise)?.name || 'Unknown Ad-hoc Exercise';
    }

    return this.fb.group({
      exerciseId: [isFromRoutine ? (exercise as WorkoutExercise).exerciseId : exercise?.id || '', Validators.required],
      exerciseName: [exerciseNameToUse, Validators.required],
      notes: [isFromRoutine ? (exercise as WorkoutExercise).notes || '' : ''],
      sets: this.fb.array(
        isFromRoutine && (exercise as WorkoutExercise).sets
          ? (exercise as WorkoutExercise).sets.map(set => this.createLoggedSetFormGroup(undefined, set))
          : [this.createLoggedSetFormGroup()] // Default one empty set for new ad-hoc
      )
    });
  }

  createLoggedSetFormGroup(setData?: LoggedSet, plannedSet?: ExerciseSetParams): FormGroup {
    return this.fb.group({
      plannedSetId: [plannedSet?.id || setData?.plannedSetId], // Store plannedSetId if from routine
      repsAchieved: [setData?.repsAchieved ?? plannedSet?.reps ?? null, [Validators.required, Validators.min(0)]],
      weightUsed: [setData?.weightUsed ?? plannedSet?.weight ?? null, [Validators.min(0)]],
      durationPerformed: [setData?.durationPerformed ?? plannedSet?.duration ?? null, [Validators.min(0)]],
      notes: [setData?.notes || plannedSet?.notes || ''],
      // Store targets from the plan if prefilling from routine
      targetReps: [plannedSet?.reps],
      targetWeight: [plannedSet?.weight],
      targetDuration: [plannedSet?.duration],
    });
  }

  openExerciseSelectionModal(): void {
    this.modalSearchTerm.set(''); // Reset search on open
    // this.isExerciseModalOpen.set(true);
    this.isExerciseModalOpenNew = true;
  }

 closeExerciseSelectionModal(): void {
    console.log('Attempting to set isExerciseModalOpen to false'); // Confirm this runs
    // this.isExerciseModalOpen.set(false);
    this.isExerciseModalOpenNew = false;
    // Explicitly tell Angular to check for changes
    this.cdr.detectChanges(); // <<<< ADD THIS LINE
  }

  // Method to handle search term changes in the modal
  onModalSearchTermChange(term: string): void {
    this.modalSearchTerm.set(term.toLowerCase());
  }

 selectExerciseToAdd(exerciseFromLibrary: Exercise): void {
    console.log('Closing modal via selectExerciseToAdd'); // Your existing log
    this.exercisesFormArray.push(this.createLoggedExerciseFormGroup(exerciseFromLibrary, false));
    this.closeExerciseSelectionModal(); // This will now trigger detectChanges
  }

  removeExercise(exerciseIndex: number): void {
    this.exercisesFormArray.removeAt(exerciseIndex);
  }

  addSet(exerciseControl: any): void {
    this.getSetsFormArray(exerciseControl).push(this.createLoggedSetFormGroup());
  }

  removeSet(exerciseControl: any, setIndex: number): void {
    this.getSetsFormArray(exerciseControl).removeAt(setIndex);
  }

  prefillExercisesFromRoutine(routine: Routine): void {
    this.exercisesFormArray.clear();
    routine.exercises.forEach(routineEx => {
      this.exercisesFormArray.push(this.createLoggedExerciseFormGroup(routineEx, true));
    });
  }

  onSubmit(): void {
    if (this.logForm.invalid) {
      this.logForm.markAllAsTouched();
      alert('Please fill in all required fields and ensure exercises have at least one set with valid data.');
      return;
    }

    const formValue = this.logForm.value;

    const workoutDate = parseISO(formValue.workoutDate);
    const [hours, minutes] = formValue.startTime.split(':').map(Number);
    workoutDate.setHours(hours, minutes, 0, 0);
    const startTimeMs = workoutDate.getTime();

    const workoutToEndTime = new Date(startTimeMs);
    let endTimeMs: number | undefined = undefined;
    let durationMins: number | undefined = formValue.durationMinutes || undefined;

    if (durationMins) {
        workoutToEndTime.setMinutes(workoutToEndTime.getMinutes() + durationMins);
        endTimeMs = workoutToEndTime.getTime();
    }


    const workoutLogData: Omit<WorkoutLog, 'id'> = {
      date: format(workoutDate, 'yyyy-MM-dd'),
      startTime: startTimeMs,
      endTime: endTimeMs,
      durationMinutes: durationMins,
      routineId: formValue.routineId || undefined,
      // Use the disabled routineName if a routine was selected, otherwise use the input (if enabled)
      routineName: this.logForm.get('routineName')?.value || (formValue.routineId ? 'Selected Routine' : 'Ad-hoc Workout'),
      notes: formValue.overallNotes,
      exercises: formValue.exercises.map((exInput: any) => ({
        exerciseId: exInput.exerciseId,
        exerciseName: exInput.exerciseName,
        notes: exInput.notes,
        sets: exInput.sets.map((setInput: any) => ({
          id: uuidv4(), // Each logged set should have its own unique ID
          plannedSetId: setInput.plannedSetId, // This comes from prefill if routine was selected
          exerciseId: exInput.exerciseId,
          repsAchieved: setInput.repsAchieved,
          weightUsed: setInput.weightUsed,
          durationPerformed: setInput.durationPerformed,
          notes: setInput.notes,
          targetReps: setInput.targetReps,
          targetWeight: setInput.targetWeight,
          targetDuration: setInput.targetDuration,
          timestamp: new Date().toISOString(),
        } as LoggedSet))
      } as LoggedWorkoutExercise))
    };

    this.trackingService.addWorkoutLog(workoutLogData);
    alert('Past workout session logged successfully!');
    this.router.navigate(['/history/list']);
  }

  get f() { return this.logForm.controls; }
}