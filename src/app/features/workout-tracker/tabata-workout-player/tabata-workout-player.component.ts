import { Component, inject, OnInit, OnDestroy, signal, computed, ChangeDetectorRef, PLATFORM_ID, ViewChildren, QueryList, ElementRef, effect } from '@angular/core';
import { CommonModule, isPlatformBrowser, DecimalPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, of, timer, firstValueFrom, Subject, combineLatest, interval } from 'rxjs';
import { switchMap, tap, map, take, takeUntil } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { ExerciseSetParams, Routine, WorkoutExercise } from '../../../core/models/workout.model';
import { LastPerformanceSummary, LoggedSet, LoggedWorkoutExercise, PersonalBestSet, WorkoutLog } from '../../../core/models/workout-log.model';
import { PressDirective } from '../../../shared/directives/press.directive';
import { WorkoutService } from '../../../core/services/workout.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { ToastService } from '../../../core/services/toast.service';
import { StorageService } from '../../../core/services/storage.service';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { PausedWorkoutState, PlayerSubState, SessionState, TimedSetState } from '../workout-player';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Exercise } from '../../../core/models/exercise.model';
import { AlertService } from '../../../core/services/alert.service';
import { AlertButton } from '../../../core/models/alert.model';
import { AppSettingsService } from '../../../core/services/app-settings.service';


// Interface to manage the state of the currently active set/exercise
interface ActiveSetInfo {
    exerciseIndex: number;
    setIndex: number;
    exerciseData: WorkoutExercise;
    setData: ExerciseSetParams;
    type: 'standard' | 'warmup' | 'amrap' | 'custom';
}

export interface HIITInterval {
    type: 'prepare' | 'work' | 'rest';
    duration: number;
    exerciseName?: string;
    totalIntervals: number;
    currentIntervalNumber: number;
}

