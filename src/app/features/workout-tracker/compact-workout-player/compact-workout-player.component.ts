import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef, PLATFORM_ID, ViewChildren, QueryList, ElementRef, effect, ViewChild, afterNextRender, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer, of, lastValueFrom, firstValueFrom, combineLatest } from 'rxjs';
import { switchMap, take, map } from 'rxjs/operators';
import {
  Routine,
  WorkoutExercise,
  ExerciseTargetSetParams,
  ActiveSetInfo,
  PlayerSubState,
  PausedWorkoutState,
  ExerciseTargetExecutionSetParams,
  ExerciseCurrentExecutionSetParams,
  METRIC,
  TimedSetState,
} from '../../../core/models/workout.model';
import { Exercise } from '../../../core/models/exercise.model';
import { WorkoutService } from '../../../core/services/workout.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { TrackingService } from '../../../core/services/tracking.service';
import {
  LoggedSet,
  LoggedWorkoutExercise,
  WorkoutLog,
  PersonalBestSet,
  LastPerformanceSummary,
} from '../../../core/models/workout-log.model';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { AlertService } from '../../../core/services/alert.service';
import { UnitsService } from '../../../core/services/units.service';
import { ToastService } from '../../../core/services/toast.service';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ExerciseSelectionModalComponent } from '../../../shared/components/exercise-selection-modal/exercise-selection-modal.component';
import { FormsModule } from '@angular/forms';
import { ActionMenuComponent } from '../../../shared/components/action-menu/action-menu';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { StorageService } from '../../../core/services/storage.service';
import { MenuMode, PlayerMode } from '../../../core/models/app-settings.model';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { TrainingProgram } from '../../../core/models/training-program.model';
import { AlertButton, AlertInput } from '../../../core/models/alert.model';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { addExerciseBtn, addRoundToExerciseBtn, addSetToExerciseBtn, addToSuperSetBtn, addWarmupSetBtn, calculatorBtn, createSuperSetBtn, openSessionPerformanceInsightsBtn, pauseSessionBtn, quitWorkoutBtn, removeExerciseBtn, removeFromSuperSetBtn, removeRoundFromExerciseBtn, removeSetFromExerciseBtn, resumeSessionBtn, sessionNotesBtn, switchExerciseBtn } from '../../../core/services/buttons-data';
import { mapExerciseTargetSetParamsToExerciseExecutedSetParams } from '../../../core/models/workout-mapper';
import { ProgressiveOverloadService } from '../../../core/services/progressive-overload.service.ts';
import { BarbellCalculatorModalComponent } from '../../../shared/components/barbell-calculator-modal/barbell-calculator-modal.component';
import { NgLetDirective } from '../../../shared/directives/ng-let.directive';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SessionOverviewModalComponent } from '../session-overview-modal/session-overview-modal.component';
import { FullScreenRestTimerComponent } from '../../../shared/components/full-screen-rest-timer/full-screen-rest-timer';
import { AUDIO_TYPES, AudioService } from '../../../core/services/audio.service';
import { se } from 'date-fns/locale';
import { PressDirective } from '../../../shared/directives/press.directive';

// Interface for saving the paused state

enum SessionState {
  Loading = 'loading',
  Playing = 'playing',
  Paused = 'paused',
  Error = 'error',
  End = 'end',
}

export interface SupersetInfo {
  supersetId: string,
  supersetSize: number,
  supersetOrder: number,
  supersetRounds: number
}

export interface NextStepInfo {
  completedExIndex: number,
  completedSetIndex: number,
  exerciseSetLength: number,
  maxExerciseIndex: number,
  supersetInfo?: SupersetInfo
}

