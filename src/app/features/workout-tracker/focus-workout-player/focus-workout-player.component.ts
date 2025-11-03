import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef, HostListener, PLATFORM_ID, ViewChildren, QueryList, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subscription, of, timer, firstValueFrom, interval, Subject, combineLatest, lastValueFrom } from 'rxjs';
import { switchMap, tap, map, take, filter, takeUntil } from 'rxjs/operators';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ActiveSetInfo, DistanceTarget, DurationTarget, ExerciseTargetSetParams, METRIC, PausedWorkoutState, PlayerSubState, Routine, SessionState, TimedSetState, WeightTarget, WorkoutExercise } from '../../../core/models/workout.model';
import { Exercise } from '../../../core/models/exercise.model';
import { LastPerformanceSummary, LoggedSet, LoggedWorkoutExercise, PersonalBestSet, WorkoutLog } from '../../../core/models/workout-log.model';
import { FormatSecondsPipe } from '../../../shared/pipes/format-seconds-pipe';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { FullScreenRestTimerComponent } from '../../../shared/components/full-screen-rest-timer/full-screen-rest-timer';
import { PressDirective } from '../../../shared/directives/press.directive';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ExerciseDetailComponent } from '../../exercise-library/exercise-detail';
import { ExerciseSelectionModalComponent } from '../../../shared/components/exercise-selection-modal/exercise-selection-modal.component';
import { WorkoutService } from '../../../core/services/workout.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { AlertService } from '../../../core/services/alert.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { StorageService } from '../../../core/services/storage.service';
import { UnitsService } from '../../../core/services/units.service';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { ToastService } from '../../../core/services/toast.service';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { ProgressiveOverloadService } from '../../../core/services/progressive-overload.service.ts';
import { v4 as uuidv4 } from 'uuid';
import { AlertButton, AlertInput } from '../../../core/models/alert.model';
import { format } from 'date-fns';
import { ActionMenuComponent } from '../../../shared/components/action-menu/action-menu';
import { MenuMode } from '../../../core/models/app-settings.model';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { addExerciseBtn, addRoundToExerciseBtn, addSetToExerciseBtn, addToSuperSetBtn, addWarmupSetBtn, calculatorBtn, createSuperSetBtn, finishEarlyBtn, jumpToExerciseBtn, markAsDoLaterBtn, openExercisePerformanceInsightsBtn, openSessionPerformanceInsightsBtn, pauseSessionBtn, quitWorkoutBtn, removeFromSuperSetBtn, removeRoundFromExerciseBtn, removeSetFromExerciseBtn, skipCurrentExerciseBtn, skipCurrentSetBtn, switchExerciseBtn } from '../../../core/services/buttons-data';
import { SessionOverviewModalComponent } from '../session-overview-modal/session-overview-modal.component';
import { BarbellCalculatorModalComponent } from '../../../shared/components/barbell-calculator-modal/barbell-calculator-modal.component';
import { repsTypeToReps, genRepsTypeFromRepsNumber, repsTargetAsString, weightToExact, restToExact, getWeightValue, getRestValue, getDurationValue, durationToExact, distanceToExact, getDistanceValue } from '../../../core/services/workout-helper.service';


// Interface to manage the state of the currently active set/exercise

@Component({
  selector: 'app-focus-player',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule,
    FormatSecondsPipe,
    FormsModule, WeightUnitPipe, FullScreenRestTimerComponent, PressDirective, ModalComponent, ExerciseDetailComponent,
    IconComponent, ExerciseSelectionModalComponent, ActionMenuComponent, SessionOverviewModalComponent, BarbellCalculatorModalComponent],
  templateUrl: './focus-workout-player.component.html',
  styleUrl: './focus-workout-player.component.scss',
  providers: [DecimalPipe, WeightUnitPipe]
})
export class FocusPlayerComponent implements OnInit, OnDestroy {
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
  private weightUnitPipe = inject(WeightUnitPipe);

  protected appSettingsService = inject(AppSettingsService);
  protected progressiveOverloadService = inject(ProgressiveOverloadService);

  private platformId = inject(PLATFORM_ID);
  // --- State Signals ---
  protected routine = signal<Routine | null | undefined>(undefined);
  program = signal<string | undefined>(undefined);
  scheduledDay = signal<string | undefined>(undefined);
  sessionState = signal<SessionState>(SessionState.Loading);
  public readonly PlayerSubState = PlayerSubState;
  playerSubState = signal<PlayerSubState>(PlayerSubState.PerformingSet);

  currentExerciseIndex = signal(0);
  currentSetIndex = signal(0);
  currentBlockRound = signal(1);
  totalBlockRounds = signal(1);

  @ViewChild('exerciseSearchFied') myExerciseInput!: ElementRef;

  private intensityAdjustment: { direction: 'increase' | 'decrease', percentage: number } | null = null;
  isSessionOverviewVisible = signal(false);

  showNotes = signal<boolean | null>(false);

  // --- Timer Signals & Properties ---
  sessionTimerDisplay = signal('00:00');

  private workoutStartTime: number = 0;
  private originalSessionStartTime: number = 0;
  private sessionTimerElapsedSecondsBeforePause = 0;
  private timerSub: Subscription | undefined;

  timedSetTimerState = signal<TimedSetState>(TimedSetState.Idle);
  timedSetElapsedSeconds = signal(0);
  private timedSetIntervalSub: Subscription | undefined;
  private soundPlayedForThisCountdownSegment = false;

  isRestTimerVisible = signal(false);
  restDuration = signal(0);
  restTimerDisplay = signal<string | null>(null);
  restTimerMainText = signal('RESTING');
  restTimerNextUpText = signal<string | null>(null);

  readonly nextActionButtonLabel = computed(() => {
    switch (this.playerSubState()) {
      case PlayerSubState.Resting:
        return 'RESTING...';
      case PlayerSubState.PerformingSet:
      default:
        return 'SET DONE';
    }
  });

  currentSetForm!: FormGroup;
  lastPerformanceForCurrentExercise: LastPerformanceSummary | null = null;
  editingTarget: METRIC | null = null;
  editingTargetValue: number | string = '';
  routineId: string | null = null;

  openSessionOverviewModal(): void {
    this.isSessionOverviewVisible.set(true);
  }

  closeSessionOverviewModal(): void {
    this.isSessionOverviewVisible.set(false);
  }

  // --- For Exercise Selection Modal ---
  isExerciseAddModalOpen = signal(false);
  availableExercises: Exercise[] = [];
  modalSearchTerm = signal('');
  filteredExercisesForAddExerciseModal = computed(() => {
    let term = this.modalSearchTerm().toLowerCase();
    if (!term) {
      return this.availableExercises;
    }
    term = this.exerciseService.normalizeExerciseNameForSearch(term);
    return this.availableExercises.filter(ex =>
      ex.name.toLowerCase().includes(term) ||
      (ex.category && ex.category.toLowerCase().includes(term)) ||
      (ex.description && ex.description.toLowerCase().includes(term)) ||
      (ex.primaryMuscleGroup && ex.primaryMuscleGroup.toLowerCase().includes(term))
    );
  });
  // --- End Exercise Selection Modal ---

  private readonly PAUSED_STATE_VERSION = '1.2';
  private originalRoutineSnapshot: Routine | null = null;
  protected currentWorkoutLogExercises = signal<LoggedWorkoutExercise[]>([]);
  private wasRestTimerVisibleOnPause = false;
  private restTimerRemainingSecondsOnPause = 0;
  private restTimerInitialDurationOnPause = 0;
  private restTimerMainTextOnPause = 'RESTING';
  private restTimerNextUpTextOnPause: string | null = null;
  private wasTimedSetRunningOnPause = false;
  private autoSaveSub: Subscription | undefined;
  private readonly AUTO_SAVE_INTERVAL_MS = 20000;
  private isSessionConcluded = false;
  private routerEventsSub: Subscription | undefined;
  private isInitialLoadComplete = false;
  private exercisesProposedThisCycle = { doLater: false, skipped: false };

  insightsData = signal<{
    exercise: WorkoutExercise;
    baseExercise: Exercise | null;
    lastPerformance: LastPerformanceSummary | null;
    personalBests: PersonalBestSet[];
    completedSetsInSession: LoggedSet[];
  } | null>(null);

  protected HEADER_OVERVIEW_STRING: string = 'JUMP TO EXERCISE';
  protected headerOverviewString: string = 'JUMP TO EXERCISE';

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
    // --- MODIFICATION START: Explicitly handle EMOM UI ---
    if (this.activeSupersetBlock()?.[0]?.supersetType === 'emom') {
      const isLastRoundOfBlock = this.currentBlockRound() === this.totalBlockRounds();
      const isLastSetOfWorkout = this.checkIfLatestSetOfWorkoutConsideringPending();
      if (isLastRoundOfBlock && isLastSetOfWorkout) return 'FINISH WORKOUT';
      return 'COMPLETE ROUND';
    }
    // --- MODIFICATION END ---

    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    const block = this.activeSupersetBlock();
    if (block) {
      const isLastExerciseInBlock = activeInfo?.exerciseData.supersetOrder === block.length - 1;
      const isLastRoundOfBlock = this.currentBlockRound() === this.totalBlockRounds();
      const isLastSetOfWorkout = this.checkIfLatestSetOfWorkoutConsideringPending();

      if (isLastExerciseInBlock) {
        if (isLastRoundOfBlock) {
          return isLastSetOfWorkout ? 'FINISH WORKOUT' : 'COMPLETE EXERCISE';
        } else {
          return 'COMPLETE ROUND';
        }
      } else {
        return 'SET DONE';
      }
    }

