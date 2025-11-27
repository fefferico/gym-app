import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef, PLATFORM_ID, ViewChildren, QueryList, ElementRef, effect, ViewChild, afterNextRender, Injector, runInInjectionContext } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer, of, lastValueFrom, firstValueFrom, combineLatest, forkJoin, Observable } from 'rxjs';
import { switchMap, take, map, last } from 'rxjs/operators';
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
  RepsTargetType,
  RepsTarget,
  WeightTargetType,
  WeightTarget,
  DistanceTarget,
  DurationTarget,
  RestTarget,
  REPS_TARGET_SCHEMES,
  WEIGHT_TARGET_SCHEMES,
  AnyScheme,
  AnyTarget,
  DURATION_TARGET_SCHEMES,
  DISTANCE_TARGET_SCHEMES,
  REST_TARGET_SCHEMES,
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
import { MenuMode, RestTimerMode, SummaryDisplayMode } from '../../../core/models/app-settings.model';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { TrainingProgram } from '../../../core/models/training-program.model';
import { AlertButton, AlertInput } from '../../../core/models/alert.model';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { addExerciseBtn, addRoundToExerciseBtn, addSetToExerciseBtn, addToSuperSetBtn, addWarmupSetBtn, calculatorBtn, createSuperSetBtn, exerciseInfoBtn, exerciseNotesBtn, finishEarlyBtn, metricsBtn, openSessionPerformanceInsightsBtn, pauseSessionBtn, quitWorkoutBtn, removeExerciseBtn, removeFromSuperSetBtn, removeRoundFromExerciseBtn, removeSetFromExerciseBtn, restBtn, resumeSessionBtn, sectionExerciseBtn, sessionNotesBtn, setNotesBtn, switchExerciseBtn, timerBtn } from '../../../core/services/buttons-data';
import { mapExerciseTargetSetParamsToExerciseExecutedSetParams } from '../../../core/models/workout-mapper';
import { ProgressiveOverloadService } from '../../../core/services/progressive-overload.service.ts';
import { BarbellCalculatorModalComponent } from '../../../shared/components/barbell-calculator-modal/barbell-calculator-modal.component';
import { NgLetDirective } from '../../../shared/directives/ng-let.directive';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SessionOverviewModalComponent } from '../session-overview-modal/session-overview-modal.component';
import { FullScreenRestTimerComponent, TIMER_MODES } from '../../../shared/components/full-screen-rest-timer/full-screen-rest-timer';
import { AUDIO_TYPES, AudioService } from '../../../core/services/audio.service';
import { PressDirective } from '../../../shared/directives/press.directive';
import { SET_TYPE } from '../workout-builder';
import { BumpClickDirective } from '../../../shared/directives/bump-click.directive';
import { repsTargetAsString, repsTypeToReps, genRepsTypeFromRepsNumber, getDurationValue, durationToExact, getWeightValue, weightToExact, getDistanceValue, distanceToExact, restToExact, getRestValue, getRepsValue, repsToExact, weightTargetAsString, distanceTargetAsString, durationTargetAsString, restTargetAsString } from '../../../core/services/workout-helper.service';
import { WorkoutUtilsService } from '../../../core/services/workout-utils.service';
import { WorkoutSection } from '../../../core/models/workout-section.model';
import { WORKOUT_SECTION_TYPE_ORDER, WorkoutSectionType } from '../../../core/models/workout-section-type.model';
import { WorkoutSectionService } from '../../../core/services/workout-section.service';
import { ModalService } from '../../../core/services/modal.service';
import { EXERCISE_CATEGORY_TYPES } from '../../../core/models/exercise-category.model';
import { ThemeService } from '../../../core/services/theme.service';
import { NumbersOnlyDirective } from '../../../shared/directives/onlyNumbers.directive';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ExerciseDetailComponent } from '../../exercise-library/exercise-detail';
import { ShatterableDirective } from '../../../animations/shatterable.directive';

// Interface for saving the paused state

enum SessionState {
  Loading = 'loading',
  Playing = 'playing',
  Paused = 'paused',
  Error = 'error',
  End = 'end',
}

