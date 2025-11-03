// workout-log-detail.ts
import { afterNextRender, Component, HostListener, inject, Injector, Input, OnDestroy, OnInit, PLATFORM_ID, runInInjectionContext, signal } from '@angular/core';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DistanceTarget, DistanceTargetType, DurationTarget, DurationTargetType, METRIC, RepsTarget, RepsTargetType, RestTarget, RestTargetType, WeightTarget, WeightTargetType, WorkoutExercise } from '../../../core/models/workout.model';
import { BumpClickDirective } from '../../../shared/directives/bump-click.directive';
import { repsTargetAsString, repsTypeToReps, genRepsTypeFromRepsNumber, getRepsValue, getDurationValue, getDistanceValue, getWeightValue, getRestValue, restTargetAsString, distanceTargetAsString, durationTargetAsString, weightTargetAsString } from '../../../core/services/workout-helper.service';

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
    totalExercisesForRound: number;
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
  metric: METRIC;
  targetValue: string;
  performedValue: string;
}

@Component({
  selector: 'app-workout-log-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, ModalComponent, ExerciseDetailComponent,
    ActionMenuComponent, PressDirective, IconComponent, TooltipDirective, WeightUnitPipe, PerformanceComparisonModalComponent, FabMenuComponent, TranslateModule,
    BumpClickDirective],
  templateUrl: './workout-log-detail.html',
  providers: [DecimalPipe]
})
export class WorkoutLogDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  protected trackingService = inject(TrackingService);
  private exerciseService = inject(ExerciseService);
  protected workoutService = inject(WorkoutService);
  protected unitService = inject(UnitsService);
  private alertService = inject(AlertService);
  private spinnerService = inject(SpinnerService);
  private toastService = inject(ToastService);
  private platformId = inject(PLATFORM_ID);
  private trainingService = inject(TrainingProgramService);
  private injector = inject(Injector);
  protected translate = inject(TranslateService);


  comparisonModalData = signal<TargetComparisonData | null>(null);
  notesModalsData = signal<string | null>(null);
  isExerciseDetailModalOpen = signal(false);
  exerciseDetailsId: string = '';
  exerciseDetailsName: string = '';

  workoutLog = signal<WorkoutLog | null | undefined>(undefined);
  displayItems = signal<DisplayItem[]>([]);
  personalBestsForLog = signal<Record<string, PersonalBestSet[]>>({});

  @Input() logId?: string;
  exerciseInfoTooltipString = this.translate.instant('workoutBuilder.exerciseInfoTooltip');

  private subscriptions = new Subscription();
  availablePrograms: TrainingProgram[] = [];

  weekName = signal<string | null>(null);
  dayInfo = signal<ProgramDayInfo | null>(null);
  private allExercisesMap = new Map<string, Exercise>();

  constructor() { }

  async ngOnInit(): Promise<void> {
    this.subscriptions.add(
      this.trainingService.programs$.pipe(take(1)).subscribe(programs => {
        this.availablePrograms = programs;
      })
    );

    this.subscriptions.add(
      this.exerciseService.getExercises().pipe(
        take(1),
        tap(exercises => {
          // Keep the original map for non-translated details like icons, categories etc.
          exercises.forEach(ex => this.allExercisesMap.set(ex.id, ex));
        }),
        switchMap(() => this.route.paramMap),
        map(params => params.get('logId')),
        // MODIFIED: Call the single, comprehensive reset method.
        tap(() => this.resetComponentState()),
        switchMap(id => id ? this.trackingService.getWorkoutLogById(id) : of(null)),
        // Use switchMap to handle the async translation process cleanly
        switchMap(log => {
          if (!log || !log.exercises?.length) {
            // If no log or no exercises, just pass the log through
            return of({ log, translatedExercises: new Map<string, Exercise>() });
          }

          // Create a list of base exercises from the log to be translated
          const exercisesToTranslate = log.exercises
            .map(loggedEx => this.allExercisesMap.get(loggedEx.exerciseId))
            .filter((ex): ex is Exercise => !!ex);

          // Return an observable that emits both the log and the translated exercises map
          return this.exerciseService.getTranslatedExerciseList(exercisesToTranslate).pipe(
            map(translated => {
              const translatedMap = new Map(translated.map(ex => [ex.id, ex]));
              return { log, translatedExercises: translatedMap };
            })
          );
        }),
        tap(async ({ log, translatedExercises }) => {
          // if (log?.startTime){
          //   log.startTime = log.startTime.toLocaleString();
          // }
          this.workoutLog.set(log);
          if (log?.exercises?.length) {
            // Pass the translated map to the display preparation method
            this.prepareDisplayExercises(log.exercises, translatedExercises);
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
        set.repsLogged = set.repsLogged ?? routineExerciseSet?.targetReps;
        set.targetDuration = set.targetDuration ?? routineExerciseSet?.targetDuration;
        set.targetWeight = set.targetWeight ?? routineExerciseSet?.targetWeight;
        set.targetRest = set.targetRest ?? routineExerciseSet?.targetRest;
      });
    });
    this.workoutLog.set({ ...log });
  }

  private prepareDisplayExercises(loggedExercises: LoggedWorkoutExercise[], translatedExercisesMap: Map<string, Exercise>): void {
    const processedSupersetIds = new Set<string>();

    const exercisesWithDetails: DisplayLoggedExercise[] = loggedExercises.map(ex => {
      // Get the original, untranslated base exercise for non-name properties
      const baseEx = this.allExercisesMap.get(ex.exerciseId) || null;
      // Get the translated exercise for the name
      const translatedEx = translatedExercisesMap.get(ex.exerciseId);

      return {
        ...ex,
        // Prioritize the translated name, falling back to the name stored in the log
        exerciseName: translatedEx?.name || ex.exerciseName,
        baseExercise: baseEx,
        isExpanded: true,
        iconName: this.exerciseService.determineExerciseIcon(baseEx, ex.exerciseName),
      };
    });

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
            const totalExercisesForRound = blockExercises.length
            return { roundNumber, exercisesForRound, totalExercisesForRound };
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
      if (currentPb.history?.some(h => h.workoutLogId === set.workoutLogId && h.weightLogged === set.weightLogged && h.repsLogged === set.repsLogged)) {
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
    this.isExerciseDetailModalOpen.set(true);
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
    let stringResult = loggedEx.sets.map(set => set.weightLogged).join(' - ');
    if (stringResult.length > 15) {
      stringResult = stringResult.substring(0, 15) + '...';
    }
    return stringResult;
  }

  getSetdurationLogged(loggedEx: LoggedWorkoutExercise): string {
    return loggedEx.sets.map(set => set.durationLogged).join(' - ');
  }

  getSetReps(loggedEx: LoggedWorkoutExercise): string {
    return loggedEx?.sets.map(set => set.repsLogged).join(' - ');
  }

  checkIfDurationAvailable(loggedEx: LoggedWorkoutExercise): boolean {
    return loggedEx.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.duration) && (set.durationLogged !== undefined && set.durationLogged !== null) && getDurationValue(set.durationLogged) > 0);
  }

  checkIfRepsAvailable(loggedEx: DisplayLoggedExercise): boolean {
    return loggedEx?.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.reps) && (set.repsLogged !== undefined && set.repsLogged !== null) && repsTypeToReps(set.repsLogged) >= 0);
  }

  checkIfDistanceAvailable(loggedEx: DisplayLoggedExercise): boolean {
    return loggedEx?.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.distance) && (set.distanceLogged !== undefined && set.distanceLogged !== null) && getDistanceValue(set.distanceLogged) >= 0);
  }

  checkIfWeightAvailable(loggedEx: LoggedWorkoutExercise): boolean {
    return loggedEx?.sets.some(set => set.fieldOrder && set.fieldOrder.includes(METRIC.weight) && (set.weightLogged !== undefined && set.weightLogged !== null) && getWeightValue(set.weightLogged) >= 0);
  }

  protected checkRange(performed: number | string, min?: number | string | null, max?: number | string | null): string {
    const numericPerformed = typeof performed === 'string' ? parseFloat(performed) : performed;
    const numericMin = typeof min === 'string' ? parseFloat(min) : min;
    const numericMax = typeof max === 'string' ? parseFloat(max) : max;

    if (isNaN(numericPerformed)) {
      // Handle cases where 'performed' is not a valid number string or number
      return 'text-gray-800 dark:text-white'; // Or throw an error, or a specific error class
    }

    if (numericMin != null && numericPerformed < numericMin) {
      return 'text-red-500 dark:text-red-400';
    }
    if (numericMax != null && numericPerformed > numericMax) {
      return 'text-green-500 dark:text-green-400';
    }
    return 'text-gray-800 dark:text-white';
  }

  checkTextClass(set: LoggedSet, type: METRIC): string {
    if (!set) return 'text-gray-700 dark:text-gray-300';



    const setReps: any = { ...set };
    if (type === METRIC.reps) {
      return this.checkRange(repsTypeToReps(set.repsLogged) ?? 0, setReps.targetReps.min, setReps.targetReps.max);
    }
    if (type === METRIC.duration) {
      return this.checkRange(getDurationValue(set.durationLogged) ?? 0, setReps.targetDuration.min, setReps.targetDuration.max);
    }
    if (type === METRIC.distance) {
      return this.checkRange(getDistanceValue(set.distanceLogged) ?? 0, setReps.targetDistance.min, setReps.targetDistance.max);
    }
    if (type === METRIC.weight) {
      return this.checkRange(getWeightValue(set.weightLogged) ?? 0, setReps.targetWeight.min, setReps.targetWeight.max);
    }
    if (type === METRIC.rest) {
      return this.checkRange(getRestValue(set.restLogged) ?? 0, setReps.targetRest.min, setReps.targetRest.max);
    }

    return 'text-gray-800 dark:text-white';
  }

  showComparisonModal(set: LoggedSet, type: METRIC): void {
    if (!set) return;

    let modalData: TargetComparisonData | null = null;
    const unitLabel = this.unitService.getWeightUnitSuffix();
    const distUnitLabel = this.unitService.getDistanceMeasureUnitSuffix();

    // The old `createTargetDisplay` helper is no longer needed and can be removed.

    switch (type) {
      case METRIC.reps:
        modalData = {
          metric: type,
          targetValue: repsTargetAsString(set.targetReps) || '-',
          performedValue: repsTargetAsString(set.repsLogged) || '-'
        };
        break;

      case METRIC.weight:
        const targetWeightStr = weightTargetAsString(set.targetWeight);
        modalData = {
          metric: type,
          // Add the unit only if the value is not a textual one like "Bodyweight"
          targetValue: targetWeightStr ? `${targetWeightStr}${unitLabel}` : '-',
          performedValue: set.weightLogged != null ? `${set.weightLogged}${unitLabel}` : '-'
        };
        break;

      case METRIC.duration:
        modalData = {
          metric: type,
          targetValue: durationTargetAsString(set.targetDuration) || '-',
          performedValue: set.durationLogged != null ? `${set.durationLogged}s` : '-'
        };
        break;

      case METRIC.distance:
        const targetDistanceStr = distanceTargetAsString(set.targetDistance);
        modalData = {
          metric: type,
          targetValue: targetDistanceStr ? `${targetDistanceStr}${distUnitLabel}` : '-',
          performedValue: set.distanceLogged != null ? `${set.distanceLogged}${distUnitLabel}` : '-'
        };
        break;

      case METRIC.rest:
        modalData = {
          metric: type,
          targetValue: restTargetAsString(set.targetRest) || '-',
          performedValue: set.restLogged != null ? `${set.restLogged}s` : '-'
        };
        break;
    }

    if (modalData) this.comparisonModalData.set(modalData);
  }

  /**
 * Checks if a logged set's performance for a specific metric deviates
 * from its planned target.
 * @param set The LoggedSet to check.
 * @param type The METRIC to compare.
 * @returns True if the performance is different from the target.
 */
  protected isTargetDifferent(set: LoggedSet, type: METRIC): boolean {
    if (!set) return false;

    switch (type) {
      case METRIC.reps:
        // The performed value is a number, the target is a RepsTarget object.
        return this.isPerformanceDifferentFromTarget(getRepsValue(set.repsLogged), set.targetReps);

      case METRIC.weight:
        // The performed value is a number, the target is a WeightTarget object.
        return this.isPerformanceDifferentFromTarget(getWeightValue(set.weightLogged), set.targetWeight);

      case METRIC.duration:
        return this.isPerformanceDifferentFromTarget(getDurationValue(set.durationLogged), set.targetDuration);

      case METRIC.distance:
        return this.isPerformanceDifferentFromTarget(getDistanceValue(set.distanceLogged), set.targetDistance);

      case METRIC.rest:
        return this.isPerformanceDifferentFromTarget(getRestValue(set.restLogged), set.targetRest);

      default:
        return false;
    }
  }

  showNotesModal(notes: string, event?: Event): void {
    event?.stopPropagation();
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
      {
        label: this.translate.instant('logDetail.actions.summary'), actionKey: 'view', iconName: 'eye',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: `${mode === 'dropdown' ? 'w-full ' : ''}${defaultBtnClass}`,
        data: { routineId }
      },
      {
        label: this.translate.instant('logDetail.actions.edit'), actionKey: 'edit', iconName: 'edit',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: `${mode === 'dropdown' ? 'w-full ' : ''}${defaultBtnClass}`,
        data: { routineId }
      },
      {
        label: this.translate.instant('logDetail.actions.routine'), actionKey: 'routine', iconName: 'routines',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: `${mode === 'dropdown' ? 'w-full ' : ''}${defaultBtnClass}`,
        data: { routineId }
      },
      { isDivider: true },
      {
        label: this.translate.instant('logDetail.actions.delete'), actionKey: 'delete', iconName: 'trash',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: `${mode === 'dropdown' ? 'w-full ' : ''}${deleteBtnClass}`,
        data: { routineId }
      }
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
      const confirm = await this.alertService.showConfirm(this.translate.instant('logDetail.alerts.noRoutineTitle'), this.translate.instant('logDetail.alerts.noRoutineMessage'));
      if (log && confirm?.data) {
        this.router.navigate(['/workout/routine/new-from-log', log.id]);
      }
    }
  }

  async deleteLogDetails(logId: string): Promise<void> {
    const confirm = await this.alertService.showConfirm(this.translate.instant('logDetail.alerts.deleteTitle'), this.translate.instant('logDetail.alerts.deleteMessage'), this.translate.instant('logDetail.alerts.deleteButton'));
    if (confirm?.data) {
      try {
        this.spinnerService.show();
        await this.trackingService.deleteWorkoutLog(logId);
        this.toastService.success(this.translate.instant('logDetail.toasts.logDeleted'));
        this.router.navigate(['/history/list']);
      } catch (err) {
        this.toastService.error(this.translate.instant('logDetail.toasts.logDeleteFailed'));
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
        return this.translate.instant('logDetail.logForProgram', {
          programName: program.name,
          week: this.weekName() || '',
          day: this.dayInfo()?.dayNumber || ''
        });
      }
    }
    return this.translate.instant('logDetail.adHocWorkout');
  }

  protected emomLabel(exercise: EMOMDisplayBlock): string {
    const rounds = exercise.totalRounds || 1;
    let roundString = this.translate.instant(rounds > 1 ? 'trainingPrograms.card.roundsLabel' : 'trainingPrograms.card.roundLabel', { count: rounds });

    return this.translate.instant('trainingPrograms.superset.emomInfo', { rounds: roundString, time: exercise.emomTimeSeconds || 60 });
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
    this.isPerformanceComparisonModalOpen.set(false);
    this.selectedExerciseForComparison.set(null);
    this.isExerciseDetailModalOpen.set(false);
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
    if (this.checkIfRepsAvailable(item)) cols++;
    if (this.checkIfWeightAvailable(item)) cols++;
    if (this.checkIfDurationAvailable(item)) cols++;
    if (this.checkIfDistanceAvailable(item)) cols++;
    if (this.hasNotes(item)) cols++;

    return `grid-cols-${cols}`;
  }

  protected hasNotes(loggedEx: DisplayLoggedExercise): boolean {
    return loggedEx?.sets?.some(set => (set.notes ?? undefined)) ?? false;
  }

  showExerciseDetails(exerciseData: DisplayLoggedExercise, event?: Event) {
    event?.stopPropagation();
    this.exerciseDetailsId = exerciseData.exerciseId;
    this.exerciseDetailsName = exerciseData.exerciseName || 'Exercise details';

    // Use afterNextRender to smoothly scroll the new section into view
    // once it has been rendered in the DOM.
    runInInjectionContext(this.injector, () => {
      afterNextRender(() => {
        const detailSection = document.getElementById('exerciseDetailSection');
        detailSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // --- ADD THIS NEW METHOD ---
  hideExerciseDetails() {
    this.exerciseDetailsId = '';
    this.exerciseDetailsName = '';
  }
  /**
   * Compares a performed value against a target value and returns a status.
   * - 'success' if performed >= target, or if the target is not a valid number.
   * - 'failure' if performed < target.
   *
   * @param performed The actual value achieved (e.g., reps, weight).
   * @param target The target value to compare against.
   * @returns A status string: 'success' or 'failure'.
   */
  getComparisonStatus(performed: number | string, target: number | string): 'success' | 'failure' {
    // Convert the target value to a number.
    const targetValue = parseFloat(String(target));

    // If the target is not a valid number (e.g., NaN, null, undefined),
    // there's no benchmark to fail against, so we return 'success'.
    if (isNaN(targetValue)) {
      return 'success';
    }

    // If the target is valid, convert the performed value and compare.
    const performedValue = parseFloat(String(performed));

    // Now the comparison is safely done with numbers.
    // If performedValue is NaN, the comparison will be false, correctly leading to 'failure'.
    return performedValue >= targetValue ? 'success' : 'failure';
  }
  /**
   * Compares a performed value against a target value and returns a Tailwind CSS color class.
   * - 'success' (green) if performed >= target, or if the target is not a valid number.
   * - 'failure' (red) if performed < target.
   *
   * @param performed The actual value achieved (e.g., reps, weight).
   * @param target The target value to compare against.
   * @returns A string containing the appropriate CSS class.
   */
  getComparisonClass(performed: number | string, target: number | string): string {
    // Convert the target value to a number.
    const targetValue = parseFloat(String(target));

    // If the target is not a valid number (e.g., NaN, null, undefined),
    // there's no benchmark to compare against, so we consider it a success.
    if (isNaN(targetValue)) {
      return 'text-green-500';
    }

    // If the target is valid, convert the performed value and compare.
    const performedValue = parseFloat(String(performed));

    // If performedValue itself is not a number, the comparison will result in `false`,
    // correctly returning the 'failure' class.
    const status = performedValue >= targetValue ? 'success' : 'failure';

    switch (status) {
      case 'success':
        return 'text-green-500';
      case 'failure':
        return 'text-red-500 dark:text-red-400';
      default:
        // This case is unlikely to be hit with the current logic but serves as a fallback.
        return 'text-gray-800 dark:text-gray-100';
    }
  }

  getWeightDisplay(item: DisplayItem, set: LoggedSet): string {
    if (this.isStandardExercise(item) && item.baseExercise) {
      return this.workoutService.getWeightDisplay(set, item.baseExercise);
    } else {
      if (set) {
        return this.workoutService.getWeightDisplay(set, { ...item } as unknown as WorkoutExercise);
      }
    }
    return '';
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  protected repsTargetRepsToReps(repsTarget: RepsTarget | undefined): number {
    return repsTypeToReps(repsTarget)
  }

  protected metricEnum = METRIC;

  /**
 * A generic helper that compares a performed numeric value against a structured target object.
 * It understands different target types like 'exact', 'range', 'min_plus', etc.
 * @param performed The actual number the user logged.
 * @param target The structured target object (e.g., RepsTarget, WeightTarget).
 * @returns True if the performance is considered "different" from the target.
 */
  private isPerformanceDifferentFromTarget(
    performed: number | null | undefined,
    target: RepsTarget | WeightTarget | DurationTarget | DistanceTarget | RestTarget | null | undefined
  ): boolean {
    const p = performed ?? 0;

    // If there was no target to begin with, it can't be different.
    if (!target) {
      return false;
    }

    // Evaluate based on the type of target that was set.
    switch (target.type) {
      case RepsTargetType.exact:
      case WeightTargetType.exact:
      case DistanceTargetType.exact:
        return p !== target.value; // It's different if not strictly equal.
      case DurationTargetType.exact:
      case RestTargetType.exact:
        return p !== target.seconds; // It's different if not strictly equal.
      case RepsTargetType.range:
      case WeightTargetType.range:
      case DistanceTargetType.range:
        // It's different if performed is outside the min/max bounds.
        return p < target.min || p > target.max;
      case DurationTargetType.range:
      case RestTargetType.range:
        return p < target.minSeconds || p > target.maxSeconds;

      case RepsTargetType.min_plus:
        // It's different only if performed is LESS than the minimum requirement.
        return p < target.value;

      // For these types, the goal is maximum effort. Any logged value is a success.
      // Therefore, it's never considered "different" in a way that needs highlighting.
      case RepsTargetType.amrap:
      case RepsTargetType.max:
      case DurationTargetType.to_failure:
        return false;

      // For bodyweight, the target is effectively 0. It's different if the user logged any weight.
      case WeightTargetType.bodyweight:
        return p !== 0;

      // We don't have enough information to compare against a % of 1RM here,
      // so we assume it's not different.
      case WeightTargetType.percentage_1rm:
        return false;

      default:
        return false;
    }
  }


      getDurationValue(duration: DurationTarget | undefined): number {
      return getDurationValue(duration);
    }
  
      getWeightValue(duration: WeightTarget | undefined): number {
      return getWeightValue(duration);
    }
  
      getDistanceValue(distance: DistanceTarget | undefined): number {
      return getDistanceValue(distance);
    }
}