import { Component, inject, OnInit, OnDestroy, signal, computed, WritableSignal, ChangeDetectorRef, HostListener, PLATFORM_ID, ViewChildren, QueryList, ElementRef, effect } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, Observable, of, timer, firstValueFrom, interval, Subject } from 'rxjs';
import { switchMap, tap, map, takeWhile, take, filter, takeUntil } from 'rxjs/operators';
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
import { LongPressDirective } from '../../shared/directives/long-press.directive';
import { id } from '@swimlane/ngx-charts';
import { ExerciseDetailComponent } from '../exercise-library/exercise-detail';
import { ModalComponent } from '../../shared/components/modal/modal.component';


// Interface to manage the state of the currently active set/exercise
interface ActiveSetInfo {
  exerciseIndex: number;
  setIndex: number;
  exerciseData: WorkoutExercise; // This WorkoutExercise will have sessionStatus
  setData: ExerciseSetParams;
  baseExerciseInfo?: Exercise;
  isCompleted: boolean;
  actualReps?: number;
  actualWeight?: number | null;
  actualDuration?: number;
  notes?: string; // This is for the *individual set's notes*
  type: 'standard' | 'warmup' | 'amrap' | 'custom';
}

// NEW Interface for our flattened Tabata/HIIT intervals
export interface HIITInterval {
  type: 'prepare' | 'work' | 'rest';
  duration: number;
  exerciseName?: string;
  totalIntervals: number;
  currentIntervalNumber: number;
}

export interface PausedWorkoutState {
  version: string;
  routineId: string | null;
  sessionRoutine: Routine; // Routine object, its exercises will have sessionStatus
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
  // --- NEW: TABATA RESUME FIELDS ---
  isTabataMode?: boolean;
  tabataCurrentIntervalIndex?: number;
  tabataTimeRemainingOnPause?: number;
}

enum SessionState {
  Loading = 'loading',
  Playing = 'playing',
  Paused = 'paused',
  Error = 'error',
  End = 'end',
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
  imports: [CommonModule, RouterLink, DatePipe, ReactiveFormsModule, FormsModule, WeightUnitPipe, FullScreenRestTimerComponent, LongPressDirective, ModalComponent, ExerciseDetailComponent],
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
  private platformId = inject(PLATFORM_ID);
  // --- State Signals ---
  protected routine = signal<Routine | null | undefined>(undefined);
  program = signal<TrainingProgram | null | undefined>(undefined);
  sessionState = signal<SessionState>(SessionState.Loading);
  public readonly PlayerSubState = PlayerSubState;
  playerSubState = signal<PlayerSubState>(PlayerSubState.PerformingSet);

  currentExerciseIndex = signal(0);
  currentSetIndex = signal(0);
  currentBlockRound = signal(1);
  totalBlockRounds = signal(1);

  // --- Timer Signals & Properties ---
  sessionTimerDisplay = signal('00:00:00');
  private workoutStartTime: number = 0;
  private sessionTimerElapsedSecondsBeforePause = 0;
  private timerSub: Subscription | undefined;

  timedSetTimerState = signal<TimedSetState>(TimedSetState.Idle);
  timedSetElapsedSeconds = signal(0);
  private timedSetIntervalSub: Subscription | undefined;
  private soundPlayedForThisCountdownSegment = false;

  presetTimerCountdownDisplay = signal<string | null>(null);
  presetTimerDuration = signal(0);
  private presetTimerSub: Subscription | undefined;

  isRestTimerVisible = signal(false);
  restDuration = signal(0);
  restTimerDisplay = signal<string | null>(null);
  restTimerMainText = signal('RESTING');
  restTimerNextUpText = signal<string | null>(null);

  readonly nextActionButtonLabel = computed(() => { // This might be redundant with mainActionButtonLabel
    switch (this.playerSubState()) {
      case PlayerSubState.PresetCountdown:
        return 'GETTING READY...';
      case PlayerSubState.Resting:
        return 'RESTING...';
      case PlayerSubState.PerformingSet:
      default:
        return 'SET DONE';
    }
  });

  currentSetForm!: FormGroup;
  lastPerformanceForCurrentExercise: LastPerformanceSummary | null = null;
  editingTarget: 'reps' | 'weight' | 'duration' | null = null;
  editingTargetValue: number | string = '';
  routineId: string | null = null;

