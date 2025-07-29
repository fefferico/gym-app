import { Component, inject, OnInit, PLATFORM_ID, signal, computed, ChangeDetectorRef, OnDestroy, ElementRef, AfterViewInit, NgZone, ViewChild, HostListener } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, Observable, of, Subscription, forkJoin } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { TrainingProgram, ScheduledRoutineDay } from '../../../core/models/training-program.model';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { AlertService } from '../../../core/services/alert.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerService } from '../../../core/services/spinner.service';
import { Routine } from '../../../core/models/workout.model';
import { Exercise } from '../../../core/models/exercise.model';
import {
  startOfWeek, endOfWeek, addDays, subDays, eachDayOfInterval, format,
  isSameDay, isToday, addMonths, subMonths, startOfMonth, endOfMonth,
  isSameMonth, isPast, isFuture, parseISO
} from 'date-fns';
import { DayOfWeekPipe } from '../../../shared/pipes/day-of-week-pipe';
import { animate, group, query, state, style, transition, trigger } from '@angular/animations';
import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog } from '../../../core/models/workout-log.model';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkoutService } from '../../../core/services/workout.service';
import { ExerciseService } from '../../../core/services/exercise.service';
import Hammer from 'hammerjs';
import { ActionMenuItem } from '../../../core/models/action-menu.model';
import { ActionMenuComponent } from '../../../shared/components/action-menu/action-menu';
import { AlertButton } from '../../../core/models/alert.model';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { v4 as uuidv4 } from 'uuid';
import { PressDirective } from '../../../shared/directives/press.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';

interface ScheduledItemWithLogs {
  routine: Routine;
  scheduledDayInfo: ScheduledRoutineDay;
  logs: WorkoutLog[];
  isUnscheduled?: boolean;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth?: boolean;
  isToday: boolean;
  isPastDay: boolean;
  hasWorkout: boolean;
  isLogged: boolean;
  scheduledItems: ScheduledItemWithLogs[];
}

type ProgramListView = 'list' | 'calendar';
type CalendarDisplayMode = 'week' | 'month';

