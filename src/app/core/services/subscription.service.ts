// src/app/core/services/subscription.service.ts
import { Injectable, inject } from '@angular/core';
import { UserProfileService } from './user-profile.service';
import { AlertService } from './alert.service';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
// +++ NEW: Import AppSettingsService to reset settings on downgrade
import { AppSettingsService } from './app-settings.service';

// Defines which features are gated behind a premium subscription.
export enum PremiumFeature {
  FOCUS_PLAYER = 'focus_player',
  TABATA_PLAYER = 'tabata_player',
  UNLIMITED_ROUTINES = 'unlimited_routines',
  PROGRESSIVE_OVERLOAD = 'progressive_overload',
  PERSONAL_GYM = 'personal_gym',
  CAMERA_TRACKING = 'camera_tracking',
  MENU_MODE = 'menu_mode',
  ACTIVITY = 'activity',
  TRAINING_PROGRAMS = 'training_programs',
  WORKOUT_GENERATOR = 'workout_generator',
  // Add other premium features here in the future
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private userProfileService = inject(UserProfileService);
  private alertService = inject(AlertService);
  // +++ NEW: Inject AppSettingsService
  private appSettingsService = inject(AppSettingsService);

  // A simple flag for now, but could be expanded with expiration dates, etc.
  public isPremium$ = this.userProfileService.userProfile$.pipe(
    map(profile => profile?.isPremium ?? false)
  );

  // A BehaviorSubject to hold the current premium state for easy synchronous access
  private isPremiumSubject = new BehaviorSubject<boolean>(false);

  // --- ENTITLEMENTS ---
  // This map defines the limits for free users.
  private featureLimits = new Map<PremiumFeature, number>([
    [PremiumFeature.UNLIMITED_ROUTINES, 4] // Free users can have a maximum of 4 routines
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
    const newStatus = !currentStatus;
    
    this.userProfileService.updatePremiumStatus(newStatus);

    // +++ NEW: If the user is being downgraded, reset their premium settings.
    if (currentStatus === true && newStatus === false) {
      this.downgradeToFree();
    }
  }

  /**
   * --- NEW METHOD ---
   * Resets all premium-only settings to their default free-tier values.
   * This is called when a user's subscription ends or is cancelled.
   */
  private downgradeToFree(): void {
    console.log("Downgrading user to Free tier. Resetting premium settings...");
    
    // Reset any premium AppSettings to their default values
    this.appSettingsService.saveSettings({
      enableProgressiveOverload: false,
      playerMode: 'compact',
      menuMode: 'dropdown', // 'dropdown' is the default free mode
    });

    // You can add other resets here in the future, for example:
    // this.progressiveOverloadService.disable();
    // this.someOtherPremiumService.resetToDefaults();
  }
}