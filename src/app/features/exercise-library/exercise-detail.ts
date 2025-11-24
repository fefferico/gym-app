import { Component, inject, Input, OnInit, signal, OnDestroy, PLATFORM_ID, OnChanges, SimpleChanges, computed, ElementRef, Output, EventEmitter, effect, Inject, DOCUMENT } from '@angular/core'; // Added OnDestroy
import { CommonModule, TitleCasePipe, DatePipe, isPlatformBrowser, DecimalPipe } from '@angular/common'; // Added DatePipe
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, of, Subscription, forkJoin, map, take, tap, switchMap, combineLatest } from 'rxjs'; // Added Subscription, forkJoin
import { Exercise } from '../../core/models/exercise.model';
import { ExerciseService, HydratedExercise } from '../../core/services/exercise.service';
import { TrackingService, ExercisePerformanceDataPoint } from '../../core/services/tracking.service'; // Import new type
import { LoggedSet, PersonalBestSet, WorkoutLog } from '../../core/models/workout-log.model';

import { NgxChartsModule, ScaleType } from '@swimlane/ngx-charts'; // Import NgxChartsModule and ScaleType
import { ChartDataPoint, ChartSeries } from '../../features/history-stats/stats-dashboard/stats-dashboard'; // Reuse chart types if suitable
import { AlertService } from '../../core/services/alert.service';
import { AlertButton } from '../../core/models/alert.model';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu';
import { ActionMenuItem } from '../../core/models/action-menu.model';
import { MenuMode } from '../../core/models/app-settings.model';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { UnitsService } from '../../core/services/units.service';
import { MuscleHighlight, MuscleMapService } from '../../core/services/muscle-map.service';
import { MuscleMapComponent } from '../../shared/components/muscle-map/muscle-map.component';
import { WeightUnitPipe } from '../../shared/pipes/weight-unit-pipe';
import { animate, group, query, style, transition, trigger } from '@angular/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { getDistanceValue, getDurationValue, getRepsValue, getWeightValue, repsTypeToReps } from '../../core/services/workout-helper.service';
import { DistanceTarget, DurationTarget, RepsTarget, WeightTarget } from '../../core/models/workout.model';
import { SafeUrlPipe } from '../../shared/directives/safeUrl.directive';
import { EXERCISE_CATEGORY_TYPES } from '../../core/models/exercise-category.model';


type RepRecord = {
  reps: number;
  bestPerformance: {
    weight: number;
    reps: number;
    date: number;
  } | null;
  estimated1RM: number;
};

type TopLevelRecord = {
  label: string;
  value: string;
  unit: string;
};

@Component({
  selector: 'app-exercise-detail',
  standalone: true,
  providers: [DecimalPipe, SafeUrlPipe],
  imports: [CommonModule, RouterLink, DatePipe, NgxChartsModule, ActionMenuComponent, IconComponent, WeightUnitPipe, TranslateModule], // Added DatePipe, NgxChartsModule
  templateUrl: './exercise-detail.html',
  styleUrl: './exercise-detail.scss',
  animations: [
    trigger('tabSlide', [
      // Transition for moving to the next tab (e.g., index 0 -> 1)
      transition(':increment', [
        style({ position: 'relative', overflow: 'hidden' }),
        query(':enter, :leave', [
          style({ position: 'absolute', top: 0, left: 0, width: '100%' })
        ], { optional: true }),
        group([
          query(':leave', [
            animate('300ms ease-in-out', style({ transform: 'translateX(-100%)', opacity: 0 }))
          ], { optional: true }),
          query(':enter', [
            style({ transform: 'translateX(100%)', opacity: 0 }),
            animate('300ms ease-in-out', style({ transform: 'translateX(0%)', opacity: 1 }))
          ], { optional: true }),
        ])
      ]),
      // Transition for moving to the previous tab (e.g., index 1 -> 0)
      transition(':decrement', [
        style({ position: 'relative', overflow: 'hidden' }),
        query(':enter, :leave', [
          style({ position: 'absolute', top: 0, left: 0, width: '100%' })
        ], { optional: true }),
        group([
          query(':leave', [
            animate('300ms ease-in-out', style({ transform: 'translateX(100%)', opacity: 0 }))
          ], { optional: true }),
          query(':enter', [
            style({ transform: 'translateX(-100%)', opacity: 0 }),
            animate('300ms ease-in-out', style({ transform: 'translateX(0%)', opacity: 1 }))
          ], { optional: true }),
        ])
      ]),
    ])
  ]
})
export class ExerciseDetailComponent implements OnInit, OnDestroy, OnChanges {
  private tabs: ('description' | 'history' | 'graphs' | 'records')[] = ['description', 'history', 'graphs', 'records'];

