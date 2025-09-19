// workout-log-detail.ts
import { Component, HostListener, inject, Input, OnDestroy, OnInit, PLATFORM_ID, signal, SimpleChanges } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin, Observable, of, Subscription } from 'rxjs';
import { map, switchMap, tap, catchError, take } from 'rxjs/operators';
import { Exercise } from '../../../core/models/exercise.model';
// MODIFICATION: Import PersonalBestSet
import { LoggedWorkoutExercise, WorkoutLog, LoggedSet, PersonalBestSet } from '../../../core/models/workout-log.model';
import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ExerciseDetailComponent } from '../../exercise-library/exercise-detail';
import { Routine, WorkoutExercise } from '../../../core/models/workout.model';
import { UnitsService } from '../../../core/services/units.service';
import { IsWeightedPipe } from '../../../shared/pipes/is-weighted-pipe';
import { WorkoutService } from '../../../core/services/workout.service';
import { ActionMenuComponent } from '../../../shared/components/action-menu/action-menu';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { AlertService } from '../../../core/services/alert.service';
import { SpinnerService } from '../../../core/services/spinner.service';
import { ToastService } from '../../../core/services/toast.service';
import { PressDirective } from '../../../shared/directives/press.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { ProgramDayInfo, TrainingProgram } from '../../../core/models/training-program.model';
import { MenuMode } from '../../../core/models/app-settings.model';
// DomSanitizer is not explicitly used in this version after previous edits, but good to keep if you plan to use [innerHTML] with dynamic SVGs later.
// import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface DisplayLoggedExercise extends LoggedWorkoutExercise {
  baseExercise?: Exercise | null;
  isExpanded?: boolean;
  showWarmups?: boolean;
  warmupSets?: LoggedSet[];
  workingSets?: LoggedSet[];
  iconName?: string;
  // Superset related properties (assuming they come from LoggedWorkoutExercise or are derived)
  supersetId?: string | null;
  supersetOrder?: number | null;
  supersetSize?: number | null;
  supersetRounds?: number | null;      // Total rounds for THIS superset instance in the log
  supersetCurrentRound?: number | null; // The current round number for THIS exercise entry
}

interface EMOMRoundDetail {
    roundNumber: number;
    // Each set in this array corresponds to an exercise in the block for this specific round
    sets: (LoggedSet | undefined)[];
}

interface EMOMDisplayBlock {
    isEmomBlock: true; // Type guard to differentiate in the template
    supersetId: string;
    blockName: string;
    totalRounds: number;
    emomTimeSeconds: number;
    // The full exercise definitions for the block, used for headers and icons
    exercises: DisplayLoggedExercise[];
    // The structured performance data by round
    rounds: EMOMRoundDetail[];
    isExpanded: boolean;
}

// A union type for the items in our display array
type DisplayItem = DisplayLoggedExercise | EMOMDisplayBlock;

interface TargetComparisonData {
  metric: 'Reps' | 'Duration' | 'Weight' | 'Rest';
  targetValue: string;
  performedValue: string;
}

