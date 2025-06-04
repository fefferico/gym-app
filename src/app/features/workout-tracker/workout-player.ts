import { Component, inject, OnInit, OnDestroy, signal, computed, WritableSignal } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, Observable, of, timer } from 'rxjs';
import { switchMap, tap, map, takeWhile, take } from 'rxjs/operators';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms'; // Add FormBuilder, FormGroup, Validators, ReactiveFormsModule


import { Routine, WorkoutExercise, ExerciseSetParams } from '../../core/models/workout.model';
import { Exercise } from '../../core/models/exercise.model'; // To fetch full exercise details
import { WorkoutService } from '../../core/services/workout.service';
import { ExerciseService } from '../../core/services/exercise.service';
import { LastPerformanceSummary, TrackingService } from '../../core/services/tracking.service'; // For saving at the end
import { LoggedSet, LoggedWorkoutExercise, WorkoutLog } from '../../core/models/workout-log.model'; // For constructing the log

// Interface to manage the state of the currently active set/exercise
interface ActiveSetInfo {
  exerciseIndex: number;
  setIndex: number;
  exerciseData: WorkoutExercise; // From the routine
  setData: ExerciseSetParams;    // From the routine
  baseExerciseInfo?: Exercise;    // Full details from ExerciseService
  isCompleted: boolean;
  actualReps?: number;
  actualWeight?: number;
  actualDuration?: number;
  notes?: string;
}

enum TimedSetState {
  Idle = 'idle', // Not started or reset
  Running = 'running',
  Paused = 'paused',
}

