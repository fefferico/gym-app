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
  
  <!-- Let's assume you have a header/navbar component here -->
  <!-- It should be fixed or sticky for this problem to occur -->
  <!-- <app-header class="sticky top-0 z-50"></app-header> -->

  <!-- 
    =================== THE FIX ===================
    - REMOVE mb-16 (margin-bottom).
    - ADD pt-16 (padding-top) to push content down below the header.
    - ADD pb-20 (padding-bottom) to create space above the bottom nav.
    - The padding will apply to all components rendered in the <router-outlet>.
    ===============================================
  -->
  <!-- <main class="flex-grow container mx-auto pt-16 pb-20">  -->
  <main class="flex-grow container mx-auto" 
      [ngClass]="{ 
        'pb-20': !isFullScreenPlayerActive,
        'mb-0': isFullScreenPlayerActive 
      }">  
    <app-toast-container></app-toast-container>
    <router-outlet></router-outlet>
    <app-spinner></app-spinner>
  </main>

  <!-- The bottom navigation is now a sibling to <main> and can be fixed to the bottom -->
  <footer class="fixed bottom-0 left-0 right-0 z-50">
    <app-paused-workout *ngIf="shouldShowPausedBanner()"></app-paused-workout>
    <app-navigation *ngIf="shouldShowNavigationBanner()"></app-navigation>
  </footer>

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
  shouldShowNavigationBanner = signal(true);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

    isFullScreenPlayerActive = false;

  constructor() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Check if the current URL is ANY of the full-screen player routes
      const url = event.urlAfterRedirects;
      this.isFullScreenPlayerActive = url.includes('/play/tabata') || url.includes('/play/focus'); // Add other player routes here
    });
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
      this.shouldShowPausedBanner.set(data['showPausedWorkoutBanner'] === true);
      this.shouldShowNavigationBanner.set(data['shouldShowNavigationBanner'] === true);
    });
  }
}