@Component({
    selector: 'app-tabata-player',
    standalone: true,
    imports: [CommonModule, DatePipe, DecimalPipe, PressDirective],
    templateUrl: './tabata-workout-player.component.html',
    styleUrl: './tabata-workout-player.component.scss',
})
export class TabataPlayerComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private workoutService = inject(WorkoutService);
    protected trackingService = inject(TrackingService);
    protected toastService = inject(ToastService);
    private storageService = inject(StorageService);
    private trainingProgramService = inject(TrainingProgramService);
    private exerciseService = inject(ExerciseService);
    protected alertService = inject(AlertService);
    private cdr = inject(ChangeDetectorRef);
    private fb = inject(FormBuilder);

    protected appSettingsService = inject(AppSettingsService);
    private platformId = inject(PLATFORM_ID);

    protected routine = signal<Routine | null | undefined>(undefined);
    sessionState = signal<SessionState>(SessionState.Loading);
    sessionTimerDisplay = signal('00:00');
    timedSetTimerState = signal<TimedSetState>(TimedSetState.Idle);
    private soundPlayedForThisCountdownSegment = false;
    timedSetElapsedSeconds = signal(0);
    currentBaseExercise = signal<Exercise | null | undefined>(undefined);
    exercisePBs = signal<PersonalBestSet[]>([]);

    private workoutStartTime: number = 0;
    private sessionTimerElapsedSecondsBeforePause = 0;
    private timerSub: Subscription | undefined;
    private timedSetIntervalSub: Subscription | undefined;
    private autoSaveSub: Subscription | undefined;
    private readonly AUTO_SAVE_INTERVAL_MS = 4000;

    program = signal<string | undefined>(undefined);
    scheduledDay = signal<string | undefined>(undefined);
    public readonly PlayerSubState = PlayerSubState;
    playerSubState = signal<PlayerSubState>(PlayerSubState.PerformingSet);

    currentSetForm!: FormGroup;

    lastPerformanceForCurrentExercise: LastPerformanceSummary | null = null;
    private exercisesProposedThisCycle = { doLater: false, skipped: false };

    routineId: string | null = null;
    protected currentWorkoutLogExercises = signal<LoggedWorkoutExercise[]>([]);

    private restTimerInitialDurationOnPause = 0;
    private isInitialLoadComplete = false;
    private readonly PAUSED_WORKOUT_KEY = 'fitTrackPro_pausedWorkoutState';
    private readonly PAUSED_STATE_VERSION = '1.2';

    @ViewChildren('intervalListItem') intervalListItems!: QueryList<ElementRef<HTMLLIElement>>;
    isRestTimerVisible = signal(false);
    restDuration = signal(0);
    restTimerDisplay = signal<string | null>(null);
    restTimerMainText = signal('RESTING');
    restTimerNextUpText = signal<string | null>(null);

    tabataIntervals = signal<HIITInterval[]>([]);
    currentTabataIntervalIndex = signal(0);
    tabataTimeRemaining = signal(0);

    currentExerciseIndex = signal(0);
    currentSetIndex = signal(0);
    currentBlockRound = signal(1);
    totalBlockRounds = signal(1);

    private isPerformingDeferredExercise = false;
    private lastActivatedDeferredExerciseId: string | null = null;

    private readonly destroy$ = new Subject<void>();
    private routeSub: Subscription | undefined;
    rpeValue = signal<number | null>(null);
    rpeOptions: number[] = Array.from({ length: 10 }, (_, i) => i + 1);
    showRpeSlider = signal(false);

    currentTabataInterval = computed<HIITInterval | null>(() => {
        const intervals = this.tabataIntervals();
        const index = this.currentTabataIntervalIndex();
        return intervals[index] || null;
    });

    private tabataIntervalMap: [number, number, number][] = [];
    private tabataTimerSub: Subscription | undefined;
    private isSessionConcluded = false;


    private initializeCurrentSetForm(): void {
        this.currentSetForm = this.fb.group({
            actualReps: [null as number | null, [Validators.min(0)]],
            actualWeight: [null as number | null, [Validators.min(0)]],
            actualDuration: [null as number | null, [Validators.min(0)]],
            setNotes: [''], // Added for individual set notes
            rpe: [null as number | null, [Validators.min(1), Validators.max(10)]]
        });
    }

    constructor() {

        this.initializeCurrentSetForm();
        effect(() => {
            const index = this.currentTabataIntervalIndex();
            if (this.intervalListItems && this.intervalListItems.length > index) {
                const activeItemElement = this.intervalListItems.toArray()[index].nativeElement;
                activeItemElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                });
            }
        });
    }

    async ngOnInit(): Promise<void> {
        const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);

        const hasPausedSessionOnInit = await this.checkForPausedSession(false);
        if (hasPausedSessionOnInit) {
            this.isInitialLoadComplete = true;
        } else {
            this.loadNewWorkoutFromRoute();
        }
    }

    private async checkForPausedSession(isReEntry: boolean = false): Promise<boolean> {
        const pausedState = this.storageService.getItem<PausedWorkoutState>(this.PAUSED_WORKOUT_KEY);
        const routeRoutineId = this.route.snapshot.paramMap.get('routineId');
        const resumeQueryParam = this.route.snapshot.queryParamMap.get('resume') === 'true';

        console.log('WorkoutPlayer.checkForPausedSession ...', !!pausedState);

        if (pausedState && pausedState.version === this.PAUSED_STATE_VERSION) {
            // --- Sanity Checks for Relevancy ---
            // 1. If current route has a routineId, but paused session is ad-hoc (null routineId) -> discard paused
            if (routeRoutineId && pausedState.routineId === null) {
                console.log('WorkoutPlayer.checkForPausedSession - Current route is for a specific routine, but paused session was ad-hoc. Discarding paused session');
                this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
                return false;
            }
            // 2. If current route is ad-hoc (null routineId), but paused session was for a specific routine -> discard paused
            if (!routeRoutineId && pausedState.routineId !== null) {
                console.log('WorkoutPlayer.checkForPausedSession - Current route is ad-hoc, but paused session was for a specific routine. Discarding paused session');
                this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
                return false;
            }
            // 3. If both have routineIds, but they don't match -> discard paused
            if (routeRoutineId && pausedState.routineId && routeRoutineId !== pausedState.routineId) {
                console.log('WorkoutPlayer.checkForPausedSession - Paused session routine ID does not match current route routine ID. Discarding paused session');
                this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
                return false;
            }
            // At this point, either both routineIds are null (ad-hoc match), or both are non-null and identical.

            let shouldAttemptToLoadPausedState = false;
            if (resumeQueryParam) {
                shouldAttemptToLoadPausedState = true;
                this.router.navigate([], { relativeTo: this.route, queryParams: { resume: null }, queryParamsHandling: 'merge', replaceUrl: true });
            } else if (isReEntry) {
                shouldAttemptToLoadPausedState = true;
            } else {
                const confirmation = await this.alertService.showConfirmationDialog(
                    "Resume Paused Workout?",
                    "You have a paused workout session. Would you like to resume it?",
                    [
                        { text: "Resume", role: "confirm", data: true, cssClass: "bg-green-600", icon: 'play', iconClass: 'h-8 w-8 mr-1' } as AlertButton,
                        { text: "Discard", role: "cancel", data: false, cssClass: "bg-red-600", icon: 'trash', iconClass: 'h-8 w-8 mr-1' } as AlertButton
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
                this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
                this.toastService.info('Paused session discarded', 3000);
                return false;
            }
        }
        return false;
    }

    /**
* Checks if every exercise in a routine has all its required sets/rounds logged.
* @param routine The planned session routine.
* @param loggedExercises The array of currently logged exercises for the session.
* @returns `true` if the entire workout is fully logged, otherwise `false`.
*/
    private isEntireWorkoutFullyLogged(routine: Routine, loggedExercises: LoggedWorkoutExercise[]): boolean {
        // Quick check: If the number of exercise entries doesn't match, it can't be complete.
        if (routine.exercises.length !== loggedExercises.length) {
            return false;
        }

        // Use .every() for a clean, fail-fast check. It will stop as soon as it finds an incomplete exercise.
        return routine.exercises.every(plannedExercise => {
            const loggedExercise = loggedExercises.find(log => log.id === plannedExercise.id);

            // If a planned exercise has no corresponding log entry, the workout is not complete.
            if (!loggedExercise) {
                return false;
            }

            // Calculate the total number of sets that *should* have been completed for this exercise, including all rounds.
            const totalPlannedCompletions = (plannedExercise.sets?.length ?? 0) * (plannedExercise.rounds ?? 1);

            // The workout is only complete if the number of logged sets is equal to or greater than the plan.
            return loggedExercise.sets.length >= totalPlannedCompletions;
        });
    }


    private async loadStateFromPausedSession(state: PausedWorkoutState): Promise<void> {
        this.routineId = state.routineId;
        this.routine.set(state.sessionRoutine); // This routine has sessionStatus populated
        this.currentWorkoutLogExercises.set(state.currentWorkoutLogExercises);

        // --- NEW: Check if the resumed session is already fully logged ---
        if (this.isEntireWorkoutFullyLogged(state.sessionRoutine, state.currentWorkoutLogExercises)) {
            console.log("Paused session is already fully logged. Transitioning directly to finish flow");
            this.sessionState.set(SessionState.End); // Set state to prevent other actions
            await this.tryProceedToDeferredExercisesOrFinish(state.sessionRoutine);
            return; // Stop further execution of this method
        }
        // --- END NEW CHECK ---

        // --- NEW: TABATA RESUME LOGIC ---
        console.log("Resuming a paused Tabata session");

        this.sessionState.set(SessionState.Playing);
        this.workoutStartTime = Date.now();
        this.sessionTimerElapsedSecondsBeforePause = state.sessionTimerElapsedSecondsBeforePause;

        // Setup the tabata player from the saved state.
        this.setupTabataMode(
            state.sessionRoutine,
            state.tabataCurrentIntervalIndex,
            state.tabataTimeRemainingOnPause
        );

        this.startSessionTimer();
        this.toastService.success('Tabata session resumed', 3000, "Resumed");
        // We are done for Tabata mode, so we return early.
        return;
    }

    private startSessionTimer(): void {
        if (this.sessionState() === SessionState.Paused) return;
        if (this.timerSub) this.timerSub.unsubscribe();

        this.timerSub = timer(0, 1000).pipe(
            takeUntil(this.destroy$) // Add this line
        ).subscribe(() => {
            if (this.sessionState() === SessionState.Playing) {
                const currentDeltaSeconds = Math.floor((Date.now() - this.workoutStartTime) / 1000);
                const totalElapsedSeconds = this.sessionTimerElapsedSecondsBeforePause + currentDeltaSeconds;
                const hours = Math.floor(totalElapsedSeconds / 3600);
                const minutes = Math.floor((totalElapsedSeconds % 3600) / 60);
                const seconds = totalElapsedSeconds % 60;
                // Show "MM:SS" if under 1 hour, otherwise "H:MM:SS" (no leading zero for hours)
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

    private startOrResumeTimedSet(): void {
        if (this.timedSetTimerState() === TimedSetState.Idle) {
            this.timedSetElapsedSeconds.set(0);
            const targetDuration = this.activeSetInfo()?.setData?.duration;
            if (targetDuration !== undefined && targetDuration > 0) {
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
                const targetDuration = activeInfo?.setData?.duration;
                const enableSound = this.appSettingsService.enableTimerCountdownSound();
                const countdownFrom = this.appSettingsService.countdownSoundSeconds();

                if (enableSound && targetDuration && targetDuration > 20 && currentElapsed > 0) {
                    const remainingSeconds = targetDuration - currentElapsed;
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
                exerciseData: exerciseData,
                setData: setData,
                type: (setData.type as 'standard' | 'warmup' | 'amrap' | 'custom') ?? 'standard',
                baseExerciseInfo: baseExerciseInfo,
                isCompleted: !!completedSetLog,
                actualReps: completedSetLog?.repsAchieved,
                actualWeight: completedSetLog?.weightUsed,
                actualDuration: completedSetLog?.durationPerformed,
                notes: completedSetLog?.notes || setData?.notes, // This is the logged note for this specific set completion
            };
        }
        return null;
    });

    getIndexedCurrentBlock(): number {
        return (this.currentBlockRound() ?? 1) - 1;
    }

    private addLoggedSetToCurrentLog(exerciseData: WorkoutExercise, loggedSet: LoggedSet): void {
        const logs = this.currentWorkoutLogExercises();
        // Find the log entry for this specific exercise instance (by id, not just exerciseId)
        // This ensures that if the same exercise appears multiple times (different id/order), they are not merged
        const exerciseIndex = this.routine()?.exercises.findIndex(ex => ex.id === exerciseData.id);

        // Find log by both exerciseId and exerciseData.id (unique instance in routine)
        let exerciseLog: LoggedWorkoutExercise | undefined;
        let logIndex = -1;
        for (let i = 0; i < logs.length; i++) {
            const exLog = logs[i];
            // Find the corresponding exercise in the routine for this log
            const routineEx = this.routine()?.exercises.find(ex => ex.id === exerciseData.id);

            if (
                exLog.exerciseId === exerciseData.exerciseId &&
                routineEx &&
                routineEx.id === exerciseData.id &&
                routineEx.id === exLog.id
            ) {
                exerciseLog = exLog;
                logIndex = i;
                break;
            }
        }

        if (exerciseLog) {
            // Find set by plannedSetId (unique per set in the session)
            const existingSetIndex = exerciseLog.sets.findIndex(s => s.plannedSetId === loggedSet.plannedSetId);
            if (existingSetIndex > -1) {
                exerciseLog.sets[existingSetIndex] = loggedSet;
            } else {
                exerciseLog.sets.push(loggedSet);
            }
        } else {
            // Use the exerciseName from the currentBaseExercise if available, otherwise from the routine
            const exerciseName = this.currentBaseExercise()?.name || exerciseData.exerciseName || 'Unknown Exercise';
            const newLog: LoggedWorkoutExercise = {
                id: exerciseData.id,
                exerciseId: exerciseData.exerciseId,
                exerciseName,
                sets: [loggedSet],
                rounds: exerciseData.rounds || 0,
                type: loggedSet.type || 'standard',
                supersetId: exerciseData.supersetId || null,
                supersetOrder: exerciseData.supersetOrder !== null ? exerciseData.supersetOrder : null,
                supersetSize: exerciseData.supersetSize || 0,
                supersetRounds: exerciseData.supersetRounds || 0,
            };

            // Insert at the same index as in the routine for consistency
            if (typeof exerciseIndex === 'number' && exerciseIndex >= 0 && exerciseIndex <= logs.length) {
                logs.splice(exerciseIndex, 0, newLog);
            } else {
                logs.push(newLog);
            }
        }
        this.currentWorkoutLogExercises.set([...logs]);
    }

    completeAndLogCurrentSet(): void {
        const activeInfo = this.activeSetInfo();
        const currentRoutineValue = this.routine();
        if (!activeInfo || !currentRoutineValue) { this.toastService.error("Cannot log set: data unavailable", 0); return; }

        if (activeInfo.setData.duration && activeInfo.setData.duration > 0 &&
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

        const formValues = this.currentSetForm.value; // Includes setNotes

        let durationToLog = formValues.actualDuration;
        if (activeInfo.setData.duration && activeInfo.setData.duration > 0 && this.timedSetElapsedSeconds() > 0) {
            durationToLog = this.timedSetElapsedSeconds();
        } else if (formValues.actualDuration === null && activeInfo.setData.duration) {
            durationToLog = activeInfo.setData.duration;
        }

        const loggedSetData: LoggedSet = {
            id: uuidv4(),
            exerciseName: activeInfo.exerciseData.exerciseName,
            // For Tabata, combine plannedSetId and round to make it unique per pass
            plannedSetId: `${activeInfo.setData.id}-round-${this.getIndexedCurrentBlock()}`,
            exerciseId: activeInfo.exerciseData.exerciseId,
            type: activeInfo.setData.type,
            repsAchieved: formValues.actualReps ?? (activeInfo.setData.type === 'warmup' ? 0 : activeInfo.setData.reps ?? 0),
            weightUsed: formValues.actualWeight ?? (activeInfo.setData.type === 'warmup' ? null : activeInfo.setData.weight),
            durationPerformed: durationToLog,
            rpe: formValues.rpe ?? undefined,
            targetReps: activeInfo.setData.reps,
            targetWeight: activeInfo.setData.weight,
            targetDuration: activeInfo.setData.duration,
            targetTempo: activeInfo.setData.tempo,
            targetRestAfterSet: activeInfo.setData.restAfterSet,
            notes: formValues.setNotes?.trim() || undefined,
            timestamp: new Date().toISOString(),
            supersetCurrentRound: this.getIndexedCurrentBlock()
            // Add a specific field for Tabata round
        };
        this.addLoggedSetToCurrentLog(activeInfo.exerciseData, loggedSetData);

        if (this.sessionState() === SessionState.Playing) {
            this.captureAndSaveStateForUnload();
        }

        this.rpeValue.set(null);
        this.showRpeSlider.set(false);
        // Do not reset setNotes here, it will be reset when new set is prepared by patchActualsFormBasedOnSessionTargets or patchCurrentSetFormWithData
        this.currentSetForm.patchValue({ setNotes: '' }, { emitEvent: false }); // Clear notes after logging for current set form visually.
    }

    async finishWorkoutAndReportStatus(): Promise<boolean> {
        this.stopAutoSave();
        if (this.sessionState() === SessionState.Paused) {
            this.toastService.warning("Please resume workout before finishing", 3000, "Session Paused");
            // If user tries to finish while paused, maybe offer to resume or just return false
            // For now, let's assume they need to resume via the resume button first.
            return false; // Did not log
        }
        if (this.sessionState() === SessionState.Loading) {
            this.toastService.info("Workout is still loading", 3000, "Loading");
            return false; // Did not log
        }
        const loggedExercisesForReport = this.currentWorkoutLogExercises().filter(ex => ex.sets.length > 0);
        // const loggedExercisesForReport = this.routine()?.exercises.map(ex => this.mapWorkoutExerciseToLoggedWorkoutExercise(ex));

        if (loggedExercisesForReport === undefined || loggedExercisesForReport.length === 0) {
            return false
        }

        if (loggedExercisesForReport.length === 0) {
            this.toastService.info("No sets logged. Workout not saved", 3000, "Empty Workout");
            this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
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


        if ((!this.routineId || this.routineId == '-1') && loggedExercisesForReport.length > 0) { // Ad-hoc
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
                    { text: "Just log", role: "no_save", data: "cancel", cssClass: "bg-red-600" } as AlertButton
                ]
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
        const sessionStartTime = this.workoutStartTime - (this.sessionTimerElapsedSecondsBeforePause * 1000);
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
                    this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);

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

        this.toastService.success("Tabata Workout Complete!", 5000, "Workout Finished", false);

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
        this.storageService.removeItem(this.PAUSED_WORKOUT_KEY);
        this.router.navigate(['/workout/summary', savedLog.id]);
        return true;
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
        this.sessionTimerElapsedSecondsBeforePause = 0;
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
                            return { sessionRoutineCopy: sessionCopy, programId: programId };
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

                const { sessionRoutineCopy, programId } = result;

                console.log('loadNewWorkoutFromRoute - tap operator. Session routine copy:', sessionRoutineCopy.name);
                console.log('loadNewWorkoutFromRoute - tap operator. Program ID:', programId);

                // +++ You can now use the programId to set state
                // For example, if you have a signal for it:
                // this.programId.set(programId);

                // --- NEW: TABATA MODE CHECK ---
                if (sessionRoutineCopy.goal === 'tabata') {
                    this.setupTabataMode(sessionRoutineCopy);
                    this.startSessionTimer();
                    this.isInitialLoadComplete = true;
                    return;
                }
                // --- END: TABATA MODE CHECK ---

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
                        this.totalBlockRounds.set(firstEx.rounds ?? 1);
                    } else {
                        const actualStart = sessionRoutineCopy.exercises.find(ex => ex.supersetId === firstEx.supersetId && ex.supersetOrder === 0);
                        this.totalBlockRounds.set(actualStart?.rounds ?? 1);
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

    private async tryProceedToDeferredExercisesOrFinish(sessionRoutine: Routine): Promise<void> {
        const mergedUnfinishedExercises = this.getUnfinishedOrDeferredExercises(sessionRoutine);

        if (mergedUnfinishedExercises.length > 0) {
            let proceedWithSelectedExercise = false;
            let selectedExerciseOriginalIndex: number | undefined;
            let userChoseToFinishNow = false;
            let userCancelledChoice = false;

            if (mergedUnfinishedExercises.length === 1) {
                const singleEx = mergedUnfinishedExercises[0];
                const confirmSingle = await this.alertService.showConfirmationDialog(
                    `Unfinished: ${singleEx.exerciseName}`,
                    `You have "${singleEx.exerciseName}" (${singleEx.sessionStatus === 'do_later' ? 'Do Later' : 'Skipped'}) remaining. Complete it now?`,
                    [
                        { text: 'Complete It', role: 'confirm', data: singleEx.originalIndex, cssClass: 'bg-blue-500 hover:bg-blue-600 text-white' } as AlertButton,
                        { text: 'Finish Workout', role: 'destructive', data: 'finish_now', cssClass: 'bg-green-500 hover:bg-green-600 text-white' } as AlertButton,
                        // { text: 'Cancel (Decide Later)', role: 'cancel', data: 'cancel_deferred_choice' } as AlertButton // Added Cancel here too
                    ]
                );
                if (confirmSingle && typeof confirmSingle.data === 'number') {
                    proceedWithSelectedExercise = true;
                    selectedExerciseOriginalIndex = confirmSingle.data;
                } else if (confirmSingle && confirmSingle.data === 'finish_now') {
                    userChoseToFinishNow = true;
                } else { // Includes cancel_deferred_choice or dialog dismissal
                    userCancelledChoice = true;
                }
            } else { // Multiple unfinished exercises
                proceedWithSelectedExercise = true;
            }

            // Handle choices
            if (userChoseToFinishNow) {
                await this.finishWorkoutAndReportStatus();
                return;
            }

            if (userCancelledChoice) {
                // Mark that proposals happened for *all* categories that were presented in this list.
                mergedUnfinishedExercises.forEach(ex => {
                    if (ex.sessionStatus === 'do_later') this.exercisesProposedThisCycle.doLater = true;
                    if (ex.sessionStatus === 'skipped') this.exercisesProposedThisCycle.skipped = true;
                });
                this.cdr.detectChanges(); // For mainActionButtonLabel update
                // IMPORTANT: Return here to prevent falling through to finishWorkoutAndReportStatus()
                // The user chose to "decide later", so the player should wait for their next action.
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
                this.currentBlockRound.set(1); // Reset round for this specific exercise block
                const newBlockStarter = updatedRoutine.exercises[selectedExerciseOriginalIndex];
                if (!newBlockStarter.supersetId || newBlockStarter.supersetOrder === 0) {
                    this.totalBlockRounds.set(newBlockStarter.rounds ?? 1);
                } else {
                    const actualBlockStart = updatedRoutine.exercises.find(ex => ex.supersetId === newBlockStarter.supersetId && ex.supersetOrder === 0);
                    this.totalBlockRounds.set(actualBlockStart?.rounds ?? 1);
                }
                this.lastPerformanceForCurrentExercise = null;
                this.playerSubState.set(PlayerSubState.PerformingSet);
                await this.prepareCurrentSet();
                return; // Exit as we're now performing the chosen exercise
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
                { text: 'End session', role: 'end_session', data: "end_session", cssClass: 'bg-blue-500 hover:bg-blue-600 text-white', icon: 'done', iconClass: 'h-8 w-8 mr-1' } as AlertButton,
            ],
        );

        if (endCurrentWorkout && endCurrentWorkout.role === 'end_session') {
            await this.finishWorkoutAndReportStatus();
        }
    }


    private async prepareCurrentSet(): Promise<void> {
        console.log('prepareCurrentSet: START');
        if (this.sessionState() === SessionState.Paused) {
            console.log("prepareCurrentSet: Session is paused, deferring preparation");
            return;
        }

        const sessionRoutine = this.routine();
        if (!sessionRoutine || sessionRoutine.exercises.length === 0) {
            console.warn('prepareCurrentSet: No sessionRoutine or no exercises in routine. Current routine:', sessionRoutine);
            this.sessionState.set(SessionState.Error);
            this.toastService.error("Cannot prepare set: Routine data is missing or empty", 0, "Error");
            return;
        }

        let exIndex = this.currentExerciseIndex();
        let sIndex = this.currentSetIndex();

        console.log(`prepareCurrentSet: Initial target - exIndex: ${exIndex}, sIndex: ${sIndex}, sessionStatus: ${sessionRoutine.exercises[exIndex]?.sessionStatus}`);

        if (sessionRoutine.exercises[exIndex]?.sessionStatus !== 'pending') {
            console.log(`prepareCurrentSet: Initial target Ex ${exIndex} (name: ${sessionRoutine.exercises[exIndex]?.exerciseName}) is ${sessionRoutine.exercises[exIndex]?.sessionStatus}. Finding first 'pending'`);
            const firstPendingInfo = this.findFirstPendingExerciseAndSet(sessionRoutine);

            if (firstPendingInfo) {
                exIndex = firstPendingInfo.exerciseIndex;
                sIndex = firstPendingInfo.setIndex;
                this.currentExerciseIndex.set(exIndex);
                this.currentSetIndex.set(sIndex);
                this.isPerformingDeferredExercise = false; // Reset if we had to find a new starting point
                console.log(`prepareCurrentSet: Found first pending - exIndex: ${exIndex} (name: ${sessionRoutine.exercises[exIndex]?.exerciseName}), sIndex: ${sIndex}`);
            } else {
                console.log("prepareCurrentSet: No 'pending' exercises found in the entire routine. Proceeding to deferred/finish evaluation");
                this.exercisesProposedThisCycle = { doLater: false, skipped: false };
                await this.tryProceedToDeferredExercisesOrFinish(sessionRoutine);
                return;
            }
        }

        if (exIndex >= sessionRoutine.exercises.length || !sessionRoutine.exercises[exIndex] || sIndex >= sessionRoutine.exercises[exIndex].sets.length || !sessionRoutine.exercises[exIndex].sets[sIndex]) {
            // This condition is often met when a workout is completed and then resumed.
            // Instead of throwing a critical error, we treat it as the end of the planned workout
            // and transition to the finish/deferred exercises flow.
            console.warn(`prepareCurrentSet: Indices [ex: ${exIndex}, set: ${sIndex}] are out of bounds. This is expected for a completed session. Transitioning to finish flow`);

            // Perform cleanup to ensure a clean state before the next step.
            this.currentSetForm.reset({ rpe: null, setNotes: '' });
            this.resetTimedSet();
            this.currentBaseExercise.set(null);
            this.exercisePBs.set([]);
            this.lastPerformanceForCurrentExercise = null;
            this.rpeValue.set(null);
            this.showRpeSlider.set(false);

            // Gracefully guide the user to the next logical step.
            await this.tryProceedToDeferredExercisesOrFinish(sessionRoutine);

            // Stop further execution of prepareCurrentSet.
            return;
        }

        let exercisesComplete = false;
        if (sessionRoutine.exercises.length === this.currentWorkoutLogExercises().length) {
            exercisesComplete = true;
        }
        sessionRoutine.exercises.forEach(exercise => {
            const loggedExercise = this.currentWorkoutLogExercises().find(ex => ex.id === exercise.id);
            if (!exercisesComplete && loggedExercise && exercise.sets.length === loggedExercise.sets.length) {
                exercisesComplete = true;
            }
        })


        const currentExerciseData = sessionRoutine.exercises[exIndex];
        const currentPlannedSetData = currentExerciseData.sets[sIndex]; // Use direct sIndex after validation

        console.log(`prepareCurrentSet: Preparing for Ex: "${currentExerciseData.exerciseName}", Set: ${sIndex + 1}, Type: ${currentPlannedSetData.type}`);

        // Step 1: Get the planned set data from the original routine template.
        const plannedSetForSuggestions = currentPlannedSetData;

        this.loadBaseExerciseAndPBs(currentExerciseData.exerciseId);

        // Step 2: Fetch the complete workout log from the last time this exercise was performed.
        if (!this.lastPerformanceForCurrentExercise || this.lastPerformanceForCurrentExercise.sets[0]?.exerciseId !== currentExerciseData.exerciseId) {
            this.lastPerformanceForCurrentExercise = await firstValueFrom(this.trackingService.getLastPerformanceForExercise(currentExerciseData.exerciseId).pipe(take(1)));
        }

        // Step 3: Find the specific set from the last session that corresponds to the set we are about to do now (e.g., the 2nd set of the exercise).
        const historicalSetPerformance = this.trackingService.findPreviousSetPerformance(this.lastPerformanceForCurrentExercise, plannedSetForSuggestions, sIndex);
        let finalSetParamsForSession: ExerciseSetParams;
        if (plannedSetForSuggestions.type === 'warmup') {
            // For warm-up sets, we don't apply progressive overload. We just use the planned values.
            finalSetParamsForSession = { ...plannedSetForSuggestions };
        } else {
            // Step 4: Call the service to calculate the suggested parameters for the new set.
            // It takes the historical performance, the original plan for today, and the routine's goal to make a suggestion.
            console.warn("prepareCurrentSet: Progressive overload settings are not available. Using default suggestion logic.");
            // Fallback to historicalSetPerformance or default suggestion logic if settings are not available

            if (historicalSetPerformance && currentExerciseData.exerciseName && currentExerciseData.exerciseName.toLowerCase().indexOf('kb') < 0) {
                // use historicalSetPerformance
                finalSetParamsForSession = {
                    ...plannedSetForSuggestions,
                    reps: historicalSetPerformance.repsAchieved || plannedSetForSuggestions.reps || 0,
                    weight: historicalSetPerformance.weightUsed || plannedSetForSuggestions.weight || 0,
                    duration: historicalSetPerformance.durationPerformed || plannedSetForSuggestions.duration || 0,
                    restAfterSet: plannedSetForSuggestions.restAfterSet || 0
                };
            } else {
                finalSetParamsForSession = {
                    ...plannedSetForSuggestions,
                    reps: plannedSetForSuggestions.reps || 0,
                    weight: plannedSetForSuggestions.weight || 0,
                    duration: plannedSetForSuggestions.duration || 0,
                    restAfterSet: plannedSetForSuggestions.restAfterSet || 0
                };
            }
        }

        // Step 5: Ensure the unique ID and type from the current session's plan are preserved.
        finalSetParamsForSession.id = currentPlannedSetData.id; // Ensure ID from current routine set is used
        finalSetParamsForSession.type = currentPlannedSetData.type;
        finalSetParamsForSession.notes = currentPlannedSetData.notes || finalSetParamsForSession.notes;

        // Step 6: Update the live routine signal with the newly suggested set parameters.
        const updatedRoutineForSession = JSON.parse(JSON.stringify(sessionRoutine)) as Routine;

        // suggest updated values only if it's not a timed exercise
        if (!updatedRoutineForSession.exercises[exIndex].sets?.some(set => set.duration)) {
            updatedRoutineForSession.exercises[exIndex].sets[sIndex] = finalSetParamsForSession;
        }
        this.routine.set(updatedRoutineForSession); // Update the routine signal

        // Determine if it's the absolute first set of the *entire workout session* for preset timer
        const isEffectivelyFirstSetInWorkout =
            this.currentWorkoutLogExercises().length === 0 &&
            this.currentBlockRound() === 1 &&
            exIndex === this.findFirstPendingExerciseAndSet(sessionRoutine)?.exerciseIndex &&
            sIndex === this.findFirstPendingExerciseAndSet(sessionRoutine)?.setIndex;

        let previousSetRestDuration = Infinity;
        if (sIndex > 0) {
            previousSetRestDuration = currentExerciseData.sets[sIndex - 1].restAfterSet;
        } else if (exIndex > 0) {
            // Find the actual previous *played* exercise's last set rest
            // This logic might need to be more robust if exercises can be reordered dynamically beyond skip/do-later
            let prevPlayedExIndex = exIndex - 1;
            let foundPrevPlayed = false;
            while (prevPlayedExIndex >= 0) {
                if (this.isExerciseFullyLogged(sessionRoutine.exercises[prevPlayedExIndex]) ||
                    (sessionRoutine.exercises[prevPlayedExIndex].sessionStatus === 'pending' && this.currentWorkoutLogExercises().some(le => le.exerciseId === sessionRoutine.exercises[prevPlayedExIndex].exerciseId))) {
                    const prevExercise = sessionRoutine.exercises[prevPlayedExIndex];
                    if (prevExercise.sets.length > 0) {
                        previousSetRestDuration = prevExercise.sets[prevExercise.sets.length - 1].restAfterSet;
                        foundPrevPlayed = true;
                    }
                    break;
                }
                prevPlayedExIndex--;
            }
            if (!foundPrevPlayed) previousSetRestDuration = Infinity; // No previously played exercise found
        }

        this.playerSubState.set(PlayerSubState.PerformingSet);

        if (this.sessionState() !== SessionState.Playing && this.sessionState() !== SessionState.Paused) {
            console.log("prepareCurrentSet: Setting sessionState to Playing");
            this.sessionState.set(SessionState.Playing);
        }
        console.log('prepareCurrentSet: END');
    }

    private findFirstPendingExerciseAndSet(routine: Routine): { exerciseIndex: number; setIndex: number } | null {
        if (!routine || !routine.exercises) return null;
        for (let i = 0; i < routine.exercises.length; i++) {
            const exercise = routine.exercises[i];
            if (exercise.sessionStatus === 'pending' && exercise.sets && exercise.sets.length > 0) {
                const firstUnloggedSetIdx = this.findFirstUnloggedSetIndex(exercise.id, exercise.sets.map(s => s.id)) ?? 0;
                // Ensure firstUnloggedSetIdx is valid
                if (firstUnloggedSetIdx < exercise.sets.length) {
                    return { exerciseIndex: i, setIndex: firstUnloggedSetIdx };
                } else {
                    // This case means all sets are logged, but exercise is still 'pending' - shouldn't happen if logic is correct elsewhere.
                    // Or exercise has sets but findFirstUnloggedSetIndex returned null unexpectedly.
                    console.warn(`Exercise ${exercise.exerciseName} is pending, but all sets appear logged or index is invalid`);
                    // To be safe, we could mark it as non-pending here or let outer logic handle it.
                    // For now, just continue searching.
                }
            }
        }
        return null;
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


    private isExerciseFullyLogged(currentExercise: WorkoutExercise): boolean {
        const routine = this.routine();
        if (!routine) return false;
        const exercise = routine.exercises.find(ex => ex.id === currentExercise.id);
        if (!exercise) return false;

        const loggedEx = this.currentWorkoutLogExercises().find(le =>
            le.id === currentExercise.id
            && exercise.exerciseId === le.exerciseId
        );

        if (!loggedEx) return false;

        // Determine rounds for this exercise (handle supersets)
        let rounds = exercise.rounds ?? 1;
        if (exercise.supersetId && exercise.supersetOrder !== null) {
            const blockStart = routine.exercises.find(
                ex => ex.supersetId === exercise.supersetId && ex.supersetOrder === 0
            );
            rounds = blockStart?.rounds ?? 1;
        }

        // A superset exercise has only 1 set defined, but is repeated for each round.
        // So, the total number of sets to be logged is equal to the number of rounds.
        // A standard exercise's total sets is its sets.length * its rounds.
        const totalPlannedCompletions = (exercise.sets?.length ?? 0) * rounds;

        return loggedEx.sets.length >= totalPlannedCompletions;
    }


    private findFirstUnloggedSetIndex(exerciseId: string, plannedSetIds: string[]): number | null {
        const loggedEx = this.currentWorkoutLogExercises().find(le => le.id === exerciseId);
        if (!loggedEx) return 0; // No sets logged, start from first

        const loggedPlannedSetIds = new Set(loggedEx.sets.map(s => s.plannedSetId));
        for (let i = 0; i < plannedSetIds.length; i++) {
            if (!loggedPlannedSetIds.has(plannedSetIds[i])) {
                return i; // This is the index of the first planned set not found in logs
            }
        }
        return null; // All sets seem to be logged, or no planned sets (should not happen here)
    }


    /**
     * Transforms a routine into a flat list of HIIT intervals FOR ALL ROUNDS and starts the player.
     * This version correctly handles rounds defined on a per-exercise or per-superset-block basis.
     */
    private setupTabataMode(
        routine: Routine,
        startAtIndex: number = 0,
        startTimeRemaining?: number
    ): void {
        const intervals: Omit<HIITInterval, 'totalIntervals' | 'currentIntervalNumber'>[] = [];
        this.tabataIntervalMap = []; // The map now stores [exerciseIndex, setIndex, roundNumber]

        // 1. Add "Prepare" interval
        intervals.push({ type: 'prepare', duration: 10, exerciseName: 'Get Ready' });
        this.tabataIntervalMap.push([0, 0, 1]);

        // 2. Main loop now iterates through exercise BLOCKS
        let exerciseIndex = 0;
        while (exerciseIndex < routine.exercises.length) {
            const currentExercise = routine.exercises[exerciseIndex];
            const totalRoundsForBlock = this.getRoundsForExerciseBlock(exerciseIndex, routine);
            const isSuperset = !!currentExercise.supersetId;
            const supersetSize = isSuperset ? (currentExercise.supersetSize ?? 1) : 1;

            // Loop for the number of rounds for this specific block
            for (let round = 1; round <= totalRoundsForBlock; round++) {
                // Loop through all exercises within this block (will be 1 for standard exercises)
                for (let i = 0; i < supersetSize; i++) {
                    const blockExerciseIndex = exerciseIndex + i;
                    const blockExercise = routine.exercises[blockExerciseIndex];
                    if (!blockExercise) continue; // Safety check

                    const isLastRound = round === totalRoundsForBlock;

                    blockExercise.sets.forEach((set, setIndex) => {
                        // A. Add the "Work" interval for the current round
                        intervals.push({
                            type: 'work',
                            duration: set.duration || 40,
                            exerciseName: blockExercise.exerciseName
                        });
                        this.tabataIntervalMap.push([blockExerciseIndex, setIndex, round]);

                        // B. Conditionally add the "Rest" interval
                        const isLastExerciseOfEntireWorkout = blockExerciseIndex === routine.exercises.length - 1;
                        const isLastSetOfBlockExercise = setIndex === blockExercise.sets.length - 1;

                        // Don't add rest after the absolute final work interval of the entire workout
                        if (!(isLastRound && isLastExerciseOfEntireWorkout && isLastSetOfBlockExercise)) {
                            if (set.restAfterSet > 0) {
                                intervals.push({
                                    type: 'rest',
                                    duration: set.restAfterSet || 20,
                                    exerciseName: 'Rest'
                                });
                                this.tabataIntervalMap.push([blockExerciseIndex, setIndex, round]);
                            }
                        }
                    });
                }
            }
            // Move the main index to the start of the next block
            exerciseIndex += supersetSize;
        }


        // 3. Finalize the intervals list with total counts
        const totalIntervals = intervals.length;
        const finalIntervals = intervals.map((interval, index) => ({
            ...interval,
            totalIntervals: totalIntervals,
            currentIntervalNumber: index + 1
        }));
        this.tabataIntervals.set(finalIntervals);

        // 4. Set the initial state of the player
        this.sessionState.set(SessionState.Playing);
        this.routine.set(routine);

        // 5. Use the helper to set the correct state for BOTH players.
        this.setPlayerStateFromTabataIndex(startAtIndex);

        // 6. Start the timer
        if (startTimeRemaining !== undefined && startTimeRemaining > 0) {
            this.startCurrentTabataInterval(startTimeRemaining);
        } else {
            this.startCurrentTabataInterval();
        }
    }

    private setPlayerStateFromTabataIndex(tabataIndex: number): void {
        this.currentTabataIntervalIndex.set(tabataIndex);

        // Use the map to find the corresponding standard player indices
        const mappedIndices = this.tabataIntervalMap[tabataIndex];
        if (mappedIndices) {
            const [exerciseIndex, setIndex, round] = mappedIndices;
            this.currentExerciseIndex.set(exerciseIndex);
            this.currentSetIndex.set(setIndex);
            this.currentBlockRound.set(round);

            // Also update the total rounds for the current block for the UI
            if (this.routine()) {
                this.totalBlockRounds.set(this.getRoundsForExerciseBlock(exerciseIndex, this.routine()!));
            }

            console.log(`Tabata Sync: Interval ${tabataIndex} maps to Ex ${exerciseIndex}, Set ${setIndex}, Round ${round}`);
        } else {
            // Fallback for the end of the workout
            const lastValidMap = this.tabataIntervalMap[this.tabataIntervalMap.length - 1];
            if (lastValidMap) {
                const [lastEx, lastSet, lastRound] = lastValidMap;
                this.currentExerciseIndex.set(lastEx);
                this.currentSetIndex.set(lastSet);
                this.currentBlockRound.set(lastRound);
                if (this.routine()) {
                    this.totalBlockRounds.set(this.getRoundsForExerciseBlock(lastEx, this.routine()!));
                }
            }
        }
    }

    private getRoundsForExerciseBlock(exerciseIndex: number, routine: Routine): number {
        const exercise = routine.exercises[exerciseIndex];
        if (!exercise) return 1;

        // If it's a superset, find the first exercise in that superset block
        if (exercise.supersetId) {
            const firstInSuperset = routine.exercises.find(ex => ex.supersetId === exercise.supersetId && ex.supersetOrder === 0);
            return firstInSuperset?.rounds ?? 1;
        }

        // If it's a standard exercise, use its own rounds property
        return exercise.rounds ?? 1;
    }


    /**
   * Starts the timer for the currently active Tabata interval.
   * Can start from a specific remaining time if resuming.
   */
    private startCurrentTabataInterval(startFromTime?: number): void {
        if (this.tabataTimerSub) this.tabataTimerSub.unsubscribe();
        if (this.sessionState() === SessionState.Paused) return;

        const interval = this.currentTabataInterval();
        if (!interval) {
            this.sessionState.set(SessionState.End);
            this.finishWorkoutAndReportStatus();
            return;
        }

        // If resuming, use the provided time. Otherwise, use the interval's full duration.
        const initialTime = startFromTime !== undefined ? startFromTime : interval.duration;
        this.tabataTimeRemaining.set(initialTime);

        this.tabataTimerSub = timer(0, 1000)
            .pipe(
                take(interval.duration + 1), // Keep your existing take()
                takeUntil(this.destroy$)      // Add this line
            ).subscribe({
                next: () => {
                    this.tabataTimeRemaining.update(t => t - 1);
                },
                complete: () => {
                    if (this.sessionState() === SessionState.Playing) {
                        this.nextTabataInterval();
                    }
                }
            });
    }
    /**
      * Navigates to the next interval in the Tabata sequence.
      */
    nextTabataInterval(): void {
        // First, if the interval that just finished was a "work" interval, log it.
        if (this.currentTabataInterval()?.type === 'work') {
            this.completeAndLogCurrentSet();
        }

        const nextIndex = this.currentTabataIntervalIndex() + 1;

        if (nextIndex < this.tabataIntervals().length) {
            // There are more intervals, so proceed to the next one.
            // The helper function will set the currentExerciseIndex, setIndex, AND the currentBlockRound.
            this.setPlayerStateFromTabataIndex(nextIndex);
            this.startCurrentTabataInterval();
        } else {
            // Reached the end of the very last interval.
            this.tabataTimeRemaining.set(0);
            if (this.tabataTimerSub) this.tabataTimerSub.unsubscribe();
            this.sessionState.set(SessionState.End);
            // Now that the session is truly over, finalize and save.
            this.finishWorkoutAndReportStatus();
        } 1
    }
    /**
     * Navigates to the previous interval in the Tabata sequence.
     */
    previousTabataInterval(): void {
        const prevIndex = this.currentTabataIntervalIndex() - 1;
        if (prevIndex >= 0) {
            this.currentTabataIntervalIndex.set(prevIndex);
            this.startCurrentTabataInterval();
        }
    }

    /**
     * Toggles the pause state for the Tabata player.
     */
    toggleTabataPause(): void {
        if (this.sessionState() === SessionState.Playing) {
            // Pausing
            this.sessionState.set(SessionState.Paused);
            if (this.tabataTimerSub) this.tabataTimerSub.unsubscribe();
            if (this.timerSub) this.timerSub.unsubscribe(); // Pause overall timer too
            this.sessionTimerElapsedSecondsBeforePause += Math.floor((Date.now() - this.workoutStartTime) / 1000);
        } else if (this.sessionState() === SessionState.Paused) {
            // Resuming
            this.sessionState.set(SessionState.Playing);
            this.workoutStartTime = Date.now(); // Reset start time for delta calculation
            this.startSessionTimer(); // Resume overall timer
            this.startCurrentTabataInterval(); // Resume interval timer
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

    ngOnDestroy(): void {
        // --- This is the core of the pattern ---
        // Emit a value to notify all subscriptions to complete.
        this.destroy$.next();
        this.destroy$.complete();
        // ------------------------------------

        // The rest of your specific cleanup logic remains the same.
        this.stopAllActivity(); // This is good to keep for any non-observable timers.
        this.isRestTimerVisible.set(false);

        if (isPlatformBrowser(this.platformId) && !this.isSessionConcluded &&
            (this.sessionState() === SessionState.Playing || this.sessionState() === SessionState.Paused) &&
            this.routine()) {
            console.log('WorkoutPlayer ngOnDestroy - Saving state...');
            this.savePausedSessionState();
        }
    }

    private stopAllActivity(): void {
        // this.isSessionConcluded = true;
        console.log('stopAllActivity - Stopping timers and auto-save');
        this.stopAutoSave();
        if (this.timerSub) this.timerSub.unsubscribe();
        if (this.timedSetIntervalSub) this.timedSetIntervalSub.unsubscribe();
        if (this.tabataTimerSub) this.tabataTimerSub.unsubscribe();
        this.isRestTimerVisible.set(false);
        // this.sessionState.set(SessionState.End);
    }

    stopAndLogTimedSet(): void {
        if (this.timedSetTimerState() === TimedSetState.Running || this.timedSetTimerState() === TimedSetState.Paused) {
            this.pauseTimedSet(); // Pause it, the value is already in timedSetElapsedSeconds
        }
    }

    private pauseTimedSet(): void {
        if (this.timedSetIntervalSub) {
            this.timedSetIntervalSub.unsubscribe();
            this.timedSetIntervalSub = undefined;
        }
        this.timedSetTimerState.set(TimedSetState.Paused);
    }

    private savePausedSessionState(): void {
        if (this.sessionState() === SessionState.End) {
            this.stopAllActivity();
            return;
        }
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
        const firstLoggedSetTime = this.currentWorkoutLogExercises()[0]?.sets[0]?.timestamp;
        const baseTimeForDate = firstLoggedSetTime ? new Date(firstLoggedSetTime) : (this.workoutStartTime > 0 ? new Date(this.workoutStartTime - (this.sessionTimerElapsedSecondsBeforePause * 1000)) : new Date());
        dateToSaveInState = format(baseTimeForDate, 'yyyy-MM-dd');


        const stateToSave: PausedWorkoutState = {
            version: this.PAUSED_STATE_VERSION,
            routineId: this.routineId,
            sessionRoutine: JSON.parse(JSON.stringify(currentRoutine)), // Includes sessionStatus
            originalRoutineSnapshot: JSON.parse(JSON.stringify(currentRoutine)), // tabata mode can't be edited
            currentExerciseIndex: this.currentExerciseIndex(),
            currentSetIndex: this.currentSetIndex(),
            currentWorkoutLogExercises: JSON.parse(JSON.stringify(this.currentWorkoutLogExercises())),
            workoutStartTimeOriginal: this.workoutStartTime,
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
            isTabataMode: true
        };

        stateToSave.tabataCurrentIntervalIndex = this.currentTabataIntervalIndex();
        stateToSave.tabataTimeRemainingOnPause = this.tabataTimeRemaining();

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

    private convertLoggedToWorkoutExercises(loggedExercises: LoggedWorkoutExercise[]): WorkoutExercise[] {
        const currentSessionRoutine = this.routine();
        return loggedExercises.map(loggedEx => {
            const sessionExercise = currentSessionRoutine?.exercises.find(re => re.exerciseId === loggedEx.exerciseId);
            const newWorkoutEx: WorkoutExercise = {
                id: uuidv4(),
                exerciseId: loggedEx.exerciseId, // Keep original if it's a known one, or the custom one
                exerciseName: loggedEx.exerciseName,
                supersetId: sessionExercise?.supersetId || null,
                supersetOrder: sessionExercise?.supersetOrder ?? null,
                supersetSize: sessionExercise?.supersetSize ?? null,
                rounds: sessionExercise?.rounds ?? 1,
                notes: sessionExercise?.notes, // Overall exercise notes from session if any
                sets: !loggedEx.supersetId ? loggedEx.sets.map(loggedSet => {
                    const originalPlannedSet = sessionExercise?.sets.find(s => s.id === loggedSet.plannedSetId);
                    return {
                        id: uuidv4(), // New ID for the routine template set
                        reps: loggedSet.targetReps ?? loggedSet.repsAchieved, // Prefer saving targets
                        weight: loggedSet.targetWeight ?? loggedSet.weightUsed,
                        duration: loggedSet.targetDuration ?? loggedSet.durationPerformed,
                        tempo: loggedSet.targetTempo || originalPlannedSet?.tempo,
                        restAfterSet: originalPlannedSet?.restAfterSet || 60, // Prefer planned rest
                        notes: loggedSet.notes, // Persist individual logged set notes if saving structure
                        type: loggedSet.type as 'standard' | 'warmup' | 'amrap' | 'custom' | string,
                    };
                }) : [this.getFirstExerciseOfSuperset((loggedEx.supersetOrder || 0), loggedEx.supersetId, loggedExercises)],
                // TODO correct number of sets when converting a SUPERSET routine to a new one
                type: (sessionExercise?.supersetSize ?? 0) >= 1 ? 'superset' : 'standard'
                // sessionStatus is NOT included here as it's session-specific
            };
            return newWorkoutEx;
        });
    }

    getFirstExerciseOfSuperset(superSetOrder: number, supersetId: string, loggedExercises: LoggedWorkoutExercise[]): ExerciseSetParams {
        const exercise = loggedExercises.find(ex => ex.supersetId && ex.supersetId === supersetId);
        const exerciseSet = exercise?.sets[0];
        return {
            id: uuidv4(), // New ID for the routine template set
            reps: exerciseSet && exerciseSet.targetReps ? exerciseSet.repsAchieved : 1,
            weight: exerciseSet && exerciseSet.weightUsed ? exerciseSet.weightUsed : 1,
            duration: exerciseSet && exerciseSet.targetDuration ? exerciseSet.targetDuration : 0,
            tempo: '1',
            restAfterSet: superSetOrder !== null && superSetOrder !== undefined && exercise && exercise.supersetSize && superSetOrder < exercise.supersetSize - 1 ? 0 : this.getLastExerciseOfSuperset(supersetId, loggedExercises).restAfterSet,
            notes: exerciseSet && exerciseSet.notes ? exerciseSet.notes : '',
            type: exerciseSet && exerciseSet.type ? 'superset' : 'standard',
        };
    }

    getLastExerciseOfSuperset(supersetId: string, loggedExercises: LoggedWorkoutExercise[]): ExerciseSetParams {
        const exercise = loggedExercises.find(ex => ex.supersetId && ex.supersetId === supersetId);
        const exerciseSet = exercise?.sets[exercise.sets.length - 1];
        return {
            id: uuidv4(), // New ID for the routine template set
            reps: exerciseSet && exerciseSet.targetReps ? exerciseSet.targetReps : 1,
            weight: exerciseSet && exerciseSet.targetWeight ? exerciseSet.targetWeight : 1,
            duration: exerciseSet && exerciseSet.targetDuration ? exerciseSet.targetDuration : 1,
            tempo: '1',
            restAfterSet: exerciseSet && exerciseSet.targetRestAfterSet ? exerciseSet.targetRestAfterSet : 60,
            notes: exerciseSet && exerciseSet.notes ? exerciseSet.notes : '',
            type: exerciseSet && exerciseSet.type ? 'superset' : 'standard',
        };
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
            workoutLog.date = format(new Date(workoutLog.startTime), 'yyyy-MM-dd'),
                await this.alertService.showAlert("Workout Timing Adjusted",
                    `Workout start time was not set. Estimated start time is ${format(new Date(workoutLog.startTime), 'MMM d, HH:mm')}. ` +
                    `Estimated end time is ${format(new Date(workoutLog.endTime), 'MMM d, HH:mm')}. Duration: ${durationMinutes} minutes (${durationSeconds} seconds).`
                )

        }
        return workoutLog;
    }

    /**
 * Returns an array of all exercises in the current routine that are not fully logged.
 * An exercise is considered unfinished if not all its sets are logged.
 */
    getUnfinishedExercises(): WorkoutExercise[] {
        const routine = this.routine();
        if (!routine) return [];
        return routine.exercises.filter((ex, idx) => !this.isExerciseFullyLogged(ex));
    }

    private getUnfinishedOrDeferredExercises(sessionRoutine: Routine): any[] {
        const currentExercise = sessionRoutine.exercises[this.currentExerciseIndex()];
        const unfinishedOtherExercises = this.getUnfinishedExercises().filter(
            ex => ex.id !== currentExercise.id
        );
        // console.log("Unfinished exercises (excluding current):", unfinishedOtherExercises.map(e => e.exerciseName));

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
        // Merge and deduplicate unfinished exercises by their unique id
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

    resetTimedSet(): void {
        if (this.timedSetIntervalSub) {
            this.timedSetIntervalSub.unsubscribe();
            this.timedSetIntervalSub = undefined;
        }
        this.timedSetTimerState.set(TimedSetState.Idle);
        this.timedSetElapsedSeconds.set(0);
        const targetDuration = this.activeSetInfo()?.setData?.duration;
        this.currentSetForm.get('actualDuration')?.setValue(targetDuration ?? 0, { emitEvent: false });
        this.soundPlayedForThisCountdownSegment = false;
    }

}