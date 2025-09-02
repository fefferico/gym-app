// src/app/core/services/user-profile.service.ts
import { Injectable, inject, signal, WritableSignal } from '@angular/core';
import { StorageService } from './storage.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Gender, MeasurementEntry, UserMeasurements, UserProfile } from '../models/user-profile.model';
import { AlertService } from './alert.service';
import { format, startOfDay } from 'date-fns';

@Injectable({
  providedIn: 'root'
})
export class UserProfileService {
  private storageService = inject(StorageService);
  private alertService = inject(AlertService);
  private readonly USER_PROFILE_KEY = 'fitTrackPro_userProfile';
  private readonly IS_WIP = true;

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
    // Show the disclaimer when the app starts, if necessary
    this.showWipDisclaimer();
    this.migrateLegacyMeasurements();
  }

  // New method to orchestrate showing the disclaimer
  public async showWipDisclaimer(): Promise<void> {
    // Only show if it's a WIP and user hasn't hidden it yet
    if (this.IS_WIP && !this.getHideWipDisclaimer()) {
      // if (this.IS_WIP) {
      const result = await this.alertService.present({
        header: 'Work-in-Progress Disclaimer',
        message: `DISCLAIMER: This is a work-in-progress, browser-based app. This means your workout data won't be saved when you close the browser or clear your browser data. Be sure to regularly export your data and import it again when you return to the app.`,
        backdropDismiss: false,
        inputs: [
          {
            type: 'checkbox',
            name: 'hideDisclaimer',
            label: `Don't show this message again`,
            value: false
          }
        ],
        buttons: [
          {
            text: 'OK',
            role: 'confirm'
          }
        ]
      });

      if (result?.role === 'confirm' && result.values?.['hideDisclaimer']) {
        this.updateHideWipDisclaimer(true);
      }
    }
  }

  // Method to check the disclaimer setting
  getHideWipDisclaimer(): boolean {
    // Assumes 'hideWipDisclaimer' is an optional property on UserProfile
    return this.userProfileSubject.getValue()?.hideWipDisclaimer ?? false;
  }

  // Method to update the disclaimer setting
  updateHideWipDisclaimer(hide: boolean): void {
    const currentProfile = this.getProfile() || {};
    this.saveProfile({ ...currentProfile, hideWipDisclaimer: hide });
  }

  getProfile(): UserProfile | null {
    return this.userProfileSubject.getValue();
  }



  getUsername(): string | null | undefined {
    return this.userProfileSubject.getValue()?.username;
  }

  updateUsername(username: string): void {
    const currentProfile = this.getProfile() || {};
    this.saveProfile({ ...currentProfile, username });
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



  // Method to clear profile data (used by ProfileSettingsComponent)
  public clearUserProfile_DEV_ONLY(): void {
    this.replaceData(null); // Effectively clears the profile
    console.log('User profile data cleared.');
  }


  /**
   * One-time migration to move old measurement data into the new history array.
   */
  private migrateLegacyMeasurements(): void {
    const profile = this.getProfile();
    // Check if legacy 'measurements' exists and 'measurementHistory' does not
    if (profile && profile.measurements && !profile.measurementHistory) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const historyEntry: MeasurementEntry = {
        date: today,
        ...profile.measurements
      };

      profile.measurementHistory = [historyEntry];
      delete profile.measurements; // Clean up the old property
      this.saveProfile(profile);
      console.log('Successfully migrated legacy measurements to history format.');
    }
  }

  /**
   * Adds or updates a measurement entry for a specific date.
   * If an entry for the date exists, it's updated. Otherwise, a new one is created.
   * @param entry The measurement data, including the date.
   */
  public addOrUpdateMeasurementEntry(entry: MeasurementEntry): void {
    const currentProfile = this.getProfile() || {};
    const history = currentProfile.measurementHistory || [];

    if (!entry.date){
      entry.date = format(startOfDay(new Date()), 'yyyy-MM-dd'); // Default to today if no date provided
    }
    const entryIndex = history.findIndex(e => e.date === entry.date);

    if (entryIndex > -1) {
      // Merge with existing entry to preserve fields like notes if not provided
      history[entryIndex] = { ...history[entryIndex], ...entry };
    } else {
      // Add a new entry
      history.push(entry);
    }

    // Sort by date to ensure chronological order
    history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    this.saveProfile({ ...currentProfile, measurementHistory: history });
  }

  // Modify getMeasurements to return the latest one
  getMeasurements(): UserMeasurements | null | undefined {
    const history = this.getProfile()?.measurementHistory;
    if (history && history.length > 0) {
      // The array is sorted, so the last item is the latest
      return history[history.length - 1];
    }
    return null;
  }

  /**
 * Saves the user's measurement goals.
 * @param goals A partial object of measurement goals.
 */
  public saveGoals(goals: Partial<UserMeasurements>): void {
    const currentProfile = this.getProfile() || {};
    this.saveProfile({ ...currentProfile, measurementGoals: goals });
  }

  /**
   * Calculates Body Mass Index (BMI).
   * @returns BMI value or null if data is insufficient.
   */
  public calculateBMI(weight: number, heightCm: number): number | null {
    if (!weight || !heightCm) return null;
    const heightM = heightCm / 100;
    return parseFloat((weight / (heightM * heightM)).toFixed(1));
  }

  /**
   * Calculates Body Fat Percentage using the U.S. Navy method.
   * @returns Body fat percentage or null if data is insufficient.
   */
  public calculateBodyFatNavy(gender: Gender, measurements: { waist: number, neck: number, height: number, hips?: number }): number | null {
    const { waist, neck, height, hips } = measurements;
    if (!gender || !waist || !neck || !height) return null;

    let bodyFat = 0;
    if (gender === 'male') {
      bodyFat = 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(height) + 36.76;
    } else if (gender === 'female') {
      if (!hips) return null; // Hips are required for females
      bodyFat = 163.205 * Math.log10(waist + hips - neck) - 97.684 * Math.log10(height) - 78.387;
    } else {
      return null; // Formula doesn't apply to 'other' genders
    }

    return parseFloat(bodyFat.toFixed(1));
  }

  /**
   * Deletes a measurement entry for a specific date.
   * @param date The date of the entry to delete.
   */
  public deleteMeasurementEntry(date: string): void {
    const currentProfile = this.getProfile();
    if (!currentProfile || !currentProfile.measurementHistory) {
      return;
    }

    const updatedHistory = currentProfile.measurementHistory.filter(e => e.date !== date);

    this.saveProfile({ ...currentProfile, measurementHistory: updatedHistory });
  }

  saveProfile(profile: Partial<UserProfile>): void {
    const currentProfile = this.getProfile() || {};

    // use the most recent profile data, merging with existing data
    if (profile.measurementHistory && profile.measurementHistory.length > 0) {
      // Ensure measurementHistory is sorted by date
      profile.measurementHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      profile.measurements = {...profile.measurements, ...profile.measurementHistory[profile.measurementHistory.length - 1] };
    }

    // Merge the new profile data with the existing one
    const updatedProfile = { ...currentProfile, ...profile };
    
    // Ensure measurementHistory is always sorted when saved
    if (updatedProfile.measurementHistory) {
      updatedProfile.measurementHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }

    this.storageService.setItem(this.USER_PROFILE_KEY, updatedProfile);
    this.userProfileSubject.next(updatedProfile);
  }


  /**
   * Replaces all profile data. Used for legacy imports or full restores.
   * @param newProfile The new profile data to set.
   */
  public replaceData(newProfile: UserProfile | null): void {
    if (newProfile) {
      this.storageService.setItem(this.USER_PROFILE_KEY, newProfile);
      this.userProfileSubject.next(newProfile);
    } else {
      this.storageService.removeItem(this.USER_PROFILE_KEY);
      this.userProfileSubject.next(null);
    }
  }

  /**
   * Intelligently merges an imported profile with the existing one.
   * Prioritizes imported data for simple fields and merges history/goals.
   * @param importedProfile The profile data from the backup file.
   */
  public mergeData(importedProfile: UserProfile | null): void {
    if (!importedProfile) return;

    const localProfile = this.getProfile() || {};

    // Merge measurement history intelligently to avoid duplicates
    const localHistory = localProfile.measurementHistory || [];
    const importedHistory = importedProfile.measurementHistory || [];

    // Use a Map to handle duplicates, prioritizing the imported entry for any given date
    const historyMap = new Map<string, MeasurementEntry>();
    localHistory.forEach(entry => historyMap.set(entry.date, entry));
    importedHistory.forEach(entry => historyMap.set(entry.date, entry));
    
    const mergedHistory = Array.from(historyMap.values());

    // Construct the fully merged profile
    const mergedProfile: UserProfile = {
      // Prioritize imported simple fields, but keep local if importer's is missing
      username: importedProfile.username ?? localProfile.username,
      gender: importedProfile.gender ?? localProfile.gender,
      height: importedProfile.height ?? localProfile.height,
      hideWipDisclaimer: importedProfile.hideWipDisclaimer ?? localProfile.hideWipDisclaimer,
      
      // Overwrite local goals with imported goals if they exist
      measurementGoals: { ...localProfile.measurementGoals, ...importedProfile.measurementGoals },

      // Use the merged and sorted history
      measurementHistory: mergedHistory,
    };
    
    // Save the final merged profile
    this.saveProfile(mergedProfile);
  }
}