  private decimalPipe = inject(DecimalPipe);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private exerciseService = inject(ExerciseService);
  protected trackingService = inject(TrackingService);
  private alertService = inject(AlertService);
  unitService = inject(UnitsService);
  protected translate = inject(TranslateService);

  // Using a signal for the exercise data
  exercise = signal<HydratedExercise | undefined | null>(undefined);
  muscleDataForMap: MuscleHighlight = { primary: [], secondary: [] };

  // For image carousel
  currentImageIndex = signal<number>(0);
  exercisePBs = signal<PersonalBestSet[]>([]); // New signal for PBs

  exerciseProgressChartData = signal<ChartSeries[]>([]);
  private exerciseDetailSub?: Subscription;
  // Chart options
  progressChartView: [number, number] = [700, 300]; // Default view size
  progressChartColorScheme = 'cool';
  // progressChartColorScheme = { domain: ['#06b6d4'] }; // Example: Using your primary color
  progressChartXAxisLabel = this.translate.instant('exerciseDetail.charts.xAxisLabel');
  progressChartYAxisLabel = this.translate.instant('exerciseDetail.charts.yAxisLabel', { unit: this.unitService.getWeightUnitSuffix() });
  progressChartShowXAxis = true;
  progressChartShowYAxis = true;
  progressChartGradient = false;
  progressChartShowXAxisLabel = true;
  progressChartShowYAxisLabel = true;
  progressChartTimeline = true; // Important for date-based X-axis
  progressChartAutoScale = true;

  @Input() id?: string; // For route parameter binding
  @Input() isModal?: boolean = false; // For route parameter binding
  @Output() close = new EventEmitter<void>();

  private exerciseIdForLoad: string | null = null;

  private platformId = inject(PLATFORM_ID); // Inject PLATFORM_ID

  isViewMode = signal<boolean | null>(null);

  // --- START: ADD/UPDATE SIGNALS ---
  activeTab = signal<'description' | 'history' | 'graphs' | 'records'>('description');
  exerciseHistory = signal<WorkoutLog[]>([]); // Will store logs containing this exercise

  // Chart Signals
  est1rmChartData = signal<ChartSeries[]>([]);
  maxWeightChartData = signal<ChartSeries[]>([]);
  totalVolumeChartData = signal<ChartSeries[]>([]);
  maxDurationChartData = signal<ChartSeries[]>([]);
  maxDistanceChartData = signal<ChartSeries[]>([]);
  // --- END: ADD/UPDATE SIGNALS ---
  showVideoModal = false;
  constructor(@Inject(DOCUMENT) private document: Document) {
    effect(() => {
      // When this component is acting as a modal and is visible, prevent body scrolling.
      if (this.isModal) {
        this.document.body.classList.add('overflow-hidden');
      }

      // The cleanup function for the effect. It runs when the component is destroyed.
    });

    effect((onCleanup) => {
      onCleanup(() => {
        this.document.body.classList.remove('overflow-hidden');
      });
    });
  }

