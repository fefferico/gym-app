// src/app/features/history/history-list/history-list.component.ts
import {
  Component, inject, OnInit, signal, computed, PLATFORM_ID, OnDestroy,
  ChangeDetectorRef, ElementRef, AfterViewInit, NgZone, ViewChild,
  HostListener
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, combineLatest, Subscription, firstValueFrom } from 'rxjs';
import { map, distinctUntilChanged, take, switchMap } from 'rxjs/operators';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ExerciseService } from '../../../core/services/exercise.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { AchievedPB, LoggedSet, PersonalBestSet, WorkoutLog } from '../../../core/models/workout-log.model';
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
  isSameDay, subMonths, isToday, startOfWeek,
  isSameMonth, // Ensure isSameMonth is imported
  addDays
} from 'date-fns';
import Hammer from 'hammerjs';
import { SpinnerService } from '../../../core/services/spinner.service';
import { ActionMenuComponent } from '../../../shared/components/action-menu/action-menu';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { ProgramDayInfo, TrainingProgram } from '../../../core/models/training-program.model';
import { PressDirective } from '../../../shared/directives/press.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { AlertButton } from '../../../core/models/alert.model';
import { ActivityLog } from '../../../core/models/activity-log.model';
import { ActivityService } from '../../../core/services/activity.service';
import { StorageService } from '../../../core/services/storage.service';
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { MenuMode } from '../../../core/models/app-settings.model';
import { createFromBtn, deleteBtn, editBtn, routineBtn, viewBtn } from '../../../core/services/buttons-data';
import { FabAction, FabMenuComponent } from '../../../shared/components/fab-menu/fab-menu.component';


interface CalendarMonth {
  monthName: string;
  year: number;
  days: HistoryCalendarDay[];
  spacers: any[]; // Used to align the first day of the month
}

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
  programName?: string; // This is string | undefined
  weekName?: string;    // This is string | undefined
  dayName?: string;     // This is string | undefined
  totalVolume?: number;
  personalBests?: number;
  cardColor?: string;
};


