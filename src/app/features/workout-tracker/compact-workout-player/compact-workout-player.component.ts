import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer, of, lastValueFrom, firstValueFrom } from 'rxjs';
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
import { ClickOutsideDirective } from '../../../shared/directives/click-outside.directive';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { ActionMenuComponent } from '../../../shared/components/action-menu/action-menu';

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
    CommonModule, DatePipe, WeightUnitPipe, IconComponent,
    ExerciseSelectionModalComponent, FormsModule, ActionMenuComponent, ClickOutsideDirective,
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
  protected alertService = inject(AlertService);
  protected toastService = inject(ToastService);
  protected unitsService = inject(UnitsService);
  private weightUnitPipe = inject(WeightUnitPipe);

  private cdr = inject(ChangeDetectorRef);

  routine = signal<Routine | null | undefined>(undefined);
  sessionState = signal<SessionState>(SessionState.Loading);
  sessionTimerDisplay = signal('00:00');
  expandedExerciseIndex = signal<number | null>(null);
  activeActionMenuIndex = signal<number | null>(null);

  showCompletedSetsForExerciseInfo = signal(true);
  showCompletedSetsForDayInfo = signal(false);

  private workoutStartTime: number = 0;
  private timerSub: Subscription | undefined;
  private routeSub: Subscription | undefined;

  routineId: string | null = null;
  currentWorkoutLog = signal<Partial<WorkoutLog>>({});

  defaultExercises: Exercise[] = [];
  availableExercises: Exercise[] = [];

  // --- Modal States ---
  isAddExerciseModalOpen = signal(false);
  isSwitchExerciseModalOpen = signal(false);
  isPerformanceInsightsModalOpen = signal(false);
  isShowingSimilarInSwitchModal = signal(false);
  exercisesForSwitchModal = signal<Exercise[]>([]);

  // --- Data for Modals ---
  modalSearchTerm = signal('');
  exerciseToSwitchIndex = signal<number | null>(null);
  insightsData = signal<{
    exercise: WorkoutExercise;
    baseExercise: Exercise | null;
    lastPerformance: LastPerformanceSummary | null;
    personalBests: PersonalBestSet[];
    completedSetsInSession: LoggedSet[];
  } | null>(null);

  filteredExercisesForSwitchModal = computed(() => {
    let term = this.modalSearchTerm().toLowerCase();
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

  ngOnInit(): void {
    this.loadAvailableExercises();
    this.routeSub = this.route.paramMap.pipe(
      switchMap((params) => {
        this.routineId = params.get('routineId');
        return this.routineId ? this.workoutService.getRoutineById(this.routineId) : of(null);
      })
    ).subscribe((routine) => {
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
        const elapsed = Math.floor((Date.now() - this.workoutStartTime) / 1000);
        const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const secs = String(elapsed % 60).padStart(2, '0');
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
    return (set.weight ?? 0) > 0;
  }

  getLoggedSet(exIndex: number, setIndex: number): LoggedSet | undefined {
    const exercise = this.routine()?.exercises[exIndex];
    const exerciseLog = this.currentWorkoutLog().exercises?.find(e => e.id === exercise?.id);
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
    if (!exerciseLog) {
      exerciseLog = {
        id: exercise.id, exerciseId: exercise.exerciseId, exerciseName: exercise.exerciseName!, sets: [],
        rounds: exercise.rounds ?? 1, type: exercise.type || 'standard'
      };
      log.exercises.push(exerciseLog);
    }
    const existingIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === set.id);
    if (existingIndex > -1) {
      exerciseLog.sets.splice(existingIndex, 1);
    } else {
      const newLoggedSet: LoggedSet = {
        id: uuidv4(), exerciseName: exercise.exerciseName, plannedSetId: set.id, exerciseId: exercise.exerciseId,
        type: set.type, repsAchieved: set.reps ?? 0, weightUsed: set.weight ?? undefined,
        durationPerformed: set.duration, distanceAchieved: set.distance, timestamp: new Date().toISOString(),
      };
      exerciseLog.sets.push(newLoggedSet);
      const order = exercise.sets.map(s => s.id);
      exerciseLog.sets.sort((a, b) => order.indexOf(a.plannedSetId!) - order.indexOf(b.plannedSetId!));
    }
    this.currentWorkoutLog.set({ ...log });
  }

  updateSetData(exIndex: number, setIndex: number, field: 'reps' | 'weight' | 'distance' | 'time', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[exIndex];
    const set = exercise.sets[setIndex];
    switch (field) {
      case 'reps': set.reps = parseFloat(value) || 0; break;
      case 'weight': set.weight = parseFloat(value) || 0; break;
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
    this.cdr.detectChanges();
  }

  async finishWorkout(): Promise<void> {
    const analysis = this.analyzeWorkoutCompletion();
    let msg = 'Are you sure you want to finish and save this workout?';
    if (analysis.incompleteExercises.length || analysis.skippedExercises.length) {
      msg = `You have ${analysis.skippedExercises.length} skipped and ${analysis.incompleteExercises.length} incomplete exercises. Finish anyway?`;
    }
    const confirm = await this.alertService.showConfirm('Finish Workout', msg, 'Finish Anyway', 'Go Back');
    if (confirm?.data) {
      const log = this.currentWorkoutLog();
      log.endTime = Date.now();
      log.durationMinutes = Math.round((log.endTime - (log.startTime!)) / 60000);
      log.exercises = log.exercises!.filter(ex => ex.sets.length > 0);
      if (log.startTime) {
        const savedLog = this.trackingService.addWorkoutLog(log as Omit<WorkoutLog, 'id'> & { startTime: number });
        this.sessionState.set(SessionState.End);
        this.timerSub?.unsubscribe();
        this.router.navigate(['/workout/summary', savedLog.id]);
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

  // --- Action Menu Logic ---
  toggleActionMenu(index: number, event: Event) {
    event.stopPropagation();
    this.activeActionMenuIndex.update(current => current === index ? null : index);
  }

  closeActionMenu() { this.activeActionMenuIndex.set(null); }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }) {
    const { actionKey, data } = event;
    const { exIndex } = data;
    switch (actionKey) {
      case 'switch': this.openSwitchExerciseModal(exIndex); break;
      case 'insights': this.openPerformanceInsightsModal(exIndex); break;
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
    const expandedIndex = this.expandedExerciseIndex();
    if (expandedIndex !== null && expandedIndex !== exIndex) {
      this.toggleExerciseExpansion(exIndex);
    }
  }

  async removeExercise(exIndex: number) {
    const routine = this.routine();
    if (!routine) return;
    const exerciseName = routine.exercises[exIndex].exerciseName;
    const confirm = await this.alertService.showConfirm("Remove Exercise", `Remove ${exerciseName}?`);
    if (confirm?.data) {
      routine.exercises.splice(exIndex, 1);
      this.routine.set({ ...routine });
      this.toastService.info(`${exerciseName} removed`);
    }
  }

  // --- Modals ---
  private loadAvailableExercises(): void {
    this.exerciseService.getExercises().pipe(take(1)).subscribe(e => {
      this.availableExercises = e.filter(ex => !ex.isHidden)
      this.defaultExercises = e.filter(ex => !ex.isHidden)
    });
  }

  openAddExerciseModal(): void { this.isAddExerciseModalOpen.set(true); }
  closeAddExerciseModal(): void {
    this.isAddExerciseModalOpen.set(false);
    this.availableExercises = this.defaultExercises;
  }

  openSwitchExerciseModal(exIndex: number): void {
    this.exercisesForSwitchModal.set([]); // Clear any previous "similar" results

    this.exerciseToSwitchIndex.set(exIndex);
    this.isSwitchExerciseModalOpen.set(true);
  }
  closeSwitchExerciseModal(): void {
    this.isSwitchExerciseModalOpen.set(false);
    this.isShowingSimilarInSwitchModal.set(false);
    this.exerciseToSwitchIndex.set(null);
    this.availableExercises = this.defaultExercises;
  }

  async openPerformanceInsightsModal(exIndex: number): Promise<void> {
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[exIndex];

    // FIX: Add take(1) to ensure observables complete for lastValueFrom
    const baseExercise$ = this.exerciseService.getExerciseById(exercise.exerciseId).pipe(take(1));
    const lastPerformance$ = this.trackingService.getLastPerformanceForExercise(exercise.exerciseId).pipe(take(1));
    const personalBests$ = this.trackingService.getAllPersonalBestsForExercise(exercise.exerciseId).pipe(take(1));

    try {
      const [baseExercise, lastPerformance, personalBests] = await Promise.all([
        lastValueFrom(baseExercise$),
        lastValueFrom(lastPerformance$),
        lastValueFrom(personalBests$)
      ]);
      const completedSets = this.currentWorkoutLog().exercises?.find(e => e.id === exercise.id)?.sets || [];

      if (!baseExercise || baseExercise === null) {
        return;
      }
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
    const newWorkoutExercise: WorkoutExercise = {
      id: uuidv4(), exerciseId: exercise.id, exerciseName: exercise.name, sets: [{
        id: uuidv4(), reps: this.isCardio({ exerciseId: exercise.id } as WorkoutExercise) ? undefined : 8,
        weight: this.isCardio({ exerciseId: exercise.id } as WorkoutExercise) ? undefined : 10,
        distance: this.isCardio({ exerciseId: exercise.id } as WorkoutExercise) ? 1 : undefined,
        duration: this.isCardio({ exerciseId: exercise.id } as WorkoutExercise) ? 300 : undefined,
        restAfterSet: 60, type: 'standard'
      }], type: 'standard', rounds: 1, supersetId: null, supersetOrder: null
    };
    this.routine.update(r => { r?.exercises.push(newWorkoutExercise); return r; });
    this.closeAddExerciseModal();
  }

  handleExerciseSwitch(newExercise: Exercise) {
    const index = this.exerciseToSwitchIndex();
    if (index === null) return;
    this.routine.update(r => {
      if (r) {
        r.exercises[index].exerciseId = newExercise.id;
        r.exercises[index].exerciseName = newExercise.name;
        this.toastService.success(`Switched to ${newExercise.name}`);
      }
      return r;
    });
    this.closeSwitchExerciseModal();

    const expandedIndex = this.expandedExerciseIndex();
    if (expandedIndex !== null && expandedIndex !== index) {
      this.toggleExerciseExpansion(index);
    }
  }

  // FIX: Make this a stable property to prevent re-rendering
  readonly exerciseActionMenuItems: ActionMenuItem[] = [
    { label: 'Switch Exercise', actionKey: 'switch', iconName: 'change' },
    { label: 'Performance Insights', actionKey: 'insights', iconName: 'chart' },
    { label: 'Add Warm-up Set', actionKey: 'add_warmup', iconName: 'plus-circle' },
    { isDivider: true },
    { label: 'Remove Exercise', actionKey: 'remove', iconName: 'trash', buttonClass: 'text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-700/50' }
  ];

  getExerciseActionItemsWithData(exIndex: number): ActionMenuItem[] {
    return this.exerciseActionMenuItems.map(item => ({ ...item, data: { ...item.data, exIndex } }));
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

  getLogDropdownActionItems(exerciseId: number, mode: 'dropdown' | 'compact-bar'): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 inline-flex items-center text-sm hover:text-gray-100 hover:animate-pulse';;

    const defaultIconClass = 'w-6 h-6 mr-2';
    const actionsArray: ActionMenuItem[] = [
      {
        label: 'Switch Exercise', actionKey: 'switch', iconName: 'change', iconClass: defaultIconClass, data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      },
      {
        label: 'Performance Insights', actionKey: 'insights', iconName: 'chart', iconClass: defaultIconClass, data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      },
      {
        label: 'Add Warm-up Set', actionKey: 'add_warmup', iconName: 'plus-circle', iconClass: defaultIconClass, data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      },
      { isDivider: true },
      {
        label: 'Remove Exercise', actionKey: 'remove', iconName: 'trash', iconClass: defaultIconClass, data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
      }
    ];
    return actionsArray;
  }

  /**
     * Fetches exercises similar to the current one and displays them in the modal.
     */
  async findAndShowSimilarExercises(exerciseToSwitchIndex: number | null): Promise<void> {
    if (exerciseToSwitchIndex === undefined || exerciseToSwitchIndex === null) return;
    const activeInfo: WorkoutExercise | undefined = this.routine()?.exercises.find((ex, index) => index === exerciseToSwitchIndex);
    if (!activeInfo) return;

    // Ensure we have the full base exercise definition
    let baseExercise = this.availableExercises.find(ex => ex.id === activeInfo.exerciseId);
    if (!baseExercise) {
      baseExercise = await firstValueFrom(this.exerciseService.getExerciseById(activeInfo.exerciseId));
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
      this.availableExercises = [...similarExercises];

      this.exercisesForSwitchModal.set(similarExercises);
      this.isShowingSimilarInSwitchModal.set(true); // Set the flag to display the 'similar' list
    } catch (error) {
      console.error("Error fetching similar exercises:", error);
      this.toastService.error("Could not load similar exercises.", 0, "Error");
    }
  }

  toggleCompletedSetsForExerciseInfo(): void {
    this.showCompletedSetsForExerciseInfo.update(v => !v);
  }

  toggleCompletedSetsForDayInfo(): void {
    this.showCompletedSetsForDayInfo.update(v => !v);
  }

  areActionsVisible(exerciseIndex: number): boolean {
    return this.activeActionMenuIndex() === exerciseIndex;
  }
}