// src/app/core/services/subscription.service.ts
import { Injectable, inject } from '@angular/core';
import { UserProfileService } from './user-profile.service';
import { AlertService } from './alert.service';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
// +++ NEW: Import AppSettingsService to reset settings on downgrade
import { AppSettingsService } from './app-settings.service';
import { TranslateService } from '@ngx-translate/core';

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
  private appSettingsService = inject(AppSettingsService);
  private translate = inject(TranslateService);

  public isPremium$ = this.userProfileService.userProfile$.pipe(
    map(profile => profile?.isPremium ?? false)
  );

  private isPremiumSubject = new BehaviorSubject<boolean>(false);

  private featureLimits = new Map<PremiumFeature, number>([
    [PremiumFeature.UNLIMITED_ROUTINES, 4]
  ]);

  constructor() {
    this.isPremium$.subscribe(isPremium => this.isPremiumSubject.next(isPremium));
  }

  public isPremium(): boolean {
    return this.isPremiumSubject.getValue();
  }

  public canAccess(feature: PremiumFeature, currentUsage?: number): boolean {
    if (this.isPremium()) {
      return true;
    }
    const limit = this.featureLimits.get(feature);
    if (limit !== undefined && currentUsage !== undefined) {
      return currentUsage < limit;
    }
    return false;
  }

  public showUpgradeModal(customMsg?: string): Promise<void> {
    const title = this.translate.instant('subscriptionService.upgradeModal.title');
    const message = customMsg ? customMsg : this.translate.instant('subscriptionService.upgradeModal.message');
    return this.alertService.showAlert(title, message);
  }

  public togglePremium_DEV_ONLY(): void {
    const currentStatus = this.isPremium();
    const newStatus = !currentStatus;
    
    this.userProfileService.updatePremiumStatus(newStatus);

    if (currentStatus === true && newStatus === false) {
      this.downgradeToFree();
    }
  }

  private downgradeToFree(): void {
    console.log("Downgrading user to Free tier. Resetting premium settings...");
    
    this.appSettingsService.saveSettings({
      enableProgressiveOverload: false,
      playerMode: 'compact',
      menuMode: 'dropdown',
    });
  }
}