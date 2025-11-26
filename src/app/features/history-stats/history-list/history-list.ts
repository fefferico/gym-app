// src/app/features/history/history-list/history-list.component.ts
import {
  Component, inject, OnInit, signal, computed, PLATFORM_ID, OnDestroy,
  ChangeDetectorRef, ElementRef, AfterViewInit, NgZone, ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, combineLatest, Subscription, firstValueFrom } from 'rxjs';
import { map, distinctUntilChanged, take, switchMap } from 'rxjs/operators';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ExerciseService, HydratedExercise } from '../../../core/services/exercise.service';
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
  addDays,
  Locale
} from 'date-fns';
import { it, es, fr, enUS, de } from 'date-fns/locale';
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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';
import { ColorsService } from '../../../core/services/colors.service';
import { BumpClickDirective } from '../../../shared/directives/bump-click.directive';
import { repsTypeToReps, genRepsTypeFromRepsNumber, getDurationValue, getWeightValue, weightToExact } from '../../../core/services/workout-helper.service';
import { LocationService } from '../../../core/services/location.service';
import { CdkVirtualForOf, CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { WorkoutUtilsService } from '../../../core/services/workout-utils.service';


interface CalendarMonth {
  monthName: string;
  monthDate: Date;
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
  imports: [CdkVirtualScrollViewport, CdkVirtualForOf, ScrollingModule, CommonModule, DatePipe, FormsModule, ReactiveFormsModule, ActionMenuComponent, PressDirective, IconComponent, FabMenuComponent, TranslateModule, BumpClickDirective],
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
  protected workoutUtilsService = inject(WorkoutUtilsService);
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
  private translate = inject(TranslateService);
  private languageService = inject(LanguageService);
  protected colorsService = inject(ColorsService);
  protected locationService = inject(LocationService);

  private dateFnsLocales: { [key: string]: Locale } = {
    en: enUS,
    it: it,
    es: es,
    fr: fr,
    de: de
  };

  selectedDayItems = signal<EnrichedHistoryListItem[]>([]);
  protected allHistoryItems = signal<EnrichedHistoryListItem[]>([]);
  private workoutLogsSubscription: Subscription | undefined;

  availableExercisesForFilter$: Observable<HydratedExercise[]> | undefined;
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

    // --- Filter by log type ---
    if (filters.logType === 'workout') {
      items = items.filter(item => item.itemType === 'workout');
    } else if (filters.logType === 'activity') {
      items = items.filter(item => item.itemType === 'activity');
    }

    let filtered = items.filter(item => {
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
        if (filters.programId && filters.programId !== '') {
          match &&= String(item.programId || '') === String(filters.programId);
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

    // --- Sorting ---
    switch (filters.sortBy) {
      case 'alphabetical':
        filtered = [...filtered].sort((a, b) => {
          const aName = (a.itemType === 'workout' ? a.routineName : a.activityName) || '';
          const bName = (b.itemType === 'workout' ? b.routineName : b.activityName) || '';
          return aName.localeCompare(bName);
        });
        break;
      case 'highestVolume':
        filtered = [...filtered].sort((a, b) => {
          const aVol = a.itemType === 'workout' ? a.totalVolume ?? 0 : 0;
          const bVol = b.itemType === 'workout' ? b.totalVolume ?? 0 : 0;
          return bVol - aVol; // Descending: highest first
        });
        break;
      case 'longestSession':
        filtered = [...filtered].sort((a, b) => (b.durationMinutes ?? 0) - (a.durationMinutes ?? 0));
        break;
      case 'mostExercises':
        filtered = [...filtered].sort((a, b) => {
          const aCount = a.itemType === 'workout' ? (a.exercises?.length ?? 0) : 0;
          const bCount = b.itemType === 'workout' ? (b.exercises?.length ?? 0) : 0;
          return bCount - aCount;
        });
        break;
      case 'mostPBs':
        filtered = [...filtered].sort((a, b) => {
          const bPB = b.itemType === 'workout' ? (b.personalBests ?? 0) : 0;
          const aPB = a.itemType === 'workout' ? (a.personalBests ?? 0) : 0;
          return bPB - aPB;
        });
        break;
      case 'lastUsed':
      default:
        filtered = [...filtered].sort((a, b) => b.startTime - a.startTime);
        break;
    }

    return filtered; // The list is already sorted from the source observable
  });

  constructor() {
    this.filterForm = this.fb.group({
      dateFrom: [''],
      dateTo: [''],
      routineName: [''],
      exerciseId: [''],
      programId: [''],
      cardColor: [''],
      logType: [''],    // NEW: 'workout', 'activity', or ''
      sortBy: ['lastUsed'] // NEW: default sort
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
        if (this.workoutUtilsService.getRepsValue(set.repsLogged) !== undefined && this.workoutUtilsService.getWeightValue(set.weightLogged) !== undefined) {
          const reps = this.workoutUtilsService.getRepsValue(set.repsLogged);
          const weight = this.workoutUtilsService.getWeightValue(set.weightLogged);
          if (reps !== undefined && weight !== undefined) {
            return Math.ceil(volume + (reps * weight));
          }
          return volume;
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
              existingGlobalPb.weightLogged === set.weightLogged &&
              existingGlobalPb.repsLogged === set.repsLogged &&
              existingGlobalPb.durationLogged === set.durationLogged) {
              isNewGlobalBest = true;
            }
            // For estimated 1RM, the `weightLogged` could be slightly different due to float precision,
            // so a direct comparison on original values might be needed if `weightLogged` is the calculated e1RM.
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
        if (!candidateSet.weightLogged) {
          if (candidateSet.repsLogged) {
            checkForAndAddPb('Max Reps (Bodyweight)', candidateSet);
          }
          if (candidateSet.durationLogged && getDurationValue(candidateSet.durationLogged) > 0) {
            checkForAndAddPb('Max Duration', candidateSet);
          }
          return; // Move to the next set
        }

        // Weight-based PBs
        checkForAndAddPb('Heaviest Lifted', candidateSet);
        if (repsTypeToReps(candidateSet.repsLogged) === 1) {
          checkForAndAddPb('1RM (Actual)', candidateSet);
        }
        if (repsTypeToReps(candidateSet.repsLogged) === 3) {
          checkForAndAddPb('3RM (Actual)', candidateSet);
        }
        if (repsTypeToReps(candidateSet.repsLogged) === 5) {
          checkForAndAddPb('5RM (Actual)', candidateSet);
        }

        // Estimated 1RM
        if (candidateSet.repsLogged && repsTypeToReps(candidateSet.repsLogged) > 1) {
          const e1RM = getWeightValue(candidateSet.weightLogged) * (1 + repsTypeToReps(candidateSet.repsLogged) / 30);
          const e1RMSet: LoggedSet = {
            ...candidateSet,
            repsLogged: genRepsTypeFromRepsNumber(1), // The result is for 1 rep
            weightLogged: weightToExact(parseFloat(e1RM.toFixed(2))), // The calculated weight
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
      if (candidateSet.repsLogged && existingBest.repsLogged && candidateSet.repsLogged > existingBest.repsLogged) isBetter = true;
    } else if (pbType.includes('Max Duration')) {
      if ((candidateSet.durationLogged ?? 0) > (existingBest.durationLogged ?? 0)) isBetter = true;
    } else { // All other PBs are weight-based
      if ((candidateSet.weightLogged ?? 0) > (existingBest.weightLogged ?? 0)) {
        isBetter = true;
      } else if (
        (candidateSet.weightLogged ?? 0) === (existingBest.weightLogged ?? 0) &&
        candidateSet.repsLogged && existingBest.repsLogged && candidateSet.repsLogged > existingBest.repsLogged
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
      this.activityService.translatedActivityLogs$,
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
    this.availableExercisesForFilter$ = this.exerciseService.getHydratedExercises().pipe(
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
        this.toastService.info(this.translate.instant('historyList.toasts.filteredByProgram'));
      }
      if (routineId) {
        const routine = this.availableRoutines.find(r => r.id === routineId);
        if (routine && routine.name) {
          this.filterForm.patchValue({ routineName: routine.name });
          this.isFilterAccordionOpen.set(true);
          this.toastService.info(this.translate.instant('historyList.toasts.filteredByRoutine'));
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

  @ViewChild('calendarScrollSentinel', { static: false }) calendarScrollSentinel!: ElementRef;
  private calendarObserver: IntersectionObserver | null = null;
  ngAfterViewInit(): void {
    this.setupSwipeGestures();

    // Setup IntersectionObserver for fluid infinite scroll
    if (this.calendarScrollSentinel) {
      this.calendarObserver = new IntersectionObserver(entries => {
        if (
          entries[0].isIntersecting &&
          this.currentHistoryView() === 'calendar' &&
          !this.historyCalendarLoading()
        ) {
          this.loadNextCalendarMonth();
        }
      }, { root: null, threshold: 0.1 });

      this.calendarObserver.observe(this.calendarScrollSentinel.nativeElement);
    }
  }

  setView(view: HistoryListView): void {
    const current = this.currentHistoryView();
    if (current === view) return;
    let enterTransform = 'translateX(100%)', leaveTransform = 'translateX(-100%)';
    if (view === 'list') {
      enterTransform = (current === 'calendar') ? 'translateX(-100%)' : 'translateX(100%)';
      leaveTransform = (current === 'calendar') ? 'translateX(100%)' : 'translateX(-100%)';
      this.resetFilters();

      // --- Reset calendar months to current + 2 when leaving calendar view ---
      this.historyCalendarMonths.set([]);
      this.currentCalendarDate = new Date();
      this.generateCalendarMonths(this.currentCalendarDate, 3); // current + next 2 months
    } else {
      // When leaving list view, clear the virtualScroll reference
      this.virtualScroll = undefined;
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
      // Filter the master list to get all items for the selected date
      const itemsForDay = this.allHistoryItems().filter(item =>
        isSameDay(new Date(item.startTime), day.date)
      );
      this.selectedDayItems.set(itemsForDay); // Set our new signal

      this.showPastLoggedWorkouts = true;
      this.pastLoggedWorkoutsDay = day;
    } else {
      this.toastService.clearAll();
      this.toastService.info(this.translate.instant('historyList.toasts.noLogsOnDay'), 2000);
    }
  }

  // Expose isSameMonth to the template
  isSameMonth(date1: Date, date2: Date): boolean {
    return isSameMonth(date1, date2);
  }

  getHistoryWeekDayNames = computed(() => {
    const currentLang = this.languageService.currentLang();
    const locale = this.dateFnsLocales[currentLang] || enUS;
    const start = startOfWeek(new Date(), { weekStartsOn: this.weekStartsOn, locale });
    return eachDayOfInterval({ start, end: addDays(start, 6) }).map(d => format(d, 'EE', { locale }));
  });

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
        const createNewRoutineFromLog = await this.alertService.showConfirm(this.translate.instant('historyList.alerts.noRoutineTitle'), this.translate.instant('historyList.alerts.noRoutineMessage'));
        if (createNewRoutineFromLog && createNewRoutineFromLog.data) {
          this.createRoutineFromLog(logId);
        }
      }
    }
  }

  async deleteLogDetails(logId: string, event?: MouseEvent): Promise<void> {
    event?.stopPropagation(); this.visibleActionsRutineId.set(null);

    const confirm = await this.alertService.showConfirmationDialog(
      this.translate.instant('historyList.alerts.deleteLogTitle'),
      this.translate.instant('historyList.alerts.deleteLogMessage'),
      [
        { text: this.translate.instant('common.cancel'), role: "cancel", data: false, icon: 'cancel', iconClass: 'w-4 h-4 mr-1' } as AlertButton,
        { text: this.translate.instant('historyList.alerts.deleteButton'), role: "confirm", data: true, cssClass: "bg-red-600", icon: 'trash' } as AlertButton,
      ],
    );
    if (confirm && confirm.data) {
      try {
        this.spinnerService.show(); await this.trackingService.deleteWorkoutLog(logId);
        this.toastService.success(this.translate.instant('historyList.toasts.logDeleted'));
      } catch (err) { this.toastService.error(this.translate.instant('historyList.toasts.logDeleteFailed')); }
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
    if (this.calendarObserver) {
      this.calendarObserver.disconnect();
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
      { text: this.translate.instant('common.cancel'), role: 'cancel', data: false, icon: 'cancel' },
      { text: this.translate.instant('historyList.alerts.discardButton'), role: 'confirm', data: true, cssClass: 'bg-red-500 hover:bg-red-600 text-white', icon: 'trash' },
    ];

    const confirm = await this.alertService.showConfirmationDialog(
      this.translate.instant('historyList.alerts.pausedWorkoutTitle'),
      this.translate.instant('historyList.alerts.pausedWorkoutMessage'),
      buttons
    );
    if (confirm && confirm.data) {
      if (isPlatformBrowser(this.platformId)) {
        this.storageService.removeItem('fitTrackPro_pausedWorkoutState');
        // this.toastService.info(this.translate.instant('historyList.toasts.pausedDiscarded'), 3000);
      }
      this.navigateToLogWorkout();
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

  handleLogItemClick(event: { actionKey: string, data?: any }): void {
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

  areActionsOpen(): boolean {
    return !!this.activeItemIdActions();
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

  showBackToTopButton = signal<boolean>(false);
  private calendarScrollDebounceTimer: any;
  // @HostListener('window:scroll', [])
  // onWindowScroll(): void {
  //   if (!isPlatformBrowser(this.platformId)) return;
  //   this.showBackToTopButton.set(window.pageYOffset > 800);

  //   // Infinite Scroll for Calendar (debounced)
  //   if (
  //     this.currentHistoryView() === 'calendar' &&
  //     !this.historyCalendarLoading()
  //   ) {
  //     const isAtBottom = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200;
  //     if (isAtBottom) {
  //       if (this.calendarScrollDebounceTimer) {
  //         clearTimeout(this.calendarScrollDebounceTimer);
  //       }
  //       this.calendarScrollDebounceTimer = setTimeout(() => {
  //         if (!this.historyCalendarLoading()) {
  //           this.loadNextCalendarMonth();
  //         }
  //       }, 250); // 250ms debounce
  //     }
  //   }
  // }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

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
        ...viewBtn,
        actionKey: 'view_activity',
        data: { logId }
      }, {
        ...editBtn,
        actionKey: 'edit_activity',
        data: { logId }
      },
      { isDivider: true },
      {
        ...deleteBtn,
        actionKey: 'delete_activity',
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
      this.translate.instant('historyList.alerts.deleteActivityTitle'),
      this.translate.instant('historyList.alerts.deleteActivityMessage', { name: logToDelete.activityName }),
      [
        { text: this.translate.instant('common.cancel'), role: 'cancel', data: false, icon: 'cancel' },
        { text: this.translate.instant('historyList.alerts.deleteButton'), role: 'confirm', data: true, cssClass: 'bg-red-500', icon: 'trash' }
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
      label: 'historyList.fab.logWorkout',
      actionKey: 'log_past_workout',
      iconName: 'plus-circle',
      cssClass: 'bg-blue-500 focus:ring-blue-400',
      isPremium: false
    },
    {
      label: 'historyList.fab.logActivity',
      actionKey: 'log_past_activity',
      iconName: 'plus-circle',
      cssClass: 'bg-teal-500 focus:ring-teal-400',
      isPremium: true
    },
    {
      label: 'GEN RANDOM LOGS',
      actionKey: 'gen_random_logs',
      iconName: 'magic-wand',
      cssClass: 'bg-purple-500 focus:ring-purple-400',
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
      case 'gen_random_logs':
        this.trackingService.generateAndSaveRandomWorkoutLogs();
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


      const currentLang = this.languageService.currentLang();
      const locale = this.dateFnsLocales[currentLang] || enUS;

      newMonths.push({
        monthName: format(targetDate, 'LLLL', { locale }),
        monthDate: targetDate, // +++ ADD this line
        year: targetDate.getFullYear(),
        spacers: Array(effectiveStartOfWeek).fill(0),
        days: daysInMonth.map(date => {
          const logsOnThisDay = allLogs.filter(log => isSameDay(parseISO(log.date), date));
          return {
            date: date,
            isCurrentMonth: true,
            isToday: isToday(date),
            hasLog: logsOnThisDay.length > 0,
            logCount: logsOnThisDay.length,
          };
        }),
      });
    }

    this.historyCalendarMonths.update(existingMonths => [...existingMonths, ...newMonths]);
    this.currentCalendarDate = subMonths(startDate, numberOfMonths);
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

  getLocationById(locationId: string): string {
    return this.locationService.getHydratedLocationByLocationId(locationId);
  }

  virtualScroll?: CdkVirtualScrollViewport;
  @ViewChild(CdkVirtualScrollViewport)
  set virtualScrollSetter(vs: CdkVirtualScrollViewport | undefined) {
    this.virtualScroll = vs;
    if (vs) {
      this.cdr.detectChanges();
    }
  }

}