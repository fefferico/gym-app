// navigation.ts

import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router'; // Ensure Router is imported
import { PressDirective } from '../../directives/press.directive';

interface NavItem {
  path: string;
  label: string;
  iconSvgPath: string;
  exact?: boolean;
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [RouterLink, CommonModule, PressDirective],
  templateUrl: './navigation.html',
  styleUrls: ['./navigation.scss']
})
export class NavigationComponent {
  // Inject Router and make it public to use in the template
  constructor(public router: Router) { }

  historyPath = '/history';
  routinesPath = '/workout';
  routineDetailsPath = '/workout/routine';
  statsPath = '/history/dashboard';
  summaryPath = '/workout/summary';
  profilePath = '/profile';
  pbPath = '/profile/personal-bests';
  pbTrendPath = '/profile/pb-trend';
  gymPath = '/personal-gym';
  exerciseLibraryPath = '/library';
  trainingProgramsPath = '/training-programs';

  navItems: NavItem[] = [
    { path: '/home', label: 'HOME', iconSvgPath: 'M3 9L12 3L21 9V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9Z M9 21V13H15V21Z', exact: true },
    { path: this.routinesPath, label: 'ROUTINES', iconSvgPath: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z', exact: false },
    { path: this.historyPath, label: 'HISTORY', iconSvgPath: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', exact: false },
    { path: this.trainingProgramsPath, label: 'PROGRAMS', iconSvgPath: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-3.75h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z', exact: true },
    { path: this.statsPath, label: 'STATS', iconSvgPath: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941', exact: true },
    // { path: this.statsPath, label: 'STATS', iconSvgPath: 'M2 3a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v11.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3Z M7.5 6a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H8.5a1 1 0 0 1-1-1V6Z M13 9a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1v5.5a1 1 0 0 1-1 1H14a1 1 0 0 1-1-1V9Z', exact: true },
    { path: this.profilePath, label: 'PROFILE', iconSvgPath: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A1.875 1.875 0 0 1 18.126 22.5H5.874a1.875 1.875 0 0 1-1.373-2.382Z', exact: true },
  ];

  /**
   * THIS IS THE NEW HELPER METHOD
   * It determines if a link should be visually active.
   */
  isLinkActive(item: NavItem): boolean {
  // First, get the default active state for the item itself.
  const isActive = this.router.isActive(item.path, item.exact ?? false);

  // Use a switch statement to handle special cases where a link should
  // be active even if its own path isn't the current URL.
  switch (item.path) {
    // The 'ROUTINES' tab should be active on the main routines page
    // OR on any specific routine's details page.
    case this.routinesPath:
      return (isActive || this.router.isActive(this.routineDetailsPath, false)) && !this.router.isActive(this.summaryPath, false);

    // The 'HISTORY' tab should be active on the main history page
    // OR on the workout summary page.
    case this.historyPath:
      return (isActive || this.router.isActive(this.summaryPath, false)) && !this.router.isActive(this.statsPath, false);

    // The 'PROGRAMS' tab should be active for its main page AND any child pages.
    // By checking with `exact: false`, we cover all routes under '/training-programs'.
    // This is simpler and more robust than the original check.
    case this.trainingProgramsPath:
      return this.router.isActive(item.path, false);

    // The 'STATS' tab should be active on its own page OR on the PB list/trend pages.
    case this.statsPath:
      return isActive || 
             this.router.isActive(this.pbPath, false) || 
             this.router.isActive(this.pbTrendPath, false);

    // The 'PROFILE' tab should be active on its own page OR on the exercise library/gym pages.
    case this.profilePath:
      return isActive ||
             this.router.isActive(this.exerciseLibraryPath, false) ||
             this.router.isActive(this.gymPath, false);

    // For all other nav items that don't have special cases,
    // just return their default active state.
    default:
      return isActive;
  }
}

  /**
   * Navigates to the given path.
   * This is triggered by the (shortPress) event from the appPress directive.
   */
  onNavigate(path: string): void {
    this.router.navigate([path]);
  }

  /**
   * Handles the long press event on a navigation item.
   */
  onLongPress(item: NavItem): void {
    // You can add any custom logic for a long press here.
    // For example, showing a tooltip or a context menu.
    // console.log('Long pressed:', item.label);
  }

  /**
   * Handles the press release event on a navigation item.
   */
  onPressRelease(item: NavItem): void {
    // Scroll to the top of the component (or page)
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // You can add any custom logic for the press release here.
    // console.log('Press released on:', item.label);
  }
}