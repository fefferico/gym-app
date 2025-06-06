import { Component, inject, OnInit, signal, computed, ChangeDetectorRef, Input } from '@angular/core'; // Added Input
import { CommonModule, DatePipe, TitleCasePipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router'; // Added ActivatedRoute
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray, FormsModule } from '@angular/forms';
import { format, parseISO, formatISO } from 'date-fns'; // Added formatISO

import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog, LoggedWorkoutExercise, LoggedSet } from '../../../core/models/workout-log.model';
import { Routine, WorkoutExercise as RoutineExerciseDef, ExerciseSetParams } from '../../../core/models/workout.model'; // Renamed WorkoutExercise to avoid conflict
import { Exercise } from '../../../core/models/exercise.model';
import { WorkoutService } from '../../../core/services/workout.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { v4 as uuidv4 } from 'uuid';
import { switchMap, take, tap } from 'rxjs/operators'; // For fetching log in edit mode
import { of } from 'rxjs'; // For fetching log in edit mode
import { AlertService } from '../../../core/services/alert.service';


@Component({
  selector: 'app-manual-log-entry',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule, TitleCasePipe],
  templateUrl: './manual-log-entry.html',
  styleUrl: './manual-log-entry.scss',
})
export class ManualLogEntryComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute); // For reading route params in edit mode
  private trackingService = inject(TrackingService);
  private workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  private cdr = inject(ChangeDetectorRef);
  private alertService = inject(AlertService);


  logForm!: FormGroup;
  availableRoutines: Routine[] = [];
  availableExercises: Exercise[] = [];

  isExerciseModalOpen = false;
  modalSearchTerm = signal('');

  // --- EDIT MODE ---
  isEditMode = signal(false);
  editingLogId: string | null = null;
  // --- END EDIT MODE ---

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
    // Initialize form structure here, actual values will be patched in ngOnInit
    this.logForm = this.fb.group({
      workoutDate: ['', Validators.required],
      startTime: ['', Validators.required],
      routineId: [''],
      routineName: [{ value: '', disabled: true }],
      overallNotes: [''],
      durationMinutes: [60, [Validators.min(1), Validators.max(720)]],
      exercises: this.fb.array([], Validators.required),
    });
  }

  ngOnInit(): void {
    this.workoutService.routines$.subscribe(routines => this.availableRoutines = routines);
    this.exerciseService.getExercises().subscribe(exercises => this.availableExercises = exercises);

    this.activatedRoute.paramMap.pipe(
      switchMap(params => {
        this.editingLogId = params.get('logId');
        if (this.editingLogId) {
          this.isEditMode.set(true);
          return this.trackingService.getWorkoutLogById(this.editingLogId);
        }
        return of(null); // For new entry mode
      }),
      take(1) // Ensure this subscription completes after the first emission
    ).subscribe(logToEdit => {
      if (logToEdit && this.isEditMode()) {
        this.patchFormForEditing(logToEdit);
      } else {
        // New entry mode
        const today = new Date();
        this.logForm.patchValue({
          workoutDate: format(today, 'yyyy-MM-dd'),
          startTime: format(today, 'HH:mm'),
          durationMinutes: 60
        });
      }
    });

    // Routine ID change listener (remains mostly the same)
    this.logForm.get('routineId')?.valueChanges.subscribe(routineId => {
      if (this.isEditMode() && this.logForm.get('routineId')?.pristine) {
        // In edit mode, if routineId is changed from its initial loaded value,
        // it might mean the user wants to re-associate or de-associate.
        // For now, we keep it simple: if they change it, the prefill logic runs.
      }

      const routineNameCtrl = this.logForm.get('routineName');
      if (routineId) {
        const selectedRoutine = this.availableRoutines.find(r => r.id === routineId);
        routineNameCtrl?.setValue(selectedRoutine?.name || '');
        routineNameCtrl?.disable();
        // Only prefill exercises if NOT in edit mode, or if user *explicitly* changes routine in edit mode.
        // If just loading an existing log, exercises are patched from the log itself.
        if (!this.isEditMode() || (this.isEditMode() && !this.logForm.get('routineId')?.pristine)) {
          if (selectedRoutine) this.prefillExercisesFromRoutine(selectedRoutine);
        }

      } else {
        routineNameCtrl?.setValue('');
        routineNameCtrl?.enable();
        if (!this.isEditMode() || (this.isEditMode() && !this.logForm.get('routineId')?.pristine)) {
          this.exercisesFormArray.clear();
        }
      }
    });
  }

  patchFormForEditing(log: WorkoutLog): void {
    this.logForm.patchValue({
      workoutDate: format(new Date(log.startTime), 'yyyy-MM-dd'),
      startTime: format(new Date(log.startTime), 'HH:mm'),
      routineId: log.routineId || '',
      routineName: log.routineName || '', // Will be updated by routineId listener if routineId exists
      overallNotes: log.notes || '',
      durationMinutes: log.durationMinutes || 60,
    });

    this.exercisesFormArray.clear();
    log.exercises.forEach(loggedEx => {
      this.exercisesFormArray.push(this.createLoggedExerciseFormGroupFromLog(loggedEx));
    });

    if (log.routineId) {
      this.logForm.get('routineName')?.disable();
    } else {
      this.logForm.get('routineName')?.enable();
    }
    this.logForm.markAsPristine(); // Mark as pristine after patching
  }

  createLoggedExerciseFormGroupFromLog(loggedEx: LoggedWorkoutExercise): FormGroup {
    return this.fb.group({
      exerciseId: [loggedEx.exerciseId, Validators.required],
      exerciseName: [loggedEx.exerciseName, Validators.required], // Comes directly from log
      notes: [loggedEx.notes || ''],
      sets: this.fb.array(
        loggedEx.sets.map(set => this.createLoggedSetFormGroup(set)) // Pass LoggedSet here
      )
    });
  }


  get exercisesFormArray(): FormArray {
    return this.logForm.get('exercises') as FormArray;
  }

  getSetsFormArray(exerciseControl: any): FormArray {
    return exerciseControl.get('sets') as FormArray;
  }

  // createLoggedExerciseFormGroup needs to distinguish between new ad-hoc, routine prefill, and edit mode
  createLoggedExerciseFormGroup(
    exerciseSource?: RoutineExerciseDef | Exercise, // Can be from routine or a base Exercise
    isFromRoutinePrefill: boolean = false // True if prefilling from a selected routine in "new log" mode
  ): FormGroup {
    let exerciseIdToUse = '';
    let exerciseNameToUse = 'Select Exercise';
    let exerciseNotesToUse = '';
    let setsToCreate: FormGroup[] = [this.createLoggedSetFormGroup()]; // Default for new ad-hoc

    if (exerciseSource) {
      if (isFromRoutinePrefill) { // Prefilling from a selected Routine in NEW LOG mode
        const routineEx = exerciseSource as RoutineExerciseDef;
        exerciseIdToUse = routineEx.exerciseId;
        const baseDetails = this.availableExercises.find(e => e.id === routineEx.exerciseId);
        exerciseNameToUse = routineEx.exerciseName || baseDetails?.name || 'Unknown Exercise';
        exerciseNotesToUse = routineEx.notes || '';
        setsToCreate = routineEx.sets.map(plannedSet => this.createLoggedSetFormGroup(undefined, plannedSet));
      } else { // Adding a new ad-hoc exercise (not from routine prefill)
        const baseEx = exerciseSource as Exercise;
        exerciseIdToUse = baseEx.id;
        exerciseNameToUse = baseEx.name;
        // setsToCreate remains the default one empty set
      }
    }

    return this.fb.group({
      exerciseId: [exerciseIdToUse, Validators.required],
      exerciseName: [exerciseNameToUse, Validators.required],
      notes: [exerciseNotesToUse],
      sets: this.fb.array(setsToCreate.length > 0 ? setsToCreate : [this.createLoggedSetFormGroup()])
    });
  }


  createLoggedSetFormGroup(setData?: LoggedSet, plannedSet?: ExerciseSetParams): FormGroup {
    // If setData (from an existing log) is provided, it takes precedence.
    // If plannedSet (from routine prefill) is provided, it's used as a base for a new log entry.
    return this.fb.group({
      id: [setData?.id || uuidv4()], // Keep existing ID if editing, else new for new sets
      plannedSetId: [setData?.plannedSetId || plannedSet?.id],
      repsAchieved: [setData?.repsAchieved ?? plannedSet?.reps ?? null, [Validators.required, Validators.min(0)]],
      weightUsed: [setData?.weightUsed ?? plannedSet?.weight ?? null, [Validators.min(0)]],
      durationPerformed: [setData?.durationPerformed ?? plannedSet?.duration ?? null, [Validators.min(0)]],
      notes: [setData?.notes || plannedSet?.notes || ''],
      targetReps: [setData?.targetReps ?? plannedSet?.reps], // Preserve target if editing, or from plan
      targetWeight: [setData?.targetWeight ?? plannedSet?.weight],
      targetDuration: [setData?.targetDuration ?? plannedSet?.duration],
      timestamp: [setData?.timestamp || new Date().toISOString()] // Keep original timestamp if editing
    });
  }

  openExerciseSelectionModal(): void {
    this.modalSearchTerm.set(''); // Reset search on open
    // this.isExerciseModalOpen.set(true);
    this.isExerciseModalOpen = true;
  }
  closeExerciseSelectionModal(): void {
    console.log('Attempting to set isExerciseModalOpen to false'); // Confirm this runs
    // this.isExerciseModalOpen.set(false);
    this.isExerciseModalOpen = false;
    // Explicitly tell Angular to check for changes
    this.cdr.detectChanges(); // <<<< ADD THIS LINE
  }
  onModalSearchTermChange(event: Event): void { // << MODIFIED to take Event
    const inputElement = event.target as HTMLInputElement;
    this.modalSearchTerm.set(inputElement.value);
  }

  selectExerciseToAdd(exerciseFromLibrary: Exercise): void {
    this.exercisesFormArray.push(this.createLoggedExerciseFormGroup(exerciseFromLibrary, false));
    this.closeExerciseSelectionModal();
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
      // Pass true for isFromRoutinePrefill
      this.exercisesFormArray.push(this.createLoggedExerciseFormGroup(routineEx, true));
    });
  }

  async onSubmit(): Promise<void> {
    if (this.logForm.invalid) {
      this.logForm.markAllAsTouched();
      this.alertService.showAlert('Error', 'Please fill in all required fields and ensure exercises have at least one set with valid data.');
      return;
    }

    const formValue = this.logForm.value;

    const workoutDateStr = formValue.workoutDate; // Should be 'yyyy-MM-dd'
    const startTimeStr = formValue.startTime;   // Should be 'HH:mm'

    // Combine date and time strings then parse
    const combinedDateTimeStr = `${workoutDateStr}T${startTimeStr}:00`; // Add seconds for full ISO
    const startTimeMs = parseISO(combinedDateTimeStr).getTime();


    const workoutToEndTime = new Date(startTimeMs);
    let endTimeMs: number | undefined = undefined;
    let durationMins: number | undefined = formValue.durationMinutes || undefined;

    if (durationMins) {
      workoutToEndTime.setMinutes(workoutToEndTime.getMinutes() + durationMins);
      endTimeMs = workoutToEndTime.getTime();
    }


    const workoutLogDataSharedPart = {
      date: format(parseISO(combinedDateTimeStr), 'yyyy-MM-dd'),
      startTime: startTimeMs,
      endTime: endTimeMs,
      durationMinutes: durationMins,
      routineId: formValue.routineId || undefined,
      routineName: this.logForm.get('routineName')?.value || (formValue.routineId ? 'Selected Routine' : 'Ad-hoc Workout'),
      notes: formValue.overallNotes,
      exercises: formValue.exercises.map((exInput: any) => ({
        exerciseId: exInput.exerciseId,
        exerciseName: exInput.exerciseName,
        notes: exInput.notes,
        sets: exInput.sets.map((setInput: any) => ({
          id: setInput.id || uuidv4(), // Keep existing ID if editing, else new
          plannedSetId: setInput.plannedSetId,
          exerciseId: exInput.exerciseId, // Ensure this is present
          repsAchieved: setInput.repsAchieved,
          weightUsed: setInput.weightUsed,
          durationPerformed: setInput.durationPerformed,
          notes: setInput.notes,
          targetReps: setInput.targetReps,
          targetWeight: setInput.targetWeight,
          targetDuration: setInput.targetDuration,
          timestamp: setInput.timestamp || new Date().toISOString(), // Keep original if editing
        } as LoggedSet))
      } as LoggedWorkoutExercise))
    };

    if (this.isEditMode() && this.editingLogId) {
      const updatedLog: WorkoutLog = {
        ...workoutLogDataSharedPart,
        id: this.editingLogId, // Crucial: use the ID of the log being edited
      };
      try {
        await this.trackingService.updateWorkoutLog(updatedLog); // Assumes this method exists and is async
        this.alertService.showAlert('Success', 'Workout log updated successfully!');
        this.router.navigate(['/history/log', this.editingLogId]); // Navigate back to detail view
      } catch (error) {
        console.error("Error updating workout log:", error);
        this.alertService.showAlert('Error', 'Failed to update workout log.');
      }
    } else {
      const newLog: Omit<WorkoutLog, 'id'> = workoutLogDataSharedPart;
      this.trackingService.addWorkoutLog(newLog);
      this.alertService.showAlert('Success', 'Past workout session logged successfully!');
      this.router.navigate(['/history/list']);
    }
  }

  get f() { return this.logForm.controls; }
}