// workout-log-detail.ts
import { Component, HostListener, inject, Input, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin, Observable, of, Subscription } from 'rxjs';
import { map, switchMap, tap, catchError, take } from 'rxjs/operators';
import { Exercise } from '../../../core/models/exercise.model';
import { LoggedWorkoutExercise, WorkoutLog, LoggedSet, PersonalBestSet } from '../../../core/models/workout-log.model';
import { TrackingService } from '../../../core/services/tracking.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import { WeightUnitPipe } from '../../../shared/pipes/weight-unit-pipe';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ExerciseDetailComponent } from '../../exercise-library/exercise-detail';
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
import { PerformanceComparisonModalComponent } from './performance-comparison-modal/performance-comparison-modal.component';
import { FabAction, FabMenuComponent } from '../../../shared/components/fab-menu/fab-menu.component';

export interface DisplayLoggedExercise extends LoggedWorkoutExercise {
  baseExercise?: Exercise | null;
  isExpanded?: boolean;
  iconName?: string;
}

interface SupersetRound {
  isSupersetRound: true; // Type guard for the template
  supersetId: string;
  roundNumber: number;
  totalRounds: number;
  exercises: DisplayLoggedExercise[]; // Exercises performed *only* in this round
  isExpanded: boolean;
}

interface SupersetDisplayBlock {
  isSupersetBlock: true; // Type guard
  supersetId: string;
  blockName: string; // e.g., "Bench Press / Dumbbell Fly"
  totalRounds: number;
  // Contains the definitions of exercises in the block for header info
  exercises: DisplayLoggedExercise[];
  // Contains the actual performance data, grouped by round
  rounds: {
    roundNumber: number;
    exercisesForRound: DisplayLoggedExercise[];
  }[];
  isExpanded: boolean;
}

interface EMOMDisplayBlock {
  isEmomBlock: true;
  supersetId: string;
  blockName: string;
  totalRounds: number;
  emomTimeSeconds: number;
  exercises: DisplayLoggedExercise[];
  rounds: { roundNumber: number, sets: (LoggedSet | undefined)[] }[];
  isExpanded: boolean;
}

type DisplayItem = DisplayLoggedExercise | SupersetDisplayBlock | EMOMDisplayBlock;

interface TargetComparisonData {
  metric: 'Reps' | 'Duration' | 'Weight' | 'Rest' | 'Distance';
  targetValue: string;
  performedValue: string;
}

