import { Component, inject, OnInit, OnDestroy, signal, computed, WritableSignal, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, Observable, of, timer } from 'rxjs';
import { switchMap, tap, map, takeWhile, take } from 'rxjs/operators';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms'; // Add FormBuilder, FormGroup, Validators, ReactiveFormsModule
import { FullScreenRestTimerComponent } from '../../shared/components/full-screen-rest-timer/full-screen-rest-timer'; // Adjust path

import { Routine, WorkoutExercise, ExerciseSetParams } from '../../core/models/workout.model';
import { Exercise } from '../../core/models/exercise.model'; // To fetch full exercise details
import { WorkoutService } from '../../core/services/workout.service';
import { ExerciseService } from '../../core/services/exercise.service';
import { TrackingService } from '../../core/services/tracking.service'; // For saving at the end
import { LoggedSet, LoggedWorkoutExercise, WorkoutLog, LastPerformanceSummary, PersonalBestSet } from '../../core/models/workout-log.model'; // For constructing the log
import { WeightUnitPipe } from '../../shared/pipes/weight-unit-pipe';
import { AlertComponent } from '../../shared/components/alert/alert.component';
import { AlertService } from '../../core/services/alert.service';
import { StorageService } from '../../core/services/storage.service';
import { AlertButton } from '../../core/models/alert.model';

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

interface PausedWorkoutState {
  version: string; // For future schema changes
  routineId: string | null;
  sessionRoutine: Routine; // The potentially modified routine
  currentExerciseIndex: number;
  currentSetIndex: number;
  currentWorkoutLogExercises: LoggedWorkoutExercise[];
  workoutStartTimeOriginal: number; // The very first start time of this session attempt
  sessionTimerElapsedSecondsBeforePause: number;
  currentBlockRound: number;
  totalBlockRounds: number;

  // Active set timer state
  timedSetTimerState: TimedSetState;
  timedSetElapsedSeconds: number; // This is the total elapsed for the active set's timer

  // Rest timer state (for FullScreenRestTimerComponent)
  isResting: boolean; // Was the player in a general resting phase
  isRestTimerVisibleOnPause: boolean; // Was the full screen timer specifically visible
  restTimerRemainingSecondsOnPause: number;
  restTimerInitialDurationOnPause: number;
  restTimerMainTextOnPause: string;
  restTimerNextUpTextOnPause: string | null;

  // Additional data to restore UI accurately
  lastPerformanceForCurrentExercise: LastPerformanceSummary | null;
  // Note: currentBaseExercise and exercisePBs are typically re-fetched on load based on exerciseId
}

enum SessionState {
  Loading = 'loading', // New initial state
  Playing = 'playing',
  Paused = 'paused',
  Error = 'error', // If routine fails to load initially
}

enum TimedSetState {
  Idle = 'idle', // Not started or reset
  Running = 'running',
  Paused = 'paused',
}

