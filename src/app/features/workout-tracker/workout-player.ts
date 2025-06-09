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
import { UnitsService } from '../../core/services/units.service';
import { ToastService } from '../../core/services/toast.service';

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
  actualWeight?: number | null;
  actualDuration?: number;
  notes?: string;
  isWarmup: boolean; // From setData.isWarmup
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
  protected toastService = inject(ToastService);
  private fb = inject(FormBuilder);
  private storageService = inject(StorageService);
  private cdr = inject(ChangeDetectorRef);
  private unitService = inject(UnitsService);

  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';
  private readonly PAUSED_STATE_VERSION = '1.0';

  nextActionButtonLabel = signal<string>('SET DONE');

  isRestTimerVisible = signal(false);
  restDuration = signal(0);
  restTimerMainText = signal('RESTING');
  restTimerNextUpText = signal<string | null>(null);

  currentSetForm!: FormGroup;

  routineId: string | null = null;
  routine = signal<Routine | null | undefined>(undefined);

  currentExerciseIndex = signal(0);
  currentSetIndex = signal(0);

  private currentWorkoutLogExercises = signal<LoggedWorkoutExercise[]>([]);
  private workoutStartTime: number = 0;

  private routeSub: Subscription | undefined;
  private timerSub: Subscription | undefined;

  sessionTimerDisplay = signal('00:00:00');
  restTimerDisplay = signal<string | null>(null);

  currentBlockRound = signal(1);
  totalBlockRounds = signal(1);

  private wasRestTimerVisibleOnPause = false;
  private restTimerRemainingSecondsOnPause = 0;
  private restTimerInitialDurationOnPause = 0;
  private restTimerMainTextOnPause = 'RESTING';
  private restTimerNextUpTextOnPause: string | null = null;

  rpeValue = signal<number | null>(null);
  rpeOptions: number[] = Array.from({ length: 10 }, (_, i) => i + 1);
  showRpeSlider = signal(false);

  timedSetTimerState = signal<TimedSetState>(TimedSetState.Idle);
  timedSetElapsedSeconds = signal(0); // Always counts up, total time for the current set timer
  private timedSetIntervalSub: Subscription | undefined;

  // Computed signal for displaying countdown or elapsed time
  readonly timedSetDisplay = computed(() => {
    const state = this.timedSetTimerState();
    const elapsed = this.timedSetElapsedSeconds();
    const activeInfo = this.activeSetInfo();
    // Target duration for the current set, if defined
    const targetDuration = activeInfo?.setData?.duration;

    if (state === TimedSetState.Idle) {
      // In idle state, show the target duration for countdown sets, or 0/form value.
      // If it's a timed set (targetDuration > 0), display the target.
      // Otherwise, display what's in the form (could be 0 or manually entered).
      return (targetDuration !== undefined && targetDuration > 0 ? targetDuration : (this.csf?.['actualDuration']?.value ?? 0)).toString();
    }

    // Timer is running or paused
    if (targetDuration !== undefined && targetDuration > 0) {
      // Primarily a timed set with a target, show countdown
      const remaining = targetDuration - elapsed;
      return remaining.toString();
    } else {
      // Timer is used ad-hoc, or target is 0/undefined. Show elapsed time (count up).
      return elapsed.toString();
    }
  });

  // Computed signal to check if the timed set is in overtime
  readonly isTimedSetOvertime = computed(() => {
    const state = this.timedSetTimerState();
    if (state === TimedSetState.Idle) return false; // Not overtime if idle

    const elapsed = this.timedSetElapsedSeconds();
    const targetDuration = this.activeSetInfo()?.setData?.duration;
    // Overtime if there's a positive target duration and elapsed time has exceeded it
    return targetDuration !== undefined && targetDuration > 0 && elapsed > targetDuration;
  });


  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: BeforeUnloadEvent): void {
    if (this.sessionState() === SessionState.Playing && this.routine() && this.currentWorkoutLogExercises().length > 0) {
      this.captureAndSaveStateForUnload();
    }
  }
  
  protected get weightUnitDisplaySymbol(): string {
    return this.unitService.getUnitLabel();
  }

  getWorkingSetCountForCurrentExercise = computed<number>(() => {
    const r = this.routine();
    const exIndex = this.currentExerciseIndex();
    if (r && r.exercises[exIndex]) {
      return r.exercises[exIndex].sets.filter(s => !s.isWarmup).length;
    }
    return 0;
  });

  getCurrentWorkingSetNumber = computed<number>(() => {
    const activeInfo = this.activeSetInfo();
    const r = this.routine();
    if (!activeInfo || !r || activeInfo.isWarmup) {
      return 0;
    }
    const currentExercise = r.exercises[activeInfo.exerciseIndex];
    let workingSetCounter = 0;
    for (let i = 0; i <= activeInfo.setIndex; i++) {
      if (!currentExercise.sets[i].isWarmup) {
        workingSetCounter++;
      }
      if (i === activeInfo.setIndex) {
        return workingSetCounter;
      }
    }
    return 0;
  });


  getCurrentWarmupSetNumber = computed<number>(() => {
    const activeInfo = this.activeSetInfo();
    const r = this.routine();
    if (!activeInfo || !r || !activeInfo.isWarmup) {
      return 0;
    }
    const currentExercise = r.exercises[activeInfo.exerciseIndex];
    let warmupSetCounter = 0;
    for (let i = 0; i <= activeInfo.setIndex; i++) {
      if (currentExercise.sets[i].isWarmup) {
        warmupSetCounter++;
      }
      if (i === activeInfo.setIndex) {
        return warmupSetCounter;
      }
    }
    return 0;
  });

  activeSetInfo = computed<ActiveSetInfo | null>(() => {
    const r = this.routine();
    const exIndex = this.currentExerciseIndex();
    const sIndex = this.currentSetIndex();

    if (r && r.exercises[exIndex] && r.exercises[exIndex].sets[sIndex]) {
      const exerciseData = r.exercises[exIndex];
      const setData = r.exercises[exIndex].sets[sIndex];
      const completedExerciseLog = this.currentWorkoutLogExercises().find(logEx => logEx.exerciseId === exerciseData.exerciseId);
      const completedSetLog = completedExerciseLog?.sets.find(logSet => logSet.plannedSetId === setData.id);

      return {
        exerciseIndex: exIndex,
        setIndex: sIndex,
        exerciseData: exerciseData,
        setData: setData,
        isWarmup: !!setData.isWarmup,
        baseExerciseInfo: undefined,
        isCompleted: !!completedSetLog,
        actualReps: completedSetLog?.repsAchieved,
        actualWeight: completedSetLog?.weightUsed,
        actualDuration: completedSetLog?.durationPerformed,
        notes: completedSetLog?.notes,
      };
    }
    return null;
  });

  currentBaseExercise = signal<Exercise | null | undefined>(undefined);
  exercisePBs = signal<PersonalBestSet[]>([]);

  allPreviousLoggedSetsForCurrentExercise = computed<LoggedSet[]>(() => {
    const activeInfo = this.activeSetInfo();
    if (!activeInfo || activeInfo.setIndex === 0) {
      return [];
    }
    const loggedExerciseContainer = this.currentWorkoutLogExercises()
      .find(exLog => exLog.exerciseId === activeInfo.exerciseData.exerciseId);

    if (loggedExerciseContainer && loggedExerciseContainer.sets.length > 0) {
      const previousLoggedSets: LoggedSet[] = [];
      for (let i = 0; i < activeInfo.setIndex; i++) {
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

  editingTarget: 'reps' | 'weight' | 'duration' | null = null;
  editingTargetValue: number | string = '';


  sessionState = signal<SessionState>(SessionState.Loading);
  private sessionTimerElapsedSecondsBeforePause = 0;
  // private timedSetElapsedSecondsBeforePause = 0; // Not used, timedSetElapsedSeconds handles pause state directly
  private wasTimedSetRunningOnPause = false;

  isWorkoutMenuVisible = signal(false);
  isPerformanceInsightsVisible = signal(false);
  showCompletedSetsInfo = signal<boolean>(false);

  constructor() {
    this.initializeCurrentSetForm();
  }

  async ngOnInit(): Promise<void> {
    window.scrollTo(0, 0);
    const hasPausedSession = await this.checkForPausedSession();
    if (!hasPausedSession) {
      this.loadNewWorkoutFromRoute();
    }
  }

  private resetAndPatchCurrentSetForm(): void {
    this.currentSetForm.reset({ rpe: null });
    this.rpeValue.set(null);
    this.showRpeSlider.set(false);

    const activeInfo = this.activeSetInfo();
    this.resetTimedSet(); // This now also resets timedSetElapsedSeconds to 0

    if (activeInfo) {
      const completedExerciseLog = this.currentWorkoutLogExercises().find(logEx => logEx.exerciseId === activeInfo.exerciseData.exerciseId);
      const completedSetLog = completedExerciseLog?.sets.find(logSet => logSet.plannedSetId === activeInfo.setData.id);

      let initialActualDuration = activeInfo.setData.duration ?? null;
      if (completedSetLog && completedSetLog.durationPerformed !== undefined) {
        initialActualDuration = completedSetLog.durationPerformed;
      }
      
      this.currentSetForm.patchValue({
        actualReps: completedSetLog?.repsAchieved ?? activeInfo.setData.reps ?? null,
        actualWeight: completedSetLog?.weightUsed ?? activeInfo.setData.weight ?? null,
        actualDuration: initialActualDuration, // Use target duration for new sets, or logged for completed
        setNotes: completedSetLog?.notes ?? '',
        rpe: null // RPE always resets for a new attempt
      });
       // If it's a purely timed set, actualDuration might be used by the timer display logic.
       // The form control `actualDuration` will store the target initially for display,
       // then it will be updated with ELAPSED seconds when timer runs.
    }
  }

  private startSessionTimer(): void {
    if (this.sessionState() === SessionState.Paused) return;
    if (this.timerSub) this.timerSub.unsubscribe();

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
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    this.restTimerDisplay.set(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
  }


  private addLoggedSetToCurrentLog(exerciseData: WorkoutExercise, loggedSet: LoggedSet): void {
    const logs = this.currentWorkoutLogExercises();
    let exerciseLog = logs.find(exLog => exLog.exerciseId === exerciseData.exerciseId);

    if (exerciseLog) {
      const existingSetIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === loggedSet.plannedSetId);
      if (existingSetIndex > -1) {
        exerciseLog.sets[existingSetIndex] = loggedSet;
      } else {
        exerciseLog.sets.push(loggedSet);
      }
      this.currentWorkoutLogExercises.set([...logs]);
    } else {
      exerciseLog = {
        exerciseId: exerciseData.exerciseId,
        exerciseName: this.currentBaseExercise()?.name || exerciseData.exerciseName || 'Unknown Exercise',
        sets: [loggedSet]
      };
      this.currentWorkoutLogExercises.set([...logs, exerciseLog]);
    }
  }

  finishWorkout(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Please resume the workout before finishing.", 3000, "Session Paused");
      return;
    }
    if (this.sessionState() === SessionState.Loading) {
      this.toastService.info("Workout is still loading.", 3000, "Loading");
      return;
    }

    if (this.timerSub) this.timerSub.unsubscribe();

    const sessionRoutineValue = this.routine();
    const endTime = Date.now();
    // Ensure workoutStartTime is valid before calculation
    const durationMinutes = this.workoutStartTime > 0 ? Math.round((endTime - this.workoutStartTime + (this.sessionTimerElapsedSecondsBeforePause * 1000) ) / (1000 * 60)) : 0;


    const finalLog: Omit<WorkoutLog, 'id'> = {
      routineId: this.routineId || undefined,
      routineName: sessionRoutineValue?.name || 'Ad-hoc Workout',
      startTime: this.workoutStartTime - (this.sessionTimerElapsedSecondsBeforePause * 1000), // Adjust for total session
      endTime: endTime,
      durationMinutes: durationMinutes,
      exercises: this.currentWorkoutLogExercises(),
      date: new Date(this.workoutStartTime - (this.sessionTimerElapsedSecondsBeforePause * 1000)).toISOString().split('T')[0],
    };

    const savedLog = this.trackingService.addWorkoutLog(finalLog);
    this.toastService.success(`Workout "${finalLog.routineName}" logged!`, 5000, "Workout Finished");

    if (this.routineId && sessionRoutineValue) {
      this.workoutService.getRoutineById(this.routineId).pipe(take(1)).subscribe(originalRoutine => {
        if (originalRoutine) {
          const updatedOriginalRoutine = {
            ...originalRoutine,
            lastPerformed: new Date(finalLog.startTime).toISOString()
          };
          this.workoutService.updateRoutine(updatedOriginalRoutine);
        }
      });
    }

    this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
    this.router.navigate(['/workout/summary', savedLog.id]);
  }

  get csf() {
    return this.currentSetForm.controls;
  }

  toggleTimedSetTimer(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Please resume to use the timer.", 3000, "Paused");
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
    if (this.timedSetTimerState() === TimedSetState.Idle) {
      this.timedSetElapsedSeconds.set(0); // Reset elapsed time only when starting fresh from Idle
       // Pre-fill actualDuration with target if it's a timed set and timer starts from idle
      const targetDuration = this.activeSetInfo()?.setData?.duration;
      if (targetDuration !== undefined && targetDuration > 0) {
          this.currentSetForm.get('actualDuration')?.setValue(targetDuration, { emitEvent: false });
      }
    }
    // If resuming, timedSetElapsedSeconds already holds the paused value.

    this.timedSetTimerState.set(TimedSetState.Running);
    if (this.timedSetIntervalSub) {
      this.timedSetIntervalSub.unsubscribe();
    }
    this.timedSetIntervalSub = timer(0, 1000).subscribe(() => {
      if (this.timedSetTimerState() === TimedSetState.Running) {
        this.timedSetElapsedSeconds.update(s => s + 1);
        // Update the hidden form control that will be logged with total ELAPSED time
        this.currentSetForm.get('actualDuration')?.setValue(this.timedSetElapsedSeconds(), { emitEvent: false });
      } else {
        // Timer was stopped or paused externally, clean up subscription
        if(this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
      }
    });
  }

  private pauseTimedSet(): void {
    if (this.timedSetIntervalSub) {
      this.timedSetIntervalSub.unsubscribe();
      this.timedSetIntervalSub = undefined;
    }
    this.timedSetTimerState.set(TimedSetState.Paused);
    // timedSetElapsedSeconds holds the current elapsed time
  }

  resetTimedSet(): void {
    if (this.timedSetIntervalSub) {
      this.timedSetIntervalSub.unsubscribe();
      this.timedSetIntervalSub = undefined;
    }
    this.timedSetTimerState.set(TimedSetState.Idle);
    this.timedSetElapsedSeconds.set(0);
    // When resetting, set form's actualDuration to target, or 0 if no target
    const targetDuration = this.activeSetInfo()?.setData?.duration;
    this.currentSetForm.get('actualDuration')?.setValue(targetDuration ?? 0, { emitEvent: false });
  }

  stopAndLogTimedSet(): void { // Called when completing set
    if (this.timedSetTimerState() === TimedSetState.Running || this.timedSetTimerState() === TimedSetState.Paused) {
      this.pauseTimedSet(); // Ensure timer is stopped, timedSetElapsedSeconds has the final value
      // The form control 'actualDuration' should already have been updated by the timer subscription
    }
  }
  // ... (rest of the methods from the previous good answer, with modifications below for pause/resume and logging)

  // Ensure all existing methods are here, then we'll modify/add

  checkIfLatestSetOfExercise(): boolean {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    if (!activeInfo || !routine) return false;
    const currentExercise = routine.exercises[activeInfo.exerciseIndex];
    if (activeInfo.setIndex === currentExercise.sets.length - 1) return true;
    for (let i = activeInfo.setIndex + 1; i < currentExercise.sets.length; i++) {
      if (!currentExercise.sets[i].isWarmup) {
        return false;
      }
    }
    return true;
  }

  checkIfLatestSetOfWorkout(): boolean {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    if (!activeInfo || !routine) return false;
    if (activeInfo.exerciseIndex === routine.exercises.length - 1) {
      return this.checkIfLatestSetOfExercise();
    }
    for (let i = activeInfo.exerciseIndex + 1; i < routine.exercises.length; i++) {
      const futureExercise = routine.exercises[i];
      if (futureExercise.sets.some(s => !s.isWarmup)) {
        return false;
      }
    }
    return this.checkIfLatestSetOfExercise();
  }
  
  private async fetchLastPerformanceAndPatchForm(): Promise<void> {
    await this.prepareCurrentSet();
  }


  private patchCurrentSetFormWithData(activeInfo: ActiveSetInfo): void {
    this.patchActualsFormBasedOnSessionTargets();
  }

  startEditTarget(field: 'reps' | 'weight' | 'duration'): void {
    const activeInfo = this.activeSetInfo();
    if (!activeInfo) return;
    this.editingTarget = field;
    switch (field) {
      case 'reps': this.editingTargetValue = activeInfo.setData.reps ?? ''; break;
      case 'weight': this.editingTargetValue = activeInfo.setData.weight ?? ''; break;
      case 'duration': this.editingTargetValue = activeInfo.setData.duration ?? ''; break;
    }
  }

  cancelEditTarget(): void {
    this.editingTarget = null;
    this.editingTargetValue = '';
  }

  formatPbValue(pb: PersonalBestSet): string {
    let value = '';
    if (pb.weightUsed !== undefined && pb.weightUsed !== null) {
      value += `${pb.weightUsed}${this.unitService.getUnitSuffix()}`; // Use unit service
      if (pb.repsAchieved > 1 && !pb.pbType.includes('RM (Actual)')) {
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
    this.currentSetForm = this.fb.group({
      actualReps: [null as number | null, [Validators.min(0)]],
      actualWeight: [null as number | null, [Validators.min(0)]],
      actualDuration: [null as number | null, [Validators.min(0)]], // Will store total elapsed for timed sets
      setNotes: [''],
      rpe: [null as number | null, [Validators.min(1), Validators.max(10)]]
    });
  }

  private async prepareCurrentSet(): Promise<void> {
    if (this.sessionState() === SessionState.Paused) {
      console.log("PrepareCurrentSet: Session is paused, deferring preparation.");
      return;
    }
    const sessionRoutine = this.routine();
    const exIndex = this.currentExerciseIndex();
    const sIndex = this.currentSetIndex();

    if (!sessionRoutine || !sessionRoutine.exercises[exIndex] || !sessionRoutine.exercises[exIndex].sets[sIndex]) {
      this.currentSetForm.reset({ rpe: null }); 
      this.rpeValue.set(null);
      this.showRpeSlider.set(false);
      this.resetTimedSet(); // Ensure timer state is reset
      this.currentBaseExercise.set(null);
      this.exercisePBs.set([]);
      this.lastPerformanceForCurrentExercise = null;
      console.warn('prepareCurrentSet: Could not find active set data in session routine.');
      return;
    }

    const currentExerciseData = sessionRoutine.exercises[exIndex];
    const originalPlannedSetForThisSet = currentExerciseData.sets[sIndex];

    this.loadBaseExerciseAndPBs(currentExerciseData.exerciseId);

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

    const historicalSetPerformance = this.trackingService.findPreviousSetPerformance(
      this.lastPerformanceForCurrentExercise,
      originalPlannedSetForThisSet,
      sIndex
    );

    let finalSetParamsForSession: ExerciseSetParams;

    if (originalPlannedSetForThisSet.isWarmup) {
      finalSetParamsForSession = {
        ...originalPlannedSetForThisSet,
        reps: originalPlannedSetForThisSet.reps ?? 8,
        weight: originalPlannedSetForThisSet.weight ?? null,
        restAfterSet: originalPlannedSetForThisSet.restAfterSet ?? 30,
      };
    } else {
      const suggestedSetParams = this.workoutService.suggestNextSetParameters(
        historicalSetPerformance,
        originalPlannedSetForThisSet,
        sessionRoutine.goal
      );
      finalSetParamsForSession = {
        ...suggestedSetParams,
        id: originalPlannedSetForThisSet.id,
        notes: suggestedSetParams.notes ?? originalPlannedSetForThisSet.notes,
        isWarmup: false,
      };
    }

    const updatedRoutineForSession = JSON.parse(JSON.stringify(sessionRoutine)) as Routine;
    updatedRoutineForSession.exercises[exIndex].sets[sIndex] = finalSetParamsForSession;
    this.routine.set(updatedRoutineForSession);

    this.patchActualsFormBasedOnSessionTargets(); // This will call resetTimedSet()
  }

  private patchActualsFormBasedOnSessionTargets(): void {
    if (this.sessionState() === SessionState.Paused) {
      console.log("patchActualsFormBasedOnSessionTargets: Session is paused, deferring preparation.");
      return;
    }
    this.currentSetForm.reset({ rpe: null }); 
    this.rpeValue.set(null); 
    this.showRpeSlider.set(false); 
    this.resetTimedSet(); // Crucial: resets timer state and elapsed seconds to 0

    const activeInfo = this.activeSetInfo();
    if (!activeInfo) return;

    const completedExerciseLog = this.currentWorkoutLogExercises().find(logEx => logEx.exerciseId === activeInfo.exerciseData.exerciseId);
    const completedSetLogThisSession = completedExerciseLog?.sets.find(logSet => logSet.plannedSetId === activeInfo.setData.id);

    let initialActualDuration = activeInfo.setData.duration ?? null;
    if (completedSetLogThisSession && completedSetLogThisSession.durationPerformed !== undefined) {
        initialActualDuration = completedSetLogThisSession.durationPerformed;
    }


    if (completedSetLogThisSession) {
      this.currentSetForm.patchValue({
        actualReps: completedSetLogThisSession.repsAchieved,
        actualWeight: completedSetLogThisSession.weightUsed,
        actualDuration: initialActualDuration,
        setNotes: completedSetLogThisSession.notes,
        // rpe: completedSetLogThisSession.rpe 
      });
      // if (completedSetLogThisSession.rpe) this.rpeValue.set(completedSetLogThisSession.rpe);

    } else {
      this.currentSetForm.patchValue({
        actualReps: activeInfo.setData.reps ?? (activeInfo.isWarmup ? 8 : null),
        actualWeight: activeInfo.setData.weight ?? (activeInfo.isWarmup ? null : null),
        actualDuration: initialActualDuration, // For new sets, this is targetDuration
        setNotes: activeInfo.setData.notes || (activeInfo.isWarmup ? 'Warm-up' : ''),
        rpe: null 
      });
    }
  }

  private loadBaseExerciseAndPBs(exerciseId: string): void {
    this.currentBaseExercise.set(undefined);
    this.exercisePBs.set([]);
    this.exerciseService.getExerciseById(exerciseId).subscribe(ex => {
      this.currentBaseExercise.set(ex ? { ...ex, iconName: this.exerciseService.determineExerciseIcon(ex, ex?.name) } : null);
    });
    this.trackingService.getAllPersonalBestsForExercise(exerciseId).pipe(take(1)).subscribe(pbs => this.exercisePBs.set(pbs));
  }

  private navigateToNextStepInWorkout(completedActiveInfo: ActiveSetInfo, currentSessionRoutine: Routine): void {
    const currentGlobalExerciseIndex = completedActiveInfo.exerciseIndex;
    const currentGlobalSetIndex = completedActiveInfo.setIndex;
    const currentPlayedExercise = currentSessionRoutine.exercises[currentGlobalExerciseIndex];

    let nextExerciseGlobalIndex = currentGlobalExerciseIndex;
    let nextSetIndexInExercise = 0;
    let exerciseBlockChanged = false;

    if (currentGlobalSetIndex < currentPlayedExercise.sets.length - 1) {
      nextSetIndexInExercise = currentGlobalSetIndex + 1;
    } else {
      if (currentPlayedExercise.supersetId &&
        currentPlayedExercise.supersetOrder !== null &&
        (currentPlayedExercise.supersetSize !== null && currentPlayedExercise.supersetSize !== undefined) &&
        currentPlayedExercise.supersetOrder < currentPlayedExercise.supersetSize - 1) {
        nextExerciseGlobalIndex++;
        if (!(nextExerciseGlobalIndex < currentSessionRoutine.exercises.length &&
          currentSessionRoutine.exercises[nextExerciseGlobalIndex].supersetId === currentPlayedExercise.supersetId)) {
          const foundBlockIdx = this.findNextExerciseBlockStartIndex(currentGlobalExerciseIndex, currentSessionRoutine);
          if (foundBlockIdx !== -1) {
            nextExerciseGlobalIndex = foundBlockIdx;
            exerciseBlockChanged = true;
          } else { this.finishWorkout(); return; }
        }
      } else {
        const currentBlockTotalRounds = this.totalBlockRounds();
        if (this.currentBlockRound() < currentBlockTotalRounds) {
          this.currentBlockRound.update(r => r + 1);
          if (currentPlayedExercise.supersetId && currentPlayedExercise.supersetOrder !== null) {
            nextExerciseGlobalIndex = currentGlobalExerciseIndex - currentPlayedExercise.supersetOrder;
          }
        } else {
          const foundBlockIdx = this.findNextExerciseBlockStartIndex(currentGlobalExerciseIndex, currentSessionRoutine);
          if (foundBlockIdx !== -1) {
            nextExerciseGlobalIndex = foundBlockIdx;
            exerciseBlockChanged = true;
          } else {
            this.finishWorkout();
            return;
          }
        }
      }
    }

    if (exerciseBlockChanged) {
      this.currentBlockRound.set(1);
      const newBlockStarterExercise = currentSessionRoutine.exercises[nextExerciseGlobalIndex];
      if (!newBlockStarterExercise.supersetId || newBlockStarterExercise.supersetOrder === 0) {
        this.totalBlockRounds.set(newBlockStarterExercise.rounds ?? 1);
      } else {
        const actualBlockStart = currentSessionRoutine.exercises.find(ex => ex.supersetId === newBlockStarterExercise.supersetId && ex.supersetOrder === 0);
        this.totalBlockRounds.set(actualBlockStart?.rounds ?? 1);
      }
      this.lastPerformanceForCurrentExercise = null;
    }

    // Start rest period AFTER currentExerciseIndex and currentSetIndex are updated for the *next* set.
    // This allows getNextUpText to correctly identify the upcoming exercise/set.
    this.currentExerciseIndex.set(nextExerciseGlobalIndex);
    this.currentSetIndex.set(nextSetIndexInExercise);
    
    if (completedActiveInfo.setData.restAfterSet > 0) {
        this.startRestPeriod(completedActiveInfo.setData.restAfterSet);
    }

    this.prepareCurrentSet(); // This will also call resetTimedSet() implicitly via patchActualsForm...
  }

  confirmEditTarget(): void {
    const activeInfoOriginal = this.activeSetInfo();
    if (!activeInfoOriginal || this.editingTarget === null) return;
    const numericValue = parseFloat(this.editingTargetValue as string);
    if (isNaN(numericValue) || numericValue < 0) {
      this.toastService.error(`Invalid value for ${this.editingTarget}. Must be non-negative.`, 3000, "Input Error");
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
    routineSignal.set(updatedRoutineForSession);
    this.toastService.success(`Target ${this.editingTarget} updated to ${numericValue}.`, 3000, "Target Updated");
    this.cancelEditTarget();
    this.patchActualsFormBasedOnSessionTargets();
  }

  completeSetAndProceed(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Please resume to continue.", 3000, "Paused");
      return;
    }
    const activeInfo = this.activeSetInfo();
    const currentRoutineValue = this.routine();
    if (!activeInfo || !currentRoutineValue) {
      console.error("Cannot complete set: activeInfo or routine is not available.");
      this.toastService.error("Cannot complete set: data missing.", 0, "Error");
      return;
    }
    
    // Stop timer if it was active for a timed set. This ensures timedSetElapsedSeconds is final.
    if (activeInfo.setData.duration && activeInfo.setData.duration > 0 && 
        (this.timedSetTimerState() === TimedSetState.Running || this.timedSetTimerState() === TimedSetState.Paused)) {
      this.stopAndLogTimedSet();
    }

    if (this.currentSetForm.invalid) {
      this.currentSetForm.markAllAsTouched();
      let firstInvalidControl = '';
      for (const key of Object.keys(this.currentSetForm.controls)) {
        if (this.currentSetForm.controls[key].invalid) {
          firstInvalidControl = key;
          break;
        }
      }
      this.toastService.error(`Please correct input: ${firstInvalidControl ? firstInvalidControl + ' is invalid.' : 'form invalid.' }`, 0, 'Validation Error');
      return;
    }

    const formValues = this.currentSetForm.value;
    
    // For durationPerformed, ensure we use the actual elapsed time if a timer ran,
    // otherwise use the form value (which might be a manually entered duration or target)
    let durationToLog = formValues.actualDuration;
    if (activeInfo.setData.duration && activeInfo.setData.duration > 0 && this.timedSetElapsedSeconds() > 0) {
      // If it was a timed set and timer ran, log the total elapsed seconds
      durationToLog = this.timedSetElapsedSeconds();
    } else if (formValues.actualDuration === null && activeInfo.setData.duration) {
      // If user didn't run timer and didn't input duration, but there was a target, log target
      durationToLog = activeInfo.setData.duration;
    }


    const loggedSetData: LoggedSet = {
      id: activeInfo.setData.id, // Or generate a new unique ID for the logged set if preferred: uuidv4()
      plannedSetId: activeInfo.setData.id,
      exerciseId: activeInfo.exerciseData.exerciseId,
      isWarmup: !!activeInfo.setData.isWarmup,
      repsAchieved: formValues.actualReps ?? (activeInfo.setData.isWarmup ? 0 : activeInfo.setData.reps ?? 0),
      weightUsed: formValues.actualWeight ?? (activeInfo.setData.isWarmup ? null : activeInfo.setData.weight),
      durationPerformed: durationToLog,
      // rpe: formValues.rpe ?? undefined,
      targetReps: activeInfo.setData.reps,
      targetWeight: activeInfo.setData.weight,
      targetDuration: activeInfo.setData.duration,
      targetTempo: activeInfo.setData.tempo,
      notes: formValues.setNotes || undefined,
      timestamp: new Date().toISOString(),
    };
    this.addLoggedSetToCurrentLog(activeInfo.exerciseData, loggedSetData);

    if (this.sessionState() === SessionState.Playing) {
      this.captureAndSaveStateForUnload();
    }
    // resetTimedSet() is called within patchActualsFormBasedOnSessionTargets, which is called by prepareCurrentSet
    // No need to call it directly here, as navigateToNextStepInWorkout -> prepareCurrentSet will handle it.
    
    this.rpeValue.set(null);
    this.showRpeSlider.set(false);
    // this.currentSetForm.get('rpe')?.reset(); // Done in resetAndPatchCurrentSetForm

    this.navigateToNextStepInWorkout(activeInfo, currentRoutineValue);
  }

  private findNextExerciseBlockStartIndex(currentExerciseGlobalIndex: number, routine: Routine): number {
    for (let i = currentExerciseGlobalIndex + 1; i < routine.exercises.length; i++) {
      const nextEx = routine.exercises[i];
      if (!nextEx.supersetId || nextEx.supersetOrder === 0) {
        return i;
      }
    }
    return -1;
  }

  getNextUpText(completedActiveSetInfo: ActiveSetInfo | null, currentSessionRoutine: Routine | null): string {
    if (!completedActiveSetInfo || !currentSessionRoutine) return 'Next Set/Exercise';

    const curExGlobalIdx = completedActiveSetInfo.exerciseIndex;
    const curSetData = completedActiveSetInfo.setData; 
    const curPlayedEx = currentSessionRoutine.exercises[curExGlobalIdx];
    const allSetsForCurrentExercise = curPlayedEx.sets;
    const indexOfCompletedSetInExercise = allSetsForCurrentExercise.findIndex(s => s.id === curSetData.id);

    if (curSetData.isWarmup) {
      if (indexOfCompletedSetInExercise < allSetsForCurrentExercise.length - 1) {
        const nextSetCandidate = allSetsForCurrentExercise[indexOfCompletedSetInExercise + 1];
        if (nextSetCandidate.isWarmup) {
          let nextWarmupSetNumber = 0;
          for (let i = 0; i <= indexOfCompletedSetInExercise + 1; i++) {
            if (allSetsForCurrentExercise[i].isWarmup) nextWarmupSetNumber++;
          }
          return `Warm-up Set ${nextWarmupSetNumber} of ${curPlayedEx.exerciseName}`;
        } else {
          let firstWorkingSetNumber = 0;
          for (let i = 0; i <= indexOfCompletedSetInExercise + 1; i++) {
            if (!allSetsForCurrentExercise[i].isWarmup) firstWorkingSetNumber++;
          }
          return `Set ${firstWorkingSetNumber} of ${curPlayedEx.exerciseName}`;
        }
      }
    }

    if (indexOfCompletedSetInExercise < allSetsForCurrentExercise.length - 1) {
      const nextSetInExercise = allSetsForCurrentExercise[indexOfCompletedSetInExercise + 1];
      const setType = nextSetInExercise.isWarmup ? "Warm-up" : "Set";
      let typeCounter = 0;
      for (let i = 0; i <= indexOfCompletedSetInExercise + 1; i++) {
        if (!!allSetsForCurrentExercise[i].isWarmup === !!nextSetInExercise.isWarmup) typeCounter++;
      }
      return `${setType} ${typeCounter} of ${curPlayedEx.exerciseName}`;
    }

    if (curPlayedEx.supersetId && curPlayedEx.supersetOrder !== null && curPlayedEx.supersetSize &&
      curPlayedEx.supersetOrder < curPlayedEx.supersetSize - 1) {
      const nextSupersetExIndex = curExGlobalIdx + 1;
      if (nextSupersetExIndex < currentSessionRoutine.exercises.length &&
        currentSessionRoutine.exercises[nextSupersetExIndex].supersetId === curPlayedEx.supersetId) {
        const firstSetOfNextSupersetEx = currentSessionRoutine.exercises[nextSupersetExIndex].sets[0];
        const setType = firstSetOfNextSupersetEx.isWarmup ? "Warm-up Set 1" : "Set 1";
        return `SUPERSET: ${setType} of ${currentSessionRoutine.exercises[nextSupersetExIndex].exerciseName}`;
      }
    }

    const currentBlockTotalRounds = this.totalBlockRounds();
    if (this.currentBlockRound() < currentBlockTotalRounds) {
      let blockStartIndex = curExGlobalIdx;
      if (curPlayedEx.supersetId && curPlayedEx.supersetOrder !== null) {
        blockStartIndex = curExGlobalIdx - curPlayedEx.supersetOrder;
      }
      const nextRoundFirstExercise = currentSessionRoutine.exercises[blockStartIndex];
      const nextRoundFirstSet = nextRoundFirstExercise.sets[0];
      const nextRoundSetType = nextRoundFirstSet.isWarmup ? "Warm-up Set 1" : "Set 1";
      return `Round ${this.currentBlockRound() + 1}: ${nextRoundSetType} of ${nextRoundFirstExercise.exerciseName}`;
    }

    const nextBlockStartIndex = this.findNextExerciseBlockStartIndex(curExGlobalIdx, currentSessionRoutine);
    if (nextBlockStartIndex !== -1) {
      const nextBlockFirstExercise = currentSessionRoutine.exercises[nextBlockStartIndex];
      const nextBlockFirstSet = nextBlockFirstExercise.sets[0];
      const nextBlockSetType = nextBlockFirstSet.isWarmup ? "Warm-up Set 1" : "Set 1";
      return `${nextBlockSetType} of ${nextBlockFirstExercise.exerciseName}`;
    }
    return 'Finish Workout!';
  }

  getDisabled(): boolean { 
    return this.timedSetTimerState() === TimedSetState.Running || this.sessionState() === SessionState.Paused;
  }

  private startRestPeriod(duration: number, isResumingPausedRest: boolean = false): void {
    if (this.sessionState() === SessionState.Paused && !isResumingPausedRest) {
      this.wasRestTimerVisibleOnPause = true;
      this.restTimerRemainingSecondsOnPause = duration;
      this.restTimerInitialDurationOnPause = duration;
      this.restTimerMainTextOnPause = (this.activeSetInfo()?.setData?.restAfterSet === 0 && this.activeSetInfo()?.exerciseData?.supersetId) ? 'SUPERSET TRANSITION' : 'RESTING';
      // Use current indices because getNextUpText is for what *will be* next AFTER this rest
      const nextActiveSetInfo = this.activeSetInfo(); // This is now for the *next* set
      if (this.routine() && nextActiveSetInfo) {
         // To get the "next up" text correctly, we need to simulate being at the set *before* the one we are resting for.
         // This is tricky. For simplicity, let's use the *current* activeSetInfo which is already set for the next set.
         // A more accurate "next up" for rest might need to look ahead based on *completed* set.
         // The current getNextUpText needs the COMPLETED set info.
         // We don't have completedActiveSetInfo easily here.
         // Let's pass null for now, or the current activeSetInfo which is the *next* one.
         // For now, we will use activeSetInfo() to determine "Next Up" for the rest timer,
         // assuming it points to the set that will be active *after* the rest.
         // This logic might need refinement if getNextUpText expects the *just completed* set.

         // Correction: getNextUpText is usually called *after* a set is completed.
         // Here, we are starting rest *before* preparing the next set UI but after advancing indices.
         // So activeSetInfo() refers to the *next* upcoming set.
         // getNextUpText expects the *completed* set info to determine what's next.
         // This means restTimerNextUpTextOnPause might be slightly off if calculated here using the *next* set info.
         // However, for UI consistency, let's use current activeSetInfo as it points to what user will see.
         this.restTimerNextUpTextOnPause = this.activeSetInfo()?.exerciseData.exerciseName || 'Next Exercise';
      }
      return;
    }

    if (duration > 0) {
      const currentRoutineValue = this.routine();
      this.restDuration.set(duration);

      if (!isResumingPausedRest) {
        this.restTimerMainText.set(
          this.activeSetInfo()?.setData?.restAfterSet === 0 && this.activeSetInfo()?.exerciseData?.supersetId ?
            'SUPERSET TRANSITION' : 'RESTING'
        );
        // activeSetInfo() here refers to the set *after* the rest.
        // getNextUpText expects the *completed* set. This might lead to a slight off-by-one for "next up" display.
        // For simplicity, display the name of the upcoming exercise.
        this.restTimerNextUpText.set(this.activeSetInfo()?.exerciseData.exerciseName || 'Next Exercise');

      } else {
        this.restTimerMainText.set(this.restTimerMainTextOnPause);
        this.restTimerNextUpText.set(this.restTimerNextUpTextOnPause);
      }
      this.isRestTimerVisible.set(true); 
      this.updateRestTimerDisplay(duration); 
    } else {
      this.isRestTimerVisible.set(false);
    }
  }

  handleRestTimerFinished(): void {
    this.isRestTimerVisible.set(false);
  }

  handleRestTimerSkipped(): void {
    this.isRestTimerVisible.set(false);
    this.toastService.info("Rest skipped.", 2000);
  }

  skipRest(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Resume to skip rest.", 3000, "Paused");
      return;
    }
    if (this.isRestTimerVisible()) {
      this.handleRestTimerSkipped();
    }
  }

  async pauseSession(): Promise<void> {
    if (this.sessionState() !== SessionState.Playing) return;
    this.isPerformanceInsightsVisible.set(false); // Close insights first
    this.closeWorkoutMenu(); // Ensure menu is closed before showing pause overlay

    this.sessionTimerElapsedSecondsBeforePause += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    if (this.timerSub) this.timerSub.unsubscribe();

    this.wasTimedSetRunningOnPause = this.timedSetTimerState() === TimedSetState.Running;
    if (this.timedSetTimerState() === TimedSetState.Running) {
      this.pauseTimedSet(); // This will preserve timedSetElapsedSeconds
    }

    this.wasRestTimerVisibleOnPause = this.isRestTimerVisible();
    if (this.wasRestTimerVisibleOnPause) {
      // Capture actual remaining time if FullScreenRestTimerComponent could provide it.
      // For now, using the initial duration of the *current* rest.
      // Ideally, FullScreenRestTimerComponent would expose its remaining time or be pausable.
      this.restTimerRemainingSecondsOnPause = this.restDuration() // This might not be perfectly accurate if timer was running
      this.restTimerInitialDurationOnPause = this.restDuration();
      this.restTimerMainTextOnPause = this.restTimerMainText();
      this.restTimerNextUpTextOnPause = this.restTimerNextUpText();
      this.isRestTimerVisible.set(false); 
    }
    this.sessionState.set(SessionState.Paused); // This will trigger the pause overlay in HTML
    this.savePausedSessionState();
    this.toastService.info("Workout Paused", 3000);
  }

  resumeSession(): void {
    if (this.sessionState() !== SessionState.Paused) return;
    
    this.workoutStartTime = Date.now(); // Reset start time for calculating new delta
    this.sessionState.set(SessionState.Playing);
    this.startSessionTimer(); // Resumes with sessionTimerElapsedSecondsBeforePause

    if (this.wasTimedSetRunningOnPause && this.timedSetTimerState() === TimedSetState.Paused) {
      this.startOrResumeTimedSet(); // Resumes timedSetElapsedSeconds from where it left off
    }
    this.wasTimedSetRunningOnPause = false;

    if (this.wasRestTimerVisibleOnPause && this.restTimerRemainingSecondsOnPause > 0) {
      this.startRestPeriod(this.restTimerRemainingSecondsOnPause, true);
    }
    this.wasRestTimerVisibleOnPause = false;
    
    this.closeWorkoutMenu(); 
    this.closePerformanceInsights(); 
    this.toastService.info('Workout session resumed.', 3000);
  }

  private async checkForPausedSession(): Promise<boolean> {
    const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);
    if (pausedState && pausedState.version === this.PAUSED_STATE_VERSION) {
      const routineName = pausedState.sessionRoutine?.name || 'a previous session';
      const customBtns: AlertButton[] = [
        { text: 'Discard', role: 'cancel', data: false, cssClass: 'bg-gray-300 hover:bg-gray-500' } as AlertButton,
        { text: 'Resume', role: 'confirm', data: true, cssClass: 'bg-green-500 hover:bg-green-600 text-white' } as AlertButton
      ];
      const confirmation = await this.alertService.showConfirmationDialog('Resume Workout?', `You have a paused workout session for "${routineName}". Would you like to resume it?`, customBtns);
      if (confirmation && confirmation.data === true) {
        this.loadStateFromPausedSession(pausedState);
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        return true;
      } else {
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        this.toastService.info('Paused session discarded.', 3000);
        return false;
      }
    }
    return false;
  }

  private loadNewWorkoutFromRoute(): void {
    this.sessionState.set(SessionState.Loading);
    this.workoutStartTime = Date.now();
    this.sessionTimerElapsedSecondsBeforePause = 0;
    this.routeSub = this.route.paramMap.pipe(
      switchMap(params => {
        this.routineId = params.get('routineId');
        return this.routineId ? this.workoutService.getRoutineById(this.routineId).pipe(map(r => r ? JSON.parse(JSON.stringify(r)) as Routine : null)) : of(null);
      }),
      tap(async sessionRoutineCopy => {
        if (sessionRoutineCopy) {
          this.routine.set(sessionRoutineCopy);
          if (sessionRoutineCopy.exercises.length > 0) {
            const firstEx = sessionRoutineCopy.exercises[0];
            if (!firstEx.supersetId || firstEx.supersetOrder === 0) this.totalBlockRounds.set(firstEx.rounds ?? 1);
            else {
              const actualStart = sessionRoutineCopy.exercises.find(ex => ex.supersetId === firstEx.supersetId && ex.supersetOrder === 0);
              this.totalBlockRounds.set(actualStart?.rounds ?? 1);
            }
          } else this.totalBlockRounds.set(1);
          this.currentBlockRound.set(1);
          this.currentExerciseIndex.set(0);
          this.currentSetIndex.set(0);
          this.currentWorkoutLogExercises.set([]);
          await this.prepareCurrentSet();
          this.sessionState.set(SessionState.Playing);
          this.startSessionTimer();
        } else {
          this.routine.set(null);
          this.sessionState.set(SessionState.Error);
           this.toastService.error("Failed to load workout routine.", 0, "Load Error");
        }
      })
    ).subscribe();
  }

  private loadStateFromPausedSession(state: PausedWorkoutState): void {
    this.routineId = state.routineId;
    this.routine.set(state.sessionRoutine);
    this.currentExerciseIndex.set(state.currentExerciseIndex);
    this.currentSetIndex.set(state.currentSetIndex);
    this.currentWorkoutLogExercises.set(state.currentWorkoutLogExercises);
    
    this.workoutStartTime = Date.now(); // New reference for current play segment
    this.sessionTimerElapsedSecondsBeforePause = state.sessionTimerElapsedSecondsBeforePause;
    
    this.currentBlockRound.set(state.currentBlockRound);
    this.totalBlockRounds.set(state.totalBlockRounds);
    
    this.timedSetTimerState.set(state.timedSetTimerState);
    this.timedSetElapsedSeconds.set(state.timedSetElapsedSeconds); // Restore elapsed time
    // wasTimedSetRunningOnPause will be set based on timedSetTimerState when resuming
    this.wasTimedSetRunningOnPause = state.timedSetTimerState === TimedSetState.Running || state.timedSetTimerState === TimedSetState.Paused;


    this.lastPerformanceForCurrentExercise = state.lastPerformanceForCurrentExercise;
    
    this.wasRestTimerVisibleOnPause = state.isRestTimerVisibleOnPause;
    this.restTimerRemainingSecondsOnPause = state.restTimerRemainingSecondsOnPause;
    this.restTimerInitialDurationOnPause = state.restTimerInitialDurationOnPause;
    this.restTimerMainTextOnPause = state.restTimerMainTextOnPause;
    this.restTimerNextUpTextOnPause = state.restTimerNextUpTextOnPause;

    this.prepareCurrentSet().then(() => { // Patches form, resets timers based on current set
      this.sessionState.set(SessionState.Playing); 
      this.startSessionTimer(); 

      // If the timed set timer was running or paused when session was saved, restore its state
      if (state.timedSetTimerState === TimedSetState.Running) {
        this.startOrResumeTimedSet(); // This will continue from timedSetElapsedSeconds
      } else if (state.timedSetTimerState === TimedSetState.Paused) {
        // It was paused, it remains paused. timedSetElapsedSeconds is already set.
        // User can click its resume button.
      }
      
      if (this.wasRestTimerVisibleOnPause && this.restTimerRemainingSecondsOnPause > 0) {
        this.startRestPeriod(this.restTimerRemainingSecondsOnPause, true);
      }
      this.cdr.detectChanges(); 
      this.toastService.success('Workout session resumed.', 3000, "Resumed");
    });
  }

  private savePausedSessionState(): void {
    if (!this.routine()) return;
    let currentTotalSessionElapsed = this.sessionTimerElapsedSecondsBeforePause;
    // If it was playing right before this save (e.g. for beforeunload, or if pause didn't update this yet)
    // For explicit pause, sessionTimerElapsedSecondsBeforePause is already updated.
    // This calculation is more for the implicit save during beforeunload
    if (this.sessionState() === SessionState.Playing && this.workoutStartTime > 0) { 
        currentTotalSessionElapsed += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    }


    const stateToSave: PausedWorkoutState = {
      version: this.PAUSED_STATE_VERSION, routineId: this.routineId, sessionRoutine: JSON.parse(JSON.stringify(this.routine())),
      currentExerciseIndex: this.currentExerciseIndex(), currentSetIndex: this.currentSetIndex(),
      currentWorkoutLogExercises: JSON.parse(JSON.stringify(this.currentWorkoutLogExercises())),
      workoutStartTimeOriginal: this.workoutStartTime, // This is the start of the *current segment* of play
      sessionTimerElapsedSecondsBeforePause: currentTotalSessionElapsed, // Total accumulated time
      currentBlockRound: this.currentBlockRound(), totalBlockRounds: this.totalBlockRounds(),
      timedSetTimerState: this.timedSetTimerState(), 
      timedSetElapsedSeconds: this.timedSetElapsedSeconds(), // Current elapsed for active set
      isResting: this.isRestTimerVisible(), // Current state of general rest
      isRestTimerVisibleOnPause: this.wasRestTimerVisibleOnPause, // State at the moment of explicit pause
      restTimerRemainingSecondsOnPause: this.restTimerRemainingSecondsOnPause,
      restTimerInitialDurationOnPause: this.restTimerInitialDurationOnPause,
      restTimerMainTextOnPause: this.restTimerMainTextOnPause,
      restTimerNextUpTextOnPause: this.restTimerNextUpTextOnPause,
      lastPerformanceForCurrentExercise: this.lastPerformanceForCurrentExercise ? JSON.parse(JSON.stringify(this.lastPerformanceForCurrentExercise)) : null,
    };
    this.storageService.setItem(this.PAUSED_WORKOUT_KEY, stateToSave);
  }

  private captureAndSaveStateForUnload(): void {
    // Re-use savePausedSessionState logic, ensuring elapsed times are up-to-date
    let currentTotalSessionElapsed = this.sessionTimerElapsedSecondsBeforePause;
    if (this.sessionState() === SessionState.Playing && this.workoutStartTime > 0) {
        currentTotalSessionElapsed += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    }
    // Temporarily update sessionTimerElapsedSecondsBeforePause for saving
    const originalElapsed = this.sessionTimerElapsedSecondsBeforePause;
    this.sessionTimerElapsedSecondsBeforePause = currentTotalSessionElapsed;
    
    this.savePausedSessionState(); // This will use the updated sessionTimerElapsedSecondsBeforePause

    // Restore original value if needed, though for unload it doesn't matter much
    this.sessionTimerElapsedSecondsBeforePause = originalElapsed;
    console.log('Session state attempt saved via beforeunload.');
  }

  async addWarmupSet(): Promise<void> {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Resume to add warm-up.", 3000, "Paused"); return;
    }
    const currentRoutineVal = this.routine(); const activeInfo = this.activeSetInfo();
    if (!currentRoutineVal || !activeInfo) {
      this.toastService.error("Cannot add warm-up: data unavailable.", 0, "Error"); return;
    }
    const currentExercise = currentRoutineVal.exercises[activeInfo.exerciseIndex];
    const firstWorkingSetIndex = currentExercise.sets.findIndex(s => !s.isWarmup);
    if (activeInfo.setIndex > 0 && activeInfo.setIndex > firstWorkingSetIndex && firstWorkingSetIndex !== -1) {
      const confirm = await this.alertService.showConfirm("Add Warm-up Set", "You are past the first working set. Adding a warm-up set now will insert it before the current set. Continue?");
      if (!confirm || !confirm.data) return;
    }
    const newWarmupSet: ExerciseSetParams = {
      id: `warmup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, isWarmup: true, reps: 8, weight: 0,
      duration: undefined, restAfterSet: 30, notes: 'Warm-up set'
    };
    const updatedRoutineForSession = JSON.parse(JSON.stringify(currentRoutineVal)) as Routine;
    const exerciseToUpdate = updatedRoutineForSession.exercises[activeInfo.exerciseIndex];
    exerciseToUpdate.sets.splice(activeInfo.setIndex, 0, newWarmupSet);
    this.routine.set(updatedRoutineForSession);
    this.toastService.success("Warm-up set added. Fill details & complete.", 4000, "Warm-up Added");
    await this.prepareCurrentSet();
    this.closeWorkoutMenu(); this.closePerformanceInsights();
  }

  ngOnDestroy(): void {
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
    this.isRestTimerVisible.set(false);
  }

  getSets(): ExerciseSetParams[] { 
    const activeSet = this.activeSetInfo();
    const sets = activeSet?.exerciseData.sets || [];
    return activeSet?.setData.isWarmup ? sets.filter(exer => !exer.isWarmup) : sets;
  }

  getWarmUpSets(): ExerciseSetParams[] { 
    const activeSet = this.activeSetInfo();
    const sets = activeSet?.exerciseData.sets || [];
    return activeSet?.setData.isWarmup ? sets.filter(exer => exer.isWarmup) : [];
  }

  getTotalWarmupSetsForCurrentExercise = computed<number>(() => {
    const r = this.routine(); const exIndex = this.currentExerciseIndex();
    return (r && r.exercises[exIndex]) ? r.exercises[exIndex].sets.filter(s => s.isWarmup).length : 0;
  });

  canAddWarmupSet = computed<boolean>(() => {
    const activeInfo = this.activeSetInfo(); const routineVal = this.routine();
    if (!activeInfo || !routineVal || this.sessionState() === 'paused') return false;
    const currentExerciseSets = routineVal.exercises[activeInfo.exerciseIndex].sets;
    for (let i = 0; i <= activeInfo.setIndex; i++) {
      if (!currentExerciseSets[i].isWarmup && this.getTotalWarmupSetsForCurrentExercise() > 0) return false;
    }
    return true;
  });

  getIconPath(iconName: string | undefined): string {
    return this.exerciseService.getIconPath(iconName);
  }

  toggleWorkoutMenu(): void {
    if (this.sessionState() === 'paused' && !this.isWorkoutMenuVisible()) {
        // If paused and trying to open menu, effectively it's already in "pause menu mode"
        // Or, if we want a different menu when paused, this logic might change.
        // For now, if paused, the main pause overlay is active. Clicking "..." might be disabled or do nothing.
        // If the intention is to allow "Quit" from the "..." menu even when paused overlay is up:
        // this.isWorkoutMenuVisible.update(v => !v);
        // But current HTML structure has a dedicated pause overlay.
        return; 
    }
    if (this.sessionState() === 'paused' && this.isWorkoutMenuVisible()) { 
        // This case should not happen if pause overlay is primary.
        // If pause state itself shows the menu, then this might close it.
        // Current design: Pause has its own overlay. Menu is separate.
        return;
    }
    this.isWorkoutMenuVisible.update(v => !v);
    if(this.isWorkoutMenuVisible()) {
        this.isPerformanceInsightsVisible.set(false); // Close insights if opening menu
    }
  }

  closeWorkoutMenu(): void { this.isWorkoutMenuVisible.set(false); }

  async skipCurrentSet(): Promise<void> {
    if (this.sessionState() === 'paused') { this.toastService.warning("Session is paused. Resume to skip set.", 3000,"Paused"); return; }
    const activeInfo = this.activeSetInfo(); const currentRoutineVal = this.routine();
    if (!activeInfo || !currentRoutineVal) { this.toastService.error("Cannot skip set: No active set information.", 0, "Error"); return; }
    const confirm = await this.alertService.showConfirm("Skip Current Set", `Skip current ${activeInfo.isWarmup ? 'warm-up' : 'set ' + this.getCurrentWorkingSetNumber()} of "${activeInfo.exerciseData.exerciseName}"? It won't be logged.`);
    if (!confirm || !confirm.data) return;
    this.toastService.info(`Skipped set of ${activeInfo.exerciseData.exerciseName}.`, 2000);
    this.resetTimedSet();
    this.navigateToNextStepInWorkout(activeInfo, currentRoutineVal);
    this.closeWorkoutMenu(); this.closePerformanceInsights();
  }

  async skipCurrentExercise(): Promise<void> {
    if (this.sessionState() === 'paused') { this.toastService.warning("Session is paused. Resume to skip exercise.", 3000, "Paused"); return; }
    const activeInfo = this.activeSetInfo(); const currentRoutineVal = this.routine();
    if (!activeInfo || !currentRoutineVal) { this.toastService.error("Cannot skip exercise: No active exercise information.", 0, "Error"); return; }
    const confirm = await this.alertService.showConfirm("Skip Current Exercise", `Skip all remaining sets of "${activeInfo.exerciseData.exerciseName}" for this round?`);
    if (!confirm || !confirm.data) return;
    this.toastService.info(`Skipped exercise ${activeInfo.exerciseData.exerciseName}.`, 3000);
    const currentGlobalExerciseIndex = activeInfo.exerciseIndex;
    let nextBlockGlobalStartIndex = this.findNextExerciseBlockStartIndex(currentGlobalExerciseIndex, currentRoutineVal);
    if (nextBlockGlobalStartIndex !== -1) {
      this.currentExerciseIndex.set(nextBlockGlobalStartIndex); this.currentSetIndex.set(0);
      this.currentBlockRound.set(1);
      const newBlockStarterExercise = currentRoutineVal.exercises[nextBlockGlobalStartIndex];
      if (!newBlockStarterExercise.supersetId || newBlockStarterExercise.supersetOrder === 0) this.totalBlockRounds.set(newBlockStarterExercise.rounds ?? 1);
      else {
        const actualBlockStart = currentRoutineVal.exercises.find(ex => ex.supersetId === newBlockStarterExercise.supersetId && ex.supersetOrder === 0);
        this.totalBlockRounds.set(actualBlockStart?.rounds ?? 1);
      }
      this.lastPerformanceForCurrentExercise = null; this.prepareCurrentSet();
    } else this.finishWorkout();
    this.closeWorkoutMenu(); this.closePerformanceInsights();
  }

  async finishWorkoutEarly(): Promise<void> {
    if (this.sessionState() === 'paused') { this.toastService.warning("Please resume before finishing early.", 3000, "Paused"); return; }
    const confirmFinish = await this.alertService.showConfirm("Finish Workout Early", "Finish workout now? Progress will be saved.");
    if (confirmFinish && confirmFinish.data) { this.closeWorkoutMenu(); this.closePerformanceInsights(); this.finishWorkout(); }
  }

  async quitWorkout(): Promise<void> {
    const confirmQuit = await this.alertService.showConfirm("Quit Workout", 'Quit workout? Unsaved progress (if not paused) will be lost.');
    if (confirmQuit && confirmQuit.data) {
      this.sessionState.set(SessionState.Playing); // To allow cleanup and nav
      if (this.timerSub) this.timerSub.unsubscribe();
      if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
      this.isRestTimerVisible.set(false);
      this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
      this.closeWorkoutMenu(); this.closePerformanceInsights();
      this.router.navigate(['/workout']);
      this.toastService.info("Workout quit. No progress saved for this session unless paused.", 4000);
    }
  }

  toggleCompletedSetsInfo(): void { this.showCompletedSetsInfo.update(v => !v); }

  openPerformanceInsights(): void {
    if (this.sessionState() === 'paused') { this.toastService.warning("Session is paused. Resume to view insights.", 3000, "Paused"); return; }
    this.isPerformanceInsightsVisible.set(true);
    this.isWorkoutMenuVisible.set(false); // Close main menu if opening insights
  }

  closePerformanceInsights(): void {
    this.isPerformanceInsightsVisible.set(false);
    if (this.editingTarget) this.cancelEditTarget();
  }
  
  openPerformanceInsightsFromMenu(): void {
    this.closeWorkoutMenu(); // Close the main menu first
    this.openPerformanceInsights(); // Then open insights
  }
  
  goBack(): void {
    if (this.currentWorkoutLogExercises().length > 0 && this.sessionState() === SessionState.Playing) {
        this.alertService.showConfirm("Exit Workout?", "You have an active workout. Are you sure you want to exit? Your progress might be lost unless you pause first.")
        .then(confirmation => {
            if (confirmation && confirmation.data) {
                this.router.navigate(['/workout']);
            }
        });
    } else {
        this.router.navigate(['/workout']);
    }
  }

  // Stepper methods for weight and reps
  incrementWeight(defaultStep: number = 0.5): void {
    const step = defaultStep;
    const currentValue = this.csf['actualWeight'].value ?? 0;
    this.currentSetForm.patchValue({ actualWeight: parseFloat((currentValue + step).toFixed(2)) });
  }

  decrementWeight(defaultStep: number = 0.5): void {
    const step = defaultStep;
    const currentValue = this.csf['actualWeight'].value ?? 0;
    this.currentSetForm.patchValue({ actualWeight: Math.max(0, parseFloat((currentValue - step).toFixed(2))) });
  }

  incrementReps(defaultStep: number = 1): void {
    const step = defaultStep;
    const currentValue = this.csf['actualReps'].value ?? 0;
    this.currentSetForm.patchValue({ actualReps: currentValue + step });
  }

  decrementReps(defaultStep: number = 1): void {
    const step = defaultStep;
    const currentValue = this.csf['actualReps'].value ?? 0;
    this.currentSetForm.patchValue({ actualReps: Math.max(0, currentValue - step) });
  }

  // RPE methods
  toggleRpeInput(): void {
    this.showRpeSlider.update(v => !v);
  }

  updateRpe(value: number | string | null): void {
    const numericValue = typeof value === 'string' ? parseInt(value, 10) : value;
    if (numericValue !== null && !isNaN(numericValue) && numericValue >= 1 && numericValue <= 10) {
      this.rpeValue.set(numericValue);
      this.currentSetForm.patchValue({ rpe: numericValue });
    } else if (numericValue === null) {
        this.rpeValue.set(null);
        this.currentSetForm.patchValue({ rpe: null });
    }
  }
}