  // This hook is called whenever an @Input() property changes.
  ngOnChanges(changes: SimpleChanges): void {
    // Check if the 'id' input property has changed.
    if (changes['id']) {
      const newId = changes['id'].currentValue;
      const previousId = changes['id'].previousValue;

      // Only reload if the new ID is different from the one we already loaded.
      // This prevents unnecessary reloads.
      if (newId && newId !== this.exerciseIdForLoad) {
        this.exerciseIdForLoad = newId;
        this.loadInitialData(); // Call the loading logic with the new ID
      }
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      if (!this.isModal) {
        window.scrollTo(0, 0);
      }
    }

    // The initial data load is now handled by ngOnChanges as well,
    // but we can keep a call here for non-input-based loading (e.g., from route params).
    this.loadInitialData();
  }

  private loadInitialData(): void {
    // This logic determines whether to get the ID from the @Input or the route.
    const idSource$ = this.id
      ? of(this.id)
      : this.route.paramMap.pipe(map(params => params.get('id')));

    // Unsubscribe from any previous subscription to prevent memory leaks.
    this.exerciseDetailSub?.unsubscribe();

    this.exerciseDetailSub = idSource$.pipe(
      tap(exerciseId => {
        this.exerciseIdForLoad = exerciseId; // Keep track of the currently loaded ID
        this.resetComponentState(); // Reset signals before loading new data

        if (exerciseId) {
          this.isViewMode.set(true);
          this.loadExerciseData(exerciseId);
        } else {
          this.exercise.set(null); // No ID, exercise not found
        }
      })
    ).subscribe();
  }

  public onCloseModal(): void {
    this.close.emit();
  }

  private resetComponentState(): void {
    this.exercise.set(undefined);
    this.exercisePBs.set([]);
    this.exerciseProgressChartData.set([]);
  }

  loadExercise(exerciseId: string): void {
    // Call the correct service method that returns a HydratedExercise
    this.exerciseService.getHydratedExerciseById(exerciseId).subscribe(hydratedEx => {
      // The type now matches what the signal expects
      this.exercise.set(hydratedEx || null);
      this.currentImageIndex.set(0);
    });
  }

  nextImage(): void {
    const ex = this.exercise();
    if (ex && ex.imageUrls.length > 1) {
      this.currentImageIndex.update(index => (index + 1) % ex.imageUrls.length);
    }
  }

  prevImage(): void {
    const ex = this.exercise();
    if (ex && ex.imageUrls.length > 1) {
      this.currentImageIndex.update(index => (index - 1 + ex.imageUrls.length) % ex.imageUrls.length);
    }
  }

  // Method to load PBs for the current exercise
  private loadExercisePBs(exerciseId: string): void {
    this.trackingService.getAllPersonalBestsForExercise(exerciseId)
      .pipe(take(1)) // Take the first emission and complete
      .subscribe(pbs => {
        // Sort PBs for consistent display, e.g., by type or weight
        const sortedPBs = pbs.sort((a, b) => {
          // Example sort: "XRM (Actual)" first, then "XRM (Estimated)", then others
          // This is a basic sort, can be made more sophisticated
          if (a.pbType.includes('RM (Actual)') && !b.pbType.includes('RM (Actual)')) return -1;
          if (!a.pbType.includes('RM (Actual)') && b.pbType.includes('RM (Actual)')) return 1;
          if (a.pbType.includes('RM (Estimated)') && !b.pbType.includes('RM (Estimated)')) return -1;
          if (!a.pbType.includes('RM (Estimated)') && b.pbType.includes('RM (Estimated)')) return 1;
          return (getWeightValue(b.weightLogged) ?? 0) - (getWeightValue(a.weightLogged) ?? 0) || a.pbType.localeCompare(b.pbType);
        });
        this.exercisePBs.set(sortedPBs);
        console.log(`PBs for ${exerciseId}:`, sortedPBs);
      });
  }

