// src/app/core/services/subscription.service.ts
import { Injectable, inject } from '@angular/core';
import { UserProfileService } from './user-profile.service';
import { AlertService } from './alert.service';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

// Defines which features are gated behind a premium subscription.
export enum PremiumFeature {
  FOCUS_PLAYER = 'focus_player',
  TABATA_PLAYER = 'tabata_player',
  UNLIMITED_ROUTINES = 'unlimited_routines',
  PROGRESSIVE_OVERLOAD = 'progressive_overload',
  PERSONAL_GYM = 'personal_gym',
  MENU_MODE = 'menu_mode',
  ACTIVITY = 'activity',
  TRAINING_PROGRAMS = 'training_programs',
  // Add other premium features here in the future
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private userProfileService = inject(UserProfileService);
  private alertService = inject(AlertService);

  // A simple flag for now, but could be expanded with expiration dates, etc.
  public isPremium$ = this.userProfileService.userProfile$.pipe(
    map(profile => profile?.isPremium ?? false)
  );

  // A BehaviorSubject to hold the current premium state for easy synchronous access
  private isPremiumSubject = new BehaviorSubject<boolean>(false);

  // --- ENTITLEMENTS ---
  // This map defines the limits for free users.
  private featureLimits = new Map<PremiumFeature, number>([
    [PremiumFeature.UNLIMITED_ROUTINES, 3] // Free users can have a maximum of 3 routines
  ]);

  constructor() {
    // Keep the BehaviorSubject in sync with the observable
    this.isPremium$.subscribe(isPremium => this.isPremiumSubject.next(isPremium));
  }

  /**
   * Synchronously checks if the user currently has a premium subscription.
   * @returns `true` if the user is a premium subscriber, otherwise `false`.
   */
  public isPremium(): boolean {
    return this.isPremiumSubject.getValue();
  }

  /**
   * The core function to check if a user can access a specific feature.
   * It checks for premium status and any defined usage limits for free users.
   *
   * @param feature The PremiumFeature to check access for.
   * @param currentUsage Optional. The user's current number of items (e.g., number of routines).
   * @returns `true` if the user can access the feature, otherwise `false`.
   */
  public canAccess(feature: PremiumFeature, currentUsage?: number): boolean {
    // Premium users have unlimited access to everything.
    if (this.isPremium()) {
      return true;
    }

    // For non-premium users, check against the defined limits.
    const limit = this.featureLimits.get(feature);

    if (limit !== undefined && currentUsage !== undefined) {
      // If there's a limit, the user can access if their usage is below it.
      return currentUsage < limit;
    }

    // If there's no specific limit defined, access is denied for non-premium users.
    return false;
  }

  /**
   * Displays a standardized modal prompting the user to upgrade.
   * Call this when a user attempts to access a feature they are not entitled to.
   */
  public showUpgradeModal(customMsg?: string): Promise<void> {
    return this.alertService.showAlert(
      'Premium Feature',
      customMsg ? customMsg : 'This feature is available for Premium users. Upgrade now to unlock this and much more!'
      // We can add "Upgrade" and "Cancel" buttons here in the future to link to a purchase page.
    );
  }

  /**
   * A development-only function to toggle the user's premium status.
   * In a real app, this would be handled by a server after a purchase.
   */
  public togglePremium_DEV_ONLY(): void {
    const currentStatus = this.isPremium();
    this.userProfileService.updatePremiumStatus(!currentStatus);
  }
}