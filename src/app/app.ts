import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { NavigationComponent } from './shared/components/navigation/navigation';
import { CommonModule } from '@angular/common';

import { TrackingService } from './core/services/tracking.service';
import { LoggedWorkoutExercise, WorkoutLog } from './core/models/workout-log.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavigationComponent, CommonModule],
  template: `
    <div class="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <!-- Header/Toolbar Area -->
      <header class="bg-primary dark:bg-primary-dark text-white p-4 shadow-md sticky top-0 z-50">
        <div class="container mx-auto flex justify-between items-center">
          <h1 class="text-xl font-semibold">GymBro</h1>
          <button 
            (click)="themeService.toggleTheme()" 
            class="p-2 rounded-full hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Toggle dark mode">
            <!-- SVG Icon for Theme Toggle (e.g., Sun/Moon) -->
            <svg *ngIf="!themeService.isDarkTheme()" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-6.364-.386 1.591-1.591M3 12h2.25m.386-6.364 1.591 1.591" />
            </svg>
            <svg *ngIf="themeService.isDarkTheme()" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          </button>
        </div>
      </header>

      <!-- Main Content Area -->
      <main class="flex-grow container mx-auto p-4 mb-16"> 
        <!-- mb-16 to prevent overlap with fixed bottom nav -->
        <router-outlet></router-outlet>
      </main>

      <!-- Bottom Navigation -->
      <app-navigation></app-navigation>
    </div>
  `,
  // No styleUrls needed if all styling is via Tailwind utility classes in the template
  // or global styles in styles.scss
})
export class AppComponent implements OnInit {
  themeService = inject(ThemeService);
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