  // Helper function to format PB display (can be moved to a pipe later)
  formatPbValue(pb: PersonalBestSet): string {
    let value = '';
    if (pb.weightLogged !== undefined && pb.weightLogged !== null) {
      value += `${getWeightValue(pb.weightLogged)}${this.unitService.getWeightUnitSuffix()}`;
      if (pb.repsLogged && repsTypeToReps(pb.repsLogged) > 1 && !pb.pbType.includes('RM (Actual)') && !pb.pbType.includes('RM (Estimated)')) {
        // Show reps for "Heaviest Lifted" if reps > 1, but not for explicit 1RMs where reps is 1 by definition
        value += ` x ${getRepsValue(pb.repsLogged)}`;
      } else if (pb.repsLogged && repsTypeToReps(pb.repsLogged) > 1 && pb.pbType === "Heaviest Lifted") {
        value += ` x ${getRepsValue(pb.repsLogged)}`;
      }
    } else if (pb.repsLogged && pb.pbType.includes('Max Reps')) {
      value = `${getRepsValue(pb.repsLogged)} reps`;
    } else if (pb.durationLogged && getDurationValue(pb.durationLogged) > 0 && pb.pbType.includes('Max Duration')) {
      value = `${this.formatDurationForRecord(getDurationValue(pb.durationLogged))}s`;
    }
    return value || 'N/A';
  }

  private loadExerciseData(exerciseId: string): void {
    this.exerciseDetailSub?.unsubscribe();

    // --- START: CORRECTED DATA LOADING PIPELINE ---
    this.exerciseDetailSub = this.exerciseService.getHydratedExerciseById(exerciseId).pipe(
      switchMap(hydratedExercise => {
        // If the exercise is not found, stop here and return empty data for the other calls.
        if (!hydratedExercise) {
          return of({ exercise: null, pbs: [], history: [] });
        }

        // If the exercise was found, now fetch its PBs and history.
        return forkJoin({
          exercise: of(hydratedExercise), // Pass the already-hydrated exercise through
          pbs: this.trackingService.getAllPersonalBestsForExercise(exerciseId).pipe(take(1)),
          history: this.trackingService.getLogsForExercise(exerciseId).pipe(take(1))
        });
      })
    ).subscribe(({ exercise, pbs, history }) => {
      // The 'exercise' object is now the fully HydratedExercise, matching the signal's type.
      this.exercise.set(exercise);
      this.currentImageIndex.set(0);

      const sortedPBs = pbs.sort((a, b) => (getWeightValue(b.weightLogged) ?? 0) - (getWeightValue(a.weightLogged) ?? 0));
      this.exercisePBs.set(sortedPBs);
      this.exerciseHistory.set(history);

      if (exercise) {
        this.muscleDataForMap = {
          primary: exercise.primaryMuscleGroup ? [exercise.primaryMuscleGroup.name] : [],
          secondary: exercise.muscleGroups
            .filter(m => m.id !== exercise.primaryMuscleGroup?.id)
            .map(m => m.name)
        };

        this.prepareChartData(history, exercise.name);
      }
    }, error => {
      console.error("Error loading hydrated exercise details:", error);
      this.exercise.set(null);
    });
    // --- END: CORRECTED DATA LOADING PIPELINE ---
  }

  // Chart click handler
  onProgressChartSelect(event: any): void {
    console.log('Progress chart item selected:', event);
    // Example: navigate to the specific workout log if logId is in event.extra
    if (event.extra && event.extra.logId) {
      //this.router.navigate(['/history/log', event.extra.logId]);
    }
  }

  get hasSufficientProgressData(): boolean {
    const chartData = this.exerciseProgressChartData();
    return chartData.length > 0 &&
      chartData[0] &&
      chartData[0].series &&
      chartData[0].series.length > 1; // Ensure more than 1 point for a line
  }

