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
  isSameMonth, isPast, isFuture, parseISO,
  differenceInDays,
  differenceInCalendarWeeks,
  Locale
} from 'date-fns';
import { it, es, fr, enUS } from 'date-fns/locale';
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
import { AppSettingsService } from '../../../core/services/app-settings.service';
import { MenuMode } from '../../../core/models/app-settings.model';
import { PremiumFeature, SubscriptionService } from '../../../core/services/subscription.service';
import { FabAction, FabMenuComponent } from '../../../shared/components/fab-menu/fab-menu.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/services/language.service';

interface ScheduledItemWithLogs {
  routine: Routine;
  scheduledDayInfo: ScheduledRoutineDay;
  logs: WorkoutLog[];
  isUnscheduled?: boolean;
}
interface CalendarDay {
  date: Date;
  isToday: boolean;
  isPastDay: boolean;
  hasWorkout: boolean;
  isLogged: boolean;
  scheduledItems: ScheduledItemWithLogs[];
}
interface CalendarMonth {
  monthName: string;
  monthDate: Date;
  year: number;
  days: CalendarDay[];
  spacers: any[];
}
type ProgramListView = 'list' | 'calendar';
type CalendarDisplayMode = 'week' | 'month';

@Component({
  selector: 'app-training-program-list',
  standalone: true,
  imports: [CommonModule, DatePipe, TitleCasePipe, ActionMenuComponent, PressDirective, IconComponent, FabMenuComponent, TranslateModule],
  templateUrl: './training-program-list.html',
  styleUrls: ['./training-program-list.scss'],
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
    // --- CORRECTED TRIGGER ---
    trigger('calendarPeriodSlide', [
      state('center', style({ transform: 'translateX(0%)', opacity: 1 })),
      state('outLeft', style({ transform: 'translateX(-100%)', opacity: 0 })),
      state('outRight', style({ transform: 'translateX(100%)', opacity: 0 })),
      state('preloadFromRight', style({ transform: 'translateX(100%)', opacity: 0 })),
      state('preloadFromLeft', style({ transform: 'translateX(-100%)', opacity: 0 })),

      // Transitions for the OUTGOING view
      transition('center => outLeft', animate('200ms ease-in')),
      transition('center => outRight', animate('200ms ease-in')),

      // Transitions for the INCOMING view (from the explicit preload states)
      transition('preloadFromRight => center', animate('200ms ease-out')),
      transition('preloadFromLeft => center', animate('200ms ease-out')),

      // --- REMOVED THE FOLLOWING TWO LINES TO PREVENT THE BUG ---
      // transition('outLeft => center', [style({ transform: 'translateX(100%)', opacity: 0 }), animate('200ms ease-out')]),
      // transition('outRight => center', [style({ transform: 'translateX(-100%)', opacity: 0 }), animate('200ms ease-out')]),
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
  workoutService = inject(WorkoutService);
  private exerciseService = inject(ExerciseService);
  private ngZone = inject(NgZone);
  private sanitizer = inject(DomSanitizer);
  private appSettingsService = inject(AppSettingsService);
  protected subscriptionService = inject(SubscriptionService);
  private translate = inject(TranslateService);
  private languageService = inject(LanguageService);
  private dateFnsLocales: { [key: string]: Locale } = {
    en: enUS,
    it: it,
    es: es,
    fr: fr
  };

  isLoading = signal(true);
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
  menuModeDropdown: boolean = false;
  menuModeCompact: boolean = false;
  menuModeModal: boolean = false;
  isFilterAccordionOpen = signal(false);

  programSearchTerm = signal<string>('');
  selectedProgramType = signal<string | null>(null);
  selectedProgramCycleType = signal<string | null>(null);
  selectedProgramGoal = signal<string | null>(null);
  selectedProgramMuscleGroup = signal<string | null>(null);

  uniqueProgramGoals = signal<string[]>([]);
  uniqueProgramMuscleGroups = signal<string[]>([]);

  private subscriptions = new Subscription();
  private allRoutinesMap = new Map<string, Routine>();
  private allExercisesMap = new Map<string, Exercise>();
  private currentCalendarDate = new Date();

  filteredPrograms = computed(() => {
    let programs = this.allProgramsForList();
    const searchTerm = this.programSearchTerm().toLowerCase();
    const programType = this.selectedProgramType();
    const goalFilter = this.selectedProgramGoal();
    const muscleFilter = this.selectedProgramMuscleGroup();

    // Helper to get all scheduled days from a program regardless of its type
    const getAllScheduledDays = (program: TrainingProgram): ScheduledRoutineDay[] => {
      if (program.programType === 'linear' && program.weeks) {
        // Use flatMap to get all schedules from all weeks into a single array
        return program.weeks.flatMap(week => week.schedule);
      }
      // Fallback for 'cycled' programs
      return program.schedule || [];
    };

    if (searchTerm) {
      programs = programs.filter(p => p.name.toLowerCase().includes(searchTerm));
    }

    if (programType) {
      programs = programs.filter(p => p.programType === programType);
    }

    if (goalFilter) {
      programs = programs.filter(p => {
        const allDays = getAllScheduledDays(p); // Use helper to get all days
        return allDays.some(day => {
          const routine = this.allRoutinesMap.get(day.routineId);
          return routine?.goal?.toLowerCase() === goalFilter.toLowerCase();
        });
      });
    }

    if (muscleFilter) {
      programs = programs.filter(p => {
        const allDays = getAllScheduledDays(p); // Use helper to get all days
        if (!allDays.length) return false;

        return allDays.some(day => {
          const routine = this.allRoutinesMap.get(day.routineId);
          if (!routine) return false;
          return routine.exercises.some(exDetail => {
            const fullExercise = this.allExercisesMap.get(exDetail.exerciseId);
            return fullExercise?.primaryMuscleGroup?.toLowerCase() === muscleFilter.toLowerCase();
          });
        });
      });
    }
    return programs;
  });

  currentView = signal<ProgramListView>('list');
  calendarMonths = signal<CalendarMonth[]>([]);
  selectedCalendarDayDetails = signal<CalendarDay | null>(null);
  isFabActionsOpen = signal(false);

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
    return active.length === 1 ? active[0] : this.calendarViewProgram();
  });


  weekStartsOn: 0 | 1 = 1;
  calendarDisplayMode = signal<CalendarDisplayMode>('week');
  selectedCalendarDayLoggedWorkouts = signal<CalendarDay | null>(null);
  calendarAnimationState = signal<'center' | 'outLeft' | 'outRight' | 'preloadFromLeft' | 'preloadFromRight'>('center');
  protected isCalendarAnimating = false;
  protected isCardAnimating = false;

  weekDayNames = computed(() => {
    const currentLang = this.languageService.currentLang();
    const locale = this.dateFnsLocales[currentLang] || enUS;
    const start = startOfWeek(new Date(), { weekStartsOn: this.weekStartsOn, locale });
    return eachDayOfInterval({ start, end: addDays(start, 6) }).map(d => format(d, 'EE', { locale }));
  });

  private getWeekDayHeaders(): string[] {
    const start = startOfWeek(new Date(), { weekStartsOn: this.weekStartsOn });
    return eachDayOfInterval({ start, end: addDays(start, 6) }).map(d => format(d, 'EE'));
  }

  readonly calendarHeaderFormat = computed(() => this.calendarDisplayMode() === 'month' ? 'MMMM yyyy' : 'MMMM yyyy');

  constructor() {
    this.refreshFabMenuItems();
  }

  protected allWorkoutLogs = signal<WorkoutLog[]>([]);
  private workoutLogsSubscription: Subscription | undefined;

  isTouchDevice = false;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
      this.isTouchDevice = 'ontouchstart' in window;
    }

    this.menuModeDropdown = this.appSettingsService.isMenuModeDropdown();
    this.menuModeCompact = this.appSettingsService.isMenuModeCompact();
    this.menuModeModal = this.appSettingsService.isMenuModeModal();

    const routines$ = this.workoutService.routines$.pipe(take(1));
    const logs$ = this.trackingService.workoutLogs$;
    const programs$ = this.trainingProgramService.programs$;

    this.subscriptions.add(routines$.subscribe(routines => {
      routines.forEach(r => this.allRoutinesMap.set(r.id, r));
    }));

    this.subscriptions.add(logs$.subscribe(logs => {
      this.allWorkoutLogs.set(logs);
    }));

    this.subscriptions.add(programs$.subscribe(programs => {
      this.allProgramsForList.set(programs);
      const newActivePrograms = programs.filter(p => p.isActive);
      this.activePrograms.set(newActivePrograms);

      // If the program being viewed in the calendar is no longer active, clear it.
      const currentCalendarProgId = this.calendarViewProgram()?.id;
      if (currentCalendarProgId && !newActivePrograms.some(p => p.id === currentCalendarProgId)) {
        this.calendarViewProgram.set(null);
      }

      // Refresh calendar if it's the current view
      if (this.currentView() === 'calendar') {
        this.refreshCalendarView();
      }
      this.isLoading.set(false);
    }));
    this.refreshFabMenuItems();
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

  private setupModeSwipe(modeSwipeElement: HTMLElement): void {
    if (isPlatformBrowser(this.platformId) && modeSwipeElement) {
      this.ngZone.runOutsideAngular(() => {
        this.hammerInstanceMode = new Hammer(modeSwipeElement);

        // Listen for swipe left to go to the Calendar view
        this.hammerInstanceMode.on('swipeleft', () => {
          this.ngZone.run(() => {
            if (this.currentView() === 'list') {
              this.setView('calendar');
            }
          });
        });

        // Listen for swipe right to go to the List view
        this.hammerInstanceMode.on('swiperight', () => {
          this.ngZone.run(() => {
            if (this.currentView() === 'calendar') {
              this.setView('list');
            }
          });
        });
      });
    }
  }

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
  onProgramTypeChange(event: Event): void { this.selectedProgramType.set((event.target as HTMLSelectElement).value || null); }
  onProgramCycleTypeChange(event: Event): void { this.selectedProgramCycleType.set((event.target as HTMLSelectElement).value || null); }
  onProgramGoalChange(event: Event): void { this.selectedProgramGoal.set((event.target as HTMLSelectElement).value || null); }
  onProgramMuscleGroupChange(event: Event): void { this.selectedProgramMuscleGroup.set((event.target as HTMLSelectElement).value || null); }
  clearProgramFilters(): void {
    this.programSearchTerm.set('');
    this.selectedProgramCycleType.set(null);
    this.selectedProgramType.set(null);
    this.selectedProgramGoal.set(null);
    this.selectedProgramMuscleGroup.set(null);
    (document.getElementById('program-search-term') as HTMLInputElement).value = '';
    (document.getElementById('program-cycle-type-filter') as HTMLSelectElement).value = '';
    (document.getElementById('program-type-filter') as HTMLSelectElement).value = '';
    (document.getElementById('program-goal-filter') as HTMLSelectElement).value = '';
    (document.getElementById('program-muscle-filter') as HTMLSelectElement).value = '';
  }
  navigateToCreateProgram(): void { this.router.navigate(['/training-programs/new']); }

  viewProgramDetails(programId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.workoutService.vibrate();
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
      this.spinnerService.show(this.translate.instant('trainingPrograms.alerts.deleting'));
      await this.trainingProgramService.deleteProgram(programId);
    } catch (error) { this.toastService.error("An unexpected error occurred", 0, "Deletion Error"); }
    finally { this.spinnerService.hide(); }
  }

  async toggleActiveProgram(programId: string, event?: MouseEvent): Promise<void> {
    const currentProgram = this.allProgramsForList().find(program => program.id === programId);
    if (!currentProgram) {
      return;
    }

    event?.stopPropagation();
    this.activeProgramActions.set(null);
    this.spinnerService.show(this.translate.instant('trainingPrograms.alerts.updating'));
    try {
      if (currentProgram.isActive) {
        // Option to deactivate
        const choice = await this.alertService.showConfirmationDialog(
          this.translate.instant('trainingPrograms.alerts.programActiveTitle'),
          this.translate.instant('trainingPrograms.alerts.programActiveMessage'),
          [
            { text: this.translate.instant('trainingPrograms.alerts.deactivate'), role: "deactivate", data: "deactivate", icon: 'deactivate' },
            { text: this.translate.instant('trainingPrograms.alerts.complete'), role: "complete", data: "complete", icon: 'goal', cssClass: 'bg-green-500 hover:bg-green-600' },
            { text: this.translate.instant('common.cancel'), role: "cancel", data: "cancel", icon: 'cancel' },
          ]
        );

        if (!choice || !choice.data || choice.data === "cancel") {
          this.spinnerService.hide();
          return;
        }

        if (choice.data === "complete") {
          try {
            this.spinnerService.show(this.translate.instant('trainingPrograms.alerts.completing'));
            await this.trainingProgramService.toggleProgramActivation(programId, 'completed');
            // Service emits updated list
          } catch (error) {
            this.toastService.error(this.translate.instant('trainingPrograms.toasts.finishFailed'), 0, "Error");
          } finally {
            this.spinnerService.hide();
          }
          return;
        } else {
          try {
            this.spinnerService.show(this.translate.instant('trainingPrograms.alerts.deactivating'));
            await this.trainingProgramService.deactivateProgram(programId, 'cancelled');
            // Service emits updated list
          } catch (error) { this.toastService.error(this.translate.instant('trainingPrograms.toasts.deactivateFailed'), 0, "Error"); }
          finally { this.spinnerService.hide(); }
        }
        return;
      }
      // Activate new program
      try {
        this.spinnerService.show(this.translate.instant('trainingPrograms.alerts.settingActive'));
        // The service method should handle setting the new active program,
        // updating isActive flags on all programs, and emitting the updated list.
        await this.trainingProgramService.toggleProgramActivation(programId, 'active');
        this.toastService.success(this.translate.instant('trainingPrograms.toasts.programActivated'), 0, "Error");
      } catch (error) { this.toastService.error(this.translate.instant('trainingPrograms.toasts.setActiveFailed'), 0, "Error"); }
      finally { this.spinnerService.hide(); }
    } catch (error) {
      this.toastService.error(this.translate.instant('trainingPrograms.toasts.statusUpdateFailed'), 0, "Error");
    } finally {
      this.spinnerService.hide();
    }
  }

  async setProgramAsFinished(programId: string): Promise<void> {
    // ask for confirmation before finishing
    const confirm = await this.alertService.showConfirmationDialog(
      this.translate.instant('trainingPrograms.alerts.finishTitle'),
      this.translate.instant('trainingPrograms.alerts.finishMessage'),
      [
        { text: this.translate.instant('common.cancel'), role: 'cancel', cssClass: 'bg-gray-400 hover:bg-gray-600', icon: 'cancel' },
        { text: this.translate.instant('trainingPrograms.alerts.finishButton'), role: 'confirm', cssClass: 'bg-primary hover:bg-primary-dark', icon: 'done' }
      ]
    );
    if (!confirm || confirm.role !== 'confirm') return;
    this.activeProgramActions.set(null);

    this.spinnerService.show(this.translate.instant('trainingPrograms.alerts.completing'));
    try {
      await this.trainingProgramService.toggleProgramActivation(programId, 'completed');
      // No need to manually update local array; programs$ will emit updated list.
    } catch (error) {
      this.toastService.error(this.translate.instant('trainingPrograms.toasts.finishFailed'), 0, "Error");
    } finally {
      this.spinnerService.hide();
    }
  }


  async setView(view: ProgramListView): Promise<void> {
    if (this.currentView() === view) return;

    if (view === 'calendar') {
      const activeProgs = this.activePrograms();
      if (activeProgs.length > 1 && !this.calendarViewProgram()) {
        const programButtons: AlertButton[] = activeProgs.map(p => ({ text: p.name, role: 'confirm', data: p }));
        programButtons.push({ text: this.translate.instant('common.cancel'), role: 'cancel', data: null });
        const choice = await this.alertService.showConfirmationDialog(this.translate.instant('trainingPrograms.alerts.selectProgramTitle'), this.translate.instant('trainingPrograms.alerts.selectProgramMessage'), programButtons);

        if (choice?.data) {
          this.calendarViewProgram.set(choice.data as TrainingProgram);
        } else {
          return; // User cancelled
        }
      }
    }

    this.currentView.set(view);

    if (view === 'calendar' && this.calendarMonths().length === 0) {
      this.refreshCalendarView();
    }
  }

  selectCalendarDay(day: CalendarDay | null): void {
    if (day?.hasWorkout) {
      this.selectedCalendarDayDetails.set(day);
    } else if (day) {
      this.toastService.info(this.translate.instant(day.isPastDay ? 'trainingPrograms.calendar.wasRestDay' : 'trainingPrograms.calendar.restDay'), 2000, format(day.date, 'EEEE'));
      this.selectedCalendarDayDetails.set(null);
    } else {
      this.selectedCalendarDayDetails.set(null);
    }
  }

  refreshCalendarView(): void {
    this.calendarMonths.set([]);
    this.currentCalendarDate = new Date();
    this.generateCalendarMonths(this.currentCalendarDate, 3); // Initial load of 3 months
  }

  handleActionMenuItemClick(event: { actionKey: string, data?: any }, originalMouseEvent?: MouseEvent): void {
    const programId = event.data?.programId;
    if (!programId) return;

    switch (event.actionKey) {
      case 'view': this.viewProgramDetails(programId); break;
      case 'activate': this.toggleActiveProgram(programId); break;
      case 'finish': this.setProgramAsFinished(programId); break;
      case 'deactivate': this.toggleActiveProgram(programId); break;
      case 'edit': this.editProgram(programId); break;
      case 'delete': this.deleteProgram(programId); break;
    }
    this.activeProgramIdActions.set(null);
  }

  /**
    * Calculates a descriptive string for the number of scheduled days in a program,
    * handling both 'linear' and 'cycled' program types.
    * @param program The program to analyze.
    * @returns A formatted string like "Avg. 4.5 days/week" or "5 days".
    */
  getDaysScheduled(program: TrainingProgram): string {
    // --- NEW: Logic for 'linear' (week-by-week) programs ---
    if (program.programType === 'linear') {
      if (!program.weeks || program.weeks.length === 0) {
        return this.translate.instant('trainingPrograms.card.days', { count: 0 });
      }

      const totalWeeks = program.weeks.length;
      const totalScheduledDays = program.weeks.reduce((accumulator, currentWeek) => accumulator + currentWeek.schedule.length, 0);

      if (totalScheduledDays === 0) {
        return this.translate.instant('trainingPrograms.card.days', { count: 0 });
      }

      const avgDaysPerWeek = totalScheduledDays / totalWeeks;

      // Format to one decimal place, but remove '.0' if it's a whole number.
      // For example, 4.0 becomes "4", but 4.5 remains "4.5".
      const formattedAvg = avgDaysPerWeek.toFixed(1).replace(/\.0$/, '');

      return this.translate.instant('trainingPrograms.card.avgDaysPerWeek', { count: formattedAvg });
    }
    // --- EXISTING: Logic for 'cycled' programs (and fallback for old data) ---
    else {
      if (!program.schedule || program.schedule.length === 0) {
        return this.translate.instant('trainingPrograms.card.days', { count: 0 });
      }
      // This correctly counts the number of unique active days in the cycle.
      const count = new Set(program.schedule.map(s => s.dayOfWeek)).size;
      return this.translate.instant(count === 1 ? 'trainingPrograms.card.days' : 'trainingPrograms.card.days_plural', { count: count });
    }
  }

  getCycleInfo(program: TrainingProgram): string {
    if (program.programType === 'linear' && program.weeks?.length) {
      const weekCount = program.weeks.length;
      return `${weekCount}-Week Program`;
    }
    // Fallback to original 'cycled' logic
    return (program.cycleLength && program.cycleLength > 0) ? `${program.cycleLength}-day cycle` : 'Weekly';
  }
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
            isSameDay(parseISO(log.date), date) && log.routineId === routineForDay.id && log.iterationId === activeProg.iterationId
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
        const unscheduledItemsWithLogs = this.mapWorkoutLogToScheduledItemWithLogs(unscheduledLogsForThisDate, activeProg);

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

  startScheduledWorkout(routineId: string | undefined, programId: string | undefined, scheduledDayId: string | undefined): void {
    if (routineId) {
      this.workoutService.navigateToPlayer(routineId, { queryParams: { programId, scheduledDayId } });
      this.selectCalendarDay(null);
    }
  }

  private loadNextCalendarMonths(): void {
    this.generateCalendarMonths(this.currentCalendarDate, 2); // Load next 2 months
  }

  async generateCalendarMonths(startDate: Date, numberOfMonths: number): Promise<void> {
    const activeProg = this.activeProgramForCalendar();
    if (!activeProg) {
      this.calendarMonths.set([]);
      return;
    }
    this.calendarLoading.set(true);

    const newMonths: CalendarMonth[] = [];
    const allLogsForProgram = this.allWorkoutLogs().filter(log => log.programId === activeProg.id);

    for (let i = 0; i < numberOfMonths; i++) {
      const targetDate = subMonths(startDate, i);
      const monthStart = startOfMonth(targetDate);
      const monthEnd = endOfMonth(targetDate);

      const scheduledEntries = await firstValueFrom(
        this.trainingProgramService.getScheduledRoutinesForDateRangeByProgramId(activeProg.id, monthStart, monthEnd)
      );

      const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const firstDayOfMonth = daysInMonth[0];
      const dayOfWeekForFirst = firstDayOfMonth.getDay();
      const effectiveStartOfWeek = (this.weekStartsOn === 1) ? (dayOfWeekForFirst === 0 ? 6 : dayOfWeekForFirst - 1) : dayOfWeekForFirst;

      newMonths.push({
        monthName: format(targetDate, 'LLLL'),
        monthDate: targetDate,
        year: targetDate.getFullYear(),
        spacers: Array(effectiveStartOfWeek).fill(0),
        days: daysInMonth.map(date => {
          const logsOnThisDay = allLogsForProgram.filter(log => isSameDay(parseISO(log.date), date));
          const scheduledForThisDay = scheduledEntries.filter(entry => isSameDay(entry.date, date));

          const allItems = this.correlateScheduleWithLogs(scheduledForThisDay, logsOnThisDay, activeProg);

          return {
            date,
            isToday: isToday(date),
            isPastDay: isPast(date) && !isToday(date),
            hasWorkout: allItems.length > 0,
            isLogged: allItems.some(item => item.logs.length > 0),
            logCount: logsOnThisDay.length,
            scheduledItems: allItems,
          };
        }),
      });
    }

    this.calendarMonths.update(existing => [...existing, ...newMonths]);
    this.currentCalendarDate = subMonths(startDate, numberOfMonths);
    this.calendarLoading.set(false);
  }

  private correlateScheduleWithLogs(scheduledEntries: { date: Date; scheduledDayInfo: ScheduledRoutineDay }[], logsOnThisDay: WorkoutLog[], activeProgram: TrainingProgram): ScheduledItemWithLogs[] {
    const scheduledRoutineIds = new Set(scheduledEntries.map(e => e.scheduledDayInfo.routineId));

    // 1. Map scheduled routines to their logs
    const scheduledItems: ScheduledItemWithLogs[] = scheduledEntries.map(entry => {
      const routine = this.allRoutinesMap.get(entry.scheduledDayInfo.routineId);
      return routine ? {
        routine,
        scheduledDayInfo: entry.scheduledDayInfo,
        logs: logsOnThisDay.filter(log => log.routineId === routine.id && log.iterationId === activeProgram.iterationId),
        isUnscheduled: false
      } : null;
    }).filter(Boolean) as ScheduledItemWithLogs[];

    // 2. Identify and map unscheduled (ad-hoc) logs for the same day
    const unscheduledLogs = logsOnThisDay.filter(log => log.routineId && !scheduledRoutineIds.has(log.routineId));
    const unscheduledItems = this.mapWorkoutLogToScheduledItemWithLogs(unscheduledLogs, activeProgram);

    return [...scheduledItems, ...unscheduledItems];
  }

  startProgramWorkout(routineId: string, programId: string | undefined, scheduledDayId: string | undefined, event: Event): void {
    event?.stopPropagation();
    if (routineId) {
      this.workoutService.navigateToPlayer(routineId, { queryParams: { programId, scheduledDayId } });
    }
  }

  logPreviousSession(scheduledDayInfo: ScheduledItemWithLogs, workoutDate: Date): void {
    const programId = this.activeProgramForCalendar()?.id;
    if (!programId) {
      this.toastService.error(this.translate.instant('trainingPrograms.toasts.logFailed'), 0, "Error");
      return;
    }

    // The route should be an array of path segments
    this.router.navigate(['workout/log/manual/new/from/', scheduledDayInfo.routine.id], {
      queryParams: {
        programId: programId,
        pastSession: true,
        iterationId: this.activeProgramForCalendar()?.iterationId,
        scheduledDayId: scheduledDayInfo.scheduledDayInfo.id,
        date: format(workoutDate, 'yyyy-MM-dd')
      }
    });
    this.selectCalendarDay(null);
  }

  goToProgramLogs(programId: string | undefined): void {
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

  mapWorkoutLogToScheduledItemWithLogs(logs: WorkoutLog[], activeProgram: TrainingProgram): ScheduledItemWithLogs[] {
    // This helper is for ad-hoc logs that are part of a program but weren't on the schedule for that specific day
    const logsByRoutine = new Map<string, WorkoutLog[]>();
    logs.forEach(log => {
      if (!log.routineId) return;
      if (!logsByRoutine.has(log.routineId)) logsByRoutine.set(log.routineId, []);
      logsByRoutine.get(log.routineId)!.push(log);
    });

    const result: ScheduledItemWithLogs[] = [];
    logsByRoutine.forEach((groupedLogs, routineId) => {
      const routine = this.allRoutinesMap.get(routineId);
      if (routine) {
        result.push({
          routine,
          logs: groupedLogs,
          isUnscheduled: true,
          scheduledDayInfo: { // Create a dummy schedule info for display consistency
            id: groupedLogs[0].id,
            routineId: routineId,
            dayOfWeek: parseISO(groupedLogs[0].date).getDay(),
            programId: activeProgram.id,
            programName: activeProgram.name
          }
        });
      }
    });
    return result;
  }

  getProgramDropdownActionItems(programId: string, mode: MenuMode): ActionMenuItem[] {
    const defaultBtnClass = 'rounded text-left p-4 font-medium text-gray-600 dark:text-gray-300 hover:bg-primary flex items-center hover:text-white dark:hover:text-gray-100 dark:hover:text-white';
    const deleteBtnClass = 'rounded text-left p-4 font-medium text-gray-600 dark:text-gray-300 hover:bg-red-600 flex items-center hover:text-gray-100 hover:animate-pulse';
    const activateBtnClass = 'rounded text-left p-4 font-medium text-gray-600 dark:text-gray-300 hover:bg-green-600 flex items-center hover:text-gray-100';
    const deactivateBtnClass = 'rounded text-left p-4 font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-500 flex items-center hover:text-gray-100';

    const currentProgram = this.allProgramsForList().find(program => program.id === programId);

    const activateProgramBtn = {
      label: this.translate.instant('trainingPrograms.actions.activate'),
      actionKey: 'activate',
      iconName: `activate`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + activateBtnClass,
      data: { programId: programId }
    };

    const deactivateProgramBtn =
    {
      label: this.translate.instant('trainingPrograms.actions.deactivate'),
      actionKey: 'deactivate',
      iconName: `deactivate`,
      iconClass: 'w-7 h-7 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deactivateBtnClass,
      data: { programId: programId }
    };

    const finishProgramBtn = {
      label: this.translate.instant('trainingPrograms.actions.finish'),
      actionKey: 'finish',
      iconName: `goal`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
      data: { programId: programId }
    };

    let actionsArray = [
      {
        label: this.translate.instant('trainingPrograms.actions.view'),
        actionKey: 'view',
        iconName: `eye`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { programId: programId }
      },
      {
        label: this.translate.instant('trainingPrograms.actions.edit'),
        actionKey: 'edit',
        iconName: `edit`,
        iconClass: 'w-8 h-8 mr-2',
        buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + defaultBtnClass,
        data: { programId: programId }
      }
    ] as ActionMenuItem[];

    if (currentProgram?.isActive) {
      actionsArray.push(finishProgramBtn);
      actionsArray.push(deactivateProgramBtn);
    } else {
      actionsArray.push(activateProgramBtn);
    }

    actionsArray.push({ isDivider: true });
    actionsArray.push({
      label: this.translate.instant('trainingPrograms.actions.delete'),
      actionKey: 'delete',
      iconName: `trash`,
      iconClass: 'w-8 h-8 mr-2',
      buttonClass: (mode === 'dropdown' ? 'w-full ' : '') + deleteBtnClass,
      data: { programId: programId }
    });

    return actionsArray;
  }

  activeProgramIdActions = signal<string | null>(null);

  toggleActions(programId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeProgramIdActions.update(current => (current === programId ? null : programId));
  }

  areActionsVisible(programId: string): boolean {
    return this.activeProgramIdActions() === programId;
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
    this.subscriptions.unsubscribe();
    // Clean up HammerJS instances to prevent memory leaks
    if (this.hammerInstanceCalendar) {
      this.hammerInstanceCalendar.destroy();
    }
    if (this.hammerInstanceMode) {
      this.hammerInstanceMode.destroy();
    }
  }

  showBackToTopButton = signal<boolean>(false);
  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.showBackToTopButton.set(window.pageYOffset > 400);

    // Infinite Scroll for Calendar
    const isAtBottom = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200;
    if (isAtBottom && this.currentView() === 'calendar' && !this.calendarLoading()) {
      this.loadNextCalendarMonths();
    }
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

  getCurrentWeekInfo(program: TrainingProgram): { weekNumber: number; name: string } | null {
    return this.trainingProgramService.getCurrentWeekInfo(program);
  }


  fabMenuItems: FabAction[] = [];
  private refreshFabMenuItems(): void {
    this.fabMenuItems = [{
      label: 'trainingPrograms.fab.create',
      actionKey: 'create_program',
      iconName: 'plus-circle',
      cssClass: 'bg-blue-500 focus:ring-blue-400',
      isPremium: true
    },
    ];
  }

  onFabAction(actionKey: string): void {
    switch (actionKey) {
      case 'create_program':
        this.navigateToCreateProgram();
        break;
    }
  }

  getCalendarDayClasses(day: CalendarDay): object {
    const baseClasses = ['cursor-pointer', 'font-bold'];
    let backgroundClasses: string[] = [];
    let textClasses: string[] = ['text-gray-800', 'dark:text-gray-200']; // Default text color

    if (day.hasWorkout) {
      if (day.isLogged) {
        backgroundClasses.push('bg-green-500', 'hover:bg-green-700');
        textClasses = ['text-white']; // Override default text color
      } else {
        backgroundClasses.push('bg-yellow-500', 'hover:bg-yellow-600');
        textClasses = ['text-white']; // Override default text color
      }
    } else {
      if (day.isLogged) {
        backgroundClasses.push('bg-green-500', 'hover:bg-green-700');
      } else {
        // No workout, not logged: default styles apply, potentially with cursor-default
        return { 'cursor-default text-gray-800 dark:text-gray-200 font-bold': true };
      }
    }

    // Specific styles for today
    if (day.isToday) {
      baseClasses.push('ring-4', 'ring-primary');
    }

    // Combine all classes
    const classes = [...baseClasses, ...backgroundClasses, ...textClasses];

    return { [classes.join(' ')]: true };
  }
}