    switch (this.playerSubState()) {
      case PlayerSubState.Resting:
        return `RESTING: ${this.restTimerDisplay()}`;
      case PlayerSubState.PerformingSet:
        if (!activeInfo) return 'SET DONE';
        const isLastSetOfExercise = this.checkIfLatestSetOfExercise();
        const isLastSetOfWorkout = this.checkIfLatestSetOfWorkoutConsideringPending();
        if (isLastSetOfExercise) {
          return isLastSetOfWorkout ? 'FINISH WORKOUT' : 'COMPLETE EXERCISE';
        }
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
    const targetDuration = activeInfo?.setData?.targetDuration;
    if (state === TimedSetState.Idle) {
      return (targetDuration && getDurationValue(targetDuration) > 0 ? targetDuration : (this.csf?.['actualDuration']?.value ?? 0)).toString();
    }
    if (targetDuration && getDurationValue(targetDuration) > 0) {
      const remaining = getDurationValue(targetDuration) - elapsed;
      return remaining.toString();
    } else {
      return elapsed.toString();
    }
  });

  readonly isTimedSetOvertime = computed(() => {
    const state = this.timedSetTimerState();
    if (state === TimedSetState.Idle) return false;
    const elapsed = this.timedSetElapsedSeconds();
    const targetDuration = this.activeSetInfo()?.setData?.targetDuration;
    return targetDuration && getDurationValue(targetDuration) > 0 && elapsed > getDurationValue(targetDuration);
  });

  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: BeforeUnloadEvent): void {
    this.closeWorkoutMenu();
    if (this.sessionState() === SessionState.Playing && this.routine() && this.currentWorkoutLogExercises().length > 0) {
      this.captureAndSaveStateForUnload();
    }
  }

  protected get weightUnitDisplaySymbol(): string {
    return this.unitService.getWeightUnitSuffix();
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
    return workingSetCounter;
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
    return warmupSetCounter;
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
        supersetId: exerciseData.supersetId || null,
        superSetType: exerciseData.supersetType || null,
        exerciseData: exerciseData,
        setData: setData,
        type: (setData.type as 'standard' | 'warmup' | 'amrap' | 'custom') ?? 'standard',
        baseExerciseInfo: baseExerciseInfo,
        isCompleted: !!completedSetLog,
        actualReps: completedSetLog?.repsLogged,
        actualWeight: completedSetLog?.weightLogged,
        actualDuration: completedSetLog?.durationLogged,
        notes: completedSetLog?.notes || setData?.notes,
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
        const routine = this.routine();
        if (!routine) continue;
        const exerciseIdx = routine.exercises.findIndex(e => e.exerciseId === exLog.exerciseId);
        const exercise = routine.exercises.find(e => e.exerciseId === exLog.exerciseId);

        const currentSet = exercise?.sets.find(currSet => currSet.id === set.plannedSetId);
        const currentSetIndex = currentSet ? exercise?.sets.findIndex(set => set.id === currentSet.id) : -1;
        if (currentSetIndex !== undefined && currentSetIndex >= 0) {
          set.plannedSetId = (currentSetIndex + 1) + ' of ' + exercise?.sets.length;
        }

        if (exerciseIdx < 0) continue;
        if (exerciseIdx < activeInfo.exerciseIndex) {
          allLoggedSets.push(set);
        } else if (exerciseIdx === activeInfo.exerciseIndex) {
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

  constructor() {
    this.initializeCurrentSetForm();
  }

  private startSessionTimer(): void {
    if (this.sessionState() === SessionState.Paused) return;
    if (this.timerSub) this.timerSub.unsubscribe();

    this.timerSub = timer(0, 1000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      if (this.sessionState() === SessionState.Playing) {
        const currentDeltaSeconds = Math.floor((Date.now() - this.workoutStartTime) / 1000);
        const totalElapsedSeconds = this.sessionTimerElapsedSecondsBeforePause + currentDeltaSeconds;
        const hours = Math.floor(totalElapsedSeconds / 3600);
        const minutes = Math.floor((totalElapsedSeconds % 3600) / 60);
        const seconds = totalElapsedSeconds % 60;
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
    let exerciseLog = logs.find(log => log.id === exerciseData.id);

    if (exerciseLog) {
      // This part is for adding a subsequent set to an already logged exercise. It is correct.
      const existingSetIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === loggedSet.plannedSetId);
      if (existingSetIndex > -1) {
        // Replace if already exists (e.g., re-doing a set)
        exerciseLog.sets[existingSetIndex] = loggedSet;
      } else {
        // Add new set
        exerciseLog.sets.push(loggedSet);
      }
    } else {
      // --- THIS BLOCK IS CORRECTED ---
      // This part creates a new log entry for an exercise the first time a set is logged for it.
      const newLog: LoggedWorkoutExercise = {
        id: exerciseData.id,
        exerciseId: exerciseData.exerciseId,
        // FIX: Directly use the exerciseName from the passed-in exerciseData.
        // This ensures the correct name is used for each exercise in an EMOM block.
        exerciseName: exerciseData.exerciseName ?? '',
        sets: [loggedSet],
        type: loggedSet.type || 'standard',
        supersetId: exerciseData.supersetId || null,
        supersetOrder: exerciseData.supersetOrder ?? null,
        supersetType: exerciseData.supersetType || null,
      };
      // --- END CORRECTION ---

      const exerciseIndex = this.routine()?.exercises.findIndex(ex => ex.id === exerciseData.id);
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

    const originalPlayableExercises = original.filter(origEx => {
      return performed.some(pEx => pEx.exerciseId === origEx.exerciseId);
    });

    const originalIdSet = new Set(original.map(ex => ex.exerciseId));
    const originalNameSet = new Set(original.map(ex => ex.exerciseName));

    const performedExercisesThatWereInOriginal: LoggedWorkoutExercise[] = [];
    const addedCustomExercises: LoggedWorkoutExercise[] = [];

    for (const pEx of performed) {
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

    for (const originalEx of original) {
      const performedEx = performed.find(p => p.exerciseId === originalEx.exerciseId);
      if (!performedEx) {
        details.push(`Exercise "${originalEx.exerciseName || originalEx.exerciseId}" was in the plan but not performed`);
        majorDifference = true;
        continue;
      }

      if (performedEx.sets.length !== originalEx.sets.length) {
        details.push(`Set count for "${performedEx.exerciseName || performedEx.exerciseId}" changed (was ${originalEx.sets.length}, now ${performedEx.sets.length})`);
        majorDifference = true;
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

  getFirstExerciseOfSuperset(superSetOrder: number, supersetId: string, loggedExercises: LoggedWorkoutExercise[]): ExerciseTargetSetParams {
    const exercise = loggedExercises.find(ex => ex.supersetId && ex.supersetId === supersetId);
    const exerciseSet = exercise?.sets[0];
    return {
      id: uuidv4(),
      targetReps: exerciseSet && exerciseSet.targetReps ? exerciseSet.repsLogged : genRepsTypeFromRepsNumber(1),
      targetWeight: exerciseSet && exerciseSet.weightLogged ? exerciseSet.weightLogged : weightToExact(1),
      targetDuration: exerciseSet && exerciseSet.targetDuration ? exerciseSet.targetDuration : durationToExact(0),
      targetRest: superSetOrder !== null && superSetOrder !== undefined && exercise && exercise.sets.length && superSetOrder < exercise.sets.length - 1 ? restToExact(0) : this.getLastExerciseOfSuperset(supersetId, loggedExercises).targetRest,
      targetTempo: '1',
      notes: exerciseSet && exerciseSet.notes ? exerciseSet.notes : '',
      type: exerciseSet && exerciseSet.type ? 'superset' : 'standard',
      fieldOrder: this.workoutService.getRepsAndWeightFields()
    };
  }

  getLastExerciseOfSuperset(supersetId: string, loggedExercises: LoggedWorkoutExercise[]): ExerciseTargetSetParams {
    const exercise = loggedExercises.find(ex => ex.supersetId && ex.supersetId === supersetId);
    const exerciseSet = exercise?.sets[exercise.sets.length - 1];
    return {
      id: uuidv4(),
      targetReps: exerciseSet && exerciseSet.targetReps ? exerciseSet.targetReps : genRepsTypeFromRepsNumber(1),
      targetWeight: exerciseSet && exerciseSet.targetWeight ? exerciseSet.targetWeight : weightToExact(1),
      targetDuration: exerciseSet && exerciseSet.targetDuration ? exerciseSet.targetDuration : durationToExact(1),
      targetTempo: '1',
      targetRest: exerciseSet && exerciseSet.targetRest ? exerciseSet.targetRest : restToExact(60),
      notes: exerciseSet && exerciseSet.notes ? exerciseSet.notes : '',
      type: exerciseSet && exerciseSet.type ? 'superset' : 'standard',
      fieldOrder: this.workoutService.getRepsAndWeightFields()
    };
  }

  private convertLoggedToWorkoutExercises(loggedExercises: LoggedWorkoutExercise[]): WorkoutExercise[] {
    const currentSessionRoutine = this.routine();
    return loggedExercises.map(loggedEx => {
      const sessionExercise = currentSessionRoutine?.exercises.find(re => re.exerciseId === loggedEx.exerciseId);
      const newWorkoutEx: WorkoutExercise = {
        id: uuidv4(),
        exerciseId: loggedEx.exerciseId,
        exerciseName: loggedEx.exerciseName,
        supersetId: sessionExercise?.supersetId || null,
        supersetOrder: sessionExercise?.supersetOrder ?? null,
        notes: sessionExercise?.notes,
        sets: !loggedEx.supersetId ? loggedEx.sets.map(loggedSet => {
          const originalPlannedSet = sessionExercise?.sets.find(s => s.id === loggedSet.plannedSetId);
          return {
            id: uuidv4(),
            targetReps: loggedSet.targetReps ?? loggedSet.repsLogged,
            targetWeight: loggedSet.targetWeight ?? loggedSet.weightLogged,
            targetDuration: loggedSet.targetDuration ?? loggedSet.durationLogged,
            targetRest: originalPlannedSet?.targetRest || restToExact(60),
            tempo: loggedSet.targetTempo || originalPlannedSet?.targetTempo,
            notes: loggedSet.notes,
            type: loggedSet.type as 'standard' | 'warmup' | 'amrap' | 'custom' | string,
            fieldOrder: this.workoutService.getRepsAndWeightFields()
          };
        }) : [this.getFirstExerciseOfSuperset((loggedEx.supersetOrder || 0), loggedEx.supersetId, loggedExercises)],
        type: (sessionExercise?.supersetId ?? 0) ? 'superset' : 'standard'
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
      const targetDuration = this.activeSetInfo()?.setData?.targetDuration;
      if (targetDuration && getDurationValue(targetDuration) > 0) {
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
        const targetDuration = activeInfo?.setData?.targetDuration;
        const enableSound = this.appSettingsService.enableTimerCountdownSound();
        const countdownFrom = this.appSettingsService.countdownSoundSeconds();

        if (enableSound && targetDuration && getDurationValue(targetDuration) > 20 && currentElapsed > 0) {
          const remainingSeconds = getDurationValue(targetDuration) - currentElapsed;
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
    const targetDuration = this.activeSetInfo()?.setData?.targetDuration;
    this.currentSetForm.get('actualDuration')?.setValue(targetDuration ?? 0, { emitEvent: false });
    this.soundPlayedForThisCountdownSegment = false;
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

    if (activeInfo.exerciseData.sessionStatus && activeInfo.exerciseData.sessionStatus !== 'pending') {
      return true;
    }

    const currentExercise = routine.exercises[activeInfo.exerciseIndex];
    if (activeInfo.setIndex === currentExercise.sets.length - 1) return true;

    for (let i = activeInfo.setIndex + 1; i < currentExercise.sets.length; i++) {
      if (currentExercise.sets[i].type !== 'warmup') {
        return false;
      }
    }
    return true;
  }

  checkIfLatestSetOfRound(): boolean {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    if (!activeInfo || !routine) return false;

    const currentExercise = routine.exercises[activeInfo.exerciseIndex];

    if (!currentExercise.supersetId) {
      return this.checkIfLatestSetOfExercise();
    }

    let blockStartIdx = activeInfo.exerciseIndex;
    let blockEndIdx = activeInfo.exerciseIndex;
    if (currentExercise.supersetId && currentExercise.supersetOrder !== null) {
      blockStartIdx = activeInfo.exerciseIndex - currentExercise.supersetOrder;
      blockEndIdx = blockStartIdx + (currentExercise.sets.length ? currentExercise.sets.length - 1 : 0);
    }

    if (
      activeInfo.exerciseIndex === blockEndIdx &&
      activeInfo.setIndex === routine.exercises[blockEndIdx].sets.length - 1
    ) {
      return true;
    }

    return false;
  }

  checkIfLatestRoundOfRounds(): boolean {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    if (!activeInfo || !routine) return false;

    // For a superset, the "round" is the set index. The last round is the last set.
    if (activeInfo.exerciseData.supersetId) {
      return this.currentSetIndex() === activeInfo.exerciseData.sets.length - 1;
    }

    // For a standard exercise, there is only one "round".
    return true;
  }

  checkIfSetIsPartOfRounds(): boolean {
    const activeInfo = this.activeSetInfo();
    if (!activeInfo) return false;

    // Only supersets are treated as having multiple UI rounds in the player.
    return !!activeInfo.exerciseData.supersetId;
  }


  checkIfLatestSetOfWorkout(): boolean {
    return this.checkIfLatestSetOfWorkoutConsideringPending();
  }

  checkIfLatestSetOfWorkoutConsideringPending(): boolean {
    const activeInfo = this.activeSetInfo();
    const currentRoutine = this.routine();
    if (!activeInfo || !currentRoutine) return false;

    if (!this.checkIfLatestSetOfExercise()) {
      return false;
    }

    if (this.checkIfSetIsPartOfRounds() && !this.checkIfLatestRoundOfRounds()) {
      return false;
    }

    const currentExercise = activeInfo.exerciseData;
    let blockEndIndex = activeInfo.exerciseIndex;
    if (currentExercise.supersetId && currentExercise.supersetOrder !== null && currentExercise.sets.length) {
      blockEndIndex = (activeInfo.exerciseIndex - currentExercise.supersetOrder) + (currentExercise.sets.length - 1);
    }

    for (let i = blockEndIndex + 1; i < currentRoutine.exercises.length; i++) {
      const nextEx = currentRoutine.exercises[i];
      if (nextEx.sessionStatus === 'pending' && (nextEx.sets?.length ?? 0) > 0) {
        return false;
      }
    }

    const hasUnfinishedDeferred = currentRoutine.exercises.some(ex =>
      (ex.sessionStatus === 'do_later' || ex.sessionStatus === 'skipped') &&
      !this.isExerciseFullyLogged(ex)
    );

    return !hasUnfinishedDeferred;
  }

  private getUnfinishedOrDeferredExercises(sessionRoutine: Routine): any[] {
    const currentExercise = sessionRoutine.exercises[this.currentExerciseIndex()];
    const unfinishedOtherExercises = this.getUnfinishedExercises().filter(
      ex => ex.id !== currentExercise.id
    );

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

    // +++ NEW: Filter exercises for the modal view +++
    const activeSupersetId = this.activeSetInfo()?.exerciseData.supersetId;
    const processedSupersetIds = new Set<string>();

    const displayableUnfinishedExercises = mergedUnfinishedExercises.filter(ex => {
      // Rule 1: Exclude exercises from the current active superset group
      if (activeSupersetId && ex.supersetId === activeSupersetId) {
        return false;
      }
      // Rule 2: If it's part of another superset, only include the first one
      if (ex.supersetId) {
        if (processedSupersetIds.has(ex.supersetId)) {
          return false; // Already processed this group
        }
        processedSupersetIds.add(ex.supersetId);
        return ex.supersetOrder === 0;
      }
      // Rule 3: Include all standard exercises
      return true;
    });
    // +++ END: NEW FILTER LOGIC +++

    if (displayableUnfinishedExercises.length > 0) { // +++ Use the new filtered array
      let proceedWithSelectedExercise = false;
      let selectedExerciseOriginalIndex: number | undefined;
      let userChoseToFinishNow = false;
      let userCancelledChoice = false;

      if (displayableUnfinishedExercises.length === 1) { // +++ Use the new filtered array
        const singleEx = displayableUnfinishedExercises[0];
        const confirmSingle = await this.alertService.showConfirmationDialog(
          `Unfinished: ${singleEx.exerciseName}`,
          `You have "${singleEx.exerciseName}" (${singleEx.sessionStatus === 'do_later' ? 'Do Later' : 'Skipped'}) remaining. Complete it now?`,
          [
            { text: 'Complete It', role: 'confirm', data: singleEx.originalIndex, cssClass: 'bg-primary hover:bg-primary-dark text-white', icon: 'flame' } as AlertButton,
            { text: 'Finish Workout', role: 'destructive', data: 'finish_now', cssClass: 'bg-green-600 hover:bg-green-700 text-white', icon: 'done' } as AlertButton,
          ]
        );
        if (confirmSingle && typeof confirmSingle.data === 'number') {
          proceedWithSelectedExercise = true;
          selectedExerciseOriginalIndex = confirmSingle.data;
        } else if (confirmSingle && confirmSingle.data === 'finish_now') {
          userChoseToFinishNow = true;
        } else {
          userCancelledChoice = true;
        }
      } else {
        const exerciseButtons: AlertButton[] = displayableUnfinishedExercises.map(ex => { // +++ Use the new filtered array
          let statusLabel = this.getExerciseStatusIndicator(ex);
          // For superset groups, indicate it's a group.
          const supersetIndicator = ex.supersetId ? ` [Superset Group]` : '';
          const cssClass = this.getExerciseButtonCssClass(ex, ex.sessionStatus);

          return {
            text: `${ex.exerciseName}${statusLabel}${supersetIndicator}`,
            role: 'confirm',
            data: ex.originalIndex,
            cssClass: cssClass
          };
        });
        const alertButtons: AlertButton[] = [
          ...exerciseButtons,
          { text: 'Finish Workout Now', role: 'destructive', data: 'finish_now', cssClass: 'bg-green-500 hover:bg-green-600 text-white mt-4' },
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
        } else {
          userCancelledChoice = true;
        }
      }

      if (userChoseToFinishNow) {
        await this.finishWorkoutAndReportStatus();
        return;
      }

      if (userCancelledChoice) {
        mergedUnfinishedExercises.forEach(ex => {
          if (ex.sessionStatus === 'do_later') this.exercisesProposedThisCycle.doLater = true;
          if (ex.sessionStatus === 'skipped') this.exercisesProposedThisCycle.skipped = true;
        });
        this.cdr.detectChanges();
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
        this.currentBlockRound.set(1);
        const newBlockStarter = updatedRoutine.exercises[selectedExerciseOriginalIndex];
        if (!newBlockStarter.supersetId || newBlockStarter.supersetOrder === 0) {
          this.totalBlockRounds.set(this.getRoundsForExerciseBlock(selectedExerciseOriginalIndex, updatedRoutine));
        } else {
          const actualBlockStart = updatedRoutine.exercises.find(ex => ex.supersetId === newBlockStarter.supersetId && ex.supersetOrder === 0);
          this.totalBlockRounds.set(this.getRoundsForExerciseBlock(selectedExerciseOriginalIndex, updatedRoutine));
        }
        this.lastPerformanceForCurrentExercise = null;
        this.playerSubState.set(PlayerSubState.PerformingSet);
        await this.prepareCurrentSet();
        return;
      }
    }

    const currentExercisesLength = this.currentWorkoutLogExercises().length;

    if (currentExercisesLength === 0) {
      this.forceStartOnEmptyWorkout();
      return;
    }

    const endCurrentWorkout = await this.alertService.showConfirmationDialog(
      `Continue or End`,
      'The current session is finished! Would you like to add a new exercise or complete it?',
      [
        { text: 'Add exercise', role: 'add_exercise', data: 'add_exercise', cssClass: 'bg-primary hover:bg-primary-dark text-white', icon: 'plus-circle', iconClass: 'h-8 w-8 mr-1' } as AlertButton,
        { text: 'End session', role: 'end_session', data: "end_session", cssClass: 'bg-green-500 hover:bg-green-600 text-white', icon: 'done', iconClass: 'h-8 w-8 mr-1' } as AlertButton,
      ],
    );

    if (endCurrentWorkout && endCurrentWorkout.role === 'end_session') {
      await this.finishWorkoutAndReportStatus();
    } else {
      this.isEndReached.set(true);
      this.openExerciseSelectionModal();
    }
  }

  public getNumberOfLoggedSets(id: string, filterOutType?: string): number {
    const loggedExercise = this.currentWorkoutLogExercises().find(loggedEx =>
      loggedEx.id === id
    );

    if (!loggedExercise) {
      return 0;
    }

    if (filterOutType) {
      return loggedExercise.sets ? loggedExercise.sets.filter(set => set.type !== filterOutType).length : 1;
    } else {
      return loggedExercise.sets?.length || 0;
    }
  }

  private isExercisePartiallyLogged(currentExercise: WorkoutExercise): boolean {
    const loggedEx = this.currentWorkoutLogExercises().find(le => le.id === currentExercise.id);
    if (!loggedEx || loggedEx.sets.length === 0) {
      return false;
    }

    const totalPlannedCompletions = currentExercise.sets.length;
    return loggedEx.sets.length < totalPlannedCompletions;
  }

  private isExerciseFullyLogged(currentExercise: WorkoutExercise): boolean {
    const routine = this.routine();
    if (!routine) return false;

    const loggedEx = this.currentWorkoutLogExercises().find(le => le.id === currentExercise.id);
    if (!loggedEx) return false;

    // The total planned sets is now simply the length of the sets array.
    const totalPlannedCompletions = currentExercise.sets.length;

    return loggedEx.sets.length >= totalPlannedCompletions;
  }

  private findFirstUnloggedSetIndex(exerciseId: string, plannedSetIds: string[]): number | null {
    const loggedEx = this.currentWorkoutLogExercises().find(le => le.id === exerciseId);
    if (!loggedEx) return 0;

    const loggedPlannedSetIds = new Set(loggedEx.sets.map(s => s.plannedSetId));
    for (let i = 0; i < plannedSetIds.length; i++) {
      if (!loggedPlannedSetIds.has(plannedSetIds[i])) {
        return i;
      }
    }
    return null;
  }

  private async fetchLastPerformanceAndPatchForm(): Promise<void> {
    await this.prepareCurrentSet();
  }

  private patchCurrentSetFormWithData(activeInfo: ActiveSetInfo): void {
    this.patchActualsFormBasedOnSessionTargets();
  }

  startEditTarget(field: METRIC): void {
    const activeInfo = this.activeSetInfo();
    if (!activeInfo) return;
    this.editingTarget = field;
    switch (field) {
      case METRIC.reps: this.editingTargetValue = repsTargetAsString(activeInfo.setData.targetReps) ?? ''; break;
      case METRIC.weight: this.editingTargetValue = getWeightValue(activeInfo.setData.targetWeight) ?? ''; break;
      case METRIC.duration: this.editingTargetValue = getDurationValue(activeInfo.setData.targetDuration) ?? ''; break;
      case METRIC.distance: this.editingTargetValue = getDistanceValue(activeInfo.setData.targetDistance) ?? ''; break;
      case METRIC.rest: this.editingTargetValue = getRestValue(activeInfo.setData.targetRest) ?? ''; break;
    }
  }

  cancelEditTarget(): void {
    this.editingTarget = null;
    this.editingTargetValue = '';
  }

  formatPbValue(pb: PersonalBestSet): string {
    let value = '';
    if (pb.weightLogged !== undefined && pb.weightLogged !== null) {
      value += `${pb.weightLogged}${this.unitService.getWeightUnitSuffix()}`;
      if (pb.repsLogged && repsTypeToReps(pb.repsLogged) > 1 && !pb.pbType.includes('RM (Actual)')) {
        value += ` x ${pb.repsLogged}`;
      }
    } else if (pb.repsLogged && pb.pbType.includes('Max Reps')) {
      value = `${pb.repsLogged} reps`;
    } else if (pb.durationLogged && getDurationValue(pb.durationLogged) > 0 && pb.pbType.includes('Max Duration')) {
      value = `${pb.durationLogged}s`;
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
    if (this.emomRoundTimerSub) this.emomRoundTimerSub.unsubscribe();

    this.showNotes.set(false);
    if (this.sessionState() === SessionState.Paused) {
      return;
    }
    const sessionRoutine = this.routine();
    if (!sessionRoutine || sessionRoutine.exercises.length === 0) {
      this.sessionState.set(SessionState.Error);
      return;
    }
    let exIndex = this.currentExerciseIndex();
    let sIndex = this.currentSetIndex();

    // This logic correctly finds the next playable set.
    if (sessionRoutine.exercises[exIndex]?.sessionStatus !== 'pending') {
      const firstPendingInfo = this.findFirstPendingExerciseAndSet(sessionRoutine);
      if (firstPendingInfo) {
        exIndex = firstPendingInfo.exerciseIndex;
        sIndex = firstPendingInfo.setIndex;
        this.currentExerciseIndex.set(exIndex);
        this.currentSetIndex.set(sIndex);
        this.currentBlockRound.set(firstPendingInfo.round);
        this.isPerformingDeferredExercise = false;
      } else {
        await this.tryProceedToDeferredExercisesOrFinish(sessionRoutine);
        return;
      }
    }

    if (exIndex >= sessionRoutine.exercises.length || !sessionRoutine.exercises[exIndex] || !sessionRoutine.exercises[exIndex].sets[sIndex]) {
      this.currentSetForm.reset({ rpe: null, setNotes: '' });
      this.resetTimedSet();
      this.currentBaseExercise.set(null);
      this.exercisePBs.set([]);
      this.lastPerformanceForCurrentExercise = null;
      this.rpeValue.set(null);
      this.showRpeSlider.set(false);
      await this.tryProceedToDeferredExercisesOrFinish(sessionRoutine);
      return;
    }
    const currentExerciseData = sessionRoutine.exercises[exIndex];
    const currentPlannedSetData = currentExerciseData.sets[sIndex];
    const originalExerciseForSuggestions = this.originalRoutineSnapshot?.exercises.find(oe => oe.exerciseId === currentExerciseData.exerciseId) || currentExerciseData;
    const plannedSetForSuggestions = originalExerciseForSuggestions?.sets[sIndex] || currentPlannedSetData;
    this.loadBaseExerciseAndPBs(currentExerciseData.exerciseId);
    if (!this.lastPerformanceForCurrentExercise || this.lastPerformanceForCurrentExercise.sets[0]?.exerciseId !== currentExerciseData.exerciseId) {
      this.lastPerformanceForCurrentExercise = await firstValueFrom(this.trackingService.getLastPerformanceForExercise(currentExerciseData.exerciseId).pipe(take(1)));
    }
    const historicalSetPerformance = this.trackingService.findPreviousSetPerformance(this.lastPerformanceForCurrentExercise, plannedSetForSuggestions, sIndex);
    let finalSetParamsForSession: ExerciseTargetSetParams;
    if (plannedSetForSuggestions.type === 'warmup') {
      finalSetParamsForSession = { ...plannedSetForSuggestions };
    } else {
      const progressiveOverloadSettings = this.progressiveOverloadService.getSettings();
      if (progressiveOverloadSettings && progressiveOverloadSettings.enabled) {
        finalSetParamsForSession = this.workoutService.suggestNextSetParameters(historicalSetPerformance, plannedSetForSuggestions);
      } else {
        if (historicalSetPerformance && currentExerciseData.exerciseName && currentExerciseData.exerciseName.toLowerCase().indexOf('kb') < 0) {
          finalSetParamsForSession = {
            ...plannedSetForSuggestions,
            targetReps: historicalSetPerformance.repsLogged || plannedSetForSuggestions.targetReps || genRepsTypeFromRepsNumber(0),
            targetWeight: historicalSetPerformance.weightLogged || plannedSetForSuggestions.targetWeight || weightToExact(0),
            targetDuration: historicalSetPerformance.durationLogged || plannedSetForSuggestions.targetDuration || durationToExact(0),
            targetRest: plannedSetForSuggestions.targetRest || restToExact(0)
          };
        } else {
          finalSetParamsForSession = {
            ...plannedSetForSuggestions,
            targetReps: plannedSetForSuggestions.targetReps || genRepsTypeFromRepsNumber(0),
            targetWeight: plannedSetForSuggestions.targetWeight || weightToExact(0),
            targetDuration: plannedSetForSuggestions.targetDuration || durationToExact(0),
            targetRest: plannedSetForSuggestions.targetRest || restToExact(0)
          };
        }
      }
    }
    if (this.intensityAdjustment && this.originalRoutineSnapshot?.exercises.some(ex => ex.id === currentExerciseData.id)) {
      const { direction, percentage } = this.intensityAdjustment;
      const multiplier = direction === 'increase' ? 1 + (percentage / 100) : 1 - (percentage / 100);
      if (finalSetParamsForSession.targetWeight !== null && finalSetParamsForSession.targetWeight !== undefined) {
        const adjustedWeight = Math.round((getWeightValue(finalSetParamsForSession.targetWeight) * multiplier) * 4) / 4;
        finalSetParamsForSession.targetWeight = weightToExact(adjustedWeight >= 0 ? adjustedWeight : 0);
      }
      if (finalSetParamsForSession.targetReps) {
        const adjustedReps = Math.round(repsTypeToReps(finalSetParamsForSession.targetReps) * multiplier);
        finalSetParamsForSession.targetReps = adjustedReps >= 0 ? genRepsTypeFromRepsNumber(adjustedReps) : genRepsTypeFromRepsNumber(0);
      }
      if (finalSetParamsForSession.targetDuration) {
        const adjustedDuration = Math.round(getDurationValue(finalSetParamsForSession.targetDuration) * multiplier);
        finalSetParamsForSession.targetDuration = durationToExact(adjustedDuration >= 0 ? adjustedDuration : 0);
      }
    }
    finalSetParamsForSession.id = currentPlannedSetData.id;
    finalSetParamsForSession.type = currentPlannedSetData.type;
    finalSetParamsForSession.notes = currentPlannedSetData.notes || finalSetParamsForSession.notes;
    const updatedRoutineForSession = JSON.parse(JSON.stringify(sessionRoutine)) as Routine;
    if (!updatedRoutineForSession.exercises[exIndex].sets?.some(set => set.targetDuration)) {
      updatedRoutineForSession.exercises[exIndex].sets[sIndex] = finalSetParamsForSession;
    }
    this.routine.set(updatedRoutineForSession);
    this.patchActualsFormBasedOnSessionTargets();

    if (this.sessionState() !== SessionState.Playing && this.sessionState() !== SessionState.Paused) {
      this.sessionState.set(SessionState.Playing);
    }
    this.playerSubState.set(PlayerSubState.PerformingSet);

    // --- MODIFICATION START: Restore the EMOM timer start logic ---
    const supersetBlock = this.activeSupersetBlock();
    if (supersetBlock && supersetBlock[0]?.supersetType === 'emom') {
      const firstExerciseInBlock = supersetBlock[0];
      const roundDuration = firstExerciseInBlock?.emomTimeSeconds;
      if (roundDuration && roundDuration > 0) {
        this.startEmomRoundTimer(roundDuration);
      }
    }
    // --- MODIFICATION END ---
  }


  private findFirstPendingExerciseAndSet(routine: Routine): { exerciseIndex: number; setIndex: number; round: number } | null {
    if (!routine || !routine.exercises) return null;

    for (let exIndex = 0; exIndex < routine.exercises.length; exIndex++) {
      const exercise = routine.exercises[exIndex];
      if (exercise.sessionStatus !== 'pending' || !exercise.sets || exercise.sets.length === 0) {
        continue;
      }

      const loggedEx = this.currentWorkoutLogExercises().find(le => le.id === exercise.id);
      const loggedPlannedSetIds = new Set(loggedEx?.sets.map(s => s.plannedSetId));

      for (let setIdx = 0; setIdx < exercise.sets.length; setIdx++) {
        const plannedSetId = exercise.sets[setIdx].id;
        // For supersets, each logged set is unique per round (set index)
        const targetLoggedId = exercise.supersetId ? `${plannedSetId}-round-${setIdx}` : plannedSetId;

        if (!loggedPlannedSetIds.has(targetLoggedId)) {
          if (exercise.supersetId) {
            const firstInGroupIndex = routine.exercises.findIndex(e => e.supersetId === exercise.supersetId && e.supersetOrder === 0);
            // For superset, the starting exercise is the first in the block, and the starting set is the one we found.
            return { exerciseIndex: firstInGroupIndex !== -1 ? firstInGroupIndex : exIndex, setIndex: setIdx, round: setIdx + 1 };
          }
          // For a standard exercise, we start at the exercise itself and the found set.
          return { exerciseIndex: exIndex, setIndex: setIdx, round: setIdx + 1 };
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
    this.currentSetForm.patchValue({ rpe: null }, { emitEvent: false });
    this.rpeValue.set(null);
    this.showRpeSlider.set(false);
    this.resetTimedSet();

    const activeInfo = this.activeSetInfo();
    if (!activeInfo) return;

    const completedExerciseLog = this.currentWorkoutLogExercises().find(logEx => logEx.exerciseId === activeInfo.exerciseData.exerciseId);
    const completedSetLogThisSession = completedExerciseLog?.sets.find(logSet => logSet.plannedSetId === activeInfo.setData.id);

    // Default to the minimum of the range if available, otherwise the single value.
    let initialActualReps = activeInfo.setData.targetReps ?? null;
    let initialActualDuration = activeInfo.setData.targetDuration ?? null;

    if (completedSetLogThisSession) {
      if (completedSetLogThisSession.durationLogged !== undefined) {
        initialActualDuration = completedSetLogThisSession.durationLogged;
      }
      if (completedSetLogThisSession.repsLogged !== undefined) {
        initialActualReps = completedSetLogThisSession.repsLogged;
      }
    }

    let weightForForm: number | null | undefined = getWeightValue(activeInfo.setData.targetWeight);
    if (weightForForm === null || weightForForm === undefined) {
      const allLoggedSetsForThisEx = this.currentWorkoutLogExercises()
        .find(exLog => exLog.exerciseId === activeInfo.exerciseData.exerciseId)?.sets || [];

      const previousLoggedSetsInSessionForThisExercise = allLoggedSetsForThisEx.filter(s => {
        const plannedSetOfLogged = activeInfo.exerciseData.sets.find(ps => ps.id === s.plannedSetId);
        return plannedSetOfLogged && activeInfo.exerciseData.sets.indexOf(plannedSetOfLogged) < activeInfo.setIndex;
      }).sort((a, b) => activeInfo.exerciseData.sets.findIndex(s => s.id === a.plannedSetId) - activeInfo.exerciseData.sets.findIndex(s => s.id === b.plannedSetId));


      if (previousLoggedSetsInSessionForThisExercise.length > 0) {
        const lastActualPrevSet = previousLoggedSetsInSessionForThisExercise[previousLoggedSetsInSessionForThisExercise.length - 1];
        if (lastActualPrevSet.weightLogged !== null && lastActualPrevSet.weightLogged !== undefined) {
          weightForForm = getWeightValue(lastActualPrevSet.weightLogged);
        }
      } else if (activeInfo.type === 'warmup' && (activeInfo.setData.targetWeight === null || activeInfo.setData.targetWeight === undefined)) {
        weightForForm = activeInfo.setData.targetWeight ?? null;
      }
    }

    if (completedSetLogThisSession) {
      this.currentSetForm.patchValue({
        actualReps: completedSetLogThisSession.repsLogged,
        actualWeight: completedSetLogThisSession.weightLogged,
        actualDuration: initialActualDuration,
        setNotes: completedSetLogThisSession.notes ?? '',
        rpe: completedSetLogThisSession.rpe
      }, { emitEvent: false });
      if (completedSetLogThisSession.rpe) this.rpeValue.set(completedSetLogThisSession.rpe);
    } else {
      this.currentSetForm.patchValue({
        actualReps: initialActualReps ?? (activeInfo.type === 'warmup' ? 8 : null),
        actualWeight: weightForForm ?? null,
        actualDuration: initialActualDuration,
        setNotes: activeInfo.setData.notes || (activeInfo.type === 'warmup' ? 'Warm-up' : ''),
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
      case 'reps': setToUpdate.targetReps = genRepsTypeFromRepsNumber(numericValue); break;
      case 'weight': setToUpdate.targetWeight = weightToExact(numericValue); break;
      case 'duration': setToUpdate.targetDuration = durationToExact(numericValue); break;
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

    if (activeInfo.setData.targetDuration && getDurationValue(activeInfo.setData.targetDuration) > 0 &&
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

    const formValues = this.currentSetForm.value;

    let durationToLog = formValues.actualDuration;
    if (activeInfo.setData.targetDuration && getDurationValue(activeInfo.setData.targetDuration) > 0 && this.timedSetElapsedSeconds() > 0) {
      durationToLog = this.timedSetElapsedSeconds();
    } else if (formValues.actualDuration === null && activeInfo.setData.targetDuration) {
      durationToLog = activeInfo.setData.targetDuration;
    }

    const isMultiRound = this.checkIfSetIsPartOfRounds();

    const loggedSetData: LoggedSet = {
      id: uuidv4(),
      exerciseName: activeInfo.exerciseData.exerciseName,
      plannedSetId: isMultiRound
        ? `${activeInfo.setData.id}-round-${this.getIndexedCurrentBlock()}`
        : activeInfo.setData.id,
      exerciseId: activeInfo.exerciseData.exerciseId,
      type: activeInfo.setData.type,
      repsLogged: formValues.actualReps ?? (activeInfo.setData.type === 'warmup' ? 0 : activeInfo.setData.targetReps ?? 0),
      weightLogged: formValues.actualWeight ?? (activeInfo.setData.type === 'warmup' ? null : activeInfo.setData.targetWeight),
      durationLogged: durationToLog,
      rpe: formValues.rpe ?? undefined,
      targetReps: activeInfo.setData.targetReps,
      targetWeight: activeInfo.setData.targetWeight,
      targetDuration: activeInfo.setData.targetDuration,
      targetTempo: activeInfo.setData.targetTempo,
      targetRest: activeInfo.setData.targetRest,
      notes: formValues.setNotes?.trim() || undefined,
      timestamp: new Date().toISOString(),
      fieldOrder: this.workoutService.getRepsAndWeightFields()
    };
    this.addLoggedSetToCurrentLog(activeInfo.exerciseData, loggedSetData);

    // --- MODIFICATION START ---
    // Manually trigger change detection here to force progress bar update for standard sets.
    this.cdr.detectChanges();
    // --- MODIFICATION END ---

    if (this.sessionState() === SessionState.Playing) {
      this.captureAndSaveStateForUnload();
    }

    this.rpeValue.set(null);
    this.showRpeSlider.set(false);
    this.editingTarget = null;
    this.currentSetForm.patchValue({ setNotes: '' }, { emitEvent: false });

    this.navigateToNextStepInWorkout(activeInfo, currentRoutineValue);
  }


  getIndexedCurrentBlock(): number {
    return (this.currentBlockRound() ?? 1) - 1;
  }

  // Helper to get round info for an exercise (handles supersets)
  protected getRoundInfo(ex: WorkoutExercise): { round: number, totalRounds: number } {
    const totalRounds = this.routine() ? this.getRoundsForExerciseBlock(this.routine()!.exercises.indexOf(ex), this.routine()!) : 1;

    // For supersets, the current round is the current set index + 1.
    // For standard exercises, it's always "1".
    const round = ex.supersetId ? this.currentSetIndex() + 1 : 1;

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
    const weight = activeInfo.setData.targetWeight ? `, ${activeInfo.setData.targetWeight} ${this.weightUnitDisplaySymbol}` : '';
    const duration = activeInfo.setData.targetDuration ? `, ${activeInfo.setData.targetDuration} seconds` : '';

    // Construct the final descriptive string.
    return `${setTypeLabel} ${currentSetOfType}/${totalSetsOfType} of ${exerciseName}${roundText}${weight}${duration}`;
  }

  getNextUpText(completedActiveSetInfo: ActiveSetInfo | null, currentSessionRoutine: Routine | null): string {
    if (!completedActiveSetInfo || !currentSessionRoutine) return 'Next Set/Exercise';

    const exercises = currentSessionRoutine.exercises;
    const currExIdx = completedActiveSetInfo.exerciseIndex;
    const currSetIdx = completedActiveSetInfo.setIndex;
    const currExercise = exercises[currExIdx];

    // Helper to check if an exercise is pending
    const isPending = (ex: WorkoutExercise) => ex.sessionStatus === 'pending';

    // Find next set in current STANDARD exercise
    if (!currExercise.supersetId && currSetIdx + 1 < currExercise.sets.length) {
      const nextSet = currExercise.sets[currSetIdx + 1];
      const setType = nextSet.type === 'warmup' ? "Warm-up" : "Set";
      const setNumber = currSetIdx + 2;
      return `${setType} ${setNumber}/${currExercise.sets.length} of ${currExercise.exerciseName}`;
    }

    // Find next exercise/block
    const nextPendingExIndex = this.findFirstPendingExerciseIndexAfter(currExIdx, currentSessionRoutine);
    if (nextPendingExIndex !== -1) {
      const nextEx = exercises[nextPendingExIndex];
      return `Next: ${nextEx.exerciseName}`;
    }

    // If no more pending, check for do_later/skipped
    const hasDoLater = exercises.some(ex => ex.sessionStatus === 'do_later' && !this.isExerciseFullyLogged(ex));
    if (hasDoLater) return 'Do Later Exercises';

    const hasSkipped = exercises.some(ex => ex.sessionStatus === 'skipped' && !this.isExerciseFullyLogged(ex));
    if (hasSkipped) return 'Skipped Exercises';

    return 'Workout Complete!';
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

    // --- MODIFICATION START: Handle EMOM timer state on session pause ---
    if (this.activeSupersetBlock()?.[0]?.supersetType === 'emom') {
      this.wasEmomTimerRunningOnPause = this.emomTimerState() === 'running';
      this.emomTimerState.set('paused');
    }
    // --- MODIFICATION END ---

    this.wasRestTimerVisibleOnPause = this.isRestTimerVisible();
    if (this.wasRestTimerVisibleOnPause) {
      this.restTimerRemainingSecondsOnPause = this.restDuration();
      this.restTimerInitialDurationOnPause = this.restDuration();
      this.restTimerMainTextOnPause = this.restTimerMainText();
      this.restTimerNextUpTextOnPause = this.restTimerNextUpText();
      this.isRestTimerVisible.set(false);
    }
    this.stopAutoSave();
    this.sessionState.set(SessionState.Paused);
    this.savePausedSessionState();
    this.toastService.info("Workout Paused", 3000);
  }

  private async loadStateFromPausedSession(state: PausedWorkoutState): Promise<void> {
    this.routineId = state.routineId;
    this.routine.set(state.sessionRoutine);
    this.originalRoutineSnapshot = state.originalWorkoutExercises ? JSON.parse(JSON.stringify(state.originalWorkoutExercises)) : null;

    // Load the log data first, as it's crucial for finding the next unlogged set
    if (state.currentWorkoutLogExercises && state.currentWorkoutLogExercises.length > 0) {
      this.currentWorkoutLogExercises.set(state.currentWorkoutLogExercises);
    } else {
      this.currentWorkoutLogExercises.set([]);
    }

    // --- NEW: INTELLIGENT RESUME LOGIC ---
    // Find the first exercise that is not fully logged yet.
    const firstUnfinishedInfo = this.findFirstPendingExerciseAndSet(state.sessionRoutine);

    if (firstUnfinishedInfo) {
      // The helper now provides the definitive starting point.
      this.currentExerciseIndex.set(firstUnfinishedInfo.exerciseIndex);
      this.currentSetIndex.set(firstUnfinishedInfo.setIndex);
      this.currentBlockRound.set(firstUnfinishedInfo.round);
    } else {
      // All sets are logged; proceed to finish flow.
      this.sessionState.set(SessionState.End);
      await this.tryProceedToDeferredExercisesOrFinish(state.sessionRoutine);
      return;
    }

    // --- START MODIFICATION ---
    // Restore the original start time. This is critical for the final log.
    this.originalSessionStartTime = state.workoutStartTimeOriginal || Date.now();

    // The workoutStartTime for the timer calculation is reset to now.
    this.workoutStartTime = Date.now();
    this.sessionTimerElapsedSecondsBeforePause = state.sessionTimerElapsedSecondsBeforePause;
    // --- END MODIFICATION ---

    // Set totalBlockRounds based on the determined starting exercise
    const startingExercise = state.sessionRoutine.exercises[this.currentExerciseIndex()];
    if (startingExercise.supersetId) {
      const blockStart = state.sessionRoutine.exercises.find(ex => ex.supersetId === startingExercise.supersetId && ex.supersetOrder === 0);
      this.totalBlockRounds.set(this.getRoundsForExerciseBlock(this.currentExerciseIndex(), state.sessionRoutine));
    } else {
      this.totalBlockRounds.set(this.getRoundsForExerciseBlock(this.currentExerciseIndex(), state.sessionRoutine));
    }

    if (state.timedSetTimerState) {
      this.timedSetTimerState.set(state.timedSetTimerState);
    }
    if (state.timedSetElapsedSeconds) {
      this.timedSetElapsedSeconds.set(state.timedSetElapsedSeconds);
    }

    // ... (rest of the state restoration logic remains the same) ...
    this.wasTimedSetRunningOnPause = state.timedSetTimerState === TimedSetState.Running || state.timedSetTimerState === TimedSetState.Paused;
    this.wasRestTimerVisibleOnPause = state.isRestTimerVisibleOnPause;
    this.restTimerRemainingSecondsOnPause = state.restTimerRemainingSecondsOnPause || 0;
    this.restTimerInitialDurationOnPause = state.restTimerInitialDurationOnPause || 0;
    this.restTimerMainTextOnPause = state.restTimerMainTextOnPause || '';
    this.restTimerNextUpTextOnPause = state.restTimerNextUpTextOnPause;

    this.exercisesProposedThisCycle = { doLater: false, skipped: false };
    this.isPerformingDeferredExercise = false;
    this.lastActivatedDeferredExerciseId = null;

    // Now prepare the set at the newly determined correct starting point
    await this.prepareCurrentSet();

    if (this.sessionState() !== SessionState.Error) {
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
    // this.toastService.success('Workout session resumed', 3000, "Resumed");
  }

  private savePausedSessionState(): void {
    if (!this.routine() || !this.routine()?.exercises || this.routine()?.exercises.length === 0) return;
    if (this.sessionState() === SessionState.End || !this.routine()) return;

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
    const firstLoggedSetTime = this.currentWorkoutLogExercises() ? this.currentWorkoutLogExercises()[0]?.sets[0]?.timestamp : format(new Date(), 'yyyy-MM-dd');
    const baseTimeForDate = firstLoggedSetTime ? new Date(firstLoggedSetTime) : (this.workoutStartTime > 0 ? new Date(this.workoutStartTime - (this.sessionTimerElapsedSecondsBeforePause * 1000)) : new Date());
    dateToSaveInState = format(baseTimeForDate, 'yyyy-MM-dd');


    const stateToSave: PausedWorkoutState = {
      version: this.workoutService.getPausedVersion(),
      routineId: this.routineId,
      sessionRoutine: JSON.parse(JSON.stringify(currentRoutine)), // Includes sessionStatus
      originalWorkoutExercises: JSON.parse(JSON.stringify(this.originalRoutineSnapshot)),
      currentExerciseIndex: this.currentExerciseIndex(),
      currentSetIndex: this.currentSetIndex(),
      currentWorkoutLogExercises: JSON.parse(JSON.stringify(this.currentWorkoutLogExercises())),
      workoutStartTimeOriginal: this.originalSessionStartTime,
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
    };

    this.workoutService.savePausedWorkout(stateToSave);
    // this.storageService.setItem(this.PAUSED_WORKOUT_KEY, stateToSave);
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
      const newWarmupSet: ExerciseTargetSetParams = {
        id: `warmup-${uuidv4()}`, type: 'warmup', targetReps: genRepsTypeFromRepsNumber(8), targetWeight: weightToExact(0),
        targetDuration: undefined, targetRest: restToExact(30), notes: 'Warm-up set',
        fieldOrder: this.workoutService.getRepsAndWeightFields()
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
        supersetId: null,
        supersetOrder: null,
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
    const newWarmupSet: ExerciseTargetSetParams = {
      id: `warmup-${uuidv4()}`, type: 'warmup', targetReps: genRepsTypeFromRepsNumber(8), targetWeight: weightToExact(0), // Default weight 0 for warm-up
      targetDuration: undefined, targetRest: restToExact(30), notes: 'Warm-up set',
      fieldOrder: this.workoutService.getRepsAndWeightFields()
    };
    const updatedRoutineForSession = JSON.parse(JSON.stringify(currentRoutineVal)) as Routine;
    const exerciseToUpdate = updatedRoutineForSession.exercises[activeInfo.exerciseIndex];
    exerciseToUpdate.sets.splice(activeInfo.setIndex, 0, newWarmupSet);
    this.routine.set(updatedRoutineForSession);
    this.toastService.success("Warm-up set added. Fill details & complete", 4000, "Warm-up Added");
    await this.prepareCurrentSet(); // This will use the new currentSetIndex implicitly
    this.closeWorkoutMenu(); this.closePerformanceInsights();
  }

  getSets(): ExerciseTargetSetParams[] {
    const activeSet = this.activeSetInfo();
    const sets = activeSet?.exerciseData.sets || [];
    return activeSet?.setData.type === 'warmup' ? sets.filter(exer => exer.type !== 'warmup') : sets;
  }

  getWarmUpSets(): ExerciseTargetSetParams[] {
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

    // --- NEW: SUPERSET LOGIC FOR SKIPPING A ROUND ---
    if (activeInfo.exerciseData.supersetId) {
      const confirmSkipRound = await this.alertService.showConfirmationDialog(
        "Skip Current Round",
        `This will remove any sets you've already logged for the current round of this superset. This action cannot be undone. Do you want to continue?`,
        [
          { text: "Cancel", role: "cancel" },
          { text: "Skip Round", role: "destructive", data: "skip_round" }
        ]
      );
      if (!confirmSkipRound || confirmSkipRound.data !== 'skip_round') {
        this.closeWorkoutMenu();
        return;
      }

      const supersetId = activeInfo.exerciseData.supersetId;
      const currentRound = this.currentBlockRound();

      // Remove logged sets from this specific round
      this.currentWorkoutLogExercises.update(logs => {
        const newLogs = JSON.parse(JSON.stringify(logs));
        newLogs.forEach((exLog: LoggedWorkoutExercise) => {
          if (exLog.supersetId === supersetId) {
            // Filter out sets matching the current round index
            exLog.sets = exLog.sets.filter((s, index) => index !== (currentRound - 1));
          }
        });
        return newLogs;
      });

      this.toastService.info(`Skipped round ${currentRound} of the superset.`, 2500, "Round Skipped");
      // Force navigation to the next block of exercises
      await this.navigateToNextStepInWorkout(activeInfo, currentRoutineVal, true);
      this.closeWorkoutMenu();
      this.closePerformanceInsights();
      return; // End execution here
    }
    // --- END: SUPERSET LOGIC ---

    if (activeInfo.setIndex === activeInfo.exerciseData.sets.length - 1 && activeInfo.exerciseData.sessionStatus === 'pending') {
      const confirmSkipEx = await this.alertService.showConfirmationDialog(
        "Last Set",
        `This is the last set of "${activeInfo.exerciseData.exerciseName}". Skip the entire exercise instead?`,
        [
          { text: "Skip Set Only", role: "cancel", data: "skip_set" },
          { text: "Skip Exercise", role: "confirm", data: "skip_exercise", cssClass: "bg-orange-500" }
        ]
      );
      if (confirmSkipEx && confirmSkipEx.data === "skip_exercise") {
        await this.markCurrentExerciseStatus('skipped');
        this.closeWorkoutMenu();
        return;
      } else if (!confirmSkipEx || (confirmSkipEx.role === 'cancel' && confirmSkipEx.data !== "skip_set")) {
        return;
      }
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
    const activeInfo = this.activeSetInfo();
    const isSuperset = !!activeInfo?.exerciseData.supersetId;

    if (isSuperset) {
      const confirm = await this.alertService.showConfirm(
        "Skip Superset",
        "This will skip all remaining rounds of the entire superset. Are you sure?"
      );
      if (!confirm || !confirm.data) {
        this.closeWorkoutMenu();
        return;
      }
    }
    // The second argument flags that the action should apply to the whole superset
    await this.markCurrentExerciseStatus('skipped', isSuperset);
  }

  async markCurrentExerciseDoLater(): Promise<void> {
    await this.markCurrentExerciseStatus('do_later');
  }

  async markCurrentExerciseStatus(status: 'skipped' | 'do_later', isSupersetAction: boolean = false): Promise<void> {
    if (this.sessionState() === 'paused') {
      this.toastService.warning(`Session is paused. Resume to mark exercise.`, 3000, "Paused"); return;
    }
    const currentRoutineVal = this.routine();
    const activeInfo = this.activeSetInfo();

    if (!currentRoutineVal || !activeInfo) {
      this.toastService.error("Cannot update exercise status: data unavailable", 0, "Error"); return;
    }

    const updatedRoutine = JSON.parse(JSON.stringify(currentRoutineVal)) as Routine;
    let statusString = status === 'skipped' ? 'Skipped' : 'Do Later';

    if (isSupersetAction && activeInfo.exerciseData.supersetId) {
      const supersetId = activeInfo.exerciseData.supersetId;
      updatedRoutine.exercises.forEach(ex => {
        if (ex.supersetId === supersetId) {
          ex.sessionStatus = status;
        }
      });
      this.toastService.info(`Superset marked as ${statusString}.`, 2000);
    } else {
      const exerciseToUpdateInSession = updatedRoutine.exercises.find(ex => ex.id === activeInfo.exerciseData.id);
      if (exerciseToUpdateInSession) {
        exerciseToUpdateInSession.sessionStatus = status;
        this.toastService.info(`"${activeInfo.exerciseData.exerciseName}" marked as ${statusString}.`, 2000);
      }
    }

    this.routine.set(updatedRoutine);
    this.resetTimedSet();

    if (this.isPerformingDeferredExercise && activeInfo.exerciseData.id === this.lastActivatedDeferredExerciseId) {
      this.isPerformingDeferredExercise = false;
      this.lastActivatedDeferredExerciseId = null;
      this.exercisesProposedThisCycle = { doLater: false, skipped: false };
      await this.tryProceedToDeferredExercisesOrFinish(updatedRoutine);
    } else {
      await this.navigateToNextStepInWorkout(activeInfo, updatedRoutine, true /* forceAdvanceExerciseBlock */);
    }

    this.closeWorkoutMenu();
    this.closePerformanceInsights();
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


    const newWorkoutExercise = await this.workoutService.promptAndCreateWorkoutExercise(selectedExercise, lastExSet);

    if (newWorkoutExercise) {
      if (selectedExercise.id.startsWith('custom-adhoc-ex-')) {
        const newExerciseToBeSaved = this.exerciseService.mapWorkoutExerciseToExercise(newWorkoutExercise, selectedExercise);
        this.exerciseService.addExercise(newExerciseToBeSaved);
      }
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
    if (!indexExists && activeInfo && activeInfo.exerciseData.supersetId && activeInfo.exerciseData.supersetOrder !== null && activeInfo.exerciseData.sets.length) {
      insertAtIndex = activeInfo.exerciseIndex - activeInfo.exerciseData.supersetOrder + activeInfo.exerciseData.sets.length;
    }
    updatedRoutine.exercises.splice(insertAtIndex, 0, newWorkoutExercise);
    this.routine.set(updatedRoutine);

    if (indexExists) {
      this.currentExerciseIndex.set(insertAtIndex);
      this.currentSetIndex.set(0);
      this.currentBlockRound.set(1);
      this.totalBlockRounds.set(this.getRoundsForExerciseBlock(insertAtIndex, updatedRoutine));
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
        this.totalBlockRounds.set(this.getRoundsForExerciseBlock(insertAtIndex, updatedRoutine));
        this.lastPerformanceForCurrentExercise = null;
        this.isPerformingDeferredExercise = true; // Treat ad-hoc added as a "deferred" type choice contextually
        this.lastActivatedDeferredExerciseId = newWorkoutExercise.id;
        this.playerSubState.set(PlayerSubState.PerformingSet);
        await this.prepareCurrentSet();
      } else {
        this.toastService.success(`"${newWorkoutExercise.exerciseName}" added to the queue.`, 3000, "Exercise Added");
      }
    }
    this.savePausedSessionState();
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
        this.removePausedWorkout()
        if (this.router.url.includes('/play')) {
          this.router.navigate(['/workout']);
        }
      }
    }
  }

  isPausedWorkoutDiscarded: boolean = false;
  removePausedWorkout(): void {
    this.workoutService.removePausedWorkout();
    this.isPausedWorkoutDiscarded = true;
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
      workoutLog.date = format(new Date(workoutLog.startTime), 'yyyy-MM-dd');
      // await this.alertService.showAlert("Workout Timing Adjusted",
      //   `Workout start time was not set. Estimated start time is ${format(new Date(workoutLog.startTime), 'MMM d, HH:mm')}. ` +
      //   `Estimated end time is ${format(new Date(workoutLog.endTime), 'MMM d, HH:mm')}. targetDuration: ${durationMinutes} minutes (${durationSeconds} seconds).`
      // )
    }
    return workoutLog;
  }

  async finishWorkoutAndReportStatus(): Promise<boolean> {
    this.stopAutoSave();
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Please resume workout before finishing", 3000, "Session Paused");
      return false; // Did not log
    }
    if (this.sessionState() === SessionState.Loading) {
      this.toastService.info("Workout is still loading", 3000, "Loading");
      return false; // Did not log
    }
    const loggedExercisesForReport = this.currentWorkoutLogExercises().filter(ex => ex.sets.length > 0);

    if (loggedExercisesForReport.length === 0) {
      this.toastService.info("No sets logged. Workout not saved", 3000, "Empty Workout");
      this.stopAllActivity(); // <-- Use centralized cleanup
      this.removePausedWorkout();
      if (this.router.url.includes('/play')) {
        this.router.navigate(['/workout']);
      }
      return false;
    }
    if (this.timerSub) this.timerSub.unsubscribe();

    const sessionRoutineValue = this.routine();
    const sessionProgramValue = this.program();
    const sessionScheduledDayProgramValue = this.scheduledDay();
    let proceedToLog = true;
    let logAsNewRoutine = false;
    let updateOriginalRoutineStructure = false;
    let newRoutineName = sessionRoutineValue?.name ? `${sessionRoutineValue.name} - ${format(new Date(), 'MMM d')}` : `Ad-hoc Workout - ${format(new Date(), 'MMM d, HH:mm')}`;

    // I have to be sure that the original routine snapshot is available, in case of reloading the page or something else
    const routineExists = this.routineId && this.routineId !== '-1' && this.routineId !== null;
    if (!this.originalRoutineSnapshot || !this.originalRoutineSnapshot?.exercises || this.originalRoutineSnapshot?.exercises.length === 0) {
      if (!routineExists) {
        this.originalRoutineSnapshot = null;
      } else {
        // try to retrieve the original routine snapshot from the storage
        if (this.routineId) {
          const routineId: string = this.routineId;
          const routineResult: Routine | undefined = await firstValueFrom(this.workoutService.getRoutineById(routineId).pipe(take(1)));
          if (routineResult && routineResult.exercises && routineResult.exercises.length > 0) {
            this.originalRoutineSnapshot = routineResult;
          }
        }
      }
    }

    const originalSnapshotToCompare = this.originalRoutineSnapshot?.exercises.filter(origEx =>
      // Only compare against original exercises that were not marked 'skipped' or 'do_later' unless they were actually logged
      sessionRoutineValue?.exercises.find(sessEx => sessEx.id === origEx.id && sessEx.sessionStatus === 'pending') ||
      loggedExercisesForReport.some(logEx => logEx.exerciseId === origEx.exerciseId)
    );


    if (this.routineId && this.originalRoutineSnapshot && this.originalRoutineSnapshot?.exercises.length > 0 && sessionRoutineValue && originalSnapshotToCompare) {
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
              { text: "Save Routine", role: "confirm", data: true, cssClass: "bg-green-600", icon: 'save' } as AlertButton
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
          { text: "Just log", role: "no_save", data: "cancel", cssClass: "bg-primary text-white", icon: 'schedule' } as AlertButton
        ],
        false

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
    // --- START MODIFICATION ---
    // Use the persistent original start time, not the transient one for the timer.
    const sessionStartTime = this.originalSessionStartTime;
    // --- END MODIFICATION ---
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

    let iterationId: string | undefined = undefined;
    if (sessionProgramValue) {
      const program = await firstValueFrom(this.trainingProgramService.getProgramById(sessionProgramValue));
      iterationId = program ? program.iterationId : undefined;
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
      scheduledDayId: sessionScheduledDayProgramValue,
      iterationId: iterationId
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
          this.removePausedWorkout()
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

    this.toastService.success(`Congrats! Workout completed!`, 5000, "Workout Finished", false);


    if (finalRoutineIdToLog) {
      const routineToUpdate = await firstValueFrom(this.workoutService.getRoutineById(finalRoutineIdToLog).pipe(take(1)));
      if (routineToUpdate) {
        let updatedRoutineData: Routine = { ...routineToUpdate, lastPerformed: new Date(sessionStartTime).toISOString() };
        if (updateOriginalRoutineStructure && !logAsNewRoutine && this.routineId === finalRoutineIdToLog) {
          updatedRoutineData.exercises = this.convertLoggedToWorkoutExercises(loggedExercisesForReport); // Use filtered logs
          // ... (persist name/desc/goal changes) ...
        }
        this.workoutService.updateRoutine(updatedRoutineData, true);
      }
    }

    this.stopAllActivity();
    this.removePausedWorkout()

    this.router.navigate(['/workout/summary', savedLog.id], {
      queryParams: { newlyCompleted: 'true' }
    });
    return true;
  }

  async quitWorkout(): Promise<void> {
    const confirmQuit = await this.alertService.showConfirm("Quit Workout", 'Quit workout? Unsaved progress (if not paused) will be lost');
    if (confirmQuit && confirmQuit.data) {
      this.stopAllActivity();
      this.isSessionConcluded = true;
      this.removePausedWorkout()
      this.closeWorkoutMenu();
      this.closePerformanceInsights();
      this.router.navigate(['/workout']);
      this.toastService.info("Workout quit. No progress saved for this session", 4000);
    }
  }

  toggleCompletedSetsInfo(): void { this.showCompletedSetsInfo.update(v => !v); }
  async openPerformanceInsights(): Promise<void> {
    if (this.sessionState() === 'paused') {
      this.toastService.warning("Session is paused. Resume to view insights", 3000, "Paused");
      return;
    }
    this.isWorkoutMenuVisible.set(false);

    const routine = this.routine();
    if (!routine) return;
    const exercise = this.activeSetInfo()?.exerciseData;
    if (!exercise) return;

    // Fetch historical data (this part was already correct, using exerciseId)
    const baseExercise$ = this.exerciseService.getExerciseById(exercise.exerciseId).pipe(take(1));
    const lastPerformance$ = this.trackingService.getLastPerformanceForExercise(exercise.exerciseId).pipe(take(1));
    const personalBests$ = this.trackingService.getAllPersonalBestsForExercise(exercise.exerciseId).pipe(take(1));

    try {
      const [baseExercise, lastPerformance, personalBests] = await Promise.all([
        lastValueFrom(baseExercise$),
        lastValueFrom(lastPerformance$),
        lastValueFrom(personalBests$)
      ]);

      if (!baseExercise) {
        // Handle case where base exercise might not be found
        return;
      }

      // *** THE CORE FIX IS HERE ***
      // Instead of finding by the instance ID, filter all logged exercises by the base exerciseId
      // and then flatten all their sets into a single array for display.
      const allLoggedInstances = this.currentWorkoutLogExercises().filter(e => e.exerciseId === exercise.exerciseId);
      const completedSetsInSession = allLoggedInstances.flatMap(e => e.sets);

      this.insightsData.set({
        exercise,
        baseExercise,
        lastPerformance,
        personalBests,
        completedSetsInSession // Use the new, correctly aggregated array
      });

      this.isPerformanceInsightsVisible.set(true);

    } catch (error) {
      console.error("Failed to load performance insights:", error);
      this.toastService.error("Could not load performance data.");
    }
  }

  closePerformanceInsights(): void {
    this.isPerformanceInsightsVisible.set(false);
    this.insightsData.set(null);
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
      this.savePausedSessionState();
      this.router.navigate(['/workout']);
      // this.alertService.showConfirm("Exit Workout?", "You have an active workout. Are you sure you want to exit? Your progress might be lost unless you pause first")
      //   .then(confirmation => {
      //     if (confirmation && confirmation.data) {
      //     }
      //   });
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

    const pausedState = this.workoutService.getPausedSession();
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

    await this.lockScreenToPortrait();
  }

  forceStartOnEmptyWorkout(): void {
    this.workoutStartTime = new Date().getTime();
    this.startAutoSave();
    this.sessionState.set(SessionState.Playing);
    this.startSessionTimer();
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
    this.originalSessionStartTime = this.workoutStartTime;
    this.sessionTimerElapsedSecondsBeforePause = 0;
    this.originalRoutineSnapshot = null;
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
          programId: queryParams.get('programId'), // This will be the ID string or null
          scheduledDayId: queryParams.get('scheduledDayId') // This will be the ID string or null
        };
      }),

      // +++ 3. The switchMap now receives the object with both IDs
      switchMap(ids => {
        const { routineId: newRoutineId, programId, scheduledDayId } = ids; // Destructure to get both IDs
        console.log('loadNewWorkoutFromRoute - paramMap emitted, newRoutineId:', newRoutineId);
        console.log('loadNewWorkoutFromRoute - paramMap emitted, scheduledDayId:', scheduledDayId);
        console.log('loadNewWorkoutFromRoute - queryParamMap emitted, programId:', programId); // You have the programId here!

        if (programId) {
          this.program.set(programId);
          if (scheduledDayId) {
            this.scheduledDay.set(scheduledDayId);
          }
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
              this.originalRoutineSnapshot = originalRoutine;
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
              return { sessionRoutineCopy: sessionCopy, programId: ids.programId, routineId: originalRoutine.id };
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
            // this.openExerciseSelectionModal();

            this.forceStartOnEmptyWorkout();
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

        let { sessionRoutineCopy, programId, routineId } = result;

        // --- START: INTEGRATED PREFILL AND PROGRESSIVE OVERLOAD LOGIC ---
        const poSettings = this.progressiveOverloadService.getSettings();
        const isPoEnabled = poSettings.enabled && poSettings.strategies && poSettings.sessionsToIncrement && poSettings.sessionsToIncrement > 0;

        // Fetch logs needed for both PO and Perceived Effort checks
        const allLogsForRoutine = (routineId && routineId !== '-1')
          ? await firstValueFrom(this.trackingService.getLogsForRoutine(routineId, isPoEnabled ? 10 : 1)) // Fetch more logs if PO is on
          : [];

        // Perceived Effort Check (using the already fetched logs)
        const lastLog = allLogsForRoutine.length > 0 ? allLogsForRoutine[0] : null;
        if (lastLog && lastLog.perceivedWorkoutInfo?.perceivedEffort) {
          const effort = lastLog.perceivedWorkoutInfo.perceivedEffort;
          let adjustmentType: 'increase' | 'decrease' | null = null;
          let dialogTitle = '', dialogMessage = '';
          if (effort >= 7) {
            adjustmentType = 'decrease'; dialogTitle = 'Last Workout Was Tough';
            dialogMessage = 'Your last session felt challenging. Would you like to automatically reduce the intensity for today?';
          } else if (effort <= 4) {
            adjustmentType = 'increase'; dialogTitle = 'Last Workout Felt Light';
            dialogMessage = 'Your last session felt light. Would you like to automatically increase the intensity for today?';
          }
          if (adjustmentType) {
            const prompt = await this.alertService.showPromptDialog(dialogTitle, dialogMessage,
              [{ name: 'percentage', type: 'number', placeholder: 'e.g., 10', value: 10, attributes: { min: '1', max: '50', step: '1' } }] as AlertInput[],
              `Adjust by %`, 'NO, THANKS');
            if (prompt && prompt['percentage']) {
              const percentage = Number(prompt['percentage']);
              this.intensityAdjustment = { direction: adjustmentType, percentage };
              this.toastService.success(`Routine intensity will be adjusted by ${percentage}%`, 3000, "Intensity Adjusted");
            }
          }
        }

        // Apply Progressive Overload and Prefill Logic
        for (const exercise of sessionRoutineCopy.exercises) {
          try {
            const lastPerformance = await firstValueFrom(this.trackingService.getLastPerformanceForExercise(exercise.exerciseId));
            if (lastPerformance && lastPerformance.sets.length > 0) {
              let overloadApplied = false;
              if (isPoEnabled) {
                const relevantLogs = allLogsForRoutine.filter(log => log.exercises.some(le => le.exerciseId === exercise.exerciseId));
                if (relevantLogs.length >= poSettings.sessionsToIncrement!) {
                  const recentLogsToCheck = relevantLogs.slice(-poSettings.sessionsToIncrement!);
                  const allSessionsSuccessful = recentLogsToCheck.every(log => {
                    const loggedEx = log.exercises.find(le => le.exerciseId === exercise.exerciseId);
                    const originalEx = this.originalRoutineSnapshot?.exercises.find(oe => oe.exerciseId === exercise.exerciseId);
                    if (!loggedEx || !originalEx || loggedEx.sets.length < originalEx.sets.length) return false;
                    return originalEx.sets.every((originalSet, setIndex) => {
                      if (originalSet.type === 'warmup') return true;
                      const loggedSet = loggedEx.sets[setIndex];
                      return loggedSet && (loggedSet.repsLogged ?? 0) >= (originalSet.targetReps ?? genRepsTypeFromRepsNumber(0));
                    });
                  });
                  if (allSessionsSuccessful) {
                    this.progressiveOverloadService.applyOverloadToExercise(exercise, poSettings);
                    this.toastService.success(`Progressive Overload applied to ${exercise.exerciseName}!`, 2500, "Auto-Increment");
                    overloadApplied = true;
                  }
                }
              }
              if (!overloadApplied) {
                exercise.sets.forEach((set, setIndex) => {
                  const historicalSet = lastPerformance.sets[setIndex];
                  if (historicalSet) {
                    set.targetReps = historicalSet.repsLogged ?? set.targetReps;
                    set.targetWeight = historicalSet.weightLogged ?? set.targetWeight;
                    set.targetDuration = historicalSet.durationLogged ?? set.targetDuration;
                    set.targetDistance = historicalSet.distanceLogged ?? set.targetDistance;
                  }
                });
              }
            }
            if (this.intensityAdjustment) {
              const { direction, percentage } = this.intensityAdjustment;
              const multiplier = direction === 'increase' ? 1 + (percentage / 100) : 1 - (percentage / 100);
              exercise.sets.forEach(set => {
                if (set.targetWeight != null) set.targetWeight = weightToExact(Math.max(0, Math.round((getWeightValue(set.targetWeight) * multiplier) * 4) / 4));
                if (set.targetReps != null) set.targetReps = genRepsTypeFromRepsNumber(Math.max(0, Math.round(repsTypeToReps(set.targetReps) * multiplier)));
                if (set.targetDuration != null) set.targetDuration = durationToExact(Math.max(0, Math.round(getDurationValue(set.targetDuration) * multiplier)));
                if (set.targetDistance != null) set.targetDistance = distanceToExact(Math.max(0, Math.round(getDistanceValue(set.targetDistance) * multiplier)));
              });
            }
          } catch (error) { console.error(`Failed to prefill data for exercise ${exercise.exerciseName}:`, error); }
        }

        console.log('loadNewWorkoutFromRoute - tap operator. Session routine copy:', sessionRoutineCopy.name);
        console.log('loadNewWorkoutFromRoute - tap operator. Program ID:', programId);

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
            this.totalBlockRounds.set(this.getRoundsForExerciseBlock(firstPending.exerciseIndex, sessionRoutineCopy));
          } else {
            const actualStart = sessionRoutineCopy.exercises.find(ex => ex.supersetId === firstEx.supersetId && ex.supersetOrder === 0);
            this.totalBlockRounds.set(this.getRoundsForExerciseBlock(firstPending.exerciseIndex, sessionRoutineCopy));
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
    const pausedState = this.workoutService.getPausedSession();
    const routeRoutineId = this.route.snapshot.paramMap.get('routineId');
    const resumeQueryParam = this.route.snapshot.queryParamMap.get('resume') === 'true';

    console.log('WorkoutPlayer.checkForPausedSession ...', !!pausedState);

    if (pausedState && pausedState.version === this.workoutService.getPausedVersion()) {
      // --- Sanity Checks for Relevancy ---
      // 1. If current route has a routineId, but paused session is ad-hoc (null routineId) -> discard paused
      if (routeRoutineId && pausedState.routineId === null) {
        console.log('WorkoutPlayer.checkForPausedSession - Current route is for a specific routine, but paused session was ad-hoc. Discarding paused session');
        this.removePausedWorkout()
        return false;
      }
      // 2. If current route is ad-hoc (null routineId), but paused session was for a specific routine -> discard paused
      if (!routeRoutineId && pausedState.routineId !== null) {
        console.log('WorkoutPlayer.checkForPausedSession - Current route is ad-hoc, but paused session was for a specific routine. Discarding paused session');
        this.removePausedWorkout();
        return false;
      }
      // 3. If both have routineIds, but they don't match -> discard paused
      if (routeRoutineId && pausedState.routineId && routeRoutineId !== pausedState.routineId) {
        console.log('WorkoutPlayer.checkForPausedSession - Paused session routine ID does not match current route routine ID. Discarding paused session');
        this.removePausedWorkout();
        return false;
      }
      // At this point, either both routineIds are null (ad-hoc match), or both are non-null and identical.

      let shouldAttemptToLoadPausedState = false;
      if (resumeQueryParam) {
        shouldAttemptToLoadPausedState = true;
        this.router.navigate([], { relativeTo: this.route, queryParams: { resume: true }, queryParamsHandling: 'merge', replaceUrl: true });
      } else if (isReEntry) {
        shouldAttemptToLoadPausedState = true;
      } else {
        const confirmation = await this.alertService.showConfirmationDialog(
          "Resume Paused Workout?",
          "You have a paused workout session. Would you like to resume it?",
          [
            { text: "Resume", role: "confirm", data: true, cssClass: "bg-green-600 hover:bg-green-700", icon: 'play', iconClass: 'h-8 w-8 mr-1' } as AlertButton,
            { text: "Discard", role: "cancel", data: false, cssClass: "bg-red-600 hover:bg-red-800", icon: 'trash', iconClass: 'h-8 w-8 mr-1' } as AlertButton
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
        this.removePausedWorkout();
        this.toastService.info('Paused session discarded', 3000);
        return false;
      }
    }
    return false;
  }

  private stopAllActivity(): void {
    this.isSessionConcluded = true; // <-- Add this line
    console.log('stopAllActivity - Stopping timers and auto-save');
    this.stopAutoSave();
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
    this.isRestTimerVisible.set(false);
    this.sessionState.set(SessionState.End);
  }

  async resumeSession(): Promise<void> {
    if (this.sessionState() === SessionState.Paused) {
      this.workoutStartTime = Date.now();
      this.sessionState.set(SessionState.Playing);
      this.startSessionTimer();
      this.startAutoSave();

      if (this.wasTimedSetRunningOnPause && this.timedSetTimerState() === TimedSetState.Paused) {
        this.startOrResumeTimedSet();
      }
      this.wasTimedSetRunningOnPause = false;

      // --- MODIFICATION START: Handle EMOM timer state on session resume ---
      if (this.wasEmomTimerRunningOnPause) {
        this.emomTimerState.set('running');
      }
      this.wasEmomTimerRunningOnPause = false;
      // --- MODIFICATION END ---

      if (this.wasRestTimerVisibleOnPause && this.restTimerRemainingSecondsOnPause > 0) {
        this.startRestPeriod(this.restTimerRemainingSecondsOnPause, true);
      }
      this.wasRestTimerVisibleOnPause = false;

      this.closeWorkoutMenu();
      this.closePerformanceInsights();
      // this.toastService.info('Workout session resumed', 3000);
    } else {
      const resumed = await this.checkForPausedSession(true);
      if (!resumed && this.sessionState() !== SessionState.Playing && this.routineId) {
        this.loadNewWorkoutFromRoute();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    // If the session was properly concluded (finished, quit), do not save a paused state.
    if (this.isSessionConcluded) {
      this.stopAllActivity(); // Ensure everything is stopped
      return;
    }

    // Only save a paused state if the component is destroyed mid-session.
    if (isPlatformBrowser(this.platformId) && !this.isPausedWorkoutDiscarded &&
      (this.sessionState() === SessionState.Playing || this.sessionState() === SessionState.Paused) &&
      this.routine()) {
      console.log('WorkoutPlayer ngOnDestroy - Saving state for an unconcluded session...');
      this.savePausedSessionState();
    } else {
      this.stopAllActivity(); // Final cleanup for any other edge case.
    }
    this.unlockScreenOrientation();
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


  /**
   * Helper function to find the index of the first 'pending' exercise after a given index.
   */
  private findFirstPendingExerciseIndexAfter(startIndex: number, routine: Routine): number {
    for (let i = startIndex + 1; i < routine.exercises.length; i++) {
      if (routine.exercises[i].sessionStatus === 'pending') {
        return i;
      }
    }
    return -1; // No more pending exercises found
  }

  // --- This function contains the critical fix for round-aware navigation ---
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

    if (currentPlayedExercise.supersetId) {
      // --- Superset Navigation Logic ---
      const isLastExerciseInBlock = currentPlayedExercise.supersetOrder === (currentPlayedExercise.sets.length ?? 1) - 1;

      if (isLastExerciseInBlock || forceAdvanceExerciseBlock) {
        // We just finished the last exercise of a round. Time to advance to the next round.
        const nextRoundIndex = currentGlobalSetIndexInExercise + 1;
        const firstInBlock = routine.exercises.find(ex => ex.supersetId === currentPlayedExercise.supersetId && ex.supersetOrder === 0);

        if (firstInBlock && nextRoundIndex < firstInBlock.sets.length) {
          // There is another round (set) to perform.
          this.currentBlockRound.update(r => r + 1); // For UI display
          roundIncremented = true;
          nextExIdx = routine.exercises.findIndex(ex => ex.id === firstInBlock.id);
          nextSetIdx = nextRoundIndex; // CRITICAL: The next set index IS the next round index.
        } else {
          // All rounds for this superset are done. Find the next block.
          blockChanged = true;
          this.currentBlockRound.set(1);
          nextExIdx = this.findFirstPendingExerciseIndexAfter(currentGlobalExerciseIndex, routine);
          nextSetIdx = 0; // Start at the first set of the new block.
        }
      } else {
        // Not the last exercise in the superset block. Advance to the next one in sequence.
        nextExIdx = currentGlobalExerciseIndex + 1;
        // CRITICAL: We stay on the SAME set index, as we are performing the same "round".
        nextSetIdx = currentGlobalSetIndexInExercise;
      }
    } else {
      // --- Standard Exercise Navigation Logic ---
      if (forceAdvanceExerciseBlock || nextSetIdx >= currentPlayedExercise.sets.length - 1) {
        // Last set of a standard exercise is done. Find the next pending exercise.
        blockChanged = true;
        nextExIdx = this.findFirstPendingExerciseIndexAfter(currentGlobalExerciseIndex, routine);
        nextSetIdx = 0;
      } else {
        // Not the last set. Just increment the set index.
        nextSetIdx++;
      }
    }

    if (nextExIdx === -1 || nextExIdx >= routine.exercises.length) {
      isEndOfAllPending = true;
      nextExIdx = -1;
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

  protected emomTypeString(): string {
    const block = this.activeSupersetBlock();

    if (block && block[0]?.supersetType === 'emom' && block[0]?.emomTimeSeconds) {
      if (block[0]?.emomTimeSeconds === 60) {
        return 'EMOM'
      } else if (block[0]?.emomTimeSeconds === 60) {
        return 'E2MOM'
      } else {
        return `EMOM - Every ${block[0].emomTimeSeconds} sec`;
      }
    }
    return 'EMOM';
    // 

  }


  private async navigateToNextStepInWorkout(
    completedActiveInfo: ActiveSetInfo,
    currentSessionRoutine: Routine,
    forceAdvanceExerciseBlock: boolean = false
  ): Promise<void> {
    const exerciseJustCompleted = completedActiveInfo.exerciseData;

    // --- MODIFICATION START: Dedicated EMOM Navigation Logic ---
    const wasEmomRoundCompleted = exerciseJustCompleted.supersetType === 'emom';

    if (wasEmomRoundCompleted) {
      const totalRounds = this.totalBlockRounds();
      const currentRound = this.currentBlockRound();

      if (currentRound < totalRounds) {
        // --- Start the NEXT EMOM round ---
        this.currentBlockRound.update(r => r + 1);

        // IMPORTANT: Reset the active exercise back to the beginning of the block for the new round.
        const firstInBlockIndex = currentSessionRoutine.exercises.findIndex(ex => ex.supersetId === exerciseJustCompleted.supersetId && ex.supersetOrder === 0);
        this.currentExerciseIndex.set(firstInBlockIndex);
        this.currentSetIndex.set(0); // Always use the first set as the template

        // Find the rest period defined on the LAST exercise of the block.
        const blockExercises = this.activeSupersetBlock();
        const lastExerciseInBlock = blockExercises ? blockExercises[blockExercises.length - 1] : null;
        const restDuration = getRestValue(lastExerciseInBlock?.sets[0]?.targetRest) ?? 0;

        if (restDuration > 0) {
          this.startRestPeriod(restDuration);
        } else {
          await this.prepareCurrentSet(); // No rest, start the next round's timer immediately.
        }
      } else {
        // --- ALL EMOM rounds are finished. Navigate to the next block. ---
        const lastInBlockIndex = currentSessionRoutine.exercises.findIndex(ex => ex.supersetId === exerciseJustCompleted.supersetId && ex.supersetOrder === (ex.sets.length ?? 1) - 1);
        const nextPendingIndex = this.findFirstPendingExerciseIndexAfter(lastInBlockIndex, currentSessionRoutine);

        if (nextPendingIndex === -1) {
          // No more exercises left in the workout.
          await this.tryProceedToDeferredExercisesOrFinish(currentSessionRoutine);
        } else {
          // Navigate to the next standard exercise or superset block.
          this.currentExerciseIndex.set(nextPendingIndex);
          this.currentSetIndex.set(0);
          this.currentBlockRound.set(1); // Reset round counter for the new block.
          await this.prepareCurrentSet();
        }
      }
      this.cdr.detectChanges();
      return; // Exit the function to prevent standard navigation logic from running.
    }
    // --- MODIFICATION END: End of dedicated EMOM Logic ---


    // --- Standard Navigation Logic (for non-EMOM sets) ---
    const isNowFullyLogged = this.isExerciseFullyLogged(exerciseJustCompleted);
    if (this.isPerformingDeferredExercise && exerciseJustCompleted.id === this.lastActivatedDeferredExerciseId && isNowFullyLogged) {
      this.isPerformingDeferredExercise = false;
      this.lastActivatedDeferredExerciseId = null;
      await this.tryProceedToDeferredExercisesOrFinish(currentSessionRoutine);
      return;
    }

    const {
      nextExIdx, nextSetIdx, blockChanged, isEndOfAllPending, roundIncremented
    } = this.findNextPlayableItemIndices(completedActiveInfo.exerciseIndex, completedActiveInfo.setIndex, currentSessionRoutine, forceAdvanceExerciseBlock);

    if (isEndOfAllPending) {
      await this.tryProceedToDeferredExercisesOrFinish(currentSessionRoutine);
      return;
    }
    if (nextExIdx === -1) {
      await this.tryProceedToDeferredExercisesOrFinish(currentSessionRoutine);
      return;
    }

    this.currentExerciseIndex.set(nextExIdx);
    this.currentSetIndex.set(nextSetIdx);

    if (blockChanged || roundIncremented) {
      this.lastPerformanceForCurrentExercise = null;
      const newBlockStarterExercise = currentSessionRoutine.exercises[nextExIdx];
      this.totalBlockRounds.set(this.getRoundsForExerciseBlock(nextExIdx, currentSessionRoutine));

    }

    const restDurationAfterCompletedSet = getRestValue(completedActiveInfo.setData.targetRest) ?? 0;
    if (restDurationAfterCompletedSet > 0 && !forceAdvanceExerciseBlock) {
      this.startRestPeriod(restDurationAfterCompletedSet);
    } else {
      await this.prepareCurrentSet();
    }
    this.cdr.detectChanges();
  }

  getExerciseEmomBlockInfo(exerciseIndex: number, routine: Routine): { totalRounds: number; emomInterval: number, exercisesInBlock: WorkoutExercise[] | null } | null {
    const exercise = routine.exercises[exerciseIndex];
    if (exercise.supersetType === 'emom' && exercise.emomTimeSeconds) {
      const totalRounds = this.getRoundsForExerciseBlock(exerciseIndex, routine);
      return { totalRounds, emomInterval: exercise.emomTimeSeconds, exercisesInBlock: this.activeSupersetBlock() };
    }
    return null;
  }

  getExerciseDisplayName(exercise: WorkoutExercise): string {
    return this.workoutService.exerciseNameDisplay(exercise);
  }

  /**
  * Formats the "Next Up" text for the rest timer, prioritizing historical performance.
  * @param nextSetInfo The details of the next set, including historical data.
  * @returns A formatted HTML string for display.
  */
  private formatNextUpText(nextSetInfo: ActiveSetInfo | null): string {
    if (!nextSetInfo) {
      return 'Workout Complete!';
    }

    const { exerciseData, setIndex, type, setData, historicalSetPerformance } = nextSetInfo;

    // Case 1: Next block is an EMOM (EMOM display remains the same)
    if (exerciseData.supersetType === 'emom') {
      const totalRounds = this.getRoundsForExerciseBlock(nextSetInfo.exerciseIndex, this.routine()!);
      const nextRound = this.currentBlockRound();
      const emomTime = exerciseData.emomTimeSeconds || 60;
      let header = `Next: EMOM - Round ${nextRound}/${totalRounds} (Every ${emomTime}s)`;

      const exercisesInBlock = this.activeSupersetBlock() || [exerciseData];
      exercisesInBlock.forEach(ex => {
        const setForRound = ex.sets[nextRound - 1];
        if (setForRound) {
          const reps = this.getSetTargetDisplay(setForRound, this.metricEnum.reps);
          const weightDisplay = this.workoutService.getWeightDisplay(setForRound, ex);

          header += `<br><span class="text-sm opacity-80">- ${this.workoutService.exerciseNameDisplay(ex)}: ${reps}</span>`;
        }
      });
      return header;
    }

    // Case 2: Standard Exercise or Superset
    const exerciseName = exerciseData.exerciseName || 'Exercise';
    const totalSets = this.getWorkingSetCountForCurrentExercise();
    const setNumber = this.getWorkingSetNumberForDisplay(exerciseData, setIndex);

    let line1 = `${exerciseName}`;
    let line2 = `${type === 'warmup' ? 'Warm-up' : 'Set'} ${setNumber}/${totalSets}`;

    if (exerciseData.supersetId) {
      const { round, totalRounds } = this.getRoundInfo(exerciseData);
      line2 += ` &nbsp; | &nbsp; Round ${round}/${totalRounds}`;
    }

    // --- THIS IS THE CORRECTED LOGIC WITH HISTORICAL DATA ---
    let detailsLine = '';
    if (historicalSetPerformance) {
      const weight = this.weightUnitPipe.transform(getWeightValue(historicalSetPerformance.weightLogged));
      detailsLine = `Last time: ${weight} x ${historicalSetPerformance.repsLogged} reps`;
    } else {
      const repsDisplay = this.getSetTargetDisplay(setData, this.metricEnum.reps);
      const weightDisplay = this.workoutService.getWeightDisplay(setData, exerciseData);
      detailsLine = `Target: ${weightDisplay} x ${repsDisplay} reps`;
    }

    return `${line1}<br><span class="text-base opacity-80">${line2}</span><br><span class="text-base font-normal">${detailsLine}</span>`;
  }


  private startRestPeriod(targetDuration: number, isResumingPausedRest: boolean = false): void {
    this.playerSubState.set(PlayerSubState.Resting);
    this.restDuration.set(targetDuration);

    if (isPlatformBrowser(this.platformId) && targetDuration > 0) {
      if (isResumingPausedRest) {
        this.restTimerMainText.set(this.restTimerMainTextOnPause);
        this.restTimerNextUpText.set(this.restTimerNextUpTextOnPause);
      } else {
        this.restTimerMainText.set("RESTING");
        this.restTimerNextUpText.set('Loading next set...'); // Set loading text

        // Asynchronously generate the detailed "Next Up" text
        this.peekNextSetInfo().then(nextSetInfo => {
          this.restTimerNextUpText.set(this.formatNextUpText(nextSetInfo));
        });
      }
      this.isRestTimerVisible.set(true);
      this.updateRestTimerDisplay(targetDuration);
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
  async peekNextSetInfo(): Promise<ActiveSetInfo | null> {
    const r = this.routine();
    const exIndex = this.currentExerciseIndex(); // These indices point to the *upcoming* set
    const sIndex = this.currentSetIndex();

    if (r && r.exercises[exIndex] && r.exercises[exIndex].sets[sIndex]) {

      const exerciseData = r.exercises[exIndex];
      const setData = r.exercises[exIndex].sets[sIndex]; // This is the *planned* set data

      if (!this.lastPerformanceForCurrentExercise || this.lastPerformanceForCurrentExercise.sets[0]?.exerciseId !== exerciseData.exerciseId) {
        this.lastPerformanceForCurrentExercise = await firstValueFrom(this.trackingService.getLastPerformanceForExercise(exerciseData.exerciseId).pipe(take(1)));
      }

      const originalExerciseForSuggestions = this.originalRoutineSnapshot && this.originalRoutineSnapshot.exercises && this.originalRoutineSnapshot?.exercises.find(oe => oe.exerciseId === exerciseData.exerciseId) || exerciseData;
      const plannedSetForSuggestions = originalExerciseForSuggestions?.sets[sIndex] || setData;
      const historicalSetPerformance = this.trackingService.findPreviousSetPerformance(this.lastPerformanceForCurrentExercise, plannedSetForSuggestions, sIndex);

      return {
        exerciseIndex: exIndex, setIndex: sIndex, exerciseData, setData, historicalSetPerformance,
        supersetId: exerciseData.supersetId || null,
        superSetType: exerciseData.supersetType || null,
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
          justLoggedExerciseSet.restLogged = restToExact(actualRestingTime);
        } else {
          const actualRestingTime = routineExerciseSet?.targetRest ?? restToExact(60);
          justLoggedExerciseSet.restLogged = actualRestingTime;
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
      this.playerSubState() === PlayerSubState.Resting;
  }

  handleMainAction(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Please resume to continue", 3000, "Paused");
      return;
    }

    // --- MODIFICATION START: Prioritize EMOM action ---
    if (this.activeSupersetBlock()?.[0]?.supersetType === 'emom') {
      this.completeAndLogEmomRound();
      return; // Ensure no other action is taken
    }
    // --- MODIFICATION END ---

    switch (this.playerSubState()) {
      case PlayerSubState.PerformingSet:
        this.completeAndLogCurrentSet();
        break;
      case PlayerSubState.Resting:
        this.skipRest();
        break;
    }
  }

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

  async showSessionOverview(): Promise<void> {
    const currentRoutineVal = this.routine();
    if (!currentRoutineVal || !currentRoutineVal.exercises || currentRoutineVal.exercises.length === 0) {
      this.toastService.error("No exercises in this session to show.", 0, "Error");
      return;
    }

    const overviewButtons: AlertButton[] = [];
    const processedSupersetIds = new Set<string>();

    currentRoutineVal.exercises.forEach((ex, index) => {
      // --- Handle Superset Groups ---
      if (ex.supersetId) {
        if (processedSupersetIds.has(ex.supersetId)) {
          return; // Skip if this group has already been added to the list
        }

        const group = currentRoutineVal.exercises.filter(e => e.supersetId === ex.supersetId);
        const groupName = group.map(e => e.exerciseName).join(' / ');
        const groupStatus = this.getGroupStatusIndicator(group);

        overviewButtons.push({
          text: `Superset: ${groupName}${groupStatus}`,
          role: 'cancel', // Makes the button non-actionable, just for display
          // Use the status of the first exercise in the group for coloring
          cssClass: 'text-left justify-start ' + this.getExerciseButtonCssClass(group[0], groupStatus)
        });
        processedSupersetIds.add(ex.supersetId);

      } else {
        // --- Handle Standard Exercises ---
        const statusIndicator = this.getExerciseStatusIndicator(ex);
        overviewButtons.push({
          text: `${ex.exerciseName}${statusIndicator}`,
          role: 'cancel', // Non-actionable
          cssClass: 'text-left justify-start ' + this.getExerciseButtonCssClass(ex, statusIndicator)
        });
      }
    });

    // Add a final "Done" button to close the modal
    overviewButtons.push({ text: 'DONE', role: 'confirm', data: 'done' });

    await this.alertService.showConfirmationDialog(
      'Session Overview',
      'This is a summary of your workout progress so far.',
      overviewButtons,
    );
  }

  /**
   * Generates a status indicator string for an entire superset group.
   * @param group An array of WorkoutExercise objects belonging to the same superset.
   * @returns A string describing the collective status of the group.
   */
  private getGroupStatusIndicator(group: WorkoutExercise[]): string {
    const totalSets = group.reduce((sum, ex) => sum + ex.sets.length, 0);
    const loggedSets = group.reduce((sum, ex) => sum + this.getNumberOfLoggedSets(ex.id), 0);

    // Base status on the first exercise (e.g., if it was skipped, the group is considered skipped)
    const firstExStatus = group[0].sessionStatus;

    if (loggedSets === 0) {
      if (firstExStatus === 'skipped') return ' - Skipped';
      if (firstExStatus === 'do_later') return ' - Do Later';
      return ' - Pending';
    }

    if (loggedSets >= totalSets) {
      return ' - Completed';
    }

    // Partially completed status
    return ` - In Progress (${loggedSets} of ${totalSets} sets)`;
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

    // +++ NEW: Filter exercises for the modal view +++
    const activeSupersetId = this.activeSetInfo()?.exerciseData.supersetId;
    const processedSupersetIds = new Set<string>();

    const availableExercises = currentRoutineVal.exercises
      .map((ex, index) => ({
        ...ex,
        originalIndex: index,
        isFullyLogged: this.isExerciseFullyLogged(ex),
        isPartiallyLogged: this.isExercisePartiallyLogged(ex),
      }))
      .filter(ex => {
        // Rule 1: Exclude exercises from the current active superset group
        if (activeSupersetId && ex.supersetId === activeSupersetId) {
          return false;
        }
        // Rule 2: If it's part of another superset, only include the first one
        if (ex.supersetId) {
          if (processedSupersetIds.has(ex.supersetId)) {
            return false; // Already processed this group
          }
          processedSupersetIds.add(ex.supersetId);
          // Only show the first exercise of other superset groups
          return ex.supersetOrder === 0;
        }
        // Rule 3: Include all standard (non-superset) exercises
        return true;
      });
    // +++ END: NEW FILTER LOGIC +++

    const exerciseButtons: AlertButton[] = availableExercises.map(ex => {
      const statusIndicator = this.getExerciseStatusIndicator(ex);
      // For superset groups, indicate it's a group.
      const supersetIndicator = ex.supersetId ? ` [Superset Group]` : '';
      const cssClass = this.getExerciseButtonCssClass(ex, statusIndicator);

      return {
        text: `${ex.exerciseName}${statusIndicator}${supersetIndicator}`,
        role: ex.isFullyLogged ? 'restart' : 'confirm',
        data: ex.originalIndex,
        cssClass: cssClass,
      };
    });

    exerciseButtons.push({ text: 'CANCEL', role: 'cancel', data: 'cancel_jump' });
    this.closeWorkoutMenu();

    if (exerciseButtons.length === 1) {
      this.toastService.info("No other available exercises apart from the current one");
      return;
    }

    const choice = await this.alertService.showConfirmationDialog(
      this.headerOverviewString,
      'Select an exercise to start, continue, or restart:',
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
        this.totalBlockRounds.set(this.getRoundsForExerciseBlock(selectedExerciseOriginalIndex, updatedRoutine));
      } else {
        const actualBlockStart = updatedRoutine.exercises.find(ex => ex.supersetId === exerciseToJumpTo.supersetId && ex.supersetOrder === 0);
        this.totalBlockRounds.set(this.getRoundsForExerciseBlock(selectedExerciseOriginalIndex, updatedRoutine));
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
    const filteredList = this.filteredExercisesForAddExerciseModal();

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

    // If it's a superset, the number of rounds IS the number of sets in the first exercise of the block.
    if (exercise.supersetId) {
      const firstInSuperset = routine.exercises.find(ex => ex.supersetId === exercise.supersetId && ex.supersetOrder === 0);
      return firstInSuperset?.sets.length ?? 1;
    }

    // For a standard exercise, the total number of sets defines the "rounds" for the UI (e.g., "Set 3 of 5").
    return exercise.sets.length;
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
        supersetId: exerciseData.supersetId || null,
        superSetType: exerciseData.supersetType || null,
        exerciseData: exerciseData,
        setData: setData,
        type: (setData.type as 'standard' | 'warmup' | 'amrap' | 'custom') ?? 'standard',
        baseExerciseInfo: undefined,
        isCompleted: !!completedSetLog,
        actualReps: completedSetLog?.repsLogged,
        actualWeight: completedSetLog?.weightLogged,
        actualDuration: completedSetLog?.durationLogged,
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
      (ex.description && ex.description.toLowerCase().includes(term)) ||
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

  workoutProgress = computed(() => {
    const routine = this.routine();
    const log = this.currentWorkoutLogExercises();

    if (!routine || routine.exercises.length === 0) {
      return 0;
    }

    // CORRECTED: The total planned sets is now a simple sum of the length of every 'sets' array.
    const totalPlannedSets = routine.exercises.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);

    if (totalPlannedSets === 0) {
      return 0;
    }

    const totalCompletedSets = log.reduce((total, ex) => total + ex.sets.length, 0);
    return Math.min(100, (totalCompletedSets / totalPlannedSets) * 100);
  });

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
      this.switchModalSearchTerm.set('');
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

      const snapshotExerciseToUpdate = this.originalRoutineSnapshot?.exercises.find(ex => ex.id === exerciseToUpdate.id);
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

    // NEW: Disallow switching if it's not the first exercise in a superset
    if (activeInfo.exerciseData.supersetId && (activeInfo.exerciseData.supersetOrder ?? 0) > 0) {
      return false;
    }

    // Allow switching only if no sets for THIS specific exercise instance have been logged yet.
    const loggedSetCount = this.getNumberOfLoggedSets(activeInfo.exerciseData.id);
    return loggedSetCount === 0;
  });

  backToRoutines(): void {
    this.router.navigate(['/workout']);
  }

  toggleActions(event: MouseEvent): void {
    event.stopPropagation();
    this.isWorkoutMenuVisible.set(!this.isWorkoutMenuVisible());
  }

  isSuperSet(index: number): boolean {
    const exercises = this.routine()?.exercises;
    if (!exercises) return false;
    const ex = exercises[index];
    if (!ex?.supersetId) return false;
    return true;
  }

  private isSupersetPartiallyLogged(supersetId: string): boolean {
    const routine = this.routine();
    if (!routine) return false;

    const exercisesInGroup = routine.exercises.filter(ex => ex.supersetId === supersetId);
    return exercisesInGroup.some(ex => this.getNumberOfLoggedSets(ex.id) > 0);
  }

  private isSupersetCompletelyLogged(supersetId: string): boolean {
    const routine = this.routine();
    if (!routine) return false;

    const exercisesInGroup = routine.exercises.filter(ex => ex.supersetId === supersetId);
    // CORRECTED: Check if every exercise in the group is fully logged based on its own sets.
    return exercisesInGroup.every(ex => this.isExerciseFullyLogged(ex));
  }

  readonly canJumpToOtherExercise = computed<boolean>(() => {
    const routine = this.routine();
    const activeInfo = this.activeSetInfo();
    if (!routine || !activeInfo || routine.exercises.length <= 1) {
      return false;
    }

    const currentExercise = activeInfo.exerciseData;
    const currentSupersetId = currentExercise.supersetId;

    // NEW RULE: If the current exercise is in a superset that has been started, disable jumping.
    if (currentSupersetId && this.isSupersetPartiallyLogged(currentSupersetId)) {
      return false;
    }

    // Otherwise (for standard exercises or un-started supersets),
    // check if there are any *other* viable places to jump to.
    // A viable place is another exercise or superset group that is not yet fully logged.
    const processedSupersetIds = new Set<string>();

    return routine.exercises.some(ex => {
      if (ex.supersetId) {
        // Skip the current superset group entirely from consideration.
        if (ex.supersetId === currentSupersetId) {
          return false;
        }

        // If we've already evaluated this superset group, skip it.
        if (processedSupersetIds.has(ex.supersetId)) {
          return false;
        }

        processedSupersetIds.add(ex.supersetId);

        // Check if this entire other superset group is fully logged.
        const group = routine.exercises.filter(e => e.supersetId === ex.supersetId);
        const isGroupFullyLogged = group.every(eInGroup => this.isExerciseFullyLogged(eInGroup));

        // We can jump to this group if it's NOT fully logged.
        return !isGroupFullyLogged;
      } else {
        // For standard exercises, check if it's not the current one and not fully logged.
        return ex.id !== currentExercise.id && !this.isExerciseFullyLogged(ex);
      }
    });
  });

  retrieveSuperSetID(exIndex: number): string {
    const exercises = this.routine()?.exercises;
    if (!exercises) return '';
    const ex = exercises[exIndex];
    if (ex.supersetId) return ex.supersetId;
    return '';
  }

  protected menuButtonBaseClass = computed(() => {
    const isModalMenu = this.appSettingsService.isMenuModeModal();
    const isCompactMenu = this.appSettingsService.isMenuModeCompact();
    // This is the common part for all buttons, if they need special modal styling
    return isModalMenu ? " w-full flex justify-start items-center text-black dark:text-white hover:text-white text-left px-4 py-2 rounded-md text-xl font-medium " : '';
  });

  compactActionmainSessionActionItemsMap = computed<ActionMenuItem[]>(() => {
    const actionsArray: ActionMenuItem[] = [];
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    const workoutLog = this.currentWorkoutLogExercises();
    const commonModalButtonClass = this.menuButtonBaseClass();

    // Always add PAUSE
    actionsArray.push({ ...pauseSessionBtn, overrideCssButtonClass: pauseSessionBtn.buttonClass + ' ' + commonModalButtonClass });

    // Add INSIGHTS if any sets have been logged
    if (workoutLog.length > 0) {
      actionsArray.push({ ...openExercisePerformanceInsightsBtn, overrideCssButtonClass: openExercisePerformanceInsightsBtn.buttonClass + ' ' + commonModalButtonClass });
    }

    actionsArray.push({ ...openSessionPerformanceInsightsBtn, overrideCssButtonClass: openSessionPerformanceInsightsBtn.buttonClass + ' ' + commonModalButtonClass });

    // Always add ADD EXERCISE
    actionsArray.push({ ...addExerciseBtn, overrideCssButtonClass: addExerciseBtn.buttonClass + ' ' + commonModalButtonClass });

    if (this.canSwitchExercise()) {
      actionsArray.push({ ...switchExerciseBtn, overrideCssButtonClass: switchExerciseBtn.buttonClass + ' ' + commonModalButtonClass });
    }

    if (this.canJumpToOtherExercise()) {
      actionsArray.push({ ...jumpToExerciseBtn, overrideCssButtonClass: jumpToExerciseBtn.buttonClass + ' ' + commonModalButtonClass });
    }

    // Add SKIP SET/EXERCISE/DO LATER if there is an active set
    if (activeInfo) {

      // Add WARMUP if allowed for the current set
      const superSetId = this.retrieveSuperSetID(activeInfo?.exerciseIndex);
      if ((this.isSuperSet(activeInfo?.exerciseIndex) && !this.isSupersetPartiallyLogged(superSetId)) && this.canAddWarmupSet()) {
        actionsArray.push({ ...addWarmupSetBtn, overrideCssButtonClass: addWarmupSetBtn.buttonClass + ' ' + commonModalButtonClass });
      }

      const isSuperset = !!activeInfo.exerciseData.supersetId;
      const isSupersetStarted = isSuperset && this.isSupersetPartiallyLogged(activeInfo.exerciseData.supersetId!);

      const skipSetBtnLabel = isSuperset ? 'Skip Round' : 'Skip Set';
      const skipExBtnLabel = isSuperset ? 'Skip Superset' : 'Skip Exercise';

      const canSkipExercise = !isSuperset || !isSupersetStarted;
      if (canSkipExercise) {
        if (!this.isExercisePartiallyLogged(activeInfo?.exerciseData)) {
          actionsArray.push({ ...skipCurrentExerciseBtn, label: skipExBtnLabel, overrideCssButtonClass: skipCurrentExerciseBtn.buttonClass + ' ' + commonModalButtonClass });
        }
        actionsArray.push({ ...skipCurrentSetBtn, label: skipSetBtnLabel, overrideCssButtonClass: skipCurrentSetBtn.buttonClass + ' ' + commonModalButtonClass });
      }

      // Only show "Do Later" if the superset hasn't been started yet
      if (!isSupersetStarted && !this.isExercisePartiallyLogged(activeInfo?.exerciseData)) {
        actionsArray.push({ ...markAsDoLaterBtn, overrideCssButtonClass: markAsDoLaterBtn.buttonClass + ' ' + commonModalButtonClass });
      }
    }

    // --- Superset Logic ---
    if (activeInfo?.exerciseData) {
      const { exerciseData } = activeInfo;
      // Add REMOVE FROM SUPERSET if the current exercise is in one
      if (exerciseData.supersetId) {
        // Only allow removing from superset if no sets in that group have been logged
        if (!this.isSupersetPartiallyLogged(exerciseData.supersetId)) {
          actionsArray.push({ ...removeFromSuperSetBtn, data: { exIndex: activeInfo.exerciseIndex }, overrideCssButtonClass: removeFromSuperSetBtn.buttonClass + ' ' + commonModalButtonClass } as ActionMenuItem);
        }
      } else {
        // Add ADD TO and CREATE SUPERSET if conditions are met
        if (routine && routine.exercises.length >= 2) {
          if (routine.exercises.some(ex => ex.supersetId)) {
            actionsArray.push({ ...addToSuperSetBtn, data: { exIndex: activeInfo.exerciseIndex }, overrideCssButtonClass: addToSuperSetBtn.buttonClass + ' ' + commonModalButtonClass } as ActionMenuItem);
          }
          if (routine.exercises.filter(ex => !ex.supersetId).length >= 2) {
            actionsArray.push({ ...createSuperSetBtn, data: { exIndex: activeInfo.exerciseIndex }, overrideCssButtonClass: createSuperSetBtn.buttonClass + ' ' + commonModalButtonClass } as ActionMenuItem);
          }
        }

        if (activeInfo?.exerciseIndex !== undefined) {
          const exerciseIndex = activeInfo?.exerciseIndex;
          const baseAddSetRoundBtn = !this.isSuperSet(exerciseIndex) ? addSetToExerciseBtn : { ...addRoundToExerciseBtn, actionKey: 'add_set' };
          const baseRemoveSetRoundBtn = !this.isSuperSet(exerciseIndex) ? removeSetFromExerciseBtn : { ...removeRoundFromExerciseBtn, actionKey: 'remove_set' };
          const addSetRoundBtn = {
            ...baseAddSetRoundBtn,
            data: { exerciseIndex },
            overrideCssButtonClass: baseAddSetRoundBtn.buttonClass + commonModalButtonClass
          } as ActionMenuItem;
          const removeSetRoundBtn = {
            ...baseRemoveSetRoundBtn,
            data: { exerciseIndex },
            overrideCssButtonClass: baseRemoveSetRoundBtn.buttonClass + commonModalButtonClass
          } as ActionMenuItem;

          actionsArray.push(addSetRoundBtn, removeSetRoundBtn);
        }
      }
    }

    // Always add QUIT
    // Add FINISH EARLY if any sets have been logged
    if (workoutLog.length > 0) {
      actionsArray.push({ ...finishEarlyBtn, overrideCssButtonClass: finishEarlyBtn.buttonClass + ' ' + commonModalButtonClass });
    }

    // barbell calc button
    actionsArray.push({ ...calculatorBtn, overrideCssButtonClass: calculatorBtn.buttonClass + ' ' + commonModalButtonClass });

    actionsArray.push({ ...quitWorkoutBtn, overrideCssButtonClass: quitWorkoutBtn.buttonClass + ' ' + commonModalButtonClass });

    return actionsArray;
  });

  handleActionMenuItemClick(event: { actionKey: string, data?: any }): void {
    // --- Switch based on the unique action key ---
    switch (event.actionKey) {
      case 'pause': this.pauseSession(); break;
      case 'jumpToExercise': this.jumpToExercise(); break;
      case 'addExercise': this.addExerciseDuringSession(); break;
      case 'switchExercise': this.openSwitchExerciseModal(); break;
      case 'insights': this.openSessionOverviewModal(); break;
      case 'exerciseInsights': this.openPerformanceInsightsFromMenu(); break;
      case 'add_warmup_set': this.addWarmupSet(); break;
      case 'skipSet': this.skipCurrentSet(); break;
      case 'skipExercise': this.skipCurrentExercise(); break;
      case 'later': this.markCurrentExerciseDoLater(); break;
      case 'finish': this.finishWorkoutEarly(); break;
      case 'exit': this.quitWorkout(); break;
      case 'weight_toolkit': this.openCalculatorModal(); break;
      case 'create_superset': this.openCreateSupersetModal(); break;
      case 'add_to_superset': this.addToSupersetModal(); break;
      case 'remove_from_superset': this.removeFromSuperset(); break;
    }

    this.isWorkoutMenuVisible.set(false); // Close the menu
  }

  formatSecondsToTime(totalSeconds: number | undefined): string {
    if (totalSeconds == null) return '';
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  }

  protected getMenuMode(): MenuMode {
    return this.appSettingsService.getMenuMode();
  }

  protected sessionNotes = signal<string>('');

  protected currentWorkoutLog = computed<Partial<WorkoutLog>>(() => {
    return {
      exercises: this.currentWorkoutLogExercises(),
      notes: this.sessionNotes(),
      // You can add other properties from the component state here if needed
      // routineId: this.routineId,
      // startTime: this.workoutStartTime,
    };
  });

  /**
   * Opens a modal to create a superset, using the new mapped workout log signal.
   * @param exIndex The index of the exercise initiating the action.
   */
  async openCreateSupersetModal(): Promise<void> {
    const routine = this.routine();
    const currentExercise = this.activeSetInfo();
    const currentLog = this.currentWorkoutLog();
    if (!routine || !currentLog.exercises) return;
    if (!currentExercise || currentExercise.exerciseIndex < 0) return;

    // Assuming `createSuperset` is now on your workoutService
    const result = await this.workoutService.createSuperset(
      routine,
      currentExercise.exerciseIndex,
      currentLog.exercises,
    );

    // If the utility function returns updated data, apply it back to the source signals
    if (result) {
      // --- START: CORRECTED NAVIGATION LOGIC ---

      // 1. Get the new superset ID directly from the result. This is now reliable.
      const { newSupersetId, updatedRoutine, updatedLoggedExercises } = result;

      // 2. Find the first exercise in the new superset block and its index
      const firstExerciseInSuperset = updatedRoutine.exercises.find(
        e => e.supersetId === newSupersetId && e.supersetOrder === 0
      );
      const newActiveIndex = updatedRoutine.exercises.findIndex(
        e => e.id === firstExerciseInSuperset?.id
      );

      if (firstExerciseInSuperset && newActiveIndex > -1) {
        this.stopOngoingTimers();

        // 3. Apply the updated routine and logs to the component's state
        this.routine.set(updatedRoutine);
        this.currentWorkoutLogExercises.set(updatedLoggedExercises);

        // 4. Update the component's state to point to the new exercise
        this.currentExerciseIndex.set(newActiveIndex);
        this.currentSetIndex.set(0);
        this.currentBlockRound.set(1);
        this.totalBlockRounds.set(firstExerciseInSuperset.sets.length || 1);
        this.lastPerformanceForCurrentExercise = null;

        // 5. Refresh the player UI with the new active set
        await this.prepareCurrentSet();

        this.toastService.info(`Navigated to new superset: ${firstExerciseInSuperset.exerciseName}.`, 2500, "Superset Created");
      }
      // --- END: CORRECTED NAVIGATION LOGIC ---
    }
    // No need for a final savePausedSessionState() here, as prepareCurrentSet will handle it.
  }

  async addToSupersetModal(): Promise<void> {
    const routine = this.routine();
    if (!routine) return;

    const currentExercise = this.activeSetInfo();
    const currentLog = this.currentWorkoutLog();
    if (!routine || !currentLog.exercises) return;
    if (!currentExercise || currentExercise.exerciseIndex < 0) return;


    const updatedRoutine = await this.workoutService.addToSuperset(
      routine,
      currentExercise.exerciseIndex,
      this.alertService,
      this.toastService
    );

    if (updatedRoutine) {
      this.routine.set(updatedRoutine);
      this.savePausedSessionState();
    }
  }

  async removeFromSuperset() {
    const routine = this.routine();
    const loggedExercises = this.currentWorkoutLog().exercises || [];
    if (!routine) return;

    const currentExercise = this.activeSetInfo();
    const currentLog = this.currentWorkoutLog();
    if (!routine || !currentLog.exercises) return;
    if (!currentExercise || currentExercise.exerciseIndex < 0) return;

    const result = await this.workoutService.removeFromSuperset(
      routine,
      currentExercise.exerciseIndex,
      loggedExercises,
      this.alertService,
      this.toastService
    );

    if (result) {
      this.routine.set(result.updatedRoutine);
      this.currentWorkoutLogExercises.set(result.updatedLoggedExercises);
      this.savePausedSessionState();
    }
  }

  /**
  * Generates a display string for a set's planned target range.
  * @param set The ExerciseSetParams object from the routine plan.
  * @param field The field to display ('reps' or 'duration' or 'weight).
  * @returns A formatted string like "8-12" or "60+", or an empty string if no range is set.
  */
  public getSetTargetDisplay(set: ExerciseTargetSetParams, field: METRIC): string {
    // if EMOM returns string like "10 @ 5kg"
    if (this.activeSetInfo()?.supersetId && this.activeSetInfo()?.superSetType === 'emom') {
      const weightPart = set.targetWeight ? ` @ ${set.targetWeight}kg` : '';
      const exercise = this.activeSetInfo()?.exerciseData;
      if (exercise) {
        return `${this.workoutService.getSetTargetDisplay(set, field)} @ ${this.workoutService.getWeightDisplay(set, exercise) || ''}`;
      } else {
        return `${this.workoutService.getSetTargetDisplay(set, field)} ${weightPart}`;
      }
    } else {
      return this.workoutService.getSetTargetDisplay(set, field);
    }
  }


  /**
   * Attempts to lock the screen orientation to portrait mode.
   * This method should be called when the workout player is initialized.
   */
  private async lockScreenToPortrait(): Promise<void> {
    // Check if the Screen Orientation API is available and we're in a browser context
    if (isPlatformBrowser(this.platformId) && screen.orientation) {
      try {
        await (screen.orientation as any).lock('portrait-primary');
        console.log('Screen orientation locked to portrait.');
      } catch (error) {
        console.error('Failed to lock screen orientation:', error);
        // Handle cases where the browser might not allow locking,
        // e.g., on desktop or if the user has disabled it.
      }
    }
  }

  /**
   * Unlocks the screen orientation, allowing it to change freely again.
   * This should be called when the user navigates away from the workout player.
   */
  private unlockScreenOrientation(): void {
    if (isPlatformBrowser(this.platformId) && screen.orientation) {
      try {
        screen.orientation.unlock();
        console.log('Screen orientation unlocked.');
      } catch (error) {
        console.error('Failed to unlock screen orientation:', error);
      }
    }
  }


  // EMOM LOGIC
  // +++ NEW: Signals and Properties for EMOM State Management +++
  private emomRoundTimerSub: Subscription | undefined;
  emomRoundTimeRemaining = signal(0);
  emomRoundDisplay = computed(() => this.formatSecondsToTime(this.emomRoundTimeRemaining()));

  // +++ NEW: Function to start the EMOM round timer +++
  private startEmomRoundTimer(durationSeconds: number): void {
    this.emomRoundTimeRemaining.set(durationSeconds);
    this.emomTimerState.set('running'); // Reset to running for each new round
    if (this.emomRoundTimerSub) this.emomRoundTimerSub.unsubscribe();

    this.emomRoundTimerSub = timer(0, 1000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      // --- MODIFICATION START: Respect both session state and EMOM pause state ---
      if (this.sessionState() === SessionState.Playing && this.emomTimerState() === 'running') {
        this.emomRoundTimeRemaining.update(s => (s > 0 ? s - 1 : 0));
        if (this.emomRoundTimeRemaining() === 0) {
          this.playClientGong();
          this.emomRoundTimerSub?.unsubscribe();
          this.completeAndLogEmomRound();
        }
      }
      // --- MODIFICATION END ---
    });
  }


  // +++ NEW: Function to log all exercises in an EMOM round at once +++
  private completeAndLogEmomRound(): void {
    const emomBlock = this.activeSupersetBlock();
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    const roundToLog = this.currentBlockRound();

    if (!emomBlock || !activeInfo || !routine || roundToLog > this.totalBlockRounds()) {
      if (this.emomRoundTimerSub) this.emomRoundTimerSub.unsubscribe();
      if (routine && activeInfo) {
        this.navigateToNextStepInWorkout(activeInfo, routine, true);
      }
      return;
    }

    if (this.emomRoundTimerSub) this.emomRoundTimerSub.unsubscribe();

    emomBlock.forEach(exerciseInBlock => {
      // --- MODIFICATION START: Use sets[0] as a template for all rounds ---
      // This makes the routine definition robust, even if only one set is defined per exercise.
      const templateSet = exerciseInBlock.sets[0];
      if (!templateSet) {
        console.error(`EMOM exercise '${exerciseInBlock.exerciseName}' is missing a set definition.`);
        return; // Skip this exercise if it has no sets defined
      }
      // --- MODIFICATION END ---

      const loggedSetData: LoggedSet = {
        id: uuidv4(),
        exerciseName: exerciseInBlock.exerciseName,
        // Use the ID from the template set, but append the round to make it unique for this log.
        plannedSetId: `${templateSet.id}-round-${roundToLog - 1}`,
        exerciseId: exerciseInBlock.exerciseId,
        type: 'emom',
        repsLogged: templateSet.targetReps ?? genRepsTypeFromRepsNumber(0),
        weightLogged: templateSet.targetWeight ?? weightToExact(0),
        timestamp: new Date().toISOString(),
        fieldOrder: this.workoutService.getRepsAndWeightFields()
      };
      this.addLoggedSetToCurrentLog(exerciseInBlock, loggedSetData);
    });

    this.cdr.detectChanges();
    this.toastService.success(`Round ${roundToLog} logged!`, 2000, "EMOM");
    this.navigateToNextStepInWorkout(activeInfo, routine);
  }


  // --- MODIFICATION START: Replace activeEmomBlock with a unified superset block ---
  /**
   * Computed signal that returns the array of exercises in an active superset or EMOM block.
   * If the current exercise is not part of a superset, it returns null.
   */
  activeSupersetBlock = computed<WorkoutExercise[] | null>(() => {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    if (!activeInfo || !routine || !activeInfo.exerciseData.supersetId) {
      return null;
    }
    // Return all exercises that belong to the same superset group, correctly ordered.
    return routine.exercises
      .filter(ex => ex.supersetId === activeInfo.exerciseData.supersetId)
      .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0));
  });
  // --- MODIFICATION END ---

  private wasEmomTimerRunningOnPause = false;
  emomTimerState = signal<'running' | 'paused'>('running');

  // --- MODIFICATION START: New function to toggle the EMOM timer ---
  toggleEmomTimer(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Resume the session to control the round timer.", 3000);
      return;
    }
    this.emomTimerState.update(state => (state === 'running' ? 'paused' : 'running'));
  }
  // --- MODIFICATION END ---


  isCalculatorModalVisible: boolean = false;
  openCalculatorModal(): void {
    this.isCalculatorModalVisible = true;
  }

  closeCalculatorModal(): void {
    this.isCalculatorModalVisible = false;
  }

  protected metricEnum = METRIC;

  getDurationValue(duration: DurationTarget | undefined): number {
    return getDurationValue(duration);
  }

    getWeightValue(duration: WeightTarget | undefined): number {
    return getWeightValue(duration);
  }

    getDistanceValue(distance: DistanceTarget | undefined): number {
    return getDistanceValue(distance);
  }
}