  async confirmDeleteExercise(exerciseToDelete: HydratedExercise): Promise<void> {
    if (!exerciseToDelete) return;

    const customBtns: AlertButton[] = [{
      text: this.translate.instant('exerciseDetail.general.cancel'),
      role: 'cancel',
      data: false,
      cssClass: 'bg-gray-300 hover:bg-gray-500'
    } as AlertButton,
    {
      text: this.translate.instant('exerciseDetail.general.delete'),
      role: 'confirm',
      data: true,
      cssClass: 'button-danger'
    } as AlertButton];

    const confirmation = await this.alertService.showConfirmationDialog(
      this.translate.instant('exerciseDetail.delete.confirmTitle'),
      this.translate.instant('exerciseDetail.delete.confirmMessage', { name: exerciseToDelete.name }),
      customBtns
    );

    if (confirmation && confirmation.data === true) {
      try {
        await this.exerciseService.deleteExercise(exerciseToDelete.id);
        this.alertService.showAlert(
          this.translate.instant('exerciseDetail.delete.successTitle'),
          this.translate.instant('exerciseDetail.delete.successMessage', { name: exerciseToDelete.name })
        );
        this.router.navigate(['/library']);
      } catch (error) {
        this.alertService.showAlert(
          this.translate.instant('exerciseDetail.delete.errorTitle'),
          this.translate.instant('exerciseDetail.delete.errorMessage', { error: (error as Error).message || 'Unknown error' })
        );
      }
    }
  }

  ngOnDestroy(): void {
    this.exerciseDetailSub?.unsubscribe();
  }



  getExerciseDropdownActionItems(routineId: string, mode: MenuMode): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';

    const editButton = {
      label: this.translate.instant('exerciseDetail.actions.edit'),
      actionKey: 'edit',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    };

    const deleteButton = {
      label: this.translate.instant('exerciseDetail.actions.delete'),
      actionKey: 'delete',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.177-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5Zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5Z" clip-rule="evenodd" /></svg>`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
      data: { routineId }
    };

    const currentExercise = this.exercise;

    const actionsArray = [
    ];

    if (this.isViewMode()) {
      actionsArray.push(editButton);
      actionsArray.push({ isDivider: true });
    }
    actionsArray.push(deleteButton);


    return actionsArray;
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
    // originalMouseEvent.stopPropagation(); // Stop original event that opened the menu
    const currentExercise = this.exercise();
    const exerciseId = currentExercise?.id;
    if (!exerciseId) return;

