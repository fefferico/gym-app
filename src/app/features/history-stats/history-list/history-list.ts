// src/app/features/history/history-list/history-list.component.ts
import {
  Component, inject, OnInit, signal, computed, PLATFORM_ID, OnDestroy,
  ChangeDetectorRef, ElementRef, AfterViewInit, NgZone, ViewChild,
  HostListener
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Observable, combineLatest, Subscription, forkJoin } from 'rxjs';
import { map, startWith, distinctUntilChanged, take, filter } from 'rxjs/operators';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ExerciseService } from '../../../core/services/exercise.service';
import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog } from '../../../core/models/workout-log.model';
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


interface HistoryCalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasLog: boolean;
  logCount: number;
}

type HistoryListView = 'list' | 'calendar';

@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, FormsModule, ReactiveFormsModule, ActionMenuComponent],
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
    trigger('viewSlide', [
      transition('list <=> calendar', [
        style({ position: 'relative', overflow: 'hidden' }),
        query(':enter, :leave', [style({ position: 'absolute', top: 0, left: 0, width: '100%' })], { optional: true }),
        query(':enter', [style({ transform: '{{ enterTransform }}', opacity: 0 })], { optional: true }),
        group([
          query(':leave', [animate('300ms ease-out', style({ transform: '{{ leaveTransform }}', opacity: 0 }))], { optional: true }),
          query(':enter', [animate('300ms ease-out', style({ transform: 'translateX(0%)', opacity: 1 }))], { optional: true })
        ])
      ])
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
  protected toastService = inject(ToastService);
  protected workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  protected unitsService = inject(UnitsService);
  private themeService = inject(ThemeService);
  private alertService = inject(AlertService);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private elementRef = inject(ElementRef);
  private spinnerService = inject(SpinnerService);
  private trainingProgramService = inject(TrainingProgramService);

  protected allWorkoutLogs = signal<WorkoutLog[]>([]);
  private workoutLogsSubscription: Subscription | undefined;
  availableExercisesForFilter$: Observable<Exercise[]> | undefined;
  isFilterAccordionOpen = signal(false);
  availableRoutines: Routine[] = [];
  visibleActionsRutineId = signal<string | null>(null);
  menuModeCompact: boolean = false;
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

  filteredWorkoutLogs = computed(() => {
    let logs = this.allWorkoutLogs();
    const filters = this.filterValuesSignal();

    if (!logs || logs.length === 0) return [];
    if (!filters) return logs;

    // Add goal property for display (this part is good)
    logs = logs.map(log => ({
      ...log,
      goal: this.availableRoutines.find(r => r.id === log.routineId)?.goal || '',
    }));

    const filtered = logs.filter(log => {
      let match = true;

      // Date filtering
      if (filters.dateFrom) {
        const filterDateFrom = new Date(filters.dateFrom); filterDateFrom.setHours(0, 0, 0, 0);
        if (!isNaN(filterDateFrom.getTime())) {
          const logDate = new Date(log.startTime); logDate.setHours(0, 0, 0, 0);
          match &&= logDate.getTime() >= filterDateFrom.getTime();
        }
      }
      if (filters.dateTo) {
        const filterDateTo = new Date(filters.dateTo); filterDateTo.setHours(23, 59, 59, 999);
        if (!isNaN(filterDateTo.getTime())) {
          match &&= new Date(log.startTime).getTime() <= filterDateTo.getTime();
        }
      }

      // Routine name filtering
      const routineNameFilter = filters.routineName?.trim().toLowerCase();
      if (routineNameFilter) {
        match &&= (log.routineName || '').toLowerCase().includes(routineNameFilter);
      }

      // Exercise filtering
      if (filters.exerciseId) {
        match &&= log.exercises.some(ex => ex.exerciseId === filters.exerciseId);
      }

      // NEW: Program filtering logic
      if (filters.programId) {
        match &&= log.programId === filters.programId;
      }

      return match;
    });

    return filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
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


  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
      this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    this.menuModeCompact = this.themeService.isMenuModeCompact();

    this.workoutLogsSubscription = this.trackingService.workoutLogs$.subscribe(logs => {
      this.allWorkoutLogs.set(logs);
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
      if (programId) {
        console.log("HistoryListComponent: Should filter by programId", programId);
        // Patch the form with the programId from the URL.
        // This will automatically trigger the computed signal to filter the logs.
        this.filterForm.patchValue({ programId: programId });
        this.isFilterAccordionOpen.set(true); // Open the filters to show the user why the list is filtered
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
      console.log("HammerJS attached to HISTORY calendar swipe container.");
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
      this.historyCalendarDays.set([]); this.historyCalendarLoading.set(false); return;
    }
    this.historyCalendarLoading.set(true);
    const viewDate = this.historyCalendarViewDate();
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const rangeStart = startOfWeek(monthStart, { weekStartsOn: this.weekStartsOn });
    const rangeEnd = endOfWeek(monthEnd, { weekStartsOn: this.weekStartsOn });
    const dateRange = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    const logsForMonth = this.allWorkoutLogs().filter(log => {
      const logDate = parseISO(log.date);
      return logDate >= monthStart && logDate <= monthEnd;
    });
    const days: HistoryCalendarDay[] = dateRange.map(date => {
      const logsOnThisDay = logsForMonth.filter(log => isSameDay(parseISO(log.date), date));
      return { date: date, isCurrentMonth: isSameMonth(date, viewDate), isToday: isToday(date), hasLog: logsOnThisDay.length > 0, logCount: logsOnThisDay.length };
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
      this.filterForm.patchValue({
        dateFrom: format(day.date, 'yyyy-MM-dd'), dateTo: format(day.date, 'yyyy-MM-dd'), routineName: '', exerciseId: ''
      });
      this.showPastLoggedWorkouts = true;
      this.pastLoggedWorkoutsDay = day;
      // this.setView('list'); this.isFilterAccordionOpen.set(false);
    } else { this.toastService.info("No workouts logged on this day", 2000); }
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
  viewLogDetails(logId: string, event?: MouseEvent): void {
    event?.stopPropagation(); this.router.navigate(['/history/log', logId]);
    this.visibleActionsRutineId.set(null);
  }
  editLogDetails(logId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/workout/log/manual/edit', logId]);
    this.visibleActionsRutineId.set(null);
  }
  async deleteLogDetails(logId: string, event?: MouseEvent): Promise<void> {
    event?.stopPropagation(); this.visibleActionsRutineId.set(null);
    const confirm = await this.alertService.showConfirm("Delete Workout Log", "Are you sure you want to delete this workout log? This action cannot be undone", "Delete");
    if (confirm && confirm.data) {
      try {
        this.spinnerService.show(); await this.trackingService.deleteWorkoutLog(logId);
        this.toastService.success("Workout log deleted successfully.");
      } catch (err) { this.toastService.error("Failed to delete workout log."); }
      finally { this.spinnerService.hide(); }
    }
  }
  async clearAllLogsForDev(): Promise<void> {
    if (this.trackingService.clearAllWorkoutLogs_DEV_ONLY) { await this.trackingService.clearAllWorkoutLogs_DEV_ONLY(); }
    if (this.trackingService.clearAllPersonalBests_DEV_ONLY) { await this.trackingService.clearAllPersonalBests_DEV_ONLY(); }
    if (this.workoutService.clearAllExecutedRoutines_DEV_ONLY) { await this.workoutService.clearAllExecutedRoutines_DEV_ONLY(); }
  }
  // toggleActions(logId: string, event: MouseEvent): void { event.stopPropagation(); this.visibleActionsRutineId.update(current => (current === logId ? null : logId)); }

  activeRoutineIdActions = signal<string | null>(null); // Store ID of routine whose actions are open
  toggleActions(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeRoutineIdActions.update(current => (current === routineId ? null : routineId));
  }

  // areActionsVisible(logId: string): boolean { return this.visibleActionsRutineId() === logId; }

  ngOnDestroy(): void {
    this.workoutLogsSubscription?.unsubscribe();
    this.hammerInstanceHistoryCalendar?.destroy();
  }

  logPastWorkout(): void {
    this.router.navigate(['/workout/log/manual/new']);
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({
        top: 0,
        behavior: 'smooth' // For a smooth scrolling animation
      });
    }
  }


  getLogDropdownActionItems(routineId: string, mode: 'dropdown' | 'compact-bar'): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';;

    const currentLog = this.allWorkoutLogs().find(log => log.id === routineId);

    const actionsArray = [
      {
        label: 'VIEW',
        actionKey: 'view',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" /><path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 11-8 0 4 4 0 018 0Z" clip-rule="evenodd" /></svg>`,
        iconClass: 'w-8 h-8 mr-2', // Adjusted for consistency if needed,
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      {
        label: 'EDIT',
        actionKey: 'edit',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { routineId }
      },
      { isDivider: true },
      {
        label: 'DELETE',
        actionKey: 'delete',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.177-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5Zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5Z" clip-rule="evenodd" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
        data: { routineId }
      }
    ];

    // if (currentRoutine?.isHidden) {
    //   actionsArray.push(unhideRoutineButton);
    // } else {
    //   // Only show the "Hide" button if we are not already in the "Show Hidden" view
    //   if (!this.showHiddenRoutines()) {
    //     actionsArray.push(hideRoutineButton);
    //   }
    // }

    return actionsArray;
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
    // originalMouseEvent.stopPropagation(); // Stop original event that opened the menu
    const logId = event.data?.routineId;
    if (!logId) return;

    switch (event.actionKey) {
      case 'view':
        this.viewLogDetails(logId);
        break;
      // case 'hide':
      //   this.hideRoutine(routineId);
      //   break;
      // case 'unhide':
      //   this.unhideRoutine(routineId);
      //   break;
      // case 'start':
      //   this.startWorkout(routineId);
      //   break;
      case 'edit':
        this.editLogDetails(logId);
        break;
      // case 'clone':
      //   this.cloneAndEditRoutine(routineId);
      //   break;
      case 'delete':
        this.deleteLogDetails(logId);
        break;
    }
    this.activeRoutineIdActions.set(null); // Close the menu
  }

  areActionsVisible(routineId: string): boolean {
    return this.activeRoutineIdActions() === routineId;
  }

  // When closing menu from the component's output
  onCloseActionMenu() {
    this.activeRoutineIdActions.set(null);
  }


  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // If an action menu is open AND the click was outside the menu container...
    if (this.activeRoutineIdActions() !== null) {
      // Find the menu element. We need a way to identify it. Let's give it a class.
      // We check if the clicked element or any of its parents have the 'action-menu-container' class.
      const clickedElement = event.target as HTMLElement;
      if (!clickedElement.closest('.action-menu-container')) {
        this.activeRoutineIdActions.set(null); // ...then close it.
      }
    }
  }

  toggleShowPastLoggedWorkouts(): void {
    this.showPastLoggedWorkouts = !this.showPastLoggedWorkouts;
    if (!this.showPastLoggedWorkouts) {
      this.pastLoggedWorkoutsDay = null;
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

}