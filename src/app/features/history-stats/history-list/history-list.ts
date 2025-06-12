// src/app/features/history/history-list/history-list.component.ts
import {
  Component, inject, OnInit, signal, computed, PLATFORM_ID, OnDestroy,
  ChangeDetectorRef, ElementRef, AfterViewInit, NgZone, ViewChild
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
  imports: [CommonModule, RouterLink, DatePipe, TitleCasePipe, FormsModule, ReactiveFormsModule],
  templateUrl: './history-list.html',
  styleUrl: './history-list.scss',
  providers: [DecimalPipe],
  animations: [
    trigger('slideInOutActions', [
        state('void', style({ height: '0px', opacity: 0, overflow: 'hidden', paddingTop: '0', paddingBottom: '0', marginTop: '0', marginBottom: '0' })),
        state('*', style({ height: '*', opacity: 1, overflow: 'hidden', paddingTop: '0.5rem', paddingBottom: '0.5rem' })),
        transition('void <=> *', animate('200ms ease-in-out'))
    ]),
    trigger('dropdownMenu', [
        state('void', style({ opacity: 0, transform: 'scale(0.75) translateY(-10px)', transformOrigin: 'top right' })),
        state('*', style({ opacity: 1, transform: 'scale(1) translateY(0)', transformOrigin: 'top right' })),
        transition('void => *', [animate('150ms cubic-bezier(0.25, 0.8, 0.25, 1)')]),
        transition('* => void', [animate('100ms cubic-bezier(0.25, 0.8, 0.25, 1)')])
    ]),
    trigger('viewSlide', [
        transition('list <=> calendar', [
            style({ position: 'relative', overflow: 'hidden' }),
            query(':enter, :leave', [ style({ position: 'absolute', top: 0, left: 0, width: '100%' }) ], { optional: true }),
            query(':enter', [ style({ transform: '{{ enterTransform }}', opacity: 0 }) ], { optional: true }),
            group([
                query(':leave', [ animate('300ms ease-out', style({ transform: '{{ leaveTransform }}', opacity: 0 })) ], { optional: true }),
                query(':enter', [ animate('300ms ease-out', style({ transform: 'translateX(0%)', opacity: 1 })) ], { optional: true })
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

  protected allWorkoutLogs = signal<WorkoutLog[]>([]);
  private workoutLogsSubscription: Subscription | undefined;
  availableExercisesForFilter$: Observable<Exercise[]> | undefined;
  isFilterAccordionOpen = signal(false);
  availableRoutines: Routine[] = [];
  visibleActionsRutineId = signal<string | null>(null);
  menuModeCompact: boolean = false;

  filterForm: FormGroup;
  private filterValuesSignal = signal<any>({});

  currentHistoryView = signal<HistoryListView>('list');
  historyViewAnimationParams = signal<{ value: HistoryListView, params: { enterTransform: string, leaveTransform: string } }>({
    value: 'list', params: { enterTransform: 'translateX(100%)', leaveTransform: 'translateX(-100%)' }
  });

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
    logs = logs.map(log => ({
      ...log,
      goal: this.availableRoutines.find(r => r.id === log.routineId)?.goal || '',
    }));
    const filtered = logs.filter(log => {
      let match = true;
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
      const routineNameFilter = filters.routineName?.trim().toLowerCase();
      if (routineNameFilter) {
        match &&= (log.routineName || '').toLowerCase().includes(routineNameFilter);
      }
      if (filters.exerciseId) {
        match &&= log.exercises.some(ex => ex.exerciseId === filters.exerciseId);
      }
      return match;
    });
    return filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  });

  constructor() {
    this.filterForm = this.fb.group({
      dateFrom: [''], dateTo: [''], routineName: [''], exerciseId: ['']
    });
    this.filterValuesSignal.set(this.filterForm.value);
    this.filterForm.valueChanges.pipe(
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    ).subscribe(newValues => this.filterValuesSignal.set(newValues));
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) window.scrollTo(0, 0);
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

    this.route.queryParamMap.pipe(take(1)).subscribe(params => {
        const programId = params.get('programId');
        if (programId) {
            console.log("HistoryListComponent: Should filter by programId", programId);
            // Implement programId filtering if needed here by modifying filterValuesSignal
            // For example:
            // this.filterValuesSignal.update(currentFilters => ({...currentFilters, programId: programId}));
            // this.filterForm.patchValue({ programId: programId }, { emitEvent: false }); // if you add programId to form
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
    if (view === 'list') { enterTransform = (current === 'calendar') ? 'translateX(-100%)' : 'translateX(100%)'; leaveTransform = (current === 'calendar') ? 'translateX(100%)' : 'translateX(-100%)'; }
    else { enterTransform = (current === 'list') ? 'translateX(100%)' : 'translateX(-100%)'; leaveTransform = (current === 'list') ? 'translateX(-100%)' : 'translateX(100%)'; }
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
      this.setView('list'); this.isFilterAccordionOpen.set(false);
    } else { this.toastService.info("No workouts logged on this day.", 2000); }
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
  resetFilters(): void { this.filterForm.reset({ dateFrom: '', dateTo: '', routineName: '', exerciseId: '' }); }
  viewLogDetails(logId: string, event?: MouseEvent): void { 
    event?.stopPropagation(); this.router.navigate(['/history/log', logId]); 
    this.visibleActionsRutineId.set(null); }
  editLogDetails(logId: string, event?: MouseEvent): void { 
    event?.stopPropagation(); this.router.navigate(['/workout/log/manual/edit', logId]); 
    this.visibleActionsRutineId.set(null); 
  }
  async deleteLogDetails(logId: string, event?: MouseEvent): Promise<void> {
    event?.stopPropagation(); this.visibleActionsRutineId.set(null);
    const confirm = await this.alertService.showConfirm("Delete Workout Log", "Are you sure you want to delete this workout log? This action cannot be undone.", "Delete");
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
  toggleActions(logId: string, event: MouseEvent): void { event.stopPropagation(); this.visibleActionsRutineId.update(current => (current === logId ? null : logId)); }
  areActionsVisible(logId: string): boolean { return this.visibleActionsRutineId() === logId; }

  ngOnDestroy(): void {
    this.workoutLogsSubscription?.unsubscribe();
    this.hammerInstanceHistoryCalendar?.destroy();
  }

  logPastWorkout(): void {
    this.router.navigate(['/workout/log/manual/new']);
  } 
}