import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer, of } from 'rxjs';
import { switchMap, tap, take } from 'rxjs/operators';
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
import { ClickOutsideDirective } from '../../../shared/directives/click-outside.directive';
import { ActionMenuItem } from '../../../core/models/action-menu.model';

enum SessionState {
  Loading = 'loading',
  Playing = 'playing',
  Paused = 'paused',
  Error = 'error',
  End = 'end',
}

@Component({
  selector: 'app-compact-workout-player',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    WeightUnitPipe,
    IconComponent,
    ExerciseSelectionModalComponent,
    FormsModule,
    ActionMenuComponent,
    ClickOutsideDirective,
  ],
  templateUrl: './compact-workout-player.component.html',
  styleUrls: ['./compact-workout-player.component.scss'],
  providers: [DecimalPipe],
})
export class CompactWorkoutPlayerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  protected router = inject(Router);
  private workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  protected trackingService = inject(TrackingService);
  protected alertService = inject(AlertService);
  protected toastService = inject(ToastService);
  protected unitsService = inject(UnitsService);
  private cdr = inject(ChangeDetectorRef);

  routine = signal<Routine | null | undefined>(undefined);
  sessionState = signal<SessionState>(SessionState.Loading);
  sessionTimerDisplay = signal('00:00');
  expandedExerciseIndex = signal<number | null>(null);
  activeActionMenuIndex = signal<number | null>(null);

  private workoutStartTime: number = 0;
  private timerSub: Subscription | undefined;
  private routeSub: Subscription | undefined;

  routineId: string | null = null;
  currentWorkoutLog = signal<Partial<WorkoutLog>>({});

  availableExercises: Exercise[] = [];
  isExerciseModalOpen = signal(false);
  modalSearchTerm = signal('');

  // Signals for new modals
  isSwitchExerciseModalOpen = signal(false);
  isPerformanceInsightsModalOpen = signal(false);


  ngOnInit(): void {
    this.loadAvailableExercises();
    this.routeSub = this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.routineId = params.get('routineId');
          if (this.routineId) {
            return this.workoutService.getRoutineById(this.routineId);
          }
          return of(null);
        })
      )
      .subscribe((routine) => {
        if (routine) {
          this.routine.set(JSON.parse(JSON.stringify(routine)));
          this.startWorkout();
        } else {
          this.sessionState.set(SessionState.Error);
          this.toastService.error('Workout routine not found.');
        }
      });
  }

  ngOnDestroy(): void {
    this.timerSub?.unsubscribe();
    this.routeSub?.unsubscribe();
  }

  startWorkout(): void {
    this.workoutStartTime = Date.now();
    this.sessionState.set(SessionState.Playing);
    this.currentWorkoutLog.set({
      routineId: this.routineId ?? undefined,
      routineName: this.routine()?.name,
      startTime: this.workoutStartTime,
      date: format(new Date(), 'yyyy-MM-dd'),
      exercises: [],
    });
    this.startSessionTimer();
  }

  startSessionTimer(): void {
    this.timerSub = timer(0, 1000).subscribe(() => {
      if (this.sessionState() === SessionState.Playing) {
        const elapsedSeconds = Math.floor(
          (Date.now() - this.workoutStartTime) / 1000
        );
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        this.sessionTimerDisplay.set(
          `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      }
    });
  }

  isCardio(exercise: WorkoutExercise): boolean {
    const baseExercise = this.availableExercises.find(e => e.id === exercise.exerciseId);
    return baseExercise?.category === 'cardio';
  }

  isSetDataValid(exIndex: number, setIndex: number): boolean {
    const exercise = this.routine()?.exercises[exIndex];
    const set = exercise?.sets[setIndex];
    if (!exercise || !set) return false;

    if (this.isCardio(exercise)) {
      return (set.distance ?? 0) > 0 || (set.duration ?? 0) > 0;
    } else {
      return (set.weight ?? 0) > 0;
    }
  }

  getLoggedSet(exIndex: number, setIndex: number): LoggedSet | undefined {
    const exercise = this.routine()?.exercises[exIndex];
    if (!exercise) return undefined;

    const exerciseLog = this.currentWorkoutLog().exercises?.find(e => e.id === exercise.id);
    if (!exerciseLog) return undefined;

    const plannedSetId = exercise.sets[setIndex]?.id;
    return exerciseLog.sets.find(s => s.plannedSetId === plannedSetId);
  }

  isSetCompleted(exIndex: number, setIndex: number): boolean {
    return !!this.getLoggedSet(exIndex, setIndex);
  }

  toggleSetCompletion(
    exercise: WorkoutExercise,
    set: ExerciseSetParams,
    exIndex: number,
    setIndex: number
  ): void {
    const log = this.currentWorkoutLog();
    if (!log.exercises) log.exercises = [];

    let exerciseLog = log.exercises.find((e) => e.id === exercise.id);
    const plannedSetId = set.id;

    if (!exerciseLog) {
      exerciseLog = {
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName ?? 'Unknown Exercise',
        sets: [],
        rounds: exercise.rounds ?? 1,
        type: exercise.type || 'standard'
      };
      log.exercises.push(exerciseLog);
    }

    const existingSetIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === plannedSetId);

    if (existingSetIndex > -1) {
      exerciseLog.sets.splice(existingSetIndex, 1);
    } else {
      const newLoggedSet: LoggedSet = {
        id: uuidv4(),
        exerciseName: exercise.exerciseName,
        plannedSetId: plannedSetId,
        exerciseId: exercise.exerciseId,
        type: set.type,
        repsAchieved: set.reps ?? 0,
        weightUsed: set.weight ?? undefined,
        durationPerformed: set.duration,
        distanceAchieved: set.distance,
        timestamp: new Date().toISOString(),
      };
      exerciseLog.sets.push(newLoggedSet);
      const routineSetsOrder = exercise.sets.map(s => s.id);
      exerciseLog.sets.sort((a, b) => routineSetsOrder.indexOf(a.plannedSetId!) - routineSetsOrder.indexOf(b.plannedSetId!));
    }
    this.currentWorkoutLog.set({ ...log });
  }

  updateSetData(
    exIndex: number,
    setIndex: number,
    field: 'reps' | 'weight' | 'distance' | 'time',
    event: Event
  ) {
    const value = (event.target as HTMLInputElement).value;
    const routine = this.routine();
    if (!routine) return;

    const exercise = routine.exercises[exIndex];
    const set = exercise.sets[setIndex];

    // Update the routine signal directly so the UI is always in sync
    switch (field) {
      case 'reps':
        set.reps = parseFloat(value) || 0;
        break;
      case 'weight':
        set.weight = parseFloat(value) || 0;
        break;
      case 'distance':
        set.distance = parseFloat(value) || 0;
        break;
      case 'time':
        set.duration = this.parseTimeToSeconds(value);
        break;
    }
    this.routine.set({ ...routine });

    // If the set is already logged, update the log as well
    const loggedSet = this.getLoggedSet(exIndex, setIndex);
    if (loggedSet) {
      this.toggleSetCompletion(exercise, set, exIndex, setIndex); // "Un-check"
      this.toggleSetCompletion(exercise, set, exIndex, setIndex); // "Re-check" with new values
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
    let seconds = 0;
    if (parts.length === 2) { // mm:ss
      seconds = parts[0] * 60 + parts[1];
    } else { // seconds only
      seconds = parts[0];
    }
    return seconds;
  }

  formatSecondsToTime(totalSeconds: number | undefined): string {
    if (totalSeconds === null || totalSeconds === undefined) return '';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }


  toggleExerciseExpansion(index: number): void {
    this.expandedExerciseIndex.update((current) =>
      current === index ? null : index
    );
  }

  // --- Finish Workout Logic ---
  async finishWorkout(): Promise<void> {
    const analysis = this.analyzeWorkoutCompletion();
    let confirmationMessage = 'Are you sure you want to finish and save this workout?';

    if (analysis.incompleteExercises.length > 0 || analysis.skippedExercises.length > 0) {
      confirmationMessage = 'You have some incomplete exercises. Are you sure you want to finish anyway?';
    }

    const confirm = await this.alertService.showConfirm('Finish Workout', confirmationMessage, 'Finish Anyway', 'Go Back');

    if (confirm && confirm.data) {
      const log = this.currentWorkoutLog();
      log.endTime = Date.now();
      log.durationMinutes = Math.round(
        (log.endTime - (log.startTime ?? log.endTime)) / 60000
      );

      log.exercises = log.exercises!.filter(ex => ex.sets.length > 0);

      if (log.startTime) {
        const savedLog = this.trackingService.addWorkoutLog(log as Omit<WorkoutLog, 'id'> & { startTime: number });
        this.sessionState.set(SessionState.End);
        this.timerSub?.unsubscribe();
        this.router.navigate(['/workout/summary', savedLog.id]);
      } else {
        this.toastService.error("Could not save workout due to missing start time.");
      }
    }
  }

  analyzeWorkoutCompletion(): { completedExercises: string[], incompleteExercises: string[], skippedExercises: string[] } {
    const routine = this.routine();
    const log = this.currentWorkoutLog();
    if (!routine) return { completedExercises: [], incompleteExercises: [], skippedExercises: [] };

    const completed: string[] = [];
    const incomplete: string[] = [];
    const skipped: string[] = [];

    routine.exercises.forEach(ex => {
      const loggedEx = log.exercises?.find(le => le.id === ex.id);
      const loggedSetCount = loggedEx?.sets.length ?? 0;

      if (loggedSetCount === ex.sets.length) {
        completed.push(ex.exerciseName!);
      } else if (loggedSetCount > 0) {
        incomplete.push(ex.exerciseName!);
      } else {
        skipped.push(ex.exerciseName!);
      }
    });

    return { completedExercises: completed, incompleteExercises: incomplete, skippedExercises: skipped };
  }


  // --- Action Menu Logic ---
  toggleActionMenu(index: number, event: Event) {
    event.stopPropagation();
    this.activeActionMenuIndex.update(current => current === index ? null : index);
    this.cdr.detectChanges();
  }

  closeActionMenu() {
    this.activeActionMenuIndex.set(null);
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }) {
    const { actionKey, data } = event;
    const { exIndex } = data;

    switch (actionKey) {
      case 'switch':
        this.openSwitchExerciseModal();
        break;
      case 'insights':
        this.openPerformanceInsightsModal();
        break;
      case 'add_warmup':
        this.addWarmupSet(exIndex);
        break;
      case 'remove':
        this.removeExercise(exIndex);
        break;
    }
  }

  addWarmupSet(exIndex: number) {
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[exIndex];
    const firstSet = exercise.sets[0];

    const newWarmupSet: ExerciseSetParams = {
      id: uuidv4(),
      reps: 12,
      weight: firstSet?.weight ? firstSet.weight / 2 : 0,
      restAfterSet: 30,
      type: 'warmup'
    };

    exercise.sets.unshift(newWarmupSet);
    this.routine.set({ ...routine });
    this.toastService.success(`Warm-up set added to ${exercise.exerciseName}`);
  }

  removeExercise(exIndex: number) {
    const routine = this.routine();
    if (!routine) return;
    const exerciseName = routine.exercises[exIndex].exerciseName;
    routine.exercises.splice(exIndex, 1);
    this.routine.set({ ...routine });
    this.toastService.info(`${exerciseName} removed from workout`);
  }

  // --- Modals ---
  private loadAvailableExercises(): void {
    this.exerciseService.getExercises().pipe(take(1)).subscribe(exercises => {
      this.availableExercises = exercises.filter(ex => !ex.isHidden);
    });
  }

  openExerciseSelectionModal(): void {
    this.isExerciseModalOpen.set(true);
  }

  closeExerciseSelectionModal(): void {
    this.isExerciseModalOpen.set(false);
  }

  openSwitchExerciseModal(): void {
    this.isSwitchExerciseModalOpen.set(true);
    // Placeholder - you'd pass the current exercise to find similar ones
    this.toastService.info("Switch Exercise modal would open here.");
  }

  openPerformanceInsightsModal(): void {
    this.isPerformanceInsightsModalOpen.set(true);
    // Placeholder
    this.toastService.info("Performance Insights modal would open here.");
  }

  addExerciseToRoutine(exercise: Exercise): void {
    const isCardioExercise = exercise.category === 'cardio';

    const newWorkoutExercise: WorkoutExercise = {
      id: uuidv4(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sets: [{
        id: uuidv4(),
        reps: isCardioExercise ? undefined : 8,
        weight: isCardioExercise ? undefined : 10,
        distance: isCardioExercise ? 1 : undefined,
        duration: isCardioExercise ? 300 : undefined,
        restAfterSet: 60,
        type: 'standard'
      }],
      type: 'standard',
      rounds: 1,
      supersetId: null,
      supersetOrder: null
    };

    const currentRoutine = this.routine();
    if (currentRoutine) {
      currentRoutine.exercises.push(newWorkoutExercise);
      this.routine.set({ ...currentRoutine });
    }
    this.closeExerciseSelectionModal();
  }

  getLogDropdownActionItems(exerciseId: number, mode: 'dropdown' | 'compact-bar'): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 inline-flex items-center text-sm hover:text-gray-100 hover:animate-pulse';;

    const actionsArray: ActionMenuItem[] = [
      {
        label: 'Switch Exercise', actionKey: 'switch', iconName: 'change', data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      },
      {
        label: 'Performance Insights', actionKey: 'insights', iconName: 'chart', data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      },
      {
        label: 'Add Warm-up Set', actionKey: 'add_warmup', iconName: 'plus-circle', data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      },
      { isDivider: true },
      {
        label: 'Remove Exercise', actionKey: 'remove', iconName: 'trash', iconClass: 'w-8 h-8 mr-2', data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
      }
    ];
    return actionsArray;
  }
}