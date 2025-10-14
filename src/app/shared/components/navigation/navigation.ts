import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router'; // Ensure Router is imported
import { PressDirective } from '../../directives/press.directive';
import { IconComponent } from '../icon/icon.component';
import { PremiumFeature, SubscriptionService } from '../../../core/services/subscription.service';
import { TranslateModule } from '@ngx-translate/core';

interface NavItem {
  path: string;
  label: string;
  iconSvgPath?: string;
  iconName?: string;
  exact?: boolean;
  premiumFeature?: PremiumFeature;
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [RouterLink, CommonModule, PressDirective, IconComponent, TranslateModule],
  templateUrl: './navigation.html',
  styleUrls: ['./navigation.scss']
})
export class NavigationComponent {
  protected subscriptionService = inject(SubscriptionService);
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
    { path: '/home', label: 'navigation.home', iconName: 'home', exact: true },
    { path: this.routinesPath, label: 'navigation.routines', iconName: 'routines', exact: false },
    { path: this.historyPath, label: 'navigation.history', iconName: 'clock', exact: false },
    { path: this.trainingProgramsPath, label: 'navigation.programs', iconName: 'calendar', exact: false, premiumFeature: PremiumFeature.TRAINING_PROGRAMS },
    { path: this.statsPath, label: 'navigation.stats', iconName: 'stats-new', exact: true },
    { path: this.profilePath, label: 'navigation.profile', iconName: 'profile', exact: true },
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
  onNavigate(item: NavItem): void {
    // Check if the item is associated with a premium feature.
    if (item.premiumFeature) {
      // If it is, use the handler that checks for subscription status.
      this.handlePremiumFeatureOrNavigate(item.premiumFeature, [item.path]);
    } else {
      // If it's not a premium feature, navigate directly.
      this.router.navigate([item.path]);
    }
  }

  handlePremiumFeatureOrNavigate(feature: PremiumFeature, route?: any[]): void {
    if (this.subscriptionService.canAccess(feature)) {
      // User has access, proceed with navigation.
      if (route) {
        this.router.navigate(route);
      }
    } else {
      // User does not have access, show the upgrade modal.
      this.subscriptionService.showUpgradeModal();
    }
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