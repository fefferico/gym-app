// src/app/features/dashboard/todays-workout/todays-workout.component.ts
import { Component, inject, OnInit, signal, ElementRef, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { Routine } from '../../../core/models/workout.model';
import { ScheduledRoutineDay, TrainingProgram } from '../../../core/models/training-program.model';
import { WorkoutLog } from '../../../core/models/workout-log.model';
import { WorkoutService } from '../../../core/services/workout.service';
import { catchError, map, Observable, of, Subject, switchMap, takeUntil, tap, combineLatest, ObservedValueOf, take } from 'rxjs';
import Hammer from 'hammerjs';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { TrackingService } from '../../../core/services/tracking.service';
import { startOfDay, endOfDay } from 'date-fns';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { v4 as uuidv4 } from 'uuid';
import { PressDirective } from '../../../shared/directives/press.directive';
import { PressScrollDirective } from '../../../shared/directives/press-scroll.directive';

export type SlideAnimationState = 'center' | 'exitToLeft' | 'exitToRight' | 'enterFromLeft' | 'enterFromRight';

@Component({
  selector: 'app-todays-workout',
  standalone: true,
  imports: [CommonModule, DatePipe, PressScrollDirective],
  templateUrl: './todays-workout.html',
  styleUrls: ['./todays-workout.scss'],
  animations: [
    trigger('slideAnimation', [
      state('center', style({ transform: 'translateX(0%)', opacity: 1 })),
      state('exitToRight', style({ transform: 'translateX(100%)', opacity: 0 })),
      state('exitToLeft', style({ transform: 'translateX(-100%)', opacity: 0 })),
      state('enterFromLeft', style({ transform: 'translateX(-100%)', opacity: 0 })),
      state('enterFromRight', style({ transform: 'translateX(100%)', opacity: 0 })),
      transition('center => exitToRight', animate('200ms ease-in')),
      transition('center => exitToLeft', animate('200ms ease-in')),
      transition('enterFromLeft => center', animate('200ms ease-out')),
      transition('enterFromRight => center', animate('200ms ease-out')),
      transition('void => center', [style({ transform: 'translateX(0%)', opacity: 1 }), animate('0s')]),
      transition('void => enterFromLeft', [style({ transform: 'translateX(-100%)', opacity: 0 }), animate('0s')]),
      transition('void => enterFromRight', [style({ transform: 'translateX(100%)', opacity: 0 }), animate('0s')]),
    ])
  ]
})
export class TodaysWorkoutComponent implements OnInit, AfterViewInit, OnDestroy {
  // --- Injected Services ---
  private trainingProgramService = inject(TrainingProgramService);
  private trackingService = inject(TrackingService);
  private workoutService = inject(WorkoutService);
  private router = inject(Router);
  private elementRef = inject(ElementRef);
  private ngZone = inject(NgZone);

  private sanitizer = inject(DomSanitizer);

  // --- Signals for State Management ---
  allActivePrograms = signal<TrainingProgram[]>([]);
  isLoading = signal<boolean>(true);
  currentDate = signal<Date>(new Date());
  private currentDate$: Observable<Date> = toObservable(this.currentDate);
  todaysScheduledWorkouts = signal<{ routine: Routine, scheduledDayInfo: ScheduledRoutineDay }[]>([]);
  logsForDay = signal<WorkoutLog[]>([]);

  // --- Other Properties ---
  availableRoutines$: Observable<Routine[]>;
  private hammerInstance: HammerManager | null = null;
  animationState = signal<SlideAnimationState>('center');
  protected isAnimating = signal<boolean>(false);
  private readonly ANIMATION_OUT_DURATION = 200;
  private readonly ANIMATION_IN_DURATION = 200;
  private destroy$ = new Subject<void>();

  constructor() {
    this.availableRoutines$ = this.workoutService.routines$;
  }

  formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  ngOnInit(): void {
    this.currentDate$.pipe(
      tap(() => this.isLoading.set(true)),
      switchMap(date =>
        combineLatest([
          this.trainingProgramService.getActivePrograms(),
          this.trackingService.getLogsForDate(this.formatDate(date)),
          this.workoutService.routines$.pipe(take(1)) // Fetch all routines to build a lookup map
        ]).pipe(
          map(([activePrograms, logsForDay, allRoutines]) => {
            const allRoutinesMap = new Map<string, Routine>();
            allRoutines.forEach(r => allRoutinesMap.set(r.id, r));

            const allWorkoutsForDay: { routine: Routine, scheduledDayInfo: ScheduledRoutineDay & { isUnscheduled?: boolean } }[] = [];
            const activeProgramIds = new Set((activePrograms || []).map(p => p.id));

            // 1. Find regularly scheduled workouts from active programs.
            if (activePrograms) {
              for (const prog of activePrograms) {
                const routineData = this.trainingProgramService.findRoutineForDayInProgram(date, prog);
                if (routineData && prog.startDate) {
                  const programStartDate = new Date(prog.startDate);
                  programStartDate.setHours(0, 0, 0, 0);
                  const streamDate = new Date(date);
                  streamDate.setHours(0, 0, 0, 0);
                  if (programStartDate <= streamDate) {
                    allWorkoutsForDay.push({ ...routineData, scheduledDayInfo: { ...routineData.scheduledDayInfo, isUnscheduled: false } });
                  }
                }
              }
            }

            const scheduledRoutineIds = new Set(allWorkoutsForDay.map(w => w.routine.id));

            // 2. Find unscheduled workouts that were logged today under an active program.
            const unscheduledLogs = (logsForDay ?? []).filter(log =>
              log.programId &&
              activeProgramIds.has(log.programId) &&
              log.routineId &&
              !scheduledRoutineIds.has(log.routineId)
            );

            // 3. Group unscheduled logs by routine to handle multiple logs for the same routine.
            const unscheduledLogsByRoutine = new Map<string, WorkoutLog[]>();
            for (const log of unscheduledLogs) {
              if (!log.routineId) continue;
              if (!unscheduledLogsByRoutine.has(log.routineId)) {
                unscheduledLogsByRoutine.set(log.routineId, []);
              }
              unscheduledLogsByRoutine.get(log.routineId)!.push(log);
            }

            // 4. Create workout items for these unscheduled logs.
            for (const [routineId, logs] of unscheduledLogsByRoutine.entries()) {
              const routine = allRoutinesMap.get(routineId);
              const program = activePrograms?.find(p => p.id === logs[0].programId);

              if (routine && program) {
                const dummyScheduledDayInfo: ScheduledRoutineDay & { isUnscheduled?: boolean } = {
                  id: uuidv4(),
                  routineId: routineId,
                  dayOfWeek: date.getDay(),
                  programId: program.id,
                  isUnscheduled: true
                };
                allWorkoutsForDay.push({ routine: routine, scheduledDayInfo: dummyScheduledDayInfo });
              }
            }

            return {
              allActivePrograms: activePrograms || [],
              routineData: allWorkoutsForDay,
              logsForDay,
            };
          }),
          catchError(err => {
            console.error("Error loading workout data for date:", date, err);
            return of({ allActivePrograms: [], routineData: [], logsForDay: [] });
          })
        )
      ),
      takeUntil(this.destroy$)
    ).subscribe(state => {
      if (state) {
        this.allActivePrograms.set(state.allActivePrograms);
        this.todaysScheduledWorkouts.set(state.routineData);
        this.logsForDay.set(state.logsForDay ?? []);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Helper function for the template to check if a specific routine has been logged today.
   * @param routineId The ID of the routine to check.
   * @returns True if a log exists for this routine on the current day.
   */
  isWorkoutLogged(routineId: string): boolean {
    return this.logsForDay().some(log => log.routineId === routineId);
  }

  ngAfterViewInit(): void {
    const swipeCardElement = this.elementRef.nativeElement.querySelector('div[data-swipe-card-content-wrapper]');
    if (swipeCardElement) {
      this.ngZone.runOutsideAngular(() => {
        this.hammerInstance = new Hammer(swipeCardElement);
        this.hammerInstance.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 40, velocity: 0.3 });
        this.hammerInstance.on('swipeleft', () => { if (!this.isAnimating()) { this.ngZone.run(() => this.nextDay()); } });
        this.hammerInstance.on('swiperight', () => { if (!this.isAnimating()) { this.ngZone.run(() => this.previousDay()); } });
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.hammerInstance?.destroy();
  }

  private changeDay(swipeDirection: 'left' | 'right'): void {
    if (this.isAnimating()) return;
    this.isAnimating.set(true);
    this.animationState.set(swipeDirection === 'left' ? 'exitToLeft' : 'exitToRight');
    setTimeout(() => {
      this.currentDate.update(d => {
        const newDate = new Date(d);
        newDate.setDate(d.getDate() + (swipeDirection === 'left' ? 1 : -1));
        return newDate;
      });
      this.animationState.set(swipeDirection === 'left' ? 'enterFromRight' : 'enterFromLeft');
      requestAnimationFrame(() => { this.animationState.set('center'); });
      setTimeout(() => { this.isAnimating.set(false); }, this.ANIMATION_IN_DURATION + 50);
    }, this.ANIMATION_OUT_DURATION);
  }

  previousDay(): void { this.changeDay('right'); }
  nextDay(): void { this.changeDay('left'); }

  goToToday(): void {
    if (this.isAnimating()) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentDateVal = new Date(this.currentDate());
    currentDateVal.setHours(0, 0, 0, 0);
    if (currentDateVal.getTime() === today.getTime()) return;
    this.isAnimating.set(true);
    const isGoingToPast = currentDateVal > today;
    this.animationState.set(isGoingToPast ? 'exitToRight' : 'exitToLeft');
    setTimeout(() => {
      this.currentDate.set(new Date());
      this.animationState.set(isGoingToPast ? 'enterFromLeft' : 'enterFromRight');
      requestAnimationFrame(() => { this.animationState.set('center'); });
      setTimeout(() => { this.isAnimating.set(false); }, this.ANIMATION_IN_DURATION + 50);
    }, this.ANIMATION_OUT_DURATION);
  }

  startWorkoutProgram(routineId: string | undefined, programId: string | undefined = undefined, event: Event): void {
    event?.stopPropagation();
    if (routineId) {
      this.router.navigate(['/workout/play', routineId], { queryParams: { programId: programId } });
    }
  }

  viewRoutineDetails(routineId: string | undefined): void { if (routineId) { this.router.navigate(['/workout/routine/view', routineId]); } }
  viewLogDetails(logId: string): void { this.router.navigate(['/history/log', logId]); }
  managePrograms(): void { this.router.navigate(['/training-programs']); }
  browseRoutines(): void { this.router.navigate(['/workout']); }

  logPastProgramWorkout(routineId: string | undefined, programId: string | undefined): void {
    this.router.navigate(['workout/log/manual/new/from/' + routineId], { queryParams: { programId: programId, date: this.currentDate() } });
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  }

  isFutureDate(date: Date): boolean {
    const today = new Date();
    const checkDate = new Date(date);
    today.setHours(0, 0, 0, 0);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate.getTime() > today.getTime();
  }

  getRoutineDuration(routine: Routine): number {
    if (routine) { return this.workoutService.getEstimatedRoutineDuration(routine); }
    return 0;
  }

  secondsToDateTime(seconds: number): Date {
    const d = new Date(0, 0, 0, 0, 0, 0, 0);
    d.setSeconds(seconds);
    return d;
  }

  findRoutineLog(routineId: string): Observable<WorkoutLog | undefined> {
    return this.trackingService.getWorkoutLogByRoutineId(routineId);
  }

  getLogForRoutine(routineId: string): WorkoutLog {
    return this.logsForDay().find(log => log.routineId === routineId) || {} as WorkoutLog;
  }

  protected updateSanitizedDescription(value: string): SafeHtml {
    // This tells Angular to trust this HTML string and render it as is.
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}