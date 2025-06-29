// src/app/core/services/user-profile.service.ts
import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { StorageService } from './storage.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Gender, UserMeasurements, UserProfile } from '../models/user-profile.model';

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {
  private storageService = inject(StorageService);
  private readonly USER_PROFILE_KEY = 'fitTrackPro_userProfile';

  // Using BehaviorSubject for reactive updates and easy sharing
  private userProfileSubject: BehaviorSubject<UserProfile | null>;
  public userProfile$: Observable<UserProfile | null>;

  // Individual signals for easier component binding if needed, derived from the subject
  public username = signal<string | null | undefined>(undefined);
  // Add other signals for specific parts of the profile if direct binding is common

  constructor() {
    const storedProfile = this.storageService.getItem<UserProfile>(this.USER_PROFILE_KEY);
    this.userProfileSubject = new BehaviorSubject<UserProfile | null>(storedProfile);
    this.userProfile$ = this.userProfileSubject.asObservable();

    // Update signals when profile changes
    this.userProfile$.subscribe(profile => {
      this.username.set(profile?.username);
      // Update other derived signals here
    });
  }

  getProfile(): UserProfile | null {
    return this.userProfileSubject.getValue();
  }

  saveProfile(profile: UserProfile): void {
    const currentProfile = this.getProfile() || {};
    const updatedProfile = { ...currentProfile, ...profile };
    this.storageService.setItem(this.USER_PROFILE_KEY, updatedProfile);
    this.userProfileSubject.next(updatedProfile);
  }

  getUsername(): string | null | undefined {
    return this.userProfileSubject.getValue()?.username;
  }

  updateUsername(username: string): void {
    const currentProfile = this.getProfile() || {};
    this.saveProfile({ ...currentProfile, username });
  }

  getMeasurements(): UserMeasurements | null | undefined {
    return this.userProfileSubject.getValue()?.measurements;
  }

  updateMeasurements(measurements: Partial<UserMeasurements>): void {
    const currentProfile = this.getProfile() || {};
    const updatedMeasurements = { ...(currentProfile.measurements || {}), ...measurements };
    this.saveProfile({ ...currentProfile, measurements: updatedMeasurements });
  }

  updateGender(gender: Gender): void {
    const currentProfile = this.getProfile() || {};
    this.saveProfile({ ...currentProfile, gender });
  }

  // Method to get profile data for backup (used by ProfileSettingsComponent)
  public getDataForBackup(): UserProfile | null {
    return this.getProfile();
  }

  // Method to replace profile data from backup
  public replaceData(newProfile: UserProfile | null): void {
    if (newProfile) {
      this.storageService.setItem(this.USER_PROFILE_KEY, newProfile);
      this.userProfileSubject.next(newProfile);
    } else {
      this.storageService.removeItem(this.USER_PROFILE_KEY);
      this.userProfileSubject.next(null);
    }
  }

  // Method to clear profile data (used by ProfileSettingsComponent)
  public clearUserProfile_DEV_ONLY(): void {
      this.replaceData(null); // Effectively clears the profile
      console.log('User profile data cleared.');
  }
}