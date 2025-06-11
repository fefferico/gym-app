// src/app/features/dashboard/todays-workout/todays-workout.component.ts
import { Component, inject, OnInit, signal, ElementRef, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { TrainingProgramService } from '../../../core/services/training-program.service';
import { Routine } from '../../../core/models/workout.model';
import { ScheduledRoutineDay } from '../../../core/models/training-program.model';
import { SpinnerService } from '../../../core/services/spinner.service';
import { WorkoutService } from '../../../core/services/workout.service';
import { Observable } from 'rxjs';
import Hammer from 'hammerjs';
import { trigger, state, style, transition, animate } from '@angular/animations';

@Component({
  selector: 'app-todays-workout',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './todays-workout.html',
  styleUrls: ['./todays-workout.scss'],
  animations: [
    trigger('slideAnimation', [
      state('center', style({ transform: 'translateX(0%)', opacity: 1 })),
      state('slideOutToLeft', style({ transform: 'translateX(-100%)', opacity: 0 })),
      state('slideOutToRight', style({ transform: 'translateX(100%)', opacity: 0 })),
      // No explicit 'slideInFrom...' states needed if we reset transform before centering

      transition('center => slideOutToLeft', animate('200ms ease-in')),
      transition('center => slideOutToRight', animate('200ms ease-in')),

      // For content entering: we'll set it to an off-screen position then animate to center
      transition('void => center', [ // For initial load, or if element is re-added
        style({ transform: 'translateX(0%)', opacity: 1 }), // Start visible if it's just appearing
        animate('0s') // No animation for initial appearance, or make it a fade-in
      ]),
      transition('slideOutToLeft => center', [ // This is for the NEW content after old one left
        style({ transform: 'translateX(100%)', opacity: 0 }), // New content enters from right
        animate('200ms ease-out')
      ]),
      transition('slideOutToRight => center', [ // This is for the NEW content after old one left
        style({ transform: 'translateX(-100%)', opacity: 0 }), // New content enters from left
        animate('200ms ease-out')
      ]),
    ])
  ]
})
export class TodaysWorkoutComponent implements OnInit, AfterViewInit, OnDestroy {
  private trainingProgramService = inject(TrainingProgramService);
  private workoutService = inject(WorkoutService);
  private router = inject(Router);
  private spinnerService = inject(SpinnerService); // Optional
  private elementRef = inject(ElementRef);
  private ngZone = inject(NgZone);

  isLoading = signal<boolean>(true);
  todaysScheduledWorkout = signal<{ routine: Routine, scheduledDayInfo: ScheduledRoutineDay } | null>(null);
  currentDate = signal<Date>(new Date());
  availableRoutines$: Observable<Routine[]> | undefined;
  private hammerInstance: any | null = null;

  // Animation state for the content
  animationState = signal<'center' | 'slideOutToLeft' | 'slideOutToRight'>('center');
  protected isAnimating = false; // To prevent multiple rapid clicks/swipes

  ngOnInit(): void {
    this.loadTodaysWorkoutContent(); // Initial load
    this.availableRoutines$ = this.workoutService.routines$;
  }

  ngAfterViewInit(): void {
    const swipeCardElement = this.elementRef.nativeElement.querySelector('div[data-swipe-card-content-wrapper]'); // Target the inner content wrapper for Hammer
    if (swipeCardElement) {
      this.ngZone.runOutsideAngular(() => {
        this.hammerInstance = new Hammer(swipeCardElement);
        this.hammerInstance.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL, threshold: 20, velocity: 0.2 }); // Adjusted thresholds

        this.hammerInstance.on('swipeleft', () => {
          if (!this.isAnimating) {
            this.ngZone.run(() => this.nextDay());
          }
        });
        this.hammerInstance.on('swiperight', () => {
          if (!this.isAnimating) {
            this.ngZone.run(() => this.previousDay());
          }
        });
      });
    } else {
      console.error('Swipe content wrapper element NOT found for direct HammerJS setup.');
    }
  }

  ngOnDestroy(): void {
    this.hammerInstance?.destroy();
  }

  // This method will ONLY fetch data. Animation is handled by changing animationState.
  private loadTodaysWorkoutContent(): void {
    this.isLoading.set(true);
    this.trainingProgramService.getRoutineForDay(this.currentDate())
      .subscribe({
        next: (data) => {
          this.todaysScheduledWorkout.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error("Error fetching today's scheduled workout:", err);
          this.todaysScheduledWorkout.set(null); // Ensure it's cleared on error
          this.isLoading.set(false);
        }
      });
  }

  private changeDay(direction: 'next' | 'previous'): void {
    if (this.isAnimating) return;
    this.isAnimating = true;

    if (direction === 'next') {
      this.animationState.set('slideOutToLeft');
    } else {
      this.animationState.set('slideOutToRight');
    }

    // Wait for the "out" animation to finish
    setTimeout(() => {
      if (direction === 'next') {
        this.currentDate.update(d => {
          const newDate = new Date(d);
          newDate.setDate(d.getDate() + 1);
          return newDate;
        });
      } else {
        this.currentDate.update(d => {
          const newDate = new Date(d);
          newDate.setDate(d.getDate() - 1);
          return newDate;
        });
      }
      this.loadTodaysWorkoutContent(); // Load new content
      // The animation to 'center' for new content will be triggered by the transition
      // from 'slideOutToLeft' or 'slideOutToRight' to 'center'
      // after the content has been updated by loadTodaysWorkoutContent
      this.animationState.set('center'); // Trigger "in" animation for the new content
      
      // Allow new animations after this one completes
      setTimeout(() => { this.isAnimating = false; }, 250); // Match "in" animation duration
    }, 200); // Match "out" animation duration
  }

  previousDay(): void {
    console.log('previousDay method called');
    this.changeDay('previous');
  }

  nextDay(): void {
    console.log('nextDay method called');
    this.changeDay('next');
  }

  goToToday(): void {
    if (this.isAnimating) return;

    const today = new Date();
    const currentDateVal = this.currentDate();
    if (currentDateVal.getTime() === today.getTime()) return;

    this.isAnimating = true;

    if (currentDateVal > today) {
      this.animationState.set('slideOutToRight');
    } else {
      this.animationState.set('slideOutToLeft');
    }

    setTimeout(() => {
      this.currentDate.set(new Date());
      this.loadTodaysWorkoutContent();
      this.animationState.set('center');
      setTimeout(() => { this.isAnimating = false; }, 250);
    }, 200);
  }


  startWorkout(routineId: string | undefined): void {
    if (routineId) {
      const navigationExtras: any = {};
      // const programInfo = this.todaysScheduledWorkout();
      // if (programInfo && programInfo.scheduledDayInfo.programId) {
      //   navigationExtras.queryParams = { programId: programInfo.scheduledDayInfo.programId };
      // }
      this.router.navigate(['/workout/play', routineId], navigationExtras);
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