// src/app/features/training-programs/training-program-list/training-program-list.component.ts
import { Component, inject, OnInit, PLATFORM_ID, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser, TitleCasePipe } from '@angular/common'; // Added TitleCasePipe
import { Router, RouterLink } from '@angular/router'; // Added RouterLink
import { firstValueFrom, Observable, of } from 'rxjs';
import { map, switchMap, take, tap } from 'rxjs/operators';
import { TrainingProgram, ScheduledRoutineDay } from '../../../core/models/training-program.model';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { AlertService } from '../../../core/services/alert.service';
import { ToastService } from '../../../core/services/toast.service';
import { SpinnerService } from '../../../core/services/spinner.service';
import { Routine } from '../../../core/models/workout.model';
import {
  startOfWeek,
  endOfWeek,
  addDays,
  subDays,
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  getDay, // 0 for Sunday, 1 for Monday...
  isSameMonth,
  isPast,
  isFuture,
  parseISO
} from 'date-fns';
import { DayOfWeekPipe } from '../../../shared/pipes/day-of-week-pipe';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { TrackingService } from '../../../core/services/tracking.service';
import { WorkoutLog } from '../../../core/models/workout-log.model';
import { ThemeService } from '../../../core/services/theme.service';

interface ScheduledItemWithLogs { // Renamed for clarity, plural logs
  routine: Routine;
  scheduledDayInfo: ScheduledRoutineDay; // Info from the TrainingProgram.schedule
  logs: WorkoutLog[]; // Array of WorkoutLogs for this routine on this day
}

interface CalendarDay {
  date: Date;
  isCurrentMonth?: boolean;
  isToday: boolean;
  isPastDay: boolean;
  hasWorkout: boolean; // True if any routine is scheduled
  scheduledItems: ScheduledItemWithLogs[]; // Each item can now have multiple logs
}

type ProgramListView = 'list' | 'calendar';
type CalendarDisplayMode = 'week' | 'month'; // New type for calendar mode


@Component({
  selector: 'app-training-program-list',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, TitleCasePipe, DayOfWeekPipe], // Added RouterLink, TitleCasePipe, DayOfWeekPipe
  templateUrl: './training-program-list.html',
  styleUrls: ['./training-program-list.scss'],
  animations: [
    trigger('slideUpDown', [
      transition(':enter', [ // Use :enter for when the element is added to the DOM (e.g., *ngIf becomes true)
        style({ transform: 'translateY(100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0%)', opacity: 1 }))
      ]),
      transition(':leave', [ // Use :leave for when the element is removed from the DOM (e.g., *ngIf becomes false)
        animate('250ms ease-in', style({ transform: 'translateY(100%)', opacity: 0 }))
      ])
    ]),

    trigger('slideInOutActions', [
      state('void', style({
        height: '20px',
        opacity: 0,
        overflow: 'hidden',
        paddingTop: '0',
        paddingBottom: '0',
        marginTop: '0',
        marginBottom: '0'
      })),
      state('*', style({
        height: '*',
        opacity: 1,
        overflow: 'hidden',
        paddingTop: '0.5rem', // Tailwind's p-2
        paddingBottom: '0.5rem' // Tailwind's p-2
      })),
      transition('void <=> *', animate('200ms ease-in-out'))
    ]),
    // NEW ANIMATION for the dropdown menu
    trigger('dropdownMenu', [
      state('void', style({
        opacity: 0,
        transform: 'scale(0.75) translateY(-10px)', // Start slightly smaller and moved up
        transformOrigin: 'top right' // Animate from the top-right corner
      })),
      state('*', style({
        opacity: 1,
        transform: 'scale(1) translateY(0)',
        transformOrigin: 'top right'
      })),
      transition('void => *', [ // Enter animation
        animate('400ms cubic-bezier(0.25, 0.8, 0.25, 1)') // A nice easing function
      ]),
      transition('* => void', [ // Leave animation
        animate('300ms cubic-bezier(0.25, 0.8, 0.25, 1)')
      ])
    ])
  ]
})
export class TrainingProgramListComponent implements OnInit {
  private trainingProgramService = inject(TrainingProgramService);
  private router = inject(Router);
  private alertService = inject(AlertService);
  private toastService = inject(ToastService);
  private spinnerService = inject(SpinnerService);
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private trackingService = inject(TrackingService);
  private themeService = inject(ThemeService); // Inject StorageService

