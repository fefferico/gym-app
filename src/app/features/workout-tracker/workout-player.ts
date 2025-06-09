import { Component, inject, OnInit, OnDestroy, signal, computed, WritableSignal, ChangeDetectorRef, HostListener, PLATFORM_ID } from '@angular/core';
import { CommonModule, TitleCasePipe, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, Observable, of, timer, firstValueFrom } from 'rxjs';
import { switchMap, tap, map, takeWhile, take } from 'rxjs/operators';
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


// Interface to manage the state of the currently active set/exercise
interface ActiveSetInfo {
  exerciseIndex: number;
  setIndex: number;
  exerciseData: WorkoutExercise;
  setData: ExerciseSetParams;
  baseExerciseInfo?: Exercise;
  isCompleted: boolean;
  actualReps?: number;
  actualWeight?: number | null;
  actualDuration?: number;
  notes?: string;
  isWarmup: boolean;
}

interface PausedWorkoutState {
  version: string;
  routineId: string | null;
  sessionRoutine: Routine; // The routine state as it was when paused (potentially modified)
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
}

enum SessionState {
  Loading = 'loading',
  Playing = 'playing',
  Paused = 'paused',
  Error = 'error',
}

enum TimedSetState {
  Idle = 'idle',
  Running = 'running',
  Paused = 'paused',
}

