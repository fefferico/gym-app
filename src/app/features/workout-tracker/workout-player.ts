import { Component, inject, OnInit, OnDestroy, signal, computed, WritableSignal, ChangeDetectorRef, HostListener, PLATFORM_ID, ViewChildren, QueryList, ElementRef, effect, ViewChild } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, Observable, of, timer, firstValueFrom, interval, Subject, combineLatest } from 'rxjs';
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
import { PressDirective } from '../../shared/directives/press.directive';
import { FormatSecondsPipe } from '../../shared/pipes/format-seconds-pipe';
import { PressScrollDirective } from '../../shared/directives/press-scroll.directive';
import { ProgressiveOverloadService } from '../../core/services/progressive-overload.service.ts';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { TrainingProgramService } from '../../core/services/training-program.service';
import { ExerciseSelectionModalComponent } from '../../shared/components/exercise-selection-modal/exercise-selection-modal.component';


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
  imports: [CommonModule, DatePipe, ReactiveFormsModule,
    FormatSecondsPipe,
    FormsModule, WeightUnitPipe, FullScreenRestTimerComponent, PressDirective, ModalComponent, ExerciseDetailComponent,
    PressScrollDirective, IconComponent, ExerciseSelectionModalComponent],
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
  private trainingProgramService = inject(TrainingProgramService);

  protected appSettingsService = inject(AppSettingsService);
  protected progressiveOverloadService = inject(ProgressiveOverloadService);

  private platformId = inject(PLATFORM_ID);
  // --- State Signals ---
  protected routine = signal<Routine | null | undefined>(undefined);
  program = signal<string | undefined>(undefined);
  sessionState = signal<SessionState>(SessionState.Loading);
  public readonly PlayerSubState = PlayerSubState;
  playerSubState = signal<PlayerSubState>(PlayerSubState.PerformingSet);

  currentExerciseIndex = signal(0);
  currentSetIndex = signal(0);
  currentBlockRound = signal(1);
  totalBlockRounds = signal(1);

  @ViewChild('exerciseSearchFied') myExerciseInput!: ElementRef;

  showNotes = signal<boolean | null>(false);

  // --- Timer Signals & Properties ---
  // Show "MM:SS" if under 1 hour, otherwise "HH:MM:SS"
  sessionTimerDisplay = signal('00:00');

  // ... update startSessionTimer to set the display accordingly ...
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
  isExerciseAddModalOpen = signal(false);
  availableExercises: Exercise[] = [];
  modalSearchTerm = signal('');
  filteredAvailableExercises = computed(() => {
    let term = this.modalSearchTerm().toLowerCase();
    if (!term) {
      return this.availableExercises;
    }
    term = this.exerciseService.normalizeExerciseNameForSearch(term);
    return this.availableExercises.filter(ex =>
      ex.name.toLowerCase().includes(term) ||
      (ex.category && ex.category.toLowerCase().includes(term)) ||
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
  private tabataIntervalMap: [number, number, number][] = [];

  private tabataTimerSub: Subscription | undefined;
  // --- END: TABATA MODE STATE SIGNALS ---

  protected HEADER_OVERVIEW_STRING: string = 'JUMP TO EXERCISE';
  protected headerOverviewString: string = 'JUMP TO EXERCISE';

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

  checkIfLatestOfEverything(): boolean {
    const isLastSetOfExercise = this.checkIfLatestSetOfExercise();
    const isLastSetOfRound = this.checkIfLatestSetOfRound();
    const isLastRound = this.checkIfLatestRoundOfRounds();
    const isLastSetOfWorkout = this.checkIfLatestSetOfWorkoutConsideringPending();

    return isLastSetOfWorkout && isLastRound && isLastSetOfExercise && isLastSetOfRound;
  }

  checkIfSuperSetIsStarted(): boolean {
    const exercises = this.routine()?.exercises;
    const currExIdx = this.activeSetInfo()?.exerciseIndex;
    const currExercise = exercises && currExIdx !== undefined ? exercises[currExIdx] : undefined;

    return this.checkIfSetIsPartOfRounds() && (currExIdx ?? 0) > 0;
  }


  readonly mainActionButtonLabel = computed(() => {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();

    switch (this.playerSubState()) {
      case PlayerSubState.PresetCountdown:
        return `PREPARING... ${this.presetTimerCountdownDisplay()}s`;

      case PlayerSubState.Resting:
        return `RESTING: ${this.restTimerDisplay()}`;

      case PlayerSubState.PerformingSet:
        if (!activeInfo) return 'SET DONE'; // Safety check

        const isLastSetOfExercise = this.checkIfLatestSetOfExercise();
        const isLastSetOfRound = this.checkIfLatestSetOfRound();
        const isPartOfRounds = this.checkIfSetIsPartOfRounds();
        const isLastRound = this.checkIfLatestRoundOfRounds();
        const isLastSetOfWorkout = this.checkIfLatestSetOfWorkoutConsideringPending();

        // Highest priority: Is it the absolute end of the entire workout?
        if (isLastSetOfWorkout && isLastRound && isLastSetOfExercise && isLastSetOfRound) {
          return 'FINISH WORKOUT';
        }

        // Next, handle the logic for multi-round blocks (supersets or standard exercises with rounds > 1)
        if (isPartOfRounds) {
          // If it's the last exercise of the current round...
          if (isLastSetOfRound) {
            // ...but it's NOT the final round, the user is just completing the current round.
            if (!isLastRound) {
              return 'COMPLETE ROUND';
            } else {
              // It IS the final round of its block, but not the whole workout.
              // Treat it as completing a standard exercise.
              return 'COMPLETE EXERCISE';
            }
          } else {
            // It's an intermediate exercise within a superset round.
            return 'SET DONE';
          }
        }

        // Finally, handle standard, single-round exercises.
        if (isLastSetOfExercise) {
          return 'COMPLETE EXERCISE';
        }

        // Default for any other intermediate set.
        return 'SET DONE';

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
    this.closeWorkoutMenu();
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

  getWorkingSets(exercise: WorkoutExercise | LoggedWorkoutExercise): number {
    return exercise.sets ? exercise.sets.filter(set => set.type !== 'warmup').length : 1;
  }

  activeSetInfo = computed<ActiveSetInfo | null>(() => {
    const r = this.routine();
    const exIndex = this.currentExerciseIndex();
    const sIndex = this.currentSetIndex();

    if (r && r.exercises[exIndex] && r.exercises[exIndex].sets[sIndex]) {
      const exerciseData = r.exercises[exIndex];
      const setData = r.exercises[exIndex].sets[sIndex];
      const completedExerciseLog = this.currentWorkoutLogExercises().find(logEx => logEx.exerciseId === exerciseData.exerciseId);
      const completedSetLog = completedExerciseLog?.sets.find(logSet => logSet.plannedSetId === setData.id);

      let baseExerciseInfo;
      this.exerciseService.getExerciseById(exerciseData.exerciseId).subscribe(ex => {
        baseExerciseInfo = ex;
      });

      return {
        exerciseIndex: exIndex,
        setIndex: sIndex,
        exerciseData: exerciseData,
        setData: setData,
        type: (setData.type as 'standard' | 'warmup' | 'amrap' | 'custom') ?? 'standard',
        baseExerciseInfo: baseExerciseInfo,
        isCompleted: !!completedSetLog,
        actualReps: completedSetLog?.repsAchieved,
        actualWeight: completedSetLog?.weightUsed,
        actualDuration: completedSetLog?.durationPerformed,
        notes: completedSetLog?.notes || setData?.notes, // This is the logged note for this specific set completion
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
        const exercise = routine.exercises.find(e => e.exerciseId === exLog.exerciseId);

        const currentSet = exercise?.sets.find(currSet => currSet.id === set.plannedSetId);
        const currentSetIndex = currentSet ? exercise?.sets.findIndex(set => set.id === currentSet.id) : -1;
        if (currentSetIndex !== undefined && currentSetIndex >= 0) {
          set.plannedSetId = (currentSetIndex + 1) + ' of ' + exercise?.sets.length;
        }

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

  // private readonly stopWeightDecrementHandler: () => void;

  constructor() {
    this.initializeCurrentSetForm();

    // this.stopWeightDecrementHandler = this.onWeightDecrementPointerUp.bind(this);

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
        // Show "MM:SS" if under 1 hour, otherwise "H:MM:SS" (no leading zero for hours)
        if (hours > 0) {
          this.sessionTimerDisplay.set(
            `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          );
        } else {
          this.sessionTimerDisplay.set(
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
          );
        }
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
        type: loggedSet.type || 'standard',
        supersetId: exerciseData.supersetId || null,
        supersetOrder: exerciseData.supersetOrder !== null ? exerciseData.supersetOrder : null,
        supersetSize: exerciseData.supersetSize || 0,
        supersetRounds: exerciseData.supersetRounds || 0,
      };

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

    // Step 1: Create lookup sets for fast O(1) checking. This is very efficient.
    const originalIdSet = new Set(original.map(ex => ex.exerciseId));
    const originalNameSet = new Set(original.map(ex => ex.exerciseName));

    // Step 2: Initialize your result arrays.
    const performedExercisesThatWereInOriginal: LoggedWorkoutExercise[] = [];
    const addedCustomExercises: LoggedWorkoutExercise[] = [];

    // Step 3: Loop through the performed exercises only ONCE.
    for (const pEx of performed) {
      // Check if the performed exercise exists in the original sets.
      if (originalIdSet.has(pEx.exerciseId) || originalNameSet.has(pEx.exerciseName)) {
        performedExercisesThatWereInOriginal.push(pEx);
      } else {
        addedCustomExercises.push(pEx);
      }
    }


    if (performedExercisesThatWereInOriginal.length !== original.length || addedCustomExercises.length > 0) {
      if (performedExercisesThatWereInOriginal.length !== original.length) {
        details.push(`Number of exercises or their content changed [Original number exercises: ${original.length}, performed number exercises: ${performedExercisesThatWereInOriginal.length}]`);
      } else {
        details.push(`Number of exercises or their content changed [Original number exercises: ${original.length}, performed number exercises: ${original.length + addedCustomExercises.length}]`);
      }
      majorDifference = true;
    }
    if (addedCustomExercises.length > 0) {
      for (const cEx of addedCustomExercises) {
        details.push(`Exercise added: ${cEx.exerciseName} `);
      }
    }


    // More detailed checks (can be expanded)
    for (const originalEx of original) {
      const performedEx = performed.find(p => p.exerciseId === originalEx.exerciseId);
      if (!performedEx) {
        details.push(`Exercise "${originalEx.exerciseName || originalEx.exerciseId}" was in the plan but not performed`);
        majorDifference = true; // Could be true or just a note depending on strictness
        continue;
      }

      // Compare sets for warmup status or count differences
      if (performedEx.sets.length !== originalEx.sets.length && performedEx.rounds !== originalEx.rounds) {
        // specific check for rounds
        if (performedEx.supersetId && originalEx.supersetId && performedEx.supersetId === originalEx.supersetId) {
          // retrieve ex[0] cause it's the only one with set property valued
          const originalFirstEx = original.find(ex => ex.supersetId && ex.supersetId === performedEx.supersetId);
          if (originalFirstEx) {
            const originalRounds = originalFirstEx.rounds;
            if (originalRounds === performedEx.sets.length) {
              continue;
            }
            if (majorDifference) {
              details.push(`Set count for "${performedEx.exerciseName || performedEx.exerciseId}" changed (was ${originalEx.sets.length}, now ${performedEx.sets.length})`);
            }
          }

        } else {
          details.push(`Set count for "${performedEx.exerciseName || performedEx.exerciseId}" changed (was ${originalEx.sets.length}, now ${performedEx.sets.length})`);
          majorDifference = true;
        }
      } else {
        for (let j = 0; j < performedEx.sets.length; j++) {
          const originalIsWarmup = originalEx.sets[j]?.type === 'warmup';
          const performedIsWarmup = performedEx.sets[j]?.type === 'warmup';
          if (originalIsWarmup !== performedIsWarmup) {
            details.push(`Warm-up status for set ${j + 1} of "${performedEx.exerciseName}" changed`);
            majorDifference = true;
            break;
          }
        }
      }
    }
    return { majorDifference, details };
  }

  getFirstExerciseOfSuperset(superSetOrder: number ,supersetId: string, loggedExercises: LoggedWorkoutExercise[]): ExerciseSetParams {
    const exercise = loggedExercises.find(ex => ex.supersetId && ex.supersetId === supersetId);
    const exerciseSet = exercise?.sets[0];
    return {
      id: uuidv4(), // New ID for the routine template set
            reps: exerciseSet && exerciseSet.targetReps ? exerciseSet.repsAchieved : 1, 
            weight: exerciseSet && exerciseSet.weightUsed ? exerciseSet.weightUsed : 1, 
            duration: exerciseSet && exerciseSet.targetDuration ? exerciseSet.targetDuration : 0, 
            tempo: '1', 
            restAfterSet: superSetOrder !== null && superSetOrder !== undefined && exercise && exercise.supersetSize && superSetOrder < exercise.supersetSize - 1 ? 0 : this.getLastExerciseOfSuperset(supersetId, loggedExercises).restAfterSet, 
            notes: exerciseSet && exerciseSet.notes ? exerciseSet.notes : '', 
            type: exerciseSet && exerciseSet.type ? 'superset' : 'standard', 
    };
  }

    getLastExerciseOfSuperset(supersetId: string, loggedExercises: LoggedWorkoutExercise[]): ExerciseSetParams {
      const exercise = loggedExercises.find(ex => ex.supersetId && ex.supersetId === supersetId);
      const exerciseSet = exercise?.sets[exercise.sets.length-1];
    return {
      id: uuidv4(), // New ID for the routine template set
            reps: exerciseSet && exerciseSet.targetReps ? exerciseSet.targetReps : 1, 
            weight: exerciseSet && exerciseSet.targetWeight ? exerciseSet.targetWeight : 1, 
            duration: exerciseSet && exerciseSet.targetDuration ? exerciseSet.targetDuration : 1, 
            tempo: '1', 
            restAfterSet: exerciseSet && exerciseSet.targetRestAfterSet ? exerciseSet.targetRestAfterSet : 60, 
            notes: exerciseSet && exerciseSet.notes ? exerciseSet.notes : '', 
            type: exerciseSet && exerciseSet.type ? 'superset' : 'standard', 
    };
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
        sets: !loggedEx.supersetId ? loggedEx.sets.map(loggedSet => {
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
        }) : [this.getFirstExerciseOfSuperset((loggedEx.supersetOrder || 0), loggedEx.supersetId, loggedExercises)],
        // TODO correct number of sets when converting a SUPERSET routine to a new one
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
      this.toastService.warning("Session is paused. Please resume to use the timer", 3000, "Paused");
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

    // If not in a superset or multi-round block, fallback to checkIfLatestSetOfExercise
    if ((!currentExercise.supersetId && (!currentExercise.rounds || currentExercise.rounds <= 1))) {
      return this.checkIfLatestSetOfExercise();
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
   */
  checkIfSetIsPartOfRounds(): boolean {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    if (!activeInfo || !routine) return false;

    const exercise = routine.exercises[activeInfo.exerciseIndex];
    if (!exercise) return false;

    let totalRoundsForBlock = 1;

    // If exercise is part of a superset, get rounds from the block start
    if (exercise.supersetId) {
      const blockStart = routine.exercises.find(
        ex => ex.supersetId === exercise.supersetId && ex.supersetOrder === 0
      );
      totalRoundsForBlock = blockStart?.rounds ?? 1;
    } else {
      // Otherwise, use the exercise's own rounds property
      totalRoundsForBlock = exercise.rounds ?? 1;
    }

    // A block is "part of rounds" if it's intended to be repeated.
    return totalRoundsForBlock > 1;
  }


  checkIfLatestSetOfWorkout(): boolean { // Legacy name, use checkIfLatestSetOfWorkoutConsideringPending
    return this.checkIfLatestSetOfWorkoutConsideringPending();
  }

  // Ensure checkIfLatestSetOfWorkoutConsideringPending uses the refined check
  checkIfLatestSetOfWorkoutConsideringPending(): boolean {
    const activeInfo = this.activeSetInfo();
    const currentRoutine = this.routine();
    if (!activeInfo || !currentRoutine) return false;

    // First, check if the current set is the last set of the current exercise definition.
    // For supersets with 1 set, this will be true every time.
    if (!this.checkIfLatestSetOfExercise()) {
      return false;
    }

    // If it is the last set, we must also check if it's the last ROUND of a multi-round block.
    // If it's part of a multi-round block but not the final round, it's not the end of the workout.
    if (this.checkIfSetIsPartOfRounds() && !this.checkIfLatestRoundOfRounds()) {
      return false;
    }

    // At this point, we have confirmed the current exercise *block* is fully complete (all sets and all rounds).
    // Now we can look ahead for any other pending or deferred exercises.

    // Determine the end index of the current block to start searching from the next item.
    const currentExercise = activeInfo.exerciseData;
    let blockEndIndex = activeInfo.exerciseIndex;
    if (currentExercise.supersetId && currentExercise.supersetOrder !== null && currentExercise.supersetSize) {
      blockEndIndex = (activeInfo.exerciseIndex - currentExercise.supersetOrder) + (currentExercise.supersetSize - 1);
    }

    // Check for any 'pending' exercises *after* the current block.
    for (let i = blockEndIndex + 1; i < currentRoutine.exercises.length; i++) {
      const nextEx = currentRoutine.exercises[i];
      if (nextEx.sessionStatus === 'pending' && (nextEx.sets?.length ?? 0) > 0) {
        return false; // Found a future pending exercise.
      }
    }

    // No more pending exercises in the main sequence.
    // Finally, check if there are *any* unlogged 'do_later' or 'skipped' exercises left anywhere.
    const hasUnfinishedDeferred = currentRoutine.exercises.some(ex =>
      (ex.sessionStatus === 'do_later' || ex.sessionStatus === 'skipped') &&
      !this.isExerciseFullyLogged(ex)
    );

    // If there are no other pending or unfinished deferred exercises, it's the end.
    return !hasUnfinishedDeferred;
  }

  private getUnfinishedOrDeferredExercises(sessionRoutine: Routine): any[] {
    const currentExercise = sessionRoutine.exercises[this.currentExerciseIndex()];
    const unfinishedOtherExercises = this.getUnfinishedExercises().filter(
      ex => ex.id !== currentExercise.id
    );
    // console.log("Unfinished exercises (excluding current):", unfinishedOtherExercises.map(e => e.exerciseName));

    const unfinishedDeferredOrSkippedExercises = sessionRoutine.exercises
      .map((ex, idx) => ({ ...ex, originalIndex: idx }))
      .filter((ex, innerIdx) =>
        (ex.sessionStatus === 'do_later' || ex.sessionStatus === 'skipped') &&
        !this.isExerciseFullyLogged(ex)
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
    const mergedUnfinishedExercises = this.getUnfinishedOrDeferredExercises(sessionRoutine);

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
            // { text: 'Cancel (Decide Later)', role: 'cancel', data: 'cancel_deferred_choice' } as AlertButton // Added Cancel here too
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
          let statusLabel = this.getExerciseStatusIndicator(ex);
          const cssClass = this.getExerciseButtonCssClass(ex, ex.sessionStatus);



          return {
            text: `${ex.exerciseName} ${statusLabel}`,
            role: 'confirm',
            data: ex.originalIndex,
            cssClass: cssClass
          };
        });
        const alertButtons: AlertButton[] = [
          ...exerciseButtons,
          { text: 'Finish Workout Now', role: 'destructive', data: 'finish_now', cssClass: 'bg-green-500 hover:bg-green-600 text-white mt-4' },
          // { text: 'Cancel (Decide Later)', role: 'cancel', data: 'cancel_deferred_choice' }
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
        await this.finishWorkoutAndReportStatus();
        return;
      }

      if (userCancelledChoice) {
        // Mark that proposals happened for *all* categories that were presented in this list.
        mergedUnfinishedExercises.forEach(ex => {
          if (ex.sessionStatus === 'do_later') this.exercisesProposedThisCycle.doLater = true;
          if (ex.sessionStatus === 'skipped') this.exercisesProposedThisCycle.skipped = true;
        });
        this.cdr.detectChanges(); // For mainActionButtonLabel update
        // IMPORTANT: Return here to prevent falling through to finishWorkoutAndReportStatus()
        // The user chose to "decide later", so the player should wait for their next action.
        return;
      }

      if (proceedWithSelectedExercise && selectedExerciseOriginalIndex !== undefined) {
        const exerciseToStart = sessionRoutine.exercises[selectedExerciseOriginalIndex];
        this.isPerformingDeferredExercise = true;
        this.lastActivatedDeferredExerciseId = exerciseToStart.id;

        const updatedRoutine = JSON.parse(JSON.stringify(sessionRoutine)) as Routine;
        updatedRoutine.exercises[selectedExerciseOriginalIndex].sessionStatus = 'pending';
        this.routine.set(updatedRoutine);

        this.currentExerciseIndex.set(selectedExerciseOriginalIndex);
        this.currentSetIndex.set(this.findFirstUnloggedSetIndex(exerciseToStart.id, exerciseToStart.sets.map(s => s.id)) || 0);
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

    const endCurrentWorkout = await this.alertService.showConfirmationDialog(
      `Continue or End`,
      'The current session is finished! Would you like to add a new exercise or complete it?',
      [
        { text: 'Add exercise', role: 'add_exercise', data: 'add_exercise', cssClass: 'bg-primary hover:bg-primary-dark text-white', icon: 'plus-circle', iconClass: 'h-8 w-8 mr-1' } as AlertButton,
        { text: 'End session', role: 'end_session', data: "end_session", cssClass: 'bg-blue-500 hover:bg-blue-600 text-white', icon: 'done', iconClass: 'h-8 w-8 mr-1' } as AlertButton,
      ],
    );

    if (endCurrentWorkout && endCurrentWorkout.role === 'end_session') {
      await this.finishWorkoutAndReportStatus();
    } else {
      this.isEndReached.set(true);
      this.openExerciseSelectionModal();
    }
  }

  /**
 * Retrieves the number of sets that have been logged for a specific exercise
 * during the current workout session.
 *
 * This is useful for displaying progress like "2 of 5 sets completed".
 *
 * @param id The unique ID of this exercise instance within the current routine (maps to WorkoutExercise.id).
 * @returns The number of sets logged for this exercise instance, or 0 if none have been logged yet.
 */
  public getNumberOfLoggedSets(id: string, filterOutType?: string): number {
    // Find the corresponding exercise in the array of currently logged exercises for this session.
    // We use the same robust matching logic as your inspiration method to find the exact instance.
    const loggedExercise = this.currentWorkoutLogExercises().find(loggedEx =>
      loggedEx.id === id
    );

    // If no log entry is found for this specific exercise instance yet,
    // it means 0 sets have been logged for it.
    if (!loggedExercise) {
      return 0;
    }

    // If an entry is found, the number of logged sets is simply the length of its 'sets' array.
    // We use optional chaining `?.` for extra safety, returning 0 if `sets` is somehow missing.


    if (filterOutType) {
      return loggedExercise.sets ? loggedExercise.sets.filter(set => set.type !== filterOutType).length : 1;
    } else {
      return loggedExercise.sets?.length || 0;
    }
  }

  private isExercisePartiallyLogged(currentExercise: WorkoutExercise): boolean {
    const routine = this.routine();
    if (!routine) return false;

    const exercise = routine.exercises.find(ex => ex.exerciseId === currentExercise.exerciseId && ex.id === currentExercise.id);
    if (!exercise) return false;

    const loggedEx = this.currentWorkoutLogExercises().find(le =>
      le.exerciseId === currentExercise.exerciseId &&
      exercise.exerciseId === le.exerciseId &&
      le.id === currentExercise.id
    );

    // If there's no log entry OR the entry has 0 sets, it's not even partially logged.
    if (!loggedEx || loggedEx.sets.length === 0) {
      return false;
    }

    // Use the same logic as isExerciseFullyLogged to get the total goal
    let rounds = exercise.rounds ?? 1;
    if (exercise.supersetId && exercise.supersetOrder !== null) {
      const blockStart = routine.exercises.find(
        ex => ex.supersetId === exercise.supersetId && ex.supersetOrder === 0
      );
      rounds = blockStart?.rounds ?? 1;
    }
    const totalPlannedCompletions = (exercise.sets?.length ?? 0) * rounds;

    return loggedEx.sets.length < totalPlannedCompletions;
  }

  private isExerciseFullyLogged(currentExercise: WorkoutExercise): boolean {
    const routine = this.routine();
    if (!routine) return false;
    const exercise = routine.exercises.find(ex => ex.id === currentExercise.id);
    if (!exercise) return false;

    const loggedEx = this.currentWorkoutLogExercises().find(le =>
      le.id === currentExercise.id
      && exercise.exerciseId === le.exerciseId
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

    // A superset exercise has only 1 set defined, but is repeated for each round.
    // So, the total number of sets to be logged is equal to the number of rounds.
    // A standard exercise's total sets is its sets.length * its rounds.
    const totalPlannedCompletions = (exercise.sets?.length ?? 0) * rounds;

    return loggedEx.sets.length >= totalPlannedCompletions;
  }

  private findFirstUnloggedSetIndex(exerciseId: string, plannedSetIds: string[]): number | null {
    const loggedEx = this.currentWorkoutLogExercises().find(le => le.id === exerciseId);
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

  /**
 * Checks if every exercise in a routine has all its required sets/rounds logged.
 * @param routine The planned session routine.
 * @param loggedExercises The array of currently logged exercises for the session.
 * @returns `true` if the entire workout is fully logged, otherwise `false`.
 */
  private isEntireWorkoutFullyLogged(routine: Routine, loggedExercises: LoggedWorkoutExercise[]): boolean {
    // Quick check: If the number of exercise entries doesn't match, it can't be complete.
    if (routine.exercises.length !== loggedExercises.length) {
      return false;
    }

    // Use .every() for a clean, fail-fast check. It will stop as soon as it finds an incomplete exercise.
    return routine.exercises.every(plannedExercise => {
      const loggedExercise = loggedExercises.find(log => log.id === plannedExercise.id);

      // If a planned exercise has no corresponding log entry, the workout is not complete.
      if (!loggedExercise) {
        return false;
      }

      // Calculate the total number of sets that *should* have been completed for this exercise, including all rounds.
      const totalPlannedCompletions = (plannedExercise.sets?.length ?? 0) * (plannedExercise.rounds ?? 1);

      // The workout is only complete if the number of logged sets is equal to or greater than the plan.
      return loggedExercise.sets.length >= totalPlannedCompletions;
    });
  }


  private async prepareCurrentSet(): Promise<void> {
    this.showNotes.set(false);
    console.log('prepareCurrentSet: START');
    if (this.sessionState() === SessionState.Paused) {
      console.log("prepareCurrentSet: Session is paused, deferring preparation");
      return;
    }

    const sessionRoutine = this.routine();
    if (!sessionRoutine || sessionRoutine.exercises.length === 0) {
      console.warn('prepareCurrentSet: No sessionRoutine or no exercises in routine. Current routine:', sessionRoutine);
      this.sessionState.set(SessionState.Error);
      this.toastService.error("Cannot prepare set: Routine data is missing or empty", 0, "Error");
      return;
    }

    let exIndex = this.currentExerciseIndex();
    let sIndex = this.currentSetIndex();

    console.log(`prepareCurrentSet: Initial target - exIndex: ${exIndex}, sIndex: ${sIndex}, sessionStatus: ${sessionRoutine.exercises[exIndex]?.sessionStatus}`);

    if (sessionRoutine.exercises[exIndex]?.sessionStatus !== 'pending') {
      console.log(`prepareCurrentSet: Initial target Ex ${exIndex} (name: ${sessionRoutine.exercises[exIndex]?.exerciseName}) is ${sessionRoutine.exercises[exIndex]?.sessionStatus}. Finding first 'pending'`);
      const firstPendingInfo = this.findFirstPendingExerciseAndSet(sessionRoutine);

      if (firstPendingInfo) {
        exIndex = firstPendingInfo.exerciseIndex;
        sIndex = firstPendingInfo.setIndex;
        this.currentExerciseIndex.set(exIndex);
        this.currentSetIndex.set(sIndex);
        this.isPerformingDeferredExercise = false; // Reset if we had to find a new starting point
        console.log(`prepareCurrentSet: Found first pending - exIndex: ${exIndex} (name: ${sessionRoutine.exercises[exIndex]?.exerciseName}), sIndex: ${sIndex}`);
      } else {
        console.log("prepareCurrentSet: No 'pending' exercises found in the entire routine. Proceeding to deferred/finish evaluation");
        this.exercisesProposedThisCycle = { doLater: false, skipped: false };
        await this.tryProceedToDeferredExercisesOrFinish(sessionRoutine);
        return;
      }
    }

    if (exIndex >= sessionRoutine.exercises.length || !sessionRoutine.exercises[exIndex] || sIndex >= sessionRoutine.exercises[exIndex].sets.length || !sessionRoutine.exercises[exIndex].sets[sIndex]) {
      // This condition is often met when a workout is completed and then resumed.
      // Instead of throwing a critical error, we treat it as the end of the planned workout
      // and transition to the finish/deferred exercises flow.
      console.warn(`prepareCurrentSet: Indices [ex: ${exIndex}, set: ${sIndex}] are out of bounds. This is expected for a completed session. Transitioning to finish flow`);

      // Perform cleanup to ensure a clean state before the next step.
      this.currentSetForm.reset({ rpe: null, setNotes: '' });
      this.resetTimedSet();
      this.currentBaseExercise.set(null);
      this.exercisePBs.set([]);
      this.lastPerformanceForCurrentExercise = null;
      this.rpeValue.set(null);
      this.showRpeSlider.set(false);

      // Gracefully guide the user to the next logical step.
      await this.tryProceedToDeferredExercisesOrFinish(sessionRoutine);

      // Stop further execution of prepareCurrentSet.
      return;
    }

    let exercisesComplete = false;
    if (sessionRoutine.exercises.length === this.currentWorkoutLogExercises().length) {
      exercisesComplete = true;
    }
    sessionRoutine.exercises.forEach(exercise => {
      const loggedExercise = this.currentWorkoutLogExercises().find(ex => ex.id === exercise.id);
      if (!exercisesComplete && loggedExercise && exercise.sets.length === loggedExercise.sets.length) {
        exercisesComplete = true;
      }
    })


    const currentExerciseData = sessionRoutine.exercises[exIndex];
    const currentPlannedSetData = currentExerciseData.sets[sIndex]; // Use direct sIndex after validation

    console.log(`prepareCurrentSet: Preparing for Ex: "${currentExerciseData.exerciseName}", Set: ${sIndex + 1}, Type: ${currentPlannedSetData.type}`);

    // Step 1: Get the planned set data from the original routine template.
    const originalExerciseForSuggestions = this.originalRoutineSnapshot.find(oe => oe.exerciseId === currentExerciseData.exerciseId) || currentExerciseData;
    const plannedSetForSuggestions = originalExerciseForSuggestions?.sets[sIndex] || currentPlannedSetData;

    this.loadBaseExerciseAndPBs(currentExerciseData.exerciseId);

    // Step 2: Fetch the complete workout log from the last time this exercise was performed.
    if (!this.lastPerformanceForCurrentExercise || this.lastPerformanceForCurrentExercise.sets[0]?.exerciseId !== currentExerciseData.exerciseId) {
      this.lastPerformanceForCurrentExercise = await firstValueFrom(this.trackingService.getLastPerformanceForExercise(currentExerciseData.exerciseId).pipe(take(1)));
    }

    // Step 3: Find the specific set from the last session that corresponds to the set we are about to do now (e.g., the 2nd set of the exercise).
    const historicalSetPerformance = this.trackingService.findPreviousSetPerformance(this.lastPerformanceForCurrentExercise, plannedSetForSuggestions, sIndex);
    let finalSetParamsForSession: ExerciseSetParams;
    if (plannedSetForSuggestions.type === 'warmup') {
      // For warm-up sets, we don't apply progressive overload. We just use the planned values.
      finalSetParamsForSession = { ...plannedSetForSuggestions };
    } else {
      // Step 4: Call the service to calculate the suggested parameters for the new set.
      // It takes the historical performance, the original plan for today, and the routine's goal to make a suggestion.
      const progressiveOverloadSettings = this.progressiveOverloadService.getSettings();
      if (progressiveOverloadSettings && progressiveOverloadSettings.enabled) {
        finalSetParamsForSession = this.workoutService.suggestNextSetParameters(historicalSetPerformance, plannedSetForSuggestions);
      } else {
        console.warn("prepareCurrentSet: Progressive overload settings are not available. Using default suggestion logic.");
        // Fallback to historicalSetPerformance or default suggestion logic if settings are not available
        if (historicalSetPerformance) {
          // use historicalSetPerformance
          finalSetParamsForSession = {
            ...plannedSetForSuggestions,
            reps: historicalSetPerformance.repsAchieved || plannedSetForSuggestions.reps || 0,
            weight: historicalSetPerformance.weightUsed || plannedSetForSuggestions.weight || 0,
            duration: historicalSetPerformance.durationPerformed || plannedSetForSuggestions.duration || 0,
            restAfterSet: plannedSetForSuggestions.restAfterSet || 0
          };
        } else {
          finalSetParamsForSession = {
            ...plannedSetForSuggestions,
            reps: plannedSetForSuggestions.reps || 0,
            weight: plannedSetForSuggestions.weight || 0,
            duration: plannedSetForSuggestions.duration || 0,
            restAfterSet: plannedSetForSuggestions.restAfterSet || 0
          };
        }
      }
    }

    // Step 5: Ensure the unique ID and type from the current session's plan are preserved.
    finalSetParamsForSession.id = currentPlannedSetData.id; // Ensure ID from current routine set is used
    finalSetParamsForSession.type = currentPlannedSetData.type;
    finalSetParamsForSession.notes = currentPlannedSetData.notes || finalSetParamsForSession.notes;

    // Step 6: Update the live routine signal with the newly suggested set parameters.
    const updatedRoutineForSession = JSON.parse(JSON.stringify(sessionRoutine)) as Routine;

    // suggest updated values only if it's not a timed exercise
    if (!updatedRoutineForSession.exercises[exIndex].sets?.some(set => set.duration)) {
      updatedRoutineForSession.exercises[exIndex].sets[sIndex] = finalSetParamsForSession;
    }
    this.routine.set(updatedRoutineForSession); // Update the routine signal

    // Step 7: Update the form controls (the input boxes for reps/weight) to display the new suggested values.
    this.patchActualsFormBasedOnSessionTargets(); // This uses activeSetInfo() which depends on routine()

    // Pre-set timer logic...
    const enablePresetRest = this.appSettingsService.enablePresetTimer();
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
        if (this.isExerciseFullyLogged(sessionRoutine.exercises[prevPlayedExIndex]) ||
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


    const shouldRunPresetTimer = enablePresetRest && presetDurationValue > 0 &&
      ((this.playerSubState() !== PlayerSubState.Resting));

    if (shouldRunPresetTimer) {
      console.log('prepareCurrentSet: Starting pre-set timer for:', currentExerciseData.exerciseName, 'Set:', sIndex + 1);
      this.playerSubState.set(PlayerSubState.PresetCountdown);
      // Ensure activeSetInfo() is valid before passing to startPresetTimer
      const activeInfoForPreset = this.activeSetInfo();
      if (activeInfoForPreset) {
        this.startPresetTimer(presetDurationValue, activeInfoForPreset);
      } else {
        console.error("prepareCurrentSet: ActiveSetInfo is null before starting preset timer. Aborting preset");
        this.playerSubState.set(PlayerSubState.PerformingSet);
      }
    } else {
      console.log('prepareCurrentSet: No pre-set timer, setting to PerformingSet for:', currentExerciseData.exerciseName, 'Set:', sIndex + 1);
      this.playerSubState.set(PlayerSubState.PerformingSet);
    }

    if (this.sessionState() !== SessionState.Playing && this.sessionState() !== SessionState.Paused) {
      console.log("prepareCurrentSet: Setting sessionState to Playing");
      this.sessionState.set(SessionState.Playing);
    }
    console.log('prepareCurrentSet: END');
  }


  private findFirstPendingExerciseAndSet(routine: Routine): { exerciseIndex: number; setIndex: number } | null {
    if (!routine || !routine.exercises) return null;
    for (let i = 0; i < routine.exercises.length; i++) {
      const exercise = routine.exercises[i];
      if (exercise.sessionStatus === 'pending' && exercise.sets && exercise.sets.length > 0) {
        const firstUnloggedSetIdx = this.findFirstUnloggedSetIndex(exercise.id, exercise.sets.map(s => s.id)) ?? 0;
        // Ensure firstUnloggedSetIdx is valid
        if (firstUnloggedSetIdx < exercise.sets.length) {
          return { exerciseIndex: i, setIndex: firstUnloggedSetIdx };
        } else {
          // This case means all sets are logged, but exercise is still 'pending' - shouldn't happen if logic is correct elsewhere.
          // Or exercise has sets but findFirstUnloggedSetIndex returned null unexpectedly.
          console.warn(`Exercise ${exercise.exerciseName} is pending, but all sets appear logged or index is invalid`);
          // To be safe, we could mark it as non-pending here or let outer logic handle it.
          // For now, just continue searching.
        }
      }
    }
    return null;
  }


  private patchActualsFormBasedOnSessionTargets(): void {
    if (this.sessionState() === SessionState.Paused) {
      console.log("patchActualsFormBasedOnSessionTargets: Session is paused, deferring preparation");
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

  async editRepsWithPrompt(): Promise<void> {
    if (this.getDisabled() || this.playerSubState() !== PlayerSubState.PerformingSet) {
      this.toastService.warning("Cannot edit reps now", 2000);
      return;
    }
    const activeInfo = this.activeSetInfo();
    if (!activeInfo) return;

    const currentReps = this.csf['actualReps'].value;
    const promptResult = await this.alertService.showPromptDialog(
      'Enter Reps',
      ``,
      [{
        name: 'newReps',
        type: 'number',
        placeholder: `Current: ${currentReps ?? '0'}`,
        value: currentReps ?? undefined,
        autofocus: true,
        attributes: { step: 0.5, min: '0', inputmode: 'decimal' }
      }] as AlertInput[],
      'Set Reps'
    );

    if (promptResult && promptResult['newReps'] !== undefined && promptResult['newReps'] !== null) {
      const newRepsValue = parseFloat(String(promptResult['newReps']));
      if (!isNaN(newRepsValue) && newRepsValue >= 0) {
        this.currentSetForm.patchValue({ actualReps: newRepsValue });
      } else {
        this.toastService.error('Invalid reps entered', 3000, 'Error');
      }
    }
  }

  async editWeightWithPrompt(): Promise<void> {
    if (this.getDisabled() || this.playerSubState() !== PlayerSubState.PerformingSet) {
      this.toastService.warning("Cannot edit weight now", 2000);
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
        autofocus: true,
        placeholder: `Current: ${currentWeight ?? '0'} ${this.weightUnitDisplaySymbol}`,
        value: currentWeight ?? undefined,
        attributes: { step: 0.5, min: '0', inputmode: 'decimal' }
        // attributes: { step: this.appSettingsService.weightStep(), min: '0', inputmode: 'decimal' }
      }] as AlertInput[],
      'Set Weight'
    );

    if (promptResult && promptResult['newWeight'] !== undefined && promptResult['newWeight'] !== null) {
      const newWeightValue = parseFloat(String(promptResult['newWeight']));
      if (!isNaN(newWeightValue) && newWeightValue >= 0) {
        this.currentSetForm.patchValue({ actualWeight: newWeightValue });
      } else {
        this.toastService.error('Invalid weight entered', 3000, 'Error');
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
    if (!activeInfo || !currentRoutineValue) { this.toastService.error("Cannot log set: data unavailable", 0); return; }

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
      this.toastService.error(`Please correct input: ${firstInvalidControl ? firstInvalidControl + ' is invalid' : 'form invalid'}`, 0, 'Validation Error');
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
      id: uuidv4(),
      exerciseName: activeInfo.exerciseData.exerciseName,
      // For Tabata, combine plannedSetId and round to make it unique per pass
      plannedSetId: this.isTabataMode() || (activeInfo.exerciseData && activeInfo.exerciseData.supersetId)
        ? `${activeInfo.setData.id}-round-${this.getIndexedCurrentBlock()}`
        : activeInfo.setData.id,
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
      targetRestAfterSet: activeInfo.setData.restAfterSet,
      notes: formValues.setNotes?.trim() || undefined,
      timestamp: new Date().toISOString(),
      supersetCurrentRound: this.checkIfSetIsPartOfRounds() || this.isTabataMode() ? this.getIndexedCurrentBlock() : 0
      // Add a specific field for Tabata round
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

    if (!this.isTabataMode()) { // Don't navigate if in Tabata mode, nextTabataInterval handles it
      this.navigateToNextStepInWorkout(activeInfo, currentRoutineValue);
    }
  }

  getIndexedCurrentBlock(): number {
    return (this.currentBlockRound() ?? 1) - 1;
  }

  // NEW HELPER METHOD (Updated) - This needs to also set the totalBlockRounds
  private setPlayerStateFromTabataIndex(tabataIndex: number): void {
    this.currentTabataIntervalIndex.set(tabataIndex);

    // Use the map to find the corresponding standard player indices
    const mappedIndices = this.tabataIntervalMap[tabataIndex];
    if (mappedIndices) {
      const [exerciseIndex, setIndex, round] = mappedIndices;
      this.currentExerciseIndex.set(exerciseIndex);
      this.currentSetIndex.set(setIndex);
      this.currentBlockRound.set(round);

      // Also update the total rounds for the current block for the UI
      if (this.routine()) {
        this.totalBlockRounds.set(this.getRoundsForExerciseBlock(exerciseIndex, this.routine()!));
      }

      console.log(`Tabata Sync: Interval ${tabataIndex} maps to Ex ${exerciseIndex}, Set ${setIndex}, Round ${round}`);
    } else {
      // Fallback for the end of the workout
      const lastValidMap = this.tabataIntervalMap[this.tabataIntervalMap.length - 1];
      if (lastValidMap) {
        const [lastEx, lastSet, lastRound] = lastValidMap;
        this.currentExerciseIndex.set(lastEx);
        this.currentSetIndex.set(lastSet);
        this.currentBlockRound.set(lastRound);
        if (this.routine()) {
          this.totalBlockRounds.set(this.getRoundsForExerciseBlock(lastEx, this.routine()!));
        }
      }
    }
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

  // Helper to get round info for an exercise (handles supersets)
  protected getRoundInfo(ex: WorkoutExercise): { round: number, totalRounds: number } {
    let totalRounds = ex.rounds ?? 1;
    if (ex.supersetId && ex.supersetOrder !== null) {
      const blockStart = this.routine()?.exercises.find(e => e.supersetId === ex.supersetId && e.supersetOrder === 0);
      totalRounds = blockStart?.rounds ?? 1;
    }
    // Use currentBlockRound signal for current, otherwise 1
    const round = this.currentBlockRound ? this.currentBlockRound() : 1;
    return { round, totalRounds };
  };

  getCurrentUpText(): string {
    const activeInfo = this.activeSetInfo();

    // If there's no active set information, return a default string.
    if (!activeInfo) {
      return 'Current Exercise';
    }

    const { exerciseData, setIndex, type } = activeInfo;
    const exerciseName = exerciseData.exerciseName || 'Unnamed Exercise';

    let setTypeLabel: string;
    let currentSetOfType: number;
    let totalSetsOfType: number;

    // Differentiate between warm-up and working sets for accurate numbering.
    if (type === 'warmup') {
      setTypeLabel = 'Warm-up';
      currentSetOfType = this.getWarmupSetNumberForDisplay(exerciseData, setIndex);
      totalSetsOfType = this.getTotalWarmupSetsForExercise(exerciseData);
    } else {
      setTypeLabel = 'Set';
      currentSetOfType = this.getWorkingSetNumberForDisplay(exerciseData, setIndex);
      totalSetsOfType = this.getWorkingSetCountForExercise(exerciseData);
    }

    // Get round information, which handles supersets correctly.
    const { round, totalRounds } = this.getRoundInfo(exerciseData);
    const roundText = totalRounds > 1 ? ` (Round ${round}/${totalRounds})` : '';
    // get weight and duration info, if available
    const weight = activeInfo.setData.weight ? `, ${activeInfo.setData.weight} ${this.weightUnitDisplaySymbol}` : '';
    const duration = activeInfo.setData.duration ? `, ${activeInfo.setData.duration} seconds` : '';

    // Construct the final descriptive string.
    return `${setTypeLabel} ${currentSetOfType}/${totalSetsOfType} of ${exerciseName}${roundText}${weight}${duration}`;
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
        const { round, totalRounds } = this.getRoundInfo(currExercise);
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
          const { round, totalRounds } = this.getRoundInfo(ex);
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

    const { round, totalRounds } = this.getRoundInfo(currExercise);

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
      this.toastService.warning("Session is paused. Resume to skip rest", 3000, "Paused");
      return;
    }
    if (this.isRestTimerVisible() || this.playerSubState() === PlayerSubState.Resting) {
      this.handleRestTimerSkipped(null);
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

    // --- NEW: Check if the resumed session is already fully logged ---
    if (this.isEntireWorkoutFullyLogged(state.sessionRoutine, state.currentWorkoutLogExercises)) {
      console.log("Paused session is already fully logged. Transitioning directly to finish flow");
      this.sessionState.set(SessionState.End); // Set state to prevent other actions
      await this.tryProceedToDeferredExercisesOrFinish(state.sessionRoutine);
      return; // Stop further execution of this method
    }
    // --- END NEW CHECK ---

    // --- NEW: TABATA RESUME LOGIC ---
    if (state.isTabataMode) {
      console.log("Resuming a paused Tabata session");

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
      this.toastService.success('Tabata session resumed', 3000, "Resumed");
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
    await this.prepareCurrentSet();
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
    this.toastService.success('Workout session resumed', 3000, "Resumed");
  }

  private savePausedSessionState(): void {
    if (this.sessionState() === SessionState.End) {
      this.stopAllActivity();
      return;
    }
    const currentRoutine = this.routine();
    if (!currentRoutine) {
      console.warn("Cannot save paused state: routine data is not available");
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
    console.log('Paused session state saved', stateToSave);
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
    console.log('Session state attempt saved via beforeunload');
  }

  async addWarmupSet(): Promise<void> {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Resume to add warm-up", 3000, "Paused"); return;
    }
    const currentRoutineVal = this.routine(); const activeInfo = this.activeSetInfo();
    if (!currentRoutineVal || !activeInfo) {
      this.toastService.error("Cannot add warm-up: data unavailable", 0, "Error"); return;
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
      this.toastService.success("Warm-up set added as a separate exercise before superset", 4000, "Warm-up Added");
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
    this.toastService.success("Warm-up set added. Fill details & complete", 4000, "Warm-up Added");
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
    if (this.sessionState() === 'paused') { this.toastService.warning("Session is paused. Resume to skip set", 3000, "Paused"); return; }
    const activeInfo = this.activeSetInfo(); const currentRoutineVal = this.routine();
    if (!activeInfo || !currentRoutineVal) { this.toastService.error("Cannot skip set: No active set information", 0, "Error"); return; }

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
      const confirm = await this.alertService.showConfirm("Skip Current Set", `Skip current ${activeInfo.type === 'warmup' ? 'warm-up' : 'set ' + this.getCurrentWorkingSetNumber()} of "${activeInfo.exerciseData.exerciseName}"? It won't be logged`);
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
      this.toastService.error("Cannot update exercise status: data unavailable", 0, "Error"); return;
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
        console.log(`markCurrentExerciseStatus: Re-marking a deferred exercise (${exName}) as ${status}. Re-evaluating all deferred`);
        this.isPerformingDeferredExercise = false;
        this.lastActivatedDeferredExerciseId = null;
        this.exercisesProposedThisCycle = { doLater: false, skipped: false }; // Fresh proposal cycle
        await this.tryProceedToDeferredExercisesOrFinish(updatedRoutine);
      } else {
        // This was a main sequence exercise being marked, or some other edge case.
        // Use navigateToNextStepInWorkout to find the next *main sequence* pending item.
        console.log(`markCurrentExerciseStatus: Marking main sequence exercise (${exName}) as ${status}. Advancing`);
        await this.navigateToNextStepInWorkout(activeInfo, updatedRoutine, true /* forceAdvanceExerciseBlock */);
      }
    }
    this.closeWorkoutMenu();
    this.closePerformanceInsights(); // Close insights if open
  }




  // Replaces the old addCustomExercise, now it opens the modal first
  async addExerciseDuringSession(): Promise<void> {
    if (this.sessionState() === 'paused') {
      this.toastService.warning("Session is paused. Resume to add exercise", 3000, "Paused");
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
      this.toastService.error("Cannot add exercise: routine data unavailable", 0, "Error"); return;
    }

    // check wheter has been done at least on exercise before this one
    const hasPreviousExercises = this.currentWorkoutLogExercises().length > 0;
    const kbRelated = hasPreviousExercises && selectedExercise.category === 'kettlebells';
    // if so and it's a kettlebell related exercise, it will suggest same weight and reps as the last one
    const lastEx = this.currentWorkoutLogExercises().length > 0 ? this.currentWorkoutLogExercises()[this.currentWorkoutLogExercises().length - 1] : null;
    const lastExSet = lastEx ? lastEx.sets[lastEx.sets.length - 1] : null;

    const isCardioOnly = selectedExercise.category === 'cardio';
    const defaultWeight = kbRelated && lastExSet ? (lastExSet.targetWeight || lastExSet.weightUsed) : (this.unitService.currentUnit() === 'kg' ? 10 : 22.2);
    const defaultDuration = isCardioOnly ? 60 : 0;
    const defaultRest = kbRelated ? 45 : 60;
    const defaultReps = kbRelated && lastExSet ? (lastExSet.targetReps || lastExSet.repsAchieved) : 10;
    const defaultSets = 3;

    const exerciseParams: AlertInput[] = isCardioOnly
      ? [
        { label: 'Exercise name', name: 'name', type: 'text', placeholder: 'Exercise name', value: selectedExercise.name, attributes: { required: true } },
        { label: 'Number of Sets', name: 'numSets', type: 'number', placeholder: 'Number of Sets (e.g., 3)', value: defaultSets, attributes: { min: 1, required: true } },
        { label: 'Target weight', name: 'weight', type: 'number', placeholder: 'e.g., 10', value: defaultWeight, attributes: { min: 0, required: true } },
        { label: 'Target duration', name: 'duration', type: 'number', placeholder: 'e.g., 30 secs', value: defaultDuration, attributes: { min: 0, required: false } },
        { label: 'Rest between sets', name: 'rest', type: 'number', placeholder: 'e.g., 60', value: defaultRest, attributes: { min: 1, required: true } }
      ]
      : [
        { label: 'Exercise name', name: 'name', type: 'text', placeholder: 'Exercise name', value: selectedExercise.name, attributes: { required: true } },
        { label: 'Number of Reps', name: 'numReps', type: 'number', placeholder: 'Number of Reps (e.g., 10)', value: defaultReps, attributes: { min: 0, required: true } },
        { label: 'Number of Sets', name: 'numSets', type: 'number', placeholder: 'Number of Sets (e.g., 3)', value: defaultSets, attributes: { min: 1, required: true } },
        { label: 'Target weight', name: 'weight', type: 'number', placeholder: 'e.g., 10', value: defaultWeight, attributes: { min: 0, required: true } },
        { label: 'Target duration', name: 'duration', type: 'number', placeholder: 'e.g., 30 secs', value: defaultDuration, attributes: { min: 0, required: false } },
        { label: 'Rest between sets', name: 'rest', type: 'number', placeholder: 'e.g., 60', value: defaultRest, attributes: { min: 1, required: true } }
      ];

    const exerciseData = await this.alertService.showPromptDialog(
      `Add ${selectedExercise.name}`,
      '',
      exerciseParams
    );

    if (exerciseData) {
      const exerciseName = exerciseData['name'];
      const numSets = isNaN(parseInt(String(exerciseData['numSets']))) ? defaultSets : parseInt(String(exerciseData['numSets']));
      const numReps = isNaN(parseInt(String(exerciseData['numReps']))) ? defaultReps : parseInt(String(exerciseData['numReps']));
      const weight = isNaN(parseInt(String(exerciseData['weight']))) ? defaultWeight : parseInt(String(exerciseData['weight']));
      const duration = isNaN(parseInt(String(exerciseData['duration']))) ? defaultDuration : parseInt(String(exerciseData['duration']));
      const rest = isNaN(parseInt(String(exerciseData['rest']))) ? defaultRest : parseInt(String(exerciseData['rest']));

      if (!exerciseName || (numSets === null || numSets === undefined || isNaN(numSets)) ||
        (numReps === null || numReps === undefined || isNaN(numReps)) ||
        (duration === null || duration === undefined || isNaN(duration)) ||
        (weight === null || weight === undefined || isNaN(weight)) ||
        (rest === null || rest === undefined || isNaN(rest))) {
        this.toastService.info("Exercise addition cancelled or invalid parameter", 2000);
        this.selectExerciseToAddFromModal(selectedExercise);
        return;
      }

      const newExerciseSets: ExerciseSetParams[] = [];
      for (let i = 0; i < numSets; i++) {
        newExerciseSets.push({
          id: `custom-set-${uuidv4()}`, // Or generate based on planned set ID if this was a template
          reps: numReps,
          weight: weight,
          duration: duration,
          restAfterSet: rest,
          type: 'standard',
          notes: ''
        });
      }

      const newWorkoutExercise: WorkoutExercise = {
        id: `custom-exercise-${uuidv4()}`, // Unique ID for this session's instance of the exercise
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

      const nexExerciseToBeSaved = this.exerciseService.mapWorkoutExerciseToExercise(newWorkoutExercise, selectedExercise);
      this.exerciseService.addExercise(nexExerciseToBeSaved)

      this.addExerciseToCurrentRoutine(newWorkoutExercise);
    }
  }

  // Called if user wants to define a completely new exercise not in the library
  async handleTrulyCustomExerciseEntry(): Promise<void> {
    this.closeExerciseSelectionModal();
    const currentRoutineVal = this.routine();
    if (!currentRoutineVal) { return; }
    const newWorkoutExercise: Exercise = {
      id: `custom-adhoc-ex-${uuidv4()}`,
      name: 'Custom exercise',
      description: '', category: 'bodyweight/calisthenics', muscleGroups: [], primaryMuscleGroup: '', imageUrls: []
    };
    this.selectExerciseToAddFromModal(newWorkoutExercise);
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
        if (this.isEndReached()) {
          await this.alertService.showAlert("Exercise Added", `"${newWorkoutExercise.exerciseName}" added`);
          goToNewEx = { data: true };
          this.isEndReached.set(false);
        }
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

  async finishWorkoutEarly(): Promise<void> {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Please resume before finishing early", 3000, "Paused");
      return;
    }
    const confirmFinishEarly = await this.alertService.showConfirm(
      "Finish Workout Early",
      "Finish workout now? Current progress will be saved"
    );
    if (confirmFinishEarly && confirmFinishEarly.data) {
      this.closeWorkoutMenu();
      this.closePerformanceInsights();
      const didLog = await this.finishWorkoutAndReportStatus();
      if (!didLog) {
        this.toastService.info("Workout finished early. Paused session cleared", 4000);
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


  // check for invalid workout timing
  async checkWorkoutTimingValidity(workoutLog: Omit<WorkoutLog, 'id'>): Promise<Omit<WorkoutLog, 'id'>> {
    if (this.workoutStartTime <= 0) {
      // try to estimate from the first logged set time
      const firstLoggedSetTime = this.currentWorkoutLogExercises()[0]?.sets[0]?.timestamp;
      if (firstLoggedSetTime) {
        workoutLog.startTime = new Date(firstLoggedSetTime).getTime();
      } else {
        workoutLog.startTime = new Date().getTime();
      }
      // try to estimate end time from the last logged set time
      const lastLoggedSetTime = this.currentWorkoutLogExercises().slice(-1)[0]?.sets.slice(-1)[0]?.timestamp;
      if (lastLoggedSetTime) {
        workoutLog.endTime = new Date(lastLoggedSetTime).getTime();
      } else {
        if (this.routine() !== undefined && this.routine() !== null) {
          const routineValue = this.routine();
          if (routineValue) {
            const routine: Routine = routineValue;
            const endingTime = this.workoutService.getEstimatedRoutineDuration(routine);
            workoutLog.endTime = endingTime;
          }
        }
        workoutLog.endTime = new Date().getTime();
      }
      const durationMinutes = Math.round((workoutLog.endTime - workoutLog.startTime) / (1000 * 60));
      const durationSeconds = Math.round((workoutLog.endTime - workoutLog.startTime) / (1000));
      workoutLog.durationMinutes = durationMinutes;
      workoutLog.durationSeconds = durationSeconds;
      workoutLog.date = format(new Date(workoutLog.startTime), 'yyyy-MM-dd'),
        await this.alertService.showAlert("Workout Timing Adjusted",
          `Workout start time was not set. Estimated start time is ${format(new Date(workoutLog.startTime), 'MMM d, HH:mm')}. ` +
          `Estimated end time is ${format(new Date(workoutLog.endTime), 'MMM d, HH:mm')}. Duration: ${durationMinutes} minutes (${durationSeconds} seconds).`
        )

    }
    return workoutLog;
  }

  async finishWorkoutAndReportStatus(): Promise<boolean> {
    this.stopAutoSave();
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Please resume workout before finishing", 3000, "Session Paused");
      // If user tries to finish while paused, maybe offer to resume or just return false
      // For now, let's assume they need to resume via the resume button first.
      return false; // Did not log
    }
    if (this.sessionState() === SessionState.Loading) {
      this.toastService.info("Workout is still loading", 3000, "Loading");
      return false; // Did not log
    }
    const loggedExercisesForReport = this.currentWorkoutLogExercises().filter(ex => ex.sets.length > 0);
    // const loggedExercisesForReport = this.routine()?.exercises.map(ex => this.mapWorkoutExerciseToLoggedWorkoutExercise(ex));

    if (loggedExercisesForReport === undefined || loggedExercisesForReport.length === 0) {
      return false
    }

    if (loggedExercisesForReport.length === 0) {
      this.toastService.info("No sets logged. Workout not saved", 3000, "Empty Workout");
      this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
      if (this.router.url.includes('/play')) {
        this.router.navigate(['/workout']);
      }
      return false;
    }
    if (this.timerSub) this.timerSub.unsubscribe();

    const sessionRoutineValue = this.routine();
    const sessionProgramValue = this.program();
    let proceedToLog = true;
    let logAsNewRoutine = false;
    let updateOriginalRoutineStructure = false;
    let newRoutineName = sessionRoutineValue?.name ? `${sessionRoutineValue.name} - ${format(new Date(), 'MMM d')}` : `Ad-hoc Workout - ${format(new Date(), 'MMM d, HH:mm')}`;

    // I have to be sure that the original routine snapshot is available, in case of reloading the page or something else
    const routineExists = this.routineId && this.routineId !== '-1' && this.routineId !== null;
    if (!this.originalRoutineSnapshot || this.originalRoutineSnapshot.length === 0 && routineExists) {
      // try to retrieve the original routine snapshot from the storage
      const routineId = this.routineId;
      if (this.routineId) {
        const routineId: string = this.routineId;
        const routineResult = await firstValueFrom(this.workoutService.getRoutineById(routineId).pipe(take(1)));
        if (routineResult && routineResult.exercises && routineResult.exercises.length > 0) {
          this.originalRoutineSnapshot = JSON.parse(JSON.stringify(routineResult.exercises));
        }
      }
      if (!this.originalRoutineSnapshot || this.originalRoutineSnapshot.length === 0) {
        this.originalRoutineSnapshot = [];
      }



    }

    const originalSnapshotToCompare = this.originalRoutineSnapshot.filter(origEx =>
      // Only compare against original exercises that were not marked 'skipped' or 'do_later' unless they were actually logged
      sessionRoutineValue?.exercises.find(sessEx => sessEx.id === origEx.id && sessEx.sessionStatus === 'pending') ||
      loggedExercisesForReport.some(logEx => logEx.exerciseId === origEx.exerciseId)
    );


    if (this.routineId && this.originalRoutineSnapshot && this.originalRoutineSnapshot.length > 0 && sessionRoutineValue) {
      const differences = this.comparePerformedToOriginal(loggedExercisesForReport, originalSnapshotToCompare);
      if (differences.majorDifference) {
        console.log("Major differences", differences.details)
        // Show a confirmation dialog with details of the differences

        const confirmation = await this.alertService.showConfirmationDialog(
          "Routine Structure Changed",
          `You made some changes to the routine structure. What would you like to do?`,
          [
            { text: "Just log", role: "log", data: "log", cssClass: "bg-purple-600", icon: 'schedule' } as AlertButton,
            { text: "Update Original Routine and log", role: "destructive", data: "update", cssClass: "bg-blue-600", icon: 'save' } as AlertButton,
            { text: "Save as New Routine", role: "confirm", data: "new", cssClass: "bg-green-600", icon: 'create-folder' } as AlertButton,
            // { text: "Cancel", role: "cancel", data: false, cssClass: "bg-red-600", icon: 'cancel' } as AlertButton
          ],
          // Pass the details array directly to the new property
          { listItems: differences.details }
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
            "Save Routine",
            'CANCEL',
            [
              { text: "Save Routine", role: "confirm", data: true, cssClass: "bg-green-600", icon:'save'} as AlertButton
            ]
          );
          if (nameInput && String(nameInput['newRoutineName']).trim()) {
            newRoutineName = String(nameInput['newRoutineName']).trim();
            logAsNewRoutine = true;
          } else {
            proceedToLog = false;
          }
        } else if (confirmation && confirmation.data === 'update') {
          updateOriginalRoutineStructure = true;
        } else if (confirmation && confirmation.data === 'log') {
          updateOriginalRoutineStructure = false;
          proceedToLog = true;
        } else {
          proceedToLog = false;
        }
      }
    } else if ((!this.routineId || this.routineId == '-1') && loggedExercisesForReport.length > 0) { // Ad-hoc
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
        "Create new Routine and log",
        'CANCEL',
        [
          // do not save as new routine button
          { text: "Just log", role: "no_save", data: "cancel", cssClass: "bg-red-600" } as AlertButton
        ]
      );
      if (nameInput && nameInput['newRoutineName'] && String(nameInput['newRoutineName']).trim()) {
        newRoutineName = String(nameInput['newRoutineName']).trim();
      }
      else {
        proceedToLog = false;
        if (nameInput && nameInput['role'] === 'no_save') {
          proceedToLog = true;
          logAsNewRoutine = false;
          this.toastService.info("New corresponding routine has not been created. Log saved", 3000, "Log saved", false);
        }
      }
    }

    if (!proceedToLog) {
      this.toastService.info("Finish workout cancelled. Session remains active/paused", 3000, "Cancelled");
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
      programId: sessionProgramValue,
    };

    const fixedLog = await this.checkWorkoutTimingValidity(finalLog); // Ensure start time is valid before proceeding
    const savedLog = this.trackingService.addWorkoutLog(fixedLog);

    // +++ START: NEW PROGRAM COMPLETION CHECK +++
    if (savedLog.programId) {
      try {
        const isProgramCompleted = await this.trainingProgramService.checkAndHandleProgramCompletion(savedLog.programId, savedLog);

        if (isProgramCompleted) {
          this.toastService.success(`Congrats! Program completed!`, 5000, "Program Finished", false);

          // Stop all player activity before navigating
          this.stopAllActivity();
          this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);

          // Navigate to the new completion page with relevant IDs
          this.router.navigate(['/training-programs/completed', savedLog.programId], {
            queryParams: { logId: savedLog.id }
          });

          return true; // Exit the function as we've handled navigation
        }
      } catch (error) {
        console.error("Error during program completion check:", error);
        // Continue with normal workout summary flow even if the check fails
      }
    }
    // +++ END: NEW PROGRAM COMPLETION CHECK +++

    if (!this.isTabataMode()) {
      this.toastService.success(`Congrats! Workout completed!`, 5000, "Workout Finished", false);
    } else {
      this.toastService.success("Tabata Workout Complete!", 5000, "Workout Finished", false);
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

    this.stopAllActivity();
    this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
    this.router.navigate(['/workout/summary', savedLog.id]);
    return true;
  }

  async quitWorkout(): Promise<void> {
    const confirmQuit = await this.alertService.showConfirm("Quit Workout", 'Quit workout? Unsaved progress (if not paused) will be lost');
    if (confirmQuit && confirmQuit.data) {
      this.stopAllActivity();
      this.isSessionConcluded = true;
      this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
      this.closeWorkoutMenu();
      this.closePerformanceInsights();
      this.router.navigate(['/workout']);
      this.toastService.info("Workout quit. No progress saved for this session", 4000);
    }
  }

  toggleCompletedSetsInfo(): void { this.showCompletedSetsInfo.update(v => !v); }
  openPerformanceInsights(): void {
    if (this.sessionState() === 'paused') { this.toastService.warning("Session is paused. Resume to view insights", 3000, "Paused"); return; }
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
      this.alertService.showConfirm("Exit Workout?", "You have an active workout. Are you sure you want to exit? Your progress might be lost unless you pause first")
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

  decrementWeight(defaultStep: number = 0.5): void {
    const step = this.appSettingsService.getSettings().weightStep || defaultStep;
    const currentValue = this.csf['actualWeight'].value ?? 0;
    const newWeight = parseFloat((currentValue - step).toFixed(2)) >= 0 ? parseFloat((currentValue - step).toFixed(2)) : 0;
    this.currentSetForm.patchValue({ actualWeight: newWeight });
  }

  // Handles both touch and mouse events for press/tap/long-press detection
  private pressStartTime: number | null = null;

  private weightIncrementIntervalId: any = null;
  private weightDecrementIntervalId: any = null;

  private intervalId: any = null;

  onShortPressWeightIncrement(): void {
    this.incrementWeight();
  }
  onLongPressWeightIncrement(): void {
    this.intervalId = setInterval(() => this.incrementWeight(), 200);
  }
  onPressRelease(): void {
    // Always clear any active interval when the button is released.
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  onShortPressWeightDecrement(): void {
    this.decrementWeight();
  }
  onLongPressWeightDecrement(): void {
    this.intervalId = setInterval(() => this.decrementWeight(), 200);
  }


  onShortPressRepsIncrement(): void {
    this.incrementReps();
  }
  onLongPressRepsIncrement(): void {
    this.intervalId = setInterval(() => this.incrementReps(), 200);
  }
  onShortPressRepsDecrement(): void {
    this.decrementReps();
  }
  onLongPressRepsDecrement(): void {
    this.intervalId = setInterval(() => this.decrementReps(), 200);
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
          const targetProgramId = routeSnapshot.queryParamMap.get('programId');
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

    // +++ 1. Start the pipeline with combineLatest to get both paramMap and queryParamMap
    this.routeSub = combineLatest([
      this.route.paramMap,
      this.route.queryParamMap
    ]).pipe(
      // +++ 2. Use 'map' to create a clean object with both IDs
      map(([params, queryParams]) => {
        return {
          routineId: params.get('routineId'),
          programId: queryParams.get('programId') // This will be the ID string or null
        };
      }),

      // +++ 3. The switchMap now receives the object with both IDs
      switchMap(ids => {
        const { routineId: newRoutineId, programId } = ids; // Destructure to get both IDs
        console.log('loadNewWorkoutFromRoute - paramMap emitted, newRoutineId:', newRoutineId);
        console.log('loadNewWorkoutFromRoute - queryParamMap emitted, programId:', programId); // You have the programId here!

        if (programId) {
          this.program.set(programId);
        }

        if (!newRoutineId || newRoutineId === "-1") {
          if (newRoutineId === "-1") {
            // Special case handled in tap operator
          } else {
            this.toastService.error("No routine specified to play", 0, "Error");
            this.router.navigate(['/workout']);
            this.sessionState.set(SessionState.Error);
            return of(null);
          }
        }

        this.routineId = newRoutineId; // Assuming you still need this property for other parts of the component

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

              // +++ 4. Return an object containing BOTH the routine and the programId
              return { sessionRoutineCopy: sessionCopy, programId: programId };
            }
            console.warn('loadNewWorkoutFromRoute: No original routine found for ID:', this.routineId);
            return null; // If routine not found, the whole result will be null
          }),
          take(1) // Ensure we only take the first emission
        );
      }),

      // +++ 5. The 'tap' operator now receives the object { sessionRoutineCopy, programId } or null
      tap(async (result) => {
        // +++ 6. Handle the null case and destructure the result object
        if (!result) {
          // This block will run if the routine wasn't found in the switchMap.
          // We can check for the "-1" case here, which is cleaner.
          if (this.routineId === "-1") {
            const emptyNewRoutine = {
              name: "New session",
              createdAt: new Date().toISOString(),
              goal: 'custom',
              exercises: [] as WorkoutExercise[],
            } as Routine;
            this.routine.set(emptyNewRoutine);
            this.openExerciseSelectionModal();
          } else if (this.routineId) {
            console.error('loadNewWorkoutFromRoute - tap: Failed to load routine for ID or routine was null:', this.routineId);
            this.routine.set(null);
            this.sessionState.set(SessionState.Error);
            this.toastService.error("Failed to load workout routine", 0, "Load Error");
            if (isPlatformBrowser(this.platformId)) this.router.navigate(['/workout']);
            this.stopAutoSave();
          }
          this.isInitialLoadComplete = true;
          return; // Exit tap early
        }

        const { sessionRoutineCopy, programId } = result;

        console.log('loadNewWorkoutFromRoute - tap operator. Session routine copy:', sessionRoutineCopy.name);
        console.log('loadNewWorkoutFromRoute - tap operator. Program ID:', programId);

        // +++ You can now use the programId to set state
        // For example, if you have a signal for it:
        // this.programId.set(programId);

        // --- NEW: TABATA MODE CHECK ---
        if (sessionRoutineCopy.goal === 'tabata') {
          this.setupTabataMode(sessionRoutineCopy);
          this.startSessionTimer();
          this.isInitialLoadComplete = true;
          return;
        }
        // --- END: TABATA MODE CHECK ---

        if (this.sessionState() === SessionState.Paused) {
          console.log('loadNewWorkoutFromRoute - tap: Session is paused, skipping setup');
          this.isInitialLoadComplete = true;
          return;
        }

        // The rest of your logic uses 'sessionRoutineCopy' and remains unchanged
        this.exercisesProposedThisCycle = { doLater: false, skipped: false };
        this.isPerformingDeferredExercise = false;
        this.lastActivatedDeferredExerciseId = null;
        this.routine.set(sessionRoutineCopy);

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
          console.log("loadNewWorkoutFromRoute: Routine loaded but no initial pending exercises. Will try deferred/finish");
          this.currentExerciseIndex.set(0);
          this.currentSetIndex.set(0);
          this.totalBlockRounds.set(1);
          this.exercisesProposedThisCycle = { doLater: false, skipped: false };
          await this.tryProceedToDeferredExercisesOrFinish(sessionRoutineCopy);
          this.isInitialLoadComplete = true;
          return;
        }

        this.currentBlockRound.set(1);
        this.currentWorkoutLogExercises.set([]);
        await this.prepareCurrentSet();

        if (this.sessionState() !== SessionState.Error && this.sessionState() !== SessionState.Paused) {
          this.startSessionTimer();
          this.startAutoSave();
        }

        this.isInitialLoadComplete = true;
        console.log('loadNewWorkoutFromRoute - END tap operator. Final sessionState:', this.sessionState());
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      error: (err) => {
        console.error('loadNewWorkoutFromRoute - Error in observable pipeline:', err);
        this.routine.set(null);
        this.sessionState.set(SessionState.Error);
        this.toastService.error("Critical error loading workout", 0, "Load Error");
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
        console.log('WorkoutPlayer.checkForPausedSession - Current route is for a specific routine, but paused session was ad-hoc. Discarding paused session');
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        return false;
      }
      // 2. If current route is ad-hoc (null routineId), but paused session was for a specific routine -> discard paused
      if (!routeRoutineId && pausedState.routineId !== null) {
        console.log('WorkoutPlayer.checkForPausedSession - Current route is ad-hoc, but paused session was for a specific routine. Discarding paused session');
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        return false;
      }
      // 3. If both have routineIds, but they don't match -> discard paused
      if (routeRoutineId && pausedState.routineId && routeRoutineId !== pausedState.routineId) {
        console.log('WorkoutPlayer.checkForPausedSession - Paused session routine ID does not match current route routine ID. Discarding paused session');
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
            { text: "Resume", role: "confirm", data: true, cssClass: "bg-green-600", icon: 'play', iconClass: 'h-8 w-8 mr-1' } as AlertButton,
            { text: "Discard", role: "cancel", data: false, cssClass: "bg-red-600", icon: 'trash', iconClass: 'h-8 w-8 mr-1' } as AlertButton
          ]
        );
        shouldAttemptToLoadPausedState = !!(confirmation && confirmation.data === true);
      }

      if (shouldAttemptToLoadPausedState) {
        this.stopAllActivity();
        if (this.routeSub) this.routeSub.unsubscribe();
        await this.loadStateFromPausedSession(pausedState);
        // this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        this.isInitialLoadComplete = true;
        return true;
      } else {
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        this.toastService.info('Paused session discarded', 3000);
        return false;
      }
    }
    return false;
  }

  private stopAllActivity(): void {
    this.isSessionConcluded = true;
    console.log('stopAllActivity - Stopping timers and auto-save');
    this.stopAutoSave();
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
    if (this.tabataTimerSub) this.tabataTimerSub.unsubscribe();
    this.isRestTimerVisible.set(false);
    this.sessionState.set(SessionState.End);
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

      this.closeWorkoutMenu();
      this.closePerformanceInsights();
      this.toastService.info('Workout session resumed', 3000);
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
        console.warn('Web Audio API not supported in this browser');
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
        console.warn('Web Audio API not supported in this browser');
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
    console.log('Pre-set timer finished. Player state set to PerformingSet');
  }
  skipPresetTimer(): void {
    if (this.playerSubState() === PlayerSubState.PresetCountdown) {
      // this.toastService.info("Pre-set countdown skipped", 1500);
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
          if (!ex.supersetId || ex.supersetOrder === 0) {
            nextExIdx = i;
            if (this.getNumberOfLoggedSets(ex.id)) {
              nextSetIdx = this.getNumberOfLoggedSets(ex.id);
            }
            break;
          }
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
    return routine.exercises.filter((ex, idx) => !this.isExerciseFullyLogged(ex));
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


  private async navigateToNextStepInWorkout(
    completedActiveInfo: ActiveSetInfo,
    currentSessionRoutine: Routine,
    forceAdvanceExerciseBlock: boolean = false
  ): Promise<void> {
    const exerciseJustCompleted = completedActiveInfo.exerciseData;
    const isNowFullyLogged = this.isExerciseFullyLogged(exerciseJustCompleted);

    if (this.isPerformingDeferredExercise && exerciseJustCompleted.id === this.lastActivatedDeferredExerciseId && isNowFullyLogged) {
      console.log("navigateToNextStepInWorkout: Completed a deferred exercise. Re-evaluating all remaining");
      this.isPerformingDeferredExercise = false;
      this.lastActivatedDeferredExerciseId = null;
      this.exercisesProposedThisCycle = { doLater: false, skipped: false };
      await this.tryProceedToDeferredExercisesOrFinish(currentSessionRoutine);
      return;
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
      console.log("navigateToNextStepInWorkout: No more 'pending' exercises. Proceeding to finish");
      this.isPerformingDeferredExercise = false;
      this.lastActivatedDeferredExerciseId = null;
      this.exercisesProposedThisCycle = { doLater: false, skipped: false };
      completedActiveInfo.exerciseData.sessionStatus = 'completed';
      this.savePausedSessionState();
      await this.tryProceedToDeferredExercisesOrFinish(currentSessionRoutine);
      return;
    }

    // --- SAFETY CHECK ---
    // Add a guard clause to prevent using an invalid index if the helper returns one unexpectedly.
    if (nextExIdx === -1 || !currentSessionRoutine.exercises[nextExIdx] || !currentSessionRoutine.exercises[nextExIdx].sets[nextSetIdx]) {
      console.error("navigateToNextStepInWorkout: findNextPlayableItemIndices returned an invalid index, but did not signal end of workout. Fallback to finish flow", { nextExIdx, nextSetIdx });
      await this.tryProceedToDeferredExercisesOrFinish(currentSessionRoutine);
      return;
    }
    // --- END SAFETY CHECK ---

    this.currentExerciseIndex.set(nextExIdx);
    this.currentSetIndex.set(nextSetIdx);

    if (completedActiveInfo.exerciseIndex !== nextExIdx) {
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

          // adding next set info like weights, reps, etc.
          if (nextSetInfo.setData) {
            resultText += ' [';
            const setData = nextSetInfo.setData;
            if (setData.weight && setData.reps) {
              resultText += `${setData.weight}${this.unitService.getUnitLabel()} x ${setData.reps} reps`;
            }
            if (!setData.weight && setData.reps) {
              resultText += `${setData.reps} reps`;
            }
            if (setData.duration) {
              if (resultText.length > 2 && !resultText.endsWith('[')) {
                resultText += `, duration ${setData.duration} seconds`;
              } else {
                resultText += `duration ${setData.duration} seconds`;
              }
            }
            resultText += ']';
          }
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

  private getLatestLoggedExercise(): LoggedWorkoutExercise | undefined {
    if (!this.currentWorkoutLogExercises()) {
      return undefined;
    }
    return this.currentWorkoutLogExercises().find((ex, index) => index === this.currentWorkoutLogExercises().length - 1);
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
    this.addActualRestAfterSet(null);
    console.log('Rest timer finished');
    this.isRestTimerVisible.set(false);
    // this.playerSubState.set(PlayerSubState.PerformingSet); // prepareCurrentSet will determine the next subState
    this.prepareCurrentSet(); // This will handle if a pre-set timer is next, or directly to performing
  }

  addActualRestAfterSet(timeSkipped: number | null): void {
    // add rest time to current set before moving to next one
    const justLoggedExercise = this.getLatestLoggedExercise();
    if (justLoggedExercise) {
      const justLoggedExerciseSet = justLoggedExercise?.sets.find((set, index) => index === justLoggedExercise.sets.length - 1);
      if (justLoggedExerciseSet) {
        const routineExerciseSet = this.routine()?.exercises.find(ex => ex.id === justLoggedExercise.id)?.sets.find(set => set.id === justLoggedExerciseSet.plannedSetId);
        if (timeSkipped && this.restDuration()) {
          const actualRestingTime = Math.ceil(this.restDuration() - timeSkipped);
          justLoggedExerciseSet.restAfterSetUsed = actualRestingTime;
        } else {
          const actualRestingTime = routineExerciseSet?.restAfterSet ?? 60;
          justLoggedExerciseSet.restAfterSetUsed = actualRestingTime;
        }
      }
    }
  }

  handleRestTimerSkipped(timeSkipped: number | null): void {
    this.addActualRestAfterSet(timeSkipped);
    console.log('Rest timer skipped');
    this.isRestTimerVisible.set(false);
    this.toastService.clearAll();
    this.toastService.info("Rest skipped", 2000);
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
      this.toastService.warning("Session is paused. Please resume to continue", 3000, "Paused");
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

  getExerciseStatus(currentExercise: WorkoutExercise | LoggedWorkoutExercise): 'pending' | 'skipped' | 'do_later' | 'completed' | 'started' {
    const routine = this.routine();
    if (!routine) {
      return 'pending';
    }
    const exerciseInRoutine = routine.exercises?.find(ex => currentExercise.id === ex.id);
    if (!exerciseInRoutine || !exerciseInRoutine.sessionStatus) {
      return 'pending';
    }
    return exerciseInRoutine.sessionStatus;
  }

  isExerciseSkipped(currentExercise: WorkoutExercise | LoggedWorkoutExercise): boolean {
    const routine = this.routine();
    if (!routine) {
      return false;
    }
    const exerciseInRoutine = routine.exercises?.find(ex => currentExercise.id === ex.id);
    if (!exerciseInRoutine || !exerciseInRoutine.sessionStatus) {
      return false;
    }
    return exerciseInRoutine.sessionStatus === 'skipped';
  }

  isExerciseDoLater(currentExercise: WorkoutExercise | LoggedWorkoutExercise): boolean {
    const routine = this.routine();
    if (!routine) {
      return false;
    }
    const exerciseInRoutine = routine.exercises?.find(ex => currentExercise.id === ex.id);
    if (!exerciseInRoutine || !exerciseInRoutine.sessionStatus) {
      return false;
    }
    return exerciseInRoutine.sessionStatus === 'do_later';
  }

  /**
 * Determines the status text and updates the sessionStatus for a given exercise.
 * @param ex The exercise to evaluate.
 * @returns A string representing the status indicator (e.g., " - Current: 1 of 5 done").
 */
  private getExerciseStatusIndicator(ex: WorkoutExercise): string {
    // Using the optimized logic from the previous answer.
    const isActive = ex.id === this.activeSetInfo()?.exerciseData.id;

    if (this.isExerciseFullyLogged(ex)) {
      ex.sessionStatus = 'completed';
      return ' - Completed';
    }

    if (this.isExercisePartiallyLogged(ex)) {
      ex.sessionStatus = this.getExerciseStatus(ex) || 'started';
      const setsDone = this.getNumberOfLoggedSets(ex.id, 'warmup');

      let prefix = isActive ? 'Current' : 'Started';

      if (this.isExerciseSkipped(ex)) {
        prefix = 'Started (Skipped)';
      }
      if (this.isExerciseDoLater(ex)) {
        prefix = 'Started (Do Later)';
      }

      return ` - ${prefix}: ${setsDone} of ${this.getWorkingSets(ex)} done`;
    }

    if (isActive) {
      ex.sessionStatus = 'started';
      return ' - Current';
    }

    switch (ex.sessionStatus) {
      case 'skipped': return ' - Skipped';
      case 'do_later': return ' - Do Later';
      default: return ' - Pending';
    }
  }

  /**
   * Determines the appropriate CSS classes for an exercise button based on its state.
   * @param ex The exercise to evaluate (its sessionStatus should be pre-updated).
   * @param statusIndicator The status text, used to check for "Current".
   * @returns A string of Tailwind CSS classes.
   */
  private getExerciseButtonCssClass(ex: WorkoutExercise, statusIndicator: string): string {
    const isCurrent = statusIndicator.includes('Current');
    const isSuperset = !!ex.supersetId;

    // 1. Determine the base color class from the session status.
    let colorClass = '';
    switch (ex.sessionStatus) {
      case 'started': colorClass = 'bg-yellow-500 text-white'; break;
      case 'pending': colorClass = 'bg-violet-500 text-white'; break;
      case 'do_later': colorClass = 'bg-orange-500 text-white'; break;
      case 'skipped': colorClass = 'bg-red-500 text-white'; break;
      case 'completed': colorClass = 'bg-green-600 text-white'; break;
      default: colorClass = 'bg-gray-500 dark:bg-gray-700'; break; // Pending
    }

    // 2. The "current" state has the highest priority and overrides other colors.
    if (isCurrent) {
      colorClass = 'bg-blue-600 text-white';
    }

    // 3. Determine border class for supersets. This is applied independently of color.
    const borderClass = isSuperset ? 'border-2 border-primary' : '';

    // 4. Combine all parts into the final class string.
    return `${colorClass} ${borderClass}`;
  }

  /**
   * Generates the text suffix for a superset exercise.
   * @param ex The exercise to evaluate.
   * @param currentRoutineVal The full routine object to find related exercises.
   * @returns A string for the superset indicator (e.g., " [Superset #1]").
   */
  private getSupersetIndicatorText(ex: WorkoutExercise, currentRoutineVal: Routine): string {
    if (!ex.supersetId) {
      return '';
    }

    const blockExercises = currentRoutineVal.exercises.filter(e => e.supersetId === ex.supersetId);
    const blockIndex = blockExercises.findIndex(e => e.id === ex.id);

    if (blockIndex !== -1) {
      return ` [Superset #${blockIndex + 1}]`;
    }

    return '';
  }

  async jumpToExercise(headerString: string = ''): Promise<void> {
    if (headerString) {
      this.headerOverviewString = headerString;
    } else {
      this.headerOverviewString = this.HEADER_OVERVIEW_STRING;
    }
    if (this.sessionState() === 'paused') {
      this.toastService.warning("Session is paused. Resume to jump to an exercise", 3000, "Paused");
      this.closeWorkoutMenu();
      return;
    }

    const currentRoutineVal = this.routine();
    if (!currentRoutineVal || !currentRoutineVal.exercises || currentRoutineVal.exercises.length === 0) {
      this.toastService.error("No exercises available to jump to", 0, "Error");
      this.closeWorkoutMenu();
      return;
    }

    // --- No changes to this part ---
    // Filter for exercises that are not yet fully completed or can be restarted.
    const availableExercises = currentRoutineVal.exercises
      .map((ex, index) => ({
        ...ex,
        originalIndex: index,
        isFullyLogged: this.isExerciseFullyLogged(ex), // Assuming isExerciseFullyLogged needs these params
        isPartiallyLogged: this.isExercisePartiallyLogged(ex), // Assuming this is correct
      }))

    // --- No changes to button creation, but note the role assignment ---
    const exerciseButtons: AlertButton[] = availableExercises.map(ex => {
      const statusIndicator = this.getExerciseStatusIndicator(ex);
      const supersetIndicator = this.getSupersetIndicatorText(ex, currentRoutineVal);
      const cssClass = this.getExerciseButtonCssClass(ex, statusIndicator);

      return {
        text: `${ex.exerciseName}${statusIndicator}${supersetIndicator}`,
        // The role is 'restart' only if the exercise is already fully logged.
        role: ex.isFullyLogged ? 'restart' : 'confirm',
        data: ex.originalIndex,
        cssClass: cssClass,
      };
    });

    exerciseButtons.push({ text: 'CANCEL', role: 'cancel', data: 'cancel_jump' });
    this.closeWorkoutMenu();

    const choice = await this.alertService.showConfirmationDialog(
      this.headerOverviewString,
      'Select an exercise to start, continue, or restart:', // Updated prompt text
      exerciseButtons,
    );

    if (choice && choice.data !== 'cancel_jump' && typeof choice.data === 'number') {
      const selectedExerciseOriginalIndex = choice.data;
      const exerciseToJumpTo = currentRoutineVal.exercises[selectedExerciseOriginalIndex];

      if (!exerciseToJumpTo) {
        this.toastService.error("Selected exercise not found", 0, "Error");
        return;
      }

      // +++ START: RESTART LOGIC +++
      // Check if the action was a restart.
      if (choice.role === 'restart') {
        const restartChoice = await this.alertService.showConfirmationDialog(
          `Restart ${exerciseToJumpTo.exerciseName}`,
          'Are you sure you want to restart the selected exercise? By doing so the previous logged sets will be removed', // Updated prompt text
          [{ text: 'CANCEL', role: 'cancel', data: 'cancel' }, { text: 'OK', role: 'confirm', data: 'confirm' }],
        );

        if (restartChoice?.data !== 'confirm') {
          return;
        }

        console.log(`Restarting exercise: ${exerciseToJumpTo.exerciseName}. Removing its previous log entry`);

        // Update the signal by filtering out the exercise we are restarting.
        // It's crucial to match by the unique `id` of the exercise instance.
        this.currentWorkoutLogExercises.update(logs => {
          return logs.filter(loggedEx => loggedEx.id !== exerciseToJumpTo.id);
        });

        this.toastService.info(`Restarting ${exerciseToJumpTo.exerciseName}.`, 2000, "Restarting");
      }
      // +++ END: RESTART LOGIC +++


      console.log(`Jumping to exercise: ${exerciseToJumpTo.exerciseName} at index ${selectedExerciseOriginalIndex}`);
      this.stopOngoingTimers();

      const updatedRoutine = JSON.parse(JSON.stringify(currentRoutineVal)) as Routine;
      const targetExerciseInUpdatedRoutine = updatedRoutine.exercises[selectedExerciseOriginalIndex];
      const wasDeferred = targetExerciseInUpdatedRoutine.sessionStatus === 'do_later' || targetExerciseInUpdatedRoutine.sessionStatus === 'skipped';
      targetExerciseInUpdatedRoutine.sessionStatus = 'pending';
      this.routine.set(updatedRoutine);

      this.currentExerciseIndex.set(selectedExerciseOriginalIndex);
      // When restarting, we always start from set index 0.
      // When continuing, findFirstUnloggedSetIndex will find the correct partial progress.

      const firstUnloggedSetIdx = this.findFirstUnloggedSetIndex(exerciseToJumpTo.id, exerciseToJumpTo.sets.map(s => s.id)) || 0;
      const finalUnloggedSetIdx = choice.role === 'restart' ? 0 : firstUnloggedSetIdx;
      this.currentSetIndex.set(finalUnloggedSetIdx);

      // --- Rest of your logic is unchanged ---
      this.currentBlockRound.set(1);
      if (!exerciseToJumpTo.supersetId || exerciseToJumpTo.supersetOrder === 0) {
        this.totalBlockRounds.set(exerciseToJumpTo.rounds ?? 1);
      } else {
        const actualBlockStart = updatedRoutine.exercises.find(ex => ex.supersetId === exerciseToJumpTo.supersetId && ex.supersetOrder === 0);
        this.totalBlockRounds.set(actualBlockStart?.rounds ?? 1);
      }
      this.lastPerformanceForCurrentExercise = null;
      this.isPerformingDeferredExercise = wasDeferred;
      this.lastActivatedDeferredExerciseId = wasDeferred ? exerciseToJumpTo.id : null;
      this.playerSubState.set(PlayerSubState.PerformingSet);

      await this.prepareCurrentSet();
      if (choice.role !== 'restart') {
        this.toastService.info(`Jumped to ${exerciseToJumpTo.exerciseName}, set ${finalUnloggedSetIdx + 1} of ${exerciseToJumpTo.sets?.length}.`, 2500);
      }
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
      this.availableExercises = exercises.filter(ex => !ex.isHidden);
    });
  }

  // --- Modal Methods for Workout Player ---
  isEndReached = signal<boolean>(false);
  openExerciseSelectionModal(): void {
    if (this.sessionState() === 'paused') {
      this.toastService.warning("Session is paused. Resume to add exercise", 3000, "Paused");
      return;
    }
    if (this.availableExercises.length === 0) { // Lazy load if not already loaded
      this.loadAvailableExercises();
    }
    this.modalSearchTerm.set('');
    this.isExerciseAddModalOpen.set(true);
    this.closeWorkoutMenu(); // Close main menu when opening modal

    setTimeout(() => {
      if (this.myExerciseInput && this.myExerciseInput.nativeElement) {
        this.myExerciseInput?.nativeElement?.focus();
      }
    });

  }

  closeExerciseSelectionModal(): void {
    this.isExerciseAddModalOpen.set(false);
  }

  onModalSearchTermChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.modalSearchTerm.set(inputElement.value);
  }

  /**
   * This method is triggered when the user presses "Enter"
   * inside the exercise search input field.
   */
  onSearchEnter(type: 'add' | 'switch' = 'add'): void {
    const filteredList = this.filteredAvailableExercises();

    // Check if there is exactly one exercise in the filtered list
    if (filteredList.length === 1) {
      // If so, select that exercise
      const singleExercise = filteredList[0];
      if (type === 'switch') {
        this.selectExerciseToSwitch(singleExercise);
      } else {
        this.selectExerciseToAddFromModal(singleExercise);
      }
    }
    // If there are 0 or more than 1 results, pressing Enter does nothing,
    // which is the desired behavior.
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

  showCompletedSetsForExerciseInfo = signal(true);
  toggleCompletedSetsForExerciseInfo(): void {
    this.showCompletedSetsForExerciseInfo.update(s => !s);
  }

  // For the "Completed Sets Today (All Exercises)"
  showCompletedSetsForDayInfo = signal(false);
  toggleCompletedSetsForDayInfo(): void {
    this.showCompletedSetsForDayInfo.update(s => !s);
  }


  // NEW HELPER METHOD: To find the total rounds for any given exercise block
  private getRoundsForExerciseBlock(exerciseIndex: number, routine: Routine): number {
    const exercise = routine.exercises[exerciseIndex];
    if (!exercise) return 1;

    // If it's a superset, find the first exercise in that superset block
    if (exercise.supersetId) {
      const firstInSuperset = routine.exercises.find(ex => ex.supersetId === exercise.supersetId && ex.supersetOrder === 0);
      return firstInSuperset?.rounds ?? 1;
    }

    // If it's a standard exercise, use its own rounds property
    return exercise.rounds ?? 1;
  }

  /**
   * Transforms a routine into a flat list of HIIT intervals FOR ALL ROUNDS and starts the player.
   * This version correctly handles rounds defined on a per-exercise or per-superset-block basis.
   */
  private setupTabataMode(
    routine: Routine,
    startAtIndex: number = 0,
    startTimeRemaining?: number
  ): void {
    const intervals: Omit<HIITInterval, 'totalIntervals' | 'currentIntervalNumber'>[] = [];
    this.tabataIntervalMap = []; // The map now stores [exerciseIndex, setIndex, roundNumber]

    // 1. Add "Prepare" interval
    intervals.push({ type: 'prepare', duration: 10, exerciseName: 'Get Ready' });
    this.tabataIntervalMap.push([0, 0, 1]);

    // 2. Main loop now iterates through exercise BLOCKS
    let exerciseIndex = 0;
    while (exerciseIndex < routine.exercises.length) {
      const currentExercise = routine.exercises[exerciseIndex];
      const totalRoundsForBlock = this.getRoundsForExerciseBlock(exerciseIndex, routine);
      const isSuperset = !!currentExercise.supersetId;
      const supersetSize = isSuperset ? (currentExercise.supersetSize ?? 1) : 1;

      // Loop for the number of rounds for this specific block
      for (let round = 1; round <= totalRoundsForBlock; round++) {
        // Loop through all exercises within this block (will be 1 for standard exercises)
        for (let i = 0; i < supersetSize; i++) {
          const blockExerciseIndex = exerciseIndex + i;
          const blockExercise = routine.exercises[blockExerciseIndex];
          if (!blockExercise) continue; // Safety check

          const isLastRound = round === totalRoundsForBlock;

          blockExercise.sets.forEach((set, setIndex) => {
            // A. Add the "Work" interval for the current round
            intervals.push({
              type: 'work',
              duration: set.duration || 40,
              exerciseName: blockExercise.exerciseName
            });
            this.tabataIntervalMap.push([blockExerciseIndex, setIndex, round]);

            // B. Conditionally add the "Rest" interval
            const isLastExerciseOfEntireWorkout = blockExerciseIndex === routine.exercises.length - 1;
            const isLastSetOfBlockExercise = setIndex === blockExercise.sets.length - 1;

            // Don't add rest after the absolute final work interval of the entire workout
            if (!(isLastRound && isLastExerciseOfEntireWorkout && isLastSetOfBlockExercise)) {
              if (set.restAfterSet > 0) {
                intervals.push({
                  type: 'rest',
                  duration: set.restAfterSet || 20,
                  exerciseName: 'Rest'
                });
                this.tabataIntervalMap.push([blockExerciseIndex, setIndex, round]);
              }
            }
          });
        }
      }
      // Move the main index to the start of the next block
      exerciseIndex += supersetSize;
    }


    // 3. Finalize the intervals list with total counts
    const totalIntervals = intervals.length;
    const finalIntervals = intervals.map((interval, index) => ({
      ...interval,
      totalIntervals: totalIntervals,
      currentIntervalNumber: index + 1
    }));
    this.tabataIntervals.set(finalIntervals);

    // 4. Set the initial state of the player
    this.sessionState.set(SessionState.Playing);
    this.routine.set(routine);
    this.isTabataMode.set(true);

    // 5. Use the helper to set the correct state for BOTH players.
    this.setPlayerStateFromTabataIndex(startAtIndex);

    // 6. Start the timer
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
        takeUntil(this.destroy$)      // Add this line
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
    // First, if the interval that just finished was a "work" interval, log it.
    if (this.currentTabataInterval()?.type === 'work') {
      this.completeAndLogCurrentSet();
    }

    const nextIndex = this.currentTabataIntervalIndex() + 1;

    if (nextIndex < this.tabataIntervals().length) {
      // There are more intervals, so proceed to the next one.
      // The helper function will set the currentExerciseIndex, setIndex, AND the currentBlockRound.
      this.setPlayerStateFromTabataIndex(nextIndex);
      this.startCurrentTabataInterval();
    } else {
      // Reached the end of the very last interval.
      this.tabataTimeRemaining.set(0);
      if (this.tabataTimerSub) this.tabataTimerSub.unsubscribe();
      this.sessionState.set(SessionState.End);
      // Now that the session is truly over, finalize and save.
      this.finishWorkoutAndReportStatus();
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
  // --- NEW: LOGIC FOR EXERCISE SWITCHING ---

  // --- For Exercise Switching Modal ---
  isExerciseSwitchModalOpen = signal(false);
  switchModalSearchTerm = signal('');
  isShowingSimilarInSwitchModal = signal(false);
  exercisesForSwitchModal = signal<Exercise[]>([]);


  // --- Add this new computed signal for filtering in the switch modal ---
  filteredExercisesForSwitchModal = computed(() => {
    let term = this.switchModalSearchTerm().toLowerCase();
    // If we're showing similar exercises, just return that list without filtering by search term
    if (this.isShowingSimilarInSwitchModal()) {
      return this.exercisesForSwitchModal();
    }
    // Otherwise, filter the main list of available exercises by the search term
    if (!term) {
      return this.availableExercises;
    }
    term = this.exerciseService.normalizeExerciseNameForSearch(term);
    return this.availableExercises.filter(ex =>
      ex.name.toLowerCase().includes(term) ||
      (ex.category && ex.category.toLowerCase().includes(term)) ||
      (ex.primaryMuscleGroup && ex.primaryMuscleGroup.toLowerCase().includes(term))
    );
  });

  // --- This is the new functionality to implement the switch/change exercise feature ---

  /**
   * Opens the modal for switching the current exercise.
   * Resets the modal's state before showing it.
   */
  async openSwitchExerciseModal(): Promise<void> {
    this.closeWorkoutMenu();
    if (!this.canSwitchExercise()) {
      this.toastService.warning("Cannot switch exercise after starting it.", 3000, "Action not allowed");
      return;
    }

    // Reset the state for the switch modal each time it's opened
    this.isShowingSimilarInSwitchModal.set(false);
    this.switchModalSearchTerm.set('');
    this.exercisesForSwitchModal.set([]); // Clear any previous "similar" results
    this.isExerciseSwitchModalOpen.set(true); // Open the modal
  }

  /**
   * Closes the exercise switching modal.
   */
  closeSwitchExerciseModal(): void {
    this.isExerciseSwitchModalOpen.set(false);
  }

  /**
   * Fetches exercises similar to the current one and displays them in the modal.
   */
  async findAndShowSimilarExercises(): Promise<void> {
    const activeInfo = this.activeSetInfo();
    if (!activeInfo) return;

    // Ensure we have the full base exercise definition
    let baseExercise = this.currentBaseExercise();
    if (!baseExercise) {
      baseExercise = await firstValueFrom(this.exerciseService.getExerciseById(activeInfo.exerciseData.exerciseId));
      if (!baseExercise) {
        this.toastService.error("Could not load details for the current exercise.", 0, "Error");
        return;
      }
    }

    try {
      const similarExercises = await firstValueFrom(this.exerciseService.getSimilarExercises(baseExercise, 12));

      if (similarExercises.length === 0) {
        this.toastService.info("No similar exercises found based on muscle groups.", 4000, "Not Found");
      }

      this.exercisesForSwitchModal.set(similarExercises);
      this.isShowingSimilarInSwitchModal.set(true); // Set the flag to display the 'similar' list
    } catch (error) {
      console.error("Error fetching similar exercises:", error);
      this.toastService.error("Could not load similar exercises.", 0, "Error");
    }
  }

  /**
   * Handles the selection of a new exercise from the switch modal,
   * triggering the replacement logic.
   * @param newExercise The exercise chosen to replace the current one.
   */
  async selectExerciseToSwitch(newExercise: Exercise): Promise<void> {
    this.closeSwitchExerciseModal();
    await this.replaceCurrentExerciseInRoutine(newExercise);
  }

  /**
   * Replaces the current exercise in the routine's state with a new one.
   * @param newExercise The new exercise to substitute in.
   */
  private async replaceCurrentExerciseInRoutine(newExercise: Exercise): Promise<void> {
    const currentRoutineVal = this.routine();
    const activeInfo = this.activeSetInfo();

    if (!currentRoutineVal || !activeInfo) {
      this.toastService.error("Failed to switch exercise: Routine data missing.", 0, "Error");
      return;
    }

    const updatedRoutine = JSON.parse(JSON.stringify(currentRoutineVal)) as Routine;
    const exerciseToUpdate = updatedRoutine.exercises[activeInfo.exerciseIndex];

    if (exerciseToUpdate) {
      console.log(`Switching '${exerciseToUpdate.exerciseName}' with '${newExercise.name}'`);
      exerciseToUpdate.exerciseId = newExercise.id;
      exerciseToUpdate.exerciseName = newExercise.name;

      const snapshotExerciseToUpdate = this.originalRoutineSnapshot.find(ex => ex.id === exerciseToUpdate.id);
      if (snapshotExerciseToUpdate) {
        snapshotExerciseToUpdate.exerciseId = newExercise.id;
        snapshotExerciseToUpdate.exerciseName = newExercise.name;
      }

      this.routine.set(updatedRoutine);
      this.lastPerformanceForCurrentExercise = null;
      this.currentBaseExercise.set(null); // Force a reload
      this.exercisePBs.set([]);

      await this.prepareCurrentSet();
      this.toastService.info(`Switched to ${newExercise.name}`, 3000, "Exercise Switched");
    } else {
      this.toastService.error("Could not find the exercise to replace in the routine.", 0, "Error");
    }
  }

  // --- NEW COMPUTED SIGNAL TO CONTROL THE BUTTON'S VISIBILITY ---
  readonly canSwitchExercise = computed<boolean>(() => {
    const activeInfo = this.activeSetInfo();
    if (!activeInfo || this.sessionState() === 'paused') {
      return false;
    }
    // Allow switching only if no sets for THIS specific exercise instance have been logged yet.
    const loggedSetCount = this.getNumberOfLoggedSets(activeInfo.exerciseData.id);
    return loggedSetCount === 0;
  });

  backToRoutines(): void {
    this.router.navigate(['/workout']);
  }
}