@Component({
  selector: 'app-compact-workout-player',
  standalone: true,
  imports: [
    CommonModule, DatePipe, WeightUnitPipe, IconComponent,
    ExerciseSelectionModalComponent, FormsModule, ActionMenuComponent, FullScreenRestTimerComponent, NgLetDirective,
    DragDropModule, BarbellCalculatorModalComponent, TranslateModule, SessionOverviewModalComponent, PressDirective
  ],
  templateUrl: './compact-workout-player.component.html',
  styleUrls: ['./compact-workout-player.component.scss'],
  providers: [DecimalPipe, WeightUnitPipe, AudioService],
})
export class CompactWorkoutPlayerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  protected router = inject(Router);
  protected workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  protected trackingService = inject(TrackingService);
  protected trainingProgramService = inject(TrainingProgramService);
  protected storageService = inject(StorageService);
  protected alertService = inject(AlertService);
  protected toastService = inject(ToastService);
  protected unitsService = inject(UnitsService);
  private weightUnitPipe = inject(WeightUnitPipe);
  private cdr = inject(ChangeDetectorRef);
  protected appSettingsService = inject(AppSettingsService);
  protected progressiveOverloadService = inject(ProgressiveOverloadService);
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);
  protected unitService = inject(UnitsService);
  private translate = inject(TranslateService);

  private toggledSetAnimation = signal<{ key: string, type: 'set' | 'round', state: 'completed' | 'incompleted' } | null>(null);
  protected metricEnum = METRIC;

  isAddToSupersetModalOpen = signal(false);
  exerciseToSupersetIndex = signal<number | null>(null);
  expandedSets = signal(new Set<string>());
  setTimerState = signal<{ [key: string]: { status: 'idle' | 'running' | 'paused', remainingTime: number } }>({});
  private setTimerSub: Subscription | undefined;

  lastExerciseIndex = signal<number>(-1);
  lastExerciseSetIndex = signal<number>(-1);

  private lastLoggedSetForRestUpdate: LoggedSet | null = null;

  protected getMenuMode(): MenuMode {
    return this.appSettingsService.getMenuMode();
  }

  lastSetInfo = computed<ActiveSetInfo | null>(() => {
    const r = this.routine();
    const exIndex = this.lastExerciseIndex();
    const sIndex = this.lastExerciseSetIndex();

    if (r && r.exercises[exIndex] && r.exercises[exIndex].sets[sIndex]) {
      const exerciseData = r.exercises[exIndex];
      const setData = r.exercises[exIndex].sets[sIndex];
      const completedExerciseLog = this.currentWorkoutLog().exercises?.find(logEx => logEx.exerciseId === exerciseData.exerciseId);
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
        actualReps: completedSetLog?.repsAchieved,
        actualWeight: completedSetLog?.weightUsed,
        actualDuration: completedSetLog?.durationPerformed,
        notes: completedSetLog?.notes || setData?.notes,
      };
    }
    return null;
  });

  routine = signal<Routine | null | undefined>(undefined);
  program = signal<TrainingProgram | null | undefined>(undefined);
  scheduledDay = signal<string | undefined>(undefined);
  originalRoutineSnapshot = signal<Routine | null | undefined>(undefined);
  sessionState = signal<SessionState>(SessionState.Loading);
  sessionTimerDisplay = signal('00:00');
  expandedExerciseIndex = signal<number | null>(null);
  activeActionMenuIndex = signal<number | null>(null);
  mainSessionActionMenuOpened = signal<boolean>(false);
  playerSubState = signal<PlayerSubState>(PlayerSubState.PerformingSet);

  showCompletedSetsForExerciseInfo = signal(true);
  showCompletedSetsForDayInfo = signal(false);

  isRestTimerVisible = signal(false);
  restDuration = signal(0);
  restTimerMainText = signal(this.translate.instant('compactPlayer.rest'));
  restTimerNextUpText = signal<string | null>(this.translate.instant('compactPlayer.loading'));
  restTimerNextSetDetails = signal<ExerciseTargetSetParams | null>(null);

  menuModeDropdown: boolean = false;
  menuModeCompact: boolean = false;
  menuModeModal: boolean = false;

  private intensityAdjustment: { direction: 'increase' | 'decrease', percentage: number } | null = null;

  private workoutStartTime: number = 0;
  private sessionTimerElapsedSecondsBeforePause = 0;
  private timerSub: Subscription | undefined;
  private routeSub: Subscription | undefined;
  private isSessionConcluded = false;

  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';
  private readonly PAUSED_STATE_VERSION = '1.0';

  routineId: string | null = null;
  programId: string | null = null;

  currentWorkoutLog = signal<Partial<WorkoutLog>>({ exercises: [], notes: '' }); // +++ MODIFIED: Initialize notes
  currentWorkoutLogExercises = computed(() => this.currentWorkoutLog()?.exercises ?? []);

  defaultExercises: Exercise[] = [];
  availableExercises: Exercise[] = [];

  isAddExerciseModalOpen = signal(false);
  isSwitchExerciseModalOpen = signal(false);
  isPerformanceInsightsModalOpen = signal(false);
  isShowingSimilarInSwitchModal = signal(false);
  exercisesForSwitchModal = signal<Exercise[]>([]);

  modalSearchTerm = signal('');
  exerciseToSwitchIndex = signal<number | null>(null);
  insightsData = signal<{
    exercise: WorkoutExercise;
    baseExercise: Exercise | null;
    lastPerformance: LastPerformanceSummary | null;
    personalBests: PersonalBestSet[];
    completedSetsInSession: LoggedSet[];
  } | null>(null);

  // Key: "exIndex-roundIndex", Value: state object
  emomState = signal<{ [key: string]: { status: 'idle' | 'running' | 'paused' | 'completed', remainingTime: number } }>({});
  private emomTimerSub: Subscription | undefined;

  workoutProgress = computed(() => {
    const routine = this.routine();
    const log = this.currentWorkoutLog();
    if (!routine || !routine.exercises || routine.exercises.length === 0) {
      return 0;
    }
    // CORRECTED: The total planned sets is simply the sum of all sets from all exercises.
    const totalPlannedSets = routine.exercises.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);
    if (totalPlannedSets === 0) {
      return 0;
    }
    const totalCompletedSets = log.exercises?.reduce((total, ex) => total + ex.sets.length, 0) || 0;
    return Math.min(100, (totalCompletedSets / totalPlannedSets) * 100);
  });


  @ViewChildren('exerciseCard') exerciseCards!: QueryList<ElementRef>;
  @ViewChild('header') header!: ElementRef; // Get the header element

  private audioService = inject(AudioService);
  private lastBeepSecond: number | null = null;


  @ViewChildren('setCard') setCards!: QueryList<ElementRef<HTMLDivElement>>;
  @ViewChildren('roundCard') roundCards!: QueryList<ElementRef<HTMLDivElement>>;

  constructor() {
    // --- START: ADDED SNIPPET (Part 2) ---
    // Effect that runs when the animation signal changes
    effect(() => {
      const animationState = this.toggledSetAnimation();
      if (!animationState) return;

      const { key, type, state } = animationState;

      // Use a timeout to ensure the DOM query runs after the current change detection cycle
      setTimeout(() => {
        const animationClass = state === 'completed' ? 'animate-bump-in' : 'animate-bump-out';

        let cardElement: HTMLElement | undefined;

        if (type === 'set') {
          // Find the specific #setCard element
          cardElement = this.setCards.find(card => card.nativeElement.getAttribute('data-set-index') === key.split('-')[1])?.nativeElement;
        } else { // type === 'round'
          // Find the specific #roundCard element
          const roundIndex = key.split('-')[1];
          cardElement = this.roundCards.find(card => card.nativeElement.getAttribute('data-round-index') === roundIndex)?.nativeElement;
        }

        if (cardElement) {
          cardElement.classList.add(animationClass);
          // Remove the class after the animation completes so it can be re-triggered
          setTimeout(() => {
            cardElement?.classList.remove(animationClass);
          }, 300); // Duration should match the animation duration in CSS
        }
      }, 0);
    });
    // --- END: ADDED SNIPPET (Part 2) ---
  }



  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) { window.scrollTo(0, 0); }
    this.loadAvailableExercises();

    this.menuModeDropdown = this.appSettingsService.isMenuModeDropdown();
    this.menuModeCompact = this.appSettingsService.isMenuModeCompact();
    this.menuModeModal = this.appSettingsService.isMenuModeModal();

    const hasPausedSession = await this.checkForPausedSession();
    if (!hasPausedSession) {
      this.loadNewWorkoutFromRoute();
    }

    await this.lockScreenToPortrait();
  }

  private isDestroyed = false;
  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (!this.isSessionConcluded && (this.sessionState() === SessionState.Playing || this.sessionState() === SessionState.Paused)) {
      this.savePausedSessionState();
    }
    this.timerSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.emomTimerSub?.unsubscribe();
    this.setTimerSub?.unsubscribe();
    this.unlockScreenOrientation();
  }

  onExerciseDrop(event: CdkDragDrop<WorkoutExercise[]>) {
    const routine = this.routine();
    if (!routine) return;

    const exercises = [...routine.exercises];
    const draggedItem = exercises[event.previousIndex];
    const targetItem = exercises[event.currentIndex];

    // Case 1: Dragging within the same superset (intra-superset reorder)
    if (draggedItem.supersetId && draggedItem.supersetId === targetItem.supersetId) {
      moveItemInArray(exercises, event.previousIndex, event.currentIndex);
      // After moving, re-calculate and update the `supersetOrder` for the affected group
      const group = exercises.filter(ex => ex.supersetId === draggedItem.supersetId);
      group.forEach((ex, index) => {
        const originalIndexInMainArray = exercises.findIndex(e => e.id === ex.id);
        if (originalIndexInMainArray > -1) {
          exercises[originalIndexInMainArray].supersetOrder = index;
        }
      });
      // The overall list must be sorted again to keep the group visually contiguous
      routine.exercises = this.reorderExercisesForSupersets(exercises);
      this.toastService.info('Exercise reordered within superset.');
    }
    // Case 2: Dragging a whole superset group (identified by dragging its first item)
    else if (draggedItem.supersetId) {
      // Find the entire group to move
      const supersetGroup = exercises.filter(ex => ex.supersetId === draggedItem.supersetId);
      // Create a new array without the group
      const exercisesWithoutGroup = exercises.filter(ex => ex.supersetId !== draggedItem.supersetId);
      // Calculate the correct insertion index in the new, shorter array
      let insertionIndex = 0;
      for (let i = 0; i < event.currentIndex; i++) {
        if (exercises[i].supersetId !== draggedItem.supersetId) {
          insertionIndex++;
        }
      }
      // Insert the entire group at the new position
      exercisesWithoutGroup.splice(insertionIndex, 0, ...supersetGroup);
      routine.exercises = exercisesWithoutGroup;
    }
    // Case 3: Dragging a standalone exercise
    else {
      moveItemInArray(exercises, event.previousIndex, event.currentIndex);
      // Re-sort the list to ensure superset groups remain together
      routine.exercises = this.reorderExercisesForSupersets(exercises);
    }

    this.routine.set({ ...routine });
  }

  private async loadNewWorkoutFromRoute(): Promise<void> {
    this.sessionState.set(SessionState.Loading);
    this.isSessionConcluded = false;

    this.routeSub = combineLatest([
      this.route.paramMap,
      this.route.queryParamMap
    ]).pipe(
      map(([params, queryParams]) => ({
        routineId: params.get('routineId'),
        programId: queryParams.get('programId'),
        scheduledDayId: queryParams.get('scheduledDayId'),
      })),
      switchMap(ids => {
        this.routineId = ids.routineId;
        this.programId = ids.programId;
        if (ids.scheduledDayId) {
          this.scheduledDay.set(ids.scheduledDayId);
        }
        return this.routineId ? this.workoutService.getRoutineById(this.routineId) : of(null);
      })
    ).subscribe(async (routine) => {
      if (this.isDestroyed) { return; }
      if (routine) {

        // We capture the routine before adjustments so we can apply them to a copy
        let routineForSession = JSON.parse(JSON.stringify(routine)) as Routine;

        const lastLogArray = await firstValueFrom(this.trackingService.getLogsForRoutine(routine.id, 1));
        const lastLog = lastLogArray.length > 0 ? lastLogArray[0] : null;

        if (lastLog && lastLog.perceivedWorkoutInfo?.perceivedEffort) {
          const effort = lastLog.perceivedWorkoutInfo.perceivedEffort;
          let adjustmentType: 'increase' | 'decrease' | null = null;
          let dialogTitle = '', dialogMessage = '';

          if (effort >= 7) {
            adjustmentType = 'decrease';
            dialogTitle = this.translate.instant('compactPlayer.alerts.toughWorkoutTitle');
            dialogMessage = this.translate.instant('compactPlayer.alerts.toughWorkoutMessage');
          } else if (effort <= 4) {
            adjustmentType = 'increase';
            dialogTitle = this.translate.instant('compactPlayer.alerts.lightWorkoutTitle');
            dialogMessage = this.translate.instant('compactPlayer.alerts.lightWorkoutMessage');
          }

          if (adjustmentType) {
            const prompt = await this.alertService.showPromptDialog(
              dialogTitle, dialogMessage,
              [{
                name: 'percentage', type: 'number', placeholder: 'e.g., 10', value: 10,
                attributes: { min: '1', max: '50', step: '1' }
              }] as AlertInput[],
              this.translate.instant('compactPlayer.alerts.adjustBy'), this.translate.instant('compactPlayer.alerts.noThanks')
            );

            if (prompt && prompt['percentage']) {
              const percentage = Number(prompt['percentage']);
              // Store the adjustment preference instead of applying it immediately
              this.intensityAdjustment = { direction: adjustmentType, percentage };
              this.toastService.success(this.translate.instant('compactPlayer.toasts.intensityAdjusted', { percent: percentage }), 3000, this.translate.instant('compactPlayer.toasts.intensityAdjustedTitle'));
            }
          }
        }

        this.routine.set(routineForSession); // Use the (potentially unmodified) routine copy
        this.originalRoutineSnapshot.set(JSON.parse(JSON.stringify(routine))); // Snapshot is always the true original
        await this.prefillRoutineWithLastPerformance();
        if (this.programId) {
          this.program.set(await firstValueFrom(this.trainingProgramService.getProgramById(this.programId)));
        }
        this.startWorkout();
      } else {
        const emptyNewRoutine = {
          name: this.translate.instant('pausedWorkout.defaultRoutineName'),
          createdAt: new Date().toISOString(),
          goal: 'custom',
          exercises: [] as WorkoutExercise[],
        } as Routine;
        this.routine.set(emptyNewRoutine);
        this.startWorkout();
      }
    });
  }


  private async prefillRoutineWithLastPerformance(): Promise<void> {
    const currentRoutine = this.routine();
    if (!currentRoutine) return;

    const poSettings = this.progressiveOverloadService.getSettings();
    const isPoEnabled = poSettings.enabled && poSettings.strategies && poSettings.sessionsToIncrement && poSettings.sessionsToIncrement > 0;

    // Fetch all logs for this routine only if PO is enabled, to avoid unnecessary calls
    const allLogsForRoutine = isPoEnabled
      ? await firstValueFrom(this.trackingService.getLogsForRoutine(currentRoutine.id))
      : [];

    const routineCopy = JSON.parse(JSON.stringify(currentRoutine)) as Routine;

    for (const exercise of routineCopy.exercises) {
      try {
        const lastPerformance = await firstValueFrom(
          this.trackingService.getLastPerformanceForExercise(exercise.exerciseId)
        );

        if (lastPerformance && lastPerformance.sets.length > 0) {
          // --- START: PROGRESSIVE OVERLOAD LOGIC ---
          let overloadApplied = false;
          if (isPoEnabled) {
            // Filter logs that actually contain the current exercise
            const relevantLogs = allLogsForRoutine.filter(log =>
              log.exercises.some(le => le.exerciseId === exercise.exerciseId)
            );

            if (relevantLogs.length >= poSettings.sessionsToIncrement!) {
              const recentLogsToCheck = relevantLogs.slice(-poSettings.sessionsToIncrement!);
              let allSessionsSuccessful = true;

              for (const log of recentLogsToCheck) {
                const loggedEx = log.exercises.find(le => le.exerciseId === exercise.exerciseId);
                // Compare against the original routine structure from the time of the log, or snapshot if available
                const originalEx = this.originalRoutineSnapshot()?.exercises.find(oe => oe.exerciseId === exercise.exerciseId);

                // If the exercise structure is missing or doesn't match, it's not a successful session in this context
                if (!loggedEx || !originalEx || loggedEx.sets.length < originalEx.sets.length) {
                  allSessionsSuccessful = false;
                  break;
                }

                // Check if user met or exceeded targets for all non-warmup sets
                const wasSuccess = originalEx.sets.every((originalSet, setIndex) => {
                  if (originalSet.type === 'warmup') return true;
                  const loggedSet = loggedEx.sets[setIndex];
                  return loggedSet && (loggedSet.repsAchieved ?? 0) >= (originalSet.targetReps ?? 0);
                });

                if (!wasSuccess) {
                  allSessionsSuccessful = false;
                  break;
                }
              }

              if (allSessionsSuccessful) {
                this.progressiveOverloadService.applyOverloadToExercise(exercise, poSettings);
                this.toastService.success(`Progressive Overload applied to ${exercise.exerciseName}!`, 2500, "Auto-Increment");
                overloadApplied = true;
              }
            }
          }
          // --- END: PROGRESSIVE OVERLOAD LOGIC ---

          // Prefill from last performance ONLY if overload was NOT applied
          if (!overloadApplied) {
            exercise.sets.forEach((set, setIndex) => {
              const historicalSet = lastPerformance.sets[setIndex];
              if (historicalSet) {
                set.targetReps = historicalSet.repsAchieved ?? set.targetReps;
                set.targetWeight = historicalSet.weightUsed ?? set.targetWeight;
                set.targetDuration = historicalSet.durationPerformed ?? set.targetDuration;
                set.targetDistance = historicalSet.distanceAchieved ?? set.targetDistance;
              }
            });
          }
        }

        // --- APPLY SESSION-WIDE INTENSITY ADJUSTMENT (runs after overload/prefill) ---
        if (this.intensityAdjustment) {
          const { direction, percentage } = this.intensityAdjustment;
          const multiplier = direction === 'increase' ? 1 + (percentage / 100) : 1 - (percentage / 100);

          exercise.sets.forEach(set => {
            if (set.targetWeight != null) {
              const adjustedWeight = Math.round((set.targetWeight * multiplier) * 4) / 4;
              set.targetWeight = adjustedWeight >= 0 ? adjustedWeight : 0;
            }
            if (set.targetReps != null) {
              const adjustedReps = Math.round(set.targetReps * multiplier);
              set.targetReps = adjustedReps >= 0 ? adjustedReps : 0;
            }
            if (set.targetDuration != null) {
              const adjustedDuration = Math.round(set.targetDuration * multiplier);
              set.targetDuration = adjustedDuration >= 0 ? adjustedDuration : 0;
            }
            if (set.targetDistance != null) {
              const adjustedDistance = Math.round(set.targetDistance * multiplier);
              set.targetDistance = adjustedDistance >= 0 ? adjustedDistance : 0;
            }
          });
        }

      } catch (error) {
        console.error(`Failed to prefill data for exercise ${exercise.exerciseName}:`, error);
      }
    }

    this.routine.set(routineCopy);
    this.cdr.detectChanges();
  }

  startWorkout(): void {
    this.workoutStartTime = Date.now();
    this.sessionState.set(SessionState.Playing);
    this.currentWorkoutLog.set({
      routineId: this.routineId ?? undefined,
      programId: this.programId ?? undefined,
      scheduledDayId: this.scheduledDay() ?? undefined,
      routineName: this.routine()?.name,
      startTime: this.workoutStartTime,
      date: format(new Date(), 'yyyy-MM-dd'),
      exercises: [],
      notes: '',
    });

    this._prefillPerformanceInputs();
    this.startSessionTimer();

    if (this.routine()) {
      this.toggleExerciseExpansion(0);
    }
  }

  startSessionTimer(): void {
    if (this.timerSub) this.timerSub.unsubscribe();
    this.timerSub = timer(0, 1000).subscribe(() => {
      if (this.sessionState() === SessionState.Playing) {
        const currentDeltaSeconds = Math.floor((Date.now() - this.workoutStartTime) / 1000);
        const totalElapsedSeconds = this.sessionTimerElapsedSecondsBeforePause + currentDeltaSeconds;
        const mins = String(Math.floor(totalElapsedSeconds / 60)).padStart(2, '0');
        const secs = String(totalElapsedSeconds % 60).padStart(2, '0');
        this.sessionTimerDisplay.set(`${mins}:${secs}`);
      }
    });
  }

  isCardio(exercise: WorkoutExercise): boolean {
    const base = this.availableExercises.find(e => e.id === exercise.exerciseId);
    return base?.category === 'cardio';
  }

  isDistancedExercise(exIndex: number): boolean {
    const base = this.routine()?.exercises[exIndex];
    if (!base) {
      return false;
    }
    return !!base?.sets?.some(set => set.targetDistance || set.targetDistanceMin) || this.isCardio(base);
  }

  isDurationExercise(exIndex: number): boolean {
    const base = this.routine()?.exercises[exIndex];
    if (!base) {
      return false;
    }
    return !!base?.sets?.some(set => set.targetDuration || set.targetDurationMin);
  }

  isSetDataValid(exIndex: number, setIndex: number): boolean {
    const routine = this.routine();
    if (!routine) return false;

    const exercise = routine.exercises[exIndex];
    const plannedSet = exercise.sets[setIndex];
    if (!plannedSet) return false;

    // Get the user's current, unlogged inputs for this set
    const key = `${exIndex}-${setIndex}`;
    const userInputs = this.performanceInputValues()[key] || {};

    // Prioritize user input, but fall back to the planned set target if the user hasn't typed anything.
    const weightToValidate = userInputs.weightUsed ?? plannedSet.targetWeight;
    const repsToValidate = userInputs.repsAchieved ?? plannedSet.targetReps;
    const distanceToValidate = userInputs.actualDistance ?? plannedSet.targetDistance;
    const durationToValidate = userInputs.actualDuration ?? plannedSet.targetDuration;

    return [weightToValidate, repsToValidate, distanceToValidate, durationToValidate].some(metric => metric !== 0 && metric !== undefined && metric !== null);
  }

  getLoggedSet(exIndex: number, setIndex: number, roundIndex: number = 0): LoggedSet | undefined {
    const exercise = this.routine()?.exercises[exIndex];
    if (!exercise) return undefined;

    const exerciseLog = this.currentWorkoutLog()?.exercises?.find(e => e.id === exercise.id);
    if (!exerciseLog) return undefined;

    const plannedSetId = exercise.sets[setIndex]?.id;

    // CORRECTED: Use a consistent, unique ID format for logged superset sets.
    const targetLoggedSetId = exercise.supersetId ? `${plannedSetId}-round-${roundIndex}` : plannedSetId;

    return exerciseLog.sets.find(s => s.plannedSetId === targetLoggedSetId);
  }

  getExerciseTotalLoggedSets(exIndex: number): number {
    const exercise = this.routine()?.exercises[exIndex];
    if (!exercise) return 0;

    const exerciseLogs = this.currentWorkoutLog()?.exercises?.find(e => e.exerciseId === exercise.exerciseId);
    if (!exerciseLogs) return 0;

    return exerciseLogs?.sets?.length;
  }

  getExerciseTotalSets(exIndex: number): number {
    const exercise = this.routine()?.exercises[exIndex];
    if (!exercise) return 0;

    return exercise.sets?.length || 0;
  }

  isSetCompleted(exIndex: number, setIndex: number, roundIndex?: number): boolean {
    // If roundIndex is not provided (from older calls), default to 0.
    return !!this.getLoggedSet(exIndex, setIndex, roundIndex ?? 0);
  }

  isExerciseLogged(exIndex: number): boolean {
    return !!this.currentWorkoutLog()?.exercises?.find((e, index) => index === exIndex);
  }

  /**
     * Finds the specific logged set for a given exercise, set, and round, and updates its data.
     * This is called by `updateSetData` when a user edits an already-completed set.
     */
  private updateSetDataForRound(exercise: WorkoutExercise, setIndex: number, roundIndex: number, field: string, value: string): void {
    const loggedSetToUpdate = this.getLoggedSet(this.routine()!.exercises.indexOf(exercise), setIndex, roundIndex);

    if (loggedSetToUpdate) {
      this.currentWorkoutLog.update(log => {
        const exerciseLog = log.exercises?.find(e => e.id === exercise.id);
        if (exerciseLog) {
          const setLog = exerciseLog.sets.find(s => s.id === loggedSetToUpdate.id);
          if (setLog) {
            // Update the correct property on the logged set
            switch (field) {
              case METRIC.reps: setLog.repsAchieved = parseFloat(value) || 0; break;
              case METRIC.weight: setLog.weightUsed = parseFloat(value) || undefined; break;
              case METRIC.distance: setLog.distanceAchieved = parseFloat(value) || 0; break;
              case METRIC.duration: setLog.durationPerformed = this.parseTimeToSeconds(value); break;
              case METRIC.rest: setLog.restAfterSetUsed = this.parseTimeToSeconds(value); break;
              case METRIC.tempo: setLog.tempoUsed = String(value); break;
              case METRIC.notes: setLog.notes = value; break;
            }
          }
        }
        return { ...log };
      });
      // Provide user feedback that the already-logged data was changed
      if (field !== 'notes') {
        this.toastService.info("Logged set updated.", 1500);
      }
    }
  }

  updateExerciseNotes(exIndex: number, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.routine.update(r => {
      if (!r) return r;

      // Create a new exercises array with the updated note
      const newExercises = r.exercises.map((ex, index) => {
        if (index === exIndex) {
          // Return a new object for the exercise being changed
          return { ...ex, notes: value };
        }
        return ex; // Return the original object for all other exercises
      });

      // Also update the log in real-time if the exercise is already logged
      const log = this.currentWorkoutLog();
      const loggedEx = log.exercises?.find(ex => ex.id === r.exercises[exIndex].id);
      if (loggedEx) {
        loggedEx.notes = value;
        this.currentWorkoutLog.set({ ...log });
      }

      // Return a new routine object containing the new exercises array
      return { ...r, exercises: newExercises };
    });
  }

  async editSessionNotes() {
    const result = await this.alertService.showPromptDialog(
      this.translate.instant('compactPlayer.alerts.sessionNotesTitle'),
      this.translate.instant('compactPlayer.alerts.sessionNotesMessage'),
      [{
        name: 'notes',
        type: 'text',
        placeholder: this.translate.instant('compactPlayer.alerts.sessionNotesPlaceholder'),
        value: this.currentWorkoutLog().notes ?? undefined,
        autofocus: this.currentWorkoutLog().notes ? false : true
      }] as AlertInput[],
      this.translate.instant('compactPlayer.alerts.saveNotes'),
      this.translate.instant('common.cancel'),
      [{
        role: 'confirm',
        text: this.translate.instant('compactPlayer.alerts.saveNotes'),
        icon: 'save',
        data: true
      } as AlertButton]
    );

    if (result && result['notes'] !== undefined && result['notes'] !== null) {
      this.currentWorkoutLog.update(log => {
        log.notes = String(result['notes']) || '';
        return log;
      });
      this.toastService.success(this.translate.instant('compactPlayer.toasts.sessionNotesUpdated'));
    }
  }

  getInitialExerciseNoteInputValue(exIndex: number): string {
    const exercise = this.routine()!.exercises[exIndex];
    if (exercise) {
      return exercise.notes || '';
    }
    return '';
  }

  parseTimeToSeconds(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(part => parseInt(part, 10) || 0);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  }

  /**
     * Formats a single numeric value of seconds into a "mm:ss" string.
     * @param seconds The number of seconds to format.
     * @returns The formatted time string, or an empty string if the input is invalid.
     */
  private _formatSingleSecondValue(seconds: number | string): string {
    const numericValue = Number(seconds);
    // Return empty if the value is not a valid number
    if (isNaN(numericValue)) {
      return '';
    }

    const mins = String(Math.floor(numericValue / 60)).padStart(2, '0');
    const secs = String(numericValue % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  }

  /**
   * Formats a total number of seconds into a "mm:ss" time string.
   * It can also handle a string representing a range (e.g., "60-90"),
   * which it will format as "01:00-01:30".
   *
   * @param totalSeconds The total seconds as a number, a string, or a range string.
   * @returns The formatted time string.
   */
  formatSecondsToTime(totalSeconds: number | string | undefined): string {
    // 1. Handle null, undefined, or empty string inputs
    if (totalSeconds == null || totalSeconds === '') {
      return '';
    }

    // 2. Check if the input is a range string (e.g., "60-90")
    if (typeof totalSeconds === 'string' && totalSeconds.includes('-')) {
      const [minSeconds, maxSeconds] = totalSeconds.split('-');

      // Format both parts of the range individually using the helper
      const formattedMin = this._formatSingleSecondValue(minSeconds);
      const formattedMax = this._formatSingleSecondValue(maxSeconds);

      // Return the combined formatted range
      return `${formattedMin}-${formattedMax}`;
    }

    // 3. If it's not a range, format it as a single value using the helper
    return this._formatSingleSecondValue(totalSeconds);
  }

  toggleExerciseExpansion(index: number): void {
    const isOpening = this.expandedExerciseIndex() !== index;
    this.expandedExerciseIndex.update(current => (isOpening ? index : null));

    if (isOpening) {
      const exercise = this.routine()?.exercises[index];
      if (exercise) {
        // If it's a superset, handle round expansion
        if (this.isSupersetStart(index)) {
          const firstIncompleteRoundIndex = exercise.sets.findIndex((set, roundIdx) => !this.isRoundCompleted(index, roundIdx));
          const newExpandedRounds = new Set<string>();
          if (firstIncompleteRoundIndex > -1) {
            newExpandedRounds.add(`${index}-${firstIncompleteRoundIndex}`);
          }
          this.expandedRounds.set(newExpandedRounds);
        }
        // If it's a standard exercise, handle set expansion
        else if (!this.isSuperSet(index)) {
          const firstIncompleteSetIndex = exercise.sets.findIndex((set, setIdx) => !this.isSetCompleted(index, setIdx, 0));
          const newExpandedSets = new Set<string>();
          if (firstIncompleteSetIndex > -1) {
            newExpandedSets.add(`${index}-${firstIncompleteSetIndex}`);
          }
          this.expandedSets.set(newExpandedSets);
        }
      }

      // The afterNextRender logic for scrolling remains the same
      runInInjectionContext(this.injector, () => {
        if (this.isDestroyed) {
          return;
        }
        afterNextRender(() => {

          requestAnimationFrame(() => {
            const exercise = this.routine()?.exercises[index];
            const headerElement = this.header?.nativeElement;
            const cardElement = document.querySelector(`[data-exercise-index="${index}"]`) as HTMLElement;

            if (!cardElement || !headerElement || !exercise) {
              return; // Failsafe
            }

            let targetElement: HTMLElement | null = null;

            // Check if any sets for THIS specific exercise have been logged.
            const hasLoggedSetsForThisExercise = this.getExerciseTotalLoggedSets(index) > 0;

            // --- SCROLL LOGIC ---
            // If sets HAVE been logged, find the first uncompleted one to scroll to.
            if (hasLoggedSetsForThisExercise) {
              if (this.isSupersetStart(index)) {
                const targetRoundIndex = exercise.sets.findIndex((set, roundIdx) => !this.isRoundCompleted(index, roundIdx));
                if (targetRoundIndex > -1) {
                  targetElement = cardElement.querySelector(`[data-round-index="${targetRoundIndex}"]`);
                }
              } else if (!this.isSuperSet(index)) {
                const targetSetIndex = exercise.sets.findIndex((set, setIdx) => !this.isSetCompleted(index, setIdx, 0));
                if (targetSetIndex > -1) {
                  targetElement = cardElement.querySelector(`[data-set-index="${targetSetIndex}"]`);
                }
              }
            }
            // If NO sets have been logged for this exercise, 'targetElement' will remain null,
            // which correctly triggers a scroll to the card header below.

            // --- EXECUTE SCROLL ---
            const headerHeight = headerElement.offsetHeight;
            let scrollTopPosition: number;

            if (targetElement) {
              // Scroll to the first uncompleted set/round
              const elementTopPosition = targetElement.getBoundingClientRect().top + window.scrollY;
              scrollTopPosition = elementTopPosition - headerHeight - 10;
            } else {
              // Scroll to the card header itself
              const cardTopPosition = cardElement.getBoundingClientRect().top + window.scrollY;
              scrollTopPosition = cardTopPosition - headerHeight - 10;
            }

            window.scrollTo({ top: scrollTopPosition, behavior: 'smooth' });
          });
        });
      });
    } else {
      // When closing a card, clear the round states
      this.expandedRounds.set(new Set<string>());
      this.expandedSets.set(new Set<string>()); // Also clear sets
    }
  }

  expandedExerciseNotes = signal<number | null>(null);
  expandedSetNotes = signal<string | null>(null); // Key will be "exIndex-setIndex"
  expandedRounds = signal(new Set<string>());

  toggleExerciseNotes(exIndex: number, event: Event) {
    event.stopPropagation();
    this.expandedExerciseNotes.update(current => current === exIndex ? null : exIndex);
  }

  toggleSetNotes(exIndex: number, setIndex: number, event: Event) {
    event.stopPropagation();
    const key = `${exIndex}-${setIndex}`;
    this.expandedSetNotes.update(current => current === key ? null : key);
  }

  // compact-workout-player.component.ts

  async finishWorkout(): Promise<void> {
    const log = this.currentWorkoutLog();
    const loggedExercisesForReport = (log.exercises || []).filter(ex => ex.sets.length > 0);

    if (loggedExercisesForReport.length === 0) {
      this.toastService.info(this.translate.instant('compactPlayer.toasts.noSetsLoggedError'), 3000);
      return;
    }

    // 1. Analyze completion to decide the prompt's tone (Finish vs. Finish Early)
    const analysis = this.analyzeWorkoutCompletion();
    const hasIncomplete = analysis.incompleteExercises.length > 0 || analysis.skippedExercises.length > 0;
    const title = hasIncomplete ? this.translate.instant('compactPlayer.alerts.finishEarlyTitle') : this.translate.instant('compactPlayer.alerts.finishTitle');
    let message = hasIncomplete
      ? this.translate.instant('compactPlayer.alerts.finishEarlyMessage', { skipped: analysis.skippedExercises.length, incomplete: analysis.incompleteExercises.length })
      : this.translate.instant('compactPlayer.alerts.finishMessage');

    const confirmFinish = await this.alertService.showConfirm(title, message, this.translate.instant('compactPlayer.alerts.finishButton'), this.translate.instant('common.cancel'));
    if (!confirmFinish?.data) {
      return; // User cancelled the initial finish prompt
    }

    // 2. Proceed with routine saving logic after confirmation
    const sessionRoutineValue = this.routine();
    let proceedToLog = true;
    let logAsNewRoutine = false;
    let updateOriginalRoutineStructure = false;
    let newRoutineName = sessionRoutineValue?.name
      ? `${sessionRoutineValue.name} - ${format(new Date(), 'MMM d')}`
      : `Ad-hoc Workout - ${format(new Date(), 'MMM d, HH:mm')}`;

    const originalSnapshot = this.originalRoutineSnapshot();
    const isModifiableRoutine = this.routineId && this.routineId !== '-1';

    if (isModifiableRoutine && originalSnapshot && sessionRoutineValue) {
      const differences = this.comparePerformedToOriginal(loggedExercisesForReport, originalSnapshot.exercises);
      if (differences.majorDifference) {
        const choice = await this.alertService.showConfirmationDialog(
          this.translate.instant('compactPlayer.alerts.routineChangedTitle'), this.translate.instant('compactPlayer.alerts.routineChangedMessage'),
          [
            { text: this.translate.instant('compactPlayer.alerts.logOnly'), role: "log", data: "log", cssClass: "bg-purple-600", icon: 'schedule' } as AlertButton,
            { text: this.translate.instant('compactPlayer.alerts.updateOriginal'), role: "destructive", data: "update", cssClass: "bg-blue-600", icon: 'save' } as AlertButton,
            { text: this.translate.instant('compactPlayer.alerts.saveAsNew'), role: "confirm", data: "new", cssClass: "bg-green-600", icon: 'create-folder' } as AlertButton,
          ],
          { listItems: differences.details }
        );

        if (choice?.data === 'new') {
          const nameInput = await this.alertService.showPromptDialog(this.translate.instant('compactPlayer.alerts.newRoutineNameTitle'), this.translate.instant('compactPlayer.alerts.newRoutineNameMessage'), [{ name: "newRoutineName", type: "text", value: newRoutineName, attributes: { required: true } }], this.translate.instant('compactPlayer.alerts.saveRoutine'));
          if (nameInput && String(nameInput['newRoutineName']).trim()) {
            newRoutineName = String(nameInput['newRoutineName']).trim();
            logAsNewRoutine = true;
          } else proceedToLog = false;
        } else if (choice?.data === 'update') {
          updateOriginalRoutineStructure = true;
        } else if (!choice || choice.data !== 'log') {
          proceedToLog = false;
        }
      }
    } else if (!isModifiableRoutine && loggedExercisesForReport.length > 0) { // Ad-hoc or routineId: -1
      const nameInput = await this.alertService.showPromptDialog(
        this.translate.instant('compactPlayer.alerts.saveAdHocTitle'), this.translate.instant('compactPlayer.alerts.saveAdHocMessage'),
        [{ name: "newRoutineName", type: "text", value: newRoutineName, attributes: { required: true } }],
        this.translate.instant('compactPlayer.alerts.createAndLog'), this.translate.instant('compactPlayer.alerts.logOnly'),
        [{ text: this.translate.instant('compactPlayer.alerts.logWithoutSaving'), role: "no_save", data: "cancel", cssClass: "bg-primary text-white", icon: 'schedule' } as AlertButton], false
      );

      if (nameInput && nameInput['newRoutineName'] && String(nameInput['newRoutineName']).trim()) {
        newRoutineName = String(nameInput['newRoutineName']).trim();
        logAsNewRoutine = true;
      } else if (nameInput && nameInput['role'] === 'no_save') {
        logAsNewRoutine = false;
      } else {
        proceedToLog = false;
      }
    }

    if (!proceedToLog) {
      this.toastService.info(this.translate.instant('compactPlayer.toasts.finishCancelled'), 3000);
      return;
    }

    // 3. Finalize and save the log and routine
    let finalRoutineIdToLog: string | undefined = this.routineId || undefined;
    let finalRoutineNameForLog = sessionRoutineValue?.name || 'Ad-hoc Workout';

    if (logAsNewRoutine) {
      const newRoutineDef: Omit<Routine, 'id'> = {
        name: newRoutineName,
        description: sessionRoutineValue?.description || `Workout from ${format(new Date(), 'MMM d, yyyy')}`,
        goal: sessionRoutineValue?.goal || 'custom',
        exercises: this.convertLoggedToWorkoutExercises(loggedExercisesForReport),
      };
      const createdRoutine = this.workoutService.addRoutine(newRoutineDef);
      finalRoutineIdToLog = createdRoutine.id;
      finalRoutineNameForLog = createdRoutine.name;
      this.toastService.success(this.translate.instant('compactPlayer.toasts.newRoutineCreated', { name: createdRoutine.name }));
    }

    if (updateOriginalRoutineStructure && finalRoutineIdToLog) {
      const routineToUpdate = await firstValueFrom(this.workoutService.getRoutineById(finalRoutineIdToLog).pipe(take(1)));
      if (routineToUpdate) {
        routineToUpdate.exercises = this.convertLoggedToWorkoutExercises(loggedExercisesForReport);
        this.workoutService.updateRoutine(routineToUpdate, true);
        this.toastService.success(this.translate.instant('compactPlayer.toasts.routineUpdated', { name: routineToUpdate.name }));
      }
    }

    log.endTime = Date.now();
    log.durationMinutes = Math.round((log.endTime - (log.startTime!)) / 60000);
    log.exercises = loggedExercisesForReport;
    log.routineId = finalRoutineIdToLog;
    log.routineName = finalRoutineNameForLog;

    if (log.startTime) {
      if (this.program()) log.iterationId = this.program()?.iterationId;

      const savedLog = this.trackingService.addWorkoutLog(log as Omit<WorkoutLog, 'id'> & { startTime: number });
      this.sessionState.set(SessionState.End);
      this.isSessionConcluded = true;
      this.workoutService.removePausedWorkout(false);
      this.timerSub?.unsubscribe();

      if (savedLog.programId) {
        const isProgramCompleted = await this.trainingProgramService.checkAndHandleProgramCompletion(savedLog.programId, savedLog);
        if (isProgramCompleted) {
          this.toastService.success(this.translate.instant('compactPlayer.workoutComplete'), 5000, "Program Finished", false);
          this.router.navigate(['/training-programs/completed', savedLog.programId], { queryParams: { logId: savedLog.id } });
          return;
        }
      }
      this.audioService.playSound(AUDIO_TYPES.tada);
      this.router.navigate(['/workout/summary', savedLog.id], {
        queryParams: { newlyCompleted: 'true' }
      });

    } else {
      this.toastService.error(this.translate.instant('compactPlayer.toasts.saveError'));
    }
  }

  analyzeWorkoutCompletion(): { completedExercises: string[], incompleteExercises: string[], skippedExercises: string[] } {
    const routine = this.routine();
    if (!routine) return { completedExercises: [], incompleteExercises: [], skippedExercises: [] };
    const completed: string[] = [], incomplete: string[] = [], skipped: string[] = [];
    routine.exercises.forEach(ex => {
      const loggedEx = this.currentWorkoutLog().exercises?.find(le => le.id === ex.id);
      const loggedSetCount = loggedEx?.sets.length ?? 0;
      if (loggedSetCount === ex.sets.length) completed.push(ex.exerciseName!);
      else if (loggedSetCount > 0) incomplete.push(ex.exerciseName!);
      else skipped.push(ex.exerciseName!);
    });
    return { completedExercises: completed, incompleteExercises: incomplete, skippedExercises: skipped };
  }

  toggleActionMenu(index: number, event: Event) {
    event.stopPropagation();
    this.activeActionMenuIndex.update(current => current === index ? null : index);
  }

  closeActionMenu() { this.activeActionMenuIndex.set(null); }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }) {
    const { actionKey, data: { exIndex } } = event;
    switch (actionKey) {
      case 'switchExercise': this.openSwitchExerciseModal(exIndex); break;
      case 'insights': this.openPerformanceInsightsModal(exIndex); break;
      // CORRECTED: 'add_round' is now handled by 'add_set'
      case 'add_set': this.addSet(exIndex); break;
      case 'remove_set': this.removeSet(exIndex, 0); break;
      case 'add_warmup_set': this.addWarmupSet(exIndex); break;
      case 'remove': this.removeExercise(exIndex); break;
      case 'create_superset': this.openCreateSupersetModal(exIndex); break;
      case 'add_to_superset': this.addToSupersetModal(exIndex); break;
      // case 'remove_from_superset': this.removeFromSuperset(exIndex); break;
    }
  }

  addWarmupSet(exIndex: number) {
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[exIndex];
    const firstSet = exercise.sets[0];
    const newWarmupSet: ExerciseTargetSetParams = {
      id: uuidv4(), targetReps: 12, targetWeight: firstSet?.targetWeight ? parseFloat((firstSet.targetWeight / 2).toFixed(1)) : 0,
      restAfterSet: 30, type: 'warmup'
    };
    exercise.sets.unshift(newWarmupSet);

    this.routine.set({ ...routine });

    this.toastService.success(`Warm-up set added to ${exercise.exerciseName}`);
    if (this.expandedExerciseIndex() !== exIndex) {
      this.expandedExerciseIndex.set(exIndex);
    }
  }

  addSet(exIndex: number, type: 'standard' | 'warmup' = 'standard') {
    const routine = this.routine();
    if (!routine) return;

    const triggerExercise = routine.exercises[exIndex];

    // --- CASE 1: Exercise is part of a Superset (Add a new ROUND) ---
    if (triggerExercise.supersetId) {
      if (type === 'warmup') {
        this.toastService.info("Cannot add a warm-up round to a superset.", 3000);
        return;
      }

      const exercisesInGroup = this.getSupersetExercises(triggerExercise.supersetId);

      exercisesInGroup.forEach((groupEx, index) => {
        const lastSet = groupEx.sets.length > 0 ? groupEx.sets[groupEx.sets.length - 1] : null;

        const newSet: ExerciseTargetSetParams = {
          id: uuidv4(),
          type: 'standard',
          restAfterSet: lastSet?.restAfterSet ?? 60,
        };

        // Conditionally copy properties only if they existed on the last set
        if (lastSet) {

          const key = `${exIndex}-${index}`;

          if (!this.performanceInputValues()[key]) {
            this.fillPerformanceInputIfUndefined(exIndex, index);
          }

          const userInputs = this.performanceInputValues()[key];

          const weight = userInputs.weightUsed ?? lastSet.targetWeight ?? undefined;
          const reps = userInputs.repsAchieved ?? lastSet.targetReps ?? undefined;
          const distance = userInputs.actualDistance ?? lastSet.targetDistance ?? undefined;
          const duration = userInputs.actualDuration ?? lastSet.targetDuration ?? undefined;
          const tempo = userInputs.tempoUsed ?? lastSet.targetTempo ?? undefined;
          if (weight) newSet.targetReps = weight;
          if (reps) newSet.targetWeight = reps;
          if (distance) newSet.targetDistance = distance;
          if (duration) newSet.targetDuration = duration;
          if (tempo) newSet.targetTempo = tempo;
        } else {
          // Failsafe: if an exercise in a superset has no sets, give it a default structure
          newSet.targetReps = 8;
          newSet.targetWeight = 10;
        }
        groupEx.sets.push(newSet);
      });

      this.toastService.success(`Round added to ${this.isEmom(exIndex) ? 'EMOM' : 'Superset'}`);

    } else {
      // --- CASE 2: Standard Exercise ---
      const lastSet = triggerExercise.sets.length > 0 ? triggerExercise.sets[triggerExercise.sets.length - 1] : null;

      const newSet: ExerciseTargetSetParams = {
        id: uuidv4(),
        type: type,
        restAfterSet: lastSet?.restAfterSet ?? 60,
      };

      if (type === 'warmup') {
        newSet.targetReps = 12;
        if (lastSet && lastSet.targetWeight !== undefined && lastSet.targetWeight !== null) {
          newSet.targetWeight = parseFloat((lastSet.targetWeight / 2).toFixed(1));
        } else {
          // If the last set was bodyweight, the warmup is also bodyweight (no weight property)
          // Or if no last set exists, create a default bodyweight warmup
          newSet.targetWeight = 0;
        }
      } else { // It's a 'standard' set
        if (lastSet) {
          // Copy properties from the last set only if they exist
          const setIndex = triggerExercise.sets.length - 1;
          const key = `${exIndex}-${setIndex}`;

          if (!this.performanceInputValues()[key]) {
            this.fillPerformanceInputIfUndefined(exIndex, setIndex);
          }

          const userInputs = this.performanceInputValues()[key];



          const weight = userInputs.weightUsed ?? lastSet.targetWeight ?? undefined;
          const reps = userInputs.repsAchieved ?? lastSet.targetReps ?? undefined;
          const distance = userInputs.actualDistance ?? lastSet.targetDistance ?? undefined;
          const duration = userInputs.actualDuration ?? lastSet.targetDuration ?? undefined;
          const tempo = userInputs.tempoUsed ?? lastSet.targetTempo ?? undefined;
          if (weight) newSet.targetReps = weight;
          if (reps) newSet.targetWeight = reps;
          if (distance) newSet.targetDistance = distance;
          if (duration) newSet.targetDuration = duration;
          if (tempo) newSet.targetTempo = tempo;
        } else {
          // This is the very first set for this exercise, create a default structure
          newSet.targetWeight = 10;
          newSet.targetReps = 8;
        }
      }

      if (type === 'warmup') {
        triggerExercise.sets.unshift(newSet);
      } else {
        triggerExercise.sets.push(newSet);
      }
      this.toastService.success(`${type === 'warmup' ? 'Warm-up set' : 'Set'} added to ${triggerExercise.exerciseName}`);
    }

    this.routine.set({ ...routine });
    if (this.expandedExerciseIndex() !== exIndex) {
      this.expandedExerciseIndex.set(exIndex);
    }
  }

  async removeSet(exIndex: number, setIndex: number): Promise<void> {
    const routine = this.routine();
    if (!routine) return;

    const exercise = routine.exercises[exIndex];

    // --- CASE 1: Removing a Superset Round ---
    if (exercise.supersetId) {
      const roundIndexToRemove = exercise.sets.length - 1;
      const exercisesInGroup = this.getSupersetExercises(exercise.supersetId);

      // Failsafe: if the exercise is somehow the last in a group and has no sets, treat it as an exercise removal.
      if (exercisesInGroup[0]?.sets.length === 1) {
        const confirmLast = await this.alertService.showConfirm(
          "Remove Last Round",
          `This is the last round of the superset. Removing it will delete the entire superset from the workout. Continue?`,
          'Remove Superset', 'Cancel'
        );
        if (confirmLast?.data) {
          await this.removeExercise(exIndex, true); // This now correctly handles removing the whole group
        }
        return;
      }

      const confirm = await this.alertService.showConfirm(
        "Remove Round",
        `This will remove Round ${roundIndexToRemove + 1} from all exercises in this superset and clear any logged data for it. Are you sure?`
      );
      if (!confirm?.data) return;

      // *** ENHANCEMENT 1: More Robust Log Cleanup ***
      // Get the specific plannedSetIds for the round being removed across all exercises in the group.
      const plannedSetIdsForRoundToRemove = exercisesInGroup
        .map(ex => ex.sets[roundIndexToRemove]?.id)
        .filter((id): id is string => !!id);

      // Remove the corresponding logged sets using their unique generated IDs.
      this.currentWorkoutLog.update(log => {
        if (!log.exercises) return log;
        log.exercises.forEach(loggedEx => {
          if (loggedEx.supersetId === exercise.supersetId) {
            loggedEx.sets = loggedEx.sets.filter(s => {
              // The unique ID is "{plannedSetId}-round-{roundIndex}"
              const uniqueLoggedId = `${s.plannedSetId?.split('-round-')[0]}`;
              return !plannedSetIdsForRoundToRemove.includes(uniqueLoggedId);
            });
          }
        });
        return { ...log };
      });

      // Update the routine definition by removing the set from each exercise
      this.routine.update(r => {
        if (!r) return r;
        // Re-fetch from the updated routine signal to be safe
        r.exercises.filter(ex => ex.supersetId === exercise.supersetId).forEach(groupEx => {
          if (groupEx.sets.length > roundIndexToRemove) {
            groupEx.sets.splice(roundIndexToRemove, 1);
          }
        });
        return { ...r };
      });

      this.toastService.info(`Round ${roundIndexToRemove + 1} removed from the superset.`);
      this.audioService.playSound(AUDIO_TYPES.whoosh);

    } else {
      // --- CASE 2: Removing a Standard Set (Logic remains the same as it's already robust) ---

      const newSetIndex = setIndex < 0 ? exercise.sets.length - 1 : setIndex;
      const setToRemove = exercise.sets[newSetIndex];
      const isLastSet = exercise.sets.length <= 1;

      let confirmMessage = `Are you sure you want to remove the set from ${exercise.exerciseName}?`;
      if (isLastSet) {
        confirmMessage = `This will also remove the exercise from the workout. Continue?`;
      }

      const confirm = await this.alertService.showConfirm("Remove Set", confirmMessage);
      if (!confirm?.data) return;

      // Clear log for this specific set
      this.currentWorkoutLog.update(log => {
        const exerciseLog = log.exercises?.find(e => e.id === exercise.id);
        if (exerciseLog) {
          exerciseLog.sets = exerciseLog.sets.filter(s => s.plannedSetId !== setToRemove.id);
        }
        return { ...log };
      });

      // Remove from routine definition
      exercise.sets.splice(newSetIndex, 1);

      if (exercise.sets.length === 0) {
        this.removeExercise(exIndex, true);
      } else {
        this.routine.set({ ...routine });
        this.toastService.info(`Set removed from ${exercise.exerciseName}`);
        this.audioService.playSound(AUDIO_TYPES.whoosh);
      }
    }
  }

  private removeSuperset(exIndex: number): void {
    const routine = this.routine();
    if (!routine) return;

    const exerciseToRemove = routine.exercises[exIndex];
    const supersetId = exerciseToRemove.supersetId;

    // Filter out all exercises belonging to this superset from the routine
    const updatedExercises = routine.exercises.filter(ex => ex.supersetId !== supersetId);
    routine.exercises = updatedExercises;
    this.routine.set({ ...routine });

    // Filter out all logged exercises belonging to this superset from the log
    this.currentWorkoutLog.update(log => {
      if (log.exercises) {
        log.exercises = log.exercises.filter(ex => ex.supersetId !== supersetId);
      }
      return { ...log };
    });

    this.audioService.playSound(AUDIO_TYPES.whoosh);
  }

  private removeExerciseNoPrompt(exIndex: number): void {
    const routine = this.routine();
    if (!routine) return;
    const exerciseToRemove = routine.exercises[exIndex];

    // Remove the single exercise from the routine
    routine.exercises.splice(exIndex, 1);
    this.routine.set({ ...routine });

    // Remove the single corresponding exercise from the log
    this.currentWorkoutLog.update(log => {
      if (log.exercises) {
        const logExIndex = log.exercises.findIndex(le => le.id === exerciseToRemove.id);
        if (logExIndex > -1) {
          log.exercises.splice(logExIndex, 1);
        }
      }
      return { ...log };
    });

    this.toastService.info(`${exerciseToRemove.exerciseName} removed`);
    this.audioService.playSound(AUDIO_TYPES.whoosh);
  }


  async removeExercise(exIndex: number, confirmRequest: boolean = false): Promise<void> {
    const routine = this.routine();
    if (!routine) return;

    const exerciseToRemove = routine.exercises[exIndex];
    const supersetId = exerciseToRemove.supersetId;

    // --- CASE 0: Forcely removing an entire Superset group / exercise ---
    if (confirmRequest) {
      if (supersetId) {
        this.removeSuperset(exIndex);
      } else {
        this.removeExerciseNoPrompt(exIndex);
      }
      return;
    }

    // --- CASE 1: Removing an entire Superset group ---
    if (supersetId) {
      const supersetName = this.getSupersetDisplayName(supersetId);
      const confirm = await this.alertService.showConfirm(
        "Remove Superset",
        `This will remove the entire "${supersetName}" superset and all its logged data for this session. Are you sure?`,
        'Remove Superset',
        'Cancel'
      );

      if (!confirm?.data && !confirmRequest) return;
      this.removeSuperset(exIndex);
      return;

    } else {
      // --- CASE 2: Removing a Standard (standalone) Exercise ---
      const isExerciseLogged = this.isExerciseLogged(exIndex);
      const confirmMessage = isExerciseLogged
        ? `Are you sure you want to remove ${exerciseToRemove.exerciseName}? All logged data for this exercise in this session will be lost.`
        : `Are you sure you want to remove ${exerciseToRemove.exerciseName}?`;

      const confirm = await this.alertService.showConfirm("Remove Exercise", confirmMessage);

      if (confirm?.data) {
        this.removeExerciseNoPrompt(exIndex);
      }
    }
  }

  private loadAvailableExercises(): void {
    this.exerciseService.getExercises().pipe(take(1)).subscribe(e => {
      this.availableExercises = e.filter(ex => !ex.isHidden)
      this.defaultExercises = e.filter(ex => !ex.isHidden)
    });
  }

  openAddExerciseModal(): void { this.isAddExerciseModalOpen.set(true); }
  closeAddExerciseModal(): void {
    this.isAddExerciseModalOpen.set(false);
    this.modalSearchTerm.set('');
  }

  openSwitchExerciseModal(exIndex: number): void {
    this.exerciseToSwitchIndex.set(exIndex);

    // Set the initial list for the modal to the full, searchable list
    this.exercisesForSwitchModal.set(this.availableExercises);

    this.isSwitchExerciseModalOpen.set(true);
    this.isShowingSimilarInSwitchModal.set(false); // Ensure we start in search mode
    this.modalSearchTerm.set('');
  }
  closeSwitchExerciseModal(): void {
    this.isSwitchExerciseModalOpen.set(false);
    this.isShowingSimilarInSwitchModal.set(false);
    this.exerciseToSwitchIndex.set(null);
    this.modalSearchTerm.set('');
  }

  async openPerformanceInsightsModal(exIndex: number): Promise<void> {
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[exIndex];
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
        return;
      }
      const completedSets = this.currentWorkoutLog().exercises?.find(e => e.id === exercise.id)?.sets || [];
      this.insightsData.set({ exercise, baseExercise, lastPerformance, personalBests, completedSetsInSession: completedSets });
      this.isPerformanceInsightsModalOpen.set(true);
    } catch (error) {
      console.error("Failed to load performance insights:", error);
      this.toastService.error("Could not load performance data.");
    }
  }

  closePerformanceInsightsModal(): void {
    this.isPerformanceInsightsModalOpen.set(false);
    this.insightsData.set(null);
  }

  async handleTrulyCustomExerciseEntry(): Promise<void> {
    this.closeAddExerciseModal();
    const currentRoutineVal = this.routine();
    if (!currentRoutineVal) { return; }
    const newCustomExercise: Exercise = {
      id: `custom-adhoc-ex-${uuidv4()}`,
      name: 'Custom exercise',
      description: '', category: 'bodyweight/calisthenics', muscleGroups: [], primaryMuscleGroup: '', imageUrls: []
    };
    await this.selectExerciseToAddFromModal(newCustomExercise);
  }

  async selectExerciseToAddFromModal(selectedExercise: Exercise): Promise<void> {
    this.closeAddExerciseModal();
    const routine = this.routine();
    if (!routine) {
      this.toastService.error("Cannot add exercise: routine data unavailable.", 0, "Error");
      return;
    }

    const log = this.currentWorkoutLog();
    const allLoggedExercises = log.exercises || [];
    const lastLoggedExercise = allLoggedExercises.length > 0 ? allLoggedExercises[allLoggedExercises.length - 1] : null;
    const lastLoggedSet = lastLoggedExercise && lastLoggedExercise.sets.length > 0 ? lastLoggedExercise.sets[lastLoggedExercise.sets.length - 1] : null;

    const newWorkoutExercise = await this.workoutService.promptAndCreateWorkoutExercise(selectedExercise, lastLoggedSet);

    if (newWorkoutExercise) {
      if (selectedExercise.id.startsWith('custom-adhoc-ex-')) {
        const newExerciseToBeSaved = this.exerciseService.mapWorkoutExerciseToExercise(newWorkoutExercise, selectedExercise);
        this.exerciseService.addExercise(newExerciseToBeSaved);
      }
      this.addExerciseToRoutine(newWorkoutExercise);
    }
  }

  // +++ MODIFIED: Now accepts a fully formed WorkoutExercise +++
  addExerciseToRoutine(newWorkoutExercise: WorkoutExercise): void {
    this.routine.update(r => {
      // If the routine doesn't exist, we can't add to it.
      if (!r) return r;

      return {
        ...r,
        exercises: [...r.exercises, newWorkoutExercise]
      };
    });

    // We now set the expanded index *after* the update has been processed.
    // Use an effect or a simple timeout to ensure the DOM has time to react.
    setTimeout(() => {
      const newIndex = (this.routine()?.exercises.length ?? 1) - 1;
      this.expandedExerciseIndex.set(newIndex);
    }, 0);

    this.closeAddExerciseModal();
  }

  handleExerciseSwitch(newExercise: Exercise) {
    const index = this.exerciseToSwitchIndex();
    if (index === null) return;

    this.routine.update(r => {
      if (r) {
        const oldWorkoutExercise = r.exercises[index];
        const oldExerciseName = oldWorkoutExercise.exerciseName;

        const oldBaseExercise = this.availableExercises.find(ex => ex.id === oldWorkoutExercise.exerciseId);
        const newBaseExercise = this.availableExercises.find(ex => ex.id === newExercise.id);

        if (oldBaseExercise && newBaseExercise && oldBaseExercise.category !== newBaseExercise.category) {
          this.toastService.info(`Switching exercise type. Set data will be reset.`, 3000);
          oldWorkoutExercise.sets.forEach(set => {
            if (newBaseExercise.category === 'cardio') {
              set.targetWeight = undefined;
              set.targetReps = undefined;
              set.targetDistance = set.targetDistance ?? 1; // Default cardio values
              set.targetDuration = set.targetDuration ?? 300;
            } else { // Assuming switch to strength or other non-cardio
              set.targetDistance = undefined;
              set.targetDuration = undefined;
              set.targetWeight = set.targetWeight ?? 10; // Default strength values
              set.targetReps = set.targetReps ?? 8;
            }
          });
        }

        oldWorkoutExercise.exerciseId = newExercise.id;
        oldWorkoutExercise.exerciseName = newExercise.name;

        this.toastService.success(`Switched ${oldExerciseName} with ${newExercise.name}`);
      }
      return r;
    });
    this.closeSwitchExerciseModal();
  }

  formatPbValue(pb: PersonalBestSet): string {
    if (pb.weightUsed != null && pb.weightUsed > 0) {
      let value = this.weightUnitPipe.transform(pb.weightUsed);
      if (pb.repsAchieved > 1) value += ` x ${pb.repsAchieved}`;
      return value || 'N/A';
    }
    if (pb.repsAchieved > 0) return `${pb.repsAchieved} reps`;
    if (pb.durationPerformed) return `${pb.durationPerformed}s`;
    return 'N/A';
  }

  async findAndShowSimilarExercises(exerciseToSwitchIndex: number | null): Promise<void> {
    if (exerciseToSwitchIndex === null) return;
    const exercise = this.routine()?.exercises[exerciseToSwitchIndex];
    if (!exercise) return;

    let baseExercise = this.availableExercises.find(ex => ex.id === exercise.exerciseId);
    if (!baseExercise) {
      baseExercise = await lastValueFrom(this.exerciseService.getExerciseById(exercise.exerciseId).pipe(take(1)));
      if (!baseExercise) {
        this.toastService.error("Could not load details for the current exercise.");
        return;
      }
    }
    try {
      const similar = await lastValueFrom(this.exerciseService.getSimilarExercises(baseExercise, 12).pipe(take(1)));
      if (similar.length === 0) this.toastService.info("No similar exercises found.");

      // Overwrite the modal's list with the new 'similar' list
      this.exercisesForSwitchModal.set(similar);
      this.isShowingSimilarInSwitchModal.set(true); // Switch the view mode

    } catch (error) {
      this.toastService.error("Could not load similar exercises.");
    }
  }

  onBackToSearchFromSimilar(): void {
    // Reset the modal's list back to the full, searchable list
    this.exercisesForSwitchModal.set(this.availableExercises);
    this.isShowingSimilarInSwitchModal.set(false); // Switch the view mode back
    this.modalSearchTerm.set('');
  }

  toggleCompletedSetsForExerciseInfo(): void { this.showCompletedSetsForExerciseInfo.update(v => !v); }
  toggleCompletedSetsForDayInfo(): void { this.showCompletedSetsForDayInfo.update(v => !v); }

  areActionsVisible(exerciseIndex: number): boolean {
    return this.activeActionMenuIndex() === exerciseIndex;
  }

  toggleMainSessionActionMenu(event: Event | null) {
    event?.stopPropagation();
    this.mainSessionActionMenuOpened.update(current => current === true ? false : true);
  }

  protected menuButtonBaseClass = computed(() => {
    const isModalMenu = this.appSettingsService.isMenuModeModal();
    const isCompactMenu = this.appSettingsService.isMenuModeCompact();
    // This is the common part for all buttons, if they need special modal styling
    return isModalMenu ? " w-full flex justify-start items-center text-black dark:text-white hover:text-white text-left px-4 py-2 rounded-md text-xl font-medium " : '';
  });

  isCalculatorModalVisible: boolean = false;
  openCalculatorModal(): void {
    this.isCalculatorModalVisible = true;
  }

  closeCalculatorModal(): void {
    this.isCalculatorModalVisible = false;
  }

  mainSessionActionItems = computed<ActionMenuItem[]>(() => {
    // Read dependencies once at the beginning of the computed function
    const isPaused = this.sessionState() === 'paused';
    const hasExercises = (this.routine()?.exercises?.length ?? 0) > 0;
    const commonModalButtonClass = this.menuButtonBaseClass(); // Use the new computed property

    const addExerciseDisabledClass = (isPaused || !hasExercises ? 'disabled ' : '');

    const barbellCalculatorBtn = {
      actionKey: 'weight_toolkit',
      iconName: 'dumbbell',
      buttonClass: 'bg-yellow-800'
    } as ActionMenuItem;

    const actions: ActionMenuItem[] = [
      {
        ...(isPaused ? resumeSessionBtn : pauseSessionBtn),
        overrideCssButtonClass: (isPaused ? resumeSessionBtn.buttonClass : pauseSessionBtn.buttonClass) + commonModalButtonClass
      },
      {
        ...sessionNotesBtn,
        overrideCssButtonClass: sessionNotesBtn.buttonClass + commonModalButtonClass
      },
      {
        ...addExerciseBtn,
        overrideCssButtonClass: addExerciseDisabledClass + addExerciseBtn.buttonClass + commonModalButtonClass
      },
      {
        ...calculatorBtn,
        overrideCssButtonClass: calculatorBtn.buttonClass + commonModalButtonClass
      },
      { isDivider: true },
      {
        ...quitWorkoutBtn,
        overrideCssButtonClass: quitWorkoutBtn.buttonClass + commonModalButtonClass
      },
    ];

    return actions;
  });


  handleMainSessionActionMenuItemClick(event: { actionKey: string, data?: any }) {
    const { actionKey } = event;
    switch (actionKey) {
      case 'pause': this.pauseSession(); break;
      case 'weight_toolkit': this.openCalculatorModal(); break;
      case 'play': this.resumeSession(); break;
      case 'session_notes': this.editSessionNotes(); break;
      case 'addExercise': this.openAddExerciseModal(); break;
      case 'exit': this.quitWorkout(); break;
    }
  }

  async quitWorkout(): Promise<void> {
    const confirmQuit = await this.alertService.showConfirm(this.translate.instant('compactPlayer.alerts.quitTitle'), this.translate.instant('compactPlayer.alerts.quitMessage'));
    if (confirmQuit && confirmQuit.data) {
      this.isSessionConcluded = true;
      this.toggleMainSessionActionMenu(null);
      this.router.navigate(['/workout']);
      this.toastService.info(this.translate.instant('compactPlayer.toasts.noSetsLoggedError'), 4000);
    }
  }

  retrieveExerciseSetIndex(exIndex: number, setIndex: number): number {
    const isSuperSet = this.isSuperSet(exIndex);
    // const ex = this.routine()?.exercises[exIndex];
    return (isSuperSet ? 0 : setIndex) + 1;
  }

  private isExerciseFullyLogged(currentExercise: WorkoutExercise): boolean {
    const loggedEx = this.currentWorkoutLog().exercises?.find(le => le.id === currentExercise.id);
    if (!loggedEx) return false;
    // CORRECTED: Total planned completions is simply the number of sets.
    return loggedEx.sets.length >= currentExercise.sets.length;
  }


  private isExercisePartiallyLogged(currentExercise: WorkoutExercise): boolean {
    const loggedEx = this.currentWorkoutLog().exercises?.find(le => le.id === currentExercise.id);
    if (!loggedEx || loggedEx.sets.length === 0) return false;
    // CORRECTED: Check against the total number of sets.
    const totalPlannedCompletions = currentExercise.sets.length;
    return loggedEx.sets.length > 0 && loggedEx.sets.length < totalPlannedCompletions;
  }

  compactActionItemsMap = computed<Map<number, ActionMenuItem[]>>(() => {
    const map = new Map<number, ActionMenuItem[]>();
    const routine = this.routine(); // Read the dependency signal once
    const commonModalButtonClass = this.menuButtonBaseClass();

    if (!routine) {
      return map; // Return an empty map if there's no routine
    }

    // Loop through each exercise and build its specific action item array
    routine.exercises.forEach((exercise, exIndex) => {
      // Create new objects using spread and concatenate class strings
      const currSwitchExerciseBtn = {
        ...switchExerciseBtn,
        data: { exIndex },
        overrideCssButtonClass: switchExerciseBtn.buttonClass + commonModalButtonClass
      };
      const currOpenPerformanceInsightsBtn = {
        ...openSessionPerformanceInsightsBtn,
        data: { exIndex },
        overrideCssButtonClass: openSessionPerformanceInsightsBtn.buttonClass + commonModalButtonClass
      };

      const baseAddSetRoundBtn = !this.isSuperSet(exIndex) ? addSetToExerciseBtn : { ...addRoundToExerciseBtn, actionKey: 'add_set' };
      const baseRemoveSetRoundBtn = !this.isSuperSet(exIndex) ? removeSetFromExerciseBtn : { ...removeRoundFromExerciseBtn, actionKey: 'remove_set' };
      const addSetRoundBtn = {
        ...baseAddSetRoundBtn,
        data: { exIndex },
        overrideCssButtonClass: baseAddSetRoundBtn.buttonClass + commonModalButtonClass
      };
      const removeSetRoundBtn = {
        ...baseRemoveSetRoundBtn,
        data: { exIndex },
        overrideCssButtonClass: baseRemoveSetRoundBtn.buttonClass + commonModalButtonClass
      };

      const addWarmupSetBtnItem = {
        ...addWarmupSetBtn,
        data: { exIndex },
        overrideCssButtonClass: addWarmupSetBtn.buttonClass + commonModalButtonClass
      };

      const removeExerciseBtnItem = {
        ...removeExerciseBtn,
        label: this.isSuperSet(exIndex) ? 'Remove superset' : removeExerciseBtn.label,
        data: { exIndex },
        overrideCssButtonClass: removeExerciseBtn.buttonClass + commonModalButtonClass
      } as ActionMenuItem;

      let actionsArray: ActionMenuItem[] = [
        currOpenPerformanceInsightsBtn
      ];

      if (!this.isExercisePartiallyLogged(exercise) && !this.isExerciseFullyLogged(exercise) && !this.isSuperSet(exIndex)) {
        actionsArray.push(addWarmupSetBtnItem as ActionMenuItem);
        actionsArray.push(currSwitchExerciseBtn as ActionMenuItem);
      }

      actionsArray = [...actionsArray,
      addSetRoundBtn as ActionMenuItem,
      { isDivider: true },
      removeSetRoundBtn as ActionMenuItem,
        removeExerciseBtnItem,
      ];

      // RULE 1: "Remove from Superset"
      if (exercise?.supersetId) {
        // actionsArray.push({
        //   ...removeFromSuperSetBtn,
        //   data: { exIndex },
        //   overrideCssButtonClass: removeFromSuperSetBtn.buttonClass + commonModalButtonClass
        // } as ActionMenuItem);
      } else {
        // RULES 2 & 3: "Add to" and "Create Superset"
        if (routine.exercises.length >= 2) {
          if (routine.exercises.some(ex => ex.supersetId)) {
            actionsArray.push({
              ...addToSuperSetBtn,
              data: { exIndex },
              overrideCssButtonClass: addToSuperSetBtn.buttonClass + commonModalButtonClass
            });
          }
          if (routine.exercises.filter(ex => !ex.supersetId).length >= 2) {
            actionsArray.push({
              ...createSuperSetBtn,
              data: { exIndex },
              overrideCssButtonClass: createSuperSetBtn.buttonClass + commonModalButtonClass
            });
          }
        }
      }

      // Set the generated array in the map with the exercise's index as the key
      map.set(exIndex, actionsArray);
    });

    return map;
  });

  // +++ MODIFIED: This method now also sets the next set's details for the rest timer UI
  private async startRestPeriod(duration: number, completedExIndex: number, completedSetIndex: number): Promise<void> {
    this.playerSubState.set(PlayerSubState.Resting);
    this.restDuration.set(duration);
    this.restTimerMainText.set('RESTING');
    this.restTimerNextUpText.set('Loading next set...');
    this.restTimerNextSetDetails.set(null);
    this.isRestTimerVisible.set(true);

    const nextStep = await this.peekNextStepInfo(completedExIndex, completedSetIndex);

    if (!nextStep.exercise || !nextStep.details) {
      this.restTimerNextUpText.set("Workout Complete!");
      this.restTimerNextSetDetails.set(null);
      return;
    }

    const { exercise, details: plannedSet, historicalSet } = nextStep;
    const nextExIndex = this.getOriginalExIndex(exercise.id);
    const nextSetIndex = exercise.sets.indexOf(plannedSet);

    // --- CASE 1: The next item is part of a Superset ---
    if (exercise.supersetId) {
      const supersetId = exercise.supersetId;
      const roundIndex = exercise.sets.indexOf(plannedSet);
      const exercisesInGroup = this.getSupersetExercises(supersetId);
      const totalRounds = exercisesInGroup.length > 0 ? exercisesInGroup[0].sets.length : 0;

      let titleLine: string;
      if (exercise.supersetType === 'emom') {
        const emomTime = exercise.emomTimeSeconds;
        titleLine = `EMOM: Round ${roundIndex + 1}/${totalRounds} (Every ${emomTime}s)`;
      } else {
        titleLine = `Next Up: Round ${roundIndex + 1}/${totalRounds}`;
      }

      const detailLines = exercisesInGroup.map(groupEx => {
        const setForThisRound = groupEx.sets[roundIndex];
        if (!setForThisRound) return '';

        const originalExIndex = this.getOriginalExIndex(groupEx.id);
        const displayIndex = this.getExerciseDisplayIndex(originalExIndex);
        const exName = groupEx.exerciseName;

        // +++ MODIFIED: Pass all required indices to the formatting function +++
        const targetDetails = this.formatSetTargetForDisplay(setForThisRound, groupEx, originalExIndex, roundIndex);

        return `<div class="flex items-start gap-3 mt-3">
                    <span class="font-bold text-gray-400 dark:text-gray-300 w-8 text-center">${displayIndex}</span>
                    <div class="flex-1 text-left">
                        <p class="font-semibold text-gray-800 dark:text-white">${exName}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${targetDetails}</p>
                    </div>
                </div>`;
      }).join('');

      this.restTimerNextUpText.set(`<div class="text-left"><p class="text-lg font-bold">${titleLine}</p></div><div class="mt-2">${detailLines}</div>`);

    } else {
      // --- CASE 2: The next item is a Standard Exercise ---
      const line1 = exercise.exerciseName;
      const setIndex = exercise.sets.indexOf(plannedSet);
      const line2 = `Set ${setIndex + 1}/${exercise.sets.length}`;

      let detailsLine = '';
      if (historicalSet) {
        const weight = this.weightUnitPipe.transform(historicalSet.weightUsed);
        detailsLine = `${this.translate.instant('restTimer.lastTime')}: ${weight} x ${historicalSet.repsAchieved} reps`;
      } else {
        // +++ MODIFIED: Pass all required indices to the formatting function +++
        detailsLine = this.formatSetTargetForDisplay(plannedSet, exercise, nextExIndex, nextSetIndex);
      }

      this.restTimerNextUpText.set(`${line1}<br><span class="text-base opacity-80">${line2}</span><br><span class="text-base font-normal">${detailsLine}</span>`);
    }

    this.restTimerNextSetDetails.set(nextStep.details);
  }

  /**
   * Collapses all sets in the given exercise that come before the specified setIndex.
   * This is useful to keep the UI tidy after the user manually expands a later set.
   * @param exIndex The index of the exercise.
   * @param setIndex The index of the currently active/expanded set.
   */
  /**
 * Collapses all sets in the last worked-on exercise that come before the most recently completed set.
 * This is typically called after a set is completed to keep the UI clean.
 */
  private autoCollapsePreviousSets(): void {
    const completedExIndex = this.lastExerciseIndex();
    const completedSetIndex = this.lastExerciseSetIndex();
    const routine = this.routine();

    if (completedExIndex < 0 || completedSetIndex < 0 || !routine) {
      return;
    }

    // No previous sets to collapse if it's the first one.
    if (completedSetIndex <= 0) {
      return;
    }

    this.expandedSets.update(currentSet => {
      const newSet = new Set(currentSet); // Work with a new copy

      // Iterate through all sets before the currently completed one
      for (let i = 0; i < completedSetIndex; i++) {
        // --- FIX IS HERE ---
        // The key must be constructed with the exercise index, then the set index.
        const keyToCollapse = `${completedExIndex}-${i}`;
        if (newSet.has(keyToCollapse)) {
          newSet.delete(keyToCollapse);
        }
      }

      return newSet; // Return the modified set to update the signal
    });
  }

  /**
   * --- CORRECTED ---
   * Advances the UI state after a set/round is finished or skipped.
   * It collapses the completed item, and expands and scrolls to the next one.
   * It now correctly handles advancing between rounds within a superset.
   */
  private handleAutoExpandNextExercise(): void {
    const completedExIndex = this.lastExerciseIndex();
    const completedSetIndex = this.lastExerciseSetIndex(); // This is the roundIndex for supersets
    const routine = this.routine();

    if (completedExIndex < 0 || completedSetIndex < 0 || !routine) return;

    const completedExercise = routine.exercises[completedExIndex];

    // --- EXECUTE THE STATE CHANGE ---

    // BRANCH 1: The completed item was part of a SUPERSET
    if (completedExercise.supersetId) {
      const isLastRound = completedSetIndex >= completedExercise.sets.length - 1;

      if (isLastRound) {
        // ACTION 1A: It was the last round. Advance to the next exercise card.
        const nextExIndex = this.findNextExerciseIndex(completedExIndex);
        if (nextExIndex !== -1) {
          this.toggleExerciseExpansion(nextExIndex);
        } else {
          // End of workout, collapse everything.
          this.expandedExerciseIndex.set(null);
        }
      } else {
        // ACTION 1B: Not the last round. Advance to the next round in the same superset.
        const nextRoundIndex = completedSetIndex + 1;

        // We need the index of the exercise that STARTS the superset group to manage the expanded state.
        const firstExerciseInSupersetIndex = routine.exercises.findIndex(ex => ex.supersetId === completedExercise.supersetId);

        this.expandedRounds.update(currentSet => {
          const newSet = new Set(currentSet);
          newSet.delete(`${firstExerciseInSupersetIndex}-${completedSetIndex}`); // Collapse the old one
          newSet.add(`${firstExerciseInSupersetIndex}-${nextRoundIndex}`);    // Expand the new one
          return newSet;
        });

        // Scroll the new round into view.
        this.scrollToRound(firstExerciseInSupersetIndex, nextRoundIndex);
      }
    }
    // BRANCH 2: The completed item was a STANDARD EXERCISE
    else {
      const isLastSet = completedSetIndex >= completedExercise.sets.length - 1;

      if (isLastSet) {
        // ACTION 2A: It was the last set. Advance to the next exercise card.
        const nextExIndex = this.findNextExerciseIndex(completedExIndex);
        if (nextExIndex !== -1) {
          this.toggleExerciseExpansion(nextExIndex);
        } else {
          this.expandedExerciseIndex.set(null);
        }
      } else {
        // ACTION 2B: The next set is in the SAME exercise.
        const nextSetIndex = completedSetIndex + 1;

        this.expandedSets.update(currentSet => {
          const newSet = new Set(currentSet);
          newSet.delete(`${completedExIndex}-${completedSetIndex}`); // Collapse the old one
          newSet.add(`${completedExIndex}-${nextSetIndex}`);       // Expand the new one
          return newSet;
        });

        this.scrollToSet(completedExIndex, nextSetIndex);
      }
    }
  }

  /**
   * Finds the index of the next exercise to be performed, skipping over
   * non-starting exercises in a superset group.
   * @param currentIndex The index of the exercise just completed.
   * @returns The index of the next exercise card to expand, or -1 if at the end.
   */
  private findNextExerciseIndex(currentIndex: number): number {
    const exercises = this.routine()?.exercises;
    if (!exercises) return -1;

    const currentExercise = exercises[currentIndex];

    if (currentExercise.supersetId) {
      // If we just finished a superset, find the next index that is NOT part of the same superset.
      for (let i = currentIndex + 1; i < exercises.length; i++) {
        if (exercises[i].supersetId !== currentExercise.supersetId) {
          return i; // This is the start of the next group or a standard exercise.
        }
      }
      return -1; // Reached the end of the workout.
    } else {
      // If we just finished a standard exercise, the next one is simply index + 1.
      const nextIndex = currentIndex + 1;
      return nextIndex < exercises.length ? nextIndex : -1;
    }
  }


  /**
   * Smoothly scrolls the viewport to a specific set card within an exercise.
   * @param exIndex The index of the parent exercise.
   * @param setIndex The index of the target set.
   */
  private scrollToSet(exIndex: number, setIndex: number): void {
    // This logic needs to run after the DOM has updated with the newly expanded set.
    runInInjectionContext(this.injector, () => {
      afterNextRender(() => {
        requestAnimationFrame(() => {
          const cardElement = document.querySelector(`[data-exercise-index="${exIndex}"]`) as HTMLElement;
          const setElement = cardElement?.querySelector(`[data-set-index="${setIndex}"]`) as HTMLElement;
          const headerElement = this.header?.nativeElement;

          if (setElement && headerElement) {
            const headerHeight = headerElement.offsetHeight;
            const elementTopPosition = setElement.getBoundingClientRect().top + window.scrollY;
            const scrollTopPosition = elementTopPosition - headerHeight - 15; // 15px top padding
            window.scrollTo({ top: scrollTopPosition, behavior: 'smooth' });
          }
        });
      });
    });
  }

  /**
   * Smoothly scrolls the viewport to a specific round card within a superset.
   * @param exIndex The index of the parent exercise that starts the superset.
   * @param roundIndex The index of the target round.
   */
  private scrollToRound(exIndex: number, roundIndex: number): void {
    runInInjectionContext(this.injector, () => {
      afterNextRender(() => {
        requestAnimationFrame(() => {
          const cardElement = document.querySelector(`[data-exercise-index="${exIndex}"]`) as HTMLElement;
          const roundElement = cardElement?.querySelector(`[data-round-index="${roundIndex}"]`) as HTMLElement;
          const headerElement = this.header?.nativeElement;

          if (roundElement && headerElement) {
            const headerHeight = headerElement.offsetHeight;
            const elementTopPosition = roundElement.getBoundingClientRect().top + window.scrollY;
            const scrollTopPosition = elementTopPosition - headerHeight - 15; // 15px top padding
            window.scrollTo({ top: scrollTopPosition, behavior: 'smooth' });
          }
        });
      });
    });
  }

  private updateLogWithRestTime(actualRestTime: number): void {
    if (!this.lastLoggedSetForRestUpdate) return;

    const log = this.currentWorkoutLog();
    const exerciseLog = log.exercises?.find(e => e.sets.some(s => s.id === this.lastLoggedSetForRestUpdate!.id));
    if (exerciseLog) {
      const setLog = exerciseLog.sets.find(s => s.id === this.lastLoggedSetForRestUpdate!.id);
      if (setLog) {
        setLog.restAfterSetUsed = actualRestTime;
        this.currentWorkoutLog.set({ ...log });
        this.savePausedSessionState();
      }
    }
    // Clear the reference after updating
    this.lastLoggedSetForRestUpdate = null;
  }

  handleRestTimerFinished(): void {
    this.playEndSound();

    this.isRestTimerVisible.set(false);
    // this.toastService.success("Rest complete!", 2000);
    this.updateLogWithRestTime(this.restDuration()); // Update log with full rest duration
    this.handleAutoExpandNextExercise();
    // this.autoCollapsePreviousSets();
  }

  handleRestTimerSkipped(timeSkipped: number): void {
    this.isRestTimerVisible.set(false);
    // this.toastService.info("Rest skipped", 1500);
    const actualRest = Math.ceil(this.restDuration() - timeSkipped);
    this.updateLogWithRestTime(actualRest); // Update log with actual rest taken
    this.handleAutoExpandNextExercise();
    // this.autoCollapsePreviousSets();
    this.playerSubState.set(PlayerSubState.PerformingSet);
    this.audioService.playSound(AUDIO_TYPES.end);
  }

  private async peekNextStepInfo(completedExIndex: number, completedSetIndex: number): Promise<{ text: string | null; details: ExerciseTargetSetParams | null; exercise: WorkoutExercise | null; historicalSet: LoggedSet | null }> {
    const routine = this.routine();
    if (!routine) return { text: null, details: null, exercise: null, historicalSet: null };

    const currentExercise = routine.exercises[completedExIndex];
    let nextExercise: WorkoutExercise | undefined;
    let nextSetIndex: number | undefined;

    // Logic to determine the next exercise and set index (remains the same)
    if (completedSetIndex + 1 < currentExercise.sets.length) {
      nextExercise = currentExercise;
      nextSetIndex = completedSetIndex + 1;
    } else if (completedExIndex + 1 < routine.exercises.length) {
      nextExercise = routine.exercises[completedExIndex + 1];
      nextSetIndex = 0;
    }

    if (nextExercise && nextSetIndex !== undefined) {
      const plannedNextSet = nextExercise.sets[nextSetIndex];
      try {
        const lastPerformance = await firstValueFrom(this.trackingService.getLastPerformanceForExercise(nextExercise.exerciseId));
        const historicalSet = this.trackingService.findPreviousSetPerformance(lastPerformance, plannedNextSet, nextSetIndex);

        // Return the ORIGINAL 'plannedNextSet' object in the 'details' property.
        // This ensures that `indexOf` will work correctly in the calling function.
        return { text: '', details: plannedNextSet, exercise: nextExercise, historicalSet: historicalSet };

      } catch (error) {
        console.error("Could not fetch last performance for next set:", error);
        // Also return the original object here on error.
        return { text: `${nextExercise.exerciseName} - Set ${nextSetIndex + 1}`, details: plannedNextSet, exercise: nextExercise, historicalSet: null };
      }
    }

    // Return for when the workout is complete
    return { text: "Workout Complete!", details: null, exercise: null, historicalSet: null };
  }

  // --- Pause, Resume, and State Management ---

  async pauseSession(): Promise<void> {
    if (this.sessionState() !== SessionState.Playing) return;
    this.sessionTimerElapsedSecondsBeforePause += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    this.timerSub?.unsubscribe();
    this.sessionState.set(SessionState.Paused);
    this.savePausedSessionState();
    this.toastService.info(this.translate.instant('compactPlayer.toasts.workoutPaused'), 3000);
  }

  async resumeSession(): Promise<void> {
    if (this.sessionState() !== SessionState.Paused) return;
    this.workoutStartTime = Date.now();
    this.sessionState.set(SessionState.Playing);
    this.startSessionTimer();
    this.toastService.info(this.translate.instant('compactPlayer.toasts.workoutResumed'), 3000);
  }

  private savePausedSessionState(): void {
    if (!this.routine() || !this.routine()?.exercises || this.routine()?.exercises.length === 0) return;
    if (this.sessionState() === SessionState.End || !this.routine()) return;

    let currentTotalSessionElapsed = this.sessionTimerElapsedSecondsBeforePause;
    if (this.sessionState() === SessionState.Playing) {
      currentTotalSessionElapsed += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    }

    let dateToSaveInState: string;
    const loggedExercise: LoggedWorkoutExercise[] = (this.currentWorkoutLog() && this.currentWorkoutLog() && this.currentWorkoutLog().exercises) || [];
    const firstLoggedSetTime = loggedExercise && loggedExercise.length > 0 ? loggedExercise[0]?.sets[0]?.timestamp : format(new Date(), 'yyyy-MM-dd');
    const baseTimeForDate = firstLoggedSetTime ? new Date(firstLoggedSetTime) : (this.workoutStartTime > 0 ? new Date(this.workoutStartTime - (this.sessionTimerElapsedSecondsBeforePause * 1000)) : new Date());
    dateToSaveInState = format(baseTimeForDate, 'yyyy-MM-dd');

    const stringifiedRoutine = JSON.parse(JSON.stringify(this.routine()));
    const stateToSave: PausedWorkoutState = {
      version: this.workoutService.getPausedVersion(),
      routineId: this.routineId,
      programId: this.programId,
      programName: this.program()?.name,
      scheduledDayId: this.scheduledDay(),
      sessionRoutine: stringifiedRoutine, // Includes sessionStatus
      originalWorkoutExercises: this.originalRoutineSnapshot() ? JSON.parse(JSON.stringify(this.originalRoutineSnapshot())) : stringifiedRoutine,
      currentExerciseIndex: this.expandedExerciseIndex() || 0,
      currentSetIndex: 0,
      currentWorkoutLogExercises: JSON.parse(JSON.stringify(this.currentWorkoutLog() ? this.currentWorkoutLog().exercises : [])),
      workoutStartTimeOriginal: this.workoutStartTime,
      sessionTimerElapsedSecondsBeforePause: currentTotalSessionElapsed,
      currentBlockRound: -1,
      totalBlockRounds: -1,
      isResting: this.isRestTimerVisible(), // Full screen timer state
      isRestTimerVisibleOnPause: this.playerSubState() === PlayerSubState.Resting, // General resting sub-state
      restTimerRemainingSecondsOnPause: this.restDuration(), // Should be remaining time from timer component
      restTimerInitialDurationOnPause: 0,
      restTimerMainTextOnPause: this.restTimerMainText(),
      restTimerNextUpTextOnPause: this.restTimerNextUpText(),
      workoutDate: dateToSaveInState,
    };

    this.workoutService.savePausedWorkout(stateToSave);
  }

  private async loadStateFromPausedSession(state: PausedWorkoutState): Promise<void> {
    this.routineId = state.routineId;
    this.programId = state.programId ? state.programId : null;
    this.scheduledDay.set(state.scheduledDayId ?? undefined);
    this.routine.set(state.sessionRoutine);

    this._prefillPerformanceInputs();
    this.sessionTimerElapsedSecondsBeforePause = state.sessionTimerElapsedSecondsBeforePause;
    const loggedExercises = state.currentWorkoutLogExercises;

    const absoluteStartTime = state.workoutStartTimeOriginal || Date.now();


    if (loggedExercises) {
      // Restore the log using the absolute start time.
      this.currentWorkoutLog.set({
        exercises: loggedExercises,
        notes: state.sessionRoutine.notes || '',
        startTime: absoluteStartTime, // Use the original start time for the log.
        routineId: this.routineId ?? undefined,
        programId: this.programId ?? undefined,
        scheduledDayId: this.scheduledDay() ?? undefined,
        routineName: state.sessionRoutine.name,
        date: state.workoutDate || format(new Date(absoluteStartTime), 'yyyy-MM-dd')
      });
    }

    // Now, reset the component's timer reference point to NOW for the new "playing" segment.
    this.workoutStartTime = Date.now();

    this.expandedExerciseIndex.set(state.currentExerciseIndex);

    // Set the initial timer display based on the accumulated pause time.
    const totalElapsedSeconds = this.sessionTimerElapsedSecondsBeforePause;
    const mins = String(Math.floor(totalElapsedSeconds / 60)).padStart(2, '0');
    const secs = String(totalElapsedSeconds % 60).padStart(2, '0');
    this.sessionTimerDisplay.set(`${mins}:${secs}`);

    // Start the session.
    this.sessionState.set(SessionState.Playing);
    this.startSessionTimer();
    // this.toastService.success('Paused session resumed', 3000);
  }

  private async checkForPausedSession(): Promise<boolean> {
    const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);
    const routeRoutineId = this.route.snapshot.paramMap.get('routineId');

    if (pausedState) {
      this.programId = pausedState.programId || null;
      if (this.programId) {
        this.program.set(await firstValueFrom(this.trainingProgramService.getProgramById(this.programId)));
      }
      if (pausedState.version === this.PAUSED_STATE_VERSION && pausedState.routineId === routeRoutineId) {
        await this.loadStateFromPausedSession(pausedState);
        return true;
      } else {
        const confirmation = await this.alertService.showConfirmationDialog(
          this.translate.instant('compactPlayer.alerts.pausedWorkoutTitle'),
          this.translate.instant('compactPlayer.alerts.pausedWorkoutMessage'),
          [{ text: this.translate.instant('compactPlayer.alerts.resume'), role: "confirm", data: true, icon: 'play', cssClass: 'bg-green-600 hover:bg-green-700' },
          { text: this.translate.instant('compactPlayer.alerts.discard'), role: "cancel", data: false, icon: 'trash', cssClass: "bg-red-600 hover:bg-red-800" }]
        );

        if (confirmation?.data) {
          await this.loadStateFromPausedSession(pausedState);
          return true;
        } else {
          this.workoutService.removePausedWorkout();
          this.toastService.info(this.translate.instant('compactPlayer.toasts.pausedDiscarded'), 3000);
          return false;
        }
      }
    }
    return false;
  }

  goBack(): void {
    // The exercises array might not exist on the partial log initially.
    // Check for its existence and then check its length to satisfy TypeScript's strict checks.
    if (this.currentWorkoutLog().exercises && this.currentWorkoutLog().exercises!.length > 0 && this.sessionState() === SessionState.Playing) {
      this.savePausedSessionState();
      this.router.navigate(['/workout']);
    } else {
      this.router.navigate(['/workout']);
    }
  }

  private reorderExercisesForSupersets(exercises: WorkoutExercise[]): WorkoutExercise[] {
    const reorderedExercises: WorkoutExercise[] = [];
    const processedExerciseIds = new Set<string>();

    for (const exercise of exercises) {
      if (processedExerciseIds.has(exercise.id)) {
        continue;
      }

      if (exercise.supersetId) {
        // Find all exercises in the same superset
        const supersetGroup = exercises
          .filter(ex => ex.supersetId === exercise.supersetId)
          .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0));

        // Add the whole group to the reordered list
        for (const supersetExercise of supersetGroup) {
          reorderedExercises.push(supersetExercise);
          processedExerciseIds.add(supersetExercise.id);
        }
      } else {
        // It's a standalone exercise
        reorderedExercises.push(exercise);
        processedExerciseIds.add(exercise.id);
      }
    }
    return reorderedExercises;
  }

  async addToSupersetModal(exIndex: number): Promise<void> {
    const routine = this.routine();
    if (!routine) return;

    const updatedRoutine = await this.workoutService.addToSuperset(
      routine,
      exIndex,
      this.alertService,
      this.toastService
    );

    if (updatedRoutine) {
      this.routine.set(updatedRoutine);
      this.savePausedSessionState();
    }
  }

  async openCreateSupersetModal(exIndex: number): Promise<void> {
    const routine = this.routine();
    if (!routine) return;
    const loggedExercisesToExclude = this.currentWorkoutLog().exercises || [];

    const result = await this.workoutService.createSuperset(
      routine,
      exIndex,
      loggedExercisesToExclude,
    );

    // If the function returned updated data, apply it to the component's state
    if (result) {
      this.routine.set(result.updatedRoutine);

      // Update the log signal
      this.currentWorkoutLog.update(log => {
        log.exercises = result.updatedLoggedExercises;
        return { ...log };
      });

      this.savePausedSessionState(); // Persist the changes
    }
  }

  retrieveSuperSetIdAndAddRound(exIndex: number): string {
    const exercises = this.routine()?.exercises;
    if (!exercises) return '';
    const ex = exercises[exIndex];
    if (ex.supersetId) return ex.supersetId;
    return '';
  }

  async completeRoundOrSet(exercise: WorkoutExercise, setIndex: number, event: Event) {
    event.stopPropagation();
    const routine = this.routine();
    if (!routine) return;

    const exIndex = routine.exercises.findIndex(e => e.id === exercise.id);

    // --- Superset Round Logic ---
    if (exercise.supersetId) {
      const roundIndex = setIndex;
      const exercisesInSuperset = this.getSupersetExercises(exercise.supersetId);
      const isAlreadyCompleted = this.isRoundCompleted(exIndex, roundIndex);

      const key = `${exIndex}-${roundIndex}`;
      this.toggledSetAnimation.set({ key, type: 'round', state: isAlreadyCompleted ? 'incompleted' : 'completed' });

      // Toggle completion for every exercise set within that round.
      exercisesInSuperset.forEach(exInGroup => {
        const groupExIndex = this.getOriginalExIndex(exInGroup.id);
        const setTemplate = exInGroup.sets[roundIndex];

        // This will either log the un-logged sets or un-log the logged sets.
        if (setTemplate) {
          this.toggleSetCompletion(exInGroup, setTemplate, groupExIndex, roundIndex, roundIndex);
        }
      });

      if (!isAlreadyCompleted) {
        // this.toastService.success(`Round ${roundIndex + 1} completed!`);
      } else {
        // this.toastService.info(`Log for Round ${roundIndex + 1} removed.`);
      }

    } else {
      // --- Standard Set Logic (remains the same) ---
      const set = exercise.sets[setIndex];
      // Note: For standard sets, we might also want a confirmation to un-log,
      // but for now, we'll keep the original toggle behavior as requested.

      this.toggleSetCompletion(exercise, set, exIndex, setIndex, 0);
    }
  }


  areAllPropertiesFalsy(obj: any) {
    return Object.values(obj).every(value => !value);
  }

  isSuperSet(index: number): boolean {
    const exercises = this.routine()?.exercises;
    if (!exercises) return false;
    const ex = exercises[index];
    if (!ex?.supersetId) return false;
    return true;
  }

  protected isEmom(index: number): boolean {
    const ex = this.routine()?.exercises[index];
    if (!ex || !ex.supersetId) return false;
    return ex.supersetType === 'emom';
  }

  isSupersetStart(index: number): boolean {
    const ex = this.routine()?.exercises[index];
    if (!ex?.supersetId) return false;
    return ex.supersetOrder === 0;
  }

  isSupersetMiddle(index: number): boolean {
    const ex = this.routine()?.exercises[index];
    if (!ex?.supersetId || ex.supersetOrder === 0 || ex.sets.length === null || ex.sets.length === undefined) return false;
    return ex.supersetOrder !== null && ex.supersetOrder < ex.sets.length - 1;
  }

  // Return the total number of exercises in the superset group
  getSupersetSize(index: number): number {
    return this.workoutService.getSupersetSize(this.routine(), index);
  }

  isSupersetEnd(index: number): boolean {
    const ex = this.routine()?.exercises[index];
    if (!ex?.supersetId || ex.sets.length === null || ex.sets.length === undefined) return false;
    return ex.supersetOrder === this.getSupersetSize(index) - 1;
  }

  isEndOfLastSupersetExercise(exIndex: number, setIndex: number): boolean {
    const ex = this.routine()?.exercises[exIndex];
    if (!ex) return false;
    return this.isSupersetEnd(exIndex);
  }

  getExerciseDisplayIndex(exIndex: number): string {
    const exercises = this.routine()?.exercises;
    if (!exercises) {
      return `${exIndex + 1}`; // Fallback if routine is not loaded
    }

    const currentEx = exercises[exIndex];

    // Determine the effective index to calculate the prefix number.
    // For a superset, this is the index of the first exercise in its group.
    // For a standard exercise, it's its own index.
    let effectiveIndex = exIndex;
    if (currentEx.supersetId) {
      // Find the index of the first exercise in the current superset group
      const firstInSuperset = exercises.findIndex(ex => ex.supersetId === currentEx.supersetId);
      if (firstInSuperset !== -1) {
        effectiveIndex = firstInSuperset;
      }
    }

    let displayIndex = 1;
    const countedSupersetIds = new Set<string>();

    // Calculate the numeric prefix by iterating up to the effective index
    for (let i = 0; i < effectiveIndex; i++) {
      const prevEx = exercises[i];
      if (prevEx.supersetId) {
        // If we haven't counted this superset group yet, increment the index and record it
        if (!countedSupersetIds.has(prevEx.supersetId)) {
          displayIndex++;
          countedSupersetIds.add(prevEx.supersetId);
        }
      } else {
        // It's a standard exercise, so it always gets its own number
        displayIndex++;
      }
    }

    // Append the letter if it's part of a superset
    if (currentEx.supersetId) {
      const letter = String.fromCharCode(65 + (currentEx.supersetOrder || 0)); // A, B, C...
      return `${displayIndex}${letter}`;
    } else {
      return `${displayIndex}`;
    }
  }

  /**
   * Helper method to find the index of the first set in an exercise that has not been logged yet.
   * @param exIndex The index of the exercise.
   * @returns The index of the first incomplete set, or -1 if all are complete.
   */
  protected findFirstIncompleteSetIndex(exIndex: number): number {
    const exercise = this.routine()?.exercises[exIndex];
    if (!exercise) {
      return -1; // Should not happen in normal flow
    }
    // Find the index of the first set where isSetCompleted returns false
    return exercise.sets.findIndex((set, setIdx) => !this.isSetCompleted(exIndex, setIdx));
  }

  /**
   * Determines the dynamic CSS classes for a set card based on its state.
   * Gives a special "focused" style to the first incomplete set when it's expanded.
   * @param exIndex The index of the exercise.
   * @param setIndex The index of the set.
   * @param set The set data object.
   * @returns An object compatible with [ngClass].
   */
  public getSetClasses(exIndex: number, setIndex: number, set: ExerciseTargetSetParams): any {
    const isCompleted = this.isSetCompleted(exIndex, setIndex);
    const isExpanded = this.isSetExpanded(exIndex, setIndex);
    const firstIncompleteIndex = this.findFirstIncompleteSetIndex(exIndex);

    // A set is "focused" if it's the first incomplete one AND the user has expanded it.
    const isFocused = isExpanded && setIndex === firstIncompleteIndex;

    // Define classes based on priority: focused > completed > warmup > default
    if (isFocused) {
      return {
        'rounded-lg shadow-md transition-all duration-300': true,
        'relative ring-2 ring-yellow-400 dark:ring-yellow-500 z-10': true, // Focus style
        'bg-white dark:bg-gray-800': true // Default background when focused
      };
    }

    if (isCompleted) {
      return {
        'rounded-lg shadow-sm transition-all duration-300': true,
        'bg-green-300 dark:bg-green-700 border border-green-300 dark:border-green-800': true, // Subtle completed style
      };
    }

    if (set.type === 'warmup') {
      return {
        'rounded-lg shadow-sm transition-all duration-300': true,
        'bg-blue-200/60 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-800': true, // Subtle warmup style
      };
    }

    // Default style for a standard, non-focused, non-completed set
    return {
      'rounded-lg shadow-sm transition-all duration-300': true,
      'bg-white dark:bg-gray-800': true
    };
  }

  getExerciseClasses(exercise: WorkoutExercise, index: number): any {
    const isStandardSuperSet = this.isSuperSet(index) && !this.isEmom(index);
    const isEmomSet = this.isEmom(index);
    const order = exercise.supersetOrder ?? 0;
    const isExpanded = this.expandedExerciseIndex() === index;

    // --- Base classes that apply to almost all states ---
    const classes: any = {
      // Side borders always apply to superset items

      'border-l-2 border-r-2 rounded-md': isStandardSuperSet || isEmomSet,
      'border-primary': isStandardSuperSet,
      'border-teal-400': isEmomSet,
      // Standalone exercises always get these classes
      'mb-4 rounded-md': !isStandardSuperSet && !isEmomSet,
    };

    // --- State-Specific Logic ---
    if (isExpanded) {
      // classes['border-yellow-400 ring-1 ring-yellow-400 dark:ring-yellow-500 z-10'] = true;
    }
    if ((isStandardSuperSet || isEmomSet) && isExpanded) {
      // STATE 1: THE EXERCISE IS EXPANDED
      // It becomes a self-contained, highlighted block.
      classes['rounded-md'] = true;       // Round all corners
      classes['border-t-2'] = true;       // Ensure it has a top border
      classes['border-b-2'] = true;       // Ensure it has a bottom border
      classes['mb-4'] = true;             // Add margin to visually detach it from the item below

    } else {
      // STATE 2: THE EXERCISE IS COLLAPSED (OR STANDALONE)
      // Apply the normal start, middle, and end classes for visual grouping.
      classes['border-t-2 rounded-t-md'] = this.isSupersetStart(index);
      classes['border-b-0 rounded-none'] = this.isSupersetMiddle(index); // This correctly removes bottom border for middle items
      classes['rounded-b-md mb-4'] = true;
    }

    // --- Background Color Logic (applied last, doesn't affect layout) ---
    if (isStandardSuperSet && order % 2 !== 0) {
      classes['bg-gray-200/80 dark:bg-gray-800'] = true; // Striped background
    } else {
      classes['bg-white dark:bg-gray-700'] = true; // Default background
    }

    return classes;
  }

  private getRoundInfo(ex: WorkoutExercise): { round: number, totalRounds: number } {
    // CORRECTED: Total rounds for a superset is its number of sets. For standard, it's 1.
    const totalRounds = ex.supersetId ? ex.sets.length : 1;

    // The current round is based on how many sets have been logged.
    const loggedSetsCount = this.currentWorkoutLog().exercises?.find(logEx => logEx.id === ex.id)?.sets.length ?? 0;
    const currentRound = loggedSetsCount + 1;

    return { round: currentRound, totalRounds };
  }



  private comparePerformedToOriginal(performed: LoggedWorkoutExercise[], original: WorkoutExercise[]): { majorDifference: boolean; details: string[] } {
    const details: string[] = [];
    let majorDifference = false;
    const originalIdSet = new Set(original.map(ex => ex.id));
    const performedInOriginal: LoggedWorkoutExercise[] = [];
    const addedCustomExercises: LoggedWorkoutExercise[] = [];

    for (const pEx of performed) {
      if (originalIdSet.has(pEx.id)) {
        performedInOriginal.push(pEx);
      } else {
        addedCustomExercises.push(pEx);
      }
    }

    if (addedCustomExercises.length > 0) {
      majorDifference = true;
      addedCustomExercises.forEach(ex => details.push(`Exercise added: ${ex.exerciseName}`));
    }

    for (const originalEx of original) {
      const performedEx = performed.find(p => p.id === originalEx.id);
      if (!performedEx) {
        majorDifference = true;
        details.push(`Exercise skipped: "${originalEx.exerciseName || originalEx.exerciseId}"`);
        continue;
      }

      // CORRECTED: Simplified set count comparison.
      if (performedEx.sets.length !== originalEx.sets.length) {
        majorDifference = true;
        details.push(`Set count for "${performedEx.exerciseName}" changed (Planned: ${originalEx.sets.length}, Performed: ${performedEx.sets.length})`);
      }
    }
    return { majorDifference, details };
  }

  private convertLoggedToWorkoutExercises(loggedExercises: LoggedWorkoutExercise[]): WorkoutExercise[] {
    const currentSessionRoutine = this.routine();
    return loggedExercises.map(loggedEx => {
      const sessionExercise = currentSessionRoutine?.exercises.find(re => re.exerciseId === loggedEx.exerciseId);
      return {
        id: uuidv4(),
        exerciseId: loggedEx.exerciseId,
        exerciseName: loggedEx.exerciseName,
        supersetId: sessionExercise?.supersetId || null,
        supersetOrder: sessionExercise?.supersetOrder ?? null,
        notes: sessionExercise?.notes,
        sets: loggedEx.sets.map(loggedSet => {
          const originalPlannedSet = sessionExercise?.sets.find(s => s.id === loggedSet.plannedSetId);
          return {
            id: uuidv4(),
            targetReps: loggedSet.repsAchieved, // Corrected mapping
            targetWeight: loggedSet.weightUsed, // Corrected mapping
            targetDuration: loggedSet.durationPerformed, // Corrected mapping
            tempo: originalPlannedSet?.targetTempo || '1',
            restAfterSet: originalPlannedSet?.restAfterSet || 60,
            notes: loggedSet.notes,
            type: loggedSet.type as any,
          };
        }),
        type: (sessionExercise?.type ?? 'standard') as any,
      };
    });
  }


  /**
     * --- OPTIMIZED ---
     * Generates a display string for a set's planned target.
     * It now reads from the pre-calculated `suggestedRoutine` signal, making it
     * extremely fast and safe to call from the template.
     */
  public getSetTargetDisplay(exIndex: number, setIndex: number, field: METRIC): string {
    // 1. Get the pre-calculated routine with all suggestions already applied.
    const routineWithSuggestions = this.suggestedRoutine();
    const setForDisplay = routineWithSuggestions?.exercises[exIndex]?.sets[setIndex];

    if (!setForDisplay) {
      return ''; // Failsafe
    }

    // 2. Simply format the value from the pre-calculated set object. No heavy logic here.
    return this.workoutService.getSetTargetDisplay(setForDisplay, field);
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

  getSupersetExercises(supersetId: string): WorkoutExercise[] {
    const r = this.routine();
    if (!r) return [];
    // Important: Ensure they are sorted by their defined order
    return r.exercises
      .filter(ex => ex.supersetId === supersetId)
      .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0));
  }

  getOriginalExIndex(exerciseId: string): number {
    return this.routine()?.exercises.findIndex(ex => ex.id === exerciseId) ?? -1;
  }

  isRoundCompleted(exIndex: number, roundIndex: number): boolean {
    const firstExercise = this.routine()?.exercises[exIndex];
    if (!firstExercise?.supersetId) return false;

    const exercisesInGroup = this.getSupersetExercises(firstExercise.supersetId);
    return exercisesInGroup.every(ex => {
      const originalExIndex = this.getOriginalExIndex(ex.id);
      return this.isSetCompleted(originalExIndex, roundIndex, roundIndex);
    });
  }

  getEmomState(exIndex: number, roundIndex: number): { status: 'idle' | 'running' | 'paused' | 'completed', remainingTime: number } {
    // 1. FIRST, check the source of truth: the workout log.
    // If the log shows this round is completed, ALWAYS return a 'completed' state.
    // This is a PURE READ operation.
    if (this.isRoundCompleted(exIndex, roundIndex)) {
      return { status: 'completed', remainingTime: 0 };
    }

    // 2. If the round is not completed, THEN read the current timer state from the signal.
    // This handles the 'idle', 'running', and 'paused' states for active timers.
    const key = `${exIndex}-${roundIndex}`;
    const allStates = this.emomState();
    return allStates[key] || { status: 'idle', remainingTime: this.routine()?.exercises[exIndex].emomTimeSeconds ?? 60 };
  }

  handleEmomAction(exIndex: number, roundIndex: number): void {
    const key = `${exIndex}-${roundIndex}`;
    const state = this.getEmomState(exIndex, roundIndex);

    switch (state.status) {
      case 'idle':
      case 'paused':
        this.startEmomTimer(exIndex, roundIndex, key);
        break;
      case 'running':
        this.pauseEmomTimer(key);
        break;
      case 'completed':
        // Do nothing if already completed
        break;
    }
  }

  private playCountdownSound(currentRemaining: number): void {
    if (
      this.appSettingsService.enableTimerCountdownSound() &&
      currentRemaining <= this.appSettingsService.countdownSoundSeconds() &&
      currentRemaining !== this.lastBeepSecond
    ) {
      this.audioService.playSound(AUDIO_TYPES.countdown);
      this.lastBeepSecond = currentRemaining;
    }
  }

  private playEndSound(): void {
    if (
      this.appSettingsService.enableTimerCountdownSound()
    ) {
      this.audioService.playSound(AUDIO_TYPES.end);
      this.lastBeepSecond = null;
    }
  }

  private startEmomTimer(exIndex: number, roundIndex: number, key: string): void {
    this.lastBeepSecond = null;
    const firstExercise = this.routine()!.exercises[exIndex];
    const duration = firstExercise.emomTimeSeconds ?? 60;

    this.emomState.update(states => {
      if (!states[key]) {
        states[key] = { status: 'running', remainingTime: duration };
      } else {
        states[key].status = 'running';
      }
      return { ...states };
    });

    this.emomTimerSub?.unsubscribe();
    this.emomTimerSub = timer(0, 1000).subscribe(() => {
      const currentRemaining = this.emomState()[key]?.remainingTime;
      if (currentRemaining > 0) {
        this.playCountdownSound(currentRemaining);

        this.emomState.update(states => {
          states[key].remainingTime--;
          return { ...states };
        });
      } else {
        this.emomTimerSub?.unsubscribe();
        this.logEmomRoundAsCompleted(exIndex, roundIndex, key);

        // --- AUTO-SCROLL LOGIC ---
        const nextRoundIndex = roundIndex + 1;
        const hasNextRound = nextRoundIndex < firstExercise.sets.length;

        this.playEndSound();
        if (hasNextRound) {
          // 1. Expand the next round and collapse the one we just finished
          this.expandedRounds.update(currentSet => {
            const newSet = new Set(currentSet);
            newSet.delete(`${exIndex}-${roundIndex}`);
            newSet.add(`${exIndex}-${nextRoundIndex}`);
            return newSet;
          });

          // 2. Start the next timer
          this.handleEmomAction(exIndex, nextRoundIndex);

          // 3. Scroll the next round into view after the DOM updates
          afterNextRender(() => {
            requestAnimationFrame(() => {
              const cardElement = document.querySelector(`[data-exercise-index="${exIndex}"]`) as HTMLElement;
              const nextRoundElement = cardElement?.querySelector(`[data-round-index="${nextRoundIndex}"]`) as HTMLElement;
              const headerElement = this.header?.nativeElement;

              if (nextRoundElement && headerElement) {
                const headerHeight = headerElement.offsetHeight;
                const elementTopPosition = nextRoundElement.getBoundingClientRect().top + window.scrollY;
                const scrollTopPosition = elementTopPosition - headerHeight - 15;
                window.scrollTo({ top: scrollTopPosition, behavior: 'smooth' });
              }
            });
          });
        }
      }
    });
  }

  private pauseEmomTimer(key: string): void {
    this.emomTimerSub?.unsubscribe();
    this.emomState.update(states => {
      if (states[key]) {
        states[key].status = 'paused';
      }
      return { ...states };
    });
  }

  private logEmomRoundAsCompleted(exIndex: number, roundIndex: number, key: string): void {
    const firstExercise = this.routine()!.exercises[exIndex];
    const exercisesInGroup = this.getSupersetExercises(firstExercise.supersetId!);

    exercisesInGroup.forEach(ex => {
      const originalIndex = this.getOriginalExIndex(ex.id);
      const setForRound = ex.sets[roundIndex];
      if (setForRound && !this.isSetCompleted(originalIndex, roundIndex, roundIndex)) {
        // Log with target values
        this.toggleSetCompletion(ex, setForRound, originalIndex, roundIndex, roundIndex);
      }
    });

    this.emomState.update(states => {
      states[key] = { ...states[key], status: 'completed', remainingTime: 0 };
      return { ...states };
    });

    this.toastService.success(`EMOM Round ${roundIndex + 1} Complete!`);
  }

  getEmomButtonText(exIndex: number, roundIndex: number): string {
    const state = this.getEmomState(exIndex, roundIndex);
    const textMap = { idle: 'START ROUND', running: 'PAUSE', paused: 'RESUME', completed: 'COMPLETED' };
    return textMap[state.status];
  }

  getEmomButtonIcon(exIndex: number, roundIndex: number): string {
    const state = this.getEmomState(exIndex, roundIndex);
    const iconMap = { idle: 'play', running: 'pause', paused: 'play', completed: 'done' };
    return iconMap[state.status];
  }

  getEmomButtonClass(exIndex: number, roundIndex: number): string {
    const state = this.getEmomState(exIndex, roundIndex);
    const classMap = {
      idle: 'bg-teal-500 hover:bg-teal-600',
      running: 'bg-yellow-500 hover:bg-yellow-600',
      paused: 'bg-teal-500 hover:bg-teal-600 animate-pulse',
      completed: 'bg-green-600'
    };
    return classMap[state.status];
  }

  getSupersetDisplayName(supersetId: string): string {
    if (!supersetId) return '';
    const exercisesInGroup = this.getSupersetExercises(supersetId);
    return exercisesInGroup.map(ex => ex.exerciseName).join(' / ');
  }

  /**
     * --- OPTIMIZED ---
     * Formats the display string for the "Next Up" section of the rest timer.
     * It also reads from the efficient `suggestedRoutine` signal.
     */
  private formatSetTargetForDisplay(set: ExerciseTargetSetParams, exercise: WorkoutExercise, exIndex: number, setIndex: number): string {
    // Get the pre-calculated set from the suggestedRoutine signal
    const setForDisplay = this.suggestedRoutine()?.exercises[exIndex]?.sets[setIndex] || set;

    if (this.isCardio(exercise)) {
      const distance = setForDisplay.targetDistance ?? 0;
      const duration = setForDisplay.targetDuration ?? 0;
      let parts: string[] = [];
      if (distance > 0) parts.push(`${distance} ${this.unitService.getDistanceMeasureUnitSuffix()}`);
      if (duration > 0) parts.push(this.formatSecondsToTime(duration));
      return parts.length > 0 ? `Target: ${parts.join(' for ')}` : 'No target set';
    } else {
      // Use the pre-calculated set to get the display values for reps and weight
      const repsDisplay = this.workoutService.getSetTargetDisplay(setForDisplay, METRIC.reps);
      const weightDisplay = this.workoutService.getWeightDisplay(setForDisplay, exercise);

      return repsDisplay ? `Target: ${weightDisplay} x ${repsDisplay} reps` : 'No target set';
    }
  }

  /** Checks if a specific round is currently expanded. */
  isRoundExpanded(exIndex: number, roundIndex: number): boolean {
    const key = `${exIndex}-${roundIndex}`;
    return this.expandedRounds().has(key);
  }

  // +++ ADD THIS METHOD +++
  /** Toggles the expanded/collapsed state of a specific round. */
  toggleRoundExpansion(exIndex: number, roundIndex: number, event: Event): void {
    event.stopPropagation(); // Prevent the main card from toggling
    const key = `${exIndex}-${roundIndex}`;

    this.expandedRounds.update(currentSet => {
      const newSet = new Set(currentSet); // Create a new instance to ensure signal change detection
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }

  performanceInputValues = signal<{ [key: string]: Partial<ExerciseCurrentExecutionSetParams> }>({});

  /**
   * Determines the initial value for an input field.
   * 1. If the set is already logged, it shows the logged value.
   * 2. If the user has typed something for this set, it shows their input.
   * 3. If a range is defined (e.g., 8-12 reps), it shows the middle value.
   * 4. Otherwise, it shows the planned single target value as the default.
   */
  getInitialInputValue(exIndex: number, setIndex: number, field: METRIC): string {
    const routine = this.routine();
    if (!routine) return '';

    const key = `${exIndex}-${setIndex}`;
    const userInputs = this.performanceInputValues()[key];
    const plannedSet = routine.exercises[exIndex].sets[setIndex];
    const loggedSet = this.getLoggedSet(exIndex, setIndex);

    // PRIORITY 1: Show already logged data if it exists.
    if (loggedSet) {
      switch (field) {
        case METRIC.reps: return (loggedSet.repsAchieved ?? '').toString();
        case METRIC.weight: return (loggedSet.weightUsed ?? '').toString();
        case METRIC.distance: return (loggedSet.distanceAchieved ?? '').toString();
        case METRIC.duration: return this.formatSecondsToTime(loggedSet.durationPerformed);
        case METRIC.tempo: return (loggedSet.tempoUsed ?? '-').toString();
        case METRIC.rest: return this.formatSecondsToTime(loggedSet.restAfterSetUsed);
        case METRIC.notes: return loggedSet.notes ?? '';
      }
    }

    // PRIORITY 2: Show what the user has typed for this specific field if it exists.
    if (userInputs) {
      switch (field) {
        case METRIC.reps: if (userInputs.repsAchieved !== undefined) return userInputs.repsAchieved.toString(); break;
        case METRIC.weight: if (userInputs.weightUsed !== undefined) return userInputs.weightUsed.toString(); break;
        case METRIC.distance: if (userInputs.actualDistance !== undefined) return userInputs.actualDistance.toString(); break;
        case METRIC.duration: if (userInputs.actualDuration !== undefined) return this.formatSecondsToTime(userInputs.actualDuration); break;
        case METRIC.rest: if (userInputs.restAfterSet !== undefined) return this.formatSecondsToTime(userInputs.restAfterSet); break;
        case METRIC.tempo: if (userInputs.tempoUsed !== undefined) return userInputs.tempoUsed; break;
        case METRIC.notes: if (userInputs.notes !== undefined) return userInputs.notes; break;
      }
    }

    // =================== START OF SNIPPET ===================
    // PRIORITY 3 & 4: Fall back to the original planned target value, now with range handling.
    switch (field) {
      case METRIC.reps:
        // Check if a range is defined for reps
        if (plannedSet.targetRepsMin != null && plannedSet.targetRepsMax != null) {
          const midValue = Math.floor((plannedSet.targetRepsMin + plannedSet.targetRepsMax) / 2);
          return midValue.toString();
        }
        // Fallback to the single target value
        return (plannedSet.targetReps ?? '').toString();

      case METRIC.weight:
        // Check if a range is defined for weight
        if (plannedSet.targetWeightMin != null && plannedSet.targetWeightMax != null) {
          const midValue = Math.floor((plannedSet.targetWeightMin + plannedSet.targetWeightMax) / 2);
          return midValue.toString();
        }
        // Fallback to the single target value
        return (plannedSet.targetWeight ?? '').toString();

      case METRIC.distance:
        // Check if a range is defined for distance
        if (plannedSet.targetDistanceMin != null && plannedSet.targetDistanceMax != null) {
          const midValue = Math.floor((plannedSet.targetDistanceMin + plannedSet.targetDistanceMax) / 2);
          return midValue.toString();
        }
        // Fallback to the single target value
        return (plannedSet.targetDistance ?? '').toString();

      case METRIC.duration:
        // Check if a range is defined for duration
        if (plannedSet.targetDurationMin != null && plannedSet.targetDurationMax != null) {
          const midValue = Math.floor((plannedSet.targetDurationMin + plannedSet.targetDurationMax) / 2);
          return this.formatSecondsToTime(midValue);
        }
        // Fallback to the single target value
        return this.formatSecondsToTime(plannedSet.targetDuration ?? 0);

      case METRIC.rest:
        return this.formatSecondsToTime(plannedSet.restAfterSet ?? 0);

      case METRIC.notes:
        // Notes field does not have a range
        return plannedSet.notes ?? '';

      case METRIC.tempo:
        // Tempo does not have a range
        return plannedSet.targetTempo ?? '';

      default:
        // Add a default case for safety
        return '';
    }
    // =================== END OF SNIPPET ===================
  }

  /**
   * --- THIS IS THE FIX ---
   * This method now ONLY updates the temporary `performanceInputValues` signal.
   * It DOES NOT touch the routine or the workout log. It is purely for capturing UI input.
   *
   * --- ENHANCEMENT ---
   * If the 'duration' field is changed for a set with an active timer, it now
   * automatically stops the old timer and starts a new one with the new value.
   */
  updateSetData(exIndex: number, setIndex: number, roundIndex: number, field: METRIC, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const key = `${exIndex}-${setIndex}`;

    // 1. Update the temporary input state object as before.
    this.performanceInputValues.update(currentInputs => {
      const newInputs = { ...currentInputs };
      if (!newInputs[key]) {
        newInputs[key] = {};
      }

      switch (field) {
        case METRIC.reps: newInputs[key].repsAchieved = parseFloat(value) || undefined; break;
        case METRIC.weight: newInputs[key].weightUsed = value === '' ? undefined : parseFloat(value); break;
        case METRIC.distance: newInputs[key].actualDistance = parseFloat(value) || undefined; break;
        case METRIC.duration: newInputs[key].actualDuration = this.parseTimeToSeconds(value); break;
        case METRIC.rest: newInputs[key].restAfterSet = this.parseTimeToSeconds(value); break;
        case METRIC.notes: newInputs[key].notes = value; break;
        case METRIC.tempo: newInputs[key].tempoUsed = value === '' ? undefined : value; break;
      }
      return newInputs;
    });

    // 2. Check if we need to reset an active timer because the duration was changed.
    if (field === METRIC.duration) {
      const state = this.setTimerState()[key]; // Check the current timer state directly

      // Only act if a timer was already running or paused for this specific set.
      if (state && (state.status === 'running' || state.status === 'paused')) {
        // Stop the currently active global timer subscription.
        this.setTimerSub?.unsubscribe();

        // Immediately start a new timer for this set. The `startSetTimer` function
        // is smart enough to read the new value we just set in `performanceInputValues`.
        this.startSetTimer(exIndex, setIndex, key);

        // Give user feedback that the timer was reset
        this.toastService.info("Timer reset with new duration.", 1500);
      }
    }
  }

  /**
  * --- THIS IS THE OTHER HALF OF THE FIX ---
  * On completion, this method now builds the log entry by combining three sources:
  * 1. The user's input (`performanceInputValues`).
  * 2. The routine's plan (as a fallback for performed values).
  * 3. The original snapshot (for target values).
  */
  toggleSetCompletion(exercise: WorkoutExercise, set: ExerciseTargetSetParams, exIndex: number, setIndex: number, roundIndex: number): void {
    const log = this.currentWorkoutLog();
    if (!log.exercises) log.exercises = [];

    let exerciseLog = log.exercises.find(e => e.id === exercise.id);
    const wasCompleted = !!this.getLoggedSet(exIndex, setIndex, roundIndex);
    const targetLoggedSetId = exercise.supersetId ? `${set.id}-round-${roundIndex}` : set.id;
    const key = `${exIndex}-${setIndex}`;

    this.toggledSetAnimation.set({ key, type: 'set', state: wasCompleted ? 'incompleted' : 'completed' });

    if (wasCompleted) {
      this.audioService.playSound(AUDIO_TYPES.untoggle);
      // Un-logging logic is now updated to restore values to the input state
      if (exerciseLog) {
        const setIndexInLog = exerciseLog.sets.findIndex(s => s.plannedSetId === targetLoggedSetId);
        if (setIndexInLog > -1) {
          const unloggedSet = exerciseLog.sets[setIndexInLog];
          // Restore the unlogged values back into the temporary input state
          this.performanceInputValues.update(inputs => {
            inputs[key] = {
              repsAchieved: unloggedSet.repsAchieved,
              weightUsed: unloggedSet.weightUsed,
              actualDuration: unloggedSet.durationPerformed,
              actualDistance: unloggedSet.distanceAchieved,
              notes: unloggedSet.notes
            };
            return { ...inputs };
          });
          exerciseLog.sets.splice(setIndexInLog, 1);
        }
      }
    } else {
      this.audioService.playSound(AUDIO_TYPES.correct);
      // Logging logic
      if (!exerciseLog) {
        exerciseLog = { id: exercise.id, exerciseId: exercise.exerciseId, exerciseName: exercise.exerciseName!, sets: [], type: exercise.type || 'standard', supersetId: exercise.supersetId, supersetOrder: exercise.supersetOrder, supersetType: exercise.supersetType };
        log.exercises.push(exerciseLog);
      }

      const userInputs = this.performanceInputValues()[key] || {};
      const originalSet = this.originalRoutineSnapshot()?.exercises[exIndex]?.sets[setIndex];
      const targetSetValues: ExerciseTargetExecutionSetParams = mapExerciseTargetSetParamsToExerciseExecutedSetParams(set);

      const timerState = this.setTimerState()[key];
      // retrieve actual duration from timer if available considering target
      // Calculate actual duration performed if timerState and targetSetValues are available
      let actualDurationPerformed: number | null = null;
      const userDefinedDuration = userInputs.actualDuration;

      // PRIORITY 1: If a timer was ACTIVELY running or paused when the set was completed.
      // This captures the elapsed time accurately.
      if (timerState && timerState.remainingTime) {
        if (userDefinedDuration !== undefined && userDefinedDuration !== null) {
          actualDurationPerformed = userDefinedDuration - timerState.remainingTime;
        } else {
          actualDurationPerformed = (targetSetValues.targetDuration ?? 0) - timerState.remainingTime;
        }
      } else {
        // PRIORITY 2: If no timer was active, check for a manual user input.
        if (userDefinedDuration !== undefined && userDefinedDuration !== null) {
          actualDurationPerformed = userDefinedDuration;
        }
      }

      const userDefinedRest = userInputs.restAfterSet;

      if (userDefinedRest) {
        set.restAfterSet = userDefinedRest;
      }


      if (!actualDurationPerformed || actualDurationPerformed <= 0) {
        actualDurationPerformed = userDefinedDuration ?? targetSetValues.targetDuration ?? 0;
      }

      // check if it was a timed set with an active timer, and stop it
      if (timerState && (timerState.status === 'running' || timerState.status === 'paused')) {
        this.setTimerSub?.unsubscribe();
        this.setTimerState.update(states => {
          delete states[key];
          return { ...states };
        });
      }

      // Create the log entry by prioritizing user input, then falling back to the planned target
      const newLoggedSet: LoggedSet = {
        id: uuidv4(),
        exerciseName: exercise.exerciseName,
        plannedSetId: targetLoggedSetId,
        exerciseId: exercise.exerciseId,
        type: set.type,
        // --- THIS IS THE FIX ---
        // Performed values: Prioritize user input. If none, fall back to the planned target for the set.
        repsAchieved: userInputs.repsAchieved ?? set.targetReps ?? 0,
        weightUsed: userInputs.weightUsed ?? set.targetWeight ?? 0,
        durationPerformed: actualDurationPerformed,
        distanceAchieved: userInputs.actualDistance ?? set.targetDistance ?? 0,
        notes: userInputs.notes ?? set.notes,
        tempoUsed: userInputs.tempoUsed ?? set.targetTempo,
        timestamp: new Date().toISOString(),
        // Target values: Always come from the original, static snapshot
        targetRestAfterSet: originalSet?.restAfterSet || targetSetValues?.targetRestAfterSet || 0,
        targetReps: originalSet?.targetReps || targetSetValues?.targetReps || 0,
        targetWeight: originalSet?.targetWeight || targetSetValues?.targetWeight || 0,
        targetDuration: originalSet?.targetDuration || targetSetValues?.targetDuration || 0,
        targetDistance: originalSet?.targetDistance || targetSetValues?.targetDistance || 0,
        workoutLogId: uuidv4(), // to differ from Simple set,
      };
      exerciseLog.sets.push(newLoggedSet);

      // Clean up the temporary input state for this set after logging
      this.performanceInputValues.update(inputs => {
        delete inputs[key];
        return { ...inputs };
      });
    }

    // --- (The rest of the method for state updates, saving, and timers remains the same) ---
    this.currentWorkoutLog.set({ ...log });
    this.savePausedSessionState();
    this.lastExerciseIndex.set(exIndex);
    this.lastExerciseSetIndex.set(setIndex);
    this.workoutService.vibrate();

    if (!wasCompleted) {
      const shouldStartRest = set.restAfterSet && set.restAfterSet > 0 &&
        (!this.isSuperSet(exIndex) || (this.isSuperSet(exIndex) && this.isEndOfLastSupersetExercise(exIndex, setIndex)));

      if (shouldStartRest) {
        this.lastLoggedSetForRestUpdate = this.getLoggedSet(exIndex, setIndex, roundIndex) ?? null;
        this.startRestPeriod(set.restAfterSet, exIndex, setIndex);
      } else {
        setTimeout(() => { this.handleAutoExpandNextExercise(); }, 700);
        // this.autoCollapsePreviousSets();
      }
    }
  }

  fillPerformanceInputIfUndefined(exIndex: number, setIndex: number): void {
    const key = `${exIndex}-${setIndex}`;
    const userInputs = this.performanceInputValues()[key];
    if (userInputs) { return };

    const weight = this.getInitialInputValue(exIndex, setIndex, METRIC.weight) ? Number(this.getInitialInputValue(exIndex, setIndex, METRIC.weight)) : undefined;
    const reps = this.getInitialInputValue(exIndex, setIndex, METRIC.reps) ? Number(this.getInitialInputValue(exIndex, setIndex, METRIC.reps)) : undefined;
    const distance = this.getInitialInputValue(exIndex, setIndex, METRIC.distance) ? Number(this.getInitialInputValue(exIndex, setIndex, METRIC.distance)) : undefined;
    const duration = this.getInitialInputValue(exIndex, setIndex, METRIC.duration) ? Number(this.getInitialInputValue(exIndex, setIndex, METRIC.duration)) : undefined;
    const tempo = this.getInitialInputValue(exIndex, setIndex, METRIC.tempo) ? String(this.getInitialInputValue(exIndex, setIndex, METRIC.tempo)) : undefined;
    const rest = this.getInitialInputValue(exIndex, setIndex, METRIC.rest) ? Number(this.getInitialInputValue(exIndex, setIndex, METRIC.rest)) : undefined;

    this.performanceInputValues()[key] = {
      'weightUsed': weight,
      'repsAchieved': reps,
      'actualDistance': distance,
      'actualDuration': duration,
      'tempoUsed': tempo,
      'restAfterSet': rest,
    }
  }

  /**
   * CORRECTED: Checks all sets for an exercise to determine which data columns should be visible.
   * A column is now only considered visible if at least one set has a target value GREATER THAN 0
   * for that metric, or a corresponding "Min" value is set. This keeps the UI clean for
   * exercises where a target might be initialized to 0 (e.g., bodyweight exercises).
   * @param exIndex The index of the exercise in the routine.
   * @returns An object with boolean flags for each potential column.
   */
  public getVisibleSetColumns(exIndex: number, setIndex: number): { [key: string]: boolean } {
    const exercise = this.routine()?.exercises[exIndex];
    const set = exercise?.sets[setIndex];

    const routine = this.routine();

    if (!set || !routine) {
      // Fallback for safety, though it should always find a set.
      return { [METRIC.weight]: false, [METRIC.reps]: false, [METRIC.distance]: false, [METRIC.duration]: false, [METRIC.rest]: false };
    }

    return this.workoutService.getVisibleSetColumns(routine, exIndex, setIndex);
  }

  public getFieldsForSet(exIndex: number, setIndex: number): { visible: string[], hidden: string[] } {
    const routine = this.routine();
    if (!routine) return this.workoutService.defaultHiddenFields();
    // Delegate to the existing service method
    return this.workoutService.getFieldsForSet(routine, exIndex, setIndex);
  }

  public canAddField(exIndex: number, setIndex: number): boolean {
    const fields = this.getFieldsForSet(exIndex, setIndex);
    // Show the button if there are fields that can be added and we are not at the max of 4.
    return fields.hidden.length > 0 && fields.visible.length < this.workoutService.getDefaultFields().length;
  }

  isFalsyOrZero(value: number | null | undefined): boolean {
    return value === undefined || value === null || value === 0;
  }

  /**
   * Determines if the small "Add Field" button in the set's action area should be visible.
   * This is true only for non-superset exercises with exactly two visible metrics.
   */
  public shouldShowSmallAddButton(exIndex: number, setIndex: number): boolean {
    if (this.isSuperSet(exIndex)) return false;
    const cols = this.getVisibleSetColumns(exIndex, setIndex);
    const visibleCount = Object.values(cols).filter(v => v).length;
    return visibleCount === 2;
  }

  public canRemoveAnyField(exIndex: number, setIndex: number): boolean {
    const fields = this.getFieldsForSet(exIndex, setIndex);
    // Show the button if there is more than one metric to choose from.
    return fields.visible.length > 1;
  }

  public async promptRemoveField(exIndex: number, setIndex: number): Promise<void> {
    const currentRoutine = this.routine();
    if (!currentRoutine) return;

    // The service handles the UI and returns the updated routine state
    const updatedRoutine = await this.workoutService.promptRemoveField(currentRoutine, exIndex, setIndex);

    if (updatedRoutine) {
      // =================== START OF SNIPPET (Part 1) ===================
      // 1. Update the main routine signal to trigger a re-render
      this.routine.set({ ...updatedRoutine });

      // 2. THE FIX: Immediately re-synchronize the input values signal
      //    with the new state of the routine.
      this._prefillPerformanceInputs();
      // =================== END OF SNIPPET (Part 1) ===================
    }
  }


  public async promptAddField(exIndex: number, setIndex: number): Promise<void> {
    const currentRoutine = this.routine();
    if (!currentRoutine) return;

    // The service handles the UI and returns the updated routine state
    const updatedRoutine = await this.workoutService.promptAddField(currentRoutine, exIndex, setIndex);

    if (updatedRoutine) {
      // =================== START OF SNIPPET (Part 2) ===================
      // 1. Update the main routine signal to trigger a re-render
      this.routine.set(updatedRoutine);

      // 2. THE FIX: Immediately re-synchronize the input values signal
      //    with the new state of the routine.
      this._prefillPerformanceInputs();
      // =================== END OF SNIPPET (Part 2) ===================

      this.toastService.success("Field added to set.");
    }
  }

  /**
    * UPDATED: Removes a field from ALL sets of an exercise for UI consistency.
    */
  public removeMetricFromSet(exIndex: number, setIndex: number, fieldToRemove: string): void {
    const routine = this.routine();
    if (!routine) return;

    const exercise = routine.exercises[exIndex];
    const set = exercise.sets[setIndex];
    const plannedSetId = set.id;

    // 1. Update the routine signal to remove the target from the specific set
    this.routine.update(r => {
      if (!r) return r;
      const setToUpdate = r.exercises[exIndex].sets[setIndex];
      switch (fieldToRemove) {
        case METRIC.weight: setToUpdate.targetWeight = undefined; break;
        case METRIC.reps: setToUpdate.targetReps = undefined; break;
        case METRIC.distance: setToUpdate.targetDistance = undefined; break;
        case METRIC.duration: setToUpdate.targetDuration = undefined; break;
        case METRIC.rest: setToUpdate.restAfterSet = 0; break;
        case METRIC.tempo: setToUpdate.targetTempo = undefined; break;
      }
      return { ...r };
    });

    // 2. Update the workout log to remove the performed value, if it exists for that set
    this.currentWorkoutLog.update(log => {
      const exerciseLog = log.exercises?.find(e => e.id === exercise.id);
      if (exerciseLog) {
        // For supersets, we need to find the correct round
        const targetLoggedSetId = exercise.supersetId ? `${plannedSetId}-round-${setIndex}` : plannedSetId;
        const loggedSet = exerciseLog.sets.find(s => s.plannedSetId === targetLoggedSetId);

        if (loggedSet) {
          switch (fieldToRemove) {
            case METRIC.weight: loggedSet.weightUsed = undefined; break;
            case METRIC.reps: loggedSet.repsAchieved = 0; break;
            case METRIC.distance: loggedSet.distanceAchieved = undefined; break;
            case METRIC.duration: loggedSet.durationPerformed = undefined; break;
            case METRIC.rest: loggedSet.restAfterSetUsed = undefined; break;
            case METRIC.tempo: loggedSet.tempoUsed = undefined; break;
          }
        }
      }
      return { ...log };
    });

    this.toastService.info(`'${fieldToRemove}' field removed from set #${setIndex + 1}.`);
  }


  isSetExpanded(exIndex: number, setIndex: number): boolean {
    const key = `${exIndex}-${setIndex}`;
    return this.expandedSets().has(key);
  }

  // +++ ADD THIS METHOD: Toggles the expanded/collapsed state of a specific set +++
  toggleSetExpansion(exIndex: number, setIndex: number, event: Event): void {
    event.stopPropagation(); // Prevent the main exercise card from toggling
    const key = `${exIndex}-${setIndex}`;

    this.expandedSets.update(currentSet => {
      const newSet = new Set(currentSet); // Create a new instance for signal change detection
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }

  // +++ ADD THIS METHOD: Gets a summary of the set for the collapsed view +++
  getSetSummary(exIndex: number, setIndex: number): string {
    const routine = this.routine();
    if (!routine) return '';
    const exercise = routine.exercises[exIndex];
    const loggedSet = this.getLoggedSet(exIndex, setIndex);
    const plannedSet = exercise.sets[setIndex];

    // Prioritize logged data for the summary, fall back to planned data
    const data = loggedSet || plannedSet;

    let parts: string[] = [];

    const weight = loggedSet?.weightUsed ?? plannedSet.targetWeight;
    const reps = loggedSet?.repsAchieved ?? plannedSet.targetReps;
    const distance = loggedSet?.distanceAchieved ?? plannedSet.targetDistance;
    const duration = loggedSet?.durationPerformed ?? plannedSet.targetDuration;
    const tempo = loggedSet?.targetTempo ?? plannedSet.targetTempo;

    if (weight !== undefined && weight !== null && weight > 0) {
      parts.push(`${this.weightUnitPipe.transform(weight)}`);
    } else if (weight === 0) {
      parts.push('Bodyweight');
    }

    if (reps !== undefined && reps !== null && reps > 0) {
      parts.push(`${reps} reps`);
    }

    if (distance !== undefined && distance !== null && distance > 0) {
      parts.push(`${distance} ${this.unitsService.getDistanceMeasureUnitSuffix()}`);
    }

    if (duration !== undefined && duration !== null && duration > 0) {
      parts.push(this.formatSecondsToTime(duration));
    }

    if (tempo) {
      parts.push(`T: ${tempo}`);
    }

    if (parts.length === 0) return 'Tap to log...';

    return parts.join(' x ');
  }


  /**
   * Checks if a standard set is time-based and should display a timer.
   * @param exIndex The index of the exercise.
   * @param setIndex The index of the set.
   * @returns True if the set is a timed set.
   */
  public isTimedSet(exIndex: number, setIndex: number): boolean {
    const exercise = this.routine()?.exercises[exIndex];
    const set = exercise?.sets[setIndex];
    // A set is timed if it's NOT in a superset and has a duration target > 0
    return !!(!exercise?.supersetId && set && (set.targetDuration ?? 0) > 0);
  }

  /**
   * Helper to find the index of the first round in a superset that has not been logged yet.
   * @param exIndex The index of the starting exercise of the superset.
   * @returns The index of the first incomplete round, or -1 if all are complete.
   */
  protected findFirstIncompleteRoundIndex(exIndex: number): number {
    const exercise = this.routine()?.exercises[exIndex];
    if (!exercise?.supersetId) {
      return -1;
    }
    return exercise.sets.findIndex((round, roundIdx) => !this.isRoundCompleted(exIndex, roundIdx));
  }


  /**
   * Determines the dynamic CSS classes for a superset round card.
   * Gives a special "focused" style to the first incomplete round when it's expanded.
   * @param exIndex The index of the exercise.
   * @param roundIndex The index of the round.
   * @returns An object compatible with [ngClass].
   */
  public getRoundClasses(exIndex: number, roundIndex: number): any {
    const isCompleted = this.isRoundCompleted(exIndex, roundIndex);
    const isExpanded = this.isRoundExpanded(exIndex, roundIndex);
    const firstIncompleteIndex = this.findFirstIncompleteRoundIndex(exIndex);

    const isFocused = isExpanded && roundIndex === firstIncompleteIndex;

    if (isFocused) {
      return {
        'rounded-md p-2 transition-all duration-300': true,
        'ring-2 ring-yellow-400 dark:ring-yellow-500 z-10': true,
        'bg-gray-100 dark:bg-gray-900': true
      };
    }

    if (isCompleted) {
      return {
        'rounded-md p-2 transition-all duration-300': true,
        'bg-green-300 dark:bg-green-700 border border-green-300 dark:border-green-800': true,
      };
    }

    if (isExpanded) {
      return {
        'rounded-md p-2 py-1 transition-all duration-300': true,
        'bg-gray-100 dark:bg-gray-900': true
      }
    }

    return {
      'rounded-md p-2 py-1 transition-all duration-300': true,
      'bg-gray-100 dark:bg-gray-800': true,
    };
  }

  /**
     * Gets the current timer state for a specific standard set.
     * It prioritizes the user's input for the duration if it differs from the planned target.
     */
  getSetTimerState(exIndex: number, setIndex: number): { status: 'idle' | 'running' | 'paused', remainingTime: number } {
    if (this.isSetCompleted(exIndex, setIndex)) {
      return { status: 'idle', remainingTime: 0 };
    }
    const key = `${exIndex}-${setIndex}`;
    const allTimerStates = this.setTimerState();

    // If a timer is already active (running/paused), return its current state immediately.
    if (allTimerStates[key]) {
      return allTimerStates[key];
    }

    // --- PRIORITY LOGIC FOR IDLE STATE ---
    // If the timer is idle, determine the correct starting duration.
    const userInputs = this.performanceInputValues()[key];
    let duration: number;

    // 1. Prioritize the user's typed input if it exists.
    if (userInputs && userInputs.actualDuration !== undefined && userInputs.actualDuration !== null) {
      duration = userInputs.actualDuration;
    } else {
      // 2. Fall back to the planned target duration from the routine.
      duration = this.routine()?.exercises[exIndex].sets[setIndex].targetDuration ?? 0;
    }

    // Return the idle state with the correctly prioritized duration.
    return { status: 'idle', remainingTime: duration };
  }

  /**
   * Central handler for the timed set button clicks (play/pause/resume).
   */
  handleSetTimerAction(exIndex: number, setIndex: number, event: Event): void {
    event.stopPropagation();
    const key = `${exIndex}-${setIndex}`;
    const state = this.getSetTimerState(exIndex, setIndex);

    switch (state.status) {
      case 'idle':
      case 'paused':
        this.startSetTimer(exIndex, setIndex, key);
        break;
      case 'running':
        this.pauseSetTimer(key);
        break;
    }
  }

  /**
   * Starts or resumes the timer for a specific standard set.
   * --- CORRECTED ---
   * It now uses getSetTimerState to ensure it starts with the correct duration,
   * respecting any user input.
   */
  private startSetTimer(exIndex: number, setIndex: number, key: string): void {
    this.lastBeepSecond = null;
    // Get the state object, which correctly prioritizes user input for its `remainingTime`.
    const state = this.getSetTimerState(exIndex, setIndex);
    const duration = state.remainingTime;

    this.setTimerState.update(states => {
      // When starting fresh, use the correct duration.
      // When resuming, the `remainingTime` is already correct from the state.
      if (!states[key]) {
        states[key] = { status: 'running', remainingTime: duration };
      } else {
        states[key].status = 'running';
      }
      return { ...states };
    });

    this.setTimerSub?.unsubscribe();
    this.setTimerSub = timer(0, 1000).subscribe(() => {
      const currentRemaining = this.setTimerState()[key]?.remainingTime;
      if (currentRemaining > 0) {
        this.playCountdownSound(currentRemaining);
        this.setTimerState.update(states => {
          states[key].remainingTime--;
          return { ...states };
        });
      } else {
        this.setTimerSub?.unsubscribe();

        const exercise = this.routine()!.exercises[exIndex];
        const set = exercise.sets[setIndex];
        if (!this.isSetCompleted(exIndex, setIndex)) {
          this.toastService.success(`Set #${setIndex + 1} complete!`);
          this.toggleSetCompletion(exercise, set, exIndex, setIndex, 0);
        }
        this.setTimerState.update(states => {
          delete states[key];
          return { ...states };
        });
        this.playEndSound();
      }
    });
  }

  /**
   * Pauses the currently active standard set timer.
   */
  private pauseSetTimer(key: string): void {
    this.setTimerSub?.unsubscribe();
    this.setTimerState.update(states => {
      if (states[key]) {
        states[key].status = 'paused';
      }
      return { ...states };
    });
  }

  /**
   * UI helper to get the text for the timed set button.
   */
  getSetTimerButtonText(exIndex: number, setIndex: number): string {
    const state = this.getSetTimerState(exIndex, setIndex);
    const textMap = { idle: 'START', running: 'PAUSE', paused: 'RESUME' };
    return textMap[state.status];
  }

  /**
   * UI helper to get the icon for the timed set button.
   */
  getSetTimerButtonIcon(exIndex: number, setIndex: number): string {
    const state = this.getSetTimerState(exIndex, setIndex);
    const iconMap = { idle: 'play', running: 'pause', paused: 'play' };
    return iconMap[state.status];
  }

  /**
   * UI helper to get the CSS class for the timed set button.
   */
  getSetTimerButtonClass(exIndex: number, setIndex: number): string {
    const state = this.getSetTimerState(exIndex, setIndex);
    const classMap = {
      idle: 'bg-teal-500 hover:bg-teal-600',
      running: 'bg-yellow-500 hover:bg-yellow-600',
      paused: 'bg-teal-500 hover:bg-teal-600 animate-pulse',
    };
    return classMap[state.status];
  }

  cardHeaderText(): string {
    const routine = this.routine();
    const sessioneState = this.sessionState();

    if (!routine || routine === undefined) {
      return '';
    }
    const sessionStatePaused = sessioneState === 'paused' ? ' animate-pulse' : '';
    return !!routine.cardColor ? 'text-white' + sessionStatePaused : '' + sessionStatePaused;
  }

  isSessionOverviewVisible = signal(false);
  openSessionOverviewModal(): void {
    this.isSessionOverviewVisible.set(true);
  }

  closeSessionOverviewModal(): void {
    this.isSessionOverviewVisible.set(false);
  }

  /**
   * Pre-populates the `performanceInputValues` signal with the initial planned
   * values for every set in the routine. This ensures that if a user logs a
   * set without interacting with the inputs, the planned targets are logged correctly.
   */
  private _prefillPerformanceInputs(): void {
    const routine = this.routine();
    if (!routine) return;

    const initialValues: { [key: string]: Partial<ExerciseCurrentExecutionSetParams> } = {};

    routine.exercises.forEach((exercise, exIndex) => {
      exercise.sets.forEach((plannedSet, setIndex) => {
        const key = `${exIndex}-${setIndex}`;
        const setValues: Partial<ExerciseCurrentExecutionSetParams> = {};

        // Reps
        if (plannedSet.targetRepsMin != null && plannedSet.targetRepsMax != null) {
          setValues.repsAchieved = Math.floor((plannedSet.targetRepsMin + plannedSet.targetRepsMax) / 2);
        } else {
          setValues.repsAchieved = plannedSet.targetReps ?? undefined;
        }

        // Weight
        if (plannedSet.targetWeightMin != null && plannedSet.targetWeightMax != null) {
          setValues.weightUsed = Math.floor((plannedSet.targetWeightMin + plannedSet.targetWeightMax) / 2);
        } else {
          setValues.weightUsed = plannedSet.targetWeight ?? undefined;
        }

        // Distance
        if (plannedSet.targetDistanceMin != null && plannedSet.targetDistanceMax != null) {
          setValues.actualDistance = Math.floor((plannedSet.targetDistanceMin + plannedSet.targetDistanceMax) / 2);
        } else {
          setValues.actualDistance = plannedSet.targetDistance ?? undefined;
        }

        // Duration
        if (plannedSet.targetDurationMin != null && plannedSet.targetDurationMax != null) {
          setValues.actualDuration = Math.floor((plannedSet.targetDurationMin + plannedSet.targetDurationMax) / 2);
        } else {
          setValues.actualDuration = plannedSet.targetDuration ?? undefined;
        }

        // Rest
        if (plannedSet.restAfterSet != null) {
          setValues.restAfterSet = plannedSet.restAfterSet;
        } else {
          setValues.restAfterSet = plannedSet.restAfterSet ?? undefined;
        }

        // Notes & Tempo
        setValues.notes = plannedSet.notes ?? undefined;
        setValues.tempoUsed = plannedSet.targetTempo ?? undefined;

        initialValues[key] = setValues;
      });
    });

    this.performanceInputValues.set(initialValues);
  }

  /**
 * A computed signal that creates a "display-ready" version of the routine.
 * It pre-calculates the progressive overload suggestions for every set that needs one.
 * This is highly efficient because it only re-runs when the routine or the log changes.
 */
  suggestedRoutine = computed<Routine | null | undefined>(() => {
    const routine = this.routine();
    const log = this.currentWorkoutLog(); // Dependency on the log is crucial

    if (!routine) {
      return routine; // Return null or undefined if no routine is loaded
    }

    // Create a new routine object to avoid mutating the original signal's value
    const newRoutine: Routine = {
      ...routine,
      exercises: routine.exercises.map((exercise, exIndex) => ({
        ...exercise,
        sets: exercise.sets.map((set, setIndex) => {
          // This is the core logic from your old getSetTargetDisplay method
          if (setIndex === 0) {
            return set; // First set always uses the planned values
          }

          const roundIndexForLog = this.isSuperSet(exIndex) ? setIndex - 1 : 0;
          const previousLoggedSet = this.getLoggedSet(exIndex, setIndex - 1, roundIndexForLog);

          if (previousLoggedSet) {
            // If the previous set was logged, return the suggested parameters for the current set
            return this.workoutService.suggestNextSetParameters(previousLoggedSet, set);
          } else {
            // Otherwise, return the original planned set
            return set;
          }
        })
      }))
    };

    return newRoutine;
  });



  private intervalId: any = null;

  onShortPressIncrement(exIndex: number, setIndex: number, field: METRIC): void {
    this.incrementValue(exIndex, setIndex, field);
  }

  onLongPressIncrement(exIndex: number, setIndex: number, field: METRIC): void {
    this.intervalId = setInterval(() => this.incrementValue(exIndex, setIndex, field), 200);
  }

  onShortPressDecrement(exIndex: number, setIndex: number, field: METRIC): void {
    this.decrementValue(exIndex, setIndex, field);
  }

  onLongPressDecrement(exIndex: number, setIndex: number, field: METRIC): void {
    this.intervalId = setInterval(() => this.decrementValue(exIndex, setIndex, field), 200);
  }

  onPressRelease(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private incrementValue(exIndex: number, setIndex: number, field: METRIC): void {
    const settings = this.appSettingsService.getSettings();
    const isWeight = field === METRIC.weight;
    const isTime = field === METRIC.duration || field === METRIC.rest;
    const step = isWeight ? (settings.weightStep || 0.5) : (isTime ? 1 : 1); // Step is 1 second for time
    const key = `${exIndex}-${setIndex}`;

    this.performanceInputValues.update(currentInputs => {
      const newInputs = { ...currentInputs };
      if (!newInputs[key]) {
        newInputs[key] = {};
      }

      const initialValueStr = this.getInitialInputValue(exIndex, setIndex, field);
      let currentNumberValue = 0;

      // THE FIX: Use the correct parser based on the field type
      if (isTime) {
        currentNumberValue = this.parseTimeToSeconds(initialValueStr) || 0;
      } else {
        currentNumberValue = parseFloat(initialValueStr) || 0;
      }

      const newNumberValue = parseFloat((currentNumberValue + step).toFixed(2));

      switch (field) {
        case METRIC.weight: newInputs[key]!.weightUsed = newNumberValue; break;
        case METRIC.reps: newInputs[key]!.repsAchieved = newNumberValue; break;
        case METRIC.distance: newInputs[key]!.actualDistance = newNumberValue; break;
        case METRIC.duration: newInputs[key]!.actualDuration = newNumberValue; break;
        case METRIC.rest: newInputs[key]!.restAfterSet = newNumberValue; break;
      }

      return newInputs;
    });
  }

  private decrementValue(exIndex: number, setIndex: number, field: METRIC): void {
    const settings = this.appSettingsService.getSettings();
    const step = field === METRIC.weight ? (settings.weightStep || 0.5) : 1;
    const key = `${exIndex}-${setIndex}`;

    this.performanceInputValues.update(currentInputs => {
      const newInputs = { ...currentInputs };
      if (!newInputs[key]) {
        newInputs[key] = {};
      }

      let currentValue = 0;
      switch (field) {
        case METRIC.weight: currentValue = newInputs[key]!.weightUsed ?? (parseFloat(this.getInitialInputValue(exIndex, setIndex, METRIC.weight)) || 0); break;
        case METRIC.reps: currentValue = newInputs[key]!.repsAchieved ?? (parseInt(this.getInitialInputValue(exIndex, setIndex, METRIC.reps)) || 0); break;
        case METRIC.distance: currentValue = newInputs[key]!.actualDistance ?? (parseInt(this.getInitialInputValue(exIndex, setIndex, METRIC.distance)) || 0); break;
        case METRIC.duration: currentValue = newInputs[key]!.actualDuration ?? (parseInt(this.getInitialInputValue(exIndex, setIndex, METRIC.duration)) || 0); break;
        case METRIC.rest: currentValue = newInputs[key]!.restAfterSet ?? (parseInt(this.getInitialInputValue(exIndex, setIndex, METRIC.rest)) || 0); break;
      }

      const newValue = Math.max(0, parseFloat((currentValue - step).toFixed(2)));

      switch (field) {
        case METRIC.weight: newInputs[key]!.weightUsed = newValue; break;
        case METRIC.reps: newInputs[key]!.repsAchieved = newValue; break;
        case METRIC.distance: newInputs[key]!.actualDistance = newValue; break;
        case METRIC.duration: newInputs[key]!.actualDuration = newValue; break;
        case METRIC.rest: newInputs[key]!.restAfterSet = newValue; break;
      }

      return newInputs;
    });
  }
}