@Component({
  selector: 'app-workout-player',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, ReactiveFormsModule, FormsModule, WeightUnitPipe, FullScreenRestTimerComponent],
  templateUrl: './workout-player.html',
  styleUrl: './workout-player.scss',
  providers: [DecimalPipe]
})
export class WorkoutPlayerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  protected trackingService = inject(TrackingService);
  protected alertService = inject(AlertService);
  private fb = inject(FormBuilder); // Inject FormBuilder
  private storageService = inject(StorageService); // Inject StorageService
  private cdr = inject(ChangeDetectorRef); // For manual change detection if needed

  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';
  private readonly PAUSED_STATE_VERSION = '1.0';

  // Signals for rest timer
  isRestTimerVisible = signal(false);
  restDuration = signal(0);
  restTimerMainText = signal('RESTING');
  restTimerNextUpText = signal<string | null>(null);

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
  //private restTimerSub: Subscription | undefined;

  sessionTimerDisplay = signal('00:00:00');
  restTimerDisplay = signal<string | null>(null);
  // isResting = signal(false); // Controlled by rest period logic, FullScreenTimer visibility

  // --- NEW Signals for Round Tracking ---
  /** Current round for the active exercise block (1-indexed for display) */
  currentBlockRound = signal(1);
  /** Total rounds planned for the active exercise block */
  totalBlockRounds = signal(1);

  // Rest timer specific pause states - to restore the FullScreenRestTimer
  private wasRestTimerVisibleOnPause = false;
  private restTimerRemainingSecondsOnPause = 0;
  private restTimerInitialDurationOnPause = 0;
  private restTimerMainTextOnPause = 'RESTING';
  private restTimerNextUpTextOnPause: string | null = null;

  // Use HostListener for the beforeunload event
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: BeforeUnloadEvent): void {
    if (this.sessionState() === SessionState.Playing && this.routine() && this.currentWorkoutLogExercises().length > 0) {
      // If a workout is in progress and some sets have been logged
      // Attempt to save. This is a best-effort.
      console.log('Attempting to save session state on beforeunload...');
      this.captureAndSaveStateForUnload();

      // Standard practice for beforeunload to show a browser-native confirmation
      // $event.returnValue = true; // For older browsers
      // For modern browsers, you just need to set returnValue, but the message is generic
      // and controlled by the browser, not by your custom string.
      // Note: Some browsers might not show the prompt if the user has interacted little with the page.
      // Comment this out if you don't want the browser's native "leave site?" prompt.
      // if (this.currentWorkoutLogExercises().length > 0) { // Only prompt if there's progress
      //   $event.preventDefault(); // Standard way to trigger the prompt
      //   $event.returnValue = 'Changes you made may not be saved.'; // This message is often ignored by modern browsers
      // }
    }
  }

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


  // PAUSE HANDLING
  sessionState = signal<SessionState>(SessionState.Loading); // Initial state

  // For session timer pausing
  private sessionTimerElapsedSecondsBeforePause = 0;

  // For active set timer pausing
  private timedSetElapsedSecondsBeforePause = 0;
  private wasTimedSetRunningOnPause = false;

  // PAUSE HANDLING

  constructor() { // No need to inject FormBuilder here if using inject() for properties
    this.initializeCurrentSetForm(); // Initialize the form structure
  }

  // Modify ngOnInit to initialize round trackers when routine is first set
  async ngOnInit(): Promise<void> {
    const hasPausedSession = await this.checkForPausedSession();
    if (!hasPausedSession) {
      // No paused session, or user chose not to resume, so load new workout
      this.loadNewWorkoutFromRoute();
    }
    // If hasPausedSession was true, checkForPausedSession already handled loading it.
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
    // console.log('Starting session timer. Was paused seconds:', this.sessionTimerElapsedSecondsBeforePause, 'New startTime:', this.workoutStartTime);
    if (this.sessionState() === SessionState.Paused) return;
    if (this.timerSub) this.timerSub.unsubscribe(); // Ensure no multiple timers

    this.timerSub = timer(0, 1000).subscribe(() => {
      if (this.sessionState() === SessionState.Playing) {
        const currentDeltaSeconds = Math.floor((Date.now() - this.workoutStartTime) / 1000);
        const totalElapsedSeconds = this.sessionTimerElapsedSecondsBeforePause + currentDeltaSeconds;

        const hours = Math.floor(totalElapsedSeconds / 3600);
        const minutes = Math.floor((totalElapsedSeconds % 3600) / 60);
        const seconds = totalElapsedSeconds % 60;
        this.sessionTimerDisplay.set(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      }
    });
  }

  private updateRestTimerDisplay(seconds: number): void {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    this.restTimerDisplay.set(`${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
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
    if (this.sessionState() === SessionState.Paused) {
      this.alertService.showAlert("Info", "Please resume the workout before finishing.", "warning");
      return;
    }
    if (this.sessionState() === SessionState.Loading) {
      this.alertService.showAlert("Info", "Workout is still loading.", "warning");
      return;
    }

    if (this.timerSub) this.timerSub.unsubscribe();

    const sessionRoutineValue = this.routine();
    const endTime = Date.now();
    const durationMinutes = Math.round((endTime - this.workoutStartTime) / (1000 * 60));

    const finalLog: Omit<WorkoutLog, 'id'> = {
      routineId: this.routineId || undefined,
      routineName: sessionRoutineValue?.name || 'Ad-hoc Workout',
      startTime: this.workoutStartTime,
      endTime: endTime,
      durationMinutes: durationMinutes,
      exercises: this.currentWorkoutLogExercises(),
      date: new Date(this.workoutStartTime).toISOString().split('T')[0], // Ensure date is set correctly
      // overallNotes: get from a form field if you add one to player
    };

    const savedLog = this.trackingService.addWorkoutLog(finalLog);
    console.log('Workout Finished and Logged! Log ID:', savedLog.id);

    // Update original routine's lastPerformed date
    if (this.routineId && sessionRoutineValue) {
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

    this.storageService.removeItem(this.PAUSED_WORKOUT_KEY); // Clear paused state on successful finish
    // Instead of alert, navigate to the summary page
    this.router.navigate(['/workout/summary', savedLog.id]); // <<<< MODIFIED NAVIGATION
  }


  // Modify quitWorkout to handle paused state
  async quitWorkout(): Promise<void> {
    const confirmQuit = await this.alertService.showConfirm(
      "Quit Workout",
      'Are you sure you want to quit this workout? Any unsaved progress for this session will be lost if you haven\'t paused it.'
    ); // Adjusted message
    if (confirmQuit && confirmQuit.data) {
      this.sessionState.set(SessionState.Playing); // Effectively end the session conceptually
      if (this.timerSub) this.timerSub.unsubscribe();
      if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
      this.isRestTimerVisible.set(false);
      this.storageService.removeItem(this.PAUSED_WORKOUT_KEY); // Clear any paused state
      this.router.navigate(['/workout']);
    }
  }

  // Helper for template to access form controls
  get csf() { // csf for CurrentSetForm
    return this.currentSetForm.controls;
  }

  toggleTimedSetTimer(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.alertService.showAlert("Info", "Session is paused. Please resume to use the timer.", "warning");
      return;
    }

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

  checkIfLatestSetOfWorkout(): boolean {
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

  checkIfLatestSetOfExercise(): boolean {
    const routine = this.routine(); // Get the current routine from the signal
    const activeInfo = this.activeSetInfo(); // Get the current active set info

    // 1. Check if routine or activeInfo is available
    if (!routine || !activeInfo) {
      // console.log('checkIfLatest: Routine or activeInfo not available');
      return false; // Cannot determine if routine or active set isn't loaded
    }

    // 2. check if it's the last set of that exercise
    const currentExerciseData = routine.exercises[activeInfo.exerciseIndex];
    const isLastSetOfCurrentExercise = activeInfo.setIndex === currentExerciseData.sets.length - 1;
    return isLastSetOfCurrentExercise;
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

  private initializeCurrentSetForm(): void {
    if (this.sessionState() === SessionState.Paused) {
      console.log("PrepareCurrentSet: Session is paused, deferring preparation.");
      return;
    }
    this.currentSetForm = this.fb.group({
      actualReps: [null as number | null, [Validators.min(0)]],
      actualWeight: [null as number | null, [Validators.min(0)]],
      actualDuration: [null as number | null, [Validators.min(0)]],
      setNotes: [''],
    });
  }

  // Central method to prepare the current set with suggestions and patch the form
  private async prepareCurrentSet(): Promise<void> {
    if (this.sessionState() === SessionState.Paused) {
      console.log("PrepareCurrentSet: Session is paused, deferring preparation.");
      return;
    }
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
    if (this.sessionState() === SessionState.Paused) {
      console.log("PrepareCurrentSet: Session is paused, deferring preparation.");
      return;
    }
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


  // --- SIGNIFICANTLY REVISED Navigation Logic ---
  private navigateToNextStepInWorkout(completedActiveInfo: ActiveSetInfo, currentSessionRoutine: Routine): void {
    const currentGlobalExerciseIndex = completedActiveInfo.exerciseIndex;
    const currentGlobalSetIndex = completedActiveInfo.setIndex;
    const currentPlayedExercise = currentSessionRoutine.exercises[currentGlobalExerciseIndex];

    let nextExerciseGlobalIndex = currentGlobalExerciseIndex;
    let nextSetIndexInExercise = 0; // Set index relative to the *next* exercise
    let exerciseBlockChanged = false;

    // Case 1: More sets in the current exercise?
    if (currentGlobalSetIndex < currentPlayedExercise.sets.length - 1) {
      nextSetIndexInExercise = currentGlobalSetIndex + 1;
      // nextExerciseGlobalIndex remains the same
      console.log(`Advancing to Set ${nextSetIndexInExercise + 1} of ${currentPlayedExercise.exerciseName}`);
    }
    // Case 2: Last set of an exercise completed.
    else {
      // Is this exercise part of an ongoing superset?
      if (currentPlayedExercise.supersetId &&
        currentPlayedExercise.supersetOrder !== null &&
        (currentPlayedExercise.supersetSize !== null && currentPlayedExercise.supersetSize !== undefined) &&
        currentPlayedExercise.supersetOrder < currentPlayedExercise.supersetSize - 1) {

        // Yes, move to the next exercise in the SAME superset group for the CURRENT round
        nextExerciseGlobalIndex++; // Assumes contiguous superset exercises
        // Ensure this next exercise is indeed part of the same superset
        if (nextExerciseGlobalIndex < currentSessionRoutine.exercises.length &&
          currentSessionRoutine.exercises[nextExerciseGlobalIndex].supersetId === currentPlayedExercise.supersetId) {
          // nextSetIndexInExercise is already 0 (first set of new exercise)
          console.log(`Advancing to next Superset Exercise: ${currentSessionRoutine.exercises[nextExerciseGlobalIndex].exerciseName}`);
        } else {
          // Should not happen if routine structure is correct - superset broken
          console.error("Superset structure broken. Attempting to find next block.");
          const foundBlockIdx = this.findNextExerciseBlockStartIndex(currentGlobalExerciseIndex, currentSessionRoutine);
          if (foundBlockIdx !== -1) {
            nextExerciseGlobalIndex = foundBlockIdx;
            exerciseBlockChanged = true;
          } else { this.finishWorkout(); return; }
        }
      }
      // Case 3: Last set of a standalone exercise OR last set of the last exercise in a superset group completed.
      // This marks the end of one pass through the current "exercise block".
      else {
        const currentBlockTotalRounds = this.totalBlockRounds(); // From the start of this block
        if (this.currentBlockRound() < currentBlockTotalRounds) {
          // More rounds for the current block
          this.currentBlockRound.update(r => r + 1);
          console.log(`Starting Round ${this.currentBlockRound()} of ${currentBlockTotalRounds} for current block.`);
          // Reset to the beginning of the current block
          if (currentPlayedExercise.supersetId && currentPlayedExercise.supersetOrder !== null) {
            // It was a superset, find its first exercise (supersetOrder === 0)
            nextExerciseGlobalIndex = currentGlobalExerciseIndex - currentPlayedExercise.supersetOrder;
          } else {
            // It was a standalone exercise, so index remains the same to repeat it
            // nextExerciseGlobalIndex remains currentGlobalExerciseIndex
          }
          // nextSetIndexInExercise is already 0
        } else {
          // All rounds for the current block are complete. Find the next block.
          console.log('All rounds for current block complete. Finding next block.');
          const foundBlockIdx = this.findNextExerciseBlockStartIndex(currentGlobalExerciseIndex, currentSessionRoutine);
          if (foundBlockIdx !== -1) {
            nextExerciseGlobalIndex = foundBlockIdx;
            // nextSetIndexInExercise is already 0
            exerciseBlockChanged = true; // Signifies a completely new block is starting
          } else {
            // No more blocks in the routine
            this.finishWorkout();
            return;
          }
        }
      }
    }

    // If the exercise block changed, reset round counters for the new block
    if (exerciseBlockChanged) {
      this.currentBlockRound.set(1);
      const newBlockStarterExercise = currentSessionRoutine.exercises[nextExerciseGlobalIndex];
      // A block's rounds are defined by its first exercise (standalone or supersetOrder 0)
      if (!newBlockStarterExercise.supersetId || newBlockStarterExercise.supersetOrder === 0) {
        this.totalBlockRounds.set(newBlockStarterExercise.rounds ?? 1);
      } else {
        // This case implies an issue, player should always land on a block starter
        console.warn("Landed on non-block-starter exercise when expecting new block. Defaulting rounds to 1.");
        this.totalBlockRounds.set(1);
      }
      this.lastPerformanceForCurrentExercise = null; // Reset last performance for the new exercise block
    }

    // Update signals for the next active set
    this.currentExerciseIndex.set(nextExerciseGlobalIndex);
    this.currentSetIndex.set(nextSetIndexInExercise);

    // Start rest timer using the rest period of the set that was JUST COMPLETED
    if (completedActiveInfo.setData.restAfterSet > 0) {
      this.startRestPeriod(completedActiveInfo.setData.restAfterSet);
    }

    this.prepareCurrentSet(); // Prepare UI and data for the new active set
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
    if (this.sessionState() === SessionState.Paused) {
      this.alertService.showAlert("Info", "Session is paused. Please resume to continue.", "warning");
      return;
    }

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
      durationPerformed: formValues.actualDuration ?? activeInfo.setData.duration,
      // Store the targets that were active for THIS SESSION (could be suggested or user-edited)
      targetReps: activeInfo.setData.reps,
      targetWeight: activeInfo.setData.weight,
      targetDuration: activeInfo.setData.duration,
      targetTempo: activeInfo.setData.tempo,
      notes: formValues.setNotes || undefined,
      timestamp: new Date().toISOString(),
    };
    this.addLoggedSetToCurrentLog(activeInfo.exerciseData, loggedSetData);

    // --- AUTO-SAVE CHECKPOINT ---
    if (this.sessionState() === SessionState.Playing) { // Only save if actively playing
      this.captureAndSaveStateForUnload(); // Re-use the synchronous save logic
      console.log('Auto-saved checkpoint after completing a set.');
    }
    // --- END AUTO-SAVE ---

    if (activeInfo.setData.restAfterSet > 0) {
      this.startRestPeriod(activeInfo.setData.restAfterSet);
      //this.startRestTimer(activeInfo.setData.restAfterSet);
    }

    this.resetTimedSet();
    this.navigateToNextStepInWorkout(activeInfo, currentRoutineValue);
  }

  /**
   * Finds the index of the start of the next exercise block.
   * An exercise block is either a standalone exercise or the first exercise of a new superset group.
   */
  private findNextExerciseBlockIndex(currentExerciseGlobalIndex: number, routine: Routine): number {
    for (let i = currentExerciseGlobalIndex + 1; i < routine.exercises.length; i++) {
      const nextEx = routine.exercises[i];
      // It's a new block if it's standalone OR the start of a new superset group
      if (!nextEx.supersetId || nextEx.supersetOrder === 0) {
        return i;
      }
    }
    return -1; // No more blocks
  }

  // Update getNextUpText to be round-aware
  getNextUpText(completedActiveSetInfo: ActiveSetInfo | null, currentSessionRoutine: Routine | null): string {
    if (!completedActiveSetInfo || !currentSessionRoutine) return 'Next Set/Exercise';

    const curExGlobalIdx = completedActiveSetInfo.exerciseIndex;
    const curSetIdxInEx = completedActiveSetInfo.setIndex;
    const curPlayedEx = currentSessionRoutine.exercises[curExGlobalIdx];

    // Case 1: More sets in current exercise of current round?
    if (curSetIdxInEx < curPlayedEx.sets.length - 1) {
      return `Set ${curSetIdxInEx + 2} of ${curPlayedEx.exerciseName}`;
    }

    // Case 2: Last set of current exercise. Is it part of an ongoing superset in the current round?
    if (curPlayedEx.supersetId && curPlayedEx.supersetOrder !== null && curPlayedEx.supersetSize &&
      curPlayedEx.supersetOrder < curPlayedEx.supersetSize - 1) {
      const nextSupersetExIndex = curExGlobalIdx + 1;
      if (nextSupersetExIndex < currentSessionRoutine.exercises.length &&
        currentSessionRoutine.exercises[nextSupersetExIndex].supersetId === curPlayedEx.supersetId) {
        return `SUPERSET: ${currentSessionRoutine.exercises[nextSupersetExIndex].exerciseName}`;
      }
    }

    // Case 3: Last set of the exercise block for the current round. Are there more rounds?
    const currentBlockTotalRounds = this.totalBlockRounds();
    if (this.currentBlockRound() < currentBlockTotalRounds) {
      let blockStartIndex = curExGlobalIdx;
      if (curPlayedEx.supersetId && curPlayedEx.supersetOrder !== null) {
        blockStartIndex = curExGlobalIdx - curPlayedEx.supersetOrder; // Find start of this superset block
      }
      return `Round ${this.currentBlockRound() + 1}: ${currentSessionRoutine.exercises[blockStartIndex].exerciseName}`;
    }

    // Case 4: All rounds for current block done. Find next block.
    const nextBlockStartIndex = this.findNextExerciseBlockStartIndex(curExGlobalIdx, currentSessionRoutine);
    if (nextBlockStartIndex !== -1) {
      return `Next Exercise: ${currentSessionRoutine.exercises[nextBlockStartIndex].exerciseName}`;
    }

    return 'Finish Workout!';
  }

  /**
   * Finds the index of the start of the NEXT exercise block.
   * An exercise block is either a standalone exercise or the first exercise of a new superset group.
   * @param currentCompletedExerciseGlobalIndex The global index of the exercise just finished (or last in its block/round).
   */
  private findNextExerciseBlockStartIndex(currentCompletedExerciseGlobalIndex: number, routine: Routine): number {
    for (let i = currentCompletedExerciseGlobalIndex + 1; i < routine.exercises.length; i++) {
      const exercise = routine.exercises[i];
      // A new block starts if it's not part of a superset OR if it's the first in a superset
      if (!exercise.supersetId || exercise.supersetOrder === 0) {
        return i;
      }
    }
    return -1; // No more blocks
  }

  getDisabled(): boolean {
    if (this.timedSetTimerState() == 'running') {
      return true;
    }
    return false;
  }

  // Modify your existing rest logic
  // Add the isResuming flag to startRestPeriod
  private startRestPeriod(duration: number, isResumingPausedRest: boolean = false): void {
    if (this.sessionState() === SessionState.Paused && !isResumingPausedRest) {
      // If session is globally paused, and this isn't a direct call to resume a paused rest,
      // then don't start a new rest period.
      console.log("Session is paused, deferring rest period start.");
      // Store the intended rest to be started on resume, if necessary
      this.wasRestTimerVisibleOnPause = true; // Mark that a rest was due
      this.restTimerRemainingSecondsOnPause = duration;
      this.restTimerInitialDurationOnPause = duration;
      this.restTimerMainTextOnPause = (this.activeSetInfo()?.setData?.restAfterSet === 0 && this.activeSetInfo()?.exerciseData?.supersetId) ? 'SUPERSET TRANSITION' : 'RESTING';
      if (this.routine() !== undefined && this.routine() !== null) {
        this.restTimerNextUpTextOnPause = this.getNextUpText(this.activeSetInfo(), this.routine() as Routine);
      }
      return;
    }

    //this.isResting.set(true); // isRestTimerVisible signal will control this now

    if (duration > 0) {
      const currentRoutineValue = this.routine();

      this.restDuration.set(duration); // This is the total duration for this rest
      if (!isResumingPausedRest) { // If not resuming, set texts normally
        this.restTimerMainText.set(
          this.activeSetInfo()?.setData?.restAfterSet === 0 && this.activeSetInfo()?.exerciseData?.supersetId ?
            'SUPERSET TRANSITION' : 'RESTING'
        );
        this.restTimerNextUpText.set(this.getNextUpText(this.activeSetInfo(), currentRoutineValue !== undefined ? currentRoutineValue : null));
      } else { // If resuming, use the stored texts
        this.restTimerMainText.set(this.restTimerMainTextOnPause);
        this.restTimerNextUpText.set(this.restTimerNextUpTextOnPause);
      }
      this.isRestTimerVisible.set(true);
    } else {
      this.isRestTimerVisible.set(false); // Ensure it's hidden if duration is 0
      // If duration is 0, FullScreenRestTimerComponent's timerFinished will emit immediately.
      // Or, we can directly call the logic that endRestPeriod would call.
      // For simplicity, let FullScreenRestTimer handle the immediate finish.
      // If FullScreenRestTimer is not shown for 0 duration, then:
      // this.handleRestTimerFinished(); // Or equivalent logic
    }
  }

  handleRestTimerFinished(): void {
    this.isRestTimerVisible.set(false);
    // this.isResting.set(false);
    if (this.sessionState() === SessionState.Playing) {
      // Proceed to next set/exercise ONLY if the main session is playing.
      // This check is important if the timer finishes while the session was globally paused
      // (though ideally, the timer component itself would be paused).
      // Logic to advance to next set/exercise is now primarily in completeSetAndProceed's call to navigateToNextStep...
      // This handler's main job is to hide the timer.
      // If the rest finishing *itself* should trigger next step without 'complete set' button:
      // const activeInfo = this.activeSetInfo();
      // const currentRoutineVal = this.routine();
      // if(activeInfo && currentRoutineVal) {
      //    this.navigateToNextStepInWorkout(activeInfo, currentRoutineVal);
      // }
    }
  }

  handleRestTimerSkipped(): void {
    this.isRestTimerVisible.set(false);
    // this.isResting.set(false);
    if (this.sessionState() === SessionState.Playing) {
      // Similar to timer finished, allow user to proceed or auto-proceed.
      // If skipping implies immediately going to the next thing:
      // const activeInfo = this.activeSetInfo();
      // const currentRoutineVal = this.routine();
      // if(activeInfo && currentRoutineVal) {
      //    this.navigateToNextStepInWorkout(activeInfo, currentRoutineVal);
      // }
    }
  }

  skipRest(): void { // This method is for a potential button OUTSIDE the FullScreenTimer
    if (this.sessionState() === SessionState.Paused) {
      this.alertService.showAlert("Info", "Session is paused. Resume to skip rest.", "warning");
      return;
    }
    if (this.isRestTimerVisible()) {
      // Command the FullScreenRestTimer to skip
      // This assumes FullScreenRestTimerComponent might have a public method or another way to be skipped.
      // For now, we'll just use its output event.
      this.handleRestTimerSkipped(); // This will hide it.
    } else {
      console.log("Skip rest called, but no active rest timer visible.");
    }
  }

  // --- PAUSE SESSION ---
  async pauseSession(): Promise<void> {
    if (this.sessionState() !== SessionState.Playing) return; // Can only pause if playing

    const customBtns: AlertButton[] = [{
      text: 'Cancel',
      role: 'cancel',
      data: false,
      cssClass: 'bg-gray-300 hover:bg-gray-500' // Example custom class
    } as AlertButton,
    {
      text: 'Pause Session',
      role: 'confirm',
      data: true
    } as AlertButton];

    const confirmation = await this.alertService.showConfirmationDialog(
      "Pause Workout",
      'Do you want to pause the current session? You can resume it later.',
      customBtns
    );

    if (!confirmation || confirmation.data !== true) {
      return;
    }

    // Capture final elapsed time before setting state to Paused
    this.sessionTimerElapsedSecondsBeforePause += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    if (this.timerSub) this.timerSub.unsubscribe();


    this.wasTimedSetRunningOnPause = this.timedSetTimerState() === TimedSetState.Running;
    if (this.timedSetTimerState() === TimedSetState.Running) {
      this.pauseTimedSet(); // Sets state to Paused and stops interval
    }
    // timedSetElapsedSeconds signal already holds the current value.

    this.wasRestTimerVisibleOnPause = this.isRestTimerVisible();
    if (this.wasRestTimerVisibleOnPause) {
      // For FullScreenRestTimer, ideally it would take an isPaused input.
      // For now, we hide it and will restore its state.
      // The FullScreenRestTimer's internal timer needs to be stopped by itself if we add pause support to it.
      // Or, we rely on hiding it (isVisible=false) which should make it stop its internal timer.
      const fullScreenTimer = /* How to get ref to FullScreenRestTimer? If it has a pause method */ null;
      // If FullScreenRestTimerComponent has a method to get remaining time:
      // this.restTimerRemainingSecondsOnPause = fullScreenTimer.getRemainingTime();
      // Otherwise, we approximate or rely on its own state when it's re-shown.
      // For simplicity, we'll store what we fed into it.
      this.restTimerRemainingSecondsOnPause = this.isRestTimerVisible() && this.restDuration() > 0 ? this.restDuration() - this.timedSetElapsedSeconds() : 0; // This logic might need refinement based on how FullScreenTimer tracks time
      this.restTimerInitialDurationOnPause = this.restDuration();
      this.restTimerMainTextOnPause = this.restTimerMainText();
      this.restTimerNextUpTextOnPause = this.restTimerNextUpText();
      this.isRestTimerVisible.set(false); // Hide it
    }

    this.sessionState.set(SessionState.Paused); // Set state AFTER capturing elapsed times
    this.savePausedSessionState(); // Save to localStorage

    console.log('Workout Paused. Elapsed Session Time Stored:', this.sessionTimerElapsedSecondsBeforePause);
    this.alertService.showAlert('Info', 'Workout session paused.');
  }

  // --- RESUME SESSION ---
  resumeSession(): void { // This method is primarily for the UI button if user manually pauses/resumes without closing app
    if (this.sessionState() !== SessionState.Paused) return;

    // The actual loading of state is now handled by loadStateFromPausedSession
    // This method just transitions the state and restarts timers
    // It assumes the state is already in the component's signals from a previous pause in THIS app instance.

    this.workoutStartTime = Date.now(); // Reset for delta calculation
    this.sessionState.set(SessionState.Playing);
    this.startSessionTimer(); // Resumes session timer

    if (this.wasTimedSetRunningOnPause && this.timedSetTimerState() === TimedSetState.Paused) {
      this.startOrResumeTimedSet(); // Resume active set timer if it was running
    }
    this.wasTimedSetRunningOnPause = false;

    if (this.wasRestTimerVisibleOnPause && this.restTimerRemainingSecondsOnPause > 0) {
      this.startRestPeriod(this.restTimerRemainingSecondsOnPause, true); // Re-show full screen rest timer
    }
    this.wasRestTimerVisibleOnPause = false;


    console.log('Workout Resumed. Previously elapsed:', this.sessionTimerElapsedSecondsBeforePause);
    this.alertService.showAlert('Info', 'Workout session resumed.');
    // No need to remove from storage here, that's done when checkForPausedSession loads it.
  }


  private async checkForPausedSession(): Promise<boolean> {
    const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);

    if (pausedState && pausedState.version === this.PAUSED_STATE_VERSION) {
      const routineName = pausedState.sessionRoutine?.name || 'a previous session';

      const customBtns: AlertButton[] = [{
        text: 'Discard',
        role: 'cancel',
        data: false,
        cssClass: 'bg-gray-300 hover:bg-gray-500' // Example custom class
      } as AlertButton,
      {
        text: 'Resume',
        role: 'confirm',
        data: true
      } as AlertButton];

      const confirmation = await this.alertService.showConfirmationDialog(
        'Resume Workout?',
        `You have a paused workout session for "${routineName}". Would you like to resume it?`,
        customBtns
      );

      if (confirmation && confirmation.data === true) {
        this.loadStateFromPausedSession(pausedState);
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY); // Clear after deciding to resume
        return true; // Indicates paused session was handled
      } else {
        // User chose to discard
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        this.alertService.showAlert('Info', 'Paused session discarded.');
        return false; // Indicates paused session was discarded, proceed with new load
      }
    }
    return false; // No paused session found
  }

  private loadNewWorkoutFromRoute(): void {
    this.sessionState.set(SessionState.Loading);
    this.workoutStartTime = Date.now(); // For a new workout
    this.sessionTimerElapsedSecondsBeforePause = 0; // Reset for new workout

    this.routeSub = this.route.paramMap.pipe(
      switchMap(params => {
        this.routineId = params.get('routineId');
        if (this.routineId) {
          return this.workoutService.getRoutineById(this.routineId).pipe(
            map(originalRoutine => originalRoutine ? JSON.parse(JSON.stringify(originalRoutine)) as Routine : null)
          );
        }
        return of(null);
      }),
      tap(async sessionRoutineCopy => {
        if (sessionRoutineCopy) {
          this.routine.set(sessionRoutineCopy);
          if (sessionRoutineCopy.exercises.length > 0) {
            const firstExerciseOfRoutine = sessionRoutineCopy.exercises[0];
            if (!firstExerciseOfRoutine.supersetId || firstExerciseOfRoutine.supersetOrder === 0) {
              this.totalBlockRounds.set(firstExerciseOfRoutine.rounds ?? 1);
            } else {
              const actualBlockStart = sessionRoutineCopy.exercises.find(ex => ex.supersetId === firstExerciseOfRoutine.supersetId && ex.supersetOrder === 0);
              this.totalBlockRounds.set(actualBlockStart?.rounds ?? 1);
            }
          } else {
            this.totalBlockRounds.set(1);
          }
          this.currentBlockRound.set(1);
          this.currentExerciseIndex.set(0);
          this.currentSetIndex.set(0);
          this.currentWorkoutLogExercises.set([]); // Fresh log for new workout
          await this.prepareCurrentSet(); // Prepare the first set
          this.sessionState.set(SessionState.Playing);
          this.startSessionTimer();
        } else {
          this.routine.set(null);
          this.sessionState.set(SessionState.Error);
          console.error('WorkoutPlayer: Routine not found or ID missing for new workout.');
        }
      })
    ).subscribe();
  }


  private loadStateFromPausedSession(state: PausedWorkoutState): void {
    this.routineId = state.routineId;
    this.routine.set(state.sessionRoutine); // Restore the session-modified routine
    this.currentExerciseIndex.set(state.currentExerciseIndex);
    this.currentSetIndex.set(state.currentSetIndex);
    this.currentWorkoutLogExercises.set(state.currentWorkoutLogExercises);
    this.workoutStartTime = Date.now(); // Reset for delta calculation from NOW
    this.sessionTimerElapsedSecondsBeforePause = state.sessionTimerElapsedSecondsBeforePause;
    this.currentBlockRound.set(state.currentBlockRound);
    this.totalBlockRounds.set(state.totalBlockRounds);

    this.timedSetTimerState.set(state.timedSetTimerState);
    this.timedSetElapsedSeconds.set(state.timedSetElapsedSeconds);
    // this.wasTimedSetRunningOnPause isn't strictly needed if we directly restore timedSetTimerState

    this.lastPerformanceForCurrentExercise = state.lastPerformanceForCurrentExercise;

    // Restore FullScreenRestTimer state by setting its inputs
    this.wasRestTimerVisibleOnPause = state.isRestTimerVisibleOnPause;
    this.restTimerRemainingSecondsOnPause = state.restTimerRemainingSecondsOnPause;
    this.restTimerInitialDurationOnPause = state.restTimerInitialDurationOnPause;
    this.restTimerMainTextOnPause = state.restTimerMainTextOnPause;
    this.restTimerNextUpTextOnPause = state.restTimerNextUpTextOnPause;

    this.prepareCurrentSet().then(() => { // Ensure form is patched based on loaded set
      this.sessionState.set(SessionState.Playing); // Set to playing *after* state is restored
      this.startSessionTimer(); // Resume session timer

      // If the timed set timer was running or paused, resume it
      if (state.timedSetTimerState === TimedSetState.Running) {
        this.startOrResumeTimedSet();
      } else if (state.timedSetTimerState === TimedSetState.Paused) {
        // It was paused, it remains paused. User can click its resume button.
        // Or, if you want to auto-resume it from its paused state: this.startOrResumeTimedSet();
      }

      // If the full screen rest timer was visible, re-show it
      if (this.wasRestTimerVisibleOnPause && this.restTimerRemainingSecondsOnPause > 0) {
        this.startRestPeriod(this.restTimerRemainingSecondsOnPause, true); // Pass a flag to indicate it's a resume
      }
      this.cdr.detectChanges(); // Force UI update
      this.alertService.showAlert('Info', 'Workout session resumed.');
    });
  }

  private savePausedSessionState(): void {
    if (!this.routine()) {
      console.warn("Cannot save paused state: routine is not loaded.");
      return;
    }

    // Capture the current elapsed session time before "officially" pausing
    let currentSessionElapsed = this.sessionTimerElapsedSecondsBeforePause;
    if (this.sessionState() === SessionState.Playing && this.workoutStartTime > 0) { // If it was playing right before pause
      currentSessionElapsed += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    }

    const stateToSave: PausedWorkoutState = {
      version: this.PAUSED_STATE_VERSION,
      routineId: this.routineId,
      sessionRoutine: JSON.parse(JSON.stringify(this.routine())), // Deep copy
      currentExerciseIndex: this.currentExerciseIndex(),
      currentSetIndex: this.currentSetIndex(),
      currentWorkoutLogExercises: JSON.parse(JSON.stringify(this.currentWorkoutLogExercises())), // Deep copy
      workoutStartTimeOriginal: this.workoutStartTime, // Could be original or from last resume
      sessionTimerElapsedSecondsBeforePause: currentSessionElapsed,
      currentBlockRound: this.currentBlockRound(),
      totalBlockRounds: this.totalBlockRounds(),
      timedSetTimerState: this.timedSetTimerState(),
      timedSetElapsedSeconds: this.timedSetElapsedSeconds(),
      isResting: this.isRestTimerVisible(), // Simpler: was the full screen timer visible?
      isRestTimerVisibleOnPause: this.isRestTimerVisible(),
      restTimerRemainingSecondsOnPause: this.isRestTimerVisible() ? (this.restDuration() - this.timedSetElapsedSeconds()) : 0, // Approx remaining if visible
      restTimerInitialDurationOnPause: this.isRestTimerVisible() ? this.restDuration() : 0,
      restTimerMainTextOnPause: this.restTimerMainText(),
      restTimerNextUpTextOnPause: this.restTimerNextUpText(),
      lastPerformanceForCurrentExercise: this.lastPerformanceForCurrentExercise ? JSON.parse(JSON.stringify(this.lastPerformanceForCurrentExercise)) : null,
    };

    this.storageService.setItem(this.PAUSED_WORKOUT_KEY, stateToSave);
    console.log('Workout session state saved for pause:', stateToSave);
  }

  private captureAndSaveStateForUnload(): void {
    // This method is similar to what savePausedSessionState does, but simplified for synchronous execution.
    // It directly creates the state and saves it.
    if (!this.routine()) return;

    let currentSessionElapsed = this.sessionTimerElapsedSecondsBeforePause;
    if (this.sessionState() === SessionState.Playing && this.workoutStartTime > 0) {
      currentSessionElapsed += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    }

    const stateToSave: PausedWorkoutState = {
      version: this.PAUSED_STATE_VERSION,
      routineId: this.routineId,
      sessionRoutine: JSON.parse(JSON.stringify(this.routine())),
      currentExerciseIndex: this.currentExerciseIndex(),
      currentSetIndex: this.currentSetIndex(),
      currentWorkoutLogExercises: JSON.parse(JSON.stringify(this.currentWorkoutLogExercises())),
      workoutStartTimeOriginal: this.workoutStartTime,
      sessionTimerElapsedSecondsBeforePause: currentSessionElapsed,
      currentBlockRound: this.currentBlockRound(),
      totalBlockRounds: this.totalBlockRounds(),
      timedSetTimerState: this.timedSetTimerState(), // Capture current state
      timedSetElapsedSeconds: this.timedSetElapsedSeconds(),
      isResting: this.isRestTimerVisible(),
      isRestTimerVisibleOnPause: this.isRestTimerVisible(), // Capture current state
      restTimerRemainingSecondsOnPause: this.isRestTimerVisible() && this.restDuration() > 0 ? this.restDuration() - this.timedSetElapsedSeconds() : 0, // Approx.
      restTimerInitialDurationOnPause: this.isRestTimerVisible() ? this.restDuration() : 0,
      restTimerMainTextOnPause: this.restTimerMainText(),
      restTimerNextUpTextOnPause: this.restTimerNextUpText(),
      lastPerformanceForCurrentExercise: this.lastPerformanceForCurrentExercise ? JSON.parse(JSON.stringify(this.lastPerformanceForCurrentExercise)) : null,
    };
    try {
      this.storageService.setItem(this.PAUSED_WORKOUT_KEY, stateToSave);
      console.log('Session state attempt saved via beforeunload.');
    } catch (e) {
      console.error('Error saving state during beforeunload:', e);
    }
  }


  ngOnDestroy(): void {
    // Primary role of ngOnDestroy here is to clean up subscriptions.
    // Saving state for "resume later" is best handled by explicit pause or beforeunload.
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
    this.isRestTimerVisible.set(false);
    console.log('WorkoutPlayerComponent destroyed.');
  }

}