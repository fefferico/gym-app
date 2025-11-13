import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, ChildrenOutletContexts, NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { NavigationComponent } from './shared/components/navigation/navigation';
import { CommonModule } from '@angular/common';

import { SpinnerComponent } from './shared/components/spinner/spinner.component';
import { ToastContainerComponent } from './shared/components/toast/toast.component';
import { PausedWorkoutComponent } from './features/workout-tracker/paused-workout/paused-workout.component';
import { filter, map } from 'rxjs';
import { LanguageService } from './core/services/language.service';
import { SpinnerService } from './core/services/spinner.service';
import { animate, group, query, style, transition, trigger } from '@angular/animations';
import { TranslateService } from '@ngx-translate/core';

export const routeAnimation =
  trigger('routeAnimations', [
    transition('* <=> *', [ // Animate between any two routes
      style({ position: 'relative' }),
      query(':enter, :leave', [
        style({
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%'
        })
      ], { optional: true }),
      query(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }) // New page starts transparent and slightly down
      ], { optional: true }),
      group([
        query(':leave', [
          animate('300ms ease-out', style({ opacity: 0, transform: 'translateY(-20px)' })) // Old page fades out and moves up
        ], { optional: true }),
        query(':enter', [
          animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })) // New page fades in and moves to position
        ], { optional: true })
      ])
    ])
  ]);

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
  <main class="flex-grow container mx-auto bg-gray-100 dark:bg-gray-900" [@routeAnimations]="getRouteAnimationData()"
      [ngClass]="{ 
        'pb-20': !isFullScreenPlayerActive,
        'mb-0': isFullScreenPlayerActive 
      }">  
    <app-toast-container></app-toast-container>
    <app-spinner></app-spinner>
    <router-outlet></router-outlet>
  </main>

  <!-- The bottom navigation is now a sibling to <main> and can be fixed to the bottom -->
  <footer class="fixed bottom-0 left-0 right-0 z-50">
    <app-paused-workout appShatterable id="pausedWorkoutFooter" *ngIf="shouldShowPausedBanner()"></app-paused-workout>
    <app-navigation *ngIf="shouldShowNavigationBanner()"></app-navigation>
  </footer>

</div>
  `,
  animations: [ routeAnimation ]
  // No styleUrls needed if all styling is via Tailwind utility classes in the template
  // or global styles in styles.scss
})
export class AppComponent implements OnInit {
  private languageService = inject(LanguageService);
  // Signal to control the visibility of the paused workout banner
  shouldShowPausedBanner = signal(false);
  shouldShowNavigationBanner = signal(true);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private spinnerService = inject(SpinnerService);
  private translateService = inject(TranslateService);

  isFullScreenPlayerActive = false;

  constructor(private contexts: ChildrenOutletContexts) {
    this.languageService.init();
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Check if the current URL is ANY of the full-screen player routes
      const url = event.urlAfterRedirects;
      this.isFullScreenPlayerActive = url.includes('/play/tabata') || url.includes('/play/focus'); // Add other player routes here
    });

    this.router.events.pipe(
      filter(event => 
        event instanceof NavigationStart ||
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      )
    ).subscribe(event => {
      if (event instanceof NavigationEnd){
        let url = event.urlAfterRedirects;
        this.isFullScreenPlayerActive = url.includes('/play/tabata') || url.includes('/play/focus'); // Add other player routes here
      }
      
      if (event instanceof NavigationStart) {
        // Show the spinner as soon as navigation starts
        this.spinnerService.show(this.translateService.instant('common.loading'));
        return;
      }

      // Hide the spinner once navigation is completely finished, cancelled, or has an error.
      // This handles the resolver completing, as well as any failures.
      this.spinnerService.hide();
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

  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.data?.['animation'];
  }
}