@Component({
  selector: 'app-workout-log-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, ModalComponent, ExerciseDetailComponent, IsWeightedPipe, ActionMenuComponent, PressDirective, IconComponent, TooltipDirective, WeightUnitPipe],
  templateUrl: './workout-log-detail.html',
  providers: [DecimalPipe] // DecimalPipe if used directly in template; WeightUnitPipe already handles it
})
export class WorkoutLogDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService);
  private workoutService = inject(WorkoutService);
  protected unitService = inject(UnitsService);
  private alertService = inject(AlertService);
  private spinnerService = inject(SpinnerService);
  private toastService = inject(ToastService);
  private platformId = inject(PLATFORM_ID);
  private trainingService = inject(TrainingProgramService);

  comparisonModalData = signal<TargetComparisonData | null>(null);
  notesModalsData = signal<string | null>(null);
  isExerciseDetailModalOpen = signal(false);
  isSimpleModalOpen = signal(false);
  exerciseDetailsId: string = '';
  exerciseDetailsName: string = '';

  workoutLog = signal<WorkoutLog | null | undefined>(undefined);
  displayItems = signal<DisplayItem[]>([]);
  personalBestsForLog = signal<Record<string, PersonalBestSet[]>>({});

  @Input() logId?: string;
  exerciseInfoTooltipString = 'Exercise details and progression';

  private subscriptions = new Subscription();
  availablePrograms: TrainingProgram[] = [];

  weekName = signal<string | null>(null);
  dayInfo = signal<ProgramDayInfo | null>(null);

  constructor() {
    // Initialization if needed
  }

  async ngOnInit(): Promise<void> {
    window.scrollTo(0, 0);
    this.subscriptions.add(
      this.trainingService.programs$.pipe(take(1)).subscribe(programs => {
        this.availablePrograms = programs;
      })
    );

    const idSource$ = this.logId ? of(this.logId) : this.route.paramMap.pipe(map(params => params.get('logId')));
    this.subscriptions.add(
      idSource$.pipe(
        switchMap(id => {
          if (id) {
            return this.trackingService.getWorkoutLogById(id);
          }
          return of(null);
        }),
        tap(async (log) => {
          this.workoutLog.set(log);

          if (log && log.exercises && log.exercises.length > 0) {
            this.prepareDisplayExercises(log.exercises);
            await this.enrichLoggedExercisesWithTargets();

            this.trainingService.getWeekNameForLog(log).pipe(take(1)).subscribe(name => {
              this.weekName.set(name);
            });

            this.trainingService.getDayOfWeekForLog(log).pipe(take(1)).subscribe(info => {
              this.dayInfo.set(info);
            });
          } else {
            this.displayItems.set([]);
            this.weekName.set(null);
            this.dayInfo.set(null);
          }
        }),
        catchError(err => {
          console.error("Error fetching workout log:", err);
          this.workoutLog.set(null);
          this.displayItems.set([]);
          this.weekName.set(null);
          return of(null);
        })
      ).subscribe()
    );
  }

  async enrichLoggedExercisesWithTargets() {
    const log = this.workoutLog();
    if (!log?.routineId) return;

    const routine = await firstValueFrom(this.workoutService.getRoutineById(log.routineId));
    if (!routine?.exercises) return;

    const routineExerciseMap = new Map(routine.exercises.map(ex => [ex.id, ex]));

    for (const loggedEx of log.exercises) {
      const routineEx = routineExerciseMap.get(loggedEx.id);

      for (let i = 0; i < loggedEx.sets.length; i++) {
        const set = loggedEx.sets[i];
        const routineExerciseSet = routineEx?.sets?.find(s => s.id === set.plannedSetId) ?? routineEx?.sets?.[i];

        set.targetReps = set.targetReps ?? routineExerciseSet?.targetReps;
        set.targetRepsMin = set.targetRepsMin ?? routineExerciseSet?.targetRepsMin;
        set.targetRepsMax = set.targetRepsMax ?? routineExerciseSet?.targetRepsMax;
        set.targetDuration = set.targetDuration ?? routineExerciseSet?.targetDuration;
        set.targetDurationMin = set.targetDurationMin ?? routineExerciseSet?.targetDurationMin;
        set.targetDurationMax = set.targetDurationMax ?? routineExerciseSet?.targetDurationMax;
        set.targetWeight = set.targetWeight ?? routineExerciseSet?.targetWeight;
        set.targetWeightMin = set.targetWeightMin ?? routineExerciseSet?.targetWeightMin;
        set.targetWeightMax = set.targetWeightMax ?? routineExerciseSet?.targetWeightMax;
        set.targetDistance = set.targetDistance ?? routineExerciseSet?.targetDistance;
        set.targetDistanceMin = set.targetDistanceMin ?? routineExerciseSet?.targetDistanceMin;
        set.targetDistanceMax = set.targetDistanceMax ?? routineExerciseSet?.targetDistanceMax;
        set.targetRestAfterSet = set.targetRestAfterSet ?? routineExerciseSet?.restAfterSet;
      }
    }
    this.workoutLog.set({ ...log });
  }

  private prepareDisplayExercises(loggedExercises: LoggedWorkoutExercise[]): void {
    const processedSupersetIds = new Set<string>();

    const exercisesWithBaseInfo$: Observable<DisplayLoggedExercise>[] = loggedExercises.map(ex =>
      this.exerciseService.getExerciseById(ex.exerciseId).pipe(
        map(baseEx => {
          const warmupSets = ex.sets?.filter(s => s.type === 'warmup') || [];
          const workingSets = ex.sets?.filter(s => s.type !== 'warmup') || [];
          return {
            ...ex,
            baseExercise: baseEx || null,
            isExpanded: true,
            showWarmups: warmupSets.length > 0,
            warmupSets,
            workingSets,
            iconName: this.exerciseService.determineExerciseIcon(baseEx ?? null, ex.exerciseName),
          };
        }),
        catchError(() => of({ ...ex, baseExercise: null, isExpanded: true, sets: ex.sets || [] } as DisplayLoggedExercise))
      )
    );

    forkJoin(exercisesWithBaseInfo$).subscribe(exercisesWithDetails => {
      const displayItems: DisplayItem[] = [];
      for (const ex of exercisesWithDetails) {
        if (ex.supersetId && !processedSupersetIds.has(ex.supersetId)) {
          processedSupersetIds.add(ex.supersetId);
          const blockExercises = exercisesWithDetails
            .filter(e => e.supersetId === ex.supersetId)
            .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0));

          if (blockExercises.length > 0 && blockExercises[0].supersetType === 'emom') {
            const totalRounds = blockExercises[0].supersetRounds || 0;
            const rounds: EMOMRoundDetail[] = [];
            for (let i = 0; i < totalRounds; i++) {
              const setsForRound = blockExercises.map(bex => bex.sets.find(s => s.supersetCurrentRound === i + 1));
              if (setsForRound.some(s => s !== undefined)) {
                rounds.push({ roundNumber: i + 1, sets: setsForRound });
              }
            }

            const emomBlock: EMOMDisplayBlock = {
              isEmomBlock: true,
              supersetId: ex.supersetId,
              blockName: blockExercises.map(e => e.exerciseName).join(' / '),
              totalRounds: totalRounds,
              emomTimeSeconds: blockExercises[0].emomTimeSeconds || 60,
              exercises: blockExercises,
              rounds: rounds,
              isExpanded: true,
            };
            displayItems.push(emomBlock);
          } else {
            displayItems.push(...blockExercises);
          }
        } else if (!ex.supersetId) {
          displayItems.push(ex);
        }
      }
      this.displayItems.set(displayItems);
      this.fetchPersonalBestsForLog(exercisesWithDetails);
    });
  }

  // --- START: ADDED TYPE GUARD FUNCTION ---
  /**
   * Type guard to check if a DisplayItem is an EMOMDisplayBlock.
   * @param item The item to check.
   * @returns True if the item is an EMOMDisplayBlock.
   */
  isEmomBlock(item: DisplayItem): item is EMOMDisplayBlock {
    return (item as EMOMDisplayBlock).isEmomBlock === true;
  }

  isStandardExercise(item: DisplayItem): item is DisplayLoggedExercise {
      return !('isEmomBlock' in item);
  }
  // --- END: ADDED TYPE GUARD FUNCTION ---

  private fetchPersonalBestsForLog(exercises: DisplayLoggedExercise[]): void {
    const exerciseIds = [...new Set(exercises.map(ex => ex.exerciseId).filter(id => !!id))];
    if (exerciseIds.length === 0) {
      this.personalBestsForLog.set({});
      return;
    }

    const pbObservables = exerciseIds.map(id =>
      this.trackingService.getAllPersonalBestsForExercise(id!).pipe(
        take(1),
        map(pbs => ({ exerciseId: id!, pbs }))
      )
    );

    forkJoin(pbObservables).subscribe(results => {
      const pbMap: Record<string, PersonalBestSet[]> = {};
      results.forEach(result => {
        if (result.pbs.length > 0) {
          pbMap[result.exerciseId] = result.pbs;
        }
      });
      this.personalBestsForLog.set(pbMap);
    });
  }

  getPersonalBestTypesForSet(set: LoggedSet, exerciseId: string): string[] {
    const pbsForExercise = this.personalBestsForLog()[exerciseId];
    if (!pbsForExercise || !set.id) {
      return [];
    }
    const achievedPbTypes: string[] = [];
    for (const currentPb of pbsForExercise) {
      if (currentPb.id === set.id) {
        achievedPbTypes.push(currentPb.pbType);
        continue;
      }
      if (currentPb.history && currentPb.history.length > 0) {
        const wasHistoricPb = currentPb.history.some(historicPb =>
          historicPb.workoutLogId === set.workoutLogId &&
          historicPb.weightUsed === set.weightUsed &&
          historicPb.repsAchieved === set.repsAchieved
        );
        if (wasHistoricPb) {
          achievedPbTypes.push(currentPb.pbType);
        }
      }
    }
    return achievedPbTypes;
  }

  getIconPath(iconName: string | undefined): string {
    return this.exerciseService.getIconPath(iconName);
  }

  toggleExerciseAccordion(item: DisplayItem): void {
    item.isExpanded = !item.isExpanded;
  }

  toggleWarmupAccordion(exercise: DisplayLoggedExercise): void {
    exercise.showWarmups = !exercise.showWarmups;
  }

  getDisplaySetLabel(setsOfType: LoggedSet[], currentIndexInType: number): string {
    const currentSet = setsOfType[currentIndexInType];
    const displayIndex = currentIndexInType + 1;
    let labelPrefix = `Set ${displayIndex}`;
    if (currentSet.type === 'warmup') {
      labelPrefix = `Warm-up ${displayIndex}`;
    } else if (currentSet.type === 'failure') {
      labelPrefix = `Failure Set ${displayIndex}`;
    } else if (currentSet.type === 'dropset') {
      labelPrefix = `Drop Set ${displayIndex}`;
    } else if (currentSet.type === 'amrap') {
      labelPrefix = `AMRAP Set ${displayIndex}`;
    }
    return labelPrefix;
  }

  displayExerciseDetails(id: string): void {
    this.router.navigate(['/library', id]);
  }

  performAction() {
    this.isExerciseDetailModalOpen.set(false);
  }

  openModal(exerciseData: DisplayLoggedExercise, event?: Event) {
    event?.stopPropagation();
    this.exerciseDetailsId = exerciseData.exerciseId;
    this.exerciseDetailsName = exerciseData.exerciseName || 'Exercise details';
    this.isSimpleModalOpen.set(true);
  }

  secondsToDateTime(seconds: number): Date {
    const d = new Date(0, 0, 0, 0, 0, 0, 0);
    d.setSeconds(seconds);
    return d;
  }

  getSetWeightsUsed(loggedEx: LoggedWorkoutExercise): string {
    return loggedEx.sets.map(set => set.weightUsed).join(' - ');
  }

  getSetDurationPerformed(loggedEx: LoggedWorkoutExercise): string {
    return loggedEx.sets.map(set => set.durationPerformed).join(' - ');
  }

  getSetReps(loggedEx: LoggedWorkoutExercise): string {
    return loggedEx?.sets.map(set => set.repsAchieved).join(' - ');
  }

  checkIfTimedExercise(loggedEx: LoggedWorkoutExercise): boolean {
    return loggedEx.sets.some(set => set.targetDuration) || loggedEx?.sets.some(set => set.durationPerformed);
  }

  checkIfWeightedExercise(loggedEx: LoggedWorkoutExercise): boolean {
    return loggedEx?.sets.some(set => set.targetWeight) || loggedEx?.sets.some(set => set.weightUsed);
  }

  checkTextClass(set: LoggedSet, type: 'reps' | 'duration' | 'weight' | 'rest'): string {
    if (!set) {
      return 'text-gray-700 dark:text-gray-300';
    }
    if (type === 'reps') {
      const performed = set.repsAchieved ?? 0;
      const min = set.targetRepsMin;
      const max = set.targetRepsMax;
      if (min != null || max != null) {
        if (min != null && performed < min) return 'text-red-500 dark:text-red-400';
        if (max != null && performed > max) return 'text-green-500 dark:text-green-400';
        return 'text-gray-800 dark:text-white';
      }
    }
    if (type === 'duration') {
      const performed = set.durationPerformed ?? 0;
      const min = set.targetDurationMin;
      const max = set.targetDurationMax;
      if (min != null || max != null) {
        if (min != null && performed < min) return 'text-red-500 dark:text-red-400';
        if (max != null && performed > max) return 'text-green-500 dark:text-green-400';
        return 'text-gray-800 dark:text-white';
      }
    }
    let performedValue = 0;
    let targetValue = 0;
    switch (type) {
      case 'reps':
        performedValue = set.repsAchieved ?? 0;
        targetValue = set.targetReps ?? 0;
        break;
      case 'duration':
        performedValue = set.durationPerformed ?? 0;
        targetValue = set.targetDuration ?? 0;
        break;
      case 'weight':
        performedValue = set.weightUsed ?? 0;
        targetValue = set.targetWeight ?? 0;
        break;
      case 'rest':
        performedValue = set.restAfterSetUsed ?? 0;
        targetValue = set.targetRestAfterSet ?? 0;
        break;
    }
    if (targetValue > 0) {
      if (performedValue > targetValue) return 'text-green-500 dark:text-green-400';
      if (performedValue < targetValue) return 'text-red-500 dark:text-red-400';
    }
    return 'text-gray-800 dark:text-white';
  }

  showComparisonModal(set: LoggedSet, type: 'reps' | 'duration' | 'weight' | 'rest'): void {
    if (!set) return;

    let performedValue: number | undefined;
    let targetValueDisplay: string | undefined;
    let modalData: TargetComparisonData | null = null;
    const unitLabel = this.unitService.getWeightUnitSuffix();

    const createTargetDisplay = (min?: number | null, max?: number | null, single?: number | null, suffix: string = ''): string => {
      if (min != null || max != null) {
        if (min != null && max != null) return min === max ? `${single ?? min}${suffix}` : `${min}-${max}${suffix}`;
        if (min != null) return `${min}+${suffix}`;
        if (max != null) return `Up to ${max}${suffix}`;
      }
      return single != null ? `${single}${suffix}` : '-';
    };

    if (type === 'reps') {
      performedValue = set.repsAchieved;
      targetValueDisplay = createTargetDisplay(set.targetRepsMin, set.targetRepsMax, set.targetReps);
      if ((set.targetRepsMin != null && (performedValue ?? 0) < set.targetRepsMin) || (set.targetRepsMin == null && (performedValue ?? 0) < (set.targetReps ?? 0))) {
        modalData = { metric: 'Reps', targetValue: targetValueDisplay, performedValue: `${performedValue ?? '-'}` };
      }
    } else if (type === 'duration') {
      performedValue = set.durationPerformed;
      targetValueDisplay = createTargetDisplay(set.targetDurationMin, set.targetDurationMax, set.targetDuration, ' s');
      if ((set.targetDurationMin != null && (performedValue ?? 0) < set.targetDurationMin) || (set.targetDurationMin == null && (performedValue ?? 0) < (set.targetDuration ?? 0))) {
        modalData = { metric: 'Duration', targetValue: targetValueDisplay, performedValue: `${performedValue ?? '-'} s` };
      }
    } else if (type === 'weight') {
      performedValue = set.weightUsed;
      targetValueDisplay = set.targetWeight != null ? `${set.targetWeight} ${unitLabel}` : '-';
      if ((performedValue ?? 0) < (set.targetWeight ?? 0)) {
        modalData = { metric: 'Weight', targetValue: targetValueDisplay, performedValue: `${performedValue ?? '-'} ${unitLabel}` };
      }
    } else if (type === 'rest') {
      performedValue = set.restAfterSetUsed;
      targetValueDisplay = set.targetRestAfterSet != null ? `${set.targetRestAfterSet} s` : '-';
      if ((performedValue ?? 0) < (set.targetRestAfterSet ?? 0)) {
        modalData = { metric: 'Rest', targetValue: targetValueDisplay, performedValue: `${performedValue ?? '-'} s` };
      }
    }

    if (modalData) {
      this.comparisonModalData.set(modalData);
    }
  }

  isTargetMissed(set: LoggedSet, type: 'reps' | 'duration' | 'weight' | 'rest'): boolean {
    if (!set) return false;
    if (type === 'reps') {
      const performed = set.repsAchieved ?? 0;
      const min = set.targetRepsMin;
      if (min != null) return performed < min;
      return performed < (set.targetReps ?? 0);
    }
    if (type === 'duration') {
      const performed = set.durationPerformed ?? 0;
      const min = set.targetDurationMin;
      if (min != null) return performed < min;
      return performed < (set.targetDuration ?? 0);
    }
    const performed = (type === 'weight' ? set.weightUsed : set.restAfterSetUsed) ?? 0;
    const target = (type === 'weight' ? set.targetWeight : set.targetRestAfterSet) ?? 0;
    return performed < target && target > 0;
  }

  showNotesModal(notes: string): void {
    this.notesModalsData.set(notes);
  }

  activeRoutineIdActions = signal<string | null>(null);

  toggleActions(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeRoutineIdActions.update(current => (current === routineId ? null : routineId));
  }

  areActionsVisible(routineId: string): boolean {
    return this.activeRoutineIdActions() === routineId;
  }

  onCloseActionMenu() {
    this.activeRoutineIdActions.set(null);
  }

  getLogDropdownActionItems(routineId: string, mode: MenuMode): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';
    const currentLog = this.workoutLog();
    const routineDetailsBtn = {
      label: 'ROUTINE',
      actionKey: 'routine',
      iconName: `routines`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    } as ActionMenuItem;
    const actionsArray: ActionMenuItem[] = [
      {
        label: 'SUMMARY',
        actionKey: 'view',
        iconName: 'eye',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      {
        label: 'EDIT LOG',
        actionKey: 'edit',
        iconName: 'edit',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      routineDetailsBtn,
      { isDivider: true },
      {
        label: 'DELETE',
        actionKey: 'delete',
        iconName: 'trash',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
        data: { routineId }
      }
    ];
    return actionsArray;
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
    const logId = event.data?.routineId;
    if (!logId) return;
    switch (event.actionKey) {
      case 'edit':
        this.router.navigate(['/workout/log/manual/edit', logId]);
        break;
      case 'view':
        this.router.navigate(['/workout/summary', logId]);
        break;
      case 'delete':
        this.deleteLogDetails(logId);
        break;
      case 'routine':
        this.goToRoutineDetails();
        break;
    }
    this.activeRoutineIdActions.set(null);
  }

  createRoutineFromLog(logId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/workout/routine/new-from-log', logId]);
  }

  async goToRoutineDetails(): Promise<void> {
    if (!this.workoutLog() || !this.workoutLog()?.routineId) {
      return;
    }
    const log = this.workoutLog();
    if (log && log.routineId && log.routineId !== '-1') {
      this.router.navigate(['/workout/routine/view/', log.routineId]);
    } else {
      const createNewRoutineFromLog = await this.alertService.showConfirm("No routine for log", "There is no routine associated with this log: would you like to create one? If so remember to link it to this log once created");
      if (log && createNewRoutineFromLog && createNewRoutineFromLog.data) {
        this.createRoutineFromLog(log.id);
      }
      return;
    }
  }

  async deleteLogDetails(logId: string, event?: MouseEvent): Promise<void> {
    const confirm = await this.alertService.showConfirm("Delete Workout Log", "Are you sure you want to delete this workout log? This action cannot be undone", "Delete");
    if (confirm && confirm.data) {
      try {
        this.spinnerService.show(); await this.trackingService.deleteWorkoutLog(logId);
        this.toastService.success("Workout log deleted successfully");
        this.router.navigate(['/history/list']);
      } catch (err) { this.toastService.error("Failed to delete workout log"); }
      finally { this.spinnerService.hide(); }
    }
  }

  showBackToTopButton = signal<boolean>(false);
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const verticalOffset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    this.showBackToTopButton.set(verticalOffset > 400);
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }

  checkIfLogForProgram(): boolean {
    return !!(this.workoutLog()?.programId);
  }

  getLogTitleForProgramEntry(): string {
    if (this.checkIfLogForProgram()) {
      const program = this.availablePrograms.find(p => p.id === this.workoutLog()?.programId);
      if (program) {
        return `Log for Program: ${program.name}${this.weekName() ? ' - ' + this.weekName() : ''}${this.dayInfo() ? ' - Day ' + this.dayInfo()?.dayNumber : ''}`;
      }
    }
    return 'Ad-hoc Workout';
  }

  protected hasPerformedTimedSets(loggedEx: DisplayLoggedExercise): boolean {
    return loggedEx?.sets?.some(set => set.durationPerformed != null && set.durationPerformed > 0) ?? false;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }


  getExerciseItemClasses(item: DisplayLoggedExercise): { [klass: string]: boolean } {
    const obj = {
      'border border-gray-200 dark:border-gray-600 rounded-md my-4': !item.supersetId,
      'border-l border-r border-teal-400 dark:border-teal-600': !!item.supersetId && item.supersetType === 'emom',
      'bg-teal-50 dark:bg-teal-900/20': !!item.supersetId && item.supersetType === 'emom',
      'border-l border-r border-orange-400 dark:border-orange-600': !!item.supersetId && item.supersetType !== 'emom',
      'bg-orange-50 dark:bg-orange-900/20': !!item.supersetId && item.supersetType !== 'emom',
      'rounded-t-lg border-t': !!item.supersetId && item.supersetOrder === 0,
      'rounded-b-lg border-b': !!item.supersetId && item.supersetOrder === ((item.supersetSize ?? 0) - 1),
      'mb-3': !!item.supersetId && item.supersetOrder === (item.supersetSize ?? 0) - 1,
    };

    return obj;
  }
}