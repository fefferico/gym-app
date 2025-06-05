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
import { TrackingService } from '../../core/services/tracking.service'; // For saving at the end
import { LoggedSet, LoggedWorkoutExercise, WorkoutLog, LastPerformanceSummary, PersonalBestSet } from '../../core/models/workout-log.model'; // For constructing the log

// Interface to manage the state of the currently active set/exercise
interface ActiveSetInfo {
  exerciseIndex: number;
  setIndex: number;
  exerciseData: WorkoutExercise;
  setData: ExerciseSetParams; // This will now reflect session-specific suggested targets
  baseExerciseInfo?: Exercise;
  isCompleted: boolean; // Based on currentWorkoutLogExercises for this session
  // Fields for actuals (if re-doing a set within the session)
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

  // This routine signal will hold the session-specific version of the routine,
  // with targets potentially modified by progressive overload suggestions or on-the-fly edits.
  routine = signal<Routine | null | undefined>(undefined);

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
  exercisePBs = signal<PersonalBestSet[]>([]); // New signal for PBs

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
          return this.workoutService.getRoutineById(this.routineId).pipe(
            // Create a DEEP COPY of the routine for this session.
            // All target modifications (suggestions, on-the-fly edits) will happen on this copy.
            map(originalRoutine => originalRoutine ? JSON.parse(JSON.stringify(originalRoutine)) as Routine : null)
          );
        }
        return of(null);
      }),
      tap(sessionRoutineCopy => {
        if (sessionRoutineCopy) {
          this.routine.set(sessionRoutineCopy);
          this.prepareCurrentSet(); // Prepare the first set with suggestions
        } else {
          this.routine.set(null);
          console.error('WorkoutPlayer: Routine not found or ID missing.');
        }
      })
    ).subscribe();
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

  // Make sure this method is still present and correct from your version
  private addLoggedSetToCurrentLog(exerciseData: WorkoutExercise, loggedSet: LoggedSet): void {
    const logs = this.currentWorkoutLogExercises();
    let exerciseLog = logs.find(exLog => exLog.exerciseId === exerciseData.exerciseId);

    if (exerciseLog) {
      const existingSetIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === loggedSet.plannedSetId); // Or s.id === loggedSet.id if IDs are unique per log attempt
      if (existingSetIndex > -1) {
        exerciseLog.sets[existingSetIndex] = loggedSet;
      } else {
        exerciseLog.sets.push(loggedSet);
      }
      // To ensure signal updates if nested object changes, re-set the whole array if needed, or ensure deep cloning for exerciseLog
      this.currentWorkoutLogExercises.set([...logs]); // Simple way to trigger update
    } else {
      exerciseLog = {
        exerciseId: exerciseData.exerciseId,
        exerciseName: this.currentBaseExercise()?.name || exerciseData.exerciseName || 'Unknown Exercise',
        sets: [loggedSet]
      };
      this.currentWorkoutLogExercises.set([...logs, exerciseLog]);
    }
  }


  // Ensure finishWorkout uses the latest `this.routine()` for `routineName`
  // and `this.currentWorkoutLogExercises()` for exercises.
  // The logic for updating `routine.lastPerformed` should also use the session copy.
  finishWorkout(): void {
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.restTimerSub) this.restTimerSub.unsubscribe();

    const sessionRoutineValue = this.routine(); // Use the session's routine copy
    const endTime = Date.now();
    const durationMinutes = Math.round((endTime - this.workoutStartTime) / (1000 * 60));

    const finalLog: Omit<WorkoutLog, 'id'> = {
      routineId: this.routineId || undefined,
      routineName: sessionRoutineValue?.name || 'Ad-hoc Workout',
      // date will be set by TrackingService based on startTime
      startTime: this.workoutStartTime,
      endTime: endTime,
      durationMinutes: durationMinutes,
      exercises: this.currentWorkoutLogExercises(),
      date: new Date(this.workoutStartTime).toISOString(),
    };

    const savedLog = this.trackingService.addWorkoutLog(finalLog);

    // Update the original routine's lastPerformed date in WorkoutService
    if (this.routineId && sessionRoutineValue) { // Only if it was based on a saved routine
      // Fetch the original routine again to avoid saving session-modified targets
      this.workoutService.getRoutineById(this.routineId).pipe(take(1)).subscribe(originalRoutine => {
        if (originalRoutine) {
          const updatedOriginalRoutine = {
            ...originalRoutine,
            lastPerformed: new Date(this.workoutStartTime).toISOString()
          };
          this.workoutService.updateRoutine(updatedOriginalRoutine);
        }
      });
    }

    alert('Workout Finished and Logged!');
    // Navigate to a log detail page or history
    this.router.navigate(['/history/log', savedLog.id]); // Example, adjust route as needed
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

  cancelEditTarget(): void {
    this.editingTarget = null;
    this.editingTargetValue = '';
  }

  formatPbValue(pb: PersonalBestSet): string {
    let value = '';
    if (pb.weightUsed !== undefined && pb.weightUsed !== null) {
      value += `${pb.weightUsed}kg`;
      if (pb.repsAchieved > 1 && !pb.pbType.includes('RM (Actual)')) { // Don't show reps for actual XRM where reps is implicit
        value += ` x ${pb.repsAchieved}`;
      }
    } else if (pb.repsAchieved > 0 && pb.pbType.includes('Max Reps')) {
      value = `${pb.repsAchieved} reps`;
    } else if (pb.durationPerformed && pb.durationPerformed > 0 && pb.pbType.includes('Max Duration')) {
      value = `${pb.durationPerformed}s`;
    }
    return value || 'N/A';
  }

  ngOnDestroy(): void {
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.restTimerSub) this.restTimerSub.unsubscribe();
    if (this.timedSetIntervalSub) {
      this.timedSetIntervalSub.unsubscribe();
    }
  }




  private initializeCurrentSetForm(): void {
    this.currentSetForm = this.fb.group({
      actualReps: [null as number | null, [Validators.min(0)]],
      actualWeight: [null as number | null, [Validators.min(0)]],
      actualDuration: [null as number | null, [Validators.min(0)]],
      setNotes: [''],
    });
  }

  // Central method to prepare the current set with suggestions and patch the form
  private async prepareCurrentSet(): Promise<void> {
    const sessionRoutine = this.routine(); // Get the current session's routine copy
    const exIndex = this.currentExerciseIndex();
    const sIndex = this.currentSetIndex();

    if (!sessionRoutine || !sessionRoutine.exercises[exIndex] || !sessionRoutine.exercises[exIndex].sets[sIndex]) {
      this.currentSetForm.reset();
      this.resetTimedSet();
      this.currentBaseExercise.set(null);
      this.exercisePBs.set([]);
      this.lastPerformanceForCurrentExercise = null;
      console.warn('prepareCurrentSet: Could not find active set data in session routine.');
      return;
    }

    const currentExerciseData = sessionRoutine.exercises[exIndex];
    const originalPlannedSetForThisSet = currentExerciseData.sets[sIndex]; // Targets from routine (potentially already session-adjusted by user)

    // 1. Load base exercise details (image, description, PBs)
    this.loadBaseExerciseAndPBs(currentExerciseData.exerciseId);

    // 2. Fetch last historical performance for the *current exercise*
    if (!this.lastPerformanceForCurrentExercise || this.lastPerformanceForCurrentExercise.sets[0]?.exerciseId !== currentExerciseData.exerciseId) {
      try {
        this.lastPerformanceForCurrentExercise = await new Promise<LastPerformanceSummary | null>((resolve) => {
          this.trackingService.getLastPerformanceForExercise(currentExerciseData.exerciseId)
            .pipe(take(1))
            .subscribe(perf => resolve(perf));
        });
      } catch (error) {
        console.error("Error fetching last performance:", error);
        this.lastPerformanceForCurrentExercise = null;
      }
    }

    // 3. Get the specific historical set performance corresponding to the current planned set
    const historicalSetPerformance = this.trackingService.findPreviousSetPerformance(
      this.lastPerformanceForCurrentExercise,
      originalPlannedSetForThisSet, // Pass the current set's planned parameters from session routine
      sIndex
    );

    // 4. Get suggested parameters from WorkoutService
    // Pass the originalPlannedSetForThisSet which represents the current target for this session for this set
    // (It might have been user-edited on-the-fly OR it's the original from the loaded routine)
    const suggestedSetParams = this.workoutService.suggestNextSetParameters(
      historicalSetPerformance,
      originalPlannedSetForThisSet, // This is KEY: use the current session's target as base for suggestion
      sessionRoutine.goal
    );
    console.log(`Original/Current Session Target for Set ${sIndex + 1}:`, originalPlannedSetForThisSet);
    console.log(`Last Historical Performance for this set:`, historicalSetPerformance);
    console.log(`Progressive Overload Suggestion for Set ${sIndex + 1}:`, suggestedSetParams);

    // 5. Update the session's routine data with these new suggestions
    // This ensures activeSetInfo() and the UI reflect these new session targets
    // We operate on a copy again to ensure the signal updates properly
    const updatedRoutineForSession = JSON.parse(JSON.stringify(sessionRoutine)) as Routine;
    updatedRoutineForSession.exercises[exIndex].sets[sIndex] = {
      ...suggestedSetParams, // Apply all suggested parameters
      id: originalPlannedSetForThisSet.id, // IMPORTANT: Preserve the original planned set ID
      notes: suggestedSetParams.notes ?? originalPlannedSetForThisSet.notes, // Keep original notes if suggestion doesn't override
    };
    this.routine.set(updatedRoutineForSession); // This will trigger activeSetInfo to recompute

    // 6. Patch the actuals form based on the new session targets or existing log for this session
    this.patchActualsFormBasedOnSessionTargets();
  }

  // Renamed to be more specific
  private patchActualsFormBasedOnSessionTargets(): void {
    this.currentSetForm.reset();
    this.resetTimedSet();

    const activeInfo = this.activeSetInfo(); // This now has the latest session-specific suggested targets
    if (!activeInfo) return;

    const completedExerciseLog = this.currentWorkoutLogExercises().find(logEx => logEx.exerciseId === activeInfo.exerciseData.exerciseId);
    const completedSetLogThisSession = completedExerciseLog?.sets.find(logSet => logSet.plannedSetId === activeInfo.setData.id);

    if (completedSetLogThisSession) {
      this.currentSetForm.patchValue({
        actualReps: completedSetLogThisSession.repsAchieved,
        actualWeight: completedSetLogThisSession.weightUsed,
        actualDuration: completedSetLogThisSession.durationPerformed,
        setNotes: completedSetLogThisSession.notes,
      });
    } else {
      // Pre-fill actuals form with the NEWLY SUGGESTED/SESSION-ADJUSTED targets
      this.currentSetForm.patchValue({
        actualReps: activeInfo.setData.reps ?? null,
        actualWeight: activeInfo.setData.weight ?? null,
        actualDuration: activeInfo.setData.duration ?? null,
        setNotes: activeInfo.setData.notes || '',
      });
    }
  }

  private loadBaseExerciseAndPBs(exerciseId: string): void {
    this.currentBaseExercise.set(undefined);
    this.exercisePBs.set([]);

    this.exerciseService.getExerciseById(exerciseId).subscribe(ex => {
      this.currentBaseExercise.set(ex || null);
    });

    this.trackingService.getAllPersonalBestsForExercise(exerciseId)
      .pipe(take(1))
      .subscribe(pbs => {
        this.exercisePBs.set(pbs);
      });
  }

  // This method is no longer needed as its functionality is in prepareCurrentSet
  // private async fetchLastPerformanceAndPatchForm(): Promise<void> { ... }
  // This method is no longer needed as its functionality is in patchActualsFormBasedOnSessionTargets
  // private patchCurrentSetFormWithData(activeInfo: ActiveSetInfo): void { ... }


  private navigateToNextStepInWorkout(completedActiveInfo: ActiveSetInfo, currentRoutineState: Routine): void {
    const currentExercise = currentRoutineState.exercises[completedActiveInfo.exerciseIndex];

    if (completedActiveInfo.setIndex < currentExercise.sets.length - 1) {
      this.currentSetIndex.update(s => s + 1);
    } else if (completedActiveInfo.exerciseIndex < currentRoutineState.exercises.length - 1) {
      this.currentExerciseIndex.update(e => e + 1);
      this.currentSetIndex.set(0);
      this.lastPerformanceForCurrentExercise = null; // Reset for new exercise
    } else {
      this.finishWorkout();
      return;
    }
    this.prepareCurrentSet(); // Prepare the next set with new suggestions
  }

  confirmEditTarget(): void {
    const activeInfoOriginal = this.activeSetInfo(); // Based on current routine() state
    if (!activeInfoOriginal || this.editingTarget === null) return;

    const numericValue = parseFloat(this.editingTargetValue as string);
    if (isNaN(numericValue) || numericValue < 0) {
      alert(`Invalid value for ${this.editingTarget}. Please enter a non-negative number.`);
      return;
    }

    const routineSignal = this.routine;
    const currentRoutineValue = routineSignal();
    if (!currentRoutineValue) return;

    const updatedRoutineForSession = JSON.parse(JSON.stringify(currentRoutineValue)) as Routine;
    const exerciseToUpdate = updatedRoutineForSession.exercises[activeInfoOriginal.exerciseIndex];
    const setToUpdate = exerciseToUpdate.sets[activeInfoOriginal.setIndex];

    switch (this.editingTarget) {
      case 'reps': setToUpdate.reps = numericValue; break;
      case 'weight': setToUpdate.weight = numericValue; break;
      case 'duration': setToUpdate.duration = numericValue; break;
    }
    // IMPORTANT: Update the session-specific routine
    routineSignal.set(updatedRoutineForSession);

    this.cancelEditTarget();

    // Re-patch the actuals form to reflect the manually edited target
    // The progressive overload suggestion is NOT re-applied here, user's edit takes precedence for this set.
    this.patchActualsFormBasedOnSessionTargets();
  }

  completeSetAndProceed(): void {
    const activeInfo = this.activeSetInfo(); // Uses current (potentially session-modified) routine() state
    const currentRoutineValue = this.routine();
    if (!activeInfo || !currentRoutineValue) {
      console.error("Cannot complete set: activeInfo or routine is not available.");
      return;
    }

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
      // Use activeInfo.setData.id as plannedSetId because activeInfo reflects session targets
      id: activeInfo.setData.id, // Or generate a new unique ID for the logged set if preferred: uuidv4()
      plannedSetId: activeInfo.setData.id,
      exerciseId: activeInfo.exerciseData.exerciseId,
      repsAchieved: formValues.actualReps ?? activeInfo.setData.reps ?? 0,
      weightUsed: formValues.actualWeight ?? activeInfo.setData.weight,
      durationPerformed: activeInfo.setData.duration ? (formValues.actualDuration ?? 0) : undefined,
      // Store the targets that were active for THIS SESSION (could be suggested or user-edited)
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

    this.resetTimedSet();
    this.navigateToNextStepInWorkout(activeInfo, currentRoutineValue);
  }
}