@Component({
  selector: 'app-training-program-list',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, ActionMenuComponent, PressDirective, IconComponent],
  templateUrl: './training-program-list.html',
  styleUrls: ['./training-program-list.scss'],
  animations: [
    trigger('fabSlideUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(200%)' }),
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
    trigger('calendarPeriodSlide', [
      state('center', style({ transform: 'translateX(0%)', opacity: 1 })),
      state('outLeft', style({ transform: 'translateX(-100%)', opacity: 0 })),
      state('outRight', style({ transform: 'translateX(100%)', opacity: 0 })),
      state('preloadFromRight', style({ transform: 'translateX(100%)', opacity: 0 })),
      state('preloadFromLeft', style({ transform: 'translateX(-100%)', opacity: 0 })),

      transition('center => outLeft', animate('200ms ease-in')),
      transition('center => outRight', animate('200ms ease-in')),
      transition('preloadFromRight => center', animate('200ms ease-out')),
      transition('preloadFromLeft => center', animate('200ms ease-out')),
      transition('outLeft => center', [style({ transform: 'translateX(100%)', opacity: 0 }), animate('200ms ease-out')]),
      transition('outRight => center', [style({ transform: 'translateX(-100%)', opacity: 0 }), animate('200ms ease-out')]),
    ])
  ]
})
export class TrainingProgramListComponent implements OnInit, AfterViewInit, OnDestroy {
  private trainingProgramService = inject(TrainingProgramService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private toastService = inject(ToastService);
  private spinnerService = inject(SpinnerService);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private trackingService = inject(TrackingService);
  private themeService = inject(ThemeService);
  private workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  private elementRef = inject(ElementRef);
  private ngZone = inject(NgZone);
  private sanitizer = inject(DomSanitizer);

  programs$: Observable<TrainingProgram[]> | undefined;
  allProgramsForList = signal<TrainingProgram[]>([]);
  private dataSubscription: Subscription | undefined;
  private programsListSubscription: Subscription | undefined; // NEW: For ongoing program list updates
  private hammerInstanceCalendar: HammerManager | null = null;
  private hammerInstanceMode: HammerManager | null = null;

  @ViewChild('calendarSwipeContainerEl')
  set calendarSwipeContainer(element: ElementRef<HTMLDivElement> | undefined) {
    if (element && isPlatformBrowser(this.platformId)) {
      if (this.hammerInstanceCalendar) {
        this.hammerInstanceCalendar.destroy();
        this.hammerInstanceCalendar = null;
      }
      this.setupCalendarSwipe(element.nativeElement);
    } else if (!element && this.hammerInstanceCalendar) {
      this.hammerInstanceCalendar.destroy(); this.hammerInstanceCalendar = null;
    }
  }

  @ViewChild('viewSwipeContainerEl')
  set modeSwipeContainer(element: ElementRef<HTMLDivElement> | undefined) {
    if (element && isPlatformBrowser(this.platformId)) {
      if (this.hammerInstanceMode) {
        this.hammerInstanceMode.destroy();
        this.hammerInstanceMode = null;
      }
      this.setupModeSwipe(element.nativeElement);
    } else if (!element && this.hammerInstanceMode) {
      this.hammerInstanceMode.destroy();
      this.hammerInstanceMode = null;
    }
  }

  activeProgramActions = signal<string | null>(null);
  menuModeCompact: boolean = false;
  isFilterAccordionOpen = signal(false);

  programSearchTerm = signal<string>('');
  selectedProgramCycleType = signal<string | null>(null);
  selectedProgramGoal = signal<string | null>(null);
  selectedProgramMuscleGroup = signal<string | null>(null);

  uniqueProgramGoals = signal<string[]>([]);
  uniqueProgramMuscleGroups = signal<string[]>([]);

  private allRoutinesMap = new Map<string, Routine>();
  private allExercisesMap = new Map<string, Exercise>();

  filteredPrograms = computed(() => {
    let programs = this.allProgramsForList();
    const searchTerm = this.programSearchTerm().toLowerCase();
    const cycleType = this.selectedProgramCycleType();
    const goalFilter = this.selectedProgramGoal();
    const muscleFilter = this.selectedProgramMuscleGroup();

    if (searchTerm) { programs = programs.filter(p => p.name.toLowerCase().includes(searchTerm)); }
    if (cycleType) {
      if (cycleType === 'weekly') { programs = programs.filter(p => !p.cycleLength || p.cycleLength === 0); }
      else if (cycleType === 'cycled') { programs = programs.filter(p => p.cycleLength && p.cycleLength > 0); }
    }
    if (goalFilter) {
      programs = programs.filter(p => p.schedule.some(day => {
        const routine = this.allRoutinesMap.get(day.routineId);
        return routine?.goal?.toLowerCase() === goalFilter.toLowerCase();
      }));
    }
    if (muscleFilter) {
      programs = programs.filter(p => p.schedule.some(day => {
        const routine = this.allRoutinesMap.get(day.routineId);
        if (!routine) return false;
        return routine.exercises.some(exDetail => {
          const fullExercise = this.allExercisesMap.get(exDetail.exerciseId);
          return fullExercise?.primaryMuscleGroup?.toLowerCase() === muscleFilter.toLowerCase();
        });
      }));
    }
    return programs;
  });

  currentView = signal<ProgramListView>('list');
  viewAnimationParams = signal<{ value: ProgramListView, params: { enterTransform: string, leaveTransform: string } }>({
    value: 'list', params: { enterTransform: 'translateX(100%)', leaveTransform: 'translateX(-100%)' }
  });

  calendarViewDate = signal<Date>(new Date());
  calendarDays = signal<CalendarDay[]>([]);
  calendarLoading = signal<boolean>(false);

  // --- STATE MANAGEMENT CHANGES for Multiple Active Programs ---
  activePrograms = signal<TrainingProgram[]>([]);
  calendarViewProgram = signal<TrainingProgram | null>(null);

  // This computed signal intelligently determines which single program (if any) to display on the calendar
  activeProgramForCalendar = computed<TrainingProgram | null>(() => {
    const active = this.activePrograms();
    if (active.length === 1) {
      return active[0]; // If only one program is active, use it automatically.
    }
    if (active.length > 1) {
      return this.calendarViewProgram(); // If multiple are active, use the one the user selected.
    }
    return null; // If zero programs are active.
  });
  // --- END STATE MANAGEMENT CHANGES ---

  weekStartsOn: 0 | 1 = 1;
  calendarDisplayMode = signal<CalendarDisplayMode>('week');
  selectedCalendarDayDetails = signal<CalendarDay | null>(null);
  selectedCalendarDayLoggedWorkouts = signal<CalendarDay | null>(null);
  calendarAnimationState = signal<'center' | 'outLeft' | 'outRight' | 'preloadFromLeft' | 'preloadFromRight'>('center');
  protected isCalendarAnimating = false;
  protected isCardAnimating = false;

  protected weekDayNames: string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  readonly calendarHeaderFormat = computed(() => this.calendarDisplayMode() === 'month' ? 'MMMM yyyy' : 'MMMM yyyy');

  constructor() { }

  protected allWorkoutLogs = signal<WorkoutLog[]>([]);
  private workoutLogsSubscription: Subscription | undefined;

  isFabActionsOpen = signal(false);
  isTouchDevice = false;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
      this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    this.menuModeCompact = this.themeService.isMenuModeCompact();

    this.workoutLogsSubscription = this.trackingService.workoutLogs$.subscribe(logs => this.allWorkoutLogs.set(logs));

    this.dataSubscription = forkJoin({
      routines: this.workoutService.routines$.pipe(take(1)),
      exercises: this.exerciseService.getExercises().pipe(take(1)),
    }).subscribe(({ routines, exercises }) => {
      routines.forEach(r => this.allRoutinesMap.set(r.id, r));
      exercises.forEach(e => this.allExercisesMap.set(e.id, e));
    });

    this.programs$ = this.trainingProgramService.programs$;
    this.programsListSubscription = this.trainingProgramService.programs$.subscribe(programs => {
      this.allProgramsForList.set(
        programs.sort((a, b) => {
          // Primary sort: by isActive status (true comes first)
          if (a.isActive && !b.isActive) {
            return -1; // a is active, b is not -> a should come before b
          }
          if (!a.isActive && b.isActive) {
            return 1; // b is active, a is not -> b should come before a
          }

          // Secondary sort: by name (alphabetical)
          // This part is only reached if both programs have the same isActive status
          return a.name.localeCompare(b.name);
        })
      );
      this.populateFilterOptions();

      const newActivePrograms = programs.filter(p => p.isActive);
      this.activePrograms.set(newActivePrograms);

      if (this.currentView() === 'calendar') {
        // If the program being viewed in the calendar is no longer active, clear it.
        const currentCalendarProgId = this.calendarViewProgram()?.id;
        if (currentCalendarProgId && !newActivePrograms.some(p => p.id === currentCalendarProgId)) {
          this.calendarViewProgram.set(null);
        }
        this.generateCalendarDays(true);
      }
    });
  }

