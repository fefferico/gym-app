import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer, of, lastValueFrom, firstValueFrom, combineLatest } from 'rxjs';
import { switchMap, take, map } from 'rxjs/operators';
import {
  Routine,
  WorkoutExercise,
  ExerciseSetParams,
  ActiveSetInfo,
  PlayerSubState,
  PausedWorkoutState,
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
import { FullScreenRestTimerComponent } from '../../../shared/components/full-screen-rest-timer/full-screen-rest-timer';
import { TrainingProgram } from '../../../core/models/training-program.model';
import { AlertButton, AlertInput } from '../../../core/models/alert.model';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { addExerciseBtn, addRoundToExerciseBtn, addSetToExerciseBtn, addToSuperSetBtn, addWarmupSetBtn, createSuperSetBtn, openSessionPerformanceInsightsBtn, pauseSessionBtn, quitWorkoutBtn, removeExerciseBtn, removeFromSuperSetBtn, resumeSessionBtn, sessionNotesBtn, switchExerciseBtn } from '../../../core/services/buttons-data';

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
    ExerciseSelectionModalComponent, FormsModule, ActionMenuComponent, FullScreenRestTimerComponent,
    DragDropModule
  ],
  templateUrl: './compact-workout-player.component.html',
  styleUrls: ['./compact-workout-player.component.scss'],
  providers: [DecimalPipe, WeightUnitPipe],
})
export class CompactWorkoutPlayerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  protected router = inject(Router);
  private workoutService = inject(WorkoutService);
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
  private platformId = inject(PLATFORM_ID);

  private unitService = inject(UnitsService);

  isAddToSupersetModalOpen = signal(false);
  exerciseToSupersetIndex = signal<number | null>(null);

  lastExerciseIndex = signal<number>(-1);
  lastExerciseSetIndex = signal<number>(-1);

  // +++ NEW: To hold reference to the last completed set for updating its rest time after the timer finishes
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

  currentStepInfo: NextStepInfo = { completedExIndex: -1, completedSetIndex: -1, exerciseSetLength: -1, maxExerciseIndex: -1 };

  isRestTimerVisible = signal(false);
  restDuration = signal(0);
  restTimerMainText = signal('RESTING');
  restTimerNextUpText = signal<string | null>(null);
  // +++ NEW: Signal to hold detailed info for the next set for the rest timer screen
  restTimerNextSetDetails = signal<ExerciseSetParams | null>(null);

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

  workoutProgress = computed(() => {
    const routine = this.routine();
    const log = this.currentWorkoutLog();

    if (!routine || routine.exercises.length === 0) {
      return 0;
    }

    let totalPlannedSets = 0;

    routine.exercises.forEach(exercise => {
      if (exercise.supersetId) {
        // Only process a superset group ONCE, when we see the first exercise.
        if (exercise.supersetOrder === 0) {
          const groupExercises = routine.exercises.filter(ex => ex.supersetId === exercise.supersetId);
          const setsInOneRound = groupExercises.reduce((sum, ex) => sum + ex.sets.length, 0);
          // *** FIX: Use `supersetRounds` for supersets, not `rounds`. ***
          const totalRounds = exercise.supersetRounds || 1;
          totalPlannedSets += setsInOneRound * totalRounds;
        }
      } else {
        // For standard exercises, the total is simply the number of sets in its array.
        // We IGNORE the `rounds` property for this calculation to match the UI.
        totalPlannedSets += exercise.sets.length;
      }
    });

    if (totalPlannedSets === 0) {
      return 0;
    }

    const totalCompletedSets = log.exercises?.reduce((total, ex) => total + ex.sets.length, 0) || 0;
    return Math.min(100, (totalCompletedSets / totalPlannedSets) * 100);
  });

  filteredExercisesForSwitchModal = computed(() => {
    const term = this.modalSearchTerm().toLowerCase();
    if (this.isShowingSimilarInSwitchModal()) {
      return this.exercisesForSwitchModal();
    }
    if (!term) {
      return this.availableExercises;
    }
    const normalizedTerm = this.exerciseService.normalizeExerciseNameForSearch(term);
    return this.availableExercises.filter(ex =>
      ex.name.toLowerCase().includes(normalizedTerm) ||
      ex.category?.toLowerCase().includes(normalizedTerm) ||
      ex.primaryMuscleGroup?.toLowerCase().includes(normalizedTerm)
    );
  });

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
  }

  ngOnDestroy(): void {
    if (!this.isSessionConcluded && (this.sessionState() === SessionState.Playing || this.sessionState() === SessionState.Paused)) {
      this.savePausedSessionState();
    }
    this.timerSub?.unsubscribe();
    this.routeSub?.unsubscribe();
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
      if (routine) {

        // +++ NEW: PERCEIVED EFFORT CHECK - START +++
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
            dialogTitle = 'Last Workout Was Tough';
            dialogMessage = 'Your last session felt challenging. Would you like to automatically reduce the intensity for today?';
          } else if (effort <= 4) {
            adjustmentType = 'increase';
            dialogTitle = 'Last Workout Felt Light';
            dialogMessage = 'Your last session felt light. Would you like to automatically increase the intensity for today?';
          }

          if (adjustmentType) {
            const prompt = await this.alertService.showPromptDialog(
              dialogTitle, dialogMessage,
              [{
                name: 'percentage', type: 'number', placeholder: 'e.g., 10', value: 10,
                attributes: { min: '1', max: '50', step: '1' }
              }] as AlertInput[],
              `Adjust by %`, 'NO, THANKS'
            );

            if (prompt && prompt['percentage']) {
              const percentage = Number(prompt['percentage']);
              // Store the adjustment preference instead of applying it immediately
              this.intensityAdjustment = { direction: adjustmentType, percentage };
              this.toastService.success(`Routine intensity will be adjusted by ${percentage}%`, 3000, "Intensity Adjusted");
            }
          }
        }
        // +++ NEW: PERCEIVED EFFORT CHECK - END +++

        this.routine.set(routineForSession); // Use the (potentially unmodified) routine copy
        this.originalRoutineSnapshot.set(JSON.parse(JSON.stringify(routine))); // Snapshot is always the true original
        await this.prefillRoutineWithLastPerformance();
        if (this.programId) {
          this.program.set(await firstValueFrom(this.trainingProgramService.getProgramById(this.programId)));
        }
        this.startWorkout();
      } else {
        const emptyNewRoutine = {
          name: "New session",
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

    const routineCopy = JSON.parse(JSON.stringify(currentRoutine)) as Routine;

    for (const exercise of routineCopy.exercises) {
      try {
        const lastPerformance = await firstValueFrom(
          this.trackingService.getLastPerformanceForExercise(exercise.exerciseId)
        );

        if (lastPerformance && lastPerformance.sets.length > 0) {
          exercise.sets.forEach((set, setIndex) => {
            const historicalSet = lastPerformance.sets[setIndex];
            if (historicalSet) {
              set.reps = historicalSet.repsAchieved ?? set.reps;
              set.weight = historicalSet.weightUsed ?? set.weight;
              set.duration = historicalSet.durationPerformed ?? set.duration;
              set.distance = historicalSet.distanceAchieved ?? set.distance;
            }

            // +++ NEW: APPLY SESSION-WIDE INTENSITY ADJUSTMENT - START +++
            // Check if an adjustment is active for this session
            if (this.intensityAdjustment) {
              const { direction, percentage } = this.intensityAdjustment;
              const multiplier = direction === 'increase' ? 1 + (percentage / 100) : 1 - (percentage / 100);

              if (set.weight != null) {
                const adjustedWeight = Math.round((set.weight * multiplier) * 4) / 4;
                set.weight = adjustedWeight >= 0 ? adjustedWeight : 0;
              }
              if (set.reps != null) {
                const adjustedReps = Math.round(set.reps * multiplier);
                set.reps = adjustedReps >= 0 ? adjustedReps : 0;
              }
              if (set.duration != null) {
                const adjustedDuration = Math.round(set.duration * multiplier);
                set.duration = adjustedDuration >= 0 ? adjustedDuration : 0;
              }
            }
            // +++ NEW: APPLY SESSION-WIDE INTENSITY ADJUSTMENT - END +++
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
      notes: '', // +++ NEW: Initialize notes field
    });
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

  isSetDataValid(exIndex: number, setIndex: number): boolean {
    const set = this.routine()?.exercises[exIndex]?.sets[setIndex];
    if (!set) return false;

    const exercise = this.routine()!.exercises[exIndex];

    // Cardio validation remains the same
    if (this.isCardio(exercise)) {
      return (set.distance ?? 0) > 0 || (set.duration ?? 0) > 0;
    }

    // For non-cardio exercises:
    // If a weight is specified (even 0), it's treated as a weighted set.
    // Both reps and weight must be positive.
    if (set.weight != null && set.weight != undefined) {
      return (set.reps ?? 0) > 0 && set.weight > 0;
    }

    // If weight is not specified (null/undefined), it's a bodyweight exercise.
    // Only reps need to be positive.
    return (set.reps ?? 0) > 0;
  }
  getLoggedSet(exIndex: number, setIndex: number, roundIndex: number = 0): LoggedSet | undefined {
    const exercise = this.routine()?.exercises[exIndex];
    if (!exercise) return undefined;

    const exerciseLog = this.currentWorkoutLog()?.exercises?.find(e => e.exerciseId === exercise.exerciseId);
    if (!exerciseLog) return undefined;

    const plannedSetId = exercise.sets[setIndex]?.id;

    const isMultiRound = (exercise.supersetRounds || exercise.rounds || 1) > 1;
    const targetLoggedSetId = isMultiRound ? `${plannedSetId}-round-${roundIndex}` : plannedSetId;

    return exerciseLog.sets.find(s => s.plannedSetId === targetLoggedSetId);
  }

  /**
   * Checks if all sets for all exercises in a superset group for a specific round are completed.
   */
  isRoundCompleted(exercise: WorkoutExercise, roundIndex: number): boolean {
    const routine = this.routine();
    if (!routine || !exercise.supersetId) return false;

    const exercisesInGroup = routine.exercises.filter(ex => ex.supersetId === exercise.supersetId);

    return exercisesInGroup.every(groupEx => {
      const currentExIndex = routine.exercises.indexOf(groupEx);
      return groupEx.sets.every((set, setIndex) =>
        this.isSetCompleted(currentExIndex, setIndex, roundIndex)
      );
    });
  }

  isSetCompleted(exIndex: number, setIndex: number, roundIndex?: number): boolean {
    // If roundIndex is not provided (from older calls), default to 0.
    return !!this.getLoggedSet(exIndex, setIndex, roundIndex ?? 0);
  }

  isExerciseLogged(exIndex: number): boolean {
    return !!this.currentWorkoutLog()?.exercises?.find((e, index) => index === exIndex);
  }

  toggleSetCompletion(exercise: WorkoutExercise, set: ExerciseSetParams, exIndex: number, setIndex: number, roundIndex: number): void {
    const log = this.currentWorkoutLog();
    if (!log.exercises) log.exercises = [];

    let exerciseLog = log.exercises.find(e => e.id === exercise.id);
    const wasCompleted = !!this.getLoggedSet(exIndex, setIndex, roundIndex);

    const isMultiRound = (exercise.supersetRounds || exercise.rounds || 1) > 1;
    const targetLoggedSetId = isMultiRound ? `${set.id}-round-${roundIndex}` : set.id;

    if (wasCompleted) {
      if (exerciseLog) {
        const existingIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === targetLoggedSetId);
        if (existingIndex > -1) {
          exerciseLog.sets.splice(existingIndex, 1);
        }
        if (exerciseLog.sets.length === 0) {
          const emptyLogIndex = log.exercises.findIndex(e => e.id === exerciseLog!.id);
          if (emptyLogIndex > -1) log.exercises.splice(emptyLogIndex, 1);
        }
      }
    } else {
      if (!exerciseLog) {
        exerciseLog = {
          id: exercise.id,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName!,
          sets: [],
          type: exercise.type || 'standard',
          supersetId: exercise.supersetId,
          supersetRounds: exercise.supersetRounds,
          rounds: exercise.rounds
        };
        log.exercises.push(exerciseLog);
      }
      const newLoggedSet: LoggedSet = {
        id: uuidv4(),
        exerciseName: exercise.exerciseName,
        plannedSetId: targetLoggedSetId,
        exerciseId: exercise.exerciseId,
        type: set.type,
        repsAchieved: set.reps ?? 0,
        weightUsed: set.weight || 0,
        durationPerformed: set.duration,
        distanceAchieved: set.distance,
        timestamp: new Date().toISOString(),
        notes: set.notes,
        targetRestAfterSet: set.restAfterSet,
        supersetCurrentRound: isMultiRound ? roundIndex : undefined
      };
      exerciseLog.sets.push(newLoggedSet);
    }

    this.currentWorkoutLog.set({ ...log });
    this.savePausedSessionState();
    this.lastExerciseIndex.set(exIndex);
    this.lastExerciseSetIndex.set(setIndex);
    this.workoutService.vibrate();

    const shouldStartRest = set.restAfterSet && set.restAfterSet > 0 &&
      (!this.isSuperSet(exIndex) || (this.isSuperSet(exIndex) && this.isEndOfLastSupersetExercise(exIndex, setIndex)));

    // Only start rest timer when a set is marked as *complete*
    if (shouldStartRest && !wasCompleted) {
      this.lastLoggedSetForRestUpdate = this.getLoggedSet(exIndex, setIndex, roundIndex) ?? null;
      this.startRestPeriod(set.restAfterSet, exIndex, setIndex);
    }
  }

  // +++ ADD THIS NEW HELPER METHOD +++
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
              case 'reps': setLog.repsAchieved = parseFloat(value) || 0; break;
              case 'weight': setLog.weightUsed = parseFloat(value) || undefined; break;
              case 'distance': setLog.distanceAchieved = parseFloat(value) || 0; break;
              case 'time': setLog.durationPerformed = this.parseTimeToSeconds(value); break;
              case 'notes': setLog.notes = value; break;
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

  updateSetData(exIndex: number, setIndex: number, roundIndex: number, field: 'reps' | 'weight' | 'distance' | 'time' | 'notes', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const routine = this.routine();
    if (!routine) return;

    const exercise = routine.exercises[exIndex];
    const set = exercise.sets[setIndex];

    switch (field) {
      case 'reps': set.reps = parseFloat(value) || 0; break;
      case 'weight': set.weight = parseFloat(value) || undefined; break;
      case 'distance': set.distance = parseFloat(value) || 0; break;
      case 'time': set.duration = this.parseTimeToSeconds(value); break;
      case 'notes': set.notes = value; break;
    }
    this.routine.set({ ...routine });

    if (this.isSetCompleted(exIndex, setIndex, roundIndex)) {
      this.updateSetDataForRound(exercise, setIndex, roundIndex, field, value);
    }
  }

  // +++ NEW: Method to update exercise-level notes
  updateExerciseNotes(exIndex: number, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.routine.update(r => {
      if (r) {
        r.exercises[exIndex].notes = value;

        // Also update the log in real-time if the exercise is already logged
        const log = this.currentWorkoutLog();
        const loggedEx = log.exercises?.find(ex => ex.id === r.exercises[exIndex].id);
        if (loggedEx) {
          loggedEx.notes = value;
          this.currentWorkoutLog.set({ ...log });
        }
      }
      return r;
    });
  }

  // +++ NEW: Method to open a prompt for session-level notes
  async editSessionNotes() {
    const result = await this.alertService.showPromptDialog(
      'Session Notes',
      'Add or edit notes for this entire workout session.',
      [{
        name: 'notes',
        type: 'text',
        placeholder: `Insert notes here`,
        value: this.currentWorkoutLog().notes ?? undefined,
        autofocus: this.currentWorkoutLog().notes ? false : true
      }] as AlertInput[],
      'Save Notes',
      'Cancel',
      [{
        role: 'confirm',
        text: 'Save notes',
        icon: 'save',
        data: true
      } as AlertButton]
    );

    if (result && result['notes'] !== undefined && result['notes'] !== null) {
      this.currentWorkoutLog.update(log => {
        log.notes = String(result['notes']) || '';
        return log;
      });
      this.toastService.success("Session notes updated.");
    }
  }

  getInitialExerciseNoteInputValue(exIndex: number): string {
    const exercise = this.routine()!.exercises[exIndex];
    if (exercise) {
      return exercise.notes || '';
    }
    return '';
  }

  getInitialInputValue(exIndex: number, setIndex: number, field: 'reps' | 'weight' | 'distance' | 'time' | 'notes'): string {
    const set = this.routine()!.exercises[exIndex].sets[setIndex];
    switch (field) {
      case 'reps': return (set.reps ?? '').toString();
      case 'weight': return (set.weight ?? '').toString();
      case 'distance': return (set.distance ?? '').toString();
      case 'time': return this.formatSecondsToTime(set.duration);
      // +++ NEW: Handle notes initial value
      case 'notes': return set.notes || '';
    }
    return '';
  }

  parseTimeToSeconds(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.split(':').map(part => parseInt(part, 10) || 0);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  }

  formatSecondsToTime(totalSeconds: number | undefined): string {
    if (totalSeconds == null) return '';
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  }

  toggleExerciseExpansion(index: number): void {
    this.expandedExerciseIndex.update(current => current === index ? null : index);
  }

  // +++ NEW: Signals and methods to toggle notes visibility for sets and exercises
  expandedExerciseNotes = signal<number | null>(null);
  expandedSetNotes = signal<string | null>(null); // Key will be "exIndex-setIndex"

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
      this.toastService.info("No sets logged. Workout not saved.", 3000);
      return;
    }

    // 1. Analyze completion to decide the prompt's tone (Finish vs. Finish Early)
    const analysis = this.analyzeWorkoutCompletion();
    const hasIncomplete = analysis.incompleteExercises.length > 0 || analysis.skippedExercises.length > 0;
    const title = hasIncomplete ? "Finish Workout Early?" : "Finish Workout";
    let message = hasIncomplete
      ? `You have ${analysis.skippedExercises.length} skipped and ${analysis.incompleteExercises.length} incomplete exercises. Finish anyway?`
      : 'Are you sure you want to finish and save this workout?';

    const confirmFinish = await this.alertService.showConfirm(title, message, 'Finish', 'Cancel');
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
          "Routine Structure Changed", "You made some changes to the routine. What would you like to do?",
          [
            { text: "Just Log This Session", role: "log", data: "log", cssClass: "bg-purple-600", icon: 'schedule' } as AlertButton,
            { text: "Update Original Routine", role: "destructive", data: "update", cssClass: "bg-blue-600", icon: 'save' } as AlertButton,
            { text: "Save as New Routine", role: "confirm", data: "new", cssClass: "bg-green-600", icon: 'create-folder' } as AlertButton,
          ],
          { listItems: differences.details }
        );

        if (choice?.data === 'new') {
          const nameInput = await this.alertService.showPromptDialog("New Routine Name", "Enter a name:", [{ name: "newRoutineName", type: "text", value: newRoutineName, attributes: { required: true } }], "Save Routine");
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
        "Save as New Routine", "Enter a name for this workout routine:",
        [{ name: "newRoutineName", type: "text", value: newRoutineName, attributes: { required: true } }],
        "Create Routine & Log", 'Just Log',
        [{ text: "Just Log without Saving", role: "no_save", data: "cancel", cssClass: "bg-primary text-white", icon: 'schedule' } as AlertButton], false
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
      this.toastService.info("Finish workout cancelled.", 3000);
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
      this.toastService.success(`New routine "${createdRoutine.name}" created.`);
    }

    if (updateOriginalRoutineStructure && finalRoutineIdToLog) {
      const routineToUpdate = await firstValueFrom(this.workoutService.getRoutineById(finalRoutineIdToLog).pipe(take(1)));
      if (routineToUpdate) {
        routineToUpdate.exercises = this.convertLoggedToWorkoutExercises(loggedExercisesForReport);
        this.workoutService.updateRoutine(routineToUpdate, true);
        this.toastService.success(`Routine "${routineToUpdate.name}" has been updated.`);
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
          this.toastService.success(`Congrats! Program completed!`, 5000, "Program Finished", false);
          this.router.navigate(['/training-programs/completed', savedLog.programId], { queryParams: { logId: savedLog.id } });
          return;
        }
      }
      this.router.navigate(['/workout/summary', savedLog.id], {
        queryParams: { newlyCompleted: 'true' }
      });

    } else {
      this.toastService.error("Could not save: missing start time.");
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
      case 'switch': this.openSwitchExerciseModal(exIndex); break;
      case 'insights': this.openPerformanceInsightsModal(exIndex); break;
      case 'add_set': this.addSet(exIndex); break;
      case 'add_round': {
        const superSetId: string = this.retrieveSuperSetIdAndAddRound(exIndex);
        if (superSetId) {
          this.addRoundToSuperset(superSetId);
        }
        break
      };
      case 'add_warmup': this.addWarmupSet(exIndex); break;
      case 'remove': this.removeExercise(exIndex); break;
      // +++ NEW CASES FOR SUPERSET +++
      case 'create_superset': this.openCreateSupersetModal(exIndex); break;
      case 'add_to_superset': this.addToSupersetModal(exIndex); break;
      case 'remove_from_superset': this.removeFromSuperset(exIndex); break;
    }
  }

  addWarmupSet(exIndex: number) {
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[exIndex];
    const firstSet = exercise.sets[0];
    const newWarmupSet: ExerciseSetParams = {
      id: uuidv4(), reps: 12, weight: firstSet?.weight ? parseFloat((firstSet.weight / 2).toFixed(1)) : 0,
      restAfterSet: 30, type: 'warmup'
    };
    exercise.sets.unshift(newWarmupSet);

    // +++ FIX: Return a new object reference to trigger computed signal recalculation +++
    this.routine.set({ ...routine });

    this.toastService.success(`Warm-up set added to ${exercise.exerciseName}`);
    if (this.expandedExerciseIndex() !== exIndex) {
      this.expandedExerciseIndex.set(exIndex);
    }
  }

  addSet(exIndex: number, type: 'standard' | 'warmup' = 'standard') {
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[exIndex];
    const lastSet = exercise.sets[exercise.sets.length - 1] ?? exercise.sets[0];

    const newSet: ExerciseSetParams = {
      id: uuidv4(),
      reps: type === 'warmup' ? 12 : lastSet?.reps ?? 8,
      weight: type === 'warmup' ? (lastSet?.weight ? parseFloat((lastSet.weight / 2).toFixed(1)) : 0) : (lastSet?.weight ?? 10),
      restAfterSet: lastSet?.restAfterSet ?? 60,
      type: type,
    };

    if (type === 'warmup') exercise.sets.unshift(newSet);
    else exercise.sets.push(newSet);

    // +++ FIX: Return a new object reference to trigger computed signal recalculation +++
    this.routine.set({ ...routine });

    this.toastService.success(`${type === 'warmup' ? 'Warm-up set' : 'Set'} added to ${exercise.exerciseName}`);
    if (this.expandedExerciseIndex() !== exIndex) {
      this.expandedExerciseIndex.set(exIndex);
    }
  }

  async removeSet(exIndex: number, setIndex: number) {
    const routine = this.routine();
    if (!routine) return;

    const exercise = routine.exercises[exIndex];

    // --- NEW: SUPERSET-AWARE LOGIC ---
    if (exercise.supersetId) {
      const roundIndex = setIndex; // In supersets, the setIndex IS the roundIndex.
      const confirm = await this.alertService.showConfirm(
        "Remove Round",
        `This will remove Round ${roundIndex + 1} from all exercises in this superset and clear any logged data for it. Are you sure?`
      );

      if (!confirm?.data) return;

      const supersetId = exercise.supersetId;
      const exercisesInGroup = routine.exercises.filter(ex => ex.supersetId === supersetId);

      // Remove the set (round) from the routine definition for each exercise in the group
      exercisesInGroup.forEach(groupEx => {
        if (groupEx.sets.length > roundIndex) {
          groupEx.sets.splice(roundIndex, 1);
        }
      });

      // Update the total supersetRounds for all exercises in the group
      const newRoundCount = exercisesInGroup[0]?.sets.length || 0;
      exercisesInGroup.forEach(groupEx => {
        groupEx.supersetRounds = newRoundCount;
      });

      // Remove ALL logged sets for this round across the entire superset group
      this.currentWorkoutLog.update(log => {
        log.exercises?.forEach(loggedEx => {
          if (loggedEx.supersetId === supersetId) {
            // Find the plannedSetIds for this specific round across all exercises in the superset
            const setToRemoveIds = exercisesInGroup.map(ex => `${ex.sets[roundIndex]?.id}-round-${roundIndex}`);

            // Filter out any logged sets that correspond to this round
            loggedEx.sets = loggedEx.sets.filter(s => s.supersetCurrentRound !== roundIndex);
          }
        });
        return { ...log };
      });

      if (newRoundCount === 0) {
        routine.exercises = routine.exercises.filter(exercise => exercise.supersetId !== supersetId);
      }

      this.routine.set({ ...routine });

      if (newRoundCount === 0) {
        this.toastService.info(`Superset removed entirely.`);
      } else {
        this.toastService.info(`Round ${roundIndex + 1} removed from the superset.`);
      }

    } else {
      // --- STANDARD EXERCISE LOGIC (remains the same) ---
      const setToRemove = exercise.sets[setIndex];
      const isLastSet = exercise.sets.length === 1;

      let confirmMessage = `Are you sure you want to remove this set from ${exercise.exerciseName}?`;
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
      exercise.sets.splice(setIndex, 1);

      if (exercise.sets.length === 0) {
        this.removeExercise(exIndex);
      } else {
        this.routine.set({ ...routine });
        this.toastService.info(`Set removed from ${exercise.exerciseName}`);
      }
    }
  }


  async removeExercise(exIndex: number) {
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[exIndex];

    const isExerciseLogged = this.isExerciseLogged(exIndex);
    const confirm = isExerciseLogged
      ? await this.alertService.showConfirm("Remove Exercise", `Are you sure you want to remove ${exercise.exerciseName}? All logged data for this exercise in this session will be lost.`)
      : { data: true };

    if (confirm?.data) {
      // +++ MODIFICATION START +++
      const supersetIdToRemoveFrom = exercise.supersetId;
      // +++ MODIFICATION END +++

      routine.exercises.splice(exIndex, 1);

      // +++ MODIFICATION START +++
      // If the removed exercise was part of a superset, clean up the remaining members.
      if (supersetIdToRemoveFrom) {
        const remainingInSuperset = routine.exercises.filter(ex => ex.supersetId === supersetIdToRemoveFrom);

        // If only one (or zero) exercises are left, it's no longer a superset.
        if (remainingInSuperset.length <= 1) {
          remainingInSuperset.forEach(ex => {
            ex.supersetId = null;
            ex.supersetOrder = null;
            ex.supersetSize = null;
            ex.supersetRounds = null;
            ex.type = 'standard';
            // Also clean the round markers from the sets
            // ex.sets.forEach(set => set.supersetRound = undefined);
          });
          if (remainingInSuperset.length > 0) {
            this.toastService.info("Superset dissolved as only one exercise remains.");
          }
        } else {
          // Otherwise, just update the order and size for the remaining exercises.
          remainingInSuperset
            .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0))
            .forEach((ex, i) => {
              ex.supersetOrder = i;
              ex.supersetSize = remainingInSuperset.length;
            });
        }
      }
      // +++ MODIFICATION END +++

      this.routine.set({ ...routine });

      const log = this.currentWorkoutLog();
      if (log.exercises) {
        const logExIndex = log.exercises.findIndex(le => le.id === exercise.id);
        if (logExIndex > -1) {
          log.exercises.splice(logExIndex, 1);
          this.currentWorkoutLog.set({ ...log });
        }
      }
      this.toastService.info(`${exercise.exerciseName} removed`);
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
    this.isSwitchExerciseModalOpen.set(true);
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

  // +++ NEW: Replaces old addExerciseToRoutine +++
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
      r?.exercises.push(newWorkoutExercise);
      if (r) this.expandedExerciseIndex.set(r.exercises.length - 1);
      return r;
    });
    // this.toastService.success(`${newWorkoutExercise.exerciseName} added to workout.`);
    this.closeAddExerciseModal();
  }

  handleExerciseSwitch(newExercise: Exercise) {
    const index = this.exerciseToSwitchIndex();
    if (index === null) return;

    this.routine.update(r => {
      if (r) {
        const oldWorkoutExercise = r.exercises[index];
        const oldExerciseName = oldWorkoutExercise.exerciseName;

        // +++ NEW: Logic to check categories and clear incompatible data
        const oldBaseExercise = this.availableExercises.find(ex => ex.id === oldWorkoutExercise.exerciseId);
        const newBaseExercise = this.availableExercises.find(ex => ex.id === newExercise.id);

        if (oldBaseExercise && newBaseExercise && oldBaseExercise.category !== newBaseExercise.category) {
          this.toastService.info(`Switching exercise type. Set data will be reset.`, 3000);
          oldWorkoutExercise.sets.forEach(set => {
            if (newBaseExercise.category === 'cardio') {
              set.weight = undefined;
              set.reps = undefined;
              set.distance = set.distance ?? 1; // Default cardio values
              set.duration = set.duration ?? 300;
            } else { // Assuming switch to strength or other non-cardio
              set.distance = undefined;
              set.duration = undefined;
              set.weight = set.weight ?? 10; // Default strength values
              set.reps = set.reps ?? 8;
            }
          });
        }
        // +++ END NEW LOGIC

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
      this.modalSearchTerm.set('');
      this.exercisesForSwitchModal.set(similar);
      this.isShowingSimilarInSwitchModal.set(true);
    } catch (error) {
      this.toastService.error("Could not load similar exercises.");
    }
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

  mainSessionActionItems = computed<ActionMenuItem[]>(() => {
    const wFullClass = this.getMenuMode() === 'compact' ? '' : ' w-full';
    const defaultBtnClass = 'rounded text-left p-3 sm:px-4 sm:py-2 font-medium text-white hover:bg-blue-600 flex items-center hover:text-white dark:hover:text-gray-100 dark:hover:text-white' + wFullClass;

    // Read signals once for the computation
    const isPaused = this.sessionState() === 'paused';
    const hasExercises = (this.routine()?.exercises?.length ?? 0) > 0;

    const addExerciseDisabledClass = (isPaused || !hasExercises ? 'disabled ' : '');

    const currAddExerciseBtn = {
      ...addExerciseBtn,
      buttonClass: addExerciseDisabledClass + defaultBtnClass,
    } as ActionMenuItem;

    const actions: ActionMenuItem[] = [
      isPaused ? resumeSessionBtn : pauseSessionBtn,
      sessionNotesBtn,
      currAddExerciseBtn,
      { isDivider: true },
      quitWorkoutBtn
    ];

    return actions;
  });


  handleMainSessionActionMenuItemClick(event: { actionKey: string, data?: any }) {
    const { actionKey } = event;
    switch (actionKey) {
      case 'pause': this.pauseSession(); break;
      case 'play': this.resumeSession(); break;
      case 'session_notes': this.editSessionNotes(); break;
      case 'addExercise': this.openAddExerciseModal(); break;
      case 'exit': this.quitWorkout(); break;
    }
  }

  async quitWorkout(): Promise<void> {
    const confirmQuit = await this.alertService.showConfirm("Quit Workout", 'Quit workout? Unsaved progress (if not paused) will be lost');
    if (confirmQuit && confirmQuit.data) {
      this.isSessionConcluded = true;
      this.toggleMainSessionActionMenu(null);
      this.router.navigate(['/workout']);
      this.toastService.info("Workout quit. No progress saved for this session", 4000);
    }
  }

  retrieveExerciseSetIndex(exIndex: number, setIndex: number): number {
    const isSuperSet = this.isSuperSet(exIndex);
    // const ex = this.routine()?.exercises[exIndex];
    return (isSuperSet ? 0 : setIndex) + 1;
  }

  /**
   * Creates an array of numbers from 0 to count-1.
   * This is a utility for creating loops in the template for rounds.
   * @param count The number of rounds.
   * @returns An array like [0, 1, 2, ...].
   */
  getRoundIndices(count: number | null | undefined): number[] {
    const rounds = count || 1;
    return Array.from({ length: rounds }, (_, i) => i);
  }


  compactActionItemsMap = computed<Map<number, ActionMenuItem[]>>(() => {
    const map = new Map<number, ActionMenuItem[]>();
    const routine = this.routine(); // Read the dependency signal once
    const mode = this.getMenuMode(); // Read the mode once

    if (!routine) {
      return map; // Return an empty map if there's no routine
    }

    // Loop through each exercise and build its specific action item array
    routine.exercises.forEach((exercise, exIndex) => {
      // --- All logic from the original method is now inside this loop ---
      const currSwitchExerciseBtn = { ...switchExerciseBtn, data: { exIndex } };
      const currOpenPerformanceInsightsBtn = { ...openSessionPerformanceInsightsBtn, data: { exIndex } };

      const addSetRoundBtn = !this.isSuperSet(exIndex) ? { ...addSetToExerciseBtn } : { ...addRoundToExerciseBtn };
      const actionsArray: ActionMenuItem[] = [
        currSwitchExerciseBtn,
        currOpenPerformanceInsightsBtn,
        { ...addWarmupSetBtn, data: { exIndex } } as ActionMenuItem,
        { ...addSetRoundBtn, data: { exIndex } } as ActionMenuItem,
        { isDivider: true },
        { ...removeExerciseBtn, data: { exIndex } },
      ];

      // RULE 1: "Remove from Superset"
      if (exercise?.supersetId) {
        actionsArray.push({ ...removeFromSuperSetBtn, data: { exIndex } } as ActionMenuItem);
      } else {
        // RULES 2 & 3: "Add to" and "Create Superset"
        if (routine.exercises.length >= 2) {
          if (routine.exercises.some(ex => ex.supersetId)) {
            actionsArray.push({ ...addToSuperSetBtn, data: { exIndex } });
          }
          if (routine.exercises.filter(ex => !ex.supersetId).length >= 2) {
            actionsArray.push({ ...createSuperSetBtn, data: { exIndex } });
          }
        }
      }

      // Set the generated array in the map with the exercise's index as the key
      map.set(exIndex, actionsArray);
    });

    return map;
  });

  // +++ MODIFIED: This method now also sets the next set's details for the rest timer UI
  // +++ MODIFIED: This method now also sets the next set's details for the rest timer UI
  private async startRestPeriod(duration: number, completedExIndex: number, completedSetIndex: number): Promise<void> {
    this.playerSubState.set(PlayerSubState.Resting);
    this.restDuration.set(duration);
    this.restTimerMainText.set('RESTING');

    // Show a loading state while fetching next step info
    this.restTimerNextUpText.set('Loading next set...');
    this.restTimerNextSetDetails.set(null);
    this.isRestTimerVisible.set(true);

    // Await the async peek method
    const nextStep = await this.peekNextStepInfo(completedExIndex, completedSetIndex);

    // Update the UI with the fetched info
    this.restTimerNextUpText.set(nextStep.text);
    this.restTimerNextSetDetails.set(nextStep.details);
  }

   private handleAutoExpandNextExercise(): void {
    if (!this.currentStepInfo || this.currentStepInfo.completedExIndex < 0) return;

    const { completedExIndex, completedSetIndex, exerciseSetLength, maxExerciseIndex, supersetInfo } = this.currentStepInfo;

    // *** THE CORE FIX IS HERE ***
    if (supersetInfo) {
      // It's a superset. Check if all rounds are complete.
      const lastLoggedEx = this.currentWorkoutLog().exercises?.find(e => e.id === this.routine()?.exercises[completedExIndex].id);
      const loggedRounds = new Set(lastLoggedEx?.sets.map(s => s.supersetCurrentRound)).size;
      
      if (loggedRounds < supersetInfo.supersetRounds) {
        // Not all rounds are complete, so DO NOT expand the next exercise.
        // Keep the current superset expanded.
        if (this.expandedExerciseIndex() !== completedExIndex) {
            this.expandedExerciseIndex.set(completedExIndex);
        }
        return; // Exit the function early.
      }
    }
    // *** END OF FIX ***

    // This logic now only runs for standard exercises or AFTER the final round of a superset.
    if (completedSetIndex >= exerciseSetLength - 1) {
      if (completedExIndex + 1 <= maxExerciseIndex) {
        this.expandedExerciseIndex.set(completedExIndex + 1);
      } else {
        // All exercises are done, collapse everything.
        this.expandedExerciseIndex.set(null);
      }
    } else {
      // This handles moving to the next set within the same standard exercise.
      if (this.expandedExerciseIndex() !== completedExIndex) {
        this.expandedExerciseIndex.set(completedExIndex);
      }
    }
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
    this.isRestTimerVisible.set(false);
    this.toastService.success("Rest complete!", 2000);
    this.updateLogWithRestTime(this.restDuration()); // Update log with full rest duration
    this.handleAutoExpandNextExercise();
  }

  handleRestTimerSkipped(timeSkipped: number): void {
    this.isRestTimerVisible.set(false);
    this.toastService.info("Rest skipped", 1500);
    const actualRest = Math.ceil(this.restDuration() - timeSkipped);
    this.updateLogWithRestTime(actualRest); // Update log with actual rest taken
    this.handleAutoExpandNextExercise();
    this.playerSubState.set(PlayerSubState.PerformingSet);
  }

  // +++ MODIFIED: This method now returns an object with both the text and the detailed set info
  // +++ MODIFIED: This method now returns an object with both the text and the detailed set info
  private async peekNextStepInfo(completedExIndex: number, completedSetIndex: number): Promise<{ text: string | null; details: ExerciseSetParams | null }> {
    const routine = this.routine();
    if (!routine) return { text: null, details: null };

    const currentExercise = routine.exercises[completedExIndex];
    const isSuperSet = this.isSuperSet(completedExIndex);

    let supersetInfo: SupersetInfo;
    this.currentStepInfo = {
      completedSetIndex: completedSetIndex,
      completedExIndex: completedExIndex,
      exerciseSetLength: currentExercise.sets?.length ?? 0,
      maxExerciseIndex: routine.exercises.length - 1
    };

      if (isSuperSet && currentExercise){
      supersetInfo = {
        supersetId: currentExercise.supersetId!,
        supersetSize: currentExercise.supersetSize!,
        supersetOrder: currentExercise.supersetOrder!,
        supersetRounds: currentExercise.supersetRounds!,
      };
      this.currentStepInfo.supersetInfo = supersetInfo;
    }

    let nextExercise: WorkoutExercise | undefined;
    let nextSetIndex: number | undefined;

    // Is there another set in the current exercise?
    if (completedSetIndex + 1 < currentExercise.sets.length) {
      nextExercise = currentExercise;
      nextSetIndex = completedSetIndex + 1;
    }
    // Is there another exercise in the routine?
    else if (completedExIndex + 1 < routine.exercises.length) {
      nextExercise = routine.exercises[completedExIndex + 1];
      nextSetIndex = 0;
    }

    // If we found a next step
    if (nextExercise && nextSetIndex !== undefined) {
      const plannedNextSet = nextExercise.sets[nextSetIndex];

      // --- NEW LOGIC: Fetch historical data and create a suggested set ---
      try {
        const lastPerformance = await firstValueFrom(
          this.trackingService.getLastPerformanceForExercise(nextExercise.exerciseId)
        );

        // Find the specific historical data for the upcoming set index
        const historicalSet = this.trackingService.findPreviousSetPerformance(lastPerformance, plannedNextSet, nextSetIndex);

        // Create a new object for the rest timer details, prioritizing historical data
        const suggestedSetDetails: ExerciseSetParams = { ...plannedNextSet };
        if (historicalSet) {
          suggestedSetDetails.reps = historicalSet.repsAchieved ?? plannedNextSet.reps;
          suggestedSetDetails.weight = historicalSet.weightUsed ?? plannedNextSet.weight;
          suggestedSetDetails.duration = historicalSet.durationPerformed ?? plannedNextSet.duration;
          suggestedSetDetails.distance = historicalSet.distanceAchieved ?? plannedNextSet.distance;
        }

        const setType = plannedNextSet.type === 'warmup' ? "Warm-up" : "Set";
        const nextSetDisplayNumber = nextSetIndex + 1;
        const text = `${nextExercise.exerciseName} - Set #${nextSetDisplayNumber}: ${plannedNextSet.weight}${this.unitService.getWeightUnitSuffix()} x ${plannedNextSet.reps} reps`;
        return { text, details: suggestedSetDetails };

      } catch (error) {
        // If fetching fails, just return the planned set
        console.error("Could not fetch last performance for next set:", error);
        const nextSetDisplayNumber = nextSetIndex + 1;
        const text = `${nextExercise.exerciseName} - Set ${nextSetDisplayNumber}`;
        return { text, details: plannedNextSet };
      }
    }

    // If no next step
    this.currentStepInfo = { completedExIndex: -1, completedSetIndex: -1, exerciseSetLength: -1, maxExerciseIndex: -1 };
    return { text: "Workout Complete!", details: null };
  }

  // --- Pause, Resume, and State Management ---

  async pauseSession(): Promise<void> {
    if (this.sessionState() !== SessionState.Playing) return;
    this.sessionTimerElapsedSecondsBeforePause += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    this.timerSub?.unsubscribe();
    this.sessionState.set(SessionState.Paused);
    this.savePausedSessionState();
    this.toastService.info("Workout Paused", 3000);
  }

  async resumeSession(): Promise<void> {
    if (this.sessionState() !== SessionState.Paused) return;
    this.workoutStartTime = Date.now();
    this.sessionState.set(SessionState.Playing);
    this.startSessionTimer();
    this.toastService.info('Workout Resumed', 3000);
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
    this.workoutStartTime = state.workoutStartTimeOriginal || new Date().getTime();
    const loggedExercises = state.currentWorkoutLogExercises;

    // loggedExercises.forEach(loggedExercise => {
    //     this.currentWorkoutLog.set({ ...loggedExercise });
    // })

    const startingTime = new Date().getTime() + state.sessionTimerElapsedSecondsBeforePause;
    if (state.currentWorkoutLogExercises) {
      this.currentWorkoutLog.set({
        routineId: this.routineId || '-1',
        programId: this.programId || '',
        scheduledDayId: this.scheduledDay() ?? undefined,
        routineName: this.routine()?.name,
        startTime: startingTime,
        date: format(new Date(), 'yyyy-MM-dd'),
        exercises: loggedExercises,
      });
    }
    this.expandedExerciseIndex.set(state.currentExerciseIndex);

    // Set timers but don't start them
    const totalElapsedSeconds = this.sessionTimerElapsedSecondsBeforePause;
    const mins = String(Math.floor(totalElapsedSeconds / 60)).padStart(2, '0');
    const secs = String(totalElapsedSeconds % 60).padStart(2, '0');
    this.sessionTimerDisplay.set(`${mins}:${secs}`);

    this.sessionState.set(SessionState.Playing);
    this.startSessionTimer();
    // this.toastService.success('Paused session loaded', 3000);
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
          "Resume Paused Workout?",
          "You have a paused workout session. Would you like to resume it?",
          [{ text: "Resume", role: "confirm", data: true, icon: 'play', cssClass: 'bg-green-600 hover:bg-green-700' },
          { text: "Discard", role: "cancel", data: false, icon: 'trash', cssClass: "bg-red-600 hover:bg-red-800" }]
        );

        if (confirmation?.data) {
          await this.loadStateFromPausedSession(pausedState);
          return true;
        } else {
          this.workoutService.removePausedWorkout();
          this.toastService.info('Paused session discarded', 3000);
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
      // this.alertService.showConfirm("Exit Workout?", "You have an active workout. Are you sure you want to exit? Your progress might be lost unless you pause first")
      //   .then(confirmation => {
      //     if (confirmation?.data) {
      //     }
      //   });
    } else {
      this.router.navigate(['/workout']);
    }
  }

  // +++ NEW: Reorders exercises to group supersets together visually +++
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

  // +++ NEW: Method to add a new round to an existing superset +++
  async addRoundToSuperset(supersetId: string, event?: Event | undefined) {
    event?.stopPropagation();
    this.routine.update(r => {
      if (!r) return r;

      const exercisesInSuperset = r.exercises.filter(ex => ex.supersetId === supersetId);
      if (exercisesInSuperset.length === 0) return r;

      const firstExercise = exercisesInSuperset[0];
      const currentRounds = firstExercise.supersetRounds || 1;
      const newRoundNumber = currentRounds + 1;

      exercisesInSuperset.forEach(exercise => {
        exercise.supersetRounds = newRoundNumber;
        // The number of sets per round is now always 1
        const templateSet = exercise.sets.length > 0 ? exercise.sets[0] : { id: uuidv4(), reps: 8, weight: 10, restAfterSet: 60, type: 'standard' };

        const newSet = { ...templateSet, id: uuidv4(), supersetRound: newRoundNumber };
        exercise.sets.push(newSet);
      });

      this.toastService.success(`Added Round ${newRoundNumber} to superset.`);

      // +++ FIX: Return a new object reference to trigger computed signal recalculation +++
      return { ...r };
    });
  }

  // +++ NEW: Method to complete all sets within a specific superset round +++
  async completeSupersetRound(exercise: WorkoutExercise, roundIndex: number, event: Event) {
    event.stopPropagation();
    const routine = this.routine();
    if (!routine || !exercise.supersetId) return;

    const confirm = await this.alertService.showConfirm(
      'Complete Round',
      `Mark all sets in Round ${roundIndex + 1} for this superset as complete?`,
      'Complete',
      'Cancel'
    );
    if (!confirm?.data) return;

    const exercisesInSuperset = routine.exercises.filter(ex => ex.supersetId === exercise.supersetId);

    // Iterate through each exercise belonging to the superset group.
    exercisesInSuperset.forEach(exInSuperset => {
      const exIndex = routine.exercises.findIndex(e => e.id === exInSuperset.id);
      if (exIndex === -1) return;

      // Iterate through the SETS that make up ONE round for that exercise.
      exInSuperset.sets.forEach((set, setIndex) => {
        // Check if this specific set in this specific round is already completed.
        const wasCompleted = this.isSetCompleted(exIndex, setIndex, roundIndex);
        const isValid = this.isSetDataValid(exIndex, setIndex);

        // If it's not completed and the data is valid, mark it as complete.
        if (!wasCompleted && isValid) {
          // *** THE CORE FIX: Pass the `roundIndex` as the 5th argument. ***
          this.toggleSetCompletion(exInSuperset, set, exIndex, setIndex, roundIndex);
        }
      });
    });

    this.toastService.success(`Round ${roundIndex + 1} completed!`);

    // Check if the round just completed was the final one to decide if we should auto-expand the next exercise.
    const totalRounds = exercise.supersetRounds || 1;
    if (roundIndex >= totalRounds - 1) {
      const lastExerciseInGroupIndex = routine.exercises.findIndex(e => e.id === exercisesInSuperset[exercisesInSuperset.length - 1].id);

      if (lastExerciseInGroupIndex + 1 < routine.exercises.length) {
        this.toggleExerciseExpansion(lastExerciseInGroupIndex + 1);
      } else {
        this.toggleExerciseExpansion(-1); // Collapse all if it was the last exercise in the routine
      }
    }
  }


  areAllPropertiesFalsy(obj: any) {
    return Object.values(obj).every(value => !value);
  }

  async removeFromSuperset(exIndex: number) {
    const routine = this.routine();
    const loggedExercises = this.currentWorkoutLog().exercises || [];
    if (!routine) return;

    const result = await this.workoutService.removeFromSuperset(
      routine,
      exIndex,
      loggedExercises,
      this.alertService,
      this.toastService
    );

    if (result) {
      this.routine.set(result.updatedRoutine);
      this.currentWorkoutLog.update(log => {
        log.exercises = result.updatedLoggedExercises;
        return { ...log };
      });
      this.savePausedSessionState();
    }
  }


  isSuperSet(index: number): boolean {
    const exercises = this.routine()?.exercises;
    if (!exercises) return false;
    const ex = exercises[index];
    if (!ex?.supersetId) return false;
    return true;
  }

  isSupersetStart(index: number): boolean {
    const ex = this.routine()?.exercises[index];
    if (!ex?.supersetId) return false;
    return ex.supersetOrder === 0;
  }

  isSupersetMiddle(index: number): boolean {
    const ex = this.routine()?.exercises[index];
    if (!ex?.supersetId || ex.supersetOrder === 0 || ex.supersetSize === null || ex.supersetSize === undefined) return false;
    return ex.supersetOrder !== null && ex.supersetOrder < ex.supersetSize - 1;
  }

  isSupersetEnd(index: number): boolean {
    const ex = this.routine()?.exercises[index];
    if (!ex?.supersetId || ex.supersetSize === null || ex.supersetSize === undefined) return false;
    return ex.supersetOrder === ex.supersetSize - 1;
  }

  isEndOfLastSupersetExercise(exIndex: number, setIndex: number): boolean {
    const ex = this.routine()?.exercises[exIndex];
    if (!ex) return false;
    return this.isSupersetEnd(exIndex);
    // OLD LOGIC
    // return this.isSupersetEnd(exIndex) && ex.sets.length === setIndex + 1;
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

  getExerciseClasses(exercise: WorkoutExercise, index: number): any {
    const isSSet = this.isSuperSet(index);
    const order = exercise.supersetOrder ?? 0;
    const isExpanded = this.expandedExerciseIndex() === index;

    // --- Base classes that apply to almost all states ---
    const classes: any = {
      // Side borders always apply to superset items
      'border-l-2 border-r-2 border-primary rounded-md': isSSet,
      // Standalone exercises always get these classes
      'mb-3 rounded-md': !isSSet,
    };

    // --- State-Specific Logic ---
    if (isSSet && isExpanded) {
      // STATE 1: THE EXERCISE IS EXPANDED
      // It becomes a self-contained, highlighted block.
      classes['border-yellow-400 ring-2 ring-yellow-400 dark:ring-yellow-500 z-10'] = true;
      classes['rounded-md'] = true;       // Round all corners
      classes['border-t-2'] = true;       // Ensure it has a top border
      classes['border-b-2'] = true;       // Ensure it has a bottom border
      classes['mb-2'] = this.isSupersetEnd(index);             // Add margin to visually detach it from the item below

    } else {
      // STATE 2: THE EXERCISE IS COLLAPSED (OR STANDALONE)
      // Apply the normal start, middle, and end classes for visual grouping.
      classes['border-t-2 rounded-t-md'] = this.isSupersetStart(index);
      classes['border-b-0 rounded-none'] = this.isSupersetMiddle(index); // This correctly removes bottom border for middle items
      classes['border-b-2 rounded-b-md mb-4'] = this.isSupersetEnd(index);
    }

    // --- Background Color Logic (applied last, doesn't affect layout) ---
    if (isSSet && order % 2 !== 0) {
      classes['bg-gray-200/80 dark:bg-gray-800'] = true; // Striped background
    } else {
      classes['bg-white dark:bg-gray-700'] = true; // Default background
    }

    return classes;
  }

  private comparePerformedToOriginal(
    performed: LoggedWorkoutExercise[],
    original: WorkoutExercise[]
  ): { majorDifference: boolean; details: string[] } {
    const details: string[] = [];
    let majorDifference = false;

    const originalIdSet = new Set(original.map(ex => ex.id)); // Use the unique instance ID
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
        // This exercise from the original plan was not performed at all.
        majorDifference = true;
        details.push(`Exercise skipped: "${originalEx.exerciseName || originalEx.exerciseId}"`);
        continue;
      }

      // *** THE CORE FIX IS HERE ***
      // Calculate the total number of sets that *should* have been performed based on the routine's plan.
      let totalPlannedExecutions: number;
      if (originalEx.supersetId) {
        // For supersets, the total is sets per round * number of supersetRounds.
        totalPlannedExecutions = originalEx.sets.length * (originalEx.supersetRounds || 1);
      } else {
        // For standard exercises, the total is sets * rounds.
        // Note: In the compact player, this logic is simpler, but for the focus player, this is correct.
        totalPlannedExecutions = originalEx.sets.length * (originalEx.rounds || 1);
      }

      if (performedEx.sets.length !== totalPlannedExecutions) {
        majorDifference = true;
        details.push(`Set count for "${performedEx.exerciseName}" changed (Planned: ${totalPlannedExecutions}, Performed: ${performedEx.sets.length})`);
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
        supersetSize: sessionExercise?.supersetSize ?? null,
        rounds: sessionExercise?.rounds ?? 1,
        notes: sessionExercise?.notes,
        sets: loggedEx.sets.map(loggedSet => {
          const originalPlannedSet = sessionExercise?.sets.find(s => s.id === loggedSet.plannedSetId);
          return {
            id: uuidv4(),
            reps: loggedSet.repsAchieved,
            weight: loggedSet.weightUsed,
            duration: loggedSet.durationPerformed,
            tempo: originalPlannedSet?.tempo || '1',
            restAfterSet: originalPlannedSet?.restAfterSet || 60,
            notes: loggedSet.notes,
            type: loggedSet.type as any,
          };
        }),
        type: (sessionExercise?.type ?? 'standard') as any,
      };
    });
  }
}