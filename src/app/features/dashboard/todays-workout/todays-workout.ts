// src/app/features/dashboard/todays-workout/todays-workout.component.ts
import { Component, inject, OnInit, signal, ElementRef, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { Routine } from '../../../core/models/workout.model';
import { ScheduledRoutineDay } from '../../../core/models/training-program.model';
import { SpinnerService } from '../../../core/services/spinner.service'; // Assuming this is used or could be
import { WorkoutService } from '../../../core/services/workout.service';
import { Observable } from 'rxjs';
import Hammer from 'hammerjs';
import { trigger, state, style, transition, animate } from '@angular/animations';

// Define animation states type for better type safety
export type SlideAnimationState = 'center' | 'exitToLeft' | 'exitToRight' | 'enterFromLeft' | 'enterFromRight';

@Component({
  selector: 'app-todays-workout',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './todays-workout.html',
  styleUrls: ['./todays-workout.scss'],
  animations: [
    trigger('slideAnimation', [
      // States
      state('center', style({ transform: 'translateX(0%)', opacity: 1 })),
      state('exitToRight', style({ transform: 'translateX(100%)', opacity: 0 })), // Old content moves its full width to the right
      state('exitToLeft', style({ transform: 'translateX(-100%)', opacity: 0 })), // Old content moves its full width to the left
      state('enterFromLeft', style({ transform: 'translateX(-100%)', opacity: 0 })), // New content starts off-screen to the left
      state('enterFromRight', style({ transform: 'translateX(100%)', opacity: 0 })), // New content starts off-screen to the right

      // Transitions for OLD content exiting
      transition('center => exitToRight', animate('200ms ease-in')), // Swipe L->R: Old content exits to RIGHT
      transition('center => exitToLeft', animate('200ms ease-in')),  // Swipe R->L: Old content exits to LEFT

      // Transitions for NEW content entering
      transition('enterFromLeft => center', animate('200ms ease-out')), // Swipe L->R: New content enters from LEFT
      transition('enterFromRight => center', animate('200ms ease-out')), // Swipe R->L: New content enters from RIGHT

      // Initial load
      transition('void => center', [
        style({ transform: 'translateX(0%)', opacity: 1 }),
        animate('0s') // No animation for initial appearance, or make it a fade-in
      ]),
      // Optional: if element is added directly to an 'enter' state
      transition('void => enterFromLeft', [style({ transform: 'translateX(-100%)', opacity: 0 }), animate('0s')]),
      transition('void => enterFromRight', [style({ transform: 'translateX(100%)', opacity: 0 }), animate('0s')]),
    ])
  ]
})
export class TodaysWorkoutComponent implements OnInit, AfterViewInit, OnDestroy {
  private trainingProgramService = inject(TrainingProgramService);
  private workoutService = inject(WorkoutService);
  private router = inject(Router);
  private spinnerService = inject(SpinnerService);
  private elementRef = inject(ElementRef);
  private ngZone = inject(NgZone);

  isLoading = signal<boolean>(true);
  todaysScheduledWorkout = signal<{ routine: Routine, scheduledDayInfo: ScheduledRoutineDay } | null>(null);
  currentDate = signal<Date>(new Date());
  availableRoutines$: Observable<Routine[]> | undefined;
  private hammerInstance: any | null = null;

  animationState = signal<SlideAnimationState>('center');
  protected isAnimating = signal<boolean>(false);

  // Animation Durations (should match CSS animations)
  private readonly ANIMATION_OUT_DURATION = 200;
  private readonly ANIMATION_IN_DURATION = 200;

  ngOnInit(): void {
    this.loadTodaysWorkoutContent();
    this.availableRoutines$ = this.workoutService.routines$;
  }

  ngAfterViewInit(): void {
    const swipeCardElement = this.elementRef.nativeElement.querySelector('div[data-swipe-card-content-wrapper]');
    if (swipeCardElement) {
      this.ngZone.runOutsideAngular(() => {
        this.hammerInstance = new Hammer(swipeCardElement);
        this.hammerInstance.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 40, velocity: 0.3 });

        this.hammerInstance.on('swipeleft', () => { // Swipe L->R on screen means content moves left
          if (!this.isAnimating()) {
            this.ngZone.run(() => this.nextDay());
          }
        });
        this.hammerInstance.on('swiperight', () => { // Swipe R->L on screen means content moves right
          if (!this.isAnimating()) {
            this.ngZone.run(() => this.previousDay());
          }
        });
      });
    } else {
      console.error('Swipe content wrapper element NOT found for HammerJS setup.');
    }
  }

  ngOnDestroy(): void {
    this.hammerInstance?.destroy();
  }

  private loadTodaysWorkoutContent(): void {
    this.isLoading.set(true);
    // this.spinnerService.show(); // Optional: if you use a global spinner
    this.trainingProgramService.getRoutineForDay(this.currentDate())
      .subscribe({
        next: (data) => {
          this.todaysScheduledWorkout.set(data);
          this.isLoading.set(false);
          // this.spinnerService.hide();
        },
        error: (err) => {
          console.error("Error fetching scheduled workout:", err);
          this.todaysScheduledWorkout.set(null);
          this.isLoading.set(false);
          // this.spinnerService.hide();
        }
      });
  }

  private changeDay(swipeDirection: 'left' | 'right'): void { // 'left' swipe = next, 'right' swipe = previous
    if (this.isAnimating()) return;
    this.isAnimating.set(true);

    // 1. Trigger OLD content to animate OUT
    if (swipeDirection === 'left') { // User swipes Left on screen (Next Day): Old content exits to Right, New enters from Left
      this.animationState.set('exitToLeft');
    } else { // User swipes Right on screen (Previous Day): Old content exits to Left, New enters from Right
      this.animationState.set('exitToRight');
    }

    // 2. After OUT animation, update data and prepare NEW content to animate IN
    setTimeout(() => {
      this.currentDate.update(d => {
        const newDate = new Date(d);
        newDate.setDate(d.getDate() + (swipeDirection === 'left' ? 1 : -1));
        return newDate;
      });

      // Set the state for NEW content to be OFF-SCREEN
      if (swipeDirection === 'left') { // New content enters from Left
        this.animationState.set('enterFromRight');
      } else { // New content enters from Right
        this.animationState.set('enterFromLeft');
      }

      this.loadTodaysWorkoutContent(); // Load new data (template will update with new data in the 'enterFrom...' position)

      // Use requestAnimationFrame to ensure the 'enterFrom...' state is processed before animating to 'center'
      requestAnimationFrame(() => {
        this.animationState.set('center'); // Trigger "in" animation for new content
      });

      // Reset isAnimating flag after the "in" animation is expected to complete
      // Total duration for isAnimating lock: out_duration + in_duration (since they are sequential)
      setTimeout(() => {
        this.isAnimating.set(false);
      }, this.ANIMATION_IN_DURATION + 50); // Add a small buffer

    }, this.ANIMATION_OUT_DURATION);
  }

  previousDay(): void {
    // console.log('previousDay method called (swipe R->L)');
    this.changeDay('right'); // Swiping right on screen to go to previous day
  }

  nextDay(): void {
    // console.log('nextDay method called (swipe L->R)');
    this.changeDay('left'); // Swiping left on screen to go to next day
  }

  goToToday(): void {
    if (this.isAnimating()) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date
    const currentDateVal = new Date(this.currentDate());
    currentDateVal.setHours(0, 0, 0, 0); // Normalize current date

    if (currentDateVal.getTime() === today.getTime()) return;

    this.isAnimating.set(true);
    const isGoingToPast = currentDateVal > today; // True if current date is in future, moving to past (today)

    // 1. Trigger OLD content to animate OUT
    if (isGoingToPast) { // Old (future) exits Left, New (today) enters Right
      this.animationState.set('exitToRight');
    } else { // Old (past) exits Right, New (today) enters Left
      this.animationState.set('exitToLeft');
    }

    // 2. After OUT animation
    setTimeout(() => {
      this.currentDate.set(new Date()); // Set to actual today

      // Set the state for NEW content (today) to be OFF-SCREEN
      if (isGoingToPast) {
        this.animationState.set('enterFromLeft');
      } else {
        this.animationState.set('enterFromRight');
      }

      this.loadTodaysWorkoutContent();

      requestAnimationFrame(() => {
        this.animationState.set('center'); // Trigger "in" animation
      });

      setTimeout(() => {
        this.isAnimating.set(false);
      }, this.ANIMATION_IN_DURATION + 50);

    }, this.ANIMATION_OUT_DURATION);
  }

  startWorkout(routineId: string | undefined): void {
    if (routineId) {
      this.router.navigate(['/workout/play', routineId]);
    }
  }

  viewRoutineDetails(routineId: string | undefined): void {
    if (routineId) {
      this.router.navigate(['/workout/view', routineId]);
    }
  }

  managePrograms(): void {
    this.router.navigate(['/training-programs']);
  }

  browseRoutines(): void {
    this.router.navigate(['/workout']);
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }
}