  programs$: Observable<TrainingProgram[]> | undefined;
  activeProgramActions = signal<string | null>(null);
  menuModeCompact: boolean = false; // Signal to control compact menu mode


  // View management
  currentView = signal<ProgramListView>('list'); // Default to 'list' view

  // Calendar state
  calendarViewDate = signal<Date>(new Date()); // The month/week the calendar is showing
  calendarDays = signal<CalendarDay[]>([]);
  calendarLoading = signal<boolean>(false);
  activeProgramForCalendar = signal<TrainingProgram | null | undefined>(null);

  // For weekly view in calendar
  weekStartsOn: 0 | 1 = 1; // 0 for Sunday, 1 for Monday

  calendarDisplayMode = signal<CalendarDisplayMode>('week'); // Default to weekly view
  selectedCalendarDayDetails = signal<CalendarDay | null>(null);

  readonly calendarHeaderFormat = computed(() => {
    return this.calendarDisplayMode() === 'month' ? 'MMMM yyyy' : 'MMMM yyyy'; // Could be more specific for week if needed
  });

  constructor() { }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo(0, 0);
    }
    this.programs$ = this.trainingProgramService.getAllPrograms();
    this.menuModeCompact = this.themeService.isMenuModeCompact();
    this.trainingProgramService.getActiveProgram().subscribe(program => {
      this.activeProgramForCalendar.set(program);
      if (this.currentView() === 'calendar') {
        this.generateCalendarDays();
      }
    });
  }


  // --- Program List Methods (existing) ---
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
    this.activeProgramActions.set(null); // Close dropdown before alert
    // The service method already handles confirmation and toasts
    try {
      this.spinnerService.show("Deleting program...");
      await this.trainingProgramService.deleteProgram(programId);
    } catch (error) {
      console.error("Error initiating program deletion from component:", error);
      this.toastService.error("An unexpected error occurred while trying to delete the program.", 0, "Deletion Error");
    } finally {
      this.spinnerService.hide();
    }
  }
  async toggleActiveProgram(programId: string, currentIsActive: boolean, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    this.activeProgramActions.set(null);
    if (currentIsActive) {
      this.toastService.info("To deactivate, set another program as active.", 3000, "Info");
      return;
    }
    try {
      this.spinnerService.show("Activating program...");
      await this.trainingProgramService.setActiveProgram(programId);
      // Active program will be re-fetched by the subscription in ngOnInit for calendar update
    } catch (error) { /* ... */ } finally { this.spinnerService.hide(); }
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

  previousWeek(): void {
    this.calendarViewDate.update(d => subDays(d, 7));
    this.generateCalendarDays();
  }

  nextWeek(): void {
    this.calendarViewDate.update(d => addDays(d, 7));
    this.generateCalendarDays();
  }

  startScheduledWorkout(routineId: string | undefined): void {
    if (routineId) {
      this.router.navigate(['/workout/play', routineId]);
    }
  }

  logPreviousSession(routineId: string, workoutDate: Date): void {
    this.router.navigate(['/history/add-manual', { routineId, workoutDate: format(workoutDate, 'yyyy-MM-dd') }]);
  }

  goToPreviousProgramSession(programId: string): void {
    this.router.navigate(['history/list']);
  }

  isToday(date: Date): boolean {
    return isToday(date);
  }

  isPast(date: Date): boolean {
    return isPast(date);
  }

  isFuture(date: Date): boolean {
    return isFuture(date);
  }



  isSameMonth(date: Date, viewDate: Date): boolean {
    return isSameMonth(date, viewDate);
  }



























  setView(view: ProgramListView): void {
    this.currentView.set(view);
    if (view === 'calendar') {
      this.calendarDisplayMode.set('week'); // Default to week view when switching to calendar
      this.generateCalendarDays();
    }
  }

  setCalendarDisplayMode(mode: CalendarDisplayMode): void {
    this.calendarDisplayMode.set(mode);
    this.selectedCalendarDayDetails.set(null); // Close detail view when changing mode
    this.generateCalendarDays();
  }


  async generateCalendarDays(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.activeProgramForCalendar()) {
      this.calendarDays.set([]);
      this.selectedCalendarDayDetails.set(null);
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
    } else { // Weekly view
      rangeStart = startOfWeek(viewDate, { weekStartsOn: this.weekStartsOn });
      rangeEnd = endOfWeek(viewDate, { weekStartsOn: this.weekStartsOn });
    }

    const dateRange = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    try {
      const scheduledEntriesFromProgram = await firstValueFrom(
        this.trainingProgramService.getScheduledRoutinesForDateRange(rangeStart, rangeEnd).pipe(take(1))
      );

      const allLogsForPeriod = await firstValueFrom(
        this.trackingService.workoutLogs$.pipe(
          take(1),
          map(logs => logs.filter(log => {
            const logDate = parseISO(log.date); // Assuming log.date is "YYYY-MM-DD" string
            return logDate >= rangeStart && logDate <= rangeEnd;
          }))
        )
      );

      const days: CalendarDay[] = dateRange.map(date => {
        // Get all distinct scheduled routines for this specific 'date' from the program
        const distinctScheduledForThisDate = scheduledEntriesFromProgram.filter(entry =>
          isSameDay(entry.date, date)
        );

        const currentDayIsPast = isPast(date) && !isToday(date);

        const scheduledItemsWithLogs: ScheduledItemWithLogs[] = distinctScheduledForThisDate.map(scheduledEntry => {
          // For each distinct scheduled routine on this day, find all matching logs
          const correspondingLogs: WorkoutLog[] = allLogsForPeriod.filter(log =>
            isSameDay(parseISO(log.date), date) && log.routineId === scheduledEntry.routine.id
          ).sort((a, b) => b.startTime - a.startTime); // Sort logs by start time, newest first

          return {
            routine: scheduledEntry.routine,
            scheduledDayInfo: scheduledEntry.scheduledDayInfo,
            logs: correspondingLogs // This is now an array
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

  // Method to navigate to the workout log summary
  viewSessionSummary(logId: string | undefined): void {
    if (logId) {
      this.router.navigate(['/workout/summary', logId]); // Adjust this route as needed
      this.selectCalendarDay(null); // Close bottom sheet
    }
  }

  previousPeriod(): void {
    if (this.calendarDisplayMode() === 'month') {
      this.calendarViewDate.update(d => subMonths(d, 1));
    } else {
      this.calendarViewDate.update(d => subDays(d, 7));
    }
    this.selectedCalendarDayDetails.set(null); // Close detail view
    this.generateCalendarDays();
  }

  nextPeriod(): void {
    if (this.calendarDisplayMode() === 'month') {
      this.calendarViewDate.update(d => addMonths(d, 1));
    } else {
      this.calendarViewDate.update(d => addDays(d, 7));
    }
    this.selectedCalendarDayDetails.set(null); // Close detail view

    this.generateCalendarDays();
  }

  goToTodayCalendar(): void {
    this.calendarViewDate.set(new Date());
    this.selectedCalendarDayDetails.set(null); // Close detail view

    this.generateCalendarDays();
  }

  get weekDayNames(): string[] {
    const start = startOfWeek(new Date(), { weekStartsOn: this.weekStartsOn });
    return eachDayOfInterval({ start, end: addDays(start, 6) }).map(d => format(d, 'EE')); // 'Mo', 'Tu' for brevity
  }

  selectCalendarDay(day: CalendarDay | null): void {
    if (day && day.hasWorkout) {
      this.selectedCalendarDayDetails.set(day);
    } else if (day && !day.hasWorkout) {
      // Optionally show a "Rest Day" message or do nothing
      this.toastService.info("It's a rest day!", 2000, format(day.date, 'EEEE'));
      this.selectedCalendarDayDetails.set(null); // Ensure it's closed
    } else {
      this.selectedCalendarDayDetails.set(null); // For explicit closing
    }
  }

}