@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, FormsModule, ReactiveFormsModule, ActionMenuComponent, PressDirective, IconComponent, FabMenuComponent],
  templateUrl: './history-list.html',
  styleUrl: './history-list.scss',
  providers: [DecimalPipe],
  animations: [
    trigger('slideView', [
      transition('list => calendar', [
        style({ position: 'relative' }),
        query(':enter, :leave', [
          style({
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%' // Ensure children take full height within their 'absolute' context
          })
        ], { optional: true }),
        query(':enter', [
          style({ left: '100%', opacity: 0 }) // Add opacity 0 for smoother entry
        ], { optional: true }),
        query(':leave', [
          style({ left: '0%', opacity: 1 }) // Start with full opacity
        ], { optional: true }),
        group([
          query(':leave', [
            animate('300ms ease-out', style({ left: '-100%', opacity: 0 })) // Animate opacity out
          ], { optional: true }),
          query(':enter', [
            animate('300ms ease-out', style({ left: '0%', opacity: 1 })) // Animate opacity in
          ], { optional: true }),
          // Add animation for the parent's height to adjust dynamically
          // This targets the host element (the div with [@slideView])
          animate('300ms ease-out', style({ height: '*' }))
        ])
      ]),
      transition('calendar => list', [
        style({ position: 'relative' }),
        query(':enter, :leave', [
          style({
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%' // Ensure children take full height within their 'absolute' context
          })
        ], { optional: true }),
        query(':enter', [
          style({ left: '-100%', opacity: 0 }) // Add opacity 0 for smoother entry
        ], { optional: true }),
        query(':leave', [
          style({ left: '0%', opacity: 1 }) // Start with full opacity
        ], { optional: true }),
        group([
          query(':leave', [
            animate('300ms ease-out', style({ left: '100%', opacity: 0 })) // Animate opacity out
          ], { optional: true }),
          query(':enter', [
            animate('300ms ease-out', style({ left: '0%', opacity: 1 })) // Animate opacity in
          ], { optional: true }),
          // Add animation for the parent's height to adjust dynamically
          animate('300ms ease-out', style({ height: '*' }))
        ])
      ])
    ]),
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
      state('center', style({ transform: 'translateY(0%)', opacity: 1 })),
      state('outUp', style({ transform: 'translateY(-100%)', opacity: 0 })),
      state('outDown', style({ transform: 'translateY(100%)', opacity: 0 })),
      state('preloadFromDown', style({ transform: 'translateY(100%)', opacity: 0 })),
      state('preloadFromUp', style({ transform: 'translateY(-100%)', opacity: 0 })),
      transition('center => outUp', animate('200ms ease-in')),
      transition('center => outDown', animate('200ms ease-in')),
      transition('preloadFromDown => center', animate('200ms ease-out')),
      transition('preloadFromUp => center', animate('200ms ease-out')),
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
    if (isPlatformBrowser(this.platformId)) {
      this.showBackToTopButton.set(window.pageYOffset > 400);

      // +++ NEW: Infinite Scroll Logic +++
      // If the user has scrolled to the bottom of the page and we're in calendar view...
      if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50) {
        if (this.currentHistoryView() === 'calendar' && !this.historyCalendarLoading()) {
          // ...load the next month.
          this.loadNextCalendarMonth();
        }
      }
    }
  }

  historyCalendarLoading = signal(false);
  weekStartsOn: 0 | 1 = 1;
  readonly todayForCalendar = new Date(); // Property to hold today's date for the template
  historyCalendarMonths = signal<CalendarMonth[]>([]);
  private currentCalendarDate = new Date(); // Start with the current month


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
        if (filters.cardColor) {
          match &&= item.cardColor === filters.cardColor;
        }

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
        if (filters.cardColor) { // An activity cannot match a color filter
          match = false;
        }
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
      programId: [''],
      cardColor: ['']
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
  * Calculates the total volume from a workout log.
  * This is now a pure calculation function.
  *
  * @param log The WorkoutLog to analyze.
  * @returns The total volume as a number, or null if it cannot be calculated.
  */
  getTotalVolume(log: WorkoutLog): number | null {
    if (!log.exercises) {
      return 0; // Return 0 if there are no exercises
    }

    return log.exercises.reduce((totalVolume, exercise) => {
      const exerciseVolume = exercise.sets.reduce((volume, set) => {
        // Ensure both reps and weight are valid numbers for calculation
        if (typeof set.repsAchieved === 'number' && typeof set.weightUsed === 'number') {
          return Math.ceil(volume + (set.repsAchieved * set.weightUsed));
        }
        return volume;
      }, 0);
      return totalVolume + exerciseVolume;
    }, 0);
  }

  /**
   * Extracts all *newly achieved global* personal bests within a single workout log.
   * This function compares sets in the provided log against the current all-time PBs
   * to identify if any set constitutes a new best.
   *
   * @param log The WorkoutLog to analyze.
   * @param allCurrentPBs A snapshot of all global personal bests from TrackingService.
   * @returns An array of AchievedPB objects, each representing a *new global PB* set in that log.
   */
  getPersonalBestsFromLog(log: WorkoutLog, allCurrentPBs: Record<string, PersonalBestSet[]>): AchievedPB[] {
    const newlyAchievedPBs: AchievedPB[] = [];

    // Early exit if no exercises or log has no ID
    if (!log.exercises || log.exercises.length === 0 || !log.id) {
      return [];
    }

    log.exercises.forEach(loggedEx => {
      // Get current PBs for this specific exercise
      const currentExercisePBs = allCurrentPBs[loggedEx.exerciseId] || [];

      loggedEx.sets.forEach(candidateSet => {
        // Ensure set has required context
        if (!candidateSet.timestamp || !candidateSet.workoutLogId || !candidateSet.exerciseId) {
          console.warn('Skipping candidate set due to missing context for PB check:', candidateSet);
          return;
        }

        // Helper to check and add PB if it's a new global best achieved by this set
        const checkForAndAddPb = (pbType: string, set: LoggedSet, isEstimated: boolean = false) => {
          const existingGlobalPb = currentExercisePBs.find(pb => pb.pbType === pbType);

          let isNewGlobalBest = false;

          if (!existingGlobalPb) {
            // No existing global PB of this type, so this set *could* be the first one.
            // Check if this set's workoutLogId and timestamp match the log, indicating it's the one that established it.
            if (set.workoutLogId === log.id && set.timestamp === (set.timestamp || new Date(log.startTime).toISOString())) {
              isNewGlobalBest = true;
            }
          } else {
            // There's an existing global PB. Check if this candidate set is *the one* that achieved it.
            // This means its performance equals the global PB AND it comes from THIS log.
            const isSameLogAndSet = existingGlobalPb.workoutLogId === log.id &&
              existingGlobalPb.timestamp === set.timestamp &&
              existingGlobalPb.exerciseId === set.exerciseId;

            // More robust check: The PB data in TrackingService's PB set will contain the *exact* set that achieved it.
            // So, we just need to see if the current log's ID and the set's timestamp match the global PB's record.
            if (isSameLogAndSet &&
              existingGlobalPb.weightUsed === set.weightUsed &&
              existingGlobalPb.repsAchieved === set.repsAchieved &&
              existingGlobalPb.durationPerformed === set.durationPerformed) {
              isNewGlobalBest = true;
            }
            // For estimated 1RM, the `weightUsed` could be slightly different due to float precision,
            // so a direct comparison on original values might be needed if `weightUsed` is the calculated e1RM.
            // The safest is to check against the PB's own workoutLogId and timestamp.
          }

          if (isNewGlobalBest) {
            // Check for duplicates before adding (important for recalculation scenarios)
            const isAlreadyAdded = newlyAchievedPBs.some(
              pb => pb.exerciseId === loggedEx.exerciseId && pb.pbType === pbType
            );
            if (!isAlreadyAdded) {
              newlyAchievedPBs.push({
                exerciseId: loggedEx.exerciseId,
                exerciseName: loggedEx.exerciseName,
                pbType: pbType,
                achievedSet: set,
                isEstimated: isEstimated,
              });
            }
          }
        };

        // --- PB Type Checks ---
        // Bodyweight or duration-based PBs
        if (!candidateSet.weightUsed) {
          if (candidateSet.repsAchieved > 0) {
            checkForAndAddPb('Max Reps (Bodyweight)', candidateSet);
          }
          if (candidateSet.durationPerformed && candidateSet.durationPerformed > 0) {
            checkForAndAddPb('Max Duration', candidateSet);
          }
          return; // Move to the next set
        }

        // Weight-based PBs
        checkForAndAddPb('Heaviest Lifted', candidateSet);
        if (candidateSet.repsAchieved === 1) {
          checkForAndAddPb('1RM (Actual)', candidateSet);
        }
        if (candidateSet.repsAchieved === 3) {
          checkForAndAddPb('3RM (Actual)', candidateSet);
        }
        if (candidateSet.repsAchieved === 5) {
          checkForAndAddPb('5RM (Actual)', candidateSet);
        }

        // Estimated 1RM
        if (candidateSet.repsAchieved > 1) {
          const e1RM = candidateSet.weightUsed * (1 + candidateSet.repsAchieved / 30);
          const e1RMSet: LoggedSet = {
            ...candidateSet,
            repsAchieved: 1, // The result is for 1 rep
            weightUsed: parseFloat(e1RM.toFixed(2)), // The calculated weight
          };
          // For estimated 1RM, the check needs to be against the calculated value
          checkForAndAddPb('1RM (Estimated)', e1RMSet, true);
        }
      });
    });

    return newlyAchievedPBs;
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

    this.workoutLogsSubscription = combineLatest([
      this.trackingService.workoutLogs$,
      this.activityService.activityLogs$,
      this.trainingProgramService.programs$.pipe(take(1)),
      // --- NEW: Include personalBests$ in the combined stream ---
      this.trackingService.personalBests$,
      this.workoutService.routines$.pipe(take(1))
    ]).pipe(
      // Step 1: Combine sources and prepare initial data structures
      map(([workouts, activities, allPrograms, allGlobalPBs, allRoutines]) => {
        const programMap = new Map(allPrograms.map(p => [p.id, p.name]));
        const workoutItems: HistoryListItem[] = workouts.map(w => ({ ...w, itemType: 'workout' }));
        const activityItems: HistoryListItem[] = activities.map(a => ({ ...a, itemType: 'activity' }));
        const combinedList: HistoryListItem[] = [...workoutItems, ...activityItems];
        combinedList.sort((a, b) => b.startTime - a.startTime);
        return { combinedList, programMap, allGlobalPBs, allRoutines }; // Pass allGlobalPBs down
      }),
      // Step 2: Use switchMap to handle the async enrichment process
      switchMap(async ({ combinedList, programMap, allGlobalPBs, allRoutines }) => { // Receive allGlobalPBs here
        // Use Promise.all to wait for all async enrichment operations to complete
        const enrichedList = await Promise.all(
          // Pass allRoutines into the enrichment function
          combinedList.map(item => this.enrichHistoryItem(item, programMap, allGlobalPBs, allRoutines))
        );
        return enrichedList;
      })
    ).subscribe(enrichedList => {
      // Step 3: The result is now a clean, correctly typed array
      this.allHistoryItems.set(enrichedList);
      this.populateHistoryColorFilter(enrichedList);
      if (this.currentHistoryView() === 'calendar') {
        this.historyCalendarMonths.set([]); // Clear previous
        this.currentCalendarDate = new Date(); // Reset to today
        this.generateCalendarMonths(this.currentCalendarDate, 3); // Initial load of 3 months
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
        this.filterForm.patchValue({ programId: programId });
        this.isFilterAccordionOpen.set(true);
        this.toastService.info("Showing logs filtered out by training program");
      }
      if (routineId) {
        const routine = this.availableRoutines.find(r => r.id === routineId);
        if (routine && routine.name) {
          this.filterForm.patchValue({ routineName: routine.name });
          this.isFilterAccordionOpen.set(true);
          this.toastService.info("Showing logs filtered out by routine name");
        }
      }
    });
    this.refreshFabMenuItems();
  }

  // Update the function signature to accept `allRoutines` as an argument
  private async enrichHistoryItem(
    item: HistoryListItem,
    programMap: Map<string, string>,
    allGlobalPBs: Record<string, PersonalBestSet[]>,
    allRoutines: Routine[] // <-- ADD THIS PARAMETER
  ): Promise<EnrichedHistoryListItem> {
    if (item.itemType === 'activity') {
      return item;
    }

    const workoutLogItem = item;
    let weekName: string | null = null;
    let dayInfo: ProgramDayInfo | null = null;

    // Use the `allRoutines` array passed into the function, NOT `this.availableRoutines`
    const routine = allRoutines.find(r => r.id === workoutLogItem.routineId);

    if (workoutLogItem.programId) {
      [weekName, dayInfo] = await firstValueFrom(combineLatest([
        this.trainingProgramService.getWeekNameForLog(workoutLogItem),
        this.trainingProgramService.getDayOfWeekForLog(workoutLogItem)
      ]));
    }

    const enrichedItem: EnrichedHistoryListItem = {
      ...workoutLogItem,
      programName: programMap.get(workoutLogItem.programId!) ?? undefined,
      weekName: weekName ?? undefined,
      dayName: dayInfo?.dayName,
      totalVolume: this.getTotalVolume(workoutLogItem) ?? undefined,
      personalBests: this.getPersonalBestsFromLog(workoutLogItem, allGlobalPBs)?.length || 0,
      cardColor: routine?.cardColor
    };

    return enrichedItem;
  }

  private calendarScrollDebounceTimer: any;



  ngAfterViewInit(): void {
    // HammerJS setup is handled by @ViewChild setter
    this.setupSwipeGestures();
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
    if (view === 'calendar' && this.historyCalendarMonths().length === 0) {
      this.currentCalendarDate = new Date(); // Reset to today
      this.generateCalendarMonths(this.currentCalendarDate, 3); // Initial load
    }
  }

  getCalendarDayClasses(day: HistoryCalendarDay): object {
    return {
      'text-black dark:text-white cursor-default': true,
      // 'cursor-default': !day.hasLog,
      'ring-4 ring-primary font-bold': day.isToday,
      'text-gray-800 dark:text-gray-200': !day.isToday,
      'text-gray-400 dark:text-gray-500': !day.isCurrentMonth, // This can be used if you re-add padding days
      'cursor-pointer hover:bg-green-700 bg-green-500 text-white font-bold': day.hasLog,
    };
  }


  selectHistoryDay(day: HistoryCalendarDay): void {
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
    this.filterForm.reset({ dateFrom: '', dateTo: '', routineName: '', exerciseId: '', programId: '', cardColor: '' });
    this.isColorFilterOpen.set(false); // Also close dropdown
  }

  viewLogDetails(logId: string, event?: MouseEvent): void {
    this.workoutService.vibrate();
    event?.stopPropagation(); this.router.navigate(['/history/log', logId]);
    this.visibleActionsRutineId.set(null);
  }
  editLogDetails(logId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/workout/log/manual/edit', logId]);
    this.visibleActionsRutineId.set(null);
  }

  async goToRoutineDetails(logId: string): Promise<void> {
    if (!logId) {
      return;
    } else {
      const currentLog: any = this.getWorkoutLogs().find(log => log.id === logId);
      if (currentLog && currentLog.routineId && currentLog.routineId !== '-1') {
        this.router.navigate(['/workout/routine/view/', currentLog.routineId]);
      } else {
        const createNewRoutineFromLog = await this.alertService.showConfirm("No routine for log", "There is no routine associated with this log: would you like to create one? If so remember to link it to this log once created");
        if (createNewRoutineFromLog && createNewRoutineFromLog.data) {
          this.createRoutineFromLog(logId);
        }
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
    if (this.hammerInstance) {
      this.hammerInstance.destroy();
    }
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
    this.workoutService.vibrate();

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


  getLogDropdownActionItems(logId: string, mode: MenuMode): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left p-4 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left p-4 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center hover:text-gray-100 hover:animate-pulse';

    const routineDetailsBtn = {
      ...routineBtn,
      label: 'WOD',
      data: { routineId: logId }
    } as ActionMenuItem;

    const fullLog = this.getWorkoutLogs().find(log => log.id === logId);
    const routine = fullLog && fullLog.routineId ? this.availableRoutines.find(routine => routine.id === fullLog.routineId) : null;

    const createRoutineFromLogBtn = {
      ...createFromBtn,
      data: { routineId: logId }
    } as ActionMenuItem;


    let actionsArray: ActionMenuItem[] = [
      {
        ...viewBtn,
        data: { routineId: logId }
      }];
    actionsArray.push({
      ...editBtn,
      data: { routineId: logId }
    });

    if (!routine) {
      actionsArray.push(createRoutineFromLogBtn);
    }

    actionsArray = [...actionsArray, routineDetailsBtn,
    {
      ...deleteBtn,
      data: { routineId: logId }
    }];
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
    if (this.isColorFilterOpen() && !this.colorFilterContainer.nativeElement.contains(event.target)) {
      this.isColorFilterOpen.set(false);
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
    this.workoutService.vibrate();
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

  getWorkoutLogs(): WorkoutLog[] {
    return this.allHistoryItems().filter(log => log.itemType === 'workout') || [];
  }

  getActivityLogs(): ActivityLog[] {
    return this.allHistoryItems().filter(log => log.itemType === 'activity') || [];
  }

  fabMenuItems: FabAction[] = [];
  private refreshFabMenuItems(): void {
    this.fabMenuItems = [{
      label: 'LOG PAST WORKOUT',
      actionKey: 'log_past_workout',
      iconName: 'plus-circle',
      cssClass: 'bg-blue-500 focus:ring-blue-400',
      isPremium: false
    },
    {
      label: 'LOG PAST ACTIVITY',
      actionKey: 'log_past_activity',
      iconName: 'plus-circle',
      cssClass: 'bg-teal-500 focus:ring-teal-400',
      isPremium: true
    }
    ];
  }

  onFabAction(actionKey: string): void {
    switch (actionKey) {
      case 'log_past_workout':
        this.logPastWorkout();
        break;
      case 'log_past_activity':
        this.logPastActivity();
        break;
    }
  }

  generateCalendarMonths(startDate: Date, numberOfMonths: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.historyCalendarLoading.set(true);

    const newMonths: CalendarMonth[] = [];
    const allLogs = this.allHistoryItems();

    for (let i = 0; i < numberOfMonths; i++) {
      const targetDate = subMonths(startDate, i);
      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);
      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

      const firstDayOfMonth = startOfWeek(monthStart, { weekStartsOn: this.weekStartsOn });
      const dayOfWeekForFirst = monthStart.getDay();
      const effectiveStartOfWeek = (this.weekStartsOn === 1) ? (dayOfWeekForFirst === 0 ? 6 : dayOfWeekForFirst - 1) : dayOfWeekForFirst;

      newMonths.push({
        monthName: format(targetDate, 'LLLL'),
        year: targetDate.getFullYear(),
        spacers: Array(effectiveStartOfWeek).fill(0),
        days: daysInMonth.map(date => {
          const logsOnThisDay = allLogs.filter(log => isSameDay(parseISO(log.date), date));
          return {
            date: date,
            isCurrentMonth: true, // All days belong to their month
            isToday: isToday(date),
            hasLog: logsOnThisDay.length > 0,
            logCount: logsOnThisDay.length,
          };
        }),
      });
    }

    this.historyCalendarMonths.update(existingMonths => [...existingMonths, ...newMonths]);
    this.currentCalendarDate = subMonths(startDate, numberOfMonths); // Update the date for the next load
    this.historyCalendarLoading.set(false);
  }

  // --- NEW: Helper to load the next batch of months ---
  private loadNextCalendarMonth(): void {
    // Load one more month, starting from the last loaded month
    this.generateCalendarMonths(this.currentCalendarDate, 1);
  }

  @ViewChild('swipeContainer') swipeContainer: ElementRef | undefined;
  private hammerInstance: HammerManager | undefined;

  private setupSwipeGestures(): void {
    if (isPlatformBrowser(this.platformId) && this.swipeContainer) {
      this.ngZone.runOutsideAngular(() => {
        this.hammerInstance = new Hammer(this.swipeContainer!.nativeElement);

        this.hammerInstance.on('swipeleft', () => {
          this.ngZone.run(() => {
            if (this.currentHistoryView() === 'list') {
              this.setView('calendar');
            }
          });
        });

        this.hammerInstance.on('swiperight', () => {
          this.ngZone.run(() => {
            if (this.currentHistoryView() === 'calendar') {
              this.setView('list');
            }
          });
        });
      });
    }
  }

  protected getTextColor(log: EnrichedHistoryListItem): string {
    if (!log || log === undefined) {
      return '';
    }
    const routine = log;
    if (routine === undefined) {
      return '';
    }
    if (!routine.cardColor) {
      return 'text-gray-600 dark:text-gray-100';
    }
    if (!!routine.cardColor) {
      return 'text-white';
    }
    return '';
  }

  uniqueHistoryColors = signal<string[]>([]);
  private populateHistoryColorFilter(items: EnrichedHistoryListItem[]): void {
    const colors = new Set<string>();
    items.forEach(item => {
      if (item.itemType === 'workout' && item.cardColor) {
        colors.add(item.cardColor);
      }
    });
    this.uniqueHistoryColors.set(Array.from(colors).sort());
  }

  // --- START: ADD/UPDATE PROPERTIES ---
  isColorFilterOpen = signal(false);
  @ViewChild('colorFilterContainer') colorFilterContainer!: ElementRef;
  // --- END: ADD/UPDATE PROPERTIES ---

  // --- ADD/UPDATE METHODS FOR THE CUSTOM DROPDOWN ---
  toggleColorFilterDropdown(): void {
    this.isColorFilterOpen.update(isOpen => !isOpen);
  }

  selectColorFilter(color: string | null, event: Event): void {
    event.stopPropagation();
    this.filterForm.patchValue({ cardColor: color || '' });
    this.isColorFilterOpen.set(false);
  }

  // Helper for the template to get the current value
  getCurrentColorFilterValue(): string {
    return this.filterForm.get('cardColor')?.value || '';
  }

}