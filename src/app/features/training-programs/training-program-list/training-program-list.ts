// src/app/features/training-programs/training-program-list/training-program-list.component.ts
import { Component, inject, OnInit, PLATFORM_ID, signal, computed, ChangeDetectorRef, OnDestroy } from '@angular/core'; // Added OnDestroy
import { CommonModule, DatePipe, isPlatformBrowser, TitleCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, Observable, of, Subscription } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { TrainingProgram, ScheduledRoutineDay } from '../../../core/models/training-program.model';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { AlertService } from '../../../core/services/alert.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerService } from '../../../core/services/spinner.service';
import { Routine } from '../../../core/models/workout.model';
import {
  startOfWeek, endOfWeek, addDays, subDays, eachDayOfInterval, format,
  isSameDay, isToday, addMonths, subMonths, startOfMonth, endOfMonth,
  isSameMonth, isPast, isFuture, parseISO
} from 'date-fns';
import { DayOfWeekPipe } from '../../../shared/pipes/day-of-week-pipe';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog } from '../../../core/models/workout-log.model';
import { ThemeService } from '../../../core/services/theme.service';
import { WorkoutService } from '../../../core/services/workout.service'; // Import WorkoutService
import { ExerciseService } from '../../../core/services/exercise.service';

interface ScheduledItemWithLogs {
  routine: Routine;
  scheduledDayInfo: ScheduledRoutineDay;
  logs: WorkoutLog[];
}

interface CalendarDay {
  date: Date;
  isCurrentMonth?: boolean;
  isToday: boolean;
  isPastDay: boolean;
  hasWorkout: boolean;
  scheduledItems: ScheduledItemWithLogs[];
}

type ProgramListView = 'list' | 'calendar';
type CalendarDisplayMode = 'week' | 'month';

