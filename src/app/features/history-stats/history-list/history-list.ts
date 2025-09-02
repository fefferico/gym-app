// src/app/features/history/history-list/history-list.component.ts
import {
  Component, inject, OnInit, signal, computed, PLATFORM_ID, OnDestroy,
  ChangeDetectorRef, ElementRef, AfterViewInit, NgZone, ViewChild,
  HostListener
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Observable, combineLatest, Subscription, forkJoin, of } from 'rxjs';
import { map, startWith, distinctUntilChanged, take, filter, switchMap } from 'rxjs/operators';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ExerciseService } from '../../../core/services/exercise.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { AchievedPB, LoggedSet, WorkoutLog } from '../../../core/models/workout-log.model';
import { Exercise } from '../../../core/models/exercise.model';
import { WorkoutService } from '../../../core/services/workout.service';
import { UnitsService } from '../../../core/services/units.service';
import { Routine } from '../../../core/models/workout.model';
import { ThemeService } from '../../../core/services/theme.service';
import { animate, state, style, transition, trigger, group, query } from '@angular/animations';
import { AlertService } from '../../../core/services/alert.service';
import { ToastService } from '../../../core/services/toast.service';
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek,
  isSameMonth, // Ensure isSameMonth is imported
  addDays
} from 'date-fns';
import Hammer from 'hammerjs';
import { SpinnerService } from '../../../core/services/spinner.service';
import { ActionMenuComponent } from '../../../shared/components/action-menu/action-menu';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { TrainingProgram } from '../../../core/models/training-program.model';
import { PressDirective } from '../../../shared/directives/press.directive';
import { PressScrollDirective } from '../../../shared/directives/press-scroll.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AlertButton } from '../../../core/models/alert.model';
import { ActivityLog } from '../../../core/models/activity-log.model';
import { ActivityService } from '../../../core/services/activity.service';
import { PausedWorkoutState } from '../../workout-tracker/workout-player';
import { StorageService } from '../../../core/services/storage.service';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { MenuMode } from '../../../core/models/app-settings.model';

interface HistoryCalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasLog: boolean;
  logCount: number;
}

type HistoryListView = 'list' | 'calendar';
type HistoryListItem = (WorkoutLog & { itemType: 'workout' }) | (ActivityLog & { itemType: 'activity' });

type EnrichedHistoryListItem = HistoryListItem & {
  programName?: string | null;
  weekName?: string | null;
  dayName?: string | null;
  totalVolume?: number | null;
  personalBests?: number | null;
};


@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, FormsModule, ReactiveFormsModule, ActionMenuComponent, PressDirective, PressScrollDirective, IconComponent],
  templateUrl: './history-list.html',
  styleUrl: './history-list.scss',
  providers: [DecimalPipe],
  animations: [
    trigger('fabSlideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(100%)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(100%)' }))
      ])
    ]),
    trigger('slideUpDown', [
      transition(':enter', [style({ transform: 'translateY(100%)', opacity: 0 }), animate('300ms ease-out', style({ transform: 'translateY(0%)', opacity: 1 }))]),
      transition(':leave', [animate('250ms ease-in', style({ transform: 'translateY(100%)', opacity: 0 }))])
    ]),
    trigger('slideInOutActions', [
      state('void', style({
        height: '0px', opacity: 0, overflow: 'hidden',
        paddingTop: '0', paddingBottom: '0', marginTop: '0', marginBottom: '0'
      })),
      state('*', style({
        height: '*', opacity: 1, overflow: 'hidden',
        paddingTop: '0.5rem', paddingBottom: '0.5rem'
      })),
      transition('void <=> *', animate('200ms ease-in-out'))
    ]),
    trigger('dropdownMenu', [
      state('void', style({
        opacity: 0, transform: 'scale(0.75) translateY(-10px)', transformOrigin: 'top right'
      })),
      state('*', style({
        opacity: 1, transform: 'scale(1) translateY(0)', transformOrigin: 'top right'
      })),
      transition('void => *', [animate('150ms cubic-bezier(0.25, 0.8, 0.25, 1)')]),
      transition('* => void', [animate('100ms cubic-bezier(0.25, 0.8, 0.25, 1)')])
    ]),
    trigger('calendarMonthSlide', [
      state('center', style({ transform: 'translateX(0%)', opacity: 1 })),
      state('outLeft', style({ transform: 'translateX(-100%)', opacity: 0 })),
      state('outRight', style({ transform: 'translateX(100%)', opacity: 0 })),
      state('preloadFromRight', style({ transform: 'translateX(100%)', opacity: 0 })),
      state('preloadFromLeft', style({ transform: 'translateX(-100%)', opacity: 0 })),
      transition('center => outLeft', animate('200ms ease-in')),
      transition('center => outRight', animate('200ms ease-in')),
      transition('preloadFromRight => center', animate('200ms ease-out')),
      transition('preloadFromLeft => center', animate('200ms ease-out')),
    ])
  ]
})
export class HistoryListComponent implements OnInit, AfterViewInit, OnDestroy {
  protected trackingService = inject(TrackingService);
  protected storageService = inject(StorageService);
  protected activityService = inject(ActivityService);
  protected toastService = inject(ToastService);
  protected workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  protected unitsService = inject(UnitsService);
  private themeService = inject(ThemeService);
  private appSettingsService = inject(AppSettingsService);
  private alertService = inject(AlertService);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private elementRef = inject(ElementRef);
  private spinnerService = inject(SpinnerService);
  private trainingProgramService = inject(TrainingProgramService);


