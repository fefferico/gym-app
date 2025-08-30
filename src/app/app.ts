import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { NavigationComponent } from './shared/components/navigation/navigation';
import { CommonModule } from '@angular/common';

import { TrackingService } from './core/services/tracking.service';
import { LoggedWorkoutExercise, WorkoutLog } from './core/models/workout-log.model';
import { SpinnerComponent } from './shared/components/spinner/spinner.component';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { PausedWorkoutComponent } from './features/workout-tracker/paused-workout/paused-workout.component';
import { filter, map } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavigationComponent, CommonModule, SpinnerComponent, ToastContainerComponent, PausedWorkoutComponent],
  template: `
    <div class="flex flex-col min-h-screen bg-gray-100 dark:bg-gray-900">
      <!-- Header/Toolbar Area -->
      <!-- <header class="bg-primary dark:bg-primary-dark text-white p-4 shadow-md sticky top-0 z-50">
        <div class="container mx-auto flex justify-between items-center">
          <h1 class="text-xl font-semibold">GymBro</h1>
        </div>
      </header> -->

      <!-- Main Content Area -->
      <main class="flex-grow container mx-auto mb-16"> 
        <!-- mb-16 to prevent overlap with fixed bottom nav -->
        <app-toast-container></app-toast-container>
        <router-outlet></router-outlet>
        <app-spinner></app-spinner>
      </main>

      <!-- Bottom Navigation -->
<app-paused-workout *ngIf="shouldShowPausedBanner()"></app-paused-workout>
      <app-navigation></app-navigation>
    </div>
  `,
  // No styleUrls needed if all styling is via Tailwind utility classes in the template
  // or global styles in styles.scss
})
export class AppComponent implements OnInit {
  private themeService = inject(ThemeService); // Keep for early initialization via constructor
  private trackingService = inject(TrackingService); // Inject for testing
  // Signal to control the visibility of the paused workout banner
  shouldShowPausedBanner = signal(false);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  constructor() {
    // The ThemeService constructor and its effect will handle initial theme application.
  }


  ngOnInit(): void {
    // Listen for router events to know when navigation has completed
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => {
        // Traverse the route tree to find the most deeply nested activated route
        let route = this.activatedRoute;
        while (route.firstChild) {
          route = route.firstChild;
        }
        return route;
      }),
      // Get the data property from the final activated route's snapshot
      map(route => route.snapshot.data)
    ).subscribe(data => {
      // Update the signal based on the 'showPausedWorkoutBanner' flag in the route data
      this.shouldShowPausedBanner.set(data['showPausedWorkoutBanner'] === true);
    });
  }
}