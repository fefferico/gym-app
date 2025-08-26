import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer, of, lastValueFrom, firstValueFrom } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
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
import { ActionMenuComponent } from '../../../shared/components/action-menu/action-menu';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { StorageService } from '../../../core/services/storage.service';
import { MenuMode } from '../../../core/models/app-settings.model';

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
    ExerciseSelectionModalComponent, FormsModule, ActionMenuComponent,
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
  programId: string | null = null;
  scheduledDay: string | null = null;

  currentWorkoutLog = signal<Partial<WorkoutLog>>({ exercises: [] });

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

  workoutProgress = computed(() => {
    const routine = this.routine();
    const log = this.currentWorkoutLog();

    if (!routine || routine.exercises.length === 0) {
      return 0;
    }

    const totalPlannedSets = routine.exercises.reduce((total, ex) => total + ex.sets.length, 0);
    if (totalPlannedSets === 0) {
      return 0; // Avoid division by zero
    }

    const totalCompletedSets = log.exercises?.reduce((total, ex) => total + ex.sets.length, 0) ?? 0;

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

  ngOnInit(): void {
    this.loadAvailableExercises();

    const routeSnapshot = this.route.snapshot;
    const targetRoutineId = routeSnapshot.paramMap.get('routineId');
    const targetProgramId = routeSnapshot.queryParamMap.get('programId');
    const targetProgramScheduledDayId = routeSnapshot.queryParamMap.get('scheduledDayId');

    this.routeSub = this.route.paramMap.pipe(
      switchMap((params) => {
        this.routineId = targetRoutineId;
        this.programId = targetProgramId;
        this.scheduledDay = targetProgramScheduledDayId;
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
      programId: this.programId ?? undefined,
      scheduledDayId: this.scheduledDay ?? undefined,
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
      // If the exercise log doesn't exist, create it.
      exerciseLog = {
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName!,
        sets: [],
        rounds: exercise.rounds ?? 1,
        type: exercise.type || 'standard'
      };
      log.exercises.push(exerciseLog);
    }

    const existingIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === set.id);

    if (existingIndex > -1) {
      // The set exists, so we are un-checking it (removing it).
      exerciseLog.sets.splice(existingIndex, 1);

      // Check if the exercise log has any sets left.
      if (exerciseLog.sets.length === 0) {
        // If there are no sets left, remove the entire exercise log.
        const emptyExerciseLogIndex = log.exercises.findIndex(e => e.id === exerciseLog!.id);
        if (emptyExerciseLogIndex > -1) {
          log.exercises.splice(emptyExerciseLogIndex, 1);
        }
      }
    } else {
      // The set does not exist, so we are checking it (adding it).
      const newLoggedSet: LoggedSet = {
        id: uuidv4(),
        exerciseName: exercise.exerciseName,
        plannedSetId: set.id,
        exerciseId: exercise.exerciseId,
        type: set.type,
        repsAchieved: set.reps ?? 0,
        weightUsed: set.weight ?? undefined,
        durationPerformed: set.duration,
        distanceAchieved: set.distance,
        timestamp: new Date().toISOString(),
      };
      exerciseLog.sets.push(newLoggedSet);

      // Ensure the sets remain in their original planned order.
      const order = exercise.sets.map(s => s.id);
      exerciseLog.sets.sort((a, b) => order.indexOf(a.plannedSetId!) - order.indexOf(b.plannedSetId!));
    }

    // Update the signal with the modified log to trigger UI updates.
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
        this.timerSub?.unsubscribe();

        // +++ START: NEW PROGRAM COMPLETION CHECK +++
        if (savedLog.programId) {
          try {
            const isProgramCompleted = await this.trainingProgramService.checkAndHandleProgramCompletion(savedLog.programId, savedLog);

            if (isProgramCompleted) {
              this.toastService.success(`Congrats! Program completed!`, 5000, "Program Finished", false);

              // Stop all player activity before navigating
              // this.stopAllActivity();
              this.storageService.removePausedWorkout();

              // Navigate to the new completion page with relevant IDs
              this.router.navigate(['/training-programs/completed', savedLog.programId], {
                queryParams: { logId: savedLog.id }
              });

              // return true; // Exit the function as we've handled navigation
            } else {
              this.router.navigate(['/workout/summary', savedLog.id]);
            }
          } catch (error) {
            console.error("Error during program completion check:", error);
            // Continue with normal workout summary flow even if the check fails
          }
          // +++ END: NEW PROGRAM COMPLETION CHECK +++
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
    const expandedIndex = this.expandedExerciseIndex();
    if (expandedIndex === null || expandedIndex !== exIndex) {
      this.toggleExerciseExpansion(exIndex);
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

    if (type === 'warmup') {
      exercise.sets.unshift(newSet);
    } else {
      exercise.sets.push(newSet);
    }

    this.routine.set({ ...routine });
    this.toastService.success(`${type === 'warmup' ? 'Warm-up set' : 'Set'} added to ${exercise.exerciseName}`);
    const expandedIndex = this.expandedExerciseIndex();
    if (expandedIndex === null || expandedIndex !== exIndex) {
      this.toggleExerciseExpansion(exIndex);
    }
  }

  async removeSet(exIndex: number, setIndex: number) {
    const routine = this.routine();
    if (!routine) return;
    const exercise = routine.exercises[exIndex];
    const setToRemove = exercise.sets[setIndex];

    const baseExercise = this.availableExercises.find(ex => ex.id === exercise.exerciseId);
    const isCardioExercise = baseExercise?.category === 'cardio';
    // const isEmptySet = setToRemove && ((isCardioExercise && !setToRemove.distance && !setToRemove.duration) || (!isCardioExercise && !setToRemove.reps && !setToRemove.weight));
    const isLoggedSet = setToRemove && this.isSetCompleted(exIndex, setIndex);

    const confirm = isLoggedSet ? await this.alertService.showConfirm("Remove Set", `Are you sure you want to remove logged Set #${setIndex + 1} from ${exercise.exerciseName}?`) : { data: true };
    if (confirm?.data) {
      // First, remove from the routine plan
      exercise.sets.splice(setIndex, 1);
      this.routine.set({ ...routine });

      // Second, remove from the workout log if it was completed
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
      // First, remove from routine plan
      routine.exercises.splice(exIndex, 1);
      this.routine.set({ ...routine });

      // Second, remove from workout log
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
      const completedSets = this.currentWorkoutLog().exercises?.find(e => e.id === exercise.id)?.sets || [];

      if (!baseExercise) {
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
    const isCardioExercise = exercise.category === 'cardio';
    const newWorkoutExercise: WorkoutExercise = {
      id: uuidv4(), exerciseId: exercise.id, exerciseName: exercise.name, sets: [{
        id: uuidv4(), reps: isCardioExercise ? undefined : 8, weight: isCardioExercise ? undefined : 10,
        distance: isCardioExercise ? 1 : undefined, duration: isCardioExercise ? 300 : undefined,
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
      if (similar.length === 0) {
        this.toastService.info("No similar exercises found.");
      }
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
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const warmupBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-blue-400 flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
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
        label: 'Add Warm-up Set', actionKey: 'add_warmup', iconName: 'flame', data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + warmupBtnClass,
      },
      {
        label: 'Add Set', actionKey: 'add_set', iconName: 'plus-circle', data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      },
      { isDivider: true },
      {
        label: 'Remove Exercise', actionKey: 'remove', iconName: 'trash', data: { exIndex: exerciseId },
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
      }
    ];
    return actionsArray;
  }

}