import { Component, inject, OnInit, OnDestroy, signal, computed, WritableSignal, ChangeDetectorRef, HostListener, PLATFORM_ID } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, Observable, of, timer, firstValueFrom, interval } from 'rxjs';
import { switchMap, tap, map, takeWhile, take, filter } from 'rxjs/operators';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FullScreenRestTimerComponent } from '../../shared/components/full-screen-rest-timer/full-screen-rest-timer';

import { Routine, WorkoutExercise, ExerciseSetParams } from '../../core/models/workout.model';
import { Exercise } from '../../core/models/exercise.model';
import { WorkoutService } from '../../core/services/workout.service';
import { ExerciseService } from '../../core/services/exercise.service';
import { TrackingService } from '../../core/services/tracking.service';
import { LoggedSet, LoggedWorkoutExercise, WorkoutLog, LastPerformanceSummary, PersonalBestSet } from '../../core/models/workout-log.model';
import { WeightUnitPipe } from '../../shared/pipes/weight-unit-pipe';
import { AlertComponent } from '../../shared/components/alert/alert.component';
import { AlertService } from '../../core/services/alert.service';
import { StorageService } from '../../core/services/storage.service';
import { AlertButton, AlertInput } from '../../core/models/alert.model';
import { UnitsService } from '../../core/services/units.service';
import { ToastService } from '../../core/services/toast.service';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { AppSettingsService } from '../../core/services/app-settings.service'; // Import AppSettingsService
import { TrainingProgram } from '../../core/models/training-program.model';


// Interface to manage the state of the currently active set/exercise
interface ActiveSetInfo {
  exerciseIndex: number;
  setIndex: number;
  exerciseData: WorkoutExercise;
  setData: ExerciseSetParams;
  baseExerciseInfo?: Exercise;
  isCompleted: boolean;
  actualReps?: number;
  actualWeight?: number | null;
  actualDuration?: number;
  notes?: string;
  isWarmup: boolean;
}

export interface PausedWorkoutState {
  version: string;
  routineId: string | null;
  sessionRoutine: Routine; // The routine state as it was when paused (potentially modified)
  originalRoutineSnapshot?: WorkoutExercise[]; // Snapshot of the *original* routine's exercises if one was loaded
  currentExerciseIndex: number;
  currentSetIndex: number;
  currentWorkoutLogExercises: LoggedWorkoutExercise[];
  workoutStartTimeOriginal: number;
  sessionTimerElapsedSecondsBeforePause: number;
  currentBlockRound: number;
  totalBlockRounds: number;
  timedSetTimerState: TimedSetState;
  timedSetElapsedSeconds: number;
  isResting: boolean;
  isRestTimerVisibleOnPause: boolean;
  restTimerRemainingSecondsOnPause: number;
  restTimerInitialDurationOnPause: number;
  restTimerMainTextOnPause: string;
  restTimerNextUpTextOnPause: string | null;
  lastPerformanceForCurrentExercise: LastPerformanceSummary | null;
  workoutDate: string; // Date of the workout when paused
}

enum SessionState {
  Loading = 'loading',
  Playing = 'playing',
  Paused = 'paused',
  Error = 'error',
}

enum TimedSetState {
  Idle = 'idle',
  Running = 'running',
  Paused = 'paused',
}

enum PlayerSubState {
  PerformingSet = 'performing_set',
  PresetCountdown = 'preset_countdown',
  Resting = 'resting'
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


  protected appSettingsService = inject(AppSettingsService);
  private platformId = inject(PLATFORM_ID); // Ensure this is injected if not already
  // private countdownAudio: HTMLAudioElement | undefined; // REMOVE THIS
  // --- State Signals ---
  routine = signal<Routine | null | undefined>(undefined);
  program = signal<TrainingProgram | null | undefined>(undefined);
  sessionState = signal<SessionState>(SessionState.Loading); // Main session state
  public readonly PlayerSubState = PlayerSubState; // <--- ADD THIS LINE
  playerSubState = signal<PlayerSubState>(PlayerSubState.PerformingSet); // Sub-state for player UI

  currentExerciseIndex = signal(0);
  currentSetIndex = signal(0);
  currentBlockRound = signal(1);
  totalBlockRounds = signal(1);

  // --- Timer Signals & Properties ---
  sessionTimerDisplay = signal('00:00:00');
  private workoutStartTime: number = 0;
  private sessionTimerElapsedSecondsBeforePause = 0;
  private timerSub: Subscription | undefined;

  // For Timed Sets (countdown/countup within a set)
  timedSetTimerState = signal<TimedSetState>(TimedSetState.Idle);
  timedSetElapsedSeconds = signal(0);
  private timedSetIntervalSub: Subscription | undefined;
  private soundPlayedForThisCountdownSegment = false;

  // For Pre-Set Timer
  presetTimerCountdownDisplay = signal<string | null>(null);
  presetTimerDuration = signal(0); // Stores the target duration for the current pre-set timer
  private presetTimerSub: Subscription | undefined;

  // For Post-Set Rest Timer
  isRestTimerVisible = signal(false); // Controls the FULL SCREEN rest timer visibility
  restDuration = signal(0);           // Target duration for the current rest period
  restTimerDisplay = signal<string | null>(null); // Formatted display for footer rest timer
  // restTimerMainText & restTimerNextUpText are used by both pre-set and post-set footer display
  restTimerMainText = signal('RESTING');
  restTimerNextUpText = signal<string | null>(null);

  readonly nextActionButtonLabel = computed(() => {
    switch (this.playerSubState()) {
      case PlayerSubState.PresetCountdown:
        return 'GETTING READY...'; // Or could be an empty string if button is hidden/disabled
      case PlayerSubState.Resting:
        return 'RESTING...'; // Or empty / "Skip Rest" could be its own button
      case PlayerSubState.PerformingSet:
      default:
        return 'SET DONE';
    }
  });


  // Modify isRestTimerVisible to be a computed signal if we merge states
  // isRestTimerVisible = computed(() => this.playerSubState() === PlayerSubState.Resting);
  // 
  //   restDuration = signal(0);
  currentSetForm!: FormGroup;
  lastPerformanceForCurrentExercise: LastPerformanceSummary | null = null;
  editingTarget: 'reps' | 'weight' | 'duration' | null = null;
  editingTargetValue: number | string = '';
  routineId: string | null = null;

  // --- Paused State & Auto-Save ---
  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';
  private readonly PAUSED_STATE_VERSION = '1.1'; // Ensure PausedWorkoutState interface has workoutDate
  private originalRoutineSnapshot: WorkoutExercise[] = [];
  private currentWorkoutLogExercises = signal<LoggedWorkoutExercise[]>([]);
  private wasRestTimerVisibleOnPause = false;
  private restTimerRemainingSecondsOnPause = 0;
  private restTimerInitialDurationOnPause = 0; // Store the original duration for pause/resume
  private restTimerMainTextOnPause = 'RESTING';
  private restTimerNextUpTextOnPause: string | null = null;
  private wasTimedSetRunningOnPause = false;
  private autoSaveSub: Subscription | undefined;
  private readonly AUTO_SAVE_INTERVAL_MS = 15000;
  private isSessionConcluded = false;
  private routerEventsSub: Subscription | undefined;
  private isInitialLoadComplete = false;

  // This computed signal determines if the CURRENTLY active set (activeSetInfo)
  // should have initiated via a pre-set timer.
  // It's used to decide the initial label of the main action button.
  readonly shouldStartWithPresetTimer = computed<boolean>(() => {
    const activeInfo = this.activeSetInfo(); // The set we are about to perform or are performing
    if (!activeInfo) return false;

    const enablePreset = this.appSettingsService.enablePresetTimer();
    const presetDurationValue = this.appSettingsService.presetTimerDurationSeconds();
    if (!enablePreset || presetDurationValue <= 0) return false;

    const r = this.routine();
    const exIndex = activeInfo.exerciseIndex;
    const sIndex = activeInfo.setIndex;

    if (!r || !r.exercises[exIndex] || !r.exercises[exIndex].sets[sIndex]) return false;

    const isFirstSetOfFirstExerciseInWorkout = exIndex === 0 && sIndex === 0 && this.currentBlockRound() === 1;

    let previousSetRestDuration = Infinity; // Assume significant rest if no previous set
    if (sIndex > 0) { // If not the first set of this exercise
      previousSetRestDuration = r.exercises[exIndex].sets[sIndex - 1].restAfterSet;
    } else if (exIndex > 0) { // First set of this exercise, but not the first exercise in the routine
      const prevExercise = r.exercises[exIndex - 1];
      previousSetRestDuration = prevExercise.sets[prevExercise.sets.length - 1].restAfterSet;
    }
    // If previousSetRestDuration is still Infinity here, it means it's the very first set of the workout.

    return isFirstSetOfFirstExerciseInWorkout || previousSetRestDuration === 0;
  });


  // The main action button's label
  readonly mainActionButtonLabel = computed(() => {
    switch (this.playerSubState()) {
      case PlayerSubState.PresetCountdown:
        return `PREPARING... ${this.presetTimerCountdownDisplay()}s`;
      case PlayerSubState.Resting:
        return `RESTING: ${this.restTimerDisplay()}`;
      case PlayerSubState.PerformingSet:
        // If this set should have started with a pre-set timer (and we are now in PerformingSet,
        // meaning the pre-set timer is done or was skipped, or wasn't needed), the button is "SET DONE".
        // If it's PerformingSet AND it *should* start with a pre-set timer that hasn't run yet,
        // then the button should be "START SET".
        // This is handled by prepareCurrentSet setting the playerSubState.
        // So, if playerSubState is PerformingSet, it means we are past any pre-set timer.
        if (this.checkIfLatestSetOfWorkout()) {
          return 'FINISH WORKOUT';
        } else if (this.checkIfLatestSetOfExercise()){
          return 'COMPLETE EXERCISE'
        } else {
          return 'SET DONE';
        }
      default:
        return 'SET DONE'; // Default fallback
    }
  });


  private routeSub: Subscription | undefined;
  rpeValue = signal<number | null>(null);
  rpeOptions: number[] = Array.from({ length: 10 }, (_, i) => i + 1);
  showRpeSlider = signal(false);

