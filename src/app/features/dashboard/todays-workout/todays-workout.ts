// src/app/features/dashboard/todays-workout/todays-workout.component.ts
import { Component, inject, OnInit, signal, ElementRef, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { Routine } from '../../../core/models/workout.model';
import { ProgramDayInfo, ScheduledRoutineDay, TrainingProgram } from '../../../core/models/training-program.model';
import { EnrichedWorkoutLog, WorkoutLog } from '../../../core/models/workout-log.model';
import { WorkoutService } from '../../../core/services/workout.service';
import { catchError, map, Observable, of, Subject, switchMap, takeUntil, tap, combineLatest, ObservedValueOf, take, forkJoin } from 'rxjs';
import Hammer from 'hammerjs';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { TrackingService } from '../../../core/services/tracking.service';
import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { v4 as uuidv4 } from 'uuid';
import { PressDirective } from '../../../shared/directives/press.directive';
import { PressScrollDirective } from '../../../shared/directives/press-scroll.directive';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';

export type SlideAnimationState = 'center' | 'exitToLeft' | 'exitToRight' | 'enterFromLeft' | 'enterFromRight';

@Component({
  selector: 'app-todays-workout',
  standalone: true,
  imports: [CommonModule, DatePipe, PressScrollDirective, TooltipDirective, IconComponent],
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
  availablePrograms = signal<TrainingProgram[]>([]);
  isLoading = signal<boolean>(true);
  currentDate = signal<Date>(new Date());
  private currentDate$: Observable<Date> = toObservable(this.currentDate);
  todaysScheduledWorkouts = signal<{ routine: Routine, scheduledDayInfo: ScheduledRoutineDay }[]>([]);
  logsForDay = signal<EnrichedWorkoutLog[]>([]);

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
          this.workoutService.routines$.pipe(take(1)),
          this.trainingProgramService.programs$.pipe(take(1)),
        ]).pipe(
          switchMap(([activePrograms, logs, allRoutines, allPrograms]) => {
            const enrichedLogs$ = (logs && logs.length > 0)
              ? forkJoin(logs.map(log =>
                combineLatest([
                  this.trainingProgramService.getWeekNameForLog(log),
                  this.trainingProgramService.getDayOfWeekForLog(log)
                ]).pipe(
                  take(1), // Defensive take(1)
                  map(([weekName, dayInfo]) => ({ ...log, weekName, dayName: dayInfo?.dayName || null }))
                )
              ))
              : of([]);

            const workoutObservables$: Observable<{ routine: Routine, scheduledDayInfo: ScheduledRoutineDay } | null>[] = [];
            if (activePrograms) {
              for (const prog of activePrograms) {
                if (prog.programType === 'linear') {
                  if (this.isToday(date)) {
                    // +++ DEFENSIVE FIX: Add take(1) here as well +++
                    workoutObservables$.push(this.trainingProgramService.findNextUncompletedRoutineForProgram(prog).pipe(take(1)));
                  }
                } else {
                  const routineData = this.trainingProgramService.findRoutineForDayInProgram(date, prog);
                  if (routineData && prog.startDate && parseISO(prog.startDate) <= date) {
                    workoutObservables$.push(of(routineData));
                  }
                }
              }
            }
            const scheduledWorkouts$ = workoutObservables$.length > 0 ? forkJoin(workoutObservables$) : of([]);

            return combineLatest([enrichedLogs$, scheduledWorkouts$]).pipe(
              map(([enrichedLogs, scheduledWorkoutsResult]) => {
                const allRoutinesMap = new Map(allRoutines.map((r: Routine) => [r.id, r]));
                
                // Process the results from our observables
                const allWorkoutsForDay = (scheduledWorkoutsResult || [])
                  .filter((data): data is { routine: Routine, scheduledDayInfo: ScheduledRoutineDay } => !!data)
                  .map(data => ({ ...data, scheduledDayInfo: { ...data.scheduledDayInfo, isUnscheduled: false } }));

                const scheduledRoutineIds = new Set(allWorkoutsForDay.map(w => w.routine.id));

                // This logic for finding and displaying unscheduled logs remains valuable.
                const unscheduledLogs = (enrichedLogs ?? []).filter(log =>
                    log.programId &&
                    (activePrograms || []).some(p => p.id === log.programId) &&
                    log.routineId &&
                    !scheduledRoutineIds.has(log.routineId)
                );

                for (const log of unscheduledLogs) {
                    const routine = allRoutinesMap.get(log.routineId!);
                    if (routine) {
                        allWorkoutsForDay.push({
                            routine,
                            scheduledDayInfo: {
                                id: uuidv4(), routineId: routine.id, dayOfWeek: date.getDay(),
                                programId: log.programId!, isUnscheduled: true
                            }
                        });
                    }
                }

                return {
                  allActivePrograms: activePrograms || [],
                  routineData: allWorkoutsForDay,
                  logsForDay: enrichedLogs,
                  allAvailablePrograms: allPrograms
                };
              })
            );
          }),
          catchError(err => {
            console.error("Error loading workout data for date:", date, err);
            return of({ allActivePrograms: [], routineData: [], logsForDay: [], allAvailablePrograms: [] });
          })
        )
      ),
      takeUntil(this.destroy$)
    ).subscribe(state => {
      if (state) {
        this.allActivePrograms.set(state.allActivePrograms);
        this.availablePrograms.set(state.allAvailablePrograms);
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

  startProgramWorkout(routineId: string, programId: string | undefined, scheduledDayId: string | undefined, event: Event): void {
    event?.stopPropagation();
    if (routineId) {
      this.router.navigate(['/workout/play', routineId], { queryParams: { programId, scheduledDayId } });
    }
  }

  startWorkout(routineId: string, event: Event): void {
    event?.stopPropagation();
    if (routineId) {
      this.router.navigate(['/workout/play', routineId]);
    }
  }

  viewRoutineDetails(routineId: string | undefined): void { if (routineId) { this.router.navigate(['/workout/routine/view', routineId]); } }
  viewLogDetails(logId: string): void { this.router.navigate(['/history/log', logId]); }
  managePrograms(): void { this.router.navigate(['/training-programs']); }
  browseRoutines(): void { this.router.navigate(['/workout']); }

  logPastProgramWorkout(routineId: string | undefined, programId: string | undefined, scheduledDayId: string | undefined): void {
    if (!routineId || !programId || !scheduledDayId) return;
    this.router.navigate(['workout/log/manual/new/from/' + routineId], { 
        queryParams: { programId, date: this.currentDate().toISOString(), scheduledDayId } 
    });
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

  viewProgramDetails(programId: string, event?: MouseEvent): void {
    event?.stopPropagation();
    this.router.navigate(['/training-programs/view', programId]);
  }


getProgramNameById(programId: string): string {
    return this.availablePrograms().find(p => p.id === programId)?.name || '';
}

}