@Component({
  selector: 'app-workout-player',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, ReactiveFormsModule, FormsModule, WeightUnitPipe, FullScreenRestTimerComponent],
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

  private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';
  private readonly PAUSED_STATE_VERSION = '1.1';

  nextActionButtonLabel = signal<string>('SET DONE');
  isRestTimerVisible = signal(false);
  restDuration = signal(0);
  restTimerMainText = signal('RESTING');
  restTimerNextUpText = signal<string | null>(null);
  currentSetForm!: FormGroup;
  routineId: string | null = null;
  routine = signal<Routine | null | undefined>(undefined);
  private originalRoutineSnapshot: WorkoutExercise[] = [];

  currentExerciseIndex = signal(0);
  currentSetIndex = signal(0);
  private currentWorkoutLogExercises = signal<LoggedWorkoutExercise[]>([]);
  private workoutStartTime: number = 0;
  private routeSub: Subscription | undefined;
  private timerSub: Subscription | undefined;
  sessionTimerDisplay = signal('00:00:00');
  restTimerDisplay = signal<string | null>(null);
  currentBlockRound = signal(1);
  totalBlockRounds = signal(1);
  private wasRestTimerVisibleOnPause = false;
  private restTimerRemainingSecondsOnPause = 0;
  private restTimerInitialDurationOnPause = 0;
  private restTimerMainTextOnPause = 'RESTING';
  private restTimerNextUpTextOnPause: string | null = null;
  rpeValue = signal<number | null>(null);
  rpeOptions: number[] = Array.from({ length: 10 }, (_, i) => i + 1);
  showRpeSlider = signal(false);
  timedSetTimerState = signal<TimedSetState>(TimedSetState.Idle);
  timedSetElapsedSeconds = signal(0);
  private timedSetIntervalSub: Subscription | undefined;

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
      return r.exercises[exIndex].sets.filter(s => !s.isWarmup).length;
    }
    return 0;
  });

  getCurrentWorkingSetNumber = computed<number>(() => {
    const activeInfo = this.activeSetInfo();
    const r = this.routine();
    if (!activeInfo || !r || activeInfo.isWarmup) {
      return 0;
    }
    const currentExercise = r.exercises[activeInfo.exerciseIndex];
    let workingSetCounter = 0;
    for (let i = 0; i <= activeInfo.setIndex; i++) {
      if (!currentExercise.sets[i].isWarmup) {
        workingSetCounter++;
      }
      if (i === activeInfo.setIndex) {
        return workingSetCounter;
      }
    }
    return 0;
  });

  getCurrentWarmupSetNumber = computed<number>(() => {
    const activeInfo = this.activeSetInfo();
    const r = this.routine();
    if (!activeInfo || !r || !activeInfo.isWarmup) {
      return 0;
    }
    const currentExercise = r.exercises[activeInfo.exerciseIndex];
    let warmupSetCounter = 0;
    for (let i = 0; i <= activeInfo.setIndex; i++) {
      if (currentExercise.sets[i].isWarmup) {
        warmupSetCounter++;
      }
      if (i === activeInfo.setIndex) {
        return warmupSetCounter;
      }
    }
    return 0;
  });

  activeSetInfo = computed<ActiveSetInfo | null>(() => {
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
        isWarmup: !!setData.isWarmup,
        baseExerciseInfo: undefined,
        isCompleted: !!completedSetLog,
        actualReps: completedSetLog?.repsAchieved,
        actualWeight: completedSetLog?.weightUsed,
        actualDuration: completedSetLog?.durationPerformed,
        notes: completedSetLog?.notes,
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

  protected lastPerformanceForCurrentExercise: LastPerformanceSummary | null = null;
  editingTarget: 'reps' | 'weight' | 'duration' | null = null;
  editingTargetValue: number | string = '';
  sessionState = signal<SessionState>(SessionState.Loading);
  private sessionTimerElapsedSecondsBeforePause = 0;
  private wasTimedSetRunningOnPause = false;
  isWorkoutMenuVisible = signal(false);
  isPerformanceInsightsVisible = signal(false);
  showCompletedSetsInfo = signal<boolean>(false);

  constructor() {
    this.initializeCurrentSetForm();
  }

  private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID

  async ngOnInit(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) { // Check if running in a browser
      window.scrollTo(0, 0);
    }
    const hasPausedSession = await this.checkForPausedSession();
    if (!hasPausedSession) {
      this.loadNewWorkoutFromRoute();
    }
  }

  private resetAndPatchCurrentSetForm(): void {
    this.currentSetForm.reset({ rpe: null });
    this.rpeValue.set(null);
    this.showRpeSlider.set(false);

    const activeInfo = this.activeSetInfo();
    this.resetTimedSet();

    if (activeInfo) {
      const completedExerciseLog = this.currentWorkoutLogExercises().find(logEx => logEx.exerciseId === activeInfo.exerciseData.exerciseId);
      const completedSetLog = completedExerciseLog?.sets.find(logSet => logSet.plannedSetId === activeInfo.setData.id);

      let initialActualDuration = activeInfo.setData.duration ?? null;
      if (completedSetLog && completedSetLog.durationPerformed !== undefined) {
        initialActualDuration = completedSetLog.durationPerformed;
      }

      this.currentSetForm.patchValue({
        actualReps: completedSetLog?.repsAchieved ?? activeInfo.setData.reps ?? null,
        actualWeight: completedSetLog?.weightUsed ?? activeInfo.setData.weight ?? null,
        actualDuration: initialActualDuration,
        setNotes: completedSetLog?.notes ?? '',
        rpe: null
      });
    }
  }

  private startSessionTimer(): void {
    if (this.sessionState() === SessionState.Paused) return;
    if (this.timerSub) this.timerSub.unsubscribe();

    this.timerSub = timer(0, 1000).subscribe(() => {
      if (this.sessionState() === SessionState.Playing) {
        const currentDeltaSeconds = Math.floor((Date.now() - this.workoutStartTime) / 1000);
        const totalElapsedSeconds = this.sessionTimerElapsedSecondsBeforePause + currentDeltaSeconds;
        const hours = Math.floor(totalElapsedSeconds / 3600);
        const minutes = Math.floor((totalElapsedSeconds % 3600) / 60);
        const seconds = totalElapsedSeconds % 60;
        this.sessionTimerDisplay.set(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
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
    let exerciseLog = logs.find(exLog => exLog.exerciseId === exerciseData.exerciseId);

    if (exerciseLog) {
      const existingSetIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === loggedSet.plannedSetId);
      if (existingSetIndex > -1) {
        exerciseLog.sets[existingSetIndex] = loggedSet;
      } else {
        exerciseLog.sets.push(loggedSet);
      }
      this.currentWorkoutLogExercises.set([...logs]);
    } else {
      exerciseLog = {
        exerciseId: exerciseData.exerciseId,
        exerciseName: this.currentBaseExercise()?.name || exerciseData.exerciseName || 'Unknown Exercise',
        sets: [loggedSet]
      };
      this.currentWorkoutLogExercises.set([...logs, exerciseLog]);
    }
  }

  async finishWorkout(): Promise<void> {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Please resume workout before finishing.", 3000, "Session Paused");
      return;
    }
    if (this.sessionState() === SessionState.Loading) {
      this.toastService.info("Workout is still loading.", 3000, "Loading");
      return;
    }
    if (this.currentWorkoutLogExercises().length === 0) {
      this.toastService.info("No sets logged. Workout not saved.", 3000, "Empty Workout");
      this.router.navigate(['/workout']);
      return;
    }

    if (this.timerSub) this.timerSub.unsubscribe();

    const sessionRoutineValue = this.routine();
    const performedExercises = this.currentWorkoutLogExercises();

    let proceedToLog = true;
    let logAsNewRoutine = false;
    let updateOriginalRoutineStructure = false; // <-- NEW FLAG
    let newRoutineName = sessionRoutineValue?.name ? `${sessionRoutineValue.name} - ${new DatePipe('en-US').transform(Date.now(), 'MMM d')}` : `Ad-hoc Workout - ${new DatePipe('en-US').transform(Date.now(), 'MMM d, HH:mm')}`;

    if (this.routineId && this.originalRoutineSnapshot && this.originalRoutineSnapshot.length > 0 && sessionRoutineValue) {
      const differences = this.comparePerformedToOriginal(performedExercises, this.originalRoutineSnapshot);
      if (differences.majorDifference) {
        const confirmation = await this.alertService.showConfirmationDialog(
          'Workout Modified', // Changed title slightly
          `This workout differed from the original "${sessionRoutineValue.name}". How would you like to proceed?`,
          [
            { text: 'Save as New Routine', role: 'confirm', data: 'new', cssClass: 'bg-green-500 hover:bg-green-600 text-white' },
            { text: 'Update Original Routine', role: 'confirm', data: 'update_original', cssClass: 'bg-orange-500 hover:bg-orange-600 text-white' }, // <-- NEW OPTION
            { text: 'Log (Keep Original Structure)', role: 'confirm', data: 'log_only', cssClass: 'bg-blue-500 hover:bg-blue-600 text-white' },
            { text: 'Discard Workout', role: 'cancel', data: 'discard', cssClass: 'bg-gray-300 hover:bg-gray-400' }
          ] as AlertButton[]
        );

        if (confirmation && confirmation.data === 'new') {
          logAsNewRoutine = true;
          // ... (prompt for new routine name - existing logic)
          const nameInput = await this.alertService.showPromptDialog(
            'New Routine Name',
            'Enter a name for this new routine:',
            [{ name: 'newRoutineName', type: 'text', placeholder: 'E.g., My Custom Workout', value: newRoutineName }] as AlertInput[],
            'Save New Routine'
          );
          if (nameInput && nameInput['newRoutineName']) {
            newRoutineName = String(nameInput['newRoutineName']).trim();
          } else if (!nameInput && confirmation.data === 'new') {
            this.toastService.warning("New routine name not provided. Saving with default name.", 3000);
          } else {
            proceedToLog = false;
          }
        } else if (confirmation && confirmation.data === 'update_original') { // <<< --- HANDLING NEW OPTION ---
          updateOriginalRoutineStructure = true;
          // proceedToLog remains true. logAsNewRoutine remains false.
          this.toastService.info(`Original routine "${sessionRoutineValue.name}" will be updated with this session's structure.`, 3000, "Updating Original");
        } else if (confirmation && confirmation.data === 'log_only') {
          // User chose to log against the original routine but NOT update its structure.
          // proceedToLog remains true. logAsNewRoutine remains false. updateOriginalRoutineStructure remains false.
          this.toastService.info(`Workout will be logged against "${sessionRoutineValue.name}", structure unchanged.`, 3000, "Logging to Original");
        } else if (confirmation && confirmation.data === 'discard') {
          proceedToLog = false;
        } else if (!confirmation || (confirmation.role === 'cancel' && confirmation.data !== 'discard')) {
          proceedToLog = false;
        }
      }
    } else if (!this.routineId && performedExercises.length > 0) {
      logAsNewRoutine = true;
      // ... (prompt for ad-hoc routine name - existing logic)
      const nameInput = await this.alertService.showPromptDialog(
        'Save Ad-hoc Workout',
        'Enter a name for this new routine:',
        [{ name: 'newRoutineName', type: 'text', placeholder: newRoutineName, value: newRoutineName }] as AlertInput[],
        'Save New Routine'
      );
      if (nameInput && String(nameInput['newRoutineName']).trim()) {
        newRoutineName = String(nameInput['newRoutineName']).trim();
      } else if (!nameInput) {
        proceedToLog = false;
      }
    }

    if (!proceedToLog) {
      this.toastService.info("Workout not saved.", 3000, "Cancelled");
      this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
      if (this.router.url.includes('/play')) {
        this.router.navigate(['/workout']);
      }
      return;
    }

    const endTime = Date.now();
    const sessionStartTime = this.workoutStartTime - (this.sessionTimerElapsedSecondsBeforePause * 1000);
    const durationMinutes = Math.round((endTime - sessionStartTime) / (1000 * 60));

    let finalRoutineIdToLog: string | undefined = this.routineId || undefined;
    let finalRoutineNameForLog = sessionRoutineValue?.name || 'Ad-hoc Workout';

    if (logAsNewRoutine) {
      const newRoutine: Routine = {
        id: uuidv4(),
        name: newRoutineName,
        description: sessionRoutineValue?.description || 'Workout performed on ' + new DatePipe('en-US').transform(Date.now(), 'mediumDate'),
        goal: sessionRoutineValue?.goal || 'custom',
        exercises: this.convertLoggedToWorkoutExercises(performedExercises),
        // lastPerformed will be set after logging this workout against the new routine
      };
      this.workoutService.addRoutine(newRoutine);
      finalRoutineIdToLog = newRoutine.id;
      finalRoutineNameForLog = newRoutine.name;
      this.toastService.success(`New routine "${newRoutine.name}" created.`, 4000);
    }

    const finalLog: Omit<WorkoutLog, 'id'> = {
      routineId: finalRoutineIdToLog,
      routineName: finalRoutineNameForLog,
      startTime: sessionStartTime,
      endTime: endTime,
      durationMinutes: durationMinutes,
      exercises: this.currentWorkoutLogExercises(),
      date: new Date(sessionStartTime).toISOString().split('T')[0],
    };

    const savedLog = this.trackingService.addWorkoutLog(finalLog);
    this.toastService.success(`Workout logged against "${finalRoutineNameForLog}"!`, 5000, "Workout Finished");

    // Update routine's lastPerformed date and potentially its structure
    if (finalRoutineIdToLog) { // Ensure we have a routine ID to update
      const routineToUpdate = await firstValueFrom(this.workoutService.getRoutineById(finalRoutineIdToLog).pipe(take(1)));
      if (routineToUpdate) {
        let updatedRoutineData = { ...routineToUpdate, lastPerformed: new Date(sessionStartTime).toISOString() };

        if (updateOriginalRoutineStructure && !logAsNewRoutine && this.routineId === finalRoutineIdToLog) {
          // Update the structure of the original routine
          updatedRoutineData.exercises = this.convertLoggedToWorkoutExercises(performedExercises);
          // Optionally update name/description if they were editable during session and changed
          // For now, assume sessionRoutineValue holds any such in-session metadata edits
          if (sessionRoutineValue) {
            updatedRoutineData.name = sessionRoutineValue.name;
            updatedRoutineData.description = sessionRoutineValue.description;
            updatedRoutineData.goal = sessionRoutineValue.goal;
          }
          this.toastService.info(`Routine "${updatedRoutineData.name}" structure updated.`, 3000);
        }
        this.workoutService.updateRoutine(updatedRoutineData);
      }
    }

    this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
    this.router.navigate(['/workout/summary', savedLog.id]);
  }

  private comparePerformedToOriginal(
    performed: LoggedWorkoutExercise[],
    original: WorkoutExercise[]
  ): { majorDifference: boolean; details: string[] } {
    const details: string[] = [];
    let majorDifference = false;

    // 1. Check for difference in number of exercises
    if (performed.length !== original.length) {
      details.push(`Number of exercises changed (was ${original.length}, now ${performed.length}).`);
      majorDifference = true;
    }

    // 2. Compare exercises at each position (ID, name) and their sets' warmup status
    const commonLength = Math.min(performed.length, original.length);
    for (let i = 0; i < commonLength; i++) {
      const performedEx = performed[i];
      const originalEx = original[i];

      if (performedEx.exerciseId !== originalEx.exerciseId) {
        details.push(`Exercise at position ${i + 1} changed (was ${originalEx.exerciseName || originalEx.exerciseId}, now ${performedEx.exerciseName || performedEx.exerciseId}).`);
        majorDifference = true;
      }

      // Compare sets for warmup status differences
      if (performedEx.sets.length !== originalEx.sets.length) {
        details.push(`Set count for "${performedEx.exerciseName || performedEx.exerciseId}" changed (was ${originalEx.sets.length}, now ${performedEx.sets.length}).`);
        majorDifference = true; // Different number of sets is a major difference
      } else {
        // If set counts are the same, check if warmup status of any set differs
        for (let j = 0; j < performedEx.sets.length; j++) {
          const performedSet = performedEx.sets[j];
          const originalSet = originalEx.sets[j]; // Assuming sets correspond by index here
          // A more robust check might match by a plannedSetId if available on originalEx.sets

          // Check if isWarmup status differs
          // We need to be careful here: originalEx.sets[j] might not have isWarmup if it's a working set by default.
          // And loggedSet.isWarmup is always present.
          const originalIsWarmup = !!originalEx.sets[j]?.isWarmup; // Ensure boolean comparison
          const performedIsWarmup = !!performedSet.isWarmup;

          if (originalIsWarmup !== performedIsWarmup) {
            details.push(`Warm-up status for set ${j + 1} of "${performedEx.exerciseName || performedEx.exerciseId}" changed.`);
            majorDifference = true;
            break; // Found a difference in this exercise's sets, no need to check further sets for this exercise
          }
        }
      }
      if (majorDifference && details.some(d => d.includes(performedEx.exerciseName || performedEx.exerciseId))) {
        // If a major difference related to this exercise (ID or sets) was found,
        // we don't need to check further exercises if we only care about *any* major difference.
        // However, to provide comprehensive details, we continue the loop.
      }
    }

    // 3. Check for added exercises at the end of the performed list
    if (performed.length > original.length) {
      for (let i = original.length; i < performed.length; i++) {
        details.push(`Added exercise: ${performed[i].exerciseName || performed[i].exerciseId}.`);
        majorDifference = true;
      }
    }
    // 4. (Optional) Check for removed exercises if performed is shorter (already covered by length check for details, but explicitly for logic)
    if (original.length > performed.length && !majorDifference) { // Only if not already a major diff from length
      details.push(`One or more exercises were removed from the original routine.`); // Generic message
      majorDifference = true;
    }


    return { majorDifference, details };
  }

  private convertLoggedToWorkoutExercises(loggedExercises: LoggedWorkoutExercise[]): WorkoutExercise[] {
    const currentSessionRoutine = this.routine(); // Get the session's routine structure
    return loggedExercises.map(loggedEx => {
      // Try to find matching exercise in the *session's* routine to get superset/rounds info
      const sessionExercise = currentSessionRoutine?.exercises.find(re => re.exerciseId === loggedEx.exerciseId);

      return {
        id: uuidv4(),
        exerciseId: loggedEx.exerciseId,
        exerciseName: loggedEx.exerciseName,
        supersetId: sessionExercise?.supersetId || null,
        supersetOrder: sessionExercise?.supersetOrder ?? null,
        supersetSize: sessionExercise?.supersetSize ?? null,
        rounds: sessionExercise?.rounds ?? 1,
        notes: loggedEx.sets.map(s => s.notes).filter(n => !!n).join('; ') || '',
        sets: loggedEx.sets.map(loggedSet => {
          const originalPlannedSet = sessionExercise?.sets.find(s => s.id === loggedSet.plannedSetId);
          const newSet: ExerciseSetParams = {
            id: uuidv4(),
            reps: loggedSet.repsAchieved,
            weight: loggedSet.weightUsed,
            duration: loggedSet.durationPerformed,
            tempo: loggedSet.targetTempo || originalPlannedSet?.tempo,
            restAfterSet: loggedSet.targetRestAfterSet || originalPlannedSet?.restAfterSet || 60,
            notes: loggedSet.notes,
            isWarmup: loggedSet.isWarmup,
          };
          return newSet;
        })
      };
    });
  }

  get csf() {
    return this.currentSetForm.controls;
  }

  toggleTimedSetTimer(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Please resume to use the timer.", 3000, "Paused");
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
    }
    this.timedSetTimerState.set(TimedSetState.Running);
    if (this.timedSetIntervalSub) {
      this.timedSetIntervalSub.unsubscribe();
    }
    this.timedSetIntervalSub = timer(0, 1000).subscribe(() => {
      if (this.timedSetTimerState() === TimedSetState.Running) {
        this.timedSetElapsedSeconds.update(s => s + 1);
        this.currentSetForm.get('actualDuration')?.setValue(this.timedSetElapsedSeconds(), { emitEvent: false });
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
    const currentExercise = routine.exercises[activeInfo.exerciseIndex];
    if (activeInfo.setIndex === currentExercise.sets.length - 1) return true;
    for (let i = activeInfo.setIndex + 1; i < currentExercise.sets.length; i++) {
      if (!currentExercise.sets[i].isWarmup) {
        return false;
      }
    }
    return true;
  }

  checkIfLatestSetOfWorkout(): boolean {
    const activeInfo = this.activeSetInfo();
    const routine = this.routine();
    if (!activeInfo || !routine) return false;
    if (activeInfo.exerciseIndex === routine.exercises.length - 1) {
      return this.checkIfLatestSetOfExercise();
    }
    for (let i = activeInfo.exerciseIndex + 1; i < routine.exercises.length; i++) {
      const futureExercise = routine.exercises[i];
      if (futureExercise.sets.some(s => !s.isWarmup)) {
        return false;
      }
    }
    return this.checkIfLatestSetOfExercise();
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
      setNotes: [''],
      rpe: [null as number | null, [Validators.min(1), Validators.max(10)]]
    });
  }

  private async prepareCurrentSet(): Promise<void> {
    if (this.sessionState() === SessionState.Paused) {
      console.log("PrepareCurrentSet: Session is paused, deferring preparation.");
      return;
    }
    const sessionRoutine = this.routine();
    const exIndex = this.currentExerciseIndex();
    const sIndex = this.currentSetIndex();

    if (!sessionRoutine || !sessionRoutine.exercises[exIndex] || !sessionRoutine.exercises[exIndex].sets[sIndex]) {
      this.currentSetForm.reset({ rpe: null });
      this.rpeValue.set(null);
      this.showRpeSlider.set(false);
      this.resetTimedSet();
      this.currentBaseExercise.set(null);
      this.exercisePBs.set([]);
      this.lastPerformanceForCurrentExercise = null;
      console.warn('prepareCurrentSet: Could not find active set data in session routine.');
      return;
    }

    const currentExerciseData = sessionRoutine.exercises[exIndex];
    const originalPlannedSetForThisSet = currentExerciseData.sets[sIndex];

    this.loadBaseExerciseAndPBs(currentExerciseData.exerciseId);

    if (!this.lastPerformanceForCurrentExercise || this.lastPerformanceForCurrentExercise.sets[0]?.exerciseId !== currentExerciseData.exerciseId) {
      try {
        this.lastPerformanceForCurrentExercise = await new Promise<LastPerformanceSummary | null>((resolve) => {
          this.trackingService.getLastPerformanceForExercise(currentExerciseData.exerciseId)
            .pipe(take(1))
            .subscribe(perf => resolve(perf));
        });
      } catch (error) {
        console.error("Error fetching last performance:", error);
        this.lastPerformanceForCurrentExercise = null;
      }
    }

    const historicalSetPerformance = this.trackingService.findPreviousSetPerformance(
      this.lastPerformanceForCurrentExercise,
      originalPlannedSetForThisSet,
      sIndex
    );

    let finalSetParamsForSession: ExerciseSetParams;

    if (originalPlannedSetForThisSet.isWarmup) {
      finalSetParamsForSession = {
        ...originalPlannedSetForThisSet,
        reps: originalPlannedSetForThisSet.reps ?? 8,
        weight: originalPlannedSetForThisSet.weight ?? null,
        restAfterSet: originalPlannedSetForThisSet.restAfterSet ?? 30,
      };
    } else {
      const suggestedSetParams = this.workoutService.suggestNextSetParameters(
        historicalSetPerformance,
        originalPlannedSetForThisSet,
        sessionRoutine.goal
      );
      finalSetParamsForSession = {
        ...suggestedSetParams,
        id: originalPlannedSetForThisSet.id,
        notes: suggestedSetParams.notes ?? originalPlannedSetForThisSet.notes,
        isWarmup: false,
      };
    }

    const updatedRoutineForSession = JSON.parse(JSON.stringify(sessionRoutine)) as Routine;
    updatedRoutineForSession.exercises[exIndex].sets[sIndex] = finalSetParamsForSession;
    this.routine.set(updatedRoutineForSession);

    this.patchActualsFormBasedOnSessionTargets();
  }

  private patchActualsFormBasedOnSessionTargets(): void {
    if (this.sessionState() === SessionState.Paused) {
      console.log("patchActualsFormBasedOnSessionTargets: Session is paused, deferring preparation.");
      return;
    }
    this.currentSetForm.reset({ rpe: null });
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

    if (completedSetLogThisSession) {
      this.currentSetForm.patchValue({
        actualReps: completedSetLogThisSession.repsAchieved,
        actualWeight: completedSetLogThisSession.weightUsed,
        actualDuration: initialActualDuration,
        setNotes: completedSetLogThisSession.notes,
        rpe: completedSetLogThisSession.rpe
      });
      if (completedSetLogThisSession.rpe) this.rpeValue.set(completedSetLogThisSession.rpe);

    } else {
      this.currentSetForm.patchValue({
        actualReps: activeInfo.setData.reps ?? (activeInfo.isWarmup ? 8 : null),
        actualWeight: activeInfo.setData.weight ?? (activeInfo.isWarmup ? null : null),
        actualDuration: initialActualDuration,
        setNotes: activeInfo.setData.notes || (activeInfo.isWarmup ? 'Warm-up' : ''),
        rpe: null
      });
    }
  }

  private loadBaseExerciseAndPBs(exerciseId: string): void {
    this.currentBaseExercise.set(undefined);
    this.exercisePBs.set([]);
    this.exerciseService.getExerciseById(exerciseId).subscribe(ex => {
      this.currentBaseExercise.set(ex ? { ...ex, iconName: this.exerciseService.determineExerciseIcon(ex, ex?.name) } : null);
    });
    this.trackingService.getAllPersonalBestsForExercise(exerciseId).pipe(take(1)).subscribe(pbs => this.exercisePBs.set(pbs));
  }

  private navigateToNextStepInWorkout(completedActiveInfo: ActiveSetInfo, currentSessionRoutine: Routine): void {
    const currentGlobalExerciseIndex = completedActiveInfo.exerciseIndex;
    const currentGlobalSetIndex = completedActiveInfo.setIndex;
    const currentPlayedExercise = currentSessionRoutine.exercises[currentGlobalExerciseIndex];

    let nextExerciseGlobalIndex = currentGlobalExerciseIndex;
    let nextSetIndexInExercise = 0;
    let exerciseBlockChanged = false;

    if (currentGlobalSetIndex < currentPlayedExercise.sets.length - 1) {
      nextSetIndexInExercise = currentGlobalSetIndex + 1;
    } else {
      if (currentPlayedExercise.supersetId &&
        currentPlayedExercise.supersetOrder !== null &&
        (currentPlayedExercise.supersetSize !== null && currentPlayedExercise.supersetSize !== undefined) &&
        currentPlayedExercise.supersetOrder < currentPlayedExercise.supersetSize - 1) {
        nextExerciseGlobalIndex++;
        if (!(nextExerciseGlobalIndex < currentSessionRoutine.exercises.length &&
          currentSessionRoutine.exercises[nextExerciseGlobalIndex].supersetId === currentPlayedExercise.supersetId)) {
          const foundBlockIdx = this.findNextExerciseBlockStartIndex(currentGlobalExerciseIndex, currentSessionRoutine);
          if (foundBlockIdx !== -1) {
            nextExerciseGlobalIndex = foundBlockIdx;
            exerciseBlockChanged = true;
          } else { this.finishWorkout(); return; }
        }
      } else {
        const currentBlockTotalRounds = this.totalBlockRounds();
        if (this.currentBlockRound() < currentBlockTotalRounds) {
          this.currentBlockRound.update(r => r + 1);
          if (currentPlayedExercise.supersetId && currentPlayedExercise.supersetOrder !== null) {
            nextExerciseGlobalIndex = currentGlobalExerciseIndex - currentPlayedExercise.supersetOrder;
          }
        } else {
          const foundBlockIdx = this.findNextExerciseBlockStartIndex(currentGlobalExerciseIndex, currentSessionRoutine);
          if (foundBlockIdx !== -1) {
            nextExerciseGlobalIndex = foundBlockIdx;
            exerciseBlockChanged = true;
          } else {
            this.finishWorkout();
            return;
          }
        }
      }
    }

    if (exerciseBlockChanged) {
      this.currentBlockRound.set(1);
      const newBlockStarterExercise = currentSessionRoutine.exercises[nextExerciseGlobalIndex];
      if (!newBlockStarterExercise.supersetId || newBlockStarterExercise.supersetOrder === 0) {
        this.totalBlockRounds.set(newBlockStarterExercise.rounds ?? 1);
      } else {
        const actualBlockStart = currentSessionRoutine.exercises.find(ex => ex.supersetId === newBlockStarterExercise.supersetId && ex.supersetOrder === 0);
        this.totalBlockRounds.set(actualBlockStart?.rounds ?? 1);
      }
      this.lastPerformanceForCurrentExercise = null;
    }

    this.currentExerciseIndex.set(nextExerciseGlobalIndex);
    this.currentSetIndex.set(nextSetIndexInExercise);

    if (completedActiveInfo.setData.restAfterSet > 0) {
      this.startRestPeriod(completedActiveInfo.setData.restAfterSet);
    }

    this.prepareCurrentSet();
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

  completeSetAndProceed(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Please resume to continue.", 3000, "Paused");
      return;
    }
    const activeInfo = this.activeSetInfo();
    const currentRoutineValue = this.routine();
    if (!activeInfo || !currentRoutineValue) {
      console.error("Cannot complete set: activeInfo or routine is not available.");
      this.toastService.error("Cannot complete set: data missing.", 0, "Error");
      return;
    }

    if (activeInfo.setData.duration && activeInfo.setData.duration > 0 &&
      (this.timedSetTimerState() === TimedSetState.Running || this.timedSetTimerState() === TimedSetState.Paused)) {
      this.stopAndLogTimedSet();
    }

    if (this.currentSetForm.invalid) {
      this.currentSetForm.markAllAsTouched();
      let firstInvalidControl = '';
      for (const key of Object.keys(this.currentSetForm.controls)) {
        if (this.currentSetForm.controls[key].invalid) {
          firstInvalidControl = key;
          break;
        }
      }
      this.toastService.error(`Please correct input: ${firstInvalidControl ? firstInvalidControl + ' is invalid.' : 'form invalid.'}`, 0, 'Validation Error');
      return;
    }

    const formValues = this.currentSetForm.value;

    let durationToLog = formValues.actualDuration;
    if (activeInfo.setData.duration && activeInfo.setData.duration > 0 && this.timedSetElapsedSeconds() > 0) {
      durationToLog = this.timedSetElapsedSeconds();
    } else if (formValues.actualDuration === null && activeInfo.setData.duration) {
      durationToLog = activeInfo.setData.duration;
    }

    const loggedSetData: LoggedSet = {
      id: activeInfo.setData.id,
      plannedSetId: activeInfo.setData.id,
      exerciseId: activeInfo.exerciseData.exerciseId,
      isWarmup: !!activeInfo.setData.isWarmup,
      repsAchieved: formValues.actualReps ?? (activeInfo.setData.isWarmup ? 0 : activeInfo.setData.reps ?? 0),
      weightUsed: formValues.actualWeight ?? (activeInfo.setData.isWarmup ? null : activeInfo.setData.weight),
      durationPerformed: durationToLog,
      rpe: formValues.rpe ?? undefined,
      targetReps: activeInfo.setData.reps,
      targetWeight: activeInfo.setData.weight,
      targetDuration: activeInfo.setData.duration,
      targetTempo: activeInfo.setData.tempo,
      notes: formValues.setNotes || undefined,
      timestamp: new Date().toISOString(),
    };
    this.addLoggedSetToCurrentLog(activeInfo.exerciseData, loggedSetData);

    if (this.sessionState() === SessionState.Playing) {
      this.captureAndSaveStateForUnload();
    }

    this.rpeValue.set(null);
    this.showRpeSlider.set(false);

    this.navigateToNextStepInWorkout(activeInfo, currentRoutineValue);
  }

  private findNextExerciseBlockStartIndex(currentExerciseGlobalIndex: number, routine: Routine): number {
    for (let i = currentExerciseGlobalIndex + 1; i < routine.exercises.length; i++) {
      const nextEx = routine.exercises[i];
      if (!nextEx.supersetId || nextEx.supersetOrder === 0) {
        return i;
      }
    }
    return -1;
  }

  getNextUpText(completedActiveSetInfo: ActiveSetInfo | null, currentSessionRoutine: Routine | null): string {
    if (!completedActiveSetInfo || !currentSessionRoutine) return 'Next Set/Exercise';

    const curExGlobalIdx = completedActiveSetInfo.exerciseIndex;
    const curSetData = completedActiveSetInfo.setData;
    const curPlayedEx = currentSessionRoutine.exercises[curExGlobalIdx];
    const allSetsForCurrentExercise = curPlayedEx.sets;
    const indexOfCompletedSetInExercise = allSetsForCurrentExercise.findIndex(s => s.id === curSetData.id);

    if (curSetData.isWarmup) {
      if (indexOfCompletedSetInExercise < allSetsForCurrentExercise.length - 1) {
        const nextSetCandidate = allSetsForCurrentExercise[indexOfCompletedSetInExercise + 1];
        if (nextSetCandidate.isWarmup) {
          let nextWarmupSetNumber = 0;
          for (let i = 0; i <= indexOfCompletedSetInExercise + 1; i++) {
            if (allSetsForCurrentExercise[i].isWarmup) nextWarmupSetNumber++;
          }
          return `Warm-up Set ${nextWarmupSetNumber} of ${curPlayedEx.exerciseName}`;
        } else {
          let firstWorkingSetNumber = 0;
          for (let i = 0; i <= indexOfCompletedSetInExercise + 1; i++) {
            if (!allSetsForCurrentExercise[i].isWarmup) firstWorkingSetNumber++;
          }
          return `Set ${firstWorkingSetNumber} of ${curPlayedEx.exerciseName}`;
        }
      }
    }

    if (indexOfCompletedSetInExercise < allSetsForCurrentExercise.length - 1) {
      const nextSetInExercise = allSetsForCurrentExercise[indexOfCompletedSetInExercise + 1];
      const setType = nextSetInExercise.isWarmup ? "Warm-up" : "Set";
      let typeCounter = 0;
      for (let i = 0; i <= indexOfCompletedSetInExercise + 1; i++) {
        if (!!allSetsForCurrentExercise[i].isWarmup === !!nextSetInExercise.isWarmup) typeCounter++;
      }
      return `${setType} ${typeCounter} of ${curPlayedEx.exerciseName}`;
    }

    if (curPlayedEx.supersetId && curPlayedEx.supersetOrder !== null && curPlayedEx.supersetSize &&
      curPlayedEx.supersetOrder < curPlayedEx.supersetSize - 1) {
      const nextSupersetExIndex = curExGlobalIdx + 1;
      if (nextSupersetExIndex < currentSessionRoutine.exercises.length &&
        currentSessionRoutine.exercises[nextSupersetExIndex].supersetId === curPlayedEx.supersetId) {
        const firstSetOfNextSupersetEx = currentSessionRoutine.exercises[nextSupersetExIndex].sets[0];
        const setType = firstSetOfNextSupersetEx.isWarmup ? "Warm-up Set 1" : "Set 1";
        return `SUPERSET: ${setType} of ${currentSessionRoutine.exercises[nextSupersetExIndex].exerciseName}`;
      }
    }

    const currentBlockTotalRounds = this.totalBlockRounds();
    if (this.currentBlockRound() < currentBlockTotalRounds) {
      let blockStartIndex = curExGlobalIdx;
      if (curPlayedEx.supersetId && curPlayedEx.supersetOrder !== null) {
        blockStartIndex = curExGlobalIdx - curPlayedEx.supersetOrder;
      }
      const nextRoundFirstExercise = currentSessionRoutine.exercises[blockStartIndex];
      const nextRoundFirstSet = nextRoundFirstExercise.sets[0];
      const nextRoundSetType = nextRoundFirstSet.isWarmup ? "Warm-up Set 1" : "Set 1";
      return `Round ${this.currentBlockRound() + 1}: ${nextRoundSetType} of ${nextRoundFirstExercise.exerciseName}`;
    }

    const nextBlockStartIndex = this.findNextExerciseBlockStartIndex(curExGlobalIdx, currentSessionRoutine);
    if (nextBlockStartIndex !== -1) {
      const nextBlockFirstExercise = currentSessionRoutine.exercises[nextBlockStartIndex];
      const nextBlockFirstSet = nextBlockFirstExercise.sets[0];
      const nextBlockSetType = nextBlockFirstSet.isWarmup ? "Warm-up Set 1" : "Set 1";
      return `${nextBlockSetType} of ${nextBlockFirstExercise.exerciseName}`;
    }
    return 'Finish Workout!';
  }

  getDisabled(): boolean {
    return this.timedSetTimerState() === TimedSetState.Running || this.sessionState() === SessionState.Paused;
  }

  private startRestPeriod(duration: number, isResumingPausedRest: boolean = false): void {
    if (this.sessionState() === SessionState.Paused && !isResumingPausedRest) {
      this.wasRestTimerVisibleOnPause = true;
      this.restTimerRemainingSecondsOnPause = duration;
      this.restTimerInitialDurationOnPause = duration;
      this.restTimerMainTextOnPause = (this.activeSetInfo()?.setData?.restAfterSet === 0 && this.activeSetInfo()?.exerciseData?.supersetId) ? 'SUPERSET TRANSITION' : 'RESTING';
      const nextActiveSetInfo = this.activeSetInfo();
      if (this.routine() && nextActiveSetInfo) {
        this.restTimerNextUpTextOnPause = this.activeSetInfo()?.exerciseData.exerciseName || 'Next Exercise';
      }
      return;
    }

    if (duration > 0) {
      const currentRoutineValue = this.routine();
      this.restDuration.set(duration);

      if (!isResumingPausedRest) {
        this.restTimerMainText.set(
          this.activeSetInfo()?.setData?.restAfterSet === 0 && this.activeSetInfo()?.exerciseData?.supersetId ?
            'SUPERSET TRANSITION' : 'RESTING'
        );
        this.restTimerNextUpText.set(this.activeSetInfo()?.exerciseData.exerciseName || 'Next Exercise');

      } else {
        this.restTimerMainText.set(this.restTimerMainTextOnPause);
        this.restTimerNextUpText.set(this.restTimerNextUpTextOnPause);
      }
      this.isRestTimerVisible.set(true);
      this.updateRestTimerDisplay(duration);
    } else {
      this.isRestTimerVisible.set(false);
    }
  }

  handleRestTimerFinished(): void {
    this.isRestTimerVisible.set(false);
  }

  handleRestTimerSkipped(): void {
    this.isRestTimerVisible.set(false);
    this.toastService.info("Rest skipped.", 2000);
  }

  skipRest(): void {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Resume to skip rest.", 3000, "Paused");
      return;
    }
    if (this.isRestTimerVisible()) {
      this.handleRestTimerSkipped();
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
      this.restTimerRemainingSecondsOnPause = this.restDuration()
      this.restTimerInitialDurationOnPause = this.restDuration();
      this.restTimerMainTextOnPause = this.restTimerMainText();
      this.restTimerNextUpTextOnPause = this.restTimerNextUpText();
      this.isRestTimerVisible.set(false);
    }
    this.sessionState.set(SessionState.Paused);
    this.savePausedSessionState();
    this.toastService.info("Workout Paused", 3000);
  }

  resumeSession(): void {
    if (this.sessionState() !== SessionState.Paused) return;

    this.workoutStartTime = Date.now();
    this.sessionState.set(SessionState.Playing);
    this.startSessionTimer();

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
    this.toastService.info('Workout session resumed.', 3000);
  }

  private async checkForPausedSession(): Promise<boolean> {
    const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);
    if (pausedState && pausedState.version === this.PAUSED_STATE_VERSION) {
      const routineName = pausedState.sessionRoutine?.name || 'a previous session';
      const customBtns: AlertButton[] = [
        { text: 'Discard', role: 'cancel', data: false, cssClass: 'bg-gray-300 hover:bg-gray-500' } as AlertButton,
        { text: 'Resume', role: 'confirm', data: true, cssClass: 'bg-green-500 hover:bg-green-600 text-white' } as AlertButton
      ];
      const confirmation = await this.alertService.showConfirmationDialog('Resume Workout?', `You have a paused workout session for "${routineName}". Would you like to resume it?`, customBtns);
      if (confirmation && confirmation.data === true) {
        await this.loadStateFromPausedSession(pausedState); // Make sure this is awaited
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        return true;
      } else {
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        this.toastService.info('Paused session discarded.', 3000);
        return false;
      }
    }
    return false;
  }

  private async loadNewWorkoutFromRoute(): Promise<void> {
    this.sessionState.set(SessionState.Loading);
    this.workoutStartTime = Date.now();
    this.sessionTimerElapsedSecondsBeforePause = 0;
    this.originalRoutineSnapshot = [];

    this.routeSub = this.route.paramMap.pipe(
      switchMap(params => {
        this.routineId = params.get('routineId');
        if (this.routineId) {
          return this.workoutService.getRoutineById(this.routineId).pipe(
            map(originalRoutine => {
              if (originalRoutine) {
                this.originalRoutineSnapshot = JSON.parse(JSON.stringify(originalRoutine.exercises));
                return JSON.parse(JSON.stringify(originalRoutine)) as Routine;
              }
              return null;
            })
          );
        }
        return of(null);
      }),
      tap(async sessionRoutineCopy => {
        if (sessionRoutineCopy) {
          this.routine.set(sessionRoutineCopy);
          if (sessionRoutineCopy.exercises.length > 0) {
            const firstEx = sessionRoutineCopy.exercises[0];
            if (!firstEx.supersetId || firstEx.supersetOrder === 0) this.totalBlockRounds.set(firstEx.rounds ?? 1);
            else {
              const actualStart = sessionRoutineCopy.exercises.find(ex => ex.supersetId === firstEx.supersetId && ex.supersetOrder === 0);
              this.totalBlockRounds.set(actualStart?.rounds ?? 1);
            }
          } else this.totalBlockRounds.set(1);
        } else if (this.routineId) {
          this.routine.set(null);
          this.sessionState.set(SessionState.Error);
          this.toastService.error("Failed to load workout routine.", 0, "Load Error");
          this.router.navigate(['/workout']);
          return;
        }
        this.currentBlockRound.set(1);
        this.currentExerciseIndex.set(0);
        this.currentSetIndex.set(0);
        this.currentWorkoutLogExercises.set([]);

        await this.prepareCurrentSet();
        this.sessionState.set(SessionState.Playing);
        this.startSessionTimer();
      })
    ).subscribe();
  }

  private async loadStateFromPausedSession(state: PausedWorkoutState): Promise<void> {
    this.routineId = state.routineId;
    this.routine.set(state.sessionRoutine);
    this.originalRoutineSnapshot = state.originalRoutineSnapshot ? JSON.parse(JSON.stringify(state.originalRoutineSnapshot)) : [];

    this.currentExerciseIndex.set(state.currentExerciseIndex);
    this.currentSetIndex.set(state.currentSetIndex);
    this.currentWorkoutLogExercises.set(state.currentWorkoutLogExercises);

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

    await this.prepareCurrentSet();
    this.sessionState.set(SessionState.Playing);
    this.startSessionTimer();

    if (state.timedSetTimerState === TimedSetState.Running) {
      this.startOrResumeTimedSet();
    }

    if (this.wasRestTimerVisibleOnPause && this.restTimerRemainingSecondsOnPause > 0) {
      this.startRestPeriod(this.restTimerRemainingSecondsOnPause, true);
    }
    this.cdr.detectChanges();
    this.toastService.success('Workout session resumed.', 3000, "Resumed");
  }

  private savePausedSessionState(): void {
    const currentRoutine = this.routine(); // Get current signal value
    if (!currentRoutine) { // Check if routine is null or undefined
      console.warn("Cannot save paused state: routine data is not available.");
      return;
    }

    let currentTotalSessionElapsed = this.sessionTimerElapsedSecondsBeforePause;
    if (this.sessionState() === SessionState.Playing && this.workoutStartTime > 0) {
      currentTotalSessionElapsed += Math.floor((Date.now() - this.workoutStartTime) / 1000);
    }

    const stateToSave: PausedWorkoutState = {
      version: this.PAUSED_STATE_VERSION,
      routineId: this.routineId,
      sessionRoutine: JSON.parse(JSON.stringify(currentRoutine)), // Use the resolved value
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
      isResting: this.isRestTimerVisible(),
      isRestTimerVisibleOnPause: this.wasRestTimerVisibleOnPause,
      restTimerRemainingSecondsOnPause: this.restTimerRemainingSecondsOnPause,
      restTimerInitialDurationOnPause: this.restTimerInitialDurationOnPause,
      restTimerMainTextOnPause: this.restTimerMainTextOnPause,
      restTimerNextUpTextOnPause: this.restTimerNextUpTextOnPause,
      lastPerformanceForCurrentExercise: this.lastPerformanceForCurrentExercise ? JSON.parse(JSON.stringify(this.lastPerformanceForCurrentExercise)) : null,
    };
    this.storageService.setItem(this.PAUSED_WORKOUT_KEY, stateToSave);
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
    console.log('Session state attempt saved via beforeunload.');
  }

  async addWarmupSet(): Promise<void> {
    if (this.sessionState() === SessionState.Paused) {
      this.toastService.warning("Session is paused. Resume to add warm-up.", 3000, "Paused"); return;
    }
    const currentRoutineVal = this.routine(); const activeInfo = this.activeSetInfo();
    if (!currentRoutineVal || !activeInfo) {
      this.toastService.error("Cannot add warm-up: data unavailable.", 0, "Error"); return;
    }
    const currentExercise = currentRoutineVal.exercises[activeInfo.exerciseIndex];
    const firstWorkingSetIndex = currentExercise.sets.findIndex(s => !s.isWarmup);
    if (activeInfo.setIndex > 0 && activeInfo.setIndex > firstWorkingSetIndex && firstWorkingSetIndex !== -1) {
      const confirm = await this.alertService.showConfirm("Add Warm-up Set", "You are past the first working set. Adding a warm-up set now will insert it before the current set. Continue?");
      if (!confirm || !confirm.data) return;
    }
    const newWarmupSet: ExerciseSetParams = {
      id: `warmup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, isWarmup: true, reps: 8, weight: 0,
      duration: undefined, restAfterSet: 30, notes: 'Warm-up set'
    };
    const updatedRoutineForSession = JSON.parse(JSON.stringify(currentRoutineVal)) as Routine;
    const exerciseToUpdate = updatedRoutineForSession.exercises[activeInfo.exerciseIndex];
    exerciseToUpdate.sets.splice(activeInfo.setIndex, 0, newWarmupSet);
    this.routine.set(updatedRoutineForSession);
    this.toastService.success("Warm-up set added. Fill details & complete.", 4000, "Warm-up Added");
    await this.prepareCurrentSet();
    this.closeWorkoutMenu(); this.closePerformanceInsights();
  }

  ngOnDestroy(): void {
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.timerSub) this.timerSub.unsubscribe();
    if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
    this.isRestTimerVisible.set(false);
  }

  getSets(): ExerciseSetParams[] {
    const activeSet = this.activeSetInfo();
    const sets = activeSet?.exerciseData.sets || [];
    return activeSet?.setData.isWarmup ? sets.filter(exer => !exer.isWarmup) : sets;
  }

  getWarmUpSets(): ExerciseSetParams[] {
    const activeSet = this.activeSetInfo();
    const sets = activeSet?.exerciseData.sets || [];
    return activeSet?.setData.isWarmup ? sets.filter(exer => exer.isWarmup) : [];
  }

  getTotalWarmupSetsForCurrentExercise = computed<number>(() => {
    const r = this.routine(); const exIndex = this.currentExerciseIndex();
    return (r && r.exercises[exIndex]) ? r.exercises[exIndex].sets.filter(s => s.isWarmup).length : 0;
  });

  canAddWarmupSet = computed<boolean>(() => {
    const activeInfo = this.activeSetInfo(); const routineVal = this.routine();
    if (!activeInfo || !routineVal || this.sessionState() === 'paused') return false;
    const currentExerciseSets = routineVal.exercises[activeInfo.exerciseIndex].sets;
    for (let i = 0; i <= activeInfo.setIndex; i++) {
      if (!currentExerciseSets[i].isWarmup && this.getTotalWarmupSetsForCurrentExercise() > 0) return false;
    }
    return true;
  });

  getIconPath(iconName: string | undefined): string {
    return this.exerciseService.getIconPath(iconName);
  }

  toggleWorkoutMenu(): void {
    if (this.sessionState() === 'paused' && !this.isWorkoutMenuVisible()) {
      return;
    }
    if (this.sessionState() === 'paused' && this.isWorkoutMenuVisible()) {
      return;
    }
    this.isWorkoutMenuVisible.update(v => !v);
    if (this.isWorkoutMenuVisible()) {
      this.isPerformanceInsightsVisible.set(false);
    }
  }

  closeWorkoutMenu(): void { this.isWorkoutMenuVisible.set(false); }

  async skipCurrentSet(): Promise<void> {
    if (this.sessionState() === 'paused') { this.toastService.warning("Session is paused. Resume to skip set.", 3000, "Paused"); return; }
    const activeInfo = this.activeSetInfo(); const currentRoutineVal = this.routine();
    if (!activeInfo || !currentRoutineVal) { this.toastService.error("Cannot skip set: No active set information.", 0, "Error"); return; }
    const confirm = await this.alertService.showConfirm("Skip Current Set", `Skip current ${activeInfo.isWarmup ? 'warm-up' : 'set ' + this.getCurrentWorkingSetNumber()} of "${activeInfo.exerciseData.exerciseName}"? It won't be logged.`);
    if (!confirm || !confirm.data) return;
    this.toastService.info(`Skipped set of ${activeInfo.exerciseData.exerciseName}.`, 2000);
    this.resetTimedSet();
    this.navigateToNextStepInWorkout(activeInfo, currentRoutineVal);
    this.closeWorkoutMenu(); this.closePerformanceInsights();
  }

  async skipCurrentExercise(): Promise<void> {
    if (this.sessionState() === 'paused') { this.toastService.warning("Session is paused. Resume to skip exercise.", 3000, "Paused"); return; }
    const activeInfo = this.activeSetInfo(); const currentRoutineVal = this.routine();
    if (!activeInfo || !currentRoutineVal) { this.toastService.error("Cannot skip exercise: No active exercise information.", 0, "Error"); return; }
    const confirm = await this.alertService.showConfirm("Skip Current Exercise", `Skip all remaining sets of "${activeInfo.exerciseData.exerciseName}" for this round?`);
    if (!confirm || !confirm.data) return;
    this.toastService.info(`Skipped exercise ${activeInfo.exerciseData.exerciseName}.`, 3000);
    const currentGlobalExerciseIndex = activeInfo.exerciseIndex;
    let nextBlockGlobalStartIndex = this.findNextExerciseBlockStartIndex(currentGlobalExerciseIndex, currentRoutineVal);
    if (nextBlockGlobalStartIndex !== -1) {
      this.currentExerciseIndex.set(nextBlockGlobalStartIndex); this.currentSetIndex.set(0);
      this.currentBlockRound.set(1);
      const newBlockStarterExercise = currentRoutineVal.exercises[nextBlockGlobalStartIndex];
      if (!newBlockStarterExercise.supersetId || newBlockStarterExercise.supersetOrder === 0) this.totalBlockRounds.set(newBlockStarterExercise.rounds ?? 1);
      else {
        const actualBlockStart = currentRoutineVal.exercises.find(ex => ex.supersetId === newBlockStarterExercise.supersetId && ex.supersetOrder === 0);
        this.totalBlockRounds.set(actualBlockStart?.rounds ?? 1);
      }
      this.lastPerformanceForCurrentExercise = null; this.prepareCurrentSet();
    } else this.finishWorkout();
    this.closeWorkoutMenu(); this.closePerformanceInsights();
  }

  async finishWorkoutEarly(): Promise<void> {
    if (this.sessionState() === 'paused') { this.toastService.warning("Please resume before finishing early.", 3000, "Paused"); return; }
    const confirmFinish = await this.alertService.showConfirm("Finish Workout Early", "Finish workout now? Progress will be saved.");
    if (confirmFinish && confirmFinish.data) { this.closeWorkoutMenu(); this.closePerformanceInsights(); this.finishWorkout(); }
  }

  async quitWorkout(): Promise<void> {
    const confirmQuit = await this.alertService.showConfirm("Quit Workout", 'Quit workout? Unsaved progress (if not paused) will be lost.');
    if (confirmQuit && confirmQuit.data) {
      this.sessionState.set(SessionState.Playing);
      if (this.timerSub) this.timerSub.unsubscribe();
      if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
      this.isRestTimerVisible.set(false);
      this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
      this.closeWorkoutMenu(); this.closePerformanceInsights();
      this.router.navigate(['/workout']);
      this.toastService.info("Workout quit. No progress saved for this session unless paused.", 4000);
    }
  }

  toggleCompletedSetsInfo(): void { this.showCompletedSetsInfo.update(v => !v); }

  openPerformanceInsights(): void {
    if (this.sessionState() === 'paused') { this.toastService.warning("Session is paused. Resume to view insights.", 3000, "Paused"); return; }
    this.isPerformanceInsightsVisible.set(true);
    this.isWorkoutMenuVisible.set(false);
  }

  closePerformanceInsights(): void {
    this.isPerformanceInsightsVisible.set(false);
    if (this.editingTarget) this.cancelEditTarget();
  }

  openPerformanceInsightsFromMenu(): void {
    this.closeWorkoutMenu();
    this.openPerformanceInsights();
  }

  goBack(): void {
    if (this.currentWorkoutLogExercises().length > 0 && this.sessionState() === SessionState.Playing) {
      this.alertService.showConfirm("Exit Workout?", "You have an active workout. Are you sure you want to exit? Your progress might be lost unless you pause first.")
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
    const step = defaultStep;
    const currentValue = this.csf['actualWeight'].value ?? 0;
    this.currentSetForm.patchValue({ actualWeight: parseFloat((currentValue + step).toFixed(2)) });
  }

  decrementWeight(defaultStep: number = 0.5): void {
    const step = defaultStep;
    const currentValue = this.csf['actualWeight'].value ?? 0;
    this.currentSetForm.patchValue({ actualWeight: Math.max(0, parseFloat((currentValue - step).toFixed(2))) });
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
}