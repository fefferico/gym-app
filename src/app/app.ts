import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { NavigationComponent } from './shared/components/navigation/navigation';
import { CommonModule } from '@angular/common';

import { TrackingService } from './core/services/tracking.service';
import { LoggedWorkoutExercise, WorkoutLog } from './core/models/workout-log.model';
import { SpinnerComponent } from './shared/components/spinner/spinner.component';
import { ToastContainerComponent } from './shared/components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavigationComponent, CommonModule, SpinnerComponent, ToastContainerComponent],
  template: `
    <div class="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <!-- Header/Toolbar Area -->
      <!-- <header class="bg-primary dark:bg-primary-dark text-white p-4 shadow-md sticky top-0 z-50">
        <div class="container mx-auto flex justify-between items-center">
          <h1 class="text-xl font-semibold">GymBro</h1>
        </div>
      </header> -->

      <!-- Main Content Area -->
      <main class="flex-grow acontainer mx-auto p-1 mb-16"> 
        <!-- mb-16 to prevent overlap with fixed bottom nav -->
        <router-outlet></router-outlet>
        <app-spinner></app-spinner>
        <app-toast-container></app-toast-container>
      </main>

      <!-- Bottom Navigation -->
      <app-navigation></app-navigation>
    </div>
  `,
  // No styleUrls needed if all styling is via Tailwind utility classes in the template
  // or global styles in styles.scss
})
export class AppComponent implements OnInit {
  private themeService = inject(ThemeService); // Keep for early initialization via constructor
  private trackingService = inject(TrackingService); // Inject for testing

  constructor() {
    // The ThemeService constructor and its effect will handle initial theme application.
  }

  ngOnInit() {
    //this.testAddLog(); // Uncomment to test
    //this.trackingService.workoutLogs$.subscribe(logs => console.log('Current Logs:', logs));
  }

  testAddLog() {
    const dummyLoggedExercise: LoggedWorkoutExercise = {
      exerciseId: 'push-up',
      exerciseName: 'Push-up',
      sets: [
        { id: 'set1', exerciseId: 'push-up', repsAchieved: 10, timestamp: new Date().toISOString(), plannedSetId: 'plan_set1' },
        { id: 'set2', exerciseId: 'push-up', repsAchieved: 8, weightUsed: 5, timestamp: new Date().toISOString(), plannedSetId: 'plan_set2' },
      ]
    };
    const dummyLog: Omit<WorkoutLog, 'id'> = {
      routineName: 'Test Workout',
      date: new Date().toISOString(),
      startTime: Date.now() - (60 * 60 * 1000), // An hour ago
      endTime: Date.now(),
      exercises: [dummyLoggedExercise],
      // overa  llNotes: 'Felt good today!',
    };
    this.trackingService.addWorkoutLog(dummyLog);
  }
}