@Component({
  selector: 'app-workout-log-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, ModalComponent, ExerciseDetailComponent,
    IsWeightedPipe, ActionMenuComponent, PressDirective, IconComponent, TooltipDirective, WeightUnitPipe, PerformanceComparisonModalComponent, FabMenuComponent],
  templateUrl: './workout-log-detail.html',
  providers: [DecimalPipe]
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

  constructor() { }

  async ngOnInit(): Promise<void> {
    this.subscriptions.add(
      this.trainingService.programs$.pipe(take(1)).subscribe(programs => {
        this.availablePrograms = programs;
      })
    );

    this.subscriptions.add(
      this.route.paramMap.pipe(
        map(params => params.get('logId')),

        // MODIFIED: Call the single, comprehensive reset method.
        tap(() => this.resetComponentState()),

        switchMap(id => id ? this.trackingService.getWorkoutLogById(id) : of(null)),

        tap(async (log) => {
          this.workoutLog.set(log);
          if (log?.exercises?.length) {
            this.prepareDisplayExercises(log.exercises);
            await this.enrichLoggedExercisesWithTargets();
            this.trainingService.getWeekNameForLog(log).pipe(take(1)).subscribe(name => this.weekName.set(name));
            this.trainingService.getDayOfWeekForLog(log).pipe(take(1)).subscribe(info => this.dayInfo.set(info));
          }
        }),

        catchError(err => {
          console.error("Error fetching workout log:", err);
          this.workoutLog.set(null);
          // Also reset here in case of error
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

    log.exercises.forEach(loggedEx => {
      const routineEx = routineExerciseMap.get(loggedEx.id);
      loggedEx.sets.forEach((set, i) => {
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
        set.targetRestAfterSet = set.targetRestAfterSet ?? routineExerciseSet?.restAfterSet;
      });
    });
    this.workoutLog.set({ ...log });
  }

  private prepareDisplayExercises(loggedExercises: LoggedWorkoutExercise[]): void {
    const processedSupersetIds = new Set<string>();
    const exercisesWithBaseInfo$ = loggedExercises.map(ex =>
      this.exerciseService.getExerciseById(ex.exerciseId).pipe(
        map(baseEx => ({
          ...ex,
          baseExercise: baseEx || null,
          isExpanded: true,
          iconName: this.exerciseService.determineExerciseIcon(baseEx ?? null, ex.exerciseName),
        })),
        catchError(() => of({ ...ex, baseExercise: null, isExpanded: true } as DisplayLoggedExercise))
      )
    );

    forkJoin(exercisesWithBaseInfo$).subscribe(exercisesWithDetails => {
      const displayItems: DisplayItem[] = [];

      for (const ex of exercisesWithDetails) {
        if (ex.supersetId && !processedSupersetIds.has(ex.supersetId)) {
          processedSupersetIds.add(ex.supersetId);

          const blockExercises = exercisesWithDetails.filter(e => e.supersetId === ex.supersetId);
          if (blockExercises.length === 0) continue;

          const firstInBlock = blockExercises[0];
          const totalRounds = firstInBlock.sets.length || 1;
          const blockName = blockExercises
            .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0))
            .map(e => e.exerciseName)
            .join(' / ');

          if (firstInBlock.supersetType === 'emom') {
            const rounds = Array.from({ length: totalRounds }, (_, i) => ({
              roundNumber: i + 1,
              sets: blockExercises.map(bex => bex.sets.find((s, index) => index === i))
            })).filter(r => r.sets.some(s => s !== undefined));

            displayItems.push({
              isEmomBlock: true,
              supersetId: ex.supersetId,
              blockName,
              totalRounds,
              emomTimeSeconds: firstInBlock.emomTimeSeconds || 60,
              exercises: blockExercises,
              rounds,
              isExpanded: true,
            });
          } else {
            // STANDARD SUPERSET: Group all rounds into a single block
            const rounds = Array.from({ length: totalRounds }, (_, i) => {
              const roundNumber = i + 1;
              const exercisesForRound = blockExercises
                .map(e => {
                  // Find the set for this round
                  const setForRound = e.sets.find((s, index) => (index ?? -1) + 1 === roundNumber);
                  if (setForRound) {
                    // Return a shallow copy with only the set for this round
                    return {
                      ...e,
                      sets: [setForRound]
                    };
                  }
                  return null;
                })
                .filter(e => e !== null)
                .sort((a, b) => (a!.supersetOrder ?? 0) - (b!.supersetOrder ?? 0)) as DisplayLoggedExercise[];
              return { roundNumber, exercisesForRound };
            }).filter(r => r.exercisesForRound.length > 0);

            if (rounds.length > 0) {
              displayItems.push({
                isSupersetBlock: true,
                supersetId: ex.supersetId,
                blockName,
                totalRounds,
                exercises: blockExercises,
                rounds,
                isExpanded: true,
              });
            }
          }
        } else if (!ex.supersetId) {
          displayItems.push(ex);
        }
      }

      this.displayItems.set(displayItems);
      this.fetchPersonalBestsForLog(exercisesWithDetails);
    });
  }

  isEmomBlock(item: DisplayItem): item is EMOMDisplayBlock {
    return 'isEmomBlock' in item;
  }

  isSupersetBlock(item: DisplayItem): item is SupersetDisplayBlock {
    return 'isSupersetBlock' in item;
  }

  isStandardExercise(item: DisplayItem): item is DisplayLoggedExercise {
    return !('isEmomBlock' in item) && !('isSupersetBlock' in item);
  }

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
        if (result.pbs.length > 0) pbMap[result.exerciseId] = result.pbs;
      });
      this.personalBestsForLog.set(pbMap);
    });
  }

  getPersonalBestTypesForSet(set: LoggedSet, exerciseId: string): string[] {
    const pbsForExercise = this.personalBestsForLog()[exerciseId];
    if (!pbsForExercise || !set.id) return [];

    const achievedPbTypes: string[] = [];
    for (const currentPb of pbsForExercise) {
      if (currentPb.id === set.id) {
        achievedPbTypes.push(currentPb.pbType);
        continue;
      }
      if (currentPb.history?.some(h => h.workoutLogId === set.workoutLogId && h.weightUsed === set.weightUsed && h.repsAchieved === set.repsAchieved)) {
        achievedPbTypes.push(currentPb.pbType);
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

  openModal(exerciseData: DisplayLoggedExercise, event?: Event) {
    event?.stopPropagation();
    this.exerciseDetailsId = exerciseData.exerciseId;
    this.exerciseDetailsName = exerciseData.exerciseName || 'Exercise details';
    this.isSimpleModalOpen.set(true);
  }

  secondsToDateTime(totalSeconds: number | undefined): Date {
    if (totalSeconds == null || isNaN(totalSeconds)) {
      // Return a date that will format to 00:00:00
      const zeroDate = new Date(0);
      // Using UTC setters ensures we start from a clean 00:00:00 base
      zeroDate.setUTCHours(0, 0, 0, 0);
      return zeroDate;
    }

    const d = new Date(0);

    // The setHours method can accept (hours, minutes, seconds, ms).
    // By setting hours and minutes to 0, we are purely representing the duration
    // in the time part of the Date object without timezone interference.
    d.setHours(0, 0, totalSeconds, 0);

    return d;
  }


  getSetWeightsUsed(loggedEx: LoggedWorkoutExercise): string {
    let stringResult = loggedEx.sets.map(set => set.weightUsed).join(' - ');
    if (stringResult.length > 15) {
      stringResult = stringResult.substring(0, 15) + '...';
    }
    return stringResult;
  }

  getSetDurationPerformed(loggedEx: LoggedWorkoutExercise): string {
    return loggedEx.sets.map(set => set.durationPerformed).join(' - ');
  }

  getSetReps(loggedEx: LoggedWorkoutExercise): string {
    return loggedEx?.sets.map(set => set.repsAchieved).join(' - ');
  }

  checkIfTimedExercise(loggedEx: LoggedWorkoutExercise): boolean {
    return loggedEx.sets.some(set => set.durationPerformed);
  }

  checkIfWeightedExercise(loggedEx: LoggedWorkoutExercise): boolean {
    return loggedEx?.sets.some(set => set.weightUsed);
  }

  checkTextClass(set: LoggedSet, type: 'reps' | 'duration' | 'weight' | 'rest' | 'distance'): string {
    if (!set) return 'text-gray-700 dark:text-gray-300';

    const checkRange = (performed: number, min?: number | null, max?: number | null) => {
      if (min != null && performed < min) return 'text-red-500 dark:text-red-400';
      if (max != null && performed > max) return 'text-green-500 dark:text-green-400';
      return 'text-gray-800 dark:text-white';
    };

    if (type === 'reps' && (set.targetRepsMin != null || set.targetRepsMax != null)) {
      return checkRange(set.repsAchieved ?? 0, set.targetRepsMin, set.targetRepsMax);
    }
    if (type === 'duration' && (set.targetDurationMin != null || set.targetDurationMax != null)) {
      return checkRange(set.durationPerformed ?? 0, set.targetDurationMin, set.targetDurationMax);
    }
    if (type === 'distance' && (set.targetDistanceMin != null || set.targetDistanceMax != null)) {
      return checkRange(set.distanceAchieved ?? 0, set.targetDistanceMin, set.targetDistanceMax);
    }

    const performed = type === 'reps' ? set.repsAchieved : type === 'duration' ? set.durationPerformed : type === 'weight' ? set.weightUsed : type === 'distance' ? set.distanceAchieved : set.restAfterSetUsed;
    const target = type === 'reps' ? set.targetReps : type === 'duration' ? set.targetDuration : type === 'weight' ? set.targetWeight : type === 'distance' ? set.targetDistance : set.targetRestAfterSet;

    if ((target ?? 0) > 0) {
      if ((performed ?? 0) > target!) return 'text-green-500 dark:text-green-400';
      if ((performed ?? 0) < target!) return 'text-red-500 dark:text-red-400';
    }
    return 'text-gray-800 dark:text-white';
  }

  showComparisonModal(set: LoggedSet, type: 'reps' | 'duration' | 'weight' | 'rest' | 'distance'): void {
    if (!set) return;

    let modalData: TargetComparisonData | null = null;
    const unitLabel = this.unitService.getWeightUnitSuffix();
    const distUnitLabel = this.unitService.getDistanceMeasureUnitSuffix();

    const createTargetDisplay = (min?: number | null, max?: number | null, single?: number | null, suffix = ''): string => {
      if (min != null || max != null) {
        if (min != null && max != null) return min === max ? `${single ?? min}${suffix}` : `${min}-${max}${suffix}`;
        if (min != null) return `${min}+${suffix}`;
        if (max != null) return `Up to ${max}${suffix}`;
      }
      return single != null ? `${single}${suffix}` : '-';
    };

    const isMiss = (performed: number, min?: number | null, single?: number | null) => (min != null && performed < min) || (min == null && performed < (single ?? 0));

    switch (type) {
      case 'reps':
        const performedReps = set.repsAchieved;
        if (isMiss(performedReps ?? 0, set.targetRepsMin, set.targetReps)) {
          modalData = { metric: 'Reps', targetValue: createTargetDisplay(set.targetRepsMin, set.targetRepsMax, set.targetReps), performedValue: `${performedReps ?? '-'}` };
        }
        break;
      case 'duration':
        const performedDuration = set.durationPerformed;
        if (isMiss(performedDuration ?? 0, set.targetDurationMin, set.targetDuration)) {
          modalData = { metric: 'Duration', targetValue: createTargetDisplay(set.targetDurationMin, set.targetDurationMax, set.targetDuration, ' s'), performedValue: `${performedDuration ?? '-'} s` };
        }
        break;
      case 'weight':
        const performedWeight = set.weightUsed;
        if ((performedWeight ?? 0) < (set.targetWeight ?? 0)) {
          modalData = { metric: 'Weight', targetValue: `${set.targetWeight ?? '-'} ${unitLabel}`, performedValue: `${performedWeight ?? '-'} ${unitLabel}` };
        }
        break;
      case 'rest':
        const performedRest = set.restAfterSetUsed;
        if ((performedRest ?? 0) < (set.targetRestAfterSet ?? 0)) {
          modalData = { metric: 'Rest', targetValue: `${set.targetRestAfterSet ?? '-'} s`, performedValue: `${performedRest ?? '-'} s` };
        }
        break;
      case 'distance':
        const performedDistance = set.distanceAchieved;
        if (isMiss(performedDistance ?? 0, set.targetDistanceMin, set.targetDistance)) {
          modalData = { metric: 'Distance', targetValue: createTargetDisplay(set.targetDistanceMin, set.targetDistanceMax, set.targetDistance, ` ${distUnitLabel}`), performedValue: `${performedDistance ?? '-'} ${distUnitLabel}` };
        }
        break;
    }
    if (modalData) this.comparisonModalData.set(modalData);
  }

  isTargetMissed(set: LoggedSet, type: 'reps' | 'duration' | 'weight' | 'rest' | 'distance'): boolean {
    if (!set) return false;
    if (type === 'reps') {
      const performed = set.repsAchieved ?? 0;
      return (set.targetRepsMin != null) ? performed < set.targetRepsMin : performed < (set.targetReps ?? 0);
    }
    if (type === 'duration') {
      const performed = set.durationPerformed ?? 0;
      return (set.targetDurationMin != null) ? performed < set.targetDurationMin : performed < (set.targetDuration ?? 0);
    }
    if (type === 'distance') {
      const performed = set.distanceAchieved ?? 0;
      return (set.targetDistanceMin != null) ? performed < set.targetDistanceMin : performed < (set.targetDistance ?? 0);
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
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';
    return [
      { label: 'SUMMARY', actionKey: 'view', iconName: 'eye', buttonClass: `${mode === 'dropdown' ? 'w-full ' : ''}${defaultBtnClass}`, data: { routineId } },
      { label: 'EDIT LOG', actionKey: 'edit', iconName: 'edit', buttonClass: `${mode === 'dropdown' ? 'w-full ' : ''}${defaultBtnClass}`, data: { routineId } },
      { label: 'ROUTINE', actionKey: 'routine', iconName: 'routines', buttonClass: `${mode === 'dropdown' ? 'w-full ' : ''}${defaultBtnClass}`, data: { routineId } },
      { isDivider: true },
      { label: 'DELETE', actionKey: 'delete', iconName: 'trash', buttonClass: `${mode === 'dropdown' ? 'w-full ' : ''}${deleteBtnClass}`, data: { routineId } }
    ];
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }): void {
    const logId = event.data?.routineId;
    if (!logId) return;
    switch (event.actionKey) {
      case 'edit': this.router.navigate(['/workout/log/manual/edit', logId]); break;
      case 'view': this.router.navigate(['/workout/summary', logId]); break;
      case 'delete': this.deleteLogDetails(logId); break;
      case 'routine': this.goToRoutineDetails(); break;
    }
    this.activeRoutineIdActions.set(null);
  }

  async goToRoutineDetails(): Promise<void> {
    const log = this.workoutLog();
    if (log?.routineId && log.routineId !== '-1') {
      this.router.navigate(['/workout/routine/view/', log.routineId]);
    } else {
      const confirm = await this.alertService.showConfirm("No routine for log", "There is no routine associated with this log: would you like to create one? If so remember to link it to this log once created");
      if (log && confirm?.data) {
        this.router.navigate(['/workout/routine/new-from-log', log.id]);
      }
    }
  }

  async deleteLogDetails(logId: string): Promise<void> {
    const confirm = await this.alertService.showConfirm("Delete Workout Log", "Are you sure you want to delete this workout log? This action cannot be undone.", "Delete");
    if (confirm?.data) {
      try {
        this.spinnerService.show();
        await this.trackingService.deleteWorkoutLog(logId);
        this.toastService.success("Workout log deleted successfully");
        this.router.navigate(['/history/list']);
      } catch (err) {
        this.toastService.error("Failed to delete workout log");
      } finally {
        this.spinnerService.hide();
      }
    }
  }

  showBackToTopButton = signal<boolean>(false);
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    this.showBackToTopButton.set(window.pageYOffset > 400);
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  checkIfLogForProgram(): boolean {
    return !!this.workoutLog()?.programId;
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
    return loggedEx?.sets?.some(set => (set.durationPerformed ?? 0) > 0) ?? false;
  }

    protected hasPerformedReps(loggedEx: DisplayLoggedExercise): boolean {
    return loggedEx?.sets?.some(set => (set.repsAchieved ?? 0) > 0) ?? false;
  }

  protected emomLabel(exercise: EMOMDisplayBlock): string {
    const rounds = exercise.totalRounds || 1;
    let roundString = rounds > 1 ? ` (${rounds} ROUNDS)` : ` (${rounds} ROUND)`;

    return `EMOM${roundString} - Every ${exercise.emomTimeSeconds || 60}s`;
  }

  protected exerciseNameDisplay(exercise: DisplayLoggedExercise): string {
    if (!exercise || !exercise.exerciseName) return 'Unnamed Exercise';

    let tmpExerciseStringName = exercise.exerciseName.trim();
    // if exercise.exerciseName contains kettlebell return the same name but substitute kettlebell with KB
    if (/kettlebell/i.test(tmpExerciseStringName)) {
      tmpExerciseStringName = tmpExerciseStringName.replace(/kettlebell/gi, 'KB');
    }
    if (/kb/i.test(tmpExerciseStringName)) {
      tmpExerciseStringName = tmpExerciseStringName.replace(/overhead/gi, 'OH');
    }
    if (/alternating/i.test(tmpExerciseStringName)) {
      tmpExerciseStringName = tmpExerciseStringName.replace(/alternating/gi, 'ALT.');
    }


    return tmpExerciseStringName || exercise.baseExercise?.name || 'Unnamed Exercise';
  }

  isPerformanceComparisonModalOpen = signal(false);
  selectedExerciseForComparison = signal<DisplayLoggedExercise | null>(null);

  /**
   * Opens the performance comparison modal.
   * If an exercise is provided, it compares that single exercise.
   * If no exercise is provided, it compares the entire routine.
   */
  openPerformanceComparisonModal(exercise?: DisplayLoggedExercise, event?: Event): void {
    event?.stopPropagation(); // Prevents the accordion from toggling when clicking the icon

    // Set the exercise signal. It will be the specific exercise or null for a routine comparison.
    this.selectedExerciseForComparison.set(exercise ?? null);

    // Open the modal
    this.isPerformanceComparisonModalOpen.set(true);
  }

  goToPreviousLogDetail(logId: string | undefined): void {
    if (!logId) return;

    this.workoutService.vibrate();
    this.isPerformanceComparisonModalOpen.set(false);
    this.router.navigate(['/history/log', logId]);
  }

  private resetComponentState(): void {
    window.scrollTo(0, 0);

    // Reset core data signals
    this.workoutLog.set(undefined);
    this.displayItems.set([]);
    this.personalBestsForLog.set({});
    this.weekName.set(null);
    this.dayInfo.set(null);

    // Reset action menu state
    this.activeRoutineIdActions.set(null);

    // Reset ALL modal-related states to their initial values
    this.comparisonModalData.set(null);
    this.notesModalsData.set(null);
    this.isSimpleModalOpen.set(false);
    this.isPerformanceComparisonModalOpen.set(false);
    this.selectedExerciseForComparison.set(null);
    this.exerciseDetailsId = '';
    this.exerciseDetailsName = '';
  }

  /**
   * Calculates the appropriate Tailwind CSS grid class based on which metrics are present.
   * This handles all combinations, including weighted cardio.
   * @param item The exercise to analyze.
   * @returns A string like 'grid-cols-5', 'grid-cols-6', etc.
   */
  protected getGridColsClass(item: DisplayLoggedExercise): string {
    // Base columns are always present: Set, Reps, Rest, Notes
    let cols = 2;

    // Conditionally add a column for each additional metric found
    if (this.hasPerformedReps(item)) cols++;
    if (this.isWeighted(item)) cols++;
    if (this.hasPerformedTimedSets(item)) cols++;
    if (this.hasPerformedDistanceSets(item)) cols++;
    if (this.hasNotes(item)) cols++;

    return `grid-cols-${cols}`;
  }

  // +++ NEW: Helper method specifically for distance +++
  protected hasPerformedDistanceSets(loggedEx: DisplayLoggedExercise): boolean {
    return loggedEx?.sets?.some(set => (set.distanceAchieved ?? 0) > 0) ?? false;
  }

  protected hasNotes(loggedEx: DisplayLoggedExercise): boolean {
    return loggedEx?.sets?.some(set => (set.notes ?? undefined)) ?? false;
  }

  // +++ NEW: Replicated pipe logic as a component method for consistency +++
  protected isWeighted(loggedEx: DisplayLoggedExercise): boolean {
    return loggedEx?.sets?.some(set => set.weightUsed != null && set.weightUsed > 0) ?? false;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}