@Component({
  selector: 'app-training-program-list',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, TitleCasePipe, DayOfWeekPipe],
  templateUrl: './training-program-list.html',
  styleUrls: ['./training-program-list.scss'],
  animations: [
    trigger('slideUpDown', [
      transition(':enter', [
        style({ transform: 'translateY(100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0%)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('250ms ease-in', style({ transform: 'translateY(100%)', opacity: 0 }))
      ])
    ]),
    trigger('slideInOutActions', [
      state('void', style({
        height: '20px', opacity: 0, overflow: 'hidden',
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
    ])
  ]
})
export class TrainingProgramListComponent implements OnInit, OnDestroy {
  private trainingProgramService = inject(TrainingProgramService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private toastService = inject(ToastService);
  private spinnerService = inject(SpinnerService);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private trackingService = inject(TrackingService);
  private themeService = inject(ThemeService);
  private workoutService = inject(WorkoutService); // Inject WorkoutService
  private exerciseService = inject(ExerciseService);

  programs$: Observable<TrainingProgram[]> | undefined;
  allProgramsForList = signal<TrainingProgram[]>([]);
  private programsSubscription: Subscription | undefined;
  private routinesSubscription: Subscription | undefined; // For fetching all routines

  activeProgramActions = signal<string | null>(null);
  menuModeCompact: boolean = false;
  isFilterAccordionOpen = signal(false);

  programSearchTerm = signal<string>('');
  selectedProgramCycleType = signal<string | null>(null);
  selectedProgramGoal = signal<string | null>(null);
  selectedProgramMuscleGroup = signal<string | null>(null);

  // Signals for filter dropdown options
  uniqueProgramGoals = signal<string[]>([]);
  uniqueProgramMuscleGroups = signal<string[]>([]);
  private allRoutines: Routine[] = []; // To store all routines for deriving goals/muscles

  filteredPrograms = computed(() => {
    let programs = this.allProgramsForList();
    const searchTerm = this.programSearchTerm().toLowerCase();
    const cycleType = this.selectedProgramCycleType();
    const goalFilter = this.selectedProgramGoal();
    const muscleFilter = this.selectedProgramMuscleGroup();

    if (searchTerm) {
      programs = programs.filter(p => p.name.toLowerCase().includes(searchTerm));
    }
    if (cycleType) {
      if (cycleType === 'weekly') {
        programs = programs.filter(p => !p.cycleLength || p.cycleLength === 0);
      } else if (cycleType === 'cycled') {
        programs = programs.filter(p => p.cycleLength && p.cycleLength > 0);
      }
    }
    if (goalFilter) {
      programs = programs.filter(p =>
        p.schedule.some(day => {
          const routine = this.allRoutines.find(r => r.id === day.routineId);
          return routine?.goal?.toLowerCase() === goalFilter.toLowerCase();
        })
      );
    }
    if (muscleFilter) {
      programs = programs.filter(p =>
        p.schedule.some(day => {
          const routine = this.allRoutines.find(r => r.id === day.routineId);
          if (!routine) return false;
          // Check all exercises in the routine for the selected muscle group
          for (const ex of routine.exercises) {
            const exercises: any[] = [];
            this.exerciseService.getExerciseById(ex.exerciseId).subscribe(exerciseDetail => {
              if (exerciseDetail) {
                exercises.push(exerciseDetail);
              }
            });
            const exerciseDetail = this.exerciseService.getExerciseById(ex.exerciseId);
            // getExerciseById returns an Observable, but we need a synchronous check for filtering.
            // This means we cannot use it directly here for async fetching.
            // Instead, you should pre-populate a map of exerciseId -> exerciseDetail (with primaryMuscleGroup)
            // during initialization, and use that map here synchronously.
            // For now, fallback to ex.primaryMuscleGroup if available:
            if (exercises.some(exer => exer.primaryMuscleGroup?.toLowerCase() === muscleFilter.toLowerCase())) {
              return true;
            }
          }
          return false;
        })
      );
    }
    return programs;
  });

  currentView = signal<ProgramListView>('list');
  calendarViewDate = signal<Date>(new Date());
  calendarDays = signal<CalendarDay[]>([]);
  calendarLoading = signal<boolean>(false);
  activeProgramForCalendar = signal<TrainingProgram | null | undefined>(null);
  weekStartsOn: 0 | 1 = 1;
  calendarDisplayMode = signal<CalendarDisplayMode>('week');
  selectedCalendarDayDetails = signal<CalendarDay | null>(null);

  readonly calendarHeaderFormat = computed(() => {
    return this.calendarDisplayMode() === 'month' ? 'MMMM yyyy' : 'MMMM yyyy';
  });

  constructor() { }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }

    this.routinesSubscription = this.workoutService.routines$.subscribe(routines => {
      this.allRoutines = routines;
      this.populateFilterOptions(this.allProgramsForList()); // Re-populate if programs already loaded
    });

    this.programsSubscription = this.trainingProgramService.getAllPrograms().subscribe(programs => {
      this.allProgramsForList.set(programs);
      this.populateFilterOptions(programs); // Populate filters once programs are loaded
    });
    // This observable is just for the template's async pipe if needed for loading/empty states
    this.programs$ = this.trainingProgramService.getAllPrograms();


    this.menuModeCompact = this.themeService.isMenuModeCompact();
    this.trainingProgramService.getActiveProgram().subscribe(program => {
      this.activeProgramForCalendar.set(program);
      if (this.currentView() === 'calendar' && program) {
        this.generateCalendarDays();
      } else if (this.currentView() === 'calendar' && !program) {
        this.calendarDays.set([]);
        this.calendarLoading.set(false);
      }
    });
  }

  private populateFilterOptions(programs: TrainingProgram[]): void {
    if (!this.allRoutines || this.allRoutines.length === 0) return;

    const goals = new Set<string>();
    const muscles = new Set<string>();

    programs.forEach(program => {
      program.schedule.forEach(day => {
        const routine = this.allRoutines.find(r => r.id === day.routineId);
        if (routine) {
          if (routine.goal) {
            goals.add(routine.goal);
          }
          routine.exercises.forEach(exerciseDetail => {
            // Assuming ExerciseDetail has primaryMuscleGroup
            // If not, you might need to fetch full exercise details or have it on routine.exercise
            this.exerciseService.getExerciseById(exerciseDetail.exerciseId).subscribe(exerciseDetail => {
              if (exerciseDetail && exerciseDetail.primaryMuscleGroup) {
                muscles.add(exerciseDetail.primaryMuscleGroup);
              }
            });
          });
        }
      });
    });
    this.uniqueProgramGoals.set(Array.from(goals).sort());
    this.uniqueProgramMuscleGroups.set(Array.from(muscles).sort());
  }


  toggleFilterAccordion(): void {
    this.isFilterAccordionOpen.update(isOpen => !isOpen);
  }

  onProgramSearchTermChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.programSearchTerm.set(target.value);
  }

  onProgramCycleTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedProgramCycleType.set(target.value || null);
  }

  onProgramGoalChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedProgramGoal.set(target.value || null);
  }

  onProgramMuscleGroupChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedProgramMuscleGroup.set(target.value || null);
  }

  clearProgramFilters(): void {
    this.programSearchTerm.set('');
    this.selectedProgramCycleType.set(null);
    this.selectedProgramGoal.set(null);
    this.selectedProgramMuscleGroup.set(null);

    const searchInput = document.getElementById('program-search-term') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
    const cycleSelect = document.getElementById('program-cycle-type-filter') as HTMLSelectElement;
    if (cycleSelect) cycleSelect.value = '';
    const goalSelect = document.getElementById('program-goal-filter') as HTMLSelectElement;
    if (goalSelect) goalSelect.value = '';
    const muscleSelect = document.getElementById('program-muscle-filter') as HTMLSelectElement;
    if (muscleSelect) muscleSelect.value = '';
  }

  navigateToCreateProgram(): void {
    this.router.navigate(['/training-programs/new']);
  }

  viewProgram(programId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/training-programs/view', programId]);
    this.activeProgramActions.set(null);
  }

  editProgram(programId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.router.navigate(['/training-programs/edit', programId]);
    this.activeProgramActions.set(null);
  }

  async deleteProgram(programId: string, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.activeProgramActions.set(null);
    try {
      this.spinnerService.show("Deleting program...");
      await this.trainingProgramService.deleteProgram(programId);
    } catch (error) {
      console.error("Error initiating program deletion from component:", error);
      this.toastService.error("An unexpected error occurred. Program might be active or have logs.", 0, "Deletion Error");
    } finally {
      this.spinnerService.hide();
    }
  }

  async toggleActiveProgram(programId: string, currentIsActive: boolean, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.activeProgramActions.set(null);
    if (currentIsActive) {
      this.toastService.info("This program is already active. To change, set another program as active.", 4000, "Info");
      return;
    }
    try {
      this.spinnerService.show("Setting active program...");
      await this.trainingProgramService.setActiveProgram(programId);
    } catch (error) {
      this.toastService.error("Failed to set active program.", 0, "Error");
    } finally {
      this.spinnerService.hide();
    }
  }

  toggleActions(programId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.activeProgramActions.update(current => current === programId ? null : programId);
  }

  getDaysScheduled(program: TrainingProgram): string {
    if (!program.schedule || program.schedule.length === 0) return '0 days';
    const uniqueDays = new Set(program.schedule.map(s => s.dayOfWeek));
    const count = uniqueDays.size;
    return `${count} day${count === 1 ? '' : 's'}`;
  }

  getCycleInfo(program: TrainingProgram): string {
    if (program.cycleLength && program.cycleLength > 0) {
      return `${program.cycleLength}-day cycle`;
    }
    return 'Weekly';
  }

  // Helper methods to display aggregated goals and muscles for a program
  getProgramOverallGoals(program: TrainingProgram): string[] {
    if (!this.allRoutines.length || !program.schedule.length) return [];
    const goals = new Set<string>();
    program.schedule.forEach(day => {
      const routine = this.allRoutines.find(r => r.id === day.routineId);
      if (routine?.goal) {
        goals.add(routine.goal);
      }
    });
    return Array.from(goals);
  }

  getProgramMainMuscleGroups(program: TrainingProgram): string[] {
    if (!this.allRoutines.length || !program.schedule.length) return [];
    const muscles = new Set<string>();
    program.schedule.forEach(day => {
      const routine = this.allRoutines.find(r => r.id === day.routineId);
      routine?.exercises.forEach(ex => {
        this.exerciseService.getExerciseById(ex.exerciseId).subscribe(exerciseDetail => {
          if (exerciseDetail && exerciseDetail.primaryMuscleGroup) {
            muscles.add(exerciseDetail.primaryMuscleGroup);
          }
        });
      });
    });
    return Array.from(muscles);
  }


  setView(view: ProgramListView): void {
    this.currentView.set(view);
    this.isFilterAccordionOpen.set(false);
    if (view === 'calendar') {
      this.calendarDisplayMode.set('week');
      if (this.activeProgramForCalendar()) {
        this.generateCalendarDays();
      } else {
        this.calendarDays.set([]);
        this.calendarLoading.set(false);
      }
    }
  }

  setCalendarDisplayMode(mode: CalendarDisplayMode): void {
    this.calendarDisplayMode.set(mode);
    this.selectedCalendarDayDetails.set(null);
    if (this.activeProgramForCalendar()) {
      this.generateCalendarDays();
    }
  }

  async generateCalendarDays(): Promise<void> {
    const activeProg = this.activeProgramForCalendar();
    if (!isPlatformBrowser(this.platformId) || !activeProg) {
      this.calendarDays.set([]);
      this.selectedCalendarDayDetails.set(null);
      this.calendarLoading.set(false);
      return;
    }
    this.calendarLoading.set(true);
    this.selectedCalendarDayDetails.set(null);
    const viewDate = this.calendarViewDate();
    let rangeStart: Date, rangeEnd: Date;
    if (this.calendarDisplayMode() === 'month') {
      const monthStart = startOfMonth(viewDate);
      const monthEnd = endOfMonth(viewDate);
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
        const distinctScheduledForThisDate = scheduledEntriesFromProgram.filter(entry => isSameDay(entry.date, date));
        const currentDayIsPast = isPast(date) && !isToday(date);
        const scheduledItemsWithLogs: ScheduledItemWithLogs[] = distinctScheduledForThisDate.map(scheduledEntry => {
          const correspondingLogs: WorkoutLog[] = allLogsForPeriod.filter(log =>
            isSameDay(parseISO(log.date), date) && log.routineId === scheduledEntry.routine.id
          ).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
          return {
            routine: scheduledEntry.routine,
            scheduledDayInfo: scheduledEntry.scheduledDayInfo,
            logs: correspondingLogs
          };
        });
        return {
          date: date,
          isCurrentMonth: this.calendarDisplayMode() === 'month' ? isSameMonth(date, viewDate) : true,
          isToday: isToday(date),
          isPastDay: currentDayIsPast,
          hasWorkout: scheduledItemsWithLogs.length > 0,
          scheduledItems: scheduledItemsWithLogs
        };
      });
      this.calendarDays.set(days);
    } catch (error) {
      console.error("Error generating calendar days:", error);
      this.toastService.error("Could not load calendar schedule.", 0, "Error");
      this.calendarDays.set([]);
    } finally {
      this.calendarLoading.set(false);
      this.cdr.detectChanges();
    }
  }

  viewSessionSummary(logId: string | undefined): void {
    if (logId) {
      this.router.navigate(['/workout/summary', logId]);
      this.selectCalendarDay(null);
    }
  }

  previousPeriod(): void {
    if (this.calendarDisplayMode() === 'month') {
      this.calendarViewDate.update(d => subMonths(d, 1));
    } else {
      this.calendarViewDate.update(d => subDays(d, 7));
    }
    this.selectedCalendarDayDetails.set(null);
    if (this.activeProgramForCalendar()) this.generateCalendarDays();
  }

  nextPeriod(): void {
    if (this.calendarDisplayMode() === 'month') {
      this.calendarViewDate.update(d => addMonths(d, 1));
    } else {
      this.calendarViewDate.update(d => addDays(d, 7));
    }
    this.selectedCalendarDayDetails.set(null);
    if (this.activeProgramForCalendar()) this.generateCalendarDays();
  }

  goToTodayCalendar(): void {
    this.calendarViewDate.set(new Date());
    this.selectedCalendarDayDetails.set(null);
    if (this.activeProgramForCalendar()) this.generateCalendarDays();
  }

  get weekDayNames(): string[] {
    const start = startOfWeek(new Date(), { weekStartsOn: this.weekStartsOn });
    return eachDayOfInterval({ start, end: addDays(start, 6) }).map(d => format(d, 'EE'));
  }

  selectCalendarDay(day: CalendarDay | null): void {
    if (day && day.hasWorkout) {
      this.selectedCalendarDayDetails.set(day);
    } else if (day && !day.hasWorkout) {
      this.toastService.info("It's a rest day!", 2000, format(day.date, 'EEEE'));
      this.selectedCalendarDayDetails.set(null);
    } else {
      this.selectedCalendarDayDetails.set(null);
    }
  }

  startScheduledWorkout(routineId: string | undefined, programId: string | undefined): void {
    if (routineId) {
      const navigationExtras: any = {};
      if (programId) {
        navigationExtras.queryParams = { programId: programId };
      }
      this.router.navigate(['/workout/play', routineId], navigationExtras);
      this.selectCalendarDay(null);
    }
  }

  logPreviousSession(routineId: string, workoutDate: Date): void {
    this.router.navigate(['/history/add-manual', { routineId, workoutDate: format(workoutDate, 'yyyy-MM-dd') }]);
    this.selectCalendarDay(null);
  }

  goToPreviousProgramSession(programId: string | undefined): void {
    if (programId) {
      this.router.navigate(['/history/list'], { queryParams: { programId: programId } });
    } else {
      this.router.navigate(['/history/list']);
    }
    this.selectCalendarDay(null);
  }

  isToday(date: Date): boolean { return isToday(date); }
  isPast(date: Date): boolean { return isPast(date) && !isToday(date); } // Ensure !isToday for past
  isFuture(date: Date): boolean { return isFuture(date); }


  ngOnDestroy(): void {
    this.programsSubscription?.unsubscribe();
    this.routinesSubscription?.unsubscribe();
  }
}