  protected allWorkoutLogs = signal<WorkoutLog[]>([]);
  selectedDayItems = signal<EnrichedHistoryListItem[]>([]);
  protected allHistoryItems = signal<EnrichedHistoryListItem[]>([]);
  private workoutLogsSubscription: Subscription | undefined;

  availableExercisesForFilter$: Observable<Exercise[]> | undefined;
  isFilterAccordionOpen = signal(false);
  availableRoutines: Routine[] = [];
  visibleActionsRutineId = signal<string | null>(null);
  menuModeDropdown: boolean = false;
  menuModeCompact: boolean = false;
  menuModeModal: boolean = false;
  showPastLoggedWorkouts: boolean = false;
  pastLoggedWorkoutsDay: HistoryCalendarDay | null = null;

  filterForm: FormGroup;
  private filterValuesSignal = signal<any>({});
  availableProgramsForFilter = signal<TrainingProgram[]>([]);

  currentHistoryView = signal<HistoryListView>('list');
  historyViewAnimationParams = signal<{ value: HistoryListView, params: { enterTransform: string, leaveTransform: string } }>({
    value: 'list', params: { enterTransform: 'translateX(100%)', leaveTransform: 'translateX(-100%)' }
  });

  showBackToTopButton = signal<boolean>(false);
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    // Check if the user has scrolled down more than a certain amount (e.g., 400 pixels)
    // You can adjust this value to your liking.
    const verticalOffset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    this.showBackToTopButton.set(verticalOffset > 400);
  }

  historyCalendarDays = signal<HistoryCalendarDay[]>([]);
  historyCalendarViewDate = signal<Date>(new Date());
  historyCalendarLoading = signal(false);
  historyCalendarAnimationState = signal<'center' | 'outLeft' | 'outRight' | 'preloadFromLeft' | 'preloadFromRight'>('center');
  protected isHistoryCalendarAnimating = false;
  private hammerInstanceHistoryCalendar: HammerManager | null = null;
  weekStartsOn: 0 | 1 = 1;
  readonly todayForCalendar = new Date(); // Property to hold today's date for the template



  @ViewChild('historyCalendarSwipeContainerEl')
  set historyCalendarSwipeContainer(elementRef: ElementRef<HTMLDivElement> | undefined) {
    if (elementRef && isPlatformBrowser(this.platformId) && this.currentHistoryView() === 'calendar') {
      if (this.hammerInstanceHistoryCalendar) {
        this.hammerInstanceHistoryCalendar.destroy();
      }
      this.setupHistoryCalendarSwipe(elementRef.nativeElement);
    } else if (!elementRef && this.hammerInstanceHistoryCalendar) {
      this.hammerInstanceHistoryCalendar.destroy();
      this.hammerInstanceHistoryCalendar = null;
    }
  }

  filteredHistoryItems = computed(() => {
    let items = this.allHistoryItems();
    const filters = this.filterValuesSignal();

    if (!items || items.length === 0) return [];
    if (!filters) return items;

    const filtered = items.filter(item => {
      let match = true;
      const itemDate = new Date(item.startTime);

      // --- Universal Filters (Apply to both workouts and activities) ---
      if (filters.dateFrom) {
        const filterDateFrom = new Date(filters.dateFrom);
        filterDateFrom.setHours(0, 0, 0, 0);
        if (!isNaN(filterDateFrom.getTime())) {
          match &&= itemDate.getTime() >= filterDateFrom.getTime();
        }
      }
      if (filters.dateTo) {
        const filterDateTo = new Date(filters.dateTo);
        filterDateTo.setHours(23, 59, 59, 999);
        if (!isNaN(filterDateTo.getTime())) {
          match &&= itemDate.getTime() <= filterDateTo.getTime();
        }
      }

      // If the item doesn't match the universal filters, we can stop here.
      if (!match) return false;

      // --- Type-Specific Filters ---
      if (item.itemType === 'workout') {
        // Now that we know it's a workout, we can safely access workout properties.
        const routineNameFilter = filters.routineName?.trim().toLowerCase();
        if (routineNameFilter) {
          match &&= (item.routineName || '').toLowerCase().includes(routineNameFilter);
        }
        if (filters.exerciseId) {
          match &&= item.exercises.some(ex => ex.exerciseId === filters.exerciseId);
        }
        if (filters.programId) {
          match &&= item.programId === filters.programId;
        }
      } else if (item.itemType === 'activity') {
        // If any workout-specific filters are active, an activity can't match.
        if (filters.routineName || filters.exerciseId || filters.programId) {
          match = false;
        }
        // You could add activity-specific filters here in the future
        // e.g., if (filters.activityName) { ... }
      }

      return match;
    });

    return filtered; // The list is already sorted from the source observable
  });

  constructor() {
    this.filterForm = this.fb.group({
      dateFrom: [''],
      dateTo: [''],
      routineName: [''],
      exerciseId: [''],
      programId: ['']
    });
    this.filterValuesSignal.set(this.filterForm.value);
    this.filterForm.valueChanges.pipe(
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    ).subscribe(newValues => this.filterValuesSignal.set(newValues));
  }

  // --- ADD NEW PROPERTIES FOR THE FAB ---
  isFabActionsOpen = signal(false);
  isTouchDevice = false;

  /**
   * Extracts the total volume from a history log item.
   * It first checks for a pre-calculated 'totalVolume' property.
   * If not found, it calculates it from the exercises array for workout logs.
   *
   * @param logItem The enriched history list item.
   * @returns The total volume as a number, or null if not applicable/available.
   */
  getTotalVolume(logItem: EnrichedHistoryListItem): number | null {
    // 1. Prefer the direct, pre-calculated property if it exists.
    if (logItem.totalVolume != null) { // Checks for both null and undefined
      return logItem.totalVolume;
    }

    // 2. If it's not pre-calculated, and it's a workout, calculate it.
    if (logItem.itemType === 'workout') {
      // The 'exercises' property is available because itemType is 'workout'
      return logItem.exercises.reduce((totalVolume, exercise) => {
        const exerciseVolume = exercise.sets.reduce((volume, set) => {
          // Ensure both reps and weight are valid numbers
          if (typeof set.repsAchieved === 'number' && typeof set.weightUsed === 'number') {
            return volume + (set.repsAchieved * set.weightUsed);
          }
          return volume;
        }, 0);
        return totalVolume + exerciseVolume;
      }, 0);
    }

    // 3. Return null for non-workout items or if volume cannot be determined.
    return null;
  }

  /**
   * Extracts all personal bests achieved within a single workout log.
   * This function mirrors the PB identification logic from TrackingService
   * but limits its scope to only the sets within the provided log.
   *
   * @param log The WorkoutLog to analyze.
   * @returns An array of AchievedPB objects, each representing a PB set in that log.
   */
  getPersonalBestsFromLog(log: WorkoutLog): AchievedPB[] {
    const allPBsFromLog: AchievedPB[] = [];

    log.exercises.forEach(loggedEx => {
      // A temporary map to hold the best set for each PB type for THIS exercise in THIS log.
      const bestSetsForExercise = new Map<string, LoggedSet>();

      loggedEx.sets.forEach(candidateSet => {
        // Bodyweight or duration-based PBs
        if (!candidateSet.weightUsed) {
          if (candidateSet.repsAchieved > 0) {
            this.updateBestSet(bestSetsForExercise, 'Max Reps (Bodyweight)', candidateSet);
          }
          if (candidateSet.durationPerformed && candidateSet.durationPerformed > 0) {
            this.updateBestSet(bestSetsForExercise, 'Max Duration', candidateSet);
          }
          return; // Move to the next set
        }

        // Weight-based PBs
        this.updateBestSet(bestSetsForExercise, 'Heaviest Lifted', candidateSet);
        if (candidateSet.repsAchieved === 1) {
          this.updateBestSet(bestSetsForExercise, '1RM (Actual)', candidateSet);
        }
        if (candidateSet.repsAchieved === 3) {
          this.updateBestSet(bestSetsForExercise, '3RM (Actual)', candidateSet);
        }
        if (candidateSet.repsAchieved === 5) {
          this.updateBestSet(bestSetsForExercise, '5RM (Actual)', candidateSet);
        }

        // Estimated 1RM
        if (candidateSet.repsAchieved > 1) {
          const e1RM = candidateSet.weightUsed * (1 + candidateSet.repsAchieved / 30);
          // Create a synthetic set representing the e1RM
          const e1RMSet: LoggedSet = {
            ...candidateSet,
            repsAchieved: 1, // The result is for 1 rep
            weightUsed: parseFloat(e1RM.toFixed(2)), // The calculated weight
          };
          this.updateBestSet(bestSetsForExercise, '1RM (Estimated)', e1RMSet);
        }
      });

      // Convert the map of best sets for this exercise into the final PB array format
      bestSetsForExercise.forEach((set, pbType) => {
        allPBsFromLog.push({
          exerciseId: loggedEx.exerciseId,
          exerciseName: loggedEx.exerciseName,
          pbType: pbType,
          achievedSet: set,
          isEstimated: pbType === '1RM (Estimated)',
        });
      });
    });

    return allPBsFromLog;
  }

  /**
   * Helper function to update the map with a new best set if it's better than the existing one.
   */
  updateBestSet(
    bestSetsMap: Map<string, LoggedSet>,
    pbType: string,
    candidateSet: LoggedSet
  ): void {
    const existingBest = bestSetsMap.get(pbType);

    if (!existingBest) {
      bestSetsMap.set(pbType, candidateSet);
      return;
    }

    let isBetter = false;
    if (pbType.includes('Max Reps')) {
      if (candidateSet.repsAchieved > existingBest.repsAchieved) isBetter = true;
    } else if (pbType.includes('Max Duration')) {
      if ((candidateSet.durationPerformed ?? 0) > (existingBest.durationPerformed ?? 0)) isBetter = true;
    } else { // All other PBs are weight-based
      if ((candidateSet.weightUsed ?? 0) > (existingBest.weightUsed ?? 0)) {
        isBetter = true;
      } else if (
        (candidateSet.weightUsed ?? 0) === (existingBest.weightUsed ?? 0) &&
        candidateSet.repsAchieved > existingBest.repsAchieved
      ) {
        // This logic is for 'Heaviest Lifted' where higher reps at same weight is better
        isBetter = true;
      }
    }

    if (isBetter) {
      bestSetsMap.set(pbType, candidateSet);
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
      this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    this.menuModeDropdown = this.appSettingsService.isMenuModeDropdown();
    this.menuModeCompact = this.appSettingsService.isMenuModeCompact();
    this.menuModeModal = this.appSettingsService.isMenuModeModal();

    // +++ 2. REBUILD THE DATA FETCHING LOGIC +++
    this.workoutLogsSubscription = combineLatest([
      this.trackingService.workoutLogs$,
      this.activityService.activityLogs$,
      this.trainingProgramService.programs$.pipe(take(1)) // Get all programs once for name lookups
    ]).pipe(
      map(([workouts, activities, allPrograms]) => {
        const programMap = new Map(allPrograms.map(p => [p.id, p.name]));
        const workoutItems: EnrichedHistoryListItem[] = workouts.map(w => ({ ...w, itemType: 'workout' }));
        const activityItems: EnrichedHistoryListItem[] = activities.map(a => ({ ...a, itemType: 'activity' }));

        const combinedList = [...workoutItems, ...activityItems];
        combinedList.sort((a, b) => b.startTime - a.startTime);

        return { combinedList, programMap };
      }),
      // Use switchMap to handle the async enrichment process
      switchMap(({ combinedList, programMap }) => {
        if (combinedList.length === 0) {
          return of([]); // Return empty array if there's nothing to process
        }

        // Create an array of observables, one for each item
        const enrichmentObservables = combinedList.map(item => {
          if (item.itemType === 'workout' && item.programId) {
            // This is a workout log with a program, so we fetch details
            return combineLatest([
              this.trainingProgramService.getWeekNameForLog(item),
              this.trainingProgramService.getDayOfWeekForLog(item)
            ]).pipe(
              map(([weekName, dayInfo]) => ({
                ...item,
                programName: programMap.get(item.programId!) || null,
                weekName: weekName,
                dayName: item.dayName || dayInfo?.dayName || null,
                // totalVolume: this.getTotalVolume(item),
                // personalBests: this.getPersonalBestsFromLog(item) ? this.getPersonalBestsFromLog(item).length : 0
              } as EnrichedHistoryListItem))
            );
          } else {
            // This is an activity or a workout without a program, return as-is
            return of({
              ...item,
              // totalVolume: this.getTotalVolume(item),
              // personalBests: this.getPersonalBestsFromLog(item as WorkoutLog) ? this.getPersonalBestsFromLog(item as WorkoutLog).length : 0
            } as EnrichedHistoryListItem);
          }
        });

        // forkJoin waits for all enrichment observables to complete
        return forkJoin(enrichmentObservables);
      })
    ).subscribe(enrichedList => {
      this.allHistoryItems.set(enrichedList);
      if (this.currentHistoryView() === 'calendar') {
        this.generateHistoryCalendarDays(true);
      }
    });

    this.workoutService.routines$.pipe(take(1)).subscribe(routines => this.availableRoutines = routines);
    this.availableExercisesForFilter$ = this.exerciseService.getExercises().pipe(
      map(exercises => exercises.sort((a, b) => a.name.localeCompare(b.name)))
    );

    this.trainingProgramService.getAllPrograms().pipe(take(1)).subscribe(programs => {
      this.availableProgramsForFilter.set(programs);
    });

    this.route.queryParamMap.pipe(take(1)).subscribe(params => {
      const programId = params.get('programId');
      const routineId = params.get('routineId');
      if (programId) {
        console.log("HistoryListComponent: Should filter by programId", programId);
        // Patch the form with the programId from the URL.
        // This will automatically trigger the computed signal to filter the logs.
        this.filterForm.patchValue({ programId: programId });
        this.isFilterAccordionOpen.set(true); // Open the filters to show the user why the list is filtered
        this.toastService.info("Showing logs filtered out by training program");
      }
      if (routineId) {
        console.log("HistoryListComponent: Should filter by routineId", routineId);
        const routine = this.availableRoutines.find(routine => routine.id === routineId);
        if (routine && routine.name) {
          // Patch the form with the routineId from the URL.
          // This will automatically trigger the computed signal to filter the logs.
          this.filterForm.patchValue({ routineName: routine.name });
          this.isFilterAccordionOpen.set(true); // Open the filters to show the user why the list is filtered
          this.toastService.info("Showing logs filtered out by routine name");
        }
      }
    });
  }

  ngAfterViewInit(): void {
    // HammerJS setup is handled by @ViewChild setter
  }

  private setupHistoryCalendarSwipe(calendarSwipeElement: HTMLElement): void {
    let lastSwipeTime = 0;
    const swipeDebounce = 350;

    this.ngZone.runOutsideAngular(() => {
      this.hammerInstanceHistoryCalendar = new Hammer(calendarSwipeElement);
      this.hammerInstanceHistoryCalendar.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 40, velocity: 0.3 });

      this.hammerInstanceHistoryCalendar.on('swipeleft', () => {
        const now = Date.now();
        if (now - lastSwipeTime < swipeDebounce || this.isHistoryCalendarAnimating) return;
        lastSwipeTime = now;
        this.ngZone.run(() => this.nextHistoryMonth());
      });
      this.hammerInstanceHistoryCalendar.on('swiperight', () => {
        const now = Date.now();
        if (now - lastSwipeTime < swipeDebounce || this.isHistoryCalendarAnimating) return;
        lastSwipeTime = now;
        this.ngZone.run(() => this.previousHistoryMonth());
      });
      console.log("HammerJS attached to HISTORY calendar swipe container");
    });
  }

  setView(view: HistoryListView): void {
    const current = this.currentHistoryView();
    if (current === view) return;
    let enterTransform = 'translateX(100%)', leaveTransform = 'translateX(-100%)';
    if (view === 'list') {
      enterTransform = (current === 'calendar') ? 'translateX(-100%)' : 'translateX(100%)';
      leaveTransform = (current === 'calendar') ? 'translateX(100%)' : 'translateX(-100%)';
      this.resetFilters();
    }
    else {
      enterTransform = (current === 'list') ? 'translateX(100%)' : 'translateX(-100%)';
      leaveTransform = (current === 'list') ? 'translateX(-100%)' : 'translateX(100%)';
    }
    this.historyViewAnimationParams.set({ value: view, params: { enterTransform, leaveTransform } });
    this.currentHistoryView.set(view);
    this.isFilterAccordionOpen.set(false);
    if (view === 'calendar') {
      this.historyCalendarAnimationState.set('center');
      this.generateHistoryCalendarDays(true);
    }
  }

  generateHistoryCalendarDays(isInitialLoad: boolean = false): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.historyCalendarDays.set([]);
      this.historyCalendarLoading.set(false);
      return;
    }
    this.historyCalendarLoading.set(true);
    const viewDate = this.historyCalendarViewDate();
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const rangeStart = startOfWeek(monthStart, { weekStartsOn: this.weekStartsOn });
    const rangeEnd = endOfWeek(monthEnd, { weekStartsOn: this.weekStartsOn });
    const dateRange = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    // +++ THIS IS THE FIX +++
    // Use the unified allHistoryItems() signal, which contains both workouts and activities.
    const logsForMonth = this.allHistoryItems().filter(item => {
      const logDate = parseISO(item.date); // 'date' is a common property on both models
      return logDate >= monthStart && logDate <= monthEnd;
    });

    const days: HistoryCalendarDay[] = dateRange.map(date => {
      // Filter the items for this specific day.
      const logsOnThisDay = logsForMonth.filter(item => isSameDay(parseISO(item.date), date));
      return {
        date: date,
        isCurrentMonth: isSameMonth(date, viewDate),
        isToday: isToday(date),
        hasLog: logsOnThisDay.length > 0,
        logCount: logsOnThisDay.length
      };
    });

    this.historyCalendarDays.set(days);
    this.historyCalendarLoading.set(false);

    if (isInitialLoad) {
      this.historyCalendarAnimationState.set('center');
    } else if (this.historyCalendarAnimationState() === 'preloadFromLeft' || this.historyCalendarAnimationState() === 'preloadFromRight') {
      Promise.resolve().then(() => this.historyCalendarAnimationState.set('center'));
    }
    this.isHistoryCalendarAnimating = false;
    this.cdr.detectChanges();
  }

  private changeHistoryCalendarMonth(direction: 'next' | 'previous'): void {
    if (this.isHistoryCalendarAnimating) return;
    this.isHistoryCalendarAnimating = true;
    let outState: 'outLeft' | 'outRight'; let preloadState: 'preloadFromLeft' | 'preloadFromRight';
    if (direction === 'next') {
      outState = 'outLeft'; preloadState = 'preloadFromRight';
      this.historyCalendarViewDate.update(d => addMonths(d, 1));
    } else {
      outState = 'outRight'; preloadState = 'preloadFromLeft';
      this.historyCalendarViewDate.update(d => subMonths(d, 1));
    }
    this.historyCalendarAnimationState.set(outState);
    setTimeout(() => {
      this.historyCalendarAnimationState.set(preloadState);
      this.generateHistoryCalendarDays();
    }, 200);
  }

  previousHistoryMonth(): void { this.changeHistoryCalendarMonth('previous'); }
  nextHistoryMonth(): void { this.changeHistoryCalendarMonth('next'); }

  goToTodayHistoryCalendar(): void {
    if (this.isHistoryCalendarAnimating || isSameMonth(this.historyCalendarViewDate(), new Date())) return;
    this.isHistoryCalendarAnimating = true;
    const today = new Date(); const currentCalDate = this.historyCalendarViewDate();
    let outState: 'outLeft' | 'outRight'; let preloadState: 'preloadFromLeft' | 'preloadFromRight';
    if (currentCalDate > today) { outState = 'outRight'; preloadState = 'preloadFromLeft'; }
    else { outState = 'outLeft'; preloadState = 'preloadFromRight'; }
    this.historyCalendarAnimationState.set(outState);
    setTimeout(() => {
      this.historyCalendarViewDate.set(new Date());
      this.historyCalendarAnimationState.set(preloadState);
      this.generateHistoryCalendarDays();
    }, 200);
  }

  selectHistoryDay(day: HistoryCalendarDay): void {
    if (this.isHistoryCalendarAnimating) return;

    if (day.hasLog) {
      // +++ 2. UPDATE THIS LOGIC +++
      // Filter the master list to get all items for the selected date
      const itemsForDay = this.allHistoryItems().filter(item =>
        isSameDay(new Date(item.startTime), day.date)
      );
      this.selectedDayItems.set(itemsForDay); // Set our new signal

      this.showPastLoggedWorkouts = true;
      this.pastLoggedWorkoutsDay = day;
    } else {
      this.toastService.clearAll();
      this.toastService.info("No activities logged on this day", 2000);
    }
  }

  // Expose isSameMonth to the template
  isSameMonth(date1: Date, date2: Date): boolean {
    return isSameMonth(date1, date2);
  }

  getHistoryWeekDayNames(): string[] {
    const start = startOfWeek(new Date(), { weekStartsOn: this.weekStartsOn });
    return eachDayOfInterval({ start, end: addDays(start, 6) }).map(d => format(d, 'EE'));
  }

  toggleFilterAccordion(): void { this.isFilterAccordionOpen.update(isOpen => !isOpen); }
  resetFilters(): void {
    this.filterForm.reset({ dateFrom: '', dateTo: '', routineName: '', exerciseId: '', programId: '' });
  }

  vibrate(): void {
    const currentVibrator = navigator;
    if (currentVibrator && 'vibrate' in currentVibrator) {
      currentVibrator.vibrate(50);
    }
  }

  viewLogDetails(logId: string, event?: MouseEvent): void {
    this.vibrate();
    event?.stopPropagation(); this.router.navigate(['/history/log', logId]);
    this.visibleActionsRutineId.set(null);
  }
  editLogDetails(logId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/workout/log/manual/edit', logId]);
    this.visibleActionsRutineId.set(null);
  }

  goToRoutineDetails(logId: string): void {
    if (!logId) {
      return;
    } else {
      const currentLog = this.allWorkoutLogs().find(log => log.id === logId);
      if (currentLog && currentLog.routineId) {
        this.router.navigate(['/workout/routine/view/', currentLog.routineId]);
      }
    }
  }

  async deleteLogDetails(logId: string, event?: MouseEvent): Promise<void> {
    event?.stopPropagation(); this.visibleActionsRutineId.set(null);

    const confirm = await this.alertService.showConfirmationDialog(
      "Delete Workout Log",
      `Are you sure you want to delete this workout log? This action cannot be undone`,
      [
        { text: "Cancel", role: "cancel", data: false, icon: 'cancel', iconClass: 'w-4 h-4 mr-1' } as AlertButton,
        { text: "Delete", role: "confirm", data: true, cssClass: "bg-red-600", icon: 'trash' } as AlertButton,
      ],
    );
    if (confirm && confirm.data) {
      try {
        this.spinnerService.show(); await this.trackingService.deleteWorkoutLog(logId);
        this.toastService.success("Workout log deleted successfully");
      } catch (err) { this.toastService.error("Failed to delete workout log"); }
      finally { this.spinnerService.hide(); }
    }
  }
  async clearAllLogsForDev(): Promise<void> {
    if (this.trackingService.clearAllWorkoutLogs_DEV_ONLY) { await this.trackingService.clearAllWorkoutLogs_DEV_ONLY(); }
    if (this.trackingService.clearAllPersonalBests_DEV_ONLY) { await this.trackingService.clearAllPersonalBests_DEV_ONLY(); }
    if (this.workoutService.clearAllExecutedRoutines_DEV_ONLY) { await this.workoutService.clearAllExecutedRoutines_DEV_ONLY(); }
  }
  // toggleActions(logId: string, event: MouseEvent): void { event.stopPropagation(); this.visibleActionsRutineId.update(current => (current === logId ? null : logId)); }

  activeItemIdActions = signal<string | null>(null); // Store ID of routine whose actions are open
  toggleActions(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeItemIdActions.update(current => (current === routineId ? null : routineId));
  }

  // areActionsVisible(logId: string): boolean { return this.visibleActionsRutineId() === logId; }

  ngOnDestroy(): void {
    this.workoutLogsSubscription?.unsubscribe();
    this.hammerInstanceHistoryCalendar?.destroy();
  }

  logPastWorkout(): void {
    // check if there's a pending workout, if so block the user
    const isWorkoutPending = this.storageService.checkForPausedWorkout();
    if (isWorkoutPending) {
      this.discardPausedWorkout();
    } else {
      this.navigateToLogWorkout();
    }
  }

  logPastActivity(): void {
    this.router.navigate(['/activities/log']);
  }

  navigateToLogWorkout(): void {
    this.router.navigate(['/workout/log/manual/new']);
  }

  async discardPausedWorkout(): Promise<void> {
    this.vibrate();

    const buttons: AlertButton[] = [
      { text: 'Cancel', role: 'cancel', data: false, icon: 'cancel' },
      { text: 'Discard', role: 'confirm', data: true, cssClass: 'bg-red-500 hover:bg-red-600 text-white', icon: 'trash' },
    ];

    const confirm = await this.alertService.showConfirmationDialog(
      'Pending Workout found',
      'There\'s a pending workout: do you want to discard this paused workout session and log a new one? This action cannot be undone.',
      buttons
    );
    if (confirm && confirm.data) {
      if (isPlatformBrowser(this.platformId)) {
        this.storageService.removeItem('fitTrackPro_pausedWorkoutState');
        this.toastService.info('Paused workout session discarded.', 3000);
      }
      this.navigateToLogWorkout();
    }
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth' // For a smooth scrolling animation
      });
    }
  }


  getLogDropdownActionItems(routineId: string, mode: MenuMode): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left p-4 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left p-4 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center hover:text-gray-100 hover:animate-pulse';;

    const routineDetailsBtn = {
      label: 'ROUTINE',
      actionKey: 'routine',
      iconName: `routines`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { routineId }
    } as ActionMenuItem;


    const actionsArray = [
      {
        label: 'VIEW',
        actionKey: 'view',
        iconName: `eye`,
        iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      {
        label: 'EDIT',
        actionKey: 'edit',
        iconName: `edit`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      {
        label: 'CREATE ROUTINE',
        actionKey: 'create_routine',
        iconName: `create-folder`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      routineDetailsBtn,
      { isDivider: true },
      {
        label: 'DELETE',
        actionKey: 'delete',
        iconName: `trash`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
        data: { routineId }
      }
    ];
    return actionsArray;
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }): void {
    const logId = event.data?.logId || event.data?.routineId; // Handle both old and new data structures
    if (!logId) return;

    // --- Switch based on the unique action key ---
    switch (event.actionKey) {
      // Workout Actions
      case 'view': this.viewLogDetails(logId); break;
      case 'edit': this.editLogDetails(logId); break;
      case 'create_routine': this.createRoutineFromLog(logId); break;
      case 'delete': this.deleteLogDetails(logId); break;
      case 'routine': this.goToRoutineDetails(logId); break;

      // Activity Actions
      case 'view_activity': this.viewActivityLogDetails(logId); break;
      case 'edit_activity': this.editActivityLog(logId); break;
      case 'delete_activity': this.deleteActivityLog(logId); break;
    }

    this.activeItemIdActions.set(null); // Close the menu
  }

  areActionsVisible(routineId: string): boolean {
    return this.activeItemIdActions() === routineId;
  }

  // When closing menu from the component's output
  onCloseActionMenu() {
    this.activeItemIdActions.set(null);
  }

  createRoutineFromLog(logId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    // This will navigate to a new route that the workout builder will handle
    this.router.navigate(['/workout/routine/new-from-log', logId]);
    this.activeItemIdActions.set(null);
  }


  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // If an action menu is open AND the click was outside the menu container...
    if (this.activeItemIdActions() !== null) {
      // Find the menu element. We need a way to identify it. Let's give it a class.
      // We check if the clicked element or any of its parents have the 'action-menu-container' class.
      const clickedElement = event.target as HTMLElement;
      if (!clickedElement.closest('.action-menu-container')) {
        this.activeItemIdActions.set(null); // ...then close it.
      }
    }
  }

  toggleShowPastLoggedWorkouts(): void {
    this.showPastLoggedWorkouts = !this.showPastLoggedWorkouts;
    if (!this.showPastLoggedWorkouts) {
      this.pastLoggedWorkoutsDay = null;
      this.selectedDayItems.set([]);
    }
  }

  secondsToDateTime(seconds: number): Date {
    const d = new Date(0, 0, 0, 0, 0, 0, 0);
    d.setSeconds(seconds);
    return d;
  }


  // --- ADD NEW HANDLER METHODS FOR THE FAB ---

  /**
   * Toggles the FAB menu on touch devices.
   */
  handleFabClick(): void {
    this.isFabActionsOpen.update(v => !v);
  }

  /**
   * Opens the FAB menu on hover for non-touch devices.
   */
  handleFabMouseEnter(): void {
    if (!this.isTouchDevice) {
      this.isFabActionsOpen.set(true);
    }
  }

  /**
   * Closes the FAB menu on mouse leave for non-touch devices.
   */
  handleFabMouseLeave(): void {
    if (!this.isTouchDevice) {
      this.isFabActionsOpen.set(false);
    }
  }


  // +++ ADD a method to generate action items for activities +++
  getActivityLogDropdownActionItems(logId: string, mode: MenuMode): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';

    return [
      {
        label: 'VIEW',
        actionKey: 'view_activity', // Use a unique key
        iconName: 'eye',
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { logId }
      },
      {
        label: 'EDIT',
        actionKey: 'edit_activity', // Use a unique key
        iconName: 'edit',
        // iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>`, // Add your edit icon SVG
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { logId }
      },
      { isDivider: true },
      {
        label: 'DELETE',
        actionKey: 'delete_activity', // Use a unique key
        iconName: 'trash',
        // iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.177-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5Zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5Z" clip-rule="evenodd" /></svg>`, // Add your delete icon SVG
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
        data: { logId }
      }
    ];
  }



  viewActivityLogDetails(logId: string, event?: MouseEvent): void {
    this.vibrate();
    event?.stopPropagation();
    this.router.navigate(['/activities/log', logId]);
    this.activeItemIdActions.set(null);
  }

  editActivityLog(logId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/activities/log/edit', logId]);
    this.activeItemIdActions.set(null);
  }

  async deleteActivityLog(logId: string, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    this.activeItemIdActions.set(null); // Close the menu immediately

    // Find the log to get its name for the confirmation message
    const logToDelete = this.allHistoryItems().find(item => item.id === logId) as ActivityLog | undefined;
    if (!logToDelete) return; // Safety check

    const confirm = await this.alertService.showConfirmationDialog(
      'Delete Activity Log?',
      `Are you sure you want to delete the log for "${logToDelete.activityName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', role: 'cancel', data: false, icon: 'cancel' },
        { text: 'Delete', role: 'confirm', data: true, cssClass: 'bg-red-500', icon: 'trash' }
      ] as AlertButton[]
    );

    if (confirm && confirm.data) {
      this.activityService.deleteActivityLog(logId);
      // The list will update automatically via the observable stream from the service.
    }
  }

}