    switch (event.actionKey) {
      case 'edit':
        this.router.navigate(['/library/edit/', exerciseId]);
        break;
      case 'delete':
        this.confirmDeleteExercise(currentExercise);
        break;
    }
    this.activeRoutineIdActions.set(null); // Close the menu
  }

  // Your existing toggleActions, areActionsVisible, etc. methods
  // The toggleActions will now just control a signal like `activeRoutineIdActions`
  // which is used to show/hide the <app-action-menu>
  activeRoutineIdActions = signal<string | null>(null); // Store ID of routine whose actions are open

  toggleActions(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeRoutineIdActions.update(current => (current === routineId ? null : routineId));
  }

  areActionsVisible(routineId: string): boolean {
    return this.activeRoutineIdActions() === routineId;
  }
  // When closing menu from the component's output
  onCloseActionMenu() {
    this.activeRoutineIdActions.set(null);
  }

  // --- START: NEW COMPUTED SIGNALS FOR RECORDS TAB ---

  // Computes top-level records like max weight, volume, and estimated 1RM
  personalRecords = computed<TopLevelRecord[]>(() => {
    const pbs = this.exercisePBs();
    const ex = this.exercise();
    const records: TopLevelRecord[] = [];

    if (this.hasCardioCategory()) {
      const maxDist = pbs.find(p => p.pbType === 'Max Distance');
      const maxDur = pbs.find(p => p.pbType === 'Max Duration');
      if (maxDist) records.push({ label: this.translate.instant('exerciseDetail.records.maxDistance'), value: this.decimalPipe.transform(getDistanceValue(maxDist.distanceLogged), '1.0-2') ?? '0', unit: this.unitService.getDistanceMeasureUnitSuffix() });
      if (maxDur) records.push({ label: this.translate.instant('exerciseDetail.records.maxDuration'), value: this.formatDurationForRecord(getDurationValue(maxDur.durationLogged)), unit: '' });
    } else {
      const est1RM = pbs.find(p => p.pbType === '1RM (Estimated)');
      const maxVol = pbs.find(p => p.pbType === 'Max Volume');
      const maxWeight = pbs.find(p => p.pbType === 'Heaviest Lifted');
      if (est1RM) records.push({ label: this.translate.instant('exerciseDetail.records.est1rm'), value: this.decimalPipe.transform(getWeightValue(est1RM.weightLogged), '1.0-1') ?? '0', unit: 'kg' });
      if (maxVol) records.push({ label: this.translate.instant('exerciseDetail.records.maxVolume'), value: this.decimalPipe.transform(maxVol.volume, '1.0-1') ?? '0', unit: 'kg' });
      if (maxWeight) records.push({ label: this.translate.instant('exerciseDetail.records.maxWeight'), value: this.decimalPipe.transform(getWeightValue(maxWeight.weightLogged), '1.0-1') ?? '0', unit: 'kg' });
    }

    return records;
  });

  // Computes the best performance for each rep number (1-12)
  repRecords = computed<RepRecord[]>(() => {
    const history = this.exerciseHistory();
    const exerciseId = this.exercise()?.id;
    if (!history.length || !exerciseId) return [];

    const bestsByRep: { [reps: number]: { weight: number; reps: number; date: number; } } = {};

    for (const log of history) {
      const exerciseLog = log.exercises.find(ex => ex.exerciseId === exerciseId);
      if (exerciseLog) {
        for (const set of exerciseLog.sets) {
          const reps = set.repsLogged;
          const weight = getWeightValue(set.weightLogged) ?? 0;
          if (reps && weight > 0) {
            if (!bestsByRep[repsTypeToReps(reps)] || weight > bestsByRep[repsTypeToReps(reps)].weight) {
              bestsByRep[repsTypeToReps(reps)] = { weight, reps: repsTypeToReps(reps), date: log.startTime };
            }
          }
        }
      }
    }

    const records: RepRecord[] = [];
    for (let i = 1; i <= 12; i++) {
      const best = bestsByRep[i];
      records.push({
        reps: i,
        bestPerformance: best || null,
        // Calculate estimated 1RM using Brzycki formula
        estimated1RM: best ? best.weight * (36 / (37 - best.reps)) : 0
      });
    }
    return records;
  });
  // --- END: NEW COMPUTED SIGNALS ---

  // --- ADD THIS NEW METHOD TO PREPARE ALL CHART DATA ---
  private prepareChartData(history: WorkoutLog[], seriesName: string): void {
    if (!history || history.length < 2) {
      // Clear all charts
      this.est1rmChartData.set([]);
      this.maxWeightChartData.set([]);
      this.totalVolumeChartData.set([]);
      this.maxDurationChartData.set([]);
      this.maxDistanceChartData.set([]);
      return;
    }

    const exerciseId = this.exercise()?.id;
    const isCardio = this.exercise()?.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.cardio) !== undefined;

    // Strength Chart Series
    const est1rmSeries: ChartDataPoint[] = [];
    const maxWeightSeries: ChartDataPoint[] = [];
    const totalVolumeSeries: ChartDataPoint[] = [];

    // Cardio Chart Series
    const maxDurationSeries: ChartDataPoint[] = [];
    const maxDistanceSeries: ChartDataPoint[] = [];

    history.forEach(log => {
      const exerciseLog = log.exercises.find(ex => ex.exerciseId === exerciseId);
      if (exerciseLog) {
        if (isCardio) {
          let maxDuration = 0;
          let maxDistance = 0;
          exerciseLog.sets.forEach(set => {
            if (set.durationLogged && getDurationValue(set.durationLogged) > maxDuration) maxDuration = getDurationValue(set.durationLogged);
            if (set.distanceLogged && getDistanceValue(set.distanceLogged) > maxDistance) maxDistance = getDistanceValue(set.distanceLogged);
          });
          if (maxDuration > 0) maxDurationSeries.push({ name: new Date(log.startTime), value: maxDuration });
          if (maxDistance > 0) maxDistanceSeries.push({ name: new Date(log.startTime), value: maxDistance });
        } else {
          // Existing strength logic
          let maxWeight = 0;
          let totalVolume = 0;
          let bestSetFor1RM: { weight: number, reps: number } | null = null;
          exerciseLog.sets.forEach(set => {
            const weight = getWeightValue(set.weightLogged) ?? 0;
            totalVolume += weight * (repsTypeToReps(set.repsLogged) ?? 0);
            if (weight > maxWeight) maxWeight = weight;
            if (weight > 0 && (!bestSetFor1RM || weight > bestSetFor1RM.weight)) {
              bestSetFor1RM = { weight, reps: repsTypeToReps(set.repsLogged) ?? 0 };
            }
          });
          if (bestSetFor1RM) {
            const bestSet = bestSetFor1RM as { weight: number, reps: number };
            const est1RM = bestSet.weight * (36 / (37 - bestSet.reps));
            est1rmSeries.push({ name: new Date(log.startTime), value: est1RM });
          }
          if (maxWeight > 0) maxWeightSeries.push({ name: new Date(log.startTime), value: maxWeight });
          if (totalVolume > 0) totalVolumeSeries.push({ name: new Date(log.startTime), value: totalVolume });
        }
      }
    });

    // Set the appropriate chart signals
    if (isCardio) {
      this.maxDurationChartData.set([{ name: this.translate.instant('exerciseDetail.charts.maxDurationSeries'), series: maxDurationSeries }]);
      this.maxDistanceChartData.set([{ name: this.translate.instant('exerciseDetail.charts.maxDistanceSeries', { unit: this.unitService.getDistanceMeasureUnitSuffix() }), series: maxDistanceSeries }]);
    } else {
      this.est1rmChartData.set([{ name: this.translate.instant('exerciseDetail.charts.est1rmSeries'), series: est1rmSeries }]);
      this.maxWeightChartData.set([{ name: this.translate.instant('exerciseDetail.charts.maxWeightSeries'), series: maxWeightSeries }]);
      this.totalVolumeChartData.set([{ name: this.translate.instant('exerciseDetail.charts.totalVolumeSeries'), series: totalVolumeSeries }]);
    }
  }
  // --- END: NEW CHART DATA PREPARATION ---


  // --- ADD THIS NEW METHOD TO CHANGE TABS ---
  selectTab(tab: 'description' | 'history' | 'graphs' | 'records'): void {
    // Before changing the tab, measure the height of the current content
    this.measureContentHeight();
    this.activeTab.set(tab);
    // After the animation starts, reset the height to 'auto' so it can resize
    setTimeout(() => this.contentHeight = 'auto', 300); // Duration should match animation
  }

  /**
   * Handles swipe gestures to navigate between tabs.
   * @param direction The direction of the swipe ('left' or 'right').
   */
  onSwipe(direction: 'left' | 'right'): void {
    // If an animation is already in progress, ignore this swipe
    if (this.isAnimating) {
      return;
    }
    this.isAnimating = true; // Set the flag

    const currentIndex = this.tabs.indexOf(this.activeTab());
    let newIndex: number;

    if (direction === 'left') {
      newIndex = currentIndex + 1;
    } else {
      newIndex = currentIndex - 1;
    }

    if (newIndex >= 0 && newIndex < this.tabs.length) {
      this.selectTab(this.tabs[newIndex]);
    }

    // After the animation duration, reset the flag
    setTimeout(() => this.isAnimating = false, 300); // Match your animation duration
  }

  /**
   * Helper function for the template to extract the sets for the current
   * exercise from a given workout log.
   * @param log The WorkoutLog to search within.
   * @returns An array of LoggedSet, or an empty array if not found.
   */
  public getSetsForExerciseInLog(log: WorkoutLog): LoggedSet[] {
    const exerciseId = this.exercise()?.id;
    if (!exerciseId) return [];

    const exerciseInLog = log.exercises.find(e => e.exerciseId === exerciseId);
    return exerciseInLog?.sets || [];
  }

  /**
   * Computes the numeric index of the active tab.
   * This is used by the animation trigger to detect :increment and :decrement.
   */
  activeTabIndex = computed(() => this.tabs.indexOf(this.activeTab()));

  private elRef = inject(ElementRef); // <-- ADD THIS INJECTION
  private isAnimating = false; // Flag to prevent rapid-fire swipes
  contentHeight = 'auto'; // Will hold the height for the animation container

  /**
   * Measures the height of the currently active tab content and sets it on the
   * animation container to prevent it from collapsing during the transition.
   */
  private measureContentHeight(): void {
    const activeTabContent = this.elRef.nativeElement.querySelector('.tab-content-active');
    if (activeTabContent) {
      this.contentHeight = `${activeTabContent.offsetHeight}px`;
    }
  }

  /**
  * Formats a single logged set into a human-readable string based on the metrics it contains.
  */
  public formatSetDisplay(set: LoggedSet): string {
    const parts: string[] = [];
    if (set.weightLogged != null && getWeightValue(set.weightLogged) > 0) {
      parts.push(`${this.decimalPipe.transform(getWeightValue(set.weightLogged), '1.0-2')} ${this.unitService.getWeightUnitSuffix()}`);
    } else if ((getWeightValue(set.weightLogged) === 0 || set.weightLogged === null) && set.repsLogged) {
      parts.push(this.translate.instant('exerciseDetail.historyDisplay.bodyweight'));
    }

    if (set.repsLogged) parts.push(`${getRepsValue(set.repsLogged)} ${this.translate.instant('exerciseDetail.historyDisplay.reps')}`);
    if (set.distanceLogged && getDistanceValue(set.distanceLogged) > 0) parts.push(`${this.decimalPipe.transform(getDistanceValue(set.distanceLogged), '1.0-2')} ${this.unitService.getDistanceMeasureUnitSuffix()}`);
    if (set.durationLogged && getDurationValue(set.durationLogged) > 0) parts.push(this.formatDurationForRecord(getDurationValue(set.durationLogged)));

    return parts.length > 0 ? parts.join(' x ') : this.translate.instant('exerciseDetail.historyDisplay.noData');
  }

  /**
   * Formats a duration in seconds into a string like "1m 30s".
   */
  public formatDurationForRecord(totalSeconds: number | null | undefined): string {
    if (!totalSeconds) return '';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    let result = '';
    if (minutes > 0) result += `${minutes}m `;
    if (seconds > 0) result += `${seconds}s`;
    return result.trim();
  }

  private sanitizer = inject(DomSanitizer);
  protected updateSanitizedDescription(value: string): SafeHtml {
    // This tells Angular to trust this HTML string and render it as is.
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }

  repsTargetRepsToReps(targetReps: RepsTarget | undefined): number {
    return repsTypeToReps(targetReps);
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

  getTranslatedExercise(exercise: Exercise): Observable<Exercise> {
    return this.translate.get('exercises').pipe(
      map((translations: any) => ({
        ...exercise,
        name: translations[exercise.id]?.name || exercise.name,
        description: translations[exercise.id]?.description || exercise.description,
      }))
    );
  }

  protected hasCardioCategory(): boolean {
    return this.exercise()?.categories.find(cat => cat === EXERCISE_CATEGORY_TYPES.cardio) !== undefined;
  }
}