  // --- For Exercise Selection Modal ---
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
      (ex.primaryMuscleGroup && ex.primaryMuscleGroup.toLowerCase().includes(term))
    );
  });
  // --- End Exercise Selection Modal ---

  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';
  private readonly PAUSED_STATE_VERSION = '1.2'; // Updated for sessionStatus
  private originalRoutineSnapshot: WorkoutExercise[] = [];
  protected currentWorkoutLogExercises = signal<LoggedWorkoutExercise[]>([]);
  private wasRestTimerVisibleOnPause = false;
  private restTimerRemainingSecondsOnPause = 0;
  private restTimerInitialDurationOnPause = 0;
  private restTimerMainTextOnPause = 'RESTING';
  private restTimerNextUpTextOnPause: string | null = null;
  private wasTimedSetRunningOnPause = false;
  private autoSaveSub: Subscription | undefined;
  private readonly AUTO_SAVE_INTERVAL_MS = 8000;
  private isSessionConcluded = false;
  private routerEventsSub: Subscription | undefined;
  private isInitialLoadComplete = false;
  private exercisesProposedThisCycle = { doLater: false, skipped: false };



  // ... (inside the WorkoutPlayerComponent class)

  // ... (existing signals and properties)

  // --- NEW: TABATA MODE STATE SIGNALS ---
  @ViewChildren('intervalListItem') intervalListItems!: QueryList<ElementRef<HTMLLIElement>>;
  isTabataMode = signal<boolean>(false);
  tabataIntervals = signal<HIITInterval[]>([]);
  currentTabataIntervalIndex = signal(0);
  tabataTimeRemaining = signal(0);

  // Computed signal for easy access to the current interval's data
  currentTabataInterval = computed<HIITInterval | null>(() => {
    const intervals = this.tabataIntervals();
    const index = this.currentTabataIntervalIndex();
    return intervals[index] || null;
  });
  private tabataIntervalMap: [number, number][] = [];

  private tabataTimerSub: Subscription | undefined;
  // --- END: TABATA MODE STATE SIGNALS ---


  readonly shouldStartWithPresetTimer = computed<boolean>(() => {
    const activeInfo = this.activeSetInfo();
    if (!activeInfo) return false;

    const enablePreset = this.appSettingsService.enablePresetTimer();
    const presetDurationValue = this.appSettingsService.presetTimerDurationSeconds();
    if (!enablePreset || presetDurationValue <= 0) return false;

    const r = this.routine();
    const exIndex = activeInfo.exerciseIndex;
    const sIndex = activeInfo.setIndex;

    if (!r || !r.exercises[exIndex] || !r.exercises[exIndex].sets[sIndex]) return false;

    const isFirstSetOfFirstExerciseInWorkout = exIndex === 0 && sIndex === 0 && this.currentBlockRound() === 1;

    let previousSetRestDuration = Infinity;
    if (sIndex > 0) {
      previousSetRestDuration = r.exercises[exIndex].sets[sIndex - 1].restAfterSet;
    } else if (exIndex > 0) {
      const prevExercise = r.exercises[exIndex - 1];
      previousSetRestDuration = prevExercise.sets[prevExercise.sets.length - 1].restAfterSet;
    }
    return isFirstSetOfFirstExerciseInWorkout || previousSetRestDuration === 0;
  });


  readonly mainActionButtonLabel = computed(() => {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    switch (this.playerSubState()) {
      case PlayerSubState.PresetCountdown:
        return `PREPARING... ${this.presetTimerCountdownDisplay()}s`;
      case PlayerSubState.Resting:
        return `RESTING: ${this.restTimerDisplay()}`; // Or "SKIP REST"
      case PlayerSubState.PerformingSet:
        if (this.checkIfLatestSetOfWorkoutConsideringPending()) {
          // If the current set's exercise is not 'pending', show a different label
          const sessionStatus = this.activeSetInfo()?.exerciseData.sessionStatus;
          if (sessionStatus === 'skipped' || sessionStatus === 'do_later') {
            // If the set is still pending (not all sets logged), propose to complete it
            if (
              activeInfo &&
              routine &&
              activeInfo.exerciseData.sets.length > 0
            ) {
              // Check if there are any sets not logged for this exercise
              const logged = this.currentWorkoutLogExercises().find(le => le.exerciseId === activeInfo.exerciseData.exerciseId);
              const allSetsLogged = logged && logged.sets.length === activeInfo.exerciseData.sets.length;
              if (!allSetsLogged) {
                return this.checkIfSetIsPartOfRounds() ?
                  (this.checkIfLatestSetOfRound() ? 'COMPLETE ROUND' : 'SET DONE')
                  : (this.checkIfLatestSetOfExercise() ? 'COMPLETE EXERCISE' : 'SET DONE');
              }
            }
            return sessionStatus === 'skipped'
              ? 'SKIPPED'
              : 'DO LATER';
          }

          // Check if there are any sets not logged for this exercise
          if (activeInfo !== null) {
            const logged = this.currentWorkoutLogExercises().find(le => le.exerciseId === activeInfo.exerciseData.exerciseId);
            const allSetsLogged = logged && logged.sets.length === activeInfo.exerciseData.sets.length;
            if (!allSetsLogged) {
              return this.checkIfSetIsPartOfRounds() ?
                (this.checkIfLatestSetOfRound() ? 'COMPLETE ROUND' : 'SET DONE')
                : (this.checkIfLatestSetOfExercise() ? 'COMPLETE EXERCISE' : 'SET DONE');
            } else {
              if (this.checkIfLatestSetOfExercise()) { // This should also consider pending
                if (this.checkIfSetIsPartOfRounds()) {
                  if (this.checkIfLatestSetOfRound()) {
                    if (this.checkIfLatestRoundOfRounds()) {
                      return 'FINISH WORKOUT';
                    }
                    return 'COMPLETE ROUND';
                  }
                  return 'COMPLETE EXERCISE';
                } else {
                  return 'SET DONE';
                }
              }
            }
          }
          return 'FINISH WORKOUT';
        } else if (this.checkIfLatestSetOfExercise()) { // This should also consider pending
          return this.checkIfSetIsPartOfRounds() ?
            (this.checkIfLatestSetOfRound() ? 'COMPLETE ROUND' : 'COMPLETE EXERCISE')
            : 'COMPLETE EXERCISE'
        } else {
          return 'SET DONE';
        }
      default:
        return 'SET DONE';
    }
  });


  private readonly destroy$ = new Subject<void>();
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
      return r.exercises[exIndex].sets.filter(s => s.type !== 'warmup').length;
    }
    return 0;
  });

  getCurrentWorkingSetNumber = computed<number>(() => {
    const activeInfo = this.activeSetInfo();
    const r = this.routine();
    if (!activeInfo || !r || (activeInfo.type === 'warmup')) {
      return 0;
    }
    const currentExercise = r.exercises[activeInfo.exerciseIndex];
    let workingSetCounter = 0;
    for (let i = 0; i <= activeInfo.setIndex; i++) {
      if (currentExercise.sets[i].type !== 'warmup') {
        workingSetCounter++;
      }
    }
    return workingSetCounter; // Return count up to and including current set
  });

  getCurrentWarmupSetNumber = computed<number>(() => {
    const activeInfo = this.activeSetInfo();
    const r = this.routine();
    if (!activeInfo || !r || activeInfo.type !== 'warmup') {
      return 0;
    }
    const currentExercise = r.exercises[activeInfo.exerciseIndex];
    let warmupSetCounter = 0;
    for (let i = 0; i <= activeInfo.setIndex; i++) {
      if (currentExercise.sets[i].type === 'warmup') {
        warmupSetCounter++;
      }
    }
    return warmupSetCounter; // Return count up to and including current set
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
        type: (setData.type as 'standard' | 'warmup' | 'amrap' | 'custom') ?? 'standard',
        baseExerciseInfo: undefined,
        isCompleted: !!completedSetLog,
        actualReps: completedSetLog?.repsAchieved,
        actualWeight: completedSetLog?.weightUsed,
        actualDuration: completedSetLog?.durationPerformed,
        notes: completedSetLog?.notes, // This is the logged note for this specific set completion
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

  allPreviousLoggedSetsForCurrentSession = computed<LoggedSet[]>(() => {
    const activeInfo = this.activeSetInfo();
    if (!activeInfo) {
      return [];
    }
    const allLoggedSets: LoggedSet[] = [];
    for (const exLog of this.currentWorkoutLogExercises()) {
      for (const set of exLog.sets) {
        // Only include sets that were performed before the current set in the session
        // Compare by exercise index and set index in the routine
        const routine = this.routine();
        if (!routine) continue;
        const exerciseIdx = routine.exercises.findIndex(e => e.exerciseId === exLog.exerciseId);
        // const exerciseIdx = routine.exercises.findIndex(e => e.exerciseId === exLog.exerciseId && e.id === (exLog as any).id);
        if (exerciseIdx < 0) continue;
        // If before current exercise, include all sets
        if (exerciseIdx < activeInfo.exerciseIndex) {
          allLoggedSets.push(set);
        } else if (exerciseIdx === activeInfo.exerciseIndex) {
          // For current exercise, only include sets before the current set index
          const setIdx = routine.exercises[exerciseIdx].sets.findIndex(s => s.id === set.plannedSetId);
          if (setIdx > -1 && setIdx < activeInfo.setIndex) {
            allLoggedSets.push(set);
          }
        }
      }
    }
    return allLoggedSets;
  });

  isWorkoutMenuVisible = signal(false);
  isPerformanceInsightsVisible = signal(false);
  showCompletedSetsInfo = signal<boolean>(false);
  private isPerformingDeferredExercise = false;
  private lastActivatedDeferredExerciseId: string | null = null;

  private readonly stopWeightIncrementHandler: () => void;
  private readonly stopWeightDecrementHandler: () => void;

  constructor() {
    this.initializeCurrentSetForm();

    this.stopWeightIncrementHandler = this.onWeightIncrementPointerUp.bind(this);
    this.stopWeightDecrementHandler = this.onWeightDecrementPointerUp.bind(this);

    // --- ADD THIS EFFECT ---
    // This effect will automatically run whenever currentTabataIntervalIndex changes.
    effect(() => {
      const index = this.currentTabataIntervalIndex();

      // Ensure the list items have been rendered by the time this runs.
      if (this.intervalListItems && this.intervalListItems.length > index) {
        // Get the specific <li> element for the current index.
        const activeItemElement = this.intervalListItems.toArray()[index].nativeElement;

        // Command the browser to scroll the element into view.
        activeItemElement.scrollIntoView({
          behavior: 'smooth', // For a nice, smooth scroll instead of an instant jump
          block: 'start',     // Aligns the top of the element to the top of the scroll container
        });
      }
    });
  }

  private resetAndPatchCurrentSetForm(): void { // May be largely covered by patchActuals...
    this.currentSetForm.reset({ rpe: null, setNotes: '' }); // Include setNotes reset
    this.rpeValue.set(null);
    this.showRpeSlider.set(false);
    this.resetTimedSet();
    this.patchActualsFormBasedOnSessionTargets(); // This will handle most patching
  }

  private startSessionTimer(): void {
    if (this.sessionState() === SessionState.Paused) return;
    if (this.timerSub) this.timerSub.unsubscribe();

    this.timerSub = timer(0, 1000).pipe(
      takeUntil(this.destroy$) // Add this line
    ).subscribe(() => {
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
    // Find the log entry for this specific exercise instance (by id, not just exerciseId)
    // This ensures that if the same exercise appears multiple times (different id/order), they are not merged
    const exerciseIndex = this.routine()?.exercises.findIndex(ex => ex.id === exerciseData.id);

    // Find log by both exerciseId and exerciseData.id (unique instance in routine)
    let exerciseLog: LoggedWorkoutExercise | undefined;
    let logIndex = -1;
    for (let i = 0; i < logs.length; i++) {
      const exLog = logs[i];
      // Find the corresponding exercise in the routine for this log
      const routineEx = this.routine()?.exercises.find(ex => ex.id === exerciseData.id);

      if (
        exLog.exerciseId === exerciseData.exerciseId &&
        routineEx &&
        routineEx.id === exerciseData.id &&
        routineEx.id === exLog.id
      ) {
        exerciseLog = exLog;
        logIndex = i;
        break;
      }
    }

    if (exerciseLog) {
      // Find set by plannedSetId (unique per set in the session)
      const existingSetIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === loggedSet.plannedSetId);
      if (existingSetIndex > -1) {
        exerciseLog.sets[existingSetIndex] = loggedSet;
      } else {
        exerciseLog.sets.push(loggedSet);
      }
    } else {
      // Use the exerciseName from the currentBaseExercise if available, otherwise from the routine
      const exerciseName = this.currentBaseExercise()?.name || exerciseData.exerciseName || 'Unknown Exercise';
      const newLog: LoggedWorkoutExercise = {
        id: exerciseData.id,
        exerciseId: exerciseData.exerciseId,
        exerciseName,
        sets: [loggedSet],
        rounds: exerciseData.rounds || 0,
        type: loggedSet.type || 'standard'
      };

      if (exerciseData.rounds && exerciseData.rounds > 0) {
        newLog.supersetId = exerciseData.supersetId ? exerciseData.supersetId : null;
        newLog.supersetOrder = exerciseData.supersetOrder !== null ? exerciseData.supersetOrder : null;
        newLog.supersetSize = exerciseData.supersetSize !== null ? exerciseData.supersetSize : null;
        newLog.supersetRounds = exerciseData.supersetRounds !== null ? exerciseData.supersetRounds : null;
      }

      // Insert at the same index as in the routine for consistency
      if (typeof exerciseIndex === 'number' && exerciseIndex >= 0 && exerciseIndex <= logs.length) {
        logs.splice(exerciseIndex, 0, newLog);
      } else {
        logs.push(newLog);
      }
    }
    this.currentWorkoutLogExercises.set([...logs]);
  }

  async finishWorkout(): Promise<void> {
    await this.finishWorkoutAndReportStatus();
  }

  private comparePerformedToOriginal(
    performed: LoggedWorkoutExercise[],
    original: WorkoutExercise[]
  ): { majorDifference: boolean; details: string[] } {
    const details: string[] = [];
    let majorDifference = false;

    // Filter original to only include exercises that were *not* 'skipped' or 'do_later' (unless logged)
    // For comparison, we should compare what was *attempted* (logged) against the *original plan*.
    // The sessionRoutine includes sessionStatus, originalRoutineSnapshot does not.
    // The `performed` array is based on what was logged.
    // The `original` is the snapshot before any session statuses.

    // This comparison is about structural changes to the routine definition if user wants to save.
    // So, 'skipped' exercises in the original plan that weren't logged means a deviation.
    // Custom exercises added in `performed` that aren't in `original` are a major diff.

    const originalPlayableExercises = original.filter(origEx => {
      // Check if this original exercise was logged. If so, it was "performed".
      // If not logged, it might have been implicitly skipped (if player advanced past it)
      // or explicitly marked 'skipped' or 'do_later' in the session.
      // For this comparison, an exercise in original not present in performed is a difference.
      return performed.some(pEx => pEx.exerciseId === origEx.exerciseId);
    });
    const performedExercisesThatWereInOriginal = performed.filter(pEx =>
      original.some(oEx => (oEx.exerciseId === pEx.exerciseId || pEx.exerciseName === oEx.exerciseName) && oEx.type !== pEx.type) // Looser match if custom was renamed from original
    );
    const addedCustomExercises = performed.filter(pEx =>
      !original.some(oEx => oEx.exerciseId === pEx.exerciseId) && pEx.exerciseId.startsWith('custom-exercise-')
    );


    if (performedExercisesThatWereInOriginal.length !== original.length || addedCustomExercises.length > 0) {
      details.push(`Number of exercises or their content changed.`);
      majorDifference = true;
    }
    if (addedCustomExercises.length > 0) {
      details.push(`${addedCustomExercises.length} custom exercise(s) added.`);
    }


    // More detailed checks (can be expanded)
    for (const originalEx of original) {
      const performedEx = performed.find(p => p.exerciseId === originalEx.exerciseId);
      if (!performedEx) {
        details.push(`Exercise "${originalEx.exerciseName || originalEx.exerciseId}" was in the plan but not performed.`);
        majorDifference = true; // Could be true or just a note depending on strictness
        continue;
      }

      // Compare sets for warmup status or count differences
      if (performedEx.sets.length !== originalEx.sets.length && performedEx.rounds !== originalEx.rounds) {
        details.push(`Set count for "${performedEx.exerciseName || performedEx.exerciseId}" changed (was ${originalEx.sets.length}, now ${performedEx.sets.length}).`);
        majorDifference = true;
      } else {
        for (let j = 0; j < performedEx.sets.length; j++) {
          const originalIsWarmup = originalEx.sets[j]?.type === 'warmup';
          const performedIsWarmup = performedEx.sets[j]?.type === 'warmup';
          if (originalIsWarmup !== performedIsWarmup) {
            details.push(`Warm-up status for set ${j + 1} of "${performedEx.exerciseName}" changed.`);
            majorDifference = true;
            break;
          }
        }
      }
    }
    return { majorDifference, details };
  }

  private convertLoggedToWorkoutExercises(loggedExercises: LoggedWorkoutExercise[]): WorkoutExercise[] {
    const currentSessionRoutine = this.routine();
    return loggedExercises.map(loggedEx => {
      const sessionExercise = currentSessionRoutine?.exercises.find(re => re.exerciseId === loggedEx.exerciseId);
      const newWorkoutEx: WorkoutExercise = {
        id: uuidv4(),
        exerciseId: loggedEx.exerciseId, // Keep original if it's a known one, or the custom one
        exerciseName: loggedEx.exerciseName,
        supersetId: sessionExercise?.supersetId || null,
        supersetOrder: sessionExercise?.supersetOrder ?? null,
        supersetSize: sessionExercise?.supersetSize ?? null,
        rounds: sessionExercise?.rounds ?? 1,
        notes: sessionExercise?.notes, // Overall exercise notes from session if any
        sets: loggedEx.sets.map(loggedSet => {
          const originalPlannedSet = sessionExercise?.sets.find(s => s.id === loggedSet.plannedSetId);
          return {
            id: uuidv4(), // New ID for the routine template set
            reps: loggedSet.targetReps ?? loggedSet.repsAchieved, // Prefer saving targets
            weight: loggedSet.targetWeight ?? loggedSet.weightUsed,
            duration: loggedSet.targetDuration ?? loggedSet.durationPerformed,
            tempo: loggedSet.targetTempo || originalPlannedSet?.tempo,
            restAfterSet: originalPlannedSet?.restAfterSet || 60, // Prefer planned rest
            notes: loggedSet.notes, // Persist individual logged set notes if saving structure
            type: loggedSet.type as 'standard' | 'warmup' | 'amrap' | 'custom' | string,
          };
        }),
        type: (sessionExercise?.supersetSize ?? 0) >= 1 ? 'superset' : 'standard'
        // sessionStatus is NOT included here as it's session-specific
      };
      return newWorkoutEx;
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
      this.soundPlayedForThisCountdownSegment = false;
    }
    this.timedSetTimerState.set(TimedSetState.Running);

    if (this.timedSetIntervalSub) {
      this.timedSetIntervalSub.unsubscribe();
    }

    this.timedSetIntervalSub = timer(0, 1000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.timedSetTimerState() === TimedSetState.Running) {
        this.timedSetElapsedSeconds.update(s => s + 1);
        const currentElapsed = this.timedSetElapsedSeconds();
        this.currentSetForm.get('actualDuration')?.setValue(currentElapsed, { emitEvent: false });

        const activeInfo = this.activeSetInfo();
        const targetDuration = activeInfo?.setData?.duration;
        const enableSound = this.appSettingsService.enableTimerCountdownSound();
        const countdownFrom = this.appSettingsService.countdownSoundSeconds();

        if (enableSound && targetDuration && targetDuration > 20 && currentElapsed > 0) {
          const remainingSeconds = targetDuration - currentElapsed;
          if (remainingSeconds <= countdownFrom && remainingSeconds >= 0) {
            if (remainingSeconds === 0) {
              this.playClientGong();
              this.soundPlayedForThisCountdownSegment = true;
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
    this.soundPlayedForThisCountdownSegment = false;
  }

  stopAndLogTimedSet(): void {
    if (this.timedSetTimerState() === TimedSetState.Running || this.timedSetTimerState() === TimedSetState.Paused) {
      this.pauseTimedSet(); // Pause it, the value is already in timedSetElapsedSeconds
    }
  }

  checkIfLatestSetOfExercise(): boolean {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    if (!activeInfo || !routine) return false;

    // Check if current exercise's sessionStatus is not 'pending'
    if (activeInfo.exerciseData.sessionStatus && activeInfo.exerciseData.sessionStatus !== 'pending') {
      return true; // If exercise is skipped/do-later, effectively its "last set" for current flow
    }

    const currentExercise = routine.exercises[activeInfo.exerciseIndex];
    // Check if this is the last set in the current exercise's list of sets
    if (activeInfo.setIndex === currentExercise.sets.length - 1) return true;

    // If there are more sets, check if all subsequent sets are warmups (less likely for this function's typical use)
    for (let i = activeInfo.setIndex + 1; i < currentExercise.sets.length; i++) {
      if (currentExercise.sets[i].type !== 'warmup') {
        return false; // Found a subsequent working set
      }
    }
    return true; // All subsequent sets are warmups
  }

  /**
   * Returns true if the current set is the last set of the current round for the current exercise block.
   * For non-superset, non-multi-round exercises, this is equivalent to checkIfLatestSetOfExercise().
   * For supersets or multi-round blocks, returns true if this is the last set of the last exercise in the block for the current round.
   */
  checkIfLatestSetOfRound(): boolean {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    if (!activeInfo || !routine) return false;

    const currentExercise = routine.exercises[activeInfo.exerciseIndex];

    // If not in a superset or multi-round block, fallback to FALSE cause it's not a true round
    if ((!currentExercise.supersetId && (!currentExercise.rounds || currentExercise.rounds <= 1))) {
      return false;
    }

    // Find the block start and end indices
    let blockStartIdx = activeInfo.exerciseIndex;
    let blockEndIdx = activeInfo.exerciseIndex;
    if (currentExercise.supersetId && currentExercise.supersetOrder !== null) {
      blockStartIdx = activeInfo.exerciseIndex - currentExercise.supersetOrder;
      blockEndIdx = blockStartIdx + (currentExercise.supersetSize ? currentExercise.supersetSize - 1 : 0);
    }

    // The last set of the last exercise in the block for the current round
    if (
      activeInfo.exerciseIndex === blockEndIdx &&
      activeInfo.setIndex === routine.exercises[blockEndIdx].sets.length - 1
    ) {
      return true;
    }

    return false;
  }

  /**
   * Returns true if the current block (exercise or superset) is on its last round.
   * Handles both single exercises with rounds > 1 and supersets with rounds > 1.
   */
  checkIfLatestRoundOfRounds(): boolean {
    const routine = this.routine();
    const activeInfo = this.activeSetInfo();
    if (!routine || !activeInfo) return false;

    const exercise = routine.exercises[activeInfo.exerciseIndex];
    if (!exercise) return false;

    let totalRounds = exercise.rounds ?? 1;
    // If part of a superset, get rounds from block start
    if (exercise.supersetId && exercise.supersetOrder !== null) {
      const blockStart = routine.exercises.find(
        ex => ex.supersetId === exercise.supersetId && ex.supersetOrder === 0
      );
      totalRounds = blockStart?.rounds ?? 1;
    }

    return this.currentBlockRound() === totalRounds;
  }

  /**
   * Determines if the current set is part of a multi-round block (i.e., the exercise or its superset block has rounds > 1).
   * Returns an object with isPartOfRounds and the total number of rounds.
   */
  checkIfSetIsPartOfRounds(): boolean {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    if (!activeInfo || !routine) return false;

    const exercise = routine.exercises[activeInfo.exerciseIndex];
    if (!exercise) return false;

    // If exercise is part of a superset, get rounds from the block start
    if (exercise.supersetId && exercise.supersetOrder !== null) {
      const blockStart = routine.exercises.find(
        ex => ex.supersetId === exercise.supersetId && ex.supersetOrder === 0
      );
      const rounds = blockStart?.rounds ?? 1;
      return rounds > 0;
    }

    // Otherwise, use the exercise's own rounds property
    const rounds = (exercise.rounds &&
      exercise.supersetId !== undefined &&
      exercise.supersetId !== null) ? 1 : 0;
    return rounds > 0;
  }


  checkIfLatestSetOfWorkout(): boolean { // Legacy name, use checkIfLatestSetOfWorkoutConsideringPending
    return this.checkIfLatestSetOfWorkoutConsideringPending();
  }

  // Ensure checkIfLatestSetOfWorkoutConsideringPending uses the refined check
  checkIfLatestSetOfWorkoutConsideringPending(): boolean {
    const activeInfo = this.activeSetInfo();
    const currentRoutine = this.routine();
    if (!activeInfo || !currentRoutine) return false;

    // Scenario 1: Current exercise itself is not 'pending'
    if (activeInfo.exerciseData.sessionStatus && activeInfo.exerciseData.sessionStatus !== 'pending') {
      // Check if there are any other 'pending' exercises *after* this one.
      for (let i = activeInfo.exerciseIndex + 1; i < currentRoutine.exercises.length; i++) {
        if (currentRoutine.exercises[i].sessionStatus === 'pending') {
          return false; // Found a future pending exercise
        }
      }
      // No future pending exercises. Now check for *any* unlogged 'do_later' or 'skipped' exercises.
      const hasUnfinishedDeferred = currentRoutine.exercises.some(ex =>
        (ex.sessionStatus === 'do_later' || ex.sessionStatus === 'skipped') &&
        !this.isExerciseFullyLogged(ex.exerciseId, activeInfo.exerciseIndex, ex.id)
      );
      return !hasUnfinishedDeferred; // True (latest) if no unfinished deferred/skipped
    }

    // Scenario 2: Current exercise IS 'pending'.
    if (!this.checkIfLatestSetOfExercise()) {
      return false; // Not the last set of the current pending exercise
    }

    // It IS the last set of the current pending exercise.
    // Check if any 'pending' exercises exist *after* it.
    for (let i = activeInfo.exerciseIndex + 1; i < currentRoutine.exercises.length; i++) {
      if (currentRoutine.exercises[i].sessionStatus === 'pending' && currentRoutine.exercises[i].sets.length > 0) {
        return false; // Found a future pending exercise with sets
      }
    }

    // No more 'pending' exercises after this one in the main sequence.
    // Now, check if there are *any* unlogged 'do_later' or 'skipped' exercises in the whole routine.
    const hasUnfinishedDeferred = currentRoutine.exercises.some((ex, index) =>
      (ex.sessionStatus === 'do_later' || ex.sessionStatus === 'skipped') &&
      !this.isExerciseFullyLogged(ex.exerciseId, index, ex.id)
    );

    return !hasUnfinishedDeferred;
  }

  private getUnfinishedOrDeferredExercises(sessionRoutine: Routine): any[] {
    const currentExercise = sessionRoutine.exercises[this.currentExerciseIndex()];
    const unfinishedOtherExercises = this.getUnfinishedExercises().filter(
      ex => ex.id !== currentExercise.id
    );
    console.log("Unfinished exercises (excluding current):", unfinishedOtherExercises.map(e => e.exerciseName));

    const unfinishedDeferredOrSkippedExercises = sessionRoutine.exercises
      .map((ex, idx) => ({ ...ex, originalIndex: idx }))
      .filter((ex, innerIdx) =>
        (ex.sessionStatus === 'do_later' || ex.sessionStatus === 'skipped') &&
        !this.isExerciseFullyLogged(ex.exerciseId, innerIdx, ex.id)
      )
      .sort((a, b) => {
        if (a.sessionStatus === 'do_later' && b.sessionStatus === 'skipped') return -1;
        if (a.sessionStatus === 'skipped' && b.sessionStatus === 'do_later') return 1;
        return a.originalIndex - b.originalIndex;
      });

    const unfinishedOtherExercisesWithIndex = unfinishedOtherExercises.map((ex, idx) => ({
      ...ex,
      originalIndex: sessionRoutine.exercises.findIndex(e => e.id === ex.id)
    }));
    // Merge and deduplicate unfinished exercises by their unique id
    const mergedUnfinishedExercises = [
      ...unfinishedDeferredOrSkippedExercises,
      ...unfinishedOtherExercisesWithIndex
    ].filter((ex, idx, arr) =>
      arr.findIndex(e => e.id === ex.id) === idx
    );

    mergedUnfinishedExercises.sort((a, b) => {
      const idxA = sessionRoutine.exercises.findIndex(ex => ex.id === a.id);
      const idxB = sessionRoutine.exercises.findIndex(ex => ex.id === b.id);
      return idxA - idxB;
    });

    return mergedUnfinishedExercises;
  }


  private async tryProceedToDeferredExercisesOrFinish(sessionRoutine: Routine): Promise<void> {
    console.log("tryProceedToDeferredExercisesOrFinish: ENTERED. Proposed flags before:", JSON.stringify(this.exercisesProposedThisCycle));
    const mergedUnfinishedExercises = this.getUnfinishedOrDeferredExercises(sessionRoutine);
    console.log("tryProceedToDeferredExercisesOrFinish: Found unfinished deferred/skipped:", mergedUnfinishedExercises.map(e => `${e.exerciseName} (${e.sessionStatus})`));

    if (mergedUnfinishedExercises.length > 0) {
      let proceedWithSelectedExercise = false;
      let selectedExerciseOriginalIndex: number | undefined;
      let userChoseToFinishNow = false;
      let userCancelledChoice = false;

      if (mergedUnfinishedExercises.length === 1) {
        const singleEx = mergedUnfinishedExercises[0];
        const confirmSingle = await this.alertService.showConfirmationDialog(
          `Unfinished: ${singleEx.exerciseName}`,
          `You have "${singleEx.exerciseName}" (${singleEx.sessionStatus === 'do_later' ? 'Do Later' : 'Skipped'}) remaining. Complete it now?`,
          [
            { text: 'Complete It', role: 'confirm', data: singleEx.originalIndex, cssClass: 'bg-blue-500 hover:bg-blue-600 text-white' } as AlertButton,
            { text: 'Finish Workout', role: 'destructive', data: 'finish_now', cssClass: 'bg-green-500 hover:bg-green-600 text-white' } as AlertButton,
            { text: 'Cancel (Decide Later)', role: 'cancel', data: 'cancel_deferred_choice' } as AlertButton // Added Cancel here too
          ]
        );
        if (confirmSingle && typeof confirmSingle.data === 'number') {
          proceedWithSelectedExercise = true;
          selectedExerciseOriginalIndex = confirmSingle.data;
        } else if (confirmSingle && confirmSingle.data === 'finish_now') {
          userChoseToFinishNow = true;
        } else { // Includes cancel_deferred_choice or dialog dismissal
          userCancelledChoice = true;
        }
      } else { // Multiple unfinished exercises
        const exerciseButtons: AlertButton[] = mergedUnfinishedExercises.map(ex => {
          // Convert sessionStatus to a user-friendly label
          let statusLabel = '';

          let cssClass = 'bg-gray-500 dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-300 hover:text-gray-500 hover:dark:bg-gray-300 hover:dark:text-gray-500';
          switch (ex.sessionStatus) {
            case 'do_later':
              statusLabel = 'Do Later';
              cssClass = 'bg-orange-500 hover:bg-orange-600 text-white';
              break;
            case 'skipped':
              statusLabel = 'Skipped';
              cssClass = 'bg-yellow-500 hover:bg-yellow-600 text-black';
              break;
            case 'pending':
              statusLabel = 'Pending';
              cssClass = 'bg-violet-500 hover:bg-violet-600 text-black';
              break;
            default:
              statusLabel = ex.sessionStatus || '';
          }
          return {
            text: `${ex.exerciseName} (${statusLabel})`,
            role: 'confirm',
            data: ex.originalIndex,
            cssClass: cssClass
          };
        });
        const alertButtons: AlertButton[] = [
          ...exerciseButtons,
          { text: 'Finish Workout Now', role: 'destructive', data: 'finish_now', cssClass: 'bg-green-500 hover:bg-green-600 text-white mt-4' },
          { text: 'Cancel (Decide Later)', role: 'cancel', data: 'cancel_deferred_choice' }
        ];

        const choice = await this.alertService.showConfirmationDialog(
          'Unfinished Exercises',
          'You have unfinished exercises. Would you like to complete any of them now, or finish the workout?',
          alertButtons,
        );

        if (choice && typeof choice.data === 'number') {
          proceedWithSelectedExercise = true;
          selectedExerciseOriginalIndex = choice.data;
        } else if (choice && choice.data === 'finish_now') {
          userChoseToFinishNow = true;
        } else { // Includes cancel_deferred_choice or dialog dismissal
          userCancelledChoice = true;
        }
      }

      // Handle choices
      if (userChoseToFinishNow) {
        console.log("tryProceedToDeferredExercisesOrFinish: User chose 'Finish Workout Now'.");
        await this.finishWorkoutAndReportStatus();
        return;
      }

      if (userCancelledChoice) {
        console.log("tryProceedToDeferredExercisesOrFinish: User cancelled choice of deferred exercises. Setting proposal flags.");
        // Mark that proposals happened for *all* categories that were presented in this list.
        mergedUnfinishedExercises.forEach(ex => {
          if (ex.sessionStatus === 'do_later') this.exercisesProposedThisCycle.doLater = true;
          if (ex.sessionStatus === 'skipped') this.exercisesProposedThisCycle.skipped = true;
        });
        console.log("tryProceedToDeferredExercisesOrFinish: Proposed flags after cancel:", JSON.stringify(this.exercisesProposedThisCycle));
        this.cdr.detectChanges(); // For mainActionButtonLabel update
        // IMPORTANT: Return here to prevent falling through to finishWorkoutAndReportStatus()
        // The user chose to "decide later", so the player should wait for their next action.
        return;
      }

      if (proceedWithSelectedExercise && selectedExerciseOriginalIndex !== undefined) {
        const exerciseToStart = sessionRoutine.exercises[selectedExerciseOriginalIndex];
        console.log(`tryProceedToDeferredExercisesOrFinish: User selected exercise: ${exerciseToStart.exerciseName}`);
        this.isPerformingDeferredExercise = true;
        this.lastActivatedDeferredExerciseId = exerciseToStart.id;

        const updatedRoutine = JSON.parse(JSON.stringify(sessionRoutine)) as Routine;
        updatedRoutine.exercises[selectedExerciseOriginalIndex].sessionStatus = 'pending';
        this.routine.set(updatedRoutine);

        this.currentExerciseIndex.set(selectedExerciseOriginalIndex);
        this.currentSetIndex.set(this.findFirstUnloggedSetIndex(exerciseToStart.exerciseId, exerciseToStart.sets.map(s => s.id)) || 0);
        this.currentBlockRound.set(1); // Reset round for this specific exercise block
        const newBlockStarter = updatedRoutine.exercises[selectedExerciseOriginalIndex];
        if (!newBlockStarter.supersetId || newBlockStarter.supersetOrder === 0) {
          this.totalBlockRounds.set(newBlockStarter.rounds ?? 1);
        } else {
          const actualBlockStart = updatedRoutine.exercises.find(ex => ex.supersetId === newBlockStarter.supersetId && ex.supersetOrder === 0);
          this.totalBlockRounds.set(actualBlockStart?.rounds ?? 1);
        }
        this.lastPerformanceForCurrentExercise = null;
        this.playerSubState.set(PlayerSubState.PerformingSet);
        await this.prepareCurrentSet();
        return; // Exit as we're now performing the chosen exercise
      }
    }

    // If there were no unfinished exercises, or if some edge case led here without a return.
    console.log("tryProceedToDeferredExercisesOrFinish: No unfinished exercises to propose or all paths handled. Finishing workout.");

    if (this.routineId === "-1") {
      const endCurrentWorkout = await this.alertService.showConfirmationDialog(
        `Continue or End`,
        'Would you like to add a new exercise to the current session or complete it?',
        [
          { text: 'Add exercise', role: 'add_exercise', data: 'add_exercise', cssClass: 'bg-primary hover:bg-primary-dark text-white' } as AlertButton,
          { text: 'End session', role: 'end_session', data: "end_session", cssClass: 'bg-blue-500 hover:bg-blue-600 text-white' } as AlertButton,
        ],
      );

      if (endCurrentWorkout && endCurrentWorkout.role === 'end_session') {
        await this.finishWorkoutAndReportStatus();
      } else {
        this.openExerciseSelectionModal();
      }
    } else {
      await this.finishWorkoutAndReportStatus();
    }
  }

  private isExerciseFullyLogged(exerciseIdName: string, exerciseIndex: number, exerciseId: string): boolean {
    const routine = this.routine();
    if (!routine) return false;
    const exercise = routine.exercises.find(ex => ex.exerciseId === exerciseIdName && ex.id === exerciseId);
    if (!exercise) return false;

    const loggedEx = this.currentWorkoutLogExercises().find(le =>
      le.exerciseId === exerciseIdName
      && exercise.exerciseId === le.exerciseId
      && le.id === exerciseId
    );

    if (!loggedEx) return false;

    // Determine rounds for this exercise (handle supersets)
    let rounds = exercise.rounds ?? 1;
    if (exercise.supersetId && exercise.supersetOrder !== null) {
      const blockStart = routine.exercises.find(
        ex => ex.supersetId === exercise.supersetId && ex.supersetOrder === 0
      );
      rounds = blockStart?.rounds ?? 1;
    }

    // Calculate the total number of planned sets for this exercise, considering rounds (for supersets/multi-rounds)
    let totalPlannedSets = exercise.sets.length;
    // if (rounds > 1) {
    //   totalPlannedSets = exercise.sets.length * rounds;
    // }

    const plannedSetsForAllRounds = totalPlannedSets * rounds;
    return loggedEx.sets.length >= totalPlannedSets;
  }

  private findFirstUnloggedSetIndex(exerciseId: string, plannedSetIds: string[]): number | null {
    const loggedEx = this.currentWorkoutLogExercises().find(le => le.exerciseId === exerciseId);
    if (!loggedEx) return 0; // No sets logged, start from first

    const loggedPlannedSetIds = new Set(loggedEx.sets.map(s => s.plannedSetId));
    for (let i = 0; i < plannedSetIds.length; i++) {
      if (!loggedPlannedSetIds.has(plannedSetIds[i])) {
        return i; // This is the index of the first planned set not found in logs
      }
    }
    return null; // All sets seem to be logged, or no planned sets (should not happen here)
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
      setNotes: [''], // Added for individual set notes
      rpe: [null as number | null, [Validators.min(1), Validators.max(10)]]
    });
  }

  private async prepareCurrentSet(): Promise<void> {
    console.log('prepareCurrentSet: START');
    if (this.sessionState() === SessionState.Paused) {
      console.log("prepareCurrentSet: Session is paused, deferring preparation.");
      return;
    }

    const sessionRoutine = this.routine();
    if (!sessionRoutine || sessionRoutine.exercises.length === 0) {
      console.warn('prepareCurrentSet: No sessionRoutine or no exercises in routine. Current routine:', sessionRoutine);
      this.sessionState.set(SessionState.Error);
      this.toastService.error("Cannot prepare set: Routine data is missing or empty.", 0, "Error");
      return;
    }

    let exIndex = this.currentExerciseIndex();
    let sIndex = this.currentSetIndex();

    console.log(`prepareCurrentSet: Initial target - exIndex: ${exIndex}, sIndex: ${sIndex}, sessionStatus: ${sessionRoutine.exercises[exIndex]?.sessionStatus}`);

    if (sessionRoutine.exercises[exIndex]?.sessionStatus !== 'pending') {
      console.log(`prepareCurrentSet: Initial target Ex ${exIndex} (name: ${sessionRoutine.exercises[exIndex]?.exerciseName}) is ${sessionRoutine.exercises[exIndex]?.sessionStatus}. Finding first 'pending'.`);
      const firstPendingInfo = this.findFirstPendingExerciseAndSet(sessionRoutine);

      if (firstPendingInfo) {
        exIndex = firstPendingInfo.exerciseIndex;
        sIndex = firstPendingInfo.setIndex;
        this.currentExerciseIndex.set(exIndex);
        this.currentSetIndex.set(sIndex);
        this.isPerformingDeferredExercise = false; // Reset if we had to find a new starting point
        console.log(`prepareCurrentSet: Found first pending - exIndex: ${exIndex} (name: ${sessionRoutine.exercises[exIndex]?.exerciseName}), sIndex: ${sIndex}`);
      } else {
        console.log("prepareCurrentSet: No 'pending' exercises found in the entire routine. Proceeding to deferred/finish evaluation.");
        this.exercisesProposedThisCycle = { doLater: false, skipped: false };
        await this.tryProceedToDeferredExercisesOrFinish(sessionRoutine);
        return;
      }
    }

    if (exIndex >= sessionRoutine.exercises.length || !sessionRoutine.exercises[exIndex] || sIndex >= sessionRoutine.exercises[exIndex].sets.length || !sessionRoutine.exercises[exIndex].sets[sIndex]) {
      this.currentSetForm.reset({ rpe: null, setNotes: '' }); this.resetTimedSet(); this.currentBaseExercise.set(null);
      this.exercisePBs.set([]); this.lastPerformanceForCurrentExercise = null; this.rpeValue.set(null); this.showRpeSlider.set(false);
      console.error(`prepareCurrentSet: CRITICAL ERROR - Calculated exIndex ${exIndex} or sIndex ${sIndex} is out of bounds or data is invalid.`);
      this.sessionState.set(SessionState.Error);
      this.toastService.error("Error preparing set: Invalid exercise or set index.", 0, "Load Error");
      return;
    }

    const currentExerciseData = sessionRoutine.exercises[exIndex];
    const currentPlannedSetData = currentExerciseData.sets[sIndex]; // Use direct sIndex after validation

    console.log(`prepareCurrentSet: Preparing for Ex: "${currentExerciseData.exerciseName}", Set: ${sIndex + 1}, Type: ${currentPlannedSetData.type}`);


    const originalExerciseForSuggestions = this.originalRoutineSnapshot.find(oe => oe.exerciseId === currentExerciseData.exerciseId) || currentExerciseData;
    const plannedSetForSuggestions = originalExerciseForSuggestions?.sets[sIndex] || currentPlannedSetData;

    this.loadBaseExerciseAndPBs(currentExerciseData.exerciseId);

    if (!this.lastPerformanceForCurrentExercise || this.lastPerformanceForCurrentExercise.sets[0]?.exerciseId !== currentExerciseData.exerciseId) {
      this.lastPerformanceForCurrentExercise = await firstValueFrom(this.trackingService.getLastPerformanceForExercise(currentExerciseData.exerciseId).pipe(take(1)));
    }
    const historicalSetPerformance = this.trackingService.findPreviousSetPerformance(this.lastPerformanceForCurrentExercise, plannedSetForSuggestions, sIndex);
    let finalSetParamsForSession: ExerciseSetParams;
    if (plannedSetForSuggestions.type === 'warmup') {
      finalSetParamsForSession = { ...plannedSetForSuggestions };
    } else {
      finalSetParamsForSession = this.workoutService.suggestNextSetParameters(historicalSetPerformance, plannedSetForSuggestions, sessionRoutine.goal);
    }
    finalSetParamsForSession.id = currentPlannedSetData.id; // Ensure ID from current routine set is used
    finalSetParamsForSession.type = currentPlannedSetData.type;
    finalSetParamsForSession.notes = currentPlannedSetData.notes || finalSetParamsForSession.notes;

    const updatedRoutineForSession = JSON.parse(JSON.stringify(sessionRoutine)) as Routine;
    updatedRoutineForSession.exercises[exIndex].sets[sIndex] = finalSetParamsForSession;
    this.routine.set(updatedRoutineForSession); // Update the routine signal
    this.patchActualsFormBasedOnSessionTargets(); // This uses activeSetInfo() which depends on routine()

    // Pre-set timer logic...
    const enablePreset = this.appSettingsService.enablePresetTimer();
    const enablePresetAfterRest = this.appSettingsService.enablePresetTimerAfterRest();
    const presetDurationValue = this.appSettingsService.presetTimerDurationSeconds();
    // Determine if it's the absolute first set of the *entire workout session* for preset timer
    const isEffectivelyFirstSetInWorkout =
      this.currentWorkoutLogExercises().length === 0 &&
      this.currentBlockRound() === 1 &&
      exIndex === this.findFirstPendingExerciseAndSet(sessionRoutine)?.exerciseIndex &&
      sIndex === this.findFirstPendingExerciseAndSet(sessionRoutine)?.setIndex;

    let previousSetRestDuration = Infinity;
    if (sIndex > 0) {
      previousSetRestDuration = currentExerciseData.sets[sIndex - 1].restAfterSet;
    } else if (exIndex > 0) {
      // Find the actual previous *played* exercise's last set rest
      // This logic might need to be more robust if exercises can be reordered dynamically beyond skip/do-later
      let prevPlayedExIndex = exIndex - 1;
      let foundPrevPlayed = false;
      while (prevPlayedExIndex >= 0) {
        if (this.isExerciseFullyLogged(sessionRoutine.exercises[prevPlayedExIndex].exerciseId, prevPlayedExIndex, sessionRoutine.exercises[prevPlayedExIndex].id) ||
          (sessionRoutine.exercises[prevPlayedExIndex].sessionStatus === 'pending' && this.currentWorkoutLogExercises().some(le => le.exerciseId === sessionRoutine.exercises[prevPlayedExIndex].exerciseId))) {
          const prevExercise = sessionRoutine.exercises[prevPlayedExIndex];
          if (prevExercise.sets.length > 0) {
            previousSetRestDuration = prevExercise.sets[prevExercise.sets.length - 1].restAfterSet;
            foundPrevPlayed = true;
          }
          break;
        }
        prevPlayedExIndex--;
      }
      if (!foundPrevPlayed) previousSetRestDuration = Infinity; // No previously played exercise found
    }


    const shouldRunPresetTimer = enablePreset && presetDurationValue > 0 &&
      ((this.playerSubState() !== PlayerSubState.Resting &&
        (isEffectivelyFirstSetInWorkout || previousSetRestDuration === 0)) || enablePresetAfterRest);

    if (shouldRunPresetTimer) {
      console.log('prepareCurrentSet: Starting pre-set timer for:', currentExerciseData.exerciseName, 'Set:', sIndex + 1);
      this.playerSubState.set(PlayerSubState.PresetCountdown);
      // Ensure activeSetInfo() is valid before passing to startPresetTimer
      const activeInfoForPreset = this.activeSetInfo();
      if (activeInfoForPreset) {
        this.startPresetTimer(presetDurationValue, activeInfoForPreset);
      } else {
        console.error("prepareCurrentSet: ActiveSetInfo is null before starting preset timer. Aborting preset.");
        this.playerSubState.set(PlayerSubState.PerformingSet);
      }
    } else {
      console.log('prepareCurrentSet: No pre-set timer, setting to PerformingSet for:', currentExerciseData.exerciseName, 'Set:', sIndex + 1);
      this.playerSubState.set(PlayerSubState.PerformingSet);
    }

    if (this.sessionState() !== SessionState.Playing && this.sessionState() !== SessionState.Paused) {
      console.log("prepareCurrentSet: Setting sessionState to Playing.");
      this.sessionState.set(SessionState.Playing);
    }
    console.log('prepareCurrentSet: END');
  }


  private findFirstPendingExerciseAndSet(routine: Routine): { exerciseIndex: number; setIndex: number } | null {
    if (!routine || !routine.exercises) return null;
    for (let i = 0; i < routine.exercises.length; i++) {
      const exercise = routine.exercises[i];
      if (exercise.sessionStatus === 'pending' && exercise.sets && exercise.sets.length > 0) {
        const firstUnloggedSetIdx = this.findFirstUnloggedSetIndex(exercise.exerciseId, exercise.sets.map(s => s.id)) ?? 0;
        // Ensure firstUnloggedSetIdx is valid
        if (firstUnloggedSetIdx < exercise.sets.length) {
          return { exerciseIndex: i, setIndex: firstUnloggedSetIdx };
        } else {
          // This case means all sets are logged, but exercise is still 'pending' - shouldn't happen if logic is correct elsewhere.
          // Or exercise has sets but findFirstUnloggedSetIndex returned null unexpectedly.
          console.warn(`Exercise ${exercise.exerciseName} is pending, but all sets appear logged or index is invalid.`);
          // To be safe, we could mark it as non-pending here or let outer logic handle it.
          // For now, just continue searching.
        }
      }
    }
    return null;
  }


  private patchActualsFormBasedOnSessionTargets(): void {
    if (this.sessionState() === SessionState.Paused) {
      console.log("patchActualsFormBasedOnSessionTargets: Session is paused, deferring preparation.");
      return;
    }
    // Do not reset the entire form here, only specific fields. Keep setNotes if user typed something.
    this.currentSetForm.patchValue({ rpe: null }, { emitEvent: false });
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

    let weightForForm: number | null | undefined = activeInfo.setData.weight;
    // Fallback logic for weight
    if (weightForForm === null || weightForForm === undefined) {
      const allLoggedSetsForThisEx = this.currentWorkoutLogExercises()
        .find(exLog => exLog.exerciseId === activeInfo.exerciseData.exerciseId)?.sets || [];

      const previousLoggedSetsInSessionForThisExercise = allLoggedSetsForThisEx.filter(s => {
        const plannedSetOfLogged = activeInfo.exerciseData.sets.find(ps => ps.id === s.plannedSetId);
        return plannedSetOfLogged && activeInfo.exerciseData.sets.indexOf(plannedSetOfLogged) < activeInfo.setIndex;
      }).sort((a, b) => activeInfo.exerciseData.sets.findIndex(s => s.id === a.plannedSetId) - activeInfo.exerciseData.sets.findIndex(s => s.id === b.plannedSetId));


      if (previousLoggedSetsInSessionForThisExercise.length > 0) {
        const lastActualPrevSet = previousLoggedSetsInSessionForThisExercise[previousLoggedSetsInSessionForThisExercise.length - 1];
        if (lastActualPrevSet.weightUsed !== null && lastActualPrevSet.weightUsed !== undefined) {
          weightForForm = lastActualPrevSet.weightUsed;
          if (activeInfo.type !== 'warmup' && !completedSetLogThisSession) { // Only toast if not already logged and not warmup
            // this.toastService.info(`Using weight from previous set: ${weightForForm}${this.weightUnitDisplaySymbol}`, 2000, "Auto-fill");
          }
        }
      } else if (activeInfo.type === 'warmup' && (activeInfo.setData.weight === null || activeInfo.setData.weight === undefined)) {
        // Default warm-up weight (e.g., bar only, or specific exercise default if available)
        // For now, if activeInfo.setData.weight is null/undefined, it means no specific warm-up weight was planned.
        // We could fetch baseExerciseInfo and check for a default warm-up weight property if that existed.
        // Current behavior: use null if nothing else specified.
        weightForForm = activeInfo.setData.weight ?? null;
      }
    }


    if (completedSetLogThisSession) {
      this.currentSetForm.patchValue({
        actualReps: completedSetLogThisSession.repsAchieved,
        actualWeight: completedSetLogThisSession.weightUsed,
        actualDuration: initialActualDuration,
        setNotes: completedSetLogThisSession.notes ?? '', // Use logged notes
        rpe: completedSetLogThisSession.rpe
      }, { emitEvent: false });
      if (completedSetLogThisSession.rpe) this.rpeValue.set(completedSetLogThisSession.rpe);
    } else {
      // For a new, unlogged set, patch targets and keep existing form values for notes if any
      this.currentSetForm.patchValue({
        actualReps: activeInfo.setData.reps ?? (activeInfo.type === 'warmup' ? 8 : null),
        actualWeight: weightForForm ?? null,
        actualDuration: initialActualDuration,
        setNotes: activeInfo.setData.notes || (activeInfo.type === 'warmup' ? 'Warm-up' : ''), // Prefer planned notes for a fresh set
        rpe: null
      }, { emitEvent: false });
    }
  }

  async editWeightWithPrompt(): Promise<void> {
    if (this.getDisabled() || this.playerSubState() !== PlayerSubState.PerformingSet) {
      this.toastService.warning("Cannot edit weight now.", 2000);
      return;
    }
    const activeInfo = this.activeSetInfo();
    if (!activeInfo) return;

    const currentWeight = this.csf['actualWeight'].value;
    const promptResult = await this.alertService.showPromptDialog(
      'Enter Weight',
      ``,
      [{
        name: 'newWeight',
        type: 'number',
        placeholder: `Current: ${currentWeight ?? '0'} ${this.weightUnitDisplaySymbol}`,
        value: currentWeight ?? undefined,
        attributes: { step: 1, min: '0', inputmode: 'decimal' }
        // attributes: { step: this.appSettingsService.weightStep(), min: '0', inputmode: 'decimal' }
      }] as AlertInput[],
      'Set Weight'
    );

    if (promptResult && promptResult['newWeight'] !== undefined && promptResult['newWeight'] !== null) {
      const newWeightValue = parseFloat(String(promptResult['newWeight']));
      if (!isNaN(newWeightValue) && newWeightValue >= 0) {
        this.currentSetForm.patchValue({ actualWeight: newWeightValue });
      } else {
        this.toastService.error('Invalid weight entered.', 3000, 'Error');
      }
    }
  }


  private loadBaseExerciseAndPBs(exerciseId: string): void {
    if (exerciseId.startsWith('custom-exercise-')) {
      this.currentBaseExercise.set({ id: exerciseId, name: this.activeSetInfo()?.exerciseData.exerciseName || 'Custom Exercise', category: 'custom', description: '', iconName: 'custom-exercise', muscleGroups: [], primaryMuscleGroup: '', equipment: '', imageUrls: [] });
      this.exercisePBs.set([]);
      return;
    }
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
    const activeInfo = this.activeSetInfo();
    const currentRoutineValue = this.routine();
    if (!activeInfo || !currentRoutineValue) { this.toastService.error("Cannot log set: data unavailable.", 0); return; }

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
          firstInvalidControl = key; break;
        }
      }
      this.toastService.error(`Please correct input: ${firstInvalidControl ? firstInvalidControl + ' is invalid.' : 'form invalid.'}`, 0, 'Validation Error');
      return;
    }

    const formValues = this.currentSetForm.value; // Includes setNotes

    let durationToLog = formValues.actualDuration;
    if (activeInfo.setData.duration && activeInfo.setData.duration > 0 && this.timedSetElapsedSeconds() > 0) {
      durationToLog = this.timedSetElapsedSeconds();
    } else if (formValues.actualDuration === null && activeInfo.setData.duration) {
      durationToLog = activeInfo.setData.duration;
    }

    const loggedSetData: LoggedSet = {
      id: uuidv4(), // Unique ID for this specific logged instance
      exerciseName: activeInfo.exerciseData.exerciseName,
      plannedSetId: activeInfo.setData.id,
      exerciseId: activeInfo.exerciseData.exerciseId,
      type: activeInfo.setData.type,
      repsAchieved: formValues.actualReps ?? (activeInfo.setData.type === 'warmup' ? 0 : activeInfo.setData.reps ?? 0),
      weightUsed: formValues.actualWeight ?? (activeInfo.setData.type === 'warmup' ? null : activeInfo.setData.weight),
      durationPerformed: durationToLog,
      rpe: formValues.rpe ?? undefined,
      targetReps: activeInfo.setData.reps,
      targetWeight: activeInfo.setData.weight,
      targetDuration: activeInfo.setData.duration,
      targetTempo: activeInfo.setData.tempo,
      notes: formValues.setNotes?.trim() || undefined, // Get notes from form
      timestamp: new Date().toISOString(),
    };
    this.addLoggedSetToCurrentLog(activeInfo.exerciseData, loggedSetData);

    if (this.sessionState() === SessionState.Playing) {
      this.captureAndSaveStateForUnload();
    }

    this.rpeValue.set(null);
    this.showRpeSlider.set(false);
    this.editingTarget = null;
    // Do not reset setNotes here, it will be reset when new set is prepared by patchActualsFormBasedOnSessionTargets or patchCurrentSetFormWithData
    this.currentSetForm.patchValue({ setNotes: '' }, { emitEvent: false }); // Clear notes after logging for current set form visually.

    this.navigateToNextStepInWorkout(activeInfo, currentRoutineValue);
  }

  private findNextExerciseBlockStartIndex(currentExerciseGlobalIndex: number, routine: Routine): number {
    // This needs to respect sessionStatus
    for (let i = currentExerciseGlobalIndex + 1; i < routine.exercises.length; i++) {
      const nextEx = routine.exercises[i];
      if (nextEx.sessionStatus === 'pending' && (!nextEx.supersetId || nextEx.supersetOrder === 0)) {
        return i;
      }
    }
    return -1; // No more pending blocks
  }

  getNextUpText(completedActiveSetInfo: ActiveSetInfo | null, currentSessionRoutine: Routine | null): string {
    if (!completedActiveSetInfo || !currentSessionRoutine) return 'Next Set/Exercise';

    const exercises = currentSessionRoutine.exercises;
    const currExIdx = completedActiveSetInfo.exerciseIndex;
    const currSetIdx = completedActiveSetInfo.setIndex;

    // Helper to check if an exercise is pending and not fully logged, considering rounds
    const isPendingAndNotLogged = (ex: WorkoutExercise, idx: number) => {
      const log = this.currentWorkoutLogExercises().find(le => le.exerciseId === ex.exerciseId && currentSessionRoutine.exercises[idx].id === ex.id);
      const totalPlannedSets = (ex.sets?.length ?? 0) * (ex.rounds ?? 1);
      const loggedSetsCount = log?.sets?.length ?? 0;
      return ex.sessionStatus === 'pending' && (loggedSetsCount < totalPlannedSets);
    };

    // Helper to get round info for an exercise (handles supersets)
    const getRoundInfo = (ex: WorkoutExercise): { round: number, totalRounds: number } => {
      let totalRounds = ex.rounds ?? 1;
      if (ex.supersetId && ex.supersetOrder !== null) {
        const blockStart = exercises.find(e => e.supersetId === ex.supersetId && e.supersetOrder === 0);
        totalRounds = blockStart?.rounds ?? 1;
      }
      // Use currentBlockRound signal for current, otherwise 1
      const round = this.currentBlockRound ? this.currentBlockRound() : 1;
      return { round, totalRounds };
    };

    // Find next set in current exercise
    const currExercise = exercises[currExIdx];
    if (currExercise) {
      // Next set in same exercise
      if (currSetIdx + 1 < currExercise.sets.length) {
        const nextSet = currExercise.sets[currSetIdx + 1];
        let setNumber = 1;
        if (nextSet.type === 'warmup') {
          setNumber = currExercise.sets.slice(0, currSetIdx + 2).filter(s => s.type === 'warmup').length;
        } else {
          setNumber = currExercise.sets.slice(0, currSetIdx + 2).filter(s => s.type !== 'warmup').length;
        }
        const setType = nextSet.type === 'warmup' ? "Warm-up" : "Set";
        const { round, totalRounds } = getRoundInfo(currExercise);
        let roundText = totalRounds > 1 ? ` (Round ${round}/${totalRounds})` : '';
        return `${setType} ${setNumber}/${currExercise.sets.length} of ${currExercise.exerciseName}${roundText}`;
      }
      // Next exercise
      for (let i = currExIdx + 1; i < exercises.length; i++) {
        const ex = exercises[i];
        if (isPendingAndNotLogged(ex, i)) {
          const firstSet = ex.sets[0];
          let setType = firstSet.type === 'warmup' ? "Warm-up" : "Set";
          let setNumber = 1;
          const { round, totalRounds } = getRoundInfo(ex);
          let roundText = totalRounds > 1 ? ` (Round ${round}/${totalRounds})` : '';
          return `${setType} ${setNumber} of ${ex.exerciseName}${roundText}`;
        }
      }
    }

    // If no more pending, check for do_later/skipped
    const hasDoLater = exercises.some(ex => ex.sessionStatus === 'do_later' && !this.exercisesProposedThisCycle.doLater);
    if (hasDoLater) return 'Do Later Exercises';
    const hasSkipped = exercises.some(ex => ex.sessionStatus === 'skipped' && !this.exercisesProposedThisCycle.skipped);
    if (hasSkipped) return 'Skipped Exercises';

    const { round, totalRounds } = getRoundInfo(currExercise);

    // If there are multiple rounds and the user isn't on the last one
    if (totalRounds > 1 && round < totalRounds) {
      // Find the next exercise in the block (superset or multi-round)
      let nextExerciseName = '';
      // If part of a superset, find the next exercise in the superset block
      if (currExercise.supersetId && currExercise.supersetOrder !== null) {
        const blockExercises = exercises.filter(
          e => e.supersetId === currExercise.supersetId
        );
        const currOrder = currExercise.supersetOrder ?? 0;
        if (currOrder + 1 < blockExercises.length) {
          nextExerciseName = blockExercises[currOrder + 1].exerciseName || '';
        } else {
          // If at end of block, next round starts at first exercise in block
          nextExerciseName = blockExercises[0].exerciseName || '';
        }
      } else {
        // Not a superset, so just repeat the same exercise for next round
        nextExerciseName = currExercise.exerciseName || '';
      }
      return `Complete Round ${round}/${totalRounds}${nextExerciseName ? ` [Next exercise: ${nextExerciseName}]` : ''}${currExercise.sets?.length ? ` (${currExercise.sets.length} sets)` : ''}`;
    }

    const mergedUnfinishedExercises = this.getUnfinishedOrDeferredExercises(currentSessionRoutine);

    // If there are unfinished exercises (do_later/skipped/pending), suggest the next one in routine order
    if (mergedUnfinishedExercises.length > 0) {
      // Find the first unfinished exercise that comes after the current exercise in the routine
      const currExIdxInRoutine = completedActiveSetInfo.exerciseIndex;
      // Sort by originalIndex to ensure routine order
      const sortedUnfinished = mergedUnfinishedExercises
        .slice()
        .sort((a, b) => a.originalIndex - b.originalIndex);

      // Find the next unfinished exercise after the current one
      const nextUnfinished = sortedUnfinished.find(ex => ex.originalIndex > currExIdxInRoutine)
        // If none after, wrap to the first unfinished in the routine
        ?? sortedUnfinished[0];

      if (nextUnfinished) {
        let statusLabel = '';
        switch (nextUnfinished.sessionStatus) {
          case 'do_later': statusLabel = 'Do Later'; break;
          case 'skipped': statusLabel = 'Skipped'; break;
          case 'pending': statusLabel = 'Pending'; break;
          default: statusLabel = nextUnfinished.sessionStatus || '';
        }
        return `Next: ${nextUnfinished.exerciseName} (${statusLabel})`;
      }
    }

    return totalRounds >= 1 ? '' : 'Complete';
  }

  skipRest(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Resume to skip rest.", 3000, "Paused");
      return;
    }
    if (this.isRestTimerVisible() || this.playerSubState() === PlayerSubState.Resting) {
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
      // Capture remaining time from full screen timer if it's the source of truth
      // For now, restDuration is the initial, elapsed would need to be tracked by full screen timer.
      // Assuming restDuration() holds the remaining time if full screen timer is active.
      this.restTimerRemainingSecondsOnPause = this.restDuration(); // This should be remaining from full screen if complex
      this.restTimerInitialDurationOnPause = this.restDuration(); // Store initial for pause/resume
      this.restTimerMainTextOnPause = this.restTimerMainText();
      this.restTimerNextUpTextOnPause = this.restTimerNextUpText();
      this.isRestTimerVisible.set(false); // Hide full screen timer on pause
    }
    this.stopAutoSave();
    this.sessionState.set(SessionState.Paused);
    this.savePausedSessionState();
    this.toastService.info("Workout Paused", 3000);
  }

  private async loadStateFromPausedSession(state: PausedWorkoutState): Promise<void> {
    this.routineId = state.routineId;
    this.routine.set(state.sessionRoutine); // This routine has sessionStatus populated
    this.currentWorkoutLogExercises.set(state.currentWorkoutLogExercises);

    // --- NEW: TABATA RESUME LOGIC ---
    if (state.isTabataMode) {
      console.log("Resuming a paused Tabata session.");

      this.sessionState.set(SessionState.Playing);
      this.workoutStartTime = Date.now();
      this.sessionTimerElapsedSecondsBeforePause = state.sessionTimerElapsedSecondsBeforePause;

      // Setup the tabata player from the saved state.
      this.setupTabataMode(
        state.sessionRoutine,
        state.tabataCurrentIntervalIndex,
        state.tabataTimeRemainingOnPause
      );

      this.startSessionTimer();
      this.toastService.success('Tabata session resumed.', 3000, "Resumed");
      // We are done for Tabata mode, so we return early.
      return;
    }
    // --- END: TABATA RESUME LOGIC ---

    this.originalRoutineSnapshot = state.originalRoutineSnapshot ? JSON.parse(JSON.stringify(state.originalRoutineSnapshot)) : [];

    this.currentExerciseIndex.set(state.currentExerciseIndex);
    this.currentSetIndex.set(state.currentSetIndex);

    this.workoutStartTime = Date.now();
    this.sessionTimerElapsedSecondsBeforePause = state.sessionTimerElapsedSecondsBeforePause;

    this.currentBlockRound.set(state.currentBlockRound);
    this.totalBlockRounds.set(state.totalBlockRounds);

    this.timedSetTimerState.set(state.timedSetTimerState);
    this.timedSetElapsedSeconds.set(state.timedSetElapsedSeconds);
    this.wasTimedSetRunningOnPause = state.timedSetTimerState === TimedSetState.Running || state.timedSetTimerState === TimedSetState.Paused;

    this.lastPerformanceForCurrentExercise = state.lastPerformanceForCurrentExercise;

    this.wasRestTimerVisibleOnPause = state.isRestTimerVisibleOnPause;
    this.restTimerRemainingSecondsOnPause = state.restTimerRemainingSecondsOnPause;
    this.restTimerInitialDurationOnPause = state.restTimerInitialDurationOnPause;
    this.restTimerMainTextOnPause = state.restTimerMainTextOnPause;
    this.restTimerNextUpTextOnPause = state.restTimerNextUpTextOnPause;
    this.exercisesProposedThisCycle = { doLater: false, skipped: false };
    this.isPerformingDeferredExercise = false; // RESET HERE
    this.lastActivatedDeferredExerciseId = null;
    await this.prepareCurrentSet(); // This will also handle if current exIndex is not 'pending'
    // If prepareCurrentSet navigates, sessionState might change.
    // Only set to Playing if it didn't error out or navigate away.
    if (this.sessionState() !== SessionState.Error && this.routine()) {
      this.sessionState.set(SessionState.Playing);
      this.startSessionTimer();
      this.startAutoSave();
    }


    if (state.timedSetTimerState === TimedSetState.Running || state.timedSetTimerState === TimedSetState.Paused) {
      this.startOrResumeTimedSet();
      if (state.timedSetTimerState === TimedSetState.Paused) {
        this.pauseTimedSet();
      }
    }

    if (this.wasRestTimerVisibleOnPause && this.restTimerRemainingSecondsOnPause > 0) {
      this.startRestPeriod(this.restTimerRemainingSecondsOnPause, true);
    }
    this.cdr.detectChanges();
    this.toastService.success('Workout session resumed.', 3000, "Resumed");
  }

  private savePausedSessionState(): void {
    if (this.sessionState() === SessionState.End) {
      this.stopAllActivity();
      return;
    }
    const currentRoutine = this.routine();
    if (!currentRoutine) {
      console.warn("Cannot save paused state: routine data is not available.");
      return;
    }

    let currentTotalSessionElapsed = this.sessionTimerElapsedSecondsBeforePause;
    if (this.sessionState() === SessionState.Playing && this.workoutStartTime > 0) {
      currentTotalSessionElapsed += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    }

    let dateToSaveInState: string;
    const firstLoggedSetTime = this.currentWorkoutLogExercises()[0]?.sets[0]?.timestamp;
    const baseTimeForDate = firstLoggedSetTime ? new Date(firstLoggedSetTime) : (this.workoutStartTime > 0 ? new Date(this.workoutStartTime - (this.sessionTimerElapsedSecondsBeforePause * 1000)) : new Date());
    dateToSaveInState = format(baseTimeForDate, 'yyyy-MM-dd');


    const stateToSave: PausedWorkoutState = {
      version: this.PAUSED_STATE_VERSION,
      routineId: this.routineId,
      sessionRoutine: JSON.parse(JSON.stringify(currentRoutine)), // Includes sessionStatus
      originalRoutineSnapshot: JSON.parse(JSON.stringify(this.originalRoutineSnapshot)),
      currentExerciseIndex: this.currentExerciseIndex(),
      currentSetIndex: this.currentSetIndex(),
      currentWorkoutLogExercises: JSON.parse(JSON.stringify(this.currentWorkoutLogExercises())),
      workoutStartTimeOriginal: this.workoutStartTime,
      sessionTimerElapsedSecondsBeforePause: currentTotalSessionElapsed,
      currentBlockRound: this.currentBlockRound(),
      totalBlockRounds: this.totalBlockRounds(),
      timedSetTimerState: this.timedSetTimerState(),
      timedSetElapsedSeconds: this.timedSetElapsedSeconds(),
      isResting: this.isRestTimerVisible(), // Full screen timer state
      isRestTimerVisibleOnPause: this.playerSubState() === PlayerSubState.Resting, // General resting sub-state
      restTimerRemainingSecondsOnPause: this.restDuration(), // Should be remaining time from timer component
      restTimerInitialDurationOnPause: this.restTimerInitialDurationOnPause,
      restTimerMainTextOnPause: this.restTimerMainText(),
      restTimerNextUpTextOnPause: this.restTimerNextUpText(),
      lastPerformanceForCurrentExercise: this.lastPerformanceForCurrentExercise ? JSON.parse(JSON.stringify(this.lastPerformanceForCurrentExercise)) : null,
      workoutDate: dateToSaveInState,
      isTabataMode: this.isTabataMode(),
    };

    if (this.isTabataMode()) {
      stateToSave.tabataCurrentIntervalIndex = this.currentTabataIntervalIndex();
      stateToSave.tabataTimeRemainingOnPause = this.tabataTimeRemaining();
    }

    this.storageService.setItem(this.PAUSED_WORKOUT_KEY, stateToSave);
    console.log('Paused session state saved.', stateToSave);
  }

  private captureAndSaveStateForUnload(): void {
    let currentTotalSessionElapsed = this.sessionTimerElapsedSecondsBeforePause;
    if (this.sessionState() === SessionState.Playing && this.workoutStartTime > 0) {
      currentTotalSessionElapsed += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    }
    const originalElapsed = this.sessionTimerElapsedSecondsBeforePause;
    this.sessionTimerElapsedSecondsBeforePause = currentTotalSessionElapsed;
    this.savePausedSessionState();
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
    const firstWorkingSetIndex = currentExercise.sets.findIndex(s => s.type !== 'warmup');

    // Check if this exercise is part of a superset block and we're about to add a warmup before the first working set
    const isSuperset = currentExercise.supersetId && currentExercise.supersetOrder !== null;
    const isBeforeFirstWorkingSet = activeInfo.setIndex === firstWorkingSetIndex && firstWorkingSetIndex !== -1;

    if (isSuperset && isBeforeFirstWorkingSet) {
      // Insert a new warmup exercise before the superset block
      const newWarmupSet: ExerciseSetParams = {
        id: `warmup-${uuidv4()}`, type: 'warmup', reps: 8, weight: 0,
        duration: undefined, restAfterSet: 30, notes: 'Warm-up set'
      };
      const updatedRoutineForSession = JSON.parse(JSON.stringify(currentRoutineVal)) as Routine;

      // Find the start of the superset block
      let supersetBlockStartIdx = activeInfo.exerciseIndex - (currentExercise.supersetOrder ?? 0);
      if (supersetBlockStartIdx < 0) supersetBlockStartIdx = 0;

      // Create a new warmup exercise (not part of superset)
      const warmupExercise: WorkoutExercise = {
        id: `warmup-ex-${uuidv4()}`,
        exerciseId: currentExercise.exerciseId,
        exerciseName: `${currentExercise.exerciseName} (Warm-up)`,
        sets: [newWarmupSet],
        rounds: 1,
        supersetId: null,
        supersetOrder: null,
        supersetSize: null,
        sessionStatus: 'pending',
        type: 'standard'
      };


      this.addExerciseToCurrentRoutine(warmupExercise, supersetBlockStartIdx);
      this.toastService.success("Warm-up set added as a separate exercise before superset.", 4000, "Warm-up Added");
      this.closeWorkoutMenu();
      this.closePerformanceInsights();
      return;
    }

    if (activeInfo.setIndex > 0 && activeInfo.setIndex > firstWorkingSetIndex && firstWorkingSetIndex !== -1) {
      const confirm = await this.alertService.showConfirm("Add Warm-up Set", "You are past the first working set. Adding a warm-up set now will insert it before the current set. Continue?");
      if (!confirm || !confirm.data) return;
    }
    const newWarmupSet: ExerciseSetParams = {
      id: `warmup-${uuidv4()}`, type: 'warmup', reps: 8, weight: 0, // Default weight 0 for warm-up
      duration: undefined, restAfterSet: 30, notes: 'Warm-up set'
    };
    const updatedRoutineForSession = JSON.parse(JSON.stringify(currentRoutineVal)) as Routine;
    const exerciseToUpdate = updatedRoutineForSession.exercises[activeInfo.exerciseIndex];
    exerciseToUpdate.sets.splice(activeInfo.setIndex, 0, newWarmupSet);
    this.routine.set(updatedRoutineForSession);
    this.toastService.success("Warm-up set added. Fill details & complete.", 4000, "Warm-up Added");
    await this.prepareCurrentSet(); // This will use the new currentSetIndex implicitly
    this.closeWorkoutMenu(); this.closePerformanceInsights();
  }

  getSets(): ExerciseSetParams[] {
    const activeSet = this.activeSetInfo();
    const sets = activeSet?.exerciseData.sets || [];
    return activeSet?.setData.type === 'warmup' ? sets.filter(exer => exer.type !== 'warmup') : sets;
  }

  getWarmUpSets(): ExerciseSetParams[] {
    const activeSet = this.activeSetInfo();
    const sets = activeSet?.exerciseData.sets || [];
    return activeSet?.setData.type === 'warmup' ? sets.filter(exer => exer.type === 'warmup') : [];
  }

  getTotalWarmupSetsForCurrentExercise = computed<number>(() => {
    const r = this.routine(); const exIndex = this.currentExerciseIndex();
    return (r && r.exercises[exIndex]) ? r.exercises[exIndex].sets.filter(s => s.type === 'warmup').length : 0;
  });

  canAddWarmupSet = computed<boolean>(() => {
    const activeInfo = this.activeSetInfo(); const routineVal = this.routine();
    if (!activeInfo || !routineVal || this.sessionState() === 'paused') return false;
    // Allow adding warmup as long as the current set is not a working set that has been logged.
    // Or if it's the very first set.
    const currentExerciseSets = routineVal.exercises[activeInfo.exerciseIndex].sets;
    const currentSetIsLogged = this.currentWorkoutLogExercises()
      .find(le => le.exerciseId === activeInfo.exerciseData.exerciseId)?.sets
      .some(ls => ls.plannedSetId === activeInfo.setData.id);

    if (currentSetIsLogged && activeInfo.type !== 'warmup') return false; // Cannot add warmup if a working set is already logged.

    return true;
  });

  getIconPath(iconName: string | undefined): string {
    return this.exerciseService.getIconPath(iconName);
  }

  toggleWorkoutMenu(): void {
    if (this.sessionState() === 'paused' && !this.isWorkoutMenuVisible()) {
      return; // Don't open if paused and already closed
    }
    // Allow closing if paused and open
    this.isWorkoutMenuVisible.update(v => !v);
    if (this.isWorkoutMenuVisible()) {
      this.isPerformanceInsightsVisible.set(false);
    }
  }

  closeWorkoutMenu(): void {
    this.isWorkoutMenuVisible.set(false);
    window.scrollTo(0, 0);
  }

  async skipCurrentSet(): Promise<void> {
    if (this.sessionState() === 'paused') { this.toastService.warning("Session is paused. Resume to skip set.", 3000, "Paused"); return; }
    const activeInfo = this.activeSetInfo(); const currentRoutineVal = this.routine();
    if (!activeInfo || !currentRoutineVal) { this.toastService.error("Cannot skip set: No active set information.", 0, "Error"); return; }

    // If it's the last set of the exercise and the exercise is 'pending', prompt to skip exercise instead
    if (activeInfo.setIndex === activeInfo.exerciseData.sets.length - 1 && activeInfo.exerciseData.sessionStatus === 'pending') {
      const confirmSkipEx = await this.alertService.showConfirmationDialog(
        "Last Set",
        `This is the last set of "${activeInfo.exerciseData.exerciseName}". Skip the entire exercise instead?`,
        [
          { text: "Skip Set Only", role: "cancel", data: "skip_set" } as AlertButton,
          { text: "Skip Exercise", role: "confirm", data: "skip_exercise", cssClass: "bg-orange-500" } as AlertButton
        ]
      );
      if (confirmSkipEx && confirmSkipEx.data === "skip_exercise") {
        await this.markCurrentExerciseStatus('skipped');
        this.closeWorkoutMenu();
        return;
      } else if (!confirmSkipEx || confirmSkipEx.role === 'cancel' && confirmSkipEx.data !== "skip_set") { // User cancelled dialog
        return;
      }
      // else proceed to skip set only
    } else {
      const confirm = await this.alertService.showConfirm("Skip Current Set", `Skip current ${activeInfo.type === 'warmup' ? 'warm-up' : 'set ' + this.getCurrentWorkingSetNumber()} of "${activeInfo.exerciseData.exerciseName}"? It won't be logged.`);
      if (!confirm || !confirm.data) return;
    }

    this.soundPlayedForThisCountdownSegment = false;
    this.toastService.info(`Skipped set of ${activeInfo.exerciseData.exerciseName}.`, 2000);
    this.resetTimedSet();
    this.navigateToNextStepInWorkout(activeInfo, currentRoutineVal);
    this.closeWorkoutMenu(); this.closePerformanceInsights();
  }

  // Modified skipCurrentExercise to use markCurrentExerciseStatus
  async skipCurrentExercise(): Promise<void> {
    await this.markCurrentExerciseStatus('skipped');
  }

  async markCurrentExerciseDoLater(): Promise<void> {
    await this.markCurrentExerciseStatus('do_later');
  }

  async markCurrentExerciseStatus(status: 'skipped' | 'do_later'): Promise<void> {
    if (this.sessionState() === 'paused') {
      this.toastService.warning(`Session is paused. Resume to mark exercise.`, 3000, "Paused"); return;
    }
    const currentRoutineVal = this.routine();
    const activeInfo = this.activeSetInfo(); // This is the exercise being marked

    if (!currentRoutineVal || !activeInfo) {
      this.toastService.error("Cannot update exercise status: data unavailable.", 0, "Error"); return;
    }

    const exName = activeInfo.exerciseData.exerciseName;
    const actionText = status === 'skipped' ? 'Skip' : 'Mark for Later';

    // Confirmation dialog can be kept simple as the main logic change is after this.
    // const confirm = await this.alertService.showConfirm(
    //     `${actionText} Exercise?`,
    //     `${actionText} all sets of "${exName}"?` // Or remaining sets if partially done
    // );
    // if (!confirm || !confirm.data) {
    //     this.closeWorkoutMenu(); // Close menu even if cancelled
    //     return;
    // }

    const updatedRoutine = JSON.parse(JSON.stringify(currentRoutineVal)) as Routine;
    const exerciseToUpdateInSession = updatedRoutine.exercises.find(ex => ex.id === activeInfo.exerciseData.id);

    if (exerciseToUpdateInSession) {
      const previousStatus = exerciseToUpdateInSession.sessionStatus;
      exerciseToUpdateInSession.sessionStatus = status;
      let statusString = status.replace(/(^\w)/g, g => g[0].toUpperCase()).replace(/([-_]\w)/g, g => " " + g[1].toUpperCase()).trim();
      this.routine.set(updatedRoutine);
      this.toastService.info(`"${exName}" marked as ${statusString}.`, 2000);
      this.resetTimedSet(); // Reset timer for the set we are leaving

      // NEW LOGIC: If the exercise being marked was the one we were actively performing as a deferred item
      if (this.isPerformingDeferredExercise && activeInfo.exerciseData.id === this.lastActivatedDeferredExerciseId) {
        console.log(`markCurrentExerciseStatus: Re-marking a deferred exercise (${exName}) as ${status}. Re-evaluating all deferred.`);
        this.isPerformingDeferredExercise = false;
        this.lastActivatedDeferredExerciseId = null;
        this.exercisesProposedThisCycle = { doLater: false, skipped: false }; // Fresh proposal cycle
        await this.tryProceedToDeferredExercisesOrFinish(updatedRoutine);
      } else {
        // This was a main sequence exercise being marked, or some other edge case.
        // Use navigateToNextStepInWorkout to find the next *main sequence* pending item.
        console.log(`markCurrentExerciseStatus: Marking main sequence exercise (${exName}) as ${status}. Advancing.`);
        await this.navigateToNextStepInWorkout(activeInfo, updatedRoutine, true /* forceAdvanceExerciseBlock */);
      }
    }
    this.closeWorkoutMenu();
    this.closePerformanceInsights(); // Close insights if open
  }




  // Replaces the old addCustomExercise, now it opens the modal first
  async addExerciseDuringSession(): Promise<void> {
    if (this.sessionState() === 'paused') {
      this.toastService.warning("Session is paused. Resume to add exercise.", 3000, "Paused");
      this.closeWorkoutMenu();
      return;
    }
    this.openExerciseSelectionModal();
    // The actual addition logic will be in selectExerciseToAddFromModal or handleTrulyCustomExercise
  }

  // Called when an exercise is selected from the modal
  async selectExerciseToAddFromModal(selectedExercise: Exercise): Promise<void> {
    this.closeExerciseSelectionModal();
    const currentRoutineVal = this.routine();
    if (!currentRoutineVal) {
      this.toastService.error("Cannot add exercise: routine data unavailable.", 0, "Error"); return;
    }

    // Prompt for number of sets for this selected exercise
    const setsInput = await this.alertService.showPromptDialog(
      `Add ${selectedExercise.name}`,
      'How many sets?',
      [{ name: 'numSets', type: 'number', placeholder: 'e.g., 3', value: '3', attributes: { min: '1', required: true } }] as AlertInput[],
      'Next'
    );

    if (!setsInput || !setsInput['numSets'] || parseInt(String(setsInput['numSets']), 10) <= 0) {
      this.toastService.info("Exercise addition cancelled or invalid set count.", 2000);
      return;
    }
    const numSets = parseInt(String(setsInput['numSets']), 10);

    const defaultWeight = this.unitService.currentUnit() === 'kg' ? 10 : 2.2;
    // add weight section
    const addWeight = await this.alertService.showConfirmationDialog(
      `Add weight info to ${selectedExercise.name}`,
      `Do you want to add weight? (default ${defaultWeight} ${this.unitService.currentUnit()})`,
      [
        { text: 'No', role: 'cancel', data: 'cancel_deferred_choice' } as AlertButton,
        { text: 'Yes', role: 'confirm', data: "confirm" } as AlertButton,
      ],
    );

    let setWeight = 10;
    if (addWeight && addWeight.role === 'confirm') {
      // Prompt for weight of each set of the exercise
      const weightInput = await this.alertService.showPromptDialog(
        `Add weight to ${selectedExercise.name}`,
        'How much weight?',
        [{ name: 'weight', type: 'number', placeholder: 'e.g., 10', value: '10', attributes: { min: '1', required: true } }] as AlertInput[],
        'Next'
      );

      if (!weightInput || !weightInput['weight'] || parseInt(String(setsInput['weight']), 10) <= 0) {
        this.toastService.info("Exercise addition cancelled or invalid weight parameter.", 2000);
        return;
      }
      setWeight = parseInt(String(weightInput['weight']), 10);
    }

    // add rest section
    const addRest = await this.alertService.showConfirmationDialog(
      `Add rest info to ${selectedExercise.name}`,
      'Do you want to add rest? (default 60s)',
      [
        { text: 'No', role: 'cancel', data: 'cancel_deferred_choice' } as AlertButton,
        { text: 'Yes', role: 'confirm', data: "confirm" } as AlertButton,
      ],
    );

    let setRest = 60;
    if (addRest && addRest.role === 'confirm') {
      // Prompt for rest of each set of the exercise
      const restInput = await this.alertService.showPromptDialog(
        `Add rest to ${selectedExercise.name}`,
        'How much rest?',
        [{ name: 'rest', type: 'number', placeholder: 'e.g., 60', value: '60', attributes: { min: '1', required: true } }] as AlertInput[],
        'Next'
      );

      if (!restInput || !restInput['rest'] || parseInt(String(setsInput['rest']), 10) <= 0) {
        this.toastService.info("Exercise addition cancelled or invalid rest parameter.", 2000);
        return;
      }
      setRest = parseInt(String(restInput['rest']), 10);
    }

    const newExerciseSets: ExerciseSetParams[] = [];
    for (let i = 0; i < numSets; i++) {
      newExerciseSets.push({
        id: `custom-set-${uuidv4()}`, // Or generate based on planned set ID if this was a template
        reps: 8, // Default reps
        weight: setWeight,
        duration: undefined,
        restAfterSet: setRest,
        type: 'standard',
        notes: ''
      });
    }

    const newWorkoutExercise: WorkoutExercise = {
      id: `session-ex-${uuidv4()}`, // Unique ID for this session's instance of the exercise
      exerciseId: selectedExercise.id,
      exerciseName: selectedExercise.name,
      sets: newExerciseSets,
      rounds: 1, // Default to 1 round for an ad-hoc added exercise
      supersetId: null,
      supersetOrder: null,
      supersetSize: null,
      sessionStatus: 'pending',
      type: 'standard'
    };

    this.addExerciseToCurrentRoutine(newWorkoutExercise);
  }

  // Called if user wants to define a completely new exercise not in the library
  async handleTrulyCustomExerciseEntry(): Promise<void> {
    this.closeExerciseSelectionModal();
    const currentRoutineVal = this.routine();
    if (!currentRoutineVal) { return; }

    const inputs: AlertInput[] = [
      { name: 'exerciseName', type: 'text', placeholder: 'Custom Exercise Name', value: '', attributes: { required: true } },
      { name: 'numSets', type: 'number', placeholder: 'Number of Sets (e.g., 3)', value: '3', attributes: { min: '1', required: true } },
    ];
    const result = await this.alertService.showPromptDialog('Add New Custom Exercise', 'Define exercise name and sets:', inputs, 'Add Exercise');

    if (result && result['exerciseName'] && result['numSets']) {
      const exerciseName = String(result['exerciseName']).trim();
      const numSets = parseInt(String(result['numSets']), 10);
      if (!exerciseName || numSets <= 0) {
        this.toastService.error("Invalid input for custom exercise.", 0, "Error"); return;
      }
      const newExerciseSets: ExerciseSetParams[] = Array.from({ length: numSets }, () => ({
        id: `custom-adhoc-set-${uuidv4()}`, reps: 8, weight: null, duration: undefined, restAfterSet: 60, type: 'standard', notes: ''
      }));
      const newWorkoutExercise: WorkoutExercise = {
        id: `custom-adhoc-ex-${uuidv4()}`, exerciseId: `custom-exercise-${uuidv4()}`, // Generic custom ID
        exerciseName: exerciseName, sets: newExerciseSets, rounds: 1, supersetId: null, sessionStatus: 'pending', supersetOrder: null,
        type: 'standard'
      };
      this.addExerciseToCurrentRoutine(newWorkoutExercise);
    }
  }

  private async addExerciseToCurrentRoutine(newWorkoutExercise: WorkoutExercise, index?: number): Promise<void> {
    const currentRoutineVal = this.routine();
    if (!currentRoutineVal) return;

    const indexExists = (index !== null && index !== undefined) ? true : false;

    const updatedRoutine = JSON.parse(JSON.stringify(currentRoutineVal)) as Routine;
    let insertAtIndex = (index !== null && index !== undefined) ? index : this.currentExerciseIndex() + 1;
    const activeInfo = this.activeSetInfo();
    if (!indexExists && activeInfo && activeInfo.exerciseData.supersetId && activeInfo.exerciseData.supersetOrder !== null && activeInfo.exerciseData.supersetSize) {
      insertAtIndex = activeInfo.exerciseIndex - activeInfo.exerciseData.supersetOrder + activeInfo.exerciseData.supersetSize;
    }
    updatedRoutine.exercises.splice(insertAtIndex, 0, newWorkoutExercise);
    this.routine.set(updatedRoutine);

    if (indexExists) {
      this.currentExerciseIndex.set(insertAtIndex);
      this.currentSetIndex.set(0);
      this.currentBlockRound.set(1);
      this.totalBlockRounds.set(newWorkoutExercise.rounds ?? 1);
      this.lastPerformanceForCurrentExercise = null;
      this.isPerformingDeferredExercise = true; // Treat ad-hoc added as a "deferred" type choice contextually
      // this.lastActivatedDeferredExerciseId = newWorkoutExercise.id;
      this.playerSubState.set(PlayerSubState.PerformingSet);
      await this.prepareCurrentSet();
    } else {
      let goToNewEx = undefined;
      if (this.routineId === "-1" && this.routine()?.exercises?.length === 1) {
        goToNewEx = { data: true };
        this.sessionState.set(SessionState.Playing);
        this.startSessionTimer();
        this.startAutoSave();
      } else {
        goToNewEx = await this.alertService.showConfirm("Exercise Added", `"${newWorkoutExercise.exerciseName}" added. Start it now? (Otherwise, it will appear after your current block)`);;
      }
      if ((goToNewEx && goToNewEx.data) || this.routineId === "-1") {
        this.currentExerciseIndex.set(insertAtIndex);
        this.currentSetIndex.set(0);
        this.currentBlockRound.set(1);
        this.totalBlockRounds.set(newWorkoutExercise.rounds ?? 1);
        this.lastPerformanceForCurrentExercise = null;
        this.isPerformingDeferredExercise = true; // Treat ad-hoc added as a "deferred" type choice contextually
        this.lastActivatedDeferredExerciseId = newWorkoutExercise.id;
        this.playerSubState.set(PlayerSubState.PerformingSet);
        await this.prepareCurrentSet();
      } else {
        this.toastService.success(`"${newWorkoutExercise.exerciseName}" added to the queue.`, 3000, "Exercise Added");
      }
    }

  }



  async addCustomExercise(): Promise<void> {
    if (this.sessionState() === 'paused') {
      this.toastService.warning("Session is paused. Resume to add exercise.", 3000, "Paused"); return;
    }
    const currentRoutineVal = this.routine();
    if (!currentRoutineVal) {
      this.toastService.error("Cannot add exercise: routine data unavailable.", 0, "Error"); return;
    }

    const inputs: AlertInput[] = [
      { name: 'exerciseName', type: 'text', placeholder: 'Exercise Name (e.g., Custom Bicep Curl)', value: '', attributes: { required: true } },
      { name: 'numSets', type: 'number', placeholder: 'Number of Sets (e.g., 3)', value: '3', attributes: { min: '1', required: true } },
      { name: 'repsPerSet', type: 'number', placeholder: 'Reps per Set (e.g., 10)', value: '10', attributes: { min: '0' } },
      { name: 'weightPerSet', type: 'number', placeholder: 'Weight (optional)', value: '', attributes: { min: '0', step: 'any' } },
      { name: 'restAfterSet', type: 'number', placeholder: 'Rest after set (sec, e.g., 60)', value: '60', attributes: { min: '0' } }
    ];

    const result = await this.alertService.showPromptDialog('Add Custom Exercise', 'Define the new exercise:', inputs, 'Add Exercise');

    if (result && result['exerciseName'] && result['numSets']) {
      const exerciseName = String(result['exerciseName']).trim();
      const numSets = parseInt(String(result['numSets']), 10);
      const repsPerSet = result['repsPerSet'] ? parseInt(String(result['repsPerSet']), 10) : null;
      const weightPerSet = result['weightPerSet'] !== '' && result['weightPerSet'] !== null ? parseFloat(String(result['weightPerSet'])) : null;
      const restAfterSet = result['restAfterSet'] ? parseInt(String(result['restAfterSet']), 10) : 60;


      if (!exerciseName || numSets <= 0) {
        this.toastService.error("Invalid input for custom exercise.", 0, "Error");
        return;
      }

      const newExerciseSets: ExerciseSetParams[] = [];
      for (let i = 0; i < numSets; i++) {
        newExerciseSets.push({
          id: `custom-set-${uuidv4()}`,
          reps: repsPerSet || 8, // Default to 8 reps if not specified
          weight: weightPerSet,
          duration: undefined,
          restAfterSet: restAfterSet,
          type: 'standard',
          notes: ''
        });
      }

      const newWorkoutExercise: WorkoutExercise = {
        id: `custom-ex-${uuidv4()}`,
        exerciseId: `custom-exercise-${uuidv4()}`,
        exerciseName: exerciseName,
        sets: newExerciseSets,
        rounds: 1,
        supersetId: null,
        sessionStatus: 'pending',
        supersetOrder: null,
        type: 'standard'
      };

      const updatedRoutine = JSON.parse(JSON.stringify(currentRoutineVal)) as Routine;
      let insertAtIndex = this.currentExerciseIndex() + 1;
      const currentExInfo = this.activeSetInfo();
      if (currentExInfo && currentExInfo.exerciseData.supersetId && currentExInfo.exerciseData.supersetOrder !== null && currentExInfo.exerciseData.supersetSize) {
        insertAtIndex = currentExInfo.exerciseIndex - currentExInfo.exerciseData.supersetOrder + currentExInfo.exerciseData.supersetSize;
      }

      updatedRoutine.exercises.splice(insertAtIndex, 0, newWorkoutExercise);
      this.routine.set(updatedRoutine);

      const goToNewEx = await this.alertService.showConfirm("Exercise Added", `"${exerciseName}" added. Start it now? (Otherwise, it will appear after your current block)`);
      if (goToNewEx && goToNewEx.data) {
        this.currentExerciseIndex.set(insertAtIndex);
        this.currentSetIndex.set(0);
        this.currentBlockRound.set(1);
        this.totalBlockRounds.set(newWorkoutExercise.rounds ?? 1);
        this.lastPerformanceForCurrentExercise = null;
        this.playerSubState.set(PlayerSubState.PerformingSet);
        await this.prepareCurrentSet();
      } else {
        this.toastService.success(`"${exerciseName}" added to the queue.`, 3000, "Exercise Added");
      }
    }
    this.closeWorkoutMenu();
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
        this.toastService.info("Workout finished early. Paused session cleared.", 4000);
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        if (this.router.url.includes('/play')) {
          this.router.navigate(['/workout']);
        }
      }
    }
  }

  /**
   * Maps a WorkoutExercise to a LoggedWorkoutExercise.
   * All sets are mapped with plannedSetId set to the WorkoutExercise set's id.
   * No actuals (repsAchieved, weightUsed, etc.) are filled in.
   */
  private mapWorkoutExerciseToLoggedWorkoutExercise(ex: WorkoutExercise): LoggedWorkoutExercise {
    return {
      id: ex.id,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName || '',
      sets: ex.sets.map(set => ({
        id: uuidv4(),
        exerciseName: ex.exerciseName,
        plannedSetId: set.id,
        exerciseId: ex.exerciseId,
        type: ex.type,
        repsAchieved: 0,
        weightUsed: undefined,
        durationPerformed: undefined,
        rpe: undefined,
        targetReps: set.reps,
        targetWeight: set.weight,
        targetDuration: set.duration,
        targetTempo: set.tempo,
        notes: set.notes,
        timestamp: new Date().toISOString(),
      })),
      rounds: ex.rounds ?? 1,
      type: ((ex.sets && ex.sets[0] && ex.sets[0].type) || ex.type) ?? 'standard'
    };
  }


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
    const loggedExercisesForReport = this.currentWorkoutLogExercises().filter(ex => ex.sets.length > 0);
    // const loggedExercisesForReport = this.routine()?.exercises.map(ex => this.mapWorkoutExerciseToLoggedWorkoutExercise(ex));

    if (loggedExercisesForReport === undefined || loggedExercisesForReport.length === 0) {
      return false
    }

    if (loggedExercisesForReport.length === 0) {
      this.toastService.info("No sets logged. Workout not saved.", 3000, "Empty Workout");
      this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
      if (this.router.url.includes('/play')) {
        this.router.navigate(['/workout']);
      }
      return false;
    }
    this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
    if (this.timerSub) this.timerSub.unsubscribe();

    const sessionRoutineValue = this.routine();
    const sessionProgramValue = this.program();
    let proceedToLog = true;
    let logAsNewRoutine = false;
    let updateOriginalRoutineStructure = false;
    let newRoutineName = sessionRoutineValue?.name ? `${sessionRoutineValue.name} - ${format(new Date(), 'MMM d')}` : `Ad-hoc Workout - ${format(new Date(), 'MMM d, HH:mm')}`;

    const originalSnapshotToCompare = this.originalRoutineSnapshot.filter(origEx =>
      // Only compare against original exercises that were not marked 'skipped' or 'do_later' unless they were actually logged
      sessionRoutineValue?.exercises.find(sessEx => sessEx.id === origEx.id && sessEx.sessionStatus === 'pending') ||
      loggedExercisesForReport.some(logEx => logEx.exerciseId === origEx.exerciseId)
    );


    if (this.routineId && this.originalRoutineSnapshot && this.originalRoutineSnapshot.length > 0 && sessionRoutineValue) {
      const differences = this.comparePerformedToOriginal(loggedExercisesForReport, originalSnapshotToCompare);
      if (differences.majorDifference) {
        // Show a confirmation dialog with details of the differences
        const confirmation = await this.alertService.showConfirmationDialog(
          "Routine Structure Changed",
          `You made significant changes to the routine structure:\n\n${differences.details.join('\n')}\n\nWould you like to save this as a new routine, update the original, or cancel?`,
          [
            { text: "Save as New Routine", role: "confirm", data: "new", cssClass: "bg-green-600" } as AlertButton,
            { text: "Update Original Routine and log", role: "destructive", data: "update", cssClass: "bg-blue-600" } as AlertButton,
            { text: "Cancel", role: "cancel", data: "cancel" } as AlertButton
          ]
        );
        if (confirmation && confirmation.data === 'new') {
          // Prompt for new routine name
          const nameInput = await this.alertService.showPromptDialog(
            "New Routine Name",
            "Enter a name for your new routine:",
            [
              {
                name: "newRoutineName",
                type: "text",
                placeholder: newRoutineName,
                value: newRoutineName,
                attributes: { required: true }
              }
            ],
            "Save Routine"
          );
          if (nameInput && String(nameInput['newRoutineName']).trim()) {
            newRoutineName = String(nameInput['newRoutineName']).trim();
            logAsNewRoutine = true;
          } else {
            proceedToLog = false;
          }
        } else if (confirmation && confirmation.data === 'update') {
          updateOriginalRoutineStructure = true;
        } else {
          proceedToLog = false;
        }
      }
    } else if (!this.routineId && loggedExercisesForReport.length > 0) { // Ad-hoc
      logAsNewRoutine = true;
      const nameInput = await this.alertService.showPromptDialog(
        "Save as New Routine",
        "Enter a name for your new routine:",
        [
          {
            name: "newRoutineName",
            type: "text",
            placeholder: newRoutineName,
            value: newRoutineName,
            attributes: { required: true }
          }
        ],
        "Save Routine"
      );
      if (nameInput && String(nameInput['newRoutineName']).trim()) { newRoutineName = String(nameInput['newRoutineName']).trim(); }
      else if (!nameInput) { proceedToLog = false; }
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
    const sessionStartTime = this.workoutStartTime - (this.sessionTimerElapsedSecondsBeforePause * 1000);
    const durationMinutes = Math.round((endTime - sessionStartTime) / (1000 * 60));
    const durationSeconds = Math.round((endTime - sessionStartTime) / (1000));
    let finalRoutineIdToLog: string | undefined = this.routineId || undefined;
    let finalRoutineNameForLog = sessionRoutineValue?.name || 'Ad-hoc Workout';

    if (logAsNewRoutine) {
      const newRoutineDef: Omit<Routine, 'id'> = {
        name: newRoutineName,
        description: sessionRoutineValue?.description || 'Workout performed on ' + format(new Date(), 'MMM d, yyyy'),
        goal: sessionRoutineValue?.goal || 'custom',
        exercises: this.convertLoggedToWorkoutExercises(loggedExercisesForReport), // Use filtered logs
      };
      const createdRoutine = this.workoutService.addRoutine(newRoutineDef);
      finalRoutineIdToLog = createdRoutine.id;
      finalRoutineNameForLog = createdRoutine.name;
      this.toastService.success(`New routine "${createdRoutine.name}" created.`, 4000);
    }

    const finalLog: Omit<WorkoutLog, 'id'> = {
      routineId: finalRoutineIdToLog,
      routineName: finalRoutineNameForLog,
      date: format(new Date(sessionStartTime), 'yyyy-MM-dd'),
      startTime: sessionStartTime,
      endTime: endTime,
      durationMinutes: durationMinutes,
      durationSeconds: durationSeconds,
      exercises: loggedExercisesForReport, // Use filtered logs
      notes: sessionRoutineValue?.notes,
      programId: sessionProgramValue?.id,
    };
    const savedLog = this.trackingService.addWorkoutLog(finalLog);
    if (!this.isTabataMode()) {
      this.toastService.success(`Congrats! Workout completed!`, 5000, "Workout Finished");
    } else {
      this.toastService.success("Tabata Workout Complete!", 5000, "Workout Finished");
    }

    if (finalRoutineIdToLog) {
      const routineToUpdate = await firstValueFrom(this.workoutService.getRoutineById(finalRoutineIdToLog).pipe(take(1)));
      if (routineToUpdate) {
        let updatedRoutineData: Routine = { ...routineToUpdate, lastPerformed: new Date(sessionStartTime).toISOString() };
        if (updateOriginalRoutineStructure && !logAsNewRoutine && this.routineId === finalRoutineIdToLog) {
          updatedRoutineData.exercises = this.convertLoggedToWorkoutExercises(loggedExercisesForReport); // Use filtered logs
          // ... (persist name/desc/goal changes) ...
        }
        this.workoutService.updateRoutine(updatedRoutineData);
      }
    }

    this.isSessionConcluded = true;
    this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
    this.sessionState.set(SessionState.End);
    this.router.navigate(['/workout/summary', savedLog.id]);
    return true;
  }

  async quitWorkout(): Promise<void> {
    const confirmQuit = await this.alertService.showConfirm("Quit Workout", 'Quit workout? Unsaved progress (if not paused) will be lost.');
    if (confirmQuit && confirmQuit.data) {
      this.stopAllActivity();
      this.isSessionConcluded = true;
      this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
      this.closeWorkoutMenu(); this.closePerformanceInsights();
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
    if (this.editingTarget) {
      this.cancelEditTarget();
    }
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
    const step = this.appSettingsService.getSettings().weightStep || defaultStep;
    const currentValue = this.csf['actualWeight'].value ?? 0;
    this.currentSetForm.patchValue({ actualWeight: parseFloat((currentValue + step).toFixed(2)) });
  }

  // Handles both touch and mouse events for press/tap/long-press detection
  private pressStartTime: number | null = null;

  private weightIncrementIntervalId: any = null;
  private weightDecrementIntervalId: any = null;

  onWeightIncrementPointerDown(event: MouseEvent | TouchEvent): void {
    if (this.weightIncrementIntervalId !== null) return;
    this.incrementWeight();
    this.weightIncrementIntervalId = setInterval(() => this.incrementWeight(), 100);

    // --- FIX: Use the stable, pre-bound handlers ---
    document.addEventListener('mouseup', this.stopWeightIncrementHandler);
    document.addEventListener('touchend', this.stopWeightIncrementHandler);
    document.addEventListener('mouseleave', this.stopWeightIncrementHandler);
  }

  onWeightIncrementPointerUp(): void { // No longer needs 'event' parameter
    if (this.weightIncrementIntervalId !== null) {
      clearInterval(this.weightIncrementIntervalId);
      this.weightIncrementIntervalId = null;
    }
    // --- FIX: Use the stable, pre-bound handlers to remove ---
    document.removeEventListener('mouseup', this.stopWeightIncrementHandler);
    document.removeEventListener('touchend', this.stopWeightIncrementHandler);
    document.removeEventListener('mouseleave', this.stopWeightIncrementHandler);
  }

  onWeightDecrementPointerDown(event: MouseEvent | TouchEvent): void {
    if (this.weightDecrementIntervalId !== null) return;
    this.decrementWeight();
    this.weightDecrementIntervalId = setInterval(() => this.decrementWeight(), 100);

    // --- FIX: Use the stable, pre-bound handlers ---
    document.addEventListener('mouseup', this.stopWeightDecrementHandler);
    document.addEventListener('touchend', this.stopWeightDecrementHandler);
    document.addEventListener('mouseleave', this.stopWeightDecrementHandler);
  }

  onWeightDecrementPointerUp(): void { // No longer needs 'event' parameter
    if (this.weightDecrementIntervalId !== null) {
      clearInterval(this.weightDecrementIntervalId);
      this.weightDecrementIntervalId = null;
    }
    // --- FIX: Use the stable, pre-bound handlers to remove ---
    document.removeEventListener('mouseup', this.stopWeightDecrementHandler);
    document.removeEventListener('touchend', this.stopWeightDecrementHandler);
    document.removeEventListener('mouseleave', this.stopWeightDecrementHandler);
  }

  decrementWeight(defaultStep: number = 0.5): void {
    const step = this.appSettingsService.getSettings().weightStep || defaultStep;
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

    this.autoSaveSub = interval(this.AUTO_SAVE_INTERVAL_MS)
    .pipe(takeUntil(this.destroy$))
    .subscribe(() => {
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
    if (isPlatformBrowser(this.platformId)) { window.scrollTo(0, 0); }

    // Add a check for tabata mode here for paused sessions
    const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);
    const hasPausedSessionOnInit = await this.checkForPausedSession(false);
    if (hasPausedSessionOnInit) {
      this.isInitialLoadComplete = true;
    } else {
      this.loadNewWorkoutFromRoute();
    }
    if (isPlatformBrowser(this.platformId)) {
      this.routerEventsSub = this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        tap(async (event: NavigationEnd) => {
          const routeSnapshot = this.route.snapshot;
          const navigatedToPlayerUrl = event.urlAfterRedirects.startsWith('/workout/play/');
          const targetRoutineId = routeSnapshot.paramMap.get('routineId');
          if (navigatedToPlayerUrl) {
            if (this.routineId === targetRoutineId && this.isInitialLoadComplete && this.sessionState() !== SessionState.Playing) {
              const resumedOnReEntry = await this.checkForPausedSession(true);
              if (!resumedOnReEntry && this.sessionState() !== SessionState.Playing) {
                this.loadNewWorkoutFromRoute();
              }
            } else if (this.routineId !== targetRoutineId) {
              // paramMap subscription in loadNewWorkoutFromRoute should handle this
            }
          }
        }),
        takeUntil(this.destroy$) // Add this line
      ).subscribe();
    }
    this.loadAvailableExercises(); // Load exercises for the modal
  }

  private async loadNewWorkoutFromRoute(): Promise<void> {
    console.log('loadNewWorkoutFromRoute - START');
    this.isInitialLoadComplete = false;
    this.sessionState.set(SessionState.Loading); // Explicitly set to loading
    this.exercisesProposedThisCycle = { doLater: false, skipped: false };
    this.isPerformingDeferredExercise = false;
    this.lastActivatedDeferredExerciseId = null;

    this.stopAllActivity();
    this.workoutStartTime = Date.now();
    this.sessionTimerElapsedSecondsBeforePause = 0;
    this.originalRoutineSnapshot = [];
    this.currentWorkoutLogExercises.set([]);
    this.currentSetIndex.set(0);
    this.currentBlockRound.set(1);
    this.routine.set(undefined); // Clear routine to trigger loading state in template
    this.program.set(undefined);

    if (this.routeSub) { this.routeSub.unsubscribe(); }

    this.routeSub = this.route.paramMap.pipe(
      switchMap(params => {
        const newRoutineId = params.get('routineId');
        console.log('loadNewWorkoutFromRoute - paramMap emitted, newRoutineId:', newRoutineId);
        // ... (programId logic) ...
        if (!newRoutineId || newRoutineId === "-1") {
          if (newRoutineId === "-1") {

          } else {
            this.toastService.error("No routine specified to play.", 0, "Error");
            this.router.navigate(['/workout']);
            this.sessionState.set(SessionState.Error); // Ensure state changes if error
            return of(null);
          }
        }
        // ... (check if same routine already loading/playing) ...
        this.routineId = newRoutineId;
        return this.workoutService.getRoutineById(this.routineId).pipe(
          map(originalRoutine => {
            if (originalRoutine) {
              console.log('loadNewWorkoutFromRoute: Fetched original routine -', originalRoutine.name);
              this.originalRoutineSnapshot = JSON.parse(JSON.stringify(originalRoutine.exercises));
              const sessionCopy = JSON.parse(JSON.stringify(originalRoutine)) as Routine;
              sessionCopy.exercises.forEach(ex => {
                ex.sessionStatus = 'pending';
                if (!ex.id) ex.id = uuidv4();
                ex.sets.forEach(s => {
                  if (!s.id) s.id = uuidv4();
                  if (!s.type) s.type = 'standard';
                });
              });
              return sessionCopy;
            }
            console.warn('loadNewWorkoutFromRoute: No original routine found for ID:', this.routineId);
            return null;
          })
        );
      }),
      tap(async (sessionRoutineCopy) => {
        console.log('loadNewWorkoutFromRoute - tap operator. Session routine copy:', sessionRoutineCopy ? sessionRoutineCopy.name : 'null');

        // --- NEW: TABATA MODE CHECK ---
        if (sessionRoutineCopy?.goal === 'tabata') {
          this.setupTabataMode(sessionRoutineCopy);
          this.startSessionTimer(); // Start the overall workout timer
          this.isInitialLoadComplete = true;
          return; // Exit here to prevent running the standard player logic
        }
        // --- END: TABATA MODE CHECK ---

        if (this.sessionState() === SessionState.Paused) {
          console.log('loadNewWorkoutFromRoute - tap: Session is paused, skipping setup.');
          this.isInitialLoadComplete = true;
          return;
        }
        if (sessionRoutineCopy) {
          this.exercisesProposedThisCycle = { doLater: false, skipped: false };
          this.isPerformingDeferredExercise = false;
          this.lastActivatedDeferredExerciseId = null;
          this.routine.set(sessionRoutineCopy); // Set the routine signal FIRST

          const firstPending = this.findFirstPendingExerciseAndSet(sessionRoutineCopy);
          if (firstPending) {
            this.currentExerciseIndex.set(firstPending.exerciseIndex);
            this.currentSetIndex.set(firstPending.setIndex);
            console.log(`loadNewWorkoutFromRoute - Initial pending set to Ex: ${firstPending.exerciseIndex}, Set: ${firstPending.setIndex}`);

            const firstEx = sessionRoutineCopy.exercises[firstPending.exerciseIndex];
            if (!firstEx.supersetId || firstEx.supersetOrder === 0) {
              this.totalBlockRounds.set(firstEx.rounds ?? 1);
            } else {
              const actualStart = sessionRoutineCopy.exercises.find(ex => ex.supersetId === firstEx.supersetId && ex.supersetOrder === 0);
              this.totalBlockRounds.set(actualStart?.rounds ?? 1);
            }
          } else {
            // No pending exercises in the routine from the start.
            console.log("loadNewWorkoutFromRoute: Routine loaded but no initial pending exercises. Will try deferred/finish.");
            this.currentExerciseIndex.set(0); // Default, though it might not be used
            this.currentSetIndex.set(0);
            this.totalBlockRounds.set(1);
            // No need to call prepareCurrentSet, go directly to end-of-workout logic
            this.exercisesProposedThisCycle = { doLater: false, skipped: false };
            await this.tryProceedToDeferredExercisesOrFinish(sessionRoutineCopy);
            this.isInitialLoadComplete = true;
            return; // Exit tap if no pending exercises
          }

          this.currentBlockRound.set(1);
          this.currentWorkoutLogExercises.set([]);
          await this.prepareCurrentSet(); // This should now work with the correctly set indexes

          // sessionState should be set to Playing inside prepareCurrentSet if successful
          if (this.sessionState() !== SessionState.Error && this.sessionState() !== SessionState.Paused) {
            this.startSessionTimer();
            this.startAutoSave();
          }
        } else if (this.routineId) {
          if (this.routineId === "-1") {
            const emptyNewRoutine = {
              name: "New session",
              createdAt: new Date().toISOString(),
              goal: 'custom',
              exercises: [] as WorkoutExercise[],
            } as Routine;

            this.routine.set(emptyNewRoutine);
            this.openExerciseSelectionModal();
          } else {
            console.error('loadNewWorkoutFromRoute - tap: Failed to load routine for ID or routine was null:', this.routineId);
            this.routine.set(null); // Explicitly set to null to trigger error display in template
            this.sessionState.set(SessionState.Error);
            this.toastService.error("Failed to load workout routine.", 0, "Load Error");
            if (isPlatformBrowser(this.platformId)) this.router.navigate(['/workout']); // only navigate in browser
            this.stopAutoSave();
          }

        }
        this.isInitialLoadComplete = true;
        console.log('loadNewWorkoutFromRoute - END tap operator. Final sessionState:', this.sessionState());
      }),
      takeUntil(this.destroy$) // Add this line
    ).subscribe({
      error: (err) => {
        console.error('loadNewWorkoutFromRoute - Error in observable pipeline:', err);
        this.routine.set(null);
        this.sessionState.set(SessionState.Error);
        this.toastService.error("Critical error loading workout.", 0, "Load Error");
        if (isPlatformBrowser(this.platformId)) this.router.navigate(['/workout']);
        this.isInitialLoadComplete = true;
      }
    });
  }

  private async checkForPausedSession(isReEntry: boolean = false): Promise<boolean> {
    const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);
    const routeRoutineId = this.route.snapshot.paramMap.get('routineId');
    const resumeQueryParam = this.route.snapshot.queryParamMap.get('resume') === 'true';

    console.log('WorkoutPlayer.checkForPausedSession ...', !!pausedState);

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
        shouldAttemptToLoadPausedState = true;
        this.router.navigate([], { relativeTo: this.route, queryParams: { resume: null }, queryParamsHandling: 'merge', replaceUrl: true });
      } else if (isReEntry) {
        shouldAttemptToLoadPausedState = true;
      } else {
        const confirmation = await this.alertService.showConfirmationDialog(
          "Resume Paused Workout?",
          "You have a paused workout session. Would you like to resume it?",
          [
            { text: "Resume", role: "confirm", data: true, cssClass: "bg-green-600" } as AlertButton,
            { text: "Discard", role: "cancel", data: false, cssClass: "bg-red-600" } as AlertButton
          ]
        );
        shouldAttemptToLoadPausedState = !!(confirmation && confirmation.data === true);
      }

      if (shouldAttemptToLoadPausedState) {
        this.stopAllActivity();
        if (this.routeSub) this.routeSub.unsubscribe();
        await this.loadStateFromPausedSession(pausedState);
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        this.isInitialLoadComplete = true;
        return true;
      } else {
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        this.toastService.info('Paused session discarded.', 3000);
        return false;
      }
    }
    return false;
  }

  private stopAllActivity(): void {
    console.log('stopAllActivity - Stopping timers and auto-save.');
    this.stopAutoSave();
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
    if (this.tabataTimerSub) this.tabataTimerSub.unsubscribe();
    this.isRestTimerVisible.set(false);
    // Don't unsubscribe from routerEventsSub or routeSub here, they manage themselves or are handled by ngOnDestroy
  }
  async resumeSession(): Promise<void> {
    if (this.sessionState() === SessionState.Paused) {
      console.log('resumeSession button clicked - transitioning from Paused to Playing');
      this.workoutStartTime = Date.now();
      this.sessionState.set(SessionState.Playing);
      this.startSessionTimer();
      this.startAutoSave();

      if (this.wasTimedSetRunningOnPause && this.timedSetTimerState() === TimedSetState.Paused) {
        this.startOrResumeTimedSet();
      }
      this.wasTimedSetRunningOnPause = false;

      if (this.wasRestTimerVisibleOnPause && this.restTimerRemainingSecondsOnPause > 0) {
        this.startRestPeriod(this.restTimerRemainingSecondsOnPause, true);
      }
      this.wasRestTimerVisibleOnPause = false;

      this.closeWorkoutMenu(); this.closePerformanceInsights();
      this.toastService.info('Workout session resumed.', 3000);
    } else {
      const resumed = await this.checkForPausedSession(true);
      if (!resumed && this.sessionState() !== SessionState.Playing && this.routineId) {
        this.loadNewWorkoutFromRoute();
      }
    }
  }

  ngOnDestroy(): void {
    // --- This is the core of the pattern ---
    // Emit a value to notify all subscriptions to complete.
    this.destroy$.next();
    this.destroy$.complete();
    // ------------------------------------

    // The rest of your specific cleanup logic remains the same.
    this.stopAllActivity(); // This is good to keep for any non-observable timers.
    this.isRestTimerVisible.set(false);

    if (isPlatformBrowser(this.platformId) && !this.isSessionConcluded &&
      (this.sessionState() === SessionState.Playing || this.sessionState() === SessionState.Paused) &&
      this.routine() && this.currentWorkoutLogExercises().length > 0) {
      console.log('WorkoutPlayer ngOnDestroy - Saving state...');
      this.savePausedSessionState();
    }
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
    const setNumberText = forActiveSetDisplay.type === 'warmup'
      ? `Warm-up ${this.getWarmupSetNumberForDisplay(forActiveSetDisplay.exerciseData, forActiveSetDisplay.setIndex)}/${this.getTotalWarmupSetsForExercise(forActiveSetDisplay.exerciseData)}`
      : `Set ${this.getWorkingSetNumberForDisplay(forActiveSetDisplay.exerciseData, forActiveSetDisplay.setIndex)}/${this.getWorkingSetCountForExercise(forActiveSetDisplay.exerciseData)}`;
    this.restTimerNextUpText.set(setNumberText);


    if (this.presetTimerSub) this.presetTimerSub.unsubscribe();
    this.presetTimerSub = timer(0, 1000).pipe(
      takeUntil(this.destroy$), // Add this line
      take(duration + 1)).subscribe({
        next: () => {
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
      if (exercise.sets[i].type === 'warmup') count++;
    }
    return count;
  }
  private getTotalWarmupSetsForExercise(exercise: WorkoutExercise): number {
    return exercise.sets.filter(s => s.type === 'warmup').length;
  }
  private getWorkingSetNumberForDisplay(exercise: WorkoutExercise, currentSetIndexInExercise: number): number {
    let count = 0;
    for (let i = 0; i <= currentSetIndexInExercise; i++) {
      if (exercise.sets[i].type !== 'warmup') count++;
    }
    return count;
  }
  private getWorkingSetCountForExercise(exercise: WorkoutExercise): number {
    return exercise.sets.filter(s => s.type !== 'warmup').length;
  }
  private findNextPlayableItemIndices(
    currentGlobalExerciseIndex: number,
    currentGlobalSetIndexInExercise: number,
    routine: Routine,
    forceAdvanceExerciseBlock: boolean = false
  ): { nextExIdx: number; nextSetIdx: number; blockChanged: boolean; isEndOfAllPending: boolean; roundIncremented: boolean } {
    let nextExIdx = currentGlobalExerciseIndex;
    let nextSetIdx = currentGlobalSetIndexInExercise;
    let blockChanged = false;
    let isEndOfAllPending = false;
    let roundIncremented = false;

    const currentPlayedExercise = routine.exercises[currentGlobalExerciseIndex];

    if (forceAdvanceExerciseBlock || nextSetIdx >= currentPlayedExercise.sets.length - 1) {
      nextSetIdx = 0; // Reset for new exercise/round

      if (!forceAdvanceExerciseBlock && currentPlayedExercise.supersetId && currentPlayedExercise.supersetOrder !== null &&
        currentPlayedExercise.supersetOrder < (currentPlayedExercise.supersetSize || 1) - 1) {
        let tempNextExIdx = currentGlobalExerciseIndex + 1;
        while (tempNextExIdx < routine.exercises.length &&
          (routine.exercises[tempNextExIdx].supersetId !== currentPlayedExercise.supersetId ||
            routine.exercises[tempNextExIdx].sessionStatus !== 'pending')) {
          tempNextExIdx++;
        }
        if (tempNextExIdx < routine.exercises.length && routine.exercises[tempNextExIdx].supersetId === currentPlayedExercise.supersetId) {
          nextExIdx = tempNextExIdx; // Found next pending in superset
          return { nextExIdx, nextSetIdx, blockChanged, isEndOfAllPending, roundIncremented };
        }
        // If no next pending in superset, fall through to end of block logic
      }

      const currentBlockTotalRounds = this.totalBlockRounds();
      if (!forceAdvanceExerciseBlock && this.currentBlockRound() < currentBlockTotalRounds) {
        this.currentBlockRound.update(r => r + 1);
        roundIncremented = true;
        let blockStartIdx = currentGlobalExerciseIndex;
        if (currentPlayedExercise.supersetId && currentPlayedExercise.supersetOrder !== null) {
          blockStartIdx = currentGlobalExerciseIndex - currentPlayedExercise.supersetOrder;
        }
        // Find first pending in this block for new round
        let searchInBlockIdx = blockStartIdx;
        let foundPendingInBlockForNewRound = false;
        while (searchInBlockIdx < routine.exercises.length &&
          (currentPlayedExercise.supersetId ? routine.exercises[searchInBlockIdx].supersetId === currentPlayedExercise.supersetId : searchInBlockIdx === blockStartIdx)) {
          if (routine.exercises[searchInBlockIdx].sessionStatus === 'pending') {
            nextExIdx = searchInBlockIdx;
            foundPendingInBlockForNewRound = true;
            break;
          }
          searchInBlockIdx++;
        }
        if (!foundPendingInBlockForNewRound) { // Entire block became non-pending
          this.currentBlockRound.set(currentBlockTotalRounds); roundIncremented = false; // Mark rounds done
          // Fall through to find next block
        } else {
          return { nextExIdx, nextSetIdx, blockChanged, isEndOfAllPending, roundIncremented };
        }
      }
      // Finished rounds or forced advance: find next pending block
      blockChanged = true;
      this.currentBlockRound.set(1);
      roundIncremented = false;

      let searchFrom = currentGlobalExerciseIndex + 1;
      if (currentPlayedExercise.supersetId && currentPlayedExercise.supersetOrder !== null) {
        searchFrom = currentGlobalExerciseIndex - currentPlayedExercise.supersetOrder + (currentPlayedExercise.supersetSize || 1);
      }
      nextExIdx = -1;
      for (let i = searchFrom; i < routine.exercises.length; i++) {
        const ex = routine.exercises[i];
        if (ex.sessionStatus === 'pending') {
          if (!ex.supersetId || ex.supersetOrder === 0) { nextExIdx = i; break; }
          // If mid-superset, find its actual start if that start is pending
          let actualBlockStartForMidSuperset = i - (ex.supersetOrder || 0);
          if (actualBlockStartForMidSuperset >= 0 && routine.exercises[actualBlockStartForMidSuperset].sessionStatus === 'pending' && routine.exercises[actualBlockStartForMidSuperset].supersetId === ex.supersetId) {
            nextExIdx = actualBlockStartForMidSuperset; break;
          }
        }
      }
    } else { // Advance to next set in same exercise
      nextSetIdx++;
    }

    if (nextExIdx === -1 || nextExIdx >= routine.exercises.length || (nextExIdx !== -1 && routine.exercises[nextExIdx].sessionStatus !== 'pending')) {
      isEndOfAllPending = true;
      nextExIdx = -1; // Ensure invalid index if end
    }
    return { nextExIdx, nextSetIdx, blockChanged, isEndOfAllPending, roundIncremented };
  }


  // check if there's atleast one exercise not fully logged
  /**
   * Returns true if there is at least one exercise in the current routine
   * that is not fully logged (i.e., not all sets are logged).
   */
  /**
   * Returns an array of all exercises in the current routine that are not fully logged.
   * An exercise is considered unfinished if not all its sets are logged.
   */
  getUnfinishedExercises(): WorkoutExercise[] {
    const routine = this.routine();
    if (!routine) return [];
    return routine.exercises.filter((ex, idx) => !this.isExerciseFullyLogged(ex.exerciseId, idx, ex.id));
  }

  /**
   * Returns an array of all exercises in the current routine that are fully logged.
   * An exercise is considered finished if all its sets are logged.
   */
  getFinishedExercises(): WorkoutExercise[] {
    const routine = this.routine();
    const loggedExercises = this.currentWorkoutLogExercises();
    if (!routine) return [];
    return routine.exercises.filter((ex, idx) => {
      const logged = loggedExercises.find(le => le.exerciseId === ex.exerciseId && routine.exercises[idx].id === ex.id);
      return logged && logged.sets.length >= ex.sets.length;
    });
  }

  // Ensure navigateToNextStepInWorkout correctly resets exercisesProposedThisCycle
  // when it decides to call tryProceedToDeferredExercisesOrFinish.

  private async navigateToNextStepInWorkout(
    completedActiveInfo: ActiveSetInfo,
    currentSessionRoutine: Routine,
    forceAdvanceExerciseBlock: boolean = false
  ): Promise<void> {
    const exerciseJustCompleted = completedActiveInfo.exerciseData;
    const isNowFullyLogged = this.isExerciseFullyLogged(exerciseJustCompleted.exerciseId, completedActiveInfo.exerciseIndex, exerciseJustCompleted.id);

    if (this.isPerformingDeferredExercise && exerciseJustCompleted.id === this.lastActivatedDeferredExerciseId && isNowFullyLogged) {
      console.log("navigateToNextStepInWorkout: Completed an explicitly chosen deferred/skipped exercise. Re-evaluating all remaining.");
      this.isPerformingDeferredExercise = false;
      this.lastActivatedDeferredExerciseId = null;
      this.exercisesProposedThisCycle = { doLater: false, skipped: false };
      await this.tryProceedToDeferredExercisesOrFinish(currentSessionRoutine);
      return;
    }

    // If there are unfinished exercises and we're at the last set of the last exercise of the round,
    // prompt the user what to do before proceeding.
    const isLastSetOfRound = this.checkIfLatestSetOfRound();
    const unfinishedExercises = this.getUnfinishedOrDeferredExercises(currentSessionRoutine);
    if (
      unfinishedExercises.length > 0 &&
      isLastSetOfRound &&
      this.currentBlockRound() < this.totalBlockRounds()
    ) {
      // If there are more rounds, advance to the first exercise of the next round
      if (this.currentBlockRound() < this.totalBlockRounds()) {
        this.currentBlockRound.update(r => r + 1);
        // Find the first pending exercise in the current block
        let blockStartIdx = completedActiveInfo.exerciseIndex;
        const currentExercise = currentSessionRoutine.exercises[completedActiveInfo.exerciseIndex];
        if (currentExercise.supersetId && currentExercise.supersetOrder !== null) {
          blockStartIdx = completedActiveInfo.exerciseIndex - currentExercise.supersetOrder;
        }
        let foundPending = false;
        for (let i = blockStartIdx; i < currentSessionRoutine.exercises.length; i++) {
          const ex = currentSessionRoutine.exercises[i];
          if (
            (currentExercise.supersetId
              ? ex.supersetId === currentExercise.supersetId
              : i === blockStartIdx) &&
            ex.sessionStatus === 'pending'
          ) {
            this.currentExerciseIndex.set(i);
            this.currentSetIndex.set(0);
            this.lastPerformanceForCurrentExercise = null;
            foundPending = true;
            break;
          }
          // Stop if we leave the block
          if (
            currentExercise.supersetId &&
            ex.supersetId !== currentExercise.supersetId
          ) {
            break;
          }
          if (!currentExercise.supersetId && i > blockStartIdx) {
            break;
          }
        }
        if (foundPending) {
          await this.prepareCurrentSet();
          return;
        }
        // If not found, fall through to check for unfinished exercises after rounds
      }

      // After all rounds, check for next unfinished exercise right after the rounds
      let nextUnfinishedIdx = -1;
      for (let i = completedActiveInfo.exerciseIndex + 1; i < currentSessionRoutine.exercises.length; i++) {
        if (
          currentSessionRoutine.exercises[i].sessionStatus === 'pending' &&
          !this.isExerciseFullyLogged(
            currentSessionRoutine.exercises[i].exerciseId,
            i,
            currentSessionRoutine.exercises[i].id
          )
        ) {
          nextUnfinishedIdx = i;
          break;
        }
      }
      if (nextUnfinishedIdx !== -1) {
        this.currentExerciseIndex.set(nextUnfinishedIdx);
        this.currentSetIndex.set(0);
        this.currentBlockRound.set(1);
        this.lastPerformanceForCurrentExercise = null;
        await this.prepareCurrentSet();
        return;
      }

      // Otherwise, prompt for what to do
      const confirm = await this.alertService.showConfirmationDialog(
        "End of Round",
        "You have unfinished exercises in this round. What would you like to do?",
        [
          { text: "Continue to Next Round", role: "confirm", data: "continue", cssClass: "bg-blue-600 text-white" } as AlertButton,
          { text: "Review Unfinished Exercises", role: "destructive", data: "review", cssClass: "bg-orange-500 text-white" } as AlertButton,
        ]
      );
      if (confirm && confirm.data === "review") {
        await this.jumpToExercise();
        return;
      }
      // If "continue", fall through to proceed as normal
    }

    const {
      nextExIdx,
      nextSetIdx,
      blockChanged,
      isEndOfAllPending,
      roundIncremented
    } = this.findNextPlayableItemIndices(
      completedActiveInfo.exerciseIndex,
      completedActiveInfo.setIndex,
      currentSessionRoutine,
      forceAdvanceExerciseBlock
    );

    if (isEndOfAllPending) {
      console.log("navigateToNextStepInWorkout: No more 'pending' exercises in main sequence. Attempting to proceed to deferred or finish.");
      this.isPerformingDeferredExercise = false;
      this.lastActivatedDeferredExerciseId = null;
      this.exercisesProposedThisCycle = { doLater: false, skipped: false };
      await this.tryProceedToDeferredExercisesOrFinish(currentSessionRoutine);
      return;
    }

    // If the nextExIdx points to the same exercise as just completed, but the set index is different,
    // OR if the nextExIdx points to a different exercise but it's actually the same exercise (e.g., due to duplicate IDs in routine),
    // we want to ensure we are not repeating the same exercise unintentionally.

    // Defensive: If the nextExIdx is -1, do nothing (should be handled above)
    if (nextExIdx === -1) {
      // Already handled above with isEndOfAllPending
      return;
    }

    // Check if the next exercise is the same as the one just completed (by id)
    const nextExercise = currentSessionRoutine.exercises[nextExIdx];
    if (nextExercise && exerciseJustCompleted && nextExercise.id === exerciseJustCompleted.id) {
      // Optionally, you could add logic here if you want to handle repeated exercises differently
      // For now, just log for debugging
      console.log('Next exercise is the same as just completed:', nextExercise.exerciseName);
    }

    // Check if the next exercise is already among currentWorkoutLogExercises (by exerciseId and id)
    const isNextExerciseLogged = this.currentWorkoutLogExercises().some(
      logEx => logEx.exerciseId === nextExercise?.exerciseId &&
        currentSessionRoutine.exercises.find(ex => ex.id === nextExercise?.id) && this.isExerciseFullyLogged(nextExercise?.exerciseId, nextExIdx, nextExercise.id)
    );
    if (isNextExerciseLogged && !this.checkIfSetIsPartOfRounds()) {
      console.log('Next exercise is already logged in currentWorkoutLogExercises:', nextExercise?.exerciseName);
      // You can add additional logic here if you want to handle this case
      this.tryProceedToDeferredExercisesOrFinish(currentSessionRoutine);
    }

    this.currentExerciseIndex.set(nextExIdx);
    this.currentSetIndex.set(nextSetIdx);

    if (completedActiveInfo.exerciseIndex !== nextExIdx) {
      // If the new exercise is NOT the one we explicitly marked as lastActivatedDeferredExerciseId,
      // then we are no longer in that specific deferred context.
      if (currentSessionRoutine.exercises[nextExIdx].id !== this.lastActivatedDeferredExerciseId) {
        this.isPerformingDeferredExercise = false;
        this.lastActivatedDeferredExerciseId = null;
      }
    }


    if (blockChanged || roundIncremented || forceAdvanceExerciseBlock || completedActiveInfo.exerciseIndex !== nextExIdx) {
      this.lastPerformanceForCurrentExercise = null;
    }
    if (blockChanged) {
      const newBlockStarterExercise = currentSessionRoutine.exercises[nextExIdx];
      if (!newBlockStarterExercise.supersetId || newBlockStarterExercise.supersetOrder === 0) {
        this.totalBlockRounds.set(newBlockStarterExercise.rounds ?? 1);
      } else {
        const actualBlockStart = currentSessionRoutine.exercises.find(ex => ex.supersetId === newBlockStarterExercise.supersetId && ex.supersetOrder === 0);
        this.totalBlockRounds.set(actualBlockStart?.rounds ?? 1);
      }
    }

    const restDurationAfterCompletedSet = completedActiveInfo.setData.restAfterSet;
    if (restDurationAfterCompletedSet > 0 && !forceAdvanceExerciseBlock) {
      this.startRestPeriod(restDurationAfterCompletedSet);
    } else {
      this.playerSubState.set(PlayerSubState.PerformingSet);
      await this.prepareCurrentSet();
    }
  }


  private startRestPeriod(duration: number, isResumingPausedRest: boolean = false): void {
    if (this.isTabataMode()) {
      return;
    }
    this.playerSubState.set(PlayerSubState.Resting);
    this.restDuration.set(duration);

    if (isPlatformBrowser(this.platformId) && duration > 0) { // Ensure duration > 0 for timer
      const routineVal = this.routine();

      if (!isResumingPausedRest) {
        this.restTimerMainText.set("RESTING");
        // For "UP NEXT", peek at the next set and handle rounds/supersets
        const nextSetInfo = this.peekNextSetInfo();
        let resultText = 'Next Exercise';

        if (nextSetInfo && nextSetInfo.exerciseData && nextSetInfo.exerciseData.sets) {
          const isWarmup = nextSetInfo.type === 'warmup';
          const setNumber = isWarmup
            ? this.getWarmupSetNumberForDisplay(nextSetInfo.exerciseData, nextSetInfo.setIndex)
            : this.getWorkingSetNumberForDisplay(nextSetInfo.exerciseData, nextSetInfo.setIndex);
          const totalSets = isWarmup
            ? this.getTotalWarmupSetsForExercise(nextSetInfo.exerciseData)
            : this.getWorkingSetCountForExercise(nextSetInfo.exerciseData);
          const exerciseName = nextSetInfo.exerciseData.exerciseName || 'Exercise';

          // Handle rounds/supersets
          let roundText = '';
          if (routineVal) {
            const ex = nextSetInfo.exerciseData;
            let rounds = ex.rounds ?? 0;
            // If part of a superset, get rounds from block start
            if (ex.supersetId && ex.supersetOrder !== null) {
              const blockStart = routineVal.exercises.find(e =>
                e.supersetId === ex.supersetId && e.supersetOrder === 0
              );
              if (blockStart) {
                rounds = blockStart.rounds ?? 1;
              }
            }
            if (rounds >= 1 && ex.supersetSize !== undefined && ex.supersetSize !== null && ex.supersetSize > 0) {
              roundText = ` (Round ${this.currentBlockRound()}/${rounds})`;
            }
          }

          resultText = `${isWarmup ? 'Warm-up ' : ''}Set ${setNumber}/${totalSets} of ${exerciseName}${roundText}`;
        }
        this.restTimerNextUpText.set(resultText);

      } else {
        this.restTimerMainText.set(this.restTimerMainTextOnPause);
        this.restTimerNextUpText.set(this.restTimerNextUpTextOnPause);
      }

      this.playerSubState.set(PlayerSubState.Resting);
      this.restDuration.set(duration);

      this.isRestTimerVisible.set(true); // Show full-screen timer
      this.updateRestTimerDisplay(duration); // For footer
    } else {
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
        type: (setData.type as 'standard' | 'warmup' | 'amrap' | 'custom') ?? 'standard', isCompleted: false // Dummy values
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
      this.playerSubState() === PlayerSubState.PresetCountdown ||
      this.playerSubState() === PlayerSubState.Resting;
  }

  handleMainAction(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Please resume to continue.", 3000, "Paused");
      return;
    } switch (this.playerSubState()) {
      case PlayerSubState.PerformingSet: {
        this.completeAndLogCurrentSet();
        break;
      }
      case PlayerSubState.PresetCountdown: this.skipPresetTimer(); break;
      case PlayerSubState.Resting: this.skipRest(); break;
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

  /**
   * Returns all exercises in the current session routine that have not been completed yet.
   * An exercise is considered "not completed" if its sessionStatus is 'pending'
   * and not all its sets have been logged in currentWorkoutLogExercises.
   */
  getIncompleteExercises(): WorkoutExercise[] {
    const routine = this.routine();
    const loggedExercises = this.currentWorkoutLogExercises();
    if (!routine) return [];

    return routine.exercises.filter(ex => {
      if (ex.sessionStatus !== 'pending') return false;
      const logged = loggedExercises.find(le => le.exerciseId === ex.exerciseId);
      // If not logged at all, it's incomplete
      if (!logged) return true;
      // If not all sets are logged, it's incomplete
      return logged.sets.length < ex.sets.length;
    });
  }

  async jumpToExercise(): Promise<void> {
    if (this.sessionState() === 'paused') {
      this.toastService.warning("Session is paused. Resume to jump to an exercise.", 3000, "Paused");
      this.closeWorkoutMenu();
      return;
    }

    const currentRoutineVal = this.routine();
    if (!currentRoutineVal || !currentRoutineVal.exercises || currentRoutineVal.exercises.length === 0) {
      this.toastService.error("No exercises available to jump to.", 0, "Error");
      this.closeWorkoutMenu();
      return;
    }

    // Filter for exercises that are not yet fully completed
    const availableExercises = currentRoutineVal.exercises
      .map((ex, index) => ({
        ...ex,
        originalIndex: index, // Keep track of original index in the routine.exercises array
        isFullyLogged: this.isExerciseFullyLogged(ex.exerciseId, index, ex.id)
      }))
      .filter(ex => !ex.isFullyLogged || ex.sessionStatus === 'pending' || ex.sessionStatus === 'do_later' || ex.sessionStatus === 'skipped'); // Include pending/deferred even if logged, to allow restart


    if (availableExercises.length === 0) {
      this.toastService.info("All exercises are completed or no suitable exercises to jump to.", 3000);
      this.closeWorkoutMenu();
      return;
    }

    const exerciseButtons: AlertButton[] = availableExercises.map(ex => {
      let statusIndicator = '';
      let setTypeIndicator = '';
      if (ex.id === this.activeSetInfo()?.exerciseData.id && ex.sessionStatus === 'pending' && !ex.isFullyLogged) {
        statusIndicator = ' (Current)';
      } else if (ex.isFullyLogged && ex.sessionStatus !== 'skipped' && ex.sessionStatus !== 'do_later') {
        statusIndicator = ' (Completed - Restart?)'; // Should ideally not happen if filter is correct
      } else if (ex.sessionStatus === 'skipped') {
        statusIndicator = ' (Skipped)';
      } else if (ex.sessionStatus === 'do_later') {
        statusIndicator = ' (Do Later)';
      }

      // Always use blue background for current or superset exercises
      let superSetClass = '';
      if (ex.supersetId && ex.supersetOrder !== null) {
        superSetClass = ' border-2 border-primary bg-primary/50 text-white';
      }

      let cssClass = 'bg-gray-500 dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-300 hover:text-gray-500 hover:dark:bg-gray-300 hover:dark:text-gray-500';

      switch (ex.sessionStatus) {
        case 'pending':
          cssClass = statusIndicator.includes('Current') ? 'bg-blue-600 text-white' : cssClass;
          break;
        case 'do_later':
          cssClass = 'bg-orange-500 hover:bg-orange-600 text-white';
          break;
        case 'skipped':
          cssClass = 'bg-yellow-500 hover:bg-yellow-600 text-black';
          break;
        default:
          cssClass = 'bg-gray-500 dark:bg-gray-700 dark:text-gray-100 hover:bg-gray-300 hover:text-gray-500 hover:dark:bg-gray-300 hover:dark:text-gray-500';
          break;
      }

      // If superset, always force blue bg (overrides above)
      if (superSetClass && !statusIndicator.includes('Current')) {
        cssClass = superSetClass;
      } else if (statusIndicator.includes('Current')) {
        cssClass = cssClass + ' bg-blue-600 text-white' + (superSetClass ? ' border-2 border-primary' : '');
      }

      let supersetIndexText = '';
      let groupKey: string | undefined = undefined;
      if (ex.supersetId) {
        // Use the index of this exercise within the superset block (1-based)
        const blockExercises = currentRoutineVal.exercises.filter(e => e.supersetId === ex.supersetId);
        const blockIndex = blockExercises.findIndex(e => e.id === ex.id);
        // Extract round index for this exercise (if applicable)
        let roundIndex = 1;
        if (ex.rounds && ex.rounds > 1) {
          // If the exercise has multiple rounds, show the current round
          // Try to get the current roundIndex from the exercise in the log
          const logEx = this.currentWorkoutLogExercises().find(le => le.exerciseId === ex.exerciseId && le.id === ex.id);
          if (logEx && typeof logEx.rounds === 'number' && logEx.rounds > 1) {
            roundIndex = logEx.rounds;
          } else {
            roundIndex = this.currentBlockRound ? this.currentBlockRound() : 1;
          }
        }
        if (blockIndex !== -1) {
          supersetIndexText = ` [SuperSet #${blockIndex + 1}${ex.rounds && ex.rounds > 1 ? `, Round ${roundIndex}/${ex.rounds}` : ''}]`;
        }
        // Group key for adjacent styling: supersetId + round
        groupKey = `${ex.supersetId}-round${roundIndex}`;
      }

      // Add a custom property for grouping in the dialog template (if supported)
      // If your dialog supports custom properties, you can use groupKey for adjacent styling.
      // If not, you can add a custom CSS class for superset grouping.

      // Example CSS class for superset grouping (add this to your global styles or component SCSS):
      // .superset-group-[groupKey] {
      //   border-left: 4px solid #6366f1; /* Example: indigo-500 */
      //   background-color: #eef2ff;      /* Example: indigo-50 */
      // }
      if (groupKey) {
        cssClass += ` superset-group-${groupKey}`;
      }

      return {
        text: `${ex.exerciseName}${statusIndicator}${supersetIndexText}`,
        role: 'confirm',
        data: ex.originalIndex, // Pass the original index
        cssClass: cssClass,
        groupKey // Optional: for template logic if needed
      };
    });

    exerciseButtons.push({ text: 'Cancel', role: 'cancel', data: 'cancel_jump' });

    this.closeWorkoutMenu(); // Close menu before showing dialog

    const choice = await this.alertService.showConfirmationDialog(
      'Jump to Exercise',
      'Select an exercise to start or continue:',
      exerciseButtons,
      // true // Allow HTML / more buttons
    );

    if (choice && choice.data !== 'cancel_jump' && typeof choice.data === 'number') {
      const selectedExerciseOriginalIndex = choice.data;
      const exerciseToJumpTo = currentRoutineVal.exercises[selectedExerciseOriginalIndex];

      if (!exerciseToJumpTo) {
        this.toastService.error("Selected exercise not found.", 0, "Error");
        return;
      }

      console.log(`Jumping to exercise: ${exerciseToJumpTo.exerciseName} at index ${selectedExerciseOriginalIndex}`);

      // Stop any current timers (rest, preset, timed set)
      this.stopOngoingTimers();


      // Update routine state for the chosen exercise
      const updatedRoutine = JSON.parse(JSON.stringify(currentRoutineVal)) as Routine;
      const targetExerciseInUpdatedRoutine = updatedRoutine.exercises[selectedExerciseOriginalIndex];

      const wasDeferred = targetExerciseInUpdatedRoutine.sessionStatus === 'do_later' || targetExerciseInUpdatedRoutine.sessionStatus === 'skipped';
      targetExerciseInUpdatedRoutine.sessionStatus = 'pending'; // Set to pending to play it
      this.routine.set(updatedRoutine);

      // Update player state
      this.currentExerciseIndex.set(selectedExerciseOriginalIndex);
      this.currentSetIndex.set(this.findFirstUnloggedSetIndex(exerciseToJumpTo.exerciseId, exerciseToJumpTo.sets.map(s => s.id)) || 0);
      this.currentBlockRound.set(1); // Reset round for this exercise, or could try to be smarter if part of a multi-round block
      if (!exerciseToJumpTo.supersetId || exerciseToJumpTo.supersetOrder === 0) {
        this.totalBlockRounds.set(exerciseToJumpTo.rounds ?? 1);
      } else {
        const actualBlockStart = updatedRoutine.exercises.find(ex => ex.supersetId === exerciseToJumpTo.supersetId && ex.supersetOrder === 0);
        this.totalBlockRounds.set(actualBlockStart?.rounds ?? 1);
      }
      this.lastPerformanceForCurrentExercise = null; // Force reload for the new exercise

      // Set deferred flags if jumping to a previously deferred/skipped item
      this.isPerformingDeferredExercise = wasDeferred;
      this.lastActivatedDeferredExerciseId = wasDeferred ? exerciseToJumpTo.id : null;
      // Don't reset exercisesProposedThisCycle here, as user is making an explicit jump.

      this.playerSubState.set(PlayerSubState.PerformingSet); // Default to performing set
      await this.prepareCurrentSet(); // This will handle preset timers if applicable

      this.toastService.info(`Jumped to ${exerciseToJumpTo.exerciseName}.`, 2500);
    }
  }

  private stopOngoingTimers(): void {
    if (this.isRestTimerVisible()) { // Full screen rest timer
      this.isRestTimerVisible.set(false); // This should also stop its internal timer
    }
    if (this.playerSubState() === PlayerSubState.Resting) { // Footer rest timer
      // No direct timer to stop here, changing playerSubState in prepareCurrentSet handles it
    }
    if (this.playerSubState() === PlayerSubState.PresetCountdown && this.presetTimerSub) {
      this.presetTimerSub.unsubscribe();
      this.presetTimerSub = undefined;
      this.presetTimerCountdownDisplay.set(null);
    }
    if (this.timedSetTimerState() !== TimedSetState.Idle && this.timedSetIntervalSub) {
      this.resetTimedSet();
    }
  }

  private loadAvailableExercises(): void {
    this.exerciseService.getExercises().pipe(take(1)).subscribe(exercises => {
      this.availableExercises = exercises;
    });
  }

  // --- Modal Methods for Workout Player ---
  openExerciseSelectionModal(): void {
    if (this.sessionState() === 'paused') {
      this.toastService.warning("Session is paused. Resume to add exercise.", 3000, "Paused");
      return;
    }
    if (this.availableExercises.length === 0) { // Lazy load if not already loaded
      this.loadAvailableExercises();
    }
    this.modalSearchTerm.set('');
    this.isExerciseModalOpen.set(true);
    this.closeWorkoutMenu(); // Close main menu when opening modal
  }

  closeExerciseSelectionModal(): void {
    this.isExerciseModalOpen.set(false);
  }

  onModalSearchTermChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.modalSearchTerm.set(inputElement.value);
  }
  // --- End Modal Methods ---


  isExerciseDetailModalOpen = signal(false);
  isSimpleModalOpen = signal(false);
  exerciseDetailsId: string = '';
  exerciseDetailsName: string = '';

  performAction() {
    console.log('Action performed from modal footer!');
    this.isExerciseDetailModalOpen.set(false);
  }

  openModal(exerciseData: WorkoutExercise) {
    this.exerciseDetailsId = exerciseData.exerciseId;
    this.exerciseDetailsName = exerciseData.exerciseName || 'Exercise details';
    this.isSimpleModalOpen.set(true);
  }

  showCompletedSetsForExerciseInfo = signal(false);
  toggleCompletedSetsForExerciseInfo(): void {
    this.showCompletedSetsForExerciseInfo.update(s => !s);
  }

  // For the "Completed Sets Today (All Exercises)"
  showCompletedSetsForDayInfo = signal(false);
  toggleCompletedSetsForDayInfo(): void {
    this.showCompletedSetsForDayInfo.update(s => !s);
  }


  /**
   * Transforms a standard routine into a flat list of HIIT intervals and starts the player.
   */
  /**
  * Transforms a standard routine into a flat list of HIIT intervals and starts the player.
  */
  /**
   * Transforms a routine into a flat list of HIIT intervals and starts the player.
   * Can start from a specific index and time if resuming.
   */
  private setupTabataMode(
    routine: Routine,
    startAtIndex: number = 0,
    startTimeRemaining?: number
  ): void {
    const intervals: Omit<HIITInterval, 'totalIntervals' | 'currentIntervalNumber'>[] = [];
    this.startOrResumeTimedSet();

    // This map will store the [exerciseIndex, setIndex] for each interval.
    // It will be the same size as the 'intervals' array.
    const intervalMap: [number, number][] = [];

    // 1. Add "Prepare" interval and its map entry.
    // It maps to the very first exercise and set for context.
    intervals.push({ type: 'prepare', duration: 10, exerciseName: 'Get Ready' });
    intervalMap.push([0, 0]);

    // 2. Iterate through exercises and sets to build the intervals and the map.
    const totalExercises = routine.exercises.length;
    routine.exercises.forEach((exercise, exerciseIndex) => {
      const totalSetsInExercise = exercise.sets.length;

      exercise.sets.forEach((set, setIndex) => {
        // A. Add the "Work" interval.
        intervals.push({
          type: 'work',
          duration: set.duration || 5, // Default duration
          exerciseName: exercise.exerciseName
        });
        // Map this "Work" interval directly to its source set.
        intervalMap.push([exerciseIndex, setIndex]);

        // B. Conditionally add the "Rest" interval.
        const isLastExercise = exerciseIndex === totalExercises - 1;
        const isLastSet = setIndex === totalSetsInExercise - 1;

        if (set.restAfterSet > 0 && !(isLastExercise && isLastSet)) {
          intervals.push({
            type: 'rest',
            duration: set.restAfterSet || 20, // Default rest
            exerciseName: 'Rest'
          });
          // CRITICAL: The "Rest" interval maps to the SAME set that preceded it.
          // This keeps the context correct during rest periods.
          intervalMap.push([exerciseIndex, setIndex]);
        }
      });
    });

    // Store the generated map in the component property for later use.
    this.tabataIntervalMap = intervalMap;

    // 3. Finalize the intervals list with total counts (no changes here).
    const totalIntervals = intervals.length;
    const finalIntervals = intervals.map((interval, index) => ({
      ...interval,
      totalIntervals: totalIntervals,
      currentIntervalNumber: index + 1
    }));
    this.tabataIntervals.set(finalIntervals);

    // 4. Set the initial state of the player.
    this.sessionState.set(SessionState.Playing);
    this.routine.set(routine); // Ensure the routine is set
    this.isTabataMode.set(true)

    // 5. Use the new helper to set the correct state for BOTH players.
    // This replaces the scattered state-setting logic.
    this.setPlayerStateFromTabataIndex(startAtIndex);


    // 6. Start the timer.
    if (startTimeRemaining !== undefined && startTimeRemaining > 0) {
      this.startCurrentTabataInterval(startTimeRemaining);
    } else {
      this.startCurrentTabataInterval();
    }
  }

  /**
 * Starts the timer for the currently active Tabata interval.
 * Can start from a specific remaining time if resuming.
 */
  private startCurrentTabataInterval(startFromTime?: number): void {
    if (this.tabataTimerSub) this.tabataTimerSub.unsubscribe();
    if (this.sessionState() === SessionState.Paused) return;

    const interval = this.currentTabataInterval();
    if (!interval) {
      this.sessionState.set(SessionState.End);
      this.finishWorkoutAndReportStatus();
      return;
    }

    // If resuming, use the provided time. Otherwise, use the interval's full duration.
    const initialTime = startFromTime !== undefined ? startFromTime : interval.duration;
    this.tabataTimeRemaining.set(initialTime);

    this.tabataTimerSub = timer(0, 1000)
      .pipe(
        take(interval.duration + 1), // Keep your existing take()
        takeUntil(this.destroy$)      // Add this line after it
      ).subscribe({
        next: () => {
          this.tabataTimeRemaining.update(t => t - 1);
        },
        complete: () => {
          if (this.sessionState() === SessionState.Playing) {
            this.nextTabataInterval();
          }
        }
      });
  }

  /**
   * Navigates to the next interval in the Tabata sequence.
   */
  nextTabataInterval(): void {
    const nextIndex = this.currentTabataIntervalIndex() + 1;
    if (nextIndex <= this.tabataIntervals().length) {
      if (nextIndex === this.tabataIntervals().length) {
        // ending logging
        this.completeAndLogCurrentSet();
        // Reached the end
        this.tabataTimeRemaining.set(0);
        if (this.tabataTimerSub) this.tabataTimerSub.unsubscribe();
        this.sessionState.set(SessionState.End);
      } else {
        if (this.currentTabataInterval() !== null &&
          (this.currentTabataInterval()?.type !== 'prepare' && this.currentTabataInterval()?.type !== 'rest')) {
          this.completeAndLogCurrentSet();
        }
        this.currentTabataIntervalIndex.set(nextIndex);
        this.startCurrentTabataInterval();
      }

    }
  }

  /**
   * Navigates to the previous interval in the Tabata sequence.
   */
  previousTabataInterval(): void {
    const prevIndex = this.currentTabataIntervalIndex() - 1;
    if (prevIndex >= 0) {
      this.currentTabataIntervalIndex.set(prevIndex);
      this.startCurrentTabataInterval();
    }
  }

  /**
   * Toggles the pause state for the Tabata player.
   */
  toggleTabataPause(): void {
    if (this.sessionState() === SessionState.Playing) {
      // Pausing
      this.sessionState.set(SessionState.Paused);
      if (this.tabataTimerSub) this.tabataTimerSub.unsubscribe();
      if (this.timerSub) this.timerSub.unsubscribe(); // Pause overall timer too
      this.sessionTimerElapsedSecondsBeforePause += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    } else if (this.sessionState() === SessionState.Paused) {
      // Resuming
      this.sessionState.set(SessionState.Playing);
      this.workoutStartTime = Date.now(); // Reset start time for delta calculation
      this.startSessionTimer(); // Resume overall timer
      this.startCurrentTabataInterval(); // Resume interval timer
    }
  }


  private getCurrentSetInfo(): ActiveSetInfo | null {
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
        type: (setData.type as 'standard' | 'warmup' | 'amrap' | 'custom') ?? 'standard',
        baseExerciseInfo: undefined,
        isCompleted: !!completedSetLog,
        actualReps: completedSetLog?.repsAchieved,
        actualWeight: completedSetLog?.weightUsed,
        actualDuration: completedSetLog?.durationPerformed,
        notes: completedSetLog?.notes, // This is the logged note for this specific set completion
      };
    }
    return null;
  }

  // NEW HELPER METHOD
  private setPlayerStateFromTabataIndex(tabataIndex: number): void {
    this.currentTabataIntervalIndex.set(tabataIndex);

    // Use the map to find the corresponding standard player indices
    const mappedIndices = this.tabataIntervalMap[tabataIndex];
    if (mappedIndices) {
      const [exerciseIndex, setIndex] = mappedIndices;
      this.currentExerciseIndex.set(exerciseIndex);
      this.currentSetIndex.set(setIndex);
      console.log(`Tabata Sync: Interval ${tabataIndex} maps to Exercise ${exerciseIndex}, Set ${setIndex}`);
    } else {
      // Fallback for the end of the workout
      const lastValidMap = this.tabataIntervalMap[this.tabataIntervalMap.length - 1];
      if (lastValidMap) {
        this.currentExerciseIndex.set(lastValidMap[0]);
        this.currentSetIndex.set(lastValidMap[1]);
      }
    }
  }

}