  readonly timedSetDisplay = computed(() => {
    const state = this.timedSetTimerState();
    const elapsed = this.timedSetElapsedSeconds();
    const activeInfo = this.activeSetInfo();
    const targetDuration = activeInfo?.setData?.duration;
    if (state === TimedSetState.Idle) {
      return (targetDuration !== undefined && targetDuration > 0 ? targetDuration : (this.csf?.['actualDuration']?.value ?? 0)).toString();
    }
    if (targetDuration !== undefined && targetDuration > 0) {
      const remaining = targetDuration - elapsed;
      return remaining.toString();
    } else {
      return elapsed.toString();
    }
  });

  readonly isTimedSetOvertime = computed(() => {
    const state = this.timedSetTimerState();
    if (state === TimedSetState.Idle) return false;
    const elapsed = this.timedSetElapsedSeconds();
    const targetDuration = this.activeSetInfo()?.setData?.duration;
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

  // --- Menu/Modal States ---
  isWorkoutMenuVisible = signal(false);
  isPerformanceInsightsVisible = signal(false);
  showCompletedSetsInfo = signal<boolean>(false);


  constructor() {
    this.initializeCurrentSetForm();
    // if (isPlatformBrowser(this.platformId)) { // Initialize audio only in browser
    //   this.countdownAudio = new Audio('assets/sounds/countdown-beep.mp3'); // Adjust path
    //   this.countdownAudio.load(); // Preload the audio
    // }
  }

  private resetAndPatchCurrentSetForm(): void {
    this.currentSetForm.reset({ rpe: null });
    this.rpeValue.set(null);
    this.showRpeSlider.set(false);

    const activeInfo = this.activeSetInfo();
    this.resetTimedSet();

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
        actualDuration: initialActualDuration,
        setNotes: completedSetLog?.notes ?? '',
        rpe: null
      });
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

  // Your existing finishWorkout() method should now just call this:
  async finishWorkout(): Promise<void> {
    await this.finishWorkoutAndReportStatus();
    // The new method handles navigation and status reporting.
    // This original finishWorkout() might become redundant or just be a simple wrapper.
  }

  private comparePerformedToOriginal(
    performed: LoggedWorkoutExercise[],
    original: WorkoutExercise[]
  ): { majorDifference: boolean; details: string[] } {
    const details: string[] = [];
    let majorDifference = false;

    // 1. Check for difference in number of exercises
    if (performed.length !== original.length) {
      details.push(`Number of exercises changed (was ${original.length}, now ${performed.length}).`);
      majorDifference = true;
    }

    // 2. Compare exercises at each position (ID, name) and their sets' warmup status
    const commonLength = Math.min(performed.length, original.length);
    for (let i = 0; i < commonLength; i++) {
      const performedEx = performed[i];
      const originalEx = original[i];

      if (performedEx.exerciseId !== originalEx.exerciseId) {
        details.push(`Exercise at position ${i + 1} changed (was ${originalEx.exerciseName || originalEx.exerciseId}, now ${performedEx.exerciseName || performedEx.exerciseId}).`);
        majorDifference = true;
      }

      // Compare sets for warmup status differences
      if (performedEx.sets.length !== originalEx.sets.length) {
        details.push(`Set count for "${performedEx.exerciseName || performedEx.exerciseId}" changed (was ${originalEx.sets.length}, now ${performedEx.sets.length}).`);
        majorDifference = true; // Different number of sets is a major difference
      } else {
        // If set counts are the same, check if warmup status of any set differs
        for (let j = 0; j < performedEx.sets.length; j++) {
          const performedSet = performedEx.sets[j];
          const originalSet = originalEx.sets[j]; // Assuming sets correspond by index here
          // A more robust check might match by a plannedSetId if available on originalEx.sets

          // Check if isWarmup status differs
          // We need to be careful here: originalEx.sets[j] might not have isWarmup if it's a working set by default.
          // And loggedSet.isWarmup is always present.
          const originalIsWarmup = !!originalEx.sets[j]?.isWarmup; // Ensure boolean comparison
          const performedIsWarmup = !!performedSet.isWarmup;

          if (originalIsWarmup !== performedIsWarmup) {
            details.push(`Warm-up status for set ${j + 1} of "${performedEx.exerciseName || performedEx.exerciseId}" changed.`);
            majorDifference = true;
            break; // Found a difference in this exercise's sets, no need to check further sets for this exercise
          }
        }
      }
      if (majorDifference && details.some(d => d.includes(performedEx.exerciseName || performedEx.exerciseId))) {
        // If a major difference related to this exercise (ID or sets) was found,
        // we don't need to check further exercises if we only care about *any* major difference.
        // However, to provide comprehensive details, we continue the loop.
      }
    }

    // 3. Check for added exercises at the end of the performed list
    if (performed.length > original.length) {
      for (let i = original.length; i < performed.length; i++) {
        details.push(`Added exercise: ${performed[i].exerciseName || performed[i].exerciseId}.`);
        majorDifference = true;
      }
    }
    // 4. (Optional) Check for removed exercises if performed is shorter (already covered by length check for details, but explicitly for logic)
    if (original.length > performed.length && !majorDifference) { // Only if not already a major diff from length
      details.push(`One or more exercises were removed from the original routine.`); // Generic message
      majorDifference = true;
    }


    return { majorDifference, details };
  }

  private convertLoggedToWorkoutExercises(loggedExercises: LoggedWorkoutExercise[]): WorkoutExercise[] {
    const currentSessionRoutine = this.routine(); // Get the session's routine structure
    return loggedExercises.map(loggedEx => {
      // Try to find matching exercise in the *session's* routine to get superset/rounds info
      const sessionExercise = currentSessionRoutine?.exercises.find(re => re.exerciseId === loggedEx.exerciseId);

      return {
        id: uuidv4(),
        exerciseId: loggedEx.exerciseId,
        exerciseName: loggedEx.exerciseName,
        supersetId: sessionExercise?.supersetId || null,
        supersetOrder: sessionExercise?.supersetOrder ?? null,
        supersetSize: sessionExercise?.supersetSize ?? null,
        rounds: sessionExercise?.rounds ?? 1,
        notes: loggedEx.sets.map(s => s.notes).filter(n => !!n).join('; ') || '',
        sets: loggedEx.sets.map(loggedSet => {
          const originalPlannedSet = sessionExercise?.sets.find(s => s.id === loggedSet.plannedSetId);
          const newSet: ExerciseSetParams = {
            id: uuidv4(),
            reps: loggedSet.repsAchieved,
            weight: loggedSet.weightUsed,
            duration: loggedSet.durationPerformed,
            tempo: loggedSet.targetTempo || originalPlannedSet?.tempo,
            restAfterSet: loggedSet.targetRestAfterSet || originalPlannedSet?.restAfterSet || 60,
            notes: loggedSet.notes,
            isWarmup: loggedSet.isWarmup,
          };
          return newSet;
        })
      };
    });
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
      this.timedSetElapsedSeconds.set(0);
      const targetDuration = this.activeSetInfo()?.setData?.duration;
      if (targetDuration !== undefined && targetDuration > 0) {
        this.currentSetForm.get('actualDuration')?.setValue(targetDuration, { emitEvent: false });
      }
      this.soundPlayedForThisCountdownSegment = false; // Reset sound flag for new timer
    }
    this.timedSetTimerState.set(TimedSetState.Running);

    if (this.timedSetIntervalSub) {
      this.timedSetIntervalSub.unsubscribe();
    }

    this.timedSetIntervalSub = timer(0, 1000).subscribe(() => {
      if (this.timedSetTimerState() === TimedSetState.Running) {
        this.timedSetElapsedSeconds.update(s => s + 1);
        const currentElapsed = this.timedSetElapsedSeconds();
        this.currentSetForm.get('actualDuration')?.setValue(currentElapsed, { emitEvent: false });

        // Countdown Sound Logic
        const activeInfo = this.activeSetInfo();
        const targetDuration = activeInfo?.setData?.duration;
        const enableSound = this.appSettingsService.enableTimerCountdownSound();
        const countdownFrom = this.appSettingsService.countdownSoundSeconds(); // e.g., 5

        if (enableSound && targetDuration && targetDuration > 20 && currentElapsed > 0) {
          const remainingSeconds = targetDuration - currentElapsed;

          // Play a beep each second during the countdown window
          if (remainingSeconds <= countdownFrom && remainingSeconds >= 0) { // Play from countdownFrom down to 0
            if (remainingSeconds === 0) { // If it's the final beep
              this.playClientGong();
              this.soundPlayedForThisCountdownSegment = true; // Mark that the countdown sequence completed with sound
            } else {
              this.playClientBeep();
            }
          }
        }
      } else {
        if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
      }
    });
  }

