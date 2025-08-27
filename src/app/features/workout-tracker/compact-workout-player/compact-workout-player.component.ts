import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer, of, lastValueFrom, firstValueFrom, combineLatest } from 'rxjs';
import { switchMap, take, map } from 'rxjs/operators';
import {
  Routine,
  WorkoutExercise,
  ExerciseSetParams,
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
import { MenuMode } from '../../../core/models/app-settings.model';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { FullScreenRestTimerComponent } from '../../../shared/components/full-screen-rest-timer/full-screen-rest-timer';
import { PausedWorkoutState, PlayerSubState } from '../workout-player';

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
  private appSettingsService = inject(AppSettingsService);

  routine = signal<Routine | null | undefined>(undefined);
  originalRoutineSnapshot = signal<Routine | null | undefined>(undefined);
  sessionState = signal<SessionState>(SessionState.Loading);
  sessionTimerDisplay = signal('00:00');
  expandedExerciseIndex = signal<number | null>(null);
  activeActionMenuIndex = signal<number | null>(null);
  playerSubState = signal<PlayerSubState>(PlayerSubState.PerformingSet);

  showCompletedSetsForExerciseInfo = signal(true);
  showCompletedSetsForDayInfo = signal(false);

  nextStepInfo: NextStepInfo = { completedExIndex: -1, completedSetIndex: -1, exerciseSetLength: -1, maxExerciseIndex: -1 };

  isRestTimerVisible = signal(false);
  restDuration = signal(0);
  restTimerMainText = signal('RESTING');
  restTimerNextUpText = signal<string | null>(null);

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
  scheduledDay: string | null = null;

  currentWorkoutLog = signal<Partial<WorkoutLog>>({ exercises: [] });

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
        this.scheduledDay = ids.scheduledDayId;
        return this.routineId ? this.workoutService.getRoutineById(this.routineId) : of(null);
      })
    ).subscribe(async (routine) => {
      if (routine) {
        this.routine.set(JSON.parse(JSON.stringify(routine)));
        this.originalRoutineSnapshot.set(JSON.parse(JSON.stringify(routine)));
        await this.prefillRoutineWithLastPerformance();
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
      scheduledDayId: this.scheduledDay ?? undefined,
      routineName: this.routine()?.name,
      startTime: this.workoutStartTime,
      date: format(new Date(), 'yyyy-MM-dd'),
      exercises: [],
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
    if (this.isCardio(exercise)) {
      return (set.distance ?? 0) > 0 || (set.duration ?? 0) > 0;
    }
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

  toggleSetCompletion(exercise: WorkoutExercise, set: ExerciseSetParams, exIndex: number, setIndex: number): void {
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
          id: exercise.id, exerciseId: exercise.exerciseId, exerciseName: exercise.exerciseName!,
          sets: [], rounds: exercise.rounds ?? 1, type: exercise.type || 'standard'
        };
        log.exercises.push(exerciseLog);
      }
      const newLoggedSet: LoggedSet = {
        id: uuidv4(), exerciseName: exercise.exerciseName, plannedSetId: set.id,
        exerciseId: exercise.exerciseId, type: set.type,
        repsAchieved: set.reps ?? 0, weightUsed: set.weight || 0,
        durationPerformed: set.duration, distanceAchieved: set.distance,
        timestamp: new Date().toISOString(),
      };
      exerciseLog.sets.push(newLoggedSet);
      const order = exercise.sets.map(s => s.id);
      exerciseLog.sets.sort((a, b) => order.indexOf(a.plannedSetId!) - order.indexOf(b.plannedSetId!));

      if (set.restAfterSet && set.restAfterSet > 0) {
        this.startRestPeriod(set.restAfterSet, exIndex, setIndex);
      }
    }
    this.currentWorkoutLog.set({ ...log });
    this.savePausedSessionState();
  }

  updateSetData(exIndex: number, setIndex: number, field: 'reps' | 'weight' | 'distance' | 'time', event: Event): void {
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
    }
    this.routine.set({ ...routine });
    if (this.isSetCompleted(exIndex, setIndex)) {
      this.toggleSetCompletion(exercise, set, exIndex, setIndex);
      this.toggleSetCompletion(exercise, set, exIndex, setIndex);
    }
  }

  getInitialInputValue(exIndex: number, setIndex: number, field: 'reps' | 'weight' | 'distance' | 'time'): string {
    const set = this.routine()!.exercises[exIndex].sets[setIndex];
    switch (field) {
      case 'reps': return (set.reps ?? '').toString();
      case 'weight': return (set.weight ?? '').toString();
      case 'distance': return (set.distance ?? '').toString();
      case 'time': return this.formatSecondsToTime(set.duration);
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

  async finishWorkout(): Promise<void> {
    const analysis = this.analyzeWorkoutCompletion();
    let msg = 'Are you sure you want to finish and save this workout?';
    if (analysis.incompleteExercises.length || analysis.skippedExercises.length) {
      msg = `You have ${analysis.skippedExercises.length} skipped and ${analysis.incompleteExercises.length} incomplete exercises. Finish anyway?`;
    }
    const confirm = await this.alertService.showConfirm('Finish Workout', msg, 'Finish', 'Go Back');
    if (confirm?.data) {
      const log = this.currentWorkoutLog();
      log.endTime = Date.now();
      log.durationMinutes = Math.round((log.endTime - (log.startTime!)) / 60000);
      log.exercises = log.exercises!.filter(ex => ex.sets.length > 0);
      if (log.startTime) {
        let iterationId: string | undefined = undefined;
        if (this.programId) {
          const program = await firstValueFrom(this.trainingProgramService.getProgramById(this.programId));
          iterationId = program ? program.iterationId : undefined;
          log.iterationId = iterationId;
        }

        const savedLog = this.trackingService.addWorkoutLog(log as Omit<WorkoutLog, 'id'> & { startTime: number });

        this.sessionState.set(SessionState.End);
        this.isSessionConcluded = true;
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
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

    const confirm = isLoggedSet ? await this.alertService.showConfirm("Remove Set", `Are you sure you want to remove logged Set #${setIndex + 1} from ${exercise.exerciseName}?`) : { data: true };
    if (confirm?.data) {
      exercise.sets.splice(setIndex, 1);
      this.routine.set({ ...routine });

      const log = this.currentWorkoutLog();
      const exerciseLog = log.exercises?.find(e => e.id === exercise.id);
      if (exerciseLog) {
        const loggedSetIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === setToRemove.id);
        if (loggedSetIndex > -1) {
          exerciseLog.sets.splice(loggedSetIndex, 1);
          this.currentWorkoutLog.set({ ...log });
        }
      }
      this.toastService.info(`Set removed from ${exercise.exerciseName}`);
    }
  }


  async removeExercise(exIndex: number) {
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[exIndex];
    const confirm = await this.alertService.showConfirm("Remove Exercise", `Are you sure you want to remove ${exercise.exerciseName}?`);
    if (confirm?.data) {
      routine.exercises.splice(exIndex, 1);
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

  addExerciseToRoutine(exercise: Exercise): void {
    const isCardioExercise = exercise.category === 'cardio';
    const newWorkoutExercise: WorkoutExercise = {
      id: uuidv4(), exerciseId: exercise.id, exerciseName: exercise.name, sets: [{
        id: uuidv4(), reps: isCardioExercise ? undefined : 8, weight: isCardioExercise ? undefined : 10,
        distance: isCardioExercise ? 1 : undefined, duration: isCardioExercise ? 300 : undefined,
        restAfterSet: 60, type: 'standard'
      }], type: 'standard', rounds: 1, supersetId: null, supersetOrder: null
    };
    this.routine.update(r => {
      r?.exercises.push(newWorkoutExercise);
      // Automatically expand the new exercise
      if (r) this.expandedExerciseIndex.set(r.exercises.length - 1);
      return r;
    });
    this.closeAddExerciseModal();
  }

  handleExerciseSwitch(newExercise: Exercise) {
    const index = this.exerciseToSwitchIndex();
    if (index === null) return;
    this.routine.update(r => {
      if (r) {
        const oldExerciseName = r.exercises[index].exerciseName;
        r.exercises[index].exerciseId = newExercise.id;
        r.exercises[index].exerciseName = newExercise.name;
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

  getLogDropdownActionItems(exerciseId: number, mode: MenuMode): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left p-3 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const warmupBtnClass = 'rounded text-left p-3 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-blue-400 flex items-center hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left p-3 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 inline-flex items-center hover:text-gray-100 hover:animate-pulse';;

    const actionsArray: ActionMenuItem[] = [
      {
        label: 'Switch Exercise', actionKey: 'switch', iconName: 'change', data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass, iconClass: 'w-8 h-8 mr-2'
      },
      {
        label: 'Performance Insights', actionKey: 'insights', iconName: 'chart', data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass, iconClass: 'w-8 h-8 mr-2'
      },
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
    return actionsArray;
  }

  private startRestPeriod(duration: number, completedExIndex: number, completedSetIndex: number): void {
    this.restDuration.set(duration);
    this.restTimerMainText.set('RESTING');
    this.restTimerNextUpText.set(this.peekNextStepInfo(completedExIndex, completedSetIndex));
    this.isRestTimerVisible.set(true);
    this.playerSubState.set(PlayerSubState.Resting);
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


  handleRestTimerFinished(): void {
    this.isRestTimerVisible.set(false);
    this.toastService.success("Rest complete!", 2000);
    this.handleAutoExpandNextExercise();
  }

  handleRestTimerSkipped(timeSkipped: number): void {
    this.isRestTimerVisible.set(false);
    this.toastService.info("Rest skipped", 1500);
    this.handleAutoExpandNextExercise();
    this.playerSubState.set(PlayerSubState.PerformingSet);
  }

  private peekNextStepInfo(completedExIndex: number, completedSetIndex: number): string | null {
    const routine = this.routine();
    if (!routine) return null;
    const currentExercise = routine.exercises[completedExIndex];
    this.nextStepInfo = {
      completedSetIndex: completedSetIndex,
      completedExIndex: completedExIndex,
      exerciseSetLength: currentExercise.sets?.length ?? 0,
      maxExerciseIndex: routine.exercises.length - 1
    };
    if (completedSetIndex + 1 < currentExercise.sets.length) {
      return `${currentExercise.exerciseName} - Set ${completedSetIndex + 2}`;
    }
    if (completedExIndex + 1 < routine.exercises.length) {
      const nextExercise = routine.exercises[completedExIndex + 1];
      return `${nextExercise.exerciseName} - Set 1`;
    }
    this.nextStepInfo = { completedExIndex: -1, completedSetIndex: -1, exerciseSetLength: -1, maxExerciseIndex: -1 };
    return "Workout Complete!";
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
      version: this.PAUSED_STATE_VERSION,
      routineId: this.routineId,
      programId: this.programId,
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
    this.scheduledDay = state.scheduledDayId ? state.scheduledDayId : null;
    this.routine.set(state.sessionRoutine);
    this.workoutStartTime = state.workoutStartTimeOriginal || new Date().getTime();
    const loggedExercises = state.currentWorkoutLogExercises;

    if (state.currentWorkoutLogExercises) {
      this.currentWorkoutLog.set({
        routineId: this.routineId || '-1',
        programId: this.programId || '',
        scheduledDayId: this.scheduledDay ?? undefined,
        routineName: this.routine()?.name,
        startTime: state.sessionTimerElapsedSecondsBeforePause,
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
      if (pausedState.version === this.PAUSED_STATE_VERSION && pausedState.routineId === routeRoutineId) {
        await this.loadStateFromPausedSession(pausedState);
        return true;
      } else {
        const confirmation = await this.alertService.showConfirmationDialog(
          "Resume Paused Workout?",
          "You have a paused workout session. Would you like to resume it?",
          [{ text: "Resume", role: "confirm", data: true, icon: 'play' }, { text: "Discard", role: "cancel", data: false, icon: 'trash' }]
        );
        if (confirmation?.data) {
          await this.loadStateFromPausedSession(pausedState);
          return true;
        } else {
          this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
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
}