enum TimerSetState {
  Idle = 'idle',
  Running = 'running',
  Paused = 'paused',
  Completed = 'completed'
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
    CommonModule, DatePipe, IconComponent,
    ExerciseSelectionModalComponent, FormsModule, ActionMenuComponent, FullScreenRestTimerComponent, NgLetDirective,
    DragDropModule, BarbellCalculatorModalComponent, TranslateModule, SessionOverviewModalComponent, PressDirective,
    BumpClickDirective, NumbersOnlyDirective, ModalComponent, ExerciseDetailComponent, ShatterableDirective
  ],
  templateUrl: './compact-workout-player.component.html',
  styleUrls: ['./compact-workout-player.component.scss'],
  providers: [DecimalPipe, WeightUnitPipe, AudioService],
})
export class CompactWorkoutPlayerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  protected router = inject(Router);
  protected workoutService = inject(WorkoutService);
  protected workoutUtilsService = inject(WorkoutUtilsService);
  private exerciseService = inject(ExerciseService);
  protected trackingService = inject(TrackingService);
  protected trainingProgramService = inject(TrainingProgramService);
  protected storageService = inject(StorageService);
  protected alertService = inject(AlertService);
  protected modalService = inject(ModalService);
  protected toastService = inject(ToastService);
  protected unitsService = inject(UnitsService);
  private weightUnitPipe = inject(WeightUnitPipe);
  private cdr = inject(ChangeDetectorRef);
  protected appSettingsService = inject(AppSettingsService);
  protected progressiveOverloadService = inject(ProgressiveOverloadService);
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);
  private translate = inject(TranslateService);
  private themeService = inject(ThemeService);

  private workoutSectionService = inject(WorkoutSectionService);


  @ViewChildren(ShatterableDirective) shatterables!: QueryList<ShatterableDirective>;

  availablePlayerRepSchemes: { type: RepsTargetType; label: string }[] = [];


  private toggledSetAnimation = signal<{ key: string, type: 'set' | 'round', state: 'completed' | 'incompleted' } | null>(null);
  protected metricEnum = METRIC;

  isAddToSupersetModalOpen = signal(false);
  exerciseToSupersetIndex = signal<number | null>(null);
  expandedSets = signal(new Set<string>());
  setTimerState = signal<{ [key: string]: { status: TimerSetState, remainingTime: number } }>({});
  private setTimerSub: Subscription | undefined;

  lastExerciseIndex = signal<number>(-1);
  lastExerciseSetIndex = signal<number>(-1);

  private lastLoggedSetForRestUpdate: LoggedSet | null = null;

  protected getMenuMode(): MenuMode {
    return this.appSettingsService.getMenuMode();
  }

  protected getShowMetricTarget(): boolean {
    return this.appSettingsService.isShowMetricTarget();
  }

  protected restTimerModeEnum = RestTimerMode;
  protected getRestTimerMode() {
    return this.appSettingsService.getRestTimerMode();
  }

  protected summaryDisplayModeEnum = SummaryDisplayMode;
  protected getSummaryDisplayMode() {
    return this.appSettingsService.getSummaryDisplayMode();
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
        actualReps: completedSetLog?.repsLogged,
        actualWeight: completedSetLog?.weightLogged,
        actualDuration: completedSetLog?.durationLogged,
        actualDistance: completedSetLog?.distanceLogged,
        actualRest: completedSetLog?.restLogged,
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
  protected sessionStateEnum = SessionState;
  protected timerSetEnum = TimerSetState;
  sessionTimerDisplay = signal('00:00');
  expandedExerciseIndex = signal<number | null>(null);
  activeExerciseMenuIndex = signal<number | null>(null);
  mainSessionActionMenuOpened = signal<boolean>(false);
  playerSubState = signal<PlayerSubState>(PlayerSubState.PerformingSet);

  showCompletedSetsForExerciseInfo = signal(true);
  showCompletedSetsForDayInfo = signal(false);

  isRestTimerVisible = signal(false);
  restDuration = signal(0);
  restTimerMainText = signal(this.translate.instant('compactPlayer.rest'));
  restTimerNextUpText = signal<string | null>(this.translate.instant('compactPlayer.loading'));
  restTimerNextSetDetails = signal<ExerciseTargetSetParams | null>(null);


  private compactRestStartTimestamp: number | null = null;
  private compactRestDuration: number = 0;
  /**
 * Returns the remaining rest time in seconds.
 */
  restTimerRemaining(): number {
    if (!this.isRestTimerVisible()) return 0;
    if (this.getRestTimerMode() !== this.restTimerModeEnum.Compact) {
      // fallback for fullscreen or other modes
      return this.restDuration();
    }
    if (this.compactRestStartTimestamp === null) return this.compactRestDuration;
    const elapsed = Math.floor((Date.now() - this.compactRestStartTimestamp) / 1000);
    const remaining = this.compactRestDuration - elapsed;
    return Math.max(0, remaining);
  }

  /**
   * Returns the progress of the rest timer as a percentage (0-100).
   */
  restTimerProgress(): number {
    const total = this.compactRestDuration;
    const remaining = this.restTimerRemaining();
    if (!total || total <= 0) return 0;
    const elapsed = total - remaining;
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  }
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

  currentWorkoutLog = signal<Partial<WorkoutLog>>({ exercises: [], notes: '' });
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
  emomState = signal<{ [key: string]: { status: TimerSetState, remainingTime: number } }>({});
  private emomTimerSub: Subscription | undefined;

  workoutProgress = computed(() => {
    const routine = this.routine();
    const log = this.currentWorkoutLog();
    if (!routine || !routine.exercises || routine.exercises.length === 0) {
      return 0;
    }
    // The total planned sets is simply the sum of all sets from all exercises.
    const totalPlannedSets = routine.exercises.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);
    if (totalPlannedSets === 0) {
      return 0;
    }
    const totalCompletedSets = log.exercises?.reduce((total, ex) => total + ex.sets.length, 0) || 0;
    return Math.min(100, (totalCompletedSets / totalPlannedSets) * 100);
  });

  sectionProgress(section: WorkoutSection, log: Partial<WorkoutLog>) {
    const totalSets = section.exercises.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);
    const completedSets = section.exercises.reduce((sum, ex) => {
      const logEx = log.exercises?.find(le => le.exerciseId === ex.exerciseId);
      return sum + (logEx?.sets.length ?? 0);
    }, 0);
    return totalSets ? Math.min(100, (completedSets / totalSets) * 100) : 0;
  }

  getSectionProgressColor(section: WorkoutSection | null): string {
    switch (section?.type) {
      case WorkoutSectionType.WARM_UP: return '#f59e0b'; // amber-500
      case WorkoutSectionType.MAIN_LIFT: return '#ef4444'; // red-500
      case WorkoutSectionType.CARDIO: return '#3b82f6'; // blue-500
      case WorkoutSectionType.FINISHER: return '#a855f7'; // purple-500
      case WorkoutSectionType.COOL_DOWN: return '#10b981'; // emerald-500
      // default: return '#6b7280'; // gray-500
      default: return 'white gray-500'; // gray-500
    }
  }


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

    effect(() => {
      const notesKey = this.expandedSetNotes();
      const metricsKey = this.expandedMetricsSection();

      if (!notesKey && !metricsKey) return;

      setTimeout(() => {
        // Handle notes section animation
        if (notesKey) {
          const notesElement = document.querySelector(`[data-notes-section="${notesKey}"]`) as HTMLElement;
          if (notesElement) {
            notesElement.classList.add('animate-bump-in');
            setTimeout(() => notesElement?.classList.remove('animate-bump-in'), 300);
          }
        }

        // Handle metrics section animation
        if (metricsKey) {
          const metricsElement = document.querySelector(`[data-metrics-section="${metricsKey}"]`) as HTMLElement;
          if (metricsElement) {
            metricsElement.classList.add('animate-bump-in');
            setTimeout(() => metricsElement?.classList.remove('animate-bump-in'), 300);
          }
        }
      }, 0);
    });
    // --- END: ADDED SNIPPET (Part 2) ---
  }



  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) { window.scrollTo(0, 0); }
    this.loadAvailableExercises();
    this.availablePlayerRepSchemes = this.workoutUtilsService.getAvailableRepsSchemes('player');


    this.menuModeDropdown = this.appSettingsService.isMenuModeDropdown();
    this.menuModeCompact = this.appSettingsService.isMenuModeCompact();
    this.menuModeModal = this.appSettingsService.isMenuModeModal();

    const hasPausedSession = await this.checkForPausedSession();
    if (!hasPausedSession) {
      this.loadNewWorkoutFromRoute();
    }
  }

  private isDestroyed = false;
  ngOnDestroy(): void {
    this.isDestroyed = true;
    // Save paused session if there is a routine with at least one exercise,
    // and the session is not ended (even if no sets have been logged)
    if (
      !this.isSessionConcluded &&
      this.routine() &&
      this.routine()?.exercises &&
      this.routine()!.exercises.length > 0 &&
      this.sessionState() !== SessionState.End
    ) {
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

  /**
  * Ensures a specific metric exists in a set's fieldOrder and has a default value if not set.
  * @param set The set to modify.
  * @param metric The metric to ensure (e.g., METRIC.reps).
  * @param defaultValue The default value to assign if the target is null or undefined.
  */
  private _ensureMetricInSet(set: ExerciseTargetSetParams, metric: METRIC, defaultValue: number): void {
    if (!set.fieldOrder) {
      set.fieldOrder = [];
    }

    if (!set.fieldOrder.includes(metric)) {
      set.fieldOrder.push(metric);

      switch (metric) {
        case METRIC.reps:
          if (!set.targetReps) {
            set.targetReps = { type: RepsTargetType.exact, value: defaultValue }
          };
          break;
        case METRIC.weight:
          if (set.targetWeight == null) set.targetWeight = weightToExact(defaultValue);
          break;
        case METRIC.duration:
          if (set.targetDuration == null) set.targetDuration = durationToExact(defaultValue);
          break;
      }
    }
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
      }),
      switchMap(routine => {
        if (!routine) return of(null); // Pass nulls through
        return this.translateRoutineExercises$(routine); // Return the translation observable
      })
    ).subscribe(async (routine) => {
      if (this.isDestroyed) { return; }
      if (routine) {
        // We capture the routine before adjustments so we can apply them to a copy
        let routineForSession = JSON.parse(JSON.stringify(routine)) as Routine;

        // When in True Gym Mode, ensure all non-cardio exercises have weight and reps fields.
        // if (this.appSettingsService.isTrueGymMode()) {
        const exercisesMap = new Map(this.availableExercises.map(ex => [ex.id, ex]));

        routineForSession.exercises.forEach(exercise => {
          const baseExercise = exercisesMap.get(exercise.exerciseId);
          if (baseExercise) {
            exercise.sets.forEach(set => {
              if (baseExercise?.categories?.find(cat => cat === EXERCISE_CATEGORY_TYPES.cardio) === undefined) {
                // For non-cardio, ensure weight and reps fields are present
                this._ensureMetricInSet(set, METRIC.reps, 8); // Default 8 reps
                this._ensureMetricInSet(set, METRIC.weight, 10); // Default 10 weight
              } else {
                // For cardio, ensure the duration field is present
                this._ensureMetricInSet(set, METRIC.duration, 300); // Default 300s (5 min)
              }
            });
          }
        });
        // }

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
        if (this.sessionState() !== SessionState.End) {
          await this.prefillRoutineWithLastPerformance();
        }
        if (this.programId) {
          this.program.set(await firstValueFrom(this.trainingProgramService.getProgramById(this.programId)));
        }
        this.startWorkout();
      } else {
        // COMPLETELY NEW ROUTINE
        this.showCreationWizard();
      }
    });
  }


  private async prefillRoutineWithLastPerformance(): Promise<void> {
    const currentRoutine = this.routine();
    if (!currentRoutine) return;

    const poSettings = this.progressiveOverloadService.getSettings();
    const isPoEnabled = poSettings.enabled && poSettings.strategies && poSettings.sessionsToIncrement && poSettings.sessionsToIncrement > 0;

    // Fetch all logs for this routine only if PO is enabled
    const allLogsForRoutine = isPoEnabled
      ? await firstValueFrom(this.trackingService.getLogsForRoutine(currentRoutine.id))
      : [];

    // Deep copy to avoid mutating the original
    const routineCopy = JSON.parse(JSON.stringify(currentRoutine)) as Routine;

    // Track which exercises had overload applied
    const overloadAppliedForExercise: boolean[] = [];
    const overloadedExercisesDetails: string[] = [];

    // Track if we need to prompt for historical/original (only if at least one exercise has historical data and no overload)
    let hasAnyHistorical = false;
    let lastPerformances: (LastPerformanceSummary | null)[] = [];

    // Gather last performances for all exercises
    for (const exercise of routineCopy.exercises) {
      try {
        const lastPerformance = await firstValueFrom(
          this.trackingService.getLastPerformanceForExercise(exercise.exerciseId)
        );
        lastPerformances.push(lastPerformance);
        if (lastPerformance && lastPerformance.sets && lastPerformance.sets.length > 0) {
          hasAnyHistorical = true;
        }
      } catch (error) {
        lastPerformances.push(null as any);
      }
    }

    // --- 1. Progressive Overload Pass ---
    const overloadedExercises: string[] = [];

    for (const [exIndex, exercise] of routineCopy.exercises.entries()) {
      let overloadApplied = false;
      const lastPerformance = lastPerformances[exIndex];

      if (isPoEnabled && lastPerformance && lastPerformance.sets && lastPerformance.sets.length > 0) {
        // Filter logs that actually contain the current exercise
        const relevantLogs = allLogsForRoutine.filter(log =>
          log.exercises.some(le => le.exerciseId === exercise.exerciseId)
        );

        if (relevantLogs.length >= poSettings.sessionsToIncrement!) {
          const recentLogsToCheck = relevantLogs.slice(-poSettings.sessionsToIncrement!);
          let allSessionsSuccessful = true;

          for (const log of recentLogsToCheck) {
            const loggedEx = log.exercises.find(le => le.exerciseId === exercise.exerciseId);
            const originalEx = this.originalRoutineSnapshot()?.exercises.find(oe => oe.exerciseId === exercise.exerciseId);

            if (!loggedEx || !originalEx || loggedEx.sets.length < originalEx.sets.length) {
              allSessionsSuccessful = false;
              break;
            }

            const wasSuccess = originalEx.sets.every((originalSet, setIndex) => {
              if (originalSet.type === 'warmup') return true;
              const loggedSet = loggedEx.sets[setIndex];
              if (!loggedSet) return false;

              // List of metrics to check
              const metrics: Array<{ target: any, logged: any, compare: (a: any, b: any) => boolean }> = [
                {
                  target: originalSet.targetReps,
                  logged: loggedSet.repsLogged,
                  compare: (logged, target) => repsTypeToReps(logged) >= repsTypeToReps(target)
                },
                {
                  target: originalSet.targetWeight,
                  logged: loggedSet.weightLogged,
                  compare: (logged, target) => getWeightValue(logged) >= getWeightValue(target)
                },
                {
                  target: originalSet.targetDuration,
                  logged: loggedSet.durationLogged,
                  compare: (logged, target) => getDurationValue(logged) >= getDurationValue(target)
                },
                {
                  target: originalSet.targetDistance,
                  logged: loggedSet.distanceLogged,
                  compare: (logged, target) => getDistanceValue(logged) >= getDistanceValue(target)
                }
                // Add more metrics if needed
              ];

              // For each metric, if there's a target, there must be a logged value that meets/exceeds it
              for (const { target, logged, compare } of metrics) {
                if (target !== undefined && target !== null) {
                  if (logged === undefined || logged === null) return false;
                  if (!compare(logged, target)) return false;
                }
                // If there's a logged value but no target, consider it succeeded (do nothing)
              }

              return true;
            });

            if (!wasSuccess) {
              allSessionsSuccessful = false;
              break;
            }
          }

          // ...inside the for loop after overload is applied...
          if (allSessionsSuccessful) {
            // Save old main values before overload
            const mainSet = exercise.sets.find(s => s.type !== 'warmup');
            const oldWeight = mainSet?.targetWeight ? getWeightValue(mainSet.targetWeight) : undefined;
            const oldReps = mainSet?.targetReps ? repsTypeToReps(mainSet.targetReps) : undefined;
            const oldDuration = mainSet?.targetDuration ? getDurationValue(mainSet.targetDuration) : undefined;
            const oldDistance = mainSet?.targetDistance ? getDistanceValue(mainSet.targetDistance) : undefined;

            this.progressiveOverloadService.applyOverloadToExercise(exercise, poSettings);

            // Get new main values after overload
            const newMainSet = exercise.sets.find(s => s.type !== 'warmup');
            const newWeight = newMainSet?.targetWeight ? getWeightValue(newMainSet.targetWeight) : undefined;
            const newReps = newMainSet?.targetReps ? repsTypeToReps(newMainSet.targetReps) : undefined;
            const newDuration = newMainSet?.targetDuration ? getDurationValue(newMainSet.targetDuration) : undefined;
            const newDistance = newMainSet?.targetDistance ? getDistanceValue(newMainSet.targetDistance) : undefined;

            // Build a bullet list for each metric
            const metricLines: string[] = [];
            if (oldWeight !== undefined && newWeight !== undefined && newWeight > oldWeight) {
              const diff = newWeight - oldWeight;
              metricLines.push(`${this.translate.instant('metrics.weight')}: ${newWeight} ${this.unitsService.getWeightUnitSuffix()} (${diff > 0 ? '+' : ''}${diff} ${this.unitsService.getWeightUnitSuffix()})`);
            }
            if (oldReps !== undefined && newReps !== undefined && newReps > oldReps) {
              const diff = newReps - oldReps;
              metricLines.push(`${this.translate.instant('metrics.reps')}: ${newReps} (${diff > 0 ? '+' : ''}${diff} rep${Math.abs(diff) === 1 ? '' : 's'})`);
            }
            if (oldDuration !== undefined && newDuration !== undefined && newDuration > oldDuration) {
              const diff = newDuration - oldDuration;
              metricLines.push(`${this.translate.instant('metrics.duration')}: ${newDuration} sec (${diff > 0 ? '+' : ''}${diff} sec)`);
            }
            if (oldDistance !== undefined && newDistance !== undefined && newDistance > oldDistance) {
              const diff = newDistance - oldDistance;
              metricLines.push(`${this.translate.instant('metrics.distance')}: ${newDistance} m (${diff > 0 ? '+' : ''}${diff} m)`);
            }
            if (metricLines.length > 0) {
              overloadedExercisesDetails.push(exercise.exerciseName ?? exercise.id);
              metricLines.forEach(line => overloadedExercisesDetails.push(' • ' + line));
            }
            overloadApplied = true;
          }
        }
      }
      overloadAppliedForExercise[exIndex] = overloadApplied;
    }

    // --- 2. Prompt for historical/original if needed (only if at least one exercise has historical and no overload) ---
    let useHistorical = false;
    if (hasAnyHistorical && overloadAppliedForExercise.some(applied => !applied)) {
      const userChoice = await this.alertService.showConfirmationDialog(
        this.translate.instant('compactPlayer.alerts.prefillTitle'),
        this.translate.instant('compactPlayer.alerts.prefillMessage'),
        [
          { text: this.translate.instant('compactPlayer.alerts.useHistorical'), role: 'confirm', data: 'historical', icon: 'clock' },
          { text: this.translate.instant('compactPlayer.alerts.useOriginal'), role: 'cancel', data: 'original', icon: 'schedule' }
        ]
      );
      useHistorical = userChoice?.data === 'historical';
    }

    // Show feedback to the user after all overloads are applied
    if (overloadedExercisesDetails.length > 0) {
      await this.alertService.showConfirmationDialog(
        this.translate.instant('compactPlayer.toasts.progressiveOverloadAppliedMultipleTitle'),
        this.translate.instant('compactPlayer.toasts.progressiveOverloadAppliedMultipleMessage'),
        [
          {
            text: this.translate.instant('common.ok'),
            role: 'confirm',
            data: true,
            icon: 'check'
          }
        ],
        {
          listItems: overloadedExercisesDetails
        }
      );
    }

    // --- 3. Apply historical values if chosen and not overloaded ---
    for (const [exIndex, exercise] of routineCopy.exercises.entries()) {
      if (!overloadAppliedForExercise[exIndex] && useHistorical) {
        const lastPerformance = lastPerformances[exIndex];
        if (lastPerformance && lastPerformance.sets && lastPerformance.sets.length > 0) {
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
      // else: stick to original routine (do nothing)
    }

    // --- 4. Apply session-wide intensity adjustment (if any) ---
    if (this.intensityAdjustment) {
      const { direction, percentage } = this.intensityAdjustment;
      const multiplier = direction === 'increase' ? 1 + (percentage / 100) : 1 - (percentage / 100);

      routineCopy.exercises.forEach(exercise => {
        exercise.sets.forEach(set => {
          if (set.targetWeight != null) {
            const adjustedWeight = Math.round((getWeightValue(set.targetWeight) * multiplier) * 4) / 4;
            set.targetWeight = weightToExact(adjustedWeight >= 0 ? adjustedWeight : 0);
          }
          if (set.targetReps != null) {
            const adjustedReps = Math.round(repsTypeToReps(set.targetReps) * multiplier);
            set.targetReps = adjustedReps >= 0 ? genRepsTypeFromRepsNumber(adjustedReps) : genRepsTypeFromRepsNumber(0);
          }
          if (set.targetDuration != null) {
            const adjustedDuration = Math.round(getDurationValue(set.targetDuration) * multiplier);
            set.targetDuration = durationToExact(adjustedDuration >= 0 ? adjustedDuration : 0);
          }
          if (set.targetDistance != null) {
            const adjustedDistance = Math.round(getDistanceValue(set.targetDistance) * multiplier);
            set.targetDistance = distanceToExact(adjustedDistance >= 0 ? adjustedDistance : 0);
          }
        });
      });
    }

    // --- 5. Update the routine and trigger change detection ---
    this.routine.set(routineCopy);
    this.cdr.detectChanges();
  }

  startWorkout(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

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
      //this.toggleExerciseExpansion(0);
      this.scrollToSet(0, 0);
    }
    this.alignRestStartTimestampsFromLog();
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
    return base?.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.cardio) !== undefined;
  }

  isCardioByIndex(exIndex: number): boolean {
    const routine = this.routine();
    if (!routine) return false;

    const exercise = routine.exercises[exIndex];
    if (!exercise) return false;

    // Use the pre-loaded 'availableExercises' array for a fast, synchronous lookup
    const baseExercise = this.availableExercises.find(ex => ex.id === exercise.exerciseId);
    return !!(baseExercise?.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.cardio));
  }

  isDistancedExercise(exIndex: number): boolean {
    const base = this.routine()?.exercises[exIndex];
    if (!base) {
      return false;
    }
    return !!base?.sets?.some(set => set.targetDistance) || this.isCardio(base);
  }

  isDurationExercise(exIndex: number): boolean {
    const base = this.routine()?.exercises[exIndex];
    if (!base) {
      return false;
    }
    return !!base?.sets?.some(set => set.targetDuration);
  }

  isSetDataValid(exIndex: number, setIndex: number): boolean {
    // 1. Check for any invalid inputs first. If invalid, can't complete.
    if (this.hasInvalidInput(exIndex, setIndex)) {
      return false;
    }

    // 2. Ensure at least one metric has a meaningful value.
    const routine = this.routine();
    if (!routine) return false;

    const exercise = routine.exercises[exIndex];
    const plannedSet = exercise.sets[setIndex];
    if (!plannedSet) return false;

    const key = this.getSetOrderId(exIndex, setIndex);;
    const userInputs = this.performanceInputValues()[key] || {};

    // Get the effective values to validate (user input > planned)
    const weight = userInputs.actualWeight ?? plannedSet.targetWeight;
    const reps = userInputs.actualReps ?? plannedSet.targetReps;
    const distance = userInputs.actualDistance ?? plannedSet.targetDistance;
    const duration = userInputs.actualDuration ?? plannedSet.targetDuration;

    // Check if any value is present and meaningful. Weight is meaningful even at 0 (bodyweight).
    const hasWeight = weight !== undefined && weight !== null;
    const hasReps = reps !== undefined && reps !== null && repsTypeToReps(reps) !== 0;
    const hasDistance = distance !== undefined && distance !== null && getDistanceValue(distance) > 0;
    const hasDuration = duration !== undefined && duration !== null && getDurationValue(duration) > 0;

    return hasWeight || hasReps || hasDistance || hasDuration;
  }

  getLoggedSet(exIndex: number, setIndex: number, roundIndex: number = 0): LoggedSet | undefined {
    const exercise = this.routine()?.exercises[exIndex];
    if (!exercise) return undefined;

    const exerciseLog = this.currentWorkoutLog()?.exercises?.find(e => e.id === exercise.id);
    if (!exerciseLog) return undefined;

    // Use a consistent, unique ID format for logged superset sets.
    const targetLoggedSetId = this.getPlannedSetId(exercise, exercise.sets[setIndex], roundIndex);

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
    // const result = await this.alertService.showPromptDialog(
    //   this.translate.instant('compactPlayer.alerts.sessionNotesTitle'),
    //   this.translate.instant('compactPlayer.alerts.sessionNotesMessage'),
    //   [{
    //     name: 'notes',
    //     type: 'text',
    //     placeholder: this.translate.instant('compactPlayer.alerts.sessionNotesPlaceholder'),
    //     value: this.currentWorkoutLog().notes ?? undefined,
    //     autofocus: this.currentWorkoutLog().notes ? false : true
    //   }] as AlertInput[],
    //   this.translate.instant('compactPlayer.alerts.saveNotes'),
    //   this.translate.instant('common.cancel'),
    //   [{
    //     role: 'confirm',
    //     text: this.translate.instant('compactPlayer.alerts.saveNotes'),
    //     icon: 'save',
    //     data: true
    //   } as AlertButton]
    // );

    // if (result && result['notes'] !== undefined && result['notes'] !== null) {
    //   this.currentWorkoutLog.update(log => {
    //     log.notes = String(result['notes']) || '';
    //     return log;
    //   });
    //   this.toastService.success(this.translate.instant('compactPlayer.toasts.sessionNotesUpdated'));
    // }
    this.openNoteModal('session');
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

  toggleExerciseExpansion(exIndex: number): void {
    const isOpening = this.expandedExerciseIndex() !== exIndex;
    this.expandedExerciseIndex.update(current => (isOpening ? exIndex : null));

    if (isOpening) {
      const exercise = this.routine()?.exercises[exIndex];
      if (exercise) {
        // If it's a superset, handle round expansion
        if (this.isSupersetStart(exIndex)) {
          // const firstIncompleteRoundIndex = exercise.sets.findIndex((set, roundIdx) => !this.isRoundCompleted(exIndex, roundIdx));
          // const newExpandedRounds = new Set<string>();
          // if (firstIncompleteRoundIndex > -1) {
          //   newExpandedRounds.add(`${exIndex}-${firstIncompleteRoundIndex}`);
          // }
          // this.expandedRounds.set(newExpandedRounds);
        }
        // If it's a standard exercise, handle set expansion
        else if (!this.isSuperSet(exIndex)) {
          const firstIncompleteSetIndex = exercise.sets.findIndex((set, setIdx) => !this.isSetCompleted(exIndex, setIdx, 0));
          const newExpandedSets = new Set<string>();
          if (firstIncompleteSetIndex > -1) {
            newExpandedSets.add(`${exIndex}-${firstIncompleteSetIndex}`);
          }
          // EXPAND FIRST SET
          // this.expandedSets.set(newExpandedSets);
        }
      }

      // The afterNextRender logic for scrolling remains the same
      runInInjectionContext(this.injector, () => {
        if (this.isDestroyed) {
          return;
        }
        afterNextRender(() => {

          requestAnimationFrame(() => {
            const exercise = this.routine()?.exercises[exIndex];
            const headerElement = this.header?.nativeElement;
            const cardElement = document.querySelector(`[data-exercise-index="${exIndex}"]`) as HTMLElement;

            if (!cardElement || !headerElement || !exercise) {
              return; // Failsafe
            }

            let targetElement: HTMLElement | null = null;

            // Check if any sets for THIS specific exercise have been logged.
            const hasLoggedSetsForThisExercise = this.getExerciseTotalLoggedSets(exIndex) > 0;

            // --- SCROLL LOGIC ---
            if (hasLoggedSetsForThisExercise) {
              if (this.isSupersetStart(exIndex)) {
                const targetRoundIndex = exercise.sets.findIndex((set, roundIdx) => !this.isRoundCompleted(exIndex, roundIdx));
                if (targetRoundIndex > -1) {
                  targetElement = cardElement.querySelector(`[data-round-index="${targetRoundIndex}"]`);
                }
              } else if (!this.isSuperSet(exIndex)) {
                const targetSetIndex = exercise.sets.findIndex((set, setIdx) => !this.isSetCompleted(exIndex, setIdx, 0));
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

            // window.scrollTo({ top: scrollTopPosition, behavior: 'smooth' });
            this.scrollCurrentElementIntoView(exIndex, 0);
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

  toggleExerciseNotes(exIndex: number, event?: Event) {
    event?.stopPropagation();
    // this.expandedExerciseNotes.update(current => current === exIndex ? null : exIndex);
    this.openNoteModal('exercise', exIndex);
  }

  toggleSetNotes(exIndex: number, setIndex: number, event: Event) {
    // event.stopPropagation();
    // const key = this.getSetOrderId(exIndex,setIndex);;
    // this.expandedSetNotes.update(current => current === key ? null : key);
    // // expand set if collapsed
    // if (!this.expandedSets().has(key)) {
    //   this.expandedSets.update(currentSet => {
    //     const newSet = new Set(currentSet);
    //     newSet.add(key);
    //     return newSet;
    //   });
    // }
    this.openNoteModal('set', exIndex, setIndex);
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

    // =================== START OF MODIFICATION ===================
    let message = this.translate.instant('compactPlayer.alerts.finishMessage'); // Default for a fully completed workout

    if (hasIncomplete) {
      const skippedCount = analysis.skippedExercises.length;
      const incompleteCount = analysis.incompleteExercises.length;
      const messageParts: string[] = [];

      // Add parts to the message only if their count is greater than zero.
      if (skippedCount > 0) {
        messageParts.push(this.translate.instant('compactPlayer.alerts.skippedDetailSimple', { count: skippedCount }));
      }
      if (incompleteCount > 0) {
        messageParts.push(this.translate.instant('compactPlayer.alerts.incompleteDetailSimple', { count: incompleteCount }));
      }

      // Join the parts with a simple 'and'. You can also make ' and ' a translation key if needed.
      const details = messageParts.join(' and ');

      // Use a base message that incorporates the dynamic details.
      message = this.translate.instant('compactPlayer.alerts.finishEarlyMessageSimple', { details: details });
    }
    // =================== END OF MODIFICATION ===================


    const confirmFinish = await this.alertService.showConfirm(title, message, this.translate.instant('compactPlayer.alerts.finishButton'), this.translate.instant('common.cancel'));
    if (!confirmFinish?.data) {
      return; // User cancelled the initial finish prompt
    }

    this.clearRestTimers();

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
      if (this.isDestroyed) return;
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

  toggleExerciseActionMenu(index: number, event: Event) {
    event.stopPropagation();
    this.activeExerciseMenuIndex.update(current => current === index ? null : index);
    this.closeSetActionMenu();
    this.closeMainSessionActionMenu();
  }
  closeExerciseActionMenu() { this.activeExerciseMenuIndex.set(null); }

  handleExerciseMenuItemClick(event: { actionKey: string, data?: any }) {
    const { actionKey, data: { exIndex } } = event;
    switch (actionKey) {
      case 'exerciseInfo': this.openModal(exIndex); break;
      case 'switchExercise': this.openSwitchExerciseModal(exIndex); break;
      case 'insights': this.openPerformanceInsightsModal(exIndex); break;
      // 'add_round' is now handled by 'addSet'
      case 'addSet': this.addSet(exIndex); break;
      case 'exerciseNotes': this.toggleExerciseNotes(exIndex); break;
      case 'removeSet': this.removeSet(exIndex, 0); break;
      case 'section': this.addSectionExercise(exIndex); break;
      case 'addWarmupSet': this.addWarmupSet(exIndex); break;
      case 'remove': this.removeExercise(exIndex); break;
      case 'createSuperset': this.openCreateSupersetModal(exIndex); break;
      case 'addToSuperset': this.addToSupersetModal(exIndex); break;
      // case 'removeFromSuperset': this.removeFromSuperset(exIndex); break;
    }
  }

  createDefaultWarmupSet(exIndex: number): ExerciseTargetSetParams {
    const routine = this.routine();
    if (!routine) throw new Error('Routine not loaded');
    const exercise = routine.exercises[exIndex];
    const firstSet = exercise.sets[0];

    // Find the base exercise to determine if it's cardio
    const baseExercise = this.availableExercises.find(ex => ex.id === exercise.exerciseId);
    const isCardio = baseExercise?.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.cardio) !== undefined;

    let warmupMetrics: Partial<ExerciseTargetSetParams>;
    if (!isCardio) {
      warmupMetrics = {
        fieldOrder: [METRIC.weight, METRIC.reps, METRIC.rest],
        targetReps: genRepsTypeFromRepsNumber(12),
        targetWeight: firstSet?.targetWeight ? firstSet.targetWeight : weightToExact(0),
        targetRest: restToExact(30)
      };
    } else {
      warmupMetrics = {
        fieldOrder: [METRIC.duration, METRIC.rest],
        targetDuration: durationToExact(300),
        targetRest: restToExact(30),
      };
    }

    return {
      id: uuidv4(),
      type: 'warmup',
      ...warmupMetrics,
      fieldOrder: warmupMetrics.fieldOrder ?? this.workoutUtilsService.getRepsAndWeightFields()
    };
  }

  addWarmupSet(workoutExIndex: number): void {
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[workoutExIndex];

    // Save old user inputs by index
    const oldInputs: { [key: string]: Partial<ExerciseCurrentExecutionSetParams> } = {};
    exercise.sets.forEach((_, setIndex) => {
      const key = this.getSetOrderId(workoutExIndex, setIndex);
      oldInputs[key] = { ...(this.performanceInputValues()[key] || {}) };
    });

    // Create and insert the new warmup set at the beginning
    const newWarmupSet = this.createDefaultWarmupSet(workoutExIndex);
    this.routine.update(r => {
      if (!r) return r;
      const newSets = [newWarmupSet, ...exercise.sets];
      const newExercises = r.exercises.map((ex, idx) =>
        idx === workoutExIndex ? { ...ex, sets: newSets } : ex
      );
      return { ...r, exercises: newExercises };
    });

    // Build new performanceInputValues for this exercise
    const updatedExercise = this.routine()?.exercises[workoutExIndex];
    if (!updatedExercise) return;
    const newInputs = { ...this.performanceInputValues() };

    updatedExercise.sets.forEach((set, setIndex) => {
      const key = this.getSetOrderId(workoutExIndex, setIndex);
      if (setIndex === 0) {
        // New warmup set: default values
        newInputs[key] = {
          actualReps: set.targetReps,
          actualWeight: set.targetWeight,
          actualDistance: set.targetDistance,
          actualDuration: set.targetDuration,
          actualRest: set.targetRest,
          notes: set.notes,
          tempoLogged: set.targetTempo
        };
      } else {
        // Shifted sets: use previous user input if available
        const oldKey = this.getSetOrderId(workoutExIndex, setIndex - 1);
        newInputs[key] = oldInputs[oldKey] ?? {
          actualReps: set.targetReps,
          actualWeight: set.targetWeight,
          actualDistance: set.targetDistance,
          actualDuration: set.targetDuration,
          actualRest: set.targetRest,
          notes: set.notes,
          tempoLogged: set.targetTempo
        };
      }
    });

    this.performanceInputValues.set(newInputs);
  }

  async addWarmupSetOld(exIndex: number) {
    const routine = this.routine();
    if (!routine) return;
    const exerciseToUpdate = routine.exercises[exIndex];
    const firstSet = exerciseToUpdate.sets[0];

    const exBased = await firstValueFrom(this.exerciseService.getExerciseById(exerciseToUpdate.exerciseId));
    const isCardio = exBased?.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.cardio) !== undefined;
    let warmpUpExerciseMetrics: Partial<ExerciseTargetSetParams>;

    if (!isCardio) {
      warmpUpExerciseMetrics = {
        fieldOrder: [METRIC.weight, METRIC.reps, METRIC.rest],
        targetReps: genRepsTypeFromRepsNumber(12),
        targetWeight: firstSet?.targetWeight ? firstSet.targetWeight : weightToExact(0),
        targetRest: restToExact(30)
      }
    } else {
      warmpUpExerciseMetrics = {
        fieldOrder: [METRIC.duration, METRIC.rest],
        targetDuration: durationToExact(300),
        targetRest: restToExact(30),
      }
    }


    const newWarmupSet: ExerciseTargetSetParams = {
      id: uuidv4(),
      type: 'warmup',
      ...warmpUpExerciseMetrics,
      fieldOrder: warmpUpExerciseMetrics.fieldOrder ?? this.workoutUtilsService.getRepsAndWeightFields()
    };

    // --- START: IMMUTABLE UPDATE LOGIC ---

    // 1. Create a new 'sets' array for the updated exercise.
    //    The new warmup set is placed at the beginning, followed by all existing sets.
    const newSets = [newWarmupSet, ...exerciseToUpdate.sets];

    // 2. Create a new 'exercises' array. Map over the old one.
    const newExercises = routine.exercises.map((exercise, index) => {
      // If this is the exercise we're updating, return a new object for it
      // containing the new 'sets' array.
      if (index === exIndex) {
        return {
          ...exercise,
          sets: newSets
        };
      }
      // Otherwise, return the original, unchanged exercise object.
      return exercise;
    });

    // 3. Update the routine signal with a new routine object that contains
    //    the new 'exercises' array. This is a fully immutable update.
    this.routine.update(routine => {
      if (!routine) return routine;
      return {
        ...routine,
        exercises: newExercises
      };
    });

    // --- FIX: Rebuild performanceInputValues for this exercise, prioritizing userInputs ---
    const exercise = this.routine()?.exercises[exIndex];
    if (exercise) {
      this.performanceInputValues.update(inputs => {
        // Save a copy of the old inputs for this exercise
        const oldInputs: { [key: string]: Partial<ExerciseCurrentExecutionSetParams> } = {};
        Object.keys(inputs).forEach(key => {
          if (key.startsWith(`${exIndex}-`)) {
            oldInputs[key] = { ...inputs[key] };
            delete inputs[key];
          }
        });
        // Rebuild with correct indices, shifting old userInputs by +1
        exercise.sets.forEach((set, setIndex) => {
          const oldKey = `${exIndex}-${setIndex - 1}`;
          if (setIndex === 0) {
            // New warmup set: use its targets only
            inputs[`${exIndex}-0`] = {
              actualReps: set.targetReps,
              actualWeight: set.targetWeight,
              actualDistance: set.targetDistance,
              actualDuration: set.targetDuration,
              actualRest: set.targetRest,
              notes: set.notes,
              tempoLogged: set.targetTempo
            };
          } else if (oldInputs[oldKey]) {
            // Shifted set: use previous userInputs if present, fallback to targets
            inputs[this.getSetOrderId(exIndex, setIndex)] = {
              actualReps: oldInputs[oldKey].actualReps ?? set.targetReps,
              actualWeight: oldInputs[oldKey].actualWeight ?? set.targetWeight,
              actualDistance: oldInputs[oldKey].actualDistance ?? set.targetDistance,
              actualDuration: oldInputs[oldKey].actualDuration ?? set.targetDuration,
              actualRest: oldInputs[oldKey].actualRest ?? set.targetRest,
              notes: oldInputs[oldKey].notes ?? set.notes,
              tempoLogged: oldInputs[oldKey].tempoLogged ?? set.targetTempo
            };
          } else {
            // Fallback: use targets
            inputs[this.getSetOrderId(exIndex, setIndex)] = {
              actualReps: set.targetReps,
              actualWeight: set.targetWeight,
              actualDistance: set.targetDistance,
              actualDuration: set.targetDuration,
              actualRest: set.targetRest,
              notes: set.notes,
              tempoLogged: set.targetTempo
            };
          }
        });
        return { ...inputs };
      });
    }

    // this.toastService.success(`Warm-up set added to ${exercise.exerciseName}`);
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

      exercisesInGroup.forEach(groupEx => {
        const originalGroupExIndex = this.getOriginalExIndex(groupEx.id);
        if (originalGroupExIndex === -1) return;

        const lastSetIndex = groupEx.sets.length > 0 ? groupEx.sets.length - 1 : -1;
        const lastSet = lastSetIndex !== -1 ? groupEx.sets[lastSetIndex] : null;

        // Copy fieldOrder or use default
        const fieldOrder = lastSet?.fieldOrder ? [...lastSet.fieldOrder] : this.workoutUtilsService.getRepsAndWeightFields();

        // Build new set with targets for all metrics in fieldOrder
        const newSet: ExerciseTargetSetParams = {
          id: uuidv4(),
          type: 'standard',
          fieldOrder,
          targetRest: lastSet?.targetRest ?? restToExact(60),
        };

        fieldOrder.forEach(metric => {
          switch (metric) {
            case METRIC.weight:
              newSet.targetWeight = lastSet?.targetWeight ?? weightToExact(10);
              break;
            case METRIC.reps:
              newSet.targetReps = lastSet?.targetReps ?? repsToExact(8);
              break;
            case METRIC.distance:
              newSet.targetDistance = lastSet?.targetDistance ?? distanceToExact(1);
              break;
            case METRIC.duration:
              newSet.targetDuration = lastSet?.targetDuration ?? durationToExact(60);
              break;
            case METRIC.rest:
              newSet.targetRest = lastSet?.targetRest ?? restToExact(60);
              break;
            case METRIC.tempo:
              newSet.targetTempo = lastSet?.targetTempo ?? '';
              break;
          }
        });

        groupEx.sets.push(newSet);
      });

      this.toastService.success(`Round added to ${this.isEmom(exIndex) ? 'EMOM' : 'Superset'}`);

    } else {
      // --- CASE 2: Standard Exercise ---
      const lastSet = triggerExercise.sets.length > 0 ? triggerExercise.sets[triggerExercise.sets.length - 1] : null;
      const fieldOrder = lastSet?.fieldOrder ? [...lastSet.fieldOrder] : this.workoutUtilsService.getRepsAndWeightFields();

      const newSet: ExerciseTargetSetParams = {
        id: uuidv4(),
        type: type,
        fieldOrder,
        targetRest: lastSet?.targetRest ?? restToExact(60),
      };

      fieldOrder.forEach(metric => {
        switch (metric) {
          case METRIC.weight:
            newSet.targetWeight = lastSet?.targetWeight ?? weightToExact(10);
            break;
          case METRIC.reps:
            newSet.targetReps = lastSet?.targetReps ?? repsToExact(8);
            break;
          case METRIC.distance:
            newSet.targetDistance = lastSet?.targetDistance ?? distanceToExact(1);
            break;
          case METRIC.duration:
            newSet.targetDuration = lastSet?.targetDuration ?? durationToExact(60);
            break;
          case METRIC.rest:
            newSet.targetRest = lastSet?.targetRest ?? restToExact(60);
            break;
          case METRIC.tempo:
            newSet.targetTempo = lastSet?.targetTempo ?? '';
            break;
        }
      });

      if (type === 'warmup') {
        newSet.targetReps = repsToExact(12);
        if (lastSet && lastSet.targetWeight !== undefined && lastSet.targetWeight !== null) {
          newSet.targetWeight = weightToExact(parseFloat((getWeightValue(lastSet.targetWeight) / 2).toFixed(1)));
        } else {
          newSet.targetWeight = weightToExact(0);
        }
        triggerExercise.sets.unshift(newSet);
      } else {
        triggerExercise.sets.push(newSet);
      }
      // this.toastService.success(`${type === 'warmup' ? 'Warm-up set' : 'Set'} added to ${triggerExercise.exerciseName}`);
    }

    this.routine.set({ ...routine });
    if (this.expandedExerciseIndex() !== exIndex) {
      this.expandedExerciseIndex.set(exIndex);
    }
    this._prefillPerformanceInputs();
  }

  async removeSet(exIndex: number, setIndex: number): Promise<void> {
    const routine = this.routine();
    if (!routine) return;

    const exercise = routine.exercises[exIndex];

    // --- CASE 1: Removing a Superset Round ---
    if (exercise.supersetId) {
      // Use provided setIndex if valid, otherwise default to last round
      const roundIndexToRemove = (typeof setIndex === 'number' && setIndex >= 0 && setIndex < exercise.sets.length)
        ? setIndex
        : exercise.sets.length - 1;
      const exercisesInGroup = this.getSupersetExercises(exercise.supersetId);

      // Failsafe: if the exercise is somehow the last in a group and has no sets, treat it as an exercise removal.
      if (exercisesInGroup[0]?.sets.length === 1) {
        const confirmLast = await this.alertService.showConfirm(
          this.translate.instant('compactPlayer.alerts.removeLastRoundTitle'),
          this.translate.instant('compactPlayer.alerts.removeLastRoundMessage'),
          this.translate.instant('actionButtons.removeSuperset'), this.translate.instant('common.cancel')
        );
        if (confirmLast?.data) {
          await this.removeExercise(exIndex, true); // This now correctly handles removing the whole group
        }
        return;
      }

      const confirm = await this.alertService.showConfirm(
        this.translate.instant('compactPlayer.alerts.removeRoundTitle'),
        this.translate.instant('compactPlayer.alerts.removeRoundMessage', { roundNumber: roundIndexToRemove + 1 }),
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

      this.toastService.info(this.translate.instant('compactPlayer.toasts.roundRemoved', { roundNumber: roundIndexToRemove + 1 }));
      this.audioService.playSound(AUDIO_TYPES.whoosh);

      return;
    }

    // --- CASE 2: Removing a Standard Set (Logic remains the same as it's already robust) ---
    const newSetIndex = setIndex < 0 ? exercise.sets.length - 1 : setIndex;
    const setToRemove = exercise.sets[newSetIndex];
    const isLastSet = exercise.sets.length <= 1;

    let confirmMessage = this.translate.instant('compactPlayer.alerts.removeSetMessage', { name: exercise.exerciseName });
    if (isLastSet) {
      confirmMessage = this.translate.instant('compactPlayer.alerts.removeLastSetMessage');
    }

    const confirm = await this.alertService.showConfirm(this.translate.instant('compactPlayer.alerts.removeSetTitle'), confirmMessage);
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

    // --- SHIFT performanceInputValues ---
    this.performanceInputValues.update(inputs => {
      // 1. Gather all keys for this exercise
      const keys = Object.keys(inputs)
        .filter(key => key.startsWith(`${exercise.id}-`));
      // 2. Build a new inputs object, shifting down indices after the removed set
      const newInputs: { [key: string]: Partial<ExerciseCurrentExecutionSetParams> } = {};
      exercise.sets.forEach((_, idx) => {
        // For each remaining set, its new index is its position in the array
        const oldIdx = idx >= newSetIndex ? idx + 1 : idx;
        const oldKey = this.getSetOrderId(exIndex, oldIdx);
        const newKey = this.getSetOrderId(exIndex, idx);
        if (inputs[oldKey]) {
          newInputs[newKey] = { ...inputs[oldKey] };
        }
      });
      return { ...inputs, ...newInputs };
    });

    if (exercise.sets.length === 0) {
      this.removeExercise(exIndex, true);
    } else {
      this.routine.set({ ...routine });
      this.toastService.info(`Set removed from ${exercise.exerciseName}`);
      this.audioService.playSound(AUDIO_TYPES.whoosh);
    }
    this._prefillPerformanceInputs();
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

  private async removeExerciseNoPrompt(exIndex: number): Promise<void> {
    const routine = this.routine();
    if (!routine) return;
    const exerciseToRemove = routine.exercises[exIndex];

    const shatterable = this.shatterables.find(dir => dir.el.nativeElement.id === `appShatterable-${exerciseToRemove.id}`);
    if (shatterable) {
      shatterable.shatter();
      // Wait for the animation to finish before removing
      await new Promise(res => setTimeout(res, 350));
    }

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

    // --- Remove all performanceInputValues for this exercise ---
    this.performanceInputValues.update(inputs => {
      const updated = { ...inputs };
      Object.keys(updated).forEach(key => {
        if (key.startsWith(`${exerciseToRemove.id}-`)) {
          delete updated[key];
        }
      });
      return updated;
    });

    this._prefillPerformanceInputs();
    this.toastService.info(`${exerciseToRemove.exerciseName} ${this.translate.instant('common.removed')}`);
    this.audioService.playSound(AUDIO_TYPES.whoosh);
  }



  async removeExercise(exIndex: number, confirmRequest: boolean = false): Promise<void> {
    const routine = this.routine();
    if (!routine) return;

    const exerciseToRemove = routine.exercises[exIndex];
    const supersetId = exerciseToRemove.supersetId;

    // Find the shatterable directive for this exercise card
    const shatterable = this.shatterables.find(dir => dir.el.nativeElement.id === `appShatterable-${exerciseToRemove.id}`);

    // --- CASE 0: Forcely removing an entire Superset group / exercise ---
    if (confirmRequest) {
      if (shatterable) {
        shatterable.shatter();
        // Wait for the animation to finish before removing
        await new Promise(res => setTimeout(res, 350));
      }
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
        this.translate.instant("compactPlayer.alerts.removeSupersetTitle"),
        this.translate.instant("compactPlayer.alerts.removeSupersetMessage", { name: supersetName }),
        this.translate.instant("compactPlayer.alerts.removeSupersetTitle"),
        this.translate.instant("common.cancel")
      );

      if (!confirm?.data && !confirmRequest) return;

      if (shatterable) {
        shatterable.shatter();
        // Wait for the animation to finish before removing
        await new Promise(res => setTimeout(res, 350));
      }

      this.removeSuperset(exIndex);
      return;

    } else {
      // --- CASE 2: Removing a Standard (standalone) Exercise ---
      // Only ask for confirmation if the exercise has at least one logged set
      const isExerciseLogged = this.isExerciseLogged(exIndex);
      const confirmMessage = isExerciseLogged
        ? this.translate.instant('compactPlayer.alerts.removeExerciseLoggedMessage', { name: exerciseToRemove.exerciseName })
        : this.translate.instant('compactPlayer.alerts.removeExerciseMessage', { name: exerciseToRemove.exerciseName });

      const confirm = await this.alertService.showConfirm(this.translate.instant('compactPlayer.alerts.removeExerciseTitle'), confirmMessage);

      if (confirm?.data) {
        this.removeExerciseNoPrompt(exIndex);
      }
    }
  }

  private loadAvailableExercises(): void {
    this.exerciseService.getExercises().pipe(
      take(1),
      // Use switchMap to chain the translation call after fetching the base list
      switchMap(exercises => this.exerciseService.getTranslatedExerciseList(exercises))
    ).subscribe(translatedExercises => {
      // Now, the exercises in the list have their translated names
      this.availableExercises = translatedExercises.filter(ex => !ex.isHidden);
      this.defaultExercises = translatedExercises.filter(ex => !ex.isHidden);
    });
  }

  /**
   * Takes a routine and returns an Observable that emits a new routine
   * with all exercise names translated.
   * @param routine The routine to translate.
   * @returns An Observable of the translated Routine.
   */
  private translateRoutineExercises$(routine: Routine): Observable<Routine> {
    // If there's nothing to translate, return the original routine immediately
    if (!routine || !routine.exercises || routine.exercises.length === 0) {
      return of(routine);
    }

    // Create an array of Observables, each handling one exercise's translation
    const translationObservables = routine.exercises.map(workoutEx =>
      this.exerciseService.getExerciseById(workoutEx.exerciseId).pipe(
        switchMap(baseExercise => {
          // If the base exercise can't be found, proceed with the original workout exercise
          if (!baseExercise) return of(workoutEx);
          // Otherwise, get the translated version
          return this.exerciseService.getTranslatedExercise(baseExercise);
        }),
        map((translatedBaseExercise: any) => {
          // Return a new workout exercise object with the translated name
          // Note: If translation failed, translatedBaseExercise will be the original, so the name remains correct
          return {
            ...workoutEx,
            exerciseName: translatedBaseExercise.name
          };
        }),
        take(1) // Ensure each inner observable completes
      )
    );

    // Use forkJoin to wait for all translations to complete
    return forkJoin(translationObservables).pipe(
      map(translatedExercises => {
        // Return a new routine object containing the array of translated exercises
        return {
          ...routine,
          exercises: translatedExercises
        };
      })
    );
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
      description: '', categories: [EXERCISE_CATEGORY_TYPES.custom], muscleGroups: [], primaryMuscleGroup: undefined, imageUrls: []
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
    // Initialize performanceInputValues for the new exercise's sets
    setTimeout(() => {
      const routine = this.routine();
      if (!routine) return;
      const newIndex = routine.exercises.length - 1;
      const exercise = routine.exercises[newIndex];
      const newInputs = { ...this.performanceInputValues() };
      exercise.sets.forEach((set, setIndex) => {
        const key = this.getSetOrderId(newIndex, setIndex);
        newInputs[key] = {
          actualReps: set.targetReps,
          actualWeight: set.targetWeight,
          actualDistance: set.targetDistance,
          actualDuration: set.targetDuration,
          actualRest: set.targetRest,
          notes: set.notes,
          tempoLogged: set.targetTempo
        };
      });
      this.performanceInputValues.set(newInputs);
      this.expandedExerciseIndex.set(newIndex);
    }, 0);

    this.closeAddExerciseModal();
    // this._prefillPerformanceInputs();
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

        if (oldBaseExercise && newBaseExercise && oldBaseExercise.categories !== newBaseExercise.categories) {
          this.toastService.info(`Switching exercise type. Set data will be reset.`, 3000);
          oldWorkoutExercise.sets.forEach(set => {
            if (newBaseExercise.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.cardio) !== undefined) {
              set.targetWeight = undefined;
              set.targetReps = undefined;
              set.targetDistance = set.targetDistance ?? distanceToExact(1); // Default cardio values
              set.targetDuration = set.targetDuration ?? durationToExact(300);
            } else { // Assuming switch to strength or other non-cardio
              set.targetDistance = undefined;
              set.targetDuration = undefined;
              set.targetWeight = set.targetWeight ?? weightToExact(10); // Default strength values
              set.targetReps = set.targetReps ?? genRepsTypeFromRepsNumber(8);
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
    if (pb.weightLogged != null && getWeightValue(pb.weightLogged) > 0) {
      let value = this.weightUnitPipe.transform(getWeightValue(pb.weightLogged));
      if (pb.repsLogged && repsTypeToReps(pb.repsLogged) > 1) value += ` x ${this.getRepsValue(pb.repsLogged)}`;
      return value || 'N/A';
    }
    if (pb.repsLogged) return `${this.getRepsValue(pb.repsLogged)} reps`;
    if (pb.durationLogged) return `${this.getDurationValue(pb.durationLogged)}s`;
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
    return this.activeExerciseMenuIndex() === exerciseIndex;
  }

  toggleMainSessionActionMenu(event: Event | null) {
    event?.stopPropagation();
    this.mainSessionActionMenuOpened.update(current => current === true ? false : true);
    this.closeExerciseActionMenu();
    this.closeSetActionMenu();
  }

  closeMainSessionActionMenu() {
    this.mainSessionActionMenuOpened.set(false);
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
        ...timerBtn,
        label: this.translate.instant('compactPlayer.rest'),
        overrideCssButtonClass: timerBtn.buttonClass + commonModalButtonClass
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
      case 'timer': this.openManualRestTimer(); break;
    }
  }

  clearRestTimers(): void {
    clearInterval(this.compactRestInterval);
    this.compactRestInterval = null;
    this.restStartTimestamps = {};
    this.lastCompactRestBeepSecond = null;
  }

  async quitWorkout(): Promise<void> {
    const confirmQuit = await this.alertService.showConfirm(this.translate.instant('compactPlayer.alerts.quitTitle'), this.translate.instant('compactPlayer.alerts.quitMessage'));
    if (confirmQuit && confirmQuit.data) {
      this.isSessionConcluded = true;
      this.sessionState.set(SessionState.End);
      this.toggleMainSessionActionMenu(null);
      this.clearRestTimers();
      this.toastService.info(this.translate.instant('compactPlayer.toasts.noSetsLoggedError'), 4000);
      this.router.navigate(['/home']);
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
    // Total planned completions is simply the number of sets.
    return loggedEx.sets.length >= currentExercise.sets.length;
  }


  private isExercisePartiallyLogged(currentExercise: WorkoutExercise): boolean {
    const loggedEx = this.currentWorkoutLog().exercises?.find(le => le.id === currentExercise.id);
    if (!loggedEx || loggedEx.sets.length === 0) return false;
    // Check against the total number of sets.
    const totalPlannedCompletions = currentExercise.sets.length;
    return loggedEx.sets.length > 0 && loggedEx.sets.length < totalPlannedCompletions;
  }

  exerciseActionItemsMap = computed<Map<number, ActionMenuItem[]>>(() => {
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
      const currExerciseInfoBtn = {
        ...exerciseInfoBtn,
        data: { exIndex: exercise.exerciseId },
        overrideCssButtonClass: exerciseInfoBtn.buttonClass + commonModalButtonClass
      };
      const addSectionExerciseBtn = {
        ...sectionExerciseBtn,
        data: { exIndex },
        overrideCssButtonClass: sectionExerciseBtn.buttonClass + commonModalButtonClass
      }
      const currOpenPerformanceInsightsBtn = {
        ...openSessionPerformanceInsightsBtn,
        data: { exIndex },
        overrideCssButtonClass: openSessionPerformanceInsightsBtn.buttonClass + commonModalButtonClass
      };
      const addExerciseNotesBtn: ActionMenuItem = {
        ...exerciseNotesBtn,
        data: { exIndex },
        overrideCssButtonClass: exerciseNotesBtn.buttonClass + commonModalButtonClass
      };

      const baseAddSetRoundBtn = !this.isSuperSet(exIndex) ? addSetToExerciseBtn : { ...addRoundToExerciseBtn, actionKey: 'addSet' };
      // const baseRemoveSetRoundBtn = !this.isSuperSet(exIndex) ? removeSetFromExerciseBtn : { ...removeRoundFromExerciseBtn, actionKey: 'removeSet' };
      // const addSetRoundBtn = {
      //   ...baseAddSetRoundBtn,
      //   data: { exIndex },
      //   overrideCssButtonClass: baseAddSetRoundBtn.buttonClass + commonModalButtonClass
      // };
      // const removeSetRoundBtn = {
      //   ...baseRemoveSetRoundBtn,
      //   data: { exIndex },
      //   overrideCssButtonClass: baseRemoveSetRoundBtn.buttonClass + commonModalButtonClass
      // };

      const addWarmupSetBtnItem = {
        ...addWarmupSetBtn,
        data: { exIndex },
        overrideCssButtonClass: addWarmupSetBtn.buttonClass + commonModalButtonClass
      };

      const removeExerciseBtnItem = {
        ...removeExerciseBtn,
        label: this.isSuperSet(exIndex) ? 'actionButtons.removeSuperset' : removeExerciseBtn.label,
        data: { exIndex },
        overrideCssButtonClass: removeExerciseBtn.buttonClass + commonModalButtonClass
      } as ActionMenuItem;

      let actionsArray: ActionMenuItem[] = [
        currExerciseInfoBtn,
        currOpenPerformanceInsightsBtn,
        addExerciseNotesBtn,
        addSectionExerciseBtn
      ];

      if (!this.isExercisePartiallyLogged(exercise) && !this.isExerciseFullyLogged(exercise) && !this.isSuperSet(exIndex)) {
        actionsArray.push(addWarmupSetBtnItem as ActionMenuItem);
        actionsArray.push(currSwitchExerciseBtn as ActionMenuItem);
      }

      actionsArray = [...actionsArray,
      { isDivider: true },
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
          // Find all unique supersetIds in the routine
          const supersetIds = Array.from(new Set(routine.exercises.filter(ex => ex.supersetId).map(ex => ex.supersetId)));

          // Find if there is AT LEAST ONE superset group where NO exercises have any logged sets
          let hasUnloggedSupersetGroup = false;

          supersetIds.forEach(supersetId => {
            const groupExercises = routine.exercises.filter(ex => ex.supersetId === supersetId);
            // Check if ALL exercises in this group have NO logged sets
            const allNotLogged = groupExercises.every(supersetEx => {
              const exIdx = routine.exercises.indexOf(supersetEx);
              return !this.isExerciseLogged(exIdx);
            });

            if (allNotLogged) {
              hasUnloggedSupersetGroup = true;
            }
          });

          // Add the button ONLY ONCE if there's at least one unlogged superset group
          if (hasUnloggedSupersetGroup) {
            actionsArray.push({
              ...addToSuperSetBtn,
              data: { exIndex },
              overrideCssButtonClass: addToSuperSetBtn.buttonClass + commonModalButtonClass
            });
          }

          // Add "Create Superset" button if there are at least 2 non-superset exercises
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

  private async startRestPeriod(duration: number, completedExIndex: number, completedSetIndex: number): Promise<void> {
    this.playerSubState.set(PlayerSubState.Resting);
    this.restTimerMode.set(TIMER_MODES.timer);
    this.restDuration.set(duration);
    this.restTimerMainText.set(this.translate.instant('compactPlayer.rest'));
    this.restTimerNextUpText.set('Loading next set...');
    this.restTimerNextSetDetails.set(null);

    if (this.getRestTimerMode() === this.restTimerModeEnum.Fullscreen) {
      this.isRestTimerVisible.set(true);
    }

    if (this.getRestTimerMode() === this.restTimerModeEnum.Compact) {
      const restKey = this.getSupersetRestKey(completedExIndex, completedSetIndex);
      this.restStartTimestamps[restKey] = Date.now();
      this.lastCompactRestBeepSecond = null;
      if (this.compactRestInterval) clearInterval(this.compactRestInterval);
      this.compactRestInterval = setInterval(() => {
        const remaining = this.restTimerRemainingForSet(completedExIndex, completedSetIndex);
        // Play countdown sound for last 5 seconds
        const countDownSoundEnabled: boolean = !!(this.appSettingsService.enableTimerCountdownSound() && this.appSettingsService.getSettings().countdownSoundSeconds);
        const countDownSoundNumber: number = countDownSoundEnabled ? this.appSettingsService.getSettings().countdownSoundSeconds : 0;

        if (remaining > 0 && countDownSoundNumber && remaining <= countDownSoundNumber && remaining !== this.lastCompactRestBeepSecond) {
          this.playCountdownSound(remaining);
          this.lastCompactRestBeepSecond = remaining;
        }
        // Play end sound and clear interval when done
        if (remaining === 0) {
          this.playEndSound();
          clearInterval(this.compactRestInterval);
          this.compactRestInterval = null;
          this.lastCompactRestBeepSecond = null;
        }
      }, 250); // Check 4 times per second for responsiveness
    }

    const nextStep = await this.peekNextStepInfo(completedExIndex, completedSetIndex);

    if (!nextStep.exercise || !nextStep.details) {
      this.restTimerNextUpText.set("Workout Complete!");
      this.restTimerNextSetDetails.set(null);
      return;
    }

    const { exercise, details: plannedSet, historicalSet } = nextStep;
    const nextExIndex = this.getOriginalExIndex(exercise.id);
    const nextSetIndex = exercise.sets.indexOf(plannedSet);

    // --- CASE 1: The next item is part of a Superset (No changes here) ---
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
        const displayIndex = this.getExerciseDisplayIndex(originalExIndex, true);
        const exName = groupEx.exerciseName;
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
      // =================== START OF MODIFICATION ===================
      // --- CASE 2: The next item is a Standard Exercise ---
      const line1 = exercise.exerciseName;
      const setIndex = exercise.sets.indexOf(plannedSet);
      const line2 = `Set ${setIndex + 1}/${exercise.sets.length}`;

      // --- Historical (Volta precedente) ---
      let historicalLine = '';
      if (historicalSet) {
        const parts: string[] = [];
        const weightValue = this.workoutUtilsService.getWeightValue(historicalSet.weightLogged);
        const repsValue = this.workoutUtilsService.getRepsValue(historicalSet.repsLogged);
        if (weightValue != undefined && repsValue != undefined) {
          const weight = this.weightUnitPipe.transform(weightValue);
          parts.push(`${weight} x ${repsValue} reps`);
        } else if (repsValue != undefined) {
          parts.push(`${repsValue} reps`);
        }
        const durationValue = this.workoutUtilsService.getDurationValue(historicalSet.durationLogged);
        if (durationValue != undefined && durationValue > 0) {
          parts.push(this.formatSecondsToTime(durationValue));
        }
        const distanceValue = this.workoutUtilsService.getDistanceValue(historicalSet.distanceLogged);
        if (distanceValue != undefined && distanceValue > 0) {
          parts.push(`${distanceValue} ${this.unitsService.getDistanceUnitSuffix()}`);
        }
        if (parts.length > 0) {
          // Add date if available
          let dateStr = '';
          if (historicalSet?.timestamp) {
            const date = new Date(historicalSet.timestamp);
            dateStr = ` (${date.toLocaleDateString()})`;
          }
          historicalLine = `${this.translate.instant('restTimer.lastTime')}: ${parts.join(' | ')}${dateStr}`;
        }
      }

      // --- Next Set Target ---
      const targetParts: string[] = [];
      const repsDisplay = this.workoutUtilsService.getSetTargetDisplay(plannedSet, METRIC.reps);
      const weightDisplay = this.workoutUtilsService.getSetWeightDisplay(plannedSet, exercise);
      if (repsDisplay && repsDisplay !== '0' && weightDisplay !== this.translate.instant('workoutService.display.weightNotApplicable')) {
        targetParts.push(`${weightDisplay} x ${repsDisplay} reps`);
      }
      const durationDisplay = this.workoutUtilsService.getSetTargetDisplay(plannedSet, METRIC.duration);
      if (durationDisplay && durationDisplay !== '0' && this.formatSecondsToTime(durationDisplay) !== '00:00') {
        targetParts.push(`<span class="inline-flex items-center">${this.formatSecondsToTime(durationDisplay)} mm:ss</span>`);
      }
      const distanceDisplay = this.workoutUtilsService.getSetTargetDisplay(plannedSet, METRIC.distance);
      if (distanceDisplay && distanceDisplay !== '0') {
        targetParts.push(`${distanceDisplay} ${this.unitsService.getDistanceUnitSuffix()}`);
      }
      let targetLine = '';
      if (targetParts.length > 0) {
        targetLine = `${this.translate.instant('restTimer.target')}: ${targetParts.join(' | ')}`;
      } else {
        targetLine = this.translate.instant('restTimer.noTarget');
      }

      // --- Compose the final text ---
      // let nextUpHtml = `<div><span class="font-bold">${this.translate.instant('restTimer.nextUp')}</span></div>`;
      let nextUpHtml = ``;
      nextUpHtml += `<div class="font-semibold">${line1}</div>`;
      nextUpHtml += `<div class="text-base opacity-80">${line2}</div>`;
      nextUpHtml += `<div class="text-base font-bold">${targetLine}</div>`;
      if (historicalLine) {
        nextUpHtml += `<div class="text-base font-normal opacity-80">${historicalLine}</div>`;
      }

      this.restTimerNextUpText.set(nextUpHtml);
      // =================== END OF MODIFICATION ===================
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
   * Advances the UI state after a set/round is finished or skipped.
   * It collapses the completed item, and expands and scrolls to the next one.
   * It now correctly handles advancing between rounds within a superset.
   */
  private handleAutoExpandNextExercise(): void {
    return;

    // const completedExIndex = this.lastExerciseIndex();
    // const completedSetIndex = this.lastExerciseSetIndex(); // This is the roundIndex for supersets
    // const routine = this.routine();

    // if (completedExIndex < 0 || completedSetIndex < 0 || !routine) return;

    // const completedExercise = routine.exercises[completedExIndex];

    // // --- EXECUTE THE STATE CHANGE ---

    // // BRANCH 1: The completed item was part of a SUPERSET
    // if (completedExercise.supersetId) {
    //   const isLastRound = completedSetIndex >= completedExercise.sets.length - 1;

    //   if (isLastRound) {
    //     // ACTION 1A: It was the last round. Advance to the next exercise card.
    //     const nextExIndex = this.findNextExerciseIndex(completedExIndex);
    //     if (nextExIndex !== -1) {
    //       this.toggleExerciseExpansion(nextExIndex);
    //     } else {
    //       // End of workout, collapse everything.
    //       this.expandedExerciseIndex.set(null);
    //     }
    //   } else {
    //     // ACTION 1B: Not the last round. Advance to the next round in the same superset.
    //     const nextRoundIndex = completedSetIndex + 1;

    //     // We need the index of the exercise that STARTS the superset group to manage the expanded state.
    //     const firstExerciseInSupersetIndex = routine.exercises.findIndex(ex => ex.supersetId === completedExercise.supersetId);

    //     this.expandedRounds.update(currentSet => {
    //       const newSet = new Set(currentSet);
    //       newSet.delete(`${firstExerciseInSupersetIndex}-${completedSetIndex}`); // Collapse the old one
    //       newSet.add(`${firstExerciseInSupersetIndex}-${nextRoundIndex}`);    // Expand the new one
    //       return newSet;
    //     });

    //     // Scroll the new round into view.
    //     this.scrollToRound(firstExerciseInSupersetIndex, nextRoundIndex);
    //   }
    // }
    // // BRANCH 2: The completed item was a STANDARD EXERCISE
    // else {
    //   const isLastSet = completedSetIndex >= completedExercise.sets.length - 1;

    //   if (isLastSet) {
    //     // ACTION 2A: It was the last set. Advance to the next exercise card.
    //     const nextExIndex = this.findNextExerciseIndex(completedExIndex);
    //     if (nextExIndex !== -1) {
    //       this.toggleExerciseExpansion(nextExIndex);
    //     } else {
    //       this.expandedExerciseIndex.set(null);
    //     }
    //   } else {
    //     // ACTION 2B: The next set is in the SAME exercise.
    //     const nextSetIndex = completedSetIndex + 1;

    //     this.expandedSets.update(currentSet => {
    //       const newSet = new Set(currentSet);
    //       newSet.delete(`${completedExIndex}-${completedSetIndex}`); // Collapse the old one
    //       newSet.add(`${completedExIndex}-${nextSetIndex}`);       // Expand the new one
    //       return newSet;
    //     });

    //     this.scrollToSet(completedExIndex, nextSetIndex);
    //   }
    // }
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

          // This logic scrolled too much
          // if (setElement && headerElement) {
          //   const headerHeight = headerElement.offsetHeight;
          //   const elementTopPosition = setElement.getBoundingClientRect().top + window.scrollY;
          //   const scrollTopPosition = elementTopPosition - headerHeight - 15; // 15px top padding
          //   window.scrollTo({ top: scrollTopPosition, behavior: 'smooth' });
          // }
          this.scrollCurrentElementIntoView(undefined, setIndex);
        });
      });
    });
  }

  scrollCurrentElementIntoView(exIndex: number | undefined, setIndex: number | undefined): void {
    const exerciseSelector = `[data-exercise-index="${exIndex}"]`;
    const setSelector = `[data-set-index="${setIndex}"]`;
    let element = null;
    if (setIndex !== undefined) {
      element = document.querySelector(setSelector) as HTMLElement | null;
    } else {
      element = document.querySelector(exerciseSelector) as HTMLElement | null;
    }
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
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
        setLog.restLogged = restToExact(actualRestTime);
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

    if (this.isManualRestActive && this.restTimerMode() === 'timer') {
      this.isManualRestActive = false;
      return;
    }

    // Standard post-set logic
    this.updateLogWithRestTime(this.restDuration());
    this.handleAutoExpandNextExercise();
  }

  handleRestTimerSkipped(timeSkipped: number): void {
    this.isRestTimerVisible.set(false);

    if (this.isManualRestActive && this.restTimerMode() === 'timer') {
      this.isManualRestActive = false;
      return;
    }

    // Standard post-set logic
    const actualRest = Math.ceil(this.restDuration() - timeSkipped);
    this.updateLogWithRestTime(actualRest);
    this.handleAutoExpandNextExercise();
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
      performanceInputValues: this.performanceInputValues(),
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
      this.alignRestStartTimestampsFromLog();
    }

    if (state.performanceInputValues) {
      this.performanceInputValues.set(state.performanceInputValues);
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
          // this.toastService.info(this.translate.instant('compactPlayer.toasts.pausedDiscarded'), 3000);
          return false;
        }
      }
    }
    return false;
  }

  goBack(): void {
    // The exercises array might not exist on the partial log initially.
    // Check for its existence and then check its length to satisfy TypeScript's strict checks.
    this.clearRestTimers();
    if (this.currentWorkoutLog().exercises && this.currentWorkoutLog().exercises!.length > 0 && this.sessionState() === SessionState.Playing) {
      this.savePausedSessionState();
      this.router.navigate(['/home']);
    } else {
      this.router.navigate(['/home']);
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
    const loggedExercisesToExclude = this.currentWorkoutLog().exercises || [];

    const updatedRoutine = await this.workoutService.addToSuperset(
      routine,
      exIndex,
      loggedExercisesToExclude,
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
      this._prefillPerformanceInputs();
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

  getExerciseDisplayIndex(exIndex: number, expanded: boolean = false): string {
    const exercises = this.routine()?.exercises;
    if (!exercises) return `${exIndex + 1}`;
    const currentEx = exercises[exIndex];

    if (currentEx.supersetId) {
      // Find all exercises in the superset, sorted by supersetOrder
      const exercisesInGroup = exercises
        .filter(ex => ex.supersetId === currentEx.supersetId)
        .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0));

      // Find the block number for this superset group
      const supersetBlockMap = new Map<string, number>();
      let blockNumber = 1;
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        if (ex.supersetId) {
          if (!supersetBlockMap.has(ex.supersetId)) {
            supersetBlockMap.set(ex.supersetId, blockNumber++);
          }
        } else {
          blockNumber++;
        }
      }
      const block = supersetBlockMap.get(currentEx.supersetId) ?? 1;

      if (expanded) {
        // Show only the index for this exercise (e.g. 1A, 1B, ...)
        const idx = currentEx.supersetOrder ?? exercisesInGroup.findIndex(e => e.id === currentEx.id);
        return `${block}${String.fromCharCode(65 + idx)}`;
      } else {
        // Show all indexes for the group (e.g. 1A/1B/1C)
        return exercisesInGroup.map((ex, idx) => `${block}${String.fromCharCode(65 + idx)}`).join('/');
      }
    } else {
      // Standard exercise: just return its block number
      let block = 1;
      for (let i = 0; i < exIndex; i++) {
        const ex = exercises[i];
        if (ex.supersetId) {
          if (i === exercises.findIndex(e => e.supersetId === ex.supersetId)) {
            block++;
          }
        } else {
          block++;
        }
      }
      return `${block}`;
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

    const isNextUp = !isCompleted && setIndex === firstIncompleteIndex && !isExpanded;
    // A set is "focused" if it's the first incomplete one AND the user has expanded it.
    const isFocused = isExpanded && setIndex === firstIncompleteIndex;

    // Define classes based on priority: focused > completed > warmup > default
    if (isFocused) {
      return {
        // 'rounded-xl shadow-md transition-all duration-300': true,
        'rounded-xl shadow-md': true,
        'relative ring-2 ring-yellow-400 dark:ring-yellow-500 z-10': true, // Focus style
        'bg-white dark:bg-gray-800': set.type !== 'warmup', // Default background when focused
        'relative ring-2 ring-blue-400 dark:ring-blue-500 z-10 bg-blue-100 dark:bg-blue-700/80': set.type === 'warmup'
      };
    }

    // "Next up" ring (not expanded)
    if (isNextUp) {
      return {
        // 'rounded-xl shadow-sm transition-all duration-300 pb-2': true,
        'rounded-xl shadow-sm': true,
        // 'rounded-xl shadow-sm pb-2': true,
        'relative ring-2 ring-yellow-400 dark:ring-yellow-500 z-10': true, // Next up ring
        'bg-white dark:bg-gray-800': set.type !== 'warmup',
        'border-2 border-blue-400 dark:border-blue-500 bg-blue-100 dark:bg-blue-700/80': set.type === 'warmup',
      };
    }

    if (isCompleted) {
      return {
        // 'rounded-xl shadow-sm transition-all duration-300 pb-2': true,
        'rounded-xl shadow-sm': true,
        // 'rounded-xl shadow-sm pb-2': true,
        'bg-green-300 dark:bg-green-700 border border-green-300 dark:border-green-800': true, // Subtle completed style
      };
    }

    // Default style for a standard, non-focused, non-completed set
    return {
      // 'rounded-xl shadow-sm transition-all duration-300 pb-2': true,
      'rounded-xl shadow-sm transition-all duration-300': true,
      'bg-white dark:bg-gray-800': set.type !== 'warmup',
      'border-2 border-blue-400 dark:border-blue-500 bg-blue-100 dark:bg-blue-700/80': set.type === 'warmup', // Subtle warmup style
    };
  }

  protected isStandardSuperSet(exIndex: number): boolean {
    return this.isSuperSet(exIndex) && !this.isEmom(exIndex);
  }

  getExerciseClasses(exercise: WorkoutExercise, index: number): any {
    const isStandardSuperSet = this.isSuperSet(index) && !this.isEmom(index);
    const isEmomSet = this.isEmom(index);
    const isStandardSet = !isStandardSuperSet && !isEmomSet;
    const order = exercise.supersetOrder ?? 0;
    const isExpanded = this.expandedExerciseIndex() === index;

    // --- Base classes that apply to almost all states ---
    const classes: any = {
      // Side borders always apply to superset items

      'border-l-2 border-r-2 rounded-md': isStandardSuperSet || isEmomSet,
      'border-primary': isStandardSuperSet,
      'border-teal-400': isEmomSet,
      // Standalone exercises always get these classes
      'mb-4 rounded-md': isStandardSet,
    };

    // --- State-Specific Logic ---
    if (isStandardSet && isExpanded) {
      classes['mb-8'] = true;
    }
    if ((isStandardSuperSet || isEmomSet) && isExpanded) {
      // STATE 1: THE EXERCISE IS EXPANDED
      // It becomes a self-contained, highlighted block.
      classes['rounded-md'] = true;       // Round all corners
      classes['border-t-2'] = true;       // Ensure it has a top border
      classes['border-b-2'] = true;       // Ensure it has a bottom border
      classes['mb-8'] = true;             // Add margin to visually detach it from the item below

    } else {
      // STATE 2: THE EXERCISE IS COLLAPSED (OR STANDALONE)
      // Apply the normal start, middle, and end classes for visual grouping.
      classes['border-t-2 rounded-t-md'] = this.isSupersetStart(index);
      classes['border-b-0 rounded-none'] = this.isSupersetMiddle(index) && !this.isSupersetEnd(index); // This correctly removes bottom border for middle items
      classes['border-b-2'] = this.isSuperSet(index);
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
    //  Total rounds for a superset is its number of sets. For standard, it's 1.
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
            targetReps: loggedSet.repsLogged,
            targetWeight: loggedSet.weightLogged,
            targetDuration: loggedSet.durationLogged,
            targetRest: loggedSet.restLogged,
            targetTempo: loggedSet.tempoLogged,
            notes: loggedSet.notes,
            type: loggedSet.type as any,
            fieldOrder: loggedSet.fieldOrder
          };
        })
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
    return this.workoutUtilsService.getSetTargetDisplay(setForDisplay, field);
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

  getOriginalExIndexOLD(exerciseId: string): number {
    return this.routine()?.exercises.findIndex(ex => ex.id === exerciseId) ?? -1;
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

  getEmomState(exIndex: number, roundIndex: number): { status: TimerSetState, remainingTime: number } {
    // 1. FIRST, check the source of truth: the workout log.
    // If the log shows this round is completed, ALWAYS return a 'completed' state.
    // This is a PURE READ operation.
    if (this.isRoundCompleted(exIndex, roundIndex)) {
      return { status: TimerSetState.Completed, remainingTime: 0 };
    }

    // 2. If the round is not completed, THEN read the current timer state from the signal.
    // This handles the 'idle', 'running', and 'paused' states for active timers.
    const key = `${exIndex}-${roundIndex}`;
    const allStates = this.emomState();
    return allStates[key] || { status: TimerSetState.Idle, remainingTime: this.routine()?.exercises[exIndex].emomTimeSeconds ?? 60 };
  }

  handleEmomAction(exIndex: number, roundIndex: number): void {
    const key = `${exIndex}-${roundIndex}`;
    const state = this.getEmomState(exIndex, roundIndex);

    switch (state.status) {
      case TimerSetState.Idle:
      case TimerSetState.Paused:
        this.startEmomTimer(exIndex, roundIndex, key);
        break;
      case TimerSetState.Running:
        this.pauseEmomTimer(key);
        break;
      case TimerSetState.Completed:
        // Do nothing if already completed
        break;
    }
  }

  private playCountdownSound(currentRemaining: number): void {
    if (
      this.appSettingsService.enableTimerCountdownSound() &&
      currentRemaining <= this.appSettingsService.countdownSoundSeconds()
      && currentRemaining !== this.lastBeepSecond
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
        states[key] = { status: TimerSetState.Running, remainingTime: duration };
      } else {
        states[key].status = TimerSetState.Running;
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

        // it's being called inside startRestTimer
        // this.playEndSound();
        if (hasNextRound) {
          // 1. Expand the next round and collapse the one we just finished
          this.expandedRounds.update(currentSet => {
            const newSet = new Set(currentSet);
            // collapse previous/current round
            newSet.delete(`${exIndex}-${roundIndex}`);

            // expand next round
            // newSet.add(`${exIndex}-${nextRoundIndex}`);
            return newSet;
          });

          // 2. Start the next timer
          this.handleEmomAction(exIndex, nextRoundIndex);

          // 3. Scroll the next round into view after the DOM updates
          runInInjectionContext(this.injector, () => {
            if (this.isDestroyed) {
              return;
            }
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
          });
        }
      }
    });
  }

  private pauseEmomTimer(key: string): void {
    this.emomTimerSub?.unsubscribe();
    this.emomState.update(states => {
      if (states[key]) {
        states[key].status = TimerSetState.Paused;
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
      states[key] = { ...states[key], status: TimerSetState.Completed, remainingTime: 0 };
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
    const exercises = this.routine()?.exercises;
    if (!exercises) return '';

    // Find all exercises in the superset, sorted by supersetOrder
    const exercisesInGroup = exercises
      .filter(ex => ex.supersetId === supersetId)
      .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0));

    // Find the block number for this superset group
    const supersetBlockMap = new Map<string, number>();
    let blockNumber = 1;
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      if (ex.supersetId) {
        if (!supersetBlockMap.has(ex.supersetId)) {
          supersetBlockMap.set(ex.supersetId, blockNumber++);
        }
      } else {
        blockNumber++;
      }
    }
    const block = supersetBlockMap.get(supersetId) ?? 1;

    // Compose "1A - KB Press\n1B - Squat\n1C - Abs crunches"
    return exercisesInGroup
      .map((ex, idx) => `${block}${String.fromCharCode(65 + idx)} - ${ex.exerciseName}`)
      .join('\n');
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
      const distance = setForDisplay.targetDistance ?? distanceToExact(0);
      const duration = setForDisplay.targetDuration ?? durationToExact(0);
      let parts: string[] = [];
      if (getDistanceValue(distance) > 0) parts.push(`${distance} ${this.unitsService.getDistanceUnitSuffix()}`);
      if (getDurationValue(duration) > 0) parts.push(this.formatSecondsToTime(getDurationValue(duration)));
      return parts.length > 0 ? `Target: ${parts.join(' for ')}` : 'No target set';
    } else {
      // Use the pre-calculated set to get the display values for reps and weight
      const repsDisplay = this.workoutUtilsService.getSetTargetDisplay(setForDisplay, METRIC.reps);
      const weightDisplay = this.workoutUtilsService.getSetWeightDisplay(setForDisplay, exercise);

      return repsDisplay ? `Target: ${weightDisplay} x ${repsDisplay} reps` : 'No target set';
    }
  }

  /** Checks if a specific round is currently expanded. */
  isRoundExpanded(exIndex: number, roundIndex: number): boolean {
    const key = `${exIndex}-${roundIndex}`;
    return this.expandedRounds().has(key);
  }

  /** Toggles the expanded/collapsed state of a specific round. */
  toggleRoundExpansion(exIndex: number, roundIndex: number, event: Event): void {
    if (event) {
      const target = event.target as HTMLElement;
      if (target.closest('button') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }


      // Ignore clicks inside the #exerciseCard
      if (target.closest('#exerciseCard')) {
        return;
      }

    }
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
  getInitialInputValue(exIndex: number, setIndex: number, field: 'notes'): string {
    const routine = this.routine();
    if (!routine) return '';

    const key = this.getSetOrderId(exIndex, setIndex);;

    const userInputs = this.performanceInputValues()[key] || {};
    const loggedSet = this.getLoggedSet(exIndex, setIndex);

    // PRIORITY 1: Show already logged data if it exists. (COMPLETED SET)
    if (loggedSet) {
      switch (field) {
        case 'notes': return loggedSet.notes ?? '';
      }
    }

    // PRIORITY 2: Show what the user has typed for this specific field if it exists.
    if (userInputs) {
      if (userInputs.notes) {
        return userInputs.notes ?? '';
      }
    }
    return '';

  }

  updateSetData(exIndex: number, setIndex: number, roundIndex: number, field: 'notes' | METRIC.tempo, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const key = this.getSetOrderId(exIndex, setIndex);;

    this.performanceInputValues.update(currentInputs => {
      const newInputs = { ...currentInputs };
      if (!newInputs[key]) {
        newInputs[key] = {};
      }
      if (field === 'notes') {
        newInputs[key].notes = value;
      } else if (field === METRIC.tempo) {
        newInputs[key].tempoLogged = value === '' ? undefined : value;
      }
      return newInputs;
    });
  }

  /**
  * On completion, this method now builds the log entry by combining three sources:
  * 1. The user's input (`performanceInputValues`).
  * 2. The routine's plan (as a fallback for performed values).
  * 3. The original snapshot (for target values).
  */
  toggleSetCompletion(exercise: WorkoutExercise, set: ExerciseTargetSetParams, exIndex: number, setIndex: number, roundIndex: number, triggerAnimation: boolean = true): void {
    const log = this.currentWorkoutLog();
    if (!log.exercises) log.exercises = [];

    let exerciseLog = log.exercises.find(e => e.id === exercise.id);
    const wasCompleted = !!this.getLoggedSet(exIndex, setIndex, roundIndex);
    const plannedSetId = this.getPlannedSetId(exercise, set, roundIndex);

    const key = this.getSetOrderId(exIndex, setIndex);;

    if (triggerAnimation) {
      const key = this.getSetOrderId(exIndex, setIndex);;
      this.toggledSetAnimation.set({ key, type: 'set', state: wasCompleted ? 'incompleted' : 'completed' });
    }

    if (wasCompleted) {
      this.audioService.playSound(AUDIO_TYPES.untoggle);
      // Un-logging logic is now updated to restore values to the input state
      if (exerciseLog) {
        const setIndexInLog = exerciseLog.sets.findIndex(s => s.plannedSetId === plannedSetId);
        if (setIndexInLog > -1) {
          const unloggedSet = exerciseLog.sets[setIndexInLog];
          // Restore the unlogged values back into the temporary input state
          this.performanceInputValues.update(inputs => {
            inputs[key] = {
              actualReps: set.targetReps,
              actualWeight: set.targetWeight,
              actualDuration: set.targetDuration,
              actualDistance: set.targetDistance,
              actualRest: set.targetRest,
              notes: unloggedSet.notes
            };
            return { ...inputs };
          });
          exerciseLog.sets.splice(setIndexInLog, 1);
        }
      }

      // --- Reset the compact rest timer for this set ---
      if (this.restStartTimestamps[this.getSetOrderId(exIndex, setIndex)]) {
        delete this.restStartTimestamps[this.getSetOrderId(exIndex, setIndex)];
      }
      if (this.compactRestInterval) {
        clearInterval(this.compactRestInterval);
        this.compactRestInterval = null;
        this.lastCompactRestBeepSecond = null;
      }

    } else {

      const userInputs = this.performanceInputValues()[key] || {};
      const plannedSet = this.routine()!.exercises[exIndex].sets[setIndex];
      // Check if the planned set is a textual rep type (AMRAP, MAX, etc.)
      if (this.isTextReps(exIndex, setIndex)) {
        // If it is, the user's *actual* logged value must be an exact number.
        // It cannot still be AMRAP/MAX when they try to complete the set.
        if (!userInputs.actualReps || userInputs.actualReps.type !== RepsTargetType.exact) {
          this.toastService.info(
            this.translate.instant('compactPlayer.toasts.enterNumericRepsError', {
              repType: repsTargetAsString(plannedSet.targetReps)
            }),
            4000, // Duration 0 makes it sticky until dismissed
            this.translate.instant('common.error')
          );
          // Vibrate to give haptic feedback for the error
          this.workoutService.vibrate();
          return; // Abort the completion
        }
      }

      // check if is text weight as well
      const isBodyweightTarget = plannedSet.targetWeight && plannedSet.targetWeight.type === WeightTargetType.bodyweight;
      if (this.isTextWeight(exIndex, setIndex)) {
        // Allow 0 if the planned target was bodyweight
        if (!isBodyweightTarget) {
          this.toastService.info(
            this.translate.instant('compactPlayer.toasts.enterNumericWeightError', {
              weightType: this.workoutUtilsService.weightTargetAsString(plannedSet.targetWeight)
            }),
            6000,
            this.translate.instant('common.error')
          );
          this.workoutService.vibrate();
          return;
        }
        if (isBodyweightTarget && (!userInputs.actualWeight || getWeightValue(userInputs.actualWeight) === 0)) {
          userInputs.actualWeight = { type: WeightTargetType.bodyweight } as WeightTarget;
        }
      }
      if (plannedSet.targetWeight && !isBodyweightTarget && (!userInputs.actualWeight || getWeightValue(userInputs.actualWeight) === 0)) {
        this.toastService.info(
          this.translate.instant('compactPlayer.toasts.enterNumericWeightError', {
            weightType: this.workoutUtilsService.weightTargetAsString(plannedSet.targetWeight)
          }),
          6000,
          this.translate.instant('common.error')
        );
        this.workoutService.vibrate();
        return;
      }

      this.audioService.playSound(AUDIO_TYPES.correct);
      // Logging logic
      if (!exerciseLog) {
        exerciseLog = { id: exercise.id, exerciseId: exercise.exerciseId, exerciseName: exercise.exerciseName!, sets: [], supersetId: exercise.supersetId, supersetOrder: exercise.supersetOrder, supersetType: exercise.supersetType };
        log.exercises.push(exerciseLog);
      }

      // Give priority to the set from the original routine, otherwise use the newly added exercise set
      const originalSet = this.originalRoutineSnapshot()?.exercises[exIndex]?.sets[setIndex] || set;
      const targetSetValues: ExerciseTargetExecutionSetParams = mapExerciseTargetSetParamsToExerciseExecutedSetParams(set);

      const timerState = this.setTimerState()[key];
      // retrieve actual duration from timer if available considering target
      // Calculate actual duration performed if timerState and targetSetValues are available
      let actualDurationLogged: number | null = null;
      const userDefinedDuration = userInputs.actualDuration;

      // PRIORITY 1: If a timer was ACTIVELY running or paused when the set was completed.
      // This captures the elapsed time accurately.
      if (timerState && timerState.remainingTime) {
        if (userDefinedDuration !== undefined && userDefinedDuration !== null) {
          actualDurationLogged = getDurationValue(userDefinedDuration) - timerState.remainingTime;
        } else {
          actualDurationLogged = (getDurationValue(targetSetValues.targetDuration) ?? 0) - timerState.remainingTime;
        }
      } else {
        // PRIORITY 2: If no timer was active, check for a manual user input.
        if (userDefinedDuration !== undefined && userDefinedDuration !== null) {
          actualDurationLogged = getDurationValue(userDefinedDuration);
        }
      }

      const userDefinedRest = userInputs.actualRest;

      if (userDefinedRest !== undefined && userDefinedRest !== null) {
        set.targetRest = userDefinedRest;
      }


      if (!actualDurationLogged || actualDurationLogged <= 0) {
        actualDurationLogged = getDurationValue(userDefinedDuration) ?? targetSetValues.targetDuration ?? 0;
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
        plannedSetId: plannedSetId,
        exerciseId: exercise.exerciseId,
        type: set.type,
        fieldOrder: set.fieldOrder,
        repsLogged: userInputs.actualReps ?? set.targetReps ?? undefined,
        weightLogged: userInputs.actualWeight ?? set.targetWeight ?? undefined,
        durationLogged: userInputs.actualDuration ?? set.targetDuration ?? undefined,
        distanceLogged: userInputs.actualDistance ?? set.targetDistance ?? undefined,
        restLogged: userInputs.actualRest ?? set.targetRest ?? undefined,
        notes: userInputs.notes ?? set.notes,
        tempoLogged: userInputs.tempoLogged ?? set.targetTempo,
        timestamp: new Date().toISOString(),
        // Target values: Always come from the original, static snapshot
        targetRest: originalSet?.targetRest ?? targetSetValues?.targetRest ?? undefined,
        targetReps: originalSet?.targetReps ?? targetSetValues?.targetReps ?? undefined,
        targetWeight: originalSet?.targetWeight ?? targetSetValues?.targetWeight ?? undefined,
        targetDuration: originalSet?.targetDuration ?? targetSetValues?.targetDuration ?? undefined,
        targetDistance: originalSet?.targetDistance ?? targetSetValues?.targetDistance ?? undefined,
        workoutLogId: uuidv4(), // to differ from Simple set,
      };
      exerciseLog.sets.push(newLoggedSet);

      // // Clean up the temporary input state for this set after logging
      // this.performanceInputValues.update(inputs => {
      //   delete inputs[key];
      //   return { ...inputs };
      // });
    }

    // --- (The rest of the method for state updates, saving, and timers remains the same) ---
    this.currentWorkoutLog.set({ ...log });
    this.savePausedSessionState();
    this.lastExerciseIndex.set(exIndex);
    this.lastExerciseSetIndex.set(setIndex);
    this.workoutService.vibrate();

    if (!wasCompleted) {
      const shouldStartRest = set.targetRest && getRestValue(set.targetRest) > 0 &&
        (!this.isSuperSet(exIndex) || (this.isSuperSet(exIndex) && this.isEndOfLastSupersetExercise(exIndex, setIndex)));

      if (shouldStartRest && set.targetRest) {
        this.lastLoggedSetForRestUpdate = this.getLoggedSet(exIndex, setIndex, roundIndex) ?? null;
        setTimeout(() => {
          // Add this line:
          if (this.getRestTimerMode() === this.restTimerModeEnum.Compact) {
            const restKey = this.getSupersetRestKey(exIndex, setIndex);
            this.restStartTimestamps[restKey] = Date.now();
          }
          this.startRestPeriod(getRestValue(set.targetRest), exIndex, setIndex);
        }, 300);
      }
    }
  }

  /**
   * Checks all sets for an exercise to determine which data columns should be visible.
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

    return this.workoutUtilsService.getVisibleSetColumns(routine, exIndex, setIndex);
  }

  public getVisibleSetColumnsCountForGrid(exIndex: number, setIndex: number): number {
    let cols = this.getVisibleSetColumns(exIndex, setIndex);
    if (this.isEmom(exIndex)) {
      // in case of emom REST is usually not available so it must be incremented by 1
      cols = {
        ...cols,
        [METRIC.rest]: true
      }
    }
    return Object.values(cols).filter(v => v).length;
  }

  public getFieldsForSet(exIndex: number, setIndex: number, restExcluded?: boolean): { visible: string[], hidden: string[] } {
    const routine = this.routine();
    if (!routine) return this.workoutUtilsService.defaultHiddenFields();
    // Delegate to the existing service method
    const result = this.workoutUtilsService.getFieldsForSet(routine, exIndex, setIndex);
    if (restExcluded) {
      result.visible = result.visible.filter(field => field !== METRIC.rest)
    }
    return result;
  }


  public canAddField(exIndex: number, setIndex: number): boolean {
    const fields = this.getFieldsForSet(exIndex, setIndex);
    // Show the button if there are fields that can be added and we are not at the max of 4.
    return fields.hidden.length > 0 && fields.visible.length < this.workoutUtilsService.getDefaultFields().length;
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

    const oldFields = this.getFieldsForSet(exIndex, setIndex).visible.filter(field => Object.values(METRIC).includes(field as METRIC));
    const updatedRoutine = await this.workoutUtilsService.promptRemoveField(currentRoutine, exIndex, setIndex, true);

    if (updatedRoutine) {
      this.routine.set({ ...updatedRoutine });

      // Find the removed metric
      const newFields = this.workoutUtilsService.getFieldsForSet(updatedRoutine, exIndex, setIndex).visible;
      const removedField = oldFields.find(f => f as METRIC && !newFields.includes(f as METRIC));
      if (removedField) {
        // Remove target and actual
        const set = updatedRoutine.exercises[exIndex].sets[setIndex];
        switch (removedField) {
          case METRIC.reps: set.targetReps = undefined; break;
          case METRIC.weight: set.targetWeight = undefined; break;
          case METRIC.duration: set.targetDuration = undefined; break;
          case METRIC.distance: set.targetDistance = undefined; break;
          case METRIC.rest: set.targetRest = undefined; break;
        }
        // Remove from performanceInputValues
        this.setPerformanceInputValue(exIndex, setIndex, removedField as METRIC, undefined);
      }

      this._prefillPerformanceInputs();
    }
  }


  public async promptAddField(exIndex: number, setIndex: number): Promise<void> {
    const currentRoutine = this.routine();
    if (!currentRoutine) return;

    const updatedRoutine = await this.workoutUtilsService.promptAddField(currentRoutine, exIndex, setIndex, true);

    if (updatedRoutine) {
      this.routine.set(updatedRoutine);

      // Find the added metric
      const oldFields = this.getFieldsForSet(exIndex, setIndex).visible;
      const newFields = this.workoutUtilsService.getFieldsForSet(updatedRoutine, exIndex, setIndex).visible;
      const addedField = newFields.find(f => !oldFields.includes(f));
      if (addedField) {
        // Set default value for target and actual
        const set = updatedRoutine.exercises[exIndex].sets[setIndex];
        let defaultValue: any;
        switch (addedField) {
          case METRIC.reps: defaultValue = repsToExact(8); set.targetReps = defaultValue; break;
          case METRIC.weight: defaultValue = weightToExact(10); set.targetWeight = defaultValue; break;
          case METRIC.duration: defaultValue = durationToExact(60); set.targetDuration = defaultValue; break;
          case METRIC.distance: defaultValue = distanceToExact(1); set.targetDistance = defaultValue; break;
          case METRIC.rest: defaultValue = restToExact(60); set.targetRest = defaultValue; break;
        }
        // Update performanceInputValues
        this.setPerformanceInputValue(exIndex, setIndex, addedField as METRIC, defaultValue);
      }

      this._prefillPerformanceInputs();
      this.scrollToSet(exIndex, setIndex);
      // this.toggleMetricsSection(exIndex, setIndex);
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
        case METRIC.rest: setToUpdate.targetRest = undefined; break;
        case METRIC.tempo: setToUpdate.targetTempo = undefined; break;
      }
      return { ...r };
    });

    // 2. Update the workout log to remove the performed value, if it exists for that set
    this.currentWorkoutLog.update(log => {
      const exerciseLog = log.exercises?.find(e => e.id === exercise.id);
      if (exerciseLog) {
        // For supersets, we need to find the correct round
        const targetLoggedSetId = this.getPlannedSetId(exercise, set, setIndex);
        const loggedSet = exerciseLog.sets.find(s => s.plannedSetId === targetLoggedSetId);

        if (loggedSet) {
          switch (fieldToRemove) {
            case METRIC.weight: loggedSet.weightLogged = undefined; break;
            case METRIC.reps: loggedSet.repsLogged = undefined; break;
            case METRIC.distance: loggedSet.distanceLogged = undefined; break;
            case METRIC.duration: loggedSet.durationLogged = undefined; break;
            case METRIC.rest: loggedSet.restLogged = undefined; break;
            case METRIC.tempo: loggedSet.tempoLogged = undefined; break;
          }
        }
      }
      return { ...log };
    });

    this.toastService.info(`'${fieldToRemove}' field removed from set #${setIndex + 1}.`);
  }

  isSetWarmup(exIndex: number, setIndex: number): boolean {
    const routine = this.routine();
    if (!routine) return false;
    const exercise = routine.exercises[exIndex];
    if (!exercise || !exercise.sets || exercise.sets.length === 0) return false;
    const set = exercise.sets[setIndex];
    if (!set || !set.type) return false;
    return set.type === 'warmup';
  }


  isSetExpanded(exIndex: number, setIndex: number): boolean {
    const key = this.getSetOrderId(exIndex, setIndex);;
    return this.expandedSets().has(key);
  }

  // +++ ADD THIS METHOD: Toggles the expanded/collapsed state of a specific set +++
  toggleSetExpansion(exIndex: number, setIndex: number, event: Event): void {
    if (event) {
      const target = event.target as HTMLElement;
      if (target.closest('button') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }


      // Ignore clicks inside the #exerciseCard
      if (target.closest('#exerciseCard')) {
        return;
      }

    }
    event.stopPropagation(); // Prevent the main exercise card from toggling
    const key = this.getSetOrderId(exIndex, setIndex);;

    this.expandedSets.update(currentSet => {
      const newSet = new Set(currentSet); // Create a new instance for signal change detection
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
        this.scrollToSet(exIndex, setIndex);
      }
      return newSet;
    });
    this.closeSetActionMenu();
  }

  // +++ ADD THIS METHOD: Gets a summary of the set for the collapsed view +++
  getSetSummary(exIndex: number, setIndex: number): string {
    const routine = this.routine();
    if (!routine) return '';
    const exercise = routine.exercises[exIndex];
    const plannedSet = exercise.sets[setIndex];
    const loggedSet = this.getLoggedSet(exIndex, setIndex);
    const key = this.getSetOrderId(exIndex, setIndex);
    const userInputs = this.performanceInputValues()[key] || {};

    // Priority: userInputs > loggedSet > plannedSet
    const weight = userInputs.actualWeight ?? loggedSet?.weightLogged ?? plannedSet.targetWeight;
    const reps = userInputs.actualReps ?? loggedSet?.repsLogged ?? plannedSet.targetReps;
    const distance = userInputs.actualDistance ?? loggedSet?.distanceLogged ?? plannedSet.targetDistance;
    const duration = userInputs.actualDuration ?? loggedSet?.durationLogged ?? plannedSet.targetDuration;
    const rest = userInputs.actualRest ?? loggedSet?.restLogged ?? plannedSet.targetRest;
    const tempo = userInputs.tempoLogged ?? loggedSet?.tempoLogged ?? plannedSet.targetTempo;

    let parts: string[] = [];

    // Reps & Weight
    if (
      reps !== undefined && reps !== null &&
      weight !== undefined && weight !== null
    ) {
      const repsType: RepsTargetType = reps.type;
      let repsStr = '';
      if (repsType === RepsTargetType.exact || repsType === RepsTargetType.range) {
        repsStr = `${repsTargetAsString(reps)} reps`;
      } else if (repsType === RepsTargetType.max || repsType === RepsTargetType.amrap) {
        repsStr = `${repsType.toUpperCase()} reps`;
      }
      let weightStr = '';
      if (getWeightValue(weight) > 0) {
        weightStr = this.weightUnitPipe.transform(getWeightValue(weight)) ?? '';
      } else if (
        weight &&
        weight.type === WeightTargetType.bodyweight
      ) {
        weightStr = 'BW';
      }
      if (repsStr && weightStr) {
        parts.push(`${repsStr} @ ${weightStr}`);
      } else if (repsStr) {
        parts.push(repsStr);
      } else if (weightStr) {
        parts.push(weightStr);
      }
    } else {
      // Fallback for reps or weight alone
      if (weight !== undefined && weight !== null && getWeightValue(weight) > 0) {
        parts.push(`${this.weightUnitPipe.transform(getWeightValue(weight))}`);
      }
      if (weight && getWeightValue(weight) === 0) {
        parts.push('BW');
      }
      if (reps !== undefined && reps !== null) {
        const repsType: RepsTargetType = reps.type;
        if (repsType === RepsTargetType.exact || repsType === RepsTargetType.range) {
          parts.push(`${repsTypeToReps(reps)} reps`);
        } else if (repsType === RepsTargetType.max || repsType === RepsTargetType.amrap) {
          parts.push(`${repsType.toUpperCase()} reps`);
        }
      }
    }

    // Distance
    if (distance !== undefined && distance !== null && getDistanceValue(distance) > 0) {
      parts.push(`${getDistanceValue(distance)} ${this.unitsService.getDistanceUnitSuffix()}`);
    }

    // Duration
    if (duration !== undefined && duration !== null && getDurationValue(duration) > 0) {
      parts.push(this.formatSecondsToTime(getDurationValue(duration)));
    }

    // Rest
    if (rest !== undefined && rest !== null && getRestValue(rest) > 0) {
      parts.push(`Rest: ${this.formatSecondsToTime(getRestValue(rest))}`);
    }

    // Tempo
    if (tempo) {
      parts.push(`T: ${tempo}`);
    }

    if (parts.length === 0) return 'Tap to log...';
    return parts.join(' | ');
  }

  getSupersetRoundSummary(exIndex: number, roundIndex: number): string {
    const routine = this.routine();
    if (!routine) return '';
    const exercise = routine.exercises[exIndex];
    if (!exercise.supersetId) return '';

    const exercisesInGroup = this.getSupersetExercises(exercise.supersetId);

    // For each exercise in the superset, get the summary for the set at roundIndex (metrics only)
    const parts = exercisesInGroup.map((ex) => {
      const exIdx = this.getOriginalExIndex(ex.id);
      if (exIdx === -1) return '';
      // Use the existing getSetSummary for each set in the round
      // Remove the exercise name from the summary
      return this.getSetSummary(exIdx, roundIndex);
    }).filter(Boolean);

    return parts.join(' | ');
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
    return !!(!exercise?.supersetId && set && (getDurationValue(set.targetDuration) ?? 0) > 0);
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
        'rounded-xl p-2 transition-all duration-300': true,
        'ring-2 ring-yellow-400 dark:ring-yellow-500 z-10': true,
        'bg-gray-100 dark:bg-gray-900': true
      };
    }

    if (isCompleted) {
      return {
        'rounded-xl p-2 transition-all duration-300': true,
        'bg-green-300 dark:bg-green-700 border border-green-300 dark:border-green-800': true,
      };
    }

    if (isExpanded) {
      return {
        'rounded-xl p-2 py-1 transition-all duration-300': true,
        'bg-gray-100 dark:bg-gray-900': true
      }
    }

    return {
      'rounded-xl p-2 py-1 transition-all duration-300': true,
      'bg-gray-100 dark:bg-gray-800': true,
    };
  }

  /**
     * Gets the current timer state for a specific standard set.
     * It prioritizes the user's input for the duration if it differs from the planned target.
     */
  getSetTimerState(exIndex: number, setIndex: number): { status: TimerSetState, remainingTime: number } {
    if (this.isSetCompleted(exIndex, setIndex)) {
      return { status: TimerSetState.Completed, remainingTime: 0 };
    }
    const key = this.getSetOrderId(exIndex, setIndex);
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
      duration = getDurationValue(userInputs.actualDuration);
    } else {
      // 2. Fall back to the planned target duration from the routine.
      duration = getDurationValue(this.routine()?.exercises[exIndex].sets[setIndex].targetDuration ?? durationToExact(0));
    }

    // Return the idle state with the correctly prioritized duration.
    return { status: TimerSetState.Idle, remainingTime: duration };
  }

  /**
   * Central handler for the timed set button clicks (play/pause/resume).
   */
  handleSetTimerAction(exIndex: number, setIndex: number, event: Event): void {
    event.stopPropagation();
    const key = this.getSetOrderId(exIndex, setIndex);
    const state = this.getSetTimerState(exIndex, setIndex);

    switch (state.status) {
      case TimerSetState.Idle:
      case TimerSetState.Paused:
        this.startSetTimer(exIndex, setIndex, key);
        break;
      case TimerSetState.Running:
        this.pauseSetTimer(key);
        break;
    }
  }

  /**
   * Starts or resumes the timer for a specific standard set.
   * It now uses getSetTimerState to ensure it starts with the correct duration,
   * respecting any user input.
   */
  private startSetTimer(exIndex: number, setIndex: number, key: string): void {
    this.lastBeepSecond = null;
    const state = this.getSetTimerState(exIndex, setIndex);
    const duration = state.remainingTime;

    this.audioService.playSound(AUDIO_TYPES.referee);
    this.setTimerState.update(states => {
      if (!states[key]) {
        states[key] = { status: TimerSetState.Running, remainingTime: duration };
      } else {
        states[key].status = TimerSetState.Running;
      }
      return { ...states };
    });

    this.setTimerSub?.unsubscribe();

    this.setTimerSub = timer(1000, 1000).subscribe(() => {
      const currentRemaining = this.setTimerState()[key]?.remainingTime;

      if (currentRemaining !== undefined && currentRemaining > 0) {
        // Decrement first
        this.setTimerState.update(states => {
          states[key].remainingTime--;
          return { ...states };
        });

        // Play sound for the NEW remaining time (after decrement)
        const newRemaining = this.setTimerState()[key]?.remainingTime;
        // +++ Only play countdown sound if newRemaining > 0 +++
        if (newRemaining > 0) {
          this.playCountdownSound(newRemaining);
        } else {
          this.playEndSound();
          const exercise = this.routine()!.exercises[exIndex];
          const set = exercise.sets[setIndex];
          if (!this.isSetCompleted(exIndex, setIndex)) {
            // this.toastService.success(`Set #${setIndex + 1} complete!`);
            setTimeout(() => {
              this.toggleSetCompletion(exercise, set, exIndex, setIndex, 0);
              this.setTimerSub?.unsubscribe();
              this.setTimerState.update(states => {
                delete states[key];
                return { ...states };
              });
            }, 150);
          }
        }
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
        states[key].status = TimerSetState.Paused;
      }
      return { ...states };
    });
  }

  /**
   * UI helper to get the text for the timed set button.
   */
  getSetTimerButtonText(exIndex: number, setIndex: number): string {
    const state = this.getSetTimerState(exIndex, setIndex);
    const textMap = { [TimerSetState.Idle]: 'START', [TimerSetState.Running]: 'PAUSE', [TimerSetState.Paused]: 'RESUME', [TimerSetState.Completed]: 'DONE' };
    return textMap[state.status];
  }

  /**
   * UI helper to get the icon for the timed set button.
   */
  getSetTimerButtonIcon(exIndex: number, setIndex: number): string {
    const state = this.getSetTimerState(exIndex, setIndex);
    const iconMap = { [TimerSetState.Idle]: 'play', [TimerSetState.Running]: 'pause', [TimerSetState.Paused]: 'play', [TimerSetState.Completed]: 'check' };
    return iconMap[state.status];
  }

  /**
   * UI helper to get the CSS class for the timed set button.
   */
  getSetTimerButtonClass(exIndex: number, setIndex: number): string {
    const state = this.getSetTimerState(exIndex, setIndex);
    const classMap = {
      [TimerSetState.Idle]: 'bg-teal-500 hover:bg-teal-600',
      [TimerSetState.Running]: 'bg-yellow-500 hover:bg-yellow-600',
      [TimerSetState.Paused]: 'bg-teal-500 hover:bg-teal-600 animate-pulse',
      [TimerSetState.Completed]: 'bg-green-500 hover:bg-green-600',
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

    const previousInputs = this.performanceInputValues();
    const initialValues: { [key: string]: Partial<ExerciseCurrentExecutionSetParams> } = {};

    routine.exercises.forEach((exercise, exIndex) => {
      exercise.sets.forEach((plannedSet, setIndex) => {
        const key = this.getSetOrderId(exIndex, setIndex);
        const prev = previousInputs[key] || {};

        initialValues[key] = {
          actualReps: prev.actualReps ?? plannedSet.targetReps ?? undefined,
          actualWeight: prev.actualWeight ?? plannedSet.targetWeight ?? undefined,
          actualDistance: prev.actualDistance ?? plannedSet.targetDistance ?? undefined,
          actualDuration: prev.actualDuration ?? plannedSet.targetDuration ?? undefined,
          actualRest: prev.actualRest ?? plannedSet.targetRest ?? undefined,
          notes: prev.notes ?? plannedSet.notes ?? undefined,
          tempoLogged: prev.tempoLogged ?? plannedSet.targetTempo ?? undefined,
        };
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
    const key = this.getSetOrderId(exIndex, setIndex);
    const inputKey = `${key}-${field}`;
    this.invalidInputs.update(s => { s.delete(inputKey); return s; });

    // Determine step size
    let step: number;
    switch (field) {
      case METRIC.weight: step = settings.weightStep || 1; break;
      case METRIC.duration: step = settings.durationStep || 5; break;
      case METRIC.rest: step = settings.restStep || 5; break;
      case METRIC.distance: step = settings.distanceStep || 0.1; break;
      default: step = 1; // Default for reps
    }

    // Get the current value using the new getter
    let currentValue = this.getPerformanceInputValue(exIndex, setIndex, field);
    let newValue: AnyTarget | string;

    // Handle different metric types
    if (field === METRIC.duration) {
      // Parse time string or object to seconds
      currentValue = typeof currentValue === 'string' ? this.parseTimeToSeconds(currentValue) : getDurationValue(currentValue) || 0;
      newValue = durationToExact(Math.max(0, parseFloat((currentValue + step).toFixed(2))));
    } else if (field === METRIC.rest) {
      // Parse time string or object to seconds
      currentValue = typeof currentValue === 'string' ? this.parseTimeToSeconds(currentValue) : getRestValue(currentValue) || 0;
      newValue = restToExact(Math.max(0, parseFloat((currentValue + step).toFixed(2))));
    } else if (field === METRIC.weight) {
      currentValue = getWeightValue(currentValue) || 0;
      newValue = weightToExact(Math.max(0, parseFloat((currentValue + step).toFixed(2))));
    } else if (field === METRIC.distance) {
      currentValue = getDistanceValue(currentValue) || 0;
      newValue = distanceToExact(Math.max(0, parseFloat((currentValue + step).toFixed(2))));
    } else if (field === METRIC.reps) {
      currentValue = repsTypeToReps(currentValue) || 0;
      newValue = repsToExact(Math.max(0, parseInt((currentValue + step).toFixed(0), 10)));
    } else {
      newValue = '';
    }

    // Use your setter to update and validate
    this.setPerformanceInputValue(exIndex, setIndex, field, newValue);
    if (field === METRIC.duration) {
      const durationValue = typeof newValue === 'number' ? newValue : getDurationValue(newValue as DurationTarget);
      this.resetTimerIfActive(exIndex, setIndex, durationValue);
    }
    if (field === METRIC.rest) {
      if (this.getRestTimerMode() === this.restTimerModeEnum.Compact) {
        const restKey = this.getSupersetRestKey(exIndex, setIndex);
        this.restStartTimestamps[restKey] = 0;
      }
    }
  }

  private decrementValue(exIndex: number, setIndex: number, field: METRIC): void {
    const settings = this.appSettingsService.getSettings();
    const key = this.getSetOrderId(exIndex, setIndex);
    const inputKey = `${key}-${field}`;
    this.invalidInputs.update(s => { s.delete(inputKey); return s; });

    // Determine step size
    let step: number;
    switch (field) {
      case METRIC.weight: step = settings.weightStep || 1; break;
      case METRIC.duration: step = settings.durationStep || 5; break;
      case METRIC.rest: step = settings.restStep || 5; break;
      case METRIC.distance: step = settings.distanceStep || 0.1; break;
      default: step = 1; // Default for reps
    }

    // Get the current value using the new getter
    let currentValue = this.getPerformanceInputValue(exIndex, setIndex, field);
    let newValue: AnyTarget | string;

    // Handle different metric types
    if (field === METRIC.duration) {
      currentValue = typeof currentValue === 'string' ? this.parseTimeToSeconds(currentValue) : getDurationValue(currentValue) || 0;
      newValue = durationToExact(Math.max(0, parseFloat((currentValue - step).toFixed(2))));
    } else if (field === METRIC.rest) {
      currentValue = typeof currentValue === 'string' ? this.parseTimeToSeconds(currentValue) : getRestValue(currentValue) || 0;
      newValue = restToExact(Math.max(0, parseFloat((currentValue - step).toFixed(2))));
    } else if (field === METRIC.weight) {
      currentValue = getWeightValue(currentValue) || 0;
      newValue = weightToExact(Math.max(0, parseFloat((currentValue - step).toFixed(2))));
    } else if (field === METRIC.distance) {
      currentValue = getDistanceValue(currentValue) || 0;
      newValue = distanceToExact(Math.max(0, parseFloat((currentValue - step).toFixed(2))));
    } else if (field === METRIC.reps) {
      currentValue = repsTypeToReps(currentValue) || 0;
      newValue = repsToExact(Math.max(0, parseInt((currentValue - step).toFixed(0), 10)));
    } else {
      newValue = '';
    }

    // Use your setter to update and validate
    this.setPerformanceInputValue(exIndex, setIndex, field, newValue);
    if (field === METRIC.duration) {
      const durationValue = typeof newValue === 'number' ? newValue : getDurationValue(newValue as DurationTarget);
      this.resetTimerIfActive(exIndex, setIndex, durationValue);
    }
    if (field === METRIC.rest) {
      if (this.getRestTimerMode() === this.restTimerModeEnum.Compact) {
        const restKey = this.getSupersetRestKey(exIndex, setIndex);
        this.restStartTimestamps[restKey] = 0;
      }
    }
  }

  protected resetTimerIfActive(exIndex: number, setIndex: number, newDuration?: number): void {
    const key = this.getSetOrderId(exIndex, setIndex);
    const timerState = this.setTimerState()[key];

    // Only reset if timer exists and is running or paused
    if (timerState && (timerState.status === TimerSetState.Running || timerState.status === TimerSetState.Paused)) {
      // If newDuration is not provided, fall back to planned targetDuration
      let durationToSet = newDuration;
      if (durationToSet === undefined) {
        const set = this.routine()?.exercises[exIndex]?.sets[setIndex];
        durationToSet = set ? getDurationValue(set.targetDuration) : 0;
      }

      // Update the timer state with the new duration
      this.setTimerState.update(states => {
        states[key] = {
          ...states[key],
          remainingTime: durationToSet
        };
        return { ...states };
      });

      // If it was running, restart the timer with the new duration
      if (timerState.status === TimerSetState.Running) {
        this.setTimerSub?.unsubscribe();
        this.startSetTimer(exIndex, setIndex, key);
      }
    }
  }

  private isManualRestActive = false;
  restTimerMode = signal<TIMER_MODES>(TIMER_MODES.timer);

  async openManualRestTimer(): Promise<void> {
    // First, close the menu it was triggered from.
    // this.toggleMainSessionActionMenu(null);

    // Step 1: Ask the user which type of timer they want.
    const choice = await this.alertService.showConfirmationDialog(
      this.translate.instant('compactPlayer.alerts.chooseTimerTitle'),
      this.translate.instant('compactPlayer.alerts.chooseTimerMessage'),
      [
        { text: this.translate.instant('compactPlayer.actions.countdown'), role: 'confirm', data: TIMER_MODES.timer, icon: 'duration' },
        { text: this.translate.instant('compactPlayer.actions.stopwatch'), role: 'confirm', data: TIMER_MODES.stopwatch, icon: 'stopwatch' }
      ]
    );

    if (!choice || !choice.data) {
      return; // User cancelled the selection
    }

    // Step 2: Branch logic based on the user's choice.
    if (choice.data === TIMER_MODES.timer) {
      // User chose COUNTDOWN, so we prompt for a duration.
      const result = await this.alertService.showPromptDialog(
        this.translate.instant('compactPlayer.alerts.manualRestTitle'),
        this.translate.instant('compactPlayer.alerts.manualRestMessage'),
        [{
          name: 'duration',
          type: 'number',
          placeholder: 'Seconds',
          value: 60,
          attributes: { min: '1', required: true }
        }] as AlertInput[],
        this.translate.instant('compactPlayer.alerts.startRest'),
        this.translate.instant('common.cancel')
      );

      if (result && result['duration']) {
        const duration = Number(result['duration']);
        if (duration > 0) {
          this.isManualRestActive = true;
          this.restTimerMode.set(TIMER_MODES.timer); // Set mode to countdown
          this.restDuration.set(duration);
          this.restTimerMainText.set(this.translate.instant('compactPlayer.manualRest'));
          this.restTimerNextUpText.set(this.translate.instant('compactPlayer.takeABreak'));
          this.isRestTimerVisible.set(true);
        }
      }
    } else if (choice.data === TIMER_MODES.stopwatch) {
      // User chose STOPWATCH, so we start it immediately.
      this.isManualRestActive = true;
      this.restTimerMode.set(TIMER_MODES.stopwatch); // Set mode to stopwatch
      this.restTimerMainText.set(this.translate.instant('compactPlayer.manualRest'));
      this.restTimerNextUpText.set(this.translate.instant('compactPlayer.takeABreak'));
      this.isRestTimerVisible.set(true);
    }
  }

  handleStopwatchStopped(): void {
    this.isRestTimerVisible.set(false);

    if (this.isManualRestActive) {
      this.isManualRestActive = false;
      // Optional: You could show a toast here like "Rest complete: 1:30"
    }
  }

  availableSetTypes: { value: string, label: string }[] = [
    { value: SET_TYPE.standard, label: this.translate.instant('workoutBuilder.setTypes.standard') },
    { value: SET_TYPE.warmup, label: this.translate.instant('workoutBuilder.setTypes.warmup') },
    { value: SET_TYPE.superset, label: this.translate.instant('workoutBuilder.setTypes.superset') },
    { value: SET_TYPE.amrap, label: this.translate.instant('workoutBuilder.setTypes.amrap') },
    { value: SET_TYPE.dropset, label: this.translate.instant('workoutBuilder.setTypes.dropset') },
    { value: SET_TYPE.failure, label: this.translate.instant('workoutBuilder.setTypes.failure') },
    { value: SET_TYPE.myorep, label: this.translate.instant('workoutBuilder.setTypes.myorep') },
    { value: SET_TYPE.restpause, label: this.translate.instant('workoutBuilder.setTypes.restpause') },
    { value: SET_TYPE.custom, label: this.translate.instant('workoutBuilder.setTypes.custom') }
  ];

  getSetType(exIndex: number, setIndex: number): SET_TYPE | undefined {
    const routine = this.routine();
    if (!routine) {
      return undefined;
    }
    const exercise = routine.exercises[exIndex];
    if (!exercise || !exercise.sets || exercise.sets.length === 0) {
      return undefined;
    }
    const set = exercise.sets[setIndex];
    if (!set || !set.type) {
      return undefined;
    }
    return set.type as SET_TYPE;
  }

  updateSetType(exIndex: number, setIndex: number, newType: SET_TYPE): void {
    this.routine.update(routine => {
      if (!routine) return routine;

      const exercise = routine.exercises[exIndex];
      if (exercise && exercise.sets[setIndex]) {
        exercise.sets[setIndex].type = newType;
        this.toastService.info(
          this.translate.instant('compactPlayer.toasts.setTypeChanged', {
            setNumber: setIndex + 1
          })
        );
      }

      return { ...routine };
    });
  }

  private checkSetExistance(exIndex: number, setIndex: number): boolean {
    const routine = this.routine();
    if (!routine) return false;
    const exercise = routine.exercises[exIndex];
    if (!exercise || !exercise.sets || exercise.sets.length === 0) return false;
    const set = exercise.sets[setIndex];
    return !!set;
  }

  isRestModalVisible = signal(false);
  activeRestModalContext = signal<{ exIndex: number, setIndex: number } | null>(null);
  openRestModal(exIndex: number, setIndex: number, event: Event): void {
    event.stopPropagation();
    this.activeRestModalContext.set({ exIndex, setIndex });
    this.isRestModalVisible.set(true);
  }

  closeRestModal(): void {
    this.isRestModalVisible.set(false);
    this.activeRestModalContext.set(null); // Clear context on close
  }

  protected isGhostFieldVisible(exIndex: number, setIndex: number, fieldOrder?: METRIC[],): boolean {
    const visibleFields: METRIC[] | undefined = this.getSetFieldOrderNoRest(exIndex, setIndex);
    if (!visibleFields) return false;
    return !!(!this.isSetCompleted(exIndex, setIndex) && this.canAddField(exIndex, setIndex) && (visibleFields.length % 2 === 1 && visibleFields.length > 1));
    // return !!(this.isEditableMode() && !this.isSuperSet(exIndex) && fieldOrder && fieldOrder.length !== undefined && ((fieldOrder.length <= 1) || (fieldOrder.length > 2 && fieldOrder.length % 2 == 1)));
  }

  protected getSetFieldOrder(exIndex: number, setIndex: number): METRIC[] | undefined {
    const routine = this.routine();
    if (!routine || !routine.exercises || !routine.exercises.length) return undefined;
    if (!routine.exercises[exIndex] || !routine.exercises[exIndex].sets || !routine.exercises[exIndex].sets.length) return undefined;
    return routine.exercises[exIndex].sets[setIndex].fieldOrder;
  }

  protected getSetFieldOrderNoRest(exIndex: number, setIndex: number): METRIC[] | undefined {
    const setFieldOrder = this.getSetFieldOrder(exIndex, setIndex);
    return setFieldOrder ? setFieldOrder.filter(field => field !== METRIC.rest) : undefined;
  }

  protected getExerciseSetsLength(exIndex: number): number {
    const routine = this.routine();
    if (!routine || !routine.exercises || !routine.exercises.length) return 0;
    return (routine.exercises[exIndex]?.sets?.length ?? 0);
  }


  // Tracks which exercise's "Set All" panel is currently expanded.
  expandedSetAllPanel = signal<number | null>(null);

  // Signals to hold the temporary values from the "Set All" input fields.
  repsToSetForAll = signal<number | null>(null);
  weightToSetForAll = signal<number | null>(null);
  durationToSetForAll = signal<number | null>(null);
  distanceToSetForAll = signal<number | null>(null);
  restToSetForAll = signal<number | null>(null);
  tempoToSetForAll = signal<string | null>(null);
  invalidInputs = signal<Set<string>>(new Set());

  /**
* Toggles the visibility of the "Set All" collapsible panel for a given exercise.
* @param exIndex The index of the exercise.
* @param event The mouse event to stop it from propagating and collapsing the card.
*/
  toggleSetAllPanel(exIndex: number, event: Event): void {
    event.stopPropagation();
    this.expandedSetAllPanel.update(current => (current === exIndex ? null : exIndex));
  }

  /**
   * Checks all sets within an exercise to determine which data columns should be visible in the UI.
   * A column is considered visible if at least one set has a target value for that metric.
   * @param exerciseControl The FormGroup for the exercise.
   * @returns An object with boolean flags for each potential column (reps, weight, etc.).
   */
  public getVisibleColumnsForExercise(exIndex: number): { [key: string]: boolean } {
    const routine = this.routine();
    if (!routine) return {};
    return this.workoutUtilsService.getVisibleExerciseColumns(routine, exIndex);
  }

  /**
 * Applies the values entered in the "Set All" panel to every set of a specific exercise.
 * If the exercise is part of a superset, the values are applied to all sets (rounds)
 * for ALL exercises within that superset group.
 * This now updates ALL sets, including logged ones.
 * @param exIndex The index of the exercise where the action was triggered.
 */
  applyToAllSets(exIndex: number): void {
    const routine = this.routine();
    if (!routine) return;

    // Helper to sanitize and validate numbers (no negatives, no NaN)
    function sanitizeNumber(val: any, step: number, allowDecimals: boolean = false): number | null {
      if (val === null || val === undefined) return null;
      let num = Number(val);
      if (isNaN(num)) return null;
      num = Math.abs(num); // Always positive

      if (allowDecimals) {
        return Math.round(num * 100) / 100;
      } else {
        return Math.round(num / step) * step;
      }
    }

    // 1. Gather values to apply
    const reps = sanitizeNumber(this.repsToSetForAll(), this.repsStep);
    const weight = sanitizeNumber(this.weightToSetForAll(), this.weightStep, true);
    const duration = sanitizeNumber(this.durationToSetForAll(), this.durationStep);
    const distance = this.distanceToSetForAll();
    const rest = sanitizeNumber(this.restToSetForAll(), this.restStep);
    const tempo = this.tempoToSetForAll() !== null && this.tempoToSetForAll()!.trim() !== '' ? this.tempoToSetForAll()!.trim() : null;

    // 2. Build a list of metrics to apply
    const metricsToApply: { metric: METRIC, value: any }[] = [];
    if (reps !== null) metricsToApply.push({ metric: METRIC.reps, value: repsToExact(reps) });
    if (weight !== null) metricsToApply.push({ metric: METRIC.weight, value: weightToExact(weight) });
    if (duration !== null) metricsToApply.push({ metric: METRIC.duration, value: durationToExact(duration) });
    if (distance !== null) metricsToApply.push({ metric: METRIC.distance, value: distanceToExact(distance) });
    if (rest !== null) metricsToApply.push({ metric: METRIC.rest, value: restToExact(rest) });
    if (tempo !== null) metricsToApply.push({ metric: METRIC.tempo, value: tempo });

    if (metricsToApply.length === 0) {
      this.toastService.info("No values entered to apply.");
      return;
    }

    // 3. Identify all target exercises (either a single exercise or all in a superset)
    const clickedExercise = routine.exercises[exIndex];
    const targetExercises = clickedExercise.supersetId
      ? this.getSupersetExercises(clickedExercise.supersetId)
      : [clickedExercise];

    let updatedSetsCount = 0;

    // 4. Update the routine
    this.routine.update(r => {
      if (!r) return r;
      const targetExerciseIds = new Set(targetExercises.map(ex => ex.id));
      const newExercises = r.exercises.map(exercise => {
        if (!targetExerciseIds.has(exercise.id)) return exercise;

        const originalExIndex = this.getOriginalExIndex(exercise.id);
        if (originalExIndex === -1) return exercise;

        const newSets = exercise.sets.map((set, setIndex) => {
          updatedSetsCount++;
          const newSet = { ...set };
          metricsToApply.forEach(({ metric, value }) => {
            // Patch the target value
            switch (metric) {
              case METRIC.reps: newSet.targetReps = value; break;
              case METRIC.weight: newSet.targetWeight = value; break;
              case METRIC.duration: newSet.targetDuration = value; break;
              case METRIC.distance: newSet.targetDistance = value; break;
              case METRIC.rest: newSet.targetRest = value; break;
              case METRIC.tempo: newSet.targetTempo = value; break;
            }
            // Ensure metric is in fieldOrder
            if (!newSet.fieldOrder) newSet.fieldOrder = [];
            if (!newSet.fieldOrder.includes(metric)) newSet.fieldOrder.push(metric);
          });
          return newSet;
        });
        return { ...exercise, sets: newSets };
      });
      return { ...r, exercises: newExercises };
    });

    // 5. Update performanceInputValues for all sets
    targetExercises.forEach(exercise => {
      const originalExIndex = this.getOriginalExIndex(exercise.id);
      if (originalExIndex === -1) return;
      exercise.sets.forEach((set, setIndex) => {
        metricsToApply.forEach(({ metric, value }) => {
          this.setPerformanceInputValue(originalExIndex, setIndex, metric, value);
        });
      });
    });

    // 6. Update logged sets in the workout log
    this.currentWorkoutLog.update(log => {
      if (!log.exercises) return log;

      targetExercises.forEach(exercise => {
        const loggedEx = log.exercises?.find(le => le.id === exercise.id);
        if (!loggedEx) return;

        loggedEx.sets.forEach(loggedSet => {
          metricsToApply.forEach(({ metric, value }) => {
            switch (metric) {
              case METRIC.reps:
                loggedSet.targetReps = value;
                loggedSet.repsLogged = value;
                break;
              case METRIC.weight:
                loggedSet.targetWeight = value;
                loggedSet.weightLogged = value;
                break;
              case METRIC.duration:
                loggedSet.targetDuration = value;
                loggedSet.durationLogged = value;
                break;
              case METRIC.distance:
                loggedSet.targetDistance = value;
                loggedSet.distanceLogged = value;
                break;
              case METRIC.rest:
                loggedSet.targetRest = value;
                loggedSet.restLogged = value;
                break;
              case METRIC.tempo:
                loggedSet.targetTempo = value;
                loggedSet.tempoLogged = value;
                break;
            }
            // Ensure metric is in fieldOrder
            if (!loggedSet.fieldOrder) loggedSet.fieldOrder = [];
            if (!loggedSet.fieldOrder.includes(metric)) loggedSet.fieldOrder.push(metric);
          });
        });
      });

      return { ...log };
    });

    // 7. Reset UI and provide feedback
    this.repsToSetForAll.set(null);
    this.weightToSetForAll.set(null);
    this.durationToSetForAll.set(null);
    this.distanceToSetForAll.set(null);
    this.restToSetForAll.set(null);
    this.tempoToSetForAll.set(null);
    this.expandedSetAllPanel.set(null);

    // Build a summary of what was set
    const summaryParts: string[] = [];
    if (reps !== null) summaryParts.push(`${this.translate.instant('metrics.reps')}: ${reps}`);
    if (weight !== null) summaryParts.push(`${this.translate.instant('metrics.weight')}: ${weight} (${this.unitsService.getWeightUnitSuffix()})`);
    if (duration !== null) summaryParts.push(`${this.translate.instant('metrics.duration')}: ${duration} (s)`);
    if (distance !== null) summaryParts.push(`${this.translate.instant('metrics.distance')}: ${distance} (${this.unitsService.getDistanceUnitSuffix()})`);
    if (rest !== null) summaryParts.push(`${this.translate.instant('metrics.rest')}: ${rest} (s)`);
    if (tempo !== null) summaryParts.push(`${this.translate.instant('metrics.tempo')}: ${tempo}`);

    const summary = summaryParts.length > 0
      ? summaryParts.join(', ')
      : this.translate.instant('compactPlayer.set.none');

    this.toastService.success(
      this.translate.instant('compactPlayer.set.metricsUpdatedCount', {
        summary,
        count: updatedSetsCount
      }),
      5000
    );
  }

  toggleMetricForAllSets(exIndex: number, metric: METRIC): void {
    const routine = this.routine();
    if (!routine) return;

    const exercise = routine.exercises[exIndex];
    if (!exercise) return;

    // If superset, apply to all exercises in the group; else just this one
    const exercisesToUpdate = exercise.supersetId
      ? this.getSupersetExercises(exercise.supersetId)
      : [exercise];

    let affectedSetsCount = 0;

    // Determine shouldAdd ONCE based on the first set of the first exercise
    let shouldAdd = false;
    if (exercisesToUpdate.length > 0 && exercisesToUpdate[0].sets.length > 0) {
      shouldAdd = !exercisesToUpdate[0].sets[0].fieldOrder?.includes(metric);
    }

    // Only consider metrics except rest for blocking logic
    const metricsToCheck = this.availableMetricsForSetAll.filter(m => m !== METRIC.rest);
    // If removing, check if this would remove all non-rest metrics
    if (!shouldAdd && metricsToCheck.some(m => m === metric)) {
      const currentActive = metricsToCheck.filter(m =>
        m !== metric && exercise.sets.some(set => set.fieldOrder?.includes(m))
      );
      if (currentActive.length === 0) {
        this.toastService.error(
          this.translate.instant('compactPlayer.set.atLeastOneMetric'),
          2500
        );
        return;
      }
    }

    exercisesToUpdate.forEach(ex => {
      const originalExIndex = this.getOriginalExIndex(ex.id);
      ex.sets.forEach((set, setIndex) => {
        if (!set.fieldOrder) set.fieldOrder = [];

        const hasMetric = set.fieldOrder.includes(metric);

        if (shouldAdd) {
          if (!hasMetric) {
            set.fieldOrder.push(metric);
            affectedSetsCount++;
            // Set default value if not present
            let defaultValue: any;
            switch (metric) {
              case METRIC.rest:
                if (!set.targetRest) set.targetRest = restToExact(60);
                defaultValue = restToExact(60);
                break;
              case METRIC.weight:
                if (!set.targetWeight) set.targetWeight = weightToExact(10);
                defaultValue = weightToExact(10);
                break;
              case METRIC.reps:
                if (!set.targetReps) set.targetReps = repsToExact(8);
                defaultValue = repsToExact(8);
                break;
              case METRIC.distance:
                if (!set.targetDistance) set.targetDistance = distanceToExact(2);
                defaultValue = distanceToExact(2);
                break;
              case METRIC.duration:
                if (!set.targetDuration) set.targetDuration = durationToExact(45);
                defaultValue = durationToExact(45);
                break;
            }
            // Update performanceInputValues
            if (defaultValue !== undefined) {
              this.setPerformanceInputValue(originalExIndex, setIndex, metric, defaultValue);
            }
          }
        } else {
          if (hasMetric) {
            set.fieldOrder = set.fieldOrder.filter(m => m !== metric);
            affectedSetsCount++;
            // Remove the related target property
            switch (metric) {
              case METRIC.rest: set.targetRest = undefined;
                const restKey = this.getSupersetRestKey(exIndex, setIndex);
                this.restStartTimestamps[restKey] = 0;
                break;
              case METRIC.weight: set.targetWeight = undefined; break;
              case METRIC.reps: set.targetReps = undefined; break;
              case METRIC.distance: set.targetDistance = undefined; break;
              case METRIC.duration: set.targetDuration = undefined; break;
            }
            // Remove from performanceInputValues
            this.performanceInputValues.update(inputs => {
              const key = this.getSupersetRestKey(originalExIndex, setIndex);
              if (inputs[key]) {
                delete inputs[key][this.getFieldKey(metric)];
              }
              return { ...inputs };
            });
          }
        }
      });
    });

    // Update logged sets in the workout log for all affected exercises
    this.currentWorkoutLog.update(log => {
      if (!log.exercises) return log;

      exercisesToUpdate.forEach(ex => {
        const loggedEx = log.exercises?.find(le => le.id === ex.id);
        if (loggedEx) {
          loggedEx.sets.forEach((loggedSet, setIndex) => {
            const set = ex.sets[setIndex];
            if (!set) return;
            if (shouldAdd) {
              if (!loggedSet.fieldOrder) loggedSet.fieldOrder = [];
              if (!loggedSet.fieldOrder.includes(metric)) {
                loggedSet.fieldOrder.push(metric);
                switch (metric) {
                  case METRIC.rest:
                    loggedSet.targetRest = set.targetRest ?? restToExact(60);
                    loggedSet.restLogged = set.targetRest ?? restToExact(60);
                    break;
                  case METRIC.weight:
                    loggedSet.targetWeight = set.targetWeight ?? weightToExact(10);
                    loggedSet.weightLogged = set.targetWeight ?? weightToExact(10);
                    break;
                  case METRIC.reps:
                    loggedSet.targetReps = set.targetReps ?? repsToExact(8);
                    loggedSet.repsLogged = set.targetReps ?? repsToExact(8);
                    break;
                  case METRIC.distance:
                    loggedSet.targetDistance = set.targetDistance ?? distanceToExact(2);
                    loggedSet.distanceLogged = set.targetDistance ?? distanceToExact(2);
                    break;
                  case METRIC.duration:
                    loggedSet.targetDuration = set.targetDuration ?? durationToExact(45);
                    loggedSet.durationLogged = set.targetDuration ?? durationToExact(45);
                    break;
                }
              }
            } else {
              if (loggedSet.fieldOrder) {
                loggedSet.fieldOrder = loggedSet.fieldOrder.filter(m => m !== metric);
              }
              switch (metric) {
                case METRIC.rest:
                  loggedSet.targetRest = undefined;
                  loggedSet.restLogged = undefined;
                  break;
                case METRIC.weight:
                  loggedSet.targetWeight = undefined;
                  loggedSet.weightLogged = undefined;
                  break;
                case METRIC.reps:
                  loggedSet.targetReps = undefined;
                  loggedSet.repsLogged = undefined;
                  break;
                case METRIC.distance:
                  loggedSet.targetDistance = undefined;
                  loggedSet.distanceLogged = undefined;
                  break;
                case METRIC.duration:
                  loggedSet.targetDuration = undefined;
                  loggedSet.durationLogged = undefined;
                  break;
              }
            }
          });
        }
      });

      return { ...log };
    });

    // Update the routine signal to trigger UI update
    this.routine.set({ ...routine });

    // Show feedback toast with count
    if (shouldAdd) {
      this.toastService.success(
        this.translate.instant('compactPlayer.set.metricAddedCount', {
          metric: this.translate.instant('metrics.' + metric),
          count: affectedSetsCount
        }),
        2500
      );
    } else {
      this.toastService.info(
        this.translate.instant('compactPlayer.set.metricRemovedCount', {
          metric: this.translate.instant('metrics.' + metric),
          count: affectedSetsCount
        }),
        2500
      );
    }
  }

  isTextReps(exIndex: number, setIndex: number): boolean {
    const routine = this.routine();
    if (!routine) return false;
    const set = routine.exercises[exIndex]?.sets[setIndex];

    const repType = set?.targetReps?.type;

    if (!repType) {
      return false;
    }

    // The input should be 'text' for ANY scheme that isn't a simple, exact number.
    // This correctly includes 'range', 'min_plus', 'amrap', and 'max'.
    return repType !== RepsTargetType.exact;
  }

  isTextWeight(exIndex: number, setIndex: number): boolean {
    const routine = this.routine();
    if (!routine) return false;
    const set = routine.exercises[exIndex]?.sets[setIndex];
    const weightType = set?.targetWeight?.type;

    if (!weightType) {
      return false;
    }
    return weightType !== WeightTargetType.exact;
  }

  /**
    * Checks if any input field for a given set is currently marked as invalid.
    * @param exIndex The index of the exercise.
    * @param setIndex The index of the set.
    * @returns True if at least one field for the set has a validation error.
    */
  protected hasInvalidInput(exIndex: number, setIndex: number, metric?: METRIC): boolean {
    const prefix = `${exIndex}-${setIndex}-`;
    // Convert the Set to an array and check if any key starts with the set's prefix.
    if (metric) {
      return Array.from(this.invalidInputs()).some(key => key.startsWith(prefix) && key.includes(metric.toString()));
    }
    return Array.from(this.invalidInputs()).some(key => key.startsWith(prefix));
  }

  protected countAvailableMetrics(exIndex: number, setIndex: number, metric: METRIC): number {
    const routine = this.routine();
    if (!routine) return 0;
    const set = routine.exercises[exIndex]?.sets[setIndex];
    if (!set) return 0;

    let availableSchemes: AnyScheme[];
    let currentTarget: AnyTarget | null | undefined;

    // 1. Get the correct metadata array and current value based on the metric.
    //    CRUCIALLY, we filter for `availableInPlayer` because this is the player component.
    switch (metric) {
      case METRIC.reps:
        availableSchemes = REPS_TARGET_SCHEMES.filter(s => s.availableInPlayer);
        currentTarget = set.targetReps;
        break;
      case METRIC.weight:
        availableSchemes = WEIGHT_TARGET_SCHEMES.filter(s => s.availableInPlayer);
        currentTarget = set.targetWeight;
        break;
      case METRIC.duration:
        availableSchemes = DURATION_TARGET_SCHEMES.filter(s => s.availableInPlayer);
        currentTarget = set.targetDuration;
        break;
      case METRIC.distance:
        availableSchemes = DISTANCE_TARGET_SCHEMES.filter(s => s.availableInPlayer);
        currentTarget = set.targetDistance;
        break;
      case METRIC.rest:
        availableSchemes = REST_TARGET_SCHEMES.filter(s => s.availableInPlayer);
        currentTarget = set.targetRest;
        break;
      default:
        this.toastService.error(`Scheme editing is not supported for metric: ${metric}`);
        return 0;
    }


    availableSchemes = availableSchemes.filter(s => s.type !== currentTarget?.type);

    return availableSchemes.length;
  }

  /**
 * GENERIC: Opens a modal to configure the target scheme for any metric.
 * @param exIndex The index of the exercise.
 * @param setIndex The index of the set.
 * @param metric The metric to be configured (e.g., 'reps', 'weight').
 * @param event The mouse event to stop propagation.
 */
  async openMetricSchemeModal(exIndex: number, setIndex: number, metric: METRIC, event?: Event): Promise<void> {
    event?.stopPropagation();

    const routine = this.routine();
    if (!routine) return;
    const set = routine.exercises[exIndex]?.sets[setIndex];
    if (!set) return;

    let availableSchemes: AnyScheme[];
    let currentTarget: AnyTarget | null | undefined;

    // 1. Get the correct metadata array and current value based on the metric.
    //    CRUCIALLY, we filter for `availableInPlayer` because this is the player component.
    switch (metric) {
      case METRIC.reps:
        availableSchemes = REPS_TARGET_SCHEMES.filter(s => s.availableInPlayer);
        currentTarget = set.targetReps;
        break;
      case METRIC.weight:
        availableSchemes = WEIGHT_TARGET_SCHEMES.filter(s => s.availableInPlayer);
        currentTarget = set.targetWeight;
        break;
      case METRIC.duration:
        availableSchemes = DURATION_TARGET_SCHEMES.filter(s => s.availableInPlayer);
        currentTarget = set.targetDuration;
        break;
      case METRIC.distance:
        availableSchemes = DISTANCE_TARGET_SCHEMES.filter(s => s.availableInPlayer);
        currentTarget = set.targetDistance;
        break;
      case METRIC.rest:
        availableSchemes = REST_TARGET_SCHEMES.filter(s => s.availableInPlayer);
        currentTarget = set.targetRest;
        break;
      default:
        this.toastService.error(`Scheme editing is not supported for metric: ${metric}`);
        return;
    }

    // remove from the availableSchemes the current one
    availableSchemes = availableSchemes.filter(s => s.type !== currentTarget?.type);
    if (availableSchemes.length === 0) {
      this.toastService.info(
        this.translate.instant('compactPlayer.toasts.noFurtherSchemes', { metric: this.translate.instant('metrics.' + metric).toUpperCase() }),
        8000,
        this.translate.instant('common.info')
      );
      return;
    }

    // 2. Call the generic service method.
    const result = await this.workoutUtilsService.showSchemeModal(
      metric,
      currentTarget ?? null, // This ensures we only pass AnyTarget or null
      availableSchemes
    );

    // 3. If a new target is returned, update the routine state.
    if (result && result.data) {
      this.updateSetMetricTarget(exIndex, setIndex, metric, result.data);
      this._prefillPerformanceInputs(); // Resync performance inputs with the new plan
      this.scrollToSet(exIndex, setIndex);
    }
  }

  /**
     * GENERIC: Updates a specific metric's target object for a given set within the routine.
     * @param exIndex The index of the exercise.
     * @param setIndex The index of the set.
     * @param metric The metric to update.
     * @param newTarget The new target object.
     */
  updateSetMetricTarget(exIndex: number, setIndex: number, metric: METRIC, newTarget: AnyTarget): void {
    this.routine.update(routine => {
      if (!routine) return routine;

      const set = routine.exercises[exIndex]?.sets[setIndex];
      if (set) {
        // Use a switch to assign the new target object to the correct property.
        switch (metric) {
          case METRIC.reps:
            set.targetReps = newTarget as RepsTarget;
            break;
          case METRIC.weight:
            set.targetWeight = newTarget as WeightTarget;
            break;
          case METRIC.duration:
            set.targetDuration = newTarget as DurationTarget;
            break;
          case METRIC.distance:
            set.targetDistance = newTarget as DistanceTarget;
            break;
          case METRIC.rest:
            set.targetRest = newTarget as RestTarget;
            break;
        }
        // Show a generic success message.
        this.toastService.info(`Set #${setIndex + 1} ${metric} target changed.`);
      }

      return { ...routine };
    });
  }
  /**
   * Focuses the reps input field for a specific set.
   * This is triggered by the new 'edit' button for textual reps.
   * @param exIndex The index of the exercise.
   * @param setIndex The index of the set.
   */
  public focusRepsInput(exIndex: number, setIndex: number): void {
    // Construct a unique ID for the input field
    const inputId = `reps-input-${exIndex}-${setIndex}`;
    const inputElement = document.getElementById(inputId) as HTMLInputElement;
    if (inputElement) {
      inputElement.focus();
      inputElement.select(); // Select the text for easy replacement
    }
  }

  getDurationValue(duration: DurationTarget | undefined): number {
    return getDurationValue(duration);
  }

  getWeightValue(weight: WeightTarget | undefined): number {
    return getWeightValue(weight);
  }

  getDistanceValue(distance: DistanceTarget | undefined): number {
    return getDistanceValue(distance);
  }

  getRestValue(rest: RestTarget | undefined): number {
    return getRestValue(rest);
  }

  getRepsValue(reps: RepsTarget | undefined): number {
    return repsTypeToReps(reps);
  }


  readonly allAvailableMetrics: METRIC[] = [
    METRIC.reps,
    METRIC.weight,
    METRIC.distance,
    METRIC.duration,
    METRIC.rest
  ];

  get availableMetricsForSetAll(): METRIC[] {
    return this.allAvailableMetrics;
  }

  /**
 * Returns the available metrics for a set.
 * - For supersets: only weight, reps, and rest are allowed.
 * - For standard exercises: all metrics are allowed.
 */
  getAvailableMetricsForSet(exIndex: number): METRIC[] {
    const routine = this.routine();
    if (!routine) return [];
    const exercise = routine.exercises[exIndex];
    if (!exercise) return [];

    if (exercise.supersetId) {
      if (this.isEmom(exIndex)) {
        return [METRIC.weight, METRIC.reps];
      }
      // Only allow weight, reps, and rest for supersets
      return [METRIC.weight, METRIC.reps, METRIC.rest];
    } else {
      // Allow all metrics for standard exercises
      return [
        METRIC.reps,
        METRIC.weight,
        METRIC.distance,
        METRIC.duration,
        METRIC.rest
      ];
    }
  }




  protected repsStep: number = 1;
  protected weightStep: number = 0.1;
  protected durationStep: number = 5;
  protected distanceStep: number = 0.1;
  protected restStep: number = 5;

  // Add this property to your component
  activeSetAllMetrics: { [exIndex: number]: METRIC[] } = {};
  isMetricActiveForAllSets(exIndex: number, metric: METRIC): boolean {
    const routine = this.routine();
    if (!routine) return false;
    const exercise = routine.exercises[exIndex];
    if (!exercise) return false;
    // The chip is active only if ALL sets have the metric in their fieldOrder
    return exercise.sets.every(set => set.fieldOrder?.includes(metric));
  }

  protected getSet(exIndex: number, setIndex: number) {
    return this.routine()?.exercises?.[exIndex]?.sets?.[setIndex];
  }


  getPerformanceInputValue(exIndex: number, setIndex: number, field: METRIC | 'notes'): any {
    const key = this.getSetOrderId(exIndex, setIndex);
    const set = this.getSet(exIndex, setIndex);
    if (!set?.fieldOrder?.includes(field as METRIC) && field !== 'notes') return undefined;
    return this.performanceInputValues()[key]?.[this.getFieldKey(field)];
  }

  onInputChange(value: any, exIndex: number, setIndex: number, field: METRIC | 'notes') {
    this.setPerformanceInputValue(exIndex, setIndex, field, value);
    // Optionally: run validation or other logic here
  }

  setPerformanceInputValue(exIndex: number, setIndex: number, field: METRIC | 'notes', value: any): void {
    const key = this.getSetOrderId(exIndex, setIndex);
    const set = this.getSet(exIndex, setIndex);
    if (!set?.fieldOrder?.includes(field as METRIC) && field !== 'notes') return;

    this.performanceInputValues.update(inputs => {
      const updated = { ...inputs };
      if (!updated[key]) updated[key] = {};
      updated[key][this.getFieldKey(field)] = value;
      return updated;
    });
  }



  getFieldKey(field: METRIC | 'notes'): keyof ExerciseCurrentExecutionSetParams {
    switch (field) {
      case METRIC.reps: return 'actualReps';
      case METRIC.weight: return 'actualWeight';
      case METRIC.distance: return 'actualDistance';
      case METRIC.duration: return 'actualDuration';
      case METRIC.rest: return 'actualRest';
      case METRIC.tempo: return 'tempoLogged';
      case 'notes': return 'notes';
    }
  }

  getMetricInputValue(): any {
    return (exIndex: number, setIndex: number, field: METRIC | 'notes') => {
      const key = this.getSetOrderId(exIndex, setIndex);
      const value = this.performanceInputValues()[key]?.[this.getFieldKey(field)];
      switch (field) {
        case METRIC.reps:
          return value && typeof value === 'object' && 'type' in value
            ? repsTargetAsString(value as RepsTarget)
            : value ?? '';
        case METRIC.weight:
          return value && typeof value === 'object' && 'type' in value
            ? weightTargetAsString(value as WeightTarget)
            : value ?? '';
        case METRIC.distance:
          return value && typeof value === 'object' && 'type' in value
            ? distanceTargetAsString(value as DistanceTarget)
            : value ?? '';
        case METRIC.duration:
          return value && typeof value === 'object' && 'type' in value
            ? durationTargetAsString(value as DurationTarget)
            : value ?? '';
        case METRIC.rest:
          return value && typeof value === 'object' && 'type' in value
            ? restTargetAsString(value as RestTarget)
            : value ?? '';
        case METRIC.tempo:
          return value ?? '';
        case 'notes':
          return value ?? '';
      }
      return '';
    };
  }

  setMetricInputValue(exIndex: number, setIndex: number, field: METRIC | 'notes', value: any): void {
    const key = this.getSetOrderId(exIndex, setIndex);
    const inputKey = `${key}-${field}`;
    const set = this.getSet(exIndex, setIndex);
    if (!set?.fieldOrder?.includes(field as METRIC) && field !== 'notes') return;

    this.performanceInputValues.update(inputs => {
      const updated = { ...inputs };
      if (!updated[key]) updated[key] = {};

      // Validation logic (adapted from updateSetData)
      switch (field) {
        case METRIC.reps: {
          const rawValue = String(value).trim();
          const validRepsPattern = /^(\d+(\+)?|AMRAP|MAX)$/i;

          if (rawValue === '' || validRepsPattern.test(rawValue)) {
            this.invalidInputs.update(s => { s.delete(inputKey); return s; });

            if (rawValue.endsWith('+')) {
              const numericValue = parseInt(rawValue.slice(0, -1), 10);
              updated[key].actualReps = { type: RepsTargetType.min_plus, value: numericValue };
            } else if (rawValue.toUpperCase() === 'AMRAP') {
              updated[key].actualReps = { type: RepsTargetType.amrap };
            } else if (rawValue.toUpperCase() === 'MAX') {
              updated[key].actualReps = { type: RepsTargetType.max };
            } else {
              const numericValue = parseInt(rawValue, 10);
              if (!isNaN(numericValue)) {
                updated[key].actualReps = { type: RepsTargetType.exact, value: numericValue };
              } else {
                updated[key].actualReps = undefined;
                this.invalidInputs.update(s => { s.add(inputKey); return s; });
              }
            }
          } else {
            this.invalidInputs.update(s => { s.add(inputKey); return s; });
          }
          break;
        }
        case METRIC.weight: {
          const rawWeight = String(value).trim();
          const validWeightPattern = /^(\d+(\.\d+)?|MAX|RM|BW|AMRAP)$/i;

          if (rawWeight === '' || validWeightPattern.test(rawWeight)) {
            this.invalidInputs.update(s => { s.delete(inputKey); return s; });

            if (rawWeight.toUpperCase().includes('%')) {
              updated[key].actualWeight = { type: WeightTargetType.percentage_1rm, percentage: 100 };
            } else if (rawWeight.toUpperCase() === 'BW') {
              updated[key].actualWeight = { type: WeightTargetType.bodyweight };
            } else {
              const numericValue = parseFloat(rawWeight);
              if (!isNaN(numericValue)) {
                updated[key].actualWeight = { type: WeightTargetType.exact, value: numericValue };
              } else {
                updated[key].actualWeight = undefined;
                this.invalidInputs.update(s => { s.add(inputKey); return s; });
              }
            }
          } else {
            this.invalidInputs.update(s => { s.add(inputKey); return s; });
          }
          break;
        }
        case METRIC.distance:
          updated[key].actualDistance = distanceToExact(parseFloat(value)) || undefined;
          break;
        case METRIC.duration:
          updated[key].actualDuration = durationToExact(this.parseTimeToSeconds(value));
          break;
        case METRIC.rest:
          updated[key].actualRest = restToExact(this.parseTimeToSeconds(value));
          break;
        case METRIC.tempo:
          updated[key].tempoLogged = value === '' ? undefined : value;
          break;
        case 'notes':
          updated[key].notes = value;
          break;
      }
      return updated;
    });
  }

  showExerciseSelectionModal = signal(false);
  async onAddExercisesSelected(exercises: Exercise[]) {
    this.showExerciseSelectionModal.set(false);

    for (const exercise of exercises) {
      // Use the same logic as selectExerciseToAddFromModal
      const log = this.currentWorkoutLog();
      const allLoggedExercises = log.exercises || [];
      const lastLoggedExercise = allLoggedExercises.length > 0 ? allLoggedExercises[allLoggedExercises.length - 1] : null;
      const lastLoggedSet = lastLoggedExercise && lastLoggedExercise.sets.length > 0 ? lastLoggedExercise.sets[lastLoggedExercise.sets.length - 1] : null;

      const newWorkoutExercise = await this.workoutService.promptAndCreateWorkoutExercise(exercise, lastLoggedSet);

      if (newWorkoutExercise) {
        if (exercise.id.startsWith('custom-adhoc-ex-')) {
          const newExerciseToBeSaved = this.exerciseService.mapWorkoutExerciseToExercise(newWorkoutExercise, exercise);
          this.exerciseService.addExercise(newExerciseToBeSaved);
        }
        this.addExerciseToRoutine(newWorkoutExercise);
      }
    }
  }

  getSectionForExercise(exIndex: number): WorkoutSection | null {
    const exercise = this.routine()?.exercises?.[exIndex];
    if (!exercise || !exercise.section) return null;
    return this.routine()?.sections?.find(s => s.type === exercise.section) ?? null;
  }


  // Add this with your other signals
  expandedMetricsSection = signal<string | null>(null); // Key will be "exIndex-setIndex"
  toggleMetricsSection(exIndex: number, setIndex: number, event?: Event): void {
    event?.stopPropagation();
    const key = this.getSetOrderId(exIndex, setIndex);
    const isSetExpanded = this.expandedSets().has(key);
    const isMetricsExpanded = this.expandedMetricsSection() === key;

    if (!isMetricsExpanded) {
      // If metrics section is not expanded, expand it and ensure set is expanded
      this.expandedMetricsSection.set(key);
      if (!isSetExpanded) {
        this.expandedSets.update(currentSet => {
          const newSet = new Set(currentSet);
          newSet.add(key);
          return newSet;
        });
      }
    } else {
      // If metrics section is expanded, collapse it and also collapse set
      this.expandedMetricsSection.set(null);
      if (isSetExpanded) {
        this.expandedSets.update(currentSet => {
          const newSet = new Set(currentSet);
          newSet.delete(key);
          return newSet;
        });
      }
    }
  }

  isMetricsSectionExpanded(exIndex: number, setIndex: number): boolean {
    const key = this.getSetOrderId(exIndex, setIndex);
    return this.expandedMetricsSection() === key;
  }


  setActionItemsMap = computed<Map<string, ActionMenuItem[]>>(() => {
    const map = new Map<string, ActionMenuItem[]>();
    const routine = this.routine();
    const commonModalButtonClass = this.menuButtonBaseClass();

    if (!routine) return map;

    routine.exercises.forEach((exercise, exIndex) => {
      exercise.sets.forEach((set, setIndex) => {
        const key = this.getSetOrderId(exIndex, setIndex);
        const isCompleted = this.isSetCompleted(exIndex, setIndex);

        const items: ActionMenuItem[] = [];

        if (!isCompleted) {
          // Toggle Metrics Button
          if (!exercise.supersetId) {
            items.push({
              ...metricsBtn,
              label: this.translate.instant('compactPlayer.toggleMetrics'),
              data: { exIndex, setIndex }
            });
          }


          // Rest Button
          items.push({
            ...restBtn,
            data: { exIndex, setIndex },
            label: this.translate.instant('compactPlayer.rest'),
          });
        }

        // Notes Button
        items.push({
          ...setNotesBtn,
          label: this.translate.instant('compactPlayer.setNotes'),
          data: { exIndex, setIndex }
        });

        // Remove Set Button
        items.push({
          ...removeSetFromExerciseBtn,
          label: exercise.supersetId ? this.translate.instant('actionButtons.removeRound') : this.translate.instant('actionButtons.removeSet'),
          data: { exIndex, setIndex }
        });

        map.set(key, items);
      });
    });

    return map;
  });

  activeSetActionMenuKey = signal<string | null>(null);

  handleSetActionMenuItemClick(event: { actionKey: string, data?: any }): void {
    const { actionKey, data } = event;
    const { exIndex, setIndex } = data;

    switch (actionKey) {
      case 'toggle_metrics':
        this.toggleMetricsSection(exIndex, setIndex, new Event('click'));
        break;
      case 'set_notes':
        this.toggleSetNotes(exIndex, setIndex, new Event('click'));
        break;
      case 'rest':
        this.openRestModal(exIndex, setIndex, new Event('click'));
        break;
      case 'removeSet':
        this.removeSet(exIndex, setIndex);
        break;
    }

    this.closeSetActionMenu();
  }

  toggleSetActionMenu(exIndex: number, setIndex: number, event: Event): void {
    event.stopPropagation();
    const key = this.getSetOrderId(exIndex, setIndex);
    this.activeSetActionMenuKey.update(current => current === key ? null : key);
    this.closeExerciseActionMenu();
    this.closeMainSessionActionMenu();
  }

  closeSetActionMenu() {
    this.activeSetActionMenuKey.set(null);
  }

  /**
 * Checks if a metric input field should be disabled.
 * Duration fields are disabled when their associated timer (set timer or EMOM) is running.
 * @param exIndex The exercise index
 * @param setIndex The set/round index
 * @param field The metric field to check
 * @returns True if the field should be disabled
 */
  isMetricInputDisabled(exIndex: number, setIndex: number, field: METRIC): boolean {
    if (field !== METRIC.duration) {
      return false;
    }

    const setTimerRunning = this.getSetTimerState(exIndex, setIndex).status === this.timerSetEnum.Running;
    const emomTimerRunning = this.getEmomState(exIndex, setIndex).status === this.timerSetEnum.Running;

    return setTimerRunning || emomTimerRunning;
  }


  protected getSetTimerProgress(exIndex: number, setIndex: number): number {
    const set = this.routine()?.exercises[exIndex]?.sets[setIndex];
    if (!set) return 0;

    const performanceKey = this.getSetOrderId(exIndex, setIndex);
    const actualDuration = getDurationValue(this.performanceInputValues()[performanceKey]?.actualDuration);
    const targetDuration = getDurationValue(set.targetDuration);
    const totalDuration = actualDuration ?? targetDuration ?? 1;

    const elapsed = totalDuration - this.getSetTimerState(exIndex, setIndex).remainingTime;
    const progress = (elapsed / totalDuration) * 100;

    return Math.min(100, Math.max(0, progress)); // Clamp between 0 and 100
  }


  // Modal state and context
  noteModalVisible = signal(false);
  noteModalContext = signal<{ type: 'session' | 'exercise' | 'set', exIndex?: number, setIndex?: number } | null>(null);
  noteModalValue = signal<string>('');
  openNoteModal(type: 'session' | 'exercise' | 'set', exIndex?: number, setIndex?: number) {
    let initial = '';
    if (type === 'session') {
      initial = this.currentWorkoutLog().notes ?? '';
    } else if (type === 'exercise' && exIndex !== undefined) {
      initial = this.routine()?.exercises[exIndex]?.notes ?? '';
    } else if (type === 'set' && exIndex !== undefined && setIndex !== undefined) {
      const key = this.getSetOrderId(exIndex, setIndex);
      // Prefer logged set, then user input, then planned
      const loggedSet = this.getLoggedSet(exIndex, setIndex);
      initial = loggedSet?.notes
        ?? this.performanceInputValues()[key]?.notes
        ?? this.routine()?.exercises[exIndex]?.sets[setIndex]?.notes
        ?? '';
    }
    this.noteModalContext.set({ type, exIndex, setIndex });
    this.noteModalValue.set(initial);
    this.noteModalVisible.set(true);
  }

  async saveNoteModal() {
    const ctx = this.noteModalContext();
    const value = this.noteModalValue();
    if (!ctx) return;

    if (ctx.type === 'session') {
      this.currentWorkoutLog.update(log => {
        log.notes = value;
        return { ...log };
      });
      this.toastService.success(this.translate.instant('compactPlayer.toasts.sessionNotesUpdated'));
    } else if (ctx.type === 'exercise' && ctx.exIndex !== undefined && typeof ctx.exIndex === 'number') {
      const exIndex = ctx.exIndex;
      this.routine.update(r => {
        if (!r) return r;
        r.exercises[exIndex].notes = value;
        return { ...r };
      });
      // Also update log if exercise is logged
      const exercise = this.routine()?.exercises[ctx.exIndex];
      if (exercise) {
        this.currentWorkoutLog.update(log => {
          const loggedEx = log.exercises?.find(ex => ex.id === exercise.id);
          if (loggedEx) loggedEx.notes = value;
          return { ...log };
        });
      }
      this.toastService.success(this.translate.instant('compactPlayer.toasts.exerciseNotesUpdated'));
    } else if (
      ctx.type === 'set' &&
      typeof ctx.exIndex === 'number' &&
      typeof ctx.setIndex === 'number'
    ) {
      const key = `${ctx.exIndex}-${ctx.setIndex}`;
      this.performanceInputValues.update(inputs => {
        if (!inputs[key]) inputs[key] = {};
        inputs[key].notes = value;
        return { ...inputs };
      });
      // If set is logged, update log as well
      const exercise = this.routine()?.exercises[ctx.exIndex];
      if (exercise) {
        const exIndex = ctx.exIndex;
        this.currentWorkoutLog.update(log => {
          const loggedEx = log.exercises?.find(ex => ex.id === exercise.id);
          if (loggedEx) {
            const loggedSet = loggedEx.sets.find(s => s.plannedSetId === exercise.sets[exIndex].id);
            if (loggedSet) loggedSet.notes = value;
          }
          return { ...log };
        });
      }
      this.toastService.success(this.translate.instant('compactPlayer.toasts.setNotesUpdated'));
    }
    this.closeNoteModal();
  }

  closeNoteModal() {
    this.noteModalVisible.set(false);
    this.noteModalContext.set(null);
    this.noteModalValue.set('');
  }


  getNoteModalTitle(): string {
    const ctx = this.noteModalContext();
    if (!ctx) return '';

    if (ctx.type === 'session') {
      return this.translate.instant('compactPlayer.sessionNotes');
    }

    if (ctx.type === 'exercise' && typeof ctx.exIndex === 'number') {
      const exercise = this.routine()?.exercises[ctx.exIndex];
      if (exercise) {
        return `${this.translate.instant('compactPlayer.exerciseNotes')} - ${exercise.exerciseName || ''}`;
      }
      return this.translate.instant('compactPlayer.exerciseNotes');
    }

    if (ctx.type === 'set' && typeof ctx.exIndex === 'number' && typeof ctx.setIndex === 'number') {
      const exercise = this.routine()?.exercises[ctx.exIndex];
      const setNumber = ctx.setIndex + 1;
      if (exercise) {
        return `${this.translate.instant('compactPlayer.setNotes')} - ${exercise.exerciseName || ''} (Set ${setNumber})`;
      }
      return `${this.translate.instant('compactPlayer.setNotes')} (Set ${setNumber})`;
    }

    return '';
  }

  getWeightTargetType(weightTarget?: WeightTarget): WeightTargetType | undefined {
    if (!weightTarget) {
      return undefined;
    }
    return weightTarget.type;
  }

  getSetUniformValues(exIndex: number, setIndex: number) {
    const routine = this.routine();
    if (!routine) return {};
    const exercise = routine.exercises[exIndex];
    const plannedSet = exercise.sets[setIndex];
    const loggedSet = this.getLoggedSet(exIndex, setIndex);
    const key = this.getSetOrderId(exIndex, setIndex);
    const userInputs = this.performanceInputValues()[key] || {};

    let weightIcon = 'body';
    let weightValue = this.workoutUtilsService.weightTargetAsString(
      userInputs.actualWeight ??
      loggedSet?.weightLogged ??
      plannedSet.targetWeight
    );
    const weightTargetType = this.getWeightTargetType(
      userInputs.actualWeight ??
      loggedSet?.weightLogged ??
      plannedSet.targetWeight
    );
    switch (weightTargetType) {
      case WeightTargetType.exact:
      case WeightTargetType.range:
      case WeightTargetType.percentage_1rm:
        weightIcon = 'weight';
        break;
      case WeightTargetType.bodyweight: {
        break;
      }
    }


    // if it's castable to a number return it with the unitsService.suffix, otherwise return it as it is
    if (!isNaN(Number(weightValue)) && weightValue !== '') {
      weightValue = `${weightValue} ${this.unitsService.getWeightUnitSuffix()}`;
      weightIcon = 'weight';
    }

    return {
      reps: this.workoutUtilsService.repsTargetAsString(
        userInputs.actualReps ??
        loggedSet?.repsLogged ??
        plannedSet.targetReps
      ),
      weight: weightValue,
      distance: this.getDistanceValue(
        userInputs.actualDistance ??
        loggedSet?.distanceLogged ??
        plannedSet.targetDistance
      ),
      duration: this.workoutUtilsService.durationTargetAsString(
        userInputs.actualDuration ??
        loggedSet?.durationLogged ??
        plannedSet.targetDuration
      ),
      rest: this.workoutUtilsService.restTargetAsString(
        userInputs.actualRest ??
        loggedSet?.restLogged ??
        plannedSet.targetRest
      ),
      weightIcon: weightIcon
    };
  }

  // Returns the planned rest duration for this set (in seconds)
  getSetRestDuration(exIndex: number, setIndex: number): number {
    const routine = this.routine();
    if (!routine) return 0;
    const exercise = routine.exercises[exIndex];
    const key = this.getSetOrderId(exIndex, setIndex);
    const userInputs = this.performanceInputValues()[key] || {};
    const userRest = userInputs.actualRest;

    // For supersets, always use the first exercise in the group
    if (exercise.supersetId) {
      const firstExIndex = routine.exercises.findIndex(
        ex => ex.supersetId === exercise.supersetId
      );
      if (firstExIndex !== -1) {
        const firstKey = `${firstExIndex}-${setIndex}`;
        const firstUserInputs = this.performanceInputValues()[firstKey] || {};
        const firstUserRest = firstUserInputs.actualRest;
        return getRestValue(firstUserRest);
      }
    }

    return getRestValue(userRest);
  }

  // Returns true if the rest timer for this set should be visible
  isRestTimerVisibleForSet(exIndex: number, setIndex: number): boolean {
    // Implement your logic to determine if this set's rest timer is running/visible
    // For example, you might track the currently active rest set:
    const routine = this.routine();
    if (!routine || !routine.exercises || routine.exercises.length === 0) return false;
    const exercise = routine.exercises?.[exIndex];
    if (!exercise || !exercise.sets || exercise.sets.length === 0) return false;
    const plannedSet = exercise.sets[setIndex];
    const key = this.getSetOrderId(exIndex, setIndex);
    const userInputs = this.performanceInputValues()[key] || {};
    const rest = userInputs.actualRest ?? plannedSet.targetRest;
    const hasRest = rest !== undefined && rest !== null && getRestValue(rest) !== 0;
    return hasRest;
  }

  restStartTimestamps: { [key: string]: number } = {};
  // Returns the remaining rest time for this set (in seconds)
  restTimerRemainingForSet(exIndex: number, setIndex: number): number {
    if (!this.isRestTimerVisibleForSet(exIndex, setIndex)) return 0;
    const restKey = this.getSupersetRestKey(exIndex, setIndex);
    const startTimestamp = this.restStartTimestamps?.[restKey];
    const duration = this.getSetRestDuration(exIndex, setIndex);
    if (!startTimestamp || !duration) return duration;
    const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
    const remaining = duration - elapsed;
    return Math.max(0, remaining);
  }

  // Returns how many seconds have elapsed since rest started for this set
  restTimerElapsedForSet(exIndex: number, setIndex: number): number {
    const duration = this.getSetRestDuration(exIndex, setIndex);
    const key = this.getSupersetRestKey(exIndex, setIndex);
    const startTimestamp = this.restStartTimestamps?.[key];

    // If set is not completed, do not show progress
    if (!this.isSetCompleted(exIndex, setIndex) || !startTimestamp) {
      return 0;
    }

    const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);

    // If enough time has passed since completion, fill the bar
    if (elapsed >= duration) {
      return duration;
    } else {
      // Otherwise, show the actual elapsed time
      return Math.max(0, elapsed);
    }
  }


  // Returns progress (0-100) as the bar fills up
  restTimerProgressForSet(exIndex: number, setIndex: number): number {
    const duration = this.getSetRestDuration(exIndex, setIndex);
    const elapsed = this.restTimerElapsedForSet(exIndex, setIndex);
    if (!duration || !this.isSetCompleted(exIndex, setIndex)) return 0;
    return Math.max(0, Math.min(100, (elapsed / duration) * 100));
  }

  getSupersetRestKey(exIndex: number, setIndex: number): string {
    const routine = this.routine();
    if (!routine) return this.getSetOrderId(exIndex, setIndex);
    const exercise = routine.exercises[exIndex];
    if (exercise.supersetId) {
      const firstExIndex = routine.exercises.findIndex(
        ex => ex.supersetId === exercise.supersetId
      );
      return `${firstExIndex}-${setIndex}`;
    }
    return this.getSetOrderId(exIndex, setIndex);
  }

  private compactRestInterval: any = null;
  private lastCompactRestBeepSecond: number | null = null;

  private alignRestStartTimestampsFromLog(): void {
    if (this.getRestTimerMode() !== this.restTimerModeEnum.Compact) return;
    const routine = this.routine();
    const log = this.currentWorkoutLog();
    if (!routine || !log.exercises) return;

    this.restStartTimestamps = {};

    routine.exercises.forEach((exercise, exIndex) => {
      exercise.sets.forEach((set, setIndex) => {
        const restValue = set.targetRest ? getRestValue(set.targetRest) : 0;
        if (restValue > 0) {
          // Find the matching logged exercise by id
          const logEx = log.exercises?.find(le => le.id === exercise.id);
          // Use plannedSetId logic for robust matching
          const plannedSetId = this.getPlannedSetId(exercise, set, setIndex);
          const loggedSet = logEx?.sets.find(s => s.plannedSetId === plannedSetId);
          if (loggedSet?.timestamp) {
            const restKey = this.getSupersetRestKey(exIndex, setIndex);
            this.restStartTimestamps[restKey] = new Date(loggedSet.timestamp).getTime();
          }
        }
      });
    });
  }

  getPlannedSetId(exercise: WorkoutExercise, set: ExerciseTargetSetParams, roundIndex: number = 0): string {
    return exercise.supersetId ? `${set.id}-round-${roundIndex}` : set.id;
  }

  getSetOrderId(exIndex: number, setIndex: number, roundIndex: number = 0): string {
    const routine = this.routine();
    if (!routine) return '';
    const exercise = routine.exercises[exIndex];
    // return exercise.supersetId ? `${exercise.id}-${setIndex}-round-${roundIndex}` : `${exercise.id}-${exIndex}-${setIndex}`;
    return exercise.supersetId ? `${exercise.id}-round-${setIndex}` : `${exercise.id}-${setIndex}`;
  }

  getSetOrderIdByExercise(exercise: WorkoutExercise, setIndex: number): string {
    if (!exercise) return '';
    return exercise.supersetId ? `${exercise.id}-round-${setIndex}` : `${exercise.id}-${setIndex}`;
  }

  addSectionExercise(exIndex: number): void {
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[exIndex];
    this.workoutSectionService.addSectionToExerciseModal(exercise).then(updatedExercise => {
      if (!updatedExercise) return;

      this.routine.update(r => {
        if (!r) return r;
        let updatedSections = r.sections ? [...r.sections] : [];

        const sortedSections = updatedSections.slice().sort(
          (a, b) => WORKOUT_SECTION_TYPE_ORDER[a.type] - WORKOUT_SECTION_TYPE_ORDER[b.type]
        );

        // Remove the exercise from all sections
        updatedSections = updatedSections.map(section => ({
          ...section,
          exercises: section.exercises.filter(ex => ex.id !== updatedExercise.id)
        }));

        // Remove any section that is now empty
        updatedSections = updatedSections.filter(section => section.exercises.length > 0);

        // Add to the new section
        if (updatedExercise.section) {
          let sectionIndex = updatedSections.findIndex(sec => sec.type === updatedExercise.section);
          if (sectionIndex === -1) {
            // Create new section if it doesn't exist
            const newSection: WorkoutSection = {
              type: updatedExercise.section,
              id: uuidv4(),
              titleI18nKey: this.translate.instant(`workoutSections.${updatedExercise.section}`),
              exercises: [updatedExercise]
            };
            updatedSections.push(newSection);
          } else {
            // Add to existing section if not already present
            const section = updatedSections[sectionIndex];
            if (!section.exercises.some(ex => ex.id === updatedExercise.id)) {
              updatedSections[sectionIndex] = {
                ...section,
                exercises: [...section.exercises, updatedExercise]
              };
            }
          }
        }

        const newExercises = r.exercises.map((ex, idx) =>
          idx === exIndex ? { ...ex, ...updatedExercise } : ex
        );
        return { ...r, exercises: newExercises, sections: updatedSections };
      });

      this.alignRestStartTimestampsFromLog();
    }).catch(error => {
      // handle any errors here
    });
  }


  addExerciseLog() {
    this.modalService.prompt({
      title: 'Log Set',
      confirmText: 'Save',
      fields: [
        // 1. Full Width (Default)
        {
          key: 'exerciseName',
          type: 'text',
          label: 'Exercise',
          value: 'Bench Press',
          cssClass: 'col-full' // Optional, as it's default
        },

        // 2. Left Column
        {
          key: 'weight',
          type: 'number',
          label: 'Weight (kg)',
          required: true,
          cssClass: 'col-half' // <--- MAGIC HERE
        },

        // 3. Right Column
        {
          key: 'reps',
          type: 'number',
          label: 'Reps',
          required: true,
          cssClass: 'col-half' // <--- MAGIC HERE
        },

        // 4. Full Width
        {
          key: 'notes',
          type: 'textarea',
          label: 'Notes',
          cssClass: 'col-full'
        }
      ]
    }).subscribe(res => console.log(res));
  }

  get orderedSections() {
    const routine = this.routine?.();
    if (!routine?.sections) return [];
    return [...routine.sections]
      .filter(section => section.type !== WorkoutSectionType.NONE)
      .sort(
        (a, b) =>
          (WORKOUT_SECTION_TYPE_ORDER[a.type] ?? 99) -
          (WORKOUT_SECTION_TYPE_ORDER[b.type] ?? 99)
      );
  }

  getIconPath(exIndex: number): string {
    // Optimization: Use the already loaded availableExercises array to avoid async calls
    const routine = this.routine();
    if (!routine || !routine.exercises || !routine.exercises.length || !routine.exercises[exIndex]) return '';
    const exerciseId = routine.exercises[exIndex].exerciseId;
    const baseExercise = this.availableExercises.find(ex => ex.id === exerciseId);
    if (!baseExercise) return '';
    return this.exerciseService.getIconPath(baseExercise.iconName);
  }

  isDarkTheme() {
    // Implement the logic to determine if the current theme is dark
    // This is a placeholder implementation
    return this.themeService.isDarkTheme();
  }


  /**
   * Shows a wizard to create a new routine from a template or blank.
   * Adapted for the current routine structure (signals, not forms).
   */
  async showCreationWizard(): Promise<void> {
    // Step 0: Template or Blank
    const templateResult = await this.alertService.showPromptDialog(
      this.translate.instant('workoutBuilder.wizard.templateOrBlankTitle'),
      this.translate.instant('workoutBuilder.wizard.templateOrBlankMsg'),
      [
        {
          name: 'routineTemplate',
          type: 'radio',
          label: this.translate.instant('workoutBuilder.wizard.templateOrBlankLabel'),
          value: 'blank',
          options: [
            { label: 'Blank (Custom)', value: 'blank' },
            { label: '3x3', value: '3x3' },
            { label: '5x5', value: '5x5' },
            { label: 'Push/Pull/Legs', value: 'ppl' },
            { label: '5/3/1', value: '531' }
          ],
          required: true
        }
      ],
      this.translate.instant('alertService.buttons.ok')
    );

    // IF NO WIZARD START COMPLETELY EMPTY WORKOUT
    if (!templateResult || !templateResult['routineTemplate']) {
      const emptyNewRoutine = {
        name: this.translate.instant('pausedWorkout.defaultRoutineName'),
        createdAt: new Date().toISOString(),
        goal: 'custom',
        exercises: [] as WorkoutExercise[],
      } as Routine;
      this.routine.set(emptyNewRoutine);
      this.startWorkout();
      return;
    };

    const routineTemplate = String(templateResult['routineTemplate']);
    if (routineTemplate !== 'blank') {
      await this.createRoutineFromTemplate(routineTemplate);
      return;
    }

    // Step 1: Routine Name
    const nameResult = await this.alertService.showPromptDialog(
      this.translate.instant('workoutBuilder.routineBuilder.nameLabel'),
      this.translate.instant('workoutBuilder.routineBuilder.nameWizardMsg'),
      [
        {
          name: 'routineName',
          type: 'text',
          label: this.translate.instant('workoutBuilder.routineBuilder.nameLabel'),
          placeholder: this.translate.instant('workoutBuilder.routineBuilder.namePlaceholder'),
          required: false,
          autofocus: true
        }
      ],
      this.translate.instant('alertService.buttons.ok')
    );
    if (!nameResult) return;
    if (!nameResult['routineName']) {
      nameResult['routineName'] = this.translate.instant('pausedWorkout.defaultRoutineName');
    }

    // Step 2: Routine Goal
    const routineGoals = [
      { value: 'hypertrophy', label: 'workoutBuilder.goals.hypertrophy' },
      { value: 'strength', label: 'workoutBuilder.goals.strength' },
      { value: 'endurance', label: 'workoutBuilder.goals.muscularEndurance' },
      { value: 'custom', label: 'workoutBuilder.goals.custom' }
    ];
    const goalResult = await this.alertService.showPromptDialog(
      this.translate.instant('workoutBuilder.routineBuilder.goalLabel'),
      this.translate.instant('workoutBuilder.routineBuilder.goalWizardMsg'),
      [
        {
          name: 'routineGoal',
          type: 'select',
          label: this.translate.instant('workoutBuilder.routineBuilder.goalLabel'),
          value: 'hypertrophy',
          options: routineGoals.map(g => ({
            label: this.translate.instant(g.label),
            value: g.value
          })),
          required: true
        }
      ],
      this.translate.instant('alertService.buttons.ok')
    );
    if (!goalResult || !goalResult['routineGoal']) return;

    // Set the routine signal with the new blank routine
    this.routine.set({
      name: nameResult['routineName'] as string,
      goal: goalResult['routineGoal'],
      exercises: [] as WorkoutExercise[],
      createdAt: new Date().toISOString()
    } as Routine);
    this._prefillPerformanceInputs();

    this.originalRoutineSnapshot.set(this.routine());
    this.cdr.detectChanges();
    this.startWorkout();
    this.toastService.success(this.translate.instant('workoutBuilder.wizard.templateCreated'), 3000);
  }

  /**
   * Creates a routine from a template and sets it as the current routine.
   * Adapted for the current routine structure (signals, not forms).
   */
  private async createRoutineFromTemplate(template: string) {
    // Use your WorkoutService's shared method
    const templateName = `${template} - ${this.translate.instant('workoutGenerator.routineName', { split: format(new Date(), 'yyyy-MM-dd') })}`;
    const routines = this.workoutService.generateRoutineFromTemplate(template, this.availableExercises, templateName);

    // For PPL/5/3/1, let user pick which routine to use, or just pick the first
    let routine: Routine;
    if (routines.length === 1) {
      routine = routines[0];
    } else {
      // Prompt user to pick which routine (e.g. Push, Pull, Legs)
      const pickResult = await this.alertService.showPromptDialog(
        this.translate.instant('workoutBuilder.wizard.pickRoutineTitle'),
        this.translate.instant('workoutBuilder.wizard.pickRoutineMsg'),
        [
          {
            name: 'routinePick',
            type: 'select',
            label: this.translate.instant('workoutBuilder.wizard.pickRoutineLabel'),
            value: routines[0].id,
            options: routines.map(r => ({ label: r.name, value: r.id })),
            required: true
          }
        ],
        this.translate.instant('alertService.buttons.ok')
      );
      if (!pickResult || !pickResult['routinePick']) return;
      routine = routines.find(r => r.id === pickResult['routinePick']) || routines[0];
    }

    // Set the routine signal with the template routine
    this.routine.set({ ...routine, createdAt: new Date().toISOString() });
    this.originalRoutineSnapshot.set({ ...routine, createdAt: new Date().toISOString() });
    this._prefillPerformanceInputs();
    this.cdr.detectChanges();
    this.toastService.success(this.translate.instant('workoutBuilder.wizard.templateCreated'), 3000);
  }

  isExerciseDetailModalOpen = signal(false);
  isSimpleModalOpen = signal(false);
  exerciseDetailsId: string = '';
  exerciseDetailsName: string = '';
  openModal(exerciseId: string, event?: Event) {
    event?.stopPropagation();
    this.exerciseDetailsId = exerciseId;
    this.exerciseDetailsName = 'Exercise details';
    this.isSimpleModalOpen.set(true);
  }

  private supersetSummaryCache = new Map<string, SetInfo[]>();
  /**
   * Returns an array of objects for each exercise in a superset round,
   * containing all info needed for metricInputSpan.
   * Each entry is for the set at roundIndex for each exercise in the superset group.
   * @param exIndex The index of any exercise in the superset group
   * @param roundIndex The round (set) index within the superset
   */
  getSupersetSummaryMetricsDetailed(
    exIndex: number,
    roundIndex: number
  ): SetInfo[] {
    // const cacheKey = `${exIndex}-${roundIndex}-${this.routine()?.exercises?.length ?? 0}`;
    // if (this.supersetSummaryCache.has(cacheKey)) {
    //   return this.supersetSummaryCache.get(cacheKey)!;
    // }

    const routine = this.routine();
    if (!routine) return [];
    const exercise = routine.exercises[exIndex];
    if (!exercise.supersetId) return [];

    const exercisesInGroup = this.getSupersetExercises(exercise.supersetId);

    // const result = exercisesInGroup
    return exercisesInGroup
      .map((ex): SetInfo[] => {
        const exIdx = this.getOriginalExIndex(ex.id);
        if (exIdx === -1) return [];
        const plannedSet = ex.sets[roundIndex];
        if (!plannedSet) return [];
        const loggedSet = this.getLoggedSet(exIdx, roundIndex);
        const key = this.getSetOrderId(exIdx, roundIndex);
        const userInputs = this.performanceInputValues()[key] || {};

        let weightIcon = 'body';
        let weightValue: any = this.workoutUtilsService.weightTargetAsString(
          userInputs.actualWeight ?? loggedSet?.weightLogged ?? plannedSet.targetWeight
        );
        const weightTargetType = this.getWeightTargetType(
          userInputs.actualWeight ?? loggedSet?.weightLogged ?? plannedSet.targetWeight
        );
        switch (weightTargetType) {
          case WeightTargetType.exact:
          case WeightTargetType.range:
          case WeightTargetType.percentage_1rm:
            weightIcon = 'weight';
            break;
          case WeightTargetType.bodyweight:
            break;
        }
        if (!isNaN(Number(weightValue)) && weightValue !== '') {
          weightValue = `${weightValue} ${this.unitsService.getWeightUnitSuffix()}`;
          weightIcon = 'weight';
        }

        const repsValue = this.workoutUtilsService.repsTargetAsString(
          userInputs.actualReps ?? loggedSet?.repsLogged ?? plannedSet.targetReps
        );
        const distanceValue = this.getDistanceValue(
          userInputs.actualDistance ?? loggedSet?.distanceLogged ?? plannedSet.targetDistance
        );
        const durationValue = this.workoutUtilsService.durationTargetAsString(
          userInputs.actualDuration ?? loggedSet?.durationLogged ?? plannedSet.targetDuration
        );

        return [
          {
            icon: 'repeat',
            iconClass: 'h-4 w-4 mr-0.5 inline-block',
            metric: METRIC.reps,
            value: repsValue,
            exIndex: exIdx,
            setIndex: roundIndex,
            suffix: this.translate.instant('compactPlayer.repsLabel'),
          },
          {
            icon: weightIcon,
            iconClass: 'h-5 w-5 mr-0.5 inline-block',
            metric: METRIC.weight,
            value: weightValue,
            exIndex: exIdx,
            setIndex: roundIndex,
            suffix: this.unitsService.getWeightUnitSuffix(),
          },
          {
            icon: 'distance',
            iconClass: 'h-4 w-4 mr-0.5 inline-block',
            metric: METRIC.distance,
            value: distanceValue,
            exIndex: exIdx,
            setIndex: roundIndex,
            suffix: this.unitsService.getDistanceUnitSuffix(),
          },
          {
            icon: 'timer',
            iconClass: 'h-4 w-4 mr-0.5 inline-block',
            metric: METRIC.duration,
            value: durationValue,
            exIndex: exIdx,
            setIndex: roundIndex,
            suffix: 's',
          },
        ];
      })
      .flat()
      .filter(
        (entry): entry is SetInfo =>
          !!entry &&
          entry.value !== undefined &&
          entry.value !== null &&
          entry.value !== '' &&
          entry.value !== 0
      );

    // this.supersetSummaryCache.set(cacheKey, result);
    // return result;
  }

  trackByMetric(index: number, metric: SetInfo) {
    // Use a unique combination of exIndex, setIndex, and metric type
    return `${metric.exIndex}-${metric.setIndex}-${metric.metric}`;
  }
  supersetSummaryMetrics = computed(() => {
    const routine = this.routine();
    const perfInputs = this.performanceInputValues();
    if (!routine) return {};

    const result: { [key: string]: SetInfo[] } = {};

    routine.exercises.forEach((exercise, exIndex) => {
      if (!exercise.supersetId) return;
      exercise.sets.forEach((set, roundIndex) => {
        const key = `${exIndex}-${roundIndex}`;
        // const key = `${this.getSupersetRestKey(exIndex, roundIndex)}`;
        result[key] = this._computeSupersetSummaryMetrics(exIndex, roundIndex, routine, perfInputs);
      });
    });

    return result;
  });

  private _computeSupersetSummaryMetrics(
    exIndex: number,
    roundIndex: number,
    routine: Routine,
    perfInputs: { [key: string]: Partial<ExerciseCurrentExecutionSetParams> }
  ): SetInfo[] {
    const exercise = routine.exercises[exIndex];
    if (!exercise.supersetId) return [];

    // Only get the metrics for THIS exercise at this round
    const plannedSet = exercise.sets[roundIndex];
    if (!plannedSet) return [];

    const loggedSet = this.getLoggedSet(exIndex, roundIndex);
    const key = this.getSetOrderId(exIndex, roundIndex);
    const userInputs = perfInputs[key] || {};

    let weightIcon = 'body';
    let weightValue: any = this.workoutUtilsService.weightTargetAsString(
      userInputs.actualWeight ?? loggedSet?.weightLogged ?? plannedSet.targetWeight
    );
    const weightTargetType = this.getWeightTargetType(
      userInputs.actualWeight ?? loggedSet?.weightLogged ?? plannedSet.targetWeight
    );
    switch (weightTargetType) {
      case WeightTargetType.exact:
      case WeightTargetType.range:
      case WeightTargetType.percentage_1rm:
        weightIcon = 'weight';
        break;
      case WeightTargetType.bodyweight:
        break;
    }
    if (!isNaN(Number(weightValue)) && weightValue !== '') {
      weightValue = `${weightValue} ${this.unitsService.getWeightUnitSuffix()}`;
      weightIcon = 'weight';
    }

    const repsValue = this.workoutUtilsService.repsTargetAsString(
      userInputs.actualReps ?? loggedSet?.repsLogged ?? plannedSet.targetReps
    );
    const distanceValue = this.getDistanceValue(
      userInputs.actualDistance ?? loggedSet?.distanceLogged ?? plannedSet.targetDistance
    );
    const durationValue = this.workoutUtilsService.durationTargetAsString(
      userInputs.actualDuration ?? loggedSet?.durationLogged ?? plannedSet.targetDuration
    );

    return [
      {
        icon: 'reps',
        iconClass: 'h-4 w-4 mr-0.5 inline-block',
        metric: METRIC.reps,
        value: repsValue,
        exIndex: exIndex,
        setIndex: roundIndex,
        suffix: this.translate.instant('compactPlayer.repsLabel'),
      },
      {
        icon: weightIcon,
        iconClass: 'h-4 w-4 mr-0.5 inline-block',
        metric: METRIC.weight,
        value: weightValue,
        exIndex: exIndex,
        setIndex: roundIndex,
        suffix: this.unitsService.getWeightUnitSuffix(),
      },
      {
        icon: 'distance',
        iconClass: 'h-4 w-4 mr-0.5 inline-block',
        metric: METRIC.distance,
        value: distanceValue,
        exIndex: exIndex,
        setIndex: roundIndex,
        suffix: this.unitsService.getDistanceUnitSuffix(),
      },
      {
        icon: 'timer',
        iconClass: 'h-4 w-4 mr-0.5 inline-block',
        metric: METRIC.duration,
        value: durationValue,
        exIndex: exIndex,
        setIndex: roundIndex,
        suffix: 's',
      },
    ].filter(
      (entry): entry is SetInfo =>
        !!entry &&
        entry.value !== undefined &&
        entry.value !== null &&
        entry.value !== '' &&
        entry.value !== 0
    );
  }

  /**
 * Checks if a set (standard) or round (superset) is completed.
 * For standard exercises, checks the set at setOrRoundIndex.
 * For supersets, checks all exercises in the group at setOrRoundIndex.
 * @param exIndex Index of the exercise in the routine
 * @param setOrRoundIndex Index of the set (for standard) or round (for superset)
 */
  isSetOrRoundCompleted(exIndex: number, setOrRoundIndex: number): boolean {
    const routine = this.routine();
    if (!routine) return false;
    const exercise = routine.exercises[exIndex];
    if (!exercise) return false;

    if (exercise.supersetId) {
      // Superset: check all exercises in the group for this round
      const exercisesInGroup = this.getSupersetExercises(exercise.supersetId);
      return exercisesInGroup.every(ex => {
        const originalExIndex = this.getOriginalExIndex(ex.id);
        return this.getLoggedSet(originalExIndex, setOrRoundIndex, setOrRoundIndex) !== undefined;
      });
    } else {
      // Standard: check just this set
      return this.getLoggedSet(exIndex, setOrRoundIndex) !== undefined;
    }
  }

}

export interface SetInfo {
  icon: string;
  iconClass: string;
  metric: METRIC;
  value: any;
  exIndex: number;
  setIndex: number;
  suffix: string;
}

// this.isSetCompleted(exIndex, setIndex)