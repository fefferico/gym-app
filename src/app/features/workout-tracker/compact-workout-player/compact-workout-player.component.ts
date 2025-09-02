import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer, of, lastValueFrom, firstValueFrom, combineLatest } from 'rxjs';
import { switchMap, take, map } from 'rxjs/operators';
import {
  Routine,
  WorkoutExercise,
  ExerciseSetParams,
  ActiveSetInfo,
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
import { PausedWorkoutState, PlayerSubState } from '../workout-player';
import { TrainingProgram } from '../../../core/models/training-program.model';
import { AlertButton, AlertInput } from '../../../core/models/alert.model';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';

// Interface for saving the paused state

enum SessionState {
  Loading = 'loading',
  Playing = 'playing',
  Paused = 'paused',
  Error = 'error',
  End = 'end',
}

export interface NextStepInfo {
  completedExIndex: number,
  completedSetIndex: number,
  exerciseSetLength: number,
  maxExerciseIndex: number
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

  nextStepInfo: NextStepInfo = { completedExIndex: -1, completedSetIndex: -1, exerciseSetLength: -1, maxExerciseIndex: -1 };

  isRestTimerVisible = signal(false);
  restDuration = signal(0);
  restTimerMainText = signal('RESTING');
  restTimerNextUpText = signal<string | null>(null);
  // +++ NEW: Signal to hold detailed info for the next set for the rest timer screen
  restTimerNextSetDetails = signal<ExerciseSetParams | null>(null);

  menuModeDropdown: boolean = false;
  menuModeCompact: boolean = false;
  menuModeModal: boolean = false;

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
    if (!routine || routine.exercises.length === 0) return 0;
    const totalPlannedSets = routine.exercises.reduce((total, ex) => total + ex.sets.length, 0);
    if (totalPlannedSets === 0) return 0;
    const totalCompletedSets = log.exercises?.reduce((total, ex) => total + (ex.sets ? ex.sets.length : 0), 0) ?? 0;
    return (totalCompletedSets / totalPlannedSets) * 100;
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
        this.routine.set(JSON.parse(JSON.stringify(routine)));
        this.originalRoutineSnapshot.set(JSON.parse(JSON.stringify(routine)));
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

  getLoggedSet(exIndex: number, setIndex: number): LoggedSet | undefined {
    const exercise = this.routine()?.exercises[exIndex];
    const exerciseLog = this.currentWorkoutLog()?.exercises?.find(e => e.id === exercise?.id);
    const plannedSetId = exercise?.sets[setIndex]?.id;
    return exerciseLog?.sets.find(s => s.plannedSetId === plannedSetId);
  }

  isSetCompleted(exIndex: number, setIndex: number): boolean {
    return !!this.getLoggedSet(exIndex, setIndex);
  }

  isExerciseLogged(exIndex: number): boolean {
    return !!this.currentWorkoutLog()?.exercises?.find((e, index) => index === exIndex);
  }

  toggleSetCompletion(exercise: WorkoutExercise, set: ExerciseSetParams, exIndex: number, setIndex: number, fieldUpdated?: string): void {
    const log = this.currentWorkoutLog();
    if (!log.exercises) log.exercises = [];

    let exerciseLog = log.exercises.find(e => e.id === exercise.id);
    const wasCompleted = !!this.getLoggedSet(exIndex, setIndex);

    if (wasCompleted) {
      if (exerciseLog) {
        const existingIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === set.id);
        if (existingIndex > -1) exerciseLog.sets.splice(existingIndex, 1);
        if (exerciseLog.sets.length === 0) {
          const emptyLogIndex = log.exercises.findIndex(e => e.id === exerciseLog!.id);
          if (emptyLogIndex > -1) log.exercises.splice(emptyLogIndex, 1);
        }
      }
    } else {
      if (!exerciseLog) {
        exerciseLog = {
          ...exercise,
          id: exercise.id, exerciseId: exercise.exerciseId, exerciseName: exercise.exerciseName!,
          sets: [], rounds: exercise.rounds ?? 1, type: exercise.type || 'standard',
          notes: exercise.notes
        };
        log.exercises.push(exerciseLog);
      }
      const newLoggedSet: LoggedSet = {
        id: uuidv4(), exerciseName: exercise.exerciseName, plannedSetId: set.id,
        exerciseId: exercise.exerciseId, type: set.type,
        repsAchieved: set.reps ?? 0, weightUsed: set.weight || 0,
        durationPerformed: set.duration, distanceAchieved: set.distance,
        timestamp: new Date().toISOString(),
        notes: set.notes,
        // +++ NEW: Log the planned rest time immediately
        targetRestAfterSet: set.restAfterSet
      };
      exerciseLog.sets.push(newLoggedSet);
      const order = exercise.sets.map(s => s.id);
      exerciseLog.sets.sort((a, b) => order.indexOf(a.plannedSetId!) - order.indexOf(b.plannedSetId!));

      const shouldStartRest = set.restAfterSet && set.restAfterSet > 0 &&
        (!this.isSuperSet(exIndex) || (this.isSuperSet(exIndex) && this.isEndOfLastSupersetExercise(exIndex, setIndex)));

      if (shouldStartRest) {
        // +++ MODIFIED: Store the reference to this newly logged set before starting the timer
        this.lastLoggedSetForRestUpdate = newLoggedSet;
        if (!fieldUpdated || fieldUpdated !== 'notes') {
          this.startRestPeriod(set.restAfterSet, exIndex, setIndex);
        }
      }
    }
    this.currentWorkoutLog.set({ ...log });
    this.savePausedSessionState();
    this.lastExerciseIndex.set(exIndex);
    this.lastExerciseSetIndex.set(setIndex);

  }

  updateSetData(exIndex: number, setIndex: number, field: 'reps' | 'weight' | 'distance' | 'time' | 'notes', event: Event): void {

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
      // +++ NEW: Handle notes update
      case 'notes': set.notes = value; break;
    }
    this.routine.set({ ...routine });
    if (this.isSetCompleted(exIndex, setIndex)) {
      this.toggleSetCompletion(exercise, set, exIndex, setIndex, 'notes');
      this.toggleSetCompletion(exercise, set, exIndex, setIndex, 'notes');
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

  async finishWorkout(): Promise<void> {
    const analysis = this.analyzeWorkoutCompletion();
    let msg = 'Are you sure you want to finish and save this workout?';
    if (analysis.incompleteExercises.length || analysis.skippedExercises.length) {
      msg = `You have ${analysis.skippedExercises.length} skipped and ${analysis.incompleteExercises.length} incomplete exercises. Finish anyway?`;
    }
    const confirm = await this.alertService.showConfirm('Finish Workout', msg, 'Finish', 'Cancel');
    if (confirm?.data) {
      const log = this.currentWorkoutLog();
      log.endTime = Date.now();
      log.durationMinutes = Math.round((log.endTime - (log.startTime!)) / 60000);
      log.exercises = log.exercises!.filter(ex => ex.sets.length > 0);
      if (log.startTime) {
        let iterationId: string | undefined = undefined;
        if (this.program()) {
          iterationId = this.program() ? this.program()?.iterationId : undefined;
          log.iterationId = iterationId;
        }

        const savedLog = this.trackingService.addWorkoutLog(log as Omit<WorkoutLog, 'id'> & { startTime: number });

        this.sessionState.set(SessionState.End);
        this.isSessionConcluded = true;
        this.workoutService.removePausedWorkout();
        this.timerSub?.unsubscribe();

        if (savedLog.programId) {
          try {
            const isProgramCompleted = await this.trainingProgramService.checkAndHandleProgramCompletion(savedLog.programId, savedLog);
            if (isProgramCompleted) {
              this.toastService.success(`Congrats! Program completed!`, 5000, "Program Finished", false);
              this.router.navigate(['/training-programs/completed', savedLog.programId], { queryParams: { logId: savedLog.id } });
            } else {
              this.router.navigate(['/workout/summary', savedLog.id]);
            }
          } catch (error) {
            console.error("Error during program completion check:", error);
            this.router.navigate(['/workout/summary', savedLog.id]);
          }
        } else {
          this.router.navigate(['/workout/summary', savedLog.id]);
        }
      } else {
        this.toastService.error("Could not save: missing start time.");
      }
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
    const setToRemove = exercise.sets[setIndex];
    const isLoggedSet = this.isSetCompleted(exIndex, setIndex);
    const isLastSet = exercise.sets.length === 1;

    let confirmMessage = `Are you sure you want to remove this set from ${exercise.exerciseName}?`;
    if (isLastSet) {
      confirmMessage = `This is the last set for ${exercise.exerciseName}. Removing it will also remove the exercise from the workout. Continue?`;
    }

    const confirm = (isLoggedSet || isLastSet)
      ? await this.alertService.showConfirm("Remove Set", confirmMessage)
      : { data: true };

    if (confirm?.data) {
      // First, remove the log entry for the specific set if it exists
      const log = this.currentWorkoutLog();
      const exerciseLog = log.exercises?.find(e => e.id === exercise.id);
      if (exerciseLog) {
        const loggedSetIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === setToRemove.id);
        if (loggedSetIndex > -1) {
          exerciseLog.sets.splice(loggedSetIndex, 1);
        }
      }
      this.currentWorkoutLog.set({ ...log });

      // Now, remove the set from the routine definition
      exercise.sets.splice(setIndex, 1);

      // If that was the last set, remove the entire exercise
      if (exercise.sets.length === 0) {
        // The removeExercise function handles routine updates, log cleanup, and its own toast notification.
        // We pass the index of the exercise to be removed.
        this.removeExercise(exIndex);
      } else {
        // If sets still remain, just update the routine signal and notify the user.
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

  getMainSessionActionItems(): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left p-3 sm:px-4 sm:py-2 font-medium text-white hover:bg-blue-600 flex items-center hover:text-white dark:hover:text-gray-100 dark:hover:text-white w-full';

    const addExerciseBtn = {
      label: 'Add exercise',
      actionKey: 'addExercise',
      iconName: `plus-circle`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (this.sessionState() === 'paused' || !this.routine()?.exercises?.length ? 'disabled ' : '') + defaultBtnClass,
    } as ActionMenuItem;

    const quitWorkoutBtn = {
      label: 'EXIT',
      actionKey: 'exit',
      iconName: `exit-door`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: '' + 'transition-colors duration-150 ease-in-out rounded text-left p-3 sm:px-4 sm:py-2 font-medium text-white hover:bg-red-600 flex items-center hover:text-white dark:hover:text-gray-100 dark:hover:text-white w-full',
    } as ActionMenuItem;

    const actionsArray: ActionMenuItem[] = [
      this.sessionState() === 'paused' ?
        {
          label: 'Resume', actionKey: 'play', iconName: 'play',
          buttonClass: 'w-full flex items-center justify-center max-w-xs text-white hover:bg-yellow-800 font-medium py-2 px-6 rounded-md text-md' + defaultBtnClass, iconClass: 'w-8 h-8 mr-2'
        } :
        {
          label: 'Pause', actionKey: 'pause', iconName: 'pause',
          buttonClass: 'transition-colors duration-150 ease-in-out rounded text-left p-3 sm:px-4 sm:py-2 font-medium text-white hover:bg-yellow-600 flex items-center hover:text-white dark:hover:text-gray-100 dark:hover:text-white w-full', iconClass: 'w-8 h-8 mr-2'
        },
      {
        label: 'Session notes', actionKey: 'session_notes', iconName: 'clipboard-list',
        buttonClass: defaultBtnClass + 'transition-colors duration-150 ease-in-out rounded text-left p-3 sm:px-4 sm:py-2 font-medium text-white hover:bg-green-600 flex items-center hover:text-white dark:hover:text-gray-100 dark:hover:text-white w-full', iconClass: 'w-8 h-8 mr-2'
      },
      addExerciseBtn,
      { isDivider: true },
      quitWorkoutBtn
    ];

    return actionsArray;
  }

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

  // getExerciseActionItems(exerciseId: number, mode: MenuMode): ActionMenuItem[] {
  //   if (this.getMenuMode() === 'compact'){
  //     this.getCompactActionItems(exerciseId,mode);
  //   } else {
  //     this.get(exerciseId,mode);
  //   }
  // }

  getCompactActionItems(exerciseId: number, mode: MenuMode): ActionMenuItem[] {
    const exercise = this.routine()?.exercises[exerciseId];

    const defaultBtnClass = 'rounded text-left p-3 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const warmupBtnClass = 'rounded text-left p-3 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-blue-400 flex items-center hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left p-3 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 inline-flex items-center hover:text-gray-100 hover:animate-pulse';;

    const switchExerciseBtn = {
      label: 'Switch exercise',
      actionKey: 'switch',
      data: { exIndex: exerciseId },
      iconName: `change`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
    } as ActionMenuItem;

    const openPerformanceInsightsBtn = {
      label: 'Performance insight',
      actionKey: 'insights',
      iconName: `chart`,
      iconClass: 'w-8 h-8 mr-2',
      data: { exIndex: exerciseId },
      buttonClass: (this.sessionState() === 'paused' || !this.lastSetInfo() ? 'disabled ' : '') + defaultBtnClass,
    } as ActionMenuItem;

    const actionsArray: ActionMenuItem[] = [
      switchExerciseBtn,
      openPerformanceInsightsBtn,
      {
        label: 'Add Warm-up Set', actionKey: 'add_warmup', iconName: 'flame', data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + warmupBtnClass, iconClass: 'w-8 h-8 mr-2'
      },
      {
        label: 'Add Set', actionKey: 'add_set', iconName: 'plus-circle', data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass, iconClass: 'w-8 h-8 mr-2'
      },
      { isDivider: true },
      {
        label: 'Remove Exercise', actionKey: 'remove', iconName: 'trash', data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass, iconClass: 'w-8 h-8 mr-2'
      }
    ];

    const routine = this.routine(); // Get the routine once at the top

    // RULE 1: "Remove from Superset" is visible only if the current exercise is part of a superset.
    if (exercise?.supersetId) {
      actionsArray.push({
        label: 'Remove from Superset',
        actionKey: 'remove_from_superset',
        iconName: 'unlink',
        data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
        iconClass: 'w-8 h-8 mr-2'
      });
    }
    // RULES 2 & 3: Logic for exercises that are NOT currently in a superset.
    else {
      // Prerequisite for both creating and adding: must have at least 2 exercises in the entire routine.
      if (routine && routine.exercises.length >= 2) {

        // RULE 3: "Add to Superset" is visible if there's already a superset and the current exercise is free.
        const aSupersetExists = routine.exercises.some(ex => ex.supersetId);
        if (aSupersetExists) {
          actionsArray.push({
            label: 'Add to Superset',
            actionKey: 'add_to_superset', // Assumes this might trigger a different UI flow
            iconName: 'link',
            data: { exIndex: exerciseId },
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
            iconClass: 'w-8 h-8 mr-2'
          });
        }

        // RULE 2: "Create Superset" is visible if there are at least two "free" exercises to form a new pair.
        const canCreateNewSuperset = routine.exercises.filter(ex => !ex.supersetId).length >= 2;
        if (canCreateNewSuperset) {
          actionsArray.push({
            label: 'Create Superset',
            actionKey: 'create_superset',
            iconName: 'link',
            data: { exIndex: exerciseId },
            buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
            iconClass: 'w-8 h-8 mr-2'
          });
        }
      }
    }

    return actionsArray;
  }

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
    if (!this.nextStepInfo || this.nextStepInfo.completedExIndex < 0) return;

    const { completedExIndex, completedSetIndex, exerciseSetLength, maxExerciseIndex } = this.nextStepInfo;

    if (completedSetIndex >= exerciseSetLength - 1) {
      if (completedExIndex + 1 <= maxExerciseIndex) {
        this.expandedExerciseIndex.set(completedExIndex + 1);
      } else {
        this.expandedExerciseIndex.set(null);
      }
    } else {
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
    this.nextStepInfo = {
      completedSetIndex: completedSetIndex,
      completedExIndex: completedExIndex,
      exerciseSetLength: currentExercise.sets?.length ?? 0,
      maxExerciseIndex: routine.exercises.length - 1
    };

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
    this.nextStepInfo = { completedExIndex: -1, completedSetIndex: -1, exerciseSetLength: -1, maxExerciseIndex: -1 };
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
    if (this.sessionState() === SessionState.End || !this.routine()) return;

    let currentTotalSessionElapsed = this.sessionTimerElapsedSecondsBeforePause;
    if (this.sessionState() === SessionState.Playing) {
      currentTotalSessionElapsed += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    }

    const stringifiedRoutine = JSON.parse(JSON.stringify(this.routine()));
    const stateToSave: PausedWorkoutState = {
      version: this.workoutService.getPausedVersion(),
      routineId: this.routineId,
      programId: this.programId,
      programName: this.program()?.name,
      scheduledDayId: this.scheduledDay(),
      sessionRoutine: stringifiedRoutine, // Includes sessionStatus
      originalRoutineSnapshot: this.originalRoutineSnapshot() ? JSON.parse(JSON.stringify(this.originalRoutineSnapshot())) : stringifiedRoutine,
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
      workoutDate: format(new Date(), 'yyyy-MM-dd'),
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
    this.toastService.success('Paused session loaded', 3000);
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
      this.alertService.showConfirm("Exit Workout?", "You have an active workout. Are you sure you want to exit? Your progress might be lost unless you pause first")
        .then(confirmation => {
          if (confirmation?.data) {
            this.router.navigate(['/workout']);
          }
        });
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

    const exerciseToAdd = routine.exercises[exIndex];
    if (exerciseToAdd.supersetId) {
      this.toastService.info("This exercise is already in a superset.");
      return;
    }

    const supersetMap = new Map<string, WorkoutExercise[]>();
    routine.exercises.forEach(ex => {
      if (ex.supersetId) {
        if (!supersetMap.has(ex.supersetId)) {
          supersetMap.set(ex.supersetId, []);
        }
        supersetMap.get(ex.supersetId)!.push(ex);
      }
    });

    if (supersetMap.size === 0) {
      this.toastService.error("No supersets exist to add this exercise to.");
      return;
    }

    const supersetChoices: AlertInput[] = Array.from(supersetMap.values()).map((supersetGroup, index) => {
      supersetGroup.sort((a, b) => (a.supersetOrder || 0) - (b.supersetOrder || 0));
      const label = supersetGroup.map(ex => ex.exerciseName).join(' & ');
      const supersetId = supersetGroup[0].supersetId!;

      return {
        name: 'supersetChoice',
        type: 'radio',
        label: `Superset: ${label}`,
        value: supersetId,
        checked: index === 0,
      };
    });

    const result = await this.alertService.showPromptDialog(
      'Add to Superset',
      `Which superset would you like to add "${exerciseToAdd.exerciseName}" to?`,
      supersetChoices,
      'Add Exercise',
      'Cancel'
    );

    if (result && result['supersetChoice']) {
      const chosenSupersetId = result['supersetChoice'];
      this.routine.update(r => {
        if (!r) return r;

        const targetExercise = r.exercises.find(ex => ex.id === exerciseToAdd.id);
        if (!targetExercise) return r;

        // +++ MODIFICATION START +++

        // Find all existing exercises in the chosen superset
        const existingExercisesInSuperset = r.exercises.filter(ex => ex.supersetId === chosenSupersetId);
        if (existingExercisesInSuperset.length === 0) {
          // This shouldn't happen, but as a safeguard:
          this.toastService.error("Could not find the selected superset to add to.");
          return r;
        }

        const newSupersetSize = existingExercisesInSuperset.length + 1;
        const nextOrder = existingExercisesInSuperset.length;

        // Adopt the round structure from the existing superset
        const rounds = existingExercisesInSuperset[0].supersetRounds || 1;

        // Use the new exercise's first set as a template, or create a default one
        const templateSet = targetExercise.sets.length > 0
          ? { ...targetExercise.sets[0] }
          : { id: uuidv4(), reps: 8, weight: 10, restAfterSet: 60, type: 'standard' };

        // Rebuild the sets for the new exercise to match the superset's rounds
        targetExercise.sets = [];
        for (let i = 1; i <= rounds; i++) {
          targetExercise.sets.push({ ...templateSet, id: uuidv4() });
          // targetExercise.sets.push({ ...templateSet, id: uuidv4(), supersetRound: i });
        }

        // Assign superset properties to the new exercise
        targetExercise.supersetId = String(chosenSupersetId);
        targetExercise.supersetOrder = nextOrder;
        targetExercise.type = 'superset';
        targetExercise.supersetRounds = rounds;
        targetExercise.supersetSize = newSupersetSize;

        // CRITICAL FIX: Update the supersetSize for all existing members of the group
        existingExercisesInSuperset.forEach(ex => {
          ex.supersetSize = newSupersetSize;
        });

        // Reorder the full exercise list to keep the group together visually
        r.exercises = this.reorderExercisesForSupersets(r.exercises);
        this.toastService.success(`${targetExercise.exerciseName} added to the superset.`);

        // +++ MODIFICATION END +++

        return { ...r };
      });
    }
  }

  async openCreateSupersetModal(exIndex: number): Promise<void> {
    const routine = this.routine();
    if (!routine) return;

    const availableExercises = routine.exercises
      .map((ex, index) => ({ ...ex, originalIndex: index }))
      .filter(ex => !ex.supersetId);

    const exercises: AlertInput[] = availableExercises.map((exer) => ({
      label: exer.exerciseName,
      name: String(exer.originalIndex),
      type: 'checkbox',
      value: exer.originalIndex === exIndex
    }));

    // +++ NEW: Add input for number of rounds +++
    exercises.push({
      name: 'supersetRounds',
      type: 'number',
      label: 'Number of Rounds',
      value: '1',
      min: 1,
      placeholder: 'Enter number of rounds'
    });

    const choice = await this.alertService.showPromptDialog(
      'Create Superset',
      'Select exercises to link together.',
      exercises
    );

    if (choice && !this.areAllPropertiesFalsy(choice)) {
      const rounds = Number(choice['supersetRounds']) || 1;
      delete choice['supersetRounds']; // Important: remove so it's not treated as an exercise index

      const selectedOriginalIndices = Object.keys(choice)
        .filter(key => choice[key])
        .map(Number)
        .sort((a, b) => a - b);

      if (selectedOriginalIndices.length < 2) {
        this.toastService.info("Please select at least two exercises to create a superset.");
        return;
      }

      this.routine.update(r => {
        if (!r) return r;

        const newSupersetId = uuidv4();
        let currentOrder = 0;

        for (const originalIndex of selectedOriginalIndices) {
          const targetExercise = r.exercises[originalIndex];
          if (targetExercise) {
            // +++ MODIFICATION START +++
            // Force the superset to start with a single set template to ensure "Add Round" is predictable.
            // Use the first existing set as a template, or create a default one if none exist.
            const templateSet = targetExercise.sets.length > 0
              ? JSON.parse(JSON.stringify(targetExercise.sets[0]))
              : { id: uuidv4(), reps: 8, weight: 10, restAfterSet: 60, type: 'standard' };

            // Clear the sets array to rebuild it based on rounds.
            targetExercise.sets = [];
            // +++ MODIFICATION END +++

            targetExercise.supersetId = newSupersetId;
            targetExercise.supersetOrder = currentOrder++;
            targetExercise.type = 'superset';
            targetExercise.supersetSize = selectedOriginalIndices.length;
            targetExercise.supersetRounds = rounds;

            // +++ MODIFICATION START +++
            // Create one set per round using the template.
            for (let i = 1; i <= rounds; i++) {
              const newSet = { ...templateSet, id: uuidv4(), supersetRound: i };
              targetExercise.sets.push(newSet);
            }
            // +++ MODIFICATION END +++
          }
        }
        r.exercises = this.reorderExercisesForSupersets(r.exercises);
        this.alertService.showAlert("INFO", `Superset created with ${selectedOriginalIndices.length} exercises and ${rounds} rounds: sets have been standardized to one per round for consistency.`);
        return r;
      });
    }
    this.savePausedSessionState();
  }

  // +++ NEW: Method to add a new round to an existing superset +++
  async addRoundToSuperset(supersetId: string, event: Event) {
    event.stopPropagation();
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
  async completeSupersetRound(exercise: WorkoutExercise, round: number, event: Event) {
    event.stopPropagation();
    const routine = this.routine();
    if (!routine || !exercise.supersetId) return;

    const confirm = await this.alertService.showConfirm(
      'Complete Round',
      `Mark all sets in Round ${round} for this superset as complete? This cannot be undone.`,
      'Complete',
      'Cancel'
    );
    if (!confirm?.data) return;

    const exercisesInSuperset = routine.exercises.filter(ex => ex.supersetId === exercise.supersetId);

    exercisesInSuperset.forEach(exInSuperset => {
      const exIndex = routine.exercises.findIndex(e => e.id === exInSuperset.id);
      if (exIndex === -1) return;

      exInSuperset.sets.forEach((set, setIndex) => {
        if (setIndex === round) {
          const wasCompleted = this.isSetCompleted(exIndex, setIndex);
          const isValid = this.isSetDataValid(exIndex, setIndex);
          if (!wasCompleted && isValid) {
            this.toggleSetCompletion(exInSuperset, set, exIndex, setIndex);
          }
        }
      });
    });
  }


  areAllPropertiesFalsy(obj: any) {
    return Object.values(obj).every(value => !value);
  }

  async removeFromSuperset(exIndex: number) {
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[exIndex];
    if (!exercise.supersetId) return;

    const confirm = await this.alertService.showConfirm(
      "Remove from Superset",
      `Are you sure you want to remove ${exercise.exerciseName} from this superset?`
    );

    if (confirm?.data) {
      this.routine.update(r => {
        if (!r) return r;
        const supersetId = exercise.supersetId!;
        const exerciseToRemove = r.exercises[exIndex];

        exerciseToRemove.supersetId = null;
        exerciseToRemove.supersetOrder = null;
        exerciseToRemove.type = 'standard';
        exerciseToRemove.supersetSize = null;

        const remainingInSuperset = r.exercises.filter(ex => ex.supersetId === supersetId);

        if (remainingInSuperset.length <= 1) {
          remainingInSuperset.forEach(ex => {
            ex.supersetId = null;
            ex.supersetOrder = null;
            ex.type = 'standard';
            ex.supersetSize = null;
          });
          this.toastService.info("Superset dissolved.");
        } else {
          remainingInSuperset
            .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0))
            .forEach((ex, i) => {
              ex.supersetOrder = i;
              ex.supersetSize = remainingInSuperset.length;
            });
          this.toastService.info(`${exerciseToRemove.exerciseName} removed from superset.`);
        }
        r.exercises = this.reorderExercisesForSupersets(r.exercises);
        return r;
      });
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
}