@Component({
  selector: 'app-workout-player',
  standalone: true,
  imports: [CommonModule, RouterLink, TitleCasePipe, DatePipe, ReactiveFormsModule, FormsModule],
  templateUrl: './workout-player.html',
  styleUrl: './workout-player.scss',
})
export class WorkoutPlayerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  protected trackingService = inject(TrackingService);
  private fb = inject(FormBuilder); // Inject FormBuilder

  currentSetForm!: FormGroup;

  routineId: string | null = null;
  routine = signal<Routine | null | undefined>(undefined); // undefined: loading, null: not found or error

  currentExerciseIndex = signal(0);
  currentSetIndex = signal(0);

  // Holds the performance data for the current workout session being built up
  private currentWorkoutLogExercises = signal<LoggedWorkoutExercise[]>([]);
  private workoutStartTime: number = 0;

  private routeSub: Subscription | undefined;
  private timerSub: Subscription | undefined;
  private restTimerSub: Subscription | undefined;

  sessionTimerDisplay = signal('00:00:00');
  restTimerDisplay = signal<string | null>(null);
  isResting = signal(false);

  // Computed signal for the currently active set/exercise details
  activeSetInfo = computed<ActiveSetInfo | null>(() => {
    const r = this.routine();
    const exIndex = this.currentExerciseIndex();
    const sIndex = this.currentSetIndex();

    if (r && r.exercises[exIndex] && r.exercises[exIndex].sets[sIndex]) {
      const exerciseData = r.exercises[exIndex];
      const setData = r.exercises[exIndex].sets[sIndex];
      // Find if this set was already "completed" in the current session attempt
      const completedExerciseLog = this.currentWorkoutLogExercises().find(logEx => logEx.exerciseId === exerciseData.exerciseId);
      const completedSetLog = completedExerciseLog?.sets.find(logSet => logSet.plannedSetId === setData.id);

      return {
        exerciseIndex: exIndex,
        setIndex: sIndex,
        exerciseData: exerciseData,
        setData: setData,
        baseExerciseInfo: undefined, // Will be loaded async
        isCompleted: !!completedSetLog, // Check if already logged in this session
        actualReps: completedSetLog?.repsAchieved,
        actualWeight: completedSetLog?.weightUsed,
        actualDuration: completedSetLog?.durationPerformed,
        notes: completedSetLog?.notes,
      };
    }
    return null;
  });

  // Computed signal for the full Exercise details of the current exercise
  currentBaseExercise = signal<Exercise | null | undefined>(undefined);

  timedSetTimerState = signal<TimedSetState>(TimedSetState.Idle);
  timedSetElapsedSeconds = signal(0);
  private timedSetIntervalSub: Subscription | undefined; // Subscription for the interval timer of a timed set

  // Computed signal for the PREVIOUSLY LOGGED set of the CURRENT exercise in THIS session
  allPreviousLoggedSetsForCurrentExercise = computed<LoggedSet[]>(() => {
    const activeInfo = this.activeSetInfo();
    if (!activeInfo || activeInfo.setIndex === 0) { // No previous sets if it's the first set
      return [];
    }

    // Find the current exercise in our temporary log of completed sets for this session
    const loggedExerciseContainer = this.currentWorkoutLogExercises()
      .find(exLog => exLog.exerciseId === activeInfo.exerciseData.exerciseId);

    if (loggedExerciseContainer && loggedExerciseContainer.sets.length > 0) {
      // We want to get all logged sets that correspond to planned sets *before* the current activeSet.setIndex
      const previousLoggedSets: LoggedSet[] = [];
      for (let i = 0; i < activeInfo.setIndex; i++) { // Iterate up to, but not including, the current set index
        const plannedSetIdForPrevious = activeInfo.exerciseData.sets[i]?.id;
        if (plannedSetIdForPrevious) {
          const foundLoggedSet = loggedExerciseContainer.sets.find(ls => ls.plannedSetId === plannedSetIdForPrevious);
          if (foundLoggedSet) {
            previousLoggedSets.push(foundLoggedSet);
          }
        }
      }
      return previousLoggedSets;
    }
    return [];
  });

  protected lastPerformanceForCurrentExercise: LastPerformanceSummary | null = null;

  // --- State for on-the-fly target editing ---
  editingTarget: 'reps' | 'weight' | 'duration' | null = null;
  editingTargetValue: number | string = ''; // string to handle potential empty input before parsing

  constructor() { // No need to inject FormBuilder here if using inject() for properties
    this.initializeCurrentSetForm(); // Initialize the form structure
  }

  ngOnInit(): void {
    this.workoutStartTime = Date.now();
    this.startSessionTimer();

    this.routeSub = this.route.paramMap.pipe(
      switchMap(params => {
        this.routineId = params.get('routineId');
        if (this.routineId) {
          return this.workoutService.getRoutineById(this.routineId);
        }
        return of(null);
      }),
      tap(loadedRoutine => {
        if (loadedRoutine) {
          this.routine.set(loadedRoutine);
          // Initial setup when routine loads
          this.fetchLastPerformanceAndPatchForm(); // Modified call
          this.loadBaseExerciseDetailsForCurrent();
        } else {
          this.routine.set(null);
          console.error('WorkoutPlayer: Routine not found or ID missing.');
        }
      })
    ).subscribe();
  }

  private initializeCurrentSetForm(): void {
    this.currentSetForm = this.fb.group({
      actualReps: [null as number | null, [Validators.min(0)]],
      actualWeight: [null as number | null, [Validators.min(0)]],
      actualDuration: [null as number | null, [Validators.min(0)]],
      setNotes: [''],
      // Hidden fields to hold target values if needed for display or logic, but not strictly necessary for submission
      // targetReps: [null],
      // targetWeight: [null],
      // targetDuration: [null],
    });
  }

  private resetAndPatchCurrentSetForm(): void {
    this.currentSetForm.reset();
    const activeInfo = this.activeSetInfo();

    // Reset timed set state whenever a new set becomes active
    this.resetTimedSet();

    if (activeInfo) {
      // Pre-fill with target values as placeholders or actuals if re-doing a set
      const completedExerciseLog = this.currentWorkoutLogExercises().find(logEx => logEx.exerciseId === activeInfo.exerciseData.exerciseId);
      const completedSetLog = completedExerciseLog?.sets.find(logSet => logSet.plannedSetId === activeInfo.setData.id);

      if (completedSetLog) { // If re-doing a set, pre-fill with previously logged actuals
        this.currentSetForm.patchValue({
          actualReps: completedSetLog.repsAchieved,
          actualWeight: completedSetLog.weightUsed,
          actualDuration: completedSetLog.durationPerformed,
          setNotes: completedSetLog.notes,
        });
      } else { // New set for this session, pre-fill with targets as a suggestion
        this.currentSetForm.patchValue({
          actualReps: activeInfo.setData.reps ?? null,
          actualWeight: activeInfo.setData.weight ?? null,
          actualDuration: activeInfo.setData.duration ?? null,
          setNotes: '', // Or activeInfo.setData.notes if it's a general set note
        });
      }

      // If the current set is primarily duration-based, pre-fill actualDuration from target
      // and potentially auto-start timer or prepare it.
      // For now, we will rely on user clicking "Start Timer"
      if (activeInfo.setData.duration && !activeInfo.setData.reps && !activeInfo.setData.weight) {
        // This suggests it's primarily a timed set.
        // You might want to auto-populate actualDuration with targetDuration here.
        this.currentSetForm.get('actualDuration')?.setValue(activeInfo.setData.duration);
      }
    }
  }

  private loadBaseExerciseDetailsForCurrent(): void {
    const activeInfo = this.activeSetInfo();
    if (activeInfo && activeInfo.exerciseData.exerciseId) {
      this.currentBaseExercise.set(undefined); // Show loading for base exercise
      this.exerciseService.getExerciseById(activeInfo.exerciseData.exerciseId).subscribe(ex => {
        this.currentBaseExercise.set(ex || null);
      });
    } else {
      this.currentBaseExercise.set(null);
    }
  }

  private startSessionTimer(): void {
    this.timerSub = timer(0, 1000).pipe(
      map(() => Math.floor((Date.now() - this.workoutStartTime) / 1000))
    ).subscribe(elapsedSeconds => {
      const hours = Math.floor(elapsedSeconds / 3600);
      const minutes = Math.floor((elapsedSeconds % 3600) / 60);
      const seconds = elapsedSeconds % 60;
      this.sessionTimerDisplay.set(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    });
  }

  startRestTimer(durationSeconds: number): void {
    if (this.restTimerSub) {
      this.restTimerSub.unsubscribe();
    }
    this.isResting.set(true);
    let remaining = durationSeconds;
    this.updateRestTimerDisplay(remaining);

    this.restTimerSub = timer(0, 1000).pipe(
      takeWhile(() => remaining >= 0)
    ).subscribe(() => {
      this.updateRestTimerDisplay(remaining);
      if (remaining === 0) {
        this.isResting.set(false);
        // Optional: Play a sound
      }
      remaining--;
    });
  }

  private updateRestTimerDisplay(seconds: number): void {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    this.restTimerDisplay.set(`${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
  }

  skipRest(): void {
    if (this.restTimerSub) {
      this.restTimerSub.unsubscribe();
    }
    this.isResting.set(false);
    this.restTimerDisplay.set(null);
  }

  // --- Core Navigation and Completion Logic ---
  // This will be expanded significantly
  completeSetAndProceed(): void {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    if (!activeInfo || !routine) return;

    // If the current set was a timed set and the timer was running/paused, stop it.
    // The actualDuration will be taken from the form.
    if (activeInfo.setData.duration && (this.timedSetTimerState() === TimedSetState.Running || this.timedSetTimerState() === TimedSetState.Paused)) {
      this.stopAndLogTimedSet();
    }

    if (this.currentSetForm.invalid) {
      this.currentSetForm.markAllAsTouched();
      alert('Please correct the input values for the current set.');
      return;
    }
    const formValues = this.currentSetForm.value;
    const loggedSetData: LoggedSet = {
      id: activeInfo.setData.id,
      plannedSetId: activeInfo.setData.id,
      exerciseId: activeInfo.exerciseData.exerciseId,
      repsAchieved: formValues.actualReps ?? activeInfo.setData.reps ?? 0,
      weightUsed: formValues.actualWeight ?? activeInfo.setData.weight,
      durationPerformed: activeInfo.setData.duration ? (formValues.actualDuration ?? 0) : undefined,
      targetReps: activeInfo.setData.reps,
      targetWeight: activeInfo.setData.weight,
      targetDuration: activeInfo.setData.duration,
      targetTempo: activeInfo.setData.tempo,
      notes: formValues.setNotes || undefined,
      timestamp: new Date().toISOString(),
    };
    this.addLoggedSetToCurrentLog(activeInfo.exerciseData, loggedSetData);

    if (activeInfo.setData.restAfterSet > 0 && !this.isResting()) {
      this.startRestTimer(activeInfo.setData.restAfterSet);
    }

    // Reset timed set state for the next set
    this.resetTimedSet(); // Important to reset here before form patching
    this.navigateToNextStepInWorkout(activeInfo, routine); // Use new navigation method
  }

  private addLoggedSetToCurrentLog(exerciseData: WorkoutExercise, loggedSet: LoggedSet): void {
    const logs = this.currentWorkoutLogExercises();
    let exerciseLog = logs.find(exLog => exLog.exerciseId === exerciseData.exerciseId);

    if (exerciseLog) {
      // Add set to existing logged exercise, ensuring no duplicates by plannedSetId for this session
      const existingSetIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === loggedSet.plannedSetId);
      if (existingSetIndex > -1) {
        exerciseLog.sets[existingSetIndex] = loggedSet; // Update if re-doing a set
      } else {
        exerciseLog.sets.push(loggedSet);
      }
    } else {
      // New exercise for this log
      exerciseLog = {
        exerciseId: exerciseData.exerciseId,
        exerciseName: exerciseData.exerciseName || 'Unknown Exercise', // Get from baseExercise if available
        sets: [loggedSet]
      };
      this.currentWorkoutLogExercises.set([...logs, exerciseLog]);
    }
  }


  finishWorkout(): void {
    if (this.timerSub) this.timerSub.unsubscribe(); // Stop session timer
    if (this.restTimerSub) this.restTimerSub.unsubscribe(); // Stop rest timer

    const routine = this.routine();
    const endTime = Date.now();
    const durationMinutes = Math.round((endTime - this.workoutStartTime) / (1000 * 60));

    const finalLog: Omit<WorkoutLog, 'id'> = {
      routineId: this.routineId || undefined,
      routineName: routine?.name || 'Ad-hoc Workout',
      date: new Date(this.workoutStartTime).toISOString(),
      startTime: this.workoutStartTime,
      endTime: endTime,
      durationMinutes: durationMinutes,
      exercises: this.currentWorkoutLogExercises(),
      // overallNotes: get from a form field
    };

    this.trackingService.addWorkoutLog(finalLog);
    alert('Workout Finished and Logged!'); // Replace with better UX
    this.router.navigate(['/history']); // Or back to /workout
  }


  quitWorkout(): void {
    const confirmQuit = confirm('Are you sure you want to quit this workout? Progress will not be saved.');
    if (confirmQuit) {
      if (this.timerSub) this.timerSub.unsubscribe();
      if (this.restTimerSub) this.restTimerSub.unsubscribe();
      this.router.navigate(['/workout']);
    }
  }

  // Helper for template to access form controls
  get csf() { // csf for CurrentSetForm
    return this.currentSetForm.controls;
  }

  toggleTimedSetTimer(): void {
    const currentState = this.timedSetTimerState();
    if (currentState === TimedSetState.Idle || currentState === TimedSetState.Paused) {
      this.startOrResumeTimedSet();
    } else if (currentState === TimedSetState.Running) {
      this.pauseTimedSet();
    }
  }

  private startOrResumeTimedSet(): void {
    this.timedSetTimerState.set(TimedSetState.Running);
    if (this.timedSetIntervalSub) {
      this.timedSetIntervalSub.unsubscribe(); // Should not happen if logic is correct, but good practice
    }

    this.timedSetIntervalSub = timer(0, 1000).subscribe(() => {
      this.timedSetElapsedSeconds.update(s => s + 1);
      // Update the form control for actualDuration as the timer runs
      this.currentSetForm.get('actualDuration')?.setValue(this.timedSetElapsedSeconds());
    });
  }

  private pauseTimedSet(): void {
    if (this.timedSetIntervalSub) {
      this.timedSetIntervalSub.unsubscribe();
      this.timedSetIntervalSub = undefined;
    }
    this.timedSetTimerState.set(TimedSetState.Paused);
  }

  resetTimedSet(): void {
    if (this.timedSetIntervalSub) {
      this.timedSetIntervalSub.unsubscribe();
      this.timedSetIntervalSub = undefined;
    }
    this.timedSetTimerState.set(TimedSetState.Idle);
    this.timedSetElapsedSeconds.set(0);
    // Also reset the form field if desired, or let it keep the last value
    // this.currentSetForm.get('actualDuration')?.setValue(0);
  }

  // Call this when the "Complete Set & Rest" button is pressed
  // or if the timed set reaches its target duration (optional auto-stop)
  stopAndLogTimedSet(): void {
    if (this.timedSetTimerState() === TimedSetState.Running || this.timedSetTimerState() === TimedSetState.Paused) {
      this.pauseTimedSet(); // Ensure timer is stopped
      // The actualDuration form control should already have the elapsed seconds
      // No need to explicitly set it here unless you want to round or finalize it.
      // this.currentSetForm.get('actualDuration')?.setValue(this.timedSetElapsedSeconds());
      // console.log(`Timed set stopped. Logged duration: ${this.timedSetElapsedSeconds()}s`);
    }
    // The value from currentSetForm.get('actualDuration') will be used in completeSetAndProceed
  }

  // Inside WorkoutPlayerComponent class

  // ... (other properties and methods) ...

  checkIfLatestSetOfLatestExercise(): boolean {
    const routine = this.routine(); // Get the current routine from the signal
    const activeInfo = this.activeSetInfo(); // Get the current active set info

    // 1. Check if routine or activeInfo is available
    if (!routine || !activeInfo) {
      // console.log('checkIfLatest: Routine or activeInfo not available');
      return false; // Cannot determine if routine or active set isn't loaded
    }

    // 2. Check if it's the last exercise
    const isLastExercise = activeInfo.exerciseIndex === routine.exercises.length - 1;
    if (!isLastExercise) {
      // console.log('checkIfLatest: Not the last exercise');
      return false; // Not the last exercise, so definitely not the last set of the last exercise
    }

    // 3. If it IS the last exercise, check if it's the last set of that exercise
    const currentExerciseData = routine.exercises[activeInfo.exerciseIndex];
    const isLastSetOfCurrentExercise = activeInfo.setIndex === currentExerciseData.sets.length - 1;

    // console.log(`checkIfLatest: LastExercise=${isLastExercise}, LastSet=${isLastSetOfCurrentExercise}`);
    return isLastSetOfCurrentExercise; // True only if it's the last set of the last exercise
  }

  // Renamed and enhanced
  private async fetchLastPerformanceAndPatchForm(): Promise<void> {
    const activeInfo = this.activeSetInfo();
    if (!activeInfo) {
      this.currentSetForm.reset(); // Reset if no active set
      this.resetTimedSet();
      return;
    }

    // Fetch last performance for the current exercise if it has changed or not yet fetched
    // This check helps avoid re-fetching for every set of the same exercise
    if (!this.lastPerformanceForCurrentExercise || this.lastPerformanceForCurrentExercise.sets[0]?.exerciseId !== activeInfo.exerciseData.exerciseId) {
      try {
        this.lastPerformanceForCurrentExercise = await new Promise<LastPerformanceSummary | null>((resolve) => {
          this.trackingService.getLastPerformanceForExercise(activeInfo.exerciseData.exerciseId)
            .pipe(take(1)) // Ensure observable completes
            .subscribe(perf => resolve(perf));
        });
      } catch (error) {
        console.error("Error fetching last performance:", error);
        this.lastPerformanceForCurrentExercise = null;
      }
    }
    this.patchCurrentSetFormWithData(activeInfo);
  }

  private patchCurrentSetFormWithData(activeInfo: ActiveSetInfo): void {
    this.currentSetForm.reset();
    this.resetTimedSet();

    // 1. Check if this set was already logged in the *current session* (for re-doing a set)
    const completedExerciseLog = this.currentWorkoutLogExercises().find(logEx => logEx.exerciseId === activeInfo.exerciseData.exerciseId);
    const completedSetLogThisSession = completedExerciseLog?.sets.find(logSet => logSet.plannedSetId === activeInfo.setData.id);

    if (completedSetLogThisSession) {
      this.currentSetForm.patchValue({
        actualReps: completedSetLogThisSession.repsAchieved,
        actualWeight: completedSetLogThisSession.weightUsed,
        actualDuration: completedSetLogThisSession.durationPerformed,
        setNotes: completedSetLogThisSession.notes,
      });
      return; // Prioritize current session's log for this set
    }

    // 2. If not logged this session, try to pre-fill from *last historical performance*
    const previousHistoricalSet = this.trackingService.findPreviousSetPerformance(
      this.lastPerformanceForCurrentExercise,
      activeInfo.setData,
      activeInfo.setIndex
    );

    if (previousHistoricalSet) {
      this.currentSetForm.patchValue({
        // Pre-fill with ACHIEVED values from last time as the new TARGET/SUGGESTION
        actualReps: previousHistoricalSet.repsAchieved ?? activeInfo.setData.reps ?? null,
        actualWeight: previousHistoricalSet.weightUsed ?? activeInfo.setData.weight ?? null,
        actualDuration: previousHistoricalSet.durationPerformed ?? activeInfo.setData.duration ?? null,
        setNotes: '', // Don't carry over old notes typically
      });
    } else {
      // 3. Fallback: pre-fill with target values from the current routine
      this.currentSetForm.patchValue({
        actualReps: activeInfo.setData.reps ?? null,
        actualWeight: activeInfo.setData.weight ?? null,
        actualDuration: activeInfo.setData.duration ?? null,
        setNotes: '',
      });
    }
  }

  // When moving to a new set/exercise
  private navigateToNextStepInWorkout(activeInfo: ActiveSetInfo, routine: Routine): void {
    const currentExercise = routine.exercises[activeInfo.exerciseIndex];
    let exerciseChanged = false;

    if (activeInfo.setIndex < currentExercise.sets.length - 1) {
      this.currentSetIndex.update(s => s + 1);
    } else if (activeInfo.exerciseIndex < routine.exercises.length - 1) {
      this.currentExerciseIndex.update(e => e + 1);
      this.currentSetIndex.set(0);
      exerciseChanged = true; // Exercise has changed
      this.loadBaseExerciseDetailsForCurrent();
    } else {
      this.finishWorkout();
      return; // Workout is finished, no need to patch form
    }

    if (exerciseChanged) {
      this.lastPerformanceForCurrentExercise = null; // Reset to force re-fetch for new exercise
      this.fetchLastPerformanceAndPatchForm();
    } else {
      // Still on the same exercise, just patch for the new set
      // fetchLastPerformanceAndPatchForm will use cached lastPerformanceForCurrentExercise
      this.fetchLastPerformanceAndPatchForm();
    }
  }

  // --- On-the-fly Target Modification ---
  startEditTarget(field: 'reps' | 'weight' | 'duration'): void {
    const activeInfo = this.activeSetInfo();
    if (!activeInfo) return;

    this.editingTarget = field;
    switch (field) {
      case 'reps':
        this.editingTargetValue = activeInfo.setData.reps ?? '';
        break;
      case 'weight':
        this.editingTargetValue = activeInfo.setData.weight ?? '';
        break;
      case 'duration':
        this.editingTargetValue = activeInfo.setData.duration ?? '';
        break;
    }
    // We'll need to focus the input field created in the template
    // This can be done with a small delay and a template reference variable or by finding the element.
    // For now, let's rely on the template structure.
  }

  confirmEditTarget(): void {
    const activeInfo = this.activeSetInfo();
    if (!activeInfo || this.editingTarget === null) return;

    const numericValue = parseFloat(this.editingTargetValue as string);
    if (isNaN(numericValue) || numericValue < 0) {
      alert(`Invalid value for ${this.editingTarget}. Please enter a non-negative number.`);
      // Optionally revert editingTargetValue or keep it for user to correct
      return;
    }

    // IMPORTANT: We are modifying a copy of the routine's set data for this session.
    // This does NOT save back to the original Routine object in WorkoutService.
    const routineSignal = this.routine; // Get the WritableSignal
    const currentRoutine = routineSignal();
    if (!currentRoutine) return;

    // Create a deep copy of the routine to modify it safely and trigger signal updates
    const updatedRoutine = JSON.parse(JSON.stringify(currentRoutine)) as Routine;
    const exerciseToUpdate = updatedRoutine.exercises[activeInfo.exerciseIndex];
    const setToUpdate = exerciseToUpdate.sets[activeInfo.setIndex];

    switch (this.editingTarget) {
      case 'reps':
        setToUpdate.reps = numericValue;
        break;
      case 'weight':
        setToUpdate.weight = numericValue;
        break;
      case 'duration':
        setToUpdate.duration = numericValue;
        break;
    }

    routineSignal.set(updatedRoutine); // Update the routine signal with the modified data

    // After updating the routine signal, activeSetInfo will recompute.
    // We also need to re-patch the currentSetForm if the user hasn't started inputting actuals.
    // This part needs careful consideration to avoid overwriting user's actual inputs.
    // For simplicity now, let's assume if they edit target, the actuals might prefill from this new target.
    this.resetAndPatchCurrentSetForm(); // This will now use the MODIFIED target

    this.cancelEditTarget(); // Exit editing mode
  }

  cancelEditTarget(): void {
    this.editingTarget = null;
    this.editingTargetValue = '';
  }

  ngOnDestroy(): void {
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.restTimerSub) this.restTimerSub.unsubscribe();
    if (this.timedSetIntervalSub) {
      this.timedSetIntervalSub.unsubscribe();
    }
  }
}