  ngAfterViewInit(): void { }

  private setupCalendarSwipe(calendarSwipeElement: HTMLElement): void {
    let lastSwipeTime = 0; const swipeDebounce = 350;
    this.ngZone.runOutsideAngular(() => {
      this.hammerInstanceCalendar = new Hammer(calendarSwipeElement);
      this.hammerInstanceCalendar.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 30, velocity: 0.2 });
      this.hammerInstanceCalendar.on('swipeleft', () => {
        const now = Date.now();
        if (now - lastSwipeTime < swipeDebounce || this.isCalendarAnimating) return;
        lastSwipeTime = now;
        this.ngZone.run(() => this.nextPeriod());
      });
      this.hammerInstanceCalendar.on('swiperight', () => {
        const now = Date.now();
        if (now - lastSwipeTime < swipeDebounce || this.isCalendarAnimating) return;
        lastSwipeTime = now;
        this.ngZone.run(() => this.previousPeriod());
      });
    });
  }

  private setupModeSwipe(modeSwipeElement: HTMLElement): void { }

  private populateFilterOptions(): void {
    const programs = this.allProgramsForList();
    if (programs.length === 0 || this.allRoutinesMap.size === 0) {
      this.uniqueProgramGoals.set([]); this.uniqueProgramMuscleGroups.set([]);
      return;
    }
    const goals = new Set<string>(); const muscles = new Set<string>();
    programs.forEach(program => {
      program.schedule.forEach(day => {
        const routine = this.allRoutinesMap.get(day.routineId);
        if (routine) {
          if (routine.goal) { goals.add(routine.goal); }
          routine.exercises.forEach(exDetail => {
            const fullExercise = this.allExercisesMap.get(exDetail.exerciseId);
            if (fullExercise?.primaryMuscleGroup) { muscles.add(fullExercise.primaryMuscleGroup); }
          });
        }
      });
    });
    this.uniqueProgramGoals.set(Array.from(goals).sort((a, b) => a.localeCompare(b)));
    this.uniqueProgramMuscleGroups.set(Array.from(muscles).sort((a, b) => a.localeCompare(b)));
  }

  toggleFilterAccordion(): void { this.isFilterAccordionOpen.update(isOpen => !isOpen); }
  onProgramSearchTermChange(event: Event): void { this.programSearchTerm.set((event.target as HTMLInputElement).value); }
  onProgramCycleTypeChange(event: Event): void { this.selectedProgramCycleType.set((event.target as HTMLSelectElement).value || null); }
  onProgramGoalChange(event: Event): void { this.selectedProgramGoal.set((event.target as HTMLSelectElement).value || null); }
  onProgramMuscleGroupChange(event: Event): void { this.selectedProgramMuscleGroup.set((event.target as HTMLSelectElement).value || null); }
  clearProgramFilters(): void {
    this.programSearchTerm.set(''); this.selectedProgramCycleType.set(null); this.selectedProgramGoal.set(null); this.selectedProgramMuscleGroup.set(null);
    (document.getElementById('program-search-term') as HTMLInputElement).value = '';
    (document.getElementById('program-cycle-type-filter') as HTMLSelectElement).value = '';
    (document.getElementById('program-goal-filter') as HTMLSelectElement).value = '';
    (document.getElementById('program-muscle-filter') as HTMLSelectElement).value = '';
  }
  navigateToCreateProgram(): void { this.router.navigate(['/training-programs/new']); }

  vibrate(): void {
    const currentVibrator = navigator;
    if (currentVibrator && 'vibrate' in currentVibrator) {
      currentVibrator.vibrate(50);
    }
  }

  viewProgramDetails(programId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.vibrate();
    this.router.navigate(['/training-programs/view', programId]);
    this.activeProgramActions.set(null);
  }

  editProgram(programId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/training-programs/edit', programId]);
    this.activeProgramActions.set(null);
  }

  async deleteProgram(programId: string, event?: MouseEvent): Promise<void> {
    event?.stopPropagation(); this.activeProgramActions.set(null);
    try {
      this.spinnerService.show("Deleting program...");
      await this.trainingProgramService.deleteProgram(programId);
    } catch (error) { this.toastService.error("An unexpected error occurred", 0, "Deletion Error"); }
    finally { this.spinnerService.hide(); }
  }

  async toggleActiveProgram(programId: string, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    this.activeProgramActions.set(null);
    this.spinnerService.show("Updating program...");
    try {
      // The service now simply toggles the state for one program.
      await this.trainingProgramService.toggleProgramActivation(programId);
    } catch (error) {
      this.toastService.error("Failed to update program status", 0, "Error");
    } finally {
      this.spinnerService.hide();
    }
  }

  async setView(view: ProgramListView): Promise<void> {
    const current = this.currentView();
    if (current === view) return;

    // --- CALENDAR VIEW LOGIC ---
    if (view === 'calendar') {
      const activeProgs = this.activePrograms();
      if (activeProgs.length > 1) {
        // Prompt user to select a program for the calendar view
        const programButtons: AlertButton[] = activeProgs.map(p => ({
          text: p.name,
          role: 'confirm',
          data: p, // Pass the whole program object
          cssClass: 'bg-primary hover:bg-primary-dark'
        }));
        programButtons.push({ text: 'Cancel', role: 'cancel', data: null, cssClass: 'bg-gray-400 hover:bg-gray-600' });

        const choice = await this.alertService.showConfirmationDialog(
          'Select Program',
          'You have multiple active programs. Please choose one to view on the calendar.',
          programButtons
        );

        if (choice && choice.data) {
          this.calendarViewProgram.set(choice.data as TrainingProgram);
        } else {
          // User cancelled, so we don't switch the view.
          // this.toastService.info("Calendar view cancelled", 2000);
          return;
        }
      } else {
        // If 0 or 1 active programs, no selection is needed. The computed signal handles it.
        this.calendarViewProgram.set(null); // Clear any previous selection
      }
    }
    // --- END CALENDAR VIEW LOGIC ---

    let enterTransform = 'translateX(100%)', leaveTransform = 'translateX(-100%)';
    if (view === 'list') { enterTransform = 'translateX(-100%)'; leaveTransform = 'translateX(100%)'; }

    this.viewAnimationParams.set({ value: view, params: { enterTransform, leaveTransform } });
    this.currentView.set(view);
    this.isFilterAccordionOpen.set(false);

    if (view === 'calendar') {
      this.calendarDisplayMode.set('week');
      this.calendarAnimationState.set('center');
      this.generateCalendarDays(true);
    }
    this.goToTodayCalendar();
  }


  handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
    const programId = event.data?.programId;
    if (!programId) return;

    switch (event.actionKey) {
      case 'view': this.viewProgramDetails(programId); break;
      case 'activate': this.toggleActiveProgram(programId); break; // Simplified
      case 'deactivate': this.toggleActiveProgram(programId); break; // Simplified
      case 'edit': this.editProgram(programId); break;
      case 'delete': this.deleteProgram(programId); break;
    }
    this.activeProgramIdActions.set(null);
  }










  getDaysScheduled(program: TrainingProgram): string {
    if (!program.schedule || program.schedule.length === 0) return '0 days';
    const count = new Set(program.schedule.map(s => s.dayOfWeek)).size;
    return `${count} day${count === 1 ? '' : 's'}`;
  }
  getCycleInfo(program: TrainingProgram): string { return (program.cycleLength && program.cycleLength > 0) ? `${program.cycleLength}-day cycle` : 'Weekly'; }
  getProgramOverallGoals(program: TrainingProgram): string[] {
    if (this.allRoutinesMap.size === 0 || !program.schedule?.length) return [];
    const goals = new Set<string>();
    program.schedule.forEach(day => { const routine = this.allRoutinesMap.get(day.routineId); if (routine?.goal) goals.add(routine.goal); });
    return program.goals || Array.from(goals);
  }
  getProgramMainMuscleGroups(program: TrainingProgram): string[] {
    if (this.allRoutinesMap.size === 0 || this.allExercisesMap.size === 0 || !program.schedule?.length) return [];
    const muscles = new Set<string>();
    program.schedule.forEach(day => {
      const routine = this.allRoutinesMap.get(day.routineId);
      routine?.exercises.forEach(exDetail => { const fullExercise = this.allExercisesMap.get(exDetail.exerciseId); if (fullExercise?.primaryMuscleGroup) muscles.add(fullExercise.primaryMuscleGroup); });
    });
    return Array.from(muscles);
  }
  setCalendarDisplayMode(mode: CalendarDisplayMode): void {
    if (this.isCalendarAnimating || this.calendarDisplayMode() === mode) {
      return;
    }
    this.isCalendarAnimating = true;

    const oldMode = this.calendarDisplayMode();
    let outState: 'outLeft' | 'outRight' = 'outLeft';
    let preloadState: 'preloadFromLeft' | 'preloadFromRight' = 'preloadFromRight';

    if (oldMode === 'week' && mode === 'month') { outState = 'outLeft'; preloadState = 'preloadFromRight'; }
    else if (oldMode === 'month' && mode === 'week') { outState = 'outRight'; preloadState = 'preloadFromLeft'; }

    this.calendarAnimationState.set(outState);
    this.selectedCalendarDayDetails.set(null);

    setTimeout(() => {
      this.calendarDisplayMode.set(mode);
      this.calendarAnimationState.set(preloadState);
      if (this.activeProgramForCalendar()) {
        this.generateCalendarDays();
      }
      else {
        this.isCalendarAnimating = false; // Reset if no program to load
      }
      // isCalendarAnimating will be reset in generateCalendarDays' finally block or here
    }, 200); // out animation duration
  }

  private changeCalendarPeriod(direction: 'next' | 'previous'): void {
    if (this.isCalendarAnimating || !this.activeProgramForCalendar()) return;
    this.isCalendarAnimating = true;
    this.selectedCalendarDayDetails.set(null); // Clear details when period changes

    let outState: 'outLeft' | 'outRight';
    let preloadState: 'preloadFromLeft' | 'preloadFromRight';

    if (direction === 'next') {
      outState = 'outLeft'; preloadState = 'preloadFromRight';
      if (this.calendarDisplayMode() === 'month') this.calendarViewDate.update(d => addMonths(d, 1));
      else this.calendarViewDate.update(d => addDays(d, 7));
    } else {
      outState = 'outRight'; preloadState = 'preloadFromLeft';
      if (this.calendarDisplayMode() === 'month') this.calendarViewDate.update(d => subMonths(d, 1));
      else this.calendarViewDate.update(d => subDays(d, 7));
    }
    this.calendarAnimationState.set(outState);

    setTimeout(() => {
      this.calendarAnimationState.set(preloadState);
      this.generateCalendarDays(); // This will set to 'center' and reset isCalendarAnimating in its finally block
    }, 200); // out animation duration
  }

  previousPeriod(): void { this.changeCalendarPeriod('previous'); }
  nextPeriod(): void { this.changeCalendarPeriod('next'); }

  goToTodayCalendar(): void {
    if (this.isCalendarAnimating || !this.activeProgramForCalendar() || this.isTodayDisplayedInCalendar()) return;
    this.isCalendarAnimating = true;
    this.selectedCalendarDayDetails.set(null);

    const today = new Date();
    const currentCalDate = this.calendarViewDate();
    let outState: 'outLeft' | 'outRight';
    let preloadState: 'preloadFromLeft' | 'preloadFromRight';

    if (currentCalDate > today) { outState = 'outRight'; preloadState = 'preloadFromLeft'; }
    else { outState = 'outLeft'; preloadState = 'preloadFromRight'; }

    this.calendarAnimationState.set(outState);

    setTimeout(() => {
      this.calendarViewDate.set(new Date());
      this.calendarAnimationState.set(preloadState);
      this.generateCalendarDays(); // Will reset isCalendarAnimating
    }, 200);
  }

  isTodayDisplayedInCalendar(): boolean {
    const today = new Date();
    const currentCalDate = this.calendarViewDate();
    if (this.calendarDisplayMode() === 'month') {
      return isSameMonth(currentCalDate, today);
    } else {
      const weekStartForCurrentView = startOfWeek(currentCalDate, { weekStartsOn: this.weekStartsOn });
      const weekEndForCurrentView = endOfWeek(currentCalDate, { weekStartsOn: this.weekStartsOn });
      return today >= weekStartForCurrentView && today <= weekEndForCurrentView;
    }
  }

  async generateCalendarDays(isInitialOrProgramChange: boolean = false): Promise<void> {
    const activeProg = this.activeProgramForCalendar();
    if (!isPlatformBrowser(this.platformId) || !activeProg) {
      this.calendarDays.set([]);
      this.selectedCalendarDayDetails.set(null);
      this.calendarLoading.set(false);
      if (!isInitialOrProgramChange) this.calendarAnimationState.set('center');
      this.isCalendarAnimating = false; // Ensure reset
      return;
    }
    this.calendarLoading.set(true);
    if (!isInitialOrProgramChange && !this.isCalendarAnimating) {
      this.selectedCalendarDayDetails.set(null);
    }

    const viewDate = this.calendarViewDate();
    let rangeStart: Date, rangeEnd: Date;
    if (this.calendarDisplayMode() === 'month') {
      const monthStart = startOfMonth(viewDate); const monthEnd = endOfMonth(viewDate);
      rangeStart = startOfWeek(monthStart, { weekStartsOn: this.weekStartsOn });
      rangeEnd = endOfWeek(monthEnd, { weekStartsOn: this.weekStartsOn });
    } else {
      rangeStart = startOfWeek(viewDate, { weekStartsOn: this.weekStartsOn });
      rangeEnd = endOfWeek(viewDate, { weekStartsOn: this.weekStartsOn });
    }
    const dateRange = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
    try {
      const scheduledEntriesFromProgram = await firstValueFrom(
        this.trainingProgramService.getScheduledRoutinesForDateRangeByProgramId(activeProg.id, rangeStart, rangeEnd).pipe(take(1))
      );
      const allLogsForPeriod = await firstValueFrom(
        this.trackingService.getWorkoutLogsByProgramIdForDateRange(activeProg.id, rangeStart, rangeEnd).pipe(take(1))
      );

      const days: CalendarDay[] = dateRange.map(date => {
        // --- START OF MODIFIED LOGIC ---

        // 1. Find routines scheduled for THIS specific day.
        const distinctScheduledForThisDate = scheduledEntriesFromProgram.filter(entry => isSameDay(entry.date, date));
        const scheduledRoutineIds = new Set(distinctScheduledForThisDate.map(d => d.scheduledDayInfo.routineId));

        // 2. Map the SCHEDULED routines to our display interface, finding their corresponding logs.
        const scheduledItemsWithLogs: ScheduledItemWithLogs[] = distinctScheduledForThisDate.map(scheduledEntry => {
          const routineForDay = this.allRoutinesMap.get(scheduledEntry.scheduledDayInfo.routineId);
          if (!routineForDay) { return null; }
          const correspondingLogs: WorkoutLog[] = allLogsForPeriod.filter(log =>
            isSameDay(parseISO(log.date), date) && log.routineId === routineForDay.id
          ).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          return {
            routine: routineForDay,
            scheduledDayInfo: scheduledEntry.scheduledDayInfo,
            logs: correspondingLogs,
            isUnscheduled: false // This was scheduled
          };
        }).filter(item => item !== null) as ScheduledItemWithLogs[];

        // 3. Find UNSCHEDULED logs for this day that still belong to the active program.
        const unscheduledLogsForThisDate: WorkoutLog[] = allLogsForPeriod.filter(log =>
          isSameDay(parseISO(log.date), date) && // Happened today
          log.programId === activeProg.id &&   // Belongs to the program
          log.routineId &&                      // Has a routineId
          !scheduledRoutineIds.has(log.routineId) // And was NOT scheduled for today
        );

        // 4. Group unscheduled logs by their routineId and map them to our display interface.
        const unscheduledItemsWithLogs = this.mapWorkoutLogToScheduledItemWithLogs(unscheduledLogsForThisDate);

        // 5. Combine the two lists.
        const allItemsForThisDay = [...scheduledItemsWithLogs, ...unscheduledItemsWithLogs];
        const dayIsLogged = allItemsForThisDay.some(item => item.logs.length > 0);
        // --- END OF MODIFIED LOGIC ---

        return {
          date: date,
          isCurrentMonth: this.calendarDisplayMode() === 'month' ? isSameMonth(date, viewDate) : true,
          isToday: isToday(date),
          isPastDay: isPast(date) && !isToday(date),
          hasWorkout: allItemsForThisDay.length > 0,
          isLogged: dayIsLogged,
          scheduledItems: allItemsForThisDay // Use the combined list
        };
      });
      this.calendarDays.set(days);
    } catch (error) {
      console.error("Error generating calendar days:", error);
      this.toastService.error("Could not load calendar schedule", 0, "Error");
      this.calendarDays.set([]);
    } finally {
      this.calendarLoading.set(false);
      if (isInitialOrProgramChange || this.calendarAnimationState() === 'center') {
        this.calendarAnimationState.set('center');
      } else if (this.calendarAnimationState() === 'preloadFromLeft' || this.calendarAnimationState() === 'preloadFromRight') {
        Promise.resolve().then(() => this.calendarAnimationState.set('center'));
      }
      this.isCalendarAnimating = false; // Crucial: reset animation flag
      this.cdr.detectChanges();
    }
  }

  viewSessionSummary(logId: string | undefined): void {
    if (logId) {
      this.router.navigate(['/workout/summary', logId]);
      this.selectCalendarDay(null);
    }
  }

  checkCalendarDayForLogs(day: CalendarDay | null): boolean {
    if (this.isCalendarAnimating) null;

    if (day?.hasWorkout) {
      this.selectedCalendarDayLoggedWorkouts.set(day);
      return this.selectedCalendarDayLoggedWorkouts()?.scheduledItems?.some(sched => sched.logs.length > 0) || false;
    }
    else if (day && !day.hasWorkout) {
      this.toastService.clearAll();
      this.toastService.info("It's a rest day!", 2000, format(day.date, 'EEEE'));
      this.selectedCalendarDayLoggedWorkouts.set(null);
    }
    else this.selectedCalendarDayLoggedWorkouts.set(null);
    return false;
  }

  selectCalendarDay(day: CalendarDay | null): void {
    if (this.isCalendarAnimating) return; // Prevent opening sheet during slide
    const currentVibrator = navigator;
    if (currentVibrator && 'vibrate' in currentVibrator) {
      currentVibrator.vibrate(50); // Optional: provide haptic feedback on selection
    }

    if (day?.hasWorkout) this.selectedCalendarDayDetails.set(day);
    else if (day && !day.hasWorkout) {
      this.toastService.clearAll();
      this.toastService.info("It's a rest day!", 2000, format(day.date, 'EEEE'));
      this.selectedCalendarDayDetails.set(null);
    }
    else this.selectedCalendarDayDetails.set(null);
  }
  startScheduledWorkout(routineId: string | undefined, programId: string | undefined): void {
    if (routineId) {
      const navigationExtras: any = {};
      if (programId) navigationExtras.queryParams = { programId: programId };
      this.router.navigate(['/workout/play', routineId], navigationExtras);
      this.selectCalendarDay(null);
    }
  }

  logPreviousSession(routineId: string, workoutDate: Date): void {
    this.router.navigate(['/workout/log/manual/new', { routineId, workoutDate: format(workoutDate, 'yyyy-MM-dd') }]);
    this.selectCalendarDay(null);
  }

  goToPreviousProgramSession(programId: string | undefined): void {
    this.router.navigate(['/history/list'], programId ? { queryParams: { programId: programId } } : {});
    this.selectCalendarDay(null);
  }

  isToday(date: Date): boolean { return isToday(date); }
  isPast(date: Date): boolean { return isPast(date) && !isToday(date); }
  isFuture(date: Date): boolean { return isFuture(date); }

  getPastWorkoutSessionsForRoutineOnDate(routineId: string, date: Date, filterByActiveProgram: boolean = true): WorkoutLog[] {
    const activeProg = this.activeProgramForCalendar();
    if (!activeProg) return [];
    const allLogs = this.allWorkoutLogs();

    const filteredLogs = allLogs.filter(
      log =>
        log.routineId === routineId &&
        // (!filterByActiveProgram || !activeProg.id || log.programId === activeProg.id) &&
        isSameDay(parseISO(log.date), date)
    );
    console.log(filteredLogs)
    return filteredLogs;
  }

  mapWorkoutLogToScheduledItemWithLogs(logs: WorkoutLog[]): ScheduledItemWithLogs[] {
    if (logs.length === 0) return [];

    const activeProg = this.activeProgramForCalendar();
    if (!activeProg) return [];

    // Group logs by their routine ID
    const logsByRoutine = new Map<string, WorkoutLog[]>();
    for (const log of logs) {
      if (!log.routineId) continue;
      if (!logsByRoutine.has(log.routineId)) {
        logsByRoutine.set(log.routineId, []);
      }
      logsByRoutine.get(log.routineId)!.push(log);
    }

    const result: ScheduledItemWithLogs[] = [];

    for (const [routineId, groupedLogs] of logsByRoutine.entries()) {
      const routine = this.allRoutinesMap.get(routineId);
      if (!routine) continue;

      // For unscheduled items, we create a "dummy" scheduledDayInfo
      // as it's required by the interface.
      const dummyScheduledDayInfo: ScheduledRoutineDay = {
        id: uuidv4(),
        routineId: routineId,
        dayOfWeek: parseISO(groupedLogs[0].date).getDay(), // Get day of week from the log
        programId: activeProg.id,
        // cycleDay: 0 // Not applicable, but required
      };

      result.push({
        routine,
        scheduledDayInfo: dummyScheduledDayInfo,
        logs: groupedLogs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
        isUnscheduled: true // Mark this item as not originally scheduled
      });
    }

    return result;
  }

  getProgramDropdownActionItems(programId: string, mode: 'dropdown' | 'compact-bar'): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center text-sm hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center text-sm hover:text-gray-100 hover:animate-pulse';
    const activateBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-green-600 flex items-center text-sm hover:text-gray-100';;
    const deactivateBtnClass = 'rounded text-left px-3 py-1.5 sm:px-4 sm:py-2 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-500 flex items-center text-sm hover:text-gray-100';;

    const currentProgram = this.allProgramsForList().find(program => program.id === programId);

    const activateProgramBtn = {
      label: 'ACTIVATE',
      actionKey: 'activate',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                        fill="currentColor" class="w-8 h-8 mr-1">
                        <path fill-rule="evenodd"
                          d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75Zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5Z"
                          clip-rule="evenodd" />
                      </svg>`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + activateBtnClass,
      data: { programId: programId }
    };

    const deactivateProgramBtn =
    {
      label: 'DEACTIVATE',
      actionKey: 'deactivate',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"
                        fill="currentColor" class="text-red-500">
                        <path fill-rule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16Zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5Z"
                          clip-rule="evenodd" />
                      </svg>`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deactivateBtnClass,
      data: { programId: programId }
    };

    let actionsArray = [
      {
        label: 'VIEW',
        actionKey: 'view',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" /><path fill-rule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 11-8 0 4 4 0 018 0Z" clip-rule="evenodd" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { programId: programId }
      },
      {
        label: 'EDIT',
        actionKey: 'edit',
        iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { programId: programId }
      }
    ] as ActionMenuItem[];

    if (currentProgram?.isActive) {
      actionsArray.push(deactivateProgramBtn);
    } else {
      actionsArray.push(activateProgramBtn);
    }

    actionsArray.push({ isDivider: true });
    actionsArray.push({
      label: 'DELETE',
      actionKey: 'delete',
      iconSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.177-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5Zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5Z" clip-rule="evenodd" /></svg>`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
      data: { programId: programId }
    });

    return actionsArray;
  }

  activeProgramIdActions = signal<string | null>(null);

  toggleActions(routineId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeProgramIdActions.update(current => (current === routineId ? null : routineId));
  }

  areActionsVisible(routineId: string): boolean {
    return this.activeProgramIdActions() === routineId;
  }

  onCloseActionMenu() { this.activeProgramIdActions.set(null); }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.activeProgramIdActions() !== null) {
      const clickedElement = event.target as HTMLElement;
      if (!clickedElement.closest('.action-menu-container')) {
        this.activeProgramIdActions.set(null);
      }
    }
  }

  ngOnDestroy(): void {
    this.dataSubscription?.unsubscribe();
    this.programsListSubscription?.unsubscribe();
    this.workoutLogsSubscription?.unsubscribe();
    this.hammerInstanceCalendar?.destroy();
    this.hammerInstanceMode?.destroy();
  }

  showBackToTopButton = signal<boolean>(false);
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    const verticalOffset = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    this.showBackToTopButton.set(verticalOffset > 400);
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  handleFabClick(): void { this.isFabActionsOpen.update(v => !v); }
  handleFabMouseEnter(): void { if (!this.isTouchDevice) { this.isFabActionsOpen.set(true); } }
  handleFabMouseLeave(): void { if (!this.isTouchDevice) { this.isFabActionsOpen.set(false); } }

  protected updateSanitizedDescription(value: string): SafeHtml {
    // This tells Angular to trust this HTML string and render it as is.
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }

}