  // Add this method to play the sound
  // private playCountdownSound(): void {
  //   if (isPlatformBrowser(this.platformId) && this.countdownAudio) {
  //     this.countdownAudio.currentTime = 0; // Rewind to start for re-plays
  //     this.countdownAudio.play().catch(error => {
  //       console.warn('Error playing countdown sound:', error);
  //       // Handle potential errors, e.g., user hasn't interacted with the page yet
  //       // which is often required for audio to play automatically.
  //     });
  //   }
  // }


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
    const targetDuration = this.activeSetInfo()?.setData?.duration;
    this.currentSetForm.get('actualDuration')?.setValue(targetDuration ?? 0, { emitEvent: false });
    this.soundPlayedForThisCountdownSegment = false; // Reset flag
  }

  stopAndLogTimedSet(): void {
    if (this.timedSetTimerState() === TimedSetState.Running || this.timedSetTimerState() === TimedSetState.Paused) {
      this.pauseTimedSet();
    }
  }

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
      value += `${pb.weightUsed}${this.unitService.getUnitSuffix()}`;
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
      actualDuration: [null as number | null, [Validators.min(0)]],
      setNotes: [''],
      rpe: [null as number | null, [Validators.min(1), Validators.max(10)]]
    });
  }

  private async prepareCurrentSet(): Promise<void> {
    if (this.sessionState() === SessionState.Paused) {
      console.log("PrepareCurrentSet: Session is paused, deferring preparation.");
      return;
    }
    const sessionRoutine = this.routine(); // Ensure we have the latest routine value
    const exIndex = this.currentExerciseIndex();
    const sIndex = this.currentSetIndex();

    if (!sessionRoutine || !sessionRoutine.exercises[exIndex] || !sessionRoutine.exercises[exIndex].sets[sIndex]) {
      this.currentSetForm.reset({ rpe: null }); this.resetTimedSet(); this.currentBaseExercise.set(null);
      this.exercisePBs.set([]); this.lastPerformanceForCurrentExercise = null; this.rpeValue.set(null); this.showRpeSlider.set(false);
      console.warn('prepareCurrentSet: Critical error - active set data not found.');
      this.sessionState.set(SessionState.Error); // Indicate an error state
      return;
    }
    const currentExerciseData = sessionRoutine.exercises[exIndex];
    const originalExerciseForSuggestions = this.originalRoutineSnapshot[exIndex];
    const plannedSetForSuggestions = originalExerciseForSuggestions?.sets[sIndex] || currentExerciseData.sets[sIndex];
    const currentPlannedSetForId = currentExerciseData.sets[sIndex];

    this.loadBaseExerciseAndPBs(currentExerciseData.exerciseId);

    if (!this.lastPerformanceForCurrentExercise || this.lastPerformanceForCurrentExercise.sets[0]?.exerciseId !== currentExerciseData.exerciseId) {
      this.lastPerformanceForCurrentExercise = await firstValueFrom(this.trackingService.getLastPerformanceForExercise(currentExerciseData.exerciseId).pipe(take(1)));
    }
    const historicalSetPerformance = this.trackingService.findPreviousSetPerformance(this.lastPerformanceForCurrentExercise, plannedSetForSuggestions, sIndex);
    let finalSetParamsForSession: ExerciseSetParams;
    if (plannedSetForSuggestions.isWarmup) {
      finalSetParamsForSession = { ...plannedSetForSuggestions };
    } else {
      finalSetParamsForSession = this.workoutService.suggestNextSetParameters(historicalSetPerformance, plannedSetForSuggestions, sessionRoutine.goal);
    }
    finalSetParamsForSession.id = currentPlannedSetForId.id;
    finalSetParamsForSession.isWarmup = !!currentPlannedSetForId.isWarmup;
    // --- End of parameter calculation ---


    // Update the routine signal with these *target* parameters *before* deciding on pre-set timer.
    // This ensures activeSetInfo reflects the upcoming set's targets.
    const updatedRoutineForSession = JSON.parse(JSON.stringify(sessionRoutine)) as Routine;
    updatedRoutineForSession.exercises[exIndex].sets[sIndex] = finalSetParamsForSession;
    this.routine.set(updatedRoutineForSession);
    this.patchActualsFormBasedOnSessionTargets(); // Patch form with these new targets

    // Now, determine if pre-set timer should run
    const enablePreset = this.appSettingsService.enablePresetTimer();
    const enablePresetAfterRest = this.appSettingsService.enablePresetTimerAfterRest();
    const presetDurationValue = this.appSettingsService.presetTimerDurationSeconds();
    const isFirstSetOfFirstExerciseInWorkout = exIndex === 0 && sIndex === 0 && this.currentBlockRound() === 1;
    let previousSetRestDuration = Infinity;
    if (sIndex > 0) {
      previousSetRestDuration = currentExerciseData.sets[sIndex - 1].restAfterSet;
    } else if (exIndex > 0) {
      const prevExercise = sessionRoutine.exercises[exIndex - 1];
      previousSetRestDuration = prevExercise.sets[prevExercise.sets.length - 1].restAfterSet;
    }

    const shouldRunPresetTimer = enablePreset && presetDurationValue > 0 &&
      ((this.playerSubState() !== PlayerSubState.Resting &&
      (isFirstSetOfFirstExerciseInWorkout || previousSetRestDuration === 0)) || enablePresetAfterRest);

    if (shouldRunPresetTimer) {
      console.log('prepareCurrentSet: Starting pre-set timer for:', currentExerciseData.exerciseName, 'Set:', sIndex + 1);
      // activeSetInfo() now reflects the set we are preparing for.
      this.playerSubState.set(PlayerSubState.PresetCountdown); // This will change button label via computed signal
      this.startPresetTimer(presetDurationValue, this.activeSetInfo()!); // Pass current activeSetInfo
    } else {
      console.log('prepareCurrentSet: No pre-set timer, setting to PerformingSet.');
      this.playerSubState.set(PlayerSubState.PerformingSet); // This will change button label
    }
    // Form is already patched with target values. User will fill actuals when PerformingSet.
  }


  private patchActualsFormBasedOnSessionTargets(): void {
    if (this.sessionState() === SessionState.Paused) {
      console.log("patchActualsFormBasedOnSessionTargets: Session is paused, deferring preparation.");
      return;
    }
    this.currentSetForm.reset({ rpe: null });
    this.rpeValue.set(null);
    this.showRpeSlider.set(false);
    this.resetTimedSet();

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
        rpe: completedSetLogThisSession.rpe
      });
      if (completedSetLogThisSession.rpe) this.rpeValue.set(completedSetLogThisSession.rpe);

    } else {
      this.currentSetForm.patchValue({
        actualReps: activeInfo.setData.reps ?? (activeInfo.isWarmup ? 8 : null),
        actualWeight: activeInfo.setData.weight ?? (activeInfo.isWarmup ? null : null),
        actualDuration: initialActualDuration,
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

  completeAndLogCurrentSet(): void {
    // ... (All existing logic from your original completeSetAndProceed method)
    // - Stop timed set timer if active
    // - Validate form
    // - Create loggedSetData
    // - Call addLoggedSetToCurrentLog
    // - Call captureAndSaveStateForUnload
    // - Reset RPE slider
    // - Call navigateToNextStepInWorkout
    // Make sure this method no longer directly calls prepareCurrentSet at its end.
    // navigateToNextStepInWorkout will handle that flow.

    const activeInfo = this.activeSetInfo();
    const currentRoutineValue = this.routine();
    if (!activeInfo || !currentRoutineValue) { /* ... error handling ... */ return; }

    if (activeInfo.setData.duration && activeInfo.setData.duration > 0 &&
      (this.timedSetTimerState() === TimedSetState.Running || this.timedSetTimerState() === TimedSetState.Paused)) {
      this.stopAndLogTimedSet();
    }
    this.soundPlayedForThisCountdownSegment = false;

    if (this.currentSetForm.invalid) {
      this.currentSetForm.markAllAsTouched();
      let firstInvalidControl = '';
      for (const key of Object.keys(this.currentSetForm.controls)) {
        if (this.currentSetForm.controls[key].invalid) {
          firstInvalidControl = key;
          break;
        }
      }
      this.toastService.error(`Please correct input: ${firstInvalidControl ? firstInvalidControl + ' is invalid.' : 'form invalid.'}`, 0, 'Validation Error');
      return;
    }

    const formValues = this.currentSetForm.value;

    let durationToLog = formValues.actualDuration;
    if (activeInfo.setData.duration && activeInfo.setData.duration > 0 && this.timedSetElapsedSeconds() > 0) {
      durationToLog = this.timedSetElapsedSeconds();
    } else if (formValues.actualDuration === null && activeInfo.setData.duration) {
      durationToLog = activeInfo.setData.duration;
    }

    const loggedSetData: LoggedSet = { /* ... populate ... */
      id: activeInfo.setData.id, // or uuidv4() if sets are not uniquely IDd in plan
      plannedSetId: activeInfo.setData.id,
      exerciseId: activeInfo.exerciseData.exerciseId,
      isWarmup: !!activeInfo.setData.isWarmup,
      repsAchieved: formValues.actualReps ?? (activeInfo.setData.isWarmup ? 0 : activeInfo.setData.reps ?? 0),
      weightUsed: formValues.actualWeight ?? (activeInfo.setData.isWarmup ? null : activeInfo.setData.weight),
      durationPerformed: durationToLog,
      rpe: formValues.rpe ?? undefined,
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

    this.rpeValue.set(null);
    this.showRpeSlider.set(false);
    this.editingTarget = null; // Reset inline editing target

    this.navigateToNextStepInWorkout(activeInfo, currentRoutineValue); // This is key
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
    this.isPerformanceInsightsVisible.set(false);
    this.closeWorkoutMenu();

    this.sessionTimerElapsedSecondsBeforePause += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    if (this.timerSub) this.timerSub.unsubscribe();

    this.wasTimedSetRunningOnPause = this.timedSetTimerState() === TimedSetState.Running;
    if (this.timedSetTimerState() === TimedSetState.Running) {
      this.pauseTimedSet();
    }

    this.wasRestTimerVisibleOnPause = this.isRestTimerVisible();
    if (this.wasRestTimerVisibleOnPause) {
      this.restTimerRemainingSecondsOnPause = this.restDuration()
      this.restTimerInitialDurationOnPause = this.restDuration();
      this.restTimerMainTextOnPause = this.restTimerMainText();
      this.restTimerNextUpTextOnPause = this.restTimerNextUpText();
      this.isRestTimerVisible.set(false);
    }
    this.stopAutoSave(); // Stop auto-save when pausing
    this.sessionState.set(SessionState.Paused);
    this.savePausedSessionState(); // Explicit save on pause
    this.toastService.info("Workout Paused", 3000);
  }

  private async loadStateFromPausedSession(state: PausedWorkoutState): Promise<void> {
    this.routineId = state.routineId;
    this.routine.set(state.sessionRoutine);
    this.originalRoutineSnapshot = state.originalRoutineSnapshot ? JSON.parse(JSON.stringify(state.originalRoutineSnapshot)) : [];

    this.currentExerciseIndex.set(state.currentExerciseIndex);
    this.currentSetIndex.set(state.currentSetIndex);
    this.currentWorkoutLogExercises.set(state.currentWorkoutLogExercises);

    this.workoutStartTime = Date.now(); // This is the start of the *current segment* after resuming
    this.sessionTimerElapsedSecondsBeforePause = state.sessionTimerElapsedSecondsBeforePause;

    this.currentBlockRound.set(state.currentBlockRound);
    this.totalBlockRounds.set(state.totalBlockRounds);

    this.timedSetTimerState.set(state.timedSetTimerState);
    this.timedSetElapsedSeconds.set(state.timedSetElapsedSeconds);
    this.wasTimedSetRunningOnPause = state.timedSetTimerState === TimedSetState.Running || state.timedSetTimerState === TimedSetState.Paused; // Recalculate based on loaded state

    this.lastPerformanceForCurrentExercise = state.lastPerformanceForCurrentExercise;

    this.wasRestTimerVisibleOnPause = state.isRestTimerVisibleOnPause; // This was the state of the full screen timer visibility
    this.restTimerRemainingSecondsOnPause = state.restTimerRemainingSecondsOnPause;
    this.restTimerInitialDurationOnPause = state.restTimerInitialDurationOnPause;
    this.restTimerMainTextOnPause = state.restTimerMainTextOnPause;
    this.restTimerNextUpTextOnPause = state.restTimerNextUpTextOnPause;

    await this.prepareCurrentSet(); // This is async and sets up the form
    this.sessionState.set(SessionState.Playing); // Set state to playing
    this.startSessionTimer(); // Start the main session timer
    this.startAutoSave();     // Start auto-save

    // Resume timed set timer if it was running or paused
    if (state.timedSetTimerState === TimedSetState.Running || state.timedSetTimerState === TimedSetState.Paused) {
      this.startOrResumeTimedSet(); // This will set it to 'running' if it was 'paused'
      if (state.timedSetTimerState === TimedSetState.Paused) { // If it was explicitly paused, keep it paused
        this.pauseTimedSet();
      }
    }

    // Resume rest timer if it was active
    if (this.wasRestTimerVisibleOnPause && this.restTimerRemainingSecondsOnPause > 0) {
      this.startRestPeriod(this.restTimerRemainingSecondsOnPause, true); // true to indicate resuming paused rest
    }
    this.cdr.detectChanges();
    this.toastService.success('Workout session resumed.', 3000, "Resumed");
  }

  // Ensure savePausedSessionState includes the current date of the workout.
  // You already added `workoutDate` to PausedWorkoutState interface. Let's ensure it's saved.
  private savePausedSessionState(): void {
    const currentRoutine = this.routine();
    if (!currentRoutine) {
      console.warn("Cannot save paused state: routine data is not available.");
      return;
    }

    let currentTotalSessionElapsed = this.sessionTimerElapsedSecondsBeforePause;
    // Only add current segment if it was actively playing and workoutStartTime is set
    if (this.sessionState() === SessionState.Playing && this.workoutStartTime > 0) {
      currentTotalSessionElapsed += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    }

    // Determine the workout date to save
    // If a workout was loaded based on a specific date (e.g., from a plan or manual log for past date), use that.
    // Otherwise, use today's date.
    // This logic might need to be more robust if player can be started for a specific past/future date.
    // For now, let's assume a paused session refers to a session started "today" or its original log date.
    let dateToSaveInState: string;
    const activeInfo = this.activeSetInfo();
    if (this.currentWorkoutLogExercises().length > 0 && this.currentWorkoutLogExercises()[0].sets.length > 0) {
      // If sets have been logged, their timestamp might be most accurate if the session spanned midnight.
      // Or, if there's an initial log date (e.g., if resuming or logging a past workout).
      // For simplicity, if workoutStartTime is set, use that as the basis.
      dateToSaveInState = format(new Date(this.workoutStartTime - (this.sessionTimerElapsedSecondsBeforePause * 1000)), 'yyyy-MM-dd');
    } else {
      dateToSaveInState = format(new Date(), 'yyyy-MM-dd'); // Fallback to current date
    }


    const stateToSave: PausedWorkoutState = {
      version: this.PAUSED_STATE_VERSION,
      routineId: this.routineId,
      sessionRoutine: JSON.parse(JSON.stringify(currentRoutine)),
      originalRoutineSnapshot: JSON.parse(JSON.stringify(this.originalRoutineSnapshot)),
      currentExerciseIndex: this.currentExerciseIndex(),
      currentSetIndex: this.currentSetIndex(),
      currentWorkoutLogExercises: JSON.parse(JSON.stringify(this.currentWorkoutLogExercises())),
      workoutStartTimeOriginal: this.workoutStartTime, // This is the timestamp of when the current "playing" segment started
      sessionTimerElapsedSecondsBeforePause: currentTotalSessionElapsed, // This is the ACCUMULATED time
      currentBlockRound: this.currentBlockRound(),
      totalBlockRounds: this.totalBlockRounds(),
      timedSetTimerState: this.timedSetTimerState(),
      timedSetElapsedSeconds: this.timedSetElapsedSeconds(),
      isResting: this.isRestTimerVisible(),
      isRestTimerVisibleOnPause: this.wasRestTimerVisibleOnPause, // State of rest timer if session was explicitly paused
      restTimerRemainingSecondsOnPause: this.restTimerRemainingSecondsOnPause,
      restTimerInitialDurationOnPause: this.restTimerInitialDurationOnPause,
      restTimerMainTextOnPause: this.restTimerMainTextOnPause,
      restTimerNextUpTextOnPause: this.restTimerNextUpTextOnPause,
      lastPerformanceForCurrentExercise: this.lastPerformanceForCurrentExercise ? JSON.parse(JSON.stringify(this.lastPerformanceForCurrentExercise)) : null,
      workoutDate: dateToSaveInState // Added workoutDate
    };
    this.storageService.setItem(this.PAUSED_WORKOUT_KEY, stateToSave);
    console.log('Paused session state saved.', stateToSave);
  }

  // captureAndSaveStateForUnload is for the specific 'beforeunload' browser event
  private captureAndSaveStateForUnload(): void {
    // No change needed here if savePausedSessionState is robust
    let currentTotalSessionElapsed = this.sessionTimerElapsedSecondsBeforePause;
    if (this.sessionState() === SessionState.Playing && this.workoutStartTime > 0) {
      currentTotalSessionElapsed += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    }
    // Temporarily update for saving
    const originalElapsed = this.sessionTimerElapsedSecondsBeforePause;
    this.sessionTimerElapsedSecondsBeforePause = currentTotalSessionElapsed;

    this.savePausedSessionState();

    // Revert for the current session if it continues
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
      return;
    }
    if (this.sessionState() === 'paused' && this.isWorkoutMenuVisible()) {
      return;
    }
    this.isWorkoutMenuVisible.update(v => !v);
    if (this.isWorkoutMenuVisible()) {
      this.isPerformanceInsightsVisible.set(false);
    }
  }

  closeWorkoutMenu(): void { this.isWorkoutMenuVisible.set(false); }

  async skipCurrentSet(): Promise<void> {
    if (this.sessionState() === 'paused') { this.toastService.warning("Session is paused. Resume to skip set.", 3000, "Paused"); return; }
    const activeInfo = this.activeSetInfo(); const currentRoutineVal = this.routine();
    if (!activeInfo || !currentRoutineVal) { this.toastService.error("Cannot skip set: No active set information.", 0, "Error"); return; }
    const confirm = await this.alertService.showConfirm("Skip Current Set", `Skip current ${activeInfo.isWarmup ? 'warm-up' : 'set ' + this.getCurrentWorkingSetNumber()} of "${activeInfo.exerciseData.exerciseName}"? It won't be logged.`);
    if (!confirm || !confirm.data) return;
    this.soundPlayedForThisCountdownSegment = false; // Reset flag
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
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Please resume before finishing early.", 3000, "Paused");
      return;
    }

    const confirmFinishEarly = await this.alertService.showConfirm(
      "Finish Workout Early",
      "Finish workout now? Current progress will be saved."
    );

    if (confirmFinishEarly && confirmFinishEarly.data) {
      this.closeWorkoutMenu();
      this.closePerformanceInsights();

      const didLog = await this.finishWorkoutAndReportStatus();

      if (!didLog) {
        // If finishWorkoutAndReportStatus was called but the user bailed internally (e.g., cancelled a prompt)
        // and didn't log, we should still clear the paused state because the initial
        // intent from "Finish Early" was to stop the session.
        this.toastService.info("Workout finished early. Paused session cleared.", 4000);
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        // Navigate away if not already done by finishWorkout (e.g. if it returned false due to empty log)
        if (this.router.url.includes('/play')) {
          this.router.navigate(['/workout']);
        }
      }
      // If didLog is true, finishWorkoutAndReportStatus handled navigation and cleanup.
    }
  }

  // This method replaces your old finishWorkout()
  async finishWorkoutAndReportStatus(): Promise<boolean> {
    this.stopAutoSave();

    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Please resume workout before finishing.", 3000, "Session Paused");
      // If user tries to finish while paused, maybe offer to resume or just return false
      // For now, let's assume they need to resume via the resume button first.
      return false; // Did not log
    }
    if (this.sessionState() === SessionState.Loading) {
      this.toastService.info("Workout is still loading.", 3000, "Loading");
      return false; // Did not log
    }

    if (this.currentWorkoutLogExercises().length === 0) {
      this.toastService.info("No sets logged. Workout not saved.", 3000, "Empty Workout");
      this.storageService.removeItem(this.PAUSED_WORKOUT_KEY); // Clear paused state even for empty
      if (this.router.url.includes('/play')) { // Avoid navigation if already navigating away
        this.router.navigate(['/workout']);
      }
      return false; // Did not log (or logged an empty shell that was then discarded)
    }

    if (this.timerSub) this.timerSub.unsubscribe();

    const sessionRoutineValue = this.routine();
    const sessionProgramValue = this.program();
    const performedExercises = this.currentWorkoutLogExercises();
    let proceedToLog = true;
    let logAsNewRoutine = false;
    let updateOriginalRoutineStructure = false;
    let newRoutineName = sessionRoutineValue?.name ? `${sessionRoutineValue.name} - ${format(new Date(), 'MMM d')}` : `Ad-hoc Workout - ${format(new Date(), 'MMM d, HH:mm')}`;

    if (this.routineId && this.originalRoutineSnapshot && this.originalRoutineSnapshot.length > 0 && sessionRoutineValue) {
      const differences = this.comparePerformedToOriginal(performedExercises, this.originalRoutineSnapshot);
      if (differences.majorDifference) {
        const confirmation = await this.alertService.showConfirmationDialog(
          'Workout Modified',
          `This workout differed from the original "${sessionRoutineValue.name}". How would you like to proceed?`,
          [
            { text: 'Save as New Routine', role: 'confirm', data: 'new', cssClass: 'bg-green-500 hover:bg-green-600 text-white' },
            { text: 'Update Original Routine', role: 'confirm', data: 'update_original', cssClass: 'bg-orange-500 hover:bg-orange-600 text-white' },
            { text: 'Log (Keep Original Structure)', role: 'confirm', data: 'log_only', cssClass: 'bg-blue-500 hover:bg-blue-600 text-white' },
            // { text: 'Discard Changes & Log Original', role: 'cancel', data: 'discard_changes_log_original', cssClass: 'bg-gray-400 hover:bg-gray-500'}, // This option might be complex to implement perfectly without careful log reconstruction. Let's simplify for now.
            { text: 'Cancel Finish (Keep Active)', role: 'cancel', data: 'cancel_finish', cssClass: 'bg-gray-300 hover:bg-gray-400' }
          ] as AlertButton[]
        );

        if (confirmation && confirmation.data === 'new') {
          logAsNewRoutine = true;
          const nameInput = await this.alertService.showPromptDialog(
            'New Routine Name',
            'Enter a name for this new routine:',
            [{ name: 'newRoutineName', type: 'text', placeholder: 'E.g., My Custom Workout', value: newRoutineName }] as AlertInput[],
            'Save New Routine'
          );
          if (nameInput && String(nameInput['newRoutineName']).trim()) {
            newRoutineName = String(nameInput['newRoutineName']).trim();
          } else if (!nameInput && confirmation.data === 'new') { // User cancelled the prompt for new name
            this.toastService.warning("New routine name not provided. Saving with default name.", 3000);
            // proceedToLog = false; // Or save with default if that's desired
          } else if (!nameInput) { // User cancelled prompt dialog
            proceedToLog = false;
          }
        } else if (confirmation && confirmation.data === 'update_original') {
          updateOriginalRoutineStructure = true;
          this.toastService.info(`Original routine "${sessionRoutineValue.name}" will be updated with this session's structure.`, 3000, "Updating Original");
        } else if (confirmation && confirmation.data === 'log_only') {
          // proceedToLog remains true. logAsNewRoutine and updateOriginalRoutineStructure remain false.
          // this.toastService.info(`Workout will be logged against "${sessionRoutineValue.name}", structure unchanged.`, 3000, "Logging to Original");
        } else { // 'cancel_finish' or dialog dismissed
          proceedToLog = false;
        }
      }
    } else if (!this.routineId && performedExercises.length > 0) { // Ad-hoc workout
      logAsNewRoutine = true; // Always save ad-hoc as a new routine
      const nameInput = await this.alertService.showPromptDialog(
        'Save Ad-hoc Workout',
        'Enter a name for this new routine:',
        [{ name: 'newRoutineName', type: 'text', placeholder: newRoutineName, value: newRoutineName }] as AlertInput[],
        'Save New Routine'
      );
      if (nameInput && String(nameInput['newRoutineName']).trim()) {
        newRoutineName = String(nameInput['newRoutineName']).trim();
      } else if (!nameInput) { // User cancelled the prompt
        proceedToLog = false;
      }
    }

    if (!proceedToLog) {
      this.toastService.info("Finish workout cancelled. Session remains active/paused.", 3000, "Cancelled");
      if (this.sessionState() === SessionState.Playing) {
        this.startAutoSave();
      }
      // DO NOT set isSessionConcluded = true here, as user cancelled finishing
      return false;
    }
    const endTime = Date.now();
    // Use workoutStartTime which was set at the beginning of the session or resume.
    // sessionTimerElapsedSecondsBeforePause accounts for time already passed before the current "playing" segment.
    const sessionStartTime = this.workoutStartTime - (this.sessionTimerElapsedSecondsBeforePause * 1000);
    const durationMinutes = Math.round((endTime - sessionStartTime) / (1000 * 60));

    let finalRoutineIdToLog: string | undefined = this.routineId || undefined;
    let finalRoutineNameForLog = sessionRoutineValue?.name || 'Ad-hoc Workout';

    if (logAsNewRoutine) {
      const newRoutineDef: Omit<Routine, 'id'> = { // Use Omit for addRoutine
        name: newRoutineName,
        description: sessionRoutineValue?.description || 'Workout performed on ' + format(new Date(), 'MMM d, yyyy'),
        goal: sessionRoutineValue?.goal || 'custom',
        exercises: this.convertLoggedToWorkoutExercises(performedExercises),
        // lastPerformed will be set after logging this workout against the new routine
      };
      const createdRoutine = this.workoutService.addRoutine(newRoutineDef); // addRoutine should return the created Routine
      finalRoutineIdToLog = createdRoutine.id;
      finalRoutineNameForLog = createdRoutine.name;
      this.toastService.success(`New routine "${createdRoutine.name}" created.`, 4000);
    }

    // const programIf = this.routine()? this.routine().programId : undefined;

    const finalLog: Omit<WorkoutLog, 'id'> = {
      routineId: finalRoutineIdToLog,
      routineName: finalRoutineNameForLog,
      date: format(new Date(sessionStartTime), 'yyyy-MM-dd'), // Use consistent formatting
      startTime: sessionStartTime,
      endTime: endTime,
      durationMinutes: durationMinutes,
      exercises: this.currentWorkoutLogExercises(), // Already contains the LoggedWorkoutExercise[]
      notes: sessionRoutineValue?.notes, // Or overall notes if you have a form field for it
      programId: sessionProgramValue?.id, // If applicable
    };

    const savedLog = this.trackingService.addWorkoutLog(finalLog);
    this.toastService.success(`Congrats! Workout completed!`, 5000, "Workout Finished");

    if (finalRoutineIdToLog) {
      const routineToUpdate = await firstValueFrom(this.workoutService.getRoutineById(finalRoutineIdToLog).pipe(take(1)));
      if (routineToUpdate) {
        let updatedRoutineData: Routine = { ...routineToUpdate, lastPerformed: new Date(sessionStartTime).toISOString() };

        if (updateOriginalRoutineStructure && !logAsNewRoutine && this.routineId === finalRoutineIdToLog) {
          updatedRoutineData.exercises = this.convertLoggedToWorkoutExercises(performedExercises);
          if (sessionRoutineValue) { // Persist any in-session name/desc/goal changes to original routine
            updatedRoutineData.name = sessionRoutineValue.name;
            updatedRoutineData.description = sessionRoutineValue.description;
            updatedRoutineData.goal = sessionRoutineValue.goal;
          }
          this.toastService.info(`Routine "${updatedRoutineData.name}" structure updated.`, 3000);
        }
        this.workoutService.updateRoutine(updatedRoutineData);
      }
    }

    this.isSessionConcluded = true; // Mark as concluded BEFORE navigation
    this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
    this.router.navigate(['/workout/summary', savedLog.id]);
    return true;
  }

  async quitWorkout(): Promise<void> {
    const confirmQuit = await this.alertService.showConfirm("Quit Workout", 'Quit workout? Unsaved progress (if not paused) will be lost.');
    if (confirmQuit && confirmQuit.data) {
      this.stopAutoSave();
      // this.sessionState.set(SessionState.Playing); // Not strictly needed to set to playing before quitting
      if (this.timerSub) this.timerSub.unsubscribe();
      if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
      this.isRestTimerVisible.set(false);

      this.isSessionConcluded = true; // Mark as concluded BEFORE navigation
      this.storageService.removeItem(this.PAUSED_WORKOUT_KEY); // Remove any paused state

      this.closeWorkoutMenu();
      this.closePerformanceInsights();
      this.router.navigate(['/workout']);
      this.toastService.info("Workout quit. No progress saved for this session.", 4000);
    }
  }

  toggleCompletedSetsInfo(): void { this.showCompletedSetsInfo.update(v => !v); }

  openPerformanceInsights(): void {
    if (this.sessionState() === 'paused') { this.toastService.warning("Session is paused. Resume to view insights.", 3000, "Paused"); return; }
    this.isPerformanceInsightsVisible.set(true);
    this.isWorkoutMenuVisible.set(false);
  }

  closePerformanceInsights(): void {
    this.isPerformanceInsightsVisible.set(false);
    if (this.editingTarget) this.cancelEditTarget();
  }

  openPerformanceInsightsFromMenu(): void {
    this.closeWorkoutMenu();
    this.openPerformanceInsights();
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

  private startAutoSave(): void {
    if (!isPlatformBrowser(this.platformId)) return; // Only run auto-save in the browser

    if (this.autoSaveSub) {
      this.autoSaveSub.unsubscribe(); // Unsubscribe from previous if any
    }

    this.autoSaveSub = interval(this.AUTO_SAVE_INTERVAL_MS).subscribe(() => {
      if (this.sessionState() === SessionState.Playing && this.routine()) {
        console.log('Auto-saving workout state...');
        this.savePausedSessionState(); // Reuse the existing save state logic
        // Optionally, provide a subtle feedback to the user, e.g., a small toast "Progress saved"
        // this.toastService.info("Progress auto-saved", 1500, "Auto-Save"); // Be mindful not to be too intrusive
      }
    });
  }

  private stopAutoSave(): void {
    if (this.autoSaveSub) {
      this.autoSaveSub.unsubscribe();
      this.autoSaveSub = undefined;
    }
  }


  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }
    console.log('WorkoutPlayer ngOnInit - Start');

    // Try to check for a paused session first on initial load
    const hasPausedSessionOnInit = await this.checkForPausedSession(false); // false for initial load

    if (hasPausedSessionOnInit) {
      console.log('WorkoutPlayer ngOnInit - Resumed paused session.');
      this.isInitialLoadComplete = true;
      // Auto-save is started in loadStateFromPausedSession if session becomes 'Playing'
    } else {
      console.log('WorkoutPlayer ngOnInit - No paused session resumed, proceeding to load from route.');
      // If no paused session, load based on route params.
      // loadNewWorkoutFromRoute will set isInitialLoadComplete after its async operations.
      this.loadNewWorkoutFromRoute();
    }

    // Subscribe to router events to handle re-entry or param changes on a reused component
    if (isPlatformBrowser(this.platformId)) {
      this.routerEventsSub = this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        // distinctUntilChanged((prev, curr) => prev.urlAfterRedirects === curr.urlAfterRedirects && prev.id === curr.id), // Avoid re-triggering for same nav event
        tap(async (event: NavigationEnd) => {
          console.log('WorkoutPlayer RouterEvent - NavigationEnd:', event.urlAfterRedirects);
          const routeSnapshot = this.route.snapshot;
          const navigatedToPlayerUrl = event.urlAfterRedirects.startsWith('/workout/play/');
          const targetRoutineId = routeSnapshot.paramMap.get('routineId');
          const targetProgram = routeSnapshot.paramMap.get('programToStart');

          if (navigatedToPlayerUrl) {
            if (this.routineId === targetRoutineId && this.isInitialLoadComplete && this.sessionState() !== SessionState.Playing) {
              // Re-navigated to the *same* routine, initial load was done, but not currently playing.
              // This implies user navigated away and came back. Try to resume.
              console.log('WorkoutPlayer RouterEvent - Re-entered same workout, checking for pause state.');
              const resumedOnReEntry = await this.checkForPausedSession(true); // true for re-entry
              if (!resumedOnReEntry && this.sessionState() !== SessionState.Playing) {
                // If still not playing (e.g., no paused state, or user discarded),
                // and it's the same routine, we might need to reset or re-prepare.
                // For now, if they came back to the same URL, and it didn't resume,
                // it implies they want to start it fresh OR the previous state was invalid.
                // Calling loadNewWorkoutFromRoute again will effectively restart it for that routineId.
                console.log('WorkoutPlayer RouterEvent - No pause state resumed on re-entry, reloading route.', targetRoutineId);
                this.loadNewWorkoutFromRoute();
              }
            } else if (this.routineId !== targetRoutineId) {
              // Navigated to a *different* routine while player component is reused.
              // loadNewWorkoutFromRoute should handle this via its paramMap subscription.
              // We ensure it's called if it wasn't already processing.
              console.log('WorkoutPlayer RouterEvent - Navigated to new routineId, ensuring loadNewWorkoutFromRoute runs.');
              // loadNewWorkoutFromRoute is already subscribed to paramMap, so it *should* pick this up.
              // If `take(1)` was in loadNewWorkoutFromRoute's paramMap sub, this would be an issue.
              // For safety, can call it, but it needs to be idempotent or handle the current routineId correctly.
              // Let's rely on the paramMap subscription within loadNewWorkoutFromRoute for this case.
            }
          }
        })
      ).subscribe();
    }
  }

  private async loadNewWorkoutFromRoute(): Promise<void> {
    console.log('loadNewWorkoutFromRoute - Called.');
    this.isInitialLoadComplete = false; // Mark that initial load for this route is starting/restarting
    this.sessionState.set(SessionState.Loading);

    // Stop any ongoing activities from a previous routine on this component instance
    this.stopAutoSave();
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
    this.isRestTimerVisible.set(false);

    // Reset core state for a new routine load
    this.workoutStartTime = Date.now();
    this.sessionTimerElapsedSecondsBeforePause = 0;
    this.originalRoutineSnapshot = [];
    this.currentWorkoutLogExercises.set([]);
    this.currentExerciseIndex.set(0);
    this.currentSetIndex.set(0);
    this.currentBlockRound.set(1);
    this.totalBlockRounds.set(1);
    this.routine.set(undefined); // Clear current routine before loading new one
    this.program.set(undefined); // Clear current program if any

    // Unsubscribe from previous routeSub to avoid multiple subscriptions if called multiple times
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }

    this.routeSub = this.route.paramMap.pipe(
      // REMOVE take(1) here to allow updates if component is reused and params change
      switchMap(params => {
        const newRoutineId = params.get('routineId');
        const currentProgramId = this.route.snapshot.queryParamMap.get('programId');

        if (currentProgramId){
          console.log('loadNewWorkoutFromRoute - Program ID found in query params:', currentProgramId);
          this.program.set({ id: currentProgramId, name: 'Program Name Placeholder', schedule: [], isActive: true }); // Replace with actual program fetch if needed
        }

        console.log('loadNewWorkoutFromRoute - paramMap emitted, newRoutineId:', newRoutineId);

        if (!newRoutineId) {
          this.toastService.error("No routine specified to play.", 0, "Error");
          this.router.navigate(['/workout']);
          return of(null);
        }
        if (this.routineId === newRoutineId && this.routine()) {
          // Already loaded and processing this routine, possibly from a re-entry check that then called this.
          // Or, paramMap emitted same ID again. Re-prepare current set to be safe if state is not 'Playing'.
          if (this.sessionState() !== SessionState.Playing) {
            console.log('loadNewWorkoutFromRoute - Same routineId, re-preparing set for state:', this.sessionState());
            // State will be set to Playing inside prepareCurrentSet if successful
          } else {
            console.log('loadNewWorkoutFromRoute - Same routineId, already playing. No action.');
            return of(this.routine()); // Already playing this one
          }
        }
        this.routineId = newRoutineId; // Set the current routineId for the component
        return this.workoutService.getRoutineById(this.routineId).pipe(
          map(originalRoutine => {
            if (originalRoutine) {
              this.originalRoutineSnapshot = JSON.parse(JSON.stringify(originalRoutine.exercises));
              return JSON.parse(JSON.stringify(originalRoutine)) as Routine; // Deep copy
            }
            return null;
          })
        );
      }),
      tap(async (sessionRoutineCopy) => {
        if (this.sessionState() === SessionState.Paused) {
          console.log('loadNewWorkoutFromRoute - tap: Session is paused, skipping setup.');
          this.isInitialLoadComplete = true;
          return; // If a pause was initiated, don't overwrite with new load
        }

        if (sessionRoutineCopy) {
          console.log('loadNewWorkoutFromRoute - tap: Processing routine - ', sessionRoutineCopy.name);
          this.routine.set(sessionRoutineCopy);
          if (sessionRoutineCopy.exercises.length > 0) {
            const firstEx = sessionRoutineCopy.exercises[0];
            if (!firstEx.supersetId || firstEx.supersetOrder === 0) this.totalBlockRounds.set(firstEx.rounds ?? 1);
            else {
              const actualStart = sessionRoutineCopy.exercises.find(ex => ex.supersetId === firstEx.supersetId && ex.supersetOrder === 0);
              this.totalBlockRounds.set(actualStart?.rounds ?? 1);
            }
          } else {
            this.totalBlockRounds.set(1);
          }

          this.currentExerciseIndex.set(0);
          this.currentSetIndex.set(0);
          this.currentBlockRound.set(1);
          this.currentWorkoutLogExercises.set([]);

          await this.prepareCurrentSet(); // This patches form, loads PBs, suggests set
          this.sessionState.set(SessionState.Playing);
          this.startSessionTimer();
          this.startAutoSave();
        } else if (this.routineId) { // routineId was present but routine fetch failed
          console.error('loadNewWorkoutFromRoute - tap: Failed to load routine for ID:', this.routineId);
          this.routine.set(null);
          this.sessionState.set(SessionState.Error);
          this.toastService.error("Failed to load workout routine.", 0, "Load Error");
          this.router.navigate(['/workout']);
          this.stopAutoSave();
        }
        this.isInitialLoadComplete = true;
      })
    ).subscribe();
  }

  // In WorkoutPlayerComponent (workout-player.ts)

  private async checkForPausedSession(isReEntry: boolean = false): Promise<boolean> {
    const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);
    const routeRoutineId = this.route.snapshot.paramMap.get('routineId'); // string | null

    // Get optional programId from query parameters
    const currentProgramId = this.route.snapshot.queryParamMap.get('programId');

    const resumeQueryParam = this.route.snapshot.queryParamMap.get('resume') === 'true';

    console.log(
      'WorkoutPlayer.checkForPausedSession - Entry. isReEntry:', isReEntry,
      'resumeQueryParam:', resumeQueryParam,
      'Paused State Exists:', !!pausedState,
      'Paused Version Match:', pausedState?.version === this.PAUSED_STATE_VERSION,
      'Paused Routine ID:', pausedState?.routineId,
      'Route Routine ID:', routeRoutineId,
      'Paused Workout Date:', pausedState?.workoutDate,
      'Program ID:', currentProgramId,
    );

    if (pausedState && pausedState.version === this.PAUSED_STATE_VERSION) {
      // --- Sanity Checks for Relevancy ---
      // 1. If current route has a routineId, but paused session is ad-hoc (null routineId) -> discard paused
      if (routeRoutineId && pausedState.routineId === null) {
        console.log('WorkoutPlayer.checkForPausedSession - Current route is for a specific routine, but paused session was ad-hoc. Discarding paused session.');
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        return false;
      }
      // 2. If current route is ad-hoc (null routineId), but paused session was for a specific routine -> discard paused
      if (!routeRoutineId && pausedState.routineId !== null) {
        console.log('WorkoutPlayer.checkForPausedSession - Current route is ad-hoc, but paused session was for a specific routine. Discarding paused session.');
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        return false;
      }
      // 3. If both have routineIds, but they don't match -> discard paused
      if (routeRoutineId && pausedState.routineId && routeRoutineId !== pausedState.routineId) {
        console.log('WorkoutPlayer.checkForPausedSession - Paused session routine ID does not match current route routine ID. Discarding paused session.');
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        return false;
      }
      // At this point, either both routineIds are null (ad-hoc match), or both are non-null and identical.

      let shouldAttemptToLoadPausedState = false;

      if (resumeQueryParam) {
        console.log('WorkoutPlayer.checkForPausedSession - `resume=true` query param found. Attempting direct resume.');
        shouldAttemptToLoadPausedState = true;
        // Clear the query param immediately after use to prevent re-triggering on refresh/back
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { resume: null },
          queryParamsHandling: 'merge',
          replaceUrl: true // Avoid adding this to browser history
        });
      } else if (isReEntry) {
        // If it's a re-entry (e.g., browser back button to the same URL) and the session matches
        console.log('WorkoutPlayer.checkForPausedSession - Re-entry detected for matching routine. Attempting direct resume.');
        shouldAttemptToLoadPausedState = true;
      } else {
        // Initial load, or no explicit resume signal from query param or re-entry logic, so show dialog.
        const routineName = pausedState.sessionRoutine?.name || 'a previous session';
        const pausedDateString = pausedState.workoutDate ? ` from ${format(new Date(pausedState.workoutDate), 'MMM d, yyyy HH:mm')}` : '';
        const customBtns: AlertButton[] = [
          { text: 'Discard', role: 'cancel', data: false, cssClass: 'bg-gray-300 hover:bg-gray-500' },
          { text: 'Resume', role: 'confirm', data: true, cssClass: 'bg-green-500 hover:bg-green-600 text-white' }
        ];
        const confirmation = await this.alertService.showConfirmationDialog(
          'Resume Workout?',
          `You have a paused workout session for "${routineName}"${pausedDateString}. Resume?`,
          customBtns
        );
        shouldAttemptToLoadPausedState = !!(confirmation && confirmation.data === true);
      }

      if (shouldAttemptToLoadPausedState) {
        console.log('WorkoutPlayer.checkForPausedSession - Proceeding to load paused state.');
        this.stopAllActivity(); // Stop current timers/subs before loading state
        if (this.routeSub) this.routeSub.unsubscribe(); // Also stop paramMap sub from `loadNewWorkoutFromRoute`

        await this.loadStateFromPausedSession(pausedState); // This sets sessionState to Playing, starts timers/autosave
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY); // Remove after successful load
        this.isInitialLoadComplete = true; // Mark that initial load is handled by resume
        return true; // Paused session was successfully loaded and resumed
      } else {
        // User chose to discard, or it was an irrelevant paused session for auto-resume attempts
        console.log('WorkoutPlayer.checkForPausedSession - Paused session not loaded (discarded by user or not auto-resumed).');
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        this.toastService.info('Paused session discarded.', 3000);
        return false; // Paused session was discarded or not applicable for auto-resume
      }
    }
    // If no pausedState or version mismatch
    console.log('WorkoutPlayer.checkForPausedSession - No valid paused session found in storage.');
    return false;
  }

  private stopAllActivity(): void {
    console.log('stopAllActivity - Stopping timers and auto-save.');
    this.stopAutoSave();
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
    this.isRestTimerVisible.set(false);
    // Don't unsubscribe from routerEventsSub or routeSub here, they manage themselves or are handled by ngOnDestroy
  }

  // ... (resumeSession method should now just be a simple call or primarily for the UI button)
  async resumeSession(): Promise<void> {
    if (this.sessionState() === SessionState.Paused) {
      console.log('resumeSession button clicked - transitioning from Paused to Playing');
      // The state was already saved when it was paused.
      // We just need to re-initialize timers and UI from the paused state values.
      this.workoutStartTime = Date.now(); // Reset start time for this new segment of work
      this.sessionState.set(SessionState.Playing);
      this.startSessionTimer(); // Uses sessionTimerElapsedSecondsBeforePause
      this.startAutoSave();

      if (this.wasTimedSetRunningOnPause && this.timedSetTimerState() === TimedSetState.Paused) {
        this.startOrResumeTimedSet(); // Resumes using timedSetElapsedSeconds
      }
      this.wasTimedSetRunningOnPause = false; // Reset flag

      if (this.wasRestTimerVisibleOnPause && this.restTimerRemainingSecondsOnPause > 0) {
        this.startRestPeriod(this.restTimerRemainingSecondsOnPause, true); // true to indicate it's resuming a paused rest
      }
      this.wasRestTimerVisibleOnPause = false; // Reset flag

      this.closeWorkoutMenu();
      this.closePerformanceInsights();
      this.toastService.info('Workout session resumed.', 3000);
    } else {
      console.log('resumeSession called but not in Paused state. Current state:', this.sessionState());
      // If somehow called when not paused, check if there's a discoverable session.
      const resumed = await this.checkForPausedSession(true);
      if (!resumed && this.sessionState() !== SessionState.Playing && this.routineId) {
        this.loadNewWorkoutFromRoute();
      }
    }
  }

  // ... ngOnDestroy should unsubscribe from routerEventsSub and routeSub ...
  ngOnDestroy(): void {
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
    if (this.routerEventsSub) { this.routerEventsSub.unsubscribe(); } // Unsubscribe here
    if (this.presetTimerSub) this.presetTimerSub.unsubscribe();
    this.stopAutoSave();
    this.isRestTimerVisible.set(false);

    if (isPlatformBrowser(this.platformId) && !this.isSessionConcluded &&
      (this.sessionState() === SessionState.Playing || this.sessionState() === SessionState.Paused) && // Save if playing or explicitly paused
      this.routine() && this.currentWorkoutLogExercises().length > 0) {
      console.log('WorkoutPlayer ngOnDestroy - Saving state (session not formally concluded)... State:', this.sessionState());
      this.savePausedSessionState(); // Use direct save
    }

    // if (isPlatformBrowser(this.platformId) && this.countdownAudio) {
    //   this.countdownAudio.pause();
    //   this.countdownAudio = undefined; // Release reference
    // }
  }

  // Method to play a beep using Web Audio API
  private playClientBeep(frequency: number = 800, durationMs: number = 150): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      // Check for AudioContext (standard) or webkitAudioContext (older Safari)
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.warn('Web Audio API not supported in this browser.');
        return;
      }
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();

      oscillator.type = 'sine'; // 'sine', 'square', 'sawtooth', 'triangle'
      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime); // Frequency in Hz
      oscillator.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + durationMs / 1000); // Duration in seconds

      // Close the context after the sound has played to free resources
      setTimeout(() => {
        if (ctx.state !== 'closed') {
          ctx.close();
        }
      }, durationMs + 50);

    } catch (e) {
      console.error('Error playing beep sound:', e);
    }
  }

  // Method to play a "gong" sound using Web Audio API
  private playClientGong(frequency: number = 440, durationMs: number = 700): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        console.warn('Web Audio API not supported in this browser.');
        return;
      }
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(200, ctx.currentTime); // deep tone
      gain.gain.setValueAtTime(1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2); // 2s fade

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 2); // stop after 2 seconds

    } catch (e) {
      console.error('Error playing gong sound:', e);
    }
  }

  private startPresetTimer(duration: number, forActiveSetDisplay: ActiveSetInfo): void {
    this.playerSubState.set(PlayerSubState.PresetCountdown);
    this.presetTimerDuration.set(duration);
    let remaining = duration;
    this.presetTimerCountdownDisplay.set(String(remaining));

    this.restTimerMainText.set(`GET READY: ${forActiveSetDisplay.exerciseData.exerciseName}`);
    const setNumberText = forActiveSetDisplay.isWarmup
      ? `Warm-up ${this.getWarmupSetNumberForDisplay(forActiveSetDisplay.exerciseData, forActiveSetDisplay.setIndex)}/${this.getTotalWarmupSetsForExercise(forActiveSetDisplay.exerciseData)}`
      : `Set ${this.getWorkingSetNumberForDisplay(forActiveSetDisplay.exerciseData, forActiveSetDisplay.setIndex)}/${this.getWorkingSetCountForExercise(forActiveSetDisplay.exerciseData)}`;
    this.restTimerNextUpText.set(setNumberText);


    if (this.presetTimerSub) this.presetTimerSub.unsubscribe();
    this.presetTimerSub = timer(0, 1000).pipe(take(duration + 1)).subscribe({
      next: () => { /* ... update display, play beeps ... */
        this.presetTimerCountdownDisplay.set(String(remaining));
        if (remaining <= this.appSettingsService.countdownSoundSeconds() && remaining > 0 &&
          this.appSettingsService.enableTimerCountdownSound() && duration > 5) {
          this.playClientBeep(600, 150);
        }
        remaining--;
      },
      complete: () => {
        if (this.playerSubState() === PlayerSubState.PresetCountdown) { // Check state before auto-finishing
          this.playClientBeep(1000, 250); // "Go" sound
          this.handlePresetTimerFinished();
        }
      }
    });
  }

  handlePresetTimerFinished(): void {
    if (this.presetTimerSub) {
      this.presetTimerSub.unsubscribe();
      this.presetTimerSub = undefined;
    }
    this.presetTimerCountdownDisplay.set(null);
    this.playerSubState.set(PlayerSubState.PerformingSet); // Transition to performing the set

    // The routine signal should already reflect the target parameters for the upcoming set
    // as it was updated in prepareCurrentSet *before* the pre-set timer decision was made.
    // patchActualsFormBasedOnSessionTargets was also called in prepareCurrentSet.
    // We might not need to do much here other than setting the state.
    this.cdr.detectChanges(); // Ensure UI updates for button text, etc.
    console.log('Pre-set timer finished. Player state set to PerformingSet.');
  }

  skipPresetTimer(): void {
    if (this.playerSubState() === PlayerSubState.PresetCountdown) {
      // this.toastService.info("Pre-set countdown skipped.", 1500);
      if (this.presetTimerSub) {
        this.presetTimerSub.unsubscribe();
        this.presetTimerSub = undefined;
      }
      this.handlePresetTimerFinished();
    }
  }


  // Helpers to get set numbers for display within pre-set timer footer
  private getWarmupSetNumberForDisplay(exercise: WorkoutExercise, currentSetIndexInExercise: number): number {
    let count = 0;
    for (let i = 0; i <= currentSetIndexInExercise; i++) {
      if (exercise.sets[i].isWarmup) count++;
    }
    return count;
  }
  private getTotalWarmupSetsForExercise(exercise: WorkoutExercise): number {
    return exercise.sets.filter(s => s.isWarmup).length;
  }
  private getWorkingSetNumberForDisplay(exercise: WorkoutExercise, currentSetIndexInExercise: number): number {
    let count = 0;
    for (let i = 0; i <= currentSetIndexInExercise; i++) {
      if (!exercise.sets[i].isWarmup) count++;
    }
    return count;
  }
  private getWorkingSetCountForExercise(exercise: WorkoutExercise): number {
    return exercise.sets.filter(s => !s.isWarmup).length;
  }













  private navigateToNextStepInWorkout(completedActiveInfo: ActiveSetInfo, currentSessionRoutine: Routine): void {
    const currentGlobalExerciseIndex = completedActiveInfo.exerciseIndex;
    const currentGlobalSetIndex = completedActiveInfo.setIndex;
    const currentPlayedExercise = currentSessionRoutine.exercises[currentGlobalExerciseIndex];

    let nextExerciseGlobalIndex = currentGlobalExerciseIndex;
    let nextSetIndexInExercise = 0;
    let exerciseBlockChanged = false;

    // --- Determine next exercise and set indices (existing logic) ---
    if (currentGlobalSetIndex < currentPlayedExercise.sets.length - 1) {
      nextSetIndexInExercise = currentGlobalSetIndex + 1;
    } else {
      if (currentPlayedExercise.supersetId && /* ...is part of ongoing superset... */
        currentPlayedExercise.supersetOrder! < currentPlayedExercise.supersetSize! - 1) {
        nextExerciseGlobalIndex++;
        // Boundary check for superset (ensure next exercise is part of same superset)
        if (!(nextExerciseGlobalIndex < currentSessionRoutine.exercises.length &&
          currentSessionRoutine.exercises[nextExerciseGlobalIndex].supersetId === currentPlayedExercise.supersetId)) {
          // This case implies superset structure error or end of routine.
          // For safety, try to find next block or finish.
          const foundBlockIdx = this.findNextExerciseBlockStartIndex(currentGlobalExerciseIndex, currentSessionRoutine);
          if (foundBlockIdx !== -1) {
            nextExerciseGlobalIndex = foundBlockIdx;
            exerciseBlockChanged = true;
          } else { this.finishWorkoutAndReportStatus(); return; } // Changed to use the reporting version
        }
      } else { // End of sets for this exercise, or end of superset block
        const currentBlockTotalRounds = this.totalBlockRounds();
        if (this.currentBlockRound() < currentBlockTotalRounds) {
          this.currentBlockRound.update(r => r + 1);
          if (currentPlayedExercise.supersetId && currentPlayedExercise.supersetOrder !== null) {
            nextExerciseGlobalIndex = currentGlobalExerciseIndex - currentPlayedExercise.supersetOrder; // Go to start of superset
          }
          // For a non-superset exercise, nextExerciseGlobalIndex remains the same for the new round.
        } else { // Finished all rounds for this block
          const foundBlockIdx = this.findNextExerciseBlockStartIndex(currentGlobalExerciseIndex, currentSessionRoutine);
          if (foundBlockIdx !== -1) {
            nextExerciseGlobalIndex = foundBlockIdx;
            exerciseBlockChanged = true;
          } else {
            this.finishWorkoutAndReportStatus(); // Changed to use the reporting version
            return;
          }
        }
      }
    }

    // Update indices for the upcoming set
    this.currentExerciseIndex.set(nextExerciseGlobalIndex);
    this.currentSetIndex.set(nextSetIndexInExercise);

    if (exerciseBlockChanged) {
      this.currentBlockRound.set(1); // Reset round for new block
      const newBlockStarterExercise = currentSessionRoutine.exercises[nextExerciseGlobalIndex];
      if (!newBlockStarterExercise.supersetId || newBlockStarterExercise.supersetOrder === 0) {
        this.totalBlockRounds.set(newBlockStarterExercise.rounds ?? 1);
      } else {
        const actualBlockStart = currentSessionRoutine.exercises.find(ex => ex.supersetId === newBlockStarterExercise.supersetId && ex.supersetOrder === 0);
        this.totalBlockRounds.set(actualBlockStart?.rounds ?? 1);
      }
      this.lastPerformanceForCurrentExercise = null; // Reset for new exercise block
    }

    // --- Decision point for rest or next set preparation ---
    const restDurationAfterCompletedSet = completedActiveInfo.setData.restAfterSet;
    if (restDurationAfterCompletedSet > 0) {
      this.startRestPeriod(restDurationAfterCompletedSet);
    } else {
      // No rest, directly prepare the next set (which might include a pre-set timer)
      this.playerSubState.set(PlayerSubState.PerformingSet); // Tentatively set, prepareCurrentSet might change it
      this.prepareCurrentSet();
    }
  }

  private startRestPeriod(duration: number, isResumingPausedRest: boolean = false): void {
    this.playerSubState.set(PlayerSubState.Resting);
    this.restDuration.set(duration);

    if (isPlatformBrowser(this.platformId) && duration > 0) { // Ensure duration > 0 for timer
      const activeInfoJustCompleted = this.activeSetInfo(); // This is info about the set JUST completed
      const routineVal = this.routine();

      if (!isResumingPausedRest) {
        this.restTimerMainText.set("RESTING");
        // For "UP NEXT", we need to peek at what the *next* set will be.
        // This requires knowing the indices that navigateToNextStepInWorkout has *just set*.
        // Or, getNextUpText needs to calculate based on *current* indices and assume it's for the *next* set.
        // Let's assume getNextUpText is smart enough or we pass the *next* set's info.
        // For simplicity, let's calculate next up based on current indices (which point to the next set).
        const nextSetInfo = this.peekNextSetInfo(); // A new helper method
        this.restTimerNextUpText.set(
          nextSetInfo ?
            `${nextSetInfo.isWarmup ? 'Warm-up ' : ''}Set ${nextSetInfo.isWarmup ? this.getWarmupSetNumberForDisplay(nextSetInfo.exerciseData, nextSetInfo.setIndex) : this.getWorkingSetNumberForDisplay(nextSetInfo.exerciseData, nextSetInfo.setIndex)} of ${nextSetInfo.exerciseData.exerciseName}`
            : 'Next Exercise'
        );

      } else {
        this.restTimerMainText.set(this.restTimerMainTextOnPause);
        this.restTimerNextUpText.set(this.restTimerNextUpTextOnPause);
      }

      this.playerSubState.set(PlayerSubState.Resting);
      this.restDuration.set(duration);

      this.isRestTimerVisible.set(true); // Show full-screen timer
      this.updateRestTimerDisplay(duration); // For footer
    } else {
      // This 'else' should ideally not be reached if duration is 0,
      // as navigateToNextStepInWorkout would call prepareCurrentSet directly.
      // But as a fallback:
      this.isRestTimerVisible.set(false);
      this.playerSubState.set(PlayerSubState.PerformingSet);
      this.prepareCurrentSet();
    }
  }

  // New helper to peek at the next set's details without advancing state
  private peekNextSetInfo(): ActiveSetInfo | null {
    const r = this.routine();
    const exIndex = this.currentExerciseIndex(); // These indices point to the *upcoming* set
    const sIndex = this.currentSetIndex();

    if (r && r.exercises[exIndex] && r.exercises[exIndex].sets[sIndex]) {
      const exerciseData = r.exercises[exIndex];
      const setData = r.exercises[exIndex].sets[sIndex]; // This is the *planned* set data
      return {
        exerciseIndex: exIndex, setIndex: sIndex, exerciseData, setData,
        isWarmup: !!setData.isWarmup, isCompleted: false // Dummy values
      };
    }
    return null;
  }

  handleRestTimerFinished(): void {
    console.log('Rest timer finished.');
    this.isRestTimerVisible.set(false);
    // this.playerSubState.set(PlayerSubState.PerformingSet); // prepareCurrentSet will determine the next subState
    this.prepareCurrentSet(); // This will handle if a pre-set timer is next, or directly to performing
  }

  handleRestTimerSkipped(): void {
    console.log('Rest timer skipped.');
    this.isRestTimerVisible.set(false);
    this.toastService.info("Rest skipped.", 2000);
    this.playerSubState.set(PlayerSubState.PerformingSet);
    this.prepareCurrentSet();
  }

  getDisabled(): boolean {
    return this.timedSetTimerState() === TimedSetState.Running ||
      this.sessionState() === SessionState.Paused ||
      this.playerSubState() === PlayerSubState.PresetCountdown || // Disable inputs during pre-set
      this.playerSubState() === PlayerSubState.Resting; // Disable inputs during rest
  }


  // This method is now the main action when the big button is clicked
  handleMainAction(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Please resume to continue.", 3000, "Paused");
      return;
    }

    switch (this.playerSubState()) {
      case PlayerSubState.PerformingSet:
        // Was "SET DONE", so complete the set and proceed
        this.completeAndLogCurrentSet();
        break;
      case PlayerSubState.PresetCountdown:
        // Button might say "GETTING READY..." or be disabled.
        // If somehow clickable, perhaps it should skip the countdown.
        this.skipPresetTimer();
        break;
      case PlayerSubState.Resting:
        // Button might say "RESTING..." or "SKIP REST".
        this.skipRest();
        break;
    }
  }

  // Add this to WorkoutPlayerComponent class
  readonly shouldRunPresetTimerForCurrentSet = computed<boolean>(() => {
    const enablePreset = this.appSettingsService.enablePresetTimer();
    const presetDurationValue = this.appSettingsService.presetTimerDurationSeconds();
    if (!enablePreset || presetDurationValue <= 0) return false;

    const r = this.routine();
    const exIdx = this.currentExerciseIndex();
    const sIdx = this.currentSetIndex();

    if (!r || !r.exercises[exIdx] || !r.exercises[exIdx].sets[sIdx]) return false;

    const isFirstSetOfFirstExerciseInWorkout = exIdx === 0 && sIdx === 0 && this.currentBlockRound() === 1;
    let previousSetRestDuration = Infinity; // Assume significant rest if no previous set
    if (sIdx > 0) {
      previousSetRestDuration = r.exercises[exIdx].sets[sIdx - 1].restAfterSet;
    } else if (exIdx > 0) {
      const prevExercise = r.exercises[exIdx - 1];
      previousSetRestDuration = prevExercise.sets[prevExercise.sets.length - 1].restAfterSet;
    }
    return isFirstSetOfFirstExerciseInWorkout || previousSetRestDuration === 0;
  });
}