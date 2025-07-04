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
import { catchError, map, Observable, of, Subject, switchMap, takeUntil, tap, combineLatest, ObservedValueOf } from 'rxjs';
import Hammer from 'hammerjs';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { TrackingService } from '../../../core/services/tracking.service';
import { startOfDay, endOfDay } from 'date-fns';

export type SlideAnimationState = 'center' | 'exitToLeft' | 'exitToRight' | 'enterFromLeft' | 'enterFromRight';

@Component({
  selector: 'app-todays-workout',
  standalone: true,
  imports: [CommonModule, DatePipe],
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

  // --- Signals for State Management ---
  protected activeProgram = signal<TrainingProgram | null>(null);
  isLoading = signal<boolean>(true);
  currentDate = signal<Date>(new Date());
  private currentDate$: Observable<Date> = toObservable(this.currentDate);
  todaysScheduledWorkout = signal<{ routine: Routine, scheduledDayInfo: ScheduledRoutineDay } | null>(null);
  todaysScheduledWorkoutDone = signal<boolean>(false);
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
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  ngOnInit(): void {
    // Convert the `currentDate` signal into an observable. This is the new source of truth.

    this.currentDate$.pipe(
      // On every new date emission, set loading to true.
      tap(() => this.isLoading.set(true)),

      // Use switchMap to cancel previous requests and start a new data fetch for the new date.
      switchMap(date =>
        // Fetch all necessary data for the new date in parallel.
        combineLatest([
          this.trainingProgramService.getActiveProgram(),
          this.trainingProgramService.getRoutineForDay(date),
          this.trackingService.getLogsForDate(this.formatDate(date)) // Gets all logs for the given day
        ]).pipe(
          // Process the combined results.
          map(([activeProgram, routineData, logsForDay]) => {
            // Determine if the *scheduled* workout is done.
            let isDone = false;
            if (logsForDay) {
              isDone = routineData
                ? logsForDay.some(log => log.routineId === routineData.routine.id)
                : false;
            }

            // Return a single, clean state object.
            return { activeProgram, routineData, logsForDay, isDone };
          }),
          // If fetching data for a specific day fails, return a safe state and don't kill the stream.
          catchError(err => {
            console.error("Error loading workout data for date:", date, err);
            return of({ activeProgram: null, routineData: null, logsForDay: [], isDone: false });
          })
        )
      ),
      // Ensure the entire stream is cleaned up when the component is destroyed.
      takeUntil(this.destroy$)
    ).subscribe(state => {
      // Set all state signals at once from the final processed object.
      this.activeProgram.set(state.activeProgram ?? null);
      this.todaysScheduledWorkout.set(state.routineData);
      this.todaysScheduledWorkoutDone.set(state.isDone);
      this.logsForDay.set(state.logsForDay ?? []);
      this.isLoading.set(false);
    });
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

  // Date navigation methods now ONLY update the signal. The reactive stream in ngOnInit does the rest.
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

  // --- Navigation and Helper Methods ---
  startWorkoutProgram(routineId: string | undefined, event: Event): void {
    event?.stopPropagation();
    if (routineId) {
      this.router.navigate(['/workout/play', routineId], { queryParams: { programId: this.activeProgram()?.id } });
    }
  }

  viewRoutineDetails(routineId: string | undefined): void {
    if (routineId) { this.router.navigate(['/workout/routine/view', routineId]); }
  }

  viewLogDetails(logId: string): void { this.router.navigate(['/history/log', logId]); }
  managePrograms(): void { this.router.navigate(['/training-programs']); }
  browseRoutines(): void { this.router.navigate(['/workout']); }

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
}